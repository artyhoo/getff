<!-- scope: design/brainstorm handoff — consumer-usable /pipeline (Option A) -->

# consumer-usable-/pipeline — brainstorm/design kickoff (HANDOFF)

> **Type:** DESIGN / brainstorm handoff (not execution). Resume via `superpowers:brainstorming`.
> **HARD GATE:** do NOT implement / scaffold / write code until a design is presented, a spec is written to `docs/superpowers/specs/`, and the maintainer approves it.
> **Created:** 2026-06-16, handed off from a review session in clean-context.

## 1. Goal (what the maintainer wants)

Make `/pipeline` (and its execution companion `/dispatcher`) **actually usable by a consumer on the consumer's OWN project** — not a silent no-op against framework-internal paths.

Maintainer explicitly chose **Option A** = *full generic orchestrator*: the consumer plans + orchestrates **their own** backlog (their work items → prioritized plan → dispatch to agents), making `/pipeline` a universal project orchestrator. (Rejected: B = lightweight planner-only; C = run-framework-audit-on-consumer-code.)

This **supersedes** GH issue **#482** (the "`/pipeline` no-ops in a consumer" issue) — "make it work" is strictly stronger than "make it honestly skip." So #482's reopen-vs-defer is moot once A lands; reference #482 only for the original problem statement.

## 2. Grounded findings — DO NOT re-discover (verified 2026-06-16)

