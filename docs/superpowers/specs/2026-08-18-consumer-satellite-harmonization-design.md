# Consumer-axis satellite harmonization — design (D-H18 contour, round 2)

> **Status:** RECORDED 2026-08-18 — interview complete (frontier empty), decisions D-C1..D-C7
> ratified in dialogue; §2 cold two-altitude review **NOT dispatched** — superseded by the
> operator-mandated round-3 creative re-examination (D-C8, P-C3). Exit routing deferred to
> round 3. Companion handoff: [2026-08-18-harmonization-round3-handoff.md](2026-08-18-harmonization-round3-handoff.md).
> **Authoritative for:** the consumer-axis collision contract — §3 three-class collision
> model, §4 decision register D-C1..D-C8, §5 mechanism architecture, §6 fact register,
> §7 testing seams. All of it re-openable by round 3 (D-C8) — recorded, not shipped.
> **NOT authoritative for:** the operator axis — see
> [2026-08-18-skill-stack-harmonization-design.md](2026-08-18-skill-stack-harmonization-design.md)
> (branch `claude/keen-shannon-46577a`, unmerged as of this writing); consumer authority
> layers — [INSTALL-FOR-AI.md «Three-layer authority»](../../../INSTALL-FOR-AI.md); shipped-artefact
> degrade — [dual-implementation-discipline.md §3](../../../.claude/rules/dual-implementation-discipline.md);
> project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).

> **Origin:** `/arch` contour 2026-08-18, opened by the D-H18 chip (operator-axis spec §8
> item 6, premise P-7). §1.5 research contour skipped EXPLICITLY: the routing-mechanics
> domain is covered by operator-axis probes P1/P2a-c/P6; the consumer-delivery surface is
> this repo's own code, verified by direct reads this session (§6).

## §1 Goal and scope

A contract for how factory-shipped satellite skill stacks (superpowers today via the
`./setup` companions flow; grilling/mattpocock-skills candidates later) coexist with the
consumer's own and other skills, given that per-project plugin scoping does not exist
(P6) and a `--scope user` plugin install is machine-global. Operator axis untouched — its
spec is the SSOT for its own decisions.

## §2 Operator-premise register

Verbatim-faithful to meaning in context; transfer by copy-or-pointer, never paraphrase.

- **P-7** — carried by pointer: operator-axis spec §2 P-7 (consumer shipping ships the
  collisions; own design contour).
- **P-C1** (2026-08-18): «почему ты рекомендуешь не 2?» — the operator's challenge to the
  pure detect+declare recommendation exposed its hole (detection fixes nothing); the
  prescribe half was born from this pushback. Applied: D-C1.
- **P-C2** (2026-08-18): «кажется что колизии будут очевидно нет?» — collisions are a
  measured prediction, not speculation: the routing mechanism already misroutes 3/3 on
  verbatim triggers (operator-axis P2), and only the collision *participants* change on a
  consumer machine, not the mechanism. Combined with the counter-argument the session
  conceded to: incident-gated timing is unsound because **no consumer-telemetry channel
  exists** — a gate wired to a signal with no wire waits forever. Applied: D-C3.
- **P-C3** (2026-08-18, round-3 mandate): «суть в том чтобы взять лучшее и подружить
  плагины, вместе избавившись от коллизий … вопрос в том максимально ли эффективно
  (качественно и при этом с минимум усилий) мы это делаем или городим пуголо либо жгем
  токены там где это не особо то и нужно, где совсем низкий кпд? … подумать еще раз уже
  наиболее сверху творчески и абстрактно» — the harmonization's essence is reusing the
  best of the plugin ecosystem inside OUR pipeline (the process, not a skill) with minimal
  own writing; before building anything, one more top-down creative pass over the whole
  design (both axes, collisions first) must ask whether a simpler/cheaper mechanism buys
  the same result. Applied: D-C8 — the round-3 contour.

## §3 Three-class collision model

