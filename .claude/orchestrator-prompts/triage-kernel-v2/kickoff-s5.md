# Kickoff S5 — landing PR, kernel surfaces (triage-kernel-v2)

> **Dispatch input.** Stage S5 of the [triage-kernel-v2 router](kickoff.md) §1, route **C**
> (router §2: *Synthesis of both axes → S5 landing PR · top tier — synthesis is its role*).
> Protocol authority: design spec
> [§5 · §5b · §6 · §9 :387 · D-K7 :467](../../../docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md).
> Rigor label (L0): `build-and-verify` — the measurement (research-grade) is spent in S4/S4b;
> what remains is reversible protocol prose, verified by a cold fidelity round + the §7 suite
> ([effort-worthiness.md §1](../../rules/effort-worthiness.md): reversibility, not importance,
> sets process weight). Executor: **session** (top tier, session C — router §2 rule 3; NOT aif;
> route rule 3 keeps the top tier out of the in-container runtime, and S5 is ~0 LLM-call
> volume). Budget: **2 rounds → ASK**.

## §0 The ratified position (operator fork, resolved 2026-08-16)

The bench came back with the load-bearing axis **failed**, and spec §6's deployment surfaces
are conditional («*if* C1 wins on the class axis», «*if* C2 pays») — neither condition fired.
Whether S5 lands at all was therefore an idea-layer operator fork
([effort-worthiness.md §1](../../rules/effort-worthiness.md) materiality-by-layer), raised and
resolved 2026-08-16: **land S5 now**. The grounds: the measured null is a first-class spec §6
deliverable («Losing layers/axes recorded … *measured — does not pay*»); parking buys no data
(no larger corpus is funded; `arch-reviews.csv` grows independently of the umbrella being
open); protocol prose is reversible. Per-axis dispositions, all three decided:

- **layer — DEPLOYS as `corpus-measured`.** Spec `:297-299` is a *necessary* condition
  («ships as corpus-measured ONLY if its axis beat its bar») — the axis beat its bar, and
  this kickoff, under the ratified fork, makes the deployment decision the bar alone could
  not.
- **class — does NOT deploy as a filter.** What ships is the measured null: **C0 (the
  `orig_grade` severity mapping) remains the class bar**, stated in protocol text with the
  bench numbers.
- **whose — ships labelled `judgment-only, not corpus-validated`, regardless of its score**
  (W-1, spec §5). Never cite it downstream as validated.
- **C2's self-review step — does NOT deploy** («if C2 pays» did not fire: its class leg 1
  failed, and it is defined as a delta over C1, never a standalone winner). Recorded as the
  second measured null.

## §0b Predecessor results (W-2 pattern — quote, do not re-derive)

**S4 — the bench.** PR #1397, squash `fa8da9406c`. Report:
`docs/meta-factory/research-patches/2026-08-16-triage-kernel-v2-s4-bench.md`.

- **class (n=131 scored subset):** C0 **0.733** · C1 0.687 · C2 0.710. MATERIAL-miss:
  C0 **0.319** · C1 0.351 · C2 0.266. Acceptance is two legs, both required: C1 leg 1
  p=0.4514 **fail**, leg 2 **fail**; C2 leg 1 p=0.7608 **fail**, leg 2 pass →
  **both candidates DOES-NOT-SHIP on class.**
- **layer (n=151):** C1 **0.662**, C2 **0.642** vs the 0.530 majority bar
  (p=0.0012 / p=0.0076) → **both beat the bar.**
- **whose (n=151):** 0.848 / 0.854 against a 0.901 majority bar — travels as
  `judgment-only` whatever it scores (W-1).
- **C1 is confounded by construction** — shares rubric and model family with the cold rater
  whose labels survive on 122/151 rows; the §3.6 override-slice breakdown (C0 0.760 vs C1
  0.480 on the 25-row override slice) carries an n≈25 power caveat and is never a second
  acceptance gate.
- Substrate frozen at `7425346f0b`, byte-verified by S4's arm F. Judge = literal `sonnet`,
  pinned by name at both call sites.

