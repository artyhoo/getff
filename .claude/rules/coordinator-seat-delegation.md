---
description: Coordinator seat delegates the mechanical pipeline (aif polling, harvest, PR body, CI wait, merge) to a standalone chip worker
paths:
  - ".claude/skills/orchestrator/**"
events:
  - 'harvest\.ts'
  - 'harvest-via-api\.sh'
  - '(post-harvest|babysit)\.sh'
  - '(localhost|127\.0\.0\.1):3009/tasks'
---

# Coordinator seat delegation — discipline rule

<!-- inject: Coordinator seat? The mechanical pipeline (aif polling, harvest, PR body, CI wait, merge) goes to a standalone chip worker with a REPORT contract — not to you, and not to an in-session Agent. A chip worker running its own recipe proceeds. -->

> **Class:** C — prose + a deterministic injection, no gate. Whether the current session *is* a coordinator seat is a judgment the harness cannot observe (no seat marker exists — the session-bus registry that would carry one is Part-II, probe-gated), so blocking the commands would also block the chip worker whose job they are (`#gate-where-judgment-needed`, [rule-enforcement-channel-selection.md §5](rule-enforcement-channel-selection.md)). Channel: CC-native `paths:` (read-time, orchestrator skill) plus the `events:` arm of [`inject-matching-rule.sh`](../hooks/inject-matching-rule.sh) — PreToolUse Bash, already registered, once per session. Promotion criterion in §3.
> **Fires:** a coordinator seat about to poll aif, harvest a stage, draft a PR body, wait on CI or merge.
> **Authoritative for:** the seat-vs-worker split — §1 the rule, §2 anti-patterns, §3 promotion / retirement.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). The chip-worker prompt and its REPORT contract — see [orchestrator references/chip-worker-template.md](../skills/orchestrator/references/chip-worker-template.md). The harvest mechanics — the `harvest` and `dispatcher` skills. Merge policy — see [CLAUDE.md «Agent PR merge policy»](../../CLAUDE.md).

> **Origin:** operator directive 2026-09-07, after a coordinator seat hand-harvested seven stages; recurrence 2026-09-28, when a seat moved a stage's edits into an in-session background Agent but kept verifying, sequencing on the merge lock and drafting the PR body itself. Codified out of agent memory 2026-10-01 per [memory-codification.md §3](memory-codification.md).

## §1 The rule

A session acting as a **coordinator seat** (orchestrator + advisor over a multi-stage campaign) keeps routing work only: kickoffs, aif dispatch, decisions, operator forks. The mechanical pipeline goes to a **standalone chip worker** — a separate session (`spawn_task` in Claude Code desktop; a fresh operator-opened session elsewhere) whose prompt stands alone and ends in a REPORT contract (`Status: DONE|PARTIAL|BLOCKED`, per-stage PR / head / merge sha, `ATTN:` lines). The worker reports; the seat decides.

## §2 Anti-patterns

- **`#seat-runs-the-pipeline`** — the seat polls aif, harvests, writes PR bodies or babysits CI itself. Counter: chip worker from the template.
- **`#subagent-as-chip`** — the seat hands the work to an in-session `Agent` and calls it delegated. The work still flows through the seat's context and the seat stays in the merge queue. Counter: a separate session.
- **`#worker-decides-fork`** — the worker resolves an operator fork (a stuck stage, a scope call) instead of returning it as `ATTN:`. Counter: the template's REPORT contract.

## §3 Promotion / retirement

- **Promotion to a gate:** if a seat marker becomes observable to hooks (e.g. the session-bus registry names the session's role), gate the `events:` commands for seat sessions only, with an escape token — the judgment objection in the Class line then no longer holds. Until then, 2 more `#seat-runs-the-pipeline` / `#subagent-as-chip` incidents within 6 months (beyond the two in §Origin) promote this to an orchestrator Phase-4 checklist item.
- **Retirement:** 12 months with no incident → archive to prose in the orchestrator skill.
