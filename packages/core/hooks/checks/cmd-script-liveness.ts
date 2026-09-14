/**
 * cmd-script-liveness.ts — Change-scoped command/script guard-liveness runner (Wave guard-liveness v1.5).
 *
 * Closes the liveness gap for `check.type ∈ {command, script}` manifest rules — the
 * non-ESLint half that gate-rule-tester.ts skips. For each changed cmd/script rule
 * it proves the rule's guard actually catches its violation, branching on a
 * per-rule **liveness mode** (Option D — operator decision 2026-06-13):
 *
 *   - mode is DERIVED from check.type by default:
 *       command → run-and-assert        script → resolve-and-run
 *   - an optional manifest field `liveness-mode` overrides the default for the
 *     exceptions the derive rule cannot cover:
 *       "run" | "workflow-exists" | "config-presence" | "exempt"
 *   - the mode rides IN the manifest (manifest-agnostic) — NO rule-id→mode map is
 *     hard-coded in this runner (BFR §1.1 shipped-axis: consumer manifests carry
 *     different IDs; a hard-coded map would give them zero coverage).
 *
 * Honesty contract (T-V15-A): every fixture.setup-script must embody the rule's
 * REAL violating state — never a `false`/`exit 1` force-fail (principle 02
 * TRIVIAL_SETUP_RE rejects those). The run/resolve modes prove LIVENESS as a
 * clean-pass + violating-fail PAIR (operator rework 2026-06-13): the check must
 * exit 0 on the CLEAN pre-fixture state AND non-zero on the violating fixture to
 * `pass`. A check that does not pass clean (crashed, missing config/module) is
 * non-functional in this env and is SKIPPED — this distinguishes "guard caught
 * the violation" from "script crashed before evaluating it". When a check's
 * binary/interpreter/workflow is simply unavailable, the rule is likewise SKIPPED
 * with a visible notice (mirrors guard-liveness.ts' skip-on-unavailable-plugin
 * precedent) — NEVER force-passed.
 *
 * Channel: pre-push (liveness — actually runs the check). The pre-commit
 * structural arm (fixture.setup-script presence) lives in .husky/pre-commit.
 *
 * @channel pre-push gate
 * @dual-pair: guard-liveness-cmd-script
 * @cc-only-rationale: the TypeScript pre-push gate is the primary channel; a
 *   portable agent-prompt form is planned as v3 (manual rules via Superpowers).
 *
 * Reuses runCheck() (utils/run-check.ts, SSOT #54 ADAPT) for every subprocess —
 * timeout + exit + output capture are already there; this module never re-implements
 * subprocess invocation. T13: run-check.ts' timeout case (TIMEOUT_EXIT_CODE=124) is
 * relied on so a hung fixture command cannot wedge the hook.
 *
 * Prior-art (capability commit): no upstream pre-commit framework (lefthook,
 * pre-commit/pre-commit, Aider) runs a per-rule violating-state fixture and asserts
 * the rule's own check exits non-zero — they run user commands on changed files, not
 * a designed pre-condition fixture per rule. BUILD verdict stands; run-check.ts is the
 * ADOPTED subprocess primitive (SSOT #54). See PR body §Prior-art for the sweep.
 */
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { runCheck, type CheckResult } from '../utils/run-check.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = resolve(HERE, '../../../..');
const MANIFEST_REL = 'packages/core/manifest/rules-manifest.json';

/** Internal liveness modes the runner branches on. */
export type LivenessMode =
  | 'run-and-assert'
  | 'resolve-and-run'
  | 'workflow-exists'
  | 'config-presence'
  | 'exempt';

/** The manifest override field values (Option D). */
export type LivenessOverride = 'run' | 'workflow-exists' | 'config-presence' | 'exempt';

export interface CmdScriptCheck {
  type: string;
  command?: string;
  script?: string;
}

export interface Fixture {
  'setup-script': string;
  'cleanup-script'?: string;
  cwd?: string;
}

export interface CmdScriptRule {
  check: CmdScriptCheck;
  fixture?: Fixture;
  'liveness-mode'?: LivenessOverride;
  'auto-skip-if-missing'?: boolean;
  'requires-package'?: string | string[];
}

