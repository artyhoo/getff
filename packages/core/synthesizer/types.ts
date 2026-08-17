// Layer 3 Synthesizer (Path A) public types.
// SynthesizedRule shape is intentionally aligned with manifest's RuleEntry
// (rules-manifest.schema.json#/definitions/RuleEntry) so generated rules
// validate identically to manually authored ones — Phase 5 retro Q1 reuse.

import type { Provenance, Tier } from '../research/types.ts';

export type ManifestCheck =
  | { type: 'eslint'; rule: string }
  | { type: 'command'; command: string }
  | { type: 'script'; script: string }
  | { type: 'manual'; rationale?: string }
  | {
      type: 'declarative';
      engine?: 'eslint-restricted' | 'ast-grep';
      selector: string;
      messageId?: string;
      message?: string;
      presence: 'forbid' | 'require';
    };

export interface NegativeTest {
  /** One or more code snippets — each must produce the expected violation (bypass variants). */
  input: string[];
  'expect-violation': string;
}

export interface Fixture {
  'setup-script': string;
  'cleanup-script'?: string;
  cwd?: string;
}

/**
 * Optional override for the cmd/script guard-liveness mode (v1.5). The mode is
 * DERIVED from check.type by default (command → run-and-assert, script →
 * resolve-and-run); this field overrides it for the exceptions:
 *   - "run"             force run-and-assert (a script that is directly runnable)
 *   - "workflow-exists" liveness = the named CI workflow exists + references jobs
 *   - "config-presence" liveness = the rule's required config exists in the repo
 *   - "exempt"          no runnable form — excluded from the gate + fixture-required flip
 */
export type LivenessModeOverride = 'run' | 'workflow-exists' | 'config-presence' | 'exempt';

export type PressureType = 'time' | 'authority' | 'sunk-cost' | 'scope-creep';

export interface PressureScenario {
  'baseline-prompt': string;
  'observable-failure': string;
  'observable-compliance': string;
  pressure: PressureType[];
}

export interface SynthesizedRule {
  id: string;
  title: string;
  stack: string[];
  'applies-to'?: string[];
  check: ManifestCheck;
  /**
   * `safeForms` (optional): KNOWN-SAFE forms of the forbidden construct the rule must NOT
   * fire on (e.g. `Object.prototype.hasOwnProperty.call(o, k)` for a hasOwnProperty ban,
   * `x == null` for a loose-equality ban). Unlike `good`, safeForms are NOT constrained by
   * gate-single-token-diff — they carry the multi-token safe idioms that gate structurally
   * excludes from `good`. Each is verified violation-free by L4 gate 2 (FF3021). GH #915 obs 4.
   */
  examples: { bad: string; good: string; safeForms?: string[] };
  'negative-test'?: NegativeTest;
  fixture?: Fixture;
  'liveness-mode'?: LivenessModeOverride;
  'pressure-scenario'?: PressureScenario;
  research: { entryId: string; provenance: Provenance[]; tier?: Tier };
}

export interface SynthesisPlan {
  framework: string | null;
  version: string | null;
  rules: SynthesizedRule[];
  rulesMd: string;
  eslintConfigSnippet: string;
}
