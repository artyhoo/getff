# Three-stack skill harmonization — design (ours × superpowers × mattpocock-skills)

> **Status:** DESIGNED 2026-08-18 — interview complete (frontier empty), spec written;
> §2 cold two-altitude review NOT yet dispatched — see the companion handoff
> [2026-08-18-skill-harmonization-handoff.md](2026-08-18-skill-harmonization-handoff.md).
> **Authoritative for:** the ratified capability-ownership map (§3), the decision register
> (§4), the mechanism set (§5), the probe register (§6), the testing-seams slot (§7).
> **NOT authoritative for:** raw comparison evidence — prep-doc
> [2026-08-17-arch-prep-skill-stack-harmonization.md](2026-08-17-arch-prep-skill-stack-harmonization.md);
> grilling adoption — [SSOT #253](../../meta-factory/prior-art-evaluations.md); reviewer
> severity grammar — [reviewer-discipline.md §6](../../../.claude/rules/reviewer-discipline.md);
> project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).

> **Origin:** `/arch` design session 2026-08-17→18 over the prep-doc. Interview run per the
> newly-adopted grilling mechanic (frontier rounds with recommendations + free-form pushback
> rounds); probes P1/P2a-c/P6 executed by background subagents, P5 pending (operator hands).

## §1 Goal and scope

One owner per capability area across the three installed skill stacks (this repo's 16
skills, superpowers 6.2.0, mattpocock-skills 1.2.3), with every subordinated skill bound to
an explicit mechanism — binding paragraph, cache prune, REFERENCE, or REJECT — so that
routing collisions die **preventively** (earliest reachable channel), not by incident
counting alone. Scope: operator-axis only; nothing here ships to consumers
(`packages/core/templates/**` untouched; the [dual-implementation degrade](../../../.claude/rules/dual-implementation-discipline.md)
rule stands).

## §2 Operator-premise register

Verbatim-faithful to meaning in context (advisor-pattern §7/§8 obligation); transfer by
copy-or-pointer, never paraphrase.

