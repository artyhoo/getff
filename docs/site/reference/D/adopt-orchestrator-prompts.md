---
title: adopt-orchestrator-prompts hook
description: A prompt file written inside a worktree is a sole copy that dies with the worktree. This hook notices the write and adopts the file into the shared coordination store, so the prompt survives and every other worktree sees it.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/adopt-orchestrator-prompts.sh
  - .claude/rules/zcode-parity-doctrine.md
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/reference/D/worktree-setup.md
  - docs/site/terms.md
  - packages/core/hooks/adopt-orchestrator-prompts.test.ts
  - README.md
  - scripts/link-coordination.sh
executed:
  - { example: adopt-orchestrator-prompts-ignores-a-write-outside-the-prompt-tree, stack: repo, date: 2026-09-25, result: silent }
  - { example: adopt-orchestrator-prompts-skips-when-the-written-file-is-not-on-disk-yet, stack: repo, date: 2026-09-25, result: silent }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# adopt-orchestrator-prompts hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim, including the deliberate unregistered token -->

<!-- getff:begin section=D-card-adopt-orchestrator-prompts plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `adopt-orchestrator-prompts` |
| kind | hook |
| ships-to | not installed on any lane (no-lane) |
| description | PostToolUse: adopt a new orchestrator-prompt |
| source | `.claude/hooks/adopt-orchestrator-prompts.sh:2` |
| event | `{"absent":"unregistered"}` |
| matcher | `{"absent":"unregistered"}` |
| delivery | `["@cc-only-rationale"]` |
<!-- getff:end section=D-card-adopt-orchestrator-prompts -->

<!-- vale on -->

## Explanation

Worktrees are where parallel sessions live, and a file written under
`.claude/orchestrator-prompts/` in one worktree exists only there — when the
worktree is removed, the prompt goes with it. This hook closes that gap at the
write itself: the moment an edit lands in that directory, it hands the file to
`scripts/link-coordination.sh`, whose adopt-then-link arm copies it into the
canonical coordination store and replaces the local file with a link back
(idempotent, SSOT #110 — the hook's header, lines 10-13). The write stays done;
only where the bytes live changes.

Nothing happens for writes anywhere else. The hook path-filters in script
because a settings matcher cannot glob a path (lines 45-48), which is also why
its card reads `not registered (unregistered)` — the getff team runs it on its
own repository as internal coordination tooling (`@cc-only-rationale`, line 18)
and ships it to no install [lane](../../terms.md#lane). Both guard paths below
are exits you can reproduce at a repo checkout:

```bash
printf '%s' '{"tool_name":"Write","session_id":"docs-demo-aop-1",
  "tool_input":{"file_path":"'$PWD'/README.md"}}' \
  | bash .claude/hooks/adopt-orchestrator-prompts.sh
```

```text
(nothing — exit 0)
```

The second guard exists because the hook runs *during* the write, and on some
Claude Code versions the PostToolUse event can arrive before the file has
flushed to disk. Reading a missing file would abort the adoption, so the hook
treats an absent path as "not yet there" and leaves silently (lines 51-52):

```bash
printf '%s' '{"tool_name":"Write","session_id":"docs-demo-aop-2",
  "tool_input":{"file_path":"'$PWD'/.claude/orchestrator-prompts/demo/not-written-yet.md"}}' \
  | bash .claude/hooks/adopt-orchestrator-prompts.sh
```

```text
(nothing — exit 0)
```

When the helper itself cannot be found — none of the three tiers it checks
(repo root, the hook's own checkout, the worktree) carries
`scripts/link-coordination.sh` — the hook refuses to stay quietly useless. It
prints a skip notice on both channels saying the adoption **DID NOT RUN** and
the file remains sole-copy until the helper is run manually (lines 66-75). The
header calls this the loud-skip pattern and names its model:
`check-kickoff-traps.sh`'s `_emit_skip` (line 29). [worktree-setup](worktree-setup.md)
shares the same design — the same store, the same loud miss on a missing helper —
because both hooks guard the same coordination world.

Adoption never blocks anything. Every path through the file ends in `exit 0`
(lines 42, 48, 52, 75, 80, 82); a failed adoption is surfaced, never fatal.
The paired tests pin both the happy path and the guards: a written prompt
becomes a symlink with its content moved to the canonical store (test line
114), firing again changes nothing (137), and the tracked-file skips make sure
adoption never over-reaches — a written `done.md` or umbrella `README.md`
under the directory stays a real file (154, 168).

## Evidence

- `.claude/hooks/adopt-orchestrator-prompts.sh:2` is the header the card's
  description row quotes: `# adopt-orchestrator-prompts.sh — PostToolUse: adopt a new orchestrator-prompt`.
- Sole-copy gap: lines 5-8 of the header — «.claude/orchestrator-prompts/*/ inside a
  worktree is sole-copy and dies if the [worktree is removed]».
- Input and spec: line 10 reads `.tool_input.file_path` (jq at line 41); line 19 names
  the spec `scripts/link-coordination.sh (SSOT #110)`; the marker at line 18 reads
  `# @cc-only-rationale: internal orchestrator coordination tooling, not a consumer-shipping path → CC-native only`.
- Path filter: the `case` at lines 47-48 keeps only `*/.claude/orchestrator-prompts/*`;
  the comment at lines 45-46 records why («The settings matcher cannot glob a path»).
- Flush guard: line 52 — `[[ -f "$ABS_PATH" ]] || exit 0`, with the race explained at
  lines 51 and 54.
- Worktree root from the written path: line 57 — `WT_DIR="${ABS_PATH%%/.claude/orchestrator-prompts/*}"`.
- Helper tiers: lines 66-70 try the repo root, the hook's own checkout, and the worktree;
  line 62's comment records the failure this tier list replaced («`exit 0` left this hook
  inert wherever that path was absent»).
- Loud skip: lines 73-76 — `_emit_skip '⚠ adopt-orchestrator-prompts: scripts/link-coordination.sh not found in any tier — the write-time adoption of this orchestrator-prompt file DID NOT RUN. …'`; the pattern credit at line 29 («mirror of check-kickoff-traps.sh `_emit_skip` (loud-skip pattern)»).
- Non-blocking contract: line 80 runs the helper and swallows its status
  (`>/dev/null 2>&1 || true`); line 82 is the final `exit 0`.
- jq guard: line 38 — «⚠ adopt-orchestrator-prompts: jq unavailable — skipping» to stderr,
  exit 0.
- Census row 1 (`.claude/rules/zcode-parity-doctrine.md` §2): `framework-internal` —
  «works (PostToolUse ∈ `ZCODE_EVENTS`); unregistered by default».
- Paired test: `packages/core/hooks/adopt-orchestrator-prompts.test.ts` — adoption to
  symlink + canonical store (line 114), idempotence (137), tracked-skip negatives
  (154, 168), trigger gate (182), loud skip (206), flush guard (233).
