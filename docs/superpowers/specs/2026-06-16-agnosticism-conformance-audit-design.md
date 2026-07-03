# AI-agnosticism conformance audit — design spec

> **Status:** DRAFT — design approved 2026-06-16, pending spec review.
> **Date:** 2026-06-16
>
> **Authoritative for:** the design of Umbrella-1 (the test-backed agnosticism + paid-feature conformance audit) — its bar, scope, surface inventory, harness architecture, `/workflows` structure, and the shape of its deliverable (the Umbrella-2 remediation kickoff).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The agnosticism *posture* itself — currently [.claude/rules/dual-implementation-discipline.md §3](../../../.claude/rules/dual-implementation-discipline.md) + the wave-sequencing A/B decision; this spec proposes raising that bar (see §2) but the posture rewrite is a separate maintainer-owned artifact, not this spec.

## §0 One-line

Build a **zero-Claude-Code scratch-consumer harness** that *runs* every shipped gate and orchestration capability with no CC present, records pass/fail as executable proof (not prose), and emits a remediation kickoff whose end-state is: **a consumer can drop Claude Code for any other AI without losing working convenience.**

## §1 Problem

The framework already has an agnosticism *posture* and it is codified — [dual-implementation-discipline.md](../../../.claude/rules/dual-implementation-discipline.md) (`@dual-pair` / `@cc-only-rationale` markers), [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md), [companion-install-principle.md](../../../.claude/rules/companion-install-principle.md), the wave-sequencing A/B layer decision. But **all of it is self-asserted prose discipline.** There is currently **no executable test that proves the framework works end-to-end with zero Claude Code.** A reconnaissance sweep on 2026-06-16 (two Explore agents) returned exactly the reassuring-but-unverified verdict the project's own thesis distrusts: *"framework does not hard-break on non-CC."* That is a marker-truth claim, not a run.

