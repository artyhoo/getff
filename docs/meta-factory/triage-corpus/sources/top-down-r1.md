# Top-down cold review — `2026-08-10-triage-kernel-v2-design.md`

VERDICT: REVISE

Seat: top-down (does the design serve the goal · is it feasible · are the architectural
choices sound · what did the authors not consider). Cold: judged from artifacts on disk only.
Repo root: `/Users/art/code/rules-as-tests-aif/.claude/worktrees/kernel-v2-arch-triage-86fa0a`.

Scope note per [reviewer-discipline.md §1](.claude/rules/reviewer-discipline.md): every item
below is a finding or a fork. I pick no strategy. Two findings whose force rests on an
UNRECORDED value premise are graded `ESCALATED` and routed, never priced (§6 grammar).

Standing assessment: the *frame* is right. «Accept a judgment mechanism only by its measured
score, deploy it as prose because judgment cannot be gated and CI may not call a paid LLM» is
coherent with [README.md#why-this-exists](README.md) (earliest reachable channel; judgment →
injection per [rule-enforcement-channel-selection.md §1](.claude/rules/rule-enforcement-channel-selection.md))
and with [no-paid-llm-in-ci.md §2](.claude/rules/no-paid-llm-in-ci.md) (session-bound `claude`
CLI is explicitly out of scope, so the bench is legal). D-K7's falsifier — promote a rubric
question to a deterministic arm the moment it proves mechanically checkable — is exactly the
right escape valve. **What is defective is the measuring instrument, not the intent.** The
acceptance rule (§5) cannot, as specified, produce the number the whole contour exists to
produce.

---

## BLOCKERs

### BLOCKER-1 — the acceptance rule scores 1 of the classifier's 3 outputs; the other two ship unmeasured, contradicting the ratified P8/§12 premise

`docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md:167` — C1 «outputs `class +
layer + whose_question`». `:178` — acceptance = «beats C0 on overall agreement with
`label_final` AND does not increase MATERIAL-miss-rate». `label_final` is the **class** column
only (`:122`). So `layer` and `whose_question` are produced, deployed (§6 `:186` ships the
whole rubric block into [reviewer-discipline.md §6](.claude/rules/reviewer-discipline.md)),
and never scored.

This is not a detail — `whose_question` is the axis the parent spec most needs. The evidence
base names TD-M3 **twice** as the motivating class
([advisor-pattern-design:29-31](docs/superpowers/specs/2026-08-10-advisor-pattern-design.md)),
and TD-M3 is a *whose-question* failure (a review seat pricing a value question), not a
material/immaterial failure. `td-m3.csv` is even described as «whose-question rows»
(`:115`). The contour builds a corpus around the class it will not measure.

Compounding, inside the one axis that *is* scored, the label space is incoherent: agreed rows
carry the audit's vocabulary (`MATERIAL | MATERIAL-b | IMMATERIAL`, `:34`), adjudicated rows
carry the advisor's (`MATERIAL | IMMATERIAL | OUT-OF-CONCEPT | FLOOR`, `:138`). `OUT-OF-CONCEPT`
and `FLOOR` are structurally unreachable on every `status: agreed` row, so a judge that
correctly says «this is out of concept» on an agreed row is scored **wrong by construction** —
penalising precisely the verdict the advisor pattern introduces.

`Failure-scenario:` S3 finishes; S4 runs; C1 scores 0.81 on the class axis and beats the bar.
S5 lands the full rubric — class + layer + whose_question questions — into
`reviewer-discipline.md §6`, cited as «measured». Live, the `whose_question` question
misroutes: value-premise findings keep getting priced by review seats (the TD-M3 class the
whole advisor pattern exists to fix) at an unknown rate, because no run ever measured it,
while the rubric's provenance («corpus-measured») suppresses challenge. Goal impact: the spec's
own §0 claim «no mechanism trusted by argument, only by its score» becomes false for two thirds
of what ships, and §12 lists measurement-over-argument acceptance (P8) as DO-NOT-RE-OPEN — so
the contour would violate its own ratified premise at its landing step.

