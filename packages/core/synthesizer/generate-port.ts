// Stage 4 — injectable LLM port for the recipe-less generate-path (Path A).
// Unlike Stage-2 menu-pick, the client here supplies the full rule body
// (ruleId + eslintConfig + examples + negativeTest) — no recipe lookup needed.
// Our code assembles SynthesisPlan from the selection; the LLM never authors TS.
//
// Menu type reused from menu-pick-port.ts (same framework/version/candidates shape).
// In CI, inject stubGenerateRN / stubGenerateBad from generate-stubs.ts.
// At install-time (Stage 5), inject the live Anthropic adapter.

import type { Menu } from './menu-pick-port.ts';

export type { Menu, MenuCandidate } from './menu-pick-port.ts';

export interface GenerateCandidate {
  /** ResearchEntry.id this rule was derived from. */
  entryId: string;
  /** EXISTING ESLint rule id, e.g. 'no-restricted-globals' | 'no-restricted-imports'. Never an invented selector. */
  ruleId: string;
  title: string;
  stack: string[];
  /**
   * ESLint config for ruleId in the ['severity', options] tuple form required by mergeEslintRuleConfig.
   * Absent or empty → synthesizeGenerate emits check.type:'manual' (plugin rule not in L4 harness registry).
   */
  eslintConfig?: Record<string, unknown>;
  /**
   * `safeForms` (optional, RECOMMENDED for forbid-class candidates): known-safe forms of the
   * forbidden construct the selector must NOT match. gate-single-token-diff forces `good` to
   * differ from `bad` by ~1 token, so multi-token safe idioms (e.g.
   * `Object.prototype.hasOwnProperty.call(o, k)`, the `x == null` null-check idiom) can ONLY
   * be expressed here. L4 gate 2 verifies each is violation-free (FF3021) — an over-broad
   * selector that also matches a safe form fails the gate instead of shipping. GH #915 obs 4.
   */
  examples: { bad: string; good: string; safeForms?: string[] };
  /**
   * Required when eslintConfig is present — L4 gate-2 enforces presence at runtime for check.type:'eslint'.
   * Absent for manual-type rules. MANDATORY for forbid candidates — declarative needs it (gate-schema).
   */
  negativeTest?: { input: string[]; 'expect-violation': string };
  /**
   * Forbid-class signal (seam i-2). When presence:'forbid' AND selector are present,
   * synthesizeGenerate routes the candidate to check.type:'declarative' (executable L4 roundtrip)
   * instead of eslint/manual. The LLM MAY propose `selector` for this sub-class only — it is
   * validated executably by the declarative compiler + L4 roundtrip + anti-vacuity gates,
   * which is why relaxing the `ruleId` "never an invented selector" rule above is safe here.
   */
  presence?: 'forbid';
  selector?: string;
  message?: string;
  engine?: 'eslint-restricted' | 'ast-grep';
}

export interface GenerateSelection {
  rules: GenerateCandidate[];
}

export interface GenerateClient {
  generate(menu: Menu): Promise<GenerateSelection>;
}
