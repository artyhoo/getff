// Phase 8 Task 8.4 — convert L4 ValidationReport / L5 InstallReport into AIF
// `aif-gate-result` JSON shape. Mapping is purely additive (no breaking change
// to ValidationReport / InstallReport). Closes aif-comparison.md §7 Phase 11.1
// partially in Phase 8. Per phase-8-research.md §4.

import type { InstallReport } from '../installer/types.ts';
import type { GateOutcome, ValidationReport } from './types.ts';

export type AifStatus = 'pass' | 'warn' | 'fail';
export type AifGate = 'verify' | 'review' | 'security' | 'rules';

export interface AifBlocker {
  id: string;
  severity: 'error' | 'warning';
  file: string | null;
  summary: string;
}

export interface AifSuggestedNext {
  command: string;
  reason: string;
}

export interface AifGateResult {
  schema_version: 1;
  gate: AifGate;
  status: AifStatus;
  blocking: boolean;
  blockers: AifBlocker[];
  affected_files: string[];
  suggested_next: AifSuggestedNext;
}

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

function flattenGate(name: string, outcome: GateOutcome): AifBlocker[] {
  const failures: AifBlocker[] = outcome.failures.map((f) => ({
    id: f.ruleId ? `${name}.${f.ruleId}` : `${name}.gate-failure`,
    severity: 'error',
    file: null,
    summary: f.reason,
  }));
  // A degraded gate must not reach AIF looking like a clean pass (U10 option b, 2026-08-17):
  // every skipped check surfaces as a non-blocking warning blocker.
  const degrades: AifBlocker[] = (outcome.degraded ?? []).map((d) => ({
    id: d.ruleId ? `${name}.degrade.${d.ruleId}` : `${name}.gate-degrade`,
    severity: 'warning',
    file: null,
    summary: d.reason,
  }));
  return [...failures, ...degrades];
}

export function fromValidationReport(
  report: ValidationReport,
  opts?: { affectedFiles?: string[] },
): AifGateResult {
  const blockers = GATE_NAMES.flatMap((n) => flattenGate(n, report.gates[n]));
  const degraded = GATE_NAMES.some(
    (n) => report.gates[n].status === 'degrade',
  );
  const status: AifStatus = report.ok ? (degraded ? 'warn' : 'pass') : 'fail';
  return {
    schema_version: 1,
    gate: 'rules',
    status,
    blocking: !report.ok,
    blockers,
    affected_files: opts?.affectedFiles ?? [],
    suggested_next: report.ok
      ? {
          command: '/aif-commit',
          reason: degraded
            ? 'rules gates pass, but some checks were skipped (plugin registry unresolved)'
            : 'all rules gates pass',
        }
      : { command: '/aif-fix', reason: `${blockers.length} blocker(s) require resolution` },
  };
}

export function fromInstallReport(report: InstallReport): AifGateResult {
  // postValidation runs against artifacts on disk; preferred over preValidation.
  const validation = report.postValidation ?? report.preValidation;
  return fromValidationReport(validation, { affectedFiles: report.artifacts });
}
