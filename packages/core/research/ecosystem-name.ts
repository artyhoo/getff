// Ecosystem-prefix parsing — research-source-trust.md §4 (S4, now SHIPPED).
// Provenance.packageName / ResearchEntry.package are bare npm-implicit names
// pre-S4. S4 adds an explicit "<ecosystem>:<bareName>" prefix so a non-JS
// dependency (e.g. a cargo crate) can be named unambiguously alongside npm
// package names in the same field. Unprefixed names keep the npm-implicit
// default (back-compat with every pre-S4 ResearchEntry/Provenance).
//
// Fail-closed contract: a prefix that does not match a KNOWN, adapter-backed
// ecosystem (today: npm, cargo) is NEVER silently treated as npm — it parses
// to ecosystem:"unknown" so callers (tier1For) can fail closed on it (a
// Tier-1 miss), rather than accidentally routing an unrecognized-ecosystem
// name through the npm adapter.

export interface ParsedEcosystemName {
  ecosystem: string;
  bareName: string;
}

/** Ecosystems with a real EcosystemAdapter as of S4. Extend when a new
 *  adapter ships (kickoff §5 S4 reserves the seam; this is the concrete
 *  known-prefix set consulted by the parser). */
const KNOWN_ECOSYSTEM_PREFIXES: ReadonlySet<string> = new Set(['npm', 'cargo']);

/** Parses an ecosystem-prefixed name. Unprefixed (no ":" at all, OR a ":" that
 *  is not immediately preceded by a known ecosystem keyword — e.g. npm scoped
 *  names never contain ":") defaults to npm. A ":"-containing name whose
 *  left-hand side is NOT a known ecosystem is fail-closed to "unknown" — it
 *  is deliberately NOT treated as a literal bare npm name (that would let an
 *  unrecognized-ecosystem-prefixed string silently acquire npm's Tier-1
 *  trust surface under a different disguise). */
export function parseEcosystemName(name: string): ParsedEcosystemName {
  const idx = name.indexOf(':');
  if (idx === -1) {
    return { ecosystem: 'npm', bareName: name };
  }
  const prefix = name.slice(0, idx);
  const rest = name.slice(idx + 1);
  if (KNOWN_ECOSYSTEM_PREFIXES.has(prefix)) {
    return { ecosystem: prefix, bareName: rest };
  }
  // Unknown prefix (or a bare name that happens to embed ":", e.g. a
  // theoretical "pip:requests" before a pip adapter ships) — fail closed,
  // bareName is the ORIGINAL full string so no information is silently
  // dropped and no name is treated as resolvable under any adapter.
  return { ecosystem: 'unknown', bareName: name };
}
