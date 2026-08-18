# Consumer-axis satellite harmonization — design (D-H18 contour, round 2)

> **Status:** RECORDED 2026-08-18 — interview complete (frontier empty), decisions D-C1..D-C7
> ratified in dialogue; §2 cold two-altitude review **NOT dispatched** — superseded by the
> operator-mandated round-3 creative re-examination (D-C8, P-C3). Exit routing was
> deferred to round 3 — now executed, see the v2 line. Companion handoff: [2026-08-18-harmonization-round3-handoff.md](2026-08-18-harmonization-round3-handoff.md).
> **v2 2026-08-18 — round 3 EXECUTED:** D-C1 re-cut to the thin form (static census
> prose + known-pair presence check; the inventory-join engine NOT built); D-C9 added
> (fourth-stack admission boundary); dispositions in §9.
> **Authoritative for:** the consumer-axis collision contract — §3 three-class collision
> model, §4 decision register D-C1..D-C9, §5 mechanism architecture, §6 fact register,
> §7 testing seams.
> **NOT authoritative for:** the operator axis — see
> [2026-08-18-skill-stack-harmonization-design.md](2026-08-18-skill-stack-harmonization-design.md)
> (merged into this branch at `3ae6981833`, round 3); consumer authority
> layers — [INSTALL-FOR-AI.md «Three-layer authority»](../../../INSTALL-FOR-AI.md); shipped-artefact
> degrade — [dual-implementation-discipline.md §3](../../../.claude/rules/dual-implementation-discipline.md);
> project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).

> **Origin:** `/arch` contour 2026-08-18, opened by the D-H18 chip (operator-axis spec §8
> item 6, premise P-7). §1.5 research contour skipped EXPLICITLY: the routing-mechanics
> domain is covered by operator-axis probes P1/P2a-c/P6; the consumer-delivery surface is
> this repo's own code, verified by direct reads this session (§6).

## §1 Goal and scope

A contract for how factory-shipped satellite skill stacks (superpowers + ast-grep today
via the `./setup` companions flow — TWO `cc-plugin` rows, population corrected R1
TD-B1; grilling/mattpocock-skills candidates later) coexist with the
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
| 2 | satellite × consumer's own skills | only on the consumer machine | AGENTS.md prose + prescriptions (D-C1 thin form); machine-specific detection covers KNOWN pairs only — the own-skills half is prose-only with unobservable escalation, recorded limit (R1 TD-M5; the P8 hook candidate would close it if adopted) |
| 3 | satellite × consumer's OTHER projects (machine-global blast radius) | nowhere in advance | informed consent (⚠ parity, D-C4) + upstream scoping trigger |

## §4 Decision register

