// @ts-check
// Shared React Native rule layer — used by BOTH baselines (eslint.config.expo.mjs + eslint.config.bare-rn.mjs).
// Adds: eslint-plugin-react-native (style/text rules #144) + eslint-plugin-react-native-a11y (#145)
//       + no-restricted-globals web-globals denylist (#146, REQUIRED — Expo baseline whitelists them).
//
// NOT in this file: @next plugin, jsx-a11y (web ARIA/DOM — wrong problem-class for RN, T16 trap).
//
// Prior-art: prior-art-evaluations.md#144 (ADOPT), #145 (ADOPT), #146 (ADAPT config).

import reactNativePlugin from 'eslint-plugin-react-native';
import reactNativeA11y from 'eslint-plugin-react-native-a11y';

/** @type {import('eslint').Linter.Config[]} */
const rnCommon = [
  // ─── Global ignores (#779 lint follow-up) ────────────────────────────
  // A flat-config object with ONLY `ignores` (no `files`) is global — it applies regardless of
  // its position in the array, so both baselines (Expo + bare-RN, which spread this layer LAST)
  // inherit it. Without it, `eslint .` walks the whole tree and the @react-native baseline
  // false-fails on two surfaces a fresh consumer must never lint:
  //   1. Build artifacts / generated output (mirrors the SPA + Next presets' ignores).
  //   2. AIF framework machinery vendored by install.sh — NOT app code. The bare-RN baseline
  //      parses `.mjs` with espree @ ecmaVersion 2015 (no `import.meta` / optional chaining), and
  //      @react-native enables `dot-notation` (warn) → `eslint . --max-warnings=0` dies on the
  //      shipped rule plugin (`eslint-rules-local/`), the TS hooks (`packages/core/`), and the
  //      vendored config files. The consumer authors none of these; lint only their own source.
  {
    ignores: [
      // 1 — build artifacts + generated output (SPA/Next preset parity)
      'dist/**',
      'build/**',
      'coverage/**',
      '.stryker-tmp/**',
      'node_modules/**',
      'public/**',
      '**/*.d.ts',
      'reports/**',
      // 2 — AIF framework machinery vendored by install.sh (not consumer code)
      'eslint-rules-local/**',
      'packages/core/**',
      'scripts/audit-r4.ts',
      'scripts/prove-rules.mjs',
      'eslint.config.mjs',
      'eslint.config.rn-common.mjs',
      'vitest.config.ts',
      '.dependency-cruiser.mjs',
    ],
  },

  // ─── React Native style / text rules (#144) ──────────────────────────
  // eslint-plugin-react-native@^5 under ESLint flat config.
  // Requires: peer eslint ^9, plugin added as object (no legacy .configs.all shorthand in v5 flat).
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'react-native': reactNativePlugin,
    },
    rules: {
      // StyleSheet.create adoption (#147 — driven by this rule, not a custom BUILD)
      'react-native/no-inline-styles': 'error',
      // Hardcoded color literals make theming impossible
      'react-native/no-color-literals': 'warn',
      // Unused StyleSheet entries accumulate dead weight
      'react-native/no-unused-styles': 'warn',
      // Single-element style arrays have no benefit; use a plain object instead
      'react-native/no-single-element-style-arrays': 'warn',
    },
  },

  // ─── React Native accessibility (#145) ───────────────────────────────
  // eslint-plugin-react-native-a11y (Nearform).
  // Supersedes jsx-a11y for RN — jsx-a11y targets web ARIA/DOM (wrong problem-class, T16).
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      'react-native-a11y': reactNativeA11y,
    },
    rules: {
      // Core mobile a11y — touchable elements must have accessible props
      'react-native-a11y/has-accessibility-hint': 'warn',
      'react-native-a11y/has-valid-accessibility-role': 'error',
      'react-native-a11y/has-accessibility-props': 'error',
      'react-native-a11y/no-nested-touchables': 'error',
    },
  },

  // ─── Forbid web-only globals / DOM (#146, REQUIRED) ──────────────────
  // ADAPT (config, not BUILD): core ESLint no-restricted-globals denylist.
  // CRITICAL: the Expo baseline (eslint-config-expo/flat) spreads globals.browser +
  // sets window:false — it WHITELISTS web globals, it does NOT forbid them (#651).
  // This rule fires ADDITIVELY as a separate rule key; it is NOT a key-collision "win" —
  // it must be present and effective under the Expo baseline specifically.
  // Custom AST residue is YAGNI until a corpus demands it (design-spec §8).
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message:
            'window is not available in React Native. Use Platform.OS or a platform-specific module.',
        },
        {
          name: 'document',
          message:
            'document is not available in React Native. Use React Native APIs instead.',
        },
        {
          name: 'localStorage',
          message:
            'localStorage is not available in React Native. Use @react-native-async-storage/async-storage or SecureStore.',
        },
        {
          name: 'sessionStorage',
          message:
            'sessionStorage is not available in React Native. Use @react-native-async-storage/async-storage.',
        },
      ],
    },
  },

  // ─── FlashList / FlatList snippet (#148 — commented, default-off) ────
  // REJECT the BUILD (no upstream rule, perf-opinion ≠ correctness invariant).
  // Uncomment the block below if your project has adopted FlashList or LegendList
  // as the de-facto list replacement and wants to enforce migration:
  //
  // {
  //   files: ['**/*.{js,jsx,ts,tsx}'],
  //   rules: {
  //     'no-restricted-imports': [
  //       'error',
  //       {
  //         name: 'react-native',
  //         importNames: ['FlatList'],
  //         message: 'Prefer FlashList (@shopify/flash-list) or LegendList for better performance.',
  //       },
  //     ],
  //   },
  // },
];

export default rnCommon;
