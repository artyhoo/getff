// synthesize.ts врезка — unit tests (MT umbrella S3b, PR-2).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §3, §4, §7.
//
// The врезка threads each composed SynthesizedRule through the IR plane:
//   build a ConventionNode -> runGrammarGate([node]) -> (declarative-syntax) npm adapter.
// These tests assert the plane behaviour AT the producer boundary. The BYTE-IDENTITY of the
// full synthesize() output is locked separately by tests/acceptance/canonical-regen* and
// synthesizer/snapshot.test.ts — this file exercises the врезка unit directly (N4 gate-in-flow,
// declarative round-trip byte-identity, non-declarative passthrough, gate-failure surfacing).

import { describe, expect, it } from 'vitest';
import { nodeToSynthesizedRule } from '../backends/npm/from-node.ts';
import type { Provenance } from '../research/types.ts';
import { buildNode, GrammarGateError, isSyntaxDeclarative, wireRuleThroughNode } from './to-node.ts';
import type { SynthesizedRule } from './types.ts';

const PROV: Provenance[] = [
  { url: 'https://nextjs.org/docs/app', allowlistKey: 'next.official', fetchedAt: '2026-05-08' },
];

// A declarative-syntax rule as the producer composes it (`{...recipe.rule, id, research}`).
// Mirrors next-r20-require-use-server-directive: check.message DIFFERS from the title (the
// enrichment field the node cannot carry) — the byte-identity trap this врезка must not lose.
const DECLARATIVE_RULE: SynthesizedRule = {
  title: "Server Action files must start with `'use server'` directive (R20)",
  stack: ['react-next'],
  'applies-to': ['src/app/**/*.ts', 'src/lib/actions/**/*.ts'],
  check: {
    type: 'declarative',
    engine: 'eslint-restricted',
    selector: "Program:not(...) ExportNamedDeclaration > FunctionDeclaration[async=true]",
    message: "Server Action file must start with 'use server' directive at the top of the file (R20).",
    presence: 'require',
  },
  examples: {
    bad: 'export async function action() { return 1; }',
    good: "'use server';\nexport async function action() { return 1; }",
  },
  'negative-test': {
    input: ['export async function action() { return 1; }'],
    'expect-violation': 'rules-as-tests/restricted-syntax-audit-exempt',
  },
  id: 'G3',
  research: { entryId: 'next-r20-require-use-server-directive', provenance: PROV },
};

// A non-declarative (eslint) rule — mirrors next-r12-no-server-imports-in-client.
const ESLINT_RULE: SynthesizedRule = {
  title: "Forbid server-only imports in `'use client'` files (R12)",
  stack: ['react-next'],
  'applies-to': ['src/**/*.tsx'],
  check: { type: 'eslint', rule: 'rules-as-tests/no-server-imports-in-client' },
  examples: {
    bad: "'use client';\nimport fs from 'fs';\nexport const x = 1;",
    good: "'use client';\nimport { useState } from 'react';\nexport function C() { return null; }",
  },
  'negative-test': {
    input: ["'use client';\nimport fs from 'fs';\nexport const x = 1;"],
    'expect-violation': 'rules-as-tests/no-server-imports-in-client',
  },
  id: 'G1',
  research: { entryId: 'next-r12-no-server-imports-in-client', provenance: PROV },
};

// A manual rule — mirrors nextjs-pages-router (no selector, no engine).
const MANUAL_RULE: SynthesizedRule = {
  title: 'Migrate `pages/` to `app/` before upgrading to Next 16',
  stack: ['react-next'],
  'applies-to': ['pages/**/*.{ts,tsx,js,jsx}'],
  check: { type: 'manual', rationale: 'Next.js 16 removed the Pages Router.' },
  examples: { bad: 'pages/index.tsx exists', good: 'app/page.tsx migrated' },
  id: 'G3',
  research: { entryId: 'nextjs-pages-router', provenance: PROV },
};

describe('isSyntaxDeclarative — routing predicate', () => {
  it('declarative + eslint-restricted engine -> syntax class (routes through adapter)', () => {
    expect(isSyntaxDeclarative(DECLARATIVE_RULE.check)).toBe(true);
  });
  it('declarative with no engine -> still syntax (engine defaults to eslint-restricted)', () => {
    expect(isSyntaxDeclarative({ type: 'declarative', selector: 'X', presence: 'forbid' })).toBe(true);
  });
  it('eslint check -> NOT syntax (adapter is not defined for it)', () => {
    expect(isSyntaxDeclarative(ESLINT_RULE.check)).toBe(false);
  });
  it('manual check -> NOT syntax', () => {
    expect(isSyntaxDeclarative(MANUAL_RULE.check)).toBe(false);
  });
});

