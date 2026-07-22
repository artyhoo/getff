// Adapter-census SSOT — the single source of truth for the TWO regexes that census
// the EcosystemAdapter implementation population, plus the pure count/diff helpers
// the census suites share. Extracted by adapter-jig increment H (spec §3.8 H1+H3;
// J2 decisions log #10 — extraction fires exactly on the log's own condition: both
// regexes are needed in BOTH consuming suites once H3 gates their agreement).
//
// Why one module (the H3 retrofit finding, CONFIRMED live): before this file the
// NARROW census lived as a private const in ecosystem-unwired-debt.test.ts and the
// BROAD census as a private const in ecosystem-adapter-precondition.test.ts — two
// drifting copies whose matching breadth had ALREADY diverged (narrow = the
// typed-const stamping idiom only; broad = all five TS value-declaration forms).
// An adapter authored in an off-idiom form (satisfies-form / implements-form /
// cast-form / factory-return-form) entered the precondition population yet escaped
// the unwired-debt BASELINE lockstep with zero RED — silently bypassing arm H1.
// One module per regex kills the copy-drift channel; the H3 arm
// (tripwire-population-equality, co-located with H1 in
// ecosystem-unwired-debt.test.ts) asserts the two populations stay set-equal over
// the live tree — which is what turns spec §2 F5's "a stamped adapter MUST use
// the idiom verbatim" from prose into a gate.
//
// SELF-CENSUS CAUTION: this file is a non-test source under packages/core/research/
// and is therefore itself part of the population BOTH regexes scan. Comments here
// must never juxtapose a colon or a declaration keyword directly with the seam-type
// name in a regex-matchable form — the form names above are spelled hyphenated for
// exactly that reason.
//
// Deterministic: git ls-files + regex over source text. ZERO API-billed calls
// (no-paid-llm-in-ci).
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/** NARROW census — the spec §2 F5 stamping idiom, verbatim: an exported const
 *  whose explicit type annotation is the seam type. Capture group 1 = the adapter
 *  symbol (consumed by the unwired-debt wiring check). All three shipped adapters
 *  (npm / cargo / pip) use this exact form. */
export const ADAPTER_IDIOM_RE = /export\s+const\s+([A-Za-z0-9_]+)\s*:\s*EcosystemAdapter\s*=/;

/** BROAD census — every TS form that declares a VALUE of the seam type: the
 *  typed-const idiom above PLUS the satisfies-form, the implements-form, the
 *  cast-form, and the factory-return-form. The interface's own declaration and
 *  type-only annotation positions deliberately do NOT match — a declaration or an
 *  annotation is the seam, not an implementation of it. */
export const ADAPTER_IMPL_RE =
  /:\s*EcosystemAdapter\s*=|satisfies\s+EcosystemAdapter|\bimplements\s+EcosystemAdapter\b|\bas\s+EcosystemAdapter\b|\):\s*EcosystemAdapter\s*(?:\{|=>)/;

/** Tracked non-test TypeScript sources under packages/core/research — the shared
 *  census population (git-aware, reaches committed sources identically in CI and
 *  locally; previously duplicated verbatim in both consuming suites). Returns
 *  absolute paths. */
export function trackedResearchSources(repoRoot: string): string[] {
  const out = execFileSync('git', ['ls-files', '-z', 'packages/core/research/*.ts'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return out
    .split('\0')
    .filter(Boolean)
    .filter((rel) => !rel.endsWith('.test.ts'))
    .map((rel) => resolve(repoRoot, rel));
}

/** One source's census verdicts — pure over the source TEXT so the H3 RED-proof
 *  can feed synthetic strings (a real off-idiom fixture FILE would perturb the
 *  live unwired-debt count and sibling research suites; recon group H). */
export interface CensusRow {
  readonly file: string;
  /** Matches the NARROW stamping idiom (symbol captured below). */
  readonly idiom: boolean;
  /** Matches the BROAD value-declaration census. */
  readonly impl: boolean;
  /** The idiom's captured adapter symbol; null when `idiom` is false. */
  readonly symbol: string | null;
}

export function censusSource(file: string, source: string): CensusRow {
  const m = ADAPTER_IDIOM_RE.exec(source);
  return {
    file,
    idiom: m !== null,
    impl: ADAPTER_IMPL_RE.test(source),
    symbol: m ? m[1]! : null,
  };
}

/** H3 set-difference, BOTH directions (peer shape: principle 33's population
 *  parity). `implOnly` non-empty = an off-idiom adapter escaped the narrow census
 *  (the BASELINE-lockstep bypass); `idiomOnly` non-empty = the broad census
 *  regressed below the idiom (a regex edit broke the superset property). */
export interface CensusDivergence {
  readonly implOnly: string[];
  readonly idiomOnly: string[];
}

export function censusDivergence(rows: readonly CensusRow[]): CensusDivergence {
  return {
    implOnly: rows
      .filter((r) => r.impl && !r.idiom)
      .map((r) => r.file)
      .sort(),
    idiomOnly: rows
      .filter((r) => r.idiom && !r.impl)
      .map((r) => r.file)
      .sort(),
  };
}

/** The H1 count seam, pure: how many census'd adapters lack a wiring site. The
 *  injected `isWiredFn` lets the H1 RED-proof feed a synthetic debt-carrying
 *  population through the SAME seam the live BASELINE gate uses. */
export function unwiredCount(
  impls: ReadonlyArray<{ readonly symbol: string }>,
  isWiredFn: (symbol: string) => boolean,
): number {
  return impls.filter((a) => !isWiredFn(a.symbol)).length;
}