/**
 * EXEMPT allowlist — the irreducible 2 cmd/script rules with NO runnable form,
 * each with a per-rule rationale (operator decision 2026-06-13). Detection is
 * field-based (`liveness-mode === "exempt"`, manifest-agnostic); this map only
 * supplies the human rationale surfaced in the report. Adding a rule here is a
 * deliberate, reviewed act — never a silent skip.
 */
export const EXEMPT_RULES: Record<string, string> = {
  IR3: 'prose check.script (audit-ai-docs.sh probe — publish() references @org/event-schemas); non-resolvable per v0 Finding 2c — no runnable command form exists.',
  IR4: 'descriptive prose ("depcruise blocks bare fetch() to internal service URLs"), not a runnable command in this manifest; a real depcruise --validate form is deferred to a bespoke probe.',
};

export type LivenessStatus = 'pass' | 'fail' | 'skipped' | 'exempt' | 'no-data' | 'n/a';

export interface RuleLivenessResult {
  status: LivenessStatus;
  mode: LivenessMode | null;
  reason?: string;
  failures?: string[];
}

export interface RunOptions {
  /** Subprocess primitive (injectable for tests). Defaults to runCheck. */
  runCheckFn?: typeof runCheck;
  /** Repo root for workflow/config/script resolution (injectable for tests). */
  repoRoot?: string;
}

/**
 * Resolve a rule's liveness mode (Option D): explicit override wins, else derive
 * from check.type. Returns null for non-cmd/script rules (n/a).
 */
export function resolveMode(rule: CmdScriptRule): LivenessMode | null {
  const override = rule['liveness-mode'];
  if (override) {
    switch (override) {
      case 'run':
        return 'run-and-assert';
      case 'workflow-exists':
        return 'workflow-exists';
      case 'config-presence':
        return 'config-presence';
      case 'exempt':
        return 'exempt';
    }
  }
  if (rule.check.type === 'command') return 'run-and-assert';
  if (rule.check.type === 'script') return 'resolve-and-run';
  return null;
}

/** Is this rule exempt from the liveness gate (and the fixture-required flip)? */
export function isExempt(rule: CmdScriptRule): boolean {
  return rule['liveness-mode'] === 'exempt';
}

/**
 * Strip a trailing parenthetical description from a manifest check value, leaving
 * the runnable command head. "depcruise --validate (blocks @emotion)" → "depcruise --validate".
 */
export function extractRunnable(raw: string): string {
  const parenIdx = raw.indexOf(' (');
  return (parenIdx >= 0 ? raw.slice(0, parenIdx) : raw).trim();
}

/** Split a compound `a && b` command into independently-runnable sub-commands. */
export function splitCompound(cmd: string): string[] {
  return cmd
    .split('&&')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Tokenise a sub-command into { bin, args }, substituting the `<files>` placeholder. */
function tokenize(subCmd: string, filesSubstitution: string): { bin: string; args: string[] } {
  const parts = subCmd
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => (p === '<files>' ? filesSubstitution : p));
  return { bin: parts[0] ?? '', args: parts.slice(1) };
}

/**
 * Repo-relative paths of every file `git ls-files` reports for `repoRoot`.
 *
 * TRACKEDNESS, NOT A DIRECTORY WALK. The two resolvers below used to walk the
 * filesystem skipping only `node_modules`/`.git`. That walk resolves to BUILD
 * OUTPUT and to foreign checkouts, because both are gitignored rather than named:
 *
 *   - `packages/getff/` holds the assembled distribution payload
 *     (scripts/build-getff-dist.sh, gitignored per packages/getff/.gitignore).
 *     `readdirSync('packages')` yields `getff` before every `preset-*`, so after
 *     one `bash scripts/build-getff-dist.sh` the first match for
 *     `eslint.config.react.mjs` is `packages/getff/packages/preset-next-15-canonical/
 *     templates/…` and for `run-local-ci-sweep.sh` it is `packages/getff/scripts/…`
 *     — neither is the live file, and resolve-and-run EXECUTES what it resolves,
 *     so a rule whose real backing script was deleted still reports GREEN off the
 *     stale copy (measured 2026-09-14).
 *   - the config walk was rooted at the REPO ROOT and so descended into
 *     `.claude/worktrees/*` — 161 full repo copies on the operator's main clone —
 *     letting another branch's config decide this repo's verdict, at an unbounded
 *     traversal cost.
 *
 * An untracked path is build output or a foreign checkout by construction, so
 * trackedness is the predicate, not any path pattern. Same reasoning and same
 * primitive as principles/34-claudemd-excludes-liveness.test.ts:66-73 (`git ls-files`
 * is "the honest population for the repo file tree") and scripts/build-getff-dist.sh:19-21
 * ("a directory walk would ship whatever is lying in the working tree").
 *
 * Fail-closed: a repoRoot git cannot enumerate yields an EMPTY population, so a
 * resolver finds nothing and the rule SKIPs or FAILs with a visible reason — it
 * never falls back to the walk this function exists to replace.
 *
 * Not memoised: `git ls-files -z` is ~30 ms on this repo against the multi-second
 * subprocess pairs each rule already runs, and a cache would go stale mid-run.
 */
