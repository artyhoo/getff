// compose() + enforcement-line — composition plane (MT umbrella S4, Surface 3).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.1.
//
// Covers: the truth-table (rendered✅ / rendered🟡 / degraded⚠️ / refused— / refused-by-all
// aggregate), lexicographic backend ordering, the region render shape, and P1 purity (compose()
// twice → byte-identical). These are positive-control tests (they pass on the real impl); the
// gate paired-negatives live in composition-gate.test.ts.

import { describe, expect, it } from 'vitest';
import type { RenderOutcome } from '../backends/shared/render-outcome.ts';
import { compose } from './compose.ts';
import { computeEnforcementLine } from './enforcement-line.ts';
import {
  CARGO_BACKEND,
  NPM_BACKEND,
  byBackend,
  cargoMatrix,
  matricesByBackend,
  npmMatrix,
  processEnvNode,
} from './test-fixtures.ts';
import type { DocPlan } from './types.ts';

const RENDERED: RenderOutcome = { kind: 'rendered', surfaces: [{ surface: 'rule', content: 'x' }] };
const REFUSED_SYNTAX: RenderOutcome = {
  kind: 'refused',
  code: 'FF7001',
  note: 'not expressible in clippy.toml',
};
const DEGRADED: RenderOutcome = {
  kind: 'degraded',
  code: 'FF7003',
  note: 'clippy.toml carries no severity',
};

const PLAN: DocPlan = {
  sections: [
    { sectionId: 'configuration', title: 'Configuration access', nodeIds: ['no-direct-process-env'] },
  ],
};

describe('computeEnforcementLine — truth table', () => {
  const node = processEnvNode();

  it('rendered + live-fired evidence → `<b> ✅`', () => {
    const line = computeEnforcementLine(
      node,
      [NPM_BACKEND],
      byBackend([[NPM_BACKEND, [[node.id, RENDERED]]]]),
      matricesByBackend([[NPM_BACKEND, npmMatrix()]]),
    );
    expect(line).toBe(`Enforced: ${NPM_BACKEND} ✅`);
  });

  it('rendered, no firing evidence → `<b> 🟡 (rendered, not fired)`', () => {
    // cargo matrix syntax cell is 'no' → no firing evidence for a syntax node.
    const line = computeEnforcementLine(
      node,
      [CARGO_BACKEND],
      byBackend([[CARGO_BACKEND, [[node.id, RENDERED]]]]),
      matricesByBackend([[CARGO_BACKEND, cargoMatrix()]]),
    );
    expect(line).toBe(`Enforced: ${CARGO_BACKEND} 🟡 (rendered, not fired)`);
  });

  it('degraded → `<b> ⚠️ <FF> (<note>)`', () => {
    const line = computeEnforcementLine(
      node,
      [CARGO_BACKEND],
      byBackend([[CARGO_BACKEND, [[node.id, DEGRADED]]]]),
      matricesByBackend([[CARGO_BACKEND, cargoMatrix()]]),
    );
    expect(line).toBe(`Enforced: ${CARGO_BACKEND} ⚠️ FF7003 (clippy.toml carries no severity)`);
  });

  it('refused (not by all) → `<b> — <FF> (<note>)`', () => {
    const line = computeEnforcementLine(
      node,
      [NPM_BACKEND, CARGO_BACKEND],
      byBackend([
        [NPM_BACKEND, [[node.id, RENDERED]]],
        [CARGO_BACKEND, [[node.id, REFUSED_SYNTAX]]],
      ]),
      matricesByBackend([
        [NPM_BACKEND, npmMatrix()],
        [CARGO_BACKEND, cargoMatrix()],
      ]),
    );
    // Lexicographic: cargo-clippy-toml before npm-eslint-declarative.
    expect(line).toBe(
      `Enforced: ${CARGO_BACKEND} — FF7001 (not expressible in clippy.toml) · ${NPM_BACKEND} ✅`,
    );
  });

  it('refused by ALL backends → collapsed honest aggregate line', () => {
    const line = computeEnforcementLine(
      node,
      [NPM_BACKEND, CARGO_BACKEND],
      byBackend([
        [NPM_BACKEND, [[node.id, REFUSED_SYNTAX]]],
        [CARGO_BACKEND, [[node.id, REFUSED_SYNTAX]]],
      ]),
      matricesByBackend([]),
    );
    expect(line).toBe(
      `Enforced: — not machine-enforced yet (${CARGO_BACKEND}: FF7001 · ${NPM_BACKEND}: FF7001)`,
    );
  });

  it('backends are ordered LEXICOGRAPHICALLY regardless of input order', () => {
    const forward = computeEnforcementLine(
      node,
      [NPM_BACKEND, CARGO_BACKEND],
      byBackend([
        [NPM_BACKEND, [[node.id, RENDERED]]],
        [CARGO_BACKEND, [[node.id, DEGRADED]]],
      ]),
      matricesByBackend([
        [NPM_BACKEND, npmMatrix()],
        [CARGO_BACKEND, cargoMatrix()],
      ]),
    );
    const reversed = computeEnforcementLine(
      node,
      [CARGO_BACKEND, NPM_BACKEND],
      byBackend([
        [CARGO_BACKEND, [[node.id, DEGRADED]]],
        [NPM_BACKEND, [[node.id, RENDERED]]],
      ]),
      matricesByBackend([
        [CARGO_BACKEND, cargoMatrix()],
        [NPM_BACKEND, npmMatrix()],
      ]),
    );
    expect(forward).toBe(reversed);
    expect(forward.indexOf(CARGO_BACKEND)).toBeLessThan(forward.indexOf(NPM_BACKEND));
  });

  it('throws (loud, not silent) when a backend has no RenderOutcome for the node', () => {
    expect(() =>
      computeEnforcementLine(
        node,
        [NPM_BACKEND],
        byBackend([[NPM_BACKEND, []]]),
        matricesByBackend([[NPM_BACKEND, npmMatrix()]]),
      ),
    ).toThrow(/no RenderOutcome/);
  });
});

