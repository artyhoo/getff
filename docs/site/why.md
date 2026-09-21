---
title: Why getff
description: The problem getff solves, how it solves it, the proof you can run yourself, and where it stops.
kind: face-page
sources:
  - .claude/rules/no-paid-llm-in-ci.md
  - AGENTS.md
  - CLAUDE.md
  - LICENSE.md
  - README.md
  - docs/meta-factory/prior-art-evaluations.md
  - docs/site/face-facts.json
  - docs/site/foundations.md
  - docs/site/how-it-works.md
  - docs/site/index.md
  - docs/site/quick-start.md
  - docs/site/terms.md
  - packages/core/composition/demo/root-agents-demo.test.ts
  - packages/core/manifest/maturity.json
  - packages/core/principles/17-no-paid-llm-in-ci.test.ts
  - skills/getff/references/ai-traps.md
docs-refresh: deferred — re-verified 2026-09-21, the cited register only gained rows 284-286; counts are renderer-owned and no prose here depends on row content; clears at the next gold refresh of this page
executed:
  - { step: demo-region-green, stack: repo, date: 2026-09-21, result: "exit-0, 9 tests passed" }
  - { step: demo-region-flipped-line, stack: repo, date: 2026-09-21, result: "exit-1, 2 tests failed, diff names the line" }
next: how-it-works.md
---

# Why getff

Your team has conventions. Some are written down, in a `CLAUDE.md` or an `AGENTS.md` or
a wiki page. Most are not. A person learns them in code review over a few months. An AI
agent never does. It starts every session knowing nothing about your team, and it writes
code that looks right and quietly breaks the rules nobody wrote down.