### BLOCKER-2 — the C0 bar is unusable in both of its arms: arm (a) is constant-by-construction on this corpus, arm (b) is contaminated by the label-construction process

`:161-165` names two $0 references.

**Arm (a) — scenario-presence (`:162`).** Every corpus row is a finding written **before** the
`Failure-scenario:` field existed. The corpus window is PRs #1290–#1365, merged 2026-08-08→10
([audit §2](docs/meta-factory/research-patches/2026-08-10-review-effort-theatre-audit.md) line
39-46); the severity contract landed 2026-08-10 in PR #1374 (`reviewer-discipline.md:56`
header «advisor-pattern, 2026-08-10»; squash `462f6ac9bb`). The audit states the pre-state
directly at its line 250: «No grammar anywhere requires a **failure scenario**». A
deterministic (`no LLM`, `:161`) scenario-presence check over these rows therefore returns
constant-FALSE, i.e. C0 degenerates to a single-class predictor whose accuracy is fixed at the
majority-class share (~34% IMMATERIAL per audit `:194`) and whose MATERIAL-miss-rate is 100%.
Acceptance arm (b) — «does not increase MATERIAL-miss-rate» — is then vacuous against it (no
value can exceed 100%), and arm (a) is beaten by anything.

**Arm (b) — `label_start` vs `label_final` (`:164-165`), «the measured accuracy of the
status-quo single-classifier».** It is not an accuracy. §3.3 (`:133`) sets `label_final =
label_start` on every agreeing row. So `label_start`'s score has a **floor equal to the
cold-vs-start agreement rate** before adjudication runs, and rises further wherever the advisor
sides with the audit. C1/C2 are blind and never feed `label_final`, so they carry no such floor.
The comparison is systematically biased toward the bar.

`Failure-scenario:` S4 runs the matrix. C1 scores 0.78. The contaminated reference scores 0.86
(because 0.86 of `label_final` was inherited from `label_start` by the §3.3 split rule).
Per §5 the contour publishes the «legitimate, publishable outcome» — «no layer beats the bar,
v1 stands, money saved» (`:181-182`) — and D-K4's falsifier (`:278`) records the negative. The
actual question (does a rubric beat a single-pass classifier?) is unanswered, the corpus cost
is fully spent, and the recorded negative result now blocks re-opening under §12's
measurement-over-argument clause. The design's own §5 escape («no layer beats C0 is a
legitimate outcome») makes this the *cheapest* path for the bench to take, which is the
dangerous property.

---

## MAJORs

### MAJOR-1 — circularity: every label producer shares the judge's provenance and rubric source; the only independent anchor is ~10 rows

Chain of custody: `label_start` = one AI session (audit, calibration NONE, `audit §11:366`).
`label_cold` = «a mid-tier seat» (`:127`). Adjudication = the advisor, an arch-role seat
(`:136`), ruling «against the audit §1 yardstick» — the same yardstick. C1's rubric is
«derived from the four-test card + premise-11 layer question + the audit §1 behavioral
yardstick» (`:166-168`). So the judge under test is scored against labels produced by seats of
the same model family reasoning from the same yardstick text. High agreement is then evidence
of **shared priors**, not of correctness. The single human anchor is «a random ~10-row
validation sample» (`:143`) — on n=10 the escalation threshold «>2/10» (`:144`) has a ~±25pp
confidence band, so a true 25% operator-disagreement rate passes silently about half the time.

`Failure-scenario:` C1 scores 0.85 and ships. Its 15% error is not random: it concentrates on
the rows where the shared yardstick is itself wrong or under-specified — exactly the classes
the audit already flagged as its own weak joint (MATERIAL-b, `audit §11:366-368`, «expect ≥20%
dispute rate»). Live, the deployed rubric under-flags that same class, material findings route
to the notes lane, and the number 0.85 is cited as validation for a mechanism that was only
ever measured against itself. Goal impact: the project ships a discipline artifact whose
«measured» provenance is unfalsifiable by construction — the failure mode
[attention-is-not-a-mechanism.md §2](.claude/rules/attention-is-not-a-mechanism.md) calls
`#hope-as-gate`, wearing a score.

