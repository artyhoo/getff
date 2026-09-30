---
title: inject-matching-rule hook
description: When you edit or read a file, or run a Bash command, this hook hands the agent the short cards that claim that moment — the right rule at the right time, not all rules all the time.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/inject-matching-rule.sh
  - .claude/rules/rule-enforcement-channel-selection.md
  - .claude/settings.json
  - docs/superpowers/plans/plugin-hook-triage.md
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/terms.md
  - plugin/hooks/inject-matching-rule
  - plugin/hooks/hooks.json
  - packages/core/hooks/inject-matching-rule.test.ts
executed:
  - { example: matching-rule-on-a-matching-path, stack: repo, date: 2026-09-29, result: printed }
  - { example: matching-rule-on-a-relative-path, stack: repo, date: 2026-09-29, result: silent }
  - { example: command-card-on-git-push, stack: repo, date: 2026-09-29, result: printed }
---

# inject-matching-rule hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-inject-matching-rule plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `inject-matching-rule` |
| kind | hook |
| ships-to | framework: python, react-native, react-next, react-spa, ts-server |
| description | card loader hook — injects the rule and card summaries that match an edit, a read or a Bash command |
| source | `.claude/hooks/inject-matching-rule.sh:2` |
| event | `["PostToolUse","PreToolUse","SessionStart"]` |
| matcher | `["Bash","Edit|Write|MultiEdit|Read","compact"]` |
| delivery | `["@dual-pair:rule-path-scoping","plugin"]` |
<!-- getff:end section=D-card-inject-matching-rule -->

<!-- vale on -->

## Explanation