By the project thesis — *"documents lie; tests don't"* ([README.md#why-this-exists](../../../README.md#why-this-exists)) — agnosticism is the one major invariant that has **never been recursively self-applied**: the discipline is enforced on user code, not on the framework's own portability. This audit closes that gap.

## §2 The bar — functional parity (decided 2026-06-16)

| Bar | Definition | Verdict |
|---|---|---|
| **Functional parity** | Substrate (lint/test/hooks/CI) **test-proven** portable AND every orchestration capability has a portable path preserving the *workflow* off-CC (invocation may differ from a CC slash-command). | **CHOSEN** — matches the stated goal *"без потерь удобства в работе"*. |
| Identical parity | Everything works *identically* off-CC incl. auto-trigger + slash-command ergonomics. | Rejected — goal-change touching README + A/B posture, for ergonomic sugar. |
| Existing-posture audit-only | Substrate portable; orchestration CC-only accepted. | Rejected — cannot deliver "drop CC with no convenience loss"; current [§3](../../../.claude/rules/dual-implementation-discipline.md) *accepts* losing orchestration off-CC. |

> **Posture-raise flag (load-bearing):** functional parity sits **above** the currently-codified posture. The audit therefore treats "orchestration is CC-only" — currently an *accepted design state* — as a **finding**, not as compliant. The Umbrella-2 kickoff must include, as its first item, a posture-rewrite to [dual-implementation-discipline.md §3](../../../.claude/rules/dual-implementation-discipline.md) + the wave-sequencing A/B decision, so the new bar is codified rather than implicit. This is the maintainer's call, surfaced here, not silently baked in.

## §3 Scope boundary

- **IN — "factory":** the repo's own dogfooding surface — `.claude/` (hooks, skills, rules, settings), `packages/`, `setup` / `install.sh`.
- **IN — "product":** everything shipped into a consumer project via `install.sh` (verified copy targets), plus the paid-feature surface.
- **OUT — operator-personal global tooling:** `~/.claude/skills/orchestrator`, `meta-orchestrator`, etc. These are **operator-axis**, where CC use is fine by design ([build-first-reuse §1.1](../../../.claude/rules/build-first-reuse-default.md)). Auditing them would be a category error.

## §4 Architecture — the zero-CC scratch consumer

A deterministic bash+TS fixture. Steps:

1. **Provision:** create a temp project (scratch consumer), run `install.sh` / `setup` into it.
2. **Scrub CC:** unset all `CLAUDE_*` env; ensure no `.claude/settings.json` hook executor fires; no slash-command runtime; assert `command -v claude` is masked. The harness asserts CC-absence is real before any probe runs (else every probe false-greens).
3. **Drive every gate via raw git/shell/CI** and record exit codes + stdout/stderr per probe.
4. **Emit a machine-readable conformance record** (`surface · probe-cmd · exit · verdict`), the seed of the remediation kickoff.

**Build-vs-reuse (per [CLAUDE.md capability gate](../../../CLAUDE.md) + [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md)):** do NOT build fresh. The reuse base is the existing install/consumer test surface, **verified present**:
- `tests/install-sh/*.test.sh` — `engine.test.sh`, `bridge-guided.test.sh`, `audit-consumer-mode.test.sh`, `c1-wiring.test.sh`, `detect-r2-boundary.test.sh`, `arch-target-monorepo.test.sh`, … (already provision scratch consumers + assert install rc).
- `packages/core/installer/install.test.ts` + `snapshot.test.ts`.

The new capability = a **"CC-absent mode"** flag on that harness + the conformance assertions. SSOT consult + `Prior-art:` trailer required at commit time (capability commit). Candidate prior-art areas to query (≥3 phrasings, DeepWiki+WebSearch per [BFR §3](../../../.claude/rules/build-first-reuse-default.md)): "harness-agnostic conformance test", "editor-agnostic AI tooling test", "no-LLM CI portability test".

## §5 Surface inventory — each test-backed, never an opinion

| # | Surface | Probe (what actually runs) | Expected finding class |
|---|---|---|---|
| 1 | Substrate: eslint+custom-rules, vitest, mutation, pre-push/pre-commit, dep-cruiser, CI workflow | Run all under zero-CC → assert green | Low risk — but **proven**, not marker-trusted |
| 2 | Shipped agents (`agents/*.md`) | Structural probe: no CC-only assumptions in prompt; consumable by a non-CC session | Medium |
| 3 | **Orchestration** (`pipeline`/`dispatcher` = `disable-model-invocation:true`, verified; `aif-doctor` = `false`; `template-audit`) | Convenience-parity probe: is there a portable path to drive the *workflow* off-CC? | **Primary findings** — slash-command-only today |
| 4 | Shipped hooks (`deps-hash-check`, `pre-push.ts`+`pre-push.fallback.sh`) | Fire via git (portable) not CC? Fallback selects on no-Node-20? | Low |
| 5 | Templates (`AGENTS.md.template:75` "skills auto-activate", `CLAUDE.md.template`) | Claim-truth probe: "auto-activate" is CC-only → false off-CC | Medium (doc honesty) |
| 6 | **Paid surface** | Does anything route to metered API without explicit opt-in? Is the runtime-bridge transport default surfaced, not silent? Cross-check [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) | Cost-class |
| 7 | `.claude/rules/` auto-load | Off-CC there is no auto-load → degradation; measure what a portable consumer must do manually | Medium |
| 8 | **Channel coverage** — every CC hook script (tracked `.claude/hooks/**` ∪ `.claude/settings.json`-wired) | Marker probe: each hook declares a delivery channel — `# @cc-only-rationale:` OR a `# @dual-pair:` anchor that resolves to a portable counterpart (§5 drift-check); neither = silent CC lock-in | Medium (silent CC vendor lock-in) |

**Population enumeration before sampling (T10):** each surface's full population is enumerated (`git ls-files` globs) and recorded *before* any probe, so "N clean" is meaningful, not a convenience-sample artifact (T1/T9).

## §6 `/workflows` structure

- **Phase 1 — pilot:** build + validate the CC-absent harness on the highest-risk surface (orchestration + install). Calibrate false-positive rate. Gate: harness proven to detect a *seeded* CC-coupling break before fan-out (else the harness itself is theatre, T2).
- **Phase 2 — fan-out (pipeline):** one auditor per surface, each **required** to emit a runnable probe + recorded output. Stage 2 = adversarial-verify each finding (refute-by-default) so plausible-but-wrong findings die before the kickoff.
- **Phase 3 — synthesize:** dedup across surfaces, severity-rank, group into remediation sub-waves → **Umbrella-2 kickoff**.

## §7 Embedded discipline (this is a discipline-bearing audit)

The generated kickoff MUST satisfy [ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md):
- **Cite the rule + enumerate active traps:** T1 (sampling floor ≥5), T2 (design≠run), T3 (every finding = command+output), T4 (hit all surfaces), T10 (enumerate population first), **T15 (self-application — the harness itself must run without CC; it is bash, so it does), T16 (pattern-on-name).**
- **Domain-specific trap (new):** `T-Agn-A — "@dual-pair / @cc-only-rationale marker present ≠ portability proven"`. A marker is a *claim*; the harness is the *test*. An auditor tempted to grep markers and declare a surface clean has fallen into marker-truth. Counter: the marker is the hypothesis; the probe-run is the verdict.

## §8 Deliverable — the Umbrella-2 remediation kickoff

Structured findings: `surface · severity · command-proof · fix-direction`, grouped into remediation waves. First wave item = the §2 posture-rewrite. The **harness itself becomes a regression guard** the remediation umbrella wires into CI as a conformance principle test (`packages/core/principles/<N>-agnosticism-conformance.test.ts`) — the first time agnosticism graduates from prose markers to an executable artifact, satisfying invariant (4) multi-channel enforcement.

## §9 §1.7 self-reflexive check (this spec)

- **Forward-check:** this spec complies with [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) (harness is bash/TS + git/shell — zero API-billed calls; auditor agents run on the operator's CC subscription, never CI API), [build-first-reuse-default.md §3](../../../.claude/rules/build-first-reuse-default.md) (REUSE: extends `tests/install-sh/*` rather than building fresh; BUILD limited to the CC-absent mode, justified once SSOT consult confirms no upstream harness-agnostic conformance harness), and [doc-authority-hierarchy.md §3](../../../.claude/rules/doc-authority-hierarchy.md) (carries the Authoritative-for header above).
- **Backward-check:** this audit is the recursive self-application the project never did for agnosticism — it does to *its own portability* what R1–R20 + principles 01–12 do to user code. It supersedes nothing; it extends the planned-but-unrun Phase-10 "AI-agnostic boundary" stream (open-questions §13.29–§13.39) by giving it an executable engine instead of a prose sweep. Per [memory-codification §3](../../../.claude/rules/memory-codification.md) the conformance discipline, once shipped, lives in the repo (principle test), not memory.

## §10 Open decision for execution (not blocking spec)

After spec approval, the maintainer chooses: **(a) plan-then-run** — execute the audit via `/workflows` in-session and deliver the Umbrella-2 kickoff now; or **(b) plan-only** — hand off the audit-umbrella kickoff for a later dedicated run. Recommended: **(a)**, because the deliverable described (the remediation kickoff) only exists post-audit and the repo has the autonomous `/workflows` + aif infra to produce it — but (b) is the lower-cost / review-method-first path and is a legitimate operator call.

## §11 See also

- [.claude/rules/dual-implementation-discipline.md](../../../.claude/rules/dual-implementation-discipline.md) — current posture this audit raises the bar above (§2).
- [.claude/rules/no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) — paid-surface policy the §5 surface-6 probe verifies.
- [.claude/rules/ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md) — kickoff-author obligations the §7 discipline satisfies.
- [docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) — SSOT register (#21 cross-editor parity WATCHLIST, #43 RuntimeAdapter, #101 paths: dual-channel, #106 template-var substitution) — consult before any BUILD verdict in remediation.
- `tests/install-sh/*.test.sh`, `packages/core/installer/install.test.ts` — the verified reuse base for §4.
