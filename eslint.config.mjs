// @ts-check
// S1 test-assurance kernel — Q1/Q2 delivery lane (spec §6: reuse the installed ESLint).
//
// Imports the COMMITTED .mjs twins (what an installed consumer receives — the
// plugin-dual-engine barrel-wrap precedent), enables ONLY the two test-quality rules,
// and scopes them to test-bearing files plus the frozen assurance corpus. The rules
// are in-repo-relative-path matched: run it as
//   npx eslint scripts/test-assurance/corpus/... <test files>
// from the repo root (a path outside the repo root does not match a flat-config block).
//
// Scope honesty (spec §5): these two rules claim ONLY decidable syntax (see the
// `declared_scope` entries in scripts/test-assurance/expectations.json). Q3–Q6 and the
// wrong-import shape are NOT claimed by this lane — their channels are the executed /
// counterfactual / delivery conformance batches and the named cold-review protocol.
import tsParser from '@typescript-eslint/parser';
import { noVacuousAssertion } from './packages/core/eslint-rules/no-vacuous-assertion.mjs';
import { requireEffectiveAssertion } from './packages/core/eslint-rules/require-effective-assertion.mjs';

const rulesAsTests = {
  meta: { name: 'rules-as-tests', version: '0.1.0' },
  rules: {
    'no-vacuous-assertion': noVacuousAssertion,
    'require-effective-assertion': requireEffectiveAssertion,
  },
};

export default [
  {
    // Explicit extension globs: a files-less block defaults to `**/*.mjs` only, and
    // `**/*` does not match nested `.ts` paths (ESLint 10 flat-config semantics;
    // measured 2026-10-08, see s1/logs/batch-b/).
    files: [
      '**/*.{test,spec,unit,audit,integration}.{ts,tsx,mts,cts,mjs,cjs,js,jsx}',
      '**/__tests__/**/*.{ts,tsx,mts,cts,mjs,cjs,js,jsx}',
      '**/tests/**/*.{ts,tsx,mts,cts,mjs,cjs,js,jsx}',
      'scripts/test-assurance/**/*.{ts,tsx,mjs,cjs,js,jsx}',
    ],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: { 'rules-as-tests': rulesAsTests },
    rules: {
      'rules-as-tests/no-vacuous-assertion': 'error',
      'rules-as-tests/require-effective-assertion': 'error',
    },
  },
];
