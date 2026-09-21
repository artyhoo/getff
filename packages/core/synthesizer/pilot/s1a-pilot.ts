// S1a ESLint forbid pilot — no-restricted-syntax selector as data
//
// Principle: forbid .only focus (it.only / describe.only / test.only)
// Selector:  CallExpression[callee.object.name=/^(describe|it|test)$/][callee.property.name='only']
// Engine:    built-in ESLint no-restricted-syntax (zero new deps)
//
// Run: NODE_PATH=/app/node_modules tsx packages/core/synthesizer/pilot/s1a-pilot.ts
//
// Mirrors gate-rule-tester.ts:137-168 (buildSingleRuleConfig + Linter.verify) — path (b):
// standalone script, avoids assembling a full SynthesisPlan object.

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const _require = createRequire(import.meta.url);

// Resolve eslint from project node_modules; fall back to /app/node_modules
// (the container-level install used when the workspace isn't set up yet).
function requireEslint(): { Linter: new () => EslintLinter } {
  try {
    return _require('eslint') as { Linter: new () => EslintLinter };
  } catch {
    return _require('/app/node_modules/eslint') as {
      Linter: new () => EslintLinter;
    };
  }
}

interface LintMessage {
  ruleId: string | null;
  message: string;
  line: number;
  column: number;
}

interface EslintLinter {
  verify(
    code: string,
    config: object[],
    options?: { filename?: string },
  ): LintMessage[];
}

const { Linter } = requireEslint();

// Selector-as-data: the rule logic lives here, not in a named rule binary.
const SELECTOR =
  "CallExpression[callee.object.name=/^(describe|it|test)$/][callee.property.name='only']";
const MESSAGE = 'remove .only — it silently disables sibling tests';

const ruleConfig = ['error', { selector: SELECTOR, message: MESSAGE }];

// Mirror buildSingleRuleConfig from gate-rule-tester.ts — flat config array.
// files pattern required: ESLint flat config won't match without it when verify()
// receives an explicit filename.
const config = [
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-syntax': ruleConfig,
    },
  },
];

const badFixture = readFileSync(
  resolve(HERE, 'no-only-test-focus.bad.ts'),
  'utf8',
);
const goodFixture = readFileSync(
  resolve(HERE, 'no-only-test-focus.good.ts'),
  'utf8',
);

const linter = new Linter();

const badMessages = linter.verify(badFixture, config, {
  filename: 'no-only-test-focus.bad.ts',
});
const goodMessages = linter.verify(goodFixture, config, {
  filename: 'no-only-test-focus.good.ts',
});

// TDD red: bad fixture must be flagged
const redViolations = badMessages.filter(
  (m) => m.ruleId === 'no-restricted-syntax',
);
if (redViolations.length === 0) {
  console.error('FAIL [red]: bad fixture produced no violations (expected 1+)');
  process.exit(1);
}

// TDD green: good fixture must be clean
const greenViolations = goodMessages.filter(
  (m) => m.ruleId === 'no-restricted-syntax',
);
if (greenViolations.length > 0) {
  console.error(
    'FAIL [green]: good fixture produced unexpected violations:',
    JSON.stringify(greenViolations),
  );
  process.exit(1);
}

console.log(
  '=== S1a Linter.verify pilot — no-restricted-syntax .only forbid ===\n',
);
console.log('Rule config (selector-as-data):');
console.log(
  JSON.stringify({ 'no-restricted-syntax': ruleConfig }, null, 2),
  '\n',
);
console.log('--- RED: no-only-test-focus.bad.ts ---');
for (const m of redViolations) {
  console.log(`  ${m.line}:${m.column}  ${m.ruleId}  ${m.message}`);
}
console.log('\n--- GREEN: no-only-test-focus.good.ts ---');
console.log('  (0 violations)\n');
console.log('PASS: bad fixture flagged + good fixture clean');
