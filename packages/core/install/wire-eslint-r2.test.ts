/**
 * wire-eslint-r2 unit tests — Fixtures A–F + self-probe
 * (migration-ast Stage 4, GH #547 Layer 2)
 *
 * Fixture E (format-preserved) is the BLOCKING GATE: unchanged lines must be
 * byte-identical after wiring. If ts-morph is absent in this environment,
 * tests skip gracefully (mirror audit-ai-docs.ts:196 degrade pattern).
 */

import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  R2_RULE_ID,
  customRulesImportSpecifier,
  generateDegradedSnippet,
  resolveAndWire,
  wireConfigSource,
  wireNRules,
} from './wire-eslint-r2.ts';

const TS_MORPH_AVAILABLE = existsSync('./node_modules/ts-morph/package.json')
  || existsSync('node_modules/ts-morph/package.json');

// Helper: run wireConfigSource, return modified text or throw on unexpected status
async function wire(source: string): Promise<string> {
  const result = await wireConfigSource(source);
  if (result.status === 'degrade') {
    throw new Error(`ts-morph degrade (unavailable) — status=${result.status}`);
  }
  if (result.status === 'unrecognised') {
    throw new Error(`Unrecognised export shape — status=${result.status}`);
  }
  return result.modified;
}

describe('wire-eslint-r2', () => {
  it.skipIf(!TS_MORPH_AVAILABLE)(
    'Fixture A: simple base re-export → wrapped with spread',
    async () => {
      const source = [
        `import base from './eslint-base.mjs';`,
        `export default base;`,
        '',
      ].join('\n');
      const result = await wire(source);
      expect(result).toContain('[...base,');
      expect(result).toContain(R2_RULE_ID);
      // Import line preserved
      expect(result).toContain(`import base from './eslint-base.mjs';`);
    }
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'Fixture B: spread re-export → R2 element appended',
    async () => {
      const source = [
        `import base from './eslint-base.mjs';`,
        `import extra from './extra.mjs';`,
        `export default [...base, extra];`,
        '',
      ].join('\n');
      const result = await wire(source);
      expect(result).toContain(R2_RULE_ID);
      // Both imports preserved
      expect(result).toContain(`import base from './eslint-base.mjs';`);
      expect(result).toContain(`import extra from './extra.mjs';`);
    }
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'Fixture C: idempotency — R2 already present → byte-identical',
    async () => {
      const source = [
        `import base from './eslint-base.mjs';`,
        `export default [...base, { rules: { '${R2_RULE_ID}': 'error' } }];`,
        '',
      ].join('\n');
      const result = await wireConfigSource(source);
      expect(result.status).toBe('already-wired');
      expect(result.modified).toBe(source); // byte-identical
    }
  );

  it(
    'Fixture D: degrade path returns status=degrade when ts-morph absent (unit)',
    async () => {
      // This tests the degrade output function independent of ts-morph
      const snippet = generateDegradedSnippet('/pkg/eslint.config.mjs');
      expect(snippet).toContain(R2_RULE_ID);
      expect(snippet).toContain('not auto-wired');
      expect(snippet).toContain('/pkg/eslint.config.mjs');
      expect(snippet).toContain('--full');
    }
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'Fixture E (BLOCKING GATE): format-preserved — comments and imports are byte-identical after wire',
    async () => {
      // Config with comments, custom indentation, and a simple base re-export
      const source = [
        `// My custom ESLint config`,
        `// Project: my-api-server`,
        ``,
        `import base from '../eslint-base.mjs';`,
        `import customRules from './custom-rules.mjs';`,
        ``,
        `// Base config re-exported with custom rules`,
        `export default base;`,
        ``,
      ].join('\n');

      const result = await wire(source);

      const sourceLines = source.split('\n');
      const resultLines = result.split('\n');

      // ALL lines before the modified export default must be byte-identical
      const exportIdx = sourceLines.findIndex((l) => l.startsWith('export default'));
      for (let i = 0; i < exportIdx; i++) {
        expect(resultLines[i], `Line ${i} changed unexpectedly`).toBe(sourceLines[i]);
      }

      // The modified line must contain R2
      expect(result).toContain(R2_RULE_ID);

      // Comments are preserved
      expect(result).toContain('// My custom ESLint config');
      expect(result).toContain('// Project: my-api-server');
      expect(result).toContain('// Base config re-exported with custom rules');

      // Imports are preserved
      expect(result).toContain(`import base from '../eslint-base.mjs';`);
      expect(result).toContain(`import customRules from './custom-rules.mjs';`);
    }
  );

  it(
    'Fixture F: degrade message shape when engine absent (unit test of degrade fn)',
    () => {
      // Fixture F is primarily a bash-level test (install.sh with node present but
      // ts-morph absent → rc=0). Unit test here validates the degrade message format.
      const snippet = generateDegradedSnippet('./eslint.config.mjs');
      expect(snippet).toMatch(/not auto-wired/);
      expect(snippet).toMatch(/ts-morph not present/);
      expect(snippet).toContain(R2_RULE_ID);
      // Verify the snippet format is valid JS
      const lines = snippet.split('\n');
      const codeSnippetLine = lines.find((l) => l.includes('export default'));
      expect(codeSnippetLine).toBeTruthy();
      expect(codeSnippetLine).toContain('[...base,');
    }
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'Self-probe: wirer on array literal → appends R2 element',
    async () => {
      // Tests the array-literal shape (e.g. our own eslint.config.mjs style)
      const source = [
        `import tsEslint from 'typescript-eslint';`,
        `import eslint from '@eslint/js';`,
        `export default [eslint.configs.recommended, ...tsEslint.configs.recommended];`,
        '',
      ].join('\n');
      const result = await wire(source);
      expect(result).toContain(R2_RULE_ID);
      // Original elements preserved
      expect(result).toContain('eslint.configs.recommended');
    }
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'Unrecognised export shape → no modification',
    async () => {
      const source = `export default 42;\n`;
      const result = await wireConfigSource(source);
      expect(result.status).toBe('unrecognised');
      expect(result.modified).toBe(source); // no partial edit
    }
  );
});

