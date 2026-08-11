# Bottom-up cold review — `docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md`

VERDICT: REVISE

Seat: bottom-up (arch/SKILL.md §2) — do the named files/APIs/patterns exist as claimed; does
this assemble from the real bricks; which claims lack file:line evidence. Read-only; no repo
file modified. Round 1.

Scope of verification: every relative link in the spec resolved against disk; every §-anchor
claim opened and read; every number the spec quotes from the audit patch re-counted in the
patch; the corpus schema (§2) checked against what the bench config (§4/§5) consumes; the §9
stage table checked against §1-§7; the capability-commit gate checked against its live
implementation.

---

## Findings

### MAJOR-1 — `label_final` has no defined value set, and three incompatible vocabularies are in play

The spec never states the enum for `label_final`, yet §4's assertion and §5's acceptance rule
both consume it. Three distinct vocabularies appear:

- `2026-08-10-triage-kernel-v2-design.md:27` — the classifier is «material / immaterial /
  whose question» (3 classes).
- `:120-124` — the row schema lists `label_start` / `label_cold` / `label_final` with **no
  value enum**, plus a separate `whose_question` column (`reviewer|advisor|operator-floor`).
- `:137-138` — the advisor rules each disputed row `MATERIAL | IMMATERIAL | OUT-OF-CONCEPT |
  FLOOR` (4 values). Confirmed live at
  `.claude/rules/reviewer-discipline.md:65` and `2026-08-10-advisor-pattern-design.md:337-339`.
- The `label_start` values inherited from the audit are a *fourth* set —
  `2026-08-10-review-effort-theatre-audit.md:30-35` defines `MATERIAL` / `MATERIAL-b` /
  `IMMATERIAL` (+ a `CHURN` tag). `MATERIAL-b` exists in no other vocabulary.

§4 (`:154-157`) then specifies `assert: equals {{label_final}}` while C1 «outputs `class +
layer + whose_question`» — a three-field output compared by a single-value `equals`, with no
extract/transform step named. §5 (`:178-181`) prices the result on «overall agreement with
`label_final`» plus a `MATERIAL-miss-rate`, both undefined until the enum is.

**Failure-scenario:** S1 populates `label_start` from the audit's 3-value vocabulary; S3's
advisor writes `label_final` including `FLOOR` / `OUT-OF-CONCEPT` rows (`:137-138`); S4 prompts
C1 for a class in §0's 3-class vocabulary (`:27`). Every `FLOOR`/`OUT-OF-CONCEPT` row then fails
`equals` for **every** candidate including C1 and C2, and C0's second reference (`label_start`
vs `label_final`, `:163-164`) is computed across two vocabularies where `MATERIAL-b` can never
match anything. The §5 acceptance comparison is then measuring vocabulary mismatch, not
classifier skill — and its legitimate-negative branch («No layer beats C0», `:182`) would be
published as an honest negative when it is a schema bug. §5 has no guard that distinguishes
the two.

### MAJOR-2 — the cold re-label reads the audit's own grade justification, so κ is inflated in the direction D-K2's falsifier cannot see

§3.1 (`:128-130`) requires the cold seat be «blind to `label_start` and to the audit's prose».
But §2 (`:120-124`) sources the row's `finding` as a «compressed verbatim quote» and `context`
as «one-line what-the-fix-would-touch», and §2 (`:112`) names the extraction source as «the
audit §4 tables». The audit's §4 tables are *the audit's own prose*, and their `Basis` column
is literally the justification for the grade:

- `2026-08-10-review-effort-theatre-audit.md:144` — finding «N5 stub fail-open (catch-all
  `rc=0`)», Basis «fail-open».
- `:146` — «`_ND_SEEN` subshell assertion **could not fail**», Basis «can't-fail assert».
- `:122` — Basis «contract-that-cannot-fail; **the goal class itself**».
- `:103` — Basis «an unsupported number was about to enter a design table».

