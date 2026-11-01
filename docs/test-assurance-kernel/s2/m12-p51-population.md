# S2 M12-P51 — named test population (CAND-101 selector/carrier narrowing)

> **Seam (one only):** the P51 sweep population selector + its lint-config carrier in
> `packages/core/principles/51-test-quality-corpus-conformance.test.ts`. No other M12 seam
> (SPA applicability, GLV parse errors, advisor runner registration, other languages,
> semantic p1/p2/p3/p6) is touched by this record. The independently frozen population data
> (`51-test-quality-population-s2.expected.json`, sha-pinned in the principle) is INPUT —
> never revised to match an implementation.

## What was wrong (before-repair state, frozen as evidence)

- **Selector gap** — `trackedTestFiles()` ran `git ls-files` with four glob patterns
  (`*.test.ts *.test.tsx *.test.mjs *.spec.ts`) and split the output on `\n`. That missed
  every `.mts/.cts/.cjs/.js/.jsx` spec variant, all `.unit/.audit/.integration` files, and
  every lintable `__tests__` path — 378 legacy-selected files against a required named
  population of 399 (21 added cases invisible), and newline-splitting would corrupt any
  future path containing a newline.
- **Carrier gap** — the flat-config `files` globs lacked `**/*.mts` and `**/*.cts`, so those
  filenames matched NO config block: ESLint applied no rules and produced no messages — a
  silent no-coverage channel, not an error.

## The repair (minimal, two predicates + one append)

1. **Selector** — NUL-safe realGit enumeration (principle-41 pattern: `ls-files -z` +
   `split('\0')` + 64 MiB buffer) filtered by the declared named scope:
   `.(test|spec|unit|audit|integration).(ts|tsx|mts|cts|mjs|cjs|js|jsx)` plus lintable
   `__tests__` paths. The population is derived from CURRENT realGit on every run.
2. **Carrier** — `files` globs extended with `**/*.mts` and `**/*.cts`.
3. **Ratchet append** — baseline is now the 12 S1 pins (bytes unchanged) PLUS the 10
   additional frozen fixture findings loaded from the supplement — exact on both sides,
   as before. The 30-case corpus and its verdicts are untouched.

## Decision: baseline counts are before-repair evidence, NOT a whitelist

`legacy_count: 378`, `required_named_count: 399`, `baseline_git_tracked_count: 4133` are
frozen as evidence of the repair boundary. Nothing in the production predicates compares a
live count to them: a new legitimate tracked test file is classified and linted (admitted if
clean), a new bad one fails the ratchet by name — proven live by probe R1 (an index-tracked
`probe with space.bad.test.mts` — space preserved, NUL-safe — RED'd the ratchet as a new
finding at its exact `path:line`, then restoration returned green; the same file untracked
was invisible, which is the honest realGit boundary: the population is the tracked tree, not
the working directory).

## Evidence (this packet; full logs in the stage artifacts, not re-run here)

- **First RED (test material before predicate change):** with the old selector/carrier still
  in place, the new frozen-expectation arms failed 4/11 — named membership (21 paths
  listed), class-coverage non-vacuity (no `.mts` selected), carrier coverage
  (`bad.vacuous.test.mts/.cts` fired `[]`), ratchet (12 findings vs 22 expected, the 10
  additional listed). Supplement-integrity arm was already green (byte-pinned, fixtures
  hash-exact on disk).
- **After the repair:** 10/10 green; core `tsc --noEmit` clean.
- **Causal controls (each RED for its own reason, each restored byte-proven, each green on
  rerun):** C1 selector narrowed back to the 4-pattern form → membership RED naming the 21;
  C2 carrier globs dropped → exactly the `.mts`/`.cts` pair fired `[]` vs frozen; C3
  supplement emptied → module-load refusal (`sha256 e3b0c442… != pinned`, zero tests run);
  C4 supplement altered by one value → same refusal (`sha256 dbbad10a… != pinned`).

## Honest limits

- **Static lane only.** The carrier arm checks the frozen Q1/Q2 verdicts (reject at the
  frozen line, admit otherwise). `template-render.audit.ts` is admitted because its
  callbacks contain direct `expect` over inputs — syntax-level admission, NO behavioral
  certification of the audit or of any admitted test (unchanged S1 claim;
  `s1/honest-limits.md` still governs).
