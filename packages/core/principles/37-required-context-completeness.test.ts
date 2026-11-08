/**
 * Principle 37 — required-status-context completeness gate
 *
 * > **Authoritative for:** the set of status contexts that must be registered as REQUIRED on
 * > `staging` branch protection is DECLARED once, per job, by a `# required-context:` marker in
 * > the job's own workflow file — and every in-repo list restating that set agrees with it
 * > exactly. Today two lists restate it: `.github/workflows/workflow-integrity.yml`
 * > (`required_contexts=`) and `scripts/run-local-ci-sweep.sh` (`# REQUIRED_CONTEXTS`).
 * > Also authoritative (arms (i)-(k), SSOT #247) for the *registrability* of each declared
 * > entry: a job marked `required-context: yes` must sit in a workflow whose `pull_request:`
 * > trigger carries no filter, so its context reports on every PR rather than leaving the PR
 * > pending forever.
 * > **NOT authoritative for:** project goal — see README.md#why-this-exists. Whether a declared
 * > context is actually REGISTERED on GitHub — registration stays an operator responsibility.
 * > The B8 offline corpus verifies the actual live observer against fixed transport responses;
 * > it is not a receipt of current GitHub policy or hosted token permissions.
 * > The wiring of jobs INSIDE audit-self.yml into the `ci-success` aggregate — see
 * > `packages/core/principles/36-ci-needs-completeness.test.ts`.
 *
 * ## Why this gate exists
 *
 * A job that lives in its own workflow file cannot `needs:`-aggregate into `ci-success`
 * (cross-file `needs:` does not exist in GitHub Actions), so branch-protection registration is
 * its ONLY fail-closed transport. Which jobs are in that position was recorded nowhere
 * derivable: `workflow-integrity.yml:75` claimed to be «the single place recording which
 * contexts must be registered» while `scripts/run-local-ci-sweep.sh` independently stated a
 * DIFFERENT set, and neither was derived from the other or from the workflow files.
 *
 * That predicted drift had already materialised. On 2026-08-10, with an admin-scoped token:
 *
 *     gh api repos/artyhoo/getff/branches/staging/protection \
 *       --jq '.required_status_checks.contexts[]'
 *     ci-success · fidelity-verdict-in-pr-body · stale-revert-in-pr-diff
 *
 * — three contexts live, while workflow-integrity.yml listed two (`stale-revert-in-pr-diff`
 * missing since it was registered) and the sweep listed three. Two hand-maintained lists, one
 * population, nothing asserting either was complete: a `#warning-nobody-reads` detection layer
 * resting on someone noticing (.claude/rules/attention-is-not-a-mechanism.md §1 — bare attention
 * may be merge AUTHORITY, never the DETECTION layer). Sibling of principle 36, same class.
 *
 * ## Why the declaration lives in the workflow file
 *
 * Making one of the two lists the source of truth would fix their disagreement and leave the
 * real hole open: both could agree and both still omit a job. The completeness claim needs a
 * POPULATION, and the population is the jobs themselves. So each job declares its own status,
 * and the lists are checked against the declared set — the shape principle 36 uses for
 * `ci-success.needs`, and principle 27 for the `install.sh` copy-list.
 *
 * ## Channel choice (.claude/rules/rule-enforcement-channel-selection.md §3)
 *
 * Mechanically detectable → gate, not injection (§3 step 1). A principle test is the earliest
 * gate that fires: the principles suite runs at pre-push (`principlesMetaSection`,
 * packages/core/hooks/pre-push.ts) and in CI (`principles-meta-tests`, audit-self.yml:343) —
 * developer-time first, CI as backstop, per the README "earliest reachable channel" invariant.
 *
 * The declaration gate remains here in the earlier principle channel. The separate paths-filtered
 * workflow observes ordinary branch metadata through Bash+gh+jq: concrete complete classic
 * metadata passes, known missing fails 1, unsupported/unreadable state fails 2. That observation
 * status is deliberately nonrequired and does not register or enforce merge policy. The B8
 * corpus below drives both the shipped helper and the actual YAML run-block without network.
 *
 * ## Prior art (build-vs-reuse, CLAUDE.md capability-commit gate)
 *
 * SSOT #245 (sibling of #244). actionlint validates workflow syntax and `needs:` edges, never
 * branch-protection intent; zizmor audits security. The `required-status-check` marketplace
 * action REGISTERS contexts from a list — it consumes such a list, it does not assert one is
 * complete against the job population. Verdict BUILD, one file, no dependency.
 *
 * SSOT #247 covers arms (i)-(k) separately, because they assert a different property against a
 * different upstream class: actionlint's `RuleGlob` validates `paths:` glob SYNTAX but «does not
 * analyze the implications for branch protection» (DeepWiki `rhysd/actionlint`, 2026-08-10), and
 * the skipped-but-required answers on the marketplace — `poseidon/wait-for-status-checks`,
 * `blend/require-conditional-status-checks` — are RUNTIME waiters, not static assertions. The arms
 * live here rather than in a parallel principle because this file already owns the declaration
 * model and its parsers; a second principle would have had to duplicate them.
 *
 * ## Anti-trap notes
 *
 * T3 — every arm reads the real files off disk; no arm asserts against a hand-copied set.
 * T15 (self-application) — arms (d)-(g) and (j) mutate REAL file text and re-run the REAL parsers,
 * so each failing direction is exercised, not assumed
 * (.claude/rules/destination-environment-verification.md §4 `#contract-that-cannot-fail`).
 */
