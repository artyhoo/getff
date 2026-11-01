/*
 * TAK S2 M05/A05 — lexical ErrorBoundary ancestor boundary test material (native node --test).
 *
 * Subject: the REAL diagnostic boundary of the two actual producer surfaces —
 *   (a) packages/core/eslint-rules/require-error-boundary.ts  (authored TS, loaded via the
 *       installed TypeScript compiler's transpileModule — the actual bytes on disk, no mock)
 *   (b) packages/core/eslint-rules/require-error-boundary.mjs (shipped stock twin, imported
 *       directly)
 * — driven through the installed ESLint `Linter` and `@typescript-eslint/parser`.
 *
 * Cases: the independently frozen lexical-ancestor cases
 * (docs/test-assurance-kernel/s2/m05-error-boundary-cases.json, sha-bound below — the
 * Root-frozen 688e099f… bytes copied verbatim). Expected diagnostics/message come ONLY from
 * that frozen file: the producer's actual output is computed here and compared against the
 * freeze; the production decision is never copied into expected values.
 *
 * Fail-closed arms: missing/altered/empty fixture refuses; unknown structural shape refuses;
 * a parse/fatal message or a linter crash is an infrastructure failure, never a silent pass.
 * This is firing test material for an existing rule — not a new analyzer/platform.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');

const CASES_PATH = path.join(
  ROOT, 'docs', 'test-assurance-kernel', 's2', 'm05-error-boundary-cases.json');
const CASES_SHA256 = '688e099f380a2fd15a7eafcad7cfc5eedcebaeb165acb0e4e5715e192c1342fb';
const EXPECTED_IDS = [
  'unrelated-wrapped-before-app',
  'unrelated-wrapped-after-app',
  'fragment-unwrapped-sibling',
  'both-lexical-roots-wrapped',
  'fragment-wrapped-siblings',
  'member-boundary-both-roots',
];

// ── fixture load: refuse missing/empty/altered/structurally unexpected content ──
const casesBytes = readFileSync(CASES_PATH);
const casesSha = createHash('sha256').update(casesBytes).digest('hex');
assert.equal(casesSha, CASES_SHA256, 'frozen cases file altered or wrong bytes');
const frozen = JSON.parse(casesBytes);
assert.ok(frozen && typeof frozen === 'object', 'frozen cases file empty/invalid');
assert.equal(frozen.filename, 'src/App.tsx', 'frozen filename drifted');
assert.ok(Array.isArray(frozen.cases) && frozen.cases.length === EXPECTED_IDS.length,
  `frozen case population must be exactly ${EXPECTED_IDS.length}`);
assert.deepEqual(frozen.cases.map((c) => c.id), EXPECTED_IDS, 'frozen case IDs drifted');
for (const c of frozen.cases) {
  assert.equal(typeof c.code, 'string', `${c.id}: code must be a string`);
  assert.ok(c.code.length > 0, `${c.id}: empty code refuses`);
  assert.equal(typeof c.expected_diagnostics, 'number', `${c.id}: expected_diagnostics must be numeric`);
  assert.ok(c.expected_diagnostics === 0 || c.expected_diagnostics === 1,
    `${c.id}: this material binds intended count 0|1 per case`);
  if (c.expected_diagnostics === 0) {
    assert.equal(c.expected_message_id, null, `${c.id}: zero-diagnostic case must carry null message id`);
  } else {
    assert.equal(c.expected_message_id, 'missingErrorBoundary',
      `${c.id}: intended message id must come from the freeze, not the producer`);
  }
}

// ── producer surfaces ──────────────────────────────────────────────────────────
function loadTsSurface() {
  const tsPath = path.join(ROOT, 'packages', 'core', 'eslint-rules', 'require-error-boundary.ts');
  const ts = require('typescript');
  const js = ts.transpileModule(readFileSync(tsPath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module_ = { exports: {} };
  // The authored source has only `import type` dependencies (erased at emit), so the
  // transpiled body needs no `require` — pass a failing require to prove that stays true.
  const failingRequire = (id) => { throw new Error(`unexpected runtime require: ${id}`); };
  new Function('exports', 'require', 'module', js)(module_.exports, failingRequire, module_);
  assert.ok(module_.exports.requireErrorBoundary, 'TS surface must export requireErrorBoundary');
  return module_.exports.requireErrorBoundary;
}

async function loadMjsSurface() {
  const mod = await import(
    new URL('file://' + path.join(ROOT, 'packages', 'core', 'eslint-rules',
      'require-error-boundary.mjs')).href);
  assert.ok(mod.requireErrorBoundary, 'shipped MJS surface must export requireErrorBoundary');
  return mod.requireErrorBoundary;
}

// ── diagnostic boundary: real Linter, real parser, per-surface verdicts ─────────
function makeVerify(rule) {
  const { Linter } = require('eslint');
  const tsParser = require('@typescript-eslint/parser');
  const linter = new Linter({ configType: 'flat' });
  return (code) => linter.verify(code, {
    // Explicit glob — a files-less flat block in Linter.verify matches `**/*.mjs` only
    // (same trap the P51 principle documents at its lint() helper).
    files: ['**/*.tsx'],
    plugins: { 'rules-as-tests': { rules: { 'require-error-boundary': rule } } },
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: { 'rules-as-tests/require-error-boundary': 'error' },
  }, frozen.filename);
}

function assertBoundary(surfaceName, verify, c) {
  const messages = verify(c.code);
  const fatal = messages.filter((m) => m.fatal);
  assert.deepEqual(fatal, [], `${surfaceName}/${c.id}: parse failure is infra, not a verdict`);
  assert.equal(messages.length, c.expected_diagnostics,
    `${surfaceName}/${c.id}: expected ${c.expected_diagnostics} diagnostic(s), got ${messages.length}`
    + ` (${messages.map((m) => m.messageId ?? m.ruleId).join(',') || 'none'})`);
  if (c.expected_diagnostics === 1) {
    assert.equal(messages[0].ruleId, 'rules-as-tests/require-error-boundary',
      `${surfaceName}/${c.id}: diagnostic must come from the rule under test`);
    assert.equal(messages[0].messageId, c.expected_message_id,
      `${surfaceName}/${c.id}: messageId must match the frozen intent`);
  }
}

test('M05/A05 lexical-ancestor boundary — TS surface (actual authored bytes)', async (t) => {
  const verify = makeVerify(loadTsSurface());
  for (const c of frozen.cases) {
    await t.test(`actual-ts / ${c.id}`, () => assertBoundary('actual-ts', verify, c));
  }
});

test('M05/A05 lexical-ancestor boundary — shipped MJS surface (stock twin)', async (t) => {
  const verify = makeVerify(await loadMjsSurface());
  for (const c of frozen.cases) {
    await t.test(`actual-shipped-mjs / ${c.id}`, () => assertBoundary('actual-shipped-mjs', verify, c));
  }
});
