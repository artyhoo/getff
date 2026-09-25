---
title: inject-memory-codification hook
description: When the agent saves a durable lesson to its memory, this hook asks the missing question in the same breath — why not codify it into the repo, so every future session gets it for free?
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/inject-memory-codification.sh
  - .claude/rules/memory-codification.md
  - .claude/settings.json
  - agents/memory-codification-auditor.md
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/terms.md
  - plugin/hooks/inject-memory-codification
  - plugin/hooks/hooks.json
  - packages/core/hooks/inject-memory-codification.test.ts
executed:
  - { example: memory-codification-on-a-memory-write, stack: repo, date: 2026-09-25, result: printed }
  - { example: memory-codification-on-an-ordinary-write, stack: repo, date: 2026-09-25, result: silent }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# inject-memory-codification hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-inject-memory-codification plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `inject-memory-codification` |
| kind | hook |
| ships-to | framework: react-native, react-next, react-spa, ts-server |
| description | PostToolUse hook — path-scoped codify-then-pointer discipline reminder |
| source | `.claude/hooks/inject-memory-codification.sh:2` |
| event | `["PostToolUse"]` |
| matcher | `["Write"]` |
| delivery | `["@dual-pair:memory-codification-writemoment","plugin"]` |
<!-- getff:end section=D-card-inject-memory-codification -->

<!-- vale on -->

## Explanation

Your agent keeps a memory: notes it writes about your project so the next session starts
smarter. Memory is good at remembering. It is bad at sharing — a lesson that lives only
in your memory directory helps your sessions, and nobody else's. The discipline this
hook nudges is called codify-then-pointer: when a note is a durable behavioural
convention, write it into the repository where every session and every teammate gets it,
and shrink the memory entry to a one-line pointer at the new home.

The hook fires at exactly the right moment to ask: the instant a file is written into a
memory directory. It does not read the note's content — it cannot judge whether this
particular note is durable — so it asks the question every time, once per session, and
leaves the judgment to the agent. Here it is running in the getff repository itself,
against a write into a project memory store:

```bash
printf '%s' '{"tool_name":"Write","session_id":"docs-demo-mc-1",
  "tool_input":{"file_path":"'$HOME'/.claude/projects/some-project/memory/feedback-harness.md"}}' \
  | bash .claude/hooks/inject-memory-codification.sh
```

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "📎 Memory-codification reminder — writing a durable behavioural convention (\"always/never do X\", \"How to apply:\") to agent memory? Codify it into the repo in the SAME step (e.g. CLAUDE.md or a .claude/rules/*.md rule), then reduce this memory entry to a one-line pointer: \"See <repo-path> — codified at <SHA>\". Ephemeral state, identity, and reference-fact pointers are fine to leave as-is."
  }
}
```

The reminder itself is careful about scope: session state, identity facts, and
pointers to reference material are fine in memory — only durable behavioural
conventions belong in the repo. Writing anywhere else in the project produces nothing:

```bash
printf '%s' '{"tool_name":"Write","session_id":"docs-demo-mc-2",
  "tool_input":{"file_path":"'$PWD'/docs/site/reference/D/x.md"}}' \
  | bash .claude/hooks/inject-memory-codification.sh
```

```text
(nothing — exit 0)
```

The trigger is a path shape, not a product name: the hook checks whether the written
file's path contains a `/memory/` segment — any harness that keeps per-project memory
under such a directory is covered the same way. That is a deliberate choice, stated in
the hook's own header as «capability-check by path, not brand name».

You will see this reminder at most once per session, no matter how many memory files
get written — the point is to install the habit, not to nag. And it is one half of a
pair: this hook nudges at write time, and `.claude/rules/memory-codification.md` owns
the discipline itself; a periodic audit of the whole memory store — reading every entry
semantically, not just catching the write moment — is the job of
`agents/memory-codification-auditor.md`.

## Evidence

- `.claude/hooks/inject-memory-codification.sh:2` is the header the card's description
  row quotes: `# inject-memory-codification.sh — PostToolUse hook — path-scoped codify-then-pointer discipline reminder`.
- Registration: `.claude/settings.json:168` reads `"matcher": "Write"` with the command
  at line 172; the plugin registry registers it at `plugin/hooks/hooks.json:144`.
- The tool gate is line 30 — `case "$TOOL" in Write) ;; *) exit 0 ;; esac` — so the
  reminder fires on writes only, deliberately excluding Read and Edit (the test header,
  lines 8-9, calls this out: it «mirrors the memory store being WRITTEN, not merely read»).
- The path check is lines 37-40: `case "$ABS_PATH" in */memory/*) ;; *) exit 0 ;; esac`,
  under the header comment (lines 14-16) «CAPABILITY-CHECK BY PATH, NOT BRAND NAME
  (dual-implementation-discipline.md §4)».
- The reminder text is the single assignment at line 49, beginning
  `MSG='📎 Memory-codification reminder — writing a durable behavioural convention`; the
  demo output above is that string verbatim.
- Once per session: lines 45-47 — the cache file
  `CACHE="${TMPDIR:-/tmp}/cc-memory-codification-${SESSION//[^A-Za-z0-9_-]/_}.txt"`
  (line 42) is checked with `grep -qxf "fired"` and marked with `printf 'fired\n'`.
- Output contract: lines 51-52 wrap the message in
  `{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$ctx}}`, with the
  header (lines 19-20) recording that plain stdout «is IGNORED for PostToolUse».
- The pair: line 5 declares `# @dual-pair: memory-codification-writemoment`, and lines
  6-11 name both channels — this hook at write time, and
  `agents/memory-codification-auditor.md` as «the AI-agnostic … session-read, semantic
  audit of the whole memory store — a periodic sweep, not a per-write nudge».
- jq guard: line 23 — `command -v jq >/dev/null 2>&1 || exit 0   # graceful no-op without jq`.
- The plugin twin is generated, not hand-written: `plugin/hooks/inject-memory-codification`,
  line 2 reads `# AUTO-GENERATED from .claude/hooks/inject-memory-codification.sh — do not
  edit`.
- Paired test: `packages/core/hooks/inject-memory-codification.test.ts` — its header
  (lines 3-5) names the hook as «the write-time alt-channel for
  .claude/rules/memory-codification.md §3 (evicted from always-on rule context, CTX
  Stage 1)» and asserts the memory-path match, the silent non-memory case, and the
  once-per-session cache.
