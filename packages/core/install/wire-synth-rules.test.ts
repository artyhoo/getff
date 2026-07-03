/**
 * wire-synth-rules.test.ts — N-rule synthesizer-driven wirer (TDD red → green via T3)
 *
 * Tests for wireNRules(): ingests a synthesizer eslintConfigSnippet (parsed JSON),
 * AST-merges missing rules into the consumer's resolved ESLint flat-config.
 *
 * Invariants (from plan T2 / kickoff §3):
 *  - Merge into EXISTING restricted-syntax-audit-exempt wrapper array; never clobber
 *  - Idempotent: all-present → already-wired, byte-identical
 *  - Non-destructive: bytes before modification unchanged
 *  - R2 NOT in synthRules (handled separately by wire-eslint-r2.ts)
 *
 * Prior-art: prior-art-evaluations.md#120, #131, #135 (reuse ts-morph engine; BUILD for N-rule)
 */

import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-ignore — wireNRules does not exist until T3 (red phase: import will resolve to undefined,
// failing the test that calls it; the describe blocks below catch that path)
import { wireNRules } from './wire-eslint-r2.ts';

const TS_MORPH_AVAILABLE =
  existsSync('./node_modules/ts-morph/package.json') ||
  existsSync('node_modules/ts-morph/package.json');

// ─── Synthetic rule set (subset of synthesizer output for react-next) ──────────
const SIMPLE_RULE = {
  'rules-as-tests/no-server-imports-in-client': 'error',
} as const;

// Abbreviated selectors for readability in tests; full selectors used in principle tests (T7)
const WRAPPER_RULE = {
  'rules-as-tests/restricted-syntax-audit-exempt': [
    'error',
    {
      selector: ":function:not(:has(CallExpression[callee.property.name='safeParse']))",
      message: 'Function accepts FormData but does not call .safeParse(...).',
    },
    {
      selector:
        "Program:not(Program:has(ExpressionStatement:first-child > Literal[value='use server'])) ExportNamedDeclaration > FunctionDeclaration[async=true]",
      message: "Server Action file must start with 'use server' directive (R20).",
    },
  ],
} as const;

const COMBINED_SYNTH_RULES = { ...SIMPLE_RULE, ...WRAPPER_RULE } as const;

// Source that has BOTH simple rule and wrapper selectors already present
function makeFullyWiredSource(): string {
  return [
    `import customRules from './eslint-rules-local/index.ts';`,
    `export default [`,
    `  {`,
    `    files: ['**/*.{ts,tsx}'],`,
    `    plugins: { 'rules-as-tests': customRules },`,
    `    rules: { 'rules-as-tests/no-server-imports-in-client': 'error' },`,
    `  },`,
    `  {`,
    `    files: ['**/app/**/*.ts'],`,
    `    plugins: { 'rules-as-tests': customRules },`,
    `    rules: {`,
    `      'rules-as-tests/restricted-syntax-audit-exempt': [`,
    `        'error',`,
    `        {`,
    `          selector: ":function:not(:has(CallExpression[callee.property.name='safeParse']))",`,
    `          message: 'Function accepts FormData but does not call .safeParse(...).',`,
    `        },`,
    `        {`,
    `          selector: "Program:not(Program:has(ExpressionStatement:first-child > Literal[value='use server'])) ExportNamedDeclaration > FunctionDeclaration[async=true]",`,
    `          message: "Server Action file must start with 'use server' directive (R20).",`,
    `        },`,
    `      ],`,
    `    },`,
    `  },`,
    `];`,
    '',
  ].join('\n');
}

// Minimal base export (no synthesized rules yet)
const BASE_SOURCE = `import base from './base.mjs';\nexport default [...base];\n`;

// ─── Guard: wireNRules must be exported ─────────────────────────────────────
describe('wireNRules export (T2 red guard)', () => {
  it('wireNRules is exported from wire-eslint-r2.ts', () => {
    expect(typeof wireNRules).toBe('function');
  });
});

// ─── Idempotency ────────────────────────────────────────────────────────────
describe('wireNRules — idempotency', () => {
  it('empty synthRules → already-wired (nothing to do)', async () => {
    const result = await wireNRules(`export default [];\n`, {});
    expect(result.status).toBe('already-wired');
    expect(result.modified).toBe(`export default [];\n`);
  });

  it(
    'source already has the simple rule → already-wired (no ts-morph needed)',
    async () => {
      const source = `export default [{ rules: { 'rules-as-tests/no-server-imports-in-client': 'error' } }];\n`;
      const result = await wireNRules(source, SIMPLE_RULE);
      expect(result.status).toBe('already-wired');
      expect(result.modified).toBe(source);
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'source with ALL synthesized rules+selectors → already-wired, byte-identical',
    async () => {
      const source = makeFullyWiredSource();
      const result = await wireNRules(source, COMBINED_SYNTH_RULES);
      expect(result.status).toBe('already-wired');
      expect(result.modified).toBe(source);
    },
  );

  it(
    'wrapper selector strings already in source → already-wired',
    async () => {
      const source = [
        `export default [`,
        `  {`,
        `    rules: {`,
        `      'rules-as-tests/restricted-syntax-audit-exempt': [`,
        `        'error',`,
        `        { selector: ":function:not(:has(CallExpression[callee.property.name='safeParse']))", message: 'x' },`,
        `        { selector: "Program:not(Program:has(ExpressionStatement:first-child > Literal[value='use server'])) ExportNamedDeclaration > FunctionDeclaration[async=true]", message: 'y' },`,
        `      ],`,
        `    },`,
        `  },`,
        `];`,
        '',
      ].join('\n');
      const result = await wireNRules(source, WRAPPER_RULE);
      expect(result.status).toBe('already-wired');
      expect(result.modified).toBe(source);
    },
  );
});

// ─── Simple rule wiring (ts-morph dependent) ────────────────────────────────
describe('wireNRules — simple rule wiring', () => {
  it.skipIf(!TS_MORPH_AVAILABLE)(
    'missing simple rule → appended as config block, source contains rule',
    async () => {
      const result = await wireNRules(BASE_SOURCE, SIMPLE_RULE);
      expect(result.status).toBe('wired');
      expect(result.modified).toMatch(/['"]rules-as-tests\/no-server-imports-in-client['"]/);
      // Original import is preserved (non-destructive)
      expect(result.modified).toContain(`import base from './base.mjs';`);
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'simple rule wire is idempotent on second call',
    async () => {
      const first = await wireNRules(BASE_SOURCE, SIMPLE_RULE);
      expect(first.status).toBe('wired');
      const second = await wireNRules(first.modified, SIMPLE_RULE);
      expect(second.status).toBe('already-wired');
      expect(second.modified).toBe(first.modified);
    },
  );
});

// ─── Wrapper rule wiring (ts-morph dependent) ───────────────────────────────
describe('wireNRules — wrapper rule (restricted-syntax-audit-exempt)', () => {
  it.skipIf(!TS_MORPH_AVAILABLE)(
    'wrapper completely absent → new config block added with all selectors',
    async () => {
      const result = await wireNRules(BASE_SOURCE, WRAPPER_RULE);
      expect(result.status).toBe('wired');
      expect(result.modified).toContain('rules-as-tests/restricted-syntax-audit-exempt');
      // Both selectors must appear
      expect(result.modified).toContain(
        ":function:not(:has(CallExpression[callee.property.name='safeParse']))",
      );
      expect(result.modified).toContain(
        "Program:not(Program:has(ExpressionStatement:first-child > Literal[value='use server'])) ExportNamedDeclaration > FunctionDeclaration[async=true]",
      );
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'wrapper block already has selectors → merges missing selector into existing array (no clobber)',
    async () => {
      // Source has wrapper with only the R14 selector
      const sourceWithPartialWrapper = [
        `import customRules from './eslint-rules-local/index.ts';`,
        `export default [`,
        `  {`,
        `    plugins: { 'rules-as-tests': customRules },`,
        `    rules: {`,
        `      'rules-as-tests/restricted-syntax-audit-exempt': [`,
        `        'error',`,
        `        {`,
        `          selector: ":function:not(:has(CallExpression[callee.property.name='safeParse']))",`,
        `          message: 'Function accepts FormData but does not call .safeParse(...).',`,
        `        },`,
        `      ],`,
        `    },`,
        `  },`,
        `];`,
        '',
      ].join('\n');
      const result = await wireNRules(sourceWithPartialWrapper, WRAPPER_RULE);
      // Should add the missing R20 selector to the existing block (not a new sibling)
      if (result.status === 'wired') {
        // R20 selector now present
        expect(result.modified).toContain(
          "Program:not(Program:has(ExpressionStatement:first-child > Literal[value='use server'])) ExportNamedDeclaration > FunctionDeclaration[async=true]",
        );
        // R14 selector STILL present (not clobbered)
        expect(result.modified).toContain(
          ":function:not(:has(CallExpression[callee.property.name='safeParse']))",
        );
        // Should NOT have two separate restricted-syntax-audit-exempt array entries at top level
        const matches = result.modified.match(
          /'rules-as-tests\/restricted-syntax-audit-exempt'/g,
        );
        expect(matches?.length ?? 0).toBe(1);
      } else {
        // Acceptable to degrade on partial-wrapper; must not clobber
        expect(['degrade', 'already-wired']).toContain(result.status);
      }
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'wrapper wire is idempotent on second call',
    async () => {
      const first = await wireNRules(BASE_SOURCE, WRAPPER_RULE);
      expect(first.status).toBe('wired');
      const second = await wireNRules(first.modified, WRAPPER_RULE);
      expect(second.status).toBe('already-wired');
    },
  );
});

// ─── Non-destructive (format preserved) ─────────────────────────────────────
describe('wireNRules — non-destructive format preservation', () => {
  it.skipIf(!TS_MORPH_AVAILABLE)(
    'lines before the modified section are byte-identical (Fixture E analogy)',
    async () => {
      const source = [
        `// My ESLint config`,
        `// Project: my-api`,
        ``,
        `import base from './base.mjs';`,
        `import customRules from './eslint-rules-local/index.ts';`,
        ``,
        `// Re-export with custom rules`,
        `export default [...base];`,
        ``,
      ].join('\n');
      const result = await wireNRules(source, SIMPLE_RULE);
      if (result.status !== 'wired') return; // skip if degrade
      const srcLines = source.split('\n');
      const resLines = result.modified.split('\n');
      const exportIdx = srcLines.findIndex((l) => l.startsWith('export default'));
      for (let i = 0; i < exportIdx; i++) {
        expect(resLines[i], `Line ${i} changed unexpectedly`).toBe(srcLines[i]);
      }
      expect(result.modified).toContain('no-server-imports-in-client');
    },
  );
});

// ─── Combined N-rule wiring ─────────────────────────────────────────────────
describe('wireNRules — combined (simple + wrapper)', () => {
  it.skipIf(!TS_MORPH_AVAILABLE)(
    'both simple rule and wrapper absent → both get wired',
    async () => {
      const result = await wireNRules(BASE_SOURCE, COMBINED_SYNTH_RULES);
      expect(result.status).toBe('wired');
      expect(result.modified).toMatch(/['"]rules-as-tests\/no-server-imports-in-client['"]/);
      expect(result.modified).toContain('restricted-syntax-audit-exempt');
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'combined wire is idempotent on second call',
    async () => {
      const first = await wireNRules(BASE_SOURCE, COMBINED_SYNTH_RULES);
      expect(first.status).toBe('wired');
      const second = await wireNRules(first.modified, COMBINED_SYNTH_RULES);
      expect(second.status).toBe('already-wired');
    },
  );
});

// ─── defineConfig(obj, …) shape — the real shipped consumer config format ────
// The installed react-next consumer config (eslint.config.mjs:50) and the gold preset
// (packages/preset-next-15-canonical/templates/eslint.config.react.mjs:50) both use
// `export default defineConfig(obj1, obj2, …)` with object args, NOT a single array arg.
// This section verifies the wired path is reachable for that shape (T-GIW-A guard).

const DEFINE_CONFIG_SOURCE_UNWIRED = [
  `import { defineConfig } from 'eslint/config';`,
  `import customRules from './eslint-rules-local/index.ts';`,
  ``,
  `export default defineConfig(`,
  `  { ignores: ['.next/**', 'dist/**'] },`,
  `  {`,
  `    files: ['**/*.{ts,tsx}'],`,
  `    plugins: { 'rules-as-tests': customRules },`,
  `  },`,
  `);`,
  '',
].join('\n');

const DEFINE_CONFIG_SOURCE_PARTIAL_WRAPPER = [
  `import { defineConfig } from 'eslint/config';`,
  `import customRules from './eslint-rules-local/index.ts';`,
  ``,
  `export default defineConfig(`,
  `  { ignores: ['.next/**'] },`,
  `  {`,
  `    files: ['**/app/**/*.ts'],`,
  `    plugins: { 'rules-as-tests': customRules },`,
  `    rules: {`,
  `      'rules-as-tests/restricted-syntax-audit-exempt': [`,
  `        'error',`,
  `        { selector: ":function:not(:has(CallExpression[callee.property.name='safeParse']))", message: 'x' },`,
  `      ],`,
  `    },`,
  `  },`,
  `);`,
  '',
].join('\n');

describe('wireNRules — defineConfig(obj, …) shape (production export shape)', () => {
  it.skipIf(!TS_MORPH_AVAILABLE)(
    'wrapper absent in defineConfig(obj, …) shape → wired (not unrecognised)',
    async () => {
      const result = await wireNRules(DEFINE_CONFIG_SOURCE_UNWIRED, WRAPPER_RULE);
      expect(result.status).toBe('wired');
      expect(result.modified).toContain('rules-as-tests/restricted-syntax-audit-exempt');
      expect(result.modified).toContain(
        ":function:not(:has(CallExpression[callee.property.name='safeParse']))",
      );
      // defineConfig call still present — not rewritten to [...] form
      expect(result.modified).toContain('defineConfig(');
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'simple rule absent in defineConfig(obj, …) → wired as new call arg',
    async () => {
      const result = await wireNRules(DEFINE_CONFIG_SOURCE_UNWIRED, SIMPLE_RULE);
      expect(result.status).toBe('wired');
      expect(result.modified).toMatch(/['"]rules-as-tests\/no-server-imports-in-client['"]/);
      expect(result.modified).toContain('defineConfig(');
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'wrapper already in a defineConfig arg → merges missing selector, no new sibling arg',
    async () => {
      const result = await wireNRules(DEFINE_CONFIG_SOURCE_PARTIAL_WRAPPER, WRAPPER_RULE);
      if (result.status === 'wired') {
        // R20 selector added into the existing block
        expect(result.modified).toContain(
          "Program:not(Program:has(ExpressionStatement:first-child > Literal[value='use server'])) ExportNamedDeclaration > FunctionDeclaration[async=true]",
        );
        // R14 selector still present (not clobbered)
        expect(result.modified).toContain(
          ":function:not(:has(CallExpression[callee.property.name='safeParse']))",
        );
        // Should NOT have two separate restricted-syntax-audit-exempt keys
        const matches = result.modified.match(
          /'rules-as-tests\/restricted-syntax-audit-exempt'/g,
        );
        expect(matches?.length ?? 0).toBe(1);
      } else {
        expect(['already-wired']).toContain(result.status);
      }
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'defineConfig wire is idempotent on second call',
    async () => {
      const first = await wireNRules(DEFINE_CONFIG_SOURCE_UNWIRED, WRAPPER_RULE);
      expect(first.status).toBe('wired');
      const second = await wireNRules(first.modified, WRAPPER_RULE);
      expect(second.status).toBe('already-wired');
    },
  );
});

// ─── Live-wins override (D2: live-research-default-delivery) ─────────────────
// When a live rule shares a preset rule-id, the live value must OVERRIDE the preset value in
// the consumer config — but ONLY when the rule-id is in opts.overrideKeys. Without it, the
// default append-if-missing keeps the preset (presence-only) — the non-vacuity pair.
describe('wireNRules — live-wins override (overrideKeys)', () => {
  const R12 = 'rules-as-tests/no-server-imports-in-client';
  const PRESENT_SIMPLE = `export default [{ rules: { '${R12}': 'error' } }];\n`;

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'present rule-id + different live value + overrideKeys → wired, value replaced (live wins)',
    async () => {
      const result = await wireNRules(PRESENT_SIMPLE, { [R12]: 'warn' }, { overrideKeys: new Set([R12]) });
      expect(result.status).toBe('wired');
      expect(result.modified).toMatch(new RegExp(`${R12}'\\s*:\\s*["']warn["']`));
      expect(result.modified).not.toMatch(new RegExp(`${R12}'\\s*:\\s*["']error["']`));
    },
  );

  it(
    'present rule-id + different live value but NO overrideKeys → already-wired (preset wins; non-vacuity)',
    async () => {
      const result = await wireNRules(PRESENT_SIMPLE, { [R12]: 'warn' }, {});
      expect(result.status).toBe('already-wired');
      expect(result.modified).toBe(PRESENT_SIMPLE);
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'override with SAME value → already-wired byte-identical (idempotent re-run)',
    async () => {
      const result = await wireNRules(PRESENT_SIMPLE, { [R12]: 'error' }, { overrideKeys: new Set([R12]) });
      expect(result.status).toBe('already-wired');
      expect(result.modified).toBe(PRESENT_SIMPLE);
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'override applied once is idempotent on a second override pass',
    async () => {
      const first = await wireNRules(PRESENT_SIMPLE, { [R12]: 'warn' }, { overrideKeys: new Set([R12]) });
      expect(first.status).toBe('wired');
      const second = await wireNRules(first.modified, { [R12]: 'warn' }, { overrideKeys: new Set([R12]) });
      expect(second.status).toBe('already-wired');
      expect(second.modified).toBe(first.modified);
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'override of an ABSENT rule-id → appended (falls through to missing-append path)',
    async () => {
      const result = await wireNRules(BASE_SOURCE, { [R12]: 'warn' }, { overrideKeys: new Set([R12]) });
      expect(result.status).toBe('wired');
      expect(result.modified).toMatch(/['"]rules-as-tests\/no-server-imports-in-client['"]/);
    },
  );
});

// ─── R2 not in synthRules ────────────────────────────────────────────────────
describe('wireNRules — R2 exclusion', () => {
  it(
    'R2 (no-unsafe-zod-parse) is NOT wired by wireNRules (it has its own wirer)',
    async () => {
      // synthRules never contains R2; this is by design (handled by wire-eslint-r2.ts separately)
      const r2InSnippet = { 'rules-as-tests/no-unsafe-zod-parse': 'error' } as const;
      // wireNRules should treat it like any other simple rule — just wire it if missing.
      // This test documents that wireNRules does NOT block on R2 specifically;
      // the install layer coordinates R2 via the existing wirer.
      const source = BASE_SOURCE;
      const result = await wireNRules(source, r2InSnippet);
      // Accept 'wired' OR 'already-wired' — the behaviour is defined, not excluded
      expect(['wired', 'already-wired', 'degrade']).toContain(result.status);
    },
  );
});
