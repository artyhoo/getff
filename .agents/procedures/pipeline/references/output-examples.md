# Pipeline worked examples

> **Authoritative for:** the complete relocated §5 worked examples of [output-format.md](output-format.md).
> **NOT authoritative for:** the other report modes or the project goal; read [output-format.md](output-format.md) and its authority pointers.

## §5 Four worked examples

### Example 1 — Mode A single (R-phase audit, ~30k Opus)

```text
═══════════════════════════════════════════════════════════════
EXECUTION PLAN — meta-orchestrator-followup-audit (2026-05-24)
═══════════════════════════════════════════════════════════════

## Dependency graph

Stage 1 — NOW:
└── F.2 — Cold review of SKILL.md   (Mode A, ~30k, read-only)

## Action queue — what you do next

| # | Paste into a new CC tab | When | Waiting on | Can parallel with |
|---|-------------------------|------|------------|-------------------|
| 1 | Stage 1 block below | Now | — | — |

Total pastes: 1.

## 1-liner blocks (copy ONE block = ONE new CC session)

### Stage 1 — Cold review (Mode A, ~30k)

**What it does:** runs a cold-eye review of SKILL.md as a fresh reader (without your session context), looks for structural drift / missing sections / broken refs; does NOT edit files — REPORT only.
**Deliverable:** REPORT with GO/REVISE/STOP verdict + per-section findings (file:line + suggestions) inline in session output, no commits.
**Why now:** F.1+G-design + F.3 UX shipped; before closing the audit umbrella an independent check is needed that the F.2 deliverable (cold-review of SKILL.md) is consistent with binding spec G §1.5 — otherwise T19 (own QA before handoff).

/orchestrator meta-orchestrator-followup-audit §1 Sub-wave F.2 — Mode A reviewer cold-eye of SKILL.md, return REPORT, no edits, rest in kickoff
═══════════════════════════════════════════════════════════════
```

### Example 2 — Mode SDD (implementation and protocol-owned reviews, ~80k Opus)

```text
═══════════════════════════════════════════════════════════════
EXECUTION PLAN — feature-X-SDD-build (2026-05-25)
═══════════════════════════════════════════════════════════════

## Dependency graph

Stage 1 — NOW:
└── SDD protocol within the authorized session:
    Implementer ↓ spec + quality acceptance (read-only review)
    Actual installed companion owns combined/separate reviewer seats
    Findings ↓ implementer fixes ↓ repeat affected reviews
    Required final branch review + verified checks + merge authority ↓ Stage 1 PR merge
                                  ↓
Stage 2 — after Stage 1 PR merges:
└── Smoke test runner    (Mode A, ~10k)

## Action queue — what you do next

| # | Paste into a new CC tab | When | Waiting on | Can parallel with |
|---|-------------------------|------|------------|-------------------|
| 1 | Stage 1 block below | Now | — | — |
| 2 | Stage 2 block below | After Stage 1 PR merges | Stage 1 PR merged | — |

Total pastes: 2.

## 1-liner blocks (copy ONE block = ONE new CC session)

### Stage 1 — SDD build (Mode SDD, ~80k)

**What it does:** the invoked installed SDD protocol implements feature-X, reviews spec conformance and code quality with implementer correction/re-review, and performs its required final whole-branch review. Its current combined task-review seats govern actual execution; the framework's role vocabulary does not require extra reviewer sessions. Use only actually available and authorized host delegation capabilities; the role list is not three parallel tasks or proof of active subagents.
**Deliverable:** PR feature-X with code, tests, accepted spec/quality reviews and verification receipts; merging still requires current-head checks and the applicable merge authorization.
**Why now:** this fixture supplies a frozen kickoff §3 binding spec and resolved dependencies; the selected SDD protocol owns task decomposition and review sequencing. Role count alone does not establish independent tasks or mode eligibility.

/orchestrator feature-X-SDD-build §3 — Mode SDD implementation, task review and final branch review per the installed companion, rest in kickoff

### Stage 2 — Smoke test (Mode A, ~10k)

**What it does:** runs feature-X integration smoke (curl endpoints / `npm test -- smoke` / any manual-liveness probe per kickoff §4), does not edit code.
**Deliverable:** smoke output (pass/fail per probe) inline in session report, or BLOCKER finding if something broke after merge.
**Why now:** Stage 1 PR merged, feature-X in staging; CI pass ≠ runtime-verified (T19), an independent post-merge probe is needed BEFORE umbrella closure.

/orchestrator feature-X-SDD-build §4 — Mode A runner checks smoke, rest in kickoff
═══════════════════════════════════════════════════════════════
```

### Example 3 — Mode B × N parallel workers in worktrees (~150k Opus)

