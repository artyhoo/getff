# runtime-bridge vendor copy (S5 A7)

> **Spec:** [`docs/superpowers/specs/2026-07-23-beta-program-design.md`](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md) §4 A7 (lines 285-289).
> **Kickoff:** [`.claude/orchestrator-prompts/beta-delivery-ux/kickoff-s5.md`](../../../.claude/orchestrator-prompts/beta-delivery-ux/kickoff-s5.md) §3.
> **Plan:** [`.ai-factory/plans/feature-beta-delivery-ux-eac3a0.md`](../../../.ai-factory/plans/feature-beta-delivery-ux-eac3a0.md) §3 + §4 Tasks 3-5.

## What this is — COPY, not a dependency

This directory is a **one-way COPY** of the framework's `packages/runtime-bridge/src/` subset +
the bash dispatch hook at `.claude/hooks/runtime-bridge-dispatch.sh`. The `factory` install
profile copies it into the consumer repo at `.claude/vendor/runtime-bridge/` so a consumer
(non-framework) project can dispatch aif tasks **without depending on the framework npm package**.

Spec A7 binds COPY (not symlink, not submodule, not npm dep). npm packaging of the bridge is
**deferred to U9** (post-announce) — see «U9 falsifier» below.

## What's in the copy (minimum-for-dispatch subset)

The copy is the **complete transitive import closure of `cli/dispatch.ts`** — verified at copy
time by tracing `import { ... } from '...'` chains:

| File | Reached from |
|---|---|
| `src/cli/dispatch.ts` | entry |
| `src/kickoff.ts` | dispatch → `../kickoff.js` |
| `src/idempotency.ts` | dispatch → `../idempotency.js`; kickoff → `./idempotency.js` |
| `src/resolver.ts` | dispatch → `../resolver.js` |
| `src/ManualBackend.ts` | dispatch → `../ManualBackend.js`; resolver → `./ManualBackend.js` |
| `src/backend.ts` | dispatch → `../backend.js`; transitively from most files |
| `src/AifHandoffBackend.ts` | resolver → `./AifHandoffBackend.js` |
| `src/aifWsStatus.ts` | AifHandoffBackend → `./aifWsStatus.js` |
| `src/types.ts` | type-only; transitively from most files |
| `src/cli/ensure-parallel.ts` | AifHandoffBackend → `./cli/ensure-parallel.js` |
| `src/cli/aifHttp.ts` | cli/ensure-parallel → `./aifHttp.js` |
| `src/cli/park.ts` | cli/ensure-parallel → `./park.js` |
| `src/cli/openQuestion.ts` | cli/park → `./openQuestion.js` |
| `hooks/runtime-bridge-dispatch.sh` | bash PostToolUse hook (paired with this CLI) |

**Files NOT copied** (deliberate):
- `src/AifFireBackend.ts`, `src/index.ts` — referenced only outside the dispatch closure.
- `src/cli/{answer,await,harvest,questions}.ts` — the agent-loop entrypoints (consumer runs
  `/harvest`, `/questions`, etc.). Whether to vendor these is **PARKED (P1)** — see «Parked forks».

## Env-var contract

The vendored CLI reads these env vars (same convention as the framework copy; resolution in
`src/resolver.ts` + `src/AifHandoffBackend.ts`):

| Env var | Purpose | Required? |
|---|---|---|
| `RUNTIME_BRIDGE_MODE` | `manual` / `aif-handoff` / `auto` (auto falls back to ManualBackend if aif-handoff unreachable) | yes (or `--mode` flag) |
| `RUNTIME_BRIDGE_AIF_URL` | aif-handoff REST/WS base (default `http://localhost:3009`) | for `aif-handoff`/`auto` |
| `RUNTIME_BRIDGE_AIF_MCP_URL` | aif-handoff MCP base (default `http://localhost:3100`) | optional |
| `RUNTIME_BRIDGE_AIF_PROJECT_ID` | project ID for the aif-handoff task queue | for `aif-handoff`/`auto` |
| `RUNTIME_BRIDGE_DEDUP_PATH` | per-project dedup-log path (see «Smoke-enabling stub» below) | optional (smoke only) |

## Per-project dedup-log path — smoke-enabling STUB