describe('compose — region render shape', () => {
  const node = processEnvNode();
  const outcomes = byBackend([
    [NPM_BACKEND, [[node.id, RENDERED]]],
    [CARGO_BACKEND, [[node.id, REFUSED_SYNTAX]]],
  ]);
  const matrices = matricesByBackend([
    [NPM_BACKEND, npmMatrix()],
    [CARGO_BACKEND, cargoMatrix()],
  ]);

  it('renders `### title`, claim verbatim, @nodes anchor, and 3 computed blockquotes', () => {
    const region = compose(PLAN, [node], outcomes, matrices).get('configuration');
    expect(region).toBeDefined();
    const r = region as string;
    expect(r).toContain('### Configuration access');
    expect(r).toContain(node.claim);
    expect(r).toContain(`<!-- @nodes: ${node.id} -->`);
    expect(r).toContain(`> Never (fires): ${node.pairedExamples.negative}`);
    expect(r).toContain(`> Always (clean): ${node.pairedExamples.positive}`);
    // Enforced line is COMPUTED (npm ✅, cargo —), not hand-written.
    expect(r).toContain(
      `> Enforced: ${CARGO_BACKEND} — FF7001 (not expressible in clippy.toml) · ${NPM_BACKEND} ✅`,
    );
  });

  it('emits NO `hash=` bytes anywhere in the composed output (T-END-B)', () => {
    const region = compose(PLAN, [node], outcomes, matrices).get('configuration') as string;
    expect(region).not.toContain('hash=');
  });

  it('P1: compose() is PURE — two calls with the same inputs are byte-identical', () => {
    const a = compose(PLAN, [node], outcomes, matrices);
    const b = compose(PLAN, [node], outcomes, matrices);
    expect([...a.entries()]).toEqual([...b.entries()]);
    // Byte-for-byte on the concatenated region text, not just structural equality.
    const cat = (m: Map<string, string>) =>
      [...m.entries()].map(([k, v]) => `${k}\n${v}`).join('\n---\n');
    expect(cat(a)).toBe(cat(b));
  });

  it('P2: a node refused by ALL backends renders `—` honestly (no ✅ fabricated)', () => {
    const allRefused = byBackend([
      [NPM_BACKEND, [[node.id, REFUSED_SYNTAX]]],
      [CARGO_BACKEND, [[node.id, REFUSED_SYNTAX]]],
    ]);
    const region = compose(PLAN, [node], allRefused, matricesByBackend([])).get(
      'configuration',
    ) as string;
    expect(region).toContain('> Enforced: — not machine-enforced yet');
    expect(region).not.toContain('✅');
  });

  it('P3: a degraded node renders `⚠️ FF7003` on a synthetic node', () => {
    const synthetic = processEnvNode({ id: 'synthetic-degraded' });
    const plan: DocPlan = {
      sections: [{ sectionId: 's', title: 'S', nodeIds: [synthetic.id] }],
    };
    const region = compose(
      plan,
      [synthetic],
      byBackend([[CARGO_BACKEND, [[synthetic.id, DEGRADED]]]]),
      matricesByBackend([[CARGO_BACKEND, cargoMatrix()]]),
    ).get('s') as string;
    expect(region).toContain(
      `> Enforced: ${CARGO_BACKEND} ⚠️ FF7003 (clippy.toml carries no severity)`,
    );
  });

  it('A12-pin: enforcement segments are separated by " · " (middle dot), not comma', () => {
    // Pin test: ensures the ` · ` separator cannot silently revert to `, `.
    // Uses the multi-backend case (cargo refused, npm rendered) from the test above.
    const line = computeEnforcementLine(
      node,
      [NPM_BACKEND, CARGO_BACKEND],
      byBackend([
        [NPM_BACKEND, [[node.id, RENDERED]]],
        [CARGO_BACKEND, [[node.id, REFUSED_SYNTAX]]],
      ]),
      matricesByBackend([
        [NPM_BACKEND, npmMatrix()],
        [CARGO_BACKEND, cargoMatrix()],
      ]),
    );
    // Must contain the middle-dot separator.
    expect(line).toContain(' · ');
    // Must NOT contain comma-space as an inter-segment separator at the outer level.
    // (Commas inside parenthesized notes are fine — the regex checks for comma-space at segment boundaries.)
    const withoutNotes = line.replace(/\([^)]*\)/g, '()');
    expect(withoutNotes).not.toMatch(/, /);
  });
});
