# Three-stack skill harmonization — design (ours × superpowers × mattpocock-skills)

> **Status:** REVIEWED — GO 2026-08-18 (§2 cold two-altitude review, 3 rounds, both
> seats GO on the round-3 delta; dispositions in §9); §3 exit routing executed — see
> the companion handoff
> [2026-08-18-skill-harmonization-handoff.md](2026-08-18-skill-harmonization-handoff.md).
> **v4 2026-08-18 — harmonization round 3 (cross-axis re-examination, D-C8):** D-H15's
> prune apparatus SUPERSEDED by the injected-context binding channel (§5.1 rewritten);
> dispositions + targeted-delta re-review record in the §9 v4 entry.
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
an explicit mechanism — binding paragraph, REFERENCE, or REJECT (cache prune demoted to an
escalation step, round 3). Collision death is **preventive where a mechanical channel is
reachable** — the §5.2 principle test — **injected-context-bound where none exists** (§5.1
bindings: P1 shows NO mechanical routing channel exists at all, so the injected layer is
the earliest reachable one), and **counter-armed (D-H7) where a collision is deliberately
left binding-free** (D-H17); the lanes are declared per mechanism in §5, not blended
(restated round-1, TD-F1). The F7 **selective radius** survives as the *binding* radius:
the machine-global carrier (`~/.claude/CLAUDE.md`) only for machine-globally justified
collisions; repo-specific collisions stay counter-armed. Scope: operator-axis only; nothing here ships to consumers
(`packages/core/templates/**` untouched; the [dual-implementation degrade](../../../.claude/rules/dual-implementation-discipline.md)
rule stands). Consumer-axis satellite shipping is a SEPARATE contour — P-7/D-H18.

## §2 Operator-premise register

Verbatim-faithful to meaning in context (advisor-pattern §7/§8 obligation); transfer by
copy-or-pointer, never paraphrase.