describe('buildNode — projects the convention backbone only (enrichment stays out)', () => {
  it('maps id<-entryId, claim<-title, examples->pairedExamples (good->positive, bad->negative)', () => {
    const node = buildNode(DECLARATIVE_RULE, DECLARATIVE_RULE.research.entryId, PROV);
    expect(node.id).toBe('next-r20-require-use-server-directive'); // entryId, NOT G3
    expect(node.claim).toBe(DECLARATIVE_RULE.title);
    expect(node.pairedExamples.positive).toBe(DECLARATIVE_RULE.examples.good);
    expect(node.pairedExamples.negative).toBe(DECLARATIVE_RULE.examples.bad);
    expect(node.provenance).toEqual(PROV);
  });
  it('declarative rule -> syntax node carrying params.selector + presence', () => {
    // Narrow the check union once so the selector is a plain string literal in the assertion.
    if (DECLARATIVE_RULE.check.type !== 'declarative') throw new Error('fixture must be declarative');
    const node = buildNode(DECLARATIVE_RULE, 'x', PROV);
    expect(node.selectorClass).toBe('syntax');
    expect(node.params['selector']).toBe(DECLARATIVE_RULE.check.selector);
    expect(node.params['presence']).toBe('require');
  });
  it('non-declarative rule -> non-syntax node with empty params (still gate-able)', () => {
    const node = buildNode(ESLINT_RULE, 'x', PROV);
    expect(node.selectorClass).not.toBe('syntax');
    expect(node.params).toEqual({});
  });
  it('does NOT leak enrichment into the node (no negative-test / applies-to / stack fields)', () => {
    const node = buildNode(DECLARATIVE_RULE, 'x', PROV);
    expect(node).not.toHaveProperty('negative-test');
    expect(node).not.toHaveProperty('applies-to');
    expect(node).not.toHaveProperty('stack');
  });
});

describe('wireRuleThroughNode — врезка is byte-identical (the T-3B-A lock, unit-level)', () => {
  it('a declarative-syntax rule round-trips through node+gate+adapter byte-identical', () => {
    const out = wireRuleThroughNode(DECLARATIVE_RULE);
    // Deep-equal: every field survives — including check.message (differs from title) and
    // the negative-test enrichment the node cannot carry.
    expect(out).toEqual(DECLARATIVE_RULE);
  });

  // BYTE-EXACT, ORDER-SENSITIVE lock (review BLOCKER-1). `toEqual` above is order-INSENSITIVE
  // and did NOT catch that the adapter's `{id,...}`-first order + a trailing enrichment spread
  // reordered keys for declarative rules (id hoisted to front; negative-test appended after
  // research). This is the order-sensitive lock the врезка's byte-identity contract actually
  // needs — canonical-regen's presetSimilarity metric is order-insensitive and does NOT byte-lock.
  it('declarative rule: JSON.stringify(out) === JSON.stringify(input) — byte-exact, key-order preserved', () => {
    const out = wireRuleThroughNode(DECLARATIVE_RULE);
    expect(JSON.stringify(out)).toBe(JSON.stringify(DECLARATIVE_RULE));
  });

  it('the differing check.message survives the врезка (adapter would overwrite it with claim)', () => {
    const out = wireRuleThroughNode(DECLARATIVE_RULE);
    if (out.check.type !== 'declarative') throw new Error('expected declarative');
    // If the adapter's check.message=claim leaked through, this would be the TITLE, not the message.
    expect(out.check.message).toBe(
      "Server Action file must start with 'use server' directive at the top of the file (R20).",
    );
    expect(out.check.message).not.toBe(out.title); // message and title are distinct fields
  });

  it('rule.id stays G3 (the adapter would use node.id = entryId) — enrichment merge restores it', () => {
    const out = wireRuleThroughNode(DECLARATIVE_RULE);
    expect(out.id).toBe('G3');
    expect(out.research.entryId).toBe('next-r20-require-use-server-directive');
  });

  it('a non-declarative (eslint) rule passes the gate and is returned unchanged', () => {
    const out = wireRuleThroughNode(ESLINT_RULE);
    expect(out).toEqual(ESLINT_RULE);
  });

  // BYTE-EXACT lock for the non-syntax path too (review BLOCKER-1). Non-syntax returns the
  // rule object identity unchanged, so key order is trivially preserved — but pin it so a
  // future refactor that starts reconstructing the non-syntax output cannot silently reorder.
  it('non-declarative (eslint) rule: JSON.stringify(out) === JSON.stringify(input) — byte-exact', () => {
    const out = wireRuleThroughNode(ESLINT_RULE);
    expect(JSON.stringify(out)).toBe(JSON.stringify(ESLINT_RULE));
  });

  it('a manual rule passes the gate and is returned unchanged', () => {
    const out = wireRuleThroughNode(MANUAL_RULE);
    expect(out).toEqual(MANUAL_RULE);
  });
});

