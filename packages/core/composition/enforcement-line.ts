// Enforcement-line computation — composition plane (MT umbrella S4, Surface 3).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.1
//   (MT-AIDOC-COMPOSITION-DESIGN, 2026-07-03).
//
// The `Enforced:` line of a rendered region is COMPUTED from live RenderOutcomes +
// capability matrices — NEVER hand-written (T-S4-A). A doc cannot silently lie about its
// enforcement: an ✅ is a fact derived from a `live-fired` matrix cell, an `—` is a fact
// derived from a `refused` RenderOutcome. The line is a pure function of (node, outcomes,
// matrices) — same inputs → byte-identical output.
//
// Truth-table (per node × backend cell):
//   RenderOutcome 'rendered' + node firing-evidence  -> `<b> ✅`
//   RenderOutcome 'rendered', no firing-evidence      -> `<b> 🟡 (rendered, not fired)`
//   RenderOutcome 'degraded'                          -> `<b> ⚠️ <FF> (<note>)`
//   RenderOutcome 'refused'                           -> `<b> — <FF> (<note>)`
//   refused by ALL backends                           -> whole line collapses to
//                                                        `Enforced: — not machine-enforced yet (<b1>: <FF>, <b2>: <FF>)`
//
// Node→cell mapping (BINDING): a node's evidence cell = matrix.cells[node.selectorClass].
// firing-evidence predicate = cell.status !== 'no' && cell.evidence?.kind === 'live-fired'
// — NOT status === 'yes' (cargo carries live-fired evidence in a 'partial' cell; npm in a
// 'yes' cell). See backends/shared/capability-matrix.ts + the two capability-matrix.json.

import type { CapabilityMatrix } from '../backends/shared/capability-matrix.ts';
import type { RenderOutcome } from '../backends/shared/render-outcome.ts';
import type { ConventionNode } from '../ir/types.ts';

/**
 * Firing-evidence predicate for one (node × backend) cell. The single source of truth
 * for "did this backend actually PROVE the rule fires live" — used by both the ✅/🟡 split
 * and the FF8004 gate check. `undefined` matrix / cell (backend has no matrix, or no cell
 * for this selectorClass) is NOT firing evidence.
 */
export function hasFiringEvidence(node: ConventionNode, matrix: CapabilityMatrix | undefined): boolean {
  if (matrix === undefined) return false;
  const cell = matrix.cells[node.selectorClass];
  if (cell === undefined) return false;
  return cell.status !== 'no' && cell.evidence?.kind === 'live-fired';
}

/**
 * Compute the per-backend segment for one (node × backend) cell from its RenderOutcome +
 * capability matrix. Pure; never hand-written. Returns e.g. `npm ✅`, `cargo — FF7001 (…)`.
 */
export function computeSegment(
  backend: string,
  node: ConventionNode,
  outcome: RenderOutcome,
  matrix: CapabilityMatrix | undefined,
): string {
  switch (outcome.kind) {
    case 'rendered':
      return hasFiringEvidence(node, matrix)
        ? `${backend} ✅`
        : `${backend} 🟡 (rendered, not fired)`;
    case 'degraded':
      return `${backend} ⚠️ ${outcome.code} (${outcome.note})`;
    case 'refused':
      return `${backend} — ${outcome.code} (${outcome.note})`;
  }
}

/**
 * Compute the full `Enforced:` line for one node across every backend, in LEXICOGRAPHIC
 * backend order. When EVERY backend refused the node, the line collapses to the derived
 * aggregate honest form (`— not machine-enforced yet (…)`) rather than listing per-backend
 * dashes. `outcomesByBackend` / `matricesByBackend` are keyed by backend name.
 *
 * Throws (programmer-bug class, mirrors assertEveryNodeResolved) if a backend segment has
 * no RenderOutcome for this node — a silent drop would let the line lie by omission.
 */
export function computeEnforcementLine(
  node: ConventionNode,
  backends: string[],
  outcomesByBackend: Map<string, Map<string, RenderOutcome>>,
  matricesByBackend: Map<string, CapabilityMatrix>,
): string {
  const ordered = [...backends].sort((a, b) => a.localeCompare(b));

  const perBackend: Array<{ backend: string; outcome: RenderOutcome }> = [];
  for (const backend of ordered) {
    const outcome = outcomesByBackend.get(backend)?.get(node.id);
    if (outcome === undefined) {
      throw new Error(
        `computeEnforcementLine(): node "${node.id}" has no RenderOutcome for backend "${backend}"`,
      );
    }
    perBackend.push({ backend, outcome });
  }

  const allRefused = perBackend.length > 0 && perBackend.every((e) => e.outcome.kind === 'refused');
  if (allRefused) {
    const parts = perBackend.map((e) => {
      const code = e.outcome.kind === 'refused' ? e.outcome.code : '';
      return `${e.backend}: ${code}`;
    });
    return `Enforced: — not machine-enforced yet (${parts.join(' · ')})`;
  }

  const segments = perBackend.map((e) =>
    computeSegment(e.backend, node, e.outcome, matricesByBackend.get(e.backend)),
  );
  return `Enforced: ${segments.join(' · ')}`;
}
