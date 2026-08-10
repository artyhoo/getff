/**
 * Principle 37 — required-status-check contexts are registrable, and their two in-repo
 * declarations agree
 *
 * > **Authoritative for:** the `REQUIRED_CONTEXTS` list in `.github/workflows/workflow-integrity.yml`
 * > — (a) every entry resolves to exactly one real job `name:` across `.github/workflows/*.yml`,
 * > (b) each such job's workflow is *registrable*: its `pull_request:` trigger carries no filter
 * > that would make the context fail to report, and (c) the mirror list in
 * > `scripts/run-local-ci-sweep.sh` names the identical set.
 * > **NOT authoritative for:** whether the contexts are actually REGISTERED in branch protection
 * > — that needs admin API read, which no workflow permission scope grants (measured PR #1102,
 * > see the KNOWN LIMITATION in workflow-integrity.yml), so it stays an operator responsibility.
 * > Nor for `ci-success`'s own `needs:` completeness — see principle 36. Nor project goal —
 * > see README.md#why-this-exists.
 *
 * ## Why this gate exists
 *
 * Two failures, both live on `origin/staging` at 2026-08-10, both invisible to every existing
 * check:
 *
 * 1. **The list drifted three ways at once.** `workflow-integrity.yml` named 2 contexts,
 *    `scripts/run-local-ci-sweep.sh` named 3, and live branch protection had a third set. Two
 *    hand-maintained mirrors of a population declared elsewhere, with nothing asserting either.
 *    `workflow-integrity.yml`'s own comment called itself «the single place recording which
 *    contexts must be registered» while being a full entry behind the sweep.
 * 2. **A ruled-required check was structurally unregistrable.** `discipline-self-check.yml`
 *    carried a `paths:` filter on its `pull_request:` trigger. Registering a path-filtered
 *    workflow's job as required parks every non-matching PR on «Expected — Waiting for status
 *    to be reported», permanently: GitHub's own guidance is «Workflows skipped due to path
 *    filtering, branch filtering, or commit messages will remain in a pending state and block
 *    merging. To avoid this, do not require workflows that can be skipped.» The repo had
 *    already learned this once — actionlint + zizmor were moved into `audit-self.yml` for
 *    exactly this reason (`scripts/ci-success-gate.sh:22`, `docs/meta-factory/automerge-staging-plan.md`
 *    §5) — and the lesson was recorded in prose, which is not a mechanism.
 *
 * The registrability property (2) is the one worth gating hardest: its failure mode is not a
 * red check, it is *every PR frozen*, discovered only after an operator has already run the
 * `PATCH .../required_status_checks` call.
 *
 * A job-level `if:` is deliberately NOT flagged. The same GitHub doc: «if a job is skipped due
 * to a conditional, it reports success». `fidelity-verdict-in-pr-body` and
 * `stale-revert-in-pr-diff` both rely on that for their base=staging guards. The distinction
 * this file encodes is exactly workflow-didn't-run (no report, deadlock) vs.
 * job-skipped-by-condition (reports `skipped`, accepted).
 *
 * ## Channel choice (.claude/rules/rule-enforcement-channel-selection.md §3)
 *
 * Mechanically detectable → gate, not injection (§3 step 1). A principle test is the earliest
 * reachable gate: `test:principles` runs at pre-push (`principlesMetaSection`,
 * packages/core/hooks/pre-push.ts:1269) and in CI (`principles-meta-tests`), per the README
 * «earliest reachable channel» invariant that makes CI the last resort.
 *
 * Deliberately NOT placed in `workflow-integrity.yml` itself: that job cannot read branch
 * protection (KNOWN LIMITATION, measured PR #1102), runs only on `.github/workflows/**` PRs
 * because of its own `paths:` filter, and a check living inside the artifact it validates
 * cannot outlive that artifact's removal — the same reasoning principle 36 applied to
 * `scripts/ci-success-gate.sh`.
 *
 * ## Prior art (build-vs-reuse, CLAUDE.md capability-commit gate)
 *
 * SSOT #245. actionlint validates `paths:` glob *syntax* (`RuleGlob`) but «does not analyze the
 * implications for branch protection» and has no cross-file notion of a status-check context
 * (DeepWiki `rhysd/actionlint`, 2026-08-10); zizmor audits security only. The marketplace
 * answers to skipped-but-required — `poseidon/wait-for-status-checks`,
 * `blend/require-conditional-status-checks`, «Pull Request Path Filter» — are RUNTIME
 * workarounds that add a job to wait on other jobs; none asserts statically that an in-repo
 * declaration is registrable. Verdict BUILD, one file, no dependency.
 *
 * ## Anti-trap notes
 *
 * T3 — every arm reads the real files off disk; no arm asserts against a hand-copied list.
 * T15 (self-application) — arms (e)/(f)/(g)/(h) mutate the REAL file text and re-run the REAL
 * parsers, so the failing direction is exercised rather than assumed
 * (.claude/rules/destination-environment-verification.md §4 `#contract-that-cannot-fail`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../');
const WORKFLOW_DIR = resolve(REPO_ROOT, '.github/workflows');
/** Declared SSOT for the required-context set (its own comment says so). */
const SSOT = resolve(WORKFLOW_DIR, 'workflow-integrity.yml');
/** The second hand-maintained mirror, kept in a delimited block so it is parseable. */
const SWEEP = resolve(REPO_ROOT, 'scripts/run-local-ci-sweep.sh');

