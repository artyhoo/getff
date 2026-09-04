// npm-on-IR declarative backend — the ConventionNode -> SynthesizedRule adapter + the
// second RenderOutcome emitter (MT umbrella S3b, PR-1).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §4, §7.
//
// Pure functions: zero fs/network access. Does NOT run the grammar gate itself (planes
// separated — the grammar gate is an IR-plane concern, run by the producer BEFORE the
// adapter; see the wiring врезка in PR-2/PR-3). from-node.test.ts's N4-adjacent case runs
// a node through runGrammarGate separately, asserting the gate stands in the flow.
//
// Routing (exhaustive — every node resolves to exactly one RenderOutcome):
//   selectorClass 'type-aware'                 -> refused FF7001 (no typed rules in the
//                                                 declarative no-restricted-syntax class)
//   selectorClass 'dep-graph'                  -> refused FF7001 (dependency-level bans are
//                                                 not a syntax-selector class)
//   node.relational present (any class)        -> refused FF7001 (the RelationalRule leaf is an
//                                                 ast-grep PYTHON-AST pattern, not an esquery
//                                                 selector; checked before params validation. The
//                                                 exported nodeToSynthesizedRule THROWS on the same
//                                                 case — defense-in-depth for direct callers.)
//   selectorClass 'syntax', off-contract params -> refused FF7002
//   selectorClass 'syntax', valid params        -> rendered
//
// Severity: eslint projects off/warn/error natively (no-restricted-syntax carries its own
// ['error'|'warn', …] level), so the degraded-severity path (FF7003) is NOT emitted here —
// the capability matrix records that severity IS projected at v0 for this backend.

import { diag } from '../../diagnostics/registry.ts';
import type { ConventionNode } from '../../ir/types.ts';
import type { SynthesizedRule } from '../../synthesizer/types.ts';
import { assertEveryNodeResolved, type RenderOutcome } from '../shared/render-outcome.ts';
import type { ToolchainBackend } from '../shared/toolchain-backend.ts';

const BACKEND_NAME = 'npm-eslint-declarative';

// The built-in ESLint rule the declarative-syntax class compiles into. Named here (not the
// exempt-aware wrapper) because the firing contract fires the raw no-restricted-syntax rule.
export const NPM_DECLARATIVE_RUNNER = 'no-restricted-syntax';

/** The node.params contract the npm declarative backend requires for a rendered rule. */
interface NpmDeclarativeParams {
  selector: string;
  presence: 'forbid' | 'require';
  messageId?: string;
}

const VALID_PRESENCE: readonly string[] = ['forbid', 'require'];

function isValidParams(
  params: Record<string, string | number>,
): params is NpmDeclarativeParams & Record<string, string | number> {
  const selector = params['selector'];
  const presence = params['presence'];
  if (typeof selector !== 'string' || selector.length === 0) return false;
  if (typeof presence !== 'string' || !VALID_PRESENCE.includes(presence)) return false;
  return true;
}

function missingOrInvalidField(params: Record<string, string | number>): string {
  const selector = params['selector'];
  if (typeof selector !== 'string' || selector.length === 0) return 'selector';
  const presence = params['presence'];
  if (typeof presence !== 'string' || !VALID_PRESENCE.includes(presence)) return 'presence';
  return 'unknown';
}

/**
 * Enrichment: everything the producer holds that does NOT project into the ConventionNode
 * (frozen 8-field node, spec §3). Passed as the second argument from the producer's own
 * existing source — NOT read off the node. v0-minimum: stack.
 */
export interface NpmEnrichment {
  stack: string[];
  appliesTo?: string[];
}

/**
 * Map ONE rendered (syntax-class, on-contract) ConventionNode to a SynthesizedRule.
 * Pure projection — the node is the convention backbone (id/claim/params.selector/
 * pairedExamples/provenance/severity), enrichment supplies the rest (stack, applies-to).
 * Throws (programmer-bug class) if called on a non-syntax node — routing must gate this.
 */
export function nodeToSynthesizedRule(node: ConventionNode, enrichment: NpmEnrichment): SynthesizedRule {
  if (node.selectorClass !== 'syntax') {
    throw new Error(
      `nodeToSynthesizedRule(): node ${node.id} has selectorClass '${node.selectorClass}', only 'syntax' maps to a declarative rule`,
    );
  }
  if (node.relational !== undefined) {
    // Defense-in-depth (OWNER-FORK-1 Option B, ir-unfreeze S3): renderNpmDeclarative's FF7001
    // gates the BATCH path, but this projection is EXPORTED — a direct caller would otherwise
    // silently drop the relational tree (only non-relational syntax nodes map to a declarative
    // rule; routing must gate this). Consistent with the throw-contract above (programmer-bug class).
    throw new Error(
      `nodeToSynthesizedRule(): node ${node.id} carries a relational tree; only non-relational syntax nodes map to a declarative rule (route to the ast-grep backend, #212 — routing must gate this)`,
    );
  }
  if (!isValidParams(node.params)) {
    throw new Error(
      `nodeToSynthesizedRule(): node ${node.id} params fail the npm declarative contract (missing/invalid ${missingOrInvalidField(node.params)})`,
    );
  }
  const params = node.params as unknown as NpmDeclarativeParams;

  const rule: SynthesizedRule = {
    id: node.id,
    title: node.claim, // claim -> title (spec §4: message/title is ALWAYS node.claim)
    stack: enrichment.stack,
    ...(enrichment.appliesTo !== undefined ? { 'applies-to': enrichment.appliesTo } : {}),
    check: {
      type: 'declarative',
      engine: 'eslint-restricted',
      selector: params.selector,
      presence: params.presence,
      message: node.claim,
      ...(params.messageId !== undefined ? { messageId: params.messageId } : {}),
    },
    examples: {
      bad: node.pairedExamples.negative, // negative example = the violating code
      good: node.pairedExamples.positive, // positive example = the conforming code
    },
    research: { entryId: node.id, provenance: node.provenance },
  };
  return rule;
}

