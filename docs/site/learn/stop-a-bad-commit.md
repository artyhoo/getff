---
title: Stop a bad commit
description: Write code that breaks a rule, watch the commit get refused, fix it, and watch the same commit go through.
kind: learn-tutorial
sources:
  - docs/site/quickstart-ts.md
  - docs/site/terms.md
  - docs/site/understand/why-a-rule-must-prove-it-fires.md
  - packages/core/eslint-rules/no-unsafe-zod-parse.ts
  - packages/core/templates/shared/.lintstagedrc.json
  - packages/core/templates/shared/husky-pre-commit.sh
  - setup.d/30-templates.sh
  - setup.d/lib.sh
  - templates/ts-server/github-actions-ci.yml
executed:
  - { example: commit-refused, stack: ts-server, date: 2026-09-21, result: exit-1 }
  - { example: commit-accepted, stack: ts-server, date: 2026-09-21, result: exit-0 }
---

# Stop a bad commit

In the [quick start](../quickstart-ts.md) you ran the linter by hand and saw a [rule](../terms.md#rule)
[fire](../terms.md#fire). That proves the rule works. It does not prove the rule
protects you, because nobody runs the linter by hand every time. An AI agent that writes
fifty files in an afternoon will not either.

In this tutorial you watch the rule fire with nobody asking it to. You try to commit
code that breaks it, and git refuses. Then you fix the code, and the same commit goes
through. It takes about ten minutes. At the end you will know what a
[gate](../terms.md#gate) feels like from the inside.

You need a `ts-server` project with getff installed and the install committed. If you
do not have one, do the [quick start](../quickstart-ts.md) first.

## Steps

1. Add an endpoint helper that trusts its input. Put this in `src/routes/create-user.ts`:

   ```ts
   import { z } from 'zod';

   const NewUser = z.object({ name: z.string().min(1) });

   export function createUser(body: unknown): string {
     const user = NewUser.parse(body);
     return user.name;
   }
   ```

   The code compiles and looks fine. The problem is `.parse()`. On bad input it throws,
   and in a request handler a throw turns into a 500 with no useful message. The team
   [convention](../terms.md#convention) here is to call `.safeParse()` and handle the
   failure. This is exactly the kind of slip an agent makes: correct-looking, and wrong
   for this codebase.

2. Try to commit it.

   ```bash
   git add src/routes/create-user.ts
   git commit -m "feat: create user"
   ```

   Git does not create the commit. First you see a list of progress lines, one of them
   marked `[FAILED]`. Then the output ends like this. These are the last lines exactly
   as printed, with one change: the long path to the file is cut to `…`.

   ```text
   [STARTED] Reverting to original state because of errors...
   [COMPLETED] Reverting to original state because of errors...
   [STARTED] Cleaning up temporary files...
   [COMPLETED] Cleaning up temporary files...

   ✖ eslint --fix --max-warnings=0 --no-warn-ignored:

   …/src/routes/create-user.ts
     6:16  error  Use `.safeParse()` instead of `.parse()` in HTTP boundaries — `.parse()` throws and bypasses structured error handling (R2)  rules-as-tests/no-unsafe-zod-parse

   ✖ 1 problem (1 error, 0 warnings)
   ```

   Read the error line. It names the file, the line, and the column. It says what to do
   instead, and why. The `(R2)` at the end is the rule's number in your project's
   `.ai-factory/RULES.md`. That message is written for whoever broke the rule. If that was an agent,
   the agent reads the same line and can fix the code without asking you.

3. Check that nothing was committed.

   ```bash
   git log --oneline -1
   ```

   ```text
   ad44471 chore: install getff
   ```

   Your last commit is still the install, and your hash will differ. The change is
   still staged, waiting for a fix.

4. Fix the code the way the message says. Replace the function with:

   ```ts
   export function createUser(body: unknown): string | null {
     const result = NewUser.safeParse(body);
     if (!result.success) {
       return null;
     }
     return result.data.name;
   }
   ```

5. Commit again, with the same command.

   ```bash
   git add src/routes/create-user.ts
   git commit -m "feat: create user"
   ```

   These are the last lines of the output, exactly as printed:

   ```text
   [COMPLETED] Running tasks for staged files...
   [STARTED] Applying modifications from tasks...
   [COMPLETED] Applying modifications from tasks...
   [STARTED] Cleaning up temporary files...
   [COMPLETED] Cleaning up temporary files...
   [replay3 425bf41] feat: create user
    1 file changed, 11 insertions(+)
    create mode 100644 src/routes/create-user.ts
   ```

   The gate ran again, found nothing, and let the commit through. Your branch name and
   commit hash will differ.

## What you built

You have a project where one convention cannot be broken by accident. You did not run a
check. The check ran because you committed, and it would have run the same way for a
teammate or an agent.

Three things made that happen, and the installer set up all three:

- A git hook at `.husky/pre-commit` that runs on every commit.
- A short list in `.lintstagedrc.json` that says which tool runs on which staged files.
- The rule itself, a small ESLint rule shipped into `eslint-rules-local/`.

The pre-commit hook is one [channel](../terms.md#channel) of several. It is fast because
it looks only at staged files. It is also the easiest one to skip: `git commit
--no-verify` walks past it. That is why the installer also writes a CI workflow,
`.github/workflows/ci.yml`, that runs `npm run lint`. It runs on pushes to
your default branch and on pull requests into it. The installer reads that branch from
your git remote and writes `main` if it finds none. A skipped hook is caught there. If
your team also merges into another branch, such as `develop`, add that branch to the
workflow's `on:` block, or nothing catches the skip there. A rule that matters sits on more than one channel.

Next, read [Why a rule must prove it fires](../understand/why-a-rule-must-prove-it-fires.md).
It explains how getff checks that a rule like this one is still switched on, and where
that check stops.
