---
name: tool-bootstrapping
description: Use when analysing project stack for MCP or skill recommendations, user mentions tool bootstrapping, MCP installation, skill discovery, project onboarding tools, package.json deps changed, .ai-factory/tool-decisions.md, AIF /aif, tool detection, инструменты, бутстраппинг, MCP серверы, скиллы, зависимости, онбординг, подбор инструментов, предложение инструментов, подтверждение установки, memory persistence for tools, tool proposal confirmation, incremental tool re-evaluation, rejected tools memory.
---

# Tool Bootstrapping — project-aware MCP/skill proposal discipline

> **Authoritative for:** §13.25 tool-bootstrapping discipline (6 rules) for THIS project — with internal cross-links to repo state, SSOT entries #31-#37, and shipped twin.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Shipped consumer-facing version — see [skills/tool-bootstrapping/SKILL.md](../../../skills/tool-bootstrapping/SKILL.md).

## Why this skill exists

When an AI agent first encounters a project, it has no knowledge of which MCP servers or skills would help it work effectively with that project's stack. Without a codified discipline, agents either (a) load every possible tool (token waste), (b) load none (capability gap), or (c) propose tools ad-hoc without persistence (re-proposal every session). This skill codifies the six-rule loop from [closed-questions.md §13.25](../../../docs/meta-factory/closed-questions.md) that solves all three failure modes.

## The 6 rules

### Rule 1 — Analyse stack

Read `package.json`, `.mcp.json`, and any framework config files (`next.config.ts`, `vite.config.ts`, etc.) to enumerate explicit deps, external services, and existing MCP config. Delegate to AIF `/aif` for stack detection (SSOT #31 ADOPT) — AIF detects language/framework/database and maps to matching skills and MCP servers via `skills.sh` registry.

### Rule 2 — Propose tool set

Based on detected stack, surface relevant MCPs and skills. Use AIF `skills.sh` registry and skill-acquisition flow (SSOT #32 ADOPT VOCABULARY): `npx skills search` → `install --agent claude` → security-scan → generate-if-missing → learn-from-docs. Cap proposals at ≤5 per block; each must carry a load-bearing rationale (which specific dep or service requires this tool?). Prefer `context7` for documentation lookup over library-specific MCPs — one meta-MCP subsumes many.

### Rule 3 — Confirm bulk

Show the full proposed list in one block with per-item rationale, single Y/n confirmation (D1=b, matching AIF `/aif` baseline per SSOT #31). **Hard rule (D6=a): never install any MCP or skill without explicit user confirmation. No env/config bypass.**

### Rule 4 — Token-economy gate

Two-question filter before committing to any proposal: (a) is the capability codifiable as a skill? if yes → propose skill, not MCP (skills load on-demand; MCPs load permanently); (b) does loading this MCP at all sessions cost more tokens than usage frequency saves? if negative → drop from proposal. Reuse AIF `/aif` heuristic for classification.

### Rule 5 — Incrementality

At each session start, a UserPromptSubmit hook compares the current deps hash **per stack** with the last-known baseline in `.ai-factory/tool-decisions.md`. Mismatch on any present stack → inject one WARN into session context naming the drifted stack: `⚠ <stack> deps changed since last tool-bootstrap — run /tool-bootstrapping to re-evaluate`. The hook (`packages/core/hooks/deps-hash-check.sh`) covers JS (`package.json`), python (`pyproject.toml`), and rust (`Cargo.toml`, detection in DH-S2); each stack has its own baseline key (`deps-hash-npm` / `deps-hash-python` / `deps-hash-cargo`), and the legacy bare `deps-hash:` key is read backward-compatibly as the npm slot. Anchor schema: [references/decision-format.md](references/decision-format.md) §2. (Multistack landed in DH-S1, kickoff #1016; the original Wave 5.3 JS-only hook is the substrate.)

### Rule 6 — Persistence

Accepted and rejected decisions are recorded in `.ai-factory/tool-decisions.md` (committed prose, D2=b — team-shared, auditable via git). Schema → see [references/decision-format.md](references/decision-format.md). Never re-propose a rejected tool unless the rejection entry carries an explicit re-eval trigger that has fired.

## §2 Build-vs-reuse boundary

Rules 1-4 are AIF `/aif` reuse (SSOT #31 ADOPT). Building a parallel surface for rules 1-4 would replicate ~500 LOC of production AIF code and is the exact `#own-stack-blind-spot` anti-pattern per [phase-research-coverage.md §4](../../rules/phase-research-coverage.md). Rules 5-6 are builds over the thin AIF wrapper — justified because: (a) AIF has no documented incremental-on-dep-change loop (rule 5 gap confirmed via adversarial counter-prompt in research §0); (b) AIF has no «rejected» memory (rule 6 gap confirmed same session). Total build scope: `references/decision-format.md` schema + Wave 5.3 UserPromptSubmit hook.

## §3 Recursive bootstrap (D3=b)

Chicken-and-egg: rule 2 needs `context7` MCP to research what MCPs exist, but `context7` is itself a rule 2 candidate. Resolution: the installer seeds `context7` unconditionally as «stage 1 of tool bootstrapping» — the `05-mcp` layer (`setup.d/05-mcp.sh`, run inside `install.sh` on the full path) merges it into `.mcp.json` (GCC stage1 / `rustc` self-host analogue — cited in [README.md `Methodology`](../../../README.md)). `context7` is never proposed by rule 2; it is assumed present. (Originally a Wave 5.2 `setup.sh` hook; ported to `05-mcp` when the legacy wrapper was retired, 2026-07-10.)

## §4 Cross-references

- Research patch: [docs/meta-factory/research-patches/2026-05-10-§13.25-tool-bootstrapping-research.md](../../../docs/meta-factory/research-patches/2026-05-10-§13.25-tool-bootstrapping-research.md) — §3 (prior art), §4 (persistence), §7 (recursive bootstrap), §10 (SSOT proposals)
- Shipped twin: [skills/tool-bootstrapping/SKILL.md](../../../skills/tool-bootstrapping/SKILL.md)
- Decision format schema: [references/decision-format.md](references/decision-format.md)
- SSOT entries #31 (AIF `/aif` ADOPT), #32 (AIF skills.sh ADOPT VOCABULARY), #33 (Continue.dev DEFER), #37 (Windsurf Cascade DEFER): [docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md)
- Sub-waves: 5.2 (`setup.sh` context7 bootstrap, D3=b), 5.3 (AGENTS.md bullet + UserPromptSubmit hook D7=a + audit probe D4=d)

## §5 §13.18 cascade note (D9=c)

Per [open-questions.md §13.18](../../../docs/meta-factory/open-questions.md), AIF deep-alignment (Option I rules-hierarchy adoption) is armed and cascade-HIGH for §13.25. If §13.18 closes negative in Phase 11, rules 1-4 reuse-via-thin-wrapper (D8=a) may need re-implementation. Mitigation: thin-wrapper design limits coupling surface; full rewrite cost is bounded by [references/decision-format.md](references/decision-format.md) schema stability. The `Prior-art:` trailers in the Wave 5.1 commit (#31, #33) provide the audit trail for any future re-evaluation.
