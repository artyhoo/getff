<!-- scope:ai-navigability-what-getff-installs -->
# Why an AI agent cannot answer «what does getff install and generate?» — and what would gate it

> Scope: phase 1 of the 2026-09-27 «one button end to end» request. The question is navigability, not
> function: why a cold AI agent reading this repository answers «is getff turnkey for a fresh
> React/Next project?» wrongly, and which **gate** (not «clearer prose») would stop each confusion.
> Phase 2 (designing the one-session install chain) is out of scope until the operator signs this off.
> All citations are against `origin/staging` at `a0f96816812` (re-pinned from the probe SHA `7f0174c0bfa`;
> only `install.sh` lines moved) unless a line says otherwise.

## Problem

The operator asked one question — «will getff install everything a project needs with one button:
skills, MCP, rules and tests; is it generated automatically, at least for React; is it turnkey?» —
and the answering session needed three pushbacks to reach the right answer. The right answer, backed
by code and a real install on 2026-09-27, is:

- The **install command** (`./setup -y react-next`) deploys skills, agents, hooks, configs and one
  MCP server (context7). It generates **no rule and no rule test**.
- getff's product is **generated rules, each shipped with a firing test and a paired negative**. That
  only happens after an agent runs `/rule-research` and the installer is re-run with `--full`
  (`setup.d/80-rule-bootstrap.sh:48-54` prints «Shipping no synthesized rule this pass» otherwise).
- The design says the installing agent continues into `/rule-research` in the same session
  (`INSTALL-FOR-AI.md:568-576`). The prompt the agent actually executes ends at «Stop here»
  (`INSTALL-FOR-AI.md:107`) and never names it. So «one button» is designed and not wired.
- The design is not new: a binding spec of 2026-07-23 decided «one beat» and a cold-run acceptance
  for it; the acceptance run was parked at closure and never run (N15).

This patch measures where a cold reader goes wrong and why.

## Method

1. **Population first (T10).** Every surface a cold agent can reach to answer the question was listed
   and read for four facts: (a) what the product is, (b) what «tests» means here, (c) the install
   chain order including `/rule-research`, (d) which rule surfaces are live and which are frozen.
2. **Cold probes (T21 shape, SSOT #239 method).** Three fresh sub-agents, three model sizes (Opus,
   Sonnet, Haiku), each given a clean clone at `7f0174c0bfa` and only the operator's question
   (translated), read-only, no network, no files outside the clone. Each returned an answer, a
   navigation log and a confusion list.
3. **A fourth sample:** the answering session's own six failed approaches, recorded in the handoff
   `_handoff-2026-09-27-ai-navigability-one-button.md` before this research started.
