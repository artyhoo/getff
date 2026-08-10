<!-- scope: /arch design spec for the advisor pattern — cross-session consultation (ASK/ANSWERED),
     the standing arch advisor seat, the effort-worthiness discipline, and the reviewer-half
     ESCALATED grammar. Ratifies v2 Part II (approach A). Successor-session output of the
     2026-08-10 contour; dialogue state inherited from 2026-08-10-arch-prep-advisor-pattern.md. -->

# Advisor pattern — cross-session consultation, effort-worthiness, ESCALATED reviews

> **Status:** DESIGNED — awaiting cold §2 reviews + operator spec gate.
> **Branch:** `claude/advisor-pattern-consultation-86f49b`. **Current as of 2026-08-10.**
> **Authoritative for:** the ASK/ANSWERED verbs + ask-file surface (§2), the advisor seat (§3),
> transport cascade + degradation (§4), routing/rights + the effort-worthiness loop (§5),
> the reviewer ESCALATED grammar (§6), decision records with falsifiers (§9).
> **NOT authoritative for:** anything ratified elsewhere — [session-bus-v2](2026-08-09-session-bus-v2.md)
> Parts ratified, [autonomous-night-v3](2026-08-09-autonomous-night-v3-design.md) §2/§6,
> [ADR](2026-08-09-pipeline-chips-session-bus-design.md) Parts 1/3/4, night-mode, dispatcher,
> seat-lifecycle stand as merged. Project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).

## §0 Context and origin

Operator directive (2026-08-10, verbatim-faithful): a Fable seat holds the key decisions and
knows which implementations approach the goal; when a working seat hits a fork it is unsure
about, it rings the advisor; the advisor resolves it at top quality in its own context,
records the decision for morning review and possible revert, and the working seat does not
stall. Wanted for night sessions and the pipeline generally — **and, as a product, for
consumer projects**: the operator repo is only the first consumer of its own delivery
(«у них свой проект, у нас свой, но там это работать должно так же»).

