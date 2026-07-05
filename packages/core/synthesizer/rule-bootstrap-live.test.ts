// Rule-bootstrapping LIVE adapter — e2e over the file-clients (Phase 1).
// Mirrors rule-bootstrap.test.ts but injects the LIVE FileResearchClient +
// withManualDrop(FileGenerateClient) over committed fixtures (no network, $0-in-CI).
// Proves: (a) the genuinely-researched no-head-element rule ships + a real rules-lock.json
// is written, with the non-expressible (manual) server-only candidate DROPPED (not shipped
// inert); (b) the emitted rule FIRES on <head/> and is CLEAN on <Head/> (non-vacuity).
//
// The throw-on-bad-provenance degrade path is covered by file-clients.test.ts (unit).

import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Linter } from 'eslint';
import * as tseslintParser from '@typescript-eslint/parser';
import { afterEach, describe, expect, it } from 'vitest';
import corePlugin from '../eslint-rules/index.ts';
import { ESLINT_RESTRICTED_RULE_NAME } from './compile-declarative-md.ts';
import { synthesizeGenerate } from './generate.ts';
import { runRuleBootstrap } from './rule-bootstrap.ts';
import { FileResearchClient, FileGenerateClient, withManualDrop } from './file-clients.ts';
import type { RulesLock } from '../installer/types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESEARCH = resolve(HERE, 'fixtures/no-head-element.research.json');
const SELECTION = resolve(HERE, 'fixtures/no-head-element.selection.json');

const tmpDirs: string[] = [];
function freshConsumerRoot(): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'rule-bootstrap-live-'));
  tmpDirs.push(dir);
  return dir;
}
function lockPathOf(root: string): string {
  return resolve(root, '.ai-factory', 'synthesizer-output', 'rules-lock.react-next.json');
}
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function liveClients() {
  return {
    researchClient: new FileResearchClient(RESEARCH),
    generateClient: withManualDrop(new FileGenerateClient(SELECTION), () => {}),
  };
}

describe('rule-bootstrap LIVE — file-clients e2e', () => {
  it('(a) live research+selection → synthesis → real rules-lock.json with exactly the head rule', async () => {
    const consumerRoot = freshConsumerRoot();
    const result = await runRuleBootstrap({ consumerRoot, ...liveClients() });

    expect(result.mode).toBe('synthesis');
    if (result.mode !== 'synthesis') return;
    expect(result.install.ok).toBe(true);
    expect(result.install.installed).toBe(true);

    const lock = JSON.parse(readFileSync(lockPathOf(consumerRoot), 'utf8')) as RulesLock;
    expect(lock.framework).toBe('react-next');
    // The manual server-only candidate was dropped → exactly ONE rule shipped.
    expect(lock.ruleIds).toEqual(['G1']);
    expect(lock.sourceFingerprint).toMatch(/^[0-9a-f]{16}$/);
  });

  it('(b) emitted no-head-element rule fires on <head/>, clean on <Head/>', async () => {
    const { researchClient, generateClient } = liveClients();
    const plan = await researchClient.research({} as never);
    const synthPlan = await synthesizeGenerate(plan, generateClient);

    expect(synthPlan.rules).toHaveLength(1);
    expect(synthPlan.rules[0].check.type).toBe('declarative');

    const parsed = JSON.parse(synthPlan.eslintConfigSnippet) as Record<string, unknown>;
    const ruleConfig = parsed[ESLINT_RESTRICTED_RULE_NAME];
    expect(ruleConfig).toBeDefined();

    const config: Linter.Config[] = [
      {
        files: ['**/*.{ts,tsx,js,jsx}'],
        languageOptions: {
          parser: tseslintParser,
          parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: 'latest', sourceType: 'module' },
        },
        plugins: { 'rules-as-tests': { rules: corePlugin.rules } } as unknown as Linter.Config['plugins'],
        rules: { [ESLINT_RESTRICTED_RULE_NAME]: ruleConfig as Linter.RuleEntry },
      },
    ];
    const linter = new Linter();
    const bad = linter.verify('<head />', config, { filename: 'bad.tsx' });
    expect(bad.some((m) => m.ruleId === ESLINT_RESTRICTED_RULE_NAME)).toBe(true);
    const good = linter.verify('<Head />', config, { filename: 'good.tsx' });
    expect(good.filter((m) => m.ruleId === ESLINT_RESTRICTED_RULE_NAME)).toHaveLength(0);
  });
});
