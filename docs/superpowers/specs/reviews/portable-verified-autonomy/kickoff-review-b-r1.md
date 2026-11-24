# Kickoff cold review B — architecture and goal fidelity

VERDICT: GO

BLOCKER (0): none.
MAJOR (0): none.
MINOR / notes lane (0): none.

## Binding and scope

- Inputs-ref: `10a567a402295758f53172a4eb1e37ff70793257`.
- Input map: `docs/superpowers/specs/reviews/portable-verified-autonomy/kickoff-r1-inputs.json`.
- Reviewed target: `.claude/orchestrator-prompts/portable-verified-autonomy/kickoff.md` at Inputs-ref. All line references below refer to that immutable Git tree, not the later working copy.
- Focus: architecture/goal fidelity, custody, recovery, isolation, memory, controls, rollback, scope and field-notes transfer. This is a kickoff review, not host qualification, implementation acceptance, publication approval or dispatch authorization.
- Read the mapped design, PRD, agreement, operator-decision register and field-notes comparison through `git show`; used same-ref protocol/source references for bounded checks. No chat/history/memory retrieval or other reviewer opinion was used. The supplied zero-match MEMORY-SWEEP is a boundary input, not a sweep performed by this reviewer.

## Evidence-backed assessment

| Boundary | Evidence and conclusion |
| --- | --- |
| Exact authority | Kickoff:16–20 names approved PRD, exact design and agreement. Independently hashing same-ref bytes returned PRD `ec33fd3d88ae41fb623b31d4d465d96d2cbe3af63dfc7d815f72c8c684590721` and design `d82086984feffc8bc038021ef4419e0d4388e32e82accbe7ebab0e016002904c`, matching the agreement:8–17. The design's historical candidate header does not erase that separate exact-content agreement. No task family or economic value preference is inferred. |
| Preparation boundary | Kickoff:22 expressly prohibits live tasks, routine enrollment, host configuration and model launches merely from writing the file. Future dispatch requires reviewed staging publication of the exact authority/evidence closure. This preserves agreement:4,9 and staging-placement:21–28. The later stage instructions are prospective, not authorization to execute them now. |
| Project goal and reuse | README:51–83 owns executable conventions and earliest reachable enforcement. Kickoff:30–43,151–156,163 retains current gates/validators and requires discriminating counterexamples plus self-audit. New glue is restricted to the demonstrated binding seam, not a replacement workflow, memory backend or coordinator platform; this follows PRD:58–60 and design:112–114,159–170. |
| One accountable owner | Kickoff:54,58–62,68–69,90,145 preserves standalone worker custody, subsystem claims and managed-PR ownership. Intent precedes effects; uncertain worker/effect existence is reconciled rather than timed out into replacement; stale generation/candidate returns are rejected. This retains design:65,71–75,129–133. Local serialization is not represented as distributed exactly-once execution. |
| Recovery and continuation | Kickoff:67–75,157–158 requires native return plus recurring/startup recovery, actual Q1, interruption/restart/disconnection/duplicates and work completing after twelve healthy checks. Healthy waiting, confirmed recovery errors and quota holds remain distinct. Thus merely rejecting premature success is insufficient: automatic resumption and late-result intake are required, matching design:94–110,139. |
| Effective control and rollback | Kickoff:61–62,70,79–84,167 requires pending status until actual cessation, late-result/restart resistance, preserved evidence and reversible memory configuration that preserves existing memory. No completed remote effect is implicitly rolled back. Host-control incompatibility returns to architecture; it cannot justify a scheduler, weakened policies or competing repair owner. Detailed control semantics remain inherited from design:137–139. |
| Independent review | Kickoff:68,71–73,141,159 requires separate external product review, actual injection inventory, forbidden-memory sentinel exclusion, independently authored exact result and currently published validation. CLI success/fresh-session/schema green cannot establish semantic independence. This preserves design:145–149,178–186 and PA2/PA5 rather than relying on role names. |
| Required installed memory | Kickoff:77–84,92 requires installation identity and endpoint readback, ordinary permitted scoped access, correction/supersession, M4, cleanup and real successor use. It excludes independent review from experience retrieval and forbids extra payment/history import/backend substitution. Repository authority and task custody survive memory failure. This matches P18 in arch-decisions:19,32 and design:151–157,188–190. |
| Beyond OpenMaus setup | Kickoff:86–110 requires a useful unfinished real task, a finding/correction/recheck/destination cycle, real corrected-lesson use and a practice-to-change-to-evidence matrix. F-P11, F-P16, F-P6, F-P13/F-P17 and ownership/verification cases retain explicit stage owners. Domain-specific failures remain conditional rather than expanding the selected task. This carries field-notes-comparison:15–32,40–79 and design:210–219 into delivery obligations. |
| Essential promises and staged scope | PA1/PA2/PA3/PA4/PA5/PA7/PA8 have explicit first-host evidence duties at kickoff:58–95,132–145. PA6 consumer-cycle proof and PA9 materially different host proof remain essential later work at :169–171, not silently removed; packaging smoke is expressly insufficient for PA6 at :74. This matches PRD:38–50,94–100 and design:165–174,223–237. |
| Honest capability and cost claims | Kickoff:32–43,132–143 labels new files/acceptance commands as work to implement and requires live laptop receipts. Costs include no-op turns and required execution/memory operations; measured setup/recovery/maintenance remain visible, with no chosen payback horizon (:89,94,160,169–171). Neither captured CLI help nor free source is credited as eligible live operation. |

## Bounded source checks

- All 12 local Markdown link targets in the kickoff exist at Inputs-ref.
- Same-ref `current-decisions.mjs`, `probe-inflight.sh`, `print-orch-home.sh`, `scripts/host-verify.sh`, `setup.d/ships.manifest` and the templates manifest exist.
- The proposed `autonomy-binding.mjs`, its test, `openmaus-binding.md` and `scripts/autonomy-acceptance.mjs` are absent at Inputs-ref. This agrees with kickoff:32–41,132–143; it is not a missing-implementation finding against a preparation-only artifact.
- No live prerequisite/authority check, host command, model launch, configuration change, installation, enrollment, PR publication or dispatch was run. Those would exceed the requested review and cannot supply evidence for this verdict.

## Compact watch-list — acceptance obligations, not new review rounds

1. **Stock-host fitness:** Q1/Q2 must actually pass under ordinary eligible grants, including safe disable and the post-twelve-check late result. Source/help availability cannot substitute for those receipts (kickoff:67–75).
2. **Custody/effect races:** the implementation plan must instantiate the agreed OS-held serialization/durable-write and process/session reconciliation contract, including effect-boundary control checks; a timestamp lease or matching status string is insufficient (kickoff:41,58–62; design:131–137).
3. **Memory/isolation:** actual installed transport, all required processing costs, M4 and real corrected-lesson use remain unproved. Mandatory policies must survive reviewer isolation (kickoff:71–84,92).
4. **Benefit/remaining acceptance:** preserve raw baseline and setup/recovery/maintenance observations; no economic-success, PA6, PA9 or whole-feature claim before its separate required evidence and value decision (kickoff:89–95,169–171).

The GO would be wrong if a cited essential requirement were absent from the inherited exact design or contradicted by an execution instruction, or if preparation were treated as dispatch authority. No such contradiction was found in this immutable input. Future qualification failure follows the recorded hold/return edges; it does not retroactively turn proposed work into an existing capability.

Next step: return this report to the kickoff author for the existing review synthesis, keeping the kickoff preparation-only.
