import { describe, expect, it } from 'vitest';
import { runResearchValidation } from './report.ts';

const validProvenance = {
  url: 'https://nextjs.org/docs/app',
  allowlistKey: 'next.official',
  fetchedAt: '2026-05-08',
};

const validEntry = {
  id: 'nextjs-app-router',
  summary: 'App Router patterns',
  bestPractices: [],
  antiPatterns: [],
  provenance: [validProvenance],
};

const validPlan = {
  framework: 'next',
  version: '16.0.0',
  patterns: [validEntry],
  missing: [],
  drift: null,
};

describe('runResearchValidation — short-circuit paired negative (DN-B-4)', () => {
  it('a plan whose top-level shape is un-iterable (patterns not an array) yields provenance:skip, not pass, not a crash', () => {
    // patterns is a STRING, not an array -- hard top-level un-iterable shape.
    const hardInvalid = { framework: 'next', version: '16.0.0', patterns: 'nope', missing: [], drift: null };
    const report = runResearchValidation(hardInvalid);
    expect(report.ok).toBe(false);
    expect(report.gates.shape.status).toBe('fail');
    expect(report.gates.provenance.status).toBe('skip');
    expect(report.gates.provenance.diagnostics).toEqual([]);
  });

  it('a shape-valid-but-provenance-invalid plan yields shape:pass, provenance:fail', () => {
    const bad = {
      ...validPlan,
      patterns: [
        {
          ...validEntry,
          provenance: [
            {
              url: 'https://example.evil/fake-docs',
              allowlistKey: 'next.official',
              fetchedAt: '2026-05-08',
            },
          ],
        },
      ],
    };
    const report = runResearchValidation(bad);
    expect(report.ok).toBe(false);
    expect(report.gates.shape.status).toBe('pass');
    expect(report.gates.provenance.status).toBe('fail');
  });

  it('a shape-invalid-but-still-iterable plan (patterns IS an array) still runs provenance on shape-valid entries (DN-B-4 Option B)', () => {
    // Mirrors validate-plan.test.ts's planWithTwoIndependentViolations fixture:
    // patterns is a genuine array; entry 0 is shape-invalid (missing summary),
    // entry 1 is shape-valid but provenance-invalid. Both must surface.
    const planWithTwoIndependentViolations = {
      framework: 'next',
      version: '16.0.0',
      patterns: [
        {
          id: 'bad-shape-entry',
          bestPractices: [],
          antiPatterns: [],
          provenance: [
            { url: 'https://nextjs.org/docs', allowlistKey: 'next.official', fetchedAt: '2026-05-08' },
          ],
        },
        {
          id: 'bad-provenance-entry',
          summary: 'ok',
          bestPractices: [],
          antiPatterns: [],
          provenance: [
            { url: 'https://example.evil/fake', allowlistKey: 'next.official', fetchedAt: '2026-05-08' },
          ],
        },
      ],
      missing: [],
      drift: null,
    };
    const report = runResearchValidation(planWithTwoIndependentViolations);
    expect(report.ok).toBe(false);
    expect(report.gates.shape.status).toBe('fail');
    expect(report.gates.provenance.status).toBe('fail');
    expect(report.gates.shape.diagnostics.some((d) => d.code === 'FF1001')).toBe(true);
    expect(report.gates.provenance.diagnostics.some((d) => d.code.startsWith('FF2'))).toBe(true);
  });

  it('positive control: a valid plan yields ok:true, both gates pass', () => {
    const report = runResearchValidation(validPlan);
    expect(report.ok).toBe(true);
    expect(report.gates.shape.status).toBe('pass');
    expect(report.gates.provenance.status).toBe('pass');
  });
});
