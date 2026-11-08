# S2 B4 — remove exact repeated work and rebalance installer shards

> **Authoritative for:** D02/D03 work-placement changes and bounded acceptance.
> **Not authoritative for:** project goals, new selection policy, TAK or campaign acceptance.

<task>
Remove two proven repeated root auditor invocations and rebalance four unchanged installer
suites across the existing three jobs, preserving every unique protection witness.
</task>
<context>
Consume accepted S1 D02/D03, retained-witness map, frozen workloads and actual CI traces.
Read the agreed design §§7–9 and B3 acceptance. New before-run data is supplied by the controller;
no optimized hosted run exists yet. Do not equate projection, compute and developer latency.
</context>
<constraints>
Change only the exact allowlist below. No suite, installer, setup, config, lock, hook or
supported environment changes. No new selector/cache/job/service, paid CI LLM or nested agents.
Preserve required names/aggregation/events and local serial shared-tree quarantine.
</constraints>
<tools>
Existing YAML/Git analysis, native relevant checks, source/runner evidence and frozen duration
traces. Normal hooks, no push or full local installer battery merely for timing.
</tools>
<output>
Commit supported removals and placement changes, B4 decision/evidence record, updated inventory
and scoped report. Keep original S1 evidence immutable and historical timing values unchanged.
</output>
<verify>
Both removed repeats have the same surviving independent root witness; actual consumer checks
remain. Every installer command occurs once with the same prerequisites and required carrier.
Validate combined changes and record cost limits; actual final hosted receipt comes later.
</verify>

## Authority and scope

Feature ci-test-effectiveness, specification
`docs/superpowers/specs/2026-11-08-ci-test-effectiveness-design.md`, SHA256
`77e669ad6113b9674c6b32f92554af1a490e5828127f4c9ebea800f271a83e4a`.
Read AGENTS.md, README goal, session-bootstrap, CLAUDE.md, applicable canonical rules and
kickoff-s2.md. Native isolated execution is authorized by “го без аиф”. Controller records
fresh inputs and owner overlap before dispatch. No AIF/accepted pending TAK runtime is assumed.

Exact writes:
- .github/workflows/audit-self.yml — the two self-install jobs and three installer shards only
- docs/ci-test-effectiveness/batches/b4.json
- docs/ci-test-effectiveness/evidence/b4-*
- docs/ci-test-effectiveness/inventory-s2.jsonl — new/changed B4 dispositions plus exact B3 M2
  correction: current held-driver delivery should link its fault set, omitting duplicated
  prose count rather than introducing another count-synchronization gate.

D02 removes ONLY the final framework-root audit-ai-docs.test.ts invocation from each
self-install ts-server/Next job. Preserve actual installer/consumer smoke and all required
setup. The probe-tests command observes the same root/config/Node/event subject; core test:units
is a separate configuration witness. Verify both repeats removed jointly against that survivor.

D03 moves synth-wire-consumer-config and first-commit-passable B→A; r2-glob-reach and
r2-auto-wire B→C. Preserve exact commands, suite multiplicity, three job names, needs/events,
Node/tool/dependency prerequisites and private temporary consumers. No parallel local execution.
Read real destination setup rather than infer equivalence from similar names.

Freeze current workflow before editing. Compare actual YAML suite/command/prerequisite/event
and aggregate maps before/after. Reuse the two S1 timing traces; the controller's latest
original-head run adds another before observation. Replay held durations as a scheduling
forecast with unchanged total work; never report it as observed-after speed or compute savings.
Actual final CI and uncertainty belong in the final campaign cost result. New timing trials
only if a concrete unsettled decision needs them, not to fill a table.

No permanent test asserting a step stays deleted or pinning this assignment. Existing
P36/P37/P38/P41, installer population and surviving auditor tests provide relevant checks.
RC5/RC6 future economic prevention is later existing review/disposition integration; do not
claim that surviving functional tests alone prevent future duplicate work or imbalance.

Batch JSON includes D02/D03, exact input/output identities/files, commands/statuses/raw refs,
retained protection, cost/consequences/uncertainty and rollback; controller records final commit.
New one-shot mechanisms receive seven criteria and explicit invocation/cost; no new platform.
Write .superpowers/sdd/ci-test-effectiveness/task-5-report.md with status, commits, verification,
combined no-loss, costs and limits. Keep broader hook/TAK/campaign dependencies explicit.

## Traps and destination verification

L0 research-grade with proportional work. Apply ai-laziness-traps.md §2–§3:
**T3**, **T7**, **T10**, **T14**, **T15**, **T18**, **T19**, **T20**, **T22**. Challenge omitted
witnesses, combined removals, prerequisites, event/host differences and new audit machinery.
Five failed iterations trigger scoped BLOCKED; change method after two failed attempts.

Run on the native Linux destination with pinned actionlint on PATH. Do not run the full
installer matrix locally; the required final hosted run verifies its actual destination.

```bash host-verify
actionlint .github/workflows/audit-self.yml
npx --prefix packages/core vitest run --reporter=default packages/core/principles/36-ci-needs-completeness.test.ts packages/core/principles/37-required-context-completeness.test.ts packages/core/principles/38-vitest-include-ci-coverage.test.ts packages/core/principles/41-shell-test-ci-coverage.test.ts
bash tests/install-sh/meta-all-wired.test.sh
npx --prefix packages/core vitest run --reporter=default packages/core/audit-self/audit-ai-docs.test.ts
```
