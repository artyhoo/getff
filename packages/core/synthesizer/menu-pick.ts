// Stage 2 — live generate-path: LLM picks rules from the curated menu.
// Reuses loadRecipe + mergeEslintRuleConfig from the curated path additively.
// The curated synthesize() is not touched; both paths compose via the same primitives.
//
// Dependency injection: the MenuPickClient is injected by the caller so tests
// use a deterministic stub and install-time wires the real LLM adapter.
// No live LLM calls here — all I/O is behind the client port.

import type { ResearchPlan } from '../research/types.ts';
import { weakestTier, stampProvenanceTier } from './tier.ts';
import { loadRecipe } from './synthesize.ts';
import { compileDeclarativeMd } from './compile-declarative-md.ts';
import { mergeEslintRuleConfig } from './merge-eslint-config.ts';
import { wireRuleThroughNode } from './to-node.ts';
import type { SynthesisPlan, SynthesizedRule } from './types.ts';
import type { Menu, MenuCandidate, MenuPickClient } from './menu-pick-port.ts';

export async function synthesizeLive(
  plan: ResearchPlan,
  client: MenuPickClient,
): Promise<SynthesisPlan> {
  const candidates: MenuCandidate[] = plan.patterns
    .filter((entry) => loadRecipe(entry.id) !== null)
    .map((entry) => ({
      id: entry.id,
      summary: entry.summary,
      bestPractices: entry.bestPractices,
      antiPatterns: entry.antiPatterns,
    }));

  const menu: Menu = {
    framework: plan.framework,
    version: plan.version,
    candidates,
  };

  const selection = await client.pick(menu);

  const rules: SynthesizedRule[] = [];
  const mdFragments: string[] = [];
  const mergedEslintConfig: Record<string, unknown> = {};
  const ruleSources = new Map<string, string[]>();
  let nextId = 1;

  for (const selected of selection.selected) {
    const entry = plan.patterns.find((p) => p.id === selected.id);
    if (!entry) continue;
    const recipe = loadRecipe(entry.id);
    if (!recipe) continue;
    if (plan.framework !== null && !recipe.appliesTo.includes(plan.framework)) continue;

    const id = `G${nextId++}`;
    // S1 §3 criterion 3 / §6 fork 4 (PARK-S1-2 Option C): stamp tier at synthesis
    // time, mirroring synthesize.ts — a fact about the research moment, never
    // re-derived at install time. Symmetry with synthesize.ts keeps the curated
    // and live paths byte-identical (menu-pick.test.ts (b) invariant).
    const stampedProv = stampProvenanceTier(entry.provenance);
    const composed: SynthesizedRule = {
      ...recipe.rule,
      id,
      research: { entryId: entry.id, provenance: stampedProv, tier: weakestTier(stampedProv) },
    };
    // MT S3b врезка: thread the composed rule through the IR plane (grammar gate + npm
    // adapter for the declarative-syntax class); output stays byte-identical (mergeEnrichment
    // preserves the composed rule's key order). Mirrors synthesize.ts:90-102.
    const rule = wireRuleThroughNode(composed);
    rules.push(rule);
    if (rule.check.type === 'declarative') {
      mdFragments.push(compileDeclarativeMd(rule));
    } else {
      mdFragments.push((recipe.rulesMdTemplate ?? '').replace(/\{\{id\}\}/g, id));
    }

    const eslintConfig = selected.eslintConfigOverride ?? recipe.eslintRuleConfig;
    mergeEslintRuleConfig(mergedEslintConfig, eslintConfig, recipe.patternId, ruleSources);
  }

  return {
    framework: plan.framework,
    version: plan.version,
    rules,
    rulesMd: mdFragments.join('\n'),
    eslintConfigSnippet: JSON.stringify(mergedEslintConfig, null, 2),
  };
}
