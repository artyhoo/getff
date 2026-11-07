# Q1 exact-pin native goal source addendum

Date: 2026-10-26. Supporting producer reverification, not independent review or runtime acceptance. Repository: `milind-soni/OpenMausBot`; immutable requested commit: `3ac9fb1122a34b2755580d3d5d7cbd1a1a77bd4b`.

Only three direct source owners referenced by the captured `server/index.ts` were fetched through the GitHub plugin. Full exact UTF-8 captures were saved separately from the accepted research evidence. Each capture's Git blob SHA was recomputed and matched the GitHub response. [Machine-readable receipts](fetch-receipts.json) record URL, pin, UTC fetch time, byte/line count, blob SHA and SHA256. Fetches occurred at 15:13:31–15:13:35 UTC.

| Source | Git blob SHA | SHA256 |
| --- | --- | --- |
| [server/group-goal-run.ts](server__group-goal-run.ts) | `a0b364571490b1aa85c7c29e81d9acf3e0a818e1` | `3ec9241abfd247564b7d24573c4c8e6c13d739ded848541dc5ad5d0398f079ce` |
| [server/store.ts](server__store.ts) | `8bcc5d80badd147253f18512131fb5391eee5882` | `592195aa86e20924835a187c53958a03cb894937c3e5aecdeb1554acf29d7868` |
| [server/routines.ts](server__routines.ts) | `a355bccc8fca4d0392695d4ad9aa65ccd903b3de` | `0624f8a1af98eac39dcbf3a73fdb897c9191e2338d1a058683fdafeb46988b59` |

## Answer to the reuse question

Native room goal mode is a real bounded lead/worker control loop, but it does not provide mandatory getff acceptance at this pin. `parseGroupGoalDecision` accepts a completed envelope with only nonempty detail (`server/group-goal-run.ts:53–79`). Coordinator instructions put the decision on the model using the conversation (`:124–128`). The existing captured caller passes that decision directly to `finishGroupGoalRun` (`server/index.ts:11234–11246`); `RoutineManager.finishGoalRun` then maps completed status to stored completed state (`server/routines.ts:1320–1348`). No independent current-candidate acceptance receipt is checked by these decisive bodies.

For reproducible source reasoning, a syntactically valid envelope containing `status=completed` and `detail=done` satisfies the parser's entire completed branch, even without a getff candidate/receipt. This is a static counterexample, not a live-host or model experiment. The goal helper is 152 lines; its only import is a type, and this parser invokes local text/JSON helpers, not an external evidence validator.

The application store's `reconcileInterruptedGroupGoals` patches working cards to a supplied resolution or failed fallback (`server/store.ts:965–1006`); it does not re-enter the goal loop. Routines startup reconciles only running/waiting runs (`server/routines.ts:380–398`), so a prematurely completed run is excluded. `rejectResult` changes completed to failed (`:1295–1299`) rather than queueing repair. This supports the precise premature-success limitation; it does not justify a claim that no interrupted scheduled run can recover.

`server/routines.ts:24–26,387,1310` references `server/routine-recovery.ts` for `requeueOnce`/`recoverRun`. That fourth file was outside this three-file authorization and was not fetched. The helper's exact scheduled-run retry conditions remain unknown. They cannot alter the caller's exclusion of already completed runs or add a required acceptance receipt to the parsed completion branch. No wider source survey is needed to establish that narrow result.

## Setup versus future trial

No OpenMausBot installation, launch, bot creation, account/permission change, routine creation or model execution occurred. This work supplies evidence for choosing a first laptop trial or an optional host extension; it does not configure either. Existing AIF/getff procedures can remain the work/review workflow inside native goal coordination. A future unmodified trial can assess that cooperation, but must not claim mandatory acceptance enforcement based on goal mode's name. **Architecture correction:** goal-attempt completion need not terminate the getff task if a recurring native routine retains the higher-level obligation; the two-source follow-up below supports evaluating that reuse path first. The earlier goal-mode finding does not establish that a host patch is necessary.

## Bounded read record

Fetched exactly the three complete files listed above; no branch-head resolution or repository search was used. The goal helper was inspected in full from the tool response and with line-numbered focus on 1–12,51–82,106–133. Application store inspection focused on `reconcileInterruptedGroupGoals`, lines 955–1008. Routines inspection focused on imports 20–28, startup 360–405, completion/rejection/failure paths 1290–1354, plus bounded symbol searches for those functions. The full captures preserve unexamined surrounding source for reproducibility; no claims about that surrounding source are made. Retrieval output was large, so the decision-bearing ranges were re-read locally rather than relying on a truncated display. All line numbers match upstream bytes.

## Separately authorized routine-check follow-up

Exactly two additional direct owners were fetched at the same commit, via the GitHub plugin. [Separate receipts](routine-check-fetch-receipts.json) preserve UTC time, immutable source URLs, byte/line counts and verified Git blob/SHA256 values; the original three-file receipts and accepted research evidence are unchanged.

| Source | Git blob SHA | SHA256 |
| --- | --- | --- |
| [shared/routines.ts](shared__routines.ts) | `6f79a20fcdfbe9343b0fd51cc33fe238ad0b6bbc` | `21ee8ff28bd71243dc39a9a7ce823a73fc07f6c673c29ed3cb161177f373aa96` |
| [server/host/proactive.ts](server__host__proactive.ts) | `f64c694936941a00e9d6335a6815961f0ca67d5d` | `0aaaa0dc2a72e5576816cc19298db3fb36658d7908a2c65fe29d0769e78a2133` |

The built-in `RoutineCheck` union is exactly calendar/mail/runs (shared/routines.ts:65–68); it has no command or local getff file predicate. Routine `read-and-draft` access permits Gmail/Calendar reads and reply drafts, refusing other tools by its documented contract (:70–72); it is not a coding/getff shell mode. Proactive wiring configures these checks and its default watch (server/host/proactive.ts:131–153,217–220); `FENCED_ENGINES` names only claudeAgent (:34–35). Actual routine self-edit/disable authorization is not defined by these files and remains unproved; no additional route or fence dependency was fetched.

The existing RoutineManager source separately establishes that a recurring routine survives a completed attempt and can start again on schedule/startup (server/routines.ts:951–956,970–1077,1379–1390). Captured index:16492 supplies the startup call through the freeze guard. This supports a native routine as durable owner across attempts, preserving the getff task identity rather than the native root identity. The bounded proposal in [A3](../q1-completion-design-probe.md#a3-counterexample--a-native-routine-owns-the-task-across-attempts) corrects the earlier overly narrow inference and leaves precise protected-obligation/retirement proof pending.

Focused reads for these two captures: shared/routines.ts:60–80,108–135,203–225; server/host/proactive.ts:1–38,104–169,202–256, with bounded relevant symbol matches. No further dependencies, network survey, setup or runtime experiment occurred. The source captures are evidence, not installed configuration.
