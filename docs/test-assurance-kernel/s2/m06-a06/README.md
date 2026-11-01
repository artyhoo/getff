# M06 / A06 — delivered R4 assurance boundary

Original S2 A06 requires an honest R4 claim and a real delivered consumer
exercise. This slice clarifies the existing R4 policy and the Next, SPA and
React Native catalogs. It does not change the R4 probe, its caller, test-rule
implementations, installer, compiler configuration or any runtime bundle.

The original normative requirement remains intact: real assertions, no
conditional test bodies, parameterized numeric/state boundaries and fast-check
properties for pure functions. The automated probe establishes a matching file
and export-name reference. Configured test lint and actual execution are
separate channels. The existing named R4 rules-sidecar during `/aif-verify`, or
explicit manual R4 review when that companion is absent, retains responsibility
for assertion relevance, independent expectations and boundary/property
obligations. Passing this finite fixture does not certify all of R4.

## Actual delivery and prerequisites

The input is accepted private HEAD
`214abb75b7b2e7011a7e637bc498c65957528f8d`, tree
`33a9b303db9a3755c70f9c415b37067c9dc228a7`. The owned consumer was installed
by the actual `install.sh ts-server`, with noninteractive default core choices,
without `--full`, global installation or a factory/provider activation. The
installer, actual emitted probe/caller and test configuration are pinned below.

The first fixture borrowed framework dependencies and installation returned 0,
but ESLint configuration resolution could not import `@vitest/eslint-plugin`.
Its controller returned 2 before any case. That is a prerequisite failure, not
a quality rejection. The original install summary also reported an R4 failure;
a subsequent real `--only=R4` diagnostic returned 0. The cause of that earlier
summary is not established here. All original logs remain retained.

A narrow content-bound prerequisite renewal admitted a separate owned consumer
with real local `node_modules`, exact declared tool versions and its own lock.
Ordinary `npm install --package-lock-only --no-audit --no-fund` and
`npm ci --no-audit --no-fund` each returned 0; the actual installer then returned 0. This changes no framework or product dependencies. The existing nested
Vitest plugin peer override follows the installer dependency contract. The
fixture lock and actual installed versions are retained in the input records.
Default installation warnings and incomplete arming remain in the raw output;
this slice does not certify every consumer gate or a whole usable installation.

## Frozen cases and actual results

The original literal contract is preserved byte-for-byte in
[frozen-consumer-r4-contract.json](frozen-consumer-r4-contract.json).
The subject exports `isAdult(age)` with `age >= 18`; independent expectations
are false at 17 and true at 18. Every case uses the actual emitted
`src/domain/age.unit.ts` path and delivered R4 caller, ESLint and Vitest
configuration. Direct calls import the actual subject instead of duplicating
its predicate. Resolved ESLint configuration enables Q1 and Q2 at error severity.

Exit values below are actual child process statuses. Runnable counts include
the full real runner report, not just a selected passing title.

| Original case            | R4  | ESLint | Vitest | Runnable | Direct 17 / 18 |
| ------------------------ | --- | ------ | ------ | -------- | -------------- |
| comment-only             | 0   | 0      | 1      | 0        | false / true   |
| empty                    | 0   | 1      | 0      | 1        | false / true   |
| constant                 | 0   | 1      | 0      | 1        | false / true   |
| pinned-boundary          | 0   | 0      | 0      | 2        | false / true   |
| fault-pinned-boundary    | 0   | 0      | 1      | 2        | true / true    |
| fault-constant           | 0   | 1      | 0      | 1        | true / true    |
| restored-pinned-boundary | 0   | 0      | 0      | 2        | false / true   |

The comment-only file passes the structural floor and lint, but Vitest refuses
it because it has no runnable suite. This is discovery refusal, not a
behavioral fault kill or Q2 firing. The empty body is rejected by
`rules-as-tests/require-effective-assertion` with `noEffectiveAssertion`; the
constant assertion is rejected by `rules-as-tests/no-vacuous-assertion` with
`vacuousAssertion`. Both otherwise pass the runner, showing why runner success
alone does not establish assertion quality.

The source fault replaces `return age >= 18;` with `return age >= 0;` exactly
once. A direct import confirms that 17 now returns true. The unchanged pinned
boundary test then has exactly one intended failure, `rejects below the age of
majority`, with `expected true to be false`; the age-18 assertion passes. The
constant test still passes Vitest while the actual lint rejects it through Q1.
That constant test does not call the subject: the separate direct probe, not
that disconnected test, establishes fault reachability. Exact source restoration
returns the original two boundary assertions to green.

## Legitimate NodeNext positive companion

The original S1-style boundary fixture imports `./age.ts`. Actual lint and
Vitest admit it, but the actual emitted `npm run typecheck` returns 2 with
TS5097. Those original observations are retained and are not presented as a
fully legitimate compiling consumer positive.

An append-only companion was frozen before execution. It imports `./age.js`
for the existing NodeNext configuration and keeps exactly the same subject,
independent expected values, assertion logic and one-occurrence source fault.
No compiler option, original oracle or previous result was changed.

| Additional case   | R4  | ESLint | Typecheck | Vitest | Runnable | Direct 17 / 18 |
| ----------------- | --- | ------ | --------- | ------ | -------- | -------------- |
| nodenext-good     | 0   | 0      | 0         | 0      | 2        | false / true   |
| nodenext-fault    | 0   | 0      | 0         | 1      | 2        | true / true    |
| nodenext-restored | 0   | 0      | 0         | 0      | 2        | false / true   |

The companion reproduces the same intended single assertion failure and a
successful restoration. The final owned fixture keeps the compiling `.js`
import and the exact restored source. Emitted configuration and detector bytes
remain unchanged throughout both proofs.

## Scope and normal checks

Only R4.policy gains a scope clarification in the manifest; its original
normative prefix and every other manifest field/entry remain unchanged. Each
catalog gains an R4 scope note. React Native retains its accepted unwired/manual
Q1/Q2 status; this exercise establishes only the actual TS-server consumer path,
not a runtime matrix for other presets or all nine ESLint configurations.

