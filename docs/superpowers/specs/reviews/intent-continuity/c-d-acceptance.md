# Intent continuity C/D — bounded implementation evidence

> **Authoritative for:** the local C/D checks on 2026-10-13 and their limits.
> **NOT authoritative for:** replacing the approved PRD or agreed design, a whole-feature product `matches` verdict, publication, or unobserved external execution paths.

The activated-checkout C/D implementation is technically accepted within the checked seams. The final cold code review returned PASS with no P1/P2 blocker. The independent product-only review of `c1-result-continuity` against IC-P6 returned **`needs-evidence`**, not `matches`; it is published as the write-once `c1-needs-evidence-final` attempt at observed revision `daf10e6ae769fbd54b03d7db7a7698b92c780062d00c7884af23ceb68b8443c5`. This outcome cannot authorize expansion. The earlier `c1-needs-evidence-1` attempt remains intact. The direct CLI probe against the current revision rejects it with `ref_digest_mismatch` because historical source bytes changed; the current negative attempt returns `review_not_matching`; changing its observation revision returns `stale_review`. Both attempt hashes were unchanged across those checks. These are actual helper effects, but no prior positive attempt was invalidated, so full AC7 remains open.

The source helper publishes complete result-review attempts by same-filesystem rename without replacing an existing attempt. Current use requires independently selected approved PRD, observed revision and published attempt. Runtime effect guards reselect current PRD, agreed spec and matching spec-review before reachable adopted dispatch, release, start and plan-changing answer effects. Removed adoption markers cannot turn new tasks into legacy tasks. Existing frozen kickoff claims and write-once adoption receipts preserve legacy/adopted identity. The one live pre-freeze AIF task remained `plan_ready`; read-only GET plus its local recovery receipt returned `{ "adopted": false }` after the final code change. No AIF task was created, unpaused or edited for this evidence.

Checks in `/Users/art/.codex/worktrees/0166/rules-as-tests-aif`:

```text
bash scripts/host-verify.sh .claude/orchestrator-prompts/intent-continuity/kickoff-d1.md  5/5 PASS
npx vitest run packages/runtime-bridge/test                                           555 passed, 1 skipped
npm run typecheck -w @rules-as-tests-aif/runtime-bridge                                PASS
node scripts/render-harness-config.mjs --check --only codex                           PASS
node scripts/canonical-agents-source.test.mjs                                         5/5 PASS
node .agents/procedures/intent/helpers/current-decisions.mjs --read --feature intent-continuity  revision 2, approved PRD and agreed spec unchanged
node .agents/procedures/intent/helpers/current-decisions.mjs --check-plan-prep ...     PASS
bash scripts/format-shipped.sh --check packages/runtime-bridge/vendor/src/resultReview.ts packages/runtime-bridge/vendor/src/cli/recover-legacy-task.ts packages/runtime-bridge/vendor/src/cli/start-reviewed.ts  PASS
git diff --check                                                                       PASS
```

The broad `format-shipped.sh --check` currently exits 2 on pre-existing symlinked `.claude/skills/**` entries even though it reports all matched bytes Prettier-clean; targeted runtime vendor checks pass. The neighboring untracked `scripts/canonical-native.test.mjs` cannot import absent `setup.d/codex-bindings.mjs`, and `scripts/codex-contributor.test.mjs` passes 40/41 with its unrelated `M02/M08 emitted registration flip` failure. Those WIP files were not changed for C/D. Native `/intent` and `/arch` cards link to canonical procedures; `canonical-agents-source` and the Codex harness render check pass. The real CC write hook and runtime CLI are covered by runtime tests; this is not a claim of interception for arbitrary external/manual work or a fresh live Codex `/arch` session in this stage.

Open product acceptance: observe a real result of this feature in the intended flow, obtain an independent PRD comparison at exact result bytes, and after a relevant change show that an earlier independently justified `matches` becomes historical while a fresh ruling is required. Do not manufacture a positive verdict from fixture tests. The A1 freeze had `taskIds: []`; only the one task with AIF-owned pre-freeze timestamps was recovered. Other historical tasks lacking such evidence remain held. Local receipt writing assumes a trusted local caller; no hostile local writer resistance is claimed. No commit, push, PR or merge was performed, and the unrelated WIP was preserved.

Staging decision (2026-10-13): the operator moved the live AC7 product demonstration to the next genuine feature result, avoiding a separate training task. This record's earlier no-commit/no-PR statement describes the original shared-WIP execution only. The isolated staging branch may ship the technically verified candidate with AC7 visibly open; a staging merge does not turn `needs-evidence` into `matches` or accept the full C1 product outcome.
