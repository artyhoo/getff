# M14: bounded assurance for the governed module and export

> **Authoritative for:** this S2 wrong-import mechanism, its frozen contract and bounded proof.
> **NOT authoritative for:** general import correctness, historical S1 oracle classifications,
> whole S2/S3/S4 acceptance, or integrated/installed delivery.
> **State:** executed source candidate; independent acceptance and actual source delivery are separate.

## Observable contract

The governed subject is the existing frozen `delivered.ts#formatStamp` fixture.
The bad companion imports the distinct `lookalike.ts#formatStamp` and only checks the epoch.
The correct companion imports the delivered module and additionally checks the next day.

A reached fault makes the delivered implementation always return the epoch.
The unchanged bad companion survives; the unchanged correct companion fails its next-day assertion.
Existing P52 executed conformance therefore rejects a sensitivity claim for the bad test and admits
the good companion. A fresh direct import of the explicitly governed export observes both input
literals before, during and after the fault.

This certifies the explicit module/export and non-equivalent fault. It does not determine arbitrary
import ownership or infer semantic coverage from syntax. Other semantic cases retain named review.
The historical S1 static matrix and its honest review admission remain unchanged.

## Reused mechanism and source delta

Reuse decision: ADAPT the existing P52 executed-conformance harness and
[S1 prior-art area (b)](../../s1/prior-art.md), referencing existing SSOT226/184.
There is no new dependency, registry, AST/dataflow analyzer, runner or orchestration platform.

The existing `ScenarioSpec` gains optional imported support files.
`buildScratch` copies them verbatim alongside selected cases; only `cases` become runner filters.
This lets the two actual test files resolve their real subject/helper modules without selecting
those modules as tests. Missing support files use the existing fail-closed copy precondition.
Existing scenarios without support files keep their previous behavior.

The existing P52 companion contains one new M14 gate. It reuses `runVitest`,
`applyCounterfactual`, `observe` and `evaluateExecutedExpectation`.
The independently frozen contract is
[frozen-wrong-import-contract.json](frozen-wrong-import-contract.json).
Its SHA-256 is `27fbcea0e3459a0afb65944ad36812e9b485be889835d78cf5e0d8224905dee3`.

Only four source paths belong to this candidate:

- `packages/core/principles/52-subprocess-status-conformance.ts`
- `packages/core/principles/52-subprocess-status-conformance.test.ts`
- this README
- the frozen contract

No original corpus, expectation, test-quality policy or historical record is rewritten.
Updating the complete S2 disposition/acceptance assembly remains its own original obligation.

## Actual module/export proof

| Phase | Real Vitest exit | Bad companion | Correct companion | Direct delivered export at day one |
|---|---:|---|---|---|
| Baseline | 0 | pass | pass | `1970-01-02T00:00:00.000Z` |
| Delivered fault | 1 | pass | intended comparison failure | `1970-01-01T00:00:00.000Z` |
| Exact restore | 0 | pass | pass | `1970-01-02T00:00:00.000Z` |

The fault replaces `return new Date(ms).toISOString();` with the literal epoch return
exactly once in the scratch delivered module. The recorded patch digest is
`63d7b41004a15d90297ccfb6946fd02d4357d89b67c898fc7bce6d6d815ef7f7`.
The bad/good test files and lookalike module remain byte-identical throughout.
All four restored files equal their baseline hashes.

A test added before the production helper extension first failed the specific assertion
that the governed module must be materialized. No child behavior was credited in that RED arm.
An earlier command used the wrong runner working directory and found zero tests.
That record is retained as incomplete execution, never detection or an intended regression.

## Checker and invocation controls

The new outer gate and its literal oracle were frozen before faulting the existing checker.

| Actual fault | Independent export observation | Unchanged M14 gate | Fixed outer driver |
|---|---|---|---|
| Admit every baseline pass | Surviving bad case incorrectly receives admission | intended bad-admission assertion fails | exit 1 |
| Reject all admission claims | Correct killed fault incorrectly loses admission | intended good-admission assertion fails | exit 1 |
| Skip the M14 gate invocation | Real runner records M14 pending/skipped | no executed M14 case | exit 1 despite Vitest exit 0 |

