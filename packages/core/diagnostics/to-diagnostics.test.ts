// to-diagnostics.ts tests — D1 Task 4.2.
// Plan: docs/superpowers/plans/2026-07-02-diagnostics-core-impl.md Task 4.2

import { describe, expect, it } from 'vitest';
import type { ValidationReport } from '../validator/types.ts';
import { toDiagnostics } from './to-diagnostics.ts';

const PASS = { status: 'pass' as const, failures: [] };
const NA = { status: 'n/a' as const, failures: [] };

function baseReport(overrides: Partial<ValidationReport['gates']>): ValidationReport {
  return {
    ok: false,
    gates: {
      schema: PASS,
      ruleTester: PASS,
      tautology: PASS,
      conflict: PASS,
      singleTokenDiff: NA,
      messageIdCoverage: NA,
      autofixClean: NA,
      requireVacuity: NA,
      ...overrides,
    },
    manualCount: 0,
    manualRuleIds: [],
  };
}

describe('toDiagnostics', () => {
  it('returns [] for an all-pass/n-a report', () => {
    const report = baseReport({});
    expect(toDiagnostics(report)).toEqual([]);
  });

  it('emits one Diagnostic per GateFailure, code carried through verbatim', () => {
    const report = baseReport({
      autofixClean: {
        status: 'fail',
        failures: [
          {
            ruleId: 'G87',
            code: 'FF3017',
            reason:
              "autofix-clean: fixer for 'no-extra-parens' left 1 violation(s) in fixed output — fix is incomplete or introduces new same-rule violations",
          },
        ],
      },
    });
    const diags = toDiagnostics(report);
    expect(diags).toHaveLength(1);
    expect(diags[0]).toEqual({
      code: 'FF3017',
      severity: 'error',
      path: 'autofixClean/G87',
      params: { ruleId: 'G87' },
      message:
        "autofix-clean: fixer for 'no-extra-parens' left 1 violation(s) in fixed output — fix is incomplete or introduces new same-rule violations",
    });
  });

  it('omits ruleId from path/params when the GateFailure has none', () => {
    const report = baseReport({
      schema: {
        status: 'fail',
        failures: [{ code: 'FF3001', reason: 'SynthesisPlan schema violation: bad' }],
      },
    });
    const diags = toDiagnostics(report);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.path).toBe('schema');
    expect(diags[0]!.params).toEqual({});
  });

  it('walks multiple failing gates in GATE_NAMES order', () => {
    const report = baseReport({
      schema: PASS,
      ruleTester: {
        status: 'fail',
        failures: [{ ruleId: 'G1', code: 'FF3004', reason: 'no negative-test' }],
      },
      conflict: {
        status: 'fail',
        failures: [{ ruleId: 'G2', code: 'FF3009', reason: 'no snippet entry' }],
      },
    });
    const diags = toDiagnostics(report);
    expect(diags.map((d) => d.code)).toEqual(['FF3004', 'FF3009']);
  });

  it('emits multiple diagnostics for a single gate with multiple failures', () => {
    const report = baseReport({
      schema: {
        status: 'fail',
        failures: [
          { ruleId: 'G1', code: 'FF3002', reason: 'no negative-test 1' },
          { ruleId: 'G2', code: 'FF3002', reason: 'no negative-test 2' },
        ],
      },
    });
    const diags = toDiagnostics(report);
    expect(diags).toHaveLength(2);
    expect(diags.map((d) => d.path)).toEqual(['schema/G1', 'schema/G2']);
  });
});