import { describe, it, expect } from 'vitest';
import {
  readFileSync,
  readdirSync,
  existsSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { load } from 'js-yaml';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../');
const WORKFLOW_DIR = resolve(REPO_ROOT, '.github/workflows');
const INTEGRITY = resolve(WORKFLOW_DIR, 'workflow-integrity.yml');
const SWEEP = resolve(REPO_ROOT, 'scripts/run-local-ci-sweep.sh');

/**
 * `audit-self.yml` is the one workflow whose jobs are NOT individually declarable: all 31 of
 * them route into the single `ci-success` aggregate via `needs:`, and principle 36 asserts that
 * routing is complete. Only the aggregate itself carries a marker here. Without principle 36
 * this carve-out would be a hole, so arm (h) asserts that sibling still exists.
 */
const AGGREGATED_WORKFLOW = 'audit-self.yml';
const AGGREGATE_JOB = 'ci-success';

/** Rationale floor, mirroring the repo's escape-token convention (.claude/rules/ci-tool-pinning.md §3). */
const MIN_RATIONALE = 20;

// ── Parsing helpers (exported for the paired-negative arms) ────────────────────

/** Workflow files carrying a `pull_request:` trigger — the only ones that can report a PR context. */
export function prTriggeredWorkflows(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .filter((f) => hasPullRequestTrigger(readFileSync(resolve(dir, f), 'utf8')))
    .sort();
}

/**
 * True when the `on:` block declares a `pull_request` trigger.
 *
 * Scoped to the `on:` block so a `github.event_name == 'pull_request'` expression inside a job —
 * `pr-commit-trailers` and `branch-protection-assertion` both have one — never counts as a
 * trigger. Handles the block form (`on:` … `  pull_request:`) and the inline form (`on: [push,
 * pull_request]`).
 */
export function hasPullRequestTrigger(source: string): boolean {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => /^on:/.test(l));
  if (start === -1) return false;
  if (/^on:\s*\[.*\bpull_request\b.*\]\s*$/.test(lines[start])) return true;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^[A-Za-z]/.test(lines[i])) break; // next top-level key ends the on: block
    if (/^ {2}pull_request:\s*$/.test(lines[i])) return true;
  }
  return false;
}

/**
 * `pull_request:` trigger keys that suppress the whole workflow run — so a context inside it
 * never reports and a PR requiring it blocks forever. Named verbatim by GitHub's
 * «Troubleshooting required status checks»: path filtering, branch filtering, commit messages.
 * (Commit-message skipping is a magic string in the commit, not a workflow key, so it is out of
 * scope here by construction, not by oversight.)
 */
const DEADLOCKING_TRIGGER_KEYS = [
  'paths',
  'paths-ignore',
  'branches',
  'branches-ignore',
];

/**
 * Which `DEADLOCKING_TRIGGER_KEYS` the workflow's `pull_request:` trigger carries, or `null`
 * when there is no `pull_request:` trigger at all (equally unregistrable — the context can
 * never report on a PR). An empty array means «registrable».
 *
 * Complements `hasPullRequestTrigger` above, which answers «can this workflow report a PR
 * context at all» — this answers «does it report on EVERY PR», the property registration needs.
 *
 * Scoped to the `pull_request:` block: a `paths:` under `push:` is harmless for PR contexts, and
 * `workflow-integrity.yml` carries one of each, so «the first paths: in the file» would be wrong.
 * The inline forms (`on: pull_request`, `on: [push, pull_request]`) cannot express a filter, so
 * they resolve to `[]` — treating them as «no trigger» would RED the one unconditionally safe shape.
 *
 * Deliberately does NOT look at job-level `if:`. A job skipped by a conditional reports
 * `skipped`, which branch protection accepts — «if a job is skipped due to a conditional, it
 * reports success» (same GitHub doc). Flagging it would forbid the promote-flow guards that
 * pr-body-fidelity.yml, pr-stale-revert.yml and discipline-self-check.yml all rely on.
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
    if (/^[A-Za-z]/.test(lines[i])) break;
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
    if (key && DEADLOCKING_TRIGGER_KEYS.includes(key[1])) found.push(key[1]);
  }
  return found;
}

/**
 * Top-level job ids under `jobs:`.
 *
 * Anchored at the `jobs:` line so the 2-space-indented keys of `on:` (`push`, `pull_request`,
 * `schedule`) are never mistaken for jobs, and stops at the next column-0 key.
 */