/**
 * Render a set of ConventionNode into (a) the SynthesizedRule[] for the rendered nodes and
 * (b) a per-node RenderOutcome map. Every node resolves to exactly one outcome — no silent
 * drops (assertEveryNodeResolved enforces totality, the P3 property).
 */
export function renderNpmDeclarative(nodes: ConventionNode[]): {
  rules: SynthesizedRule[];
  outcomes: Map<string, RenderOutcome>;
} {
  const outcomes = new Map<string, RenderOutcome>();
  const rules: SynthesizedRule[] = [];

  for (const n of nodes) {
    if (n.selectorClass === 'type-aware' || n.selectorClass === 'dep-graph') {
      const note =
        n.selectorClass === 'type-aware'
          ? 'typed rules are not expressible in the no-restricted-syntax declarative class; route to a type-aware backend (post-v0)'
          : 'dependency-level bans are not a syntax-selector class; route to a dep-graph backend (post-v0)';
      outcomes.set(n.id, { kind: 'refused', code: 'FF7001', note });
      diag('FF7001', { backend: BACKEND_NAME, selectorClass: n.selectorClass, nodeId: n.id });
      continue;
    }

    // --- relational-tree refusal (FF7001, OWNER-FORK-1 Option B, ir-unfreeze S3) ---
    // esquery (what no-restricted-syntax consumes) is a JS-AST selector language WITH relational
    // operators (:has/:not/combinators), so this is NOT "eslint can't do relational at all". The
    // narrower, defensible claim: the RelationalRule LEAF (RelationalHas.pattern) is an ast-grep
    // metavariable pattern over PYTHON AST (e.g. `return $V`), not an esquery selector; there is no
    // faithful ast-grep-pattern -> esquery translator, and fabricating selector-composition would be
    // a "works"-without-evidence claim. So refuse honestly and route to ast-grep (#212). Checked
    // BEFORE isValidParams so an otherwise-renderable {selector,presence} node is STILL refused
    // (closes the pre-S3 silent drop where the tree dropped into the config).
    if (n.relational !== undefined) {
      outcomes.set(n.id, {
        kind: 'refused',
        code: 'FF7001',
        note: 'relational composition not expressible in the no-restricted-syntax declarative class; route to the ast-grep backend (#212)',
      });
      diag('FF7001', { backend: BACKEND_NAME, selectorClass: n.selectorClass, nodeId: n.id });
      continue;
    }

    // selectorClass === 'syntax' from here on.
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

    const rule = nodeToSynthesizedRule(n, { stack: [] });
    rules.push(rule);
    // Surface 1 = the rendered no-restricted-syntax config entry (the human-facing config
    // fragment). The firing test (surface 2 — proving the rendered rule actually fires
    // against a live eslint) is a harness artefact under firing.test.ts, NOT an outcome field.
    const params = n.params as unknown as NpmDeclarativeParams;
    outcomes.set(n.id, {
      kind: 'rendered',
      surfaces: [{ surface: 'rule', content: renderRestrictedEntry(params, n.claim) }],
    });
  }

  assertEveryNodeResolved(
    nodes.map((n) => n.id),
    outcomes,
  );

  return { rules, outcomes };
}

/**
 * Render the no-restricted-syntax config entry for ONE syntax node as a deterministic JSON
 * string (surface content). Mirrors the ['error', { selector, message }] shape the
 * synthesizer emits (compile-declarative-md.ts declarativeRestrictedConfigEntry).
 */
function renderRestrictedEntry(params: NpmDeclarativeParams, claim: string): string {
  const entry: Record<string, string> = { selector: params.selector, message: claim };
  return JSON.stringify(['error', entry]);
}

// ToolchainBackend<SynthesizedRule[]> conformance (3c). The public renderNpmDeclarative is NOT
// renamed and keeps its `{ rules, outcomes }` shape; this declaration adapts it to the generic
// `{ artifacts, outcomes }` frame at the declaration site (its artifact is the SynthesizedRule[]).
export const npmDeclarativeBackend = {
  name: BACKEND_NAME,
  render(nodes: ConventionNode[]) {
    const { rules, outcomes } = renderNpmDeclarative(nodes);
    return { artifacts: rules, outcomes };
  },
} satisfies ToolchainBackend<SynthesizedRule[]>;
