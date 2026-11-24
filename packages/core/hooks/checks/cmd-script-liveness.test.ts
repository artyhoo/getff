/**
 * cmd-script-liveness.test.ts — coverage for the v1.5 cmd/script liveness runner.
 *
 * Paired-negative contract per mode (principle 02 Stage 3C requires content-level
 * assertions — exit code / status — for files under hooks/): each mode has a ❌
 * "guard does not catch its violation" case and a ✅ "guard catches it" case.
 * The subprocess boundary is mocked (Aider precedent); fs-dependent modes use a
 * real temp repoRoot.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { runCheck, type CheckResult } from '../utils/run-check.ts';
import {
  resolveMode,
  isExempt,
  extractRunnable,
  splitCompound,
  parseWorkflowRefs,
  runRuleLiveness,
  runCmdScriptLivenessCheck,
  runCmdScriptLivenessGate,
  getChangedCmdScriptRuleIds,
  EXEMPT_RULES,
  type CmdScriptRule,
} from './cmd-script-liveness.ts';

const ok: CheckResult = { exitCode: 0, stdout: '', stderr: '', timedOut: false, notFound: false };
const nonzero: CheckResult = { exitCode: 1, stdout: '', stderr: 'violation', timedOut: false, notFound: false };
const missing: CheckResult = { exitCode: 127, stdout: '', stderr: 'ENOENT', timedOut: false, notFound: true };

type PhaseRoute = { clean: CheckResult; violating: CheckResult };

/**
 * Build a runCheck mock that routes on the command binary AND the clean-vs-violating
 * phase (the runner runs the CLEAN pre-fixture state in a `*-clean-*` temp dir, then
 * the violating state in a `*-violating-*` temp dir — operator rework 2026-06-13).
 * A route may be a single CheckResult (same result in both phases — used for `sh`
 * setup/cleanup and for not-found binaries) or a { clean, violating } pair.
 */
function pairedRun(
  routes: Record<string, CheckResult | PhaseRoute>,
): (cmd: string, args?: readonly string[], opts?: { cwd?: string }) => CheckResult {
  return (cmd: string, _args?: readonly string[], opts?: { cwd?: string }) => {
    const route = routes[cmd];
    if (route === undefined) return ok;
    if ('clean' in route && 'violating' in route) {
      const phase = (opts?.cwd ?? '').includes('-clean-') ? 'clean' : 'violating';
      return route[phase];
    }
    return route as CheckResult;
  };
}

/**
 * Turn a temp dir into a git repo. The resolvers under test enumerate their
 * population with `git ls-files`, not a filesystem walk, so a fixture tree that
 * is not a git repo has an EMPTY population by design — these helpers are what
 * make the fixtures speak the predicate the production code uses.
 */
function initRepo(root: string): void {
  execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' });
}

/** Write `content` at repo-relative `rel`, creating parents. Does NOT track it. */
function writeAt(root: string, rel: string, content: string): string {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
}

/** Stage repo-relative paths so `git ls-files` reports them (no commit needed). */
function track(root: string, ...rels: string[]): void {
  execFileSync('git', ['add', '--', ...rels], { cwd: root, stdio: 'ignore' });
}

/** Commit everything staged and return the new SHA (identity flags inline — temp repos have none). */
function commitAll(root: string, subject: string): string {
  execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'ignore' });
  execFileSync(
    'git',
    ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-qm', subject],
    { cwd: root, stdio: 'ignore' },
  );
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim();
}

/** A runCheck mock that records the argv of every invocation, for resolution assertions. */
function recordingRun(
  routes: Record<string, CheckResult | PhaseRoute>,
  seen: string[][],
): (cmd: string, args?: readonly string[], opts?: { cwd?: string }) => CheckResult {
  const inner = pairedRun(routes);
  return (cmd, args, opts) => {
    seen.push([cmd, ...(args ?? [])]);
    return inner(cmd, args, opts);
  };
}

