# getff one-button chain — design

> **Status:** DRAFT r2. `/arch` phase 1 is complete; the §2 cold review has not run yet. Not
> approved; no code until the operator approves this spec.
> - Rounds 1 and 2 were decided in separate discussion sessions, at the operator's request.
> - Round 3 closed with no operator question. The frontier was diffed against the truth-pipeline
>   draft's register: every item was either settled there or is an author decision recorded here
>   with its falsifier (§5, rows R3-*).
>
> **Authoritative for:** the one-button chain. That means:
> - its ordered steps (the CONTENT of the step file);
> - the start round;
> - the consumer passport the chain leaves;
> - the green-project predicate and the final check's entry point;
> - the acceptance run and the closure rule.
>
> **NOT authoritative for:**
> - Project goal: see [README.md#why-this-exists](../../../README.md#why-this-exists).
> - The docs-truth contract and the step file's SHAPE, owned by the truth-pipeline contract spec:
>   - one fact, one source;
>   - generated regions really generated;
>   - drift checks at pre-push;
>   - the step schema and its gates;
>   - goal governance.
>
>   Until a landing session commits that spec under `docs/superpowers/specs/`, its draft is
>   `_design-2026-09-28-truth-pipeline.md` in the operator's coordination directory. The boundary
>   is drawn in §6.
> - The «one beat» decision D1: the [any-stack closure spec](2026-07-23-getff-any-stack-closure-design.md).
> - Stream 1 (the RED fresh install, prebuilt bundles): its own track, landed as #1860 and #1868.
>
> Anchors: `origin/staging` `f526c61c70a` unless marked.

## 1. Goal

One agent session takes a fresh project from nothing to green:
1. install getff;
2. the project passport;
3. tools (MCP servers and skills);
4. live rule research;
5. generated rules, each with its firing test;
6. a green project.

«One button» means one agent session, not one shell command (glossary:
[One button](../../../CONTEXT.md), [Passport](../../../CONTEXT.md), [Green project](../../../CONTEXT.md)).

The measured answer to «is it turnkey today?» (2026-09-27/28) is **no**. The parts exist, but the
road between them is not built. Evidence:
- the [research patch N1-N15](../../meta-factory/research-patches/2026-09-27-ai-navigability-what-getff-installs.md);
- §3 below.

## 2. Operator premise register

Faithful to meaning. P1-P7 were settled 2026-09-27/28 in this session and round 1; P8-P12 come
from the round-2 session (2026-09-28).

| # | Premise | Source |
|---|---|---|
| P1 | getff's «tests» are the per-rule firing test plus its paired negative. Tests for the consumer's app code are NOT getff's product. | operator, 2026-09-27 |
| P2 | Machine-global installs (the deepwiki MCP, superpowers, and ast-grep via `--global`) must be ASKED of the human during install. A silent skip under `-y` is wrong. | operator, 2026-09-27 |
| P3 | One button = one agent session. | operator Q1=A 2026-06-28; closure spec D1 |
| P4 | The ESLint `^9` pin and `preset-next-15-canonical` are legacy frozen surfaces: low priority, not something to lead with. | operator, 2026-09-27 |
| P5 | Order: this design → the one-page truth card → ONE pass over README / INSTALL-FOR-AI / the installer banner, plus gate widening → the getff.ai site adds the step. Docs are not fixed before the chain exists. *Realised* by the truth-pipeline's structured sources and their renders; there is no separate card file (R3-1). | operator, 2026-09-28 |
| P6 | The getff.ai site is NOT the problem; the gap is the product chain. Messaging the site seat needs an explicit operator yes. | operator, 2026-09-28 |
| P7 | The generator already exists and is stack-general (it was built from the presets); the gap is the ROAD to it. Designs are stack-neutral. Nothing is Next-specific: Next.js was only the test subject. Hand-patching per-stack×version recipes does not scale. «погоди загатовки уже были мы от них и создали гинератор а ты еще раз заново предлагаешь … вот этот некст вообще не всрался вообще у меня генератор под любой стек уже должен был быть готов». | operator, round-1 session |
| P8 | Convenience first. Every human touchpoint must be critical and narrow. Everything else is automatic, with an FYI line and a one-step revert. «все должно быть максимально автоматически - и только в самых узких местах где это действительно критично и важно нужно тревожить оператора». | operator OP-16, round-2 session |
| P9 | No passive agreement. The author argues its own view, including disagreement, and never flips a decision on a remark without weighing it. Convenience must not silently weaken a guard. «мне не нужно пассивное согласие я хочу чтобы было как можно лучше». | operator OP-17, round-2 session |
| P10 | The human writes nothing; the agent proposes, and never asks what the stack already tells. «человеку влом будет самому писать — надо предложить готовый вариант в виде вопроса»; «очевидные из стека вещи точно не нужно спрашивать у оператора». | operator, round-2 Q1 / Q1.5 |
| P11 | Docs, the passport, architecture and the docs site are ONE process, installed by the one button and written by AI from one source. «и все это в одну кнопку должно ставиться … человек точно не пишет». The truth-pipeline contract realises the docs side; this spec realises the chain side. | operator, round-2 Q7 |
| P12 | Recursive self-application: what getff ships as «one source per fact» also applies to the getff repo. «Да конечно должно рекурсивно на самом себе … это принцип нашего проекта!». Owned by truth-pipeline T13. It matters here because T13 step 4 gives the getff repo this spec's passport scheme. | operator OP-15, round-2 session |

## 3. Starting point (measured)

- **The generator.** The code lives in
  `packages/core/synthesizer/{rule-bootstrap,file-clients,research-to-node,research-to-clippy-node,generate}.ts`,
  `agents/rule-researcher.md` and `.claude/skills/rule-research/SKILL.md`. It covers JS/TS, Python and
  Rust (#805, #1005, #1006, #1010; IR unfreeze #1084).
- **The road is cut in three places.**
  1. The pasted prompt still ends «8. Stop here» (`INSTALL-FOR-AI.md:107`) and says the passport
     must NOT be filled by the agent (`:101`).
  2. With no research pair, generation is skipped (`setup.d/80-rule-bootstrap.sh:52`), and nothing
     in the install writes the pair.
  3. **N14.** Measured 2026-09-28: with the pair present, the generator could not start. **Closed
     by stream 1:** the step now runs the prebuilt `rule-bootstrap-cli.bundle.mjs` (`:31`), and a
     failed generation is named in the NOT-wired summary (`:80`).
- **The installer still asks the human to edit files.** Its closing echo says to review/edit
  DESCRIPTION.md and ARCHITECTURE.md and to edit AGENTS.md placeholders
  (`setup.d/99-finalize.sh:590-593`).
- **The step file already exists.** `packages/core/templates/shared/first-steps.source.json`
  (schema `getff.first-steps/v1`) keeps one sequence per depth.
  - `fill-passport` is a human step at every depth (`:45`, `:99`, `:141`).
  - `research-your-stack` exists only at core depth (`:75`); the default `env` depth has none.
  - Its two claimed renders are not generated (truth-pipeline draft N-k).
- **The passport is read by nobody on the chain path.**
  - The generator skips it: `resolveCtxForRoot` calls `detectStack(root, { skipAif: true })`
    (`packages/core/synthesizer/resolve-ctx.ts:59`).
  - The researcher never reads it.
  - `readAif` gives DESCRIPTION.md priority 1 and throws on a heading-less file
    (`packages/core/detector/read-aif.ts:98-110`).
  - `agents/aif-init.md` is shipped (`install.sh:232`) and reads only `package.json`, but nothing
    calls it.
- **The python road differs.**
  - The python lane delivers its agent surface and exits before the npm layer loop
    (`install.sh:383-389`). So `--global` and the companion engine do nothing there, and context7
    is replicated separately (`setup.d/45-python.sh:1283-1290`).
  - Python generated rules are ast-grep YAML (`agents/rule-researcher.md:164`). Without ast-grep,
    firing is «NOT proven» (`45-python.sh:529`).
- **Acceptance has never run.** The 2026-07-23 program's acceptance was dropped twice (research
  patch N15), and `agents/getff-cold-run-prober.md` is still DORMANT.

## 4. The chain

### 4.1 Steps

These steps become the one-button sequence in `first-steps.source.json` (R2-Q7). The shape
(`actor`, `when`, `run`, `doneWhen`, the step states, run-bound probes and coverage) is the
truth-pipeline's §6.2. The pasted prompt renders this list and runs it to the end, and so does the
installer banner (Q1, Q1.1). Every agent step's `run` is a file in the getff clone that the agent
reads by path (R3-7).

| # | Step | Actor | When | What happens | Done when |
|---|---|---|---|---|---|
| 1 | read-steps | agent | always | The pasted prompt clones getff and has the agent read this list by path. | `unverifiable`; proven by the acceptance run |
| 2 | start-round | agent, main session | always | One question round before anything is installed (§4.2). The agent writes the confirmed intent lines into the passport (R3-6). | The intent fence exists in `.ai-factory/DESCRIPTION.md` |
| 3 | install | setup | always | `./setup --full <stack>`, plus `--global` when accepted on an npm lane. Setup writes the stack block and renders the passport fences and the `@AGENTS.md` import (§4.3). | Setup's self-verify passes |
| 4 | tools | agent | tool proposals accepted | Installs the accepted MCP servers and skills (`tool-bootstrapping`, Rule 3). | `.ai-factory/tool-decisions.md` records the decision |
| 5 | research | agent | research = now | Runs the rule-research protocol. It reads the intent fence, and must-never lines become rule candidates (R2-P2). | The lane's research artefacts exist and are newer than the run stamp |
| 6 | generate | setup | step 5 ran | Re-runs `./setup --full <stack>` (R2-Q6). This renders the rules, the lock and each rule's fixture triple, then re-renders the rule → check table. | The lane's lock exists |
| 7 | check | setup, then agent | always | The final check (§4.4). | Green, or a list of every step not done, each with a fix line |
| 8 | report | agent | always | The report to the human, built only from step 7's output, plus the FYI lines. | — |

The installer runs the final check at the end of setup. Its first «not done» step is the banner's
«next: step N» line, so the banner and the check cannot disagree. This replaces the echo at
`99-finalize.sh:590-593`.

### 4.2 The start round

The questions come in this order, roots first. Each shows the recommendation as its first option,
and a bare go-ahead accepts every recommendation.

1. **Stack.** Asked only when detection is ambiguous: two or more lane manifests, or none.
   Otherwise the intro line names the stack and the file it came from (R2-Q1.5).
2. **Passport guess card.** Purpose, must-never and hard constraints appear on ONE card.
   - Each guess shows its repo source: a README line, a manifest field, or a config.
   - A guess with no source stays empty and is never invented.
   - The human types only where a guess is wrong or missing (R2-Q1.1).
   - On an empty project, the card becomes one question, «what are you building?», with example
     answers.
3. **Existing project only:** «is this structure intended, or did it just happen?» (R2-Q1.3).
4. **Machine-global companions** → `--global`. Asked on npm lanes only (R3-4).
5. **Rule research now, or skip** (Q2).
6. **Tool proposals, Y/n.** Omitted when there are none (Q3.1, Q3.2).

**Carrier.** AskUserQuestion takes at most 4 questions per call, so the round is one or two calls
(R3-10). A fresh npm project with one manifest gets four questions (card, companions, research,
tools), which fit one call. Agents without AskUserQuestion get a text-list fallback that carries
the same list. Only the main session asks, because the tool is unavailable in subagents.

### 4.3 The passport the chain leaves

The three AIF-standard files keep their paths. AIF readers use exactly those paths, including the
operator's own factory.

- **`.ai-factory/DESCRIPTION.md`**
  - An intent fence `<!-- getff:begin section=intent -->` holds purpose, must-never and hard
    constraints. It is the SOURCE of the human intent.
  - A `## Stack` block is generated from the lane manifest. Nothing else goes in: no placeholders
    and no overview prose.
  - **Content rule (R2-P4):** a line stays only if only the human knows it AND no check can express
    it. A line a check can express becomes that check.
  - Non-npm lanes get a stack-neutral template. Today the TS template, with its hard-coded
    Node/TypeScript stack (`packages/core/templates/shared/DESCRIPTION.template.md:15-16`), is
    copied to python (`setup.d/45-python.sh:1352`).
- **An old passport is never overwritten.** Setup appends getff's fences below the untouched old
  content and prints one FYI line (R2-P3).
- **`.ai-factory/ARCHITECTURE.md`** carries no getff-only truth (R2-Arch). getff writes only a
  getff-fenced pointer block: to the check config and to the AGENTS.md table, or «no architecture
  rules yet» on a fresh project. AIF's `/aif-architecture` rewrites this file (measured 2 of 2). If
  that happens, the next install, refresh or final check re-adds the block with one FYI line.
- **The `AGENTS.md` getff fence** renders the intent lines plus a «rule → what checks it» table
  generated from the rules lock.
- **`CLAUDE.md`.** When the consumer has one, setup adds a getff-marked `@AGENTS.md` import line
  (R2-Import). Claude Code loads CLAUDE.md OR AGENTS.md, not both. With no CLAUDE.md, nothing is
  added.
- **Guards, not relied upon.** Skill-context overrides for `aif` and `aif-architecture` tell them
  to keep getff's fences (AIF's MANDATORY channel). The design stays correct without them.