- **The supplement binds bytes, not semantics.** The sha pin refuses any drift of the frozen
  JSON; re-freezing (new population decisions) is an explicit future decision with a new
  pinned sha, never a silent edit.
- **Fixture immutability is inherited, not duplicated.** The D011 fixtures are hash-pinned
  by `recovery-d011/expectations-recovery.json`; this principle additionally binds every
  added case's on-disk sha to the supplement, so fixture drift fails here too. The fixtures
  are frozen evidence artifacts — deliberately bad, never repair targets.
- **Untracked files are out of population by design** (realGit semantics above); the sweep
  reads the tracked index, not the working tree.
- **Scope of this record:** CAND-101's P51 seam only. Helper-file and other-language lanes,
  the S2 semantic seams, and M01–M15 successors are separate decisions; nothing here
  certifies them.

## Correction round 1 (independent review `5ea4655e` — REVISE_BEFORE_SOURCE_EFFECT)

The first proposal packet (plumbing commit `640f1804e6d7`, preserved immutable) was reviewed
independently against live counterexamples. Three findings, all in the SAME three P51 paths;
the frozen supplement JSON (`50f2b047…`) is unchanged and the S1 pins/corpus are untouched.
Sections above are the candidate-round record; where a claim below says «supersedes», that
claim is the current truth.

### F1 — `__tests__` scope was not recursive; NUL names must survive verbatim

- **Before (candidate):** `LINTABLE_TESTS_DIR_PATH` used `[^/]+` between the directory and
  the filename, so `__tests__/<subdir>/x.test.ts` — a legitimately nested lintable test —
  was excluded, while the brief's declared scope is ALL lintable `__tests__` descendants.
- **After:** `/(^|\/)__tests__\/.+\.(ts|tsx|mts|cts|mjs|cjs|js|jsx)$/` — recursive, one
  segment or many. Enumeration stays NUL-safe end-to-end (`ls-files -z` → `split('\0')`):
  no trimming, no shell quoting, so a path containing a newline, a space, or Unicode is
  selected verbatim (probe N1: `__tests__/nested/weird naïve\nline ünïcode.bad.test.mts` —
  a literal newline, spaces and Unicode inside the filename, under a NESTED `__tests__`
  subdirectory — is selected by exact byte path and refused as a new finding at its exact
  `path:line` when bad).
- **Live:** nested bad (`__tests__/nested/bad.ts`, vacuous assertion) REDs the ratchet by
  exact `path:line`; nested good (`__tests__/nested/good.ts`, real expect over input) is
  admitted; the candidate selector had missed both (miss log reproduced).

### F2 — selected-but-unconfigured files must REFUSE, not silently pass

- **Before (candidate):** a file the selector selects but the lint config ignores (the live
  counterexample: a staged `node_modules/bad.actual.test.mts`) fell through as "selected,
  zero messages" — a scalar-zero success, which is a silent no-coverage channel exactly like
  the carrier gap this repair exists to close.
- **Diagnosed from the real invocation, not assumed:** on the installed ESLint of this tree
  (v9.39.4), linting such a file yields exactly ONE message — `ruleId: null`, `severity: 1`,
  `fatal: false`, `line: 0`, message text `No matching configuration found for <filename>.`
  (diagnosis log in the packet). The corrected sweep matches that exact shape
  (`/^No matching configuration found for /` + `ruleId == null`) and returns a coverage
  ERROR naming the file — a refusal, distinct from the unused-disable-directive lane
  (`ruleId == null` too, different message text, still a warning).
- **No hacks:** no source-path blacklist, no `passWithNoTests`, no global-config escape —
  the refusal is data-driven from what the linter itself reports. Original 399/22/21
  verdicts are retained (population counts unchanged: the counterexample file is a probe,
  not part of the tree).
- **Causal (C5):** with ONLY the refusal block removed and a staged ignored bad file
  present, the suite is wrongly green 10/10 (the miss returns); with the block present the
  same state REFUSES naming the file. The refusal is the load-bearing mechanism.

### F3 — `actual-runnable-audit` is ORDINARY current code, not a frozen fixture

