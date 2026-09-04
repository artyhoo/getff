// hoisted-from: backends/cargo/render-outcome.ts (S2, spec §4 verbatim) at 3c; consumers: cargo, npm
// RenderOutcome — spec §4 VERBATIM transcription (backend-plane contract).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §4.
// MT umbrella S2 (cargo-backend-v0).
export type RenderOutcome =
  | { kind: 'rendered'; surfaces: RenderedSurface[] }
  | { kind: 'degraded'; code: string /* FF */; note: string }
  | { kind: 'refused'; code: string /* FF */; note: string };

// v0-minimum: surface 1 'rule' only. The firing test (surface 2, the harness that proves the
// rendered rule actually fires against a live toolchain) is a harness artefact under
// fixtures/firing/ — NOT an outcome field. See §3 of the S2 spec.
//
// `content` MEANING DIVERGES BY BACKEND (documented, not a contract violation — surface-1 content
// is backend-defined; consumers key on outcome.kind + the RenderOutcome, never parse `content`):
//   - cargo (render-clippy.ts): the clippy.toml TABLE NAME the rule was placed in (e.g.
//     "disallowed-methods") — a rendered-artifact token.
//   - npm (from-node.ts): the ACTUAL rendered eslint rule JSON (the no-restricted-syntax entry) —
//     rendered artifact text.
//   - astgrep (#212) + ruff (#215), the Python lane: the node's ID TOKEN (`n.id`) — an identity
//     token for the emitted rule document, NOT its rendered text (the full YAML/TOML artifact is
//     the renderer's return value, keyed by id). Chosen because a Python rule maps 1:1 to a rule
//     doc identified by node id; the enforcement-line / gate never read `content`, only `kind`.
// The divergence is intentional and inert: no code path compares `content` across backends.
export interface RenderedSurface {
  surface: 'rule';
  content: string;
}

/**
 * Throws (programmer-bug class, mirrors diag()'s throw-on-unknown-code contract in
 * diagnostics/registry.ts) if any nodeId in `nodeIds` lacks exactly one entry in
 * `outcomes`. Every ConventionNode fed to a backend renderer MUST resolve to exactly
 * one RenderOutcome — no silent drops, no silent duplicates.
 */
export function assertEveryNodeResolved(nodeIds: string[], outcomes: Map<string, RenderOutcome>): void {
  const missing = nodeIds.filter((id) => !outcomes.has(id));
  if (missing.length > 0) {
    throw new Error(
      `assertEveryNodeResolved(): ${missing.length} node(s) have no RenderOutcome: ${missing.join(', ')}`,
    );
  }
  if (outcomes.size !== nodeIds.length) {
    const extra = [...outcomes.keys()].filter((id) => !nodeIds.includes(id));
    throw new Error(
      `assertEveryNodeResolved(): outcomes map has ${extra.length} entr${extra.length === 1 ? 'y' : 'ies'} not in nodeIds: ${extra.join(', ')}`,
    );
  }
}
