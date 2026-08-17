# Reviewer discipline — discipline rule

<!-- channel: agent agents/reviewer-discipline.md#reviewer-discipline -->

> **Class:** C — prose-only, no current compensating mechanism (reclassed from B per Track 3 §3.3, commit 4d52a72). Promotion criterion in §4.
> **Fires:** review sessions (`/review`, `/ultrareview`, or a prose "проверь"/verdict ask).
> **Authoritative for:** reviewer-discipline rule — §1 reviewer/orchestrator role separation, §2 surface-as-decision-needed pattern, §3 anti-patterns (`#role-swap-mid-session`, `#strategy-decided-by-reviewer`), §4 promotion / retirement triggers, §5 classification, §6 severity contract + ESCALATED grammar, §6.1 the deployed three-axis triage rubric + its per-axis measurement provenance, §6.2 the calibrated L4 round-budget config + its derivation and provenance label.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Companion to orchestrator skill — global skill at `~/.claude/skills/reviewer/SKILL.md` may reference this rule but is not required for the rule to apply (project rule is self-contained).

> **Origin:** Incident 2026-05-07. Reviewer session (post-`/review`) made a project-strategy decision («is architecture.md §2.3 a v2 future spec or v1 active requirement?») mid-session instead of surfacing it as decision-needed. The strategic call should have come from the orchestrator track. Codified in repo following the post-Wave-9 memory-to-docs codification audit ([docs/meta-factory/research-patches/2026-05-13-memory-to-docs-codification-audit.md](../../docs/meta-factory/research-patches/2026-05-13-memory-to-docs-codification-audit.md)).

## §1 The discipline

When acting as reviewer (after `/review`, `/ultrareview`, or any explicit «проверь / verdict / second opinion» request), do NOT cross into orchestrator-role decisions mid-session.

Specifically: if a review finding requires choosing project strategy (e.g. «is this v2 future spec or v1 active requirement?», «should we adopt approach A or B?»), surface it as **decision-needed** with both legitimate options described, and let the maintainer either confirm explicitly or start a separate `/orchestrator` session.

The reviewer can describe what each path implies; **the reviewer cannot pick between them.**

**CTX Stage 1 alt-channel note:** this rule's run-moment protocol is condensed in [`agents/reviewer-discipline.md`](../../agents/reviewer-discipline.md) — a review session should read it at review time. A prose `проверь`/review ask that bypasses this agent protocol entirely is accepted partial coverage (not gated) and counts against the [§4](reviewer-discipline.md) incident counter if a role-swap results.

## §2 Surface-as-decision-needed pattern

When a reviewer finding requires a «which way should the project go?» answer:

1. **Name the decision explicitly** as «DECISION-NEEDED: <one-line summary>».
2. **Describe both options' downstream consequences** without endorsing either. Use «Option A → consequence X» / «Option B → consequence Y» format.
3. **Flag that the answer needs maintainer or `/orchestrator` session**, not the reviewer.
4. **Stop.** Do not infer the maintainer's likely answer and proceed.

This preserves the reviewer's independence as a falsification check. A reviewer who picks strategy becomes a second orchestrator — losing the independent-verification property.

## §3 Anti-patterns

- **`#role-swap-mid-session`** — reviewer session, prompted with `/review` or similar, makes orchestrator-track decisions instead of surfacing them. Most likely when a finding feels «obvious» and the reviewer infers the answer rather than naming the choice.
- **`#strategy-decided-by-reviewer`** — variant; reviewer concludes «X is the answer» and writes that as a verdict instead of «X or Y, both legitimate, maintainer decides».
- **`#reviewer-as-secondary-orchestrator`** — pattern across multiple sessions where reviewer's strategic calls become precedent and subsequent sessions normalize scope creep.

## §4 Promotion / retirement

- **Promotion to principle test:** if 3 cross-session role-swap incidents occur within 6 months, add `packages/core/principles/12-reviewer-discipline.test.ts` — mechanical check on reviewer-session output for strategy-imperative phrases («we should», «I recommend the project», «the decision is»). Detection requires sub-agent integration (active session reads own output before posting verdict).
- **Retirement:** if no role-swap incident occurs for 12 consecutive months AND companion principle test (if promoted) reports zero violations across the same window, archive to prose in CLAUDE.md.

