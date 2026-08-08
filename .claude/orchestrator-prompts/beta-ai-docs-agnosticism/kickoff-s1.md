<!-- scope: stage kickoff — beta-ai-docs-agnosticism S1 (AGENTS.md layer + AI Usage Guide, spec C1). Dispatch input for ONE buildable task; the umbrella plan lives in ../beta-ai-docs-agnosticism-meta-launch/kickoff.md and is NOT this file's scope. Tier 2 (no bridge-profile marker): top tier plans, executor implements + reviews. -->

# beta-ai-docs-agnosticism S1 — AGENTS.md layer + AI Usage Guide (C1)

> **Type:** execution-build, single PR onto `staging`. **Branch: `beta-c-s1-agents-layer`**
> (the meta-launch Stage-1 → Stage-2 gate greps this exact head name — `kickoff.md:121` — so a
> different branch name silently fails the gate).
> **Binding design:** [`docs/superpowers/specs/2026-07-23-beta-program-design.md`](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md)
> §6 **C1** is the design SSOT (plus §2 **D7**/**D8**; and §5 **B-D5** of the showcase spec for
> the First-Steps single source — see §3, which carries a **decided** ownership divergence).
> On any other divergence between this kickoff and the spec, **the spec wins** — surface it,
> never improvise past a binding decision.
> **Umbrella context (read-only):** [`kickoff.md`](kickoff.md) §2 row S1 +
> [`../beta-ai-docs-agnosticism-meta-launch/kickoff.md`](../beta-ai-docs-agnosticism-meta-launch/kickoff.md) §4 Stage 1.
> **Base branch:** `staging`.

```bash host-verify
npx vitest run packages/core/principles/09-doc-authority-hierarchy.test.ts
bash tests/agnosticism/run-audit.sh
test "$(wc -l < AGENTS.md)" -le 150
```

> Run it by explicit path — `bash scripts/host-verify.sh .claude/orchestrator-prompts/beta-ai-docs-agnosticism/kickoff-s1.md`
> (the bare `<umbrella>` form resolves to the umbrella `kickoff.md`, `host-verify.sh:98`, not this
> file). **Every test this stage creates gets its runner line added to the block above in the same
> commit that creates the test** — the First-Steps parity fixture (§3) and the fence-install test
> (§2 D1b) are both acceptance-deciding. A contract that names only the tests that already existed
> is aspirational, not a contract.

## §0 Goal

A cold AI harness opened on a **consumer** project orients itself from the shipped AGENTS.md
alone — what environment layer is installed, what degrades when a capability is absent, where the
authoritative criteria live — and then has ONE machine-followable path from install to a first
task. Two artefacts carry it: the extended consumer `AGENTS.md.template` (pointer-only, never a
second copy of the criteria) and a new **AI Usage Guide** whose First-Steps section is a render of
a single source umbrella B will later render too.

Under **D8** throughout: thin always-on layer, everything else on-demand, and **nothing written to
the consumer AI's memory**.

## §1 Do this FIRST — entry re-verification (both directions, T-BADC-S1-B)

The facts below were measured while authoring (2026-08-08, staging `600b567074` — the same SHA
this kickoff cites throughout). Every one is a snapshot. Re-verify at entry and **act on what you
find, in both directions** — a neighbour that merged since is as much a change as one that stalled.

| # | Fact measured at authoring | Evidence | What to re-check |
|---|---|---|---|
| 1 | A-S4 (`beta-delivery-ux` S4, aif task `92bf0019`) **has NOT merged**; it is the other live writer on **both** `INSTALL-FOR-AI.md` **and** `setup.d/**` | `gh pr list --state all --search beta-delivery-ux` → S1 #1173, S2 #1284, S3 #1272, S5 #1285 merged; the only S4 hit is #1286, a *kickoff doc* PR. A-S4's own scope: `beta-delivery-ux/kickoff-s4.md:231,250` names `setup.d/**` | if A-S4 merged since, read its diff on BOTH files before editing; if still open, sequence your `INSTALL-FOR-AI.md` **and** `setup.d/**` edits after it merges (§9) |
| 2 | Umbrella **B has authored no First-Steps source doc** | `grep -rn "First Steps" --include="*.md" .` → 14 lines in 6 files: the 2 spec files, **umbrella B's own kickoff `beta-docs-showcase/kickoff.md:58` (BS2 named as First-Steps owner)**, this umbrella's kickoff, and the meta-launch. **No source doc among them**; `gh pr list --search beta-docs-showcase` returns only design/kickoff PRs #1103/#1104/#1105 | re-run the probe; if BS2 has landed a skeleton since, **consume it** and §3's divergence is void |
| 3 | aif bridge health **flaps** (`curl http://localhost:3009/health` returned `000` at authoring, `200` minutes later during cold review) | authoring + review probes | informational only. Bridge health does **not** govern the autonomous gate — meta-launch `:278-283` gates it on the `AGENT_MAX_REVIEW_ITERATIONS` container probe, which is `UNSET`. The gate stays shut regardless of what `/health` says |
| 4 | `packages/core/templates/shared/AGENTS.md.template` = **195 lines** | `wc -l` | §2 D1 — this is the stage's first design decision |
| 5 | `INSTALL-FOR-AI.md` = **563 lines** against the **600-line pre-commit gate** (`.husky/pre-commit:77`) — 37 lines of headroom | `wc -l` | §2 D3 must be net-neutral, not an append |

Also re-run the pre-dispatch in-flight probe (`gh pr list --state open`, `git branch -a --list
'*beta-c-s1*'`, `git worktree list`) — at authoring there was **zero** in-flight work on this
stage's surfaces.

## §2 Deliverables

### D1 — Consumer `AGENTS.md.template`: environment layer + degradation pointer

**Divergence surfaced, not settled (read this before acting).** Spec `:340-341` adopts the LF
AGENTS.md standard — «root ≤150 lines; nested files pattern». The umbrella kickoff `:36` and the
meta-launch Stage-1 AC both apply the ≤150 figure to **this repo's root `AGENTS.md`** (107 lines,
green). Neither states it for the consumer template — which is **195 lines** and, on a consumer
machine, IS the rendered root file. This kickoff reads the cap as applying to what the consumer
ends up with. **That reading is this kickoff's, not the spec's** — if you disagree after reading
`spec:340-341`, say so in the PR body rather than quietly picking either way.

- The layer names: which install depth is present (`core` / `env` / `factory` — A1 names, final
  per PR #1173), what the environment layer gives at that depth, and what degrades when a
  capability is absent.
- **Pointer, never a copy.** The criteria + degradation matrix live at `.ai-factory/tier-home.md`
  (A-S3 deliverable, shipped `packages/core/templates/shared/tier-home.md`, its §3 is the matrix).
  The template already points there — `AGENTS.md.template:39-41`. Extend that pointer; do **not**
  paste the matrix inline. **Falsifier (T-BAD-C, inherited): if a reader can learn the tier
  criteria or a degradation row without opening `tier-home.md`, C1 has forked the SSOT.**
- **Where removed detail may go.** The **AI Usage Guide** (D2) is the only in-stage destination.
  `tier-home.md` is **A-S3's shipped artefact** — if the honest home for a removed block is that
  doc, it is a PARK + a proposal to its owner, never an edit here (§5, §9). Do **not** treat
  `.ai-factory/RULES.md` as a destination at all: it is `copy_safe`-installed from the preset
  packages (`setup.d/30-templates.sh:25,27,29`), so «moving detail there» means editing
  `packages/preset-*/RULES.md` — track-1 surface, program non-goal (spec §10).
- **The park is priced — it is not the cheap exit** (T-BADC-S1-A). Reaching ≤150 by adding the
  layer and then parking «cannot cut» costs a paragraph, while the honest cut costs the whole
  per-block ownership analysis. So: **a parked line-cap fork MUST carry the enumeration it
  replaces** — every block of the template with a per-block verdict (`KEEP-first-read` /
  `MOVE-to-<doc that already owns it>` / `DROP`) and the line count the honest cut actually
  reaches. A park without that inventory is an unfinished deliverable, not a park. Accepting
  N>150 is a change to an ADOPTED standard → **maintainer call**, flagged in the PR body.

### D1b — Co-ownership by fence (spec C1 addition (b)) — the load-bearing gap

`setup.d/30-templates.sh:81` installs the template via `copy_safe`, and `copy_safe` **skips when
the destination already exists** (`setup.d/lib.sh:104-112`). The skip is *announced*
(`lib.sh:109` prints «⊝ … (exists — skipping; use --force to overwrite)») — but it reads as a
benign no-op, so on any consumer whose root `AGENTS.md` already exists — including the
DeepWiki-verified case the spec names, where ai-factory generates and auto-updates it — **our
contribution lands nowhere**, and `--force` would clobber the other writer.

The spec's answer is section-scoped co-ownership via the `getff:begin` fence pattern: our block is
ours, the rest of the file is theirs. The machinery exists —
[`packages/core/composition/fence.ts`](../../../packages/core/composition/fence.ts) (+ `fence.test.ts`),
and this repo's own root `AGENTS.md:26-58` / `:76-92` / `:96-107` is the live precedent.

**Implementation constraint (binding).** Add a **NEW dedicated helper** (e.g. `merge_fenced`) in
`setup.d/lib.sh`, called from `setup.d/30-templates.sh:81`. **Do NOT change `copy_safe`'s
skip-if-exists semantics** — it has 142 call sites across 14 files (`grep -rn "copy_safe " setup.d/
install.sh`), none of which asked for merge behaviour. If the fenced write cannot be built without
changing `copy_safe`, **park**.

**Also decide and state explicitly what `--force` means for a co-owned file.** Proposed default:
`--force` replaces OUR fenced section only, never the whole file. If you conclude otherwise, park —
do not leave it undefined.

**AC — three cases, before/after quoted for each:**

- (a) consumer `AGENTS.md` with **foreign** content → our section lands, foreign content survives;
- (b) **second run** → the section is replaced, never duplicated (idempotence);
- (c) consumer `AGENTS.md` that is a **fence-less copy of an older version of our own template** —
  this is every consumer installed before this stage. The run adopts it exactly once (wrap or
  replace); a fence-writer that finds no fence and appends silently doubles that consumer's file.

### D2 — AI Usage Guide (new doc)

The AI-facing lifecycle doc — the evolution of `INSTALL-FOR-AI.md` past install: **First Steps**
(§3) → daily cycle → presets → parks → degradations.

- **Each section renders from a shipped artefact, and documents only what is on staging at entry.**
  Name the source per section in the doc itself (presets → the A-S2 pipeline presets; parks → the
  park-routing / status classes; degradations → `tier-home.md` §3). Anything not shipped at entry
  gets **no section** — an aspirational section is a lying doc (spec R4; the `doc-claims` probe
  is the mechanical half).
- **It ships to consumers** → it is a template under `packages/core/templates/shared/`. State BOTH
  its template path AND its **consumer-side destination path**, and install it at a declared depth
  (mirror `tier-home.md`'s env+ gate, `setup.d/30-templates.sh:83,94`). The destination path is a
  cross-doc contract — the AGENTS.md pointer, `tier-home.md` and B's later vendored render all
  need it — so it is **not** a technical fork you resolve silently; state it in the PR body.
- **doc-authority header required, and the doc joins the static list.** Sibling shipped templates
  are already registered in `REQUIRED_HEADER_DOCS` (`packages/core/principles/09-doc-authority-hierarchy.ts`,
  array `:28-141`, with `AGENTS.md.template:105` and `tier-home.md:112`). `REQUIRED_PATH_PATTERNS`
  (`:173-178`) does **not** reach `packages/core/templates/**`, so registration is an explicit
  edit — make it, following the two precedents. Ship the Class / **Authoritative for** / **NOT
  authoritative for** header per [doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md) §2-§3.
- **Channel selection FIRST** ([rule-enforcement-channel-selection.md](../../rules/rule-enforcement-channel-selection.md)),
  hot/cold split, D8 hygiene — the C2 cross-cutting obligation applies to every artefact this
  stage writes.

### D3 — `INSTALL-FOR-AI.md` refresh (sequence AFTER A-S4 if it is still open — §1 row 1)

**Net-neutral, not an append** — 563 lines against a 600-line gate (§1 row 5). Reconcile in place,
or move a section into the AI Usage Guide. If the honest edit cannot fit, park.

Three named jobs, all **reconciliation of the doc to shipped reality**, never a rename:

- **Skill-dir naming split.** The doc names `.claude/skills/rules-as-tests/` (`:80`, full path;
  `:442`, the same skill inside the roster line) while the npm scope is `@getff` and the managed
  markers read `rules-as-tests-aif` (`setup.d/lib.sh:46-48`). State the split as it IS. **The name
  freeze is R1's job (spec §7) — renaming anything here is out of scope and a stop condition (§9).**
- **Cursor story reconciliation.** `:1` promises «Claude Code, Cursor, etc.»; `:482` and `:486` say
  the harness-hook layer is CC-specific and inert on Cursor/Cline/Codex, with layers 1-4 intact.
  The spec calls these «different-altitude framings, not a flat contradiction» (`spec:165-167`) —
  reconcile the altitude, do not delete either claim.
- **npm path — NOT live yet, so record the deferral rather than dropping the clause.** Spec `:348`
  names «npm path once live» as part of C1. Publication is release-frame phase 2 (spec §7), after
  R1's name freeze. Do **not** write an install path that does not resolve today; instead the npm
  section carries an explicit **owner + trigger** line naming R1 (spec R4: any status table this
  program writes is born generated or carries an owner+trigger line).
- **Agent/skill rosters have drifted** (`spec:167`). These are derivable → *generation* is S3's
  territory. Here: fix the facts; if you migrate a roster to a `getff:begin` section, it ships its
  drift check in the same PR (**T-BAD-A**, inherited) or it is not migrated at all.

### D4 — ai-factory doc sweep (spec C1 addition (a))

The shipped docs **keep** the `.ai-factory/` file convention (load-bearing) and **drop or reframe**
every mention of the ai-factory **TOOL** as a usage path — per the A1 satellite verdict already
landed in umbrella A. Known surface: `AGENTS.md.template:63-72` («AI Factory commands (only if you
have aif installed)», the six `/aif-*` bullets). Enumerate the population by grep across the
shipped payload BEFORE editing (**T10**), then verdict each hit: keep-as-convention / reframe /
drop. This repo's own root `AGENTS.md` is **in scope for this sweep** (T15 — the standard applies
to our docs first), and its `rules-autoload` probe must stay green.

## §3 First-Steps single source — ownership divergence, DECIDED

Spec §5 **B-D5** (`beta-docs-showcase-design.md:156-161`) names **BS2** the single default owner:
«in every other case (not started, in-flight-but-unlanded) BS2 authors the skeleton and C1
consumes», with «exact home + format … proposed in BS2's SSOT PR». But **B-D6 defers B's execution
until after A7**, so following B-D5 literally blocks C1's First-Steps deliverable behind an
umbrella with no schedule — a case B-D5 (written to settle an authoring *race*) did not consider.

**Decision for this stage: C1 authors the source.** Handled through the project's standing
mechanism for cross-owner changes, not by silently taking it:

1. **Probe first, and record the result verbatim.** If BS2 has landed a skeleton since authoring →
   **consume it**, change none of its steps without surfacing, and this whole divergence is void.
   «I assumed B hadn't started» is not a probe.
2. Otherwise the stage authors the source **and lands the B-D5 amendment as a SEPARATE ATOMIC
   COMMIT** — B-D5's text updated to record that C1 authored it and BS2 consumes — with rationale
   in the commit body, per the CLAUDE.md Artifact Ownership Contract. This is the same treatment
   spec §9 prescribes for the A3 CLAUDE.md pointer-ization: cross-owner edit, separate commit,
   **flagged in the PR body for maintainer sign-off**, never a side-effect of the stage's work.
3. If the maintainer declines the amendment at review, the fallback is the parked form: the guide
   keeps its First-Steps as its own render with a provenance line «SSOT pending, owner BS2», and
   the fixture's cross-render half waits. Do not negotiate this in-flight — it is a review outcome.

**The fixture — what makes it non-tautological (T-BADC-S1-C).** The source is a **separate file**
whose steps are an ordered, machine-parsable list. **Neither render is the source**: the AI Usage
Guide's First-Steps section is derived from it, and the fixture parses **both files** and compares
the ordered STEP LIST — not section counts, not heading text, which pass happily while the steps
have forked. Cover all three sequences (`core` / `env` / `factory`). If the executor makes the
guide's section *be* the source, the §4 seeded-red cannot go red and the strongest acceptance item
in this kickoff becomes a test that cannot fail.

## §4 «Works» — acceptance (command + output quoted in the PR body; prose does not count)

1. **`bash tests/agnosticism/run-audit.sh` green**, `doc-claims` still `PORTABLE`. That probe reads
   `AGENTS.md.template` directly (`tests/agnosticism/probes/doc-claims.sh:11`) and fails on any
   unqualified auto-activation claim you introduce. Baseline at authoring: **33 rows across 7
   surfaces, all PORTABLE**, «non-PORTABLE findings (none)». Paste the after-run.
2. **`rules-autoload` probe still green** — it asserts this repo's root `AGENTS.md` lists all 28
   rules; if D4's sweep moves rule content, it moves with the probe, not past it.
3. **First-Steps parity fixture passes AND fails when seeded broken** — flip one step in the
   source, show the red, revert. A parity fixture with no demonstrated red is unfalsifiable.
   Fixture shape per §3 (two files, ordered step lists, three sequences).
4. **Fence co-ownership proven on all three cases** of §2 D1b (foreign content / idempotence /
   fence-less older template), before-and-after quoted per case.
5. **Line-cap verdict recorded** — either `wc -l` on the template is ≤150, or the PR carries the
   priced park of §2 D1 (per-block inventory + reached line count + the maintainer-call flag).
   Silence is not an option.
6. **This repo's root `AGENTS.md` still ≤150 lines** (107 at authoring). There is no principle test
   for it (verified: grep over `packages/core/principles/`, `packages/core/audit-self/`, `.husky/`
   finds only the 600-line markdown gate) — so it is in the `host-verify` block as a `test` command
   with an exit code, not a number someone eyeballs.
7. **`npx vitest run packages/core/principles/09-doc-authority-hierarchy.test.ts` green** — the new
   guide carries its authority header and is registered per §2 D2.
8. **Harness honesty (T-BAD-B, inherited).** «Machine-followable» is a claim about harnesses that
   actually walked the path. Name the ones exercised; mark the rest `INCONCLUSIVE-needs-human`.
   A green run under one harness is not a cross-harness claim.
9. **D8 hygiene stated, not assumed** — name what the new artefacts add to always-on context
   (target: the AGENTS.md fenced section only) and confirm nothing writes to consumer AI memory.

## §5 Out of scope (do NOT do these here)

- The skills-agnosticism probe class, night-mode conformance, `/arch` + glm-handoff degradation
  declarations → **S2**.
- The derivable-prose inventory and its `getff:begin` migrations at large → **S3**. This stage
  migrates a roster only if it ships that section's drift check with it (§2 D3).
- `context7.json`, the re-index Action, DeepWiki → **S4**.
- **Writing content into `tier-home.md`** — A-S3 owns it; C1 only points at it (§2 D1, §9).
- **Editing `packages/preset-*/RULES.md`** or any preset payload — track-1 surface, program
  non-goal (spec §10).
- **Changing `copy_safe` semantics** (§2 D1b) — new helper only.
- Human-facing site content and its vendored render → umbrella **B**. (The First-Steps *source* is
  in scope under the §3 decision; B's *render* is not.)
- **Any rename** of skill dirs, package scope, or managed markers → R1 name freeze (spec §7).
- Direct edits to maintainer-owned files or `.claude/rules/*` → spec **D7**: patch proposals only,
  and that mechanism is S3's, not this stage's. The §3 B-D5 amendment is the one sanctioned
  cross-owner edit, and only in the separate-commit + sign-off form described there.
- Editing `~/.claude/**` (agent-uncommittable) or adding npm deps.

## §6 AI-laziness traps ([.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active traps for this stage: T2, T3, T7, T10, T13, T14, T15, T16, T19, T20, T21.**

- **T2** — designing the fence-write / the fixture is not shipping it. §4 is done when the commands
  have been RUN and their output pasted, not when the design reads well.
- **T3** — every «works» claim is a pasted command + output.
- **T7** — §4 is a live-fire list, not checkboxes to pattern-match.
- **T10** — enumerate before editing: the ai-factory-TOOL mention population (§2 D4) and the
  INSTALL-FOR-AI roster population (§2 D3) are grepped in full BEFORE any verdict.
- **T13** — the LF AGENTS.md standard is ADOPTED, not free. Confirm the upstream evidence for the
  ≤150 cap + nested-files pattern transfers to a doc that ships into someone else's repo.
- **T14** — a green `doc-claims` run says «this probe's population is clean», not «the docs are
  agnostic». Report the population with the verdict (33 rows / 7 surfaces), never the verdict alone.
- **T15 (mandatory — `ai-laziness-traps.md §4 #self-protection-omitted`)** — self-application is the
  point. The AI-docs standard this stage ships applies to THIS repo's own docs first: root
  `AGENTS.md` is in D4's sweep, and its ≤150 + `rules-autoload` state are acceptance items (§4).
- **T16** — write the explicit line: «Upstream problem class: X. Our problem class: Y. Match?
  evidence: …». Ours has a twist upstream does not: **our file is co-owned by another generator**
  (ai-factory), so «root file» semantics differ — that is exactly why D1b is fences, not a copy.
- **T19** — own adversarial cold-QA of the diff before handoff. CI checks form, not design.
- **T20** — every verdict (which mention is convention vs tool, which block is cuttable, whether
  BS2 has started) carries file:line or command output.
- **T21** — the Backward-check enumerates **sibling surfaces**, not your diff (§8).

**Inherited domain traps (umbrella + meta-launch §5):**

- **T-BAD-A** — «the generated section works because the generator ran once». Any `getff:begin`
  section this stage creates ships its drift check in the same PR, or it is a new lying doc.
- **T-BAD-B** — «agnostic because the probe passes on the harness we run». Applies here to the
  First-Steps path: see §4 item 8.
- **T-BAD-C** — «pointed at the SSOT» when the doc actually restates it. Falsifier in §2 D1.

**New domain traps (this stage):**

- **T-BADC-S1-A — «≤150 by moving lines, not by moving ownership».** The cap is trivially gamed:
  split the template into nested files and the root is short while the *total* first-read burden
  grows and the pointers dangle. Counter: every removed block names the doc that now OWNS it, and
  that doc is one a cold harness would already open. A new nested file created solely to absorb
  overflow is a gamed cap — say so and park (priced, §2 D1).
- **T-BADC-S1-B — «the neighbour is probably done by now».** §1's five facts are snapshots at a
  named SHA. Re-check in BOTH directions at entry; a merged A-S4 changes the plan as much as a
  stalled one.
- **T-BADC-S1-C — «parity fixture that compares shapes».** Asserting both files have the same
  section count or heading text passes while the steps have forked; making one render the source
  makes the seeded-red impossible. Counter: §3's two-files / ordered-step-list invariant.

## §7 Park-don't-guess contract (BINDING)

> **Fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible
> implementations, an undecided design choice, a missing spec detail that changes behaviour) —
> **do NOT pick.** Park it as a question (stated as «Option A → consequence X / Option B →
> consequence Y») and **stop that thread.** Proceed only on the unambiguous parts. Guessing a fork
> to «keep moving» is the failure this loop exists to prevent.

Known fork-prone spots here — park rather than guess: the ≤150 cut when the honest cut would hide
something a cold harness needs on first read (§2 D1, priced park); `--force` semantics for a
co-owned file if the proposed default is wrong (§2 D1b); whether the fenced write is buildable
without touching `copy_safe`; which depth profile installs the AI Usage Guide if the A1 payload
inventory does not settle it; whether an `INSTALL-FOR-AI.md` roster is derivable enough to migrate
now or belongs to S3; any case where reconciling the Cursor story would require changing what the
product *does* rather than what the doc *says*.

**Recording a park** is not a file write outside the allowlist: it lands in the **park payload**
AND the PR's `## Parked questions` section (meta-launch §4c). Its correction lands later as a
separate owner commit on the spec / kickoff, never inside this stage PR. **If a parked fork blocks
a deliverable outright, report it to the orchestrator before any PR exists** — a park with no PR
to live in is still a park.

Technical forks strictly inside these bounds (fence marker naming, where a helper lives, table
shape) are yours — resolve them and record why.

## §8 PR-body requirements (REQUIRED checks on `staging`)

This stage touches `packages/core/templates/**`, `setup.d/**` and `INSTALL-FOR-AI.md` → **the
§1.7 mandate is ON.**

**Required sections — H3 depth (`###`), the word «applied» is required, ≥40 non-whitespace chars
in EACH body, ≥1 `path.ext:N` citation per section:**

```markdown
### §1.7 Forward-check applied

<which existing disciplines were checked, with file:line evidence>

### §1.7 Backward-check applied

<sibling-surface sweep — see below>
```

**T21 — the Backward-check is where this stage fails if rushed.** Class of this change =
*shipped-template docs + their install path*. Sibling surfaces to enumerate and verdict
(`SWEPT-CLEAN(evidence)` / `GAP-FOUND(action)`) — at minimum: the other
`packages/core/templates/shared/*` docs (`CLAUDE.md.template`, `tier-home.md`,
`DESCRIPTION.template.md`), `packages/core/templates/shared/skill-context/**`, **the other 142
`copy_safe` call sites across 14 files** (the same skip-if-exists semantics apply to every one),
the plugin channel, and this repo's OWN root `AGENTS.md`. A Backward-check whose surface list
equals your diff's file list is non-conformant by format — delegate it to
[`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md), handing it the
change *class* only, never the diff.

**`## Provenance` — fill it.** The PR template ships the section
(`.github/pull_request_template.md:25`, «Filling this in marks the PR as a stage PR»), and it is
what makes `FIDELITY: skipped` mechanically unavailable to a stage PR
(`packages/core/hooks/checks/pr-body-fidelity.ts:44,147-152`). Leaving it as the placeholder would
let a skipped verdict pass the REQUIRED check — which is exactly the theatre this stage must not
ship.

**`## Fidelity verdict` — required.** `fidelity-verdict-in-pr-body` is a REQUIRED staging check
(verified: `gh api repos/:owner/:repo/branches/staging/protection` → contexts `["ci-success",
"fidelity-verdict-in-pr-body"]`). It needs a real GO block from a cold
[`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md) run: `FIDELITY: GO` + `Basis:`
+ `Round:` + `Audited-SHA:` (must **prefix** the PR head SHA at merge time —
`pr-body-fidelity.ts:165`) + ≥1 file:line evidence on a line other than `Basis:`. Exactly one such
section, exactly one `FIDELITY:` line — a rework round REPLACES the block, never appends.

**Pre-flight before `gh pr create`** (compose the body first, then check — all four must pass):

```bash
echo "$PR_BODY" | grep -cE '^### §1\.7 (Forward|Backward)-check applied'   # must be 2
echo "$PR_BODY" | grep -cE '[^[:space:]]+\.[a-z]+:[0-9]+'                  # must be >=2
echo "$PR_BODY" | awk '/^### §1\.7 Forward-check applied/{c=1;next} /^###/{c=0} c'  | tr -d '[:space:]' | wc -c   # >=40
echo "$PR_BODY" | awk '/^### §1\.7 Backward-check applied/{c=1;next} /^###/{c=0} c' | tr -d '[:space:]' | wc -c   # >=40
```

## §9 Stop conditions

- A design decision would diverge from the binding spec → STOP and surface. (The §3 B-D5
  divergence is the one already-decided exception, and only in its separate-commit + sign-off form.)
- You are about to **rename** a skill dir, package scope, or managed marker → STOP (R1 owns it).
- You are about to write content into `tier-home.md` → STOP; park + proposal to A-S3's owner (§5).
- You are about to edit `packages/preset-*/RULES.md` or any maintainer-owned file or
  `.claude/rules/*` directly → STOP (spec D7, §5).
- You are about to change `copy_safe`'s semantics rather than add a helper → STOP; park (§2 D1b).
- A-S4 is still open and you are about to edit `INSTALL-FOR-AI.md` **or** `setup.d/**` → re-probe;
  sequence after it merges. If it has merged and conflicts, **merge-forward** per
  [git-conflict-merge-forward.md](../../rules/git-conflict-merge-forward.md) — never rebase or
  force-push a published branch.
- An `INSTALL-FOR-AI.md` edit would push it past 600 lines (`.husky/pre-commit:77`; 563 today) →
  STOP; reconcile in place or relocate a section, do not append.
- The ≤150 cut cannot be made without hiding something a cold harness needs on first read → the
  **priced** park (§2 D1), never a bare «cannot cut».
- BS2 has landed a First-Steps skeleton since authoring → STOP authoring a second one; consume it
  and drop the §3 amendment (§3 step 1).
- The local CI-equivalent sweep goes red from a branch-introduced cause → fix before handoff.
