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

- Adds a new **explicit dependency** in `package.json` (transitive deps don't count; detected as a dependency key present on an added `+` line with no matching removed `-` line for the same key, across common semver-prefix forms `^ ~ >= <= = *`, in the package.json diff). Keys inside `overrides` / `resolutions` / `pnpm` blocks do NOT count — they force versions of packages already in the tree, adding no capability (PR #980 incident).
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
| `agents/living-docs-auditor.md`, `agents/review-sidecar.md`, `agents/rule-test-author.md` (rule-tests write-half protocol, added 2026-07-22) (consumer-facing agents); `packages/core/templates/shared/skill-context/*/SKILL.md` (shipped AIF skill-context overrides) | framework maintainers | all sessions | design-by-spec ref consumer-project paths absent in source repo (per D-AuditC-6, 2026-05-16; renamed from `docs-auditor` + `best-practices-sidecar` removed per C-1 resolution 2026-05-20; skill-context overrides added per C-1 follow-up + SSOT #50, 2026-05-20) |
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

## Task-tier routing (which model plans, and whether to use the pipeline at all)

**Who classifies:** the senior interactive session (the top-tier model working with the operator) decides the tier at the moment of dispatch — a judgment, never an automated classifier. Building a «simple vs complex» auto-detector would be `#parallel-evolution-creep` over a judgment call; per [attention-is-not-a-mechanism.md §1](.claude/rules/attention-is-not-a-mechanism.md), a judgment may be the decision AUTHORITY, never faked as a mechanical gate. This section exists so the classification is applied by **fixed criteria**, not re-invented per task.

**Tiers are RELATIVE capability tiers, not hard-coded models** (same posture as [night-mode/SKILL.md](.claude/skills/night-mode/SKILL.md) «Overnight model posture» paragraph, the SSOT for the tier→model instantiation — the window slides to whatever the active harness offers, so this stays AI-agnostic). This section owns the *criteria*; night-mode + the aif runtime profile config own *which model fills which tier*. Roles below: **top tier** = the strongest reasoner (plans complex work, reviews from above); **executor tier** = the cheaper strong-agentic model (plans simple work, implements, reviews from below). *Current instantiation on this operator's stack (2026-07, NOT load-bearing — lives in the profile config, not here): top = Opus, executor = GLM.*

**Two questions, three tiers:**

1. **Is the change ≤~5 lines in a single file at a known exact path?**
   → **TIER 0 — tiny.** The senior does the `Edit` itself. No kickoff, no aif dispatch, no pipeline (forcing one is pure overhead). Mirrors the `orchestrator` skill's own SKIP rule.
2. Otherwise — **does producing the PLAN require a design/architecture judgment** (choosing between approaches, a non-obvious «how», or an open «will this even work / what's the root cause»)?
   - **NO — the «how» is already determined; the work is just voluminous/mechanical** → **TIER 1 — bulky-simple.** Dispatch **with** an `<!-- bridge-profile: <unique-executor-tier-profile-name> -->` header marker → the whole aif pipeline (plan + implement + review) runs on the executor tier. The value must be the **unique** profile display name — see the mechanic paragraph below.
   - **YES — the plan itself needs judgment** → **TIER 2 — bulky-complex.** Dispatch **without** the marker → project defaults apply: the **top tier plans**, the executor tier implements and reviews from below. **Exception (acceptance-contour spec D1):** a Tier-2 kickoff produced by `/arch` AND plan-complete (decomposition decisions + all descopes encoded) dispatches **with** the marker — the whole pipeline runs on the executor tier; the fail-closed fidelity gate at the exit boundary covers the WHAT, and the first-5-tasks calibration spot-check covers the plan HOW. **Precondition:** this exception is active ONLY while `fidelity-verdict-in-pr-body` is a REQUIRED check in staging branch protection; if it is not (yet or anymore) registered, dispatch without the marker — a routing rule without its fail-closed gate violates the spec D1 precondition.

**Criteria table (for fast, repeatable classification):**

| Tier | Trigger (fixed criteria) | Who plans | Mechanic |
|---|---|---|---|
| 0 — tiny | ≤~5 lines, 1 file, exact path known, no ambiguity | — (no plan) | senior does `Edit` directly; no dispatch |
| 1 — bulky-simple | many files/steps BUT the «how» is one determinable sentence: rename/move sweep, apply an established pattern across N sites, tests for already-specified behaviour, mechanical refactor (extract/inline), scaled doc/config edits | executor tier | kickoff with `<!-- bridge-profile: <unique-executor-tier-profile-name> -->` (unique — see mechanic paragraph) |
| 2 — bulky-complex | the plan requires a design decision: new module/architecture, data-model or API-shape choice, cross-cutting consequences, unknown root cause needing investigation, «is this the right approach» is open | top tier — unless the kickoff came through /arch plan-complete (judgment already spent) → executor tier | /arch-reviewed plan-complete kickoff → WITH marker (see [/arch §3](.claude/skills/arch/SKILL.md)); exception active only with the fidelity required-check registered (see prose); otherwise kickoff, no marker (project defaults) |

**Tie-breaker (binding):** when unsure between Tier 1 and Tier 2, default to **Tier 2 (top tier plans)**. A wrong-but-cheap plan from the weaker tier costs a full re-do downstream; over-investing one planning pass is the cheaper error. This matches the project thesis «decisions with a real cost of error route to the stronger tier».

**Discriminator in one line:** if you can state the «how» in a single sentence and the rest is expansion → Tier 1; if stating the «how» forces you to *choose* → Tier 2.

The `bridge-profile` marker mechanic that Tier 1 relies on is shipped in `packages/runtime-bridge` (header-region-only parse in `kickoff.ts`, name→id resolution in `AifHandoffBackend.ts` — it resolves an arbitrary profile *name*, not a hard-coded model); the per-mode project defaults Tier 2 relies on live in the aif runtime profile config (Plan→top tier, Review/Task→executor tier).

**Marker value rule (binding — this is a dispatch-blocker, not a style preference):** the value MUST be the profile's **full display name, unique** under the resolver's match. `AifHandoffBackend._resolveProfileId` is a case-insensitive **substring** match with **no exact-match priority** (`packages/runtime-bridge/src/AifHandoffBackend.ts:131`), so an abbreviation, or a full name that is a *prefix* of another profile's name, matches ≥2 profiles and aborts the dispatch with `dispatch_failed`. Verify at authoring time against the live list — `curl -s "$RUNTIME_BRIDGE_AIF_URL/runtime-profiles" | jq -r '.[].name'` — and pick a value matching exactly one row. Recurrence: 3 kickoffs shipped an ambiguous value (PR #1109; `umbrella-donemd-backfill`; `getff-honest-signals`). The resolver-side fix (exact-match short-circuit before substring) is a banked fix-pointer in [`research-patches/2026-07-23-aif-parity-s4-synthesis.md §3 item 6`](docs/meta-factory/research-patches/2026-07-23-aif-parity-s4-synthesis.md) — until it lands, this authoring rule is the only channel. Peer statement of the same rule: [`/arch §3`](.claude/skills/arch/SKILL.md) «Marker value = the UNIQUE profile display name».

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
- **CONFLICTING PR → merge-forward, never rebase:** force-push is permission-classifier-blocked for agents in every form (`--force`, `--force-with-lease`, rewritten history to a new branch — verified 2026-07-21), so `git rebase` on a published PR branch is a dead end. Instead merge the base INTO the PR branch, regenerate conflicted generated artefacts (`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`; `plugin/hooks` twins regenerate via pre-commit), verify, then plain fast-forward push. Full recipe + triage: [.claude/rules/git-conflict-merge-forward.md](.claude/rules/git-conflict-merge-forward.md). (Incident 2026-07-21, PR #1058.)
- **Promote staging→main mechanics (two hard rules):** (1) the promote PR MUST have `head=staging` (base=`main`) — the §7 real-commit trailer backstop in `.github/workflows/audit-self.yml` (`continue-on-error` only when `base_ref==main && head_ref==staging`) is exempt ONLY for that head; a promote from any other branch loses the exemption and the required `ci-success` gate goes RED on pre-existing staging squash-commits whose `Prior-art:` trailers live in their PR bodies, not as git trailers (`--no-verify` cannot help — `ci-success` is server-side). (2) the maintainer MUST merge the promote as a **merge commit, never squash** — squash collapses to one parent and severs `staging`↔`main` ancestry, so the next promote surfaces false conflicts across ~all files. Recovery from a prior squash: a content-free reconciling merge (`git commit-tree origin/staging^{tree} -p origin/staging -p origin/main`, tree byte-identical to staging) pushed to `staging` with `--no-verify` (maintainer's hands — agents are deny-listed on `--no-verify`), then the canonical `head=staging` PR is clean + exempt. Precedent: `4ca44598c`. (Codified from memory `feedback_promote_staging_to_main_mechanics`; incident 2026-07-05 getff Wave-0.)
- **Never move a branch ref with `git update-ref` — check EVERY worktree first.** `git branch -f` refuses a branch checked out in *any* worktree; **`git update-ref` does not**. A script that only tests `git symbolic-ref --short HEAD` is testing *the directory it happens to run in*, so when it runs from a linked worktree it concludes «not checked out» and moves a ref that another checkout is sitting on. The ref advances while that checkout's index and working tree stay behind, and every file added in between shows up there as a **staged deletion** — one `git commit -a` from wiping them. Correct test: `git worktree list --porcelain` → find the worktree holding `refs/heads/<branch>` → fast-forward it *there* (`git -C <path> merge --ff-only`), so ref + index + tree move together. Incident 2026-07-24: `~/.claude/sync-branch-from-api.sh` (operator-global, called by `refresh-aif-base.sh`'s host arm) desynced the main checkout to 29 files / 4737 staged deletions including dozens of `kickoff.md`; repaired with `git restore --source=HEAD --staged --worktree .` after proving the index matched an old commit's tree exactly (i.e. zero real local edits). The container-side arm of [`refresh-aif-base.sh`](.claude/skills/aif-doctor/helpers/refresh-aif-base.sh) (detach → `branch -f` → re-attach, lines 83-94) has always been correct — only the host arm was not.
- **600-line markdown gate:** pre-commit hook blocks commits that push any markdown file past 600 lines. Check `wc -l <file>` before adding content to near-600 files (e.g. `docs/meta-factory/open-questions.md`). To free lines: migrate resolved `§13.x` entries to `docs/meta-factory/closed-questions.md` (append-only archive — TOC row + full entry under `## Archived entries`).
- **Homebrew PATH in hooks:** CC-launched hooks run with a stripped PATH (Homebrew absent). Hooks calling `gh`, `jq`, or other Homebrew tools must export `PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"` after `set -euo pipefail`. Symptom: hook returns empty output from `gh pr view` despite correct auth. (Codified from memory `feedback_harness_merge_block_and_500line_gate`.)

### Meta-orchestrator self-review obligation

Before any `/meta-orchestrator` session hands off a meta-kickoff to an orchestrator, spawn a Phase -1 cold-review (read-only Agent, adversarial) on the generated `<umbrella>-meta-launch/kickoff.md` against the umbrella's `kickoff.md`. One REVISE round maximum. The orchestrator's own Phase -1 reviews the dispatch prompt — it does NOT cover meta-synthesis bugs. Evidence: 2026-05-28 — a BLOCKER in §3 stage-gate logic was caught only by meta-level cold-review. Home note (audited 2026-07-21): no `meta-orchestrator` global skill exists, so this section IS the home until one is created. (Codified from memory `feedback_meta_orch_self_reviews_own_kickoff`.)

### Phase -1 principle-test allowlist probe

Moved 2026-07-21 to its declared codification target: `~/.claude/skills/orchestrator/SKILL.md` Phase -1 → «Principle-test allowlist probe». This stub stays because in-flight kickoffs cite «CLAUDE.md §Operational conventions» for the probe; new kickoffs should cite the skill directly.

### Pre-dispatch in-flight probe

Before dispatching any stage/sub-wave Worker, probe for in-flight parallel work — ALL of: (a) `gh pr list --head <branch> --state all` (PR-stage); (b) `git log origin/staging..<branch>` ahead-commits on any existing worktree/branch (commit-stage — the window the PR-probe misses); (c) scan for parallel CC sessions working the same umbrella (e.g. other worktrees named for the same stage); (d) RE-probe immediately after any Phase -1 review completes, before the actual dispatch — all three historical collisions materialized inside the Phase -1 window. On any hit: STOP and surface, never double-dispatch. Root cause: one stage = one executor session (single-owner-per-stage). (Codified from memory `feedback_probe_inflight_automation_before_dispatch`; 3/3 incident threshold reached 2026-06-10, all during the one-click-installer umbrella.)

## See also

- [CONTRIBUTING.md](CONTRIBUTING.md) — full contributor-facing details (hook setup, bypass policy).
- [docs/meta-factory/prior-art-evaluations.md](docs/meta-factory/prior-art-evaluations.md) — the SSOT.
- [.github/pull_request_template.md](.github/pull_request_template.md) — PR checklist.
- [packages/core/principles/08-prior-art-cited.test.ts](packages/core/principles/08-prior-art-cited.test.ts) — meta-test enforcing citations.
- [agents/compliance-verifier.md](agents/compliance-verifier.md) — AI-agnostic sub-agent for §1.7 substance review; read in your active session before merging a discipline-bearing PR (Wave 8.1b, $0 LLM-in-CI).
- **Parallel-session dispatch:** spawn isolated worktrees with `claude -w <name>`, or portably via `bash scripts/create-worktree.sh <name>` (≤2-step pipeline, empirically accepted in [docs/meta-factory/research-patches/2026-05-29-dispatch-worktree-iphase-acceptance.md](docs/meta-factory/research-patches/2026-05-29-dispatch-worktree-iphase-acceptance.md)).
- **Worktree `node_modules` provisioning:** [`scripts/worktree-node-modules.sh`](scripts/worktree-node-modules.sh) is the single source of truth; [`scripts/create-worktree.sh`](scripts/create-worktree.sh) and [`.claude/hooks/worktree-setup.sh`](.claude/hooks/worktree-setup.sh) both call it. **Do not assume the CC hook runs** — `WorktreeCreate` is NOT registered in [`.claude/settings.json`](.claude/settings.json) (verify: `jq '.hooks.WorktreeCreate' .claude/settings.json`), and `.claude/settings.json` is agent-uncommittable, so the hook only fires for maintainers who registered it by hand. Worktrees born any other way (desktop app, agent container, bare `git worktree add`) are provisioned by the `worktree-provisioning` pre-push section, which self-heals before the test sections run. To sweep every worktree at once: `bash scripts/worktree-doctor.sh [--fix]`. (Incident 2026-07-23: the hook had never been registered since it shipped in PR #279, this bullet claimed otherwise, and 63 of 125 worktrees were unprovisioned.)
