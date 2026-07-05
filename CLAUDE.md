# Claude / Agent Guidance

This file is auto-loaded by Claude Code when sessions run inside this repo.

> **Authoritative for:** AI-tooling conventions, capability-commit gates, build-vs-reuse discipline, Artifact Ownership Contract.
> **NOT authoritative for:** project goal, methodology, design invariants — see [README.md#why-this-exists](README.md#why-this-exists).

## Read-first (Step 0)

At session start, read [.claude/session-bootstrap.md](.claude/session-bootstrap.md) — it re-states the project goal + invariants from README in compaction-resilient form. Implements the AIF Step 0 / Cline Memory Bank re-read pattern: anchors goal across context-loss events that compaction cannot guarantee to preserve.

## Project goal pointer (do not elevate methodology to goal)

**Goal:** AI agents can't silently bypass undocumented conventions. Every codified rule is an executable artifact (ESLint rule, pre-push check, principle test, mutation gate, drift probe, Living Documentation assertion) that fails at the earliest reachable channel — edit-time → pre-commit → pre-push → CI → production audit. **CI is the last-resort gate, not the primary one.** Full statement: [README.md#why-this-exists](README.md#why-this-exists).

**Methodology:** recursive self-application — framework validates itself with its own logic. *Quality signal* (per GCC bootstrap precedent, `rustc` compile-self analogy), not the project's goal. **Do not elevate to «north star» in any operational doc.** If you find yourself reasoning under a goal that contradicts README — stop. The contradicting doc has drifted, not README. Surface as a coverage-gap patch under [docs/meta-factory/research-patches/](docs/meta-factory/research-patches/).

## Build-vs-reuse invariant (Phase 8.8)

Before introducing any **capability commit** (definition below), **MUST**:

1. Consult [docs/meta-factory/prior-art-evaluations.md](docs/meta-factory/prior-art-evaluations.md) (SSOT) for matches on the capability area.
2. Run context7 query (≥3 phrasings) on the capability area; cite candidates surfaced.
3. Document the evidence via a `Prior-art:` commit trailer (syntax below).

If no SSOT entry matches and context7 surfaces no production-grade analog, add a new SSOT entry — with `Verdict`, `Rationale`, `Trigger to revisit` — in the same commit as the capability artifact (per [prior-art-evaluations.md §3](docs/meta-factory/prior-art-evaluations.md)).

The phase entry consult gate is the same enforcement at planning time — see [EXECUTION-PLAN.md §5.5 Step 1.5](docs/meta-factory/EXECUTION-PLAN.md).

For the **consumer-side authority model** governing how shipped artefacts may be customised after install (three-layer model + `<file>.override.md` escape hatch), see [INSTALL-FOR-AI.md `Three-layer authority for shipped artefacts`](INSTALL-FOR-AI.md#three-layer-authority-for-shipped-artefacts). This is the consumer-facing companion to the build-vs-reuse discipline above.

> **Satellite doctrine** (own-stack-first · operator-vs-shipped axes · cost = capability-commit · use-before-build) lives at its authoritative home [`.claude/rules/build-first-reuse-default.md §1.1`](.claude/rules/build-first-reuse-default.md) — that rule owns «relationship to upstream tools + default verdict for capability proposals». CLAUDE.md owns only the **per-commit** build-vs-reuse gate (above + below); the macro companion-relationship doctrine is BFR's scope (relocated 2026-06-01 — the §32 placement was a doc-authority slip per [doc-authority-hierarchy.md §4](.claude/rules/doc-authority-hierarchy.md) `#contradicting-authority-claims`).

## What is a capability commit?

A commit that does **any** of the following (mirrors `packages/core/hooks/checks/prior-art.ts` detection — the prose definition and the hook stay in sync):

- Adds a new **explicit dependency** in `package.json` (transitive deps don't count; detected as a dependency key present on an added `+` line with no matching removed `-` line for the same key, across common semver-prefix forms `^ ~ >= <= = *`, in the package.json diff).
- Adds a new file **≥50 LOC** under a new subdirectory of `packages/core/<new-dir>/`.
- Adds a new file **≥80 LOC** anywhere under `packages/`.

Refactors, doc edits, test additions for existing capabilities, bug fixes, snapshot regenerations, recipe data edits — **NOT** capability commits.

## `Prior-art:` trailer syntax

In the commit message body, after the blank line that follows the subject:

```text
Prior-art: <free-form narrative referencing prior-art-evaluations.md#<ID>, or escape hatch>
```

**Examples:**

- Positive: `Prior-art: prior-art-evaluations.md#1 (Autogrep, verdict DEFER — different domain, no overlap with this commit's capability).`
- Multiple refs: stack two `Prior-art:` lines, one per entry. Each line is independently parsed.
- Escape hatch (non-capability commits caught by the hook in mixed PRs): `Prior-art: skipped — refactor only, no new capability` — rationale **must** be ≥20 chars and specify *why* (e.g. «refactor only, no new capability», «snapshot regen after recipe edit», NOT «TODO» / «later» / placeholder).

## Recursive self-application

This convention is enforced via three layers, each validating a different artifact:

| Layer | Surface | Artifact | Added |
|---|---|---|---|
| 1 — meta-test | Phase 2 principle 08 | research files cite SSOT by ID; broken refs caught | T3 |
| 2 — process gate | EXECUTION-PLAN §5.5 Step 1.5 | phase research consult before drafting | T6 |
| 3 — developer-time | `.husky/pre-push` + commit trailer | capability commits carry `Prior-art:` line | T7 + T8 |

The convention applies to its own implementation: Phase 8.8 commits T2-T11 carry `Prior-art:` trailers, and principle 08 validates the SSOT it builds on.

## Artifact Ownership Contract

Each artifact has one owner. Cross-owner edits require explicit handoff (separate atomic commit + rationale, not side-effect of operational work). Reviewer agents are read-only for any artifact they don't own.

| Artifact | Owner | Read-only for | Why |
|---|---|---|---|
| [README.md](README.md) (`§Why this exists`) | maintainers (deliberate edit) | all reviewer / implementation / planning sessions | goal-redefinition is structural change |
| [docs/meta-factory/EXECUTION-PLAN.md](docs/meta-factory/EXECUTION-PLAN.md) | maintainers + planning sessions | reviewer agents, implementation agents | operational; does not own goal |
| [docs/meta-factory/PROPOSAL.md](docs/meta-factory/PROPOSAL.md) | frozen — historical artifact | all sessions | design-history record; do not retroactively rewrite |
| [docs/meta-factory/prior-art-evaluations.md](docs/meta-factory/prior-art-evaluations.md) | phase research sessions, capability-commit authors | reviewer agents | append-only register per [§3](docs/meta-factory/prior-art-evaluations.md) |
| [docs/meta-factory/retros/](docs/meta-factory/retros/) `*` | phase orchestrator at retro time | all subsequent sessions | closed historical artifact post-merge |
| [docs/meta-factory/research-patches/](docs/meta-factory/research-patches/) `*` | session that discovered the gap | all subsequent sessions | one patch per gap, append-only |
| [.husky/pre-push](.husky/pre-push), [.claude/rules/](.claude/rules/) `*` | maintainers | all session agents | enforcement layer |
| [.claude/session-bootstrap.md](.claude/session-bootstrap.md) | maintainers (deliberate edit) | reviewer agents | operational restatement; modify only when invariants/reading-order change |
| `agents/living-docs-auditor.md`, `agents/review-sidecar.md` (consumer-facing agents); `packages/core/templates/shared/skill-context/*/SKILL.md` (shipped AIF skill-context overrides) | framework maintainers | all sessions | design-by-spec ref consumer-project paths absent in source repo (per D-AuditC-6, 2026-05-16; renamed from `docs-auditor` + `best-practices-sidecar` removed per C-1 resolution 2026-05-20; skill-context overrides added per C-1 follow-up + SSOT #50, 2026-05-20) |
| [packages/core/principles/](packages/core/principles/) `*` | meta-tests CI | implementation agents | enforcement code |

The contract addresses the exact mechanism of the 2026-05-09 incident: reviewer agents pattern-matching on language in [docs/meta-factory/EXECUTION-PLAN.md](docs/meta-factory/EXECUTION-PLAN.md) §1 («north star»), then reinforcing the wrong goal across reviewer cycles. Read-only constraint on goal-bearing artifacts (README) prevents reviewer agents from silently re-establishing a different goal.

## PR strategy

When working on an agreed scope (a defined umbrella, batch, or single-concern PR), stay strictly within that scope.

**Rule:** if you notice a separate systemic issue mid-PR (e.g. «PR template missing §1.7 stubs causes recurring CI fails»), do NOT autonomously open an additional PR. Surface it as an observation in the final summary («I noticed X, want me to fix as a separate task?»), do NOT spawn a PR/branch/commit autonomously.

**Why:** Incident 2026-05-11, PR #33. While completing PR #32 (Wave 5 readiness SSOT remap), the orchestrator noticed a real recurring CI-fail trigger in the PR template and opened PR #33 autonomously. Maintainer pushback: drive-by scope expansion adds PR review overhead, introduces shared-state operations without explicit invitation, and violates atomic-umbrella discipline. Atomic-umbrella discipline is parallel to atomic-commit discipline: one concern per PR, even if «we're already here».

**How to apply:**

- Within the originally agreed umbrella scope → atomic commits OK, multiple files OK, multiple concerns within the umbrella OK.
- Outside the umbrella → surface as observation, await explicit invitation.
- The `work-without-stopping` user override applies to **clarification within the agreed scope**, not to expanding scope with new shared-state operations.
- Exception: if maintainer explicitly invited the systemic fix in this session, proceed — but that's an explicit invitation, not autopilot.

## Umbrella closure convention

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

## Operational conventions (non-obvious harness gates + orchestration obligations)

### Harness gates

- **Agent PR merge gating:** `~/.claude/hooks/git-safety.sh` allows `gh pr merge --squash` when `base=staging` or `base=epic/*`. Base=`main` is blocked — maintainer merges manually. Retrying on a real `main`-base block is futile.
- **Promote staging→main mechanics (two hard rules):** (1) the promote PR MUST have `head=staging` (base=`main`) — the §7 real-commit trailer backstop in `.github/workflows/audit-self.yml` (`continue-on-error` only when `base_ref==main && head_ref==staging`) is exempt ONLY for that head; a promote from any other branch loses the exemption and the required `ci-success` gate goes RED on pre-existing staging squash-commits whose `Prior-art:` trailers live in their PR bodies, not as git trailers (`--no-verify` cannot help — `ci-success` is server-side). (2) the maintainer MUST merge the promote as a **merge commit, never squash** — squash collapses to one parent and severs `staging`↔`main` ancestry, so the next promote surfaces false conflicts across ~all files. Recovery from a prior squash: a content-free reconciling merge (`git commit-tree origin/staging^{tree} -p origin/staging -p origin/main`, tree byte-identical to staging) pushed to `staging` with `--no-verify` (maintainer's hands — agents are deny-listed on `--no-verify`), then the canonical `head=staging` PR is clean + exempt. Precedent: `4ca44598c`. (Codified from memory `feedback_promote_staging_to_main_mechanics`; incident 2026-07-05 getff Wave-0.)
- **600-line markdown gate:** pre-commit hook blocks commits that push any markdown file past 600 lines. Check `wc -l <file>` before adding content to near-600 files (e.g. `docs/meta-factory/open-questions.md`). To free lines: migrate resolved `§13.x` entries to `docs/meta-factory/closed-questions.md` (append-only archive — TOC row + full entry under `## Archived entries`).
- **Homebrew PATH in hooks:** CC-launched hooks run with a stripped PATH (Homebrew absent). Hooks calling `gh`, `jq`, or other Homebrew tools must export `PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"` after `set -euo pipefail`. Symptom: hook returns empty output from `gh pr view` despite correct auth. (Codified from memory `feedback_harness_merge_block_and_500line_gate`.)

### Meta-orchestrator self-review obligation

Before any `/meta-orchestrator` session hands off a meta-kickoff to an orchestrator, spawn a Phase -1 cold-review (read-only Agent, adversarial) on the generated `<umbrella>-meta-launch/kickoff.md` against the umbrella's `kickoff.md`. One REVISE round maximum. The orchestrator's own Phase -1 reviews the dispatch prompt — it does NOT cover meta-synthesis bugs. Evidence: 2026-05-28 — a BLOCKER in §3 stage-gate logic was caught only by meta-level cold-review. Codification target is `~/.claude/skills/meta-orchestrator/SKILL.md §4.5` (agent-uncommittable global skill); interim home: this section. (Codified from memory `feedback_meta_orch_self_reviews_own_kickoff`.)

### Phase -1 principle-test allowlist probe

Phase -1 cold-review on any dispatch that ships ≥1 NEW file under principle-test-watched paths MUST include a dimension: «for each NEW path, grep `packages/core/principles/` `EXEMPT_*` allowlists + structural rule; confirm the artefact satisfies the rule OR qualifies for exemption». Watched paths: `.claude/skills/**`, `.claude/rules/**`, `agents/**`, `docs/meta-factory/research-patches/**`, `packages/core/templates/**`. Probe: `grep -rn 'EXEMPT_\|allowlist\|skip' packages/core/principles/ | grep -E '\.(test\.)?ts:' | head -20`. Evidence: PR #264 pushed twice — principle 15 (paired-negative) + principle 10 (scope annotation) both fired after an 11-dimension Phase -1 missed both. Codification target is `~/.claude/skills/orchestrator/SKILL.md` Phase -1 §Critique dimension (l) (agent-uncommittable global skill); interim home: this section. (Codified from memory `feedback_phase_minus_1_probe_exempt_allowlists`.)

### Pre-dispatch in-flight probe

Before dispatching any stage/sub-wave Worker, probe for in-flight parallel work — ALL of: (a) `gh pr list --head <branch> --state all` (PR-stage); (b) `git log origin/staging..<branch>` ahead-commits on any existing worktree/branch (commit-stage — the window the PR-probe misses); (c) scan for parallel CC sessions working the same umbrella (e.g. other worktrees named for the same stage); (d) RE-probe immediately after any Phase -1 review completes, before the actual dispatch — all three historical collisions materialized inside the Phase -1 window. On any hit: STOP and surface, never double-dispatch. Root cause: one stage = one executor session (single-owner-per-stage). (Codified from memory `feedback_probe_inflight_automation_before_dispatch`; 3/3 incident threshold reached 2026-06-10, all during the one-click-installer umbrella.)

## See also

- [CONTRIBUTING.md](CONTRIBUTING.md) — full contributor-facing details (hook setup, bypass policy).
- [docs/meta-factory/prior-art-evaluations.md](docs/meta-factory/prior-art-evaluations.md) — the SSOT.
- [.github/pull_request_template.md](.github/pull_request_template.md) — PR checklist.
- [packages/core/principles/08-prior-art-cited.test.ts](packages/core/principles/08-prior-art-cited.test.ts) — meta-test enforcing citations.
- [agents/compliance-verifier.md](agents/compliance-verifier.md) — AI-agnostic sub-agent for §1.7 substance review; read in your active session before merging a discipline-bearing PR (Wave 8.1b, $0 LLM-in-CI).
- **Parallel-session dispatch:** spawn isolated worktrees with `claude -w <name>` — the [`worktree-setup.sh`](.claude/hooks/worktree-setup.sh) `WorktreeCreate` hook auto-creates the worktree + `node_modules` symlinks (≤2-step pipeline, empirically accepted in [docs/meta-factory/research-patches/2026-05-29-dispatch-worktree-iphase-acceptance.md](docs/meta-factory/research-patches/2026-05-29-dispatch-worktree-iphase-acceptance.md)).
