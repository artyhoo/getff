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
| [s0-probe.csv](s0-probe.csv) | S0 probe corpus: 32 `pr-body` rows, grade-stripped per the §2 extraction contract, with operator-adjudicated `class_final` (31 adjudicated / 1 removed) |
| [s0-raters.csv](s0-raters.csv) | Per-row verdicts of every S0 rater: C0 grade-map, blind C1 (sonnet), the (contaminated) session rater's first pass, the blind Fable seat, operator final |
| [s0-fable-rationales.md](s0-fable-rationales.md) | Verbatim rationale record of the blind Fable rater (verdict + WHY per row) |
| [s0-c1-sonnet.json](s0-c1-sonnet.json) | Raw C1 judge output (blind sonnet, one line per row incl. `layer`/`whose` axes) — the scorer input, committed for reproducibility |
| [sources/](sources/) | Tracked full review reports (design §2 `arch-reviews` population source; W-7): `top-down-r1.md`, `bottom-up-r1.md`, `r2-verify.md`, `fidelity-r1.md` from the triage-kernel-v2 /arch contour |
| [audit-1369.csv](audit-1369.csv) | S1: 88 `pr-body` rows — the audit §4 table findings (PR #1290-#1360) **minus** the #1341 R7 rows, grade-stripped, sourced verbatim from PR bodies |
| [s4-round7.csv](s4-round7.csv) | S1: 6 `pr-body` rows — the #1341 round-7 under-graded findings, counted from the audit table, sourced from PR #1341 body |
| [arch-reviews.csv](arch-reviews.csv) | S1: 44 `review-report` rows — design-layer findings extracted from `sources/` (top-down-r1 · bottom-up-r1 · r2-verify · fidelity-r1), PR #1376 |
| [kickoff-loops.csv](kickoff-loops.csv) | S1: 13 `pr-body` rows — the 6 getff-S1 + 7 beta-delivery-ux-S4 kickoff-revision series PRs, enumerated but unclassified (audit §7 item 1, T14) |
| [td-m3.csv](td-m3.csv) | S1: 2 `author-cell` rows — both TD-M3 value-mispricing incidents (session-bus-v2 §14 + advisor-pattern-design §0). **THIN FILE** (<5 rows, §5 under-powered) |
| [research-forks.csv](research-forks.csv) | S1: 3 `author-cell` rows — research-patch fork/disposition records («GLM 1%→2%» class). **THIN FILE** (<5 rows, §5 under-powered) |

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
the audit recorded only aggregates» (the #1297 «7 M + 3 M-b» split, ~10 `pr-body` rows in
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
| `td-m3.csv` | 2 | `author-cell` | both rows excluded from S2/§5 (author-cell); the whose-question axis is structurally under-measured |
| `research-forks.csv` | 3 | `author-cell` | all rows excluded from S2/§5 (author-cell); the research-fork class is reported descriptively, not scored |

`author-cell` rows are enumerated for T14 honesty (coverage disclosure), not for bench
measurement — their surviving text carries the label rationale beside the quote, so no blind
measurement exists for them (r2 NEW-M2).

## S1 coverage reconciliation (kickoff §7)

Audit §2
([research-patches/2026-08-10-review-effort-theatre-audit.md:192](../research-patches/2026-08-10-review-effort-theatre-audit.md))
reports «~104 findings across 12 loops + 1 Phase -1 review». S1 ships 94 `pr-body` rows
(`audit-1369.csv` 88 + `s4-round7.csv` 6). The ~10-row delta is source-forced, not dropped:
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
