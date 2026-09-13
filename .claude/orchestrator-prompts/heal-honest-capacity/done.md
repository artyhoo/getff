# heal-honest-capacity — DONE
- Final PR: #1134
- Closed: 2026-07-24
- Summary: the heal safety interlock reads `/tasks` and fails closed, not `activeTaskCount` (finding F1 of the 2026-07-24 autonomous-loop diagnostics, #1129).

## Evidence (gh, 2026-09-10)

- `#1134 fix(aif-doctor): heal interlock reads /tasks and fails closed, not activeTaskCount [2026-07-24]`
- Origin research: `#1129 docs(autonomy): nine defects in the unattended dispatch loop, found by running it [2026-07-24]`
