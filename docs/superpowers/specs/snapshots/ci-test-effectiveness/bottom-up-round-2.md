# Cold bottom-up and builder review — architecture revision 2

Inputs-ref: `a36b202e8ea6bf112b72df991f24894b20a70023`.
Candidate: `round-2/docs__superpowers__specs__2026-11-08-ci-test-effectiveness-design@a36b202e8ea6.md`.
Review scope: changed obligations in approved PRD revision 2 E9, operator C5–C6, and candidate §§7.1–7.2 plus resulting acceptance changes. This is not a repeat audit of unchanged architecture or an audit of the CI/test population.

VERDICT: GO

No BLOCKER, MAJOR or ESCALATED finding. No round-triggering failure scenario was established. One nonblocking MINOR wording note is recorded below.

Provenance: layer=corpus-measured; whose=judgment-only, not corpus-validated; class=measured null (recorded grade remains the class bar).

## Evidence reused and examined

The candidate and PRD changes were compared with their immutable round-1 snapshots. Byte comparison confirmed that the supplied reviewer-discipline, effort-worthiness, TAK design, TAK umbrella and original operator clarification snapshots are unchanged; their previous readings and review evidence were reused. The revision-2 approval record binds PRD hash `94604da4fd7b685645f6ddb396518a6d97a48a92ca66313d1dcaef19b33357c4`; its snapshot's pre-approval wording is therefore historical, not an approval defect.

The new operator-meta-enforcement snapshot, review-sidecar role and aif-review binding were read in full. Additional reads used only `git show <Inputs-ref>:<named dependency>`: `scripts/review-sidecar-contract.test.mjs`, TAK `kickoff-s1.md`, the named TAK population, and the proposed `scripts/test-assurance/verify.mjs` location. No tests, actual audit probes, remote/task queries or repository edits were performed.

## Bottom-up conclusions

- **Semantic reuse endpoints are real and suitable for extension.** The review-sidecar snapshot declares an adversarial reporting-only diff-review role and identifies its AIF binding (`.agents__roles__review-sidecar@a36b202e8ea6.md:9`, line 13). The binding explicitly augments AIF review and carries the same dual-pair relationship (`packages__core__templates__shared__skill-context__aif-review__SKILL@a36b202e8ea6.md:7`, line 10). They already cover test semantics such as tautological expectations, mock-only assertions and independence. The candidate does not falsely credit their presence with covering all seven criteria; at candidate line 137 it requires extending gaps and proving invocation and a consumed disposition. Neither endpoint's reporting-only contract forbids an external consumer from enforcing its disposition.
- **The proposed executable/semantic division is implementable.** Candidate lines 135–139 require narrow deterministic properties where decidable, semantic findings through named review, and actual delivery/consumption checks. The design explicitly denies that record presence proves semantic correctness. It can be implemented using existing runners and review protocols without requiring a universal usefulness or cost algorithm, a paid LLM in CI, or a new review platform.
- **The future-edit path has an explicit acceptance seam.** Candidate line 139 requires a fixed independently specified bad/good corpus, real entrypoints, detector/invocation weakening and proof that subsequent edit/commit/PR work reaches the mechanism. This prevents satisfying E9 by standalone demonstrations or an unconsumed warning. Exact selected hook/gate and disposition storage depend on the audited missing enforcement and can reasonably be chosen during the authorized implementation stage.
- **Recursion stops at an explicit accountable boundary.** Candidate lines 143–145 require the new checks and conformance driver to enter the same seven-criterion inventory while fixing independently reviewed expectations and host/runner behavior as the trusted boundary. TAK design line 106 already specifies this independent outer-driver method. Assessing the driver without requiring endless generated drivers is technically coherent; no new value premise is needed to apply it.
- **Mandatory prevention remains subject to the efficiency objective.** Candidate lines 127, 135 and 147 require reuse, bounded claims, measured cost and conservative affected-obligation selection. They permit neither silently optional prevention nor a recurring full manual audit on every unrelated change. The new acceptance rows at candidate lines 162–163 make generalization and recursive quality checkable deliverables.

## Notes lane — no new round

**N1 — MINOR. Describe the conformance driver as an existing-or-pending TAK dependency.**

Evidence: `docs__superpowers__specs__2026-11-08-ci-test-effectiveness-design@a36b202e8ea6.md:145` says “Use the existing TAK independent conformance driver.” The named adapter path in the TAK kickoff, `scripts/test-assurance/verify.mjs`, is absent at Inputs-ref (as is `scripts/test-assurance/`). The Inputs-ref S1 stage prompt instead requires delivering that adapter and explicitly says its host commands are implementation contracts, not claims that the adapter exists. This does not establish that no other relevant driver exists; it establishes that the specific named TAK adapter is not yet available in this source snapshot.

The candidate's existing lines 73–77 already require establishing real TAK delivery state, mapping dependencies, and waiting/coordinating affected changes. Those requirements prevent treating the absent adapter as accepted evidence or creating a competing implementation. Thus no consequential missing builder decision or additional review round follows. A same-round clarification such as “the applicable TAK conformance driver, once its delivery and scope are verified” would align line 145 with §4.

Triage: layer=architecture; whose=reviewer. No `Failure-scenario:` is asserted; this is an accuracy note under already-sufficient dependency handling.

## Builder questions and unverified cells

Nothing important left. The driver delivery/ownership check is an already assigned execution prerequisite under §4, not an unanswered architecture or operator question. The mechanism-specific static contracts, semantic protocol extensions, actual integration trigger, corpus members and measured cost bounds appropriately depend on demonstrated audit classes and the fresh execution baseline.

Unverified: actual review invocation/consumption, actual TAK driver delivery, concrete detector behavior, semantic detection success and cost, live branch/TAK state, host execution and population completeness. GO certifies the design's implementability and builder readiness; it does not certify those execution outcomes.

VERDICT: GO
