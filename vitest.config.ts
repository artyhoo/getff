// Root-level vitest config — applies when vitest is invoked from repo root
// (e.g. pre-push hook `npx vitest run packages/core/audit-self/audit-ai-docs.test.ts`).
//
// Vitest auto-discovers nearest config walking up from CWD; without this root
// config, the workspace-aware `packages/core/vitest.config.ts` is skipped and
// `**/...` CLI patterns scan into `.claude/worktrees/agent-*` (harness-auto-
// created sub-agent worktrees without node_modules) — their tests
// `execSync('npx ...')` timeout and block every push.
//
// NOTE: must NOT import from 'vitest/config' — on CI, vitest is installed only
// in packages/core/node_modules; this file is loaded from repo-root where the
// import would fail with «Cannot find module 'vitest/config'». Plain default-
// export object works for vitest's config-loader without a typed wrapper.
//
// Excludes preserve test discovery defaults (node_modules, dist) and add the
// worktrees scope. testTimeout covers cold npm cache + slow connection in
// audit-ai-docs.test.ts:344 (local measurement ~24s; 60s = safe margin).
// Longer-term fix: see .claude/orchestrator-prompts/slow-test-triage/.
//
// Ceiling: testTimeout MUST NOT exceed 120_000 without a paired slow-test-triage R-phase.
// Further bumps require fixing the slow path, not raising the lid (DN-3 Option A, 2026-05-25).

export default {
  test: {
    // Tripwire: the suite must leave the real .claude/hooks/ untouched
    // (2026-07-02 seeded-break leak incident). Delta-based; advisory without git.
    // Node-builtins-only module — safe to load from repo root (see NOTE above).
    globalSetup: ['./packages/core/audit-self/hooks-tree-guard.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.claude/worktrees/**',
    ],
    testTimeout: 60_000,
  },
};
