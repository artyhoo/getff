# S4b outcome audit — drift register (triage-kernel-v2)

> Stage S4b of the [triage-kernel-v2 router](../../superpowers/specs/2026-08-10-triage-kernel-v2-design.md)
> §8.2, per [kickoff-s4b.md](../../../.claude/orchestrator-prompts/triage-kernel-v2/kickoff-s4b.md).
> Ran 2026-08-16 on branch `feature/triage-kernel-v2-7cd11b` over the substrate frozen at the S4
> squash `fa8da9406c` (byte-verified below). Deliverables:
> [`s4b-outcomes.csv`](../triage-corpus/s4b-outcomes.csv) (151 rows) ·
> [`s4b-audit-raw.json`](../triage-corpus/s4b-audit-raw.json) (seat log) ·
> [`scripts/triage-s4b-outcomes.mjs`](../../../scripts/triage-s4b-outcomes.mjs) (driver + arms A–G).

**What this stage is:** for every one of the 151 labelable corpus rows, establish from the live
tree and its history what the repository actually did about the finding. Not a re-labeling pass —
`s3-final.csv` is untouched (arm F re-asserts by blob hash); not a repair stage — §3.7's exception
qualified 0 rows (see §repairs). Headline: **HOLDS 139 of 151 (92.1%) · MOVED 8 · NEVER-DONE 3 ·
DECLINED 1 · DRIFTED 0 · UNVERIFIABLE 0 · cost VISIBLE 0.**

## §probes (re-run before starting; verbatim outputs)

| Probe | Output | Expected |
|---|---|---|
| Strata derivation (§3.1 node one-liner over the 6 population CSVs × `s3-final.csv`) | `{A:92, B:44, C:8, D:7}` | same — substrate unmoved |
| Grouping derivation (§3.2 node one-liner) | `{"rows":151,"groups":30}` | same |
| Substrate freeze | arm F: 37 substrate files byte-identical to `fa8da9406c` | green |
| S4 bench patch reserved section | `## Outcome axis (filled by S4b)` present once, before `## Self-application (T15)` | green |

Both derivation probes were also re-run at `--check` time inside every arm pass (INFO lines) and
never drifted.

## §method — seats, batching, model

- **One seat per group, 30 groups** (26 PR ids + 4 review reports, key per §3.2). Each seat: a
  read-only sub-agent (Explore class, tools Read/Grep/Glob/Bash) running the **pinned model
  `sonnet`**; inputs exactly `id`, `finding`, `context`, `orig_grade`, `stratum` — no
  `class_final`/`layer_final`/`whose_final` (an adjudicated label invites confirming it instead of
  looking). Per-stratum protocol blocks per kickoff §3.3 (stratum B = landing-site search with the
  worked example `1376-td1-8` → `kickoff-s3.md` §2; stratum C = the three mandatory probes before
  any NEVER-DONE).
- **Verdict grammar** (one strict line per row):
  `id=… outcome=<HOLDS|DRIFTED|NEVER-DONE|MOVED|DECLINED|UNVERIFIABLE> cost=<VISIBLE|NONE-FOUND|N/A> witness=<file:line|#section|none> rationale=…`
  Witness names exactly ONE file; line-lists (`:N`, `:N-M`, `:N,M`) must stay inside that file;
  NEVER-DONE/UNVERIFIABLE carry `witness=none`.
- **Batching (openly stated):** 8 dispatch waves, parallel seats within a wave, each group merged
  into `s4b-audit-raw.json` on receipt before the next wave —
  `17:28Z` 1292·1295·1296 → `17:37Z` 1305·1310·1311 → `17:40Z` 1297·1302·1315·1317·1318 →
  `17:43Z` 1290·1319·1324·1328·1332 → `17:52Z` 1329·1333·1340·1341·1346·1349 →
  `17:56Z` 1353·1358·1360 → `17:59Z` 1351·1376-bu-r1·1376-fid-r1·1376-td-r1 →
  `18:10Z` 1376-r2-verify (re-dispatch).
- **Merge discipline:** a staging file per group, validated (ids partition the group exactly,
  enums, witness grammar) before replace-or-append into the raw json. **7 full-group
  re-dispatches, never hand-fixed lines:** 1297·1302 and 1290 (×2) — multi-FILE comma-joined
  witnesses; 1329 — seat ended without emitting lines; 1351 — two-path witness; 1376-r2-verify —
  a section number (`3.4`) inside a line list. The raw json is the complete log; no group's rows
  were disposed of by the executing session's own reasoning (arm D joins every register row to a
  parsed raw line).

