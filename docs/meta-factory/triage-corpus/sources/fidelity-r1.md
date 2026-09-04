# Fidelity audit — triage-kernel-v2 design spec, round 1

> Cold WHAT-conformance audit at design altitude per [`agents/fidelity-auditor.md`](../../../code/rules-as-tests-aif/agents/fidelity-auditor.md).
> Dialogue-blind by dispatch contract: inputs were the intent statements + the 3-dot diff only.
> **Audited-SHA:** `7410eb4e787da5539d508965e38bac9cd61d973b` (= HEAD). **Round:** 1.

## §0 Inputs and scope

| Input | Value |
|---|---|
| Intent (a) — parent mandate | `docs/superpowers/specs/2026-08-10-advisor-pattern-design.md` §5.4 (`:290-313`) + §8 item 8 (`:458-464`) + §11c ESCALATED-2 (`:564-567`) |
| Intent (b) — artifact's own claims | the landed spec's status line (`:8-14`), §13 changelog (`:491-573`), and the task brief's five carried items (r1+r2 dispositions · gate record · S0 probe stage · provenance-tiered corpus · grade-strip contract) |
| Diff | `git diff origin/staging...HEAD` → **one added file**, 573 insertions, docs-only: `A docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md` |

Diff is exactly the shape declared (docs-only, one new file). No code, config, workflow, or
dependency touched — consistent with §1 `:109` («Zero new runtime code ships to consumers from
this contour») and with the S4-deferred capability commit.

## §1 Deliverable → evidence map (intent (a): parent mandate)