**S4b — the outcome audit.** PR #1400, squash `d46f3c87bf`. Report:
`docs/meta-factory/research-patches/2026-08-16-triage-kernel-v2-s4b-outcome-audit.md`.

- **HOLDS 139/151 (92.1%) · MOVED 8 · NEVER-DONE 3 · DECLINED 1 · DRIFTED 0 ·
  UNVERIFIABLE 0.** Costs: VISIBLE **0** · NONE-FOUND 16 · N/A 135. Disagreement rows: 0.
- **Binding usage rule (kickoff-s4b §8):** a rubric question that ships as `corpus-measured`
  **may cite the bench number, and never the outcome axis**, as its validation.
  `cost=NONE-FOUND` on a MATERIAL row is not evidence the label was wrong (T-TK4b-B).
  Survivorship is named: high HOLDS is a property of the merged-PR population, not a grade.
- **The drift register routes to a SEPARATE repair umbrella, never into S5.**

## §1 Objective

Land the kernel-v2 surfaces per spec §6 under D-K7 (`:467` — **winner ships as protocol text
only**, never CI-LLM), flip the spec status, run `/self-reflection`, and open a
single-concern PR to `staging` whose merge is **operator-gated**:
`.claude/rules/reviewer-discipline.md` is maintainer-owned (CLAUDE.md Artifact Ownership
Contract), and the operator-gated landing PR **is** the explicit handoff (precedent #1374).
Say this in the PR body; do not treat the rule edit as routine.

## §2 Permitted files

**Edit:**

- `.claude/rules/reviewer-discipline.md` — the compact triage-rubric block inside §6 (§3.1).
- `agents/fidelity-auditor.md` — one reference line from its severity-contract paragraph
  (`agents/fidelity-auditor.md:91`) to the new §6 block.
- `docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md` — status-header flip +
  landing record (§3.3). No other spec section may be rewritten.
- `.claude/rules/00-rule-index.md` — **only if** the reviewer-discipline digest row changes;
  regen via `npx tsx scripts/render-rule-index.mjs --write`, never hand-edit.

**Not permitted:**

- `.claude/skills/arch/SKILL.md` — that is **S5b**, its own micro-PR (spec §7, `:355-361`).
- Every corpus artifact (`docs/meta-factory/triage-corpus/**`), every `scripts/triage-*`
  script, both S4/S4b research patches — frozen; §7 line 2 re-runs S4's arms and goes RED if
  a bench number moves. The provenance labels cite these; they do not edit them.
- Any repair of drift-register rows — separate umbrella (§0b).
- Anything under `packages/` except running its test suites.

## §3 Method

### §3.1 The rubric block in reviewer-discipline.md §6

The measured artifact is the **frozen rubric prompt**
`docs/meta-factory/triage-corpus/s2-rubric-whose.md` — the yardstick sentence, questions
1-4, and the layer/whose definitions. The bench measured the axes *through that text*; the
shipped block therefore **quotes it compactly, it does not paraphrase it** (a reworded
question was never measured — T-TK5-B). The block carries per-axis provenance labels:

- **layer** (question 4 + the layer definition): `corpus-measured` — cite
  `S4 bench: C1 0.662 / C2 0.642 vs 0.530 majority bar, p=0.0012 / p=0.0076, n=151`
  (research patch `2026-08-16-triage-kernel-v2-s4-bench.md`). Bench number only — never the
  outcome axis (§0b binding rule).
- **class** (yardstick + questions 1-3): the measured null, stated as protocol text — *the
  rubric class verdict does not replace grading; C0, the `orig_grade` severity mapping,
  remains the class bar* — with the §0b class numbers and «measured — does not pay».
- **whose** (the whose definition): `judgment-only, not corpus-validated` (W-1). It already
  mirrors §6's ESCALATED grammar (reviewer / advisor / operator-floor); the label is the only
  change in its standing.
- **Validity limits travel with the labels** (spec §5): one pointer line to spec §5b — the
  five limits (provenance sharing, construct transfer, inverse population out of reach,
  power ±9pp at n≈120-151, grade-leak residue) qualify every number quoted.
- **D-K7 falsifier, recorded in the block or beside it:** a deployed rubric question that
  proves mechanically checkable (pure syntax) → promote that one question to a deterministic
  arm; prose stays for the judgment rest.

The block is Class-C prose injection: channel = the reviewer-discipline rule + agent
protocols (spec §6's own channel declaration). `promptfoo` never enters CI
([no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md) holds).

### §3.2 The fidelity-auditor reference

One line at the severity-contract paragraph pointing to the §6 rubric block, so a cold
fidelity seat applies the same three-axis triage with the same provenance caveats. No
protocol restructuring — the auditor's own grammar is untouched.

### §3.3 Spec status flip

Replace the `GATED-GO, probe-first` status header with a landing record: measured S0-S4b,
per-axis outcome (layer deployed `corpus-measured`; class = measured null, C0 remains the
bar; whose `judgment-only`; C2 step not deployed), pointer to both research patches and to
the ratified 2026-08-16 operator fork. §8's post-landing applications and D-K7's falsifier
stay live — the status flip closes the *measurement* contour, not the ideas.

### §3.4 `/self-reflection`

The stage edits a `.claude/rules/*` file — run the `/self-reflection` skill on the change
(forward/backward check) before the PR is handed to review. Spec `:387` names this
explicitly; it is not optional hygiene.

## §4 Deliverables

The single-concern landing PR to `staging`: reviewer-discipline §6 block + fidelity-auditor
reference + spec status flip + (conditionally) regenerated rule index, with the FIDELITY
block in the PR body. PR-body gate traps unchanged from S4b §7: dry-run `checkPrBodyFidelity`
and the `discipline-self-check.yml:102` awk extractor before `gh pr edit`; `Round:` bare
digits; `Audited-SHA` must prefix the head SHA.

## §5 Inputs (read scope)

Design spec **§5 · §5b · §6 · §7 · §8 · §9 · D-K7 (§11)** · both research patches (§0b) ·
`docs/meta-factory/triage-corpus/s2-rubric-whose.md` (the frozen rubric text) ·
[reviewer-discipline.md](../../rules/reviewer-discipline.md) (the §6 it extends) ·
[agents/fidelity-auditor.md](../../../agents/fidelity-auditor.md) ·
[effort-worthiness.md](../../rules/effort-worthiness.md) · [kickoff-s4.md](kickoff-s4.md) §8 +
[kickoff-s4b.md](kickoff-s4b.md) §8 (exit contracts). All tracked — no container probes
needed; S5 runs on the host.

## §5b Open residue S5 inherits (named, not silently dropped)

- **S4/S4b notes-lane (cold rounds, unfixed by design):** S4 arm E's prose leg is a
  value-set presence check, one-directional (`NUM` → prose); S4b arm G's converse silently
  exempts `.ai-factory/plans/**` (inert today); arm C accepts `path:N-M` spans where the
  kickoff writes `file.ext:line`; a stale comment at `scripts/triage-s4b-outcomes.mjs:60`.
  None are S5 obligations — name them in the PR notes lane if adjacent, else leave recorded
  here.
- **GAP-FOUND (S4 backward-check), observation only:** `scripts/triage-s0-score.mjs:83` and
  `scripts/triage-s3-agreement.mjs:136` reconcile no report number;
  `docs/meta-factory/triage-corpus/README.md` is read by no script and no principle. A
  candidate for a future chip — NOT an S5 deliverable (T-TK5-D).
- **aif task `7cd11b76-6c1a-41da-a79d-5161700f6bd2` stuck at `implementing`** with merged
  work; close via `/aif-doctor` (the dispatching/merging session's chore, not S5's edit).
- **`done.md` is owed by whoever merges S5** (umbrella closure convention, router §2 tail) —
  the load-bearing `priority-score.sh` Layer-C3 marker. The umbrella stays OPEN through
  S5 + S5b.

## §6 AI-traps (per [ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md))

Active canonical traps: **T3, T5, T6, T15, T19, T20**. T3: every number in the shipped block
must byte-match the frozen report (§7 line 2 enforces the report side; the block side is the
fidelity round's job). T5: this is a landing stage — no new measurement, no rubric
re-benching. T6: provenance labels ARE the calibrated-confidence statement; never upgrade
one. T15: `/self-reflection` on the rule edit is mandatory (§3.4). T19: own cold fidelity
round before handoff. T20: the PR body quotes the report lines it relies on. Domain-specific:

- **T-TK5-A — provenance inflation.** «The bench ran on all three axes» tempts labelling
  class or whose `corpus-measured` because a number exists. Bar-beating is per-axis and
  *necessary, not sufficient* (`:297-299`); class failed both legs and whose is W-1-pinned.
  Counter: §0's per-axis dispositions are the only labels; the fidelity round diffs labels
  against §0.
- **T-TK5-B — paraphrase voids provenance.** Rewriting the rubric «cleaner» while keeping
  the `corpus-measured` label ships an unmeasured text under a measured name. Counter: §3.1
  quotes the frozen rubric; any rewording demotes the label to `judgment-only` or waits for
  a re-bench.
- **T-TK5-C — outcome axis cited as validation.** HOLDS 92.1% reads like corroboration of
  the labels; kickoff-s4b §8 forbids exactly that citation. Counter: §0b binding rule; the
  block cites bench numbers only.
- **T-TK5-D — landing-stage scope creep.** The drift register, the GAP-FOUND scripts, S5b's
  vocabulary line, and every notes-lane item are adjacent and tempting. Counter: §2's
  not-permitted list; one concern per PR.

## §7 Acceptance (host-verify)

```bash host-verify
npm run --prefix packages/core test:principles
node scripts/triage-s4-score.mjs --check
node scripts/triage-s4b-outcomes.mjs --check
```

Line 1 is **binding** (router §2 route rule 4, PR #1401): S4b shipped a principle-10 red past
seven arms, four §7 lines and a cold fidelity GO — the K4 emitter cannot substitute
(`scripts/host-verify-coverage.sh:145` collapses `docs/**` to two segments). It also carries
the doc-authority principle over the edited rule and spec headers. Line 2 re-runs S4's arms —
RED if any bench number this stage quotes moved underneath it, which turns the §3.1 citation
integrity from prose into a gate on the report side. Line 3 does the same for the S4b
artifacts. What no line gates, stated plainly: whether the *shipped block's* labels match §0
and its quotes match the frozen rubric is judgment — carried by the cold fidelity round
(T19), not by a syntactic check
([attention-is-not-a-mechanism.md §1](../../rules/attention-is-not-a-mechanism.md): the round
is a NAMED cold-agent protocol, not bare attention). `markdownlint` fires at pre-commit on
the host — no container re-staging applies to this stage.

## §8 Budget + exit

L4 budget: **2 rounds → ASK** (spec §9 `:387`). Exit: S5 merges (operator-gated) → the
merging session writes `done.md` in this directory (router §2 tail) and closes the stuck aif
task via `/aif-doctor` (§5b). **S5b** — the `arch/SKILL.md` §2 disposition-vocabulary line —
lands as its own micro-PR, any time post-gate, never inside S5. The drift register's repair
umbrella is authored separately, consuming S4b's ranked register.

## §9 Pre-dispatch (in this order)

1. This kickoff on `staging` before any S5 session starts
   ([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)); the file is
   a real tracked file, not a CANON symlink (`git check-ignore -v` → matched by the
   `!kickoff-s*.md` negation).
2. **A mid-tier cold seat reviews this kickoff** (router §2 rule 1) — fed this file and the
   design spec ONLY; never the authoring dialogue or `handoff-s5-authoring.md` (a seat that
   has read the story cannot audit it). One batched correction PR if REVISE.
3. `SLUG=triage-kernel-v2 bash .claude/skills/dispatcher/helpers/probe-inflight.sh` — a bare
   `IN-FLIGHT` on this umbrella has been a squash artefact every time; discriminate per
   ahead-branch with `gh pr list --head <branch> --state all`; never treat
   `PROBE-INCOMPLETE` as FRESH.