- **Readers.**
  - Rule research reads the intent fence (R2-P2).
  - Stack detection reads the stack only from the manifest or the generated `## Stack` block,
    never from intent prose (R3-5).

### 4.4 Green project and the final check

**Green** means all four of these hold (R2-Q2):
1. The project's own checks pass: the fresh-install gate list of round-1 Q4.3.
2. Every generated rule proves itself, in two parts.
   - *Logic:* the generator drops a bad/good/manifest triple into
     `scripts/fences-fire-fixtures/`. That directory is the consumer-extensible fixture dir
     (`packages/core/audit-self/check-fences-fire.sh:45-54`).
   - *Wiring:* the bad example is planted in an ordinary source file at a path the practice
     applies to, and the project's real lint or scan config runs over it.
   - The planting path comes from the research record, never from the wired glob: planting where
     the glob points always fires, a tautology. N14 measured a rule that fired in
     `src/app/actions/probe.tsx` and stayed silent in `src/app/layout.tsx`.
3. The lane's lock exists and matches the generated rules.
4. The report is built from these checks, never from the installer's exit code.

**Zero rules.** Zero rules is «done, with an explanation», reported as «0 new rules». The report
gives:
- the counts: practices researched, expressible, and blocked by provenance;
- the reasons;
- the next action.

