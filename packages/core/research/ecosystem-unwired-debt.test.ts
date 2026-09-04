// Unwired-debt tripwire — the anti-forget mechanism for EcosystemAdapter wiring.
// LG-S4 (live-generation umbrella). Spec §6.
//
// An EcosystemAdapter that ships without a production caller threading it into a
// `ResolveCtx` is dead code that a future wiring-umbrella can silently forget.
// This tripwire counts the unwired adapters against a strict BASELINE literal:
// strict `===` makes BOTH failure modes RED — silent GROWTH (a new unwired
// adapter lands, count > BASELINE) AND silent PARTIAL-WIRING (an adapter is
// wired but BASELINE is not decremented, count < BASELINE).
//
// Detection idiom (git-aware; census machinery shared with
// ecosystem-adapter-precondition.test.ts via ./adapter-census.ts — one source of
// truth per regex; the earlier header claim that this file "mirrors" the
// precondition test was INACCURATE on regex breadth, the two private copies had
// diverged — narrow typed-const here vs five declaration forms there — which is
// exactly what arm H3 below now gates):
//   1. Enumerate adapter impl files via `git ls-files` + the NARROW typed-const
//      stamping idiom (ADAPTER_IDIOM_RE, spec §2 F5). Arm H3 proves the narrow
//      census loses nothing vs the broad impl census (set-equality both ways),
//      so this count cannot silently under-read an off-idiom adapter.
//   2. An adapter is WIRED iff its symbol appears in a ctx-adjacent form
//      (`adapter: <symbol>` object-literal OR `ctx.adapter = <symbol>` assignment)
//      in a non-test, non-adapter-decl production source. This catches all FIVE
//      ResolveCtx-accepting APIs uniformly (validateResearchPlan,
//      resolveAllowedSources, checkResearchPlan, runProvenanceGate,
//      runResearchValidation) — they all thread `adapter: <symbol>` through a
//      ResolveCtx literal, so the single textual form covers every path.
//
// Residual gap (documented, spec §6): an adapter wired via dynamic registration
// with no textual reference to the adapter symbol (`const a = adapters[i]; ctx =
// {adapter: a}`) evades the textual grep — the same residual the precondition
// test documents. Accepted; if a registry ever lands, add a registry-level
// assertion.
//
// Deterministic: git ls-files + git grep + readFileSync + regex. ZERO API-billed
// calls (no-paid-llm-in-ci).
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  censusDivergence,
  censusSource,
  trackedResearchSources,
  unwiredCount,
} from './adapter-census.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..'); // research → core → packages → root

/** Files matching the NARROW stamping idiom, with their adapter symbols — the
 *  unwired-debt census population (regex + enumeration shared via
 *  ./adapter-census.ts; arm H3 below proves this narrow census stays set-equal
 *  with the broad impl census, so no off-idiom adapter can escape this count). */
function adapterImplFiles(): { file: string; symbol: string }[] {
  return trackedResearchSources(REPO_ROOT)
    .map((f) => censusSource(f, readFileSync(f, 'utf8')))
    .filter((r) => r.idiom)
    .map((r) => ({ file: r.file, symbol: r.symbol! }));
}

/** An adapter is WIRED if its symbol appears in a `ResolveCtx` object-literal
 *  (`adapter: <symbol>`) or an assignment (`ctx.adapter = <symbol>`) in a
 *  non-test, non-adapter-decl production source. Narrowing step: `git grep -l`
 *  for the symbol restricts the read set to files that mention it at all; the
 *  ctx-adjacent regexes then discriminate a real wiring from a mere comment or
 *  import. Adapter decl files (`research/ecosystem-*.ts`) are excluded — an
 *  adapter's own module is not a wiring site. */
