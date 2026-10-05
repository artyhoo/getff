# Senior review — returned project skill repairs

> **Authoritative for:** the read-only acceptance review of the senior's actual implementation result and subsequent junior delivery receipt.
> **NOT authoritative for:** implementation changes, global permissions, publication or a full behavioral certification.

Use the operator-invoked `review-agent` skill at `/Users/art/.codex/skills/.system/review-agent/SKILL.md` when available. Read its rules, AGENTS, [spec](../specs/2026-10-05-skills-standards-repair-design.md), [kickoff](2026-10-05-skills-standards-repair-kickoff.md), audit and implementation report. Review the complete implementation diff and all new resources against the recorded base. Verify the candidate identity matches tested bytes; an untracked appendix outside the snapshot is not reviewed.

1. F1–F6/F8: inspect actual helpers, installed delivery and changed instructions. Test precise path/command failures without live APIs. Check scope and mutation/permission descriptions preserve existing authorization and host constraints.
2. F7: inspect every moved mode and constraint, conditional pointer and execution path. A short card cannot hide stop/authorization gates behind optional history; loading all detail cannot count as successful progressive disclosure. Inspect all six cards and generated delivery, not a sample.
3. Verify output and chip family contracts, lifecycle/source delegation, paired negatives, metadata/flags, pinned upstream bytes and corrected references/anchors. Reject decorative tokens added only to satisfy tests.
4. Reconcile reported tests with actual receipts and candidate identity. Rerun appropriate changed checks when evidence or bytes differ; a known unchanged pass need not be repeated. Review consumer/plugin-only prerequisites; source-only/native validation is insufficient for consumer executability.
5. Leave F9 and unexercised live/model/harness behavior open unless the report contains suitable actual evidence. A confidence label and static budget pass are not proof.

Return all actionable introduced defects, severity-ordered, with exact file/line and demonstrated scenario in review-agent format. If no qualifying defects, say `No findings.` and name material verification gaps. Then assess A1–A5 individually: PASS, FAIL or UNVERIFIED. Only claim senior acceptance if the required deterministic scope is supported; distinguish it from broader live/model certification.

Write no source changes, create no commit/PR, push nothing and delegate no review while in the review-agent role. If repairs are needed, return findings to the implementation role for a separate fix-and-recheck round.

## Delivery verification after senior acceptance

The junior only pushes/creates PR/merges the accepted result. Check the returned source-head, merge SHA and CI receipts against the senior's frozen source identity. Substantive conflict resolution or upstream reconciliation that changes accepted bytes requires renewed review/verification by the senior. This read-only role remains separate from the author's repair phase.
