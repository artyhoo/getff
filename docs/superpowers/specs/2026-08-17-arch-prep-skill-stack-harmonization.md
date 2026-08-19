# Arch-prep: three-stack skill harmonization (ours × superpowers × mattpocock-skills)

> **Status:** PREP-DOC — raw material + collision analysis for a future `/arch` design session.
> Not a spec; nothing here is ratified except the rows marked `settled`.
> **Authoritative for:** the 2026-08-17 three-stack comparison evidence — populations, the
> collision map (§2), the resolution-mechanism toolbox (§3), the raw ownership idea (§4),
> and the open decision register (§5) the design session starts from.
> **NOT authoritative for:** the grilling adoption — [SSOT #253](../../meta-factory/prior-art-evaluations.md)
> + `/arch` §1 binding (settled 2026-08-17, this branch). Project goal —
> [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Superseded on the dependency-edge spelling by:** [D-H13 / §5.4 of the ratified 2026-08-18 spec](2026-08-18-skill-stack-harmonization-design.md) — Idea 2's `Blocked-by:` column (:348, :396 — was :347/:395 before this pointer added a header line) was NOT adopted; the ratified spelling is the incumbent `Depends on` stage-table column.

> **Origin:** 2026-08-17 operator session. After lifting grill-me/grilling to ADOPT
> (SSOT #253), the operator installed the whole `mattpocock-skills` plugin and asked for a
> three-way comparison with collision resolution thinking, to be designed properly in a
> fresh `/arch` session: «адоптировать и задизайнить всё самое лучшее без коллизий».

## §1 Populations (enumerated 2026-08-17; T10)

| Stack | Where | Count | Version pin |
| --- | --- | --- | --- |
| Ours | `.claude/skills/` | 16 skills + `agents/*.md` + `.claude/rules/*` | repo HEAD |
| superpowers | `~/.claude/plugins/cache/superpowers-dev/superpowers/6.2.0/skills/` | 14 skills | 6.2.0 |
| mattpocock-skills | `~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.3/skills/` | 35 skills (18 engineering, 7 productivity, 4 misc, 6 in-progress) | 1.2.3 (MIT) |

All 35 Matt skills were read in full (2379 lines total). Superpowers read: brainstorming,
SDD, requesting/receiving-code-review, systematic-debugging, writing-plans,
dispatching-parallel-agents, verification-before-completion, writing-skills, TDD.

## §1.5 Dependency edges — what OUR machinery hard-references upstream (measured 2026-08-17)

Grep over `.claude/skills/**`, `.claude/rules/**`, `agents/**`, `CLAUDE.md`,
`packages/core/templates/**` for `superpowers:*` / `mattpocock`. **Collision decisions in
§2 must be weighted by these edges**: a misroute in a zone where our contracts NAME the
upstream skill breaks a documented contract, not just a style preference.

| Upstream skill | Our hard consumers (refs) | Matt skill in the same trigger zone | Edge-weighted risk |
| --- | --- | --- | --- |
| `superpowers:subagent-driven-development` | orchestrator (×6), night-mode (×5), claude-glm-executor-handoff (×2), `rules/seat-lifecycle.md`, **SHIPPED**: `packages/core/templates/shared/tier-home.md` | `implement` (a 15-line stub) | LOW — stub can't win routing on substance, but SDD is our single most-referenced upstream AND crosses the shipped axis |
| `superpowers:requesting-code-review` | dispatcher (×3: worker instructions), harvest (×2), `agents/fidelity-auditor.md` | `code-review` (model-invocable, same «review this» space) | **HIGHEST** — worker/harvest contracts name the SP skill; Matt's picks a different output shape (two-axis reports, no SHA template, no severity contract) → downstream expectations drift silently |
| `superpowers:brainstorming` | arch (×5), dispatcher (×5) | `grilling` | RESOLVED — the `/arch` §1 binding (D-H0) |
| `superpowers:writing-plans` | orchestrator (×3, incl. `references/discovery.md`) | `to-tickets` / `to-spec` | MEDIUM — plan-shape divergence (bite-sized tasks vs tracer-bullet tickets) |
| `superpowers:writing-skills` | ai-doc (×2) | `writing-for-agents` | LOW — layered altitudes (§2.6) |
| `superpowers:using-git-worktrees`, `executing-plans`, `verification-before-completion`, `finishing-a-development-branch`, `using-superpowers` | orchestrator (×1 each) | — | none |
| `mattpocock:grilling` | arch §1 (new, D-H0) | — | counter armed (SSOT #253) |

**Transitive closure inside superpowers** (so the design session knows the true consumed
set): SDD → requesting-code-review + finishing-a-development-branch + using-git-worktrees;
writing-plans ↔ SDD + executing-plans + using-git-worktrees; brainstorming →
writing-plans. The SP cluster we actually depend on is closed:
`{SDD, brainstorming, writing-plans, requesting-code-review, executing-plans, finishing-a-development-branch, using-git-worktrees}`.

**No hard edge from us** to: `systematic-debugging`, `receiving-code-review`,
`dispatching-parallel-agents` — routing only (grep = 0 refs across our surfaces).
**CORRECTION (DeepWiki + grep, 2026-08-17): TDD has a transitive edge, and it is
name-hazardous.** SDD's `implementer-prompt.md:36` instructs implementer subagents «Write
tests (following TDD if task says to)» — a BARE acronym, not the namespaced skill — so
with two TDD skills installed the implementer's router resolves «TDD» freely, and an
executor inside OUR night-mode/orchestrator flows could load Matt's `tdd` (whose
refactor-placement and seams doctrine contradict SP's loop). §2.2's collision is therefore
transitive-contract grade (medium-high), not routing-only; §2.4 remains the highest.

**Self-contained (zero companion refs)**: pipeline, reviewer, story, self-reflection,
rule-research, rule-tests, template-audit, tool-bootstrapping, aif-doctor, dispatcher's
non-review sections.

**Shipped-axis warning**: `tier-home.md` already ships a superpowers reference to
consumers. Never add a `mattpocock` reference to any `packages/core/templates/**` artifact
without the [dual-implementation-discipline.md §3](../../../.claude/rules/dual-implementation-discipline.md)
degrade — the grilling edge is deliberately operator-axis only (`.claude/skills/arch/` is
not shipped).

## §2 Collision map (per capability area)

Collision classes: **T** = trigger overlap (two model-invocable descriptions claim the same
work), **P** = contradictory prescription (the texts disagree on what to do), **E** =
parallel evolution (same idea, different vocabulary, no live conflict).

### 2.0 The measured routable surface + upstream composition intent (DeepWiki + live session, 2026-08-17)

**Matt's own collision policy is the user-invoked/model-invoked split** (DeepWiki on
mattpocock/skills, 2026-08-17): user-invoked skills (`disable-model-invocation: true`)
never enter the router; «a user-invoked skill may call model-invoked skills, but never
another user-invoked one». **Empirically confirmed in a live CC session** (this one): the
available-skills listing shows exactly **11** mattpocock skills — `grilling`, `tdd`,
`diagnosing-bugs`, `code-review`, `research`, `prototype`, `domain-modeling`,
`codebase-design`, `resolving-merge-conflicts`, `wizard`, `writing-for-agents` —
`implement`/`triage`/`wayfinder`/`to-spec`/`to-tickets`/`grill-me`/`handoff`/`wait-what`
and all `in-progress/*` are absent. So the T-collision surface is exactly those 11, and
§2.5's planning skills can NEVER misroute — they are slash-only.

**Matt's intended main flow** (DeepWiki): `grill-with-docs → to-spec → to-tickets →
implement (drives tdd, closes with code-review)`; `wayfinder` merges at `to-spec`;
`grilling`+`domain-modeling` are always invoked as a pair by the flow skills. His
engineering skills **require `setup-matt-pocock-skills`** (issue-tracker config under
`docs/agents/`) — we have NOT run it, so `code-review`'s Spec axis and `triage` would nag
for config if routed to. `grilling`/`grill-me` explicitly need no setup (confirmed — our
§1 adoption is safe). `in-progress/` skills (incl. `loop-me`) are beta, may vanish.

**Superpowers' composition contract** (DeepWiki on obra/superpowers): skill precedence is
**Project > Personal > Plugin** — an individual plugin skill is overridden by shipping a
same-named skill at a higher-priority location, no fork needed; `using-superpowers`
declares user instructions > skills > system defaults. (DeepWiki's answer is grounded in
the OpenCode integration docs; CC has the same project-beats-personal precedent recorded
at `/reviewer`'s origin — CC-specific plugin-shadowing semantics remain probe P1.)

### 2.1 Design interview / ideation — SETTLED 2026-08-17

`grilling` (Matt) ADOPTED as the questioning engine; `brainstorming` (SP) keeps the
pipeline (approaches → design → spec → user gate); `/arch` §1 carries the binding
(collision with brainstorming's one-question rule resolved there). See SSOT #253.

### 2.2 TDD — collision T + P (the sharpest doctrinal conflict found)

- SP `test-driven-development`: fires on «implementing any feature or bugfix»; Iron Law
  «NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST»; loop is red-green-**refactor**.
- Matt `tdd`: fires on «build features or fix bugs test-first, red-green-refactor» — same
  trigger space — but prescribes: «**Refactoring is not part of the loop.** It belongs to
  the review stage (see the `code-review` skill)» and «**Test only at pre-agreed seams**…
  confirm them with the user. No test is written at an unconfirmed seam.»
- Ours: none (we consume SP TDD via SDD; our `/vitest`, `/playwright` are format helpers).

Two genuine P-conflicts: (a) refactor-in-loop vs refactor-at-review; (b) test-everything
vs pre-agreed-seams-only. SDD (our adopted executor loop) references SP TDD, so SP is the
incumbent owner. Matt's seams discipline is independently valuable (it is a scoping act —
where testing effort lands) and could transfer WITHOUT adopting his refactor placement.

**Upstream rationale behind (a) is MEASURED, not stylistic** (DeepWiki on
mattpocock/skills CHANGELOG, 2026-08-17): refactoring was moved out of the loop in June
2026 because «agents essentially never performed it» inside the red-green loop, and
separating implementation from review into distinct sessions proved more effective; the
seams are pre-agreed at his `to-spec` phase. So D-H2 is not «doctrine vs doctrine» — it is
SP's doctrine vs Matt's behavioral measurement. The design session should check our own
corpus (do OUR executor subagents actually refactor in-loop?) before ruling.

### 2.3 Debugging — collision T + P (different first moves)

- SP `systematic-debugging`: fires on «any bug, test failure, or unexpected behavior»;
  Iron Law «NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST» — phase 1 is root-cause
  reading.
- Matt `diagnosing-bugs`: fires on «"diagnose"/"debug this"… broken/throwing/failing/slow»
  — same trigger space — «Phase 1 — Build a feedback loop. **This is the skill.**
  Everything else is mechanical»; a ranked 10-item menu of loop constructions (failing
  test → curl → CLI diff → headless browser → trace replay → harness → fuzz → bisect →
  differential → HITL script); «Do **not** proceed to hypothesise without a loop»;
  completion criterion = a tight red-capable one-command loop, already run once.
- Ours: none (we defer to SP).

P-conflict is soft: loop-first and root-cause-first are compatible (the loop is HOW you
investigate the root cause), but each text claims the whole process and the router will
pick one. Matt's loop menu + «tighten the loop» + non-deterministic-bug guidance is the
strongest single artefact in his plugin after grilling.

### 2.4 Code review — 5 surfaces, collision T (no P found)

- Matt `code-review`: two axes in parallel cold sub-agents — Standards (repo standards +
  a pasted 12-smell Fowler baseline; «repo overrides», «skip anything tooling enforces»)
  and Spec (diff vs originating issue/spec); «Do **not** merge or rerank findings — the
  two axes are deliberately separate»; model-invocable («review a branch, a PR,
  work-in-progress»).
- SP `requesting-code-review` (dispatch reviewer subagent with SHAs + template) +
  `receiving-code-review` (rigor on intake, no performative agreement).
- Ours: `/reviewer` skill (verdict grammar + [reviewer-discipline.md §6](../../../.claude/rules/reviewer-discipline.md)
  severity contract: `Failure-scenario:`, ESCALATED lane, notes lane), `/arch` §2
  two-altitude cold pass, `agents/fidelity-auditor.md` (mechanized Spec-axis at the PR
  boundary), `agents/review-sidecar.md`, CC built-in `/code-review`.
- Coverage verdicts from today's pass: Matt's Spec axis ≈ our fidelity-auditor
  (mechanized, gate-backed — ours is stronger); his cold-subagent parallelism ≈ our §2
  (ours stricter: artifact-paths-only, his sub-agents receive the diff + narrative);
  his severity model is absent (no failure-scenario, no escalation lane).
- The one transfer-candidate: the explicit **no-rerank-across-axes** sentence — `/arch` §2
  iterates both seats to GO but never states that top-down and bottom-up findings are not
  merged into one ranked list. One sentence in §2.

### 2.5 Planning / decomposition / multi-session orchestration — collision E mostly

- Matt: `to-spec` (synthesis-only spec, seams-first testing decisions), `to-tickets`
  (tracer-bullet vertical slices + blocking edges + frontier; **expand–contract** recipe
  for wide refactors), `wayfinder` (decision-ticket map on the tracker: frontier via
  native blocking links, **claim-first** — assign the ticket to yourself BEFORE any work,
  «an open, unassigned ticket is unclaimed»; fog-of-war «Not yet specified» section;
  out-of-scope never graduates; one ticket per session; HITL/AFK ticket types incl.
  `prototype` and auto-dispatched `research`).
- SP: `writing-plans` (bite-sized tasks, zero-context executor assumption),
  `subagent-driven-development` (fresh implementer per task + per-task review + final
  broad review), `executing-plans`, `dispatching-parallel-agents`.
- Ours: `/orchestrator` (Mode A/B, tiers, quota zones, Phase -1 cold review),
  `/pipeline` + `/dispatcher` (factory path, umbrella kickoffs, `probe-inflight.sh`),
  `/arch` §3 exit routing.
- No P-conflicts: the three stacks operate different altitudes (Matt: tracker-centric solo
  dev; SP: in-session execution; ours: factory + operator model ladder).
- Upstream evolution note (DeepWiki, CHANGELOG): wayfinder's HITL/AFK ticket split was
  added to fix a real failure — «/wayfinder would grill itself instead of the human», the
  agent answering its own decision questions. The same failure class exists on OUR
  park/answer edge (a factory task answering its own parked question instead of parking
  it); grilling's facts-vs-decisions split was sharpened for the same reason. Relevant to
  §4's factory-orchestration row and to `/arch` §4 escalation intake.
- «No collision» ≠ «no value» (operator correction, 2026-08-17): the slash-only planning
  skills are adoption candidates in their own right — full per-skill evaluation:
  - **`wayfinder` — ADAPT candidate, the strongest.** Upstream problem class: one foggy
    effort spanning MANY sessions, resolved as decision tickets on a shared map with a
    frontier and claims. Our current answer to the same class is ad-hoc handoff briefs
    (tier-membership: design session → §7 ratification → gitignored `impl-handoff.md`;
    advisor-pattern: 3 chained sessions) — artifact-first per SLP, but with NO frontier
    structure, NO claim discipline, NO fog register. Convergence: the D4 live decision
    register just shipped in `/arch` IS a single-session mini-map; wayfinder is the same
    object lifted to multi-session. Raw idea in §4.6 (idea 1). Claim-first transfer for
    dispatcher stands on its own incident base (two sessions on one stage —
    getff-freshness S1; duplicate dispatch — `beta-delivery-ux-995e9c`; duplicate merge
    #1354; «all historical collisions materialized inside the Phase -1 window»).
  - **`to-tickets` — ADAPT candidate (mechanizable).** Tracer-bullet vertical slices with
    explicit `Blocked by` edges + frontier execution + quiz-the-user granularity gate +
    **expand–contract** for wide refactors. Our kickoff stages express dependencies in
    PROSE ordering; the dispatcher cannot compute a frontier. Raw idea in §4.6 (idea 2):
    Blocked-by edges in kickoff stage tables → `/pipeline` computes the dispatchable
    frontier mechanically. Expand–contract vocabulary transfers regardless.
  - **`to-spec` — one section transfers: seams-first.** His spec template carries
    «Testing Decisions» agreed BEFORE implementation (seams sketched, «the ideal number
    is one», confirmed with the user); our spec obligations (premise register, falsifiers,
    decision register) have NO testing-seams slot. Adopting it also makes Matt's tdd
    seams discipline coherent for our executors (the seams his `tdd` demands are
    pre-agreed exactly here — D-H2's second half). Raw idea in §4.6 (idea 3).
  - **`implement` — REJECT.** A 15-line stub whose whole content is «use /tdd, then
    /code-review, commit»; SDD covers the loop with per-task review + fix loop + final
    broad review. Nothing to take.
  - **`triage` — mostly covered, two residues.** «Already implemented → point to where»
    = BFR own-stack-first criterion zero; redundancy probe = §1.5 research contour. The
    two residues: verify-the-claim-before-grilling (reproduce the bug / run the diff
    BEFORE interviewing — a cheap-death ordering our kill-channels table could name) and
    the `.out-of-scope/` rejected-requests KB (ours lives as SSOT REJECT rows +
    closed-questions — adequate; REFERENCE).
  - **fog-of-war section** for umbrella kickoffs transfers regardless of wayfinder
    (our open-questions §13.x is project-wide, not per-umbrella).

### 2.6 Skill authoring — 3 surfaces, layered (no P)

Matt `writing-for-agents` (prose style for agent docs) × SP `writing-skills` (TDD for
skills: pressure-scenario baseline before writing) × our `/ai-doc` (context-hygiene +
rule-as-test + authority headers, Class-A gated). Different altitudes — style / process /
project standard — composable rather than conflicting; needs an explicit ownership note
so authors don't pick one at random.

### 2.7 No-collision adoptables (nothing on our side or SP's side)

- `wizard` (Matt): generates a stage-by-stage bash wizard for human-only procedures
  (credentials, dashboards, one-off migrations; template.sh carries the UX). Zero analog
  in ours/SP. Immediate concrete use: the standing operator jq hand-off for
  agent-uncommittable `.claude/settings.json` hook registrations.
- `prototype` (Matt): HITL fidelity-raiser (logic HTML demo / UI variants). No SP analog;
  candidate ticket-type for `/arch` §1.5.
- `loop-me` vocabulary (Matt): «push right» (defer the checkpoint maximally), «brief, not
  draft» at checkpoints — matches our night-mode morning-report posture; REFERENCE.
- `triage`'s `.out-of-scope/` KB + «already implemented → point to where, don't KB it» —
  REFERENCE next to our prior-art REJECT entries + closed-questions.
- `wait-what` ≈ our end-of-turn «Простыми словами» hook — parallel evolution, ours is
  mechanized; no action.

## §3 Resolution-mechanism toolbox (what the design session can actually pull)

1. **Binding paragraph in our wrapper skill** — precedent shipped today: `/arch` §1
   grilling binding (collision named, precedence stated, upstream text read AS IS).
   Works for any «X owns phase, Y subordinated» call. Cheap, repo-owned, testable.
2. **Vendor-copy fallback** — recorded as SSOT #253 revisit arm: byte-copy the one skill
   we need under `references/` (MIT permits) and drop the plugin if routing noise wins.
3. **Per-skill disable of a plugin skill** — mechanism UNKNOWN; probe P1 below. If CC
   supports it, the cleanest fix for T-collisions (disable Matt's `tdd`; keep `grilling`).
4. **Editing the plugin cache** — NOT a mechanism: `~/.claude/plugins/cache/**` is
   overwritten on update; same class as the `--refresh` overwrite trap (global CLAUDE.md).
5. **Explicit-invocation discipline** — use `mattpocock-skills:X` by name only; does NOT
   remove the description from the router's space, so it mitigates, not resolves, T-class.
6. **Uninstall whole plugin + vendor the keepers** — the maximal form of (2); loses
   upstream evolution (the reason ADOPT was chosen over vendor for grilling).
7. **Same-name shadow skill at project level** — superpowers documents skill precedence
   as Project > Personal > Plugin, with per-skill override by shipping a same-named skill
   higher in the chain, no fork needed (DeepWiki on obra/superpowers, 2026-08-17;
   grounded in its OpenCode docs — CC analog partially proven by the `/reviewer`
   skill-beats-personal-command precedent). A thin project-level `tdd` shadow that says
   «TDD here means `superpowers:test-driven-development`; seams note from Matt applies»
   would also disarm the §1.5 bare-acronym hazard. CC-specific plugin-shadow semantics =
   probe P1 (narrowed: not «does disable exist» but «does a project skill named `tdd`
   out-rank `mattpocock-skills:tdd` in the router»).

Known precedence facts: an in-repo project skill beats a same-named personal command
(documented; `/reviewer` origin). Plugin-vs-plugin and plugin-vs-builtin routing
precedence: UNKNOWN — probe P2.

## §4 The raw idea (сырая идея): one owner per capability area

One table, ratified in the design session, becomes the SSOT for «who owns which phase»;
every subordinated skill gets either a binding paragraph (mechanism 1), a disable
(mechanism 3, if it exists), or stays REFERENCE-only. Draft ownership (recommendations,
not decisions):

| Area | Proposed owner | Subordinated / consumed | Notes |
| --- | --- | --- | --- |
| Interview pacing | Matt `grilling` | SP brainstorming:72 yields (done) | settled, SSOT #253 |
| Ideation pipeline | SP `brainstorming` | — | settled (#64) |
| In-session execution | SP `SDD` + `writing-plans` | Matt `implement` (a 15-line stub) ignored | incumbent, referenced by our orchestrator |
| TDD | SP `test-driven-development` | Matt `tdd` → extract «pre-agreed seams» only; refactor-placement conflict resolved in SP's favor (SDD depends on it) | needs disable or binding for Matt's copy |
| Debugging | SP `systematic-debugging` (process frame) | Matt `diagnosing-bugs` → its Phase-1 loop menu subordinated as the loop-construction reference | strongest merge candidate: «root cause via a tight red loop» |
| Code review verdict + severity | ours (`reviewer-discipline.md §6`) | Matt severity-less model rejected | incumbent, gate-backed |
| Code review structure | ours `/arch` §2 + fidelity-auditor | adopt Matt's one no-rerank sentence into §2 | trivial edit |
| Factory orchestration | ours (`pipeline`/`dispatcher`/`orchestrator`) | ADAPT Matt `wayfinder` claim-first into dispatcher; expand–contract + fog-of-war vocab into kickoff conventions | the real design work |
| Skill authoring | ours `/ai-doc` (standard) + SP `writing-skills` (process) | Matt `writing-for-agents` REFERENCE | needs one ownership note |
| Human-only procedures | Matt `wizard` (ADOPT, operator axis) | — | no collision; first use = settings.json hook hand-off |
| Continuity / handoff | ours (seat-lifecycle + session-bus) | Matt `handoff`/`claude-handoff` REFERENCE | ours richer |
| Research | ours (§1.5 contour) | Matt `research` REFERENCE | ours stricter (freshness bar, K-pass) |

## §4.5 Our-side audit: which of OUR skills could thin down or retire (2026-08-17 pass)

Measured against both satellites (line counts from `wc -l`). Verdicts: **THIN** = real
overlap slices exist, could become a delta-only adapter; **ALREADY-THIN** = the adapter
model, done; **KEEP** = domain-specific, no satellite covers it.

| Our skill | Lines | Verdict | Rationale |
| --- | --- | --- | --- |
| orchestrator | 512 | **THIN — the main candidate** | Its role glossary, executor loop framing, and worktree-dispatch prose re-describe SDD / `using-git-worktrees` / `dispatching-parallel-agents`, all of which it already cites. Unique deltas worth keeping: discovery checklist, quota zones, model tiers (Fable/Opus/Sonnet), Mode B file-prompt, Queue mode, Phase -1 cold review. A rewrite to «deltas + bindings» (the `/arch` model) could roughly halve it. |
| pipeline | 599 | KEEP | Factory-specific (umbrella priority, launch tables, chips). Optional: adopt wayfinder's frontier/fog vocabulary for kickoff sections (E-class, no conflict). |
| dispatcher | 429 | KEEP + D-H5 | aif dispatch loop, probe-inflight, egress — no satellite analog; claim-first ADAPT pending. |
| aif-doctor | 298 | KEEP | Our runtime's diagnostics; unportable by nature. |
| arch | 148 | ALREADY-THIN | The wrapper model the THIN verdicts point to (post-#253). |
| claude-glm-executor-handoff | 136 | KEEP | Cross-model dispatch; no analog in either satellite. |
| self-reflection | 129 | KEEP | Project §1.7 discipline; recursive-self-application is ours alone. |
| harvest | 118 | KEEP | aif egress mechanics. |
| reviewer | 95 | KEEP | The severity contract (Failure-scenario / ESCALATED / notes lane) exists in neither satellite; already thin (binds the rule, restates nothing). |
| night-mode | 68 | ALREADY-THIN | Layers over SDD explicitly (×5 refs). |
| tool-bootstrapping / story / template-audit / rule-tests / ai-doc / rule-research | 59/56/43/31/31/30 | KEEP / ALREADY-THIN | Product-specific surfaces; `ai-doc` already subordinates to `writing-skills`. |

**Nothing is deletable outright** — every candidate's remainder is a real delta the
satellites do not carry. The actionable item is one: the orchestrator rewrite (D-H9).

## §4.6 Raw ideas for the design session (сырые идеи — material, not decisions)

**Idea 1 — the decision map as the multi-session layer over `/arch` (ADAPT wayfinder).**
When a design outgrows one dialogue, the spec's live decision register (D4) graduates
into a wayfinder-shaped map: each open row = a decision ticket sized to one session; the
frontier = rows whose prerequisite rows are settled; a session CLAIMS a row before
working it; fog-of-war = a `Not yet specified` section for questions not yet sharp enough
to be rows; out-of-scope never graduates. Open sub-fork: where the map lives — (i) GitHub
issues with native blocking (his default; we have `gh` but zero issue-tracker practice),
(ii) the spec file itself as a local map (his local-markdown fallback; closest to our
current handoff-brief practice, survives offline), (iii) aif tasks as tickets (claims =
task assignment, statuses native — but decisions are HITL and aif is an AFK executor
surface). Recommendation seed: (ii) local map first — it is our existing practice plus
structure, zero new infra; revisit (i) if collaboration appears.

**Idea 2 — kickoff stages as a ticket graph; `/pipeline` computes the frontier.**
Kickoff stage tables gain an explicit `Blocked-by:` column (his to-tickets edge
convention); the dispatcher/pipeline derives the dispatchable frontier mechanically
instead of reading prose order. This upgrades stage sequencing from
attention-shaped prose to a checkable structure ([attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md))
and gives the in-flight probe a natural claim surface per stage (D-H5 synergy: claim =
assigning the stage row). Vertical-slice discipline statement + expand–contract recipe
enter the kickoff template's vocabulary.

**Idea 3 — seams-first testing decisions in our spec template.**
Add a `Testing seams` slot to the spec-template obligation (arch §1): seams named and
confirmed at spec time, «prefer existing seams, highest seam possible, ideal number is
one» (his to-spec). Feeds D-H2: with seams pre-agreed in specs, the seams half of Matt's
tdd becomes adoptable without the refactor-placement half.

**Idea 4 — glossary SSOT instead of CONTEXT.md (the D-H11 material).**
Upstream's `domain-modeling` maintains a ubiquitous-language glossary (CONTEXT.md) +
ADRs, actively challenged during dialogues. We do the same WORK today, scattered:
`orchestrator/references/glossary.md` (three roles), seat-lifecycle §1 (three «seat»
usages disambiguated), the ACCEPTED-vs-FIXED vocabulary ruling (S5b/D-K6), «night is a
MODE, not a role», tier vocabulary in `tier-home.md` — each a domain-modeling act
recorded ad-hoc in whichever authority doc was nearest. Raw idea: a generated
**term-ownership index** (pattern: `00-rule-index.md` — «generated, do not hand-edit»),
one line per cross-doc term pointing at its owner doc/anchor per
[doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md); a
principle test asserts every indexed term's owner anchor exists (the principle-08/09
mold). Then `/arch` §1 can bind domain-modeling's challenge-the-term behavior to OUR
glossary surface — the upstream pairing (grilling+domain-modeling always invoked
together) becomes adoptable without importing the CONTEXT.md convention. ADR directory:
REJECT (parallel-evolution with our specs/research-patches/closed-questions record
system).

## §5 Decision register for the design session (live; grown per the new §1 format)

| Decision | Status | Resolution | Falsifier |
| --- | --- | --- | --- |
| D-H0 grilling adoption + binding | answered (2026-08-17) | ADOPT via plugin, `/arch` §1 binding | SSOT #253 triggers |
| D-H1 ratify the §4 ownership map | open | — | wrong if a live routing test (P2) shows the router ignores bindings, forcing mechanism 3/6 |
| D-H2 TDD refactor-placement conflict | open (rec: SP wins) | — | wrong if repo practice shows review-stage refactoring produces cleaner history |
| D-H3 debugging merge (SP frame + Matt loop menu) | open (rec: subordinate-as-reference) | — | wrong if the two texts cannot be bound without restating (`#parallel-evolution-creep`) |
| D-H4 no-rerank sentence in `/arch` §2 | answered (2026-08-17) | landed as `09569a30ab` (committed by a parallel actor mid-session, matching the recommendation) — `/arch` SKILL.md:89 | wrong if §2 verdict aggregation actually needs a cross-altitude ranking |
| D-H5 claim-first ADAPT in dispatcher | open (rec: adapt; incident base cited §2.5) | — | wrong if claim surface can't span host+container+PR (the probe-inflight population) |
| D-H6 wizard first use | settled-by-default | use at next operator hand-off; zero build | — |
| D-H7 collision incident counter | settled (2026-08-17) | SSOT #253 row is the recording surface; observation №0 (routing risk noted, no incident) logged there conceptually | 1st real misroute → incident №1 |
| D-H8 keep vs uninstall plugin | open (default: keep, watch) | — | ≥3 misroute incidents → vendor keepers + uninstall (SSOT #253 arm) |
| D-H9 orchestrator rewrite to deltas+bindings (§4.5) | open (rec: thin; the `/arch` model) | — | wrong if the re-described slices turn out to carry load-bearing project deltas the satellites lack |
| D-H10 TDD bare-acronym shadow (§3 mech 7) | open (rec: shadow after P1 confirms ranking) | — | wrong if CC router ignores project-level shadowing of plugin skills (then: mech 2/6) |
| D-H11 pair `domain-modeling` with grilling in /arch | open (rec: adopt VIA the glossary-SSOT adaptation, §4.6 idea 4 — not via CONTEXT.md) | — | wrong if the term-ownership index proves redundant with doc-authority headers alone (no term-drift incident within 6 months) |
| D-H12 wayfinder-shaped multi-session decision map over /arch (§4.6 idea 1) | open (rec: ADAPT, map lives in the spec file first) | — | wrong if chained design contours stay ≤2 sessions in practice (map overhead beats ad-hoc briefs only at ≥3) |
| D-H13 kickoff `Blocked-by:` edges + pipeline-computed frontier (§4.6 idea 2) | open (rec: ADAPT — mechanizes stage sequencing) | — | wrong if real umbrellas are overwhelmingly linear (frontier degenerates to the prose order it replaced) |
| D-H14 seams-first `Testing seams` slot in the spec template (§4.6 idea 3) | open (rec: adopt; unlocks the seams half of D-H2) | — | wrong if our spec corpus shows seams can't be named pre-implementation for meta-factory work (mostly md artifacts, few code seams) |

## §6 Probes for the design session (facts, not decisions — run before the interview)

- **P1** (narrowed 2026-08-17): two halves — (i) does a PROJECT-level skill with the same
  bare name (e.g. `tdd`) out-rank an installed plugin's skill in the CC router (mechanism
  7)? (ii) does CC additionally support disabling an individual plugin skill (mechanism
  3)? Superpowers documents Project > Personal > Plugin for its OpenCode integration;
  CC-side needs a live test.
- **P2**: routing reality check — with both plugins installed, which skill does the model
  pick on a bare «fix this bug test-first» / «review this branch»? (Live probe, N≥3
  phrasings; decides how load-bearing bindings are vs disables.)
- **P3**: does `grilling`'s model-invocable description fire outside `/arch` in normal
  sessions? (Watch item; SSOT #253 counter.)
- **P4**: claim-first mechanics — can an aif task assignment / a worktree marker serve as
  the claim across all probe-inflight surfaces (host branch, container branch, PR)?

## §7 Session-start instructions for the design session

Worktree isolation; `git fetch` + in-flight probe on `claude/keen-shannon-46577a` (this
branch carries: cherry-picked `89ec69b8c2`, the ADOPT commit `aa5e779ce5`, the parallel
no-rerank commit `09569a30ab`, and this prep-doc). NOTE: a parallel actor committed to
this branch mid-session on 2026-08-17 — re-run the in-flight probe immediately before any
edit, not only at session start. Read order: this doc → the three primary-source trees (§1 paths) → SSOT #253 →
`/arch` §1-§2. PR pause in force unless the operator lifts it. The session's engine: run
the interview per the newly-adopted grilling mechanic — §5 is the initial decision
register; compute the frontier from it (D-H1, D-H2, D-H3, D-H4, D-H5, D-H8 are all
prerequisite-free once P1/P2 land).
