# KICKOFF — guard-liveness **v3 / manual rules via Superpowers dogfood** (sub-wave of N9? umbrella)

> **Type:** I-phase (build + design — companion-contract). Days-week scale (the design half is the longer arm).
> **Sub-wave v3** of guard-liveness umbrella. Siblings: v0 (audit), v1 (ESLint), v1.5 (cmd/script), v2 (full-sweep).
> **Design SSOT:** [docs/meta-factory/research-patches/2026-05-23-guard-liveness-gate.md](../../../docs/meta-factory/research-patches/2026-05-23-guard-liveness-gate.md) §3 sub-wave row v3.
> May run in parallel with v1.5.
> **Admission:** candidate ([wave-sequencing-plan.md §0](../../../docs/meta-factory/wave-sequencing-plan.md)).

| Stage | Scope (one line) | Depends on |
|---|---|---|
| v3 | manual rules via Superpowers dogfood: pressure-scenarios for the 5 manual rules (§1) | v0 lands (criticality list for the 5 manual rules) |

## §0 Why this sub-wave (origin)
`check.type === 'manual'` rules (5 of 26 in current manifest) have NO executable input — they are judgement-based («human/AI reads doc and decides»). `gate-rule-tester` skips them; no deterministic injection mechanism exists by construction. **But Superpowers' `writing-skills` skill solves this exact problem** for skill artifacts via **pressure-scenarios** (`SKILL.md:14-43` of the installed `writing-skills` skill): subagent runs WITHOUT skill → baseline failure; subagent runs WITH skill → compliance; RED→GREEN proves the skill teaches. The project's stance ([niche-roadmap §N1 line 21](../../../docs/meta-factory/research-patches/2026-05-21-niche-strategy-and-growth-roadmap.md), [line 90](../../../docs/meta-factory/research-patches/2026-05-21-niche-strategy-and-growth-roadmap.md)) makes the right call explicit: **process-layer dogfood Superpowers; keep substrate dependency-free.** Manual rules are exactly the moment for that dogfood.

## §1 Core deliverable
A **companion-bridged liveness mechanism** for manual rules: each manual rule ships a pressure-scenario template; an AI-agnostic prober runs WITHOUT/WITH the rule via SP's pattern; reports RED→GREEN delta. Session-bound (operator-triggered), NOT CI.

## §2 Scope
**IN:**
1. **Schema addition** to manual-rule manifest entries:
   ```ts
   interface ManualRuleCheck {
     type: 'manual';
     rationale?: string;
     'pressure-scenario'?: {            // new: v3
       'baseline-prompt': string;       // scenario forcing a choice between rule and shortcut
       'observable-failure': string;    // what RED looks like (literal phrase / behavior)
       'observable-compliance': string; // what GREEN looks like
     };
   }
   ```
2. **AI-agnostic sub-agent prompt** at `agents/manual-rule-liveness-prober.md` — read by an active session (CC / Cursor / Aider) on operator's subscription, **never invoked from CI**. The prober: reads a manual rule's `pressure-scenario`, dispatches a fresh subagent into the baseline prompt twice (without/with the rule loaded), parses the two responses for `observable-failure` / `observable-compliance` markers, reports delta. Mirrors SP's `subagent-driven-development` two-subagent shape (`SKILL.md:8` of the installed skill).
3. **Session-trigger convention:** add `/guard-liveness-probe <rule-id>` slash-command guidance to operator workflow; OR fold into existing `/aif-verify` skill if compatible (decide in §3).
4. **principle 02 / 15 extension:** for `check.type === 'manual'`, assert `pressure-scenario` fields are populated (non-empty, observable-failure ≠ observable-compliance).
5. **Migration:** populate `pressure-scenario` for v0's LOAD-BEARING manual rules in this PR.

**OUT:**
- ESLint / command / script — sibling sub-waves.
- CI invocation of this prober — explicitly forbidden ([no-paid-llm-in-ci.md §1](../../../.claude/rules/no-paid-llm-in-ci.md)); the prober is session-bound. If a future maintainer wants CI invocation, that requires a separate authorization per [no-paid-llm-in-ci.md §4 escape hatch](../../../.claude/rules/no-paid-llm-in-ci.md).
- Contributing the prober TO Superpowers (= N5 give-back territory). v3 ships it in OUR repo; N5 separately decides whether/how to contribute. See §7.

