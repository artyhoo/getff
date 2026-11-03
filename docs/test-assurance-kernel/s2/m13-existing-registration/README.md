# M13 — register the two shipped test-quality rules

> **Authoritative for:** finite C4/C5 registration, catalog and omission evidence for this candidate.
> **NOT authoritative for:** test-quality semantics or whole-stage completion; see the S1 policy and original S2 kickoff.

Candidate preparation on accepted base `40f3680b84ee6e8a44cad5bcfd1e8a88720b2a2d`,
tree `aa0b2d5c77203baf70152c509b31544013a3d51c`. Independent candidate acceptance
and actual source application remain pending at authoring time.

## Existing contract, bounded repair

S1 queued dispositions C4/C5 require catalog rows and manifest registration for
the existing Q1/Q2 rules. R21 registers `rules-as-tests/no-vacuous-assertion`;
R22 registers `rules-as-tests/require-effective-assertion`. Both use the original
allowed registration stacks `ts-server` and `react-next`. The old 26 entries retain
identical values. No schema, stack enum, rule implementation, severity or config changed.

The verbatim `frozen-two-rule-contract.json` is the independently frozen input.
Its historical source/admission metadata describes the earlier freeze, not this
executed result. Its exact bad/good examples and intended messages remain unchanged.
Both registrations provide nonempty negative-test input and their intended message IDs.

The actual P05 test `manifest registers the two shipped test-quality rules` has a
literal expected pair and exact registration/example/negative-test expectations.
Required IDs are not discovered from the manifest under test. Original four tests
retain their logic. Before the first frozen run, stock formatting wrapped two
existing expressions; no old assertion or decision changed. Before manifest repair
the new actual test failed on old26 with
real process 1 and named missing R21; that is the retained initial RED.

## Actual registry and lint proof

The existing `getChangedEslintRuleIds` selects exactly R21/R22 from old/current
manifests. The actual `runGuardLivenessGate` reports both passed, failures/skipped/
noData empty. Its separate changed-file arm is retained, not replaced or globally
certified by this manifest proof. The actual schema validator accepts all 28 entries.

Direct ESLint roundtrips through the existing core plugin and parser give:

| Rule | Frozen bad                                             | Frozen good   |
| ---- | ------------------------------------------------------ | ------------- |
| R21  | Exactly 1 `vacuousAssertion` for the intended rule     | 0 diagnostics |
| R22  | Exactly 1 `noEffectiveAssertion` for the intended rule | 0 diagnostics |

The two rules are syntax floors. This does not prove behavioral coverage, oracle
independence, mock fidelity, or universal assertion recognition.

## Fixed carrier omission controls

One byte-frozen driver executes the actual appended P05 file using stock Vitest
`-t` filtering for its exact title. Every full reporter output has exactly one total
passed/failed runnable assertion, in the actual subject file with that exact title.
A passed assertion requires genuine process0. A selected named missing-rule failure
requires ordinary process1. Infrastructure, status conflicts and unrelated renderer
failures are never counted as detection. The same required two-rule population and
normative admission expectation remain fixed under both omissions.

| Arm                             | Actual process | Outer exit | Observed diagnostic                |
| ------------------------------- | -------------- | ---------- | ---------------------------------- |
| Before repair, old26            | 1              | 1          | Missing required manifest rule R21 |
| Registered good                 | 0              | 0          | None                               |
| Omit only R21                   | 1              | 1          | Missing required manifest rule R21 |
| Omit only R22                   | 1              | 1          | Missing required manifest rule R22 |
| Restored exact registered bytes | 0              | 0          | None                               |

Final restoration checks the actual scratch against the exact last omit-R22 preimage
before replacing it with the full corrected manifest. Its final digest equals the
producer manifest. Source, driver and frozen expected inputs stay unchanged.

## Three delivered catalog surfaces

The existing stock renderer updates only the canonical Next marked table and its
existing renderer snapshot. TS server/Next delivery uses this canonical base catalog.
SPA and React Native each receive their own static base RULES.md via the existing
`setup.d/30-templates.sh` branches. Stack extension RULES.react-* files are untouched.

SPA rows describe its already-enabled Q1/Q2 test-file ESLint checks. React Native
rows explicitly say NOT wired and retain manual R4 review; no RN enforcement is
added or promised. Catalog authority headers remain and their local range wording
includes the two new rows. This is source delivery-path evidence, not a fresh consumer
installation or general configuration-matrix certification.

## Complete retained evidence bindings

Labels below are relative to retained bundle `s2-m13-existing-registration/execution-1/`.
Source labels are repository-relative. All digests are full SHA256; raw artifacts are
off-tree retained evidence, not new shipped source files.