export function parseJobIds(source: string): string[] {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (start === -1) return [];
  const ids: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^[A-Za-z]/.test(lines[i])) break;
    const m = lines[i].match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (m) ids.push(m[1]);
  }
  return ids;
}

/** The `[start, end)` line range of one job's block, or `null` when the job is absent. */
function jobBlock(source: string, jobId: string): [number, number] | null {
  const lines = source.split('\n');
  const start = lines.findIndex((l) =>
    new RegExp(`^ {2}${jobId}:\\s*$`).test(l),
  );
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (
      /^ {2}[A-Za-z0-9_-]+:\s*$/.test(lines[i]) ||
      /^[A-Za-z]/.test(lines[i])
    ) {
      end = i;
      break;
    }
  }
  return [start, end];
}

/**
 * The status-check context a job reports under: its `name:` when set, else the job id — the
 * rule GitHub itself applies. Matches exactly 4 spaces so `- name:` step entries (6+ spaces,
 * dash-prefixed) can never be read as the job name.
 */
export function parseJobContext(source: string, jobId: string): string | null {
  const range = jobBlock(source, jobId);
  if (!range) return null;
  const lines = source.split('\n');
  for (let i = range[0] + 1; i < range[1]; i++) {
    const m = lines[i].match(/^ {4}name:\s*(.+?)\s*$/);
    if (m) return m[1].replace(/^['"]|['"]$/g, '');
  }
  return jobId;
}

export interface RequiredDeclaration {
  required: boolean;
  rationale: string;
}

/**
 * The `# required-context: yes|no — <rationale>` marker inside a job's block, or `null` when the
 * job carries none.
 *
 * `null` is load-bearing: an undeclared job must FAIL arm (b), never default to "not required" —
 * a silent default is how the population drifts in the first place. Arm (e) proves the null path.
 */
export function parseRequiredDeclaration(
  source: string,
  jobId: string,
): RequiredDeclaration | null {
  const range = jobBlock(source, jobId);
  if (!range) return null;
  const lines = source.split('\n');
  for (let i = range[0] + 1; i < range[1]; i++) {
    const m = lines[i].match(
      /^\s*#\s*required-context:\s*(yes|no)\s*[—-]\s*(.+?)\s*$/,
    );
    if (m) return { required: m[1] === 'yes', rationale: m[2] };
  }
  return null;
}

/** Every declarable job in the repo, as `{file, jobId}` pairs. See AGGREGATED_WORKFLOW. */
export function declarableJobs(dir: string): { file: string; jobId: string }[] {
  const out: { file: string; jobId: string }[] = [];
  for (const file of prTriggeredWorkflows(dir)) {
    const src = readFileSync(resolve(dir, file), 'utf8');
    for (const jobId of parseJobIds(src)) {
      if (file === AGGREGATED_WORKFLOW && jobId !== AGGREGATE_JOB) continue;
      out.push({ file, jobId });
    }
  }
  return out;
}

/** Context names of every job declaring `required-context: yes`, sorted. */
export function declaredRequiredContexts(dir: string): string[] {
  const out: string[] = [];
  for (const { file, jobId } of declarableJobs(dir)) {
    const src = readFileSync(resolve(dir, file), 'utf8');
    if (parseRequiredDeclaration(src, jobId)?.required) {
      const ctx = parseJobContext(src, jobId);
      if (ctx) out.push(ctx);
    }
  }
  return out.sort();
}

/** The `required_contexts='[…]'` JSON array in workflow-integrity.yml, or `null`. */
export function parseIntegrityList(source: string): string[] | null {
  const m = source.match(/required_contexts='(\[[\s\S]*?\])'/);
  if (!m) return null;
  try {
    const parsed: unknown = JSON.parse(m[1]);
    return Array.isArray(parsed) ? (parsed as string[]).slice().sort() : null;
  } catch {
    return null;
  }
}

/**
 * The `# REQUIRED_CONTEXTS:` marker block in run-local-ci-sweep.sh, or `null`.
 *
 * Grammar: the marker line, then one context per `#   <name>` line (exactly 3 spaces after the
 * `#`), ending at the first line that does not match. Prose in the surrounding header uses
 * `# ` + text, so it cannot be swept into the list.
 */
export function parseSweepList(source: string): string[] | null {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => /^#\s*REQUIRED_CONTEXTS:/.test(l));
  if (start === -1) return null;
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^# {3}(\S.*?)\s*$/);
    if (!m) break;
    out.push(m[1]);
  }
  return out.length ? out.sort() : null;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Principle 37 — required status contexts are declared once and restated consistently', () => {
  const readWf = (f: string): string =>
    readFileSync(resolve(WORKFLOW_DIR, f), 'utf8');

  it('(a) non-vacuity: the parsers see the real workflows, not an empty parse', () => {
    const wfs = prTriggeredWorkflows(WORKFLOW_DIR);
    expect(wfs, 'expected ≥8 pull_request-triggered workflows').toHaveLength(
      wfs.length,
    );
    expect(wfs.length).toBeGreaterThanOrEqual(8);
    expect(wfs, 'audit-self.yml is pull_request-triggered').toContain(
      AGGREGATED_WORKFLOW,
    );
    // Workflows with NO pull_request trigger must stay out of the population.
    for (const notPr of ['metrics-collect.yml', 'demo-regen.yml']) {
      expect(wfs, `${notPr} has no pull_request trigger`).not.toContain(notPr);
    }

    const jobs = declarableJobs(WORKFLOW_DIR);
    expect(jobs.length, 'expected ≥10 declarable jobs').toBeGreaterThanOrEqual(
      10,
    );
    // audit-self.yml contributes exactly its aggregate, never its 30 other jobs.
    expect(
      jobs.filter((j) => j.file === AGGREGATED_WORKFLOW).map((j) => j.jobId),
    ).toEqual([AGGREGATE_JOB]);
  });

  it('(b) every declarable job carries a `# required-context:` marker with a substantive rationale', () => {
    const undeclared: string[] = [];
    const thin: string[] = [];
    for (const { file, jobId } of declarableJobs(WORKFLOW_DIR)) {
      const decl = parseRequiredDeclaration(readWf(file), jobId);
      if (!decl) {
        undeclared.push(`${file} → ${jobId}`);
        continue;
      }
      if (decl.rationale.trim().length < MIN_RATIONALE)
        thin.push(`${file} → ${jobId}: "${decl.rationale}"`);
    }

    expect(
      undeclared,
      `These pull_request jobs do not declare whether their fail-closed property rests on ` +
        `branch-protection registration:\n` +
        undeclared.map((u) => `  - ${u}`).join('\n') +
        `\n\nAdd inside the job block:\n` +
        `  # required-context: yes — <why it must be a REQUIRED context on staging>\n` +
        `  # required-context: no  — <why nothing breaks if it is never registered>\n` +
        `A job in its own workflow file cannot needs:-aggregate into ci-success, so if it gates ` +
        `anything real the answer is yes.`,
    ).toHaveLength(0);

    expect(
      thin,
      `These \`# required-context:\` markers need a rationale of ≥${MIN_RATIONALE} chars saying WHY:\n` +
        thin.map((t) => `  - ${t}`).join('\n'),
    ).toHaveLength(0);
  });

  it('(c) real-tree: both in-repo lists equal the declared set exactly', () => {
    expect(existsSync(INTEGRITY), `${INTEGRITY} must exist`).toBe(true);
    expect(existsSync(SWEEP), `${SWEEP} must exist`).toBe(true);

    const declared = declaredRequiredContexts(WORKFLOW_DIR);
    expect(
      declared.length,
      'at least ci-success must be declared required — an empty declared set means the markers ' +
        'were removed or the parser regressed, and every arm below would pass vacuously',
    ).toBeGreaterThanOrEqual(3);
    expect(declared).toContain(AGGREGATE_JOB);

    const integrity = parseIntegrityList(readFileSync(INTEGRITY, 'utf8'));
    expect(
      integrity,
      `\`required_contexts='[…]'\` was not found (or is not valid JSON) in ` +
        `.github/workflows/workflow-integrity.yml — fail-closed, never a vacuous pass`,
    ).not.toBeNull();

    const sweep = parseSweepList(readFileSync(SWEEP, 'utf8'));
    expect(
      sweep,
      `the \`# REQUIRED_CONTEXTS:\` marker block was not found in scripts/run-local-ci-sweep.sh — ` +
        `fail-closed, never a vacuous pass`,
    ).not.toBeNull();

    const drift = (list: string[]): string =>
      `\n  declared but missing from the list: ${JSON.stringify(declared.filter((c) => !list.includes(c)))}` +
      `\n  in the list but not declared:      ${JSON.stringify(list.filter((c) => !declared.includes(c)))}`;

    expect(
      integrity,
      `workflow-integrity.yml \`required_contexts\` disagrees with the ` +
        `\`# required-context: yes\` markers:${drift(integrity as string[])}`,
    ).toEqual(declared);

    expect(
      sweep,
      `scripts/run-local-ci-sweep.sh \`# REQUIRED_CONTEXTS:\` disagrees with the ` +
        `\`# required-context: yes\` markers:${drift(sweep as string[])}`,
    ).toEqual(declared);
  });

  it('(d) paired-negative (seeded flip): a job flipped to `yes` must break both lists', () => {
    // GREEN direction is arm (c). RED direction: flip a real `no` marker to `yes` on the real
    // file and re-run the real parsers — the declared set grows and both lists must now mismatch.
    const file = 'link-checker.yml';
    const src = readWf(file);
    const jobId = parseJobIds(src)[0];
    const before = parseRequiredDeclaration(src, jobId);
    expect(
      before,
      `${file} → ${jobId} must carry a marker for this arm to mean anything`,
    ).not.toBeNull();
    expect(
      before?.required,
      `${file} → ${jobId} must be declared \`no\` for this arm's flip to be a flip`,
    ).toBe(false);

    const seeded = src.replace(
      '# required-context: no',
      '# required-context: yes',
    );
    expect(
      seeded,
      'the seeded mutation must actually change the file text',
    ).not.toBe(src);

    const flipped = parseRequiredDeclaration(seeded, jobId);
    expect(flipped?.required, 'the flip must be visible to the parser').toBe(
      true,
    );

    const ctx = parseJobContext(seeded, jobId) as string;
    const integrity = parseIntegrityList(
      readFileSync(INTEGRITY, 'utf8'),
    ) as string[];
    expect(
      integrity.includes(ctx),
      `a newly-required context (\`${ctx}\`) absent from workflow-integrity.yml must be detected`,
    ).toBe(false);
  });

  it('(e) paired-negative (seeded removal): a job with no marker must be detected, never defaulted', () => {
    // The regression this gate exists to prevent: a new PR-triggered workflow ships with no
    // declaration and silently counts as "not required".
    const file = 'pr-body-prior-art.yml';
    const src = readWf(file);
    const jobId = parseJobIds(src)[0];
    expect(parseRequiredDeclaration(src, jobId)).not.toBeNull();

    const seeded = src
      .split('\n')
      .filter((l) => !/^\s*#\s*required-context:/.test(l))
      .join('\n');
    expect(
      seeded,
      'the seeded mutation must actually change the file text',
    ).not.toBe(src);
    expect(
      parseRequiredDeclaration(seeded, jobId),
      'a missing marker must return null so arm (b) fails loudly instead of assuming `no`',
    ).toBeNull();
  });

  it('(f) paired-negative (seeded list edit): dropping an entry from either list must be detected', () => {
    const declared = declaredRequiredContexts(WORKFLOW_DIR);

    const integritySrc = readFileSync(INTEGRITY, 'utf8');
    const seededIntegrity = integritySrc.replace(`"${AGGREGATE_JOB}",\n`, '');
    expect(
      seededIntegrity,
      'the seeded mutation must change workflow-integrity.yml',
    ).not.toBe(integritySrc);
    expect(
      parseIntegrityList(seededIntegrity),
      'a dropped required_contexts entry must be detected',
    ).not.toEqual(declared);

    const sweepSrc = readFileSync(SWEEP, 'utf8');
    const seededSweep = sweepSrc.replace(`#   ${AGGREGATE_JOB}\n`, '');
    expect(
      seededSweep,
      'the seeded mutation must change run-local-ci-sweep.sh',
    ).not.toBe(sweepSrc);
    expect(
      parseSweepList(seededSweep),
      'a dropped REQUIRED_CONTEXTS entry must be detected',
    ).not.toEqual(declared);
  });

  it('(g) fail-closed: an unparseable list yields null, never a vacuous pass', () => {
    const integritySrc = readFileSync(INTEGRITY, 'utf8');
    const renamed = integritySrc.replace(
      'required_contexts=',
      'required_ctxs=',
    );
    expect(renamed).not.toBe(integritySrc);
    expect(
      parseIntegrityList(renamed),
      'a renamed variable must return null so arm (c) fails loudly instead of comparing nothing',
    ).toBeNull();

    const sweepSrc = readFileSync(SWEEP, 'utf8');
    const dropped = sweepSrc.replace(
      '# REQUIRED_CONTEXTS:',
      '# required contexts:',
    );
    expect(dropped).not.toBe(sweepSrc);
    expect(
      parseSweepList(dropped),
      'a removed marker must return null so arm (c) fails loudly',
    ).toBeNull();

    // Malformed JSON must also be null, not a throw.
    expect(parseIntegrityList('required_contexts=\'["a", ]\'')).toBeNull();
  });

  it('(h) the audit-self carve-out is covered by its sibling gate', () => {
    // Skipping audit-self.yml's 30 non-aggregate jobs is only sound while principle 36 asserts
    // each is wired into `ci-success.needs`. If that file is ever deleted, this carve-out
    // silently becomes a hole — so the carve-out asserts its own precondition.
    const sibling = resolve(HERE, '36-ci-needs-completeness.test.ts');
    expect(
      existsSync(sibling),
      `principle 36 is the precondition for skipping ${AGGREGATED_WORKFLOW}'s non-aggregate ` +
        `jobs here; without it, an unwired job would be required by nothing AND undeclared here`,
    ).toBe(true);

    const src = readWf(AGGREGATED_WORKFLOW);
    const decl = parseRequiredDeclaration(src, AGGREGATE_JOB);
    expect(
      decl?.required,
      `${AGGREGATE_JOB} must declare itself required`,
    ).toBe(true);
  });

  // ── Registrability arm (SSOT #247, added 2026-08-10) ────────────────────────────────────
  //
  // Arms (a)-(h) assert the declared set is restated consistently. They do NOT assert that a
  // declared entry is safe to register at all: `hasPullRequestTrigger` checks only that a
  // `pull_request:` trigger EXISTS, never that it is unfiltered. So flipping a marker to
  // `required-context: yes` inside a `paths:`-filtered workflow passes every arm above and
  // then freezes every PR that matches none of the filter — «Expected — Waiting for status to
  // be reported», forever. That is not a hypothetical: `discipline-self-check.yml` was declared
  // `no` for exactly this reason, with the fix deferred in prose. Prose is not a mechanism
  // (.claude/rules/attention-is-not-a-mechanism.md §1), and this arm is the mechanism.

  it('(i) every declared-required context sits behind an UNFILTERED pull_request: trigger', () => {
    const offenders: string[] = [];
    for (const { file, jobId } of declarableJobs(WORKFLOW_DIR)) {
      const src = readWf(file);
      if (!parseRequiredDeclaration(src, jobId)?.required) continue;
      const filters = parsePullRequestTriggerFilters(src);
      if (filters === null) {
        offenders.push(`${file} (${jobId}) — no pull_request: trigger at all`);
      } else if (filters.length > 0) {
        offenders.push(
          `${file} (${jobId}) — filtered on ${filters.join(' + ')}`,
        );
      }
    }

    expect(
      offenders,
      `These jobs declare \`# required-context: yes\` but their workflow cannot report on every PR:\n` +
        offenders.map((o) => `  - ${o}`).join('\n') +
        `\n\nA filtered workflow does not run on a PR matching none of the filter, so the context ` +
        `never reports and branch protection blocks the PR permanently. GitHub: "Workflows skipped ` +
        `due to path filtering, branch filtering, or commit messages will remain in a pending state ` +
        `and block merging. To avoid this, do not require workflows that can be skipped."\n\n` +
        `Fix: drop the trigger filter and move the scope decision INTO the job — a job-level \`if:\` ` +
        `is safe, because a job skipped by a conditional reports \`skipped\`, which protection ` +
        `accepts. If the job must stay filtered, it cannot be declared required: flip the marker to ` +
        `\`no\` with a rationale, or fold the job into ${AGGREGATED_WORKFLOW} and let ` +
        `\`${AGGREGATE_JOB}\` aggregate it (principle 36 keeps that wiring honest).`,
    ).toEqual([]);
  });

  it('(j) paired-negative (seeded filter): GREEN on the real tree, RED once a declared-required workflow is filtered', () => {
    const declared = declarableJobs(WORKFLOW_DIR).filter(
      ({ file, jobId }) =>
        parseRequiredDeclaration(readWf(file), jobId)?.required,
    );
    expect(
      declared.length,
      'non-vacuity: at least one job must declare itself required, or arm (i) proves nothing',
    ).toBeGreaterThanOrEqual(3);

    const victim = 'discipline-self-check.yml';
    const src = readWf(victim);
    expect(
      parseRequiredDeclaration(src, 'verify-pr-body-sections')?.required,
      `${victim} must be declared required for this arm to exercise the real hazard`,
    ).toBe(true);

    // GREEN — the real, unmodified file.
    expect(parsePullRequestTriggerFilters(src)).toEqual([]);

    // RED — re-introduce the filter whose removal made this context registrable.
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
      're-adding a paths: filter to a declared-required workflow must be detected',
    ).toEqual(['paths']);
  });

  it('(k) the filter parser is scoped to pull_request, and reads the inline trigger grammar', () => {
    // workflow-integrity.yml filters BOTH push: and pull_request: on paths — a file-wide scan
    // would be indistinguishable from a correct one here. It is declared `required-context: no`
    // precisely because of that filter, so arm (i) never reaches it.
    expect(
      parsePullRequestTriggerFilters(readWf('workflow-integrity.yml')),
    ).toEqual(['paths']);
    // audit-self.yml filters push: on branches only — that must not be miscounted.
    expect(parsePullRequestTriggerFilters(readWf(AGGREGATED_WORKFLOW))).toEqual(
      [],
    );

    // Inline forms cannot express a filter, so they are [] — never a false «no trigger» RED.
    expect(parsePullRequestTriggerFilters('on: pull_request\njobs:\n')).toEqual(
      [],
    );
    expect(
      parsePullRequestTriggerFilters('on: [push, pull_request]\njobs:\n'),
    ).toEqual([]);
    // A workflow with no PR trigger at all stays null (arm (i) treats that as an offender).
    expect(parsePullRequestTriggerFilters('on: [push]\njobs:\n')).toBeNull();
    expect(
      parsePullRequestTriggerFilters(
        'on:\n  push:\n    branches: [main]\njobs:\n',
      ),
    ).toBeNull();
  });
});

