import { describe, expect, it } from 'vitest';
import type { InstallReport } from '../installer/types.ts';
import { validateAifGateResult } from './aif-gate-result-schema.ts';
import { fromInstallReport, fromValidationReport } from './to-aif-gate-result.ts';
import type { ValidationReport } from './types.ts';

const PASS_REPORT: ValidationReport = {
  ok: true,
  gates: {
    schema: { status: 'pass', failures: [] },
    ruleTester: { status: 'pass', failures: [] },
    tautology: { status: 'pass', failures: [] },
    conflict: { status: 'pass', failures: [] },
    singleTokenDiff: { status: 'n/a', failures: [] },
    messageIdCoverage: { status: 'n/a', failures: [] },
    autofixClean: { status: 'n/a', failures: [] },
    requireVacuity: { status: 'n/a', failures: [] },
  },
  manualCount: 0,
  manualRuleIds: [],
};

const FAIL_REPORT: ValidationReport = {
  ok: false,
  gates: {
    schema: { status: 'pass', failures: [] },
    ruleTester: {
      status: 'fail',
      failures: [
        { ruleId: 'G2', code: 'FF3005', reason: 'negative-test did not produce expected violation' },
      ],
    },
    tautology: { status: 'pass', failures: [] },
    conflict: {
      status: 'fail',
      failures: [{ code: 'FF3008', reason: 'orphan plugin reference' }],
    },
    singleTokenDiff: { status: 'n/a', failures: [] },
    messageIdCoverage: { status: 'n/a', failures: [] },
    autofixClean: { status: 'n/a', failures: [] },
    requireVacuity: { status: 'n/a', failures: [] },
  },
  manualCount: 0,
  manualRuleIds: [],
};

describe('fromValidationReport', () => {
  it('passing report → status pass, blocking false, no blockers, /aif-commit suggested', () => {
    const r = fromValidationReport(PASS_REPORT);
    expect(r.schema_version).toBe(1);
    expect(r.gate).toBe('rules');
    expect(r.status).toBe('pass');
    expect(r.blocking).toBe(false);
    expect(r.blockers).toEqual([]);
    expect(r.affected_files).toEqual([]);
    expect(r.suggested_next.command).toBe('/aif-commit');
  });

  it('failing report → status fail, blocking true, blockers flatten gate failures, /aif-fix', () => {
    const r = fromValidationReport(FAIL_REPORT);
    expect(r.status).toBe('fail');
    expect(r.blocking).toBe(true);
    expect(r.blockers).toHaveLength(2);
    expect(r.blockers[0]).toMatchObject({
      id: 'ruleTester.G2',
      severity: 'error',
      file: null,
    });
    expect(r.blockers[1].id).toBe('conflict.gate-failure'); // no ruleId → fallback id
    expect(r.suggested_next.command).toBe('/aif-fix');
    expect(r.suggested_next.reason).toContain('2 blocker');
  });

  it('opts.affectedFiles propagates into affected_files', () => {
    const r = fromValidationReport(PASS_REPORT, {
      affectedFiles: ['.ai-factory/synthesizer-output/RULES.md'],
    });
    expect(r.affected_files).toEqual(['.ai-factory/synthesizer-output/RULES.md']);
  });
});

describe('fromInstallReport', () => {
  it('install with green postValidation → status pass, artifacts as affected_files', () => {
    const installReport: InstallReport = {
      ok: true,
      installed: true,
      artifacts: ['/tmp/x/.ai-factory/synthesizer-output/rules-lock.json',
                  '/tmp/x/.ai-factory/synthesizer-output/RULES.md'],
      preValidation: PASS_REPORT,
      postValidation: PASS_REPORT,
      failures: [],
    };
    const r = fromInstallReport(installReport);
    expect(r.status).toBe('pass');
    expect(r.affected_files).toHaveLength(2);
    expect(r.suggested_next.command).toBe('/aif-commit');
  });

  it('install with no postValidation falls back to preValidation', () => {
    const installReport: InstallReport = {
      ok: false,
      installed: false,
      artifacts: [],
      preValidation: FAIL_REPORT,
      failures: [{ stage: 'pre-validate', reason: 'gate failure' }],
    };
    const r = fromInstallReport(installReport);
    expect(r.status).toBe('fail');
    expect(r.blockers).toHaveLength(2);
    expect(r.suggested_next.command).toBe('/aif-fix');
  });
});

describe('A9: emit-path validation via validateAifGateResult', () => {
  it('A9: fromValidationReport output passes validateAifGateResult', () => {
    const result = fromValidationReport(PASS_REPORT);
    const validation = validateAifGateResult(result);
    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it('A9: fromInstallReport output passes validateAifGateResult', () => {
    const installReport: InstallReport = {
      ok: true,
      installed: true,
      artifacts: ['/tmp/x/.ai-factory/synthesizer-output/rules-lock.json',
                  '/tmp/x/.ai-factory/synthesizer-output/RULES.md'],
      preValidation: PASS_REPORT,
      postValidation: PASS_REPORT,
      failures: [],
    };
    const result = fromInstallReport(installReport);
    const validation = validateAifGateResult(result);
    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it('A9: fromValidationReport fail-path output passes validateAifGateResult', () => {
    const result = fromValidationReport(FAIL_REPORT);
    const validation = validateAifGateResult(result);
    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it('A9 negative: bad schema_version → validateAifGateResult rejects', () => {
    const result = { ...fromValidationReport(PASS_REPORT), schema_version: 2 };
    const validation = validateAifGateResult(result);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes('schema_version'))).toBe(true);
  });

  it('A9 negative: bad gate value → validateAifGateResult rejects', () => {
    const result = { ...fromValidationReport(PASS_REPORT), gate: 'unknown-gate' };
    const validation = validateAifGateResult(result);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes('gate'))).toBe(true);
  });

  it('A9 negative: missing affected_files → validateAifGateResult rejects', () => {
    const { affected_files: _af, ...result } = fromValidationReport(PASS_REPORT);
    const validation = validateAifGateResult(result);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.includes('affected_files'))).toBe(true);
  });
});