The framework copy at `packages/runtime-bridge/src/idempotency.ts:20` hardcodes
`/tmp/runtime-bridge-dedup.jsonl` (shared global log). When vendored into N consumers,
that global path would cross-contaminate dedup state — spec A7 (lines 287-288) mandates
«dedup-log path becomes per-project».

**In this vendored copy ONLY**, `src/idempotency.ts:32` reads:
```ts
const DEDUP_PATH = process.env.RUNTIME_BRIDGE_DEDUP_PATH ?? join(tmpdir(), 'runtime-bridge-dedup.jsonl');
```

**This is a stub, NOT a resolution of the underlying mechanism choice.** The actual mechanism
(env var vs relative path vs config file) is **PARKED (P3/P5)** — see below. The stub is the
minimum to make the dispatch smoke (Task 7) runnable without guessing the parked decision.

**Other hardcoded paths NOT stubbed (honest gap, in-scope of P3):**
`src/ManualBackend.ts` uses `/tmp/runtime-bridge-<taskId>.md` and `/tmp/runtime-bridge-<taskId>.response.md`
for the manual-fallback path (used when `RUNTIME_BRIDGE_MODE=manual` or auto-fallback when
aif-handoff is unreachable). These are NOT stubbed — they remain hardcoded. They are per-task
(unique taskId) so cross-consumer contamination is not a practical concern (taskIds are UUIDs),
but they DO fall under P3's "vendor/framework path-resolution" park scope. Not extended here
because the plan §3.3 explicitly scopes the stub to the dedup path only.

## Parked forks (forward pointers)

Five forks are deliberately **not resolved** in this stage; the executor proceeded only on the
unambiguous minimum-for-dispatch slice. Each park will be cited into the PR body at handoff.

- **P1 — Runtime-bridge subset boundary** (kickoff §1.1). Vendor the dispatch closure (DONE
  here) vs vendor all 9 entrypoints + hook (full agent loop in the consumer). Spec A7 line 286
  says «CLI entrypoints» (plural) without deciding the boundary.
- **P2 — Vendor/framework import-coupling** (kickoff §3 sub-fork a). Self-contained snapshot
  (frozen, this copy) vs shared-types import (drifts with framework). Current choice: snapshot.
- **P3 — Vendor/framework path-resolution** (kickoff §3 sub-fork b). Env vars vs hardcoded
  framework paths inside the vendored `.ts` code. Current stub: env-var override for the dedup
  path ONLY (`RUNTIME_BRIDGE_DEDUP_PATH`).
- **P4 — Vendor/framework update-mechanism** (kickoff §3 sub-fork c). Manual re-vendor vs sync
  script vs never-until-U9. No choice made — copy is frozen at S5 commit.
- **P5 — Dedup-log path mechanism** (kickoff §1.2). Env var vs relative path vs config file.
  Current stub: env var (`RUNTIME_BRIDGE_DEDUP_PATH`), but explicitly NOT a resolution.

Full park statements with fork options + evidence: PR body §«Parked forks» (authored at
pre-handoff QA, Task 8) + commit C2 message body.

## U9 falsifier (spec A7 line 288-289)

> «first foreign tester blocked by vendoring → raise bridge packaging priority»

If the dispatch smoke (plan Task 7) or any foreign tester reveals a blocker the vendor copy
cannot surmount (drift too fast, subset unworkable, missing-file churn), the spec's named
escape is to **UN-defer U9 — npm-package the bridge** instead of vendoring. Such a blocker
MUST be recorded with the U9 escalation explicitly proposed; do NOT park as a generic «blocked».

## How to run

```bash
# Consumer repo, after factory-profile install placed this at .claude/vendor/runtime-bridge/
export RUNTIME_BRIDGE_MODE=auto
export RUNTIME_BRIDGE_AIF_URL=http://localhost:3009
export RUNTIME_BRIDGE_AIF_PROJECT_ID=my-consumer-project
tsx .claude/vendor/runtime-bridge/src/cli/dispatch.ts path/to/kickoff.md
```

The `tsx` runtime is a peer requirement (consumer installs `tsx` separately; `package.json`
here declares it `peerDependencies` for documentation, not as an installable dep tree).

## Update mechanism — NOT DEFINED (parked, P4)

When the framework copy at `packages/runtime-bridge/src/` changes, this vendored copy does
**not** auto-track. Re-vendor is a manual `cp -r` from `src/` (preserving the idempotency.ts
stub). A sync script or npm-package replacement is parked — see P4 above.
