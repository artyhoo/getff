// Rust live-research → ConventionNode bridge (clippy backend) — unit tests (live-generation LG-S3, Inc 1).
// Spec: docs/meta-factory/research-patches/2026-07-11-live-generation.md §Qb, §Qc, §Qf/LG-S3.
//
// $0-in-CI: every input here is a committed in-source fixture — NEVER a live MCP/research call. The
// flagship is loaded from the committed durable fixture (fixtures/live-generation/rust/mem-forget.practice.json).
// Fixture-trap guard (Phase -1, mirrors the astgrep lane): every provenance record uses the REAL added
// rust Tier-0 KEY ('rust.official' / 'clippy'), never a HOST mis-used as a key — else AC4 would reject
// for the wrong reason (unknown-key, not host-tier).
//
// CROSS-OWNER: renderCargoClippy is IMPORTED read-only from backends/cargo (#977-owned). This test does
// NOT edit any backends/cargo/** file — it consumes the ADOPTED renderer to prove the authored node renders.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderCargoClippy } from '../backends/cargo/render-clippy.ts';
import { runGrammarGate } from '../ir/gates/grammar.ts';
import type { ConventionNode } from '../ir/types.ts';
import { validateProvenance } from '../research/allowlist.ts';
import {
  CLIPPY_EXPRESSIBLE_KINDS,
  isClippyExpressible,
  researchedPracticeToClippyNode,
  type ClippyResearchedPractice,
  type ResearchToNodeResult,
} from './research-to-clippy-node.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Fixtures ────────────────────────────────────────────────────────────────────

/** AC1/AC2 flagship — mem-forget, loaded from the committed durable fixture (LIVE-RESEARCHED, §Qc).
 *  Single FQ path-ban of kind 'method', provenance from two rust Tier-0 hosts (rust.official + clippy).
 *  Loading it here proves the committed fixture is exercised (not dead) and renders through the ADOPTED
 *  renderer. */
const MEM_FORGET_PRACTICE = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/live-generation/rust/mem-forget.practice.json'), 'utf8'),
) as ClippyResearchedPractice;

/** AC3 — a practice that does NOT reduce to a single method/type/macro path-ban: a per-impl trait-method
 *  ban (kind outside the frozen-IR ceiling; render-clippy's known bound, render-clippy.ts:16-19). Its
 *  provenance is VALID on purpose, so the ONLY reason it must drop is inexpressibility — not a provenance
 *  miss. Because the node it WOULD build passes the grammar gate (params.kind is schema-unconstrained),
 *  disabling the MAJOR-1 filter emits a real inert node → the `status==='research-only'` assertion goes
 *  RED. That is the non-vacuity guard (see the RED-before-GREEN note in the report). */
const TRAIT_IMPL_BAN_PRACTICE: ClippyResearchedPractice = {
  entryId: 'no-custom-drop-on-copy',
  title: 'Do not implement Drop for a Copy type via this trait impl',
  stack: ['rust'],
  kind: 'trait-impl', // NOT method/type/macro — outside the frozen-IR clippy ceiling
  presence: 'forbid',
  path: 'mycrate::MyType as Drop', // not a single disallowed-methods FQ path clippy can express
  examples: {
    bad: 'impl Drop for MyCopyType { fn drop(&mut self) {} }',
    good: '// remove the Drop impl; a Copy type must not implement Drop',
  },
  provenance: [
    {
      url: 'https://doc.rust-lang.org/std/ops/trait.Drop.html',
      allowlistKey: 'rust.official',
      fetchedAt: '2026-07-13T00:00:00.000Z',
    },
  ],
};

/** AC3 second shape — a practice a researcher could not reduce to a literal FQ path at all
 *  (path absent). Also a research-only finding. */
const NO_PATH_PRACTICE: ClippyResearchedPractice = {
  entryId: 'no-unbounded-recursion',
  title: 'Avoid unbounded recursion; add a depth guard',
  stack: ['rust'],
  kind: 'method',
  presence: 'forbid',
  // path intentionally absent — the researcher could not express it as a single FQ path.
  examples: {
    bad: 'fn f(n: u64) -> u64 { f(n + 1) }',
    good: 'fn f(n: u64, depth: u32) -> u64 { if depth == 0 { return 0; } f(n + 1, depth - 1) }',
  },
  provenance: [
    {
      url: 'https://doc.rust-lang.org/reference/expressions/call-expr.html',
      allowlistKey: 'rust.official',
      fetchedAt: '2026-07-13T00:00:00.000Z',
    },
  ],
};

