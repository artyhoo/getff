# M01 / Seed A01 — finite lexical-policy floor for P06

Evidence correction on accepted base `c0c6452ffccb8aec01862f097fc3268f897d4f71`
(tree `1fad96c0038126111bec027597a2db4bc7c5aa98`). Candidate only; independent
integration acceptance, source application and later stage gates remain pending.

## Finite policy contract

The actual P06 manifest aggregate rejects soft-only obligations for automated checks.
The source adds plain `should` to the documented soft tokens and accepts bare `must`
without regard to case. Existing hard counterparts, manual exemption, absent-policy
behavior and `return !hasHard;` remain unchanged. Lowercase `must` is the prospective
A01 grammar clarification, not a claim of an earlier runtime regression.

Seven independently frozen lexical cases plus one pristine-manifest control run
through the actual P06 file and full manifest. Only R1.policy changes; the manual
case also changes R1.check.type. The driver contains no copy of the gate predicate.

Actual prior Red: `ACTUAL-REAL-P06-GATE-RESULTS.json`, SHA256
`01f81caaa40d873d1f766302ad44d6b7b1f11c280723573a1633b75e184c61fa`,
records the original aggregate admitting plain `should` with process exit 0.

## Corrected process proof

Vitest 4.1.8 uses its supported `-t` full-name regexp filter ending in the exact
aggregate title: `all automated-check rules with policy fields use hard obligation language`.
Every complete JSON report has exactly one passed/failed runnable assertion, in the
actual subject file and with that title; the other nine tests are skipped.
Admission requires a passed assertion and process exit 0. Refusal requires a failed
assertion, ordinary process exit 1 and the selected failure diagnostic
`Rule R1: policy for automated-check rule contains only soft-obligation language`.
Infrastructure, unrelated failures and contradictory process status receive no credit.

The same byte-frozen normative driver and expected outcomes are used in all arms.
A separate controller validates the following exact detection signature.

| Arm                         | Outer exit | Observed result                                                                                         |
| --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| Repaired                    | 0          | All seven cases and pristine control match                                                              |
| K3: exact-once return false | 1          | Three soft-only cases falsely admitted with real process 0                                              |
| K4: exact-once return true  | 1          | Uppercase/lowercase must and Never with soft context falsely refused with intended diagnostic/process 1 |
| Restored                    | 0          | Scratch checked against K4 preimage, restored to exact repaired bytes; all eight match                  |

Manual exemption and pristine control stay admitted under both faults. Faults only
affect the owned scratch subject. The producer and frozen seven cases stay unchanged.

## Complete retained receipt bindings

Portable labels below resolve within the retained TAK evidence bundle, rooted at
`s2-m01-a01/` unless explicitly prefixed `s2-readonly-prerequisites/`. These are
off-tree retained artifacts, not additional shipped source files. All digests are SHA256.

| Input                                             | SHA256                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| Repaired P06 source                               | `0fa461dfd263ec0ee470a9da301585c21a89e75f23e93f0b6d4916ffa61738ba` |
| Full unmodified manifest                          | `9ac59a882852b6cefc2ad19e1c77af95e1cc22374a4970a53c22c7751ecd2153` |
| Seven frozen cases                                | `b63a091bf88c18c98141993966504e9eff5e13d299deee2f6f25676a9272fcd2` |
| Frozen actual-selection/fault supplement          | `578c431c97b749168d56f888bc0fe6e0a6ea94027cb93a616284896c43ed0b10` |
| Inherited accepted packages/getff/MANIFEST.sha256 | `17856aa152dec10f3e885f0f18cc74b12d3d37d4ca6e2f302278744e202f630e` |

