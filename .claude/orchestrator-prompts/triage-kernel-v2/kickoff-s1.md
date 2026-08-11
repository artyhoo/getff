# Kickoff S1 — triage-kernel-v2 full corpus assembly

Stage: S1 of [2026-08-10-triage-kernel-v2-design.md §9](../../../docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md).
Executor tier: mid (Opus) — verbatim-matching ~104 findings across ~13 PR bodies is a
reading task, not mechanical (design §9 S1, r2 NEW-m4). Rigor label (L0): `research-grade`
(the corpus is the load-bearing half of the D-AP5 split; design §1).

## §0 Gate record (W-2 obligation — S0 result, quoted)

S0 probe ran 2026-08-11, operator-in-loop
([research patch](../../../docs/meta-factory/research-patches/2026-08-11-triage-kernel-v2-s0-probe.md)):
31 scored rows, C1 (blind sonnet rubric) raw agreement with the operator **93.5%** vs C0
(grade map) **64.5%**; discordant pairs **9:0**, exact McNemar **p = 0.0039**; recovery
81.8%, breakage 0.0%. **S0 = GO** — the S1-S5 scale-up condition (design §9 probe-first
path) is met. This kickoff exists only because that record exists.

## §1 Goal

Assemble the FULL adjudication corpus per design §2 — population CSV files under
[docs/meta-factory/triage-corpus/](../../../docs/meta-factory/triage-corpus/README.md) —
so S2 (blind re-label) and S3 (adjudication) can run on it. S1 is corpus assembly ONLY:
no labeling, no adjudication, no bench, no dependency changes.

## §2 Permitted files (write scope)

- `docs/meta-factory/triage-corpus/*.csv` — NEW population files only:
  `audit-1369.csv`, `s4-round7.csv`, `arch-reviews.csv`, `kickoff-loops.csv`,
  `td-m3.csv`, `research-forks.csv`. The S0 files (`s0-probe.csv`, `s0-raters.csv`,
  `s0-fable-rationales.md`) are a FROZEN probe record — zero edits.
- `docs/meta-factory/triage-corpus/README.md` — extend the Files table + per-population
  row counts + thin-file honesty notes. Do not touch the S0 truth-construction section.
- `scripts/triage-corpus-probe.mjs` — ONLY if a real defect blocks S1 (e.g. the
  cross-file uniqueness arm below), with the fix named in the PR body. No rewrites.
- NOTHING else. No `packages/**`, no `.claude/rules/**`, no `package.json` (see §4).

## §3 Acceptance criteria (definition of done)

