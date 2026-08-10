# Reviewer discipline — discipline rule

<!-- channel: agent agents/reviewer-discipline.md#reviewer-discipline -->

> **Class:** C — prose-only, no current compensating mechanism (reclassed from B per Track 3 §3.3, commit 4d52a72). Promotion criterion in §4.
> **Fires:** review sessions (`/review`, `/ultrareview`, or a prose "проверь"/verdict ask).
> **Authoritative for:** reviewer-discipline rule — §1 reviewer/orchestrator role separation, §2 surface-as-decision-needed pattern, §3 anti-patterns (`#role-swap-mid-session`, `#strategy-decided-by-reviewer`), §4 promotion / retirement triggers, §5 classification, §6 severity contract + ESCALATED grammar.
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
- **Materiality dispute:** either side raises it; advisor verdict `MATERIAL | IMMATERIAL | OUT-OF-CONCEPT | FLOOR` + one-line rationale, judged ONLY against ratified artifacts; final for the round; disagreement → operator fork. A read-only reviewer marks the finding `DISPUTED` with a verbatim dispute block in its own report; the orchestrating session transcribes that block into an ask file (`class: materiality-dispute`) as a **verbatim copy, never a paraphrase**, before the round may close.

## See also

- [.claude/rules/phase-research-coverage.md §4 anti-patterns](phase-research-coverage.md) — sibling family of focus-tunnel anti-patterns (`#discipline-application-scope-blindness`, `#recursive-self-application-gap`).
- [.claude/rules/ai-laziness-traps.md](ai-laziness-traps.md) — companion discipline on AI laziness during open-ended audits; T16 («pattern-matching-on-name») is the trap that caught the 1A compliance-verifier misalignment.
- [agents/review-sidecar.md](../../agents/review-sidecar.md) — AI-agnostic sub-agent precedent for review work (NOT a compensating mechanism for this rule).
- [agents/compliance-verifier.md](../../agents/compliance-verifier.md) — §1.7 PR-body review agent (scoped narrowly to `phase-research-coverage §1.7`; NOT a reviewer-discipline mechanism per Track 3 §3.3).
- [CLAUDE.md `Artifact Ownership Contract`](../../CLAUDE.md) — reviewer agents are read-only for artifacts they don't own (this rule is the behavioral side of that contract).
- [docs/meta-factory/research-patches/2026-05-16-prose-rules-audit-research.md §3.3](../../docs/meta-factory/research-patches/2026-05-16-prose-rules-audit-research.md) — Track 3 evidence: Class B → C transition rationale.
