/**
 * Principle 33 — Adapter-jig arm registry: the meta-check SSOT over the conformance suite.
 *
 * The adapter-jig design spec (§3) defines 22 conformance arms in 8 groups with a UNIVERSAL
 * RED-provability requirement: every arm MUST ship a paired positive+negative case — an arm
 * with only green-path cases is REFUSED (ESLint RuleTester's mandatory valid+invalid pairing,
 * lifted from rule granularity to adapter-arm granularity; SSOT prior-art-evaluations.md#226
 * BUILD-with-cited-patterns, pairing pattern per #154). This module is the executable mirror
 * of the spec §3 table: a typed-const registry (`ADAPTER_JIG_ARMS`) + pure helpers consumed
 * by 33-adapter-jig-arm-registry.test.ts (the gate half — same data+test split idiom as
 * principle 31-rule-channel-declaration.{ts,test.ts}).
 *
 * What the gate asserts (see the .test.ts):
 *   1. PAIRING — every registered arm has >=1 positive AND >=1 negative case ref;
 *      a green-only arm is REFUSED (spec §3 universal RED-provability).
 *   2. REFERENCE RESOLUTION — every case ref's suite file exists AND contains its locator
 *      marker verbatim (principle-08 broken-ref idiom; a fabricated pairing is RED).
 *   3. CANONICAL IDS — registered ids/slugs/groups match the frozen §3 table; no duplicates.
 *   4. POPULATION SENTINEL — bidirectional set-equality between registry ids and `@arm:`
 *      markers discovered LIVE in the suites (packages/core/**\/*.test.ts +
 *      tests/install-sh/**\/*.test.sh): an arm marked in a suite but absent from the registry
 *      escapes the pairing meta-check (RED); a registry row with no live marker is a vacuous
 *      or lying reference (RED). Set-difference in BOTH directions — the H3
 *      `tripwire-population-equality` idiom / principle-21 drift-guard / principle-27
 *      `missingEntries` shape.
 *
 * Marker grammar (language-agnostic, grep-level — no parser needed):
 *   TS suites:   `// @arm:<id>:pos <slug>`  /  `// @arm:<id>:neg <slug>`
 *   bash suites: `# @arm:<id>:pos <slug>`   /  `# @arm:<id>:neg <slug>`
 * The registry `locator` field is the exact `@arm:<id>:<kind>` token (slug optional in the
 * suite line — the token must appear verbatim). Markers + registry row + the arm itself land
 * together, append-only, one increment at a time (J2 decisions log #3/#13).
 *
 * Note on ref targets vs the sentinel: `checkArmRefsResolve` only asserts existence +
 * verbatim-locator (so test fixtures can exercise it); the discipline that a REAL arm's
 * cases live inside SCANNED suites is carried by the population sentinel — a ref into a
 * non-suite file resolves here but REDs the sentinel (no live marker in any scanned suite).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export type ArmGroup =
  | 'parsing'
  | 'trust'
  | 'delivery'
  | 'lock'
  | 'firing'
  | 'ci'
  | 'type-shape'
  | 'tripwire';

export interface CanonicalArm {
  readonly id: string;
  readonly group: ArmGroup;
  readonly slug: string;
}

/**
 * The frozen id-list — executable mirror of adapter-jig spec §3.1-§3.8 (22 arms, 8 groups).
 * Belt-and-suspenders vs the (stronger) registry-vs-live-suites sentinel: guards
 * registry-vs-spec drift (a silently-truncated or id-drifted registry) per the recon note.
 */