## §5 Classification — Class C (no current mechanism)

**Class:** C — prose-only, mechanism deferred. No compensating mechanism currently in place; the rule is enforced solely by maintainer / reviewer awareness at session time. Promotion to mechanically-tested (Class A) is gated on the existing §4 incident-threshold criterion: 3+ role-swap incidents within 6 months.

**Why Class C and not Class B (compensating mechanism):**

Track 3 condensed prose-rules audit ([research-patches/2026-05-16-prose-rules-audit-research.md §3.3](../../docs/meta-factory/research-patches/2026-05-16-prose-rules-audit-research.md)) probed the 1A draft claim that `agents/compliance-verifier.md` served as the AI-agnostic compensating mechanism for this rule. The probe found compliance-verifier.md is empirically scoped to PR description §1.7 substance review — Forward/Backward citation integrity and sweep completeness — **not** to reviewer role-swap detection or strategy-imperative phrase checking. Pattern: T16 «pattern-matching-on-name» from [ai-laziness-traps.md §2](ai-laziness-traps.md) — «compliance verifier» sounds catch-all but is narrowly scoped.

**Path forward when promotion criterion fires:** C-revise-1 — design a new `agents/reviewer-discipline-verifier.md` AI-agnostic sub-agent prompt scoped specifically to reviewer-session role-swap detection (active session reads own output before posting final verdict; checks for strategy-imperative phrases). Effort estimate: 1-2 hours design + bench test on ≥3 fabricated role-swap cases. Not pre-built — promote on incident evidence, not anticipation.

**Recursive self-application note:** this rule is currently one of two Class C rules in the project (the other: [parallel-subwave-isolation.md](parallel-subwave-isolation.md), confirmed Class C in [Track 3 §3.5](../../docs/meta-factory/research-patches/2026-05-16-prose-rules-audit-research.md)). The README invariant «every rule = executable artifact» absolutism vs Class C practice tension is surfaced in [research-patches/2026-05-16-readme-absolutism-vs-class-c-practice.md](../../docs/meta-factory/research-patches/2026-05-16-readme-absolutism-vs-class-c-practice.md) — maintainer-owned resolution pending.

## §6 Severity contract + ESCALATED grammar (advisor-pattern, 2026-08-10)

Transferred from [advisor-pattern-design §6](../../docs/superpowers/specs/2026-08-10-advisor-pattern-design.md) (authoritative for rationale + falsifiers; this § is the operating SSOT for review protocols):

- **Recorded-premise test:** the reviewer may stand only on RECORDED premises. Premise in a ratified artifact → cite file:line, normal finding (BLOCKER/MAJOR/MINOR). Premise unrecorded (payoff, priority, worth-building) → finding class **`ESCALATED`**: routed to the concept holder (advisor seat; operator if floored), never priced by the reviewer.
- **Severity contract:** only a finding with a concrete failure scenario / goal-impact statement (a `Failure-scenario:` line) may spawn a re-review round; everything else = notes lane (fixed same-round or recorded — never a new round; an open note never moves the audited SHA). **The reviewer still initiates rounds:** a scenario-bearing finding IS the trigger — what is withdrawn is label-only triggering. Discriminator = scenario presence, NOT edit size and NOT the severity label (a real hole can wear a «MINOR» label — grade honestly). **The same contract governs follow-up PRs:** spawned only for a `Failure-scenario:`-bearing finding; scenario-less residue stays in the notes lane, no PR.
- **Zero-finding reviews are a legitimate outcome** — the reviewer's KPI is goal-shift, not findings-produced.
<!-- effort-worthiness embed (spec-of: .claude/rules/effort-worthiness.md) -->
- **Effort-worthiness companion** ([effort-worthiness.md](effort-worthiness.md)): the four-test card + practice-first default that this contract's severity discriminator serves; zero-finding reviews are legitimate (KPI = goal-shift, not findings-produced).
- **Materiality dispute:** either side raises it; advisor verdict `MATERIAL | IMMATERIAL | OUT-OF-CONCEPT | FLOOR` + one-line rationale, judged ONLY against ratified artifacts; final for the round; disagreement → operator fork. A read-only reviewer marks the finding `DISPUTED` with a verbatim dispute block in its own report; the orchestrating session transcribes that block into an ask file (`class: materiality-dispute`) as a **verbatim copy, never a paraphrase**, before the round may close.

