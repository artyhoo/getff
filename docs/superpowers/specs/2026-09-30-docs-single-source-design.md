# Docs single source — one source of truth for all documentation (top-level design)

> **Authoritative for:** the top level of the docs single-source design: the five statements, the
> decision register (rows F1 … ACC, SCOPE-U) and how a row is revised, the hand-over requirements to other designs, and the
> named items the owner accepted with the approval.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the evidence behind the numbers — [2026-09-30-docs-single-source-evidence.md](../../meta-factory/research-patches/2026-09-30-docs-single-source-evidence.md);
> the review rounds and their dispositions — [2026-09-30-docs-single-source-review-rounds.md](../../meta-factory/research-patches/2026-09-30-docs-single-source-review-rounds.md);
> the decision record (each decision, its reason, its register effect) — [2026-09-30-docs-single-source-decision-record.md](../../meta-factory/research-patches/2026-09-30-docs-single-source-decision-record.md);
> the mechanics of each hand-over row — the receiving designs (one-button chain parts P1-P4, the
> trigger-build design).

Status: APPROVED by the owner on 2026-09-29 (OP-51, «А: одобряю»); landing ordered 2026-09-30
(OP-52, OP-53). Implementation goes in slices through the aif factory with Opus verification
(OP-52); hand-over rows HO-1 … HO-9 wait for the one-button second wave. Two /arch §2 cold
two-altitude review rounds (the cap), no BLOCKER open. Text approved at `origin/staging`
`26ccdc6b160`; measured numbers are at that base unless marked; `path:NN` citations re-resolved
at `ab722237351`.

## Goal (the owner's ask)

One source of truth for ALL documentation, for the AI and for the human. Documentation is
always current by mechanism, not by attention. The AI-facing docs and the docs site share one
mechanism. Legacy docs are found and updated. The principle lives in the project and ships to
consumers (projects that install the framework). A manual human step in the design is a defect.

## The picture (five statements)

1. **Source and fact layer.** Truth lives in the project: code, config, a few structured
   files. A script generates a machine-readable FACT LAYER from them (JSON families with a
   schema each; every value carries its source path and predicate). A gate compares the layer
   with its sources. Nobody writes the layer by hand. A layer value never takes an entry doc
   or any other rendered output as its source (no render loop); the layer's schema check
   rejects such a source.
2. **Outputs.** One docs set, two generated outputs: pages for a human, output for an AI. Both
   read values from the fact layer through fenced regions. Entry and instruction files
   (README, INSTALL-FOR-AI, AGENTS, CLAUDE, and their `<file>.override.md` siblings) are thin:
   values are rendered, the rest is a pointer. The existing renderers are bricks of this one
   mechanism, not a second one.
3. **Checks.** Prose is bound to NAMED PLACES of its sources, never to whole files. A lock file
   records a content signature per binding. The lock is a VERIFICATION RECORD, not a generated
   file: nothing regenerates it wholesale; a signature changes only by a relink (with its
   record) or by an edit of the bound page in the same commit. When a bound place changes the
   gate is red and an agent rewrites only the bound pages. A source cited by a bare path is
   navigation (existence check), and every NEW bare path, and every typed value in new or
   changed prose, meets a check at the PR boundary (B-Q2: bare paths OP-47, typed values OP-50). The gate is the project's own (lock-file idea taken from Fiberplane Drift),
   runs on Windows, macOS, Linux.
4. **Consumer.** The installer puts a common BASE: the engine (renderer, fences, gates), the
   rule, tests, hooks, scripts, skills, and the named relink-audit agent. The agent generates
   the stack- and project-specific part from that base, at install and at refresh, on every
   lane. Where an agent runs the install (the one-button road), it generates in that session. A
   consumer that has the engine but no generated bindings is never green: on a channel without
   an agent the state is PENDING («not generated yet»), and the next agent session's start hook
   hands it to the agent; inside an agent session it is red. PENDING is never scored green: the
   install report and the CI arm show it as not done.
   getff's docs arrive as files at the installed version, in their own class (statement 5).
   No ADR directory is scaffolded; decided lines live in the passport. The fixing agent obtains
   any runtime the engine needs itself; the human is never asked to.