Evidence base: TD-M3 twice (a review seat priced a VALUE question without the concept
premise — [session-bus-v2 §14](2026-08-09-session-bus-v2.md); second instance in this
contour, corrected by the operator's token-economy premise); the review-effort-theatre audit
([research patch 2026-08-10](../../meta-factory/research-patches/2026-08-10-review-effort-theatre-audit.md),
PR #1369 — measured: 1/25 rounds triggered solely by immaterial findings; real leakage in
follow-up PRs, the Audited-SHA treadmill, ~34% finding-list padding); the operator's
over-rigor complaint (epics/dissertations where build-and-verify would do).

### §0.5 Research contour satisfaction

Satisfied by the standing probe corpus — P1 (idle-wake positive), P4 (cwd join positive),
F4a/F4b (CLI birth positive, both recipes), P6 (native cross-session messaging works
post-restart; fine-grained matrix pending, §8 item 10) — plus SSOT
[prior-art-evaluations.md#201](../../meta-factory/prior-art-evaluations.md) (Anthropic
Advisor tool, ADAPT: night-mode delta item 7 is the in-repo precedent; our delta = standing
cross-session seat instead of per-consult subagent). The NEW effort-worthiness rule (§5.3)
carries its own prior-art obligation before landing — §8 item 5.

## §1 Frame

**Approach A (operator-ratified):** this ONE spec ratifies v2 Part II in full
(PARKED/REBIND/NUDGE + §6 addressing + §9 kill-switch) AND adds the advisor extension.
Grounds: all entry probes positive; ASK/ANSWERED depend on v2 §6/§9 anyway; the two
stale-in-place v2 clauses (`session-bus-v2.md:278-279` «recipes ONLY … conditional on F4
staying negative»; §9 claim-1 scope) are fixed in the same landing PR; the ADR Part-2/D5
supersession pointer lands once.

**Consumer trajectory (operator premise, this session):** everything here ships to consumer
projects eventually — pipeline, skills, advisor. The design therefore hardcodes no
operator-only assumptions: the ask surface is rooted at `${CLAUDE_COORDINATION_DIR:-…}`,
the advisor identity is a role (not a person or hostname), and the effort-worthiness rule is
authored consumer-generic (precedent: F10 resolved consumer-generic; F4b landing audience
DECIDED consumer-shipped). Operator-repo landing = first consumer + dogfood; consumer
delivery is a follow-up stage with its own review, never a silent copy.

## §2 Grammar + ask surface (v2 §7 extended — 5 verbs)

```text
AIF-BUS v1 PARKED   ref=<relative-path>          (unchanged)
AIF-BUS v1 REBIND   ref=<relative-path>          (unchanged)
AIF-BUS v1 NUDGE    ref=<relative-path>          (unchanged)
AIF-BUS v1 ASK      role=<sender-role> ref=<relative-path>
AIF-BUS v1 ANSWERED ref=<relative-path>
```

- **ASK** — senders: local seats ONLY (dispatcher, pipeline, review contours via their
  dispatching session; reviewer agents stay read-only — the orchestrating session files the
  ask). Container workers NEVER send ASK: their channel stays aif park → dispatcher
  observes. Recipient v1 = advisor (arch). Pull-twin: advisor sweep of the asks dir.
- **ANSWERED** — recipients: local askers only. For aif parks the return leg stays
  `answer.ts` REST-unpause (no verb). Pull-twin: asker re-reads its open asks at turn
  start. v2 §7 un-freeze condition met literally: the local-parker class materialized
  (local seats filing consults); «its own review» = this contour's §2 cold reviews.
- **Ask files = mailbox truth-store, NOT bus machinery.** The OFF tombstone silences
  doorbells + seat-file writes; ask files keep landing (they are work artifacts). Path:
  `${CLAUDE_COORDINATION_DIR:-$HOME/.claude-coordination/rules-as-tests-aif}/session-bus/asks/<YYYY-MM-DD>-<role>-<slug>.md`
- **Ask file schema:** `asker` (role + cwd) · `class` (`consult | materiality-dispute`) ·
  question (≤1 screen) · options considered · evidence pointers · for disputes: the finding
  verbatim + the objection · answer block (`verdict`, one-line rationale, `decided-by`,
  timestamp) · `status: open | answered | escalated | withdrawn`. Atomic write-temp+rename.
  Schema presence is mechanically checkable (channel 1); content is judgment (channel 2).
- Laws 1/2 hold; grep-gate (§9 claim 1: zero bus refs under `packages/`) untouched;
  claim 2 (verb↔pull-twin) extends to 5 rows.

## §3 Advisor seat

- **Identity:** the existing `arch.json` role (v2 §6) — NOT a new role class; the registry
  stays three roles (v3 §2 TD-M4). Standing app session in a dedicated worktree; repo-root
  ineligible; addressed by `cwd` only (P4: published `branch` can be stale).
- **Three invariants:**
  1. **decisions.md entry BEFORE application** (v2 §4 shape) — before any `answer.ts`
     apply or ANSWERED send. Consequence: the advisor's state lives in artifacts, so a
     context-window handoff loses tone, not state.
  2. **ZERO new rights** — v3 §6 object cut by pointer (floor dominates; ambiguous →
     floor; ceiling sentence as-is). The advisor pattern is a LATENCY change to an
     already-ratified authority structure, not an authority change.
  3. **Concept-level answers** — the advisor never implements. For aif parks the advisor
     applies via `answer.ts` (ratified v2 §4 path); for local asks THE ASKER applies.
- **Cost knowledge (Q1 resolved, §9 D-AP2):** no price-sheet, no measurement job, no fourth
  seat. Yardstick = goal-progress-per-effort (§5.3 card) + the measured
  [cold-seat-economy.md §3](../../../.claude/rules/cold-seat-economy.md) table where it
  applies. Every spend-sensitive verdict's decisions.md entry records **predicted effort →
  what it buys**; morning review compares against actuals. Systematic mispricing →
  consolidate a price-sheet artifact FIRST; a seat only if the artifact still fails
  (artifact-before-seat).
- **Continuity:** seat-lifecycle protocol as-is ([seat-lifecycle.md](../../../.claude/rules/seat-lifecycle.md));
  T_soft → Part-3 handoff (numbers stay provisional — PARK-CDC-1; the mechanism, not the
  thresholds, is normative here). Standing seat = operating mode; artifact-backed rebuild =
  the failure mode, routinely survivable (this contour is its own third live transfer).
  Night honesty: a CLI-born successor is ccd-deaf (F4a check (a)); until the P6-matrix
  passes, night degradation = defer-non-trivial or sweep-shot successor.
- **Token-economy premise (operator):** a standing seat holds context — no per-consult
  re-briefing; an idle app session burns zero between consults (doorbell transport).
  Falsifier: live consults show heavy re-briefing anyway → revisit standing mode.

## §4 Transport + degradation

- Doorbell semantics transport-agnostic (v2 §7 sender algorithm unchanged). Send-time
  cascade: (1) native cross-session SendMessage IF capability present AND target
  discoverable via ListAgents — until the P6-matrix passes, native counts as capability
  ABSENT; (2) else ccd `send_message` via cwd-match (v2 §6); (3) else nothing — the
  pull-twin carries. One attempt per doorbell total; the cascade is channel choice, not
  retries. After the matrix passes, the order is fixed native-first; the swap is a recipes
  edit, zero code. Own-stack-first grounds
  ([build-first-reuse-default.md §1.1](../../../.claude/rules/build-first-reuse-default.md)):
  native reaches CLI-born successors ccd cannot.
- **P6-matrix (post-spec work item, never a spec blocker):** discovery app↔app / app↔CLI /
  CLI↔app + agent naming/collision (output = native addressing recipe; reserve: `name`
  field in seat files); **idle-wake** (critical — parity with P1); **night permission
  classifier** on unattended sends, 2.1.222 behavior (critical); pointer-only grammar in
  native body. Any critical cell red → default stays ccd; re-run after next CC update.
- **Degradation rows (extend v2 §9):** advisor absent → asks accumulate, morning sweep
  (= today); ASK lost → file waits; ANSWERED lost → asker re-reads at turn start; native
  classifier-blocked at night → cascade to ccd; CLI-born successor → deaf until matrix.
  Kill-switch inheritance: v2 §1 «delete it → today's behavior returns» holds — every ask
  lands as a file regardless; the doorbell only accelerates. «Работа не простаивает» is a
  latency claim, never a correctness one.

## §5 Routing, rights, and the effort-worthiness loop

### §5.1 Routing — by question CLASS, no mandatory hop chain

Execution-technical → the dispatcher owns it (execution owner, not an advisor).
Resolvable by a recorded rule → applied in place, no consult. Concept/value («does this
match the intent? is it worth it?») → ASK the advisor. Floor-object (v3 §6) → operator
direct (the advisor may pre-build the decision package). Container workers: aif park only.
Every hop either resolves or re-classifies; blind relay is not a state.

### §5.2 Rights — zero new, and the live axis

- Floor = the v3 §6 object cut **verbatim, by pointer** (goal · maintainer-owned artifacts
  per Ownership Contract · scope widening/new PRs · security/permissions · spend ·
  self-widening of any envelope). Ambiguous → floor. Anti-smuggling: envelope widening is a
  v3 §6 edit = operator fork, never a recipe edit.
- **Spend is a dormant floor item under subscription billing** (operator premise): no
  per-call money exists; it stays listed for the day a genuinely paid surface appears.
- **The LIVE severity axis for this project is operator-internal vs consumer-shipped**
  (operator premise, this session): everything ships eventually; surfaces that reach
  consumers (`packages/`, templates, shipped skills/agents) default to the strict tier,
  the operator repo's internal kitchen defaults to build-and-verify. This axis, not money,
  drives rigor labels (§5.3 L0).

### §5.3 The effort-worthiness loop — six layers (the card is only the statute)

Root premise (operator, verbatim-faithful): cost = effort × time × tokens **against goal
progress**; «больше практики и продукта — мы боевые практики, а не научные исследователи»
(more practice and product — we are field practitioners, not research scientists). The AI
judges substance; mechanisms only verify the judgment happened and was recorded. Theatre
came from three absences — premise, permission, trace — not from inability to judge.

- **L0 — rigor label in the kickoff:** `research-grade` (irreversible / consumer-shipped /
  genuinely expensive) or `build-and-verify` (default). Declared by the kickoff author, who
  holds the task's why. Label presence = mechanical check (principle-test class).
- **L1 — the four-test card (statute, judgment):** does this effort move us toward the
  goal? / is it theatre? / is it immaterial — changes nothing? / or material but cheaper to
  **verify in practice after building**? Default practice-first; the burden of proof sits
  on MORE rigor: a demand for a probe/experiment/extra round must state what breaks
  without it (proportionality rule). Reversible + cheap live verification → build now,
  verify in practice, falsifier recorded.
- **L2 — precedent RECORDING (not reliance):** every verdict already lands in decisions.md;
  entries are precedent-shaped (question class, verdict, rationale). **Reliance on
  precedent matching is deliberately deferred to kernel v2** — surface similarity ≠
  structural similarity (the CBR indexing problem; operator critique ratified): «1% vs 2%»
  in a research report is immaterial, the same delta in a gate threshold is material.
  Recording is cheap and reversible; trusting analogy is the risky half.
- **L3 — mechanical skeleton (channel 1):** a re-review/re-research round CANNOT be
  triggered without a filled `Failure-scenario:` field (grep-gated in the review protocol);
  ask-file schema validity; decisions.md-before-application; L0 label presence. An empty
  field is caught mechanically; a *fabricated* field is channel-2 territory — disputable
  via `materiality-dispute`, visible at morning review.
- **L4 — budget tripwire (channel 1 trigger of escalation):** a stage exceeding its
  round/token budget → **forced ASK to the advisor before continuing** — an escalation,
  never a guillotine (the audit measured #1311 R3-R5 all material: a hard cap would have
  shipped defects). Budget numbers deliberately NOT set here — calibrated from the
  review-effort-theatre rates (audit chip `task_c8cfb806`) at landing; the mechanism is
  normative, the numbers are config.
- **L5 — escalation judge + calibration:** the advisor (concept premise, §3) judges the
  residue with the same card, citing the test item in decisions.md; morning review reads
  the journal; theatre rates re-measured periodically (same audit mold). Zero-finding
  reviews are a legitimate outcome (KPI shift — the audit's root-cause line).

### §5.4 Triage kernel — safe v1 now, dedicated corpus-driven v2 contour

The classifier «material / immaterial / whose question» is the design's narrowest
bottleneck, and neither the operator nor this session holds a proven mechanism (stated
honestly, both sides). Resolution (operator-ratified fork §9 D-AP5, and itself the first
live application of §5.3 — the practice-first cut on the reversible half, dedicated rigor
on the load-bearing half):

- **v1 (this spec):** the conservative kernel — L0 label + L1 card + L3 skeleton +
  when-in-doubt-ask-up. Safe by construction: under-grading lands in the visible,
  revertible notes lane; over-escalation costs one advisor line; floor ambiguity → floor.
  Classification errors degrade to latency and residual theatre, never to lost
  correctness.
- **v2 (dedicated follow-up contour, first-class §8 item):** candidate mechanisms
  (precedent retrieval, rubrics, cheap devil's-advocate, anything prior-art surfaces) are
  accepted ONLY by measured performance on a **labeled corpus with known answers**: the
  audit's ~104 material/immaterial-labeled findings (PR #1290-#1365) + S4's under-graded
  round-7 «MINORs» + both TD-M3 incidents + kickoff-revision loops, extended with
  research-fork cases (the «GLM 1%→2%» class, under-represented). Rules-as-tests applied
  to the judge itself: no mechanism is trusted by argument, only by its score.

## §6 Reviewer half — ESCALATED grammar + severity contract

- **Recorded-premise test (discrimination rule):** the reviewer may stand only on RECORDED
  premises. Premise in a ratified artifact → cite file:line, normal finding
  (BLOCKER/MAJOR/MINOR). Premise unrecorded (payoff, priority, worth-building) → finding
  class **`ESCALATED`**: routed to the concept holder (advisor; operator if floored),
  never priced by the reviewer. Fixes the TD-M3 class — both live incidents.
- **Severity contract:** only a finding with a concrete failure scenario / goal-impact
  statement may spawn a re-review round; everything else = notes lane (fixed same-round or
  recorded — never a new round; an open note never moves the SHA). Discriminator =
  scenario presence, NOT edit size and NOT the severity label (S4 round-7 caution: one
  «MINOR» was a real hole with a scenario — grade honestly, not «MINOR=noise»).
- **Materiality dispute:** either side files a one-line ask (`class: materiality-dispute`);
  advisor verdict `MATERIAL | IMMATERIAL | OUT-OF-CONCEPT | FLOOR` + one-line rationale,
  judged ONLY against ratified artifacts; final for the round; disagreement → operator
  fork. Recorded in the ask file + decisions.md.
- **Landing surfaces:** [reviewer-discipline.md](../../../.claude/rules/reviewer-discipline.md)
  (contract SSOT — new §, carrying the severity contract + notes lane + zero-finding
  legitimacy), arch/SKILL.md §2 dispatch-prompt grammar line,
  [agents/fidelity-auditor.md](../../../agents/fidelity-auditor.md) findings format
  (gains the `Failure-scenario:` requirement — closing the precise hole at
  `fidelity-auditor.md:82` + `arch/SKILL.md:87`, grade+file:line only), the operator's
  global `/reviewer` (agent-uncommittable — operator applies by hand, jq-handoff style).
  Spec-changelog disposition vocabulary gains `ESCALATED` beside ACCEPTED/DISSOLVED.
- **Self-application:** this spec's own §2 cold reviews run WITH the escalation rung — a
  value-premise finding in those reviews escalates instead of being priced. The design's
  review is the pattern's first consumer.

## §7 Operator premises (ratified in-dialogue — verbatim-faithful register)

1. Two-angles axis: advisor judges CONCEPT; reviewer judges IMPLEMENTATION QUALITY;
   recorded-premise test discriminates (§6).
2. Severity contract — scenario presence, not edit size (§6).
3. Materiality-dispute procedure — one line, four verdicts, final for the round (§6).
4. Proportionality rule — a probe demand prices what-breaks-if-wrong; reversible → build
   now, verify in practice (§5.3 L1).
5. Token economy — standing seat, zero idle burn (§3). Falsifier attached.
6. One advisor only; dispatcher = execution owner; reviewers = powerless checkpoints;
   cost = artifact, not a session (§3, §9 D-AP2).
7. Cost = effort against goal progress; the four tests; «боевые практики» practice-first
   default (§5.3). Spend dormant under subscription (§5.2).
8. The live severity axis = operator-internal vs consumer-shipped; everything ships
   eventually — the operator repo is the first consumer of its own delivery (§1, §5.2).
9. AI judges substance; mechanisms verify that judgment happened and left a trace —
   theatre came from missing premise/permission/trace, not from inability to judge (§5.3).

## §8 Work list (landing obligations)

1. This spec: self-review → two cold two-altitude reviews (unique outputs
   `top-down-advisor-pattern.md` / `bottom-up-advisor-pattern.md`, GO|REVISE|STOP,
   ESCALATED rung available, cap 2 rounds) → operator gate.
2. Ratified-doc edits (single landing PR, zero `packages/` code): v2 §7 five-verb table;
   v2 `:278-279` stale-clause fix + §9 claim-1 scope fix + §14c disposition table entry;
   ADR Part-2/D5 supersession pointer; dispatcher §3 intent-row Day/Night cells («file ask
   + ASK when advisor reachable»); night-mode items 1+8 same conditional; arch §4
   review-ESCALATED intake line; morning-report «night-decided asks» line; v2 §9
   degradation rows (§4).
3. [reviewer-discipline.md](../../../.claude/rules/reviewer-discipline.md) new § (§6
   surfaces) + fidelity-auditor findings-format edit.
4. NEW rule `.claude/rules/effort-worthiness.md` (Class C; §5.3 content; consumer-generic
   wording) + skill-embed lines at the four choreography owners (dispatcher, night-mode,
   arch, reviewer protocol). Rule-index regen; check the 4096-byte budget first
   (precedent: seat-lifecycle landing).
5. **Prior-art pass BEFORE landing item 4** (T11/T12): context7 ≥3 phrasings + WebSearch —
   Conventional Comments (severity-labeled review comments), Google eng-practices review
   guidelines (non-blocking nits), Bezos type-1/type-2 reversibility, CBR indexing
   problem, WIP limits / kanban budgets. Fold findings into the rule; add SSOT entries as
   verdicts warrant.
6. Ask-file schema validity check (mechanizable half; earliest reachable channel).
7. Budget-tripwire mechanism lands with item 2; numbers deferred to calibration from audit
   chip `task_c8cfb806` rates.
8. **Triage-kernel-v2 contour kickoff** (dedicated; corpus assembly per §5.4 — operator GO
   starts it; this spec does not block on it).
9. Consumer-delivery stage for the shipped halves (rule + reviewer grammar + skills), own
   review (per F10/F4b precedent) — after operator-side dogfood.
10. P6-matrix probe run (§4) — post-spec, never a blocker.
11. `/self-reflection` at landing (discipline change).

## §9 Decision records (H1 — each with falsifier)

- **D-AP1 — one advisor, not role-specific advisors.** Grounds: both live mispricing
  incidents were missing-value-premise failures, not missing-domain-expertise; N standing
  contexts violate the token-economy premise; router-to-advisors is new machinery.
  *Falsifier:* live consult log shows the residue reaching the advisor is mostly
  domain-technical (methodology, not intent) → reopen role split.
- **D-AP2 — cost knowledge = yardstick + predicted-effort journal entries; no price-sheet /
  measurement job / fourth seat now.** Grounds: single measured table (2026-07-31) with an
  honest cache caveat; subscription billing makes marginal money ≈ 0; a cost seat without
  the concept premise re-creates TD-M3. *Falsifier:* morning comparisons show systematic
  mispricing → build the price-sheet from the accumulated entries (artifact-before-seat).
- **D-AP3 — effort axis is AI-decided; floor unchanged (v3 §6 by pointer).** Grounds:
  operator intent «AI itself decides dig-further / worth-fixing / good-enough»; the floor
  cut is object-based and already ratified. *Falsifier:* a live ledger shows an
  object-classification genuinely ambiguous at 3am beyond the «ambiguous → floor» tie rule
  → re-cut at the operator fork.
- **D-AP4 — precedent layer demoted to record-only.** Grounds: CBR indexing problem;
  operator critique (surface twins, structural strangers). *Falsifier:* kernel-v2 corpus
  evaluation shows precedent retrieval scoring above the v1 baseline → promote with its
  measured recall/precision attached.
- **D-AP5 — kernel split: safe v1 now, corpus-driven v2 contour next (operator-ratified
  fork, option A).** Grounds: v1 misclassification degrades to latency, not correctness;
  the labeled corpus already exists; quality via measurement, not another intuition round.
  Self-application: this fork is the four-test card's first live use. *Falsifier:* v1
  under-grading found leaking material defects past morning review before v2 lands →
  tighten v1 (mandatory ASK on every re-round, not only budget-tripped ones) and
  accelerate v2.
- **D-AP6 — budget tripwire = forced ASK, not hard cap.** Grounds: audit #1369 — #1311
  R3-R5 all material; rework churn 5/6 material (cold re-rounds after rework pay).
  *Falsifier:* tripwire fires often while the advisor rubber-stamps «continue» → budgets
  mis-set or the card does not filter; only then consider the devil's-advocate layer.
- **D-AP7 — approach A (ratify Part II + extension in one spec).** Grounds: §1. *Falsifier:*
  operator flips at spec gate → narrow slice B.

## §10 Do NOT re-open (ratified here or upstream)

v3 §6 object cut · v2 §14/§14b + v3 §13/§13b dispositions · three-role registry ·
one-advisor-only (D-AP1 falsifier is the only door) · ask-files-as-mailbox · container
workers have no bus edge · reviewer read-only posture · «advisor = latency change, not
authority change» · practice-first default (falsifier §5.2/§9 only) · kernel v1/v2 split
(D-AP5 falsifier is the only door).
