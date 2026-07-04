// Composition gate — composition plane (MT umbrella S4, Surface 3).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.1.
//
// Validates a DocPlan against the node set + live render facts, emitting FF8001-8004. Follows
// the runGrammarGate ACCUMULATE pattern (ir/gates/grammar.ts): a top-level shape violation
// yields FF1001 (ajv, via the shared factory) and returns early; otherwise EVERY semantic
// violation is collected with NO short-circuit — status is derived from whether any diagnostic
// was produced.
//
// The four codes (all defaultSeverity 'error'):
//   FF8001 — a section/excluded nodeId with no matching ConventionNode (dangling reference).
//   FF8002 — a scoped node neither in a section nor a valid excluded[] entry (missing, or
//            reason < 20 chars). attention-is-not-a-mechanism: no silent undocumented node.
//   FF8003 — contradiction: node in BOTH a section and excluded[]; OR a ✅-eligible node whose
//            RenderOutcome is 'refused' for a backend (a doc claiming what a backend refused);
//            OR a backend that has NO RenderOutcome entry for a placed node (silent drop).
//   FF8004 — a placed+rendered node whose matrix cell for its selectorClass carries NO
//            live-fired evidence (a ✅ that is asserted, not proven — T-S4-A).

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CapabilityMatrix } from '../../backends/shared/capability-matrix.ts';
import type { RenderOutcome } from '../../backends/shared/render-outcome.ts';
import { ajvErrorsToDiagnostics, makeSchemaValidator } from '../../diagnostics/ajv.ts';
import { diag } from '../../diagnostics/registry.ts';
import type { Diagnostic } from '../../diagnostics/types.ts';
import type { ConventionNode } from '../../ir/types.ts';
import { hasFiringEvidence } from '../enforcement-line.ts';
import type { DocPlan } from '../types.ts';

// Mirror the sibling fs anchors (ir/gates/grammar.ts) so the gate resolves the schema whether
// it runs from source or from a precompiled bundle. setup.d/99-finalize.sh + pre-push.ts set
// AIF_SYNTH_PKG_ROOT to the packages/core payload dir.
const HERE = dirname(fileURLToPath(import.meta.url));
const _pkgCore = process.env['AIF_SYNTH_PKG_ROOT'];
const SCHEMA_PATH = _pkgCore
  ? resolve(_pkgCore, 'composition', 'doc-plan.schema.json')
  : resolve(HERE, '..', 'doc-plan.schema.json');
const schemaDoc = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as Record<string, unknown>;
const validatePlan = makeSchemaValidator(schemaDoc, 'doc-plan');

export type CompositionGateStatus = 'pass' | 'fail';

export interface CompositionGateOutcome {
  status: CompositionGateStatus;
  diagnostics: Diagnostic[];
}

export interface CompositionGateInput {
  plan: unknown; // validated by ajv (FF1001) before use
  nodes: ConventionNode[];
  outcomesByBackend: Map<string, Map<string, RenderOutcome>>;
  matricesByBackend: Map<string, CapabilityMatrix>;
}

/**
 * Run the composition gate over a (plan, nodes, outcomes, matrices) tuple. A malformed plan
 * yields FF1001 and returns immediately (no shape-dependent checks can run). Otherwise all of
 * FF8001-8004 are accumulated over the whole plan.
 */
