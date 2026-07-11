/**
 * Standard packages probed for `missing[]`. Layer 2 Research Agent uses this
 * list to recommend rules / preset-merges. Additive scope — Phase 5+ adds.
 */
export const KNOWN_PACKAGES: readonly string[] = [
  '@opentelemetry/api',
  '@playwright/test',
  'vitest',
  '@storybook/nextjs',
  '@storybook/nextjs-vite',
  'tailwindcss',
] as const;

export function computeMissing(deps: Set<string>): string[] {
  return KNOWN_PACKAGES.filter((p) => !deps.has(p));
}
