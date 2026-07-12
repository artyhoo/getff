// @ts-check
// ESLint flat config for React 19 / Next.js 15 App Router projects
// Requires: ESLint ^9.0.0, typescript-eslint ^8.59.0, @next/eslint-plugin-next, eslint-plugin-react, eslint-plugin-react-hooks, eslint-plugin-jsx-a11y

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import vitestPlugin from '@vitest/eslint-plugin';
import testingLibrary from 'eslint-plugin-testing-library';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import customRules from './eslint-rules-local/index.mjs';

// ─── AIF rule-scope globs (F3) ──────────────────────────
// LAYOUT-AGNOSTIC custom-rule globs (its OWN Next/app-router shape, NOT cloned from the
// ts-server template) so the shields fire on flat, src/-nested, AND monorepo (apps/*,
// packages/*) React layouts — not only the bare `app/` + `src/`+DDD layout the template
// originally assumed. Edit if your structure differs; the post-install
// `check-globs-nonempty` gate fails loudly if any expands to zero files.
const RULE_GLOBS = {
  // R2 no-unsafe-zod-parse + R14/R20 (form / Server-Action safety) — Next boundary code
  boundary: [
    '**/app/**/actions/**/*.{ts,tsx}',
    '**/app/api/**/*.{ts,tsx}',
    '**/actions/**/*.{ts,tsx}',
    '**/features/*/api/**/*.{ts,tsx}',
  ],
  // R7 no-direct-time-randomness — all app code except infrastructure (opt-in, see below)
  appCode: ['**/*.{ts,tsx}'],
  appCodeIgnore: ['**/infrastructure/**/*.{ts,tsx}'],
  // R8 require-otel-span — application / use-case layer (opt-in, see below)
  application: [
    '**/application/**/*.{ts,tsx}',
    '**/use-cases/**/*.{ts,tsx}',
    '**/usecases/**/*.{ts,tsx}',
  ],
  applicationIgnore: ['**/application/**/ports/**'],
};

// ─── F7: runtime-discipline rules (R7/R8) are opt-in ────
// R7 (injected Clock/Random + infrastructure layer) and R8 (OpenTelemetry spans) demand
// infra a fresh skeleton lacks → deferred unless AIF_STRICT_RUNTIME=1. R2/R12/R14/R20 need
// no such infra → stay unconditional.
const STRICT_RUNTIME = process.env.AIF_STRICT_RUNTIME === '1';

