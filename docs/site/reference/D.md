---
title: Hooks
description: Every hook getff can put in your project, the moment each one fires, and how to read its fact card before you trust it with your edits.
kind: family-overview
generator: scripts/render-reference.mjs
sources:
  - .claude/settings.json
  - docs/site/reference/D.json
  - docs/site/reference/D/adopt-orchestrator-prompts.md
  - docs/site/reference/D/ask-question-reminder.md
  - docs/site/reference/D/check-doc-authority-header.md
  - docs/site/reference/D/check-doc-authority.md
  - docs/site/reference/D/check-hook-marker.md
  - docs/site/reference/D/check-kickoff-traps.md
  - docs/site/reference/D/check-worker-dispatch-channel.md
  - docs/site/reference/D/deps-hash-check.md
  - docs/site/reference/D/end-of-turn-reminder.md
  - docs/site/reference/D/glossary-inject.md
  - docs/site/reference/D/inject-handoff-on-compact.md
  - docs/site/reference/D/inject-matching-rule.md
  - docs/site/reference/D/inject-memory-codification.md
  - docs/site/reference/D/inject-output-language.md
  - docs/site/reference/D/inject-project-digest.md
  - docs/site/reference/D/inject-session-bootstrap.md
  - docs/site/reference/D/inject-subagent-context.md
  - docs/site/reference/D/inject-subagent-digest.md
  - docs/site/reference/D/precompact-residue.md
  - docs/site/reference/D/runtime-bridge-dispatch.md
  - docs/site/reference/D/session-start.md
  - docs/site/reference/D/validate-prompt.md
  - docs/site/reference/D/warn-subagent-report-zcode.md
  - docs/site/reference/D/warn-subagent-report.md
  - docs/site/reference/D/worktree-setup.md
  - docs/site/terms.md
  - plugin/hooks/hooks.json
  - scripts/render-reference.mjs
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# Hooks

Hooks are how getff gets a small script between your agent and its own habits.
Each one fires at a fixed moment — an edit lands, a prompt is submitted, a
session starts — and does one small job: hand the agent the rule that matches
the file it just touched, check the header it just wrote, or remind it of the
goal before it wanders. This page lists every hook, so you can find the one you
need or check what an install gave you.

## Common cases

The table below is built by a script from the hook files themselves. Nobody
types it.

<!-- vale off -->
<!-- vale-reason: the table quotes each hook's own header line and registration JSON verbatim, including delivery markers -->

