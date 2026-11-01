import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, expect, it } from 'vitest';
import * as tsParser from '@typescript-eslint/parser';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireErrorBoundary } from './require-error-boundary.ts';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

ruleTester.run('require-error-boundary', requireErrorBoundary, {
  valid: [
    // Valid #1: ErrorBoundary mounted at root — rule passes
    `
import { ErrorBoundary } from 'react-error-boundary';
function App() {
  return (
    <ErrorBoundary fallback={<div>Error</div>}>
      <main>Content</main>
    </ErrorBoundary>
  );
}
`,

    // Valid #2: Custom named ErrorBoundary (name contains ErrorBoundary)
    `
import AppErrorBoundary from './AppErrorBoundary';
function App() {
  return (
    <AppErrorBoundary>
      <main>Content</main>
    </AppErrorBoundary>
  );
}
`,

    // Valid #3: Sentry-style member expression (Sentry.ErrorBoundary)
    `
import * as Sentry from '@sentry/react';
function App() {
  return (
    <Sentry.ErrorBoundary fallback={<p>Error</p>}>
      <div>App</div>
    </Sentry.ErrorBoundary>
  );
}
`,

    // Valid #4: No JSX in file — rule does not apply (not a React component file)
    `export const value = 42;`,

    // Valid #5 (audit:exempt): On the same line as the first JSX element
    `
function RootErrorPage() {
  return <main>Error page — boundary intentionally absent here</main>; // audit:exempt
}
`,
  ],

  invalid: [
    // Invalid #1: No ErrorBoundary at all — rule fires
    {
      code: `
function App() {
  return (
    <main>
      <h1>My App</h1>
    </main>
  );
}
`,
      errors: [{ messageId: 'missingErrorBoundary' }],
    },

    // Invalid #2 (T-MS-A): ErrorBoundary imported but NOT mounted — rule fires.
    // This is the critical case string-presence grep would miss but AST ancestor check catches:
    // the import statement produces an ImportDeclaration node, NOT a JSXOpeningElement,
    // so the boundary-presence state stays false even though the identifier appears in the file.
    {
      code: `
import ErrorBoundary from './ErrorBoundary';
function App() {
  return (
    <main>
      <h1>My App</h1>
    </main>
  );
}
`,
      errors: [{ messageId: 'missingErrorBoundary' }],
    },
  ],
});

// ── TAK S2 M05/A05 — frozen lexical-ancestor cases, real rule + shipped twin ──────
//
// The six cases are the independently frozen document copied verbatim into the tree
// (docs/test-assurance-kernel/s2/m05-error-boundary-cases.json — Root freeze 688e099f…).
// A05: an unrelated wrapped component in the same file, or a wrapped JSX sibling, used to
// suppress the missing-boundary diagnostic on unprotected content (whole-file any-presence
// flag). Expected diagnostics/message ids come ONLY from the frozen document — both the
// authored TS surface and the compiled .mjs the installer ships are driven against the SAME
// freeze, so a co-drift of both surfaces still fails. Fixture load is fail-closed: altered,
// empty or structurally drifted content refuses rather than silently re-baselining.
const HERE = dirname(fileURLToPath(import.meta.url));
const FROZEN_CASES_PATH = resolve(
  HERE, '../../../docs/test-assurance-kernel/s2/m05-error-boundary-cases.json');
const FROZEN_CASES_SHA256 =
  '688e099f380a2fd15a7eafcad7cfc5eedcebaeb165acb0e4e5715e192c1342fb';

const frozenBytes = readFileSync(FROZEN_CASES_PATH);
expect(createHash('sha256').update(frozenBytes).digest('hex')).toBe(FROZEN_CASES_SHA256);
const frozenDoc = JSON.parse(frozenBytes.toString('utf8')) as {
  filename: string;
  cases: Array<{
    id: string;
    code: string;
    expected_diagnostics: number;
    expected_message_id: string | null;
  }>;
};
expect(frozenDoc.cases.map((c) => c.id)).toEqual([
  'unrelated-wrapped-before-app',
  'unrelated-wrapped-after-app',
  'fragment-unwrapped-sibling',
  'both-lexical-roots-wrapped',
  'fragment-wrapped-siblings',
  'member-boundary-both-roots',
]);

const frozenValid = frozenDoc.cases
  .filter((c) => c.expected_diagnostics === 0)
  .map((c) => ({ filename: frozenDoc.filename, code: c.code }));
const frozenInvalid = frozenDoc.cases
  .filter((c) => c.expected_diagnostics === 1)
  .map((c) => ({
    filename: frozenDoc.filename,
    code: c.code,
    errors: [{ messageId: 'missingErrorBoundary' as const }],
  }));

ruleTester.run(
  'require-error-boundary frozen lexical-ancestor cases (authored TS surface)',
  requireErrorBoundary,
  { valid: frozenValid, invalid: frozenInvalid },
);

const shippedMod = (await import(resolve(HERE, 'require-error-boundary.mjs'))) as {
  requireErrorBoundary: typeof requireErrorBoundary;
};
ruleTester.run(
  'require-error-boundary frozen lexical-ancestor cases (shipped MJS surface)',
  shippedMod.requireErrorBoundary,
  { valid: frozenValid, invalid: frozenInvalid },
);
