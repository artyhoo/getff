# Token/context-economy research — design (2026-08-01)

> **Status:** approved-in-dialogue design, brainstorm session 2026-08-01 (seed:
> `~/.claude-coordination/rules-as-tests-aif/session-seed-2026-08-01-token-economy-research.md`).
> **Umbrella owner:** arch-v2-context-pipeline (already open — owns token/context economy).
> This research does NOT open a new umbrella; its output is research-patch material feeding
> new stages of that umbrella.

## Goal

Reduce spend of the EXPENSIVE model tiers — Fable (operator's interactive seat) and Opus
(top-tier seats inside the aif pipeline). Wallet priority set by the operator 2026-08-01:

1. Operator interactive sessions (Fable) — primary.
2. aif pipeline top-tier seats (Opus) — included in scope.
3. Shipped axis (consumer token economy) — explicitly OUT of scope; later chapter.

## The funnel (itself a token-economy pattern)

1. **aif executor tier (GLM)** — bulk research work; nothing expensive burns here.
2. **Opus** — distillation: compress raw material into a verdict-ready brief.
3. **Fable + operator** — final decisions ONLY on the distilled brief; raw material never
   reaches Fable. This rule is stated explicitly in every kickoff.

## Work items

### Task A — token-profile measurement (Tier 1, executor, WITH bridge-profile marker)

- **Host-side prep (dispatching session, before dispatch):** run a cheap deterministic
  aggregator script over real session transcripts in `~/.claude/projects/` — per-message
  metadata only (sizes by role/type: always-on injections, tool outputs, model text, file
  reads), NO content — and commit the aggregates to the task's branch. Containers cannot see
  the host's `~/.claude/projects/` (destination-environment-verification doctrine).
- **Task deliverable (raw):** a token-spend profile: weights of always-on context × prompt
  count, tool outputs, file reads, transcript accumulation; ranked head-vs-tail list.
- **Why Tier 1:** the "how" is determined (analyze committed aggregates); volume, not design.

### Task B — candidate survey (Tier 1 gathering, WITH bridge-profile marker)

- **Seed candidates:** RTK (`rtk-ai/rtk` CLI output-filter proxy); progressive-disclosure
  gaps (CLAUDE.md fully always-on, MEMORY.md index, session-bootstrap injection per prompt,
  PR-template guidance blocks); Claude Code context-editing/compaction features; the
  engineering-plugin prior-art verdict (aif task `53c2ecdd`, in flight — one input chapter,
  not a blocker).
- **Per candidate:** BFR §3 six-item sweep (WebSearch ≥3 phrasings + DeepWiki + SSOT consult),
  two-axis verdict (operator vs shipped), seven-verdict vocabulary. Savings estimates must
  bind to Task A's measured profile once available (B starts in parallel; final ranking waits
  for A's numbers).
- **Deliverable (raw):** full candidate catalogue with sweeps + provisional verdicts.

### Stage 3 — Opus distillation

- **Input:** raw material from A and B.
- **Output:** THE final research-patch under `docs/meta-factory/research-patches/`,
  referencing arch-v2-context-pipeline: ranked lever list with A's numbers, B's verdicts,
  proposed next umbrella stages. This is the only artifact Fable/operator read.
- **Mechanics (open, resolved at kickoff-authoring time):** separate third aif task vs
  review-seat attached to B — decided by dispatch mechanics, not a design fork.

## Constraints

- Research output only: research-patches / kickoff proposals — no code, no new capabilities,
  no new SSOT-bypassing artifacts.
- Kickoffs authored per dispatch-input contract v2 (PR #1198) with `bridge-profile` markers
  per CLAUDE.md «Task-tier routing» (marker value = unique profile display name).
- Baseline-first discipline: no "X is expensive" verdict without A's measured numbers (T20).
- Operator PR-hygiene (2026-08-01): PRs only for what must land on staging; batch by concern.

## Not doing

- No new umbrella; no shipped-axis work; no implementation of any candidate (that is a
  future stage decided from the distilled patch); no re-derivation of already-measured facts
  (cold-seat-economy §3 table, tier routing, token-audit S2).
