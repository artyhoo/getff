# M07/A07: explicit advisor status and current finding retirement

> **Authoritative for:** one explicit real-result assertion and its current P51 finding retirement.
> **NOT authoritative for:** new CLI behavior, a generic helper recognizer, frozen-history changes,
> broad runtime coverage or complete S2/S3/S4 delivery.
> **State:** executed source candidate; independent acceptance and source application are separate.

## The existing helper already checks real status

The path-validation test at `tests/advisor-bridge-beta/protocol.test.mjs:309` calls
the module-local `cli()` helper with `expectCode: 4`.
That helper executes the actual advisor CLI with `execFileSync`, captures native child status,
asserts it against the expected code and returns the same `{ code, out, err }` result.
Its default expected status is zero. Neither the helper nor the CLI is changed here.

The original test is a legitimate helper assertion that Q2's finite syntax cannot see.
This repair binds the actual traversal result and adds `assert.equal(traversal.code, 4)`.
It exposes the already-required outcome in supported direct syntax.
It does not repair an ignored exit code or claim additional behavioral coverage.
No helper-name exemption, dataflow analyzer, rule/configuration change or dependency is added.

## One ordinary finding leaves the current set

Actual ESLint originally reported exactly one Q2 finding at the test declaration.
The repaired real file reports none.
With only the protocol repair applied, the unchanged P51 suite intentionally fails:
the observed population has 21 findings while the before-repair expected set contains 22.
The other nine P51 cases pass, including the static corpus and frozen-input checks.

The existing historical array contains twelve legacy identifiers; the frozen S2 supplement
adds ten intentional fixture findings. Both remain byte-for-byte unchanged.
P51 now filters exactly the repaired ordinary advisor identifier from its **current** expected
set before appending the same ten fixture findings. All other identifiers remain strict.
No scalar baseline, generic retirement registry or fixture exemption is introduced.

| Actual boundary | Before repair | After repair |
|---|---:|---:|
| Advisor file Q2 findings | 1 | 0 |
| Current named-population expected findings | 22 | 21 |
| Historical legacy identifiers | 12 | 12, unchanged |
| Frozen additional intentional fixture findings | 10 | 10, unchanged |
| P51 after protocol repair | 9 passing, 1 stale-current-pin failure before retirement | 10 passing after exact current retirement |

The earlier proposal's 13-to-12 arithmetic is historical and is not the actual current population.

## Actual controls and exact restoration

The frozen outer driver executes the real ESLint file command and the actual named P51
population-ratchet case. It does not substitute a synthetic matcher for either boundary.
Each control intentionally selects one P51 case; the other nine are filtered and are not
reported as executed by those control runs.

| Input phase | Actual ESLint exit | Fixed actual P51 exit |
|---|---:|---:|
| Repaired baseline | 0 | 0 |
| Exact original wrapper-only test shape | 1, the original Q2 finding at 309 | 1, unexpected ordinary finding |
| Exact repaired restoration | 0 | 0 |

The unchanged outer contract passes this sequence with exit zero.
A separate checker control changes only the actual P51 comparison from
`expect(findings).toEqual(expected)` to `expect(findings).toEqual(findings)`.
With that permissive checker, the same actual wrapper-only phase still reaches the Q2
finding and ESLint exits one, but the actual P51 case incorrectly passes.
The unchanged outer contract detects that admission and exits one.
Both the protocol test and the P51 comparison return to their exact fixed hashes.

The actual repaired Node protocol command passed **53/53**, with no failures or skipped cases.
It uses the real advisor CLI and the existing controlled local fixtures, without a model launch.
That full-run receipt is reused after exact byte restoration; it is not presented as a second run.
Final affected verification executes the full P51 suite, including its unchanged thirty-case
static corpus and the real Git-backed named population, with ten passes and no skips.
Existing accepted P52 subprocess-family evidence remains separately scoped.

## Frozen inputs and evidence

[frozen-advisor-assertion-contract.json](frozen-advisor-assertion-contract.json) freezes
literal status four, target finding, expected counts and the initial source snapshots.
Its `unchanged_inputs` property retains **before-repair snapshots** for the two explicitly
editable source files. That historical property does not prohibit their declared repair.
The actual CLI, frozen S2 population supplement and S1 expectations remain protected inputs.

| Content | SHA-256 |
|---|---|
| Repaired protocol test | `6052c0f887152b55677655e7c1a1749b6df12efa8c7153c6ef40290d3ec584cd` |
| Repaired P51 | `4bbb552fbacd360f3d66f94bf1c2a7535acadcbeed3af4cce819d29d34b96e79` |
| Unchanged historical pin-array block | `d527382310e6781597a979fb8553eac7065f0c0968cf05252df33bc38015b491` |
| Unchanged actual advisor CLI | `eaeb0831100c3d7bf29ce2f02e50da9e65ba8db04f504d35511ad07045d79651` |
| Unchanged S2 supplement | `50f2b0479a8cb16c2de666c6c71ea4ace65c6cb4400986dfc6df1d06eaa572c6` |
| Unchanged S1 expectations | `069d2a70165ba84e6e71157350c1d2324a69f83fd8fc58586524e3e5de525978` |
| Frozen literal contract | `dba33670ac7850017faff978df1d20cad82a87a1ad87b1680cde35ae04028a6e` |

The retained TAK evidence channel contains this mechanism at `s2-m07-a07/execution-1/`.
These relative locators do not imply a container mount.

| Locator | Evidence |
|---|---|
| `BRIEF.md`, `BRIEF-GO.json` | Exact delegated product-brief approval, separate from implementation acceptance |
| `lint-before/`, `lint-repaired/` | Real target Q2 finding before repair and clean result after repair |
| `p51-stale-current-pin-red/` | Intended exact one-stale-pin failure, nine other cases passing |
| `p51-fixed/` | Ten actual passing P51 cases after narrow current retirement |
| `actual-node-protocol/` | Actual Node protocol command, 53 passing, no skipped cases |
| `FROZEN-RETIREMENT-CONTROLS.json` | Fixed driver, source hashes, exact inverse and checker fault |
| `retirement-controls/fixed/` | Real lint/P51 sequence 0/1/0 and outer exit zero |
| `retirement-controls/checker-permissive/` | Actual permissive P51 admits the reached finding; unchanged outer exit one |
| `normal-restored/` | Final affected verification after exact source restoration |
| `RAW-EVIDENCE-INDEX.json` | Content-bound raw evidence index |

The cumulative original M07 counter is **1/3**, with two authored cycles remaining,
PARTIAL0/2. M12/P51's separate original 4/5 and all other mechanism counters remain unchanged.
No new actor, model session, paid probe, shared derived write or target installation is included.

## Reproduction

From the repository root:

```bash
node --test tests/advisor-bridge-beta/protocol.test.mjs
(
  cd packages/core
  ../../node_modules/.bin/vitest run principles/51-test-quality-corpus-conformance.test.ts
)
```

Only the protocol test, P51, this README and the literal contract change in the candidate.
Existing independent Root25 acceptance, causal manifest delivery, normal GLM PR/CI/staging
and compatible target acceptance retain their original gates.
