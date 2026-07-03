// L4 Gate 1 — Schema check.
// Re-validates a SynthesisPlan against synthesis-plan.schema.json,
// independent of the synthesizer's own end-of-pipeline check. Catches
// the case where a plan was constructed by hand (e.g. external test
// harness, future LLM-generated plan) and never went through synthesize().

import type { SynthesisPlan } from '../synthesizer/types.ts';
import { errorsText, validateSynthesisPlan } from './internal-validators.ts';
import type { GateOutcome } from './types.ts';

export function runSchemaGate(plan: unknown): GateOutcome {
  if (!validateSynthesisPlan(plan)) {
    return {
      status: 'fail',
      failures: [
        {
          code: 'FF3001',
          reason: `SynthesisPlan schema violation: ${errorsText(validateSynthesisPlan.errors)}`,
        },
      ],
    };
  }
  const typed = plan as SynthesisPlan;
  const failures = [];
  for (const rule of typed.rules) {
    if (
      (rule.check.type === 'eslint' || rule.check.type === 'declarative') &&
      !rule['negative-test']
    ) {
      failures.push({
        ruleId: rule.id,
        code: 'FF3002',
        reason: `${rule.check.type}-checked rule has no negative-test (required by L4 gate 2 — rule-tester roundtrip)`,
      });
    }
  }
  return failures.length === 0
    ? { status: 'pass', failures: [] }
    : { status: 'fail', failures };
}
