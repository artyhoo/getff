// Rule-bootstrapping SPIKE — paired-negative tests for the end-to-end skeleton.
// Principle 02 (paired-negative): a GOOD stub finding → a rule+test that FIRES
// (non-vacuous: real Linter.verify violation + clean case) AND a real rules-lock.json
// is written (the dead buildLock revived); a BAD/tautological stub finding → L4 REJECTS
// → the pipeline degrades to research-only → install() is never reached → no lock ships.
//
// Stubs inject deterministic selections; no live LLM (no-paid-llm-in-ci.md).
// T-RBI-A: research is STUBBED — these tests prove the SKELETON, not live research.

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { Linter } from 'eslint';
import * as tseslintParser from '@typescript-eslint/parser';
import { afterEach, describe, expect, it } from 'vitest';
import corePlugin from '../eslint-rules/index.ts';
import { validate } from '../validator/validate.ts';
import { synthesizeGenerate } from './generate.ts';
import { stubGenerateBad } from './generate-stubs.ts';
import { ESLINT_RESTRICTED_RULE_NAME } from './compile-declarative-md.ts';
import { stubRuleResearch } from './rule-research-port.ts';
import {
  runRuleBootstrap,
  stubGenerateNextImage,
} from './rule-bootstrap.ts';
import type { RulesLock } from '../installer/types.ts';

const tmpDirs: string[] = [];
function freshConsumerRoot(): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'rule-bootstrap-'));
  tmpDirs.push(dir);
  return dir;
}
function lockPathOf(consumerRoot: string): string {
  return resolve(consumerRoot, '.ai-factory', 'synthesizer-output', 'rules-lock.react-next.json');
}

afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('rule-bootstrap — research stub (step 1)', () => {
  it('stubRuleResearch ignores detection and returns the fixed react-next next/image plan', async () => {
    // @ts-expect-error — stub ignores the arg; pass a deliberately empty object to prove it
    const plan = await stubRuleResearch.research({});
    expect(plan.framework).toBe('react-next');
    expect(plan.patterns).toHaveLength(1);
    expect(plan.patterns[0].id).toBe('next-image-no-raw-img');
  });
});

describe('rule-bootstrap — end-to-end skeleton (good finding)', () => {
  // (a) GOOD finding → L4 synthesis → install ok, rules-lock.json revived on disk.
  it('(a) runRuleBootstrap: stub finding → synthesis → real rules-lock.json written', async () => {
    const consumerRoot = freshConsumerRoot();
    const result = await runRuleBootstrap({ consumerRoot });

    expect(result.mode).toBe('synthesis');
    if (result.mode !== 'synthesis') return;
    expect(result.install.ok).toBe(true);
    expect(result.install.installed).toBe(true);

    // The dead buildLock ran for real: rules-lock.json exists with matching rules.
    const lockPath = lockPathOf(consumerRoot);
    expect(existsSync(lockPath)).toBe(true);
    const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as RulesLock;
    expect(lock.schemaVersion).toBe(2);
    expect(lock.framework).toBe('react-next');
    expect(lock.rules.length).toBeGreaterThanOrEqual(1);
    expect(lock.sourceFingerprint).toMatch(/^[0-9a-f]{16}$/);
  });

  // (b) Non-vacuity (T15): the emitted declarative rule FIRES on a raw <img> and is
  //     CLEAN on <Image> — a real Linter.verify violation + clean case, not theatre.
  it('(b) emitted rule fires on raw <img>, clean on next/image <Image>', async () => {
    const plan = await stubRuleResearch.research(
      // @ts-expect-error — stub ignores the arg
      {},
    );
    const synthPlan = await synthesizeGenerate(plan, stubGenerateNextImage);

    // L4 accepts (declarative roundtrip + all anti-vacuity gates pass).
    const report = validate(synthPlan);
    expect(report.ok).toBe(true);

    const rule = synthPlan.rules[0];
    expect(rule.check.type).toBe('declarative');

    // Build a linter from the EMITTED wrapper config + the core plugin.
    const parsedSnippet = JSON.parse(synthPlan.eslintConfigSnippet) as Record<string, unknown>;
    const ruleConfig = parsedSnippet[ESLINT_RESTRICTED_RULE_NAME];
    expect(ruleConfig).toBeDefined();

    const config: Linter.Config[] = [
      {
        files: ['**/*.{ts,tsx,js,jsx}'],
        languageOptions: {
          parser: tseslintParser,
          parserOptions: {
            ecmaFeatures: { jsx: true },
            ecmaVersion: 'latest',
            sourceType: 'module',
          },
        },
        plugins: { 'rules-as-tests': { rules: corePlugin.rules } } as unknown as Linter.Config['plugins'],
        rules: { [ESLINT_RESTRICTED_RULE_NAME]: ruleConfig as Linter.RuleEntry },
      },
    ];
    const linter = new Linter();

    const badMessages = linter.verify('<img src={src} />', config, { filename: 'bad.tsx' });
    expect(badMessages.some((m) => m.ruleId === ESLINT_RESTRICTED_RULE_NAME)).toBe(true);

    const goodMessages = linter.verify('<Image src={src} />', config, { filename: 'good.tsx' });
    expect(goodMessages.filter((m) => m.ruleId === ESLINT_RESTRICTED_RULE_NAME)).toHaveLength(0);
  });
});

describe('rule-bootstrap — paired negative (bad/tautological finding)', () => {
  // (c) BAD finding → L4 rejects → research-only → install() never reached → NO lock.
  it('(c) tautological stub finding: degrades to research-only, no rules-lock.json shipped', async () => {
    const consumerRoot = freshConsumerRoot();
    const result = await runRuleBootstrap({
      consumerRoot,
      generateClient: stubGenerateBad,
    });

    expect(result.mode).toBe('research-only');
    // install() was never reached → the dead lock did NOT run → no artifact on disk.
    expect(existsSync(lockPathOf(consumerRoot))).toBe(false);
  });
});