The counts live in a yield sidecar next to the lock, because the lock has no field for them
(truth-pipeline N-t; R3-9).

**The final check** is `scripts/getff-check.sh` (R3-8).
- It is pure bash, delivered on every lane.
- It lists every step not done, each with its fix line, headed by the first.
- It exits non-zero unless the project is green.
- The installer runs it at the end of setup (§4.1), and the agent runs it after step 6.

### 4.5 Non-npm lanes (R3-4)

- **No `--global` question on python, cargo or go.** The flag does nothing there (§3), and P8 says
  never ask about a no-op.
- **Generation on python.** Setup renders `.practice.json` records with the prebuilt bundle, which
  carries the `--from-practice` arm, when node is present. When node is absent, setup prints a
  degrade notice, and the final check lists the step with its fix line (R2-Q6). This replaces the
  manual `npx tsx … --from-practice` call (`agents/rule-researcher.md:206-210`).
- **Firing proof needs ast-grep, but no global install.** The final check and the python self-check
  try, in order, with one pinned version for both (the one setup pins today, `0.44.1`; that the
  same version exists on PyPI is unverified, and the slice checks it before pinning):
  1. `uvx --from ast-grep-cli==0.44.1 ast-grep` when uv is present (`pip install ast-grep-cli` is an
     official install path: ast-grep quick-start, via context7, 2026-09-28);
  2. otherwise `npx --yes -p @ast-grep/cli@0.44.1 ast-grep` when node is present. Today setup only
     prints this as a manual command (`45-python.sh:529-530`); the check runs it itself;
  3. otherwise the step is listed as not done.