### MAJOR-2 — construct-validity gap: the bench measures a third-party judge on decontextualised one-liners; deployment is in-situ self-grading with the full diff in context

Bench input per row: `finding` = «compressed verbatim quote», `context` = «one-line
what-the-fix-would-touch» (`:120-121`). Deployment (§6 `:186-191`): the rubric block lives in
`reviewer-discipline.md §6` and `agents/fidelity-auditor.md` — read by a **review seat grading
its own findings**, with the diff, the PR, the spec and the round history in context. Two
independent shifts between measured and deployed configuration:

1. **Information set.** The bench judge sees ~2 lines; the live seat sees the artifact. If the
   discriminating information lives in the diff (it does for the S4 round-7 anchors — «zero-usage
   gate falls open on non-numeric `totalTokens`» is material only because of what the gate
   guards), the bench measures a different problem.
2. **Self-grading bias.** The audit's own headline grading defect is a seat **under-grading its
   own findings** (`audit §4:155-159`, «the S4 seat *under*-graded»). Only C2 is a self-shaped
   pass (`:169`), and it is measured as a delta over C1 on the same decontextualised rows.

This is the [ai-laziness-traps.md T16](.claude/rules/ai-laziness-traps.md) shape at the design
level — «Upstream problem class: X. Our problem class: Y. Match? evidence: …» is never written
for the bench→deployment transfer, and the spec's §0.5 family-1 verdict (`:47-48`) explicitly
notes the yardsticks differ.

`Failure-scenario:` C1 wins on the corpus because compressed finding text is nearly
self-labelling («citation precision», «wording» → immaterial; «fail-open» → material). The
rubric lands. In live rounds the seat already has the diff, the surface cues are absent, and
the rubric adds nothing or mis-fires on the cases that matter — while the corpus number is
carried forward as its warrant. Goal impact: a measured-looking artifact governing which
findings may spawn rounds, validated on a task it will never perform.

### MAJOR-3 — label leakage into the corpus text: `context` will be mined from the audit's `Basis` column, which *is* the label rationale

`:112` sources `audit-1369.csv` from «the audit §4 tables». Those tables have exactly four
columns — `Round · finding | Orig | Class | Basis`
([audit §4:99-100](docs/meta-factory/research-patches/2026-08-10-review-effort-theatre-audit.md)).
`Class` is the label; `Basis` is *why that label*. The spec's row field `context` = «one-line
what-the-fix-would-touch» (`:121`) has no other plausible mining source in those tables, and an
executor-tier seat (S1, `:222`) handed «build CSV rows from §4» will copy `Basis`. `Basis`
entries are outcome statements: «no claim changed, nothing downstream reads it» (audit `:106`,
`:110`), «evidence weight flipped on probe» (`:107`), «fail-open» (`:144`). Stripping the
`label_*` columns (`:154`) does not strip this.

The same defect breaks §3.1's blindness claim: the cold seat is «blind to `label_start` and to
the audit's prose» (`:127-128`) — but its input text *is* a compression of the audit's prose,
so κ measures agreement between two readings of one source, not two independent judgments.

`Failure-scenario:` S1 lands the CSVs; `context` carries `Basis`-derived phrasing on the bulk of
the 104 rows. C1 scores 0.93 by paraphrase-matching outcome language it was handed. It ships as
the best measured layer; live, where no `Basis` line exists, its real accuracy is unknown and
plausibly near the C0 floor. Goal impact: the contour's single deliverable — a trustworthy
number — is void, and nothing in §3-§5 would detect it (no held-out set, no leakage probe).

### MAJOR-4 — the acceptance rule has no noise floor and an undefined reference for its second arm

`:178-180`. Corpus ≈104 rows from `audit-1369.csv` plus four smaller files, minus `status:
removed` rows (`:139-140`), minus an admitted under-filled `research-forks.csv` (`:118-119`).
On n≈120 with ~50% MATERIAL prevalence, a 3-row difference is ~2.5pp — well inside binomial
noise (95% CI on a paired difference at that n spans roughly ±9pp). The rule states no minimum
detectable effect, no confidence interval, no significance test, no pre-registered n. Arm (b),
«does not increase MATERIAL-miss-rate», never names **what** it is measured against — C0? the
`label_start` reference? v1 (which has no classifier at all)? The three give different verdicts.