function trackedPaths(repoRoot: string): string[] {
  let out: string;
  try {
    out = execFileSync('git', ['ls-files', '-z'], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return [];
  }
  return out.split('\0').filter((p) => p.length > 0);
}

/** A basename lookup that either resolved uniquely or found more than one candidate. */
type BasenameResolution =
  | { kind: 'found'; path: string }
  | { kind: 'none' }
  | { kind: 'ambiguous'; candidates: string[] };

/**
 * Resolve `name` against the TRACKED files under `<repoRoot>/packages/`.
 *
 * AMBIGUITY IS REPORTED, NOT PICKED. The previous walker returned the first match
 * in `readdirSync` order, so two same-named files resolved arbitrarily by directory
 * order. That is live in this repo: `eslint.config.react.mjs` is tracked under BOTH
 * `packages/preset-next-15-canonical/templates/` and `packages/preset-react-spa/templates/`.
 * Silently picking one would prove liveness of a script the rule does not name — a
 * false GREEN — so the caller turns this into a `fail` naming every candidate.
 * A path-suffix preference cannot break the tie here: manifest `check.script`
 * values are CONSUMER-relative (`scripts/audit-r4.ts`) while the source lives at
 * `packages/core/probes/audit-r4.ts`, so only the basename is comparable.
 */
function resolveTrackedBasename(repoRoot: string, name: string): BasenameResolution {
  const candidates = trackedPaths(repoRoot)
    .filter((p) => p.startsWith('packages/') && basename(p) === name)
    .sort();
  if (candidates.length === 0) return { kind: 'none' };
  if (candidates.length > 1) return { kind: 'ambiguous', candidates };
  return { kind: 'found', path: join(repoRoot, candidates[0]) };
}

// ── Mode runners ─────────────────────────────────────────────────────────────

/**
 * run-and-assert: prove the rule's check is a LIVE discriminator — clean-pass +
 * violating-fail PAIR (operator rework 2026-06-13, MAJOR fix).
 *
 *   1. Run each (possibly compound) sub-command against the CLEAN pre-fixture
 *      state (an empty temp dir). A sub-command is "functional" only if it exits
 *      0 here. One that exits non-zero on the clean state is non-functional in
 *      this env (crash / missing config / MODULE_NOT_FOUND) → excluded.
 *   2. If NO sub-command is functional → SKIP — distinguishing "no binary
 *      available" from "ran but did not pass clean". NEVER pass, NEVER fail.
 *   3. Set up the violating fixture state, re-run only the functional subs;
 *      pass iff ≥1 of them now exits non-zero (good→clean, bad→trips).
 *
 * This eliminates the crash-masquerade false-pass: a check that errors regardless
 * of state (e.g. eslint with no flat-config, a script with a missing dependency)
 * fails the clean-pass gate and is SKIPPED, not reported as a caught violation.
 */
function runAndAssert(
  ruleId: string,
  rule: CmdScriptRule,
  run: typeof runCheck,
): RuleLivenessResult {
  const fixture = rule.fixture;
  if (!fixture || !fixture['setup-script']) {
    return { status: 'no-data', mode: 'run-and-assert', reason: 'missing fixture.setup-script' };
  }
  const raw = rule.check.command ?? rule.check.script ?? '';
  const runnable = extractRunnable(raw);
  if (!runnable) {
    return { status: 'no-data', mode: 'run-and-assert', reason: 'check has no runnable command' };
  }

  const cleanTmp = mkdtempSync(join(tmpdir(), `cmdliveness-${ruleId}-clean-`));
  const violTmp = mkdtempSync(join(tmpdir(), `cmdliveness-${ruleId}-violating-`));
  const cleanCwd = fixture.cwd ?? cleanTmp;
  const violCwd = fixture.cwd ?? violTmp;
  try {
    const subs = splitCompound(runnable);
    const notes: string[] = [];
    let anyNonFunctional = false;

    // 1. CLEAN (pre-fixture) pass — keep only sub-commands that exit 0 here.
    const functionalSubs: { bin: string; args: string[]; sub: string }[] = [];
    for (const sub of subs) {
      const { bin, args } = tokenize(sub, '.');
      if (!bin) continue;
      const cleanR = run(bin, args, { cwd: cleanCwd });
      if (cleanR.notFound) {
        notes.push(`'${bin}' not available — sub-command '${sub}' skipped`);
        continue;
      }
      if (cleanR.exitCode !== 0) {
        anyNonFunctional = true;
        notes.push(`'${bin}' exited ${cleanR.exitCode} on the clean state — sub-command '${sub}' skipped`);
        continue;
      }
      functionalSubs.push({ bin, args, sub });
    }

    if (functionalSubs.length === 0) {
      const reason = anyNonFunctional
        ? `check non-functional in env (clean state did not pass): ${notes.join('; ')}`
        : `no check binary available (${notes.join('; ')})`;
      return { status: 'skipped', mode: 'run-and-assert', reason };
    }

    // 2. Set up the violating fixture state, then re-run only the functional subs.
    const setup = run('sh', ['-c', fixture['setup-script']], { cwd: violCwd });
    if (setup.exitCode !== 0) {
      return {
        status: 'fail',
        mode: 'run-and-assert',
        failures: [`fixture.setup-script exited ${setup.exitCode}: ${setup.stderr.trim() || setup.stdout.trim()}`],
      };
    }

    let anyCaught = false;
    for (const { bin, args } of functionalSubs) {
      const r = run(bin, args, { cwd: violCwd });
      if (r.exitCode !== 0) anyCaught = true;
    }

    if (!anyCaught) {
      return {
        status: 'fail',
        mode: 'run-and-assert',
        failures: [
          `the check passed clean but did NOT exit non-zero on the violating fixture — the guard does not catch its own violation`,
        ],
      };
    }
    return { status: 'pass', mode: 'run-and-assert', reason: notes.join('; ') || undefined };
  } finally {
    if (fixture['cleanup-script']) run('sh', ['-c', fixture['cleanup-script']], { cwd: violCwd });
    rmSync(cleanTmp, { recursive: true, force: true });
    rmSync(violTmp, { recursive: true, force: true });
  }
}

/**
 * resolve-and-run: the rule's check.script path is consumer-relative / dangling;
 * resolve it by basename to its source-repo location, then prove it is a LIVE
 * discriminator via the same clean-pass + violating-fail PAIR as run-and-assert
 * (operator rework 2026-06-13, MAJOR fix):
 *
 *   1. Run the resolved script against the CLEAN pre-fixture state. If the
 *      interpreter is missing → SKIP. If the script exits non-zero on the clean
 *      state (e.g. it imports ts-morph and crashes with MODULE_NOT_FOUND BEFORE
 *      evaluating any fixture) → SKIP "check non-functional in env" — NEVER pass.
 *   2. Set up the violating fixture state, run the script again; pass iff it now
 *      exits non-zero (good→clean, bad→trips).
 *
 * This is the exact crash-masquerade the rework named: audit-r4.ts reporting
 * "pass" against BOTH clean and violating states when ts-morph is absent.
 */
function resolveAndRun(
  ruleId: string,
  rule: CmdScriptRule,
  run: typeof runCheck,
  repoRoot: string,
): RuleLivenessResult {
  const fixture = rule.fixture;
  if (!fixture || !fixture['setup-script']) {
    return { status: 'no-data', mode: 'resolve-and-run', reason: 'missing fixture.setup-script' };
  }
  // auto-skip-if-missing: the rule's check applies only to a consumer project
  // carrying its required package (e.g. R17 → storybook). The framework repo has
  // no such consumer context, so SKIP visibly rather than run a no-op probe.
  if (rule['auto-skip-if-missing'] && rule['requires-package']) {
    const pkgs = Array.isArray(rule['requires-package'])
      ? rule['requires-package'].join(', ')
      : rule['requires-package'];
    return {
      status: 'skipped',
      mode: 'resolve-and-run',
      reason: `auto-skip-if-missing: required package(s) [${pkgs}] absent in this environment — the check applies only to a consumer project that carries them`,
    };
  }
  const rawPath = extractRunnable(rule.check.script ?? rule.check.command ?? '');
  const scriptName = basename(rawPath.split(/\s+/)[0] ?? '');
  if (!scriptName) {
    return { status: 'no-data', mode: 'resolve-and-run', reason: 'check.script has no path' };
  }
  const resolution = resolveTrackedBasename(repoRoot, scriptName);
  if (resolution.kind === 'none') {
    return {
      status: 'skipped',
      mode: 'resolve-and-run',
      reason: `script '${scriptName}' not found among tracked files under packages/ (dangling/consumer-relative) — install to enable`,
    };
  }
  if (resolution.kind === 'ambiguous') {
    return {
      status: 'fail',
      mode: 'resolve-and-run',
      failures: [
        `script '${scriptName}' is ambiguous — ${resolution.candidates.length} tracked files under packages/ share that basename [${resolution.candidates.join(', ')}]; running one of them would prove liveness of a script the rule does not name. Disambiguate by giving the rule's check.script a unique basename.`,
      ],
    };
  }
  const resolved = resolution.path;

  const interp = scriptName.endsWith('.ts')
    ? { bin: 'node', args: ['--experimental-strip-types', resolved] }
    : { bin: 'bash', args: [resolved] };

  const cleanTmp = mkdtempSync(join(tmpdir(), `cmdliveness-${ruleId}-clean-`));
  const violTmp = mkdtempSync(join(tmpdir(), `cmdliveness-${ruleId}-violating-`));
  const cleanCwd = fixture.cwd ?? cleanTmp;
  const violCwd = fixture.cwd ?? violTmp;
  try {
    // 1. CLEAN (pre-fixture) pass — the resolved script must succeed on a clean tree.
    const cleanR = run(interp.bin, interp.args, { cwd: cleanCwd });
    if (cleanR.notFound) {
      return {
        status: 'skipped',
        mode: 'resolve-and-run',
        reason: `interpreter '${interp.bin}' not available — install to enable`,
      };
    }
    if (cleanR.exitCode !== 0) {
      return {
        status: 'skipped',
        mode: 'resolve-and-run',
        reason: `check non-functional in env (clean state did not pass): resolved script '${scriptName}' exited ${cleanR.exitCode} before evaluating the fixture (e.g. a missing dependency such as ts-morph)`,
      };
    }

    // 2. Set up the violating fixture state, run the script again.
    const setup = run('sh', ['-c', fixture['setup-script']], { cwd: violCwd });
    if (setup.exitCode !== 0) {
      return {
        status: 'fail',
        mode: 'resolve-and-run',
        failures: [`fixture.setup-script exited ${setup.exitCode}: ${setup.stderr.trim() || setup.stdout.trim()}`],
      };
    }
    const r = run(interp.bin, interp.args, { cwd: violCwd });
    if (r.exitCode === 0) {
      return {
        status: 'fail',
        mode: 'resolve-and-run',
        failures: [`resolved script '${scriptName}' passed clean but exited 0 on the violating fixture — the guard does not catch its violation`],
      };
    }
    return { status: 'pass', mode: 'resolve-and-run' };
  } finally {
    if (fixture['cleanup-script']) run('sh', ['-c', fixture['cleanup-script']], { cwd: violCwd });
    rmSync(cleanTmp, { recursive: true, force: true });
    rmSync(violTmp, { recursive: true, force: true });
  }
}

/** Extract `name.yml (inner)` pairs from a check command's prose. */
export function parseWorkflowRefs(raw: string): { file: string; tokens: string[] }[] {
  const refs: { file: string; tokens: string[] }[] = [];
  const re = /([\w.-]+\.ya?ml)(?:\s*\(([^)]*)\))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const inner = m[2] ?? '';
    const tokens = inner
      .split(/[^A-Za-z0-9]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 4);
    refs.push({ file: m[1], tokens });
  }
  return refs;
}

