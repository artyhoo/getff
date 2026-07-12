// @ts-check
// ESLint flat config for server-side TypeScript projects (Node.js, Fastify, Hono, etc.)
// Requires: ESLint ^9.0.0, typescript-eslint ^8.59.0
// For React/Next.js, see eslint.config.react.mjs

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vitestPlugin from '@vitest/eslint-plugin';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import customRules from './eslint-rules-local/index.mjs';

// ─── AIF rule-scope globs (F3) ──────────────────────────
// Custom-rule `files` globs default to LAYOUT-AGNOSTIC patterns so the shields fire on
// flat (Hono), layered (DDD), AND monorepo (apps/*, packages/*) shapes — not only the
// `src/`+DDD layout the template originally assumed (which matched ZERO files on a flat
// server or monorepo → silently inert). Edit these if your structure differs; the
// post-install `check-globs-nonempty` gate fails loudly if any expands to zero files —
// silent inertness is the worst failure for a "no check → no rule" framework.
const RULE_GLOBS = {
  // R2 no-unsafe-zod-parse — HTTP boundary code (request payloads parsed at the edge)
  boundary: [
    '**/handlers/**/*.{ts,tsx}',
    '**/routes/**/*.{ts,tsx}',
    '**/controllers/**/*.{ts,tsx}',
    '**/app/api/**/*.{ts,tsx}',
    '**/actions/**/*.{ts,tsx}',
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
// infra a fresh skeleton lacks → friction-without-benefit by default. Deferred unless
// AIF_STRICT_RUNTIME=1. R2 (validation at boundaries) needs no infra → stays unconditional.
const STRICT_RUNTIME = process.env.AIF_STRICT_RUNTIME === '1';

export default defineConfig(
  // 1. Global ignores
  {
    ignores: [
      'dist/**',
      'coverage/**',
      '.stryker-tmp/**',
      'node_modules/**',
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
      '.dependency-cruiser.cjs',
    ],
  },

  // 2. Base JS recommended
  js.configs.recommended,

  // 3. typescript-eslint strict + stylistic (type-aware)
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // 3b. Plain JS/CJS/MJS files (config files, scripts, examples) have no type
  // information under `projectService` (only §4's `.{ts,tsx}` block enables it),
  // so the unscoped type-aware spread above would fatal-error (`await-thenable`
  // et al. throw "requires type information") on any `.js`/`.cjs`/`.mjs` walked
  // by `eslint .` that lives outside the tsconfig `include`. Disable type-aware
  // rules for them. Must come AFTER the spread so it wins for matching files. (GH #973)
  {
    files: ['**/*.{js,cjs,mjs}'],
    ...tseslint.configs.disableTypeChecked,
  },

  // 4. TypeScript files
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    rules: {
      // ─── Hygiene ────────────────────────────────────
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 10,
        },
      ],

      // ─── Error handling ─────────────────────────────
      'no-throw-literal': 'error',
      'no-useless-catch': 'error',

      // ─── Switch / control flow ──────────────────────
      'default-case': 'error',
      'no-fallthrough': 'error',

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

      // ─── Forbidden syntax ────────────────────────────
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message:
            'Use union types or `as const` objects instead of enum (verbatimModuleSyntax-incompatible).',
        },
      ],
    },
  },

  // 4b. Custom AST rules — R2 unconditional (no infra needed); R7/R8 opt-in via
  //     AIF_STRICT_RUNTIME=1 (F3 layout-agnostic globs + F7 deferred runtime discipline).
  {
    files: RULE_GLOBS.boundary,
    plugins: { 'rules-as-tests': customRules },
    rules: {
      'rules-as-tests/no-unsafe-zod-parse': 'error',
    },
  },
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

  // 5. Test files — relax strict rules, enable test-specific ones
  {
    files: [
      '**/*.{test,spec}.{ts,tsx}',
      '**/__tests__/**',
      'tests/**/*.{ts,tsx}',
    ],
    plugins: { vitest: vitestPlugin },
    rules: {
      ...vitestPlugin.configs.recommended.rules,
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-restricted-syntax': 'off',

      // Test quality rules
      'vitest/no-disabled-tests': 'error',
      'vitest/no-focused-tests': 'error',
      'vitest/no-identical-title': 'error',
      'vitest/expect-expect': 'error',
      'vitest/no-conditional-tests': 'error',
      'vitest/no-conditional-expect': 'error',
      'vitest/no-standalone-expect': 'error',
      'vitest/prefer-to-be': 'error',
      'vitest/valid-expect': 'error',
    },
  },

  // 6. Configs and scripts — relaxed
  {
    files: ['**/*.config.{ts,mjs,js}', 'scripts/**/*'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },

  // 7. Prettier — must be LAST to disable conflicting rules
  prettierConfig,
);
