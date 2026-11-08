# P20 catalog setup diagnosis (read-only, 2026-11-08)

Authority: bounded diagnosis of the actual pre-push P20 failure, not an implementation approval or repository-wide audit. Parent requested production/index/HEAD unchanged. Report and experiment artifacts only. No AIF, paid model, new platform, timeout increase, retry, push, or global-config change.

## Observed failure and scope

`/workspace/scratch/ci-test-effectiveness-final-push-3.txt:508–531` records `20-bundle-classification.test.ts (16 tests | 16 skipped) 30193ms`, `Hook timed out in 30000ms` at its beforeAll:110, 723 other passes and one other explicit skip. The beforeAll prefetch is the failure boundary: no P20 assertion executed. Push-3 receipt pins HEAD `acdc333110b396c72545546f5305e8b25fc5c00d` and overall exit 1. Push-2 receipt pins `0a6a39a105cae46095e91f5bca4e55363d13e93c`; its principle summary was 737 passes/2 other failures/1 explicit skip, so P20 passed there. This is not evidence of a newly broken eligibility/cap/overlap rule.

All 12 inspected subject/test/fixture files below are byte-identical between push-2 and current HEAD. The intervening changes include metadata, kickoff rigor normalization, and plugin version/delivery normalization; none changes these P20 inputs. Do not describe the entire intervening diff as only metadata without this qualification.

Enumeration, not a sampled source audit: read both P20 files completely, shared runner, bundle-curate, classify-work, assign-skill, common.sh, all three actual backlog fixtures, all 11 assign-skill cases, environment scrub tables/setup/config, and the retained root-anchor test. Scoped caller search covers packages/core, tests, and canonical pipeline helpers/references. Other broad behavior/platforms remain outside this bounded diagnosis.

## Dependency and cost evidence

`bundle-curate.sh:91–101` first excludes noneligible types and then invokes the real advisory assign-skill. The positive fixtures therefore invoke assignment 5+6+5 = 16 times, including items later rejected for overlap/cap. Every assignment scans the selected skills and agents directories, tokenizes each candidate, and launches grep per input token (`assign-skill.sh:49–50,63–69,94–117`). Current default catalog: 19 `*/SKILL.md` files and 21 `agents/*.md`. Common.sh resolves the actual repository root; the runner supplies no child env and consequently inherits all these defaults.

Hypothesis before experiment: unasserted live catalog ranking is expensive unrelated setup for bundle eligibility/overlap/cap assertions. Varying only catalog inputs through existing supported seams should preserve those outputs while materially reducing setup cost.

## Actual commands and results

1. An initial instrumentation attempt with `/usr/bin/time -p` exited 127 because `/usr/bin/time` is absent. It launched no tests. Switched to Python monotonic timing around subprocess.run; this is recorded to avoid concealing a failed command.
2. In `/workspace/getff-native/packages/core`, with `MO_SKILLS_DIR`, `MO_AGENTS_DIR`, `MO_SKILLS_GLOBAL` removed from env:

   `npx vitest run principles/20-bundle-classification.test.ts principles/20-bundle-classification.paired-negative.test.ts`

   Exit 0; 22/22 tests across two files; wall 31.872s, Vitest duration 29.36s, aggregate test time 52.15s. This focused run does NOT reproduce the loaded full-suite hook timeout; it confirms unchanged logic passes and leaves little timing margin under concurrency. Receipt/log: `/workspace/scratch/p20-diagnosis-focused-default.{json,log}`.
3. Controlled actual shared-runner experiment, sequential commands in repository root:

   `node /workspace/scratch/p20-diagnosis-runner.mjs default`

   `node /workspace/scratch/p20-diagnosis-runner.mjs fixture`

   Combined shell exit 0. Both import the unchanged real `packages/core/principles/20-bundle-classification.ts`, invoke its actual `primeCurate` for the exact same three real fixtures, then read outputs via its actual sync memo. No copied/reimplemented SUT, mock script, shortened backlog, or changed timeout. Separate Node processes avoid memo contamination. Both use normal root resolution. Both invoke the real classify-work/assign-skill/common chain. Only the catalog seam values differ; default clears all three MO catalog variables, fixture explicitly selects a scratch catalog and `MO_SKILLS_GLOBAL=0`.

   Default prime: 14140.242ms, 3/3 primed. Fixture prime: 1627.709ms, 3/3 primed. Reduction 88.49% in this one controlled sample. The tiny catalog contains one keyword-matching skill (`p20-fixture`) and one unrelated agent, both real files. All 18 output data rows retain byte-identical columns after masking only the assigned-skill cell. All 16 eligible assignment cells change from actual live skill/agent recommendations to `skill:p20-fixture`; the two ineligible rows retain em dash. Thus the advisory dependency actually ran and its changed input reached the output. Outputs, timing, and exact driver source are preserved under `/workspace/scratch/p20-diagnosis-{default,fixture,comparison}.json` and `p20-diagnosis-runner.mjs`; catalog is `/workspace/scratch/p20-catalog/`.
