# I-phase — AifFireBackend (dispatch-only) + operator `/fire` runbook

> Decision origin: brainstorm `.claude/orchestrator-prompts/f2-fire-statusreadback-brainstorm/prompt.md`, resolved 2026-06-01. **DN-1 = A + D** (maintainer). STEP-1 evidence: `/fire` has NO programmatic status-read endpoint and its per-routine token is **write-only by design** ("no read access") — `platform.claude.com/docs/en/api/claude-code/routines-fire`. So Option B (REST status endpoint) is dead; we build A (honest dispatch-only backend) + D (operator runbook).

## TASK
Wire `/fire` (CC Routines) into `runtime-bridge` as an **honest dispatch-only backend** that never lies about completion, plus a parallel operator runbook + helper script. REST stays the default backend with full `cli/await.ts` parity; `/fire` is presence-gated opt-in for the laptop-closed / cloud capability.

## Hard constraints (load-bearing — Phase -1 must verify each)
1. **No lying / no hang.** The backend's `awaitDone()` MUST NOT poll-forever. `/fire` gives a `session_id` + `session_url` and nothing else (`POST` "does not wait for the session to complete"; token has no read access). So `awaitDone()` must resolve **immediately** with a non-success terminal result that carries the `session_url`, OR throw a typed `BackendError`. A "does-not-hang" test is mandatory.
2. **Honest `getStatus()`.** It cannot return a fake `running` forever. Decide the encoding against the REAL types (see §Type-decision below).
3. **Agnostic core intact.** `/fire` is NEVER the default; selected only when `available()` is true (token + beta header configured). REST remains default. `packages/core` imports nothing from `runtime-bridge` (DECISION=C, `backend.ts:6-8`). `dual-implementation §3`.
4. **DN-2 cost policy.** Document: operator-manual / interactive `/fire` = OK (subscription-bundled). Committed-CI `/fire` = **DEFER-permanent** (`#paid-llm-creep`, `no-paid-llm-in-ci` — it's an `api.anthropic.com` call drawing subscription usage + metered overage). No CI workflow may call it.

## Type-decision the implementer MUST resolve (don't skip — flag to Phase -1)
`packages/runtime-bridge/src/types.ts:44` — `TaskStatus.status` is only `'pending' | 'running' | 'done' | 'error'`. There is **no** `blocked_external`. The brainstorm's idealized "blocked_external" doesn't exist in the codebase. Pick ONE and justify:
- (a) Extend `TaskStatus.status` union with `'unobservable'` (or reuse `'error'` with a distinct `rawStatus`), `TaskHandle.backend` union with `'aif-fire'`, `RuntimeBackend.name` union likewise (`backend.ts:16`, `types.ts:32`). Cleanest but touches the shared type — ripples to `ManualBackend`/`AifHandoffBackend` exhaustiveness.
- (b) Keep types as-is; `getStatus()` returns `{status:'running', rawStatus:'dispatched_no_readback'}` once and `awaitDone()` returns `{success:false, finalStatus:'dispatched_no_readback', meta:{session_url}}` immediately. Minimal blast radius; the honesty lives in `rawStatus`/`finalStatus`, not the coarse enum.
- Recommend (a) only if a `dispatchOnly` capability needs to be machine-checkable by callers; otherwise (b) is lower-maintenance (`build-first-reuse §2`).

## Files (grounded in real tree)
- NEW `packages/runtime-bridge/src/AifFireBackend.ts` — mirror `AifHandoffBackend.ts` structure; `dispatch()` = POST `/fire` (bearer `sk-ant-oat01-…` + `anthropic-beta: experimental-cc-routine-2026-04-01` + `anthropic-version`); `available()` = presence-gate on token/beta env config (cheap, ≤1s, no side effects); `getStatus`/`awaitDone` per §Hard-constraints.
- NEW test alongside existing backend tests (follow placement of the `AifHandoffBackend` / `ManualBackend` tests) — MUST include the **does-not-hang** assertion (call `awaitDone` with no timeout, assert it returns/throws fast).
- EDIT `packages/runtime-bridge/src/index.ts` — export the new backend (opt-in).
- EDIT `packages/runtime-bridge/src/backend.ts` + `types.ts` ONLY if §Type-decision (a) chosen.
- NEW `scripts/fire-routine.sh` — curl POST helper (token + beta header) for operator-manual use.
- NEW/EDIT runbook section — how to: create routine + API trigger at claude.ai/code/routines, generate token, fire, watch `session_url` in browser, review the routine's PR. State explicitly: `/fire` = operator-manual, no `await` parity.
- DOC: record DN-2 verdict in the relevant SSOT/doc (committed-CI = DEFER-permanent).

## Capability-commit gate (CLAUDE.md)
`AifFireBackend.ts` ≥80 LOC under `packages/` ⇒ **capability commit** ⇒ requires SSOT consult + `Prior-art:` trailer. The F2 evaluation already exists (`prior-art-evaluations.md` F2 / `/fire` cluster) — cite it. Do the build-vs-reuse consult per CLAUDE.md before the commit.

## T-traps active (per `.claude/rules/ai-laziness-traps.md §3`)
- **T3** — no prose-only claims; every VERIFY line = command output or file:line.
- **T16** — `/fire`'s name resembles a dispatch backend, but its problem-class (fire-only, no read-back) ≠ a full backend's. Don't pattern-match it into a fake `awaitDone`. This is the whole point of the honest-dispatch-only design.
- **T19** — own cold-QA before handoff; CI ≠ design review.
- **T-Fire-A** (domain-specific) — implementer tempted to make `awaitDone()` poll the `session_url` HTML or guess completion from git side-effects. Forbidden: token has no read access; any such poll is a hack outside the documented contract. `awaitDone` stays honest-fast.

## Process
- **Phase -1 cold-review MANDATORY** (runtime-bridge code change = blast radius): ≥1× Opus reviewer over this kickoff before dispatch; verify the §Type-decision is actually decided, the does-not-hang test is specified, and no CI path calls `/fire`.
- Mode A (inline `Agent`, `isolation: "worktree"`) for the implementation. TDD per `superpowers:test-driven-development` (write the does-not-hang + presence-gate tests first).
- One umbrella, one PR → staging.

## VERIFY (worker must attach evidence)
1. `<TYPECHECK>` exit 0 (union exhaustiveness if §Type-decision (a)).
2. `<TEST>` green incl. **does-not-hang** + `available()`-false-when-unconfigured tests.
3. grep: no `.github/workflows/*` references `/fire` / `routines/*/fire` (DN-2 gate).
4. `AifFireBackend` is NOT wired as default; REST default unchanged.
5. Capability commit carries `Prior-art:` trailer.
```text
```

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
