# M08 / A09 — actual delivered test naming coverage

Original design section7 A09 requires actual effective configuration and real
bad/good lint for every supported test naming convention in sibling presets.
This evidence slice changes no production implementation, templates, rule
twins, configs or dependencies. The historical A09 missing-suffix observation
remains a seed; it is not assumed to describe the current source.

## Complete configuration population

The actual NUL-delimited Git selection contains nine configuration inputs:
Root, TS-server, Next, SPA, RN-common, Expo, bare RN and two intentional
foreign-scan fixtures. The last two test walker boundaries rather than consumer
enforcement and are explicitly inapplicable. RN-common is exercised through
both actual native project entries, not treated as a standalone project config.
The six effective project entries below reconcile all nine source inputs.

Root declares five suffixes (`test`, `spec`, `unit`, `audit`, `integration`),
`__tests__` and `tests` paths across ts/tsx/mts/cts/mjs/cjs/js/jsx. TS-server,
Next and SPA declare the same five suffixes for ts/tsx plus both directory
forms. Both native entries characterize those TS/TSX paths with Q1/Q2
not placed, matching the accepted M13 manual catalog status. No new RN rule or
cross-language ESLint policy is inferred.

All five consumer fixtures were produced by the actual `install.sh`, with
noninteractive default core choices and without `--full`, global or factory
activation. Expo selection uses the same `expo: ~52.0.0` metadata marker as the
existing native installer fixture, not a claim that an Expo app ran. Actual
emitted main configs equal their source inputs byte-for-byte; the shared RN
layer also equals its source in both native consumers. Root uses its exact
committed configuration and both committed rule twins at the fixture base.

Dependencies live in owned, locked toolchain fixtures. Existing exact versions
were reused where available; five missing actual config imports were resolved
through ordinary npm registry metadata and frozen before materialization. Both
web and native `package-lock-only`/`npm ci` commands returned 0. Web used strict
resolution; native used only the installer's existing documented
`--legacy-peer-deps` contract. Neither framework nor product dependencies or
standing npm/security settings changed. Selected actual installed versions,
full locks and every command/status are retained and pinned below. This is
lint-toolchain preparation, not whole application installation acceptance.

## Independent fixtures and actual observations

The byte-preserved original
[frozen-naming-contract.json](frozen-naming-contract.json) fixes the complete
selection and literal bodies before execution. Constant assertions require Q1
`rules-as-tests/no-vacuous-assertion` / `vacuousAssertion`; empty bodies require
Q2 `rules-as-tests/require-effective-assertion` / `noEffectiveAssertion`.
The legitimate test calls actual `isAdult(17)` and `isAdult(18)` with independent
false/true expectations and a NodeNext `.js` import. This campaign checks lint
placement, not runner discovery or all extension/runtime compatibility; the
separate accepted A06 runtime proof retains its own scope.

The actual ESLint API calculates every concrete path. Actual ESLint CLI JSON
then records every file's diagnostics, full child exit, stdout and stderr.
Fatal/unmatched/configuration errors never count as quality detection.

| Profile    | Supported naming cells | Qualified file observations | Q1 constant refusals | Q2 empty refusals | Zero-error legitimate files |
| ---------- | ---------------------- | --------------------------- | -------------------- | ----------------- | --------------------------- |
| root       | 56                     | 168                         | 56                   | 56                | 56                          |
| ts-server  | 14                     | 42                          | 14                   | 14                | 14                          |
| react-next | 14                     | 42                          | 14                   | 14                | 14                          |
| react-spa  | 14                     | 42                          | 14                   | 14                | 14                          |
| expo       | 14                     | 42                          | 0                    | 0                 | 14                          |
| bare-rn    | 14                     | 42                          | 0                    | 0                 | 14                          |

There are 126 naming cells and 378 qualified file observations: 98 intended Q1
refusals, 98 intended Q2 refusals and 98 legitimate zero-error files in the four
placed profiles, plus 84 native not-placed observations. All placed effective
rule severities are 2. Native Q1/Q2 diagnostics are absent; their actual three
class processes return 0. That characterizes the explicit manual remainder,
not behavioral assurance of native tests.

## Preserved fixture infrastructure failure and narrow correction

The original run produced all 378 concrete file reports. Its TS-server, Next
and SPA fixtures gave `.ts` and `.tsx` files identical basenames. Actual
TypeScript5.9.3 `parseJsonConfigFileContent` includes all 21 TS files and omits
all 21 same-stem TSX files in each fixture. Actual ESLint project service then
refuses those TSX files with a fatal parser diagnostic. The original controller
returns 2 and its three mixed TS/TSX legitimate batches return 1. These 63
parser refusals are retained as infrastructure, never Q1/Q2 detections.

An append-only companion freezes distinct TSX basenames with byte-identical
bodies and independent expectations before writing them. Actual compiler
selection confirms inclusion of all 63 new TSX files. Only those affected
files were rerun: each profile's effective configuration returns 0, constant
and empty CLI batches return 1 with the intended rule/message IDs, and the
legitimate TSX batch returns 0. Compiler/lint configuration, original files,
original expectations, old results and dependency graphs remain unchanged.

