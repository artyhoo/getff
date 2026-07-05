// Composition gate — paired negatives (MT umbrella S4, Surface 3).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.1.
//
// RED-first: each Nx case exercises a BROKEN input and asserts the specific FF code fires.
// Run against the gate's initial stub (before the semantic checks existed) to observe RED, then
// GREEN once runCompositionGate implements the check. Pnn cases are positive controls (a clean
// plan yields zero diagnostics) — they prove the negatives discriminate.
//
// Case → code map (from the S4 contract):
//   N1  nodeIds:['ghost-1']                         → FF8001 (dangling section ref)
//   N3  ✅ but matrix has no live-fired evidence      → FF8004
//   N4  ✅ but outcome refused (matrix says fired)    → FF8003 (contradiction)
//   N5  dup node.id                                  → FF6002 (reuse — grammar gate)
//   N6  node anchor 'FF9999'                          → FF6003 (reuse — grammar gate)
//   N7  malformed DocPlan (nodeIds:"x")              → FF1001 (ajv)
//   N8  backend segment w/ no outcome in Map         → FF8003
//   N9  scoped node in NO section, NOT excluded      → FF8002
//   N9b excluded reason < 20 chars                   → FF8002
//   N9c dangling excluded id                         → FF8001
//   N9d node in section AND excluded                 → FF8003
//   P1  valid plan                                   → 0 diagnostics
//   P4  node outside sections but excluded w/ reason ≥20 → 0 diagnostics

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RenderOutcome } from '../../backends/shared/render-outcome.ts';
import { runGrammarGate } from '../../ir/gates/grammar.ts';
import type { ConventionNode } from '../../ir/types.ts';
import { compose } from '../compose.ts';
import {
  CARGO_BACKEND,
  NPM_BACKEND,
  byBackend,
  cargoMatrix,
  matricesByBackend,
  npmMatrix,
  processEnvNode,
} from '../test-fixtures.ts';
import type { DocPlan } from '../types.ts';
import { runCompositionGate } from './composition-gate.ts';

const RENDERED: RenderOutcome = { kind: 'rendered', surfaces: [{ surface: 'rule', content: 'x' }] };
const REFUSED: RenderOutcome = { kind: 'refused', code: 'FF7001', note: 'not expressible' };

const NODE = processEnvNode();

// A fully-clean setup: node placed in a section, npm renders+fires, cargo refuses (honest —).
function cleanInput(overrides: { plan?: unknown; nodes?: ConventionNode[] } = {}) {
  const plan: DocPlan = {
    sections: [{ sectionId: 'configuration', title: 'Configuration', nodeIds: [NODE.id] }],
  };
  return {
    plan: overrides.plan ?? plan,
    nodes: overrides.nodes ?? [NODE],
    outcomesByBackend: byBackend([
      [NPM_BACKEND, [[NODE.id, RENDERED]]],
      [CARGO_BACKEND, [[NODE.id, REFUSED]]],
    ]),
    matricesByBackend: matricesByBackend([
      [NPM_BACKEND, npmMatrix()],
      [CARGO_BACKEND, cargoMatrix()],
    ]),
  };
}

function codes(diagnostics: { code: string }[]): string[] {
  return diagnostics.map((d) => d.code);
}

