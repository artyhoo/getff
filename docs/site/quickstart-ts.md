---
title: Quick start for TypeScript and React
description: Install getff into an npm project and, ten minutes later, watch a rule go red on a line you wrote yourself.
kind: face-page
sources:
  - AGENTS.md
  - docs/site/face-facts.json
  - docs/site/index.md
  - docs/site/installation.md
  - docs/site/learn/stop-a-bad-commit.md
  - docs/site/quickstart-go.md
  - docs/site/quickstart-python.md
  - docs/site/quickstart-rust.md
  - docs/site/terms.md
  - install.sh
  - package.json
  - packages/core/manifest/maturity.json
  - packages/core/templates/shared/first-steps.source.json
  - setup.d/70-deps.sh
  - setup.d/99-finalize.sh
  - templates/ts-server/eslint.config.mjs
executed:
  - { step: install, stack: ts-server, date: 2026-09-21, result: exit-0, versions: "node 24.3.0, eslint 9.39.4" }
  - { step: verify-payload, stack: ts-server, date: 2026-09-21, result: listed }
  - { step: prove-rules-not-inert, stack: ts-server, date: 2026-09-21, result: exit-0 }
  - { step: watch-a-rule-fire, stack: ts-server, date: 2026-09-21, result: exit-0 }
  - { step: fire-on-your-code, stack: ts-server, date: 2026-09-21, result: RED }
  - { step: run-the-gate, stack: ts-server, date: 2026-09-21, result: exit-0 }
  - { step: strict-runtime-second-red, stack: ts-server, date: 2026-09-21, result: RED }
next: installation.md
docs-refresh: deferred — re-verified 2026-09-22, the cited sources changed only in code-comment line-number citations; no source changed its line count, and no line this page cites or quotes was touched; clears at the next gold refresh of this page
---

# Quick start for TypeScript and React

Other stacks: [Python](quickstart-python.md) · [Rust](quickstart-rust.md) · [Go](quickstart-go.md)