5. **Human decisions and classes.** Only decisions stay with a human: the goal, invariants,
   «never» lines, non-goals, merge to main. Every doc is in exactly one class:
   - LIVE: held current by the gates;
   - HISTORY: dated records, exempt from currency, marked so that an agent cannot take them for
     live authority; a spec becomes history once its design is built;
   - VENDORED AT VERSION (at a consumer): getff's docs, checked at getff, excluded from the
     consumer's gates and zeros, refreshed only by an install at a new version.
   Agent memory is in scope narrowly (SCOPE-U); coordination drafts are not.

## Decision register

| Id | Decision | Falsifier |
|---|---|---|
| F1 + T-Q2 | Two kinds of truth. FACTS come from code through the fact layer. DECIDED statements (goal, invariants, «never» lines, non-goals) have exactly one home; every other place renders from it or points at it. A design decision lives in the artifact that enforces it; a spec is its dated rationale | every «never» line is fully expressed by its bound test; then the test is the source |
| S-Q0 | The fact layer sits between the sources and both outputs | most facts stated in docs cannot be held by such a layer (measured: registries and counts fit; the `./setup` flags are held today but from README prose, the wrong source; `install.sh` flags, env vars, versions, exit codes, consumer paths are not held; no proportion measured) |
| T-Q4 | The home of decided statements is the PASSPORT (`.ai-factory/DESCRIPTION.md`), in getff as at a consumer, inside ONE getff-owned MARKED REGION (stable markers, not localized headings). README renders the goal and the invariants from it. getff gets the same passport a consumer gets. A passport with no region is red | the passport cannot be tracked in getff's git (`.gitignore:93`; measured 2026-09-29: NOT triggered, a committed file is not uncommitted work); or no marked region survives AI Factory's own passport writes (`aif.md:389`, `:444-462`; `aif-architecture.md:214`, `aif-implement.md:674`, `:785-787`). Overwrite carve-outs: `setup.d/lib.sh:889` (`--force`), `agents/aif-init.md:191` (files with `<PLACEHOLDER>`) |
| T-Q4b | getff reads no fact from an AI-Factory-written passport section, and no live doc cites one as a source. The AI-Factory-written AGENTS.md is in the same position: its paraphrase of the passport (`aif.md:672`) becomes a render or a pointer. Scope: wherever AI Factory is present (getff does not install it, `INSTALL-FOR-AI.md:3`) | a getff renderer or live doc reads a fact from such a section |
| F3 | Each line of the decided region (goal, invariants, «never» lines, non-goals) is bound to a check or carries a status. Authority over the region follows T12.5 / T12.6 (OP-9, OP-10, OP-15, OP-16), carried over from README-as-home: an added GOAL SCOPE LINE is an EXTENDS (the AI appends it, FYI at promote); the class follows the marked sub-block of the region the diff touches (goal scope / goal core / invariants / «never» / non-goals), and a disguised CONFLICTS is caught by a named cold agent (T12.5, draft `:412`); an added «never» line, invariant or non-goal, and any CHANGED or REMOVED line, fails the push unless the commit carries the T12.6 consent trailer (a copy of the AI's one-sentence summary or the operator's restatement; a bare «го» does not count). The check runs inside the agent container too. Honest cost (T12.6): a trailer proves the sentence was read, not who typed it; the human floor is the second look at promote | the operator meets at promote a changed decided line they do not recognise (T12.6's own falsifier, draft `:409`) |
| F5 | Nobody types the goal or the invariants. Always-loaded places render them from the region; other places point. `render-invariants.mjs` is re-sourced to the region, not duplicated; the D3 probe and its shipped shell twin (`audit-ai-docs.ts:39-60`, `audit-ai-docs.sh:155`) check against the region. Enrolled places: the eight of `DOWNSTREAM_DOCS`, override siblings, and the four tagline places. The region is seeded from README §Why through the consent card (T12.6), never from a rendered constant | one of the enrolled places admits neither a render nor a pointer (checked: all 8 admit one) |
| F2 | Gates first, then shared writers; site page content stays with the site seat | — |
| F9 + B-Q2 | A page's claim names its place in the source. A bare path is navigation: existence check only. Every NEW bare path of a source in a live page meets a check at the PR boundary (pre-push where there is no PR): a deterministic gate fails unless the named cold agent's structured verdict classes it navigation (OP-47). The same gate and agent cover every TYPED VALUE in new or changed prose (OP-50): it is fenced, cited to a place, or classed by the agent as not a fact. No «skipped» escape. One agent sweep migrates the old pages | face pages speak of the installer as a whole and no place can be named |
| R1 | Own gate + lock file (a verification record) with content signatures + relink command; three operating systems. The capability commit amends SSOT #284 (anchor model ≠ its `sources:` model) | a packaged tool gains sub-file binding for markdown and shell, a Windows build, and more adoption than Drift |
| M4 | One action «relink»: a reason plus a new signature, recorded in the lock. No standing deferral token. Every relink without a page edit needs a structured verdict from a named cold agent; a deterministic gate at the PR boundary (pre-push where there is no PR) fails without it; no «skipped» escape. The agent ships to consumers | relinks without an edit exceed half of all alarms over a window |
| H1 | The docs gate runs inside the agent container as part of the task's own check; the host gate is the second line | the container lacks Node or the git history the gate needs (measured 2026-09-29: NOT triggered; Node v22.23.3, git 2.39.5, non-shallow linked worktrees, 2144 commits) |
| N-Q3 | One Node implementation of the gates. Local hook where Node exists. A CI arm on every lane; on cargo and go it is the earliest reachable channel. Write operations (render, relink) need Node where the fix is made; the fixing agent obtains it itself | owners of cargo / go projects refuse Node in CI; or a cargo / go consumer's docs red is fixed by hand more often than by the agent |
| F10 + R2 | One docs set, two outputs; entry docs thin | an always-loaded file cannot carry a render within its size budget |
| F4 | A consumer gets the rule as a file, the gates, getff's docs as files at the installed version (class VENDORED AT VERSION) | the docs tree (87 files, 723,820 B) is rejected as install weight |
| C-Q1 | Common base installed; project-specific fact families generated by the agent at install and at refresh; no generated bindings = red | generated families fail their `--check` so often that projects switch the layer off |
| F6 | The one-source rule text lives once, in one shipped rule; the writing skills point at it. `docs-author` keeps only the site part and points at the shipped core | — |
| F7 | A human-docs skill ships to consumers, made by REUSE: the site-free core of `docs-author` plus an ADAPTED narrow part of addyosmani `documentation-and-adrs` (MIT, attribution; code comments and three checklists, no README template, no changelog, no ADR chapter; its TSDoc block seeds the generated npm-lane part). Upkeep = a scheduled deterministic check on the pattern of `pin-freshness.yml`: fetch the upstream file's blob sha, fail when it differs from the one recorded at `cda4542ade0f`; the re-read is agent work. Evidence: the F7 section of [2026-09-30-docs-single-source-evidence.md](../../meta-factory/research-patches/2026-09-30-docs-single-source-evidence.md) | pages written with the skill fail the gates as often as pages written without it |
| R3 | No ADR directory is scaffolded for consumers; `/arch` creates `docs/adr/` lazily by itself (`.claude/skills/arch/SKILL.md:54`) and its records only point at a spec; they are HISTORY, at a consumer as in getff | — |
| H-Q2 + H-Q4 | Classes are given by a directory list kept in one file. A kickoff is live until its umbrella carries `done.md`, or until the umbrella has had no commit for N days (then history mechanically); the idle clock counts only commits that touch this umbrella alone, and the classifier writes the class file, not the umbrella directory. A spec is live until its design is built, then history. Live docs may not cite history as the source of a FACT; a pointer to a spec for rationale is navigation | umbrella or spec closure cannot be determined mechanically (measured: 327 of 355 tracked umbrellas carry `done.md`) |
| SCOPE-U | Agent memory is in scope narrowly: it keeps why, incidents and the operator's words, and points at repo facts, never restating a value. Its channel is write-time, the only one `memory-codification.md:18` allows: the memory-codification hook plus the named auditor, which runs the citation tool over memory. Coordination drafts are out; a decision counts as landed only when it has its home in the repo (OP-48) | a cold sweep finds a memory file restating a repo value that the check missed |
| ACC | Done = three zeros: deferral tokens, stale citations, unclassified docs; on the owner's condition «if reachable and not a burden» | any zero needs recurring hand work to hold |

## Revising a decided row

A register row stands on its reason and its falsifier. Who chose it (an OP id) is provenance,
never an argument for keeping it.

1. When a falsifier fires, or evidence shows a better option, the session that sees it says so,
   changes the row, records the old text, the new text, the evidence and the reason, and reports
   the change as done.
2. Consent is needed only at the floors this design already names: the goal core, «never»
   lines, invariants and non-goals under F3 (T12.5 / T12.6), and the merge to main. Even there
   the session argues for the better option; it does not hold a worse one because it was
   chosen earlier.
3. No silent change: every revision is visible in the record (the decision-record patch or its
   successor).

## Hand-over requirements (owned by other designs, not designed here)

- **Trigger-build design** (its draft v2, outside the repo; row D10 answered): the directory and carrier
  of the shipped rule file (its D7, D9, D16; D10 answered). Known: `.claude/rules/` at a
  consumer is declared consumer-owned (`setup.d/10-skills.sh:306-307`); `setup.d/lib.sh:90`
  «NOT shipped to consumers».
- **Session digest:** the hook prints the PROJECT's goal and invariants from the passport, at a
  consumer and in getff. Today the consumer hook reads `.claude/session-bootstrap.md`, whose
  template ships empty (`setup.d/10-skills.sh:371-378`); no hook reads the passport. The
  consumer hook already reads the consumer's own tree (`.claude/hooks/inject-project-digest.sh:8-9`);
  the plugin no longer ships the framework digest (`8a00bbc2e0b`). Constraint to solve:
  `render-invariants.mjs:17-18`, the hook must survive a stripped PATH, no awk/sed/node parse on
  the hot path.
- **Installer parts:**
  - P1 (step list): the generation step is an agent step, on install AND on refresh; engine
    without bindings = PENDING on a channel without an agent (picked up by the next session's
    start hook), red inside an agent session. The own-configs CI cell runs off committed fixture
    bindings (precedent: its generator arm).
  - P2 (installer on any project): cargo and go lanes deliver the passport with its region, the
    rule, hooks, skills and agent surface; today they exit before the npm layers
    (`install.sh:675-683`) and install no passport (fingerprints under
    `tests/install-sh/baselines/{cargo,go}/`).
  - P3 (what ships): gate scripts, docs files (vendored class), the skill, the relink-audit agent;
    the shell twin `packages/core/audit-self/audit-ai-docs.sh` (a second gate implementation,
    against N-Q3) is re-sourced or retired.
  - P4 (base core): the passport template flips `:7` («NOT authoritative for: project goal»),
    drops `:52` (`docs/adr/`), and moves its Node/TS lines (`:15-27` under `## Stack`, `:33-38`
    under `## Hard constraints`) to the generated part; the python lane ships them unchanged
    today (`setup.d/45-python.sh:1657`); python CI pins Node 20
    (`packages/core/templates/python/github-actions-ci.yml:43`) against
    `packages/core/package.json:19` `>=22`.
- **Consumer walk:** `packages/core/hooks/pre-push.ts:2245` lists the passport as shipped
  markdown; it must be walked once it is the decided home.
- **Conflict rule:** `.claude/rules/git-conflict-merge-forward.md:68` («take either side,
  regenerate») names the lock as its exception.
- **Reds outside an agent session reach an agent without a human relaying them:** a consumer's
  CI docs red (cargo and go lanes especially), and getff's scheduled reds (F7 upkeep; today all
  8 `pin-freshness.yml` runs are red by design, `:11-13`), and the host line's manual end
  (`packages/runtime-bridge/src/cli/harvest.ts:58-60` prints manual commands; H1 moves the
  traffic, not the end). Owner: the one-button design.
