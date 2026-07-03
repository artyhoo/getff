import { describe, expect, it } from 'vitest';
import { runShapeGate } from './shape.ts';

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

describe('runShapeGate — paired negative', () => {
  it('rejects a shape-invalid plan with a `fail` outcome carrying an FF1001 diagnostic', () => {
    const bad = { framework: 'next', version: '16.0.0', missing: [], drift: null }; // patterns missing
    const outcome = runShapeGate(bad);
    expect(outcome.status).toBe('fail');
    expect(outcome.diagnostics.length).toBeGreaterThan(0);
    expect(outcome.diagnostics.every((d) => d.code === 'FF1001')).toBe(true);
  });

  it('accepts a shape-valid plan with a `pass` outcome and zero diagnostics', () => {
    const outcome = runShapeGate(validPlan);
    expect(outcome.status).toBe('pass');
    expect(outcome.diagnostics).toEqual([]);
  });
});