<!-- getff:begin section=D-table plan=scripts/render-reference.mjs -->
| Hook | Events | What it does | Delivery | Ships-to |
|---|---|---|---|---|
| `adopt-orchestrator-prompts` | not registered (unregistered) | PostToolUse: adopt a new orchestrator-prompt | @cc-only-rationale | not installed on any lane (no-lane) |
| `ask-question-reminder` | PreToolUse | PreToolUse:AskUserQuestion hook — pre-question fork-challenge nudge (consumer-safe session UX) | @dual-pair:hook-lang-i18n (spec: docs/superpowers/specs/2026-06-01-hook-lang-i18n-design.md) + @cc-only-rationale + plugin | framework: react-native, react-next, react-spa, ts-server |
| `check-doc-authority` | PostToolUse | PostToolUse gate — principle-09 doc-authority header quick-check (delegates to the 09 bin) | @cc-only-rationale + plugin | not installed on any lane (no-lane) |
| `check-doc-authority-header` | PostToolUse | PostToolUse gate — zero-dep consumer reimplementation of the doc-authority header check | @cc-only-rationale + plugin | framework: react-native, react-next, react-spa, ts-server |
| `check-hook-marker` | PostToolUse | PostToolUse gate — delivery-channel marker + strict header grammar on touched hook files | @cc-only-rationale + plugin | not installed on any lane (no-lane) |
| `check-kickoff-traps` | PostToolUse | PostToolUse gate — kickoff T-enumeration floor (ai-laziness-traps §3) | @cc-only-rationale + plugin | not installed on any lane (no-lane) |
| `check-worker-dispatch-channel` | PostToolUse | PostToolUse gate — edit-time channel for #worker-dispatch-via-subagent | @dual-pair:channel-discipline-worker-dispatch + @cc-only-rationale + plugin | not installed on any lane (no-lane) |
| `deps-hash-check` | UserPromptSubmit | UserPromptSubmit hook — per-stack declared-deps staleness detector (package.json/pyproject.toml/Cargo.toml) | @dual-pair:deps-hash-check-dogfood + plugin | framework: python, react-native, react-next, react-spa, ts-server |
| `end-of-turn-reminder` | Stop | Stop hook — end-of-turn recap + goal-drift verdict reminder | @dual-pair:hook-lang-i18n (spec: docs/superpowers/specs/2026-06-01-hook-lang-i18n-design.md) + @cc-only-rationale + plugin | framework: react-native, react-next, react-spa, ts-server |
| `glossary-inject` | not registered (unregistered) | UserPromptSubmit hook: glossary injection + usage counter (plain-words-recap-v2 D-F). | @cc-only-rationale + plugin | not installed on any lane (no-lane) |
| `inject-handoff-on-compact` | SessionStart | SessionStart:compact hook — re-injects the model-authored handoff after compaction | @cc-only-rationale | not installed on any lane (no-lane) |
| `inject-matching-rule` | PostToolUse | PostToolUse hook — path-scoped just-in-time delivery of .claude/rules/*.md summaries | @dual-pair:rule-path-scoping + plugin | framework: python, react-native, react-next, react-spa, ts-server |
| `inject-memory-codification` | PostToolUse | PostToolUse hook — path-scoped codify-then-pointer discipline reminder | @dual-pair:memory-codification-writemoment + plugin | framework: react-native, react-next, react-spa, ts-server |
| `inject-output-language` | UserPromptSubmit | UserPromptSubmit hook — injects the active output-language line into prompt context | @cc-only-rationale + plugin | framework: react-native, react-next, react-spa, ts-server |
| `inject-project-digest` | SubagentStart, UserPromptSubmit | UserPromptSubmit + SubagentStart hook — injects the project digest at both fire-points | @cc-only-rationale + plugin | framework: react-native, react-next, react-spa, ts-server |
| `inject-session-bootstrap` | UserPromptSubmit | UserPromptSubmit hook — injects the session-bootstrap digest into prompt context | @cc-only-rationale + plugin | not installed on any lane (no-lane) |
| `inject-subagent-context` | PreToolUse | SubagentStart fallback — digest injection for harnesses without the SubagentStart event (zcode) | @cc-only-rationale + plugin | not installed on any lane (no-lane) |
| `inject-subagent-digest` | SubagentStart | SubagentStart hook — injects the session-bootstrap digest into juniors at spawn | @cc-only-rationale | not installed on any lane (no-lane) |
| `precompact-residue` | PreCompact | PreCompact hook — writes the session-residue note before compaction | @dual-pair:hook-lang-i18n (spec: docs/superpowers/specs/2026-06-01-hook-lang-i18n-design.md) + @cc-only-rationale | not installed on any lane (no-lane) |
| `runtime-bridge-dispatch` | PostToolUse, PostToolUseFailure | PostToolUse hook — runtime-bridge dispatch for meta-launch kickoffs | @cc-only-rationale + plugin | not installed on any lane (no-lane) |
| `session-start` | SessionStart | Plugin SessionStart hook — injects the getff entry-point context so the using-getff skill auto-triggers | @cc-only-rationale + plugin | plugin |
| `validate-prompt` | PostToolUse | PostToolUse gate — validates the batch-spec section on orchestrator-prompts kickoff edits | @cc-only-rationale + plugin | not installed on any lane (no-lane) |
| `warn-subagent-report` | SubagentStop | SubagentStop hook — warns when a finishing report misses its canonical sections (non-blocking) | @cc-only-rationale | not installed on any lane (no-lane) |
| `warn-subagent-report-zcode` | PostToolUse, Stop | ZCode-functional twin of .claude/hooks/warn-subagent-report.sh | @dual-pair:warn-subagent-report + plugin | plugin |
| `worktree-setup` | not registered (unregistered) | WorktreeCreate hook — provisions a new worktree with node_modules symlinks | @dual-pair:worktree-create-setup | not installed on any lane (no-lane) |
<!-- getff:end section=D-table -->

<!-- vale on -->

Each hook gets its own page with a [fact card](../terms.md#fact-card), a plain
explanation, and the files that prove each fact. They group by the job they do:

- **Inject the right context at the right moment:**
  [inject-matching-rule](D/inject-matching-rule.md),
  [inject-memory-codification](D/inject-memory-codification.md),
  [inject-output-language](D/inject-output-language.md),
  [inject-project-digest](D/inject-project-digest.md),
  [inject-session-bootstrap](D/inject-session-bootstrap.md),
  [inject-subagent-context](D/inject-subagent-context.md),
  [inject-subagent-digest](D/inject-subagent-digest.md),
  [inject-handoff-on-compact](D/inject-handoff-on-compact.md),
  [glossary-inject](D/glossary-inject.md)
- **Check your edits as you make them:**
  [check-doc-authority](D/check-doc-authority.md),
  [check-doc-authority-header](D/check-doc-authority-header.md),
  [check-hook-marker](D/check-hook-marker.md),
  [check-kickoff-traps](D/check-kickoff-traps.md),
  [check-worker-dispatch-channel](D/check-worker-dispatch-channel.md),
  [validate-prompt](D/validate-prompt.md)
- **Nudge at the turn boundaries:**
  [ask-question-reminder](D/ask-question-reminder.md),
  [end-of-turn-reminder](D/end-of-turn-reminder.md),
  [warn-subagent-report](D/warn-subagent-report.md),
  [warn-subagent-report-zcode](D/warn-subagent-report-zcode.md)
- **Manage sessions, dependencies, and worktrees:**
  [adopt-orchestrator-prompts](D/adopt-orchestrator-prompts.md),
  [deps-hash-check](D/deps-hash-check.md),
  [precompact-residue](D/precompact-residue.md),
  [runtime-bridge-dispatch](D/runtime-bridge-dispatch.md),
  [session-start](D/session-start.md),
  [worktree-setup](D/worktree-setup.md)

**See which moments your project wires hooks to.** Every registration lives in
one of two registries: your project's `.claude/settings.json`, or the getff
plugin's own `hooks.json`. Ask yours:

```bash
jq -r '.hooks | keys[]' .claude/settings.json
```

In the getff repository itself:

```text
PostToolUse
PostToolUseFailure
PreCompact
PreToolUse
SessionStart
Stop
SubagentStart
SubagentStop
UserPromptSubmit
```

Each name is a moment a hook can [fire](../terms.md#fire) on — `PostToolUse`
is right after a tool call, `UserPromptSubmit` is when you send a message. A
hook page whose event row reads `not registered (unregistered)` is wired to no
registry on purpose; its page says why it ships anyway.

## When not to reach for this family

A hook acts at the moment it fires, on the input that moment carries. It
cannot teach your agent a way of working — that is a
[skill](../terms.md#skill). And a hook is not the discipline itself: when a
[convention](../terms.md#convention) must hold, write a
[rule](../terms.md#rule) with a [gate](../terms.md#gate); a hook is one
[channel](../terms.md#channel) that carries the rule to the agent, not the
message.

Most hooks in this family never install into your project. The table marks
them `not installed on any lane` — the getff team runs them on its own
repository, and your install copies nothing ([lane](../terms.md#lane)). The
`Ships-to` row on each page says which kind you are looking at, so read it
before you go looking for the file.

Two members live only on the plugin [channel](../terms.md#channel):
[session-start](D/session-start.md) and
[warn-subagent-report-zcode](D/warn-subagent-report-zcode.md). Without the
getff plugin installed they have nothing to run from.

Do not assume a green hook means a guard is awake. Some of these hooks are
gates that can block an edit; most only inject advice and always exit 0. The
page for each hook says which, and its Evidence band names the lines that
prove it.

## How to read a fact card

Every hook page opens with the same rows. The ones that need a word:

- **ships-to** uses the same lane wording as the table: either the stacks your
  install copies the hook to, or `not installed on any lane`.
- **event** is the moment the hook fires — one of the names the command above
  prints. `not registered (unregistered)` means no registry wires it up.
- **matcher** narrows the moment to specific tools. `Edit|Write|MultiEdit`
  fires on file edits only; an empty list means every fire of the event.
- **delivery** says how the hook ships. A `@dual-pair:` entry names the
  portable [twin](../terms.md#twin) that carries the same check on other
  harnesses. `plugin` means the getff plugin delivers it too.
  `@cc-only-rationale` marks a hook that works only in
  [Claude Code](../terms.md#claude-code), with its reason in the source file.
- **source** is the file and line the description was read from.

The description row quotes the hook's own header line verbatim — what the
page says the hook does is what the file says about itself.
