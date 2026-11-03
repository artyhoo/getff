# M09/A10: finite structural assurance

> **Authoritative for:** the original A10 P04 known-no-op and F5 mutation-selection repairs.
> **NOT authoritative for:** general shell semantics, whole-path liveness, mutation scores,
> unchanged historical S1 records, or complete S2/S3/S4 delivery.
> **State:** executed source candidate; independent acceptance and actual application remain separate.

## Original producer identities

The original independent audit identifies F15 at
`packages/core/principles/04-no-tautology.test.ts`, with six exact no-op spellings,
and Q01 at `tests/install-sh/f5-stryker-globs.test.sh`.
The earlier intake's P01/consumer-upgrade/core-config references were investigation leads.
They are not used as substitute producer identities.

Audit SHA-256:
`60ffefdd305cf663a308e8db39b4e41887b8007102f48932ecefd9ba0943ec53`.
The audit explicitly did **not** establish a successful zero-mutant engine execution.
This increment does not upgrade that historical statement into such a result.

## P04: bounded known-spelling contract

The six original command spellings remain the finite grammar.
A single-line command consisting of one known spelling followed by whitespace and a
trailing comment is also a no-op under that grammar.
Quoted hashes, executable compound suffixes and multiline commands keep their existing
structural limits. This is not a general Bash substance or dataflow analyzer.

The production predicate and its original four tests stay in the existing P04 module.
Six literal bad companions and four legitimate alternatives were added before the predicate fix.
The unchanged new tests first reported six intended failures and eight passes.
After the fix, all fourteen pass.

Actual original manifest-gate replay:

| Input | Old P04 real runner | Fixed P04 real runner |
|---|---|---|
| Pristine manifest | 4/4, exit 0 | 14/14, exit 0 |
| Known literal `true` guard | intended rejection, exit 1 | existing literal control retained |
| Known `true # actual enforcement absent` guard | 4/4, exit 0 | one intended manifest rejection, exit 1 |
| Exact restoration | 4/4, exit 0 | 14/14, exit 0 |

The replay adds one scratch-only manifest entry, preserving the original first rule and
the other tests' independent fixtures. The actual manifest is restored byte-for-byte.

The real `runRuleLiveness` export, using its default real subprocess runner, already
returns failure for the comment-suffixed no-op and passes a legitimate
`test ! -f m09-violating-state` guard.
The P04 lexical miss is therefore **not a demonstrated whole delivery-path bypass**.

## F5: actual installed mutation-file selection

Positive glob strings can coexist with `!**/*`.
The old F5 text checks returned PASS=5/FAIL=0 for that configuration while the actual
installed Stryker resolver selected no source from the physical reference project.

F5 now checks the installed configuration against eight physical files covering
`src/`, `lib/`, `apps/*/src/` and `packages/*/src/`, including excluded tests,
an index and a declaration file. Exactly four substantive source files must be selected.

The check reuses the lock-provisioned Stryker engine's actual selection implementation.
It initializes the public module entrypoint before its test-only `ProjectReader` API.
This coupling is explicit: unavailable or changed APIs fail visibly as infrastructure.
There is no fallback matcher, dependency installation, new CI job or additional mutation execution.

The scratch root is canonicalized with `realpathSync` before constructing absolute paths.
That preserves identity across macOS `/var` and `/private/var`.
The existing P52 identity discipline supplies the same precedent.

| Actual installed config | Real selected source paths | Old F5 exit | Fixed F5 exit |
|---|---:|---:|---:|
| Healthy | 4 | 0 | 0 |
| Append all-excluding `!**/*` once | 0 | 0 | 1, intended population diagnostic |
| Exact template restoration | 4 | 0 | 0 |

Every replay records the real installed config path from the actual F5 shell execution.
The installed `mutate` list equals its corresponding source-template input.
Full source/installed snapshots and the resolver's actual physical/selected paths are retained.

This proves resolved-file population and the F5 gate's response.
It does not claim a fresh engine-generated mutant count, mutation score or universal
coverage of every mutation configuration. Root mutation engines retain their existing
local/on-demand scope.

## Checks detect their own narrow regressions

- Reverting only the production P04 decision branch to the six exact spellings makes
  the unchanged fourteen-test suite fail its six intended comment cases; eight other cases pass.
  An independent real named manifest-gate run admits the comment no-op under that fault.
  Its one selected case and thirteen deliberately filtered cases are reported separately.
