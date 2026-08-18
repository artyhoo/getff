# Removed-slice ledger — orchestrator-rewrite (D-H9)

> **Authoritative for:** the per-slice disposition of the D-H9 rewrite of
> `.claude/skills/orchestrator/SKILL.md` — the three-way classification of every slice of the
> 512-line pre-rewrite body, and where each removed slice's delta was re-homed.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> The mandate and the review contract — see [kickoff.md](kickoff.md) §1-§3. The skill's own
> content — see [.claude/skills/orchestrator/SKILL.md](../../skills/orchestrator/SKILL.md).

**Baseline:** `.claude/skills/orchestrator/SKILL.md` at `origin/staging` (`b4cb37e044`), 512 lines.
Line numbers below are BASELINE line numbers (`git show origin/staging:.claude/skills/orchestrator/SKILL.md`).

**Upstream versions read for every `RE-DESCRIPTION` claim (T3 — text read, not recalled):**
superpowers **6.2.0** at `~/.claude/plugins/marketplaces/superpowers-dev/`
(`.claude-plugin/plugin.json:4`). Upstream citations are `<skill>/SKILL.md:<line>` within that tree.

## Classification summary

| Class | Slices | Meaning |
|---|---|---|
| `DELTA` | 17 | project-unique; no upstream owner. Kept (compressed where it duplicated its own references/). |
| `RE-DESCRIPTION` | 10 | an upstream skill, or this skill's own `references/` file, already owns it. Collapsed to a binding. |
| `MIXED` | 9 | re-description wrapping an embedded delta. Split: wrapper → binding, delta → re-homed. |

## The ledger — one row per removed or collapsed slice

