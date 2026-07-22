// Enrichment sidecar (per-backend rule-test material) — unit tests.
// Umbrella: rule-tests-surface S2 (spec docs/superpowers/specs/2026-07-21-rule-tests-surface-design.md
// Part I §3 enrichment sidecar + §2 naming-inversion footgun).
//
// The sidecar is the astgrep/ruff/cargo home for `ruleId → { bad: string[], good: string[] }`
// (multiple bad[] = bypass variants, mirroring npm's negative-test.input[]). This unit test covers
// the PURE half: seed-from-node (with the naming inversion) + parse/validate (loud on malformed).
// The FIRING half (bad[] fires / good[] clean, single-rule isolation) lives under backends/astgrep/
// where CI installs the pinned ast-grep — see backends/astgrep/rule-tests-sidecar-firing.test.ts.
//
// NAMING-INVERSION guard (spec §2, to-node.ts:112-114): the node speaks positive/negative, the
// sidecar speaks good/bad. Seeding maps bad ← negative (the VIOLATING sample), good ← positive (the
// CLEAN sample). The seed assertion below is ASYMMETRIC on a known fixture (bad carries `yaml.load(`,
// good carries `safe_load`) — a symmetric "both are strings" assertion would pass a silent swap.

import { describe, expect, it } from 'vitest';
import type { ConventionNode } from '../ir/types.ts';
import {
  parseRuleTestsSidecar,
  seedRuleTestsSidecar,
  validateRuleTestsSidecar,
  type RuleTestsSidecar,
} from './rule-tests-sidecar.ts';

// A minimal ConventionNode carrying the getff-researched-no-yaml-load paired examples — the exact
// inversion the committed practice record encodes (pairedExamples.negative = the yaml.load call;
// pairedExamples.positive = the yaml.safe_load call).
const YAML_LOAD_NODE: ConventionNode = {
  id: 'getff-researched-no-yaml-load',
  claim: 'Do not use yaml.load(); it can execute arbitrary Python — use yaml.safe_load()',
  anchors: [],
  selectorClass: 'syntax',
  params: {},
  defaultSeverity: 'error',
  provenance: [],
  pairedExamples: {
    negative: 'import yaml\ndata = yaml.load(raw)',
    positive: 'import yaml\ndata = yaml.safe_load(raw)',
  },
};

describe('seedRuleTestsSidecar — seed from the node with the good/bad ↔ positive/negative inversion', () => {
  it('maps bad ← pairedExamples.negative and good ← pairedExamples.positive (ASYMMETRIC, catches a swap)', () => {
    const sidecar = seedRuleTestsSidecar([YAML_LOAD_NODE]);

    // The seeded entry exists under the node id (the id ast-grep reports as $.ruleId).
    expect(Object.keys(sidecar)).toEqual(['getff-researched-no-yaml-load']);
    const samples = sidecar['getff-researched-no-yaml-load'];
    expect(samples).toBeDefined();

    // ASYMMETRIC assertions — the load-bearing anti-swap check. bad[] must carry the VIOLATING
    // construct; good[] must carry the SAFE replacement. If seeding swapped negative/positive, the
    // clean sample would sit in bad[] (and fire RED as "should violate" in the firing test) while
    // the violation sat in good[] (and pass as "should be clean") — exactly the inversion §2 warns of.
    expect(samples?.bad).toEqual(['import yaml\ndata = yaml.load(raw)']);
    expect(samples?.bad[0]).toContain('yaml.load(');
    expect(samples?.bad[0]).not.toContain('safe_load');
    expect(samples?.good).toEqual(['import yaml\ndata = yaml.safe_load(raw)']);
    expect(samples?.good[0]).toContain('safe_load');
    expect(samples?.good[0]).not.toContain('yaml.load(');
  });

  it('seeds one entry per node, single-element bad[]/good[] (the write/repair act appends variants later)', () => {
    const second: ConventionNode = {
      ...YAML_LOAD_NODE,
      id: 'getff-other',
      pairedExamples: { negative: 'BAD_TWO', positive: 'GOOD_TWO' },
    };
    const sidecar = seedRuleTestsSidecar([YAML_LOAD_NODE, second]);
    expect(Object.keys(sidecar).sort()).toEqual(['getff-other', 'getff-researched-no-yaml-load']);
    expect(sidecar['getff-other']).toEqual({ bad: ['BAD_TWO'], good: ['GOOD_TWO'] });
  });
});

describe('parseRuleTestsSidecar / validateRuleTestsSidecar — loud on malformed', () => {
  it('accepts a well-formed sidecar (round-trips the shape)', () => {
    const raw = JSON.stringify({
      'getff-researched-no-yaml-load': {
        bad: ['import yaml\ndata = yaml.load(raw)'],
        good: ['import yaml\ndata = yaml.safe_load(raw)'],
      },
    } satisfies RuleTestsSidecar);
    const parsed = parseRuleTestsSidecar(raw, 'test');
    expect(parsed['getff-researched-no-yaml-load']?.bad).toHaveLength(1);
    expect(parsed['getff-researched-no-yaml-load']?.good).toHaveLength(1);
  });

  it('THROWS on non-JSON input', () => {
    expect(() => parseRuleTestsSidecar('{ not json', 'test')).toThrow(/not valid JSON/);
  });

  it('THROWS when the top level is not an object (array)', () => {
    expect(() => validateRuleTestsSidecar([], 'test')).toThrow(/must be an object keyed by ruleId/);
  });

  it('THROWS when an entry is missing good[]', () => {
    expect(() =>
      validateRuleTestsSidecar({ 'r-1': { bad: ['x'] } }, 'test'),
    ).toThrow(/"good"/);
  });

  it('THROWS when bad[] is empty (a rule-test with no violating sample proves nothing)', () => {
    expect(() =>
      validateRuleTestsSidecar({ 'r-1': { bad: [], good: ['ok'] } }, 'test'),
    ).toThrow(/"bad".*non-empty|non-empty.*"bad"/);
  });

  it('THROWS when a sample is not a string', () => {
    expect(() =>
      validateRuleTestsSidecar({ 'r-1': { bad: [42], good: ['ok'] } }, 'test'),
    ).toThrow(/must be a non-empty string/);
  });

  it('THROWS on an unexpected key inside an entry (catches a badd/goood typo → silent data loss)', () => {
    expect(() =>
      validateRuleTestsSidecar({ 'r-1': { bad: ['x'], good: ['ok'], badd: ['y'] } }, 'test'),
    ).toThrow(/unexpected key/);
  });
});
