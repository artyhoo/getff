/**
 * guard-liveness.test.ts — Unit tests for the guard-liveness ESLint roundtrip gate.
 *
 * Paired-negative contract:
 *   ❌ ESLint rule with non-violating input → runRuleLiveness returns FAIL
 *   ✅ ESLint rule with violating input → runRuleLiveness returns PASS
 *
 * Also tests:
 *   - skipped status for unavailable plugins
 *   - no-data status for missing negative-test
 *   - getChangedEslintRuleIds diff logic
 *   - runGuardLivenessCheck aggregation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, dirname, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  runRuleLiveness,
  runGuardLivenessCheck,
  getChangedEslintRuleIds,
  runTestQualityLiveness,
  runTestQualityGate,
  getChangedFilesVsBase,
  TEST_QUALITY_FAILURE_RULE_ID,
  isTestBearingPath,
  classifyFrozenSourceInput,
  FROZEN_SOURCE_SHA256,
  FROZEN_SOURCE_STORES,
  type ManifestRule,
} from './guard-liveness.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../..');
const REAL_MANIFEST_PATH = resolve(HERE, '../../manifest/rules-manifest.json');

// A rule with a working liveness test using a known plugin rule (R12)
const R12_RULE: ManifestRule = {
  check: { type: 'eslint', rule: 'rules-as-tests/no-server-imports-in-client' },
  examples: {
    bad: "'use client';\nimport fs from 'fs';\nexport const x = 1;",
    good: "'use client';\nimport { useState } from 'react';\nexport function C() { return null; }",
  },
  'negative-test': {
    input: ["'use client';\nimport fs from 'fs';\nexport const x = 1;"],
    'expect-violation': 'rules-as-tests/no-server-imports-in-client',
  },
};

// A rule with a non-violating input (T-GLG-B: gate must go RED when bad input doesn't violate)
const BROKEN_LIVENESS_RULE: ManifestRule = {
  check: { type: 'eslint', rule: 'rules-as-tests/no-server-imports-in-client' },
  examples: {
    bad: "'use client';\nimport fs from 'fs';\nexport const x = 1;",
    good: "'use client';\nimport { useState } from 'react';\nexport function C() { return null; }",
  },
  'negative-test': {
    // This input does NOT trigger the rule (it's clean 'use client' code)
    input: ["'use client';\nimport { useState } from 'react';\nexport function C() { return null; }"],
    'expect-violation': 'rules-as-tests/no-server-imports-in-client',
  },
};

// A rule using a built-in ESLint rule (no-throw-literal)
const R6_RULE: ManifestRule = {
  check: { type: 'eslint', rule: 'no-throw-literal' },
  examples: {
    bad: "throw 'bad input';",
    good: "throw new Error('bad input');",
  },
  'negative-test': {
    input: ["throw 'bad input';"],
    'expect-violation': 'no-throw-literal',
  },
};

// A rule using an unavailable plugin (should be skipped)
const R5_RULE: ManifestRule = {
  check: { type: 'eslint', rule: '@typescript-eslint/no-floating-promises' },
  examples: {
    bad: "function send(): void { fetch('/x'); }",
    good: "async function send(): Promise<void> { await fetch('/x'); }",
  },
  'negative-test': {
    input: ["function send(): void { fetch('/x'); }"],
    'expect-violation': '@typescript-eslint/no-floating-promises',
  },
};

describe('runRuleLiveness', () => {
  /**
   * Paired-negative contract:
   *   ❌ rule with non-violating input → FAIL status (gate catches broken examples)
   *   ✅ rule with violating input and clean good → PASS status
   */
  it(
    'PAIRED-NEGATIVE: non-violating negative-test input returns fail status [GLV-1]',
    () => {
      const result = runRuleLiveness('R12', BROKEN_LIVENESS_RULE);
      expect(result.status).toBe('fail');
      expect(result.failures?.length).toBeGreaterThan(0);
    },
    10_000,
  );

  it(
    'mutation: rule with correct violating input returns pass status [GLV-1]',
    () => {
      const result = runRuleLiveness('R12', R12_RULE);
      expect(result.status).toBe('pass');
    },
    10_000,
  );

  it(
    'built-in ESLint rule (no-throw-literal) returns pass when input violates [GLV-2]',
    () => {
      const result = runRuleLiveness('R6', R6_RULE);
      expect(result.status).toBe('pass');
    },
    10_000,
  );

  it('unavailable plugin returns skipped status [GLV-3]', () => {
    const result = runRuleLiveness('R5', R5_RULE);
    expect(result.status).toBe('skipped');
    expect(result.reason).toMatch(/plugin.*not registered/);
  });

  it('rule with no negative-test returns no-data status [GLV-4]', () => {
    const noDataRule: ManifestRule = {
      check: { type: 'eslint', rule: 'rules-as-tests/no-server-imports-in-client' },
      examples: { bad: 'bad', good: 'good' },
    };
    const result = runRuleLiveness('R99', noDataRule);
    expect(result.status).toBe('no-data');
  });

  it('non-eslint rule returns n/a status [GLV-5]', () => {
    const manualRule: ManifestRule = {
      check: { type: 'manual' },
      examples: { bad: 'bad', good: 'good' },
    };
    const result = runRuleLiveness('IR1', manualRule);
    expect(result.status).toBe('n/a');
  });

  it(
    'rule with good example that violates returns fail status [GLV-6]',
    () => {
      // good example same as bad — rule fires on both → fail
      const badGoodRule: ManifestRule = {
        check: { type: 'eslint', rule: 'rules-as-tests/no-server-imports-in-client' },
        examples: {
          bad: "'use client';\nimport fs from 'fs';\nexport const x = 1;",
          good: "'use client';\nimport fs from 'fs';\nexport const x = 1;",
        },
        'negative-test': {
          input: ["'use client';\nimport fs from 'fs';\nexport const x = 1;"],
          'expect-violation': 'rules-as-tests/no-server-imports-in-client',
        },
      };
      const result = runRuleLiveness('R99', badGoodRule);
      expect(result.status).toBe('fail');
      expect(result.failures?.join('')).toMatch(/unexpected violation/);
    },
    10_000,
  );

  it(
    'parse-error negative-test input is reported as a miss, never matched as a violation [GLV-1][TAK-S2-GLV-FALLTHROUGH]',
    () => {
      // cf3/D5 discharge at the SUITE layer (S2 m12-glv-suite-sensitivity): a malformed
      // input lints to exactly one fatal parse-error message (ruleId null, messageId
      // undefined) — ONE reached message class at the matchesViolation fallthrough, not
      // the only one: the installed linter also emits a nonfatal ruleId-null
      // unused-disable warning there (NONEXCLUSIVE-REACHABILITY.json), and a clean
      // zero-message input never invokes the matcher (some() over an empty array).
      // A healthy matcher reports the miss → status fail. The permissive
      // fallthrough mutant (final return true, frozen cf3 fault) counts the parse error
      // AS the requested violation → status pass — the 25-case suite before this test
      // stayed green under that mutant (reached-not-killed: historical cf3 record;
      // reproduced on the current 29f3 25-case suite by the author firstRED witness
      // and independently).
      const parseErrorRule: ManifestRule = {
        check: { type: 'eslint', rule: 'rules-as-tests/no-server-imports-in-client' },
        examples: R12_RULE.examples,
        'negative-test': {
          input: ['const totally = ;'],
          'expect-violation': 'rules-as-tests/no-server-imports-in-client',
        },
      };
      const missResult = runRuleLiveness('R12_PARSE_ERROR', parseErrorRule);
      expect(missResult.status).toBe('fail');
      expect(missResult.failures?.length).toBeGreaterThan(0);

      // Legitimate companion (same rule, actually-violating input): still passes —
      // the repair kills the permissive fallthrough WITHOUT weakening the gate.
      const legitResult = runRuleLiveness('R12', R12_RULE);
      expect(legitResult.status).toBe('pass');
    },
    10_000,
  );
});

