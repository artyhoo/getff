// L4 ValidationReport → Diagnostic[] adapter — D1 (diagnostics-core).
// Spec: docs/superpowers/specs/2026-07-02-diagnostics-core-design.md §3.4
// Plan: docs/superpowers/plans/2026-07-02-diagnostics-core-impl.md Task 4.2
//
// One more renderer over the same GateFailure data the gates already
// produce — does NOT reconstruct a Diagnostic via the registry's diag()
// factory (that would re-interpolate a template from params this adapter
// does not have; each gate already produced the final `message` string as
// `reason`). Instead this walks the report and wraps each GateFailure's
// existing {code, reason, ruleId?} directly into the Diagnostic shape,
// preserving the reason text verbatim as `message` (zero re-derivation,
// zero risk of drifting from what the gate actually said).
//
// ValidationReport stays the installer's public contract (unchanged by
// this file); to-aif-gate-result.ts is a separate, untouched renderer over
// the same ValidationReport (external AIF contract, same class as SARIF —
// out of scope for this adapter per spec §3.4).

import type { GateOutcome, ValidationReport } from '../validator/types.ts';
import type { Diagnostic } from './types.ts';

const GATE_NAMES = [
  'schema',
  'ruleTester',
  'tautology',
  'conflict',
  'singleTokenDiff',
  'messageIdCoverage',
  'autofixClean',
  'requireVacuity',
] as const;

/**
 * One Diagnostic per GateFailure across every gate in the report, in gate
 * declaration order (GATE_NAMES). `path` carries `<gateName>` or, when the
 * failure names a rule, `<gateName>/<ruleId>` — a lightweight JSON-Pointer-
 * style locator into the report, not a file path (gates operate on an
 * in-memory SynthesisPlan, not a file on disk).
 */
export function toDiagnostics(report: ValidationReport): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const gateName of GATE_NAMES) {
    const outcome: GateOutcome = report.gates[gateName];
    for (const failure of outcome.failures) {
      diagnostics.push({
        code: failure.code,
        severity: 'error',
        path: failure.ruleId ? `${gateName}/${failure.ruleId}` : gateName,
        params: failure.ruleId ? { ruleId: failure.ruleId } : {},
        message: failure.reason,
      });
    }
  }
  return diagnostics;
}