export const CANONICAL_ARMS: readonly CanonicalArm[] = [
  // §3.1 Parsing / resolution
  { id: 'A1', group: 'parsing', slug: 'no-new-throw-on-prewired-path' },
  { id: 'A2', group: 'parsing', slug: 'polyglot-precedence-pinned' },
  // §3.2 Trust
  { id: 'B1', group: 'trust', slug: 'tier1-trust-poisoned-negative' },
  { id: 'B2', group: 'trust', slug: 'value-guard-containment' },
  { id: 'B3', group: 'trust', slug: 'direct-deps-only' },
  // §3.3 Delivery cells
  { id: 'C1', group: 'delivery', slug: 'delivery-cell-matrix-complete' },
  { id: 'C2', group: 'delivery', slug: 'no-consumer-manifest-mutation' },
  { id: 'C3', group: 'delivery', slug: 'snapshot-exclusion-no-drift-mask' },
  { id: 'C4', group: 'delivery', slug: 'no-orphan-residue' },
  // §3.4 Lock integrity
  { id: 'D1', group: 'lock', slug: 'lock-never-stale-on-any-pass' },
  { id: 'D2', group: 'lock', slug: 'no-silent-fingerprint-degrade' },
  { id: 'D3', group: 'lock', slug: 'lock-schema-parity' },
  // §3.5 Firing
  { id: 'E1', group: 'firing', slug: 'scratch-consumer-red-green-pair' },
  { id: 'E2', group: 'firing', slug: 'self-check-resolves-delivered-config' },
  { id: 'E3', group: 'firing', slug: 'toolchain-freshness-vs-evidence' },
  // §3.6 CI pinning
  { id: 'P1', group: 'ci', slug: 'pinned-toolchain-in-ci' },
  // §3.7 Type-shape / wiring atomicity
  { id: 'G1', group: 'type-shape', slug: 'type-widening-exhaustiveness' },
  { id: 'G2', group: 'type-shape', slug: 'all-callsites-migrated-atomically' },
  { id: 'G3', group: 'type-shape', slug: 'zero-skill-core-edits' },
  // §3.8 Tripwire lockstep
  { id: 'H1', group: 'tripwire', slug: 'baseline-debt-lockstep' },
  { id: 'H2', group: 'tripwire', slug: 'tripwire-predicate-no-conjunctive-narrowing' },
  { id: 'H3', group: 'tripwire', slug: 'tripwire-population-equality' },
];

/** One resolvable pointer into an ACTUAL suite file (vitest .test.ts or bash .test.sh). */
export interface ArmCaseRef {
  /** Repo-relative file path of the suite carrying the case. */
  readonly suite: string;
  /** Exact `@arm:<id>:pos` | `@arm:<id>:neg` token present verbatim in that file. */
  readonly locator: string;
}

export interface ArmEntry {
  readonly id: string;
  readonly group: ArmGroup;
  readonly slug: string;
  /** >=1 GREEN-path case. */
  readonly positive: readonly ArmCaseRef[];
  /** >=1 RED-proof case (inverted assertion / violating fixture / pre-fix reproduction). */
  readonly negative: readonly ArmCaseRef[];
}

/**
 * Completeness gate flag — flipped to true by the FIN increment ONLY (J2 decisions log #3:
 * append-per-increment keeps the branch green after every commit; a count===22 assertion
 * landed upfront with zero arms would be RED from increment 1). While false, the gate asserts
 * registered ⊆ canonical; once true, it asserts set-EQUALITY with all 22 canonical ids.
 */
export const REGISTRY_COMPLETE = false;

/**
 * The live arm registry. Populated APPEND-ONLY, one row per landed arm, in the same commit
 * as the arm's cases + their `@arm:` markers (spec §3 append-only; J2 decisions log #13).
 */
