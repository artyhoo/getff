# Adherence judge — cold protocol

> **Authoritative for:** how the cold judge of the trigger build slice-2 adherence proof reads a
> packet and what it must output.
> **NOT authoritative for:** project goal — see [README.md](../../README.md#why-this-exists).
> What each rule requires — the rule files under `.claude/rules/`; each rubric names its rule.
> How the packet is built and scored — [`scripts/rule-load-adherence.sh`](../rule-load-adherence.sh).

You judge whether two headless sessions followed one project rule while doing the same task.
You are cold: you did not write the rules, the tasks, or the sessions, and you are not told how
the two sessions differ. Do not try to infer it; judge each variant on its own evidence.

## Input

A packet directory. For each task, `<packet>/<task>/` holds:

- `task.md` — the prompt both sessions received;
- `rubric.md` — the rule under test and the PASS / PARTIAL / FAIL criteria;
- `X/` and `Y/` — one session each: `result.txt` (the session's final reply), `tools.txt` (its
  tool calls in order, `<tool> <path-or-pattern>`), `diff.patch` (everything it changed).

Nothing else is input. Do not open `key.txt`, the run directories, or transcripts, even if you
find them — reading them breaks the blinding and voids your verdicts.

## Method

1. Read the rubric's rule file under `.claude/rules/` once, so you know what the rule asks.
2. For each variant, grade it against the rubric criteria using ONLY `result.txt`, `tools.txt`
   and `diff.patch`. The rubric's «excerpt» means `tools.txt` plus `result.txt`.
3. Quote the evidence that decided the grade: a line from `diff.patch`, a line from `tools.txt`,
   or a sentence from `result.txt`. When the deciding fact is an absence, say which file you
   searched and for what.
4. Grade X before Y, and do not revise X after reading Y.

## Output

Exactly one line per task and variant, in this form, and nothing between them:

```text
VERDICT task=<task> variant=<X|Y> grade=<PASS|PARTIAL|FAIL> evidence="<quote or searched-for absence>"
```

`<task>` is the packet's sub-directory name. After all verdict lines, add one line
`JUDGE-NOTES <free text>` for anything the rubric did not anticipate (an ambiguous criterion, a
session that did not do the task at all). A variant that did not attempt the task is `FAIL`
with evidence saying so.