describe('resolveMode (Option D — derive + override)', () => {
  it('derives run-and-assert from check.type=command', () => {
    expect(resolveMode({ check: { type: 'command', command: 'x' } })).toBe('run-and-assert');
  });
  it('derives resolve-and-run from check.type=script', () => {
    expect(resolveMode({ check: { type: 'script', script: 'x' } })).toBe('resolve-and-run');
  });
  it('override liveness-mode wins over the derived default', () => {
    expect(resolveMode({ check: { type: 'command', command: 'x' }, 'liveness-mode': 'workflow-exists' })).toBe('workflow-exists');
    expect(resolveMode({ check: { type: 'command', command: 'x' }, 'liveness-mode': 'config-presence' })).toBe('config-presence');
    expect(resolveMode({ check: { type: 'command', command: 'x' }, 'liveness-mode': 'exempt' })).toBe('exempt');
    expect(resolveMode({ check: { type: 'script', script: 'x' }, 'liveness-mode': 'run' })).toBe('run-and-assert');
  });
  it('returns null for non-cmd/script rules', () => {
    expect(resolveMode({ check: { type: 'eslint' } })).toBeNull();
  });
});

describe('isExempt', () => {
  it('is true only for liveness-mode=exempt', () => {
    expect(isExempt({ check: { type: 'command' }, 'liveness-mode': 'exempt' })).toBe(true);
    expect(isExempt({ check: { type: 'command' } })).toBe(false);
  });
  it('EXEMPT_RULES carries IR3 + IR4 with per-rule rationale', () => {
    expect(Object.keys(EXEMPT_RULES).sort()).toEqual(['IR3', 'IR4']);
    expect(EXEMPT_RULES.IR3.length).toBeGreaterThan(20);
    expect(EXEMPT_RULES.IR4.length).toBeGreaterThan(20);
  });
});

describe('parsing helpers', () => {
  it('extractRunnable strips a trailing parenthetical', () => {
    expect(extractRunnable('depcruise --validate (blocks @emotion)')).toBe('depcruise --validate');
    expect(extractRunnable('npm run arch:check')).toBe('npm run arch:check');
  });
  it('splitCompound splits on &&', () => {
    expect(splitCompound('tsc --noEmit && eslint <files>')).toEqual(['tsc --noEmit', 'eslint <files>']);
  });
  it('parseWorkflowRefs extracts filenames + job tokens', () => {
    const refs = parseWorkflowRefs('audit-self.yml (actionlint + zizmor → ci-success aggregate) + workflow-integrity.yml (branch-protection-assertion)');
    expect(refs.map((r) => r.file)).toEqual(['audit-self.yml', 'workflow-integrity.yml']);
    expect(refs[0].tokens).toContain('actionlint');
    expect(refs[1].tokens).toContain('protection');
  });
  it('parseWorkflowRefs returns [] when no workflow filename is present (IR1/IR2 prose)', () => {
    expect(parseWorkflowRefs('CI job: zod-to-openapi diff against published OpenAPI')).toEqual([]);
  });
});

