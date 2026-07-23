# Acceptance Contour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the fail-closed acceptance contour from [docs/superpowers/specs/2026-07-23-acceptance-contour-design.md](../specs/2026-07-23-acceptance-contour-design.md): fidelity auditor + PR-body CI gate (Phase A → PR-A), then the choreography wiring in skills + CLAUDE.md routing amendment (Phase B → PR-B).

**Architecture:** A cold agent (`agents/fidelity-auditor.md`) produces a `FIDELITY:` verdict at every stage-PR boundary; a deterministic CI gate (`pr-body-fidelity`) makes its presence non-optional on base=`staging` PRs (mirror of the shipped `pr-body-prior-art.yml` #1098 pattern). Skills (`/harvest`, `/dispatcher`, night-mode, `/arch`) wire the choreography; CLAUDE.md shifts the Tier-2 planning boundary.

**Tech Stack:** TypeScript (packages/core, vitest), GitHub Actions (deterministic grep job, no LLM), markdown skills/agents.

## Global Constraints

- No paid LLM in CI (`.claude/rules/no-paid-llm-in-ci.md`) — the CI job is pure string validation.
- Actions pinned by SHA; `npm ci --prefix` only (`.claude/rules/ci-tool-pinning.md`).
- All artifacts English (`.claude/rules/language-discipline.md`).
- New `agents/*.md` MUST carry doc-authority `Class:`/`Authoritative-for:` header (principle 09, dynamic).
- Markdown files ≤600 lines (pre-commit gate).
- PR-A commit adding `packages/core/hooks/checks/pr-body-fidelity*.ts` is a capability commit → `Prior-art:` trailer required (Task A4 step 5).
- Both PRs carry a REAL `## Fidelity verdict` GO block (dogfood; spec D3 rollout) + §1.7 sections (CLAUDE.md edit in PR-B ⇒ Forward+Backward pair, not Skipped).

---

## Phase A — the mechanical gate (PR-A)

### Task A1: `agents/fidelity-auditor.md`

**Files:**
- Create: `agents/fidelity-auditor.md`

**Interfaces:**
- Produces: the dispatch contract + output grammar consumed verbatim by Tasks B1-B3 (`FIDELITY: GO|REVISE|STOP`, `Basis:`, `Round:`, `Audited-SHA:`, drift lists, `KICKOFF-AMBIGUOUS`).

- [ ] **Step 1: Write the file** with exactly this content:

````markdown
# fidelity-auditor — cold WHAT-conformance acceptance auditor

> **Class:** B — the named cold-agent detection layer of the acceptance contour
> ([attention-is-not-a-mechanism.md §1(b)](../.claude/rules/attention-is-not-a-mechanism.md));
> the fail-closed transport is the `pr-body-fidelity` CI gate
> ([packages/core/hooks/checks/pr-body-fidelity.ts](../packages/core/hooks/checks/pr-body-fidelity.ts)).
> Promotion: first fidelity miss attributable to diff size → add a chunked
> per-file-group audit protocol here (spec §7).
> **Fires:** at every stage-PR boundary — `/harvest` §4 fidelity step, `/dispatcher` §2.4
> pre-egress gate, night-mode PR-gate.
> **Authoritative for:** the fidelity-audit protocol — inputs, question, output grammar.
> **NOT authoritative for:** code quality (that is `superpowers:requesting-code-review`);
> the CI gate form (pr-body-fidelity.ts); rework choreography
> ([.claude/skills/dispatcher/SKILL.md §2.4/§3](../.claude/skills/dispatcher/SKILL.md));
> project goal — [README.md#why-this-exists](../README.md#why-this-exists).

## Role

You are a COLD design-altitude acceptance auditor. You never saw the design dialogue or
the implementation session — by construction. You answer ONE question: **is this diff WHAT
the kickoff/spec asked for?** You do NOT review code quality, style, or test depth — that
is the code-review altitude, already covered elsewhere.

## Inputs (paths/text only — never chat context, never implementation logs)

1. The kickoff/spec path (the sole statement of intent — if something was agreed but is
   not in this file, you cannot and must not know it).
2. The full 3-dot diff vs the base branch (text or a command to produce it).
3. The audited commit SHA (for the `Audited-SHA:` line) and the round number.

## Protocol

1. Read the kickoff/spec fully. Extract the deliverables list, the declared descopes
   (out-of-scope section), and any acceptance criteria.
2. Read the diff fully. Map every deliverable → evidence (file:line in the diff).
3. Report three drift lists, each entry with file:line evidence:
   - **missing** — asked in the kickoff, absent from the diff;
   - **extra** — present in the diff, not asked (scope creep; check the kickoff's
     out-of-scope section before flagging);
   - **diverged** — built, but differently than specified (state spec-said vs diff-does).
4. If a drift's root cause is the kickoff itself (ambiguous, self-contradictory, or
   missing a descope decision the diff clearly assumes), flag `KICKOFF-AMBIGUOUS`
   instead of grading the drift — that routes to re-design, not rework.

## Output grammar (mandatory, machine-consumed)

```text
FIDELITY: GO | REVISE | STOP
Basis: <kickoff/spec path>
Round: <n>
Audited-SHA: <commit sha>
Evidence: <file.ext:line — at least one line, even on GO>
[KICKOFF-AMBIGUOUS: <one-line reason>]
Findings: each graded BLOCKER | MAJOR | MINOR, with file:line
```

Verdict rule: any BLOCKER → STOP. Any MAJOR missing/diverged → REVISE. Only MINOR or
clean → GO. `extra` findings grade at most MAJOR (scope creep is rework, not stop).
Do not pad: an empty drift list is reported as empty, not filled.
````

- [ ] **Step 2: Verify principle 09 accepts the header**

Run: `npm test --workspace=@rules-as-tests/core --run -- 09-doc-authority`
Expected: PASS (dynamic `enumerateFlatRequiredDocs` picks up the new agent; header present → green).

- [ ] **Step 3: Commit**

```bash
git add agents/fidelity-auditor.md
git commit -m "feat(acceptance): fidelity-auditor cold agent — WHAT-conformance protocol (spec D2)"
```

### Task A2: `pr-body-fidelity` check module (TDD)

**Files:**
- Create: `packages/core/hooks/checks/pr-body-fidelity.ts`
- Test: `packages/core/hooks/checks/pr-body-fidelity.test.ts`

**Interfaces:**
- Produces: `checkPrBodyFidelity(input: { body: string; headSha: string }): { ok: boolean; errors: string[] }` — consumed by Task A3 bin.

- [ ] **Step 1: Write the failing test** (`pr-body-fidelity.test.ts`):

```ts
import { describe, expect, it } from 'vitest';
import { checkPrBodyFidelity } from './pr-body-fidelity.js';

const HEAD = 'a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0';
const goBody = (sha: string) => `## Summary\nx\n\n## Fidelity verdict\n\nFIDELITY: GO\nBasis: .claude/orchestrator-prompts/u/kickoff.md\nRound: 1\nAudited-SHA: ${sha}\nEvidence: packages/core/hooks/pre-push.ts:42\n\n## Parked questions\nnone\n`;

describe('checkPrBodyFidelity', () => {
  it('passes a complete GO block whose SHA matches head', () => {
    expect(checkPrBodyFidelity({ body: goBody(HEAD), headSha: HEAD }).ok).toBe(true);
  });
  it('passes a 12+-char SHA prefix', () => {
    expect(checkPrBodyFidelity({ body: goBody(HEAD.slice(0, 12)), headSha: HEAD }).ok).toBe(true);
  });
  it('passes skipped with rationale >=20 chars', () => {
    const body = '## Fidelity verdict\nFIDELITY: skipped — docs-only change, no kickoff applies\n';
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(true);
  });
  it('fails when the section is missing', () => {
    const r = checkPrBodyFidelity({ body: '## Summary\nx\n', headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/section/i);
  });
  it('fails skipped with short rationale (template default stays red)', () => {
    const body = '## Fidelity verdict\nFIDELITY: skipped — <fill>\n';
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(false);
  });
  it('fails a recorded REVISE verdict', () => {
    const body = '## Fidelity verdict\nFIDELITY: REVISE\nBasis: k.md\nRound: 1\n';
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(false);
  });
  it('fails GO whose Audited-SHA mismatches head (staleness guard)', () => {
    expect(checkPrBodyFidelity({ body: goBody('deadbeefdead'), headSha: HEAD }).ok).toBe(false);
  });
  it('fails GO without file:line evidence', () => {
    const body = `## Fidelity verdict\nFIDELITY: GO\nBasis: k.md\nRound: 1\nAudited-SHA: ${HEAD}\n`;
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --workspace=@rules-as-tests/core --run -- pr-body-fidelity`
Expected: FAIL — `Cannot find module './pr-body-fidelity.js'`.

- [ ] **Step 3: Implement** (`pr-body-fidelity.ts`):

```ts
/**
 * PR-body arm of the acceptance-contour fidelity gate (spec:
 * docs/superpowers/specs/2026-07-23-acceptance-contour-design.md D3).
 * Deterministic form check — the semantic verdict is produced in-session by
 * agents/fidelity-auditor.md (no-paid-llm-in-ci). Sibling of pr-body-prior-art.ts.
 */
export interface FidelityCheckInput { body: string; headSha: string; }
export interface FidelityCheckResult { ok: boolean; errors: string[]; }

const SKIPPED_RE = /^FIDELITY:\s*skipped\s*[—-]+\s*(.+)$/m;
const GO_RE = /^FIDELITY:\s*GO\s*$/m;
const NON_GO_RE = /^FIDELITY:\s*(REVISE|STOP)\b/m;
const BASIS_RE = /^Basis:\s*\S+/m;
const ROUND_RE = /^Round:\s*\d+\s*$/m;
const SHA_RE = /^Audited-SHA:\s*([0-9a-fA-F]{12,40})\s*$/m;
const EVIDENCE_RE = /[\w./-]+\.[A-Za-z]{1,6}:\d+/;

function extractSection(body: string): string | null {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+Fidelity verdict\s*$/.test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n');
}

export function checkPrBodyFidelity({ body, headSha }: FidelityCheckInput): FidelityCheckResult {
  const errors: string[] = [];
  const section = extractSection(body);
  if (section === null) {
    return { ok: false, errors: ['missing `## Fidelity verdict` section (see spec D3; agents/fidelity-auditor.md)'] };
  }
  const skipped = section.match(SKIPPED_RE);
  if (skipped) {
    if (skipped[1].trim().length < 20) errors.push('skipped rationale must be >=20 chars');
    return { ok: errors.length === 0, errors };
  }
  if (NON_GO_RE.test(section)) {
    return { ok: false, errors: ['non-GO FIDELITY verdict recorded — resolve the rework loop before merge'] };
  }
  if (!GO_RE.test(section)) {
    return { ok: false, errors: ['no `FIDELITY: GO` or `FIDELITY: skipped — <rationale>` line found'] };
  }
  if (!BASIS_RE.test(section)) errors.push('GO requires `Basis: <kickoff/spec path>`');
  if (!ROUND_RE.test(section)) errors.push('GO requires `Round: <n>`');
  const sha = section.match(SHA_RE);
  if (!sha) {
    errors.push('GO requires `Audited-SHA: <12-40 hex>`');
  } else if (!headSha.toLowerCase().startsWith(sha[1].toLowerCase())) {
    errors.push(`Audited-SHA ${sha[1]} does not match PR head ${headSha} — re-run the fidelity audit on the current head`);
  }
  if (!EVIDENCE_RE.test(section)) errors.push('GO requires >=1 file:line evidence reference');
  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test --workspace=@rules-as-tests/core --run -- pr-body-fidelity`
Expected: 8 passed.

- [ ] **Step 5: Commit** (module + test together; the `Prior-art:` trailer rides the Task A4 squash-surviving PR body AND this commit):

```bash
git add packages/core/hooks/checks/pr-body-fidelity.ts packages/core/hooks/checks/pr-body-fidelity.test.ts
git commit -m "feat(acceptance): pr-body-fidelity deterministic check (spec D3)

Prior-art: <see Task A4 step 5 — cite the SSOT entry id resolved there>"
```

### Task A3: workflow + bin

**Files:**
- Create: `packages/core/hooks/checks/pr-body-fidelity-bin.ts`
- Create: `.github/workflows/pr-body-fidelity.yml`

**Interfaces:**
- Consumes: `checkPrBodyFidelity` from Task A2.

- [ ] **Step 1: Write the bin** (`pr-body-fidelity-bin.ts`):

```ts
/** CI entrypoint — env in, exit code out (sibling of pr-body-prior-art-bin.ts). */
import { checkPrBodyFidelity } from './pr-body-fidelity.js';

const baseRef = process.env.BASE_REF ?? '';
if (baseRef !== 'staging') {
  // Defense-in-depth: the workflow-level `if:` already scopes to staging (spec D3/m3).
  console.log(`pr-body-fidelity: base '${baseRef}' out of scope (staging only) — pass`);
  process.exit(0);
}
const result = checkPrBodyFidelity({
  body: process.env.PR_BODY ?? '',
  headSha: process.env.HEAD_SHA ?? '',
});
if (result.ok) { console.log('pr-body-fidelity: OK'); process.exit(0); }
console.error('pr-body-fidelity: FAIL');
for (const e of result.errors) console.error(`  - ${e}`);
process.exit(1);
```

- [ ] **Step 2: Write the workflow** (`.github/workflows/pr-body-fidelity.yml`):

```yaml
name: pr-body-fidelity

# Fail-closed acceptance gate (spec D3, docs/superpowers/specs/2026-07-23-acceptance-
# contour-design.md): every base=staging PR carries a `## Fidelity verdict` section —
# either a GO block from agents/fidelity-auditor.md (Audited-SHA must equal PR head)
# or `FIDELITY: skipped — <rationale >=20 chars>`. Deterministic (no paid LLM per
# .claude/rules/no-paid-llm-in-ci.md); unfiltered events on the pr-body-prior-art.yml
# model (#1098) — a paths: filter would un-fail-close tier-0/docs PRs.
# Promote-flow safety: base=main PRs never run this job (workflow if:) AND the check
# is registered as required ONLY in the staging branch-protection set (primary
# exemption — spec D3/m3). Paired tests: pr-body-fidelity.test.ts.

on:
  pull_request:
    types: [opened, edited, synchronize, reopened]

permissions:
  contents: read
  pull-requests: read

jobs:
  fidelity-verdict-in-pr-body:
    name: staging PR carries Fidelity verdict (fail-closed acceptance)
    runs-on: ubuntu-latest
    if: github.event.pull_request.base.ref == 'staging'
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
        with:
          persist-credentials: false
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.4.0
        with:
          node-version: '22'
      - name: Install packages/core deps (tsx runtime)
        run: npm ci --prefix packages/core --silent
      - name: Validate Fidelity verdict section against PR head
        env:
          PR_BODY: ${{ github.event.pull_request.body }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
          BASE_REF: ${{ github.event.pull_request.base.ref }}
        run: npx --prefix packages/core tsx packages/core/hooks/checks/pr-body-fidelity-bin.ts
```

- [ ] **Step 3: Smoke the bin locally**

```bash
BASE_REF=staging HEAD_SHA=a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0 PR_BODY='## Fidelity verdict
FIDELITY: skipped — local smoke test of the new gate bin' npx --prefix packages/core tsx packages/core/hooks/checks/pr-body-fidelity-bin.ts
```
Expected: `pr-body-fidelity: OK`, exit 0. Then rerun with `PR_BODY='x'` → `FAIL` + exit 1.

- [ ] **Step 4: Lint the workflow**

Run: `actionlint .github/workflows/pr-body-fidelity.yml && zizmor .github/workflows/pr-body-fidelity.yml`
Expected: no findings (env-var body passing mirrors the #1098 pattern; actions SHA-pinned).

- [ ] **Step 5: Commit**

```bash
git add packages/core/hooks/checks/pr-body-fidelity-bin.ts .github/workflows/pr-body-fidelity.yml
git commit -m "feat(acceptance): pr-body-fidelity CI gate — unfiltered, staging-scoped (spec D3)"
```

### Task A4: PR template + SSOT + PR-A

**Files:**
- Modify: `.github/pull_request_template.md` (insert BEFORE `## §1.7 Self-discipline check` — spec D4/awk rationale)
- Modify: `docs/meta-factory/prior-art-evaluations.md` (SSOT entry)

- [ ] **Step 1: Insert into the template**, immediately before the `## §1.7 Self-discipline check (REQUIRED if PR touches discipline-bearing files)` line:

```markdown
## Provenance

<stage PRs: kickoff/spec path · base SHA · substrate (aif task <id> + bridge-profile <name> | in-session) · models per stage · fidelity Round. Non-stage PRs: n/a>

## Review findings

<stage PRs: factory review outcome + cold code-review summary (+ plan spot-check during the D1 calibration window). Non-stage PRs: n/a>

## Fidelity verdict

FIDELITY: skipped — <fill>

<!-- The default above FAILS the pr-body-fidelity gate on purpose (<20 chars).
Non-stage PR: complete the rationale (>=20 chars), e.g. "docs-only change, no kickoff applies".
Stage PR: replace with the agents/fidelity-auditor.md output block:
FIDELITY: GO / Basis: <path> / Round: <n> / Audited-SHA: <PR head sha> / Evidence: <file.ext:N> -->

## Parked questions

<stage PRs: each parked question + resolution, or `none`. Non-stage PRs: n/a>
```

- [ ] **Step 2: Verify the §1.7 awk boundary is untouched** — the four new `##` H2 sections sit before the `### §1.7` H3 headers, so `discipline-self-check.yml:62-66` capture semantics are unchanged. Run: `grep -n '^## \|^### §1.7' .github/pull_request_template.md` and confirm all four new H2 lines appear before both `### §1.7` lines.

- [ ] **Step 3: SSOT entry.** In `docs/meta-factory/prior-art-evaluations.md`, per its §3 append convention, add the next-numbered entry: capability = "PR-body fidelity acceptance gate"; Verdict **BUILD** (in-repo reuse of the #1098 pr-body gate pattern; upstream CI plugins for PR-body validation exist but cannot host the cold-agent semantic layer — the deterministic arm is trivially small and pattern-locked to the repo's §1.7/Prior-art gate family); Rationale + Trigger to revisit ("a GitHub-native required-review-artifact primitive ships"). Then amend the Task A2 commit's `Prior-art:` line via the PR body (squash-surviving) to cite this entry id.

- [ ] **Step 4: Commit**

```bash
git add .github/pull_request_template.md docs/meta-factory/prior-art-evaluations.md
git commit -m "feat(acceptance): PR template acceptance-package sections + SSOT entry (spec D4)"
```

- [ ] **Step 5: PR-A.** Run `bash scripts/run-local-ci-sweep.sh`; expected: green (branch-introduced reds ⇒ STOP and fix). **Dogfood:** dispatch `agents/fidelity-auditor.md` (cold subagent) with Basis = the spec path + diff `git diff origin/staging...HEAD`, Round 1, current HEAD sha → paste the GO block into the PR body `## Fidelity verdict`. PR body also carries: `Prior-art:` line citing the Task A4 SSOT entry (the squash-surviving arm, #1098 gate will check it), §1.7 **Skipped** line (Phase A adds a gate implementation, not a new rule text — mechanical arm of an already-specced discipline; if the reviewer disagrees, switch to the Forward+Backward pair citing spec D3). `gh pr create --base staging` + auto-merge per convention. **Operator items surfaced in the PR body:** register `fidelity-verdict-in-pr-body` as required ONLY in staging branch protection AFTER verifying skipped-conclusion behavior on a throwaway PR (spec D3/m3); grandfather in-flight PRs with a one-line `FIDELITY: skipped — pre-gate PR, opened before fidelity gate landed`.

---

## Phase B — choreography wiring (PR-B; base on PR-A's branch or land after PR-A merges)

### Task B1: `/harvest` §4 restructure

**Files:**
- Modify: `.claude/skills/harvest/SKILL.md:64-68` (§4)

- [ ] **Step 1: Replace §4** — retitle to `## §4 — Cold-review + fidelity + PR` and renumber steps: keep step 1 (cold-QA via `superpowers:requesting-code-review`) verbatim; insert new step 2:

```markdown
2. **Fidelity verdict (design altitude — spec D2).** Dispatch
   [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md) as a cold read-only
   subagent: inputs = the stage kickoff/spec path + the same 3-dot diff, current HEAD sha,
   round number — nothing else (no chat, no logs). `REVISE`/`STOP` → do NOT open the PR;
   factory task → route the findings per [/dispatcher §2.4 rework loop](../dispatcher/SKILL.md),
   in-session work → fix and re-audit (Round 2); cap 2 rounds → escalate to the operator.
   `KICKOFF-AMBIGUOUS` → escalate to `/arch` §4 office hours without burning a round.
   `GO` → the verdict block (Basis/Round/Audited-SHA = current HEAD/Evidence) goes into the
   PR body `## Fidelity verdict` section — the `pr-body-fidelity` CI gate blocks merge without it.
```

Old step 2 (assemble §1.7 body + `gh pr create`) becomes step 3 — extend its first sentence: "Assemble a **§1.7-compliant PR body** … **plus the acceptance-package sections (Provenance / Review findings / Fidelity verdict / Parked questions — spec D4)**." Old step 3 (confirm diff) becomes step 4, verbatim. Update the header line `**Authoritative for:** … §4 cold-review + PR` → `§4 cold-review + fidelity + PR`.

- [ ] **Step 2: Check length + commit**

Run: `wc -l .claude/skills/harvest/SKILL.md` — expected ≤600.
```bash
git add .claude/skills/harvest/SKILL.md
git commit -m "feat(acceptance): /harvest §4 — fidelity verdict step before PR creation (spec D2)"
```

### Task B2: `/dispatcher` §2.4 pre-egress gate + §3 routing table

**Files:**
- Modify: `.claude/skills/dispatcher/SKILL.md` (§2.4 at line ~107; §3 after the Park-type taxonomy table, line ~180)

- [ ] **Step 1: Insert into §2.4**, after the "Pre-push sweep gate" block and BEFORE the `tsx …/harvest.ts <taskId> --base staging` command block:

````markdown
**Pre-egress fidelity gate (design altitude — spec D2/D6).** `harvest.ts` creates the PR and
queues auto-merge inside one binary, so the fidelity seam is HERE, before invoking it.
Dispatch [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md) cold: inputs = the
stage kickoff path + the container diff (read-only; in-container `origin/staging` is the
established §2.4/harvest-§1 inspect pattern; 3-dot tolerates a stale base):

```bash
docker exec aif-handoff-agent-1 git -C <worktree> diff origin/staging...HEAD
```

- `GO` → record the block (Basis/Round/Audited-SHA = container HEAD/Evidence) into the
  prepared PR body (pass via `--body-file` — without the section the `pr-body-fidelity`
  gate holds the PR red) and proceed to `harvest.ts`.
- `REVISE` → **no egress, no PR**: `tsx packages/runtime-bridge/src/cli/answer.ts --task <id>
  --answer "<auditor findings>" --decision request_changes` → task returns to `implementing`;
  the next harvest attempt audits as `Round: 2`. **Cap 2 rounds:** round-2 REVISE → STOP —
  do not resume; emit an escalation block (task id + both rounds' findings) in the report.
- `KICKOFF-AMBIGUOUS` → escalate to `/arch` §4 office hours immediately (a broken kickoff
  wastes both rework rounds). `STOP` → escalate immediately.
- Calibration window (spec D1): while merged staging PRs whose `## Review findings` contains
  `Plan spot-check:` number <5, also run a top-tier read-only spot-check of the task's plan
  (`GET /tasks/:id` → `plan`) and record it in `## Review findings`.
````

- [ ] **Step 2: Add to §3**, right after the Park-type taxonomy table:

```markdown
### Routing seats (who answers which class — spec D5)

| Question class | Day | Night (unattended) |
| --- | --- | --- |
| technical / in-scope (implementation choice within kickoff bounds) | this dispatcher session resolves autonomously (brainstorm → `answer.ts`); decision recorded in the task comment + PR `## Parked questions` | same — autonomous |
| intent / goal / design (changes WHAT to build) | `/arch` §4 office hours, top seat | **stay parked — never guess**; morning batch sweep (`questions.ts --project`) |
| environment (container/tooling broken) | `/aif-doctor` | `/aif-doctor` non-destructive arm; else stay parked |
```

- [ ] **Step 3: Check length + commit**

Run: `wc -l .claude/skills/dispatcher/SKILL.md` — expected ≤600 (currently 254; ~+40).
```bash
git add .claude/skills/dispatcher/SKILL.md
git commit -m "feat(acceptance): /dispatcher pre-egress fidelity gate + Q&A routing seats (spec D2/D5/D6)"
```

### Task B3: night-mode + `/arch` §3 edits

**Files:**
- Modify: `.claude/skills/night-mode/SKILL.md:33`
- Modify: `.claude/skills/arch/SKILL.md:59` (§3 factory-bound row)

- [ ] **Step 1: night-mode.** In the line-33 "Loop until:" sentence, extend the PR-body-gates parenthetical: after `a new capability file needs a \`Prior-art:\` trailer — principle 11 F1 enforces it at pre-push` append `; a stage PR additionally carries the \`## Fidelity verdict\` GO block from a cold [\`agents/fidelity-auditor.md\`](../../../agents/fidelity-auditor.md) run on spec+diff before \`gh pr create\` — the completeness-critic stays the deep in-loop check; the fidelity run is the cold boundary gate-grammar producer (spec D2)`.

- [ ] **Step 2: /arch §3.** In the factory-bound route row, replace `classify Tier 1 vs Tier 2 per [CLAUDE.md «Task-tier routing»](../../../CLAUDE.md) and author the kickoff accordingly (traps section per principle 12; the Tier-1 profile marker per that table)` with: `classify per [CLAUDE.md «Task-tier routing»](../../../CLAUDE.md) and author the kickoff (traps per principle 12). A kickoff that passed this contour's §2 review carries the \`<!-- bridge-profile: <executor-profile-name> -->\` marker REGARDLESS of tier — the design judgment was spent here — PROVIDED it is plan-complete: it encodes the decomposition-relevant decisions AND every descope from the dialogue (the fidelity auditor's sole truth — spec D1/D2). Not plan-complete → no marker (top tier plans in aif). Marker value = the UNIQUE profile display name`.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/night-mode/SKILL.md .claude/skills/arch/SKILL.md
git commit -m "feat(acceptance): night-mode fidelity PR-gate + /arch always-marker plan-complete rule (spec D1/D2)"
```

### Task B4: CLAUDE.md Tier-2 amendment + PR-B

**Files:**
- Modify: `CLAUDE.md` («Task-tier routing» section)

- [ ] **Step 1: Amend the criteria table row** for Tier 2 — replace `| 2 — bulky-complex | the plan requires a design decision: new module/architecture, data-model or API-shape choice, cross-cutting consequences, unknown root cause needing investigation, «is this the right approach» is open | top tier | kickoff, no marker (project defaults) |` with `| 2 — bulky-complex | the plan requires a design decision: new module/architecture, data-model or API-shape choice, cross-cutting consequences, unknown root cause needing investigation, «is this the right approach» is open | top tier — unless the kickoff came through /arch plan-complete (judgment already spent) → executor tier | /arch-reviewed plan-complete kickoff → WITH marker (see [/arch §3](.claude/skills/arch/SKILL.md)); otherwise kickoff, no marker (project defaults) |`

- [ ] **Step 2: Amend the prose** — in the «Two questions, three tiers» item 2 YES-branch, after `→ **TIER 2 — bulky-complex.** Dispatch **without** the marker → project defaults apply: the **top tier plans**, the executor tier implements and reviews from below.` append: ` **Exception (acceptance-contour spec D1):** a Tier-2 kickoff produced by `/arch` AND plan-complete (decomposition decisions + all descopes encoded) dispatches **with** the marker — the whole pipeline runs on the executor tier; the fail-closed fidelity gate at the exit boundary covers the WHAT, and the first-5-tasks calibration spot-check covers the plan HOW.`

- [ ] **Step 3: Length check + commit**

Run: `wc -l CLAUDE.md` — expected ≤600.
```bash
git add CLAUDE.md
git commit -m "feat(acceptance): Tier-2 routing amendment — /arch plan-complete kickoffs run executor-tier pipeline (spec D1)"
```

- [ ] **Step 4: PR-B.** `bash scripts/run-local-ci-sweep.sh` green + `make self-audit` green. Dogfood: cold `agents/fidelity-auditor.md` run (Basis = the spec, diff = 3-dot, Round 1, HEAD sha) → GO block into PR body. PR body: §1.7 **Forward+Backward pair** (CLAUDE.md + skills are discipline-bearing; cite spec D1 file:lines + the swept sibling surfaces: harvest/dispatcher/night-mode/arch SKILL.md edits), acceptance-package sections filled for real (Provenance: in-session, this plan; Review findings: the two-altitude spec review verdicts; Parked questions: none). `gh pr create --base staging`.

---

## Post-merge operator items (not tasks — surfaced in both PR bodies)

1. Register `fidelity-verdict-in-pr-body` as required in **staging** branch protection only, after the throwaway-PR skipped-behavior check (spec D3/m3).
2. aif review cap 3→5 (`env.ts:113` env knob in the aif deployment).
3. Optional `~/.claude/hooks/git-safety.sh` Fidelity mirror (operator-owned global).
4. Validation runs per spec D9: Run 0 (tiny Tier-1 marker task — SDK transport + marker), then Run 1 (full acceptance loop).

## Self-review (done at authoring)

- Spec coverage: D1→B3/B4+A4-dogfood-calibration note in B2; D2→A1/B1/B2/B3; D3→A2/A3+operator item 1; D4→A4/B1; D5→B2; D6→B2/B1; D7→existing auto-merge + gate (no code needed); D8→no artifact (accepted layout); D9→operator item 4. §4 config→operator items 2-3. §5 surfaces 1-8 all mapped (surface 8: no `.claude/rules/` touched → no regen).
- No placeholders; interfaces consistent (`checkPrBodyFidelity`, grammar strings identical across A1/A2/B1/B2).
- Type check: `FidelityCheckInput/Result` used only in A2/A3; grammar tokens (`FIDELITY:`, `Basis:`, `Round:`, `Audited-SHA:`) byte-identical in agent, tests, template comment, and skill edits.