1. **Population files disjoint by assignment rule** (design §2): PR-body findings →
   `audit-1369.csv` (the audit §4 rows MINUS the #1341 round-7 rows) and `s4-round7.csv`
   (the #1341 R7 rows, counted from the audit TABLE, not its prose); full-review-report
   findings → `arch-reviews.csv` from
   [triage-corpus/sources/](../../../docs/meta-factory/triage-corpus/sources/) ONLY
   (four tracked reports; the spec §13 changelog cells are the banned author-cell shape);
   the 13-PR kickoff-revision series sample → `kickoff-loops.csv`; the two TD-M3
   incidents → `td-m3.csv`; research-patch fork records → `research-forks.csv`.
2. **Extraction contract holds** (design §2): `finding`/`context` sourced per row
   `provenance` — `pr-body` rows from `gh pr view <n> --json body`, `review-report` rows
   from `sources/`, `author-cell` rows from their named artifacts — NEVER from the audit
   §4 tables (their Basis column IS the label rationale). Grade-strip normalization
   applied at extraction (the probe's `stripGrades` is the single implementation).
3. **Leakage probe green on every file, both arms, fail-closed:**
   `node scripts/triage-corpus-probe.mjs <file> ` per file — provenance-substring +
   grade-token scan — PLUS a cross-file `id`/normalized-text uniqueness check across all
   population files (extend the probe if needed; a finding lives in exactly ONE file).
   Quote the probe output per file in the PR body.
4. **Fields per design §2:** `class_start` (audit vocabulary; `UNRECOVERABLE` where the
   audit recorded only aggregates — e.g. the #1297 «7 M + 3 M-b» split) and `orig_grade`
   from the PR record. **No judgment axes pre-filled**: no `class_cold`/`class_final`,
   no `layer_*`, no `whose_*` columns with values (design §3.1 — S1 never pre-fills;
   do NOT copy the S0 operator labels into population files).
5. **`provenance: author-cell` rows** (`td-m3.csv`, `research-forks.csv`, any
   changelog-only source): enumerated for T14 honesty, marked so S2/bench exclusion is
   mechanical (the `provenance` value IS the marker).
6. **Thin-file honesty:** any population with <5 rows → README says so and names the
   §5 consequence (under-powered axis, reported descriptively).
7. **Docs gates green:** markdownlint + 600-line gate + principle 09 (the folder README
   carries the authority header — already landed at S0; do not regress it).

## §4 Out of scope (hard NOs)

- **NO promptfoo, no `package.json` edits of any kind** — W-6: promptfoo enters at S4
  scale-up only, as a capability commit with `Prior-art:` trailer + SSOT id ≥250 in the
  SAME commit. Any S1 commit touching `package.json` is a defect.
- No labeling (S2), no adjudication (S3), no bench config (S4), no protocol-text edits
  (S5), no edits to the design spec.
- No fixing of defects FOUND in source artifacts (audit tables, PR bodies): record them
  in the PR body as findings, leave the sources untouched (T5).

## §5 Inputs (read scope)

Design spec §2/§3.1/§9 · audit patch
[2026-08-10-review-effort-theatre-audit.md](../../../docs/meta-factory/research-patches/2026-08-10-review-effort-theatre-audit.md)
(§2 population enumeration, §4 tables for row ENUMERATION + `class_start`/`orig_grade`
only) · `triage-corpus/sources/` four reports · S0 probe patch + corpus README ·
PR bodies via `gh pr view <n> --json body` (the 13 loop PRs + the kickoff-revision series
PRs listed in audit §2).

## §6 AI-traps (per [ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md))

Active canonical traps for this stage: **T1, T3, T5, T8, T9, T10, T14, T15, T19**
(see [ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md) +
[digest](../../../.claude/rules/ai-laziness-digest.md)). Domain-specific:

- **T-TK2-A — extraction-from-the-label-table.** The audit §4 tables are the convenient
  pre-enumerated source, and their `Basis` column is the label rationale — copying
  `finding` text from them hands every «blind» S2 seat the answer. Counter: §3.2 contract;
  the probe's substring arm runs against PR bodies/reports, so a table-sourced row FAILS
  it — run the probe per file and quote the output (T3), never assert it.
- **T-TK2-B — author-cell shortcut for arch-reviews.** The spec §13 changelog is shorter
  to read than four full reports; building `arch-reviews.csv` from changelog cells
  silently re-creates the banned author-cell shape (r2 NEW-M2). Counter: `arch-reviews`
  rows source from `sources/*.md` exclusively; any row whose text substring-matches a
  spec changelog cell but not a sources/ report is a defect.
- **T-TK2-C — blindness destruction by helpfulness.** Adding `class_final` or seeding
  `layer`/`whose` columns «to save S2 time» destroys the blind-labeling design (§3.1).
  Counter: §3.4 — the columns must not exist with values in S1 output.

T15 self-application: run the full probe suite over S1's OWN output files and quote the
results; the DoD is the probe's exit code, not the assembler's confidence.

## §7 Verification (run before handoff — T19)

```bash host-verify
for f in docs/meta-factory/triage-corpus/{audit-1369,s4-round7,arch-reviews,kickoff-loops,td-m3,research-forks}.csv; do
  node scripts/triage-corpus-probe.mjs "$f" || echo "FAIL $f"
done
```

Plus: cross-file uniqueness output · row counts per file vs audit §2/§4 enumeration
(state the reconciliation: ~104 total pr-body rows expected) · markdownlint via
pre-commit · `bash scripts/run-local-ci-sweep.sh` selection green.

## §8 Budget + exit

L4 budget: 2 dispatch rounds → ASK (design §9). PR: single-concern (corpus assembly),
base `staging`, FIDELITY block per the stage-PR contract (`## Provenance` declares the
substrate, so a real verdict is required — `pr-body-fidelity.ts`). On completion S2's
kickoff is authored fresh (not by this executor).
