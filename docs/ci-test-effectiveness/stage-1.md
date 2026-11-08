# S1 CI and test effectiveness audit

> **Authoritative for:** the assessment and proposed S2 decisions at the pinned source below.
> **Not authoritative for:** project goals, acceptance of S1, acceptance of TAK, or permission to change repository settings.

**S1 package complete; independent acceptance pending.** Eight evidence-backed changes are proposed. No production code, test, workflow, branch setting or frozen TAK artifact was changed. The audit retains useful protection even where it is expensive. It proposes removing only two exact repeated invocations, and replacing two detached sanity jobs with stronger checks of the actual production checker.

## Baseline and evidence meaning

Audited branch: `codex/ci-test-effectiveness-native`, HEAD `01b25d78` (full identity and hashes in [baseline.json](baseline.json)). The integration base was `346e3daf3255a431100c6fa2298727cca36e3bc7`. Final remote observation was `5fc5f74c3bc3b7b16047f527fc121f02dfe12b4d`; its only change from that base is the readme-install-claims kickoff. Audit subjects are unaffected. The exact-source comparison is preserved in the history reconciliation evidence.

The approved native route applies. Existing authority admission used the controller's owner registry, `/workspace/getff/.claude/orchestrator-prompts`; no competing registry, AIF project or task was created. Native discovery used the provisioned dependency links. The host is Linux, Node 24.19.0; hosted jobs commonly use Node 22 and include distinct consumer matrices. No full recurring suite was run for setup.

This is a **source/contract assessment with complete population reconciliation and targeted dynamic evidence**, not dynamic certification of every case. Each source item points to its exact declared/native members, assertions, imports, conditions and applicable family conclusions. Shared conclusions are bounded to the observable contract. Structural tests receive structural conclusions; their green status is never promoted into semantic prevention. Source checks that cannot establish the whole behavior are retained as useful partial layers, with the complementary carrier identified.

[Inventory](inventory.jsonl) has explicit seven-criterion references or conclusions for every item. [Family assessments](family-assessments.json) explain shared reasoning; [principle assessments](principle-assessments.json) specialize all 57 principle sources; [CI job assessments](ci-job-assessments.json) specialize all 56 active job declarations. Per-member applicability is in the compressed case inventory. References resolve through the [evidence index](evidence/index.json), which identifies physical compressed files and their original hashes.

## Population and reconciliation

| Population | Reconciled denominator | Interpretation |
|---|---:|---|
| Baseline tracked paths | 4,554 | Frozen Git census, not a count of tests |
| Broad test/probe/support source census | 736 | 722 test/probe sources; 14 support/historical-fixture sources |
| Additional fixture, snapshot and runner inputs | 314 | Explicitly not independent passing tests |
| Vitest native collected cases | 6,257 in 372 files | Core 5,551; runtime bridge 663; canonical Next 43 |
| JS/TS callback declarations | 6,609 in 435 sources | Includes 1,002 Node declarations; overlaps native expansion |
| Python unittest discovery | 54 in 6 sources | Loader identities, no test-body pass claim |
| Shell source branch/label identities | 8,276 across 286 shell sources | Includes comments/helpers/loop labels; **not** an executed-case count |
| Active repository workflows | 15; 56 jobs; 486 steps | All events, conditions, matrices, setup and non-test automation retained |
| Shipped workflow templates | 9; 41 jobs; 204 steps | Prospective consumer execution, not active framework CI |
| Local sweep | 56 actual gate-table rows | Collected using the real `--list-gates` interface |
| Package / Make / pre-push | 56 scripts / 12 targets / 40 sections | Explicit recurring/manual/support distinctions |
| Other local carriers | 5 Git hook entrypoints; 15 pre-commit blocks; 68 native hook registrations | Timing, capability and harness boundaries retained |
| Manual evaluation additions | 3 canonical pipeline scenarios plus compatibility alias; 151 C1 rows and 41 C2 groups | Historical/manual model evaluation, never paid-model CI |

The final inventory contains **2,121 records**. The case archive contains **21,196 overlapping views**; do not add those views to produce a fictional total of distinct executed tests. The 30 later manual/generated-support records include benchmark commands, evaluator inputs, demonstration tapes and pilot valid/invalid files. Two explicit group records bind the D07 package populations.