The original TS rows had zero-error legitimate per-file reports within their
mixed failing batches. They are reused precisely at that scope: no separate
TS-only process0 is invented. Original Root168 and native84 reports were not
rerun. The final 378 qualified observations comprise original315 valid rows
plus the appended63; all 441 concrete source files and original failed rows
remain available. Full source maps bind the actual files to frozen bodies.

## Source and acceptance limits

No supported naming placement gap was demonstrated on this current base, so
this candidate adds evidence only. It does not manufacture a production repair
or weaken a rule to make the matrix green. Original M08 authored use is
conservatively 2/5, including the fixture correction; 3 remain, PARTIAL0/2 and
all other mechanism counters stay unchanged.

The existing independent integration owner must accept the exact source and
actual evidence. Normal evidence Markdown formatting/diff checks are supplied
with the candidate. Existing accepted A06 checks and unchanged rule/delivery
sensitivity evidence retain their original finite scopes; they are not replayed
or inflated into a whole kernel certificate. Remaining S2 population/class
reconciliation and mechanisms, stage adapter/assembly, S3/S4, current CI/staging
and compatible sole-writer0166 delivery remain unfinished.

## Portable evidence bindings

Repository source paths below are relative to the execution base. Raw paths are
relative to the original owner's retained artifact directory
`outputs/tak-resume-20261013/s2-m08-a09/execution-1/`, under owner chat
`01a12f25-6bcc-7c71-922e-d36eca2e9a5c`. Retrieve that existing artifact channel
and verify the full SHA-256 values. Source maps and frozen bodies permit exact
per-path reconstruction without relying on a transient fixture path or a bare
controller summary. No node_modules/cache content is represented as test evidence.

### Frozen source configuration inputs

| Source input                                                                                                  | SHA-256                                                            |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `eslint.config.mjs`                                                                                           | `af6b5e37e8d0a3a5e4ecbc72fba718d735f68c3278898795f53cdc0fbe17aa13` |
| `packages/core/audit-self/fixtures/foreign-scan-triage/sandbox/.claude/worktrees/feature-x/eslint.config.mjs` | `7b4f6f72a597b6a64f5032c6b09cfea3815e4cde94882852cd9ed57456fcb5e5` |
| `packages/core/audit-self/fixtures/foreign-scan-triage/sandbox/eslint.config.mjs`                             | `15180f75beace16c7c764d8da29e09ff8782ac534f0b18d2c4ef652ef67b9089` |
| `packages/preset-next-15-canonical/templates/eslint.config.react.mjs`                                         | `1961c07229416f2654a315f9d3a262112c17b81908d04cefd1356a1e0bf8ce2b` |
| `packages/preset-react-native/templates/eslint.config.bare-rn.mjs`                                            | `fb9aa49f64642bd62823e8f76be90936721e2b9eb87ff2f4a9dfd6d137364797` |
| `packages/preset-react-native/templates/eslint.config.expo.mjs`                                               | `382a7873c05ec6fd70221b416a3fa10f9d6ffe55548c5716cd75414bdcd9ee5b` |
| `packages/preset-react-native/templates/eslint.config.rn-common.mjs`                                          | `5b99143c306c650c85dfd3bb68e6f9083083f88dcdb9c1c71ad790a7de9c8d8a` |
| `packages/preset-react-spa/templates/eslint.config.react.mjs`                                                 | `eb9b43c39d721910fa3de21d8258188fd6b9ecb79a4209960636b3cb916d4653` |
| `templates/ts-server/eslint.config.mjs`                                                                       | `dd40d657ac8405f7c4d0e883840487e93196fe7c69be33da44c82d8181a27463` |

### Owned toolchain locks

| Toolchain | Lock SHA-256                                                       |
| --------- | ------------------------------------------------------------------ |
| web       | `eabb23199a320e6a81c097639a25c5f71d67e425950ecd0905beef2b5bbe9160` |
| native    | `385a350c0967c74b2fb3d2dd92bd8154720a800997184e1e3e874f8d392f20dd` |

### Actual raw inputs, commands, reports and source maps

