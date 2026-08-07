# KICKOFF — aif-worktree-gap (I-phase, Option B)

> **Type:** I-phase (execution-build, 2 stages SEQUENTIAL — Stage 2 gated on Stage 1 live-test GREEN).
> **Base branch:** staging (NOT main).
> **Deliverable:** bridge-dispatched aif tasks create a per-task git worktree → N meta-orchestrator
> tasks run autonomously **in parallel**, each isolated. Closes the worktree gap root-caused in
> the merged R-phase #372.
> **Origin:** maintainer decision 2026-06-02 — «чинить параллелизм надо, хочу несколько мета-оркестраторов
> параллельно в aif автономно». Option B from `2026-06-02-aif-worktree-gap.md §5.2`.

---

## §0 Why this exists (verified, merged R-phase)

**Goal:** the maintainer wants several `/meta-orchestrator` runs dispatched into aif at once, each
running autonomously and in parallel with the others. Today **0 tasks ever get a worktree**, so
everything is forced serial. This I-phase fixes the mechanism.

**Verified root cause (R-phase #372, merged to staging):** the bridge dispatch does
`POST /tasks/:id/events { event:'accept_existing_plan' }`, which transitions the task
`backlog → plan_ready`, **skipping the `planning` status**. The coordinator runs `runPlanner` only
for tasks at `planning` (`coordinator.ts` PIPELINE `from:["planning"]`), and the **only** worktree-creation
code lives inside `runPlanner` (`planner.ts:191-213`, gate at `:193-195`). Planner skipped → worktree
never created → `worktree_path = null`, regardless of `parallel_enabled` / `AIF_TASK_WORKTREES_ENABLED` /
`plannerMode`.

**Fix (Option B):** stop sending `accept_existing_plan`; let the auto-queue advance the task through
`planning` so `runPlanner` executes and creates the worktree.

---

## §1 Inputs (read before any change)

**Single source of context — the B-handoff (do NOT re-collect from PRs):**

```text
~/.claude-coordination/rules-as-tests-aif/aif-isolation-rphase/B-handoff.md
```

It holds the goal, root cause, the **exact file:line anchors**, the verbatim Option-B fix path, the
mandatory live-test, and the "what is NOT the fix" list — all extracted from merged #372. Read it first.
The two source patches it indexes (`git fetch origin staging` first):
`2026-06-02-aif-worktree-gap.md` (#372, primary) and `2026-06-01-aif-task-isolation.md` (#360).

**The ONE editable file in our repo** (everything else the handoff cites — `planner.ts`,
`stateMachine.ts`, `coordinator.ts`, `taskEvents.ts` — is aif-container upstream, read-only; see §8):

- `packages/runtime-bridge/src/AifHandoffBackend.ts` — step 3 `accept_existing_plan` (line 195),
  step 4 unpause (199). **B removes step 3.**

> This kickoff deliberately does NOT restate the file:line table — that lives in the B-handoff
> (single source, avoids `#two-prompts-drift`). This file owns only the *orchestration* layer below.

---

## §2 Stages

### Stage 1 — live-test GATE (no code change; ~30 min)

**Purpose:** de-risk the one real unknown in B (ATTN-2): when a task goes through `planning`,
does `runPlanner`'s subagent **preserve** the plan the bridge already pushed (step 2 `PUT {plan}`),
or **overwrite** it (subagent calls `/aif-plan full` → writes `@${planPath}`)?

**Method (drive aif via REST/CLI from this CC session — do NOT edit the bridge yet):**
1. Create a task through the **planning path** (the path B will use): `POST /tasks` with
   `autoMode:true, paused:true`; `PUT /tasks/:id { plan: <known-marker kickoff> }`;
   then `PUT /tasks/:id { paused:false }` — **without** `accept_existing_plan`.
2. Let the auto-queue advance `backlog → planning → runPlanner`.
3. Observe two facts in the live DB / FS:
   - **(a) worktree created:** `worktree_path` non-null for the task; `git worktree list` shows a sibling.
   - **(b) plan survived:** the on-disk plan file still contains the known marker (not regenerated).

**GATE verdict:**
- (a) **AND** (b) GREEN → Stage 2.
- (b) RED (plan clobbered) **OR** (a) RED (no worktree) → **STOP + surface** (park-don't-guess, §7).
  Do NOT improvise a workaround. B-as-specified needs a plan-preservation variant — re-decide with maintainer.

### Stage 2 — bridge change (execution-build, gated on Stage 1 GREEN; ~2 h)

1. In `packages/runtime-bridge/src/AifHandoffBackend.ts`, **remove step 3** (`accept_existing_plan` POST);
   keep step 2 (`PUT {plan}`) and step 4 (`PUT {paused:false}`). The task starts at `backlog`,
   `autoMode:true`, `paused:false` → auto-queue advances it through `planning` → `runPlanner` → worktree.
2. Update the file's header comment (steps 1-4 → 1-3) and the rollback `try` block accordingly.
3. **Add/adjust the paired-negative test** for the bridge dispatch (no `accept_existing_plan` in the
   emitted call sequence).
4. **Acceptance (the maintainer's real goal):** dispatch **2 tasks concurrently** → each gets a
   **distinct** `worktree_path` → both run in parallel (pool `limit > 1`, i.e.
   `hasActiveBranchBoundTasksForProject` stays false because no task is branch-bound-without-worktree).
   Capture the live evidence (two worktree paths + concurrent `status=implementing`) in the PR body.

---

## §3 Stage gate (Stage 1 → Stage 2)

Not a PR-merge gate (R-phase already merged). The gate is the **Stage 1 live-test verdict**:

```text
GATE GREEN  := worktree_path non-null  AND  plan-marker survived runPlanner
GATE RED    := either condition fails  →  STOP, surface to maintainer (§7), do NOT start Stage 2
```

Record the Stage 1 evidence (DB rows + plan-file diff) before declaring GREEN. No "looked fine, proceeding".

---

## §4 Dispatch

- **Mode A, normal maintainer-paste CC session.** Single worker, sequential stages.
- **NOT via the runtime-bridge.** This I-phase *fixes* the bridge's autonomous-dispatch path; dispatching
  it through that same broken path is circular (no worktree → the fix-task itself runs un-isolated).
  Stage 1's "live test" *uses* the aif runtime to probe, but the worker authoring the change is a CC session.
- Stage 2 worker target file (`packages/runtime-bridge/**`) does **not** match the §4b §1.7 path list
  (`.claude/rules/**`, `packages/core/principles/**`, `CLAUDE.md`, `agents/**`, …) → §1.7 PR-body mandate
  does not apply. Standard PR body + `Prior-art:` trailer (capability commit if the bridge diff ≥ 80 LOC).

---

## §5 AI-traps active (per `.claude/rules/ai-laziness-traps.md §2`)

- **T2 — "my method would catch it, so I don't need to run it":** Stage 1 is a *live test*, not a
  reasoned argument. Actually run the dispatch and read the DB/FS, don't conclude "the plan should survive".
- **T3 — plausible finding without verification:** every container file:line cited here is read-only and
  may have shifted; re-verify in the correct container (api vs agent) before acting on it.
- **T5 — bundling implementation into the gate:** Stage 1 writes NO production code. If you reach for
  Edit on `AifHandoffBackend.ts` during Stage 1, stop.
- **T16 — pattern-matching-on-name:** "accept_existing_plan sounds like it just accepts the plan" — no,
  its load-bearing effect is the `planning`-skip. Verify the state-machine transition, don't assume.
- **T19 — CI ≠ design review:** the bridge unit test passing ≠ "2 tasks run in parallel". The acceptance
  is the live 2-concurrent-worktree evidence, not green CI.
- **Domain-specific — T-WG-A (circular-dispatch trap):** tempted to dispatch THIS fix-task through the
  aif bridge "to dogfood it". That runs the fix un-isolated on the very path it's repairing. Counter: §4 —
  this I-phase is maintainer-paste CC only until merged + proven.
- **Domain-specific — T-WG-B (plan-clobber denial):** if Stage 1 shows the plan was overwritten, the
  temptation is to "patch around it quickly" (e.g. re-PUT the plan after planning). That is guessing a
  fork — STOP and surface (§7); a plan-preservation design is a separate maintainer decision.

---

## §6 Recursive self-application

This kickoff was authored by `/meta-orchestrator`. Verify principle 12 passes if this file is placed
under a `kickoff.md` the test scans:

```bash
npx vitest run packages/core/principles/12-ai-laziness-traps.test.ts | tail -5
```

---

## §7 Stop conditions (park-don't-guess)

- **Stage 1 GATE RED** (no worktree, or plan clobbered) → STOP, surface as DECISION-NEEDED with the
  observed evidence; do NOT improvise a plan-preservation hack. (counters T-WG-B)
- **Pool stays serial after the fix** (`hasActiveBranchBoundTasksForProject` true because legacy
  branch-bound tasks linger) → surface; may need a one-time DB cleanup of stale branch-bound tasks, which
  is a maintainer call, not a silent action.
- **Any urge to edit aif container source** (`planner.ts` / `coordinator.ts` / `stateMachine.ts` /
  `taskEvents.ts`) → STOP; that is upstream `lee-to/aif-handoff`, not our repo (§8). Surface an upstream
  issue instead.

---

## §8 Anti-scope

- **Finding F (park/resume `review→done`)** from `2026-06-01-aif-task-isolation.md` is a separate tread —
  NOT in this I-phase.
- **No edits to aif container upstream files.** Only `packages/runtime-bridge/**` is ours to change.
- **No npm deps.** Substrate purity (`no-paid-llm-in-ci.md` / BFR-default).
- Do NOT widen to "general aif lifecycle refactor" — scope is exactly: remove `accept_existing_plan` from
  bridge dispatch + prove 2 parallel worktree-isolated tasks.

---

## §9 See also

- `docs/meta-factory/research-patches/2026-06-02-aif-worktree-gap.md` — binding root-cause + Option B spec.
- `docs/meta-factory/research-patches/2026-06-01-aif-task-isolation.md` — predecessor (Findings A+F).
- `.claude/rules/ai-laziness-traps.md §2` — trap catalogue.
- `.claude/rules/reviewer-discipline.md §2` — surface-as-DECISION-NEEDED pattern (§7).