`context` as defined ("what the fix would touch") is the same field the audit already fills
with its verdict rationale.

**Failure-scenario:** the S2 seat reads `context = "fail-open"` and labels the row MATERIAL for
the reason the audit already supplied, not independently. Agreement comes out near-ceiling and
κ is high. §3.2 (`:132-133`) publishes that κ as «the first calibration datum this methodology
has», and D-K2's falsifier (`:266-269`) fires **only on low κ** («κ indicatively very low
(~<0.4) → the yardstick prose is defective»). An inflated κ therefore passes silently, and the
corpus ships labelled «adjudicated» when it is one rater's judgment echoed back — which is
exactly the property `advisor-pattern-design.md:308-313` («starting labels, not ground truth»)
and §12 (`:297-298`) forbid the corpus from having.

### MAJOR-3 — `audit-1369.csv` and `s4-round7.csv` are overlapping populations, so ~11 rows are duplicated

§2 (`:112-115`) lists both `audit-1369.csv` («~104 rows from the audit §4 tables») and
`s4-round7.csv` («the under-graded MINORs») as separate corpus files. They are not disjoint:

- `2026-08-10-review-effort-theatre-audit.md:43-45` lists `#1341=7` among the **12 distinct
  review loops**.
- `:192` — «classified corpus ≈ 104 findings across 12 loops + 1 Phase -1 review».
- `:139-153` — the `#1341 / #1350` §4 table, containing all six round-7 rows plus the five
  R1–R6 rows.

So the S4 round-7 rows are already inside the ~104. §0 (`:34-37`) and
`advisor-pattern-design.md:305-307` both use the same additive framing, so the overlap is
inherited, not invented here.

**Failure-scenario:** S1 builds both files per §2 as written → ~11 rows appear twice in the
bench matrix. Those rows are precisely the corpus's designated hard anchors (the under-graded
MINORs), so any candidate that handles them well or badly receives double weight in §5's
«overall agreement with `label_final`», and the §3.2 κ is computed over a corpus containing
correlated duplicate items — κ assumes independent items, so the published calibration datum is
biased by construction. Nothing in §2, §3, or §5 dedupes by `source`.

### MAJOR-4 — §9 lands the SSOT entry in S5 while the promptfoo capability commit lands in S4; the live gate rejects that ordering

§1 (`:100-102`) states the rule correctly: «the one new dependency (promptfoo, dev-only) is a
capability commit with its own `Prior-art:` trailer + SSOT entry». §4 (`:151-152`) repeats it.
But §9's table puts «promptfoo setup» in **S4** (`:225`) and «SSOT entry» in **S5** (`:226`).

Verified against the live detector:

- `packages/core/hooks/checks/prior-art.ts:83-115` — `isNewDepAdded` matches any
  `"<key>": "<semver-prefix>"` on a `+` line with no matching `-` line, with carve-outs only
  for `overrides` / `resolutions` / `pnpm` blocks (`:88`). `devDependencies` keys are **not**
  exempt.
