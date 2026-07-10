/**
 * pre-push.ts — TS-core pre-push orchestrator (Wave 10.1 / 10.2).
 *
 * Invoked by the 10-line `.husky/pre-push` dispatcher via
 * `node --import tsx/esm packages/core/hooks/pre-push.ts`. Replaces the bash
 * body of the former 476-line hook. Every "pure delegation" section (§3.1
 * OWN-BUILD classification) runs through the single tested `runCheck()` helper
 * (utils/run-check.ts), which is the Aider-derived abstraction adopted in
 * research patch §4.8.X.1 — turning previously un-unit-tested `execSync`
 * shell-outs into thin, individually-tested call sites (closes C3 for the
 * delegation sections).
 *
 * Both trailer checks are now TS-native: §7 Prior-art → `checks/prior-art.ts`
 * (Wave 10.2), §1.7 discipline trailer → `checks/s17.ts` (Wave 10.3), both over
 * `utils/git.ts`. The former bash shim (`legacy-trailer-checks.sh`) is deleted;
 * no bash trailer logic remains.
 *
 * Behaviour parity with the former bash hook is byte-faithful for the delegation
 * sections; documented deviations:
 *   - actionlint is invoked with an explicit, fs-resolved `.github/workflows/*.yml`
 *     list (vs shell glob) — equivalent set, and empty-dir is skipped rather than
 *     passing a literal unmatched glob.
 *   - section output is captured and re-emitted after each check rather than
 *     streamed live (acceptable for sub-second checks).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCheck, type CheckResult } from './utils/run-check.ts';
import { runPriorArtCheck, loadSsotIds } from './checks/prior-art.ts';
import { runS17Check } from './checks/s17.ts';
import { checkUnpinnedToolInstalls } from './checks/unpinned-tool-install.ts';
// NOTE: checks/guard-liveness.ts is intentionally NOT imported statically — see
// guardLivenessSection. Its import chain (eslint → @typescript-eslint/parser →
// core+preset plugins → @typescript-eslint/utils) only resolves after a
// root-level workspace install, and this orchestrator must stay loadable in
// ESLint-stack-free topologies (CI principles job installs packages/core only).
import {
  getCommits,
  getChangedFiles,
  upstreamExists,
  resolveDefaultBase,
  realGit,
  parsePushRefs,
  commitsNotOnRemotes,
  Z40,
} from './utils/git.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/core/hooks → repo root
const REPO_ROOT = resolve(HERE, '../../..');
const CORE = resolve(REPO_ROOT, 'packages/core');

const run = (cmd: string, args: readonly string[] = []): CheckResult =>
  runCheck(cmd, args, { cwd: REPO_ROOT });

/**
 * The empty-tree object SHA — a tree-ish that exists in every repo. Used as the
 * diff base for a root push (a brand-new branch whose oldest new commit has no
 * parent) so `git diff <EMPTY_TREE>..HEAD` enumerates every file.
 */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

