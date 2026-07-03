// npm-on-IR declarative backend — adapter unit tests (MT umbrella S3b, PR-1).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §4, §7.
//
// Covers the named negatives + positives from the stage-3b brief §5:
//   N1  node without params.selector          -> refused FF7002 (not a throw)
//   N2  node selectorClass 'type-aware'        -> refused FF7001 (npm matrix is honest)
//   N3  node with cargo-shaped params          -> refused FF7002 (backend contracts don't cross)
//   P1  canonical syntax node                  -> rendered + full SynthesizedRule mapping
//   P3  outcomes are total (assertEveryNodeResolved passes on any input)

import { describe, expect, it } from 'vitest';
import type { ConventionNode } from '../../ir/types.ts';
import { assertEveryNodeResolved } from '../cargo/render-outcome.ts';
import { nodeToSynthesizedRule, renderNpmDeclarative } from './from-node.ts';

// --- Canonical syntax node (brief P1): no-direct-process-env ----------------------------
const SYNTAX_NODE: ConventionNode = {
  id: 'no-direct-process-env',
  claim: 'Read configuration through a typed config module, never process.env directly',
  anchors: [],
  selectorClass: 'syntax',
  params: {
    selector: "MemberExpression[object.name='process'][property.name='env']",
    presence: 'forbid',
  },
  defaultSeverity: 'error',
  provenance: [],
  pairedExamples: {
    negative: 'const url = process.env.DATABASE_URL;',
    positive: 'const url = config.databaseUrl;',
  },
};

describe('renderNpmDeclarative — routing (brief §2 contract)', () => {
  it('N2: a type-aware node -> refused FF7001 (npm declarative cannot express typed rules)', () => {
    const node: ConventionNode = { ...SYNTAX_NODE, id: 'ta', selectorClass: 'type-aware' };
    const { outcomes } = renderNpmDeclarative([node]);
    const oc = outcomes.get('ta');
    expect(oc?.kind).toBe('refused');
    expect(oc?.kind === 'refused' && oc.code).toBe('FF7001');
  });

  it('a dep-graph node -> refused FF7001 (dependency-level bans are not a declarative-syntax class)', () => {
    const node: ConventionNode = { ...SYNTAX_NODE, id: 'dg', selectorClass: 'dep-graph' };
    const { outcomes } = renderNpmDeclarative([node]);
    const oc = outcomes.get('dg');
    expect(oc?.kind).toBe('refused');
    expect(oc?.kind === 'refused' && oc.code).toBe('FF7001');
  });

  it('N1: a syntax node WITHOUT params.selector -> refused FF7002 (not a throw)', () => {
    const node: ConventionNode = {
      ...SYNTAX_NODE,
      id: 'no-sel',
      params: { presence: 'forbid' }, // selector missing
    };
    let outcomes: ReturnType<typeof renderNpmDeclarative>['outcomes'];
    expect(() => {
      ({ outcomes } = renderNpmDeclarative([node]));
    }).not.toThrow();
    const oc = outcomes!.get('no-sel');
    expect(oc?.kind).toBe('refused');
    expect(oc?.kind === 'refused' && oc.code).toBe('FF7002');
  });

  it('a syntax node with an invalid presence -> refused FF7002', () => {
    const node: ConventionNode = {
      ...SYNTAX_NODE,
      id: 'bad-presence',
      params: { selector: 'X', presence: 'sometimes' },
    };
    const { outcomes } = renderNpmDeclarative([node]);
    const oc = outcomes.get('bad-presence');
    expect(oc?.kind).toBe('refused');
    expect(oc?.kind === 'refused' && oc.code).toBe('FF7002');
  });

  it('N3: a syntax node carrying cargo-shaped params ({kind,path}) -> refused FF7002 (contracts do not cross)', () => {
    const node: ConventionNode = {
      ...SYNTAX_NODE,
      id: 'cargo-shaped',
      params: { kind: 'method', path: 'std::env::var' },
    };
    const { outcomes } = renderNpmDeclarative([node]);
    const oc = outcomes.get('cargo-shaped');
    expect(oc?.kind).toBe('refused');
    expect(oc?.kind === 'refused' && oc.code).toBe('FF7002');
  });

  it('P1: a canonical syntax node -> rendered (surface 1 = the no-restricted-syntax config entry)', () => {
    const { outcomes, rules } = renderNpmDeclarative([SYNTAX_NODE]);
    const oc = outcomes.get('no-direct-process-env');
    expect(oc?.kind).toBe('rendered');
    // exactly one SynthesizedRule emitted for the rendered node
    expect(rules).toHaveLength(1);
    expect(rules[0]!.id).toBe('no-direct-process-env');
  });

  it('P3: outcomes are total — assertEveryNodeResolved passes on a mixed input (no silent drops)', () => {
    const nodes: ConventionNode[] = [
      SYNTAX_NODE,
      { ...SYNTAX_NODE, id: 'ta', selectorClass: 'type-aware' },
      { ...SYNTAX_NODE, id: 'dg', selectorClass: 'dep-graph' },
      { ...SYNTAX_NODE, id: 'no-sel', params: { presence: 'forbid' } },
    ];
    const { outcomes } = renderNpmDeclarative(nodes);
    expect(() =>
      assertEveryNodeResolved(
        nodes.map((n) => n.id),
        outcomes,
      ),
    ).not.toThrow();
    expect(outcomes.size).toBe(4);
  });

  it('P3b: an empty node list resolves to an empty (still-total) outcomes map', () => {
    const { outcomes, rules } = renderNpmDeclarative([]);
    expect(outcomes.size).toBe(0);
    expect(rules).toHaveLength(0);
  });
});

