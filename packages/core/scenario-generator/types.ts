/**
 * Types for the pressure-scenario generator.
 *
 * Field names for PressureScenario match the manifest schema exactly
 * (packages/core/manifest/rules-manifest.schema.json) so the prober and
 * principle 02 can consume generated scenarios without any mapping.
 *
 * PressureType mirrors principle 02 line 462:
 *   type PressureType = 'time' | 'authority' | 'sunk-cost' | 'scope-creep';
 * Cross-ref: packages/core/principles/02-paired-negative-test.test.ts:490
 */

// ── Pressure vocabulary — single source (mirrors principle 02:462) ──────────

export type PressureType = 'time' | 'authority' | 'sunk-cost' | 'scope-creep';

// ── Pressure-scenario contract (mirrors manifest schema §pressure-scenario) ──

/**
 * The 4-field contract matching the manifest schema's `pressure-scenario` object.
 * Used both as the generator's output shape and as the store's persisted unit.
 */
export interface PressureScenario {
  /** The AI prompt that, WITHOUT the rule enforced, produces the failing behaviour. */
  'baseline-prompt': string;
  /** What the AI produces when the rule is NOT enforced (RED state). */
  'observable-failure': string;
  /** What the AI produces when the rule IS enforced (GREEN state). Must differ from observable-failure. */
  'observable-compliance': string;
  /** The forcing pressures applied — what tempts the shortcut over the rule. ≥1 required (T-V3-A). */
  pressure: PressureType[];
}

// ── Generated scenario — extends PressureScenario with provenance ────────────

/**
 * A validated generated scenario. `validated: true` is the sentinel that
 * store.ts checks before persisting — scenarios lacking this marker are refused
 * at the storage boundary (§6.3 NON-NEGOTIABLE reject-gate, defence in depth).
 */
export interface GeneratedScenario extends PressureScenario {
  /** Always true on a generator-emitted scenario; never set by hand. */
  validated: true;
  /** Verdict from the validation loop — always 'LIVE' when a scenario is emitted. */
  verdict: 'LIVE';
  /** Metadata from the generation run. */
  meta: GenerationMeta;
}

export interface GenerationMeta {
  /** ISO 8601 timestamp of generation. */
  generatedAt: string;
  /** Which rule policy text was used as input. */
  sourceRuleId: string;
  /** Number of Pass-1 RED attempts before a non-contaminated failing baseline was found. */
  redAttempts: number;
  /** Abbreviated Pass-1 output (first 500 chars) proving the RED state. */
  redOutputPreview: string;
  /** Abbreviated Pass-2 output (first 500 chars) proving the GREEN state. */
  greenOutputPreview: string;
}

// ── Generated scenarios file shape (.ai-factory/generated-scenarios.json) ────

/**
 * The on-disk shape of `.ai-factory/generated-scenarios.json`.
 * Top-level keyed by rule-id; each value is a GeneratedScenario.
 */
export interface GeneratedScenariosFile {
  /** Schema version — currently 1. */
  version: 1;
  /** Map of rule-id → validated generated scenario. */
  scenarios: Record<string, GeneratedScenario>;
}
