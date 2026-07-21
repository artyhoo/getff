// IR grammar gate — stage MT umbrella S1.
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §3.
//
// Wraps an ajv shape check (convention-node.schema.json, FF1001 via the shared
// diagnostics/ajv.ts factory — reuse pattern: research/gates/shape.ts) + per-node and
// set-level semantic checks (FF6001/FF6002/FF6003/FF6004). Accumulates ALL diagnostics without
// short-circuit (the B-gate pattern, same as checkResearchPlan) — status is derived from
// whether any diagnostic was produced.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ajvErrorsToDiagnostics, makeSchemaValidator } from '../../diagnostics/ajv.ts';
import { diag } from '../../diagnostics/registry.ts';
import { REGISTRY } from '../../diagnostics/registry.ts';
import type { Diagnostic } from '../../diagnostics/types.ts';
import type { RelationalRule } from '../types.ts';
import type { GrammarGateOutcome } from './types.ts';

// AIF_SYNTH_PKG_ROOT: when this gate runs inside the precompiled synth bundle
// (install/synth-and-wire.bundle.mjs — the synthesize() врезка pulls the gate into that bundle),
// import.meta.url points at the bundle file, so a bare `new URL('../convention-node.schema.json',
// import.meta.url)` anchor resolves to the wrong dir and ENOENTs at consumer runtime. Mirror the
// four sibling fs anchors (research/internal-validators.ts, research/load.ts, allowlist-resolver.ts,
// synthesizer/synthesize.ts): resolve under $AIF_SYNTH_PKG_ROOT/ir when set, else relative to this
// source file. setup.d/99-finalize.sh + pre-push.ts set the env var to the packages/core payload dir.
const HERE = dirname(fileURLToPath(import.meta.url));
const _pkgCore = process.env['AIF_SYNTH_PKG_ROOT'];
const SCHEMA_PATH = _pkgCore
  ? resolve(_pkgCore, 'ir', 'convention-node.schema.json')
  : resolve(HERE, '..', 'convention-node.schema.json');
const schemaDoc = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as Record<string, unknown>;

const validateNode = makeSchemaValidator(schemaDoc, 'ConventionNode');

interface NodeShape {
  id: string;
  anchors: string[];
  pairedExamples: { positive: string; negative: string };
  relational?: RelationalRule; // ajv already deep-validated the tree when present (Option B)
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

/** Exhaustiveness guard for the RelationalRule discriminated union — unreachable at runtime
 *  (ajv validated `op` before the walk), a compile-time totality device (design criterion c). */
function assertNever(x: never): never {
  throw new Error(`unexpected relational op: ${JSON.stringify(x)}`);
}

/**
 * FF6004 — relational-plane degeneracy walk (the FF6001 analog on the relational plane). For each
 * COMPOSITE arm (all/any/not), if two or more of its `children` are byte-identical (JSON.stringify
 * equality) the composition adds no discriminating power → FF6004. Recurses into every child so a
 * NESTED degenerate composite is caught too; the `has` leaf bottoms out. This is the residual
 * semantic check ajv cannot express (cross-child equality) — the tree SHAPE is already
 * ajv-validated (FF1001) by the time this runs, so only a present, shape-valid tree reaches here
 * (never a legacy scalar node → byte-lock-safe).
 */
function walkRelational(
  rule: RelationalRule,
  nodeId: string,
  path: string,
  diagnostics: Diagnostic[],
): void {
  switch (rule.op) {
    case 'has':
      return; // leaf — no children
    case 'not':
    case 'all':
    case 'any': {
      const seen = new Set<string>();
      for (const child of rule.children) {
        const key = JSON.stringify(child);
        if (seen.has(key)) {
          // One FF6004 per degenerate composite is enough to flag it.
          diagnostics.push(diag('FF6004', { op: rule.op, nodeId }, { path }));
          break;
        }
        seen.add(key);
      }
      for (const child of rule.children) {
        walkRelational(child, nodeId, path, diagnostics);
      }
      return;
    }
    default:
      return assertNever(rule);
  }
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

    // Relational-plane degeneracy (FF6004). Walks ONLY a present, ajv-shape-valid tree — never
    // fires on a legacy scalar node (relational absent), keeping the byte-lock legacy path clean.
    if (node.relational !== undefined) {
      walkRelational(node.relational, nodeId, path, diagnostics);
    }
  }

  return { status: diagnostics.length > 0 ? 'fail' : 'pass', diagnostics };
}
