# Intent Continuity C/D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make current result evidence and adopted launch/resume authority survive relevant change, then deliver the canonical and vendored paths with honest host limits.

**Architecture:** Extend the existing intent selector, result-review helper and runtime-bridge effect guards. A single adopted-effect check resolves current PRD, agreed specification and matching spec review independently of an editable kickoff; immutable result attempts remain in the existing result-review journal. Generated runtime copies are rendered from their canonical source.

**Tech Stack:** Node.js ESM helpers, TypeScript runtime-bridge, Vitest, existing shell checks.

**Spec:** `docs/superpowers/specs/snapshots/intent-continuity/design-31000fc2b2bd0fc2c98f7315ec011660be9767a7e5be9cbfdc306fa334bbd078.md` §§4, 7–9; approved PRD snapshot `f1a42d1c...`.

## Global Constraints

- Preserve the existing WIP in `/Users/art/.codex/worktrees/0166/rules-as-tests-aif`; no bulk staging, reset, clean, commit, push, PR or merge.
- Preserve both authorized autonomous and manual launch routes; an explicit design-only instruction never writes an auto marker.
- No new scheduler, global advisor registry, or paid LLM CI gate.
- Current authority is selected independently from the candidate; a hash checks identity, not semantic relevance.
- Product promise changes require operator discussion; material agreed-spec replacements require renewed specification discussion.

## Review Focus

- An unchanged kickoff or PlanReview after PRD/spec supersession must hold before each adopted effect.
- Removing an adoption marker from a new kickoff must not yield legacy treatment.
- A changed observation or relevant input must make old `matches` attempts historical without deleting them.
- Repair of one result must not invalidate independent features.
- The host hook's nonblocking nature must not be reported as hard interception of arbitrary manual execution.

---

### Task 1: Current result evidence and change invalidation

**Files:** `.agents/procedures/intent/helpers/check-result-review.mjs`, `.agents/procedures/intent/references/result-review.md`, `packages/core/skills/intent-result-review.test.ts`.

**Interfaces:** Consume `IntentContract` and immutable ResultReview attempts. Produce a current-attempt check bound to the current approved PRD, observed revision, result ID and selected dependency scope. Preserve historical attempts.

- [x] Add a failing test: previously matching attempt becomes noncurrent after relevant observed revision/PRD change; unaffected result remains current.
- [x] Add a failing test: repair can cite the old failed/historical attempt; expansion cannot consume it as current permission.
- [x] Implement the narrow selector/check using existing content-ref and publication conventions.
- [x] Run focused tests and verify immutable attempt files are unchanged.

### Task 2: Adopted effect authority

**Files:** `packages/runtime-bridge/src/resultReview.ts`, `packages/runtime-bridge/src/cli/{dispatch,claim,start-reviewed,answer}.ts`, matching runtime tests and intent selector helper as needed.

**Interfaces:** Consume feature/stage adoption identity, current PRD/spec/review selector and the task/kickoff payload. Produce hold/pass immediately before reachable dispatch, release, implementation start and answer-driven resume effects.

- [x] Add failing tests for PRD A→B and agreed spec A→B while kickoff/PlanReview bytes stay unchanged.
- [x] Add failing tests for absent adoption identity and missing current evidence; frozen legacy continues unchanged.
- [x] Implement one shared check, called at the actual effect boundaries, and rerun tests.
- [x] Exercise the hook/CLI effect paths through the runtime suite and a read-only live AIF admission probe; document external/manual limits in C/D acceptance.

### Task 3: Canonical delivery and acceptance

**Files:** canonical `.agents/**` procedure/helper paths, generated native cards and runtime vendor, relevant renderers/tests, `docs/superpowers/specs/reviews/intent-continuity/` evidence.

**Interfaces:** Installed skill text and vendor must reach the same runtime behavior as canonical source. Acceptance reports verified and unsupported hosts separately.

- [x] Run source-to-derived render/check rather than hand-editing generated twins.
- [x] Run host and feature regression tests, `git diff --check`, and a read-only current-selector query.
- [x] Perform bounded independent code and product reviews of exact final bytes; record the product `needs-evidence` limit without upgrading it.
- [x] Update the handoff and acceptance evidence; leave unrelated WIP untouched.

### Remaining product acceptance

- [ ] Observe a real first working result in the intended flow and obtain a fresh independent IC-P6 comparison that the evidence supports; do not substitute fixture success for `matches`.
- [ ] After a justified published `matches`, change a relevant observed input and show the old attempt is retained but no longer authorizes continuation until a fresh review.