- **Before (candidate):** all 21 added cases (20 frozen fixtures + `template-render.audit.ts`)
  were bound by strict path+sha256 immutability — so a legitimate comment edit, rename, or
  delete of the audit file would fail the suite and demand re-freezing. Supersedes the
  candidate-round wording that bound "every added case" on-disk sha.
- **After:** binding splits by the supplement's own `classification` field —
  `frozen-intentional-fixture` (20 cases): immutable path+bytes+10 expected findings,
  historical evidence forever; everything else (currently the 1 audit case): ORDINARY
  current code — validated dynamically with actual IO: tracked? selected? admitted when
  clean? A retired path (renamed/deleted, no longer tracked) is SKIPPED, not read — no
  dangling historical path is ever opened. A NEW ordinary-scope bad file fails the ratchet
  by its actual filename (probe: `ordinary.newbad.test.ts` refused by exact `path:line`).
- **Live:** comment-append to the audit file PASSES; `git mv` rename PASSES; `git rm` delete
  PASSES (path retired, skipped); restoration byte-proven (`bbffc483…`) and green.

### What did NOT change

JSON `50f2b047…` byte-identical; 12 S1 pins and the 30-case corpus and their verdicts
byte-identical; first-RED retention (4 failed / 7 passed on the frozen candidate code);
probes C1–C4 re-run against the corrected state all RED for their own reason and restore
green; typecheck clean; manifest staleness honestly RED/HELD (no gen authority in this
packet); candidate packet `640f1804e6d7` and its artifacts untouched.

## Correction round 2 (independent review `f21cc404` — REVISE_BEFORE_SOURCE_EFFECT, finding P51-F4)

Round 1 was reviewed against live counterexamples again. The three earlier findings
(F1/F2/F3) were accepted correct for ordinary names. One remaining predicate miss, in the
SAME directory class F1 widened:

### F4 — the directory class was not dot-all; a newline in a BASENAME defeated it

- **Before (round-1 successor `5b93f31a`):** `LINTABLE_TESTS_DIR_PATH` used `.+` WITHOUT
  the `s` flag. In JS regex `.` does not match a line terminator, so a tracked
  `__tests__/deep/líne\nbreak.ts` (literal newline in the basename, valid `.ts`, NO named
  suffix) left the population entirely — and a vacuous `expect(true)` inside it passed the
  whole suite clean (miss reproduced on the byte-verified `5b93` tree before repair:
  wrongly 10/10).
- **Why round 1 missed it:** probe N1's filename carried `.bad.test.mts`, so
  `NAMED_TEST_PATH` (end-anchored, never crosses the basename) rescued the file — the
  directory-only branch was never exercised by a newline. The named-suffix fallback
  CONCEALED the directory-classifier failure.
- **After (sole predicate change):** the `s` (dotAll) flag on
  `LINTABLE_TESTS_DIR_PATH`. Directory-segment membership now covers ANY valid
  filename/depth with the exact 8 supported extensions, newline/Unicode/space in ANY
  segment, before the extension — independent of any named-suffix fallback.
- **Live (each on a real tracked file, exact byte paths in the logs):** the bad
  `líne\nbreak.ts` REFUSES with the finding carrying the literal newline inside the
  ratchet diff; the LEGITIMATE counterpart at the SAME pathname PASSES clean; a newline
  in a DIRECTORY segment (`__tests__/deep\nest/dir case.ts` — newline + space + case mix)
  bad REFUSES / good PASSES; Unicode/space-only directory-class variants
  (`ünïcode späce case.ts`, `nested/привет мир.mjs`) both REFUSE; the N1 named-suffix
  newline case still REFUSES (regression). Causal C6: with ONLY the `s` flag removed, the
  same staged bad file passes wrongly 10/10 — the miss returns; restore is byte-proven.

### What did NOT change (round 2)

Frozen JSON `50f2b047…` byte-identical (no data/oracle/fixture co-fix); 20
`frozen-intentional-fixture` cases and 12 S1 pins and the 30-case corpus byte-identical;
F2 coverage-error refusal and F3 ordinary edit/rename/retirement semantics re-verified
green/RED on this successor (regression logs); C1 selector narrowing still REDs naming
the 21; no new module/config/fixture/oracle/fault class/dependency — the change is one
regex flag plus this documentation.