// B8: transport fixtures are fixed GitHub responses, never copies of the detector.
// Deleting the workflow call or green-washing the helper must break missing/unknown cases.
const LIVE_HELPER = resolve(REPO_ROOT, 'scripts/check-required-contexts.sh');
const integrityRunBlock = (): string => {
  const wf = load(readFileSync(INTEGRITY, 'utf8')) as {
    jobs: Record<string, { steps: { run?: string }[] }>;
  };
  const blocks = wf.jobs['branch-protection-assertion'].steps.filter(
    (s) => s.run,
  );
  expect(blocks).toHaveLength(1);
  return blocks[0].run!;
};

describe('Principle 37 — actual live required-context CLI and workflow conformance (offline)', () => {
  // Independent fixture population is tied to the existing declaration-equality arm (c).
  const wanted = [
    'Template render probes — P1/P4/P6 (deterministic)',
    'capability PR carries Prior-art line in PR body (squash-survival)',
    'ci-success',
    'fidelity-verdict-in-pr-body',
    'stale-revert-in-pr-diff',
    '§1.7 forward+backward sections present in PR description',
  ];
  const classic = (contexts: unknown, checks?: unknown): string =>
    JSON.stringify({
      name: 'staging',
      protected: true,
      protection: {
        enabled: true,
        required_status_checks: {
          contexts,
          ...(checks === undefined ? {} : { checks }),
        },
      },
    });
  const cases = [
    {
      name: 'complete classic contexts',
      branch: classic(wanted),
      rules: '[]',
      status: 0,
      message: 'READABLE COMPLETE',
    },
    {
      name: 'complete real checks schema',
      branch: classic(
        [],
        wanted.map((context) => ({ context, app_id: 15368 })),
      ),
      rules: '[]',
      status: 0,
      message: 'READABLE COMPLETE',
    },
    {
      name: 'known missing three',
      branch: classic(wanted.slice(2, 5)),
      rules: '[]',
      status: 1,
      message: wanted[0],
    },
    {
      name: 'unprotected known empty',
      branch:
        '{"name":"staging","protected":false,"protection":{"enabled":false,"required_status_checks":null}}',
      rules: '[]',
      status: 1,
      message: 'READABLE MISSING',
    },
    {
      name: 'protected without status requirement',
      branch:
        '{"name":"staging","protected":true,"protection":{"enabled":true,"required_status_checks":null}}',
      rules: '[]',
      status: 1,
      message: 'READABLE MISSING',
    },
    {
      name: 'inactive ruleset known missing',
      branch: classic([]),
      rules: '[{"enforcement":"disabled"}]',
      status: 1,
      message: 'READABLE MISSING',
    },
    {
      name: 'active uninspected ruleset',
      branch: classic([]),
      rules: '[{"enforcement":"active"}]',
      status: 2,
      message: 'UNVERIFIED',
    },
    {
      name: 'branch HTTP failure despite valid complete body',
      branch: classic(wanted),
      rules: '[]',
      branchStatus: 42,
      status: 2,
      message: 'API exit 42',
    },
    {
      name: 'branch malformed JSON',
      branch: '{',
      rules: '[]',
      status: 2,
      message: 'UNVERIFIED',
    },
    {
      name: 'branch unknown schema',
      branch: '{}',
      rules: '[]',
      status: 2,
      message: 'UNVERIFIED',
    },
    {
      name: 'protected branch missing required checks schema',
      branch:
        '{"name":"staging","protected":true,"protection":{"enabled":true}}',
      rules: '[]',
      status: 2,
      message: 'UNVERIFIED',
    },
    {
      name: 'branch wrong JSON type',
      branch: '[]',
      rules: '[]',
      status: 2,
      message: 'UNVERIFIED',
    },
    {
      name: 'branch contexts wrong type',
      branch: classic('ci-success'),
      rules: '[]',
      status: 2,
      message: 'UNVERIFIED',
    },
    {
      name: 'branch checks malformed',
      branch: classic([], [{ context: 42 }]),
      rules: '[]',
      status: 2,
      message: 'UNVERIFIED',
    },
    {
      name: 'branch multiple JSON documents',
      branch: classic(wanted) + '\n' + classic(wanted),
      rules: '[]',
      status: 2,
      message: 'UNVERIFIED',
    },
    {
      name: 'rules API failure despite valid empty body',
      branch: classic([]),
      rules: '[]',
      rulesStatus: 42,
      status: 2,
      message: 'API exit 42',
    },
    {
      name: 'rules malformed JSON',
      branch: classic([]),
      rules: '[',
      status: 2,
      message: 'UNVERIFIED',
    },
    {
      name: 'rules unknown schema',
      branch: classic([]),
      rules: '{}',
      status: 2,
      message: 'UNVERIFIED',
    },
    {
      name: 'rules unknown enforcement',
      branch: classic([]),
      rules: '[{}]',
      status: 2,
      message: 'UNVERIFIED',
    },
    {
      name: 'paginated later active ruleset',
      branch: classic([]),
      rules: '[]\n[{"enforcement":"active"}]',
      status: 2,
      message: 'UNVERIFIED',
    },
    {
      name: 'classic complete needs no rules API',
      branch: classic(wanted),
      rules: '{}',
      rulesStatus: 42,
      status: 0,
      message: 'READABLE COMPLETE',
    },
  ];
  it('helper changes reach the existing observer with repository passed through env', () => {
    const wf = load(readFileSync(INTEGRITY, 'utf8')) as {
      on: Record<string, { paths: string[] }>;
      jobs: Record<string, { steps: { env?: Record<string, string> }[] }>;
    };
    for (const event of ['pull_request', 'push']) {
      expect(wf.on[event].paths).toContain(
        'scripts/check-required-contexts.sh',
      );
    }
    const step = wf.jobs['branch-protection-assertion'].steps.find(
      (s) => s.env?.GH_TOKEN,
    );
    expect(step?.env?.GH_REPO).toBe('${{ github.repository }}');
  });
  for (const fixture of cases) {
    // The wrapper has no schema logic: retain success, exact missing list, and
    // early/late transport failure. All distinct helper schemas remain below.
    const wrapperCases = ['complete classic contexts', 'known missing three',
      'branch HTTP failure despite valid complete body', 'rules API failure despite valid empty body'];
    for (const entry of ['helper', 'workflow'] as const) {
      if (entry === 'workflow' && !wrapperCases.includes(fixture.name)) continue;
      it(`${entry}: ${fixture.name} => ${fixture.status}`, () => {
        const dir = mkdtempSync(resolve(tmpdir(), 'p37-live-'));
        try {
          writeFileSync(resolve(dir, 'branch.json'), fixture.branch);
          writeFileSync(resolve(dir, 'rules.json'), fixture.rules);
          writeFileSync(
            resolve(dir, 'gh'),
            `#!/bin/bash
printf '%s\\n' "$*" >> "$FIXTURE_DIR/requests"
case "$*" in
  'api repos/fixture/repo/branches/staging') cat "$FIXTURE_DIR/branch.json"; exit "$BRANCH_STATUS" ;;
  'api --paginate repos/fixture/repo/rulesets?includes_parents=true&per_page=100') cat "$FIXTURE_DIR/rules.json"; exit "$RULES_STATUS" ;;
  *) echo "unexpected gh request: $*" >&2; exit 97 ;;
esac
`,
            { mode: 0o755 },
          );
          const result = spawnSync(
            'bash',
            entry === 'helper'
              ? [LIVE_HELPER, JSON.stringify(wanted)]
              : ['-e', '-o', 'pipefail', '-c', integrityRunBlock()],
            {
              cwd: REPO_ROOT,
              env: {
                ...process.env,
                PATH: `${dir}:${process.env.PATH}`,
                GH_REPO: 'fixture/repo',
                FIXTURE_DIR: dir,
                BRANCH_STATUS: String(fixture.branchStatus ?? 0),
                RULES_STATUS: String(fixture.rulesStatus ?? 0),
              },
              encoding: 'utf8',
              timeout: 10000,
            },
          );
          const output = result.stdout + result.stderr;
          expect(result.error, output).toBeUndefined();
          expect(result.status, output).toBe(fixture.status);
          expect(output).toContain(fixture.message);
          if (fixture.name === 'classic complete needs no rules API') {
            expect(readFileSync(resolve(dir, 'requests'), 'utf8')).toBe(
              'api repos/fixture/repo/branches/staging\n',
            );
          }
          if (fixture.status === 0)
            expect(output).toContain('branches/staging');
          if (fixture.status === 1) {
            expect(output).toContain('Settings → Branches → staging');
            if (fixture.name === 'known missing three') {
              expect(output).toContain(
                `missing required contexts: ${JSON.stringify([wanted[0], wanted[1], wanted[5]])}`,
              );
            }
          }
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      });
    }
  }
});
