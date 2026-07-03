// shape gate -- stage B (research-pipeline-as-gates), Task 1.
// Plan: docs/superpowers/plans/2026-07-02-stage-b-impl.md Task 1.
// Spec: docs/superpowers/specs/2026-07-02-diagnostics-core-design.md Sec9.
//
// Wraps validateResearchPlanShape (ajv) + ajvErrorsToDiagnostics (FF1001) --
// the shape half of checkResearchPlan's inline accumulation
// (research/validate-plan.ts, pre-Task-4 lines 66-69), re-expressed as a
// named gate mirroring the L4 aggregator pattern (validator/validate.ts).

import { ajvErrorsToDiagnostics } from '../../diagnostics/ajv.ts';
import { validateResearchPlanShape } from '../internal-validators.ts';
import type { ResearchGateOutcome } from './types.ts';

export function runShapeGate(plan: unknown): ResearchGateOutcome {
  const shapeOk = validateResearchPlanShape(plan);
  if (shapeOk) {
    return { status: 'pass', diagnostics: [] };
  }
  return {
    status: 'fail',
    diagnostics: ajvErrorsToDiagnostics(validateResearchPlanShape.errors),
  };
}