- **Rust and go** have no rule path yet (`agents/rule-researcher.md:262`). The report says «no
  generated rules on this lane yet». Green is judged on parts 1 and 4.

### 4.6 Acceptance and closure (R2-Q3, R2-Q4)

**Setup of the run.**
- A cold agent gets an official scaffold per stack plus the new pasted prompt, and nothing else.
- The stacks and scaffolds:
  - python: `uv init` + deps, with a venv (the closure spec's binding Done line demands a fresh
    python consumer, `:226-227`);
  - React without Next: `npm create vite` react-ts.
- It runs in a fresh container on the PC.
- A stand-in answers the real AskUserQuestion through the Agent SDK `canUseTool` callback. The
  report quotes every question verbatim.

**Pass requires all of these:**
- the project is green (§4.4);
- at least one proven generated rule per stack;
- no framework code was read (`packages/**`, `setup.d/**`; the step file and shipped docs are
  allowed);
- the questions came before setup;
- there was no second human message (start-round answers count as answers, not messages);
- after `/aif` and `/aif-architecture` run on the result, every getff fence survives.

**Where it runs.** The run needs a logged-in headless CLI: the factory's, because the Mac CLI is
logged out.

**Closure.** The acceptance report is a committed file with a machine-readable verdict line. This
program's `done.md` must cite a PASS report; «PARKED» is not closed. A report goes stale when an
agent step's `run` path changes after the run, and a stale report blocks promote (truth-pipeline
T7.1).

## 5. Live decision register

Status values:
- **answered:** the operator chose.
- **delegated:** the operator handed the choice to the discussion session, which decided it.
- **on recommendation:** the brief allowed it to stand, and the operator did not object.
- **author:** decided here in round 3, with no operator fork (P8).

A *blanket* mark means the row was confirmed by round 1's blanket verdict, «ок согласен с тобой
полностью». Round-2 rows cite the decisions file `_decisions-2026-09-28-one-button-round2.md`
(coordination directory). Its §4 amendment blocks win over its §1 rows.

### Round 1 (separate session; «в отдельной сессии подумать и обсудить как сделать лучше»)

