// Convention IR — plane 2 of the Convention Compiler (MT umbrella S1).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §3 (node), §6 (vocabularies).
// Node fields are FIXED by spec §3 — do not add fields (no capabilityTier/confidenceTier on the node: v0.2 dropped them).

import type { Severity } from '../diagnostics/types.ts';
import type { Provenance } from '../research/types.ts'; // precedent: synthesizer/types.ts:6

export const CAPABILITY_CLASSES = ['syntax', 'type-aware', 'dep-graph'] as const;
export type CapabilityClass = (typeof CAPABILITY_CLASSES)[number];

export const CONFIDENCE_TIERS = ['allow', 'warn', 'deny', 'deny-by-default'] as const;
export type ConfidenceTier = (typeof CONFIDENCE_TIERS)[number];
// v0: named vocabulary only, NOT a ConventionNode field (spec §6). Consumer: backend render policy, post-v0.

export const ASSERT_TIERS = ['compile_fail', 'no_run', 'run', 'should_panic', 'output'] as const;
export type AssertTier = (typeof ASSERT_TIERS)[number];
// v0: named vocabulary only. Rust rustdoc ladder (4 rungs per the decisions doc) + 'output' = Go's
// Output tier added as an equal literal — a deliberate S1 decision extending the canonical 4-rung
// ladder (decisions doc names the Go tier alongside it); consumer: post-MVP doc-test surface (spec §5 #4).

export const PROVENANCE_TIERS = [0, 1, 2] as const;
export type ProvenanceTier = (typeof PROVENANCE_TIERS)[number];
// Names the ladder the trust-tiers resolver already implements behaviourally
// (research/allowlist-resolver.ts, Tier 0/1/2; .claude/rules/research-source-trust.md §1).
// The resolver stays the behavioural SSOT — this is the IR-plane NAME for that ladder.

export interface PairedExamples {
  positive: string;
  negative: string;
}

export interface ConventionNode {
  id: string;
  claim: string;
  anchors: string[]; // FF-code namespace only (^FF\d{4}$), resolvable into diagnostics REGISTRY; may be empty at v0
  selectorClass: CapabilityClass;
  params: Record<string, string | number>;
  defaultSeverity: Severity; // a rendering detail, not the gate policy (spec §3)
  provenance: Provenance[];
  pairedExamples: PairedExamples; // MANDATORY (grammar gate enforces)
}
