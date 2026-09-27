---
title: inject-handoff-on-compact hook
description: The moment a compaction wipes your context, this hook re-feeds the handoff the previous session wrote — so the fresh window starts with the current state, not a blank page.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/inject-handoff-on-compact.sh
  - .claude/hooks/precompact-residue.sh
  - .claude/hooks/end-of-turn-reminder.sh
  - .claude/hooks/lib/residue-dir.sh
  - .claude/settings.json
  - docs/superpowers/specs/2026-09-08-handoff-currency-gate-design.md
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/terms.md
  - packages/core/hooks/inject-handoff-on-compact.test.ts
executed:
  - { example: handoff-compact-without-a-handoff, stack: repo, date: 2026-09-25, result: silent }
  - { example: handoff-compact-with-a-handoff, stack: repo, date: 2026-09-25, result: printed }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# inject-handoff-on-compact hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-inject-handoff-on-compact plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `inject-handoff-on-compact` |
| kind | hook |
| ships-to | not installed on any lane (no-lane) |
| description | SessionStart:compact hook — re-injects the model-authored handoff after compaction |
| source | `.claude/hooks/inject-handoff-on-compact.sh:2` |
| event | `["SessionStart"]` |
| matcher | `["compact"]` |
| delivery | `["@cc-only-rationale"]` |
<!-- getff:end section=D-card-inject-handoff-on-compact -->

<!-- vale on -->

## Explanation

A long session ends with the agent writing a handoff: what it was doing, what is done,
what comes next. Then your context window fills up and the conversation gets compacted —
and the handoff, written into that conversation, is gone exactly when the fresh window
needs it most. This hook is the reader half of that pipe. When Claude Code restarts a
session after a compaction, it fires the SessionStart event with the source marked
`compact`, and this hook — registered for exactly that matcher in
`.claude/settings.json` — answers with the handoff, injected back into the new window.

The writer half is a sibling hook, `.claude/hooks/precompact-residue.sh`, which saves the
handoff to a file just before the compaction happens. The two hooks agree on the file
name: both build it from your session id, sanitised the same way, so one writes what the
other can find. Change that expression on one side only and the channel silently
unlinks — the source says so in exactly those words at
`.claude/hooks/inject-handoff-on-compact.sh:15`.

Here is the hook running in the getff repository itself. First with no handoff written —
a session id that never saved one:

```bash
printf '%s' '{"source":"compact","session_id":"docs-demo-1","cwd":"'$PWD'"}' \
  | bash .claude/hooks/inject-handoff-on-compact.sh
```

```text
(nothing — exit 0)
```

Silence is the contract, not a failure. The hook's job is to not lose a handoff that
exists; whether one must exist is a different hook's job. Now the same command after a
handoff file was written for session `docs-demo-2`:

```bash
printf '%s' '{"source":"compact","session_id":"docs-demo-2","cwd":"'$PWD'"}' \
  | AIF_RESIDUE_DIR="$PWD/.ai-factory/plans/demo/residue" \
  bash .claude/hooks/inject-handoff-on-compact.sh
```

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "[handoff injected — source=compact] The pre-compaction session's model-authored handoff (current state, capped at 200 lines):\nHandoff: mid-way through authoring the hooks reference family.\nCurrent state: 9 of 27 pages written, glossary-inject done.\nNext: write the remaining inject-* sheets, then D.md.\nSession residue (machine excerpt written at the compaction): /home/www/rules-as-tests-aif-feature-getff-ai-site-441880-441880ad-f27a-4706-9527-5e6adcc33a03/.ai-factory/plans/demo/residue/_residue-docs-demo-2.md"
  }
}
```

That text is what the new session starts with. It arrives through the same
[channel](../../terms.md#channel) SessionStart hooks use — additional context, not a user
message. Two details are worth knowing:

- **It is capped.** A handoff that outgrew its size limit will not be injected in full;
  the hook reads at most the same line cap the writer enforced, so a fresh window never
  opens already overloaded.
- **It points at the residue too.** The handoff is the model's own current-state summary;
  the residue is the raw transcript excerpt the writer saved. A continuation may need
  both, so the injected text ends with the residue file's location when one exists.

Everything it cannot do, it does silently: a non-compact session start, a missing
handoff, unreadable input — all end quietly with exit 0, because a hook that fails at
session start must never break the session start.

## Evidence

- `.claude/hooks/inject-handoff-on-compact.sh:2` is the header the card's description row
  quotes: `# inject-handoff-on-compact.sh — SessionStart:compact hook — re-injects the model-authored handoff after compaction`.
- Registration: `.claude/settings.json:218` opens the SessionStart block; line 228 reads
  `"matcher": "compact"`; line 232 is the command
  `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/inject-handoff-on-compact.sh"`. It is the only
  hook registered under the compact matcher.
- Non-compact sources exit before doing anything: line 34 reads `.source` from the payload
  and line 35 is `[ "$source_kind" = "compact" ] || exit 0`.
- The shared key: line 40 is
  `session_key=$(printf '%s' "$session_id" | tr -c 'A-Za-z0-9._-' '_' | cut -c1-96)`.
  The writer applies the identical expression at `.claude/hooks/precompact-residue.sh:123`
  (its comment above the line explains why: a hostile id «cannot escape the directory»),
  and the Stop-side gate at `.claude/hooks/end-of-turn-reminder.sh:404` applies it a third
  time.
- jq guard: line 28 — `command -v jq >/dev/null 2>&1 || exit 0` (the payload is JSON and
  every extraction is jq; without jq there is no work possible).
- Missing handoff: line 72 is `[ -f "$handoff_file" ] || exit 0`, with the comment above
  it (lines 70-71) saying the injector's contract «is only to not lose one that does».
- The cap: line 74 reads `cap="${AIF_HANDOFF_MAX_LINES:-200}"` and line 76 reads
  `handoff_body=$(head -n "$cap" "$handoff_file" 2>/dev/null || true)`.
- The residue pointer: line 81 builds the residue file path from the same session key and
  line 83 appends `Session residue (machine excerpt written at the compaction): …` to the
  injected text only when that file exists.
- The residue directory comes from `.claude/hooks/lib/residue-dir.sh`, sourced at lines
  50-51; if the lib is absent, an inline fallback with identical logic (lines 52-65) takes
  over — «lib absent or unreadable → the inline fallback below, identical logic, never an
  abort».
- The output: lines 85-92 wrap everything in
  `hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: $ctx }`.
- Spec: `.claude/hooks/inject-handoff-on-compact.sh:12` names it —
  `# spec: docs/superpowers/specs/2026-09-08-handoff-currency-gate-design.md (D20)`.
- No plugin twin exists: the plugin SessionStart slot is held by the bootstrap hook, and
  consumers receive no residue writer, so there would be no file to inject. That is why
  the card's delivery row carries only the CC-only marker.
- Paired test: `packages/core/hooks/inject-handoff-on-compact.test.ts` — its opening line
  (line 2) names this hook as «the D20 injection pipe of the handoff-currency gate», and
  the header (lines 8-10) states the mirror contract: the gate makes the model maintain a
  handoff; this hook re-delivers it into the fresh window.
