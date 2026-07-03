---
name: night-mode
description: Use when running a task FULLY AUTONOMOUSLY (overnight / unattended) as an orchestrator — a THIN layer over `superpowers:subagent-driven-development` (the adopted executor + dual-reviewer loop). Adds only what unattended running needs on top of SDD: an autonomy/fork policy, quota-backoff resilience, Workflow context-economy, and a verification discipline. Trigger on «работай всю ночь автономно», «оставляю на ночь», «прогони сам до готовности», «автономный режим», «night mode», «overnight autonomous», «run to completion unattended». NOT for a single delegated edit (use /orchestrator) or a one-shot review (use /reviewer).
---

> **Authoritative for:** the OVERNIGHT DELTA on top of `subagent-driven-development` — the unattended autonomy/fork policy, quota/backoff resilience, Workflow context-economy, verification discipline, and the terminal condition for an unsupervised run.
> **NOT authoritative for:** the executor + dual-reviewer dispatch loop itself — that is `superpowers:subagent-driven-development` (SSOT #64, ADOPT), which this skill **layers over, never re-describes**. Project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

# /night-mode — thin overnight layer over subagent-driven-development

Run a well-scoped implementation task to completion with **no human in the loop**. The dispatch loop — a coordinator dispatching a fresh implementer per increment, then two independent reviewers, with a rework loop to convergence — **is `superpowers:subagent-driven-development` (SDD)**. Use it. This skill adds **only** what SDD does not cover for an *unsupervised overnight* run. If you catch yourself re-describing the executor/reviewer roster or the review loop, stop — that is SDD's job, and re-describing it is the `#parallel-evolution-creep` this project exists to prevent.

## The loop is SDD (do not reinvent)

Invoke `superpowers:subagent-driven-development` for the core: coordinator → fresh implementer subagent per increment → **two** fresh reviewer subagents (spec-reviewer ≈ top-down / architecture; code-quality-reviewer ≈ bottom-up / code) → rework loop. Models on this substrate: Executor = Sonnet; the top-down spec/architecture reviewer + a plan-reconciling Planner = Opus; the bottom-up code-quality reviewer = Sonnet (per SDD's «least powerful model that can handle each role» — bottom-up code review is the cheaper-model-sufficient altitude, top-down architecture review keeps Opus); **Fable** is available for the genuinely-hardest reasoning. A per-session tier ban (e.g. "no Fable this run") is an operator override stated at launch, not part of this skill.

## The overnight delta (all this skill actually owns)

1. **Unattended autonomy / fork policy.** No human overnight, so: **technical** forks (which impl is better on the merits; an open design decision) → resolve autonomously with recorded rationale. **Genuine owner** forks (taste/strategy with no determinate best on the project's merits) → append to `<plan>.decisions.md`, do NOT decide, do NOT block; surface in the morning report.
2. **Two-altitude whole-work pass.** After all increments converge, run ONE MORE review from BOTH altitudes over the ENTIRE assembled diff AND the whole plan, plus a completeness-critic («what task / acceptance-criterion / edge is unverified?») — beyond SDD's per-increment review. Cap per-increment rework at ~4 iterations; if unconverged → mark BLOCKED, log why, continue other increments (never wedge the whole night on one).
3. **Quota / backoff resilience** (ADAPT of AIF watchdogs, SSOT #45). The loop is Opus-heavy; on a `429` / rate-limit, back off with `ScheduleWakeup` (~20–30 min) and resume — survive the rolling reset window rather than dying. Commit every converged increment durably so a restart loses nothing.
4. **Workflow context-economy.** Run the loop through the **Workflow** tool so only structured summaries return to the orchestrator context — never pull full diffs/code in. Track ONLY: which increment, converged?/blocked?, plan version, quota budget. New Workflow per phase; `resumeFromRunId` is only for a killed/edited run, not for new work.
5. **Verification discipline** (how to verify correctly when no human catches a wrong claim): **empirical over inferred** — any load-bearing claim about tool/harness/code behavior is *tested*, not asserted from «it follows from the model» (this skill's own diff-visibility fact below was first inferred, challenged, then proven by a live probe); **file:line not memory** (T3); **non-vacuous paired-negatives** — RED observed before GREEN (T15); **verify-against-source before ship** (re-check git/CI, never merge on recall); **adversarial** reviewers (a clean low-coverage review is «insufficient coverage», not «clean»).
6. **Harness fact — diff visibility (verified 2026-07-02 via a live `isolation:"worktree"` probe):** an isolated agent runs in a SEPARATE worktree — its UNCOMMITTED changes are invisible to a non-isolated sibling, but a COMMIT on a named branch IS visible via the shared `.git`. So the Executor **commits every increment** to the shared branch; reviewers read `git show <branch>`. Sequential loop → Executor non-isolated in the shared worktree; `isolation:"worktree"` only for genuinely-parallel Executors on disjoint files.

## Terminal condition + morning report

Loop until: every increment done · both-altitude reviews green on the whole diff · the project's full test/gate suite green · own adversarial cold-review (T19) of the final diff · PR-body discipline gates satisfied (e.g. §1.7 sections each with a real `path.ext:N` citation; a new capability file needs a `Prior-art:` trailer — principle 11 F1 enforces it at pre-push). If CI goes red after push → fix + re-push before merge. Merge to trunk if the harness pre-authorizes it and the call is clear. Then write a **morning report**: what merged, decision resolutions, BLOCKED increments, the owner-fork log, any degradation taken.

## Without this skill

Each unattended run re-improvises the parts SDD does not cover: it stops dead for a human on a technical fork (defeating «overnight»), silently decides an owner fork it should have logged, dies on the first quota reset, pulls full diffs into the orchestrator context until it drowns, and ships a load-bearing harness claim *inferred from the model* — a wrong inference then corrupts hours of work with no human to catch it.

## With this skill

The executor + dual-reviewer loop is delegated to `superpowers:subagent-driven-development` (not re-described), and only the overnight delta is added: an autonomy policy that **logs** owner forks instead of deciding them, quota-backoff that survives the reset window, Workflow-driven context economy, and a verification discipline that **proves** harness claims before they become load-bearing — ending on a done, green, self-reviewed result plus a morning report.

## See also

- `superpowers:subagent-driven-development` — the adopted executor + dual-reviewer loop this skill layers over (SSOT #64, ADOPT — the loop, not re-implemented here).
- [docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) — #64 (SDD, ADOPT) + #45 (AIF watchdogs self-healing, ADAPT — the quota-backoff basis).
- global `orchestrator` skill — general delegation / Mode A-B / Queue mode (superset context).
- [.claude/rules/ai-laziness-traps.md](../../rules/ai-laziness-traps.md) — T3 / T15 / T19 / T20, the verification traps the delta's §5 enforces.
- [.claude/rules/recommendation-laziness-discipline.md](../../rules/recommendation-laziness-discipline.md) — the fork-surfacing companion (genuine forks → surface/log; clear calls → decide + report).
