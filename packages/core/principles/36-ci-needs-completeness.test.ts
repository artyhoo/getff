/**
 * Principle 36 — `ci-success` needs-completeness gate
 *
 * > **Authoritative for:** every top-level job defined in `.github/workflows/audit-self.yml`
 * > appears in the `ci-success` aggregate's `needs:` list, except jobs carrying an explicit
 * > justified entry in `NEEDS_ALLOWLIST` below.
 * > **NOT authoritative for:** project goal — see README.md#why-this-exists. The pass/fail
 * > semantics of the aggregate itself — see `scripts/ci-success-gate.sh` (it judges job
 * > *results*; this file judges the *wiring* that decides which results it ever sees).
 *
 * ## Why this gate exists
 *
 * Branch protection on `staging` requires only three contexts (`ci-success`,
 * `fidelity-verdict-in-pr-body`, `stale-revert-in-pr-diff`), so a job that is NOT in
 * `ci-success.needs` is required by nothing: it can go RED while `ci-success` reports green
 * and the PR merges. The `needs:` list is a hand-maintained mirror of an automatically-growing
 * population (the jobs in the same file), and until this gate nothing asserted the mirror was
 * complete — a `#warning-nobody-reads` detection layer resting on someone reading the workflow
 * (.claude/rules/attention-is-not-a-mechanism.md §1: bare attention may be merge AUTHORITY,
 * never the DETECTION layer).
 *
 * That predicted failure had already materialised **twice over**: `shipped-prettier` (:99) and
 * `framework-fresh-install-validate-multistack` (:1094) were both unwired on `origin/staging`
 * at 2026-08-10, and `.claude/orchestrator-prompts/launch-preannounce-track/kickoff.md:46` had
 * ordered exactly this fix once before — «immediately, one line, before anything else» — after
 * which it never happened and the list drifted further. A fix without a mechanism regressed
 * once already; this file is the mechanism.
 *
 * ## Channel choice (.claude/rules/rule-enforcement-channel-selection.md §3)
 *
 * The violation is mechanically detectable → gate, not injection (§3 step 1). Of the reachable
 * gate channels, a principle test is the earliest that actually fires: the principles suite runs
 * at **pre-push** (`principlesMetaSection`, packages/core/hooks/pre-push.ts:1267) *and* in CI
 * (`principles-meta-tests`, audit-self.yml:210) — developer-time first, CI as backstop, per the
 * README "earliest reachable channel" invariant which makes CI the last resort.
 *
 * Deliberately NOT placed inside `scripts/ci-success-gate.sh`: that script is the body of the
 * very job whose wiring is under test, so it would only ever run in CI (last resort) and would
 * conflate two concerns — judging job *results* vs. asserting the *job graph*. A check that
 * lives inside the artifact it validates cannot outlive that artifact's own removal.
 *
 * ## Prior art (build-vs-reuse, CLAUDE.md capability-commit gate)
 *
 * SSOT #244. actionlint's `RuleJobNeeds` validates `needs:` for cycles, undefined jobs and
 * duplicates — never for *completeness* (context7 /rhysd/actionlint, docs/checks.md "Job
 * dependencies validation"); its custom-rule API is a Go `OnRulesCreated` hook requiring a
 * forked binary, which would break the pinned-binary discipline in .claude/rules/ci-tool-pinning.md.
 * zizmor audits security only. The `Check All CI Completion` / `relies-on` / `required-status-check`
 * marketplace actions aggregate results at *runtime* — the job `ci-success` already is — none
 * asserts statically that the list mirrors the population. Verdict BUILD, ~1 file, no dependency.
 *
 * ## Anti-trap notes
 *
 * T3 — every arm below reads the real `.github/workflows/audit-self.yml` off disk; no arm
 * asserts against a hand-copied job list that could drift from it.
 * T15 (self-application) — arms (c)/(d)/(f) mutate the REAL file text and re-run the REAL
 * parser, so the failing direction is exercised, not assumed
 * (.claude/rules/destination-environment-verification.md §4 `#contract-that-cannot-fail`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../');
const WORKFLOW = resolve(REPO_ROOT, '.github/workflows/audit-self.yml');

/** The aggregate job whose `needs:` list must mirror the workflow's job population. */
const AGGREGATE = 'ci-success';

/**
 * Jobs legitimately outside `${AGGREGATE}.needs`, each with its justification.
 *
 * Exactly one entry today. `ci-success` cannot `needs:` itself — actionlint's `RuleJobNeeds`
 * reports that as a cyclic dependency and the workflow would not run at all.
 *
 * A genuinely push-only job (one whose `if:` can never be true on a `pull_request` event)
 * would be the other legitimate shape, and this map is where it would be declared. There is
 * none today: the only `if:`-guarded job is `pr-commit-trailers` (audit-self.yml:803,
 * `github.event_name == 'pull_request'`), which is wired in and whose `skipped` result the
 * aggregate accepts as OK by design (scripts/ci-success-gate.sh:30). So an `if:` guard is NOT
 * a reason to leave a job out — `skipped` already counts as passing.
 */