/** AC4 — EXPRESSIBLE (method-kind forbid path-ban) but its provenance host is NOT a Tier-0 source. The
 *  allowlistKey is a KNOWN key ('rust.official'), so the reject is a HOST-tier reject (FF2006), NOT an
 *  unknown-key (FF2005) or schema failure (the Phase -1 trap). */
const UNTRUSTED_HOST_PRACTICE: ClippyResearchedPractice = {
  entryId: 'no-transmute-blogsourced',
  title: 'Do not use std::mem::transmute; it is wildly unsafe',
  stack: ['rust'],
  kind: 'method',
  presence: 'forbid',
  path: 'std::mem::transmute',
  examples: {
    bad: 'let x: u32 = unsafe { std::mem::transmute(1.0f32) };',
    good: 'let x: u32 = 1.0f32.to_bits();',
  },
  provenance: [
    {
      url: 'https://evil.example.com/blog/rust-tips',
      allowlistKey: 'rust.official', // KNOWN key ⇒ NOT an unknown-key failure; the HOST is the miss
      fetchedAt: '2026-07-13T00:00:00.000Z',
    },
  ],
};

/** The third honesty line (reason:'gate-failed'). EXPRESSIBLE (method-kind forbid ban) AND its
 *  provenance is a valid rust Tier-0 host, so it clears BOTH earlier gates — but its paired examples
 *  are degenerate (bad === good), so the built node trips the grammar gate's FF6001 (degenerate-pair). */
const DEGENERATE_PAIR_PRACTICE: ClippyResearchedPractice = {
  entryId: 'degenerate-pair',
  title: 'Do not use std::mem::forget; drop explicitly',
  stack: ['rust'],
  kind: 'method',
  presence: 'forbid',
  path: 'std::mem::forget',
  examples: {
    bad: 'std::mem::forget(f);',
    good: 'std::mem::forget(f);', // IDENTICAL to bad ⇒ FF6001 degenerate-pair
  },
  provenance: [
    {
      url: 'https://doc.rust-lang.org/std/mem/fn.forget.html',
      allowlistKey: 'rust.official',
      fetchedAt: '2026-07-13T00:00:00.000Z',
    },
  ],
};

/** Collect the node array a caller would render from a bridge result (empty for research-only). */
function nodesOf(result: ResearchToNodeResult): ConventionNode[] {
  return result.status === 'node' ? [result.node] : [];
}

// ── AC1: positive — valid practice → valid ConventionNode that RENDERS ────────────