| # | Baseline §/lines | Class | Upstream / SSOT owner | Delta re-homed at |
|---|---|---|---|---|
| 1 | §Glossary — three roles, 26-36 | RE-DESCRIPTION | `references/glossary.md:5-11` (roles), `:37-39` (depth-2 limit), `:31-35` (what is not a role) — that file's own authority header claims exactly this scope | none removed — the reference already held the full text; body now carries a one-line binding |
| 2 | §Vocabulary alignment — companions, 27-29 | RE-DESCRIPTION | `references/rationale.md:7-16` (the 1:1 mapping table) | none removed; binding only |
| 3 | «An implementation of two patterns from Anthropic…», 33-38 | MIXED | `references/rationale.md:38-40` (Provenance — same two patterns, same source link) | delta = the goal line («senior-context isolation + max reasoning quality + one PR per umbrella») → kept inline at [SKILL.md §Roles, vocabulary and provenance](../../skills/orchestrator/SKILL.md) |
| 4 | §Default — Mode A, model-tier caveat, 72 | RE-DESCRIPTION | `references/rationale.md:20-26` (the opusplan-billing history + the verify-on-your-setup instruction) | none removed; the body's model ladder keeps a one-clause pointer |
| 5 | §Three ways to do the work, blockquote 82-88 | MIXED | none upstream — but the same rule is stated twice in the same file: prose blockquote 82-88 vs the canonical matrix 94-103 | delta = none unique to the blockquote; the matrix (94-103) is retained verbatim in substance as the single statement |
| 6 | §Cross-session dispatch, Step-0 restatement, 111 | RE-DESCRIPTION | `using-git-worktrees/SKILL.md:16-33` (Step 0, `GIT_DIR != GIT_COMMON`, submodule guard, skip-nested) | none removed; binding names the upstream section |
| 7 | §Cross-session dispatch, «Quick commands», 113 | RE-DESCRIPTION | `using-git-worktrees/SKILL.md:92-98` (the `git worktree add` fallback) | **none — and its removal repairs a divergence:** upstream `:53-57` orders native worktree tools FIRST and `:164` names bypassing them «the #1 mistake». A bare `git worktree add` recipe in our body taught the anti-ordering. Policy delta (worktree = default, not consent-gated) retained inline |
| 8 | §Phases quick overview, 149-159 | DELTA (kept) | — | kept: the `-1 … 4.5` sequence is this skill's declared authoritative scope and is cited by consumers (`pipeline/SKILL.md:425`, `templates/meta-kickoff.template.md:189`) |
| 9 | §Phase -1, «why two reviewers» prose, 214 | MIXED | `references/rationale.md:28-32` (why two, the blind-spot argument, the ROI numbers) | delta = the must-trigger/skip-OK lists (216-224) → kept inline; the rationale prose → binding |
| 10 | §Phase -1 §Subagent implementation table, 232-241 | DELTA (kept) | — | kept **deliberately**: `references/phase-minus-1.md:4` declares itself NOT authoritative for this table and points back at the body. Removing it would leave the pair with no owner |
| 11 | §Phase 0 — Pre-flight bash block, 249-260 | MIXED | generic git (`git stash push`, `git fetch`, `git checkout -b`); upstream workspace creation is `using-git-worktrees/SKILL.md:47-98` | delta = «ask before stashing someone else's WIP» (262) + branch-off-`<BASE_BRANCH>` → kept inline, compressed to two lines |
| 12 | §Phase 0 handoff pointer, 264 | MIXED | `executing-plans/SKILL.md:14` — upstream itself says «If subagents are available, use `subagent-driven-development` instead of this skill» | **binding repaired, not just moved:** the pointer now routes to SDD (the loop we actually run), with `executing-plans` named as the no-subagent fallback |
| 13 | §Phase 3 triage restatement, 315-319 | MIXED | none upstream — third statement of the same task-size rule already in the matrix (94-103) and the blockquote (82-88) | delta = the «Mandatory declaration» line (309-313) → kept inline; the numbered restatement → pointer to the matrix |
| 14 | §Phase 3 §Parallelisation mechanics, 331-339 | MIXED | `dispatching-parallel-agents/SKILL.md:66-77` («Multiple dispatch calls in one response = parallel execution. One per response = sequential») | delta = the **file-lock matrix** (341) → kept inline as its own rule, plus the newly-recorded T16 divergence against `subagent-driven-development/SKILL.md:230` |
| 15 | §Phase 4 §Final sanity check bash, 376-380 | MIXED | `verification-before-completion/SKILL.md:10` («Evidence before claims») — already pointed at by 382 | delta = «run `<CHECK_ALL>` once, with build, before the PR» → kept as one line |
| 16 | §Phase 4 §Push + PR bash, 386-392 | RE-DESCRIPTION | `finishing-a-development-branch/SKILL.md:113-128` (Option 2: push + `gh pr create`) | delta = «senior only pushes/creates the PR» → kept in §Anti-patterns; the command recipe → binding |
| 17 | §Phase 4.5 provenance clause, 409 | MIXED | the cited «Superpowers `anthropic-best-practices`» is not a skill — the real path is `writing-skills/anthropic-best-practices.md:416-419` | **stale citation repaired** in place; the four audit steps are DELTA and are kept |
| 18 | §Recovery patterns, fix-loop rows 427-428 | MIXED | `subagent-driven-development/SKILL.md:302-341` (the fix loop: rounds, resume-vs-fresh, the 5-round cap) | delta = the project-specific rows (junior pushed on its own; two parallel Agents on one file; technical-impossibility pushback) → kept inline; the generic follow-up rows → binding |
| 19 | §Example walkthrough, 464-466 | RE-DESCRIPTION | `subagent-driven-development/SKILL.md:438-503` (the worked walkthrough) | **none — the slice carried no content**: it was a pointer to upstream plus a list of this file's own section names. Removed outright |
| 20 | §Anti-patterns, 4 of 13 bullets (478-481) + the trailing upstream pointer (486) | MIXED | `subagent-driven-development/SKILL.md:425-436` (Common Rationalizations) — and three bullets restated the decision matrix already in the body | delta = the 8 project-specific bullets → kept; the restatements → dropped, with one binding line to upstream |
| 21 | §Communication with the user, 451 | MIXED | `subagent-driven-development/SKILL.md:17` («Continuous execution: do not pause to check in… between tasks») | delta = «the Phase-2 plan agreement is the ONLY pause» + ATTN escalation + 1-line status → kept |
| 22a | §Default — Mode A, closing clause 74 («Choose the model by task difficulty, not by prohibition. All three are passed through the Agent tool») | MIXED | rationale-only restatement of the three bullets directly above it | delta = the accepted `model` values (`fable`/`opus`/`sonnet`) → retained inside the three bullets themselves |
| 22b | §Default — Mode A, SDD role-model pointer 76 | RE-DESCRIPTION | `subagent-driven-development/SKILL.md:8` (the Coordinator/implementer/reviewer role model) | none removed — the same binding now sits at its use site in §Phase 3 instead of being stated twice |
| 22 | §Triggers (when to activate), 504-511 | RE-DESCRIPTION | this file's own frontmatter `description:` (4-9) and `when_to_use:` (10) — the loader reads those, not the body | delta = «first run discovery, then activate without re-explaining» (512) → re-homed into §Project bootstrap |

## Slices kept unchanged in substance (the six named deltas + peers)

Recorded so the §3 reviewer can verify the floor held, per kickoff §6 item 2:

| Delta | Baseline | Now | Upstream owner? |
|---|---|---|---|
| Discovery checklist (7 areas) | 42-56 | §Project bootstrap | none — searched `writing-plans`, `executing-plans`, SDD; no repo-convention discovery exists upstream |
| Quota zones (traffic light) | 163-208 | §Quota monitoring | none — upstream model guidance is per-token cost (`subagent-driven-development/SKILL.md:157-192`), not a subscription pool with reset windows |
| Model tiers (Fable/Opus/Sonnet) | 68-74 | §Dispatch channels | **partial, and divergent** — SDD:159 says «use the least powerful model that can handle each role»; ours defaults to Opus because the Max-plan Opus pool is not scarce. Different economics (subscription pool vs per-token price) → DELTA under T16, with the divergence now stated in the body |
| Mode B file-prompt | 66, 99-101 | §Dispatch channels | none — no upstream analogue for a hand-carried prompt file into a separate window |
| Queue mode | 439-445 | §Queue mode | none — SDD is in-session; Queue mode is cross-session with anti-collusion spot-checks |
| Phase -1 cold kickoff review | 212-241 | §Phase -1 | none — SDD:145-155 scans the PLAN for conflicts; Phase -1 cold-reviews the DISPATCH PROMPT by an independent seat. Different artifact, different reader |
| «Principle-test allowlist probe» heading | 228-230 | §Phase -1, heading unchanged | none — named by [CLAUDE.md:134](../../../CLAUDE.md) as this skill's codification target; the heading is the external anchor |
| Task-size decision matrix | 92-103 | §Three ways to do the work | none — SDD assumes a plan of tasks; nothing upstream decides «do it yourself vs delegate» |
| `isolation: "worktree"` mandate | 119-145 | §In-session sub-agent isolation | none — the Agent tool's `isolation` parameter is harness surface upstream never names |
| File-lock matrix | 341 | §Phase 3 | none — `dispatching-parallel-agents/SKILL.md:134` names shared state as a *don't-use* condition; the pre-spawn check is ours |

## T16 divergences recorded (upstream problem class ≠ ours)

Three places where the vocabulary matches upstream but the problem class does not — so the slice
stayed a DELTA rather than collapsing to a binding:

1. **Model selection.** Upstream problem class: minimise per-token API spend across roles
   (SDD:157-192). Our problem class: allocate a fixed subscription quota pool whose Opus half is
   not scarce and whose top tier (Fable) has no published limits. Match? **No** — upstream's
   «least powerful model that works» yields the opposite default from ours.
2. **Parallel dispatch.** Upstream: «Never dispatch multiple implementation subagents in
   parallel (conflicts)» (SDD:230) — tasks within one plan, one workspace. Ours: N independent
   umbrella batches, each in its own worktree, gated by a file-lock check. Match? **No** — the
   conflict upstream forbids is the one our file-lock check and `isolation: "worktree"` remove.
   Both statements now appear in the body so the divergence cannot be read as an oversight.
3. **Worktree consent.** Upstream asks the user for consent before creating a worktree
   (`using-git-worktrees/SKILL.md:41-45`). Ours makes worktree-per-dispatch the default and not
   an option. Match? **Partial** — upstream's Step 0 detection is adopted verbatim by pointer;
   only the consent default is overridden, and the override is now stated as such.

## Measured magnitude — the prep's «roughly halve» did not hold, and that is the finding

`git diff --numstat` on the rewrite: **157 deletions, 119 insertions**, 512 → 474 lines (−7%).
The prep-doc row quoted in [kickoff.md](kickoff.md) §1 expected «could roughly halve it».

It did not, and the gap is informative rather than a shortfall to be closed by cutting further:

- **Re-description was ~31% of the body, not ~50%.** 157 of 512 lines were removable as
  upstream-owned or self-duplicating. The remaining ~355 lines classify as `DELTA` against
  superpowers 6.2.0 — measured slice by slice in the table above, each with the upstream file:line
  that would have owned it if one existed.
- **Collapsing a slice is not free.** 119 lines were ADDED: the expanded authority header carrying
  the five upstream bindings, the thin-wrapper paragraph, and three explicit T16 divergence notes
  that did not previously exist anywhere. A binding that names its owner costs more lines than the
  silent duplicate it replaces — and buys the routing correctness that is the actual motive
  (kickoff §1, P-3: «the prune motive is misrouting, not tokens»).
- **Per P-1, the verdict is evidence-based, not a quota.** Cutting a further ~180 lines to reach
  «half» would have to come out of the `DELTA` column — quota zones, the decision matrix, Phase
  4.5, the token budget — none of which has an upstream owner. That is the exact move T-OR-A
  names as the hazard of this rewrite.

**Falsifier for this measurement:** wrong if a reviewer names a `DELTA`-classified slice above and
produces the upstream file:line that already owns it. That is a per-row claim and each row is
independently checkable — which is what the §3 review is for.

## What this ledger does NOT claim

- It does not claim the removals are safe on its own — that is the §3 cold review's verdict
  against the live consumer list (kickoff §3), re-derived by grep rather than trusted from the
  kickoff's snapshot.
- Two consumers the kickoff's snapshot did not name were found by that re-grep and are recorded
  as PR observations, not edited here (kickoff §7 anti-scope):
  `agents/orchestrator-worker-discipline.md:10` (+ its shipped twin
  `packages/core/templates/shared/skill-context/aif-orchestrator-discipline/SKILL.md:8`) and
  `setup.d/10-skills.sh:82-83`.