| # | Mandate deliverable (advisor spec cite) | Evidence in the landed artifact | Verdict |
|---|---|---|---|
| 1 | A **separate dedicated `/arch` design contour** on the classifier bottleneck (§8 item 8, `:458-464`) | scope comment `:1-4`; title `:6`; header «Dedicated contour per advisor-pattern §8 item 8 (operator GO at §11c ESCALATED-2)» `:3` | ✅ carried |
| 2 | Candidates accepted **ONLY by measured performance** on a labeled corpus; «no mechanism trusted by argument, only by its score» (§5.4 `:305`, `:312-313`) | §0 `:30-32`; §5 acceptance rule `:281-303`; §12 do-not-re-open `:474-475`; §10 P8 `:420-424` | ✅ carried |
| 3 | Corpus = audit's ~104 findings (PR #1290-#1365) | §2 `audit-1369.csv` `:128-129`; §0 `:38` («~104 findings classified, 50/16/34») — **verified against source**: audit §5 `:192-194` reads «≈ 104 findings»; MATERIAL ≈52 (50%) · MATERIAL-b ≈17 (16%) · IMMATERIAL ≈35 (34%); window `#1290–#1365` at audit `:40` | ✅ carried, numerically exact |
| 4 | + S4's under-graded round-7 «MINORs» | §2 `s4-round7.csv` `:129-130` («counted from the audit table, not its prose»); §0 `:41-42` three-vs-four — **verified**: audit prose `:157-158` says «three of round 7's «MINORs» are material», its own table `:145-150` regrades **four** R7 rows to MATERIAL out of **six** R7 rows | ✅ carried; the upstream inconsistency is named, not inherited silently |
| 5 | + both TD-M3 incidents | §2 `td-m3.csv` `:130-133` with dual citation (session-bus-v2 §14 + advisor §0/§11); §0 `:43-46` | ✅ carried |
| 6 | + kickoff-revision loops | §2 `kickoff-loops.csv` `:142-144` — **verified**: audit §2 `:51-54` enumerates 6 getff-S1 revs + 7 S4 addenda = the claimed 13 PRs; audit §7 item 1 `:261-267` is the «enumerated but unclassified, T14» locator the spec cites as «§7.1» | ✅ carried |
| 7 | + research-fork cases («GLM 1%→2%» class, under-represented) | §2 `research-forks.csv` `:144-145`; under-representation honesty **widened to every thin file** `:148-151` | ✅ carried (widened, not narrowed) |
| 8 | Labels are **starting labels, not ground truth**; first step is label adjudication | §2 `class_start` is start-only `:156-158`; §3 full three-axis cold re-label `:193-200`; §12 `:477-478`; §9 S1-S3 `:381-383` | ✅ carried |
| 9 | **NO numeric residual-theatre target** (§11c ESCALATED-2, `:564-567`) | §0 `:33-34` («NO numeric residual-theatre target exists … the corpus baseline is what candidates must beat»); §12 `:474` | ✅ carried |
| 10 | «this spec does not block on its results» (§8 item 8 `:464`) | nothing in the diff touches the advisor spec or its landing surfaces (diff = single new file) | ✅ carried |
| 11 | Rules-as-tests applied to the judge itself (§5.4 `:312-313`) | §12b `:480-489` — including the honest half («§2/§3's protocol choices themselves are argument-accepted») | ✅ carried |

## §2 Deliverable → evidence map (intent (b): the artifact's own status/§13 claims)

| Claim (status line / task brief) | Evidence | Verdict |
|---|---|---|
| «Round-1 cold-reviewed (TD REVISE 2B/9M/5m/2E; BU REVISE 0B/5M)» | §13 `:493-526`: TD B1, B2 · TD M1/M6, M2, M3, M4, M5, M7, M8, M9 = **9 MAJOR** · TD MINOR M-1…M-5 = **5** · ESCALATED-1/-2 = **2**; BU M1…M5 = **5 MAJOR**, N1-N7 = **7 notes** | ✅ counts reconcile exactly |
| «r1 repairs applied» — every r1 finding carries a disposition **and** the body carries the repair | spot-verified all 16 MAJOR/BLOCKER dispositions against the body: TD B1→§2 `:164-170` + `:158-159`, §3 `:193-200`, §5 `:286-297` · TD B2/BU M1→§4 C0 `:252-266` + D-K8 `:466-470` + demoted stat `:267-269` · TD M1/M6→`:225-231`, `:217-219`, `:306-311` · TD M2→§5b.2 `:312-317` · TD M3/BU M2→§2 extraction contract `:171-190` · TD M4→§5 `:285-293` · TD M5→`arch-reviews.csv` `:134-142` · TD M7→§3.4 `:220-224` + D-K4 `:444-450` · TD M8→§9 budget column `:378-386` · TD M9→renamed metric `:247` + §5b.3 `:318-321` + D-K5 `:451-456` · BU M3→`:121-127` · BU M4→§9 S4 same-commit `:384` · BU M5→`:43-46` + `:130-133` | ✅ no disposition without a body repair |
| «round-2 cold verification (REVISE 1B/4M/4m; 0 NOT-FIXED / 0 MISSING)» | §13 `:528-554`: NEW-B1 (1) · NEW-M1…M4 (4) · NEW-m1…m4 (4); «19 VERIFIED / 7 PARTIAL / 0 NOT-FIXED / 0 MISSING-DISPOSITION» `:530-531` | ✅ counts reconcile |
| «r2 repairs applied» | NEW-B1→§2 grade-strip `:176-183` + token scan `:187-189` + §4 shim `:240-243` + §5b.5 `:324-331` · NEW-M1→provenance-substring probe, phrase list dropped `:184-187` · NEW-M2→`provenance` field `:152-154` + per-population sourcing `:134-148` + §3.1 exclusion `:197-198` · NEW-M3→§3.3 route `:207-211` · NEW-M4→gate note `:556-561` + §4 pre-read `:261-266` · NEW-m1→§5 pass rule `:286-289` · NEW-m2→gate note `:557-558` · NEW-m3→`:223-224`, `:371-374`, `:449-450` · NEW-m4→§9 S1 mid tier `:381` | ✅ all nine present |
| **Gate record** («ACCEPTED at the review cap») | §13 `:563-565` review cap + `:567-573` operator resolutions; consistent with `arch/SKILL.md:91` («cap **2** REVISE rounds, then surface the disagreement to the operator as a genuine fork») | ✅ carried |
| **S0 probe stage** | §9 table row S0 `:380` (~30 stratified `pr-body` rows, operator labels = ground truth, C1 vs C0, plain scorer) + probe-first path `:388-391` + status line `:11-12` | ✅ carried |
| **Provenance-tiered corpus** | §2 `provenance` field `:152-154` (`pr-body \| review-report \| author-cell`); author-cell rows EXCLUDED from blind labeling and from every §5 comparison `:145-148`; §3.1 `:197-198`; §5b.5 `:324-331` | ✅ carried |
| **Grade-strip / anti-leakage contract** | §2 `:171-190`; the mechanism's premise verified against source: `pr-body-fidelity.ts:60` is `FINDING_GRADE_RE = /^(?:[-*][ \t]+)?\**\[?(BLOCKER\|MAJOR)\b/` — the live PR-body shape does open findings with the grade token, exactly as the spec claims | ✅ carried, premise true |
| §0's «head-prefix check now at `pr-body-fidelity.ts:212`» (r1 M-1 repair) | `pr-body-fidelity.ts:212` = `} else if (!headSha.toLowerCase().startsWith(sha[1].toLowerCase())) {` | ✅ cite accurate |
| §4's r2-added numeric pre-read («#1297 alone ~19/19 on binary-resolved rows … six #1341 R7 rows») | audit `:188` row #1297 = 2 BLOCKER (M) + 10 MAJOR (7 M + 3 M-b) + 10 MINOR (I×10) → binary-resolved rows = 2+7+10 = **19**, C0's grade-mapping agrees on all 19; #1341 table `:145-150` = **six** R7 rows | ✅ pre-read is arithmetically faithful to the source it names |

**Deterministic link sweep:** all 14 distinct relative targets in the spec resolve on disk
(`.claude/rules/*` ×7, `.claude/skills/arch/SKILL.md`, `README.md`, `agents/fidelity-auditor.md`,
`packages/core/hooks/checks/pr-body-fidelity.ts`, the audit research-patch, and the two sibling
specs). **Size gate:** 573 lines — under the 600-line markdown gate, consistent with §2's own
rationale for CSV-not-markdown corpus data.

## §3 Drift lists

### missing — 0

Empty. Every enumerated mandate deliverable (§1 rows 1-11) and every self-declared carried item
(§2) maps to concrete text. Not padded: two candidate «misses» were checked and dismissed on
source evidence —

- *precedent retrieval* (mandate `:304`) is **explicitly deferred with grounds + falsifier +
  a named door**, not dropped: D-K4 `:444-450`, §8.3 `:371-374`, §3.4 `:220-224`.
- *«§7.1» / «§7.3» audit locators* (`:143`, `:320`) initially read as citations to nonexistent
  subsections — the audit's `## §7` is flat. Verified: they are **item numbers inside §7**, and
  the content matches exactly (audit §7 item 1 `:261-267` = kickoff loops enumerated-but-
  unclassified, T14; item 3 `:274-278` = «Reviews that never happened (the inverse population)»).
  No drift.

### extra — 1 (accepted, not scope creep)

| Item | Evidence | Assessment |
|---|---|---|
| §7 disposition-vocabulary home (`ACCEPTED \| DISSOLVED \| ESCALATED \| FIXED` → `arch/SKILL.md` §2) | `:352-360`, D-K6 `:457-460`, S5b `:386` | An **inherited** KICKOFF-AMBIGUOUS from PR #1374's fidelity round, resolved here and explicitly carved into its **own micro-PR** (one concern per PR), sequenced beside S5 and not inside it. Nothing about it is bundled into the kernel landing. Accepted — no finding. |

### diverged — 1 (recorded + operator-authorized)

| Item | Spec-said (mandate) | Diff-does | Assessment |
|---|---|---|---|
| Stage ordering | advisor §5.4/§8 item 8 `:462-463`: «corpus assembly + label adjudication per §5.4 are its **first steps**» | §9 `:380`, `:388-391`: **S0 probe first** (~30 rows, operator-labelled, plain scorer); S1-S5 run **only** on S0 signal | **MINOR — recorded, not a defect.** S0 is itself a micro corpus-assembly + operator adjudication under the same §2 contract (`:380` states the grade-strip + provenance contract applies at probe scale), and the re-ordering is an explicit operator resolution at the 2026-08-11 gate with its effort-worthiness ground stated both ways (`:556-561`, `:567-573`). The operator is the mandate's own authority. Notes lane; tracked as W-2. |

## §4 Findings (all notes-lane — no `Failure-scenario:`, no round)

Per the severity contract ([reviewer-discipline.md §6](../../../code/rules-as-tests-aif/.claude/rules/reviewer-discipline.md)),
none of these carries a concrete failure scenario, so none may trigger a round; they are
recorded and do not move the audited SHA.

- **m1 — §1/§4 state the promptfoo capability commit unconditionally while §9 defers it.**
  `:109-111` («the one new dependency (promptfoo, dev-only) **is** a capability commit … in the
  same commit (S4 — §9)») and §4 `:238-239` read as settled, but `:380` now says «plain
  deterministic scorer … D-K3's fallback serves as the probe's primary; promptfoo + its
  capability commit **deferred to scale-up**». The gate commit touched §9/§13/status but not
  §1/§4. Direction of risk: an S0-stage session reads §1/§4 and adds the devDependency the probe
  does not need. MINOR.
- **m2 — D-K3's decision text was not amended to record the probe-primary flip.** `:439-443`
  still records the plain scorer purely as a *falsifier-triggered fallback*; the actual
  «fallback is the probe's primary» call lives only in the §9 table cell `:380`. The decision
  record and the stage plan now say slightly different things about the same choice. MINOR.
- **m3 — one mandate-enumerated candidate has no disposition in this spec.** The mandate lists
  «cheap devil's-advocate» among candidate mechanisms (advisor `:304`); D-K4 `:444` records
  «three candidate layers; retrieval deferred» and is silent on it. Legitimate by upstream —
  advisor D-AP6's falsifier `:500-501` gates it («only then consider the devil's-advocate
  layer») — but the pointer is not in this spec, so a future reader of D-K4 alone sees an
  unexplained absence. MINOR.
