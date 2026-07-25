# getff-honest-signals — DONE
- Final PR: #1175
- Closed: 2026-07-26
- Summary: Honest signal for silent no-op shipped umbrella-wide — every shipped hook that can no-op forever on missing input now reports the gap once loudly per session instead. S6 closes the umbrella by teaching inject-matching-rule the same pattern when the consumer's .claude/rules/ corpus is absent.
