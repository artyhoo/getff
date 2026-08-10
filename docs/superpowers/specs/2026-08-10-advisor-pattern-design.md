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

Satisfied by the standing probe corpus, **recorded here as the repo-side record** (r1 BU
MAJOR-2: results previously lived only in session memory and PR bodies):

- **P1 idle-wake — POSITIVE** (2026-08-09): an operator-created idle ccd app session woke
  on `send_message` with no human click and wrote the instructed marker file within ≤60s.
- **P4 cwd join — POSITIVE** (2026-08-09): for both sampled sessions `cwd` ==
  `worktreePath` == the on-disk worktree path; the published `branch` was stale in one
  sample (mid-session rename) → addressing matches on `cwd` ONLY.
- **F4a/F4b CLI birth — POSITIVE, both recipes** (2026-08-09, sandboxes
  `scratchpad/f4a-probe` / `f4b-probe`, zero repo edits): a `claude -p` successor executed
  a baton task end-to-end; a Stop hook fired in headless `-p` mode and spawned a
  backgrounded successor; a flag-file debounce bounded the chain at generation 1.
  CLI-born sessions are ccd-deaf (absent from `list_sessions`).
- **P6 native cross-session messaging — feature VERIFIED working by the operator**
  (2026-08-10, post app-restart; native CC ≥2.1.224 SendMessage/ListAgents — CLI-side
  tool names per the CC changelog, not this repo's harness inventory); the fine-grained
  matrix (idle-wake parity, night classifier, app↔CLI reach) is pending — §8 item 10.

Plus SSOT
[prior-art-evaluations.md#201](../../meta-factory/prior-art-evaluations.md) (Anthropic
Advisor tool, ADAPT: night-mode delta item 7 is the in-repo precedent; our delta = standing
cross-session seat instead of per-consult subagent). The NEW effort-worthiness rule (§5.3)
carries its own prior-art obligation before landing — §8 item 5.

## §1 Frame

**Approach A (operator-ratified):** this ONE spec ratifies v2 Part II in full
(PARKED/REBIND/NUDGE + §6 addressing + §9 kill-switch) AND adds the advisor extension.
Grounds: all entry probes positive (§0.5 record); ASK/ANSWERED depend on v2 §6/§9 anyway;
the two stale-in-place v2 clauses (`session-bus-v2.md:276-279` «recipes ONLY … conditional
on F4 staying negative»; §9 claim-1 scope) are fixed in the same landing PR; the ADR
Part-2/D5 supersession pointer lands once.

**Consumer trajectory (operator premise, this session):** everything here ships to consumer
projects eventually — pipeline, skills, advisor. The design therefore hardcodes no
operator-only assumptions **as an obligation, not a current fact** (r2 MAJOR-2 — the r1
wording overclaimed): today the coordination-dir default segment is a plain operator-repo
literal (`scripts/link-coordination.sh:74`, shipped byte-copied by `install.sh` and
`setup.d/85-worktree-scripts.sh`; zero render sites exist). Parameterising that segment
per consumer project is billed to the §8 item 9 consumer-delivery stage. The advisor
identity is a role (not a person or hostname), and the effort-worthiness rule is
authored consumer-generic (precedent: F10 resolved consumer-generic; F4b landing audience
DECIDED consumer-shipped). Operator-repo landing = first consumer + dogfood; consumer
delivery is a follow-up stage with its own review, never a silent copy.

## §2 Grammar + ask surface (v2 §7 extended — 5 verbs)

```text
AIF-BUS v1 PARKED   task=<task.id> ref=<relative-path>      (unchanged)
AIF-BUS v1 REBIND                                           (unchanged)
AIF-BUS v1 NUDGE    role=<sender-role> ref=<relative-path>  (unchanged)
AIF-BUS v1 ASK      role=<sender-role> ref=<relative-path>
AIF-BUS v1 ANSWERED ref=<relative-path>
```

The three `(unchanged)` rows are copied VERBATIM from ratified
[session-bus-v2 §7](2026-08-09-session-bus-v2.md) (r1 BU BLOCKER-1: the draft re-typed
them from memory and mis-transcribed all three — the landing PR edits v2 §7 by APPENDING
the two new rows, never re-typing the ratified ones).

- **ASK** — senders: local seats ONLY (dispatcher, pipeline, review contours via their
  dispatching session; reviewer agents stay read-only — the orchestrating session files the
  ask). Container workers NEVER send ASK: their channel stays aif park → dispatcher
  observes. Recipient v1 = advisor (arch). Pull-twin: advisor sweep of the asks dir.
  **An ASK is non-blocking for the asker** (r2 MINOR-5): it defers the forked item and
  proceeds with other in-scope work; if nothing else is in scope it ends its turn — never
  a spin-wait. «Работа не простаивает» = the pipeline keeps moving, not that the forked
  item itself proceeds unanswered.
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
- Laws 1/2 hold for the new pair in the **eventual** sense: an idle asker is reached by the
  ANSWERED doorbell or, failing that, by its next turn-start re-read — v2 §8's push-only
  limit applies; see §4 degradation rows (r1 TD MAJOR-5). Claim 2 (verb↔pull-twin) extends
  to 5 rows. Claim 1 is **re-scoped, not untouched** (r1 BU MAJOR-4; fix content in §8
  item 2): the ratified pattern (`AIF-BUS`/`AIF_BUS`/`session-bus`) is already RED on a
  doc-pointer comment ([end-of-turn-reminder.test.ts:1168](../../../packages/core/hooks/end-of-turn-reminder.test.ts)
  — a spec *filename* containing `session-bus-design`); the re-cut pattern greps the verb
  grammar (`AIF-BUS`/`AIF_BUS`) plus the mailbox path segment (`session-bus/`) under
  `packages/`, so machinery still trips the gate and doc pointers do not.

## §3 Advisor seat

- **Identity:** the existing `arch.json` role (v2 §6) — NOT a new role class; the registry
  stays three roles (v3 §2 TD-M4). Standing app session in a dedicated worktree; repo-root
  ineligible; addressed by `cwd` only (v2 §6 addressing rule; P4 supplied the evidence —
  published `branch` can be stale).
- **Three invariants:**
  1. **decisions.md entry BEFORE application** (v2 §4 shape) — before any `answer.ts`
     apply or ANSWERED send. Consequence: the advisor's state lives in artifacts, so a
     context-window handoff loses tone, not state.
  2. **ZERO new rights vs the operator floor** — v3 §6 object cut by pointer (floor
     dominates; ambiguous → floor; ceiling sentence as-is). Against the FLOOR the pattern
     is a pure latency change. **Below the floor it deliberately REDISTRIBUTES
     in-envelope decision rights** (r1 TD MAJOR-3 — recorded, not smuggled): the reviewer
     loses unilateral round-triggering (§6 severity contract) and the advisor gains
     final-for-the-round materiality verdicts (§6). That redistribution is this spec's
     content and carries its own falsifiers (§9).
  3. **Concept-level answers** — the advisor never implements. For aif parks the advisor
     applies via `answer.ts` (ratified v2 §4 path); for local asks THE ASKER applies.
- **Cost knowledge (Q1 resolved, §9 D-AP2):** no price-sheet, no measurement job, no fourth
  seat. Yardstick = goal-progress-per-effort (§5.3 card) + the measured
  [cold-seat-economy.md §3](../../../.claude/rules/cold-seat-economy.md) table where it
  applies. Every spend-sensitive verdict's decisions.md entry records **predicted effort →
  what it buys**; morning review compares against actuals. Systematic mispricing →
  consolidate a price-sheet artifact FIRST; a seat only if the artifact still fails
  (artifact-before-seat).
- **Continuity — role decoupled from session lifetime (operator amendment at gate,
  2026-08-10, dissolving r1 TD ESCALATED-1):** the advisor ROLE and its
  artifact-complete state (spec + decisions.md + open asks — guaranteed by invariant 1)
  are the essence; the session hosting it is an operational MODE with two legal
  instantiations: (a) **standing app session** — doorbell-reachable (P1), day-interactive
  default; (b) **fresh instantiation rebuilt from the artifacts** — always legal (fresh
  eyes are a bonus, per the operator: «спека, которую смотрят свежими глазами»),
  mandatory at every T_soft anyway (seat-lifecycle protocol as-is,
  [seat-lifecycle.md](../../../.claude/rules/seat-lifecycle.md); thresholds provisional —
  PARK-CDC-1). Mode choice is config, not design: switch to (b) when the standing seat's
  per-turn cost exceeds the fresh-inlined baseline (cold-seat-economy §3 row 4) or at any
  context-hygiene point. This contour is its own third live transfer of exactly that
  rebuild path.
  Night honesty: a CLI-born successor is ccd-deaf (F4a check (a)); until the P6-matrix
  passes, night degradation = defer-non-trivial or sweep-shot successor.
- **Token-economy premise (operator; AMENDED at gate — see Continuity above):** an idle
  app session burns zero between consults (doorbell transport), and the role's context is
  artifact-complete. The r1 falsifier (per-turn accumulated-context cost vs the
  85,855-token inlined-fresh baseline, [cold-seat-economy.md §3](../../../.claude/rules/cold-seat-economy.md)
  row 4 — r1 TD MAJOR-6) is retained as the **mode-switch trigger** between the two legal
  instantiations, no longer a design falsifier.

## §4 Transport + degradation

- Doorbell semantics transport-agnostic (v2 §7 sender algorithm unchanged). Send-time
  cascade: (1) native cross-session SendMessage IF capability present AND target
  discoverable via ListAgents (CLI-side tool names per the CC ≥2.1.224 changelog — NOT in
  this repo's current harness inventory; presence itself is a capability check) — until
  the P6-matrix passes, native counts as capability ABSENT; (2) else ccd `send_message` via cwd-match (v2 §6); (3) else nothing — the
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
  (= today); ASK lost → file waits; ANSWERED lost → asker re-reads at turn start;
  **asker idle when ANSWERED lands** → the doorbell is the only push (v2 §8 limit); if it
  misses, the answer waits until the asker's next wake/turn-start re-read — park latency,
  correctness intact (r1 TD MAJOR-5); native classifier-blocked at night → cascade to ccd;
  CLI-born successor → deaf until matrix.
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

- Floor = the v3 §6 object cut **by pointer, deliberately NOT restated here** — this
  spec's own r1 draft paraphrased the list and dropped two items (shared standing config;
  the independent floor axes — r1 BU MAJOR-1), which is exactly the drift a paraphrase
  invites. The complete cut lives at
  [autonomous-night-v3 §6](2026-08-09-autonomous-night-v3-design.md) and only there.
  Ambiguous → floor. Anti-smuggling: envelope widening is a v3 §6 edit = operator fork,
  never a recipe edit.
- **Spend (real quota/money beyond standing caps) STAYS a live floor item** — nothing is
  suspended (r1 TD MAJOR-2: «dormant» would itself be the envelope change the previous
  line forbids). Recorded operator observation, frequency not normativity: under
  subscription billing this item rarely fires; it fires for real on shared-capacity
  exhaustion (e.g. filling the aif queue for the night) and on any genuinely paid surface.
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
  on MORE rigor: a demand for a probe/experiment/extra round is itself a finding and must
  state **what breaks if wrong** AND **what learning-in-practice costs instead**
  (proportionality rule, both operative halves per the session-1 handoff §5.4). Reversible
  + cheap live verification → build now, verify in practice, falsifier recorded;
  research-grade contour reserved for irreversible / expensive / consumer-shipped surfaces.
- **L2 — precedent RECORDING (not reliance):** every verdict already lands in decisions.md;
  entries are precedent-shaped (question class, verdict, rationale). **Reliance on
  precedent matching is deliberately deferred to kernel v2** — surface similarity ≠
  structural similarity (the CBR indexing problem; operator critique ratified): «1% vs 2%»
  in a research report is immaterial, the same delta in a gate threshold is material.
  Recording is cheap and reversible; trusting analogy is the risky half.
- **L3 — mechanical skeleton, each check with a NAMED channel** (r1 TD MAJOR-1 + BU
  MAJOR-3 — an unbilled «channel 1» is `#hope-as-gate`): (a) `Failure-scenario:` required
  for any round-triggering finding — protocol-side in
  [agents/fidelity-auditor.md](../../../agents/fidelity-auditor.md) + arch §2 grammar, AND
  deterministically as an arm of the existing `pr-body-fidelity` check (§8 item 2b — the
  one permitted `packages/` edit; extends an existing check, no new capability, no
  claim-1 literal needed); (b) ask-file schema validity — a pre-push section OUTSIDE
  `packages/` (claim-1 channel constraint, v2 §9); (c) decisions.md-before-application —
  the same pre-push section as (b) adds the cross-check `status: answered` ⇒ answer block
  complete AND a decisions.md entry reference present in it (r2 MINOR-6 — this moves the
  detectable half to channel 1; the residual «entry content is honest» half stays with
  morning review, which is decision AUTHORITY, not the detection layer); (d) L0 label
  presence — kickoff principle-test family (principle 12 pattern; billed as §8 item 6b;
  its own prior-art trailer if a new file is needed). An empty field is caught mechanically; a *fabricated* field is channel-2
  territory — disputable via `materiality-dispute`, visible at morning review.
- **L4 — budget tripwire (escalation trigger; honest channel split, r2 MINOR-3):** a
  stage exceeding its budget → **forced ASK to the advisor before continuing** — an
  escalation, never a guillotine (the audit measured #1311 R3-R5 all material: a hard cap
  would have shipped defects). The **rounds** half is channel 1 (round numbers are visible
  in the PR-body review record — countable by the same protocol that gates
  `Failure-scenario:`); the **token** half has NO measurement surface today and is
  deferred until one exists — the tripwire triggers on rounds only at v1. Budget numbers
  deliberately NOT set here — calibrated from the review-effort-theatre rates (audit chip
  `task_c8cfb806`) at landing; the mechanism is normative, the numbers are config.
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
  accepted ONLY by measured performance on a labeled corpus: the audit's ~104
  material/immaterial-labeled findings (PR #1290-#1365) + S4's under-graded round-7
  «MINORs» + both TD-M3 incidents + kickoff-revision loops, extended with research-fork
  cases (the «GLM 1%→2%» class, under-represented). **Honesty about the labels (r1 TD
  MAJOR-8):** they are single-classifier, calibration NONE, expected dispute rate ≥20%
  (the audit's own §11 confidence block) — **starting labels, not ground truth**; the v2
  contour's FIRST step is label adjudication (advisor/operator pass over disputed rows),
  and only the adjudicated corpus scores candidates. Rules-as-tests applied to the judge
  itself: no mechanism is trusted by argument, only by its score.

## §6 Reviewer half — ESCALATED grammar + severity contract

- **Recorded-premise test (discrimination rule):** the reviewer may stand only on RECORDED
  premises. Premise in a ratified artifact → cite file:line, normal finding
  (BLOCKER/MAJOR/MINOR). Premise unrecorded (payoff, priority, worth-building) → finding
  class **`ESCALATED`**: routed to the concept holder (advisor; operator if floored),
  never priced by the reviewer. Fixes the TD-M3 class — both live incidents.
- **Severity contract:** only a finding with a concrete failure scenario / goal-impact
  statement may spawn a re-review round; everything else = notes lane (fixed same-round or
  recorded — never a new round; an open note never moves the SHA). **The reviewer still
  initiates rounds** (operator-gate clarification): a scenario-bearing finding IS the
  trigger, needing nobody's permission — what is withdrawn is label-only triggering (a
  bare MAJOR with no scenario). Discriminator =
  scenario presence, NOT edit size and NOT the severity label (S4 round-7 caution: one
  «MINOR» was a real hole with a scenario — grade honestly, not «MINOR=noise»).
  **The same contract governs follow-up PRs** (r1 TD MAJOR-7 — the audit located the real
  immaterial cost in the follow-up-PR class, which had no protocol at all): a follow-up PR
  may be spawned only for a finding carrying a `Failure-scenario:`; scenario-less residue
  stays in the notes lane, no PR (audit §9.3 promotion-by-ASK). Channel map, explicit:
  re-review rounds ← L3 gate · follow-up PRs ← this clause · the Audited-SHA treadmill ←
  [cold-seat-economy.md §1](../../../.claude/rules/cold-seat-economy.md) (already
  ratified) · finding-list padding ← zero-finding legitimacy + notes lane.
- **Materiality dispute:** either side raises it; advisor verdict
  `MATERIAL | IMMATERIAL | OUT-OF-CONCEPT | FLOOR` + one-line rationale, judged ONLY
  against ratified artifacts; final for the round; disagreement → operator fork. Recorded
  in the ask file + decisions.md. **Filing mechanics (r1 TD MAJOR-4 — the filing channel
  must not be owned by a disputant):** a read-only reviewer marks the finding `DISPUTED`
  with a verbatim dispute block in its own report; the orchestrating session MUST
  transcribe that block into an ask file (`class: materiality-dispute`) as a **verbatim
  copy, never a paraphrase**, before the round may close — the round record contains both
  the report and the asks dir, so suppression or rewording is detectable by diff.
- **Landing surfaces:** [reviewer-discipline.md](../../../.claude/rules/reviewer-discipline.md)
  (contract SSOT — new §, carrying the severity contract + notes lane + zero-finding
  legitimacy), arch/SKILL.md §2 dispatch-prompt grammar line,
  [agents/fidelity-auditor.md](../../../agents/fidelity-auditor.md) findings format
  (gains the `Failure-scenario:` requirement — closing the precise hole at
  `fidelity-auditor.md:82` + `arch/SKILL.md:87`, grade+file:line only), the operator's
  global `/reviewer` (agent-uncommittable — operator applies by hand, jq-handoff style).
  Spec-changelog disposition vocabulary gains `ESCALATED` beside ACCEPTED/DISSOLVED.
  Namespace note (r1 TD MINOR): the finding grade `ESCALATED` is review-verdict
  vocabulary; the identically-spelled task-status in orchestrator-prompt state legends is
  a different namespace and is not renamed.
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
5. Token economy — AMENDED at the operator gate (2026-08-10): the role's context lives in
   artifacts, so seat lifetime is an operational MODE (§3 Continuity) — standing session
   for doorbell latency, fresh-from-artifacts whenever cheaper or cleaner; «fresh eyes» is
   a bonus, not a failure mode. Supersedes the standing-only reading.
6. One advisor only; dispatcher = execution owner; reviewers = powerless checkpoints;
   cost = artifact, not a session (§3, §9 D-AP2).
7. Cost = effort against goal progress; the four tests; «боевые практики» practice-first
   default (§5.3). Spend stays a LIVE floor item that rarely fires under subscription
   billing — a frequency observation, not a dormancy (§5.2; r2 MAJOR-1 sync).
8. The live severity axis = operator-internal vs consumer-shipped; everything ships
   eventually — the operator repo is the first consumer of its own delivery (§1, §5.2).
9. AI judges substance; mechanisms verify that judgment happened and left a trace —
   theatre came from missing premise/permission/trace, not from inability to judge (§5.3).
10. **The idea must survive its author-session** (operator, at gate): today the idea's
    carrier is the authoring /arch session, which dies — the advisor must know the idea
    EXACTLY, with no broken-telephone effect. Mechanism: verbatim-faithful premise
    register + transfer by copy-or-pointer, never paraphrase (§2 append-only verbs, §5.2
    pointer-only floor, §6 verbatim dispute transcription). In-contour proof: the r1 BU
    BLOCKER — three protocol rows re-typed from memory, all three corrupted in one hop.
11. **Layer hierarchy** (operator, at gate): essence/idea → design → architecture → plan →
    implementation are DIFFERENT things with different importance and revision authority.
    Conflicts resolve upward (a lower layer bends to a higher one, never the reverse); a
    deviation's materiality scales with the HIGHEST layer it touches («1% vs 2%» in an
    implementation report ≈ nothing; the same words in the idea layer = floor); the idea
    layer is operator-owned (README Ownership Contract), implementation is freely mutable
    under the layers above. This hierarchy is the yardstick behind L1's «does it move us
    toward the goal» and behind the advisor's `OUT-OF-CONCEPT` verdict.

## §8 Work list (landing obligations)

1. This spec: self-review → two cold two-altitude reviews (unique outputs
   `top-down-advisor-pattern.md` / `bottom-up-advisor-pattern.md`, GO|REVISE|STOP,
   ESCALATED rung available, cap 2 rounds) → operator gate.
2. Ratified-doc edits (single landing PR): v2 §7 five-verb table (append-only — the three
   ratified rows are never re-typed); v2 `:276-279` stale-clause fix + §9 claim-1 re-scope
   (new pattern: `AIF-BUS`/`AIF_BUS` verbs + `session-bus/` path segment under
   `packages/`; doc-pointer filenames no longer match — §2) + §14c disposition table
   entry; ADR Part-2/D5 supersession pointer; dispatcher §3 intent-row Day/Night cells
   («file ask + ASK when advisor reachable»); night-mode items 1+8 same conditional; arch
   §4 review-ESCALATED intake line; **arch §1 spec-template obligation — every spec
   carries an operator-premise register + per-decision falsifiers** (operator-gate
   addition: idea-recording as a standing rule — the layer the recorded-premise test
   stands on; spec ≠ recorded idea, both required); morning-report «night-decided asks»
   line; v2 §9
   degradation rows (§4). The branch merges staging forward first so the cited
   review-effort-theatre patch exists on-branch (r1 MINOR both seats: `lychee.toml`
   excludes `docs/superpowers/`, so the broken citation is currently caught by nothing —
   the merge-forward closes it; widening lychee scope is noted for the landing PR as a
   separate small item).
   **2b — the ONE permitted `packages/` edit:** the `Failure-scenario:` deterministic arm
   extends the existing `pr-body-fidelity` check (r1 TD MAJOR-1/BU MAJOR-3 resolution).
   «Zero `packages/` code» is amended to «zero NEW capability code»: this is an
   existing-check extension (no new dependency, no new directory, no claim-1 literal),
   with its own `Prior-art:` trailer at commit time.
3. [reviewer-discipline.md](../../../.claude/rules/reviewer-discipline.md) new § (§6
   surfaces) + fidelity-auditor findings-format edit.
4. NEW rule `.claude/rules/effort-worthiness.md` (Class C; §5.3 content; consumer-generic
   wording) + skill-embed lines at the four choreography owners (dispatcher, night-mode,
   arch, reviewer protocol). Rule-index regen — **free bytes FIRST**: the index sits at
   4092/4096 (4 bytes free), so trimming is a precondition, not a check (r1 MINOR both
   seats; v3 landing-precedent wording).
5. **Prior-art pass BEFORE landing item 4** (T11/T12): context7 ≥3 phrasings + WebSearch —
   Conventional Comments (severity-labeled review comments), Google eng-practices review
   guidelines (non-blocking nits), Bezos type-1/type-2 reversibility, CBR indexing
   problem, WIP limits / kanban budgets, and the layered-spec-document family
   (operator-gate addition): ADR, GitHub spec-kit SDD (`constitution → specify → plan →
   tasks` — the constitution is a first-class idea layer), AWS Kiro EARS
   (`requirements / design / tasks`). Fold findings into the rule; add SSOT entries as
   verdicts warrant.
   **Pre-verified at the session-3 gate (2026-08-10) — the operator's newly-enabled
   `engineering` plugin (Anthropic, v1.2.0, Cowork-primary; skill bodies read in-session
   from the served plugin dir):** its `/architecture` ADR template + `documentation` +
   `system-design` skills are the family's closest live in-harness analog. Convergent
   (verbatim quotes, per premise 10): ADR status vocabulary «Proposed | Accepted |
   Deprecated | Superseded» ≈ this contour's supersession pointers; ADR Consequences
   bullet «What we'll need to revisit» ≈ the SSOT `Trigger to revisit` field
   (falsifier-lite); documentation principle «Link, don't duplicate — Reference other
   docs instead of copying» ≈ premise 10's pointer half; system-design output demands
   «explicit assumptions» (premise-register, weaker form — assumptions are not ratified
   verbatim premises). NOT contributed: no layer hierarchy (premise 11), no verbatim
   premise register, no per-decision falsifiers — the free-prose ADR `Context` section is
   exactly the paraphrase surface premise 10 counters. Verdict: cite as prior-art in the
   rule's block; the §8 arch-template obligation (premise register + falsifiers) stands
   UNCHANGED.
6. Ask-file schema validity check (mechanizable half; earliest reachable channel) — the
   pre-push section per §5.3 L3(b)+(c), including the answered⇒decisions-entry cross-check.
   **6b:** L0 rigor-label presence check (kickoff principle-test family, §5.3 L3(d)).
7. Budget-tripwire mechanism lands with item 2; numbers deferred to calibration from audit
   chip `task_c8cfb806` rates.
8. **Triage-kernel-v2 contour kickoff** (dedicated; corpus assembly + label adjudication
   per §5.4) — **operator GO given at the gate: starts immediately after this spec lands**
   (§11c ESCALATED-2 resolution); this spec does not block on its results.
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
- **D-AP8 — practice-first default (operator premise 7).** Grounds: §0 over-rigor
  complaint; audit-measured theatre channels. *Falsifier:* a practice-verified defect
  escapes to a consumer-shipped / irreversible surface that a cheap pre-verification would
  have caught → move the research-grade boundary (L0), not the default itself.

## §10 Do NOT re-open (ratified here or upstream)

v3 §6 object cut · v2 §14/§14b + v3 §13/§13b dispositions · three-role registry ·
one-advisor-only (D-AP1 falsifier is the only door) · ask-files-as-mailbox · container
workers have no bus edge · reviewer read-only posture · «zero new rights vs the operator
floor; recorded redistribution below it» (§3 invariant 2 wording — r1 TD MAJOR-3 replaced
the earlier latency slogan) · practice-first default (D-AP8 falsifier is the only door) ·
kernel v1/v2 split (D-AP5 falsifier is the only door).

## §11 Round-1 disposition changelog (both cold seats; cap 2)

Reports: `top-down-advisor-pattern.md` (REVISE — 8 MAJOR / 6 MINOR / 2 ESCALATED),
`bottom-up-advisor-pattern.md` (STOP — 1 BLOCKER / 4 MAJOR / 5 MINOR). Dispositions:

- BU BLOCKER-1 (verb table mis-transcribed) — **FIXED** (§2, verbatim copy + append-only
  landing rule). TD M1/BU M3 (L3 channels unbilled, homes closed) — **FIXED** (§5.3 L3
  named channels; §8 item 2b amends «zero packages/» to «zero NEW capability code»).
  TD M2 (spend dormancy = envelope edit) — **FIXED** (§5.2: live item, frequency note;
  quota restored). TD M3 (latency claim false) — **FIXED** (§3 inv. 2 + §10 reworded:
  redistribution recorded). TD M4 (dispute filing owned by disputant) — **FIXED** (§6
  verbatim-transcription obligation, diff-detectable). TD M5 (idle asker) — **FIXED**
  (§2 eventual-sense wording + §4 row). TD M6 (token premise vs measured resume cost) —
  **FIXED** (§3 falsifier extended to per-turn re-submission cost). TD M7 (4% channel) —
  **FIXED** (§6 follow-up-PR clause + channel map). TD M8/BU (corpus not ground truth) —
  **FIXED** (§5.4 label-adjudication first step). BU M1 (floor paraphrase dropped items)
  — **FIXED** (§5.2 pointer-only, no restatement). BU M2 (probe results unrecorded) —
  **FIXED** (§0.5 repo-side record). BU M4 (claim-1 contradiction + already-RED) —
  **FIXED** (§2 + §8 item 2 re-scope content). MINORs: `:276-279` range, rule-index
  precondition wording, lychee/merge-forward, consumer-default rendering note, ESCALATED
  namespace note, P4 attribution, proportionality halves, §10 falsifier pointer (now
  D-AP8) — all **FIXED** in place.
- TD ESCALATED-1 (standing-seat cost vs per-consult subagent) and ESCALATED-2 (target
  residual immaterial rate for kernel-v1 shippability) — **OPEN-FOR-OPERATOR** at the
  spec gate; neither priced by any seat (the rung working as designed, first live use).

### §11b Round-2 verification (cap reached)

`r2-verify-advisor-pattern.md`: REVISE — 0 BLOCKER / 2 MAJOR / 6 MINOR; all r1 FIXED
claims verified except the eight items below, repaired in this commit (author-side repair
at cap; any residual disagreement is an operator fork per arch §2): r2 M1 (§7 premise 7
still said «dormant» — synced); r2 M2 (§1 consumer-genericity overclaim — reworded to an
obligation billed to §8 item 9; `link-coordination.sh:74` literal named); MINORs:
`:1168` citation; ListAgents qualified at §4 with capability-check note (also closes r1
BU MINOR-3, omitted from §11's enumeration); L4 honest channel split (rounds-only at v1 —
token half has no measurement surface); L3(d)→§8 item 6b billing; asker non-blocking
wait semantics (§2); L3(c) answered⇒decisions-entry pre-push cross-check (detectable half
to channel 1, morning review = authority only).

### §11c Operator gate (2026-08-10) — ESCALATED resolutions + clarifications

- **ESCALATED-1 → DISSOLVED by operator reasoning:** the standing-vs-per-consult cost
  question dissolves once role is decoupled from session lifetime (§3 Continuity
  amendment; §7 premise 5 amended) — both instantiations legal, the r1 cost falsifier
  becomes the mode-switch trigger. Operator's own formulation: the state lives in the
  artifacts; a fresh session reading them IS the advisor, fresh eyes included.
- **ESCALATED-2 → RESOLVED by operator: NO numeric target for kernel-v1 residual
  theatre.** The kernel-v2 contour starts immediately after this spec lands (§8 item 8
  priority raised accordingly); its adjudicated corpus produces the baseline any
  candidate must beat. D-AP5's falsifier guards the dangerous direction meanwhile.
- Severity-contract clarification recorded in §6: the reviewer still initiates rounds via
  scenario-bearing findings; only label-only triggering is withdrawn.

### §11d Session-3 gate session (2026-08-10) — doc-plugin format comparison

The operator deferred the gate word to a session with their «engineer» doc-writing plugin
enabled (abbreviation half-remembered as ~ASD/SDD). Identified: the Anthropic `engineering`
plugin v1.2.0 — the half-remembered abbreviation resolves to its `/architecture` **ADR**
template + `system-design` (system-design-doc) skill. Document conventions compared against
§7 premises 10-11 + the §8 item 5 layered-spec family; verdict folded into §8 item 5
(convergent on supersession vocabulary, revisit-triggers, link-don't-duplicate; contributes
no layer hierarchy, no verbatim premise register, no per-decision falsifiers → no premise
or template change). Gate word: pending at this commit.