describe('runCompositionGate — paired negatives', () => {
  it('N1: a section nodeId with no matching node → FF8001', () => {
    const input = cleanInput({
      plan: { sections: [{ sectionId: 'configuration', title: 'C', nodeIds: ['ghost-1'] }] },
    });
    const out = runCompositionGate(input);
    expect(out.status).toBe('fail');
    expect(codes(out.diagnostics)).toContain('FF8001');
  });

  it('N3: matrix incoherence (status:no + evidence.kind:live-fired) → FF8004 (DN-4)', () => {
    // DN-4 spec: FF8004 fires ONLY on actual matrix incoherence — a cell claiming status:'no'
    // (rule does not apply) while simultaneously carrying evidence.kind:'live-fired' (was fired).
    // NOTE: rendered-but-no-firing-evidence (🟡) is a spec-legal state per §5.1 — NOT FF8004.
    const incoherentMatrix = {
      backend: CARGO_BACKEND,
      contract: 'firing-contract.json',
      cells: {
        syntax: {
          status: 'no' as const,
          refusedCode: 'FF7001',
          evidence: { kind: 'live-fired', date: '2026-07-04', toolchain: 'rustc 1.96.1' },
        },
      },
    };
    const input = {
      plan: { sections: [{ sectionId: 's', title: 'S', nodeIds: [NODE.id] }] },
      nodes: [NODE],
      outcomesByBackend: byBackend([[CARGO_BACKEND, [[NODE.id, RENDERED]]]]),
      matricesByBackend: matricesByBackend([[CARGO_BACKEND, incoherentMatrix]]),
    };
    const out = runCompositionGate(input);
    expect(out.status).toBe('fail');
    expect(codes(out.diagnostics)).toContain('FF8004');
  });

  it('N4: outcome refused but the matrix claims live-fired for this backend → FF8003', () => {
    // npm refuses the node, yet npm's syntax cell is 'yes' + live-fired → contradiction.
    const input = {
      plan: { sections: [{ sectionId: 's', title: 'S', nodeIds: [NODE.id] }] },
      nodes: [NODE],
      outcomesByBackend: byBackend([[NPM_BACKEND, [[NODE.id, REFUSED]]]]),
      matricesByBackend: matricesByBackend([[NPM_BACKEND, npmMatrix()]]),
    };
    const out = runCompositionGate(input);
    expect(out.status).toBe('fail');
    expect(codes(out.diagnostics)).toContain('FF8003');
  });

  it('N5: a duplicate node id is caught by the grammar gate → FF6002 (reuse)', () => {
    const dup = runGrammarGate([processEnvNode(), processEnvNode()]);
    expect(dup.status).toBe('fail');
    expect(codes(dup.diagnostics)).toContain('FF6002');
  });

  it('N6: a node anchor FF9999 is caught by the grammar gate → FF6003 (reuse)', () => {
    const bad = runGrammarGate([processEnvNode({ anchors: ['FF9999'] })]);
    expect(bad.status).toBe('fail');
    expect(codes(bad.diagnostics)).toContain('FF6003');
  });

  it('N7: a malformed DocPlan (nodeIds:"x") → FF1001 (ajv)', () => {
    const input = cleanInput({
      plan: { sections: [{ sectionId: 'configuration', title: 'C', nodeIds: 'x' }] },
    });
    const out = runCompositionGate(input);
    expect(out.status).toBe('fail');
    expect(codes(out.diagnostics)).toContain('FF1001');
  });

  it('N8: a backend with no RenderOutcome for a placed node → FF8003', () => {
    const input = {
      plan: { sections: [{ sectionId: 's', title: 'S', nodeIds: [NODE.id] }] },
      nodes: [NODE],
      // npm has an outcome; cargo's inner map is EMPTY → silent drop for the placed node.
      outcomesByBackend: byBackend([
        [NPM_BACKEND, [[NODE.id, RENDERED]]],
        [CARGO_BACKEND, []],
      ]),
      matricesByBackend: matricesByBackend([
        [NPM_BACKEND, npmMatrix()],
        [CARGO_BACKEND, cargoMatrix()],
      ]),
    };
    const out = runCompositionGate(input);
    expect(out.status).toBe('fail');
    expect(codes(out.diagnostics)).toContain('FF8003');
  });

  it('N9: a scoped node in NO section and NOT excluded → FF8002', () => {
    const orphan = processEnvNode({ id: 'orphan-node' });
    const input = {
      plan: { sections: [{ sectionId: 's', title: 'S', nodeIds: [NODE.id] }] },
      nodes: [NODE, orphan], // orphan is neither placed nor excluded
      outcomesByBackend: byBackend([[NPM_BACKEND, [[NODE.id, RENDERED]]]]),
      matricesByBackend: matricesByBackend([[NPM_BACKEND, npmMatrix()]]),
    };
    const out = runCompositionGate(input);
    expect(out.status).toBe('fail');
    expect(codes(out.diagnostics)).toContain('FF8002');
  });

  it('N9b: an excluded[] reason under 20 chars → FF8002', () => {
    const orphan = processEnvNode({ id: 'orphan-node' });
    const input = {
      plan: {
        sections: [{ sectionId: 's', title: 'S', nodeIds: [NODE.id] }],
        excluded: [{ nodeId: 'orphan-node', reason: 'too short' }], // < 20 chars
      },
      nodes: [NODE, orphan],
      outcomesByBackend: byBackend([[NPM_BACKEND, [[NODE.id, RENDERED]]]]),
      matricesByBackend: matricesByBackend([[NPM_BACKEND, npmMatrix()]]),
    };
    const out = runCompositionGate(input);
    expect(out.status).toBe('fail');
    expect(codes(out.diagnostics)).toContain('FF8002');
  });

  it('N9c: a dangling excluded[] id (no matching node) → FF8001', () => {
    const input = {
      plan: {
        sections: [{ sectionId: 's', title: 'S', nodeIds: [NODE.id] }],
        excluded: [{ nodeId: 'ghost-excluded', reason: 'this reason is definitely long enough' }],
      },
      nodes: [NODE],
      outcomesByBackend: byBackend([[NPM_BACKEND, [[NODE.id, RENDERED]]]]),
      matricesByBackend: matricesByBackend([[NPM_BACKEND, npmMatrix()]]),
    };
    const out = runCompositionGate(input);
    expect(out.status).toBe('fail');
    expect(codes(out.diagnostics)).toContain('FF8001');
  });

  it('N9d: a node in BOTH a section and excluded[] → FF8003', () => {
    const input = {
      plan: {
        sections: [{ sectionId: 's', title: 'S', nodeIds: [NODE.id] }],
        excluded: [{ nodeId: NODE.id, reason: 'this reason is definitely long enough' }],
      },
      nodes: [NODE],
      outcomesByBackend: byBackend([[NPM_BACKEND, [[NODE.id, RENDERED]]]]),
      matricesByBackend: matricesByBackend([[NPM_BACKEND, npmMatrix()]]),
    };
    const out = runCompositionGate(input);
    expect(out.status).toBe('fail');
    expect(codes(out.diagnostics)).toContain('FF8003');
  });

  it('P1: a fully-valid plan yields ZERO diagnostics', () => {
    const out = runCompositionGate(cleanInput());
    expect(out.status).toBe('pass');
    expect(out.diagnostics).toHaveLength(0);
  });

  it('P4: a node outside all sections but excluded[] with reason ≥20 → ZERO diagnostics', () => {
    const orphan = processEnvNode({ id: 'orphan-node' });
    const input = {
      plan: {
        sections: [{ sectionId: 's', title: 'S', nodeIds: [NODE.id] }],
        excluded: [
          { nodeId: 'orphan-node', reason: 'intentionally left out of the root doc for now' },
        ],
      },
      nodes: [NODE, orphan],
      outcomesByBackend: byBackend([[NPM_BACKEND, [[NODE.id, RENDERED]]]]),
      matricesByBackend: matricesByBackend([[NPM_BACKEND, npmMatrix()]]),
    };
    const out = runCompositionGate(input);
    expect(out.status).toBe('pass');
    expect(out.diagnostics).toHaveLength(0);
  });
});