Native Vitest collection reconciles all 376 TypeScript candidates: 372 listed files, two historical TAK fault fixtures outside the configured suite, one four-case local-only bash-mutation suite gated on universalmutator, and one real-AIF park probe gated on explicit live/project inputs. Individual skipped/tool-conditional cases also remain in declared source records with enclosing suite conditions. SPA lists no test files; React Native explicitly declares an empty suite with `passWithNoTests`. Empty collection is not semantic success.

Node has no equivalent case-only listing used here. A no-body filtered import attempted all 51 Node test files: 49 loaded, one correctly required an external native-corpus argument, and autonomy-binding hung because its recorder closes only in its last ordinary test. The auditor terminated that owned process and reproduced the distinction with a bounded probe. These are explicit collection results, not an empty pass. The TypeScript AST declaration view includes `ltest`/`ntest` aliases and preserves exact source conditions. Shell scripts are enumerated as executable source contracts with branch/label evidence, because no standard native shell case-list API exists; dynamic loop multiplicities are not invented.

A secondary runner-import/declaration and YAML-job scan challenged naming-only discovery. It added manual evals, pilot fault material and shipped consumer workflows. Generated test inputs, retained negative fixtures and support helpers stay separate from actual suite protection. Shipped compatibility copies are not counted as independent behavioral evidence.

## Assessment and decisions

[decisions.jsonl](decisions.jsonl) contains D00 retention plus D01–D08, with required protection, alternatives, consequences, surviving witnesses, dependencies and verification contracts. D00 applies the family/member rationale to all retained items. Small benefit is useful benefit; no deletion quota was used.

| ID | Decision and substantiated consequence | Required surviving protection |
|---|---|---|
| D01 | Repair P41's invocation oracle. Changing a real `run: bash …` into `run: echo bash …` leaves all eight P41 cases green; restoring bytes also passes. Path presence does not establish execution. | Tracked shell population, justified exceptions, P36/P38 boundaries and actual executable invocation; finite TAK conformance must detect detector disablement. |
| D02 | Remove only the final root `audit-ai-docs.test.ts` invocation from each of the two self-install jobs. Both `cd` back to the framework root; the suite uses its own source root and temp fixtures, never the installed consumer. | Same root/config/Node/trigger invocation in `probe-tests`; both actual installer smoke steps; core `test:units` remains a separate configuration witness. |
| D03 | Move four long installer suites from shard B to existing A/C. Two exact-source CI runs support a 31–39% installer critical-path reduction forecast. | Every case and command; Node/tool prerequisites; all three required jobs; separate consumer and Node-version matrices; local shared-tree quarantine unchanged. |
| D04 | Repair live-enforcement visibility and obtain owner action for missing required contexts. Staging actually requires three contexts while source declares six. Prior-art and discipline PR-body checks can fail without blocking merge. | Exact context names, body `edited` event, squash-preview/base behavior and main promotion policy. Source-only observation does not register a context. |
| D05 | Repair autonomy-binding recorder teardown. Selecting cleanup exits zero; filtering it out hangs beyond 15 seconds. Assertions also precede the only close operation. | Whole-run zero prohibited-effects assertion, CLI/library matrix, unconditional teardown, Linux/non-Linux distinctions. |
| D06 | Repair local actionlint status propagation. A real invalid workflow makes the pinned tool exit one while the actual sweep exits zero and reports WARN-SKIP. Valid and restored controls exit zero. | Explicit missing-tool state, exact tool diagnostics and installed-tool failure; hosted actionlint remains the later backstop. |
| D07 | Add appropriate recurring carriers for 706 Vitest cases across 33 deterministic runtime/Next files and eight Node/Python sources containing 273 declared cases, plus one nonstandard manual shell test. P38 covers core only; P41 covers shell only. | Exact subject/import/config/fixture closure, explicit host prerequisites and useful cases; no wholesale root-suite repetition or automatic external AIF operations. |
| D08 | Combine the two discipline sanity jobs into conformance of the actual checker. Their copied awk/grep predicates stay green while the production checker is replaced with an always-success body. | Frozen valid/invalid fixtures, actual checker, length/citation/Skip/main behavior and existing production context name. Remove detached jobs only after stronger replacement works. |

The already-censused `tests/hooks/test-enforce-husky-presence.sh` is a separate manual-only source: its name escapes P41, it copies the CI predicate and mutates real `.husky`. D08 must make its oracle faithful and fixture disposable before D07 adds recurrence; no fresh dynamic result is claimed for that simulator.

