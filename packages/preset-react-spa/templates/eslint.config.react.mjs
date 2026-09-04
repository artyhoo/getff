// @ts-check
// ESLint flat config for React 19 SPA on Vite (no SSR, no Server Actions).
// Requires: ESLint ^9.0.0, typescript-eslint ^8.59.0,
//           eslint-plugin-react, eslint-plugin-react-hooks ^6.0.0,
//           eslint-plugin-jsx-a11y, eslint-plugin-boundaries, globals

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import customRules from './eslint-rules-local/index.mjs';

// ─── AIF rule-scope globs ────────────────────────────────
// Layout-agnostic globs for SPA (Vite) projects.
// Edit if your folder structure differs.
const RULE_GLOBS = {
  // R2 no-unsafe-zod-parse — SPA boundary code (API fetch wrappers, form handlers)
  boundary: [
    '**/features/*/api/**/*.{ts,tsx}',
    '**/api/**/*.{ts,tsx}',
    '**/services/**/*.{ts,tsx}',
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
  // R-SPA-EB require-error-boundary — app-root entry-point files only (narrow in-file)
  appRoot: [
    'src/App.{tsx,jsx}',
    'src/app.{tsx,jsx}',
    'src/Root.{tsx,jsx}',
    'src/main.{tsx,jsx}',
    'src/index.{tsx,jsx}',
    'app/App.{tsx,jsx}',
    'app/Root.{tsx,jsx}',
  ],
};

// ─── F7: runtime-discipline rules (R7/R8) are opt-in ────
// R7 (injected Clock/Random + infrastructure layer) and R8 (OpenTelemetry spans) demand
// infra a fresh skeleton lacks → deferred unless AIF_STRICT_RUNTIME=1.
const STRICT_RUNTIME = process.env.AIF_STRICT_RUNTIME === '1';

export default defineConfig(
  {
    ignores: [
      'dist/**',
      'build/**',
      'coverage/**',
      '.stryker-tmp/**',
      'node_modules/**',
      'public/**',
      '**/*.d.ts',
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
      globals: { ...globals.browser },
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

  // React / JSX (ADOPT: eslint-plugin-react #136, eslint-plugin-react-hooks v6 #137, jsx-a11y #138)
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

      // react-hooks v6: recommended-latest enables all compiler rules for the installed 6.x minor.
      // v6.0.x config is a plain object; v6.1+ config is an array — spread rules version-safely.
      // NOTE: Compiler rules live in react-hooks/ namespace. Do NOT install eslint-plugin-react-compiler.
      ...(
        Array.isArray(reactHooksPlugin.configs['recommended-latest'])
          ? reactHooksPlugin.configs['recommended-latest'][0]?.rules
          : reactHooksPlugin.configs['recommended-latest']?.rules
      ),
      'react-hooks/exhaustive-deps': 'error', // upgrade: recommended is 'warn', we enforce 'error'

      ...jsxA11y.flatConfigs.recommended.rules,

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

      // Accessibility (catches AI's <div onClick> habit)
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
    },
  },

  // ─── Architecture boundaries (ADOPT: eslint-plugin-boundaries #139) ──────────────
  // Feature-Sliced Design: presentation layer cannot import from domain or infrastructure.
  // Customize the 'elements' setting to match your folder structure.
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        {
          type: 'presentation',
          pattern: ['src/features/*/ui/**', 'src/shared/ui/**'],
        },
        {
          type: 'feature',
          pattern: ['src/features/*/lib/**', 'src/features/*/model/**'],
        },
        {
          type: 'application',
          pattern: ['src/application/**', 'src/features/*/api/**'],
        },
        { type: 'domain', pattern: ['src/domain/**'] },
        { type: 'infrastructure', pattern: ['src/infrastructure/**'] },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            // Presentation layer: no direct imports from domain or infrastructure
            { from: 'presentation', disallow: ['domain', 'infrastructure'] },
            // Application layer: no direct imports from infrastructure
            { from: 'application', disallow: ['infrastructure'] },
          ],
        },
      ],
    },
  },

  // ─── Custom AST rules ─────────────────────────────────────────────────────────────
  // R2: no-unsafe-zod-parse on SPA boundary code (API handlers, fetch wrappers)
  {
    files: RULE_GLOBS.boundary,
    plugins: { 'rules-as-tests': customRules },
    rules: {
      'rules-as-tests/no-unsafe-zod-parse': 'error',
    },
  },

  // R-SPA-EB: require-error-boundary — narrow in-file check on app-root entry files only
  // (BUILD #140 — presence gap; see RULES.react-spa.md#r-spa-eb-error-boundary-presence)
  {
    files: RULE_GLOBS.appRoot,
    plugins: { 'rules-as-tests': customRules },
    rules: {
      'rules-as-tests/require-error-boundary': 'error',
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
);
