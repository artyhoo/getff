# Handoff — aif auto-review contract recovery (deliberate after compaction)

> **Status:** CLOSED 2026-09-10 — operator GO'd all three track-A proposals. Shipped:
> `AifHandoffBackend.claim()` now sends `maxReviewIterations: 4` (P3 + test);
> `heal.sh` grew the Tier-1 hook-drift sync, live-verified over ssh against pc-lan
> (371 files, 176 backed up, loop unaffected — P1); the incident is codified as aif-doctor
> SKILL §3.8 with detector→fix→reversibility mapping (P4, incl. the P2-interim state-reset
> surgery as a Tier-2 runbook fix). Open tail resolved the same morning: 2a95ba8f closed
> `done` with the `useSubagents:true` bypass verified (no "Unknown command", real review
> content), and the board DRAINED overnight (343/343 terminal) — the §3.4 base refresh is
> now unblocked and remains the one open operator item (batch with the §3.8 "parked"
> upstream fixes: bijection + AGENT_MAX_REVIEW_ITERATIONS default). The incident mechanics
> below stay as the §3.8 evidence base.
> **Authoritative for:** continuation state of the 2026-09-09 aif review-contract incident
> (what broke, what was applied, what is still open) and the shape of proposals P1–P4.
> **NOT authoritative for:** the aif-doctor skill (its SKILL.md stays SSOT), aif-handoff
> internals (upstream repo — cited by file:line of the running image only), any decision
> to adopt/reject P1–P4 (operator's, pending).

## Session-start for the continuation session

1. Read this file top to bottom; it is compaction-resilient (every load-bearing claim
   carries its evidence anchor).
2. **Verify live state before acting:** `curl -s localhost:3009/tasks` — statuses have
   been moving autonomously since 22:25 UTC 2026-09-09; do not trust this file's snapshot
   for current statuses, only for the incident mechanics.
3. If the pc-lan containers were rebuilt since: the `/tmp/doctor-*` backups are GONE
   (container-local); the hook fix survives only while bases carry `efd32faad5+`
   (verify: `docker exec -u node aif-agent-1 grep -c CLAUDE_CODE_ENTRYPOINT
   /home/www/rules-as-tests-aif/.claude/hooks/end-of-turn-reminder.sh` → 2).
4. Remote access reality: the aif stack runs on `pc-lan` (Windows, PowerShell) behind an
   ssh tunnel `pc-lan` → localhost:3009/3100/5180. PowerShell eats `\"`, `$( )`, and any
   metacharacter OUTSIDE a single-quoted `sh -c '…'` block — keep remote commands inside
   single quotes, pull logs locally and grep locally. `bridge-health.sh` fails locally by
   design here ("no aif agent container detected") — the containers are not local.

## The incident — four stacked defects (one pyramid)

**Symptom:** tasks piled up in raw status `review` with `manualReviewRequired:true`;
auto-review never closed anything. Zero structured parses in the entire task DB before
the fix (the `efd32faad5` commit message measured "503 of 503" legacy-fallback; our own
DB sweep found no `Auto Review Metadata` in any of 343 tasks).

1. **Recap Stop hook intercepted SDK sidecar sessions.** The reviewer/security sidecars
   run as claude SDK sessions in the task worktree; the repo's `end-of-turn-reminder.sh`
   demanded a plain-words recap of their final turn, the model answered recap-only, and
   aif took that LAST message as the sidecar result — `## Blocking Findings` never reached
   `parseStructuredSidecarOutput` (`packages/agent/src/reviewContract.ts:95`, running
   image). **Fixed by `efd32faad5`** (guard on `CLAUDE_CODE_ENTRYPOINT` `sdk-*` prefix) —
   already in staging and in the container bases.
2. **Worktrees copy `.claude` once, at creation** (`copyProjectContextToWorktree`,
   `packages/shared/src/gitIsolation.ts` in the image) — so every worktree created before
   the base refresh kept demanding the recap. Evidence: guard `grep -c` = 2 in bases
   (refreshed 17:37/17:46 UTC) but 0 in the live worktrees; "Structured review contract
   not satisfied" persisted until 20:39:45 UTC, after the fix and the refresh.
3. **Bijection deadlock in the previous-findings contract.** On a failed sidecar parse the
   gate re-reviews itself and APPENDS its own rephrased findings to `autoReviewState`;
   the sidecar parser (`reviewContract.ts:117–134`) requires the next verdict to
   adjudicate EVERY remembered finding exactly 1:1 (`previousFindings.length !==
   previousFindingsInput.length → null`). Live proof: state held 13 gate-rephrased
   findings, the reviewer consolidated them into 7 (all 7 IDs valid, all sections valid)
   → 7 ≠ 13 → null. **Unsatisfiable by construction after the first fallback round** —
   the more it fails, the more unparseable it gets.
4. **`maxReviewIterations` defaulted to 1** on most dispatches with counters already at
   2–4 → `max_iterations` park regardless of verdict quality (e.g. 5893d3a5 iter=3 max=1).

Exit-route fact (load-bearing for any future park release): in **non-participants mode**
`resolveLegacyAction` has NO event out of `review` (`stateMachine.ts` — measured 409
"Unknown task event"); the two working exits are `POST /tasks/:id/handoff
{"executionOwner":"ai"}` (coordinator re-picks ai-owned review tasks) or DELETE. This is
documented in our own `packages/runtime-bridge/src/cli/answer.ts:232`
(`reviewEventUnreachableReason`).

## Applied on the night (2026-09-09 UTC, under operator GO) — do not redo

| Mutation | Reversibility |
| --- | --- |
| Fixed `end-of-turn-reminder.sh` copied base → 9 live worktrees (guard=2 verified each) | `/tmp/doctor-hook-bak/<worktree>.sh` in the agent container |
| `POST /tasks/:id/handoff` → `executionOwner:"ai"` ×9 (+ re-releases after re-parks; one SQLITE_BUSY retry) | repeat handoff with `executionOwner:"human"` |
| `PUT /tasks/:id {"maxReviewIterations":6}` ×9 (route is PUT — PATCH 404s) | PUT the old value |
| SQLite: `auto_review_state_json=NULL, manual_review_required=0, review_iteration_count=0` ×9 — exact mirror of `CLEAN_STATE_RESET`; API cannot patch this field (`updateTaskSchema` lacks it) | `/tmp/doctor-ars-backup.json` in the api container |
| `2a95ba8f`: `useSubagents:true` (PUT) | PUT false |

**Verified outcome (22:12–22:25 UTC):** first structured parses in system history —
`Auto Review Metadata` present in 5 tasks' reviewComments; `rework_requested
iteration=1/6 previous=0` for 5190de27 / 5dfecf25 / 3fff3de9 / ab04dfc5; the loop runs
autonomously (ai-owned review tasks are re-picked by lane passes; state lineage now comes
from the sidecar's own finding IDs, so the bijection converges).

## Open items (check before closing deliberation)

1. `2a95ba8f` — the `useSubagents:true` bypass of "Unknown command: /aif-review" was
   NOT yet verified (its review was still queued at handoff time). Failure signature:
   `reviewComments` len=105 containing "Unknown command". Root cause of the no-subagent
   path: `reviewer.ts:168` prepends `/aif-review ` to the prompt while no such command
   exists anywhere (`.claude/commands` absent in all bases/worktrees) — historical hits:
   a4154924 (Jun 3), eb30b350 (Jun 27), 2a95ba8f (Sep 9).
2. Container bases stale vs live tips (rat `efd32faad5` → staging `aafaf728c6`;
   timeliner `99d33a42` → `6259aaa3`) — run `refresh-aif-base.sh` only when no task is
   in flight.

## Proposals to deliberate (NOT decided — this is the operator's fork)

### P1 — worktree hook-drift sync (this repo: aif-doctor `heal.sh`)
Add a Tier-1 heal step: sync the fixed hook(s) from the base clone into live worktrees.
Open questions: scope — only `end-of-turn-reminder.sh` vs all `.claude/hooks` vs the full
overlay (full overlay risks clobbering coordination symlinks — §3.5 EEXIST history);
trigger — heal preflight vs upstream review-stage entry. **Upstream counterpart**
(aif-handoff): re-run the `.claude` overlay at review-stage entry, not only at worktree
creation — the long-term correct home; the heal step is the stopgap.

### P2 — bijection deadlock (upstream: `reviewContract.ts:117–134`)
Options: (a) accept subset adjudication — drop the count equality, treat unadjudicated
input findings as `still_blocking` (fail-safe: no blocker can lapse silently);
(b) dedupe at state-write — gate stores canonical IDs only (`createAutoReviewFindingId`
over normalized text) so rephrasings collapse; (c) both. Interim doctor-side: detector
signature = "state findings count grows while 'Structured review contract not satisfied'
persists across iterations" → auto-reset state (codify tonight's manual surgery).

### P3 — `maxReviewIterations` default (upstream + our dispatcher)
Default 1 parks on the first rework round. Set 3–5 at dispatch time
(`packages/runtime-bridge/src/cli/dispatch.ts`) and/or fix the upstream default.

### P4 — aif-doctor catalogue §3.8 (this repo, skill edit)
Codify the observed mode ("review-contract park cascade"): detectors (recap-only or
Unknown-command reviewComments + `malformed_review_output_fallback` parks + state
growth), mapped fixes (tonight's sequence). Skill edits go through the `/ai-doc`
discipline when that work starts — this handoff is the evidence base.

## Without this file

The post-compaction session re-derives the pyramid from scratch: why `efd32faad5` did
not stop the parks (worktree drift), why a correct verdict still parsed null (bijection),
which exit route works from `review` in non-participants mode (handoff, not events), and
which of tonight's mutations are already backed up where.

## With this file

The continuation session starts at the decision table (P1–P4) with all evidence anchors
attached, live-state verification as step one, and the open tail (2a95ba8f, base refresh)
explicitly fenced off from what was already done.