- **Fact-layer migration:** re-source `docs/site/face-facts.json:88` (`"flags": "README.md:147"`)
  from `setup`.
- **SSOT rows at landing:** amend #284 (R1); a new row for addyosmani `documentation-and-adrs`
  (F7).
- **Site seat** (F2; not messaged by this design): `.claude/skills/docs-author/SKILL.md:20-33` and site spec
  D17 (`docs/superpowers/specs/2026-09-13-getff-ai-site-design.md:132`) stand on the withdrawn
  pfeff; `docs-author` points at the shipped core (F6).

## Measured facts the design stands on

Numbers at the base `26ccdc6b160` unless marked. Method, commands and the replay script:
[2026-09-30-docs-single-source-evidence.md](../../meta-factory/research-patches/2026-09-30-docs-single-source-evidence.md).

- Fact layer today: 11 family JSON files + 11 schemas under `docs/site/reference/`,
  `docs/site/face-facts.json`; writers `scripts/render-reference.mjs`,
  `scripts/render-face-facts.mjs`; `--check` at pre-push
  (`packages/core/hooks/pre-push.ts:1705-1734`) and CI (`.github/workflows/audit-self.yml:304`,
  `:308`); not at pre-commit. All 11 family COUNTS render on `docs/site/index.md:48-62`; only
  families B and D have pages rendering their MEMBERS. No entry doc reads the layer.