export const ADAPTER_JIG_ARMS: readonly ArmEntry[] = [
  // Increment A (J2). A1 landed fix+arm atomic: read-manifest.ts readPkg's unguarded
  // JSON.parse (a REAL live bug — resolveCtxForRoot threw SyntaxError on a malformed
  // package.json) wrapped try/catch→null in the same commit as the regression arm.
  {
    id: 'A1',
    group: 'parsing',
    slug: 'no-new-throw-on-prewired-path',
    positive: [
      { suite: 'packages/core/synthesizer/resolve-ctx.test.ts', locator: '@arm:A1:pos' },
    ],
    negative: [
      { suite: 'packages/core/synthesizer/resolve-ctx.test.ts', locator: '@arm:A1:neg' },
    ],
  },
  // A2 pins precedence at BOTH seams (J2 decisions log #4): detector level
  // (read-python-cargo.test.ts — package.json+Cargo and all-three combinations) AND
  // the production adapter-selection seam (resolve-ctx.test.ts polyglot fixture).
  {
    id: 'A2',
    group: 'parsing',
    slug: 'polyglot-precedence-pinned',
    positive: [
      { suite: 'packages/core/detector/read-python-cargo.test.ts', locator: '@arm:A2:pos' },
      { suite: 'packages/core/synthesizer/resolve-ctx.test.ts', locator: '@arm:A2:pos' },
    ],
    negative: [
      { suite: 'packages/core/detector/read-python-cargo.test.ts', locator: '@arm:A2:neg' },
    ],
  },
];

/** Gate 1 — pairing: a green-only (or red-only) arm is REFUSED. */
export function checkArmPairing(arms: readonly ArmEntry[]): string[] {
  const errs: string[] = [];
  for (const arm of arms) {
    if (arm.positive.length < 1) {
      errs.push(
        `arm ${arm.id} (${arm.slug}) has 0 positive cases — a red-only arm cannot prove the GREEN path exists`,
      );
    }
    if (arm.negative.length < 1) {
      errs.push(
        `arm ${arm.id} (${arm.slug}) has 0 RED-proof cases — green-only REFUSED per spec §3 universal RED-provability`,
      );
    }
  }
  return errs;
}

/** Gate 3 — canonical ids: unique, known, group+slug matching the frozen §3 table. */
export function checkArmIdsCanonical(arms: readonly ArmEntry[]): string[] {
  const errs: string[] = [];
  const canonicalById = new Map(CANONICAL_ARMS.map((c) => [c.id, c]));
  const seen = new Set<string>();
  for (const arm of arms) {
    if (seen.has(arm.id)) {
      errs.push(`arm ${arm.id} registered more than once — duplicate row`);
      continue;
    }
    seen.add(arm.id);
    const canonical = canonicalById.get(arm.id);
    if (!canonical) {
      errs.push(`arm ${arm.id} is not one of the 22 canonical spec §3 ids`);
      continue;
    }
    if (arm.group !== canonical.group) {
      errs.push(
        `arm ${arm.id} declares group "${arm.group}" but the canonical §3 group is "${canonical.group}"`,
      );
    }
    if (arm.slug !== canonical.slug) {
      errs.push(
        `arm ${arm.id} declares slug "${arm.slug}" but the canonical §3 slug is "${canonical.slug}"`,
      );
    }
  }
  return errs;
}

/**
 * Gate 2 — reference resolution (principle-08 broken-ref idiom): every ref's locator must be
 * the exact `@arm:<id>:<kind>` token for its arm+direction, its suite file must exist, and
 * the file must contain the locator verbatim. A dangling/fabricated pairing is RED.
 */
export function checkArmRefsResolve(
  arms: readonly ArmEntry[],
  repoRoot: string,
): string[] {
  const errs: string[] = [];
  for (const arm of arms) {
    const sides: ReadonlyArray<readonly [('pos' | 'neg'), readonly ArmCaseRef[]]> = [
      ['pos', arm.positive],
      ['neg', arm.negative],
    ];
    for (const [kind, refs] of sides) {
      for (const ref of refs) {
        const expected = `@arm:${arm.id}:${kind}`;
        if (ref.locator !== expected) {
          errs.push(
            `arm ${arm.id} ${kind} ref locator "${ref.locator}" is malformed — must be exactly "${expected}"`,
          );
          continue;
        }
        const abs = `${repoRoot}/${ref.suite}`;
        if (!existsSync(abs)) {
          errs.push(
            `arm ${arm.id} ${kind} ref suite "${ref.suite}" does not exist (dangling reference)`,
          );
          continue;
        }
        if (!readFileSync(abs, 'utf8').includes(ref.locator)) {
          errs.push(
            `arm ${arm.id} ${kind} ref suite "${ref.suite}" exists but does NOT contain marker "${ref.locator}" verbatim (marker-less / lying reference)`,
          );
        }
      }
    }
  }
  return errs;
}

