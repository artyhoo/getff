---
title: Quick start for Python
description: Install getff into a Python project and watch ruff go red on a banned call in your own code.
kind: face-page
sources:
  - docs/site/face-facts.json
  - docs/site/installation.md
  - docs/site/learn/stop-a-bad-commit.md
  - docs/site/quickstart-go.md
  - docs/site/quickstart-rust.md
  - docs/site/quickstart-ts.md
  - docs/site/terms.md
  - packages/core/manifest/maturity.json
  - packages/core/templates/python/github-actions-ci.yml
  - packages/core/templates/shared/first-steps.source.json
  - setup.d/45-python.sh
executed:
  - { step: install, stack: python, date: 2026-09-21, result: exit-0, versions: "ruff 0.15.21, ast-grep 0.44.1" }
  - { step: fire-on-your-code, stack: python, date: 2026-09-21, result: RED }
  - { step: refresh-unloadable-pre-commit-config, stack: python, date: 2026-09-30, result: "exit-0, file left as it was" }
next: installation.md
docs-refresh: deferred — re-verified 2026-09-30, the cited setup.d/45-python.sh changed only inside the check that finds a column-0 item of the hook list in an indented .pre-commit-config.yaml (a quote right after the colon that follows a quoted key and a block scalar header after a tag or anchor are now read the way YAML reads them) and in an internal comment; the page says when that file does not load and what getff then prints, and both still hold, so no line here changed meaning; clears at the next gold refresh of this page
---

# Quick start for Python

Other stacks: [TypeScript and React](quickstart-ts.md) · [Rust](quickstart-rust.md) · [Go](quickstart-go.md)

You will install getff into a Python project, add one banned call to your own code, and
watch the linter go [red](terms.md#red-and-green) on it. The red line shows that the
[rule](terms.md#rule) reaches your files, not only a test folder.

Python is a [lane](terms.md#lane): getff uses the tools Python developers already have,
`ruff` and `ast-grep`, and installs nothing from npm into your project.

<!-- getff:begin section=face-maturity-python plan=scripts/render-face-facts.mjs -->
| Stack | Status | What to know |
|---|---|---|
| `python` | alpha | Non-npm lane — ast-grep + ruff only; the npm custom-rule engine does not apply. |
<!-- getff:end section=face-maturity-python -->

You need a project with a `pyproject.toml`, and `ruff` and `ast-grep` on your machine.
The installer also looks for `bash`, `git`, `python3`, and `curl`. It warns about a
missing one and carries on, so read its first lines.

## 1. Install

```bash
git clone https://github.com/artyhoo/getff /tmp/rt
cd /your/project
bash /tmp/rt/setup -y python
```

The installer copies the rule files, a CI workflow, and a pre-push hook, plus
`scripts/check-zcode-mirror.sh`, which that hook runs on every push to guard an
optional `.zcode/` skill mirror
([what it checks](learn/stop-a-bad-commit.md#the-mirror-check-on-every-commit)). Then it tests
itself. It plants a bad file in a temporary folder and checks both tools:

```text
▶ getff firing self-check — proving the delivered rules FIRE (planted violation in an OS temp dir)
  ✓ ast-grep fired RED on the planted violation (eval / os.system / datetime.now bans live)
  ✓ ast-grep clean control GREEN — no diagnostics on conforming code (rules discriminate)
  ✓ ruff fired RED on the planted violation (TID251 utcnow / TID253 tensorflow bans live)
  ✓ ruff clean control GREEN — no diagnostics on conforming code (bans discriminate)

✓ getff self-check: both lanes fired RED on planted violations and stayed GREEN on clean controls — enforcement is live.
```

Each tool is checked twice on purpose. Red on bad code shows the rule works. Green on
clean code shows it does not fail on everything.

If your project already uses [pre-commit](https://pre-commit.com), the installer leaves
your hooks alone. It adds a `getff-python-pre-push` entry to your `.pre-commit-config.yaml`,
at the indent of your own items. Then it installs pre-commit's pre-push stage with
`pre-commit install --hook-type pre-push`, so the entry runs on every push. When it cannot,
for example because `pre-commit` is not on your PATH, it names the reason at the end of the
run.

## 2. Check what landed

```bash
ls -a
```

```text
.
..
.ai-factory
.claude
.getff
.getff-python-install.log
.git
.github
.mcp.json
.ruff_cache
AGENTS.md
app
pyproject.toml
ruff.toml
sgconfig.yml
```

`app`, `pyproject.toml`, and `.git` were ours. `.ruff_cache` is ruff's own cache, from a
ruff run in this folder. The rest is from getff. `.getff/` holds the rules getff
owns: the ruff bans and the ast-grep rules. `ruff.toml` and `sgconfig.yml` are yours to
edit. If you already had them, the installer never overwrites them. It merges its rule
folder into your `sgconfig.yml`. It leaves your ruff settings alone and says so in a
warning, because a second `ruff.toml` would silently replace yours. The bans still run,
since the [gate](terms.md#gate) reads `.getff/ruff-bans.toml` directly. `.getff-python-install.log`
records what was written and why.

## 3. Fire a rule on your own code

Open any module and add a call the rules ban:

```python
from datetime import datetime


def stamp() -> str:
    return datetime.utcnow().isoformat()
```

Run the gate:

```bash
ruff check . --config .getff/ruff-bans.toml
```

```text
TID251 `datetime.datetime.utcnow` is banned: datetime.datetime.utcnow() is deprecated and returns a naive datetime; use datetime.now(timezone.utc)
 --> app/clock.py:9:12
  |
8 | def stamp() -> str:
9 |     return datetime.utcnow().isoformat()
  |            ^^^^^^^^^^^^^^^
  |

Found 1 error.
```

The command exits with code 1. The message names your file and line, and says what to
write instead. Change the call to `datetime.now(timezone.utc)` and the gate is green.

The CI workflow the installer wrote runs this command with `--no-cache` added, so a pull
request with this line in it fails.

## What this did not prove

- **The rule pack is small.** Today it bans a handful of calls: `eval`, `os.system`,
  naive `datetime` calls, and one import. It is a starting set, not a full style guide.
- **No custom rule engine.** The npm [stacks](terms.md#stack) can compile a team [convention](terms.md#convention) into a new
  lint rule. On this lane that does not apply. You add rules by writing ast-grep rules
  or ruff settings yourself.
- **The CI workflow assumes a branch name.** With no git remote, the installer cannot
  see your default branch. It writes `main` into the workflow and prints a warning.
  Check the file if your branch has another name.
- **getff does not repair your `.pre-commit-config.yaml`.** A later
  [`--refresh`](installation.md#updating) keeps getff's entry up to date, as long as you
  have not edited it. But if one of your own `repos:` items sits in column 0 while
  the others are indented, the file does not load as YAML, wherever getff's entry goes.
  getff never re-indents your items, so the refresh leaves the file as it was and says why:

  ```text
    ⊝ the getff entry in .pre-commit-config.yaml was not updated — the file does not load as YAML (line 23)
  ```

  It installs no pre-push stage for that file. The list of pieces not wired at the end
  of the run names the same line.

Next: [Installation](installation.md) covers every install path and what each one
writes.
