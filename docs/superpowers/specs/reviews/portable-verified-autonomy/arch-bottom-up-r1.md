# Portable verified autonomy — bottom-up architecture review R1

Inputs-ref: `b106a201bb84c18593cccdb3c397ec1443219ad4`

VERDICT: REVISE

Scope: first architecture review, bottom-up altitude only. This is independent of the earlier research GO. Rubric: `.agents/procedures/arch/references/design-review.md` §2 and `.agents/rules/reviewer-discipline.md` §6 at Inputs-ref. Evidence below uses original repository paths and one-based lines at that ref; captured upstream source retains its original line numbering. No chat, memory, live configuration, external services or live implementation paths were used as capability evidence. The supplied JSON map was read only to locate immutable inputs; substantive reads used `git show` at Inputs-ref.

Path abbreviations below: `design.md` means `docs/superpowers/specs/2026-10-26-portable-verified-autonomy-design.md`; `local-cli-surface.md` and `q1-source-addendum/` are under `docs/superpowers/specs/reviews/portable-verified-autonomy/`; `memory-reality.md` and `evidence/` are under `docs/superpowers/research/portable-verified-autonomy/2026-10-26/`; intent `helpers/` means `.agents/procedures/intent/helpers/`.

## MAJOR BU1 — unchanged healthy work can exhaust the only future result intake

Evidence:

- `docs/superpowers/specs/2026-10-26-portable-verified-autonomy-design.md:122–123` makes observation a bounded 45-second standalone quantum which returns PARTIAL while long execution remains in AIF. Its native child returns after persisting the report.
- The same design at `:139` schedules five-minute attempts, then after twelve unchanged attempts persists a quota/availability hold and requests routine disable. It does not distinguish a healthy still-running AIF task from an unavailable prerequisite or actual exhausted quota, or specify an automatic wake after that disable.
- `packages/runtime-bridge/src/cli/await.ts:117–127` can return timeout after successfully reading a healthy unchanged pending task. The reason is expressly `observation_deadline_not_worker_failure`. A lack of changed externally visible state is therefore not evidence that the worker or its prerequisite failed.
- `packages/runtime-bridge/README.md:161–165` explicitly excludes terminated-owner wake from this observation interface. In the captured host, only enabled routines qualify for startup/due runs: `docs/superpowers/specs/reviews/portable-verified-autonomy/q1-source-addendum/server__routines.ts:975–980,1017–1019`.
- Violated recorded requirement: approved PRD `docs/superpowers/specs/2026-10-26-portable-verified-autonomy-prd.md:42` (PA1: routine continuation without human relays), reinforced by `:44` (PA3: preserve recoverable responsibility).

Failure-scenario: a valid AIF implementation phase remains externally unchanged for more than twelve scheduled observations. Every bounded observer has already exited normally. The recovery counter disables the routine while the task is still healthy. AIF then produces a candidate; no observer child remains to wake the parent, and the disabled routine cannot schedule intake. The laptop and accounts are available, but an operator must reactivate the task to get review/correction started. Calling this a quota/availability hold invents an unavailable prerequisite from an unchanged status and recreates the continuation burden the selected route is meant to remove.

Actionable correction: define which conditions consume the finite recovery budget. Separate healthy owned pending execution from actual unavailable/quota failures. For any automatic disable while a business obligation remains pending, bind a concrete automatic permitted reactivation/result-intake mechanism, or restrict that disable to a genuinely unavailable prerequisite or explicit authorized control. Add a case where healthy execution lasts beyond the unchanged-attempt budget and later completes; intake must resume without an operator relay. This does not require unlimited model polling or a new scheduler: the design must state how its chosen bounded policy preserves that continuation contract.

Falsifier: a specified, source-supported return path remains active after these bounded observer quanta and automatic routine disable, and consumes the later AIF result automatically; or the budget is explicitly inapplicable to healthy owned pending work. Neither is specified in the reviewed bytes. No judgment about an acceptable economic horizon is needed for this finding.

## Supported assembly and implementation boundaries

- Native `coordinate_bots` really accepts `thread: new` and `reply: resume`: captured `evidence/openmausbot--server__index.ts:14764–14780` under the accepted research directory. Awaited children hold native completion, but no getff acceptance predicate is present in the final completion branch: captured `evidence/openmausbot--server__runtime__runtime.ts:478–494`. The design accurately treats native completion as attempt completion.
- Stock routine lifetime is separate from individual runs. Captured `q1-source-addendum/server__routines.ts:951–1004,1017–1077` supports startup and recurring attempts. Captured `q1-source-addendum/shared__routines.ts:65–72` supports the stated limits of built-in checks and the unsuitable read-and-draft profile. A deterministic arbitrary getff precheck is not claimed.
- The proposed standalone CLI launch has a captured help surface for explicit session IDs, resume and tool selection (`local-cli-surface.md:220–241,265–269`). Eligibility, successful execution and context isolation remain qualification, rather than existing demonstrated capability. The new helper, relationship record, process/lock glue and review packet construction are expressly proposed work (`design.md:114–149`).
- Existing product review/publication seams are real: `.agents/procedures/intent/references/result-review.md:8–31`; `helpers/publish-result-review.mjs:9–42`; `helpers/check-result-review.mjs:704–794`. Structural validation is distinguished from the independent semantic verdict. The design separately requires current authority, published identity, candidate binding and Q2 input exclusion.
- Custody is explicit across the native dispatcher, standalone worker, AIF internal rework and managed PR coordinator (`design.md:62–79,127–137`). Expired waits and stale process reports do not grant competing repair ownership. No contradictory existing exported API is required by that division.
- Consumer and second-host acceptance remain required, with separate legitimate authority and no maintainer-private state (`design.md:159–170,202–206`). Hy-Memory is an installation to bind and qualify, not an already observed continuity service (`design.md:151–157`; accepted `memory-reality.md:9,25–42`). Repository-backed source/correction text is a fallback representation, not a claimed native supersession API.

## Compact watch-list — unverified cells, not additional round triggers

| Cell | Required implementation evidence / qualification |
| --- | --- |
| Q1 stock-host control | Actual permitted routine management, protected retirement, overlapping/disconnected owner exclusion, restart and pause/cancel precedence. Manager methods alone do not prove an accessible authorized tool route. |
| Q2 review isolation | Actual CLI injected-source inventory and forbidden sentinels excluded while mandatory policy/hooks remain effective; exact published attempt reaches the native owner after a lost return. Tool-selection flags alone do not prove input confinement. |
| CLI/process custody | Decode the CLI JSON output envelope into the separately validated REPORT/review payload; prove process identity/cessation, spawn-intent crash reconciliation and safe quantum stop. |
| Consumer packaging | The actual profile selector is `setup.d/ships.manifest:42–52,65`; `templates.manifest.json` inventory alone is not procedure delivery. Verify the transitive closure through the installer and normal discovery before consumer acceptance. |
| Hy-Memory / PA8 | Bind actual endpoint/version/grants; isolated M4 succession/correction/project-decoy/cleanup; eligible processing cost and real successor use. No production fixture or guessed transport is justified by the design. |
| Later acceptance | Real task admission, full-cycle destination evidence, consumer cycle and materially different second-host design/proof remain open. They are not prerequisites for writing this first-host design, and this review does not certify them. |

No BLOCKER, STOP condition or strategy/value-premise vote is recorded. The single round-triggering finding concerns the specified continuation policy, not a demand to complete live acceptance before architecture approval. Correct BU1 and retain the explicit qualification gates.

VERDICT: REVISE
