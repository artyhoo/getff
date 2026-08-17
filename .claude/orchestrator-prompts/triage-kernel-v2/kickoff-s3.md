# Kickoff S3 — adjudication (in-session stage record, triage-kernel-v2)

> **This is a stage RECORD, not a dispatch input.** Per the router ([kickoff.md](kickoff.md) §2)
> S3 is NOT a factory job: it ran in-session — advisor seat (arch role, fresh-from-artifacts
> instantiation legal per advisor-pattern §3) + operator stratified slice — with the operator
> present in the loop, so no §9 park-don't-guess contract applies (forks were asked live and
> answered in-chat, 2026-08-16). Authored by the executing session at stage close; the router's
> «kickoff authored after S2 merges» cell resolves to this record (S0 precedent: in-session
> stage, record lands with the deliverables). Protocol authority: design spec
> [§3.2-§3.6](../../../docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md) — this
> record instantiates it, never redefines it.

## §1 Predecessor result (W-2 pattern — S2 as merged)

S2 CLOSED — PR #1386, squash `9446ee4de9`, 2026-08-12: 151 cold blind labels
(`s2-labels.csv`, sonnet, three axes, 151/151 parse), re-cut whose rubric
(`s2-rubric-whose.md`), 6-arm check (`scripts/triage-s2-labels-check.mjs`), whose verdict
`judgment-only, not corpus-validated` at reviewer=130/151 (86.1%). Labelable population 151
(156 − 5 author-cell).

## §2 What S3 did (protocol instantiation with actual numbers)

1. **§3.2 agreement metrics:** class axis start-vs-cold on the binary set n=73 → raw 0.7534,
   κ 0.4867, PABAK 0.5068. D-K2 falsifier (κ<~0.4 AND raw low) NOT fired → adjudication
   proceeded without re-labeling. MATERIAL-b=13 + UNRECOVERABLE=65 excluded from class κ,
   reported separately.
2. **§3.3 split:** 55 agreed / 18 disputed / 13 material-b / 65 unrecoverable; layer+whose
   confirm-or-override ran on ALL 151 rows.
3. **§3.4 advisor pass:** every routed row ruled with a one-line rationale in
   [s3-adjudication.csv](../../../docs/meta-factory/triage-corpus/s3-adjudication.csv);
   0 rows removed; borderline rows resolved by the behavioral yardstick alone (the §5
   asymmetry did NOT bias labeling — 5 of 13 MATERIAL-b resolved IMMATERIAL).
4. **§3.5 operator slice, 2026-08-16:** 22 rows (5 disputed/material-b + 5 agreed + 5
   overridden, seeded `sha256("s3-slice-v1:<id>")` ascending, + all 7 then-FLOOR rows):
   `1376-td1-8 1376-td1-12 1376-td1-13 kl-1296-1 kl-1305-1 kl-1295-1 kl-1351-1` (floor) ·
   `1297-r1-19 1290-r1-10 1358-r1-4 1360-r2-1 1349-r1-1` (disputed stratum) ·
   `1290-r1-1 1353-r1-4d 1360-r1-4 1297-r1-14 1341-r1-2` (agreed stratum) ·
   `1297-r1-9 1376-bu1-2 kl-1318-1 1360-r1-3 1376-td1-1` (overridden stratum).
   Operator disputed 4/22 (18.2%) — below the >20% escalation bar; NO full-batch escalation.
   All four = one systematic whose-rubric correction (README §S3): whose = REQUIRED authority
   class, not historical answerer; floor = goal/ownership/spend only. Plus the phantom-spend
   finding on `kl-1351-1` (aif `costUsd` estimate ≠ a charge under a z.ai Coding Plan key).
5. **§3.6 held:** history overturned where the text warranted it — 12/65 unrecoverable class
   overrides, 15/18 disputed rows resolved AGAINST the cold rater, 3/18 against the audit.

Final labels: [s3-final.csv](../../../docs/meta-factory/triage-corpus/s3-final.csv) —
class M=111/I=40 · layer 80/39/19/13 impl/plan/design/arch · whose reviewer=136 (90.1%) /
advisor=12 / operator-floor=3. Whose stays `judgment-only, not corpus-validated` for S4.

## §3 AI-traps (per [ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md))

Active for this stage: **T3** (every routed verdict carries a rationale; --check arm F rejects
<20-char rationales), **T8** (operator asked once, batched — the 22-row slice), **T14**
(whose-axis honesty: adjudication made it MORE degenerate, verdict unchanged), **T15**
(self-application: the protocol's own quality is observed through the κ/PABAK stats it
publishes — design §12b), **T19** (own cold QA before handoff). Domain traps:

- **T-TK2-H — rubber-stamp confirm.** The §3.3 confirm-or-override over 151 rows tempts a
  zero-override pass. Counter: override rates published per axis (12/65 class, 18/151 layer,
  14/151 whose) and the operator slice samples the overridden stratum specifically.
- **T-TK2-I — historical-answerer-as-authority.** Labeling `whose` by who answered historically
  inflates operator-floor and teaches the future judge to over-escalate. Counter: the slice
  correction above, now binding; recorded in README §S3 for S4/S5 authors.

**KICKOFF-AMBIGUOUS answer (owed by kickoff-s2 §7's open item):** the S2 contract shape
`#contract-that-cannot-fail` was NOT copied — every §4 command below asserts S3's own
deliverables (arms A-F cross-check s3-adjudication ↔ s3-final ↔ populations ↔ s2-labels) and
goes RED on real defect classes (missing row, enum drift, route/status inconsistency, empty
rationale, README count drift, S0 frozen-record edit).

## §4 Acceptance (host-verify)

```bash host-verify
node scripts/triage-s3-agreement.mjs --check
node scripts/triage-s2-labels-check.mjs docs/meta-factory/triage-corpus/s2-labels.csv docs/meta-factory/triage-corpus/README.md docs/meta-factory/triage-corpus/s2-rubric-whose.md docs/meta-factory/triage-corpus/audit-1369.csv docs/meta-factory/triage-corpus/s4-round7.csv docs/meta-factory/triage-corpus/arch-reviews.csv docs/meta-factory/triage-corpus/kickoff-loops.csv docs/meta-factory/triage-corpus/td-m3.csv docs/meta-factory/triage-corpus/research-forks.csv
node scripts/triage-corpus-probe.mjs docs/meta-factory/triage-corpus/s0-probe.csv
```

Line 1 = the S3 arms (fail-closed). Line 2 = the S2 gate re-run over the union (README
Files-table `rows=` tokens now cover the two S3 CSVs via its arm D). Line 3 = the S0
frozen-record guard (W-11: must report `32 rows · 0 probe failures`).

## §5 Exit

Successor: **S4 kickoff is authored fresh by a different session** (kickoff-s1/s2 §8
precedent) after this PR merges. S4 inherits: bench scores against `s3-final.csv`; whose axis
is `judgment-only` (never bench candidates against it as corpus-validated); W-6 armed
(promptfoo devDependency + `Prior-art:` + SSOT id ≥250 in the SAME commit); the class-axis
scored subset per design §5 (`pr-body`/`review-report` rows); C0 = `orig_grade` mapping with
`orig_grade: none` rows excluded. Umbrella stays OPEN through S5+S5b — done.md is written by
the session merging S5 (router §2).
