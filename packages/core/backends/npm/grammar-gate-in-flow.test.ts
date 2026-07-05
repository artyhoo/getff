// N4 — the grammar gate stands IN the flow, not beside it (brief §5 N4, T15).
// A node that is invalid at the IR grammar level (e.g. missing pairedExamples) must be
// rejected by runGrammarGate FF1001 BEFORE it ever reaches the npm adapter. This mirrors
// the producer врезка (PR-2/PR-3): producer builds a node -> runGrammarGate([node]) ->
// (only on pass) adapter. Here we assert the gate is the first stop, and that a caller
// honouring the gate never feeds a malformed node to the adapter.

import { describe, expect, it } from 'vitest';
import { runGrammarGate } from '../../ir/gates/grammar.ts';
import type { ConventionNode } from '../../ir/types.ts';
import { renderNpmDeclarative } from './from-node.ts';

// A structurally-invalid candidate: valid enough to have an id, but MISSING pairedExamples
// (mandatory per ir/types.ts:41 + convention-node.schema.json). ajv -> FF1001.
const INVALID_NODE = {
  id: 'no-paired-examples',
  claim: 'x',
  anchors: [],
  selectorClass: 'syntax',
  params: { selector: "MemberExpression[object.name='process'][property.name='env']", presence: 'forbid' },
  defaultSeverity: 'error',
  provenance: [],
  // pairedExamples: MISSING
} as unknown as ConventionNode;

describe('N4 — grammar gate stands in the flow (FF1001 before the adapter)', () => {
  it('runGrammarGate rejects a node without pairedExamples with FF1001 (ajv shape violation)', () => {
    const outcome = runGrammarGate([INVALID_NODE]);
    expect(outcome.status).toBe('fail');
    expect(outcome.diagnostics.some((d) => d.code === 'FF1001')).toBe(true);
  });

  it('a caller that runs the gate first never reaches the adapter for a gate-failing node', () => {
    // The flow contract: gate first; adapter only on pass. Model it as the producer does.
    const outcome = runGrammarGate([INVALID_NODE]);
    let reachedAdapter = false;
    if (outcome.status === 'pass') {
      reachedAdapter = true;
      renderNpmDeclarative([INVALID_NODE]);
    }
    expect(reachedAdapter).toBe(false);
    // and the diagnostics that surface are the grammar gate's own (FF1001), NOT an adapter
    // FF7xxx — proving the gate, not the backend, is the channel that catches this class.
    expect(outcome.diagnostics.some((d) => d.code.startsWith('FF7'))).toBe(false);
  });

  it('a grammar-valid syntax node passes the gate AND then renders through the adapter', () => {
    const validNode: ConventionNode = {
      id: 'no-direct-process-env',
      claim: 'Read configuration through a typed config module, never process.env directly',
      anchors: [],
      selectorClass: 'syntax',
      params: { selector: "MemberExpression[object.name='process'][property.name='env']", presence: 'forbid' },
      defaultSeverity: 'error',
      provenance: [],
      pairedExamples: {
        negative: 'const url = process.env.DATABASE_URL;',
        positive: 'const url = config.databaseUrl;',
      },
    };
    const gate = runGrammarGate([validNode]);
    expect(gate.status).toBe('pass');
    const { outcomes } = renderNpmDeclarative([validNode]);
    expect(outcomes.get('no-direct-process-env')?.kind).toBe('rendered');
  });
});
