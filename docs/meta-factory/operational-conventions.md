# Operational conventions — non-obvious harness gates + orchestration obligations

> **Status:** Active. Moved from `CLAUDE.md` on 2026-07-31 (session-start-token-audit S2 Task 7)
> to reduce session-start token cost; each section's original location now carries a one-line
> pointer preserving its trigger phrase.
>
> **Authoritative for:** the four operational-convention sections moved from CLAUDE.md —
> (1) umbrella-closure `done.md` convention, (2) promote staging→main mechanics,
> (3) `git update-ref` worktree-desync hazard, (4) meta-orchestrator self-review obligation —
> plus (5) §4, the `disable-model-invocation` invocation-channel contract (added 2026-09-08);
> §4's canonical line is the SSOT every carrier `SKILL.md` copies verbatim.
>
> **NOT authoritative for:** project goal — see
> [README.md#why-this-exists](../../README.md#why-this-exists). AI-tooling conventions,
> capability-commit gates, build-vs-reuse discipline, Artifact Ownership Contract — see
> [CLAUDE.md](../../CLAUDE.md). Other operational sections that remain in CLAUDE.md
> (Read-first Step 0, PR strategy, Task-tier routing, etc.) — this doc carries only the four
> sections explicitly moved by S2 Task 7, plus §4.
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

`git branch -f` refuses a branch checked out in _any_ worktree; **`git update-ref` does not**. A script that only tests `git symbolic-ref --short HEAD` is testing _the directory it happens to run in_, so when it runs from a linked worktree it concludes «not checked out» and moves a ref that another checkout is sitting on. The ref advances while that checkout's index and working tree stay behind, and every file added in between shows up there as a **staged deletion** — one `git commit -a` from wiping them. Correct test: `git worktree list --porcelain` → find the worktree holding `refs/heads/<branch>` → fast-forward it _there_ (`git -C <path> merge --ff-only`), so ref + index + tree move together. Incident 2026-07-24: `~/.claude/sync-branch-from-api.sh` (operator-global, called by `refresh-aif-base.sh`'s host arm) desynced the main checkout to 29 files / 4737 staged deletions including dozens of `kickoff.md`; repaired with `git restore --source=HEAD --staged --worktree .` after proving the index matched an old commit's tree exactly (i.e. zero real local edits). The container-side arm of [`refresh-aif-base.sh`](../../.claude/skills/aif-doctor/helpers/refresh-aif-base.sh) (detach → `branch -f` → re-attach, lines 83-94) has always been correct — only the host arm was not.

## §3 Meta-orchestrator self-review obligation

Before any `/meta-orchestrator` session hands off a meta-kickoff to an orchestrator, spawn a Phase -1 cold-review (read-only Agent, adversarial) on the generated `<umbrella>-meta-launch/kickoff.md` against the umbrella's `kickoff.md`. One REVISE round maximum. The orchestrator's own Phase -1 reviews the dispatch prompt — it does NOT cover meta-synthesis bugs. Evidence: 2026-05-28 — a BLOCKER in §3 stage-gate logic was caught only by meta-level cold-review. Home note (audited 2026-07-21): no `meta-orchestrator` global skill exists, so this section IS the home until one is created. (Codified from memory `feedback_meta_orch_self_reviews_own_kickoff`.)

## §4 `disable-model-invocation` — an invocation-channel flag, not a permission

<!-- SSOT anchor. The blockquote below is the canonical line: every SKILL.md carrying
     `disable-model-invocation: true` copies it VERBATIM, and section 4 of
     scripts/check-skill-drift.sh enforces byte-equality against this file. Edit here first,
     then re-propagate. Note: docs/ is prettier-owned and .claude/skills/ is not, so a prettier
     pass can rewrite this line alone — that is why it deliberately carries no italics or other
     normalisable markup, and why the gate compares whole lines rather than keywords. -->

> **Invocation-channel flag, not a permission.** `disable-model-invocation: true` keeps a skill out of auto-load and out of subagent preload, and stops the Skill tool from invoking it — an explicit `/<name>` from the operator is its only invocation channel, so an agent never self-initiates the procedure. It does **not** seal the file: an agent already asked to do this work may read the SKILL.md and execute its documented steps, and doing so is correct behaviour, not a workaround. <!-- canonical: invocation-channel-flag -->

**Carriers (swept 2026-09-08):** `.claude/skills/arch/`, `dispatcher/`, `harvest/`, `pipeline/`. Two of the four — `arch` and `pipeline` — are **consumer-shipped** at the `env` tier (they appear in 8 of the 11 `tests/install-sh/baselines/` trees), so the canonical line is a consumer-facing claim and its `](../../../docs/…)` pointer is rewritten to an upstream blob URL by `transform_internal_refs` (setup.d/lib.sh:144) at install time; `dispatcher` and `harvest` stay operator-axis. Nothing under `packages/`, `plugin/`, `setup.d/` or top-level `skills/` carries the flag. `.claude/skills/aif-doctor/SKILL.md` names it only to state its own `false` and dispatcher's `true` — no framing claim, left as-is. The gate below is maintainer-repo only: this doc is not shipped, so section 4 SKIPs in a consumer clone rather than failing.