const NEEDS_ALLOWLIST = new Map<string, string>([
  [
    AGGREGATE,
    'the aggregate itself — a job cannot needs: itself (actionlint RuleJobNeeds reports a cyclic dependency)',
  ],
]);

// ── Parsing helpers (exported for the paired-negative arms) ────────────────────

/**
 * Top-level job ids under the workflow's `jobs:` key.
 *
 * Anchored at the `jobs:` line so the 2-space-indented keys of `on:` (`push`, `pull_request`,
 * `merge_group`) are never mistaken for jobs, and stops at the next column-0 key. Block-scalar
 * bodies (`run: |`) are indented ≥8 spaces, so they cannot match the exact-2-space pattern.
 */
export function parseJobIds(source: string): string[] {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (start === -1) return [];
  const ids: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^[A-Za-z]/.test(lines[i])) break; // next top-level key ends the jobs: block
    const m = lines[i].match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (m) ids.push(m[1]);
  }
  return ids;
}

/**
 * The `needs:` entries of one named job, or `null` when that job (or its `needs:`) is absent.
 *
 * `null` is load-bearing: it must NOT be conflated with "no needs", or renaming the aggregate
 * would make every arm below pass vacuously. Arm (f) proves the null path.
 *
 * Handles all three YAML forms: block sequence, inline flow list, inline scalar. Five other
 * jobs in this workflow use the inline-scalar form (`needs: principles-meta-tests`), so
 * scoping to the named job's own block — not "the first needs: in the file" — is required.
 */
export function parseAggregateNeeds(
  source: string,
  jobId: string,
): string[] | null {
  const lines = source.split('\n');
  const start = lines.findIndex((l) =>
    new RegExp(`^ {2}${jobId}:\\s*$`).test(l),
  );
  if (start === -1) return null;

  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(lines[i]) || /^[A-Za-z]/.test(lines[i]))
      break; // left the job block without finding needs:

    const inline = lines[i].match(/^ {4}needs:\s*(.+?)\s*$/);
    if (inline) {
      const flow = inline[1].match(/^\[(.*)\]$/);
      const raw = flow ? flow[1] : inline[1];
      return raw
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    }

    if (/^ {4}needs:\s*$/.test(lines[i])) {
      const out: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const item = lines[j].match(/^ {6}- ([A-Za-z0-9_-]+)\s*$/);
        if (item) {
          out.push(item[1]);
          continue;
        }
        if (/^ {6}#/.test(lines[j]) || /^\s*$/.test(lines[j])) continue; // comments/blanks interleave the list
        break;
      }
      return out;
    }
  }
  return null;
}

