import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// React 19 SPA (Vite) Vitest config.
// Co-located tests next to source — no __tests__/ directory.
//
// Naming convention:
//   *.unit.ts(x)        — unit tests (default vitest run)
//   *.integration.ts(x) — integration with real external services
//   *.audit.ts(x)       — audit/lint rule tests, AGENTS.md probes
//   *.e2e.ts(x)         — Playwright e2e (excluded here)
//   *.stories.tsx       — Storybook play functions (excluded here, run via Storybook)
//
// Required setup file: tests/setup.ts with @testing-library/jest-dom/vitest + cleanup.
//
// JSX: the automatic runtime, set here rather than through @vitejs/plugin-react. The plugin's latest
// peers vite ^8, so a project on vite 6 or 7 cannot load a config that imports it; without it (and
// without this line) a JSX test fails on vite 6 and 7 with «React is not defined». Measured
// 2026-09-29: this form runs a JSX test on vite 6.4.3, 7.3.6 and 8.3.1.

export default defineConfig({
  esbuild: { jsx: 'automatic' },

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },

  test: {
    globals: false,
    environment: 'jsdom',

    include: [
      'src/**/*.unit.{ts,tsx}',
      'src/**/*.audit.{ts,tsx}',
      // Legacy
      'src/**/*.{test,spec}.{ts,tsx}',
    ],

    exclude: [
      'src/**/*.integration.{ts,tsx}',
      'src/**/*.e2e.{ts,tsx}',
      'src/**/*.stories.tsx',
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
    ],

    setupFiles: ['./tests/setup.ts'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.unit.{ts,tsx}',
        'src/**/*.integration.{ts,tsx}',
        'src/**/*.audit.{ts,tsx}',
        'src/**/*.e2e.{ts,tsx}',
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/*.stories.tsx',
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/main.{ts,tsx}',
        'src/App.{ts,tsx}',
        'src/generated/**',
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75,
        'src/domain/**': {
          lines: 90,
          functions: 95,
          branches: 85,
        },
        'src/features/**/lib/**': {
          lines: 85,
          functions: 90,
          branches: 80,
        },
        'src/shared/lib/**': {
          lines: 85,
          functions: 90,
          branches: 80,
        },
      },
    },

    testTimeout: 5000,
    hookTimeout: 5000,
    pool: 'threads',
    poolOptions: { threads: { singleThread: false } },
    reporters: process.env['CI'] ? ['default', 'github-actions'] : 'default',
  },
});
