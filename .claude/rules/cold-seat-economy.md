# Cold-seat economy — re-audit on substance, resume for continuity

<!-- channel: skill-embed .claude/skills/harvest/SKILL.md#seat-economy -->
<!-- channel: skill-embed .claude/skills/dispatcher/SKILL.md#seat-economy -->

> **Class:** C — prose-only. The two calls this rule governs — «did the substance this seat
> judges change?» and «resume or fresh?» — are judgment, not mechanically detectable, so no gate
> is reachable (`#gate-where-judgment-needed`, [rule-enforcement-channel-selection.md §1/§5](rule-enforcement-channel-selection.md)).
> Delivery = skill-embed at the two choreography owners (markers above); this file is the SSOT
> read on demand. Promotion criterion in §5.
> **Fires:** re-running a cold seat on already-judged work; resume-vs-fresh choice.
> **Authoritative for:** the cold-seat economy discipline — §1 re-audit on substance not SHA, §2 seat ordering (expensive WHAT-audit last, on the final diff), §3 resume-vs-fresh, §4 anti-patterns, §5 promotion / retirement.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). The fidelity-audit protocol itself — see [agents/fidelity-auditor.md](../../agents/fidelity-auditor.md). Rework-loop mechanics (rounds, caps, `answer.ts`) — see [.claude/skills/dispatcher/SKILL.md §2.4](../skills/dispatcher/SKILL.md). The standalone harvest procedure — see [.claude/skills/harvest/SKILL.md §4](../skills/harvest/SKILL.md). Crash-idempotence of a verdict on the SAME SHA — that is spec D10 ([2026-07-23-acceptance-contour-design.md](../../docs/superpowers/specs/2026-07-23-acceptance-contour-design.md)); this rule owns the NEW-SHA case.

> **Origin:** 2026-07-31, S-A rounds 2-4 of the arch-v2-context-pipeline umbrella. A full
> fidelity re-audit was spent (~185k tokens) re-confirming an unchanged answer after a commit
> that moved only implementation internals inside the same three permitted files — the SHA had
> moved, the substance the seat judges had not. Operator directive: «не жги токены
> переаудитами когда SHA только не сошлось» + invited codification (the umbrella IS the
> context/token-economy track). Same session measured resume-vs-fresh on a real round pair
> (§3 table). Codified from memory per [memory-codification.md §3](memory-codification.md).

## §1 Re-audit on substance, not SHA

A cold seat's verdict is re-earned by a change in **what that seat judges**, never by the head
commit moving. A SHA mismatch alone is a bookkeeping problem (the `pr-body-fidelity` gate
requires `Audited-SHA` to prefix the PR head — [pr-body-fidelity.ts:165](../../packages/core/hooks/checks/pr-body-fidelity.ts)),
not an audit problem. When a post-audit commit lands, ask per seat what changed **for that
seat**:

- **Same deliverables, same permitted files, same descopes** → the fidelity verdict stands in
  substance. Confirm scope mechanically (`git diff --name-only <audited>..HEAD` against the
  kickoff's permitted-file list), then re-establish the verdict with a **narrow cold delta
  check**: hand a cold agent only the incremental diff plus the kickoff's scope sections.
  Thousands of tokens, not hundreds of thousands. The refreshed block records the new HEAD as
  `Audited-SHA`.
- **Deliverables, permitted files, or descopes actually moved** → that is substance; a full
  re-audit is earned.
- **Never self-issue the verdict to dodge the cost.** The seat is cold by construction; a
  self-issued verdict on your own work is the failure the acceptance contour exists to prevent
  (T19, [ai-laziness-traps.md §2](ai-laziness-traps.md)). The cheap path is a *smaller cold
  check*, never *no cold check*.

## §2 Seat ordering — the expensive WHAT-audit runs on the FINAL diff

Dispatch cold seats **serially, cheapest-consequence first**, and run the expensive
WHAT-conformance audit **only once the diff is final**. The origin incident's real mistake was
ordering: fidelity and code-review were dispatched in parallel, the code-review returned
REVISE, and the resulting fix invalidated the fidelity verdict that had cost the most. Every
post-audit commit forces an `Audited-SHA` refresh (§1), so the audit that is most expensive to
refresh goes last — plan around the constraint instead of fighting it.

## §3 Resume-vs-fresh for a follow-up round

When a cold seat must look again at work it already judged, **resume that agent** (SendMessage
by name) instead of spawning a fresh one — it still holds the kickoff, the acceptance criteria,
and what it previously verified.

Measured (S-A round 2→3, 2026-07-31), so the reason is stated correctly:

| run | tokens | tool calls | wall clock |
|---|---|---|---|
| fresh agent, full fidelity audit | 185,239 | 19 | 174 s |
| resumed agent, narrow scope question | 164,995 | 8 | 144 s |

- **The token saving is ~11% — resuming is NOT a cost lever.** A resumed agent replays its own
  transcript, so the context is paid for again. The tool-call drop (19→8) came from narrowing
  the *question* (§1), not from resuming. If cost is the constraint, the lever is the scope of
  the question, never the agent's identity.
- **The real win is continuity of judgment.** The resumed seat caught a regression a fresh
  narrow seat would have missed — a version pin creeping back onto the exact line an earlier
  work item had cleaned; it ran a grep *wider* than the acceptance criterion because it
  remembered why the criterion existed. In the incremental diff alone that change was one
  innocuous sentence.
- **Fresh agent when:** the subject is genuinely new, or a second *independent* opinion is
  wanted — resuming inherits the first read's blind spots, which is the whole reason cold seats
  are cold.

## §4 Anti-patterns

- **`#reaudit-on-sha-move`** — spending a full cold re-audit because `Audited-SHA` no longer
  prefixes HEAD, without asking whether the seat's substance moved. Counter: §1 scope check +
  narrow cold delta.
- **`#self-issued-verdict`** — the dispatching session writing the seat's verdict itself to
  save the re-audit cost. Counter: §1 third bullet — smaller cold check, never no cold check.
- **`#expensive-seat-on-nonfinal-diff`** — dispatching the costliest audit in parallel with a
  seat whose findings can still change the diff. Counter: §2 ordering.
- **`#resume-sold-as-savings`** — justifying a resumed seat by token economy. The measurement
  says ~11%; the honest reason is continuity. Counter: §3 first bullet (an unbacked cost claim
  here is T20, [ai-laziness-traps.md §2](ai-laziness-traps.md)).

## §5 Promotion / retirement

- **Promotion to Class B:** if `#reaudit-on-sha-move` or `#self-issued-verdict` recurs ≥3
  times with evidence, ship the mechanizable half — a helper that diffs
  `git diff --name-only <audited>..HEAD` against the kickoff's permitted-file list and prints
  `SCOPE-UNCHANGED` / `SCOPE-MOVED` — as the deterministic input to the §1 judgment (the
  judgment itself stays un-gated per Class rationale).
- **Retirement:** 12 consecutive incident-free months → archive to prose in
  [CLAUDE.md](../../CLAUDE.md). Peer criteria: [reviewer-discipline.md §4](reviewer-discipline.md).

## §6 §1.7 self-reflexive note

- **Forward-check:** complies with [rule-enforcement-channel-selection.md §1/§3](rule-enforcement-channel-selection.md)
  (judgment → injection; narrowest reliable trigger = skill-embed at the two choreography
  owners, not always-on — this rule is a claudeMdExcludes candidate); with
  [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md) (no CI mechanism at all; seats are session-read
  agents); with [doc-authority-hierarchy.md §2-§3](doc-authority-hierarchy.md) (Class +
  Authoritative-for header; flat-rule dynamic enumeration covers registration); with
  [language-discipline.md §1](language-discipline.md) (machinery in English; operator quote
  kept verbatim per §3 keep-list); with [build-first-reuse-default.md](build-first-reuse-default.md)
  (REUSE — no new artefact beyond this file: the mechanism is lines embedded in shipped skills;
  the §5 helper is deliberately NOT built now).
- **Backward-check:** class of this change = *artifacts owning cold-seat re-run choreography*.
  Enumerated (grep `re-audit|Audited-SHA|Round:` over `.claude/skills/**`, `agents/**`,
  `.claude/rules/**`): (a) [harvest/SKILL.md §4](../skills/harvest/SKILL.md) — EXTENDED
  (seat-economy embed lines + anchor); (b) [dispatcher/SKILL.md §2.4](../skills/dispatcher/SKILL.md)
  — EXTENDED (same, at the pre-egress gate); (c) [agents/fidelity-auditor.md](../../agents/fidelity-auditor.md)
  protocol item 5 — EXTENDED (narrow delta round legitimised from the seat's side, mirroring
  its existing Inputs scoping note); (d) [night-mode/SKILL.md delta item 8](../skills/night-mode/SKILL.md)
  — SWEPT-CLEAN (owns unattended *authorization*, restates no re-audit choreography);
  (e) spec D10 ([2026-07-23-acceptance-contour-design.md](../../docs/superpowers/specs/2026-07-23-acceptance-contour-design.md))
  — SWEPT-CLEAN, complementary (same-SHA crash idempotence vs this rule's new-SHA case);
  (f) [reviewer-discipline.md](reviewer-discipline.md) — SWEPT-CLEAN (reviewer role separation,
  not seat re-runs). Origin memories (`reaudit-on-substance-not-sha`,
  `resume-audit-agent-for-continuity`) reduce to pointers per [memory-codification.md §3](memory-codification.md)
  (outside the repo; done by the codifying session). No surface superseded.

## See also

- [agents/fidelity-auditor.md](../../agents/fidelity-auditor.md) — the seat protocol this choreography dispatches.
- [.claude/skills/dispatcher/SKILL.md §2.4](../skills/dispatcher/SKILL.md) + [.claude/skills/harvest/SKILL.md §4](../skills/harvest/SKILL.md) — the embed hosts.
- [docs/superpowers/specs/2026-07-23-acceptance-contour-design.md](../../docs/superpowers/specs/2026-07-23-acceptance-contour-design.md) — D6 rework caps, D10 idempotence.
- [ai-laziness-traps.md §2 T19/T20](ai-laziness-traps.md) — own cold-QA + verdict-without-evidence, the traps §1/§3 instantiate.