- The layer takes the `./setup` flags from README prose: `face-facts.json:88`
  `"flags": "README.md:147"`; `render-face-facts.mjs:16`.
- Ten renderers exist (`scripts/render-{face-facts,harness-config,install-roster,invariants,
  presets,reference,rule-channels,rule-index,terms-style,zcode-parity-rollup}.mjs`); six run
  `--check` in CI (`audit-self.yml:293,298,300,304,308,1394`). Entry docs already carry
  renders: `AGENTS.md:26` (rule index), `INSTALL-FOR-AI.md:79` (install roster). The
  invariants render from README into the digest hook (`render-invariants.mjs:3`,
  `.claude/hooks/inject-session-bootstrap.sh:73`).
- Refresh gate today: a deferral token never expires
  (`scripts/check-docs-refresh.mjs:302-346`); 65 tokens on 60 of 61 pages; at `9f69fa2097c`,
  61 of 66 were not real alarms by their own reason text (a judgment).
- Replay of 50 merges, 626 file-level alarms (the replay in the evidence patch): 245 silent, 27 real, 354
  unbound (source cited as a bare path; 50 pages, 27 merges; `install.sh` in 48).
- Entry docs outside the citation gate: 20 stale citations of 27; the tool suggests a line for
  13. Set: README.md, INSTALL-FOR-AI.md, INSTALL.md, docs/meta-factory/EXECUTION-PLAN.md,
  packages/core/templates/shared/first-steps.source.json; command
  `node scripts/check-line-citations.mjs --check --show-skips <set>`.
