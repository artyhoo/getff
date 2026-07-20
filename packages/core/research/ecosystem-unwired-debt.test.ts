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
// Detection idiom (git-aware, mirrors ecosystem-adapter-precondition.test.ts):
//   1. Enumerate adapter impl files via `git ls-files` + the typed-const regex.
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
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..'); // research → core → packages → root

/** Tracked non-test TypeScript sources under packages/core/research (git-aware,
 *  reaches committed sources identically in CI and locally). */
function trackedResearchSources(): string[] {
  const out = execFileSync('git', ['ls-files', '-z', 'packages/core/research/*.ts'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return out
    .split('\0')
    .filter(Boolean)
    .filter((rel) => !rel.endsWith('.test.ts'))
    .map((rel) => resolve(REPO_ROOT, rel));
}

/** Files declaring an `EcosystemAdapter` value — the seam's concrete impls
 *  (the typed-const idiom npm/cargo/python use). */
function adapterImplFiles(): { file: string; symbol: string }[] {
  const out: { file: string; symbol: string }[] = [];
  const RE = /export\s+const\s+([A-Za-z0-9_]+)\s*:\s*EcosystemAdapter\s*=/;
  for (const f of trackedResearchSources()) {
    const m = RE.exec(readFileSync(f, 'utf8'));
    if (m) out.push({ file: f, symbol: m[1]! });
  }
  return out;
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
  // wiring change: LG-S4 sets it to 2 (cargo + python unwired; npm wired).
  // A future wiring-umbrella DECREMENTS per wired adapter (2 → 1 → 0). Strict
  // equality catches BOTH silent growth (3 vs 2) AND silent partial-wiring
  // (1 vs 2 without a BASELINE edit).
  const BASELINE = 2;

  it('the number of unwired EcosystemAdapters equals BASELINE (strict — no silent debt drift)', () => {
    const impls = adapterImplFiles();
    const unwired = impls.filter((a) => !isWired(a.symbol));
    expect(
      { total: impls.length, unwired: unwired.length, unwiredSymbols: unwired.map((a) => a.symbol), BASELINE },
    ).toEqual({
      total: impls.length,
      unwired: BASELINE,
      unwiredSymbols: unwired.map((a) => a.symbol),
      BASELINE,
    });
  });

  it('detector sanity: npmAdapter is detected as WIRED (the baseline reference)', () => {
    expect(isWired('npmAdapter')).toBe(true);
  });

  it('detector sanity: cargoAdapter + pipAdapter are detected as UNWIRED', () => {
    expect(isWired('cargoAdapter')).toBe(false);
    expect(isWired('pipAdapter')).toBe(false);
  });
});