| Retained artifact                                       | SHA256                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `execution-2/outer-driver/run-corrected.py`             | `7ffbce7ce5f69b3fc356aad53b33d5758a20558d3a115240c3fa52da55023324` |
| `execution-2/outer-driver/run-four-arms.py`             | `6b6240318da0d4c583547bf528bcf04f219dfa00f64f237174557186d970f51f` |
| `execution-2/outer-driver/FROZEN-CORRECTED-INPUTS.json` | `69e2fe3836297e14b7b39387a713fe57be94b47643b5aaee68978d87bb90a808` |
| `execution-2/logs/CORRECTED-FOUR-ARM-RESULTS.json`      | `7abfab806ed176437d371bfaa2485c64c2b8a41164e09defb38612989012fe6a` |
| `execution-2/logs/controller-good.stderr.log`           | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `execution-2/logs/controller-good.stdout.log`           | `2c7fa85911778d54e6898d1bdb3e14346d6697c3e50e3edaab3396b0c564a50c` |
| `execution-2/logs/controller-k3.stderr.log`             | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `execution-2/logs/controller-k3.stdout.log`             | `b24745c8e92de008f32bdbf848638464abaf4f9a041cd8ef4f742466da3daa50` |
| `execution-2/logs/controller-k4.stderr.log`             | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `execution-2/logs/controller-k4.stdout.log`             | `0bb20b0eee801c885e80799a2956fa69bdf89aabe1cee657d20de65261cbd3fd` |
| `execution-2/logs/controller-restored.stderr.log`       | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `execution-2/logs/controller-restored.stdout.log`       | `f69f5454e0217c70fb34b3becaf0332a83b9d1e612a3023b1078b686b6c37b98` |
| `execution-2/logs/corrected-good-results.json`          | `23ee79efd84195e0cae365d9531b4922e00d305b08dc18d8121e1c51f9ddaa68` |
| `execution-2/logs/corrected-k3-results.json`            | `746cf90d1078486ee8ee34c553a18c17bdfb07630f972631357a6286269bee54` |
| `execution-2/logs/corrected-k4-results.json`            | `d6a42886693bc3d298aa6cc34688dd56465f1f4b8301892562920d3ba13ee9c4` |
| `execution-2/logs/corrected-restored-results.json`      | `665ad426405d37db953f1240308e52a6b6fddd94e8cc1a03d0e21001f96082c4` |

Each per-case prefix below is under `execution-2/logs/`. Suffixes are
.subject.ts, .manifest.json, .stdout.json and .stderr.log. The complete snapshots
and raw reporter/stderr bytes are retained. Commands, actual exit status, title,
file and runnable count are in each arm result JSON pinned above.

