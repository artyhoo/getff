import { describe, expect, it } from 'vitest';
import {
  ResearchPlanError,
  checkResearchPlan,
  validateResearchPlan,
} from './validate-plan.ts';

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

describe('validateResearchPlan — B2 closure for synthesizer --from-research', () => {
  it('accepts a well-formed plan with a single valid entry', () => {
    expect(() => validateResearchPlan(validPlan)).not.toThrow();
  });

  it('accepts a plan with framework=null (own-repo / ts-server case)', () => {
    expect(() =>
      validateResearchPlan({
        ...validPlan,
        framework: null,
        version: null,
        patterns: [],
      }),
    ).not.toThrow();
  });

  it('rejects a plan missing the required `patterns` field', () => {
    const bad = { framework: 'next', version: '16.0.0', missing: [], drift: null };
    expect(() => validateResearchPlan(bad)).toThrow(ResearchPlanError);
  });

  it('rejects a plan whose entry has malformed provenance shape', () => {
    const bad = {
      ...validPlan,
      patterns: [
        {
          ...validEntry,
          provenance: [{ url: 'https://nextjs.org', allowlistKey: 'next.official' }],
        },
      ],
    };
    expect(() => validateResearchPlan(bad)).toThrow(ResearchPlanError);
  });

  it('rejects a plan whose provenance.url is outside the allowlist (B2 spoof scenario)', () => {
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
    expect(() => validateResearchPlan(bad)).toThrow(ResearchPlanError);
    expect(() => validateResearchPlan(bad)).toThrow(/provenance violation/);
  });

  it('rejects a top-level non-object', () => {
    expect(() => validateResearchPlan(null)).toThrow(ResearchPlanError);
    expect(() => validateResearchPlan('not a plan')).toThrow(ResearchPlanError);
    expect(() => validateResearchPlan(42)).toThrow(ResearchPlanError);
  });

  it('rejects a plan with extra top-level properties (additionalProperties: false)', () => {
    const bad = { ...validPlan, surprise: 'not allowed' };
    expect(() => validateResearchPlan(bad)).toThrow(ResearchPlanError);
  });
});

// --- Task 3.4 / spec AC 2: accumulation paired-negative ---
// Pre-D1, validateResearchPlan threw on the FIRST failure only — a plan with
// 2 independent violations in DIFFERENT entries (1 shape + 1 provenance)
// surfaced only the shape violation; the provenance violation in the second
// entry was invisible. Observed RED before this fix (manual capture, D1
// Task 3 report): validateResearchPlan(plan) threw
// "Invalid ResearchPlan: data/patterns/0 must have required property
// 'summary'" and `err.diagnostics` did not exist at all.
describe('checkResearchPlan — accumulation (AC 2)', () => {
  const planWithTwoIndependentViolations = {
    framework: 'next',
    version: '16.0.0',
    patterns: [
      {
        id: 'bad-shape-entry',
        // summary MISSING -> ajv shape violation (FF1001)
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

  it('accumulates BOTH a shape violation (entry 0) and a provenance violation (entry 1) — not just the first', () => {
    const result = checkResearchPlan(planWithTwoIndependentViolations);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable — narrowed by the assertion above');
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(2);
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes).toContain('FF1001'); // shape: missing 'summary' in entry 0
    expect(codes.some((c) => c.startsWith('FF2'))).toBe(true); // provenance: entry 1's url outside allowlist
  });

  it('validateResearchPlan still throws (throw-adapter over the same accumulation) carrying the same diagnostics array', () => {
    try {
      validateResearchPlan(planWithTwoIndependentViolations);
      throw new Error('expected validateResearchPlan to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ResearchPlanError);
      const err = e as ResearchPlanError;
      expect(err.diagnostics.length).toBeGreaterThanOrEqual(2);
      const codes = err.diagnostics.map((d) => d.code);
      expect(codes).toContain('FF1001');
      expect(codes.some((c) => c.startsWith('FF2'))).toBe(true);
    }
  });

  it('positive control: a valid plan yields {ok:true, diagnostics:[]}', () => {
    const result = checkResearchPlan(validPlan);
    expect(result).toMatchObject({ ok: true, diagnostics: [] });
  });
});