| Decision | Status | Resolution | Falsifier |
| --- | --- | --- | --- |
| D-C1 mechanism | ratified 2026-08-18 (P-C1); **form re-cut round 3 (D-C8)** | **detect + declare + prescribe, thin form**: the factory-declared collision classes + remediation recipes are CONSTANT across consumers → ship as **static census prose** in the D-C5 AGENTS.md section; the machine-specific half reduces to a **known-pair presence check** in `./setup` (~20 lines, manifest-driven: detect known colliding plugin caches present on THAT machine → print the factory's measured resolution per pair); only the consumer executes; the factory never mutates the consumer host cache. The general inventory-join engine NOT built: minus fuzzy, its only extra signal is name-clash detection with a thin harm model (F-C3/P1: plugin skills namespaced, `/tdd` resolves to the project skill, precedence undocumented). Shipped static prune stays REJECTED as primary (blind list, T18) | wrong if a live consumer misroute shows static prose + presence check insufficient → build the inventory-join (recorded escalation); reports unread → consent-gated prune |
| D-C2 admission gate | ratified 2026-08-18 | a NEW satellite row in `setup.d/companions.manifest` requires a census artifact: trigger-collision census vs the shipped skill set + capability-ownership row (D-H1 projection) + non-CC degrade path; presence enforced by a principle test on the manifest (class-1 collisions die at factory CI) | wrong if the census artifact rots into `#discipline-theatre` (form present, census stale) → add freshness bar |
| D-C3 build timing | ratified 2026-08-18 (P-C2, operator override of the session's «wait» recommendation — conceded on the merits); **falsifier FIRED round 3 — form superseded, timing kept** | build NOW stands (the incident channel still does not exist, P-C2 logic intact); round 3 re-cut only the FORM: the thin D-C1 mechanism ships now instead of the inventory-join scanner | — (falsifier resolved 2026-08-18: round 3 found the cheaper same-result form) |
| D-C4 consent disclosure | ratified 2026-08-18 | extend the ⚠ machine-scope warning to `kind=cc-plugin` consent (today mcp-only, `setup.d/engine.sh:60-62` — superpowers mutates user scope silently); record the upstream trigger: CC ships project-scope plugin installs → the manifest switches to it (dissolves most of class 3) | — |
| D-C5 binding carrier | ratified 2026-08-18; carrier-reach note R1 (TD-MINOR-3) | one «Skill routing ownership» section in the shipped `AGENTS.md.template` — the map of factory-shipped surfaces only (consumer's own skills are their Layer-2 territory); the only channel reaching non-CC harnesses. Reach limit recorded: AGENTS.md is NOT CC-injected (CC injects CLAUDE.md — measured this session), so on CC consumers the section is read-on-demand, not always-in-context. Per-skill binding lines are the ESCALATION, added on a measured collision | wrong if a measured collision lands in a specific shipped skill → add the per-skill binding there (the escalation firing is the falsifier resolving, not the map failing) |
| D-C6 aif container | ratified 2026-08-18; aligned R1 (TD-MINOR-2) | the consumer's factory-profile aif container mounts the host plugin cache read-only (operator-axis §5.6, measured round-2 there) — the container sees whatever the host carries; no container-side cache-mutation channel exists, and the host cache stays untouchable by the factory | — |
| D-C7 retroactive census | ratified 2026-08-18 (session's own call, surfaced to operator, unopposed); **widened R1 (TD-B1)** | the retro-census obligation covers BOTH shipped rows — superpowers AND ast-grep (its row predates the gate too; the v1 «only satellite» premise was a population error). Grandfathering either would leave a real satellite outside the contract and turn the principle test RED on its row from day one. Whether ast-grep ships at all = ESC-1 operator fork | — |
| D-C8 round-3 mandate | **EXECUTED 2026-08-18** | round 3 ran as mandated (fresh top-tier session, membrane phase order per the companion handoff): Phase A produced 5 alternative shapes cold, Phase B collided them with both fact registers, Phase C ratified with the operator. Outcome: the second falsifier branch fired — both registers amended with dispositions (this spec §9 v2; operator-axis spec §9 v4) — and the cold reviews follow the amendments | — (spent) |
| D-C9 fourth-stack admission boundary | **NEW round 3 (2026-08-18)** | the collision population is the INSTALLED/SHIPPED stacks only. The knowledge-work trio ([SSOT #235](../../meta-factory/prior-art-evaluations.md): ADOPT-operator + KEEP NARROW-shipped, 0/26 direct problem-class matches) is NOT re-examined — not installed, zero routing surface (operator cache holds only `ast-grep-marketplace`/`mattpocock`/`superpowers-dev`, verified 2026-08-18). Any fourth stack enters through the existing contract: D-H17 map criteria BEFORE install (operator axis) + the D-C2 census gate BEFORE a manifest row (consumer axis) | wrong if a stack reaches install/manifest without its D-H1 rows / census artifact → the gate rotted; add the missing principle-test arm |

## §5 Mechanism architecture (thin form — round 3)

The Q1+Q2 join, thin form (round 3): the **admission gate (D-C2) produces the census** —
which satellite skills are model-invocable, which triggers are broad, known doctrine
conflicts and measured collision PAIRS. Because that census is factory-knowable and
CONSTANT across consumers, it ships as **static prose** in the D-C5 AGENTS.md section
(plus the install report), not as machine-readable metadata for a local join. The only
machine-specific signal worth computing locally is **known-pair presence**: `./setup`
checks which known colliding plugins are installed AND enabled on THAT machine
(`installed_plugins.json` + `enabledPlugins` — the cache alone over-counts: a
cached-but-disabled plugin does not route, measured live with ast-grep; R1 TD-MINOR-1)
(~20 lines, manifest-driven) and prints the factory's measured resolution for each present pair —
prescribe-remediation commands the consumer runs or ignores (P-C1 preserved). Detection
stays strictly deterministic — plugin presence + factory-declared classes; no fuzzy
trigger-keyword semantics (two measured precedents in this repo rejected fuzzy detectors
at 13% and 38% precision:
[dual-implementation-discipline.md §8](../../../.claude/rules/dual-implementation-discipline.md)
and the fences detector, operator-axis memory), and the name-clash inventory-join is
explicitly NOT built (thin harm model, F-C3/P1; escalation recorded in D-C1). Non-CC
harness degrade: the D-C5 AGENTS.md section is the prose channel; the presence check is
CC-cache-shaped and skips cleanly when no cache exists.

## §6 Fact register (all verified this session, 2026-08-18)

- **F-C1 (corrected R1 — the v1 population was wrong, TD-B1)** — TWO satellites ship
  machine-globally via `setup.d/companions.manifest`: `:17`
  `superpowers@claude-plugins-official` and `:21` `ast-grep@ast-grep-marketplace` (both
  `kind=cc-plugin`, `--scope user`, all stacks; ast-grep's skill is model-invocable
  while DISABLED on the operator's own machine — `enabledPlugins` false); detect-first,
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

## §7 Testing seams (D-H14, self-applied; re-cut round 3)

Named seams (thin form, round 3): (1) the D-C2 principle test — RED on a manifest row
without its census artifact, GREEN with it (paired negative at build time); (2) the
presence check — verified by a fixture `installed_plugins.json`/`enabledPlugins`
carrying a known colliding plugin → expected pair-recipe in the report (the fixture
keys on the install registry, not cache dirs — R1 TD-MINOR-1), plus one live run on the
operator machine; (3) the
⚠ parity line — one-line engine.sh change, verified by the existing setup snapshot lane.
The v1 open item (deterministic `disable-model-invocation` frontmatter inventory across
a foreign cache) DISSOLVED with the inventory-join: presence detection needs directory
names only, no frontmatter parse.

## §8 Routed work inventory (round 3 executed)

Round 3 executed — candidates re-cut to the thin form: factory umbrella
«consumer-satellite-contract» = the D-C5 AGENTS.md «Skill routing ownership» section
carrying the static census prose (superpowers retro-census per D-C7) + the ~20-line
known-pair presence check in `./setup` + the D-C2 principle test + the ⚠ parity line
(D-C4); SSOT rows (contract + host-prune REJECT). The inventory-join scanner and
machine-readable census metadata are OUT (D-C1 thin form; escalation path recorded).

## §9 Changelog

- 2026-08-18 — v1 recorded at interview close (rounds: frontier ×3, one dismissed
  card honored as pause). Cold review not dispatched; round-3 mandate (D-C8) supersedes
  the immediate §2 step.
- 2026-08-18 — v2: **harmonization round 3 (D-C8 executed; operator-ratified live).**
  Dispositions: **D-C1 FIXED** (thin form — static census prose + known-pair presence
  check; inventory-join NOT built: minus fuzzy its deterministic detection surface is
  name-clash only, thin harm model per F-C3/P1); **D-C3 falsifier RESOLVED** (cheaper
  same-result form found; build-now timing kept — P-C2 logic intact); **D-C9 ADDED**
  (fourth-stack admission boundary — knowledge-work trio SSOT #235 stays out of the
  population, not installed); **D-C2/D-C4/D-C5/D-C6/D-C7 CONFIRMED** as recorded.
  §5/§7/§8 re-cut accordingly. Operator-axis dispositions:
  [round-1 spec](2026-08-18-skill-stack-harmonization-design.md) §9 v4. First cold
  two-altitude review of this spec: recorded below on completion.
- 2026-08-18 — v2.1: round-3 review R1 dispositions (cold two-altitude, both seats
  REVISE; reports in session scratchpad). **TD-B1** (BLOCKER) FIXED (facts) +
  ESCALATED (verdict) — the shipped population was wrong: `companions.manifest:21`
  ships a SECOND `cc-plugin` row (`ast-grep@ast-grep-marketplace`, `--scope user`, all
  stacks), model-invocable while disabled on the operator's own machine. F-C1 / D-C7 /
  §1 corrected to the two-row population; whether ast-grep ships at all + its
  retro-census = ESC-1 operator fork. **TD-M5** (MAJOR) ACCEPTED as recorded limit —
  class 2's machine-specific mechanism covers KNOWN pairs only; the own-skills half is
  prose-only with unobservable escalation (§3 row annotated; the P8 hook candidate
  would close it if adopted). **TD-MINOR-1** FIXED — presence check keys on
  `installed_plugins.json`/`enabledPlugins`, not cache dirs. **TD-MINOR-2** FIXED —
  D-C6 aligned with the measured read-only host-cache mount. **TD-MINOR-3** FIXED —
  D-C5 carrier-reach limit recorded (AGENTS.md not CC-injected). Stale deferral
  markers + the «unmerged» label corrected (BU-m2/TD-MINOR-6).