describe('run-and-assert mode (clean-pass + violating-fail pair)', () => {
  const rule: CmdScriptRule = {
    check: { type: 'command', command: 'depcruise --validate (blocks styled-components)' },
    fixture: { 'setup-script': "printf 'import styled' > x.tsx" },
  };
  it('✅ passes when the check is clean on the pre-fixture state and trips on the violating fixture', () => {
    const r = runRuleLiveness('R19', rule, {
      runCheckFn: pairedRun({ depcruise: { clean: ok, violating: nonzero } }),
    });
    expect(r.status).toBe('pass');
    expect(r.mode).toBe('run-and-assert');
  });
  it('❌ fails when the check passes even on the violating fixture (guard does NOT catch its violation)', () => {
    const r = runRuleLiveness('R19', rule, {
      runCheckFn: pairedRun({ depcruise: { clean: ok, violating: ok } }),
    });
    expect(r.status).toBe('fail');
    expect(r.failures?.[0]).toMatch(/did NOT exit non-zero on the violating fixture/);
  });
  it('SKIPs (crash-masquerade guard) when the check is non-functional on the clean state — exits non-zero regardless', () => {
    const r = runRuleLiveness('R19', rule, {
      runCheckFn: pairedRun({ depcruise: { clean: nonzero, violating: nonzero } }),
    });
    expect(r.status).toBe('skipped');
    expect(r.reason).toMatch(/check non-functional in env \(clean state did not pass\)/);
  });
  it('SKIPs (not fails) when the check binary is unavailable', () => {
    const r = runRuleLiveness('R19', rule, { runCheckFn: pairedRun({ depcruise: missing }) });
    expect(r.status).toBe('skipped');
    expect(r.reason).toMatch(/no check binary available/);
  });
  it('fails when the fixture setup itself errors (after a clean-passing check)', () => {
    const r = runRuleLiveness('R19', rule, {
      runCheckFn: pairedRun({ depcruise: { clean: ok, violating: ok }, sh: nonzero }),
    });
    expect(r.status).toBe('fail');
    expect(r.failures?.[0]).toMatch(/setup-script exited/);
  });
  it('split-compound: excludes a sub-command non-functional on clean, passes when a functional sub catches the violation (R1)', () => {
    const r1: CmdScriptRule = {
      check: { type: 'command', command: 'tsc --noEmit && eslint <files>' },
      fixture: { 'setup-script': "printf 'as any' > x.ts" },
    };
    // tsc is clean-functional but does not catch (`as any` is valid TS); eslint catches.
    const r = runRuleLiveness('R1', r1, {
      runCheckFn: pairedRun({
        tsc: { clean: ok, violating: ok },
        eslint: { clean: ok, violating: nonzero },
      }),
    });
    expect(r.status).toBe('pass');
  });
  it('split-compound: SKIPs when every sub-command is non-functional on the clean state (R1, bare temp dir)', () => {
    const r1: CmdScriptRule = {
      check: { type: 'command', command: 'tsc --noEmit && eslint <files>' },
      fixture: { 'setup-script': "printf 'as any' > x.ts" },
    };
    // Neither tool is configured in a bare temp dir → both exit non-zero on clean → SKIP, never a false-pass.
    const r = runRuleLiveness('R1', r1, {
      runCheckFn: pairedRun({
        tsc: { clean: nonzero, violating: nonzero },
        eslint: { clean: nonzero, violating: nonzero },
      }),
    });
    expect(r.status).toBe('skipped');
    expect(r.reason).toMatch(/check non-functional in env \(clean state did not pass\)/);
  });
});

