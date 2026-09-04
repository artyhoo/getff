// Neutral live-research → ConventionNode bridge — unit tests (live-generation LG-S1, Inc 1).
// Spec: docs/meta-factory/research-patches/2026-07-11-live-generation.md §0 Plane 3, §Qb, §Qc, §Qe.
//
// $0-in-CI: every input here is a committed in-source fixture — NEVER a live MCP/research call.
// Fixture-trap guard (Phase -1, live-confirmed on synthesizer/fixtures/rn-research-plan.json:24):
// every provenance record uses the REAL added Tier-0 KEY ('pyyaml' / 'python.official'), never a
// HOST mis-used as a key — else AC4 would reject for the wrong reason (unknown-key, not host-tier).

import { describe, expect, it } from 'vitest';
import { renderAstgrep, VALID_KINDS } from '../backends/astgrep/render-astgrep.ts';
import { runGrammarGate } from '../ir/gates/grammar.ts';
import type { ConventionNode } from '../ir/types.ts';
import { validateProvenance } from '../research/allowlist.ts';
import {
  EXPRESSIBLE_KINDS,
  isSinglePatternExpressible,
  researchedPracticeToNode,
  type AstgrepResearchedPractice,
  type ResearchToNodeResult,
} from './research-to-node.ts';

// ── Fixtures (committed, in-source) ─────────────────────────────────────────────

/** AC1/AC2 flagship — getff-no-yaml-load (§Qe, probe-proven @ast-grep/cli@0.44.1). Single literal
 *  call-kind ban, provenance from a python Tier-0 host (PyYAML's own docs). */
const YAML_LOAD_PRACTICE: AstgrepResearchedPractice = {
  entryId: 'getff-no-yaml-load',
  title: 'Do not use yaml.load(); it can execute arbitrary Python — use yaml.safe_load()',
  stack: ['python'],
  kind: 'call',
  presence: 'forbid',
  pattern: 'yaml.load($$$ARGS)',
  replacement: 'yaml.safe_load($$$ARGS)',
  examples: {
    bad: 'import yaml\ndata = yaml.load(raw)',
    good: 'import yaml\ndata = yaml.safe_load(raw)',
  },
  provenance: [
    {
      url: 'https://pyyaml.org/wiki/PyYAMLDocumentation',
      allowlistKey: 'pyyaml', // REAL added Tier-0 key — NOT the host 'pyyaml.org' mis-used as a key
      fetchedAt: '2026-07-11T00:00:00.000Z',
    },
  ],
};

/** AC3 — a practice that does NOT reduce to a single literal call/attribute/import pattern
 *  (mutable-default-arg needs a structural def-match; §Qb ceiling, §Qe non-match). Its provenance
 *  is VALID on purpose, so the ONLY reason it must drop is inexpressibility — not a provenance miss.
 *  Because the node it WOULD build passes the grammar gate (params.kind is schema-unconstrained),
 *  disabling the MAJOR-1 filter emits a real inert node → the `status==='research-only'` assertion
 *  goes RED. That is the non-vacuity guard (see the RED-before-GREEN note in the report). */
const MUTABLE_DEFAULT_PRACTICE: AstgrepResearchedPractice = {
  entryId: 'getff-no-mutable-default-arg',
  title: 'Do not use a mutable default argument; it is shared across every call',
  stack: ['python'],
  kind: 'structural', // NOT call/attribute/import — outside the frozen-IR ceiling
  presence: 'forbid',
  pattern: 'def $F($$$A, $P=[], $$$B):\n    $$$BODY', // multiline structural, inexpressible as a single literal
  examples: {
    bad: 'def f(x, items=[]):\n    items.append(x)',
    good: 'def f(x, items=None):\n    items = items if items is not None else []',
  },
  provenance: [
    {
      url: 'https://docs.python.org/3/reference/compound_stmts.html',
      allowlistKey: 'python.official',
      fetchedAt: '2026-07-11T00:00:00.000Z',
    },
  ],
};

/** AC3 second shape — a bare-except practice a researcher could not reduce to a literal pattern at
 *  all (pattern absent). Also a research-only finding. */