## §3 Method (MANDATORY before any code)
1. **Wait for v0** — read v0's criticality table; extract the manual row-set.
2. **Re-verify the SP integration claim** against installed v5.1.0 (T16, dual-channel ≠ ground truth — see [memory feedback](../../../docs/meta-factory/research-patches/2026-05-22-memory-coverage-audit.md)). Open `/Users/art/.claude/plugins/marketplaces/superpowers-dev/skills/writing-skills/SKILL.md` and confirm the RED→GREEN cycle is as described; confirm the subagent dispatcher convention against `subagent-driven-development/SKILL.md`.
3. **Channel decision:** SP-pattern is **judgment, not gate**. Per [rule-enforcement-channel-selection.md §1-§2](../../../.claude/rules/rule-enforcement-channel-selection.md) judgment → injection (not gate). Session-bound trigger = correct. **Do NOT** try to ram this into pre-push as a gate — that's the `#gate-where-judgment-needed` anti-pattern.
4. **Slash-command vs `/aif-verify` fold:** survey existing operator-facing probes (in [skill-context overrides](../../../packages/core/templates/shared/skill-context/)) to choose. New slash-command if no clean fold exists; document the choice.
5. **Search-coverage** (≥3 phrasings): «AI agent / LLM probing for judgement-rule compliance via pressure scenario». DeepWiki on `obra/superpowers` + `Aider-AI/aider` + WebSearch. If a tool surfaces that already does this, flip BUILD→ADOPT.

## §4 Discipline obligations on the PR
- Capability commit (new ≥80 LOC under `agents/`) → `Prior-art:` trailer citing the SP `writing-skills` precedent + §3 step 5 verdict.
- §1.7 forward+backward — H3 marker + file:line both sides.
- **Substrate-purity guard:** `grep -E '"superpowers"' package.json` MUST stay empty (no npm dep added). Verify and report in PR body.
- **N5 give-back hook:** the agent prompt is a candidate contribution. Add a note in the agent header: «N5 give-back candidate — see [niche-roadmap §N5](../../../docs/meta-factory/research-patches/2026-05-21-niche-strategy-and-growth-roadmap.md).»
- Self-application: every LOAD-BEARING manual rule in OUR manifest gets a real pressure-scenario, not a placeholder.

## §5 AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md))
Active: **T2** (designing the probe ≠ running it — run the prober against ≥3 manual rules and report RED→GREEN deltas), **T3** (file:line on every claim about SP's mechanism), **T13** (SP is ADOPTED process-layer — confirm RED→GREEN works for OUR judgement-rules, not just SP's skills, before declaring done), **T15** (self-application — the prober itself is a manual rule «every manual rule has a pressure-scenario»; does its own pressure-scenario exist?), **T16** (`writing-skills` and our manual rules sound aligned — verify problem-class match: SP teaches skills to agents; our rules constrain agent behavior in code. Same shape? Cite evidence).
Domain-specific:
- **T-V3-A:** «pressure-scenario is just a violating example» — FALSE. Per SP's pattern it's a *forcing function* — a scenario where the rationalizing-shortcut path is tempting (time pressure, authority, sunk cost) and only the rule stops it. Counter: each pressure-scenario must declare which pressure it applies (≥1 of time/authority/sunk-cost/scope-creep).
- **T-V3-B:** «I asked one fresh subagent without the rule, it complied → rule unnecessary». Counter: SP's pattern requires the failure to surface, then re-run. A single non-failing baseline means the scenario isn't pressuring hard enough — strengthen scenario, re-run.

## §6 Phase -1
Cold-review (1× Opus, this Wave is unusually load-bearing because it crosses into companion-territory): stale refs, ambiguity, missing constraints, §5 substance, **SP-claim re-verification** (incident 2026-05-22 — agent twice mis-applied UPS row to Stop hook; demand re-fetch in this cold-review).

## §7 Coupling notes
- **v1 schema must land first** (`NegativeTest.input: string[]`) — v3 adds a parallel field for manual, the umbrella migration is staged across sub-waves.
- **N5 give-back:** v3's prober + the schema convention are the strongest give-back candidate of the umbrella. After v3 ships green, the maintainer decides at N5 whether to contribute (likely shape: a Superpowers skill, since SP is zero-dep and accepts skill PRs).
- **`/aif-verify` interaction:** if folded, document the new probe surface in [INSTALL-FOR-AI.md](../../../INSTALL-FOR-AI.md).
