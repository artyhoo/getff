import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    // Tripwire: the suite must leave the real .claude/hooks/ untouched
    // (2026-07-02 seeded-break leak incident). Delta-based; advisory without git.
    globalSetup: ['./audit-self/hooks-tree-guard.ts'],
    // Hermeticity: scrub host-supplied configuration out of process.env before any test
    // module loads, so a hook test asserts on the hook and not on the shell that invoked
    // vitest (incident 2026-09-09 — vitest.setup.ts names the two leaks and the classifying
    // tables live in vitest.host-env.ts; harness-specific variable names stay THERE, never
    // here, because principle 21's substrate probe requires this config to be CC-independent
    // — tests/agnosticism/probes/substrate.sh greps every vitest.config for such names).
    // Mirrored in the repo-root vitest.config.ts, which pre-push uses for the same files.
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'principles/**/*.test.ts',
      'diagnostics/**/*.test.ts',
      'render/**/*.test.ts',
      'spec-validation/**/*.test.ts',
      'eslint-rules/**/*.test.ts',
      'detector-v0/**/*.test.ts',
      'detector/**/*.test.ts',
      'research/**/*.test.ts',
      'synthesizer/**/*.test.ts',
      'validator/**/*.test.ts',
      'install/**/*.test.ts',
      'installer/**/*.test.ts',
      'diff/**/*.test.ts',
      'tests/**/*.test.ts',
      'hooks/**/*.test.ts',
      'audit-self/**/*.test.ts',
      'audit-self/**/*.audit.ts',
      'skills/**/*.test.ts',
      'scenario-generator/**/*.test.ts',
      'ir/**/*.test.ts',
      'backends/**/*.test.ts',
      'composition/**/*.test.ts',
      'python-starter/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.claude/worktrees/**',
    ],
  },
});
