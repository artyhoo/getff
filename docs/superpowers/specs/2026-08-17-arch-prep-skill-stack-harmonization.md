# Arch-prep: three-stack skill harmonization (ours × superpowers × mattpocock-skills)

> **Status:** PREP-DOC — raw material + collision analysis for a future `/arch` design session.
> Not a spec; nothing here is ratified except the rows marked `settled`.
> **Authoritative for:** the 2026-08-17 three-stack comparison evidence — populations, the
> collision map (§2), the resolution-mechanism toolbox (§3), the raw ownership idea (§4),
> and the open decision register (§5) the design session starts from.
> **NOT authoritative for:** the grilling adoption — [SSOT #253](../../meta-factory/prior-art-evaluations.md)
> + `/arch` §1 binding (settled 2026-08-17, this branch). Project goal —
> [README.md#why-this-exists](../../../README.md#why-this-exists).

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

## §2 Collision map (per capability area)

Collision classes: **T** = trigger overlap (two model-invocable descriptions claim the same
work), **P** = contradictory prescription (the texts disagree on what to do), **E** =
parallel evolution (same idea, different vocabulary, no live conflict).

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
- Transfer candidates: **claim-first** for our dispatcher (our collision history is real:
  two sessions on one stage — getff-freshness S1; a duplicate dispatch an hour after the
  real run — `beta-delivery-ux-995e9c`; duplicate merge #1354; CLAUDE.md records «all
  historical collisions materialized inside the Phase -1 window» — claim-first closes
  exactly that window, probe stays for the многоповерхностную half); **expand–contract**
  vocabulary for wide-refactor kickoffs; **fog-of-war section** for umbrella kickoffs
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

## §5 Decision register for the design session (live; grown per the new §1 format)

| Decision | Status | Resolution | Falsifier |
| --- | --- | --- | --- |
| D-H0 grilling adoption + binding | answered (2026-08-17) | ADOPT via plugin, `/arch` §1 binding | SSOT #253 triggers |
| D-H1 ratify the §4 ownership map | open | — | wrong if a live routing test (P2) shows the router ignores bindings, forcing mechanism 3/6 |
| D-H2 TDD refactor-placement conflict | open (rec: SP wins) | — | wrong if repo practice shows review-stage refactoring produces cleaner history |
| D-H3 debugging merge (SP frame + Matt loop menu) | open (rec: subordinate-as-reference) | — | wrong if the two texts cannot be bound without restating (`#parallel-evolution-creep`) |
| D-H4 no-rerank sentence in `/arch` §2 | open (rec: add; trivial) | — | wrong if §2 verdict aggregation actually needs a cross-altitude ranking |
| D-H5 claim-first ADAPT in dispatcher | open (rec: adapt; incident base cited §2.5) | — | wrong if claim surface can't span host+container+PR (the probe-inflight population) |
| D-H6 wizard first use | settled-by-default | use at next operator hand-off; zero build | — |
| D-H7 collision incident counter | settled (2026-08-17) | SSOT #253 row is the recording surface; observation №0 (routing risk noted, no incident) logged there conceptually | 1st real misroute → incident №1 |
| D-H8 keep vs uninstall plugin | open (default: keep, watch) | — | ≥3 misroute incidents → vendor keepers + uninstall (SSOT #253 arm) |

## §6 Probes for the design session (facts, not decisions — run before the interview)

- **P1**: does Claude Code support disabling an individual skill of an installed plugin
  (settings / plugin config)? Decides whether mechanism 3 exists.
- **P2**: routing reality check — with both plugins installed, which skill does the model
  pick on a bare «fix this bug test-first» / «review this branch»? (Live probe, N≥3
  phrasings; decides how load-bearing bindings are vs disables.)
- **P3**: does `grilling`'s model-invocable description fire outside `/arch` in normal
  sessions? (Watch item; SSOT #253 counter.)
- **P4**: claim-first mechanics — can an aif task assignment / a worktree marker serve as
  the claim across all probe-inflight surfaces (host branch, container branch, PR)?

## §7 Session-start instructions for the design session

Worktree isolation; `git fetch` + in-flight probe on `claude/keen-shannon-46577a` (this
branch carries: cherry-picked `89ec69b8c2`, the ADOPT commit `aa5e779ce5`, and this
prep-doc). Read order: this doc → the three primary-source trees (§1 paths) → SSOT #253 →
`/arch` §1-§2. PR pause in force unless the operator lifts it. The session's engine: run
the interview per the newly-adopted grilling mechanic — §5 is the initial decision
register; compute the frontier from it (D-H1, D-H2, D-H3, D-H4, D-H5, D-H8 are all
prerequisite-free once P1/P2 land).
