// Source allowlist registry: trusted documentation hosts per allowlist key.
// Curated research entries declare provenance with `allowlistKey` + `url`;
// validateProvenance enforces that the URL hostname belongs to the host list
// associated with that key. https-only.
//
// Since S1 of rule-research-trust-tiers this const is the TIER-0 data of the
// tiered resolver (allowlist-resolver.ts): Tier 0 builtin (this file) →
// Tier 1 derived from installed-package metadata (S2) → Tier 2 consumer-acked
// file. The one-arg validateProvenance below stays Tier-0-only for exact
// back-compat (kickoff §5 S1; Tier 1/2 activate only where a ResolveCtx is
// threaded — DN #7 Option A).

import type { Provenance } from './types.ts';
import {
  resolveAllowedSources,
  validateProvenance as validateWithResolved,
  type ResolvedSources,
} from './allowlist-resolver.ts';

export const ALLOWED_SOURCES = {
  'next.official': ['nextjs.org', 'vercel.com'],
  'react.official': ['react.dev'],
  'react-native.official': ['reactnative.dev'],
  'expo.official': ['expo.dev'],
  'tailwind.official': ['tailwindcss.com'],
  'mdn': ['developer.mozilla.org'],
  'typescript.official': ['typescriptlang.org', 'www.typescriptlang.org'],
} as const satisfies Record<string, readonly string[]>;

export type AllowlistKey = keyof typeof ALLOWED_SOURCES;

export interface ProvenanceValidation {
  ok: boolean;
  reason?: string;
}

// Lazy init: allowlist.ts ⇄ allowlist-resolver.ts import each other (resolver
// reads ALLOWED_SOURCES as Tier-0 data); deferring to first call keeps module
// initialization order-independent. No ctx ⇒ zero fs access (empty Tier 2).
let tier0Only: ResolvedSources | undefined;

export function validateProvenance(p: Provenance): ProvenanceValidation {
  tier0Only ??= resolveAllowedSources();
  const d = validateWithResolved(p, tier0Only);
  return d === null ? { ok: true } : { ok: false, reason: d.message };
}
