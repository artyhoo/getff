---
title: check-doc-authority hook
description: The moment you edit one of the framework's own rule or agent docs, this gate checks the file says what it is authoritative for — and hands the agent the missing-header diagnostic before the session moves on.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/check-doc-authority.sh
  - .claude/hooks/lib/hook-emit.sh
  - .claude/rules/doc-authority-hierarchy.md
  - .claude/rules/zcode-parity-doctrine.md
  - .claude/settings.json
  - docs/meta-factory/research-patches/2026-07-24-posttooluse-channel-verification.md
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/reference/D/check-doc-authority-header.md
  - docs/site/terms.md
  - packages/core/hooks/check-doc-authority.test.ts
  - packages/core/principles/09-doc-authority-hierarchy.ts
  - plugin/hooks/hooks.json
executed:
  - { example: doc-authority-green-on-a-rule-with-a-header, stack: repo, date: 2026-09-25, result: silent }
  - { example: doc-authority-red-on-a-headerless-rule, stack: repo, date: 2026-09-25, result: printed }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# check-doc-authority hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-check-doc-authority plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `check-doc-authority` |
| kind | hook |
| ships-to | not installed on any lane (no-lane) |
| description | PostToolUse gate — principle-09 doc-authority header quick-check (delegates to the 09 bin) |
| source | `.claude/hooks/check-doc-authority.sh:2` |
| event | `["PostToolUse"]` |
| matcher | `["Edit|Write|MultiEdit"]` |
| delivery | `["@cc-only-rationale","plugin"]` |
<!-- getff:end section=D-card-check-doc-authority -->

<!-- vale on -->

## Explanation

Every [rule](../../terms.md#rule) in this framework opens with a promise: the
`> **Authoritative for:**` line that says what the file governs. This
[gate](../../terms.md#gate) checks that promise at the moment you edit the file — not
at review, not in CI. Edit a rule or agent doc, and the hook asks one question of the
file you just touched: does it still declare its scope? If the line is gone, the agent
that made the edit hears about it immediately.

Here it is passing on a real rule file, which does carry the header:

```bash
printf '%s' '{"tool_name":"Edit","session_id":"docs-demo-cda-1",
  "tool_input":{"file_path":"'$PWD'/.claude/rules/ai-laziness-digest.md"}}' \
  | bash .claude/hooks/check-doc-authority.sh
```

```text
(nothing — exit 0)
```

And here it is catching the opposite: a rule-shaped file with no header. The demo
creates one so you can run the same thing:

```bash
printf '%s\n' '# A rule file with no authority header.' '# Body text.' \
  > .claude/rules/zz-red-demo.md
printf '%s' '{"tool_name":"Write","session_id":"docs-demo-cda-2",
  "tool_input":{"file_path":"'$PWD'/.claude/rules/zz-red-demo.md"}}' \
  | bash .claude/hooks/check-doc-authority.sh
```

```text
FAIL .claude/rules/zz-red-demo.md: missing "> **Authoritative for:**" header — see .claude/rules/doc-authority-hierarchy.md §3
```

The hook exits 2, and that number is the point: on PostToolUse, exit-2 stderr is the
one channel whose message the model actually receives, so the correction happens in the
same breath as the mistake. Delete the demo file when you are done. This pairing of a
real pass and a real failure is the page's [red-and-green](../../terms.md#red-and-green)
proof.

What the gate checks is decided by the principle-09 module it delegates to, not by this
script: the module carries a static list of must-carry-header docs plus four path
patterns — a new rule file is covered the moment it lands, with no list edit
(`packages/core/principles/09-doc-authority-hierarchy.ts:181-186`). The hook itself is
a thin Claude Code [channel](../../terms.md#channel): it filters markdown, resolves the
principle-09 CLI through a tier list, and runs it. The consumer-facing reimplementation
of the same check is [check-doc-authority-header](check-doc-authority-header.md) —
zero-dependency, installed into consumer projects; this framework-internal one never
leaves the repo (its card says `not installed on any lane`).

Silence here has three meanings, and the hook works to keep them distinct:

- **A pass is silent.** The file has the header, or the edit was never in scope — a
  non-markdown path exits before the expensive part even starts, which the source
  measures at «0.44-0.46 s per no-op edit».
- **A skip is loud.** No `jq`, no `tsx`, no principle-09 CLI — each announces a
  «This is a SKIP, not a pass» notice on the model channel, so a gate that could not
  run never reads as a gate that ran and passed.
- **A failure is the loudest.** Exit 2 with the FAIL line above.

A project that does not want the check at all sets `AIF_DOC_AUTHORITY=0` — the
documented escape, a recorded choice rather than a silent one.

## Evidence

- `.claude/hooks/check-doc-authority.sh:2` is the header the card's description row
  quotes: `# check-doc-authority.sh — PostToolUse gate — principle-09 doc-authority header quick-check (delegates to the 09 bin)`.
- Registration: `.claude/settings.json:113` reads `"matcher": "Edit|Write|MultiEdit"`
  with the command at line 118; the plugin registry registers it too
  (`plugin/hooks/hooks.json:90`).
- Scope patterns live in the delegated module:
  `packages/core/principles/09-doc-authority-hierarchy.ts:181-186` defines
  `REQUIRED_PATH_PATTERNS` — `skills/**/SKILL.md`, `skills/**/references/*.md`,
  `.claude/rules/[^/]+.md`, `agents/[^/]+.md` — and the comment above them (lines
  172-178) explains the 2026-07-03 widening: «a new rule or agent is covered the
  moment it lands, no static-list edit required».
- The skip-is-loud rule: line 98 emits
  `⚠ check-doc-authority: jq unavailable — the principle-09 authority-header check DID NOT RUN for this edit. This is a SKIP, not a pass; install jq to restore enforcement.`
  and line 127 does the same for a missing principle-09 CLI, adding that on a consumer
  install the equivalent gate is `check-doc-authority-header.sh`.
- The cheap-exit prefilter: lines 118-121 exit on non-markdown, and the comment above
  (lines 113-117) notes every path the bin can require is markdown, «so a non-markdown
  edit can only ever make the bin exit 0 after a ~0.45 s cold tsx boot. Measured
  0.44-0.46 s per no-op edit».
- Exit-channel contract: lines 15-24 of the header explain that exit-2 stderr is the
  only non-JSON channel the model receives on PostToolUse, live-verified both
  directions — `docs/meta-factory/research-patches/2026-07-24-posttooluse-channel-verification.md`.
  The delegation and exit-2 conversion are lines 141-152.
- Shared emit prelude: lines 39-49 source `.claude/hooks/lib/hook-emit.sh`, and a
  broken install announces «this gate DID NOT RUN for this edit» rather than exiting
  silently (lines 46-48).
- The opt-out is line 95: `[[ "${AIF_DOC_AUTHORITY:-1}" == "0" ]] && exit 0`.
- Framework-internal status: `.claude/rules/zcode-parity-doctrine.md` §2 row 4 marks
  this hook `framework-internal` — «CC-dogfood only (consumer surface is row 3)», row 3
  being [check-doc-authority-header](check-doc-authority-header.md).
- Paired test: `packages/core/hooks/check-doc-authority.test.ts` — its header (lines
  1-13) states the paired-negative contract: «❌ a REQUIRED_HEADER_DOCS file edited
  WITHOUT `Authoritative for:` → exit 2», «✅ a non-required file edited
  (e.g. packages/foo.ts) → exit 0», and a boundary case where the marker appears
  mid-prose instead of a blockquote and still fails.
