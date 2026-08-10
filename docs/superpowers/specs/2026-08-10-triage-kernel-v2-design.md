<!-- scope: /arch design spec for triage-kernel-v2 — the material/immaterial/whose-question
     classifier, accepted only by measured performance on an adjudicated corpus. Dedicated
     contour per advisor-pattern §8 item 8 (operator GO at §11c ESCALATED-2). Output of the
     2026-08-10 kernel-v2 /arch session (worktree kernel-v2-arch-triage-86fa0a). -->

# Triage kernel v2 — corpus-measured materiality classifier

> **Status:** GATED-GO, probe-first (operator gate 2026-08-11 — §13 gate record).
> Round-1 cold-reviewed (TD REVISE 2B/9M/5m/2E; BU REVISE 0B/5M), r1 repairs applied;
> round-2 cold verification (REVISE 1B/4M/4m; all r1 dispositions confirmed — 0 NOT-FIXED /
> 0 MISSING), r2 repairs applied and ACCEPTED at the review cap. Next: §9 S0 probe;
> S1-S5 conditional on its signal.
> **Branch:** `claude/kernel-v2-arch-triage-86fa0a`. **Current as of 2026-08-11**
> (research pass + gate dialogue 2026-08-10; r1 + r2 repairs 2026-08-11).
> **Authoritative for:** the corpus artifact (§2), adjudication protocol (§3), bench design +
> candidate layers (§4), acceptance rule (§5), validity limits (§5b), deployment surfaces
> (§6), the disposition-vocabulary home (§7), post-landing applications (§8), stage plan
> (§9), operator-premise register (§10), decision records (§11), self-application (§12b).
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
immaterial cost measured in follow-up PRs, the Audited-SHA treadmill (head-prefix check now at
[pr-body-fidelity.ts:212](../../../packages/core/hooks/checks/pr-body-fidelity.ts) — the
audit's `:165` cite predates PR #1374's arm), and finding-list padding; S4 seat UNDER-grading
(audit prose says three regraded MINORs, its own table regrades four — upstream
inconsistency; S1 counts from the table); both TD-M3 value-mispricing incidents — first at
[session-bus-v2 §14](2026-08-09-session-bus-v2.md), second recorded in
[advisor-pattern-design §0 + §11](2026-08-10-advisor-pattern-design.md) («second instance in
this contour»).

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
   defer = ask-up. This family also drives the **binary class axis** in §2.
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
**measured verdict per candidate layer and per rubric axis** (§4-§5, bench report as a
research patch); (3) the **deployed winning layer(s)** as protocol text (§6), each rubric
question carrying its own measurement provenance. Rigor label (L0): `research-grade` — this
is the load-bearing half of the D-AP5 split; individual artifacts stay cheap and reversible.
Zero new runtime code ships to consumers from this contour; the one new dependency
(promptfoo, dev-only) is a capability commit with its own `Prior-art:` trailer + SSOT entry
**in the same commit** (S4 — §9), and it enters **only at S1-S5 scale-up** — the S0 probe
runs on the plain scorer, no dependency added (gate 2026-08-11).

## §2 Corpus (the task-book)

- **Home:** `docs/meta-factory/triage-corpus/` — folder `README.md` carries the authority
  header + field schema + provenance + the per-axis agreement statistics (folder-level
  authority per [doc-authority-hierarchy.md §5](../../../.claude/rules/doc-authority-hierarchy.md));
  data files are **CSV** (single master format, machine-consumed by the bench, diffable,
  not subject to the 600-line markdown gate; a second human-view format would need a sync
  gate — rejected per [attention-is-not-a-mechanism.md](../../../.claude/rules/attention-is-not-a-mechanism.md)).
