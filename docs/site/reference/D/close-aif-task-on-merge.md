---
title: close-aif-task-on-merge hook
description: A merged PR should close the aif task it harvested — but until now that close ran only when an agent remembered step 5 of the harvest flow. This hook runs it at the moment the merge happens, and announces loudly on every path where it could not.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/close-aif-task-on-merge.sh
  - .claude/hooks/lib/hook-emit.sh
  - .claude/settings.json
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/terms.md
  - packages/core/hooks/close-aif-task-on-merge.test.ts
  - packages/runtime-bridge/src/cli/harvest.ts
executed:
  - { example: close-aif-task-on-merge-costs-nothing-on-a-non-merge-command, stack: repo, date: 2026-10-07, result: silent }
  - { example: close-aif-task-on-merge-announces-an-unresolvable-merge-selector, stack: repo, date: 2026-10-07, result: printed }
  - { example: close-aif-task-on-merge-ignores-disable-auto, stack: repo, date: 2026-10-07, result: silent }
docs-refresh: deferred — re-verified 2026-10-07, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# close-aif-task-on-merge hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-close-aif-task-on-merge plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `close-aif-task-on-merge` |
| kind | hook |
| ships-to | not installed on any lane (no-lane) |
| description | PostToolUse(Bash) hook — close the aif task a merged harvest PR names |
| source | `.claude/hooks/close-aif-task-on-merge.sh:2` |
| event | `["PostToolUse"]` |
| matcher | `["Bash"]` |
| delivery | `["@cc-only-rationale"]` |
<!-- getff:end section=D-card-close-aif-task-on-merge -->

<!-- vale on -->

## Explanation

When a finished task is harvested, the PR that merges it names the task it closes in an
`aif-task:` line. The runtime-bridge has been able to close that task
for a while — but only when the agent running the merge remembered to run the close command
afterwards. A merge that lands and a task that stays open until someone notices is exactly
the kind of manual tail this repository treats as a defect, so this hook moves the close to
the moment the merge happens.

After every Bash call, the hook asks one cheap question first: did this command even look
like a merge? Most calls are not, and they cost nothing and stay silent. When a command
segment really is `gh pr merge …` or the REST merge endpoint used when GraphQL is down, the
hook reads the body of that PR, collects every `aif-task:` line in it, and — only once the PR is
actually MERGED, the aif API answers its health check, and the harvest entrypoint and tsx
are both present — calls `harvest.ts <id> --report-merge <prUrl>` for each task. That
return route re-proves the merge, the PR-to-task mapping and the activity order itself,
so the hook adds no trust of its own: a wrong PR, or one that has not merged, still writes nothing.

The hook is fail-open on purpose. The merge has already happened by the time it runs, so
there is nothing left to gate — there is only work left to announce. Every path where the
close could not run (a PR selector built from a shell variable, `gh` missing, the aif API
unreachable, a close that failed) ends with a notice naming exactly what stayed open and the
command to run later. Nothing is swallowed.

Here are the three shapes you will actually see, with their real output. A non-merge
command costs nothing and prints nothing:

```bash
printf '%s' '{"tool_name":"Bash","tool_input":{"command":"printf done > log"},"cwd":"'$PWD'"}' \
  | bash .claude/hooks/close-aif-task-on-merge.sh
echo "exit=$?"
```

```text
exit=0
```

A merge whose selector could not be resolved announces the miss instead of guessing:

```bash
printf '%s' '{"tool_name":"Bash","tool_input":{"command":"gh pr merge \"$BRANCH\" --squash"},"cwd":"'$PWD'"}' \
  | bash .claude/hooks/close-aif-task-on-merge.sh
```

```text
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"⚠ close-aif-task-on-merge: a PR merge ran but its selector could not be resolved (shell variable or unbalanced quoting) — its aif task was NOT checked. If the PR carries an aif-task line, close it: tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --close-merged"}}
⚠ close-aif-task-on-merge: a PR merge ran but its selector could not be resolved (shell variable or unbalanced quoting) — its aif task was NOT checked. If the PR carries an aif-task line, close it: tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --close-merged
```

The same notice reaches the session twice on purpose: the JSON line is what the harness
injects as context for the model, the plain line on stderr is what a human tailing the log
reads. Arming auto-merge is not a merge, so it also stays silent:

```bash
printf '%s' '{"tool_name":"Bash","tool_input":{"command":"gh pr merge --disable-auto"},"cwd":"'$PWD'"}' \
  | bash .claude/hooks/close-aif-task-on-merge.sh
echo "exit=$?"
```

```text
exit=0
```

## Evidence

- `.claude/hooks/close-aif-task-on-merge.sh:12` carries the why: `# WHY (operator directive 2026-09-28 — every manual step is a defect): PR #1862 taught harvest.ts`.
- The cheap pre-filter is lines 57 to 60 — a command that does not contain both `gh` and
  `merge` exits before any dependency check:
  `case "$INPUT" in` at `.claude/hooks/close-aif-task-on-merge.sh:57`, with the
  `*) exit 0 ;;` arm at line 59.
- The REST arm distinguishes a merge from a status probe: line 167 requires the
  `/pulls/<n>/merge` path and line 168 requires `--method PUT` —
  `grep -Eq '(-X|--method)[[:space:]=]*PUT([[:space:]]|$)' <<<"$seg" || continue`.
- The unresolved-selector notice is lines 208 to 210; the not-yet-merged notice (state read
  at line 258, compared at 268) names the command to run once the PR lands.
- The aif-unreachable path is a SKIP, not a pass, by its own wording —
  `.claude/hooks/close-aif-task-on-merge.sh:292`:
  `⚠ close-aif-task-on-merge: the PR merged but the aif API at $AIF_URL is unreachable (aif-tunnel off?) — the task was NOT closed. This is a SKIP, not a pass. With the tunnel up, run: $(_later_cmds)`.
- The dual output channel is one shared definition, `.claude/hooks/lib/hook-emit.sh:65` —
  `_emit_skip` prints the JSON envelope to stdout for the harness and the plain message to
  stderr for the human.
- Registered on this repo's own harness at `.claude/settings.json:191`:
  `"command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/close-aif-task-on-merge.sh\""`
  (PostToolUse, matcher `Bash`).
- Paired test: `packages/core/hooks/close-aif-task-on-merge.test.ts` — 22 `it` blocks cover
  the segment parser, the selector forms, the fail-open notices and the
  close-through-harvest happy path.
- The close itself goes through `packages/runtime-bridge/src/cli/harvest.ts` `--report-merge`
  (line 342 of the hook builds that invocation), the exact-PR form of the return channel —
  the hook header's `spec:` pointer at `.claude/hooks/close-aif-task-on-merge.sh:10` names
  it as the single source of the close semantics.