- Disconnecting only F5's new actual gate invocation makes the all-excluding config
  pass the real F5 process again. The unchanged outer driver then fails its expected-negative
  assertion, even though the actual installed selection remains empty.
- Both production files return to their frozen fixed hashes.
  Normal P04/P50 verification then passes **53/53**, with no skipped cases.
  The final restored F5 process passes **6/6**, including the real four-file selection.

These controls do not delete assertions from the independent outer oracle.
The P04 appended test-body hash, F5 outer driver, selection observer and literal contract
remain fixed throughout their respective checker controls.

## Frozen inputs and retained evidence

[frozen-structural-contract.json](frozen-structural-contract.json) records the literal
negative/positive commands and physical selection expectations.
SHA-256: `6f85c2e468dd00d5c5dc79745f7ef030a3cf77644bd7a20aeb170f1f608ddedc`.

The retained TAK artifact channel stores this mechanism at
`s2-m09-a10/execution-1/`.
These relative artifact locators are not assumed container mounts.

| Locator | Evidence |
|---|---|
| `BRIEF.md`, `BRIEF-GO.json` | immutable delegated brief approval only |
| `P04-REPLAY-ISOLATION-RENEWAL.json` | isolate the scratch manifest entry without weakening expected outcomes |
| `SELECTION-REALPATH-CONTROL-RENEWAL.json` | correct the scratch identity precondition, preserving literal selected paths |
| `original-p04-isolated-entry-replay/` | actual original pristine/literal/comment/restored gate reports |
| `ACTUAL-COMMAND-LIVENESS-COUNTEREVIDENCE.json` | real stronger liveness channel rejects the no-op |
| `p04-new-tests-red/`, `p04-fixed/` | test-before-production six RED cases and fourteen GREEN cases |
| `p04-checker-counterfault/` | actual predicate regression, unchanged test body, independent public-gate reach |
| `fixed-public-p04-gate/` | repaired actual manifest boundary, intended rejection and restoration |
| `f5-controls/before-repair-realpath/` | old real F5 incorrectly admits empty selection; fixed outer contract fails |
| `f5-controls/fixed/` | actual installed healthy/fault/restored exits 0/1/0 |
| `f5-controls/checker-invocation-disconnected/` | actual gate disconnection is detected by unchanged outer replay |
| `FROZEN-PRODUCTION-REGRESSIONS.json` | independent expected failures and exact declared counterfaults |
| `FROZEN-FIXED-CHECKER-POSTIMAGES.json` | fixed/mutated source hashes and unchanged oracle/test-body bindings |
| `normal-restored/`, `f5-final-restored/` | final actual passing affected commands |
| `RAW-EVIDENCE-INDEX.json` | content digests for the retained proof |

Two early partial preparation records remain uncredited:

- `original-p04-replay/` overwrote the first R1, so the intended no-op also masked two
  other tests' fixtures. Its capture rejected the assumed single-failure result and restored
  the exact manifest. The later isolated-entry replay preserves the original expectations.
- `f5-controls/before-repair/` used mixed logical/physical macOS scratch paths and
  obtained no matches even for the healthy config. It is not product RED or empty-mutant evidence.
  The original observer is retained as `observe-installed-selection.before-realpath.mjs`.

The cumulative original M09 budget is **3/3**, with no new authored cycle remaining,
PARTIAL0/2. This candidate finishes the already-active third cycle.
The frozen contract retains its initial prospective count; control renewals and the candidate
record the actual cumulative consumption. No allowance is reset.
Mechanical accepted-source application and delivery remain separate from a new repair cycle.

## Reproduction and scope

From the repository root:

```bash
(
  cd packages/core
  ../../node_modules/.bin/vitest run \
    principles/04-no-tautology.test.ts \
    principles/50-install-rc-asserted.test.ts
)
bash tests/install-sh/f5-stryker-globs.test.sh
```

The source delta contains only P04, F5, this README and the frozen contract.
Templates, mutation configs, policies, historical records and manifests remain byte-identical
in the candidate. No shared/0166 write or private old-manifest projection is authorized.
Existing independent Root25 acceptance, causal integration and normal GLM delivery remain required.
