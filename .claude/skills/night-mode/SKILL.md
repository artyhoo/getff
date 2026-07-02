---
name: night-mode
description: Use to run a task FULLY AUTONOMOUSLY (overnight / unattended) as an orchestrator — delegate all work to subagents, self-review both top-down and bottom-up, iterate to convergence, and keep the main session's context lean. Trigger on «работай всю ночь автономно», «оставляю на ночь», «прогони сам до готовности», «автономный режим», «night mode», «overnight autonomous», «run to completion unattended», «пока всё не сделаем сам». The reusable protocol for how to work correctly AND how to verify correctly when no human is in the loop. NOT for a single delegated edit (use /orchestrator) or a one-shot review (use /reviewer).
---

> **Authoritative for:** the autonomous-overnight orchestration protocol — the role roster + model tiers, the execute → dual-review → converge → planner loop, the whole-work final pass, the autonomy/fork policy, quota/overnight resilience, the diff-visibility rule, and the empirical-verification discipline.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). General delegation / Mode A-B / Queue mode — that is the global `orchestrator` skill (this is its unattended-overnight specialization, REFERENCE it). aif container dispatch — see [/dispatcher](../dispatcher/SKILL.md).

# /night-mode — fully-autonomous overnight orchestration

Run a well-scoped implementation task to completion with **no human in the loop**, as pure orchestration: every unit of work is delegated to a subagent, every increment is reviewed from **two altitudes** (architecture-down and code-up), fixes iterate to convergence, and the plan is corrected as reality diverges — until the whole task is done and green. Your own context stays lean because the loop runs through the **Workflow** tool; only structured summaries return to you.

The point is to **not re-explain, each time, how to work correctly and how to verify correctly.** This skill IS that explanation.

## When to use / not

- **Use:** a task with a written plan (or a spec you can turn into one), an unambiguous done-condition, and permission to run unattended (overnight, quota permitting).
- **Do NOT use:** a single delegated edit or a quick question (→ `/orchestrator`); a one-shot review (→ `/reviewer`); a task whose forks are genuinely the maintainer's and cannot be resolved on the merits (those must wait for a human — see fork policy).

## Roles + model tiers

Delegate to four subagent roles. Default tiers (three-tier model from `orchestrator`):

- **Executor — Sonnet** (`model: "sonnet"`): writes/fixes code + tests per the plan, TDD RED-first. **Commits each increment** to the shared branch (see Diff visibility). Executes only; never self-approves.
- **Reviewer TOP-DOWN — Opus** (`model: "opus"`): architecture & design soundness, adherence to the plan AND the spec, goal/philosophy/principle compliance (README goal, project invariants, doc-authority, build-first-reuse — was a wheel reinvented? was prior-art/SSOT consulted? earliest-reachable-channel?). Findings + concrete HOW-TO-FIX.
- **Reviewer BOTTOM-UP — Opus** (`model: "opus"`): code correctness, best practices, anti-patterns, type safety, edge cases, test quality (paired-negative non-vacuous, RED-first actually observed, no `#discipline-theatre`). Findings + concrete HOW-TO-FIX.
- **Planner — Opus** (`model: "opus"`): owns the PLAN's sequencing/tasks and records design-decision resolutions with rationale. The **spec stays authoritative for design/AC** — a plan change that touches design must reconcile with the spec or be logged as an owner-fork.

**Fable** (`model: "fable"`) is available for the genuinely-hardest reasoning (deep architectural adjudication, an irreversible call) — reach for it deliberately, not for routine work. A per-session ban on any tier (e.g. "no Fable this run") is an **instance override the operator states at launch**, not part of this protocol.

## The loop (run it through the Workflow tool)

Per plan Task / logical increment:

1. **Executor** implements + commits the increment (RED-first: the failing test is observed before the fix).
2. **Both reviewers** run in PARALLEL (top-down + bottom-up) over that commit's diff + test output.
3. Must-fix findings → Executor applies the HOW-TO-FIX, commits → re-run BOTH reviewers. Loop **max ~4 iterations** per increment; if still unconverged → mark it **BLOCKED**, log why, and continue OTHER increments (never wedge the whole night on one).
4. **Planner** reconciles plan vs reality; records decision resolutions.

**Whole-work final pass (mandatory):** after all increments converge, run ONE MORE top-down + bottom-up review over the ENTIRE assembled diff AND the whole plan, plus a completeness-critic («what task/acceptance-criterion/edge is unverified?»). Fix, re-review, until BOTH altitudes are green **on the whole** — not just per-increment. Same pattern top and bottom: top-down guards architecture/plan/philosophy; bottom-up guards code/tests.

## Autonomy / fork policy (no human overnight)

- **Technical forks** (which impl is better on the merits; a design-decision the plan left open) → the Planner + reviewers RESOLVE autonomously with recorded rationale. Do not stop.
- **Genuine owner forks** (taste/strategy with no determinate best on the project's merits — e.g. widening a product's stack pin, an ownership-model call) → APPEND to a `<plan>.decisions.md` log; do NOT decide, do NOT block the task; surface them in the morning report.
- **Anti-collusion:** the Executor never reviews its own work; the two reviewers are independent agents; a converged increment still faces the whole-work pass.

