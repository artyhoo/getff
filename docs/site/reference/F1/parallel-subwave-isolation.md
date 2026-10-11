---
title: parallel-subwave-isolation rule
description: The rule that parallel agent sessions never share a working directory — each gets a git worktree — and that launching the execution of an umbrella stage is an operator decision, not something a session holding the kickoff may do.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/parallel-subwave-isolation.md
  - .agents/rules/00-rule-index.md
  - packages/core/principles/29-worker-dispatch-channel.test.ts
  - scripts/create-worktree.sh
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: no-isolation-test, stack: repo, date: 2026-10-11, result: zero-matches }
---

# parallel-subwave-isolation rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-parallel-subwave-isolation plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `parallel-subwave-isolation` |
| kind | rule |
| ships-to | framework |
| description | parallel-subwave-isolation rule — §1 git worktree requirement for parallel Sonnet sessions, §2 sequential-fallback escape hatch, §3 anti-patterns (`#shared-workdir-parallel`, `#branch-race-on-checkout`, `#mutating-reviewer-in-shared-tree`), §4 promotion / retirement triggers, §5 §1.7 self-reflexive note, §6 sub-agent dispatch tenets (the D6 allow/forbid pair + anti-expansive-reading protections). |
| source | `.agents/rules/parallel-subwave-isolation.md:13` |
| class | C |
| fires | dispatching parallel sub-wave / batch AI sessions; launching execution workers from a kickoff (subagent / aif dispatch / `claude -p`). |
| channels | paths:(1), edit-time inject |
<!-- getff:end section=F1-card-parallel-subwave-isolation -->

<!-- vale on -->

## Explanation

Two agent sessions working in the same directory are two writers sharing one
notebook. Git tries to help, but the shared `.git` index is a race: one session
creates a branch, the other commits first, and work lands on the wrong branch —
which is what happened the day this [rule](../../terms.md#rule) was written, when a
parallel rollout's commit ended up on a sibling wave's branch and needed manual
surgery to recover. The discipline is one sentence: parallel sessions get git
worktrees, each an isolated directory with its own checkout; if worktree creation
fails, the fallback is running sequentially, never sharing the directory. A portable
helper script creates the worktree and picks the correct base branch automatically,
because the older raw form hard-coded a base that went stale when the project moved
its trunk.

The `class` row is `C`, and the rule file is unusually explicit about why. The
enforcement primitive here — detect-and-prevent shared-directory work — was
deliberately *not* built: an upstream skill already implements it, was verified
against this project's incident class, and is referenced as the mature precedent
instead. Building a second one would be the reinvention the framework's own
build-versus-reuse discipline forbids. So the rule mandates; upstream mechanics and
session habits carry the enforcement. There is no companion test, and that absence
is itself checkable:

```bash
ls packages/core/principles/ | grep -c "parallel"
```

```text
0
```

One slice of the rule *is* mechanically gated, and the rule names it precisely. Its
final section states the sub-agent dispatch tenets, including exactly one forbidden
class of action: launching the *execution* of an umbrella stage from a kickoff —
by sub-agent dispatch, an automated dispatch, or a headless CLI run alike. A session
holding a kickoff holds a specification, not the decision to execute it; the
operator picks the channel. That launch-ban has a deterministic
[gate](../../terms.md#gate) (a companion principle plus its hook twin) whose regex
and whose class statement are required to move together.

The `channels` row names `paths:(1), edit-time inject`: the rule's scope is the
orchestrator-prompts directory, and an edit-time
[injector](../../terms.md#channel) delivers a one-line reminder when a kickoff or
dispatch input is being written — the moment the temptation to self-dispatch
appears.

What the rule does not do: it cannot detect two sessions that share a directory
quietly — no test watches working-tree topology — and its protection is written as
prose precisely because the violation is a judgment call about *who decided to
launch*, not a pattern in a file.

## Evidence

Checked 2026-10-11 against the working tree this batch was written in.

- The worktree discipline, the portable helper, and the stale-base warning:
  `.claude/rules/parallel-subwave-isolation.md:18` to `:34` (`§1`), origin incident
  at `:16`.
- The sequential fallback: `:36` to `:40` (`§2`).
- The anti-patterns, including the mutating-reviewer incident: `:42` to `:47` (`§3`).
- The Class-C header and the dropped build target (upstream referenced instead,
  SSOT #65): `:11` and `:49` to `:52` (`§4`).
- The dispatch tenets, the single forbidden class, and the operator-picks-channel
  close: `:59` to `:82` (`§6`); the negative protections and the self-test:
  `:84` to `:98`.
- The mechanical complement for tenet 3 and its move-together requirement:
  `:107` to `:112` — `packages/core/principles/29-worker-dispatch-channel.test.ts`
  plus `.claude/hooks/check-worker-dispatch-channel.sh`.
- The edit-time scope markers: `:2` to `:4` (`paths:` frontmatter) and `:8`
  (`<!-- globs: -->`), delivered by `.claude/hooks/inject-matching-rule.sh`.
- The helper the rule names: `scripts/create-worktree.sh`.
- The index row grading this rule class `C` with channels `paths:(1), edit-time
  inject`: `.claude/rules/00-rule-index.md:30`.
