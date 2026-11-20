// packages/runtime-bridge/test/ocr-coverage.test.ts
// OCR C1a — pure public-result comparison component (getff-ocr-reuse). Boundary tests run
// against BOTH the source module and its vendor twin (the established describe.each twin
// convention, cf. harvest.test.ts). Fixtures are public-source-shaped deterministic data
// built from the PINNED producer snapshots (v1.13.3 / 375f64c):
//   - internal/session/manifest.go — Coverage arrays are ALWAYS non-nil (JSON "[]", never
//     null); run_failure is an omitempty pointer (absent when nil, never null); complete ⇒
//     non-empty selected AND empty failed (computeTerminal); item_id/path mandatory, other
//     item fields omitempty; classification/reason only on failed/waived.
//   - cmd/opencodereview/output.go:403-405 — root `status` is copied from
//     manifest.terminal_state when a manifest is present; "success"/completed_with_* are
//     manifest-less legacy shapes that cannot establish this operation.
// NOT captured real review output; no synthetic model corpus, no quality/benefit claim.
// Compatible data is NOT evidence OCR ran or fulfilled a semantic duty (card boundary).
import { describe, it, expect } from 'vitest';
import {
  compareOcrCoverage,
  type OcrCoverageExpectation,
} from '../src/ocrCoverage.js';
import {
  compareOcrCoverage as compareOcrCoverageVendor,
} from '../vendor/src/ocrCoverage.js';

const BASE = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6f7a8b9c0';
const HEAD = '0fedcba9876543210fedcba9876543210fedcba9';
const RANGE = `${BASE}..${HEAD}`;
const VER = '1.13.3';

/** Public-shaped coverage item; optional fields omitted unless given (omitempty encoding). */
const item = (id: string, path: string, extra: Record<string, string> = {}): Record<string, string> => ({
  item_id: id,
  path,
  ...extra,
});

/** A complete, producer-consistent range manifest. Explicit `[]` for unused arrays;
 *  run_failure omitted; optional item fields omitted. Overrides compose one level deep. */
const manifest = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  schema_version: 'ocr.run-manifest/v1',
  run_id: 'run-0001',
  operation: 'review',
  terminal_state: 'complete',
  repository: { identity_sha256: 'ff'.repeat(32) },
  input: {
    mode: 'range',
    requested_from: 'staging',
    requested_head: HEAD,
    resolved_base: BASE,
    resolved_head: HEAD,
    exact_range: RANGE,
    source_artifact_sha256: 'ab'.repeat(32),
  },
  execution: { ocr_version: VER, provider: 'chatgpt', model: 'gpt-test' },
  coverage: {
    selected: [item('01', 'src/a.ts'), item('02', 'src/b.ts')],
    completed: [item('01', 'src/a.ts'), item('02', 'src/b.ts')],
    reused: [],
    failed: [],
    waived: [],
  },
  elapsed_ms: 1234,
  ...over,
});

/** Root public shape with an admitted manifest (status copied from terminal_state). */
const root = (m: unknown, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  status: 'complete',
  trace_id: 'trace-0001',
  comments: [],
  warnings: [],
  manifest: m,
  ...over,
});

/** Caller-supplied independent expectation; requiredPaths drive scope, nothing else does. */
const expectation = (over: Partial<OcrCoverageExpectation> = {}): OcrCoverageExpectation => ({
  requiredPaths: ['src/a.ts', 'src/b.ts'],
  resolvedBase: BASE,
  resolvedHead: HEAD,
  expectedRange: RANGE,
  expectedOcrVersion: VER,
  ...over,
});


