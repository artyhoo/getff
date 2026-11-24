# Review self-check

Date: 2026-10-15

Scope: the deterministic-core design and its coverage map, against the seven approved essential promises. This is document review, not a runtime implementation audit. Source population and current runtime readiness remain distinct.

## Active traps

See `.agents/rules/ai-laziness-traps.md` sections 2–3 and its resident digest.

- T2/T3: actual independent verdicts and command evidence are required; a described review is not an executed review.
- T5: fix the specification only; do not repair implementation defects found during review.
- T8: use the operator's existing sequencing delegation rather than reopening settled choices.
- T10/T14: retain all 100 principle rows and all seven essential promises; a first-family GO is not full-core compliance.
- T15: self-apply this review's distinction between archive, review and operator agreement.
- T19: independent artifact-only reviewers, with no authoring dialogue.
- T20: final verdict cites actual report files and canonical checker output.
- T-DC-REVIEW-A: an archive SHA or a cold GO can be mistaken for exact operator agreement. Keep those authorities separate; never advance currentSpec merely because reviews pass.
- T-DC-REVIEW-B: restoring the same PRD bytes at a new path can appear equivalent while the live authority pointer remains broken. Verify the pointer's actual referenced files through the existing resolver.

## Self-application finding

Question actually applied: could this review's own metadata upgrade evidence beyond what happened?

Finding SELF-1: the original design's Consensus retell used the archive snapshot as its Baseline, even though that snapshot was not an operator-confirmed specification. The explanatory caveat did not make it the baseline required by the arch template. Disposition: FIXED — use `Baseline: none — first retell`, retain archive provenance separately, and explicitly state that exact-spec agreement is not yet recorded. This repairs authority labeling without changing product intent or technical behavior.

Question actually applied: could a restored document pass a file check while its authoritative references remain missing?

Finding SELF-2: the current PRD selector still referenced original e220 paths. Disposition: FIXED — restore the four exact immutable authority artifacts at those original paths and include both owner roots in the canonical resolver invocation. The selector remains revision 1. The checker reached `matches_attempt_missing`, demonstrating that approval resolution succeeded before semantic publication. See `authority-restoration.md`.

No numerical confidence claim or runtime GREEN follows from these checks. The final evidence record must bind the reviewed specification bytes and report the two architecture axes separately.
