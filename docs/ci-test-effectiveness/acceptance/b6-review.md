# Task 7 / B6 review

**Spec compliance: ✅ Compliant within the Task 7 scope.**

**Task quality: Approved, with the recorded full-carrier failure and output-noise notes below.** This is an independent task review, not campaign acceptance or merge approval.

Reviewed input: `.superpowers/sdd/ci-test-effectiveness/task-7-brief.md`, implementer report, and the supplied complete review package for `4044007fd1b1cdcd6ae6fe804c14f3ab96899986..206ebdb6c25cd24bce322841e90adb5f8e367e00`. Procedure: `superpowers:subagent-driven-development/task-reviewer-prompt.md`; repository discipline: `.agents/roles/reviewer-discipline.md` and its recorded runtime triage rubric.

Provenance: layer=corpus-measured; whose=judgment-only, not corpus-validated; class=measured null (recorded grade remains the class bar).

## Spec compliance and strengths

- `packages/core/hooks/glossary-counters.test.ts:928`, `:939`, and `:950` add exactly three `SLOW_SHELL_MS` third arguments. The only other source addition is the concise subprocess-budget comment at `:871`. The complete supplied diff contains no callback-body edit, production-source edit, global timeout, skip-policy change, mocked workload, reduced population, or new mirrored test. `N=10` remains at `:872`; the exact counter assertions remain at `:926` and `:937`, and lock-absence assertion remains at `:948`.
- A focused binding check found `const SLOW_SHELL_MS = 30_000` at `packages/core/hooks/glossary-counters.test.ts:49`, with many existing uses. This establishes actual constant reuse rather than relying on the implementer's description. The supplied source diff preserves the existing real `spawnSync('bash', [INJECT_HOOK], ...)` path and the calls to `spawnInjects` in all three callbacks; the omitted middle of the unchanged helper was not expanded into a separate behavioral audit.
- `packages/getff/MANIFEST.sha256:920` changes only the glossary-test hash row. Independently calculated current source SHA256 is `25b27342837e7b4f5b7a0e7e86e6f1ece0cb06630816884ad800d37b9aba7424`, matching that row and `docs/ci-test-effectiveness/evidence/b6-environment.json:16`. Current manifest SHA256 is `fbcf40e4e39139562b7192f01bf552fb46df060417e2c617015e8adf05f36329`, matching the evidence. Recorded normal-generation output and final payload/archive check are present in `evidence/b6-manifest-generate.txt:1` and `evidence/b6-manifest-final-check.txt:7` under `docs/ci-test-effectiveness/`.
- `docs/ci-test-effectiveness/batches/b6.json:4` binds D10, `:6` names the exact input commit, and `:25` records command statuses. `docs/ci-test-effectiveness/evidence/b6-no-loss.json:5` binds the output source hash and `:8` enumerates retained protections. The appended `docs/ci-test-effectiveness/inventory-s2.jsonl:23` is the affected B6 assessment; no prior inventory row changes in this patch.
- `docs/ci-test-effectiveness/evidence/b6-focused.txt:4` records three passing cases, with the ten-prompt concurrent and sequential assertions and the lock-release assertion individually listed. The other 28 cases are excluded by the requested title filter, not new availability skips. Recorded duration is 5.37s total / 4.94s test time.
- `docs/ci-test-effectiveness/evidence/b6-full-hooks.txt:1` contains the actual `test:hooks` invocation and complete output: 97 files pass, one fails; 2308 tests pass, one fails, and three skip; total duration 159.61s. The failure reports the separate `hooks/advisor-role-reminders.test.ts:8` wrapper timing out at 5000ms. B6 batch `:43` and inventory `:23` explicitly retain the failed status and limit causal, universal, hosted, and Darwin claims. The evidence does not establish the advisor timeout's root cause.

## Seven-criterion assessment

No new executable mechanism, validator, test family, dependency, or recurring carrier was introduced. The changed deadline disposition receives all seven criteria in batch `b6.json:9` and inventory `inventory-s2.jsonl:23`. My assessment of those claims is:

| Criterion | Independent assessment |
| --- | --- |
| Relevance | The three changed deadlines belong to the existing shared-counter race, sequential control, and lock-release obligations. Source assertions remain unchanged. |
| Effectiveness | Existing real-process cases pass in the focused recording; the full recording is explicitly red elsewhere. This supports the bounded deadline disposition, not universal reliability. |
| Theatre | No mock, N reduction, weakened assertion, quarantine, artificial-load replay, or forced-green source change appears in the complete diff. Failed full output is retained. |
| Tautology | Assertions compare observed persisted counts with N=10 and check filesystem lock absence. No new test checks only the added argument's syntax. The assessment JSON is evidence annotation, not a newly claimed detector. |
| Duplication | Three existing test calls reuse the existing per-file constant and existing Vitest carrier. No new timeout policy or duplicate recurring verification layer appears. |
| Cost effectiveness | The passing workload receives no intentional delay. A failing case can wait up to 30s instead of the default 5s, adding up to 25s per case to the configured ceiling. Focused and full elapsed observations are recorded without treating them as a speedup, performance SLO, or distribution. |
| Sufficiency | The source change preserves the required task protections and records both requested carriers. The separate full-carrier timeout remains unresolved, so this task review cannot establish accumulated campaign acceptance. |

## Issues and notes

### Critical / Important within the Task 7 patch

None found. The brief explicitly requires preserving and reporting newly reached out-of-scope failure rather than repairing it here. The red full carrier therefore prevents a full-green/campaign-acceptance claim without making the three-argument implementation noncompliant.

### Open carrier failure — outside this patch

**Material campaign limitation; layer=implementation; whose=reviewer.** Evidence: `docs/ci-test-effectiveness/evidence/b6-full-hooks.txt:1`, including the terminal failure at `hooks/advisor-role-reminders.test.ts:8`; `docs/ci-test-effectiveness/batches/b6.json:25` records exit 1 and the 5000ms timeout.

Failure-scenario: treating scoped B6 approval as complete campaign validation would certify the actual hooks carrier despite its one reached failing wrapper. Preserve the red result and route diagnosis under its own relevant scope; no causal attribution to B6 or proof of pre-existing flakiness is established. This is already correctly disclosed, so no B6 fix round is requested.

### Minor / notes lane: recorded output is not pristine

**Nonblocking for this bounded change; layer=implementation; whose=reviewer.** `docs/ci-test-effectiveness/evidence/b6-full-hooks.txt:8` begins missing-fixture-script diagnostics; later output includes Git default-branch hints, worktree setup warnings, conflict/refusal diagnostics, and usage output. `docs/ci-test-effectiveness/evidence/b6-manifest-final-check.txt:1` records six npm `gitignore-fallback` warnings before successful checks. These are visible output-noise findings under the reviewer template. This patch does not edit the emitting controls; whether each diagnostic is an intentional negative fixture or an unintended warning was not separately established. Retain the output and classify it in the relevant carrier scope before making a pristine-output claim. No B6 re-review round or unrelated repair is requested.

## Verification boundaries

- No tests, full suites, timing loops, generator, or Git commands were run by this reviewer. Existing passing results were not repeated.
- The supplied package was initially too large for tool output and was truncated. I recovered its missing sections in bounded reads of the same package, rather than rereading changed source files to reconstruct the patch. Assertions and statuses were assessed against actual diff/raw-output contents, not accepted solely from the implementer's report.
- Named focused check 1: risk that `SLOW_SHELL_MS` did not actually bind the required existing 30000ms budget. One `rg -n 'SLOW_SHELL_MS'` check of the named test file confirmed the definition and uses.
- Named focused check 2: risk that the output source identity and generated-manifest receipt did not match the reviewed checkout. One read-only SHA256 calculation over the named source and manifest confirmed both recorded hashes.
- Procedure deviation: initial reviewer-discipline path discovery used an overly broad filename-only `rg --files` search including `/workspace`. It returned other checkout/scratch filenames; none of those files was opened or used as review evidence. Subsequent review stayed within supplied artifacts, repository instructions, and the two named checks. No source or Git state was mutated; only this expressly requested review report was written.
- Unverified cells: historical D10/B3 raw content was linked but not independently replayed or reread; normal-generator execution provenance is supported by its recorded receipt, not reconstructed; private rsync/tool-install identity and the reason for each of the three full-suite skips were not independently reprobed; the unchanged helper's complete implementation, advisor-timeout root cause, hosted/Darwin execution, universal timing behavior, broader prevention/TAK, and final campaign acceptance remain outside this review.

**Final scoped verdicts: Spec compliant; task quality Approved. Full hooks remains RED; campaign acceptance remains unresolved.**