- **P-1** (2026-08-18): «не соглашайся со мной и не уступай мне, мы обсуждаем и цель наша
  сделать как лучше, а не понравится друг-другу» — disagreement is a duty; every verdict
  in §4 stands on argued substance, not concession. Applied: D-H2 (TDD) and D-H11
  (glossary) were re-argued on the merits after operator pushback; D-H5 was **conceded on
  the merits** (the operator's reuse push exposed an over-designed column); D-H15's radius
  was narrowed round-1 the same way (F7 — the operator's other-projects argument won on
  substance).
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
- **P-7** (2026-08-18, F7 follow-up): «ну мы же в итоге поставлять будем консьюмерам а
  значит будет шипится везде и будет коллизия если мы грилл ми делаем тоже спутником …
  прям под отдельную проработку задизайним решение толковое» — when the factory ships
  satellite skill stacks to consumers (superpowers today via the `./setup` companions
  flow; grilling/mattpocock candidates later), the same routing collisions ship with
  them, and per-project plugin scoping does not exist (P6). Adopted: consumer-axis
  harmonization is its OWN design contour (D-H18, chip emitted); this spec stays
  operator-axis.

## §3 Ratified capability-ownership map (D-H1)

Amended from prep-doc §4 by the interview. Mechanisms: **bind** = binding paragraph in our
wrapper (prep §3 mech 1); **prune** = cache prune list (§5.1); **REFERENCE** = consulted,
never routed-to by contract; **REJECT** = recorded in SSOT.

| Area | Owner | Subordinated / consumed | Mechanism |
| --- | --- | --- | --- |
| Interview pacing | Matt `grilling` | SP brainstorming one-question rule yields | `/arch` §1 binding (shipped 2026-08-17); grilling misroutes covered by the D-H7 counter |
| Ideation pipeline | SP `brainstorming` | — | settled (SSOT #64) |
| In-session execution | SP `SDD` + `writing-plans` | Matt `implement` (15-line stub) | REJECT; slash-only, no prune needed |
| TDD loop | SP `test-driven-development` | Matt `tdd` → transfers (a)/(b) (§4 D-H2; (c) dissolved round-1) | §5.1 binding #1 + D-H14 seams slot (prune → D-H8 escalation ladder, round 3) |
| Debugging entry | Matt `diagnosing-bugs` | SP `systematic-debugging` → REFERENCE | none needed (0 hard refs; P2c router already picks Matt) |
| Code-review verdict + severity | ours ([reviewer-discipline.md §6](../../../.claude/rules/reviewer-discipline.md)) | Matt severity-less model | REJECT |
| Code-review structure | ours `/arch` §2 + `agents/fidelity-auditor.md` | Matt `code-review` (no-rerank sentence already transferred, D-H4) | cache-resident, D-H7 counter armed (radius F7: collision is repo-specific; first live misroute → prune/vendor escalation) |
| Merge-conflict handling | ours [git-conflict-merge-forward.md](../../../.claude/rules/git-conflict-merge-forward.md) | Matt `resolving-merge-conflicts` (advises rebase continuation; force-push is classifier-blocked for agents machine-wide) | §5.1 binding #2 (machine-global carrier) — **collision found this session**; the T18 local-walkthrough residue DISSOLVED round 3 (skill stays invocable by name) |
| Deep-module vocabulary | ours: seams slot (§5.5) + CONTEXT.md pointer rule (§5.2) | Matt `codebase-design` (claims seams + glossary-exactness vocabulary; no ADOPTED skill invokes it — measured round-1) | REFERENCE, cache-resident; D-H7 counter armed (D-H17) |
| Throwaway prototyping | Matt `prototype` — KEEP | — | wayfinder `prototype` tickets invoke it — mirror of the `research` row (D-H17) |
| Factory orchestration | ours (`pipeline`/`dispatcher`/`orchestrator`) | claim doctrine §5.3; Blocked-by edges §5.4 | build items routed §8 |
| Multi-session design maps | Matt `wayfinder` — ADOPT verbatim | our ad-hoc handoff briefs (design contours only) | setup once; slash-only, zero routing risk |
| Glossary / domain modeling | Matt `domain-modeling` + `CONTEXT.md` — ADOPT | ADR directory | pointer rule + principle test §5.2; ADR dir REJECT (specs/research-patches cover it) |
| Skill authoring | ours `/ai-doc` (standard) + SP `writing-skills` (process) | Matt `writing-for-agents` | REFERENCE; one ownership note in `/ai-doc` |
| Human-only procedures | Matt `wizard` — ADOPT | — | first use = §5.1 prune wizard (D-H6) |
| Continuity / handoff | ours (seat-lifecycle + session-bus) | Matt `handoff` | REFERENCE |
| Research | ours (`/arch` §1.5 contour) | Matt `research` | KEEP in cache — wayfinder `research` tickets invoke it (wayfinder/SKILL.md:77) |

## §4 Decision register (final; grown live during the interview per `/arch` §1 D4)

| Decision | Status | Resolution | Falsifier |
| --- | --- | --- | --- |
| D-H0 grilling adoption | answered 2026-08-17 | ADOPT via plugin; `/arch` §1 binding | SSOT #253 triggers |
| D-H1 ownership map | **ratified 2026-08-18** | §3 table | wrong if a live misroute lands despite the §5.1 bindings → D-H8 ladder (neutering → prune → vendor + uninstall) |
| D-H2 TDD conflict | answered 2026-08-18 | SP owns the loop — its text is armor against agent-laziness rationalizations (our threat model: verify-RED/GREEN mandatory, 11-excuse table), Matt's 38-line text is a solo-dev reference. Refactor-placement conflict largely dissolves for us: SDD's per-task review IS the review stage Matt relocates refactoring to — we keep both lines. **Transfers from Matt:** (a) seams-first → D-H14; (b) tautological-test anti-pattern → REFERENCE for `/rule-tests`; (c) horizontal-slicing/tracer-bullet → **dissolved round-1** (B-M4: `/vitest` is a personal command of another project, not a repo artifact — no repo-side surface exists to carry the note) | wrong if our PR corpus shows refactoring debt passing through SDD per-task review (then revisit placement) |
| D-H3 debugging | answered 2026-08-18 | Matt `diagnosing-bugs` owns the entry (0 hard refs to SP's from us or inside SP — measured prep §1.5; router picks it anyway, P2c); SP `systematic-debugging` → REFERENCE | wrong if an executor incident shows the SP rationalization armor was needed mid-debug → flip back |
| D-H4 no-rerank | answered 2026-08-17 | landed `09569a30ab` (`/arch` SKILL.md:89) | as recorded in prep |
| D-H5 claim-first | answered 2026-08-18; mechanics specified round-1 (TD-F5, B-M1/M2) | Two populations, two EXISTING registries: design tickets → wayfinder assignee-claim (native); factory stages → **aif claim task created BEFORE the Phase -1 window** — claim = `paused:true` task (no lane occupied), unpause only on Phase -1 GO, DELETE on RED; real machinery + probe widening + orphan expiry in §5.3. state.md stays the journal; no `Claimed-by:` column (over-design, withdrawn under P-1) | wrong if the widened probe cannot see the claim from every dispatch entry point (P4, restored), or a collision recurs with the claim in place → medium insufficient, revisit (GH issues) |
| D-H6 wizard first use | re-targeted round 3 | the prune wizard DISSOLVED with the prune (§5.1 bindings need no cache hands); first `wizard` use lands on the next human-only procedure that appears | — |
| D-H7 incident counter | **ARMED 2026-08-18** | counter arm + observation №0 APPENDED to SSOT #253 (same commit as spec v3; round-2 caught «armed» being claimed before the append existed — B-R2/TD-R2) | 1st real misroute → incident №1, dated note on #253 |
| D-H8 plugin fate | answered 2026-08-18; ladder re-cut round 3 | keep + §5.1 bindings (F7 radius now selects the binding carrier, not a prune list) + counter arms routed (§8 item 5). Escalation ladder per collision: 1st live misroute → frontmatter neutering `disable-model-invocation: true` in the cache (operator hands; mechanical absence from the listing, skill stays invocable by name) → cache prune → vendor keepers + uninstall | ≥3 real misroute incidents → vendor keepers + uninstall |
| D-H9 orchestrator rewrite | ratified | thin 512-line skill to deltas+bindings (the `/arch` model); factory umbrella (§8) | wrong if re-described slices turn out load-bearing (rewrite reviewer checks) |
| D-H10 TDD bare-acronym hazard | **RE-OPENED + FIXED round 3** (the prune that dissolved it is superseded; Matt's `tdd` stays cache-resident) | the recorded fallback is now primary: the `meta-kickoff.template.md` binding line names `superpowers:test-driven-development` explicitly for dispatched Workers, and the repo-CLAUDE.md binding covers every in-repo session incl. container executors (the checkout carries CLAUDE.md) | wrong if P7 shows the bindings do not steer the router → D-H8 ladder |
| D-H11 domain-modeling pairing | answered 2026-08-18 | ADOPT skill + CONTEXT.md as-is (generation REJECTED on the merits: glossary is authored, not derived; the skill's value is live inline challenge-and-write). Our delta = pointer rule + principle test (§5.3). ADR dir REJECT | wrong if entries duplicate owner-doc definitions despite the rule → degrade CONTEXT.md to a generated pointer index |
| D-H12 wayfinder | answered 2026-08-18 | ADOPT verbatim; run `/setup-matt-pocock-skills` once; tracker = local-markdown first (upstream default when unconfigured, wayfinder/SKILL.md:25); GH issues revisited if collaboration appears | wrong if design maps stay ≤2 sessions in practice |
| D-H13 dependency frontier | ratified; spelling amended round-1 (B-M6) | standardize on the **incumbent `Depends on` column** — 14 tracked kickoffs already carry it (e.g. `arch-v2-context-pipeline/kickoff.md:91`); a second spelling (`Blocked-by:`) for the same edge would be the exact #parallel-evolution-creep this spec kills. `/pipeline` computes the dispatchable frontier mechanically; expand–contract + fog-of-war vocabulary into `meta-kickoff.template.md` (no `kickoff.template.md` exists) | wrong if real umbrellas are overwhelmingly linear |
| D-H14 seams slot | ratified | `Testing seams` slot in the spec-template obligation (`/arch` §1); «seams: n/a — doc artifact» is a legitimate answer; self-applied in §7 | wrong if the slot is n/a in ~all meta-factory specs for 6 months → demote to optional line |
| D-H15 prune doctrine | **SUPERSEDED 2026-08-18 (round 3, D-C8; operator-ratified in dialogue)** | the collision channel moves from the cache to the **injected-context layer** — the only layer with a proven grip on the router (P1: no mechanical per-skill disable exists; the satellites' own SessionStart injection demonstrably steers behaviour). Carriers: (1) repo `CLAUDE.md` «Skill routing bindings» section — every session in this repo, host or container; (2) `~/.claude/CLAUDE.md` — the machine-global half (the only user-scope file CC injects into every project; `~/.claude/AGENTS.md` is not a CC channel, and the repo's own AGENTS.md:1-8 declares itself off-CC-only); (3) `meta-kickoff.template.md` binding line (D-H10). DISSOLVED with the prune: script, D-H6 wizard, the `owner: 'maintainer'` pre-push `--check` section, gate P5, and the TD-F8 residue (nothing deleted — Matt's walkthrough stays invocable by name). Motive unchanged: misrouting (P2), not tokens (budget-capped, P6+fetch); total sweep stays REJECTED (SSOT #257); anthropic-skills untouched. Honest coverage gap, ACCEPTED: container sessions in OTHER projects see neither carrier — that tail stays counter-armed only (D-H7) | wrong if P7 (post-binding probe, §6) shows no steering, or a live misroute lands with the bindings in context → D-H8 ladder (neutering → prune → vendor) |
| D-H16 plugin in aif container | ratified 2026-08-18; **build item DISSOLVED round-2** | the container already mounts the operator's `~/.claude/plugins` read-only (aif-handoff local `docker-compose.override.yml`, both container-home and host-absolute paths) — mattpocock is visible to executors NOW, and the §5.1 prune/`--check` cover the container by construction (one cache). Residue: one-time verification in a container session (§5.6) | wrong if a container session's listing lacks the plugin skills → the mount premise broke, re-open |
| D-H17 map completion | **round-1 (TD-F3), per ratified criteria** | the two model-invocable skills the map missed: `codebase-design` → REFERENCE, cache-resident under the D-H7 counter (collides with D-H11/D-H14 vocabulary but is repo-locally justified only — F7 radius keeps it; no ADOPTED skill invokes it, measured); `prototype` → KEEP (wayfinder ticket dependency, mirror of `research`) | wrong if a live `codebase-design` misroute lands → escalate per D-H8 arm |
| D-H18 consumer-axis satellites | **NEW 2026-08-18 (P-7), routed out** | when satellite stacks ship to consumers, the collision problem ships too (per-project scoping absent, P6). SEPARATE design contour — chip emitted (§8 item 6); this spec deliberately does not price it | contour opens with its own prep; wrong if consumer shipping never happens (chip expires unused) |

## §5 Mechanisms

### 5.1 Routing bindings (D-H15 superseded round 3) — the injected-context channel

No mechanical channel to the router exists at all (P1: per-skill disable of plugin skills
does not exist; `skillOverrides` excludes them) — the «router» is the model reading skill
descriptions inside its context. The earliest reachable channel for routing influence is
therefore **context injection**, and the layer is proven in the field: the satellites' own
SessionStart injection (`using-superpowers`) demonstrably dominates behaviour, and
CLAUDE.md carries «OVERRIDE any default behavior» authority framing in the same context
the router reads. Round 3 moves the two machine-globally-justified collisions (F7 radius)
onto that layer:

- **Binding #1 — TDD loop:** `superpowers:test-driven-development` owns the loop (D-H2);
  «TDD» / «test-first» work invokes it by explicit name, never `mattpocock-skills:tdd`.
  Carriers: repo CLAUDE.md section + the `meta-kickoff.template.md` binding line
  (D-H10 — dispatched Workers).
- **Binding #2 — merge conflicts:** follow
  [git-conflict-merge-forward.md](../../../.claude/rules/git-conflict-merge-forward.md),
  never `mattpocock-skills:resolving-merge-conflicts` (its rebase-continuation advice
  dead-ends against the machine-wide agent force-push block). Carriers: repo CLAUDE.md +
  `~/.claude/CLAUDE.md` (machine-global — this collision exists in every project).

Cost profile vs the superseded prune: zero operator hands in the cache, no P5 liveness
gate, no `--check` drift detector (the carriers are ordinary tracked/injected files a
plugin update cannot overwrite), reversible by construction, and the TD-F8 residue
dissolves — the bound-away skills stay invocable by explicit name. What is GIVEN UP:
mechanical absence (a deleted skill cannot route; a binding is prose the router-model
follows probabilistically). That trade is priced by P7 (§6) and guarded by the D-H8
escalation ladder: 1st live misroute → `disable-model-invocation: true` frontmatter
neutering in the cache (mechanical absence from the listing, still invocable by name) →
cache prune → vendor + uninstall. Coverage: repo CLAUDE.md reaches every session in this
repo including aif-container executors (the checkout carries it); `~/.claude/CLAUDE.md`
reaches every host session in every project; container sessions in OTHER projects see
neither carrier — accepted residual under the armed D-H7 counter. Criterion for what gets
a binding is unchanged from the prune criterion (**model-invocable AND (collides with an
owned area OR contradicts a repo rule)**, F7 radius on top); `code-review` and
`codebase-design` stay binding-free under the D-H7 counter — their collisions are
repo-specific. Slash-only skills need nothing (no router presence).

### 5.2 CONTEXT.md pointer rule + principle test (D-H11)

Authoring rule: a CONTEXT.md entry for a term that already has an owner doc
([doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md)) carries a
one-line gist + link to the owner anchor, never a redefinition; new terms may live fully in
CONTEXT.md (it becomes their owner). Principle test (new slot, mold of principles 08/09):
every CONTEXT.md link resolves to an existing anchor.

### 5.3 Claim doctrine (D-H5, P-5) — real machinery, three owners (B-M1/M2)

Factory: the claim = an aif task created `paused:true` **before** the Phase -1 cold
review (claim only — a paused task occupies no lane); unpause on Phase -1 GO; `DELETE
/tasks/:id` on RED (the rollback call already exists,
`packages/runtime-bridge/src/AifHandoffBackend.ts:263`). This is NOT a prose «dispatcher
step reorder»: today create+unpause are one atomic `dispatch()`
(`AifHandoffBackend.ts:236` `paused:true` → `:260` unpause; the CLI has no create-only
mode), and Phase -1 is owned by `/pipeline` Step 3, not the dispatcher. The build item is
therefore four-part: (1) split runtime-bridge dispatch into claim-create and unpause
halves; (2) reorder `/pipeline` Step 3 around them (cancel branch on RED); (3) **widen
`probe-inflight.sh`** — its jq filter selects only `done|verified` tasks with a branch
(`probe-inflight.sh:146-147`), so a fresh paused claim is invisible to ALL five existing
signals; add a claim signal (backlog/paused task whose description carries the umbrella
slug); (4) an orphan-claim expiry branch — a claim whose session died before Phase -1
returned must surface as `STALE-CLAIM`, never eternally block the stage (the starvation
mode TD-F5 named). Closes the measured race («all historical collisions materialized
inside the Phase -1 window», CLAUDE.md pre-dispatch probe section) — but only with (3)
landed. Design contours: wayfinder's native assignee-claim. `state.md` remains the
journal — it is gitignored per-machine runtime, a record and never the claim medium; no
new status vocabulary is introduced (the «statuses legend» previously named here is the
orchestrator Queue-mode journal's, a different artifact — B-MINOR-1).

### 5.4 Dependency frontier (D-H13; spelling amended round-1, B-M6)

Kickoff stage tables standardize on the **incumbent `Depends on` column** — 14 tracked
kickoffs already carry it (e.g. `arch-v2-context-pipeline/kickoff.md:91`); a second
spelling (`Blocked-by:`) for the same edge would be the exact #parallel-evolution-creep
this spec exists to kill. `/pipeline` derives the dispatchable frontier mechanically from
that column (attention-shaped prose → checkable structure,
[attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md));
kickoffs without the column degrade safely — every not-yet-done stage is frontier.
Vocabulary (vertical-slice, expand–contract, per-umbrella fog-of-war section) lands in
`meta-kickoff.template.md` + the pipeline kickoff conventions — there is no
`kickoff.template.md` to amend (B-M6 measured `.claude/skills/pipeline/templates/`).

### 5.5 Seams slot (D-H14)

The `/arch` §1 spec-template obligation gains a `Testing seams` line: seams named and
confirmed at spec time («prefer existing seams; ideal number is one»); «n/a — doc
artifact» legitimate. This also makes the seams half of Matt's tdd coherent for executors
without importing his refactor placement.

### 5.6 Satellite toolkit in aif (D-H16 — build item DISSOLVED round-2)

Measured round-2: superpowers reaches the container not by install but by **read-only
mounts of the operator's host cache** — aif-handoff's local `docker-compose.override.yml`
(agent service) mounts `~/.claude/plugins` at BOTH the container-home path and the
host-absolute path (the latter so `known_marketplaces.json` install locations resolve).
mattpocock-skills, installed in the same host cache, is therefore **already visible to
container executors**, and the §5.1 prune + `--check` cover the container by
construction — same files, one cache. D-H16 reduces to a one-time verification (confirm
the skills appear in a container session's listing), not a build. Explicit non-target
(B-M3): `setup.d/companions.manifest` — that file is the consumer-shipped `./setup` flow
(its superpowers row is how superpowers reaches CONSUMERS); adding a mattpocock row there
would silently cross the §1 operator-axis boundary. The plugin is the executor's *client*
toolkit; it is NOT the claim mechanism (that is §5.3). Consumer-axis satellite shipping
is D-H18's separate contour.

## §6 Probe register (facts; all sources dated)

- **P1** (claude-code-guide, 2026-08-17): plugin skills are namespaced — a project `tdd`
  coexists, `/tdd` typed resolves to the project skill (documented); model-routing
  precedence between them UNDOCUMENTED; **per-skill disable of plugin skills does not
  exist** — `skillOverrides` explicitly excludes plugin skills.
- **P2a/b/c** (routing probes, 2026-08-17): on bare «fix this bug test-first» / «review
  this branch» / «debug this — the test is failing» the router picked
  `mattpocock-skills:tdd` / `:code-review` / `:diagnosing-bugs` — 3/3 verbatim-trigger
  wins. Limitation: meta-probes (agents asked to name their pick), not live task runs.
- **P4** (RESTORED round-1 — it was dropped between prep and spec without a record,
  TD-F5): can the claim medium span every dispatch entry point (host branch, container
  branch, PR, live queue)? Partially answered by design: the §5.3 widened queue signal
  covers the aif path; the other probe surfaces are unchanged by the claim. Closes with
  the §5.3 build item's live RED/GREEN proof, not before.
- **P5** (MOOT round 3 — nothing to delete under the binding channel; re-arms only if
  the D-H8 ladder escalates to neutering/prune): rename
  `~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.3/skills/engineering/tdd`,
  open a fresh session, confirm the skill is absent from the listing; restore or keep.
- **P6** (claude-code-guide, 2026-08-18): no per-project plugin scoping (`enabledPlugins`
  is global-only; GitHub feature request open). Its claimed `skillOverrides` workaround
  for plugin skills was **falsified** by a direct fetch of skills.md the same day:
  «Plugin skills are not affected by `skillOverrides`.» Listing economics from the same
  fetch: budget ≈1% of context window; overflow trims least-used descriptions; per-entry
  cap 1,536 chars; slash-only skills carry no descriptions into the listing.
- **P7** (post-binding routing probes, 2026-08-18 round 3): fresh-session headless
  probes (`claude -p` from the worktree, so CLAUDE.md is read from disk) flipped BOTH
  P2-class triggers: «fix this bug test-first» → `superpowers:test-driven-development`
  (the answer cites the «Skill routing bindings» section and its ban on the competitor);
  «mid-merge conflicts» → `git-conflict-merge-forward.md` over
  `mattpocock-skills:resolving-merge-conflicts`. **2/2 steered vs the P2 3/3-misroute
  baseline.** Method finding (measured): an in-session subagent probe is INVALID for a
  binding landed mid-session — subagents inherit the parent's session-start CLAUDE.md
  snapshot (the first probe run picked Matt's `tdd` and, on diagnostic, reported the
  bindings section absent from its context). Limitation shared with P2: meta-probes,
  not live task runs; the `~/.claude/CLAUDE.md` machine-global half is validated as
  mechanism-class only (both probes ran inside this repo).

## §7 Testing seams (D-H14, self-applied)

This design is mostly doc-artifacts. Named seams: (1) the §5.2 principle test — a code
seam, red when a CONTEXT.md anchor breaks; (2) the §5.1 bindings — verified by the P7
meta-probe (routing answer with the bindings in context, §6); drift seam: none needed for
the repo carrier (tracked file); the `~/.claude/CLAUDE.md` carrier is untracked —
accepted recorded limit (operator-owned file, mirror of the round-3 container-premise
MINOR); (3)
the §5.3 claim machinery — verified by the widened probe-inflight claim signal (RED on a
live paused claim, GREEN after cancel) plus two negative branches (Phase -1 RED → task
deleted; orphan claim → `STALE-CLAIM`). Everything else: n/a — doc artifacts, guarded by
the §2 cold review (round 1 landed 2026-08-18 — §9; the earlier header said the review
was «not yet dispatched» while this section already leaned on it, recorded as a note).

## §8 Routed work inventory (input to `/arch` §3 exit routing — NOT yet routed)

1. Operator, no build (P5 + the prune run DISSOLVED round 3 — the binding channel needs
   no cache hands; P5 re-arms only on D-H8 escalation): one-time verification that
   plugin skills list inside a container session (§5.6 — the install item dissolved
   round-2, the mount already delivers them); ratify the `~/.claude/CLAUDE.md` «Skill
   routing bindings» section written in-session round 3 (operator-approved live in
   dialogue). **Re-bucketed round-1
   (TD-F4):** `/setup-matt-pocock-skills` is
   NOT «no build» — its process explores/writes `AGENTS.md` (gate-bearing: every claim
   carries a live-fired enforcement status), `CLAUDE.md` (agent-read-only per the
   Artifact Ownership Contract) and `docs/adr/` (D-H11 REJECT). Run it as an ATTENDED
   session with explicit constraints — no `## Agent skills` section in
   AGENTS.md/CLAUDE.md, no ADR scaffolding, local-markdown tracker only — and review the
   diff before committing.
2. Small in-session edits: `/arch` §1 seams slot (§5.5); `/ai-doc` ownership note (§3);
   REFERENCE note in `/rule-tests` (D-H2 transfer (b); transfer (c) dissolved — B-M4).
3. Factory umbrella «skill-harmonization-mechanisms» (the §5.1 script/`--check`/wizard
   items DISSOLVED round 3 — the bindings landed in-session instead): §5.2 principle
   test (non-duplicate verified round-1: the lychee gate
   runs without `--include-fragments`, so anchors are unchecked today); §5.3 four-part
   claim machinery (runtime-bridge split, `/pipeline` Step 3 reorder, probe claim signal,
   orphan expiry); §5.4 pipeline frontier on `Depends on` + `meta-kickoff.template.md`
   vocabulary. Each build item passes the kickoff-time prior-art consult
   (EXECUTION-PLAN §5.5 Step 1.5 — TD-F9).
4. Separate factory umbrella: D-H9 orchestrator rewrite (deltas+bindings).
5. SSOT entries: **DONE 2026-08-18 in-session** — REJECT rows #254-257 (Matt `implement`,
   ADR directory, severity-less review model, total-sweep pruning) + the D-H7/D-H8
   counter arm appended to #253 (same commit as spec v3; closes B-M5 and the round-2
   «armed before the append» catch).
6. Separate design contour (P-7/D-H18, chip emitted 2026-08-18): consumer-axis satellite
   harmonization — how shipped satellite stacks and consumer-side skill collisions
   coexist when per-project plugin scoping does not exist.

## §9 Changelog

- 2026-08-18 — v1 written at interview close.
- 2026-08-18 — v2: §2 cold two-altitude review round 1 (both seats REVISE; reports
  `top-down-…`/`bottom-up-…-skill-harmonization.md`, session scratchpad). Dispositions:
  - **TD-F1** (MAJOR) FIXED — §1 restated: two declared lanes (mechanical channel vs
    armed counter), per-mechanism channels named in §5.
  - **TD-F2** (MAJOR) ACCEPTED — absorbed as the §5.1 `--check` pre-push drift detector +
    container install-time prune + narrated prep-verdict overturn.
  - **TD-F3** (MAJOR) FIXED — D-H17: `codebase-design` + `prototype` rows added; map now
    covers all 11 model-invocable skills.
  - **TD-F4** (MAJOR) FIXED — §8 item 1 re-bucketed: setup run is attended + constrained,
    never «no build».
  - **TD-F5** (MAJOR) FIXED — D-H5 mechanics specified (paused claim, GO/RED branches,
    orphan expiry); P4 restored to §6; pre-ship falsifier restored.
  - **TD-F6** (MAJOR) ACCEPTED — mechanism 7 (project shadow) now explicitly evaluated:
    rejected as primary (routing precedence between project and plugin skill is
    UNDOCUMENTED — P1 — and it adds a routable surface); stays D-H10's recorded fallback.
  - **TD-F7** (ESCALATED) — answered by the operator 2026-08-18: selective radius
    (prune 2, not 4); P-7 recorded; consumer axis routed out (D-H18).
  - **TD-F8** (MINOR) ACCEPTED — prune #2 residue recorded in §5.1 (local-merge class
    accepted uncovered).
  - **TD-F9** (MINOR) ACCEPTED — kickoff-time prior-art consult named in §8 item 3;
    §5.2 non-duplication verified (lychee runs without fragments).
  - **B-M1** (MAJOR) FIXED — §5.3 names the probe blindness (`probe-inflight.sh:146-147`)
    and the claim-signal widening as build part (3).
  - **B-M2** (MAJOR) FIXED — «dispatcher reorder» rescoped to the real three-owner
    machinery (runtime-bridge split + `/pipeline` Step 3 + dispatcher probe).
  - **B-M3** (MAJOR) FIXED — §5.6 names the explicit non-target
    (`setup.d/companions.manifest` is consumer-shipped).
  - **B-M4** (MAJOR) FIXED — D-H2 transfer (c) dissolved; `/vitest` removed from §8
    (personal command of another project).
  - **B-M5** (MAJOR) FIXED — D-H7/D-H8 statuses corrected: the #253 counter arm is a
    pending append at contour close, not an existing surface.
  - **B-M6** (MAJOR) FIXED — D-H13/§5.4 standardize on the incumbent `Depends on`
    spelling; `meta-kickoff.template.md` named as the real template target.
  - **B-MINOR-1** FIXED — «statuses legend» mislocation corrected in §5.3.
  - **B-MINOR-2** FIXED — 39 → 38 lines (D-H2).
  - Notes lane: §5.2/§5.3 cross-ref corrected in §3 (was pointing the pointer rule at the
    claim doctrine); grilling counter-coverage line added to §3; §7's early reliance on a
    not-yet-run review recorded there; prep §4.5 THIN-verdict transfer is lossy by
    design — only D-H9/D-H13 carried forward, the rest closed with the prep (deliberate,
    now recorded).
- 2026-08-18 — v3: round 2 (both seats REVISE on v1→v2 delta; all round-1 closures
  confirmed at both altitudes). Dispositions:
  - **TD-R2-1 / B-R2-1** (MAJOR, convergent) FIXED — the `--check` channel corrected:
    `.husky/pre-push` is an `exec` dispatcher with no sections, and
    `packages/core/hooks/pre-push.ts` ships to consumers (install.sh Core-hooks block);
    the section lands as `owner: 'maintainer'` in the pre-push section registry, which
    never composes maintainer sections on a consumer layout (fail-closed) — §5.1, D-H15.
  - **B-R2-2** (MAJOR) DISSOLVED — §5.6's install surface was indeed absent because none
    is needed: the container mounts the host `~/.claude/plugins` read-only (aif-handoff
    local `docker-compose.override.yml`), so the plugin is already visible and the prune
    covers the container by construction; D-H16's build item dissolved to a verification.
  - **TD-R2-2 / B-R2-3** (MAJOR, convergent) FIXED — «counter armed» made true instead of
    re-worded: the D-H7/D-H8 arm + observation №0 appended to SSOT #253 and REJECT rows
    #254-257 added, in the same commit as this entry; D-H7 status now ARMED with the
    append as evidence.
- 2026-08-18 — round 3 (targeted delta): **both seats GO.** Top-down verified the
  maintainer-section leak-guard at source (`pre-push.ts:1674-1689`) plus the CI net
  against a mis-tagged owner (`principles/32-prepush-section-owner.test.ts`); bottom-up
  verified the registry property verbatim (`pre-push.ts:679-687`), the shipping path
  (`setup.d/50-hooks.sh:27`), the container mounts
  (`docker-compose.override.yml:17,18,23`) and the SSOT append (grep now hits; rows
  #254-257 well-formed). One new MINOR, notes lane, ACCEPTED as a recorded limit: the
  container premise rests on an UNTRACKED local `docker-compose.override.yml` in the
  aif-handoff repo — one-time verification only; already covered by D-H16's falsifier
  (empty container listing → re-open). Contour proceeds to §3 exit routing.
- 2026-08-18 — v4: **harmonization round 3 — cross-axis creative re-examination (D-C8,
  operator-mandated P-C3; decisions ratified live in dialogue).** The question asked at
  the top: is every collision mechanism buying its cost? Dispositions:
  - **R3-1 — D-H15 SUPERSEDED:** the prune apparatus (script + D-H6 wizard +
    `owner: 'maintainer'` pre-push `--check` section + gate P5) DISSOLVED; replaced by
    the §5.1 injected-context bindings (repo CLAUDE.md + `~/.claude/CLAUDE.md` +
    `meta-kickoff.template.md` line). Grounds: P1 — no mechanical routing channel
    exists, so injection is the earliest reachable one, and the satellites' own
    SessionStart injection proves the layer steers the router; cost — zero cache hands,
    zero drift surface, reversible; T18 — the TD-F8 walkthrough residue dissolves,
    nothing deleted. Verified by P7 (§6).
  - **R3-2 — D-H10 RE-OPENED + FIXED:** the prune that dissolved it is superseded; the
    recorded fallback (dispatch-prompt binding line) is now primary.
  - **R3-3 — D-H8 ladder re-cut:** intermediate step added — frontmatter neutering
    (`disable-model-invocation: true`; mechanical absence from the listing, skill stays
    invocable) between bindings and prune.
  - **R3-4 — fourth-stack boundary (cross-axis):** the knowledge-work trio
    ([SSOT #235](../../meta-factory/prior-art-evaluations.md)) NOT re-examined — not
    installed, zero routing surface (cache holds only `ast-grep-marketplace` /
    `mattpocock` / `superpowers-dev`, verified 2026-08-18); any fourth stack enters via
    D-H17 criteria (operator axis) + the D-C2 admission gate (consumer axis — round-2
    spec D-C9).
  - Everything else CONFIRMED as recorded (ownership map D-H1, all
    ADOPT/REFERENCE/REJECT verdicts, §5.2-§5.6, the armed D-H7 counter). Consumer-axis
    round-3 dispositions live in the
    [round-2 spec](2026-08-18-consumer-satellite-harmonization-design.md) §9 v2.
    Targeted-delta cold re-review of this v4 diff: recorded below on completion.
