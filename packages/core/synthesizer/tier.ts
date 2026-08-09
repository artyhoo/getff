// Per-rule trust-tier derivation — the single canonical implementation.
// Shared by the installer (rules-lock emission) and the synthesizer
// (generation-context manifest). Lives in synthesizer/ alongside the emit
// site that stamps tier at synthesis time; both installer/ and synthesizer/
// depend on research/ for the Provenance/Tier types, and placing the canonical
// weakestTier() here (rather than installer/) avoids a circular value-import
// (install.ts imports emit from synthesizer/emit.ts, so emit.ts cannot import
// a value from install.ts without a runtime cycle).

import type { Provenance, Tier } from '../research/types.ts';
import { validateProvenance } from '../research/allowlist.ts';

/** Default trust tier for provenance without an explicit tier stamp (PARK-S1-2 Option C).
 *  Tier 2 = consumer-acked — the lowest auto-trust. Never silently upgrade untyped provenance. */
export const DEFAULT_TIER: Tier = 2;

/** Stamp each provenance item's tier at synthesis time (PARK-S1-2 Option C / §6 fork 4).
 *  Tier is a fact about the research moment, like fetchedAt — never re-derived at install
 *  time. Classification is Tier-0-only (the builtin allowlist is a static const, no consumer
 *  context needed): a provenance URL that passes validateProvenance against ALLOWED_SOURCES
 *  is Tier 0 (builtin curated). Everything else fails closed to DEFAULT_TIER (2) — Tier 1
 *  requires a consumer-root adapter + installed-package metadata, and Tier 2 requires the
 *  ack file, neither of which is available in the synthesizer's pure planning context.
 *  Explicit tier values (hand-stamped by a researcher or test fixture) are preserved. */
export function stampProvenanceTier(provenance: Provenance[]): Provenance[] {
  return provenance.map((p) => ({
    ...p,
    tier: p.tier ?? (validateProvenance(p).ok ? (0 as Tier) : DEFAULT_TIER),
  }));
}

/** Collapse per-source tiers to one per-rule tier by taking the WEAKEST (highest numeric)
 *  source backing the rule — a rule is only as trustworthy as its least-trusted input.
 *  Content partly derived from a Tier-2 acked source cannot honestly attest builtin-curated
 *  (Tier-0) provenance. This is fail-closed aggregation: a gate of the form «re-verify rules
 *  at tier >= N» is never silently exempted by one curated source alongside acked-derived content.
 *  If the synthesizer stamped `research.tier`, prefer it (synthesis-time stamp per PARK-S1-2 Option C). */
export function weakestTier(provenance: Provenance[], stamped?: Tier): Tier {
  if (stamped !== undefined) return stamped;
  if (provenance.length === 0) return DEFAULT_TIER;
  return Math.max(...provenance.map((p) => p.tier ?? DEFAULT_TIER)) as Tier;
}