export function runCompositionGate(input: CompositionGateInput): CompositionGateOutcome {
  const diagnostics: Diagnostic[] = [];

  // --- shape (ajv, FF1001). A malformed plan cannot drive the semantic checks. ---
  if (!validatePlan(input.plan)) {
    diagnostics.push(...ajvErrorsToDiagnostics(validatePlan.errors));
    return { status: 'fail', diagnostics };
  }
  const plan = input.plan as DocPlan;

  const nodeIds = new Set(input.nodes.map((n) => n.id));
  const nodeById = new Map(input.nodes.map((n) => [n.id, n]));
  const backends = [...input.outcomesByBackend.keys()];

  // Ids placed in sections + ids explicitly excluded.
  const sectionNodeIds = new Set<string>();
  for (const section of plan.sections) {
    for (const id of section.nodeIds) sectionNodeIds.add(id);
  }
  const excluded = plan.excluded ?? [];
  const excludedById = new Map(excluded.map((e) => [e.nodeId, e]));

  // --- FF8001: dangling reference (section nodeId or excluded nodeId → no node). ---
  for (const section of plan.sections) {
    for (const id of section.nodeIds) {
      if (!nodeIds.has(id)) {
        diagnostics.push(diag('FF8001', { nodeId: id, where: `section "${section.sectionId}"` }));
      }
    }
  }
  for (const ex of excluded) {
    if (!nodeIds.has(ex.nodeId)) {
      diagnostics.push(diag('FF8001', { nodeId: ex.nodeId, where: 'excluded[]' }));
    }
  }

  // --- FF8003 (contradiction, part 1): a node in BOTH a section and excluded[]. ---
  for (const ex of excluded) {
    if (sectionNodeIds.has(ex.nodeId)) {
      diagnostics.push(
        diag('FF8003', { nodeId: ex.nodeId, detail: 'placed in both a section and excluded[]' }),
      );
    }
  }

  // --- FF8002: a real scoped node neither placed nor validly excluded. ---
  for (const node of input.nodes) {
    if (sectionNodeIds.has(node.id)) continue; // documented
    const ex = excludedById.get(node.id);
    if (ex === undefined) {
      diagnostics.push(diag('FF8002', { nodeId: node.id, reason: 'no excluded[] entry' }));
    } else if (ex.reason.trim().length < 20) {
      diagnostics.push(
        diag('FF8002', { nodeId: node.id, reason: 'excluded[] reason under 20 chars' }),
      );
    }
  }

  // --- FF8003 (part 2) + FF8004: per placed node × backend render-fact checks. ---
  // Only for placed nodes that actually resolve to a real ConventionNode (dangling handled by
  // FF8001 above; skip here to avoid double-reporting a missing node).
  for (const id of sectionNodeIds) {
    const node = nodeById.get(id);
    if (node === undefined) continue; // FF8001 already fired
    for (const backend of backends) {
      const outcome = input.outcomesByBackend.get(backend)?.get(id);
      if (outcome === undefined) {
        // FF8003 (part 3): a backend segment with no RenderOutcome for a placed node.
        diagnostics.push(
          diag('FF8003', {
            nodeId: id,
            detail: `backend "${backend}" has no RenderOutcome (silent drop)`,
          }),
        );
        continue;
      }
      const matrix = input.matricesByBackend.get(backend);
      const fired = hasFiringEvidence(node, matrix);

      if (outcome.kind === 'rendered') {
        // DN-4: FF8004 fires ONLY on actual matrix incoherence — a cell whose status is 'no'
        // (claims the rule does not apply) but whose evidence carries 'live-fired' (claims it
        // actually was fired). This internal contradiction is the load-bearing honesty failure.
        //
        // The spec-legal 🟡 case (rendered but no firing evidence — status:'no', no evidence)
        // is explicitly listed in spec §5.1 and must NOT be flagged as FF8004. The renderer
        // already emits `🟡 (rendered, not fired)` honestly; the gate is silent on it.
        if (matrix !== undefined) {
          const cell = matrix.cells[node.selectorClass];
          const hasLiveFiredEvidence = cell?.evidence?.kind === 'live-fired';
          const statusIsNo = cell?.status === 'no';
          if (hasLiveFiredEvidence && statusIsNo) {
            diagnostics.push(diag('FF8004', { nodeId: id, backend }));
          }
        }
        continue;
      }

      if (outcome.kind === 'refused' && fired) {
        // Contradiction between the two honesty sources: the capability matrix claims the
        // node's selectorClass fired live for this backend, yet the renderer REFUSED to
        // render it. The doc cannot be simultaneously ✅ (matrix) and — (renderer). FF8003.
        diagnostics.push(
          diag('FF8003', {
            nodeId: id,
            detail: `backend "${backend}" refused (${outcome.code}) but its matrix carries live-fired evidence for selectorClass "${node.selectorClass}"`,
          }),
        );
        continue;
      }
      // 'refused' with no live-fired evidence → honest `—` (both sources agree). 'degraded' →
      // honest `⚠️`. Neither is a ✅ claim, so neither is FF8004; and neither contradicts the
      // matrix, so neither is FF8003. Nothing to report.
    }
  }

  return { status: diagnostics.length > 0 ? 'fail' : 'pass', diagnostics };
}
