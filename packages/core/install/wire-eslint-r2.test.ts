/**
 * wire-eslint-r2 unit tests — Fixtures A–F + self-probe
 * (migration-ast Stage 4, GH #547 Layer 2)
 *
 * Fixture E (format-preserved) is the BLOCKING GATE: unchanged lines must be
 * byte-identical after wiring. If ts-morph is absent in this environment,
 * tests skip gracefully (mirror audit-ai-docs.ts:199 degrade pattern).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  R2_RULE_ID,
  customRulesImportSpecifier,
  formatLikeConsumer,
  generateDegradedSnippet,
  probeViaEslint,
  resolveAndWire,
  wireConfigSource,
  wireNRules,
  wireOwnConfig,
  wireR2IntoOwnConfig,
} from './wire-eslint-r2.ts';

const TS_MORPH_AVAILABLE = existsSync('./node_modules/ts-morph/package.json')
  || existsSync('node_modules/ts-morph/package.json');

/** `modified` is `original` plus insertions only: every character of the consumer's config is still there, in order. */
function onlyInserts(original: string, modified: string): boolean {
  let i = 0;
  for (const ch of modified) if (i < original.length && ch === original[i]) i++;
  return i === original.length;
}
/** RULE_GLOBS.boundary as check-rule-globs.sh extract_key reads it: from a `boundary: [` line, every single-quoted string until a `]`. */
function gateBoundary(src: string): string[] {
  const out: string[] = [];
  let grab = false;
  for (const line of src.split('\n')) {
    if (/^\s*boundary:\s*\[/.test(line)) grab = true;
    if (!grab) continue;
    for (const m of line.matchAll(/'([^']*)'/g)) out.push(m[1]);
    if (line.includes(']')) grab = false;
  }
  return out;
}

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

// The default probe against the real ESLint (2026-09-28): `eslint --print-config <file>` exits 0
// printing `undefined` for a file no config block matches, so a probe built on it read «ok» for a
// config ESLint never resolved R2 against. The wirer then kept the plugin-less bare element and the
// consumer's lint died with exit 2 («could not find plugin "rules-as-tests"»). The end state is what
// matters: once the wirer reports `wired`, ESLint must be able to lint the fixture's files. Runs once
// per ESLint this checkout has — the repo root's (9.x, what consumers get) and packages/core's (10.x):
// the symlinked-dir shape reproduces on 9.39.4 only.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ESLINT_INSTALLS = [join(REPO_ROOT, 'node_modules'), join(REPO_ROOT, 'packages', 'core', 'node_modules')]
  .filter((nm) => existsSync(join(nm, 'eslint', 'package.json')))
  .map((nm) => ({ nm, version: (JSON.parse(readFileSync(join(nm, 'eslint', 'package.json'), 'utf8')) as { version: string }).version }));
const R2_BARREL = `export default { rules: { 'no-unsafe-zod-parse': { create: () => ({}) } } };\n`;

it('the probe matrix below has an ESLint install to run against', () => {
  expect(ESLINT_INSTALLS.length, `no eslint under ${REPO_ROOT}/node_modules or packages/core/node_modules`).toBeGreaterThan(0);
});

for (const { nm, version } of ESLINT_INSTALLS) {
  describe(`resolveAndWire + probeViaEslint (ESLint ${version}) — wired means ESLint can lint`, () => {
    /** A consumer dir on a physical path whose node_modules is this ESLint install; barrel + two files. */
    function fixture(config: string): string {
      const dir = mkdtempSync(join(realpathSync(tmpdir()), 'r2-probe-'));
      symlinkSync(nm, join(dir, 'node_modules'));
      mkdirSync(join(dir, 'eslint-rules-local'));
      writeFileSync(join(dir, 'eslint-rules-local', 'index.mjs'), R2_BARREL, 'utf8');
      mkdirSync(join(dir, 'src'));
      writeFileSync(join(dir, 'src', 'h.js'), 'export const x = 1;\n', 'utf8');
      writeFileSync(join(dir, 'src', 'h.ts'), 'export const y = 1;\n', 'utf8');
      writeFileSync(join(dir, 'eslint.config.mjs'), config, 'utf8');
      return dir;
    }

    /** The consumer's own lint over the whole fixture (`eslint .`), run the way a consumer runs it. */
    function lintRc(dir: string): { rc: number; out: string } {
      try {
        execFileSync(process.execPath, [join(nm, 'eslint', 'bin', 'eslint.js'), '.'], { cwd: dir, stdio: 'pipe' });
        return { rc: 0, out: '' };
      } catch (e: unknown) {
        const err = e as { status?: number; stderr?: Buffer; stdout?: Buffer };
        return { rc: err.status ?? -1, out: `${String(err.stderr ?? '')}${String(err.stdout ?? '')}`.slice(0, 300) };
      }
    }

    // Shape 1: the config is reached through a symlinked dir (macOS /var → /private/var, a symlinked
    // checkout). The base matches `.ts`, so only the path form can hide the plugin-less element.
    it.skipIf(!TS_MORPH_AVAILABLE)('config reached through a symlinked dir → not wired plugin-less', async () => {
      const real = fixture(`const base = [{ files: ['**/*.ts'], rules: {} }];\nexport default [...base];\n`);
      const link = `${real}-link`;
      try {
        symlinkSync(real, link);
        const r = await resolveAndWire({ configPath: join(link, 'eslint.config.mjs'), cwd: link, runProbe: probeViaEslint });
        expect(r.status).toBe('wired');
        const lint = lintRc(real);
        expect(lint.rc, lint.out).not.toBe(2);
      } finally {
        if (existsSync(link)) unlinkSync(link);
        rmSync(real, { recursive: true, force: true });
      }
    }, 60_000);

    // Shape 2: no block matches a `.ts` file, so a `.ts` probe target has no config at all.
    it.skipIf(!TS_MORPH_AVAILABLE)('config whose blocks match only .js → not wired plugin-less', async () => {
      const dir = fixture(`export default [{ files: ['**/*.js'], rules: {} }];\n`);
      try {
        const r = await resolveAndWire({ configPath: join(dir, 'eslint.config.mjs'), cwd: dir, runProbe: probeViaEslint });
        expect(r.status).toBe('wired');
        const lint = lintRc(dir);
        expect(lint.rc, lint.out).not.toBe(2);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 60_000);

    // Shape 3: the base registers the plugin for `.ts` only, but the bare element is global — every
    // `.js`/`.mjs` file then resolves R2 without the plugin. A `.ts`-only probe read this as ok.
    it.skipIf(!TS_MORPH_AVAILABLE)('plugin registered for .ts only → not wired plugin-less', async () => {
      const dir = fixture(
        `import customRules from './eslint-rules-local/index.mjs';\n` +
          `export default [{ files: ['**/*.ts'], plugins: { 'rules-as-tests': customRules }, rules: {} }];\n`,
      );
      try {
        const r = await resolveAndWire({ configPath: join(dir, 'eslint.config.mjs'), cwd: dir, runProbe: probeViaEslint });
        expect(r.status).toBe('wired');
        const lint = lintRc(dir);
        expect(lint.rc, lint.out).not.toBe(2);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 60_000);

    // Shape 4: the plugin is registered for `.js` only; `eslint .` also lints `.mjs` (the config itself).
    it.skipIf(!TS_MORPH_AVAILABLE)('plugin registered for .js only → not wired plugin-less', async () => {
      const dir = fixture(
        `import customRules from './eslint-rules-local/index.mjs';\n` +
          `export default [{ files: ['**/*.js'], plugins: { 'rules-as-tests': customRules }, rules: {} }];\n`,
      );
      try {
        const r = await resolveAndWire({ configPath: join(dir, 'eslint.config.mjs'), cwd: dir, runProbe: probeViaEslint });
        expect(r.status).toBe('wired');
        const lint = lintRc(dir);
        expect(lint.rc, lint.out).not.toBe(2);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 60_000);

    // A `files:`-scoped element never applies to a probe file outside its scope.
    it.skipIf(!TS_MORPH_AVAILABLE)('scoped element → the probe resolves R2 inside the scope', async () => {
      const dir = fixture(`export default [];\n`);
      try {
        const r = await resolveAndWire({
          configPath: join(dir, 'eslint.config.mjs'), cwd: dir, runProbe: probeViaEslint, scope: { files: ['src/**'] },
        });
        expect(r.status).toBe('wired');
        const lint = lintRc(dir);
        expect(lint.rc, lint.out).not.toBe(2);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 60_000);

    // A scope with no single witness path (character class): ESLint applies R2 to no probe path, so
    // nothing is known — degrade and restore, never report a blind `wired`.
    it.skipIf(!TS_MORPH_AVAILABLE)('scope the probe cannot witness → degrade, config restored', async () => {
      const config = `export default [];\n`;
      const dir = fixture(config);
      try {
        const r = await resolveAndWire({
          configPath: join(dir, 'eslint.config.mjs'), cwd: dir, runProbe: probeViaEslint, scope: { files: ['src/[ab]/**'] },
        });
        expect(r.status).toBe('degrade');
        expect(readFileSync(join(dir, 'eslint.config.mjs'), 'utf8')).toBe(config);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 60_000);
  });
}

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

  // Critical-review S7-1: the shipped templates register the plugin only inside `files:`-scoped
  // blocks. In ESLint flat config a `plugins` entry applies only to files its own block matches, so
  // a bare appended block that lints OTHER files hits "could not find plugin 'rules-as-tests'" and
  // the whole lint run errors. Only an unscoped registration (no `files` / `ignores`) counts.
  const SCOPED_ONLY = [
    `import customRules from './eslint-rules-local/index.mjs';`,
    `export default [`,
    `  { files: ['src/**/*.ts'], plugins: { 'rules-as-tests': customRules }, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } },`,
    `];`,
    ``,
  ].join('\n');

  it.skipIf(!TS_MORPH_AVAILABLE)(
    '✅ S7-1: plugin registered only in a files:-scoped block → the new global block self-registers, import not duplicated',
    async () => {
      const r = await wireNRules(SCOPED_ONLY, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
      expect(r.status).toBe('wired');
      const added = r.modified.slice(r.modified.indexOf(`'rules-as-tests/no-unsafe-zod-parse'`));
      expect(added).toMatch(/\{\s*plugins: \{ 'rules-as-tests': customRules \}, rules: \{ ['"]rules-as-tests\/no-direct-time-randomness['"]/);
      expect((r.modified.match(/import customRules from/g) ?? []).length).toBe(1);
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    '✅ S7-1: a registration scoped by ignores: only is still scoped → self-registers',
    async () => {
      const src = SCOPED_ONLY.replace(`files: ['src/**/*.ts']`, `ignores: ['dist/**']`);
      const r = await wireNRules(src, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
      expect(r.modified).toMatch(/\{\s*plugins: \{ 'rules-as-tests': customRules \}, rules: \{ ['"]rules-as-tests\/no-direct-time-randomness['"]/);
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

// ─── Q4.7 (operator, 2026-09-28): getff writes its block into a config the CONSUMER owns ───
// Additive only: every line the consumer wrote stays, in order. What lands: a global-ignores element
// for the files getff delivered (so the consumer's own lint does not check getff's machinery — the
// c6 unused-directive case), and R2 scoped by a `RULE_GLOBS.boundary` block the shipped gates
// (check-rule-globs.sh / check-rule-enforced.sh) read exactly as they read getff's own template.
describe('wireOwnConfig — getff block in a consumer-owned config (Q4.7)', () => {
  const TSESLINT_CALL = [
    `import eslint from '@eslint/js';`,
    `import tseslint from 'typescript-eslint';`,
    ``,
    `export default tseslint.config(`,
    `  { ignores: ['dist/**'] },`,
    `  eslint.configs.recommended,`,
    `  tseslint.configs.recommended,`,
    `);`,
    ``,
  ].join('\n');
  const SHAPES: Record<string, string> = {
    'tseslint.config(obj, …)': TSESLINT_CALL,
    'array literal': `import js from '@eslint/js';\nexport default [js.configs.recommended, { rules: { 'no-console': 'warn' } }];\n`,
    'defineConfig([…])': `import js from '@eslint/js';\nimport { defineConfig } from 'eslint/config';\nexport default defineConfig([js.configs.recommended]);\n`,
    'identifier': `import js from '@eslint/js';\nconst config = [js.configs.recommended];\nexport default config;\n`,
  };
  const IGNORES = ['eslint-rules-local/**', 'packages/core/**'];
  const BOUNDARY = ['**/handlers/**/*.{ts,tsx}', '**/routes/**/*.{ts,tsx}'];
  const IMPORT_PATH = './eslint-rules-local/index.mjs';

  for (const [shape, src] of Object.entries(SHAPES)) {
    it.skipIf(!TS_MORPH_AVAILABLE)(`${shape}: ignores + R2 appended, only insertions`, async () => {
      const r = await wireOwnConfig(src, { ignores: IGNORES, boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH });
      expect(r.status).toBe('wired');
      expect(onlyInserts(src, r.modified)).toBe(true);
      expect(r.modified).toMatch(/\{\s*ignores: \['eslint-rules-local\/\*\*', 'packages\/core\/\*\*'\]\s*\}/);
      expect(r.modified).toMatch(/files: RULE_GLOBS\.boundary, plugins: \{ 'rules-as-tests': customRules \}, rules: \{ 'rules-as-tests\/no-unsafe-zod-parse': 'error' \}/);
      expect(r.modified).toMatch(/import customRules from ['"]\.\/eslint-rules-local\/index\.mjs['"]/);
      // RULE_GLOBS is declared before the export that reads it.
      expect(r.modified.indexOf('const RULE_GLOBS')).toBeGreaterThan(-1);
      expect(r.modified.indexOf('const RULE_GLOBS')).toBeLessThan(r.modified.indexOf('export default'));
      expect(gateBoundary(r.modified)).toEqual(BOUNDARY);
    });

    it.skipIf(!TS_MORPH_AVAILABLE)(`${shape}: a second run changes nothing`, async () => {
      const opts = { ignores: IGNORES, boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH };
      const once = await wireOwnConfig(src, opts);
      const twice = await wireOwnConfig(once.modified, opts);
      expect(twice.status).toBe('already-wired');
      expect(twice.modified).toBe(once.modified);
    });
  }

  it.skipIf(!TS_MORPH_AVAILABLE)('a multi-line list gets each block on its own line, in its trailing-comma style', async () => {
    const r = await wireOwnConfig(TSESLINT_CALL, { ignores: IGNORES, boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH });
    expect(r.modified).toContain([
      `  tseslint.configs.recommended,`,
      `  { ignores: ['eslint-rules-local/**', 'packages/core/**'] },`,
      `  { files: RULE_GLOBS.boundary, plugins: { 'rules-as-tests': customRules }, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } },`,
      `);`,
    ].join('\n'));
    const noComma = TSESLINT_CALL.replace('tseslint.configs.recommended,\n)', 'tseslint.configs.recommended\n)');
    const r2 = await wireOwnConfig(noComma, { ignores: IGNORES });
    expect(r2.modified).toContain(`  tseslint.configs.recommended,\n  { ignores: ['eslint-rules-local/**', 'packages/core/**'] }\n);`);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('ignores only: no RULE_GLOBS, no R2, no import when no boundary was found', async () => {
    const r = await wireOwnConfig(TSESLINT_CALL, { ignores: IGNORES, customRulesImportPath: IMPORT_PATH });
    expect(r.status).toBe('wired');
    expect(r.modified).toContain(`{ ignores: ['eslint-rules-local/**', 'packages/core/**'] }`);
    expect(r.modified).not.toContain('RULE_GLOBS');
    expect(r.modified).not.toContain(R2_RULE_ID);
    expect(r.modified).not.toContain('customRules');
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('an ignores glob the config already ignores globally is not added again', async () => {
    const src = TSESLINT_CALL.replace(`{ ignores: ['dist/**'] }`, `{ ignores: ['dist/**', 'packages/core/**'] }`);
    const r = await wireOwnConfig(src, { ignores: IGNORES });
    expect(r.status).toBe('wired');
    expect(r.modified).toContain(`{ ignores: ['eslint-rules-local/**'] }`);
    expect((r.modified.match(/'packages\/core\/\*\*'/g) ?? []).length).toBe(1);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('a boundary glob found on a later install joins the existing RULE_GLOBS.boundary; R2 is not added twice', async () => {
    const first = await wireOwnConfig(TSESLINT_CALL, { boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH });
    const r = await wireOwnConfig(first.modified, {
      boundaryGlobs: [...BOUNDARY, '**/api/**/*.{ts,tsx}'],
      customRulesImportPath: IMPORT_PATH,
    });
    expect(r.status).toBe('wired');
    expect(gateBoundary(r.modified)).toEqual([...BOUNDARY, '**/api/**/*.{ts,tsx}']);
    expect((r.modified.match(/rules-as-tests\/no-unsafe-zod-parse/g) ?? []).length).toBe(1);
    expect((r.modified.match(/import customRules from/g) ?? []).length).toBe(1);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('a consumer-authored `boundary: [` block is left alone; getff declares its own RULE_GLOBS', async () => {
    const src = `const OWN = {\n  boundary: [\n    'server/**/*.ts',\n  ],\n};\nexport default [{ files: OWN.boundary, rules: {} }];\n`;
    const r = await wireOwnConfig(src, { boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH });
    expect(r.status).toBe('wired');
    expect(onlyInserts(src, r.modified)).toBe(true);
    expect(r.modified).toContain('const RULE_GLOBS');
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('a consumer RULE_GLOBS with no boundary array → R2 not wired, said why, ignores still land', async () => {
    const src = `const RULE_GLOBS = { appCode: ['src/**'] };\nexport default [{ files: RULE_GLOBS.appCode, rules: {} }];\n`;
    const r = await wireOwnConfig(src, { ignores: IGNORES, boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH });
    expect(r.status).toBe('wired');
    expect(r.modified).not.toContain(R2_RULE_ID);
    expect(r.modified).toContain(`{ ignores: ['eslint-rules-local/**', 'packages/core/**'] }`);
    expect(r.notes?.join(' ')).toMatch(/RULE_GLOBS/);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('a global rules-as-tests registration → the R2 element does not register the plugin again', async () => {
    const src = [
      `import customRules from './eslint-rules-local/index.mjs';`,
      `export default [{ plugins: { 'rules-as-tests': customRules } }];`,
      ``,
    ].join('\n');
    const r = await wireOwnConfig(src, { boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH });
    expect(r.modified).toMatch(/\{ files: RULE_GLOBS\.boundary, rules: \{ 'rules-as-tests\/no-unsafe-zod-parse': 'error' \} \}/);
    expect((r.modified.match(/import customRules from/g) ?? []).length).toBe(1);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('no `export default` (a CommonJS config) → unrecognised, source untouched', async () => {
    const src = `module.exports = [{ rules: {} }];\n`;
    const r = await wireOwnConfig(src, { ignores: IGNORES, boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH });
    expect(r.status).toBe('unrecognised');
    expect(r.modified).toBe(src);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('the wired config passes the shipped check-rule-globs gate on a project with a routes/ file', async () => {
    const r = await wireOwnConfig(TSESLINT_CALL, { ignores: IGNORES, boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH });
    const dir = mkdtempSync(join(tmpdir(), 'own-cfg-gate-'));
    writeFileSync(join(dir, 'eslint.config.mjs'), r.modified, 'utf8');
    mkdirSync(join(dir, 'lib', 'routes'), { recursive: true });
    writeFileSync(join(dir, 'lib', 'routes', 'health.ts'), 'export const ok = true;\n', 'utf8');
    const gate = resolve(__dirname, '../audit-self/check-rule-globs.sh');
    const out = execFileSync('bash', [gate], { cwd: dir, env: { ...process.env, ESLINT_CONFIG: 'eslint.config.mjs' }, encoding: 'utf8' });
    expect(out).toMatch(/✓ R2 no-unsafe-zod-parse \(RULE_GLOBS\.boundary\): matches/);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('the customRules import follows the quotes the file already uses', async () => {
    const single = await wireOwnConfig(TSESLINT_CALL, { boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH });
    expect(single.modified).toContain(`import tseslint from 'typescript-eslint';\nimport customRules from './eslint-rules-local/index.mjs';\n`);
    const dq = TSESLINT_CALL.replaceAll(`'`, `"`);
    const double = await wireOwnConfig(dq, { boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH });
    expect(double.modified).toContain(`import tseslint from "typescript-eslint";\nimport customRules from "./eslint-rules-local/index.mjs";\n`);
    expect(onlyInserts(dq, double.modified)).toBe(true);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('RULE_GLOBS goes right above the export, after the imports\' blank line, never between the export and its comment', async () => {
    const r = await wireOwnConfig(TSESLINT_CALL, { boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH });
    expect(r.modified).toContain(`import customRules from './eslint-rules-local/index.mjs';\n\n// Added by getff:`);
    expect(r.modified).toMatch(/\n\};\n\nexport default tseslint\.config\(/);
    const commented = `import js from '@eslint/js';\n\n// our lint setup\nexport default [js.configs.recommended];\n`;
    const c = await wireOwnConfig(commented, { boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH });
    expect(onlyInserts(commented, c.modified)).toBe(true);
    expect(c.modified).toMatch(/\n\};\n\n\/\/ our lint setup\nexport default \[/);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('RULE_GLOBS carries `// prettier-ignore`, so a formatter cannot turn it into a form the gates do not read', async () => {
    const r = await wireOwnConfig(TSESLINT_CALL, { boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH });
    expect(r.modified).toMatch(/\/\/ prettier-ignore\nconst RULE_GLOBS = \{\n {2}boundary: \[\n/);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('wireNRules { insertOnly }: each new block on its own line, every consumer line kept, import in the file\'s quotes', async () => {
    const rules = { 'rules-as-tests/no-server-imports-in-client': 'error' };
    const opts = { customRulesImportPath: IMPORT_PATH, insertOnly: true, scopeFor: () => ({ files: ['**/*.{ts,tsx}'] }) };
    const r = await wireNRules(TSESLINT_CALL, rules, opts);
    expect(r.status).toBe('wired');
    expect(onlyInserts(TSESLINT_CALL, r.modified)).toBe(true);
    const lines = r.modified.split('\n');
    for (const line of TSESLINT_CALL.split('\n')) expect(lines).toContain(line);
    expect(r.modified).toContain(`  tseslint.configs.recommended,\n  { files: ["**/*.{ts,tsx}"], plugins: { 'rules-as-tests': customRules }, rules: { "rules-as-tests/no-server-imports-in-client": "error" } },\n);`);
    expect(r.modified).toContain(`import tseslint from 'typescript-eslint';\nimport customRules from './eslint-rules-local/index.mjs';\n`);
    expect((await wireNRules(r.modified, rules, opts)).status).toBe('already-wired');

    const ident = `import js from '@eslint/js';\nconst config = [js.configs.recommended];\nexport default config;\n`;
    const ri = await wireNRules(ident, rules, opts);
    expect(onlyInserts(ident, ri.modified)).toBe(true);
    expect(ri.modified).toContain('export default [...config, { files:');
  });

  // A call's arguments are the element list only for the variadic flat-config helpers, tseslint.config(…)
  // and defineConfig(…). A preset factory reads its one argument: blocks appended after it load and never
  // run, while the install says «wired» (cold-review F4).
  it.skipIf(!TS_MORPH_AVAILABLE)('a preset factory call → unrecognised, nothing appended to its arguments', async () => {
    for (const src of [
      `import createConfig from 'my-preset';\nexport default createConfig({ react: true });\n`,
      `import { makeConfig } from './make.mjs';\nexport default makeConfig();\n`,
      `import wrap from 'my-preset';\nexport default wrap([{ rules: {} }]);\n`,
    ]) {
      const own = await wireOwnConfig(src, { ignores: IGNORES, boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH });
      expect(own.status).toBe('unrecognised');
      expect(own.modified).toBe(src);
      const n = await wireNRules(src, { 'rules-as-tests/no-server-imports-in-client': 'error' }, { insertOnly: true });
      expect(n.status).toBe('unrecognised');
      expect(n.modified).toBe(src);
    }
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('defineConfig(obj, obj) and a namespace tseslint.config(…) still take the blocks as arguments', async () => {
    const define = `import { defineConfig } from 'eslint/config';\nexport default defineConfig({ rules: {} }, { ignores: ['dist/**'] });\n`;
    const d = await wireOwnConfig(define, { ignores: IGNORES });
    expect(d.status).toBe('wired');
    expect(d.modified).toContain(`{ ignores: ['dist/**'] }, { ignores: ['eslint-rules-local/**', 'packages/core/**'] });`);
    const ns = `import * as tseslint from 'typescript-eslint';\nexport default tseslint.config({ rules: {} });\n`;
    const n = await wireOwnConfig(ns, { ignores: IGNORES });
    expect(n.status).toBe('wired');
    expect(onlyInserts(ns, n.modified)).toBe(true);
  });

  // insertOnly never changes a value the consumer set. A rule the live research wants at another value
  // keeps the consumer's, and the result names it (cold-review F2: a deliberate 'off' became "error").
  it.skipIf(!TS_MORPH_AVAILABLE)('wireNRules { insertOnly }: a rule the consumer already sets keeps its value, named in notes', async () => {
    const src = `export default [{ rules: { 'rules-as-tests/foo': 'off' } }];\n`;
    const r = await wireNRules(src, { 'rules-as-tests/foo': 'error' }, { insertOnly: true, overrideKeys: new Set(['rules-as-tests/foo']) });
    expect(r.modified).toBe(src);
    expect(r.notes?.join(' ')).toMatch(/rules-as-tests\/foo/);
    // Without insertOnly (getff's own config) the live value still wins.
    const own = await wireNRules(src, { 'rules-as-tests/foo': 'error' }, { overrideKeys: new Set(['rules-as-tests/foo']) });
    expect(own.modified).toMatch(/'rules-as-tests\/foo': "error"/);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('wireNRules { insertOnly }: a selector joins an existing wrapper by insertion, every consumer character kept', async () => {
    const src = [
      `export default [`,
      `  {`,
      `    rules: {`,
      `      'rules-as-tests/restricted-syntax-audit-exempt': [`,
      `        'error',`,
      `        { selector: 'A', message: 'a' }, // ours`,
      `      ],`,
      `    },`,
      `  },`,
      `];`,
      ``,
    ].join('\n');
    const r = await wireNRules(src, { 'rules-as-tests/restricted-syntax-audit-exempt': ['error', { selector: 'B', message: 'b' }] }, { insertOnly: true });
    expect(r.status).toBe('wired');
    expect(onlyInserts(src, r.modified)).toBe(true);
    expect(r.modified).toMatch(/selector: ['"]B['"]/);
  });

  // A config that already sets R2 — a hand merge of the snippet the install printed before Q4.7 — but has
  // no RULE_GLOBS block. check-rule-globs.sh reads R2's globs from that block and full-alarms a config
  // that wires R2 without one, so leaving it «already enforced» failed every push while the install said
  // nothing (cold-review F11).
  const R2_BY_HAND = [
    `import customRules from './eslint-rules-local/index.mjs';`,
    ``,
    `export default [`,
    `  { plugins: { 'rules-as-tests': customRules }, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } },`,
    `];`,
    ``,
  ].join('\n');
  it.skipIf(!TS_MORPH_AVAILABLE)('R2 already set to error, no RULE_GLOBS block → RULE_GLOBS and the scoped R2 element are added (F11)', async () => {
    const r = await wireOwnConfig(R2_BY_HAND, { boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH });
    expect(r.status).toBe('wired');
    expect(onlyInserts(R2_BY_HAND, r.modified)).toBe(true);
    expect(gateBoundary(r.modified)).toEqual(BOUNDARY);
    expect(r.modified).toMatch(/\{ files: RULE_GLOBS\.boundary, rules: \{ 'rules-as-tests\/no-unsafe-zod-parse': 'error' \} \}/);
    expect(r.notes ?? []).toEqual([]);
    const again = await wireOwnConfig(r.modified, { boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH });
    expect(again.status).toBe('already-wired');
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('R2 set to another value, or where getff cannot read it, no RULE_GLOBS → nothing added for R2, the note names it (F11)', async () => {
    const warn = R2_BY_HAND.replace(`zod-parse': 'error'`, `zod-parse': 'warn'`);
    const hidden = `const base = [{ rules: { 'rules-as-tests/no-unsafe-zod-parse': 'off' } }];\nexport default [...base];\n`;
    // 'error', then 'off' further down: ESLint's last setting wins, and getff's element would outrank it.
    const twice = R2_BY_HAND.replace(`];`, `  { files: ['legacy/**'], rules: { 'rules-as-tests/no-unsafe-zod-parse': 'off' } },\n];`);
    for (const src of [warn, hidden, twice]) {
      const r = await wireOwnConfig(src, { boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH });
      expect(r.modified).toBe(src);
      expect(r.status).toBe('already-wired');
      const note = (r.notes ?? []).join('\n');
      expect(note).toMatch(/RULE_GLOBS/);
      expect(note).toMatch(/does not change a setting of yours/);
      // The hyphen form: the colon form «check:globs» is the CI-orphan WARN's (r2-glob-reach per-gate accuracy).
      expect(note).toMatch(/check-rule-globs\.sh/);
      expect(note).not.toMatch(/by hand|manually/i);
    }
  });
});

describe('formatLikeConsumer — getff\'s insertions in the consumer\'s own prettier style (Q4.7)', () => {
  // format:check (`prettier --check .`) covers a consumer-owned eslint.config.mjs: an unformatted
  // insertion into a file prettier accepted would turn every push red.
  const PRETTIER = (() => {
    try { return createRequire(join(__dirname, 'x.js')).resolve('prettier'); } catch { return undefined; }
  })();
  const SRC = [
    `import tseslint from 'typescript-eslint';`,
    ``,
    `export default tseslint.config(`,
    `  { ignores: ['dist/**'] },`,
    `  tseslint.configs.recommended,`,
    `);`,
    ``,
  ].join('\n');
  const BOUNDARY = ['**/handlers/**/*.{ts,tsx}', '**/routes/**/*.{ts,tsx}'];
  const OPTS = { ignores: ['eslint-rules-local/**', 'packages/core/**'], boundaryGlobs: BOUNDARY, customRulesImportPath: './eslint-rules-local/index.mjs' };
  const extractBoundary = (src: string): string[] => {
    const out: string[] = [];
    let grab = false;
    for (const line of src.split('\n')) {
      if (/^\s*boundary:\s*\[/.test(line)) grab = true;
      if (!grab) continue;
      for (const m of line.matchAll(/'([^']*)'/g)) out.push(m[1]);
      if (line.includes(']')) grab = false;
    }
    return out;
  };
  const inDir = async (prettierrc: string, fn: (cfg: string) => Promise<void>): Promise<void> => {
    const dir = mkdtempSync(join(__dirname, '.own-config-fmt-'));
    try {
      writeFileSync(join(dir, '.prettierrc.json'), prettierrc, 'utf8');
      await fn(join(dir, 'eslint.config.mjs'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const check = async (text: string, cfg: string): Promise<boolean> => {
    const prettier = (await import(PRETTIER!)) as { resolveConfig: (f: string) => Promise<object | null>; check: (t: string, o: object) => Promise<boolean> };
    return prettier.check(text, { ...(await prettier.resolveConfig(cfg)), filepath: cfg });
  };

  for (const [name, rc] of [['singleQuote', '{ "singleQuote": true }'], ['prettier defaults (double quotes)', '{}']] as const) {
    it.skipIf(!TS_MORPH_AVAILABLE || !PRETTIER)(`${name}: a config prettier accepts stays accepted, and the gates still read RULE_GLOBS.boundary`, async () => {
      await inDir(rc, async (cfg) => {
        const src = rc === '{}' ? SRC.replaceAll(`'`, `"`) : SRC;
        expect(await check(src, cfg)).toBe(true);
        const wired = await wireOwnConfig(src, OPTS);
        expect(await check(wired.modified, cfg)).toBe(false); // the raw insertion alone would fail format:check
        const out = await formatLikeConsumer(cfg, __dirname, src, wired.modified);
        expect(await check(out, cfg)).toBe(true);
        expect(onlyInserts(src, out)).toBe(true); // restyled around the insertions, never a consumer character changed
        expect(extractBoundary(out)).toEqual(BOUNDARY);
        expect(out).toContain('rules-as-tests/no-unsafe-zod-parse');
      });
    });
  }

  it.skipIf(!TS_MORPH_AVAILABLE || !PRETTIER)('a config prettier does NOT accept is left as the insertions made it (formatting it would rewrite the consumer\'s lines)', async () => {
    await inDir('{ "singleQuote": true }', async (cfg) => {
      const messy = SRC.replace(`  { ignores: ['dist/**'] },`, `  {ignores:['dist/**']},`);
      expect(await check(messy, cfg)).toBe(false);
      const wired = await wireOwnConfig(messy, OPTS);
      expect(await formatLikeConsumer(cfg, __dirname, messy, wired.modified)).toBe(wired.modified);
    });
  });
});

// ─── R2 in a per-package config the consumer owns (cold-review F1/F15) ──────────────────────────
// The install's R2 wirer used to add R2 to such a config through the AST writer, which re-prints the
// list it edits (the consumer's comments and trailing commas went) and adds R2 unscoped, to every file
// of the package. It now adds it as synth-and-wire adds getff's block: text insertions only, scoped to
// the HTTP boundary globs found under that config (RULE_GLOBS.boundary), lint-probed.
describe('wireR2IntoOwnConfig — R2 in a per-package config the consumer owns (cold-review F1/F15)', () => {
  const PKG = [
    `// The consumer's own lint config for this package.`,
    `const base = [{ files: ['**/*.ts'], rules: { 'no-console': 'error' } }];`,
    ``,
    `export default [`,
    `  ...base, // shared base`,
    `  // { rules: { 'no-debugger': 'off' } }, — kept for later`,
    `];`,
    ``,
  ].join('\n');
  const BOUNDARY = ['**/routes/**/*.{ts,tsx}', '**/handlers/**/*.{ts,tsx}'];
  const probeOk = async () => ({ verdict: 'ok' as const });
  // Outside the repo, so no parent .prettierrc restyles the result and the assertions read it as written.
  const inPkg = async (src: string, fn: (cfg: string, root: string) => Promise<void>): Promise<void> => {
    const root = mkdtempSync(join(tmpdir(), 'r2-own-'));
    try {
      mkdirSync(join(root, 'apps', 'api'), { recursive: true });
      const cfg = join(root, 'apps', 'api', 'eslint.config.mjs');
      writeFileSync(cfg, src, 'utf8');
      await fn(cfg, root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };

  it.skipIf(!TS_MORPH_AVAILABLE)('adds R2 by insertions only, scoped to RULE_GLOBS.boundary, importing the root rules', async () => {
    await inPkg(PKG, async (cfg, root) => {
      const out = await wireR2IntoOwnConfig({ configPath: cfg, cwd: root, boundaryGlobs: BOUNDARY, runProbe: probeOk });
      const after = readFileSync(cfg, 'utf8');
      expect(onlyInserts(PKG, after)).toBe(true);
      expect(after).toMatch(/\{ files: RULE_GLOBS\.boundary, plugins: \{ 'rules-as-tests': customRules \}, rules: \{ 'rules-as-tests\/no-unsafe-zod-parse': 'error' \} \}/);
      expect(after).toContain(`import customRules from '../../eslint-rules-local/index.mjs';`);
      expect(gateBoundary(after)).toEqual(BOUNDARY);
      expect(out.join('\n')).toMatch(/✓ R2 wired into /);
      expect(out.join('\n')).not.toMatch(/not wired/);
    });
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('a second run changes nothing', async () => {
    await inPkg(PKG, async (cfg, root) => {
      await wireR2IntoOwnConfig({ configPath: cfg, cwd: root, boundaryGlobs: BOUNDARY, runProbe: probeOk });
      const once = readFileSync(cfg, 'utf8');
      const out = await wireR2IntoOwnConfig({ configPath: cfg, cwd: root, boundaryGlobs: BOUNDARY, runProbe: probeOk });
      expect(readFileSync(cfg, 'utf8')).toBe(once);
      expect(out.join('\n')).toMatch(/R2 already enforced/);
    });
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('no boundary globs → nothing for R2 to guard: the file stays byte-identical', async () => {
    await inPkg(PKG, async (cfg, root) => {
      const out = await wireR2IntoOwnConfig({ configPath: cfg, cwd: root, boundaryGlobs: [], runProbe: probeOk });
      expect(readFileSync(cfg, 'utf8')).toBe(PKG);
      expect(out.join('\n')).not.toMatch(/not wired/);
    });
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('an export getff cannot add to → untouched, one not-wired line with the reason, no manual step', async () => {
    const src = `import { makeConfig } from './make.mjs';\nexport default makeConfig();\n`;
    await inPkg(src, async (cfg, root) => {
      const out = (await wireR2IntoOwnConfig({ configPath: cfg, cwd: root, boundaryGlobs: BOUNDARY, runProbe: probeOk })).join('\n');
      expect(readFileSync(cfg, 'utf8')).toBe(src);
      expect(out).toMatch(/^ {2}· not wired: R2 \(rules-as-tests\/no-unsafe-zod-parse\) in .*apps\/api\/eslint\.config\.mjs — /m);
      expect(out).not.toMatch(/manually|by hand|Add to /i);
    });
  });

  // A package config that already sets R2 with no RULE_GLOBS block (cold-review F11): «R2 already
  // enforced» left the rule unscoped for the gate that reads RULE_GLOBS.boundary.
  const HAND = [
    `import customRules from '../../eslint-rules-local/index.mjs';`,
    ``,
    `export default [`,
    `  { plugins: { 'rules-as-tests': customRules }, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } },`,
    `];`,
    ``,
  ].join('\n');

  it.skipIf(!TS_MORPH_AVAILABLE)('R2 already set to error, no RULE_GLOBS → RULE_GLOBS added by insertions, not «already enforced» (F11)', async () => {
    await inPkg(HAND, async (cfg, root) => {
      const out = (await wireR2IntoOwnConfig({ configPath: cfg, cwd: root, boundaryGlobs: BOUNDARY, runProbe: probeOk })).join('\n');
      const after = readFileSync(cfg, 'utf8');
      expect(onlyInserts(HAND, after)).toBe(true);
      expect(gateBoundary(after)).toEqual(BOUNDARY);
      expect(out).toMatch(/✓ R2 wired into /);
      expect(out).not.toMatch(/R2 already enforced|not wired/);
    });
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('R2 set to warn, no RULE_GLOBS → untouched, one not-wired line naming RULE_GLOBS (F11)', async () => {
    const warn = HAND.replace(`zod-parse': 'error'`, `zod-parse': 'warn'`);
    await inPkg(warn, async (cfg, root) => {
      const out = (await wireR2IntoOwnConfig({ configPath: cfg, cwd: root, boundaryGlobs: BOUNDARY, runProbe: probeOk })).join('\n');
      expect(readFileSync(cfg, 'utf8')).toBe(warn);
      expect(out).toMatch(/^ {2}· not wired: R2 \(rules-as-tests\/no-unsafe-zod-parse\) in .* — .*RULE_GLOBS/m);
      expect(out).not.toMatch(/R2 already enforced|manually|by hand/i);
    });
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('the lint probe proves the wiring broke ESLint → the original is restored, one not-wired line', async () => {
    await inPkg(PKG, async (cfg, root) => {
      let calls = 0;
      const probe = async () => (++calls === 1 ? { verdict: 'broken' as const, detail: 'exit 2' } : { verdict: 'ok' as const });
      const out = (await wireR2IntoOwnConfig({ configPath: cfg, cwd: root, boundaryGlobs: BOUNDARY, runProbe: probe })).join('\n');
      expect(readFileSync(cfg, 'utf8')).toBe(PKG);
      expect(out).toMatch(/^ {2}· not wired: R2 .* — .*rolled back/m);
    });
  });
});