| Prefix                                                | Subject SHA256                                                     | Manifest SHA256                                                    | Stdout SHA256                                                      | Stderr SHA256                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `corrected-good-original-manifest-control`            | `0fa461dfd263ec0ee470a9da301585c21a89e75f23e93f0b6d4916ffa61738ba` | `429f682b732ee4b25f14938104c35e263cf744a0135be7b9f2280c4522fa7bfd` | `878f18a8c77cd446ff3ca1e9eb4fb0aca7bcf67b8f6f0e21927b6d4c134be0c4` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-good-plain-should-automated`               | `0fa461dfd263ec0ee470a9da301585c21a89e75f23e93f0b6d4916ffa61738ba` | `338de087f3d33bd0910c0f93956a533d456bbbed8fa053fd95e6e4aa0e0f5623` | `e685cf6a748ca0239b16666dd7e01c0cc9ee5c02943aef123639ef7c544166b9` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-good-soft-recommendation-automated`        | `0fa461dfd263ec0ee470a9da301585c21a89e75f23e93f0b6d4916ffa61738ba` | `8a63d094d93f413cf28fe17a5895ab8ab43d2cf8d58dc0cb341befbb337722a8` | `3d3316bd0b67f1683979a8e6f5f5756220fba7a56c6b9aa78e2646dede7f99d9` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-good-preferably-automated`                 | `0fa461dfd263ec0ee470a9da301585c21a89e75f23e93f0b6d4916ffa61738ba` | `ee7046ecab3a3441165618eee669833473f9c64b13e0b3ecaa16a5fbed230e62` | `5d9b86c6ad681198813a74656826685fa9b586042c861c9309cc38fa1bd6878e` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-good-uppercase-must-with-soft-context`     | `0fa461dfd263ec0ee470a9da301585c21a89e75f23e93f0b6d4916ffa61738ba` | `52da16bf2efd4413dcfdc02571e5da4964089013d5c2a5c9d338c93b89bf0c15` | `2b38fb328671fef9f16b4d127acdb495c596330e66ddd522f11e6ea1957bc068` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-good-lowercase-must-with-soft-context`     | `0fa461dfd263ec0ee470a9da301585c21a89e75f23e93f0b6d4916ffa61738ba` | `20f3d42ed1220fce06839b29e112b6ea64cb39439f5f756daebbe70fe8866089` | `b46e961bcc819b61d80cd4b954912709c117a5a96d1d0bc1e7b2498fcb79097a` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-good-hard-never-with-soft-context`         | `0fa461dfd263ec0ee470a9da301585c21a89e75f23e93f0b6d4916ffa61738ba` | `3b602ceded530a875e697717eedaed02f63ea0963f400a54732afe336205f8c2` | `b59c183561c2180097bcdf0e922ae4f9a6377733e0d5bca74bb9cefb1d3bdf07` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-good-manual-soft-control`                  | `0fa461dfd263ec0ee470a9da301585c21a89e75f23e93f0b6d4916ffa61738ba` | `1f137447468842b5ea04a6815475e30200a9737cea95de731312d436313cb27d` | `160b981fd3276d8ffd5103ca551591b1c75bd4a8cab799e68de10c60683987af` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-k3-original-manifest-control`              | `cca45d006a65691a4e72d3998f88c186b225aadf11cd47a2f47565d444d4477b` | `429f682b732ee4b25f14938104c35e263cf744a0135be7b9f2280c4522fa7bfd` | `dc6a03075f26ef1c86f41777c8adf469ad3d449be633099451caad85c2240336` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-k3-plain-should-automated`                 | `cca45d006a65691a4e72d3998f88c186b225aadf11cd47a2f47565d444d4477b` | `338de087f3d33bd0910c0f93956a533d456bbbed8fa053fd95e6e4aa0e0f5623` | `b0bd5a78d7d419bb09fae9657f640450556841ed44b5196fbdf210b41ef3c55a` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-k3-soft-recommendation-automated`          | `cca45d006a65691a4e72d3998f88c186b225aadf11cd47a2f47565d444d4477b` | `8a63d094d93f413cf28fe17a5895ab8ab43d2cf8d58dc0cb341befbb337722a8` | `a84a6676f03d03b05de14e5cd01f0a329f0bf5f2f915db423e65b355f2f7d1ee` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-k3-preferably-automated`                   | `cca45d006a65691a4e72d3998f88c186b225aadf11cd47a2f47565d444d4477b` | `ee7046ecab3a3441165618eee669833473f9c64b13e0b3ecaa16a5fbed230e62` | `b9fbf475d3eea553e5a50a61147ae36c7b1e7a760d6e9dc5a100130fa83a5114` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-k3-uppercase-must-with-soft-context`       | `cca45d006a65691a4e72d3998f88c186b225aadf11cd47a2f47565d444d4477b` | `52da16bf2efd4413dcfdc02571e5da4964089013d5c2a5c9d338c93b89bf0c15` | `115fbd63d06408159dd65862211e99cf63e21cb71cfdd92b7f3dbf966fb846a8` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-k3-lowercase-must-with-soft-context`       | `cca45d006a65691a4e72d3998f88c186b225aadf11cd47a2f47565d444d4477b` | `20f3d42ed1220fce06839b29e112b6ea64cb39439f5f756daebbe70fe8866089` | `43d4771abda6e4a400fd2717c12479d842eb85c75f1bbeb1457663c1c67e9919` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-k3-hard-never-with-soft-context`           | `cca45d006a65691a4e72d3998f88c186b225aadf11cd47a2f47565d444d4477b` | `3b602ceded530a875e697717eedaed02f63ea0963f400a54732afe336205f8c2` | `027c296604b952c5dd7cc47d6afc75538f82256d17937ec2872b783bad0bfc93` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-k3-manual-soft-control`                    | `cca45d006a65691a4e72d3998f88c186b225aadf11cd47a2f47565d444d4477b` | `1f137447468842b5ea04a6815475e30200a9737cea95de731312d436313cb27d` | `409d323cd6ec20dfa29d1712412b194b600527ac18b8cdd252f606a08b19275c` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-k4-original-manifest-control`              | `02b5a34225e313d86532b58f4bbd117c64106265ad72fd5aa1c45e72de7cd2a8` | `429f682b732ee4b25f14938104c35e263cf744a0135be7b9f2280c4522fa7bfd` | `71a417dec81b66c91ff7ba68f41970b2d2427e77a1f28f46f8fcac7c74619ad7` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-k4-plain-should-automated`                 | `02b5a34225e313d86532b58f4bbd117c64106265ad72fd5aa1c45e72de7cd2a8` | `338de087f3d33bd0910c0f93956a533d456bbbed8fa053fd95e6e4aa0e0f5623` | `99fa71dd67b633bc2e79f2b210a8f0a72f0579f3b1ea67c90fd106c67d6134b6` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-k4-soft-recommendation-automated`          | `02b5a34225e313d86532b58f4bbd117c64106265ad72fd5aa1c45e72de7cd2a8` | `8a63d094d93f413cf28fe17a5895ab8ab43d2cf8d58dc0cb341befbb337722a8` | `584a2cfb7a50a4062b791692c649e729a779f16e9f327d21f6331b2d3ab52d87` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-k4-preferably-automated`                   | `02b5a34225e313d86532b58f4bbd117c64106265ad72fd5aa1c45e72de7cd2a8` | `ee7046ecab3a3441165618eee669833473f9c64b13e0b3ecaa16a5fbed230e62` | `3c180d5bc51728760fa8b76dfdf0c094543a8a15f16bfe7917d489bdf6badab9` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-k4-uppercase-must-with-soft-context`       | `02b5a34225e313d86532b58f4bbd117c64106265ad72fd5aa1c45e72de7cd2a8` | `52da16bf2efd4413dcfdc02571e5da4964089013d5c2a5c9d338c93b89bf0c15` | `a3b361a0f78cb2c1de869e4a52b80466bf408ae3ff6a0c5fcd98831bba13f87f` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-k4-lowercase-must-with-soft-context`       | `02b5a34225e313d86532b58f4bbd117c64106265ad72fd5aa1c45e72de7cd2a8` | `20f3d42ed1220fce06839b29e112b6ea64cb39439f5f756daebbe70fe8866089` | `dc194683b08ffb63544ca0ffae23c6b4bfff63f6128bd06e0140e35e39cb99f1` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-k4-hard-never-with-soft-context`           | `02b5a34225e313d86532b58f4bbd117c64106265ad72fd5aa1c45e72de7cd2a8` | `3b602ceded530a875e697717eedaed02f63ea0963f400a54732afe336205f8c2` | `6089b04c5f7178d4bbd3bfc03e3a9a3f92727e875741feaad76d87525fc0db62` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-k4-manual-soft-control`                    | `02b5a34225e313d86532b58f4bbd117c64106265ad72fd5aa1c45e72de7cd2a8` | `1f137447468842b5ea04a6815475e30200a9737cea95de731312d436313cb27d` | `7ab2bcd6dde848821e5fe869eacc750e04b1c7ca2aebfa49d8a5675a5b718d75` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-restored-original-manifest-control`        | `0fa461dfd263ec0ee470a9da301585c21a89e75f23e93f0b6d4916ffa61738ba` | `429f682b732ee4b25f14938104c35e263cf744a0135be7b9f2280c4522fa7bfd` | `4e46040d746d1219db6a55007a6dc0aaabf80ab620be5fcae775561262efc859` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-restored-plain-should-automated`           | `0fa461dfd263ec0ee470a9da301585c21a89e75f23e93f0b6d4916ffa61738ba` | `338de087f3d33bd0910c0f93956a533d456bbbed8fa053fd95e6e4aa0e0f5623` | `e8a4f6e8d122f4a09c0531993e2cd8a8d3201726a70b9e4b306bba7593074884` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-restored-soft-recommendation-automated`    | `0fa461dfd263ec0ee470a9da301585c21a89e75f23e93f0b6d4916ffa61738ba` | `8a63d094d93f413cf28fe17a5895ab8ab43d2cf8d58dc0cb341befbb337722a8` | `5aec3c995aed78108b858db19d79261f141216b7149922b1ecb325d3a28c2165` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-restored-preferably-automated`             | `0fa461dfd263ec0ee470a9da301585c21a89e75f23e93f0b6d4916ffa61738ba` | `ee7046ecab3a3441165618eee669833473f9c64b13e0b3ecaa16a5fbed230e62` | `b44011b5c3df93bc7ef53ceebc31082df4ab88d4a649917fba078636f2961f41` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-restored-uppercase-must-with-soft-context` | `0fa461dfd263ec0ee470a9da301585c21a89e75f23e93f0b6d4916ffa61738ba` | `52da16bf2efd4413dcfdc02571e5da4964089013d5c2a5c9d338c93b89bf0c15` | `ae44c68b92b488fc10dbe8c13f06f0ccc1c6fd3667f70fac004f3896d7001a4b` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-restored-lowercase-must-with-soft-context` | `0fa461dfd263ec0ee470a9da301585c21a89e75f23e93f0b6d4916ffa61738ba` | `20f3d42ed1220fce06839b29e112b6ea64cb39439f5f756daebbe70fe8866089` | `4c84f0860bde4ef0b211e7b21c1e08a8fdfe27428d6308f585c0e5c3fcf6afaa` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-restored-hard-never-with-soft-context`     | `0fa461dfd263ec0ee470a9da301585c21a89e75f23e93f0b6d4916ffa61738ba` | `3b602ceded530a875e697717eedaed02f63ea0963f400a54732afe336205f8c2` | `c2c4424410e1de5703313df55da5f0234531b303633fb674217077a3dc200860` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `corrected-restored-manual-soft-control`              | `0fa461dfd263ec0ee470a9da301585c21a89e75f23e93f0b6d4916ffa61738ba` | `1f137447468842b5ea04a6815475e30200a9737cea95de731312d436313cb27d` | `56a1fbf9dff4ca44d3cf8a5b57ad5d366340645744b222ba5f2ab920f3d954c9` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

