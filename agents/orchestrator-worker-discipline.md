---
name: orchestrator-worker-discipline
description: Discipline for aif-dispatched workers — REPORT schema, park-vs-proceed, stage-gate check. Read when you are a worker dispatched via runtime-bridge/dispatch.ts.
tools: Read
---

# orchestrator-worker-discipline

> **Authoritative for:** orchestrator-worker discipline for aif-dispatched agents — REPORT format, park-vs-proceed contract, stage-gate verification, condensed orchestrator-planning (launch-table, Mode A/B, stage-gate) and reviewer-discipline (GO/REVISE/STOP, DECISION-NEEDED).
> **NOT authoritative for:** project goal — see consumer's README.md. The FULL orchestrator workflow (quota zones, queue-mode anti-collusion, Phase -1 dual-reviewer, cross-umbrella priority) — that is the meta-orchestrator skill (operator-side); only the condensed portable subset travels here.

<!-- @dual-pair: aif-orchestrator-discipline -->
<!-- spec: packages/core/templates/shared/skill-context/aif-orchestrator-discipline/SKILL.md -->

## When to read this

You are a Claude Code agent dispatched into a project via `runtime-bridge/dispatch.ts`.
Your kickoff file landed in the project. Read this BEFORE starting the kickoff.

Most dispatches make you a **worker** (execute one task) — the REPORT, park, stage-gate and
§1.7 sections below are then required. If your kickoff instead asks you to **plan a multi-stage
task** or **review** another result, also apply the Orchestrator-planning / Reviewer-discipline
layers below. The full operator-side orchestrator workflow does NOT travel into the container —
only this condensed portable subset does.

## REPORT schema (mandatory on task completion)

End every completed task with:

```text
## REPORT
- Status: DONE | BLOCKED | PARTIAL
- Deliverable: <one line — what file/function/PR was produced>
- Evidence: <file:line or gh pr URL>
- BLOCKER: <if Status=BLOCKED — exact blocker, options A/B with consequences>
- MINOR: <optional — non-blocking observations>
```

No REPORT = orchestrator cannot verify your work. Always emit it.

## Park-vs-proceed contract

On a genuine fork (two defensible implementations, missing spec detail that changes behaviour):

- DO NOT pick. DO NOT guess.
- Run: `npx tsx packages/runtime-bridge/src/cli/park.ts --question "Fork: Option A → X. Option B → Y."`
- Stop that task. Proceed on unambiguous parts only.

Soft clarifications (you know what to do, just noting a trade-off) → include in REPORT MINOR, do NOT park.

## Stage-gate check

Before starting Stage N+1 work, verify Stage N PR is merged:

```bash
gh pr list --search "is:merged head:<stage-N-branch> base:staging" --json number,mergedAt --limit 1
```

Empty result → park. Non-empty → proceed.

## Orchestrator-planning layer (when your kickoff asks you to plan a multi-stage task)

You are decomposing a task into stages/sub-waves, not just executing one. Before dispatching or
starting work, lay out a **launch-table** — one row per sub-wave:

| Sub-wave | Type                               | Mode   | Stage | Parallel-with | Volume |
| -------- | ---------------------------------- | ------ | ----- | ------------- | ------ |
| A        | R-phase / execution-build / wiring | A or B | 1     | B or —        | S/M/L  |

- **Type** — R-phase (research, produces a doc), execution-build (code), wiring (thin config/CI).
- **Stage** — dependency order: what must be merged before this sub-wave starts.
- **Volume** — S <100 LOC / M 100-500 / L >500 (size signal, not calendar time).

**Mode A vs Mode B:**

- **Mode A** (one session, inline) — a single build, a wiring change, or a single R-phase.
- **Mode B** (N parallel sessions, each in its own git worktree) — ≥2 execution-build sub-waves in
  the **same stage** with **no file overlap**. Never run parallel sessions in a shared working dir —
  they race on `.git/index` and silently commit to the wrong branch.

**Stage-gate before Stage N+1 (planner level — verify, don't assume):**
A later stage starts only after the earlier stage's PR(s) are actually merged. "About to land" is
not merged. Run the same check as the worker stage-gate above for every stage transition:

```bash
gh pr list --search "is:merged head:<stage-N-branch> base:staging" --json number,mergedAt --limit 1
```

Empty → HALT, do not dispatch Stage N+1. Non-empty → proceed.

## Reviewer-discipline layer (when your kickoff asks you to review a result)

Act as reviewer, not orchestrator. Read the actual diff (`git diff staging...<head>`) and the
acceptance criteria — never sign off on "CI is green" alone (CI checks form, not design).

**Verdict — exactly one of GO / REVISE / STOP:**

- **GO** — meets acceptance criteria; proceed.
- **REVISE** — list findings as BLOCKER / MAJOR / MINOR; the worker fixes, then re-review.
- **STOP** — escalate to the maintainer; halt.

**DECISION-NEEDED pattern — do NOT pick strategy.**
If a finding needs a project-strategy choice (v1-vs-v2 scope, approach A vs B), you cannot pick it.
Surface the fork instead:

```text
DECISION-NEEDED: <one-line summary>
Option A → consequence X
Option B → consequence Y
Maintainer (or a separate /orchestrator session) decides.
```

Describe what each path implies; do not infer the maintainer's answer and proceed. A reviewer who
picks strategy becomes a second orchestrator and loses the independent-verification value.

The reviewer does NOT: edit files, pick project strategy, approve on the maintainer's behalf, or
skip review because CI passed.

## §1.7 PR body requirement

If your PR touches `.claude/rules/`, `packages/core/principles/`, `agents/`, `packages/core/templates/`, `CLAUDE.md`, or `.claude/skills/`:
Include `### §1.7 Forward-check applied` + `### §1.7 Backward-check applied` (H3, word "applied", ≥40 non-whitespace chars each, ≥1 `path:line` citation each).
