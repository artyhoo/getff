# F10: scope autonomous continuation to the current project

> Authority: task-specific design and verification record; autonomy policy remains in .claude/rules/autonomous-loop-continuity.md and hook delivery in zcode-parity-doctrine.md.

Choose Option A: hook-side filtering of the existing bare GET /tasks response. RUNTIME_BRIDGE_AIF_PROJECT_ID is already supplied through setup.d/bridge-guided.sh into machine-local settings and inherited by the dispatch hook; the runtime resolver and backend require the same identity. No server or API contract change is needed, so old servers and hooks remain compatible. Worker environment outside this checkout is not assumed: missing identity becomes an explicit degraded probe.

Validate the configured project ID and every task's nonblank string id/projectId before filtering. Require exactly one JSON array, retain existing non-object and parse guards, and count only matching-project tasks that are unpaused and nonterminal. A valid foreign queue contributes zero; malformed identity cannot silently disappear behind project/status filtering. Every degraded path retains a request to decide whether work is running. The existing stop-chain guard and opt-in default remain unchanged.

## Complete twin and parser population

Three hook implementations: .claude/hooks/end-of-turn-reminder.sh, generated plugin/hooks/end-of-turn-reminder, and ignored packages/getff/.claude/hooks/end-of-turn-reminder.sh. No vendor reminder exists. Generate the plugin via scripts/generate-plugin-twins.sh and the npm package via scripts/build-getff-dist.sh. Both executable source/plugin copies are behavior-tested with pinned project identity and task arrays.

The cold sweep reached all 21 task-list parser files: three reminders plus 18 siblings. Explicit GAPs, owned by runtime-bridge/dispatcher/pipeline maintainers: probe-inflight.sh (two copies) can clear on numeric IDs; source/vendor cli/questions.ts (four copies) filters missing project identity away; source/vendor cli/harvest.ts (four copies) converts non-array responses to empty populations; render-status.sh (two copies) suppresses parse errors; aif-doctor heal.sh (two copies) lacks object identity checks; bridge-cleanup.sh (two copies) converts malformed lists to empty results; verify-bridge.sh (two copies) converts malformed cleanup to an empty deletion population. Counts include each generated packages/getff mirror. These are separate parser concerns, not hook twins, and are outside this atomic fix. Six connectivity-only callers do not parse task lists.

## Evidence and falsifiers

Cold arm-level probes reproduced foreign-project blocking and silent empty/malformed identity results in all three copies. Full pre-images of both production hook sources were retained at staging c877128fe12 before editing. New tests failed 20 cases with 32 passing, covering both source/plugin bodies. After the fix, 52 autonomy tests pass; all 332 Stop-hook tests pass. On-disk file:// task fixtures use real curl/jq paths and pin all project inputs without a live server or paid LLM.

Falsifiers: a valid foreign task blocks this project; own live work is ignored; absent local identity or malformed task identity silently clears; paused/terminal tasks force continuation; existing stop-chain guard fails. A server-side scoped endpoint alone cannot prove response identity and would still require these hook guards, so cross-repo API work adds no required correctness here.
