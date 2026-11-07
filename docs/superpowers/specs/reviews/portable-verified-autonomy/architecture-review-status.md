# Architecture presentation status

> Authoritative for: reviewed candidate identity and completed pre-presentation checks.
> NOT authoritative for: operator agreement, implementation permission or runtime acceptance.

- Candidate: [design](../../2026-10-26-portable-verified-autonomy-design.md).
- Exact SHA256: `d82086984feffc8bc038021ef4419e0d4388e32e82accbe7ebab0e016002904c`.
- Immutable review Inputs-ref: `709216205eacd2bce791e42a6db6db9ebf105f27` (review-only Git snapshot; branch and real index unchanged).
- Bottom-up: [R2 GO](arch-bottom-up-r2.md), after [R1](arch-bottom-up-r1.md) MAJOR BU1 was fixed. [Author disposition](arch-review-dispositions.md).
- Top-down: [GO](arch-top-down-r1.md), independent altitude; its verdict is not merged with bottom-up.
- Product-intent: [matches](intent-spec-review.md), all PA1–PA9 preserved; [authored attempt](intent-spec-attempt.json).
- Published intent attempt: `fc7a2af9ce2432021be82b42d26a8a14ca4a39f4d10c26c9d528111f641851cf`.
- `current-decisions.mjs --check-presentation` exited 0; exact output saved in [presentation-receipt.json](presentation-receipt.json). Captured selector revision: **1**.
- Retell checker passed; local Markdown links resolved; live candidate bytes equal the immutable reviewed candidate.

The operator subsequently requested kickoff preparation after presentation and the field-notes reminder. [Exact-spec agreement](spec-agreement.md) and [receipt](spec-agreement-receipt.json) were recorded against captured presentation revision 1; the selector advanced to revision 2 and the plan-preparation gate passed. The candidate bytes above remain unchanged. The local kickoff is undergoing its own Phase -1 review; this architecture record is not its readiness verdict or live-dispatch authorization.

First implementation scope is S1/S2: qualification of stock OpenMaus routine/CLI worker/review boundaries, then one real getff pipeline task and required installed Hy-Memory integration. Actual host control, Q1/Q2, safe process custody, memory scope/cost and end-to-end delivery remain acceptance work. Consumer proof and second-host architecture/proof remain essential S3/S4 work. No total-effort saving or runtime success is claimed.
