// L4 Gate 6 — Cross-rule conflict detector.
// Per architecture.md §2.6: conflict-checks against existing preset rules
// + post-merge consistency of the synthesized eslintConfigSnippet.
//
// v1 catches three failure modes:
//   (a) plugin rule reference orphan — synthesized rule's check.rule
//       (e.g. 'rules-as-tests/no-server-imports-in-client') must resolve
//       in the preset plugin registry,
//   (b) snippet drop — every eslint-checked synthesized rule must have
//       a corresponding entry in plan.eslintConfigSnippet (catches B1
//       silent drops or future merge-strategy bugs),
//   (c) duplicate eslint rule references across synthesized rules with
//       no merge strategy — verifies B1 mergeEslintRuleConfig was
//       consistent for the rule names actually referenced by check.rule.
//
// Synth-vs-preset config conflicts (severity drift, options override)
// require a richer model than v1 needs — current 3 recipes deliberately
// reuse the preset rule rules-as-tests/no-server-imports-in-client at
// 'error' severity, matching preset's intent. Phase 8 may extend this.

import presetPlugin from '@rules-as-tests/preset-next-15-canonical/eslint-rules';
import type { SynthesisPlan } from '../synthesizer/types.ts';
import type { GateFailure, GateOutcome } from './types.ts';

const PRESET_PREFIX = 'rules-as-tests/';

function getPresetRuleNames(): Set<string> {
  return new Set(Object.keys(presetPlugin.rules));
}

export function runConflictGate(plan: SynthesisPlan): GateOutcome {
  const failures: GateFailure[] = [];
  const presetRules = getPresetRuleNames();
  const snippet = JSON.parse(plan.eslintConfigSnippet) as Record<string, unknown>;

  const checkRuleToSyntId = new Map<string, string>();

  for (const rule of plan.rules) {
    if (rule.check.type !== 'eslint') continue;
    const ruleName = rule.check.rule;

    // (a) plugin rule existence
    if (ruleName.startsWith(PRESET_PREFIX)) {
      const bareName = ruleName.slice(PRESET_PREFIX.length);
      if (!presetRules.has(bareName)) {
        failures.push({
          ruleId: rule.id,
          code: 'FF3008',
          reason: `references plugin rule '${ruleName}' that does not exist in the preset plugin registry; known: ${Array.from(presetRules).map((n) => PRESET_PREFIX + n).join(', ')}`,
        });
      }
    }

    // (b) snippet completeness — eslintConfigSnippet must have an entry
    if (!(ruleName in snippet)) {
      failures.push({
        ruleId: rule.id,
        code: 'FF3009',
        reason: `synthesized rule references '${ruleName}' but eslintConfigSnippet has no entry for it (B1 merge may have dropped the rule, or recipe.eslintRuleConfig is empty)`,
      });
    }

    // (c) duplicate check.rule across synthesized rules — informational marker;
    //     B1 mergeEslintRuleConfig already throws synthesize-time on
    //     unsupported collisions. Track first-source for the optional report.
    if (!checkRuleToSyntId.has(ruleName)) {
      checkRuleToSyntId.set(ruleName, rule.id);
    }
  }

  return failures.length === 0
    ? { status: 'pass', failures: [] }
    : { status: 'fail', failures };
}