`Failure-scenario:` C1 beats the bar by 4 rows. The bench report records «C1 wins», S5 lands the
rubric, and the SSOT/research-patch record it as measured. A re-run on a second corpus would
flip the sign. Goal impact: the acceptance rule — the artifact §1 calls the load-bearing half of
the D-AP5 split (`:98-99`) — is not decidable from the measurement it specifies, so the
«measurement decides» premise (P8, `:255-258`) resolves to a coin flip with a citation.

### MAJOR-5 — missing population: `/arch` design-review findings are absent from the corpus, yet §6 deploys the rubric onto exactly that surface

Five source files are named (`:112-119`): fidelity loops, S4 round-7, TD-M3, kickoff loops,
research forks. The `/arch` **spec cold review** population is in none of them — and the
evidence base flags it as a known hole: audit §7.2 (`:267-271`) enumerates #1325 + v2/v3 spec
reviews, classifies none, and returns `INCONCLUSIVE — coverage insufficient`. Meanwhile §6
(`:186-188`) lands the rubric in `reviewer-discipline.md §6`, which is the operating SSOT bound
by `.claude/skills/arch/SKILL.md:89` — the dispatch-prompt grammar for every arch review seat
(this report included). The audit even records that TD-M3 «lives in accepted dispositions, not
findings» (`:270-271`), i.e. the motivating class is invisible to the corpus's chosen shape.

`Failure-scenario:` the rubric is measured on PR-fidelity findings (implementation-layer, diff-
anchored) and deployed to arch design reviews (idea/design-layer, artifact-anchored) where
premise-11 says materiality is *highest* (`advisor-pattern §7 premise 11`). A design-layer
finding — the class the layer hierarchy prices at floor — is graded by a rubric never scored on
a single design-layer row. Goal impact: the highest-materiality review surface receives the
least-validated instrument, inverting the very hierarchy the rubric encodes.

### MAJOR-6 — the hardest stratum (MATERIAL-b, ~16%) is resolved by a single adjudicator with no second rater, and the operator sample is not stratified onto it

