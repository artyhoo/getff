# Task 8 / B7 scoped review

## Spec compliance

**❌ Issues found.** The delivery, bounded advisor deadlines, source scope, and preservation of old local obligations match the brief. The new coverage checker does not yet satisfy the required real executable/package/cwd/config identity and fail-closed live-wrapper contract: three concrete false-coverage cases are reproduced below.

**Reviewed input:** supplied complete review package for `e38d6db008bdbb1153e9ed803a3330296108852f..bb969b66e939bbc0761e2694d9b787ed9cbae23d`, comprising commits `4661ac3d` and `bb969b66`, 75 paths. All final-side diff hunks were mechanically compared with the checkout and matched. The requirements are `.superpowers/sdd/ci-test-effectiveness/task-8-brief.md`; the implementer's report was treated as claims, not proof.

**Rubric:** Superpowers `subagent-driven-development/task-reviewer-prompt.md`, repository `.agents/rules/reviewer-discipline.md` §6/§6.1, and `.agents/roles/reviewer-discipline.md` source-bound closure.

Provenance: layer=corpus-measured; whose=judgment-only, not corpus-validated; class=measured null (recorded grade remains the class bar).

## Strengths

- `.github/workflows/audit-self.yml:304` adds the four owned native commands after the existing root dependency install. The diff adds no setup, job, matrix, dependency, or lockfile change. `packages/core/package.json:58` adds the two supplemental scripts without changing canonical scripts, and autonomy has its own Node invocation and summary.
- `packages/core/hooks/advisor-role-reminders.test.ts:25` adds the requested 25,000 ms child limit and 30,000 ms outer limit while retaining the actual discovery arguments and exit-status assertion. The cost of a longer failure wait is explicitly recorded; there is no new skip or performance claim.
- `scripts/run-local-ci-sweep.sh:1068` prevents supplemental triggers from satisfying the old unmapped-path classification. Independent comparison of the retained tables found all 57 old rows byte-identical and exactly four additions. The 12 frozen workload records retain every old selected obligation; their old selected sets agree with the raw before-run output, including unknown-path full escalation.
- `scripts/run-local-ci-sweep-coverage.test.sh:178` preserves npm package identity. Retained missing-sibling-row RED names both sibling commands, while the final reverse-coverage log reports 36 passes and zero failures. This repairs a concrete false-credit mechanism without changing the selector's existing obligations.
- `docs/ci-test-effectiveness/evidence/b7-held-conformance.py:26` invokes the ordinary npm principles script with a focused selection, mutates disposable subjects, keeps expectations outside those subjects, and checks restoration at line 58. The final follow-up log actually shows script-target loss, new workspace population, and disabled-detector failures, followed by a 43-test restored pass. Its six before/after subject hashes match the final source hashes. Earlier held runs are honestly separate, older source identities.
- All nine registered B7 mechanisms have the seven required criteria. The reported added sequential native cost, 203.208 seconds, is consistent with the retained command timings and is described as added execution rather than savings.

## Issues

### Critical

None identified.

### Important I1 — explicit Vitest config incorrectly substitutes for runner cwd

**Evidence:** `packages/core/principles/ci-test-invocations.ts:443`–`463`; the incorrect positive expectation is also encoded at `packages/core/principles/38-vitest-include-ci-coverage.test.ts:111`.

The resolver accepts a matching `--config` path and then matches files against the package's population without requiring the effective runner root to match that population. Vitest does not change cwd/root merely because a config in another directory was supplied. The core config's include paths are relative, with no explicit root.

**Failure-scenario:** a workflow is changed from a package-cwd invocation to `vitest run --config packages/core/vitest.config.ts` from repository root. P38 credits the core population, including the advisor wrapper, even though the installed runner selects none of those files. This defeats the explicit package/cwd/config-identity requirement before CI executes the erroneous command.

**Focused reproduction:** calling `commands('vitest run --config packages/core/vitest.config.ts')` and `selected('packages/core/hooks/advisor-role-reminders.test.ts', call, corePopulation)` returned `true`. From the same repository root, installed Vitest 4.1.8:

```text
./node_modules/.bin/vitest list --config packages/core/vitest.config.ts --filesOnly --json --passWithNoTests packages/core/hooks/advisor-role-reminders.test.ts
[]
```

**Correction:** model effective root separately from config location, or conservatively reject cross-cwd explicit-config shapes until supported. Replace the current positive fixture with the actual native behavior and retain a valid package-cwd companion.

**Violated requirement:** brief required behavior 2, distinguish package/cwd/config and preserve actual runner semantics. `layer=implementation; whose=reviewer`.

### Important I2 — Node script arguments are credited as test-runner options

**Evidence:** `packages/core/principles/ci-test-invocations.ts:257`–`270`.

The Node branch checks `rest.includes('--test')` anywhere in the argv list and treats every non-option token as a test target. Node options after its script entrypoint are arguments to that script; they do not activate the test runner.

**Failure-scenario:** replacing a real native invocation with `node scripts/noop.mjs --test scripts/codex-hook-compatibility.test.mjs` can leave the coverage gate green while the named suite never executes. This is within the parser's accepted grammar, with no unsupported diagnostic.

**Focused reproduction:** `nativeCovered('scripts/codex-hook-compatibility.test.mjs', commands('node /dev/null --test scripts/codex-hook-compatibility.test.mjs').calls)` returned `true`, and the registry's unsupported list was empty. Executing that exact Node command exited 0 with no test-runner output; `/dev/null` is the actual entrypoint.

**Correction:** require `--test` in Node's option position before any script/positional operand and reject unsupported argv order. Add this negative companion to the fixed corpus while preserving valid multi-file invocations.