describe('nodeToSynthesizedRule — SynthesizedRule mapping (brief P1)', () => {
  it('maps id->id, claim->title, pairedExamples->examples (neg->bad, pos->good), provenance->research.provenance', () => {
    const provenance = [
      { url: 'https://example.test/doc', allowlistKey: 'example.test', fetchedAt: '2026-07-03T00:00:00Z' },
    ];
    const node: ConventionNode = { ...SYNTAX_NODE, provenance };
    const rule = nodeToSynthesizedRule(node, { stack: ['node'] });

    expect(rule.id).toBe('no-direct-process-env');
    expect(rule.title).toBe(node.claim);
    expect(rule.examples.bad).toBe(node.pairedExamples.negative);
    expect(rule.examples.good).toBe(node.pairedExamples.positive);
    expect(rule.research.provenance).toEqual(provenance);
    expect(rule.research.entryId).toBe(node.id);
  });

  it('emits a declarative eslint-restricted check carrying the node selector + presence', () => {
    const rule = nodeToSynthesizedRule(SYNTAX_NODE, { stack: ['node'] });
    expect(rule.check.type).toBe('declarative');
    if (rule.check.type !== 'declarative') throw new Error('expected declarative check');
    expect(rule.check.selector).toBe(SYNTAX_NODE.params['selector']);
    expect(rule.check.presence).toBe('forbid');
    expect(rule.check.message).toBe(node_claim());
  });

  it('carries enrichment.stack through onto the rule (enrichment is the 2nd arg, not projected into the node)', () => {
    const rule = nodeToSynthesizedRule(SYNTAX_NODE, { stack: ['node', 'typescript'] });
    expect(rule.stack).toEqual(['node', 'typescript']);
  });

  it('throws on a non-syntax node (mapping is only defined for a rendered syntax node)', () => {
    const node: ConventionNode = { ...SYNTAX_NODE, selectorClass: 'type-aware' };
    expect(() => nodeToSynthesizedRule(node, { stack: ['node'] })).toThrow();
  });
});

function node_claim(): string {
  return 'Read configuration through a typed config module, never process.env directly';
}