- 1573 tracked markdown files; 217 in no class by mechanical predicates (measured at
  `9f69fa2097c`; predicates in the evidence patch).
- Node: needed at install and local gate time only on npm lanes today; python CI sets up Node
  20 (`packages/core/templates/python/github-actions-ci.yml:41-46`); cargo and go have no Node
  and no local git hook.
- cargo and go lanes install no passport and no agent surface: `install.sh:675-683` exits
  before the npm layers; `grep -c DESCRIPTION` over their four install fingerprints gives 0.
- A red docs gate on work from an agent container returns the task to nobody:
  `packages/runtime-bridge/src/cli/harvest.ts:58-60` prints manual commands and exits non-zero.
- At a consumer two machine-readable records already exist and no doc renders from them:
  rules-lock (rule ids, provenance, fingerprint) and `.ai-factory/refresh-baseline.json`
  (`setup.d/lib.sh:255`, sha256 per delivered path).
- The goal is typed by hand in seven places with three different wordings (`AGENTS.md:11`,
  `.claude/skills/orchestrator/references/worker-template.md:26`,
  `.claude/session-bootstrap.md:11`, `docs/meta-factory/EXECUTION-PLAN.md:21`,
  `.claude/hooks/inject-session-bootstrap.sh:67`,
  `docs/site/reference/D/inject-session-bootstrap.md:76`,
  `docs/site/reference/D/inject-subagent-digest.md:67`); eight places are enrolled in the D3
  probe (`audit-ai-docs.ts:42-60`; shell twin `audit-ai-docs.sh:155`, shipped by
  `setup.d/40-configs.sh:14`). The tagline form is typed in four more places no probe sees
  (`packages/getff/package.json:5`, `packages/getff/README.md:3`, `packages/getff/bin/getff:33`,
  `docs/site/reference/G.json:29`). README itself holds no one-line goal (`:45`, `:57` only).
