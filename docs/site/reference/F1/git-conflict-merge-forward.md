---
title: git-conflict-merge-forward rule
description: The rule that a conflicting pull request branch is un-conflicted by merging the base into it and pushing plain, because the force-push a history rewrite would need afterwards is blocked for agents in every form.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/git-conflict-merge-forward.md
  - .agents/rules/00-rule-index.md
  - .agents/rules/cold-seat-economy.md
  - CLAUDE.md
  - .github/workflows/pr-stale-revert.yml
  - packages/core/hooks/checks/pr-stale-revert-bin.ts
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: in-repo-pointer-lines, stack: repo, date: 2026-10-11, result: 2-CLAUDE-md-lines }
---

# git-conflict-merge-forward rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-git-conflict-merge-forward plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `git-conflict-merge-forward` |
| kind | rule |
| ships-to | framework |
| description | the merge-forward discipline for un-conflicting a published PR branch — §1 the rule, §2 the verified recipe, §3 why rebase+force is a dead end for agents, §4 generated-vs-semantic conflict triage, §5 anti-patterns, §6 promotion/retirement, §8 the stale-base rebuild hazard + its PR-time gate, §9 what to push when the PR carries a fidelity verdict, §10 when a merge of staging into a PR branch is warranted at all, §11 the recovery when a foreign commit lands on your pushed branch. |
| source | `.agents/rules/git-conflict-merge-forward.md:7` |
| class | B |
| fires | CONFLICTING PR; rebase/force-push/merge-in urge. |
| channels | claude-md |
<!-- getff:end section=F1-card-git-conflict-merge-forward -->

<!-- vale on -->

## Explanation

When one merged pull request moves the same generated files a later one touched, the
host marks the later pull request CONFLICTING. The reflex is to replay the branch on the base. On
this team that reflex is a wall: an agent session cannot force-push afterwards — the
direct flag, the "safer" `--force-with-lease`, even pushing the rewritten history to a
new branch are all denied. The rule exists because a session learned this the hard way
(pull request #1058, 2026-07-21): it replayed onto the base, hit the wall twice, and stopped, and the
operator had to diagnose it. Merging the base into the branch instead needed no force
at all.

So the [rule](../../terms.md#rule) is one sentence: merge the base branch INTO the
pull request branch, regenerate the conflicted generated files, verify, and plain-push.
The push is a fast-forward of the remote tip, so no force is ever needed. The rule
file carries a ten-step recipe, and its step 9 is the safety interlock —
`git merge-base --is-ancestor` proves the remote tip is an ancestor of what you are
about to push, which is the definition of a fast-forward. The repository
squash-merges pull requests anyway, so the only payoff of rewriting history — tidy history — is
collapsed into one commit at merge time regardless.

The `class` row is `B` and the `channels` row names `claude-md`, and both are honest
about what a repository can deliver here. The blocking mechanism is a PreToolUse guard
in the operator's own Claude Code settings — `~/.claude/hooks/git-safety.sh`, a file
outside this repository — which fires the moment an agent types a history-rewrite command on a
published branch or any force-push. A [gate](../../terms.md#gate) in CI is
structurally unreachable for the procedure itself: the violation is a command choice
inside an agent session, and by the time anything reached CI the push either
succeeded or had already been blocked. What the repository itself ships is the
always-on pointer in the instruction file every session reads:

```bash
grep -c "merge-forward" CLAUDE.md
```

```text
2
```

Two lines. Line 130 of `CLAUDE.md` routes every merge conflict to this rule; line 144
is the always-on bullet that states the discipline in place, which is the channel the
card declares. The full recipe lives in the rule file.

One adjacent hazard does have an in-repo [gate](../../terms.md#gate). The rule's
§8 covers a different failure: a branch rebuilt on a fresh fork of the current base
silently reverts every file the base moved in between — content lineage a diff
reviewer sees only as 21 changed lines inside a 2,500-line change. That shape is
mechanically detectable at pull-request time, and it ships as its own CI job with an
escape token, `STALE-REVERT: intended — <rationale>`, for deliberate restorations.

What the rule does not do: it cannot stop a person without that operator-level guard
from rewriting history by replay, and it does not decide when a merge of the base is warranted at all —
§10 of the rule file reserves that for the host's own merge-readiness report, which no
local [channel](../../terms.md#channel) sees. It also does not settle what to do when
the pull request carries a standing audit verdict (§9 splits that by what the merge
is for).

## Evidence

Checked 2026-10-11 against the working tree this batch was written in.

- The rule sentence and the reason the replay route is a dead end:
  `.claude/rules/git-conflict-merge-forward.md:14` (`§1`) and `:51` to `:54`
  (`§3`, the three blocked forms; two carry the verified-2026-07-21 mark).
- The ten-step recipe and the step-9 interlock: `:18` to `:39` and `:41`.
- The channel marker declaring `claude-md`: `:3`; the Class-B ceiling rationale
  (operator-global mechanism, CI structurally unreachable, §8 scoped out of the
  ceiling): `:5`.
- The in-repo pointer the example counts: `CLAUDE.md:130` and `CLAUDE.md:144`
  (the always-on `Harness gates` bullet naming this rule file).
- The §8 stale-base [gate](../../terms.md#gate): `.github/workflows/pr-stale-revert.yml`
  runs `packages/core/hooks/checks/pr-stale-revert-bin.ts`; the escape-token
  acknowledgement line the check prints is at `pr-stale-revert-bin.ts:78`.
- The index row grading this rule class `B` with channel `claude-md`:
  `.claude/rules/00-rule-index.md:25`.
