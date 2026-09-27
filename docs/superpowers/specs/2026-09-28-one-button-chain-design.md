# getff one-button chain — design

> **Status:** DRAFT — `/arch` phase 1 in progress (round 2 open). Not reviewed, not approved. No
> code until the operator approves this spec.
> **Authoritative for:** the ordered one-button chain (install → consent → passport → tools → rule
> research → generator → green-project check → honest report), its decision register, and its
> acceptance.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> The «one beat» decision (D1) and its W3 continuation clause — owned by the
> [any-stack closure spec](2026-07-23-getff-any-stack-closure-design.md); this spec implements
> them. The RED fresh-install fix (stream 1) — owned by its own track (chip `task_41aac153`).
> Anchors: `origin/staging` `ba73c2e1cad` unless marked otherwise.

## 1. Goal

One agent session takes a fresh project from nothing to green: install getff → project passport →
tools (MCP + skills) → live rule research → generated rules, each with its firing test → a green
project. «One button» = one agent session, not one shell command (glossary:
[One button](../../../CONTEXT.md)).

Measured answer to «is it turnkey today?» (2026-09-27/28): **no** — the parts exist, the road between
them is not built. Evidence: [research patch N1-N15](../../meta-factory/research-patches/2026-09-27-ai-navigability-what-getff-installs.md)
and the N14 measurement in §3.

## 2. Operator premise register

Faithful to meaning; P1-P6 settled 2026-09-27/28, P7 added 2026-09-28.

| # | Premise | Source |
|---|---|---|
| P1 | getff's «tests» = the per-rule firing test + paired negative. Tests for the consumer's app code are NOT getff's product. | operator, 2026-09-27 |
| P2 | Machine-global installs (deepwiki MCP, superpowers, ast-grep via `--global`) must be ASKED of the human during install. Silent skip under `-y` is wrong. | operator, 2026-09-27 |
| P3 | One button = one agent session. | operator Q1=A 2026-06-28; closure spec D1 |
| P4 | ESLint `^9` pin and `preset-next-15-canonical` are legacy frozen surfaces — low priority, do not lead with them. | operator, 2026-09-27 |
| P5 | Order: this design → one-page truth card → ONE pass over README / INSTALL-FOR-AI / installer banner + gate widening → the getff.ai site adds the step. Docs are not fixed before the chain exists. | operator, 2026-09-28 |
| P6 | The getff.ai site is NOT the problem; the gap is the product chain. Messaging the site seat needs an explicit operator yes. | operator, 2026-09-28 |
| P7 | The generator already exists and is stack-general (built from the presets); the gap is the ROAD to it. Designs are stack-neutral — nothing Next-specific; Next.js was only the test subject. Hand-patching per-stack×version recipes does not scale. Operator words: «погоди загатовки уже были мы от них и создали гинератор а ты еще раз заново предлагаешь … вот этот некст вообще не всрался вообще у меня генератор под любой стек уже должен был быть готов». | operator, 2026-09-28 (round-1 discussion session) |

## 3. Starting point (not a blank page)