describe('AC1 — rust flagship practice → valid ConventionNode (renders, not refused)', () => {
  it('mem-forget → a node (not a research-only finding)', () => {
    const result = researchedPracticeToClippyNode(MEM_FORGET_PRACTICE);
    expect(result.status).toBe('node');
  });

  it('AC1(a) — the produced node PASSES the IR grammar gate + carries the clippy render contract', () => {
    const result = researchedPracticeToClippyNode(MEM_FORGET_PRACTICE);
    if (result.status !== 'node') throw new Error(`expected a node, got ${result.status}`);
    // Independent re-run of the grammar gate on the returned node (unrelated to provenance).
    expect(runGrammarGate([result.node]).status).toBe('pass');
    // Backbone projection is correct + the Phase-1 clippy render contract (frozen IR — no field added).
    expect(result.node.id).toBe('mem-forget');
    expect(result.node.selectorClass).toBe('type-aware'); // NOT 'syntax' (that FF7001-refuses)
    expect(result.node.params['kind']).toBe('method');
    expect(result.node.params['path']).toBe('std::mem::forget'); // NOT astgrep's `pattern`
    expect(result.node.defaultSeverity).toBe('warning'); // NOT 'error' (that FF7003-degrades)
    expect(result.node.pairedExamples.negative).toBe(MEM_FORGET_PRACTICE.examples.bad);
    expect(result.node.pairedExamples.positive).toBe(MEM_FORGET_PRACTICE.examples.good);
  });

  it('AC1(b) — the node provenance RESOLVES via the bridge’s validateProvenance call (rust Tier-0)', () => {
    const result = researchedPracticeToClippyNode(MEM_FORGET_PRACTICE);
    if (result.status !== 'node') throw new Error(`expected a node, got ${result.status}`);
    // The SAME resolver the bridge calls internally resolves both provenance records (rust.official + clippy).
    for (const p of result.node.provenance) {
      expect(validateProvenance(p).ok).toBe(true);
    }
  });

  it('AC1(c) — the node RENDERS through the ADOPTED renderCargoClippy (kind:"rendered", not refused/degraded)', () => {
    const result = researchedPracticeToClippyNode(MEM_FORGET_PRACTICE);
    if (result.status !== 'node') throw new Error(`expected a node, got ${result.status}`);
    const { outcomes } = renderCargoClippy([result.node]);
    // warning severity ⇒ rendered (render-clippy.ts:119). NOT refused FF7001 (would be 'syntax'), NOT
    // refused FF7002 (off-contract params), NOT degraded FF7003 (error/note severity).
    expect(outcomes.get('mem-forget')?.kind).toBe('rendered');
  });
});

// ── AC2: the node renders into a clippy.toml disallowed-methods entry ──────────────

describe('AC2 — node → renderCargoClippy yields the expected clippy.toml entry', () => {
  it('the rendered TOML carries the mem-forget disallowed-methods ban', () => {
    const result = researchedPracticeToClippyNode(MEM_FORGET_PRACTICE);
    if (result.status !== 'node') throw new Error(`expected a node, got ${result.status}`);
    const { toml } = renderCargoClippy([result.node]);
    expect(toml).toContain('disallowed-methods = [');
    expect(toml).toContain('path = "std::mem::forget"');
    // reason is ALWAYS node.claim (render-clippy.ts:112).
    expect(toml).toContain('reason = "Do not use std::mem::forget()');
  });
});

// ── AC3: MAJOR-1 non-vacuous — inexpressible practice → research-only, NO node/entry ──

describe('AC3 — non-clippy-expressible → research-only finding (degrade-not-inert)', () => {
  it('trait-impl ban (kind outside method/type/macro) → research-only, NO node, NO clippy entry', () => {
    const result = researchedPracticeToClippyNode(TRAIT_IMPL_BAN_PRACTICE);
    // The load-bearing non-vacuity assertion: if an inert node were emitted this is 'node' → RED.
    expect(result.status).toBe('research-only');
    if (result.status !== 'research-only') throw new Error('unreachable');
    expect(result.reason).toBe('not-expressible');
    // And NO clippy entry: the caller renders zero nodes → header-only TOML, no disallowed table.
    const { toml, outcomes } = renderCargoClippy(nodesOf(result));
    expect(toml).not.toContain('disallowed-methods');
    expect(toml).not.toContain('mycrate::MyType');
    expect(outcomes.size).toBe(0);
  });

  it('no-path practice (no literal FQ path at all) → research-only, NO node', () => {
    const result = researchedPracticeToClippyNode(NO_PATH_PRACTICE);
    expect(result.status).toBe('research-only');
    expect(nodesOf(result)).toHaveLength(0);
  });

  it('the filter itself is honest: expressibility predicate is false for both drops, true for flagship', () => {
    expect(isClippyExpressible(TRAIT_IMPL_BAN_PRACTICE)).toBe(false);
    expect(isClippyExpressible(NO_PATH_PRACTICE)).toBe(false);
    // …and true for the flagship, so AC1's node is not a filter accident.
    expect(isClippyExpressible(MEM_FORGET_PRACTICE)).toBe(true);
  });
});

// ── AC4: provenance gate non-vacuous — untrusted host → host-tier reject, no node ──

