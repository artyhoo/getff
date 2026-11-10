# Portable verified autonomy: live architecture decisions

> **Date:** 2026-10-26.
> **Authoritative for:** operator choices recorded during the renewed architecture discussion.
> **NOT authoritative for:** a selected host, agreed solution specification, implementation authorization or runtime acceptance.

Product authority remains the approved [PRD](../../2026-10-26-portable-verified-autonomy-prd.md), SHA256 `ec33fd3d88ae41fb623b31d4d465d96d2cbe3af63dfc7d815f72c8c684590721`. Research authority and the original decision frontier are retained in [intent round 2](intent-round-2.md).

## Operator premises

- P10 — The system may create and manage working sessions for an assigned task and supply their required context. Attaching arbitrary already-open chats is not required for the first route. Evidence: the operator answered item 2 with “OK” after a choice between system-created task sessions and attaching existing Codex/Claude Code chats. This does not remove experience continuity, cross-environment cooperation or independent-review requirements.
- P11 — The operator requested clarification of the first-task question. No task family or concrete task has been selected by that response.
- P12 — The operator challenged the standalone task-to-PR explanation and asked how the proposal fits the existing pipeline. Restore that integration boundary before asking for a representative task. This is not agreement to a new parallel workflow or a selected platform.
- P13 — The operator explicitly accepted one real getff task as the first system trial. Read together with P12, this means a real task through the existing workflow, not a parallel task-to-PR process. The exact task and task family have not been selected; the prior correctness-fix recommendation is not implicitly approved.
- P14 — The operator explicitly agreed to the explained integration boundary: an existing platform supports the agents performing the current getff pipeline roles; getff retains task meaning, checks, acceptance and stage-transition conditions. The first real task tests this combined workflow and reduced manual coordination. Evidence: explicit agreement immediately after the pipeline-integration explanation. This approves the direction, not a particular platform, a completed design or its implementation.
- P15 — The operator selected OpenMausBot as the first platform for detailed integration design. This follows the explicit comparison with the existing getff/AIF route and direct native-host facilities. The selection preserves A1 and all product acceptance requirements; it is not certification of host fitness or authorization to install, migrate or retire components.
- P16 — The operator explicitly clarified that bots may call AIF for its existing plan/work/review cycle; the important outcome is that work does not stall. Retaining AIF inside the selected OpenMausBot route is allowed. The earlier no-AIF choice applied to research, not to product execution. This does not authorize bypassing task authority, required reviews, pauses or merge gates.
- P17 — For the first version, the operator selected running on their laptop because moving to an always-on machine would add unnecessary setup burden. Continuous execution while the laptop/application is unavailable is not required for this version. The existing recovery promise still applies once the supported environment returns; no infrastructure migration or always-on deployment is selected.
- P18 — The operator explicitly requires verifying and configuring the already installed Hy-Memory as part of this integration. Preserve the actual-installation investigation and scoped continuity tests before declaring it connected. This is a required integration work item, not evidence that shared retrieval already works or authorization for new spending, private-history ingestion or replacement.

## Live decision register

| Decision | Status | Resolution | Falsifier |
| --- | --- | --- | --- |
| D4a — first trial setting | answered | P13: one real getff task, carried through the existing workflow under P12. | The trial is only synthetic plumbing or bypasses existing workflow gates. |
| D4 — representative task family and exact task | operator-fork | First-trial setting is settled by D4a. Select a useful actual task based on the recurring coordination burden; no exact task or family is yet agreed. | A proposed example does not represent the operator's actual coordination burden. |
| D5 — session continuity requirement | answered | P10: allow the selected platform to create and manage task sessions; arbitrary existing-chat attachment is not a first-route prerequisite. | The selected route cannot preserve required task context, sourced experience or cross-environment cooperation through its managed sessions. |
| A1 — integration boundary | answered | P14: reuse the current pipeline and its roles; ready-made host facilities support execution and continuation. Preserve actual stage gates, existing review/advisor protocols and authorized delivery. | The integration creates a competing workflow, treats host completion as acceptance or bypasses stage prerequisites. |
| A2 — initial host approach | answered | P15: OpenMausBot native accountable-owner route is the first integration design target. Existing/native routes remain alternatives and later portability candidates. | The integration cannot preserve A1, independent review, recovery, consumer delivery or the no-additional-payment requirement without effectively replacing the host. |
| A3 — reuse AIF inside the selected host route | answered | P16: existing AIF plan/work/review/rework may be invoked by bots; replacing AIF is not a prerequisite. | The resulting nesting leaves manual completion relays, conflicting owners or duplicate execution. |
| A4 — initial availability environment | answered | P17: first version runs on the operator laptop; work may wait while that host/application is unavailable. Recover and reconcile when the supported environment returns. No always-on machine is required. | Sleep/restart loses task custody, causes duplicate actions or requires manual result relays after the environment returns. |
| A7 — existing Hy-Memory integration work | answered | P18: verify and configure the installed Hy-Memory, with sourced cross-agent continuity, supersession, project/review isolation and processing-cost checks. Actual configuration follows the agreed design and normal grants. | Installation identity is mistaken for working integration, or retrieval leaks unrelated context, ignores corrections or requires unapproved paid processing. |
| D6 — setup/reuse horizon | operator-fork | Keep initial setup and recurring effort separate; horizon remains open. | A claimed benefit hides setup, recovery or maintenance costs. |

No platform adoption or solution-design agreement is inferred from D5.

## Bounded source clarification

Read-only drill-down 1 for `getff-reality.md`: read the canonical `.agents/procedures/pipeline/SKILL.md` in full to clarify the pipeline ownership described in G1/G2. The procedure owns plan reconciliation, eligibility, stage gates and routing, and explicitly does not own worker execution. Dependent stages require the specified actual merges; a completed worker or green PR alone is insufficient. No pipeline invocation, cache probe, dispatch or implementation was performed. This reading explains the existing boundary; automatic host-driven entry and event handling still require solution design and scoped authorization.
