---
title: Check the hooks in your project
description: List the moments your project wires hooks to, match them against the hooks family's pages, and watch one fire for real — so you know what your install actually runs before you trust it.
kind: guide
sources:
  - .claude/hooks/inject-matching-rule.sh
  - .claude/settings.json
  - docs/site/reference/D.md
  - docs/site/reference/D/deps-hash-check.md
  - docs/site/reference/D/inject-matching-rule.md
  - docs/site/terms.md
executed:
  - { example: list-registered-events, stack: repo, date: 2026-09-25, result: nine-events }
  - { example: read-a-hook-header, stack: repo, date: 2026-09-25, result: printed }
  - { example: watch-inject-matching-rule-fire, stack: repo, date: 2026-09-25, result: printed }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# Check the hooks in your project

A getff install does two things to your project at once: it copies hook
scripts into your hooks folder, and it registers them so your agent harness
runs them at fixed moments — an edit lands, you send a message, a session
starts. The [hooks family](../reference/D.md) documents all of them. This
guide checks that the two halves agree in *your* project: which moments are
wired, which files were copied, and whether a hook does what its page says.
Ten minutes, nothing modified.

## Prerequisites

- A project where getff is installed at a [depth](../terms.md#depth) that
  ships hooks — the `ts-server`, `react-next`, `react-spa`, `react-native`,
  and `python` [lanes](../terms.md#lane) all do. The `cargo` and `go` lanes
  ship none of this family.
- `jq` on your PATH. Every hook in the family degrades safely without it, but
  the registry reads below do not.

## Steps

1. List the moments your project wires. From your project root:

   ```bash
   jq -r '.hooks | keys[]' .claude/settings.json
   ```

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
   is right after a tool call, `UserPromptSubmit` is when you send a message.
   Your list may be shorter; an install only registers what it copied.

2. List the hook files your install copied, and read one hook's own header —
   the one-line description every hook must carry as its second line:

   ```bash
   ls .claude/hooks/*.sh | wc -l
   sed -n '2p' .claude/hooks/inject-matching-rule.sh
   ```

   ```text
   23
   # inject-matching-rule.sh — PostToolUse hook — path-scoped just-in-time delivery of .claude/rules/*.md summaries
   ```

   (23 is the full set in a getff development checkout; a consumer install
   copies only its lane's hooks.) That header line is not decoration — the
   family's fact cards quote it verbatim, so the page's "what it does" row is
   the file speaking for itself.

3. Watch one fire. Feed a hook the exact JSON your harness would send after an
   edit to a file it watches — here, editing a hook script, which four rules
   claim:

   ```bash
   printf '%s' '{"tool_name":"Edit","session_id":"docs-demo-1","tool_input":{"file_path":"'$PWD'/.claude/hooks/inject-matching-rule.sh"}}' \
     | CLAUDE_PROJECT_DIR="$PWD" bash .claude/hooks/inject-matching-rule.sh
   ```

   ```json
   {
     "hookSpecificOutput": {
       "hookEventName": "PostToolUse",
       "additionalContext": "📎 Path-relevant rule — Rule: pin bare tool installs (pip install pkg==ver, npm install -g pkg@ver) in workflows AND repo shell scripts; use npm ci --prefix, not npm install. See ci-tool-pinning.md §1-§2. (see .claude/rules/ci-tool-pinning.md)\n📎 Path-relevant rule — Rule: every CC hook must carry @dual-pair or @cc-only-rationale; agents/skills with a CC hook counterpart declare the same anchor. See dual-implementation-discipline.md §6. (see .claude/rules/dual-implementation-discipline.md)\n📎 Path-relevant rule — Internal machinery (hooks/skills/scripts) is English-only; human-facing output follows AIF_HOOK_LANG (ru→Russian, else English); match-data (triggers, detection patterns) stays bilingual. See §1-§2. (see .claude/rules/language-discipline.md)\n📎 Path-relevant rule — ZCode parity doctrine — full parity is the goal (CC-first + AI-agnostic by design). Before editing hooks or render-harness-config, check §2 census for whether the hook has ZCode parity / plugin twin / CC-only rationale, and §3 for whether a Wave B stage changes its classification. (see .claude/rules/zcode-parity-doctrine.md)\n"
     }
   }
   ```

   That JSON is what Claude Code turns into context your agent reads after
   such an edit. The same hook on a path no rule claims — a page under
   `docs/`, say — prints nothing and exits 0: matching is by path pattern, and
   silence is the honest answer for "no rule applies"
   ([inject-matching-rule](../reference/D/inject-matching-rule.md) has the
   full mechanics).

## Verify

- Every event from step 1 appears in the [hooks family](../reference/D.md)
  table, and every hook file from step 2 has a page: the file name minus
  `.sh` is the page name — `deps-hash-check.sh` is documented at
  [deps-hash-check](../reference/D/deps-hash-check.md).
- The live fire's 📎 lines name rule files that exist in your rules folder.
  A line pointing at a file you do not have means the install and the rules
  drifted apart — re-run the installer's dry-run to see what it would refresh.
- Re-run step 3 with a `file_path` in a directory no rule claims. Silence is
  the pass condition.

## Variations

- **A consumer install, not a getff checkout.** The outputs above come from a
  checkout, where all 25 family members live. Your install ships a subset:
  the cards' ships-to row says which — `framework:` lanes get the eight
  user-facing hooks, `plugin` members need the getff plugin installed, and
  anything marked `not installed on any lane` never leaves the getff team's
  own repository.
- **You want to see a hook say no, not just advise.** Most of this family
  injects and always exits 0. The `check-` members are
  [gates](../terms.md#gate) that can block an edit; their pages each carry a
  paired RED demo you can run the same way this guide ran an injector.
- **A hook fires and you want it to stop.** Its registration is an entry in
  your project's `.claude/settings.json`; removing the entry unwires the
  moment, and the file it ran stays on disk for the next time you want it.
  The hook pages name the registry they are wired in.