D07's eight Node/Python sources are harvest health preflight, pipeline shell runtime audit, autonomy binding, both dual-channel enumeration/overlap tests, Codex hook compatibility, saved coordination and advisor-bridge protocol. The advisor reminders' 13 Python tests are **already reached through a Vitest wrapper** and are not falsely classified as missing. Native-corpus validators and historical receipt replays are explicitly manual. Real-AIF park remains external opt-in. A package script by itself is a manual entrypoint, not a recurring merge gate.

No new repository-wide vacuity claim is made from an assertion scanner. The literal-only/empty examples found in frozen TAK material are intentional historical fault fixtures. Apparent no-direct-assert cases in current source include real helpers such as `expectErr`, refusal helpers and subprocess delegates; these are legitimate counterexamples. D08 is a demonstrated detached-oracle gap, not an inference from assertion spelling.

## Protection and duplication map

- Structural principles protect declarations, source ownership, syntax, discovery and delivery metadata. Live scanners, planted violations and consumer executions supply different witnesses. P04's manifest population does not certify repository tests.
- Pre-commit protects staged syntax, formatting, citation landings, manifest fixtures and generated artifacts. Pre-push protects pushed history and earlier local refusal. Required CI protects merge admission. Equal code at different required times is not automatically redundant.
- Core/root Vitest configurations, TS/source bundles, reduced Bash fallback, canonical/native/plugin adapters, source/tarball consumers and Windows/macOS/Linux paths are distinct environments. D02 preserves the exact root witness; D03 changes placement on otherwise compatible CI runners only.
- `ci-success` needs all active audit-self jobs and checks authorized skips. It does not automatically aggregate other workflows or undiscovered runner families. Live staging contexts are `ci-success`, `fidelity-verdict-in-pr-body`, `stale-revert-in-pr-diff`. Main requires `ci-success` and `guard-liveness-fullsweep`.
- Template render's standalone context is unregistered, but its suite is also reached through required core units. This is different from the unique PR-body edited-event gap. Registration and any consolidation must preserve every event/configuration witness; simply deleting declarations would conceal the gap.
- Known consumer-template rot is explicitly limited to named signatures and stacks and rejects unrelated errors/stale exceptions. It is not counted as a fully green consumer. Changing those product templates is not an S1 repair.

Joint-change challenge: removing both D02 repeats **and** the retained probe job would invalidate the no-loss proof; combining D08 while dropping its fixtures would remove protection; routing D07 while trusting P41 substring evidence would leave a future omission path; registering a renamed or path-filtered context could deadlock valid PRs; moving installer tests into local parallelism could violate the serial shared-tree quarantine. S2 must evaluate these combinations, not eight isolated diffs.

## Cost and representative workloads

The bounded GitHub sample contains 60 runs created from 2026-11-06T20:05:20Z through 2026-11-08T14:11:10Z: 57 completed, three in progress; 48 success, five failure and four skipped. Detailed job/step captures cover 16 selected runs and 204 job instances. This is not a long-term flake rate, billing export or matched performance trial.

Two full audit-self runs use the exact integration source; relevant workflow/test/config hashes equal the audited checkout:

| Run | Event | Sum of job wall minutes | Job wall envelope | Installer A / B / C minutes | D03 projected maximum |
|---|---|---:|---:|---|---:|
| 42372587424 | pull request | 397.25 | 172.57 min | 68.3 / 170.6 / 47.5 | 103.7 min |
| 42372579925 | push | 410.65 | 168.27 min | 78.6 / 164.4 / 54.1 | 113.2 min |

Move `synth-wire-consumer-config` and `first-commit-passable` B→A; `r2-glob-reach` and `r2-auto-wire` B→C. The projection simply transfers observed step durations; cache/network/order effects remain uncertainty, and no optimized hosted run was executed. It predicts lower latency, **not lower total compute**. The four suites retain private temp consumers and their required tool setup. Source comments describing no-network plain-install behavior are not replaced with an invented npm-download attribution.

The two D02 repeats cost 6, 7 and 6 step-seconds in three captured runs. This small saving still warrants removal because their stated consumer subject is never observed and the exact root witness survives. No setup/job savings are claimed. D08 can save two job setups only after faithful conformance replaces them; no optimized number is invented.

Setup and step observations are retained individually in the cost summary. Pure queue time, billed minutes, per-case maintenance/diagnosis expense, exact warm/cold state and most local timings are unavailable and remain null. Concurrent job wall times must not be added and called user latency. Scheduled/postmerge automation is classified separately: the Context7 sample failed with an explicit library-size 403; pin-freshness failed on the live manifest's 404; a kickoff CI failure was a concrete Prettier violation. None is evidence for quarantining a flaky test.

