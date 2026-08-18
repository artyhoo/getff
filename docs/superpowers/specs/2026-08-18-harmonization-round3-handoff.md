# Handoff — harmonization round 3: top-down creative re-examination (fresh session)

> **Status:** CLOSED 2026-08-18 — round 3 EXECUTED in this file's mandated phase order
> (Phase A cold shapes → Phase B collide with the record → Phase C operator verdict).
> Outcome: the amended-register branch fired — operator-axis spec §9 v4 (D-H15
> superseded by injected-context bindings) + round-2 spec §9 v2 (D-C1 thin form, D-C9
> fourth-stack boundary). Retained as closure record.
> **Continuation-state correction (found by the round-3 in-flight probe):** the
> «round-1 spec … 2 commits, unmerged» line below was STALE at writing — the
> operator-axis contour had already closed at v3 REVIEWED-GO (3 review rounds,
> `f2d3fe2655`/`cf7fcb2942`) before this handoff's own commit (`99793ad9e7`, 01:53
> same night). Only the round-2 spec lacked a cold review. Both branches were merged
> into `claude/festive-shtern-0e0296` at round 3 (`3ae6981833`).
> **Authoritative for:** the round-3 mandate, its phase order, and the continuation state.
> **NOT authoritative for:** the designs themselves — round-1 spec
> [2026-08-18-skill-stack-harmonization-design.md](2026-08-18-skill-stack-harmonization-design.md)
> (merged into this branch at `3ae6981833`); round-2 spec
> [2026-08-18-consumer-satellite-harmonization-design.md](2026-08-18-consumer-satellite-harmonization-design.md)
> (this branch); project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).

## The mandate (operator, 2026-08-18 — verbatim register, P-C3 in the round-2 spec §2)

The essence of the whole harmonization effort: **reuse the best of the plugin ecosystem
(Claude Code engineering plugins, superpowers, Matt's grilling) inside OUR pipeline — the
process, not a skill — writing as little of our own as possible; befriend the plugins and
kill the collisions along the way.** The round-3 question, asked at the highest altitude:

> «максимально ли эффективно (качественно и при этом с минимум усилий) мы это делаем или
> городим пуголо либо жгем токены там где это не особо то и нужно, где совсем низкий кпд?
> … подумать еще раз уже наиболее сверху творчески и абстрактно без лишних мешающих
> концептуальному и филосовскому мышлению и творчеству — может еще как нибудь лучше
> придумаем или найдем более эфективное или простое решение с тем же резульататом?»

Scope: the WHOLE harmonization design (operator axis + consumer axis), **collisions
first**. Every recorded decision (D-H0..D-H18, D-C1..D-C8) is re-openable; nothing is
shipped yet, so supersession is cheap — this is the moment to find the simpler design.

## Phase order (deliberate membrane — creativity BEFORE fact-loading)

The operator explicitly asked for thinking unencumbered by detail. Do NOT start by
reading both specs end-to-end.

1. **Phase A — cold creative pass.** Read ONLY this handoff (it states the problem in
   one paragraph below). Think from first principles: what is the *minimal* mechanism by
   which three skill stacks coexist in one router without misrouting? Generate 3-5
   genuinely different shapes (not variations of the recorded one). Useful altitude
   questions: does the collision need to die in the CACHE (deletion), in the ROUTER
   (precedence/binding), in the PROCESS (our pipeline invokes skills explicitly — a
   slash-invoked process never routes), or in the SHIPPING decision (don't ship overlap
   at all)? What would each cost per satellite added? What does nothing (accept
   misroutes, measure, fix on incident) actually cost?
2. **Phase B — collide with the record.** Only now read both specs (§4 registers first).
   For each Phase-A shape: does it survive the fact registers (round-2 §6, round-1 §6)?
   Which recorded decisions does it dissolve or simplify?
3. **Phase C — verdict with the operator.** Interview per `/arch` §1 (grilling frontier
   mechanic, recommendations first). Outcome: either «recorded design confirmed — run
   the §2 cold review on both specs», or an amended register with dispositions
   (`ACCEPTED | DISSOLVED | ESCALATED | FIXED`), then the cold review.

**The problem in one paragraph (Phase-A input):** Our repo has ~16 own skills; two
satellite plugins (superpowers 6.2.0, mattpocock-skills 1.2.3) are installed user-scoped
(machine-global; per-project plugin scoping does not exist in Claude Code). The model
router picks skills by description triggers; on bare prompts like «fix this bug
test-first» it picks the satellite over the incumbent 3/3. The same stacks ship to
consumers via `./setup` (superpowers today, machine-global, consent-gated y/N), so the
collisions ship too — onto machines whose own skills we cannot know, with no telemetry
channel back. Recorded answer so far: prune two skills on the operator machine + binding
paragraphs + an admission gate (factory CI) + an install-time census scanner with
prescribed-not-executed remediation for consumers + ⚠ consent parity. The round-3
question: is that the cheapest shape that buys «right skill wins, both axes», or is
there a simpler one?

## What is settled (do not re-derive; re-opening allowed only WITH the operator)

- The operator premises P-1..P-7 (round-1 spec §2) and P-C1..P-C3 (round-2 spec §2) are
  binding registers — argue on merits (P-1), never yield-to-please.
- Probes P1/P2a-c/P6 (round-1 spec §6): executed, do not re-run. P5 (cache-rename
  liveness) is still PENDING operator hands. P4 closes with the claim-machinery build.
- Facts F-C1..F-C6 (round-2 spec §6): verified 2026-08-18 against this repo.
- Both cold two-altitude reviews are DEFERRED behind round 3 — round 1 already had its
  own round-1 review (dispositions in its §9); round 2 has had none.

## Session-start for the round-3 session

1. Fresh top-tier session, isolated worktree; run the in-flight probe before any edit.
2. Branch state as of this writing: round-1 spec on `claude/keen-shannon-46577a`
   (2 commits, unmerged); round-2 spec + this handoff on `claude/festive-shtern-0e0296`
   (worktree `heuristic-joliot-01a0a3`). Neither has a PR — PR pause in force unless the
   operator lifts it. *[STALE at writing — see the Status correction above; retained
   verbatim as historical record.]*
3. Read order: this file → Phase A (no other reading!) → Phase B: round-2 spec →
   round-1 spec → prep-doc `2026-08-17-arch-prep-skill-stack-harmonization.md`
   (same branch as round-1 spec) §2 collision map if needed.

## Traps (carried forward from rounds 1-2)

- The permission classifier blocks agent writes to `~/.claude/plugins/cache/**` — any
  cache experiment is an OPERATOR action; do not retry as agent.
- `docs/superpowers/specs/` files count toward the 600-line markdown gate; check `wc -l`
  before growing a spec in review rounds.
- Conflicting background-agent claims about routing mechanics: resolve by fetching the
  primary doc (skills.md) and quoting it — this falsified a `skillOverrides` claim once.
- Matt's `research` and `prototype` skills stay OUT of any prune list — wayfinder
  tickets invoke them by name (round-1 D-H17).
- Fuzzy trigger-overlap detectors measured 13% and 38% precision in this repo — any
  Phase-A shape that needs semantic collision detection must name a deterministic proxy
  or budget a named cold-agent audit, never a grep heuristic.