| Retained artifact                                                 | SHA-256                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| `ACTUAL-COMPLETE-FIXTURE-SOURCE-MAP.json`                         | `3ce843a5b26388e09f01de1c04cca684e92854608915079f6dc47a9c105427f8` |
| `ACTUAL-FIXTURE-TOOLCHAINS.json`                                  | `d5c3b97b18e6d56cc270e13a623f062e68e82673527cdcf051cb2d0cd9aacc9f` |
| `ACTUAL-NAMING-RESULTS-PROGRESS.json`                             | `f30d4b423aa2c32c0131a5f150b94fff2883e1ea605262790ac123f80c1f800b` |
| `ACTUAL-NAMING-RESULTS.json`                                      | `1e89d65f738f476f4c1ff165da0cfa52d13dae8285ca101dfc0cdde0f4e80bb7` |
| `ACTUAL-ORIGINAL-CONTROLLER-NATIVE-TERMINAL.json`                 | `05896e8098678aa5ba7b743f1911bcc953b384a527b27c33ab7c83fe38a63c40` |
| `ACTUAL-UNIQUE-TSX-COMPANION-RESULTS.json`                        | `ad52710181727939fabf495323bf141881900eb81e86bc030be946e22adf3474` |
| `ACTUAL-UNIQUE-TSX-CONTROLLER-NATIVE-TERMINAL.json`               | `1355c2eda32809b1384c8623f7201a167ee3b8424d45f3dd7393f66b524f2c73` |
| `BRIEF-GO.json`                                                   | `87b7e861f2d17426f6cf9f635d2a50c82c103bd0a1c436899679dcfd0f8968d5` |
| `BRIEF.md`                                                        | `2526744896974938bf5f009136f01212a8caf9d4e3a6d70545de4e61390003da` |
| `EXACT-INPUT.json`                                                | `6682ff5dae3c812c3f1fc1652a7fb029ef7224c9291983ce41b6a51d42d05d7f` |
| `FROZEN-ACTUAL-DELIVERY-INPUTS.json`                              | `86467b7dc110b290d7305a24cf4697d7289a1fdc7c2f55f9bf62c8d8330b4a56` |
| `FROZEN-EXECUTION-INPUTS.json`                                    | `1b951889a8e6f32962eb2eb324e080cb76768e2b9cfebe61559a891aad143701` |
| `FROZEN-FIXTURE-DEPENDENCY-PLAN.json`                             | `844a6119febde743564ea80a90097ae4ccac1fe65f5486b6db2227c8fbd7a61e` |
| `FROZEN-NAMING-CONTRACT.json`                                     | `34647fb40ab4dd1050656e39635cbd39ff1efa5a661493b8fea18db5bdefa720` |
| `FROZEN-UNIQUE-TSX-COMPANION.json`                                | `f1a68dea4e624e1d2e47d74a7e8b38e06356acc31de52a899f07ed72a29050b0` |
| `FROZEN-UNIQUE-TSX-EXECUTION-INPUTS.json`                         | `4cf72a0d873492105b3aa9f373d75e986efafcd934639a0561fce0516d31ccd9` |
| `QUALIFIED-COVERAGE-SUMMARY.json`                                 | `48234d271c2d9fc0f2d69dfe9fd75a08556082bcfe2c0705a51c43077aa1876e` |
| `RESOLVED-MISSING-CONFIG-DEPENDENCIES.json`                       | `c0b3ed1aada808b6b50a3e93ff90356ba0470199c62326b814c699e7c1469136` |
| `TOOLCHAIN-AND-SCOPE.json`                                        | `a2248c5dccc4c094956365c30a6b49fabc94479bc027075e6240f9014efb4e59` |
| `UNIQUE-TSX-RECOVERY-BRIEF-GO.json`                               | `776601878914299966d42082b0e73c2dc9bbdb700ea2e1b986cc0125ce4d7fbf` |
| `UNIQUE-TSX-RECOVERY-BRIEF.md`                                    | `e363828dc5bc3678789bfc6ba33ffb2710e671bc7e80db5732322a803aaacd8c` |
| `calculate-effective-config.cjs`                                  | `3ac061079cc26025d30f30e7b0740d71f800116908022b912ca1e5fdb3c3b8a3` |
| `check-unique-tsx-inclusion.cjs`                                  | `5d151bab49770be6806d500217c985b48727a6251d340e0768a91a85451667fe` |
| `diagnose-typescript-file-selection.cjs`                          | `969922d2cc19148edf02f786c4e025cad0c89e7a2c71088386dabb6b2ed39270` |
| `logs/00-registry-1.json`                                         | `e3b0a993e143e1019e42b08d25f74112e0561863eeaef691578eb7f680ca7bcd` |
| `logs/00-registry-1.stderr.log`                                   | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/00-registry-1.stdout.log`                                   | `639585335a9914767a69cd797e3a51e102603a54bcac0e34f7845999244f61a3` |
| `logs/00-registry-2.json`                                         | `2909e939f0478e02386971b5f8e88193a9b9da391df95d37073b560426abb82f` |
| `logs/00-registry-2.stderr.log`                                   | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/00-registry-2.stdout.log`                                   | `2a3b7385526230030d6de2294558868876dc9517bc2955ed848a8df844a6f372` |
| `logs/00-registry-3.json`                                         | `a1c3323a10ce8ac026b005cb39a6a43a16790de8c14d7452fa0484cc7bbffb53` |
| `logs/00-registry-3.stderr.log`                                   | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/00-registry-3.stdout.log`                                   | `61dff9274f1606081e08248f4e21794fb1150129c5a8aece4ad5811a088dbb0e` |
| `logs/00-registry-4.json`                                         | `5032bdeb5e7579583548321d4a76111e09d3da3b5443fcd83fa2709886949215` |
| `logs/00-registry-4.stderr.log`                                   | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/00-registry-4.stdout.log`                                   | `afed28625a1a2f5753de461aa800b4723f3e9c8c4ed9e123728d271fd3d3b75e` |
| `logs/00-registry-5.json`                                         | `8c49e4844c3cffbae87270deb76406f92cb82403069edfea6b8434b074217396` |
| `logs/00-registry-5.stderr.log`                                   | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/00-registry-5.stdout.log`                                   | `a887e11f7196f43b391d43a53efab21ba10dc69a5510abd372025efc004b902f` |
| `logs/01-native-ci.json`                                          | `e4c7a0b634151886d31172467b8590daca340f3045cb21571f74058311c76665` |
| `logs/01-native-ci.stderr.log`                                    | `fd73a223466ea6aa3de8d327cde66e534f2a56d7e15a8fcbac2139611b2b30ab` |
| `logs/01-native-ci.stdout.log`                                    | `88f77a5a36698c3d9a507b65c48694020442078a70c91e9c784dfaa26d36a335` |
| `logs/01-native-lock.json`                                        | `e5e895d02b24090d5da2af103374a6456cf9433c2451bc4f0a402aeb0a0b7663` |
| `logs/01-native-lock.stderr.log`                                  | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/01-native-lock.stdout.log`                                  | `8ed2a8821f3fe701d344a5d8a37ec6a88732e8e1744e0768241d7cd0bac9b9a3` |
| `logs/01-web-ci.json`                                             | `da56098fe9d1b7985c975787a9731a04a6d0c4069606e1028395ec13e2508095` |
| `logs/01-web-ci.stderr.log`                                       | `fd73a223466ea6aa3de8d327cde66e534f2a56d7e15a8fcbac2139611b2b30ab` |
| `logs/01-web-ci.stdout.log`                                       | `1987c928bc68074ad8f4f4644ea529df2560a48285477aa7a02087648fc57a2c` |
| `logs/01-web-lock.json`                                           | `39e709ef5553a5c02f58fdabd9a5de2941a5b759a365b0715091a057ce2ab00e` |
| `logs/01-web-lock.stderr.log`                                     | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/01-web-lock.stdout.log`                                     | `96ac9cdcdcf0b44f3777a125563513c77371f535c603331a4cae91ec825d3002` |
| `logs/02-bare-rn-actual-install.json`                             | `cb3fb58542e24e537a9ead11e0e4e5e27158f5c3e7cc4f81bceb5c629ad8fce4` |
| `logs/02-bare-rn-actual-install.stderr.log`                       | `81a8cf473b0bc5594559e581452781f5c0134ce93287f234966e17e04f6487b7` |
| `logs/02-bare-rn-actual-install.stdout.log`                       | `2154b018cfca703ae4c38f0bd92d91bda1d8334f986d5047021637f097839600` |
| `logs/02-expo-actual-install.json`                                | `12419f15b6d900a941362a0570b9f65f8136f5e8794eb8315c8d1b7a4e6048a0` |
| `logs/02-expo-actual-install.stderr.log`                          | `81a8cf473b0bc5594559e581452781f5c0134ce93287f234966e17e04f6487b7` |
| `logs/02-expo-actual-install.stdout.log`                          | `59f3bfdce026462852ae77cf5cb5040d15b436233a4b1e3da39ac7ca1ffc291f` |
| `logs/02-react-next-actual-install.json`                          | `022b522981d55bfc87d3184ff740feb6be25eda2998a26a2f0f21e725a19e761` |
| `logs/02-react-next-actual-install.stderr.log`                    | `7e7c1ba2fce1089bf284adb8c36ad273b515bf9e95f44e22ef0cc775a21ae7a1` |
| `logs/02-react-next-actual-install.stdout.log`                    | `e8489d6e6c2457e19a7b150a75702f2eb6b0a0aa81f140b8ebb684f82af42b20` |
| `logs/02-react-spa-actual-install.json`                           | `ef6bf9e68769d8ef9a3355ccf97619a3156bf0a0f4eb4f9c5a0e9aaa642db4b0` |
| `logs/02-react-spa-actual-install.stderr.log`                     | `81a8cf473b0bc5594559e581452781f5c0134ce93287f234966e17e04f6487b7` |
| `logs/02-react-spa-actual-install.stdout.log`                     | `cdd6d1b20ca7d5aff96958d4658778d232792a98e7b10d1f9fc21fd6e9fa7f32` |
| `logs/02-ts-server-actual-install.json`                           | `b210fcf338543ff590e0d3b659338f57742a73a7a34f1ebc745ca49a5facac0a` |
| `logs/02-ts-server-actual-install.stderr.log`                     | `6ab50381ecae2946809f82ff9f6ae109708ffa24bf51e316e8104b1711c7d8d2` |
| `logs/02-ts-server-actual-install.stdout.log`                     | `f90301c51c361b76c686e84ba9f86f96966ee1f38413a5a86323900f7b5ddce2` |
| `logs/03-bare-rn-effective-config.json`                           | `82872784a7f974cf4eb28486c976e0e86518410299288fe1d38f1d3c939c5037` |
| `logs/03-bare-rn-effective-config.stderr.log`                     | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/03-bare-rn-effective-config.stdout.log`                     | `56e2f0f93f3f13aa606f4fc429ef1a6237d4c129c7306cfde0164d22b6daeb3b` |
| `logs/03-expo-effective-config.json`                              | `8ea6ba911cd8c1e5f206cdda1bb9885d6cfa4f7ec64abe3716e10d1fbc01e906` |
| `logs/03-expo-effective-config.stderr.log`                        | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/03-expo-effective-config.stdout.log`                        | `5ede0da0cb81d9a3d40913dc26b9a64abcb3de8f5d9cec5b7714ecb0907b7bd2` |
| `logs/03-react-next-effective-config.json`                        | `fd4115e7e05d12f9276f0c1d55620136918621315433040adb061f3b6f40da3f` |
| `logs/03-react-next-effective-config.stderr.log`                  | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/03-react-next-effective-config.stdout.log`                  | `4800c8396c96c3b65f2299e63b0a0d1ee34446256bf35b667556b7ba2dee2607` |
| `logs/03-react-spa-effective-config.json`                         | `bfca3a14cbce424b08ad011bd1245998a20a53c8de49f6847c3ec1a30e1084c2` |
| `logs/03-react-spa-effective-config.stderr.log`                   | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/03-react-spa-effective-config.stdout.log`                   | `ba8b01070c9940c6ada92c458d287f03233a52a3dc7e5223395a3a505b16612e` |
| `logs/03-root-effective-config.json`                              | `2c6b5fc1d891cb602d1c059bb2f459947a2968ff018eae87bda92266b63035ca` |
| `logs/03-root-effective-config.stderr.log`                        | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/03-root-effective-config.stdout.log`                        | `81265f5ba24551928f56d7066bcb188d4c5d3c194efec982c25267227fc4e5dd` |
| `logs/03-ts-server-effective-config.json`                         | `4ea94b87469a7f18310a32a4e98bd2368ce60caadc5c3ff4b69d233f1e79a6fc` |
| `logs/03-ts-server-effective-config.stderr.log`                   | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/03-ts-server-effective-config.stdout.log`                   | `9bbb74394056d964f1f3ca1d42136a3ab8aa4e36f0c9e148ad25c47b70e4071f` |
| `logs/04-bare-rn-boundary-actual-eslint.json`                     | `a8ad114306a40c233747bb3bd9a59c7dcd7e874508fb94f401d7d5ed17872625` |
| `logs/04-bare-rn-boundary-actual-eslint.stderr.log`               | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/04-bare-rn-boundary-actual-eslint.stdout.log`               | `1517b11b3427b66b29acedf41b8045ce1615aadf913338f009b4c10098776423` |
| `logs/04-bare-rn-constant-actual-eslint.json`                     | `b332bfddd331def9738f7aa21258284b4a7be19ef74607107e6b39f520536ef2` |
| `logs/04-bare-rn-constant-actual-eslint.stderr.log`               | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/04-bare-rn-constant-actual-eslint.stdout.log`               | `4ca3b26ca6725ed0da3bdeaefd7569583431432257b6226aa1f1ac163b17bf37` |
| `logs/04-bare-rn-empty-actual-eslint.json`                        | `f91144aec49dd68982b97aa7c1b9382d69d5fd2bd01a27481ec83b1d0d791252` |
| `logs/04-bare-rn-empty-actual-eslint.stderr.log`                  | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/04-bare-rn-empty-actual-eslint.stdout.log`                  | `5d33ad35e8d6e456f0d789dd9e0d4695355c56773f684ef290d911555407a4c8` |
| `logs/04-expo-boundary-actual-eslint.json`                        | `0a169632702cb578866a8c4bc2a8f2ac1d7184b16632c437dcab52dbfeef7354` |
| `logs/04-expo-boundary-actual-eslint.stderr.log`                  | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/04-expo-boundary-actual-eslint.stdout.log`                  | `a3a7b60d5f535caf96424b0ffb9791586c446f9cd254790ef82b383432b31e52` |
| `logs/04-expo-constant-actual-eslint.json`                        | `3547b30a1059fcb15746c958286948e8c944ea838ca1e2838fcfd04191b079ee` |
| `logs/04-expo-constant-actual-eslint.stderr.log`                  | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/04-expo-constant-actual-eslint.stdout.log`                  | `f77e9e196e06dc009acdb35401c1950f148f2f03a8775bc5c62e37c29130e788` |
| `logs/04-expo-empty-actual-eslint.json`                           | `8e83e51b253cf15ce1bee4f07a3dd0bb61212bdbcf68982faadaae973966013c` |
| `logs/04-expo-empty-actual-eslint.stderr.log`                     | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/04-expo-empty-actual-eslint.stdout.log`                     | `221a9bd4a8f20253000441d1124a54b6ff5a2299dd3bd1ce6df76a367c0b41b2` |
| `logs/04-react-next-boundary-actual-eslint.json`                  | `ad1544857e6ae21b53d10d6a076639fc4882abe736f10fdd94516ec1b9b8b3c5` |
| `logs/04-react-next-boundary-actual-eslint.stderr.log`            | `2d59191f29ebe5874340d9620824174149e2613b92c77aac5a908c2bc371b05b` |
| `logs/04-react-next-boundary-actual-eslint.stdout.log`            | `d91fe12cbab55cd77365dccf708e99a45d3a90caa44474568a93e0c8cb85bb14` |
| `logs/04-react-next-constant-actual-eslint.json`                  | `7576189df76f0dd7a0c635d751470fc75a703faca79eda98ac1b9dc44bc48040` |
| `logs/04-react-next-constant-actual-eslint.stderr.log`            | `2d59191f29ebe5874340d9620824174149e2613b92c77aac5a908c2bc371b05b` |
| `logs/04-react-next-constant-actual-eslint.stdout.log`            | `758be54ea3a68583e8816bc41b69c4b760d71dbbdc189e247498d8347cd6c7cb` |
| `logs/04-react-next-empty-actual-eslint.json`                     | `1074bf44a905af3e8918c5bb8afb96646a3be07f35f8b7d97e00c165a40d2727` |
| `logs/04-react-next-empty-actual-eslint.stderr.log`               | `2d59191f29ebe5874340d9620824174149e2613b92c77aac5a908c2bc371b05b` |
| `logs/04-react-next-empty-actual-eslint.stdout.log`               | `9741f2ea5e2f9eb8aa796c7018dba011b983772e5f0c250ee574d1719a38a1e8` |
| `logs/04-react-spa-boundary-actual-eslint.json`                   | `0e61e4e8a3d2577c362c29b370e28f8b7aadef9d8b6b7a29da04788f4400e933` |
| `logs/04-react-spa-boundary-actual-eslint.stderr.log`             | `744b23ffde7e734a665c7a918e1547087b48c7de36e0fe14d49117e0d6f8d514` |
| `logs/04-react-spa-boundary-actual-eslint.stdout.log`             | `509fd675a09f3f81f53d1903624b9afb6cb47e0c994ee2baf3a3a83ffd023ce5` |
| `logs/04-react-spa-constant-actual-eslint.json`                   | `5b82e97af389577d305b05ecaabd845f461bb60e37d2b1976395f6f41d17f298` |
| `logs/04-react-spa-constant-actual-eslint.stderr.log`             | `744b23ffde7e734a665c7a918e1547087b48c7de36e0fe14d49117e0d6f8d514` |
| `logs/04-react-spa-constant-actual-eslint.stdout.log`             | `d84994188d36624f74643d24a7d5ac358fddddcd791143abfd5f23a350c758b3` |
| `logs/04-react-spa-empty-actual-eslint.json`                      | `2b2177a4a70477dcee5f456b85dc9a8a6f90e0adc03f2c1196a1a69828f01f47` |
| `logs/04-react-spa-empty-actual-eslint.stderr.log`                | `744b23ffde7e734a665c7a918e1547087b48c7de36e0fe14d49117e0d6f8d514` |
| `logs/04-react-spa-empty-actual-eslint.stdout.log`                | `49a7b95e6f053352c8c7b95803b1573df8371c02a83c364271418ef0631de911` |
| `logs/04-root-boundary-actual-eslint.json`                        | `4882a01c3c8229396cc5a60cefd9555c341b92b6e3778618f3b9aa6f7e639bf1` |
| `logs/04-root-boundary-actual-eslint.stderr.log`                  | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/04-root-boundary-actual-eslint.stdout.log`                  | `aa059faafe4600eb86209bd5ad00901120f34e436e1b726b437c687aae206b1f` |
| `logs/04-root-constant-actual-eslint.json`                        | `3431259eb386ae013b03276c48e769db620acfe93ab8cd910d9c15784be75d56` |
| `logs/04-root-constant-actual-eslint.stderr.log`                  | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/04-root-constant-actual-eslint.stdout.log`                  | `35d7bd31e04ac00b447723bd79b64782ee16bb415cf78da5e8c9c63b5ca6e2dc` |
| `logs/04-root-empty-actual-eslint.json`                           | `f17de9382f466e192c212c590dca2dfa553ff951aeb45ec4410fdd5107d0038d` |
| `logs/04-root-empty-actual-eslint.stderr.log`                     | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/04-root-empty-actual-eslint.stdout.log`                     | `11f6287d9e6a83aab58778e8630a07fc0180d2315f4786f8ab87fe033d6c6d8a` |
| `logs/04-ts-server-boundary-actual-eslint.json`                   | `7b6dd316c81919d108ec371322574dfd2a3b71038119c08536f48027ab36bb12` |
| `logs/04-ts-server-boundary-actual-eslint.stderr.log`             | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/04-ts-server-boundary-actual-eslint.stdout.log`             | `435d4697c22c28cdabaa63eea57ac9bc61776dbff42759997da792c82d29381f` |
| `logs/04-ts-server-constant-actual-eslint.json`                   | `8cb80ebd9efcf4c94182c4185af429eb783561edc6bc8c314d469ba9331f8dd5` |
| `logs/04-ts-server-constant-actual-eslint.stderr.log`             | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/04-ts-server-constant-actual-eslint.stdout.log`             | `117e89753fb116fe3c714d5b18897ff43993fcbaa76ae4de815c738eef4177b9` |
| `logs/04-ts-server-empty-actual-eslint.json`                      | `1b7babb3c88752f95a57a609b70bbc2806d209942a88a8e5ed04d5c267a0c2fb` |
| `logs/04-ts-server-empty-actual-eslint.stderr.log`                | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/04-ts-server-empty-actual-eslint.stdout.log`                | `61d9ba6b80894d765666667f909970e6ca1fbdfdcca2d1ffbecc79f69924dd7f` |
| `logs/05-actual-typescript-file-selection-diagnosis.json`         | `8067d1ca6f411375e53f9f75e50efcbcfb6c6ccaecb08586942000b8c11ed24a` |
| `logs/05-actual-typescript-file-selection-diagnosis.stderr.log`   | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/05-actual-typescript-file-selection-diagnosis.stdout.log`   | `2adfc27cac06eb7435cd50909ec8ea49ae479241404a1782fdc7f355d497be90` |
| `logs/06-react-next-unique-tsx-compiler-inclusion.json`           | `3edde57b1c580ae9bcb8af83c9e6906fb23e8066d03a9e79b7f8683e8d987e06` |
| `logs/06-react-next-unique-tsx-compiler-inclusion.stderr.log`     | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/06-react-next-unique-tsx-compiler-inclusion.stdout.log`     | `59f191421dea476e0787dafa803fd0cb160e2090862425252271aeb3489df6a4` |
| `logs/06-react-spa-unique-tsx-compiler-inclusion.json`            | `9505306dac073ecf388a18cf8d44497f10ae2d65f548a85a1177388a5ca48ba7` |
| `logs/06-react-spa-unique-tsx-compiler-inclusion.stderr.log`      | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/06-react-spa-unique-tsx-compiler-inclusion.stdout.log`      | `f2bfda0f264e34625f0b94af5867de4c40dfe4fe6d5af1b1c87bc4aca5071f15` |
| `logs/06-ts-server-unique-tsx-compiler-inclusion.json`            | `3f6804a6312ff0a48d4f78aadf741d07f1283bf3ac17a14d76dc30e1944b7948` |
| `logs/06-ts-server-unique-tsx-compiler-inclusion.stderr.log`      | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/06-ts-server-unique-tsx-compiler-inclusion.stdout.log`      | `dd326ec91b51d134c4ceaaaf0abf23c3ac5ad271e60f0db55d5cfa8021aa61b4` |
| `logs/07-react-next-unique-tsx-effective-config.json`             | `08acc4adbea1079fcc7c9bc70dbb5e6db5eb3fe9e90ea54e17519d21db2756f6` |
| `logs/07-react-next-unique-tsx-effective-config.stderr.log`       | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/07-react-next-unique-tsx-effective-config.stdout.log`       | `303ed8d17d42bc201bf0a717f456df48ff6f8849a919abdc19db930cded2ee3a` |
| `logs/07-react-spa-unique-tsx-effective-config.json`              | `2aa03216355b34df5ac9c4e4dc3c26a2671aed78cf160db8ec008b53456e8a3e` |
| `logs/07-react-spa-unique-tsx-effective-config.stderr.log`        | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/07-react-spa-unique-tsx-effective-config.stdout.log`        | `dce952a11fec89154302a903799d00125c067d5bb733891b77e8de987e36234e` |
| `logs/07-ts-server-unique-tsx-effective-config.json`              | `f627b6b7a7ccb25cc5aa283e238d8e225123ed09356990a91267ec8336ee1cd6` |
| `logs/07-ts-server-unique-tsx-effective-config.stderr.log`        | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/07-ts-server-unique-tsx-effective-config.stdout.log`        | `7cb49ca460267fee384765c15ab9f30995a9f779e6d18b2604a2c652da8a441e` |
| `logs/08-react-next-unique-tsx-boundary-actual-eslint.json`       | `8c6ebaa2a2daf8f8bd1f259c18b8f83015aa1b72c03c573fe5bb8ea880a77741` |
| `logs/08-react-next-unique-tsx-boundary-actual-eslint.stderr.log` | `2d59191f29ebe5874340d9620824174149e2613b92c77aac5a908c2bc371b05b` |
| `logs/08-react-next-unique-tsx-boundary-actual-eslint.stdout.log` | `36aa6601c2e37a2b703692180d3c314c17232b4db6f9bc72648be34123fcd70f` |
| `logs/08-react-next-unique-tsx-constant-actual-eslint.json`       | `a077eece8316a3143fea1ad7d1cc003975037f98c83fcc0f89d9192c8d2a9ba9` |
| `logs/08-react-next-unique-tsx-constant-actual-eslint.stderr.log` | `2d59191f29ebe5874340d9620824174149e2613b92c77aac5a908c2bc371b05b` |
| `logs/08-react-next-unique-tsx-constant-actual-eslint.stdout.log` | `f73f7e7d88f6585f95bda5c1ae5af8147e14e043800da4e671205d5aad566e8f` |
| `logs/08-react-next-unique-tsx-empty-actual-eslint.json`          | `714713709999d1b96d027a0690d272733384a25d0b775e7bcf129caf0215c095` |
| `logs/08-react-next-unique-tsx-empty-actual-eslint.stderr.log`    | `2d59191f29ebe5874340d9620824174149e2613b92c77aac5a908c2bc371b05b` |
| `logs/08-react-next-unique-tsx-empty-actual-eslint.stdout.log`    | `8e55ff7505f73c85be562ce1d069167254fe8d86a3ae892db8c6a6c541e59ffe` |
| `logs/08-react-spa-unique-tsx-boundary-actual-eslint.json`        | `2d8883b7e4027c0191633f5fb7c96d2d9c9fa325695c9a3dafadc96224b9d8da` |
| `logs/08-react-spa-unique-tsx-boundary-actual-eslint.stderr.log`  | `744b23ffde7e734a665c7a918e1547087b48c7de36e0fe14d49117e0d6f8d514` |
| `logs/08-react-spa-unique-tsx-boundary-actual-eslint.stdout.log`  | `e870f328f18c6797a42e8c5ea7bd4e54a2985bbec2e22fa7c0cbbea0929f3f84` |
| `logs/08-react-spa-unique-tsx-constant-actual-eslint.json`        | `d7e5a9ba400ed7f9da43e2255f01ee1b55100b9723db0912ee760d7cd4bcfdc1` |
| `logs/08-react-spa-unique-tsx-constant-actual-eslint.stderr.log`  | `744b23ffde7e734a665c7a918e1547087b48c7de36e0fe14d49117e0d6f8d514` |
| `logs/08-react-spa-unique-tsx-constant-actual-eslint.stdout.log`  | `8087262f770b6e9f45145471453af5f0d5f51323be80a194fb4629eb6d679479` |
| `logs/08-react-spa-unique-tsx-empty-actual-eslint.json`           | `087ec12c820a5c15f9531550b306b196ac5a3949fa8ac6366ad2e9c6194a11fe` |
| `logs/08-react-spa-unique-tsx-empty-actual-eslint.stderr.log`     | `744b23ffde7e734a665c7a918e1547087b48c7de36e0fe14d49117e0d6f8d514` |
| `logs/08-react-spa-unique-tsx-empty-actual-eslint.stdout.log`     | `2f717f09683068ee2b53a0c72d810bae83da4333aad7f61861c4699e8770c4f7` |
| `logs/08-ts-server-unique-tsx-boundary-actual-eslint.json`        | `b4484947bd7496f66867f40a8973a5bd1cb8d9012e4fbe61ed28b2f78d5286b5` |
| `logs/08-ts-server-unique-tsx-boundary-actual-eslint.stderr.log`  | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/08-ts-server-unique-tsx-boundary-actual-eslint.stdout.log`  | `46ae145a9e5a3e34e87349a783f8945dabf4642f11fcf92e6231ae659466e931` |
| `logs/08-ts-server-unique-tsx-constant-actual-eslint.json`        | `cf60e2f9c070b66d7c8cd52d00914d82fd1dd6120d9289e791b882d2803ae764` |
| `logs/08-ts-server-unique-tsx-constant-actual-eslint.stderr.log`  | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/08-ts-server-unique-tsx-constant-actual-eslint.stdout.log`  | `074ff4c80d2d03619f1d5da3aa31f4d839f2281e6e97c755c27e4706eebc18fc` |
| `logs/08-ts-server-unique-tsx-empty-actual-eslint.json`           | `bafc7920e008855503b265d8d438d506745dbab806965ba711c2eb8f3318533a` |
| `logs/08-ts-server-unique-tsx-empty-actual-eslint.stderr.log`     | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/08-ts-server-unique-tsx-empty-actual-eslint.stdout.log`     | `b0b5b98283c4c190e774df87dc428590e4a4d441aa9f21061175215587650405` |
| `logs/09-normal-source-clone.json`                                | `c828de9fede8734ce1dce63f98d6d6cbcb8f3a24083b0cbe0a7726757a30b414` |
| `logs/09-normal-source-clone.stderr.log`                          | `44cae69e403e8000cfcb289b0b38bf3e69a03a3ceb287f87249cb4d5fa00c409` |
| `logs/09-normal-source-clone.stdout.log`                          | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `provision-fixtures.py`                                           | `42f8d4a2eec48825ddaa79540e159cf17cb473eaba12a5d10d435f86326210cb` |
| `run-naming-proof.py`                                             | `27f18bba96e0c75f0f5364ad0ff4802733df7aa209a3c8c5fb8d182e5a382b45` |
| `run-unique-tsx-companion.py`                                     | `8cb6bb86aadf84f96e0548e2d4a826e83ec8146449d647399d433739a39002c4` |
| `toolchains/native/package-lock.json`                             | `385a350c0967c74b2fb3d2dd92bd8154720a800997184e1e3e874f8d392f20dd` |
| `toolchains/native/package.json`                                  | `4203b2ee2a4c50bde5f72cd7fe082df1f8d0517e457b10a8cef16d4c8fc004ee` |
| `toolchains/web/package-lock.json`                                | `eabb23199a320e6a81c097639a25c5f71d67e425950ecd0905beef2b5bbe9160` |
| `toolchains/web/package.json`                                     | `739f67952eeacfc2d61c15b26fd703a1a9d5d96a556932f7f4723e5c7dc6bab2` |
