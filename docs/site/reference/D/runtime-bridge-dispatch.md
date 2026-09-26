---
title: runtime-bridge-dispatch hook
description: A kickoff file can opt into doing its own dispatch — one marker line on top, and the moment the write lands, the runtime-bridge picks the task up. This hook reads the marker, hands the file over, and says so loudly when it could not.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/runtime-bridge-dispatch.sh
  - .claude/rules/zcode-parity-doctrine.md
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/terms.md
  - packages/core/hooks/runtime-bridge-dispatch.test.ts
  - packages/runtime-bridge/src/cli/dispatch.ts
  - plugin/hooks/hooks.json
  - plugin/hooks/runtime-bridge-dispatch
executed:
  - { example: runtime-bridge-dispatch-stays-silent-on-an-unmarked-kickoff, stack: repo, date: 2026-09-25, result: silent }
  - { example: runtime-bridge-dispatch-skips-the-meta-launch-glob-entirely, stack: repo, date: 2026-09-25, result: silent }
  - { example: runtime-bridge-dispatch-names-the-miss-loudly-when-no-entrypoint-exists, stack: repo, date: 2026-09-25, result: printed }
  - { example: runtime-bridge-dispatch-warns-when-a-marked-kickoffs-write-failed, stack: repo, date: 2026-09-25, result: printed }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# runtime-bridge-dispatch hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-runtime-bridge-dispatch plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `runtime-bridge-dispatch` |
| kind | hook |
| ships-to | not installed on any lane (no-lane) |
| description | PostToolUse hook — runtime-bridge dispatch for meta-launch kickoffs |
| source | `.claude/hooks/runtime-bridge-dispatch.sh:2` |
| event | `["PostToolUse","PostToolUseFailure"]` |
| matcher | `["Write|Edit|MultiEdit"]` |
| delivery | `["@cc-only-rationale","plugin"]` |
<!-- getff:end section=D-card-runtime-bridge-dispatch -->

<!-- vale on -->

## Explanation

Auto-dispatch is real, metered autonomous work, so this hook does nothing
until a kickoff file asks for it. The ask is one line: a kickoff whose first
line is exactly `<!-- bridge: auto -->` (trimmed) has opted in; anything else
is silently ignored, because the default must stay "no dispatch — run it
manually when you decide to" (header lines 23-29). The page exercises
everything *around* the dispatch arm; the dispatch itself is deliberately not
demonstrated here because it performs metered work — its behavior is pinned by
the paired tests instead.

The quiet guards first. An unmarked kickoff write, and the pipeline's own
`*-meta-launch/kickoff.md` generation (skipped even when marked — that glob
belongs to a different flow, lines 147-159):

```bash
D="$(mktemp -d)"; mkdir -p "$D/proj/.claude/orchestrator-prompts/getff-ai-site"
printf '%s' '{"tool_name":"Write","session_id":"docs-demo-rb-1","tool_input":{"file_path":"'$D'/proj/.claude/orchestrator-prompts/getff-ai-site/kickoff.md"}}' \
  | CLAUDE_PROJECT_DIR="$D/proj" bash .claude/hooks/runtime-bridge-dispatch.sh
```

```text
(nothing — exit 0)
```

Now the marked case, in a throwaway project with no runtime-bridge installed.
The hook finds no entrypoint in either of its two lookup tiers — the framework
checkout's `packages/runtime-bridge/src/cli/dispatch.ts` first, the consumer's
`.claude/vendor/runtime-bridge/src/cli/dispatch.ts` second — and refuses to
pretend otherwise (two-tier resolution, lines 192-213):

```bash
printf '<!-- bridge: auto -->\n# kickoff\n' > "$D/proj/.claude/orchestrator-prompts/getff-ai-site/kickoff.md"
printf '%s' '{"tool_name":"Write","session_id":"docs-demo-rb-3","tool_input":{"file_path":"'$D'/proj/.claude/orchestrator-prompts/getff-ai-site/kickoff.md"}}' \
  | CLAUDE_PROJECT_DIR="$D/proj" bash .claude/hooks/runtime-bridge-dispatch.sh
```

```text
⚠ runtime-bridge-dispatch: no dispatch entrypoint found — the auto-dispatch this kickoff opted into (`<!-- bridge: auto -->`) DID NOT RUN. This is a SKIP, not a pass. Neither packages/runtime-bridge/src/cli/dispatch.ts (framework checkout) nor .claude/vendor/runtime-bridge/src/cli/dispatch.ts (consumer install) exists here; re-run the installer with --profile factory to get the vendor drop, or remove the `<!-- bridge: auto -->` marker if auto-dispatch is not wanted.
```

Under Claude Code that text rides both channels — a plain line on stderr for
you and a JSON `additionalContext` for the model (the forwards at lines
270-274);
under ZCode the JSON wrapper is `{"additionalContext": …}` without the
`hookSpecificOutput` nesting. The second registration row in the card's event
list is a second arm: **PostToolUseFailure**. A failed edit of a marked
kickoff is a dispatch the author opted into that silently never happened —
the success path will never fire, so this arm says so, quoting the tool
error (lines 106-136):

