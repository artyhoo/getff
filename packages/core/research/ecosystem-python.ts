// pip EcosystemAdapter — the third concrete implementation of the EcosystemAdapter
// seam (allowlist-resolver.ts). All local fs, zero network, zero binary invocation
// (offline-determinism invariant, research-source-trust.md §5; mirrors
// ecosystem-npm.ts / ecosystem-cargo.ts). LG-S4 of the live-generation umbrella.
// Design: docs/superpowers/specs/2026-07-17-lg-s4-python-ecosystem-adapter-design.md.
// Research: docs/meta-factory/research-patches/2026-07-16-lg-s4-python-ecosystem-adapter.md.

/** PEP 503 canonical name normalization: lowercase, collapse runs of [-_.] to a
 *  single hyphen. PEP 503 §"Normalized names". Applied to BOTH the requested
 *  package name and the dist-info METADATA `Name:` before equality comparison,
 *  so hyphen/underscore case-variants unify (my-pkg ≡ my_pkg ≡ My_Pkg). */
export function normalizePep503(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, '-');
}

/** PEP 508 subset: extracts the bare dependency name from a requirement spec.
 *  Strategy (fail-closed): match the leading name token, strip extras `[…]`,
 *  version specifiers, and environment markers. The name must start with a
 *  letter/digit and contain only PEP 508 name chars `[A-Za-z0-9._-]` until a
 *  delimiter (`[`, a version op, `;`, `@`, `(`, end). Unrecognized shapes
 *  (URL `@` requirements, legacy parenthesized `(>=1.0)`, version-op-leading)
 *  return null — documented drops (spec §4.1 limitations). */
export function extractPep508Name(spec: string): string | null {
  const s = spec.trim();
  if (s === '') return null;
  // Reject version-op-leading and parenthesized/URL forms up front.
  if (/^[><=~!]/.test(s)) return null;
  if (s.includes('(')) return null;
  // Capture the leading name run up to the first delimiter.
  const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(s);
  if (m === null) return null;
  // If a `@` follows the name (URL requirement), drop it.
  const afterName = s.slice(m[1]!.length).trimStart();
  if (afterName.startsWith('@')) return null;
  return normalizePep503(m[1]!);
}
