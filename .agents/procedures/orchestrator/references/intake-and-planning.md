# orchestrator — intake and planning

> **Authoritative for:** the selected orchestrator procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

## Phase -1 — Self-review of your own kickoff (paranoia at start)

A cold read of your own dispatch prompt by 1–2 independent reviewers **before** sending catches ambiguity, stale references and hidden assumptions while the executor has not yet acted on them. A self-review embedded **inside** the prompt does NOT count as one of the reviewers — same execution context, so it is not independent. Why two rather than one, the motivating incidents and the ROI: [references/rationale.md](rationale.md).

> **Not the same gate as upstream's.** `superpowers:subagent-driven-development` scans the **plan**
> for internal conflicts before Task 1. Phase -1 cold-reviews the **dispatch prompt** by a seat
> that did not write it. Different artifact, different reader — run both.

**Must-trigger:**

- A multi-step kickoff/prompt **≥30 lines** for a junior agent
- Delegating **≥3 distinct subtasks** to one junior session
- The prompt includes git/PR operations, file edits, capability-commit territory, principle-test additions, or rule-bearing changes
- **Any Mode B file-prompt** (the «open a new session, copy EVERYTHING» format)
- **Any operation with irreversible blast radius** (prod DB write, force-push, package downgrade) — even if the prompt is small

**Skip OK:** direct Edit with no junior; a one-shot trivial task (≤10-line prompt, one Bash/Read/Edit); a read-only research call.

**Protocol skeleton:** (1) read your prompt cold → (2) spawn reviewers with an A/B focus split → (3) collect findings → (4) BLOCKER/MAJOR — fix the prompt, MINOR — log to known-residuals → (5) re-review BOTH in parallel after fixing a BLOCKER, max 3 iterations → GO. **Full protocol (reviewer prompt template, focus split, cost framing, T-traps, anti-patterns): [references/phase-minus-1.md](phase-minus-1.md).**

### Principle-test allowlist probe (mandatory measurement when NEW files land under watched paths)

If the dispatch creates ≥1 NEW file under paths guarded by the project's principle tests (for rules-as-tests-aif: `.claude/skills/**`, `.claude/rules/**`, `agents/**`, `docs/meta-factory/research-patches/**`, `packages/core/templates/**`), Phase -1 MUST include the measurement: «for every NEW path, grep `packages/core/principles/` for `EXEMPT_*` allowlists + the structural rule; confirm the artifact satisfies the rule OR falls under an exemption». Probe: `grep -rn 'EXEMPT_\|allowlist\|skip' packages/core/principles/ | grep -E '\.(test\.)?ts:' | head -20`. Grounding incident: PR #264 was pushed twice — principles 15 (paired-negative) and 10 (scope annotation) fired AFTER an 11-measurement Phase -1 missed both. (Relocated from CLAUDE.md «Operational conventions» 2026-07-21 — this skill is the declared codification target.)

### Subagent implementation (default = Opus)

Owned here, by declaration: [references/phase-minus-1.md](phase-minus-1.md) points back at
this table rather than holding its own copy.

| Scenario                                                             | Implementation                                                                        | Cost                               |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------- |
| **Hardest / max reasoning** (hardest design, irreversible operation) | Fable (`model: "fable"`)                                                              | most capable tier, use selectively |
| **Default** subagent via Agent tool                                  | **Opus** (omit `model` or `model: opus`)                                              | ~30-50k Opus per call              |
| **Prod-blast-radius** double coverage                                | 2× Opus via Agent parallel (top edge → 1× Fable)                                      | ~60-100k Opus                      |
| User explicitly said «go cheap / Sonnet»                             | 2× Sonnet via Agent tool (`model: "sonnet"`; or Mode B file-prompts for live windows) | ~0 Opus from the current session   |

**When the orchestrator writes a sub-prompt for another session**, that sub-prompt **must explicitly** state the implementation (Mode A 1× Fable / 1× Opus / 2× Opus / 2× Sonnet / Mode B 2× Sonnet). Model choice follows task difficulty.

---

## Phase 0 — Pre-flight (once, before starting)

**The senior does this itself** (not delegated), using values from discovery: stash any WIP
(`git stash push -u -m "wip: pre-umbrella <TASK_ID>"`), `git fetch <REMOTE>`, then branch off the
base — `git checkout -b <type>/<TASK_ID>-<slug> <BASE_BRANCH>`, type ∈ {feat, fix, hotfix,
refactor, chore} by umbrella character.

If Pre-flight `git status` shows WIP unrelated to the umbrella — **ask the user** before stashing. We do not silently lose someone else's work.

> Once the branch is ready, the executor loop is `Skill('superpowers:subagent-driven-development')` —
> it owns dispatch, per-task review, the fix rounds and the final whole-branch review. Use
> `Skill('superpowers:executing-plans')` only where subagents are unavailable; that skill says so
> itself.

---

## Phase 1 — Intake of fixes

- **Response format per fix:** 2–3 lines, no tool calls.
  ```text
  Got #N: «<old>» → «<new>» in <screen/file if named>. Registered.
  ```
- **Internal register.** Up to 5 fixes — in head. ≥5 — TodoWrite (1 item per fix, status pending).
- **Clarifications.** If a fix is ambiguous — **one** question. Better to spend 200 tokens on a clarification than 5000 on rework.
- **Do not argue UX downsides.** The user knows → the decision is made. Register it silently.

**Phase ends on:** «that's all», «plan», «go», «enough», or an explicit end of the stream.

---

## Phase 2 — Plan

One table in one message:

```text
| # | fix (1 line)                       | file/screen           | risk | depends on | batch |
| 1 | <fix>                              | <file>                | low  | -          | A     |
| 2 | <fix>                              | <file>                | low  | -          | A     |
| 3 | <fix>                              | grep across project   | med  | -          | B     |
| 4 | <fix>                              | <file>                | low  | -          | C     |
```

**Batch grouping rules:**

- **One file = one batch** (minimises merge conflicts).
- **Cross-cutting fixes** (renaming a prop + its consumers) — one batch.
- **Independent batches** — in parallel (Phase 3).
- **High-risk fixes** (logic, not just text) — a separate batch, no parallelism, tested first.

**Agreement:** a short «ok?» at the end. Without agreement, do not move to Phase 3. This is the only pause until the umbrella ends.

> For PRD-driven decomposition, `Skill('superpowers:writing-plans')` owns the plan document —
> import its tasks into the batch table above.

---
