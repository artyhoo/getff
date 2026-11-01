import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, expect, it } from 'vitest';
import * as tsParser from '@typescript-eslint/parser';
import plugin, { rules } from './index.ts';

// TAK S2 m12-spa (cand-spa-empty-selection): the governed subject is the PACKAGE-PUBLIC
// export — the preset's default plugin and its `rules` map — NOT a direct import of the
// core rule (that lane has its own test at packages/core/eslint-rules/
// require-error-boundary.test.ts). Before this file the package lane selected ZERO test
// files (`npm --prefix packages/preset-react-spa run test` exited 1 "No test files found"),
// so that package test command executed no public re-export test cases. The six cases below are the frozen independent
// controls (INDEPENDENT-PUBLIC-EXPORT-CONTROLS.json, sha 2f3f2df0…) — R-SPA-EB contract
// examples from RULES.react-spa.md §R-SPA-EB — and stay limited to static in-file scope.

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const publicRule = rules['require-error-boundary'];

describe('preset public export shape (transport identity)', () => {
  it('exposes require-error-boundary as the same binding via default plugin and named rules', () => {
    expect(publicRule).toBeDefined();
    expect(plugin.rules['require-error-boundary']).toBe(publicRule);
  });
});

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

// NOTE: the run() label must stay slash-free — RuleTester parses `plugin/rule` labels as a
// configured-plugin reference ("Could not find plugin"); the DEPLOYED ruleId
// (spa/require-error-boundary, per the frozen controls) is a naming-config concern, not a
// diagnostic one: the messageId expectations below are what the rule actually reports.
ruleTester.run('require-error-boundary', publicRule, {
  valid: [
    {
      // control: mounted-boundary — ErrorBoundary is an ancestor in the JSX tree → admit
      filename: 'src/App.tsx',
      code: 'export function App(){return <ErrorBoundary fallback={<div>Failed</div>}><Router /></ErrorBoundary>;}',
    },
    {
      // control: member-boundary — Sentry.ErrorBoundary member expression → admit
      filename: 'src/App.tsx',
      code: 'export function App(){return <Sentry.ErrorBoundary><Router /></Sentry.ErrorBoundary>;}',
    },
    {
      // control: no-jsx-scope-control — no JSX in file, rule does not apply → admit
      filename: 'src/App.tsx',
      code: 'export const value = 1;',
    },
    {
      // control: declared-first-jsx-exemption — // audit:exempt on the first JSX line → admit
      filename: 'src/App.tsx',
      code: 'export function App(){return <main><Router /></main>;} // audit:exempt',
    },
  ],
  invalid: [
    {
      // control: bare-app-root — no ErrorBoundary anywhere → reject missingErrorBoundary
      filename: 'src/App.tsx',
      code: 'export function App(){ return <main><Router /></main>; }',
      errors: [{ messageId: 'missingErrorBoundary' }],
    },
    {
      // control: import-only-boundary — ErrorBoundary imported but NOT mounted (the case
      // string-presence grep would miss: an ImportDeclaration is not a JSXOpeningElement)
      // → reject missingErrorBoundary
      filename: 'src/App.tsx',
      code: "import ErrorBoundary from './ErrorBoundary'; export function App(){return <main><Router /></main>;}",
      errors: [{ messageId: 'missingErrorBoundary' }],
    },
  ],
});
