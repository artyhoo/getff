# M10 completion — review-revision-5 tracked kernel evidence

Scope: the portable tracked evidence for the M10 completion proposal revision
(review-revision-5, independent findings M10-R5-1…6), covering the empty-sentinel
caller sweep, the four frozen family controls, the effective325 canonical disposition
projection, and the P50 baseline accounting. Parent `e046844dbaa76748439cf865c3b5383d36d3f398`;
no framework source was applied outside the owned preparation clone. Machine-readable
companions: `m10-effective325.json` and `m10-receipt-index.json` (same directory).
Session logs referenced below are not shipped; each is pinned by full sha256 in the
tracked receipt index (and recomputes there) so the recorded bytes are verifiable
wherever the session artifacts live.

Revision note (operator-evidence-exception-1, findings M10-FINAL-E1/E2): this file and
its two JSON companions were corrected once under the operator's single evidence-only
exception — per-id rationale and receipt bindings added to the projection, the tracked
receipt index added, and the §5 environment/reuse wording brought back to the observed
boundaries. No test, baseline, or production byte changed.

## 1. Empty-sentinel caller sweep (M10-R5-1)

Fifteen suites under `tests/install-sh/` contained path-emitting fixture helpers
(`make_consumer`-class: `T=$(mktemp -d)` … `echo "$T"`, `echo ""` + `return 1` on
install failure) captured by nonterminal callers. The sweep makes every such capture
refuse before any derived read/write/cd/cleanup:

- **139** path-helper captures are now immediately followed by a sentinel refusal
  (`[ -n "$X" ] || { echo "FATAL: … (M10-R5-1)"; exit 1; }`) or are the head of the
  guarded `if [ -n "$X" ]` form — mechanically audited over all changed suites
  (audit verdict `AUDIT-OK`, 60 suites scanned, zero unguarded captures).
- **60** sentinel checks are terminal: failed fixture setup prints the named
  id-specific `bad` line, the M10-R5-1 stop line, `PASS=/FAIL=` counters, then
  `exit 1` — a suite no longer continues past a failed fixture.
- **22** helper bodies guard `mktemp -d` (`|| { echo ""; return 1; }`), so an
  install failure returns exactly an empty path and nothing else.