/**
 * `pull_request:` trigger keys that suppress the whole workflow run, so a required context
 * inside it never reports and the PR blocks forever. Named verbatim by GitHub's
 * «Troubleshooting required status checks»: path filtering, branch filtering, commit messages.
 * (Commit-message skipping is a magic string in the commit, not a workflow key, so it cannot
 * be detected here; it is out of scope by construction, not by oversight.)
 */
const DEADLOCKING_TRIGGER_KEYS = [
  'paths',
  'paths-ignore',
  'branches',
  'branches-ignore',
] as const;

// ── Parsing helpers (exported so the paired-negative arms drive the real code) ─────────────

/**
 * The `required_contexts='[…]'` JSON array from workflow-integrity.yml, or `null` when the
 * declaration is absent.
 *
 * `null` is load-bearing: it must never be conflated with «no required contexts», or deleting
 * or renaming the declaration would make every arm below pass vacuously. Arm (h) proves it.
 */
export function parseSsotContexts(source: string): string[] | null {
  const m = source.match(/^\s*required_contexts='(\[[^\n]*\])'\s*$/m);
  if (!m) return null;
  try {
    const parsed: unknown = JSON.parse(m[1]);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((x) => String(x));
  } catch {
    return null;
  }
}

/**
 * The contexts named in the sweep's delimited block, or `null` when the markers are absent.
 * Comment prose is unparseable by construction, so the block — not the surrounding sentence —
 * is the machine-readable half.
 */
export function parseSweepContexts(source: string): string[] | null {
  const lines = source.split('\n');
  const start = lines.findIndex((l) =>
    /^#\s*REQUIRED-CONTEXTS-BEGIN\s*$/.test(l),
  );
  if (start === -1) return null;
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#\s*REQUIRED-CONTEXTS-END\s*$/.test(lines[i])) return out;
    const m = lines[i].match(/^#\s{2,}(\S.*?)\s*$/);
    if (m) out.push(m[1]);
  }
  return null; // BEGIN without END is malformed, never a partial pass
}

/**
 * Every top-level job in one workflow, as `{ id, name }`. A job with no `name:` reports its id
 * as the status-check context, so the id is the fallback — the same rule GitHub applies.
 *
 * Job-level `name:` sits at exactly 4 spaces; step names are `- name:` at 8+, and `strategy:` /
 * `permissions:` sub-keys are at 6, so none of them can be mistaken for a job name.
 */
export function parseJobNames(source: string): { id: string; name: string }[] {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (start === -1) return [];
  const out: { id: string; name: string }[] = [];
  let cur: { id: string; name: string } | null = null;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^[A-Za-z]/.test(lines[i])) break; // next top-level key ends the jobs: block
    const job = lines[i].match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (job) {
      cur = { id: job[1], name: job[1] };
      out.push(cur);
      continue;
    }
    const name = lines[i].match(/^ {4}name:\s*(.+?)\s*$/);
    if (name && cur) cur.name = name[1].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

