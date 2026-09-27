---
title: check-doc-authority-header hook
description: Your project's rules and skills must each say what they are authoritative for. This hook is the checker that ships to consumer installs — pure bash, and it tells the agent exactly how to fix a missing header.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/check-doc-authority-header.sh
  - .claude/rules/doc-authority-hierarchy.md
  - .claude/rules/zcode-parity-doctrine.md
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/reference/D/check-doc-authority.md
  - docs/site/terms.md
  - packages/core/hooks/check-doc-authority-header.test.ts
  - plugin/hooks/hooks.json
  - setup.d/10-skills.sh
executed:
  - { example: doc-authority-header-green-on-a-scoped-doc, stack: repo, date: 2026-09-25, result: silent }
  - { example: doc-authority-header-red-on-a-headerless-rule, stack: repo, date: 2026-09-25, result: printed }
  - { example: doc-authority-header-exempt-line-silences-the-gate, stack: repo, date: 2026-09-25, result: silent }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# check-doc-authority-header hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-check-doc-authority-header plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `check-doc-authority-header` |
| kind | hook |
| ships-to | framework: react-native, react-next, react-spa, ts-server |
| description | PostToolUse gate — zero-dep consumer reimplementation of the doc-authority header check |
| source | `.claude/hooks/check-doc-authority-header.sh:2` |
| event | `["PostToolUse"]` |
| matcher | `["Edit|Write|MultiEdit"]` |
| delivery | `["@cc-only-rationale","plugin"]` |
<!-- getff:end section=D-card-check-doc-authority-header -->

<!-- vale on -->

## Explanation

When getff installs into your project, it brings a convention with it: a doc that
carries authority says so. Any file you author under `.claude/rules/` or as a skill's
`SKILL.md` should open with a `> **Authoritative for:**` line naming its scope. This
[gate](../../terms.md#gate) is what checks that in your project — it is the
consumer-shippable twin of the framework's own
[check-doc-authority](check-doc-authority.md), rewritten to need nothing but bash and
`jq`, because the framework version depends on a toolchain your project does not have.

It watches two surfaces — the two a consumer plausibly authors: `.claude/rules/*.md`
and `.claude/skills/*/SKILL.md`. Edit one and the hook looks for the header line,
ignoring anything inside code fences so an example header in documentation does not
count as the real thing. Here it is passing on a real rule file:

```bash
printf '%s' '{"tool_name":"Edit","session_id":"docs-demo-dah-1",
  "tool_input":{"file_path":"'$PWD'/.claude/rules/ai-laziness-digest.md"}}' \
  | bash .claude/hooks/check-doc-authority-header.sh
```

```text
(nothing — exit 0)
```

And failing on a file that has no header:

```bash
printf '%s\n' '# A rule file with no authority header.' '# Body text.' \
  > .claude/rules/zz-red-demo.md
printf '%s' '{"tool_name":"Write","session_id":"docs-demo-dah-2",
  "tool_input":{"file_path":"'$PWD'/.claude/rules/zz-red-demo.md"}}' \
  | bash .claude/hooks/check-doc-authority-header.sh
```

```text
✗ doc-authority: .claude/rules/zz-red-demo.md is missing the "> **Authoritative for:**" header.
  Add it (see .claude/rules/doc-authority-hierarchy.md §3), OR exempt this file with a
  <!-- doc-authority: exempt <reason 20+ chars> --> line, OR set AIF_DOC_AUTHORITY=0 to disable.
```

The exit code is 2 — the PostToolUse [channel](../../terms.md#channel) the model
receives — and the message is the whole repair manual: add the header, exempt the
file, or turn the gate off. The exemption is deliberately not a loose bolt. It is a
single HTML comment carrying a reason of at least twenty characters, and writing one
into the demo file silences the gate:

```bash
printf '%s\n' '# A rule file with no authority header.' \
  '<!-- doc-authority: exempt demo fixture — exercises the per-file escape hatch, not a real rule -->' \
  > .claude/rules/zz-red-demo.md
printf '%s' '{"tool_name":"Write","session_id":"docs-demo-dah-3",
  "tool_input":{"file_path":"'$PWD'/.claude/rules/zz-red-demo.md"}}' \
  | bash .claude/hooks/check-doc-authority-header.sh
```

```text
(nothing — exit 0)
```

A skip here never pretends to be a pass. If `jq` is missing — the stock-macOS case the
source names — the hook announces «the authority-header check DID NOT RUN for this
edit (and will not run this session)» once per session, only when the edited path is
actually in scope, so a dead gate stops reading as a live one. Delete the demo file
when you are done.

Two facts about delivery, both on the card: the hook ships to consumer projects —
your install copies it and registers it (`setup.d/10-skills.sh:380-389`), which is why
its ships-to row names real stacks — and it reaches the plugin [channel](../../terms.md#channel)
too, where the framework itself deliberately does not run it: the framework dogfoods
the delegate-based original, and running the reimplementation on its own repo would be
a second [twin](../../terms.md#twin) enforcing the same line twice.

## Evidence

- `.claude/hooks/check-doc-authority-header.sh:2` is the header the card's description
  row quotes: `# check-doc-authority-header.sh — PostToolUse gate — zero-dep consumer reimplementation of the doc-authority header check`. Lines 5-7 carry the
  `@cc-only-rationale` marker and the reason: the framework-internal original «delegates
  to tsx + packages/core and is a DEAD no-op in every consumer».
- Scope: lines 73-76 match `^\.claude/rules/[^/]+\.md$` and
  `^\.claude/skills/[^/]+/SKILL\.md$` — the comment (lines 71-72) calls this the
  consumer-authored subset of the rule's surfaces.
- Header check: line 92 strips fenced code blocks with an awk fence toggle, line 93
  greps `^> \*\*Authoritative for:\*\*`; the comment (lines 87-91) explains why an
  example header inside a fence must not count.
- Exemption: line 83 greps `<!--[[:space:]]*doc-authority:[[:space:]]*exempt[[:space:]]+.{20,}-->`
  — a single line, reason at least twenty characters (lines 19-20).
- Exit posture: lines 16-21 record the maintainer decision (default-on gate, exit 2)
  and both escape valves; line 29 is the `AIF_DOC_AUTHORITY=0` repo-wide opt-out.
- jq-less degradation: lines 31-40 explain the once-per-session, in-scope-only notice —
  «a dead gate stops passing for a live one»; the notice text is line 51.
- Exit 2 is lines 115-116 after the message is built at lines 108-110; under a
  schema-bound harness the same diagnostic goes out as JSON `additionalContext` and
  exit 0 (lines 100-107, 111-114) — post-mutation gates cannot block there, so advisory
  is the best available mechanism.
- Consumer install: `setup.d/10-skills.sh:380-389` copies the hook into the project and
  calls `register_cc_hook` with the `Edit|Write|MultiEdit` matcher.
- Plugin registration only: `plugin/hooks/hooks.json:72` registers the twin; the
  framework's own `.claude/settings.json` does not —
  `.claude/rules/zcode-parity-doctrine.md` §2 row 3 records the flip to `parity` and
  the PLUGIN_INTERNAL_HOOKS decision («the framework must not run the consumer
  reimplementation on itself»).
- Paired test: `packages/core/hooks/check-doc-authority-header.test.ts` — its header
  (lines 1-13) states the contract: non-scoped path or wrong tool → exit 0 silent,
  scoped doc with the header → exit 0, scoped doc without it under CC → exit 2 plus
  stderr.
