# M04 / A04 — preserve supported numeric error severity

The existing semantic merger declares numeric ESLint severities but upgraded
only the literal string `error`. When the first recipe used off or warn and a
later recipe requested numeric2, the result kept the earlier weaker severity.
The real emitter serialized that value and actual ESLint returned0 on banned
input. This is a supported producer-input counterexample in the original A04
severity class, not a new every-config-must-error policy.

ESLint defines numeric2 as error and0 as off in its
[rule severity contract](https://eslint.org/docs/latest/use/configure/rules#rule-severities).
The local tuple types explicitly accept numbers, and the existing module and
literal-error tests require preserving an error request from either recipe.
The correction recognizes numeric2 in one private predicate shared by the
existing imports and syntax-shaped merges. It preserves option merging, dedup,
collision errors, intentional off and the existing first-severity behavior when
neither input requests error. It adds no public API, dependency or analyzer.

## Frozen independent expectations and actual delivery

[frozen-severity-contract.json](frozen-severity-contract.json) fixes six variants
for each of three carriers: `no-restricted-imports`, `no-restricted-syntax` and
the existing `rules-as-tests/restricted-syntax-audit-exempt` wrapper. The literal
expected levels, process outcomes, banned sources and allowed companion were
frozen before any runtime or repair. Its source hash map records pre-repair
inputs; per-arm actual source hashes identify baseline, fix, source fault and
restoration. The old baseline hash is not a required fixed-source hash.

The unchanged driver calls the actual production merger and actual `emit`.
Each minimal emitter plan carries the actual merged ESLint snippet; the scope
is that fragment-producing API, not a complete research/manifest installation.
A real consumer config reads `emitted/eslint-rules-snippet.json` from disk
without rewriting it. Actual ESLint CLI then processes the frozen banned and
allowed JS files. Two requested bans must yield their intended rule IDs and
`M04_BLOCK_A`/`M04_BLOCK_B` diagnostics at the required severity. The allowed
file must return0 without diagnostics. Parse/config/unmatched errors never
count as rejection; all four arms have zero infrastructure failures.

All three carrier shapes have these actual bad-file process outcomes:

| Frozen variant                    | Required level | Required bad exit | Baseline | Fixed | Source fault | Restored |
| --------------------------------- | -------------- | ----------------- | -------- | ----- | ------------ | -------- |
| numeric-error-right-of-off        | 2              | 1                 | 0        | 1     | 0            | 1        |
| numeric-error-right-of-warn       | 2              | 1                 | 0        | 1     | 0            | 1        |
| numeric-error-left-of-off         | 2              | 1                 | 1        | 1     | 1            | 1        |
| literal-error-right-of-off        | 2              | 1                 | 1        | 1     | 1            | 1        |
| explicit-off-remains-off          | 0              | 0                 | 0        | 0     | 0            | 0        |
| existing-first-warn-without-error | 1              | 0                 | 0        | 0     | 0            | 0        |

With numeric2 on the right of off, the baseline emits0 and reports no ban.
With numeric2 on the right of warn, it emits warning level1 and reports both
bans as warnings; the process still returns0. These are distinct failures,
not an infrastructure exception or an empty selector. Numeric2 on the left and
the literal-error control already enforce correctly. Intentional off and
first-warn controls retain their defined behavior. All 72 allowed-file probes
across the four arms return0 with no messages.

## Meaningful RED, source counterfault and restoration

Before changing production, twelve appended tests consume the actual returned
config through the installed ESLint `Linter`. Expected severities are literal
facts independent of the merger result. Both builtin merge shapes get numeric
left/right, string-error, off and warn companions. The first real Vitest run
has 17 passes and four intended failures: `[]` or `[1,1]` versus `[2,2]`.
The nine original cases remain unchanged and pass. The wrapper is exercised
through actual emitted disk and CLI, not claimed from a substitute unit engine.

The minimal production fix makes all21 unit tests pass. A separately frozen
source counterfault removes only numeric recognition from the shared private
predicate, exactly once. The unit file, outer driver, contract and fixtures
remain unchanged. That source fault returns the same four unit failures and
six real CLI mismatches. Its actual source snapshot, one-occurrence patch and
full child diagnostics are retained. Exact preimage verification then restores
the fixed source hash. Final restoration passes the same18cases/36CLI probes
and all41 tests in the merger, synthesizer and emitter suites.

| Actual arm          | Real CLI probes | Contract mismatches | Infrastructure failures | Outer exit |
| ------------------- | --------------- | ------------------- | ----------------------- | ---------- |
| original producer   | 36              | 6                   | 0                       | 1          |
| fixed producer      | 36              | 0                   | 0                       | 0          |
| source counterfault | 36              | 6                   | 0                       | 1          |
| exact restoration   | 36              | 0                   | 0                       | 0          |

The ordinary regression uses in-process Linter calls; the 144 real child CLI
probes are bounded campaign evidence, not a new unconditional ordinary PR
suite. Actual test-quality lint and shipped format checks return0, as does
source diff validation. No old431-test cohort, S1 detector corpus or unrelated
matrix was replayed. The frozen test file remains byte-identical across the
production fix, counterfault and restoration.

## Candidate, derived outputs and remaining original obligations

The source candidate changes exactly the existing merger and its test, this
README and the frozen contract. Root source remains untouched during
preparation. Existing independent integration must accept the exact candidate,
actual proof and later actual application; this author does not approve their
own source or outcome.

The two source files already belong to the stock payload. The merger also
appears in the existing rule-bootstrap CLI and synth-and-wire bundles. Those
two compiled bundles and the causal MANIFEST update are held for the original
independent application and reciprocal stock-generation gates. No bundle or
fingerprint is hand-edited. Pre-push/MCP bundles are expected unchanged, subject
to actual admitted stock generation; no whole derived result is claimed here.

This is original M04 authored iteration1/5, PARTIAL0/2, with no new subcap.
It adds a demonstrated supported-input boundary to the original severity class.
The historical forced-serialized-off/431-test survivor and accepted S1/P53
emitted-disk proof remain at their own exact scopes. Original M04 installer and
family reconciliation remain open; this is not a whole-M04, whole-kernel or
S2 certificate. Remaining population/class/adapter assembly, S3/S4, current
CI/staging and compatible sole-writer0166 delivery retain their original gates.

## Portable evidence

Raw artifacts use the existing owner channel
`01a12f25-6bcc-7c71-922e-d36eca2e9a5c` at
`outputs/tak-resume-20261013/s2-m04-a04/execution-1/`. Retrieve that directory
and verify the complete full-hash index, then the individual retained files.
It binds all actual emitted snippets/configs/bad-good sources, complete command
receipts/stdout/stderr, per-arm source snapshots and reports; a controller
summary or a host-absolute fixture path is not the evidence boundary.

| Artifact                                                    | SHA-256                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| `RAW-EVIDENCE-INDEX.json`                                   | `ca22b9161ea90f4675013d502b8267560783b494e0a35f85422df9352c1d8873` |
| `BRIEF.md`                                                  | `59fd7a287b3c62b5c7efeed0e0d7074f4d6dc36b81baef189965788a6769cc88` |
| `BRIEF-GO.json`                                             | `48d91c812070a85817d4e3caafbc0d37f0a28c23c3b95a8248dfe514b5f4d397` |
| `EXACT-INPUT.json`                                          | `ae0120192d652de793f9cd5a5a524ac77b43038b378d05ec591d5fbf14973dfe` |
| `FROZEN-SEVERITY-CONTRACT.json`                             | `bf977bfc3c41845de05bceb5124ce9aea1143dee432be6124a9b2400b8e23786` |
| `FROZEN-ACTUAL-PROOF-INPUTS.json`                           | `624016f417e84410ecd92ece062371ef580cfe9a07ae428f33d52f5a98b5e11a` |
| `UNIT-REGRESSION-BEFORE-PRODUCTION-FREEZE.json`             | `ed98ce69e354827047a4393cfae0215b75625f291318d15d6ded326ada7afb80` |
| `FROZEN-SOURCE-COUNTERFAULT.json`                           | `1c2624fc64bdc07cdeb4b29e1ceaefdc4ca54acb8bcb478811a1ea32af8188b1` |
| `ROOT-CAUSE-EVIDENCE.md`                                    | `a3a36a8d65ec3365668679ad5466b83d1cd8c00e8f9f58cf757d466acd27d3a4` |
| `actual-merge-and-emit.mts`                                 | `0e681b15b7c9c436313effe10381804825765771084f6235c11e6f7ac292ad3f` |
| `run-severity-proof.py`                                     | `2d92f6ad6209ba7335c65963882db0c6fbaa377f7e0a9a7ead27eaddd5a5efdd` |
| `logs/01-new-unit-regressions-before-production.json`       | `3f38402be17fe13a0c062b3a42dd72edbd6cdb3bad3e8d0b819dbb0957ebe6e1` |
| `logs/01-new-unit-regressions-before-production.stdout.log` | `81f11053222bcc5880fe5ef33ce077a7bef7d13fc8fca194c4c59e6508298e00` |
| `logs/02-fixed-unit.json`                                   | `96d041b43a1a775c4d1dec8a2943beff0a4fa694c826f3413125558f9b4edff9` |
| `logs/02-fixed-unit.stdout.log`                             | `b5fd5e883fa1eee7437ddfb579f92dd055b2a921004239602af26fd15d1aed9d` |
| `logs/03-source-counterfault-unit.json`                     | `3f38402be17fe13a0c062b3a42dd72edbd6cdb3bad3e8d0b819dbb0957ebe6e1` |
| `logs/03-source-counterfault-unit.stdout.log`               | `afb57b1154d367958b5565aed35b23c56cacb7b106b426aeee9dad7a3696d788` |
| `logs/04-source-counterfault-real-CLI-controller.json`      | `a59f4e1125ee836d32e16e52b1c0af3a30d0568f687020775b9607c6b24ccd4e` |
| `logs/05-restored-normal-affected-suites.json`              | `401344ab007978ab7d7ce8e8e33727f1257a574b1e9f34e583126e7747391156` |
| `logs/05-restored-normal-affected-suites.stdout.log`        | `94773d460ec4499b596c9cc3b8f56eedf131026385866bb5798aa27c985bd444` |
| `source-counterfault/ACTUAL-APPLIED-FAULT.json`             | `7f6f9e40bc9d66bc82c915ba2abb38aa71d9423cf1392efe9ba3cfb86fdcfdb4` |
| `source-counterfault/actual-one-occurrence.patch`           | `8ae011beb6f0decbc496fff63df3703e03a8855e2c405ebbeb6d22edabb1e175` |
| `source-counterfault/ACTUAL-RESTORATION.json`               | `3e0fa9e745149aa10db90434df9192b0f0b8b4a95661cf4ed7d27af54f398ebd` |
| `runs/baseline-current/ACTUAL-SEVERITY-RESULTS.json`        | `e36eda19573bea79b5279c327249f8c24f8bf4cad1fb15980bebfc948392c9d9` |
| `runs/fixed/ACTUAL-SEVERITY-RESULTS.json`                   | `a1fd9a08e1efbf5ec4cc3cfb5b6e3c65dc2557fb598b1df4ea5f7a3940789ef0` |
| `runs/source-counterfault/ACTUAL-SEVERITY-RESULTS.json`     | `19218982f66264edd8d3e9fdcda45b6ae5f9e292f8dc52a56c17f1d2130fa8e3` |
| `runs/restored/ACTUAL-SEVERITY-RESULTS.json`                | `d39047c11ad8b62c6825401cf2ebea84bab3fb9a3f965b8ff47f80d1d1e08b1c` |
| `runs/baseline-current/ACTUAL-EMITTED-CASES.json`           | `cc20729e5b86ed8d56bb483b6755846b69322b11e4210fca7356cd0d1e3778f4` |
| `runs/fixed/ACTUAL-EMITTED-CASES.json`                      | `533b003e324e4cc86717e6a4307b4222777d728a012cc040684c15b4d6fabcce` |
| `runs/source-counterfault/ACTUAL-EMITTED-CASES.json`        | `54352dc491dfd194156292a81a1722a358618e039096f69153665d1f19c4727e` |
| `runs/restored/ACTUAL-EMITTED-CASES.json`                   | `533b003e324e4cc86717e6a4307b4222777d728a012cc040684c15b4d6fabcce` |

| Protected producer/delivery input                               | SHA-256                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/core/synthesizer/emit.ts`                             | `d9cc877d462efe3b1ed521acbcc4214b81e5b36089ae336323ea53e160766ac4` |
| `packages/core/synthesizer/synthesize.ts`                       | `4665363832926090fa7a75db166de7780e2248fea9238108ae9e22d81d7d5d81` |
| `packages/core/synthesizer/compile-declarative-md.ts`           | `b0c8aa4079325ae87f41e09d6d9088cb9d9dff16cd86c908458d90916a346af4` |
| `packages/core/eslint-rules/restricted-syntax-audit-exempt.mjs` | `71f115fc4a27dfa2919902d57b609b5bff1f0f8eed69bbf22b698d13d4d41c2b` |
| `package-lock.json`                                             | `b0322aee4c6cb0f4c8f4a72ae7c6db94346f856250a5acd6e63eb77535aa3659` |

The raw index contains 1150 complete file bindings. Baseline source: `369aa18d98a056d46c1d9ca6220993b5dffae2f91bc46c3d278d6068e45ccc0f`. Fixed/restored source: `952d5607e1cd3869ab966e45418fe42aaefaac99b3f7396462d71711b7162ecc`.