4. **Code trace** of every claim a probe made, and of the one open contradiction (PR #746).

External grounding (T11/T12): WebSearch ×2 on doc-evaluation-by-agent. The relevant signal is that
agent evals score both the final answer and the trajectory, and that documentation effects are
model-specific (Agent-Diff, arXiv 2602.11224). That is why the probes vary the model and ask for a
navigation log, not only an answer.

## §1 Population — which surface tells a cold agent the four facts

`Y` = states it where an agent reading top-down meets it; `tail` = states it only after the part an
agent executes or skims; `—` = absent; `✗` = states the opposite of the code.

| Surface | (a) product | (b) «tests» = rule tests | (c) chain incl. research | (d) live vs frozen |
|---|---|---|---|---|
| `README.md` §What you get today (`:15-36`) | frozen preset + tooling | ✗ lists app-test tooling only (`:31-36`) | — | ✗ presents R1–R20 as the rules (`:27`) |
| `README.md` §Installation (`:139-158`) | «one-click orchestrator», 4 steps | — | — (4 steps, no research) | — |
| `README.md` AI prompt (`:251-278`) | — | — | ✗ ends «Stop here» (`:278`) | ✗ «Read RULES.md (R1-R11)» (`:268`) |
| `INSTALL-FOR-AI.md` prompt (`:48-116`) | — | — | ✗ ends «Stop here» (`:107`) | ✗ routes to R1–R20 (`:103-105`) |
| `INSTALL-FOR-AI.md` tail (`:568-600`) | Y | Y «rules are tested for firing» (`:574-575`) | tail | tail |
| `INSTALL.md` (549 lines) | — | — | — (0 mentions of `rule-research`) | — |
| `docs/site/quick-start.md` | «copies the rules» (`:24`) | — | — | — |
| `docs/site/installation.md` | «One command» (`:42`) | — | — | — |
| `docs/site/terms.md` glossary | `rule`, `gate`, `fire` | — (no `test`, `rule test`, `research`, `generated rule`, `preset`) | — | — |
| `docs/site/llms-head.txt` (the map an agent reads first) | «installs with one command» (`:3`) | — | — (no mention of research) | — |
| `docs/site/ai-agents.md` three agent prompts (`:60`, `:76`, `:99`) | — | — | — (the install prompt ends at a `--dry-run`, `:85`) | — |
| `setup.d/99-finalize.sh` printed Next steps (`:450-484`) | — | — | — (7 numbered steps, no research) | ℹ note outside the list (`:113-118`) |
| `setup.d/99-finalize.sh` code comment (`:102`) | — | — | — | Y «Live-research is the DEFAULT … presets are the FALLBACK» |
| `setup.d/LAYERS.md` | — | — | layer 80 one row (`:142`) | — |
| `plugin/` 0.3.2 | soft layer | — | ✗ `/getff:install-enforcement` runs `install.sh` without `--full` (`plugin/commands/install-enforcement.md:41-46`) | — |
| `agents/rule-researcher.md`, `skills/rule-research` | Y | Y | Y | Y |

**Reading of the table.** The four facts are all true and all written down — in the tail of one file,
in a code comment, and in the research agent's own prompt. None of them is on a surface an agent
reads **before** it forms its answer. Every entry surface (README top, both copy-paste prompts, the
site quick start, the glossary, the printed Next steps) describes the pre-2026-06-28 product: a
frozen rule preset plus test tooling.

## §2 Cold-probe results

| Probe | Verdict | Named `/rule-research` as a step? | «Tests» read as | «Rules» read as | deepwiki skip under `-y` | Other errors |
|---|---|---|---|---|---|---|
| Haiku | «Partly» | no | «business logic tests: NO» | R1–R20 preset, «review and trim» | not found | «typecheck should pass» (measured RED); «HIGH» confidence on every row |
| Sonnet | «Partly» | no — «no such generation step exists in the code I read» | «test infrastructure … no actual tests of your app» | R1–R20 preset | found (`engine.sh:68-72`) | «11 files» agents (install ships 12: `tests/install-sh/baselines/react-next/greenfield.fingerprint`) |
| Opus | «Partly» | **yes** — step 7, then `./setup --full` | «no tests of your own code» first; rule firing test named as a post-research artefact | preset automatic; generated rules after research | found (`engine.sh:61-72`) | still lists «trim RULES.md» as a step; reached the chain only by reading ~30 code files (`setup.d/*`, `lib.sh`, `80-rule-bootstrap.sh`) |
| This session (pre-research) | «no, not turnkey» (correct, after 3 pushbacks) | only after pushback | app tests first | ESLint 9 / Next-15 preset first | found after pushback | answered from README «a skill» |

**Shared errors.** 2 of 3 probes and this session never reached `/rule-research`. 3 of 3 probes and
this session led with «tests» as tests of the consumer's app. 3 of 3 probes kept the frozen preset
as a step to review and trim. Sonnet traced code carefully (hooks path, MCP gating, deps gating) and
still concluded the generation step does not exist.

**The one probe that got the chain right got it from code, not docs.** Opus's navigation log reads
`setup.d/80-rule-bootstrap.sh`, `agents/rule-researcher.md` and the skill tiers in `lib.sh` before it
names research; no prose surface in its log states the chain. So the correct answer is reachable, but
only by a reader that out-reads the documentation — which is exactly what a navigable repo should not
require.

**An earlier in-class run does not contradict this.** `docs/site/ai-agents.md:19` records a
2026-09-21 run of the site's «Evaluate» prompt («what an install would add», `:60-62`) that the agent
answered correctly (`:65-71`). That question asks what the install *writes*, and the install writes
no rule — so a correct answer there never has to name research. The operator's question asks what is
*generated*, which is where all three probes went wrong.

The probes also found things this session missed: Sonnet found the husky contradiction (N7); Opus
found the default-profile contradiction (N12), six smaller doc/code conflicts (N13) and a possible
break in the research re-run (N14).

## §3 Findings — confusion sources, evidence, and a gate for each

Each fix channel is a gate or a named cold-agent protocol, per
[`attention-is-not-a-mechanism.md §1`](../../../.claude/rules/attention-is-not-a-mechanism.md).
«Write clearer prose» is not offered for any of them.

### N1 — «Tests» has no definition on any entry surface (vocabulary collision)

- `README.md:31-36` lists Vitest, Stryker, Playwright and Storybook as what you get — all tooling for
  the consumer's app tests. The per-rule firing test is not listed.
- `docs/site/terms.md` has entries `rule` (`:74`), `gate` (`:83`), `fire` (`:102`) and no `test`,
  `rule test`, `firing test` or `paired negative`.
- Result: 3/3 probes plus this session answered «getff does not write tests for your code» — true and
  beside the point.
- **Gate:** (1) glossary entries `rule test` and `generated rule` in `docs/site/terms.md`, with a
  principle arm that fails when the README «What you get today» section does not name the rule test
  as a delivered artefact (lexical presence check on a fenced region; reuse the fence protocol of
  SSOT #203/#204). (2) Add the operator's question to the cold-run acceptance (N10).

### N2 — The «live research is the default» decision lives in a code comment

- The positioning exists: `setup.d/99-finalize.sh:102` «Live-research is the DEFAULT stack-rule
  delivery; presets are the FALLBACK baseline.»
- No entry surface states it. `README.md:27` and `:234` present R1–R20 as the rules;
  `docs/site/quick-start.md:24` «The installer copies the rules».
- Result: 3/3 probes and this session took the frozen preset for the product, and spent effort on its
  ESLint 9 pin and Next-15 snapshot.
- **Gate:** one rendered claim line («stack rules are generated per project by `/rule-research`; the
  shipped preset is the fallback») in a fence rendered from a single source into README §What you get,
  both prompts and the site quick start. The fence's `--check` mode fails on drift (SSOT #203/#204,
  the `install-roster` fence at `INSTALL-FOR-AI.md:79-82` already works this way).

### N3 — The chain is broken inside the text the agent executes

- `INSTALL-FOR-AI.md:107` «Stop here.» The continuation into research is only at `:568-576`, after the
  code block the agent copies.
- `README.md:278` — the second copy-paste prompt — also ends «Stop here» and never names research.
- The installer's own numbered Next steps (`99-finalize.sh:450-484`) list 7 steps without research;
  the research pointer is an `ℹ` paragraph outside the list (`:113-118`) — the
  `#warning-nobody-reads` shape.
- Result: 2/3 probes never named `/rule-research`; the third (Opus) reached it from code, not from any prompt.
- **Gate:** an ordered-chain SSOT (consent → install → passport → tools → research → re-run → verify)
  rendered into both prompts and the Next-steps banner; a principle arm asserting every step of the
  chain appears, in order, inside each executed prompt block. Phase 2 decides the chain itself.

### N4 — Two copy-paste install prompts that disagree

| Point | `INSTALL-FOR-AI.md` prompt | `README.md` prompt |
|---|---|---|
| Command | `setup -y <stack>` (`:65`) | `setup <stack>` without `-y`, «deploys the framework files only» (`:259-263`) |
| Passport | «DO NOT fill them yourself» (`:101`) | «fill in <PROJECT_NAME> … Save as DESCRIPTION.md» (`:265-267`) |
| Husky | not mentioned | «run `npx husky init`» (`:275`) — contradicts the code (N7) |
| End | «Stop here» (`:107`) | «Stop here» (`:278`) |

- **Gate:** one prompt source, rendered into both places (same fence protocol); the second copy
  becomes a rendered region, never hand text.

### N5 — The passport step contradicts itself, and its agent has no caller

- `INSTALL-FOR-AI.md:28` (ALWAYS, no asking): «Fill `<PLACEHOLDER>` markers in
  `DESCRIPTION.template.md` …». `INSTALL-FOR-AI.md:101`: «DO NOT fill them yourself».
- `agents/aif-init.md` (PR #610) can fill the passport. `grep -rn aif-init` over `setup.d`, `setup`,
  `skills`, `plugin`, `.claude/hooks`, `packages/core/hooks` finds only the copy list `install.sh:232`
  and a comment at `setup.d/45-python.sh:1240`. The consumer `AGENTS.md` lists it among «review and
  audit seats» (`packages/core/templates/shared/AGENTS.md.template:99`) — a listing, not a step that
  calls it. Nothing invokes it.
- **Gate:** a shipped-agent reachability arm: every agent in the install roster must be **invoked** by
  at least one executed step (a prompt step, a skill step, a hook, or a numbered Next-steps item). A
  roster listing such as `AGENTS.md.template:99` does not count — otherwise `aif-init` already passes.
  Same shape as the population derivation in principle 21 (#1852).

### N6 — Machine-global consent never reaches the human

- `-y` skips machine-global companions and prints one line (`setup.d/engine.sh:68-72`). The prompt
  runs `-y` (`INSTALL-FOR-AI.md:65`); «ask first before `--global`» is at `:27`, outside the prompt.
- deepwiki is one of those companions (`setup.d/companions.manifest:19`, `--scope user`), and
  `agents/rule-researcher.md:6,107` uses it «when available» — so research quality degrades silently.
- Sonnet found the skip; Haiku did not.
- **Gate:** the chain step «consent» (N3) becomes a required prompt step, asserted by the same arm;
  the design of a batched consent question is phase 2.

### N7 — Stale husky instructions contradict the installer

- `INSTALL.md:408` and `README.md:275` instruct `npx husky init`.
- `setup.d/50-hooks.sh:85` sets `core.hooksPath` directly «instead of `npx husky init` (which would
  CLOBBER …)», and `setup.d/99-finalize.sh:481` prints «do NOT run 'npx husky init'».
- Found by the Sonnet probe, not by this session.
- **A gate for this exact claim already exists and misses these copies.**
  `tests/install-sh/f8c-no-husky-init-advice.test.sh:2` «install.sh "Next steps" must NOT advise
  `npx husky init`» — its acceptance is the install runtime output (`:11`), so the two prose copies
  are out of its population.
- **Gate:** widen the f8c population to the consumer-facing docs (README, INSTALL.md,
  INSTALL-FOR-AI.md, `docs/site/**`), not a new mechanism.

### N8 — Hand-typed counts beside a rendered roster

- Agents: `README.md:20` and `:232` «11» (omit `docs-form-auditor`); `INSTALL-FOR-AI.md:80`
  (rendered) «12»; `:97` «confirm the 11 files»; `:370` «10 files at every depth». The captured
  install ships 12 (`greenfield.fingerprint`). Skills: `README.md:19` «A skill» vs 11 at `env`.
- Sonnet repeated «11»; this session repeated «a skill».
- **Gate:** extend the existing `install-roster` render (`scripts/render-install-roster.mjs`) to own
  every count in these files, or delete the hand counts; a principle arm fails on a bare number next
  to «agents»/«skills» outside a rendered region.

### N9 — Overloaded names

- «generator»: PR #746 wired the deterministic `synthesize.ts` (re-emits R12/R14/R20 from recipes,
  `packages/core/install/synth-and-wire.ts:37-40` pins `next` `15.4.0`); the live generator is
  `generate.ts` behind research (`80-rule-bootstrap.sh:1-19`). Both are «the generator» in PR titles.
  This is what made #746 look like it contradicted «Shipping no synthesized rule».
- «one-click» is `./setup` (`README.md:147`); «one-button» in code is GLM runtime wiring
  (`scripts/getff-glm-onebutton.sh:2`).
- `getff init` is the advertised verb (`README.md:10`, `:112`); npm `getff` is a placeholder
  (`INSTALL-FOR-AI.md:19`).
- **Gate:** CONTEXT.md / `terms.md` entries with a «Do not use» line (the glossary's own pattern,
  `terms.md:80`), plus the existing glossary-inject hook. Lower priority than N1–N5.

### N10 — The acceptance probe that would have caught all of this exists and is dormant

- `agents/getff-cold-run-prober.md` (SSOT #239) is «Status: DORMANT» and hands a fresh subagent only a
  consumer path. This patch ran the same method by hand.
- **Gate (named cold-agent protocol):** re-arm it with the operator's question as a fixed acceptance
  item and a pass predicate: the answer must name `/rule-research`, the rule firing test, and the
  `--global` consent. Session-bound, $0-in-CI (`no-paid-llm-in-ci.md`).

### N11 — Plugin path is a second, weaker chain

- `/getff:install-enforcement` runs `install.sh` without `--full`
  (`plugin/commands/install-enforcement.md:41-46`), so no MCP, no dependencies, and layer 80 never
  runs (`80-rule-bootstrap.sh:25-27`).
- The plugin ships the `rule-research` and `rule-tests` skills but not the `rule-researcher` and
  `rule-test-author` agents they delegate to (`plugin/agents/` holds 4 files;
  `plugin/skills/rule-research/SKILL.md:24` «open `agents/rule-researcher.md`»).
- `install-enforcement.md:29` says the installer is «pinned to the plugin version»;
  `plugin/install/fetch-and-wire.sh:22-30` tracks `main`.
- **Gate:** phase 2 input; the reachability arm of N5 applied to the plugin twin catches the missing
  agents. The pin claim (`:29`) has no gate yet; it belongs in the claim-liveness population of
  N7/N13.

### N12 — Three surfaces name the wrong default depth

- The code resolves `PROFILE="env"` (`install.sh:654`).
- `install.sh:560` «core (default)», `setup.d/LAYERS.md:62` «`core` default for non-TTY», and
  `INSTALL-FOR-AI.md:160` `setup -y <stack>  # core` say otherwise; `INSTALL-FOR-AI.md:68` says `env`.
- Found by the Opus probe.
- **Gate:** the default depth becomes one rendered token sourced from the resolver, like N8's counts.

### N13 — Smaller doc/code conflicts on the same entry path (Opus probe, re-verified)

- context7: `skills/tool-bootstrapping/templates/tool-decisions.md.template:24` «NOT auto-installed»,
  while `setup.d/05-mcp.sh:38-49` writes it to `.mcp.json` under `-y`.
- «project-scoped companions»: `INSTALL-FOR-AI.md:27` promises `-y` installs them; every
  `companions.manifest:17-21` row is user-scope or global, so `-y` installs none of them.
- `README.md:245` lists adding package.json scripts and `npx depcruise --init` as manual steps;
  `setup.d/70-deps.sh` merges the scripts and `40-configs.sh:474` ships the depcruise config.
- **Gate:** the claim-liveness family (principle 45) over the consumer entry surfaces — the same
  population widening as N7.

### N14 — The research re-run may not run from a fresh clone (INCONCLUSIVE-needs-run)

- `80-rule-bootstrap.sh:75` runs `npx --no-install tsx` from the framework checkout; a fresh clone has
  no `node_modules`, and `:70-73` already admits the published package ships no tsx/ajv.
- Not measured. It matters for phase 2 because the whole chain ends in this re-run.
- **Gate:** the phase-2 acceptance run (the `pc-probe.sh` fresh-install probe extended by a research
  fixture) measures it.

### N15 — «One beat» was already decided, half-wired, and closed without its acceptance run

Found by the backward sweep for this patch's PR, after the operator signed phase 1 off.

- **Decided.** The binding spec `docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md`
  D1 (`:72-76`): «After install the agent MUST continue into research→rules in the same session
  without a second human prompt.» Work item W3 puts the continuation clause in `INSTALL-FOR-AI.md`
  and the delivered starter `AGENTS.md`, with an explicit opt-out; its binding Done line (`:226-227`)
  is that the one-beat cold-run protocol (§9.3, `:279`) passes on a fresh python consumer.
- **Wired where the installing agent is not looking.** S3 (#1253) added the clause after the prompt
  (`INSTALL-FOR-AI.md:568`) and in `packages/core/templates/shared/AGENTS.md.template:75`. It kept the
  prompt's «Stop here» and re-read it as «stop feature work» (`INSTALL-FOR-AI.md:570-572`). The
  consumer `AGENTS.md` does not exist until the install writes it, so the agent that runs the install
  read its instructions before the clause existed; whether a harness picks the new file up in the same
  session is INCONCLUSIVE-needs-run. The opt-out shape was parked as an operator decision
  (`INSTALL-FOR-AI.md:593-600`) and is still open.
- **Closed without its acceptance — twice.** The spec's named acceptance for D1 is the one-beat
  cold-run (`agents/getff-cold-run-prober.md`, SSOT #239). At umbrella closure the run was PARKED
  because the container could not produce a cold agent
  (`.claude/orchestrator-prompts/getff-any-stack-trace/done.md:22`), and deferred to the host. The
  successor umbrella scheduled that host run as its S5, «its FIRST run, not a re-run»
  (`.claude/orchestrator-prompts/getff-freshness-widening/kickoff.md:79-87`). S2-S5 were never
  dispatched, and that umbrella was closed too (`getff-freshness-widening/done.md:17`). No run is
  recorded anywhere: the prober is still «Status: DORMANT» (`agents/getff-cold-run-prober.md:14`),
  and `gh search prs "cold-run-prober"` (2026-09-28) returns #1257 and #1262 (the authoring PRs) and
  #1832 (it edited a different prober). Both umbrellas are marked DONE.
- **This patch's §2 probes are that deferred run, approximately** (a framework clone, not a fresh
  consumer — see §6). It fails: 2 of 3 cold agents never name `/rule-research`.
- **The «tools» step of the operator's button is level 2, still a stub.**
  `.claude/orchestrator-prompts/stack-tooling-generation/kickoff.md` is «STUB — unfold before
  dispatch». Its gate file exists, but the umbrella behind it closed without dispatching the
  two-client ledger it was meant to plug into
  (`.claude/orchestrator-prompts/getff-freshness-widening/done.md:17`).
- **Gate:** no new mechanism. (1) Run the parked protocol on the host and treat its verdict as the
  phase-2 acceptance. (2) An umbrella `done.md` whose acceptance run is PARKED, or was scheduled in
  a stage that was never dispatched, should not count as closed — today both do, which is the
  `#hope-as-gate` shape (`attention-is-not-a-mechanism.md §2`). Phase 2 starts from this spec, not
  from a blank page.

## §4 Root cause

The product changed on 2026-06-28 (research is agent-driven and is the default rule delivery) and the
code followed it: layer 80, the D3 notice, `rule-researcher`, `rule-test-author`. The **entry
surfaces were not re-derived** from that decision — they were patched line by line, so the old story
(«frozen preset + test tooling, then stop») stayed at the top of every file and the new story was
appended at the bottom. No gate ties the entry surfaces to the chain the code implements, so nothing
failed when they diverged. Each confusion above is one instance of that single gap.

A second pattern sits under it: **where a gate exists, it guards one copy of a claim, and the other
copies drift.** The f8c test guards the printed banner and not README/INSTALL.md (N7); the roster
fence guards `INSTALL-FOR-AI.md:79-82` and not the count four lines below it (N8); principle 21 until
#1852 guarded four of fourteen skills. The fix channel is therefore mostly **widening existing gate
populations**, not new mechanisms.

A third pattern explains why the first two survived a program that was aimed straight at them (N15):
**the one check that measures the chain through a cold reader's eyes was parked at closure, and a
parked acceptance did not block the umbrella from closing.** Every deterministic cell stayed green
because none of them reads the docs the way an agent does.

## §5 Fix channels — summary (inputs to phase 2, not decisions)

| # | Gate | Channel | Reuse |
|---|---|---|---|
| N1, N2, N4 | Rendered fences for the product claim, the chain and the single prompt, with `--check` | pre-commit / pre-push | SSOT #203, #204; `render-install-roster.mjs` |
| N3, N6 | Principle arm: every chain step present, in order, in each executed prompt | pre-push | principle framework |
| N5, N11 | Principle arm: every shipped agent has an invoker (source and plugin twin) | pre-push | principle 21 derivation (#1852) |
| N7, N13 | Widen f8c and claim-liveness populations to every consumer entry doc | pre-push | `f8c-no-husky-init-advice.test.sh`; principle 45 family |
| N8, N12 | Counts and default depth rendered from the resolver; bare-count ban outside rendered regions | pre-push | `install-roster` fence |
| N14 | Measured in the phase-2 acceptance run | session-bound probe | `pc-probe.sh` |
| N9 | Glossary entries with «Do not use» | edit-time inject | `glossary-inject` hook |
| N10 | Re-armed cold-run prober with the operator's question | session-bound cold agent | SSOT #239 |
| N15 | Run the parked one-beat protocol on the host; a PARKED or never-dispatched acceptance blocks `done.md` | session-bound cold agent + closure check | SSOT #239; spec 2026-07-23 §9.3 |

## §6 Coverage and confidence (T6, T14)

- Surfaces enumerated: 14 rows above. Read in full for the four facts: README, both prompts,
  INSTALL-FOR-AI tail, 99-finalize, 80-rule-bootstrap, plugin command. Read by grep count only:
  `INSTALL.md`, 4 site pages, `LAYERS.md`. Not read: the 57 other `docs/site/**` pages.
- Probes: 3 models × 1 run each (Haiku 14 tool calls, Sonnet 35, Opus 53). Calibration: NONE —
  first run; one run per model cannot separate model variance from doc effect. The signal is the
  errors shared across probes, and that the only correct chain came with the deepest code reading.
- Every probe-reported contradiction used in N7, N12, N13 was re-read at its cited line before it
  was written here. N14 is not measured.
- The probe transcripts are not in the repo (they lived in a session scratchpad). The prompt is
  reproduced verbatim in the appendix, so the run can be repeated; the numbers above cannot be
  re-checked from the repo alone.
- Contamination: probes ran with the machine-global `~/.claude/CLAUDE.md` loaded (it mentions aif and
  deepwiki); none of them read the handoff, which is gitignored and absent from the clones.
- The RED fresh-install gates (typecheck, lint, test, build, validate) are real but belong to chip
  `task_aa05bd63`; they are cited here only where a doc promises the opposite
  (`INSTALL-FOR-AI.md:94` «should pass on a fresh project»).

## Solution

Recording-side only: this patch. Every fix is a phase-2 input (§5), not done here (T5). Phase 2
starts from the binding 2026-07-23 spec (N15), not from a blank page.

## Prevention

- Before shipping a product-level decision that changes the chain (as on 2026-06-28), also re-derive
  every entry surface that states the chain, and add it to a rendered or gated population (§5 rows
  N1-N4); patching the surfaces line by line is what left the old story on top.
- Before closing an umbrella, also check that its named acceptance run happened: a `done.md` that
  records it as PARKED, or schedules it in a stage that was never dispatched, is not closed (N15).

## Tags

`#two-prompts-drift` · `#hope-as-gate` · `#discipline-application-scope-blindness` · `#parked-acceptance-closure`

## §1.7 self-review (recursive self-application of this very patch)

### §1.7 Forward-check applied

- [`attention-is-not-a-mechanism.md §1`](../../../.claude/rules/attention-is-not-a-mechanism.md):
  thirteen findings name a deterministic gate or a named cold-agent protocol. Two do not, and say
  so: N9's glossary entries plus edit-time injection are a reminder channel, not a gate (ranked
  below N1-N5); N14 is a measurement to run, not a gate. N11's pin claim has no gate today and is
  routed to the claim-liveness population.
- [`ai-laziness-traps.md`](../../../.claude/rules/ai-laziness-traps.md): T3 — every finding has a
  file:line or a command with its output; T10 — the population (§1) precedes the probes (§2); T6 and
  T14 — §6 states coverage and calibration as predicates, and what was not read.
- Negative-existence claims (phase-research-coverage §1.4): «no one-beat run is recorded» (N15) was
  checked with the counter-prompt «if it had run, where would it be recorded?» — the prober's status
  line, a PR quoting its verdict, either umbrella's `done.md`, a research patch. All four came back
  empty. «Nothing invokes `aif-init`» (N5) rests on a grep over executed steps and skills.
- Folder charter ([`research-patches/README.md:3`](README.md)): the five required sections are
  present (Root Cause is §4). The body exceeds the ≤100 LOC cap (`README.md:24`). Deviation, stated:
  15 findings share one root cause, and splitting them would lose it. Measured drift, not a
  precedent claim: 199 of 254 patches on `origin/staging` exceed 100 lines
  (`git ls-tree` over the folder + `wc -l`, 2026-09-28).
- Doc authority: patches inherit folder authority (`README.md:3`); the scope comment is line 1.
  Language: English. Capability commit: no — doc only (`Prior-art: skipped` trailer).
- Trigger sweep (§1.6): not applicable — this is not phase-entry research.

### §1.7 Backward-check applied

Class of this change = «a record that an entry surface tells an AI agent the wrong install chain, or
that the chain's acceptance run never happened». Surfaces where the class occurs, and a verdict for
each:

**(A) Earlier records in patches and specs.** Command:
`git grep -l -i '<phrase>' origin/staging -- docs/meta-factory/research-patches docs/superpowers/specs`.
Hits: «Stop here» 1, «cold-run-prober» 1, «install prompt» 5, «continuation clause» 2, «one beat» 1.

- `specs/2026-07-23-getff-any-stack-closure-design.md` — IN-CLASS: the binding one-beat decision.
  Folded into N15.
- `2026-08-07-getff-s3-cold-read-baseline.md:51` — IN-CLASS: the BEFORE baseline that S3 of that
  spec recorded («Continuation clause (spec §6.1 / D1): absent on both surfaces»). The spec produced
  the baseline, not the reverse. Folded into N15.
- `specs/2026-08-07-s-d-prime-subtraction-maps.md:355` — names the prober as the DORMANT acceptance
  probe and keeps it out of trimming. SWEPT-CLEAN: consistent with N10 and N15.
- `2026-07-02-doc-audit-delta.md:129` — IN-CLASS, fixed: the prompt used the legacy `setup.sh`
  entry. SWEPT-CLEAN today: the prompt runs `bash /tmp/getff/setup -y` (`INSTALL-FOR-AI.md:65`).
- `2026-05-27-install-sh-k1-extension.md:43,437` and
  `2026-05-27-stage-6-readme-update-verification.md:175` — the installer's own `read -rp`
  companion prompts, not the agent prompt. Adjacent to N6: this is the interactive question that
  `-y` skips. No conflict with N6.
- `2026-06-14-s3-workflow-merge-adopt-vs-build.md:225` — a dependency-install `[y/N]` prompt. Out
  of class.
- `2026-06-27-§13.32-A4-aif-integration-depth.md:174` — adjacent: third-party skill names on the
  same entry doc may go stale. Belongs to the claim-liveness population of N7/N13; not re-verified
  here.

**(B) Umbrella and stage records.** Command:
`git grep -n -i 'cold-run\|one-beat\|one beat' origin/staging -- .claude/orchestrator-prompts`.

- `getff-any-stack-trace/done.md:22` — PARKED run. GAP, recorded in N15.
- `getff-freshness-widening/kickoff.md:79-87` with `done.md:17` — the re-scheduled first run, never
  dispatched. GAP, added to N15 by this sweep.
- `consumer-truth-audit/gen-census.mjs:147` — the census lists the prober as framework-only.
  SWEPT-CLEAN.
- `consumer-truth-audit/kickoff.md:141` — lane V1, «do README/INSTALL-FOR-AI/AGENTS match V0's
  measured delivery», is the same class of check. No `report-v1.md` on `origin/staging`;
  `gh pr list --search "consumer-truth-audit in:title"` returns V0, V2, the V2 addendum, the V3R
  kickoff and the umbrella, no V1. GAP: a second doc-vs-delivery check that was planned and not
  run. Recorded here as a phase-2 input.

**(C) Entry surfaces an agent executes.** These came from the §1 population, not from the greps
above: the second prompt in `README.md:251-278` (N4) and the plugin command's weaker chain (N11),
neither of which the handoff listed; `docs/site/ai-agents.md` and `docs/site/llms-head.txt` (§1).

## Appendix — the cold-probe prompt (verbatim)

Sent unchanged to each of the three probes in §2; only the clone path differed.

```text
A developer is considering the framework in the repository at:
<clone path>

Their question, verbatim (translated from Russian):
"Will this framework really let me install everything a project needs with one button — skills, MCP, rules and tests? Is everything generated fully automatically, at least for React? Fully turnkey?"

Their project would be a fresh React/Next.js app.

Answer their question as exactly as you can, based only on the contents of that repository directory.

Constraints:
- Read only files inside that directory. Do not read anything under ~/.claude or any other path outside it.
- Read-only: do not run the installer, do not install packages, do not use the network, do not modify files. Reading, grep, ls, git log/show inside the directory are fine.

Report format (plain text, English):
1. SHORT ANSWER: yes / partly / no, one paragraph.
2. PER COMPONENT: for each of skills, MCP servers, rules, tests — what gets installed/generated for a fresh React/Next project, automatically or only after some extra step (say which step and who performs it), with a file:line citation for each claim.
3. WHAT DOES THE DEVELOPER (OR THEIR AI AGENT) HAVE TO DO after the install command, in order.
4. NAVIGATION LOG: the files you read, in the order you read them, one line each: path — what you took from it — whether it turned out to be accurate, misleading, or contradicted by another file.
5. CONFUSIONS: every place where you were unsure, found two files disagreeing, or had to guess. Quote the conflicting lines with file:line.
6. CONFIDENCE: which claims you verified in code vs only read in prose docs.
```
