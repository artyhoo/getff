# KICKOFF — aif question-loop (collect → brainstorm-resolve → resume)

> **Type:** I-phase umbrella. Builds the question-loop MVP on top of the merged runtime-bridge dispatch (#312/#313).
> **Authoritative for decisions:** `docs/superpowers/specs/2026-05-31-aif-question-loop-design.md` (PR #315) — read it FIRST; this kickoff does not re-litigate the decisions, it executes them.
> **Base branch:** staging.
> **Mode:** Mode A (inline Agent on Opus) per sub-task; verify-first spikes before dependent build.

## §0 Goal (one line)

aif works autonomously (async batch, doesn't stop), parks only genuine forks; the maintainer resolves accumulated questions per-umbrella in one chat (work continues), answers flow back via the bridge, aif finishes. Two thin CLIs + reuse of everything else.

## §1 Read-first
1. `docs/superpowers/specs/2026-05-31-aif-question-loop-design.md` — SSOT for all decisions (§7), layers (§1), reuse/build (§2), trust dial (§Layer 1), prerequisite (§4).
2. Merged code: `packages/runtime-bridge/src/AifHandoffBackend.ts` (REST dispatch + `_rest`), `aifWsStatus.ts` (WS + `getTaskStatus`), `cli/await.ts` (read-back pattern to mirror), `resolver.ts`.
3. `.claude/hooks/ask-question-reminder.sh` — the fork-challenge discipline the resolution agent runs under.
4. `docs/runtime-bridge-setup.md` — env + ports + clean-worktree precondition.

## §2 Prerequisite (BLOCKS all live testing — flag to maintainer, do NOT mutate their env)
aif project clone must gitignore `.ai-factory/` (its own plan-write trips branch-isolation — live-found 2026-05-31). This is maintainer/aif-handoff setup. The build + unit tests do NOT need it; only the live E2E does.

## §3 Verify-first spikes (run BEFORE building the dependent piece — T13/T16)
- **S1 (gates `cli/answer.ts`):** determine the exact REST/MCP call that re-opens a `done`+`manualReviewRequired` task with the answer in context — a specific event on `POST /tasks/:id/events`? aif's Approve/Request-changes via REST/MCP? Verify live against a real flagged task (needs §2 done). Document the verified sequence; if none works cleanly, surface as DECISION-NEEDED before building.
- **S2 (gates the Superset fast-follow, NOT the MVP):** does the fork-challenge hook (`ask-question-reminder.sh`) fire inside Superset `superset-chat`, or is that a non-CC agent? If not, the resolution discipline is carried by prompt instead. Defer S2 until the MVP core lands.

## §4 Build (MVP — after S1)
1. **`cli/questions.ts <umbrella>`** — `GET /tasks?projectId` → filter `manualReviewRequired:true` / `blocked_external` → extract `autoReviewState` findings → print a structured per-umbrella digest (taskId, title, question). Reuse the `fetch`+`BackendError` style of `aifWsStatus.getTaskStatus`.
2. **`cli/answer.ts <umbrella>`** — per resolved question: push the answer (append to plan / annotate) + resume the task via the S1-verified mechanism. Idempotent/reversible; errors → BackendError; no destructive ops.
3. **Enable aif-native Telegram** (config/doc; 0 code) for per-question pings. Document in `docs/runtime-bridge-setup.md`.
4. **Tests:** unit (mock `fetch`) for questions-filter + answer-sequence + error mapping. Live E2E deferred to §2-ready.
5. **Resolution agent runs under the fork-challenge hook** (this-session behavior): auto-resolves unambiguous questions, surfaces only genuine forks. No new auto-resolver to build.

## §5 BFR §3 (before BUILD — T11/T12)
Search (SSOT `prior-art-evaluations.md` + DeepWiki ≥3 phrasings + WebSearch): does any upstream do "pull an agent-runtime's review-questions into a chat + push answers back + resume"? Likely BUILD (thin, project-specific), but cite the search + add an SSOT entry if a candidate surfaces. The two CLIs add **no new dependency** (native fetch) → confirm not a capability commit, or carry the Prior-art trailer if a new dep appears.

## §6 AI laziness traps (per `.claude/rules/ai-laziness-traps.md §2` — MANDATORY)
Active: **T3** (every claim = file:line / live output), **T5** (spikes produce findings, not code), **T11/T12** (BFR search before build), **T13/T16** (don't trust aif's review-quality or Superset's MCP shape without live/source verification — that's S1/S2), **T19** (own cold-QA on the diff before handoff), **T20** (no verdict without a tool call).
Domain-specific: **T-QL-A** — «tempted to build `cli/answer.ts` on an assumed resume mechanism without S1». Counter: S1 is a hard gate; if the resume call is unverified, STOP and surface, don't guess. **T-QL-B** — «tempted to bake distrust/trust of aif as a constant». Counter: it's a tunable dial (design §Layer 1); ship neutral config + make it configurable.

## §7 §1.7 self-reflexive
- Forward: build-first-reuse (Layers 1-2 reuse; only 2 thin CLIs BUILD — §5 search); no-paid-llm (client-side HTTP + operator subscription); dual-implementation (Superset-agnostic core); doc-authority (design doc has header).
- Backward: builds on #312/#313; reuses `aifWsStatus.ts` WS; modifies no merged artefact.

## Finish REPORT with
S1 verified resume sequence (evidenced) · cli/questions.ts + cli/answer.ts file:line + tests green · BFR §3 search result · §1.7 presence · what's deferred (Superset fast-follow, live E2E pending §2) · `## 🟢 Простыми словами`.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