§3.3 routes «ALL rows the audit graded MATERIAL-b» to the advisor (`:133-134`). The audit puts
that at ≈17 rows / 16% (`:194`) and names it as its own weakest joint with «≥20% dispute rate
expected until a second seat re-scores a sample» (`audit §11:366-368`). In §3 those rows get
exactly one judgment (the advisor's) with no κ, no second rater, and no dedicated operator
coverage — §3.5's sample is «random ~10-row» (`:143`), so its expected MATERIAL-b yield is ~1.6
rows.

`Failure-scenario:` the advisor resolves borderline rows toward MATERIAL (a rational bias given
§5's stated asymmetry, `:179-181`). The corpus MATERIAL share moves from 50% to ~66%.
Every candidate's MATERIAL-miss-rate is then computed against an inflated ground truth, so the
layer that ships is the one tuned to over-flag — the exact regression D-K5's falsifier (`:281-282`)
can only detect *after* live rounds are flooded. Goal impact: the contour re-creates the
over-rigor problem it was chartered to reduce, with a measurement blessing it.

### MAJOR-7 — S3 seeds `decisions.md` with ~50 synthetic batch entries, tripping the D-K4 / D-AP4 «journal volume» trigger on non-live data

§3.4 (`:141-142`): «**Every verdict is a decisions.md entry** — this pass births the advisor
journal and seeds the future precedent-retrieval corpus (D-AP4 door)». The journal's designed
purpose is *live consult* precedent
([advisor-pattern §5.3 L2](docs/superpowers/specs/2026-08-10-advisor-pattern-design.md):256-260)
and its promotion gate is volume: D-K4's falsifier «journal reaches volume → run the retrieval
bench» (`:278-279`); D-AP4's is «kernel-v2 corpus evaluation shows precedent retrieval scoring
above the v1 baseline → promote». One batch stage would supply the bulk of that volume from
historical corpus rows — a population with different distribution, no asker, no live fork, and
no cost signal.

`Failure-scenario:` after S3 the journal holds ~50 corpus-adjudication entries and ~0 live
consults. The volume trigger reads as met; the retrieval bench runs; retrieval scores well
because corpus rows are near-duplicates of each other (same PRs, same finding classes). D-AP4 is
promoted on that number, and live consults — structurally strangers to the corpus rows, which is
the CBR indexing problem the demotion was built on
([effort-worthiness.md §4](.claude/rules/effort-worthiness.md)) — get matched to surface twins.
Goal impact: a ratified deferral (D-AP4, «record-only») is reversed by an artifact of this
contour's bookkeeping. Cheap fix available (namespace or segregate corpus entries), but it must
be decided before S3, not after.

### MAJOR-8 — P6's «cheap» condition is a recorded premise with no estimate anywhere in the spec; no stage budget is declared

P6 (`:248-250`): «a reusable bench is welcome **iff cheap in time and tokens** and assembled
once». The spec provides no cost estimate for any of S1-S5 (`:220-226`): not for compressing
~104+ findings, not for the C1×rows + C2×groups judge matrix (roughly 300-500 `claude -p`
invocations across candidates), not for the advisor batch over the disputed + all-MATERIAL-b
rows, not for S4's shim and post-processing. The operator's own budget is the only number in
the document (`~15-30 min`, `:143`). Separately, [effort-worthiness.md §2 L4](.claude/rules/effort-worthiness.md)
requires a budget tripwire per stage; §9's table declares none, and §13's «cap 2» covers only
the review rounds.

`Failure-scenario:` the operator gates on P6 as recorded. S1 and S2 run; S3's disputed set turns
out larger than expected (κ is typically low on first-pass materiality labels); by S4 the spend
is several multiples of what «cheap» meant, discovered post-hoc — at which point sunk cost is
the argument for finishing. No tripwire exists to force the ASK that
[effort-worthiness.md §2 L4](.claude/rules/effort-worthiness.md) mandates. Goal impact: the spec
that operationalises effort-worthiness fails its own L0/L4 obligation on its own stages —
[ai-laziness-traps.md T15](.claude/rules/ai-laziness-traps.md) / `#recursive-self-application-gap`.

### MAJOR-9 — the bench cannot measure the quantity §5's asymmetry rests on, and D-K5's falsifier covers only the safe direction

§5 (`:179-181`): «a missed MATERIAL is a defect escaping toward consumers; a false MATERIAL
costs one visible round». But the corpus contains only findings that **were raised**. The
bench's «MATERIAL-miss-rate» is therefore miss-among-findings-produced, not
miss-among-defects-that-existed — two different quantities, and only the second is «a defect
escaping toward consumers». The audit named this inverse population explicitly and could not
measure it either (§7.3 `:272-275`, «Reviews that never happened … nothing here measures defects
that shipped because a loop stopped at its cap»). D-K5's falsifier (`:281-282`) then covers only
over-flagging («live use shows over-flagging flooding rounds → add a precision bound»); the
direction the asymmetry calls dangerous has **no live detector** at all.

`Failure-scenario:` C1 ships with a measured MATERIAL-miss-rate of 4%. Live, it filters findings
before they are written down, so a suppressed finding leaves no artifact — the miss is invisible
by construction. Six months on, a defect reaches a consumer surface; nothing in the deployed
design would have flagged the drift, because the only falsifier watches the opposite direction.
Goal impact: the asymmetric acceptance rule is justified by a quantity the design never
measures and never monitors.

---

## ESCALATED (routed, not priced)

### ESCALATED-1 — proportionality of *this scale* of measurement is an unrecorded value premise

Not a re-open of P8/§12 (measurement-over-argument acceptance stands, and I do not contest it).
The unpriced question is narrower: **at what scale** is measurement worth buying? The spec
commits five stages, a new dev dependency, an advisor batch, an operator slice and a bench
report to decide whether a prose rubric block enters an existing prose rule.
[effort-worthiness.md §1](.claude/rules/effort-worthiness.md) puts the burden of proof on MORE
rigor — «whoever demands a probe, an experiment, or an extra round must state (a) what breaks if
we skip it and (b) what learning-in-practice costs instead». §1 declares `research-grade`
(`:98`) but grounds it only in «this is the load-bearing half of the D-AP5 split» — the (b) half
(what does learning-in-practice cost, i.e. write the rubric, use it for three rounds, measure
disputes) is never stated. Whether a cheaper measurement (e.g. 30 stratified rows, operator-
labelled, one candidate) answers the same question at a fraction of the cost is a payoff
judgment. §10 records no premise fixing that threshold; §12 does not close it. Routed to the
concept holder.

### ESCALATED-2 — whether a null result («no layer beats the bar») is worth the corpus's full cost

§5 (`:181-182`) declares «no layer beats C0» a legitimate, publishable outcome — «v1 stands,
money saved». The money is not saved; it is spent by then, and by BLOCKER-2's contamination the
null is also the biased-toward outcome. Whether the contour should proceed when its most likely
publishable result is a negative on a spent budget is a value/priority call. Not priced here.

---

## MINORs

- **M-1 — `pr-body-fidelity.ts:165` does not contain the claim it is cited for.** `:36` cites
  «the Audited-SHA treadmill ([pr-body-fidelity.ts:165](packages/core/hooks/checks/pr-body-fidelity.ts))».
  Line 165 is inside the `hasEvidence` doc-comment; the head-prefix check is at `:212`
  (`!headSha.toLowerCase().startsWith(sha[1].toLowerCase())`) with the message at `:217`. The
  citation is inherited from the audit patch and has drifted (the file gained the
  `Failure-scenario:` arm since). Cosmetic, but it is a §0 evidence-base cite.
- **M-2 — κ's prevalence paradox is unguarded.** D-K2 (`:266-269`) treats «κ indicatively very
  low (~<0.4)» as «the yardstick prose is defective → re-label BEFORE adjudicating». With this
  corpus's skew (50/16/34, `audit:194`), κ can land near 0.35 at ~85% raw agreement purely from
  marginal distribution. The hedge «not statute» softens it, but the recorded consequence is a
  full S2 re-run. Consider recording raw agreement + PABAK alongside κ, or state the collapse
  rule (3-class vs 2-class) that κ is computed on — §3.1 does not say which class set the cold
  seat uses.
- **M-3 — first tracked `.csv` under `docs/`.** `git ls-files 'docs/**/*.csv'` → empty. `:106-111`
  is sound on doc-authority (folder README per
  [doc-authority-hierarchy.md §5](.claude/rules/doc-authority-hierarchy.md), precedent
  `docs/meta-factory/research-patches/README.md` + `retros/README.md`), but no gate has ever seen
  a CSV in that tree — worth a pre-flight on principle 09's enumerators and the doc gates at S1
  rather than at S5.
- **M-4 — no §self-application section.** The evidence base carries one (`audit §10`), the parent
  spec carries one (`advisor-pattern §6 Self-application`); [ai-laziness-traps.md
  T15](.claude/rules/ai-laziness-traps.md) makes it mandatory for discipline-bearing artifacts.
  This spec has none — notable because §0's «no mechanism trusted by argument» is not applied to
  §2/§3/§6, all of which are accepted by argument.
- **M-5 — S1's ownership of judgment fields is unstated.** `layer` and `whose_question` are row
  fields (`:123-124`) filled at S1 («executor tier», `:222`), yet §3.1 has the cold seat labelling
  «against … the premise-11 layer axis» (`:128`). Either S1 pre-fills a judgment the cold seat is
  supposed to make independently, or there is no `layer_start`/`layer_cold`/`layer_final` triple
  and the layer axis is outside the adjudication protocol entirely. Interacts with BLOCKER-1.

---

## Notes lane (scenario-less — never round-triggering)

- **§7 is a different concern riding the landing PR.** The disposition-vocabulary fix is inherited
  from PR #1374's fidelity round (`:198-204`) and is unrelated to the classifier. Landing it in S5
  is against [CLAUDE.md «PR strategy»](CLAUDE.md) one-concern-per-PR spirit. D-K6's home choice
  (`arch/SKILL.md §2`) is itself defensible — `.claude/skills/arch/SKILL.md:89` does say the
  verdict grammar is «owned here».
- **Positive — deployment channel is right.** D-K7 (`:286-290`) plus §6's «promptfoo never enters
  CI» is correctly reasoned against [no-paid-llm-in-ci.md §2](.claude/rules/no-paid-llm-in-ci.md)
  (session-bound CLI explicitly out of scope) and against
  [rule-enforcement-channel-selection.md §1](.claude/rules/rule-enforcement-channel-selection.md)
  (judgment → injection, not a gate). The falsifier that promotes a mechanically-checkable rubric
  question to a deterministic arm is the correct escape valve for the README invariant.
- **Positive — §0.5 research contour is genuinely done,** not asserted: five precedent families
  with per-family verdicts, the DeepEval REJECT reasoned rather than dismissed (`:77-81`), and the
  acquisition risk hedged with a named fallback (D-K3). P5's flip of the hand-rolled-scorer lean is
  recorded honestly as the authoring session violating its own BFR rule (`:245-247`).
- **Rubric's own channel/Class is undeclared.** §6 lands prose into `reviewer-discipline.md §6`
  without naming the delivery channel or Class, which
  [rule-enforcement-channel-selection.md §3 step 5](.claude/rules/rule-enforcement-channel-selection.md)
  asks for at codification time. Cheap to add at S5.
- **SSOT id.** Next free entry is ≥250 (`prior-art-evaluations.md` currently tops out at 249) —
  for the promptfoo capability commit named at `:100-102` / `:151`.
- **Corpus home does not exist yet** (`ls docs/meta-factory/triage-corpus` → no such directory) and
  `promptfoo` is absent from every `package.json` — consistent with a DESIGNED-status spec, noted
  only so the S1/S4 entry checks are not assumed done.

---

## Answers to the four seat questions

1. **Serves the goal / parent intent?** Frame yes, instrument no. The goal-alignment (judgment →
   injection; prose deployment; CI-LLM ban held) is sound. The parent's intent — «accepted ONLY by
   measured performance on a labeled corpus»
   ([advisor-pattern §5.4](docs/superpowers/specs/2026-08-10-advisor-pattern-design.md):303-313) —
   is not met as specified: BLOCKER-1 leaves two thirds of the shipped mechanism unmeasured and
   BLOCKER-2 makes the measurement's reference invalid.
2. **Feasible as specified?** Stages and seats yes; the promptfoo `exec:`/CSV/`equals` shape is
   verified upstream in §0.5 and D-K3 records a fallback. The protocol is where feasibility fails —
   §3's blindness claim is unachievable given §2's mining source (MAJOR-3), and §5 is not decidable
   at n≈120 (MAJOR-4).
3. **Architectural choices sound?** Corpus-as-CSV-in-a-folder: yes, well-argued (D-K1). Runner
   choice: yes (D-K3). Candidate layering C0/C1/C2 with marginal-contribution measurement: right
   idea, broken bar (BLOCKER-2). Adjudication protocol: right lineage (IAA standard), wrong
   independence properties (MAJOR-1, MAJOR-3, MAJOR-6). Deployment: sound (D-K7).
4. **Not considered.** Judge↔label-producer provenance sharing (MAJOR-1); bench↔deployment
   construct transfer, including self-grading (MAJOR-2); `Basis`-column leakage (MAJOR-3); the
   `/arch` review population the rubric is deployed into (MAJOR-5); statistical power and a noise
   floor (MAJOR-4); the journal-volume side effect on a ratified deferral (MAJOR-7); the contour's
   own cost against its own P6 condition and effort-worthiness L4 (MAJOR-8); and the fact that the
   escaping-defect population — the one §5's asymmetry is built on — is structurally outside any
   corpus of raised findings (MAJOR-9).