describe('getChangedEslintRuleIds', () => {
  it('returns all ESLint rule IDs when base is null (new branch)', () => {
    const manifest = JSON.stringify({
      R2: { check: { type: 'eslint', rule: 'r/a' }, examples: { bad: '', good: '' } },
      R1: { check: { type: 'manual' }, examples: { bad: '', good: '' } },
    });
    const ids = getChangedEslintRuleIds(null, manifest);
    expect(ids).toContain('R2');
    expect(ids).not.toContain('R1');
  });

  it('returns only changed ESLint rules when base is provided', () => {
    const base = JSON.stringify({
      R2: { check: { type: 'eslint', rule: 'r/a' }, examples: { bad: 'old', good: 'good' } },
      R6: { check: { type: 'eslint', rule: 'no-throw-literal' }, examples: { bad: "throw 'x';", good: "throw new Error();" } },
    });
    const current = JSON.stringify({
      R2: { check: { type: 'eslint', rule: 'r/a' }, examples: { bad: 'new', good: 'good' } }, // changed
      R6: { check: { type: 'eslint', rule: 'no-throw-literal' }, examples: { bad: "throw 'x';", good: "throw new Error();" } }, // unchanged
    });
    const ids = getChangedEslintRuleIds(base, current);
    expect(ids).toContain('R2');
    expect(ids).not.toContain('R6');
  });

  it('includes new rules added in current manifest', () => {
    const base = JSON.stringify({
      R2: { check: { type: 'eslint', rule: 'r/a' }, examples: { bad: 'b', good: 'g' } },
    });
    const current = JSON.stringify({
      R2: { check: { type: 'eslint', rule: 'r/a' }, examples: { bad: 'b', good: 'g' } },
      R7: { check: { type: 'eslint', rule: 'r/b' }, examples: { bad: 'b', good: 'g' } }, // new
    });
    const ids = getChangedEslintRuleIds(base, current);
    expect(ids).not.toContain('R2');
    expect(ids).toContain('R7');
  });
});

describe('runGuardLivenessCheck', () => {
  it('aggregates pass/fail/skipped/no-data correctly', () => {
    const manifest: Record<string, ManifestRule> = {
      R12: R12_RULE,
      R5: R5_RULE,
      R99: {
        check: { type: 'eslint', rule: 'rules-as-tests/no-server-imports-in-client' },
        examples: { bad: 'b', good: 'g' },
      },
      R_BROKEN: BROKEN_LIVENESS_RULE,
    };
    const report = runGuardLivenessCheck(['R12', 'R5', 'R99', 'R_BROKEN'], manifest);
    expect(report.passed).toContain('R12');
    expect(report.skipped.some((s) => s.startsWith('R5'))).toBe(true);
    expect(report.noData).toContain('R99');
    expect(report.failures.some((f) => f.ruleId === 'R_BROKEN')).toBe(true);
  });
});

describe('real-manifest liveness — selector-family rules R18/R13 [GLV-R18]', () => {
  /**
   * Regression lock for the R18 callback-vs-call false positive surfaced by the
   * full-sweep during PR #711 (2026-06-24). R18.examples.good validates with a
   * point-free `.then(OrderSchema.parse)` — a parse REFERENCE passed as a `.then`
   * callback, NOT a `parse(...)` CallExpression. The original selector matched only
   * `CallExpression[callee.property.name=/^(parse|safeParse)$/]`, so `:not(:has(...))`
   * fired on the compliant good example. The fix broadens the inner match to
   * `MemberExpression[property.name=/^(parse|safeParse)$/]`; a direct `Schema.parse(x)`
   * call contains that MemberExpression as its callee, so BOTH the call and the
   * point-free reference are accepted, while a queryFn with no `.parse`/`.safeParse`
   * member at all (the negative-test input) still trips.
   *
   * This runs the REAL shipped manifest (not a synthetic fixture), so it locks the
   * actual rule the consumer receives. `runRuleLiveness` returns 'pass' only when
   * every negative-test input violates AND examples.good is clean — so 'pass'
   * simultaneously proves no false positive (good) and no false negative (negative-test).
   *
   * Paired-negative contract:
   *   ❌ narrow CallExpression-only selector → examples.good false-positives → status 'fail'
   *   ✅ broadened MemberExpression selector → good clean, negative-test trips → status 'pass'
   */
  const manifest = JSON.parse(readFileSync(REAL_MANIFEST_PATH, 'utf8')) as Record<string, ManifestRule>;

  it(
    'R18: point-free `.then(Schema.parse)` good example does not false-positive; negative-test still trips → pass [GLV-R18]',
    () => {
      const result = runRuleLiveness('R18', manifest.R18);
      expect(result.status, JSON.stringify(result.failures)).toBe('pass');
    },
    10_000,
  );

  it(
    'R13: same no-restricted-syntax selector family — no analogous callback-vs-call gap → pass [GLV-R18]',
    () => {
      const result = runRuleLiveness('R13', manifest.R13);
      expect(result.status, JSON.stringify(result.failures)).toBe('pass');
    },
    10_000,
  );
});

// ─── Test-quality arm (S1 kernel, Q1/Q2) ─────────────────────────────────────

describe('isTestBearingPath', () => {
  it('recognizes test-suffixed and test-directory paths, rejects production paths', () => {
    expect(isTestBearingPath('src/foo.test.ts')).toBe(true);
    expect(isTestBearingPath('src/foo.spec.mjs')).toBe(true);
    expect(isTestBearingPath('a/tests/helper.ts')).toBe(true);
    expect(isTestBearingPath('a/__tests__/helper.tsx')).toBe(true);
    expect(isTestBearingPath('src/foo.ts')).toBe(false);
    // the assurance corpus itself is NOT test-bearing by path (no .test. infix)
    expect(isTestBearingPath('scripts/test-assurance/corpus/q1-vacuous/bad.literal-identity.ts')).toBe(false);
  });
});

describe('runTestQualityLiveness', () => {
  it('rejects a vacuous assertion in a changed test file [TQ-1]', () => {
    // ESLint 10 flat-config matching rejects `..`/outside-repo filenames, and node_modules
    // is a default flat-config ignore, so scratch fixtures live in the gitignored
    // /.ai-factory/ scratch area — same in-repo shape as the real changed-file invocation.
    const dir = mkdtempSync(join(REPO_ROOT, '.ai-factory', 'tq-live-'));
    const file = join(dir, 'bad.test.ts');
    writeFileSync(file, `it('vacuous', () => { expect(true).toBe(true); });\n`);
    const rel = relative(REPO_ROOT, file);
    const result = runTestQualityLiveness([rel]);
    rmSync(dir, { recursive: true, force: true });
    expect(result.error).toBeUndefined();
    expect(result.files).toEqual([rel]);
    expect(result.violations.some((v) => v.includes('no-vacuous-assertion'))).toBe(true);
  });

  it('rejects an assertion-less test body [TQ-2]', () => {
    const dir = mkdtempSync(join(REPO_ROOT, '.ai-factory', 'tq-live-'));
    const file = join(dir, 'hollow.test.ts');
    writeFileSync(file, `it('hollow', () => { console.log('x'); });\n`);
    const rel = relative(REPO_ROOT, file);
    const result = runTestQualityLiveness([rel]);
    rmSync(dir, { recursive: true, force: true });
    expect(result.violations.some((v) => v.includes('require-effective-assertion'))).toBe(true);
  });

  it('admits a conforming test file [TQ-3]', () => {
    const dir = mkdtempSync(join(REPO_ROOT, '.ai-factory', 'tq-live-'));
    const file = join(dir, 'good.test.ts');
    writeFileSync(file, `it('real', () => { expect(id(1)).toBe(1); });\n`);
    const rel = relative(REPO_ROOT, file);
    const result = runTestQualityLiveness([rel]);
    rmSync(dir, { recursive: true, force: true });
    expect(result.violations).toEqual([]);
  });

  it('fails closed on an unreadable changed test file — never silent green [TQ-4]', () => {
    const result = runTestQualityLiveness(['definitely/missing/q1.test.ts']);
    expect(result.error).toContain('unreadable');
    expect(result.violations).toEqual([]);
  });

  it('lints nothing when the selection has no test-bearing path (selection recorded) [TQ-5]', () => {
    const result = runTestQualityLiveness(['src/production.ts']);
    expect(result.files).toEqual([]);
    expect(result.violations).toEqual([]);
  });
});

