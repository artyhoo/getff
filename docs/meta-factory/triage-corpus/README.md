# Triage corpus — adjudicated review-finding classification data

> **Authoritative for:** the triage-kernel-v2 corpus data files (CSV masters), their field
> schema, per-row provenance, truth-construction record, and per-axis agreement statistics.
> Individual data files are scope-bound by their stage prefix (`s0-*` = probe scale;
> S1 corpus files land under the population names from the design spec §2).
> **NOT authoritative for:** the corpus *design* — extraction contract, adjudication
> protocol, bench, acceptance rule — see
> [2026-08-10-triage-kernel-v2-design.md](../../superpowers/specs/2026-08-10-triage-kernel-v2-design.md)
> (§2-§5); project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Data format:** CSV masters only (design D-K1); no generated markdown views.

## Files

| File | What |
|---|---|
| [s0-probe.csv](s0-probe.csv) rows=32 | S0 probe corpus: 32 `pr-body` rows, grade-stripped per the §2 extraction contract, with operator-adjudicated `class_final` (31 adjudicated / 1 removed) |
| [s0-raters.csv](s0-raters.csv) rows=32 | Per-row verdicts of every S0 rater (all 32 probe rows, incl. the 1 later removed): C0 grade-map, blind C1 (sonnet), the (contaminated) session rater's first pass, the blind Fable seat, operator final |
| [s0-fable-rationales.md](s0-fable-rationales.md) | Verbatim rationale record of the blind Fable rater (verdict + WHY per row) |
| [s0-c1-sonnet.json](s0-c1-sonnet.json) | Raw C1 judge output (blind sonnet, one line per row incl. `layer`/`whose` axes) — the scorer input, committed for reproducibility |
| [sources/](sources/) | Tracked full review reports (design §2 `arch-reviews` population source; W-7): `top-down-r1.md`, `bottom-up-r1.md`, `r2-verify.md`, `fidelity-r1.md` from the triage-kernel-v2 /arch contour |
| [audit-1369.csv](audit-1369.csv) rows=88 | S1: 88 `pr-body` rows — the audit §4 table findings (PR #1290-#1360) **minus** the #1341 R7 rows, grade-stripped, sourced verbatim from PR bodies |
| [s4-round7.csv](s4-round7.csv) rows=6 | S1: 6 `pr-body` rows — the #1341 round-7 under-graded findings, counted from the audit table, sourced from PR #1341 body |
| [arch-reviews.csv](arch-reviews.csv) rows=44 | S1: 44 `review-report` rows — design-layer findings extracted from `sources/` (top-down-r1 · bottom-up-r1 · r2-verify · fidelity-r1), PR #1376 |
| [kickoff-loops.csv](kickoff-loops.csv) rows=13 | S1: 13 `pr-body` rows — the 6 getff-S1 + 7 beta-delivery-ux-S4 kickoff-revision series PRs, enumerated but unclassified (audit §7 item 1, T14) |
| [td-m3.csv](td-m3.csv) rows=2 | S1: 2 `author-cell` rows — both TD-M3 value-mispricing incidents (session-bus-v2 §14 + advisor-pattern-design §0). **THIN FILE** (<5 rows, §5 under-powered) |
| [research-forks.csv](research-forks.csv) rows=3 | S1: 3 `author-cell` rows — research-patch fork/disposition records («GLM 1%→2%» class). **THIN FILE** (<5 rows, §5 under-powered) |
| [s2-labels.csv](s2-labels.csv) rows=151 | S2: 151 cold-blind labels (one per labelable row), columns `id,class_cold,layer_cold,whose_cold,rationale` — the S2 deliverable, see §S2 below |
| [s2-cold-sonnet.json](s2-cold-sonnet.json) | S2: raw per-row cold-rater output (sonnet, re-cut whose-axis rubric), provenance stamp + results for reproducibility |
| [s2-rubric-whose.md](s2-rubric-whose.md) | S2: the re-cut whose-axis rubric text (escalation framing — `reviewer` as explicit default; advisor/operator-floor as escalation). Replaces the S0 `whose=` paragraph verbatim; binding yardstick + four-test card unchanged |

## Field schema (S0 subset of design §2)

`id` (`<PR#>-r<round>-<n>`) · `source` (`<PR#>-r<round>`) · `provenance` (`pr-body` only at
probe scale) · `finding` (verbatim quote from the PR body, grade-strip normalized) ·
`context` (mechanical provenance: PR#, round, cited file path) · `class_start` (audit
vocabulary incl. `MATERIAL-b`/`UNRECOVERABLE`, start-only) · `orig_grade`
(`BLOCKER|MAJOR|MINOR|none` — C0's input) · `stratum` (`<grade-band>/<class_start>`) ·
`class_final` (binary, operator-adjudicated) · `status` (`adjudicated|removed`).

**S1 population files** use the 7-column subset only (no `class_cold`/`class_final`/
`layer_*`/`whose_*`/`rationale`/`status`/`stratum` — those are S2+ fields, never pre-filled
at S1 per design §3.1): `id` · `source` · `provenance` (`pr-body|review-report|author-cell`)
· `finding` (verbatim substring of the source named by `provenance`, grade-strip normalized)
· `context` · `class_start` · `orig_grade`. `provenance: author-cell` rows are excluded from
S2 blind labeling and every §5 bench comparison (r2 NEW-M2 — their surviving text carries the
label rationale beside the quote).

**Two senses of `UNRECOVERABLE` in `class_start`.** The design §2 sense is narrow — «where
the audit recorded only aggregates» (the #1297 «7 M + 3 M-b» split, 8 `pr-body` rows in
`audit-1369.csv`). S1 applies the same token to a second population the audit never
classified at all: `arch-reviews` (44), `kickoff-loops` (13), `td-m3` (2), `research-forks`
(3). Pre-filling `MATERIAL|MATERIAL-b|IMMATERIAL` on those never-classified rows would
violate criterion 4 / T-TK2-C, so the conservative call is to mark them `UNRECOVERABLE` and
let S2/S3 label fresh. Readers should disambiguate by `provenance`/`source`: aggregate-only
for `pr-body` rows from #1297; never-classified for `review-report` / `author-cell` /
kickoff-loop rows (62 of 70 `UNRECOVERABLE` occurrences are the widened sense).

Anti-leakage: every row passed the two-arm fail-closed probe
([scripts/triage-corpus-probe.mjs](../../../scripts/triage-corpus-probe.mjs)) —
provenance-substring (normalized `finding` is a substring of its normalized PR body) +
grade-token scan (no `BLOCKER|MAJOR|MINOR` token or finding-ID pattern survives in
`finding`/`context`). Run: `node scripts/triage-corpus-probe.mjs <csv>`.

**S1 union probe** (DoD §3 — one invocation over all 6 files): `6 file(s) · 156 rows · 0
probe failures`. Cross-file `id` + normalized-finding-text uniqueness holds across the union.
**Frozen-record guard** (DoD §7): `s0-probe.csv` re-probes at `1 file(s) · 32 rows · 0 probe
failures` — zero edits to the S0 probe record.

## S1 thin-file honesty (design §2, r2 under-representation widened)

Files with <5 rows are under-powered and reported descriptively per §5 (not padded):

| File | Rows | Provenance | §5 consequence |
|---|---|---|---|
| `td-m3.csv` rows=2 | 2 | `author-cell` | both rows excluded from S2/§5 (author-cell); the whose-question axis is structurally under-measured |
| `research-forks.csv` rows=3 | 3 | `author-cell` | all rows excluded from S2/§5 (author-cell); the research-fork class is reported descriptively, not scored |

`author-cell` rows are enumerated for T14 honesty (coverage disclosure), not for bench
measurement — their surviving text carries the label rationale beside the quote, so no blind
measurement exists for them (r2 NEW-M2).

## S1 coverage reconciliation (kickoff §7)

Audit §2
([research-patches/2026-08-10-review-effort-theatre-audit.md:192](../research-patches/2026-08-10-review-effort-theatre-audit.md))
reports «~104 findings across 12 loops + 1 Phase -1 review». S1 ships 94 `pr-body` rows
(`audit-1369.csv` 88 + `s4-round7.csv` 6). The 7-row delta across the three named compressing cells below is source-forced, not dropped:
the §2 extraction contract (criterion 2) requires the `finding` text to be a verbatim
substring of the PR body, and some audit §4 cells count findings individually where the PR
body itself compresses them into a single clause. Splitting those clauses to match the
audit's count would fabricate text absent from the source and fail the probe's substring arm.
The compressing cells, by loop:

- **#1290**: «M1-M3 restored antecedents + fixture» is one PR-body clause covering the audit's
  I×3 (3 separate findings).
- **#1297**: the PR body lists 7 items under «MINOR ×10»; the audit counts 10.
- **#1302**: «three stale-prose anchors» is one clause covering the audit's I×3.

No rows were dropped to evade the audit's count; every audit §4 finding either has its own
row or shares a row's verbatim quote where the PR body itself compressed it.

**Prose numbers sit outside the `rows=<n>` token gate.** Arm D of the S2 check
(`scripts/triage-s2-labels-check.mjs`) reconciles `rows=<n>` tokens against real data-row
counts **only for `.csv` links inside Files-table rows**. Prose counts in body text — the
«8 `pr-body` rows» narrow-sense `UNRECOVERABLE` figure above, the «7-row delta» in this
section, the audit's own «~104 findings» aggregate — are NOT under that gate. Those numbers
are sourced (audit table cells, PR-body line counts) and re-derived at each edit, but the
mechanical gate deliberately scopes to the Files table only; widening it to prose would force
every sentence carrying a digit to carry a token, which is not what the gate is for.

## S2 cold blind labels (2026-08-12)

S2 produced the cold blind labels for the full labelable corpus per design §3.1. Three axes
on every `pr-body` / `review-report` row: `class_cold` (binary MATERIAL/IMMATERIAL), `layer_cold`
(highest layer touched), `whose_cold` (escalation owner). Labels land in a separate sidecar
keyed by `id` — design §3.1 forbids judgment axes on the population files.

**Labels file** — [s2-labels.csv](s2-labels.csv) rows=151. Columns exactly
`id,class_cold,layer_cold,whose_cold,rationale`. 151 rows = 156 corpus total − 5 `author-cell`
excluded (design §2, §5b.5; both directions mechanically enforced by
[scripts/triage-s2-labels-check.mjs](../../../scripts/triage-s2-labels-check.mjs) arm A).
`rationale` is a short substring of the row's `finding` (recognitional, not the judge's
one-line raw output). The check's arm E joins every label back to a parsed judge result in the
cold artifact, mechanically enforcing kickoff §3.2's "labels come from the runner and nowhere
else" (the T-TK2-E counter).

**Cold artifact** — [s2-cold-sonnet.json](s2-cold-sonnet.json). Raw per-row judge output from
151 fresh `claude -p` calls (sonnet, concurrency 5, no tools, no session state — the existing
runner reused not rebuilt). Provenance stamp: `rater=s2-cold`, `model=sonnet`,
`rubricSource=docs/meta-factory/triage-corpus/s2-rubric-whose.md`, `rubric=<that file's bytes>`.
Parse rate: 151/151 (147 first-pass + 4 narrative-output re-runs + 1 out-of-enum layer re-run;
no hand-written labels). Named `cold`, not `c1`: the S2 seat is the corpus's cold RATER, while
`C1` is an S4 bench CANDIDATE scored against the truth this rater helps build.

**Whose-axis rubric re-cut** — [s2-rubric-whose.md](s2-rubric-whose.md). The S0 rubric asked
«who should rule on it», which for an already-raised finding is trivially the reviewer — S0
measured this exactly: `whose=reviewer` on 32/32 (100%, the degeneracy that shapes this stage).
S2 re-cuts the axis ONCE before any labeling run (T-TK2-F counter — re-cutting after seeing
labels fits the wording to the corpus S4 will score against). The re-cut asks about escalation,
with `reviewer` as the explicit default: *does settling this require a premise, concept, or
value ABOVE the reviewer's authority — a concept the advisor owns (OUT-OF-CONCEPT) or a value
only the operator can set (FLOOR)? If neither, reviewer.* The binding yardstick + four-test
card are unchanged (those produced S0's 93.5% C1 agreement).

**Per-axis distribution (151 rows):**

| Axis | Distribution | Majority share | Bar status |
|---|---|---|---|
| `class_cold` | MATERIAL=92 (60.9%) · IMMATERIAL=59 (39.1%) | 60.9% | healthy (no degeneracy) |
| `layer_cold` | implementation=90 (59.6%) · plan=31 (20.5%) · architecture=16 (10.6%) · design=14 (9.3%) | 59.6% | healthy (idea-layer absent — corpus has no pure-idea findings) |
| `whose_cold` | reviewer=130 (86.1%) · advisor=18 (11.9%) · operator-floor=3 (2.0%) | 86.1% | **80-94% band — not a pass** |

**Layer cross-tab by population (T-TK2-G counter):**

| Population | implementation | plan | architecture | design |
|---|---|---|---|---|
| audit-1369 (pr-body, rows=88) | 63 | 14 | 6 | 5 |
| arch-reviews (review-report, rows=44) | 18 | 10 | 9 | 7 |
| kickoff-loops (pr-body, rows=13) | 3 | 7 | 1 | 2 |
| s4-round7 (pr-body, rows=6) | 6 | 0 | 0 | 0 |

The cross-tab is reported per kickoff §6 T-TK2-G (surfaces whether `layer_cold` is predictable
from the cited path alone). Audit pr-body findings concentrate at implementation (63/88 = 71.6%)
— expected, since the audit swept implementation-layer PRs. Architecture-review findings spread
across all four layers (healthy). The kickoff-loops population concentrates at plan (7/13 = 54%)
— kickoff-revision findings naturally settle at the plan layer. s4-round7 is 100% implementation
by construction (round-7 under-graded findings on the implementation-layer PR #1341). The
distributions are descriptive of the corpus contour, not path-only shortcuts; spot-check of 5+
rows per population confirms rationales reference the finding text, not just the cited path.

**§3.3 verdict line for whose.** The whose-axis majority-class share is 130/151 = 86.1% —
inside the 80-94% band that kickoff §3.3 names as "not a pass either". A ~0.9 majority-class
bar is practically unbeatable at S4 even though the axis is formally non-degenerate (the
re-cut moved the share from S0's 100% to 86.1%, but reviewer remains the dominant owner of
already-raised findings by construction of the population).

> **`whose: still effectively degenerate at 130/151 (86.1%) reviewer; routed to S3/S4 as judgment-only, not corpus-validated.`**

No third option, no silent omission (kickoff §3.3 closing). The re-cut wording, its reason, and
this measured distribution are the S2 deliverable for whose; S3 may adjudicate it, S4 must not
bench candidates against it as if it were corpus-validated.

**Check.** [scripts/triage-s2-labels-check.mjs](../../../scripts/triage-s2-labels-check.mjs)
six fail-closed arms (A=join integrity, B=blindness payload equality, C=enum validity, D=README
count reconciliation, E=every label traces to a judge run, F=truthful provenance). Distribution
numbers above are reported, never gated — a degenerate axis is a finding, not a defect.

## S0 truth construction (2026-08-11) + agreement statistics

Ground truth = operator adjudication over rater proposals (confirm-or-override, the design
§3.3 pattern): the session rater proposed labels with per-row arguments (**contaminated** —
it had read the audit's classifications while assembling the corpus), the blind Fable seat
rated independently (zero tool uses), the operator ruled every disputed row and re-ruled
4 rows on challenge (#6→I, #14→I, #22 confirmed M, #32→removed as unjudgeable).

Class-axis agreement vs operator final (31 scored rows): blind C1 sonnet raw agreement
0.935, κ 0.843, PABAK 0.871; C0 grade-map raw 0.645, κ 0.335, PABAK 0.290; blind Fable
raw 0.968 (30/31 — its miss is row 14, ruled I on operator challenge). Blind-vs-blind
(Fable vs C1) raw agreement 30/32. Probe verdict + validity limits:
[2026-08-11-triage-kernel-v2-s0-probe.md](../research-patches/2026-08-11-triage-kernel-v2-s0-probe.md).

## Append rules

Data files are append/extend-only at their own stage: S0 files are closed with the probe
(fixing a defect in a row requires a research-patch note, not a silent edit); S1 populations
land as new files per design §2 with the same probe green as definition-of-done.