4. Actual original tests under the fixture env, in packages/core:

   `MO_SKILLS_DIR=/workspace/scratch/p20-catalog/skills MO_AGENTS_DIR=/workspace/scratch/p20-catalog/agents MO_SKILLS_GLOBAL=0 npx vitest run principles/20-bundle-classification.test.ts principles/20-bundle-classification.paired-negative.test.ts skills/assign-skill.test.ts`

   Exit 0; 33/33 tests across three files; wall 4.602s, Vitest duration 3.21s, aggregate tests 7.34s. This includes all original P20 assertions, all real eligibility/cap/overlap mutants and memo-isolation/control witnesses, and all retained assign-skill cases. Log/receipt `/workspace/scratch/p20-diagnosis-focused-fixture.{log,json}`. The 31.872/4.602 wall figures have different populations (22 vs 33), so do not present them as an exact paired benchmark; the shared-runner 3-fixture comparison is the controlled measurement.

Vitest propagation is real, not assumed: `vitest.host-env.ts` scrubs AIF_/GETFF_/ORCHESTRATION_MODE_/RUNTIME_BRIDGE_/ZCODE_ prefixes and exact harness/git names, but no MO_ prefix or MO catalog names. The actual imported `isScrubbed` returns false for all three catalog variables. The original test files ran under the actual core config and its setupFiles in step 4, so this prototype's host seams survived setup. This is prototype-only propagation evidence, NOT a proposed reliance on operator-provided env.

## Contract accounting and no-loss limits

All current positive assertions survive: prefetch liveness and helper/fixture existence; exact table header; clean count 5/excluded 0/fix labels; mixed count 5, R-phase exclusion, I-phase-large exclusion, exactly one cap rejection, total 8; overlap count 3, exactly two overlap rejections, total 5; all-comment input exits cleanly with header and zero data rows. Empty input invokes no advisory assignment, so its existing direct exec does not add catalog cost.

All six current twin assertions survive against real mutated helpers: prefetch; pristine eligibility/cap control; path-sensitive memo isolation; disabled eligibility loses the R-phase exclusion; disabled cap produces >5; disabled overlap produces >3 and zero overlap rejections. Their original mutation setup copies the helpers tree as designed; the diagnostic driver itself copied no SUT. No positive assertion, mutation, fixture item, process dependency, or budget was removed.

Retained independent assignment witnesses (`packages/core/skills/assign-skill.test.ts`, 11/11 passing here): skill recommendation + matching skill deletion; agent recommendation + matching agent deletion; empty catalogs; zero token overlap; alphabetical skill tie; empty/whitespace descriptions; structural seam/output markers; one-line protocol. The .claude script used by these tests resolves to the exact canonical .agents script; no separate implementation is being substituted. These tests already use tiny explicit catalogs. Retained `skills/pipeline/repo-root-anchor.test.ts` has own/foreign cwd, explicit seam, loose install, linked worktree, canonical path, symlink, HOME, and planted-anchor-removal witnesses; source inspected, NOT executed in this diagnosis.

**Unique default-directory residue:** the current P20 path does execute assignment's live default directory selection. Its assertions never observe which skill/agent is found: an always-none assignment or broken default catalog lookup still passes every current P20 assertion because assignment is advisory and defaults to none. Thus it is incidental execution, not a unique semantic default-catalog/ranking oracle. No exact ranking over the evolving repository catalog is promised by P20 or existing assign-skill tests. Nevertheless, to avoid silently discarding this execution path, the implementation should retain default directory selection cheaply: use the existing assignment fixture's conventional `<tmpRoot>/.claude/skills` and `<tmpRoot>/agents` layout, clear MO_SKILLS_DIR/MO_AGENTS_DIR for one skill and one agent positive call, pin MO_SKILLS_GLOBAL=0, and assert the expected recommendation. This needs no live catalog and is a stronger semantic witness than current P20. It can extend existing A/B positive cases instead of proliferating a new suite. Explicit override/deletion/no-match paths remain covered by the other cases. This extra proposed protection was NOT implemented or executed here; no completed no-loss implementation claim is made.

## Bounded proposal for parent decision

Proceed to a small test-harness change only after parent review of this evidence:

- Give the shared P20 runner a fixed, tiny on-disk catalog using existing MO_SKILLS_DIR/MO_AGENTS_DIR seams, and explicitly force MO_SKILLS_GLOBAL=0 after spreading process.env in BOTH async prefetch and sync fallback. Keep real root resolution and all real helper invocations; do not stub assign-skill. A single common child-options/env builder avoids sync/async drift. Never mutate process.env globally for the permanent implementation.
- Keep one fixed catalog for the runner's module lifetime. The current cache key is only helper+backlog; varying catalog env inside the same module instance would invalidate its purity assumption. Separate CLI processes were used in the experiment for exactly this reason.
- Preserve all current tests/real mutants/timeouts. Add a semantic recurrence witness to the existing prefetch/liveness arm: fixture-eligible rows actually contain the expected fixture skill, so dropping the catalog seam, disabling real assignment, or accidentally falling back to the live catalog fails on behavior instead of a wall-clock quota. Keep the existing helper-path mutant cache witness. Confirm this witness turns red when either sync or async seam wiring is removed, and test a sync miss distinctly so a primed cache cannot hide the fallback path. The agent recommendation is independently protected by retained assignment tests; P20 need not duplicate ranking logic.
- Retain the cheap default-directory positive witness described above. Pin hostile ambient catalog/global inputs in the proposed child env; setup does not scrub MO_* and therefore host exports must never win.
- Use existing principle/meta-test execution for recurrence protection, with no new timer budget, timing quota, whole-suite retry, platform, scheduler, or production change. Re-run focused current tests + retained assignment/default witnesses and the normal required gate once implementation is reviewed. This report alone does not certify the loaded full pre-push run or future host timing.