A project with many [rules](../../terms.md#rule) has a delivery problem: load all of them
into every session and they crowd out the work; load none and the agent rediscovers each
one by breaking it. This hook takes the middle road. When the agent edits a file, it looks
at that file's path, checks which [cards](../../terms.md#card) claim paths like it, and
hands the agent a short summary of each match. Each card arrives once, never as a wall of
text.

The common case is a rule that claims a path. It carries a `globs:` marker on its own line
(or a `paths:` list at its top), and its own one-line `inject:` summary arrives as injected
context on the edit. Here it is running in the getff repository itself, editing the
docs-author skill file, which several rules claim:

```bash
printf '%s' '{"tool_name":"Edit","session_id":"docs-demo-mr-1",
  "tool_input":{"file_path":"'$PWD'/.claude/skills/docs-author/SKILL.md"}}' \
  | bash .claude/hooks/inject-matching-rule.sh
```

```text
📎 Path-relevant rule — AI-laziness traps (T1-T22) apply when running R-phases, audits, sample-based investigations, doc-creation of discipline-bearing artefacts, or open-ended tasks on this surface. … (see .claude/rules/ai-laziness-traps.md)
```

Seven rules matched that path; the line above is the first. Each line ends with where it
came from, so the agent can open the full text when the summary is not enough. A card
with no `inject:` summary sends its whole body when the body is 1,000 bytes or less, and
its first heading otherwise.

The same hook also answers three other moments:

- **A read.** A card that says `on: read` at its top also fires when the agent reads a
  matching file, before any edit.
- **A Bash command.** A card with an `events:` list fires just before a Bash command that
  matches one of its patterns. Try it with a card in a scratch directory:

  ```bash
  cards=$(mktemp -d)
  printf '%s\n' '---' 'events:' "  - '^git push( |\$)'" '---' \
    'Before a push, run the local gates first: they are the push gate.' > "$cards/push.md"
  printf '%s' '{"hook_event_name":"PreToolUse","tool_name":"Bash","session_id":"docs-demo-mr-3",
    "tool_input":{"command":"git push origin HEAD"}}' \
    | CARDS_DIR_OVERRIDE="$cards" bash .claude/hooks/inject-matching-rule.sh
  ```

  ```text
  {
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "additionalContext": "📎 Command-relevant rule — Before a push, run the local gates first: they are the push gate.\n"
    }
  }
  ```

- **A compaction.** When Claude Code compacts the conversation, the cards it delivered
  are gone from the context, so the hook forgets them and each card can arrive once more.

Cards come from two places: your project's `.claude/rules/` and a card directory that
ships beside the hook. A sub-agent keeps its own tally, so it gets a card even when the
main session already had it.

Some boundaries to know:

- **It only sees paths inside your repository.** The hook strips the repository root from
  the edited file's path, and if nothing was stripped the path was not inside the repo, so
  it exits without matching anything. A relative path therefore produces nothing:

  ```bash
  printf '%s' '{"tool_name":"Edit","session_id":"docs-demo-mr-2",
    "tool_input":{"file_path":".claude/skills/docs-author/SKILL.md"}}' \
    | bash .claude/hooks/inject-matching-rule.sh
  ```

  ```text
  (nothing — exit 0)
  ```

- **It only fires if you have cards.** A project with no rules and no cards gets one loud
  notice per session («no rules corpus found … this hook has nothing to inject and will
  stay silent for the rest of this session») and then quiet.
- **The read and command moments start empty.** At this pin no rule in this repository
  and no shipped card declares `on: read` or `events:`, so those two moments inject
  nothing until a card asks for them.
- **The patterns are small on purpose.** Path globs support `**`, `*`, `?` and `{a,b}`;
  command patterns are plain extended regular expressions. macOS has no `\b`, `\s` or
  `\d`, so a portable pattern spells them out.

This hook ships, but the rules it reads are yours. The framework delivers the loader; your
project writes the rules it injects. And it is never a [gate](../../terms.md#gate): it
hands the agent advice and always exits 0.

## Evidence

- The card's description row quotes the header line,
  `.claude/hooks/inject-matching-rule.sh:2`; lines 16-30 describe the mechanism: what a card is, the four moments (lines
  22-25), what is injected (lines 26-28), and `Each card fires ONCE per (session_id,
  agent_id)` (line 29).
- Registration in `.claude/settings.json`: `"matcher": "Edit|Write|MultiEdit|Read"` at
  line 124 (command line 128), `"matcher": "Bash"` at line 95 (command line 99), and
  `"matcher": "compact"` at line 247 (command line 251). The plugin registry names the
  same three (`plugin/hooks/hooks.json:37`, `:84`, `:197`).
- The moment is read from the payload, not from an argument: `case "$EVENT" in` at line
  106. `SessionStart` (line 107) clears the session's cache on `compact` (line 110);
  `PreToolUse` (line 112) takes Bash only; `PostToolUse` (line 115) splits Edit, Write and
  MultiEdit from Read at line 116.
- Cards come from `CARDS_DIR` (line 87) as well as the rules directory; the twin reads
  `${CLAUDE_PLUGIN_ROOT}/cards` instead (`plugin/hooks/inject-matching-rule:71`).
- Payload safety: line 96 turns every payload field into one string before `eval`
  (`def s: if type == "string" then . else tostring end;`).
- Read moment: line 322 narrows the corpus to files with an `on: read` line and line 331
  skips any card without it. Command moment: line 323 narrows to files with `events:`.
- Path triggers are the union of the `paths:` list and the `globs:` marker: line 334 reads
  the marker, which must be on its own line, and line 337 adds it to the parsed list.
  The glob grammar is the header paragraph at line 37; the frontmatter grammar is at line
  47; `glob_to_ere` starts at line 180 and `parse_frontmatter` at line 251.
- What is sent: line 346 reads the `inject:` marker; line 349 sends the body when it fits
  `CARD_LIMIT` (1,000 bytes, line 88); line 352 falls back to the first heading. The
  pointer names `depth:` files (line 359) or the rule itself (line 361).
- Once per card: line 344, `first_time "$entry" || continue`; `first_time` (line 147)
  makes one directory per card with an atomic `mkdir` (line 150).
- Outside-repo guard: line 140 computes `REL_PATH="${ABS_PATH#"$REPO_ROOT/"}"` and line
  141 is `[[ "$REL_PATH" = "$ABS_PATH" ]] && exit 0   # outside the project root — skip`.
- The empty-corpus notice is built at line 132; the header paragraph at line 54 states
  the shape: «Never a permanent silent no-op; never per-invocation spam».
- Output contract: line 368 wraps the text in
  `{hookSpecificOutput:{hookEventName:$ev,additionalContext:$ctx}}`, with the event taken
  from the payload; the header (line 32 on) records that plain stdout is ignored for
  PostToolUse.
- The twin is hand-written, not generated: `.claude/hooks/inject-matching-rule.sh:81`
  says `@plugin-transform: manual`, and `plugin/hooks/inject-matching-rule` opens as
  «Plugin-relocated card loader» (its line 2), resolving the project via
  `CLAUDE_PROJECT_DIR` (line 66) because `$0` points into the plugin payload.
- Ship status: the paragraph at line 61 records the GH #934 delivery claim corrected by
  GH #1520: «the HOOK ships and is registered in consumer projects … The `.claude/rules/`
  CORPUS it reads does NOT ship».
- Paired test: `packages/core/hooks/inject-matching-rule.test.ts`. Its describe block
  «slice 1 (trigger build)» covers the four moments, the sub-agent tally, the compaction
  reset, the card directory, and a glob table checked against `picomatch`.
