<!-- bridge: skip -->
# KICKOFF — mutation-discipline Stage 4 D (cover remaining .sh files) — meta-launch

> **Type:** I-phase build, PARALLEL (5 independent sub-tasks D.1–D.5).
> **Origin:** mutation-discipline umbrella, Stage 4 D. Stage-3 C gate GREEN (PR #378 MERGED 2026-06-02).
> **Base branch:** staging (NOT main).
> **`bridge: skip` marker:** this kickoff is dispatched MANUALLY with `use_subagents=true` (the parallel-dispatch
>   live test, design-doc §5). The auto-dispatch hook is suppressed so it does not create a second task with the
>   wrong (`use_subagents=0`) flag. See `docs/superpowers/specs/2026-06-02-aif-parallel-dispatch-design.md` §5.

## §0 Why this kickoff is structured as a 5-task plan

Design-doc §5 OPEN QUESTION: does `use_subagents=true` make aif self-parallelize ONE umbrella — i.e. does the
`implement-coordinator` agent-definition (`.claude/agents/implement-coordinator.md`) actually spawn concurrent
`implement-worker`s? The coordinator only spawns workers when the plan has **≥2 independent ready tasks in one
layer** (`implement-coordinator.md` execution-algorithm: `len(ready) > 1 → launch implement-worker for EACH`).
D.1–D.5 are 5 genuinely-independent test-writing tasks (different target files, different test files, no shared
state, no ordering) → one dependency layer of 5 → the coordinator MUST fan out 5 workers iff the mechanism works.

The plan below uses the exact `- [ ] Task N:` format `planLayers.ts:parseInlineTask` parses, and deliberately
carries **no `## Phase` headings** (a Phase heading would make later tasks implicitly depend on earlier ones per
`buildResolvedDependencies`, serializing them).

## §1 The work (real — not throwaway)

Write content-level paired-negative mutation tests (M.4 pattern) for the 5 shell scripts that still lack them.
Each test is a vitest `*.test.ts` mirroring an existing paired-negative test
(pattern reference: `packages/core/hooks/done-md-completion-filter.test.ts`). For each `.sh` target, wire the
bash mutator from Stage 2 B (#366, universalmutator ADAPT, local/on-demand) to register an automated mutation
kill-rate where feasible (T-MUT-A: manual sanity ≠ automated).

## Tasks

- [ ] Task 1: Write content-level paired-negative mutation test for .claude/skills/meta-orchestrator/helpers/priority-score.sh
- [ ] Task 2: Write content-level paired-negative mutation test for .claude/skills/meta-orchestrator/helpers/plan-currency-check.sh
- [ ] Task 3: Write content-level paired-negative mutation test for .claude/skills/meta-orchestrator/helpers/launch-table-generator.sh
- [ ] Task 4: Write content-level paired-negative mutation test for scripts/check-skill-drift.sh
- [ ] Task 5: Write content-level paired-negative mutation test for packages/core/hooks/pre-push.fallback.sh

## §2 Acceptance (per sub-task)

- Test asserts real exit-code OR stdout/stderr content (not `.toBeDefined()` shape-only) — content-level per Stage 3 C.
- Test carries a mutation-sanity docstring (M.4 pattern).
- `npm --prefix packages/core run test:principles` (or the hooks test runner) green for the new file.

## §3 AI-traps active (per `.claude/rules/ai-laziness-traps.md §2`)

T3 (no prose-only — real exit/stdout cites), T16 (verify bash-mutator output format before wiring, don't assume by name),
T20 (no «this assertion is enough» without running the test red-on-mutant / green-on-real).

## §4 Stop conditions

- Genuine fork on assertion shape / gate strictness → PARK (manualReviewRequired), do not guess.
- aif container unreachable → STOP, report.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
