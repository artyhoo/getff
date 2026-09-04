import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: [],
    // No test files ship with this preset yet (templates + baselines only).
    // Without this, `vitest run` exits 1 ("No test files found") and breaks
    // the root `npm test --workspaces` aggregate.
    passWithNoTests: true,
  },
});
