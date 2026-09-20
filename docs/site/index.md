---
title: Introduction
description: What getff is, who it is for, what you get today, and how finished each stack is.
kind: face-page
sources:
  - AGENTS.md
  - CLAUDE.md
  - README.md
  - docs/site/face-facts.json
  - docs/site/how-it-works.md
  - docs/site/installation.md
  - docs/site/llms-head.txt
  - docs/site/quick-start.md
  - docs/site/reference/B.md
  - docs/site/terms.md
  - docs/site/why.md
  - packages/core/manifest/maturity.json
next: quick-start.md
---

# Introduction

getff turns your team's coding conventions into checks that fail. When an AI agent
breaks a [convention](terms.md#convention), the commit or the build stops, and the error
tells the agent what to fix.

Every [rule](terms.md#rule) is an executable [artifact](terms.md#artifact): a lint rule,
a git hook check, a test. It fails at the earliest [channel](terms.md#channel) that can
see the problem: while editing, at commit, at push, and only then in CI. CI is the last
resort. This restates the [project goal](../../README.md#why-this-exists) and does not
replace it.

## Who it is for

| You are | Your problem | Start with |
|---|---|---|
| A team whose AI agent writes code | The code looks right and breaks rules nobody wrote down. | [Why getff](why.md) |
| A maintainer of an `AGENTS.md` or `CLAUDE.md` | The file drifts away from the code, and nothing notices. | [How it works](how-it-works.md) |
| An evaluator | You want proof before you adopt anything. | [Quick start](quick-start.md) |

## What you get today

getff ships as files. These are the families, counted from the repository:

<!-- getff:begin section=face-rosters plan=scripts/render-face-facts.mjs -->
| Family | Members |
|---|---|
| Installer layers | 16 |
| Skills | 18 |
| Agents | 12 |
| Hooks | 24 |
| Templates | 38 |
| Rules | 29 |
| Generated rules | 26 |
| Scripts | 27 |
| Packages | 8 |
| Bridge CLI | 8 |
| Plugin | 13 |
<!-- getff:end section=face-rosters -->

The [skills](reference/B.md) family has its reference pages today. The other families
get theirs as the reference section is written.

You do not get all of this in one install. The [stack](terms.md#stack) and the
[depth](terms.md#depth) you pick decide what lands in your project.
[Installation](installation.md) lists it.

## Honest status

The seven stacks are not equally finished. This table is generated from the file that
also drives the installer's own labels.

<!-- getff:begin section=face-maturity-all plan=scripts/render-face-facts.mjs -->
| Stack | Status | What to know | Rule generation | Checked |
|---|---|---|---|---|
| `ts-server` | beta | Default TS lane; it shares the manifest-rendered multi-stack rule pack with react-next — no ts-server-specific rules beyond it. | generated | 2026-09-14 |
| `react-next` | beta | Wires three custom rules by default (two more behind AIF_STRICT_RUNTIME=1) on top of the shared manifest-rendered rule pack. | generated | 2026-09-14 |
| `react-spa` | early | Wires two custom rules by default (two more behind AIF_STRICT_RUNTIME=1); the rule-pack is still growing. | static | 2026-09-14 |
| `react-native` | experimental | Ships stack scaffold + templates; no custom rule is wired yet. | static | 2026-09-14 |
| `python` | alpha | Non-npm lane — ast-grep + ruff only; the npm custom-rule engine does not apply. | generated | 2026-09-14 |
| `cargo` | alpha | cargo-deny ships as a starter config no workflow runs; the clippy bans are the enforced lane (CI-failing when violated). | deferred | 2026-09-14 |
| `go` | alpha | Rules ship as a golangci config that is inert until you opt in; rule generation is deferred (operator, 2026-09-09). | deferred | 2026-09-14 |
<!-- getff:end section=face-maturity-all -->

What the [four status words](terms.md#beta-alpha-early-experimental) mean:

<!-- getff:begin section=face-maturity-definitions plan=scripts/render-face-facts.mjs -->
| Status | Meaning |
|---|---|
| beta | One-command install; a rule provably fires on your code (`npm run lint` goes RED on a planted violation); rule docs are generated from the delivered rule set. |
| alpha | Installs one-command and fires on verified fixtures; rule generation is partial or deferred. |
| early | Installs one-command and wires real rules, but the rule-pack is still growing. |
| experimental | Stack scaffold + templates; a dedicated rule-pack is not yet shipped. |
<!-- getff:end section=face-maturity-definitions -->

"Rule generation" says whether getff's generating step produces output for that stack.
`generated` means it does. `static` means the stack ships a fixed, hand-made set.
`deferred` means the work is not done yet. It is not skipped on purpose.

Two rows mention `AIF_STRICT_RUNTIME=1`. Two runtime rules ship switched off, and that
environment variable switches them on. The status rows are copied word for word from the
installer's own data file, so some wording in them is internal. "Default TS lane" means
the default TypeScript stack. On this site a [lane](terms.md#lane) is a stack that does
not use npm.

## Where next

- [Quick start](quick-start.md): ten minutes to a rule that stops your own code.
- [Installation](installation.md): every install path, and how to preview it.
- [Why getff](why.md): the argument, the proof, and when you do not need it.

If you are an AI agent, start from `getff.ai/llms.txt`.

Next: [Quick start](quick-start.md).
