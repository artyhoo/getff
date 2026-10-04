# P2-D report — runtime-bridge (`packages/runtime-bridge`)

Lane P2-D of the P2 code-truth pass over `origin/main...origin/staging`
(190 first-parent commits, 2026-09-05 → 2026-09-14). Read-and-report lane per
[kickoff-p2.md](kickoff-p2.md): population first, every finding evidence-backed (T3),
verdicts in the kickoff grammar, one doc-sentence per finding. **No product code changed in
this lane's PR** — the only deliverable is this file. Kickoff §4's three pre-decided items
(context7 red check ≠ defect; GIT_DIR/`core.bare` class closed in #1795; recap v2 partial by
design) were **not** re-investigated.

## §population-enumeration

Enumerated BEFORE any finding (T10). Command and pin re-checked at audit time:

```text
$ git diff --stat origin/main...origin/staging -- packages/runtime-bridge | tail -1
 49 files changed, 4968 insertions(+), 848 deletions(-)
```

Matches the kickoff pin exactly. Breakdown by `git diff --name-status`:

| Slice | Count | Composition |
|---|---|---|
| `src/` | 15 | 14 M + 1 A (`src/cli/cliEntry.ts`, 106 LOC — the shared entry plumbing) |
| `test/` | 17 | 11 M + 6 A (`aif-backend-semantics`, `cli-entry`, `cli-symlink-entry`, `harvest-cli`, `harvest-merge-report`, `vendor-hook-stderr`) |
| `vendor/` | 16 | 15 M + 1 A (`vendor/src/cli/cliEntry.ts` — twin of the src A file) |
| root | 1 | `package.json` — delta is exactly one added `"author"` line (#1794, no trailer owed: no new dependency, no new ≥80-LOC file → not a capability commit per CLAUDE.md's detector) |

13 lane commits: #1618 `a65258985e`, #1622 `cfa1f973f0`, #1625 `5bc8ad3266`, #1627
`9dac4259c0`, #1631 `753fc00cb5`, #1628 `2aa1d553dc`, #1642 `08446175e1`, #1694
`55c05f37e4`, #1695 `aafaf728c6`, #1697 `1b6fe0b5c7`, #1710 `41b5cdd400`, #1713
`01600eb629`, #1794 `ce6ab0f700`.

T-P2-B check («in delta ⇒ new»): 16 of the 49 files are `vendor/` twins of src files, and
F1 below shows the twin deltas are **formatting only** — so roughly a third of the
+4968/−848 is re-counted upstream-identical content, not new logic. Nothing in the delta is
a byte-identical relocation of a pre-image blob (the #1271 class), so no LOC carve-out
misfired.

## §method-actually-run

Host fence passed (node v22.23.2, git 2.39.5, linux x64 container). Deviations from the
kickoff's literal spellings: vitest 4.1.8 has no `--reporter=basic`, so `--reporter=default`
was used; suites run via `NODE_PATH=/tmp/p2b-x64/node_modules node node_modules/vitest/vitest.mjs`
because the shared checkout install is arm64-broken on this x64 host (same playbook as P2-B).

1. **§5 suite gate, changed files** — all 17 delta test files: **343/343 tests green**.
2. **§5 suite gate, whole lane dir** (re-run for a fresh quotable summary at report time):

   ```text
   $ ... vitest.mjs run --reporter=default          (packages/runtime-bridge)
    Test Files  22 passed | 1 skipped (23)
         Tests  404 passed | 1 skipped (405)
   rc=0
   ```

   The one skip is `test/aif-park-live.test.ts` (`↓ test/aif-park-live.test.ts (1 test | 1
   skipped)`) — gated on a live aif-handoff, skipped by design on this host. No SDK-env
   discrimination was needed in this lane (unlike P2-B): nothing here reads
   `CLAUDE_CODE_ENTRYPOINT`.
3. **Vendor twin census (T-P2-B, §3 step)** — for every `vendor/src/**/*.ts`, a structural
   TypeScript-AST comparison (TS 5.9.3 `createSourceFile`; signature = node kind + literal
   text + child signatures, positions/trivia excluded) against its `src/` sibling:

   ```text
   TWIN TREE-IDENTICAL (19): AifHandoffBackend, ManualBackend, aifWsStatus, backend,
     cli/aifHttp, cli/answer, cli/claim, cli/cliEntry, cli/dispatch, cli/ensure-parallel,
     cli/harvest, cli/openQuestion, cli/park, cli/questions, harvest, idempotency,
     kickoff, resolver, types
   TWIN TREE-DIFFERS (0)
   VENDOR-ONLY (0)
   SRC WITHOUT VENDOR TWIN (3): AifFireBackend.ts, cli/await.ts, index.ts
   ```

   The 19 = the README's dispatch-closure table (14 files) + agent-loop table (5 files);
   the 3 un-twinned files = the README's «Files NOT copied» list, verbatim.
4. **Parity gate live run** — the mechanical channel that owns F1
   (`scripts/format-shipped.sh` Phase 3, `--check`, wired at `.husky/pre-commit:184-185`):

   ```text
   $ npm_config_cache=/tmp/p2d-cache bash scripts/format-shipped.sh --check \
       packages/runtime-bridge/vendor/src/cli/harvest.ts packages/runtime-bridge/src/cli/harvest.ts
   All matched files use Prettier code style!
   rc=0
   ```

   Hook twin re-verified byte-identical: `cmp packages/runtime-bridge/vendor/hooks/runtime-bridge-dispatch.sh
   .claude/hooks/runtime-bridge-dispatch.sh` → silent (rc 0).
5. **Pairing/mutation battery (kickoff §3.5)** — seven new-in-delta guards; for each, a
   surgical mutation (single occurrence asserted), the paired test run, then
   `git checkout --` restore with a byte-identity proof. All seven turned RED **exactly on
   their paired negative tests**; every restore verified `0 dirty files`. Table in F2.
6. **Predicate sweeps** — (a) `isMain` adoption: all 9 CLIs guard via `cliEntry.isMain`;
   zero unguarded top-level `main()`; (b) argv-parse adoption: every CLI parses through
   `parseCliArgs` except `cli/await.ts` (F4) and `dispatch.ts`'s deliberate
   first-non-flag kickoff-path resolver (pinned `['--force', path]`/`[path, '--force']` both
   resolve in `test/aif-dispatch-dedup.test.ts:20-21` — a different, safe shape than A6-4);
   (c) raw-fetch sweep over `src/` (F3); (d) env-var contract: all 9 README-tabled vars
   (`RUNTIME_BRIDGE_*` ×8 + `AIF_HOOK_LANG`) grep-verified read in `src/`.

## §findings

### F1 — `TRUE` — the vendor copy is parity-GATED, not parity-by-convention; the gate ran green live

- **Claiming surface** — `vendor/README.md:135-136`: «The framework copy carries the
  identical read, so vendor and upstream stay content-identical», and
  `scripts/format-shipped.sh:206-209`: «The two are content-identical by construction —
  vendor is exactly `prettier(src)` … NOTHING enforced that» (past tense — the gate now
  exists).
- **Observed** — the census in §method (19/19 tree-identical, 0 differ) is *independent*
  confirmation, and the enforcement channel exists: `scripts/format-shipped.sh:232-334`
  Phase 3 re-derives `prettier(src/<rel>)` into a temp tree and `cmp`s every git-tracked
  vendor `.ts` (DRIFT/ORPHAN report, detect-only in both modes), plus a byte-`cmp` for the
  bash hook twin (:324-334). Change-scoped at pre-commit (any half of either pair moves →
  check runs), full sweep in CI/`npm run format`.
- **Falsifier (ran, quoted)** — §method item 4: gate green on a real pair; hook `cmp`
  silent. The gate's RED direction is exercised by its own design (Phase 3 prints DRIFT
  lines and exits 1 on mismatch); the mutated-side RED is the *tests'* job, not this gate's.
- **Doc sentence:** docs may state «the vendored runtime-bridge copy is kept
  content-identical to `packages/runtime-bridge/src/` by a pre-commit parity gate
  (`vendor == prettier(src)`, byte-exact; hook twin byte-exact) — drift is a commit
  blocker, not a review hope».

### F2 — `TRUE` — every new guard in the delta has a paired negative, and each guard's removal turns that test RED (7/7)

Mutation battery (kickoff §3.5 — a paired test that cannot go RED is decoration). Each row:
guard site → mutation → paired-test result → restore proof.

| # | Guard (site) | Mutation (single occurrence) | Paired-test result | Restore |
|---|---|---|---|---|
| M1 | `park.ts:189` terminal-park refusal | `if (TERMINAL_PARK_STATUSES.has(...))` → `if (false && …)` | `3 failed` — exactly `A6-6b: refuses to park a TERMINAL task (status=done/verified/blocked_external) — issues NO PUT`; non-terminal CONTROLS untouched | byte-identical |
| M2 | `park.ts:201` A6-6 repeat-park dedup | `if (isAlreadyParkedOn(task, reason))` → `if (false && …)` | `1 failed` — exactly `A6-6: a repeat park of the SAME question issues NO PUT and reports alreadyParked` | byte-identical |
| M3 | `answer.ts:277` resume-only-lifts-an-A-park | `if (task.paused !== true)` → `if (false && …)` | `3 failed` — exactly the «NEGATIVE — resume refuses a task that is not paused (A6-6b)» arms (done task, B-park, absent paused field) | byte-identical |
| M4 | `AifHandoffBackend.ts:474` checked-cancel refuses a live worker | `if (!idle)` → `if (false && !idle)` | `6 failed` — the A5-1 «status=implementing/review/planning/plan_ready (released, worker live) → NO DELETE, refusal reported» arms (+2 refusal arms) | byte-identical |
| M5 | `cliEntry.ts:87` strict argv (`strict: true,`) | → `strict: false` | `1 failed` — exactly `rejects an unknown flag instead of silently ignoring it` | byte-identical |
| M6 | `cliEntry.ts:43` realpath-both-sides `isMain` (`return realpathSync(argv1) === realpathSync(fileURLToPath(import.meta.url));`) | → naive `return argv1 === fileURLToPath(...)` (the pre-#1597 A6-1 defect) | `1 failed` — exactly `isMain — realpath on BOTH sides (A6-1) > true when argv[1] is a SYMLINK to the module file` | byte-identical |
| M7 | `dispatch.ts:148` no-kickoff exit 1 (A6-2) | that `process.exit(1)` → `exit(0)` | `1 failed` — exactly `positive control: direct script execution still runs main() (exit 1, stderr message)` | byte-identical |

Note on scope: M6 was verified at the unit level (`cli-entry.test.ts`); the e2e
`cli-symlink-entry.test.ts` arms (symlink-invoked CLI actually runs) stayed green in the
suite but were not separately re-run under the M6 mutation. `reportMergeToAif`'s ordering
arms (#1694) are verified by suite green + read, not by mutation — see §self-application.

- **Doc sentence:** docs can say «each bridge CLI guard ships with a paired negative test
  that has been shown to fail when the guard is removed» — that sentence is now
  demonstrated, not assumed, for the seven guards above.

### F3 — `CODE-LIES` (minor, prose) — `aifHttp.ts` header claims to be «the SINGLE request implementation for every CLI in this tree»; two in-tree CLIs still raw-`fetch`

- **Asserting text** — `src/cli/aifHttp.ts:3-4` (delta-modified, +128/−5):

  > Shared aif-handoff REST helpers — the SINGLE request implementation for every CLI in
  > this tree and for the aifWsStatus REST snapshot.

- **Observed** — two CLIs in the same tree carry their own `fetch` and never import
  `aifHttp.js`:
  - `src/cli/await.ts:84`: `const res = await fetch(\`${apiBase}/tasks/${taskId}\`);` — no
    timeout, i.e. exactly the R-7 hang class `aifHttp`'s `DEFAULT_HTTP_TIMEOUT_MS = 30_000`
    exists to close;
  - `src/cli/questions.ts:183`: `const res = await fetch(url, { method: 'GET' });` — plain
    `Error` mapping, no timeout.
- **Falsifier (ran)** — sweep `grep -n "await fetch" src/` and the import graph: the claim
  holds for `answer.ts`, `harvest.ts`, `aifWsStatus.ts`, `AifHandoffBackend.ts` (all via
  `aifHttp.js`); `AifHandoffBackend.available()`'s raw 1s probe (:256) is a documented
  deliberate exception; the two above are undocumented ones.
- **Consumer reach** — low: `await.ts` is the one agent-loop entrypoint no shipped skill
  promises (vendor README :84-90), `questions.ts` is read-only; both behaviors predate the
  delta (their lines are unchanged in it — the *claim* is what the delta added). Not
  STOP-grade; it is a true-in-spirit / false-in-letter header.
- **Doc sentence:** docs written from this header must scope it — «`aifHttp.ts` is the
  single request implementation for the CLIs that use it (`answer`, `harvest`, `park`,
  `claim`, `dispatch`, `ensure-parallel`, `aifWsStatus`); `cli/await.ts:84` and
  `cli/questions.ts:183` still raw-`fetch` without the shared timeout/error policy».

### F4 — `TRUE` with a doc gap — `cli/await.ts` keeps the hand-rolled argv lookup (live A6-4 shape) and an untimed fetch; the delta upgraded its guard but not its parse

- **Asserting text** — `src/cli/await.ts:46-50` (unchanged lines inside a delta-touched
  file — the delta's only edit there is the `isMain` adoption at :41,:154):

  ```ts
  function parseArgs(argv: string[]): { taskId?: string; once: boolean; timeoutMs?: number } {
    const taskId = argv.find((a) => !a.startsWith('--'));
    …
    const i = argv.indexOf('--timeout-ms');
  ```

- **Observed** — this is the exact A6-4 shape `cliEntry.parseCliArgs` was written to kill:
  `await.ts --timeout-ms 5000 t123` resolves `taskId === '5000'`. `cli-entry.test.ts:73`
  pins the shared parser rejecting precisely this class; `await.ts` opts out. It is also
  the F3 raw-fetch site. Deliberately NOT vendored (README :84-90), so no consumer copy
  carries it.
- **Consumer reach** — low (same as F3); no code lie — `await.ts` never claims strict
  parsing. The gap is documentation-level: any sentence saying «every bridge CLI parses
  argv through `cliEntry`» is false by one file.
- **Doc sentence:** docs must say «`cli/await.ts` retains its own hand-rolled argv lookup
  (the A6-4 value-swallowing shape) and an untimed fetch; it accepts the shared `isMain`
  guard only».

### F5 — `CODE-LIES` (doc side, minor) — `vendor/README.md` quotes a dedup-read code shape the file no longer has

- **Asserting text** — `vendor/README.md:124-130`: «`src/idempotency.ts` therefore reads:»

  ```ts
  const DEDUP_PATH =
    process.env['RUNTIME_BRIDGE_DEDUP_PATH']?.trim() ||
    '/tmp/runtime-bridge-dedup.jsonl';
  ```

- **Observed** — `src/idempotency.ts:34-38` now reads
  `export function resolveDedupPath(env: NodeJS.ProcessEnv = process.env): string { return env['RUNTIME_BRIDGE_DEDUP_PATH']?.trim() || DEFAULT_DEDUP_PATH; }`
  with `const DEDUP_PATH = resolveDedupPath();` at :38. **Semantics identical** (same var,
  same `.trim()` guard, same default, same empty-falls-back order — the README's prose
  below the snippet remains accurate); the quoted *shape* is stale. The load-bearing claim
  («framework copy carries the identical read») is TRUE — the block is verbatim-identical
  in both copies, and the whole files are tree-identical (F1).
- **Doc sentence:** update the snippet to `resolveDedupPath()` or reword to «semantically:
  `RUNTIME_BRIDGE_DEDUP_PATH` trimmed, else `/tmp/runtime-bridge-dedup.jsonl`».
- **Report note (not a defect):** `DEDUP_PATH` is captured at module load (:38). For the
  one-shot CLIs that read it, that is fine; a hypothetical long-lived importer that sets
  the env var *after* import would resolve a stale path. Nothing in-repo does this.

### F6 — `TRUE` (cross-file consistency rows, each command-checked)

- **Terminal-status sets agree across the park and cancel surfaces** — `park.ts:42`
  `TERMINAL_PARK_STATUSES = new Set(['done', 'verified', 'blocked_external'])` ≡
  `AifHandoffBackend.ts:72` `TERMINAL_RAW_STATUSES = new Set(['done', 'verified',
  'blocked_external'])`; the park test's status lattice (:214-243) pins both directions,
  including `backlog` deliberately NOT terminal (CONTROL row).
- **The `ensureParallelEnabled` degradation WARN says what it does** —
  `AifHandoffBackend.ts:300-318`: guard failure ⇒ stderr WARN «tasks may run in-place /
  risk dirty_worktree» + proceed, matching the Finding-A comment above it; observed live in
  the suite environment (WARN emitted against the unreachable stub, dispatch continued,
  tests green). Informational channel by explicit design — the alternative (failing the
  dispatch) is the defect the comment rejects.
- **`vendor-hook-stderr.test.ts` (new) pins the A5-5 fix on the vendored hook** — five arms
  (fixed /tmp path untouched; no file created; stderr forwarded to a reader; stdout
  `additionalContext` contract unchanged; no temp leftovers), all green in the suite. This
  is the only test that executes any vendor surface — the vendor TS files themselves are
  untested directly and rely on the F1 byte-parity gate + the tested src originals.
- **`isMain` adoption is total** — 9/9 CLIs; `grep` for unguarded top-level `main()` over
  `src/cli/` returns none.
- **`ManualBackend` language handling** — `manualInstructions(taskId, kickoffPath,
  responsePath, lang)` takes the language explicitly, no silent default (K-2); `ru` →
  Russian, else English, matching the `AIF_HOOK_LANG` contract row in the README table.

### Lane-brief corrections (T-P2-B: «in delta ⇒ new»)

- The `+4968/−848` headline over-counts new logic: 16 vendor files are formatting-only
  twins of src files (F1), and the 22-line `vendor/src/idempotency.ts` hunk mirrors its src
  twin. Nothing in the lane is a vendored relocation of a pre-image blob.
- `package.json`'s delta (one `"author"` line, #1794) is metadata, not a capability commit —
  correctly carried **no** `Prior-art:` trailer (verified: `git log -1 --format=%B
  ce6ab0f700 | grep -i '^prior-art'` → empty; the detector's dependency/LOC arms do not
  fire on it).

## §coverage

Fractions per T6 (no bare «high»):

- **Population:** 49/49 files enumerated before findings; 49/49 accounted for in the audit
  (15/15 src read — 1 whole-file (`cliEntry.ts`, 106/106), 14 delta-read + targeted
  regions; 17/17 test files executed; 16/16 vendor twins AST-compared + README
  inventory-matched; 1/1 package.json diff-read).
- **Suite execution:** 17/17 changed test files green (343/343); whole lane dir 22 green +
  1 skip-by-design (`aif-park-live`, live-aif-gated) — 404 passed / 405, rc=0, on this host
  with zero environmental REDs and zero SDK-env scrubbing needed.
- **Claims:** ~40 derived claims across src/vendor/tests; ≈5 of 6 run-backed (suite green,
  parity-gate run, mutation battery, census script, grep sweeps); the remainder static-read
  and marked as such (external-service behavior rows, §inconclusive).
- **Mutation coverage:** 7 new guards mutated / 7 turned RED / 7 byte-identical restores.
  Not mutated: the `reportMergeToAif` arm lattice (#1694) and `dispatch` spec_invalid
  exit-2 arms — those are verified by their own suites' stub-backed arms (green) plus read.
- **Calibration:** first run of this method on this lane; treat un-run `TRUE` rows with a
  ≥20% false-positive expectation until a second pass.

## §self-application

This audit's own traps, audited (T15):

- **The audit's own method produced false positives first (T2/T3 on itself).** My first two
  twin-comparison attempts — raw `cmp`, then whitespace-stripped md5 — *mischaracterized*
  the twins (prettier reflow changes byte streams and whitespace-stripped token order), and
  the coarse diff counter suggested a «227-line twin delta» in `cli/harvest.ts` that looked
  like undocumented consumer-fit drift. I did not draft a finding from that number; I
  replaced the method with a structural AST census (TS 5.9.3, positions/trivia excluded),
  which shows all 19 pairs tree-identical. The finding that survived is about the *gate*
  (F1), not the phantom drift.
- **T10 on itself** — population enumerated and pinned before any finding (§population-enumeration
  quotes the re-check at audit time; it matched the kickoff pin, 49 files).
- **T-P2-A on itself** — «diff reads correct ⇒ behaviour correct» was not relied on: the
  load-bearing gates were *executed* (suite twice, parity gate live, 7 mutations with
  restores), and the audit's first suite observation (WARN noise against the stub) was
  traced to its code site and judged by its claim, not by its noise.
- **Honest limit** — the mutation battery covers the seven *new guards*; the remaining new
  test arms (merge-report ordering, spec_invalid exit-2) rest on their own green stub-backed
  runs plus reads. The vendor TS files are verified *identical to tested originals*, not
  tested in situ — that identification is exactly what the F1 gate enforces, so the residual
  risk is «the gate stops running», which is a maintainer-visible commit-blocker failure
  mode, not a silent one.

## §inconclusive

1. **External aif-service citations** — claims whose proof lives in the aif service repo,
   not here: `stateMachine.js:91/:176` + `coordinator.js:442-467` (complete_review only
   from `review`; comment-before-event ordering), `runtimeProfiles.ts:525-555`,
   `TASK_EVENTS` (`packages/shared/src/types.ts:565-581`), and the «API caps
   `maxReviewIterations` at 50» comment (`AifHandoffBackend.ts`). The *bridge-side* halves
   of these contracts are verified locally (e.g. `reportMergeToAif` skips unless
   `task.status === 'review'`; `DEFAULT_MAX_REVIEW_ITERATIONS = 4` is sent explicitly on
   POST). What would settle it: the aif service checkout.
2. **Real consumer activation of the vendored hook** — `vendor-hook-stderr.test.ts` proves
   the hook script's behavior against a stubbed tree; whether a given consumer registered
   it in `settings.json` is a runtime/operator surface (setup.d layer 55 deliberately does
   NOT register it) and is not verifiable from this repo.
3. **`aif-park-live.test.ts`** — the one suite skip (needs a live aif-handoff with a real
   project). Its delta hunks were read; the arm never ran here.

## Verdict

**GO-WITH-NOTES.** No `BROKEN` anywhere in the lane. The delta's load-bearing claims hold
under execution: the lane suite is green with zero environmental REDs (404/405, the one
skip live-gated by design), all seven new guards demonstrably fail their paired tests when
removed, and the vendor-copy doctrine — the riskiest thing in this lane, a hand-maintained
copy shipped to every `--profile factory` consumer — is enforced by a real pre-commit parity
gate that ran green live (F1). The findings are small and documentation-shaped: an
over-broad «SINGLE implementation» header (F3), one CLI that kept the old argv/fetch shape
by design-or-omission (F4), and a stale README snippet (F5). Fixes belong to an I-phase
follow-up, not to this report.