describe('runTestQualityLiveness (mjs lane)', () => {
  it('lints .mjs test files too — locks the files-glob fix (files-less = *.mjs-only default)', () => {
    const dir = mkdtempSync(join(REPO_ROOT, '.ai-factory', 'tq-live-'));
    const file = join(dir, 'bad.test.mjs');
    writeFileSync(file, `it('vacuous', () => { expect(1 + 1).toBe(2); });\n`);
    const rel = relative(REPO_ROOT, file);
    const result = runTestQualityLiveness([rel]);
    rmSync(dir, { recursive: true, force: true });
    expect(result.files).toEqual([rel]);
    expect(result.violations.some((v) => v.includes('no-vacuous-assertion'))).toBe(true);
  });
});

// ─── D011 SB2/R1R2 — widened selector/carrier arms (2026-10-14, additive) ─────
// The be84 hole these lock: isTestBearingPath already ADMITTED .mts/.cts and the
// unit/audit/integration names, but the carrier config's explicit glob list carried
// neither — a selected file matched by no config block lints to zero messages and
// read silently clean (the coordinator-reproduced selector/carrier divergence,
// SUP-R2-GLV-GLOB). SB2 derives the globs from the selector's own extension
// population, adds the fail-closed cover guard, and records dir-selected
// non-lintable paths instead of dropping them. The no-cover guard's load-bearing
// proof is the SUP-R2-FAILCLOSED mutant arm (recovery-d011 driver), which reverts
// the whole region and requires the recovery control to catch it.

describe('isTestBearingPath (D011 widened names)', () => {
  it('admits unit/audit/integration naming across the ts/mts/cts/js extension family', () => {
    for (const name of ['unit', 'audit', 'integration'] as const) {
      expect(isTestBearingPath(`src/foo.${name}.ts`), name).toBe(true);
      expect(isTestBearingPath(`src/foo.${name}.mts`), name).toBe(true);
      expect(isTestBearingPath(`src/foo.${name}.cts`), name).toBe(true);
      expect(isTestBearingPath(`src/foo.${name}.js`), name).toBe(true);
      expect(isTestBearingPath(`src/foo.${name}.tsx`), name).toBe(true);
    }
    expect(isTestBearingPath('src/foo.test.mts')).toBe(true);
    expect(isTestBearingPath('src/foo.spec.cts')).toBe(true);
    // the widening is about TEST-BEARING names, not any dotted suffix
    expect(isTestBearingPath('src/foo.audit-report.ts')).toBe(false);
    expect(isTestBearingPath('src/foo.units.ts')).toBe(false);
  });
});