**What the live documentation says** (fetched 2026-09-08 — <https://code.claude.com/docs/en/skills.md>, <https://code.claude.com/docs/en/sub-agents.md>):

- Frontmatter reference: «Set to `true` to prevent Claude from automatically loading this skill. Use for workflows you want to trigger manually with `/name`. Also prevents the skill from being preloaded into subagents. As of v2.1.196, also prevents the skill from running when a scheduled task fires with the skill as its prompt. Default: `false`.»
- «Control who invokes a skill»: «**`disable-model-invocation: true`**: Only you can invoke the skill. Use this for workflows with side effects or that you want to control timing, like `/commit`, `/deploy`, or `/send-slack-message`.»
- `sub-agents.md`: «You can't preload skills that set `disable-model-invocation: true`, since preloading draws from the same set of skills Claude can invoke.»
- **Docs silent** on reading the file by hand: nothing in either page forbids an agent from opening a `SKILL.md` and following its steps, and no page describes the flag as a depth or recursion guard.

**Drift vs. the 2026-05 reading:** none on the load-bearing half — «auto-load suppressor, not a depth/recursion guard» (D3-MAJOR, `.claude/orchestrator-prompts/meta-orchestrator-linear-autonomous/kickoff.md:44`) and the subagent-preload implication (MINOR-5, `meta-orchestrator-iphase/kickoff.md:105`) both still hold verbatim. Two clauses are **new** since then: the v2.1.196 scheduled-task suppression, and the settings-side `skillOverrides: "user-invocable-only"` escape that reaches the same state without editing the file. The inverse field `user-invocable: false` also exists and is a different flag — it hides the skill from the operator, not from the model.

**Where the misreading comes from, and how it resolves.** The docs' own bullet reads «Only you can invoke the skill», which scans as a prohibition. It is a statement about the _invocation surface_ the harness offers — auto-load, the Skill tool, subagent preload, scheduled tasks — not about who is permitted to perform the work. The three halves the flag conflates, split apart:

| #   | Claim                                                                       | True?                                                                                                                                |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| a   | The skill is not auto-loaded; its description is not in the model's context | **yes**                                                                                                                              |
| b   | The Skill tool will not invoke it; only an explicit `/<name>` will          | **yes**                                                                                                                              |
| c   | An agent may not read the SKILL.md and execute its documented procedure     | **no** — this half is the defect; the file is an ordinary readable file, and executing its steps on request is the correct behaviour |

_Falsifier:_ wrong if the live reference ever states that a `disable-model-invocation` skill's body must not be read or hand-executed, or if the operator declares a specific skill operator-execution-only — in which case that prohibition belongs in that skill's own §0, stated as an operator rule, never inferred from the flag.

**Why this is written down.** The (c) half was missing everywhere and was misread twice, both times costing autonomy: 2026-05-24 (`D3-MAJOR`, the flag described as a depth/recursion guard) and 2026-09-08, when a handoff memory told the next session that `/harvest` was «агенту недоступен» and that reproducing the procedure by hand would be «нарушение, а не смекалка». That session stopped and waited for the operator on work it could have finished. Prose alone had already failed once, so the canonical line above is byte-gated at three channels (`npm run check:skill-drift` → `.husky/pre-push` → `packages/core/principles/14-skill-drift-detection.test.ts`); what stays prose is the _reasoning_ in this section, which no gate can carry.

## See also

- [CLAUDE.md `Operational conventions`](../../CLAUDE.md) — the remaining always-on operational bullets (agent PR merge gating, CONFLICTING PR merge-forward, 600-line markdown gate, Homebrew PATH in hooks, Phase -1 principle-test allowlist probe, Pre-dispatch in-flight probe).
- [CLAUDE.md `Harness gates`](../../CLAUDE.md) — the parent section that formerly carried §2's two bullets.
- [.claude/rules/git-conflict-merge-forward.md](../../.claude/rules/git-conflict-merge-forward.md) — the merge-forward recipe (referenced by the always-on CONFLICTING PR bullet that stays in CLAUDE.md).
- [docs/meta-factory/research-patches/2026-07-26-session-start-token-attribution.md](research-patches/2026-07-26-session-start-token-attribution.md) — S1 attribution patch that projected this move's token savings.
- [scripts/check-skill-drift.sh](../../scripts/check-skill-drift.sh) — section 4 enforces §4's canonical line byte-for-byte across every carrier `SKILL.md`; paired-negative cases in [packages/core/hooks/check-skill-drift.test.ts](../../packages/core/hooks/check-skill-drift.test.ts).