| # | Decision | Status | Resolution | Falsifier («wrong if …») |
|---|---|---|---|---|
| Q1 | Where the chain's step order lives | answered (*blanket* for details) | **One step file in the getff clone owns the order and the step details.** Round 2 named it: the existing `first-steps.source.json`, extended (R2-Q7). The pasted prompt carries a one-line-per-step list rendered from it and drift-checked. The list runs to the end, with no «Stop here». README, the plugin command and the site point at it. Rejected: the whole chain in the prompt (it drifts), and the plugin command as owner (Claude Code only, runs without `--full`). Why a file read by path: Claude Code does not pick up NEW skill dirs mid-session without `/reload-skills`, and CLAUDE.md loads only at session start (claude-code-guide, 2026-09-28). | A cold prober agent given the new prompt still stops after install or abandons the file half-way → text is not enough; a mechanism (a Stop hook or `/goal` loop, Claude Code only) is needed. |
| Q1.1 | The installer's final banner prints «next: step N» | answered (*blanket*) | A secondary pointer (prior art: BMAD `next`, Task Master `autopilot_next`); the prompt list stays primary. Now it is the first not-done step of the final check (§4.1). | The banner and the prompt list disagree. |
| Q2 | Consent at the start | answered (*blanket* for details); amended by R2-Q1.1, R2-Q1.5, R3-4 | **One question round before install** (§4.2). It settles the parked research opt-out shape as «asked at install time». Installer and `-y` are unchanged. | On a prober run the agent starts setup before asking. |
| Q2.1 | Backstop if the agent skips the round | answered (*blanket*) | No breaking «refuse `-y` without a global choice». The `-y` machine-global skip line (`setup.d/engine.sh:69-70`) becomes a relay line: «ask the human: install X, Y, Z globally? command: …». | The agent skips both the round and the relay line → the breaking backstop returns. |
| Q3 | What «tools» means | answered | **Level 1 in the chain, level 2 out.** Level 1 is the existing `tool-bootstrapping` skill as a chain step. Researched tooling stays out. | The operator's level-2 vision becomes the blocker for a green run. |
| Q3.1 | The proposal predicate | answered | A proposal must name the project dependency that needs it. Popularity only orders proposals, and zero proposals is valid. Measured with `npx skills search`: popularity alone surfaces off-target skills. | A prober run on ≥2 stacks still yields proposals the operator judges noise. |
| Q3.2 | Where the tool Y/n goes | answered | The dependency scan runs before install, and its Y/n joins the start round. | The scan needs installed state. |
| Q4.0 | Is the RED fresh install intentional? | answered | **No.** `INSTALL-FOR-AI.md:94` says typecheck «should pass on a fresh project», and `setup.d/60-ci.sh:39-40` says «green-because-understood, never red-because-unconfigured». The intentional red is each rule's firing test (P1). | A shipped doc tells consumers to expect a red project after install. |
| Q4 | RED fix: separate track or folded in | answered | Separate stream 1. This chain's acceptance starts from a green install. **Landed:** #1860 (own-config fresh-install cell, prebuilt runtime bundles) and #1868 (Q4.7). | The fix has to touch chain surfaces. |
| Q4.1 | getff files in the consumer's lint/tsc scope, and N14 | answered | Zero-dependency prebuilt `.mjs` bundles. N14 is closed by stream 1 (§3). | The bundled generator fails on a clean machine with an empty npx cache. |
| Q4.2 | Append ignores to a consumer-owned eslint config? | answered | No append: the bundles carry an eslint-disable banner. | A consumer sets `linterOptions.noInlineConfig` → ask the operator. |
| Q4.3 | Which gate catches a RED fresh install | answered | `framework-fresh-install-validate`, one cell per stack, installing into a project that already has its own configs. | The new cell was GREEN before any fix. |
| Q4.4-4.5 | Stale preset templates; layout assumptions | answered | Stream 1, by class, as the gate exposes them. | A fix is stack-specific instead of layout-derived. |
| Q4.6 | N14 side findings | answered | They belong to this program. A failed generation is now named in the NOT-wired summary (`80-rule-bootstrap.sh:80`). The blind fence check and the wrong glob block are closed by R2-Q2 part 2, and the lock name by part 3. | Stream 1 cannot land without changing them. |

### Round 2 (separate session; operator verdicts as quoted)