### §6.1 Triage rubric — three axes, per-axis provenance (triage-kernel-v2 S5, 2026-08-17)

The text below is **quoted verbatim** from the frozen bench prompt
[`docs/meta-factory/triage-corpus/s2-rubric-whose.md`](../../docs/meta-factory/triage-corpus/s2-rubric-whose.md) — the exact wording the S4 bench measured. **Do not reword it.** A reworded question was never measured, so any rewrite voids the provenance labels below and demotes the rewritten axis to `judgment-only` until a re-bench. Exactly three lines of the bench prompt are deliberately **not** carried over, both omissions being bench-harness scaffolding rather than rubric substance: its framing line («*Decide three axes from the text alone*»), because a live seat judges with the diff in hand — that gap IS the construct-transfer limit recorded below; and its one-line answer contract (`class=… layer=… whose=…`), because live review output follows the §6 verdict grammar above. Everything else is quoted line-for-line.

```text
Binding yardstick: a finding is MATERIAL if and only if fixing it changed behaviour or a decision,
or NOT fixing it would have cost something toward the project goal ("AI agents can't silently
bypass undocumented conventions"). IMMATERIAL = cosmetic or numeric nit with zero downstream
effect. That a finding was fixed does not make it material.

Apply these questions before answering:
1. Does acting on this move the work toward the goal, or only satisfy a form?
2. Is it theatre - the shape of diligence with no substance behind its target?
3. Is it immaterial - would no consumer and no decision notice the difference?
4. Materiality scales with the highest layer the finding touches (idea > design > architecture >
   plan > implementation); conflicts resolve upward.

layer = the highest layer the finding touches: idea | design | architecture | plan | implementation.
whose = does settling this require a premise, concept, or value ABOVE the reviewer's authority - a
concept the advisor owns (OUT-OF-CONCEPT -> advisor) or a value only the operator can set
(FLOOR -> operator-floor)? If neither, reviewer (the default - a reviewer can settle it without
escalation).
```

**Provenance per axis — read the label before you lean on the axis, and never upgrade one:**

- **layer** (question 4 + the `layer =` definition) — **`corpus-measured`**. S4 bench: C1 0.662 / C2 0.642 vs 0.530 majority bar, p=0.0012 / p=0.0076, n=151 ([2026-08-16-triage-kernel-v2-s4-bench.md](../../docs/meta-factory/research-patches/2026-08-16-triage-kernel-v2-s4-bench.md)). The bench number is the only validation this label rests on: the S4b outcome axis must **never** be cited as corroboration ([kickoff-s4b §8](../orchestrator-prompts/triage-kernel-v2/kickoff-s4b.md)) — high HOLDS is a property of the merged-PR population, not a grade.
- **class** (the yardstick + questions 1-3) — **measured null: «measured — does not pay».** The rubric's class verdict **does not replace grading**; **C0 — the `orig_grade` severity mapping — remains the class bar.** S4 bench on n=131: accuracy C0 0.733 · C1 0.687 · C2 0.710; MATERIAL-miss C0 0.319 · C1 0.351 · C2 0.266. Acceptance is two legs and both are required — C1 fails leg 1 (McNemar p=0.4514) and leg 2; C2 fails leg 1 (p=0.7608) and passes leg 2 — so **both candidates DOES-NOT-SHIP on class**. Use questions 1-3 as a thinking aid for stating *why* a finding is material; do not let them override the recorded grade.
- **whose** (the `whose =` definition) — **`judgment-only, not corpus-validated`.** 0.848 / 0.854 against a 0.901 majority bar on n=151. It travels with this label whatever it scores, and is never cited downstream as validated. It restates §6's existing ESCALATED routing (reviewer / advisor / operator-floor) — the label is the only change in its standing.
- **Validity limits travel with every number above** ([spec §5b](../../docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md)): provenance sharing (every labeler and every candidate is a Claude-family seat on the same yardstick — never quote these as model-independent truth); construct transfer (the bench judges decontextualized rows, so it measures the cheap-first triage screen, not the full in-diff task); the inverse population — defects never raised — is out of reach; power ±9pp at n≈120-151, so fine ranking between close candidates is out of scope; grade-leak residue (tokens stripped, prose synonyms not).

