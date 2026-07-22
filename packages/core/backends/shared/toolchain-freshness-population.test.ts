// Toolchain-freshness POPULATION sentinel — adapter-jig arm E3 (toolchain-freshness-vs-evidence).
//
// The per-lane freshness discipline already ships four times over: every firing-lane backend
// (astgrep, cargo, npm, ruff) exports `checkToolchainFreshness` from its capability-matrix.test.ts
// with a paired drift-negative («claims a DIFFERENT version → violation») and a live gate
// (`it.skipIf(resolvedVersion === undefined)`) against the committed capability-matrix.json.
// What NOTHING asserted before this sentinel: that the NEXT delivered firing lane cannot silently
// skip the freshness gate. A new backend dir with firing.test.ts + capability-matrix.json but no
// freshness wiring would rot exactly like the aspirational-doc failure the matrices exist to
// prevent (attention-is-not-a-mechanism §1 — «someone will remember to add the gate» is not a
// mechanism).
//
// Population definition (J2 decisions log #12 — by artifact presence, no hand-maintained list):
// a FIRING LANE is a direct child dir of packages/core/backends/ containing BOTH firing.test.ts
// AND capability-matrix.json. For each, the sentinel requires in capability-matrix.test.ts:
//   1. the literal `export function checkToolchainFreshness` (the gate function exists), and
//   2. the `@arm:E3:neg`-tagged drift paired-negative (the RED-capability proof is registered).
// The behavioural half (a fabricated version-drift cell yields a violation) lives in the tagged
// per-backend tests themselves — this sentinel guards population completeness, not semantics
// (semantic correctness of a negative is review-time judgment per no-paid-llm-in-ci).
//
// Registered as adapter-jig arm E3; markers below. The marker literal is assembled at runtime so
// the registry's live-marker scan attributes E3's neg cases to the BACKEND suites, not to this
// sentinel's own required-token constant.
//
// @arm:E3:pos toolchain-freshness-vs-evidence (population: every firing lane wires the freshness gate)

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** packages/core/backends — this file lives in backends/shared/. */
const REAL_BACKENDS_ROOT = join(__dirname, '..');

const FRESHNESS_EXPORT_TOKEN = 'export function checkToolchainFreshness';
/** Assembled, not literal — keeps the registry marker scan pointed at the backend suites. */
const DRIFT_NEGATIVE_MARKER = ['@arm', 'E3', 'neg'].join(':');

/** Enumerate firing lanes: direct child dirs carrying firing.test.ts AND capability-matrix.json. */
export function enumerateFiringLaneBackends(backendsRoot: string): string[] {
  return readdirSync(backendsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter(
      (name) =>
        existsSync(join(backendsRoot, name, 'firing.test.ts')) &&
        existsSync(join(backendsRoot, name, 'capability-matrix.json')),
    )
    .sort();
}

/**
 * The sentinel: per firing lane, capability-matrix.test.ts must exist, export the freshness gate,
 * and carry the tagged drift paired-negative. Pure over the supplied root → RED-provable against a
 * synthetic violating fixture (below) without touching the real tree.
 */
export function checkFreshnessGateWiring(
  backendsRoot: string,
  lanes: readonly string[] = enumerateFiringLaneBackends(backendsRoot),
): string[] {
  const violations: string[] = [];
  for (const lane of lanes) {
    const suite = join(backendsRoot, lane, 'capability-matrix.test.ts');
    if (!existsSync(suite)) {
      violations.push(
        `firing lane "${lane}" ships firing.test.ts + capability-matrix.json but has NO ` +
          `capability-matrix.test.ts — the committed evidence matrix is ungated`,
      );
      continue;
    }
    const source = readFileSync(suite, 'utf8');
    if (!source.includes(FRESHNESS_EXPORT_TOKEN)) {
      violations.push(
        `firing lane "${lane}": capability-matrix.test.ts does not export checkToolchainFreshness ` +
          `— committed firing evidence can drift from the live/pinned tool with zero RED`,
      );
    }
    if (!source.includes(DRIFT_NEGATIVE_MARKER)) {
      violations.push(
        `firing lane "${lane}": capability-matrix.test.ts carries no ${DRIFT_NEGATIVE_MARKER}-tagged ` +
          `drift paired-negative — the freshness gate's RED-capability is not registered/proven`,
      );
    }
  }
  return violations;
}

// ── synthetic fixture roots (the sentinel's own RED-proof — spec §3 universal pairing) ──────────

const tmpRoots: string[] = [];
function makeFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'jig-e3-'));
  tmpRoots.push(root);
  return root;
}
afterAll(() => {
  for (const root of tmpRoots) rmSync(root, { recursive: true, force: true });
});