- **Files by source population — disjoint, enforced fail-closed** (r1 BU MAJOR-3; r2
  notes-lane: «by construction» over-claimed — the mechanism is detection): assignment rule
  = source-artifact class (PR-body findings → `audit-1369`/`s4-round7` by the round split;
  full-review-report findings → `arch-reviews`; research-patch fork records →
  `research-forks`; the two named TD-M3 incidents → `td-m3`; the 13-PR kickoff series →
  `kickoff-loops`); row `id` = `<PR#>-r<round>-<n>`; a finding lives in exactly ONE file;
  S1's definition-of-done runs a deterministic cross-file `id`/text uniqueness check.
  `audit-1369.csv` (the ~104 audit §4 rows **minus** the #1341 round-7 rows); `s4-round7.csv`
  (the #1341 R7 rows — the under-graded anchors, counted from the audit table, not its
  prose); `td-m3.csv` (both value-mispricing incidents — sources:
  [session-bus-v2 §14](2026-08-09-session-bus-v2.md) row TD-M3 AND
  [advisor-pattern-design §0/§11](2026-08-10-advisor-pattern-design.md) second instance;
  both surviving texts are author-written changelog/spec cells → `provenance: author-cell`);
  `arch-reviews.csv` (**new population, r1 TD MAJOR-5; re-cut r2 NEW-M2** — design-layer
  finding rows from **tracked full review reports ONLY**: S1 pre-step commits the surviving
  triage-kernel-v2 r1/r2 reports into `docs/meta-factory/triage-corpus/sources/` —
  host-side, at kickoff authoring, because the factory cannot reach the untracked
  `~/.claude-coordination` tree — and every future /arch contour preserves its review
  reports there; spec disposition changelogs (advisor §11/§11b, session-bus-v2 §14, night-v3
  §13+§13b, second-round sections included) hold only author-written `Finding` compressions
  sitting beside their own dispositions — the banned shape — so those populations enter, if
  at all, as `provenance: author-cell`); `kickoff-loops.csv` (sample of the 13-PR
  kickoff-revision series — enumerated but unclassified in audit §7.1, T14 honesty);
  `research-forks.csv` (the «1% vs 2%» class — research-patch fork/disposition records;
  `author-cell` by nature). **`provenance: author-cell` rows are EXCLUDED from S2 blind
  labeling and from every §5 bench comparison** (their only surviving text carries the label
  rationale beside it, so no blind measurement exists for them — r2 NEW-M2); they are
  enumerated for T14 honesty and reported descriptively. **Under-representation honesty
  applies to EVERY thin file** (not only research-forks): if a population yields <5 rows,
  the corpus README says so and §5 reports that axis/class as under-powered rather than
  padding.
- **Row fields:** `id` · `source` (PR#/round/seat) · `provenance` (`pr-body |
  review-report | author-cell` — per-population sourcing above, r2 NEW-M2) · `finding`
  (verbatim quote from the source named by `provenance`, passed through the grade-strip
  normalization below — r2 NEW-B1) · `context` (mechanical provenance ONLY: PR#, round, the
  file path the finding cites) · `class_start` (audit vocabulary: `MATERIAL | MATERIAL-b |
  IMMATERIAL`, start-only; `UNRECOVERABLE` where the audit recorded only aggregates — the
  #1297 «7 M + 3 M-b» split, r1 BU N3) · `class_cold` / `class_final` (**binary**:
  `MATERIAL | IMMATERIAL` — family-3 evidence, binary beats granular) · `layer_cold` /
  `layer_final` (idea|design|architecture|plan|implementation — premise 11) · `whose_cold` /
  `whose_final` (`reviewer | advisor | operator-floor`) · `orig_grade` (the grade the finding
  carried in its PR record: `BLOCKER | MAJOR | MINOR | none` — C0's input, §4) · `rationale`
  (one line) · `status` (`agreed | adjudicated | removed`).
- **Vocabulary mapping (r1 BU MAJOR-1, TD BLOCKER-1):** the advisor's dispute-verdict set
  `MATERIAL | IMMATERIAL | OUT-OF-CONCEPT | FLOOR`
  ([reviewer-discipline.md §6](../../../.claude/rules/reviewer-discipline.md)) maps onto the
  row axes — `MATERIAL`/`IMMATERIAL` → `class_final`; `OUT-OF-CONCEPT` → `whose_final:
  advisor` (concept-level question) + class per judgment; `FLOOR` → `whose_final:
  operator-floor`. `MATERIAL-b` exists only in `class_start` and ALWAYS routes to
  adjudication; it never appears in `class_final`.
- **Anti-leakage extraction contract (r1 TD MAJOR-3 / BU MAJOR-2; r2-hardened
  NEW-B1/M1/M2):** `finding`/`context` are sourced per row `provenance` — `pr-body` rows
  from the PR bodies themselves (`gh pr view <n> --json body`), `review-report` rows from
  the tracked reports under `triage-corpus/sources/` — NEVER from the audit §4 tables (their
  `Basis` column IS the label rationale) and never from disposition cells. The audit tables
  are used ONLY for row enumeration + `class_start` + `orig_grade`. **Grade-strip
  normalization (r2 NEW-B1):** before a row is written, the extractor deterministically
  strips leading list markers, grade tokens (`BLOCKER|MAJOR|MINOR`), and finding-ID patterns
  (`R\d+ [MB]\d+`-class, `TD/BU [MBN]\d+`-class) from the quoted text — the live PR-body
  shape OPENS findings with their grade token
  ([pr-body-fidelity.ts:60](../../../packages/core/hooks/checks/pr-body-fidelity.ts)), so an
  unstripped verbatim quote hands `orig_grade` (C0's input) to every «blind» seat. S1's
  definition-of-done includes a deterministic **leakage probe**, two arms, both fail-closed:
  (a) **provenance-substring check** — each row's normalized `finding` must be a substring
  of its normalized source text (the real copied-from-the-wrong-source discrimination; r1's
  fixed phrase list is DROPPED — r2 NEW-M1: «fail-open»/«could not fail» are the #1341
  findings' own verbatim wording, so the phrase grep failed correctly-built rows); (b)
  **grade-token scan** — any grade token or finding-ID pattern surviving in built
  `finding`/`context` cells fails S1. Residual (recorded §5b.5): prose synonyms of grades
  are not mechanically detectable.

## §3 Adjudication protocol (operator-decided 2026-08-10; r1-hardened)

1. **Cold re-label:** a mid-tier seat, blind to `class_start`, to `orig_grade`, and to the
   audit's prose (blindness is *constructed* by the §2 extraction contract — grade-strip
   normalization + provenance-substring probe + grade-token scan — not asserted), labels
   every `provenance: pr-body | review-report` row (author-cell rows excluded — §2, r2
   NEW-M2) on ALL THREE axes — `class_cold` (binary), `layer_cold`, `whose_cold` — against
   the audit §1 behavioral yardstick + premise-11.
   S1 never pre-fills judgment axes (r1 TD MINOR-5): layer/whose have no `_start`.
2. **Agreement metrics:** per axis — Cohen's κ **plus raw agreement and PABAK** (r1 TD
   MINOR-2: κ's prevalence paradox at this corpus's skew), published in the corpus README.
   The class-axis κ is computed on the binary set; `class_start=MATERIAL-b/UNRECOVERABLE`
   rows are excluded from the class κ (no comparable start value) and reported separately.
3. **Split:** class-axis agreeing rows → `status: agreed`, `class_final = class_cold`.
   Disagreeing rows + ALL `class_start: MATERIAL-b` rows → advisor adjudication.
   `class_start: UNRECOVERABLE` rows (no comparable start value — r2 NEW-M3) take the
   layer/whose route: the advisor confirms-or-overrides `class_cold` on each (batched,
   one line per row), `status: adjudicated`; they stay excluded from the class κ (§3.2)
   but enter `class_final` and the bench like any other row. The layer/whose axes have no
   start labels, so for THOSE axes the advisor confirms-or-overrides `*_cold` on **every**
   row (cheap: one line per row, batched); cold-vs-advisor agreement is published as those
   axes' calibration stat.
4. **Advisor pass:** the advisor (arch role; fresh-from-artifacts instantiation legal per
   [advisor-pattern-design §3 Continuity](2026-08-10-advisor-pattern-design.md); no doorbell
   needed — batch work) rules each disputed row with the §2-mapped vocabulary, one-line
   rationale, judged ONLY against ratified artifacts. **Labeling instruction (r1 TD
   MAJOR-6):** borderline rows resolve by the behavioral yardstick alone — the §5 asymmetry
   is an ACCEPTANCE property and must NOT bias labeling toward MATERIAL. Irreparably
   ambiguous rows → `status: removed` with reason (IAA standard). **Journal segregation (r1
   TD MAJOR-7):** corpus-adjudication verdicts land in a segregated journal section tagged
   `class: corpus-adjudication`, EXCLUDED from the journal-volume door — owned by this
   spec's D-K4, which opens on live-consult entries only (r2 NEW-m3: D-AP4's own falsifier
   is the corpus-evaluation promotion trigger, not a volume trigger).
5. **Operator slice (r1 TD MAJOR-1/MAJOR-6 — stratified, not uniform):** ~15 rows = 5 from
   the MATERIAL-b/disputed stratum + 5 random agreed + 5 advisor-overridden on the
   layer/whose axes (~20-30 min; P7 amendment CONFIRMED at the 2026-08-11 gate) + all
   FLOOR rows. Escalation rule: >20% of sampled rows disputed by the operator →
   the corpus escalates to the full operator batch pass (P7 fallback). Honesty: n≈15 detects
   gross miscalibration only; fine-grained trust accrues from live morning review (L5), not
   from this sample.
6. **Past disposition is evidence, not truth** (operator premise P3): the adjudicator may
   overturn history; the corpus deliberately contains rows where history erred (S4 R7
   under-grades; TD-M3). «Outcome known» never means «outcome right».

## §4 Bench (the exam)

**Runner:** promptfoo (dev-dependency; capability commit + `Prior-art:` trailer + SSOT entry
in the SAME S4 commit — r1 BU MAJOR-4; scale-up only — S0 runs the D-K3 plain scorer, gate
2026-08-11). Config shape: `tests: file://<corpus>.csv` (columns
become prompt variables; the shim strips every `*_start`/`*_cold`/`*_final`/`orig_grade`
column from what reaches a judge — and the `finding` text itself is already grade-stripped
at extraction, so no grade survives in any judge's input through either path, r2 NEW-B1;
author-cell rows never enter the bench — §2), caching on, matrix = candidates × rows. **Judge output
contract (r1 BU MAJOR-1):** one strict parseable line —
`class=<MATERIAL|IMMATERIAL> layer=<...> whose=<reviewer|advisor|operator-floor>` — scored
per-axis via a small `javascript` assertion + the Node-API post-processing (~30 lines):
per-class precision/recall per axis + **MATERIAL-miss-among-raised-findings** reported
separately (honest name — §5b). Bench report lands as a research patch (audit-mold).

**Reference points and candidate layers:**

- **C0 — the deterministic bar (r1 TD BLOCKER-2 redefinition):** `orig_grade` mapping —
  `BLOCKER/MAJOR → MATERIAL`, `MINOR → IMMATERIAL`. This is the real status-quo signal (the
  grade decided round-triggering pre-contract), available on every historical row from the
  PR record, $0. Rows with `orig_grade: none` are excluded from C0 comparisons (scored
  subset stated in the report). Scenario-presence is NOT a bench bar — the
  `Failure-scenario:` field postdates the corpus window (severity contract landed PR #1374,
  2026-08-10; corpus window #1290-#1365) and would return constant-FALSE; it returns as a
  deployed-era metric instead. For the layer/whose axes (no status-quo mechanism exists) the
  bar is the **majority-class predictor** (predict `implementation` / predict `reviewer`).
  **Expected strength (r2 NEW-M4 — honest pre-read, not a run):** on the audit's own tables
  C0 lands roughly 0.8-0.9 class-agreement (#1297 alone ~19/19 on binary-resolved rows; its
  visible misses concentrate in the six #1341 R7 rows) — a STRONG bar, so «no layer beats
  C0» is a likely outcome, not a tail risk. This feeds ESCALATED-2 at the gate; it does not
  change the acceptance rule. Wrong if adjudication moves `class_final` sharply away from
  the original grades.
- **Descriptive statistic, NOT a bar:** `class_start` vs `class_final` agreement — reported
  with its stated upward bias (`class_final` inherits `class_cold` on agreed rows and both
  raters share provenance; §5b). Never compared against blind candidates.
- **C1 — rubric judge:** one call per row; binary-question rubric derived from the four-test
  card + premise-11 layer question + the audit §1 behavioral yardstick; outputs all three
  axes.
- **C2 — self-review pass (PR-Agent pattern, ADAPT):** a producer-shaped seat re-grades a
  whole finding LIST (rows grouped by source loop — the shim groups), class verdict not
  numeric. Measured as **delta over C1**: does a second pass add accuracy worth its cost?

**Recorded fallback (D-K3):** if the `exec:` provider mishandles long judge prompts or
list-grouping in practice, S4 falls back to a plain deterministic scorer script (~50 LOC,
`scripts/`, outside `packages/`), decision recorded with reason in the bench report.

## §5 Acceptance rule (r1-hardened)

Per axis, against its §4 bar, on the adjudicated corpus:

- **Class axis (shipping gate):** a candidate layer ships only if it (a) beats C0 on
  class-agreement with `class_final` **beyond the noise floor** — pass rule (r2 NEW-m1):
  the CI on the paired difference must exclude zero (equivalently McNemar p < α); the rule
  FORM is statute, α/CI-level are config — the report states the discordant-pair count and
  the binomial confidence interval; at n≈120 the minimum detectable difference is roughly
  ±9pp, stated honestly; scored on `pr-body`/`review-report` rows only (§2) — AND (b) does
  not increase
  MATERIAL-miss-among-raised-findings relative to **C0's own miss-rate on the same scored
  subset** (the reference is now named — r1 TD MAJOR-4).
- **Layer / whose axes:** measured against their majority-class bars. A rubric question
  ships as «corpus-measured» ONLY if its axis beat its bar; an axis that fails ships (if at
  all) explicitly labeled `judgment-only, not corpus-validated` (r1 TD BLOCKER-1 — nothing
  unmeasured may wear a measured provenance).
- The asymmetry stands (D-AP5 direction): a missed MATERIAL is a defect escaping toward
  consumers; a false MATERIAL costs one visible round. §5b records what this quantity can
  and cannot mean.
- «No layer beats C0» remains a legitimate, publishable outcome — and with C0 redefined
  (uncontaminated, non-degenerate) it is no longer the biased-toward outcome (r1 TD
  BLOCKER-2 scenario closed).

## §5b Validity limits (r1 TD MAJOR-1/2/9 — recorded, monitored, not hidden)

1. **Provenance sharing:** every labeler and every candidate is a Claude-family seat
   reasoning from the same ratified yardstick. High agreement is partly shared priors; the
   only fully independent anchor is the operator slice (§3.5). This is ALSO deployment
   reality (the live judge will be a Claude seat applying the same yardstick — ecological
   validity), but the corpus number must never be quoted as model-independent truth.
2. **Construct transfer:** the bench judges decontextualized rows (finding + mechanical
   context); deployed seats judge with the full diff in context, often their OWN findings
   (self-grading — the audit's measured defect direction is self-under-grading). The bench
   therefore measures the cheap-first triage screen, not the full live task. Live detector
   for the gap: L5 morning review + the materiality-dispute rate + periodic audit-mold
   re-measurement; C2 (the self-shaped pass) is the layer closest to the live shape.
3. **The inverse population is out of reach:** MATERIAL-miss is measured among findings that
   were RAISED. Defects never raised (reviews that never happened — audit §7.3) are outside
   any such corpus; their only channel is the production-audit layer (README's last
   channel). D-K5's falsifier covers BOTH directions accordingly.
4. **Power:** n≈120 decides only large effects (~±9pp). Fine ranking between close
   candidates is explicitly out of scope for this bench.
5. **Grade-leak residue + author-cell exclusion (r2 NEW-B1/M2):** grade tokens are stripped
   mechanically (§2); prose synonyms («this blocker», «a nit») are not — the scan catches
   tokens, the operator slice is the only fully independent check on the rest. Author-cell
   populations (td-m3, research-forks, the changelog-only spec reviews) have no
   blind-measurable text — their only surviving form carries the disposition beside the
   finding — so they are enumerated and described, never benched; the highest-materiality
   surface is instead covered by `arch-reviews.csv` rows from preserved full reports, a
   population that GROWS with each future /arch contour (§2).

## §6 Deployment surfaces (winner = protocol text, never CI-LLM)

- Rubric (if C1 wins on the class axis): a compact block in
  [reviewer-discipline.md §6](../../../.claude/rules/reviewer-discipline.md) as the
  severity-contract companion; the same block referenced from
  [agents/fidelity-auditor.md](../../../agents/fidelity-auditor.md) and used by the advisor
  when ruling materiality disputes. **Channel/Class declaration (r1 notes-lane):** prose
  injection, Class C, channel = the reviewer-discipline rule + agent protocols
  ([rule-enforcement-channel-selection.md §3 step 5](../../../.claude/rules/rule-enforcement-channel-selection.md)).
  Each rubric question carries its measurement provenance (`corpus-measured` vs
  `judgment-only` — §5; validity limits travel with it — §5b).
- Self-review step (if C2 pays): a pre-publish «re-grade your own list» step in the
  reviewer protocols.
- Losing layers/axes recorded in the bench report with their numbers («measured — does not
  pay»).
- [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) holds: the bench is
  operator-side; promptfoo never enters CI; deployed artifacts are prose protocol +
  existing deterministic arms only.

## §7 Disposition-vocabulary home (inherited KICKOFF-AMBIGUOUS)

PR #1374's fidelity round flagged: advisor spec §6 says «spec-changelog disposition
vocabulary gains ESCALATED beside ACCEPTED/DISSOLVED» yet no artifact defines that
vocabulary. Resolution: one line in `arch/SKILL.md` §2 defining the changelog disposition
set `ACCEPTED | DISSOLVED | ESCALATED | FIXED` (arch owns the design-review verdict grammar;
`FIXED` is this spec's addition beyond the upstream sentence, grounded in live use in the
advisor spec's own §11 — r1 BU N7). **Lands as its own micro-PR** (one concern per PR —
r1 TD notes-lane), sequenced with S5 but not inside it (§9).

## §8 Post-landing applications (recorded, not built here)

1. **Live triage** in review loops — the primary consumer (§6).
2. **Implementation-fidelity sweep** (operator premise P4, NEW this contour): once
   measured, the judge walks the highest-materiality decisions (idea/design layers, from
   specs + decisions.md) and verifies the implementation did not distort them —
   a materiality-ranked drift audit. The §4 rubric is therefore authored
   application-agnostic: its questions target any «intent ↔ artifact» divergence, not only
   fresh review findings.
3. **Precedent-retrieval bench** once decisions.md has LIVE-CONSULT volume (corpus-
   adjudication entries excluded — §3.4) — the D-K4 volume door; its result is what closes
   D-AP4's own falsifier («kernel-v2 corpus evaluation shows precedent retrieval scoring
   above the v1 baseline → promote»), which otherwise dangles (r2 NEW-m3).

## §9 Stage plan (with rough budgets — r1 TD MAJOR-8; orders of magnitude, config not statute)

| Stage | What | Where | LLM-call order | L4 budget | Depends |
|---|---|---|---|---|---|
| S0 | **Gate-resolved probe (2026-08-11):** ~30 stratified `pr-body` rows (grade-strip + provenance contract §2 applies at probe scale), operator labels = ground truth, C1 vs C0, plain deterministic scorer (~50 LOC, `scripts/` — D-K3's fallback serves as the probe's primary; promptfoo + its capability commit deferred to scale-up) | session, operator in loop | ~30-40 | 1 round → ASK | gate |
| S1 | Corpus assembly per §2 (extraction contract + grade-strip, provenance-substring probe, dedupe check, `sources/` preservation pre-step at kickoff authoring, docs-gate pre-flight: principle 09 + doc gates on the new folder — first tracked CSV under `docs/`, r1 TD MINOR-3) | factory, mid tier (r2 NEW-m4: verbatim-matching ~104 findings across ~13 PR bodies is a reading task, not mechanical) | ~0 API-scored (extraction is reading) | 2 dispatch rounds → ASK | — |
| S2 | Cold re-label, three axes, blind kickoff per §3.1 | factory, mid tier | ~150 short calls | 2 rounds → ASK | S1 |
| S3 | Adjudication (advisor batch + operator slice; per-axis κ/PABAK published) | advisor session + operator | ~60-100 row-verdicts, batched | 2 rounds → ASK | S2 |
| S4 | Bench: promptfoo setup + shim + run + per-axis report (research patch). **Capability commit: promptfoo devDependency + `Prior-art:` trailer + SSOT entry (id ≥250) in the same commit** | factory or session, mid tier | ~200-350 calls (C1 ~150, C2 ~15-25 grouped; C0 $0) | 2 rounds → ASK | S3 |
| S5 | Landing PR (kernel surfaces): protocol-text edits (§6) + spec status flip + `/self-reflection`. reviewer-discipline.md is maintainer-owned — the operator-gated landing PR IS the explicit handoff (precedent #1374; r1 BU N6) | session | ~0 | 2 rounds → ASK | S4 |
| S5b | §7 vocabulary line — separate micro-PR | session | ~0 | — | any time after gate |

**Probe-first path (gate 2026-08-11):** S0 runs first; S1-S5 run ONLY on S0 signal (C1
beats C0 on the probe slice). S1's «2 dispatch rounds» and every later budget are
scale-up-conditional. Whole-contour order of magnitude IF scaled up: ~400-600 short LLM
calls on the subscription pool, zero paid CI; the probe alone is ~30-40. Exit routing
(factory kickoff vs in-session per stage) is decided at the
[arch/SKILL.md §3](../../../.claude/skills/arch/SKILL.md) exit step (r1 BU N4 — the skill's
§3, not this spec's) after the reviews; the stage table is the decomposition either way.

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
   збс») → §4 runner + §9 budget column + §11 D-K3.
7. **P7 — adjudication budget:** advisor adjudicates disagreements; operator takes FLOOR
   rows + a validation sample (~15-30 min), chosen over full-batch (1-2h) and zero-operator
   variants. **r1 amendment CONFIRMED at the 2026-08-11 gate:** sample stratified and
   sized ~15 (was: random ~10) per §3.5 — same time envelope.
8. **P8 — measurement over argument, re-confirmed:** after an explicit «why are convincing
   arguments not accepted — really, why?» challenge, the operator accepted the three-part
   answer (fresh measured cases of convincing-but-wrong; cheap fluency makes argument a
   weak signal; arguments shortlist, measurement decides) and gave GO. Arguments select
   what to measure; the score selects what ships.

## §11 Decision records (each with falsifier)

- **D-K1 — corpus master = CSV files in a folder home.** Grounds: single format, no sync
  gate, bench-native, 600-line-gate-immune. *Falsifier:* adjudication readability suffers
  in practice → generate a read-only md view; CSV stays master.
- **D-K2 — adjudication = cold re-label → per-axis κ/PABAK → advisor → stratified operator
  slice.** Grounds: IAA standard; measures the calibration the audit lacked; advisor pass
  dogfoods the advisor pattern and births decisions.md (segregated). Inflated-agreement
  direction is guarded by the §2 leakage probe (r1 BU MAJOR-2), not by κ itself.
  *Falsifiers:* class-axis κ indicatively very low (config guide ~<0.4 with raw agreement
  also low) → the yardstick prose is defective; fix guidelines, re-label BEFORE
  adjudicating. Operator slice disputed >20% → corpus escalates to the full operator batch
  pass (P7 fallback).
- **D-K3 — bench runner = promptfoo (ADOPT, dev-only).** Grounds: §0.5 probes — task
  matches the tool's core (matrix+equals+cache+exec); thin-adapter cost only. Gate
  2026-08-11: the fallback scorer is the S0 probe's PRIMARY; promptfoo enters at scale-up
  only. *Falsifiers:* exec provider fails on long/grouped prompts → plain scorer fallback
  (~50 LOC), reason recorded; OSS goes maintenance-mode or exec removed post-acquisition →
  re-evaluate (scorer or DeepEval), SSOT revisit trigger.
- **D-K4 — three candidate layers; retrieval deferred; journal door = live entries only.**
  (The mandate's cheap devil's-advocate layer stays parked upstream at
  [advisor-pattern-design D-AP6](2026-08-10-advisor-pattern-design.md) — not a candidate
  here.)
  Grounds: layers are composable stages with separable marginal value; the journal is
  empty of LIVE consults and corpus-adjudication entries are segregated out of the volume
  trigger (r1 TD MAJOR-7 — one batch stage must not flip a ratified deferral). *Falsifiers:*
  no layer beats C0 → publish the honest negative, v1 stands; live-consult volume reaches
  the door → run the retrieval bench with recall/precision (its outcome is the input
  D-AP4's own falsifier waits on — r2 NEW-m3).
- **D-K5 — acceptance = beat C0 beyond the noise floor AND no MATERIAL-miss increase vs
  C0's own miss-rate.** Grounds: D-AP5 asymmetry (miss = escaped defect; false alarm = one
  round); references and noise floor now named (r1 TD MAJOR-4). *Falsifiers, both
  directions (r1 TD MAJOR-9):* live use shows over-flagging flooding rounds → add a
  precision bound at recalibration; a periodic audit-mold re-measurement finds a material
  defect a deployed filter suppressed → tighten or withdraw the layer, incident recorded.
- **D-K6 — vocabulary home = arch/SKILL.md §2, own micro-PR.** Grounds: arch owns the
  review verdict grammar; dispositions are its after-image; one concern per PR. *Falsifier:*
  a non-arch surface needs the vocabulary → move to reviewer-discipline.md §6 with a
  pointer from arch.
- **D-K7 — winner ships as protocol text only.** Grounds:
  [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md); advisor premise 9
  (AI judges substance; mechanisms verify trace). *Falsifier:* a deployed rubric question
  proves mechanically checkable (pure syntax) → promote that question alone to a
  deterministic arm, prose stays for the judgment rest.
- **D-K8 — C0 = original-grade mapping (r1 addition, TD BLOCKER-2).** Grounds: the grade is
  the live pre-contract round-trigger signal, deterministic from the PR record, defined on
  nearly every row. *Falsifier:* the scored subset (rows with a recorded grade) falls below
  ~70% of the corpus, or grades prove degenerate on a population (e.g. all-«—» rows) → fall
  back to the majority-class bar for that population, stated in the report.

## §12 Do NOT re-open (ratified here or upstream)

Kernel v1/v2 split + no-numeric-target (D-AP5, §11c) · measurement-over-argument
acceptance (P8) · one-advisor + decisions-before-application (advisor spec §3/§10) ·
severity contract + notes lane ([reviewer-discipline.md §6](../../../.claude/rules/reviewer-discipline.md)) ·
practice-first default (D-AP8) · corpus labels are starting labels, never ground truth
(advisor spec §5.4) · P3 history-is-evidence.

## §12b Self-application (r1 TD MINOR-4)

The spec's own discipline applied to itself: its two cold reviews ran WITH the ESCALATED
rung — two value-premise findings were routed to the operator, not priced (§13), the rung's
second live use after the advisor spec. The corpus includes the contour's own review
population (`arch-reviews.csv` — this spec's §13 dispositions become future rows), so the
kernel is measured on the class of findings its own design review produces. What is NOT
measured: §2/§3's protocol choices themselves are argument-accepted (IAA lineage + probes),
consistent with P8's split — arguments select the design, measurement gates what SHIPS as a
classifier; the protocol's own quality is observed through the κ/PABAK stats it publishes.

## §13 Review changelog

**Round 1 (2026-08-11):** `top-down-r1.md` — REVISE, 2 BLOCKER / 9 MAJOR /
5 MINOR / 2 ESCALATED; `bottom-up-r1.md` — REVISE, 0 BLOCKER / 5 MAJOR /
7 notes (all 12 links + every quoted audit number verified clean; on-disk filenames — the
§2 `sources/` pre-step locator). Dispositions:

- TD B1 (2 of 3 axes unmeasured; class space incoherent) — **FIXED**: §2 vocabulary mapping
  + binary class axis, §3 three-axis labeling, §5 per-axis bars + provenance labels.
- TD B2 / BU M1 (C0 degenerate/contaminated; `label_final` enum undefined) — **FIXED**: §4
  C0 = orig-grade mapping (D-K8), start-vs-final demoted to biased descriptive stat, §2
  enums + judge output contract.
- TD M1/M6 (circularity; MATERIAL-b single-judge; weak anchor) — **FIXED** (partly as
  recorded limits): §3.5 stratified slice, §3.4 labeling instruction, §5b.1; residual
  honesty in §5b.
- TD M2 (construct transfer) — **RECORDED + monitored** (§5b.2; live detectors named).
- TD M3 / BU M2 (Basis leakage; blindness unachievable) — **FIXED**: §2 extraction contract
  + deterministic leakage probe as S1 DoD.
- TD M4 (no noise floor; undefined reference) — **FIXED**: §5 class-axis rule.
- TD M5 (/arch population missing) — **FIXED**: `arch-reviews.csv` (§2).
- TD M7 (journal seeding trips D-AP4) — **FIXED**: §3.4 segregation + D-K4 re-cut.
- TD M8 (no cost estimates / L4 budgets) — **FIXED**: §9 budget columns.
- TD M9 (asymmetry quantity unmeasurable) — **FIXED as honesty**: renamed metric, §5b.3,
  D-K5 two-direction falsifier.
- BU M3 (population overlap) — **FIXED**: §2 disjoint-by-construction + uniqueness check.
- BU M4 (SSOT stage mismatch vs live `prior-art.ts` gate) — **FIXED**: §9 S4 same-commit.
- BU M5 (second TD-M3 source) — **FIXED**: §0 + §2 dual citation.
- TD MINORs: M-1/BU N1 (stale `:165` cite) — **FIXED** (§0); M-2 (κ paradox) — **FIXED**
  (§3.2 PABAK); M-3 (first CSV under docs) — **FIXED** (§9 S1 pre-flight); M-4 (no
  self-application) — **FIXED** (§12b); M-5 (S1 fills judgment fields) — **FIXED** (§3.1).
  BU notes N2-N7 — **FIXED in place** (§0 three-vs-four; §2 UNRECOVERABLE; §9 exit-routing
  referent; §2 per-spec changelog locators; §9 S5 ownership handoff note; §7 FIXED
  provenance).
- TD ESCALATED-1 (proportionality of THIS scale of measurement — is a cheaper probe, e.g.
  ~30 stratified operator-labelled rows + one candidate, enough?) and ESCALATED-2 (is a
  null result worth the full corpus cost?) — **OPEN-FOR-OPERATOR** at the gate, routed not
  priced (the rung working as designed).

**Round 2 (2026-08-11):** `r2-verify.md` — cold verification seat over the r1 revision;
REVISE 1 BLOCKER / 4 MAJOR / 4 MINOR. The verification half is clean: all r1 dispositions
confirmed — 19 VERIFIED / 7 PARTIAL (named residues) / **0 NOT-FIXED / 0
MISSING-DISPOSITION**. New-finding dispositions (r2 repairs, this revision):

- NEW-B1 (grade tokens ride the verbatim `finding` text — the «blind» seats and every
  candidate read C0's input; TD B2's failure shape re-entered through its own repair) —
  **FIXED**: §2 grade-strip normalization + grade-token scan; §4 shim note; §5b.5 residual.
- NEW-M1 (r1 phrase-list probe fails S1 on correctly-built rows — «fail-open» is the #1341
  findings' own wording) — **FIXED**: probe re-based on the provenance-substring check,
  phrase list dropped with reason (§2).
- NEW-M2 (`arch-reviews.csv`/`research-forks.csv` unbuildable under the extraction
  contract; only surviving text is the banned author-cell shape) — **FIXED**: `provenance`
  field + per-population sourcing; arch-reviews re-cut to tracked full review reports
  (`sources/` pre-step + going-forward preservation rule); author-cell rows excluded from
  blind labeling and the bench, enumerated descriptively (§2, §3.1, §5b.5).
- NEW-M3 (`UNRECOVERABLE` rows had no route to `class_final`) — **FIXED**: §3.3
  advisor confirm-or-override route.
- NEW-M4 (r1 gate note pointed the operator the wrong way on E2) — **FIXED**: note replaced
  (below) + §4 expected-strength pre-read.
- NEW-m1 (noise floor lacked a rule form) — **FIXED**: §5 pass rule (CI excludes zero —
  form statute, values config). NEW-m2 (E1 summary dropped its effort-worthiness ground) —
  **FIXED** in the gate note below. NEW-m3 (D-AP4 mis-credited with the volume door) —
  **FIXED**: §3.4 / §8.3 / D-K4 attribution. NEW-m4 (S1 «~0 mechanical» mis-tiered) —
  **FIXED**: §9 S1 mid tier + honest estimate. r2 notes lane (§5b hop, §13b-class
  locators, «disjoint by construction» over-claim + missing assignment rule) — **FIXED in
  place** (§6, §2).

**Gate note (replaces the r1 note per NEW-M4/NEW-m2):** E1 carries effort-worthiness §1
both ways — whoever keeps the full 5-stage scale must state what breaks if the ~30-row
probe replaced it and what learning-in-practice costs instead. E2 is SHARPENED, not
softened, by the r1 C0 repair: the contamination bias is gone, but C0 now pre-reads strong
(§4, ~0.8-0.9), so «no layer beats C0» is the LIKELY outcome — the operator is deciding
whether that honest null is worth the full ~400-600-call + S1-S3 spend.

**Review cap:** 2 REVISE rounds reached ([arch §2](../../../.claude/skills/arch/SKILL.md)).
r2 repairs are author-applied; round-3 verification vs gate-as-is vs park is the operator's
fork at the gate — surfaced, not decided (r2 report §6).

**Operator gate (2026-08-11) — resolutions:** r2 repairs **ACCEPTED at the cap** (no round
3; a fresh cold look recurs at the next kickoff's Phase -1 anyway). E1/E2 **RESOLVED →
probe-first** (§9 S0): ~30 stratified operator-labelled `pr-body` rows, C1 vs C0, plain
scorer; the full S1-S5 corpus runs only on probe signal — the null, if it comes, is bought
at ~1/10 the price E2 priced. P7 amendment **CONFIRMED** (stratified ~15 — §3.5/§10;
under probe-first it applies at scale-up). Exit per arch §3: spec lands on staging; S0 is
in-session (operator-in-loop labeling), no factory kickoff until S0 signals.
