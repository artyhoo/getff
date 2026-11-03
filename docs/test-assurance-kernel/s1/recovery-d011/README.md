# D011 recovery records — conditional source cycle (2026-10-14)

> Provenance: the ONE conditional D011 S1 source-repair cycle authorized by the
> coordinator freeze GO (amended4-independent-freeze-GO, SHA256 429f946a…) + the shared
> ownership ACK (D011-SHARED-OWNERSHIP-ACK.json, SHA256 a034425f…). Everything here runs
> against the implementation checkout `codex/tak-s1-d011` at the cited HEADs; the
> original S1 artifacts (six-arm driver, expectations.json, driver-expectations.json,
> original32 corpus) are byte-identical throughout — never regenerated, never weakened.

## What landed (batch order, each at a verified green boundary)

| Batch | Commit | Content |
|---|---|---|
| SB1/R4 | `4dfcb591dac` | strict classifier + amended-3 four-anchor improvement wired to the real P52 caller; counterfactual-lib refusal arms |
| SB2/R1/R2 | `8efd4007e04` | guard-liveness selector/carrier alignment (extension globs from the selector's own population), fail-closed no-cover guard, dir-selected non-lintable recording |
| A5 | `8eef214687c` | carrier naming/location widening: root + ts-server + next-15 + spa configs (unit/audit/integration names, mts/cts) |
| R3 | `17e8c3ad5b1` | THIS batch: frozen recovery controls ported + mandatory verify step |

## The recovery controls (R3, `scripts/test-assurance/recovery-d011/`)

Oracle: `expectations-recovery.json` — the 14 amended-2 supplemental arms (12->14, none
dropped) with verbatim pristine/mutant observations, plus the A2/A3 lanes and the K3
receipt lines. Patch pins use the driver.mjs `applyPatchOnce` convention
`sha256(label + "\n" + from + "\n" + to)`; all 14 were verified against the ast-parsed
amended2-regions.py constants BEFORE the oracle was frozen, and every FROM occurs exactly
once in its carrier at the parent HEAD.

Driver: `driver.mjs` — per arm, a detached scratch worktree at HEAD + node_modules
symlink + hash-checked probe copies; pristine observations; the frozen patch applied
exactly-once (sha-pinned); mutant observations (expect present / expect_not absent);
byte-proven restore. Probe exit grammar 0|1: a mutant-phase rc-1 WITH the frozen flip in
stdout is the packet's own crash-after-verdict shape
(`dryrun-carrier-mutant-roottestsdir.txt`); an expect ending in a numeric comparison is a
predicate over the printed integer (the packet's `mismatches>0` form — its dry-run prints
`mismatches=30`). Exit grammar 0/1/3; INFRA is never a verdict.

Lanes:
- **A2** — GLV population repeatability: two runs in one worktree; run2 must print
  `GLV-RESET-COMMIT`, the fixture-commit parents must DIFFER, and the 26 verdict lines
  must be byte-identical.
- **A3** — `sb1-classifier-control.mts`: the 13 pinned classifier inputs replay green
  through the production export.
- **K3** — `k3/` (byte-identical amended-4 runners + the `run-k3-control.sh` port
  wrapper): the genuine Q3 judge admits the intended kills and refuses wrong-diagnostic +
  survival credit; the reviewer's exact permissive weakening (`f71e2cc8…`, expect_intended
  rejection predicate -> `if (false)`) is caught by the UNCHANGED outer control; the lib
  is restored from the committed blob, byte-proven.

Verify wiring: `['recovery-d011', stepRecovery]` is a MANDATORY unfiltered S1 step — a
missing, skipped, disconnected or empty control can never leave the adapter green
(rc-0 runs must still show 14/14 `RECOVERY-ARM … DETECTED` receipts).

## Receipts (this directory, sha256 at commit time)

