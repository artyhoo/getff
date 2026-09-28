# getff one-button chain — design

> **Status:** DRAFT r3. `/arch` phase 1 is complete; the §2 cold review has not run yet. Not
> approved; no code until the operator approves this spec.
> - Rounds 1 and 2 were decided in separate discussion sessions, at the operator's request.
>   Round 2 includes its own cold re-review (both seats REVISE, 0 BLOCKERs) and the operator
>   answer OP-18.
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
>   `_design-2026-09-28-truth-pipeline.md` (revision r3) in the operator's coordination
>   directory. The boundary is drawn in §6.
> - The «one beat» decision D1: the [any-stack closure spec](2026-07-23-getff-any-stack-closure-design.md).
> - Stream 1 (the RED fresh install, prebuilt bundles): its own track, landed as #1860 and #1868.
>
> Anchors: `origin/staging` `33147ff9228` unless marked.

## 1. Goal

One button installs everything getff offers a project, completely, in one agent session:
1. getff itself;
2. the passport;
3. tools: skills and MCP servers, in the project and, with consent, machine-global;
4. live rule research;
5. generated rules, each with its firing test.

The target state is a **complete install** (P13). Every part above is in place and proven by the
final check, or is listed as declined by the human or not applicable on the lane. A green project
(the project's own checks pass and every generated rule proves itself) is one condition of a
complete install, not the goal by itself.

«One button» means one agent session, not one shell command (glossary:
[One button](../../../CONTEXT.md), [Passport](../../../CONTEXT.md),
[Complete install](../../../CONTEXT.md), [Green project](../../../CONTEXT.md)).

The measured answer to «is it turnkey today?» (2026-09-27/28) is **no**. The parts exist, but the
road between them is not built. Evidence:
- the [research patch N1-N15](../../meta-factory/research-patches/2026-09-27-ai-navigability-what-getff-installs.md);
- §3 below.

## 2. Operator premise register

Faithful to meaning. P1-P7 were settled 2026-09-27/28 in this session and round 1; P8-P12 come
from the round-2 session (2026-09-28); P13-P14 are the operator's corrections after r3.

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
| P13 | The goal is a complete one-button install, not «green». «Green» is a formal target that can be reached many ways; what counts is that everything is installed and works. «Кажется это уже формализм цели … цель же установка всего с одной кнопки - генерация правил и тестов скилов и мсп и тд - полностью!» | operator, 2026-09-28, after r3 |
| P14 | Design one universal, stack-scalable architecture now; the python, rust and go lanes stay alpha and are not this program's target. «на Rust и Go и питон пока пофиг они в альфа версии остаются -тут суть только в том чтобы делать сразу мастшабируемую под любой стек архитектуру разу проектировать унивеерсальный дизайн под все!» | operator, 2026-09-28, after r3 |

## 3. Starting point (measured)

- **The generator.** The code lives in
  `packages/core/synthesizer/{rule-bootstrap,file-clients,research-to-node,research-to-clippy-node,generate}.ts`,
  `agents/rule-researcher.md` and `.claude/skills/rule-research/SKILL.md`. It covers JS/TS, Python and
  Rust (#805, #1005, #1006, #1010; IR unfreeze #1084).
- **The road is cut in three places.**
  1. The pasted prompt still ends «8. Stop here» (`INSTALL-FOR-AI.md:107`) and says the passport
     must NOT be filled by the agent (`:101`). Research is gated by a stopping rule whose opt-out
     shape was parked (`:592-600`).
  2. With no research pair, generation is skipped (`setup.d/80-rule-bootstrap.sh:52`), and nothing
     in the install writes the pair.
  3. **N14.** Measured 2026-09-28: with the pair present, the generator could not start. **Closed
     by stream 1:** the step now runs the prebuilt `rule-bootstrap-cli.bundle.mjs` (`:31`), and a
     failed generation is named in the NOT-wired summary (`:80`).
- **The installer still asks the human to edit files.** Its closing echo says to review/edit
  DESCRIPTION.md and ARCHITECTURE.md and to edit AGENTS.md placeholders
  (`setup.d/99-finalize.sh:627-630`).
- **The step file already exists.** `packages/core/templates/shared/first-steps.source.json`
  (schema `getff.first-steps/v1`) keeps one sequence per depth.
  - `fill-passport` is a human step at every depth (`:45`, `:99`, `:141`).
  - `research-your-stack` exists only at core depth (`:75`); the default `env` depth has none.
  - Its two claimed renders are not generated (truth-pipeline draft N-k).
- **The passport is read by nobody on the chain path, and misread off it.**
  - The generator skips it: `resolveCtxForRoot` calls `detectStack(root, { skipAif: true })`
    (`packages/core/synthesizer/resolve-ctx.ts:59`). The researcher never reads it.
  - Every other detector path reads it FIRST, before the manifest
    (`packages/core/detector/index.ts:31-33`). `readAif` maps any «React» or «Next.js» text to
    `react-next` (`read-aif.ts:18-19`), and a canonical heading with no recognised framework to
    `ts-server` (`:48-52`). So a python project with a DESCRIPTION.md reads as `ts-server`, and
    a Vite React project as `react-next`.
  - `agents/aif-init.md` is shipped (`install.sh:232`) and reads only `package.json`, but nothing
    calls it.
  - The python lane copies the TS DESCRIPTION template, whose stack block is hard-coded
    Node/TypeScript (`packages/core/templates/shared/DESCRIPTION.template.md:15-16`), to python
    (`setup.d/45-python.sh:1352`).
- **Claude Code loads CLAUDE.md OR AGENTS.md.** An AGENTS.md is read only when no CLAUDE.md
  exists in the working directory or above it, and `.claude/CLAUDE.md` or `CLAUDE.local.md` also
  stop it. Reading AGENTS.md directly needs Claude Code 2.1.277+. The operator's Mac runs 2.1.270
  and the factory 2.1.220. (code.claude.com/docs/en/memory.md; re-verified by the round-2 review.)
  getff writes no `@AGENTS.md` import today.
- **The python road differs.**
  - The python lane delivers its agent surface and exits before the npm layer loop
    (`install.sh:383-389`). So `--global` and the companion engine do nothing there, and context7
    is replicated separately (`setup.d/45-python.sh:1283-1290`).
  - Python generated rules are ast-grep YAML (`agents/rule-researcher.md:164`). Nothing installs
    ast-grep. Without it, firing is «NOT proven», and setup only prints an `npx` command for the
    human (`45-python.sh:529-530`).
- **Acceptance has never run.** The 2026-07-23 program's acceptance was dropped twice (research
  patch N15), and `agents/getff-cold-run-prober.md` is still DORMANT.

## 4. The chain

### 4.1 Steps

These steps become the one-button sequence in `first-steps.source.json` (R2-Q7). The pasted prompt
runs it to the end (`./setup --full <stack>`). In every other sequence, `fill-passport` becomes the
agent step «confirm the guess card» (R2-Steps).

The shape is the truth-pipeline's §6.2: `actor` (required), `when`, `run`, `doneWhen`, the step
states, run-bound probes and coverage. The pasted prompt and the installer banner are renders of
this list (Q1, Q1.1). Every agent step's `run` is a file in the getff clone that the agent reads by
path (R3-7).

| # | Step | Actor | When | What happens | Done when |
|---|---|---|---|---|---|
| 1 | read-steps | agent | always | The pasted prompt clones getff and has the agent read this list by path. | `none`, reason: «the list is read before any artefact exists; the acceptance run proves it» → `unverifiable` |
| 2 | start-round | agent (main session) | always | One question round before anything is installed (§4.2). The agent then writes the confirmed intent through the intent writer, and on python creates the venv and the ast-grep dev dependency when accepted. | `.getff/intent.md` exists and matches its confirmation record (§4.3) |
| 3 | install | setup | always | `./setup --full <stack>`, plus `--global` when accepted. Setup renders the passport (§4.3). | Setup's self-verify passes |
| 4 | tools | agent | tool proposals accepted | Installs the accepted MCP servers and skills (`tool-bootstrapping`, Rule 3). | `.ai-factory/tool-decisions.md` records the decision |
| 5 | research | agent | no «skip research» opt-out (R2-OP18) | Runs the rule-research protocol. It reads the intent source, and must-never lines become rule candidates (R2-P2). | The lane's research artefacts exist and are newer than the run stamp; with the opt-out, `skipped-by-consent` |
| 6 | generate | setup | step 5 ran | Re-runs `./setup --full <stack>` (R2-Q6). This renders the rules, the lock and each rule's fixture triple. Stage 80 then re-renders the rule → check table into the AGENTS.md fence. | The lane's lock exists and is newer than the run stamp |
| 7 | check | agent | always | Runs the final check (§4.4). | Green, or a list of every step not done, each with a fix line |
| 8 | report | agent | always | The report to the human, built only from step 7's output, plus the FYI lines. | `none`, reason: «chat output built from step 7, which is the proof» → `unverifiable` |

The installer also runs the final check at the end of setup. Its first not-done step becomes the
banner's «next: step N» line, so the banner and the check cannot disagree. This replaces the echo
at `99-finalize.sh:627-630`, including «Edit AGENTS.md placeholders».

### 4.2 The start round

The questions come in this order, roots first. Each shows the recommendation as its first option,
and a bare go-ahead accepts every recommendation.

1. **Stack.** Asked only when detection is ambiguous: two or more lane manifests, or none.
   Otherwise the intro line names the stack and the file it came from (R2-Q1.5).
2. **The guess card.** Purpose, must-never and hard constraints appear on ONE card.
   - Each guess shows its repo source: a README line, a manifest field, or a config.
   - A guess with no source stays empty and is never invented (R2-Q1.1, OP-17 guard).
   - The human types only where a guess is wrong or missing.
   - On an empty project, the card asks «what are you building?» with example answers that are
     labelled as examples and never pre-filled.
3. **Existing project, on a lane with a boundary check only:** «is this structure intended, or did
   it just happen?» (R2-Q1.3).
4. **Machine-global companions** → `--global`. Asked only on lanes where the flag has an effect
   (npm lanes today; R3-4).
5. **Python only, when missing:** «create `.venv` and add ast-grep as a dev dependency?» (R2-Venv,
   R3-4).
6. **Tool proposals, Y/n.** Omitted when there are none (Q3.1, Q3.2).

Rule research is **not** asked. It runs by default, and the start banner carries one FYI line:
research is running, and «skip research» (in any language) skips it (R2-OP18).

**Carrier (R3-6).** AskUserQuestion takes at most 4 questions per call, and only the main session
has it. The stack answer decides which of items 3-5 apply, so when it is asked it goes first,
together with the card. That makes at most two calls:
- a fresh npm project: card + companions (+ tools) = one call;
- a fresh `uv init` project: card + venv (+ tools) = one call;
- an ambiguous stack: stack + card, then at most three lane questions.

Agents without AskUserQuestion get a text-list fallback that carries the same list.

### 4.3 The passport the chain leaves

The three AIF-standard files keep their paths. AIF readers use exactly those paths, including the
operator's own factory.

**The intent source (R2-P1, R3-3, R3-11).**
- `.getff/intent.md` is getff-owned, with three fixed headings (Purpose / Must never / Hard
  constraints) and one line per item.
- **Content rule (R2-P4):** a line stays only if only the human knows it AND no check can express
  it. A line a check can express becomes that check. There is no line cap.
- **One writer.** The only writer is the intent writer, `scripts/getff-intent.sh` (pure bash). It
  runs from the getff clone before install and from the project after it.
  - It writes the source and a confirmation record, `.getff/intent.confirmed`, holding the source's
    hash.
  - It runs after the guess card at the start round. The re-ask step («the project changed
    direction») runs it again after re-showing the card with the current text. That re-ask step is
    also the fix line for a mismatch.
- **The hash check.** The pre-push hook and the final check compare the source with the record. A
  mismatch means an edit bypassed the confirmation. This is the passport's one critical, narrow
  touchpoint: a silently reworded must-never is the project's own problem class.

**Renders.** Setup writes these on install and refresh, and the next button or refresh run heals
them with an FYI line.
- **`.ai-factory/DESCRIPTION.md`:**
  - a getff intent fence rendered from the source, for AIF readers;
  - one line pointing at the lane's manifest (R2-Stack), with no stack block. «стек не нужно
    дублировать, ссылки достаточно».
  - A stack-neutral template replaces the TS one on every lane. Its heading is the project name
    from the manifest.
- **An old DESCRIPTION.md (R2-P3):**
  - human-written lines stay byte-identical;
  - a section whose lines are all byte-identical to the template's unfilled placeholders is
    getff's own leftover and is replaced;
  - getff's fence uses its own headings, so it never repeats the template's «Non-goals» or «Hard
    constraints».
- **`.ai-factory/ARCHITECTURE.md` carries no getff-only truth (R2-Arch).** getff writes only a
  getff-fenced pointer block: to the check config and to the AGENTS.md table, or «no architecture
  rules yet». AIF's `/aif-architecture` rewrites this file (measured 2 of 2).
- **The `AGENTS.md` getff fence** holds the intent lines plus a «rule → what checks it» table.
  - Stage 30 writes the static template.
  - Stage 80 re-renders the table from the rules lock through `merge_fenced`
    (`setup.d/lib.sh:1004`), after the lock is written.
  - `AGENTS.md.template:9` («This file is a POINTER DOC») is amended in the same change, because
    the fence now carries renders.
- **Project-root `CLAUDE.md` (R2-Import).** Setup always ensures a getff-marked `@AGENTS.md` import
  line; when the file is absent, setup creates it with that one block. The docs guarantee that the
  import never makes Claude Code read AGENTS.md twice. Known limit: the import loads everything in
  AGENTS.md, including AIF's «Project map».

**Upkeep (R2-Upkeep).**
- Pre-push checks never write.
- The AGENTS.md fence keeps its standard fence check.
- The DESCRIPTION.md and ARCHITECTURE.md renders never fail a push, because getff reads neither.
- Every automatic write honours a per-section opt-out marker. The marker is the one-step revert,
  and self-heal never re-adds a switched-off section. The FYI line names the marker.

**What reads what.**
- Rule research reads the intent source (R2-P2).
- Stack detection reads the manifest first on every path; `readAif` is a fallback only when no
  manifest exists (R3-5).
- getff reads nothing that AIF writes. That, not a skill-context guard, is the protection against
  `/aif` rewrites (R2-Guard).

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
(`packages/core/installer/types.ts:46-55`; truth-pipeline N-t; R3-9).

**The final check** is `scripts/getff-check.sh` (R3-8).
- It is pure bash, delivered on every lane.
- It lists every step not done, each with its fix line, headed by the first.
- It exits non-zero unless the project is green.
- The installer runs it at the end of setup (§4.1), and the agent runs it as step 7.

### 4.5 Non-npm lanes (R3-4)

- **Questions that change nothing are omitted:** `--global` and «is this structure intended?» on
  python, cargo and go (P8, R2-Q1.3).
- **Generation on python.** Setup renders `.practice.json` records with the prebuilt bundle, which
  carries the `--from-practice` arm, when node is present. When node is absent, setup prints a
  degrade notice, and the final check lists the step with its fix line (R2-Q6). This replaces the
  manual `npx tsx … --from-practice` call (`agents/rule-researcher.md:206-210`).
- **Firing proof on python.** The start round offers to create the venv when there is none, and to
  add `ast-grep-cli` as a project dev dependency through the project's own tool: `uv add --dev` on
  a uv project, the venv's pip plus the project's dev requirements otherwise. `pip install
  ast-grep-cli` is an official install path (ast-grep quick-start, via context7, 2026-09-28).
  - Declined, or not possible: the check tries `uvx --from ast-grep-cli==<v> ast-grep`, then
    `npx --yes -p @ast-grep/cli@<v> ast-grep`, which setup today only prints for the human
    (`45-python.sh:529-530`).
  - When none of these can run, the step is listed as not done.
  - `<v>` is the version setup pins today, `0.44.1`. That the same version exists on PyPI is
    unverified; the slice checks it before pinning.
- **Rust and go** have no rule path yet (`agents/rule-researcher.md:262`). The report says «no
  generated rules on this lane yet». Green is judged on parts 1 and 4.

### 4.6 Acceptance and closure (R2-Q3, R2-Q4)

**Setup of the run.**
- A cold agent gets an official scaffold per stack plus the new pasted prompt, and nothing else.
- The scaffolds:
  - python `uv init` + deps, with a venv (the closure spec's binding Done line demands a fresh
    python consumer, `:226-227`);
  - python without a venv (R2-Venv);
  - React without Next: `npm create vite` react-ts.
- It runs in a fresh container on the PC.
- A stand-in answers the real AskUserQuestion through the Agent SDK `canUseTool` callback. The
  report quotes every question verbatim.
- The prompt carries a scripted intent answer, so the renders and the must-never → rule path run
  on every scaffold.

**Pass requires all of these:**
- the project is green (§4.4);
- at least one proven generated rule per stack;
- no framework code was read (`packages/**`, `setup.d/**`; the step file and shipped docs are
  allowed);
- the questions came before setup, and research ran without being asked;
- there was no second human message (start-round answers count as answers, not messages);
- after `/aif` and `/aif-architecture` run on the result, every getff fence survives.

**Where it runs.** The run needs a logged-in headless CLI: the factory's, because the Mac CLI is
logged out. A logged-out CLI is reported as NOT-RUN, never as a pass.

**Closure.** The acceptance report is a committed file with a machine-readable verdict line. This
program's `done.md` must cite a PASS report; «PARKED» is not closed. A report goes stale when an
agent step's `run` path changes after the run, and a stale report blocks promote (truth-pipeline
T7.1).