getff turns each [convention](terms.md#convention) into something that fails when it is
broken. This page makes the case for that, shows proof you can run, and says where the
idea stops working.

## The pain

**Written rules are read, not enforced.** An instruction file is text the agent takes
in at the start of a session. Nothing checks the code against it afterwards. The agent
follows the file while it is fresh and drifts as the session grows. The project that
became getff saw this in its own work. Its README puts it plainly: conventions in
`CLAUDE.md` are forgotten within three sessions.

**The escape hatches creep back.** An agent that meets a type error takes the shortest
way out: `as any`, a `!`, a `@ts-ignore`. Each one is small and reasonable-looking in
review. When an agent breaks a rule, it breaks it the same way in every file it touches
that day.

**The tests agree with the code because the same author wrote both.** An agent asked
for tests often runs the code, takes whatever came out, and asserts that. The test
passes. It will keep passing when the code is wrong, because it never stated what right
looks like. Types pass, lint passes, tests pass, and the code is still wrong.

Code review does not fix this. People cannot read at the speed an agent writes.

## The mechanism

Every convention becomes a [rule](terms.md#rule): a lint rule, a git hook check, a test,
or a documentation check. A rule that is broken fails, and it fails at the earliest
[channel](terms.md#channel) that can see the problem:

```text
edit-time → pre-commit → pre-push → CI → production audit
```

CI is the last resort. A rule that only fails in CI has already cost you a push, a wait,
and a context switch. The same rule at commit time costs seconds, and the agent reads
the error and fixes its own code.

Two design choices follow from this:

- **The rules use your tools.** ESLint, Ruff, ast-grep, Clippy, golangci-lint. getff
  adds no runtime and no server.
- **No AI model sits in the loop.** Every [gate](terms.md#gate) is a deterministic
  program. Nothing in CI calls a paid model, so the checks cost nothing to run and give
  the same answer twice. That is itself a rule with a test:
  `packages/core/principles/17-no-paid-llm-in-ci.test.ts` fails the build if a workflow
  starts calling one.

[How it works](how-it-works.md) shows the pieces.

## The proof

A claim about enforcement should be checkable, so getff applies its own idea to its own
documentation. The `AGENTS.md` at the root of the getff repository has regions that are
generated from rule definitions. Each rule line ends with an `Enforced:` line that says
which backends can enforce that rule today. This is one, exactly as it stands in the
file:

<!-- vale off -->
<!-- vale-reason: quoted verbatim from AGENTS.md; the backend identifiers are not prose -->
<!-- getff:begin section=face-enforced-line plan=scripts/render-face-facts.mjs -->
```text
> Enforced: astgrep-python-yaml ✅ · cargo-clippy-toml — FF7001 (not expressible in clippy.toml; route to the ast-grep escape-hatch backend (post-v0)) · npm-eslint-declarative — FF7002 (params contract violation: missing/invalid selector) · ruff-tidy-imports-toml — FF7001 (call-with-args ban not expressible in ruff (bans a qualified name, not a call site); route to the ast-grep backend (#212))
```
<!-- getff:end section=face-enforced-line -->
<!-- vale on -->

Read it as a status report that cannot flatter. One backend enforces the rule. Three
cannot, and each says why with an error code.

Now the test. A documentation line like this is exactly the kind of thing that rots: one
day someone edits it to say `✅` where the truth is `FF7001`. We did that on purpose. In
a working copy of the getff repository, we changed `cargo-clippy-toml — FF7001 (…)` to
`cargo-clippy-toml ✅` in that line and ran the check that guards the region:

```bash
cd packages/core
npx vitest run composition/demo/root-agents-demo.test.ts
```

Before the edit, it passed: `Tests  9 passed (9)`. After the edit, it failed with exit
code 1. This is the part of the output that names the problem. Long lines are cut at
the right edge, marked `…`. Nothing else is changed.

```text
- Expected
+ Received

@@ -3,10 +3,10 @@

  ### Time handling

  Use an injected clock, not datetime.datetime.now() directly
  <!-- @nodes: no-datetime-now -->
- > Enforced: astgrep-python-yaml ✅ · cargo-clippy-toml — FF7001 (not expressible in clippy.toml; route to the ast-grep escape-hatch backend (post-v0)) · …
+ > Enforced: astgrep-python-yaml ✅ · cargo-clippy-toml ✅ · npm-eslint-declarative — FF7002 (params contract violation: missing/invalid selector) · ruf…
  > Never (fires): import datetime
  x = datetime.datetime.now()
  > Always (clean): x = clock.now()
```

The document lied for a few seconds, and a test caught it and printed the line. In the
getff repository that test runs in CI on every pull request. We put the line back.

The same habit runs through the rest of the project. These are counted from the
repository, not typed:

<!-- getff:begin section=face-counts plan=scripts/render-face-facts.mjs -->
| What | Count | Where |
|---|---|---|
| Tests that enforce the project's own principles | 50 | `packages/core/principles/` |
| Build-or-reuse decisions on record | 282 | `docs/meta-factory/prior-art-evaluations.md` |
| Research patches, one per gap found | 272 | `docs/meta-factory/research-patches/` |
| Design specs | 87 | `docs/superpowers/specs/` |
<!-- getff:end section=face-counts -->

To see a rule stop your own code, not ours, take the ten-minute
[quick start](quick-start.md).

## Honest limits

- **The self-enforcing `AGENTS.md` is ours, not yours yet.** The generated regions with
  `Enforced:` lines exist in the getff repository. An install gives your project an
  `AGENTS.md`, rules, and gates. It does not yet generate those regions from your rules.
- **Most conventions are still yours to encode.** getff ships a small set of rules per
  [stack](terms.md#stack) and the tooling to add more. It does not read your team's mind.
- **The stacks are not equally finished.** `ts-server` and `react-next` are beta.
  `react-spa` is early and `react-native` is experimental. `python`, `cargo`, and `go`
  are alpha. The [Introduction](index.md#honest-status) says what each label means.
- **A rule proves what it checks and nothing more.** Green gates mean no known
  convention was broken. They say nothing about conventions nobody has written a rule
  for.
- **getff is source-available, not open source.** The license is FSL-1.1-ALv2. You can
  use it, change it, and ship products built with it. You cannot offer it as a competing
  product. Each release becomes Apache 2.0 on its second anniversary.

## When you do not need it

If no AI agent writes code in your repository, and your team is small and stable, code
review and a standard linter may be enough. getff earns its keep when code arrives
faster than people can review it.

## What this stands on

None of the parts are new. Treating architecture rules as tests, specification by
example, living documentation, mutation testing, and shifting checks left each have
decades of practice behind them. What getff adds is the combination, aimed at one
problem: an author that never remembers. [Foundations](foundations.md) names each source
and says what was taken from it.

Next: [How it works](how-it-works.md).
