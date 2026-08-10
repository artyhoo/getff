<!-- scope: /arch design spec for triage-kernel-v2 — the material/immaterial/whose-question
     classifier, accepted only by measured performance on an adjudicated corpus. Dedicated
     contour per advisor-pattern §8 item 8 (operator GO at §11c ESCALATED-2). Output of the
     2026-08-10 kernel-v2 /arch session (worktree kernel-v2-arch-triage-86fa0a). -->

# Triage kernel v2 — corpus-measured materiality classifier

> **Status:** DESIGNED — awaiting cold two-altitude review (§13) + operator gate.
> **Branch:** `claude/kernel-v2-arch-triage-86fa0a`. **Current as of 2026-08-10**
> (research pass + gate dialogue; committed 2026-08-11).
> **Authoritative for:** the corpus artifact (§2), adjudication protocol (§3), bench design +
> candidate layers (§4), acceptance rule (§5), deployment surfaces (§6), the
> disposition-vocabulary home (§7), post-landing applications (§8), stage plan (§9),
> operator-premise register (§10), decision records (§11).
> **NOT authoritative for:** the severity contract + ESCALATED grammar —
> [reviewer-discipline.md §6](../../../.claude/rules/reviewer-discipline.md); the four-test
> card + practice-first default — [effort-worthiness.md](../../../.claude/rules/effort-worthiness.md);
> the advisor seat + kernel v1 — [advisor-pattern-design §3/§5.4](2026-08-10-advisor-pattern-design.md);
> project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).

## §0 Context and origin

Kernel v1 (shipped, [advisor-pattern-design §5.4](2026-08-10-advisor-pattern-design.md)) is a
FORM filter: a finding without a concrete `Failure-scenario:` cannot trigger a re-review
round. Safe by construction, blind to substance. Kernel v2 is the substance half: a
classifier «material / immaterial / whose question» whose candidates are accepted **only by
measured performance on an adjudicated corpus** — no mechanism trusted by argument, only by
its score (ratified there; operator re-confirmed 2026-08-10 in this contour after an explicit
«why not arguments?» challenge — see §10 P8). NO numeric residual-theatre target exists
(operator §11c ESCALATED-2 resolution): the corpus baseline is what candidates must beat.