## 5. Live decision register

Status values:
- **answered:** the operator chose.
- **delegated:** the operator handed the choice to the discussion session, which decided it.
- **on recommendation:** the brief allowed it to stand, and the operator did not object.
- **author:** decided by an authoring session with no operator fork (P8). Round-2 author rows were
  decided by the round-2 session and FYI'd to the operator; round-3 rows are decided here.

A *blanket* mark means the row was confirmed by round 1's blanket verdict, «ок согласен с тобой
полностью». Round-2 rows cite the decisions file `_decisions-2026-09-28-one-button-round2.md`
(coordination directory). Its §4 amendment blocks win over its §1 rows, and the last block, «§2
cold re-review, round 2 of 2», wins over everything above it.

### Round 1 (separate session; «в отдельной сессии подумать и обсудить как сделать лучше»)

| # | Decision | Status | Resolution | Falsifier («wrong if …») |
|---|---|---|---|---|
| Q1 | Where the chain's step order lives | answered (*blanket* for details) | **One step file in the getff clone owns the order and the step details.** Round 2 named it: the existing `first-steps.source.json`, extended (R2-Q7). The pasted prompt carries a one-line-per-step list rendered from it and drift-checked. The list runs to the end, with no «Stop here». README, the plugin command and the site point at it. Rejected: the whole chain in the prompt (it drifts), and the plugin command as owner (Claude Code only, runs without `--full`). Why a file read by path: Claude Code does not pick up NEW skill dirs mid-session without `/reload-skills`, and CLAUDE.md loads only at session start (claude-code-guide, 2026-09-28). | A cold prober agent given the new prompt still stops after install or abandons the file half-way → text is not enough; a mechanism (a Stop hook or `/goal` loop, Claude Code only) is needed. |
| Q1.1 | The installer's final banner prints «next: step N» | answered (*blanket*) | A secondary pointer (prior art: BMAD `next`, Task Master `autopilot_next`); the prompt list stays primary. Now it is the first not-done step of the final check (§4.1). | The banner and the prompt list disagree. |
| Q2 | Consent at the start | answered (*blanket* for details); amended by R2-Q1.1, R2-Q1.5, R2-OP18, R3-4 | **One question round before install** (§4.2). Its research question was removed by OP-18. Installer and `-y` are unchanged. | On a prober run the agent starts setup before asking. |
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
| R2-Q1.1 | How intent is collected | delegated; amended by OP-16, OP-17 and the round-2 review | **One guess card** (§4.2 item 2). Evidence-only guard: a guess cites its repo source, or stays empty. A bare go-ahead then accepts only evidence-backed lines. Empty project: example answers labelled as examples, never pre-filled. | Cold acceptance runs show evidence-backed must-never guesses that are still wrong → split must-never into its own question. |
| R2-Q1.2 | When it is asked | delegated | In the start round, before install. Intent never appears in code, the human is present only at the start, and constraints must exist before research. | The operator judges the quoted start-round questions too long or unclear → keep purpose + must-never only. |
| R2-Q1.3 | Architecture on an existing project | delegated; review amendment 10 | One question, «is this structure intended?», asked only on lanes with a boundary check (dependency-cruiser on npm lanes, `setup.d/40-configs.sh:449`). «Intended» → that check. On python the answer would be a candidate for the first `dep-graph` node (prior-art-evaluations.md#214), but the question is omitted there until a check exists. «Just happened» → nothing. A fresh scaffold is asked nothing. | Most runs answer «don't know» → drop the question. |
| R2-Q1.4 | Keeping it current («постоянно обновлять, записывать и вести?») | delegated | Mostly dissolves. Checks fail loudly, renders regenerate, and intent lines change only when the human changes direction, through the re-ask step. | Intent lines are found stale in a real project → add an upkeep check. |
| R2-Q1.5 | Stack confirmation (amends round-1 Q2) | delegated | Asked only when detection is ambiguous (§4.2 item 1). «очевидные из стека вещи точно не нужно спрашивать у оператора». | A prober run detects a single-manifest project as the wrong lane → always ask. |
| R2-P1 | Where the intent lives | answered (§4 accepted after OP-15); source moved by review amendment 1 | **Source: `.getff/intent.md`**, a getff-owned file. The DESCRIPTION.md intent fence and the AGENTS.md fence are both renders of it. Why moved: a `getff:begin` fence is a render by the contract, so a source inside one contradicts the layering. The intent still reaches the agents; only the source location changed. | A consumer's agent can change a must-never without the hash check firing (review falsifier for amendment 1). |
| R2-P2 | Does rule research read the intent? | answered; REQUIRED | Yes: must-never lines become rule candidates. Without a getff reader, the passport is a file nobody reads (getff stopped installing AIF on 2026-07-10). | In the acceptance run, a must-never line that a check could express yields no rule candidate. |
| R2-P3 | An old-format passport | answered; amended by OP-16, kept after OP-17, refined by review amendment 3 | Never overwritten. Human-written lines stay byte-identical; getff's own unfilled placeholder sections are replaced; getff's fence uses its own headings; one FYI line. | The appended fence breaks an existing reader (an AIF skill) → write the fence to a sibling file and point to it. |
| R2-P4 | Intent size | answered | A content rule instead of «≤5 lines» (§4.3). | Real projects end up with long intent sections that agents demonstrably ignore → add a soft size warning. |
| R2-Stack | The stack in the passport | author (review amendment 2) | **No generated stack block.** DESCRIPTION.md gets one pointer line to the lane's manifest: the operator's own «стек не нужно дублировать, ссылки достаточно». The earlier claim «the Stack block keeps readAif working» is withdrawn, because readAif misreads python and Vite React (§3). | An AIF skill demonstrably fails on a DESCRIPTION.md without a stack block → render a stack line from the manifest. |
| R2-Arch | ARCHITECTURE.md | author (probe-driven) | **No getff-only truth there** (§4.3). The truth is the check config plus the AGENTS.md table. The probe (AIF 2.11.0, 2 runs per command) found `/aif-architecture` replaced the whole file both times; it also inserts `## Architecture` into DESCRIPTION.md. `/aif` kept the AGENTS.md fence byte-identical both times (a weak result: the sub-agents inherited getff context). | Any getff check or reader is found consuming ARCHITECTURE.md content. |
| R2-Guard | Skill-context guards for `aif` / `aif-architecture` | author (review amendment 4) | **Dropped.** AIF's `/aif-evolve` owns `.ai-factory/skill-context/` as «the ONLY correct target» for its evolved rules. getff's `copy_safe` would skip an evolved file, and `--refresh` would wipe it. Protection is structural: getff reads nothing AIF writes, and the renders self-heal. The already-shipped `aif-review` / `aif-rules-check` overrides carry the same collision (`setup.d/20-agents.sh:77`, `install.sh:1400`); that is out of this spec and was flagged separately. | An uncontaminated live run shows `/aif` rewriting inside a getff fence → add a check that compares the fence with its source. |
| R2-Import | The `@AGENTS.md` import | answered: «Конечно!» (OP-15); widened by review amendment 5 | **Always ensured** in the project-root CLAUDE.md, created with one getff block when absent (§4.3). The widening: both of the operator's CLIs are below 2.1.277, and `.claude/CLAUDE.md`, `CLAUDE.local.md` or a parent CLAUDE.md also stop AGENTS.md. | A created root `CLAUDE.md` changes another harness's behaviour in a way a consumer reports. |
| R2-Upkeep | Upkeep without friction | author (review amendment 6) | §4.3 «Upkeep». | A switched-off section is re-added by self-heal, or a render fails a push. |
| R2-Venv | The python venv | author (review amendment 8) | The agent creates the venv itself under start-round consent; the acceptance adds a no-venv python scaffold. | The no-venv scaffold stays without a venv after an accepted start round. |
| R2-Steps | The shipped first steps | author (review amendment 9) | `fill-passport` becomes the agent step «confirm the guess card» in every sequence. The echo block goes, including «Edit AGENTS.md placeholders» (`99-finalize.sh:630`). `AGENTS.md.template:9` is amended. Stage 80 re-renders the rule → check table after the lock. | A sequence still carries a human passport step after the slice lands. |
| R2-Echo | The installer's «Review/edit» echo | answered (§4) | Replaced by the banner rendered from the step list (§4.1). The peer chip «Automate the manual steps getff's install still prints» (f35edf) has an FYI about the overlap. | — |
| R2-OP18 | Rule research: a question, or by default | answered: «да, поиск по умолчанию, не спрашивать» (OP-18) | **Runs by default and is never asked**; the research question leaves the start round. The opt-out (`INSTALL-FOR-AI.md:592`: research is skipped «only on an explicit operator opt-out») keeps existing, in the shape «a documented sentence the agent reads»: the start banner's FYI line names «skip research». An env var is the non-interactive twin for `-y` runs; its name is decided at landing. The landing updates `INSTALL-FOR-AI.md:592-600`, the research step's `when`, and `80-rule-bootstrap.sh`, whose skipped-research path ends green (`:17-18`), so a skip must still be reported as a skip. | The acceptance run or real users show research taking so long or costing so much that installs are abandoned → restore the question, or give research a visible time budget. |
| R2-Q2 | What «green project» means | answered (zero-rule branch: «Готово, с объяснением»); the rest on recommendation | §4.4. | On real projects research almost always yields zero → «green with zero» hides a chain that produces nothing; zero becomes failure. |
| R2-Q3 | Acceptance | answered: «A + доработки (Recommended)»; widened by review amendments 7, 8, 11 | §4.6. | The operator finds a quoted question unclear, or the stand-in hides a problem a live human would hit → add one manual run. |
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

The rest, plus the two items the round-2 review handed back (the detector order and the python
ast-grep gap), are below.

| # | Decision | Status | Resolution | Falsifier («wrong if …») |
|---|---|---|---|---|
| R3-1 | The «one-page truth card» (P5; contract §6.7 step 6) | author | **Not a new file.** The truth-pipeline rejects a second step source and a new product-claim file. P5's intent (one source, one pass over README / INSTALL-FOR-AI / the banner / the site) is exactly what the structured sources and their renders do. The contract's step 6 then means a render, not a source. | A cold agent needs a single page to answer «what does getff install and generate» (#1856 N10's predicate) and no render gives it → add a rendered one-pager: a render, never a source. |
| R3-2 | `agents/aif-init.md` | author | **Rewritten, not retired**, as the guess drafter. Round 2 handed it back as «`aif-init`'s role shrinks to the guess-first questions». It reads the repo evidence and returns the three guesses, each with its source or empty, and writes nothing. The main session shows the card, because AskUserQuestion is unavailable in subagents. It runs from the clone by path, since it is not installed yet at the start round. Its DRAFT-file behaviour goes, which R2-Q1 rejects. Rewriting keeps the shipped roster, its counts and the liveness entry unchanged. `packages/core/detector/passport.ts` (no production caller) is left as is: its fields are stack facts, which the passport no longer carries, and deleting it is irreversible while nothing here needs that. | The main session drafts better guesses without the subagent (acceptance transcripts) → fold the drafting into the step text and retire the agent. |
| R3-3 | Who writes the intent, and when | author | **The agent runs the intent writer right after the card, before install** (§4.3). Setup renders every fence on install and refresh. The agent never writes a getff fence or DESCRIPTION.md itself. | The acceptance run shows the agent writing `.getff/intent.md` by hand instead of through the writer → the hash check catches it on the first run; the prompt list names the writer call explicitly. |
| R3-4 | The non-npm lanes, and the python ast-grep gap (review hand-back) | author | §4.5. Omit questions that change nothing. Add ast-grep as a **project dev dependency** under start-round consent, together with the venv. Otherwise fall back to `uvx`, then `npx`, then «not done». A project-local, pinned tool keeps the consumer's CI able to run the same scan, which a global install or `uvx` alone does not. | The python dev-dependency route fails on a stock scaffold (a PyPI version gap, an unsupported platform wheel) → the check's `uvx`/`npx` route becomes primary and the question is dropped. |
| R3-5 | Detector order (round-2 §3 item 4, re-opened by review amendment 2) | author | **Manifest first on every detector path.** `detector/index.ts:31-33` is reordered, and `readAif` runs only when no manifest exists. The chain's own path already skips it (`resolve-ctx.ts:59`). Both the fix and the no-stack-block passport land in the passport slice. | A python fixture with a DESCRIPTION.md still reads as `ts-server`, or a Vite React fixture as `react-next`, after the change. |
| R3-6 | Is the start round really one or two calls? | author | Yes: §4.2 «Carrier». | Acceptance transcripts show a third call, or a question outside §4.2. |
| R3-7 | Skills installed mid-session | author | Every agent step's `run` is a path in the getff clone, read by path, never a slash command (the round-1 Q1 reason). This covers `rule-research`, `tool-bootstrapping`, the start round and `aif-init`. | The acceptance run shows the agent misreading or skipping a skill read by path → the step adds `/reload-skills` and invokes the skill. |
| R3-8 | The final check's entry point (truth-pipeline §6.2 delegates the name here) | author | `scripts/getff-check.sh`: pure bash, all lanes, delivered by setup (§4.4). Its first not-done step is the banner's «next» line. | The name collides with a consumer script, or pure bash cannot run a lane's check → keep the name, dispatch per lane inside it. |
| R3-9 | Zero-rule counts and research yield (contract N-t names this spec as the owner) | author | The generator writes a yield sidecar next to the lane's lock: researched / expressible / blocked, with reasons. The lock schema is unchanged (`packages/core/installer/types.ts:46-55`). Yield bottlenecks are out of scope and go to the rule-research owner: cross-host doc redirects and github-hosted docs failing the allowlist, python Tier-1 needing a venv, and duplicates of TypeScript checks. | The acceptance run yields zero proven rules on a stack → the yield fixes become a precondition of closure (§4.6 needs ≥1). |
| R3-10 | Boundary with the truth-pipeline contract | author | §6. | A landed sentence in either spec restates the other's decision → cut it to a pointer. |
| R3-11 | Where the intent confirmation hash lives | author; deviates from review amendment 1 («records a confirmation hash in the rules lock») | **`.getff/intent.confirmed`, next to the source, not the rules lock.** Three reasons: the lock does not exist when the intent is confirmed (step 2 runs before install); rust and go have no lock; and the lock schema (v2) would need a bump. The check and its falsifier are unchanged. | The sidecar record proves easier to bypass than a lock field would be (an agent rewrites both files in one edit in the acceptance run) → move the hash into the lock at stage 80 and have the check read it there. |

## 6. Boundary with the truth-pipeline contract

- **This spec owns** the step file's CONTENT (§4.1), the start round, the passport content and its
  renders, the green predicate (the terminal step's `doneWhen`), the final check's name, the yield
  sidecar, the acceptance run and closure.
- **The contract owns** the step schema and gates (T1-T1.5), the one-source rules R1-R10
  (including R7's list of chain-telling surfaces, which this chain's surfaces join), the site
  request rows, and goal governance (§6.8, R9).
- **Where they meet:**
  - The passport lands with the chain (contract §6.5, §6.7 step 2). The contract adds only the
    gating of its renders (§6.7 step 7).
  - The banner render (contract §6.2) is §4.1's banner.
  - The contract's §6.7 step 2, «the chain wiring with the executable step file», is this spec's
    implementation. Its step 6, «the truth card», is a render per R3-1.

## 7. Testing seams

- **One seam carries most of it: the final check** (`scripts/getff-check.sh`). Every step's
  `doneWhen` and the green predicate run through it. Its fixtures:
  - a consumer per lane with each step done, and one with each step not done;
  - a generated rule whose wired glob misses its target, which must fail the wiring arm (the N14
    regression).
- **Deterministic passport fixtures** (npm and pure bash; review amendment 11):
  - the intent render into DESCRIPTION.md and AGENTS.md;
  - the confirmation-hash check, including a bypassing edit;
  - import idempotency;
  - the P3 placeholder replacement;
  - the detector order on a python and a Vite React fixture;
  - the rule → check table rendered from the rules lock without node.
- **Existing seams, reused:**
  - `first-steps-parity.test.ts` and the render `--check`s (contract §7);
  - the per-stack cells of `framework-fresh-install-validate` (Q4.3, #1860);
  - `check-fences-fire.sh` over the fixture triples.
- **The one non-mechanical seam is the cold acceptance run** (§4.6). It includes the
  fence-survival assertion, and it is re-armed when an agent step's `run` path changes.

## 8. Rejected alternatives

- The whole chain in the pasted prompt: it drifts. The plugin command as the owner: Claude Code
  only, and no `--full`.
- A breaking `-y` backstop: it reverses S1-4.
- Level-2 researched tooling in the chain.
- Folding the RED fix into this program.
- Overview documents, DRAFT files left for later review, and a human-edited passport (R2-Q1).
- Three separate intent questions: replaced by one evidence-only card (R2-Q1.1).
- The intent source inside a DESCRIPTION.md fence: a fence is a render (R2-P1).
- A generated stack block (R2-Stack).
- ARCHITECTURE.md as a render target: AIF rewrites it (R2-Arch).
- Skill-context guards: AIF owns that store (R2-Guard).
- Asking about rule research (R2-OP18).
- A separate truth-card file (R3-1), and a second step file next to `first-steps.source.json`.
- Retiring `aif-init` (R3-2), and the intent hash in the rules lock (R3-11).
- ast-grep through `uvx` or `npx` only, with no project dependency: the consumer's CI would lack
  the tool (R3-4).

## 9. Implementation slices (for writing-plans, after approval)

1. **Step file.**
   - The schema per contract T1.1, plus this chain's steps and `fill-passport` → «confirm the
     guess card».
   - The prompt render (no «Stop here»), the banner render, and pointers from README, the plugin
     command and `skills/getff`.
   - The research opt-out: the banner line, `INSTALL-FOR-AI.md:592-600`, and the skip reported as a
     skip.
   - Owes a new SSOT row for the step-file prior art (contract N-p: build on own precedent; adapt
     the Steps.md and Doc Detective vocabulary).
2. **Passport:**
   - the intent source, the intent writer and the hash check;
   - the renders: DESCRIPTION.md fence and manifest pointer, AGENTS.md fence and table, ARCHITECTURE.md
     pointer, the `@AGENTS.md` import;
   - the stack-neutral template and old-passport handling;
   - opt-out markers;
   - the detector order (R3-5);
   - the `aif-init` rewrite;
   - the `AGENTS.md.template:9` amendment.
3. **Final check and green:** the generator's fixture triple, the wiring arm, lock matching, the
   yield sidecar, and `scripts/getff-check.sh`.
4. **Non-npm lanes:** python render in setup, the venv and ast-grep dev dependency, and the check's
   fallbacks.
5. **Research reads intent** (R2-P2).
6. **Acceptance run and report**, including fence survival; then `done.md`.

Slices 2-5 can run in parallel once slice 1's schema lands. Slice 6 closes the program.

## 10. Changelog

- 2026-09-28: draft opened; round 1 (Q1-Q4) folded in from its separate session (WIP `e5fb19bde99`).
- 2026-09-28, **r2** (`a8241c7e611`): round 2 folded in from `_decisions-2026-09-28-one-button-round2.md`,
  including the OP-15, OP-16 and OP-17 blocks and the `/aif` probe. Premises P8-P12 added. §3
  re-anchored to `f526c61c70a`. Chain, passport, green, lanes and acceptance written out. Round 3
  closed by author decisions. Boundary, testing seams, rejected alternatives and slices added.
- 2026-09-28, **r3** (anchors re-checked at `33147ff9228`): the round-2 cold re-review block and
  OP-18 folded in. That block landed in the decisions file after r2 was written.
  - Passport: the intent source moves to `.getff/intent.md` with an intent writer and a hash check;
    there is no stack block; P3 is refined; the skill-context guards are dropped; the import is
    always ensured; upkeep rules and opt-out markers are added.
  - Start round: the research question is removed (OP-18), and the python venv + ast-grep question
    is added.
  - Round 3 revised:
    - R3-2 rewrites `aif-init` instead of retiring it;
    - R3-3 and R3-5 follow the new source and the detector order;
    - R3-4 closes the python ast-grep hand-back with a project dev dependency;
    - R3-11 (shipped agent counts) DISSOLVED with the R3-2 rewrite; the ID now holds the hash
      location, which deviates from the review's «in the rules lock», with reasons.
  - Step 8 and step 1 gain `doneWhen: none` reasons (contract r3: `actor` required, `none` needs a
    reason). The acceptance gains a no-venv python scaffold and a scripted intent answer.
