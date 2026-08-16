<!-- scope:triage-kernel-v2-s4-bench -->

# triage-kernel-v2 S4 bench — C0/C1/C2 vs s3-final (2026-08-16)

> Stage S4 of the [triage-kernel-v2 router](../../../.claude/orchestrator-prompts/triage-kernel-v2/kickoff.md)
> (design §4/§5/§5b/§9 via [kickoff-s4](../../../.claude/orchestrator-prompts/triage-kernel-v2/kickoff-s4.md)).
> One-line result: **no layer beats C0 on class** (C1 0.687, C2 0.710 vs C0 0.733, n=131 — both
> McNemar legs far from α); **layer majority bar beaten by both candidates** (C1 0.662 p=0.0012,
> C2 0.642 p=0.0076 vs bar 0.530, n=151); **whose stays `judgment-only, not corpus-validated`**
> (both below the 0.901 bar). Measuring honestly is the stage's success criterion (D-K4) — that
> criterion is met. S4 ships numbers and verdict lines, no protocol text; deploying anything is
> S5's job. Reproduce: `node scripts/triage-s4-score.mjs` (report mode) / `--check` (arms A-H).

## Population enumeration (T10 — before any rate)

- **156 population rows** across six CSVs (`audit-1369` 88 · `s4-round7` 6 · `arch-reviews` 44 ·
  `kickoff-loops` 13 · `td-m3` 2 · `research-forks` 3).
- **5 `author-cell` rows never enter the bench** (design §2/§5b.5): `td-m3` 2 (`td-m3-1`,
  `td-m3-2`) + `research-forks` 3 (`rf-1`…`rf-3`) — enumerated and described, never scored.
- **Labelable population = 151** (= `s3-final.csv`, the adjudicated truth).
- **Class axis scored subset = 131/151 = 86.8%** (rows with `orig_grade != none`; D-K8 floor
  ~70% — holds with margin). Layer and whose are scored on all 151 (design §5 scopes the
  subset clause to the class bullet only). The bars are NOT population-invariant: on the
  131-subset `implementation` would be 56.5% and `reviewer` 93.9%, vs 53.0%/90.1% on 151 —
  every number below states which population it came from (arm A asserts the row counts).
- **C2 grouping** (key = `source`, fixed by the kickoff, never merged/split): **41 groups** —
  19 multi-row (sizes 19,18,12,10,10,9,7,6,5,5,5,4,3,3,3,3,3,2,2) + 22 singletons. A singleton
  «group» is C1 with a different prompt wrapper; its delta is reported separately.
- **Truth distribution** (S3 README §S3, unchanged): class MATERIAL=111/IMMATERIAL=40 · layer
  implementation=80/plan=39/design=19/architecture=13 (`idea` absent) · whose
  reviewer=136 (90.1%)/advisor=12/operator-floor=3.
- **C0 pre-read re-derived at run time** (kickoff §3.3 one-liner, verbatim re-run in Task 1):
  `{n:131, acc:0.733, miss:0.319, mm:64, mi:5, im:30, ii:32}` — exact match. Not inherited.

## Per-axis results (scorer output; denominators stated per number)

| Axis (population) | C0 / bar | C1 (per-row) | C2 (grouped) |
|---|---|---|---|
| class accuracy (n=131) | **0.733** | 0.687 | 0.710 |
| class MATERIAL-miss (n=131, among truth-MATERIAL) | 0.319 (30/94) | 0.351 | **0.266** |
| class κ / PABAK (n=131) | 0.453 / 0.466 | 0.359 / 0.374 | 0.348 / 0.420 |
| layer accuracy (n=151) | 0.530 (majority `implementation`) | **0.662** | **0.642** |
| layer multiclass κ (n=151) | — | 0.443 | 0.430 |
| whose accuracy (n=151) | 0.901 (majority `reviewer`) | 0.848 | 0.854 |

