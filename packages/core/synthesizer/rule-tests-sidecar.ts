// Enrichment sidecar — per-backend rule-test material store (rule-tests-surface S2).
// Spec: docs/superpowers/specs/2026-07-21-rule-tests-surface-design.md Part I §3 (enrichment
// sidecar) + §2 (single-rule isolation + the naming inversion). Protocol: agents/rule-test-author.md.
//
// WHAT THIS IS: the astgrep/ruff/cargo home for a rule's firing TEST MATERIAL — the bad/good code
// samples the deterministic factory needs to prove a rule fires — formalized as one map file per
// backend: `ruleId → { bad: string[], good: string[] }`. Multiple bad[] entries are BYPASS VARIANTS
// (obfuscated forms that must still trip the rule), mirroring npm's `negative-test.input[]`
// (synthesizer/types.ts). good[] = conforming samples that must stay clean. The npm lane keeps its
// own manifest home (negative-test); the sidecar is the NON-npm store only (spec §2/§3).
//
// WHY A SIDEBAND FILE, NOT AN IR FIELD (no IR change — spec §3 "adding no IR change";
// ir/types.ts:3-6 sanctions only the one optional `relational` field): the pattern already exists
// twice — to-node.ts:184-185 declares negative-test/fixture/liveness-mode/pressure-scenario "pure
// enrichment, never in the node" (merged around the frozen IR by mergeEnrichment), and the committed
// getff-researched-no-yaml-load.practice.json carries examples{bad,good} OUTSIDE the node. This
// module formalizes exactly that: test material lives BESIDE the frozen node, never inside it.
//
// CONSUMER HOME (data-plane, regenerable): `.ai-factory/rule-tests/<backend>.json` — consumer-owned,
// regenerable from the node's pairedExamples at generation time, then hand-repaired by the write-half
// protocol (agents/rule-test-author.md). NOT under `.getff/` (framework-owned; _py_copy_or_refresh
// clobbers on re-run — evidence risk, spec §3 Home).
//
// FRAMEWORK-OWN HOME (committed): in the framework repo `.ai-factory/` is gitignored (.gitignore:42,
// no rule-tests exemption), so the framework's OWN sidecar instances CANNOT live there. They are
// committed with the live-generation fixtures under
// packages/core/synthesizer/fixtures/live-generation/rule-tests/<backend>.json — the same committed-
// path precedent render-researched-astgrep.ts:53-55 (LIVE_GEN_DIR) uses for the rendered artifacts
// the samples fire against.
//
// NAMING-INVERSION FOOTGUN (spec §2; to-node.ts:112-114): the node speaks positive/negative, the
// sidecar speaks good/bad. Seeding maps bad ← the VIOLATING sample (pairedExamples.negative),
// good ← the CLEAN sample (pairedExamples.positive). A silent swap here would put the clean sample in
// bad[] (firing RED where it should be clean) and the violation in good[] — so the seed unit test
// asserts ASYMMETRICALLY on the known fixture (rule-tests-sidecar.test.ts).

import { readFileSync } from 'node:fs';
import type { ConventionNode } from '../ir/types.ts';

/** The bad/good code samples for one rule. Multiple `bad[]` entries = bypass variants (obfuscated
 *  violations that must still fire); `good[]` = conforming samples that must stay clean. */
export interface RuleTestSamples {
  /** Violating samples — every one MUST fire the rule (single-rule isolation). Non-empty. */
  bad: string[];
  /** Conforming samples — every one MUST stay clean (zero findings for this rule). */
  good: string[];
}

/** One backend's sidecar: a map keyed by the rule id the tool reports (astgrep $.ruleId). */
export type RuleTestsSidecar = Record<string, RuleTestSamples>;

/**
 * Seed a sidecar from the nodes' MANDATORY `pairedExamples` (ir/types.ts:86). Maps the naming
 * inversion correctly: `bad ← node.pairedExamples.negative` (the violating sample), `good ←
 * node.pairedExamples.positive` (the clean sample). One single-element bad[]/good[] per node; the
 * write/repair act (agents/rule-test-author.md) appends further bad[] bypass variants afterwards.
 * PURE — no fs, no network.
 */
