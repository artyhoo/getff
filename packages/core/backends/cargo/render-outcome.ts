// RenderOutcome — spec §4 VERBATIM transcription (backend-plane contract).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §4.
// MT umbrella S2 (cargo-backend-v0).
//
// @hoist-at-s3: generic over backends by construction — extract to the generic
// frame ONLY at S3, from three real backends (spec §7). Do not hoist earlier.
export type RenderOutcome =
  | { kind: 'rendered'; surfaces: RenderedSurface[] }
  | { kind: 'degraded'; code: string /* FF */; note: string }
  | { kind: 'refused'; code: string /* FF */; note: string };

// v0-minimum: surface 1 'rule' only (TOML content). The firing test (surface 2, the
// harness that proves the rendered rule actually fires against a live toolchain) is a
// harness artefact under fixtures/firing/ — NOT an outcome field. See §3 of the S2 spec.
export interface RenderedSurface {
  surface: 'rule';
  content: string;
}

// @hoist-at-s3 (same unit as RenderOutcome):
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
