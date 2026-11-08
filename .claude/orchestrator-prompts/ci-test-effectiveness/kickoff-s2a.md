# S2 B1 — propagate actionlint failures in the local sweep

> **Authoritative for:** exact B1 repair scope and acceptance after S1 is independently accepted.
> **Not authoritative for:** project goals, S1 acceptance, TAK acceptance or external repository settings.

<task>
Repair D06/RC2: an installed actionlint rejection must fail the real local sweep.
</task>
<context>
Consume accepted S1 D06 and RC2 plus the agreed design §7–§9. Read the detailed contract below;
this task is one status-propagation repair inside S2, not blanket campaign completion.
</context>
<constraints>
Use exactly the detailed file allowlist below. No product-contract loss, hook bypass,
paid LLM in CI, frozen evidence changes, global settings or competing TAK mechanism.
</constraints>
<tools>
Existing Bash sweep and selftest harness, provisioned pinned actionlint, disposable fixtures.
No nested agents, service, analyzer, dependency installation or unrelated full-suite work.
</tools>
<output>
Commit the small repair, actual-row regressions and portable B1 evidence with normal hooks;
append the new checks' seven-criterion records and the requested local implementer report.
</output>
<verify>
Fixed independent good/bad/absence controls traverse the actual gate row and real sweep.
Prove meaningful RED, GREEN, reached weakening and restoration; preserve diagnostics and
missing-tool distinction. Execute destination commands below and obtain independent review.
</verify>

## Shared authority and native route

Feature `ci-test-effectiveness`, specification SHA256
`77e669ad6113b9674c6b32f92554af1a490e5828127f4c9ebea800f271a83e4a`.
The operator selected native execution (“го без аиф”). Native isolated checkout and normal
Git integration apply; no AIF task is asserted. S1 acceptance and fresh input SHA must be
recorded by the controller before dispatch. Reconcile actual origin/staging and TAK PR2144;
the pending TAK owner/driver remains a dependency, not an assumed installed runtime.

Read AGENTS.md, README goal, .agents/session-bootstrap.md, CLAUDE.md, relevant canonical
rules and S2 coordinator kickoff.
Rigor label (L0): `research-grade` for protection evidence; keep
experiments proportional to this reversible two-source-file repair.

## AI traps and category challenge

Apply .agents/rules/ai-laziness-traps.md §2–§3: **T3** actual outputs; **T7** category-level
challenge; **T10** enumerate actual carrier controls; **T14** no unknown-as-pass; **T15**
assess these controls themselves; **T18** preserve the hosted/local witnesses; **T19**
independent acceptance; **T20** evidence before verdict; **T22** fixed oracle and reached
fault. Ask before the report which status, availability branch, wrapper, host or new
metacheck was omitted and which combined change could restore a false green; record the
bounded answer and residual limits. See design §7.2 for the finite trusted boundary.

## Detailed requirements

# S2 B1 — preserve actionlint rejection in the real local gate

Read after independent S1 acceptance. Approved design: docs/superpowers/specs/2026-11-08-ci-test-effectiveness-design.md, SHA25677e669ad6113b9674c6b32f92554af1a490e5828127f4c9ebea800f271a83e4a; D06 and RC2 are the exact justification. No new analyzer or permanent framework.

## Deliverable and exact write scope

One independently reviewable repair: distinguish tool absence from installed actionlint rejection, using the actual sweep gate-table row and existing sweep harness. Only:
- scripts/run-local-ci-sweep.sh
- scripts/run-local-ci-sweep.test.sh
- docs/ci-test-effectiveness/batches/b1.json
- docs/ci-test-effectiveness/evidence/b1-* (portable tracked evidence only)
- docs/ci-test-effectiveness/inventory-s2.jsonl (append-only S2 supplement to the frozen S1 inventory; do not copy original records)
No other sources or approved/frozen audit evidence. This brief has no authority to change TAK files or source contracts. No nested subagents. Normal precommit, commit own exact changes, no push.

## Required behavior and held protection

The real row in --list-gates is the checker subject; never copy its old/new predicate into the test. Run it through the actual sweep against disposable repository/workflow inputs. A present actionlint exit0 is PASS; present exit1 and another nonzero (e.g.42) fail with original diagnostic retained; an absent executable has the existing explicit WARN-SKIP state and is not labelled a real run. The sweep may normalize checker status into its documented final nonzero; do not demand identical numeric exit if that is not its contract. Existing hosted/prepush actionlint and generic gate failure/diagnostic behavior stay intact.

Use fixed independent controls, not expectations derived from implementation. Add meaningful RED before repair. Include a distinct invalid workflow variant (beyond the original unexpected root key), a valid workflow, missing-tool and stub-status controls. Real pinned actionlint is provisioned at /workspace/getff-tools/bin/actionlint; do not install or alter host/global settings. The missing-tool fixture must not depend on accidentally emptying PATH of the Bash/core utilities needed by the runner.

Demonstrate reached weakening of this actual row with expectations frozen in a disposable copy: restore the status-swallowing behavior and show held conformance fails, then restore and pass. Detector-disable conformance remains a bounded one-shot or the applicable existing TAK lane; do not add recursive driver layers. Record the still-pending accepted TAK Q4/P52/verification-driver dependency honestly rather than implementing a competing kernel or certifying E9 campaign completion.

## Evidence, cost and self-application

B1 JSON has decisionIds, exactfiles, inputSHA/output source hashes (final commit recorded by controller if selfreference), commands, raw evidence refs and exitstatuses, protected cases, recurring-cost delta, rollback. New regression/metacheck items receive the same seven criteria in append-only inventory supplement. Preserve S1 baseline/index bytes. State RC2 general invariant and actual carrier; an incident-specific patch alone cannot certify campaign prevention. Later common authoritative principle/review integration will consume this record.

Freeze the tiny actual-row workload before edits. Reuse S1 evidence for source baseline fault; capture three matched before/after trials only for this affected row, retain individual times and median; separate repair/control test overhead from any claimed optimization. Do not rerun full CI or unrelated suites. Run existing sweep selftests, shell syntax and change-specific host commands on this Linux destination; no Darwin semantic claim. Tests must exercise delivered row, not only generic injectedgates. Portable evidence must resolve from Git (beware global *.log).

## Report

Write .superpowers/sdd/ci-test-effectiveness/task-2-report.md. Status DONE|DONE_WITH_CONCERNS|NEEDS_CONTEXT|BLOCKED; exactcommit(s), changed files, RED/GREEN/weakening/restoration outputs, commands and timings, no-loss reasoning, newinventoryitems, TAK/host limits. Return only status/commits/one-line validation/concerns. Do not selfaccept; controller dispatches independent review. Five failed methoditerations trigger scoped BLOCKED; after two failures change method.

## Destination verification

Run on the actual native Linux destination with the provisioned pinned actionlint on PATH;
retain command, output and exit status. No non-Linux behavior is certified by this host.

```bash host-verify
bash -n scripts/run-local-ci-sweep.sh scripts/run-local-ci-sweep.test.sh
bash scripts/run-local-ci-sweep.test.sh
actionlint .github/workflows/*.yml
```