| File | sha256 | What it proves |
|---|---|---|
| `run-final.log` | `3acb5d40…` | full green run at `17e8c3ad5b1^` sources (pre-R3-commit tree state): 14/14 DETECTED, A2/A3/K3 green, carriers porcelain-clean, EXIT=0 |
| `k3-standalone-receipt.log` | `c5c7ba33…` | standalone K3 wrapper receipt: pristine 0 -> mutant 1 (both cf2a/cf2b refuse lines) -> restored 0, `K3-ARM-OK` |
| `run-iteration2-RED-discovery-over.log` | `b0b28c3d…` | honest iteration record: RED at DISCOVERY-OVER before the predicate matcher (mutant printed `mismatches=30`; literal `includes('>0')` can never match) |
| `run-iteration3-RED-k3-wrapper.log` | `34b3b5b6…` | honest iteration record: RED at the K3 lane before the wrapper REPO_ROOT fix (`k3/` is one level deeper than `recovery-d011/`; three `..` landed on `scripts/`) |
| `run-battery-1-RED-suites.log` | `b9180c39…` | honest record: the FIRST full unfiltered 11-step S1 battery REDed at step `suites` (10 pass / 1 red) — principle 51's population ratchet found 12 vs the pinned 5 (the committed frozen fixtures widened the repo-wide `git ls-files` population) |
| `run-battery-final.log` | `bdcb6426…` | FINAL full unfiltered battery at the repaired tree: 11/11 steps PASS, `VERIFY VERDICT: ACCEPTED exit=0` (prereqs, k7-records, static-matrix, driver, recovery-d011 14/14, counterfactuals, delivery, suites 32/32, twins, tsc, dispositions 17 entries) |
| `tamper-arms-final.log` | `74b036ca…` | tamper arms T0/T1/T2 all DETECTED exit 0 at the final tree (byte-identical restores) |
| `promote-gate-final.log` | `284edc06…` | `--promote-gate` standalone: PASS exit 0, `disp-rework4-bundle-carrier-gate` RESOLVED with the both-ways flip control DETECTED |

## Full-battery closure (the suites RED and its repair)

The first full battery run surfaced exactly one RED: principle 51's **population ratchet**
(12 findings vs the pinned 5). Root cause: committing the recovery frozen fixtures
(`fixtures/population/**`, `fixtures/r4-runner/**`) widened the ratchet's repo-wide
`git ls-files` test population — the ratchet was working as designed, flagging the new
tracked files that carry deliberate Q1/Q2 violations. Repair (the S0 precedent — the pinned
set already carried S0's `q1-scratch` frozen fixtures under «frozen evidence artifacts … not
repair targets»): the 7 new findings pinned ADDITIVELY in
`packages/core/principles/51-test-quality-corpus-conformance.test.ts`
(`PINNED_POPULATION_FINDINGS`), original 5 rows untouched. Not a weakening: the set stays
exact — any other finding, or drift inside the fixtures (which are sha-pinned in
`expectations-recovery.json` and INFRA-refused by the recovery driver's
`verifyPinnedInputs` on hash mismatch), still REDs. Path is inside the D011 intake ceiling
(`unshared_existing_source_ceiling` lists this file with its pre-image hash), recorded in
the owned allowlist as batch `R3-FIX1-population-ratchet-pin` before the edit.

## K-mapping (the 14 arms + lanes)

- **K3 (regression detected)**: SUP-R1-INVOC-GLV, SUP-R2-GLV-GLOB, SUP-R2-FAILCLOSED,
  SUP-R2-SELECTOR-NAME, SUP-R2-ROOT-TESTS-DIR, SUP-R3-Q2-PERM, SUP-R3-Q3-PERM,
  SUP-R3-P52-WEAK, SUP-R3-P53-DELIVERY-PERM, SUP-R3-P53-DISCOVERY-PERM, K3 lane.
- **K4 (over-rejection detected)**: SUP-R3-Q1-OVER, SUP-R3-P52-EVAL-OVER,
  SUP-R3-P53-DISCOVERY-OVER.
- **K5 (delivery)**: SUP-R3-P53-DELIVERY-PERM (delivery channel sanitization), A5-carried
  carrier conformance observed through the carrier-enforcement probe's pristine lanes.
