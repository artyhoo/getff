// IR grammar gate — paired negatives (MT umbrella S1).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §3.
// RED-first: run against gates/grammar.ts's stub (always-pass no-op) BEFORE implementation —
// N1-N7 must fail red; P1-P3 (controls) pass either way, proving they discriminate.

import { describe, expect, it } from 'vitest';
import { runGrammarGate } from './grammar.ts';

// A minimal, otherwise-valid node — mutate one field per case.
function validNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'n1',
    claim: 'no barrel files in packages/core',
    anchors: [],
    selectorClass: 'syntax',
    params: {},
    defaultSeverity: 'error',
    provenance: [],
    pairedExamples: { positive: 'export const x = 1;', negative: 'export * from "./x";' },
    ...overrides,
  };
}

describe('runGrammarGate — paired negatives (ajv shape, FF1001)', () => {
  it('N1: node without pairedExamples fails with FF1001', () => {
    const node = validNode();
    delete (node as { pairedExamples?: unknown }).pairedExamples;
    const outcome = runGrammarGate([node]);
    expect(outcome.status).toBe('fail');
    expect(outcome.diagnostics.some((d) => d.code === 'FF1001')).toBe(true);
  });

  it('N2: selectorClass "doc-level" (descoped v0) fails with FF1001', () => {
    const node = validNode({ selectorClass: 'doc-level' });
    const outcome = runGrammarGate([node]);
    expect(outcome.status).toBe('fail');
    expect(outcome.diagnostics.some((d) => d.code === 'FF1001')).toBe(true);
  });

  it('N3: extra field capabilityTier fails with FF1001 (additionalProperties)', () => {
    const node = validNode({ capabilityTier: 1 });
    const outcome = runGrammarGate([node]);
    expect(outcome.status).toBe('fail');
    expect(outcome.diagnostics.some((d) => d.code === 'FF1001')).toBe(true);
  });

  it('N4: anchors ["R2"] (wrong namespace) fails with FF1001 (pattern)', () => {
    const node = validNode({ anchors: ['R2'] });
    const outcome = runGrammarGate([node]);
    expect(outcome.status).toBe('fail');
    expect(outcome.diagnostics.some((d) => d.code === 'FF1001')).toBe(true);
  });
});

describe('runGrammarGate — paired negatives (IR semantic checks, FF6xxx)', () => {
  it('N5: pairedExamples.positive === negative fails with FF6001', () => {
    const node = validNode({ pairedExamples: { positive: 'same', negative: 'same' } });
    const outcome = runGrammarGate([node]);
    expect(outcome.status).toBe('fail');
    expect(outcome.diagnostics.some((d) => d.code === 'FF6001' && d.params['nodeId'] === 'n1')).toBe(
      true,
    );
  });

  it('N6: two nodes sharing id "dup" fail with FF6002', () => {
    const a = validNode({ id: 'dup' });
    const b = validNode({ id: 'dup' });
    const outcome = runGrammarGate([a, b]);
    expect(outcome.status).toBe('fail');
    expect(
      outcome.diagnostics.some((d) => d.code === 'FF6002' && d.params['id'] === 'dup'),
    ).toBe(true);
  });

  it('N7: anchors ["FF9999"] (dangling — not a REGISTRY code) fails with FF6003', () => {
    const node = validNode({ anchors: ['FF9999'] });
    const outcome = runGrammarGate([node]);
    expect(outcome.status).toBe('fail');
    expect(
      outcome.diagnostics.some((d) => d.code === 'FF6003' && d.params['anchor'] === 'FF9999'),
    ).toBe(true);
  });
});

describe('runGrammarGate — green controls', () => {
  it('P1: a fully valid node passes with zero diagnostics', () => {
    const outcome = runGrammarGate([validNode()]);
    expect(outcome.status).toBe('pass');
    expect(outcome.diagnostics).toEqual([]);
  });

  it('P2: two nodes with different ids pass (control for FF6002 always-red)', () => {
    const a = validNode({ id: 'n1' });
    const b = validNode({ id: 'n2' });
    const outcome = runGrammarGate([a, b]);
    expect(outcome.status).toBe('pass');
    expect(outcome.diagnostics).toEqual([]);
  });

  it('P3: anchors ["FF1001"] (a code that exists) passes (control for FF6003 always-red)', () => {
    const node = validNode({ anchors: ['FF1001'] });
    const outcome = runGrammarGate([node]);
    expect(outcome.status).toBe('pass');
    expect(outcome.diagnostics).toEqual([]);
  });
});