- **P-1** (2026-08-18): «не соглашайся со мной и не уступай мне, мы обсуждаем и цель наша
  сделать как лучше, а не понравится друг-другу» — disagreement is a duty; every verdict
  in §4 stands on argued substance, not concession. Applied: D-H2 (TDD) and D-H11
  (glossary) were re-argued on the merits after operator pushback; D-H5 was **conceded on
  the merits** (the operator's reuse push exposed an over-designed column).
- **P-2** (2026-08-17): «хотелось бы выбрать лучшее из обоих — они же спутники наши» —
  satellites doctrine; use-before-build ([BFR §1.1](../../../.claude/rules/build-first-reuse-default.md)).
- **P-3** (2026-08-17): «можно и с суперпауерс поступить и вообще вычищать все лишнее из
  спутников… чтобы контекст не жрало» — the prune doctrine. Evidence re-weighted the
  MOTIVE, not the mechanism: the skill listing is budget-capped at ~1% of the context
  window (skills.md, fetched 2026-08-18: «The budget scales at 1% of the model's context
  window»), so token cost is minor; the standing harm is **misrouting** (P2: 3/3). Hence
  the prune list stays narrow and collision-targeted (§5.1), not a total sweep.
- **P-4** (2026-08-18): «в аиф так же поставим плагин и все — как и суперпауерс» —
  container executors get the same satellite toolkit (§5.6). Distinction preserved: the
  plugin is the *client*; the claim *registry* question is settled separately (§5.4).
- **P-5** (2026-08-18): «Эти клеймы похожи на наш план в /pipeline когда мы отмечаем что
  выполнено» — confirmed and adopted as the design frame: claim = the existing pipeline
  status layer (state.md + statuses legend) with the write moved BEFORE the Phase -1
  window and the racing medium moved to the live aif queue (§5.3). No second status
  vocabulary is introduced.
- **P-6** (2026-08-17): «Про тдд не аргумент, хотелось бы сравнить и по существу решить
  что лучше» — incumbency alone decides nothing; the D-H2 verdict stands on the
  threat-model comparison (§4), with the dependency edges as cost input, not as the
  argument.

## §3 Ratified capability-ownership map (D-H1)

Amended from prep-doc §4 by the interview. Mechanisms: **bind** = binding paragraph in our
wrapper (prep §3 mech 1); **prune** = cache prune list (§5.1); **REFERENCE** = consulted,
never routed-to by contract; **REJECT** = recorded in SSOT.

| Area | Owner | Subordinated / consumed | Mechanism |
| --- | --- | --- | --- |
| Interview pacing | Matt `grilling` | SP brainstorming one-question rule yields | `/arch` §1 binding (shipped 2026-08-17) |
| Ideation pipeline | SP `brainstorming` | — | settled (SSOT #64) |
| In-session execution | SP `SDD` + `writing-plans` | Matt `implement` (15-line stub) | REJECT; slash-only, no prune needed |
| TDD loop | SP `test-driven-development` | Matt `tdd` → **three transfers** (§4 D-H2), text pruned | prune #1 + D-H14 seams slot |
| Debugging entry | Matt `diagnosing-bugs` | SP `systematic-debugging` → REFERENCE | none needed (0 hard refs; P2c router already picks Matt) |
| Code-review verdict + severity | ours ([reviewer-discipline.md §6](../../../.claude/rules/reviewer-discipline.md)) | Matt severity-less model | REJECT |
| Code-review structure | ours `/arch` §2 + `agents/fidelity-auditor.md` | Matt `code-review` (no-rerank sentence already transferred, D-H4) | prune #2 |
| Merge-conflict handling | ours [git-conflict-merge-forward.md](../../../.claude/rules/git-conflict-merge-forward.md) | Matt `resolving-merge-conflicts` (advises rebase continuation; force-push is classifier-blocked for agents) | prune #3 — **new collision found this session** |
| Factory orchestration | ours (`pipeline`/`dispatcher`/`orchestrator`) | claim doctrine §5.3; Blocked-by edges §5.4 | build items routed §8 |
| Multi-session design maps | Matt `wayfinder` — ADOPT verbatim | our ad-hoc handoff briefs (design contours only) | setup once; slash-only, zero routing risk |
| Glossary / domain modeling | Matt `domain-modeling` + `CONTEXT.md` — ADOPT | ADR directory | pointer rule + principle test §5.3; ADR dir REJECT (specs/research-patches cover it) |
| Skill authoring | ours `/ai-doc` (standard) + SP `writing-skills` (process) | Matt `writing-for-agents` | REFERENCE; one ownership note in `/ai-doc` |
| Human-only procedures | Matt `wizard` — ADOPT | — | first use = §5.1 prune wizard (D-H6) |
| Continuity / handoff | ours (seat-lifecycle + session-bus) | Matt `handoff` | REFERENCE |
| Research | ours (`/arch` §1.5 contour) | Matt `research` | KEEP in cache — wayfinder `research` tickets invoke it (wayfinder/SKILL.md:77) |

## §4 Decision register (final; grown live during the interview per `/arch` §1 D4)

| Decision | Status | Resolution | Falsifier |
| --- | --- | --- | --- |
| D-H0 grilling adoption | answered 2026-08-17 | ADOPT via plugin; `/arch` §1 binding | SSOT #253 triggers |
| D-H1 ownership map | **ratified 2026-08-18** | §3 table | wrong if a live misroute lands despite prune+bindings → mechanism 6 (vendor + uninstall) |
| D-H2 TDD conflict | answered 2026-08-18 | SP owns the loop — its text is armor against agent-laziness rationalizations (our threat model: verify-RED/GREEN mandatory, 11-excuse table), Matt's 39-line text is a solo-dev reference. Refactor-placement conflict largely dissolves for us: SDD's per-task review IS the review stage Matt relocates refactoring to — we keep both lines. **Three transfers from Matt:** (a) seams-first → D-H14; (b) tautological-test anti-pattern → REFERENCE for `/rule-tests`; (c) horizontal-slicing/tracer-bullet → REFERENCE for `/vitest` | wrong if our PR corpus shows refactoring debt passing through SDD per-task review (then revisit placement) |
| D-H3 debugging | answered 2026-08-18 | Matt `diagnosing-bugs` owns the entry (0 hard refs to SP's from us or inside SP — measured prep §1.5; router picks it anyway, P2c); SP `systematic-debugging` → REFERENCE | wrong if an executor incident shows the SP rationalization armor was needed mid-debug → flip back |
| D-H4 no-rerank | answered 2026-08-17 | landed `09569a30ab` (`/arch` SKILL.md:89) | as recorded in prep |
| D-H5 claim-first | answered 2026-08-18 | Two populations, two EXISTING registries: design tickets → wayfinder assignee-claim (native); factory stages → **aif task creation moved BEFORE the Phase -1 window** (dispatcher step reorder; task cancel branch on Phase -1 RED required). state.md stays the journal; no `Claimed-by:` column (over-design, withdrawn under P-1) | wrong if a dispatch collision recurs WITH the reordered claim in place → medium insufficient, revisit (GH issues) |
| D-H6 wizard first use | answered | generate the §5.1 prune wizard | — |
| D-H7 incident counter | settled | SSOT #253 row records misroutes; observation №0 logged | 1st real misroute → incident №1 |
| D-H8 plugin fate | answered 2026-08-18 | keep + prune 3 + counter armed | ≥3 real misroute incidents → vendor keepers + uninstall |
| D-H9 orchestrator rewrite | ratified | thin 512-line skill to deltas+bindings (the `/arch` model); factory umbrella (§8) | wrong if re-described slices turn out load-bearing (rewrite reviewer checks) |
| D-H10 TDD bare-acronym hazard | **DISSOLVED by D-H15** (pruning Matt's `tdd` removes the competing router entry; «following TDD» in SDD's implementer prompt then has one referent) | residual: if P5 fails, revive the dispatch-prompt binding line + project shadow | wrong if P5 shows cache deletion ineffective |
| D-H11 domain-modeling pairing | answered 2026-08-18 | ADOPT skill + CONTEXT.md as-is (generation REJECTED on the merits: glossary is authored, not derived; the skill's value is live inline challenge-and-write). Our delta = pointer rule + principle test (§5.3). ADR dir REJECT | wrong if entries duplicate owner-doc definitions despite the rule → degrade CONTEXT.md to a generated pointer index |
| D-H12 wayfinder | answered 2026-08-18 | ADOPT verbatim; run `/setup-matt-pocock-skills` once; tracker = local-markdown first (upstream default when unconfigured, wayfinder/SKILL.md:25); GH issues revisited if collaboration appears | wrong if design maps stay ≤2 sessions in practice |
| D-H13 Blocked-by edges | ratified | `Blocked-by:` column in kickoff stage tables; `/pipeline` computes the dispatchable frontier mechanically; expand–contract + fog-of-war vocabulary into kickoff conventions | wrong if real umbrellas are overwhelmingly linear |
| D-H14 seams slot | ratified | `Testing seams` slot in the spec-template obligation (`/arch` §1); «seams: n/a — doc artifact» is a legitimate answer; self-applied in §7 | wrong if the slot is n/a in ~all meta-factory specs for 6 months → demote to optional line |
| D-H15 prune doctrine | **NEW, ratified 2026-08-18** | operator-run idempotent prune script + 3-item list (§5.1); motive = misrouting (P2), not tokens (budget-capped, P6+fetch); total sweep REJECTED; anthropic-skills untouched (needed globally; per-project plugin scoping does not exist — P6, feature request open) | wrong if P5 shows deletion doesn't survive or router still lists pruned skills → fallback mechanism 6 |
| D-H16 plugin in aif container | **NEW, ratified 2026-08-18** | install mattpocock-skills in the aif runtime (executor toolkit: grilling, domain-modeling); §5.1 prune list applies there too | — |

## §5 Mechanisms

### 5.1 Prune script (D-H15) — the preventive channel

`scripts/prune-plugin-skills.sh` (operator-run: the permission classifier blocks agents
from writing `~/.claude/plugins/cache/**` — measured live this session): deletes the
listed skill dirs from the plugin cache; idempotent; glob over version dirs so a plugin
update (new `<version>/` dir) is healed by a re-run. Prune list v1, all
`mattpocock-skills/*/skills/engineering/`: `tdd`, `code-review`,
`resolving-merge-conflicts`. Criterion: **model-invocable AND (collides with an owned area
OR contradicts a repo rule)**. Slash-only skills are never pruned (no router presence, no
listing cost). First delivery = a `wizard`-generated walkthrough (D-H6). Gate: P5 must
pass first (§6).

### 5.2 CONTEXT.md pointer rule + principle test (D-H11)

Authoring rule: a CONTEXT.md entry for a term that already has an owner doc
([doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md)) carries a
one-line gist + link to the owner anchor, never a redefinition; new terms may live fully in
CONTEXT.md (it becomes their owner). Principle test (new slot, mold of principles 08/09):
every CONTEXT.md link resolves to an existing anchor.

### 5.3 Claim doctrine (D-H5, P-5)

Factory: the dispatcher creates the aif task (= claim, visible instantly cross-session)
**before** dispatching the Phase -1 cold review, not after it; on Phase -1 RED the task is
cancelled (explicit branch). `probe-inflight.sh` already reads the queue — the reorder
closes the measured race («all historical collisions materialized inside the Phase -1
window», CLAUDE.md pre-dispatch probe section). Design contours: wayfinder's native
assignee-claim. state.md remains the journal; the statuses legend is unchanged.

### 5.4 Blocked-by frontier (D-H13)

Kickoff stage tables gain `Blocked-by:`; `/pipeline` derives the dispatchable frontier
mechanically (attention-shaped prose → checkable structure,
[attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md)).
Kickoff template vocabulary gains vertical-slice + expand–contract + a per-umbrella
fog-of-war section.

### 5.5 Seams slot (D-H14)

The `/arch` §1 spec-template obligation gains a `Testing seams` line: seams named and
confirmed at spec time («prefer existing seams; ideal number is one»); «n/a — doc
artifact» legitimate. This also makes the seams half of Matt's tdd coherent for executors
without importing his refactor placement.

### 5.6 Satellite toolkit in aif (D-H16)

Install mattpocock-skills into the aif runtime image/config the same way superpowers is
installed; apply the §5.1 prune list there. The plugin is the executor's *client* toolkit;
it is NOT the claim mechanism (that is §5.3).

## §6 Probe register (facts; all sources dated)

- **P1** (claude-code-guide, 2026-08-17): plugin skills are namespaced — a project `tdd`
  coexists, `/tdd` typed resolves to the project skill (documented); model-routing
  precedence between them UNDOCUMENTED; **per-skill disable of plugin skills does not
  exist** — `skillOverrides` explicitly excludes plugin skills.
- **P2a/b/c** (routing probes, 2026-08-17): on bare «fix this bug test-first» / «review
  this branch» / «debug this — the test is failing» the router picked
  `mattpocock-skills:tdd` / `:code-review` / `:diagnosing-bugs` — 3/3 verbatim-trigger
  wins. Limitation: meta-probes (agents asked to name their pick), not live task runs.
- **P5** (PENDING — operator hands; classifier blocked the agent): rename
  `~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.3/skills/engineering/tdd`,
  open a fresh session, confirm the skill is absent from the listing; restore or keep.
  Gates §5.1.
- **P6** (claude-code-guide, 2026-08-18): no per-project plugin scoping (`enabledPlugins`
  is global-only; GitHub feature request open). Its claimed `skillOverrides` workaround
  for plugin skills was **falsified** by a direct fetch of skills.md the same day:
  «Plugin skills are not affected by `skillOverrides`.» Listing economics from the same
  fetch: budget ≈1% of context window; overflow trims least-used descriptions; per-entry
  cap 1,536 chars; slash-only skills carry no descriptions into the listing.

## §7 Testing seams (D-H14, self-applied)

This design is mostly doc-artifacts. Named seams: (1) the §5.2 principle test — the one
code seam, red when a CONTEXT.md anchor breaks; (2) the §5.1 prune script — verified live
by the P5 procedure, not by unit tests; (3) the §5.3 dispatcher reorder — verified by the
existing probe-inflight population plus one negative branch (Phase -1 RED → task
cancelled). Everything else: n/a — doc artifacts, guarded by the §2 cold review.

## §8 Routed work inventory (input to `/arch` §3 exit routing — NOT yet routed)

1. Operator, no build: run P5; run §5.1 prune (wizard-assisted); run
   `/setup-matt-pocock-skills` (local-markdown tracker); install plugin in aif (§5.6).
2. Small in-session edits: `/arch` §1 seams slot (§5.5); `/ai-doc` ownership note (§3);
   REFERENCE notes in `/vitest` + `/rule-tests` (D-H2 transfers b/c).
3. Factory umbrella «skill-harmonization-mechanisms»: §5.1 script + wizard, §5.2 principle
   test, §5.3 dispatcher reorder, §5.4 pipeline frontier + kickoff template vocabulary.
4. Separate factory umbrella: D-H9 orchestrator rewrite (deltas+bindings).
5. SSOT entries: REJECT rows (Matt `implement`, ADR directory, severity-less review model,
   total-sweep pruning) + the D-H7/D-H8 counter arms on #253.

## §9 Changelog

- 2026-08-18 — v1 written at interview close; awaiting §2 cold two-altitude review
  (dispositions per `ACCEPTED | DISSOLVED | ESCALATED | FIXED` will land here).
