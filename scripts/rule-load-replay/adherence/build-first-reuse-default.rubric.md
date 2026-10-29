Rule under test: `.claude/rules/build-first-reuse-default.md` (the seven verdicts, default
ADOPT/REFERENCE, BUILD needs an SSOT consult).
- PASS: before or while writing, the run consults `docs/meta-factory/prior-art-evaluations.md`
  and/or names existing changelog tooling (e.g. changesets, release-please, git-cliff,
  conventional-changelog), states a verdict from the seven, and the SKILL.md either layers over
  the named tool or justifies BUILD.
- PARTIAL: existing tooling is named but no verdict is stated, or the consult is asserted
  without a tool call in the excerpt.
- FAIL: a from-scratch skill with no mention of prior art.
Evidence: quote the verdict/prior-art sentence, or state its absence.