/**
 * workflow-exists: assert each named workflow file exists under
 * .github/workflows/ AND references the expected jobs (NOT a temp-dir FS state —
 * operator decision). SKIP when the rule names no concrete workflow file (a
 * consumer-side CI rule whose jobs live only in prose, e.g. IR1/IR2).
 */
function workflowExists(rule: CmdScriptRule, repoRoot: string): RuleLivenessResult {
  const raw = rule.check.command ?? rule.check.script ?? '';
  const refs = parseWorkflowRefs(raw);
  if (refs.length === 0) {
    return {
      status: 'skipped',
      mode: 'workflow-exists',
      reason: 'no concrete workflow filename in check — consumer-side CI rule (jobs referenced in prose); not assertable in the framework repo',
    };
  }
  const wfDir = join(repoRoot, '.github', 'workflows');
  const failures: string[] = [];
  for (const ref of refs) {
    const path = join(wfDir, ref.file);
    if (!existsSync(path)) {
      if (rule['auto-skip-if-missing']) continue;
      failures.push(`workflow '${ref.file}' is missing from .github/workflows/`);
      continue;
    }
    const content = readFileSync(path, 'utf8');
    if (!/\bjobs:/.test(content)) {
      failures.push(`workflow '${ref.file}' defines no jobs: block`);
      continue;
    }
    if (ref.tokens.length > 0 && !ref.tokens.some((t) => content.includes(t))) {
      failures.push(`workflow '${ref.file}' references none of the required jobs [${ref.tokens.join(', ')}]`);
    }
  }
  if (failures.length > 0) return { status: 'fail', mode: 'workflow-exists', failures };
  return { status: 'pass', mode: 'workflow-exists' };
}

