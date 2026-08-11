# Round-2 cold verification — `2026-08-10-triage-kernel-v2-design.md` (r1-repaired)

VERDICT: REVISE

Seat: cold round-2 verification. No authoring context received; judged from the spec on disk
plus the two round-1 reports. Read-only for every repo artifact; this report is the only file
written. Scope per the task: (1) completeness of §13 dispositions, (2) existence of each
claimed repair, (3) substance against the r1 report's own wording, (4) regression sweep,
(5) faithful representation of the two ESCALATED items (their substance NOT re-litigated).

Spec line numbers below are the file's own numbering at
`docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md` (463 lines).

---

## §1 Completeness — every r1 finding has a §13 disposition

Enumerated both reports independently before reading §13.

**Top-down r1** (2 BLOCKER / 9 MAJOR / 5 MINOR / 2 ESCALATED + 6 notes-lane items) — all 18
graded findings carry a §13 row (`:432-461`). The 6 notes-lane items are not required by the
task's enumeration; 4 of 6 are nevertheless dispositioned inline (§7 micro-PR `:300-301`;
channel/Class declaration `:280-282`; SSOT id ≥250 `:322`; the `Prior-art:`/SSOT same-commit
sequencing `:322`). The two remaining (the two «positive» notes) need none.

**Bottom-up r1** (5 MAJOR / 7 notes) — all 12 carry a §13 row: BU M1 folded into the TD B2 row
(`:434`), M2 into the TD M3 row (`:441`), M3/M4/M5 at `:448-450`; N1 folded into the TD MINOR
row (`:451`), N2-N7 at `:454-456`.

**Result: zero MISSING-DISPOSITION.**

---

## §2 Per-finding verification table

Legend: `VERIFIED` = repair exists and addresses the finding as r1 stated it · `PARTIAL` =
repair exists, part of the stated defect stands · `NOT-FIXED` = label without substance.

