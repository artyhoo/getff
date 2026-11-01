# S1 requirement-to-evidence matrix (Q1–Q6 × K1–K7)

> All paths relative to `docs/test-assurance-kernel/s1/` unless prefixed `scripts/`.
> Raw exits live inside the cited logs; no cell rests on a status claim alone (K7).
> Coverage denominator for the acceptance run = the frozen oracle
> (`scripts/test-assurance/expectations.json`, 30 cases) + the 5 §6 counterfactual records.

| Family (predicate) | K1 valid admitted | K2 real violation rejected | K3 gate regression detected | K4 over-rejection detected |
|---|---|---|---|---|
| Static Q1/Q2 (`no-vacuous-assertion`, `require-effective-assertion`) | good companions exit 0 (`logs/batch-b/verification.log`) | bads exit 1 with intended rule ids (`logs/batch-b/red-probe.log`, `verification.log`; adapter step `static-matrix`) | driver arm `D1-PERM-Q1` (K3 report suppressed) + `D3-BOUNDARY-Q1` (BinaryExpression dropped, flips ONLY `bad.literal-arithmetic`) (`logs/batch-f/driver-run.log`) | driver arm `D2-K4-Q2` (recognizer→nothing: goods 0→1, bads stay) (`logs/batch-f/driver-run.log`) |
| Counterfactual Q3 (frozen oracle) | cf2a/cf2b pinned companions killed WITH intended assertions; bads survive = reject-by-counterfactual (`counterfactuals/cf2a-age-boundary-shift.json`, `cf2b-min-age-weaken.json`; `logs/batch-d/cf2a-replay.log`, `cf2b-replay.log`, `replay2-*.log` timed re-runs) | cf1: baseline 2/2 green; mutant run — the copied-predicate/circular companion SURVIVES the reached fault (the demonstrated gap behind its frozen reject-by-counterfactual classification) while the behavior-backed companion is killed with the intended assertion (`counterfactuals/cf1-a03-circular-oracle.json`: record classification `killed` = the intended kill landed) | cf3 fault replayed against the GATE by frozen arm `D5-PERM-GLV` — byte-identical patch sha `6da3c1c1…`, probe flip observed (`logs/batch-f/driver-run.log:37-40`) | n/a — counterfactuals mutate the subject, not the detector; the K4 slot for this family is the static lane's `D2-K4-Q2` |
| Executed conformance Q4/Q5 (principle 52) | `good.asserted-exit` + `good.behavior-backed-phrase` admitted; q4 fixture flip kills ONLY `good.asserted-exit` («expected +0 to be 42») (`logs/batch-c/red-probe.log`) | `bad.ignored-exit` + `bad.circular-phrase` rejected = survival demonstrated (`logs/batch-c/verification.log`; adapter step `driver`) | q4 fault = the fixture flip itself at the gate (exit-status contract), q5 fault kills `good.behavior-backed-phrase` («expected false to be true») while `bad.circular-phrase` stays green (`logs/batch-c/red-probe.log`) | q4/q5 faults are uniquely applicable: companion goods flip, sibling bads + A07 aux stay green (uniqueness logged same files) |
| Delivery Q6 (principle 53 + replays) | baseline both companions pass + real CLI rejects the planted probe with rule id = `delivery-live` (`logs/batch-e/verification.log`) | severity-`off` on the EMITTED config (A04) kills the good companion on its own assertion; CLI flips exit 1→0 silent (`logs/batch-e/verification.log`, `red-probe.log`) | four delivery-family edges proven: fences-fire deletion → import-time throw; template dangling ref → principle 25 RED; principle rename-out-of-grammar → silent drop + 53 ratchet RED; A12 characterization (`logs/batch-e/edges.log`) | both edges (severity-off, unregister) proven uniquely applicable to the real delivered config (`logs/batch-e/verification.log`) |
| Kernel guard-liveness family | cf4 healthy matcher reports the parse-error miss (`counterfactuals/cf4-guard-liveness-status-inversion.json`, killed by `[GLV-1] expected 'pass' to be 'fail'`) | cf4 status inversion killed (`logs/batch-d/cf4-replay.log`) | `D5-PERM-GLV` (K3) + `D6-K4-GLV` (K4 good-violation forced: healthy rule `pass`→`fail`) (`logs/batch-f/driver-run.log`) | `D6-K4-GLV` as above |

K5 per delivery family: static rules → root `eslint.config.mjs` + 3 template deliveries
(principle 25 3/3, `logs/batch-b/verification.log`) + the template dangling-ref edge
(`logs/batch-e/edges.log`); executed-conformance → real vitest runner in scratch worktrees
(`logs/batch-c/verification.log`); counterfactual → repo tsx in detached worktrees
(`logs/batch-d/verification.log`); principle tests → the REAL
`packages/core/vitest.config.ts` include grammar, break proven by the rename replay
(`logs/batch-e/edges.log`).