/**
 * Which `DEADLOCKING_TRIGGER_KEYS` the workflow's `pull_request:` trigger carries, or `null`
 * when the workflow has no `pull_request:` trigger at all (also unregistrable — the context
 * can never report on a PR).
 *
 * Scoped to the `pull_request:` block: a `paths:` under `push:` is harmless for PR contexts,
 * and workflow-integrity.yml has one of each, so «the first paths: in the file» would be wrong.
 *
 * The inline forms — `on: pull_request` and `on: [push, pull_request]` — cannot express a
 * filter at all, so they resolve to `[]`. Handling them matters: treating a valid unfiltered
 * config as «no pull_request: trigger» would fail arm (b) RED for the one shape that is
 * unconditionally safe.
 */
export function parsePullRequestTriggerFilters(
  source: string,
): string[] | null {
  const lines = source.split('\n');
  const inlineOn = source.match(/^on:[ \t]+(\S.*)$/m);
  if (inlineOn) return /\bpull_request\b/.test(inlineOn[1]) ? [] : null;

  const onIdx = lines.findIndex((l) => /^on:\s*$/.test(l));
  if (onIdx === -1) return null;
  let prIdx = -1;
  for (let i = onIdx + 1; i < lines.length; i++) {
    if (/^[A-Za-z]/.test(lines[i])) break; // left the on: block
    if (/^ {2}pull_request:\s*$/.test(lines[i])) {
      prIdx = i;
      break;
    }
  }
  if (prIdx === -1) return null;

  const found: string[] = [];
  for (let i = prIdx + 1; i < lines.length; i++) {
    if (/^ {2}\S/.test(lines[i]) || /^[A-Za-z]/.test(lines[i])) break; // next trigger / top-level key
    const key = lines[i].match(/^ {4}([A-Za-z-]+):/);
    if (
      key &&
      (DEADLOCKING_TRIGGER_KEYS as readonly string[]).includes(key[1])
    ) {
      found.push(key[1]);
    }
  }
  return found;
}

/** Every workflow file, as `{ file, source }`. */
export function readWorkflows(dir: string): { file: string; source: string }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .sort()
    .map((f) => ({ file: f, source: readFileSync(join(dir, f), 'utf8') }));
}

/** Workflow files defining a job whose reported context equals `context`. */
export function hostsOf(
  workflows: { file: string; source: string }[],
  context: string,
): string[] {
  return workflows
    .filter((w) => parseJobNames(w.source).some((j) => j.name === context))
    .map((w) => w.file);
}

// ── Tests ─────────────────────────────────────────────────────────────────────────────────

