# S1 cold reviews

> **Authoritative for:** S1 independent-review receipts — Batch F freeze review of the outer
> conformance driver expectations (T19/T22), and any later S1 cold-review receipt appended below.
> **NOT authoritative for:** project goal, the specification, or the stage deliverable itself —
> see `docs/superpowers/specs/2026-10-08-test-assurance-kernel-design.md` and the kickoff.

## Batch F — independent freeze review of driver expectations + probes (2026-10-08)

### What was reviewed, and when

Subject: `scripts/test-assurance/driver-expectations.json` (the frozen outer-driver
expectations: baseline rows + six anti-detector arms D1–D6) and the two frozen kernel probes
`scripts/test-assurance/driver-probes/glv-parse-error-probe.mts`,
`scripts/test-assurance/driver-probes/glv-healthy-rule-probe.mts`.

Timing discipline: the expectations file was authored from the FROZEN ORACLE
(`scripts/test-assurance/expectations.json`, sha256
`069d2a70165ba84e6e71157350c1d2324a69f83fd8fc58586524e3e5de525978`) plus carrier text at HEAD,
and the review completed BEFORE any acceptance capture — no `logs/batch-f/` driver-run artifact
existed when the verdict was issued (the reviewer was told only where the subject files live;
no driver output was provided to it).

Reviewer: the `review-sidecar` agent role (read-only tool surface: Read/Glob/Grep), a cold
session with no shared editing context with this executor. Independence honesty (K7): the
reviewer runs on the same harness model as this executor session (GLM-5.3 per the kickoff's
no-substitution rule) — independence here is **procedural** (cold context, read-only, separately
derived reachability analysis), not model diversity. Recorded as such rather than claimed
otherwise.

Scope the reviewer covered (its own evidence list, verified against the actual corpus and
carriers): full 30-file corpus read; all four gate carriers at HEAD
(`packages/core/eslint-rules/no-vacuous-assertion.mjs`,
`packages/core/eslint-rules/require-effective-assertion.mjs`, `eslint.config.mjs`,
`packages/core/hooks/checks/guard-liveness.ts`); the frozen oracle's static matrix and
`channel_map`; both plugin registries; manifest R7; the cf3 counterfactual record.

### Verdict

**WARN — zero blocking findings. FREEZE-VERDICT: ACCEPT.**

Reviewer's six-section result: A derivation honesty PASS (every baseline row restates the frozen
oracle's static matrix; the wrong-import row stays an honest admission, never a detection claim;
conservative omission of the Q3–Q6 bads from static rows verified) · B K-semantics PASS (all six
arms mutate a GATE carrier; corpus/driver/expectations never patched) · C patch validity PASS
(each `from` occurs exactly once at HEAD with matching indentation; D5 patch sha256 + label
byte-match the cf3 record) · D probe soundness PASS (D5 fallthrough reachability re-derived
independently; D6 probe mirrors manifest R7 byte-for-byte) · E corpus reality PASS (all 30 paths
exist; D3 flip is exactly the corpus's sole BinaryExpression subject; retainer bads stay
rejected) · F exit-grammar honesty PASS with two MINOR wording findings.

