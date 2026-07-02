// Research Agent (Layer 2) public types.
// Consumed by L3 (Synthesizer) via index.ts; load.ts/diff.ts/drift.ts internal.

export interface Provenance {
  url: string;
  allowlistKey: string;
  fetchedAt: string;
  /** NEW (S2): Tier-1 scope-lock right-hand side. Convention: set allowlistKey
   *  to the package name for Tier-1 routing (not a Tier-0 key). */
  packageName?: string;
  /** NEW (S2): post-redirect URL — agent-protocol obligation, NOT validator-
   *  verified (kickoff §4); when present it must pass the same tier as url. */
  finalUrl?: string;
}

export interface ResearchEntry {
  id: string;
  summary: string;
  bestPractices: string[];
  antiPatterns: string[];
  provenance: Provenance[];
  extras?: Record<string, unknown>;
  /** NEW (S2): trusted scope-lock left side; required for Tier-1 authorization,
   *  absent on Tier-0 curated entries (T15 back-compat with the 9 store JSONs). */
  package?: string;
}

export type DriftKind = 'modal-verb' | 'term-presence';

export interface DriftMismatch {
  kind: DriftKind;
  detail: string;
  foundIn: string[];
  missingIn: string[];
}

export interface DriftReport {
  sources: string[];
  mismatches: DriftMismatch[];
}

export interface ResearchPlan {
  framework: string | null;
  version: string | null;
  patterns: ResearchEntry[];
  missing: string[];
  drift: DriftReport | null;
}