describe('runTestQualityLiveness (D011 selector/carrier alignment)', () => {
  it('actually lints selected .mts/.cts files — the be84 carrier hole read them silently clean', () => {
    const dir = mkdtempSync(join(REPO_ROOT, '.ai-factory', 'tq-live-'));
    try {
      for (const name of ['bad.unit.mts', 'bad.audit.cts'] as const) {
        writeFileSync(join(dir, name), `it('vacuous', () => { expect(1 + 1).toBe(2); });\n`);
      }
      const rels = ['bad.unit.mts', 'bad.audit.cts'].map((n) => relative(REPO_ROOT, join(dir, n)));
      const result = runTestQualityLiveness(rels);
      expect(result.error).toBeUndefined();
      expect(result.files).toEqual(rels);
      expect(result.violations.filter((v) => v.includes('no-vacuous-assertion')).length).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('lints tests/-directory selected files (location axis), not just suffix-named ones', () => {
    const dir = mkdtempSync(join(REPO_ROOT, '.ai-factory', 'tq-live-'));
    mkdirSync(join(dir, 'tests'));
    const file = join(dir, 'tests', 'helper.vacuous.ts');
    writeFileSync(file, `it('vacuous', () => { expect(true).toBe(true); });\n`);
    const rel = relative(REPO_ROOT, file);
    const result = runTestQualityLiveness([rel]);
    rmSync(dir, { recursive: true, force: true });
    expect(result.files).toEqual([rel]);
    expect(result.violations.some((v) => v.includes('no-vacuous-assertion'))).toBe(true);
  });

  it('records dir-selected NON-lintable paths in nonLintable — never silently clean, never an error', () => {
    const dir = mkdtempSync(join(REPO_ROOT, '.ai-factory', 'tq-live-'));
    mkdirSync(join(dir, 'tests'));
    const file = join(dir, 'tests', 'notes.md');
    writeFileSync(file, `# notes — dir-selected but not lintable\n`);
    const rel = relative(REPO_ROOT, file);
    const result = runTestQualityLiveness([rel]);
    rmSync(dir, { recursive: true, force: true });
    expect(isTestBearingPath(rel)).toBe(true);
    expect(result.files).toEqual([]);
    expect(result.nonLintable).toEqual([rel]);
    expect(result.violations).toEqual([]);
    expect(result.error).toBeUndefined();
  });

  it('a conforming .unit.mts companion stays clean under the widened carrier (no over-rejection)', () => {
    const dir = mkdtempSync(join(REPO_ROOT, '.ai-factory', 'tq-live-'));
    const file = join(dir, 'good.unit.mts');
    writeFileSync(file, `import { expect, it } from 'vitest';\nit('real', () => { expect(JSON.parse('1')).toBe(1); });\n`);
    const rel = relative(REPO_ROOT, file);
    const result = runTestQualityLiveness([rel]);
    rmSync(dir, { recursive: true, force: true });
    expect(result.error).toBeUndefined();
    expect(result.files).toEqual([rel]);
    expect(result.violations).toEqual([]);
  });
});

// ─── Frozen intentional-fixture SOURCE role (unit 46/47, Root exact-30) ───────
// The pre-push Q1/Q2 arm used to lint the 17 immutable SOURCE inputs the delivery
// Adds under the two recovery fixture stores — their vacuous assertions are the
// point of the fixtures. This block locks the ADAPTED canonical SOURCE role:
// exact-30 recognition with byte/mode/canonical-form verification, distinct
// sourceClassified reporting (never linted/detected/live-passing), fail-closed
// refusals for every tamper/alias form, and — critically — NO immunity for
// anything that is not the exact canonical path+bytes pair.
//
// CUSTODY (unit 47 repair #1): every fixture this block writes lives in an
// EXCLUSIVELY OWNED unique scratch root (mkdtemp under the gitignored
// /.ai-factory/ area or os.tmpdir()), using the existing isolated fixture
// lifecycle (fresh tree, removed whole in finally). Nothing here writes,
// chmods, renames or removes a canonical frozen SOURCE file, the 26 original
// probe TARGETs, or ANY preexisting canonical directory: the canonical
// repo-root `recovery-d011-population/` TARGET location and the exact store
// membership are asserted ABSENT/unchanged before and after the whole block.
// Frozen bytes are READ from the canonical fixtures, never mutated.

describe('frozen intentional-fixture SOURCE role (unit 46/47)', () => {
  const ALL_30 = Object.keys(FROZEN_SOURCE_SHA256).sort();
  const DIAGNOSED_17 = [
    ...Object.keys(FROZEN_SOURCE_SHA256).filter((p) => p.includes('/bad.vacuous')),
    ...Object.keys(FROZEN_SOURCE_SHA256).filter((p) => p.includes('/r4-runner/')),
  ].sort();
  const CANONICAL_GUARD = join(REPO_ROOT, 'packages/core/hooks/checks/guard-liveness.ts');
  const canonicalGuardHash = () =>
    createHash('sha256').update(readFileSync(CANONICAL_GUARD)).digest('hex');
  const walkFiles = (dir: string, prefix = ''): string[] => {
    const out: string[] = [];
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) out.push(...walkFiles(p, `${prefix}${name}/`));
      else out.push(`${prefix}${name}`);
    }
    return out;
  };
  const assertCustody = (label: string) => {
    // Fixed canonical locations a test must NEVER occupy or alter:
    // - the repo-root probe TARGET directory stays absent;
    // - both SOURCE stores carry exactly the exact-30 population — an unknown
    //   leftover from a crashed arm would itself be an unknown-in-store hazard.
    expect(existsSync(join(REPO_ROOT, 'recovery-d011-population')), `${label}: canonical TARGET dir`).toBe(false);
    // Test-bearing population only: the stores also carry canonical non-test
    // neighbours (r4-runner reports/*.json, counterexamples/*.json) that the
    // selector never selects — custody covers exactly the classifier's domain.
    const live = new Set<string>();
    for (const store of FROZEN_SOURCE_STORES) {
      for (const rel of walkFiles(join(REPO_ROOT, store))) {
        const p = `${store}/${rel}`;
        if (isTestBearingPath(p)) live.add(p);
      }
    }
    expect([...live].sort(), `${label}: test-bearing store membership`).toEqual(ALL_30);
    expect(canonicalGuardHash(), `${label}: canonical guard bytes`).toBe(GUARD_HASH_AT_START);
  };
  let GUARD_HASH_AT_START = '';

  beforeAll(() => {
    GUARD_HASH_AT_START = canonicalGuardHash();
    assertCustody('beforeAll');
  });
  afterAll(() => {
    assertCustody('afterAll');
  });

  it('the projection is exactly the Root exact-30 across the two stores — no more, no fewer', () => {
    expect(ALL_30).toHaveLength(30);
    expect(DIAGNOSED_17).toHaveLength(17); // 13 bad population + 4 r4-runner lanes
    for (const p of ALL_30) {
      expect(FROZEN_SOURCE_STORES.some((s) => p.startsWith(`${s}/`)), p).toBe(true);
    }
  });

  it('the trust projection is RUNTIME-immutable — no caller extension or pin rewrite (unit 47 repair #4)', () => {
    expect(Object.isFrozen(FROZEN_SOURCE_SHA256)).toBe(true);
    expect(Object.isFrozen(FROZEN_SOURCE_STORES)).toBe(true);
    const map = FROZEN_SOURCE_SHA256 as Record<string, string>;
    // Adding an unknown healthy file/hash pair is a TypeError, never a silent accept:
    expect(() => { map['scripts/test-assurance/recovery-d011/fixtures/population/healthy.NEW.test.ts'] = createHash('sha256').update('healthy').digest('hex'); }).toThrow();
    // Modifying a canonical pin to make other bytes admissible is a TypeError too:
    const pin = map['scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.ts'];
    expect(() => { map['scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.ts'] = createHash('sha256').update('tampered').digest('hex'); }).toThrow();
    expect(map['scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.ts']).toBe(pin);
    const stores = FROZEN_SOURCE_STORES as unknown as string[];
    expect(() => { stores.push('some/other/store'); }).toThrow();
    expect(Object.keys(FROZEN_SOURCE_SHA256)).toHaveLength(30);
    expect(FROZEN_SOURCE_STORES).toHaveLength(2);
    // And the projection still admits exactly the canonical bytes after the attempts:
    expect(classifyFrozenSourceInput('scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.ts')).toEqual({ status: 'known-source' });
  });

  it('all 30 exact SOURCE identities classify as intentional SOURCE against the REAL repo — including the 17 that the old gate refused', () => {
    const result = runTestQualityLiveness(ALL_30);
    expect(result.error).toBeUndefined();
    expect(result.sourceClassified.sort()).toEqual(ALL_30);
    expect(result.files).toEqual([]); // SOURCE inputs are never linted
    expect(result.violations).toEqual([]); // …never counted as detected or live-passing
    expect(result.nonLintable).toEqual([]);
    for (const p of DIAGNOSED_17) {
      expect(classifyFrozenSourceInput(p).status, p).toBe('known-source');
    }
  });

  it('the exact-17 population the unit-45 push refused now classify clean — the frozen bytes on disk are UNCHANGED (no fixture edit)', () => {
    // Byte-proven: every classified path's live bytes still hash to the frozen pin.
    for (const p of DIAGNOSED_17) {
      expect(classifyFrozenSourceInput(p)).toEqual({ status: 'known-source' });
    }
  });

  it('same bad bytes at a TARGET/live path STILL fail Q1 — the role binds path+bytes, never bytes alone', () => {
    const frozenBad = readFileSync(join(REPO_ROOT, 'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.ts'));
    // OWNED scratch root (unit 47 custody repair): the TARGET-shape twin lives
    // under a unique mkdtemp root, NOT at the canonical repo-root location.
    const dir = mkdtempSync(join(REPO_ROOT, '.ai-factory', 'tq-live-'));
    try {
      const relTarget = relative(REPO_ROOT, join(dir, 'recovery-d011-population', 'bad.vacuous.test.ts'));
      const liveRel = relative(REPO_ROOT, join(dir, 'bad.vacuous.test.ts'));
      mkdirSync(join(dir, 'recovery-d011-population'), { recursive: true });
      writeFileSync(join(dir, 'recovery-d011-population', 'bad.vacuous.test.ts'), frozenBad);
      writeFileSync(join(dir, 'bad.vacuous.test.ts'), frozenBad);
      const result = runTestQualityLiveness([relTarget, liveRel]);
      expect(result.error).toBeUndefined();
      expect(result.sourceClassified).toEqual([]);
      expect(result.files.sort()).toEqual([liveRel, relTarget].sort());
      expect(result.violations.filter((v) => v.includes('no-vacuous-assertion')).length).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('an UNKNOWN basename inside a SOURCE store is a HARD failure — healthy or bad bytes alike (unit 47 repair #2)', () => {
    // Owned scratch tree carrying the exact-30 layout; an unknown name inside a
    // store must REFUSE (result.error), never silently lint and never inherit
    // SOURCE status — the unit-46 seed silently passed unknown HEALTHY inputs.
    const root = scratchStoreRoot();
    try {
      const unknownBad = 'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.NEW.test.ts';
      const unknownHealthy = 'scripts/test-assurance/recovery-d011/fixtures/population/healthy.sounding.test.ts';
      writeFileSync(join(root, unknownBad), `it('vacuous', () => { expect(true).toBe(true); });\n`);
      writeFileSync(join(root, unknownHealthy), `import { expect, it } from 'vitest';\nit('real', () => { expect(JSON.parse('1')).toBe(1); });\n`);
      expect(classifyFrozenSourceInput(unknownBad, root)).toEqual({ status: 'unknown-in-store' });
      expect(classifyFrozenSourceInput(unknownHealthy, root)).toEqual({ status: 'unknown-in-store' });
      for (const rel of [unknownBad, unknownHealthy]) {
        const result = runTestQualityLiveness([rel], root);
        expect(result.error, rel).toContain('not part of the canonical exact-30 projection');
        expect(result.violations, rel).toEqual([]);
        expect(result.sourceClassified, rel).toEqual([]);
        expect(result.files, rel).toEqual([]);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('noncanonical/whitespace twins of a known name never inherit its immunity (unit 47 repair #3)', () => {
    const root = scratchStoreRoot();
    try {
      const canonical = 'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.ts';
      const trailingSpace = `${canonical} `;
      const quoted = `"${canonical}"`;
      writeFileSync(join(root, trailingSpace), readFileSync(join(root, canonical)));
      expect(classifyFrozenSourceInput(trailingSpace, root)).toEqual({ status: 'unknown-in-store' });
      // The selector does not even admit the trailing-space spelling as test-bearing
      // (the `$`-anchored suffix match rejects it) — so it can never be selected,
      // never linted, and never granted SOURCE status. Selection semantics stay
      // exactly as before: whitespace never collapses onto the canonical name.
      const spaced = runTestQualityLiveness([trailingSpace], root);
      expect(spaced.error).toBeUndefined();
      expect(spaced.sourceClassified).toEqual([]);
      expect(spaced.files).toEqual([]);
      expect(spaced.violations).toEqual([]);
      // A quoted spelling `"scripts/..."` does not even match the store prefix
      // (it starts with `"`), so it lands in the ordinary lint lane — it can
      // never reach the exact-30 map. Git's non-`-z` output shape dies here too.
      expect(classifyFrozenSourceInput(quoted, root)).toEqual({ status: 'not-in-store' });
      // …while the valid canonical spelling is recognized SEPARATELY in the same tree:
      expect(classifyFrozenSourceInput(canonical, root)).toEqual({ status: 'known-source' });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('REAL Git caller delivers committed affected filenames EXACTLY — canonical SOURCE path included, no quoted spellings (unit 47 repair #3)', () => {
    // 8fdb2ee added the r4-runner + population fixtures: the production caller
    // over that real committed change must hand the classifier the EXACT names.
    const { files, error } = getChangedFilesVsBase('8fdb2ee87aff0dbca11a1dbb650b18f9400e65db^');
    expect(error).toBeUndefined();
    for (const p of ALL_30) expect(files, p).toContain(p);
    // eedaf12a added a research patch whose name carries a UTF-8 §: without -z,
    // git quotes it as `"\302\247..."` and a newline split would corrupt it.
    const nonAscii = getChangedFilesVsBase('eedaf12a7ac3c2bcab2b7f0b80b2adbef683c7a6^');
    expect(nonAscii.error).toBeUndefined();
    const sect = nonAscii.files.find((f) => f.includes('§13.21-l3-revision.md'));
    expect(sect).toBeDefined();
    expect(sect!.startsWith('"')).toBe(false); // no C-style quoting wrapper
    expect(sect!.includes('\\302')).toBe(false); // no octal escape residue
    // The exact bytes match the tracked filename (readdir is the independent source):
    const tracked = readdirSync(join(REPO_ROOT, 'docs/meta-factory/research-patches')).find((n) => n.includes('13.21-l3-revision'));
    expect(sect!.endsWith(tracked!)).toBe(true);
    // And the real production GATE over that historical fixture-adding change
    // classifies the SOURCE inputs instead of failing on them (no violations,
    // no error): valid canonical SOURCE path recognized through the real caller.
    const gate = runTestQualityGate('8fdb2ee87aff0dbca11a1dbb650b18f9400e65db^');
    expect(gate).toBeNull();
  }, 240_000);

  it('over-rejecting-healthy sensitivity: a conforming live test and the good SOURCE inputs both stay non-refused', () => {
    const goodRel = Object.keys(FROZEN_SOURCE_SHA256).find((p) => p.endsWith('/good.assertive.test.ts'))!;
    expect(classifyFrozenSourceInput(goodRel).status).toBe('known-source');
    const dir = mkdtempSync(join(REPO_ROOT, '.ai-factory', 'tq-live-'));
    try {
      const rel = relative(REPO_ROOT, join(dir, 'healthy.test.ts'));
      writeFileSync(join(dir, 'healthy.test.ts'), `import { expect, it } from 'vitest';\nit('real', () => { expect(JSON.parse('2')).toBe(2); });\n`);
      const result = runTestQualityLiveness([rel, goodRel]);
      expect(result.error).toBeUndefined();
      expect(result.violations).toEqual([]);
      expect(result.sourceClassified).toEqual([goodRel]);
      expect(result.files).toEqual([rel]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // Scratch-root refusals: each arm builds a fresh scratch tree carrying the
  // REAL frozen bytes at a known-30 path (read from the canonical store), mutates
  // exactly one dimension, and requires the refusal. The canonical fixtures are
  // never touched; each scratch root is removed whole afterwards.
  const scratchStoreRoot = () => {
    const root = mkdtempSync(join(tmpdir(), 'tak-src-role-'));
    for (const rel of Object.keys(FROZEN_SOURCE_SHA256)) {
      const abs = join(root, rel);
      mkdirSync(dirnameOrEmpty(root, rel), { recursive: true });
      writeFileSync(abs, readFileSync(join(REPO_ROOT, rel)));
    }
    return root;
  };
  const dirnameOrEmpty = (root: string, rel: string) => join(root, rel.slice(0, rel.lastIndexOf('/')));

  it('valid name, WRONG bytes refuse — and the production entry surfaces it as a fail-closed error, not a count', () => {
    const root = scratchStoreRoot();
    try {
      const rel = 'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.ts';
      writeFileSync(join(root, rel), `it('tampered', () => { expect(true).toBe(true); });\n`);
      const verdict = classifyFrozenSourceInput(rel, root);
      expect(verdict.status).toBe('refused');
      expect(verdict.status === 'refused' && verdict.reason).toContain('byte mismatch');
      // Production wiring (unit 47 repair #5): the same tamper driven through the
      // exported production entry runTestQualityLiveness — the function the gate
      // calls — must fail closed with the refusal reason, never fall back clean.
      const result = runTestQualityLiveness([rel], root);
      expect(result.error).toContain(`frozen SOURCE input '${rel}' refused`);
      expect(result.error).toContain('byte mismatch');
      expect(result.violations).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('a CLEAN replacement at a known-30 path also refuses — good-looking content never inherits the role', () => {
    const root = scratchStoreRoot();
    try {
      const rel = 'scripts/test-assurance/recovery-d011/fixtures/population/good.assertive.test.ts';
      writeFileSync(join(root, rel), `import { expect, it } from 'vitest';\nit('other-good', () => { expect(JSON.parse('3')).toBe(3); });\n`);
      const verdict = classifyFrozenSourceInput(rel, root);
      expect(verdict.status).toBe('refused');
      expect(verdict.status === 'refused' && verdict.reason).toContain('byte mismatch');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('a swapped-hash twin refuses — two known paths exchanging their pins is a mismatch, not a match', () => {
    const root = scratchStoreRoot();
    try {
      const a = 'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.ts';
      const b = 'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.cjs';
      const bufA = readFileSync(join(root, a));
      writeFileSync(join(root, a), readFileSync(join(root, b)));
      writeFileSync(join(root, b), bufA);
      for (const rel of [a, b]) {
        const verdict = classifyFrozenSourceInput(rel, root);
        expect(verdict.status, rel).toBe('refused');
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('wrong mode (executable bit) refuses — regular non-executable 100644 identity', () => {
    const root = scratchStoreRoot();
    try {
      const rel = 'scripts/test-assurance/recovery-d011/fixtures/r4-runner/healthy.test.ts';
      chmodSync(join(root, rel), 0o755);
      const verdict = classifyFrozenSourceInput(rel, root);
      expect(verdict.status).toBe('refused');
      expect(verdict.status === 'refused' && verdict.reason).toContain('executable mode');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('a symlink at a known-30 path refuses — self-link and parent-link aliases alike', () => {
    const root = scratchStoreRoot();
    try {
      const rel = 'scripts/test-assurance/recovery-d011/fixtures/r4-runner/healthy.test.ts';
      const abs = join(root, rel);
      const parked = join(root, 'parked-healthy.test.ts');
      renameSync(abs, parked);
      symlinkSync(parked, abs); // self-link: correct bytes reachable ONLY through a symlink
      const verdict = classifyFrozenSourceInput(rel, root);
      expect(verdict.status).toBe('refused');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('an unreadable known-30 path refuses (EACCES), restored byte-proven afterwards', () => {
    const root = scratchStoreRoot();
    const rel = 'scripts/test-assurance/recovery-d011/fixtures/population/good.assertive.spec.mjs';
    const abs = join(root, rel);
    try {
      chmodSync(abs, 0o000);
      const verdict = classifyFrozenSourceInput(rel, root);
      expect(verdict.status).toBe('refused');
      expect(verdict.status === 'refused' && /unreadable|missing/.test(verdict.reason)).toBe(true);
    } finally {
      // byte-proven restore INSIDE the arm, then the whole scratch root goes away
      chmodSync(abs, 0o644);
      const verdict = classifyFrozenSourceInput(rel, root);
      expect(verdict).toEqual({ status: 'known-source' });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('OS 0600 vs 0644 on a frozen SOURCE path is NOT a mode change — both classify known-source', () => {
    const root = scratchStoreRoot();
    try {
      const rel = 'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.spec.mjs';
      chmodSync(join(root, rel), 0o600);
      expect(classifyFrozenSourceInput(rel, root)).toEqual({ status: 'known-source' });
      chmodSync(join(root, rel), 0o644);
      expect(classifyFrozenSourceInput(rel, root)).toEqual({ status: 'known-source' });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('traversal / dot-segment / absolute aliases refuse before any read of an escaped target', () => {
    const rel = 'scripts/test-assurance/recovery-d011/fixtures/population/../../escape.test.ts';
    expect(classifyFrozenSourceInput(rel)).toEqual({ status: 'refused', reason: expect.stringContaining('noncanonical path form') });
    expect(classifyFrozenSourceInput('scripts/test-assurance/recovery-d011/fixtures/population/./bad.vacuous.test.ts').status).toBe('refused');
    expect(classifyFrozenSourceInput('/etc/passwd').status).toBe('not-in-store'); // absolute never matches the canonical store spelling
  });

  it('a missing known-30 path refuses — never silently skipped', () => {
    const root = scratchStoreRoot();
    try {
      const rel = 'scripts/test-assurance/recovery-d011/fixtures/r4-runner/unhandled.test.ts';
      rmSync(join(root, rel), { force: true });
      const verdict = classifyFrozenSourceInput(rel, root);
      expect(verdict.status).toBe('refused');
      expect(verdict.status === 'refused' && /missing|unreadable/.test(verdict.reason)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // ── Real counterfactual sensitivity (unit 47 repair #5; unit-47 remainder hardening) ──
  // The unit-46 seed named two tests «classifier-disabled» / «over-rejecting»
  // while merely linting ordinary twins — claims the code never made good on.
  // These arms MUTATE a copy of the production module in an owned scratch lab
  // (never the canonical file), run the mutated copy as a REAL subprocess
  // through the exported production entry, require the RED, then prove the
  // un-mutated (healed) copy goes GREEN in the same lab. Hash discipline
  // (Root unit-47 remainder): the mutant is compared against the REBOUND
  // baseline (the same copy after import/REPO_ROOT rebinding, BEFORE the
  // mutation), the healed copy must hash EXACTLY that baseline, and the
  // canonical file stays byte-identical throughout — the emitted
  // MUTANT-HASHES lines record baseline/mutant/healed/canonical per arm.
  interface LabRunSpec {
    files?: string[];
    rootDir?: string;
    base?: string;
  }
  const runLabModule = (mutate: ((src: string) => string) | null, run: LabRunSpec = {}) => {
    const lab = mkdtempSync(join(REPO_ROOT, '.ai-factory', 'glv-mut-'));
    try {
      const original = readFileSync(CANONICAL_GUARD, 'utf8');
      const repoRootLiteral = JSON.stringify(REPO_ROOT);
      // Rebind the copy to the REAL repo (imports + REPO_ROOT), then mutate.
      const replacements: Array<[string, string]> = [
        ["from '../../eslint-rules/index.ts'", `from '${pathToFileURL(join(REPO_ROOT, 'packages/core/eslint-rules/index.ts')).href}'`],
        ["from '../utils/run-check.ts'", `from '${pathToFileURL(join(REPO_ROOT, 'packages/core/hooks/utils/run-check.ts')).href}'`],
        ["const REPO_ROOT = resolve(HERE, '../../../..');", `const REPO_ROOT = ${repoRootLiteral};`],
      ];
      let src = original;
      for (const [from, to] of replacements) {
        if (src.split(from).length !== 2) throw new Error(`lab rebind anchor not unique: ${from}`);
        src = src.replace(from, to);
      }
      // The comparable baseline is the REBOUND copy (post-rebind, pre-mutation) —
      // NOT the canonical pre-rebind hash: only rebound↔mutated differ by exactly
      // the deliberate fault, so `mutated !== baseline` is a real single-fault proof.
      const baselineHash = createHash('sha256').update(src).digest('hex');
      if (mutate) src = mutate(src);
      writeFileSync(join(lab, 'mutant.ts'), src);
      const mutatedHash = createHash('sha256').update(src).digest('hex');
      const files = run.files ?? ALL_30;
      const rootArg = run.rootDir ? `, ${JSON.stringify(run.rootDir)}` : '';
      writeFileSync(join(lab, 'runner.ts'), [
        "import { runTestQualityLiveness, runTestQualityGate, getChangedFilesVsBase } from './mutant.ts';",
        `const files = ${JSON.stringify(files)};`,
        `const r = runTestQualityLiveness(files${rootArg});`,
        "const perFile = files.map((f) => ({ f, violated: r.violations.some((v) => v.startsWith(f + ':')), source: r.sourceClassified.includes(f) }));",
        "console.log('MUTANT-RUN ' + JSON.stringify({ error: r.error ?? null, violations: r.violations.length, linted: r.files.length, sourceClassified: r.sourceClassified.length, perFile }));",
        ...(run.base
          ? [`const g = runTestQualityGate(${JSON.stringify(run.base)}${rootArg});`,
            "console.log('MUTANT-GATE ' + JSON.stringify({ isNull: g === null, failureCount: g === null ? 0 : g.failures.length, failures: g === null ? null : g.failures.slice(0, 12) }));",
            "const lead = files.find((f) => f.startsWith(' ')) ?? '';",
            "const canon = lead.trim();",
            `const c = getChangedFilesVsBase(${JSON.stringify(run.base)}${rootArg});`,
            "console.log('MUTANT-CALLER ' + JSON.stringify({ error: c.error ?? null, exactLeading: c.files.filter((f) => f === lead).length, canonicalCount: c.files.filter((f) => f === canon).length }));"]
          : []),
        '',
      ].join('\n'));
      const tsxBin = join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
      const out = existsSync(tsxBin)
        ? execFileSync(tsxBin, [join(lab, 'runner.ts')], { cwd: REPO_ROOT, encoding: 'utf8' })
        : execFileSync('npx', ['tsx', join(lab, 'runner.ts')], { cwd: REPO_ROOT, encoding: 'utf8' });
      const line = out.split('\n').find((l) => l.startsWith('MUTANT-RUN '));
      if (!line) throw new Error(`lab runner produced no MUTANT-RUN line: ${out.slice(0, 400)}`);
      const gateLine = out.split('\n').find((l) => l.startsWith('MUTANT-GATE '));
      const callerLine = out.split('\n').find((l) => l.startsWith('MUTANT-CALLER '));
      return {
        summary: JSON.parse(line.slice('MUTANT-RUN '.length)) as {
          error: string | null;
          violations: number;
          linted: number;
          sourceClassified: number;
          perFile: Array<{ f: string; violated: boolean; source: boolean }>;
        },
        gate: gateLine ? (JSON.parse(gateLine.slice('MUTANT-GATE '.length)) as { isNull: boolean; failureCount: number; failures: string[] | null }) : null,
        caller: callerLine ? (JSON.parse(callerLine.slice('MUTANT-CALLER '.length)) as { error: string | null; exactLeading: number; canonicalCount: number }) : null,
        baselineHash,
        mutatedHash,
      };
    } finally {
      rmSync(lab, { recursive: true, force: true });
    }
  };
  const mutateOnce = (src: string, from: string, to: string) => {
    if (src.split(from).length !== 2) throw new Error(`mutation anchor not unique: ${from}`);
    return src.replace(from, to);
  };
  // One emitted line per arm — baseline/mutant/healed/canonical (Root unit-47
  // remainder: the triplet is PUBLISHED in the normal test log, not just checked).
  const emitHashTriplet = (label: string, mutant: { baselineHash: string; mutatedHash: string }, healed: { baselineHash: string; mutatedHash: string }, canonical: string) => {
    console.log(`MUTANT-HASHES ${label} baseline=${mutant.baselineHash} mutant=${mutant.mutatedHash} healed=${healed.mutatedHash} canonical=${canonical}`);
  };

  it('ACTUAL classifier-disabled RED, then healed GREEN — the frozen 17 read green ONLY because of the classification', { timeout: 240_000 }, () => {
    const originalHash = canonicalGuardHash();
    const disabled = runLabModule((src) => mutateOnce(src,
      '  if (!store) return { status: \'not-in-store\' };',
      '  return { status: \'not-in-store\' }; // mutant: classifier disabled'));
    expect(disabled.mutatedHash).not.toBe(disabled.baselineHash); // single fault vs the REBOUND baseline
    // RED: with the role probe disabled, the diagnosed 17 lint and fail Q1.
    expect(disabled.summary.error).toBeNull();
    expect(disabled.summary.violations).toBeGreaterThanOrEqual(17);
    expect(disabled.summary.sourceClassified).toBe(0);
    expect(disabled.summary.linted).toBe(30);
    // GREEN (healed copy in the same lab, canonical bytes untouched throughout):
    const healed = runLabModule(null);
    expect(healed.summary.error).toBeNull();
    expect(healed.summary.violations).toBe(0);
    expect(healed.summary.sourceClassified).toBe(30);
    expect(healed.summary.linted).toBe(0);
    // Healed copy is the SAME rebound baseline, byte-exactly (not merely «some green bytes»):
    expect(healed.mutatedHash).toBe(disabled.baselineHash);
    expect(healed.baselineHash).toBe(disabled.baselineHash);
    emitHashTriplet('classifier-disabled', disabled, healed, originalHash);
    expect(canonicalGuardHash()).toBe(originalHash); // custody: canonical never mutated
  });

  it('ACTUAL over-rejecting-healthy RED, then healed GREEN — good SOURCE inputs must stay admitted', { timeout: 240_000 }, () => {
    const originalHash = canonicalGuardHash();
    const overReject = runLabModule((src) => mutateOnce(src,
      '  const expected = FROZEN_SOURCE_SHA256[relPath];',
      '  if (store) return { status: \'refused\', reason: \'mutant: over-rejecting healthy\' };\n  const expected = FROZEN_SOURCE_SHA256[relPath];'));
    expect(overReject.mutatedHash).not.toBe(overReject.baselineHash); // single fault vs the REBOUND baseline
    // RED: an over-rejecting classifier refuses the good SOURCE inputs too, and
    // the production entry fails closed on the refusal instead of linting them.
    expect(overReject.summary.error).toContain('mutant: over-rejecting healthy');
    expect(overReject.summary.violations).toBe(0);
    expect(overReject.summary.sourceClassified).toBe(0);
    const healed = runLabModule(null);
    expect(healed.summary.error).toBeNull();
    expect(healed.summary.violations).toBe(0);
    expect(healed.summary.sourceClassified).toBe(30);
    expect(healed.mutatedHash).toBe(overReject.baselineHash); // healed == the same rebound baseline
    expect(healed.baselineHash).toBe(overReject.baselineHash);
    emitHashTriplet('over-rejecting-healthy', overReject, healed, originalHash);
    expect(canonicalGuardHash()).toBe(originalHash); // custody: canonical never mutated
  });

  // ── ACTUAL overaccept-TARGET mutant (Root unit-47 remainder, required proof) ──
  // The two arms above exercise ALL_30 SOURCE inputs only; the outside-store
  // overaccept branch needs a REAL bad TARGET/live input. This arm runs the
  // EXISTING badTARGET predicate («same bad bytes at a TARGET/live path still
  // fail Q1») under a deliberately overaccepting classifier: a basename match
  // anywhere is laundered onto the canonical SOURCE key. The intended TARGET
  // rejection must DISAPPEAR under the mutant and RETURN after byte-exact
  // restoration — an ordinary twin relabelled as a mutant would prove nothing.
  it('ACTUAL overaccept-TARGET RED, then healed GREEN — the intended TARGET rejection dies under the fault and returns after restore', { timeout: 240_000 }, () => {
    const originalHash = canonicalGuardHash();
    const root = scratchStoreRoot();
    try {
      const targetRel = 'recovery-d011-population/bad.vacuous.test.ts';
      const canonicalRel = 'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.ts';
      const goodRel = 'scripts/test-assurance/recovery-d011/fixtures/population/good.assertive.test.ts';
      // The TARGET twin carries the SAME frozen bad bytes at a non-store path; the
      // good control is a genuine known-30 SOURCE input in the same scratch tree.
      mkdirSync(join(root, 'recovery-d011-population'), { recursive: true });
      writeFileSync(join(root, targetRel), readFileSync(join(root, canonicalRel)));
      const healthyRel = 'healthy-live.test.ts';
      writeFileSync(join(root, healthyRel), `import { expect, it } from 'vitest';\nit('real', () => { expect(JSON.parse('2')).toBe(2); });\n`);
      const files = [targetRel, goodRel, healthyRel];
      const overaccept = runLabModule((src) => mutateOnce(src,
        '  const store = FROZEN_SOURCE_STORES.find((s) => relPath === s || relPath.startsWith(`${s}/`));\n  if (!store) return { status: \'not-in-store\' };',
        '  let store = FROZEN_SOURCE_STORES.find((s) => relPath === s || relPath.startsWith(`${s}/`));\n  if (!store) {\n    const laundering = Object.keys(FROZEN_SOURCE_SHA256).find((k) => k.endsWith(`/${relPath.slice(relPath.lastIndexOf(\'/\') + 1)}`));\n    if (laundering) { relPath = laundering; store = FROZEN_SOURCE_STORES.find((s) => relPath === s || relPath.startsWith(`${s}/`)); }\n  }\n  if (!store) return { status: \'not-in-store\' }; // mutant: overaccept TARGET by basename'),
        { files, rootDir: root });
      expect(overaccept.mutatedHash).not.toBe(overaccept.baselineHash); // single fault vs the REBOUND baseline
      // RED: the existing badTARGET predicate INVERTS under the fault — the bad
      // TARGET twin is granted SOURCE immunity instead of a Q1 rejection, while
      // the genuine good SOURCE control keeps its (legitimate) classification.
      const tgtMutant = overaccept.summary.perFile.find((p) => p.f === targetRel)!;
      expect(tgtMutant.violated).toBe(false); // the intended TARGET rejection DISAPPEARED
      expect(tgtMutant.source).toBe(true); // …and was replaced by immunity
      expect(overaccept.summary.violations).toBe(0);
      const goodMutant = overaccept.summary.perFile.find((p) => p.f === goodRel)!;
      expect(goodMutant.source).toBe(true); // the good control stays admitted (legitimately)
      // GREEN (byte-exact restoration): the TARGET rejection RETURNS, the good
      // SOURCE control keeps its role, and the ordinary healthy control stays clean.
      const healed = runLabModule(null, { files, rootDir: root });
      const tgtHealed = healed.summary.perFile.find((p) => p.f === targetRel)!;
      expect(tgtHealed.violated).toBe(true); // the intended TARGET rejection RETURNED
      expect(tgtHealed.source).toBe(false);
      expect(healed.summary.error).toBeNull(); // JSON lane: healthy healed run reports no hard error
      expect(healed.summary.sourceClassified).toBe(1);
      const healthyHealed = healed.summary.perFile.find((p) => p.f === healthyRel)!;
      expect(healthyHealed.violated).toBe(false);
      expect(healthyHealed.source).toBe(false);
      expect(healed.mutatedHash).toBe(overaccept.baselineHash); // healed == the same rebound baseline
      expect(healed.baselineHash).toBe(overaccept.baselineHash);
      emitHashTriplet('overaccept-TARGET', overaccept, healed, originalHash);
      expect(canonicalGuardHash()).toBe(originalHash); // custody: canonical never mutated
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // ── Durable exact-name caller regression (Root unit-47 remainder, MAJOR) ─────
  // An OWNED isolated Git fixture (test data in the existing normal lifecycle —
  // mkdtemp + finally rmSync, plain native git, no hook suppression) commits
  // discriminating test-bearing names; the REAL exported caller and Gate must
  // receive the EXACT committed filenames. A `.trim()` after the NUL split
  // would collapse the leading-space twin onto the canonical SOURCE spelling
  // and silently grant it immunity — the trim-mutant arm inside THIS test
  // proves it fails under exactly that regression and heals byte-exactly.
  it('REAL Git caller + Gate over COMMITTED discriminating names — exact identity; a trim-after-NUL regression FAILS here and heals byte-exactly', { timeout: 240_000 }, () => {
    const fx = mkdtempSync(join(REPO_ROOT, '.ai-factory', 'glv-git-'));
    const gitFx = (args: string[]) => execFileSync('git', args, { cwd: fx, encoding: 'utf8' });
    const originalHash = canonicalGuardHash();
    try {
      gitFx(['init', '-q']);
      gitFx(['config', 'user.email', 'glv-fixture@example.invalid']);
      gitFx(['config', 'user.name', 'glv fixture']);
      writeFileSync(join(fx, 'README.md'), 'base\n');
      gitFx(['add', '-A']);
      gitFx(['commit', '-q', '-m', 'fixture base']);
      const base = gitFx(['rev-parse', 'HEAD']).trim();
      // The committed discriminating set (test data only — canonical bytes are
      // READ from the real store, never written there):
      const canonicalRel = 'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.ts';
      const leadingSpaceRel = ` ${canonicalRel}`; // trims onto the canonical SOURCE spelling
      const newlineTabRel = 'tests/new\nline\tand-tab.test.ts'; // NUL/C-quoting boundary
      const quotedLookRel = '"quoted-look.test.ts'; // literal leading quote as its OWN first byte
      const badBytes = readFileSync(join(REPO_ROOT, canonicalRel)); // exact frozen bad bytes (read-only)
      for (const [name, bytes] of [
        [canonicalRel, badBytes], // genuine SOURCE input, recognized SEPARATELY
        [leadingSpaceRel, badBytes], // would trim-collapse onto the canonical name
        [newlineTabRel, badBytes],
        [quotedLookRel, badBytes],
      ] as Array<[string, Buffer]>) {
        const slash = name.lastIndexOf('/');
        if (slash !== -1) mkdirSync(join(fx, name.slice(0, slash)), { recursive: true });
        writeFileSync(join(fx, name), bytes);
      }
      gitFx(['add', '-A']);
      gitFx(['commit', '-q', '-m', 'fixture discriminating names']);
      // REAL production caller over the committed change (rootDir seam):
      const { files, error } = getChangedFilesVsBase(base, fx);
      expect(error).toBeUndefined();
      for (const name of [canonicalRel, leadingSpaceRel, newlineTabRel, quotedLookRel]) {
        expect(files, `exact committed name ${JSON.stringify(name)}`).toContain(name);
      }
      // No C-quoting wrapper / escape residue: the newline+tab name arrives raw…
      const nl = files.find((f) => f.includes('new\nline\tand-tab.test.ts'))!;
      expect(nl.startsWith('"')).toBe(false);
      expect(nl.includes('\\n')).toBe(false);
      expect(nl.includes('\\t')).toBe(false);
      expect(nl.endsWith('.test.ts')).toBe(true);
      // …and the quoted-looking name is the LITERAL name (a C-quoted wrapper of
      // `quoted-look.test.ts` would carry a TRAILING quote too):
      expect(files).toContain('"quoted-look.test.ts');
      expect(files.some((f) => f === '"quoted-look.test.ts"')).toBe(false);
      // The leading-space name keeps its leading space — its own distinct identity,
      // delivered exactly once, never collapsed onto the canonical spelling:
      expect(files.filter((f) => f === leadingSpaceRel).length).toBe(1);
      expect(files.filter((f) => f === canonicalRel).length).toBe(1);
      // Liveness over the SAME delivered names: the canonical SOURCE path is
      // classified (immunity for the GENUINE frozen fixture only), every twin
      // lints — no sourceClassified immunity through normalization.
      const live = runTestQualityLiveness(files, fx);
      expect(live.error).toBeUndefined();
      expect(live.sourceClassified).toEqual([canonicalRel]);
      expect(live.files.slice().sort()).toEqual([leadingSpaceRel, newlineTabRel, quotedLookRel].sort());
      for (const v of live.violations) {
        expect(v.startsWith(`${canonicalRel}:`)).toBe(false); // the SOURCE input never violates
      }
      expect(live.violations.some((v) => v.startsWith(`${leadingSpaceRel}:`))).toBe(true);
      expect(live.violations.some((v) => v.startsWith(`${newlineTabRel}:`))).toBe(true);
      expect(live.violations.some((v) => v.startsWith(`${quotedLookRel}:`))).toBe(true);
      // REAL GATE over the same committed change: a Q1 failure naming the twins.
      const gate = runTestQualityGate(base, fx);
      expect(gate).not.toBeNull();
      expect(gate!.ruleId).toBe(TEST_QUALITY_FAILURE_RULE_ID);
      expect(gate!.failures.some((f) => f.startsWith(`${leadingSpaceRel}:`))).toBe(true);
      expect(gate!.failures.some((f) => f.startsWith(`${newlineTabRel}:`))).toBe(true);
      expect(gate!.failures.some((f) => f.startsWith(`${quotedLookRel}:`))).toBe(true);
      expect(gate!.failures.some((f) => f.startsWith(`${canonicalRel}:`))).toBe(false);
      // ── The durable regression proof (same fixture, same committed change) ──
      // RED: the regression itself — `.trim()` after the NUL split. The CALLER
      // collapses the committed leading-space twin onto the canonical SOURCE
      // spelling, the gate then classifies it known-source, and its Q1 rejection
      // vanishes — observed through BOTH the raw caller output and the real Gate.
      const trimmer = runLabModule((src) => mutateOnce(src,
        "return { files: diff.stdout.split('\\0').filter(Boolean) };",
        "return { files: diff.stdout.split('\\0').map((f) => f.trim()).filter(Boolean) }; // mutant: trim after NUL"),
        { files, rootDir: fx, base });
      expect(trimmer.mutatedHash).not.toBe(trimmer.baselineHash); // single fault vs the REBOUND baseline
      expect(trimmer.caller!.error).toBeNull();
      expect(trimmer.caller!.exactLeading).toBe(0); // the exact committed spelling DISAPPEARED
      expect(trimmer.caller!.canonicalCount).toBe(2); // …collapsed onto the canonical spelling
      expect(trimmer.gate!.isNull).toBe(false); // the other twins still fail Q1 …
      expect(trimmer.gate!.failures!.some((f) => f.startsWith(`${leadingSpaceRel}:`))).toBe(false); // …but the laundered twin's rejection VANISHED
      // GREEN (byte-exact restoration): every committed name keeps its identity.
      const healed = runLabModule(null, { files, rootDir: fx, base });
      expect(healed.caller!.exactLeading).toBe(1); // the exact spelling is BACK, once
      expect(healed.caller!.canonicalCount).toBe(1); // the canonical name alone
      expect(healed.gate!.failures!.some((f) => f.startsWith(`${leadingSpaceRel}:`))).toBe(true); // Q1 rejection restored
      expect(healed.mutatedHash).toBe(trimmer.baselineHash); // healed == the same rebound baseline
      expect(healed.baselineHash).toBe(trimmer.baselineHash);
      emitHashTriplet('trim-after-NUL', trimmer, healed, originalHash);
      expect(canonicalGuardHash()).toBe(originalHash); // custody: canonical never mutated
    } finally {
      rmSync(fx, { recursive: true, force: true });
    }
  });
});