export default defineConfig(
  {
    ignores: [
      '.next/**',
      'dist/**',
      'coverage/**',
      '.stryker-tmp/**',
      'node_modules/**',
      'public/**',
      '**/*.d.ts',
      'next-env.d.ts',
      'reports/**',
      // ─── AIF framework machinery vendored by install.sh (GH #779 lint follow-up) ───
      // NOT consumer source — `eslint .` walks the whole tree and this config's type-aware
      // rules (strictTypeChecked + projectService) fatal-error on the shipped `.mjs` (no type
      // info) and the vendored `.ts`/`.cjs` outside the tsconfig `src/**` include. The consumer
      // authors none of these; lint only their own source. Parity with react-native (#787).
      'eslint-rules-local/**',
      'packages/core/**',
      'scripts/audit-r4.ts',
      'eslint.config.mjs',
      'vitest.config.ts',
      'playwright.config.ts',
      '.storybook/**',
      '.dependency-cruiser.cjs',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Plain JS/CJS/MJS/JSX files have no type information under `projectService`
  // (only the `.{ts,tsx}` block enables it), so the unscoped type-aware spread
  // above would fatal-error (`await-thenable` et al. throw "requires type
  // information") on any such file walked by `eslint .` outside the tsconfig
  // `include`. Disable type-aware rules for them. Must come AFTER the spread. (GH #973)
  {
    files: ['**/*.{js,cjs,mjs,jsx}'],
    ...tseslint.configs.disableTypeChecked,
  },

  // Base TS block
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      // ─── Error handling ─────────────────────────────
      'no-throw-literal': 'error',
      'no-useless-catch': 'error',

      // ─── Forbidden imports (banned dependencies) ────
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['lodash', 'lodash/*'],
              message: 'Use native methods or lodash-es with tree-shaking.',
            },
            {
              group: ['moment'],
              message: 'Use date-fns or Temporal instead of moment.',
            },
            {
              group: ['axios'],
              message: 'Use native fetch.',
            },
            {
              group: ['request', 'request/*'],
              message: 'request is deprecated. Use native fetch.',
            },
            {
              group: ['node-fetch', 'node-fetch/*'],
              message: 'Use native fetch (Node 18+).',
            },
          ],
        },
      ],

      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message: 'Use union types or `as const` objects instead of enum.',
        },
      ],
    },
  },

  // React / JSX
  {
    files: ['**/*.{tsx,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11y,
    },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...jsxA11y.configs.strict.rules,

      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-uses-react': 'off',

      // Strong React-specific rules
      'react/jsx-no-leaked-render': ['error', { validStrategies: ['ternary'] }],
      'react/jsx-no-useless-fragment': 'error',
      'react/jsx-key': ['error', { checkFragmentShorthand: true }],
      'react/no-array-index-key': 'error',
      'react/self-closing-comp': 'error',
      'react/jsx-boolean-value': ['error', 'never'],
      'react/no-unescaped-entities': 'error',

      // Hooks — error, not warn (AI breaks this all the time)
      'react-hooks/exhaustive-deps': 'error',

      // Accessibility (catches AI's <div onClick> habit)
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
    },
  },

  // Next.js
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@next/next/no-img-element': 'error',
      '@next/next/no-html-link-for-pages': 'error',
      '@next/next/no-script-component-in-head': 'error',
    },
  },

  // Server Components: ban client-only globals
  {
    files: ['app/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}'],
    ignores: ['**/*.client.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message:
            "Server Component cannot use window. Add 'use client' if interactivity is needed.",
        },
        {
          name: 'document',
          message: 'Server Component cannot use document.',
        },
        {
          name: 'localStorage',
          message: 'localStorage does not exist on server.',
        },
        {
          name: 'sessionStorage',
          message: 'sessionStorage does not exist on server.',
        },
      ],
    },
  },

  // Custom AST rules — R2 + R12 + R14 + R20 unconditional (no infra needed); R7/R8 opt-in
  // via AIF_STRICT_RUNTIME=1 (F3 layout-agnostic globs + F7 deferred runtime discipline).
  {
    files: RULE_GLOBS.boundary,
    plugins: { 'rules-as-tests': customRules },
    rules: {
      'rules-as-tests/no-unsafe-zod-parse': 'error',
    },
  },
  // R12 part 2 — 'use client' files cannot import server-only modules
  // Path-agnostic: rule self-checks for 'use client' directive
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'rules-as-tests': customRules },
    rules: {
      'rules-as-tests/no-server-imports-in-client': 'error',
    },
  },
  // R14 + R20 — Server Actions / API handlers (same Next boundary globs as R2)
  {
    files: RULE_GLOBS.boundary,
    plugins: { 'rules-as-tests': customRules },
    rules: {
      // R14 + R20 are enforced through the exempt-aware wrapper
      // `rules-as-tests/restricted-syntax-audit-exempt`: it runs each esquery selector
      // and suppresses a report on any line carrying `// audit:exempt` (the built-in
      // no-restricted-syntax is comment-blind). Selectors are the SSOT recipe selectors —
      // packages/core/synthesizer/recipes/next-r14-* and next-r20-*; keep them in sync
      // (drift from those recipe selectors is caught by
      //  packages/core/principles/26-template-selector-sync.test.ts).
      'rules-as-tests/restricted-syntax-audit-exempt': [
        'error',
        {
          // R14 — Validate FormData parameters via .safeParse(...)
          selector:
            ":function:not(:has(CallExpression[callee.property.name='safeParse'])):has(Identifier[typeAnnotation.typeAnnotation.typeName.name='FormData'], Identifier[typeAnnotation.typeAnnotation.typeName.right.name='FormData'])",
          message:
            'Function accepts FormData but does not call .safeParse(...). Validate the form input with a Zod schema (R14).',
        },
        {
          // R20 — Server Action files must start with a 'use server' directive
          selector:
            "Program:not(Program:has(ExpressionStatement:first-child > Literal[value='use server'])) ExportNamedDeclaration > FunctionDeclaration[async=true], Program:not(Program:has(ExpressionStatement:first-child > Literal[value='use server'])) ExportDefaultDeclaration > FunctionDeclaration[async=true]",
          message:
            "Server Action file must start with 'use server' directive at the top of the file (R20).",
        },
      ],
    },
  },
  // R7 / R8 — runtime discipline, opt-in via AIF_STRICT_RUNTIME=1 (F7)
  ...(STRICT_RUNTIME
    ? [
        {
          files: RULE_GLOBS.appCode,
          ignores: RULE_GLOBS.appCodeIgnore,
          plugins: { 'rules-as-tests': customRules },
          rules: {
            'rules-as-tests/no-direct-time-randomness': 'error',
          },
        },
        {
          files: RULE_GLOBS.application,
          ignores: RULE_GLOBS.applicationIgnore,
          plugins: { 'rules-as-tests': customRules },
          rules: {
            'rules-as-tests/require-otel-span': 'error',
          },
        },
      ]
    : []),

  // Tests
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/__tests__/**'],
    plugins: {
      vitest: vitestPlugin,
      'testing-library': testingLibrary,
    },
    rules: {
      ...vitestPlugin.configs.recommended.rules,
      ...testingLibrary.configs.react.rules,
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',

      'vitest/no-disabled-tests': 'error',
      'vitest/no-focused-tests': 'error',
      'vitest/no-conditional-tests': 'error',
      'vitest/no-conditional-expect': 'error',
      'vitest/expect-expect': 'error',

      'testing-library/no-debugging-utils': 'error',
      'testing-library/no-dom-import': 'error',
      'testing-library/prefer-screen-queries': 'error',
      'testing-library/await-async-queries': 'error',
      'testing-library/no-await-sync-queries': 'error',
      'testing-library/no-node-access': 'error',
      'testing-library/no-container': 'error',
    },
  },

  prettierConfig,
);
