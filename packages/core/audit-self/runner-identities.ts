// packages/core/audit-self/runner-identities.ts
//
// Runner identity table for scripts/living-docs-audit.mjs (kickoff-d0 §3):
// which runner bytes the command admits, identified from the SOURCE artifacts
// as build-derived input data — base, react-next, react-spa (react-native is
// NOT admitted in D0) plus the chained base each wrapper invokes. The fields
// are exactly what living-docs-audit-cli.ts consumes: script / sourceArtifact /
// sha256 / chainedBase. Parse anchors live in the CLI parser, not here.
//
// This source file is a THROWING PLACEHOLDER. The real table — sha256 of each
// source artifact, computed at build time — is injected as a virtual module by
// scripts/build-runtime-bundles.mjs when it builds living-docs-audit.bundle.mjs.
// There is NO manually maintained second hash ledger: the hashes exist only in
// the generated bundle, derived from the same bytes the installer delivers
// (setup.d/40-configs.sh copies the artifacts verbatim via copy_safe).
// Determinism: content is hash-derived only (no timestamps), so --check mode
// reproduces byte-identical bundles.

export type RunnerKind = 'base' | 'react-next' | 'react-spa';

export interface RunnerIdentity {
  /** Consumer-side script path the command expects under --project-root. */
  script: string;
  /** Repo-relative source artifact whose bytes the installer delivers. */
  sourceArtifact: string;
  /** sha256 of the source artifact bytes, computed at build time. */
  sha256: string;
  /** Identity of the nested base a wrapper invokes exactly once, if any. */
  chainedBase?: RunnerIdentity;
}

export interface RunnerIdentityTable {
  runners: Record<RunnerKind, RunnerIdentity>;
}

export function getRunnerIdentities(): RunnerIdentityTable {
  throw new Error(
    'runner-identities is a build-derived module — use living-docs-audit.bundle.mjs built by scripts/build-runtime-bundles.mjs',
  );
}
