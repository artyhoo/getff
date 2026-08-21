# Kickoff — install auto-wire R2 (Point 2 of GH #547)

**Goal:** stop shipping a red `check:globs` out of the box on inline-router / declarative-validation consumers (timeliner: Hono + `@hono/zod-openapi`). Install should configure R2 enforcement *by reading the repo* — green-because-understood, never red-because-unconfigured, never silently un-guarding a real boundary.

## Where we are (start here)

- **Design spec is DONE + committed:** [docs/superpowers/specs/2026-06-16-install-auto-wire-r2-design.md](../../../docs/superpowers/specs/2026-06-16-install-auto-wire-r2-design.md) (commit `498da3a`). **Read it first — it is the contract.**
- **Branch:** `feat/547-install-auto-wire-r2` (off `staging`). Spec is the only commit so far.
- **Next action:** `Skill('superpowers:writing-plans')` → write the implementation plan from the spec's C1–C4, then `Skill('superpowers:executing-plans')` with TDD (`superpowers:test-driven-development`). PR base = `staging`.

## Autonomy contract (maintainer directive 2026-06-16)

Work **maximally autonomously**. Ask the maintainer **only** when truly blocked — i.e. a **genuine ambiguous fork** with no determinate best on the project's merits (taste / strategy / operator preference). Then use `AskUserQuestion` *after* leading with your own reasoned recommendation.

- A **clear call** (one option better on the merits / dictated by an existing rule or precedent) → **decide it and report**, do not ask. (`#fork-decided-by-silent-action` is about *unsurfaced ambiguous* forks, not about deciding clear ones.)
- Maintainer = **control + ability to intervene, NOT decide-everything** (memory `operator-control-not-decide-everything`). Surface genuine forks with full context (Q / options / your rec / why); decide the rest.

## DECIDED — do NOT re-litigate (already settled this session)

1. **Decomposition:** Point 2 first (this kickoff). Point 1 (AI-generated DESCRIPTION/ARCHITECTURE passport) is a **separate** spec/PR afterwards, reusing the detector wired in here. The maintainer's Point-1 idea: install *asks* the goal interactively ("цель такая-то? верно?") instead of placeholder templates.
2. **Safety model:** default = **detect + advise + record**; patch only the **framework-shipped** `eslint.config.mjs` globs (our file). **Never silently mutate consumer-authored eslint configs** in this increment.
3. **Layer 2 deferred:** injecting R2 into consumer-authored per-package shadow configs (the #535 `export default base` case) → follow-up behind an opt-in `--wire-rules` flag (mirrors `--wire-ci` #117). NOT in this PR.
4. **Conservative N/A:** auto-green (`R2 N/A` record) fires **only** on a *confident* no-boundary verdict; any ambiguity → **stay red** (today's behavior). A false-N/A (silently un-guarding a real boundary) must be structurally impossible; a false-red is acceptable.

## Open risks to resolve in the plan (spec §9)

1. **C1 grep precision** — distinguishing zod `schema.parse(` from `JSON.parse(`/`Date.parse(`. Falsifier: no fixture may return `no-boundary-confident` while a real zod boundary exists (fixtures A–D + self-probe must hold).
2. **Two gates, one marker** — `check-rule-globs.sh` (bash) AND `check-rule-enforced.sh` (#118, eslint `--print-config`) must BOTH honor the C3 N/A marker via a shared marker-read helper. Divergence re-opens a false-green/false-red.
3. **Declarative allowlist coverage** — seed `@hono/zod-openapi` only; other declarative stacks (tRPC / Fastify schema / TypeBox) stay `ambiguous` (red) until added. Document the extension path; do not over-reach.

## Discipline checklist (project invariants — non-negotiable)

- **Capability commit** (C1 probe ≥80 LOC, or C2 install logic) → `Prior-art:` trailer citing SSOT **#2** (detector WATCHLIST), **#117** (`--wire-ci` pattern), **#118** (`check:enforced`), + the BUILD rationale (boundary-presence detection has no upstream). Consult [prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) before adding.
- **§1.7 forward/backward** on any discipline-bearing edit; **install-sh tests MUST assert install `rc=0`** on every arm (a mid-install crash false-greens — lesson #531/#544).
- **Recursive self-application:** add a self-probe arm — running C1 on THIS repo (apps/+packages/ monorepo) must yield an honest verdict, never a false `no-boundary-confident`.
- **Phase -1 cold-review** (1× Opus) on any Worker dispatch ≥30 lines / ≥3 subtasks before dispatching.
- **T-traps** ([ai-laziness-traps.md](../../../.claude/rules/ai-laziness-traps.md)): enumerate active ones in the plan — T3 (no prose-only findings), T16 (pattern-match-on-name: verify C1 vs check:globs problem-class), T20 (evidence before verdict).

## Acceptance (PR-ready when)

- Fixtures A (declarative → red→green), B (hand-rolled parse → wired green), C (precondition breaks → stale-marker RED), D (ambiguous → stays red), + self-probe — all green.
- Both inertness gates honor the C3 marker (shared helper).
- Full install-sh suite green; install `rc=0` every arm; CI Principles job green.
- PR → `staging` (agent merge allowed for base=staging per git-safety hook).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