Normal existing P05/P06 checks passed all 15 tests. The stock rules renderer
`--check` and normal shipped `format:check` returned 0. No generated table or
snapshot was refreshed. Evidence Markdown is formatted separately. Source and
application acceptance remain the responsibility of the existing independent
integration owner; this author does not approve their own result.

This is original shared M06 iteration 2/5, after accepted A08 iteration 1/5;
3 remain and PARTIAL use remains 0/2. There is no new A06 subcap. Existing
accepted S1, R4-SHELL6/4 and cf2 controls were not replayed. Remaining S2
population/class reconciliation, stage assembly, S3/S4, current CI/staging and
compatible sole-writer 0166 delivery remain original programme obligations.

## Reproducible evidence bindings

Full SHA-256 values below bind retained bytes. Source paths are repository
relative. Raw paths are relative to the owned `execution-2` evidence directory;
they identify already executed command receipts, unedited stdout/stderr,
source/test snapshots and frozen inputs. These retained artifacts are not
new runtime dependencies. No fixture cache or node_modules content is claimed
as a test result.

### Protected source and actual emitted inputs

| Repository input                            | SHA-256                                                            |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `packages/core/probes/audit-r4.ts`          | `64902bcaedea1fb1ed26271359a5c7f2bb0a1b7c5e0d46cee28df55d8a0a3d2d` |
| `packages/core/audit-self/audit-ai-docs.sh` | `2f1c7bca91c245f6dfcfbb6a73bb00b68728834c3789522de115230f3be64ad9` |
| `setup.d/40-configs.sh`                     | `ecd96962811f8ed69e3aacd9b2023bba8fd6be62a68d0e822de9ed7d28081df1` |
| `setup.d/70-deps.sh`                        | `4502b44d15eb6b488f070ace508fa95f1a14de04a9a3baf17a8f530f6e0af98a` |
| `templates/ts-server/eslint.config.mjs`     | `dd40d657ac8405f7c4d0e883840487e93196fe7c69be33da44c82d8181a27463` |
| `templates/ts-server/vitest.config.ts`      | `e36fb5e2a885594783cb85533a795f15e1195483df939dd41a6f34dc1c1d53db` |
| `templates/ts-server/tests-setup.ts`        | `eea201c22df96eff02f9b52638840cd2a82f46600e3f81cf6a419fae113725e4` |
| `package-lock.json`                         | `b0322aee4c6cb0f4c8f4a72ae7c6db94346f856250a5acd6e63eb77535aa3659` |
| `install.sh`                                | `19de65e2a4dd92c4ce238fbd94c98f5bc446ef52852d07a2a6608cd4348e4278` |
| `packages/getff/MANIFEST.sha256`            | `f227048c3aa34bfc2d24f84f5d4795fbca696c77cba63c65697770e10988ddd0` |

| Actual emitted consumer file                         | SHA-256                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| `scripts/audit-r4.ts`                                | `64902bcaedea1fb1ed26271359a5c7f2bb0a1b7c5e0d46cee28df55d8a0a3d2d` |
| `scripts/audit-ai-docs.sh`                           | `2f1c7bca91c245f6dfcfbb6a73bb00b68728834c3789522de115230f3be64ad9` |
| `eslint.config.mjs`                                  | `dd40d657ac8405f7c4d0e883840487e93196fe7c69be33da44c82d8181a27463` |
| `vitest.config.ts`                                   | `e36fb5e2a885594783cb85533a795f15e1195483df939dd41a6f34dc1c1d53db` |
| `tests/setup.ts`                                     | `eea201c22df96eff02f9b52638840cd2a82f46600e3f81cf6a419fae113725e4` |
| `tsconfig.json`                                      | `c1ddbbf63d339e4843a95ce003021adc06e906c178342854c9b9fa22238485f3` |
| `eslint-rules-local/index.mjs`                       | `088f00d025793164aefcec2e20747309d2347876acdcddd5efb65acd90b17929` |
| `eslint-rules-local/no-vacuous-assertion.mjs`        | `55fb8c0ab36449921743082a336010aa508bf7e9889a33111be75f844b43280e` |
| `eslint-rules-local/require-effective-assertion.mjs` | `70b318104a6e568378f8dcfd6e4962f64a6f79cad0f523d02132968007129868` |
| `package.json`                                       | `3d757459c09ff9b219a8627563a04979cbcddd95fe04ff3e167a0adbac7bcfeb` |
| `.ai-factory/RULES.md`                               | `392d802c532a4b4f038ef1201931cf41d691f3920427d6b946b3e670da86b4ac` |

Actual owned fixture lock: `891039b1c3b04282bd76e1afaac349bcbdd157fb392732d4697f1141f3a98aff`.

### Retained raw evidence