The first two faults alter only the existing evaluator's admission predicate.
Fresh direct calls to its real export prove the changed decisions.
No expectation, corpus or M14 assertion is weakened.
The third fault changes only the real gate's `it` invocation to `it.skip`;
the unchanged driver requires exactly one executed, passing M14 case.

The fixed producer and gate hashes are restored afterward.
The normal affected P52/P53 invocation then passed **29/29**, with no skipped cases.
Filtered control runs intentionally leave the other fifteen P52 cases unexecuted;
those filtered runs do not certify the older suite.

## Assurance scope

| Obligation | Evidence for this bounded mechanism |
|---|---|
| K1 | Correct companion passes real baseline and exact restoration |
| K2 | Surviving bad case cannot receive a sensitivity admission; real good kill has the intended date assertion |
| K3 | Permissive checker fault is reached and detected by the unchanged new gate |
| K4 | Over-rejecting checker fault is reached and detected through the correct companion |
| K5 | Actual core principle runner executes the new gate; disconnected invocation cannot satisfy its fixed driver |
| K6 | Two intended files are present in real reports; missing/empty/incomplete execution receives no green credit |
| K7 | Full phase reports, module snapshots, exact patch, direct export probes and restoration hashes retained |

The existing broad discovery and S1 matrix evidence is reused within its accepted scope.
This increment does not replay or recertify every older K-family/runner combination.
It does not claim unmeasured performance improvement or complete program delivery.

## Reproduction

From the repository root, execute the real new gate:

```bash
(
  cd packages/core
  ../../node_modules/.bin/vitest run principles/52-subprocess-status-conformance.test.ts -t 'M14:'
)
```

Run the affected existing mechanisms without filtering:

```bash
(
  cd packages/core
  ../../node_modules/.bin/vitest run \
    principles/52-subprocess-status-conformance.test.ts \
    principles/53-delivery-discovery-conformance.test.ts
)
```

The first command selects one new gate. The second runs 29 affected tests.
Their internal expected counterfactual failures are inspected through real reports;
the restored normal run exits zero.

## Retained raw evidence and limits

The existing task artifact channel stores this mechanism at
`s2-m14-wrong-import/execution-1/` under the retained TAK output bundle.
These are relative artifact locators, not assumed container mounts.

- `BRIEF.md` and `BRIEF-GO.json`: immutable delegated brief approval only.
- `unit-red/`: first empty-discovery infrastructure record; zero executed cases.
- `unit-red-correct-root/` and `unit-red-final-test/`: intended materialization RED before production change.
- `unit-green/`: first actual new-gate pass.
- `actual-binding-proof.mts` and `actual-binding-proof/`: real subject fault, direct probes,
  full three-phase Vitest JSON reports, file snapshots, patch and actual assurance verdicts.
- `FROZEN-CHECKER-CONTROLS.json` and `run-selected-gate.py`: immutable permitted fault inputs
  and fixed outer execution contract.
- `gate-controls/{baseline,permissive-admission,over-reject-admission,invocation-disconnected}/`:
  actual argv/cwd/streams/exit, raw reports, classifier results and direct checker probes.
- `normal-checks/`: final restored P52/P53 report and real command receipt.
- `RAW-EVIDENCE-INDEX.json`: digests binding the retained evidence to this source candidate.

P52's existing API returns a stdout tail. The binding proof retains that actual value,
full JSON reports and complete direct-probe streams; it does not invent unavailable full
nested Vitest console streams.

Child RED results and their enclosing capture commands are distinct.
The early Python capture commands returned normally while retaining the actual child exit1.
The fixed checker-control driver itself exits1 on failed or unexecuted M14 assurance.

M14 conservatively uses 2/5 original iterations, remaining3, PARTIAL0/2.
The initial working-directory correction is counted; no allowance is reset.
All other original mechanism counters, R4 contracts and RN manual qualifications remain unchanged.

The isolated source candidate is based on `ea13c954eac30cd20c3dc2c281de7c9b1eb16fb6`.
Root25 independently accepted its preceding M04 causal generation.
Shared source integration and causal derived writes require fresh serial custody through the existing
integration/sole0166 owner. A private old manifest is never a current target reservation.