- **16** compound capture lines were split (capture / refusal / derived command) so
  an empty path can never reach a `;`-chained `git -C "" …` (which would operate on
  the suite's own CWD); **1** comment-trailing capture gained its refusal line.
- Successful fixture stdout remains only the owned path — no `ok`/`bad` output is
  injected into path captures (the refusal lives in the caller, not the helper).

Boundary, stated honestly: bare top-level `X=$(mktemp -d)` captures that never pass
through a sentinel check (direct scratch dirs) are outside the reviewed
empty-sentinel-caller class and were not transformed. Original assertions and test
ids are preserved; no expected exit code changed in this sweep.

## 2. Four frozen family controls (M10-R5-2)

Executed from `FROZEN-REVIEW-CONTROLS.json` (sha256 `8f6f60830a46649407e557ecdbc765dd65a0caad3f345675e99071bb8ed2c478`)
with the wrapper selector, per-arm markers/witnesses, and all original/repaired/stock
bindings frozen BEFORE execution (`r5-controls-predeclared.json`, sha256
`2ebcdbfe276c4799cec4aa649114191075d988181159bfb7bef3a6b56aa40bcb`). Mechanism: each
shadow is a fresh `cp -R` of the clone (includes `.git`, so the carrier's `REPO_ROOT`
resolves to the shadow); the stock installer is backed up by `cp` as `install.sh.stock`;
the wrapper runs the REAL stock, logs every actual exit+argv to the arm's witness, and
forces 42 only on the FIRST argv-exact invocation whose actual stock exit is 0.
Original carrier bytes come from read-only `git show HEAD:<path>` (never checkout).
No rename, no permission change, no ref change; restore is `cp` of the stock back.

| id | family | carrier | target argv | old_fault (e046 bytes) | repaired_fault (swept bytes) | restored (real stock) |
|---|---|---|---|---|---|---|
| p50-315 | F2 masked status | snapshot-exclusion-guard.test.sh | `python --force` | EXIT=0 **false-green** | EXIT=1, named reason present | EXIT=0, PASS=12 FAIL=0 |
| p50-232 | F3 direct helper | r2-glob-reach.test.sh | `ts-server --force` | EXIT=0 **false-green** | EXIT=1, named reason present | EXIT=0, PASS=131 FAIL=0 |
| p50-059 | F4 command-substituted path helper | eslint-rule-prune-by-manifest.test.sh | `ts-server` | EXIT=0 **false-green** | EXIT=1, named refusal | EXIT=0, PASS=12 FAIL=0 |
| p50-097 | F5 captured output | f8d-ai-factory-sot-materialized.test.sh | `ts-server --force` | EXIT=0 **false-green** | EXIT=1, named reason present | EXIT=0, PASS=10 FAIL=0 |

Every witness shows the first argv-matching invocation at occurrence 1 with
`stock-rc=0` — the stock installer actually completed 0 before the 42 was forced.
Sibling invocations pass stock rc through unchanged (p50-232 witness: 32 total
invocations, all passthrough beyond the first match). The p50-059 repaired arm's
first output lines are the named `bad` (p50-059) line, the M10-R5-1 refusal line,
the counters, then exit 1 — nothing derived ran before the refusal. Controls
summary: `R5-CONTROLS-FAILURES=0` (session artifact; full sha256 and all 12 raw arm
logs + 8 witness digests indexed in the tracked `m10-receipt-index.json`). An earlier
attempt of the controls script aborted at all four `cp` steps (shadow dir was never
created; no arm executed) and is preserved as rejected history.

## 3. effective325 canonical disposition projection (M10-R5-3)

`m10-effective325.json` projects all **325** unique census ids (from 332 historical
rows; append-order fold, history never rewritten) onto the eight spec-§3 statuses:

- **verified-behavioral: 6** — p50-001 (completion-4 targeted control, accepted
  scoped evidence), p50-021 (CIC full fake-PM strict contract, ruling f253d186),
  p50-315 / p50-232 / p50-059 / p50-097 (the four r5 controls above).
- **verified-structural: 317** — repaired call sites whose verification is the
  reviewed static before/after repair plus normal-suite green. Per the reviewer
  ruling, normal-suite green is NOT a fault control and carries no behavioral claim.
- **not-executed: 1** (byte-identical.test.sh measured false-positive),
  **intentional-fixture: 1** (refresh-baseline-survives-early-exit.test.sh early-exit
  fixture is the suite's own subject).

Canonical correction rows (302) are appended to the historical notes with separate
action metadata (`action: M10-R5-3-canonical-projection`); no historical row was
rewritten and rejected claims remain on record.

## 4. P50 baseline accounting (M10-R5-4)

`packages/core/principles/50-install-rc-asserted.baseline.json` after this revision:
**16 positive files totaling 23 unasserted invocation groups, plus one historical 0
entry** (`synth-wire-consumer-config.test.sh` — zeroed before the M10 census; kept at
0 as a pin, not a residual). The earlier "5 residuals" wording described only the
modified subset:

- **5 lowered by completion-4**: gh-531-shipped-prettier 4→1, gh-934-ship-eot-hook
  3→1, imr-registration 3→1, r2-glob-reach 4→1, refresh-baseline-survives-early-exit
  15→1 — each retains exactly one measured residual with a disposition row.
- **11 unchanged positive files** (byte-identical to the measured 2026-10-01
  baseline): byte-identical 1, eslint-barrel-preserve-consumer 5,
  f20-stryker-monorepo-emit 1, first-commit-passable 1, gh-974-honest-incomplete-deps
  1, multi-stack-monorepo 2, nvmrc-ci-drift 1, r2-auto-wire 1,
  refresh-offers-lintstaged-migration 1, refresh-reconciles-skill-rename 1,
  v2-strict-runtime-armed 3.

Every one of the 23 residual groups has a disposition row: 21 verified-structural,
1 not-executed (byte-identical), 1 intentional-fixture (refresh-baseline-survives-
early-exit). The baseline stays monotonic — this revision changes no count, only the
`_comment`, which now points at this tracked file (the previous comment referenced
untracked session paths). Fresh P50/P51 run on the final tree: **49/49 tests green**
(session log `logs-r5-p50-p51.log`, EXIT=0); shipped-surface format check green
(EXIT=0).

## 5. Receipt index (portable, tracked)

The tracked machine-readable index is **`m10-receipt-index.json`** (same directory):
every receipt below appears there with a portable `session:` label, the FULL sha256 of
the retained original log/witness bytes (recomputable at the labeled path), the actual
command form, the observed exit, and the environment fields that were actually known —
explicitly `unknown` where the retained log captured none. It is a normalized copy of
retained session artifacts; its own file hash is not asserted equal to any of them.

- **15 swept suites — fresh receipts** (`cd <clone> && /opt/homebrew/bin/timeout 900
  bash tests/install-sh/<stem>.test.sh`): all EXIT=0 with FAIL=0 — cargo-entry-lane
  71/0, consumer-delivery-safety-guard 38/0, consumer-upgrade-path 77/0,
  deliver-gate-scripts 34/0, eslint-rule-prune-by-manifest 12/0, lane-orphan-residue
  61/0, pre-merge-local-delivery 0-fail, python-agent-surface-refresh 0-fail,
  python-entry-lane 203/0, python-rules-lock 0-fail,
  refresh-baseline-survives-early-exit 30/0, refresh-dir-payload-ownership 25/0,
  refresh-divergence-guard 37/0, refresh-rewires 193/0, refresh-vendor-single-delivery
  24/0. Fourteen ran in the r5 session environment (LANG=C.UTF-8, bash 3.2.57 — no
  variable-name/non-ASCII-adjacency site in those suites); refresh-rewires ran under
  explicit `LC_ALL=C` (below).
- **refresh-rewires environment record (corrected)**: two failures are retained, both
  the bash-3.2 UTF-8-locale variable-name-extension artifact (`$h»` parsed as one
  unset name under `set -u`) on lines byte-identical to the then-current suite bytes:
  the completion-4 runner log (line 537, TERMINAL EXIT=1 — that session's locale was
  never captured and is unknown) and the first r5 run (line 614, session LANG=C.UTF-8;
  5-line repro fails under C.UTF-8 and passes under LC_ALL=C). Correction of the
  earlier record: the artifact was NOT an infrastructure delta of the restarted
  session only — it fired in the pre-restart completion-4 session too, and that
  session's log is a terminal failure with no completion-4 fix1 receipt, so the
  completion-4 REPORT §5 wording "60/60 green / 6 fix1 PASS" overcounts this one
  suite (its own fix1 table lists five). The green receipt under explicit `LC_ALL=C`
  is this suite's FIRST terminal green; equivalence to any completion-4-era
  environment is unknown and not claimed.
- **45 unchanged suites — historical, source-equal receipts**: none was rerun in r5
  or in this exception. Each file's bytes are byte-equal to the completion-4 proposal
  postimage AND to the current proposal postimage (sha-verified), and each carries a
  retained terminal EXIT=0 log from the completion-4 boundary (21 first-run + 5 fix1
  + 16 cycle-3 reused + 2 cycle-2 mtime-proven + 1 corrected-contract rerun), indexed
  individually by full digest in the tracked index. These are HISTORICAL observations
  at their recorded boundary: the completion-4 session captured no environment fields
  (locale/shell environment unknown), and source byte equality is not all-input
  freshness — no current-environment equivalence, no fresh-gate status, and no
  behavioral certification is claimed for them. The completion-4 runner's own
  observed totals (TOTAL_RUN=36 REUSED-VALID=24 FAILS=6) are recorded as retained,
  with the refresh-rewires caveat above.
- **P50/P51 + format**: fresh green receipts as in §4 (digests and observed summary
  lines in the tracked index).

## 6. Custody and honest limits (M10-R5-5/6)

The authorized root `/Users/art/.codex/worktrees/2a8a/rules-as-tests-aif` is the
bound root and stayed clean at `e046844d` throughout; foreign drift observed on the
primary staging checkout is unrelated WIP granting no write here. The completion-4
part3 delivery-source corruption is a valid observation at its own boundary — it is
not proof that the originally-specified after-stock wrapper mechanism executed; the
inert shadow/scripts site was an author implementation defect, retained as rejected
history. Full correction text lives in the session REPORT under review-revision-5.
What this package does NOT claim: behavioral certification of untouched suites; a
fault control behind normal green; or coverage of the bare top-level `mktemp`
captures named in §1.
