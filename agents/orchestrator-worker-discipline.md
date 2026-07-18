---
name: orchestrator-worker-discipline
description: Discipline for aif-dispatched workers — REPORT schema (incl. advisor-consult sub-form on BLOCKER), park-vs-proceed, stage-gate check. Read when you are a worker dispatched via runtime-bridge/dispatch.ts.
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
- BLOCKER: <if Status=BLOCKED — exact blocker, options A/B with consequences. Supports `advisor-consult:` prefix for judgment-call escalations — see "Advisor-consult protocol" below>
- MINOR: <optional — non-blocking observations>
```

No REPORT = orchestrator cannot verify your work. Always emit it.

## Park-vs-proceed contract

On a genuine fork (two defensible implementations, missing spec detail that changes behaviour):

- DO NOT pick. DO NOT guess.
- Run: `npx tsx packages/runtime-bridge/src/cli/park.ts --question "Fork: Option A → X. Option B → Y."`
- Stop that task. Proceed on unambiguous parts only.

Soft clarifications (you know what to do, just noting a trade-off) → include in REPORT MINOR, do NOT park.

## Advisor-consult protocol (BLOCKED on a non-obvious judgment call)

Sometimes you are blocked not by a missing dependency or a hard conflict, but by a **non-obvious design / architectural judgment** where a stronger reasoner's opinion would unblock you. Examples: «is approach A or B more aligned with the existing pattern?», «does this edge case warrant a new test or am I over-engineering?», «the work is done but the design feels off — sanity check before DONE».

This is **not** for: routine clarifications (→ MINOR field, proceed), missing specs / hard conflicts (→ regular BLOCKED with options A/B), genuine owner forks (→ `park.ts` per the contract above — the advisor cannot pick owner strategy either), or laziness («I don't want to decide» → just decide).

### Sub-form — uses the existing `BLOCKER` field, no schema extension

Use `Status: BLOCKED` with a `BLOCKER:` value that starts with the `advisor-consult:` prefix. The coordinator routes on that prefix — it is the signal:

```text
## REPORT
- Status: BLOCKED
- Deliverable: <what you produced so far>
- Evidence: <file:line or git branch with your work committed>
- BLOCKER: advisor-consult: <one-line question, concretely>. Context: <up to 3 file:line refs the advisor must read>. My lean: <A | B | genuinely-unsure>.
- MINOR: <optional>
```

The `advisor-consult:` prefix is the only load-bearing syntax. The rest is freeform natural language for the advisor to read. **Do not** invent a new `Status:` value or a new top-level REPORT field — the prefix is the entire signal, and it lives inside the existing schema (reviewer-discipline: do not invent new syntax).

### Coordinator routing (dispatch on `BLOCKER: advisor-consult:` prefix)

Assumes the coordinator is Claude-family (Opus or Sonnet). **GLM-5.2 as coordinator is out of scope** — parsing the prefix, routing on it, and dispatching an advisor subagent are tool-call-reliability claims that are unproven for GLM (see `.claude/skills/claude-glm-executor-handoff/SKILL.md` §5). Keep GLM worker-only.

| Coordinator's own tier                                | Action                                                                                                                                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Top tier** (Opus / Fable / harness's most-capable)  | Answer the consult yourself in the next dispatch — you ARE the advisor. Re-dispatch the worker carrying the advice in `<context>`.                                                             |
| **Weaker Claude tier** (Sonnet / Haiku / etc.)        | Dispatch a separate advisor agent (top-tier model — e.g. `.claude/agents/opus-advisor.md` if it exists) with the question + context; re-dispatch the worker carrying the reply in `<context>`. |
| **Single-tier harness** (no stronger model available) | A fresh-context same-tier second opinion — different context catches different things, even at the same capability tier.                                                                       |

The advisor's reply is **focused advice** (target ≤80 words), not a re-implementation. The worker carries the advice with weight but adapts if it empirically fails or a primary source contradicts it. On evidence-vs-advice conflict, reconcile in **one more** consult — do not silently switch.

### Caps

- **Per task:** max **2** advisor-consult cycles. On the 3rd, the task is genuinely under-specified — escalate via regular BLOCKED with `BLOCKER: under-specified: <one-line>` and stop.
- **Spare the consult:** highest value once before committing to an approach, and once before declaring done. Not on trivial reactive steps.

### Relationship to night-mode's advisor strategy

[`.claude/skills/night-mode/SKILL.md`](../.claude/skills/night-mode/SKILL.md) delta item 7 defines the advisor pattern for **unattended overnight runs** (executor returns `NEEDS_ADVISOR` note; coordinator dispatches a top-tier subagent; `NEEDS_ADVISOR` is a night-mode convention, NOT one of SDD's standard statuses). This protocol is the **same strategy** generalised to any aif-dispatch — using the existing `BLOCKED` status with a `BLOCKER: advisor-consult:` sub-form instead of a new status, so the REPORT schema here is not extended. For overnight runs, follow night-mode's `NEEDS_ADVISOR` convention directly; this protocol applies to interactive / non-overnight dispatch.

### Honest gap — designed-not-proven

Whether workers will **reliably emit** the `advisor-consult:` prefix (vs. regular BLOCKED) and whether coordinators will **reliably route** on it are **assumed from the function-calling spec, not tested**. Treat as a convention under trial; promote to a hardened contract only after a live probe records ≥3 dispatches where the prefix was emitted and routed correctly.

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