describe('resolve-and-run mode (clean-pass + violating-fail pair)', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'csl-repo-'));
    initRepo(repoRoot);
  });
  afterEach(() => rmSync(repoRoot, { recursive: true, force: true }));

  const rule: CmdScriptRule = {
    check: { type: 'script', script: 'scripts/audit-r4.ts' },
    fixture: { 'setup-script': "printf 'export const x=1' > x.ts" },
  };
  const LIVE = 'packages/zzz-preset/probes/audit-r4.ts';
  /**
   * A build-output path that sorts BEFORE the live one, so the pre-fix walker
   * (first match in `readdirSync` order) would have returned it. `packages/getff/`
   * is the real instance: the assembled distribution payload, gitignored.
   */
  const SHADOW = 'packages/getff/scripts/audit-r4.ts';
  function plantScript() {
    writeAt(repoRoot, LIVE, '// probe');
    track(repoRoot, LIVE);
  }

  it('✅ resolves the dangling script, passes clean on the pre-fixture state and trips on the violating fixture', () => {
    plantScript();
    const r = runRuleLiveness('R4', rule, {
      repoRoot,
      runCheckFn: pairedRun({ node: { clean: ok, violating: nonzero } }),
    });
    expect(r.status).toBe('pass');
    expect(r.mode).toBe('resolve-and-run');
  });
  it('❌ fails when the resolved script exits 0 on the violating fixture', () => {
    plantScript();
    const r = runRuleLiveness('R4', rule, {
      repoRoot,
      runCheckFn: pairedRun({ node: { clean: ok, violating: ok } }),
    });
    expect(r.status).toBe('fail');
  });
  it('SKIPs (crash-masquerade guard) when the resolved script crashes on the clean state — e.g. MODULE_NOT_FOUND (ts-morph absent)', () => {
    plantScript();
    const r = runRuleLiveness('R4', rule, {
      repoRoot,
      runCheckFn: pairedRun({ node: { clean: nonzero, violating: nonzero } }),
    });
    expect(r.status).toBe('skipped');
    expect(r.reason).toMatch(/check non-functional in env \(clean state did not pass\)/);
  });
  it('SKIPs when the interpreter is unavailable', () => {
    plantScript();
    const r = runRuleLiveness('R4', rule, { repoRoot, runCheckFn: pairedRun({ node: missing }) });
    expect(r.status).toBe('skipped');
    expect(r.reason).toMatch(/interpreter 'node' not available/);
  });
  it('SKIPs when the script is not found under packages/ (dangling/consumer-relative)', () => {
    mkdirSync(join(repoRoot, 'packages'), { recursive: true });
    const r = runRuleLiveness('R4', rule, { repoRoot, runCheckFn: pairedRun({}) });
    expect(r.status).toBe('skipped');
    expect(r.reason).toMatch(/not found among tracked files under packages\//);
  });
  it('SKIPs (auto-skip-if-missing) a consumer rule whose required package is absent (R17)', () => {
    const r17: CmdScriptRule = {
      check: { type: 'script', script: 'scripts/audit-ai-docs.react-next.sh' },
      fixture: { 'setup-script': "printf x > Button.tsx" },
      'requires-package': 'storybook',
      'auto-skip-if-missing': true,
    };
    const r = runRuleLiveness('R17', r17, { repoRoot, runCheckFn: pairedRun({}) });
    expect(r.status).toBe('skipped');
    expect(r.reason).toMatch(/auto-skip-if-missing/);
  });

  function resolvedArgv(seen: string[][]): string[] {
    return seen.find((argv) => argv[0] === 'node') ?? [];
  }

  /**
   * Paired trackedness contract for the resolve-and-run resolver. `resolve-and-run`
   * EXECUTES what it resolves, so resolving to build output is not a cosmetic
   * mis-citation: a rule whose real backing script was deleted reports GREEN off the
   * stale copy. Reproduced 2026-09-14 after `bash scripts/build-getff-dist.sh` —
   * `run-local-ci-sweep.sh` resolved to `packages/getff/scripts/run-local-ci-sweep.sh`
   * and `eslint.config.react.mjs` to `packages/getff/packages/preset-next-15-canonical/
   * templates/eslint.config.react.mjs`, both gitignored payload.
   *
   * The negative proves the untracked shadow no longer wins; the two positives prove
   * the predicate is TRACKEDNESS and not a `packages/getff/` path exclusion — the same
   * shadow path resolves fine once staged, and once BOTH are staged the resolver reports
   * genuine ambiguity instead of picking by directory order.
   */
  it('❌ an UNTRACKED build-output shadow does not win over the tracked script', () => {
    plantScript();
    writeAt(repoRoot, SHADOW, '// stale payload copy');
    const seen: string[][] = [];
    const r = runRuleLiveness('R4', rule, {
      repoRoot,
      runCheckFn: recordingRun({ node: { clean: ok, violating: nonzero } }, seen),
    });
    expect(r.status).toBe('pass');
    expect(resolvedArgv(seen)).toContain(join(repoRoot, LIVE));
    expect(resolvedArgv(seen)).not.toContain(join(repoRoot, SHADOW));
  });

  it('✅ the SAME shadow path resolves once tracked (predicate is trackedness, not the path)', () => {
    writeAt(repoRoot, SHADOW, '// now a real, tracked script');
    track(repoRoot, SHADOW);
    const seen: string[][] = [];
    const r = runRuleLiveness('R4', rule, {
      repoRoot,
      runCheckFn: recordingRun({ node: { clean: ok, violating: nonzero } }, seen),
    });
    expect(r.status).toBe('pass');
    expect(resolvedArgv(seen)).toContain(join(repoRoot, SHADOW));
  });

  it('❌ FAILs instead of picking by directory order when two TRACKED files share the basename', () => {
    plantScript();
    writeAt(repoRoot, SHADOW, '// a second tracked file with the same basename');
    track(repoRoot, SHADOW);
    const seen: string[][] = [];
    const r = runRuleLiveness('R4', rule, {
      repoRoot,
      runCheckFn: recordingRun({ node: { clean: ok, violating: nonzero } }, seen),
    });
    expect(r.status).toBe('fail');
    expect(r.failures?.[0]).toMatch(/ambiguous/);
    expect(r.failures?.[0]).toContain(SHADOW);
    expect(r.failures?.[0]).toContain(LIVE);
    // and it never ran either candidate rather than proving the wrong one live
    expect(resolvedArgv(seen)).toEqual([]);
  });
});

