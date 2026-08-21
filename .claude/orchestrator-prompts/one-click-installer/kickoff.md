# One-click installer (`./setup`) — umbrella kickoff

> **For:** `/meta-orchestrator one-click-installer` (next session). Multi-stage I-phase umbrella.
> **Mode:** Mode B (worktree-isolated parallel sub-waves where stages allow).
> **PR base:** `staging`. Each stage = its own PR; stage-gate (Phase -1 cold-review) between stages.

## §0 Sources of truth (read FIRST)

- **Spec:** [`docs/superpowers/specs/2026-05-31-one-click-installer-design.md`](../../../docs/superpowers/specs/2026-05-31-one-click-installer-design.md) — the design (11 sections), maintainer-approved 2026-05-31.
- **Plan:** [`docs/superpowers/plans/2026-05-31-one-click-installer.md`](../../../docs/superpowers/plans/2026-05-31-one-click-installer.md) — 9 bite-sized TDD tasks with exact code/commands. **This kickoff orchestrates the plan; the plan holds the task detail — do NOT re-derive it.**

## §1 Goal (one line)

One `./setup` entry: framework (`install.sh`) + companions (declarative manifest, official-installer/no-pin/free-on-subscription) + runtime-bridge (health-first guided-detect), with `--yes`/`--all`/`--dry-run`.

## §2 Stage map (plan task → stage)

| Stage | Plan tasks | Parallel? | Depends on | Branch |
|---|---|---|---|---|
| **S1 Framework-only install.sh** | Task 1 | no (foundational) | — | `worktree-oci-s1-install-trim` |
| **S2 Companion libs** | Task 2 (manifest), Task 3 (engine), Task 4 (bridge-guided) | **yes — 3 file-disjoint sub-waves** | S1 | `worktree-oci-s2-{manifest,engine,bridge}` |
| **S3 Orchestrator** | Task 5 (`./setup`) | no | S2 (sources engine.sh + bridge-guided.sh) | `worktree-oci-s3-setup` |
| **S4 Discipline+docs** | Task 6 (SSOT), Task 7 (rule), Task 8 (docs) | **yes — 3 disjoint** | S3 | `worktree-oci-s4-{ssot,rule,docs}` |
| **S5 Integration+PR** | Task 9 | no | S1–S4 all merged | `worktree-oci-s5-integration` |

Stage-gate between every stage: §6 merge check + Phase -1 cold-review (GO before next stage dispatch).

> **Sub-wave isolation:** every parallel sub-wave gets its own worktree (`bash scripts/create-worktree.sh oci-<stage>-<name>`) — parallel-subwave-isolation.md §1. S2/S4 sub-waves touch disjoint files (manifest vs engine.sh vs bridge-guided.sh; SSOT vs rule vs README/doc) → safe to parallelize.

## §3 Scope fence (hard)

**IN:** exactly the 9 plan tasks.
**OUT (do NOT touch — surface as observation only, per CLAUDE.md PR strategy):**
- TaskMaster-in-meta-orchestrator-planning adoption (spec §9 — REJECTED on existing evidence; no R-phase unless maintainer asks).
- `meta-orchestrator-plan-memory` umbrella `done.md` closure (spec §9 — separate one-liner, not this umbrella).
- Companion manifest "engine framework" beyond the minimal ~20-30 LOC (spec §4 — YAGNI past minimal).
- Any edit to `~/.claude/skills/` (agent-uncommittable) or `.claude/settings.json` (self-protected).

## §4 AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) — MANDATORY)

Active traps for this umbrella: **T3, T5, T11, T15, T16, T19**.
- **T3** (verify, no prose-only findings) — every "test passes" claim carries the command + output; every file:line claim is opened.
- **T5** (no scope creep into §3 OUT items mid-task).
- **T11** (prior-art) — already done in spec §10/§11 (aif-handoff `installMcpServer` precedent); cite, don't re-survey.
- **T15** (self-application) — the new `companion-install-principle.md` rule must itself follow doc-authority-hierarchy (Class + Authoritative-for header); the §1.7 forward/backward in the S5 PR body.
- **T16** (pattern-matching-on-name) — "manifest", "engine" sound like a plugin framework; keep it the minimal table+loop the spec mandates, not a framework.
- **T19** (own cold-QA before handoff) — S5 reviewer runs the full `tests/install-sh/*.test.sh` suite + the e2e dry-run on a throwaway project BEFORE PR handoff; CI-green ≠ design-review.