- **m4 — §13 names the r1 reports by filenames that do not exist.** `:493-494` cites
  `top-down-triage-kernel-v2.md` and `bottom-up-triage-kernel-v2.md`; the surviving files are
  `~/.claude-coordination/rules-as-tests-aif/triage-kernel-v2/top-down-r1.md` and
  `bottom-up-r1.md` (`r2-verify.md` matches). This matters only because §2 `:136-139` makes S1's
  pre-step commit «the surviving triage-kernel-v2 r1/r2 reports» from that untracked tree into
  `triage-corpus/sources/`, and §13 is the spec's only locator for them. Cheap recovery (the
  directory holds exactly three files), hence MINOR, not MAJOR.

Grading arithmetic: 0 BLOCKER · 0 MAJOR (missing/diverged) · 4 MINOR · 0 ESCALATED → per the
agent's verdict rule («Only MINOR or clean → GO»), **GO**.

## §5 Verdict block (machine-consumed — paste unedited into the PR body's `## Fidelity verdict`)

```text
FIDELITY: GO
Basis: docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md#§0-§13 (supporting: docs/superpowers/specs/2026-08-10-advisor-pattern-design.md §5.4/§8)
Round: 1
Audited-SHA: 7410eb4e787da5539d508965e38bac9cd61d973b
Evidence: 2026-08-10-triage-kernel-v2-design.md:33 — "NO numeric residual-theatre target exists (operator §11c ESCALATED-2 resolution): the corpus baseline is what candidates must beat" (:33-34) — the parent mandate's binding acceptance clause, carried verbatim in scope; drift lists: 0 missing / 1 extra (accepted, §7 carved to its own micro-PR) / 1 diverged (S0-first, operator-gated). Findings: 4 MINOR, notes lane, no Failure-scenario, no round.
```