- **K6 (discovery/fail-closed)**: SUP-R2-GLV-GLOB + SUP-R2-FAILCLOSED (selected-but-
  uncovered never silently clean), SUP-R3-P53-DISCOVERY-PERM/-OVER (ratchet + reconcile
  both directions).
- **K7 (honesty)**: every PATCH line carries the pin sha + occurrence=1 + before/after
  hashes; restores are byte-proven; the two RED iteration logs are kept, not hidden.

## Non-claims (see also `../honest-limits.md` §D011)

- The historical be84 commit object remains MISSING — nothing here "recovers" it; the
  repairs reconstruct its governed behavior from the frozen packets, never its identity.
- Shared derived artifacts (three bundle/MANIFEST paths) remain HELD per the ACK —
  generation freshness is NOT claimed green here and cannot be until the coordinator's
  post-acceptance reciprocal generation.
- No PR/push/merge, no publication gates, no S2+ advance: source acceptance is the
  coordinator's decision on the presented HEAD.

## R4 shell-consistency correction (2026-10-14, chief-admitted)

Append-only entry for the one separately admitted finite source correction
(chief admissions `tak-r4-shell-correction-admission-20261014.json` sha256
`9cb85749…` and `tak-r4-control-integrity-delta-admission-20261014.json`
sha256 `cb057f0c…` — Chief under delegated repair authority; independent review
counterexamples `D011-R4-SHELL-UNHANDLED` / `D011-R4-SHELL-INCOMPLETE`). The
shell helpers in `scripts/test-assurance/counterfactuals/counterfactual-lib.sh`
now mirror the production classifier's strict subprocess semantics:

- `run_scratch_vitest` refuses the reporter's own unhandled-error channel
  (`Errors N` stdout line, the exact `classifyVitestReport` predicate) and the
  exit/report inconsistency (nonzero exit / `success=false` with zero failed
  assertions AND zero failed files) as INFRASTRUCTURE (exit 3) — a real
  unhandled rejection (frozen `unhandled.test.ts`: Vitest exit 1, Errors 1, all
  tests passed) is never an accepted pass. rc=1 WITH failed assertions stays
  legitimate. This is NOT a full grammar equivalence with the production
  classifier — the shell retains its own governed whole-suite-crash delivery
  shape below.
- the required-execution guard in `expect_file_status`, `expect_intended` and
  the FILE classification no longer spares failed files: a same-file
  failed+pending required case (frozen `cx3.json`, sha `11a36b2e…`) is refused
  by BOTH helpers (exit 1), never credited as an intended kill.
- whole-suite-crash exemption (narrow, evidence-gated): a failed FILE with zero
  assertionResults whose evidence lives in the file `message` — the deliberate
  whole-suite crash lane of `delivery/replay-fences-fire-deletion.sh:61-63` —
  stays assertable via `expect_file_status fail` + `expect_intended` on the
  message, never a silent pass. cx3 is unaffected (executed=1, refused by
  never>0); only `tr.status==='failed' && executed===0 && non-empty message`
  is exempt.

Controls: `r4-shell-control.mjs` + separately frozen `r4-shell-expectations.json`
(sha256 `c1eed1a0…`, bound by the control BEFORE reliance — an altered, empty,
duplicated or unknown-id oracle refuses as INFRA 3 with no receipts). 6 pristine
arms — the three refusals above, the fully-executed healthy and intended-fail
companions staying legitimate, and the fences-fire suite-crash companion — and
4 localized mutants: unhandled permissive, cx3 status masking, cx3 intended
masking, over-strict exit-1 refusal; each flips exactly its target arm,
restores byte-proven. The completion receipt (`R4-SHELL-CONTROL OK (pristine
6/6 …; mutants 4/4 …)`) is printed by the control ONLY after the actual
executions and restores completed, from actual counts/IDs. Wired as the
mandatory `R4-SHELL` lane in `driver.mjs`; `expectations-recovery.json` is NOT
altered. The original six arms, the 14 supplemental arms, the K3 anchors
(`f71e2cc8…`, J1 got-line) and the frozen corpus/oracles are byte-identical.