| Evidence path                                                              | SHA-256                                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `ACTUAL-EMITTED-INPUTS.json`                                               | `ff94b7ad44ba6e14217cc8a74c16e2b96c13f38544dd8ccbd68978d9851a4ad3` |
| `BRIEF-GO.json`                                                            | `68104f09a3beaca2d0c3b8cdab979abe9e4a8764d7a813bc535759f8df0ea6ea` |
| `BRIEF.md`                                                                 | `876831a8c47c4f3349da7ce271b026a97cc96eaacd06b27c9b7cfed3129858f7` |
| `EXACT-INPUT.json`                                                         | `2fd518566662287a0a41dd8db49eb53754356f08f56475e1d53c1fccee6a635a` |
| `FIXTURE-PREREQUISITE-RENEWAL-GO.json`                                     | `51f598318414b0ec98b4d6068788a341f71a899e4380c4a21b418e1068bbe022` |
| `FIXTURE-PREREQUISITE-RENEWAL.md`                                          | `bcf7ffb32ecdbde4a5657cc319cbfffded196e582b243e6d37a2f0741494025c` |
| `FROZEN-ACTUAL-PROOF-INPUTS.json`                                          | `0f4f25ed00815a9db05216e742794965ee3b69953ae4d3161d288472be0e6ece` |
| `FROZEN-CONSUMER-R4-CONTRACT.json`                                         | `2873b92141b1f8ae76f0de104ee1a1b1b11e0a268a87bf1e9f7ca8684240817d` |
| `FROZEN-NODENEXT-DRIVER.json`                                              | `a605966ad9b7db4d666f0b245dd52b619b1842fca682a8ae64ac3d78436f78f6` |
| `FROZEN-NODENEXT-GOOD-SUPPLEMENT.json`                                     | `72beb3dea5f3a822937a00c0b25393c22e65565ad57b9539b9abf9704894e874` |
| `NODENEXT-COMPANION-SCOPE-GO.json`                                         | `2867e558963b0e51935f8c40bdccff5ddf835395e54d31bad7699ee29cf0f77f` |
| `PREDECESSOR-A08-GO.json`                                                  | `7bb786fe655fe143a5bb69ab2573abb50cbee97e4b843de0dc89e2e1ed93cb2d` |
| `logs/00-actual-consumer-install.json`                                     | `05b27f7c03cb898f9e8ec2b19c78fa779376cfdfce66a6ae58ad7259abb25528` |
| `logs/00-actual-consumer-install.stderr.log`                               | `8491cbab8c7b16b2e167c77af9bbd1be26a4fa572a3867a59dbbd715ecc583ad` |
| `logs/00-actual-consumer-install.stdout.log`                               | `e6a5d3acb494536bad683b6839f6441b880307242e6a477367d22a96e1dc7075` |
| `logs/01-actual-delivered-a06-controller.json`                             | `fa574818aecaa734d3fcfb07e378915b265f000d579e0dbb4c05e77da7f4e781` |
| `logs/01-actual-delivered-a06-controller.stderr.log`                       | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/01-actual-delivered-a06-controller.stdout.log`                       | `9e871b94e0722b26c0710324bd6fbf7a4137919c11b7de3183ed7231ce2ac272` |
| `logs/02-r4-prerequisite-diagnosis.json`                                   | `4c1b9334bc8cad3855dfeaff9f9a7a5557c8f252999d60929132cd35ec00b5fc` |
| `logs/02-r4-prerequisite-diagnosis.stderr.log`                             | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/02-r4-prerequisite-diagnosis.stdout.log`                             | `d51f35e86ca9fd6fbebc864b45f07e6bb5818342c24c24a78c3a82d17ac864c1` |
| `logs/03-normal-source-clone.json`                                         | `e3b9419b0f360053dfa7e36ea455959400e910d7297eb7b3826a431e64564f35` |
| `logs/03-normal-source-clone.stderr.log`                                   | `c827925f8e4410a6c309da69c642a7747f24c7f2a4fefb6ed049769fbf39fff6` |
| `logs/03-normal-source-clone.stdout.log`                                   | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/04-normal-p05-p06.json`                                              | `4d20c76499ba4e6820a485beac5b3d0ccfca0218748ed71b67b90e0a56648dd7` |
| `logs/04-normal-p05-p06.stderr.log`                                        | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/04-normal-p05-p06.stdout.log`                                        | `70bfa6697bebd16d6e4ca23b5fa18405eedf3795787e8997e9afb67b0cee6b52` |
| `logs/05-stock-render-check.json`                                          | `66fb1b4f94862f2e2996006c45e6ffd6f5f6fc27085e4f2c5f4bc4ecef36259f` |
| `logs/05-stock-render-check.stderr.log`                                    | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/05-stock-render-check.stdout.log`                                    | `8dc5eb5fb5dd0db76471c7be681c8d2cf4714ecbc62756d65ac3e7cde3cff4c3` |
| `logs/06-normal-format.json`                                               | `fccbc7b80999a02f34d998021d4ab8c6cc9c356772fc48585b1b0cfad659f9bb` |
| `logs/06-normal-format.stderr.log`                                         | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/06-normal-format.stdout.log`                                         | `a2b4c7cf3ec5df84f52ff2e36650a1b1ed912a8557fdaff9317c4c90487837d2` |
| `outer-driver/direct-age.mts`                                              | `888e7127ec86b6115cf5fe4ba21fe030803ce4acba9d80a0374658f51a73a0d5` |
| `outer-driver/run-a06.py`                                                  | `6b3c2c01662cde46fe8c4ff7435001a5c904102f44d038da58a170e6b3a5075a` |
| `outer-driver/run-nodenext-companion.py`                                   | `9131c04583140b96fd9a4fd167686ff18eb0ff834a575bcecafa19c0acc95efc` |
| `proof-2/ACTUAL-DELIVERED-CASE-RESULTS.json`                               | `66b434bcdf01fc16e7edbd9b625347018fb1e30a687fd55c48f8546a808d0f7f` |
| `proof-2/ACTUAL-EMITTED-INPUTS.json`                                       | `516bc738205da1d3917a5e14ec0b88c8cd5647fce2547ed62d68061bf2fefbbd` |
| `proof-2/ACTUAL-NODENEXT-COMPANION-RESULTS.json`                           | `a0d5d3b58d0cc5e20f57e2f37def2acf6e9b66dcacb79148eecd508c63c4f11f` |
| `proof-2/FROZEN-ACTUAL-PROOF-INPUTS.json`                                  | `bd4254a41643803e49b68f00fe5511df7fbb8bd3978a2971a67118d1750aaeba` |
| `proof-2/FROZEN-CONSUMER-R4-CONTRACT.json`                                 | `2873b92141b1f8ae76f0de104ee1a1b1b11e0a268a87bf1e9f7ca8684240817d` |
| `proof-2/LOCKED-FIXTURE-INPUT.json`                                        | `e01d734ded06f9209193a3fe2c16e94c38375c4933042f144974200bcb8f1bba` |
| `proof-2/logs/00-materialize-fixture-lock.json`                            | `1844cbae34fbafb82917b7fb6a459cbe126d1dce378fac3e7cb4f881f233fcb9` |
| `proof-2/logs/00-materialize-fixture-lock.stderr.log`                      | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/logs/00-materialize-fixture-lock.stdout.log`                      | `e64af586ea357f57559d65d1407e250bb430d9affd6f6fb18035db10efc3efe1` |
| `proof-2/logs/01-npm-ci-owned-fixture.json`                                | `2d06c0df8c93a473f76b741f39bdda7459b875a2d56def146a3f0d469d50d4ea` |
| `proof-2/logs/01-npm-ci-owned-fixture.stderr.log`                          | `fd73a223466ea6aa3de8d327cde66e534f2a56d7e15a8fcbac2139611b2b30ab` |
| `proof-2/logs/01-npm-ci-owned-fixture.stdout.log`                          | `34e1cdd873ae10494198035680dc6405bdf865fc8bbbbf20c311ee378a2dc92e` |
| `proof-2/logs/02-actual-complete-consumer-install.json`                    | `8f7a1d117fc345e6111f66f3583239ae391d26f78d473e074f98473288289df3` |
| `proof-2/logs/02-actual-complete-consumer-install.stderr.log`              | `81a8cf473b0bc5594559e581452781f5c0134ce93287f234966e17e04f6487b7` |
| `proof-2/logs/02-actual-complete-consumer-install.stdout.log`              | `666ec8c2aba756139305243912a26ede2052205894d09f35be2cf31cdb42af61` |
| `proof-2/logs/03-actual-delivered-a06-controller.json`                     | `df3f1a47c215d5063d91b45d0d6eb9a3f176d018f1cd5e07ba076f4cac3e3d2d` |
| `proof-2/logs/03-actual-delivered-a06-controller.stderr.log`               | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/logs/03-actual-delivered-a06-controller.stdout.log`               | `a4b2e3c79d2276f64776e4d89d4ef12ae24cc5573ec2d5f49fa96227615facaa` |
| `proof-2/logs/04-legitimate-fixture-typecheck-diagnosis.json`              | `1ed2e7bdc5289c95a28e1c0e556b9bf09f3d62d4ad6b21aba24ba2ef02907401` |
| `proof-2/logs/04-legitimate-fixture-typecheck-diagnosis.stderr.log`        | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/logs/04-legitimate-fixture-typecheck-diagnosis.stdout.log`        | `6be4b02a5036b6e4024a700c2ed362872410130d3a5bab1a519276052cc50c03` |
| `proof-2/logs/05-actual-nodenext-companion-controller.json`                | `80f62b9695a760c9ddd83c742ed9d0706ca53a7a0c7a8fd0b88185deceb13cdf` |
| `proof-2/logs/05-actual-nodenext-companion-controller.stderr.log`          | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/logs/05-actual-nodenext-companion-controller.stdout.log`          | `4d761b72650e750496b5f10bd97b4063ef69ddd80e01681690a9ddfa1eed6332` |
| `proof-2/outer-driver/direct-age.mts`                                      | `888e7127ec86b6115cf5fe4ba21fe030803ce4acba9d80a0374658f51a73a0d5` |
| `proof-2/outer-driver/run-a06.py`                                          | `6b3c2c01662cde46fe8c4ff7435001a5c904102f44d038da58a170e6b3a5075a` |
| `proof-2/resolved-config/actual-calculated-eslint.command.json`            | `87b589db517be541acb53658e7b0e910a242d99f3db696428a1a4eaa71683f90` |
| `proof-2/resolved-config/actual-calculated-eslint.stderr.log`              | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/resolved-config/actual-calculated-eslint.stdout.log`              | `13c40e0a8f429a28fa0105bd96de835dc6b9510a0e4141be53dafe13cfcaa290` |
| `proof-2/runs/comment-only/RESULT.json`                                    | `71d570b7df62d207a78f6ac68512ce43f5787ff2775afcd6d7735601679bd880` |
| `proof-2/runs/comment-only/actual-age.ts`                                  | `882450c8baf0f0247f22b4ececd49c6d791fed404771213f919e0718cfb9b1c8` |
| `proof-2/runs/comment-only/actual-age.unit.ts`                             | `332cf3dfdf08b7351a1da5f1a6a1bc05e7c657c4cccf05d3b78312403f364f2a` |
| `proof-2/runs/comment-only/actual-emitted-eslint.command.json`             | `99b1a82eef9ace3fdeec783b16c243dc271b4bdc9c04ccff952bfaf12e5d986a` |
| `proof-2/runs/comment-only/actual-emitted-eslint.stderr.log`               | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/comment-only/actual-emitted-eslint.stdout.log`               | `e8c67b7a6a7a1a56abceb1a7baae69aa76d9c743674e991104e162b7efdfb610` |
| `proof-2/runs/comment-only/actual-emitted-vitest.command.json`             | `8e698e4ecd58e959b8bef6e2a52af50d734e11dccd00ef1be598b12543fa6cef` |
| `proof-2/runs/comment-only/actual-emitted-vitest.stderr.log`               | `66ce603d6ee87038af3ea0576adaed6cd8cb8136e0d3d23db999832605e92908` |
| `proof-2/runs/comment-only/actual-emitted-vitest.stdout.log`               | `02bef58c7edd5750de7fd4734724401e9b53c51b0c07197572b53e1d2d7035bb` |
| `proof-2/runs/comment-only/actual-r4-caller.command.json`                  | `053f10f3e6861911b9939fd0193e981064007ecc68dd00a61c4b9bd55dd17acd` |
| `proof-2/runs/comment-only/actual-r4-caller.stderr.log`                    | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/comment-only/actual-r4-caller.stdout.log`                    | `d51f35e86ca9fd6fbebc864b45f07e6bb5818342c24c24a78c3a82d17ac864c1` |
| `proof-2/runs/comment-only/independent-age-call.command.json`              | `3fb3b257dfb8f79e25f1013e6319895247fb7ed694ff19bf05947d9afa0692cd` |
| `proof-2/runs/comment-only/independent-age-call.stderr.log`                | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/comment-only/independent-age-call.stdout.log`                | `395913ac92d95f3e14bdf4d2e0d48b6f33e7c64fa23979dbfa924d6bc58c8314` |
| `proof-2/runs/constant/RESULT.json`                                        | `a165d560f1cb1608d80eca88d538eebe441d0c059b231d0f821fd68393f99d25` |
| `proof-2/runs/constant/actual-age.ts`                                      | `882450c8baf0f0247f22b4ececd49c6d791fed404771213f919e0718cfb9b1c8` |
| `proof-2/runs/constant/actual-age.unit.ts`                                 | `7e013efa147787c0d073baaa9e1ed1e7a85aa76c2e1c402473e4295d08362527` |
| `proof-2/runs/constant/actual-emitted-eslint.command.json`                 | `6ff4b91c33359da53eacc3b8d692ce35df7544966253c1e616471520c4107df0` |
| `proof-2/runs/constant/actual-emitted-eslint.stderr.log`                   | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/constant/actual-emitted-eslint.stdout.log`                   | `24a18fe84f8622b24fc0f06696d53c1e34b1b712cd0da1d606b3907845101b79` |
| `proof-2/runs/constant/actual-emitted-vitest.command.json`                 | `4451a89634c48eee9f388b4d587ac91fa2f7b4d66e69e89401235e69fc0d9991` |
| `proof-2/runs/constant/actual-emitted-vitest.stderr.log`                   | `66ce603d6ee87038af3ea0576adaed6cd8cb8136e0d3d23db999832605e92908` |
| `proof-2/runs/constant/actual-emitted-vitest.stdout.log`                   | `48f20bd3dd002d799f25df566b572f84f58729259495c487e0ec16bb35595467` |
| `proof-2/runs/constant/actual-r4-caller.command.json`                      | `053f10f3e6861911b9939fd0193e981064007ecc68dd00a61c4b9bd55dd17acd` |
| `proof-2/runs/constant/actual-r4-caller.stderr.log`                        | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/constant/actual-r4-caller.stdout.log`                        | `d51f35e86ca9fd6fbebc864b45f07e6bb5818342c24c24a78c3a82d17ac864c1` |
| `proof-2/runs/constant/independent-age-call.command.json`                  | `3fb3b257dfb8f79e25f1013e6319895247fb7ed694ff19bf05947d9afa0692cd` |
| `proof-2/runs/constant/independent-age-call.stderr.log`                    | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/constant/independent-age-call.stdout.log`                    | `395913ac92d95f3e14bdf4d2e0d48b6f33e7c64fa23979dbfa924d6bc58c8314` |
| `proof-2/runs/empty/RESULT.json`                                           | `145f67b3990f2e3b3491712123b6619b5d42fcc0539243e53dd5e8bf3ea9295e` |
| `proof-2/runs/empty/actual-age.ts`                                         | `882450c8baf0f0247f22b4ececd49c6d791fed404771213f919e0718cfb9b1c8` |
| `proof-2/runs/empty/actual-age.unit.ts`                                    | `bc9e881d57e77b47c720a73a73060d69fd8efa6fd75f0f0a3fbdaa7c26bf0633` |
| `proof-2/runs/empty/actual-emitted-eslint.command.json`                    | `7b36e4f0fece5e7f6171b6c8cd912a5507ea996b184005e80d6cd7c115e01e39` |
| `proof-2/runs/empty/actual-emitted-eslint.stderr.log`                      | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/empty/actual-emitted-eslint.stdout.log`                      | `e56f98743d1206dc6512e532a3d797ff1b17b44ffbf90960a6d7f08e6c0574a9` |
| `proof-2/runs/empty/actual-emitted-vitest.command.json`                    | `c98d815cd65380d460bd33db73271f603709263c2801e3cab6a7f21e46ddeaa2` |
| `proof-2/runs/empty/actual-emitted-vitest.stderr.log`                      | `66ce603d6ee87038af3ea0576adaed6cd8cb8136e0d3d23db999832605e92908` |
| `proof-2/runs/empty/actual-emitted-vitest.stdout.log`                      | `0dc10f36f1e12a4166af87c868244dc8710f238b1814b0ddbae26d9dc6908184` |
| `proof-2/runs/empty/actual-r4-caller.command.json`                         | `053f10f3e6861911b9939fd0193e981064007ecc68dd00a61c4b9bd55dd17acd` |
| `proof-2/runs/empty/actual-r4-caller.stderr.log`                           | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/empty/actual-r4-caller.stdout.log`                           | `d51f35e86ca9fd6fbebc864b45f07e6bb5818342c24c24a78c3a82d17ac864c1` |
| `proof-2/runs/empty/independent-age-call.command.json`                     | `3fb3b257dfb8f79e25f1013e6319895247fb7ed694ff19bf05947d9afa0692cd` |
| `proof-2/runs/empty/independent-age-call.stderr.log`                       | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/empty/independent-age-call.stdout.log`                       | `395913ac92d95f3e14bdf4d2e0d48b6f33e7c64fa23979dbfa924d6bc58c8314` |
| `proof-2/runs/fault-constant/RESULT.json`                                  | `a06f1906aadb7930ef03d62bac907ff53f4c18d967a6a122d1e3403d7a78cd58` |
| `proof-2/runs/fault-constant/actual-age.ts`                                | `80a3a931f71ce46a6282e56b45bf0adbd778ca4701a0960b3b538668336045f0` |
| `proof-2/runs/fault-constant/actual-age.unit.ts`                           | `7e013efa147787c0d073baaa9e1ed1e7a85aa76c2e1c402473e4295d08362527` |
| `proof-2/runs/fault-constant/actual-emitted-eslint.command.json`           | `6ff4b91c33359da53eacc3b8d692ce35df7544966253c1e616471520c4107df0` |
| `proof-2/runs/fault-constant/actual-emitted-eslint.stderr.log`             | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/fault-constant/actual-emitted-eslint.stdout.log`             | `24a18fe84f8622b24fc0f06696d53c1e34b1b712cd0da1d606b3907845101b79` |
| `proof-2/runs/fault-constant/actual-emitted-vitest.command.json`           | `01a0a8fc0a3f4483f4b3db962efed729984b8fcee651c591473084ac585a6dd5` |
| `proof-2/runs/fault-constant/actual-emitted-vitest.stderr.log`             | `66ce603d6ee87038af3ea0576adaed6cd8cb8136e0d3d23db999832605e92908` |
| `proof-2/runs/fault-constant/actual-emitted-vitest.stdout.log`             | `f42099edbb086aff176dd951d2dd7d9d8e08ba77e62a48878ac7782233586221` |
| `proof-2/runs/fault-constant/actual-r4-caller.command.json`                | `053f10f3e6861911b9939fd0193e981064007ecc68dd00a61c4b9bd55dd17acd` |
| `proof-2/runs/fault-constant/actual-r4-caller.stderr.log`                  | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/fault-constant/actual-r4-caller.stdout.log`                  | `d51f35e86ca9fd6fbebc864b45f07e6bb5818342c24c24a78c3a82d17ac864c1` |
| `proof-2/runs/fault-constant/independent-age-call.command.json`            | `c64d3d6259768c7813f5258ef1837d674b654c1955abe7d477ba13f04a1d3448` |
| `proof-2/runs/fault-constant/independent-age-call.stderr.log`              | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/fault-constant/independent-age-call.stdout.log`              | `d3ba61a13c6fdfc2ee98d21ee750d3b6c0c958d6263e5222796c7778d016d464` |
| `proof-2/runs/fault-pinned-boundary/RESULT.json`                           | `a433e7d9fe668398b8ee2bb59e17b8d468f0ae015ccc07e09bb4c666317976b7` |
| `proof-2/runs/fault-pinned-boundary/actual-age.ts`                         | `80a3a931f71ce46a6282e56b45bf0adbd778ca4701a0960b3b538668336045f0` |
| `proof-2/runs/fault-pinned-boundary/actual-age.unit.ts`                    | `74ce4324bf70ebe0d61cb9e691c2660f4e9371d325de19a9bbca800b58f4824b` |
| `proof-2/runs/fault-pinned-boundary/actual-emitted-eslint.command.json`    | `99b1a82eef9ace3fdeec783b16c243dc271b4bdc9c04ccff952bfaf12e5d986a` |
| `proof-2/runs/fault-pinned-boundary/actual-emitted-eslint.stderr.log`      | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/fault-pinned-boundary/actual-emitted-eslint.stdout.log`      | `e8c67b7a6a7a1a56abceb1a7baae69aa76d9c743674e991104e162b7efdfb610` |
| `proof-2/runs/fault-pinned-boundary/actual-emitted-vitest.command.json`    | `8d2e023d2e3e121757ffe754f957cccf616031e8367799ff588443381dac1358` |
| `proof-2/runs/fault-pinned-boundary/actual-emitted-vitest.stderr.log`      | `66ce603d6ee87038af3ea0576adaed6cd8cb8136e0d3d23db999832605e92908` |
| `proof-2/runs/fault-pinned-boundary/actual-emitted-vitest.stdout.log`      | `6db19c08f0d5bc69de9d5d29bce968973d8a39dbc302c6814dee38bd127db0db` |
| `proof-2/runs/fault-pinned-boundary/actual-r4-caller.command.json`         | `053f10f3e6861911b9939fd0193e981064007ecc68dd00a61c4b9bd55dd17acd` |
| `proof-2/runs/fault-pinned-boundary/actual-r4-caller.stderr.log`           | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/fault-pinned-boundary/actual-r4-caller.stdout.log`           | `d51f35e86ca9fd6fbebc864b45f07e6bb5818342c24c24a78c3a82d17ac864c1` |
| `proof-2/runs/fault-pinned-boundary/independent-age-call.command.json`     | `c64d3d6259768c7813f5258ef1837d674b654c1955abe7d477ba13f04a1d3448` |
| `proof-2/runs/fault-pinned-boundary/independent-age-call.stderr.log`       | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/fault-pinned-boundary/independent-age-call.stdout.log`       | `d3ba61a13c6fdfc2ee98d21ee750d3b6c0c958d6263e5222796c7778d016d464` |
| `proof-2/runs/nodenext-fault/RESULT.json`                                  | `9970b8cc7f33c74c5b4f4601bd6eb214adb41de5b78745c63e8f915a3e7fae04` |
| `proof-2/runs/nodenext-fault/actual-age.ts`                                | `80a3a931f71ce46a6282e56b45bf0adbd778ca4701a0960b3b538668336045f0` |
| `proof-2/runs/nodenext-fault/actual-age.unit.ts`                           | `1b22eb24963142342e566eb6e58419516d828112526382989c8ddf1a46fc85e7` |
| `proof-2/runs/nodenext-fault/actual-emitted-eslint.command.json`           | `99b1a82eef9ace3fdeec783b16c243dc271b4bdc9c04ccff952bfaf12e5d986a` |
| `proof-2/runs/nodenext-fault/actual-emitted-eslint.stderr.log`             | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/nodenext-fault/actual-emitted-eslint.stdout.log`             | `e8c67b7a6a7a1a56abceb1a7baae69aa76d9c743674e991104e162b7efdfb610` |
| `proof-2/runs/nodenext-fault/actual-emitted-typecheck.command.json`        | `151f29f0fbc71982a2ae5519cca941a533510363a11e1bdcf5ccef1eb36d5493` |
| `proof-2/runs/nodenext-fault/actual-emitted-typecheck.stderr.log`          | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/nodenext-fault/actual-emitted-typecheck.stdout.log`          | `a9af0434cf5dd91aacb54ac971f85591235840d839abac7e7bf1be2bc91dc0a1` |
| `proof-2/runs/nodenext-fault/actual-emitted-vitest.command.json`           | `3295d4dff04718485e9974997d2bba9b447f4d484bf0b078c659ea3a8332bdf6` |
| `proof-2/runs/nodenext-fault/actual-emitted-vitest.stderr.log`             | `66ce603d6ee87038af3ea0576adaed6cd8cb8136e0d3d23db999832605e92908` |
| `proof-2/runs/nodenext-fault/actual-emitted-vitest.stdout.log`             | `e9199c999123f0c5a9fc8e3f255d0e098b34af388bcf7b67a0dad10d718e372b` |
| `proof-2/runs/nodenext-fault/actual-r4-caller.command.json`                | `053f10f3e6861911b9939fd0193e981064007ecc68dd00a61c4b9bd55dd17acd` |
| `proof-2/runs/nodenext-fault/actual-r4-caller.stderr.log`                  | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/nodenext-fault/actual-r4-caller.stdout.log`                  | `d51f35e86ca9fd6fbebc864b45f07e6bb5818342c24c24a78c3a82d17ac864c1` |
| `proof-2/runs/nodenext-fault/independent-age-call.command.json`            | `c64d3d6259768c7813f5258ef1837d674b654c1955abe7d477ba13f04a1d3448` |
| `proof-2/runs/nodenext-fault/independent-age-call.stderr.log`              | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/nodenext-fault/independent-age-call.stdout.log`              | `d3ba61a13c6fdfc2ee98d21ee750d3b6c0c958d6263e5222796c7778d016d464` |
| `proof-2/runs/nodenext-good/RESULT.json`                                   | `85df8e009d13ac9978e9424fac4e611426dada66455a0b70f236882515fa5acc` |
| `proof-2/runs/nodenext-good/actual-age.ts`                                 | `882450c8baf0f0247f22b4ececd49c6d791fed404771213f919e0718cfb9b1c8` |
| `proof-2/runs/nodenext-good/actual-age.unit.ts`                            | `1b22eb24963142342e566eb6e58419516d828112526382989c8ddf1a46fc85e7` |
| `proof-2/runs/nodenext-good/actual-emitted-eslint.command.json`            | `99b1a82eef9ace3fdeec783b16c243dc271b4bdc9c04ccff952bfaf12e5d986a` |
| `proof-2/runs/nodenext-good/actual-emitted-eslint.stderr.log`              | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/nodenext-good/actual-emitted-eslint.stdout.log`              | `e8c67b7a6a7a1a56abceb1a7baae69aa76d9c743674e991104e162b7efdfb610` |
| `proof-2/runs/nodenext-good/actual-emitted-typecheck.command.json`         | `151f29f0fbc71982a2ae5519cca941a533510363a11e1bdcf5ccef1eb36d5493` |
| `proof-2/runs/nodenext-good/actual-emitted-typecheck.stderr.log`           | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/nodenext-good/actual-emitted-typecheck.stdout.log`           | `a9af0434cf5dd91aacb54ac971f85591235840d839abac7e7bf1be2bc91dc0a1` |
| `proof-2/runs/nodenext-good/actual-emitted-vitest.command.json`            | `02913353b33bdea2b21e89dc80bf8ed43ad5b1e2fe591ce81c349503cda4251c` |
| `proof-2/runs/nodenext-good/actual-emitted-vitest.stderr.log`              | `66ce603d6ee87038af3ea0576adaed6cd8cb8136e0d3d23db999832605e92908` |
| `proof-2/runs/nodenext-good/actual-emitted-vitest.stdout.log`              | `38f22d504b1117017fc90f6d209da29d5d2f5f347750f797d9f07c2341a80bfa` |
| `proof-2/runs/nodenext-good/actual-r4-caller.command.json`                 | `053f10f3e6861911b9939fd0193e981064007ecc68dd00a61c4b9bd55dd17acd` |
| `proof-2/runs/nodenext-good/actual-r4-caller.stderr.log`                   | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/nodenext-good/actual-r4-caller.stdout.log`                   | `d51f35e86ca9fd6fbebc864b45f07e6bb5818342c24c24a78c3a82d17ac864c1` |
| `proof-2/runs/nodenext-good/independent-age-call.command.json`             | `3fb3b257dfb8f79e25f1013e6319895247fb7ed694ff19bf05947d9afa0692cd` |
| `proof-2/runs/nodenext-good/independent-age-call.stderr.log`               | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/nodenext-good/independent-age-call.stdout.log`               | `395913ac92d95f3e14bdf4d2e0d48b6f33e7c64fa23979dbfa924d6bc58c8314` |
| `proof-2/runs/nodenext-restored/RESULT.json`                               | `423f02bb393e78f51cf4d612c196c4d9fd3764847516f207c7d6bcc4152c00d2` |
| `proof-2/runs/nodenext-restored/actual-age.ts`                             | `882450c8baf0f0247f22b4ececd49c6d791fed404771213f919e0718cfb9b1c8` |
| `proof-2/runs/nodenext-restored/actual-age.unit.ts`                        | `1b22eb24963142342e566eb6e58419516d828112526382989c8ddf1a46fc85e7` |
| `proof-2/runs/nodenext-restored/actual-emitted-eslint.command.json`        | `99b1a82eef9ace3fdeec783b16c243dc271b4bdc9c04ccff952bfaf12e5d986a` |
| `proof-2/runs/nodenext-restored/actual-emitted-eslint.stderr.log`          | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/nodenext-restored/actual-emitted-eslint.stdout.log`          | `e8c67b7a6a7a1a56abceb1a7baae69aa76d9c743674e991104e162b7efdfb610` |
| `proof-2/runs/nodenext-restored/actual-emitted-typecheck.command.json`     | `151f29f0fbc71982a2ae5519cca941a533510363a11e1bdcf5ccef1eb36d5493` |
| `proof-2/runs/nodenext-restored/actual-emitted-typecheck.stderr.log`       | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/nodenext-restored/actual-emitted-typecheck.stdout.log`       | `a9af0434cf5dd91aacb54ac971f85591235840d839abac7e7bf1be2bc91dc0a1` |
| `proof-2/runs/nodenext-restored/actual-emitted-vitest.command.json`        | `1af35cb5608f767ed3ce464cb74f6ca281b0d55767fae5c581d0f483e3632cc7` |
| `proof-2/runs/nodenext-restored/actual-emitted-vitest.stderr.log`          | `66ce603d6ee87038af3ea0576adaed6cd8cb8136e0d3d23db999832605e92908` |
| `proof-2/runs/nodenext-restored/actual-emitted-vitest.stdout.log`          | `83cdb78473883fe8561b1b56bea963599637dd86d304a1b274012e0528d3afca` |
| `proof-2/runs/nodenext-restored/actual-r4-caller.command.json`             | `053f10f3e6861911b9939fd0193e981064007ecc68dd00a61c4b9bd55dd17acd` |
| `proof-2/runs/nodenext-restored/actual-r4-caller.stderr.log`               | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/nodenext-restored/actual-r4-caller.stdout.log`               | `d51f35e86ca9fd6fbebc864b45f07e6bb5818342c24c24a78c3a82d17ac864c1` |
| `proof-2/runs/nodenext-restored/independent-age-call.command.json`         | `3fb3b257dfb8f79e25f1013e6319895247fb7ed694ff19bf05947d9afa0692cd` |
| `proof-2/runs/nodenext-restored/independent-age-call.stderr.log`           | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/nodenext-restored/independent-age-call.stdout.log`           | `395913ac92d95f3e14bdf4d2e0d48b6f33e7c64fa23979dbfa924d6bc58c8314` |
| `proof-2/runs/pinned-boundary/RESULT.json`                                 | `1ee0c2e6f1e8a1e9d438e840d6085595e2fdbc92690857f5a9d4740e25a7db29` |
| `proof-2/runs/pinned-boundary/actual-age.ts`                               | `882450c8baf0f0247f22b4ececd49c6d791fed404771213f919e0718cfb9b1c8` |
| `proof-2/runs/pinned-boundary/actual-age.unit.ts`                          | `74ce4324bf70ebe0d61cb9e691c2660f4e9371d325de19a9bbca800b58f4824b` |
| `proof-2/runs/pinned-boundary/actual-emitted-eslint.command.json`          | `99b1a82eef9ace3fdeec783b16c243dc271b4bdc9c04ccff952bfaf12e5d986a` |
| `proof-2/runs/pinned-boundary/actual-emitted-eslint.stderr.log`            | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/pinned-boundary/actual-emitted-eslint.stdout.log`            | `e8c67b7a6a7a1a56abceb1a7baae69aa76d9c743674e991104e162b7efdfb610` |
| `proof-2/runs/pinned-boundary/actual-emitted-vitest.command.json`          | `8293be3da3a274e65411da4449f64410206b8a1320bc5b6bfdbd1725eb599665` |
| `proof-2/runs/pinned-boundary/actual-emitted-vitest.stderr.log`            | `66ce603d6ee87038af3ea0576adaed6cd8cb8136e0d3d23db999832605e92908` |
| `proof-2/runs/pinned-boundary/actual-emitted-vitest.stdout.log`            | `5aae1b8e9c7382609a2e06445b89a8706018865331d21f056076d052bbb478e0` |
| `proof-2/runs/pinned-boundary/actual-r4-caller.command.json`               | `053f10f3e6861911b9939fd0193e981064007ecc68dd00a61c4b9bd55dd17acd` |
| `proof-2/runs/pinned-boundary/actual-r4-caller.stderr.log`                 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/pinned-boundary/actual-r4-caller.stdout.log`                 | `d51f35e86ca9fd6fbebc864b45f07e6bb5818342c24c24a78c3a82d17ac864c1` |
| `proof-2/runs/pinned-boundary/independent-age-call.command.json`           | `3fb3b257dfb8f79e25f1013e6319895247fb7ed694ff19bf05947d9afa0692cd` |
| `proof-2/runs/pinned-boundary/independent-age-call.stderr.log`             | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/pinned-boundary/independent-age-call.stdout.log`             | `395913ac92d95f3e14bdf4d2e0d48b6f33e7c64fa23979dbfa924d6bc58c8314` |
| `proof-2/runs/restored-pinned-boundary/RESULT.json`                        | `613f91073fe8e61c34b6dddbdd45a5b611877a8520d0ec923e2d90cf067a2d06` |
| `proof-2/runs/restored-pinned-boundary/actual-age.ts`                      | `882450c8baf0f0247f22b4ececd49c6d791fed404771213f919e0718cfb9b1c8` |
| `proof-2/runs/restored-pinned-boundary/actual-age.unit.ts`                 | `74ce4324bf70ebe0d61cb9e691c2660f4e9371d325de19a9bbca800b58f4824b` |
| `proof-2/runs/restored-pinned-boundary/actual-emitted-eslint.command.json` | `99b1a82eef9ace3fdeec783b16c243dc271b4bdc9c04ccff952bfaf12e5d986a` |
| `proof-2/runs/restored-pinned-boundary/actual-emitted-eslint.stderr.log`   | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/restored-pinned-boundary/actual-emitted-eslint.stdout.log`   | `e8c67b7a6a7a1a56abceb1a7baae69aa76d9c743674e991104e162b7efdfb610` |
| `proof-2/runs/restored-pinned-boundary/actual-emitted-vitest.command.json` | `77f6e560c957b5ec41d0823b26114e9a0a784344508a3cbcf40a037e27a3749a` |
| `proof-2/runs/restored-pinned-boundary/actual-emitted-vitest.stderr.log`   | `66ce603d6ee87038af3ea0576adaed6cd8cb8136e0d3d23db999832605e92908` |
| `proof-2/runs/restored-pinned-boundary/actual-emitted-vitest.stdout.log`   | `0b392e96b1596715dc0738c0139b8ae09c0eeb60077695f7062727263674ce76` |
| `proof-2/runs/restored-pinned-boundary/actual-r4-caller.command.json`      | `053f10f3e6861911b9939fd0193e981064007ecc68dd00a61c4b9bd55dd17acd` |
| `proof-2/runs/restored-pinned-boundary/actual-r4-caller.stderr.log`        | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/restored-pinned-boundary/actual-r4-caller.stdout.log`        | `d51f35e86ca9fd6fbebc864b45f07e6bb5818342c24c24a78c3a82d17ac864c1` |
| `proof-2/runs/restored-pinned-boundary/independent-age-call.command.json`  | `3fb3b257dfb8f79e25f1013e6319895247fb7ed694ff19bf05947d9afa0692cd` |
| `proof-2/runs/restored-pinned-boundary/independent-age-call.stderr.log`    | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `proof-2/runs/restored-pinned-boundary/independent-age-call.stdout.log`    | `395913ac92d95f3e14bdf4d2e0d48b6f33e7c64fa23979dbfa924d6bc58c8314` |
| `resolved-config/actual-calculated-eslint.command.json`                    | `e5a4d6d92b57931e96774483378582bff61c07e0c04f3c4eaf4d89855465b9a7` |
| `resolved-config/actual-calculated-eslint.stderr.log`                      | `fb62bd3e96396b018ce9eb2f5b2ed021329e7180f487a7c9b581a3b963a85187` |
| `resolved-config/actual-calculated-eslint.stdout.log`                      | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
