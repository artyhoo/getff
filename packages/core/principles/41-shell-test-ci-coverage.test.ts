/**
 * Principle 41 — shell-test population ↔ CI invocation coverage gate
 *
 * > **Authoritative for:** every git-tracked `*.test.sh` in the repo is invoked by some step in
 * > `.github/workflows/`, except files carrying an explicit justified entry in
 * > `COVERAGE_ALLOWLIST` below.
 * > **NOT authoritative for:** project goal — see README.md#why-this-exists. Whether those
 * > tests PASS (that is the steps' own job). The *reverse* direction — a CI command the local
 * > sweep never runs — is `scripts/run-local-ci-sweep-coverage.test.sh`. The vitest half of the
 * > same class is `38-vitest-include-ci-coverage.test.ts`; which CI jobs exist at all is
 * > `36-ci-needs-completeness.test.ts`.
 *
 * ## Why this gate exists
 *
 * `tests/install-sh/meta-all-wired.test.sh:22-43` has gated exactly ONE directory since it
 * shipped — `tests/install-sh/*.test.sh` (99 files). Nothing gated the other six shell-test
 * directories, so the same `#armed-but-not-fired` false-green principle 38 measured for vitest
 * was live for shell tests too. Enumerated 2026-08-17 over `git ls-files`: **130 tracked
 * `*.test.sh`, of which 12 had zero CI invocation** — `tests/plugin/` (9 of its 10),
 * `tests/aif-doctor/` (2), `scripts/probe-channels.test.sh` (1).
 *
 * The hole was not academic. Of those 12, eleven passed on first run and are wired by the same
 * commit as this file. **One was RED**: `tests/plugin/end-of-turn-reminder-zcode.test.sh` case
 * (1) asserts the Stop hook's ZCode-rollout arm suppresses a repeated question, and the hook
 * answers `decision: block` instead. Cause traced, not guessed: `ZCODE_ROLLOUT_DIR` appears in
 * that test and NOWHERE else in the tree. The arm shipped in #1044 into the *twin*
 * `plugin/hooks/end-of-turn-reminder`, never into the source `.claude/hooks/end-of-turn-reminder.sh`;
 * the twin now carries no `@plugin-transform` marker and is byte-identical to its source, i.e.
 * identity-generated — so regeneration overwrote the arm. A test wired at no channel could not
 * say so. It is allowlisted below rather than silently deleted, because «restore the arm or
 * retire the test» is a behaviour decision this gate does not get to make.
 *
 * That is the argument for the gate in one line: a directory nobody wired hid a real capability
 * loss for five hook revisions (#1054, #1137, #1142, #1349, #1409).
 *
 * ## Channel choice (.claude/rules/rule-enforcement-channel-selection.md §3)
 *
 * Mechanically detectable → gate, not injection. A principle test is the earliest reachable
 * gate, exactly as principle 38 argued: the principles suite runs at pre-push
 * (`principlesMetaSection`, packages/core/hooks/pre-push.ts) *and* in CI. It also adds no new
 * coverage hole — a fresh `*.test.sh` gate would itself need wiring plus a sweep `gate_table()`
 * row, which is the very defect class this file closes. `principles/` is already covered by the
 * sweep's `vitest-principles` row.
 *
 * ## Prior art (build-vs-reuse, CLAUDE.md capability-commit gate)
 *
 * **ADAPT** of two in-repo implementations of this exact shape, per SSOT #248's own reasoning —
 * `tests/install-sh/meta-all-wired.test.sh` (population = one directory, registry = workflow
 * text) and `38-vitest-include-ci-coverage.test.ts` (population = vitest `include`, registry =
 * workflow steps). This file widens the population from one directory to every tracked
 * `*.test.sh` and reuses 38's arm structure (real-tree · non-vacuity · seeded negatives ·
 * fail-closed · allowlist hygiene). No new dependency, no new module, no new channel.
 * `meta-all-wired.test.sh` is left in place: its population is a strict subset of this one, and
 * retiring another owner's gate is a separate decision.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const WORKFLOW_DIR = join(REPO_ROOT, '.github/workflows');

/**
 * Exempt shell tests: path → why CI cannot or should not invoke it (≥20 chars).
 * An entry here is a recorded decision, never a parking spot — arm (g) asserts the path is
 * still a real member of the population, so a stale entry cannot silently widen the exemption.
 */
const COVERAGE_ALLOWLIST = new Map<string, string>([
  [
    'tests/plugin/end-of-turn-reminder-zcode.test.sh',
    'KNOWN-RED, wiring it would make CI red on a pre-existing defect: case (1) asserts a ZCode ' +
      'rollout arm (ZCODE_ROLLOUT_DIR) that shipped in #1044 into the plugin twin only and was ' +
      'overwritten once that twin became identity-generated from .claude/hooks/end-of-turn-reminder.sh. ' +
      'Restoring the arm vs retiring the test is a behaviour decision, tracked separately; remove ' +
      'this entry in the same commit that settles it.',
  ],
]);

