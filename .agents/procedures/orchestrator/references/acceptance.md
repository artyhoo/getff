# orchestrator — acceptance

> **Authoritative for:** the selected orchestrator procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

## Phase 4 — Control and PR

### Reading the REPORT (per agent)

Only the REPORT text, do not dive into the code. Checklist in head (6 items):

1. All VERIFY items ✅?
2. Do the files in `Stat` match what the plan expected?
3. Is `DECISIONS` empty or explainable?
4. Is confidence calibrated to the actual observed verification coverage, with material gaps recorded?
5. Is `ATTN` empty?
6. **Quota check:** add `total_tokens` to the cumulative total, assess the zone. Mention it only if the zone changed; otherwise silence.

All 6 ✅ → ready for the final sanity/source audit below. A confidence label is supplementary; acceptance requires concrete verification receipts. Inspect missing or contradictory evidence before accepting.

Any red in 1-5 → «Recovery patterns» below.
Yellow/Red in #6 → switch working mode.

### Final sanity check, push and PR

Once, before the PR: `git log --oneline <BASE_BRANCH>..HEAD`, `git diff --stat <BASE_BRANCH>..HEAD`, and the `<CHECK_ALL>` command from discovery — once, with build. `Skill('superpowers:verification-before-completion')` owns the evidence-before-claims discipline for this step; the REPORT checklist and Phase 4.5 source audit together form the acceptance gate.

Push and PR creation are the senior's, and the mechanics (branch push, `gh pr create`, body template, the merge-vs-PR menu) are owned by `Skill('superpowers:finishing-a-development-branch')`. Two project details it does not carry: pass `--base` **without** the remote prefix, and title the PR `<TASK_ID>: <short umbrella name>` per the discovery-detected convention. If Phase 0 stashed someone else's WIP, restore it afterwards on the previous branch by SHA, never by position: the stash stack is shared across worktrees and parallel sessions, so `git stash pop` can apply another session's entry. Capture the SHA right after the push (`git stash list --format='%H %gs' | grep '<tag>'`), restore with `git stash apply <sha>`, then drop the entry after re-finding its current `stash@{n}` by tag.

---

## Phase 4.5 — Pre-PR self-audit

**When:** Before `gh pr create` — after REPORT checklist passes, before push.

**Purpose:** honest verify-trace at PR-create time — no unverified claim ships as a checked `[x]`. Steps 1-2 adapt the «Research synthesis workflow» that `superpowers:writing-skills` ships in its bundled `anthropic-best-practices.md` (§«Research synthesis workflow»); steps 3-4 are niche additions.

1. **Cross-reference claims:** For every `[x]` checkbox in the REPORT verify-trace, confirm it references a specific tool-call output (file:line, command result, grep output). If any checkbox says «verified» without a concrete artifact — mark `[ ]` and add `ATTN: unverified claim`.

2. **Citation completeness loop:** For every file:line citation in REPORT or PR body — does the cited line exist, and does it evidence the claim (read the line, not just its presence)? If citations are incomplete → return to Worker for evidence (re-dispatch, do not extrapolate).

3. **Companion delegation audit:** For each `Skill('...')` invocation referenced in this umbrella — was it actually invoked, or just mentioned? If referenced but not invoked, the companion's verification step was skipped. Surface as ATTN if material to PR correctness.

4. **Pre-mark PR body checkboxes** (MANDATORY before `gh pr create` / `gh pr edit --body`): put an **already-checked** `[x]` on everything verified through (a) green CI, (b) a Worker REPORT verify-trace (literally enumerated observed results), (c) reviewer probes (`gh pr diff` / `git show` / grep / DB probe). Leave `[ ]` **only** for the physically pending (visual acceptance / runtime after a migration / third-party access). Do NOT extrapolate «merged means runtime verified» — an `[x]` goes only on an item literally mentioned in the verify-trace. Anti-pattern: copying the kickoff checklist over empty — that shifts the work onto the user, who then re-walks what is already verified. This matters most for aggregating epic→staging PRs.

> If Phase 4.5 audit finds ≥1 unverified claim → escalate before PR creation. Zero ATTN → proceed to push + PR.

---
