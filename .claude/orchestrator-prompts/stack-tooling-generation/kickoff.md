<!-- scope: kickoff — stack-tooling-generation umbrella (LEVEL 2) — STUB. Design base: docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md §2 D2 + §7.3 (the two-client seam). Status: STUB per the U-stub convention — unfold into a full kickoff (own R-phase → design → stages) BEFORE dispatch. Tier: classified at unfold time. -->

# stack-tooling-generation — kickoff (STUB)

> **Status:** 🟡 **STUB — unfold before dispatch.** GATED on
> `.claude/orchestrator-prompts/getff-freshness-widening/done.md` existing on `origin/staging`
> (the two-client ledger seam this level plugs into).
> **Goal (operator vision, recorded 2026-07-12 + re-confirmed 2026-07-23):** apply the SAME
> parameterized engine — *research live source-of-truth → generate executable artifact →
> lock → keep fresh* — to the stack's TOOLING: which MCP servers, skills, and companion
> plugins THIS stack at THIS version needs. Tooling advice rots exactly like practices do
> (operator's example: Drizzle ORM v1.0.0-rc — new tools appear, old advice stales), so the
> recommendation set must be researched and refreshed, not pre-baked.

## Scope sketch (unfold into stages later)

- **Reuses (verified seeds):** `tool-bootstrapping` skill (analyze deps → propose → confirm →
  persist `.ai-factory/tool-decisions.md`, 6-rule discipline) = the seed client;
  `deps-hash-check` = the staleness trigger (already parses npm/python/rust manifests);
  the two-client ledger schema from freshness-widening S3 = the journal (level 2 must need
  NO new mechanism — that was D2's binding seam requirement).
- **New (the actual level-2 work, design at unfold):** research channel for tooling (what is
  the live source-of-truth for «which MCP/skills fit stack X vX» — registries, docs,
  ecosystem surveys; trust tiers apply per `research-source-trust.md`); generation target
  (tool-decisions entries / MCP config proposals — consumer-acked, never auto-installed
  without confirm per tool-bootstrapping Rule discipline); freshness loop (version bump →
  tooling recommendations re-evaluated, same nudge polarity as rules).
- **Out of scope (unchanged):** auto-installing tools without consumer confirmation;
  new package ecosystems; product track U9/U10.

## Unfold checklist (before any dispatch)

1. Re-verify the seam: freshness-widening S3 ledger schema actually serves a tool-decisions
   client (its stage fixture proved it — re-run, quote).
2. R-phase: survey the live sources for tooling recommendations per supported ecosystem;
   BFR/SSOT consult (tool-bootstrapping lineage: SSOT #31-#37; prior-art re-check per
   [build-first-reuse-default.md §3](../../rules/build-first-reuse-default.md)).
3. Author the full kickoff (§0 probe, stages, works-criteria, traps) per
   [getff-to-prod-meta-launch §D](../getff-to-prod-meta-launch/kickoff.md) unfold discipline;
   classify Tier per CLAUDE.md at that point.

## AI-laziness traps (stub-level; re-enumerate at unfold)

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps
for the unfold session: T7, T11, T12, T16.** T16 especially: `tool-bootstrapping` solves
«recommend from a curated registry», level 2 solves «research live + keep fresh» — verify the
problem-class match explicitly before reusing its mechanics wholesale; the name similarity is
exactly the trap.

## See also

- Spec (BINDING for the seam contract): [2026-07-23-getff-any-stack-closure-design.md](../../../docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md) §2 D2, §7.3.
- Vision record: `.claude/orchestrator-prompts/python-delivery-v0-meta-launch/decisions.md`
  «Owner vision-clarification» (2026-07-12).
- Seed: [.claude/skills/tool-bootstrapping/SKILL.md](../../skills/tool-bootstrapping/SKILL.md).

<!-- host-verify: none — planning STUB (self-declared): scope sketch to unfold into stages later; no executable deliverable until an unfold produces real kickoffs that declare their own contracts -->