/** Read git's pre-push stdin (the ref lines), or '' when none is piped. */
function readPushStdin(): string {
  // Only read when fd 0 is NOT a tty — git pipes the ref lines on a push and
  // closes the pipe (EOF), but an interactive `node pre-push.ts` would block on
  // a tty read. Defensive: any read error degrades to "no stdin".
  if (process.stdin.isTTY) return '';
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

/**
 * The base the trailer checks diff against, resolved without guessing a trunk
 * name. Replaces the former hard-coded `origin/staging` default (which silently
 * no-op'd on any consumer repo lacking a `staging` branch — see the
 * hook-base-ref-detection research patch). Precedence:
 *
 *   1. `PREPUSH_UPSTREAM_REF` env — the CI backstop's full-PR base
 *      (`origin/${github.base_ref}`); also a manual local override.
 *   2. git pre-push **stdin** `remote_sha` — the canonical, trunk-agnostic
 *      signal (what HEAD is actually being pushed against). For a new branch
 *      (`remote_sha` == {@link Z40}) the checked set is "commits not on any
 *      remote" (ADAPT of pre-commit's stdin handling).
 *   3. the derived default branch (origin/HEAD → origin/staging|main|master),
 *      *only if one exists* (GH #568, via {@link resolveDefaultBase}); else a
 *      visible warning + skip.
 *
 * Returns `{ base: null, commits: null }` when nothing resolves — callers emit a
 * VISIBLE warning and skip, never a silent pass (research-patch finding F2).
 */
interface ResolvedBase {
  /** Tree-ish for `<base>..<head>` changed-file diffs; null when unresolvable. */
  base: string | null;
  /**
   * The diff/range endpoint — what the push range runs *to*. The pushed ref's
   * `local_sha` on a real `git push` (so the range follows the branch being
   * pushed, even when the checkout's HEAD is on a different branch — the
   * 2026-06-17 cross-checkout incident); `HEAD` for a manual run / CI backstop
   * where the checkout IS the thing being checked.
   */
  head: string;
  /** Explicit commit list (new-branch Z40 case); null = derive from `base..head`. */
  commits: string[] | null;
  source: 'env' | 'stdin' | 'stdin-new-branch' | 'default' | 'unresolved';
}

function resolveBase(): ResolvedBase {
  const env = process.env['PREPUSH_UPSTREAM_REF'];
  // CI backstop / manual override: HEAD is the thing being checked against the
  // override base (the CI job checks out the PR head), so the endpoint is HEAD.
  if (env) return { base: env, commits: null, head: 'HEAD', source: 'env' };

  const refs = parsePushRefs(readPushStdin());
  if (refs.length > 0) {
    const r = refs[0];
    // `^{commit}` peels to a commit object — parity with the fallback's check,
    // and rejects a tag sha (which would not be a valid `..head` diff base).
    if (r.remoteSha !== Z40 && upstreamExists(`${r.remoteSha}^{commit}`)) {
      // Range endpoint is the PUSHED ref's local_sha, NOT HEAD: pushing `feat`
      // from a checkout on `staging` must validate feat's commits, not staging's.
      return {
        base: r.remoteSha,
        commits: null,
        head: r.localSha,
        source: 'stdin',
      };
    }
    // New branch (Z40) or an unknown remote sha → the commits this push adds.
    const newCommits = commitsNotOnRemotes(r.localSha);
    const oldest = newCommits[newCommits.length - 1];
    const base =
      oldest && upstreamExists(`${oldest}^`) ? `${oldest}^` : EMPTY_TREE;
    // `commits` is explicit here; `head` still set to local_sha so the §6/§8
    // changed-file diffs (which derive from `base..head`) follow the pushed ref.
    return {
      base,
      commits: newCommits,
      head: r.localSha,
      source: 'stdin-new-branch',
    };
  }

  // No env, no stdin (a manual `node pre-push.ts` run): derive the consumer's REAL
  // default branch instead of hard-coding origin/staging (GH #568) — announce via
  // source:'default', never silently skip. Endpoint is HEAD (no pushed ref to follow).
  const def = resolveDefaultBase();
  if (def) {
    return { base: def, commits: null, head: 'HEAD', source: 'default' };
  }
  return { base: null, commits: null, head: 'HEAD', source: 'unresolved' };
}

/** Emit a visible (non-silent) warning that a section is being skipped. */
function warnSkip(label: string, why: string): void {
  process.stdout.write(
    `⚠ pre-push ${label}: could not determine a base ref (${why}) — skipping this check.\n` +
      '  Not a silent pass: set PREPUSH_UPSTREAM_REF, or push so git supplies the base on stdin.\n',
  );
}

/**
 * The commits a section must check, or null (already warned) when the base is
 * unresolvable / missing. New-branch pushes carry an explicit commit list; every
 * other case derives `<base>..HEAD`.
 */
function commitsToCheck(rb: ResolvedBase, label: string): string[] | null {
  if (rb.commits !== null) return rb.commits;
  if (rb.base === null) {
    warnSkip(label, 'no PREPUSH_UPSTREAM_REF, no git stdin, no default branch');
    return null;
  }
  if (!upstreamExists(rb.base)) {
    warnSkip(label, `base ref '${rb.base}' not found`);
    return null;
  }
  return getCommits(rb.base, rb.head);
}

/** Re-emit a captured result's output to the operator. */
function emit(r: CheckResult): void {
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
}

/** Print message (+ optional captured output) and abort the push. */
function die(msg: string, r?: CheckResult): never {
  process.stderr.write(`${msg}\n`);
  if (r) emit(r);
  process.exit(1);
}

function workflowYmlFiles(): string[] {
  const dir = resolve(REPO_ROOT, '.github/workflows');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yml'))
    .map((f) => `.github/workflows/${f}`);
}

/**
 * A required external binary check: missing → install hint + fail.
 * `failHint` (optional) is appended to the abort output when the tool ran but
 * reported problems (exitCode !== 0) — used to hand the operator a concrete
 * remediation path. Callers that omit it keep the original behaviour verbatim.
 * `onMissing` (default `'die'`) controls the TOOL-ABSENCE axis only (#923 follow-up):
 *   - `'die'`      — fail-closed on `notFound` (framework repo; ci-tool-pinning).
 *   - `'warn-skip'`— consumer layout: a missing OPTIONAL workflow-security scanner
 *                    must DEGRADE loudly and continue, never DoS the consumer's push.
 * A tool that IS present but reports findings (exitCode !== 0) still dies in BOTH
 * modes — real findings are real; only absence is downgraded on a consumer.
 */
function requireTool(
  cmd: string,
  args: readonly string[],
  installHint: string,
  failHint?: string,
  onMissing: 'die' | 'warn-skip' = 'die',
): void {
  const r = run(cmd, args);
  if (r.notFound) {
    if (onMissing === 'warn-skip') {
      // stdout (not stderr) to match the closest tool-absence-skip precedent — the
      // lychee "not found → skip" path below (§8) writes its degradation notice to
      // stdout. Keeps the consumer-degrade convention consistent across sections.
      process.stdout.write(
        `⚠ DEGRADED: ${cmd} not found — workflow security lint SKIPPED\n${installHint}\n`,
      );
      return;
    }
    die(`❌ ${cmd} not found in PATH.\n${installHint}`);
  }
  if (r.exitCode !== 0) {
    if (failHint) {
      // Emit the tool's findings first, then the remediation hint, then abort.
      emit(r);
      die(`\n${failHint}`);
    }
    die(`❌ ${cmd} reported problems:`, r);
  }
  emit(r);
}

/**
 * §7 Prior-art trailer check. Extracted so it can run in isolation (PREPUSH_ONLY)
 * — the anti-tautology end-to-end test exercises only this section and must not
 * depend on the other sections' tools/deps.
 */
/** Path (repo-relative) of the Prior-art SSOT register, read per-commit below. */
const SSOT_REL = 'docs/meta-factory/prior-art-evaluations.md';

/**
 * The SSOT register's entry id-set **as it existed in `sha`'s tree**, for the C1
 * broken-citation arm. Reads `git show <sha>:<SSOT_REL>` (via the GitProvider) so
 * a citation is checked against the same commit it lives in — not the working
 * tree of whatever branch is checked out, which may be dirty or a different
 * branch entirely (the 2026-06-17 incident: a commit citing #124 was flagged
 * broken because the working-tree SSOT had #124 removed). SSOT absent/unreadable
 * at that commit → undefined → existence check is a graceful no-op for it.
 */
function ssotIdsAt(sha: string): ReadonlySet<number> | undefined {
  const content = realGit.fileContent(sha, SSOT_REL);
  return content === null ? undefined : loadSsotIds(content);
}

function priorArtSection(rb: ResolvedBase): void {
  const commits = commitsToCheck(rb, '§7');
  if (commits === null) return;
  const substanceWarnOnly =
    (process.env['PA_SUBSTANCE_WARN_ONLY'] ?? 'true') !== 'false';
  const report = runPriorArtCheck(commits, realGit, undefined, ssotIdsAt);

  if (report.failures.length > 0) {
    process.stdout.write(
      '\n❌ Prior-art trailer missing or invalid on capability commit(s):\n',
    );
    for (const f of report.failures) {
      process.stdout.write(`  ${f.sha}  reason: ${f.reason}; ${f.message}\n`);
    }
    process.stdout.write(
      '\nFix: amend the commit body to include a `Prior-art:` line per CONTRIBUTING.md.\n' +
        'Examples:\n' +
        '  Prior-art: prior-art-evaluations.md#1 (Autogrep, verdict DEFER — different domain).\n' +
        '  Prior-art: skipped — refactor only, no new capability\n\n' +
        'Rules: ≥20 chars after "Prior-art:" (or after "skipped — "); placeholder\n' +
        'rationales (TODO / later / n/a / tbd / fixme / placeholder) are rejected.\n\n',
    );
    process.exit(1);
  }

  if (report.brokenCitations.length > 0) {
    process.stdout.write(
      '\n❌ Prior-art trailer cites a non-existent SSOT entry (C1 existence check):\n',
    );
    for (const f of report.brokenCitations) {
      process.stdout.write(`  ${f.sha}  reason: ${f.reason}; ${f.message}\n`);
    }
    process.stdout.write(
      '\nFix: cite an entry that exists in docs/meta-factory/prior-art-evaluations.md,\n' +
        'or add the entry to the SSOT in the same commit (per CLAUDE.md build-vs-reuse).\n' +
        'Verify: grep -nE "^\\| *<N> *\\|" docs/meta-factory/prior-art-evaluations.md\n\n',
    );
    process.exit(1);
  }

  if (report.substanceFailures.length > 0) {
    if (substanceWarnOnly) {
      process.stdout.write(
        '\n⚠ Prior-art: escape-hatch on capability commit (substance arm, Wave 8.4):\n',
      );
      for (const f of report.substanceFailures) {
        process.stdout.write(`  ${f.sha}  reason: ${f.reason}; ${f.message}\n`);
      }
      process.stdout.write(
        '\nCalibration window: warn-only through 2026-06-10.\n' +
          'Fix: replace `Prior-art: skipped — …` with `Prior-art: prior-art-evaluations.md#N (verdict X — rationale)`.\n\n',
      );
    } else {
      process.stdout.write(
        '\n❌ Prior-art: escape-hatch on capability commit:\n',
      );
      for (const f of report.substanceFailures) {
        process.stdout.write(`  ${f.sha}  reason: ${f.reason}; ${f.message}\n`);
      }
      process.stdout.write(
        '\nSet PA_SUBSTANCE_WARN_ONLY=true to downgrade locally (calibration window expired).\n\n',
      );
      process.exit(1);
    }
  }
}

/**
 * §1.7 discipline-trailer check. TS-native since Wave 10.3 (ported from the
 * deleted legacy-trailer-checks.sh s17_* functions). Both arms enforce
 * (blocking) by default since 2026-05-21 (flipped early per maintainer
 * directive; was warn-only during the D1 calibration window). Set
 * S17_WARN_ONLY=true / S17_SUBSTANCE_WARN_ONLY=true for a local opt-in downgrade.
 */
function s17Section(rb: ResolvedBase): void {
  const commits = commitsToCheck(rb, '§1.7');
  if (commits === null) return;
  const warnOnly = (process.env['S17_WARN_ONLY'] ?? 'false') !== 'false';
  const substanceWarnOnly =
    (process.env['S17_SUBSTANCE_WARN_ONLY'] ?? 'false') !== 'false';
  const report = runS17Check(commits, realGit);

  if (report.failures.length > 0) {
    if (warnOnly) {
      process.stdout.write(
        '\n⚠ §1.7 trailer missing or invalid on rule-introducing commit(s):\n',
      );
      for (const f of report.failures)
        process.stdout.write(`  ${f.sha}  ${f.message}\n`);
      process.stdout.write(
        '\nLocal downgrade active (S17_WARN_ONLY=true); the default is enforcing.\n' +
          'Fix: add `§1.7: forward-check applied — …; backward-check sweep — …` to commit body.\n\n',
      );
    } else {
      process.stdout.write(
        '\n❌ §1.7 trailer missing or invalid on rule-introducing commit(s):\n',
      );
      for (const f of report.failures)
        process.stdout.write(`  ${f.sha}  ${f.message}\n`);
      process.stdout.write(
        '\nFix: add `§1.7: forward-check applied — …; backward-check sweep — …` to commit body.\n' +
          'Bootstrap exemption: `§1.7 Bootstrap: <reason>` (≥20 chars rationale).\n\n',
      );
      process.exit(1);
    }
  }

  if (report.substanceFailures.length > 0) {
    if (substanceWarnOnly) {
      process.stdout.write(
        '\n⚠ §1.7 trailer lacks file:line citation on rule-introducing commit(s) (substance arm — Wave 8.3):\n',
      );
      for (const f of report.substanceFailures)
        process.stdout.write(`  ${f.sha}  ${f.message}\n`);
      process.stdout.write(
        '\nLocal downgrade active (S17_SUBSTANCE_WARN_ONLY=true); the default is enforcing.\n' +
          'Fix: include ≥1 file:line citation, e.g. `packages/core/principles/02.test.ts:82`.\n\n',
      );
    } else {
      process.stdout.write(
        '\n❌ §1.7 trailer lacks file:line citation on rule-introducing commit(s) (substance arm — Wave 8.3):\n',
      );
      for (const f of report.substanceFailures)
        process.stdout.write(`  ${f.sha}  ${f.message}\n`);
      process.stdout.write(
        '\nFix: include ≥1 file:line citation, e.g. `packages/core/principles/02.test.ts:82`.\n' +
          'Bootstrap exemption: `§1.7 Bootstrap: <reason>` (≥20 chars rationale).\n\n',
      );
      process.exit(1);
    }
  }
}

/**
 * Guard-liveness section: change-scoped ESLint roundtrip gate.
 * For each ESLint manifest rule changed in this push, proves that every
 * negative-test.input entry trips the rule and examples.good stays clean.
 * Lives beside §7 (prior-art) and §1.7 (s17) in the base-scoped gate family.
 */
async function guardLivenessSection(rb: ResolvedBase): Promise<void> {
  if (rb.base === null) {
    warnSkip(
      'guard-liveness',
      'no resolvable base for change-scoped liveness diff',
    );
    return;
  }
  // Lazy-load the gate: keeps PREPUSH_ONLY=prior-art / =s17 seams and the CI
  // principles job (packages/core-only install) free of the ESLint stack. A
  // resolution failure here is a loud die, never a silent pass — the gate only
  // loads on the path where it must actually run.
  let gate: typeof import('./checks/guard-liveness.ts');
  try {
    gate = await import('./checks/guard-liveness.ts');
  } catch (err) {
    die(
      '❌ guard-liveness: failed to load the ESLint stack — the gate requires a\n' +
        '   root-level workspace install (run `npm install` at the repo root).\n' +
        `   ${(err as Error).message}`,
    );
  }
  const report = gate.runGuardLivenessGate(rb.base);

  for (const s of report.skipped) {
    process.stdout.write(`ℹ guard-liveness: SKIP ${s}\n`);
  }
  for (const id of report.noData) {
    process.stdout.write(
      `⚠ guard-liveness: ${id} has no negative-test data — add negative-test.input to enable liveness check\n`,
    );
  }

  if (report.failures.length === 0) {
    if (report.passed.length > 0) {
      process.stdout.write(
        `✅ guard-liveness: ${report.passed.length} ESLint rule(s) passed liveness check\n`,
      );
    }
    return;
  }

  process.stdout.write(
    '\n❌ Guard-liveness: ESLint rule negative-test failures on changed rules:\n',
  );
  for (const f of report.failures) {
    process.stdout.write(`  ${f.ruleId}:\n`);
    for (const msg of f.failures) {
      process.stdout.write(`    - ${msg}\n`);
    }
  }
  process.stdout.write(
    '\nFix: ensure each negative-test.input entry actually triggers the ESLint rule,\n' +
      'and that examples.good produces no violation.\n' +
      'See packages/core/manifest/rules-manifest.json — the negative-test block.\n\n',
  );
  process.exit(1);
}

/**
 * Cmd/script liveness section: change-scoped command/script guard-liveness gate
 * (Wave guard-liveness v1.5). For each command/script manifest rule changed in
 * this push, runs the rule's check against its violating fixture (branching on
 * the per-rule liveness mode) and asserts the guard catches its own violation.
 * SKIP/EXEMPT statuses emit visible lines — never a silent pass.
 */
async function cmdScriptLivenessSection(rb: ResolvedBase): Promise<void> {
  if (rb.base === null) {
    warnSkip(
      'cmd-script-liveness',
      'no resolvable base for change-scoped liveness diff',
    );
    return;
  }
  // Lazy-load — keeps the orchestrator loadable in topologies that do not run
  // this gate. A resolution failure is a loud die, never a silent pass.
  let gate: typeof import('./checks/cmd-script-liveness.ts');
  try {
    gate = await import('./checks/cmd-script-liveness.ts');
  } catch (err) {
    die(
      '❌ cmd-script-liveness: failed to load the liveness runner.\n' +
        `   ${(err as Error).message}`,
    );
  }
  const report = gate.runCmdScriptLivenessGate(rb.base);

  for (const s of report.skipped) {
    process.stdout.write(`ℹ cmd-script-liveness: SKIP ${s}\n`);
  }
  for (const e of report.exempt) {
    process.stdout.write(`ℹ cmd-script-liveness: EXEMPT ${e}\n`);
  }
  for (const nd of report.noData) {
    process.stdout.write(`⚠ cmd-script-liveness: ${nd}\n`);
  }

  if (report.failures.length === 0) {
    if (report.passed.length > 0) {
      process.stdout.write(
        `✅ cmd-script-liveness: ${report.passed.length} command/script rule(s) passed liveness check\n`,
      );
    }
    return;
  }

  process.stdout.write(
    '\n❌ Cmd/script-liveness: rule check failed to catch its violation on changed rules:\n',
  );
  for (const f of report.failures) {
    process.stdout.write(`  ${f.ruleId} [${f.mode ?? 'unknown'}]:\n`);
    for (const msg of f.failures) process.stdout.write(`    - ${msg}\n`);
  }
  process.stdout.write(
    "\nFix: ensure each fixture.setup-script creates the rule's REAL violating state\n" +
      'so the check exits non-zero. See packages/core/manifest/rules-manifest.json (fixture block).\n\n',
  );
  process.exit(1);
}

/**
 * Unpinned bare-run tool install gate (.claude/rules/ci-tool-pinning.md §1 Rule A).
 * Scans every .github/workflows/*.yml for bare `run:` pip/npm-global install
 * commands that lack an explicit version pin.
 *
 * This slice is NOT covered by zizmor's `adhoc-packages` audit (which targets
 * npm/gem/pip via setup-python action inputs only — SSOT #153b, 2026-06-22).
 * Deterministic regex scan; zero API calls (no-paid-llm-in-ci.md compliant).
 */
function unpinnedToolInstallSection(): void {
  const workflows = workflowYmlFiles();
  if (workflows.length === 0) return;

  const allFindings: Array<{
    file: string;
    line: number;
    text: string;
    hint: string;
  }> = [];

  for (const relPath of workflows) {
    const absPath = resolve(REPO_ROOT, relPath);
    if (!existsSync(absPath)) continue;
    const content = readFileSync(absPath, 'utf8');
    const findings = checkUnpinnedToolInstalls(content, relPath);
    allFindings.push(...findings);
  }

  if (allFindings.length === 0) return;

  process.stdout.write(
    '\n❌ Unpinned bare-run tool install(s) found in .github/workflows/ ' +
      '(.claude/rules/ci-tool-pinning.md §1 Rule A):\n',
  );
  for (const f of allFindings) {
    process.stdout.write(`  ${f.file}:${f.line}: ${f.text}\n`);
    process.stdout.write(`    ${f.hint}\n`);
  }
  process.stdout.write(
    '\nFix: add a version pin to each flagged install, e.g.:\n' +
      '  pip install pyyaml  →  pip install pyyaml==6.0.2\n' +
      '  npm install -g tool  →  npm install -g tool@1.2.3\n' +
      'Escape hatch (genuinely un-pinnable): append  # ci-tool-pin: allow <reason>\n\n',
  );
  process.exit(1);
}

async function main(): Promise<void> {
  // Resolve the diff base ONCE, up front — this consumes git's pre-push stdin
  // (which must be read before any other use). All base-scoped sections (6, 7,
  // §1.7, 8) thread the same ResolvedBase.
  const rb = resolveBase();

  // Test seam: run a single section in isolation. The §7 anti-tautology
  // end-to-end test (tests/hooks/prior-art-trailer-hook.test.sh) sets this so it
  // exercises only the prior-art logic, independent of sections 1–6 deps/env.
  if (process.env['PREPUSH_ONLY'] === 'prior-art') {
    priorArtSection(rb);
    process.exit(0);
  }
  if (process.env['PREPUSH_ONLY'] === 's17') {
    s17Section(rb);
    process.exit(0);
  }
  if (process.env['PREPUSH_ONLY'] === 'guard-liveness') {
    await guardLivenessSection(rb);
    process.exit(0);
  }
  if (process.env['PREPUSH_ONLY'] === 'cmd-script-liveness') {
    await cmdScriptLivenessSection(rb);
    process.exit(0);
  }
  if (process.env['PREPUSH_ONLY'] === 'unpinned-tool-install') {
    unpinnedToolInstallSection();
    process.exit(0);
  }

  // Framework-vs-consumer layout signal (SSOT-register presence) — the SAME detector
  // §7/§1.7 use below (reused, not re-invented; declared here so §1/§2 can read it).
  // Drives the TOOL-ABSENCE policy split (#923 follow-up): the framework repo stays
  // fail-closed on a missing workflow linter (ci-tool-pinning); a consumer without the
  // optional scanner installed DEGRADES loudly instead of being DoS'd on every push.
  const isFrameworkRepo = existsSync(resolve(REPO_ROOT, SSOT_REL));
  const onMissingTool: 'die' | 'warn-skip' = isFrameworkRepo
    ? 'die'
    : 'warn-skip';

  // ── 1. actionlint ──────────────────────────────────────────────────────────
  const workflows = workflowYmlFiles();
  if (workflows.length > 0) {
    requireTool(
      'actionlint',
      workflows,
      '   Install: brew install actionlint   (macOS)\n' +
        '         or: go install github.com/rhysd/actionlint/cmd/actionlint@latest',
      undefined,
      onMissingTool,
    );
  }

  // ── 2. zizmor ────────────────────────────────────────────────────────────────
  // HONEST brownfield fix hint (#637): `zizmor --fix=all` auto-fixes ONLY
  // artipacked + template-injection. It does NOT fix unpinned-uses — that needs
  // SHA-pinning (verified live: after `zizmor --fix=all`, unpinned-uses findings
  // remain and the exit code stays non-zero). Saying "just run --fix" would
  // mislead the consumer, so the hint spells out the split.
  const ZIZMOR_FIX_HINT =
    '   Fix: `zizmor --fix=all <file>` auto-fixes artipacked + template-injection.\n' +
    '        unpinned-uses is NOT auto-fixable — SHA-pin each action (e.g. via `pinact` or Dependabot).\n' +
    '   Audit docs: https://docs.zizmor.sh/audits/';
  // Scan the repo's / consumer's live workflows (the brownfield path). Gated on the
  // SAME `workflows.length > 0` condition §1 actionlint uses: a CI-less consumer has
  // no `.github/workflows/` for zizmor to scan, so both sections no-op there (without
  // this guard zizmor scanned a missing path → nonzero → hard-blocked the push). #923
  // fixed the maintainer PATH guards; this closes the remaining TOOL-absence axis.
  if (workflows.length > 0) {
    requireTool(
      'zizmor',
      ['--format', 'plain', '.github/workflows/'],
      '   Install: pip install zizmor',
      ZIZMOR_FIX_HINT,
      onMissingTool,
    );
  }
  // Regression guard (#637): also scan the SHIPPED CI templates so they can't
  // silently drift past the gate. NOTE the existsSync direction is INVERTED vs
  // 3c/3d below: there the scripts live elsewhere in the maintainer repo, so the
  // guard SKIPS here and fires on consumers. Here the templates EXIST in the
  // maintainer repo and are ABSENT on a consumer (who receives the rendered
  // .github/workflows/ci.yml, not templates/) — so this guard FIRES for the
  // maintainer and NO-OPs for consumers.
  const existingTemplates = [
    'templates/ts-server/github-actions-ci.yml',
    'templates/ts-server/github-actions-workflow-integrity.yml',
    'packages/preset-next-15-canonical/templates/github-actions-ci-ui.yml',
  ].filter((p) => existsSync(resolve(REPO_ROOT, p)));
  if (existingTemplates.length > 0) {
    requireTool(
      'zizmor',
      ['--format', 'plain', ...existingTemplates],
      '   Install: pip install zizmor',
      ZIZMOR_FIX_HINT,
    );
  }

  // ── 3. Self-test pipeline ─────────────────────────────────────────────────────
  // audit-ai-docs.test.ts (Wave 10.4): run via vitest (replaces audit-ai-docs.test.sh).
  // Consumer-skip guard (same as 3b–3f/4b): the audit-self/ suite is maintainer-only —
  // a consumer receives packages/core/{hooks,eslint-rules} only, and audit-self scripts
  // land under scripts/ (install.sh), never packages/core/audit-self/. Absent → vitest
  // would exit 1 ("No test files found") and hard-block the consumer's push (#920/#921).
  if (
    existsSync(
      resolve(REPO_ROOT, 'packages/core/audit-self/audit-ai-docs.test.ts'),
    )
  ) {
    const r = run('npx', [
      'vitest',
      'run',
      '--reporter=default',
      'packages/core/audit-self/audit-ai-docs.test.ts',
    ]);
    if (r.notFound)
      die('❌ npx not found — install Node.js to run audit-ai-docs tests');
    if (r.exitCode !== 0) die('❌ audit-ai-docs.test.ts failed:', r);
    emit(r);
  }

  // ── 3a. Hook stub completeness — ported to principle 16 (Wave 10.6 TS migration) ──

  // ── 3b. Skill drift check (D-AuditC-5 channel 2) ──────────────────────────────
  if (existsSync(resolve(REPO_ROOT, 'scripts/check-skill-drift.sh'))) {
    const r = run('bash', ['scripts/check-skill-drift.sh']);
    if (r.exitCode !== 0) die('❌ skill drift check failed', r);
    emit(r);
  }

  // ── 3c. Rule-glob liveness (universalization-fix-s2) ──────────────────────────
  // Shipped consumer gate (install.sh → scripts/): FAILS if an ACTIVE custom ESLint
  // rule's globs match zero source files (silently-inert rule — the worst failure
  // for a "no check → no rule" framework). The script lives at scripts/ only in a
  // consumer repo; in the maintainer repo it is at packages/core/audit-self/, so
  // existsSync is false here and this section is skipped (never blocks our own push).
  if (existsSync(resolve(REPO_ROOT, 'scripts/check-rule-globs.sh'))) {
    const r = run('bash', ['scripts/check-rule-globs.sh']);
    if (r.exitCode !== 0) die('❌ rule-glob liveness check failed', r);
    emit(r);
  }

  // ── 3d. lint-staged binary resolution (universalization-fix-s2) ───────────────
  // Shipped consumer gate (install.sh → scripts/): FAILS if a lint-staged command's
  // binary cannot resolve in the consumer's layout (e.g. a pnpm monorepo where the
  // per-package eslint is not on the root .bin) before the first blocked commit.
  // Absent in the maintainer repo → existsSync skips (same guard as 3c).
  if (existsSync(resolve(REPO_ROOT, 'scripts/check-lintstaged-resolves.sh'))) {
    const r = run('bash', ['scripts/check-lintstaged-resolves.sh']);
    if (r.exitCode !== 0) die('❌ lint-staged resolution check failed', r);
    emit(r);
  }

  // ── 3e. Kickoff portability (D5) — in-flight kickoffs must be git-tracked ─────
  // cross-session kickoff portability, SSOT #116. A kickoff committed only when the
  // author remembers is a memory-dependent convention (the goal forbids it); this
  // makes portability a checked property at the earliest reachable channel. Warn-only
  // during the calibration window (script default KICKOFF_PORTABILITY_WARN_ONLY=true);
  // flips to hard fail when that env is "false" (post back-catalog migration). No-ops
  // in repos without .claude/orchestrator-prompts (consumers — out of scope); the
  // script lives at packages/core/audit-self/ only in the maintainer repo (same guard
  // as 3c/3d), so existsSync skips it on consumers.
  if (
    existsSync(
      resolve(
        REPO_ROOT,
        'packages/core/audit-self/check-kickoff-portability.sh',
      ),
    )
  ) {
    const r = run('bash', [
      'packages/core/audit-self/check-kickoff-portability.sh',
    ]);
    if (r.exitCode !== 0) die('❌ kickoff-portability check failed', r);
    emit(r);
  }

  // ── 3f. Synth-bundle drift + functional smoke test (#755) ───────────────────
  // synth-and-wire.ts is precompiled into a zero-runtime-dep .mjs (esbuild); the
  // committed bundle must stay in sync with the .ts source. Same family as 3b
  // (skill drift) and section 4 (manifest render drift).
  // exit 2 = esbuild absent (NODE_ENV=production skips devDeps) → skip, not fail.
  // exit 1 = real drift → fail.
  if (existsSync(resolve(REPO_ROOT, 'scripts/build-synth-bundle.sh'))) {
    const r = run('bash', ['scripts/build-synth-bundle.sh', '--check']);
    if (r.exitCode === 2) {
      process.stderr.write(
        '⚠️  synth-bundle drift gate skipped — esbuild not installed' +
          ' (run: NODE_ENV=development npm install --include=dev)\n',
      );
    } else if (r.exitCode !== 0) {
      die(
        '❌ synth-bundle drift detected — run: bash scripts/build-synth-bundle.sh',
        r,
      );
    } else {
      emit(r);
      // Functional smoke test: run the bundle zero-dep to prove it synthesizes real
      // rules (not just that bytes match a rebuilt-but-still-broken source).
      // AIF_SYNTH_PKG_ROOT overrides the four import.meta.url anchors that break
      // when esbuild collapses all modules into a single file (#755 anchor fix).
      const bundlePath = resolve(
        REPO_ROOT,
        'packages/core/install/synth-and-wire.bundle.mjs',
      );
      if (existsSync(bundlePath)) {
        const smoke = runCheck(
          'node',
          [
            bundlePath,
            '--stack',
            'react-next',
            '--path',
            '/tmp/no-eslint-config-smoke.mjs',
            '--dry-run',
          ],
          {
            cwd: REPO_ROOT,
            env: {
              ...process.env,
              AIF_SYNTH_PKG_ROOT: resolve(REPO_ROOT, 'packages/core'),
            },
          },
        );
        if (smoke.exitCode !== 0) {
          die(
            '❌ synth-bundle smoke test failed — bundle crashed (anchor break or runtime error)',
            smoke,
          );
        }
        if (smoke.stdout.includes('emitted no rules')) {
          die(
            '❌ synth-bundle smoke test: synthesis emitted no rules — anchor break still present',
            smoke,
          );
        }
        emit(smoke);
      }
    }
  }

  // ── 4. Manifest render drift ──────────────────────────────────────────────────
  // Consumer-skip guard (same family as 3b–3f/4b): packages/core/render/ is
  // maintainer-only (not in install.sh's consumer copy-list). Absent → tsx would
  // ERR_MODULE_NOT_FOUND and hard-block the consumer's push (#920/#921).
  if (existsSync(resolve(REPO_ROOT, 'packages/core/render/render-rules.ts'))) {
    const r = run('npx', [
      'tsx',
      'packages/core/render/render-rules.ts',
      '--check',
    ]);
    if (r.notFound) {
      die(
        '❌ npx not found. Install Node.js to enable manifest render drift check.',
      );
    }
    if (r.exitCode !== 0) die('❌ manifest render drift detected:', r);
    emit(r);
  }

  // ── 4b. Rule-index render drift (CTX Stage 1) ────────────────────────────────
  // .claude/rules/00-rule-index.md + the AGENTS.md `rule-index` fenced region must
  // stay in sync with each rule's own Class:/Fires:/paths:/globs: header metadata.
  // Earliest reachable channel for this ratchet (README#why-this-exists).
  if (existsSync(resolve(REPO_ROOT, 'scripts/render-rule-index.mjs'))) {
    const r = run('npx', ['tsx', 'scripts/render-rule-index.mjs', '--check']);
    if (r.notFound) {
      die(
        '❌ npx/tsx not found. Install Node.js + tsx to enable rule-index drift check.',
      );
    }
    if (r.exitCode !== 0) die('❌ rule-index drift detected:', r);
    emit(r);
  }

  // ── 5. Principles meta-tests (Phase 2) ───────────────────────────────────────
  // Sections 5–5d shell out to `npm --prefix packages/core run test:*`. That needs
  // packages/core/package.json + the meta-test suites, both maintainer-only — a
  // consumer receives packages/core/{hooks,eslint-rules} only (install.sh), so the
  // package.json is absent and npm would exit ENOENT and hard-block the push
  // (#920/#921). One consumer-skip guard (same family as 3b–3f/4b) covers all four.
  const coreMetaTestsAvailable = existsSync(resolve(CORE, 'package.json'));
  if (coreMetaTestsAvailable) {
    const r = run('npm', ['--prefix', CORE, 'run', 'test:principles']);
    if (r.notFound) {
      die(
        '❌ npm/npx not found. Install Node.js to enable principles meta-tests.',
      );
    }
    if (r.exitCode !== 0)
      die('❌ principles meta-tests failed — fix before push', r);
    emit(r);
  }

  // ── 5b. IR grammar-gate tests (MT S1) — stage gate at the pre-push channel ────
  // Lifts the ir/ suite from CI (last-resort) to pre-push (earlier channel), per
  // README#why-this-exists "earliest reachable channel". Fast, no toolchain.
  if (coreMetaTestsAvailable) {
    const r = run('npm', ['--prefix', CORE, 'run', 'test:ir']);
    if (r.notFound) {
      die('❌ npm/npx not found. Install Node.js to enable IR meta-tests.');
    }
    if (r.exitCode !== 0)
      die('❌ IR grammar-gate tests failed — fix before push', r);
    emit(r);
  }

  // ── 5c. Backend tests (MT S2) — stage gate at the pre-push channel ────────────
  // Live-fire (cargo) self-gates via skipIf in firing.test.ts: it runs when a
  // rust toolchain is present, skips loudly otherwise; the always-on matrix /
  // render / parse / self-application tests always run regardless.
  if (coreMetaTestsAvailable) {
    const r = run('npm', ['--prefix', CORE, 'run', 'test:backends']);
    if (r.notFound) {
      die(
        '❌ npm/npx not found. Install Node.js to enable backend meta-tests.',
      );
    }
    if (r.exitCode !== 0) die('❌ backend tests failed — fix before push', r);
    emit(r);
  }

  // ── 5d. Composition tests (MT S4) — stage gate at the pre-push channel ────────
  // The executable-AI-doc plane: DocPlan → rendered region, composition-gate
  // FF8001-8004. Deterministic (no toolchain), lifted from CI to the earlier
  // channel like 5b/5c.
  if (coreMetaTestsAvailable) {
    const r = run('npm', ['--prefix', CORE, 'run', 'test:composition']);
    if (r.notFound) {
      die(
        '❌ npm/npx not found. Install Node.js to enable composition meta-tests.',
      );
    }
    if (r.exitCode !== 0)
      die('❌ composition tests failed — fix before push', r);
    emit(r);
  }

  // ── 6. Spec discipline (Phase 1.C) — dormant defensive guard ─────────────────
  // .claude/orchestrator-prompts/ is gitignored; this fires only if such a file
  // is force-added past gitignore. Now routed through the resolved base (F1):
  // was a stranded hard-coded `origin/main...HEAD` (3-dot) that bypassed the
  // resolver and diverged from git.ts's 2-dot range — reconciled to 2-dot here.
  if (rb.base !== null) {
    const specFiles = getChangedFiles(rb.base, 'ACM', rb.head).filter((f) =>
      /^\.claude\/orchestrator-prompts\/.*\.md$/.test(f),
    );
    // Consumer-skip guard: the batch-spec validator is maintainer-only (not in
    // install.sh's consumer copy-list). A consumer force-adding an orchestrator-prompt
    // past gitignore must not hard-block on tsx ERR_MODULE_NOT_FOUND (#920/#921).
    if (
      specFiles.length > 0 &&
      existsSync(
        resolve(
          REPO_ROOT,
          'packages/core/spec-validation/validate-batch-spec.ts',
        ),
      )
    ) {
      process.stdout.write(
        'Validating force-added orchestrator-prompts in this push...\n',
      );
      const r = run('npx', [
        'tsx',
        'packages/core/spec-validation/validate-batch-spec.ts',
        ...specFiles,
      ]);
      if (r.exitCode !== 0)
        die('❌ spec-validate findings — fix before push', r);
      emit(r);
    }
  } else {
    warnSkip('§6', 'no resolvable base for the spec-discipline diff');
  }

  // The Prior-art / §1.7 trailer checks are framework-authoring conventions: §7
  // cites entries in the SSOT register, and §1.7 is a CONTRIBUTING.md discipline.
  // Both are unsatisfiable on a consumer — the SSOT register (docs/meta-factory/)
  // never ships (install.sh) — so a capability/rule-introducing consumer commit
  // would be blocked by a gate it cannot satisfy (#921 class 2). The SSOT register's
  // presence is the framework-repo signal; absent → both checks are structurally N/A.
  // (`isFrameworkRepo` is computed once above §1, where the §1/§2 tool-absence split
  // also reads it — same detector, declared before its first use.)

  // ── 7. Prior-art trailer (§7) — TS-native since Wave 10.2 ────────────────────
  // Capability-commit detection + `Prior-art:` trailer validation. Ported from
  // pa_* functions in the former legacy-trailer-checks.sh (now §1.7-only).
  if (isFrameworkRepo) priorArtSection(rb);

  // ── §1.7. Discipline trailer — TS-native since Wave 10.3 ─────────────────────
  // Ported from s17_* in the (now deleted) legacy-trailer-checks.sh. Both arms
  // enforce (blocking) by default since 2026-05-21; S17_WARN_ONLY=true downgrades.
  if (isFrameworkRepo) s17Section(rb);

  // Both liveness gates are change-scoped over packages/core/manifest/rules-manifest.json
  // (guard-liveness.ts:238, cmd-script-liveness.ts:610 readFileSync it unconditionally).
  // That manifest is maintainer-only — a consumer receives packages/core/{hooks,eslint-rules}
  // only (install.sh), so it is absent, the readFileSync throws ENOENT OUTSIDE each section's
  // import-guarding try/catch, and the raw error bubbles to main().catch → "pre-push hook
  // crashed" (#921 blocker 5). A consumer has no manifest rules to check, so this guard is
  // semantically a no-op for them; it also keeps guard-liveness's ESLint-stack import off the
  // consumer path entirely (#921 blocker 8 — the pnpm-strict @typescript-eslint/parser
  // non-hoist), while the maintainer repo (manifest present) still runs both gates fully and
  // loud-dies on a real stack breakage.
  const hasRulesManifest = existsSync(
    resolve(REPO_ROOT, 'packages/core/manifest/rules-manifest.json'),
  );

  // ── guard-liveness. Change-scoped ESLint liveness gate (Wave guard-liveness v1) ─
  // For each ESLint manifest rule changed in this push, proves negative-test.input
  // trips the rule and examples.good stays clean. Skips when no base is resolvable.
  if (hasRulesManifest) await guardLivenessSection(rb);

  // ── cmd-script-liveness. Change-scoped command/script liveness gate (v1.5) ────
  // For each command/script manifest rule changed in this push, runs the rule's
  // check against its violating fixture and asserts it exits non-zero. Skips when
  // no base is resolvable or the check binary/workflow/script is unavailable.
  if (hasRulesManifest) await cmdScriptLivenessSection(rb);

  // ── 8. lychee offline link check on changed *.md ─────────────────────────────
  if (rb.base !== null) {
    const changedMd = getChangedFiles(rb.base, 'ACMR', rb.head).filter((f) =>
      f.endsWith('.md'),
    );
    if (changedMd.length > 0) {
      const r = run('lychee', ['--offline', '--no-progress', ...changedMd]);
      if (r.notFound) {
        process.stdout.write(
          '⚠ lychee not found in PATH — offline link check skipped.\n',
        );
        process.stdout.write(
          '  Install: cargo install lychee   OR   brew install lychee\n',
        );
      } else {
        emit(r);
        if (r.exitCode !== 0) {
          die(
            '❌ lychee found broken links in changed Markdown files — fix before push',
            r,
          );
        }
      }
    }
  } else {
    warnSkip('§8', 'no resolvable base for the changed-Markdown link check');
  }

  // ── ci-tool-pinning. Unpinned bare-run tool install gate ─────────────────────
  // Scan .github/workflows/*.yml for bare `run: pip install <pkg>` / `npm i -g
  // <pkg>` without a version pin. Slice not covered by zizmor adhoc-packages
  // (which targets action inputs only — SSOT #153b). No base required: full scan
  // every push (fast; <1ms per file). (.claude/rules/ci-tool-pinning.md §1 Rule A)
  unpinnedToolInstallSection();

  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`❌ pre-push hook crashed: ${(err as Error).message}\n`);
  process.exit(1);
});
