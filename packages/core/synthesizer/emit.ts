// Side-effect emitter: writes a SynthesisPlan to disk as 3 files.
// Deliberately segregated from index.ts (Planner-Executor): L4 Validator
// (Phase 7+) consumes the pure SynthesisPlan via index.ts, not file output.

import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalRuleHash } from './canonical-rule-hash.ts';
import { weakestTier } from './tier.ts';
import type { SynthesisPlan, SynthesizedRule } from './types.ts';

export class EmitError extends Error {
  constructor(public readonly path: string, reason: string) {
    super(`Cannot emit synthesis plan to ${path}: ${reason}`);
    this.name = 'EmitError';
  }
}

export function emit(plan: SynthesisPlan, outputDir: string): void {
  const dir = resolve(outputDir);
  if (!existsSync(dir)) {
    throw new EmitError(dir, 'output directory does not exist');
  }
  if (!statSync(dir).isDirectory()) {
    throw new EmitError(dir, 'output path is not a directory');
  }

  const manifestAdditions: Record<string, unknown> = {};
  for (const rule of plan.rules) {
    const { id, research, ...manifestShape } = rule;
    manifestAdditions[id] = { ...manifestShape, research };
  }

  writeFileSync(
    resolve(dir, 'rules-manifest-additions.json'),
    JSON.stringify(manifestAdditions, null, 2) + '\n',
  );
  writeFileSync(
    resolve(dir, 'RULES-additions.md'),
    plan.rulesMd ? `# Synthesized rules\n\n${plan.rulesMd}` : '# Synthesized rules\n\n(no rules)\n',
  );
  writeFileSync(
    resolve(dir, 'eslint-rules-snippet.json'),
    plan.eslintConfigSnippet + '\n',
  );

  // S4: provenance header — generated-marker + per-rule source + content-hash.
  // The generator is the sole writer; S5's anti-hand-edit gate recomputes
  // canonicalRuleHash and rejects a manual edit of an emitted rule file.
  const provenanceRules: Record<string, unknown> = {};
  for (const rule of plan.rules) {
    provenanceRules[rule.id] = {
      source: {
        entryId: rule.research.entryId,
        provenance: rule.research.provenance,
      },
      contentHash: canonicalRuleHash(rule),
    };
  }
  writeFileSync(
    resolve(dir, 'provenance.json'),
    JSON.stringify(
      {
        generatedBy: 'rules-as-tests-synth',
        note: 'GENERATED — do not edit emitted rule files by hand; regenerate via the synthesizer. S5 enforces this mechanically.',
        rules: provenanceRules,
      },
      null,
      2,
    ) + '\n',
  );

  // S1: generation-context manifest — the source of truth for the dependency
  // version + per-rule provenance/tier that shell lanes (python/cargo/go) read
  // at install time (PARK-S1-3 → Option B; getff-freshness-widening S1 §3 criterion 2).
  // npm lanes go through install.ts directly; shell lanes have no Node and must
  // grep/sed-extract from this flat JSON (indent=2 = one field per line).
  // Tier derivation: single canonical weakestTier() from synthesizer/tier.ts — same
  // function install.ts uses for the lock (no sync-by-copy-paste, dual-impl §8).
  const ctxRules = plan.rules.map((r: SynthesizedRule) => ({
    id: r.id,
    provenance: r.research.provenance,
    tier: weakestTier(r.research.provenance, r.research.tier),
  }));
  writeFileSync(
    resolve(dir, 'generation-context.json'),
    JSON.stringify({ version: plan.version, rules: ctxRules }, null, 2) + '\n',
  );

  // §6 fork 2 / §3a option B: fragment-per-rule composition. One JSON file per rule
  // id in generation-context/<rule-id>.json, each in final lock shape. Shell lanes
  // glob+cat-join by filename (no JSON parsing in shell). The nested
  // generation-context.json above is POSIX-extractable for `version` (single scalar
  // via grep/sed) but NOT for the per-rule array, so per-rule data ships as fragments.
  // Template lanes (python/cargo/go) that produce rules with no research provenance
  // get honest fragments with provenance:[] + tier:DEFAULT_TIER — DERIVED from the
  // fragment dir, never literal-printed by the shell writer.
  const fragDir = resolve(dir, 'generation-context');
  mkdirSync(fragDir, { recursive: true });
  for (const r of ctxRules) {
    writeFileSync(
      resolve(fragDir, `${r.id}.json`),
      JSON.stringify(r) + '\n',
    );
  }
}
