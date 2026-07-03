# Anti-patterns with examples

> **Authoritative for:** the expanded case-study catalogue of the 10 anti-patterns from [`phase-research-coverage.md §4`](../../../rules/phase-research-coverage.md) — concrete project examples for fast pattern-matching during retro / self-review. Inherits invocation scope from [SKILL.md](../SKILL.md).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../../README.md#why-this-exists). The anti-pattern definitions themselves — owned by [phase-research-coverage.md §4](../../../rules/phase-research-coverage.md).

## The 10 anti-patterns

| Tag | One-line summary | Mitigated by |
|---|---|---|
| `#own-stack-blind-spot` | own deps treated as inert infra, not candidate analog | §1.1 |
| `#semantic-anchor` | anchoring on capability vocabulary, not function | §1.3 |
| `#prompt-list-anchoring` | closing at 3-5 candidate floor as ceiling | §1.5 |
| `#negative-existence-claim` | accepting «no production tool implements X» without counter-prompt | §1.4 |
| `#category-sweep-missed` | closing without enumerating named-precedent categories | §1.2 |
| `#recursive-self-application-gap` | discipline applied bottom-up to code, not top-down to design | §2.5 |
| `#scope-not-formal-trigger` | process gate scoped narrowly, doesn't fire on adjacent shapes | §1.6 |
| `#trigger-sweep` | armed-but-not-fired §13.x triggers sit indefinitely | §1.6 |
| `#adopted-pattern-drift` | external pattern shifts; project's adoption stays static | SSOT velocity tags |
| `#recommendation-skips-own-discipline` | recommendation fails forward+backward against existing disciplines | §1.7 (this skill) |

## Three documented case studies of `#recommendation-skips-own-discipline`

### Case 1 — PR #16 EXECUTION-PLAN drift (months of accumulation, expensive fix)

**What happened:** `EXECUTION-PLAN.md §1` silently re-defined the project's goal as «recursive self-application is the north star» — overriding `README.md#why-this-exists`. Drift went uncaught for months. AI reviewers in subsequent sessions pattern-matched on §1's authoritative language and reinforced it, creating feedback-loop drift.

**Same shape:** the doc that was supposed to be operational claimed authority over project goal — drift introduced *in the doc that should prevent drift*.

**Cost:** ~3 months of accumulated drift; 23-commit PR to fix; new rule (`doc-authority-hierarchy.md`) + new principle (09) + 30+ doc edits across 5 audit waves.

**Why §1.7 would have caught it:** forward-check item 6 (doc-authority on artefacts) — when EXECUTION-PLAN §1 was written introducing «north star» language, the proposal did not check whether `README.md#why-this-exists` already owned that scope. Forward-check would force the question «does another doc already claim authority for this scope?» — surfacing the conflict before close.

### Case 2 — «Defer until consumer pain» reasoning, 4 turns one session

**What happened:** Research session about applying discipline-from-start to consumer-shipped artefacts. The assistant repeatedly applied the «no consumers yet → premature optimisation → defer» framing across 4 distinct sub-decisions in the same session:

1. Factory ESLint Plugin adoption.
2. §13.21 L3 generated-docs discipline.
3. Pre-1.0 comprehensive audit timing.
4. Generated-docs polish.

User pushed back each time. Assistant agreed each time. 2-3 messages later, same framing returned.

**Same shape:** session about *applying discipline before pain surfaces* arguing *against the project's own thesis* in real-time. Industry-conventional language («YAGNI», «pre-1.0», «no consumers») accepted as more authoritative than this specific project's stated thesis (see `#recommendation-skips-own-discipline` body — meta-cognitive blindspot).

**Cost:** session-level drift; user fatigued pushing back same point repeatedly.

**Why §1.7 would have caught it:** forward-check Layer 7 (user-value goal lens) — does the deferral reasoning align with [README.md#why-this-exists](../../../../README.md) thesis? «Documents lie; tests don't» / «every rule fails CI on violation» is preventive, not reactive. «Defer until pain» is reactive — direct contradiction. Forward-check would force the question explicitly.

### Case 3 — L3 generated-docs research recommendation 2026-05-09

**What happened:** Research session on closing [§13.21](../../../../docs/meta-factory/closed-questions.md). Recommendation passed prompt's 5-hypothesis anti-pattern self-audit but failed silently against six existing project disciplines:

1. principle 08 capability-commit classification (`.claude/skills/` is outside `packages/` scope per CLAUDE.md hook definition).
2. SSOT entries for ESLint extends / Tailwind presets / AGENTS.override.md not verified.
3. §13.x trigger sweep not run.
4. `.claude/agents/*.md` referenced as scope, but files don't exist in repo.
5. Phantom «Research A» reference (no such artefact).
6. Duplicate canonical-list entries (`skills/rules-as-tests/*` already in `principle 09 REQUIRED_HEADER_DOCS`).

All six surfaced via reviewer pushback in same session.

**Same shape:** research **about** preventing recursive-self-application gap, recommendation **failing** recursive-self-application check.

**Cost:** REVISE verdict; this skill + §1.7 + research-patch are the fix.

**Why §1.7 would have caught it:** forward-check layers 1-7 + backward-check steps 1-6 independently catch each of the six gaps. See [bootstrap research-patch](../../../../docs/meta-factory/research-patches/2026-05-09-recommendation-skips-own-discipline.md) §«§1.7 self-review» table for line-by-line walk.

## Pattern-match heuristics

When you see your own draft contain one of these phrases — pause and check §1.7:

- «defer until», «premature for current scale», «wait until first consumer», «not yet», «pre-1.0»
- «no consumers yet», «no users yet», «no pain has surfaced»
- «north star», «central thesis», «main goal» (in operational doc)
- «we'll fix when reported», «existing pattern is sufficient» (without checking if existing pattern actually applies)
- «similar to X» (without verifying X exists in repo)
- «Research A» / «separate research session» (without verifying that research exists)

These phrases are not banned — they may be correct in context. They are **trigger words** for §1.7 application, not for rejection.