export function seedRuleTestsSidecar(nodes: ConventionNode[]): RuleTestsSidecar {
  const sidecar: RuleTestsSidecar = {};
  for (const node of nodes) {
    sidecar[node.id] = {
      // INVERSION (spec §2): sidecar bad ← node NEGATIVE; sidecar good ← node POSITIVE.
      bad: [node.pairedExamples.negative],
      good: [node.pairedExamples.positive],
    };
  }
  return sidecar;
}

/** Validate a string[] field of the sidecar shape — non-empty array of non-empty strings. */
function assertSampleArray(value: unknown, ruleId: string, field: 'bad' | 'good', label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`rule-tests sidecar ${label}: entry "${ruleId}" field "${field}" must be an array of code samples`);
  }
  if (value.length === 0) {
    // Paired-negative discipline at the loader boundary: no violating sample = nothing fires;
    // no clean counter-sample = no proof the rule does not over-fire. Loud, not silent.
    const why = field === 'bad' ? 'no violating sample = nothing fires' : 'no clean counter-sample = over-firing unproven';
    throw new Error(`rule-tests sidecar ${label}: entry "${ruleId}" field "${field}" must be a non-empty array (${why})`);
  }
  for (const sample of value) {
    if (typeof sample !== 'string' || sample.length === 0) {
      throw new Error(`rule-tests sidecar ${label}: entry "${ruleId}" field "${field}" each sample must be a non-empty string`);
    }
  }
  return value as string[];
}

/**
 * Validate an already-parsed value against the sidecar shape and return it typed. Throws LOUDLY with
 * a `label`-prefixed message on ANY malformation (top level not an object, entry not an object,
 * missing/empty bad[], missing good[], non-string sample, or an unexpected key inside an entry —
 * a `badd`/`goood` typo that would silently drop material). `label` is the file path or a caller tag.
 */
export function validateRuleTestsSidecar(value: unknown, label = '<sidecar>'): RuleTestsSidecar {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`rule-tests sidecar ${label}: top level must be an object keyed by ruleId`);
  }
  const out: RuleTestsSidecar = {};
  for (const [ruleId, rawSamples] of Object.entries(value as Record<string, unknown>)) {
    if (typeof rawSamples !== 'object' || rawSamples === null || Array.isArray(rawSamples)) {
      throw new Error(`rule-tests sidecar ${label}: entry "${ruleId}" must be an object { bad: string[], good: string[] }`);
    }
    const entry = rawSamples as Record<string, unknown>;
    for (const key of Object.keys(entry)) {
      if (key !== 'bad' && key !== 'good') {
        throw new Error(`rule-tests sidecar ${label}: entry "${ruleId}" has an unexpected key "${key}" (only "bad" and "good" are allowed)`);
      }
    }
    if (!('bad' in entry)) {
      throw new Error(`rule-tests sidecar ${label}: entry "${ruleId}" is missing "bad"`);
    }
    if (!('good' in entry)) {
      throw new Error(`rule-tests sidecar ${label}: entry "${ruleId}" is missing "good"`);
    }
    out[ruleId] = {
      bad: assertSampleArray(entry['bad'], ruleId, 'bad', label),
      good: assertSampleArray(entry['good'], ruleId, 'good', label),
    };
  }
  return out;
}

/** Parse a sidecar from a JSON string + shape-check. Throws LOUDLY on invalid JSON or bad shape. */
export function parseRuleTestsSidecar(raw: string, label = '<sidecar>'): RuleTestsSidecar {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`rule-tests sidecar ${label}: not valid JSON — ${(e as Error).message}`);
  }
  return validateRuleTestsSidecar(parsed, label);
}

/** Load + parse + shape-check a committed sidecar file. Throws LOUDLY on read/parse/shape failure. */
export function loadRuleTestsSidecar(absPath: string): RuleTestsSidecar {
  return parseRuleTestsSidecar(readFileSync(absPath, 'utf8'), absPath);
}