| Source/input                                                                            | SHA256                                                             |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/core/manifest/rules-manifest.json`                                            | `6872daf7622f36c89234cbf043cb5532cf40212f24672921b9190772efb0f311` |
| `packages/core/principles/05-manifest-ssot.test.ts`                                     | `01b17ef7a0671ce703033e8abd1d1dd920e0d724f714408a9450bbe66cf154ea` |
| `packages/core/render/__snapshots__/render-rules.test.ts.snap`                          | `bd1a86267743764dfa0705de3dbd42d93dd0e9bae72daa3fcbd9f6a9569cccd0` |
| `packages/preset-next-15-canonical/RULES.md`                                            | `392d802c532a4b4f038ef1201931cf41d691f3920427d6b946b3e670da86b4ac` |
| `packages/preset-react-spa/RULES.md`                                                    | `bb8a22661b16fbd0e0d31daaa957b6f62099da99595bd523f3c1efdd17adf3fc` |
| `packages/preset-react-native/RULES.md`                                                 | `9768e65d9e0af8b3114aa09fb250e0342943d38a08ca5ff346c49d4fbad9befe` |
| `docs/test-assurance-kernel/s2/m13-existing-registration/frozen-two-rule-contract.json` | `a063538fc3d76f202060e822c5400c8d12ea8c25b661dee66ea6a7eb49420b72` |

| Retained artifact                                  | SHA256                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `EXACT-INPUT.json`                                 | `1e96f1b95113b8019cf39c546d00cbfa96a07d4352590f53db32c724acbdf1d8` |
| `BRIEF.md`                                         | `4249b97c8c1b5969d9cb50e411c92546beeba01e950d6324391fbe33b5514f6d` |
| `BRIEF-GO.json`                                    | `1b44956e462a2e3401187b9341eb197db30153674ab82fbc5ef2fe09cee51038` |
| `PREDECESSOR-M01-GO.json`                          | `bb25e9b507d7d43f3f016b3ebc959c53069bef8856a8326bfe2026ad225f2ed1` |
| `FROZEN-CARRIER-AND-DRIVER.json`                   | `751fee5ab74c9be05fde0640cdeaf2cab1403e363ce29f98321223ffaca9f677` |
| `FROZEN-OMISSION-INPUTS.json`                      | `18527685e30bfe8587efc1605eb3f45add561391b214c7c1a2239104386678b7` |
| `outer-driver/run-registry.py`                     | `af3c9cc23723698a8d1262b228f1093e87f0e2b97b39cffe353176237d67f140` |
| `outer-driver/prove-registration.mts`              | `26cecf6488e3874575a02e8f16cacb5d497a9cbd4127c82f0c21711cfa30f97a` |
| `logs/00-normal-clone.json`                        | `ebe418200fd499bb0bca91e46b6b475800e97aa936741850dc044acea05f1011` |
| `logs/00-normal-clone.stderr.log`                  | `45ce30cd527f17425f0be1e5d9c3aee701132812b580cf58a377c1d2bf5f279c` |
| `logs/00-normal-clone.stdout.log`                  | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/01-p05-format-before-red.stderr.log`         | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/01-p05-format-before-red.stdout.log`         | `e481d8e3ec82ebc1e3b2b363ad8c0bc627923c73cdb31d228f32167d2fad26f0` |
| `logs/02-baseline-controller.stderr.log`           | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/02-baseline-controller.stdout.log`           | `30b9cfc28202697a5c097b822b7480a1e9e2a0b27939d665334de3c7355859b6` |
| `logs/03-stock-render.json`                        | `072ff618690970d55bfe31f31789711101c46a292174ff986a5e2fb4c79a805a` |
| `logs/03-stock-render.stderr.log`                  | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/03-stock-render.stdout.log`                  | `7edcb7a0022a9eabdb0679304cead59218a8d1df44e0156fbf7ad2d3d8c5540a` |
| `logs/04-stock-snapshot.json`                      | `9787b809502820c2843dda6da8958fc1d37b22b4b19e5322a1a736f2963b59d1` |
| `logs/04-stock-snapshot.stderr.log`                | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/04-stock-snapshot.stdout.log`                | `51bfa60bfc917f1265ae742baa1d95d86d938d32e5bd761331b7c58de4bba940` |
| `logs/05-actual-registration-liveness.exit.json`   | `31178eeb162b03fbaf1c9a7e53425904203d891167fc4411db35e352f0110b4c` |
| `logs/05-actual-registration-liveness.stderr.log`  | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/05-actual-registration-liveness.stdout.json` | `c4da0aac64e945f92149c08c6e5bebbc70f85b26527ef87744643ff6087b9bc0` |
| `logs/06-normal-p05-p06-render.json`               | `70d919fd508aaedf5d267214edafc714a49a0ba7719768a05bfd5837bf3ae656` |
| `logs/06-normal-p05-p06-render.stderr.log`         | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/06-normal-p05-p06-render.stdout.log`         | `260227560482807b6d06b71d442a47150a96c2f3e9abddb208512ecf76ba5094` |
| `logs/07-stock-render-check.json`                  | `580bd8e3538b8965f04a655c21becd0805935c0bad37a9e4f5265cc71cd71fa6` |
| `logs/07-stock-render-check.stderr.log`            | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/07-stock-render-check.stdout.log`            | `8dc5eb5fb5dd0db76471c7be681c8d2cf4714ecbc62756d65ac3e7cde3cff4c3` |
| `logs/08-normal-format.json`                       | `ed30d95665a22673985bf0f146ea9815556949cc6f029de4fd17753c61fa19ba` |
| `logs/08-normal-format.stderr.log`                 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/08-normal-format.stdout.log`                 | `a2b4c7cf3ec5df84f52ff2e36650a1b1ed912a8557fdaff9317c4c90487837d2` |
| `logs/OMISSION-CONTROLLER-RESULTS.json`            | `3d3e4bce359c33d003f9b2b783f7a2b4cb4d483012a7f11fbf56532bc479f17c` |
| `logs/controller-good.stderr.log`                  | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/controller-good.stdout.log`                  | `fcb0bdc9568c6425848afc0451daa65f155e931901ed3c6314664cbc078f71cd` |
| `logs/controller-omit-r21.stderr.log`              | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/controller-omit-r21.stdout.log`              | `c19c591aab1563c526dbe250295572bfc6104d9eca4361b78cc96ab2d77a3b8b` |
| `logs/controller-omit-r22.stderr.log`              | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/controller-omit-r22.stdout.log`              | `69c46a41d49b9f0e57041656660cadeb13e098cebd6919b86772d669090af6d5` |
| `logs/controller-restored.stderr.log`              | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/controller-restored.stdout.log`              | `f9319258b11d5718ca9846a3a0c2c736fbd311e248175d9c149d6d5a6d61dbbd` |