/**
 * config-presence: the rule's command isn't locally runnable (e.g. R3's consumer
 * `npm run arch:check`); assert the configuration the rule's intent depends on
 * exists in the repo. Today: an architectural dependency-cruiser config.
 */
function configPresence(rule: CmdScriptRule, repoRoot: string): RuleLivenessResult {
  const candidates = findConfigs(repoRoot, /^(\.?dependency-cruiser)\.(c?js|json|ts)$/);
  if (candidates.length === 0) {
    return {
      status: 'fail',
      mode: 'config-presence',
      failures: ['no tracked dependency-cruiser architectural config found in the repo — the arch boundary check has nothing to enforce'],
    };
  }
  return { status: 'pass', mode: 'config-presence', reason: `arch config present: ${candidates[0]}` };
}

/**
 * Tracked config files whose basename matches `pattern`, repo-relative and sorted.
 *
 * Tracked-only for the reason given on `trackedPaths` — the walk this replaced was
 * rooted at the repo root and counted both the gitignored `packages/getff/` payload
 * copy and every nested `.claude/worktrees/*` checkout, so a deleted config still
 * read as present. Repo-relative because that is what makes the reported path
 * ("arch config present: …") unambiguous about WHICH tree answered.
 */
function findConfigs(repoRoot: string, pattern: RegExp): string[] {
  return trackedPaths(repoRoot)
    .filter((p) => pattern.test(basename(p)))
    .sort();
}