```text
═══════════════════════════════════════════════════════════════
EXECUTION PLAN — refactor-large-module (2026-05-25)
═══════════════════════════════════════════════════════════════

## Dependency graph

Stage 1 — NOW (3 parallel worktrees):
├── Worker 1 — module/auth   (Mode B worktree, ~50k)   PARALLEL-OK ↔
├── Worker 2 — module/api    (Mode B worktree, ~50k)   PARALLEL-OK ↔
└── Worker 3 — module/db     (Mode B worktree, ~50k)
                                  ↓
Stage 2 — after all Stage 1 PRs merge:
└── Integration smoke    (Mode A, ~20k)

## Action queue — what you do next

| # | Paste into a new CC tab | When | Waiting on | Can parallel with |
|---|-------------------------|------|------------|-------------------|
| 1 | Stage 1 Worker-1 block below | Now | — | Worker-2 + Worker-3 |
| 2 | Stage 1 Worker-2 block below | Now | — | Worker-1 + Worker-3 |
| 3 | Stage 1 Worker-3 block below | Now | — | Worker-1 + Worker-2 |
| 4 | Stage 2 block below | After 3 Stage 1 PRs merge | 3 PRs merged | — |

Total pastes: 4 (3 in parallel in Stage 1 + 1 in Stage 2).

## 1-liner blocks (copy ONE block = ONE new CC session)

### Stage 1 Worker-1 — auth refactor (Mode B worktree, ~50k)

**What it does:** refactors `module/auth` in a separate worktree (parallel-subwave-isolation §1 + §4a node_modules links MANDATORY); all edits inside `module/auth/**`, tests in `module/auth/__tests__/`.
**Deliverable:** PR `refactor/auth-<scope>` with green CI, file:line evidence for cold-review.
**Why now:** this fixture's kickoff §4 explicitly supplies mutual parallel declarations, disjoint auth/api/db write scopes, isolated worktrees and shared-dependency ownership. Those scoped contracts establish parallel safety; absent dependency edges alone do not. Actual capacity and dispatch authorization remain prerequisites, and elapsed time is not predicted by worker count.

/orchestrator refactor-large-module §4 Worker-1 auth — Mode B implementer in worktree, autonomous, rest in kickoff

### Stage 1 Worker-2 — api refactor (Mode B worktree, ~50k)

**What it does:** refactors `module/api` in worktree #2; scope is limited to `module/api/**`; does not touch auth or db (shared file race trap counter).
**Deliverable:** PR `refactor/api-<scope>` with green CI.
**Why now:** parallel-safe with Worker-1 and Worker-3 (different file-scopes); one of 3 sub-waves of Stage 1.

/orchestrator refactor-large-module §4 Worker-2 api — Mode B implementer in worktree, autonomous, rest in kickoff

### Stage 1 Worker-3 — db refactor (Mode B worktree, ~50k)

**What it does:** refactors `module/db` in worktree #3; scope `module/db/**`.
**Deliverable:** PR `refactor/db-<scope>` with green CI.
**Why now:** third of 3 parallel-safe sub-waves; completes Stage 1.

/orchestrator refactor-large-module §4 Worker-3 db — Mode B implementer in worktree, autonomous, rest in kickoff

### Stage 2 — Integration smoke (Mode A, ~20k)

**What it does:** runs integration tests on staging after all 3 refactor PRs merge, verifies that auth↔api↔db did not break at the boundaries (regression surface from parallel refactor).
**Deliverable:** integration test output inline; or BLOCKER finding if cross-module contracts are violated.
**Why now:** Stage 1 ×3 PRs merged → staging has all 3 refactored modules; unit tests in each PR are OK, but integration surface catches cross-module issues only post-merge — critical to validate the parallel-refactor pattern.

/orchestrator refactor-large-module §5 — Mode A runner integration smoke across 3 modules, rest in kickoff
═══════════════════════════════════════════════════════════════
```

### Example 4 — Mode Queue (sequential research kickoff queue, ~120k Opus)

```text
═══════════════════════════════════════════════════════════════
EXECUTION PLAN — research-umbrella-Q (2026-05-25)
═══════════════════════════════════════════════════════════════

## Dependency graph

Stage 1 — NOW (sequential queue):
├── R1 — prior-art sweep    (Queue iter 1, ~30k)
├── R2 — gap analysis       (Queue iter 2, ~30k, after R1)
├── R3 — verdict synthesis  (Queue iter 3, ~30k, after R2)
└── R4 — patch draft        (Queue iter 4, ~30k, after R3)

## Action queue — what you do next

| # | Paste into a new CC tab | When | Waiting on | Can parallel with |
|---|-------------------------|------|------------|-------------------|
| 1 | Stage 1 Queue block below | Now | — | — |

Total pastes: 1 (Queue mode internally processes all 4 R-iters autonomously).

## 1-liner blocks (copy ONE block = ONE new CC session)

### Stage 1 — Queue mode R1→R4 (Queue mode, ~120k)

**What it does:** one Opus session iterates R1 (prior-art sweep) → Reviewer GO/REVISE → R2 (gap analysis) → Reviewer GO → R3 (verdict synthesis) → Reviewer GO → R4 (patch draft) → Reviewer GO; each R-iteration produces incremental output, with a cold-review checkpoint between them automatically.
**Deliverable:** one research-patch with R1-R4 sections + Reviewer GO chain logged; or REVISE-loop with explicit escalation.
**Why now:** kickoff §2 enumerated 4 sequential R-iterations with iterative-review-each semantics; Queue mode threshold (≥2 sequential R-kickoffs) met; flat-queue dispatch without stage-gates is OK because this is an R-only umbrella (no I-phase build downstream).

/orchestrator research-umbrella-Q §2 — Mode Queue iterative review of each iteration (R1 → R2 → R3 → R4), autonomous, rest in kickoff
═══════════════════════════════════════════════════════════════
```

---