const BARE_EXCEPT_PRACTICE: AstgrepResearchedPractice = {
  entryId: 'getff-no-bare-except',
  title: 'Do not use a bare `except:`; catch a specific exception type',
  stack: ['python'],
  kind: 'call',
  presence: 'forbid',
  // pattern intentionally absent — the researcher could not express it as a single literal.
  examples: {
    bad: 'try:\n    f()\nexcept:\n    pass',
    good: 'try:\n    f()\nexcept ValueError:\n    pass',
  },
  provenance: [
    {
      url: 'https://docs.python.org/3/tutorial/errors.html',
      allowlistKey: 'python.official',
      fetchedAt: '2026-07-11T00:00:00.000Z',
    },
  ],
};

/** AC4 — EXPRESSIBLE (call-kind forbid ban) but its provenance host is NOT a Tier-0 source. The
 *  allowlistKey is a KNOWN key ('python.official'), so the reject is a HOST-tier reject (FF2006),
 *  NOT an unknown-key (FF2005) or schema failure (the Phase -1 trap). */
const UNTRUSTED_HOST_PRACTICE: AstgrepResearchedPractice = {
  entryId: 'getff-no-eval-blogsourced',
  title: 'Do not use eval(); it executes arbitrary code',
  stack: ['python'],
  kind: 'call',
  presence: 'forbid',
  pattern: 'eval($$$ARGS)',
  examples: {
    bad: 'result = eval(user_input)',
    good: 'result = int(user_input)',
  },
  provenance: [
    {
      url: 'https://evil.example.com/blog/python-tips',
      allowlistKey: 'python.official', // KNOWN key ⇒ NOT an unknown-key failure; the HOST is the miss
      fetchedAt: '2026-07-11T00:00:00.000Z',
    },
  ],
};

/** FIX 2 — the third honesty line (reason:'gate-failed'). EXPRESSIBLE (call-kind forbid ban) AND its
 *  provenance is a valid python Tier-0 host, so it clears BOTH earlier gates — but its paired examples
 *  are degenerate (bad === good), so the built node trips the grammar gate's FF6001 (degenerate-pair).
 *  Non-vacuous: the same practice with distinct examples becomes a node (asserted below), which
 *  isolates the degenerate pair — not something else about the fixture — as the gate-failed cause. */
const DEGENERATE_PAIR_PRACTICE: AstgrepResearchedPractice = {
  entryId: 'getff-degenerate-pair',
  title: 'Do not use yaml.load(); use yaml.safe_load()',
  stack: ['python'],
  kind: 'call',
  presence: 'forbid',
  pattern: 'yaml.load($$$ARGS)',
  examples: {
    bad: 'import yaml\ndata = yaml.load(raw)',
    good: 'import yaml\ndata = yaml.load(raw)', // IDENTICAL to bad ⇒ FF6001 degenerate-pair
  },
  provenance: [
    {
      url: 'https://pyyaml.org/wiki/PyYAMLDocumentation',
      allowlistKey: 'pyyaml',
      fetchedAt: '2026-07-11T00:00:00.000Z',
    },
  ],
};

/** Collect the node array a caller would render from a bridge result (empty for research-only). */
function nodesOf(result: ResearchToNodeResult): ConventionNode[] {
  return result.status === 'node' ? [result.node] : [];
}

// ── AC1: positive — valid practice → valid ConventionNode (two distinct checks) ──