| r1 finding | Claimed disposition | Result | Evidence |
|---|---|---|---|
| TD B1 — 2 of 3 axes unmeasured; class space incoherent | FIXED | **VERIFIED** | Three-axis labeling `:159-165`; binary class axis + advisor-vocabulary mapping (`OUT-OF-CONCEPT`→`whose_final: advisor`, `FLOOR`→`operator-floor`) `:140-149`; per-axis bars `:243-246`; per-question provenance `corpus-measured` vs `judgment-only` `:244-246`, `:283-284`. The «scored wrong by construction» half is closed: those verdicts now score on the `whose` axis, and the judge contract emits all three `:201-203`. |
| TD B2 / BU M1 — C0 degenerate + contaminated; `label_final` enum undefined | FIXED | **VERIFIED** (see NEW-B1) | C0 = `orig_grade` mapping `:209-217`, scenario-presence explicitly withdrawn with its reason; start-vs-final demoted to a biased descriptive stat, «never compared against blind candidates» `:218-220`; D-K8 `:400-404`; enums `:135-142`; strict one-line judge contract + per-axis JS assertion replacing the single `equals` `:200-205`. Both r1 arms addressed as stated. A **new** contamination path re-opens the same failure shape — NEW-B1. |
| TD M1 / M6 — circularity; MATERIAL-b single-judge; weak anchor | FIXED (partly as recorded limits) | **VERIFIED** | Stratified slice, 5 of ~15 rows drawn from the MATERIAL-b/disputed stratum (r1: expected yield ~1.6 rows) `:184-190`; anti-asymmetry labeling instruction `:177-180`; provenance sharing recorded `:255-260`. The n≈15 power limit is stated, not hidden (`:189-190`) — the disposition's own «partly as recorded limits» hedge is honest. |
| TD M2 — construct transfer | RECORDED + monitored | **VERIFIED** | `:261-266` — decontextualized-vs-in-situ shift stated, self-grading direction named, live detectors named (L5 morning review, materiality-dispute rate, audit-mold re-measurement), C2 named as closest to live shape. Label matches substance (no FIXED claimed). |
| TD M3 / BU M2 — `Basis` leakage; blindness unachievable | FIXED | **PARTIAL** | Source switched from audit tables to PR bodies `:150-153` — the real fix, and it is present. But the backstop probe is defective by construction (NEW-M1) and the contract's mandated source does not exist for two of the seven corpus files (NEW-M2). |
| TD M4 — no noise floor; undefined reference | FIXED | **PARTIAL** | `:236-242` — McNemar-style discordant-pair count, binomial CI, MDD ≈ ±9pp at n≈120, and arm (b)'s reference now named («C0's own miss-rate on the same scored subset»). Both r1 gaps addressed. Residual: «beyond the noise floor» is still not an operational pass/fail rule (NEW-m1). |
| TD M5 — `/arch` population missing | FIXED | **PARTIAL** | `arch-reviews.csv` declared `:125-127`. The file name exists; under the §2 extraction contract it cannot be populated — NEW-M2. |
| TD M7 — journal seeding trips D-AP4 | FIXED | **VERIFIED** | Segregated journal section `class: corpus-adjudication`, excluded from the volume trigger `:180-183`; D-K4 re-cut `:379-384`; §8.3 consumer updated `:312-313`. r1's «must be decided before S3» is satisfied. (Trigger mis-attribution: NEW-m3.) |
| TD M8 — no cost estimates / L4 budgets | FIXED | **VERIFIED** | §9 gains `LLM-call order` + `L4 budget` columns, per-stage `2 rounds → ASK` `:317-324`; whole-contour ~400-600 calls `:326`. Rounds-only budgeting matches effort-worthiness §2 L4 («Rounds only at v1»). (S1's own number: NEW-m4.) |
| TD M9 — asymmetry quantity unmeasurable | FIXED as honesty | **VERIFIED** | Metric renamed `MATERIAL-miss-among-raised-findings` `:203-204`; §5b.3 `:267-270` states the inverse population is out of reach and routes it to the production-audit channel; D-K5 two-direction falsifier `:388-390`. Checked the dangerous-direction detector for theatre: it is workable, because the severity contract records suppressed findings in the notes lane (`reviewer-discipline.md §6`), so an audit-mold re-measurement has an artifact to read. |
| BU M3 — population overlap (~11 duplicated rows) | FIXED | **VERIFIED** | Disjointness by subtraction: `audit-1369.csv` = «the ~104 audit §4 rows **minus** the #1341 round-7 rows» `:120-123`, plus id/text uniqueness check as S1 DoD `:118-120`. Confirmed against the source: the #1341 table (audit `:139-153`) holds 5 R1-R6 rows + 6 R7 rows; the cut is clean. |
| BU M4 — SSOT entry staged after the capability commit | FIXED | **VERIFIED** | §9 S4 «SSOT entry (id ≥250) in the same commit» `:322`; echoed §1 `:107-108`, §4 `:197-198`. Matches the live detector's behaviour (`prior-art.ts` — a devDependency addition is a capability commit; a citation to an unwritten entry returns code 3). |
| BU M5 — `td-m3.csv` cites one of two incidents | FIXED | **VERIFIED** | Dual citation §0 `:39-43` and §2 `:123-125`; and the under-representation guard is widened from `research-forks.csv` alone to «EVERY thin file» `:129-132` — the second half BU M5 named. |
| TD m-1 / BU N1 — stale `pr-body-fidelity.ts:165` cite | FIXED | **VERIFIED** | `:36-38` now cites `:212` and states the cause. Confirmed on disk: `pr-body-fidelity.ts:212` is `} else if (!headSha.toLowerCase().startsWith(sha[1].toLowerCase())) {`, message at `:217`. |
| TD m-2 — κ prevalence paradox | FIXED | **VERIFIED** | κ + raw agreement + PABAK per axis `:165-168`; the class set κ runs on is now stated (binary), which was r1's second ask; D-K2's low-κ falsifier is re-conditioned on «raw agreement also low» `:370-372`. |
| TD m-3 — first tracked CSV under `docs/` | FIXED | **VERIFIED** | S1 «docs-gate pre-flight: principle 09 + doc gates on the new folder» `:319`. |
| TD m-4 — no §self-application | FIXED | **VERIFIED** | §12b `:414-423`, with an honest negative (§2/§3 protocol choices are argument-accepted, not measured) rather than a label. |
| TD m-5 — S1 pre-fills judgment fields | FIXED | **VERIFIED** | «S1 never pre-fills judgment axes … layer/whose have no `_start`» `:164-165`; consistent with §2's field list (no `layer_start`/`whose_start`) `:140-142`. |
| BU N2 — three-vs-four regraded MINORs | FIXED in place | **VERIFIED** | `:38-39` records the upstream inconsistency and fixes the counting rule («S1 counts from the table»). |
| BU N3 — unrecoverable `#1297` split | FIXED in place | **PARTIAL** | `UNRECOVERABLE` added to the `class_start` enum `:137-139`. The new value has no route through §3.3 — NEW-M3. |
| BU N4 — ambiguous §3 self-reference | FIXED in place | **VERIFIED** | `:327-329` «the skill's §3, not this spec's». |
| BU N5 — unstable changelog locator | FIXED in place | **VERIFIED** | Per-spec locators enumerated `:126-127`. Spot-checked: `night-v3 §13` resolves (`2026-08-09-autonomous-night-v3-design.md:424`), advisor §11/§11b resolve (`:518`, `:544`). (§13b of night-v3 not enumerated — notes lane.) |
| BU N6 — S5 edits a maintainer-owned artifact | FIXED in place | **VERIFIED** | `:323` names the handoff explicitly with its precedent (#1374). |
| BU N7 — §7 disposition set extends its source | FIXED in place | **VERIFIED** | `:298-300` states `FIXED` is this spec's addition and grounds it in live use. |
| TD ESCALATED-1 — proportionality of this scale | OPEN-FOR-OPERATOR | **PARTIAL** (representation) | `:456-459` carries the cheaper-probe fork faithfully; it drops the effort-worthiness §1(b) obligation the r1 finding rested on — NEW-m2. |
| TD ESCALATED-2 — is a null result worth the cost | OPEN-FOR-OPERATOR | **PARTIAL** (representation) | `:459` restates E2 faithfully; §5's «money saved» phrasing that E2 targeted is gone (`:250-251`). The added gate note `:460-461` points the operator in the wrong direction — NEW-M4. |

**Counts:** VERIFIED 19 · PARTIAL 7 · NOT-FIXED 0 · MISSING-DISPOSITION 0.

No disposition was found to be pure label-over-standing-defect. Every PARTIAL is a
repair that exists and does real work, with a named residue.

---

## §3 New findings

### NEW-B1 (BLOCKER) — `orig_grade` leaks into the corpus through the verbatim finding text, so the new C0 bar is measured against labels that already saw it

`:161-163` states the cold seat is «blind to `class_start`, to `orig_grade`, and to the
audit's prose (blindness is now *constructed* by the §2 extraction contract + leakage probe,
not asserted)». Neither named mechanism touches `orig_grade`:

- `:135-136` — `finding` is a «verbatim quote **from the PR body's own finding text**».
- `packages/core/hooks/checks/pr-body-fidelity.ts:60` — `FINDING_GRADE_RE =
  /^(?:[-*][ \t]+)?\**\[?(BLOCKER|MAJOR)\b/`, the live gate requiring that a
  `## Review findings` entry be **opened by** its grade token. The grade is therefore the
  first token of the very text §2 mandates be quoted verbatim.
- The audit's own enumeration shows grade tokens inside finding text independently of
  headings: `2026-08-10-review-effort-theatre-audit.md:122` («R1 M1: tier assertion …»),
  `:125` («R1 M4: skip-that-passes …») — the finding IDs encode the grade.
- `:153-156` — the leakage probe's fixed phrase list is five `Basis` phrases; zero grade
  tokens, zero finding-ID patterns.
- `:199-200` — the bench shim strips `*_start`/`*_cold`/`*_final`/`orig_grade` **columns**;
  text-embedded grades in the `finding` column pass straight through to every candidate.

`Failure-scenario:` S1 builds the CSVs per the extraction contract; ~all rows carry their
grade token inside `finding`. S2's cold seat, instructed to be blind to `orig_grade`, reads it
in the first token and anchors on it, so `class_cold` — and therefore `class_final` on every
agreed row (`:169-170`) — becomes a near-copy of the C0 mapping. C0's agreement with
`class_final` approaches ceiling and no candidate can clear it by ±9pp (`:239-241`). S4
publishes «no layer beats C0», which `:250-252` blesses as a legitimate outcome. The corpus
budget (~400-600 calls, `:326`) is fully spent and the contour's one question is unanswered —
the exact failure the r1 TD BLOCKER-2 named, re-entered through the r1 repair itself. Worse:
the same tokens reach C1/C2 (`:199-200` strips columns only), so the bench measures which seat
reads a grade token, not which classifies materiality — and §0's «no mechanism trusted by
argument, only by its score» becomes false for the shipped result. Repair is cheap (strip
grade tokens + finding-ID patterns in the contract; add them to the probe's fail list), but
until then the acceptance rule cannot produce its number.

### NEW-M1 (MAJOR) — the anti-leakage probe fails S1 deterministically on correctly-built rows

`:153-156` greps the built `finding`+`context` columns for «fail-open», «can't-fail»,
«nothing downstream reads», «no claim changed», «evidence weight flipped»; «any hit fails S1».
Three of those phrases occur in *finding* text, not only in `Basis`:

- `2026-08-10-review-effort-theatre-audit.md:144` — finding column: «R1–R6: N5 stub
  **fail-open** (catch-all `rc=0`)»; Basis column: «fail-open».
- `:145` — «failed per-mode PUT warned and fell through to `DONE`», Basis «fail-open».
- `:146` — «`_ND_SEEN` subshell assertion **could not fail**», Basis «can't-fail assert».

These are designated corpus rows (`audit-1369.csv`, #1341 R1-R6 — `:120-123`).

`Failure-scenario:` S1 extracts `finding` verbatim from the #1341 PR body exactly as the
contract requires; the row reads «N5 stub fail-open (catch-all rc=0)»; the probe hits and
fails S1's definition-of-done. The two rational unblocks both damage the corpus: paraphrase
the quote to dodge the grep — voiding the verbatim contract at `:135` and the fidelity the
whole corpus rests on — or drop the row, losing a designated MATERIAL anchor. Nothing in §2
distinguishes «this phrase is the finding's own wording» from «this phrase was copied from the
label rationale», which is the discrimination the probe claims to make.

### NEW-M2 (MAJOR) — `arch-reviews.csv` and `research-forks.csv` cannot be built under the §2 extraction contract; their only available text is the banned shape

`:150-152` binds `finding`/`context` to «the PR bodies themselves (`gh pr view <n> --json
body`), NEVER from the audit §4 tables — the tables' `Basis` column IS the label rationale».
But `:125-130` sources both new files from **spec disposition changelogs** (advisor §11/§11b,
session-bus-v2 §14, night-v3 §13, this spec §13) and research-patch dispositions. Those
findings were never in a PR body — arch design reviews produce report files, and:

- `2026-08-10-advisor-pattern-design.md:520-521` names its sources as
  `top-down-advisor-pattern.md` / `bottom-up-advisor-pattern.md`;
  `ls ~/.claude-coordination/rules-as-tests-aif/ | grep -i advisor` → no such directory. The
  same holds for session-bus-v2 and night-v3. `git ls-files | grep -c claude-coordination`
  → `0`: the coordination tree is untracked host-local state, outside `gh pr view` and outside
  the repo.
- What survives is the changelog cell itself, and its shape is the one TD M3 banned:
  `2026-08-09-autonomous-night-v3-design.md:426-436` is a two-column
  `| Finding | Disposition |` table where `Finding` is an author-written compression sitting
  beside its own rationale; `2026-08-10-advisor-pattern-design.md:523-539` is the same in
  prose («TD M2 (spend dormancy = envelope edit) — **FIXED** (§5.2: …)»).

`Failure-scenario:` S1 reaches `arch-reviews.csv`, finds no PR body to fetch, and takes the
only text available — the changelog `Finding` cell, written by the author who had already
decided the disposition and printed next to it. The probe's five audit-specific phrases
(`:154-156`) do not cover disposition-changelog rationale, so the leak passes clean. The
population added specifically to cover the highest-materiality surface (r1 TD M5: «the highest
materiality review surface receives the least-validated instrument») ships as the most
leakage-contaminated file in the corpus — or, if S1 obeys the contract literally, ships empty
and TD M5 stands unrepaired. Two r1 repairs are mutually unsatisfiable as written and nothing
in §2/§3/§9 forces the choice.

### NEW-M3 (MAJOR) — `UNRECOVERABLE` rows have no route to `class_final`

`:137-139` adds `UNRECOVERABLE` to `class_start` for rows where the audit recorded only
aggregates (the `#1297` «7 M + 3 M-b» split — `2026-08-10-review-effort-theatre-audit.md:188`,
10 rows). §3.2 excludes them from the class κ `:167-168`. §3.3 then splits the corpus
exhaustively into «class-axis agreeing rows → `status: agreed`, `class_final = class_cold`»
and «Disagreeing rows + ALL `class_start: MATERIAL-b` rows → advisor adjudication»
(`:169-172`). A row with no comparable start value neither agrees nor disagrees, and is not
`MATERIAL-b` — it falls out of both branches.

`Failure-scenario:` S3 completes with its stated DoD met; ~10 rows (~8% at n≈120) carry an
empty `class_final`. S4's per-axis assertion (`:203-205`) either throws on them or silently
drops them, shrinking the scored n without a line in the report — while §5's acceptance turns
on a ±9pp margin (`:239-241`), which 8% of the corpus can move either way. The alternative
default a reader might infer — `class_final = class_cold` unopposed — produces a different
corpus and a different verdict, and the spec does not choose between them.

### NEW-M4 (MAJOR) — the §13 gate note tells the operator the C0 repair softened ESCALATED-2, when the repair most likely sharpens it

`:460-461`: «Note for the gate: the r1 C0 fix removes the bias-toward-null that sharpened E2.»
The *bias* claim is true (C0 no longer inherits from `class_final`). The claim the operator
will act on — that E2 is defused — does not follow, and the evidence points the other way:
C0 now maps `BLOCKER/MAJOR → MATERIAL`, `MINOR → IMMATERIAL` (`:209-211`) against grades that
were assigned by seats reading the full diff. Checked against the corpus source:

- `2026-08-10-review-effort-theatre-audit.md:188` — `#1297`: 2 BLOCKER (both M), 10 MAJOR
  (7 M + 3 M-b), 10 MINOR (all I). C0 scores ~22/22 on that loop alone (~20% of the corpus).
- Across the four per-row tables (audit `:99-153`; the compressed remainder at `:178-188`
  records no per-row grade at all) the recorded grades are 16 MAJOR / 16 MINOR
  / 5 «—» / 3 «(M4)» / 2 «none»; C0's visible misses concentrate in one place — the six
  #1341 R7 rows (`:148-153`), four of which the audit regrades MATERIAL.

A rough read puts C0 near 0.8-0.9 agreement, i.e. a candidate must reach ~0.9+ to clear the
stated ±9pp floor. (Confidence: derived from the audit's own tables, not from a run — wrong if
adjudication moves `class_final` sharply away from the original grades.)

`Failure-scenario:` the operator reads the gate note, treats E2 («is a null worth the full
corpus cost?») as answered by the r1 repairs, and gives GO. S1-S4 spend the ~400-600-call
budget (`:326`). C1 lands a few points above a strong C0, inside the noise floor; the contour
publishes the honest null that `:250-252` blesses; the value question the operator was asked
to decide at the gate is answered post-hoc by a spent budget — E2's own scenario, now reached
*through* the note that said it was defused. This is a representation defect in decision input
routed to the concept holder, not a re-litigation of E2's substance (which I do not price).

---

## §4 MINOR lane

- **NEW-m1 — «beyond the noise floor» is stated as an apparatus, not a decision rule.**
  `:236-241` requires the report to state a McNemar-style discordant-pair count and a binomial
  CI, but never says what clears the bar (CI excluding zero? p<0.05?). r1 TD M4 asked for «a
  minimum detectable effect, a confidence interval, a significance test»; two of three landed.
  The «thresholds are config, not statute» hedge covers the ±9pp value, not the absence of a
  rule form.
- **NEW-m2 — ESCALATED-1's §13 summary drops the half that grounds it.** `:456-459` carries
  the cheaper-probe fork but not r1's citation of `effort-worthiness.md §1` («whoever demands
  a probe … must state (a) what breaks if we skip it and (b) what learning-in-practice costs
  instead») nor the observation that §1's `research-grade` label is still grounded only in
  «the load-bearing half of the D-AP5 split» (`:104-105` — unchanged in r1). The operator gets
  the fork without the rule obligation the r1 seat rested it on.
- **NEW-m3 — D-AP4 has no «journal volume» trigger.** `:182`, `:312`, `:381-382` all attribute
  a volume trigger to D-AP4. `2026-08-10-advisor-pattern-design.md:487-490` reads: «*Falsifier:*
  kernel-v2 corpus evaluation shows precedent retrieval scoring above the v1 baseline →
  promote». The volume trigger is this spec's own D-K4. The segregation mechanism works
  regardless; the citation does not. Second-order: D-AP4's actual falsifier names a kernel-v2
  corpus evaluation, which §8.3 defers — a dangling upstream trigger nothing now closes.
- **NEW-m4 — S1's «~0 (mechanical)» estimate predates the S1 the r1 repairs produced.**
  `:319` keeps `~0 (mechanical; PR-body fetches)` at executor tier, while r1 added to S1: the
  extraction contract (locating and verbatim-quoting ~104 findings inside ~13 PR bodies),
  the leakage probe, the cross-file uniqueness check, two new mined populations, and a
  docs-gate pre-flight. Matching a compressed audit enumeration (audit `:178-188`, prose
  fragments with no per-row grade) to its verbatim counterpart in a PR body is a reading task,
  not a mechanical one. The L4 tripwire («2 dispatch rounds → ASK») fires only after the
  mis-routing has already happened.

## §5 Notes lane (scenario-less — trigger nothing)

- `:283-284` routes the reader of the deployed provenance label to §5, not §5b, so the
  construct-transfer limits recorded for TD M2 are one hop off the path a future citer takes.
- `:126-127` enumerates `night-v3 §13` but not its `§13b` round-2 changelog
  (`2026-08-09-autonomous-night-v3-design.md:452`); same for other specs with a second round.
- «disjoint **by construction**» (`:118`) is disjoint by *detection*: `arch-reviews.csv` and
  `research-forks.csv` draw from the same per-spec disposition changelogs (`:126-130`) with no
  assignment rule, so the uniqueness check will fail S1 and hand the assignment back with no
  criterion. Fails closed, which is the right shape — the phrase over-claims.
- `:324` gives S5b no L4 budget («—»). Consistent with ~0 calls; noted only for completeness.
- Verified and holding, listed so a later seat need not re-check: D-K5's dangerous-direction
  falsifier is *not* theatre — suppressed findings leave notes-lane artifacts
  (`reviewer-discipline.md §6`), so an audit-mold re-measurement has something to read.
- Verified clean: `pr-body-fidelity.ts:212` (TD m-1), `reviewer-discipline.md §6` dispute
  vocabulary matches §2's mapping, night-v3/advisor changelog locators resolve, the
  #1341 round-7 subtraction is arithmetically clean against audit `:139-153`.

## §6 Fork for the gate (not decided here)

`:463` declares the round cap reached at the close of round 2. This report is REVISE with one
BLOCKER. Whether the repairs go to a round 3 (cap breach), to the operator gate with findings
attached, or to an L4-style ASK is the concept holder's call — precedent exists both ways
(`2026-08-10-advisor-pattern-design.md:544` closed at cap). Surfaced, not chosen.

## §7 Role bounds

Every new finding is a defect or a representation defect with a concrete failure; none picks
between design alternatives (how to strip grade tokens, how to build the arch population, how
to route `UNRECOVERABLE` rows, and what threshold clears the noise floor are all the author's
calls). No finding here rests on an unrecorded value premise, so nothing is graded ESCALATED;
the substance of TD ESCALATED-1/-2 is untouched — NEW-M4 and NEW-m2 concern only whether the
gate receives them undistorted.
