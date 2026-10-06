---
name: night-mode
description: Use when running a task FULLY AUTONOMOUSLY (overnight / unattended) as an orchestrator. Trigger on «работай всю ночь автономно», «оставляю на ночь», «прогони сам до готовности», «автономный режим», night mode, overnight autonomous, run to completion unattended. NOT for a single delegated edit (/orchestrator) or a one-shot review (/reviewer).
---

<!-- @harness-posture: portable-designed-not-proven — designed for any harness with sequential subagent dispatch (references/substrate-and-models.md, Harness portability); the end-to-end non-CC run is NOT yet exercised — that honest gap stays open until a live probe -->

# /night-mode — unattended delta over SDD

> **Authoritative for:** unattended fork/authorization policy, quota resilience and terminal reporting.
> **NOT authoritative for:** project goal or SDD's executor/review loop.

Input: explicitly authorized, well-scoped unattended task/plan. Result: verified completed increments,
gated delivery and a morning report, with blocked/floored decisions visible.

## Before the run

Read [substrate and models](references/substrate-and-models.md) before choosing the executor substrate
or tier ladder. Adopt SDD as-is for in-session work; aif execution uses dispatcher rather than another
loop. Designed portable does not mean end-to-end non-CC behavior has been exercised.

Read [overnight policy](references/overnight-policy.md) **before the first unattended decision,
worker/reviewer dispatch, retry, configuration change, push or merge**. It contains all eight delta
items, advisor consult conditions, standing authorization and the object-cut floors.

## Shared constraints

- Authorization covers the named task envelope; it never moves the goal, floor or its own scope.
  Floor categories dominate stage membership: shared standing config, maintainer artifacts, new scope,
  spend, security/permissions, genuine owner forks, non-generated deletions and externally visible
  actions stay parked with a decision package unless separately explicitly authorized.
  Ambiguous object → floor. Advisor answers cannot raise the ceiling.
- Record in-envelope park decisions and reversibility in decisions.md/PR before applying/merging.
  Strategy/value objects use the advisor ask when reachable; no answer does not authorize guessing.
- Read-only auditors and scoped request_changes cycles follow policy. Write umbrella workers still
  go to a fresh session or aif; overnight authorization does not remove the pipeline channel boundary.
- STOP, KICKOFF-AMBIGUOUS, main-base merge or second consecutive unchanged-scope REVISE escalates.
  Keep fidelity's two-round cap separate from per-increment rework; blocked increments do not wedge
  independent work. A round-budget breach asks; it never silently pushes through.
- Use observed command/source receipts and meaningful RED/GREEN evidence. Commit converged increments
  before another seat inspects them; isolated uncommitted work is invisible to sibling worktrees.
  Quota/reset handling uses the actual harness mechanism and durable progress, not a fabricated tool.

## Closure and morning report

Before claiming done or delivering, read [closure](references/closure.md). Require completed increments,
whole-work review at both altitudes, actual full gates, adversarial final review and faithful PR receipts.
CI red → repair before merge. Report merged work, decisions, blocked items, forks, degradation,
bus anomalies and night-decided parks/asks with ledger references.

At **NIGHT-END terminal retirement ONLY**, emit one `Review morning report [<plan>]` chip per plan
only if `spawn_task` is invocable. Never emit it at a mid-night handoff. Without the capability the
report file is the fallback; use best-effort `dismiss_task` for stale park chips and list the decided
parks so a stale chip is recognizable.

## Seat lifecycle

Registry-role seat sessions (birth · work · self-cleaning · retirement) follow ONE protocol —
[.claude/rules/seat-lifecycle.md](../../rules/seat-lifecycle.md) (SLP): each phase binds a
settled owner (ADR D6/D7/D8, session-bus v2, this skill's night policy); bus-touching steps
are Part-II-gated. Never restate it here (`#fifth-description-of-the-loop`).

## Without this skill

Each unattended run re-improvises the parts SDD does not cover: it stops dead for a human on a technical fork (defeating «overnight»), silently decides an owner fork it should have logged, dies on the first quota reset, pulls full diffs into the orchestrator context until it drowns, and ships a load-bearing harness claim _inferred from the model_ — a wrong inference then corrupts hours of work with no human to catch it.

## With this skill

The executor + review loop is delegated to `superpowers:subagent-driven-development` (not re-described), and only the overnight delta is added: an autonomy policy that **logs** owner forks instead of deciding them, quota-backoff that survives the reset window, Workflow-driven context economy, and a verification discipline that **proves** harness claims before they become load-bearing — ending on a done, green, self-reviewed result plus a morning report.