describe('AC1 — researched practice → valid ConventionNode', () => {
  it('getff-no-yaml-load → a node (not a research-only finding)', () => {
    const result = researchedPracticeToNode(YAML_LOAD_PRACTICE);
    expect(result.status).toBe('node');
  });

  it('AC1(a) — the produced node PASSES the IR grammar gate (shape)', () => {
    const result = researchedPracticeToNode(YAML_LOAD_PRACTICE);
    if (result.status !== 'node') throw new Error(`expected a node, got ${result.status}`);
    // Independent re-run of the grammar gate on the returned node (unrelated to provenance).
    expect(runGrammarGate([result.node]).status).toBe('pass');
    // Backbone projection is correct (id/claim/params/pairedExamples), frozen IR — no field added.
    expect(result.node.id).toBe('getff-no-yaml-load');
    expect(result.node.selectorClass).toBe('syntax');
    expect(result.node.params['kind']).toBe('call');
    expect(result.node.params['pattern']).toBe('yaml.load($$$ARGS)');
    expect(result.node.pairedExamples.negative).toBe(YAML_LOAD_PRACTICE.examples.bad);
    expect(result.node.pairedExamples.positive).toBe(YAML_LOAD_PRACTICE.examples.good);
  });

  it('AC1(b) — the node provenance RESOLVES via the bridge’s validateProvenance call (host-tier)', () => {
    const result = researchedPracticeToNode(YAML_LOAD_PRACTICE);
    if (result.status !== 'node') throw new Error(`expected a node, got ${result.status}`);
    // The SAME resolver the bridge calls internally resolves the node's provenance to a trusted src.
    for (const p of result.node.provenance) {
      expect(validateProvenance(p).ok).toBe(true);
    }
  });
});

// ── AC2: the node renders to an ast-grep rule with the expected pattern ──────────

describe('AC2 — node → renderAstgrep yields rule.pattern yaml.load($$$ARGS)', () => {
  it('the rendered YAML carries pattern: "yaml.load($$$ARGS)"', () => {
    const result = researchedPracticeToNode(YAML_LOAD_PRACTICE);
    if (result.status !== 'node') throw new Error(`expected a node, got ${result.status}`);
    const { yaml, outcomes } = renderAstgrep([result.node]);
    expect(yaml).toContain('pattern: "yaml.load($$$ARGS)"');
    expect(yaml).toContain('id: "getff-no-yaml-load"');
    expect(yaml).toContain('language: python');
    // The node is genuinely RENDERED (not refused).
    expect(outcomes.get('getff-no-yaml-load')?.kind).toBe('rendered');
  });
});

// ── AC3: MAJOR-1 non-vacuous — inexpressible practice → research-only, NO node/rule ──

describe('AC3 — non-single-pattern-expressible → research-only finding (degrade-not-inert)', () => {
  it('mutable-default-arg (kind outside call/attribute/import) → research-only, NO node', () => {
    const result = researchedPracticeToNode(MUTABLE_DEFAULT_PRACTICE);
    // The load-bearing non-vacuity assertion: if an inert node were emitted this is 'node' → RED.
    expect(result.status).toBe('research-only');
    if (result.status !== 'research-only') throw new Error('unreachable');
    expect(result.reason).toBe('not-expressible');
    // And NO rendered rule: the caller renders zero nodes → header-only YAML, no rule document.
    const { yaml } = renderAstgrep(nodesOf(result));
    expect(yaml).not.toContain('rule:');
    expect(yaml).not.toContain('pattern:');
  });

  it('bare-except (no literal pattern at all) → research-only, NO node', () => {
    const result = researchedPracticeToNode(BARE_EXCEPT_PRACTICE);
    expect(result.status).toBe('research-only');
    expect(nodesOf(result)).toHaveLength(0);
  });

  it('the filter itself is honest: expressibility predicate is false for both drops', () => {
    expect(isSinglePatternExpressible(MUTABLE_DEFAULT_PRACTICE)).toBe(false);
    expect(isSinglePatternExpressible(BARE_EXCEPT_PRACTICE)).toBe(false);
    // …and true for the flagship, so AC1's node is not a filter accident.
    expect(isSinglePatternExpressible(YAML_LOAD_PRACTICE)).toBe(true);
  });
});

// ── AC4: provenance gate non-vacuous — untrusted host → host-tier reject, no node ──

