---
title: Quick start
description: Pick your stack and get to the first rule that goes red on your own code, in about ten minutes.
kind: face-page
sources:
  - docs/site/face-facts.json
  - docs/site/index.md
  - docs/site/quickstart-go.md
  - docs/site/quickstart-python.md
  - docs/site/quickstart-rust.md
  - docs/site/quickstart-ts.md
  - docs/site/terms.md
  - packages/core/manifest/maturity.json
next: quickstart-ts.md
---

# Quick start

Pick the card that matches your project. Each one takes you to the same place: a
[rule](terms.md#rule) that goes [red](terms.md#red-and-green) on a line you wrote.

## What happens in the next ten minutes

You run one install command in your project. The installer copies the rules, wires the
git hooks and CI, and then tests itself: it plants a broken file, checks that the
[gate](terms.md#gate) goes red, and checks that a clean file stays green. After that you
break a rule on purpose in your own code and run your stack's normal lint command. It
fails and names your file. Then you know the rules are not decoration.

## TypeScript and npm

[Start the TypeScript and React quick start](quickstart-ts.md)

There are four npm [stacks](terms.md#stack). The status tells you how much is wired
today.

<!-- getff:begin section=face-maturity-npm plan=scripts/render-face-facts.mjs -->
| Stack | Status | What to know |
|---|---|---|
| `ts-server` | beta | Default TS lane; it shares the manifest-rendered multi-stack rule pack with react-next — no ts-server-specific rules beyond it. |
| `react-next` | beta | Wires three custom rules by default (two more behind AIF_STRICT_RUNTIME=1) on top of the shared manifest-rendered rule pack. |
| `react-spa` | early | Wires two custom rules by default (two more behind AIF_STRICT_RUNTIME=1); the rule-pack is still growing. |
| `react-native` | experimental | Ships stack scaffold + templates; no custom rule is wired yet. |
<!-- getff:end section=face-maturity-npm -->

The rows are copied word for word from the installer's data file, so some wording is
internal. "Default TS lane" in the first row means the default TypeScript stack. On this
site a [lane](terms.md#lane) is a stack that does not use npm.

## Python

[Start the Python quick start](quickstart-python.md)

<!-- getff:begin section=face-maturity-python plan=scripts/render-face-facts.mjs -->
| Stack | Status | What to know |
|---|---|---|
| `python` | alpha | Non-npm lane — ast-grep + ruff only; the npm custom-rule engine does not apply. |
<!-- getff:end section=face-maturity-python -->

## Rust

[Start the Rust quick start](quickstart-rust.md)

<!-- getff:begin section=face-maturity-cargo plan=scripts/render-face-facts.mjs -->
| Stack | Status | What to know |
|---|---|---|
| `cargo` | alpha | cargo-deny ships as a starter config no workflow runs; the clippy bans are the enforced lane (CI-failing when violated). |
<!-- getff:end section=face-maturity-cargo -->

## Go

[Start the Go quick start](quickstart-go.md)

<!-- getff:begin section=face-maturity-go plan=scripts/render-face-facts.mjs -->
| Stack | Status | What to know |
|---|---|---|
| `go` | alpha | Rules ship as a golangci config that is inert until you opt in; rule generation is deferred (operator, 2026-09-09). |
<!-- getff:end section=face-maturity-go -->

The [Introduction](index.md) explains the four status words. If your stack is not
here, getff does not support it yet.