function plantLane(
  root: string,
  name: string,
  opts: { firing?: boolean; matrixJson?: boolean; matrixTest?: string | undefined },
): void {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  if (opts.firing !== false) writeFileSync(join(dir, 'firing.test.ts'), '// synthetic firing suite\n');
  if (opts.matrixJson !== false) writeFileSync(join(dir, 'capability-matrix.json'), '{}\n');
  if (opts.matrixTest !== undefined) writeFileSync(join(dir, 'capability-matrix.test.ts'), opts.matrixTest);
}

const CONFORMING_MATRIX_TEST =
  `// synthetic conforming suite\n${FRESHNESS_EXPORT_TOKEN}(): string[] { return []; }\n` +
  `// ${DRIFT_NEGATIVE_MARKER} synthetic drift paired-negative\n`;

describe('E3 population sentinel — every delivered firing lane wires the toolchain-freshness gate', () => {
  it('enumerates the real firing-lane population by artifact presence (astgrep/cargo/npm/ruff today)', () => {
    const lanes = enumerateFiringLaneBackends(REAL_BACKENDS_ROOT);
    // Superset-tolerant on purpose: a FUTURE lane must ENTER the population automatically (that is
    // the sentinel's whole job) — asserting exact equality would make lane-addition RED here
    // instead of in the wiring check below.
    expect(lanes).toEqual(expect.arrayContaining(['astgrep', 'cargo', 'npm', 'ruff']));
    expect(lanes.length).toBeGreaterThanOrEqual(4);
    // `shared` (this dir) has no firing.test.ts — population boundary holds.
    expect(lanes).not.toContain('shared');
  });

  it('REAL tree: every firing lane exports checkToolchainFreshness AND registers its drift negative', () => {
    expect(checkFreshnessGateWiring(REAL_BACKENDS_ROOT)).toEqual([]);
  });

  it('paired negative: a firing lane MISSING the freshness export is a violation (sentinel REDs)', () => {
    const root = makeFixtureRoot();
    plantLane(root, 'goodlane', { matrixTest: CONFORMING_MATRIX_TEST });
    plantLane(root, 'badlane', {
      matrixTest: `// suite without the gate\n// ${DRIFT_NEGATIVE_MARKER} marker without the function\n`,
    });
    const violations = checkFreshnessGateWiring(root);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('badlane');
    expect(violations[0]).toContain('does not export checkToolchainFreshness');
  });

  it('paired negative: a firing lane with NO capability-matrix.test.ts at all is a violation', () => {
    const root = makeFixtureRoot();
    plantLane(root, 'ungated', { matrixTest: undefined });
    const violations = checkFreshnessGateWiring(root);
    expect(violations.some((v) => v.includes('ungated') && v.includes('NO'))).toBe(true);
  });

  it('paired negative: a gate export WITHOUT the tagged drift negative is a violation', () => {
    const root = makeFixtureRoot();
    plantLane(root, 'untagged', {
      matrixTest: `${FRESHNESS_EXPORT_TOKEN}(): string[] { return []; }\n`,
    });
    const violations = checkFreshnessGateWiring(root);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('drift paired-negative');
  });

  it('population boundary: a dir without firing.test.ts is NOT a firing lane (no false RED)', () => {
    const root = makeFixtureRoot();
    plantLane(root, 'research-only', { firing: false, matrixTest: undefined });
    expect(enumerateFiringLaneBackends(root)).toEqual([]);
    expect(checkFreshnessGateWiring(root)).toEqual([]);
  });
});