describe('Principle 37 — required-check contexts are registrable and consistently declared', () => {
  const ssot = (): string => readFileSync(SSOT, 'utf8');
  const sweep = (): string => readFileSync(SWEEP, 'utf8');
  const workflows = () => readWorkflows(WORKFLOW_DIR);

  it('(a) real-tree: every REQUIRED_CONTEXTS entry resolves to exactly one job name', () => {
    expect(existsSync(SSOT), `${SSOT} must exist`).toBe(true);
    const contexts = parseSsotContexts(ssot());
    expect(
      contexts,
      'REQUIRED_CONTEXTS was not found in workflow-integrity.yml — the declaration was ' +
        'renamed or restructured, and this gate can verify nothing until the parser here ' +
        'is updated to match (fail-closed, never a vacuous pass)',
    ).not.toBeNull();

    const wfs = workflows();
    for (const ctx of contexts as string[]) {
      const hosts = hostsOf(wfs, ctx);
      expect(
        hosts,
        `REQUIRED_CONTEXTS names \`${ctx}\`, but no job in .github/workflows/ reports that ` +
          `context. GitHub matches the context string against the job's \`name:\` ` +
          `character-for-character, so a typo or a rename means the context NEVER reports — ` +
          `registering it blocks every PR on «Expected — Waiting for status to be reported». ` +
          `Fix the string here, or the job's \`name:\`.`,
      ).not.toHaveLength(0);
      expect(
        hosts,
        `Context \`${ctx}\` is reported by more than one workflow (${hosts.join(', ')}). ` +
          `Duplicate job names make the status-check result ambiguous and can block merges ` +
          `(GitHub, "About protected branches"). Rename one.`,
      ).toHaveLength(1);
    }
  });

  it('(b) real-tree: no required context sits behind a trigger filter that would deadlock PRs', () => {
    const contexts = parseSsotContexts(ssot()) as string[];
    const wfs = workflows();
    for (const ctx of contexts) {
      const host = hostsOf(wfs, ctx)[0];
      if (!host) continue; // arm (a) owns that failure
      const src = wfs.find((w) => w.file === host)!.source;
      const filters = parsePullRequestTriggerFilters(src);

      expect(
        filters,
        `\`${host}\` has no \`pull_request:\` trigger, so its context \`${ctx}\` can never ` +
          `report on a PR — requiring it blocks every PR permanently.`,
      ).not.toBeNull();

      expect(
        filters,
        `\`${host}\` filters its \`pull_request:\` trigger on ${(filters ?? []).join(' + ')}, ` +
          `and its job \`${ctx}\` is a REQUIRED status check. A filtered workflow does not run ` +
          `on a PR that matches none of the filter, so the context never reports and branch ` +
          `protection parks the PR on «Expected — Waiting for status to be reported» forever. ` +
          `GitHub: "Workflows skipped due to path filtering, branch filtering, or commit ` +
          `messages will remain in a pending state and block merging. To avoid this, do not ` +
          `require workflows that can be skipped."\n\n` +
          `Fix: drop the trigger filter and move the scope decision INTO the job — a job-level ` +
          `\`if:\` is safe, because a job skipped by a conditional reports \`skipped\`, which ` +
          `protection accepts (pr-body-fidelity.yml and pr-stale-revert.yml both do this). If ` +
          `the job genuinely must stay filtered, it cannot be a required context: fold it into ` +
          `\`audit-self.yml\` and let \`ci-success\` aggregate it instead (principle 36 keeps ` +
          `that wiring honest), the same fix actionlint + zizmor already got.`,
      ).toEqual([]);
    }
  });

  it('(c) real-tree: the run-local-ci-sweep mirror names exactly the SSOT set', () => {
    expect(existsSync(SWEEP), `${SWEEP} must exist`).toBe(true);
    const declared = parseSsotContexts(ssot()) as string[];
    const mirrored = parseSweepContexts(sweep());
    expect(
      mirrored,
      'the REQUIRED-CONTEXTS-BEGIN/END block is missing or unterminated in ' +
        'scripts/run-local-ci-sweep.sh — restore it, or this gate silently stops comparing',
    ).not.toBeNull();
    expect(
      [...(mirrored as string[])].sort(),
      'scripts/run-local-ci-sweep.sh and workflow-integrity.yml declare different required ' +
        'contexts. They are two hand-maintained mirrors of one set; they drifted apart before ' +
        '(the sweep named 3, the SSOT named 2, protection had a third set). Edit both.',
    ).toEqual([...declared].sort());
  });

  it('(d) non-vacuity: the parsers see real data, not an empty parse', () => {
    const contexts = parseSsotContexts(ssot()) as string[];
    expect(
      contexts.length,
      'expected ≥3 required contexts',
    ).toBeGreaterThanOrEqual(3);
    expect(contexts, 'the ci-success aggregate must be among them').toContain(
      'ci-success',
    );

    const wfs = workflows();
    expect(wfs.length, 'expected ≥5 workflow files').toBeGreaterThanOrEqual(5);

    // A parser regression returning [] for job names would make arm (a) fail loudly rather
    // than pass — but one returning every line as a job would make it pass for the wrong
    // reason, so pin the shape on a known file.
    const audit = wfs.find((w) => w.file === 'audit-self.yml')!;
    const jobs = parseJobNames(audit.source);
    expect(
      jobs.length,
      'expected ≥25 jobs in audit-self.yml',
    ).toBeGreaterThanOrEqual(25);
    for (const notAJob of ['push', 'pull_request', 'merge_group']) {
      expect(
        jobs.map((j) => j.id),
        `\`${notAJob}\` is an on: trigger, not a job`,
      ).not.toContain(notAJob);
    }

    // The filter parser must be scoped to pull_request: workflow-integrity.yml carries a
    // paths: filter under BOTH push: and pull_request:, so a file-wide scan would be
    // indistinguishable from a correct one here.
    const wi = wfs.find((w) => w.file === 'workflow-integrity.yml')!;
    expect(
      parsePullRequestTriggerFilters(wi.source),
      'workflow-integrity.yml really does filter its pull_request: trigger on paths — it is ' +
        'not a required context, which is exactly why it may',
    ).toEqual(['paths']);
    expect(
      parsePullRequestTriggerFilters(audit.source),
      'audit-self.yml has an unfiltered pull_request: trigger (its push: branches filter must ' +
        'not be miscounted)',
    ).toEqual([]);

    // Inline trigger grammar: unfilterable by construction, so [] — never a false «no
    // pull_request: trigger» RED. A workflow with no PR trigger at all stays null.
    expect(parsePullRequestTriggerFilters('on: pull_request\njobs:\n')).toEqual(
      [],
    );
    expect(
      parsePullRequestTriggerFilters('on: [push, pull_request]\njobs:\n'),
    ).toEqual([]);
    expect(parsePullRequestTriggerFilters('on: [push]\njobs:\n')).toBeNull();
    expect(parsePullRequestTriggerFilters('on:\n  push:\njobs:\n')).toBeNull();
  });

  it('(e) paired-negative (seeded paths: filter): GREEN on the real tree, RED once a required workflow is filtered', () => {
    const wfs = workflows();
    const host = hostsOf(
      wfs,
      '§1.7 forward+backward sections present in PR description',
    )[0];
    expect(
      host,
      'the §1.7 gate must be locatable for this arm to mean anything',
    ).toBe('discipline-self-check.yml');
    const src = wfs.find((w) => w.file === host)!.source;

    // GREEN direction — the real, unmodified file.
    expect(parsePullRequestTriggerFilters(src)).toEqual([]);

    // RED direction — re-introduce the exact filter this PR removed.
    const seeded = src.replace(
      '    types: [opened, edited, synchronize, reopened]\n',
      "    types: [opened, edited, synchronize, reopened]\n    paths:\n      - '.claude/rules/**'\n",
    );
    expect(
      seeded,
      'the seeded mutation must actually change the file text',
    ).not.toBe(src);
    expect(
      parsePullRequestTriggerFilters(seeded),
      're-adding a paths: filter to a required workflow must be detected',
    ).toEqual(['paths']);
  });

  it('(f) paired-negative (seeded context typo): a context that matches no job name is detected', () => {
    const wfs = workflows();
    // GREEN — every real context resolves.
    for (const ctx of parseSsotContexts(ssot()) as string[]) {
      expect(hostsOf(wfs, ctx), `\`${ctx}\` must resolve`).toHaveLength(1);
    }
    // RED — one character off (the exact failure mode: GitHub matches character-for-character).
    expect(
      hostsOf(wfs, 'ci-succes'),
      'a near-miss context string must resolve to no job',
    ).toHaveLength(0);
    // RED — registering the job id instead of its name, the other documented foot-gun.
    expect(
      hostsOf(wfs, 'verify-pr-body-sections'),
      'the job ID is not the reported context when the job has a name:',
    ).toHaveLength(0);
  });

  it('(g) paired-negative (seeded mirror drift): a dropped sweep entry is detected', () => {
    const declared = parseSsotContexts(ssot()) as string[];
    const src = sweep();

    // GREEN — the real files agree.
    expect([...(parseSweepContexts(src) as string[])].sort()).toEqual(
      [...declared].sort(),
    );

    // RED — drop one entry from the sweep block, as a hand edit would.
    const seeded = src.replace('\n#   stale-revert-in-pr-diff\n', '\n');
    expect(
      seeded,
      'the seeded mutation must actually change the file text',
    ).not.toBe(src);
    expect(
      [...(parseSweepContexts(seeded) as string[])].sort(),
      'a dropped mirror entry must change the parsed set',
    ).not.toEqual([...declared].sort());
  });

  it('(h) fail-closed: a removed or malformed declaration yields null, never a vacuous pass', () => {
    const src = ssot();
    const renamed = src.replace(
      'required_contexts=',
      'required_contexts_renamed=',
    );
    expect(
      renamed,
      'the seeded rename must actually change the file text',
    ).not.toBe(src);
    expect(
      parseSsotContexts(renamed),
      'a missing declaration must return null so arm (a) fails loudly instead of passing on ' +
        'an empty list',
    ).toBeNull();

    // Same property for the mirror: BEGIN without END is malformed, not a partial list.
    const truncated = sweep().replace(
      /^#\s*REQUIRED-CONTEXTS-END\s*$/m,
      '# (removed)',
    );
    expect(
      parseSweepContexts(truncated),
      'an unterminated block must return null, not the entries seen so far',
    ).toBeNull();
  });
});
