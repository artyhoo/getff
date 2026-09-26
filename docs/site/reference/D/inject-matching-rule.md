---
title: inject-matching-rule hook
description: The instant you edit a file, this hook checks which of your project's rules claim that path and hands the agent a one-line summary of each — the right rule at the right moment, not all rules all the time.
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
  - { example: matching-rule-on-a-matching-path, stack: repo, date: 2026-09-25, result: printed }
  - { example: matching-rule-on-a-relative-path, stack: repo, date: 2026-09-25, result: silent }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
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
| description | PostToolUse hook — path-scoped just-in-time delivery of .claude/rules/*.md summaries |
| source | `.claude/hooks/inject-matching-rule.sh:2` |
| event | `["PostToolUse"]` |
| matcher | `["Edit|Write|MultiEdit"]` |
| delivery | `["@dual-pair:rule-path-scoping","plugin"]` |
<!-- getff:end section=D-card-inject-matching-rule -->

<!-- vale on -->

## Explanation

A project with many [rules](../../terms.md#rule) has a delivery problem: load all of them
into every session and they crowd out the work; load none and the agent rediscovers each
one by breaking it. This hook takes the middle road. Every time you edit a file, it looks
at that file's path, checks which rules claim paths like it, and hands the agent a
one-line summary of each match — once per session per rule, never a wall of text.

A rule claims a path by carrying a `globs:` marker on its own line, naming the paths it
applies to. When the agent edits a file under such a path, the rule's own one-line
`inject:` summary arrives as injected context on that very edit. Here it is running in the
getff repository itself — editing the docs-author skill file, which several rules claim:

```bash
printf '%s' '{"tool_name":"Edit","session_id":"docs-demo-mr-1",
  "tool_input":{"file_path":"'$PWD'/.claude/skills/docs-author/SKILL.md"}}' \
  | bash .claude/hooks/inject-matching-rule.sh
```

```text
📎 Path-relevant rule — AI-laziness traps (T1-T21) apply when running R-phases, audits, sample-based investigations, doc-creation of discipline-bearing artefacts, or open-ended tasks on this surface. … (see .claude/rules/ai-laziness-traps.md)
```

Seven rules matched that path; the line above is the first. Each line ends with the rule
it came from, so the agent can open the full text when the summary is not enough.

Two boundaries keep it honest:

- **It only sees paths inside your repository.** The hook strips the repository root from
  the edited file's path, and if nothing was stripped the path was not inside the repo —
  it exits without matching anything. That is why a relative path like
  `.claude/skills/docs-author/SKILL.md` produces nothing: it was never under the repo
  root to begin with.

  ```bash
  printf '%s' '{"tool_name":"Edit","session_id":"docs-demo-mr-2",
    "tool_input":{"file_path":".claude/skills/docs-author/SKILL.md"}}' \
    | bash .claude/hooks/inject-matching-rule.sh
  ```

  ```text
  (nothing — exit 0)
  ```

- **It only fires if you have rules.** A project with no rules directory, or one with no
  markdown files in it, gets one loud notice per session — «no rules corpus found … this
  hook has nothing to inject and will stay silent for the rest of this session» — and
  then quiet. The notice names the directory to fill; the hook never pretends to work
  when it has nothing to deliver.

This hook ships, but the rules it reads are yours. The framework delivers the injector;
your project writes the [rules](../../terms.md#rule) corpus it injects. That split was
corrected the hard way — an earlier claim that the rules corpus itself reached consumers
was retracted after it was measured against the install manifest rather than assumed
(`.claude/hooks/inject-matching-rule.sh:29` records the retraction in the header).

The glob language is deliberately small — a `prefix/**` head, a `*.ext` tail, or an
exact repository path — so a match is always explainable by reading the rule's marker
line. And the whole thing is never a [gate](../../terms.md#gate): it injects advice and
always exits 0.

## Evidence

- `.claude/hooks/inject-matching-rule.sh:2` is the header the card's description row
  quotes: `# inject-matching-rule.sh — PostToolUse hook — path-scoped just-in-time delivery of .claude/rules/*.md summaries`.
- Registration: `.claude/settings.json:123` reads `"matcher": "Edit|Write|MultiEdit"`
  with the command at line 127; the plugin registry registers it too
  (`plugin/hooks/hooks.json:99`). The tool is re-checked defensively at line 57:
  `case "$TOOL" in Edit|Write|MultiEdit) ;; *) exit 0 ;; esac`.
- The dual-pair marker is line 4, `# @dual-pair: rule-path-scoping`, and lines 5-9
  explain the pair: native `paths:` frontmatter delivers the whole rule at read-time,
  this hook delivers the `inject:` summary at edit-time.
- The path-scoped marker must be on its own line: line 100 greps
  `'^[[:space:]]*<!--[[:space:]]*globs:.*-->'`, and the comment above it (lines 98-99)
  says the own-line anchor exists «so prose that documents the syntax … is not
  mis-detected».
- The glob subset is three cases at lines 89-91: `prefix/**` (starts-with), `*.ext`
  (ends-with), exact equality — with the header (lines 20-21) calling it
  «deterministic, no glob engine».
- Outside-repo guard: line 79 computes
  `REL_PATH="${ABS_PATH#"$REPO_ROOT/"}"` and line 80 is
  `[[ "$REL_PATH" = "$ABS_PATH" ]] && exit 0   # outside repo — skip`.
- The empty-corpus notice is built at line 73 and emitted once per session through a
  session-keyed cache file (lines 70-72); the header (lines 23-25) states the shape:
  «Never a permanent silent no-op; never per-invocation spam».
- Summaries: line 116 reads the rule's `inject:` marker; line 117 falls back to the
  rule's first heading; line 119 formats the delivered line as
  `📎 Path-relevant rule — ${summary} (see .claude/rules/${slug}.md)`.
- Once-per-session: line 114 skips a rule whose slug is already in the session cache
  file; line 120 records the slug after injecting.
- Output contract: lines 125-126 wrap the text in
  `{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$ctx}}` — plain
  stdout is ignored for PostToolUse (header lines 17-18).
- The twin is hand-written, not generated: `.claude/hooks/inject-matching-rule.sh:44`
  says `@plugin-transform: manual`, and `plugin/hooks/inject-matching-rule` opens as
  «Plugin-relocated PostToolUse rule-injector — path-scoped just-in-time delivery of the
  CONSUMER's .claude/rules/*.md» (its line 2), resolving the project via
  `CLAUDE_PROJECT_DIR` because `$0` points into the plugin payload.
- Ship status: lines 29-41 of the hook record the GH #934 delivery claim corrected by
  GH #1520 — «the HOOK ships and is registered in consumer projects … The `.claude/rules/`
  CORPUS it reads does NOT ship — it is consumer-owned project data».
- Paired test: `packages/core/hooks/inject-matching-rule.test.ts` — its header (lines
  1-10) names the hook as «the Class-B compensating mechanism for
  .claude/rules/rule-enforcement-channel-selection.md (§4)» and asserts the injection
  contract, the silent non-match case, the once-per-session cache, and the own-line
  anchor guard.