**Violated requirement:** brief required behavior 1/3, actual executable invocation and fail-closed unsupported shapes; binding full-file runner semantics. `layer=implementation; whose=reviewer`.

### Important I3 — advisor wrapper credit survives an unconditional early return

**Evidence:** `packages/core/principles/41-shell-test-ci-coverage.test.ts:115`–`166`.

The wrapper detector searches the direct statement array for the root declaration, spawn declaration, and status assertion. It never rejects a preceding `return` or otherwise ensures those statements are reachable. Being a direct statement of a registered callback is insufficient to establish execution.

**Failure-scenario:** inserting `return;` immediately before the advisor callback's root declaration makes the Vitest callback pass without spawning any of its 13 Python cases. P41 continues exempting the Python source as delivered, so both the wrapper and the coverage assertion can be green with the required behavior absent.

**Focused reproduction:** evaluated the existing P41 module through TypeScript transpilation with suite registration disabled, exposing its existing `wrapperTargets` only in memory. Both the original source and a source-reader variant replacing `const root = fileURLToPath` with `return; const root = fileURLToPath` returned `tests/advisor-role-reminders/test_reminders.py` as covered. No source file or Git state was changed.

**Correction:** keep the wrapper grammar narrow, but reject unconditional exits and unsupported statement/control-flow shapes before the required spawn/assertion sequence; test the dead callback variant against held expectations. No general JavaScript analyzer is needed to reject this shape.

**Violated requirement:** brief required behavior 3/7/9, independently validated actual wrapper invocation and dead-path rejection; the implementation's own live-callback claim. `layer=implementation; whose=reviewer`.

### Minor notes — retained validation output is not pristine

`docs/ci-test-effectiveness/evidence/b7-host-runtime-bridge.txt:8` contains WARN and intentional-looking failure-path output, and `b7-manifest-check.txt:1` contains six npm gitignore-fallback warnings. These were retained rather than hidden; neither log is a pristine-output run. The unchanged suite/output owners should classify expected diagnostics or capture/assert them when next touching that surface. This is a notes-lane observation, not a request to expand B7 or repeat suites; no new concrete correctness failure was established. `layer=implementation; whose=reviewer`.

## Evidence and focused checks actually performed

- Read the supplied brief, report, task-reviewer template, reviewer discipline, changed source diff, and retained verification evidence. Large generated census/log artifacts were also checked mechanically rather than relying on report counts. Parsed all 75 diff sections and compared every final hunk with current bytes; all matched. There are 64 new artifacts, predominantly bounded audit evidence.
- Compared all five retained installed-native JSON listings with `b7-static-population.json` by exact normalized path set: core 342, Next 3, React Native 0, React SPA 0, runtime bridge 31, all equal. This independently confirms the current census, not every possible CLI shape.
- Verified all nine final source hashes and all 44 native-source hashes against actual filesystem bytes. The source diff contains no edits to those native suites. Verified all six changed payload entries against the generated manifest; no unrelated manifest content change was present in the supplied diff. Normal generator/archive raw evidence reports 1,668 payload files and 1,673 packed entries. No build was repeated.
- Compared retained raw native outputs with the summaries: runtime bridge 663 passed plus one existing external skip across 30 passed/one skipped file; Next 43 passed across three files; Node first process 72 passed, autonomy 188 passed/one explicit Linux skip; Python 15+8+4 passed; focused advisor wrapper one passed, 4,661 ms callback. Thus 34 sibling listed sources versus 33 executed deterministic sources is supported by actual runner summaries. Linux's filtered HOST-01 log explicitly says zero passed/one skipped.
- Checked retained fault logs for expected omission identities and actual failure summaries, and final restored log for 43 passes. Final follow-up hashes match this review input; initial/full held matrices used earlier helper/P41 hashes, as recorded. The disabled-detector result is an actual failure of unchanged negative controls, not merely an asserted boolean in the report.
- Compared 57 frozen preimage sweep rows with 61 postimage rows: all old rows unchanged and exactly the four owned additions. Compared every one of the 12 raw-before selected sets with its no-loss record and verified subset preservation/full fallback. This is routing evidence, not an assertion that the harmless stub commands exercised native behavior.
- Ran only the three narrowly scoped semantic probes described in I1–I3. No broad/repeated suite, Git command, index operation, source edit, or subagent was used. The only saved artifact is this requested review report.

## Cannot verify / separate acceptance cells

- Full-hooks carrier acceptance remains pending. The focused repaired wrapper passes, but that does not clear the previous full-hooks timeout under final full-suite load.
- Actual hosted Node 22 and Windows HOST-01 execution remain pending. The existing Windows cell, its guard, and preserved install behavior are wired in the diff; Linux results cannot establish Windows behavior.
- TAK 2144, sidecar 2146, and Windows owner PR 2116 are pending external owner work. Their reconciliation record is not delivered runtime or merged acceptance; no current remote-state check was performed during this scoped review.
- The sweep after-run record provides selected sets, while raw-before outputs are retained separately. No new twelve-workload execution was performed, since the code change preserves old table rows and explicitly prevents new rows from suppressing fallback; the prior reported pass was not repeated.
- Optional ESLint did not run successfully because no eslint.config was present. There is no lint-pass claim.
- The finite grammar is an acceptable scope decision; these findings concern accepted shapes and a claimed wrapper boundary, not a demand for arbitrary shell/JavaScript interpretation. No campaign-DONE conclusion follows from this task review.

## Task quality

**Needs fixes.** The delivery and evidence work is disciplined, with explicit costs and host limits. The checker remains unsound for three small accepted input shapes, including two ways to retain a green result while required native behavior is absent. Fix those bounded cases and review their focused deltas; the already-passed native suites do not need wholesale repetition.