describe('workflow-exists mode', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'csl-repo-'));
  });
  afterEach(() => rmSync(repoRoot, { recursive: true, force: true }));

  const r11: CmdScriptRule = {
    check: { type: 'command', command: 'audit-self.yml (ci-success aggregate)' },
    fixture: { 'setup-script': 'printf "name: ci" > .github/workflows/ci.yml' },
    'liveness-mode': 'workflow-exists',
  };

  it('✅ passes when the named workflow exists and references its jobs', () => {
    mkdirSync(join(repoRoot, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(repoRoot, '.github', 'workflows', 'audit-self.yml'), 'jobs:\n  ci-success:\n    runs-on: x\n');
    const r = runRuleLiveness('R11', r11, { repoRoot });
    expect(r.status).toBe('pass');
    expect(r.mode).toBe('workflow-exists');
  });
  it('❌ fails when the named workflow is missing', () => {
    mkdirSync(join(repoRoot, '.github', 'workflows'), { recursive: true });
    const r = runRuleLiveness('R11', r11, { repoRoot });
    expect(r.status).toBe('fail');
    expect(r.failures?.[0]).toMatch(/missing/);
  });
  it('❌ fails when the workflow exists but references none of the required jobs', () => {
    mkdirSync(join(repoRoot, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(repoRoot, '.github', 'workflows', 'audit-self.yml'), 'jobs:\n  unrelated:\n    runs-on: x\n');
    const r = runRuleLiveness('R11', r11, { repoRoot });
    expect(r.status).toBe('fail');
    expect(r.failures?.[0]).toMatch(/required jobs/);
  });
  it('SKIPs a consumer-side CI rule with no concrete workflow filename (IR1/IR2)', () => {
    const ir1: CmdScriptRule = {
      check: { type: 'command', command: 'CI job: zod-to-openapi diff against published OpenAPI' },
      fixture: { 'setup-script': 'printf x > src/web/h.ts' },
      'liveness-mode': 'workflow-exists',
    };
    const r = runRuleLiveness('IR1', ir1, { repoRoot });
    expect(r.status).toBe('skipped');
    expect(r.reason).toMatch(/consumer-side CI rule/);
  });
});

describe('config-presence mode', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'csl-repo-'));
    initRepo(repoRoot);
  });
  afterEach(() => rmSync(repoRoot, { recursive: true, force: true }));

  const r3: CmdScriptRule = {
    check: { type: 'command', command: 'npm run arch:check' },
    fixture: { 'setup-script': "printf 'import infra' > src/domain/x.ts" },
    'liveness-mode': 'config-presence',
  };

  it('✅ passes when an architectural dependency-cruiser config exists', () => {
    writeAt(repoRoot, 'templates/ts-server/dependency-cruiser.mjs', 'export default {};');
    track(repoRoot, 'templates/ts-server/dependency-cruiser.mjs');
    const r = runRuleLiveness('R3', r3, { repoRoot });
    expect(r.status).toBe('pass');
    expect(r.mode).toBe('config-presence');
    expect(r.reason).toContain('templates/ts-server/dependency-cruiser.mjs');
  });
  it('❌ fails when no architectural config is present', () => {
    mkdirSync(repoRoot, { recursive: true });
    const r = runRuleLiveness('R3', r3, { repoRoot });
    expect(r.status).toBe('fail');
    expect(r.failures?.[0]).toMatch(/no tracked dependency-cruiser/);
  });

  /**
   * Paired trackedness contract. The pre-fix walker was rooted at the repo root and
   * skipped only `node_modules`/`.git`, so it counted the gitignored `packages/getff/`
   * payload copy and every nested `.claude/worktrees/*` checkout: deleting the live
   * config still read as present. The negative proves the untracked copy no longer
   * answers; the positive proves the predicate is TRACKEDNESS, not a path pattern —
   * the very same path passes once staged.
   */
  it('❌ an UNTRACKED build-output copy does not satisfy config presence', () => {
    writeAt(repoRoot, 'packages/getff/templates/ts-server/dependency-cruiser.mjs', 'export default {};');
    const r = runRuleLiveness('R3', r3, { repoRoot });
    expect(r.status).toBe('fail');
    expect(r.failures?.[0]).toMatch(/no tracked dependency-cruiser/);
  });
  it('✅ the SAME path satisfies it once tracked (predicate is trackedness, not the path)', () => {
    const rel = 'packages/getff/templates/ts-server/dependency-cruiser.mjs';
    writeAt(repoRoot, rel, 'module.exports = {};');
    track(repoRoot, rel);
    const r = runRuleLiveness('R3', r3, { repoRoot });
    expect(r.status).toBe('pass');
    expect(r.reason).toContain(rel);
  });
});

