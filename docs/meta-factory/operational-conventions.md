# Operational conventions — non-obvious harness gates + orchestration obligations

> **Status:** Active. Moved from `CLAUDE.md` on 2026-07-31 (session-start-token-audit S2 Task 7)
> to reduce session-start token cost; each section's original location now carries a one-line
> pointer preserving its trigger phrase.
>
> **Authoritative for:** the four operational-convention sections moved from CLAUDE.md —
> (1) umbrella-closure `done.md` convention, (2) promote staging→main mechanics,
> (3) `git update-ref` worktree-desync hazard, (4) meta-orchestrator self-review obligation.
>
> **NOT authoritative for:** project goal — see
> [README.md#why-this-exists](../../README.md#why-this-exists). AI-tooling conventions,
> capability-commit gates, build-vs-reuse discipline, Artifact Ownership Contract — see
> [CLAUDE.md](../../CLAUDE.md). Other operational sections that remain in CLAUDE.md
> (Read-first Step 0, PR strategy, Task-tier routing, etc.) — this doc carries only the four
> sections explicitly moved by S2 Task 7.
>
> **Origin:** session-start-token-audit umbrella, S2 Task 7 — the four sections below were
> identified as "cold" operational content (needed at specific moments, not at every session
> start). Moving them out of the always-on `CLAUDE.md` autoload into this on-demand doc
> reduces per-session-start token cost by ~3,000 bytes / ~750 tokens (projected) without
> losing the convention: each former location in CLAUDE.md carries a trigger-preserving
> pointer to the corresponding section here.

## §1 Umbrella closure convention

When the **last stage** of a multi-stage umbrella merges, the merging session writes a `done.md` file at:

```text
.claude/orchestrator-prompts/<umbrella>/done.md
```

**Schema (binding):**

```text
# <umbrella> — DONE
- Final PR: #<num>
- Closed: <YYYY-MM-DD>
- Summary: <one-line>
```

**When to write:** at the last-stage PR merge only — not at intermediate stage merges. For single-stage umbrellas, write at the one-and-only merge.

**Why this convention:** `priority-score.sh` completion-detection Layer C3 checks `done.md` existence per candidate and tags `status=DONE done_pr=<num> basis=done-md`. This is the load-bearing fallback layer (deterministic, zero gh rate-limit cost, covers the 83% NO-MATCH bucket that branch-prefix and jaccard cannot reach). ADAPT of Cline Memory Bank committed-markdown sub-pattern (SSOT #77 — ~85% problem-class match on storage format; diverges on update trigger: Cline = on-demand AI-signalled, ours = explicit at-merge convention).

## §2 Harness gates — promote / move-ref / merge-forward

> The bullets below were under `### Harness gates` in CLAUDE.md. The always-on bullets that
> remain in CLAUDE.md (agent PR merge gating, CONFLICTING PR merge-forward pointer, 600-line
> markdown gate, Homebrew PATH in hooks) are needed every session; the two moved here are
> needed only at promote / ref-move moments.

### Promote staging→main mechanics (three hard rules)

(1) the promote PR MUST have `head=staging` (base=`main`) — the §7 real-commit trailer backstop in `.github/workflows/audit-self.yml` (`continue-on-error` only when `base_ref==main && head_ref==staging`) is exempt ONLY for that head; a promote from any other branch loses the exemption and the required `ci-success` gate goes RED on pre-existing staging squash-commits whose `Prior-art:` trailers live in their PR bodies, not as git trailers (`--no-verify` cannot help — `ci-success` is server-side). (2) the maintainer MUST merge the promote as a **merge commit, never squash** — squash collapses to one parent and severs `staging`↔`main` ancestry, so the next promote surfaces false conflicts across ~all files. Recovery from a prior squash: a content-free reconciling merge (`git commit-tree origin/staging^{tree} -p origin/staging -p origin/main`, tree byte-identical to staging) pushed to `staging` with `--no-verify` (maintainer's hands — agents are deny-listed on `--no-verify`), then the canonical `head=staging` PR is clean + exempt. Precedent: `4ca44598c`. (Codified from memory `feedback_promote_staging_to_main_mechanics`; incident 2026-07-05 getff Wave-0.)

(3) the promote PR MUST carry the maintainer-triggered deep review (`/code-review ultra <PR#>` — operator-only, billed) BEFORE it is merged. The promote is the only stable, reviewable target for the whole staging→main delta; findings are dispatched as separate tasks, never fixed inside the promote, and the pass is recorded in the promote body's `## Review findings` section — a body still reading `Pending` is a merge blocker for the maintainer. Agents cannot launch the review: when listing release remainders they name the exact command and place it before «merge promote» and before `npm publish`. Channel: prose, Class C per [attention-is-not-a-mechanism.md §3](../../.claude/rules/attention-is-not-a-mechanism.md) — promote to a `pr-body` gate arm (base=`main` ⇒ `## Review findings` must not read `Pending`) on the next incident. Incident 2026-09-04: #1597 (682 commits, opened explicitly as «a stable target for the maintainer-triggered deep review») was merged with `## Review findings: Pending` and 0 reviews; the pass is owed post-hoc, before publish. (Codified from memory `feedback_ultrareview_is_a_floor_before_promote_merge`.)

### Never move a branch ref with `git update-ref` — check EVERY worktree first

`git branch -f` refuses a branch checked out in *any* worktree; **`git update-ref` does not**. A script that only tests `git symbolic-ref --short HEAD` is testing *the directory it happens to run in*, so when it runs from a linked worktree it concludes «not checked out» and moves a ref that another checkout is sitting on. The ref advances while that checkout's index and working tree stay behind, and every file added in between shows up there as a **staged deletion** — one `git commit -a` from wiping them. Correct test: `git worktree list --porcelain` → find the worktree holding `refs/heads/<branch>` → fast-forward it *there* (`git -C <path> merge --ff-only`), so ref + index + tree move together. Incident 2026-07-24: `~/.claude/sync-branch-from-api.sh` (operator-global, called by `refresh-aif-base.sh`'s host arm) desynced the main checkout to 29 files / 4737 staged deletions including dozens of `kickoff.md`; repaired with `git restore --source=HEAD --staged --worktree .` after proving the index matched an old commit's tree exactly (i.e. zero real local edits). The container-side arm of [`refresh-aif-base.sh`](../../.claude/skills/aif-doctor/helpers/refresh-aif-base.sh) (detach → `branch -f` → re-attach, lines 83-94) has always been correct — only the host arm was not.

## §3 Meta-orchestrator self-review obligation

Before any `/meta-orchestrator` session hands off a meta-kickoff to an orchestrator, spawn a Phase -1 cold-review (read-only Agent, adversarial) on the generated `<umbrella>-meta-launch/kickoff.md` against the umbrella's `kickoff.md`. One REVISE round maximum. The orchestrator's own Phase -1 reviews the dispatch prompt — it does NOT cover meta-synthesis bugs. Evidence: 2026-05-28 — a BLOCKER in §3 stage-gate logic was caught only by meta-level cold-review. Home note (audited 2026-07-21): no `meta-orchestrator` global skill exists, so this section IS the home until one is created. (Codified from memory `feedback_meta_orch_self_reviews_own_kickoff`.)

## See also

- [CLAUDE.md `Operational conventions`](../../CLAUDE.md) — the remaining always-on operational bullets (agent PR merge gating, CONFLICTING PR merge-forward, 600-line markdown gate, Homebrew PATH in hooks, Phase -1 principle-test allowlist probe, Pre-dispatch in-flight probe).
- [CLAUDE.md `Harness gates`](../../CLAUDE.md) — the parent section that formerly carried §2's two bullets.
- [.claude/rules/git-conflict-merge-forward.md](../../.claude/rules/git-conflict-merge-forward.md) — the merge-forward recipe (referenced by the always-on CONFLICTING PR bullet that stays in CLAUDE.md).
- [docs/meta-factory/research-patches/2026-07-26-session-start-token-attribution.md](research-patches/2026-07-26-session-start-token-attribution.md) — S1 attribution patch that projected this move's token savings.
