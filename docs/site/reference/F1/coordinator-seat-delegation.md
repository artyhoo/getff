---
title: coordinator-seat-delegation rule
description: The rule that keeps a supervising coordinator session from running the mechanical pipeline itself — the polling, harvest and PR work goes to a standalone worker with a REPORT contract.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/rules/coordinator-seat-delegation.md
  - .claude/rules/00-rule-index.md
  - .claude/skills/orchestrator/references/chip-worker-template.md
  - .claude/hooks/inject-matching-rule.sh
  - docs/site/reference/F1/egress-no-api-bypass.md
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: chip-report-contract, stack: repo, date: 2026-10-07, result: status-and-attn-lines }
---

# coordinator-seat-delegation rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-coordinator-seat-delegation plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `coordinator-seat-delegation` |
| kind | rule |
| ships-to | framework |
| description | the seat-vs-worker split — §1 the rule, §2 anti-patterns, §3 promotion / retirement. |
| source | `.agents/rules/coordinator-seat-delegation.md:19` |
| class | C |
| fires | a coordinator seat about to run the stage pipeline itself. |
| channels | paths:(2) |
<!-- getff:end section=F1-card-coordinator-seat-delegation -->

<!-- vale on -->

## Explanation

When an AI session spends a long time supervising other sessions, it accumulates
exactly the context that makes doing the work itself feel efficient: it already
knows the branches, the locks, the PR conventions. This [rule](../../terms.md#rule)
draws the line anyway. A coordinator seat keeps the routing decisions — what to
dispatch, in what order, what to accept. The mechanical pipeline that follows a
routing decision — polling the task queue, harvesting a finished branch, writing
the PR body, waiting on CI, merging — goes to a **standalone worker session**
(the "chip worker") that starts with none of the seat's context and works from a
written prompt.

The split is not ceremony. The worker's prompt must stand alone, which forces the
seat to write down what it would otherwise carry in its head — and the worker
reports back in a fixed shape instead of making judgment calls. That shape is
defined in the template the rule points at:

```bash
grep -n "Status: DONE\|^ATTN:" .claude/skills/orchestrator/references/chip-worker-template.md
```

```text
47:Status: DONE | PARTIAL | BLOCKED
50:ATTN:
```

A worker finishes with one of three statuses, and anything it could not decide
becomes an `ATTN:` line for the seat — the template states that the seat keeps
the REPORT and decides every such item, and that the worker never decides an
operator fork. Delegation here is not "hand the work to someone else"; it is
"hand the work to a session structurally incapable of quietly making the
decision only the seat should make".

The delivery [channel](../../terms.md#channel) is dual: reading any file under
the orchestrator skill loads the whole rule (a `paths:` entry in the rule's
frontmatter), and a hook injector also fires a one-paragraph summary when a
command matching the harvest and polling tools is about to run — including the
API-harvest helper this family documents at
[egress-no-api-bypass](egress-no-api-bypass.md). The rule is deliberately scoped
to this operator repository: `.claude/rules/` is not installed into consumer
projects, so this is a framework-only discipline — a consumer of the framework
never receives this file.

The `class` row is `C`, and the rule's own header is honest about why there is
no [gate](../../terms.md#gate): nothing observable marks a session as "a
coordinator seat", so a mechanical block on the harvest commands would also
block the chip worker whose job those commands are. The judgement of "am I the
seat here?" stays with the session reading the rule.

What the rule does not do: it cannot stop a seat that ignores it — the injection
is a reminder at command time, not a lock. And it deliberately does not treat
waiting on CI or merging as triggers: those commands are shared with ordinary
per-stage work, and firing the reminder on them would be noise. The rule's
maintenance section names the escalation — if the seat marker ever becomes
observable, the rule promotes to a gate.

## Evidence

Checked 2026-10-07 against the working tree this batch was written in; citations, counts and captured outputs re-verified 2026-10-10 against the merge-forward tree.

- The rule text: `.claude/rules/coordinator-seat-delegation.md` — `paths:`
  frontmatter at `:3` to `:5`, the `events:` arm patterns at `:6` to `:10`, the
  edit-time injection summary at `:15`, the class-`C` rationale at `:17`, the
  seat-vs-worker statement at `:24` (§1).
- What counts as the mechanical pipeline (the harvest and await CLI entry
  points, the harvest and babysit helpers, task polling) — and what deliberately does not count (CI
  waits, merges) — at `:28`; the out-of-scope list (the dispatcher seat,
  night-mode, the chip worker itself) at `:30`.
- The three anti-patterns (`#seat-runs-the-pipeline`, `#subagent-as-chip`,
  `#worker-decides-fork`) at `:32`.
- The REPORT contract quoted above: the template's separate-session statement
  and "the seat keeps the REPORT and decides every `ATTN:` item" at
  `.claude/skills/orchestrator/references/chip-worker-template.md:6`; the
  `Status:` line at `:47`; the `ATTN:` field at `:50`.
- The `events:` arm is an input of the shared injector:
  `.claude/hooks/inject-matching-rule.sh:24` (PreToolUse Bash matching on
  `tool_input.command`), with frontmatter parsing at `:273`.
- The promotion criterion (a gate once a seat marker becomes observable; two
  more incidents in six months add an orchestrator checklist item):
  `.claude/rules/coordinator-seat-delegation.md:40`.
- The index row grading this rule class `C` with channels
  `paths:(2)`: `.claude/rules/00-rule-index.md:18`.
