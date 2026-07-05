// Shared test fixtures for the composition module (MT umbrella S4).
// NOT a production artefact — imported only by composition/*.test.ts. Builds the live-shaped
// ConventionNode + per-backend RenderOutcome maps + capability matrices the compose/gate tests
// exercise, using the SAME two backend names + matrix shapes the shipped backends emit
// (npm-eslint-declarative: syntax cell 'yes'+live-fired; cargo-clippy-toml: syntax cell 'no').

import type { CapabilityMatrix } from '../backends/shared/capability-matrix.ts';
import type { RenderOutcome } from '../backends/shared/render-outcome.ts';
import type { ConventionNode } from '../ir/types.ts';

export const NPM_BACKEND = 'npm-eslint-declarative';
export const CARGO_BACKEND = 'cargo-clippy-toml';

/** The contract's canonical node: a syntax-class process.env ban. */
export function processEnvNode(overrides: Partial<ConventionNode> = {}): ConventionNode {
  return {
    id: 'no-direct-process-env',
    claim: 'Read configuration through the injected config accessor, never process.env directly',
    anchors: [],
    selectorClass: 'syntax',
    params: {
      selector: "MemberExpression[object.name='process'][property.name='env']",
      presence: 'forbid',
    },
    defaultSeverity: 'error',
    provenance: [],
    pairedExamples: {
      negative: 'const url = process.env.DATABASE_URL;',
      positive: "const url = config.get('databaseUrl');",
    },
    ...overrides,
  };
}

/** npm matrix: syntax cell 'yes' + live-fired (this backend PROVES a syntax node fires). */
export function npmMatrix(): CapabilityMatrix {
  return {
    backend: NPM_BACKEND,
    contract: 'firing-contract.json',
    cells: {
      syntax: {
        status: 'yes',
        evidence: {
          kind: 'live-fired',
          date: '2026-07-04',
          toolchain: 'node v24.3.0 / eslint 10.4.0',
          capturedDiagnostic:
            '{"ruleId":"no-restricted-syntax","severity":2,"message":"…","line":1,"column":13}',
        },
      },
      'type-aware': { status: 'no', refusedCode: 'FF7001' },
      'dep-graph': { status: 'no', refusedCode: 'FF7001' },
    },
  };
}

/** cargo matrix: syntax cell 'no' (clippy.toml cannot express a syntax-class ban). */
export function cargoMatrix(): CapabilityMatrix {
  return {
    backend: CARGO_BACKEND,
    contract: 'firing-contract.json',
    cells: {
      syntax: { status: 'no', refusedCode: 'FF7001' },
      'type-aware': {
        status: 'partial',
        caps: ['no per-impl trait-method bans'],
        evidence: {
          kind: 'live-fired',
          date: '2026-07-03',
          toolchain: 'rustc 1.96.1',
          capturedDiagnostic: '{"code":{"code":"clippy::disallowed_methods"}}',
        },
      },
      'dep-graph': { status: 'no', refusedCode: 'FF7001' },
    },
  };
}

export function outcomesMap(entries: Array<[string, RenderOutcome]>): Map<string, RenderOutcome> {
  return new Map(entries);
}

/**
 * Build a `Map<backend, Map<nodeId, RenderOutcome>>` with the value types pinned to
 * `RenderOutcome` so a heterogeneous set of outcome kinds across backends does not narrow the
 * inner Map's value type to a single discriminant (TS infers the first literal otherwise).
 */
export function byBackend(
  entries: Array<[string, Array<[string, RenderOutcome]>]>,
): Map<string, Map<string, RenderOutcome>> {
  return new Map(entries.map(([backend, pairs]) => [backend, new Map<string, RenderOutcome>(pairs)]));
}

/** Build a `Map<backend, CapabilityMatrix>` (pinned value type for symmetry with byBackend). */
export function matricesByBackend(
  entries: Array<[string, CapabilityMatrix]>,
): Map<string, CapabilityMatrix> {
  return new Map<string, CapabilityMatrix>(entries);
}
