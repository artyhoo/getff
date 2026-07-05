// Region composition — composition plane (MT umbrella S4, Surface 3).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.1
//   (MT-AIDOC-COMPOSITION-DESIGN, 2026-07-03).
//
// compose() renders a DocPlan's sections into one rendered region string per section. PURE:
// same inputs → byte-identical output (compose-purity.test.ts calls it twice and asserts the
// two Maps are identical). No fs, no network, no Date, no randomness.
//
// Region render shape (v0 — NO free prose inside a region):
//   ### <section title>
//   <blank>
//   <per node, in section.nodeIds order>:
//     <claim verbatim>
//     <!-- @nodes: <id> -->
//     > Enforced: <computed line>
//     > Never (fires): <pairedExamples.negative>
//     > Always (clean): <pairedExamples.positive>
//     <blank between nodes>
//
// The `Enforced:` line is COMPUTED by enforcement-line.ts from live RenderOutcomes +
// capability matrices (never hand-written, T-S4-A). Backends inside the Enforced line are
// ordered LEXICOGRAPHICALLY (enforcement-line.ts sorts them).

import type { CapabilityMatrix } from '../backends/shared/capability-matrix.ts';
import type { RenderOutcome } from '../backends/shared/render-outcome.ts';
import type { ConventionNode } from '../ir/types.ts';
import { computeEnforcementLine } from './enforcement-line.ts';
import type { DocPlan } from './types.ts';

/** Render one node's block (claim + node-anchor + the 3 computed enforcement blockquotes). */
function renderNodeBlock(
  node: ConventionNode,
  backends: string[],
  outcomesByBackend: Map<string, Map<string, RenderOutcome>>,
  matricesByBackend: Map<string, CapabilityMatrix>,
): string {
  const enforced = computeEnforcementLine(node, backends, outcomesByBackend, matricesByBackend);
  return [
    node.claim,
    `<!-- @nodes: ${node.id} -->`,
    `> ${enforced}`,
    `> Never (fires): ${node.pairedExamples.negative}`,
    `> Always (clean): ${node.pairedExamples.positive}`,
  ].join('\n');
}

/**
 * Compose a DocPlan into a Map<sectionId, string> — one rendered region body per section.
 *
 * PURE. Backends are the LEXICOGRAPHICALLY-sorted union of the outcome-map keys (so the
 * Enforced-line backend order is deterministic and independent of Map insertion order).
 *
 * Throws (programmer-bug class) if a section references a node id absent from `nodes` — the
 * composition-gate (FF8001) is the graceful surface for that on untrusted plans; compose()
 * itself assumes a gate-clean plan and fails loudly on a broken one.
 */
export function compose(
  plan: DocPlan,
  nodes: ConventionNode[],
  outcomesByBackend: Map<string, Map<string, RenderOutcome>>,
  matricesByBackend: Map<string, CapabilityMatrix>,
): Map<string, string> {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const backends = [...outcomesByBackend.keys()].sort((a, b) => a.localeCompare(b));

  const regions = new Map<string, string>();
  for (const section of plan.sections) {
    const blocks: string[] = [`### ${section.title}`, ''];
    const nodeBlocks: string[] = [];
    for (const nodeId of section.nodeIds) {
      const node = nodeById.get(nodeId);
      if (node === undefined) {
        throw new Error(
          `compose(): section "${section.sectionId}" references unknown node id "${nodeId}"`,
        );
      }
      nodeBlocks.push(renderNodeBlock(node, backends, outcomesByBackend, matricesByBackend));
    }
    // One blank line between node blocks; the region body has no trailing free prose.
    blocks.push(nodeBlocks.join('\n\n'));
    regions.set(section.sectionId, blocks.join('\n'));
  }
  return regions;
}