Per-class precision/recall on class (n=131): C1 MATERIAL 0.884/0.649 · IMMATERIAL 0.468/0.784;
C2 MATERIAL 0.841/0.734 · IMMATERIAL 0.490/0.649. Discordant pairs vs C0: C1 b=25 c=19
(McNemar exact p=0.4514, Wilson 95% CI on c/(b+c) = [0.297, 0.578]); C2 b=23 c=20 (p=0.7608,
CI [0.325, 0.611]). Layer vs bar: C1 b=8 c=28 (p=0.0012), C2 b=10 c=27 (p=0.0076).

## Acceptance verdict per axis — both legs shown separately (α=0.05 two-sided, fixed)

Method note (round-1 fidelity): leg 1 is **directional** — a PASS requires p < 0.05 AND the
candidate on the better side of the discordant split (c > b); a significantly *worse*
candidate fails it. No verdict changed under this rule: both class candidates failed leg 1
on p alone.

- **class, C1: DOES NOT SHIP.** Leg 1 (beats C0 beyond noise): p=0.4514 ≥ 0.05 — FAIL; CI
  [0.297, 0.578] straddles 0.5. Leg 2 (MATERIAL-miss ≤ C0's 0.319): 0.351 — FAIL. Both legs fail.
- **class, C2: DOES NOT SHIP.** Leg 1: p=0.7608 — FAIL (CI [0.325, 0.611]). Leg 2: 0.266 ≤
  0.319 — PASS. One leg passing does not ship a candidate.
- **Class-axis verdict line: no layer beats C0; C0 remains the class bar.** With n=131 the
  minimum detectable difference is ±9pp (this stage's declared power caveat) — the observed
  C1−C0 = −4.6pp and C2−C0 = −2.3pp are inside it, and «no difference beyond noise» is the
  correct reading of both McNemar results, not evidence of equivalence.
- **layer, both candidates beat the majority bar beyond the noise floor:** C1 p=0.0012, C2
  p=0.0076 vs the 0.530 bar on n=151 (paired correct/incorrect vs the constant predictor).
  Layer labels from a rubric judge carry real signal. Whether to DEPLOY a layer classifier is
  an S5 decision; S4 hands over the numbers.
- **whose: descriptive only — `judgment-only, not corpus-validated`.** Both candidates sit
  BELOW the degenerate 0.901 majority bar (C1 0.848, C2 0.854, n=151). The binding S3 ruling
  stands; no re-cut attempted (a second re-cut is an operator PARK, T-TK2-F).

## Confounding (§3.6) — a validity limit, measured

`class_final == class_cold` on 122/151; **29 rows differ, 25 inside the scored subset.** On
those 25 (where adjudication moved truth away from the S2 cold labels): **C0 0.760 vs C1
0.480**. On the 106 concordant rows: C0 0.726 vs C1 0.736. Reading: C1 shares the rubric AND
the model family with the S2 cold rater by design (§3.4), so where the advisor+operator
overrode cold, C1 follows cold, not truth — the bench's class-axis comparison is partially a
family self-agreement measurement, and that is exactly the §5b.1 independence caveat the
design names. Power statement: **n=25 — coverage insufficient to conclude** (T14); this slice
is reported, never gated, and is not a second acceptance rule.

## Validity limits (§5b carried forward + the two new ones above)

1. **Materiality is measured only among RAISED findings** (§5b.3) — defects never raised are
   outside any such corpus; every «miss» here is a miss among raised findings.
2. **Truth independence is qualified** (§5b.1): the only fully independent anchor is the
   operator slice; S4b's repository-state walk is the second axis of truth this bench lacks.
3. **The §3.6 confounding slice** (this report, above) — new in S4.
4. **Power**: class n=131 → ±9pp MDD; confounding slice n=25 → insufficient; singleton-delta
   n=9 scored rows → two flipped rows, noise.
5. **Whose axis degenerate** (90.1% majority) — descriptive only, verdict line fixed.

## Finding — the spec's honest C0 pre-read was falsified (§3.3)

Design §4 (r2 NEW-M4) expected C0 at «roughly 0.8-0.9 class-agreement» and named its own
falsifier: *«Wrong if adjudication moves `class_final` sharply away from the original
grades.»* It did: **measured 0.733 with a 31.9% MATERIAL-miss** (re-derived, matches the
kickoff one-liner exactly). Consequences, as the kickoff states them: the ESCALATED-2
«no layer beats C0» concern was weaker than the spec assumed — C0's miss-rate reference in
§5(b) is a HIGH bar to not exceed rather than a tight one — and the class gate did not need
its majority-class fallback. Recorded as a spec-pre-read correction, not a protocol change.

## C2 — delta over C1, with cost (never a standalone winner)

Class delta +0.023 on n=131 — **inside the ±9pp noise floor: no second-pass accuracy gain is
demonstrated.** Split by group size: singleton groups (22 rows, 9 in the scored subset)
+0.222 — that is two flipped rows at n=9, noise, stated with its denominator; multi-row
groups (129 rows, 122 scored) +0.008. **Cost: 41 calls vs 151.** A grouped second pass does
not earn its cost on accuracy alone at this corpus size; any C2 case must rest on cost per
call (fewer requests for the same rows) rather than accuracy, and that case belongs to S5.

## Runner decision (D-K3) — promptfoo ran; fallback never triggered

promptfoo@0.122.0 (devDependency, SSOT [#250](../prior-art-evaluations.md) — T16 problem-class
check vs #53 recorded there) drove both passes over an `exec:` provider shelling
`claude -p --model sonnet` — invocation byte-identical to the S2 cold rater, no tools, no
session state. C1: 151/151 parsed first pass, 0 re-runs (13 min, promptfoo default
concurrency 4 — per-call bytes unaffected by scheduling). C2: 41/41 parsed, 0 failures on the
final pass. The D-K3 plain-scorer fallback clause was never exercised: promptfoo did not fail.
**One incident, recorded:** the first C2 pass PARKed on strict parsing — sonnet emits a
one-line preamble («Looking at each finding through the yardstick:») before the id-keyed
lines on some groups, and one single re-run came back numbered (`[1]:`…) instead of id-keyed.
Root finding: the kickoff specified **no output contract for the grouped C2 pass** (§3.4
states C1's one-line contract; §3.5 states none for C2), so the strict-first parser was this
stage's own invention — the outlier, not the rule. The frozen S2 cold rater has always parsed
by SEARCH over the whole raw output ([`scripts/triage-s0-run.mjs:59`](../../../scripts/triage-s0-run.mjs) —
`RE.exec(raw)`, framing prose without a triple tolerated), and C1 rides those same semantics;
the refinement aligned C2 WITH that frozen contract rather than widening an acceptance rule
after seeing outputs. Genuinely ambiguous variants still reject by design: numbered `[1]:`
keys, duplicate keys, a triple outside an id-keyed line, out-of-enum values. The artifact was
rebuilt from the same judge outputs (41/41 served from promptfoo's disk cache —
byte-identical prompts), and no label was ever hand-filled or edited. Decision and precedent
are in `scripts/triage-kernel-v2-bench/run.mjs` (`parseC2Group` doc comment).
**PARK-shaped note for S5:** §3.5 specified no C2 output contract; the frozen-search
semantics were adopted and are ratified here — S5 must not inherit the gap silently as if
the contract had been specified up front.

Parse-regex divergence note (no action this round): the frozen rater's layer pattern matches
`[a-z]+` (`scripts/triage-s0-run.mjs:59`) while the bench's TRIPLE_RE matches `[a-z-]+`
(`scripts/triage-kernel-v2-bench/run.mjs:30`) — a hyphenated layer value would parse in the
bench and not in the frozen rater; no current label is affected. Neither regex changes here.

## Environment probe record (Task 1, re-run 2026-08-16 this session)

| Probe | Result | Consequence |
|---|---|---|
| node / npm / claude | v22.23.1 / 10.9.8 / 2.1.218 | matches kickoff §5 |
| `npm view promptfoo version` (default cache) | **EACCES** on `/home/node/.npm/_cacache` | drift 1 (recurred): every npm/npx call prefixed `npm_config_cache=/tmp/aif-npm-cache-s4` |
| same, with /tmp cache | `0.122.0` | install pinned `^0.122.0`, commit `0880843378` |
| `gh auth status` | **not logged in** | drift 2 (intra-day flip vs kickoff §5 same-day probe): the `--bodies` cached route was NOT needed — §9 forbids egress and none was attempted |
| `AGENT_MAX_REVIEW_ITERATIONS` | **unset** | §9 Lever 1 unexercised; recorded |

## Outcome axis (filled by S4b)

Reserved: [kickoff-s4b](../../../.claude/orchestrator-prompts/triage-kernel-v2/kickoff-s4b.md)
walks the same 151 rows against the live repository tree — the anchor this bench does not
have. This report makes no outcome-axis claim.

## Self-application (T15)

The corpus grades review findings; this stage IS a review-shaped process, and the corpus
contains this contour's own neighbourhood (`audit-1369` rows come from the review-effort
audit; `kickoff-loops` includes kickoff-revision findings of sibling contours). Auditing this
audit: (a) the §3.3 falsification above is the bench catching its own spec's wrong
expectation before anyone consumed it; (b) the C2 parse-refinement incident was caught by the
PARK discipline working as designed — the failure mode (fitting the parser to the data) was
bounded by refusing positional-key rescue and rebuilding only from cached raw outputs; (c)
the eight `--check` arms are this repo's rules-as-tests doctrine applied to the bench itself
(blindness, provenance, subset honesty, substrate immutability), and T19's own cold review of
the full diff closes the loop. What would auditing THIS audit look like: a fresh seat
re-deriving every number in the table above from `s4-c*.json` + `s3-final.csv` without the
scorer — all inputs are committed for exactly that.

<!-- s4-numbers (canonical block — pasted verbatim into the report; arm E reconciles)
labelable_n=151
subset_n=131
class_n=131
c0_class_acc=0.733
c0_class_miss=0.319
c0_class_kappa=0.453
c0_class_pabak=0.466
c1_class_acc=0.687
c1_class_miss=0.351
c1_class_kappa=0.359
c1_class_pabak=0.374
c2_class_acc=0.710
c2_class_miss=0.266
c2_class_kappa=0.348
c2_class_pabak=0.420
c1_mcnemar_p=0.4514
c1_ci_disc=[0.297, 0.578]
c1_class_b=25
c1_class_c=19
c2_mcnemar_p=0.7608
c2_ci_disc=[0.325, 0.611]
c2_class_b=23
c2_class_c=20
layer_bar_acc=0.530
layer_n=151
c1_layer_acc=0.662
c1_layer_kappa=0.443
c1_layer_mcnemar_p=0.0012
c1_layer_b=8
c1_layer_c=28
c2_layer_acc=0.642
c2_layer_kappa=0.430
c2_layer_mcnemar_p=0.0076
c2_layer_b=10
c2_layer_c=27
whose_bar_acc=0.901
whose_n=151
c1_whose_acc=0.848
c2_whose_acc=0.854
conf_slice_n=25
conc_slice_n=106
conf_slice_c0_acc=0.760
conf_slice_c1_acc=0.480
conc_slice_c0_acc=0.726
conc_slice_c1_acc=0.736
c2_class_delta=0.023
c2_singleton_delta=0.222
c2_multi_delta=0.008
c2_singleton_n=9
c2_multi_n=122
-->