K6 discovery (fail-closed, per family): missing corpus file / spawn failure / empty
selection refused pre-spawn (principle 52, `logs/batch-c/verification.log`); corpus↔registry
bidirectional reconciliation + LIVE stray-file probe + grammar-bound ratchet
(principle 53, `logs/batch-e/verification.log`); adapter-level: empty selection / unknown
step / wrong host / foreign clone → exit 3, tamper arms T0/T1/T2 all DETECTED with
byte-identical restores (`logs/batch-g/tamper-arms.log`, `acceptance.log`).

K7 honesty: every cf record carries fault, carrier, patch sha, reachability observation,
baseline/mutant/restored results + replay command (`counterfactuals/*.json`, schema of
spec §6); driver logs carry OBS/PATCH/RESTORE lines (`logs/batch-f/driver-run.log`);
restoration is hash-proven everywhere; the adapter treats INFRA (exit 3) as never-detection
and REDs on missing evidence (`logs/batch-g/acceptance.log` run 2 = the
dispositions-missing RED proof).

Explicit n/a cells: counterfactual-family K4 (above); static-family has no Q3-style
counterfactual because its predicates are syntax-decidable — their sensitivity is proven at
the boundary level instead (`D3-BOUNDARY-Q1`). No Cartesian product is claimed: one
fixture/probe covers one mechanism, per spec §4.

## D011 recovery supersession (2026-10-14, conditional source cycle)

Append-only: the rows above stand as originally accepted; this section EXTENDS the S1
evidence with the coordinator-frozen recovery controls that close the original S1-R1..R4
fault classes against the repaired source. Full mapping + receipts:
[`recovery-d011/README.md`](recovery-d011/README.md); oracle
`scripts/test-assurance/recovery-d011/expectations-recovery.json` (14 arms, patch pins
`sha256(label\nfrom\nto)`); driver `scripts/test-assurance/recovery-d011/driver.mjs`;
mandatory adapter step `recovery-d011` (verify.mjs). Final green run at the R3 boundary:
14/14 arms DETECTED + A2/A3/K3 lanes green + carriers porcelain-clean, EXIT=0
([`recovery-d011/run-final.log`](recovery-d011/run-final.log), sha `3acb5d40…`).

| Recovery family (predicate) | K-slot | Evidence |
|---|---|---|
| GLV invocation/glob/fail-closed/selector/location arms (`SUP-R1-INVOC-GLV`, `SUP-R2-GLV-GLOB`, `SUP-R2-FAILCLOSED`, `SUP-R2-SELECTOR-NAME`, `SUP-R2-ROOT-TESTS-DIR`) | K3 + K6 (selected-but-uncovered never silently clean) | run-final.log arms 1-5 |
| Static-rule permissive/over-rejecting arms (`SUP-R3-Q2-PERM`, `SUP-R3-Q1-OVER`) | K3 / K4 | run-final.log arms 6-7 |
| Executed-conformance arms (`SUP-R3-Q3-PERM`, `SUP-R3-P52-EVAL-OVER`, `SUP-R3-P52-WEAK`) | K3 / K4 / K7 | run-final.log arms 8-10 |
| Delivery/discovery arms (`SUP-R3-P53-DELIVERY-PERM`, `SUP-R3-P53-DISCOVERY-PERM`, `SUP-R3-P53-DISCOVERY-OVER`, `SUP-R3-P53-WEAK`) | K5 / K6 / K4 / K3 | run-final.log arms 11-14 |
| A2 repeatability lane | K7 (idempotent observation: distinct commit parents, byte-identical verdict lines) | run-final.log `A2-OK` |
| A3 pinned classifier replay | K1/K2 over the 13 frozen inputs through the production export | run-final.log `A3-OK` |
| K3 judging control (amended-4) | K3 (the genuine judge refuses wrong-diagnostic + survival credit; the reviewer's exact weakening `f71e2cc8…` caught by the UNCHANGED control; byte-proven restore) | [`recovery-d011/k3-standalone-receipt.log`](recovery-d011/k3-standalone-receipt.log) |

The two RED iterations that preceded the green run are kept as honest records
(`recovery-d011/run-iteration2-RED-discovery-over.log`,
`run-iteration3-RED-k3-wrapper.log`): the first fixed the packet's predicate-form expect
(`mismatches>0`) matching, the second the K3 wrapper's repo-root depth.