```bash
printf '%s' '{"hook_event_name":"PostToolUseFailure","tool_name":"Edit","session_id":"docs-demo-rb-4","is_interrupt":false,"error":"EACCES: permission denied","tool_input":{"file_path":"'$D'/proj/.claude/orchestrator-prompts/getff-ai-site/kickoff.md"}}' \
  | CLAUDE_PROJECT_DIR="$D/proj" bash .claude/hooks/runtime-bridge-dispatch.sh
```

```text
⚠ runtime-bridge-dispatch: the kickoff write FAILED — the auto-dispatch it opted into (bridge:auto marker on line 1) DID NOT RUN. Tool error: EACCES: permission denied. Retry the write, or dispatch manually: tsx packages/runtime-bridge/src/cli/dispatch.ts <kickoff-path> (framework) / tsx .claude/vendor/runtime-bridge/src/cli/dispatch.ts <kickoff-path> (consumer).
```

Two silences bound that arm, both deliberate: a user-cancelled write
(`is_interrupt: true`) was intentional, not a loss; and a failed *fresh*
write leaves no file on disk, so there is no marker to read and nothing
provably lost — only the failed-edit-of-a-marked-kickoff case warns. Whatever
happens, the hook exits 0: injection is never a [gate](../../terms.md#gate)
(header lines 39-42, and line 275).

The card's delivery row says `@cc-only-rationale` **and** `plugin`, which
reads oddly until you look at the source: the header (lines 5-14) is explicit
that this is NOT a harness-capability claim — the plugin ships its own twin
(`plugin/hooks/runtime-bridge-dispatch`), and the two fire on the same
moments; the rationale marks that no third harness gets anything. The census
disagrees with the matcher, usefully: row 17 is classified `zcode-gap`
because the registered matcher delivers `MultiEdit` but the hook's own path
filter only acts on Write/Edit-shaped events — a MultiEdit fire is inert —
while the failure arm fires everywhere, its payload verified on both
harnesses.

## Evidence

- `.claude/hooks/runtime-bridge-dispatch.sh:2` is the header the card's description
  row quotes: `# runtime-bridge-dispatch.sh — PostToolUse hook — runtime-bridge dispatch for meta-launch kickoffs`.
- Opt-in gate: lines 164-169 — first line read with `sed`, trimmed, compared to
  `<!-- bridge: auto -->`; the default-off rationale at header lines 23-29; the
  file-exists flush guard at lines 161-162.
- Path filter: `*/kickoff.md` active, `*-meta-launch/kickoff.md` skipped (P4) — the
  skip case at line 156, the section comment at lines 147-155.
- Failure arm: lines 119-135 — tool case at 120-123, path cases at 124-128,
  `is_interrupt` boundary at 129, marker-on-disk condition at 130-131, warning text at
  132-133; the silence boundaries are reasoned in the header comment at lines 106-118.
- Two-tier entrypoint: `_resolve_dispatch_ts` at lines 193-202 (tier list 197-198 —
  framework tier, then vendor tier); the loud both-layouts skip at lines 203-213, whose
  comment (205-211) records the L-6 two-policies fix.
- Dependency guard: lines 52-99 — the jq/node `if` at line 84, the jq-less sed
  recovery of the path at line 85, the both-layouts note at lines 90-94, the
  DID-NOT-RUN emit at line 95; `_is_zcode` at line 68.
- stderr capture: lines 220-235 — a private per-invocation mktemp file (`_run` at
  248/250 sends the CLI's stderr there), so one dispatch's stderr can never leak into
  another's context (A5-5, `#warning-nobody-reads` fix).
- Fallback ladder: lines 253-261 — tsx, then npx, then the manual instructions; the
  `spec_invalid` abort (exit 2 from the CLI, hook still 0) at header lines 31-37.
- Output contract: header lines 39-42 («plain stdout IGNORED for PostToolUse —
  context must be JSON additionalContext»; «exits 0 always — injection, never a
  gate»), citing the verified CC hooks doc; the NC-3 no-settings-writes note at
  lines 44-49.
- Registration: `.claude/settings.json:150` (PostToolUse, matcher
  `Write|Edit|MultiEdit`, command line 154) and `:179` (PostToolUseFailure, same
  matcher, command line 183); the plugin registers both arms too
  (`plugin/hooks/hooks.json:126`, `:155`).
- Census row 17 (`.claude/rules/zcode-parity-doctrine.md` §2): `zcode-gap` —
  «degraded (`MultiEdit` matcher inert; Write+Edit fire); failure arm fires too».
- Paired test: `packages/core/hooks/runtime-bridge-dispatch.test.ts` — the guard
  battery at lines 170-243 (off-tool, empty path, non-kickoff, meta-launch skip,
  nonexistent file, both opt-in rejections, whitespace tolerance), byte-for-byte
  stdout forwarding (327), ZCode strict-schema compliance (345).