/** Git-tracked `*.test.sh` — the real population. Tracked-only, so worktree scratch never counts. */
function population(): string[] {
  const out = execFileSync('git', ['ls-files', '-z'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return out
    .split('\0')
    .filter((f) => f.endsWith('.test.sh'))
    .sort();
}

/**
 * Workflow text with whole-line comments stripped.
 *
 * Load-bearing TODAY, not a hypothetical guard: a path named only in a `#` comment must NOT
 * count as wired, and this repo already has exactly that case — audit-self.yml names the
 * allowlisted KNOWN-RED test in a comment. Measured 2026-08-17: 130 of 130 tracked tests are
 * named in the raw workflow text, but only 129 in a step. Counting the comment would mark the
 * red test «wired», and the sweep's derived row would then run a knowingly-red test locally.
 * Arm (f) pins this against the real file rather than a synthetic string.
 */
function workflowRegistry(dir: string = WORKFLOW_DIR): string {
  if (!existsSync(dir)) return '';
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n')
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

/** Files in `pop` that `registry` never names. */
function unwired(pop: string[], registry: string): string[] {
  return pop.filter((f) => !registry.includes(f));
}

describe('Principle 41 — every tracked *.test.sh is invoked by CI', () => {
  it('(a) real-tree: no tracked shell test is left un-invoked', () => {
    const missing = unwired(population(), workflowRegistry()).filter(
      (f) => !COVERAGE_ALLOWLIST.has(f),
    );
    expect(
      missing,
      `shell test(s) invoked by NO workflow step — a test wired at no channel fails at none ` +
        `(#armed-but-not-fired). Wire each as a \`run: bash <path>\` step, or add a justified ` +
        `COVERAGE_ALLOWLIST entry:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });

  it('(b) non-vacuity: the population and the registry both parse to real, non-empty values', () => {
    const pop = population();
    // 130 tracked at the time of writing; a floor well under that catches a broken enumerator
    // without breaking on every added test.
    expect(
      pop.length,
      'population collapsed — git ls-files filter is broken',
    ).toBeGreaterThan(50);
    expect(pop.every((f) => existsSync(join(REPO_ROOT, f)))).toBe(true);
    const reg = workflowRegistry();
    expect(
      reg.length,
      'workflow registry read empty — the gate would pass vacuously',
    ).toBeGreaterThan(1000);
    expect(reg).toContain('tests/install-sh/');
  });

  it('(c) paired-negative (seeded step removal): RED when a real wiring step is deleted', () => {
    const pop = population();
    const wired = pop.find(
      (f) => !COVERAGE_ALLOWLIST.has(f) && workflowRegistry().includes(f),
    );
    expect(wired, 'no wired test found to probe with').toBeTruthy();
    // Strip every line naming the probe — the same shape meta-all-wired.test.sh uses.
    const stripped = workflowRegistry()
      .split('\n')
      .filter((line) => !line.includes(wired!))
      .join('\n');
    expect(unwired(pop, stripped)).toContain(wired!);
  });

  it('(d) paired-negative (seeded population addition): RED when a new test joins unwired', () => {
    const synthetic = 'tests/plugin/definitely-not-wired-anywhere.test.sh';
    const pop = [...population(), synthetic];
    const missing = unwired(pop, workflowRegistry()).filter(
      (f) => !COVERAGE_ALLOWLIST.has(f),
    );
    expect(missing).toContain(synthetic);
  });

  it('(e) fail-closed: an unreadable workflow dir yields an empty registry, never a vacuous pass', () => {
    const reg = workflowRegistry(
      join(REPO_ROOT, '.github/workflows-does-not-exist'),
    );
    expect(reg).toBe('');
    // With no registry, every population member must be reported — the gate fails loudly
    // rather than finding "nothing missing" because it found nothing at all.
    expect(unwired(population(), reg).length).toBeGreaterThan(50);
  });

  it('(f) comment-only mentions do not count as wiring', () => {
    // This is not hypothetical: audit-self.yml names the allowlisted KNOWN-RED test inside a
    // `#` comment. A registry that counted comments would report it as wired, and the local
    // sweep's derived row (scripts/run-local-ci-sweep.sh, `plugin-aifdoctor-selftests`) would
    // pick it up and run a knowingly-red test — measured 2026-08-17 before the strip landed.
    const red = 'tests/plugin/end-of-turn-reminder-zcode.test.sh';
    const raw = readdirSync(WORKFLOW_DIR)
      .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
      .map((f) => readFileSync(join(WORKFLOW_DIR, f), 'utf8'))
      .join('\n');
    expect(
      raw,
      'precondition: the red test is named in a workflow comment',
    ).toContain(red);
    expect(
      workflowRegistry(),
      `\`${red}\` is named only in a comment — the registry must not treat that as a wiring step`,
    ).not.toContain(red);
  });

  it('(g) allowlist hygiene: every allowlisted path is real, with a substantive rationale', () => {
    const files = new Set(population());
    for (const [path, rationale] of COVERAGE_ALLOWLIST) {
      expect(
        files.has(path),
        `COVERAGE_ALLOWLIST entry \`${path}\` is not a tracked *.test.sh — a stale entry ` +
          `silently widens the exemption; delete it or fix the path`,
      ).toBe(true);
      expect(
        rationale.trim().length,
        `COVERAGE_ALLOWLIST entry \`${path}\` needs a rationale of ≥20 chars saying WHY it is exempt`,
      ).toBeGreaterThanOrEqual(20);
    }
  });
});