/** A live `@arm:` marker discovered in a scanned suite file. */
export interface ArmMarker {
  readonly id: string;
  readonly kind: 'pos' | 'neg';
  readonly file: string;
}

const ARM_MARKER_RE = /@arm:([A-Z]\d+):(pos|neg)\b/g;

/** This principle's own test file — excluded from the scan: it necessarily contains
 *  synthetic `@arm:` tokens (RED-proof fixtures) that are not live suite cases. */
const SELF_TEST_BASENAME = '33-adapter-jig-arm-registry.test.ts';

/**
 * Enumerate the suite population the sentinel scans: git-tracked
 * packages/core/**\/*.test.ts + tests/install-sh/**\/*.test.sh (git-aware, mirrors
 * principle 31's enumerateRuleFiles; falls back to a filesystem walk without git).
 */
export function enumerateSuiteFiles(repoRoot: string): string[] {
  let candidates: string[];
  try {
    const out = execFileSync(
      'git',
      ['-C', repoRoot, 'ls-files', '--', 'packages/core', 'tests/install-sh'],
      { encoding: 'utf8' },
    );
    candidates = out.split('\n').filter(Boolean);
  } catch {
    candidates = [];
    const walk = (rel: string): void => {
      const abs = `${repoRoot}/${rel}`;
      if (!existsSync(abs)) return;
      for (const entry of readdirSync(abs, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const childRel = `${rel}/${entry.name}`;
        if (entry.isDirectory()) walk(childRel);
        else if (entry.isFile()) candidates.push(childRel);
      }
    };
    walk('packages/core');
    walk('tests/install-sh');
  }
  return candidates
    .filter((rel) => rel.endsWith('.test.ts') || rel.endsWith('.test.sh'))
    .filter((rel) => !rel.endsWith(`/${SELF_TEST_BASENAME}`))
    .sort();
}

/** Scan the given suite files (default: the enumerated population) for live `@arm:` markers. */
export function scanSuiteMarkers(
  repoRoot: string,
  files: readonly string[] = enumerateSuiteFiles(repoRoot),
): ArmMarker[] {
  const markers: ArmMarker[] = [];
  for (const rel of files) {
    const abs = `${repoRoot}/${rel}`;
    if (!existsSync(abs)) continue;
    const source = readFileSync(abs, 'utf8');
    for (const match of source.matchAll(ARM_MARKER_RE)) {
      markers.push({ id: match[1], kind: match[2] as 'pos' | 'neg', file: rel });
    }
  }
  return markers;
}

export interface PopulationParity {
  /** Arm ids with a live suite marker but NO registry row — they escape the pairing gate. */
  readonly missingFromRegistry: string[];
  /** Registry arm ids with NO live marker in any scanned suite — vacuous/lying rows. */
  readonly missingFromSuites: string[];
}

/**
 * Gate 4 — the population sentinel: bidirectional set-difference between registry ids and
 * live marker ids (both directions RED; empty↔empty is the legal starting state — the
 * registry grows append-only with the arms).
 */
export function checkPopulationParity(
  registryIds: Iterable<string>,
  markerIds: Iterable<string>,
): PopulationParity {
  const registry = new Set(registryIds);
  const markers = new Set(markerIds);
  return {
    missingFromRegistry: [...markers].filter((id) => !registry.has(id)).sort(),
    missingFromSuites: [...registry].filter((id) => !markers.has(id)).sort(),
  };
}

/** Canonical ids not yet registered — consumed by the REGISTRY_COMPLETE completeness gate. */
export function missingArmIds(arms: readonly ArmEntry[]): string[] {
  const registered = new Set(arms.map((a) => a.id));
  return CANONICAL_ARMS.map((c) => c.id).filter((id) => !registered.has(id));
}