describe('exempt mode', () => {
  it('returns status=exempt with the per-rule rationale', () => {
    const r = runRuleLiveness('IR3', { check: { type: 'script', script: 'prose' }, 'liveness-mode': 'exempt' });
    expect(r.status).toBe('exempt');
    expect(r.reason).toBe(EXEMPT_RULES.IR3);
  });
});

describe('getChangedCmdScriptRuleIds', () => {
  const current = JSON.stringify({
    R1: { check: { type: 'command', command: 'a' } },
    R2: { check: { type: 'eslint', rule: 'x/y' } },
    R4: { check: { type: 'script', script: 's' } },
  });
  it('returns all cmd/script rules when no base', () => {
    expect(getChangedCmdScriptRuleIds(null, current).sort()).toEqual(['R1', 'R4']);
  });
  it('returns only the changed cmd/script rule vs the base', () => {
    const base = JSON.stringify({
      R1: { check: { type: 'command', command: 'a' } },
      R2: { check: { type: 'eslint', rule: 'x/y' } },
      R4: { check: { type: 'script', script: 'OLD' } },
    });
    expect(getChangedCmdScriptRuleIds(base, current)).toEqual(['R4']);
  });
  it('ignores ESLint rule changes', () => {
    const base = JSON.stringify({
      R1: { check: { type: 'command', command: 'a' } },
      R2: { check: { type: 'eslint', rule: 'OLD' } },
      R4: { check: { type: 'script', script: 's' } },
    });
    expect(getChangedCmdScriptRuleIds(base, current)).toEqual([]);
  });
});

describe('runCmdScriptLivenessCheck aggregation', () => {
  it('buckets pass / fail / skipped / exempt across rules', () => {
    const manifest: Record<string, CmdScriptRule> = {
      R19: { check: { type: 'command', command: 'depcruise --validate' }, fixture: { 'setup-script': 'printf x > a' } },
      IR3: { check: { type: 'script', script: 'prose' }, 'liveness-mode': 'exempt' },
    };
    const report = runCmdScriptLivenessCheck(['R19', 'IR3'], manifest, {
      runCheckFn: pairedRun({ depcruise: { clean: ok, violating: nonzero } }),
    });
    expect(report.passed).toEqual(['R19']);
    expect(report.exempt[0]).toMatch(/^IR3:/);
    expect(report.failures).toHaveLength(0);
  });
});

/**
 * Consumer-layout contract (trigger build S3 — spec S-9, advisor E18 F1). The
 * gate's population comes from the manifest the CALLER names (framework:
 * packages/core/manifest/rules-manifest.json — consumer:
 * .ai-factory/synthesizer-output/rules-manifest-additions.json); the consumer
 * script resolver resolves check.script AS WRITTEN among tracked files and
 * refuses paths that escape the project; an unparsable manifest — current OR
 * base — fails closed with a message naming the path (and the ref for the
 * base), never a thrown crash and never a silent «all changed».
 */