// --- N-S0: DN-4 paired negatives — FF8004 narrowed to matrix incoherence only -----------
// DN-4 fix: FF8004 fires ONLY when matrix cell has status:'no' AND evidence.kind:'live-fired'
// (the matrix is internally incoherent: it claims the rule does NOT apply while also claiming
// it was live-fired). The spec-legal 🟡 case (rendered but no firing evidence) is NOT FF8004.
//
// RED-first evidence:
//   N-S0-a: BEFORE fix, old code fires FF8004 on rendered+live-fired (wrong — this is a
//            matrix-incoherence case that should fire; but old code fires it for the WRONG reason).
//   N-S0-b: BEFORE fix (old code), rendered+no-firing-evidence → FF8004 (WRONG — this is
//            spec-legal 🟡). AFTER fix → gate silent (correct: 🟡 is not FF8004).
describe('DN-4 — FF8004 narrowed to matrix incoherence only (N-S0-a, N-S0-b)', () => {
  it('N-S0-a: matrix incoherence (status:no + evidence.kind:live-fired) → FF8004 fires', () => {
    // An anomalous matrix: the cell has status:'no' (claims rule does not apply) but ALSO
    // carries evidence.kind:'live-fired' (claims it was actually fired). This internal
    // contradiction is the matrix-incoherence case that DN-4 targets.
    const incoherentMatrix = {
      backend: CARGO_BACKEND,
      contract: 'firing-contract.json',
      cells: {
        syntax: {
          status: 'no' as const,
          refusedCode: 'FF7001',
          evidence: { kind: 'live-fired', date: '2026-07-04', toolchain: 'rustc 1.96.1' },
        },
      },
    };
    const input = {
      plan: { sections: [{ sectionId: 's', title: 'S', nodeIds: [NODE.id] }] },
      nodes: [NODE],
      outcomesByBackend: byBackend([[CARGO_BACKEND, [[NODE.id, RENDERED]]]]),
      matricesByBackend: matricesByBackend([[CARGO_BACKEND, incoherentMatrix]]),
    };
    const out = runCompositionGate(input);
    // FF8004 must fire: matrix has live-fired evidence on a status:'no' cell (incoherent).
    expect(out.status).toBe('fail');
    expect(codes(out.diagnostics)).toContain('FF8004');
  });

  it('N-S0-b: rendered + no live-fired evidence (spec-legal 🟡) → gate is silent, NO FF8004', () => {
    // The cargo matrix's syntax cell is status:'no', no evidence — hasFiringEvidence() returns
    // false. The node is rendered (🟡 case per spec §5.1 truth-table). The gate must NOT emit
    // FF8004: 🟡 is a legitimate honest state, not an asserted-but-unproven ✅.
    // OLD code (before DN-4 fix): rendered && !fired → FF8004 (WRONG).
    // NEW code (after DN-4 fix): only matrix incoherence → FF8004; 🟡 is silent.
    const input = {
      plan: { sections: [{ sectionId: 's', title: 'S', nodeIds: [NODE.id] }] },
      nodes: [NODE],
      outcomesByBackend: byBackend([[CARGO_BACKEND, [[NODE.id, RENDERED]]]]),
      matricesByBackend: matricesByBackend([[CARGO_BACKEND, cargoMatrix()]]),  // syntax cell: status:'no', no evidence
    };
    const out = runCompositionGate(input);
    // Gate must be silent: 🟡 rendered-not-fired is spec-legal, not FF8004.
    expect(out.status).toBe('pass');
    expect(out.diagnostics).toHaveLength(0);
    expect(codes(out.diagnostics)).not.toContain('FF8004');
  });
});

// --- N2: committed-fixture-region byte-diff ratchet -------------------------------------
// A committed fixture markdown carries a real composed region. Re-composing the plan against
// the SAME inputs must reproduce that region byte-for-byte (the CI ratchet the real AGENTS.md
// gets in the conductor's PR-B). N2 hand-flips a status token in the committed region string
// and asserts the byte-diff is observed.
describe('composition — committed fixture region byte-diff ratchet (N2)', () => {
  const fixture = readFileSync(
    new URL('../fixtures/composed-region.md', import.meta.url),
    'utf8',
  ).replace(/\n$/, '');

  function composeClean(): string {
    const c = cleanInput();
    return compose(c.plan as DocPlan, [NODE], c.outcomesByBackend, c.matricesByBackend).get(
      'configuration',
    ) as string;
  }

  it('the committed fixture region re-composes byte-identically from its plan', () => {
    expect(fixture).toBe(composeClean());
  });

  it('N2: hand-flipping the ✅ to a — in the committed region produces a byte-diff', () => {
    const tampered = fixture.replace(`${NPM_BACKEND} ✅`, `${NPM_BACKEND} —`);
    expect(tampered).not.toBe(fixture); // sanity: the flip changed something
    expect(tampered).not.toBe(composeClean());
  });
});