describe.each([['source', compareOcrCoverage], ['vendor', compareOcrCoverageVendor]] as const)(
  'compareOcrCoverage — %s public-result comparison',
  (_name, compare) => {
    const compatible = (raw: unknown, exp: OcrCoverageExpectation) => {
      const v = compare(raw, exp);
      expect(v.status).toBe('compatible');
      return v as {
        status: 'compatible';
        processedPaths: string[];
        identity: { resolvedBase: string; resolvedHead: string; exactRange: string; ocrVersion: string };
      };
    };
    const hold = (raw: unknown, exp: OcrCoverageExpectation, reason: string) => {
      const v = compare(raw, exp);
      expect(v.status).toBe('hold');
      expect((v as { reason: string }).reason).toBe(reason);
      return v as { status: 'hold'; reason: string; detail: string };
    };

    it('positive: complete public-shaped range, no findings, actual empty-array encoding, omitted run_failure', () => {
      const v = compatible(root(manifest()), expectation());
      expect(v.processedPaths).toEqual(['src/a.ts', 'src/b.ts']);
      expect(v.identity).toEqual({ resolvedBase: BASE, resolvedHead: HEAD, exactRange: RANGE, ocrVersion: VER });
    });

    it('positive: reused-only item counts as processed', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['completed'] = [item('01', 'src/a.ts')];
      cov['reused'] = [item('02', 'src/b.ts')];
      const v = compatible(root(m), expectation());
      expect(v.processedPaths).toEqual(['src/a.ts', 'src/b.ts']);
    });

    it('positive: deletion satisfies the required OLD path (git.go /dev/null rule)', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [item('01', 'src/gone.ts')];
      cov['completed'] = [item('01', 'src/gone.ts')];
      const v = compatible(root(m), expectation({ requiredPaths: ['src/gone.ts'] }));
      expect(v.processedPaths).toEqual(['src/gone.ts']);
    });

    it('positive: rename satisfies the required NEW path; old_path is context, not processed identity', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [item('01', 'src/new.ts', { old_path: 'src/old.ts' })];
      cov['completed'] = [item('01', 'src/new.ts', { old_path: 'src/old.ts' })];
      const v = compatible(root(m), expectation({ requiredPaths: ['src/new.ts'] }));
      expect(v.processedPaths).toEqual(['src/new.ts']);
    });

    it('positive: non-required waived material is allowed alongside full required coverage', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [item('01', 'src/a.ts'), item('02', 'src/b.ts'), item('03', 'docs/x.md')];
      // Producer shape: waived items carry ONLY a reason (MarkWaived passes class ""),
      // never a classification.
      cov['waived'] = [item('03', 'docs/x.md', { reason: 'generated file' })];
      compatible(root(m), expectation());
    });

    it('positive: meaningful path spaces are preserved and matched exactly', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [item('01', 'src/my file.ts')];
      cov['completed'] = [item('01', 'src/my file.ts')];
      compatible(root(m), expectation({ requiredPaths: ['src/my file.ts'] }));
    });

    it('positive: processed paths never grow from the required set (extra completed file reported)', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [item('01', 'src/a.ts'), item('02', 'src/b.ts'), item('03', 'src/extra.ts')];
      cov['completed'] = [item('01', 'src/a.ts'), item('02', 'src/b.ts'), item('03', 'src/extra.ts')];
      const v = compatible(root(m), expectation({ requiredPaths: ['src/a.ts'] }));
      expect(v.processedPaths).toEqual(['src/a.ts', 'src/b.ts', 'src/extra.ts']);
    });

    it('hold missing-output: null and undefined are absent output', () => {
      hold(null, expectation(), 'missing-output');
      hold(undefined, expectation(), 'missing-output');
    });

    it.each([
      ['a bare string', 'not json'],
      ['a number', 42],
      ['an array', [1, 2]],
      ['a boolean', true],
    ])('hold malformed-output: %s is not a result object', (_label, raw) => {
      hold(raw, expectation(), 'malformed-output');
    });

    it('hold missing-manifest: no manifest key / null manifest', () => {
      hold({ status: 'complete' }, expectation(), 'missing-manifest');
      hold(root(null), expectation(), 'missing-manifest');
    });

    it.each([
      ['a future schema', 'ocr.run-manifest/v2'],
      ['an absent schema', undefined],
    ])('hold incompatible-schema: schema_version %s', (_label, schemaVersion) => {
      const m = manifest();
      delete m['schema_version'];
      if (schemaVersion !== undefined) m['schema_version'] = schemaVersion;
      hold(root(m), expectation(), 'incompatible-schema');
    });

    it('hold wrong-operation: operation scan is a different duty', () => {
      hold(root(manifest({ operation: 'scan' })), expectation(), 'wrong-operation');
    });

    it('hold wrong-mode: commit mode is not a range review', () => {
      const m = manifest();
      (m['input'] as Record<string, unknown>)['mode'] = 'commit';
      hold(root(m), expectation(), 'wrong-mode');
    });

    it.each([
      ['a newer version', '1.14.0'],
      ['an absent version', undefined],
      ['an empty version', ''],
    ])('hold incompatible-version: execution.ocr_version %s', (_label, version) => {
      const m = manifest();
      const ex = m['execution'] as Record<string, unknown>;
      delete ex['ocr_version'];
      if (version !== undefined) ex['ocr_version'] = version;
      hold(root(m), expectation(), 'incompatible-version');
    });

    it('hold stale-identity: resolved_base differs from the independent expectation', () => {
      const m = manifest();
      (m['input'] as Record<string, unknown>)['resolved_base'] = 'f'.repeat(40);
      hold(root(m), expectation(), 'stale-identity');
    });

    it('hold stale-identity: a PR base REF string is not a merge-base SHA', () => {
      const m = manifest();
      (m['input'] as Record<string, unknown>)['resolved_base'] = 'staging';
      hold(root(m), expectation(), 'stale-identity');
    });

    it('hold stale-identity: exact_range mismatch', () => {
      const m = manifest();
      (m['input'] as Record<string, unknown>)['exact_range'] = `${'f'.repeat(40)}..${HEAD}`;
      hold(root(m), expectation(), 'stale-identity');
    });

    it('hold stale-identity: omitted resolved fields (omitempty encoding) are never fabricated', () => {
      const m = manifest();
      const input = m['input'] as Record<string, unknown>;
      delete input['resolved_base'];
      delete input['resolved_head'];
      delete input['exact_range'];
      hold(root(m), expectation(), 'stale-identity');
    });

    it('hold stale-identity: a missing/empty EXPECTATION cannot be compatible', () => {
      hold(root(manifest()), expectation({ resolvedBase: '', resolvedHead: '', expectedRange: '' }), 'stale-identity');
    });

    it.each(['partial', 'failed', 'skipped'])(
      'hold run-incomplete: terminal_state %s is not full evidence',
      (state) => {
        hold(root(manifest({ terminal_state: state })), expectation(), 'run-incomplete');
      },
    );

    it('hold run-incomplete: legacy root status success with a complete manifest is inconsistent', () => {
      hold(root(manifest(), { status: 'success' }), expectation(), 'run-incomplete');
    });

    it('hold run-incomplete: completed_with_errors holds even with all required paths processed', () => {
      hold(root(manifest(), { status: 'completed_with_errors' }), expectation(), 'run-incomplete');
    });

    it('hold run-incomplete: root status missing terminal agreement holds', () => {
      const raw = root(manifest());
      delete raw['status'];
      hold(raw, expectation(), 'run-incomplete');
    });

    it('hold run-failure: non-null run_failure holds even with every required path processed', () => {
      const m = manifest({ run_failure: { classification: 'internal', reason: 'upstream 500' } });
      hold(root(m), expectation(), 'run-failure');
    });

    it('hold run-failure: run_failure wins deterministically over a non-complete state', () => {
      const m = manifest({
        terminal_state: 'failed',
        run_failure: { classification: 'internal', reason: 'upstream 500' },
      });
      hold(root(m, { status: 'failed' }), expectation(), 'run-failure');
    });

    it('hold inconsistent-coverage: complete with an EMPTY selected set is producer-impossible', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [];
      cov['completed'] = [];
      hold(root(m), expectation({ requiredPaths: [] }), 'inconsistent-coverage');
    });

    it('hold inconsistent-coverage: complete with a failed NON-required item is producer-impossible', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [item('01', 'src/a.ts'), item('02', 'src/b.ts'), item('03', 'docs/x.md')];
      cov['failed'] = [item('03', 'docs/x.md', { classification: 'provider', reason: 'provider timeout' })];
      hold(root(m), expectation(), 'inconsistent-coverage');
    });

    it('hold inconsistent-coverage: duplicate item_id within one outcome array', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [item('01', 'src/a.ts'), item('02', 'src/b.ts')];
      cov['completed'] = [item('01', 'src/a.ts'), item('01', 'src/a.ts'), item('02', 'src/b.ts')];
      hold(root(m), expectation(), 'inconsistent-coverage');
    });

    it('hold inconsistent-coverage: the same item_id in two outcome arrays is a conflicting outcome', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['reused'] = [item('01', 'src/a.ts')];
      cov['waived'] = [item('01', 'src/a.ts', { reason: 'generated file' })];
      cov['completed'] = [item('02', 'src/b.ts')];
      hold(root(m), expectation(), 'inconsistent-coverage');
    });

    it('hold inconsistent-coverage: an outcome item missing from selected breaks the union invariant', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [item('02', 'src/b.ts')];
      hold(root(m), expectation(), 'inconsistent-coverage');
    });

    it('hold inconsistent-coverage: a selected item with NO outcome breaks the union invariant', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [item('01', 'src/a.ts'), item('02', 'src/b.ts'), item('03', 'src/never.ts')];
      hold(root(m), expectation({ requiredPaths: ['src/a.ts'] }), 'inconsistent-coverage');
    });

    it('hold inconsistent-coverage: same item_id with a DIFFERENT path in selected vs outcome', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [item('01', 'src/OTHER.ts'), item('02', 'src/b.ts')];
      hold(root(m), expectation(), 'inconsistent-coverage');
    });

    it('hold inconsistent-coverage: same item_id with a different old_path in selected vs outcome', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [item('01', 'src/a.ts', { old_path: 'src/x.ts' }), item('02', 'src/b.ts')];
      cov['completed'] = [item('01', 'src/a.ts', { old_path: 'src/y.ts' }), item('02', 'src/b.ts')];
      hold(root(m), expectation(), 'inconsistent-coverage');
    });

    it.each([
      ['an item without item_id', { path: 'src/a.ts' }],
      ['an item without path', { item_id: '01' }],
      ['a non-object item', 'junk'],
    ])('hold inconsistent-coverage: %s', (_label, bad) => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['completed'] = [bad as unknown, item('02', 'src/b.ts')];
      hold(root(m), expectation(), 'inconsistent-coverage');
    });

    it('hold inconsistent-coverage: a NULL coverage array is not the public encoding (producer emits [])', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown>;
      cov['waived'] = null as unknown as unknown[];
      hold(root(m), expectation(), 'inconsistent-coverage');
    });

    it('hold inconsistent-coverage: a required path present ONLY in selected has NO outcome (producer union)', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [item('01', 'src/a.ts'), item('02', 'src/b.ts')];
      cov['completed'] = [item('01', 'src/a.ts')];
      // Selected-only material cannot satisfy required scope — and the producer never
      // emits a selected item without an outcome, so this is inconsistent data first.
      hold(root(m), expectation(), 'inconsistent-coverage');
    });

    it('hold inconsistent-coverage: a FAILED item under terminal_state complete is producer-impossible, required or not', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['completed'] = [item('01', 'src/a.ts')];
      cov['failed'] = [item('02', 'src/b.ts', { classification: 'input', reason: 'context overflow' })];
      // Card: complete ⇒ empty failed, "even a failed NON-required item" is inconsistent;
      // a required failed path is a fortiori not processed, but the data itself is impossible.
      hold(root(m), expectation(), 'inconsistent-coverage');
    });

    it('hold incomplete-coverage: a required WAIVED path is not processed', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['completed'] = [item('01', 'src/a.ts')];
      cov['waived'] = [item('02', 'src/b.ts', { reason: 'vendored file' })];
      hold(root(m), expectation(), 'incomplete-coverage');
    });

    it('hold incomplete-coverage: a required path absent from the result entirely', () => {
      hold(root(manifest()), expectation({ requiredPaths: ['src/a.ts', 'src/never-reviewed.ts'] }), 'incomplete-coverage');
    });

    it('hold incomplete-coverage: an exact-string match — cosmetic spacing is not silently healed', () => {
      const m = manifest();
      hold(root(m), expectation({ requiredPaths: [' src/a.ts'] }), 'incomplete-coverage');
    });

    it('the required set drives the verdict independently of the result (same result, extended requirement)', () => {
      const raw = root(manifest());
      compatible(raw, expectation());
      hold(raw, expectation({ requiredPaths: ['src/a.ts', 'src/b.ts', 'docs/NEW.md'] }), 'incomplete-coverage');
    });

    it('never mutates the supplied object (deep-frozen input survives a compatible verdict)', () => {
      const raw = root(manifest());
      const deepFreeze = (o: unknown): void => {
        if (o && typeof o === 'object') {
          for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
          Object.freeze(o);
        }
      };
      deepFreeze(raw);
      const before = JSON.stringify(raw);
      expect(() => compatible(raw, expectation())).not.toThrow();
      expect(JSON.stringify(raw)).toBe(before);
    });

    it('diagnostics carry reason-bearing names, not full raw dumps', () => {
      const v = hold(root(manifest(), { status: 'completed_with_errors' }), expectation(), 'run-incomplete');
      expect(v.detail.length).toBeLessThan(400);
      expect(v.detail).not.toContain('run-0001');
    });

    // --- C1a-I1: matching INVALID identity values on both sides must hold ---

    it('hold stale-identity: a matching PR ref NAME is not a resolved commit ID (both sides "staging")', () => {
      const m = manifest();
      (m['input'] as Record<string, unknown>)['resolved_base'] = 'staging';
      hold(root(m), expectation({ resolvedBase: 'staging' }), 'stale-identity');
    });

    it('hold stale-identity: matching 7-hex short IDs are not full resolved commit IDs', () => {
      const m = manifest();
      (m['input'] as Record<string, unknown>)['resolved_head'] = '0fedcba';
      hold(root(m), expectation({ resolvedHead: '0fedcba' }), 'stale-identity');
    });

    it('hold stale-identity: exact_range inconsistent with its own endpoints, even when both sides match', () => {
      const m = manifest();
      const wrong = `${'f'.repeat(40)}..${HEAD}`;
      (m['input'] as Record<string, unknown>)['exact_range'] = wrong;
      hold(root(m), expectation({ expectedRange: wrong }), 'stale-identity');
    });

    it('hold stale-identity: an EXPECTATION range inconsistent with its own endpoints is invalid', () => {
      hold(root(manifest()), expectation({ expectedRange: 'x..y' }), 'stale-identity');
    });

    it('hold incompatible-version: a matching EMPTY version on both sides is not compatible', () => {
      const m = manifest();
      (m['execution'] as Record<string, unknown>)['ocr_version'] = '';
      hold(root(m), expectation({ expectedOcrVersion: '' }), 'incompatible-version');
    });

    it('hold incompatible-version: a whitespace-only manifest version is blank', () => {
      const m = manifest();
      (m['execution'] as Record<string, unknown>)['ocr_version'] = '   ';
      hold(root(m), expectation({ expectedOcrVersion: '   ' }), 'incompatible-version');
    });

    it('positive: a 64-hex SHA-256 object-format commit identity is a valid resolved ID', () => {
      const base = 'a'.repeat(64);
      const head = 'b'.repeat(64);
      const m = manifest();
      const input = m['input'] as Record<string, unknown>;
      input['resolved_base'] = base;
      input['resolved_head'] = head;
      input['exact_range'] = `${base}..${head}`;
      compatible(root(m), expectation({
        requiredPaths: ['src/a.ts'],
        resolvedBase: base,
        resolvedHead: head,
        expectedRange: `${base}..${head}`,
      }));
    });

    // --- C1a-I2: optional item field types, waived reason, fingerprint identity ---

    it('hold inconsistent-coverage: a waived item without its required non-empty reason', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [item('01', 'src/a.ts'), item('02', 'src/b.ts'), item('03', 'docs/x.md')];
      cov['completed'] = [item('01', 'src/a.ts'), item('02', 'src/b.ts')];
      cov['waived'] = [item('03', 'docs/x.md')];
      hold(root(m), expectation(), 'inconsistent-coverage');
    });

    it('hold inconsistent-coverage: a waived item with a whitespace-only reason', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [item('01', 'src/a.ts'), item('02', 'src/b.ts'), item('03', 'docs/x.md')];
      cov['completed'] = [item('01', 'src/a.ts'), item('02', 'src/b.ts')];
      cov['waived'] = [item('03', 'docs/x.md', { reason: '   ' })];
      hold(root(m), expectation(), 'inconsistent-coverage');
    });

    it('hold inconsistent-coverage: a non-string fingerprint (fingerprint:42)', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [
        { item_id: '01', path: 'src/a.ts', fingerprint: 42 },
        item('02', 'src/b.ts'),
      ];
      cov['completed'] = [
        { item_id: '01', path: 'src/a.ts', fingerprint: 42 },
        item('02', 'src/b.ts'),
      ];
      hold(root(m), expectation(), 'inconsistent-coverage');
    });

    it('hold inconsistent-coverage: a non-string reason on a waived item (reason:7)', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [
        item('01', 'src/a.ts', { fingerprint: 'fp-01' }),
        item('02', 'src/b.ts', { fingerprint: 'fp-02' }),
        item('03', 'docs/x.md', { fingerprint: 'fp-03' }),
      ];
      cov['completed'] = [item('01', 'src/a.ts', { fingerprint: 'fp-01' }), item('02', 'src/b.ts', { fingerprint: 'fp-02' })];
      cov['waived'] = [{ item_id: '03', path: 'docs/x.md', fingerprint: 'fp-03', reason: 7 }];
      hold(root(m), expectation(), 'inconsistent-coverage');
    });

    it('hold inconsistent-coverage: selected/outcome fingerprint disagreement (same id and path)', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [
        item('01', 'src/a.ts', { fingerprint: 'fp-A' }),
        item('02', 'src/b.ts', { fingerprint: 'fp-02' }),
      ];
      cov['completed'] = [
        item('01', 'src/a.ts', { fingerprint: 'fp-B' }),
        item('02', 'src/b.ts', { fingerprint: 'fp-02' }),
      ];
      hold(root(m), expectation(), 'inconsistent-coverage');
    });

    it('hold inconsistent-coverage: fingerprint present on the outcome but absent on selected', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [item('01', 'src/a.ts'), item('02', 'src/b.ts')];
      cov['completed'] = [
        item('01', 'src/a.ts', { fingerprint: 'fp-A' }),
        item('02', 'src/b.ts'),
      ];
      hold(root(m), expectation(), 'inconsistent-coverage');
    });

    it('positive: matching fingerprints carried across selected and completed', () => {
      const m = manifest();
      const cov = m['coverage'] as Record<string, unknown[]>;
      cov['selected'] = [
        item('01', 'src/a.ts', { fingerprint: 'fp-A' }),
        item('02', 'src/b.ts', { fingerprint: 'fp-02' }),
      ];
      cov['completed'] = [
        item('01', 'src/a.ts', { fingerprint: 'fp-A' }),
        item('02', 'src/b.ts', { fingerprint: 'fp-02' }),
      ];
      compatible(root(m), expectation());
    });
  },
);

// Interface conformance (source only — the vendor twin is byte-equivalent after delivery).
describe('compareOcrCoverage — exported surface (source)', () => {
  it('accepts a readonly requiredPaths expectation', () => {
    const required: readonly string[] = ['src/a.ts', 'src/b.ts'] as const;
    const v = compareOcrCoverage(root(manifest()), { ...expectation(), requiredPaths: required });
    expect(v.status).toBe('compatible');
    if (v.status === 'compatible') {
      expect(v.processedPaths).toEqual(['src/a.ts', 'src/b.ts']);
    }
  });
});