**Class + channel declaration** ([rule-enforcement-channel-selection.md §3 step 5](rule-enforcement-channel-selection.md)): Class C prose injection; channel = this rule plus the agent protocols that point at it. Per **D-K7** the winner ships as protocol text only — `promptfoo` stays operator-side and never enters CI ([no-paid-llm-in-ci.md](no-paid-llm-in-ci.md)). *D-K7 falsifier:* a deployed rubric question proves mechanically checkable (pure syntax) → promote that one question to a deterministic arm, prose stays for the judgment rest.

### §6.2 Round-budget config — the calibrated L4 numbers (advisor-spec §8 item 7, 2026-08-17)

**Config, not statute.** [effort-worthiness.md §2 L4](effort-worthiness.md) owns the *semantic* — a breached budget forces an **ASK** to the advisor / concept holder, never a guillotine and never a silent push-through; the loop continues once the ask is filed — and [its §5](effort-worthiness.md) states the numbers are «calibrated from the audit rates …, never hard-coded here». This subsection is that config. The numbers below are expected to move on re-measurement; the ASK semantic is not.

Every figure derives from the review-effort-theatre audit's measured corpus — 12 distinct review loops, 37 rounds, ~104 classified findings ([2026-08-10-review-effort-theatre-audit.md `:43-48`](../../docs/meta-factory/research-patches/2026-08-10-review-effort-theatre-audit.md), `:190-231`). Citations below are line refs into that patch unless stated otherwise.

| Lane | Budget | ASK fires | Derivation |
| --- | --- | --- | --- |
| **Cumulative rounds per stage** — cross-run; the D6 counter resets on every dispatch run, so nothing else bounds this (`:243`) | **3 rounds** | before spending round 4 | Final-round distribution `:44-46` = {1,1,2,2,2,2,3,3,3,5,6,7}: 9/12 loops (75%) close at ≤3, so the ASK trips on 3/12 (25%). The audit proposes the same number at `:326`. |
| **Finding-closure follow-up PRs per stage** — «no severity contract governs what deserves its own PR» (`:244`) | **1 PR** | before opening a second | 3 follow-up PRs in the window (`:212-215`); per parent loop #1341→1, #1353→2, #1358→0 (`:132-137`). The single loop that exceeded 1 is exactly the one whose follow-ups closed **only** immaterial findings (`:129-131`), while the one-PR case #1350 closed four material items (`:137`). |
| **GO-with-findings → fix → SHA-move → re-audit** | **none — uncapped BY DESIGN; do not add one** | — | `:242` + [acceptance-contour `:93`](../../docs/superpowers/specs/2026-07-23-acceptance-contour-design.md): «an audit-counting cap would make any PR that accepts review feedback unmergeable by construction». |
| **Notes-lane / watch-list size** | **none — measured, deliberately unbudgeted** | — | Watch-lists reached 8–11 rows (`:221-223`), but this is not a round-shaped surface and the §6 severity contract already bounds what a note may demand. Recorded so the omission reads as a decision, not an oversight. |
| **Tokens** | **none at v1** | — | [effort-worthiness.md §2 L4](effort-worthiness.md): «Rounds only at v1 — tokens have no measurement surface yet». The ~80–185k per cold seat (`:217`) prices the treadmill; it is not a budget. |