## §distribution — outcome × stratum

| Stratum | n | HOLDS | DRIFTED | NEVER-DONE | MOVED | DECLINED | UNVERIFIABLE |
|---|---|---|---|---|---|---|---|
| A — live artifact | 92 | 87 | 0 | 3 | 2 | 0 | 0 |
| B — self-referential | 44 | 42 | 0 | 0 | 2 | 0 | 0 |
| C — path absent | 8 | 4 | 0 | 0 | 4 | 0 | 0 |
| D — no path | 7 | 6 | 0 | 0 | 0 | 1 | 0 |
| **all** | **151** | **139** | **0** | **3** | **8** | **1** | **0** |

Costs: VISIBLE 0 · NONE-FOUND 16 · N/A 135. Stratum C's 4/8 MOVED is the §3.3 trap doing what it
was designed to do — relocations (`getff-freshness-widening` → `…-s1/kickoff.md`,
`packages/core/hooks/…` → `.claude/hooks/…`) read ALIVE, not as decay. Stratum D produced no
strained verdicts (6 HOLDS with concrete witnesses, 1 DECLINED on a decision record; the kickoff's
expected UNVERIFIABLE load simply did not materialize at n=7).

**class_final × outcome:** MATERIAL (n=111): 102 HOLDS · 8 MOVED · 1 NEVER-DONE. IMMATERIAL
(n=40): 37 HOLDS · 2 NEVER-DONE · 1 DECLINED.

**MOVED rows (8)** — alive under a different path/shape, listed so the register does not read
relocation as decay: `kl-1295-1`, `1333-r5-1`, `1376-td1-12`, `1376-td1-13` (ESCALATED-1/2 →
operator gate's probe-first resolution), `kl-1296-1`, `kl-1305-1`, `kl-1315-1`, `kl-1317-1`.
**DECLINED (1):** `1341-r7-6` — the research patch's own superseding addendum records the accepted
divergence (witness `2026-08-08-s4-glm-onebutton-entry-verification.md:248-258`).

## §drift-register — ranked DRIFTED + NEVER-DONE (the repair umbrella's input)

3 rows qualify, ranked by `class_final` (MATERIAL first), then `orig_grade`:

| # | id | class_final | orig_grade | outcome | cost | What rotted | What a fix would cost |
|---|---|---|---|---|---|---|---|
| 1 | `1311-r1-5` | MATERIAL | MINOR | NEVER-DONE | NONE-FOUND | `AGENTS.md.template:30` factory row lists the 7-skill operator suite but omits the two factory-gated sub-agents (`orchestrator-worker-discipline`, `reviewer-discipline`) that `setup.d/20-agents.sh:33-38` gates to the factory profile | One line in `AGENTS.md.template` + a regen check against `20-agents.sh`; single-file and self-evident, but NEVER-DONE (not DRIFTED), so §3.7 does not apply — register-only |
| 2 | `1346-r1-1` | IMMATERIAL | MINOR | NEVER-DONE | NONE-FOUND | `session-bus-v2.md:447` carries the compressed scope «Any F4b LANDING» where v3 (`2026-08-09-autonomous-night-v3-design.md:375`) says unscoped «any landing» | One-word scope edit in a design spec — outside this stage's permitted files entirely; register-only |
| 3 | `1358-r3-1` | IMMATERIAL | MINOR | NEVER-DONE | NONE-FOUND | `getff-name-architecture-freeze.md:146` dropped the qualifier «publishable-intent», leaving «all four siblings do» (packages/ holds six siblings; the four named are correct) | Re-insert the qualifier — one line, but again NEVER-DONE; register-only |

## §disagreement — outcome axis vs `class_final`

Mechanical definition (stated openly): a row disagrees when the outcome pushes against the
adjudicated label — IMMATERIAL ∧ `cost=VISIBLE`, or MATERIAL ∧ `DECLINED`. **0 rows.** The table
is published empty; nothing was resolved by moving a label (the answer key is arm-F-frozen).

The two agreement shapes §3.6 does support: MATERIAL ∧ (DRIFTED|NEVER-DONE) ∧ VISIBLE = **0**;
IMMATERIAL ∧ NEVER-DONE ∧ NONE-FOUND = **2** (`1346-r1-1`, `1358-r3-1` — judgment corroborated by
absence of consequence).

## §limits (§3.6, restated because the register is the thing that gets quoted)

- `cost=NONE-FOUND` on the MATERIAL row (`1311-r1-5`) is **not** evidence the label was wrong:
  the cost may not have surfaced yet; the inverse population (defects never raised) is out of
  reach of any such corpus (design §5b.3); and a visible cost leaves a written trace only when
  someone happened to write one. This register reads NONE-FOUND as absence-of-trace, full stop.
- **Survivorship, named:** the corpus is drawn from findings on PRs that were reviewed and merged,
  so HOLDS is the expected majority. The 92.1% HOLDS share is a property of the population, not a
  grade for the project.
- **No statistical test on this axis:** counts and rates with denominators only. A κ between a
  judgment axis and an outcome axis would imply they measure the same construct; they do not.

## §repairs — §3.7 exception

```
repair: (none — 0 rows qualified; ceiling 0/5 untouched)
```

The exception requires DRIFTED ∧ MATERIAL ∧ single-file self-evident restoration. DRIFTED count
is 0 across all 151 rows, so no repair was eligible; every NEVER-DONE row above is register-only
by construction.

## §traps (active T-numbers — full catalogue at `ai-laziness-traps.md §2`)

Governed this stage's execution: **T1** (no sampling — all 151 rows disposed of by seats, the
§3.2 grouping exists to make full coverage cheap) · **T2** (auditing ≠ designing — every verdict
required git/file evidence, never «would hold») · **T3** (each row's rationale carries its
evidence: file:line witnesses or the enumerated search; mechanically re-verified by arm C) ·
**T5** (audit phase edited no source file — 0 §3.7 repairs) · **T14** (stratum D's clean 7/7 is
reported with its n=7 denominator, not as «stratum D clean») · **T15** (below) · **T20** (every
register claim above quotes a file:line, command output, or the canonical block).