/** Jobs that must be in `needs` but are not, ignoring allowlisted ids. */
export function missingFromNeeds(
  jobs: string[],
  needs: string[],
  allowlist: ReadonlySet<string> = new Set(NEEDS_ALLOWLIST.keys()),
): string[] {
  const wired = new Set(needs);
  return jobs.filter((j) => !allowlist.has(j) && !wired.has(j));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Principle 36 — every audit-self job is wired into ci-success.needs', () => {
  const read = (): string => readFileSync(WORKFLOW, 'utf8');

  it('(a) real-tree: every job defined in audit-self.yml is in ci-success.needs', () => {
    expect(existsSync(WORKFLOW), `${WORKFLOW} must exist`).toBe(true);
    const src = read();
    const jobs = parseJobIds(src);
    const needs = parseAggregateNeeds(src, AGGREGATE);

    expect(
      needs,
      `job \`${AGGREGATE}\` or its \`needs:\` list was not found in audit-self.yml — ` +
        `the aggregate was renamed or restructured, and this gate cannot verify anything ` +
        `until AGGREGATE here is updated to match (fail-closed, never a vacuous pass)`,
    ).not.toBeNull();

    const missing = missingFromNeeds(jobs, needs as string[]);
    expect(
      missing,
      `These audit-self.yml jobs are NOT in \`${AGGREGATE}.needs\`, so nothing requires them:\n` +
        missing.map((m) => `  - ${m}`).join('\n') +
        `\n\nBranch protection on staging requires only \`${AGGREGATE}\`, so each of these can ` +
        `go RED while \`${AGGREGATE}\` is green and the PR merges. Add each to the \`needs:\` ` +
        `list in audit-self.yml with a comment naming what goes unenforced without it — or, if ` +
        `a job genuinely belongs outside, add it to NEEDS_ALLOWLIST here with its justification.`,
    ).toHaveLength(0);
  });

  it('(b) non-vacuity: the parsers see the real workflow, not an empty parse', () => {
    const src = read();
    const jobs = parseJobIds(src);
    const needs = parseAggregateNeeds(src, AGGREGATE);

    // A parser regression that returned [] would make arm (a) pass for the wrong reason.
    expect(
      jobs.length,
      `expected ≥25 jobs; got ${jobs.length}`,
    ).toBeGreaterThanOrEqual(25);
    expect(
      jobs,
      'the aggregate itself must be among the parsed jobs',
    ).toContain(AGGREGATE);
    expect(needs, 'needs: must parse to a list').not.toBeNull();
    expect(
      (needs as string[]).length,
      `expected ≥25 needs entries; got ${(needs as string[]).length}`,
    ).toBeGreaterThanOrEqual(25);

    // The `on:` keys sit at the same indent as job ids — proof they are not miscounted.
    for (const notAJob of ['push', 'pull_request', 'merge_group']) {
      expect(jobs, `\`${notAJob}\` is an on: trigger, not a job`).not.toContain(
        notAJob,
      );
    }
  });

  it('(c) paired-negative (seeded removal): GREEN on the real file, RED when a needs: entry is deleted', () => {
    const src = read();

    // GREEN direction — the real, unmodified file.
    expect(
      missingFromNeeds(
        parseJobIds(src),
        parseAggregateNeeds(src, AGGREGATE) as string[],
      ),
    ).toEqual([]);

    // RED direction — delete one real entry from the real needs: list and re-run the real parser.
    const victim = 'shipped-prettier';
    const seeded = src.replace(`\n      - ${victim}\n`, '\n');
    expect(
      seeded,
      'the seeded mutation must actually change the file text',
    ).not.toBe(src);
    expect(
      missingFromNeeds(
        parseJobIds(seeded),
        parseAggregateNeeds(seeded, AGGREGATE) as string[],
      ),
      'deleting a needs: entry must be detected',
    ).toEqual([victim]);
  });

  it('(d) paired-negative (seeded job addition): RED when a new job is defined but never wired', () => {
    // The direction that matters most: this is the regression the gate exists to prevent —
    // someone adds a job and forgets the needs: line, exactly as happened to shipped-prettier
    // and framework-fresh-install-validate-multistack.
    const src = read();
    const seeded = src.replace(
      '\njobs:\n',
      '\njobs:\n  seeded-unwired-job:\n    runs-on: ubuntu-latest\n',
    );
    expect(
      seeded,
      'the seeded mutation must actually change the file text',
    ).not.toBe(src);

    const jobs = parseJobIds(seeded);
    expect(jobs, 'the seeded job must be parsed as a job').toContain(
      'seeded-unwired-job',
    );
    expect(
      missingFromNeeds(
        jobs,
        parseAggregateNeeds(seeded, AGGREGATE) as string[],
      ),
      'a defined-but-unwired job must be detected',
    ).toEqual(['seeded-unwired-job']);
  });

  it('(e) allowlist hygiene: every allowlisted id is a real job, with a substantive rationale', () => {
    const jobs = new Set(parseJobIds(read()));
    for (const [id, rationale] of NEEDS_ALLOWLIST) {
      expect(
        jobs.has(id),
        `NEEDS_ALLOWLIST entry \`${id}\` is not a job in audit-self.yml — a stale allowlist ` +
          `entry silently widens the exemption; delete it or fix the id`,
      ).toBe(true);
      // ≥20 chars mirrors the repo's escape-rationale convention (.claude/rules/ci-tool-pinning.md §3,
      // CLAUDE.md `Prior-art:` escape hatch) — a bare "TODO" must not buy an exemption.
      expect(
        rationale.trim().length,
        `NEEDS_ALLOWLIST entry \`${id}\` needs a rationale of ≥20 chars saying WHY it is exempt`,
      ).toBeGreaterThanOrEqual(20);
    }
  });

  it('(f) fail-closed: a renamed aggregate yields null, never a vacuous pass', () => {
    const src = read();
    const renamed = src.replace(
      `\n  ${AGGREGATE}:\n`,
      '\n  ci-success-renamed:\n',
    );
    expect(
      renamed,
      'the seeded rename must actually change the file text',
    ).not.toBe(src);
    expect(
      parseAggregateNeeds(renamed, AGGREGATE),
      'a missing aggregate must return null so arm (a) fails loudly instead of passing on an empty list',
    ).toBeNull();
  });

  it('(g) parser handles the inline needs: forms used elsewhere in this workflow', () => {
    // Five jobs use `needs: principles-meta-tests` (inline scalar). If parseAggregateNeeds
    // grabbed "the first needs: in the file" instead of the named job's own block, it would
    // read one of those and arm (a) would compare against a 1-element list.
    const src = read();
    expect(parseAggregateNeeds(src, 'framework-self-synth')).toEqual([
      'principles-meta-tests',
    ]);
    expect(
      (parseAggregateNeeds(src, AGGREGATE) as string[]).length,
      'the aggregate block must be read, not an unrelated inline needs:',
    ).toBeGreaterThan(1);

    // Inline flow-list form, for completeness of the grammar.
    const flow = ['jobs:', '  agg:', '    needs: [a, b]', '  a:', '  b:'].join(
      '\n',
    );
    expect(parseAggregateNeeds(flow, 'agg')).toEqual(['a', 'b']);
  });
});