| # | Decision | Status | Resolution | Falsifier («wrong if …») |
|---|---|---|---|---|
| R2-Q1 | Is the passport worth having? The operator asked «может это легаси вообще и не нужно?» | delegated, then re-decided on evidence | **Partly legacy.** Controlled 2026 studies find that overview files do not raise task success and cost >20% more tokens (Gloaguen et al., arXiv 2602.11988), while specific instructions ARE followed. Khatri (arXiv 2607.27250) finds the injection strategy does not move correctness. So the chain writes no overview documents and no DRAFT files. It keeps three things: the human's intent, architecture only as checks, and a generated rule → check table. | A controlled study shows overview documents raise task success for Claude-family agents → restore a short overview. |
| R2-Q1.1 | How intent is collected | delegated; amended by OP-16 and OP-17 | **One guess card** (§4.2 item 2). Evidence-only guard: a guess cites its repo source, or stays empty. A bare go-ahead then accepts only evidence-backed lines. | Cold acceptance runs show evidence-backed must-never guesses that are still wrong → split must-never into its own question. |
| R2-Q1.2 | When it is asked | delegated | In the start round, before install. Intent never appears in code, the human is present only at the start, and constraints must exist before research. | The operator judges the quoted start-round questions too long or unclear → keep purpose + must-never only. |
| R2-Q1.3 | Architecture on an existing project | delegated | One question: «is this structure intended?». «Intended» → a boundary check where the lane has one (dependency-cruiser on npm lanes, `setup.d/40-configs.sh:449`). On python it becomes a candidate for the first `dep-graph` node (prior-art-evaluations.md#214). «Just happened» → nothing. A fresh scaffold is asked nothing. | Most runs answer «don't know» → drop the question. |
| R2-Q1.4 | Keeping it current («постоянно обновлять, записывать и вести?») | delegated | Mostly dissolves. Checks fail loudly, renders regenerate, and intent lines change only when the human changes direction. | Intent lines are found stale in a real project → add an upkeep check. |
| R2-Q1.5 | Stack confirmation (amends round-1 Q2) | delegated | Asked only when detection is ambiguous (§4.2 item 1). «очевидные из стека вещи точно не нужно спрашивать у оператора». | A prober run detects a single-manifest project as the wrong lane → always ask. |
| R2-P1 | Where the intent lines live | answered (§4 accepted after OP-15) | Source: the DESCRIPTION.md `section=intent` fence. Rendered into the AGENTS.md getff fence. | A cold agent given these files cannot state the project's must-nevers → render intent into CLAUDE.md too. |
| R2-P2 | Does rule research read the intent lines? | answered; REQUIRED | Yes: must-never lines become rule candidates. Without a getff reader, the passport is a file nobody reads (getff stopped installing AIF on 2026-07-10). | (author-added) Acceptance research output is the same with and without intent lines → the read steers nothing; drop the coupling. |
| R2-P3 | An old-format passport | answered; amended by OP-16, kept after OP-17 | Never overwritten. Setup appends getff's fences below the old content, fills them from the start-round answers, and prints one FYI line. | The appended block breaks an existing reader (`readAif`, an AIF skill) → write the block to a sibling file and point to it. |
| R2-P4 | Intent size | answered | A content rule instead of «≤5 lines» (§4.3). | Real projects end up with long intent sections that agents demonstrably ignore → add a soft size warning. |
| R2-Arch | ARCHITECTURE.md | author (probe-driven, accepted into §4) | **No getff-only truth there** (§4.3). The truth is the check config plus the AGENTS.md table. The probe (AIF 2.11.0, 2 runs per command) found `/aif-architecture` replaced the whole file both times, while `/aif` kept the AGENTS.md fence byte-identical both times (a weak result: the sub-agents inherited getff context). | The acceptance run (§4.6) shows `/aif` rewriting inside a getff fence → add a check that compares the intent fence with the text the human last confirmed. |
| R2-Import | The `@AGENTS.md` import for consumers with their own CLAUDE.md | answered: «Конечно!» (OP-15) | Setup adds a getff-marked import line (§4.3). This is the same move as #1868 (a getff block in the consumer's own config instead of a hand edit). Source: code.claude.com/docs/en/memory.md via claude-code-guide, 2026-09-28. | A live Claude Code session in a consumer with its own CLAUDE.md loads AGENTS.md without the import → no import needed. |
| R2-Echo | The installer's «Review/edit» echo | answered (§4) | Replaced by the banner rendered from the step list (§4.1). The peer chip «Automate the manual steps getff's install still prints» (f35edf) has an FYI about the overlap. | — |
| R2-Q2 | What «green project» means | answered (zero-rule branch: «Готово, с объяснением»); the rest on recommendation | §4.4. | On real projects research almost always yields zero → «green with zero» hides a chain that produces nothing; zero becomes failure. |
| R2-Q3 | Acceptance | answered: «A + доработки (Recommended)»; fence-survival added in §4 | §4.6. | The operator finds a quoted question unclear, or the stand-in hides a problem a live human would hit → add one manual run. |
| R2-Q4 | Closure | on recommendation | §4.6. This is the 2nd incident of the class (`getff-any-stack-trace/done.md:22`, `getff-freshness-widening/done.md:17`). A 3rd triggers a general `done.md` check (`attention-is-not-a-mechanism.md` §3). | A 3rd parked-as-done program appears before the general check exists. |
| R2-Q5 | Presets vs the generator | on recommendation | Out of this spec. The generator makes rules only; tool-config templates are the round-1 «level-2 tooling». A broken template line is a stream-1 bug fix. | A shipped template breaks the green check on the acceptance scaffolds and stream 1 has not fixed it. |
| R2-Q6 | How the chain calls the generator | on recommendation | One command on every lane: `./setup --full <stack>`. On python, setup renders the `.practice.json` records itself (§4.5). | F-A forbids node inside setup even as degrade-on-absent → the chain calls the bundle's `--from-practice` directly on python and re-runs setup. |
| R2-Q7 | Docs, passport, architecture and site as one process | answered (direction; the design went to the truth-pipeline contract) | Every fact has one structured source; everything else is rendered from it or is AI prose citing only sources and code. The chain's source is `first-steps.source.json`, extended. The operator: «Давай попробуем все это вместе интегрировать, по сути это один процесс». | `first-steps.source.json` cannot express the chain (F1), or a cold agent still misses `/rule-research` after integration (F3). |

### Round 3 (author decisions; the frontier diff found no operator fork)

**Frontier diff against the truth-pipeline register.** The planned round-3 items were: a rendered
step list with `--check`, a fence check that reads generated rules, reachability of `aif-init`, a
chain-order arm over every executed prompt, and the one-page truth card. Three are already settled
elsewhere:
- the rendered step list: truth-pipeline T1, T1.1 and T1.2, plus R2 and R7;
- the chain-order arm: T1.4 coverage and R7 surface population;
- the fence check: R2-Q2 part 2.

The rest, plus six items round 2 surfaced, are below.

| # | Decision | Status | Resolution | Falsifier («wrong if …») |
|---|---|---|---|---|
| R3-1 | The «one-page truth card» (P5) | author | **Not a new file.** The truth-pipeline rejects a second step source and a new product-claim file. P5's intent (one source, one pass over README / INSTALL-FOR-AI / the banner / the site) is exactly what the structured sources and their renders do. | A cold agent needs a single page to answer «what does getff install and generate» (#1856 N10's predicate) and no render gives it → add a rendered one-pager: a render, never a source. |
| R3-2 | `agents/aif-init.md` | author | **Retired** from the shipped roster in the passport slice. It writes DRAFT files and reads only `package.json`, which R2-Q1 rejects. It has no caller. The start round cannot run in a subagent anyway: AskUserQuestion is main-session only, and the agent file is not installed yet when the round runs. The passport step's instructions live in the step file's `run` target. | Consumers are found invoking `/aif-init` outside the chain → keep it as a thin pointer to the same instructions. |
| R3-3 | Who writes the intent fence, and when | author | **The agent writes it right after the start round, before install**, creating DESCRIPTION.md with a canonical heading when the file is absent. Setup then treats every DESCRIPTION.md as existing: it appends missing getff fences and never edits the intent fence. Fresh and old passports share one code path (R2-P3). | `readAif` throws on the agent-written file (`read-aif.ts:104-108`) → setup writes the heading and the agent fills the fence. |
| R3-4 | The non-npm lanes | author | §4.5: no `--global` question; python generation through the bundle; ast-grep through `uvx`, then `npx`, then «not done». | A stock `uv init` scaffold has neither uv on PATH for the check nor node → the chain adds `ast-grep-cli` as a dev dependency in the project venv, asked in the start round. |
| R3-5 | The passport stack hazard | author | Stack detection is manifest-first on every path, not only the chain's (`resolve-ctx.ts:59`). `readAif` is used only when no manifest exists, and then parses only `## Stack`. Today `readAif` maps «React» text to `react-next` (`read-aif.ts:18-19`), so a purpose line could flip a detector bin's stack. | A fixture passport with «React» in its purpose line still changes a detector bin's stack after the change. |
| R3-6 | Is the start round really one or two calls? | author | Yes: §4.2 «Carrier». The worst case is six questions (ambiguous stack, existing project, npm lane, tool proposals), which fit two calls. | Acceptance transcripts show a third call, or a question outside §4.2. |
| R3-7 | Skills installed mid-session | author | Every agent step's `run` is a path in the getff clone, read by path, never a slash command (the round-1 Q1 reason). This covers `rule-research`, `tool-bootstrapping` and the passport step. | The acceptance run shows the agent misreading or skipping a skill read by path → the step adds `/reload-skills` and invokes the skill. |
| R3-8 | The final check's entry point (truth-pipeline §6.2 delegates the name here) | author | `scripts/getff-check.sh`: pure bash, all lanes, delivered by setup (§4.4). Its first not-done step is the banner's «next» line. | The name collides with a consumer script, or pure bash cannot run a lane's check → keep the name, dispatch per lane inside it. |
| R3-9 | Zero-rule counts and research yield | author | The generator writes a yield sidecar next to the lane's lock: researched / expressible / blocked, with reasons. The lock schema is unchanged (`packages/core/installer/types.ts:46-55`). Yield bottlenecks are out of scope and go to the rule-research owner: cross-host doc redirects and github-hosted docs failing the allowlist, python Tier-1 needing a venv, and duplicates of TypeScript checks. | The acceptance run yields zero proven rules on a stack → the yield fixes become a precondition of closure (§4.6 needs ≥1). |
| R3-10 | Boundary with the truth-pipeline contract | author | §6. | A landed sentence in either spec restates the other's decision → cut it to a pointer. |
| R3-11 | Shipped agent-count claims | author | Retiring `aif-init` (R3-2) changes shipped counts. The roster renders carry the change; hand-written counts are truth-pipeline R7's shadow arm and T13 step 3. | A hand-written count in an entry doc disagrees with the roster after the slice lands. |