[workloads.json](workloads.json) freezes docs publication, installer, ordinary rule, shared-kernel, omitted-family and metacheck workloads. The controller's documentation pre-push observation is useful context, not a controlled timing sample: source/bundle/render/drift checks ran, canonical hit its default 120-second spawn budget, and a supported command-local heavy runner provided the existing 600-second budget without a hook bypass. Face-facts drift was a real generated-input obligation. No blanket docs skip is justified.

No new performance experiment was required for an S1 decision. If S2 needs fresh comparative timing, use three matched trials and at most two additional noise trials, retain individual values/medians, and separate native/hosted and cold/warm classes. Do not run unrelated full suites to manufacture cost data.

## TAK and S2 implementation boundary

[tak-reconciliation.json](tak-reconciliation.json) separates historical, in-flight and verified state. Only TAK S0 historical evidence is landed on the audited baseline. PR [2144](https://github.com/artyhoo/getff/pull/2144) remains open at `7a5b63dc137648bc76a5899ecae4b279063c7e6b`; its principles 51–53, verification engine, guard integration and activation ledgers are **not** assumed landed or independently accepted. Its reported Darwin receipts remain attributed claims. S0 timings on a different Darwin host/source are not today's performance baseline.

[root-cause-map.json](root-cause-map.json) proposes seven root-cause→principle→detector integrations. Reuse P38/P41 and accepted TAK delivery-discovery for actual carriers; use TAK subprocess conformance for D06; use held-oracle counterfactual conformance for D08. Preserve legitimate helpers, snapshots, intentional fault fixtures and external/manual probes. Do not build a generic semantic analyzer, new service or parallel registry.

Suggested S2 batches, after independent S1 acceptance:

1. Reconcile current accepted TAK owner/head; implement D05/D06 and faithful D08 checker controls using existing harnesses. Run frozen adverse/positive/restoration controls and actual carrier exit behavior.
2. Extend population/executable-invocation boundaries for D01/D07 through the existing TAK/P38/P41 architecture. Establish subject/config/fixture scope before optimizing triggers; preserve unsupported-host states explicitly.
3. Apply D02/D03 with the held survivor map and identical suite identities. Validate actual required CI and compare the frozen workload without claiming projected savings as measured.
4. Improve D04 read-only visibility. Actual required-context registration remains administrator-owned. A source-only equivalent preserving edited-event and required-status semantics was not demonstrated; this is not authorization for an administrative project. Do not add an admin PAT or reduce declarations to make the result green.

The finite independent boundary for E9 is the existing accepted TAK conformance/verification layer with frozen bad/good controls and actual future invocation. It must detect detector bypass, disabled assertion, wrong source/caller, dropped nonzero status and stale scope bindings for the affected classes. Review holds the oracle fixed. No infinite chain of new metatests and no full mutation on unrelated PRs is proposed. New controls get the same relevance, sensitivity, independence, duplication, cost and sufficiency assessment.

## Adversarial category check and effort-worthiness

The required question was applied: which family, criterion, boundary, supported environment or metacheck was omitted; which combined change could pass this evidence yet weaken protection? It corrected the initial filename/runner scope by adding alias tests, manual evaluators, shipped workflow jobs, skipped cases, wrappers and native carriers. It also separated source declarations from live settings, reproduced actual wrapper status loss and challenged copied CI metatest predicates. The remaining limits are named environments and unavailable measurements, not quietly certified behavior.

The audit spent effort on complete identity/contract mapping and bounded decision-changing probes rather than rerunning thousands of already-defined tests. Native import collection unexpectedly consumed about 310 seconds before the recorder hang was isolated; the follow-up was bounded to 15 seconds and owned processes were cleaned up. Future collection should apply a watchdog from the start. This is a cost finding about the audit method itself, not a test-body failure rate.

Evidence is compressed where it duplicates immutable source or large raw API/runner output; original hashes, sizes and reproduction commands are preserved. No persistent validator, recurring audit workflow or new service is installed. Inventory references shared family conclusions instead of repeating long prose for each case. Audit scripts are one-shot capture machinery, not new quality gates. Artifact byte totals and verification results are in the evidence index and package-validation record.

No actual access blocker prevents this bounded source/contract S1 assessment. Administrator-only bypass details and new settings effects, current non-Linux/native-AIF behavior, future accepted TAK activation and optimized after-cost are explicitly outside what these observations establish. Independent reviewers must assess substantive family/member applicability and the decisions; JSON/schema completeness alone does not accept S1.