Each class has a different earliest reachable channel ([README.md#why-this-exists](../../../README.md#why-this-exists)):

| Class | Parties | Knowable where | Death channel |
| --- | --- | --- | --- |
| 1 | shipped skill × shipped satellite | fully at the factory | factory CI: admission gate + principle test (D-C2) |
| 2 | satellite × consumer's own skills | only on the consumer machine | install-time census in `./setup` (D-C1/D-C3) |
| 3 | satellite × consumer's OTHER projects (machine-global blast radius) | nowhere in advance | informed consent (⚠ parity, D-C4) + upstream scoping trigger |

## §4 Decision register

| Decision | Status | Resolution | Falsifier |
| --- | --- | --- | --- |
| D-C1 mechanism | ratified 2026-08-18 (P-C1) | **detect + declare + prescribe**: the census scanner detects local collisions AND prints exact remediation commands derived from the collisions measured on THAT machine; only the consumer executes; the factory never mutates the consumer host cache. Shipped static prune REJECTED as primary: the list would be authored blind (knowledge problem, not consent problem), needs a standing drift detector in the consumer's pre-push, and a wrong list = incident × consumer count (deletion is the irreversible branch, T18) | wrong if a live consumer misroute shows reports go unread and prose bindings don't hold → escalate to consent-gated prune |
| D-C2 admission gate | ratified 2026-08-18 | a NEW satellite row in `setup.d/companions.manifest` requires a census artifact: trigger-collision census vs the shipped skill set + capability-ownership row (D-H1 projection) + non-CC degrade path; presence enforced by a principle test on the manifest (class-1 collisions die at factory CI) | wrong if the census artifact rots into `#discipline-theatre` (form present, census stale) → add freshness bar |
| D-C3 build timing | ratified 2026-08-18 (P-C2, operator override of the session's «wait» recommendation — conceded on the merits) | build the census scanner NOW, not at the second satellite: the mechanism is measured (P2 3/3) and the incident channel does not exist, so incident-gated timing can never fire | wrong if round 3 (D-C8) finds a cheaper mechanism with the same result → supersede before build |
| D-C4 consent disclosure | ratified 2026-08-18 | extend the ⚠ machine-scope warning to `kind=cc-plugin` consent (today mcp-only, `setup.d/engine.sh:60-62` — superpowers mutates user scope silently); record the upstream trigger: CC ships project-scope plugin installs → the manifest switches to it (dissolves most of class 3) | — |
| D-C5 binding carrier | ratified 2026-08-18 | one «Skill routing ownership» section in the shipped `AGENTS.md.template` — the map of factory-shipped surfaces only (consumer's own skills are their Layer-2 territory); the only channel reaching non-CC harnesses. Per-skill binding lines are the ESCALATION, added on a measured collision | wrong if a measured collision lands in a specific shipped skill → add the per-skill binding there (the escalation firing is the falsifier resolving, not the map failing) |
| D-C6 aif container | ratified 2026-08-18 | the consumer's factory-profile aif container is provisioned by the factory suite and carries no consumer skills → prune at image/config build time is allowed (mirror of operator-axis §5.6); the host cache stays untouchable | — |
| D-C7 retroactive census | ratified 2026-08-18 (session's own call, surfaced to operator, unopposed) | superpowers — the only satellite shipping today — passes the D-C2 gate retroactively; grandfathering it would leave the one real satellite outside the contract and turn the principle test RED on its row from day one | — |
| D-C8 round-3 mandate | **ratified 2026-08-18 (P-C3)** | before ANY build item routes out: a fresh-session top-down creative re-examination of the WHOLE harmonization design (operator axis + consumer axis), collisions first, asking the KPD question — is every mechanism buying its cost, is there a simpler/cheaper design with the same result? D-C1..D-C7 stand recorded but re-openable; §2 cold review and §3 exit routing deferred behind it | round 3 confirms the design as-is → cold review runs on this spec unchanged; round 3 finds a simpler mechanism → this register is amended with dispositions |

## §5 Mechanism architecture (recorded for round 3, not routed)

The Q1+Q2 join: the **admission gate produces machine-readable census metadata** next to
the manifest row (which satellite skills are model-invocable, which triggers are broad,
known doctrine conflicts). The **install-time scanner** in `./setup` inventories the
consumer's local skill surfaces (project `.claude/skills/`, personal `~/.claude/skills/`,
other plugin caches) and JOINS them against that metadata, printing a report plus
prescribe-remediation commands. Detection is strictly deterministic — name-level matches
and factory-declared collision classes; no fuzzy trigger-keyword semantics (two measured
precedents in this repo rejected fuzzy detectors at 13% and 38% precision:
[dual-implementation-discipline.md §8](../../../.claude/rules/dual-implementation-discipline.md)
and the fences detector, operator-axis memory). Non-CC harness degrade: the D-C5
AGENTS.md section is the prose channel; the scanner is CC-cache-shaped and skips cleanly
when no cache exists.

## §6 Fact register (all verified this session, 2026-08-18)

- **F-C1** — superpowers ships to consumers machine-globally: `setup.d/companions.manifest`
  row `claude plugin install superpowers@claude-plugins-official --scope user`; detect-first,
  per-companion y/N consent (`setup.d/engine.sh:52-56`).
- **F-C2** — the ⚠ «machine-scope … persists across all projects» disclosure prints for
  `kind=mcp` only (`setup.d/engine.sh:60-62`); cc-plugin rows print none.
- **F-C3** — no per-project plugin scoping; `skillOverrides` excludes plugin skills
  (operator-axis P6, skills.md fetch 2026-08-18).
- **F-C4** — verbatim-trigger misroutes measured 3/3 (operator-axis P2a-c).
- **F-C5** — no consumer-telemetry channel exists: nothing in the shipped surface reports
  routing incidents back to the factory (negative claim scoped to this repo's shipped
  artifacts; checked `setup`, `setup.d/`, `packages/core/templates/` this session).
- **F-C6** — shipped artifacts already reference superpowers: `packages/core/templates/shared/tier-home.md:81`
  (SDD + degradation row), `agents/fidelity-auditor.md:20`, `agents/capability-reuse-auditor.md:34`,
  `agents/manual-rule-liveness-prober.md:121` — the degrade discipline already governs absence.

## §7 Testing seams (D-H14, self-applied; all deferred behind D-C8)

Named seams: (1) the D-C2 principle test — RED on a manifest row without its census
artifact, GREEN with it (paired negative at build time); (2) the scanner — verified by a
fixture inventory join (known local skill set × known metadata → expected report), plus
one live run on the operator machine; (3) the ⚠ parity line — one-line engine.sh change,
verified by the existing setup snapshot lane. Open verification item (recorded, unspent):
the claim that a foreign plugin cache can be inventoried deterministically
(`disable-model-invocation` frontmatter parse across `~/.claude/plugins/cache/**`) is
DESIGN-ASSUMED, not yet probed — first build task of the scanner, before anything else.

## §8 Routed work inventory — DEFERRED

Held behind D-C8 (round 3). The pre-sorted candidates, valid only if round 3 confirms:
factory umbrella «consumer-satellite-contract» (scanner + superpowers census metadata +
principle test + ⚠ parity + AGENTS.md section); SSOT rows (contract + host-prune REJECT).

## §9 Changelog

- 2026-08-18 — v1 recorded at interview close (rounds: frontier ×3, one dismissed
  card honored as pause). Cold review not dispatched; round-3 mandate (D-C8) supersedes
  the immediate §2 step.
