# multi-model-profile-marker — DONE
- Final PR: #1109
- Closed: 2026-07-23
- Summary: `bridge-profile` marker shipped end-to-end — kickoff header marker → runtime-bridge dispatch sets the task-level profile override (light tasks run their whole aif pipeline on the cheap executor); SDK uniqueness defect fixed; the marker discipline was codified as the tier-routing uniqueness rule (#1114).

## Evidence (gh, 2026-09-10)

- `#1057 feat(runtime-bridge): bridge-profile marker for task-level GLM routing [2026-07-21]` — PR body names kickoff `multi-model-profile-marker`; 14 tests incl. the self-reference guard.
- `#1109 fix(mmp): bridge-profile marker — unique profile name (SDK) + bank ambiguity finding [2026-07-23]`
- `#1114 docs(tier-routing): bridge-profile marker uniqueness rule + donemd-backfill meta-launch kickoff [2026-07-23]`

## Attribution note

The S2 in-container carrier-run parity evidence (`#1111`) and the pilot synthesis + done.md (`#1113`) belong to the SIBLING umbrella `multi-model-pipeline-pilot` (its done.md cites #1113) — that pilot used this marker as its substrate; they are not this umbrella's closure evidence.
