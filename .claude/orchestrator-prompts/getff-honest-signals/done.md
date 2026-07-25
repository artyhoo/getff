# getff-honest-signals — DONE
- Final PR: #TBD (this PR — harvesting session fills in post `gh pr create`)
- Closed: 2026-07-25
- Summary: Honest signal for silent no-op shipped umbrella-wide — every shipped hook that can no-op forever on missing input now reports the gap once loudly per session instead. S6 closes the umbrella by teaching inject-matching-rule the same pattern when the consumer's .claude/rules/ corpus is absent.
