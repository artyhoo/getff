# Deterministic core — completed architecture and intent review

Date: 2026-10-15

Authoritative for: executed review evidence and the exact candidate it binds.
Not authoritative for: operator specification agreement, implementation permission, kickoff authorization or runtime/platform acceptance.

**Agreement update, 2026-10-15:** the operator subsequently approved the exact candidate below. The authoritative decision is [spec-agreement.md](../spec-agreement.md), recorded through the canonical helper using captured revision 1. The selector is now revision 2 with currentSpec set; [plan-preparation passes](./plan-prep-agreed.json). The earlier missing-agreement result below is preserved as review-time history. The reviewed specification bytes are unchanged. Sol prepares the kickoff after compaction; implementation remains unauthorized.

## Exact candidate

- Design: `docs/superpowers/specs/2026-10-14-deterministic-core-design.md`
- Design SHA256: `b30836da511c96d1de996b373262140fbf6c8b65d023b7c0d902fcb9861d099e`
- Coverage SHA256: `03770d8453fc1f3a64df940969fa2bea506416f9b5003044898d80cdb9a093db`
- Final Inputs-ref: `a86648554d19860ca6956d633b7414cc46fb63f2`
- Approved PRD SHA256: `4869eaee6c97d6ea055a94e11f462d4c4c3870a79a5fe5bf6eecd17574d3d326`

The working design and coverage were byte-compared to the immutable final snapshot. Do not edit the candidate merely to update its review status; this external record holds that status. A later meaning-relevant design change needs review of its new bytes.

## Architecture axes — independent verdicts

| Top-down | Bottom-up |
| --- | --- |
| **GO**, no material findings. Cold seat `/root/arch_top_down_r1` judged goal fit, feasibility, simplicity, scope and assurance. [Full report](./top-down-r1.md). | **GO**, no material findings. Cold seat `/root/arch_bottom_up_r1` verified source/API, actual role and installer seams, existing tests and the separately pinned TAK evidence. [Full report](./bottom-up-r1.md). |
| Standing verdict preserved on final bytes by fresh narrow review. | Standing verdict preserved on final bytes by fresh narrow review. |

The initial two seats received only frozen artifacts at `09d408cc63774633655851ba26f684cc68723d37` and no authoring history. After the small authority-metadata correction, `/root/arch_final_delta` verified the exact delta and returned GO separately for both axes. See [final delta review](./final-delta-review.md). There were no REVISE rounds and no unresolved BLOCKER, MAJOR, MINOR or ESCALATED findings.

## Corrections and dispositions

| ID | Origin | Disposition | Resolution |
| --- | --- | --- | --- |
| SELF-1 | Author self-application | FIXED | The archive ref was not an operator-agreed spec baseline. Retell now uses `none — first retell` and preserves archive provenance separately. |
| SELF-2 | Authority-resolution check | FIXED | Restored four exact approval artifacts at the original e220 paths; existing selector references now resolve. No selector/approval replay or digest change. |
| SELF-3 | Review lifecycle bookkeeping | FIXED | Candidate status points to externally bound review results; it no longer permanently labels later executed reviews pending or invites editing reviewed bytes to record their own verdict. |

See [self-check](./self-check.md), [authority restoration](./authority-restoration.md) and the [exact metadata delta](./final-metadata.diff). These corrections do not change the selected order, runtime platform, product scope or assurance obligations.

## Product intent

Fresh artifact-only seat `/root/intent_spec_final` returned **matches**, with all seven essential promises DC-P1–DC-P7 supported by explicit quotations and reasons. It did not receive the architecture verdicts, authoring discussion or desired outcome. See [human-readable review](./intent-final.md) and [semantic attempt](./intent-final.json).

The canonical `publish-spec-review.mjs` writer published immutable attempt:

`565cd291f736f333c3421654c87bbcebb1fc315855ac3d4d037c9e8afba9324a`

Canonical publication location: `/Users/art/.codex/worktrees/6612/rules-as-tests-aif/.claude/orchestrator-prompts/intent-continuity/spec-reviews/565cd291f736f333c3421654c87bbcebb1fc315855ac3d4d037c9e8afba9324a/spec-review.json`.

## Mechanical checks and authority at review completion

- Retell checker: exit 0.
- Coverage: exact match to all 100 existing ledger IDs, no duplicate or extra principle IDs.
- Candidate/snapshot bytes, unchanged approved PRD, local links and whitespace: checked.
- Normal index and tracked worktree diffs: empty; review objects use a temporary index and separate snapshot refs. Source HEAD remains `80196f2f9e3546ceffa00c0cb362903d1eebaebe`.
- Presentation gate: exit 0, `ok: true`, captured feature revision **1**, binding the exact PRD/spec and published attempt above. [Receipt](./presentation-check.json).
- Plan-preparation gate: expected hold `spec_agreement_missing`, because no exact written-spec agreement has yet been recorded. [Receipt](./plan-prep-check.json). This is a separate operator decision, not an unresolved technical review finding.

Structural receipts: [structural-checks.json](./structural-checks.json). No implementation tests, installations, kickoff or execution dispatch were performed.

The subsequent agreement was recorded with the **captured presentation revision 1**, the unchanged PRD digest and exact spec ref. The operator's written decision is preserved in the separate agreement record. No revision refresh or edit to the reviewed spec was used. The resulting plan-preparation gate passed. Do not replay this completed recording. No implementation is authorized by the agreement alone.

## Remaining kickoff preparation details

The reviewers found these already-bounded details suitable for kickoff preparation, not architecture blockers: resolve admitted first-family profile/runner/output rows, choose the emitted filename through existing distribution owners, select finite process limits, and bind the family-specific fixed-oracle cases to the actual execution-base TAK implementation. Keep consumer payload, source availability and real activation separate.

The TAK branch was observed at `e046844dbaa` in this turn; the delta from the design's inspected `133fd3ae99e` touches P38 and its S2 evidence, not a new acceptance certificate for the proposed audit mechanism. Reconcile readiness at execution preparation; do not launch or duplicate the TAK campaign. No universal engine or common-library prerequisite was added.
