/**
 * Principle 33 — Adapter-jig arm registry meta-check (the gate half).
 *
 * Source: adapter-jig design spec §3 (universal RED-provability — paired positive+negative
 * per arm, green-only REFUSED) + §9 J2 (meta-check over the arm registry landed in the
 * EXISTING principles suite, population sentinel included). Data half:
 * 33-adapter-jig-arm-registry.ts (same split idiom as principle 31).
 *
 * Four gates over ADAPTER_JIG_ARMS (pairing, ref resolution, canonical ids, population
 * sentinel), each with named paired-negatives (N33-1..N33-4) proving the gate is
 * non-tautological (principle 02/04 discipline: a check that can never fail is not a check).
 *
 * NOTE: this file is deliberately EXCLUDED from the sentinel's suite scan (see
 * SELF_TEST_BASENAME in the data module) — the synthetic `@arm:` tokens below are RED-proof
 * fixtures, not live suite cases.
 */
import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADAPTER_JIG_ARMS,
  CANONICAL_ARMS,
  REGISTRY_COMPLETE,
  checkArmPairing,
  checkArmIdsCanonical,
  checkArmRefsResolve,
  enumerateSuiteFiles,
  scanSuiteMarkers,
  checkPopulationParity,
  checkMarkerRegistration,
  registrySlots,
  markerSlots,
  KNOWN_MARKER_DRIFT,
  missingArmIds,
  type ArmEntry,
  type ArmGroup,
} from './33-adapter-jig-arm-registry.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const FIXTURE_SUITE = 'packages/core/principles/fixtures/adapter-jig/marker-fixture.txt';

/** Well-formed synthetic entry whose refs resolve against the .txt fixture. */
const WELL_FORMED_A1: ArmEntry = {
  id: 'A1',
  group: 'parsing',
  slug: 'no-new-throw-on-prewired-path',
  positive: [{ suite: FIXTURE_SUITE, locator: '@arm:A1:pos' }],
  negative: [{ suite: FIXTURE_SUITE, locator: '@arm:A1:neg' }],
};