describe('runGrammarGate — accumulation (no short-circuit)', () => {
  it('a node with two independent semantic violations reports both codes', () => {
    const node = validNode({
      anchors: ['FF9999'],
      pairedExamples: { positive: 'same', negative: 'same' },
    });
    const outcome = runGrammarGate([node]);
    expect(outcome.status).toBe('fail');
    const codes = outcome.diagnostics.map((d) => d.code);
    expect(codes).toContain('FF6001');
    expect(codes).toContain('FF6003');
  });
});

// --- OWNER-FORK-1 Option B (ir-unfreeze S1): relational tree grammar ---
// The relational field is additive-opt-in. A malformed relational SHAPE is caught by ajv (FF1001,
// via the recursive RelationalRule $ref); the residual cross-child-equality degeneracy — which ajv
// cannot express — is the new FF6004. Legacy scalar nodes carry no relational field and stay valid.
describe('runGrammarGate — relational tree (Option B, FF6004 degeneracy + FF1001 shape)', () => {
  it('N8: composite `all` with two byte-identical children fails with FF6004', () => {
    const node = validNode({
      relational: {
        op: 'all',
        children: [
          { op: 'has', pattern: 'yaml.load($$$A)' },
          { op: 'has', pattern: 'yaml.load($$$A)' },
        ],
      },
    });
    const outcome = runGrammarGate([node]);
    expect(outcome.status).toBe('fail');
    expect(
      outcome.diagnostics.some(
        (d) => d.code === 'FF6004' && d.params['op'] === 'all' && d.params['nodeId'] === 'n1',
      ),
    ).toBe(true);
  });

  it('N8b: FF6004 fires on a NESTED degenerate composite (the walk recurses)', () => {
    const node = validNode({
      relational: {
        op: 'not',
        children: [
          {
            op: 'any',
            children: [
              { op: 'has', pattern: 'dup' },
              { op: 'has', pattern: 'dup' },
            ],
          },
        ],
      },
    });
    const outcome = runGrammarGate([node]);
    expect(outcome.status).toBe('fail');
    expect(outcome.diagnostics.some((d) => d.code === 'FF6004' && d.params['op'] === 'any')).toBe(true);
  });

  it('N9: malformed relational SHAPE (`has` missing pattern) fails with FF1001 (ajv deep-validate)', () => {
    const node = validNode({ relational: { op: 'has', kind: 'call' } });
    const outcome = runGrammarGate([node]);
    expect(outcome.status).toBe('fail');
    expect(outcome.diagnostics.some((d) => d.code === 'FF1001')).toBe(true);
  });

  it('N9b: unknown relational op fails with FF1001 (oneOf zero-match)', () => {
    const node = validNode({ relational: { op: 'xor', children: [{ op: 'has', pattern: 'x' }] } });
    const outcome = runGrammarGate([node]);
    expect(outcome.status).toBe('fail');
    expect(outcome.diagnostics.some((d) => d.code === 'FF1001')).toBe(true);
  });

  it('N9c: empty children array fails with FF1001 (minItems 1)', () => {
    const node = validNode({ relational: { op: 'all', children: [] } });
    const outcome = runGrammarGate([node]);
    expect(outcome.status).toBe('fail');
    expect(outcome.diagnostics.some((d) => d.code === 'FF1001')).toBe(true);
  });

  it('P4: a well-formed require-via-ban tree (not:[has]) passes with zero diagnostics', () => {
    const node = validNode({
      relational: {
        op: 'not',
        children: [{ op: 'has', kind: 'function_definition', pattern: 'return $A' }],
      },
    });
    const outcome = runGrammarGate([node]);
    expect(outcome.status).toBe('pass');
    expect(outcome.diagnostics).toEqual([]);
  });

  it('P4b: a composite with DISTINCT children passes (control for FF6004 always-red)', () => {
    const node = validNode({
      relational: {
        op: 'all',
        children: [
          { op: 'has', pattern: 'A' },
          { op: 'has', pattern: 'B' },
        ],
      },
    });
    const outcome = runGrammarGate([node]);
    expect(outcome.status).toBe('pass');
    expect(outcome.diagnostics).toEqual([]);
  });

  it('P5: a LEGACY scalar node (no relational field) still passes — additive-opt-in', () => {
    const node = validNode();
    expect('relational' in node).toBe(false);
    const outcome = runGrammarGate([node]);
    expect(outcome.status).toBe('pass');
    expect(outcome.diagnostics).toEqual([]);
  });
});
