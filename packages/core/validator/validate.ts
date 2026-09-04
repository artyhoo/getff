// L4 Validator — pure aggregator over 6 gates.
// Phase 7 v1 ships gates 1, 2, 4, 6 as REQUIRED; gate 3 SKIP, gate 5 DEFER.
// Side-effect-free: input SynthesisPlan, output ValidationReport.
// Installer (L5) consumes ValidationReport.ok before writing to disk.

import type { SynthesisPlan } from '../synthesizer/types.ts';
import { runAutofixCleanGate } from './gate-autofix-clean.ts';
import { runConflictGate } from './gate-conflict.ts';
import { runMessageIdCoverageGate } from './gate-message-id-coverage.ts';
import { runRuleTesterGate } from './gate-rule-tester.ts';
import { runSchemaGate } from './gate-schema.ts';
import { runSingleTokenDiffGate } from './gate-single-token-diff.ts';
import { runTautologyGate } from './gate-tautology.ts';
import { runRequireVacuityGate } from './gate-require-vacuity.ts';
import type { GateOutcome, ValidationReport } from './types.ts';

const SKIPPED: GateOutcome = {
  status: 'skip',
  failures: [],
};

export function validate(plan: SynthesisPlan): ValidationReport {
  const schema = runSchemaGate(plan);
  const downstreamSkipped = schema.status === 'fail';
  const ruleTester = downstreamSkipped ? SKIPPED : runRuleTesterGate(plan);
  const tautology = downstreamSkipped ? SKIPPED : runTautologyGate(plan);
  const conflict = downstreamSkipped ? SKIPPED : runConflictGate(plan);
  const singleTokenDiff = downstreamSkipped ? SKIPPED : runSingleTokenDiffGate(plan);
  const messageIdCoverage = downstreamSkipped ? SKIPPED : runMessageIdCoverageGate(plan);
  const autofixClean = downstreamSkipped ? SKIPPED : runAutofixCleanGate(plan);
  const requireVacuity = downstreamSkipped ? SKIPPED : runRequireVacuityGate(plan);

  // `degrade` (a gate that could not resolve the plugin registry — U10 option b) is not a
  // failure: the plan is not proven bad, so `ok` stays true. It is not a pass either — the
  // status and the per-rule `degraded` entries travel in the report, and both renderers
  // (to-aif-gate-result.ts → status "warn", diagnostics/to-diagnostics.ts → warnings) surface it.
  const ok =
    schema.status !== 'fail' &&
    ruleTester.status !== 'fail' &&
    tautology.status !== 'fail' &&
    conflict.status !== 'fail' &&
    singleTokenDiff.status !== 'fail' &&
    messageIdCoverage.status !== 'fail' &&
    autofixClean.status !== 'fail' &&
    requireVacuity.status !== 'fail';

  // Read-only visibility of the silent manual-bypass: rules L4 cannot roundtrip
  // (check.type:'manual') are surfaced here WITHOUT affecting `ok`.
  const manualRules = plan.rules.filter((r) => r.check.type === 'manual');

  return {
    ok,
    gates: {
      schema,
      ruleTester,
      tautology,
      conflict,
      singleTokenDiff,
      messageIdCoverage,
      autofixClean,
      requireVacuity,
    },
    manualCount: manualRules.length,
    manualRuleIds: manualRules.map((r) => r.id),
  };
}