You will install getff into an npm project, then break one of its
[rules](terms.md#rule) on purpose and watch the linter go
[red](terms.md#red-and-green) on your own file. That red line is the whole point. It
shows the rule is not a sentence in a document. It is a check that reaches your code.

You need a project with a `package.json`, Node 20.19 or newer, and four tools: `bash`,
`git`, `python3`, and `curl`. The installer looks for the four tools first. It warns about
a missing one and carries on, so read its first lines. The whole page takes about ten
minutes, and most of that is `npm install`.

## Pick your stack name

getff installs into four npm [stacks](terms.md#stack). You type the name in the next
step, so pick the row that matches your project.

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

The [Introduction](index.md) says what each status word means. This page uses
`ts-server`. The steps are the same for `react-next` and `react-spa`. On `react-native`
the install works, but no custom rule is wired yet, so the red line in step 5 will not
appear.

## 1. Install

Clone getff anywhere, then run the installer from your project root.

```bash
git clone https://github.com/artyhoo/getff /tmp/rt
cd /your/project
bash /tmp/rt/setup -y --profile core ts-server
```

`-y` answers the prompts for you. `--profile core` asks for the smallest
[depth](terms.md#depth): the rules and their [gates](terms.md#gate). Name it, because
`-y` alone installs the larger `env` depth. To see the plan first and write nothing, run
the same line with `--dry-run` in place of `-y`. [Installation](installation.md#preview-first)
shows what that prints.

Near its end the installer checks its own work and prints this line:

```text
✓ self-verify: 3/3 checks passed — fences fire, shields wired (form check), generated tests non-vacuous
```

After it come `✅ Installation complete.`, a numbered list of next steps, a line about
`refresh-baseline.json`, a `▶ Companions` section that names each companion tool it
added or skipped, and a `▶ Runtime-bridge` section. On a machine without Docker that
last section says the daemon is not running. It is a note, not an error: our run exited
with code 0. Those lines are not shown here. The very last line of the run is:

```text
✅ ./setup complete (yes).
```

One thing to know before you run it. The installer also registers a documentation
server for your agent with `claude mcp add --scope user`. That setting is for your whole
machine, not only this project. The installer prints a warning line when it does this.

## 2. Check that the files landed

```bash
ls AGENTS.md .ai-factory/ scripts/
```

```text
AGENTS.md

.ai-factory/:
AI-USAGE-GUIDE.md
ARCHITECTURE.md
ARCHITECTURE.ts-server.md
DESCRIPTION.md
DESCRIPTION.template.md
RULES.md
orchestrator-prompts
refresh-baseline.json
rules
skill-context
tool-decisions.md

scripts/:
audit-ai-docs.sh
audit-r4.ts
check-arch-boundaries.sh
check-fences-fire.sh
check-lintstaged-resolves.sh
check-rule-enforced.sh
check-rule-globs.sh
check-shields-up.sh
ci-available-probe.sh
detect-r2-boundary.sh
fences-fire-fixtures
pre-merge-local.sh
r2-na-marker.sh
run-generated-rule-mutation.sh
run-rule-tests-firing.sh
```

`AGENTS.md` is what your agent reads first. `.ai-factory/RULES.md` lists the rules in
words. `scripts/` holds the checks you run below. If a file is missing, the install did
not finish. Run it again.

## 3. Describe your project

Open `.ai-factory/DESCRIPTION.md` and replace every `<PLACEHOLDER>`: what the project
does, its stack, its limits. `AGENTS.md` sends every new agent session to this file
first. Two minutes here pay off in every later session. You can do it after the quick
start. Do not skip it for good.

## 4. Prove the rules reach your files

A rule is scoped to folders. If your code lives somewhere else, the rule is installed
and looks at nothing. This check counts the files each rule can see:

```bash
bash scripts/check-rule-globs.sh
```

```text
▶ check-rule-globs: verifying custom-rule globs match real source files
  ✓ R2 no-unsafe-zod-parse (RULE_GLOBS.boundary): matches ≥1 root-governed source file
  · R7/R8 skipped (AIF_STRICT_RUNTIME≠1 — runtime-discipline rules are opt-in)
check-rule-globs: OK
```

On a brand-new project with no source files this check fails, and that is correct: no
file matches. Run it again once you have code. If it fails on a real project, widen
`RULE_GLOBS` in `eslint.config.mjs` to cover your folders.

Then prove that the rules can [fire](terms.md#fire) at all. This check feeds each rule a
small bad file and a small good one, in a temporary folder. It first prints three lines
that name paths on your machine. They are left out here. The rest is as printed:

```bash
bash scripts/check-fences-fire.sh
```

```text
  ✓ [no-unsafe-zod-parse] fence fires on bad input; good input passes — rules-as-tests/no-unsafe-zod-parse ACTIVE
  ✓ [require-use-server-directive] fence fires on bad input; good input passes — rules-as-tests/restricted-syntax-audit-exempt ACTIVE
  ✓ load-probe: placed eslint.config.mjs loads (imports resolve — real `eslint .` channel wired)

PASS=3 FAIL=0 SKIP=0
  fixture arm  (fence FIRING proof):   manifests=2 proved=2 failed=0 skipped=0
  load-probe arm (config IMPORTABLE):  ok=1 failed=0 skipped=0
```

## 5. Fire a rule on your own code

Now the real test. Pick a file in a folder that handles requests: `routes`, `handlers`,
`controllers`, `app/api`, or `actions`. Add this function to it:

```ts
import { z } from 'zod';

export function readName(input: unknown): string {
  return z.string().parse(input);
}
```

Run the linter:

```bash
npm run lint
```

```text
> ts-qs@1.0.0 lint
> eslint . --max-warnings=0


…/src/routes/users.ts
  8:10  error  Use `.safeParse()` instead of `.parse()` in HTTP boundaries — `.parse()` throws and bypasses structured error handling (R2)  rules-as-tests/no-unsafe-zod-parse

✖ 1 problem (1 error, 0 warnings)
```

The command exits with code 1. `ts-qs` is the name of our example project. The path is
shortened here to `…`; yours shows the full path to your file. One empty line before
the block and one after it are left out. The line names your file, the position, what to write instead, and
why. An agent that breaks this rule gets the same line and can fix the code by itself.

Remove the function, and the linter is green again. To keep the function, switch to
`.safeParse` and handle the failed case. [Stop a bad commit](learn/stop-a-bad-commit.md)
shows that fix in full.

## 6. Run the daily check

One more command. It compares what `AGENTS.md` claims with what is on disk:

```bash
bash scripts/audit-ai-docs.sh
```

The script prints one `PASS:` or `WARN:` line per check, then a rule. Only its last
line is shown here:

```text
Audit complete: 4 PASS, 0 FAIL, 2 WARN
```

Warnings are normal on a fresh project. Ours said that there is no `src/domain` folder
yet, and that `package.json` changed after the tool notes were written.

## What this did not prove

- **Two shipped rules are off by default.** The rules against direct time and randomness
  calls, and the one that requires tracing spans, only run when you set
  `AIF_STRICT_RUNTIME=1`. A default `npm run lint` stays green on `Math.random()`. The
  check in step 4 tells you so with its `skipped` line. To see one of them fire, add a
  file `src/dice.ts` that returns `Math.floor(Math.random() * 6) + 1` from a function,
  then run the linter with the switch on:

  ```bash
  AIF_STRICT_RUNTIME=1 npm run lint
  ```

  ```text
  > ts-qs@1.0.0 lint
  > eslint . --max-warnings=0


  …/src/dice.ts
    2:21  error  Use an injected Random source instead of `Math.random()` (R7)  rules-as-tests/no-direct-time-randomness

  ✖ 1 problem (1 error, 0 warnings)
  ```

  The command exits with code 1. The path is shortened to `…` as before, and one empty
  line before the block and one after it are left out. Without the switch, the same
  command on the same file printed no findings and exited with code 0.
- **One rule fired, not all of them.** You saw the one custom rule that every npm stack
  wires with no conditions. The rest of the rule pack is standard ESLint and
  TypeScript rules.
- **The starter rules are generic.** They come from a curated set, not from your
  codebase. Your agent can research rules for your exact stack: type `/rule-research`
  in Claude Code.

Next: [Installation](installation.md) covers every install path, the three depths, and
what each one writes.
