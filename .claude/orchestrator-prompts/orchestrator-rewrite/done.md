# orchestrator-rewrite — DONE

- Final PR: #1460
- Closed: 2026-08-18
- Summary: The 512-line `orchestrator` skill was rewritten to deltas + bindings over the superpowers stack (the `/arch` model), and the measured magnitude — 512 → 478 lines, not the predicted «roughly halve» — is the umbrella's actual finding: re-description was ~33% of the body, not ~50%.

## What landed

Single-stage umbrella, one PR (#1460, squash `ce90c0dae2`, merged 2026-08-18). Touched
`.claude/skills/orchestrator/SKILL.md`, the removed-slice ledger at
[`report.md`](report.md), and all eight npm-stack install fingerprints
(`tests/install-sh/baselines/*`) recaptured because the skill ships at env depth.

## The result, stated before the process

| claim (kickoff §1, prep-doc row) | measured |
|---|---|
| «could roughly halve it» (512 → ~256) | **512 → 478** (−168 / +134 per `git diff --numstat`) |
| the body is largely upstream re-description | **~33%** removable; the remaining ~344 lines classify `DELTA` against superpowers 6.2.0, each with the upstream file:line that would have owned it if one existed |

Slices touched: 9 `RE-DESCRIPTION`, 13 `MIXED` (wrapper → binding, delta re-homed), 2 `DELTA`
kept and recorded. Cutting a further ~170 lines to reach «half» would have had to come out of
the `DELTA` column — quota zones, the decision matrix, Phase 4.5, the token budget — which is
exactly the T-OR-A hazard the kickoff named. Per P-1 the verdict is evidence-based, not a quota.

## Acceptance (kickoff §6)

1. Deltas + bindings — yes; the five upstream bindings live in the authority header's «NOT
   authoritative for» list, the arch/SKILL.md pattern.
2. Six named deltas survive; the anchor an external doc names by heading is live —
   `.claude/skills/orchestrator/SKILL.md:243` «Principle-test allowlist probe», reachable from
   [`CLAUDE.md:134`](../../../CLAUDE.md).
3. Ledger shipped as `report.md` (one row per removed or collapsed slice).
4. §3 cold slice-loss review: **GO** in round 1 with one hit — «Batched questions» (baseline
   `:452`) was a real upstream property (`subagent-driven-development/SKILL.md:151-153`) and now
   binds instead of claiming. Two further rounds re-checked the ledger's own citations
   (77 resolved, zero baseline citation failures); the skill body was unchanged in every commit
   after round 1. Loop closed deliberately per [effort-worthiness.md §1](../../rules/effort-worthiness.md).
5. Snapshots recaptured + compared green; CI green.
6. Merge gate honoured: the authoring session declined to self-merge (PR body: «Not
   self-merging»), and the PR was merged as a separate act at 2026-08-18T06:59Z.

## Routed onward (out of scope here — other owners)

1. [`agents/orchestrator-worker-discipline.md:10`](../../../agents/orchestrator-worker-discipline.md)
   and its shipped twin
   [`packages/core/templates/shared/skill-context/aif-orchestrator-discipline/SKILL.md:8`](../../../packages/core/templates/shared/skill-context/aif-orchestrator-discipline/SKILL.md)
   route «quota zones, queue-mode anti-collusion, Phase -1 dual-reviewer» to the
   meta-orchestrator (`pipeline`) skill. Those live in the `orchestrator` skill. Pre-existing
   imprecision, unchanged by #1460; one-line repointing by its owner.
2. [`setup.d/10-skills.sh:82`](../../../setup.d/10-skills.sh) describes this skill's content as
   «Mode A/B, Queue mode, quota zones, Phase -1 cold kickoff read» — still accurate after the
   rewrite; recorded so a future thinning pass knows the manifest comment tracks the delta list.

## Method note worth carrying

Reading a file from the primary checkout while working in a worktree can hand you different
bytes than the ones under review: the primary carries an untracked pre-authority-header copy of
`references/rationale.md`, two lines shorter than the tracked one, and it produced two stale
citations in this umbrella's ledger before the third round caught them.