- `prior-art.ts:210-216` — a `Prior-art: skipped` trailer on a capability commit returns
  code 2 («substance: … cite an SSOT entry (prior-art-evaluations.md#N) instead»).
- `prior-art.ts:218-228` — a positive trailer citing an ID absent from the register returns
  code 3 («no such entry exists in SSOT — broken citation»).

**Failure-scenario:** the S4 commit adds `"promptfoo": "^x.y"` to `devDependencies`. The
detector classifies it a capability commit. The author has three options and all three fail:
cite `prior-art-evaluations.md#N` for an entry S5 has not written → code 3; use the escape
hatch → code 2; write a free-form positive trailer with no `#N` → passes the hook but violates
CLAUDE.md's «add a new SSOT entry … **in the same commit as the capability artifact**» and
leaves the register with no entry for the dependency. S4 is blocked or ships a false trailer.
Fix is a table edit (move «SSOT entry» to S4); the design text at §1 is already right.

### MAJOR-5 — `td-m3.csv` cites a source that holds only one of the two incidents

§0 (`:37-38`) and §2 (`:114`) both claim «both TD-M3 value-mispricing incidents» with a single
citation to `session-bus-v2 §14`. That section carries exactly one:

- `2026-08-09-session-bus-v2.md:458` — «TD-M3 doorbell dominated by pull-twin | ACCEPTED —
  value honestly bounded». (`:487`'s `NEW-M3` is a different finding — liveness predicates.)

The second incident lives elsewhere, and the upstream spec says so explicitly:

- `2026-08-10-advisor-pattern-design.md:29-31` — «TD-M3 twice (… — session-bus-v2 §14;
  **second instance in this contour**, corrected by the operator's token-economy premise)»,
  i.e. inside the advisor spec's own round-1 changelog (`:527`, `:530`).

**Failure-scenario:** the S1 executor mines `td-m3.csv` from the one artifact the spec cites,
finds one row, and produces a 1-row file. `td-m3.csv` is §2's *designated* source for
whose-question rows, and «whose question» is one of the three classes in §0's classifier
(`:27`). The third class is then measured on n=1 plus whatever `FLOOR`/`OUT-OF-CONCEPT` rows S3
happens to produce — a count unknown at design time — so §5's acceptance rule cannot detect a
candidate that never emits the third class at all. §2's under-representation honesty guard
(`:117-119`) is scoped to `research-forks.csv` only and does not cover this file.

---

## Notes lane (scenario-less — must not trigger a round)

- **MINOR N1 — `pr-body-fidelity.ts:165` is a stale line pointer.** §0 (`:35-36`) cites
  `packages/core/hooks/checks/pr-body-fidelity.ts:165` for «the Audited-SHA treadmill». Line
  165 today is a JSDoc line about the `basis:` evidence exclusion; the Audited-SHA prefix
  requirement is at `:212` (`headSha.toLowerCase().startsWith(sha[1].toLowerCase())`), the
  regex at `:56`, the message at `:217`. Cause verified: `git show 462f6ac9bb~1` puts the
  prefix check at ~:165 before PR #1374 landed the `## Review findings` arm, so the citation
  was correct when the audit wrote it (`review-effort-theatre-audit.md:216`) and went stale
  when #1374 merged — before this spec's stated commit date. By the spec's own yardstick this
  is IMMATERIAL: `review-effort-theatre-audit.md:168` grades the identical shape («cited `:11`
  is `"scripts"`, real line `:15`») MINOR / IMMATERIAL.
- **MINOR N2 — «3 real holes graded MINOR» vs four table rows.** §0 (`:37`) says S4
  under-graded «3». The audit's prose agrees (`:157` «three of round 7's «MINORs» are
  material») but its own table regrades **four** (`:148` guard-the-guard, `:149` tautological
  paired-negative, `:150` zero-usage gate, `:151` meta-scanner population gap). The spec
  faithfully quotes the audit's prose; the inconsistency is upstream. Relevant only because
  S1's `s4-round7.csv` row count derives from it.
- **MINOR N3 — one `label_start` split is unrecoverable.** `review-effort-theatre-audit.md:188`
  records `#1297` as «10 MAJOR: 7 M (incl. two evidence lines falsified …) + 3 M-b» without
  saying which seven. Those rows' `label_start` cannot be reconstructed from the cited source,
  and `label_start` is the input to C0's second reference (`:163-164`). §3.3 routes all
  MATERIAL-b rows to adjudication anyway, so `label_final` is unaffected — only the status-quo
  baseline is.
- **MINOR N4 — ambiguous self-reference in §9.** «decided at this contour's §3 exit» (`:228`)
  reads as this spec's own §3 (Adjudication protocol). The intended referent is
  `.claude/skills/arch/SKILL.md:93` («§3 Phase 3 — exit routing»).
- **MINOR N5 — «spec §13/§14 disposition tables» is not a stable locator.** §2 (`:117`) names
  it as a mining source for `research-forks.csv`, but the disposition-changelog section number
  differs per spec: advisor = §11 (`advisor-pattern-design.md:518`), session-bus-v2 = §14
  (`session-bus-v2.md:450`), this spec = §13 (`:300`).
- **MINOR N6 — S5 edits an artifact the Ownership Contract marks read-only for sessions.** §9
  S5 (`:226`) assigns «protocol-text edits (§6)» to a session; §6 (`:186`) targets
  `.claude/rules/reviewer-discipline.md`, whose CLAUDE.md `Artifact Ownership Contract` row
  reads owner = maintainers, «read-only for all session agents». Precedent exists (#1374
  landed `reviewer-discipline.md:56-65` this way), so this is a recorded observation, not an
  objection — but §9 names no handoff.
- **MINOR N7 — §7's disposition set extends its cited source.** §7 (`:203`) defines
  `ACCEPTED | DISSOLVED | ESCALATED | FIXED`. The cited upstream sentence
  (`advisor-pattern-design.md:353`) says only «gains `ESCALATED` beside ACCEPTED/DISSOLVED» —
  `FIXED` is this spec's own addition (it is in live use at `advisor-pattern-design.md:523-539`,
  so the addition is grounded; it is just not a transcription).

---

## UNVERIFIED-EXTERNAL (web-sourced; not gradeable from disk, no internal contradiction found)

- promptfoo capabilities asserted in §0.5 (`:74-76`) and §4 (`:152-157`): local `exec:`
  provider wrapping `claude -p`, CSV `tests: file://` with column→variable mapping, `equals`
  assertions, caching, matrix report, Node API for post-processing. `promptfoo` is absent from
  every `package.json` in the tree (verified), so nothing local can confirm the contract.
  Note the interaction with MAJOR-1: whether `equals` can be satisfied by a multi-field judge
  output is the one leg that is *internally* checkable, and it is not — hence that leg is
  graded, not deferred.
- DeepEval's «custom local judge = 3-5-method subclass, offline-honest» (`:77-81`).
- The OpenAI/promptfoo acquisition (`:83-85`) and the OSS-maintenance commitment. Hedge is
  recorded at D-K3 (`:271-275`) with a named fallback, so the risk is dispositioned regardless
  of how the external facts resolve.
- The five §0.5 precedent families and their sources (MSR 2017 RevHelper 66%, arXiv 2312.00324,
  2601.08843, 2603.06865, 2604.23667, SEI CMU, LangChain calibration guide, CodeRabbit,
  PR-Agent self-reflection).

---

## Verified clean (bottom-up: the bricks that do exist)

Every relative link in the spec resolves to a real file — all 12 targets checked
(`reviewer-discipline.md`, `effort-worthiness.md`, `doc-authority-hierarchy.md`,
`attention-is-not-a-mechanism.md`, `no-paid-llm-in-ci.md`, `build-first-reuse-default.md`,
`README.md`, `agents/fidelity-auditor.md`, `pr-body-fidelity.ts`, the audit patch,
`2026-08-10-advisor-pattern-design.md`, `2026-08-09-session-bus-v2.md`). Anchor claims:

- **`reviewer-discipline.md` §6 does carry the severity contract + ESCALATED grammar** —
  `:56-65`, including the `MATERIAL | IMMATERIAL | OUT-OF-CONCEPT | FLOOR` dispute vocabulary
  the spec's §3.4 reuses verbatim.
- **`effort-worthiness.md` §4 does record the materiality-by-layer honest-absence claim** —
  `:101-102`: «**Materiality-by-layer: no direct precedent found — novel composition**
  (honest-absence claim, 2026-08-10 pass)». §0.5's «already recorded» claim (`:88-92`) holds.
- **`doc-authority-hierarchy.md` §5 is the folder-level authority pattern** — `:111`, so §2's
  citation for the corpus folder README is correct.
- **Audit numbers all reconcile:** ≈104 findings (`review-effort-theatre-audit.md:192`);
  MATERIAL ≈52 (50%) / MATERIAL-b ≈17 (16%) / IMMATERIAL ≈35 (34%) (`:194`) — exact match to
  §0's «50% / 16% / 34%»; the 13-PR kickoff series = 6 getff-S1 revs + 7 S4 addenda (`:52-54`);
  S4 under-grading (`:155-159`); «Calibration: NONE» (`:366`) grounding §3.2's «the first
  calibration datum». §7 item 1 (`:261-266`) does carry the «enumerated but not classified /
  INCONCLUSIVE — coverage insufficient (T14)» status §2 attributes to it.
- **Advisor-spec anchors all hold:** §8 item 8 = the dedicated `/arch` contour (`:458-464`);
  §11c ESCALATED-2 resolved as **no numeric target** (`:564-567`) — matching §0's `:29-30`;
  §5.4 «starting labels, not ground truth» (`:308-313`); §3 «Continuity» makes
  fresh-from-artifacts advisor instantiation legal (`:157-163`), so §3.4's claim is sound;
  §7 premise 9 «AI judges substance; mechanisms verify … trace» (`:387-388`) grounds D-K7;
  §7 premise 11 is the idea→design→architecture→plan→implementation layer hierarchy
  (`:389-396`), so §2's `layer` field enum is faithful; D-AP4 (`:487`), D-AP5 (`:491`),
  D-AP8 (`:504`) all exist as cited.
- **D-K6's grounds hold:** `.claude/skills/arch/SKILL.md:89` does own the review verdict
  grammar («owned here — it is the prompt contract»), so «arch owns the design-review verdict
  grammar» is not an assumption.
- **D-K1's «600-line-gate-immune» holds:** `.husky/pre-commit:77-78` gates markdown files only;
  CSV is out of scope.
- **§6's no-paid-LLM claim holds:** `no-paid-llm-in-ci.md:29-30` puts «operator running
  `claude` CLI» explicitly out of scope as subscription-bundled, and §2's in-scope list is
  `.github/workflows/*` — an operator-side bench does not touch it.
- **D-K3's fallback is gate-safe:** a ~50-LOC script in `scripts/` trips neither capability-commit
  LOC trigger (`prior-art.ts:125-164` — ≥50 LOC applies only under a new
  `packages/core/<dir>/`, ≥80 LOC only under `packages/`).
- **The §6 deployment target already exists in the right shape:** `agents/fidelity-auditor.md:82-84`
  already carries `BLOCKER | MAJOR | MINOR | ESCALATED` + the `Failure-scenario:` requirement,
  so §6's «same block referenced from» lands on a live surface, not a hypothetical one.
- **§9 sequencing is otherwise internally consistent** with §2-§7 (S1→S2→S3→S4→S5; §7's line
  correctly assigned to S5; κ correctly assigned to S3; bench report as research patch
  correctly assigned to S4). The single break is MAJOR-4.
- `docs/meta-factory/triage-corpus/` does not yet exist and is referenced nowhere else in the
  tree — correct for an S1 deliverable, not a broken link.

## Role bounds

All five MAJORs are assembly/consistency defects with concrete failure scenarios, not strategy
calls. No finding rests on an unrecorded value premise, so nothing is graded ESCALATED — the
§10 register (P1-P8) and §11 (D-K1-D-K7) cover every premise this review leaned on. Choosing
*how* to reconcile the label vocabulary (MAJOR-1), whether to dedupe or re-scope the corpus
files (MAJOR-3), and whether to widen `td-m3.csv`'s sources or accept the class as
under-represented (MAJOR-5) are the author's calls, not this seat's.
