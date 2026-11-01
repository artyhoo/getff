# M02 / A02 — P38 workflow execution-context repair (preparation report)

> Stage packet: `s2-m02-a02-workflow-context` (brief `f8134ef3…`, GO
> `GO_ORIGINAL_M02_A02_EXECUTION_CONTEXT_PREPARATION_ONLY`). Parent under repair:
> `133fd3ae99e8f2073e33d35a252efba2bec17595` (P38 source sha256 `3eaa6ff3…`, unchanged from
> Root's frozen `24671be0` qualification). This is a PROPOSAL, prepared in an owned clone; the
> real root stayed read-only and no source application or generation ran here.

## Contract

Seed A02 (spec §7): with the sole `test:skills` run replaced by `true` and the old command
retained only as a comment, P38 stayed GREEN — the resolver matched invocation SHAPES as raw
text, so narration (YAML comment, shell comment, echo string, step name) counted as wiring,
while a legitimate backslash-continued npx invocation was mis-read (`\` became a filter and the
continued path was lost).

The repaired contract: **a coverage credit must come from a supported test command in an actual
YAML run step.** Dead context never credits; real inline, block, `if:/then:`-branch,
`|| \`-continued and `VAR=x`-prefixed commands do.

## Change (three tracked paths, one concern)

1. `packages/core/principles/38-vitest-include-ci-coverage.test.ts`
   - `parseCiVitestFilters` now parses each workflow with **js-yaml** (direct devDep of
     packages/core; loaded via `createRequire` — principle 24's pattern, keeps `tsc --noEmit`
     clean without `@types/js-yaml`), selects `jobs.*.steps[].run` strings
     (`runContentsFromWorkflow`), joins backslash continuations (`logicalLines`), drops shell
     full-line comments, splits command fragments on `&&`/`||`/`;`/`|` after quote-stripping
     (`commandFragments`), strips leading `VAR=value` env prefixes, and matches only command
     HEADS for the three supported npm/npx shapes. Quoted argv and redirection tokens are never
     filters. Invalid YAML or unsupported structure credits NOTHING — a contribution claim only
     (arm (f) direction; see the scope section for what that does and does not imply).
   - Arm (c) carriers rewritten from raw `run: …` text lines into valid one-step YAML run
     snippets — SAME semantic assertions and expected filters (`render/`,
     `tests/acceptance/canonical-regen`, `audit-self/first-steps-parity.test.ts`, unknown-script
     `[]`); the hooks-tree-guard negative is untouched. No paired test dropped, no independent
     expected outcome rewritten.
   - Appended arms: `(h0)` fixture binding (sha256 pin + eight frozen IDs), `(h)` it.each over
     the eight frozen cases, `(i)` whole-workflow delivery (healthy cover + frozen replacement
     → all 30 skills files uncovered, expected population bound to the independently frozen
     literal list AND the live `skills/` population).
   - Header: execution-context contract + declared runner reachability scope.
2. `docs/test-assurance-kernel/s2/m02-workflow-context-cases.json` — byte-exact copy of Root's
   frozen fixture (sha256 `16d2499d…`), hash-pinned by arm (h0).
3. This report.

## Evidence (all in the packet's `preparation/` logs)

- **RED before producer change** (`logs-red-p38.json`): old resolver + new tests/fixture —
  17 tests, 11 pass, **6 fail at the intended assertions**: `real-multiline-npx` (`['\\']` vs
  `['skills/']`), `workflow-comment-only`, `shell-comment-only`, `echo-command-string`,
  `step-name-only` (each `['skills/']` vs `[]`), and `(i)` comment-only delivery (missing `[]`
  vs 30). Original seven checks and the three good-shape cases pass. Matches Root's frozen
  actual-context and real-step REDs.
- **Repair green** (`logs-green-p38.json`, `logs-final-green-p38.json`): 17/17.
- **Real-workflow filter reconciliation** (`old-filters-baseline.json` vs `new-filters.json`):
  old 32 → new 28; dropped exactly the four junk tokens `'(issue'`, `'1530'`, `'replay)"'`
  (credited from the step NAME `"Consumer: npx vitest run (issue 1530 replay)"`) and `'\\'`
  (R2 continuation backslash); **added: none** — no real form became unsupported, none newly
  credited. Full run-step enumeration first: 382 run steps across the real workflows
  (`enum-run-steps.json`), every npm/npx/vitest-bearing shape (94) inspected.
- **K3 permissive regression** (`logs-k3-p38.json`): only the resolver body swapped back to the
  exact old raw-line implementation, new tests/fixture/population unchanged → the same 6
  intended failures return; old seven stay green (including the rewritten YAML-snippet
  carriers). Fresh vitest process; restored byte-exact afterwards.
- **K4 over-rejecting fault** (`logs-k4-p38.json`): fault refuses legitimate directory filters
  (tokens ending `/`) → caught by 9 good assertions: (a), (b), (c), (d), three real good
  cases, `real-multiline-npx`, (i) healthy direction. Restored byte-exact (sha `effd845e…`,
  `logs-final-green-p38.json` 17/17); the subsequent deterministic prettier pass produced the
  shipped bytes (sha `8b3de10f…`), re-checked green 17/17
  (`logs-postformat-green-p38.json`).
- **Actual file-level delivery fault** (`logs-filefault-p38.json` + `audit-self-faulted.yml`):
  the exact frozen replacement applied to the owned clone's `audit-self.yml` on disk → real
  suite exit 1, arm (a) reports `skills/ — 30 file(s)` (20 listed + "and 10 more" — the full
  frozen population, not an empty parse error); arms (d)/(i) also RED in the fail-closed
  direction. Workflow byte-restored to `b112bd88…` (`pristine/audit-self.yml.b112bd88`),
  suite green again (`logs-restored-green-p38.json`).
- **Checks**: prettier `--check` clean after one deterministic `--write`
  (`logs-format-write.txt`, suite re-green `logs-postformat-green-p38.json`); targeted
  P50 39/39 (`logs-p50.json`), P51 10/10 (`logs-p51.json`), `tsc --noEmit` exit 0
  (`logs-typecheck.txt`). Runtime/dist regeneration and MANIFEST untouched (HELD for the
  renewed generation step, per brief).

## Declared runner reachability scope and remaining limits

Certified here: the three npm/npx invocation shapes, reachable as command heads of bash run
steps — inline `run:` strings, block scalars, `if:/then:` branch lines, backslash-continued
argv (quoted spans excluded), `VAR=value`-prefixed heads, `&&`/`||`/`;`/`|` fragment splits —
and, since correction 1, the package.json script-body boundary: shapes 1-2 credit a body only
through its own actual `vitest run` command heads (the same pipeline), and `npm … test --
<args>` passed args are credited only when the `test` body itself runs Vitest.

NOT certified — and no direction is claimed for them: command substitution `$(…)` bodies,
bare `vitest` / `node_modules/.bin/vitest` invocations, composite or remote actions behind
`uses:`, reusable workflow templates, `working-directory:` path rebasing, heredoc bodies,
general shell control flow and quoting constructs are not parsed, and their effect on credits
is not established in either direction. An invalid or unrecognized workflow contributes no
credits, but duplicate valid workflows may still cover the same files, so one workflow's
missing credits alone neither forces a global RED nor validates that workflow's correctness.
Declared supported syntax is a finite lexical workflow-run scope, not a universal execution
claim; extending it requires a new frozen case set exactly as this repair and its correction 1
did.

## Correction 1 — script-body execution context (M02-R1/R2/R3, 2026-10-14)

Root's independent review (`M02-PROPOSAL-REVIEW-REVISE.json`, verdict REVISE) found three
defects in the base proposal `bf0196d5` and froze the supplemental expectations
(`FROZEN-SCRIPT-BODY-CONTEXT-CASES.json`, sha256 `d10fc2c6…`) before this correction ran:

- **M02-R1 — script-body boundary.** The producer still matched `vitest run` UNANCHORED inside
  package.json script bodies: `echo vitest run skills/` and `# vitest run skills/` bodies
  credited `skills/` exactly like the real body. Root's receipt on the unchanged source:
  18 pass / 2 intended failures. Fix: a script body is resolved through the SAME
  logical-line / command-fragment / env-prefix pipeline a workflow run step gets
  (`scriptBodyVitestArgv`) — only an actual `vitest run` command HEAD contributes its argv,
  and in the `npm … test -- <args>` branch the passed args are credited only when the `test`
  body itself runs Vitest (the args reach Vitest only through that script). The npx branch is
  untouched. Supplemental arms `(j0)`/`(j)` pin the frozen fixture sha and the three frozen IDs
  (`real-vitest-script-body`, `echo-only-vitest-script-body`,
  `comment-only-vitest-script-body`) through the same exported resolver.
- **M02-R2 — scope over-claims.** The "each limit fails toward under-crediting — RED, never a
  silent pass" direction claim is removed: unsupported constructs are not parsed and their
  effect on credits is not established in either direction; an invalid/unrecognized workflow
  contributes no credits, but duplicate valid workflows may still cover the same files, so
  that alone neither forces a global RED nor validates the workflow. Corrected in the source
  header (`runContentsFromWorkflow` doc, declared-limits block) and in this doc.
- **M02-R3 — invented diagnosis retracted.** The base packet report's
  `s-readonly-prerequisites` "locator typo" claim is RETRACTED: the frozen f813 brief carries
  the correct absolute `s2-readonly-prerequisites/…` path (verified this correction: exactly
  one occurrence, no `s-` form anywhere in the brief). The base report stays immutable per the
  correction brief; this section is the correction of record.

### Correction 1 evidence (raw logs in the packet's `correction-1/preparation/`)

- RED on the unchanged producer (base-proposal bytes `8b3de10f…`) with the appended
  supplemental material: 21 tests, 19 pass / exactly the 2 frozen bad credits failing —
  matching Root's independent receipt.
- Repair green: 21/21 (`logs-green-scriptbody.json`).
- Regression proof (`logs-k3-scriptbody.json`): ONLY the script-body decision swapped back to
  the old unanchored matching (both npm branches; faulted copy retained), tests/fixture fixed
  → the same 2 failures return, 19 good controls pass. Byte-restored from the snapshot
  (`962f42fd…`) and re-green 21/21 (`logs-restored-green.json`).
- No real-workflow drift: the corrected resolver's real filter set is byte-identical to the
  pre-correction set (28 filters; `new-filters-after-scriptbody.json`, diff empty). All 13
  real vitest-bearing package.json bodies are plain `vitest run …` heads.
- Checks: prettier `--check` clean with no write pass, `tsc --noEmit` exit 0, P51 10/10. The
  K4 over-rejecting proof and the whole-workflow 30-file delivery fault proof from the base
  proposal are reused unchanged — their targets (token filtering, workflow-level delivery) are
  untouched by this correction, and arm (i) re-passed inside every 21/21 run above.

### Correction 1 tracked scope

Four paths, one concern: the P38 test (producer correction + supplemental arms), the original
frozen workflow-context fixture (bytes unchanged, `16d2499d…`), a byte-exact copy of the
Root-frozen script-body fixture (`d10fc2c6…`), and this report. No workflow edits, no test
expectation co-fixing, no new exported API, no dependency change; the base proposal `bf0196d5`
and every base artifact remain in place, unmodified.

## Correction 2 — npx executable identity (M02-C1R1, 2026-10-14)

Root's review of the correction-1 proposal (`M02-CORRECTION1-REVIEW-REVISE.json`, verdict
REVISE — npx executable identity ONLY) confirmed the npm script-body and passed-argument gates
as fixed and accepted, and found the remaining defect in the third supported branch: the npx
arm anchored only the `npx` head and then searched `vitest run` anywhere in the remaining
argv. Root's live control (`ACTUAL-OTHER-NPX-CLI-CONTROL.json`): `npx --prefix packages/core
--no-install eslint --version vitest run skills/` — a real installed unrelated CLI — exits 0,
prints `v10.4.0`, executes NO Vitest, while the resolver credited `skills/`.

Fix: the npx branch resolves the actual EXECUTABLE. Only the option forms present in the real
382-step workflow enumeration are recognized — value-taking `--prefix <dir>` and standalone
`--no-install`; the first remaining token is the executable, and only `vitest` followed by
`run` credits the trailing argv. Another CLI (eslint, echo) with Vitest-looking arguments
credits nothing; unrecognized forms claim no credit and no broad semantics are invented for
them. No new helper, dependency, recursion or exported API; npm branches and all 21 prior
assertions are byte-preserved in behavior. Supplemental arms `(k0)`/`(k)` pin Root's frozen
all-branch fixture (`ad886c44…`, five IDs — including the echo-only npm-test guard and the
live eslint control) through the same exported resolver.

### Correction 2 evidence (raw logs in the packet's `correction-2/preparation/`)

- RED on the unchanged correction-1 producer (`962f42fd…`) with the appended all-branch
  material: 27 tests, 25 pass / exactly the 2 frozen npx false credits failing — matching
  Root's independent receipt (its 26-test external harness: 24 pass / 2 fail; mine adds the
  passing fixture-hash binding).
- Repair green: 27/27 (`logs-green-npx.json`).
- Localized K3 (`logs-k3-npx.json`): ONLY the npx decision reverted to the old broad
  `npx`-head + unanchored `vitest run` lookup, tests/fixture fixed → the same 2 failures
  return, 25 good controls pass. Byte-restored, re-green 27/27
  (`logs-k3-npx-restored-green.json`).
- Passed-args-gate regression (`logs-arggate-fault.json`): ONLY the correction-1
  passed-args gate removed from the `npm test` branch → exactly ONE intended bad assertion
  fails, the frozen `echo-npm-test-body-must-not-credit-passed-args` case — the guard the
  earlier three-case body corpus did not exercise. Byte-restored, final full green 27/27
  (`logs-final-green.json`, `logs-postformat-green.json`).
- No real-workflow drift: the corrected resolver's real filter set is byte-identical to the
  correction-1 set (28 filters; `new-filters-after-npx.json`, diff empty) — `--prefix`,
  `--no-install`, command prefixes, trailing slashes and reporter flags all preserved.
- Checks: prettier `--check` failed on one deterministic spot (a long `while` condition) →
  one `--write` pass → re-checked clean, suite re-green 27/27 on the shipped bytes
  (`9a97003e…`; the pre-format state `5a8b86e6…` and every faulted copy retained);
  `tsc --noEmit` 0; P51 10/10.
- Reused unchanged from earlier proposals: K4 over-rejecting proof and the whole-workflow
  30-file delivery fault proof (their targets untouched; arm (i) green in every run).

### Correction 2 tracked scope

Five paths, one concern: the P38 test (npx-branch correction + all-branch arms), the three
prior docs/fixture paths (bytes unchanged: `16d2499d…`, `d10fc2c6…`, report updated by this
section), and the byte-exact copy of the Root-frozen all-branch fixture (`ad886c44…`).

## Correction 3 — finite npx option profile (M02-C2R1, 2026-10-14)

Root's review of the correction-2 proposal (`M02-CORRECTION2-REVIEW-REVISE.json`, verdict
REVISE — finite-profile conformance ONLY) confirmed the executable-identity direction and found
the remaining defect inside it: the traversal SKIPPED every dash-prefixed token and let
`--prefix` consume ANY next token, so the code's own finite-profile claim was violated.
Root's live controls (`ACTUAL-NPX-NONEXECUTION-MODE-CONTROLS.json`,
`CORRECTION2-IMMUTABLE-NPX-MODE-RESULTS.json`): `npx --prefix packages/core --help vitest run
skills/` and `… --version …` exit 0 printing npm help / `11.4.2`, executing NO Vitest, while
the resolver credited `skills/`; `npx --prefix --help vitest run skills/` consumed `--help` as
a prefix value the same way.

Fix: the option traversal now enforces the finite real profile from the workflow enumeration —
value-taking `--prefix packages/core` (exact value) and standalone `--no-install`, any supported
order, plus the no-option `npx vitest run` form. Any other dash token, a non-executing mode
(`--help`, `--version`), a delimiter, an incomplete or option-valued `--prefix` argument, or a
different executable credits nothing; no semantics are claimed for unrecognized forms. Same
token traversal, no generic option parser, no new dependency/export/API; every prior branch and
assertion is behavior-preserved. Supplemental arms `(l0)`/`(l)` pin Root's frozen option-mode
fixture (`d81f52e7…`, five IDs — the two live non-execution controls, the missing-prefix-value
negative, and the two real positive forms) through the same exported resolver.

### Correction 3 evidence (raw logs in the packet's `correction-3/preparation/`)

- RED on the unchanged correction-2 producer (`9a97003e…`) with the appended option-mode
  material: 33 tests, 30 pass / exactly the 3 frozen false credits failing (help, version,
  missing-prefix-value) — matching Root's independent receipt (its 32-test external harness:
  29 pass / 3 fail; mine adds the passing fixture-hash binding).
- Repair green: 33/33 (`logs-green-npxmode.json`).
- Localized K3 (`logs-k3-npxmode.json`): ONLY the option traversal reverted to the exact prior
  permissive skip-all/missing-value behavior, tests/fixture fixed → the same 3 failures return,
  30 good controls pass. Byte-restored, final green 33/33 (`logs-final-green.json`).
- No real-workflow drift: the corrected resolver's real filter set is byte-identical to the
  correction-2 set (28 filters; `new-filters-after-npxmode.json`, diff empty; re-verified
  post-format `new-filters-postformat.json`) — both real `--prefix packages/core` /
  `--no-install` forms keep full credit.
- Checks: prettier `--check` failed on one deterministic spot (the `--prefix` condition
  exceeded print width) → one `--write` pass → re-checked clean, suite re-green 33/33 on the
  shipped bytes (`19d8d0d9…`; the pre-format state `0b7ed392…` and the faulted copy retained);
  `tsc --noEmit` 0; P51 10/10.
- Reused unchanged from earlier proposals: K4 over-rejecting proof, the whole-workflow 30-file
  delivery fault proof, the passed-args-gate regression (their targets untouched; arm (i) and
  the corpus arms green in every run).

### Correction 3 tracked scope

Six paths, one concern: the P38 test (option-profile correction + option-mode arms), the four
prior docs/fixture paths (bytes unchanged: `16d2499d…`, `d10fc2c6…`, `ad886c44…`, report
updated by this section), and the byte-exact copy of the Root-frozen option-mode fixture
(`d81f52e7…`).

## Counters and scope holds

M02 authored iterations: **4/5 used** (preparation + corrections 1-3; no PARTIAL continuation
spent). M10 1/5, M05 3/3, P51 4/5, GLV 2/5, SPA 3/5, intake 4/5, M15 3/5, AIF 2/2 — unchanged;
no resets. No native/public/staging/main/push/PR/install effect; builder clone, probe and every
intermediate artifact retained in place. Remaining open: Root review of the correction-3
proposal, source application and renewed generation, the other 325 P50 candidates, full S2
population/S3/S4 and public/native delivery.