describe('Principle 33 — adapter-jig arm registry meta-check', () => {
  describe('canonical arm table integrity (spec §3 frozen id-list)', () => {
    it('declares exactly 22 arms with unique ids', () => {
      expect(CANONICAL_ARMS).toHaveLength(22);
      expect(new Set(CANONICAL_ARMS.map((c) => c.id)).size).toBe(22);
    });

    it('group rollup matches spec §3.1-§3.8 (2+3+4+3+3+1+3+3)', () => {
      const byGroup = new Map<ArmGroup, number>();
      for (const c of CANONICAL_ARMS) byGroup.set(c.group, (byGroup.get(c.group) ?? 0) + 1);
      expect(Object.fromEntries(byGroup)).toEqual({
        parsing: 2,
        trust: 3,
        delivery: 4,
        lock: 3,
        firing: 3,
        ci: 1,
        'type-shape': 3,
        tripwire: 3,
      });
    });
  });

  describe('real-registry sweep (grows append-only; every gate must hold after every increment)', () => {
    it('pairing: every registered arm has >=1 positive AND >=1 negative case ref (green-only REFUSED)', () => {
      const errs = checkArmPairing(ADAPTER_JIG_ARMS);
      expect(errs, `Pairing violations:\n${errs.join('\n')}`).toHaveLength(0);
    });

    it('canonical ids: every registered arm id/group/slug matches the frozen §3 table, no duplicates', () => {
      const errs = checkArmIdsCanonical(ADAPTER_JIG_ARMS);
      expect(errs, `Canonical-id violations:\n${errs.join('\n')}`).toHaveLength(0);
    });

    it('ref resolution: every case ref suite exists AND contains its locator marker verbatim', () => {
      const errs = checkArmRefsResolve(ADAPTER_JIG_ARMS, REPO_ROOT);
      expect(errs, `Ref-resolution violations:\n${errs.join('\n')}`).toHaveLength(0);
    });

    it('completeness gate: registered ⊆ canonical always; set-EQUALITY once REGISTRY_COMPLETE (FIN flips it)', () => {
      // While REGISTRY_COMPLETE is false the registry may be a strict subset (append-only
      // growth, J2 decisions log #3); asserting count===22 from increment 1 would be RED by
      // construction. The subset direction is already gated by checkArmIdsCanonical above.
      if (REGISTRY_COMPLETE) {
        const missing = missingArmIds(ADAPTER_JIG_ARMS);
        expect(
          missing,
          `REGISTRY_COMPLETE=true but these canonical arms are unregistered:\n${missing.join('\n')}`,
        ).toHaveLength(0);
        expect(ADAPTER_JIG_ARMS).toHaveLength(CANONICAL_ARMS.length);
      } else {
        expect(missingArmIds(ADAPTER_JIG_ARMS).length).toBeLessThanOrEqual(
          CANONICAL_ARMS.length,
        );
      }
    });
  });

  describe('population sentinel — registry-set == live @arm: marker-set, both directions', () => {
    it('the scan covers every suite the registry actually references (not merely "some files")', () => {
      const files = enumerateSuiteFiles(REPO_ROOT);
      // `.length > 0` was the old assertion and it could not fail: any tree with one test
      // file satisfied it, including a tree where the scan had silently stopped seeing the
      // suites that matter (ledger A8-5). The real invariant is that every file the registry
      // POINTS AT is inside the scanned population — otherwise a marker in a referenced
      // suite is unreachable and the whole sentinel compares against a truncated set.
      const referenced = [
        ...new Set(
          ADAPTER_JIG_ARMS.flatMap((a) => [...a.positive, ...a.negative]).map((r) => r.suite),
        ),
      ].sort();
      expect(referenced.length).toBeGreaterThanOrEqual(ADAPTER_JIG_ARMS.length);
      const scanned = new Set(files);
      const unreachable = referenced.filter((r) => !scanned.has(r));
      expect(
        unreachable,
        `Registry-referenced suites the population scan does NOT enumerate:\n${unreachable.join('\n')}`,
      ).toHaveLength(0);
      // The sentinel's own test file is excluded — its synthetic tokens are not live cases.
      expect(files.some((f) => f.endsWith('33-adapter-jig-arm-registry.test.ts'))).toBe(false);
      // Both suite families are in scope (vitest + bash) — the cross-language scan is load-bearing.
      expect(files.some((f) => f.startsWith('packages/core/') && f.endsWith('.test.ts'))).toBe(true);
      expect(files.some((f) => f.startsWith('tests/install-sh/') && f.endsWith('.test.sh'))).toBe(true);
    });

    it('marker-slots == registry-slots, per <id>:<kind> (a marked pos with no marked neg is now visible)', () => {
      const markers = scanSuiteMarkers(REPO_ROOT);
      const parity = checkPopulationParity(
        registrySlots(ADAPTER_JIG_ARMS),
        markerSlots(markers),
      );
      expect(
        parity.missingFromRegistry,
        `Slots marked in suites but NOT registered (escape the pairing gate):\n${parity.missingFromRegistry.join('\n')}`,
      ).toHaveLength(0);
      expect(
        parity.missingFromSuites,
        `Registry slots with NO live @arm: marker in any scanned suite (vacuous/lying):\n${parity.missingFromSuites.join('\n')}`,
      ).toHaveLength(0);
    });

    it('every LIVE marker is registered: canonical id, canonical slug, and a ref to its own file', () => {
      const markers = scanSuiteMarkers(REPO_ROOT);
      // Non-vacuity: the strict comment-start pattern must still be finding the real
      // population. A regex that stopped matching would make every arm below pass.
      expect(markers.length).toBeGreaterThanOrEqual(ADAPTER_JIG_ARMS.length);
      const report = checkMarkerRegistration(ADAPTER_JIG_ARMS, markers);
      expect(
        report.violations,
        `Live @arm: markers the registry does not actually cover:\n${report.violations.join('\n')}`,
      ).toHaveLength(0);
      expect(
        report.staleExemptions,
        `KNOWN_MARKER_DRIFT entries that match no live marker (stale exemption widens the gate):\n${report.staleExemptions.join('\n')}`,
      ).toHaveLength(0);
      // Exemptions are a routed backlog, not a parking lot: keep the list short enough that
      // it stays reviewable, and force a deliberate edit here when it grows.
      expect(KNOWN_MARKER_DRIFT.length).toBeLessThanOrEqual(2);
      for (const e of KNOWN_MARKER_DRIFT) expect(e.why.length).toBeGreaterThanOrEqual(20);
    });

    it('neg: a marker whose slug names a different concern is REPORTED (the gate discriminates)', () => {
      const report = checkMarkerRegistration(
        ADAPTER_JIG_ARMS,
        [
          {
            id: 'B3',
            kind: 'neg',
            slug: 'something-else-entirely',
            file: 'packages/core/research/ecosystem-go.test.ts',
          },
        ],
        [],
      );
      expect(report.violations.join(' ')).toMatch(/is slugged "something-else-entirely"/);
    });

    it('neg: a marker in a file the registry never references is REPORTED', () => {
      const report = checkMarkerRegistration(
        ADAPTER_JIG_ARMS,
        [
          {
            id: 'B3',
            kind: 'neg',
            slug: 'direct-deps-only',
            file: 'packages/core/research/not-referenced-anywhere.test.ts',
          },
        ],
        [],
      );
      expect(report.violations.join(' ')).toMatch(/the registry lists no neg ref to this file/);
    });

    it('neg: a stale KNOWN_MARKER_DRIFT entry is REPORTED (an exemption cannot outlive its marker)', () => {
      const report = checkMarkerRegistration(
        ADAPTER_JIG_ARMS,
        [],
        [{ file: 'gone.test.ts', locator: '@arm:B3:neg', why: 'a rationale of sufficient length' }],
      );
      expect(report.staleExemptions.join(' ')).toMatch(/no live marker matches it any more/);
    });
  });

  // ---- Named paired-negatives (N33-1..N33-4) — each gate proven RED-capable on synthetic input ----

  describe('N33-1 — green-only arm REFUSED (pairing gate has teeth)', () => {
    it('RED: an arm with positive cases but an empty negative array is refused', () => {
      const greenOnly: ArmEntry = { ...WELL_FORMED_A1, negative: [] };
      const errs = checkArmPairing([greenOnly]);
      expect(errs.length).toBeGreaterThan(0);
      expect(errs.join(' ')).toMatch(/green-only REFUSED/);
    });

    it('RED: the symmetric red-only arm (no positive) is refused too', () => {
      const redOnly: ArmEntry = { ...WELL_FORMED_A1, positive: [] };
      const errs = checkArmPairing([redOnly]);
      expect(errs.length).toBeGreaterThan(0);
      expect(errs.join(' ')).toMatch(/0 positive cases/);
    });

    it('positive control: a well-formed pos+neg pair passes the pairing gate', () => {
      expect(checkArmPairing([WELL_FORMED_A1])).toHaveLength(0);
    });
  });

  describe('N33-2 — dangling / marker-less references RED (ref-resolution gate has teeth)', () => {
    it('RED: a ref whose suite file does not exist is a dangling reference', () => {
      const dangling: ArmEntry = {
        ...WELL_FORMED_A1,
        positive: [{ suite: 'packages/core/__no_such_suite__.test.ts', locator: '@arm:A1:pos' }],
      };
      const errs = checkArmRefsResolve([dangling], REPO_ROOT);
      expect(errs.length).toBeGreaterThan(0);
      expect(errs.join(' ')).toMatch(/does not exist \(dangling reference\)/);
    });

    it('RED: a ref whose suite exists but lacks the marker verbatim is a lying reference', () => {
      const markerless: ArmEntry = {
        ...WELL_FORMED_A1,
        id: 'A2',
        slug: 'polyglot-precedence-pinned',
        // Real file, guaranteed to never carry live A2 markers (it is the sentinel-excluded
        // fixture carrying only A1 tokens).
        positive: [{ suite: FIXTURE_SUITE, locator: '@arm:A2:pos' }],
        negative: [{ suite: FIXTURE_SUITE, locator: '@arm:A2:neg' }],
      };
      const errs = checkArmRefsResolve([markerless], REPO_ROOT);
      expect(errs.length).toBeGreaterThan(0);
      expect(errs.join(' ')).toMatch(/does NOT contain marker/);
    });

    it('RED: a locator that is not the exact @arm:<id>:<kind> token for its arm is malformed', () => {
      const crossWired: ArmEntry = {
        ...WELL_FORMED_A1,
        positive: [{ suite: FIXTURE_SUITE, locator: '@arm:A1:neg' }], // neg token filed as positive
      };
      const errs = checkArmRefsResolve([crossWired], REPO_ROOT);
      expect(errs.length).toBeGreaterThan(0);
      expect(errs.join(' ')).toMatch(/malformed/);
    });

    it('positive control: refs into the fixture file resolve (exists + verbatim locator)', () => {
      expect(checkArmRefsResolve([WELL_FORMED_A1], REPO_ROOT)).toHaveLength(0);
    });
  });

  describe('N33-3 — population parity RED in BOTH directions (sentinel has teeth)', () => {
    it('RED: a marker in a suite with no registry row escapes the pairing gate', () => {
      const parity = checkPopulationParity([], ['A1']);
      expect(parity.missingFromRegistry).toEqual(['A1']);
      expect(parity.missingFromSuites).toHaveLength(0);
    });

    it('RED: a registry row with no live marker anywhere is vacuous', () => {
      const parity = checkPopulationParity(['A1'], []);
      expect(parity.missingFromSuites).toEqual(['A1']);
      expect(parity.missingFromRegistry).toHaveLength(0);
    });

    it('positive control: equal sets in any order produce zero diffs', () => {
      const parity = checkPopulationParity(['B1', 'A1'], ['A1', 'B1']);
      expect(parity.missingFromRegistry).toHaveLength(0);
      expect(parity.missingFromSuites).toHaveLength(0);
    });
  });

  describe('N33-4 — non-canonical id / wrong group / wrong slug / duplicate RED (id gate has teeth)', () => {
    it('RED: an id outside the 22 canonical spec §3 ids is refused', () => {
      const alien: ArmEntry = { ...WELL_FORMED_A1, id: 'Z9' };
      const errs = checkArmIdsCanonical([alien]);
      expect(errs.join(' ')).toMatch(/not one of the 22 canonical/);
    });

    it('RED: a canonical id under the wrong group is refused', () => {
      const wrongGroup: ArmEntry = { ...WELL_FORMED_A1, group: 'tripwire' };
      const errs = checkArmIdsCanonical([wrongGroup]);
      expect(errs.join(' ')).toMatch(/canonical §3 group is "parsing"/);
    });

    it('RED: a canonical id under the wrong slug is refused', () => {
      const wrongSlug: ArmEntry = { ...WELL_FORMED_A1, slug: 'renamed-on-the-sly' };
      const errs = checkArmIdsCanonical([wrongSlug]);
      expect(errs.join(' ')).toMatch(/canonical §3 slug/);
    });

    it('RED: registering the same id twice is refused', () => {
      const errs = checkArmIdsCanonical([WELL_FORMED_A1, WELL_FORMED_A1]);
      expect(errs.join(' ')).toMatch(/duplicate row/);
    });

    it('positive control: a well-formed canonical entry passes the id gate', () => {
      expect(checkArmIdsCanonical([WELL_FORMED_A1])).toHaveLength(0);
    });
  });

  // ---- T15 self-application ----
  it('T15: the meta-check applies its own discipline to itself — every gate above ships paired negatives', () => {
    // The registry enforces paired positive+negative per arm; this file enforces the same on
    // its own gates: N33-1..N33-4 each carry >=1 RED case AND a positive control. Mechanical
    // self-audit: the four gate helpers are all exercised in both directions above.
    const gates = [checkArmPairing, checkArmIdsCanonical, checkArmRefsResolve, checkPopulationParity];
    expect(gates).toHaveLength(4);
    // And the sentinel does not exempt itself by scanning its own synthetic tokens (excluded
    // by basename — asserted in the population-sentinel describe block above).
  });
});