function isWired(symbol: string): boolean {
  let files: string[];
  try {
    files = execFileSync('git', ['grep', '-l', '-e', symbol, '--', 'packages/core'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
  } catch {
    // git grep exits 1 when the symbol appears nowhere — impossible for a real
    // adapter (its own decl mentions it), but fail-closed to "not wired".
    return false;
  }
  return files
    .filter((rel) => rel.endsWith('.ts') && !rel.endsWith('.test.ts'))
    .filter((rel) => !rel.includes('/research/ecosystem-')) // the adapter's own decl file
    .some((rel) => {
      const text = readFileSync(join(REPO_ROOT, rel), 'utf8');
      return (
        new RegExp(`adapter\\s*:\\s*${symbol}\\b`).test(text) ||
        new RegExp(`\\.adapter\\s*=\\s*${symbol}\\b`).test(text)
      );
    });
}

describe('unwired-debt tripwire (spec §6)', () => {
  // BASELINE = current count of unwired adapters. Edited in-lockstep with any
  // wiring change: LG-S4 set it to 2 (cargo + python unwired; npm wired).
  // ecosystem-wiring W2 DECREMENTED it to 0 — pipAdapter AND cargoAdapter are
  // both threaded into the production ResolveCtx by resolveCtxForRoot
  // (synthesizer/resolve-ctx.ts), consumed at synthesizer/cli.ts +
  // synthesizer/file-clients.ts (both non-JS adapters wired TOGETHER, T-EW-A).
  // Strict equality still catches BOTH silent growth (a new unwired adapter:
  // 1 vs 0) AND silent partial-wiring (an adapter unwired again without a
  // BASELINE edit).
  const BASELINE = 0;

  // @arm:H1:pos baseline-debt-lockstep (GREEN path: the live census count equals
  // BASELINE under strict === — spec §3.8 H1; executed W2 decremented 2→0 in the
  // wiring commit. The count flows through the SAME pure seam — unwiredCount —
  // that the paired RED-proof below exercises.)
  it('the number of unwired EcosystemAdapters equals BASELINE (strict — no silent debt drift)', () => {
    const impls = adapterImplFiles();
    const unwired = impls.filter((a) => !isWired(a.symbol));
    expect(
      unwiredCount(impls, isWired),
      `Unwired-adapter count drift: ${unwired.length} unwired (symbols: ${unwired
        .map((a) => a.symbol)
        .join(', ')}) vs BASELINE ${BASELINE}. If you WIRED an adapter, DECREMENT BASELINE here; ` +
        `if you ADDED an adapter, the wiring-umbrella must wire it (or bump BASELINE with rationale).`,
    ).toBe(BASELINE);
  });

  // @arm:H1:neg baseline-debt-lockstep (RED-proof at the jig's paired granularity:
  // a debt-carrying population mismatches BASELINE through the SAME count seam the
  // positive arm uses — lockstep RED on debt re-growth / partial wiring. The
  // vacuous inverse `expect(unwired.length).not.toBe(BASELINE + 1)` is REJECTED —
  // it cannot fail (recon group H). This pair CAN fail: unwiredCount breaking
  // (returning 0 on a debt population) or BASELINE drifting to 1 flips it.)
  it('RED-proof: a debt-carrying population (one unwired adapter) mismatches BASELINE via the same count seam', () => {
    const ghostPopulation = [{ symbol: 'ghostAdapter' }];
    const neverWired = (): boolean => false;
    // The seam actually counts the debt (0 here would mean the helper broke)…
    expect(unwiredCount(ghostPopulation, neverWired)).toBe(1);
    // …and the lockstep discriminates: this population does NOT satisfy the gate
    // (RED-proof run, violating form `.toBe(BASELINE)`: "expected 1 to be +0").
    expect(unwiredCount(ghostPopulation, neverWired)).not.toBe(BASELINE);
  });

  it('detector sanity: all four shipped adapters are detected as WIRED (post-J3)', () => {
    expect(isWired('npmAdapter')).toBe(true);
    expect(isWired('cargoAdapter')).toBe(true);
    expect(isWired('pipAdapter')).toBe(true);
    expect(isWired('goAdapter')).toBe(true);
  });

  it('detector sanity: a non-existent symbol is detected as UNWIRED (false-branch guard)', () => {
    // With every real adapter now wired, this preserves coverage of isWired's
    // false branch — proving the detector still discriminates unwired symbols
    // (so a future adapter that lands unwired would be caught, not masked).
    expect(isWired('noSuchAdapter')).toBe(false);
  });
});

// Arm H3 — tripwire-population-equality (adapter-jig spec §3.8; co-located with H1
// per J2 decisions log #10: both arms guard the same census seam).
//
// The gate that turns spec §2 F5's "a stamped adapter MUST use the idiom verbatim"
// from prose into enforcement: the NARROW idiom census (this file's population,
// feeding the BASELINE lockstep above) and the BROAD impl census (the
// ecosystem-adapter-precondition.test.ts population, feeding the traversal-guard
// checks) must agree over the live tree — set-equal in BOTH directions. Before
// this arm NOTHING mechanical checked it, and the two private regex copies had
// already diverged in breadth: an off-idiom adapter (satisfies-form /
// implements-form / cast-form / factory-return-form) would be traversal-guard
// checked by the precondition suite yet NEVER counted against BASELINE — bypassing
// H1 with zero RED. Both regexes now live in ./adapter-census.ts (single source
// of truth); this arm pins their agreement.
describe('tripwire-population-equality (adapter-jig H3, spec §3.8)', () => {
  // @arm:H3:pos tripwire-population-equality (GREEN path: live-tree set-equality,
  // both directions empty; the three shipped adapters sit in BOTH populations —
  // population non-vacuous, growth-tolerant via arrayContaining)
  it('the narrow (idiom) and broad (impl) censuses agree over the live adapter population', () => {
    const rows = trackedResearchSources(REPO_ROOT).map((f) =>
      censusSource(f, readFileSync(f, 'utf8')),
    );
    const div = censusDivergence(rows);
    expect(
      div.implOnly,
      `Off-idiom EcosystemAdapter implementation(s) escaped the narrow census — they enter the ` +
        `precondition population but are NEVER counted against the unwired-debt BASELINE ` +
        `(H1 bypass with zero RED):\n  ${div.implOnly.join('\n  ')}\n` +
        `Spec §2 F5: a stamped adapter MUST use the typed-const idiom verbatim — rewrite the ` +
        `off-idiom declaration into the idiom (see ADAPTER_IDIOM_RE in adapter-census.ts); ` +
        `do NOT widen the narrow census to paper over it.`,
    ).toEqual([]);
    expect(
      div.idiomOnly,
      `Idiom-conforming adapter(s) NOT matched by the broad impl census — the broad regex ` +
        `regressed below the idiom (superset property broken):\n  ${div.idiomOnly.join('\n  ')}`,
    ).toEqual([]);
    const inBoth = rows.filter((r) => r.idiom && r.impl).map((r) => basename(r.file));
    expect(inBoth).toEqual(
      expect.arrayContaining(['ecosystem-npm.ts', 'ecosystem-cargo.ts', 'ecosystem-python.ts']),
    );
  });

  // @arm:H3:neg tripwire-population-equality (RED-proof, string-based BY DESIGN:
  // a real off-idiom fixture FILE would perturb H1's live count and sibling
  // research suites — recon group H. The off-idiom shape was probed empirically
  // pre-extraction: narrow=false, broad=true — the CONFIRMED live divergence this
  // arm was created to gate.)
  it('RED-proof: an off-idiom (satisfies-form) adapter source diverges the two censuses', () => {
    const ghost = censusSource(
      'ghost.ts',
      'export const ghostAdapter = {} satisfies EcosystemAdapter;\n',
    );
    // …it enters the broad (precondition) population…
    expect(ghost.impl).toBe(true);
    // …but escapes the narrow (unwired-debt) census entirely:
    expect(ghost.idiom).toBe(false);
    expect(ghost.symbol).toBeNull();
    // The equality gate catches exactly this: set-difference non-empty ⇒ the
    // positive arm above REDs on any population containing such a source
    // (RED-proof run, equality-gate form `.toEqual([])`:
    // "expected [ 'ghost.ts' ] to deeply equal []").
    expect(censusDivergence([ghost]).implOnly).toEqual(['ghost.ts']);

    // Paired GREEN control (non-vacuous): the idiom-conforming form sits in BOTH
    // populations and diverges nothing.
    const ok = censusSource('ok.ts', 'export const okAdapter: EcosystemAdapter = {};\n');
    expect(ok.impl).toBe(true);
    expect(ok.idiom).toBe(true);
    expect(ok.symbol).toBe('okAdapter');
    expect(censusDivergence([ok])).toEqual({ implOnly: [], idiomOnly: [] });
  });
});