describe('AC4 — untrusted-host provenance → REJECTED by the bridge resolver (host-tier)', () => {
  it('expressible practice with a non-Tier-0 host → research-only, provenance-rejected, NO node', () => {
    // Pre-condition: the practice IS expressible, so the drop is provenance — not §Qb.
    expect(isClippyExpressible(UNTRUSTED_HOST_PRACTICE)).toBe(true);

    const result = researchedPracticeToClippyNode(UNTRUSTED_HOST_PRACTICE);
    expect(result.status).toBe('research-only');
    if (result.status !== 'research-only') throw new Error('unreachable');
    expect(result.reason).toBe('provenance-rejected');
    expect(nodesOf(result)).toHaveLength(0);

    // The reject is a HOST-tier reject (FF2006 wording), NOT an unknown-key (FF2005) or schema fail.
    expect(result.detail).toContain('not allowed under key');
    expect(result.detail).not.toContain('unknown allowlistKey');
  });

  it('the resolver isolates the HOST as the cause: the key itself is valid rust Tier-0', () => {
    // Same known key, but a host that DOES belong to it → resolves ok. Proves AC4's reject is the
    // host, not the key (an unknown-key would fail this positive control too).
    expect(
      validateProvenance({
        url: 'https://doc.rust-lang.org/std/mem/fn.forget.html',
        allowlistKey: 'rust.official',
        fetchedAt: '2026-07-13T00:00:00.000Z',
      }).ok,
    ).toBe(true);
    // And the untrusted-host record fails via the same resolver the bridge calls.
    const v = validateProvenance(UNTRUSTED_HOST_PRACTICE.provenance[0]!);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('evil.example.com');
  });

  it('a practice with NO provenance is fail-closed (never a silently-trusted node)', () => {
    const result = researchedPracticeToClippyNode({ ...MEM_FORGET_PRACTICE, provenance: [] });
    expect(result.status).toBe('research-only');
    if (result.status !== 'research-only') throw new Error('unreachable');
    expect(result.reason).toBe('provenance-rejected');
  });
});

// ── The THIRD degrade path — gate-failed (built node fails the IR grammar gate) ────

describe('gate-failed — expressible + trusted provenance, but the built node fails the grammar gate', () => {
  it('degenerate paired examples (bad === good) → research-only, reason gate-failed, FF6001 in detail', () => {
    // Pre-conditions: it clears BOTH earlier gates, so the ONLY reason left is the grammar gate.
    expect(isClippyExpressible(DEGENERATE_PAIR_PRACTICE)).toBe(true);
    expect(validateProvenance(DEGENERATE_PAIR_PRACTICE.provenance[0]!).ok).toBe(true);

    const result = researchedPracticeToClippyNode(DEGENERATE_PAIR_PRACTICE);
    expect(result.status).toBe('research-only');
    if (result.status !== 'research-only') throw new Error('unreachable');
    expect(result.reason).toBe('gate-failed');
    expect(result.detail).toContain('FF6001');
    expect(nodesOf(result)).toHaveLength(0);
  });

  it('non-vacuity: the SAME practice with distinct examples becomes a node (isolates the pair)', () => {
    const withDistinctPair: ClippyResearchedPractice = {
      ...DEGENERATE_PAIR_PRACTICE,
      examples: { bad: 'std::mem::forget(f);', good: 'drop(f);' },
    };
    expect(researchedPracticeToClippyNode(withDistinctPair).status).toBe('node');
  });
});

// ── Ceiling constant honesty (drift-parity GAP is documented, not silent) ─────────

describe('CLIPPY_EXPRESSIBLE_KINDS — the frozen-IR ceiling constant', () => {
  it('is exactly {method, type, macro} (kept in lockstep with render-clippy.ts:40 VALID_KINDS by hand)', () => {
    // render-clippy.ts:40 does NOT export VALID_KINDS (exporting it = a backends/cargo/** boundary
    // violation, #977-owned), so set-equality cannot be asserted mechanically here — the drift-parity
    // test is a DOCUMENTED GAP (a cross-owner handoff request), not a silently-dropped honesty line.
    // This pin at least fails HERE if THIS constant drifts from the contract it mirrors.
    expect(new Set(CLIPPY_EXPRESSIBLE_KINDS)).toEqual(new Set(['method', 'type', 'macro']));
  });
});
