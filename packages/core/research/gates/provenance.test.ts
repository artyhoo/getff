import { describe, expect, it } from 'vitest';
import { runProvenanceGate } from './provenance.ts';

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

describe('runProvenanceGate — paired negative', () => {
  it('rejects a plan with an out-of-allowlist provenance URL with a `fail` outcome carrying an FF2xxx diagnostic', () => {
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
    const outcome = runProvenanceGate(bad);
    expect(outcome.status).toBe('fail');
    expect(outcome.diagnostics.length).toBeGreaterThan(0);
    expect(outcome.diagnostics.every((d) => d.code.startsWith('FF2'))).toBe(true);
  });

  it('accepts a plan with valid provenance with a `pass` outcome and zero diagnostics', () => {
    const outcome = runProvenanceGate(validPlan);
    expect(outcome.status).toBe('pass');
    expect(outcome.diagnostics).toEqual([]);
  });

  it('a plan with no iterable patterns yields a `pass` outcome (nothing to walk)', () => {
    const outcome = runProvenanceGate({ framework: 'next', version: '16.0.0', missing: [], drift: null });
    expect(outcome.status).toBe('pass');
    expect(outcome.diagnostics).toEqual([]);
  });
});
