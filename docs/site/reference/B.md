---
title: Skills
description: Every skill getff can put in your project, what each one is for, and how to tell which ones you have.
kind: family-overview
generator: scripts/render-reference.mjs
sources:
  - CLAUDE.md
  - docs/meta-factory/EXECUTION-PLAN.md
  - docs/meta-factory/prior-art-evaluations.md
  - docs/site/guides/add-design-and-review-skills.md
  - docs/site/reference/B.json
  - docs/site/reference/B/ai-doc.md
  - docs/site/reference/B/aif-doctor.md
  - docs/site/reference/B/arch.md
  - docs/site/reference/B/claude-glm-executor-handoff.md
  - docs/site/reference/B/dispatcher.md
  - docs/site/reference/B/docs-author.md
  - docs/site/reference/B/getff.md
  - docs/site/reference/B/harvest.md
  - docs/site/reference/B/night-mode.md
  - docs/site/reference/B/orchestrator.md
  - docs/site/reference/B/pipeline.md
  - docs/site/reference/B/reviewer.md
  - docs/site/reference/B/rule-research.md
  - docs/site/reference/B/rule-tests.md
  - docs/site/reference/B/self-reflection.md
  - docs/site/reference/B/story.md
  - docs/site/reference/B/template-audit.md
  - docs/site/reference/B/tool-bootstrapping.md
  - docs/site/terms.md
  - install.sh
  - packages/core/principles/21-agnosticism-conformance.test.ts
  - setup.d/lib.sh
  - setup.d/10-skills.sh
  - skills/getff/SKILL.md
docs-refresh: deferred — re-verified 2026-09-22, the cited register gained rows 284-287 and a dated note on row 283, and CLAUDE.md gained one skill-routing line for domain-modeling; counts are renderer-owned and no prose here depends on either; clears at the next gold refresh of this page
---

# Skills

