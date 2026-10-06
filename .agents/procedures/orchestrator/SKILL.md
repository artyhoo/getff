---
name: orchestrator
description: |
  TRIGGER when: «оркестратор/orchestrator», «старшая/младшая модель», «делегируй/delegate»,
  «Mode A/B», «file-prompt», «umbrella», «батч правок/batch fixes», «пакет фиксов»; ИЛИ первая
  из серии мелких правок одной темы; ИЛИ задача распадается на ≥3 независимых подзадач; ИЛИ
  «автономно / волнами / работай без остановок / прогони очередь кикофов сам» при ≥2 kickoff'ах
  → Queue mode.
  SKIP: тривиальная правка по точному пути (≤5 строк, 1 файл).
when_to_use: организатор, ты старшая, много мелких, координируй, разбей на подзадачи, queue mode, kickoff, autonomous research, worker dispatch, воркер, ревьюер, очередь задач, автономно, волнами, итеративно, работай без остановок, прогони очередь кикофов, цикл кикофов, не останавливайся, сам до конца
---

<!-- @harness-posture: cc-native-with-fallback — Agent-tool subagent dispatch is portable (zcode evidence via night-mode/references/substrate-and-models.md, Harness portability); Skill-tool invocation degrades to direct file reads -->

# /orchestrator — bounded delegation and acceptance

> **Authoritative for:** project discovery, dispatch choice, quota policy, Phase -1 through 4.5 and queue entry.
> **NOT authoritative for:** project goal, SDD's executor loop or companion isolation/parallel mechanics.

Input: scoped work/plan and project context. Result: accepted increments and one umbrella PR with
an evidence trace, or specific ATTN/forks. Preserve the user's chosen division of work.

## Choose the branch before acting

- Before the first dispatch, read [glossary](references/glossary.md) and
  [bootstrap and routing](references/bootstrap-and-routing.md). In a new repo read
  [discovery](references/discovery.md); cache actual commands/topology, retake after branch/remote changes.
  Small known edits may stay direct; bulk delegation uses the documented Mode A/B choice and model rules.
  The user's explicit senior-implementation direction overrides skill defaults.
- A campaign coordinator delegates mechanical polling/harvest/CI/merge to the standalone chip worker:
  read [chip-worker template](references/chip-worker-template.md) before handoff, secure local-only work
  with a bundle and require REPORT. In-session Agent is not that worker. Dispatcher/night seats are
  separate roles; do not reinterpret every PR session as a coordinator.
- Before workers, read [intake and planning](references/intake-and-planning.md). Phase -1 independently
  checks the actual kickoff and NEW-path structural obligations; use its documented skip cases.
  Inventory inputs and ownership, create the real plan and claim/verify isolation before parallel work.
- Before delegating an increment, read [delegation](references/delegation.md), then use SDD as-is.
  File-lock matrix before parallel batches; a reviewer that edits/reverts is a mutator and needs isolated
  work or solo execution. Unknown tools/model names never become fabricated working mechanisms.
- Before quota-based mode changes or reset handling, read [quota policy](references/quota-policy.md).
- Before accepting REPORT, pushing or creating/editing a PR, read [acceptance](references/acceptance.md).
  Check exact files, observed verification receipts and unresolved decisions/ATTN. Self-reported high
  confidence does not establish coverage. Final source audit rechecks citations, claimed checks and
  actual companion use; any material unverified claim is ATTN before publication.
- On rework, blocked evidence, user steering or communication uncertainty, read
  [recovery and communication](references/recovery-and-communication.md) before recovery.
  Never silently lower a gate, broaden scope or take destructive Git recovery without authorization.
- For >=2 autonomous research kickoffs with requested autonomy, read
  [queue mode](references/queue-mode.md) **before** entering that mode; no queue from a single edit.
  For provenance/history questions only, read [rationale](references/rationale.md).

## Without this skill

Delegation collapses into two failure modes. Either the senior does the work itself — burning its own context on greps and multi-file edits until it runs out of room mid-umbrella — or it delegates without discipline: no discovery, so junior prompts carry commands that do not exist in this repo; no file-lock matrix, so parallel agents collide in one branch; no quota tracking, so a 429 lands mid-batch and the progress is lost; no Phase -1, so an ambiguous kickoff is discovered only after the executor has acted on it.

## With this skill

Task size picks the mechanism (small → the senior's own `Edit`, bulk → an isolated inline `Agent`, a queue of research kickoffs → Queue mode), discovery is taken once per repo so junior prompts carry real commands, quota zones switch the working mode before a 429 rather than after it, and every kickoff above the trigger threshold gets a cold independent read before dispatch instead of after. One PR per umbrella, with a verify-trace that survives the Phase 4.5 audit.
