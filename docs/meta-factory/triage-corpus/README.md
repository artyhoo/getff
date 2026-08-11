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
| [sources/](sources/) | Tracked full review reports (design §2 `arch-reviews` population source; W-7): `top-down-r1.md`, `bottom-up-r1.md`, `r2-verify.md`, `fidelity-r1.md` from the triage-kernel-v2 /arch contour |

## Field schema (S0 subset of design §2)

`id` (`<PR#>-r<round>-<n>`) · `source` (`<PR#>-r<round>`) · `provenance` (`pr-body` only at
probe scale) · `finding` (verbatim quote from the PR body, grade-strip normalized) ·
`context` (mechanical provenance: PR#, round, cited file path) · `class_start` (audit
vocabulary incl. `MATERIAL-b`/`UNRECOVERABLE`, start-only) · `orig_grade`
(`BLOCKER|MAJOR|MINOR|none` — C0's input) · `stratum` (`<grade-band>/<class_start>`) ·
`class_final` (binary, operator-adjudicated) · `status` (`adjudicated|removed`).

Anti-leakage: every row passed the two-arm fail-closed probe
([scripts/triage-corpus-probe.mjs](../../../scripts/triage-corpus-probe.mjs)) —
provenance-substring (normalized `finding` is a substring of its normalized PR body) +
grade-token scan (no `BLOCKER|MAJOR|MINOR` token or finding-ID pattern survives in
`finding`/`context`). Run: `node scripts/triage-corpus-probe.mjs <csv>`.

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