- The generator: `packages/core/synthesizer/{rule-bootstrap,file-clients,research-to-node,research-to-clippy-node,generate}.ts`,
  `agents/rule-researcher.md`, `.claude/skills/rule-research/SKILL.md` — JS/TS, Python, Rust (#805, #1005,
  #1006, #1010; IR unfreeze #1084).
- The road is cut in three places: (1) the pasted prompt ends «8. Stop here» (`INSTALL-FOR-AI.md:107`),
  the continuation clause sits after it (`:568-576`); (2) `setup.d/80-rule-bootstrap.sh:48-55` skips
  generation when the research pair is absent and nothing in the install writes it; (3) with the pair
  present the generator cannot start.
- **N14 measured 2026-09-28** (PC, staging `3636269b946`, react-next consumer, committed fixture pair
  `packages/core/synthesizer/fixtures/no-head-element.{research,selection}.json`): FAIL-CONFIRMED. Pass 2
  `./setup --full` exits 0 but generates nothing — `ERR_MODULE_NOT_FOUND: Cannot find package 'ajv'`
  from the framework clone (clone deps never installed); with an empty npx cache it fails earlier
  (`npx canceled … ["tsx@4.23.15"]`). Control: `npm ci` inside the clone → the same pass writes
  `.ai-factory/synthesizer-output/rules-lock.react-next.json` and wires the rule. Side findings: `setup`
  exits 0 on generator failure; `check-fences-fire.sh` probes only the 3 shipped fences, so it cannot
  tell «rule generated» from «no rule»; no separate firing-test file (the negative example lives in
  `rules-manifest-additions.json`, `run-rule-tests-firing.sh` is a no-op); the generated rule was merged
  into the wrong glob block (fired on `src/app/actions/probe.tsx`, not `src/app/layout.tsx`).
- The acceptance of the 2026-07-23 program (one-beat cold-run, SSOT #239) was dropped twice and never
  run (research patch N15); `agents/getff-cold-run-prober.md:14` is still «Status: DORMANT».

## 4. Live decision register

Round 1 (Q1-Q4) was decided in a separate discussion session at the operator's request («в отдельной
сессии подумать и обсудить как сделать лучше»); operator verdict on all of it: «ок согласен с тобой
полностью». Rows marked *blanket* were confirmed by that blanket agreement, not one by one.

| # | Decision | Status | Resolution | Falsifier («wrong if …») |
|---|---|---|---|---|
| Q1 | Where the chain's step order lives | answered (*blanket* for details) | **One scenario file in the getff clone owns the order and step details.** The pasted prompt carries a one-line-per-step list rendered from that file and drift-checked (install-roster fence precedent, `INSTALL-FOR-AI.md:79-82`). The list runs to the end: install → consent batch → tools → rule research → generator → green-project check → honest report; no «Stop here» before research. README, the plugin command and the site point at the same file. Rejected: whole chain in the prompt (drifts); plugin command as owner (Claude Code only, runs without `--full`, `plugin/commands/install-enforcement.md:13`). Why a file read by path: Claude Code does not pick up NEW skill dirs mid-session without `/reload-skills`, and CLAUDE.md loads at session start only (claude-code-guide, 2026-09-28) — the same trap that made the AGENTS.md continuation clause unreachable. | A cold prober agent given the new prompt still stops after install or abandons the file half-way → text is not enough; a mechanism (Stop hook / `/goal` loop, Claude Code only) is needed. |
| Q1.1 | Installer's final banner prints «next: step N of <file>» | answered (*blanket*) | Adopted as a secondary pointer (prior art: BMAD `next`, Task Master `autopilot_next`); the prompt list stays primary. | The banner and the prompt list disagree — both must render from the same file. |
| Q2 | Consent at the start | answered (*blanket* for details) | **One batch of exactly 4 questions before install** (one AskUserQuestion call): (1) confirm the stack; (2) machine-global companions → `--global`; (3) rule research now or skip — settles the parked opt-out shape (`INSTALL-FOR-AI.md:593-600`) as «asked at install time»; (4) tool proposals Y/n, omitted when there are none. Text-list fallback for agents without AskUserQuestion; only the main session asks (AskUserQuestion is unavailable in subagents). Installer and `-y` unchanged (S1-4, 2026-09-23). | On a prober run the agent starts setup before asking. |
| Q2.1 | Backstop if the agent skips the batch | answered (*blanket*) | Not a breaking «refuse `-y` without a global choice» (reverses S1-4). Instead the `-y` machine-global skip line (`setup.d/engine.sh:69-70`) becomes an explicit relay line: «ask the human: install X, Y, Z globally? command: …». | The agent skips both the batch and the relay line → the breaking backstop is back on the table. |
| Q3 | What «tools» means in the chain | answered | **Level 1 in the chain, level 2 out.** Level 1 = the existing `tool-bootstrapping` skill as a chain step. Level 2 (researched tooling) stays out; its stub (`.claude/orchestrator-prompts/stack-tooling-generation/kickoff.md`) plugs into a ledger never dispatched (`getff-freshness-widening/done.md:17`). | The operator's level-2 vision (tooling rot, e.g. Drizzle v1 rc) becomes the blocker for a green one-button run. |
| Q3.1 | Rule 2's proposal predicate (`skills/tool-bootstrapping/SKILL.md:31`) | answered | A proposal must name the project dependency that needs it; popularity only orders; zero proposals is valid (question 4 is then omitted). Measured 2026-09-28 with `npx skills search`: popularity alone surfaces generic or off-target skills (`next` → `find-skills` 3.6M first; `python` → an Azure deploy skill first). context7 is already written by `setup.d/05-mcp.sh:17-47`. | A prober run on ≥2 stacks still yields proposals the operator judges noise. |
| Q3.2 | Where the tool Y/n goes | answered | The dependency scan and search run before install (the skill is readable by path in the clone); its single Y/n joins the Q2 batch. | The scan needs installed state, so it cannot run before install. |
| Q4.0 | Is the RED fresh install intentional? | answered | **No.** `INSTALL-FOR-AI.md:94` «should pass on a fresh project»; `setup.d/60-ci.sh:39-40` «green-because-understood, never red-because-unconfigured»; getff's own configs hide its files (`eslint.config.react.mjs:68`, `.prettierignore:43-57`); the merge-blocking `framework-fresh-install-validate` job (`audit-self.yml:1468`) exists to keep it green. The intentional red is each rule's firing test (P1). | A shipped doc tells consumers to expect a red project after install. |
| Q4 | RED fix: separate track or folded in | answered | **Separate track now (stream 1)**, parallel to this design; chip `task_41aac153` replaces `task_aa05bd63`. This chain's acceptance starts from a green install. | The fix has to touch chain surfaces: the pasted prompt, installer flags or the step list. |
| Q4.1 | Mechanism for getff files in the consumer's lint/tsc scope, and for N14 | answered | Stream 1 ships getff's consumer-executed runtime as zero-dependency prebuilt `.mjs` bundles — the pre-push hook graph and the rule-bootstrap generator CLI (precedent `packages/core/install/synth-and-wire.bundle.mjs`, #763, drift gates `scripts/build-synth-bundle.sh --check` + `scripts/check-bundle-dep-parity.sh`). Resolves critical-review S5-9 in favour of the bundle. **For this chain: N14 is closed by stream 1, not here.** | The bundled generator still fails on a clean machine with an empty npx cache (it needs eslint + `@typescript-eslint/parser` at run time — measured in stream 1). |
| Q4.2 | Append an ignores block to a consumer-owned `eslint.config.mjs`? | answered | No append: bundles carry a `/* eslint-disable */` banner; consumer eslint config and tsconfig are untouched (the 2026-09-23 «skip + report, never overwrite or merge» decision, `setup.d/lib.sh:2708-2709`). | A consumer sets `linterOptions.noInlineConfig` or type-aware parsing of `.mjs` → stop and ask the operator. |
| Q4.3 | Which gate catches a RED fresh install | answered | Widen `framework-fresh-install-validate` with one cell per stack, each installing into a project that already has its own configs, running the full `INSTALL-FOR-AI.md` step-4 list (lint, typecheck, test, build, validate, first commit); watch it RED on today's staging first. | The new cell is GREEN on `ba73c2e1cad` before any fix. |
| Q4.4-4.5 | Stale preset templates; layout assumptions | answered | Stream 1, by class, as the Q4.3 gate exposes them; whether presets should ship config templates at all is handed to this design (R2 below). | A fix is stack-specific instead of layout-derived. |
| Q4.6 | N14 side findings (exit 0 on failure, blind fence check, wrong glob block, lock name) | answered | They belong to THIS chain program (links 6-8), not stream 1. | Stream 1's bundle cannot land without changing them. |
