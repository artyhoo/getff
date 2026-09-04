// cargo clippy.toml renderer — MT umbrella S2 (cargo-backend-v0).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §4, §7.
//
// Pure function: zero fs/network access. Does NOT run the grammar gate itself (planes
// separated — the grammar gate is an IR-plane concern; this is the backend-render plane).
// render-clippy.test.ts's T15 case runs FIXTURE_NODE through runGrammarGate separately,
// asserting cross-stage self-application without coupling the renderer to the gate.
//
// Routing (exhaustive — every node resolves to exactly one RenderOutcome):
//   selectorClass 'syntax'                        -> refused FF7001
//   selectorClass 'dep-graph'                      -> refused FF7001
//   node.relational present (any class)            -> refused FF7001 (no relational surface in
//                                                     clippy.toml; checked before params validation)
//   selectorClass 'type-aware', off-contract params -> refused FF7002
//   selectorClass 'type-aware', valid params        -> rendered | degraded (by severity)
//
// Known bound (NOT statically detected by this v0 renderer — the honesty boundary lives
// in the capability-matrix cell's `caps` list + firing evidence, not here): clippy's
// disallowed-methods/-types/-macros lints cannot express per-impl trait-method bans,
// cannot see through higher-order calls (rust-clippy#8849), and cannot match generic
// instantiations.

import { diag } from '../../diagnostics/registry.ts';
import type { ConventionNode } from '../../ir/types.ts';
import { assertEveryNodeResolved, type RenderOutcome } from '../shared/render-outcome.ts';
import type { ToolchainBackend } from '../shared/toolchain-backend.ts';

type BackendParamKind = 'method' | 'type' | 'macro';

interface CargoBackendParams {
  kind: BackendParamKind;
  path: string;
  replacement?: string;
}

const KIND_TO_TABLE: Record<BackendParamKind, string> = {
  method: 'disallowed-methods',
  type: 'disallowed-types',
  macro: 'disallowed-macros',
};

const VALID_KINDS: readonly string[] = ['method', 'type', 'macro'];

const BACKEND_NAME = 'cargo-clippy-toml';

function isValidParams(params: Record<string, string | number>): params is CargoBackendParams & Record<string, string | number> {
  const kind = params['kind'];
  const path = params['path'];
  if (typeof kind !== 'string' || !VALID_KINDS.includes(kind)) return false;
  if (typeof path !== 'string' || path.length === 0) return false;
  return true;
}

function missingOrInvalidField(params: Record<string, string | number>): string {
  const kind = params['kind'];
  if (typeof kind !== 'string' || !VALID_KINDS.includes(kind)) return 'kind';
  const path = params['path'];
  if (typeof path !== 'string' || path.length === 0) return 'path';
  return 'unknown';
}

/** Escape double quotes for TOML basic-string emission. */
function escapeTomlString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

interface TableEntry {
  nodeId: string;
  path: string;
  reason: string;
  replacement?: string;
}

/**
 * Render a set of ConventionNode into a clippy.toml (v0: disallowed-methods /
 * disallowed-types / disallowed-macros tables) plus a per-node RenderOutcome map.
 */