## §6 Watch-list

```markdown
### Watch-list

| id  | criterion                                                                 | why                                                                                  | defect site                          | reintroduction tell                                                                                              |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| W-1 | advisor §11c / spec §0 — no numeric residual-theatre target                | a target number would re-price the thing the corpus exists to measure                 | none — preventive                    | any pp/% figure appearing as an acceptance threshold or "target" in §5, D-K5, or a bench report                     |
| W-2 | spec §9 — S1-S5 conditional on S0 signal (probe-first)                     | the gate bought the null at ~1/10 the price; an unconditional S1 spends what E2 priced | none — preventive                    | an S1 kickoff or corpus-assembly commit with no recorded S0 result quoted in it                                     |
| W-3 | spec §2 — grade-strip + provenance-substring + grade-token scan            | C0's input riding the `finding` cell is the exact failure shape TD-B2's repair re-opened | none — preventive                    | a corpus row whose `finding` opens with BLOCKER/MAJOR/MINOR or an `R\d+ [MB]\d+`-class id; or extraction sourced from the audit §4 tables |
| W-4 | spec §2 / §5b.5 — author-cell rows excluded from blind labeling + bench    | their only surviving text carries the label rationale beside the finding                | none — preventive                    | `td-m3` / `research-forks` rows appearing in a κ table, a §5 comparison, or a candidate's scored subset             |
| W-5 | spec §5 — per-axis provenance labels (`corpus-measured` vs `judgment-only`) | an unmeasured axis wearing a measured provenance is the r1 TD BLOCKER-1 shape           | none — preventive                    | a shipped rubric question labeled `corpus-measured` whose axis did not beat its §4 bar                             |
| W-6 | spec §1 `:109-111` / §4 `:238` vs §9 `:380` — promptfoo deferred to scale-up | the probe is specified to run on the plain scorer; an early devDependency is an unneeded capability commit | `docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md:110` | a `promptfoo` key added to `package.json` in any commit whose scope is S0                                          |
| W-7 | spec §2 `:136-139` — S1 pre-step preserves the r1/r2 reports into `sources/` | the reports live in an untracked host tree the factory cannot reach; unpreserved, `arch-reviews.csv` is unbuildable | `docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md:493` (filenames do not match `top-down-r1.md` / `bottom-up-r1.md`) | an S1 `sources/` pre-step committing fewer than three reports, or an `arch-reviews.csv` built from spec changelog cells |
| W-8 | spec §3.4 / D-K4 — corpus-adjudication journal entries segregated from the volume door | one batch stage must not flip a ratified deferral                                       | none — preventive                    | a decisions.md volume count, or a D-AP4 promotion argument, that includes `class: corpus-adjudication` entries      |

Round 1: all CLEAN (baseline)
```