/** Run the liveness check for a single cmd/script manifest rule. */
export function runRuleLiveness(
  ruleId: string,
  rule: CmdScriptRule,
  opts: RunOptions = {},
): RuleLivenessResult {
  const run = opts.runCheckFn ?? runCheck;
  const repoRoot = opts.repoRoot ?? DEFAULT_REPO_ROOT;
  const mode = resolveMode(rule);
  if (mode === null) return { status: 'n/a', mode: null };

  switch (mode) {
    case 'exempt':
      return { status: 'exempt', mode, reason: EXEMPT_RULES[ruleId] ?? 'exempt (no runnable form)' };
    case 'run-and-assert':
      return runAndAssert(ruleId, rule, run);
    case 'resolve-and-run':
      return resolveAndRun(ruleId, rule, run, repoRoot);
    case 'workflow-exists':
      return workflowExists(rule, repoRoot);
    case 'config-presence':
      return configPresence(rule, repoRoot);
  }
}

export interface CmdScriptLivenessFailure {
  ruleId: string;
  mode: LivenessMode | null;
  failures: string[];
}

export interface CmdScriptLivenessReport {
  failures: CmdScriptLivenessFailure[];
  passed: string[];
  skipped: string[];
  exempt: string[];
  noData: string[];
}

/** Get command/script rule IDs that changed between the base and current manifest. */
export function getChangedCmdScriptRuleIds(
  baseManifestJson: string | null,
  currentManifestJson: string,
): string[] {
  const current = JSON.parse(currentManifestJson) as Record<string, CmdScriptRule>;
  const isCmdScript = (r: CmdScriptRule): boolean =>
    r.check.type === 'command' || r.check.type === 'script';
  if (!baseManifestJson) {
    return Object.keys(current).filter((k) => isCmdScript(current[k]));
  }
  let base: Record<string, CmdScriptRule>;
  try {
    base = JSON.parse(baseManifestJson) as Record<string, CmdScriptRule>;
  } catch {
    return Object.keys(current).filter((k) => isCmdScript(current[k]));
  }
  const changed: string[] = [];
  for (const [id, rule] of Object.entries(current)) {
    if (!isCmdScript(rule)) continue;
    const baseRule = base[id];
    if (!baseRule || JSON.stringify(baseRule) !== JSON.stringify(rule)) changed.push(id);
  }
  return changed;
}

