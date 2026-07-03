# Architecture — React Native (Expo + bare RN)

> **Authoritative for:** React Native preset architecture rationale — two-baseline design (Expo vs bare RN), shared rule layer structure, baseline selection criteria, plugin choices, and the `@callstack` swap note.
> **NOT authoritative for:** project goal — see consumer's README.md. Which baseline your project uses — that is an install-time decision wired by `install.sh` (multi-stack-install-wiring-iphase). Rule details — see `RULES.react-native.md`.

## Two-baseline design

The preset ships **two selectable ESLint configs** over **one shared RN rule layer**:

```text
eslint.config.expo.mjs          ← Expo baseline (eslint-config-expo/flat)
eslint.config.bare-rn.mjs       ← Bare-RN baseline (@react-native/eslint-config)
        ↑                                ↑
        └────────────────────────────────┘
                        │
              eslint.config.rn-common.mjs   ← SHARED layer (both baselines spread this)
                  ├── eslint-plugin-react-native (style/text rules)
                  ├── eslint-plugin-react-native-a11y (mobile a11y)
                  └── no-restricted-globals denylist (web-globals, REQUIRED)
```

**Why two baselines instead of one:** the source framework's goal is multi-stack + a factory for any stack
(see the framework's own README `#why-this-exists`). Expo consumers need `eslint-config-expo/flat`;
bare-RN consumers need `@react-native/eslint-config`. Both are served from one shared rule layer (DRY).

## Baseline selection criteria

| Baseline    | Config                      | Pick when                                                               |
| ----------- | --------------------------- | ----------------------------------------------------------------------- |
| **Expo**    | `eslint.config.expo.mjs`    | Using Expo SDK (Expo Router, expo-\*, EAS Build, `npx create-expo-app`) |
| **Bare RN** | `eslint.config.bare-rn.mjs` | Using React Native CLI (`npx react-native init`), no Expo runtime       |

Selection is automated by `install.sh` at install time (detects Expo deps in `package.json`).
Manual selection: copy the appropriate config file to your project root as `eslint.config.mjs`.

## CRITICAL: Expo baseline whitelists web globals (not a typo)

`eslint-config-expo/flat` spreads `globals.browser` and sets `window: false` (read-only).
This **whitelists** `window`, `document`, `localStorage` — it does NOT forbid them.

The `no-restricted-globals` denylist in `eslint.config.rn-common.mjs` **fires additively**
as a separate ESLint rule key. The two mechanisms are independent:

- `globals.browser` spread → tells ESLint "these globals exist" (no lint error)
- `no-restricted-globals` → fires an error when the global is _referenced in code_

Both must be present for correct behavior. Removing the denylist from `rn-common` while keeping
the Expo baseline would silently allow DOM globals to leak into RN code (T-MS-B trap).

This is the load-bearing correction from PR #651 (file-verified 2026-06-20).

## Plugin choices

### eslint-plugin-react-native@^5 (style/text rules, #144)

ADOPT verdict. Provides `no-inline-styles`, `no-color-literals`, `no-unused-styles`.
These rules drive `StyleSheet.create` adoption without a from-scratch custom rule.

**WATCHLIST:** if `eslint-plugin-react-native@^5` drops ESLint v9 flat-config support, migrate
to `@callstack/eslint-config` (see §@callstack note below).

### eslint-plugin-react-native-a11y (mobile a11y, #145)

ADOPT verdict. Nearform's accessibility plugin for React Native. Covers:

- `has-accessibility-props` — touchable elements must have accessible props
- `no-nested-touchables` — gesture conflicts
- `has-valid-accessibility-role` — valid ARIA-equivalent role values

**NOT jsx-a11y.** The `jsx-a11y` plugin targets web ARIA/DOM — wrong problem-class for RN (T16 trap).
React Native uses `accessibilityRole`/`accessibilityLabel` props, not HTML ARIA attributes.

### no-restricted-globals (web-globals denylist, #146)

ADAPT verdict (config, not BUILD). Core ESLint rule — no additional dependency.
Denies: `window`, `document`, `localStorage`, `sessionStorage` (DOM/web-storage APIs not available in RN).
**NOT denied:** `fetch`, `XMLHttpRequest`, `navigator` — all are available as RN runtime globals
(`navigator.product === 'ReactNative'` is the canonical RN platform check; `fetch` is the RN networking global).
This is the **required** mechanism; custom AST rules for DOM detection are YAGNI until a corpus demands it.

## Bare-RN baseline: FlatCompat wrapper

`@react-native/eslint-config@0.86.x` ships as a **legacy eslintrc object** (not a native flat config).
The bare-RN baseline wraps it with `FlatCompat` from `@eslint/eslintrc`, which is a transitive
dependency of ESLint v9 — no additional package install required in consumer projects.

```js
import { FlatCompat } from '@eslint/eslintrc';
const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname,
});
const bareRNBase = compat.extends('@react-native');
```

## @callstack/eslint-config — swap note

The R-phase surfaced `@callstack/eslint-config` as a more actively maintained alternative to
`@react-native/eslint-config` (SSOT #143). Default: `@react-native/eslint-config` (official RN-core)
via FlatCompat.

**When to swap to @callstack:**

- FlatCompat wrapper becomes unmaintainable (unlikely — it's part of ESLint's own toolchain)
- `eslint-plugin-react-native@^5` breaks → `@callstack/eslint-config` bundles the plugin
- Consumer's project already depends on `@callstack/eslint-config`

**How to swap:** in `eslint.config.bare-rn.mjs`, remove the FlatCompat imports and replace:

```js
import callstackConfig from '@callstack/eslint-config';
const bareRNBase = Array.isArray(callstackConfig)
  ? callstackConfig
  : [callstackConfig];
```

The `rn-common` shared layer remains unchanged (it doesn't depend on the baseline).

## No custom eslint-rules/ directory (zero BUILD)

The RN preset ships ZERO from-scratch custom ESLint rules. This is a build-first-reuse success
(design-spec §8): all target antipatterns are caught by existing upstream plugins + core rules.

The web-globals antipattern (the primary RN correctness concern) is caught by the `no-restricted-globals`
denylist (#146) — a config-level ADAPT, not a BUILD.

If `eslint-rules/` appears empty or absent — that is correct, not a defect.

## No Playwright

Playwright is web-only. React Native UI testing uses:

- **Detox** (end-to-end, gray-box) — for device/simulator tests
- **Maestro** (YAML-based, black-box) — simpler E2E flows

Neither is wired by this preset (they require device/simulator infrastructure).
If your project adopts Detox or Maestro, add the CI job and config separately.

## Layer structure (React Native app)

```text
src/                              (or app/ for Expo Router)
├── screens/                      # Screen-level components (navigator maps to these)
│   └── HomeScreen.tsx
├── components/                   # Reusable UI components
│   └── Button/
│       ├── Button.tsx
│       └── Button.test.tsx
├── navigation/                   # React Navigation config (or Expo Router _layout.tsx)
│   └── RootNavigator.tsx
├── hooks/                        # Custom hooks
├── services/                     # API layer (fetch wrappers, React Query hooks)
├── stores/                       # State (Zustand, Redux Toolkit, Jotai)
├── utils/                        # Pure utilities
└── types/                        # Shared TypeScript types
```

## Where rules are enforced

| Rule                      | Enforced by                                                    |
| ------------------------- | -------------------------------------------------------------- |
| Web-globals (#146)        | ESLint `no-restricted-globals` in `rn-common` (both baselines) |
| Inline styles (#144/#147) | ESLint `react-native/no-inline-styles` in `rn-common`          |
| Mobile a11y (#145)        | ESLint `react-native-a11y/*` in `rn-common`                    |
| TypeScript hygiene (R1)   | ESLint via baseline + `tsc --noEmit`                           |
| CI integrity (R11)        | `github-actions-ci-ui.yml` aggregate `ci-success` job          |
| Docs consistency          | `audit-ai-docs.react-native.sh`                                |