Domain-specific:
- **T-OCI-A — manifest pipe-parse false-confidence.** The manifest fields are `|`-delimited but detect/install commands themselves contain `|` (e.g. `claude plugin list | grep -q superpowers`). Tempted output: "parser works" without testing on the real rows. Counter (per plan Task 5 note): write a parse sub-test against the actual `companions.manifest` rows; if fragile, switch to a tab delimiter — do NOT ship an untested field-splitter.
- **T-OCI-B — paid-by-default regression.** Tempted output: install a companion via its default path that silently uses a paid API. Counter: every `cc-plugin`/companion install must land on the free-on-subscription path (no API key); for any companion with a metered default (the aif-handoff `transport:"cli"` analog), the offer to flip to free is part of the task — verify, don't assume.

## §5 Per-stage acceptance (gate criteria)

- **S1:** `tests/install-sh/no-companion-blocks.test.sh` PASS=4; `install.sh ts-server --dry-run` completes, zero companion prompts; `bash -n install.sh` clean.
- **S2:** each lib's test green (`manifest-parse` 4, `engine` 5, `bridge-guided` 3); each sub-wave is its own atomic PR.
- **S3:** `setup-orchestrator.test.sh` PASS=5; dry-run writes nothing.
- **S4:** principle 08 + 09 green; rule carries Class+Authoritative-for; markdownlint 0 on README + runtime-bridge-setup.
- **S5:** all `tests/install-sh/*.test.sh` FAIL=0; e2e dry-run clean; PR to staging with §1.7 forward+backward + capability-commit check (spec §11) + `## 🟢 Простыми словами`.

## §6 Stage-gate mechanic (between every stage)

```bash
gh pr list --search "is:merged head:<stage-N-branch> base:staging" --json number,title,mergedAt --limit 10
```
Stage N PRs not merged → HALT, do not dispatch N+1. Then Phase -1 cold-review (Agent tool, read-only reviewer, `reviewer-discipline.md §2`) → GO/REVISE/STOP before N+1.

## §7 Notes for the orchestrator

- This umbrella is **bash + docs only** — no paid LLM, trivially `no-paid-llm-in-ci.md`-compliant.
- Capability-commit check (spec §11): `./setup` + libs may cross the LOC threshold → carry `Prior-art:` trailer (aif-handoff `installMcpServer`, same as PR #311).
- Last-stage (S5) PR merge → write `done.md` here per CLAUDE.md Umbrella closure convention.
- Worktree base ref = refreshed `origin/staging` (not `main`) — `scripts/create-worktree.sh` handles this.
- **⚠ Bridge auto-dispatch must be OPT-IN, not opt-out (maintainer decision 2026-05-31).** Task 4 (bridge-guided) wires the PostToolUse `runtime-bridge-dispatch.sh` hook into the consumer's `settings.json`. The hook as shipped today is **opt-OUT** (fires on EVERY `*-meta-launch/kickoff.md`; `<!-- bridge: skip -->` excludes) — a footgun: every kickoff silently auto-runs in aif (real, metered autonomous work). **The installer must NOT enable that default.** Required: flip the underlying marker logic in `packages/runtime-bridge/src/kickoff.ts` + the hook to **opt-IN** — default = no auto-dispatch; only a kickoff with an explicit `<!-- bridge: auto -->` first line auto-dispatches; everything else stays manual (`cli/dispatch.ts` on demand). This is a small companion change (kickoff.ts marker + hook filter + tests + docs) — do it as a prerequisite of Task 4, or ship the hook **unwired by default** and document the manual `cli/dispatch.ts` flow until the flip lands. Rationale: per-task explicit choice + safe default; «auto only when I mark it AND a backend is available» (mode=auto already handles availability via `resolver.ts` aif `available()` probe → Manual fallback). See [[project_runtime_bridge_mcp_dispatch_fix]] memory + the question-loop design doc.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