## Reused source checks

These earlier normal checks are reused on identical source, manifest and relevant
configuration bytes. They are not fresh reruns and are separate from the one-test
aggregate process proof above.

| Retained artifact                                  | Observed result             | SHA256                                                             |
| -------------------------------------------------- | --------------------------- | ------------------------------------------------------------------ |
| `execution-1/logs/00-baseline-p06-suite.log`       | Original P06: 3/3, exit 0   | `4d3b6070160cc25f8ae862957e069edb4957d786b161779d10d06994a074f373` |
| `execution-1/logs/01-repaired-p06-suite.log`       | Repaired P06: 10/10, exit 0 | `1016f8e4e860cc431c40073e84271320c1466bcb22199b23d5b603a6f31abd8d` |
| `execution-1/logs/03-repaired-relevant-suites.log` | P06/P51/P22: 23/23, exit 0  | `c253c0fcebe664b521bb40894fc7f26c3cee660ea6feb8307278de0b78e5374c` |
| `execution-1/logs/04-repaired-format-check.log`    | Source formatting: exit 0   | `1fda9ece4bce13425f96435332ae839bc6924d8c3731dc04de8ee113b0908a0f` |

## Preserved rejected history and limits

The old unfiltered driver `preparation/outer-driver/run-outer.py` has SHA256
`87ff7055a8b484c46e0095402fcf8490c1a1bfd1737bce1aeb1119c41d5481bc`.
Its 24 raw reports actually ran ten assertions each. Under K3 the plain-should
aggregate passed while four helper failures caused process exit 1. That was not a
genuine admission, and the old control claims are rejected as process evidence.
The first old restoration also left faulted scratch bytes; checking only the
producer digest did not prove restoration. All old files remain unchanged.

This correction establishes a finite lexical-policy floor, actual aggregate
selection, process-status agreement and sensitivity to the two reached source faults.
It does not prove general semantic policy interpretation or quoted/ambiguous prose.
S2-S4, independent integration acceptance, application/generation, current CI and the
guarded working0166 installation remain outstanding. No whole-TAK completion claim.
