// IR grammar gate — stage MT umbrella S1.
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §3.
//
// Wraps an ajv shape check (convention-node.schema.json, FF1001 via the shared
// diagnostics/ajv.ts factory — reuse pattern: research/gates/shape.ts) + per-node and
// set-level semantic checks (FF6001/FF6002/FF6003). Accumulates ALL diagnostics without
// short-circuit (the B-gate pattern, same as checkResearchPlan) — status is derived from
// whether any diagnostic was produced.

import { readFileSync } from 'node:fs';
import { ajvErrorsToDiagnostics, makeSchemaValidator } from '../../diagnostics/ajv.ts';
import { diag } from '../../diagnostics/registry.ts';
import { REGISTRY } from '../../diagnostics/registry.ts';
import type { Diagnostic } from '../../diagnostics/types.ts';
import type { GrammarGateOutcome } from './types.ts';

const schemaDoc = JSON.parse(
  readFileSync(new URL('../convention-node.schema.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

const validateNode = makeSchemaValidator(schemaDoc, 'ConventionNode');

interface NodeShape {
  id: string;
  anchors: string[];
  pairedExamples: { positive: string; negative: string };
}

function isNodeShape(value: unknown): value is NodeShape {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['id'] === 'string' &&
    Array.isArray(v['anchors']) &&
    typeof v['pairedExamples'] === 'object' &&
    v['pairedExamples'] !== null
  );
}

/**
 * Run the IR grammar gate over an array of (candidate) ConventionNode values.
 * Per-node: ajv shape validation (FF1001) followed — ONLY for shape-valid nodes — by
 * semantic checks (FF6001 degenerate pair, FF6003 dangling anchor). Set-level: duplicate
 * id detection (FF6002) across every node that has a readable id, regardless of shape
 * validity. No short-circuit — every applicable diagnostic is accumulated.
 */
export function runGrammarGate(nodes: unknown): GrammarGateOutcome {
  const diagnostics: Diagnostic[] = [];

  if (!Array.isArray(nodes)) {
    // Wrap in the same shape ajv would see for a top-level array-type violation, so the
    // caller always gets an FF1001 for a malformed top-level input rather than a thrown
    // TypeError. Delegate to ajv itself for a uniform diagnostic shape.
    const wrapValidate = makeSchemaValidator(
      { type: 'array', items: {} } as Record<string, unknown>,
      'ConventionNodeArray',
    );
    wrapValidate(nodes);
    diagnostics.push(...ajvErrorsToDiagnostics(wrapValidate.errors));
    return { status: 'fail', diagnostics };
  }

  // --- set-level: duplicate id (works even for shape-invalid nodes, as long as `id`
  // itself is a readable string — a duplicate id is a set-level property, independent of
  // whether the rest of the node is well-shaped). ---
  const idCounts = new Map<string, number>();
  for (const node of nodes) {
    if (typeof node === 'object' && node !== null && typeof (node as Record<string, unknown>)['id'] === 'string') {
      const id = (node as Record<string, unknown>)['id'] as string;
      idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    }
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      diagnostics.push(diag('FF6002', { id, count }));
    }
  }

  // --- per-node: shape (ajv, FF1001), then (only if shape-valid) semantic checks. ---
  for (let idx = 0; idx < nodes.length; idx++) {
    const node = nodes[idx];
    const path = `/nodes/${idx}`;
    const shapeOk = validateNode(node);
    if (!shapeOk) {
      diagnostics.push(
        ...ajvErrorsToDiagnostics(validateNode.errors).map((d) => ({
          ...d,
          path: d.path ? `${path}${d.path}` : path,
        })),
      );
      continue; // semantic checks require a shape-valid node
    }

    if (!isNodeShape(node)) continue; // unreachable given ajv passed, but keeps TS honest
    const nodeId = node.id;

    if (node.pairedExamples.positive === node.pairedExamples.negative) {
      diagnostics.push(diag('FF6001', { nodeId }, { path }));
    }

    for (const anchor of node.anchors) {
      if (!(anchor in REGISTRY)) {
        diagnostics.push(diag('FF6003', { anchor, nodeId }, { path }));
      }
    }
  }

  return { status: diagnostics.length > 0 ? 'fail' : 'pass', diagnostics };
}
