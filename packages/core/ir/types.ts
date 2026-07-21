// Convention IR — plane 2 of the Convention Compiler (MT umbrella S1).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §3 (node), §6 (vocabularies).
// Node fields: the 8 core fields are FIXED by spec §3. OWNER-FORK-1 (2026-07-21, ir-unfreeze
// umbrella) resolved UNFREEZE + Option B: exactly ONE additive OPTIONAL relational field is
// sanctioned (relational?: RelationalRule) — a scalar-only node stays a valid legacy instance.
// No OTHER field may be added (no capabilityTier/confidenceTier: v0.2 dropped them).

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

// --- Relational rule tree (OWNER-FORK-1 Option B, ir-unfreeze S1) ---
// ADAPT of ast-grep's own relational operators (`any`/`all`/`not`/`has`): a neutral,
// backend-agnostic condition tree the render backends translate into their native relational
// form (astgrep `rule:` YAML, eslint selector composition, …) or refuse per the existing
// selectorClass-refusal pattern (FF7001). NOT a verbatim ADOPT — the vocabulary is ast-grep's,
// the type-safe discriminated-union shape is ours (R-patch 2026-07-21-ir-unfreeze §1 Option B;
// prior-art-evaluations SSOT: relational IR = ADAPT of ast-grep any/all/not/has). The union is a
// recursive discriminated union on `op`; `switch (rule.op)` over the 4 arms is exhaustively
// checkable (assertNever in the default), giving the author-time guarantee.
export const RELATIONAL_OPS = ['not', 'has', 'all', 'any'] as const;
export type RelationalOp = (typeof RELATIONAL_OPS)[number];

// Leaf (the only pattern-bearing arm) — ADAPT of ast-grep `has`: the selected node HAS a
// descendant matching `pattern`, optionally constrained to AST `kind`. Carries NO children
// (kept a leaf — no speculative nesting beyond the measured require-via-ban need).
export interface RelationalHas {
  op: 'has';
  kind?: string;
  pattern: string;
}
// Negation — NONE of `children` match (NOR; single-child case = plain negation).
export interface RelationalNot {
  op: 'not';
  children: RelationalRule[];
}
// Conjunction — EVERY child matches.
export interface RelationalAll {
  op: 'all';
  children: RelationalRule[];
}
// Disjunction — AT LEAST ONE child matches.
export interface RelationalAny {
  op: 'any';
  children: RelationalRule[];
}

// Recursion is via `children: RelationalRule[]` on not/all/any, bottoming out at the `has`
// pattern leaf. The census's "require-via-ban" class renders as
// {op:'not', children:[{op:'has', pattern:'<return-annotation>'}]}. Interface declarations are
// hoisted, so the forward reference to RelationalRule from the arm interfaces compiles.
export type RelationalRule = RelationalHas | RelationalNot | RelationalAll | RelationalAny;

export interface ConventionNode {
  id: string;
  claim: string;
  anchors: string[]; // FF-code namespace only (^FF\d{4}$), resolvable into diagnostics REGISTRY; may be empty at v0
  selectorClass: CapabilityClass;
  params: Record<string, string | number>;
  relational?: RelationalRule; // OPTIONAL relational tree (Option B, additive-opt-in); absent on every legacy scalar node
  defaultSeverity: Severity; // a rendering detail, not the gate policy (spec §3)
  provenance: Provenance[];
  pairedExamples: PairedExamples; // MANDATORY (grammar gate enforces)
}
