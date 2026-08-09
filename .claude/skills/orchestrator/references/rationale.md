# Orchestrator — rationale & history

> **Why this file exists:** the main `SKILL.md` holds only the reusable, general workflow. The *why* behind specific rules — the incidents that motivated them, machine/account-specific quirks, and cross-project vocabulary mapping — lives here so the skill body stays lean and portable. Read this when you want the reasoning, not the rule.

## Vocabulary alignment with companion tools

Our internal terms stay **primary** (short, muscle-memory). The companion-equivalent column documents convergent upstream vocabulary so cross-project readers map terms 1:1. This is **ADOPT-VOCABULARY, no dependency** — the substrate stays companion-free.

| Our term (primary) | Companion equivalent | Relationship |
|---|---|---|
| **Mode A / Mode B** (delegation styles) | Superpowers `subagent-driven-development`; aif-handoff Planner/Implementer/Reviewer | vocabulary aligned; no dependency |
| **Worktree-per-parallel-session** | Superpowers `using-git-worktrees`; aif-handoff Git Isolation | mature upstream; we reference it |
| **Worker / Reviewer subagents** | Superpowers SDD role prompts; aif-handoff RuntimeAdapter | our scope narrower; reference upstream |
| **Orchestrator dispatch + verification loop** | OhMyOpencode Atlas (verification) + Prometheus (planning) | vocabulary aligned |

## Model selection — the opusplan-bug history (machine/account-specific)

The three-tier model rule (Fable / Opus / Sonnet by task complexity) in `SKILL.md` is the general rule. The specific caution below is machine/account-specific and may not apply on every setup:

- **Historical quirk:** on some Claude Code setups, spawning a subagent with `model: "sonnet"` via the Agent tool silently billed the **Opus** pool (the "opusplan" routing bug) — so the expected Sonnet-quota saving was illusory, and reasoning quality was worse. On those setups, real Sonnet separation only came from a separate Sonnet window (Mode B, manual copy-paste).
- **Current status (operator-reported, unverified mechanically):** the bug is understood to be resolved. **Verify on your own setup** before relying on Sonnet-via-Agent for quota separation: after the first Sonnet dispatch, check `/status` or `claude.ai/usage` that the spend landed on the Sonnet pool, not Opus. If it landed on Opus, the bug is live on your setup — fall back to a separate Sonnet window.

### Legacy env `CLAUDE_CODE_SUBAGENT_MODEL=sonnet`

If this env var is set (an older setup), Mode A subagents may default to Sonnet. Either `unset CLAUDE_CODE_SUBAGENT_MODEL` (and remove it from `~/.zshrc` / `~/.bashrc`) so Mode A inherits the session model, or keep it and pass `model: "opus"` explicitly on each call where you want Opus.

## Why Phase -1 (kickoff self-review) exists

Phase -1 — a cold read of your own dispatch prompt by 1–2 independent reviewers before dispatching — was added after a real incident: a cold-start review caught **4 BLOCKER + 4 MAJOR** in a self-written kickoff (a reference to a deleted line, a slot-number collision, vague hook placement, a missing capability-commit clarification). Without it, two PRs would have shipped broken and surfaced the errors post-merge or in the executor's CI.

**Why two reviewers, not one:** a single self-review misses its own blind spot. In one case, a solo cold-verify still found 7 bugs in a batch of dispatch prompts — one reviewer closes part of the gap, but a second independent focus (different lens) catches what the first misses. An embedded self-review inside the prompt itself does NOT count as one of the two — it shares the execution context, so it isn't independent.

**ROI:** a review pass costs ~30–100k tokens; re-dispatching an executor on a bad prompt costs ~120–200k plus wall-clock plus the risk of bad state. Breakeven is ~0.5 caught BLOCKER/MAJOR per session — usually far exceeded.

## Why Phase 4.5 pre-mark discipline exists

Copying a kickoff checklist into a PR body with empty `[ ]` boxes pushes verification work onto the reader for things already verified — and a specific past incident had an aggregating epic→staging PR ship with its checklist copied blank. Hence: pre-mark `[x]` only for what a concrete artifact (CI output, worker REPORT verify-trace, or reviewer probe) actually verified; leave `[ ]` only for physically-pending items. Do not extrapolate "merged means runtime-verified."

## Provenance

This skill implements two patterns from Anthropic's [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents): **orchestrator-workers** (dynamic decomposition + delegation with isolated executor context) and **evaluator-optimizer** (worker self-verifies; orchestrator evaluates the REPORT and sends follow-ups on red flags).