**Why 3 and not 2.** A 2-round budget trips on 6 of 12 loops (`:47`) — half the population — and #1311's rounds 3–5 each caught a real defect that rounds 1–2 had not, so a hard cap there would have shipped them (`:274-275`). At 3 the audit's own worked example holds: #1341's seven rounds «would have been ASKed at 3 and plausibly confirmed» (`:327-329`).

**These budgets do not replace the three convergence caps** — [`arch/SKILL.md:94`](../skills/arch/SKILL.md) (2 REVISE rounds), [`harvest/SKILL.md:80`](../skills/harvest/SKILL.md) (2 rounds → escalate), [`dispatcher/SKILL.md:194`](../skills/dispatcher/SKILL.md) (D6: 2 *consecutive* REVISE on unchanged scope). Those count failure-to-converge and reset on a GO or a scope change; this budget counts cumulative rounds and never resets. #1341 is the proof they are different counters — seven rounds with D6 never firing (`:243`).

**Precedence.** A contour or stage that declares its own L4 budget **overrides this default for its own stages** — live precedent: [triage-kernel-v2 §9 `:402-407`](../../docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md) sets tighter per-stage budgets (S0 «1 round → ASK», S1-S5 «2 rounds → ASK»). The table is the default where nothing tighter is declared; it is never a floor forcing a contour to spend more.

**Provenance label — read it before leaning on a number** (same posture as §6.1): **`corpus-derived, uncalibrated`**. n = 12 loops inside a 3-day window (`:62-68`), single classifier, «Calibration: NONE … expect ≥20% dispute rate on MATERIAL-b rows» (`:366-371`). These are starting points, never validated thresholds, and must not be quoted downstream as measured constants.

**Falsifiers** (D-AP6, [advisor-pattern-design `:498-501`](../../docs/superpowers/specs/2026-08-10-advisor-pattern-design.md)): (a) the tripwire fires and the advisor answers «continue» unchanged → the budget is mis-set — **re-derive from the then-current loop distribution, do not nudge the number**; (b) a loop *stops* at the budget instead of asking → the ASK has decayed into the guillotine L4 forbids, and the defect is the protocol, not the number.

**Observable, honestly scoped.** Per PR the round count is already syntactic — `Round: <n>` is required on every GO block ([`pr-body-fidelity.ts:55`](../../packages/core/hooks/checks/pr-body-fidelity.ts), enforced at `:208`). The *cumulative* per-stage line the first budget reads against is the audit's `:324` proposal and has **not** shipped, so at v1 the cumulative count is seat-tracked and stated in the ask itself. Per [attention-is-not-a-mechanism.md §1](attention-is-not-a-mechanism.md) the breach consumer is the named advisor ASK — a protocol, not «someone reads the number» — but the *count* still rests on the seat, which is why falsifier (b) is load-bearing rather than a footnote.

## See also

- [.claude/rules/phase-research-coverage.md §4 anti-patterns](phase-research-coverage.md) — sibling family of focus-tunnel anti-patterns (`#discipline-application-scope-blindness`, `#recursive-self-application-gap`).
- [.claude/rules/ai-laziness-traps.md](ai-laziness-traps.md) — companion discipline on AI laziness during open-ended audits; T16 («pattern-matching-on-name») is the trap that caught the 1A compliance-verifier misalignment.
- [agents/review-sidecar.md](../../agents/review-sidecar.md) — AI-agnostic sub-agent precedent for review work (NOT a compensating mechanism for this rule).
- [agents/compliance-verifier.md](../../agents/compliance-verifier.md) — §1.7 PR-body review agent (scoped narrowly to `phase-research-coverage §1.7`; NOT a reviewer-discipline mechanism per Track 3 §3.3).
- [CLAUDE.md `Artifact Ownership Contract`](../../CLAUDE.md) — reviewer agents are read-only for artifacts they don't own (this rule is the behavioral side of that contract).
- [docs/meta-factory/research-patches/2026-05-16-prose-rules-audit-research.md §3.3](../../docs/meta-factory/research-patches/2026-05-16-prose-rules-audit-research.md) — Track 3 evidence: Class B → C transition rationale.