export function renderCargoClippy(nodes: ConventionNode[]): { toml: string; outcomes: Map<string, RenderOutcome> } {
  const outcomes = new Map<string, RenderOutcome>();
  const byTable = new Map<string, TableEntry[]>();

  for (const n of nodes) {
    if (n.selectorClass === 'syntax' || n.selectorClass === 'dep-graph') {
      const note =
        n.selectorClass === 'syntax'
          ? 'not expressible in clippy.toml; route to the ast-grep escape-hatch backend (post-v0)'
          : 'dependency-level bans live in cargo-deny [bans] (post-v0)';
      outcomes.set(n.id, {
        kind: 'refused',
        code: 'FF7001',
        note,
      });
      diag('FF7001', { backend: BACKEND_NAME, selectorClass: n.selectorClass, nodeId: n.id });
      continue;
    }

    // --- relational-tree refusal (FF7001, OWNER-FORK-1 Option B, ir-unfreeze S3) ---
    // clippy.toml's disallowed-methods/-types/-macros tables are a FLAT qualified-name ban list
    // with ZERO relational surface — no has/not/all/any, not even a selector language. A
    // RelationalRule tree cannot be partially/lossily rendered (there is no FF7003
    // "rendered-with-loss" path for a structural composition, only for severity). This is a hard
    // capability gap, refused honestly, same idiom as the syntax/dep-graph class-refusal above.
    // Checked BEFORE isValidParams so a relational node whose scalar {kind,path} params LOOK
    // bannable is STILL refused (closes the pre-S3 silent drop where such a node rendered into the
    // toml, dropping the tree). NOTE: clippy refusing IS the honesty boundary — it says "clippy
    // cannot express this", the OPPOSITE of a rust relational-coverage claim (ast-grep, #212, owns
    // the rust relational surface).
    if (n.relational !== undefined) {
      outcomes.set(n.id, {
        kind: 'refused',
        code: 'FF7001',
        note: "relational composition not expressible in clippy's disallowed-methods/-types/-macros vocabulary; route to the ast-grep escape-hatch backend (post-v0)",
      });
      diag('FF7001', { backend: BACKEND_NAME, selectorClass: n.selectorClass, nodeId: n.id });
      continue;
    }

    // selectorClass === 'type-aware' from here on (the only remaining CapabilityClass).
    if (!isValidParams(n.params)) {
      const missing = missingOrInvalidField(n.params);
      outcomes.set(n.id, {
        kind: 'refused',
        code: 'FF7002',
        note: `params contract violation: missing/invalid ${missing}`,
      });
      diag('FF7002', { backend: BACKEND_NAME, nodeId: n.id, missing });
      continue;
    }

    const params = n.params as unknown as CargoBackendParams;
    const table = KIND_TO_TABLE[params.kind];
    const entry: TableEntry = {
      nodeId: n.id,
      path: params.path,
      reason: n.claim, // reason is ALWAYS node.claim — params.reason is never read (spec §4).
      ...(params.replacement !== undefined ? { replacement: params.replacement } : {}),
    };
    const list = byTable.get(table) ?? [];
    list.push(entry);
    byTable.set(table, list);

    if (n.defaultSeverity === 'warning') {
      outcomes.set(n.id, { kind: 'rendered', surfaces: [{ surface: 'rule', content: table }] });
    } else {
      // 'error' | 'note' — clippy.toml carries no severity; degraded = rendered-with-loss,
      // NOT dropped. The entry is still emitted into the toml below. clippy.toml genuinely has
      // no severity field, so this degrade STAYS on the clippy.toml plane; the build-failing
      // severity is projected on a SEPARATE plane (Cargo.toml [lints.clippy] deny — surface-5,
      // shipped in write-clippy.ts, launch-preannounce-track S4).
      outcomes.set(n.id, {
        kind: 'degraded',
        code: 'FF7003',
        note: 'clippy.toml carries no severity; build-failing severity is projected via Cargo.toml [lints.clippy] (write-clippy.ts)',
      });
      diag('FF7003', { backend: BACKEND_NAME, nodeId: n.id, requested: n.defaultSeverity });
    }
  }

  assertEveryNodeResolved(
    nodes.map((n) => n.id),
    outcomes,
  );

  const toml = renderToml(byTable);
  return { toml, outcomes };
}

// ToolchainBackend<string> conformance (3c). The public renderCargoClippy is NOT renamed and
// keeps its `{ toml, outcomes }` shape; this declaration adapts it to the generic
// `{ artifacts, outcomes }` frame at the declaration site (its artifact is the TOML string).
export const cargoClippyBackend = {
  name: BACKEND_NAME,
  render(nodes: ConventionNode[]) {
    const { toml, outcomes } = renderCargoClippy(nodes);
    return { artifacts: toml, outcomes };
  },
} satisfies ToolchainBackend<string>;

const TABLE_ORDER = ['disallowed-methods', 'disallowed-types', 'disallowed-macros'];

function renderToml(byTable: Map<string, TableEntry[]>): string {
  const lines: string[] = ['# generated by getff cargo backend v0 — do not edit by hand'];
  for (const table of TABLE_ORDER) {
    const entries = byTable.get(table);
    if (!entries || entries.length === 0) continue;
    const sorted = [...entries].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
    lines.push(`${table} = [`);
    for (const e of sorted) {
      const parts = [`path = "${escapeTomlString(e.path)}"`, `reason = "${escapeTomlString(e.reason)}"`];
      if (e.replacement !== undefined) {
        parts.push(`replacement = "${escapeTomlString(e.replacement)}"`);
      }
      lines.push(`    { ${parts.join(', ')} },`);
    }
    lines.push(']');
  }
  return lines.join('\n') + (lines.length > 1 ? '\n' : '');
}