A [skill](../terms.md#skill) is how getff talks to your AI agent. Rules and gates stop
bad code. Skills come earlier: they tell the agent how to do a job well before any gate
has to fire. This page lists every skill, so you can find the one you need or check
what an install gave you.

## Common cases

The table below is built by a script from the skill files themselves. Nobody types it.

<!-- vale off -->
<!-- vale-reason: the table quotes each skill's own frontmatter verbatim, including old names and Russian wake phrases -->

<!-- getff:begin section=B-table plan=scripts/render-reference.mjs -->
| Skill | Tier | Invocation | What it is | Ships-to |
|---|---|---|---|---|
| `ai-doc` | core | auto | Use when creating or fixing an AI-facing doc/rule/skill/agent in this repo (SKILL.md, .claude/rules/*, agents/*, CLAUDE.md, AGENTS.md) — to apply the project's context-hygiene + rule-as-test + AI-agnostic authoring standard. Triggers: write a rule, author a skill, fix a doc, doc-authority header, progressive disclosure, channel selection, документация, правило, скилл. | core: react-native, react-next, react-spa, ts-server |
| `aif-doctor` | factory | slash-only | Use when the aif-handoff runtime is misbehaving — a task is stuck or crash-looping, new tasks stay backlog at capacity, the claude runtime is broken. Triggers: aif-doctor, aif health, task stuck, задача висит, runtime broken, рантайм сломан, aif не отвечает, capacity skipping, native binary not installed, why won't my task start. Invokable when the dispatcher is NOT running. NOT for running the dispatch loop (/dispatcher) or planning (/pipeline). | not installed on any lane (no-lane) |
| `arch` | env | slash-only | Use when starting the EXTERNAL design contour — turning a raw idea or prep-doc into a reviewed design and a routed handoff. Triggers: /arch, external contour, внешний контур, спроектируй идею, задумка в архитектуру, design contour, arch loop, продумай и спроектируй, идея → kickoff, research contour, research-spec, distillate, исследовательский контур. NOT for reviewing code (/reviewer), dispatching stages (/pipeline), factory runtime questions (aif-doctor), or a bare brainstorm with no handoff (superpowers:brainstorming). | env: react-native, react-next, react-spa, ts-server |
| `claude-glm-executor-handoff` | factory | auto | Use when an in-aif Claude coordinator is about to dispatch an executable task to a GLM-5.3 worker (any agent whose frontmatter carries `model: glm-5.3` or a GLM-family model). Triggers: writing a dispatch prompt for a GLM worker inside aif-handoff, GLM executor, implement-worker GLM, cross-model dispatch within aif, planning a handoff to GLM-5.3, parsing a GLM worker's REPORT. NOT for Claude→Claude worker dispatch (use SDD directly). | not installed on any lane (no-lane) |
| `dispatcher` | factory | slash-only | Use when you need to EXECUTE a chosen umbrella's stages through the aif-control loop. Triggers: dispatcher, execute umbrella, run stages, aif loop, harvest PR, stage gate advance. Invocation channel: explicit /dispatcher only — disable-model-invocation:true is a channel flag and not a permission (§0). NOT for planning — priority and launch-table are /pipeline. | not installed on any lane (no-lane) |
| `docs-author` | framework | auto | Use when writing or editing any getff.ai docs page under docs/site/ (including the glossary terms.md), when picking a page kind or filling the reader-comfort card, or when running a docs refresh over touched pages — to apply the kind registry, the craft contract, and the docs-check done-checklist. Triggers: write a docs page, new page under docs/site, glossary entry, terms.md, docs refresh, gold page, Diátaxis, задокументировать, страница документации. | not installed on any lane (no-lane) |
| `getff` | core | auto | Use when treating any codebase rule (architectural, naming, dependency, test-quality, contract, SLO) as an executable test that fails the build when violated, or when the user asks about enforcing code quality, fighting AI-generated code drift, setting up linters/tests/CI/pre-commit hooks, designing review processes, mutation testing, contract testing, fitness functions, observability-driven development, SLO-as-code, or any version of "how do I make my codebase resistant to AI agents breaking my conventions". Also trigger on any mention of ArchUnit, Stryker, Pact, dependency-cruiser, AI Factory (aif), Husky, lint-staged, ESLint flat config, Zod validation strategy, or shift-left/shift-right testing. Strongly trigger when the user mentions Claude Code, Cursor, or Copilot writing code that "looks fine but is wrong" — that is the core problem this skill addresses. | core: python, react-native, react-next, react-spa, ts-server |
| `harvest` | factory | slash-only | Use when harvesting a finished aif-agent branch into a PR after acceptance. Triggers: harvest, harvest aif branch, egress aif task, push harvested work, post-acceptance harvest. Invocation channel: explicit /harvest only — disable-model-invocation:true is a channel flag and not a permission (§0). | not installed on any lane (no-lane) |
| `night-mode` | env | auto | Use when running a task FULLY AUTONOMOUSLY (overnight / unattended) as an orchestrator. Trigger on «работай всю ночь автономно», «оставляю на ночь», «прогони сам до готовности», «автономный режим», night mode, overnight autonomous, run to completion unattended. NOT for a single delegated edit (/orchestrator) or a one-shot review (/reviewer). | env: react-native, react-next, react-spa, ts-server |
| `orchestrator` | env | auto | | | env: react-native, react-next, react-spa, ts-server |
| `pipeline` | env | slash-only | Use when you have ≥2 in-flight wave umbrellas with cross-stage dependencies, suspect drift between wave-sequencing-plan.md and live git reality, or need to dispatch the next wave with verified Stage N→N+1 gates. Triggers: pipeline, wave orchestrator, wave plan, stage-gate, umbrella priority, waves parallel/sequential, wave-sequencing-plan drift. Invocation channel: explicit /pipeline only — disable-model-invocation:true is a channel flag and not a permission (§0). | env: react-native, react-next, react-spa, ts-server |
| `reviewer` | env | auto | Use when the operator or an orchestrator asks for an interactive review with a verdict — «проверь», «ревью», «вердикт», «это правильно?», «оцени результат», «phase N закрыт», review, second opinion, independent review, verify deliverable, "is this correct?" — and the deliverable is a GO/REVISE/STOP verdict or a verified answer, not code. NOT for implementing fixes or writing tests (orchestrator work), and NOT for the cold PR-boundary protocols (agents/fidelity-auditor.md, agents/review-sidecar.md — those are dispatched, not interactive). | env: react-native, react-next, react-spa, ts-server |
| `rule-research` | core | auto | Use when a consumer wants to bootstrap stack-aware ESLint rules from LIVE documentation rather than ship pre-baked recipes. Triggers: rule research, research stack practices, generate eslint rule from docs, bootstrap rules for my stack, rules-research, rule-bootstrapping, no-head-element, исследовать практики стека, сгенерировать правило из документации. | core: python, react-native, react-next, react-spa, ts-server |
| `rule-tests` | core | auto | Use when a consumer has an EXISTING generated rule whose firing test material is missing, broken, or needs a bypass variant. Triggers: rule tests, repair test material, fix negative-test, rule test material, verify the rule fires, rule-tests, починить тест правила, исправить негативный тест, проверить что правило срабатывает, тестовый материал для правила. NOT for creating new rules (/rule-research). | core: python, react-native, react-next, react-spa, ts-server |
| `self-reflection` | framework | auto | Use when introducing or extending a rule, principle, pattern, methodology, discipline, or process change in this repository. Auto-trigger on «правило», «принцип», «дисциплина», «методология», «процесс», recommend, introduce rule, new principle, discipline change, process rule, meta, recursive, applies to itself, check own work, self-review, forward check, backward check, closing recommendation, discipline-bearing artefact, self-reflection, anti-pattern, or any edit touching `.claude/rules/`, `packages/core/principles/`, `docs/meta-factory/EXECUTION-PLAN.md`, `docs/meta-factory/prior-art-evaluations.md`, `CLAUDE.md`. Do NOT trigger on simple typo fixes, code edits without rule changes, or routine PR work. | not installed on any lane (no-lane) |
| `story` | factory | auto | Use when work is done / a PR was pushed, or when the user asks to recap what was done — «расскажи что сделали», «расскажи историю», story, recap, «по актам». | not installed on any lane (no-lane) |
| `template-audit` | core | auto | Use when auditing rendered templates via local advisory review. Triggers: template, audit, render, generated docs, AGENTS.md, paraphrase, cue placement, local advisory, template-render, audit-template. | core: react-native, react-next, react-spa, ts-server |
| `tool-bootstrapping` | core | auto | Use when analysing project stack for MCP or skill recommendations. Triggers: tool bootstrapping, MCP installation, skill discovery, project onboarding tools, package.json deps changed, .ai-factory/tool-decisions.md, AIF /aif, tool detection, инструменты, бутстраппинг, MCP серверы, скиллы, зависимости, онбординг, подбор инструментов, предложение инструментов, подтверждение установки, tool proposal confirmation, incremental tool re-evaluation, rejected tools memory, memory persistence for tools. | core: python, react-native, react-next, react-spa, ts-server |
<!-- getff:end section=B-table -->

<!-- vale on -->

As of 2026-09-21 the script that builds this table has four known defects. Until the
script is fixed, read four columns with care. This note is temporary.

<!-- TEMPORARY(2026-09-21): delete this lead-in and the four bullets below in the same
change that fixes scripts/render-reference.mjs and regenerates this table. The defects
are listed as the generator batch in the S0 closure note. -->

- **Tier** is the [depth](../terms.md#depth) that installs the skill. The script still
  uses the older column name. The value `framework` marks a skill that getff uses on
  itself and never installs into your project.
- **Ships-to** is measured from a default install of each stack. A default install
  stops at `env`, so the five `factory` skills read "not installed on any lane". They do
  install when you pass `--profile factory`. The two `framework` skills read the same,
  and for them it is true. In that cell "lane" means any stack, which
  is wider than the [glossary meaning](../terms.md#lane).
- **Invocation** is wrong for `aif-doctor`. The script reads `slash-only` whenever a
  skill sets the `disable-model-invocation` key, without looking at the value. That skill
  sets it to `false`, so the agent does pick it up by itself. The other rows are right.
- **What it is** is empty for `orchestrator`, and that row has one cell too many. The
  script does not yet read a description that spans several lines. What `orchestrator`
  does: it splits a larger job into subtasks and delegates them to another model.

Each skill gets its own page with a [fact card](../terms.md#fact-card), a plain
explanation, and the files that prove each fact. The table does not link to those pages
yet, so here they are by [depth](../terms.md#depth). Start with [getff](B/getff.md): it
is the one skill every other skill builds on.

- **`core`:** [getff](B/getff.md), [ai-doc](B/ai-doc.md),
  [rule-research](B/rule-research.md), [rule-tests](B/rule-tests.md),
  [template-audit](B/template-audit.md), [tool-bootstrapping](B/tool-bootstrapping.md)
- **`env` adds:** [arch](B/arch.md), [night-mode](B/night-mode.md),
  [orchestrator](B/orchestrator.md), [pipeline](B/pipeline.md),
  [reviewer](B/reviewer.md)
- **`factory` adds:** [aif-doctor](B/aif-doctor.md),
  [claude-glm-executor-handoff](B/claude-glm-executor-handoff.md),
  [dispatcher](B/dispatcher.md), [harvest](B/harvest.md), [story](B/story.md)
- **Never installed, used by getff on itself:** [docs-author](B/docs-author.md),
  [self-reflection](B/self-reflection.md)

**See which skills you have.** Skills live in one folder. List it:

```bash
ls .claude/skills
```

On a `ts-server` project installed at the `core` [depth](../terms.md#depth), you get:

```text
ai-doc
getff
rule-research
rule-tests
template-audit
tool-bootstrapping
```

**Let the agent pick a skill.** Most skills are marked `auto` in the table. You do not
call them. Describe the job in plain words, and the agent loads the skill whose
description matches.

**Start a skill yourself.** Skills marked `slash-only` never load by themselves. Type
the name after a slash in Claude Code, for example `/arch`. They are kept manual because
they start long or costly work.

**Get more skills.** How many skills you get depends on the depth you install. `core`
gives the six skills above. `env` adds five skills for design, review, and running
multi-step work. `factory` adds five more that drive a task runtime. Pick the depth with
the `--profile` flag when you install. A non-interactive install with no flag gives you
`env`. The guide [Add the design and review skills](../guides/add-design-and-review-skills.md)
walks through moving from `core` to `env`.

## When not to reach for this family

Do not expect a skill to stop anything. A skill is part of the
[soft layer](../terms.md#soft-layer-and-hard-layer): the agent reads it and may still
ignore it. When a [convention](../terms.md#convention) must hold, make it a
[rule](../terms.md#rule) with a [gate](../terms.md#gate). Use a skill to teach the agent
the way there, not to guard the door.

Skills are also not for the `cargo` and `go` lanes yet. Those installs wire native lint
gates and ship no skills.

If your agent is not Claude Code, the skill files are still plain Markdown and any agent
can read them. What you lose is the automatic loading: you have to point the agent at
the file yourself.

## How to read a fact card

Every skill page opens with the same eight rows. Three of them need a word:

- **invocation** says who starts the skill. `auto` means the agent picks it up from the
  description when your request matches. `slash-only` means you type `/<name>` yourself.
- **posture** says how much the skill depends on
  [Claude Code](../terms.md#claude-code). `portable` means any agent that reads files
  can follow it. `portable-designed-not-proven` means it was written that way and nobody
  has run it on another agent yet. `cc-native-with-fallback` means it uses Claude Code
  features and says what to do without them. `cc-only` means it does not work elsewhere,
  and the skill file says why.
- **operator-twin** is the path of a second copy that the getff team keeps in its own
  `.claude/skills` folder. Most skills have one. `no operator twin` means there is no
  such second copy. That is the case for [getff](B/getff.md): the team uses the very
  folder it ships, `skills/getff`. You can ignore this row in your project.

The `source` row is the file and line the description was read from, and `ships-to` is
covered by the note under the table.