Evidence base: the review-effort-theatre audit
([research patch](../../meta-factory/research-patches/2026-08-10-review-effort-theatre-audit.md),
PR #1369) — ~104 findings classified, 50% MATERIAL / 16% MATERIAL-b / 34% IMMATERIAL; the
immaterial cost measured in follow-up PRs, the Audited-SHA treadmill
([pr-body-fidelity.ts:165](../../../packages/core/hooks/checks/pr-body-fidelity.ts)), and
finding-list padding; S4 seat UNDER-grading (3 real holes graded MINOR); both TD-M3
value-mispricing incidents ([session-bus-v2 §14](2026-08-09-session-bus-v2.md)).

### §0.5 Research contour satisfaction (in-session pass, 2026-08-10)

Eight WebSearch queries + three DeepWiki source-level probes; five precedent families:

1. **Review-comment usefulness classification** — Microsoft usefulness corpus; RevHelper
   ([MSR 2017](https://web.cs.dal.ca/~masud/papers/masud-MSR2017a.pdf), 66% accuracy);
   [LLM classification of review comments (2026)](https://arxiv.org/html/2604.23667);
   datasets proprietary → own-corpus practice is field-normal. Verdict: ADAPT vocabulary
   (their yardstick is author-reviewer utility; ours is goal-impact by layer).
2. **Actionable Warning Identification** —
   [survey arXiv:2312.00324](https://arxiv.org/pdf/2312.00324);
   [SEI CMU](https://www.sei.cmu.edu/blog/prioritizing-alerts-from-static-analysis-to-find-and-fix-code-flaws/)
   trains on archived audit determinations. Transfers: behavioral ground truth
   («acted-on» ≈ our «fixing changed behavior/decision»); archived-verdicts-as-data ≈ the
   advisor decisions.md journal. Verdict: ADAPT.
3. **LLM-as-judge rubric calibration** — binary/low-granularity beats fine scales
   ([Rubric-Conditioned LLM Grading](https://arxiv.org/html/2601.08843)); rubric +
   small graded-anchor set + defer-to-human
   ([LangChain calibration guide](https://www.langchain.com/resources/llm-as-a-judge)).
   Verdict: ADOPT pattern — rubric = our card + yardstick, anchors = adjudicated corpus,
   defer = ask-up.
4. **Inter-annotator adjudication standards** — second blind rater → agreement metric
   (Cohen's κ for two) → senior adjudicator; ambiguous rows legally REMOVED; disagreement
   is guideline signal ([IAA metric selection](https://arxiv.org/html/2603.06865)).
   Verdict: ADOPT.
5. **Industry review bots** — CodeRabbit severity/type/effort labels (effort labels ≈ the
   four-test card, convergent); **PR-Agent self-reflection**: model re-scores own
   suggestions with a threshold filter
   ([DeepWiki probe](https://deepwiki.com/search/how-does-pragent-score-rank-or_8aae32cb-ddfb-41fe-8e5b-10b32c9611fb)).
   Verdict: ADAPT self-reflection (class verdict, not 0-10 — family 3 evidence); full bots
   REJECT (closed/paid; classify only their own diff-derived findings, cannot judge our
   seats' findings against our premises).

Bench-runner reuse (operator premise P5 flipped the initial hand-rolled-scorer lean):
**promptfoo ADOPT** — [DeepWiki-verified](https://deepwiki.com/search/can-promptfoo-use-a-custom-exe_ab004f47-a8c1-4109-b0e2-f5f4cb0b3c21):
local `exec:` provider (wraps `claude -p`, subscription-billed), CSV datasets with
column→variable mapping, `equals` assertions, caching, matrix report; 100% local.
DeepEval evaluated same-depth
([DeepWiki probe](https://deepwiki.com/search/can-deepeval-use-a-fully-local_701a4f7e-2d22-4549-97b1-1e6b62679f12)):
capable (custom local judge = 3-5-method subclass, offline-honest) but its strength is a
50+ metric library we do not need — our judge is our own seat, the framework contributes
only the loop. REJECT-for-this-need, reason recorded (not «python bad»). Others: Braintrust,
LangSmith (cloud platforms), OpenAI Evals (their-API-shaped), Ragas (RAG-only), Inspect AI
(research-bench heavyweight) — rejected by category. Acquisition risk (OpenAI announced
acquiring promptfoo [2026-03-09](https://openai.com/index/openai-to-acquire-promptfoo/), OSS
maintenance [publicly committed](https://www.promptfoo.dev/blog/promptfoo-joining-openai/)):
hedged — pinned devDependency, §11 D-K3 fallback, SSOT revisit trigger.

**Honest-absence claim (6-item check ran at the effort-worthiness pass, 2026-08-10):**
materiality-by-layer (idea > design > architecture > plan > implementation) has no direct
prior art — already recorded at
[effort-worthiness.md §4](../../../.claude/rules/effort-worthiness.md); this contour's
searches surfaced nothing new against it.

## §1 Frame

The contour produces three artifacts: (1) an **adjudicated corpus** (§2-§3); (2) a
**measured verdict per candidate layer** (§4-§5, bench report as a research patch); (3) the
**deployed winning layer(s)** as protocol text (§6). Rigor label (L0): `research-grade` —
this is the load-bearing half of the D-AP5 split; individual artifacts stay cheap and
reversible. Zero new runtime code ships to consumers from this contour; the one new
dependency (promptfoo, dev-only) is a capability commit with its own `Prior-art:` trailer +
SSOT entry.

## §2 Corpus (the task-book)

- **Home:** `docs/meta-factory/triage-corpus/` — folder `README.md` carries the authority
  header + field schema + provenance (folder-level authority per
  [doc-authority-hierarchy.md §5](../../../.claude/rules/doc-authority-hierarchy.md));
  data files are **CSV** (single master format, machine-consumed by the bench, diffable,
  not subject to the 600-line markdown gate; a second human-view format would need a sync
  gate — rejected per [attention-is-not-a-mechanism.md](../../../.claude/rules/attention-is-not-a-mechanism.md)).
- **Files by source population:** `audit-1369.csv` (~104 rows from the audit §4 tables; PR
  bodies re-fetchable via `gh pr view <n> --json body`); `s4-round7.csv` (the under-graded
  MINORs); `td-m3.csv` (both value-mispricing incidents — whose-question rows);
  `kickoff-loops.csv` (sample of the 13-PR kickoff-revision series — enumerated but
  unclassified in audit §7.1, T14 honesty); `research-forks.csv` (the «1% vs 2%» class —
  mined from research-patch dispositions + spec §13/§14 disposition tables; **if mining
  yields <5 rows the class stays under-represented and the corpus README says so** rather
  than padding).
- **Row fields:** `id` · `source` (PR#/round/seat) · `finding` (compressed verbatim quote)
  · `context` (one-line what-the-fix-would-touch) · `label_start` (audit) · `label_cold`
  (blind re-label, §3) · `label_final` (adjudicated) · `rationale` (one line) · `layer`
  (idea|design|architecture|plan|implementation — premise 11) · `whose_question`
  (reviewer|advisor|operator-floor) · `status` (`agreed | adjudicated | removed`).

## §3 Adjudication protocol (operator-decided 2026-08-10)

1. **Cold re-label:** a mid-tier seat, blind to `label_start` and to the audit's prose,
   labels every row against the audit §1 yardstick + the premise-11 layer axis. Kickoff
   forbids showing it existing labels (cold by construction, arch §2 definition).
2. **Agreement metric:** Cohen's κ computed and published in the corpus README — the first
   calibration datum this methodology has (audit §11: «calibration NONE»).
3. **Split:** agreeing rows → `status: agreed`. Disagreeing rows + ALL rows the audit
   graded MATERIAL-b → advisor adjudication.
4. **Advisor pass:** the advisor (arch role; fresh-from-artifacts instantiation is legal
   per [advisor-pattern-design §3 Continuity](2026-08-10-advisor-pattern-design.md); no
   doorbell needed — this is batch work) rules each disputed row
   `MATERIAL | IMMATERIAL | OUT-OF-CONCEPT | FLOOR`, judged ONLY against ratified
   artifacts, one-line rationale; irreparably ambiguous rows → `status: removed` with
   reason (IAA standard practice — honest removal beats forced labels). **Every verdict is
   a decisions.md entry** — this pass births the advisor journal and seeds the future
   precedent-retrieval corpus (D-AP4 door).
5. **Operator slice:** FLOOR rows + a random ~10-row validation sample (~15-30 min).
   Sample disagreement >2/10 → escalate per §11 D-K2 falsifier.
6. **Past disposition is evidence, not truth** (operator premise P3): the adjudicator may
   overturn history; the corpus deliberately contains rows where history erred (S4 R7
   under-grades; TD-M3). «Outcome known» never means «outcome right».

## §4 Bench (the exam)

**Runner:** promptfoo (dev-dependency; capability commit + `Prior-art:` trailer + new SSOT
entry citing §0.5 probes). Config shape: `tests: file://<corpus>.csv` (columns become
prompt variables), `assert: equals {{label_final}}`, caching on, matrix = candidates ×
rows. Judges are blind to `label_final`/`label_start`/`label_cold` — the shim strips those
columns from what reaches the prompt. Per-class post-processing (~30 lines over the
promptfoo Node API): precision/recall per class + **MATERIAL-miss-rate** reported
separately. Bench report lands as a research patch (audit-mold).

**Candidate layers (composable, measured for marginal contribution):**

- **C0 — the bar (deterministic `exec:` provider, no LLM):** scenario-presence per the
  ratified severity contract ([reviewer-discipline.md §6](../../../.claude/rules/reviewer-discipline.md)).
  Plus the second $0 reference: `label_start` vs `label_final` — the measured accuracy of
  the status-quo single-classifier.
- **C1 — rubric judge:** one call per row; binary-question rubric derived from the
  four-test card + premise-11 layer question + the audit §1 behavioral yardstick; outputs
  `class + layer + whose_question`.
- **C2 — self-review pass (PR-Agent pattern, ADAPT):** a producer-shaped seat re-grades a
  whole finding LIST (rows grouped by source loop — the shim groups), class verdict not
  numeric. Measured as **delta over C1**: does a second pass add accuracy worth its cost?

**Recorded fallback (D-K3):** if the `exec:` provider mishandles long judge prompts or
list-grouping in practice, S4 falls back to a plain deterministic scorer script (~50 LOC,
`scripts/`, outside `packages/`), decision recorded with reason in the bench report.

## §5 Acceptance rule

A candidate layer ships only if it (a) beats C0 on overall agreement with `label_final`
AND (b) does not increase MATERIAL-miss-rate. Asymmetry is deliberate (D-AP5 direction):
a missed MATERIAL is a defect escaping toward consumers; a false MATERIAL costs one visible
round. No numeric target — comparison is relative to the measured bar. «No layer beats C0»
is a legitimate, publishable outcome: v1 stands, money saved.

## §6 Deployment surfaces (winner = protocol text, never CI-LLM)

- Rubric (if C1 wins): a compact block in [reviewer-discipline.md §6](../../../.claude/rules/reviewer-discipline.md)
  as the severity-contract companion; the same block referenced from
  [agents/fidelity-auditor.md](../../../agents/fidelity-auditor.md) and used by the advisor
  when ruling materiality disputes.
- Self-review step (if C2 pays): a pre-publish «re-grade your own list» step in the
  reviewer protocols.
- Losing layers recorded in the bench report with their numbers («measured — does not
  pay»).
- [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) holds: the bench is
  operator-side; promptfoo never enters CI; deployed artifacts are prose protocol +
  existing deterministic arms only.

## §7 Disposition-vocabulary home (inherited KICKOFF-AMBIGUOUS)

PR #1374's fidelity round flagged: advisor spec §6 says «spec-changelog disposition
vocabulary gains ESCALATED beside ACCEPTED/DISSOLVED» yet no artifact defines that
vocabulary. Resolution: one line in `arch/SKILL.md` §2 defining the changelog disposition
set `ACCEPTED | DISSOLVED | ESCALATED | FIXED` (arch owns the design-review verdict
grammar; changelog dispositions are the same grammar's after-image). Lands with §9 S5.

## §8 Post-landing applications (recorded, not built here)

1. **Live triage** in review loops — the primary consumer (§6).
2. **Implementation-fidelity sweep** (operator premise P4, NEW this contour): once
   measured, the judge walks the highest-materiality decisions (idea/design layers, from
   specs + decisions.md) and verifies the implementation did not distort them —
   a materiality-ranked drift audit. The §4 rubric is therefore authored
   application-agnostic: its questions target any «intent ↔ artifact» divergence, not only
   fresh review findings.
3. **Precedent-retrieval bench** once decisions.md has volume — the D-AP4 door, numbers
   attached.

## §9 Stage plan

| Stage | What | Where | Depends |
|---|---|---|---|
| S1 | Corpus assembly (extraction + research-forks mining + CSV per §2 schema) | factory, executor tier | — |
| S2 | Cold re-label (blind kickoff per §3.1) | factory, mid tier | S1 |
| S3 | Adjudication (advisor batch + operator slice; κ published) | advisor session + operator | S2 |
| S4 | Bench: promptfoo setup, shim, run, per-class report (research patch) | factory or session, mid tier | S3 |
| S5 | Landing PR: protocol-text edits (§6) + §7 line + SSOT entry + spec status flip; `/self-reflection` at landing | session | S4 |

Exit routing (factory kickoff vs in-session) is decided at this contour's §3 exit after the
cold reviews — the stage table is the decomposition either way.

## §10 Operator-premise register (verbatim-faithful — meaning in context, never naked transcript)

1. **P1 — the complaint premise:** immaterial nitpicks genuinely slow the work; the audit
   refined WHERE the cost lives (follow-up PRs, SHA treadmill, list padding), never WHETHER
   it exists. The operator holds this truth; the audit is its measuring tool.
2. **P2 — works-immediately:** the judge must classify well from day one; learning from
   accumulated operator decisions is a bonus, never the basis (operator restated D-AP4
   independently — record-only journal now, reliance only after its own measured pass).
3. **P3 — history is evidence, not truth:** past decisions may be wrong and final
   implementations may have drifted; the adjudicator may overturn history (§3.6).
4. **P4 — second application:** «I wanted to then check the most important things with
   this judge — for implementation faithfulness» → §8.2.
5. **P5 — reuse-first:** take the ready-made when useful and free, adapt with a thin
   overlay; building wholly-own while a live production analog exists is the wrong
   default. (Operator restatement of [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md);
   flipped the bench verdict from hand-rolled scorer to promptfoo ADOPT — the authoring
   session initially violated its own repo's BFR rule and was corrected by the operator.)
6. **P6 — the stand condition:** a reusable bench is welcome iff cheap in time and tokens
   and assembled once («если нужно только один раз собрать и потом переиспользовать —
   збс») → §4 runner + §11 D-K3.
7. **P7 — adjudication budget:** advisor adjudicates disagreements; operator takes FLOOR
   rows + ~10-row validation sample (~15-30 min), chosen over full-batch (1-2h) and
   zero-operator variants.
8. **P8 — measurement over argument, re-confirmed:** after an explicit «why are convincing
   arguments not accepted — really, why?» challenge, the operator accepted the three-part
   answer (fresh measured cases of convincing-but-wrong; cheap fluency makes argument a
   weak signal; arguments shortlist, measurement decides) and gave GO. Arguments select
   what to measure; the score selects what ships.

## §11 Decision records (each with falsifier)

- **D-K1 — corpus master = CSV files in a folder home.** Grounds: single format, no sync
  gate, bench-native, 600-line-gate-immune. *Falsifier:* adjudication readability suffers
  in practice → generate a read-only md view; CSV stays master.
- **D-K2 — adjudication = cold re-label → κ → advisor → operator slice.** Grounds: IAA
  standard; measures the calibration the audit lacked; advisor pass dogfoods the advisor
  pattern and births decisions.md. *Falsifiers:* κ indicatively very low (config guide
  ~<0.4, not statute) → the yardstick prose is defective; fix guidelines, re-label BEFORE
  adjudicating. Operator sample disagrees with advisor >2/10 → corpus escalates to the
  full operator batch pass (P7 fallback option).
- **D-K3 — bench runner = promptfoo (ADOPT, dev-only).** Grounds: §0.5 probes — task
  matches the tool's core (matrix+equals+cache+exec); thin-adapter cost only. *Falsifiers:*
  exec provider fails on long/grouped prompts → plain scorer fallback (~50 LOC), reason
  recorded; OSS goes maintenance-mode or exec removed post-acquisition → re-evaluate
  (scorer or DeepEval), SSOT revisit trigger.
- **D-K4 — three candidate layers; retrieval deferred.** Grounds: layers are composable
  stages with separable marginal value; journal is empty so retrieval has nothing to
  retrieve (D-AP4 stands). *Falsifiers:* no layer beats C0 → publish the honest negative,
  v1 stands; journal reaches volume → run the retrieval bench with recall/precision.
- **D-K5 — acceptance = beat C0 AND no MATERIAL-miss increase.** Grounds: D-AP5 asymmetry
  (miss = escaped defect; false alarm = one round). *Falsifier:* live use shows
  over-flagging flooding rounds → add a precision bound at recalibration, recorded.
- **D-K6 — vocabulary home = arch/SKILL.md §2.** Grounds: arch owns the review verdict
  grammar; dispositions are its after-image. *Falsifier:* a non-arch surface needs the
  vocabulary → move to reviewer-discipline.md §6 with a pointer from arch.
- **D-K7 — winner ships as protocol text only.** Grounds:
  [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md); advisor premise 9
  (AI judges substance; mechanisms verify trace). *Falsifier:* a deployed rubric question
  proves mechanically checkable (pure syntax) → promote that question alone to a
  deterministic arm, prose stays for the judgment rest.

## §12 Do NOT re-open (ratified here or upstream)

Kernel v1/v2 split + no-numeric-target (D-AP5, §11c) · measurement-over-argument
acceptance (P8) · one-advisor + decisions-before-application (advisor spec §3/§10) ·
severity contract + notes lane ([reviewer-discipline.md §6](../../../.claude/rules/reviewer-discipline.md)) ·
practice-first default (D-AP8) · corpus labels are starting labels, never ground truth
(advisor spec §5.4) · P3 history-is-evidence.

## §13 Review changelog (filled by the contour)

- Round 1: pending — two cold seats (`top-down-triage-kernel-v2.md` /
  `bottom-up-triage-kernel-v2.md`), verdict grammar GO|REVISE|STOP, ESCALATED rung live
  ([reviewer-discipline.md §6](../../../.claude/rules/reviewer-discipline.md)), cap 2.
