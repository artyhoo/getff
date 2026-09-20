---
title: Use getff with your AI agent
description: Hand this site to your AI agent in one paste. Three prompts we ran, what the agent did with each, and the other places an agent can read about getff.
kind: face-page
sources:
  - docs/site/index.md
  - docs/site/installation.md
  - docs/site/learn/stop-a-bad-commit.md
  - docs/site/llms-head.txt
  - docs/site/quickstart-ts.md
  - docs/site/reference/B.md
  - docs/site/terms.md
  - package.json
  - plugin/skills/getff/SKILL.md
  - plugin/skills/installing-enforcement/SKILL.md
  - plugin/skills/tool-bootstrapping/SKILL.md
  - plugin/skills/using-getff/SKILL.md
executed:
  - { step: prompt-evaluate, stack: ts-server, date: 2026-09-21, result: "answered from three pages, wrote nothing" }
  - { step: prompt-install, stack: ts-server, date: 2026-09-21, result: "dry run exit-0, stopped for confirmation, wrote nothing" }
  - { step: prompt-explain-a-rule, stack: ts-server, date: 2026-09-21, result: "answered; no rule page exists yet, used the tutorial and the installed files" }
  - { step: deepwiki-indexed-at, stack: repo, date: 2026-09-21, result: "Last indexed 20 July 2026 (2c77e4)" }
  - { step: context7-lookup, stack: repo, date: 2026-09-21, result: "/artyhoo/getff found" }
next: index.md
---

# Use getff with your AI agent

Your agent can read this site without you. Give it one address and a task, and it finds
the page it needs. This page gives you that address, three prompts to paste, and an
honest account of what happened when we ran them.

## Give your agent the site

Paste this address into your agent:

```text
https://getff.ai/llms.txt
```

`llms.txt` is a short plain-text map of the site, written for a program to read. It
says what getff is in one sentence, then lists the main pages in the order an agent
should read them. A second file, `https://getff.ai/llms-full.txt`, holds every page in
one document. Use it when your agent has room for the whole site and you want no
follow-up fetches.

Every page also exists as plain Markdown at the same address plus `.md`.

## Three prompts

We ran each prompt in Claude Code on 2026-09-21. One caveat about that run: getff.ai was
not published yet, so each agent was told to read the same pages from a local folder.
The prompts below are otherwise word for word what the agents received.

### Evaluate getff for this repository

```text
Read https://getff.ai/llms.txt, then the Introduction and the Why getff page it links.
Tell me whether getff fits this repository: which stack applies, that stack's status
label, what an install would add, and the honest limits. Do not install anything.
```

We ran it in a project with two files: a `package.json` that depends on `express`, and
one TypeScript file. The agent read the Introduction, Why getff, Installation, and the
glossary. It picked the `ts-server` [stack](terms.md#stack), reported the label `beta`,
listed what the install writes, and repeated the limits from the Why page. It also said
something we did not ask for and agree with: for a project with one line of code the
default install is a lot, and the `core` [depth](terms.md#depth) is the lighter choice.
It changed no file.

### Install getff here

```text
Read https://getff.ai/llms.txt and open the quick start page for this repository's
stack. Show me the install plan with a dry run first. Install only after I confirm.
Do not commit anything.
```

In the same project, the agent read the quick start and the Installation page. It then
ran this, from the project root, with the clone path in place of `/tmp/rt`:

```bash
bash /tmp/rt/setup --dry-run --profile core ts-server
```

The command exited with code 0. The agent summarized the plan, listed the folder to show
it still held only `package.json` and `src`, and stopped to wait for a yes. It did not
install and did not commit.

This prompt stops before the [hard layer](terms.md#soft-layer-and-hard-layer) on
purpose. Git hooks and CI change how your whole team works. Let the agent show you the
plan, and say yes yourself.

### Explain a rule that just fired

```text
This rule just fired:

<paste the error line here>

Read https://getff.ai/llms.txt, find the page that explains this rule, and tell me what
the rule protects, how to fix my code, and where it is enforced.
```

We pasted the `no-unsafe-zod-parse` error from the
[TypeScript quick start](quickstart-ts.md). The honest result: the site has no page for
that [rule](terms.md#rule) yet. Reference pages exist today for the [skills](reference/B.md) family only.
The agent said so. It then answered from two places. The tutorial
[Stop a bad commit](learn/stop-a-bad-commit.md) gave it the reason and the fix. The
files getff had installed in the project gave it the rest: the rules list in
`.ai-factory/RULES.md`, the ESLint config, the git hook, and the CI workflow. Its answer
was correct.

So this prompt works today because an install puts the rule's explanation in your
repository, not because the site has it. Rule pages are being written. Until then, add
this line to the prompt: `Also read .ai-factory/RULES.md in this repository.`

## What the runs taught us

We asked each agent to list where the pages failed it. We fixed what was ours to fix
before publishing: a preview output that left lines out, two pages that sent readers to
the wrong place for the status labels, and a quick start that never mentioned the dry
run. Some findings are about the product, not the pages, and are still open:

- The status table on the [Introduction](index.md) copies wording from the installer's
  data file. Agents stumbled on internal phrases there.
- In a fresh install, `.ai-factory/RULES.md` lists fewer paths for the
  `no-unsafe-zod-parse` rule than `eslint.config.mjs` enforces: three paths against
  five. The config is what runs.

## Other doors

- **Context7.** getff is indexed as `/artyhoo/getff`. An agent with the Context7 tool
  can query it by that name.
- **DeepWiki.** `https://deepwiki.com/artyhoo/getff` answers questions about the source
  code. Its index lags. On 2026-09-21 it read "Last indexed: 20 July 2026", two months
  behind the repository. Trust it for structure and check it for details.
- **The Claude Code plugin.** `/plugin marketplace add artyhoo/getff`, then
  `/plugin install getff@getff`. It brings [skills](terms.md#skill) your agent loads
  when needed: `getff` for the method, `using-getff` as the entry point,
  `installing-enforcement` for adding the hard layer, and `tool-bootstrapping` for
  setting up missing tools. [Installation](installation.md#claude-code-plugin) says what
  the plugin does and does not do.

## What the Markdown pages carry

Each Markdown page starts with a block of fields. These are the ones an agent can use:

| Field | What it holds |
|---|---|
| `sources` | Every repository file the page relies on. |
| `executed` | Each example that was run, with the stack, the date, and the result. |
| `next` | The page to read after this one. |
| `verified-at` | The getff commit the page was checked against. The site adds this when it is built. |
| `stale-since` | Present only when a page is known to be behind the code. |

With `verified-at` and `sources`, your agent can cite a file at a fixed commit. With
`stale-since`, it can tell when not to trust a page.

## No MCP server

getff does not run a server for agents. The site is static files.
That keeps it free to run, and it means an agent needs nothing installed to read it: a
plain fetch of `llms.txt` is enough.

Next: back to the [Introduction](index.md).