Mechanical-INCONCLUSIVE carried by the reviewer itself (it had no compute surface): it
string-matched but could not recompute the sha256 pins (`frozen_oracle`,
D5 `expectedSha256`). This session recomputes them at runtime — `driver-run.log` shows
`DRIVER oracle sha256=069d2a70…` (live-recomputed match) and
`PATCH D5-PERM-GLV … sha256=6da3c1c1a80ae38acdc0f56d201277de4f3f1b5ad7eeef617ed7264dfe5aa877`
(byte-equal to cf3's recorded `sha256(label\nfrom\nto)`), so the INCONCLUSIVE is discharged by
the driver's own fail-closed drift arms.

### Findings and resolutions

| ID | Severity | Finding | Resolution |
|---|---|---|---|
| F1 | MINOR | exit grammar enumerated {0,1,3} but never mapped an unexpected eslint status (fatal rc 2, e.g. induced by a bad patch) — a driver treating «mismatch → 1» could misattribute an infrastructure fault to the gate | ADOPTED, both layers: `driver.mjs` now treats ANY exit outside the documented 0/1 grammar as INFRASTRUCTURE (exit 3, can neither read green nor count as detection), and `detection_semantics.driver_exit` states it (reviewer's one-line «any other exit status → 3» was refined: an rc mismatch against a frozen mutant expectation IS the detection mechanism, so only statuses outside {0,1} route to 3) |
| F2 | MINOR | the exit-0 summary sentence omitted the arm-pristine conjunct that `arm_pass` requires (a driver written to the summary alone could exit 0 with an unhealthy pristine observation) | ADOPTED as wording: `driver_exit` 0 now states the full conjunction; the driver already enforced it (`driver.mjs` fails on any unhealthy pristine observation — exercised in every arm's pristine phase) |
| E1 | MINOR | `narrowness_retainer` mentioned «UnaryExpression subjects» no corpus file exercises; operative claim (flip ONLY `bad.literal-arithmetic`) is true — but the UnaryExpression branch of `isPureLiteral` has no corpus arm: a declared coverage gap of the grammar, permissible under spec §6's small explicit set | ADOPTED as wording + honest limit: retainer text now names the gap explicitly; carried to `s1/honest-limits.md` and the dispositions register in Batch H (NOT repaired in S1 — no silent coverage) |
| C1 | cosmetic | `expectedSha256_note` said «patchSha256»; cf3's field key is `sha256(label\nfrom\nto)` | ADOPTED: note now names the actual key |
| C2 | note | sha256 pins string-matched, not recomputed, by the reviewer | DISCHARGED at runtime (see above); no artifact change |
| — | note | cf3's `sourceSha` pins guard-liveness.ts at `2b45e109e…` while HEAD is `27211e0de…` | No action: the from-strings still exist at HEAD and the driver re-proves byte-identity of the worktree pre-image against the live HEAD blob per arm — any intervening edit fails closed |

### Post-review amendments (transparency record)

The freeze was amended AFTER the verdict, applying exactly the reviewer-sanctioned findings
above: four prose amendments to `driver-expectations.json` (`driver_exit`, `narrowness_retainer`,
`expectedSha256_note`; `arm_pass` and every baseline row, observation, patch spec, and the
oracle pin were NOT touched) and one hardening edit to `driver.mjs` (F1). Post-amendment
re-verification: full driver run ×2, both `DRIVER_EXIT=0`, 45 normalized observation lines
byte-identical across runs (`logs/batch-f/driver-run.log`, `logs/batch-f/driver-run2.log`,
`logs/batch-f/determinism.log` — empty diff); amended JSON parses
(`node -e "JSON.parse(...)"` OK); oracle pin re-verified live in both runs.

### Reviewer raw verdict gate block (verbatim)

```json
{
  "schema_version": 1,
  "gate": "review",
  "status": "warn",
  "blocking": false,
  "blockers": [],
  "affected_files": [
    "scripts/test-assurance/driver-expectations.json",
    "scripts/test-assurance/driver-probes/glv-parse-error-probe.mts",
    "scripts/test-assurance/driver-probes/glv-healthy-rule-probe.mts",
    "scripts/test-assurance/expectations.json",
    "docs/test-assurance-kernel/s1/counterfactuals/cf3-guard-liveness-permissive.json",
    "packages/core/eslint-rules/no-vacuous-assertion.mjs",
    "packages/core/eslint-rules/require-effective-assertion.mjs",
    "eslint.config.mjs",
    "packages/core/hooks/checks/guard-liveness.ts"
  ],
  "suggested_next": null
}
```

## Batch G+H review (2026-10-08) — independent review-sidecar agent (read-only, cold)

Scope: `scripts/test-assurance/verify.mjs` (adapter), the F-G1 replay fix, `dispositions.md`,
`honest-limits.md`, `matrix.md`, `replay-commands.md`, `.agents/rules/test-quality-contracts.md`,
the regenerated index rows, Batch G+H logs. Reviewer answered 7 named focus questions
(real-replay-vs-report-reading, INFRA/empty-selection exits, dispositions schema binding,
policy-rule contradictions, F-G1 fixture cases, T7 sweep honesty, index consistency).

**VERDICT: WARN — zero blockers, 8 MINOR findings.**

Findings F-H1..F-H8 and their disposition (all fixed in this batch, iteration 2/5; each fix
re-verified — full acceptance re-run exit 0 after the fixes):

| # | Finding (reviewer's words, compressed) | Fix | Re-verification |
|---|---|---|---|
| F-H1 | `stepTwins` collapses every non-zero rc into RED «drift»; rc=2 (missing toolchain) is INFRA per the twins script's own grammar (0 sync / 1 drift / 2 no-tsc) | rc==1 → RED; any other non-zero → INFRA (verify.mjs stepTwins) | twins step PASS on the re-run; grammar read from the script's exits (24/104/107) |
| F-H2 | Filtered `--step` run prints the stage-level «ACCEPTED … every registered replay» verdict | PARTIAL-ACCEPTED wording when `results.length < STEPS.length` | `--step dispositions` now prints «1/10 steps ran via --step filter» |
| F-H3 | Dispositions validator binds the FIRST entry per source; the queue's own «supersede by appending» discipline had no mechanical remedy | `entries.findLast` — the LAST entry per source is binding; queue doc amended to state it | probe: appended superseding entry with drifted classification → RED names it; byte-identical restore |
| F-H4 | `parseDispositionsEntries` silently drops an unterminated final fence | unterminated fence → explicit finding «opens a fence that is never closed» | probe: unterminated fence → RED entry #4; byte-identical restore |
| F-H5 | `os.platform()` fallback comment claimed a refusal property the code never had | comment corrected (platform() matches darwin/linux; no refusal added) | comment-only; behavior unchanged |
| F-H6 | Rename-break replay: fixture copies not hash-pinned to HEAD (weaker than every counterfactual surface) | tracked fixtures now hash-pinned to the HEAD blob at copy time, `die` on drift | replay re-run exit 0 (pre-image pinned) |
| F-H7 | Rename-break replay: final-phase `die` litters `report-final.json`/`stdout-final.log` into the MAIN checkout | both files added to the EXIT-trap cleanup | replay re-run exit 0; main checkout clean post-run |
| F-H8 | Ledger section misorder: Batch I placeholder preceded the Batch G outcome | Batch I stub moved to the end of the ledger | file structure verified post-edit |

Reviewer's positive notes (verbatim-compressed): INFRA precedence sound end-to-end; no
`|| true` / no exit-masking surface in verify.mjs; frozen-oracle pin re-verified live on
every run; CF denominator prevents silent registry shrink; tamper restoration hash-proven
in `finally`; T2 arm asserts a refusal, not a green, on an emptied selector.

Reviewer raw verdict gate block (verbatim):

```json
{
  "schema_version": 1,
  "gate": "review",
  "status": "warn",
  "blocking": false,
  "blockers": [],
  "affected_files": [
    "scripts/test-assurance/verify.mjs",
    "scripts/test-assurance/delivery/replay-principle-rename-break.sh",
    "docs/test-assurance-kernel/s1/dispositions.md",
    "docs/test-assurance-kernel/s1/honest-limits.md",
    "docs/test-assurance-kernel/s1/matrix.md",
    "docs/test-assurance-kernel/s1/replay-commands.md",
    "docs/test-assurance-kernel/s1/batches.md",
    ".agents/rules/test-quality-contracts.md",
    ".agents/rules/00-rule-index.md",
    "AGENTS.md"
  ],
  "suggested_next": {
    "command": "/aif-fix",
    "reason": "No blockers; eight minor consistency findings (grammar mislabel in stepTwins, single-step ACCEPTED wording, supersede-vs-first-match binding, unterminated-fence drop, wrong fallback comment, unpinned fixture copies, main-checkout litter on die, ledger section misorder)."
  }
}
```

Fix note: `suggested_next` was executed in-session (the executor owns the fix loop; no
`/aif-fix` redispatch needed — all 8 findings were MINOR and are fixed + re-verified above).

## Batch I review (2026-10-08) — full-diff cold review of the entire S1 stage (T19)

Scope: the FULL S1 diff against the stage base — every Q1–Q6 detector, delivery artefact,
counterfactual/delivery replay, driver, adapter (`verify.mjs`), evidence file, and log
receipt — plus plan §Acceptance (1)–(4) conformance. The reviewer was dispatched before any
Batch I remediation existed (it reviewed the stage as-committed at `12c4cfb22` plus working
tree); its findings were acted on / dispositioned afterward.

Reviewer: the `review-sidecar` agent role (read-only tool surface: Read/Glob/Grep), a cold
session with no shared editing context with this executor. Independence honesty (K7), same
statement as the two receipts above: the reviewer runs on the same harness model as this
executor session (GLM-5.3 per the kickoff's no-substitution rule) — independence here is
**procedural** (cold context, read-only, separately derived checks), not model diversity.
Unlike the Batch F reviewer, this reviewer had a compute surface and ran commands itself
(its evidence cells cite its own `grep` invocations and file:line reads).

Verdict (verbatim from the reviewer's report): **«VERDICT: GO, zero BLOCKERs.»**

### Findings C1–C7 (reviewer's rows, compressed) and dispositions

| ID | Severity (dim) | Finding (reviewer's words, compressed) | Disposition in Batch I |
|---|---|---|---|
| C1 | COSMETIC (1) | `AGENTS.md` (+1 rule-index row) is outside the kickoff's enumerated write scope but is mechanically forced by the index generator's twin output and disclosed in the commit body | NO-ACTION — generator-forced and disclosed; re-declared here |
| C2 | MINOR (8/6) | Refusal-grammar arms (host mismatch/`darwin`, unknown step, S2, foreign clone) are implemented in code but have no raw receipts in `s1/logs/`, while commit `2c251ade2`'s message claims the refusal grammar | **ACTED:** `logs/batch-i/refusal-grammar.log` — all four arms re-run raw, each exit 3 with its `VERIFY-REFUSAL` stderr line |
| C3 | MINOR (5) | cf3/cf4 final-phase litter window: `run_scratch_vitest … final` writes `report-final.json` + `stdout-final.log` into the MAIN checkout, then removes them OUTSIDE the EXIT trap — a die in that window litters the main tree (`report-final.json` is not gitignored); the identical window was trap-fixed (F-H7) only in the delivery replay | **ACTED:** trap-protected `rm -f` added to both scripts' `cleanup()` (F-H7 parity). Proof: `bash -n` both; extracted `cleanup()` executed against planted litter → removed (`C3-TRAP-PROOF` in session log); full acceptance re-run post-fix exit 0 exercises both replays end-to-end |
| C4 | GAP-FOUND, MINOR (7) | Preset consumer rule catalogs (`RULES.md` × 3 presets) carry no row for the new test-quality contract/kernel; out of write scope, but unlike the SSOT append this out-of-scope observation is recorded NOWHERE in the s1 evidence — an unrecorded parallel surface | **RECORDED:** `dispositions.md` entry `disp-c4-preset-rules-md-catalogs` (owner-stage S2) — the queue discipline names exactly this route for review findings |
| C5 | GAP-FOUND, MINOR (7) | The two new rules are unregistered in `packages/core/manifest/rules-manifest.json`, so guard-liveness's manifest-driven/fullsweep population does not see them; the changed-file arm compensates at pre-push and no gate is violated — but the exclusion is undeclared | **RECORDED:** `dispositions.md` entry `disp-c5-rules-manifest-registration` (owner-stage S2), declaring the exclusion until registration lands |
| C6 | OBSERVATION, SWEPT-CLEAN (7) | Sibling vitest include-grammars (runtime-bridge, presets, templates — ~10 configs) sit outside principle 53's grammar ratchet; bounded by the declared K6 scope, not a silent gap | NO-ACTION — already the recorded honest limit (`honest-limits.md` §outside-S1-class) |
| C7 | DECISION-NEEDED (2) | SSOT-row append for the three new capability areas is deferred (out of write scope) and properly recorded, but the timing/mechanism is a coordinator fork | **DECISION-NEEDED** — surfaced in the REPORT for the coordinator; the executor does not pick this fork |

### Post-review re-verification (raw)

- `node scripts/test-assurance/verify.mjs --stage S1 --step dispositions` → `5 disposition
  entries valid; coverage complete for 2 non-killed/non-equivalent + review-routed
  obligation(s)`, exit 0 (C4/C5 entries absorbed; denominator unchanged).
- Full acceptance re-run after the C3 fix: `logs/batch-i/gate4-verify.log` →
  `VERIFY-SUMMARY stage=S1 steps=10 pass=10 red=0 infra=0`, `VERIFY VERDICT: ACCEPTED`,
  `GATE4_EXIT=0`; counterfactuals step `5/5 replays exit 0` (cf3/cf4 exercised post-fix),
  driver/delivery/suites/tsc all PASS. Pre-fix receipt preserved as
  `logs/batch-i/gate4-verify-run1-prereview.log` (that run's 10/10 ACCEPTED was captured
  BEFORE the C3 fix, so the post-fix run is the binding one).
- No structured JSON gate block was emitted by this reviewer (markdown verdict format);
  the verdict sentence above is quoted verbatim from its report.

## Rework round 1 (2026-10-08 — auto-review gate, 4 blocking findings)

The post-Batch-I auto-review returned `request_changes` with 4 blocking findings
(0fe2b7f6c0b6, 30e8a7fe4b5e, 46e3501f339f, b55cd1aeca20). Resolution receipts, in finding
order; every claim below cites a raw log in `logs/batch-i/`.

1. **0fe2b7f6c0b6 (uncommitted evidence trio)** — committed: `gate5-triage.md` +
   `gate5-sweep.log` (the latter `git add -f` against the `*.log` ignore, matching its
   tracked siblings) with the `batches.md`/`dispositions.md` deltas, as commit `5bc65bd54`.
2. **30e8a7fe4b5e (driver gitEnv scrub)** — `driver.mjs` grew `gitEnv()` (identical
   GIT_DIR/GIT_COMMON_DIR/GIT_WORK_TREE/GIT_INDEX_FILE scrub to verify.mjs:89-96) and every
   git spawn routes through it: the `git()` helper AND the `finally`-block
   `git worktree remove --force` (the reviewer cited only the helper; the cleanup spawn had
   the same hazard). RED/GREEN pair on final bytes:
   - pre-fix `GIT_DIR=/tmp/no-such-repo node scripts/test-assurance/driver.mjs --arm D1-PERM-Q1`
     → exit 3 `INFRASTRUCTURE-FAILURE: git show HEAD:... failed (rc=128): fatal: not a git
     repository: '/tmp/no-such-repo'` — `logs/batch-i/gitdir-red.log`;
   - post-fix, same command → exit 0, arm DETECTED, restored hash-proven —
     `logs/batch-i/gitdir-green.log`;
   - post-fix full 6-arm run → exit 0, `MAIN-CHECKOUT carriers porcelain-clean`,
     `DRIVER VERDICT: pass` — `logs/batch-i/gitenv-scrub-full-driver.log`.
3. **46e3501f339f (queue entry must execute at promote)** — the bundle itself sits OUTSIDE
   the S1 write fence (and a rebuild on this container's fast-uri 3.1.7 node_modules would
   inline the wrong copy vs lockfile 3.1.8), so the enforcement is delivered in-fence:
   verify.mjs gained a `--promote-gate` mode (fail-closed artifact check over
   `PROMOTION_GATES` + built-in both-ways flip control via `withTamperedFile`), and
   `stepDispositions` now REFUSES (exit 1) a stale-bundle entry whose `promotion_gate` field
   does not name the gate run — a MUST note is not a mechanism. The queue entry carries the
   field. Evidence: `logs/batch-i/promote-gate-red.log` (exit 1 BLOCKED + repair + control
   DETECTED, BLOCKED→RESOLVED, restoration hash-proven),
   `logs/batch-i/promote-gate-shape-refusal.log` (exit 1 on a stripped field),
   `logs/batch-i/promote-gate-mutual-exclusion.log` (exit 3 on combined modes). Replay:
   `replay-commands.md` §Promotion gate; claim limit: `honest-limits.md` (content-level).
4. **b55cd1aeca20 (AGENTS.md disclosure → PR body)** — the disclosure + fold-vs-queue
   rationale moved out of the 597-line `batches.md` (3-line headroom) into
   `docs/test-assurance-kernel/s1/pr-body-disclosures.md`, written for verbatim inclusion in
   the PR body; `batches.md` Batch-H outcome block points at it.

### Amendment discovered during the rework (at-base defect, not reviewer-caused)

The first post-scrub full driver run failed at arm D2 (`patch does not apply exactly once
(occurrences=0)`, exit 3): commit `899d33df6` (prettier-format + twin rebuild, already on the
branch) reformatted `packages/core/eslint-rules/require-effective-assertion.mjs`, so the
frozen D2 `patch.from` (the single-line `lower.startsWith(...)` disjunction) no longer
occurred in the carrier. Fixed by re-pinning that ONE field to the reformatted three-line
expression (semantic fault unchanged: recognizer → `return false`); D2 carries no
`expectedSha256` pin, so no sha re-freeze was needed. The other five arms verified
un-drifted (occurrences=1 each). This is the same amendment class as the F1/F2/E1/C1
append-only precedent: a frozen INPUT re-pin caused by an out-of-band carrier reformat, with
the full 6-arm run at the re-pinned bytes as the binding receipt
(`logs/batch-i/gitenv-scrub-full-driver.log`, exit 0).