describe('consumer layout (trigger build S3)', () => {
  const CONSUMER_REL = '.ai-factory/synthesizer-output/rules-manifest-additions.json';
  const FRAMEWORK_REL = 'packages/core/manifest/rules-manifest.json';

  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'csl-consumer-'));
    initRepo(repoRoot);
  });
  afterEach(() => rmSync(repoRoot, { recursive: true, force: true }));

  const DEAD_G1: CmdScriptRule = {
    check: { type: 'command', command: 'true' },
    fixture: { 'setup-script': 'echo bad > violating.txt' },
  };
  /** `git show <base>:<manifest>` exits non-zero — the manifest is new in this push. */
  const GIT_ABSENT_AT_BASE: CheckResult = {
    exitCode: 128,
    stdout: '',
    stderr: 'fatal: path not in base',
    timedOut: false,
    notFound: false,
  };

  it('✅ the gate reads the manifest the CALLER names (consumer path), not MANIFEST_REL', () => {
    writeAt(repoRoot, CONSUMER_REL, JSON.stringify({ G1: DEAD_G1 }));
    const report = runCmdScriptLivenessGate('HEAD~1', {
      repoRoot,
      manifestRel: CONSUMER_REL,
      layout: 'consumer',
      runCheckFn: pairedRun({ git: GIT_ABSENT_AT_BASE, true: { clean: ok, violating: ok } }),
    });
    expect(report.fatal).toBeUndefined();
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0].ruleId).toBe('G1');
    expect(report.failures[0].failures[0]).toMatch(/did NOT exit non-zero on the violating fixture/);
    // the path it did NOT read: nothing exists at the framework location
    expect(existsSync(join(repoRoot, FRAMEWORK_REL))).toBe(false);
    // counted population rides the report (E18 F1 condition 1)
    expect(report.population).toBe(1);
    expect(report.changedCount).toBe(1);
    expect(report.manifestRel).toBe(CONSUMER_REL);
  });

  it('counts population over the WHOLE manifest but runs only the changed cmd/script rules', () => {
    const base = JSON.stringify({
      G1: { check: { type: 'command', command: 'kept' } },
      G2: { check: { type: 'eslint', rule: 'x/y' } },
    });
    const current = JSON.stringify({
      G1: { check: { type: 'command', command: 'kept' } },
      G2: { check: { type: 'eslint', rule: 'x/y' } },
      G3: { check: { type: 'command', command: 'new' } },
    });
    writeAt(repoRoot, CONSUMER_REL, current);
    const seen: string[][] = [];
    const report = runCmdScriptLivenessGate('HEAD~1', {
      repoRoot,
      manifestRel: CONSUMER_REL,
      layout: 'consumer',
      runCheckFn: recordingRun({ git: { exitCode: 0, stdout: base, stderr: '', timedOut: false, notFound: false } }, seen),
    });
    expect(report.fatal).toBeUndefined();
    expect(report.population).toBe(2); // G1 + G3, the ESLint rule is not the arm's population
    expect(report.changedCount).toBe(1); // only G3 is new vs the base
    expect(report.noData).toHaveLength(1); // G3 ran (no fixture); unchanged G1 never ran
    expect(report.noData[0]).toMatch(/^G3/);
  });

  it('✅ resolves a consumer check.script AS WRITTEN among tracked files (scripts/, not packages/)', () => {
    writeAt(repoRoot, 'scripts/probe.sh', '#!/usr/bin/env bash\ntest ! -e violating.txt\n');
    track(repoRoot, 'scripts/probe.sh');
    const seen: string[][] = [];
    const r = runRuleLiveness('G2', {
      check: { type: 'script', script: 'scripts/probe.sh' },
      fixture: { 'setup-script': 'echo bad > violating.txt' },
    }, {
      repoRoot,
      layout: 'consumer',
      runCheckFn: (cmd, args, opts) => {
        seen.push([cmd, ...(args ?? [])]);
        return runCheck(cmd, args, opts);
      },
    });
    expect(r.status).toBe('pass');
    expect(seen.find((argv) => argv[0] === 'bash')).toContain(join(repoRoot, 'scripts/probe.sh'));
  });

  it('SKIPs an untracked consumer script with the consumer wording — never the under-packages/ message', () => {
    const r = runRuleLiveness('G2', {
      check: { type: 'script', script: 'scripts/absent.sh' },
      fixture: { 'setup-script': 'echo x > y' },
    }, { repoRoot, layout: 'consumer', runCheckFn: pairedRun({}) });
    expect(r.status).toBe('skipped');
    expect(r.reason).toMatch(/not found among tracked files/);
    expect(r.reason).not.toMatch(/under packages\//);
  });

  it('❌ refuses an ABSOLUTE consumer check.script: fail «resolves outside the project», never resolved or run', () => {
    const seen: string[][] = [];
    const r = runRuleLiveness('G2', {
      check: { type: 'script', script: '/etc/evil.sh' },
      fixture: { 'setup-script': 'echo x > y' },
    }, { repoRoot, layout: 'consumer', runCheckFn: recordingRun({}, seen) });
    expect(r.status).toBe('fail');
    expect(r.failures?.[0]).toMatch(/resolves outside the project/);
    expect(r.failures?.[0]).toContain('/etc/evil.sh');
    expect(seen.filter((argv) => argv[0] === 'bash' || argv[0] === 'node')).toEqual([]);
  });

  it('❌ refuses a `..` consumer check.script the same way — never resolved or run', () => {
    const seen: string[][] = [];
    const r = runRuleLiveness('G2', {
      check: { type: 'script', script: '../../escape.sh' },
      fixture: { 'setup-script': 'echo x > y' },
    }, { repoRoot, layout: 'consumer', runCheckFn: recordingRun({}, seen) });
    expect(r.status).toBe('fail');
    expect(r.failures?.[0]).toMatch(/resolves outside the project/);
    expect(r.failures?.[0]).toContain('../../escape.sh');
    expect(seen.filter((argv) => argv[0] === 'bash' || argv[0] === 'node')).toEqual([]);
  });

  it('❌ a DEAD consumer rule (passes clean AND on the violating fixture) fails — real subprocesses', () => {
    const r = runRuleLiveness('G1', DEAD_G1, { repoRoot, layout: 'consumer' });
    expect(r.status).toBe('fail');
    expect(r.failures?.[0]).toMatch(/did NOT exit non-zero on the violating fixture/);
  });

  it('✅ its LIVE twin (`test ! -e violating.txt`, same setup-script) passes — real subprocesses', () => {
    const r = runRuleLiveness('G1', {
      check: { type: 'command', command: 'test ! -e violating.txt' },
      fixture: { 'setup-script': 'echo bad > violating.txt' },
    }, { repoRoot, layout: 'consumer' });
    expect(r.status).toBe('pass');
    expect(r.mode).toBe('run-and-assert');
  });

  it('an invalid-JSON CURRENT manifest is a fatal naming the path — no throw, no crash, nothing ran', () => {
    writeAt(repoRoot, CONSUMER_REL, '{ this is not json');
    const report = runCmdScriptLivenessGate('HEAD~1', {
      repoRoot,
      manifestRel: CONSUMER_REL,
      layout: 'consumer',
      runCheckFn: pairedRun({ git: GIT_ABSENT_AT_BASE }),
    });
    expect(report.fatal).toBeDefined();
    expect(report.fatal).toContain(CONSUMER_REL);
    expect(report.failures).toEqual([]);
    expect(report.passed).toEqual([]);
  });

  it('an invalid-JSON BASE manifest (a real base commit carrying unparsable text) is a fatal naming path AND ref — never a silent all-changed', () => {
    writeAt(repoRoot, CONSUMER_REL, '<<< not json >>>');
    track(repoRoot, CONSUMER_REL);
    const baseSha = commitAll(repoRoot, 'base: garbage manifest');
    writeAt(repoRoot, CONSUMER_REL, JSON.stringify({ G1: DEAD_G1 }));
    commitAll(repoRoot, 'seed: dead rule');
    // REAL runCheck — the git show against the base must really run.
    const report = runCmdScriptLivenessGate(baseSha, {
      repoRoot,
      manifestRel: CONSUMER_REL,
      layout: 'consumer',
    });
    expect(report.fatal).toBeDefined();
    expect(report.fatal).toContain(CONSUMER_REL);
    expect(report.fatal).toContain(baseSha);
    expect(report.failures).toEqual([]);
  });
});