**Domain trap added (extends §3): `T-TK4b-E — the plausible-witness trap`.** A witness that
names a real file and a real line still proves nothing if the line does not carry the claimed
substance; existence checks pass it. Counter, applied here: arm C verifies existence AND bounds
but the substance binding stays the seat's verbatim quoted evidence in the raw json (re-readable
by any later auditor), and the §self-application probe below names false-alive MOVED rows as the
residue this single pass cannot close.

## §self-application (T15)

Did this audit run on itself? Yes, in the two places an audit of an audit bites: (1) every
verdict line in the raw log carries its own file:line witness, and arm C re-verified each one
against the live file (existence + line bounds) — the audit's findings are checkable exactly the
way it checks others'; (2) the executing session's own temptation was hand-fixing malformed seat
lines, and the merge discipline (7 full re-dispatches instead) is the countermeasure that held.
What auditing this audit would look like: re-run the 3 NEVER-DONE rows' searches independently
(the two spec/doc rows are one-grep verifiable), and probe the MOVED set for false-alive — a
relocation witness that names a file which no longer carries the substance would be the defect
class this register cannot see from inside a single pass.

<!-- s4b-numbers (canonical block — pasted verbatim into the drift register; arm E reconciles)
total=151
holds=139
drifted=0
never_done=3
moved=8
declined=1
unverifiable=0
cost_visible=0
cost_none_found=16
cost_na=135
A_holds=87
A_drifted=0
A_never_done=3
A_moved=2
A_declined=0
A_unverifiable=0
B_holds=42
B_drifted=0
B_never_done=0
B_moved=2
B_declined=0
B_unverifiable=0
C_holds=4
C_drifted=0
C_never_done=0
C_moved=4
C_declined=0
C_unverifiable=0
D_holds=6
D_drifted=0
D_never_done=0
D_moved=0
D_declined=1
D_unverifiable=0
material_holds=102
material_drifted=0
material_never_done=1
material_moved=8
material_declined=0
material_unverifiable=0
immaterial_holds=37
immaterial_drifted=0
immaterial_never_done=2
immaterial_moved=0
immaterial_declined=1
immaterial_unverifiable=0
agree_material_visible=0
agree_immaterial_nonefound=2
disagreement_rows=0
-->
