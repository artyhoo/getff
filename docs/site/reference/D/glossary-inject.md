---
title: glossary-inject hook
description: When your prompt uses the word you actually say for a glossary term, the agent gets that term's definition in the same turn — until the term is learned.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/glossary-inject.sh
  - .claude/hooks/end-of-turn-reminder.sh
  - .claude/hooks/lang/en.sh
  - .claude/settings.json
  - plugin/hooks/hooks.json
  - plugin/hooks/glossary-inject
  - packages/core/hooks/glossary-counters.test.ts
  - scripts/register-glossary-hook.sh
  - CONTEXT.md
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/terms.md
executed:
  - { example: glossary-prompt-with-raw-word, stack: repo, date: 2026-09-25, result: printed }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# glossary-inject hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim, including the deliberate unregistered token -->

<!-- getff:begin section=D-card-glossary-inject plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `glossary-inject` |
| kind | hook |
| ships-to | not installed on any lane (no-lane) |
| description | UserPromptSubmit hook: glossary injection + usage counter (plain-words-recap-v2 D-F). |
| source | `.claude/hooks/glossary-inject.sh:2` |
| event | `{"absent":"unregistered"}` |
| matcher | `{"absent":"unregistered"}` |
| delivery | `["@cc-only-rationale","plugin"]` |
<!-- getff:end section=D-card-glossary-inject -->

<!-- vale on -->

## Explanation

You and your agent do not always mean the same word by the same word. Your project keeps a
glossary so the two of you can share one. This hook closes the last gap: it reads your
prompt before the agent answers it, and when you use the word you actually say for a term
— not the term's official name, your word — it puts the definition in front of the agent
in that same turn.

It does this until the term is learned. The hook counts how many times you have used a
term and how many times the agent has explained it back to you. Past those counts, it says
nothing: you both know the word by now. Delete the counters file to teach a term again.

The word list comes from your glossary file itself. Each term entry can carry an
`_Operator says_:` line naming the raw words you use for it. The hook
matches those words only, on word boundaries, case-insensitive. It deliberately does not
match the term's canonical name: a term literally called "Red" would fire on every
ordinary sentence with "red" in it.

Here it is running in the getff repository itself. The prompt says "harvest", and
`harvest` is a raw word of the Harvest term:

```bash
printf '%s' '{"prompt":"please harvest the finished branch","session_id":"docs-demo-1"}' \
  | bash .claude/hooks/glossary-inject.sh
```

```text
"harvest" = Harvest: take a finished aif-agent branch and egress it into a PR after acceptance; the [harvest skill](.claude/skills/harvest/SKILL.md) owns the flow and is operator-invoked.
```

That line is what the agent receives ahead of your prompt. The count for the Harvest term
went up by one at the same moment.

One count per prompt, no matter how many times the word appears. A synonym is not a
count. If two of your worktree sessions run at once, the counters file is guarded by a
short lock so two sessions cannot erase each other's count; a lock that cannot be taken
within two seconds is skipped, because a lost count must never block your prompt.

**It does nothing until you register it.** The card's `event` row says
`{"absent":"unregistered"}` on purpose: no settings file registers this hook, and an
unregistered hook is indistinguishable from a working one once it is on disk. You turn it
on once, yourself:

```bash
bash scripts/register-glossary-hook.sh
```

By default this writes one `UserPromptSubmit` entry into your user-level
`.claude/settings.json` — the one file every session on the machine reads. The
registration bakes in an absolute path to the hook; in a project without a `CONTEXT.md`
the hook exits before printing anything, so the same registration is inert in every other
repository. Pass `--project` to register in this checkout only, through the rendered
[channel](../../terms.md#channel) the project owns.

Once it is registered, it counts toward learning in both directions together with the
glossary arm inside `.claude/hooks/end-of-turn-reminder.sh`: that side counts the fixed
`term (explanation)` form the agent writes, and both sides read the same counters file.
Explanations count toward the same silence.

## Evidence

- `.claude/hooks/glossary-inject.sh:2` is the header the card's description row quotes:
  `# glossary-inject.sh — UserPromptSubmit hook: glossary injection + usage counter (plain-words-recap-v2 D-F).`
- The raw-word parser is one awk pass over `CONTEXT.md` at lines 107 to 137 of the hook.
  Line 135 takes the `_Operator says_:` line; line 129 emits the term record; lines 121
  and 122 strip the guillemets with two literal substitutions, so a byte-locale shell
  cannot eat a Cyrillic letter.
- The word-boundary pattern is built at lines 150 to 153. Its character class comes from
  the language packs, not the script: `.claude/hooks/lang/en.sh` sets
  `AIF_GLOSSARY_USES=3` and `AIF_GLOSSARY_EXPLAINS=5` at lines 238 and 239, and the hook
  reads those same names as its thresholds at lines 158 to 161.
- Learning: line 219 skips a term whose counts are past either threshold —
  `continue  # learned — above threshold nothing fires (D-F): no line, no pending entry`.
  Line 231 builds the injected line; line 232 appends the term to the pending file the
  Stop-side arm reads.
- The lock is lines 177 to 197: `mkdir` as the atomic test-and-set, a 100 × 20 ms bound,
  and a lock dir older than a minute reclaimed as a crashed holder.
- Guards: line 38 exits quietly without `jq`; line 43 exits on an unarmed tree —
  `[ -f "$REPO_ROOT/CONTEXT.md" ] || exit 0   # unarmed tree: inert, nothing injected, exit 0`.
- The counters write is best-effort: line 201 creates the file with
  `printf '{"terms":{}}' > "$counts_file" 2>/dev/null || true`, and a failed write never
  reaches your prompt.
- On Claude Code the line is plain stdout, which the harness injects; on harnesses
  needing strict JSON, lines 52 to 54 wrap it as `{"additionalContext": ...}`.
- Unregistered is measured, not assumed. Both registries are silent:
  `grep -rn "glossary" .claude/settings.json plugin/hooks/hooks.json` prints nothing and
  exits 1. The delivery is the hand-action: `scripts/register-glossary-hook.sh:9` says the
  default writes «the USER file … the one registration every session on the machine
  reads».
- The plugin copy is generated, never edited by hand: `plugin/hooks/glossary-inject`,
  line 2 reads `# AUTO-GENERATED from .claude/hooks/glossary-inject.sh — do not edit`.
- Paired test: `packages/core/hooks/glossary-counters.test.ts` covers both sides; its
  header (lines 5 to 8) names this hook and the Stop-side arm, and lines 43 to 44 pin the
  two hook paths under test.