describe('wireRuleThroughNode — the adapter projection stays genuinely USED (not discarded)', () => {
  // The node backbone OWNS title (<- claim) and examples (<- pairedExamples). The byte-exact
  // output MUST take those fields from the adapter's projected output, so a broken adapter is
  // still caught. These tests prove the fields flow THROUGH the adapter: the врезка's title and
  // examples equal what nodeToSynthesizedRule projects from the node — NOT a passthrough copy of
  // the original. (Distortion coverage: if the adapter's title/examples projection is broken,
  // the byte-exact declarative lock above goes RED — verified live in the fix report.)
  it('the byte-exact output title equals the ADAPTER-projected title (node.claim), not a bypass copy', () => {
    const node = buildNode(DECLARATIVE_RULE, DECLARATIVE_RULE.research.entryId, PROV);
    const projected = nodeToSynthesizedRule(node, {
      stack: DECLARATIVE_RULE.stack,
      appliesTo: DECLARATIVE_RULE['applies-to'],
    });
    const out = wireRuleThroughNode(DECLARATIVE_RULE);
    // title + examples in the врезка output are the adapter's projection (claim/pairedExamples),
    // proving the projection is used, not discarded.
    expect(out.title).toBe(projected.title);
    expect(out.examples).toEqual(projected.examples);
    // …and the adapter genuinely projects them from the node backbone, not from the original rule.
    expect(projected.title).toBe(node.claim);
    expect(projected.examples.bad).toBe(node.pairedExamples.negative);
    expect(projected.examples.good).toBe(node.pairedExamples.positive);
  });

  it('the declarative check.selector/presence in the output come from the ADAPTER projection', () => {
    const node = buildNode(DECLARATIVE_RULE, DECLARATIVE_RULE.research.entryId, PROV);
    const projected = nodeToSynthesizedRule(node, { stack: DECLARATIVE_RULE.stack });
    const out = wireRuleThroughNode(DECLARATIVE_RULE);
    if (out.check.type !== 'declarative' || projected.check.type !== 'declarative') {
      throw new Error('expected declarative checks');
    }
    expect(out.check.selector).toBe(projected.check.selector);
    expect(out.check.presence).toBe(projected.check.presence);
  });
});

describe('wireRuleThroughNode — the grammar gate stands IN the flow (T15 / N4)', () => {
  it('surfaces a gate failure OUTWARD as a GrammarGateError (degenerate pairedExamples -> FF6001)', () => {
    // A rule whose bad === good is a degenerate pair — FF6001. The gate must catch it BEFORE
    // the adapter, and the врезка must NOT swallow it (brief §2: surfaces as a synthesis error).
    const degenerate: SynthesizedRule = {
      ...DECLARATIVE_RULE,
      examples: { bad: 'same();', good: 'same();' },
    };
    expect(() => wireRuleThroughNode(degenerate)).toThrow(GrammarGateError);
    try {
      wireRuleThroughNode(degenerate);
    } catch (e) {
      expect((e as GrammarGateError).diagnostics).toContain('FF6001');
    }
  });

  it('the gate runs BEFORE the adapter — a gate-failing node never reaches nodeToSynthesizedRule', () => {
    // Distinct-but-empty examples would break the schema (minLength 1) -> FF1001 shape failure.
    const emptyExample: SynthesizedRule = {
      ...DECLARATIVE_RULE,
      examples: { bad: '', good: 'x();' },
    };
    expect(() => wireRuleThroughNode(emptyExample)).toThrow(GrammarGateError);
    // Mirror the FF6001 sibling: assert the diagnostic carries the expected code, not just that
    // *a* GrammarGateError threw (MINOR-3). An empty example is an FF1001 shape failure.
    try {
      wireRuleThroughNode(emptyExample);
    } catch (e) {
      expect((e as GrammarGateError).diagnostics).toContain('FF1001');
    }
  });
});
