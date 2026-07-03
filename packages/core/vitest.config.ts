import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    // Tripwire: the suite must leave the real .claude/hooks/ untouched
    // (2026-07-02 seeded-break leak incident). Delta-based; advisory without git.
    globalSetup: ['./audit-self/hooks-tree-guard.ts'],
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
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.claude/worktrees/**',
    ],
  },
});
