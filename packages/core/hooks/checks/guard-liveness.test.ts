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

import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  runRuleLiveness,
  runGuardLivenessCheck,
  getChangedEslintRuleIds,
  runTestQualityLiveness,
  isTestBearingPath,
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