Every case prefix is under `logs/`. Suffixes are .subject.ts, .manifest.json,
.stdout.json, .stderr.log and .result.json. Source and full-manifest snapshots
are preserved alongside complete reporter/stderr output and genuine process status.

| Prefix              | Subject SHA256                                                     | Manifest SHA256                                                    | Stdout SHA256                                                      | Stderr SHA256                                                      | Result SHA256                                                      |
| ------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `registry-baseline` | `01b17ef7a0671ce703033e8abd1d1dd920e0d724f714408a9450bbe66cf154ea` | `9ac59a882852b6cefc2ad19e1c77af95e1cc22374a4970a53c22c7751ecd2153` | `973660eef85993d3ea396a4f7888c3f50d50fa7e59257c72a8a6c901a3194ff3` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `088085bfc529a6142bbb2d6d1ef96ee6ac1ca26c78d6de9763b7e060c6b5b4c6` |
| `registry-good`     | `01b17ef7a0671ce703033e8abd1d1dd920e0d724f714408a9450bbe66cf154ea` | `6872daf7622f36c89234cbf043cb5532cf40212f24672921b9190772efb0f311` | `cbadaca91781b3493e1a2df10b58ccb2a1e94feca3daf7e5e622d0292d38449d` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `8cfdc229bf887101b0588d7fc6b68ba9b25e5faef2e7b0e2305aa5eb367d228a` |
| `registry-omit-r21` | `01b17ef7a0671ce703033e8abd1d1dd920e0d724f714408a9450bbe66cf154ea` | `77766e540cbba61bdd8e620907fb12c40c1e624483a5ad6a35bdf510b6f34291` | `89dd2e5704e9c830dae01bf3b99d0b226ca511db355f6870fc4fc0b301b8aecb` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `efb48240bdbbb0e2bbe4f1333db382106d32dd650c3deace4f2f38129b9a56bd` |
| `registry-omit-r22` | `01b17ef7a0671ce703033e8abd1d1dd920e0d724f714408a9450bbe66cf154ea` | `4c91b8a4200a9fbad93394be8c6ffaee2eb68eb7fd4725479f2570db60b59004` | `58bd8d738e5c9f7f2c148aef04831d02911bf2e25b851df84ea81c465cc37131` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `26955af3a8356c41c43c0332e46c248d4c4b20c116842a8312053e38d8cd4fb2` |
| `registry-restored` | `01b17ef7a0671ce703033e8abd1d1dd920e0d724f714408a9450bbe66cf154ea` | `6872daf7622f36c89234cbf043cb5532cf40212f24672921b9190772efb0f311` | `468b1545fc4dab542c590c8c9dcbafbbfc9cf65f497f5ceb925ed7311e96d806` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `163bf8d790112b774007e573ea171c53004f7f2c89ca56f9905a79c751bcb785` |

Normal P05/P06/renderer suites: 17/17 passed, process0. Stock renderer --check0;
normal shipped-surface format:check0. The formatter intentionally excludes rendered
catalogs and framework tests; it is not a catalog or behavioral certificate. The new
P05 source was separately formatted before the fixed-carrier RED and unchanged since.

## Remaining boundaries

This is one finite original M13 iteration1/5, PARTIAL0/2. Exact eight-path candidate
only. Independent existing integration acceptance, Root source application, derived
freshness and later original S2/S3/S4/current CI/staging/guarded sole0166 gates remain.
No new lint implementation/config/schema, Root/foreign/Native source effect, model
call, publication or installed-usable whole TAK claim.
