# KICKOFF — dispatcher-skill (/dispatcher)

> **Type:** R-phase → I-phase → Eval umbrella.
> **Base branch:** staging.
> **Persistence:** CANON (`~/.claude-coordination/rules-as-tests-aif/`), survives worktree deletion.
> **Runner:** CC sessions (NOT aif — this skill builds the aif-control loop, so dogfooding aif to build it is circular until it works).
> **Predecessor:** meta-orchestrator-refactor DONE (#399) — `/pipeline` (the plan skill) is clean. This umbrella adds the EXECUTION half.

---

## §0 Goal

Extract the active aif-control loop into a separate CC-skill `/dispatcher`, so `/pipeline` (plan) and `/dispatcher` (execute) are separate — one skill no longer does everything.

**Metaphor (maintainer's framing):** air-traffic dispatcher ↔ aircraft = aif. Dispatcher stays on the line, monitors, keeps a dialog (questions ↔ answers), gives next tasks. The aircraft (aif) flies on autopilot; the dispatcher controls + intervenes, does not fly.

**The loop `/dispatcher` runs:**
```
dispatch task to aif
↓
monitor (poll status)
  ├─ parked/question → Q&A:
  │     • technical fork (no taste) → superpowers:brainstorming → answer.ts → continue
  │     • strategic DN → questions.ts records → surface to human → wait answer.ts
  ├─ done → harvest.ts (push + PR) automatically  ← THE step I kept forgetting manually
  ↓
Phase-1 cold-review (requesting-code-review)
  ↓
stage gate (gh pr merged?) → if clear, dispatch next stage
↓
loop until umbrella complete OR genuinely needs human
```

---

## §1 Primitives already exist — build NOTHING from scratch, only wire

| Primitive | File | Role in loop |
|---|---|---|
| dispatch | `packages/runtime-bridge/src/cli/dispatch.ts` | send task to aif |
| harvest | `packages/runtime-bridge/src/cli/harvest.ts` | push + PR + auto-merge (the forgotten step) |
| receive questions | `packages/runtime-bridge/src/cli/questions.ts` | read parked forks |
| answer questions | `packages/runtime-bridge/src/cli/answer.ts` | resolve parked forks |
| brainstorm | `superpowers:brainstorming` | answer technical Q&A autonomously |
| Q&A hook | `.claude/hooks/ask-question-reminder.sh` | already configured — fork discrimination |
| Phase-1 review | `superpowers:requesting-code-review` + `reviewer-discipline.md §2` | gate between stages |

`/dispatcher` = ~150-line wiring skill over these. BFR: this is REUSE (wire existing CLI primitives), not BUILD.

---

## §2 Stages

### Stage 0 — R-phase (design the loop + verify dispatch reality)

**This folds in the "aif dispatch diagnosis" (backlog item 2).** Before designing the loop, establish what ACTUALLY works on staging today:

1. **Dispatch reality (post-#387):** `AifHandoffBackend.ts` now puts kickoff in `description` (planner INPUT), removed `accept_existing_plan` (2026-06-03, see `AifHandoffBackend.ts:20`). Verify: does a fresh `dispatch.ts <kickoff>` from a clean clone reliably reach `implementing` + create a per-task worktree? Test once, record the actual state machine. (This session hit `title="tmp"` from a `/tmp/` path + a backlog-stall — confirm root cause: is it path-derived title, planner-pickup timing, or a real bug?)
2. **harvest reality:** confirm `harvest.ts <taskId>` pushes + PRs an aif `done` task end-to-end (idempotent on retry? — matters for flaky network).
3. **questions/answer reality:** confirm `questions.ts` surfaces a parked task and `answer.ts` resumes it.
4. **BFR check** (`build-first-reuse-default.md §3`): is there an upstream agent-control-loop (aif-handoff's own autoMode? Superpowers? Devin-style) that already does dispatch→monitor→harvest→advance? DeepWiki ≥3 phrasings + WebSearch. If yes → ADOPT/REFERENCE, don't BUILD the loop.
5. **AI-traps active:** T11/T12 (BFR before build) · T16 (don't name-match: «monitor loop» upstream ≠ our problem class unless verified) · T19 (cold-QA) · T20 (no verdict without evidence-tool).

Deliverable: `r-phase.md` — verified primitive-reality table + loop design + BFR verdict. NO skill code yet.

### Stage 1 — I-phase (write /dispatcher)

Write `.claude/skills/dispatcher/SKILL.md` (~150 lines) wiring the §1 primitives per the Stage-0 design. Include the 3 Q&A types (technical→brainstorm / strategic→park / next-task→auto-advance). Must carry: With/Without (P15), §1.7 self-reflexive note, anti-scope (does NOT plan — that's /pipeline; does NOT edit global skills). Companion principle test if a mechanical check fits.

### Stage 2 — Eval (prove it goes end-to-end)

Run one real umbrella through `/dispatcher` and confirm it reaches done WITHOUT human help except on genuine strategic DNs. Closes the "never behaviorally tested" bar (same gate Stage 6 of the refactor set used).

---

## §3 Stage gates

`gh pr list --search "is:merged head:<branch> base:staging"` between stages. Phase-1 cold-review between every stage (T19, CI ≠ design review).

## §4 §1.7 PR-body mandate

Touches `.claude/skills/**` → every PR body needs `### §1.7 Forward-check applied` + `### §1.7 Backward-check applied` (H3 headings, word «applied», ≥40 non-ws chars each, ≥1 `file:line` per section).

## §5 Anti-scope

- Does NOT plan (priority/launch-table = `/pipeline`'s job). `/dispatcher` only EXECUTES a chosen umbrella.
- Does NOT build new CLI primitives — wires existing ones (§1). A genuinely-needed new primitive = surface as a separate finding, don't sneak it in.
- Does NOT edit `~/.claude/skills/orchestrator/` (global, agent-uncommittable).
- Does NOT add npm deps.

## §6 DN — RESOLVED (maintainer 2026-06-03, after Stage 0 R-phase #402)

- **DN-A — RESOLVED: hybrid (agnostic).** `/dispatcher` ships CC-native primary + portable fallback that degrades gracefully. Skills ARE consumer-shipping (`install.sh:207`), so `/dispatcher` is consumer-facing → `dual-implementation §3` default dual + BFR §1.1 shipped-axis (making a companion mandatory = goal change). CC present → `superpowers:brainstorming` resolves technical forks; CC absent → capability-check (not brand-name) detects missing companion, technical forks surface to operator. `@dual-pair: dispatcher-skill` + drift-check. Full rationale: `docs/meta-factory/dispatcher-skill-rphase.md` §(d) DN-A.
- **DN-B — RESOLVED: Option C mechanized by the EXISTING fork-challenge discipline (reuse, not rebuild).** `/dispatcher` always reasons each parked fork; the clear-vs-genuine challenge (already implemented as `.claude/hooks/ask-question-reminder.sh`, PreToolUse:AskUserQuestion, + `end-of-turn-reminder.sh` Stop backstop) auto-resolves clear/technical forks (brainstorm → `answer.ts` → report — the question «отпадает») and surfaces only genuine/strategic forks via `questions.ts`. Outcome ≈ A (you see only real decisions) but the mechanism is the already-built discipline, NOT a new bespoke classifier.
  - **Stage-1 design note:** `ask-question-reminder.sh` is `@cc-only-rationale` (operator-internal, NOT in `install.sh` payload — `ask-question-reminder.sh:2`). So the discrimination LOGIC must be baked into the `/dispatcher` SKILL prose (which ships), so a consumer's CC session gets the clear-vs-genuine discipline from the skill itself; the maintainer's own session additionally has the live hook as backstop. This keeps the agnostic (DN-A) shape intact.

## §7 See also

- `../meta-orchestrator-refactor/decisions.md` — architecture rationale (/pipeline + /dispatcher + sequencer split).
- `.claude/skills/pipeline/SKILL.md` — the plan skill this complements.
- `packages/runtime-bridge/src/cli/` — all primitives.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
