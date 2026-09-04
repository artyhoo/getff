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
 * answered `decision: block` instead. Cause traced, not guessed: `ZCODE_ROLLOUT_DIR` appeared in
 * that test and NOWHERE else in the tree. The arm shipped in #1044 into the *twin*
 * `plugin/hooks/end-of-turn-reminder`, never into the source `.claude/hooks/end-of-turn-reminder.sh`;
 * the twin carries no `@plugin-transform` marker and is byte-identical to its source, i.e.
 * identity-generated — so regeneration overwrote the arm. A test wired at no channel could not
 * say so.
 *
 * That is the argument for the gate in one line: a directory nobody wired hid a real capability
 * loss for five hook revisions (#1054, #1137, #1142, #1349, #1409).
 *
 * **Settled 2026-08-17 (same day, follow-up commit):** the arm was restored *into the source*, so
 * regeneration now propagates it instead of erasing it, and the test is wired like its eleven
 * peers. `COVERAGE_ALLOWLIST` is consequently **empty** — the intended steady state. Arms (f) and
 * (g) were rebuilt in that commit because both had been resting on this one file being unwired:
 * (f) used it as a live comment-only specimen (none remain — measured 130 of 130 tracked tests
 * named in a real step), and (g) looped over allowlist entries, which is vacuous at zero. Each
 * now carries a seeded negative so the logic fires with an empty allowlist.
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
import {
  readFileSync,
  existsSync,
  readdirSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
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
  // Empty is the intended steady state: every tracked *.test.sh is wired. The sole entry this
  // file ever carried (tests/plugin/end-of-turn-reminder-zcode.test.sh) was removed once the
  // defect it recorded — the lost S9C rollout arm — was repaired at the source and the test
  // wired. Arm (g) proves its own logic on a seeded map, so it does not go vacuous at zero.
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
 * A path named only in a `#` comment must NOT count as wired. This started as a live case —
 * audit-self.yml named the then-allowlisted KNOWN-RED test in a comment, and counting it would
 * have marked that test «wired», so the sweep's derived row would have run a knowingly-red test
 * locally (measured 2026-08-17: 130 named in the raw text, 129 in a real step). The red test was
 * repaired and wired hours later, so the population is now 130 of 130 in real steps and no
 * comment-only specimen survives — arm (f) therefore seeds one, still exercising this real
 * function rather than a reimplementation of it.
 *
 * The strip stays load-bearing regardless of the count: audit-self.yml comments name test paths
 * freely (the wiring comments above each block do exactly that), so any future comment mention
 * would silently register as coverage.
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

/**
 * Allowlist-hygiene violations, as messages. Returned rather than asserted inline so arm (g2) can
 * drive the same logic with a seeded map — otherwise the check goes vacuous the moment the real
 * allowlist is empty, which is its intended steady state.
 */
function allowlistViolations(map: Map<string, string>): string[] {
  const files = new Set(population());
  const out: string[] = [];
  for (const [path, rationale] of map) {
    if (!files.has(path)) {
      out.push(
        `COVERAGE_ALLOWLIST entry \`${path}\` is not a tracked *.test.sh — a stale entry ` +
          `silently widens the exemption; delete it or fix the path`,
      );
    }
    if (rationale.trim().length < 20) {
      out.push(
        `COVERAGE_ALLOWLIST entry \`${path}\` needs a rationale of ≥20 chars saying WHY it is exempt`,
      );
    }
  }
  return out;
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
    // Seeded, because the live specimen was repaired: audit-self.yml used to name the KNOWN-RED
    // test only in a `#` comment, and a registry counting comments would have reported it wired,
    // so the sweep's derived row (scripts/run-local-ci-sweep.sh, `plugin-aifdoctor-selftests`)
    // would have run a knowingly-red test locally. The seed drives the REAL workflowRegistry()
    // over a real file on disk — only the corpus is synthetic, never the logic under test.
    const seeded = 'tests/plugin/seeded-comment-only.test.sh';
    const stepped = 'tests/plugin/seeded-real-step.test.sh';
    const tmp = mkdtempSync(join(tmpdir(), 'p41-'));
    try {
      writeFileSync(
        join(tmp, 'seeded.yml'),
        [
          'jobs:',
          '  probe:',
          '    steps:',
          `      # a wiring note that names ${seeded}`,
          `      - run: bash ${stepped}`,
        ].join('\n'),
      );
      const reg = workflowRegistry(tmp);
      expect(
        reg,
        `\`${seeded}\` is named only in a comment — the registry must not treat that as wiring`,
      ).not.toContain(seeded);
      expect(
        reg,
        'the seeded corpus must still register its real `run:` step, or the strip is over-eager',
      ).toContain(stepped);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }

    // Real-corpus half: audit-self.yml genuinely does name test paths inside comments, so the
    // strip is exercised against the shipped file too, not only against the seed.
    const raw = readdirSync(WORKFLOW_DIR)
      .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
      .map((f) => readFileSync(join(WORKFLOW_DIR, f), 'utf8'))
      .join('\n');
    const commentOnlyPhrase = 'invoked by NO workflow step';
    expect(
      raw,
      'precondition: the real workflow carries this phrase in a comment',
    ).toContain(commentOnlyPhrase);
    expect(workflowRegistry()).not.toContain(commentOnlyPhrase);
  });

  it('(g) allowlist hygiene: every allowlisted path is real, with a substantive rationale', () => {
    expect(allowlistViolations(COVERAGE_ALLOWLIST)).toEqual([]);
  });

  it('(g2) paired-negative: the hygiene check itself still fires at an empty allowlist', () => {
    // Without this, (g) is a loop over zero entries — the exact `#armed-but-not-fired` shape this
    // principle exists to catch, reproduced inside the principle. The seeded map proves both
    // clauses are live regardless of what the real allowlist holds.
    const real = population()[0];
    expect(real, 'population is empty — cannot seed the negative').toBeTruthy();
    const seeded = new Map<string, string>([
      ['tests/plugin/not-a-tracked-file.test.sh', 'a perfectly long-enough rationale here'],
      [real!, 'too short'],
    ]);
    const violations = allowlistViolations(seeded);
    expect(violations).toHaveLength(2);
    expect(violations[0]).toMatch(/not a tracked/);
    expect(violations[1]).toMatch(/≥20 chars/);
  });
});