Expected benefit supported by evidence: remove repeated irrelevant 40-candidate scans while preserving real bundle and assignment execution. The controlled 88.49% reduction supports this cause of avoidable setup cost. It does not identify the exact CPU scheduling/process-load state that made the historical run exceed 30 seconds. Residual shell classification and process startup remain.

Rejected alternatives: timeout increase and blanket retry merely tolerate unnecessary work; skipping assignment or mocking markdown output weakens integration; deleting/merging the existing contract assertions has no demonstrated benefit; changing production assignment indexing/algorithm is larger than the observed test setup problem and is unauthorized here.

## Self-application and adversarial check

Active discipline: T2 actual method execution; T3 commands/output; T5 read-only source; T6 explicit measured scope; T10 complete bounded population; T15 audit self-check; T18 empirically verify redundancy; T20 current evidence before recommendation; domain trap: a green faster test obtained by bypassing the advisory dependency could hide a missing integration. Counter: real runner, actual source, changed assigned-cell evidence, original real mutation arms, and proposed fixture recommendation sentinel. No broad sampling claim or external research/new mechanism is made: existing repository-supported seams are reused.

Actual category counter-question: “Which path could this speed-up erase even though all P20 assertions stay green?” Result from source: default-directory selection and inherited MO_SKILLS_GLOBAL behavior are not explicit P20 oracles. This report records that gap and proposes minimal default-layout positives plus fixed global-off env, rather than asserting existing protection that does not exist. Second counter-question: “Could memoization make the output comparison meaningless?” Driver processes are separate and both assert 3/3 primed; output cells visibly differ, so neither arm reused the other's cached output.

No production/index/HEAD modifications were made. `git status --short` was empty after experiments. Report path is ignored (`git check-ignore` confirms it). Scratch source/artifacts remain reviewable. No implementation is authorized by this report; awaiting parent decision.

## Source hashes

Full machine-readable comparison: `/workspace/scratch/p20-diagnosis-hashes.json`. All rows match push-2 bytes.

| File | Current SHA-256 (= push-2) |
|---|---|
| `packages/core/principles/20-bundle-classification.test.ts` | `915c7ed8d0f465b97908036cbfc18d9cd146f3b17c9d7d02763af39175e3af92` |
| `packages/core/principles/20-bundle-classification.paired-negative.test.ts` | `1d8916cc18a3cd25b6baca8bf6043e3e057de61c72f59f339012b63b69992dc6` |
| `packages/core/principles/20-bundle-classification.ts` | `e2f5946b61c466c165673ae8d6c1efe4d772fac34515b5db798cb13d147ed594` |
| `.agents/procedures/pipeline/helpers/bundle-curate.sh` | `7298ef71fe47ddb71083e8fc8f52163bf965d7abd4222f5a05fc533107db55dd` |
| `.agents/procedures/pipeline/helpers/classify-work.sh` | `316f94d907fcf2a21f07d143dbeda0386702114936ab4ad5093784f91ea63b70` |
| `.agents/procedures/pipeline/helpers/assign-skill.sh` | `2f9a076df8cdcc176daf66050327f4060dff4d800bc31358b0b132dc2673fbaf` |
| `.agents/procedures/pipeline/helpers/lib/common.sh` | `0cae123932f656c5a53d463b914f92e8026874bcacbd8b75f4caecb6ff24a150` |
| `packages/core/skills/assign-skill.test.ts` | `e728559ef694ad259c59d81613c17ecbe87d3a8646a90064f5c91744e33cf31a` |
| `packages/core/vitest.host-env.ts` | `3be7cebbaab055e48c0c38ecbee73a59f69075fd1a6f781a32caf551c7d0131b` |
| `packages/core/principles/__fixtures__/bundle/backlog-1-clean.txt` | `946b74c5cd11975fd0599ed5a2ddfbc39ae32a436bad558a64f4d4b424f0d980` |
| `packages/core/principles/__fixtures__/bundle/backlog-2-mixed.txt` | `e6fa98ffd9c2ec1f1825e9c0f3ac61d7abe31e6b7c89762739c70c4100ba6ed3` |
| `packages/core/principles/__fixtures__/bundle/backlog-3-overlap.txt` | `b4b46a44a002d99f8bb5381e80d8f279fd49ab7b31eb078d19c9a3108b4cb3b5` |
