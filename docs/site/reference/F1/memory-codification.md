---
title: memory-codification rule
description: The rule that a durable convention never lives only in agent memory — the session writes it into the repository first, then reduces the memory entry to a pointer.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/memory-codification.md
  - .agents/rules/00-rule-index.md
  - .claude/hooks/inject-memory-codification.sh
  - .claude/settings.json
  - packages/core/hooks/inject-memory-codification.test.ts
  - .agents/roles/memory-codification-auditor.md
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: hook-registration-line, stack: repo, date: 2026-10-11, result: settings-line-182 }
docs-refresh: deferred — re-verified 2026-10-12, the cited overview changed only its batch-status paragraph, class-list links and frontmatter sources (the all-30 refresh after the F1b merge); this sheet's only anchor into it, #how-to-read-a-rule-page, is untouched; clears at the next gold refresh of this page
---

# memory-codification rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-memory-codification plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `memory-codification` |
| kind | rule |
| ships-to | framework |
| description | memory-codification discipline rule — §2 what counts as a *durable convention* (trigger + non-triggers), §3 the write-time codify-then-pointer discipline, §4 compensating mechanisms (local-audit grep + auditor agent; no CI by constraint), §5 anti-patterns, §6 promotion / retirement. |
| source | `.agents/rules/memory-codification.md:7` |
| class | B |
| fires | writing a durable behavioural convention to agent memory. |
| channels | hook |
<!-- getff:end section=F1-card-memory-codification -->

<!-- vale on -->

## Explanation

This project's whole thesis is that a convention should fail loudly when broken, not
wait for someone to remember it. Agent memory defeats that on every axis: a note in a
user's memory store is not in the repository, not in git history, reachable by no CI
check, and invisible to a teammate or a fresh session on another machine. A rule
recorded only there is enforced by nothing but the recall of whichever session happens
to load it — an audit found fifteen such stranded conventions before this rule
existed.

The [rule](../../terms.md#rule) fires when a session is about to write a durable
convention to memory — guidance of the form "always do X", "when Y, do Z". Its
discipline is codify-then-pointer, in the same step: write the convention into the
repository at its natural home, then reduce the memory entry to a one-line pointer
naming the repo path and the commit that codified it. The repository copy becomes the
source of truth; memory becomes an index. When codifying immediately would expand an
unrelated pull request, the exception is a memory entry carrying an explicit
`TODO-codify:` marker — a tracked debt, not a stranded convention.

Not everything in memory is a durable convention. Session state, identity, reference
pointers, and progress notes legitimately stay there. The rule's own test: *would a
fresh session on a different machine need this to behave correctly?* If no, codifying
it is bloat — the rule names that failure `#codify-everything`.

The `class` row is `B` and the ceiling is structural, not a deferral. A CI test over
memory is a category error — the store is outside the repository by construction, so
the rule file rejects the whole idea (`#test-the-memory`); the fix is moving the
convention into the repository, not testing memory in place. What the framework does
ship is the card's `hook` [channel](../../terms.md#channel): a write-time injector
that fires the instant a session saves a file to a memory path, delivering the
codify-then-pointer reminder at the moment of the write. The registration is live:

```bash
grep -n "inject-memory-codification" .claude/settings.json
```

```text
182:            "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/inject-memory-codification.sh\""
```

Two session-run mechanisms stand behind the write-time reminder: a local-audit grep
that flags convention-shaped memory entries lacking any codification pointer, and a
named auditor agent that does the semantic "is this a durable convention?" triage the
grep cannot. Both are push sweeps run by a session — a sweep, not a
[gate](../../terms.md#gate).

What the rule does not do: a session on a machine without the registration writes to
memory without any reminder, and no mechanism in the repository can see it happen. And codifying
is not a quality stamp — the repo copy still needs its own enforcement
[channel](../../terms.md#channel), which this rule leaves to the home it lands in.

## Evidence

Checked 2026-10-11 against the working tree this batch was written in.

- The hard constraint (memory lives outside repo and CI; ceiling = B follows from it):
  `.claude/rules/memory-codification.md:18` and the Class line at `:5`.
- The codify-then-pointer discipline and the `TODO-codify:` exception: `:37` to `:43`.
- The codify-vs-leave test ("fresh session on a different machine"): `:33`.
- The write-time hook and its registration: `.claude/hooks/inject-memory-codification.sh`,
  wired at `.claude/settings.json:182` (the grep above); paired self-tests at
  `packages/core/hooks/inject-memory-codification.test.ts`, where a count of lines
  matching `test(` or `it(` returns 8.
- The local-audit grep and the auditor agent: `:53` to `:67`; the agent file is
  `.agents/roles/memory-codification-auditor.md`.
- The channel marker declaring `hook`: `:3`.
- The index row grading this rule class `B` with channel `hook`:
  `.claude/rules/00-rule-index.md:28`.
