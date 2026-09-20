---
title: Why a rule must prove it fires
description: A rule that is installed and a rule that works are different things. This page explains how getff tells them apart, and where that proof stops.
kind: understand
sources:
  - docs/site/learn/stop-a-bad-commit.md
  - docs/site/terms.md
  - install.sh
  - packages/core/audit-self/check-fences-fire.sh
  - packages/core/audit-self/check-rule-enforced.sh
  - packages/core/audit-self/check-rule-globs.sh
  - setup.d/99-finalize.sh
executed:
  - { example: fences-fire-green, stack: ts-server, date: 2026-09-21, result: exit-0 }
  - { example: rule-globs, stack: ts-server, date: 2026-09-21, result: exit-0 }
  - { example: rule-off-not-noticed, stack: ts-server, date: 2026-09-21, result: exit-0 }
---

# Why a rule must prove it fires

A linter that reports nothing looks the same in two very different cases. In the first,
your code is clean. In the second, the [rule](../terms.md#rule) is not running at all.
Both print nothing. Both exit with zero. Both show a green check in CI.

The second case is common, and it is quiet. A rule is scoped to `src/routes/`, and your
project keeps its handlers in `app/api/`. A plugin fails to load, and the config falls
back without it. A package in a monorepo has its own config that shadows the root one.
In each case the rule is installed, listed, and documented, and it guards nothing. You
find out months later, when the mistake it was meant to catch is already in production.

This matters more when an AI agent writes the code. A person who knows the convention
follows it even with the linter off. An agent follows what is checked. If the check is
inert, the convention is only a sentence again.

So getff treats "the rule is installed" as a claim, not a fact. A claim needs proof.

## Mechanism

The proof is a [self-check](../terms.md#self-check), and it has a simple shape: feed the
rule something bad on purpose and watch it go [red](../terms.md#red-and-green). Then
feed it something good and watch it stay green. Red alone is not enough, because a rule
that fails on everything is as useless as one that fails on nothing.

getff installs three checks of this kind into your project. Each answers one question.

**Does the rule fire at all?** `scripts/check-fences-fire.sh` takes a small bad file and
a small good file for each shipped rule. It runs the real ESLint on both, in a temporary
folder. The bad file must produce the rule's error. The good file must produce none.

**Does the rule reach your files?** `scripts/check-rule-globs.sh` takes the file
patterns each rule is scoped to and counts how many of your source files match. Zero
matches means the rule is installed and looking at nothing. The check fails, and tells
you which pattern to change.

**Does your config carry the rule?** `scripts/check-rule-enforced.sh` asks ESLint for the
final, resolved config of a real file in your project. It fails if the rule is missing
from it. This is the check that catches the shadowed monorepo package.

When you install with `./setup -y`, the installer runs the first check on itself before
it reports success. It needs the project's dependencies to do that. Without them it says
the check was skipped, and it does not claim a pass. A bare `install.sh` run does not
self-check at all. All three checks are part of `npm run validate`, so they run again
whenever you validate the project.

## Proof

This is the first check on a fresh `ts-server` install. The output is exactly as
printed, with two changes: two opening lines that only print tool paths are left out,
and the long path in the first line shown is cut to `…`.

```bash
bash scripts/check-fences-fire.sh
```

```text
▶ check-fences-fire: probing 2 fence(s) from …/scripts/fences-fire-fixtures
  ✓ [no-unsafe-zod-parse] fence fires on bad input; good input passes — rules-as-tests/no-unsafe-zod-parse ACTIVE
  ✓ [require-use-server-directive] fence fires on bad input; good input passes — rules-as-tests/restricted-syntax-audit-exempt ACTIVE
  ✓ load-probe: placed eslint.config.mjs loads (imports resolve — real `eslint .` channel wired)

PASS=3 FAIL=0 SKIP=0
  fixture arm  (fence FIRING proof):   manifests=2 proved=2 failed=0 skipped=0
  load-probe arm (config IMPORTABLE):  ok=1 failed=0 skipped=0
```

Each green line here stands for a red one you do not see. "Fires on bad input" means
the bad file produced an error, and the script matched that error to this rule's name.
A crash, or an error from some other rule, does not count as firing.

And this is the second check, on the same project:

```bash
bash scripts/check-rule-globs.sh
```

```text
▶ check-rule-globs: verifying custom-rule globs match real source files
  ✓ R2 no-unsafe-zod-parse (RULE_GLOBS.boundary): matches ≥1 root-governed source file
  · R7/R8 skipped (AIF_STRICT_RUNTIME≠1 — runtime-discipline rules are opt-in)
check-rule-globs: OK
```

Note the third line. Two rules are off by default, and the check says so. It does not
count them as passing. A check that was skipped is reported as skipped.

To watch a rule fire in your own project instead of a test folder, do the tutorial
[Stop a bad commit](../learn/stop-a-bad-commit.md).

## Limits

These checks prove less than their names suggest. We tested the edges, and you should
know where they are.

**The firing check tests the shipped rule, not your config.** It runs in a temporary
folder with its own setup. We turned the rule off in the project's own
`eslint.config.mjs` and ran the check again. It still printed `ACTIVE` and exited with
zero. It proves the rule can fire on your machine. It does not prove the rule is
switched on in your project.

**The config check looks for the rule's name, not its level.** With the rule set to
`off`, `check-rule-enforced.sh` still reported it as applied, because a rule that is
turned off is still named in the resolved config. We measured this on 2026-09-21. Today,
the thing that notices a rule switched off is a person reading the config diff in review.

**A self-check proves the rule, not your code.** Green means the rule works. It says
nothing about whether the rule is the right one, or whether your team has conventions
that no rule covers yet.

**Only the npm stacks get all three.** The `python`, `cargo`, and `go` lanes run their
own firing check at install time, with their native linters. The other two checks are
ESLint-specific.
