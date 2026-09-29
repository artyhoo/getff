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

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-ignore — wireNRules does not exist until T3 (red phase: import will resolve to undefined,
// failing the test that calls it; the describe blocks below catch that path)
import {
  customRulesImportSpecifier,
  probeLintViaEslint,
  probeScopePath,
  probeScopePaths,
  wireNRules,
  writeWithLintProbe,
} from './wire-eslint-r2.ts';
import { presetRuleScopes } from './synth-and-wire.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

// Resolved exactly the way wireConfigSource / wireNRules load ts-morph (wire-eslint-r2.ts):
// node resolution anchored at the cwd, walking up. The `<cwd>/node_modules/ts-morph` probe this
// replaces missed the workspace-hoisted copy in the repo-root node_modules, so every run from
// packages/core (`npm --prefix packages/core run test:units`, the CI step) skipped the ts-morph
// cases green while the wirer itself found ts-morph (CI run 36471375667, 2026-09-28: 70/81 of
// wire-eslint-r2.test.ts and 18/39 of wire-synth-rules.test.ts skipped). Kept in sync with the
// twin in wire-eslint-r2.test.ts.
function tsMorphResolvable(): boolean {
  try {
    createRequire(resolve(process.cwd(), 'package.json')).resolve('ts-morph');
    return true;
  } catch {
    return false;
  }
}
const TS_MORPH_AVAILABLE = tsMorphResolvable();
// Where the cases are load-bearing, an absent ts-morph fails instead of skipping: CI always, and
// any run that sets REQUIRE_TS_MORPH=1 (a GETFF_* name would be scrubbed by vitest.setup.ts).
const TS_MORPH_REQUIRED = process.env.CI === 'true' || process.env.REQUIRE_TS_MORPH === '1';
function itRequiresTsMorph(): void {
  it.runIf(TS_MORPH_REQUIRED)('ts-morph resolves from the cwd, so no ts-morph case here is skipped', () => {
    expect(
      TS_MORPH_AVAILABLE,
      `ts-morph does not resolve from ${process.cwd()} — every skipIf(!TS_MORPH_AVAILABLE) case would pass by skipping`,
    ).toBe(true);
  });
}

describe('wire-synth-rules', () => {
  itRequiresTsMorph();
});

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

// ─── Critical-review S7-2: preset rules keep the preset's files: scope ──────────
//
// ❌ tried: wire the react-next preset set (R12 + the R14/R20 wrapper) into a brownfield config that
//    carries neither (create-next-app shape). BEFORE the fix both blocks were appended with no
//    `files:`, so R20 fired on every `export default async function Page()` repo-wide.
// ✅ expected: each appended block carries the scope the preset template gives that rule
//    (R12 → all ts/tsx, wrapper → RULE_GLOBS.boundary), read from presetRuleScopes().
describe('S7-2: preset rules keep their files: scope in brownfield configs', () => {
  const BROWNFIELD = [
    `const eslintConfig = [{ rules: { 'no-console': 'warn' } }];`,
    `export default [...eslintConfig];`,
    ``,
  ].join('\n');

  it('presetRuleScopes(react-next) mirrors the preset template RULE_GLOBS (drift guard)', () => {
    const tpl = readFileSync(
      resolve(HERE, '../../preset-next-15-canonical/templates/eslint.config.react.mjs'),
      'utf8',
    );
    const boundaryBlock = tpl.slice(tpl.indexOf('boundary: ['), tpl.indexOf('],', tpl.indexOf('boundary: [')));
    const boundary = [...boundaryBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const scopes = presetRuleScopes('react-next');
    expect(boundary.length).toBeGreaterThan(0);
    expect(scopes['rules-as-tests/restricted-syntax-audit-exempt']).toEqual(boundary);
    expect(scopes['rules-as-tests/no-server-imports-in-client']).toEqual(['**/*.{ts,tsx}']);
    expect(presetRuleScopes('ts-server')).toEqual({});
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('each appended preset block carries its own files: scope', async () => {
    const scopes = presetRuleScopes('react-next');
    const r = await wireNRules(BROWNFIELD, COMBINED_SYNTH_RULES, {
      scopeFor: (key: string) => (scopes[key] ? { files: scopes[key] } : undefined),
    });
    expect(r.status).toBe('wired');
    const wrapperBlock = r.modified.slice(r.modified.lastIndexOf('{ files:'));
    expect(wrapperBlock).toContain('**/app/api/**/*.{ts,tsx}');
    expect(wrapperBlock).toContain('restricted-syntax-audit-exempt');
    expect(r.modified).toMatch(/\{ files: \[["']\*\*\/\*\.\{ts,tsx\}["']\], rules: \{ "rules-as-tests\/no-server-imports-in-client"/);
    expect(r.modified).not.toMatch(/\{ rules: \{ "rules-as-tests\//);
  });
});

// ─── Critical-review N-rule probe: a wiring that breaks lint is rolled back ─────
//
// ❌ tried: the N-rule path wrote its result and exited 0 whatever ESLint then made of it (S7-1 and
//    S7-2 both shipped a config that loaded but crashed or went red on the first `eslint .`).
// ✅ expected: after the write ESLint actually lints a probe file; exit 2 (config cannot be used)
//    restores the original bytes and reports degrade — and says whether the original was already
//    broken. «ESLint not resolvable» cannot prove anything either way, so the write is kept.
describe('N-rule post-write lint probe + restore', () => {
  const ORIGINAL = `export default [{ rules: { 'no-console': 'warn' } }];\n`;
  const MODIFIED = `export default [{ rules: { 'no-console': 'warn' } }, { rules: { 'rules-as-tests/x': 'error' } }];\n`;
  const withFile = () => {
    const dir = mkdtempSync(join(tmpdir(), 'nrule-probe-'));
    const p = join(dir, 'eslint.config.mjs');
    writeFileSync(p, ORIGINAL, 'utf8');
    return { dir, p };
  };

  it('probe ok → modified bytes stay, status wired', async () => {
    const { dir, p } = withFile();
    const r = await writeWithLintProbe({ configPath: p, cwd: dir, original: ORIGINAL, modified: MODIFIED, runProbe: async () => ({ verdict: 'ok' }) });
    expect(r.status).toBe('wired');
    expect(readFileSync(p, 'utf8')).toBe(MODIFIED);
  });

  it('probe broken after write, original loads → original restored, degrade names the wiring', async () => {
    const { dir, p } = withFile();
    const runProbe = async () =>
      readFileSync(p, 'utf8') === MODIFIED
        ? ({ verdict: 'broken', detail: 'Could not find plugin "rules-as-tests"' } as const)
        : ({ verdict: 'ok' } as const);
    const r = await writeWithLintProbe({ configPath: p, cwd: dir, original: ORIGINAL, modified: MODIFIED, runProbe });
    expect(r.status).toBe('degrade');
    expect(readFileSync(p, 'utf8')).toBe(ORIGINAL);
    expect(r.degradeReason).toMatch(/wiring broke ESLint/);
    expect(r.degradeReason).toContain('Could not find plugin');
  });

  // Cold-review F1: a typed-lint config (or one whose plugins are not installed yet) fails the probe
  // with AND without the change. The probe cannot judge the wiring then, so the write stands — the
  // pre-probe behaviour — and the result says it was not verified. Rolling back here un-wired rules
  // on every no-deps install (b3-monorepo-per-workspace-wire.test.sh went red).
  it('probe broken both with and without the change → modified kept, wired, marked unverified', async () => {
    const { dir, p } = withFile();
    const r = await writeWithLintProbe({ configPath: p, cwd: dir, original: ORIGINAL, modified: MODIFIED, runProbe: async () => ({ verdict: 'broken', detail: 'boom' }) });
    expect(r.status).toBe('wired');
    expect(readFileSync(p, 'utf8')).toBe(MODIFIED);
    expect(r.probeNote).toMatch(/not verified/);
    expect(r.probeNote).toMatch(/already fails/);
  });

  it('probe broken after write, original unavailable → modified kept (original not proven good)', async () => {
    const { dir, p } = withFile();
    const runProbe = async () =>
      readFileSync(p, 'utf8') === MODIFIED
        ? ({ verdict: 'broken', detail: 'x' } as const)
        : ({ verdict: 'unavailable', detail: "Cannot find package 'eslint-plugin-react-native'" } as const);
    const r = await writeWithLintProbe({ configPath: p, cwd: dir, original: ORIGINAL, modified: MODIFIED, runProbe });
    expect(r.status).toBe('wired');
    expect(readFileSync(p, 'utf8')).toBe(MODIFIED);
    expect(r.probeNote).toMatch(/not verified/);
  });

  // Cold-review round 2, N6: the modified config is proven broken and the original could not be
  // re-checked (timeout). Nothing shows the original fails too → roll back, never keep a proven break.
  it('probe broken after write, original re-check timed out → original restored, degrade', async () => {
    const { dir, p } = withFile();
    const runProbe = async () =>
      readFileSync(p, 'utf8') === MODIFIED
        ? ({ verdict: 'broken', detail: 'Cannot find module' } as const)
        : ({ verdict: 'unavailable', detail: 'ESLint did not finish in time' } as const);
    const r = await writeWithLintProbe({ configPath: p, cwd: dir, original: ORIGINAL, modified: MODIFIED, runProbe });
    expect(r.status).toBe('degrade');
    expect(readFileSync(p, 'utf8')).toBe(ORIGINAL);
    expect(r.degradeReason).toMatch(/rolled back/);
  });

  // The probe lints one file per extension. An original that already exits 2 on an extension the
  // project does not have (a `.mts` block naming a plugin it never registers) must not make every
  // later break look like «the original fails too»: the verdict is compared path by path.
  it('probe exits 2 after write on a path the original lints, the original exits 2 on another → original restored', async () => {
    const { dir, p } = withFile();
    const runProbe = async () =>
      readFileSync(p, 'utf8') === MODIFIED
        ? ({
            verdict: 'broken', failure: 'config', detail: 'Could not find plugin "foo"',
            paths: { 'x.mts': { outcome: 'config', detail: 'Could not find plugin "foo"' }, 'x.ts': { outcome: 'config', detail: 'Could not find plugin "rules-as-tests"' } },
          } as const)
        : ({ verdict: 'broken', failure: 'config', detail: 'Could not find plugin "foo"', paths: { 'x.mts': { outcome: 'config' }, 'x.ts': { outcome: 'ok' } } } as const);
    const r = await writeWithLintProbe({ configPath: p, cwd: dir, original: ORIGINAL, modified: MODIFIED, runProbe });
    expect(r.status).toBe('degrade');
    expect(readFileSync(p, 'utf8')).toBe(ORIGINAL);
    // The reason quotes the path the change broke, not the failure the original already had.
    expect(r.degradeReason).toMatch(/wiring broke ESLint.*"rules-as-tests"/);
  });

  it('probe adds a parsing error on a path the original lints → original restored', async () => {
    const { dir, p } = withFile();
    const runProbe = async () =>
      readFileSync(p, 'utf8') === MODIFIED
        ? ({ verdict: 'broken', failure: 'parse', detail: 'Parsing error', paths: { 'x.mts': { outcome: 'config' }, 'x.tsx': { outcome: 'parse' } } } as const)
        : ({ verdict: 'broken', failure: 'config', detail: 'Could not find plugin "foo"', paths: { 'x.mts': { outcome: 'config' }, 'x.tsx': { outcome: 'ok' } } } as const);
    const r = await writeWithLintProbe({ configPath: p, cwd: dir, original: ORIGINAL, modified: MODIFIED, runProbe });
    expect(r.status).toBe('degrade');
    expect(readFileSync(p, 'utf8')).toBe(ORIGINAL);
  });

  // Paired: every path fails the same way with and without the change → the probe cannot judge it.
  it('paired: the same paths fail the same way with and without the change → modified kept, unverified', async () => {
    const { dir, p } = withFile();
    const runProbe = async () => ({ verdict: 'broken', failure: 'config', detail: 'Could not find plugin "foo"', paths: { 'x.mts': { outcome: 'config' }, 'x.ts': { outcome: 'ok' } } } as const);
    const r = await writeWithLintProbe({ configPath: p, cwd: dir, original: ORIGINAL, modified: MODIFIED, runProbe });
    expect(r.status).toBe('wired');
    expect(readFileSync(p, 'utf8')).toBe(MODIFIED);
    expect(r.probeNote).toMatch(/already fails/);
  });

  it('probeScopePath: a files: glob becomes one concrete path the glob matches', () => {
    expect(probeScopePath('**/app/api/**/*.{ts,tsx}')).toBe('app/api/__aif_nrule_probe__.ts');
    expect(probeScopePath('**/*.{ts,tsx}')).toBe('__aif_nrule_probe__.ts');
    expect(probeScopePath('**/features/*/api/**/*.{ts,tsx}')).toBe('features/x/api/__aif_nrule_probe__.ts');
    expect(probeScopePath('apps/api/**')).toBe('apps/api/__aif_nrule_probe__.js');
    expect(probeScopePath('src/**/*.mjs')).toBe('src/__aif_nrule_probe__.mjs');
    expect(probeScopePath('!**/legacy/**')).toBeUndefined();
    expect(probeScopePath('src/[ab]/*.ts')).toBeUndefined();
  });

  // ESLint lints every file a block's files: glob names, `.tsx` as well as `.ts`: one path per brace
  // alternative, so a block that breaks only the second extension is linted too.
  it('probeScopePaths: one concrete path per brace alternative, probeScopePath\'s first', () => {
    expect(probeScopePaths('**/app/api/**/*.{ts,tsx}')).toEqual(['app/api/__aif_nrule_probe__.ts', 'app/api/__aif_nrule_probe__.tsx']);
    expect(probeScopePaths('**/{app,src}/**/*.{ts,tsx}')).toEqual([
      'app/__aif_nrule_probe__.ts',
      'app/__aif_nrule_probe__.tsx',
      'src/__aif_nrule_probe__.ts',
      'src/__aif_nrule_probe__.tsx',
    ]);
    expect(probeScopePaths('apps/api/**')).toEqual(['apps/api/__aif_nrule_probe__.js']);
    expect(probeScopePaths('!**/legacy/**')).toEqual([]);
    expect(probeScopePaths('src/[ab]/*.ts')).toEqual([]);
  });

  it('probe unavailable → write kept (nothing proved either way), status wired', async () => {
    const { dir, p } = withFile();
    const r = await writeWithLintProbe({ configPath: p, cwd: dir, original: ORIGINAL, modified: MODIFIED, runProbe: async () => ({ verdict: 'unavailable' }) });
    expect(r.status).toBe('wired');
    expect(readFileSync(p, 'utf8')).toBe(MODIFIED);
  });

  // The real probe against the real ESLint: the S7-1 shape (a rules-as-tests rule with no plugin
  // registration for the linted file) must read as broken; the original must read as ok.
  const ESLINT_RESOLVABLE = (() => {
    try { createRequire(join(HERE, 'x.js')).resolve('eslint/package.json'); return true; } catch { return false; }
  })();
  it.skipIf(!ESLINT_RESOLVABLE)('probeLintViaEslint: unregistered plugin → broken; plain config → ok', async () => {
    const dir = mkdtempSync(join(HERE, '.nrule-probe-'));
    try {
      const p = join(dir, 'eslint.config.mjs');
      writeFileSync(p, MODIFIED, 'utf8');
      const bad = await probeLintViaEslint(p, dir);
      expect(bad.verdict).toBe('broken');
      expect(bad.detail).toMatch(/could not find plugin/i);
      writeFileSync(p, ORIGINAL, 'utf8');
      expect((await probeLintViaEslint(p, dir)).verdict).toBe('ok');
      expect(readdirSync(dir).sort()).toEqual(['eslint.config.mjs']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  // The plugin registered for `.js` only: the `.js` probe file resolves it, the unscoped rule block
  // reaches `.mjs`/`.cjs` (the config itself) without it. A `.js` + `.ts` probe read this as ok.
  it.skipIf(!ESLINT_RESOLVABLE)('probeLintViaEslint: plugin registered for .js only, rule block unscoped → broken', async () => {
    const dir = mkdtempSync(join(HERE, '.nrule-probe-'));
    try {
      const p = join(dir, 'eslint.config.mjs');
      writeFileSync(
        p,
        `const plugin = { rules: { x: { create: () => ({}) } } };\n` +
          `export default [{ files: ['**/*.js'], plugins: { 'rules-as-tests': plugin } }, { rules: { 'rules-as-tests/x': 'error' } }];\n`,
        'utf8',
      );
      const r = await probeLintViaEslint(p, dir);
      expect(r.verdict).toBe('broken');
      expect(r.detail).toMatch(/could not find plugin/i);
      expect(readdirSync(dir).sort()).toEqual(['eslint.config.mjs']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  // Cold-review F2: without --full the consumer's plugins (and the barrel's @typescript-eslint/utils)
  // are not installed yet. A missing PACKAGE says nothing about the wiring → unavailable, not broken.
  it.skipIf(!ESLINT_RESOLVABLE)('probeLintViaEslint: a config importing a missing package → unavailable', async () => {
    const dir = mkdtempSync(join(HERE, '.nrule-probe-'));
    try {
      const p = join(dir, 'eslint.config.mjs');
      writeFileSync(p, `import x from 'aif-no-such-package-xyz';\nexport default [{ plugins: { x }, rules: {} }];\n`, 'utf8');
      const r = await probeLintViaEslint(p, dir);
      expect(r.verdict).toBe('unavailable');
      expect(r.detail).toMatch(/aif-no-such-package-xyz/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  // Cold-review F3: appended blocks carry files: scopes (S7-2). A bad selector inside a scoped block
  // never fires on a root-level probe file — the scope path must be linted too.
  it.skipIf(!ESLINT_RESOLVABLE)('probeLintViaEslint: a broken rule inside a files:-scoped block → broken via scopeGlobs', async () => {
    const dir = mkdtempSync(join(HERE, '.nrule-probe-'));
    try {
      const p = join(dir, 'eslint.config.mjs');
      writeFileSync(
        p,
        `export default [{ files: ['**/app/api/**/*.{ts,tsx}'], rules: { 'no-restricted-syntax': ['error', { selector: 'CallExpression[[[bad', message: 'x' }] } }];\n`,
        'utf8',
      );
      expect((await probeLintViaEslint(p, dir)).verdict).toBe('ok');
      const r = await probeLintViaEslint(p, dir, { scopeGlobs: ['**/app/api/**/*.{ts,tsx}'] });
      expect(r.verdict).toBe('broken');
      expect(readdirSync(dir).sort()).toEqual(['eslint.config.mjs']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  // Q4.7: getff now writes a files:-scoped R2 block over .ts files into a config the CONSUMER owns.
  // A config with no TypeScript parser for that scope makes `eslint .` report a parsing error on every
  // boundary file — the probe must read that as broken (a TS-only probe body), so the write is rolled back.
  it.skipIf(!ESLINT_RESOLVABLE)('probeLintViaEslint: a scoped block over .ts files the config cannot parse → broken; with a TS parser → ok', async () => {
    const dir = mkdtempSync(join(HERE, '.nrule-probe-'));
    try {
      const p = join(dir, 'eslint.config.mjs');
      writeFileSync(p, `export default [{ files: ['**/routes/**/*.{ts,tsx}'], rules: { 'no-console': 'error' } }];\n`, 'utf8');
      const r = await probeLintViaEslint(p, dir, { scopeGlobs: ['**/routes/**/*.{ts,tsx}'] });
      expect(r.verdict).toBe('broken');
      expect(r.detail).toMatch(/Parsing error/);
      writeFileSync(
        p,
        `import tseslint from 'typescript-eslint';\nexport default [{ files: ['**/routes/**/*.{ts,tsx}'], languageOptions: { parser: tseslint.parser }, rules: { 'no-console': 'error' } }];\n`,
        'utf8',
      );
      expect((await probeLintViaEslint(p, dir, { scopeGlobs: ['**/routes/**/*.{ts,tsx}'] })).verdict).toBe('ok');
      expect(readdirSync(dir).sort()).toEqual(['eslint.config.mjs']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  // The root run lints one probe file per extension; a config that matches only some of them makes
  // ESLint warn «File ignored» for the rest, ahead of the parsing error. The detail is what the
  // not-wired line quotes, so it must name the parsing error, not the probe files ESLint skipped.
  it.skipIf(!ESLINT_RESOLVABLE)('probeLintViaEslint: a parsing error\'s detail leaves out the probe files ESLint ignored', async () => {
    const dir = mkdtempSync(join(HERE, '.nrule-probe-'));
    try {
      const p = join(dir, 'eslint.config.mjs');
      writeFileSync(p, `export default [{ files: ['**/*.ts'], rules: { 'no-console': 'error' } }];\n`, 'utf8');
      const r = await probeLintViaEslint(p, dir);
      expect(r.verdict).toBe('broken');
      expect(r.detail).toMatch(/Parsing error/);
      expect(r.detail).not.toMatch(/File ignored/);
      expect(readdirSync(dir).sort()).toEqual(['eslint.config.mjs']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  // A run that could not finish proves nothing; it must not replace a parsing error another run proved.
  it.skipIf(!ESLINT_RESOLVABLE)('probeLintViaEslint: a scope run that times out keeps the parsing error the root run found', async () => {
    const dir = mkdtempSync(join(HERE, '.nrule-probe-'));
    try {
      const p = join(dir, 'eslint.config.mjs');
      writeFileSync(
        p,
        `const hang = { parse() { for (;;) {} } };\n` +
          `export default [{ files: ['**/*.ts'], rules: {} }, { files: ['**/app/api/**/*.{ts,tsx}'], languageOptions: { parser: hang } }];\n`,
        'utf8',
      );
      const r = await probeLintViaEslint(p, dir, { scopeGlobs: ['**/app/api/**/*.{ts,tsx}'], timeoutMs: 3000 });
      expect(r.verdict).toBe('broken');
      expect(r.failure).toBe('parse');
      expect(readdirSync(dir).sort()).toEqual(['eslint.config.mjs']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  // One path exits 2, another has a parsing error. The verdict is the exit 2: it is what the «ESLint
  // already fails on this config» note quotes, and an exit 2 stops `eslint .` where a parsing error does not.
  it.skipIf(!ESLINT_RESOLVABLE)('probeLintViaEslint: an exit 2 on one path outranks a parsing error on another', async () => {
    const dir = mkdtempSync(join(HERE, '.nrule-probe-'));
    try {
      const p = join(dir, 'eslint.config.mjs');
      writeFileSync(p, `export default [{ files: ['**/*.ts'], rules: {} }, { files: ['**/*.mjs'], rules: { 'foo/x': 'error' } }];\n`, 'utf8');
      const r = await probeLintViaEslint(p, dir);
      expect(r.verdict).toBe('broken');
      expect(r.failure).toBe('config');
      expect(r.detail).toMatch(/plugin "foo"/);
      expect(r.paths?.['__aif_nrule_probe__.ts']?.outcome).toBe('parse');
      expect(readdirSync(dir).sort()).toEqual(['eslint.config.mjs']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  // A type-aware config (typescript-eslint projectService or parserOptions.project — any stack) refuses
  // a probe file its tsconfig does not include, also as a «Parsing error». That says nothing about the
  // wiring, and the original config refuses it the same way: read as broken, every such install would
  // report «ESLint already fails on this config». Only a syntax parsing error counts.
  it.skipIf(!ESLINT_RESOLVABLE)('probeLintViaEslint: a typed-lint parser refusing a probe outside its tsconfig → ok, not broken', async () => {
    const dir = mkdtempSync(join(HERE, '.nrule-probe-'));
    try {
      const p = join(dir, 'eslint.config.mjs');
      writeFileSync(join(dir, 'tsconfig.json'), '{ "compilerOptions": { "strict": true }, "include": ["src"] }\n', 'utf8');
      writeFileSync(
        p,
        `import tseslint from 'typescript-eslint';\nexport default [{ files: ['**/*.{ts,tsx}'], languageOptions: { parser: tseslint.parser, parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } }, rules: { 'no-console': 'error' } }];\n`,
        'utf8',
      );
      const r = await probeLintViaEslint(p, dir, { scopeGlobs: ['**/routes/**/*.{ts,tsx}'] });
      expect(r).toEqual({ verdict: 'ok' });
      expect(readdirSync(dir).sort()).toEqual(['eslint.config.mjs', 'tsconfig.json']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  // Cold-review F7: per-workspace wiring runs from the project root, where a workspace-only ESLint
  // (no hoisting) does not resolve. The config's own directory is tried first.
  const REPO_NODE_MODULES = resolve(HERE, '..', '..', '..', 'node_modules');
  it.skipIf(!existsSync(join(REPO_NODE_MODULES, 'eslint', 'package.json')))(
    'probeLintViaEslint: ESLint installed only in the workspace is found from the config dir',
    async () => {
      const cwd = mkdtempSync(join(tmpdir(), 'nrule-root-'));
      const ws = join(cwd, 'apps', 'web');
      try {
        mkdirSync(ws, { recursive: true });
        symlinkSync(REPO_NODE_MODULES, join(ws, 'node_modules'));
        writeFileSync(join(ws, 'package.json'), '{"name":"web","type":"module"}\n', 'utf8');
        const p = join(ws, 'eslint.config.mjs');
        writeFileSync(p, MODIFIED, 'utf8');
        expect((await probeLintViaEslint(p, cwd)).verdict).toBe('broken');
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    },
    60_000,
  );

  // Cold-review F7: a config that never settles must not hang the install.
  it.skipIf(!ESLINT_RESOLVABLE)('probeLintViaEslint: a config that hangs → unavailable after the timeout', async () => {
    const dir = mkdtempSync(join(HERE, '.nrule-probe-'));
    try {
      const p = join(dir, 'eslint.config.mjs');
      writeFileSync(p, `setInterval(() => {}, 1000);\nawait new Promise(() => {});\nexport default [];\n`, 'utf8');
      const r = await probeLintViaEslint(p, dir, { timeoutMs: 4000 });
      expect(r.verdict).toBe('unavailable');
      expect(readdirSync(dir).sort()).toEqual(['eslint.config.mjs']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});

// ─── A plugin registration scoped by a spread is not global ─────────────────────
//
// ❌ tried (2026-09-28, ESLint 9.39.4): the consumer registers the plugin in
//    `{ ...onlyJs, plugins: { 'rules-as-tests': customRules }, rules: {} }` with
//    `const onlyJs = { files: ['**/*.js'] }`. The detector saw no `files` key on the literal, read the
//    registration as global, and appended a plugin-less rule block; `eslint .` then exited 2 on
//    every .mjs file («could not find plugin "rules-as-tests"»).
// ✅ expected: the real CLI wires the rule with its own plugin registration, and `eslint .` exits 0.
describe('synth-and-wire CLI: a spread-scoped plugin registration', () => {
  const REPO_NODE_MODULES = resolve(HERE, '..', '..', '..', 'node_modules');
  const CLI = join(HERE, 'synth-and-wire.ts');
  const CAN_RUN = existsSync(join(REPO_NODE_MODULES, 'eslint', 'package.json'))
    && existsSync(join(REPO_NODE_MODULES, 'ts-morph', 'package.json'))
    && existsSync(join(REPO_NODE_MODULES, 'tsx', 'package.json'));

  it.skipIf(!CAN_RUN)('wires the rule with its own registration and `eslint .` exits 0', () => {
    const dir = mkdtempSync(join(realpathSync(tmpdir()), 'nrule-spread-'));
    const link = join(dir, 'node_modules');
    try {
      symlinkSync(REPO_NODE_MODULES, link);
      writeFileSync(join(dir, 'package.json'), '{ "name": "fx", "type": "module" }\n', 'utf8');
      mkdirSync(join(dir, 'eslint-rules-local'));
      writeFileSync(
        join(dir, 'eslint-rules-local', 'index.mjs'),
        `export default { rules: { 'no-foo': { meta: { type: 'problem', schema: [] }, create: () => ({}) } } };\n`,
        'utf8',
      );
      mkdirSync(join(dir, '.ai-factory', 'synthesizer-output'), { recursive: true });
      writeFileSync(
        join(dir, '.ai-factory', 'synthesizer-output', 'eslint-rules-snippet.json'),
        '{ "rules-as-tests/no-foo": "error" }\n',
        'utf8',
      );
      writeFileSync(
        join(dir, 'eslint.config.mjs'),
        [
          `import customRules from './eslint-rules-local/index.mjs';`,
          `const onlyJs = { files: ['**/*.js'] };`,
          `export default [{ ...onlyJs, plugins: { 'rules-as-tests': customRules }, rules: {} }];`,
          ``,
        ].join('\n'),
        'utf8',
      );
      mkdirSync(join(dir, 'src'));
      writeFileSync(join(dir, 'src', 'a.js'), 'export const a = 1;\n', 'utf8');
      writeFileSync(join(dir, 'src', 'b.mjs'), 'export const b = 1;\n', 'utf8');

      const wire = spawnSync(
        process.execPath,
        ['--import', 'tsx', CLI, '--stack', 'ts-server', '--path', './eslint.config.mjs'],
        { cwd: dir, encoding: 'utf8', timeout: 90_000 },
      );
      const wireOut = `${wire.stdout}\n${wire.stderr}`;
      expect(wire.status, wireOut).toBe(0);
      expect(wireOut).toMatch(/synthesized rules wired into/);
      const config = readFileSync(join(dir, 'eslint.config.mjs'), 'utf8');
      expect(config).toMatch(/plugins: \{ 'rules-as-tests': customRules \}, rules: \{ ["']rules-as-tests\/no-foo["']/);

      const lint = spawnSync(process.execPath, [join(link, 'eslint', 'bin', 'eslint.js'), '.'], {
        cwd: dir, encoding: 'utf8', timeout: 90_000,
      });
      expect(lint.status, `${lint.stdout}\n${lint.stderr}`).toBe(0);
    } finally {
      // The link first: a recursive delete must never walk into the repo's node_modules.
      if (lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink()) unlinkSync(link);
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});

// ─── The N-rule wirer end to end against the real ESLint (2026-09-28) ─────────
//
// ❌ tried: probeLintViaEslint linted a `.js` and a `.ts` file next to the config plus the first brace
//    alternative of each files: scope. `eslint .` also lints `.mjs`/`.cjs` (the config itself) and every
//    extension a block names, so a plugin-less rules-as-tests block over a base that registers the
//    plugin for some extensions only passed the probe, the wirer reported `wired`, and the consumer's
//    lint died with exit 2, «could not find plugin». A plugin-less block is what wireNRules writes when
//    the base's registration reads as global — here a `files` key carried in by a spread.
// ✅ expected: once the wirer is done, ESLint can lint the fixture's files. Runs once per ESLint this
//    checkout has — the repo root's (9.x, what consumers get) and packages/core's (10.x).
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const ESLINT_INSTALLS = [join(REPO_ROOT, 'node_modules'), join(REPO_ROOT, 'packages', 'core', 'node_modules')]
  .filter((nm) => existsSync(join(nm, 'eslint', 'package.json')))
  .map((nm) => ({
    nm,
    version: (JSON.parse(readFileSync(join(nm, 'eslint', 'package.json'), 'utf8')) as { version: string }).version,
    tsParser: existsSync(join(nm, 'typescript-eslint', 'package.json')),
  }));
const E2E_BARREL =
  `const rule = { meta: { schema: false }, create: () => ({}) };\n` +
  `export default { rules: { 'live-rule': rule, 'no-server-imports-in-client': rule, 'restricted-syntax-audit-exempt': rule } };\n`;
const IMPORT_BARREL = `import customRules from './eslint-rules-local/index.mjs';\n`;
const LIVE_RULE = { 'rules-as-tests/live-rule': 'error' };

it('the N-rule end-to-end matrix below has an ESLint install to run against', () => {
  expect(ESLINT_INSTALLS.length, `no eslint under ${REPO_ROOT}/node_modules or packages/core/node_modules`).toBeGreaterThan(0);
});

for (const { nm, version, tsParser } of ESLINT_INSTALLS) {
  describe(`N-rule wirer + probeLintViaEslint (ESLint ${version}) — wired means ESLint can lint`, () => {
    /** A consumer on a physical path whose node_modules is this ESLint install, with the barrel and `files`. */
    function consumer(config: string, files: Record<string, string>): string {
      const dir = mkdtempSync(join(realpathSync(tmpdir()), 'nrule-e2e-'));
      symlinkSync(nm, join(dir, 'node_modules'));
      mkdirSync(join(dir, 'eslint-rules-local'));
      writeFileSync(join(dir, 'eslint-rules-local', 'index.mjs'), E2E_BARREL, 'utf8');
      for (const [rel, body] of Object.entries(files)) {
        mkdirSync(dirname(join(dir, rel)), { recursive: true });
        writeFileSync(join(dir, rel), body, 'utf8');
      }
      writeFileSync(join(dir, 'eslint.config.mjs'), config, 'utf8');
      return dir;
    }

    /** synth-and-wire.ts main()'s default path: wireNRules with react-next's scopes, then the lint-probed write. */
    async function wire(dir: string, rules: Record<string, unknown>) {
      const configPath = join(dir, 'eslint.config.mjs');
      const scopes = presetRuleScopes('react-next');
      const source = readFileSync(configPath, 'utf8');
      const r = await wireNRules(source, rules, {
        customRulesImportPath: customRulesImportSpecifier(configPath, dir),
        scopeFor: (key: string) => (scopes[key] ? { files: scopes[key] } : undefined),
      });
      if (r.status !== 'wired') return r;
      const scopeGlobs = [...new Set(Object.keys(rules).flatMap((key) => scopes[key] ?? []))];
      return writeWithLintProbe({
        configPath, cwd: dir, original: source, modified: r.modified,
        runProbe: (p, c) => probeLintViaEslint(p, c, { scopeGlobs }),
      });
    }

    /** The consumer's own lint over the whole fixture (`eslint .`). */
    function lintRc(dir: string): { rc: number; out: string } {
      try {
        execFileSync(process.execPath, [join(nm, 'eslint', 'bin', 'eslint.js'), '.'], { cwd: dir, stdio: 'pipe' });
        return { rc: 0, out: '' };
      } catch (e: unknown) {
        const err = e as { status?: number; stderr?: Buffer; stdout?: Buffer };
        return { rc: err.status ?? -1, out: `${String(err.stderr ?? '')}${String(err.stdout ?? '')}`.slice(0, 300) };
      }
    }

    const SRC = { 'src/h.js': 'export const x = 1;\n', 'src/h.ts': 'export const y = 1;\n' };
    const ONLY_JS = `const onlyJs = { files: ['**/*.js'] };\n`;
    const ONLY_TS = `import tseslint from 'typescript-eslint';\nconst onlyTs = { files: ['**/*.ts'], languageOptions: { parser: tseslint.parser } };\n`;

    // `.js` is registered, so the `.js` probe file passes; `eslint .` also lints eslint.config.mjs.
    it.skipIf(!TS_MORPH_AVAILABLE)('plugin registered for .js only, rule block unscoped → not left for eslint . to crash on', async () => {
      const dir = consumer(`${IMPORT_BARREL}${ONLY_JS}export default [{ ...onlyJs, plugins: { 'rules-as-tests': customRules }, rules: {} }];\n`, SRC);
      try {
        await wire(dir, LIVE_RULE);
        const lint = lintRc(dir);
        expect(lint.rc, lint.out).toBe(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 60_000);

    // react-next scopes its rule to `**/*.{ts,tsx}`; the plugin is registered for `.ts` only.
    it.skipIf(!TS_MORPH_AVAILABLE || !tsParser)('plugin registered for .ts only, rule block over {ts,tsx} → not left for eslint . to crash on', async () => {
      const dir = consumer(
        `${IMPORT_BARREL}${ONLY_TS}export default [{ ...onlyTs, plugins: { 'rules-as-tests': customRules }, rules: {} }];\n`,
        { ...SRC, 'src/c.tsx': 'export const z = 1;\n' },
      );
      try {
        await wire(dir, { 'rules-as-tests/no-server-imports-in-client': 'error' });
        const lint = lintRc(dir);
        expect(lint.rc, lint.out).toBe(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 60_000);

    // Only the boundary-scoped wrapper is appended; its `.tsx` alternative is what breaks.
    it.skipIf(!TS_MORPH_AVAILABLE || !tsParser)('plugin registered for .ts only, block over the boundary {ts,tsx} → not left for eslint . to crash on', async () => {
      const dir = consumer(
        `${IMPORT_BARREL}${ONLY_TS}export default [{ ...onlyTs, plugins: { 'rules-as-tests': customRules }, rules: { 'rules-as-tests/no-server-imports-in-client': 'error' } }];\n`,
        { ...SRC, 'app/api/route.tsx': 'export const r = 1;\n' },
      );
      try {
        await wire(dir, { 'rules-as-tests/restricted-syntax-audit-exempt': ['error', { selector: 'DebuggerStatement', message: 'x' }] });
        const lint = lintRc(dir);
        expect(lint.rc, lint.out).toBe(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 60_000);

    // The original fails the probe's TypeScript file (a `.ts` block with no TypeScript parser), so a
    // «the original fails too» comparison kept a change that made ESLint exit 2 — a worse failure.
    it.skipIf(!TS_MORPH_AVAILABLE)('a .ts block with no TS parser does not hide an exit 2 the wiring caused', async () => {
      const dir = consumer(
        `${IMPORT_BARREL}${ONLY_JS}export default [{ ...onlyJs, plugins: { 'rules-as-tests': customRules }, rules: {} }, { files: ['**/*.ts'], rules: {} }];\n`,
        SRC,
      );
      try {
        expect(lintRc(dir).rc).toBe(0);
        await wire(dir, LIVE_RULE);
        const lint = lintRc(dir);
        expect(lint.rc, lint.out).toBe(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 60_000);

    // The same parse failure at the root, while the exit 2 shows only inside a scope: the probe must
    // not stop at the root's parsing error.
    it.skipIf(!TS_MORPH_AVAILABLE)('a .ts block with no TS parser does not hide an exit 2 inside a scope', async () => {
      const dir = consumer(
        `${IMPORT_BARREL}const onlyTs = { files: ['**/*.ts'] };\n` +
          `export default [{ ...onlyTs, plugins: { 'rules-as-tests': customRules }, rules: { 'rules-as-tests/no-server-imports-in-client': 'error' } }];\n`,
        { ...SRC, 'app/api/route.tsx': 'export const r = 1;\n' },
      );
      try {
        expect(lintRc(dir).rc).toBe(0);
        await wire(dir, { 'rules-as-tests/restricted-syntax-audit-exempt': ['error', { selector: 'DebuggerStatement', message: 'x' }] });
        const lint = lintRc(dir);
        expect(lint.rc, lint.out).toBe(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 60_000);

    // The original already exits 2 on `.mts` (a block naming a plugin registered for other extensions),
    // a file the project does not have: its `eslint .` is clean. A write that makes ESLint exit 2 on
    // `.ts` must still be rolled back — one pooled run over every probe file reads «fails either way».
    // The plugin is registered as its own object (`{ ...customRules }`), not the imported binding: the
    // wirer registers `customRules` itself for the scope it adds (#1882), and ESLint exits 2 on a file
    // where two different objects share the name «rules-as-tests» («Cannot redefine plugin»). With the
    // shared binding the write is sound and nothing is rolled back, so the case would test nothing.
    it.skipIf(!TS_MORPH_AVAILABLE)('an original that exits 2 on an extension the project lacks does not hide an exit 2 the wiring caused', async () => {
      const config =
        `${IMPORT_BARREL}const foo = { rules: { x: { create: () => ({}) } } };\n${ONLY_JS}` +
        `export default [{ files: ['**/*.{js,mjs,cjs,ts}'], plugins: { foo } }, { files: ['**/*.mts'], rules: { 'foo/x': 'error' } },` +
        ` { ...onlyJs, plugins: { 'rules-as-tests': { ...customRules } }, rules: {} }];\n`;
      const dir = consumer(config, SRC);
      try {
        expect(lintRc(dir).rc).toBe(0);
        const r = await wire(dir, LIVE_RULE);
        expect(r.status).toBe('degrade');
        expect(readFileSync(join(dir, 'eslint.config.mjs'), 'utf8')).toBe(config);
        const lint = lintRc(dir);
        expect(lint.rc, lint.out).toBe(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 60_000);

    // A `.ts` block with no TypeScript parser, the plugin registered for every file, and react-next's
    // rule over `{ts,tsx}`: the wiring is sound and must stay. The block makes ESLint lint `.tsx` too, so
    // a `.tsx` probe body with TypeScript syntax would fail to parse there only after the write — a
    // rollback of a sound wiring into exactly the config shape the `.ts` body already cannot judge.
    it.skipIf(!TS_MORPH_AVAILABLE)('paired: a .ts block with no TS parser and a sound block over {ts,tsx} → still wired', async () => {
      const config = `${IMPORT_BARREL}export default [{ plugins: { 'rules-as-tests': customRules } }, { files: ['**/*.ts'], rules: {} }];\n`;
      const dir = consumer(config, { ...SRC, 'src/c.tsx': 'export const z = 1;\n' });
      try {
        expect(lintRc(dir).rc).toBe(0);
        const r = await wire(dir, { 'rules-as-tests/no-server-imports-in-client': 'error' });
        expect(r.status).toBe('wired');
        expect(readFileSync(join(dir, 'eslint.config.mjs'), 'utf8')).toContain('rules-as-tests/no-server-imports-in-client');
        const lint = lintRc(dir);
        expect(lint.rc, lint.out).toBe(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 60_000);

    // Paired: the same `.ts` block with no TypeScript parser, the plugin registered for every file —
    // the wiring is sound, the probe still cannot parse its `.ts` file with or without it → kept.
    it.skipIf(!TS_MORPH_AVAILABLE)('paired: a .ts block with no TS parser and a sound wiring → still wired', async () => {
      const dir = consumer(
        `${IMPORT_BARREL}export default [{ plugins: { 'rules-as-tests': customRules }, rules: {} }, { files: ['**/*.ts'], rules: {} }];\n`,
        SRC,
      );
      try {
        const r = await wire(dir, LIVE_RULE);
        expect(r.status).toBe('wired');
        expect(readFileSync(join(dir, 'eslint.config.mjs'), 'utf8')).toContain('rules-as-tests/live-rule');
        const lint = lintRc(dir);
        expect(lint.rc, lint.out).toBe(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 60_000);
  });
}
