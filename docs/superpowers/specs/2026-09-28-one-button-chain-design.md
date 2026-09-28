# getff one-button chain — design

> **Status:** DRAFT r6. The §2 cold review ran both rounds (on r3 and r4), both folded; no third
> round runs. Dispositions and revision history: the [review log](2026-09-28-one-button-chain-review-log.md).
> r6 folds operator premises P15-P17 (round 6; R6-2 supersedes R5-9); R6-3 = Б, R6-2 = B, R6-7
> agreed. R6-1 and R6-6 are open again after the operator's two-layer reading. No code before approval.
>
> **Authoritative for:** the one-button chain: its ordered steps (the CONTENT of the step file) and
> the chain record; the start round; the consumer passport the chain leaves; the complete-install
> and green-project predicates and the final check's entry point; the lane contract; the
> acceptance run and the closure rule.
>
> **NOT authoritative for:** the project goal ([README.md#why-this-exists](../../../README.md#why-this-exists));
> the step file's SHAPE and the docs-truth contract (step schema and gates, one source per fact,
> pre-push drift checks, goal governance): the truth-pipeline contract, drafted as
> `_design-2026-09-28-truth-pipeline.md` (r3, coordination directory; boundary §6); the «one beat»
> D1 ([any-stack closure spec](2026-07-23-getff-any-stack-closure-design.md)); stream 1 (#1860, #1868).
>
> Anchors: `origin/staging` `33147ff9228` unless marked.

## 1. Goal

One button installs everything getff offers a project, completely, in one agent session: getff
itself; the passport; tools (skills and MCP servers, in the project and, with consent,
machine-global); live rule research; generated rules, each with its firing test. The shipped core
seeds the research that generates rules (P15, R6-3); getff uses on itself what it ships (P16).

The target state is a **complete install** (P13): every part above is in place and proven by the
final check, or the human declined it and the report lists it (§4.4). A green project (the
project's own checks pass and every generated rule proves itself) is one condition of a complete
install, not the goal by itself. The chain names no stack: each stack plugs in as a **lane**
through one contract (P14, §4.5). «One button» means one agent session, not one shell command.
Glossary ([CONTEXT.md](../../../CONTEXT.md)): One button, Passport, Complete install, Green project, Lane,
Core, Recursive self-application. Measured 2026-09-27/28, it is not turnkey today: the parts exist,
the road between them does not ([research patch N1-N15](../../meta-factory/research-patches/2026-09-27-ai-navigability-what-getff-installs.md); §3).

## 2. Operator premise register

Faithful to meaning. P1-P7: this session and round 1 (2026-09-27/28); P8-P12: the round-2
session; P13-P14 and P15-P17: the operator's corrections after r3, after r5 and at the model round.

| # | Premise | Source |
|---|---|---|
| P1 | getff's «tests» are the per-rule firing test plus its paired negative. Tests for the consumer's app code are NOT getff's product. | operator, 2026-09-27 |
| P2 | Machine-global installs (the deepwiki MCP, superpowers, and ast-grep via `--global`) must be ASKED of the human during install. A silent skip under `-y` is wrong. | operator, 2026-09-27 |
| P3 | One button = one agent session. | operator Q1=A 2026-06-28; closure spec D1 |
| P4 | The ESLint `^9` pin and `preset-next-15-canonical` are legacy frozen surfaces: low priority, not something to lead with. | operator, 2026-09-27 |
| P5 | Order: this design → the one-page truth card → ONE pass over README / INSTALL-FOR-AI / the installer banner, plus gate widening → the getff.ai site adds the step. Docs are not fixed before the chain exists. | operator, 2026-09-28 |
| P6 | The getff.ai site is NOT the problem; the gap is the product chain. Messaging the site seat needs an explicit operator yes. | operator, 2026-09-28 |
| P7 | The generator already exists and is stack-general (it was built from the presets); the gap is the ROAD to it. Designs are stack-neutral. Nothing is Next-specific: Next.js was only the test subject. Hand-patching per-stack×version recipes does not scale. «погоди загатовки уже были мы от них и создали гинератор а ты еще раз заново предлагаешь … вот этот некст вообще не всрался вообще у меня генератор под любой стек уже должен был быть готов». | operator, round-1 session |
| P8 | Convenience first. Every human touchpoint must be critical and narrow. Everything else is automatic, with an FYI line and a one-step revert. «все должно быть максимально автоматически - и только в самых узких местах где это действительно критично и важно нужно тревожить оператора». | operator OP-16, round-2 session |
| P9 | No passive agreement. The author argues its own view, including disagreement, and never flips a decision on a remark without weighing it. Convenience must not silently weaken a guard. «мне не нужно пассивное согласие я хочу чтобы было как можно лучше». | operator OP-17, round-2 session |
| P10 | The human writes nothing; the agent proposes, and never asks what the stack already tells. «человеку влом будет самому писать — надо предложить готовый вариант в виде вопроса»; «очевидные из стека вещи точно не нужно спрашивать у оператора». | operator, round-2 Q1 / Q1.5 |
| P11 | Docs, the passport, architecture and the docs site are ONE process, installed by the one button and written by AI from one source. «и все это в одну кнопку должно ставиться … человек точно не пишет». The truth-pipeline contract realises the docs side; this spec realises the chain side. | operator, round-2 Q7 |
| P12 | Recursive self-application: what getff ships as «one source per fact» also applies to the getff repo. «Да конечно должно рекурсивно на самом себе … это принцип нашего проекта!». Owned by truth-pipeline T13. It matters here because T13 step 4 gives the getff repo this spec's passport scheme. | operator OP-15, round-2 session |
| P13 | The goal is a complete one-button install, not «green». «Green» is a formal target that can be reached many ways; what counts is that everything is installed and works. «Кажется это уже формализм цели … цель же установка всего с одной кнопки - генерация правил и тестов скилов и мсп и тд - полностью!» | operator, 2026-09-28, after r3 |
| P14 | Design one universal, stack-scalable architecture now; the python, rust and go lanes stay alpha and are not this program's target. «на Rust и Go и питон пока пофиг они в альфа версии остаются -тут суть только в том чтобы делать сразу мастшабируемую под любой стек архитектуру разу проектировать унивеерсальный дизайн под все!» | operator, 2026-09-28, after r3 |
| P15 | Rules are generated from the stack: research reads the docs and uses MCP servers and skills with best-practice patterns and anti-patterns, and writes the rules from them. Only the core ships: the universal rules that fit every project, from which all other rules and tests derive. The core principles cannot be generated; everything else is generated from them (e.g. «search the docs for best practices» is such a rule). «правила должны генерироваться из стека - читаться документация использоваться мсп и скилы с бест практис патернами и антипатернами и из них писаться правила, поставляется только едро … есть некие правила которые нельзя сгенерировать - основные принципы, из них уже генерируется все остальное! ТИпа правило искать в документации бест практики и тд» | operator, 2026-09-28, after r5 |
| P16 | Recursive self-application means getff uses on itself everything it installs for consumers: the rules and tests for docs, for AI, for everything, and the architecture and the passport too. It widens P12 from «one source per fact» to every shipped artefact. «Рекурсивное самоприменения касается самого этого проекта все что он ставит своим консьюмерам используется и у него, есть правила и тесты для документации для ии для всего точно так же и архитектура и паспорт тоже». Asked about R6-6, the operator named the other direction too: «я имел ввиду что то что работает сейчас у нас будет работать и у консьюмеров». | operator, 2026-09-28, after r5 and at the r6 questions |
| P17 | The one button runs the operator's own start-of-project flow, for any stack. When no stack is given, research the best stack for the task, choosing tools built best for AI agents. Then find the skills and tools for the stack: the deepwiki and context7 MCP servers, the stack's own MCP server when needed, and a skill matched to the stack's version with best practices and anti-patterns (or, when no skill is needed, the stack's docs directly). Then write the rules, patterns and anti-patterns, the architecture and the docs, and generate the tests for them; the AI docs are formed up front. Building may start with React. «Вот какой мой обычно флоу - если стек не задан то я изучаю лучший стек под задачу - выбераю топ под ии именно инструменты у которых все именно под ии лучше всего заточено, затем под стек ищу уже скилы и инструменты, затем пишутся правила и тесты все планируется - главное заранее формируется правильная документация под ии - вот все это должно одной кнопкой делаться !! и под любой стек!! НО сначала можно и с реакта начать просто!» | operator, 2026-09-28, model round (Q1) |

## 3. Starting point (measured)

- **The generator** (`packages/core/synthesizer/`, `agents/rule-researcher.md`,
  `.claude/skills/rule-research/SKILL.md`) covers JS/TS, Python and Rust (#805, #1005, #1006,
  #1010; IR unfreeze #1084). Each rule carries a bad and a good example and a negative test, proven
  by gates that already run (R5-12). Nothing proves that a rule is wired into the project's config.
- **The road is cut in three places.**
  1. The pasted prompt still ends «8. Stop here» (`INSTALL-FOR-AI.md:107`) and says the passport
     must NOT be filled by the agent (`:101`). Research is gated by a stopping rule whose opt-out
     shape was parked (`:592-599`).
  2. With no research pair, generation is skipped (`setup.d/80-rule-bootstrap.sh:52`), and nothing
     in the install writes the pair.
  3. **N14.** Measured 2026-09-28: with the pair present, the generator could not start. **Closed
     by stream 1:** the step now runs the prebuilt `rule-bootstrap-cli.bundle.mjs` (`:31`), and a
     failed generation is named in the NOT-wired summary (`:80`).
- **The installer still asks the human to act.** Its «Next steps» block says to review/edit
  DESCRIPTION.md and ARCHITECTURE.md, edit AGENTS.md placeholders, install dependencies, verify
  hooks and run two checks (`setup.d/99-finalize.sh:627-662`).
- **The step file exists.** `packages/core/templates/shared/first-steps.source.json` (schema
  `getff.first-steps/v1`) keeps one sequence per depth. `fill-passport` is a human step at every
  depth (`:45`, `:99`, `:141`); `research-your-stack` exists only at core depth (`:75`); its two
  claimed renders are not generated (truth-pipeline draft N-k).
- **The passport is read by nobody on the chain path, and misread off it.** The generator skips it
  (`packages/core/synthesizer/resolve-ctx.ts:59`) and the researcher never reads it. Every other
  detector path reads it FIRST (`packages/core/detector/index.ts:31-33`), and `readAif` maps any
  «React» or «Next.js» text to `react-next` (`read-aif.ts:18-19`). getff's own DESCRIPTION
  template names Next.js (`packages/core/templates/shared/DESCRIPTION.template.md:17`) and the
  python lane copies it (`setup.d/45-python.sh:1352`): a python or Vite React project reads as
  `react-next`. `agents/aif-init.md` is shipped (`install.sh:232`) and reads manifests and the
  layout; nothing calls it.
- **Claude Code loads CLAUDE.md OR AGENTS.md:** AGENTS.md only when no CLAUDE.md,
  `.claude/CLAUDE.md` or `CLAUDE.local.md` exists at or above the working directory, and directly
  only from 2.1.277; the Mac runs 2.1.270, the factory 2.1.220 (code.claude.com/docs/en/memory.md,
  re-verified by three seats). getff writes no `@AGENTS.md` import.
- **The non-npm lanes (alpha, P14).** Python exits before the npm layer loop (`install.sh:383-389`),
  so stage 80 and `05-mcp` never run there; `-y` without `--global` skips each machine-global step
  with one line (`setup.d/engine.sh:69-70`). Python rules are ast-grep YAML
  (`agents/rule-researcher.md:164`); python CI pins ast-grep and its pre-push fails open without it
  (`packages/core/templates/python/github-actions-ci.yml:45-46`, `hooks/pre-push.sh:44-45` there).
  Cargo and go write a lock (`setup.d/46-cargo.sh:24`, `47-go.sh:19`) but have no agent surface.
- **P15-P16, measured** ([research patch](../../meta-factory/research-patches/2026-09-28-core-and-self-application.md)).
  The invariant core was designed (`docs/meta-factory/architecture.md:16`) and never shipped: the
  «core» in force is 4 ESLint rules picked by a 2-stack test (`closed-questions.md:129`), one layered
  dependency-cruiser preset ships to every npm stack, and generation cannot express boundaries
  (`agents/rule-researcher.md:117`). getff runs 4 of its 16 shipped groups as consumers do.
- **A fresh scaffold has no repository and no app tests** (R5-1, R5-2). The #1860 cell has both
  (`tests/consumer-matrix/own-config-cell.sh:73`, `:130`), so it hides the gap.
- **Acceptance has never run.** The 2026-07-23 program's acceptance was dropped twice (research
  patch N15), and `agents/getff-cold-run-prober.md` is still DORMANT.

## 4. The chain

### 4.1 Steps

These steps become a new **one-button sequence** in `first-steps.source.json`, next to the depth
sequences (R2-Q7, R4-3), and the pasted prompt runs it to the end. In every other sequence,
`fill-passport` becomes the agent step «confirm the guess card» (R2-Steps). The step shape is the
contract's step schema (§6). Every agent step's `run` is a file in the getff clone, read by path (R3-7).

| # | Step | Actor | When | What happens | Done when |
|---|---|---|---|---|---|
| 1 | read-steps | agent | always | The pasted prompt clones getff and has the agent read this list by path. | `none`, reason: «the list is read before any artefact exists; the acceptance run proves it» → `unverifiable` |
| 2 | start-round | agent (main session) | always | One question round before anything is installed (§4.2). The agent then runs the intent writer, which writes the confirmed intent and the chain record, creates a repository when there is none (R5-1), and runs the baseline (R5-5). | `.getff/intent.md` and `.getff/chain.json` exist |
| 3 | install | setup | always | `./setup --full <stack>` at the default profile (`env`), plus `--global` when the chain record says so. Setup renders the passport (§4.3) and appends this run's self-verify result to its record (R5-10). | The setup record's entry for this run says pass and is newer than the chain stamp |
| 4 | tools | agent | the chain record lists accepted tools | Installs them through `tool-bootstrapping`, whose Rule 3 counts the recorded start-round answer as the explicit confirmation (R5-11). | Every accepted tool is present: its skill directory, or its MCP entry in project or user scope (`~/.claude.json`). This proves presence, not use. (`.ai-factory/tool-decisions.md` is no probe: install seeds it, `setup.d/30-templates.sh:41`.) |
| 5 | research | agent | no research opt-out (R2-OP18) | Runs the rule-research protocol for the chain (R3-12). It reads the intent source, and must-never lines become rule candidates (R2-P2). | The lane's research files exist and are newer than the chain stamp; with the opt-out, `skipped-by-consent` |
| 6 | generate | setup | no research opt-out | Re-runs step 3's command (R2-Q6). The generator writes the rules with their examples and negative tests (R5-12), the lock, the yield sidecar and the rule → check table fragment. | The yield sidecar's research hash equals the hash of the current research files, and the setup record's entry for this run says pass |
| 7 | check | agent | always | Runs the final check (§4.4) and follows each fix line it can. | The final check exits 0: the install is complete |
| 8 | report | agent | always | The report to the human, built only from step 7's output, plus the FYI lines. | `none`, reason: «chat output built from step 7, which is the proof» → `unverifiable` |

**The chain record (R4-3, R5-7).** `.getff/chain.json` has one writer, the intent writer. It holds
the chain stamp (the end of the start round; every «newer than» probe compares with it, so step
6's second setup run cannot hide step 5), the sequence id (the final check walks it; with no record
it walks the depth sequence of the last setup entry's profile, so a plain `./setup` never asks for
chain steps) and the consent answers (companions, tools accepted and declined, research consent
and opt-out), so every `when` above is a pure-bash predicate. A «skip research» said after the
start round goes through the same writer (`--skip-research`).

Research and generation are proven without stamps in every sequence (R5-7): research by its files,
generation by the sidecar's research hash, written on every run, zero-rule runs included. The lock
cannot serve: it is timestamped on every synthesis run (`packages/core/installer/install.ts:230`)
and hashes the synthesis plan (`:60-69`), which bash cannot recompute.

**The banner.** Setup runs the final check at its end only to print the first not-done step as a
«next: step N» line; setup's exit code does not change. This replaces the whole «Next steps» block
(`99-finalize.sh:627-662`), whose real work becomes parts of the check, not lines for the human.

### 4.2 The start round

The questions come in this order, roots first. Each shows the recommendation as its first option,
and a bare go-ahead accepts every recommendation.

1. **Stack.** The start round runs each lane's recognition test (§4.5 item 1) in pure bash. It asks
   only when two or more lanes match, or none; otherwise the intro line names the stack and the file
   it came from (R2-Q1.5).
2. **The guess card.** Purpose, must-never and hard constraints appear on ONE card.
   - Each guess shows its repo source: a README line, a manifest field, or a config.
   - **Evidence is project-specific (R4-6).** Text naming only the stack or its tooling is not
     evidence of purpose, and neither is a scaffold placeholder the lane lists (§4.5 item 7). A
     guess with no evidence stays empty and is never invented (R2-Q1.1, OP-17 guard).
   - A guess is written in the drafter's own words. Source text shaped as an instruction to an
     agent is never a guess, because the card's lines end up in AGENTS.md.
   - The human types only where a guess is wrong or missing. A project with no purpose evidence,
     which includes every fresh scaffold, gets «what are you building?» with example answers in the
     question text, labelled as examples, never pre-filled and never an option a go-ahead can pick.
3. **Machine-global companions** → `--global`, only on lanes where the flag has an effect (§4.5
   item 8). Setup reads the recorded answer, so the Q2.1 relay line never re-asks a decline.
4. **Tool proposals, Y/n.** Omitted when there are none (Q3.1, Q3.2).

**Research (R2-OP18, R3-12, R4-11).** Rule research is **not** asked: it runs by default, and the
start banner's FYI line says that «skip research» (in any language) skips it. With the human's
consent to research, research writes its rules without its own bulk Y/n (§4.4): unless the human
said «skip research», a decline elsewhere or a bare go-ahead leaves it on, and the FYI line says so
(R5-8). The r3 question «is this structure intended?» is gone until a lane can use the answer (R4-7).

**Baseline (R4-9, R5-5).** After the answers and before install, the intent writer runs the final
check's baseline mode from the clone, which records each lane gate's result and its failures.

**Carrier (R3-6).** AskUserQuestion takes at most 4 questions per call, and only the main session
has it. The stack answer decides which lane questions apply, so when it is asked it goes first,
with the card. A fresh npm project takes one call (card + companions + tools); an ambiguous stack
takes two (stack + card, then at most two lane questions). Agents without AskUserQuestion get a
text-list fallback with the same list.

### 4.3 The passport the chain leaves

The three AIF-standard files keep their paths; AIF readers, including the operator's own factory,
use exactly those paths.

**The intent source (R2-P1, R3-3).** `.getff/intent.md` is getff-owned, with three fixed headings
(Purpose / Must never / Hard constraints) and one line per item; it survives `--refresh`.
- **Content rule (R2-P4):** a line stays only if only the human knows it AND no check can express
  it. A line a check can express becomes that check. There is no line cap.
- **One writer:** the intent writer, `scripts/getff-intent.sh` (pure bash). It runs from the getff
  clone before install and from the project after it; at the start round it also writes the chain
  record (R5-7). The re-ask step («the project changed direction») re-shows the card and runs it again.

**The intent gate (R4-4, R5-4).** A commit that removes or rewords a must-never or hard-constraint
line fails the pre-push hook unless it carries an `Intent-change:` trailer with a reason of 20
characters or more (`attention-is-not-a-mechanism.md` §1); adding a line never needs it. The gate
reads git history, so the writer is no way around it. Its honest limit (whoever writes the commit
writes the trailer; `--no-verify` skips the hook) and its two other channels are R5-4. The re-ask
step quotes the human's answer in the trailer. The final check reports the gate as armed, naming the
hook that runs it (the node hook, or the fallback below Node 20), or as not armed.

**Renders (R4-12, R5-13).** One setup render function writes them on install AND on `--refresh`;
it replaces refresh's own passport copies, and refresh stops exiting before AGENTS.md and stage 80
(`install.sh:1363-1370`, `:1421-1423`). A section only getff generates is replaced with no
keep-copy, since its opt-out marker covers «keep my edit». A render with unchanged bytes writes
nothing; the next button or refresh run heals a render with an FYI line.
- **`.ai-factory/DESCRIPTION.md`:** a getff intent fence rendered from the source, for AIF readers,
  and one line pointing at the lane's manifest (R2-Stack), with no stack block: «стек не нужно
  дублировать, ссылки достаточно». A stack-neutral starter replaces the TS template; its heading is
  the project name from the manifest.
- **An old DESCRIPTION.md (R2-P3):** human-written lines stay byte-identical; a section whose lines
  are all byte-identical to a getff template's unfilled placeholders is getff's own leftover and is
  replaced; getff's fence uses its own headings, so it never repeats «Non-goals» or «Hard
  constraints».
- **`.ai-factory/ARCHITECTURE.md` carries no getff-only truth (R2-Arch).** getff writes only a
  fenced pointer block: to the check config and the AGENTS.md table, or «no architecture rules
  yet». AIF's `/aif-architecture` rewrites this file (measured 2 of 2). The starter copy and its
  header rewrite stop (`setup.d/30-templates.sh:85-86`); a fresh file holds only the fence.
- **Delivery mode (R4-12).** Both files change from no-clobber copies to «create the starter when
  absent, splice the fence, replace getff's own placeholder sections»; `merge_fenced` alone cannot
  replace unfenced sections. The shipped-destination list follows
  (`packages/core/hooks/pre-push.ts:2123`).
- **The `AGENTS.md` fences.** Stage 30 writes the static `getff-framework` section
  (`setup.d/lib.sh:77`) with the intent lines. The «rule → what checks it» table has its own
  section (R5-13), so the static splice never wipes it: the generator writes it as a fragment next
  to the lock, and the render function merges it in pure bash through `merge_fenced` (`:1004`).
  With no fragment the section says «no generated rules yet». `AGENTS.md.template:9` («This file is
  a POINTER DOC») is amended in the same change.
- **Project-root `CLAUDE.md` (R2-Import).** Setup always ensures a getff-marked `@AGENTS.md` import.
  It creates the file from `CLAUDE.md.template` only when git never tracked a root CLAUDE.md,
  reduced to that block, with its false «reads BOTH» line fixed
  (`packages/core/templates/shared/CLAUDE.md.template:8`); a file the human deleted stays deleted
  and the check lists the import as declined. The docs guarantee the import never makes Claude Code
  read AGENTS.md twice; known limit: it loads all of AGENTS.md, including AIF's «Project map».

**Upkeep (R2-Upkeep).** Pre-push checks never write. The AGENTS.md fences get a consumer-side check
with the contract's §6.7 step 7; until then the next setup run heals an edit inside them. The
DESCRIPTION.md and ARCHITECTURE.md renders never fail a push, because getff reads neither (§6 asks
for their CI-only entry). Every automatic write honours a per-section opt-out marker: it is the
one-step revert, self-heal never re-adds a switched-off section, and the FYI line names it.

**What reads what.** Rule research reads the intent source (R2-P2). Stack detection reads the
manifest first on every path, and `readAif` is a fallback only when no manifest exists (R3-5).
getff reads nothing that AIF writes, except that fallback's DESCRIPTION.md on a project with no
manifest: the generator skips `readAif` (`resolve-ctx.ts:59`); `readAif` stops reading
ARCHITECTURE.md and skill-context (`read-aif.ts:113-138`) and stops throwing on a DESCRIPTION.md
without a canonical heading (`:104-108`), which the new starter is; `merge_fenced` reads AGENTS.md
only to splice getff's own fences. That, not a skill-context guard, protects against `/aif`
rewrites (R2-Guard).

### 4.4 Complete install, green, and the final check

**Complete install (P13, R4-1, R5-3)** means every part below is `done`, `skipped-by-consent`
(declined by the human), or `not-applicable-on-lane` because its lane item is optional (§4.5). A
part whose required lane item is missing is `not-done`, «not built on this lane», so an alpha-lane
install is never complete. Declined and not-applicable parts are listed, never counted as done.
1. getff: the setup record's last entry says pass (steps 3 and 6).
2. The passport: the intent source and its renders exist, and the intent gate is armed.
3. Tools: every tool the chain record lists as accepted is present (step 4).
4. Research: it ran after the chain stamp, or was skipped by consent (step 5).
5. The project is green.

**Green** means all four of these hold (R2-Q2); the lane supplies each proof (§4.5).
1. The project's own checks pass: the lane's gate list, which writes nothing but the project's own
   build output. A gate with nothing to run (no app tests) passes and is reported as «no app tests;
   not getff's product (P1)» (R5-2). On an existing project a failure the baseline already held is
   listed as pre-existing and not counted, a new failure on the same gate counts (R5-5), and a gate
   that could not run then must pass now. A failure a generated rule raises on code that predates
   it is a finding: the report lists the rule and the places, and it does not block green, because
   the rule did its job (R4-9).
2. Every generated rule proves itself. *Logic:* the generator's existing proof (§3, R5-12); the
   rule's manifest entry, with its examples and negative test, is its lasting firing test (P1).
   *Wiring:* the lane runs the project's real lint or scan config over the bad and the good example
   as if each sat at a path the practice applies to, writing nothing into the project (R4-5); the
   bad one must fire and the good one stay silent. The path comes from the research record
   (`packages/core/research/types.ts:24-33` has no path field; R4-13 adds one), never from the
   wired glob, where planting always fires: N14 measured a rule that fired in
   `src/app/actions/probe.tsx` and stayed silent in `src/app/layout.tsx`. With no path the rule is
   «wiring unproven», never passed (R5-14).
3. The lane's lock exists and matches the generated rules, and step 6 is proven (§4.1).
4. The report is built from these checks, never from the installer's exit code.

**Zero rules** is «done, with an explanation», reported as «0 new rules», with the counts
(practices researched, expressible, and blocked by provenance), the reasons, and the next action.
The counts live in the yield sidecar next to the lock, because the lock has no field for them
(`packages/core/installer/types.ts:46-55`; truth-pipeline N-t; R3-9). When research wrote without
its bulk Y/n, the report also lists every new rule with its source and a one-command removal, and
every source blocked for want of a Tier-2 ack, with the command to add it later (R3-12).

**The final check** is `scripts/getff-check.sh` (R3-8): pure bash, naming no stack. It calls the
lane for green's parts 1-3, reads the chain record for every `when`, and walks the sequence the
record names. It reports in the shape of the contract's «one final check» (§6.2), lists the intent
lines changed since the chain stamp (R5-4), and exits 0 only on a complete install. Setup runs it
only for the banner line; the agent runs it as step 7. Its baseline mode runs green's part 1 and
writes `.getff/baseline.json`. It is getff-owned, delivered on npm lanes and refreshed on
`--refresh`; on an alpha lane, step 7 runs it from the clone.

### 4.5 Lanes (P14, R4-2, R5-6)

The chain, the start round and the final check name no stack. Each stack plugs in as a lane
through one contract. A lane supplies:
1. **Recognition:** the manifest files that mark it, plus a dependency test where lanes share one.
2. **Gates:** its gate list, each reporting pass, fail, could not run, or nothing to run.
3. **Logic proof:** the runner that proves each generated rule on its own examples.
4. **Wiring proof:** runs the project's real config over a given text at a given path and writes
   nothing into the project.
5. **Research arm:** the rule format research produces, with each practice's path, and how setup
   renders it into rules.
6. **Lock and yield:** the lock, the yield sidecar with the research hash, and the table fragment.
7. **Scaffold placeholders:** template texts that are not purpose evidence.
8. **Question effects:** which start-round questions change anything on the lane.
9. **Architecture arm** (optional, R6-2): boundary rules generated from research on the stack, the
   intent and the import graph, proven like any generated rule. No lane has it.
10. **Install arm:** how setup installs the lane and writes its setup record entry.
11. **Hook arm:** how the lane wires the pre-push gates, the intent gate among them.
12. **Dependency reader:** the project's dependencies, behind tool proposals (Q3.1).

A lane that lacks a required item (every item but 9) leaves each part that needs it `not-done`,
«not built on this lane»; lacking item 9 is `not-applicable-on-lane` (R5-3). A stub lane fixture
(a fake manifest and stub lane scripts) proves that the chain names no stack (§7).

**The npm lanes are built first, and only they are this program's target.** Recognition:
`_detect_stack_from_pkg` (`setup.d/lib.sh:2111-2120`). Install arm: the npm layer loop and
self-verify. Hook arm: `.husky` (`setup.d/50-hooks.sh:72-81`). Dependency reader: `package.json`.
Gates: the fresh-install list of round-1 Q4.3 without «first commit», which writes; the test gate
first asks the runner for its matched files (R5-2). Logic proof: the existing generation and
mutation gates (R5-12). Wiring proof: the project's own ESLint config through `eslint --stdin`
(R5-14). Research arm, lock and table: the existing generator (§3), plus the path field (R4-13).
Scaffold placeholders: the template README of `npm create vite` and the TS server scaffold's
equivalent text (§4.6). Question effects: `--global`.

**The python, cargo and go lanes stay alpha (P14).** There the final check reports «complete install
is not built on this lane yet» and lists what did run; P2 there rests on the Q2.1 relay line. §3
records the facts for that later work; the F-A reading «the python install stays Node-free»
(`agents/rule-researcher.md:212-213`) is not touched.

### 4.6 Acceptance and closure (R2-Q3, R2-Q4)

**Setup of the run.**
- A cold agent gets an official scaffold per stack and the new pasted prompt, nothing else. The
  scaffolds are two npm stacks, neither Next (P4, P7): React via `npm create vite` react-ts, and a
  TypeScript server from an official generator chosen at landing, with no repository or app test
  beyond what the generator makes (R5-1, R5-2). It runs in a fresh container on the PC, whose
  headless CLI is logged in (the Mac's is not); a logged-out CLI is NOT-RUN, never a pass (R5-16).
- A stand-in answers the real AskUserQuestion through the Agent SDK `canUseTool` callback, never in
  the SDK's `dontAsk` mode, which denies it; the report quotes every question verbatim. This
  replaces the DORMANT `getff-cold-run-prober`, a subagent, which has no AskUserQuestion.
- The stand-in accepts every recommendation. Where the card asks «what are you building?», it gives
  a scripted answer with a must-never line, so the renders and the must-never → rule path run on
  every scaffold. A second pass on one scaffold declines `--global`, and research still writes (R5-8).

**Pass requires all of these:**
- the install is complete (§4.4), under blanket consent, with ≥1 proven generated rule per stack;
- on each fresh scaffold the card offered no placeholder as purpose;
- no framework code was read (`packages/**`, `setup.d/**`; the step file, the `run` files and
  shipped docs are allowed); the research step reads the allowlist from a render in its own
  reference, not from `packages/core/research/allowlist.ts` (R4-8);
- the questions came before setup, research asked nothing, and there was no second human message
  (start-round answers count as answers, not messages);
- after `/aif` and `/aif-architecture` run on the result, every getff fence survives;
- the report says whether an MCP server added at step 4 was live at step 5, as measured (R5-15);
- on getff itself (P16, R6-6): the shipped-list gate is green and the intent gate runs on its push.

The closure spec's binding python Done line (`2026-07-23-getff-any-stack-closure-design.md:226-227`)
is not discharged by this program; it stays open with the python lane (P14).

**Closure.** The acceptance report is a committed file with a machine-readable verdict line. This
program's `done.md` must cite a PASS report; «PARKED» is not closed. A report goes stale when an
agent step's `run` file changes after the run, by path or content; a stale report blocks promote
(truth-pipeline T7.1), so a run made before the contract's docs pass is repeated after it (R5-16).

## 5. Live decision register

Status: **answered** (the operator chose); **delegated** (a discussion session decided); **on
recommendation** (unobjected); **author** (decided with no operator fork, P8; FYI'd);
**operator-fork** (open, with a recommendation). *Blanket*: confirmed by round 1's «ок согласен с
тобой полностью». Round-2 rows cite `_decisions-2026-09-28-one-button-round2.md` (coordination
directory; its §4 blocks win over its §1 rows, its last block over all). A superseded row keeps
its text and names its successor.

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
| R2-Q1.3 | Architecture on an existing project | delegated; review amendment 10; **dropped in r4 (R4-7)** | **Dropped:** no lane turns «intended» into a rule, so the question had no effect (R4-7). The r3 text: one question, «is this structure intended?», asked only on lanes with a boundary check (dependency-cruiser on npm lanes, `setup.d/40-configs.sh:449`); on python a candidate for the first `dep-graph` node (prior-art-evaluations.md#214). | See R4-7. |
| R2-Q1.4 | Keeping it current («постоянно обновлять, записывать и вести?») | delegated | Mostly dissolves. Checks fail loudly, renders regenerate, and intent lines change only when the human changes direction, through the re-ask step. | Intent lines are found stale in a real project → add an upkeep check. |
| R2-Q1.5 | Stack confirmation (amends round-1 Q2) | delegated | Asked only when detection is ambiguous (§4.2 item 1). «очевидные из стека вещи точно не нужно спрашивать у оператора». | A prober run detects a single-manifest project as the wrong lane → always ask. |
| R2-P1 | Where the intent lives | answered (§4 accepted after OP-15); source moved by review amendment 1 | **Source: `.getff/intent.md`**, a getff-owned file. The DESCRIPTION.md intent fence and the AGENTS.md fence are both renders of it. Why moved: a `getff:begin` fence is a render by the contract, so a source inside one contradicts the layering. The intent still reaches the agents; only the source location changed. | A consumer's agent can change a must-never without the intent gate firing (review falsifier for amendment 1). |
| R2-P2 | Does rule research read the intent? | answered; REQUIRED | Yes: must-never lines become rule candidates. Without a getff reader, the passport is a file nobody reads (getff stopped installing AIF on 2026-07-10). | In the acceptance run, a must-never line that a check could express yields no rule candidate. |
| R2-P3 | An old-format passport | answered; amended by OP-16, kept after OP-17, refined by review amendment 3 | Never overwritten. Human-written lines stay byte-identical; getff's own unfilled placeholder sections are replaced; getff's fence uses its own headings; one FYI line. | The appended fence breaks an existing reader (an AIF skill) → write the fence to a sibling file and point to it. |
| R2-P4 | Intent size | answered | A content rule instead of «≤5 lines» (§4.3). | Real projects end up with long intent sections that agents demonstrably ignore → add a soft size warning. |
| R2-Stack | The stack in the passport | author (review amendment 2) | **No generated stack block.** DESCRIPTION.md gets one pointer line to the lane's manifest: the operator's own «стек не нужно дублировать, ссылки достаточно». The earlier claim «the Stack block keeps readAif working» is withdrawn, because readAif misreads python and Vite React (§3). | An AIF skill demonstrably fails on a DESCRIPTION.md without a stack block → render a stack line from the manifest. |
| R2-Arch | ARCHITECTURE.md | author (probe-driven) | **No getff-only truth there** (§4.3). The truth is the check config plus the AGENTS.md table. The probe (AIF 2.11.0, 2 runs per command) found `/aif-architecture` replaced the whole file both times; it also inserts `## Architecture` into DESCRIPTION.md. `/aif` kept the AGENTS.md fence byte-identical both times (a weak result: the sub-agents inherited getff context). | Any getff check or reader is found consuming ARCHITECTURE.md content. |
| R2-Guard | Skill-context guards for `aif` / `aif-architecture` | author (review amendment 4) | **Dropped.** AIF's `/aif-evolve` owns `.ai-factory/skill-context/` as «the ONLY correct target» for its evolved rules. getff's `copy_safe` would skip an evolved file, and `--refresh` would wipe it. Protection is structural: getff reads nothing AIF writes, and the renders self-heal. The already-shipped `aif-review` / `aif-rules-check` overrides carry the same collision (`setup.d/20-agents.sh:77`, `install.sh:1400`); that is out of this spec and was flagged separately. | An uncontaminated live run shows `/aif` rewriting inside a getff fence → add a check that compares the fence with its source. |
| R2-Import | The `@AGENTS.md` import | answered for the import: «Конечно!» (OP-15); author for creating CLAUDE.md when absent (review amendment 5) | **Always ensured** in the project-root CLAUDE.md, created with one getff block when absent (§4.3). The widening: both of the operator's CLIs are below 2.1.277, and `.claude/CLAUDE.md`, `CLAUDE.local.md` or a parent CLAUDE.md also stop AGENTS.md. | A created root `CLAUDE.md` changes another harness's behaviour in a way a consumer reports. |
| R2-Upkeep | Upkeep without friction | author (review amendment 6) | §4.3 «Upkeep». | A switched-off section is re-added by self-heal, or a render fails a push. |
| R2-Venv | The python venv | author (review amendment 8); **DISSOLVED in r4 by P14** | Python is an alpha lane, out of this program (P14). The r3 text: the agent creates the venv under start-round consent, and the acceptance adds a no-venv python scaffold. | The python lane leaves alpha → reopen in that lane's contract work. |
| R2-Steps | The shipped first steps | author (review amendment 9) | `fill-passport` becomes the agent step «confirm the guess card» in every sequence. The whole «Next steps» block goes (`99-finalize.sh:627-662`). `AGENTS.md.template:9` is amended. Stage 80 re-renders the rule → check table after the lock. | A sequence still carries a human passport step after the slice lands. |
| R2-Echo | The installer's «Review/edit» echo | answered (§4) | Replaced by the banner rendered from the step list (§4.1). The peer chip «Automate the manual steps getff's install still prints» (f35edf) has an FYI about the overlap. | A shipped install still prints a line asking the human to edit a file or run a command the chain runs. |
| R2-OP18 | Rule research: a question, or by default | answered: «да, поиск по умолчанию, не спрашивать» (OP-18) | **Runs by default and is never asked**; the research question leaves the start round. The opt-out (`INSTALL-FOR-AI.md:592`: research is skipped «only on an explicit operator opt-out») keeps existing, in the shape «a documented sentence the agent reads»: the start banner's FYI line names «skip research». An env var is the non-interactive twin for `-y` runs; its name is decided at landing. The landing updates `INSTALL-FOR-AI.md:592-599`, the research step's `when` (a chain-record predicate, R4-3), and `80-rule-bootstrap.sh`, whose skipped-research path ends green (`:17-18`), so a skip must still be reported as a skip. | The acceptance run or real users show research taking so long or costing so much that installs are abandoned → restore the question, or give research a visible time budget. |
| R2-Q2 | What «green project» means | answered (zero-rule branch: «Готово, с объяснением»); the rest on recommendation | §4.4. Since P13, green is one condition of the complete install (R4-1). | On real projects research almost always yields zero → «green with zero» hides a chain that produces nothing; zero becomes failure. |
| R2-Q3 | Acceptance | answered: «A + доработки (Recommended)»; widened by review amendments 7, 8, 11 | §4.6. Its python scaffolds left in r4 (P14). | The operator finds a quoted question unclear, or the stand-in hides a problem a live human would hit → add one manual run. |
| R2-Q4 | Closure | on recommendation | §4.6. This is the 2nd incident of the class (`getff-any-stack-trace/done.md:22`, `getff-freshness-widening/done.md:17`). A 3rd triggers a general `done.md` check (`attention-is-not-a-mechanism.md` §3). | A 3rd parked-as-done program appears before the general check exists. |
| R2-Q5 | Presets vs the generator | on recommendation; rule presets re-opened by P15 (R6-3) | Out of this spec. The generator makes rules only; tool-config templates are the round-1 «level-2 tooling». A broken template line is a stream-1 bug fix. | A shipped template breaks the green check on the acceptance scaffolds and stream 1 has not fixed it. |
| R2-Q6 | How the chain calls the generator | on recommendation | One command on every npm lane: `./setup --full <stack>`, repeated with the chain record's flags (§4.1). A python render inside setup is alpha-lane work (P14), which also leaves the F-A «Node-free» question untouched. | Step 6's second setup run is slow enough that humans abandon the chain → step 6 calls the generator bundle directly. |
| R2-Q7 | Docs, passport, architecture and site as one process | answered (direction; the design went to the truth-pipeline contract) | Every fact has one structured source; everything else is rendered from it or is AI prose citing only sources and code. The chain's source is `first-steps.source.json`, extended. The operator: «Давай попробуем все это вместе интегрировать, по сути это один процесс». | `first-steps.source.json` cannot express the chain (F1), or a cold agent still misses `/rule-research` after integration (F3). |

### Round 3 (author decisions; the frontier diff found no operator fork)

Of the planned round-3 items, three were settled in the truth-pipeline register: the rendered step
list (T1, T1.1, T1.2, R2, R7), the chain-order arm (T1.4, R7) and the fence check (R2-Q2 part 2).
The rest, plus two round-2 review hand-backs (the detector order, the python ast-grep gap):

| # | Decision | Status | Resolution | Falsifier («wrong if …») |
|---|---|---|---|---|
| R3-1 | The «one-page truth card» (P5; contract §6.7 step 6) | author | **Not a new file.** The truth-pipeline rejects a second step source and a new product-claim file. P5's intent (one source, one pass over README / INSTALL-FOR-AI / the banner / the site) is exactly what the structured sources and their renders do. The contract's step 6 then means a render, not a source. | A cold agent needs a single page to answer «what does getff install and generate» (#1856 N10's predicate) and no render gives it → add a rendered one-pager: a render, never a source. |
| R3-2 | `agents/aif-init.md` | author | **Rewritten, not retired**, as the guess drafter. Round 2 handed it back as «`aif-init`'s role shrinks to the guess-first questions». It reads the repo evidence (manifests and layout) and returns the three guesses, each with its source or empty, and writes nothing. The main session shows the card, because AskUserQuestion is unavailable in subagents. It runs from the clone by path, as a general subagent whose `tools:` line does not bind it, so «writes nothing» holds by instruction; only the intent writer writes intent. Its DRAFT-file behaviour goes (R2-Q1). The rewrite keeps the roster and counts, but not the liveness entry: slice 2 rewrites `tests/fixtures/shipped-agent-liveness/aif-init.md`, the prober row (`agents/shipped-agent-liveness-prober.md:59`) and the role descriptions (`agents/aif-init.md:3`, `docs/site/reference/C.json:19`, `README.md:23`, `AGENTS.md.template:99`). `packages/core/detector/passport.ts` (no production caller) is left as is. | The main session drafts better guesses without the subagent (acceptance transcripts) → fold the drafting into the step text and retire the agent. |
| R3-3 | Who writes the intent, and when | author | **The agent runs the intent writer right after the card, before install** (§4.3). Setup renders every fence on install and refresh. The agent never writes a getff fence or DESCRIPTION.md itself. | The acceptance run shows the agent writing `.getff/intent.md` by hand → no chain record exists, step 2 reads not done, and the prompt list names the writer call explicitly. |
| R3-4 | The non-npm lanes, and the python ast-grep gap (review hand-back) | author; **DISSOLVED in r4 by P14** | Replaced by the lane contract (R4-2, §4.5). The r3 python route (ast-grep as a project dev dependency, then `uvx`, then `npx`) leaves this program; its stated reason was also false, since shipped python CI already installs ast-grep (§3). | The python lane leaves alpha → decide its tool route in that lane's contract work. |
| R3-5 | Detector order (round-2 §3 item 4, re-opened by review amendment 2) | author | **Manifest first on every detector path.** `detector/index.ts:31-33` is reordered, and `readAif` runs only when no manifest exists; it also stops reading AIF-written files and stops throwing (§4.3). The chain's own path already skips it (`resolve-ctx.ts:59`). Slice 2 updates the tests and comment this reverses (`read-aif.test.ts:13-21`, `snapshot.test.ts:10`, `detector/index.ts:2-8`; slice 2 names the rest) without deleting the fixture's `package.json`. | A fixture carrying getff's own DESCRIPTION.md next to `pyproject.toml` does not read as `python`, or a Vite React fixture reads as `react-next`, after the change. |
| R3-6 | Is the start round really one or two calls? | author | Yes: §4.2 «Carrier». | Acceptance transcripts show a third call, or a question outside §4.2. |
| R3-7 | Skills installed mid-session | author | Every agent step's `run` is a path in the getff clone, read by path, never a slash command (the round-1 Q1 reason). This covers `rule-research`, `tool-bootstrapping`, the start round and `aif-init`. | The acceptance run shows the agent misreading or skipping a skill read by path → the step adds `/reload-skills` and invokes the skill. |
| R3-8 | The final check's entry point (truth-pipeline §6.2 delegates the name here) | author | `scripts/getff-check.sh`: pure bash, getff-owned, delivered on npm lanes and refreshed on `--refresh`; run from the clone on alpha lanes (§4.4). Its first not-done step is the banner's «next» line. | The name collides with a consumer script, or pure bash cannot run a lane's check → keep the name, dispatch per lane inside it. |
| R3-9 | Zero-rule counts and research yield (contract N-t names this spec as the owner) | author | The generator writes a yield sidecar next to the lane's lock: researched / expressible / blocked, with reasons, plus the research hash (R4-3). The lock schema is unchanged (`packages/core/installer/types.ts:46-55`). Yield bottlenecks are out of scope and go to the rule-research owner: cross-host doc redirects and github-hosted docs failing the allowlist, python Tier-1 needing a venv, and duplicates of TypeScript checks. | The acceptance run yields zero proven rules on a stack → the yield fixes become a precondition of closure (§4.6 needs ≥1). |
| R3-10 | Boundary with the truth-pipeline contract | author | §6. | A landed sentence in either spec restates the other's decision → cut it to a pointer. |
| R3-11 | Where the intent confirmation lives | author; **superseded in r4 by R4-4** | No confirmation record. The r3 sidecar `.getff/intent.confirmed` is dropped, because its own writer could re-hash a laundered edit (review M6); the intent gate reads git history instead. (One r3 reason, «rust and go have no lock», was false: `setup.d/46-cargo.sh:24`, `47-go.sh:19`.) | See R4-4. |
| R3-12 | The research protocol's own human checks: the bulk Y/n before writing (`agents/rule-researcher.md:146`, «Never write without confirmation») and the Tier-2 source ack (`:142`). OP-18 covered only «research or not». Escalated by the §2 top-down seat (E2). | answered: «при выборе полной установки с согласием на все - без вопроса» | **When the start-round answer is the complete install with consent to everything, research writes without the bulk Y/n.** The report lists every new rule with its source and a one-command removal. A source that needs a Tier-2 ack is not used; the yield sidecar counts it as blocked by provenance, and the report gives the command to add it later. When the human did not give that blanket consent, the bulk Y/n stays. The guard that matters, «an unacked source never becomes a rule», is unchanged; only where the human sees the rule list moves. | After blanket-consent runs, humans remove a large share of the generated rules as unwanted → restore the bulk Y/n for every run. |

### Round 4 (author decisions forced by the §2 cold review, round 1, and by P13-P14)

R4-1 and R4-2 carry the operator's P13 and P14; the rest are author calls, each naming its finding.

| # | Decision | Status | Resolution | Falsifier («wrong if …») |
|---|---|---|---|---|
| R4-1 | The target state | answered (P13); how «not built» counts is fixed by R5-3 | **Complete install** (§4.4): every part in place and proven, or recorded as declined or not built on the lane. Green is its part 5. | After a «complete» report, humans still hand-install a tool or hand-edit a file the button should have produced → the parts list misses a part. |
| R4-2 | Stack scope and the lane contract | answered (P14); the contract items are author | One stack-agnostic chain plus the lane contract (§4.5). The npm lanes are built first and are this program's only acceptance target; python, cargo and go stay alpha and report «not built». | A second npm stack, or the stub lane, needs a change outside its lane → the contract lacks an item. |
| R4-3 | Chain state a pure-bash check can read (review: top-down M1, M2, M10; bottom-up MAJOR-1, MAJOR-2, m8) | author; its stamp writer is a blocking request to the contract (§6) | The chain record (§4.1): one chain stamp from the start round, the sequence id, the consent answers and the baseline. Step 3 is proven by setup's result record, step 4 by the installed tools, step 6 by the research hash in the yield sidecar. For this sequence the stamp is not the installer's (contract T1.5, §6). | A check verdict in the acceptance run depends on something the record does not hold → add it to the record. |
| R4-4 | Guarding the intent (top-down M6) | author; honest limit added by R5-4 | The intent gate (§4.3): removing or rewording a must-never or hard-constraint line needs an `Intent-change:` trailer with a ≥20-char reason. It replaces R3-11's hash record, which its own writer could re-hash. | Agents add the trailer with no human answer to get past the gate → a Claude Code PreToolUse hook ties the trailer to a human answer in the transcript. |
| R4-5 | Wiring proof (top-down M11) | author | Through the project's real config, with nothing written into the project (§4.4, §4.5). This keeps the binding temp-dir STOP line (`setup.d/45-python.sh:482-483`, `agents/rule-researcher.md:238-245`) instead of weakening it silently (P9). | In-memory linting disagrees with on-disk linting for some rule class → put the trade-off against the STOP line to the operator; never relax it silently. |
| R4-6 | What counts as purpose evidence (top-down M7, m20) | author | Project-specific text only (§4.2). Stack-only or tooling-only text and the lane's scaffold placeholders are not evidence; guesses are in the drafter's words; instruction-shaped source text is never a guess. | A fresh scaffold in acceptance gets a placeholder as purpose → the lane's placeholder list is incomplete; or real projects get empty cards where a human sees an obvious purpose → accept any README prose that is not a placeholder. |
| R4-7 | The structure question (top-down M9) | author; reverses the delegated R2-Q1.3 | Dropped. No lane can turn «intended» into a rule (the npm boundary check is a generic template, `setup.d/40-configs.sh:449`), and a touchpoint with no effect breaks P8. It returns on a lane that gains boundary derivation (§4.5 item 9). | Users report boundaries getff missed that they would have confirmed → build boundary derivation on the npm lane. |
| R4-8 | Framework reads in the research step (top-down M4) | author | The allowlist is rendered into the research step's reference; today the step reads `packages/core/research/allowlist.ts` (`agents/rule-researcher.md:138`). The step then reads no `packages/**` file, and the acceptance criterion stays. | The render drifts from `allowlist.ts` in a way no drift check catches → read the source and exempt that one file from the criterion, openly. |
| R4-9 | Existing projects (top-down m16) | author; compared by failure since R5-5 | A baseline at the start round (§4.2); green counts only what the install broke, and a generated rule firing on older code is a finding (§4.4). | Real existing projects report «not complete» for failures getff did not cause → the baseline misses a failure class. |
| R4-10 | MCP servers installed mid-chain (top-down m1) | author; known limit; premise re-opened by R5-15 | New MCP servers are not live until a new session, so step 5 in the button session uses its web fallback (`agents/rule-researcher.md:105-108`), and the report says so. | Research on the fallback yields clearly fewer rules than with the MCP servers → run step 5 in a headless child session started after step 4. |
| R4-11 | Blanket consent (the carrier of R3-12) | author; scope answered by R5-8 | A yes to every install question with no research opt-out; a bare go-ahead gives it, and the chain record holds it (§4.2). | Humans who gave a bare go-ahead are surprised that research wrote rules without asking → make blanket consent an explicit option. |
| R4-12 | Render delivery (bottom-up MAJOR-3, m5) | author; keep-copies closed by R5-13 | One render function on install and `--refresh`; the table in its own fence section; a new delivery mode for DESCRIPTION.md and ARCHITECTURE.md (§4.3). | A re-run still leaves `refresh-conflicts` keep-copies of AGENTS.md, or a plain `./setup` drops the table → the render function is not the only writer. |
| R4-13 | Where the wiring path comes from (bottom-up MAJOR-7) | author; its fallback replaced by R5-14 | The research record gains each practice's path in the project, filled by research from the project tree, never from the generated glob. It lands with the research rewrite (slice 4), before the wiring proof (slice 3) is proven. | Research on a fresh scaffold cannot name a path for most practices → the wiring proof uses the lane's default source path, and the report marks those rules «wired at the default path». |

### Round 5 (author decisions forced by the §2 cold review, round 2, and two operator forks)

The operator answered R5-1 and R5-8 on 2026-09-28; R6-2 supersedes R5-9.

| # | Decision | Status | Resolution | Falsifier («wrong if …») |
|---|---|---|---|---|
| R5-1 | A project with no repository (top-down B1, bottom-up MAJOR-2) | answered: A, the author's call (P8) | **The intent writer runs `git init`, with no commit,** when `git rev-parse` finds no repository, and says so in one FYI line with its revert (`rm -rf .git` while it holds no commit). A directory inside a parent repository has one. Without a repository the hook arm only prints a command for the human (`setup.d/50-hooks.sh:81`), shields-up checks nothing (`99-finalize.sh:532`), and the intent gate cannot arm. Whether a scaffold makes a repository does not matter to the design. | Humans report a repository they did not want → a narrow start-round question on no-repository projects only. |
| R5-2 | A gate with nothing to run (top-down B1) | author (P1) | A lane gate reports pass, fail, could not run, or nothing to run; «nothing to run» passes and the report says «no app tests; not getff's product (P1)». The npm lane asks the runner for its matched files (`vitest list --filesOnly`), never reads a failure message: the installed `test` script is `vitest run` (`setup.d/70-deps.sh:85`) and the shipped config's include patterns decide (`packages/preset-react-spa/templates/vitest.config.ts:30`). | A project whose real tests the runner misses is reported «nothing to run» → the runner's file list is not the truth for that runner. |
| R5-3 | Which part states count toward complete (top-down M1) | author | `done` and `skipped-by-consent` count; `not-applicable-on-lane` counts only for an optional lane item (item 9); a part whose required lane item is missing is `not-done`, «not built on this lane», and never counts (§1, §4.4, §4.5). | An alpha-lane install is ever reported complete → the mapping leaks. |
| R5-4 | The intent gate's honest limit (top-down M2) | author | The trailer is an audit trail, not proof of the human's words, as the contract says of `Goal-change:`. Two more channels: the shipped consumer CI runs the same arm, and every final check report lists the intent lines changed since the chain stamp with their trailers (§4.3). | Laundered trailers pass both channels unnoticed in a real run → a Claude Code PreToolUse hook ties the trailer to a human answer (R4-4's falsifier). |
| R5-5 | Baseline by failure, not by gate (top-down M3) | author | Each lane gate names its failures (item 2). On a gate red in the baseline, a failure the baseline did not hold counts; a gate that cannot name failures compares counts. The baseline mode writes `.getff/baseline.json`. Rejected: comparing gate results, which hides a new failure on an already-red gate. | getff adds failures on a baseline-red gate and the check says green → the lane's failure identity is too coarse. |
| R5-6 | The lane contract covers the whole install (top-down M5) | author | Items 10-12 join (§4.5): the install arm with its setup record entry, the hook arm, and the dependency reader behind tool proposals. | The stub lane still needs a change outside its lane → another item is missing. |
| R5-7 | Writers, files and stamp-free probes (top-down m2, m3, m5, N5; bottom-up m1, m7, N7) | author | One writer per file: the intent writer writes `.getff/intent.md` and `.getff/chain.json` (a late «skip research» through `--skip-research`) and runs the baseline; only the baseline mode writes `.getff/baseline.json`; only setup writes `.getff/setup.json`. `intent.md` is tracked, because the intent gate reads its history; the other three are machine-local and gitignored. The generator writes the yield sidecar before its research-only return (`packages/core/synthesizer/rule-bootstrap.ts:110-111`), so every sequence proves research and generation without stamps (§4.1). | A chain verdict needs a fact only another writer has → the record gains a field, not a writer. |
| R5-8 | Research consent scope (top-down M4, E2) | answered: A | Does a declined companion or tool withdraw blanket consent, and does a bare go-ahead give it? **A (recommended):** consent to research is its own answer: research writes unless the human said «skip research», and declines elsewhere do not touch it; the FYI line says a bare go-ahead lets research write, and the report lists every rule with a one-command removal. **B:** r4 as written: any decline brings the bulk Y/n back mid-chain, which stalls an unattended run. **C:** an explicit «complete install, consent to everything» option; every other answer keeps the Y/n. In every option an unacked Tier-2 source never becomes a rule. | (A) Humans remove many generated rules as unwanted → C. |
| R5-9 | Project-specific architecture (top-down E1; the operator's «мне кажется нужен и паспорт и архитектура проекта», `_decisions-2026-09-28-one-button-round2.md:42`) | operator-fork; **superseded by R6-2** (P15), the operator did not pick A or B | **A (recommended):** this program ships the generic boundary check and the ARCHITECTURE.md pointer, and the report says «no project-specific architecture rules yet»; boundary derivation (§4.5 item 9) is the next program, with its own prior-art consult. Fresh scaffolds, the acceptance target, have no import graph to derive from. **B:** build npm boundary derivation now, as a sixth complete-install part. | (A) Existing-project users report boundaries getff missed that a derivation would have caught → B opens the next program. |
| R5-10 | The setup record (top-down m7, N4; bottom-up m2) | author | `.getff/setup.json` holds one entry per setup run: profile, flags, time and the self-verify result. «Pass» means no failure and only accepted skips: zero rules is accepted, «not a git repository» is not (`99-finalize.sh:532`; skipped checks «are NOT proven», `:569`). Step 3 and step 6 each read their own entry. | A step reads pass while its setup run failed → the entry misses a failure class. |
| R5-11 | Rule 3 of `tool-bootstrapping` (bottom-up MAJOR-4) | author; an open amendment (P9) | Rule 3 («never install any MCP or skill without explicit user confirmation», `skills/tool-bootstrapping/SKILL.md:35`) is amended in slice 5: the recorded start-round answer is that confirmation, so the agent does not ask again. «No env/config bypass» still holds: only the human's answer fills the record. | The agent re-asks the tool Y/n after setup in acceptance → the amendment did not reach the step. |
| R5-12 | The logic proof (bottom-up MAJOR-3, mismatch 5) | author | **Reuse the generator's own proof.** Each rule carries a bad and a good example and a negative test (`packages/core/synthesizer/generate-port.ts:34`, `:39`), gated at generation; declarative rules are mutation-checked at install and at pre-push (`packages/core/audit-self/check-generated-rule-mutation.sh:2-5`, `99-finalize.sh:544`, `packages/core/hooks/pre-push.ts:1198`). Rejected: r4's firing triple, which the ORPHAN check flags (`install.sh:1266`, `setup.d/lib.sh:1285`). §3 is corrected: `check-fences-fire.sh` proves the installed fences, not generated rules (`:2`). | A generated rule class has no lasting test a consumer can run → a triple under an attributed path. |
| R5-13 | The table section and refresh (bottom-up MAJOR-1, m9, N1; top-down m8) | author | The table goes into a new generated-section mode with no keep-copy; today every change writes one (`setup.d/lib.sh:1083`, `:1137`). Its section id does not start with `getff-framework`, because the begin marker matches by prefix (`:1013`). Refresh's passport copies (`install.sh:1363`, `:1369-1370`) give way to the render function, and the «not touched» line (`:1415`) is reworded. | A re-run leaves a `refresh-conflicts/` keep-copy, or a plain `./setup` drops the table → the render function is not the only writer. |
| R5-14 | The npm wiring proof (top-down m11; bottom-up m5, N8) | author | `eslint --stdin --stdin-filename <path>` loads the project's config the way its `lint` script does (`setup.d/70-deps.sh:80`). Rejected as precedent: `check-fences-fire.sh`'s synthetic config (`:264-269`), which proves logic only; the CLI crash it avoids is a harness fact (`tests/install-sh/f17-lint-rules-planted-violation.test.sh:32-36`). Unknowns measured in slice 3: an ignored path reads «not wired»; typed rules need a path the project's tsconfig covers; `_oxlintrc.json`. A rule without a path is «wiring unproven», never passed. | Stdin linting disagrees with on-disk linting for some rule class → R4-5's falsifier: the trade-off goes to the operator. |
| R5-15 | MCP servers added mid-chain (bottom-up m6; top-down N6) | author; re-opens R4-10's premise | The vendor docs describe dynamic tool updates, against R4-10's «not live until a new session». Acceptance measures it, and the report says which held (§4.6). | Measured live → step 5 drops the web fallback in the button session; measured not live → R4-10 stands. |
| R5-16 | Closure and outside dependencies (top-down m9; bottom-up m8) | author | Acceptance may run once slices 1-6 land (6 since r6). The docs pass waits on the contract's §6.7 steps 3-4 and the site umbrella (P6); a run made before the pass goes stale per T7.1 and is repeated. «PARKED» does not close. | The site umbrella stalls for weeks → the operator is asked whether to close on a pre-pass run with the pass as a named follow-up. |

### Round 6 (premises P15-P17; measured by two cold seats on `8617beedccf`, spot-checked, §3)

| # | Decision | Status | Resolution | Falsifier («wrong if …») |
|---|---|---|---|---|
| R6-1 | What «the core» is (P15) | author: the operator's words define it | **The invariant core the repo designed** (§3): the principles and meta-rules no research may generate (every rule has an executable check and a firing test; no tautology; documents lie; rules come from researching the stack's live docs), plus the machinery that holds them: the research protocol, the generator's gates, the meta-gate scripts. Every other rule is generated for the project; rule presets stop shipping (R6-3). For this program it replaces the 2-stack test (`closed-questions.md:129`). The shipped list (R6-6) tags each shipped artefact `core` or `tool config`, and the report shows the tags. `packages/core/` and `--profile core` are unrelated uses of the word. | The operator names a core item the list lacks, or a `core` item proves stack-specific on the stub lane → the list is wrong. |
| R6-2 | Architecture rules under P15 (supersedes R5-9) | answered: B («да», model round Q2); the author moved to B once R6-3 = Б left A with no architecture rules at all | **B: the generator is extended in this program, as a sixth complete-install part.** Architecture rules are generated, never shipped as a layout preset: research on the stack's docs, the intent and, where code exists, the import graph yields boundary rules, on npm lanes rendered to dependency-cruiser (the backend SSOT #139 adopts), each with a two-file firing test; it plugs in as lane item 9. Generation cannot express cross-file boundaries today (`agents/rule-researcher.md:117`), so this is new generator work with its own prior-art consult. Rejected A: report «architecture: not generated yet» and extend the generator in the next program. | (B) On a fresh scaffold, research yields no boundary rule with a firing test → the report says «architecture: nothing to check yet» rather than inventing a layout. |
| R6-3 | Rule presets under P15 («поставляется только ядро») | answered: Б (the author recommended A) | **Б: rule presets stop shipping in this program;** the install ships the core and generated rules only. This covers every shipped rule that is not core (R6-1): the four custom ESLint rules (`setup.d/40-configs.sh:203`), the stack presets' rules, the layered dependency-cruiser rules and `integration-rules.md`. The presets stay in the repository as the generator's oracle (`2026-06-22-stage-2-generate-path-design.md:14`), never as shipped content. Tool configs (tsconfig, test runner, CI) are not rules and stay (R2-Q5). It supersedes the 2026-06-29 «demoted to fallback» ruling (`live-research-default-delivery/done.md:4`). Rejected A: keep shipping them, tagged `preset`, as a fallback. The author's risk note (P9): a project whose research yields zero rules now gets only the core, and the zero-rules report (§4.4) must say so. | (Б) Projects whose research yields zero rules are left without a check their users expected → bring back one preset class as a fallback, named in the report. |
| R6-4 | Skills and MCP servers as rule sources (P15) | author | They are where research FINDS practices and anti-patterns, with step 4's tools used in step 5; slice 4 makes the recursion line (`agents/rule-researcher.md:109`) a named protocol step. A rule still cites the canonical doc its practice comes from (`:111`), so an unacked source never becomes a rule. A maintainer-published skill as a trust tier is a question for the owner of `research-source-trust.md`, not this spec. | Acceptance shows many practices found only in an installed skill and blocked for want of a doc → propose maintainer-published skills as a trust tier. |
| R6-5 | «Search the docs for best practices» as a core rule (P15) | author | Its machine form is the chain: research runs by default (R2-OP18). After install, the shipped dependency hook also names rule research when dependencies change; today it names only `/tool-bootstrapping` and `/rule-tests` (`.claude/hooks/deps-hash-check.sh:533`, `:540`). Slice 4. | Consumers change dependencies and research never re-runs → the final check reports research older than the dependency hash. |
| R6-6 | How far P16 reaches in this program | **operator-fork**, in discussion: both ways (P16); at the model round the operator named two layers, which reopens R6-1: «правила для ии тесты хуки все долны поставлятся - у нас в проекте есть два слоя есть ядро которое не поставляется - например тесты принипов, и из него выходит рекурсивно то что уже поставляется», and asked whether the 600-line cap helps consumers too | **A (recommended):** (1) the parts this program adds run on getff too: the intent gate's pre-push section is owned `both` (principle 32), and getff's passport comes through truth-pipeline T13 step 4 (P12); (2) **the shipped list**: one row per shipped artefact class, tagged `core` or `tool config` (R6-1, R6-3) and `applied on getff` (naming how) or `exempt` (a reason of 20 characters or more and a reopen trigger), in both directions, so framework-only machinery is listed too; a principle test fails when a path in the install fingerprints (`tests/install-sh/baselines/`) matches no row; (3) today's gaps (§3) enter it as dated exemptions, and the next program closes them from that list. **B:** close every gap in this program, before closure. | (A) The exemptions grow across two releases instead of shrinking → closing them becomes a precondition of promote. |
| R6-7 | Which docs «all the docs further development needs» are (P11, P17) | answered: agreed («согласен», model round Q3) | **Only what agents measurably use:** the passport (the human's intent), the AGENTS.md rule → check table, and an architecture description rendered from the same architecture rules (R6-2). No overview documents, per R2-Q1's evidence. | An acceptance run shows the agent missing a fact none of the three carries → that fact joins the passport, not a new overview file. |

## 6. Boundary with the truth-pipeline contract

- **This spec owns** the step file's CONTENT and the one-button sequence (§4.1), the chain and
  setup records, the start round, the passport content and renders, the complete-install and green
  predicates, the lane contract, the final check's name, the yield sidecar, acceptance and closure.
- **The contract owns** the step schema and its gates (T1-T1.5), the one-source rules R1-R10 (R7's
  chain-telling surfaces gain this chain's), the site request rows, and goal governance (§6.8, R9).
- **Where they meet:** the passport lands with the chain (contract §6.5, §6.7 step 2); the contract
  adds only the gating of its renders (§6.7 step 7). The banner render (§6.2) is §4.1's banner. The
  truth card (§6.7 step 6) is a render per R3-1.
- **Requests to the contract owner** (this spec does not edit the draft):
  - **Blocking before slice 3:** T1.5 has the installer write the run stamp; in the one-button
    sequence the stamp is the chain record's, and setup writes none (R4-3).
  - §6.2's terminal `doneWhen` becomes the complete-install predicate, with R5-3's state mapping.
  - §6.5 builds the consumer mirror from «stack, rule lock, gate list», against R2-Stack.
  - R3's CI-only list gains the DESCRIPTION.md and ARCHITECTURE.md renders, with their reason.
  - T1.1 is «OPEN» in one place of the draft and «answered» in another.
  - The site takes the one-button sequence through request row 5. Until then slice 1 filters it out
    of `scripts/render-face-facts.mjs`, which copies every sequence (`:169`, `:174`). Asking the
    site seat needs the operator's yes (P6).

## 7. Testing seams

- **One seam carries most of it: the final check** (`scripts/getff-check.sh`). Every `doneWhen`,
  the complete-install predicate and green run through it. Its fixtures, all pure bash:
  - each part as done, declined, not built on the lane and not done; a late research opt-out;
  - the stub lane (§4.5), which must reach «complete» with no stack named in the chain;
  - chain-record cases: absent (the profile's depth sequence is walked), a second setup run that
    must not prove step 5, a failed step-6 setup run read as step 6's;
  - step 6 with unchanged lock bytes and a new research hash; a gate with nothing to run; a
    baseline-red gate with an old failure (uncounted) and a new one (counted);
  - a wired glob that misses its target (the N14 regression) and a good example that fires.
- **Passport fixtures:** the intent gate with and without the trailer (in `packages/core/hooks/`,
  `pre-push.test.ts` and `pre-push.consumer-layout.test.ts`); readAif on python and Vite React
  fixtures, never throwing; `merge_fenced` with no node; import idempotency; a deleted CLAUDE.md
  not recreated; P3 placeholders; no `refresh-conflicts/` after step 6 or `--refresh`
  (`tests/install-sh/refresh-covers-full-delivery.test.sh`, `refresh-divergence-guard.test.sh`).
- **Existing seams, reused:** `packages/core/audit-self/first-steps-parity.test.ts` (widened in
  slice 1) and the render `--check`s (contract §7); the `framework-fresh-install-validate` cells
  (`.github/workflows/audit-self.yml:1490`, #1860) plus a variant with no repository and no app
  tests (R5-1, R5-2); `check-fences-fire.sh`, `check-generated-rule-mutation.sh`,
  `tests/fixtures/shipped-agent-liveness/aif-init.md`, `scripts/host-verify.sh` and the
  `tests/install-sh/snapshot.sh` baselines. The python seams stay as they are. The shipped list's
  principle test reads those baselines' fingerprints (R6-6).
- **The one non-mechanical seam is the acceptance run** (§4.6), with the SDK stand-in for the human.

## 8. Rejected alternatives

Each lives in its row: Q1 (the chain in the prompt; the plugin command as owner), Q2.1 (a breaking
`-y` backstop, reversing S1-4), Q3 (level-2 tooling), R2-Q1, R2-Q1.1, R2-P1, R2-Stack, R2-Arch,
R2-Guard, R2-OP18, R3-1, R3-2, R4-3, R4-4, R4-5, R4-7, R5-5, R5-12, R5-14. «Green» as the goal fell
to P13; per-stack chains, python acceptance and its tool route fell to P14.

## 9. Implementation slices (for writing-plans, after approval)

1. **Step file and start round.** The one-button sequence per contract T1.1 under a new sequence
   key; the parity test's rules (`first-steps-parity.test.ts:50` admits no hyphen; `:86` key
   equality; `:107` treats `evidence` as a string) and the face-facts filter (§6). The prompt
   render (no «Stop here»), the banner render, the pointers from README, the plugin command and
   `skills/getff`; the start-round `run` file with lane recognition, the Q2.1 relay, and the
   research opt-out (`INSTALL-FOR-AI.md:592-599`).
2. **Passport.** The intent writer (`git init`, the late opt-out, the baseline call), the chain
   record, the intent gate and its CI mirror; one render function on install and `--refresh`, the
   delivery and generated-section modes, a per-section opt-out marker (new; the only escape today
   is the whole-file override, `setup.d/lib.sh:1012`), the `@AGENTS.md` import and CLAUDE.md; readAif
   and the detector order (R3-5) with `read-aif.test.ts:13-92`, `snapshot.test.ts:10-16`,
   `detector/index.ts:2-8` and a regenerated `packages/core/install/rule-bootstrap-cli.bundle.mjs`;
   the `aif-init` rewrite with its liveness fixture, prober row and four descriptions (R3-2).
3. **Final check.** `scripts/getff-check.sh`, lane items 1-12 as an interface, the stub lane, the
   baseline mode with failure identity, the setup record, the banner, the sidecar's research hash,
   a hook check part replacing the `50-hooks.sh:81` instruction, and the npm lanes' gates and
   logic proof. The npm wiring proof lands after slice 4's path field.
4. **Research in the chain.** It reads the intent (R2-P2); the protocol's human checks rewritten
   for blanket consent (`agents/rule-researcher.md:142-150`, R3-12, R5-8); the allowlist render
   (R4-8); the path field (R4-13); the blocked-by-provenance count in the research files; the
   recursion step (R6-4); the dependency hook names research (R6-5); boundary rules (R6-2).
5. **Tools step.** The Q3.1 and Q3.2 scan, the installed-tool check, the Rule 3 amendment (R5-11).
6. **Core and self-application.** Rule presets stop shipping (R6-3); the shipped list with its tags
   and exemptions, its principle test, the intent-gate section owned `both` (R6-1, R6-6).
7. **Acceptance run and report**, after slices 1-6 (R5-16); then `done.md`.

Slices 2-6 run in parallel once slice 1's schema lands; only slice 3's wiring proof waits for
slice 4. Prior-art consults (CLAUDE.md build-vs-reuse gate) are owed for the step file (contract
N-p), the intent gate, the final check, the chain record, the yield sidecar, the generated-section
mode and the shipped list.

## 10. Changelog

Revisions r1-r6 with their commits, and every per-finding disposition: the
[review log](2026-09-28-one-button-chain-review-log.md). **r6:** P15-P17 recorded; rows R6-1…R6-7.