describe('AC4 — untrusted-host provenance → REJECTED by the bridge resolver (host-tier)', () => {
  it('expressible practice with a non-Tier-0 host → research-only, provenance-rejected, NO node', () => {
    // Pre-condition: the practice IS expressible, so the drop is provenance — not §Qb.
    expect(isSinglePatternExpressible(UNTRUSTED_HOST_PRACTICE)).toBe(true);

    const result = researchedPracticeToNode(UNTRUSTED_HOST_PRACTICE);
    expect(result.status).toBe('research-only');
    if (result.status !== 'research-only') throw new Error('unreachable');
    expect(result.reason).toBe('provenance-rejected');
    expect(nodesOf(result)).toHaveLength(0);

    // The reject is a HOST-tier reject (FF2006 wording), NOT an unknown-key (FF2005) or schema fail.
    expect(result.detail).toContain('not allowed under key');
    expect(result.detail).not.toContain('unknown allowlistKey');
  });

  it('the resolver isolates the HOST as the cause: the key itself is valid Tier-0', () => {
    // Same known key, but a host that DOES belong to it → resolves ok. Proves AC4's reject is the
    // host, not the key (an unknown-key would fail this positive control too).
    expect(
      validateProvenance({
        url: 'https://docs.python.org/3/library/functions.html',
        allowlistKey: 'python.official',
        fetchedAt: '2026-07-11T00:00:00.000Z',
      }).ok,
    ).toBe(true);
    // And the untrusted-host record fails via the same resolver the bridge calls.
    const v = validateProvenance(UNTRUSTED_HOST_PRACTICE.provenance[0]!);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('evil.example.com');
  });

  it('a practice with NO provenance is fail-closed (never a silently-trusted node)', () => {
    const result = researchedPracticeToNode({ ...YAML_LOAD_PRACTICE, provenance: [] });
    expect(result.status).toBe('research-only');
    if (result.status !== 'research-only') throw new Error('unreachable');
    expect(result.reason).toBe('provenance-rejected');
  });
});

// ── FIX 2: the THIRD degrade path — gate-failed (built node fails the IR grammar gate) ──────────

describe('gate-failed — expressible + trusted provenance, but the built node fails the grammar gate', () => {
  it('degenerate paired examples (bad === good) → research-only, reason gate-failed, FF6001 in detail', () => {
    // Pre-conditions: it clears BOTH earlier gates, so the ONLY reason left is the grammar gate.
    expect(isSinglePatternExpressible(DEGENERATE_PAIR_PRACTICE)).toBe(true);
    expect(validateProvenance(DEGENERATE_PAIR_PRACTICE.provenance[0]!).ok).toBe(true);

    const result = researchedPracticeToNode(DEGENERATE_PAIR_PRACTICE);
    expect(result.status).toBe('research-only');
    if (result.status !== 'research-only') throw new Error('unreachable');
    expect(result.reason).toBe('gate-failed');
    // The detail carries the grammar-gate diagnostic that fired (FF6001 degenerate-pair), proving
    // the degrade is the grammar gate, not the expressibility or provenance line.
    expect(result.detail).toContain('FF6001');
    expect(nodesOf(result)).toHaveLength(0);
  });

  it('non-vacuity: the SAME practice with distinct examples becomes a node (isolates the pair)', () => {
    const withDistinctPair: AstgrepResearchedPractice = {
      ...DEGENERATE_PAIR_PRACTICE,
      examples: { bad: 'yaml.load(raw)', good: 'yaml.safe_load(raw)' },
    };
    expect(researchedPracticeToNode(withDistinctPair).status).toBe('node');
  });
});

// ── FIX 3: drift guard — EXPRESSIBLE_KINDS (bridge) must set-equal VALID_KINDS (renderer) ────────

describe('drift guard — the bridge ceiling set-equals the renderer accepted kinds', () => {
  it('EXPRESSIBLE_KINDS === VALID_KINDS as sets (a kind added to one but not the other = FF7002 drift)', () => {
    // If a kind is added to the bridge's EXPRESSIBLE_KINDS but not the renderer's VALID_KINDS, the
    // node BUILDS then renderAstgrep refuses it FF7002 (a silent node→refusal gap). Pin set-equality
    // so that drift fails HERE at assert time, at the earliest reachable channel, not at render time.
    expect(new Set(EXPRESSIBLE_KINDS)).toEqual(new Set(VALID_KINDS));
  });
});