describe('transform variants (#644)', () => {
  const base = `import base from './base.mjs';\nexport default [...base];\n`;

  it.skipIf(!TS_MORPH_AVAILABLE)('bare (default): rules-only element, no plugins, no import', async () => {
    const r = await wireConfigSource(base);
    expect(r.status).toBe('wired');
    expect(r.variant).toBe('bare');
    expect(r.modified).toContain(`'${R2_RULE_ID}': 'error'`);
    expect(r.modified).not.toContain('plugins:');
    expect(r.modified).not.toContain('customRules');
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('self-contained: plugins+rules element + injected customRules import', async () => {
    const r = await wireConfigSource(base, {
      variant: 'self-contained',
      customRulesImportPath: '../../eslint-rules-local/index.mjs',
    });
    expect(r.status).toBe('wired');
    expect(r.variant).toBe('self-contained');
    expect(r.modified).toContain(`plugins: { 'rules-as-tests': customRules }`);
    expect(r.modified).toContain(`'${R2_RULE_ID}': 'error'`);
    expect(r.modified).toMatch(/import customRules from ['"]\.\.\/\.\.\/eslint-rules-local\/index\.mjs['"]/);
  });
});

describe('customRulesImportSpecifier (#644)', () => {
  it('computes the relative path from a per-package config to <root>/eslint-rules-local', () => {
    expect(customRulesImportSpecifier('/repo/apps/api/eslint.config.mjs', '/repo')).toBe(
      '../../eslint-rules-local/index.mjs',
    );
  });
  it('prefixes ./ when the config is at the consumer root', () => {
    expect(customRulesImportSpecifier('/repo/eslint.config.mjs', '/repo')).toBe(
      './eslint-rules-local/index.mjs',
    );
  });
});

describe('resolveAndWire (#644)', () => {
  const body = `import base from './base.mjs';\nexport default [...base];\n`;
  function tmpConfig(src: string): { dir: string; p: string } {
    const dir = mkdtempSync(join(tmpdir(), 'r2wire-'));
    const p = join(dir, 'eslint.config.mjs');
    writeFileSync(p, src, 'utf8');
    return { dir, p };
  }

  it.skipIf(!TS_MORPH_AVAILABLE)('keeps bare when the probe says the config loads', async () => {
    const { p } = tmpConfig(body);
    const r = await resolveAndWire({ configPath: p, cwd: '/repo', runProbe: async () => 'ok' });
    expect(r.status).toBe('wired');
    expect(r.variant).toBe('bare');
    const out = readFileSync(p, 'utf8');
    expect(out).toContain(`'${R2_RULE_ID}': 'error'`);
    expect(out).not.toContain('plugins:');
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('escalates to self-contained on could-not-find-plugin', async () => {
    const { dir, p } = tmpConfig(body);
    let calls = 0;
    const runProbe = async (): Promise<'could-not-find-plugin' | 'ok'> =>
      ++calls === 1 ? 'could-not-find-plugin' : 'ok';
    const r = await resolveAndWire({ configPath: p, cwd: dir, runProbe });
    expect(r.status).toBe('wired');
    expect(r.variant).toBe('self-contained');
    const out = readFileSync(p, 'utf8');
    expect(out).toContain(`plugins: { 'rules-as-tests': customRules }`);
    expect(out).toContain('import customRules from');
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('degrades + restores original when probe is unavailable', async () => {
    const { p } = tmpConfig(body);
    const r = await resolveAndWire({ configPath: p, cwd: '/repo', runProbe: async () => 'unavailable' });
    expect(r.status).toBe('degrade');
    expect(readFileSync(p, 'utf8')).toBe(body);
  });

  it('already-wired config left byte-identical (no probe needed)', async () => {
    const wired = `import base from './base.mjs';\nexport default [...base, { rules: { '${R2_RULE_ID}': 'error' } }];\n`;
    const { p } = tmpConfig(wired);
    const r = await resolveAndWire({ configPath: p, cwd: '/repo', runProbe: async () => 'ok' });
    expect(r.status).toBe('already-wired');
    expect(readFileSync(p, 'utf8')).toBe(wired);
  });

  // §13.5 I-2 L2: scoped-R2-probe regression — when scope is passed, emitted block carries files:
  it.skipIf(!TS_MORPH_AVAILABLE)('scoped probe: resolveAndWire with scope emits files: glob', async () => {
    const { p } = tmpConfig(body);
    const r = await resolveAndWire({
      configPath: p,
      cwd: '/repo',
      runProbe: async () => 'ok',
      scope: { files: ['apps/api/**'] },
    });
    expect(r.status).toBe('wired');
    const out = readFileSync(p, 'utf8');
    expect(out).toContain(`files: ["apps/api/**"]`);
    expect(out).toContain(`'${R2_RULE_ID}': 'error'`);
  });
});

describe('manual snippets are self-contained (#644)', () => {
  it('degraded snippet registers the plugin (import + plugins), not a bare rule', () => {
    const s = generateDegradedSnippet('apps/api/eslint.config.mjs');
    expect(s).toContain('eslint-rules-local');
    expect(s).toContain(`plugins: { 'rules-as-tests': customRules }`);
    expect(s).toContain(R2_RULE_ID);
  });
});

// ─── §13.5 I-2 L2: per-workspace scoping primitive (SSOT #182) ───────────────
// Proves that the files: emission seam works across both rule emitters (R2 path
// via wireConfigSource, N-rule path via wireNRules). Scope source = install-time
// dir→stack detection map, NOT recipe appliesTo (T-MS-A countermeasure).
describe('scoped emission — §13.5 I-2 L2 primitive (SSOT #182)', () => {
  const base = `import base from './base.mjs';\nexport default [...base];\n`;

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'bare variant + scope emits { files: [glob], rules: {...} }',
    async () => {
      const r = await wireConfigSource(base, { scope: { files: ['apps/api/**'] } });
      expect(r.status).toBe('wired');
      expect(r.modified).toContain(`files: ["apps/api/**"]`);
      expect(r.modified).toContain(`'${R2_RULE_ID}': 'error'`);
      expect(r.modified).not.toContain('plugins:'); // bare — no plugin registration
    }
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'no scope → global element (backward-compatible default)',
    async () => {
      const r = await wireConfigSource(base);
      expect(r.status).toBe('wired');
      expect(r.modified).not.toContain('files:');
      expect(r.modified).toContain(`'${R2_RULE_ID}': 'error'`);
    }
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'self-contained variant + scope emits files: AND plugins:',
    async () => {
      const r = await wireConfigSource(base, {
        variant: 'self-contained',
        customRulesImportPath: '../../eslint-rules-local/index.mjs',
        scope: { files: ['apps/api/**'] },
      });
      expect(r.status).toBe('wired');
      expect(r.modified).toContain(`files: ["apps/api/**"]`);
      expect(r.modified).toContain(`plugins: { 'rules-as-tests': customRules }`);
      expect(r.modified).toContain(`'${R2_RULE_ID}': 'error'`);
    }
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'N-rule path: wireNRules with scope emits files: glob on simple rule',
    async () => {
      // Proves buildRuleConfigElement scope seam on the synth/N-rule path.
      // Uses a placeholder rule name — proves the primitive generally, independent of R2.
      const synthRules = { 'rules-as-tests/no-non-null-assertion': 'error' };
      const r = await wireNRules(base, synthRules, { scope: { files: ['apps/web/**'] } });
      expect(r.status).toBe('wired');
      expect(r.modified).toContain(`files: ["apps/web/**"]`);
      expect(r.modified).toMatch(/['"]rules-as-tests\/no-non-null-assertion['"]\s*:\s*['"]error['"]/);
    }
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'multi-file scope: two files in scope array emitted correctly',
    async () => {
      const r = await wireConfigSource(base, {
        scope: { files: ['apps/api/**', 'apps/api/*.ts'] },
      });
      expect(r.status).toBe('wired');
      expect(r.modified).toContain(`files: ["apps/api/**", "apps/api/*.ts"]`);
    }
  );

  // Security: a workspace dir containing a single quote must not break out of the string literal.
  // jsString() wraps in double quotes when the value contains ' — prevents code injection into
  // the generated eslint.config.mjs (finding 3e8b46e1ab2b).
  it.skipIf(!TS_MORPH_AVAILABLE)(
    "scope glob with single quote is safely escaped — no code injection",
    async () => {
      const r = await wireConfigSource(base, { scope: { files: ["apps/it's/**"] } });
      expect(r.status).toBe('wired');
      // jsString("apps/it's/**") → "apps/it's/**" (double-quoted; no double-quote in value)
      expect(r.modified).toContain(`files: ["apps/it's/**"]`);
      // Must NOT contain raw single-quote delimiter that would break the JS string literal
      expect(r.modified).not.toMatch(/files: \['apps\/it's/);
      expect(r.modified).toContain(`'${R2_RULE_ID}': 'error'`);
    }
  );
});

// ── #829: wireNRules self-registers the rules-as-tests plugin when the config lacks it ─────────
//
// Paired-negative contract:
//   ❌ tried: wire a net-new `rules-as-tests/*` rule into a config that does NOT register the
//      `rules-as-tests` plugin (react-native-preset shape), passing customRulesImportPath. BEFORE
//      the fix the N-rule path emitted the block bare (no `plugins`, no `import customRules`), so
//      ESLint errored "could not find plugin 'rules-as-tests'" and the rule never fired (#829).
//   ✅ expected: the new block self-registers — `plugins: { 'rules-as-tests': customRules }` plus an
//      injected `import customRules from '<path>'` — so the plugin resolves and the rule fires.
//   The anti-tautology half proves detection is real: a config that ALREADY registers the plugin
//      (react-next shape) stays bare (no second registration / no second import), so the two paths
//      produce DIFFERENT output. A no-op "always bare" or "always self-register" impl fails it.
describe('#829: wireNRules plugin self-registration', () => {
  // react-native-preset shape — spreads a base, registers NO rules-as-tests plugin.
  const UNREGISTERED = `import expo from 'eslint-config-expo/flat.js';\nexport default [...expo];\n`;
  // react-next shape — already registers the plugin inside a config object.
  const REGISTERED = [
    `import customRules from './eslint-rules-local/index.mjs';`,
    `export default [`,
    `  { plugins: { 'rules-as-tests': customRules }, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } },`,
    `];`,
    ``,
  ].join('\n');
  const NEW_RULE = { 'rules-as-tests/no-direct-time-randomness': 'error' };
  const IMPORT_PATH = '../../eslint-rules-local/index.mjs';

  it.skipIf(!TS_MORPH_AVAILABLE)(
    '✅ unregistered config + path → self-registers (plugins + injected import) so the plugin resolves',
    async () => {
      const r = await wireNRules(UNREGISTERED, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
      expect(r.status).toBe('wired');
      expect(r.modified).toContain(`plugins: { 'rules-as-tests': customRules }`);
      expect(r.modified).toMatch(/import customRules from ['"]\.\.\/\.\.\/eslint-rules-local\/index\.mjs['"]/);
      expect(r.modified).toMatch(/['"]rules-as-tests\/no-direct-time-randomness['"]\s*:\s*['"]error['"]/);
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    '✅ already-registered config → stays bare (no double registration, no second import)',
    async () => {
      const r = await wireNRules(REGISTERED, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
      expect(r.status).toBe('wired');
      expect(r.modified).toMatch(/['"]rules-as-tests\/no-direct-time-randomness['"]\s*:\s*['"]error['"]/);
      const importCount = (r.modified.match(/import customRules from/g) ?? []).length;
      expect(importCount).toBe(1);
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    '❌ anti-tautology: unregistered injects an import, registered does not → outputs differ',
    async () => {
      const unreg = await wireNRules(UNREGISTERED, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
      const reg = await wireNRules(REGISTERED, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
      const unregInjectsImport = /import customRules from ['"]\.\.\/\.\.\/eslint-rules-local/.test(unreg.modified);
      const regAddsSecondImport = (reg.modified.match(/import customRules from/g) ?? []).length > 1;
      expect(unregInjectsImport).toBe(true);
      expect(regAddsSecondImport).toBe(false);
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'absent customRulesImportPath → degrades to bare (no throw, backward-compatible)',
    async () => {
      const r = await wireNRules(UNREGISTERED, NEW_RULE, {});
      expect(r.status).toBe('wired');
      expect(r.modified).not.toContain('plugins:');
      expect(r.modified).not.toContain('customRules');
      expect(r.modified).toMatch(/['"]rules-as-tests\/no-direct-time-randomness['"]\s*:\s*['"]error['"]/);
    },
  );
});