## 6. Boundary with the truth-pipeline contract

- **This spec owns** the step file's CONTENT (§4.1), the start round, the passport content and its
  renders, the green predicate (the terminal step's `doneWhen`), the final check's name, the
  acceptance run and closure.
- **The contract owns** the step schema and gates (T1-T1.5), the one-source rules R1-R10
  (including R7's list of chain-telling surfaces, which this chain's surfaces join), the site
  request rows, and goal governance (§6.8, R9).
- **Where they meet:**
  - The consumer mirror (contract T6) IS §4.3's renders. Its upkeep check is the passport step in
    the final check.
  - The banner render (contract §6.2) is §4.1's banner.
  - The contract's sequencing §6.7 step 2, «the chain wiring with the executable step file», is
    this spec's implementation.

## 7. Testing seams

- **One seam carries most of it: the final check** (`scripts/getff-check.sh`). Every step's
  `doneWhen` and the green predicate run through it. Its fixtures:
  - a consumer per lane with each step done, and one with each step not done;
  - a generated rule whose wired glob misses its target, which must fail the wiring arm (the N14
    regression).
- **Existing seams, reused:**
  - `first-steps-parity.test.ts` and the render `--check`s (contract §7);
  - the per-stack cells of `framework-fresh-install-validate` (Q4.3, #1860);
  - `check-fences-fire.sh` over the fixture triples.
- **The one non-mechanical seam is the cold acceptance run** (§4.6). It includes the fence-survival
  assertion, and it is re-armed when an agent step's `run` path changes.

## 8. Rejected alternatives

- The whole chain in the pasted prompt: it drifts. The plugin command as the owner: Claude Code
  only, and no `--full`.
- A breaking `-y` backstop: it reverses S1-4.
- Level-2 researched tooling in the chain.
- Folding the RED fix into this program.
- Overview documents, DRAFT files left for later review, and a human-edited passport (R2-Q1).
- Three separate intent questions: replaced by one evidence-only card (R2-Q1.1).
- The intent lines living only in AGENTS.md: rejected; DESCRIPTION.md is the source (R2-P1).
- ARCHITECTURE.md as a render target: AIF rewrites it (R2-Arch).
- A separate truth-card file (R3-1), and a second step file next to `first-steps.source.json`.
- Keeping `aif-init` as the passport writer (R3-2).

## 9. Implementation slices (for writing-plans, after approval)

1. **Step file.** The schema per contract T1.1 plus this chain's steps, the prompt render (no
   «Stop here»), the banner render, and pointers from README, the plugin command and
   `skills/getff`. Owes a new SSOT row for the step-file prior art (contract N-p: build on own
   precedent; adapt the Steps.md and Doc Detective vocabulary).
2. **Passport:**
   - the intent fence and the stack-neutral template;
   - old-passport append;
   - the AGENTS.md render and the ARCHITECTURE.md pointer block;
   - the `@AGENTS.md` import;
   - the skill-context overrides;
   - manifest-first detection (R3-5);
   - retiring `aif-init`.
3. **Final check and green:** the generator's fixture triple, the wiring arm, lock matching, the
   yield sidecar, and `scripts/getff-check.sh`.
4. **Non-npm lanes:** python render in setup, and ast-grep through `uvx` / `npx`.
5. **Research reads intent** (R2-P2).
6. **Acceptance run and report**, including fence survival; then `done.md`.

Slices 1-5 are independent enough to run in parallel after slice 1's schema. Slice 6 closes the
program.

## 10. Changelog

- 2026-09-28: draft opened; round 1 (Q1-Q4) folded in from its separate session (WIP `e5fb19bde99`).
- 2026-09-28, **r2**:
  - Round 2 folded in from `_decisions-2026-09-28-one-button-round2.md`, including its §4
    amendment blocks (OP-15, OP-16, OP-17, the `/aif` probe).
  - Premises P8-P12 added.
  - §3 re-anchored to `f526c61c70a`: N14 closed by stream 1; the installer echo; the existing step
    file; the python road.
  - Chain, passport, green, lanes and acceptance written out (§4).
  - Round 3 closed by author decisions R3-1…R3-11 after the frontier diff.
  - Boundary (§6), testing seams (§7), rejected alternatives (§8) and slices (§9) added.
