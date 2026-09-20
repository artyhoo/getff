---
title: Installation
description: Every way to install getff, what each one writes into your project, how to preview it first, how to update, and how to take it out.
kind: face-page
sources:
  - AGENTS.md
  - INSTALL-FOR-AI.md
  - README.md
  - docs/site/face-facts.json
  - docs/site/guides/add-design-and-review-skills.md
  - docs/site/index.md
  - docs/site/quick-start.md
  - docs/site/terms.md
  - docs/site/why.md
  - install.sh
  - package.json
  - packages/core/manifest/maturity.json
  - plugin/install/fetch-and-wire.sh
  - setup
  - setup.d/10-skills.sh
  - setup.d/70-deps.sh
  - setup.d/99-finalize.sh
  - setup.d/lib.sh
executed:
  - { step: preview-one-command, stack: ts-server, date: 2026-09-21, result: "exit-0, nothing written" }
  - { step: preview-plugin-helper, stack: ts-server, date: 2026-09-21, result: "exit-0, nothing written" }
  - { step: preview-refresh, stack: ts-server, date: 2026-09-21, result: "exit-0, 86 would-refresh, 0 would-flag" }
next: why.md
---

# Installation

getff installs files into your project: [rules](terms.md#rule), git hooks, a CI workflow, and guidance
your AI agent reads. Nothing runs as a service, and nothing phones home. This page shows
each way to install, how to see the plan before anything is written, and how to get
back out.

If you only want the shortest path, use the [quick start](quick-start.md). Come back
here when you need a flag, a different install path, or an update.

## One command

This is the path most projects use. It works for every [stack](terms.md#stack).

```bash
git clone https://github.com/artyhoo/getff /tmp/rt
cd /your/project
bash /tmp/rt/setup ts-server
```

Replace `ts-server` with your stack: `react-next`, `react-spa`, `react-native`,
`python`, `cargo`, or `go`. Leave the name out and the installer tries to detect it.

Run it inside a git repository, because the install sets a git hooks path. Your machine
needs `bash`, `git`, `python3`, and `curl`. The installer looks for them
first and prints a warning for each one it cannot find. It does not stop, so read those
first lines. The four npm stacks also need Node 20.19 or newer. The install writes an
`.nvmrc` that pins Node 22 for CI.

The command asks a few questions as it goes. Three flags change that:

| Flag | What it does |
|---|---|
| `--dry-run` | Prints the full plan and writes nothing. |
| `-y` (or `--yes`) | Answers yes to the prompts, installs the development dependencies, and runs the [self-check](terms.md#self-check) at the end. |
| `--profile core` (or `env`, `factory`) | Picks the [depth](terms.md#depth). See [What gets installed](#what-gets-installed). |

### Preview first

Run the dry run before the real install. Add `--profile core` to preview the depth the
[quick start](quick-start.md) uses. Without it you preview the default, `env`.

```bash
bash /tmp/rt/setup --dry-run ts-server
```

The full output on a `ts-server` project with two files was 204 lines. Below are only
the lines that begin with `▶`, `[profile]`, or `✅`, in order, with none of those left
out. One change: the long project path is cut to `…`. Under most headings the real
output lists one `[dry-run] would …` line per file, folder, or hook. After
`Dry-run complete` it also prints a `Next steps` list meant for a real install. Ignore
that list in a preview: nothing was written.

```text
▶ Preflight
▶ Framework (install.sh)
▶ Verifying shipped artefacts carry Authoritative-for headers
[profile] env (non-interactive default; --profile core for rules-only, --profile factory for the AIF suite)
[profile] env
▶ Installing rules-as-tests-aif into … (stack: ts-server)
▶ Skills → .claude/skills/
▶ Claude hooks → .claude/hooks/
▶ Sub-agents → .claude/agents/
▶ AI Factory templates → .ai-factory/
▶ Scripts → scripts/
▶ Shared templates → project root
▶ Custom ESLint rules → eslint-rules-local/
▶ Stack-specific templates (ts-server) → project root
▶ Core ESLint rules → packages/core/eslint-rules/
▶ git hooks → [dry-run] would set core.hooksPath=.husky
▶ Runtime-bridge vendor → [dry-run] skipped (profile=env, factory-only)
▶ R2 auto-wire → [dry-run] would classify the repo and patch RULE_GLOBS / record R2 N/A as warranted
▶ package.json scripts → [dry-run] would merge canonical block (non-destructive)
▶ dev-deps → [dry-run] would offer to install 24 dev-dep(s) + 1 runtime dep(s) with npm
▶ tsx-at-root → [dry-run] would ensure tsx resolves from the workspace root (pre-push TS hook runtime)
▶ Worktree scripts → scripts/ (profile=env)
✅ Dry-run complete. Nothing was written.
▶ Companions
▶ Runtime-bridge
✅ ./setup complete (dry-run).
```

The command exits with code 0. Afterwards the project folder held exactly what it held
before: `package.json` and `src`.

Two lines need a word. `AI Factory templates → .ai-factory/` is the folder of guidance
files every install gets. The folder keeps `AI Factory`, a name the project used before; the glossary lists it
under [getff](terms.md#getff). The folder works without any other tool. `Companions` are optional outside tools the wrapper offers to set up, such as
the superpowers skills and ast-grep. It skips any you already have.

The name `rules-as-tests-aif` in the output is the project's older name. It is the same
tool.

## Claude Code plugin

If you use Claude Code, you can add getff as a plugin instead:

```text
/plugin marketplace add artyhoo/getff
/plugin install getff@getff
```

Know what this gives you. The plugin delivers the
[soft layer](terms.md#soft-layer-and-hard-layer) only: skills, helper agents, and
session hooks. It does not touch your git hooks or your CI, so by itself it cannot stop
a commit. A plugin that silently rewired your repository would be a bad neighbor.

To add the hard layer from inside the plugin, run this in Claude Code:

```text
/getff:install-enforcement
```

It fetches the installer and shows you the same kind of plan as the dry run above. It
writes only after you confirm. This is the start of that preview, on a second small
`ts-server` project. One line that names the installer's own folder comes first and is
left out, and the long project path is cut to `…`. The lines after the block list the files, as above.

```text
▶ PREVIEW (dry-run) — wiring plan for … (stack=ts-server); nothing will be written:
▶ Verifying shipped artefacts carry Authoritative-for headers
  ✓ all 30 shipped artefacts carry valid headers
[profile] env (non-interactive default; --profile core for rules-only, --profile factory for the AIF suite)
```

## Manual

`setup` is a wrapper. It checks your machine, calls `install.sh`, and then offers the
companion tools. You can call the inner script yourself:

```bash
bash /tmp/rt/install.sh ts-server --dry-run
```

`install.sh` takes the same `--dry-run` and `--profile` flags, plus `--refresh` and
`--force`, which are covered under [Updating](#updating). Run this way, it skips the
machine check and does not run the self-check at the end. Pass `--full` to get the
self-check back. Use this path in scripts and CI, where you want one step and no
prompts.

## What gets installed

Every install writes the same base:

- **Guidance for your agent.** `AGENTS.md` at the project root and a folder
  `.ai-factory/` with your rules list and architecture notes.
- **Rules.** For the npm stacks, ESLint rules in `eslint-rules-local/` and a config that
  loads them. For `python`, `cargo`, and `go`, a config for the linter you already use.
- **[Gates](terms.md#gate).** Git hooks in `.husky/` and a CI workflow in `.github/workflows/`.
- **Checks on getff itself.** Scripts in `scripts/` that prove the rules still [fire](terms.md#fire).

The [depth](terms.md#depth) decides how much agent tooling comes on top:

| Depth | Adds | Pick it when |
|---|---|---|
| `core` | Six [skills](terms.md#skill) that help an agent write and test rules. | You want the rules and gates and little else. |
| `env` | Five more skills for design, review, and multi-step work. | You work with an AI agent every day. This is the default. |
| `factory` | Five more skills and the pieces that drive a task runtime. | You run `aif-handoff`, a separate task runtime. |

The `python` [lane](terms.md#lane) gets four of the skills. The `cargo` and `go` lanes
get none, only the rules and gates. To move an existing install to a deeper depth,
follow [Add the design and review skills](guides/add-design-and-review-skills.md).

The three depths add up to sixteen skills. The getff repository holds two more that it
uses on itself and does not install.

How finished each stack is differs. The [Introduction](index.md#honest-status) shows the
current status of each one and says what the labels mean.

## Updating

Pull the newer getff, then run the installer again with `--refresh`:

```bash
git -C /tmp/rt pull
bash /tmp/rt/install.sh ts-server --refresh
```

A plain re-run never overwrites a file that already exists. It only adds what is
missing. `--refresh` is different: it replaces the files getff owns with their new
versions. It keeps the depth you already have.

Three rules protect your edits during a refresh:

- **Files you are meant to edit are not refreshed.** Your rules list and your configs
  are written once and then left alone. In `AGENTS.md` getff owns one marked block and
  leaves the rest of the file to you. What a refresh does replace is the machinery:
  skills, helper agents, session hooks, the check scripts in `scripts/`, and the rule
  code in `eslint-rules-local/`. On a fresh `ts-server` install at the `core` depth, a
  refresh preview listed 86 such files and none of yours.
- **An edited getff file is saved before it is replaced.** The installer notices the
  file differs from what it delivered, copies yours to `.ai-factory/refresh-conflicts/`,
  and prints a warning that names both paths.
- **An override file wins.** Put `AGENTS.override.md` next to `AGENTS.md`, or
  `<name>.override.md` next to any shipped Markdown file, and the refresh skips that
  file. By [convention](terms.md#convention) an agent reads the override instead of the original. That part is a
  convention only: no check enforces it.

`--force` overwrites everything, including files you edited. Commit first, and read the
diff afterwards.

Run `--refresh --dry-run` to see what a refresh would change. A file you edited shows up
as `would-flag`.

## If you want it out

There is no uninstall command today. Everything getff does is a file in your
repository, so removal is a git operation.

The clean way is to install on a branch and commit the install as one commit. To back
out, revert that commit. The installer does not commit for you.

If the install is already mixed into other work, remove these by hand:

- `AGENTS.md`, `.ai-factory/`, `.claude/skills/`, `.claude/agents/`, `.claude/hooks/`
- `eslint-rules-local/` and the getff block in your ESLint config
- `.husky/`, then `git config --unset core.hooksPath`
- `.github/workflows/ci.yml`, if getff wrote it
- The scripts getff added to `package.json`, and the development dependencies it installed

Check the last item against your git history. The installer merges into
`package.json` and does not mark its lines, so it cannot list them for you later.

Next: [Why getff](why.md) explains the problem this solves, and when you do not need it.