## Quota / overnight resilience

The loop is reasoning-heavy (two reviewers + a planner per increment). Track cumulative high-tier usage; on a `429` / rate-limit / quota-exhaustion, **back off** with `ScheduleWakeup` (~20–30 min) and **resume** — the loop MUST survive the rolling reset window rather than dying. Commit every converged increment durably so a process restart loses nothing. Degrade (a single merged-reviewer pass) only if genuinely wedged, and log it.

## Diff visibility (a verified harness fact — do not re-derive)

Git worktrees share one `.git` object DB. **Verified empirically (live `isolation:"worktree"` Workflow probe, 2026-07-02):** an isolated agent runs in a SEPARATE worktree — its **uncommitted** changes are invisible to a non-isolated sibling, but a **commit** on a named branch IS visible via the shared `.git` (`git show <branch>:<file>` returns it). Load-bearing rule: the **Executor commits every increment** to the shared branch; reviewers read `git show <branch>` / the files. For the sequential loop, run the Executor **non-isolated in the shared worktree** (simplest — reviewers see the working tree and the commit); reserve `isolation:"worktree"` for genuinely-parallel Executors on disjoint files, and even then it works only because each commits.

## Context economy

Run the loop through **Workflow(s)** so only structured summaries return to the orchestrator context — never pull full diffs/code into your session. Track ONLY: which increment, converged?/blocked?, plan version, quota budget. Author a NEW Workflow per phase; `resumeFromRunId` is only for resuming a killed/edited run from cache, not for continuing to new work.

## Verification discipline (how to verify correctly)

The autonomous loop has no human to catch a plausible-but-wrong claim, so verification is not optional:

1. **Empirical over inferred.** Any load-bearing claim about tool/harness/code behavior is **tested, not asserted from «it follows from the model».** If you catch yourself writing «this follows from X / should behave like Y», that is a flag to run the probe. (Origin: the diff-visibility fact above was first *inferred*, then challenged, then *proven* by a live probe — the inferred version was imprecise.)
2. **file:line, not memory** (trap T3): every finding a reviewer emits carries a command output or a `path.ext:N` citation; the orchestrator does not accept a collaborator's citation without confirming the cited line.
3. **Paired-negative is non-vacuous** (trap T15): a test/guard that cannot fail is theatre — the bottom-up reviewer confirms RED was actually observed before GREEN.
4. **Verify against source-of-truth before a ship-step:** re-check `git`/CI state before merge; never merge on session-recall.
5. **Adversarial, not confirmatory:** reviewers default to finding the flaw; a clean review with low coverage is «insufficient coverage», not «clean».

## Terminal condition + morning report

Loop until ALL hold: every increment done · both-altitude reviews green on the whole diff · the project's full test/gate suite green · zero-behavior-change (or whatever the plan's acceptance criteria demand) · own adversarial cold-review (T19) of the final diff done. Then open the PR; **if CI goes red, fix + re-push before merge**; satisfy the PR-body discipline gates (e.g. §1.7 sections with a real `path.ext:N` citation per section). Merge to the trunk branch if the harness pre-authorizes it and the call is clear. Write a **morning report**: what merged, decision resolutions, any BLOCKED increments, the owner-fork log, and any degradation taken.

## Without this skill

Each unattended run is re-explained from scratch: the operator re-describes the executor/reviewer/planner roster, the convergence loop, the fork policy, and the quota handling every time — and the agent still improvises the risky parts. Reviews collapse to one altitude (code-level only, or architecture-level only), so a design drift or an anti-pattern survives the night. Load-bearing harness claims (like «isolation hides the diff») ship *inferred from the model* rather than tested, and a wrong inference silently corrupts hours of autonomous work with no human to catch it. On a quota reset the loop simply dies mid-night.

## With this skill

The roster, the execute → dual-review → converge → planner loop, the whole-work final pass, the fork policy, the quota-backoff, the diff-visibility rule, and the empirical-verification discipline are one standing protocol — invoked, not re-explained. Every increment is guarded from **both** altitudes; genuine owner forks are logged rather than silently decided; harness claims are **proven** before they become load-bearing; and the loop survives reset windows to reach a done, green, self-reviewed result plus a morning report.

## See also

- global `orchestrator` skill — general delegation / Mode A-B / Queue mode (this skill is its unattended-overnight specialization).
- the `reviewer` role (global `/reviewer` skill) — the two-altitude review discipline this loop automates.
- [.claude/rules/ai-laziness-traps.md](../../rules/ai-laziness-traps.md) — T3 / T15 / T19 / T20, the verification traps §Verification discipline enforces.
- [.claude/rules/recommendation-laziness-discipline.md](../../rules/recommendation-laziness-discipline.md) — the fork-surfacing companion (genuine forks → surface; clear calls → decide + report).