## §7 Method notes (T3/T14 honesty)

- Every §1/§2 row was verified by opening the cited line, not by reading the spec's own claim
  about it. Cross-source verification ran against four external artifacts: the audit
  research-patch (rates, #1297 row, #1341 table, §2 enumeration, §7 items), `pr-body-fidelity.ts`
  (`:60`, `:212`), `arch/SKILL.md` (`:91` cap, `:93` exit), and the coordination tree's surviving
  review reports.
- Coverage is **high** for this diff class: the artifact is a single self-contained markdown file,
  so «what exists» equals «what was read» — 573/573 lines read, 14/14 relative links resolved,
  all 25 r1+r2 finding dispositions traced to body text. The limit is altitude, not sampling:
  this seat judges WHAT-conformance, and does **not** opine on whether the designed corpus
  protocol will produce a good classifier (that is the bench's job, by the spec's own §12b).
- Cold-ness held: no chat, no design dialogue, no implementation log was available to this seat;
  the two intent statements and the diff were the sole inputs.

---

# Round 2 — narrow delta

> **Audited-SHA:** `b298230fdfca3408a7d7cb8fa7f2d6b3c1b9b530`. **Round:** 2.
> **Scope:** the incremental diff `7410eb4e78..b298230fdf` only, plus the round-1 Watch-list —
> a legitimate scoped round per [`agents/fidelity-auditor.md`](../../../code/rules-as-tests-aif/agents/fidelity-auditor.md)
> §Protocol step 5 (narrow delta after a scope-neutral commit,
> [`cold-seat-economy.md`](../../../code/rules-as-tests-aif/.claude/rules/cold-seat-economy.md) §1).
> Line numbers below are in the **new** blob (`b298230fdf`), not round 1's.

## R2 §1 Delta containment

One commit, one file, `16 insertions / 9 deletions` across **four hunks** — `M
docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md`, nothing else in the tree.
The nine deletions are all re-wraps of surviving text (D-K3's falsifier sentence, §4's
`Config shape:` line, §13's two report-name lines) — **no content was removed**, verified by
reading each `-`/`+` pair. File is now **580 lines**, still under the 600-line markdown gate.
No new numeric figure enters the artifact (`grep -oE '[0-9]+(\.[0-9]+)?(pp|%)'` over the
delta's added lines → empty). Delta touches nothing beyond the four named repairs. ✅

## R2 §2 Per-MINOR resolution

| # | What the MINOR named (round 1) | Repair as landed | Resolved? |
|---|---|---|---|
| m1 | §1 `:110` and §4 `:238` stated the promptfoo capability commit unconditionally while §9 `:380` deferred it to scale-up | `:111-112` — «and it enters **only at S1-S5 scale-up** — the S0 probe runs on the plain scorer, **no dependency added** (gate 2026-08-11)»; `:240-241` — «scale-up only — S0 runs the D-K3 plain scorer, gate 2026-08-11» | ✅ **resolved** — both surfaces named in the finding are repaired, and the risk direction («an S0-stage session adds the devDependency») is closed explicitly by «no dependency added» |
| m2 | D-K3 recorded the plain scorer only as a falsifier-triggered *fallback*; the probe-primary flip lived solely in the §9 table cell | `:442-444` — «Gate 2026-08-11: the fallback scorer is the S0 probe's PRIMARY; promptfoo enters at scale-up only», inserted between `Grounds:` and `*Falsifiers:*` | ✅ **resolved** — decision record and stage plan now say the same thing; the ADOPT verdict and both original falsifiers survive verbatim |
| m3 | «cheap devil's-advocate» (advisor `:304`) had no disposition in D-K4 | `:448-450` — «(The mandate's cheap devil's-advocate layer stays parked upstream at [advisor-pattern-design D-AP6](2026-08-10-advisor-pattern-design.md) — not a candidate here.)» | ✅ **resolved** — pointer lands on the record that actually gates it (D-AP6's falsifier, advisor `:500-501`); link target exists |
| m4 | §13 cited `top-down-triage-kernel-v2.md` / `bottom-up-triage-kernel-v2.md`; the surviving files are `top-down-r1.md` / `bottom-up-r1.md` | `:499-502` — both names corrected, plus «on-disk filenames — the §2 `sources/` pre-step locator» | ✅ **resolved** — verified against the tree: `~/.claude-coordination/rules-as-tests-aif/triage-kernel-v2/` holds `top-down-r1.md`, `bottom-up-r1.md`, `r2-verify.md`; all three §13 names now match on disk (`r2-verify.md` at `:534` was already correct), and the added clause tells a future S1 session *why* the names matter |

## R2 §3 New-drift sweep

- **missing — 0.** No round-1 evidence line was weakened: every §1/§2 mapping row of round 1
  still resolves in the new blob (the four hunks are additive clauses plus two name fixes).
- **extra — 0.** Nothing outside the four repairs; no new section, decision record, stage,
  metric, or dependency.
- **diverged — 0.** The delta moves the artifact *toward* the round-1 diverged entry's own
  finding: S0-first is now stated in §1, §4, D-K3 and §9 consistently instead of §9 alone.
- Checked and clear: no mechanical gate parses decision-record shape, so D-K4's parenthetical
  sitting between the title and `Grounds:` breaks nothing (`grep -rln "docs/superpowers/specs"`
  over `packages/core/principles/` + `packages/core/hooks/checks/` → principle 22
  internal-english, principle 24 plugin-manifest, `pr-body-fidelity.ts`; the added text is
  English, so 22 is satisfied). One new relative link (`2026-08-10-advisor-pattern-design.md`,
  same directory) resolves.

## R2 §4 Watch-list verdicts

```markdown
Round 2: W-1 CLEAN · W-2 CLEAN · W-3 CLEAN · W-4 CLEAN · W-5 CLEAN · W-6 CLEAN · W-7 CLEAN · W-8 CLEAN
```

Per-item basis (W-6 and W-7 carried the two defect sites; both are now closed):

- **W-1 CLEAN** — no pp/% figure enters the delta; no acceptance threshold added.
- **W-2 CLEAN** — reinforced: `:111-112`, `:240-241`, `:442-444` all restate S0-before-scale-up.
- **W-3 / W-4 / W-5 / W-8 CLEAN** — §2, §3, §5, §5b untouched by the delta (hunks are confined
  to §1, §4, §11 D-K3/D-K4, §13).
- **W-6 CLEAN — defect site closed.** Round-1 site `:110` now carries the scale-up-only clause.
- **W-7 CLEAN — defect site closed.** Round-1 site `:493` now carries on-disk filenames plus
  the explicit `sources/` pre-step locator note.

## R2 §5 Verdict block (round 2 — replaces the round-1 block in the PR body)

```text
FIDELITY: GO
Basis: docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md#§1,§4,§11(D-K3/D-K4),§13 — narrow delta round (supporting: docs/superpowers/specs/2026-08-10-advisor-pattern-design.md §5.4/§8)
Round: 2
Audited-SHA: b298230fdfca3408a7d7cb8fa7f2d6b3c1b9b530
Evidence: 2026-08-10-triage-kernel-v2-design.md:111 — "and it enters **only at S1-S5 scale-up** — the S0 probe runs on the plain scorer, no dependency added (gate 2026-08-11)" — delta = 1 file / 4 hunks / 16 insertions / 9 deletions (re-wraps only, no content removed); all four round-1 notes-lane MINORs resolved; drift 0 missing / 0 extra / 0 diverged; Watch-list W-1..W-8 all CLEAN (W-6, W-7 defect sites closed).
```