/** Run the liveness check over the given rule IDs against the provided manifest. Pure. */
export function runCmdScriptLivenessCheck(
  ruleIds: string[],
  manifest: Record<string, CmdScriptRule>,
  opts: RunOptions = {},
): CmdScriptLivenessReport {
  const report: CmdScriptLivenessReport = {
    failures: [],
    passed: [],
    skipped: [],
    exempt: [],
    noData: [],
  };
  for (const id of ruleIds) {
    const rule = manifest[id];
    if (!rule) continue;
    const result = runRuleLiveness(id, rule, opts);
    switch (result.status) {
      case 'pass':
        report.passed.push(id);
        break;
      case 'fail':
        report.failures.push({ ruleId: id, mode: result.mode, failures: result.failures ?? [] });
        break;
      case 'skipped':
        report.skipped.push(`${id} [${result.mode}]: ${result.reason ?? 'unavailable'}`);
        break;
      case 'exempt':
        report.exempt.push(`${id}: ${result.reason ?? 'exempt'}`);
        break;
      case 'no-data':
        report.noData.push(`${id} [${result.mode}]: ${result.reason ?? 'no data'}`);
        break;
      case 'n/a':
        break;
    }
  }
  return report;
}

/**
 * Gate function for pre-push: loads the manifest, determines changed cmd/script
 * rules vs the base, runs only those. Reads the base manifest via `git show`.
 */
export function runCmdScriptLivenessGate(base: string, opts: RunOptions = {}): CmdScriptLivenessReport {
  const repoRoot = opts.repoRoot ?? DEFAULT_REPO_ROOT;
  const manifestPath = resolve(repoRoot, MANIFEST_REL);
  const currentJson = readFileSync(manifestPath, 'utf8');
  const run = opts.runCheckFn ?? runCheck;
  const baseResult = run('git', ['show', `${base}:${MANIFEST_REL}`], { cwd: repoRoot });
  const baseJson = baseResult.exitCode === 0 ? baseResult.stdout : null;
  const changedIds = getChangedCmdScriptRuleIds(baseJson, currentJson);
  if (changedIds.length === 0) {
    return { failures: [], passed: [], skipped: [], exempt: [], noData: [] };
  }
  const manifest = JSON.parse(currentJson) as Record<string, CmdScriptRule>;
  return runCmdScriptLivenessCheck(changedIds, manifest, opts);
}

export type { CheckResult };