- **The machinery is ALREADY shipped to consumers.** `install.sh` copies `pipeline + dispatcher + aif-doctor + template-audit` (`for _skill in pipeline dispatcher aif-doctor template-audit`, ~`install.sh:480`, via `copy_skill_with_transform` ~`install.sh:406`).
- **Roles:** `pipeline` = planner (priority ranking, launch-table, plan/state). `dispatcher` = executor (dispatch a chosen umbrella's stages through the aif-control loop, monitor, harvest PRs, stage-gate, advance).
- **Why they no-op in a consumer:** both are coupled to framework-internal paths/concepts the consumer doesn't have. Reference counts (grep over the two SKILL.md): `orchestrator-prompts` ×22, `wave-sequencing-plan` ×14, `wave-`-concepts ×13, `packages/runtime-bridge` ×13, `aif-handoff` ×5, `packages/core/principles` ×4.
- **Therefore A ≈ REBIND/GENERALIZE the already-shipped skills to the consumer's own backlog + dispatch — NOT build-from-scratch.** This is the build-vs-reuse-aligned framing (`.claude/rules/build-first-reuse-default.md`): reuse what ships, generalize the bindings. Any genuinely-new code needs a Prior-art trailer + SSOT consult.

## 3. Proposed decomposition (MVP-first) — validate/adjust in the brainstorm

A is product-sized → decompose into independent slices, each its own spec → plan → build:

| Slice | Does | Rebinds |
|---|---|---|
| **1 — MVP planner** | `/pipeline` reads the **consumer's backlog**, ranks, emits priority + launch-table. **No dispatch** — consumer/agent acts on it. | input (`wave-sequencing-plan.md` → consumer backlog) + state paths (`orchestrator-prompts/` → consumer dir) |
| **2 — dispatch** | `/dispatcher` actually launches the chosen item via CC-native subagents/worktrees (or aif if set up) | execution backend (`runtime-bridge`/aif → CC-native, degrade-if-absent) |
| **3 — full cycle** | multi-step sequencing + stage-gates + cross-run state on the consumer's project | generalize "wave/stage-gate" concepts |

**Recommended:** build **Slice 1 first** — it is a *prerequisite* for 2 & 3 (can't dispatch what isn't generalized as input), and immediately removes the no-op (the skill starts operating on real consumer data). This build-order is not in question; only "how far to go before it's worth shipping" is (see open Q1).

## 4. Open questions the brainstorm must resolve (in order)

1. **Product-scope:** is a planner-without-dispatch (Slice 1 alone) already useful to the maintainer, or is dispatch (Slice 2) essential before it's worth shipping? (Does NOT change build order — Slice 1 is first regardless — only how far one cycle goes.)
2. **Consumer work-item SOURCE** (defines Slice 1's input): GitHub issues? a backlog markdown file? the consumer's own `orchestrator-prompts/` umbrellas? something else? — *this is the first thing to ask once scope is set.*
3. **Dispatch substrate for Slice 2:** CC-native subagents + worktrees (like the global `orchestrator` skill), or require aif/runtime-bridge via the companion-install flow? Consumer may be on a non-CC harness → must degrade gracefully (`.claude/rules/dual-implementation-discipline.md`).
4. **Coupling depth (THE KEY RISK — see §5).**

## 5. Least-sure / KEY RISK — verify this FIRST, before promising scope

The "A = just rebind paths" framing rests on **counting references**, not reading **coupling depth**. If "waves / stage-gates / umbrellas" are baked into the **helper LOGIC** (not just path strings), Slice 1 is bigger than a path-swap.

**First task of the new session:** read `pipeline` + `dispatcher` + the ~20 `helpers/` scripts and **classify each framework-coupling as `path-level` (cheap rebind) vs `logic-level` (real rework)**. Helpers to scrutinize: `priority-score.sh`, `classify-work.sh`, `dispatch-from-state.sh`, `launch-table-generator.sh`, `plan-currency-check.sh`, `inflight-check.sh`, `delta-diff.sh`. Output a coupling table before committing to any slice estimate.

## 6. Files to read (clean-context start)

- `.claude/skills/pipeline/SKILL.md` (536 lines) + `.claude/skills/pipeline/helpers/*` (~20 scripts) + `references/`, `templates/`
- `.claude/skills/dispatcher/SKILL.md`
- `install.sh` — `copy_skill_with_transform` (~L406), the ship loop (~L480), `transform_internal_refs`
- GH issue **#482** (`gh issue view 482`) — original no-op problem statement
- `.claude/rules/build-first-reuse-default.md` (REUSE discipline — central) · `.claude/rules/dual-implementation-discipline.md` (CC-native vs portable — Slice 2) · `~/.claude/skills/orchestrator/SKILL.md` (the framework's own generic orchestrator — likely heavy prior-art/reuse source)

## 7. Discipline for the new session

- `superpowers:brainstorming` — HARD GATE (no code until spec approved). Terminal state = `superpowers:writing-plans`.
- **Build-vs-reuse first:** survey what already orchestrates (superpowers `subagent-driven-development` / `dispatching-parallel-agents`; aif-handoff; the global `orchestrator` skill) before proposing any new code. T12 (don't skip the survey), T11 (don't design without prior-art check).
- **AI-laziness traps** (per `.claude/rules/ai-laziness-traps.md §2`) — active for this design session: **T11** (prior-art check before "I propose…"), **T12** (run the orchestrator-survey, don't design from memory), **T15** (self-application: the framework's OWN `/pipeline` usage must stay intact after generalization — don't break the dogfood), **T16** (pattern-matching-on-name: "dispatcher is shipped" ≠ "it works for a consumer"). Enumerate any session-specific traps too.
- `no-paid-llm-in-ci`, doc-authority headers on any new docs.

## 8. Session state at handoff (2026-06-16)

All prior threads CLOSED and merged to staging:
- **#531** closed — PR **#544** (Option A = ignore framework-vendored system files in the consumer's `prettier --check`; conditional, consumer-owned configs stay checked). A-vs-B ratified by maintainer (recorded on the PR).
- **#534** closed — PR **#546** (R3 real-depcruise ground-truth arm; verified live: real depcruise fires on a planted `packages→apps` import).
- **#545** merged — wired 4 present-but-unwired install-sh tests + `meta-all-wired.test.sh` (armed-but-not-fired meta-gate).

This consumer-/pipeline design is the **only open thread**.

## 9. How to start

Open a fresh session in this repo. Read this kickoff → do §5 (coupling-depth classification) → resume `superpowers:brainstorming` at open-Q1 (product-scope) then Q2 (work-item source). Maintainer already chose **A** and endorsed **MVP-first**, pending the §5 depth check (which could resize the slices).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
