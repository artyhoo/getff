import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';
import * as tsParser from '@typescript-eslint/parser';
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
    // so hasErrorBoundaryInJSX stays false even though the identifier appears in the file.
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