- The shipped passport template today: `DESCRIPTION.template.md:7` «NOT authoritative for:
  project goal»; AI Factory's own passport skeleton has no goal, «never» or non-goals section
  and uses localized headings (`aif.md:444-462`).

## Named for the owner at approval (accepted with OP-51; the one fork, MAJOR-C, answered as OP-50)

- README stops being the home of the invariants: they move into the passport region with the
  goal (follows T-Q2 and OP-42; OP-42 did not say it in words).
- Cost of N-Q3: wherever a docs red is fixed, Node must be present; the fixing agent obtains
  it. The only way to remove the cost, a non-Node engine, reverses N-Q3.
- Who may change a decided line (round-2 MAJOR-A): the T12.5 / T12.6 rules carried over from
  README to the passport region; only a goal scope line is added without a question. Honest
  cost (T12.6): the consent trailer proves the sentence was read, not who typed it; the human
  floor is the second look at promote.
- A red with no agent present (round-2 MAJOR-B): PENDING until the next agent session; reds
  outside a session reach an agent through a hand-over requirement, not a human.
- Uncited typed values (round-2 MAJOR-C): the B-Q2 PR-boundary check covers them too, because
  the alternatives either narrow the goal to cited values only or add a scheduled sweep whose
  red has no consumer (decided OP-50).
- cargo and go (round-2 bottom-up MAJOR-1): they get the passport and agent surface; until P2
  delivers, they are named as not yet delivering the design.

## Known open details (deliberately below the top level)

- What a «named place» is per source type (markdown heading, shell function, JSON path, line
  range with a content signature); the marker syntax of the passport region.
- Which gate runs at which channel (edit-time, pre-commit, pre-push, CI) for getff and for a
  consumer.
- Upgrade path for an already installed consumer.
- The legacy sweep order and the clean-up of the 28 umbrellas without `done.md`; the value of
  N for idle umbrellas.
- AI-Factory-written passport sections and AGENTS.md (T-Q4b): which sections, and how the
  region survives them; first thing to try: the skill-context channel `aif.md:87-89`.
- The predicate for «a spec's design is built» (91 specs, free-form status lines today).
- The lock on a merge commit: «same commit» is judged against both parents.

## Testing seams

Existing seams, preferred: `--check` mode of each renderer; the self-test of
`scripts/check-line-citations.mjs`; the install fingerprints under
`tests/install-sh/baselines/`; the principle tests under `packages/core/principles/`.
