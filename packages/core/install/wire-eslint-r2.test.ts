/**
 * wire-eslint-r2 unit tests — Fixtures A–F + self-probe
 * (migration-ast Stage 4, GH #547 Layer 2)
 *
 * Fixture E (format-preserved) is the BLOCKING GATE: unchanged lines must be
 * byte-identical after wiring. If ts-morph is absent in this environment,
 * tests skip gracefully (mirror audit-ai-docs.ts:219 degrade pattern).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, posix, resolve, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';
import {
  R2_RULE_ID,
  customRulesImportSpecifier,
  formatLikeConsumer,
  importSpecifierFrom,
  generateDegradedSnippet,
  probeViaEslint,
  r2NotWiredLine,
  resolveAndWire,
  wireConfigSource,
  wireNRules,
  wireOwnConfig,
  wireR2IntoOwnConfig,
} from './wire-eslint-r2.ts';

// Resolved exactly the way wireConfigSource / wireNRules load ts-morph (wire-eslint-r2.ts):
// node resolution anchored at the cwd, walking up. The `<cwd>/node_modules/ts-morph` probe this
// replaces missed the workspace-hoisted copy in the repo-root node_modules, so every run from
// packages/core (`npm --prefix packages/core run test:units`, the CI step) skipped the ts-morph
// cases green while the wirer itself found ts-morph (CI run 36471375667, 2026-09-28: 70/81 of
// wire-eslint-r2.test.ts and 18/39 of wire-synth-rules.test.ts skipped). Kept in sync with the
// twin in wire-synth-rules.test.ts.
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

/** `modified` is `original` plus insertions only: every character of the consumer's config is still there, in order. */
function onlyInserts(original: string, modified: string): boolean {
  let i = 0;
  for (const ch of modified) if (i < original.length && ch === original[i]) i++;
  return i === original.length;
}
/**
 * RULE_GLOBS.boundary as the push gates read it: check-rule-globs.sh's own extract_key, run on the text.
 * A TypeScript copy of that reader drifted from the gate once (second cold review, after #1868).
 */
const GATE_SH = join(dirname(fileURLToPath(import.meta.url)), '..', 'audit-self', 'check-rule-globs.sh');
function gateBoundary(src: string): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'gate-boundary-'));
  try {
    const cfg = join(dir, 'eslint.config.mjs');
    writeFileSync(cfg, src);
    const out = execFileSync(
      'bash',
      ['-c', 'eval "$(sed -n \'/^# >>> rule-globs reader/,/^# <<< rule-globs reader/p\' "$1")"; extract_key boundary "$2"', '_', GATE_SH, cfg],
      { encoding: 'utf8' },
    );
    return out.split('\n').filter((l) => l !== '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
  itRequiresTsMorph();

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
  it('stays inside the project when --path runs through a symlink and the cwd is the physical directory', () => {
    // process.cwd() is physical while the install passes --path through the project path as given
    // (macOS /var → /private/var): ESLint loads the config from its physical directory, so a ../ walk
    // out through the symlink resolves to a path that does not exist and the wiring is rolled back.
    const real = mkdtempSync(join(realpathSync(tmpdir()), 'r2-spec-real-'));
    const link = `${real}-link`;
    try {
      mkdirSync(join(real, 'apps/api'), { recursive: true });
      symlinkSync(real, link);
      expect(customRulesImportSpecifier(join(link, 'apps/api/eslint.config.mjs'), real)).toBe(
        '../../eslint-rules-local/index.mjs',
      );
    } finally {
      if (existsSync(link)) unlinkSync(link);
      rmSync(real, { recursive: true, force: true });
    }
  });
});

// install.sh hands the wirer an absolute --path under its logical `pwd`, while node's process.cwd() is
// the physical directory: macOS /var → /private/var, a symlinked Linux workspace, a Windows junction or
// 8.3 short name (C:\Users\RUNNER~1). Two spellings of one directory made `relative` walk out of the
// project and back in under the other spelling, and the wired config failed to load (ESLint exit 2).
describe('customRulesImportSpecifier — one project, two spellings of its path', () => {
  /** A physical project with the barrel and apps/api, plus a link to it (a junction on Windows). */
  const withLinkedProject = (fn: (real: string, link: string) => void): void => {
    const real = realpathSync.native(mkdtempSync(join(tmpdir(), 'r2-spec-')));
    const link = `${real}-link`;
    try {
      mkdirSync(join(real, 'eslint-rules-local'));
      writeFileSync(join(real, 'eslint-rules-local', 'index.mjs'), 'export default {};\n', 'utf8');
      mkdirSync(join(real, 'apps', 'api'), { recursive: true });
      symlinkSync(real, link, 'junction');
      fn(real, link);
    } finally {
      if (existsSync(link)) unlinkSync(link);
      rmSync(real, { recursive: true, force: true });
    }
  };
  /** The specifier reaches the barrel from the config's dir, under either spelling, in `/` form. */
  const expectReachesBarrel = (spec: string, configDirs: string[]): void => {
    expect(spec, 'an import specifier is a URL path: `/`, never `\\`').not.toContain('\\');
    expect(spec.startsWith('./') || spec.startsWith('../'), spec).toBe(true);
    for (const d of configDirs) expect(existsSync(resolve(d, spec)), `${spec} from ${d}`).toBe(true);
  };

  it('config under the link, cwd physical (what install.sh + node produce)', () => {
    withLinkedProject((real, link) => {
      const spec = customRulesImportSpecifier(join(link, 'apps', 'api', 'eslint.config.mjs'), real);
      expectReachesBarrel(spec, [join(link, 'apps', 'api'), join(real, 'apps', 'api')]);
      expect(spec).toBe('../../eslint-rules-local/index.mjs');
    });
  });

  it('config physical, cwd under the link (the reverse)', () => {
    withLinkedProject((real, link) => {
      const spec = customRulesImportSpecifier(join(real, 'apps', 'api', 'eslint.config.mjs'), link);
      expectReachesBarrel(spec, [join(link, 'apps', 'api'), join(real, 'apps', 'api')]);
      expect(spec).toBe('../../eslint-rules-local/index.mjs');
    });
  });

  it('the temp dir as the OS spells it vs its canonical form (macOS /var, Windows 8.3 short names)', () => {
    const spelled = mkdtempSync(join(tmpdir(), 'r2-spell-'));
    const canonical = realpathSync.native(spelled);
    // Measurement, printed so each platform's CI log shows which spellings it has.
    console.log(`[r2-spec] tmpdir=${spelled} realpathSync=${realpathSync(spelled)} realpathSync.native=${canonical}`);
    try {
      // macOS always has two spellings here; without them this case would pass on the old code too.
      if (process.platform === 'darwin') expect(spelled).not.toBe(canonical);
      mkdirSync(join(canonical, 'eslint-rules-local'));
      writeFileSync(join(canonical, 'eslint-rules-local', 'index.mjs'), 'export default {};\n', 'utf8');
      mkdirSync(join(canonical, 'apps', 'api'), { recursive: true });
      const spec = customRulesImportSpecifier(join(spelled, 'apps', 'api', 'eslint.config.mjs'), canonical);
      expectReachesBarrel(spec, [join(spelled, 'apps', 'api'), join(canonical, 'apps', 'api')]);
      expect(spec).toBe('../../eslint-rules-local/index.mjs');
    } finally {
      rmSync(canonical, { recursive: true, force: true });
    }
  });

  it('a config dir that does not exist yet keeps the spelling of its existing ancestor', () => {
    withLinkedProject((real, link) => {
      const spec = customRulesImportSpecifier(join(link, 'apps', 'new', 'eslint.config.mjs'), real);
      expect(spec).toBe('../../eslint-rules-local/index.mjs');
    });
  });
});

describe('importSpecifierFrom — a URL path, whatever the platform', () => {
  it('Windows, same drive: `/`-joined, never `\\`', () => {
    expect(importSpecifierFrom('C:\\proj\\apps\\api', 'C:\\proj\\eslint-rules-local\\index.mjs', win32)).toBe(
      '../../eslint-rules-local/index.mjs',
    );
  });
  it('Windows, another drive (no relative path exists): the file URL', () => {
    expect(importSpecifierFrom('C:\\proj\\apps\\api', 'D:\\proj\\eslint-rules-local\\index.mjs', win32)).toBe(
      'file:///D:/proj/eslint-rules-local/index.mjs',
    );
  });
  it('POSIX, a barrel next to the config: ./-prefixed', () => {
    expect(importSpecifierFrom('/proj', '/proj/eslint-rules-local/index.mjs', posix)).toBe('./eslint-rules-local/index.mjs');
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

    // The install's own-config call: --path under the logical root (install.sh `pwd`), cwd the physical
    // one (node's process.cwd()). The wired workspace's own `eslint .` must load the customRules import.
    it.skipIf(!TS_MORPH_AVAILABLE)('own config wired through a linked project root → the workspace still lints (rc 0)', async () => {
      const real = realpathSync.native(mkdtempSync(join(tmpdir(), 'r2-own-link-')));
      // One level deeper than the project, like /var vs /private/var: a sibling link would let the
      // mixed-spelling ../ walk land back on the real dir by accident.
      const linkParent = `${real}-links`;
      const link = join(linkParent, 'p');
      try {
        mkdirSync(linkParent);
        symlinkSync(nm, join(real, 'node_modules'), 'junction');
        mkdirSync(join(real, 'eslint-rules-local'));
        writeFileSync(join(real, 'eslint-rules-local', 'index.mjs'), R2_BARREL, 'utf8');
        mkdirSync(join(real, 'apps', 'api', 'src', 'routes'), { recursive: true });
        writeFileSync(join(real, 'apps', 'api', 'src', 'routes', 'order.js'), 'export const o = 1;\n', 'utf8');
        writeFileSync(join(real, 'apps', 'api', 'eslint.config.mjs'), `export default [{ files: ['**/*.js'], rules: {} }];\n`, 'utf8');
        symlinkSync(real, link, 'junction');
        const out = (await wireR2IntoOwnConfig({
          configPath: join(link, 'apps', 'api', 'eslint.config.mjs'),
          cwd: real,
          boundaryGlobs: ['**/routes/**/*.js'],
        })).join('\n');
        expect(out).toMatch(/✓ R2 wired into /);
        const lint = lintRc(join(real, 'apps', 'api'));
        expect(lint.rc, lint.out).toBe(0);
        expect(readFileSync(join(real, 'apps', 'api', 'eslint.config.mjs'), 'utf8')).toContain(`from '../../eslint-rules-local/index.mjs'`);
      } finally {
        if (existsSync(link)) unlinkSync(link);
        rmSync(linkParent, { recursive: true, force: true });
        if (existsSync(join(real, 'node_modules'))) unlinkSync(join(real, 'node_modules'));
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

// A `--print-config` that never answers (a config whose import blocks on the network, a hung loader)
// held the install forever: the probe had no time limit. It gives up after `timeoutMs`, and the wirer
// degrades — the config is left as it was. The stand-in ESLint sleeps 5 s and then prints nothing, so
// without the limit the probe returns `unconfirmed` after 5 s instead of `timed-out` in well under it.
describe('probeViaEslint — an ESLint that does not answer', () => {
  function hangingEslint(): string {
    const dir = mkdtempSync(join(realpathSync(tmpdir()), 'r2-probe-hang-'));
    mkdirSync(join(dir, 'node_modules', 'eslint', 'bin'), { recursive: true });
    writeFileSync(join(dir, 'node_modules', 'eslint', 'package.json'), '{"name":"eslint","version":"0.0.0"}\n', 'utf8');
    writeFileSync(join(dir, 'node_modules', 'eslint', 'bin', 'eslint.js'), 'setTimeout(() => {}, 5000);\n', 'utf8');
    writeFileSync(join(dir, 'eslint.config.mjs'), 'export default [];\n', 'utf8');
    return dir;
  }

  it('gives up after timeoutMs with a timed-out verdict', async () => {
    const dir = hangingEslint();
    try {
      const started = Date.now();
      const v = await probeViaEslint(join(dir, 'eslint.config.mjs'), dir, undefined, { timeoutMs: 300 });
      expect(v).toBe('timed-out');
      expect(Date.now() - started).toBeLessThan(3000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);

  // The stand-in dies of SIGKILL — the same signal the probe's own timeout sends — so only execFile's
  // `killed` flag can tell the two apart (the OOM killer's shape). Not SIGSEGV: that signal dumps core,
  // and a host whose core_pattern pipes to a handler (WSL's `/wsl-capture-crash`, ~1.4 s per crash,
  // serialized) turns the 8 parallel probe children into a real timeout.
  it('reads an ESLint that dies of its own signal as an error, not as a timeout', async () => {
    const dir = hangingEslint();
    writeFileSync(join(dir, 'node_modules', 'eslint', 'bin', 'eslint.js'), "process.kill(process.pid, 'SIGKILL');\n", 'utf8');
    try {
      const v = await probeViaEslint(join(dir, 'eslint.config.mjs'), dir, undefined, { timeoutMs: 10_000 });
      expect(v).not.toBe('timed-out');
      expect(v).toBe('other-error');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);

  it.skipIf(!TS_MORPH_AVAILABLE)('resolveAndWire degrades and leaves the config as it was', async () => {
    const dir = hangingEslint();
    try {
      const r = await resolveAndWire({
        configPath: join(dir, 'eslint.config.mjs'),
        cwd: dir,
        runProbe: (p, c, s) => probeViaEslint(p, c, s, { timeoutMs: 300 }),
      });
      expect(r.status).toBe('degrade');
      expect(r.degradeReason).toBe('probe verdict: timed-out');
      expect(readFileSync(join(dir, 'eslint.config.mjs'), 'utf8')).toBe('export default [];\n');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);
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

  // A spread carries its keys into the element: `{ ...onlyJs, plugins: … }` with
  // `const onlyJs = { files: ['**/*.js'] }` is scoped to .js even though the literal shows no
  // `files` key. Read as global, the appended block went bare and `eslint .` exited 2 on every
  // .mjs/.ts file (measured 2026-09-28, ESLint 9.39.4). Only a spread whose object literal is
  // resolvable in the same file and carries no scope key counts as global.
  const registeredVia = (decl: string, spread: string): string =>
    [
      `import customRules from './eslint-rules-local/index.mjs';`,
      decl,
      `export default [{ ${spread}, plugins: { 'rules-as-tests': customRules }, rules: {} }];`,
      ``,
    ].join('\n');
  const SELF_REGISTERED = /\{\s*plugins: \{ 'rules-as-tests': customRules \}, rules: \{ ['"]rules-as-tests\/no-direct-time-randomness['"]/;
  const BARE = /\{\s*rules: \{ ['"]rules-as-tests\/no-direct-time-randomness['"]/;

  it.skipIf(!TS_MORPH_AVAILABLE)('✅ a registration scoped by a spread carrying files: → self-registers', async () => {
    const src = registeredVia(`const onlyJs = { files: ['**/*.js'] };`, '...onlyJs');
    const r = await wireNRules(src, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
    expect(r.status).toBe('wired');
    expect(r.modified).toMatch(SELF_REGISTERED);
    expect((r.modified.match(/import customRules from/g) ?? []).length).toBe(1);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('✅ a registration scoped by a spread carrying ignores: → self-registers', async () => {
    const src = registeredVia(`const skipDist = { ignores: ['dist/**'] };`, '...skipDist');
    const r = await wireNRules(src, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
    expect(r.modified).toMatch(SELF_REGISTERED);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('✅ a registration scoped by a spread carrying basePath: → self-registers', async () => {
    const src = registeredVia(`const web = { basePath: 'apps/web' };`, '...web');
    const r = await wireNRules(src, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
    expect(r.modified).toMatch(SELF_REGISTERED);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('✅ a registration with a spread of an identifier this file does not define → self-registers', async () => {
    const src = registeredVia(`import shared from './shared.mjs';`, '...shared');
    const r = await wireNRules(src, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
    expect(r.modified).toMatch(SELF_REGISTERED);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('✅ a spread that carries files: through a nested spread → self-registers', async () => {
    const src = registeredVia(`const inner = { files: ['**/*.js'] };\nconst outer = { ...inner };`, '...outer');
    const r = await wireNRules(src, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
    expect(r.modified).toMatch(SELF_REGISTERED);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('✅ a registering element that sets basePath: itself → self-registers', async () => {
    const src = SCOPED_ONLY.replace(`files: ['src/**/*.ts']`, `basePath: 'apps/web'`);
    const r = await wireNRules(src, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
    expect(r.modified).toMatch(SELF_REGISTERED);
  });

  // A const the file changes after binding it: its literal no longer tells what the spread carries.
  it.skipIf(!TS_MORPH_AVAILABLE)('✅ a spread of a const that gains files: by a property write → self-registers', async () => {
    const src = registeredVia(`const onlyJs = {};\nonlyJs.files = ['**/*.js'];`, '...onlyJs');
    const r = await wireNRules(src, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
    expect(r.modified).toMatch(SELF_REGISTERED);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('✅ a spread of a const that gains files: by Object.assign → self-registers', async () => {
    const src = registeredVia(`const onlyJs = {};\nObject.assign(onlyJs, { files: ['**/*.js'] });`, '...onlyJs');
    const r = await wireNRules(src, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
    expect(r.modified).toMatch(SELF_REGISTERED);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('✅ a spread of a let reassigned to a scoped literal → self-registers', async () => {
    const src = registeredVia(`let onlyJs = {};\nonlyJs = { files: ['**/*.js'] };`, '...onlyJs');
    const r = await wireNRules(src, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
    expect(r.modified).toMatch(SELF_REGISTERED);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('✅ a registering element with a computed files key → self-registers', async () => {
    const src = SCOPED_ONLY.replace(`files: ['src/**/*.ts']`, `['files']: ['src/**/*.ts']`);
    const r = await wireNRules(src, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
    expect(r.modified).toMatch(SELF_REGISTERED);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('✅ a registering element whose files key is spelled with an escape → self-registers', async () => {
    const src = SCOPED_ONLY.replace(`files: ['src/**/*.ts']`, `'fil\\x65s': ['src/**/*.ts']`);
    const r = await wireNRules(src, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
    expect(r.modified).toMatch(SELF_REGISTERED);
  });

  // A spread after `plugins` replaces the whole `plugins` object when the spread carries one.
  it.skipIf(!TS_MORPH_AVAILABLE)('✅ a spread after plugins: that may replace them → self-registers', async () => {
    const src = [
      `import customRules from './eslint-rules-local/index.mjs';`,
      `const base = { plugins: {} };`,
      `export default [{ plugins: { 'rules-as-tests': customRules }, ...base, rules: {} }];`,
      ``,
    ].join('\n');
    const r = await wireNRules(src, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
    expect(r.modified).toMatch(SELF_REGISTERED);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('✅ a second plugins: key that drops the registration → self-registers', async () => {
    const src = SCOPED_ONLY.replace(`files: ['src/**/*.ts'], `, '').replace(`rules: {`, `plugins: {}, rules: {`);
    const r = await wireNRules(src, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
    expect(r.modified).toMatch(SELF_REGISTERED);
  });

  // A getter runs during the spread and can add `files` to the object it belongs to.
  it.skipIf(!TS_MORPH_AVAILABLE)('✅ a spread of a literal with an accessor → self-registers', async () => {
    const src = registeredVia(`const b = { get x() { return 1; } };`, '...b');
    const r = await wireNRules(src, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
    expect(r.modified).toMatch(SELF_REGISTERED);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('❌ an inline spread literal and a nested spread with no scope key → still global, block stays bare', async () => {
    for (const src of [
      registeredVia('', `...{ name: 'shared' }`),
      registeredVia(`const inner = { name: 'shared' };\nconst outer = { ...inner };`, '...outer'),
    ]) {
      const r = await wireNRules(src, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
      expect(r.status).toBe('wired');
      expect(r.modified).toMatch(BARE);
    }
  });

  // Anti-tautology: «every spread self-registers» would pass the cases above. A spread whose
  // literal is right here and carries no scope key keeps the registration global → bare block.
  it.skipIf(!TS_MORPH_AVAILABLE)('❌ a spread of a same-file literal with no scope key → still global, block stays bare', async () => {
    const src = registeredVia(`const shared = { linterOptions: { reportUnusedDisableDirectives: 'error' } };`, '...shared');
    const r = await wireNRules(src, NEW_RULE, { customRulesImportPath: IMPORT_PATH });
    expect(r.status).toBe('wired');
    expect(r.modified).toMatch(BARE);
    expect(r.modified).not.toMatch(SELF_REGISTERED);
  });

  // The own-config path (Q4.7) asks the same question before its R2 block.
  it.skipIf(!TS_MORPH_AVAILABLE)('✅ wireOwnConfig: a registration scoped by a spread → the R2 block registers the plugin', async () => {
    const src = registeredVia(`const onlyJs = { files: ['**/*.js'] };`, '...onlyJs');
    const r = await wireOwnConfig(src, { boundaryGlobs: ['src/routes/**/*.ts'], customRulesImportPath: IMPORT_PATH });
    expect(r.status).toBe('wired');
    expect(r.modified).toContain(`{ files: RULE_GLOBS.boundary, plugins: { 'rules-as-tests': customRules }, rules: { '${R2_RULE_ID}': 'error' } }`);
  });

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
    // A package config: the gate reads no RULE_GLOBS of it, so the note makes no claim about the gate.
    expect(r.notes?.join(' ')).not.toMatch(/check-rule-globs/);
    // The root config: the gate wants RULE_GLOBS.boundary there and fails without it — the note says so.
    const root = await wireOwnConfig(src, { ignores: IGNORES, boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH, gateReadsRuleGlobs: true });
    expect(root.notes?.join(' ')).toMatch(/scripts\/check-rule-globs\.sh fails on this config/);
    for (const n of root.notes ?? []) expect(n.length).toBeLessThanOrEqual(300);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('a consumer RULE_GLOBS with a quoted boundary key or a wrapped object is read as the gate reads it', async () => {
    // The gate reads `"boundary": [` and `({ boundary: [ … ] })`; a wirer that did not would say the
    // config has no boundary array — and that the gate fails on it — while the gate passes (third cold review).
    const OLD = '**/old/**/*.{ts,tsx}';
    for (const src of [
      `const RULE_GLOBS = { "boundary": ['${OLD}'] };\nexport default [{ files: RULE_GLOBS.boundary, rules: {} }];\n`,
      `const RULE_GLOBS = /** @type {const} */ ({ boundary: ['${OLD}'] });\nexport default [{ files: RULE_GLOBS.boundary, rules: {} }];\n`,
      // A computed literal key and an Object.freeze wrapper: both sides read them (#1889 review F2/F7).
      `const RULE_GLOBS = { ["boundary"]: ['${OLD}'] };\nexport default [{ files: RULE_GLOBS.boundary, rules: {} }];\n`,
      `const RULE_GLOBS = Object.freeze({ boundary: ['${OLD}'] });\nexport default [{ files: RULE_GLOBS.boundary, rules: {} }];\n`,
    ]) {
      expect(gateBoundary(src)).toEqual([OLD]);
      const r = await wireOwnConfig(src, { boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH, gateReadsRuleGlobs: true });
      expect(r.notes?.join(' ') ?? '').not.toMatch(/no boundary array/);
      expect(r.status).toBe('wired');
      expect(onlyInserts(src, r.modified)).toBe(true);
      expect(gateBoundary(r.modified)).toEqual([OLD, ...BOUNDARY]);
      expect((r.modified.match(/const RULE_GLOBS/g) ?? []).length).toBe(1);
    }
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
  // The root config: the gate reads its RULE_GLOBS (gateReadsRuleGlobs).
  const ROOT = { boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH, gateReadsRuleGlobs: true };
  it.skipIf(!TS_MORPH_AVAILABLE)('R2 already set to error, no RULE_GLOBS block → RULE_GLOBS and the scoped R2 element are added (F11)', async () => {
    const r = await wireOwnConfig(R2_BY_HAND, ROOT);
    expect(r.status).toBe('wired');
    expect(onlyInserts(R2_BY_HAND, r.modified)).toBe(true);
    expect(gateBoundary(r.modified)).toEqual(BOUNDARY);
    expect(r.modified).toMatch(/\{ files: RULE_GLOBS\.boundary, rules: \{ 'rules-as-tests\/no-unsafe-zod-parse': 'error' \} \}/);
    expect(r.notes ?? []).toEqual([]);
    const again = await wireOwnConfig(r.modified, ROOT);
    expect(again.status).toBe('already-wired');
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('R2 set to another value, or where getff cannot read it, no RULE_GLOBS → RULE_GLOBS alone is added, the consumer\'s R2 untouched (F11)', async () => {
    const warn = R2_BY_HAND.replace(`zod-parse': 'error'`, `zod-parse': 'warn'`);
    const hidden = `const base = [{ rules: { 'rules-as-tests/no-unsafe-zod-parse': 'off' } }];\nexport default [...base];\n`;
    // 'error', then 'off' further down: ESLint's last setting wins, and getff's element would outrank it.
    const twice = R2_BY_HAND.replace(`];`, `  { files: ['legacy/**'], rules: { 'rules-as-tests/no-unsafe-zod-parse': 'off' } },\n];`);
    // 'error' for some files only: a RULE_GLOBS.boundary element at 'error' would reach the files the consumer left out.
    const scoped = R2_BY_HAND.replace(`{ plugins:`, `{ files: ['src/api/**'], plugins:`);
    const excepted = R2_BY_HAND.replace(`{ plugins:`, `{ ignores: ['src/routes/legacy/**'], plugins:`);
    // The same, spelled with quoted keys, and R2 set under a computed template-literal key (second cold review).
    const quotedKeys = R2_BY_HAND.replace(`{ plugins:`, `{ 'files': ['src/api/**'], plugins:`).replace(`rules: {`, `'rules': {`);
    const templateKey = R2_BY_HAND.replace(`'rules-as-tests/no-unsafe-zod-parse': 'error'`, "[`rules-as-tests/no-unsafe-zod-parse`]: 'off'");
    // The gates need RULE_GLOBS.boundary: check-rule-globs.sh fails without it, and check-rule-enforced.sh
    // takes its boundary files from it to ask ESLint whether R2 is on there. A declaration alone gives them
    // the boundary code the install found; where R2 runs stays the consumer's setting (operator decision
    // 2026-09-29, «A + name the miss»).
    const r2Mentions = (s: string): number => s.split(R2_RULE_ID).length - 1;
    for (const src of [warn, hidden, twice, scoped, excepted, quotedKeys, templateKey]) {
      const r = await wireOwnConfig(src, ROOT);
      expect(r.status).toBe('wired');
      expect(onlyInserts(src, r.modified)).toBe(true);
      expect(gateBoundary(r.modified)).toEqual(BOUNDARY);
      // No R2 element of getff's: one would reach the files the consumer's own setting leaves out.
      expect(r.modified).not.toMatch(/files: RULE_GLOBS\.boundary/);
      expect(r2Mentions(r.modified)).toBe(r2Mentions(src));
      // Nothing in the config reads RULE_GLOBS, so it is exported: a bare const fails no-unused-vars in the
      // consumer's own lint of the config (measured 2026-09-29 with typescript-eslint's recommended set).
      const lint = new Linter({ configType: 'flat' })
        .verify(r.modified, [{ languageOptions: { ecmaVersion: 'latest', sourceType: 'module' }, rules: { 'no-unused-vars': 'error' } }], 'eslint.config.mjs');
      // A parse error reports no rule at all, so it is ruled out first.
      expect(lint.filter((m) => m.fatal)).toEqual([]);
      expect(lint.filter((m) => m.message.includes('RULE_GLOBS'))).toEqual([]);
      expect(r.notes ?? []).toEqual([]);
      const again = await wireOwnConfig(r.modified, ROOT);
      expect(again.status).toBe('already-wired');
    }
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('RULE_GLOBS bound from elsewhere (an import, a destructuring) → no second declaration, a note instead (cold review)', async () => {
    // A second `RULE_GLOBS` in the same scope is a SyntaxError: the lint probe would fail and roll back
    // every getff edit to the config, the ignores element included.
    const scopedByGlobs = R2_BY_HAND.replace(`{ plugins:`, `{ files: RULE_GLOBS.boundary, plugins:`);
    const imported = `import { RULE_GLOBS } from './globs.mjs';\n${scopedByGlobs}`;
    const destructured = scopedByGlobs.replace(`export default [`, `const { RULE_GLOBS } = await import('./globs.mjs');\n\nexport default [`);
    const importedR2Everywhere = `import { RULE_GLOBS } from './globs.mjs';\n${R2_BY_HAND}`;
    for (const src of [imported, destructured, importedR2Everywhere]) {
      const r = await wireOwnConfig(src, ROOT);
      expect(r.modified).not.toMatch(/^(export )?const RULE_GLOBS\b/m);
      expect(r.modified).not.toMatch(/files: RULE_GLOBS\.boundary, rules/);
      expect((r.notes ?? []).join('\n')).toMatch(/RULE_GLOBS.*from elsewhere/);
    }
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('RULE_GLOBS re-exported under that name → a note, no declaration; a RULE_GLOBS bound inside a function → declared as usual (second cold review)', async () => {
    const warn = R2_BY_HAND.replace(`zod-parse': 'error'`, `zod-parse': 'warn'`);
    // `export const RULE_GLOBS` beside any of these is a duplicate export: a SyntaxError.
    const reExported = `export { RULE_GLOBS } from './globs.mjs';\n${warn}`;
    const reExportedAs = `export { BOUNDARY_GLOBS as RULE_GLOBS } from './globs.mjs';\n${warn}`;
    const namespace = `export * as RULE_GLOBS from './globs.mjs';\n${warn}`;
    const localAs = `const globs = { boundary: ['src/api/**'] };\nexport { globs as RULE_GLOBS };\n${warn}`;
    for (const src of [reExported, reExportedAs, namespace, localAs]) {
      const r = await wireOwnConfig(src, ROOT);
      expect(r.modified).not.toMatch(/^(export )?const RULE_GLOBS\b/m);
      expect((r.notes ?? []).join('\n')).toMatch(/RULE_GLOBS.*from elsewhere/);
    }
    // A parameter or a destructuring inside a function binds its own RULE_GLOBS, not the module's.
    const inFunction = warn.replace(`export default [`, `const pick = ({ RULE_GLOBS }) => RULE_GLOBS;\nvoid pick;\n\nexport default [`);
    const r = await wireOwnConfig(inFunction, ROOT);
    expect(r.status).toBe('wired');
    expect(gateBoundary(r.modified)).toEqual(BOUNDARY);
    expect(r.modified).toMatch(/^export const RULE_GLOBS = \{/m);
    expect(r.notes ?? []).toEqual([]);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('a per-package config (the gate reads no RULE_GLOBS of it) with R2 at error for every file → nothing added, no note', async () => {
    const r = await wireOwnConfig(R2_BY_HAND, { boundaryGlobs: BOUNDARY, customRulesImportPath: IMPORT_PATH });
    expect(r.status).toBe('already-wired');
    expect(r.modified).toBe(R2_BY_HAND);
    expect(r.notes ?? []).toEqual([]);
  });
});

// A rule the config already sets is present whatever form its key takes. `eqeqeq: 'off'` — an identifier
// key, prettier's default quoteProps output — used to read as absent, and the appended
// `{ rules: { "eqeqeq": "error" } }` overrode the consumer's own setting (measured 2026-09-28).
describe('wireNRules — rule presence is a key in a rules object, quoted or not', () => {
  const UNQUOTED = [
    `import js from '@eslint/js';`,
    ``,
    `export default [`,
    `  js.configs.recommended,`,
    `  {`,
    `    rules: {`,
    `      eqeqeq: 'off', // consumer: legacy code`,
    `      curly: 'error',`,
    `    },`,
    `  },`,
    `];`,
    ``,
  ].join('\n');

  it.skipIf(!TS_MORPH_AVAILABLE)('insertOnly: an identifier-keyed rule keeps the consumer value, nothing appended for it', async () => {
    const r = await wireNRules(UNQUOTED, { eqeqeq: 'error', 'no-var': 'error' }, { overrideKeys: new Set(['eqeqeq']), insertOnly: true });
    expect(r.status).toBe('wired');
    expect(onlyInserts(UNQUOTED, r.modified)).toBe(true);
    expect(r.modified).toContain(`      eqeqeq: 'off', // consumer: legacy code\n`);
    expect(r.modified).not.toMatch(/["']eqeqeq["']/);
    expect(r.modified).toContain(`{ rules: { "no-var": "error" } }`);
    expect(r.notes?.join(' ')).toMatch(/eqeqeq/);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('an identifier-keyed rule is already wired; getff\'s own config still lets a live value win', async () => {
    const same = await wireNRules(UNQUOTED, { curly: 'error' });
    expect(same.status).toBe('already-wired');
    expect(same.modified).toBe(UNQUOTED);
    const kept = await wireNRules(UNQUOTED, { eqeqeq: 'error' });
    expect(kept.status).toBe('already-wired');
    expect(kept.modified).toBe(UNQUOTED);
    const live = await wireNRules(UNQUOTED, { eqeqeq: 'error' }, { overrideKeys: new Set(['eqeqeq']) });
    expect(live.status).toBe('wired');
    expect(live.modified).toContain(`      eqeqeq: "error", // consumer: legacy code\n`);
    expect(live.modified).not.toContain(`{ rules: { "eqeqeq"`);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('a rule named only in a comment, a string value or another object\'s key is still appended', async () => {
    const src = [
      `// eqeqeq: 'off' was tried and reverted; 'eqeqeq' stays on`,
      `export default [`,
      `  { settings: { eqeqeq: true } },`,
      `  { rules: { 'no-restricted-syntax': ['error', { selector: 'X', message: "use 'eqeqeq'" }] } },`,
      `];`,
      ``,
    ].join('\n');
    const r = await wireNRules(src, { eqeqeq: 'error' }, { insertOnly: true });
    expect(r.status).toBe('wired');
    expect(onlyInserts(src, r.modified)).toBe(true);
    expect(r.modified).toContain(`{ rules: { "eqeqeq": "error" } }`);
  });

  // The exported list reaches these settings only through a variable, which it may not reach at all
  // (`STRICT ? [...base, strict] : base`). A later appended block would override them, and a silent skip
  // could leave the rule enforced nowhere — so a config the consumer owns keeps them and names the rule.
  it.skipIf(!TS_MORPH_AVAILABLE).each([
    [`spread`, `const legacy = { eqeqeq: 'off' };\nexport default [{ rules: { ...legacy, curly: 'error' } }];\n`],
    [`shorthand`, `const rules = { eqeqeq: 'off' };\nexport default [{ rules }];\n`],
    [`exported identifier`, `const config = [{ rules: { eqeqeq: 'off' } }];\nexport default config;\n`],
    [`variant export`, `const base = [{ files: ['a/**'] }];\nconst strict = { eqeqeq: 'off' };\nconst config = process.env.STRICT ? [...base, { rules: strict }] : base;\nexport default config;\n`],
  ])('insertOnly: a rule set through a variable (%s) keeps its value, named in notes', async (_shape, src) => {
    for (const live of ['error', 'off']) {
      const r = await wireNRules(src, { eqeqeq: live }, { overrideKeys: new Set(['eqeqeq']), insertOnly: true });
      expect(r.modified).toBe(src);
      expect(r.notes?.join(' ')).toMatch(/eqeqeq/);
    }
    // Paired: getff's own config (no insertOnly) lets the live value win by a later block (D2).
    const own = await wireNRules(src, { eqeqeq: 'error' }, { overrideKeys: new Set(['eqeqeq']) });
    expect(own.status).toBe('wired');
    expect(own.modified).toContain(`{ rules: { "eqeqeq": "error" } }`);
  });

  // Shapes the key search does not follow into: the old quoted-string search found the rule in each, and
  // must not lose it — an appended block would override the consumer's own value (cold review, MAJOR).
  it.skipIf(!TS_MORPH_AVAILABLE).each([
    [`conditional spread`, `export default [{ rules: { ...(process.env.CI ? { curly: 'off' } : {}) } }];\n`],
    [`&& spread`, `const ci = !!process.env.CI;\nexport default [{ rules: { ...(ci && { curly: 'off' }) } }];\n`],
    [`?? spread`, `export default [{ rules: { ...(globalThis.x ?? { curly: 'off' }) } }];\n`],
    [`JSDoc cast`, `export default [{ rules: /** @type {any} */ ({ curly: 'off' }) }];\n`],
    [`Object.assign`, `export default [{ rules: Object.assign({}, { curly: 'off' }) }];\n`],
    [`function-built`, `function mk() { return { 'no-console': 'off' }; }\nexport default [{ rules: mk() }];\n`],
    [`computed key`, `export default [{ rules: { ['no-console']: 'off' } }];\n`],
    [`assigned after declaration`, `const rules = {};\nrules['no-console'] = 'off';\nexport default [{ rules }];\n`],
  ])('insertOnly: a rule set in a %s is present, nothing appended', async (_shape, src) => {
    const rule = src.includes('curly') ? 'curly' : 'no-console';
    const r = await wireNRules(src, { [rule]: 'error' }, { insertOnly: true });
    expect(r.status).toBe('already-wired');
    expect(r.modified).toBe(src);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('wireOwnConfig: R2 set behind a cast is present, no second R2 block', async () => {
    const src = `export default [{ rules: /** @type {any} */ ({ '${R2_RULE_ID}': 'off' }) }];\n`;
    const r = await wireOwnConfig(src, { boundaryGlobs: ['src/api/**/*.ts'] });
    expect(r.modified).toBe(src);
  });

  // Without ts-morph the quoted-string search decides already-wired vs degrade, and never edits.
  it('without ts-morph: a quoted rule is already wired, an identifier-keyed one degrades untouched', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'no-ts-morph-'));
    const cwd = process.cwd();
    process.chdir(dir);
    try {
      const quoted = `export default [{ rules: { 'eqeqeq': 'off' } }];\n`;
      expect((await wireNRules(quoted, { eqeqeq: 'error' }, { insertOnly: true })).status).toBe('already-wired');
      const ident = `export default [{ rules: { eqeqeq: 'off' } }];\n`;
      const d = await wireNRules(ident, { eqeqeq: 'error' }, { insertOnly: true });
      expect(d.status).toBe('degrade');
      expect(d.modified).toBe(ident);
    } finally {
      process.chdir(cwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('wireOwnConfig: R2 named only in a comment is still wired', async () => {
    const src = `// ${JSON.stringify(R2_RULE_ID)} comes later\nexport default [{ rules: {} }];\n`;
    const r = await wireOwnConfig(src, { boundaryGlobs: ['src/api/**/*.ts'] });
    expect(r.status).toBe('wired');
    expect(r.modified).toContain(`rules: { '${R2_RULE_ID}': 'error' }`);
    expect((await wireOwnConfig(r.modified, { boundaryGlobs: ['src/api/**/*.ts'] })).status).toBe('already-wired');
  });
});

describe('wireConfigSource / resolveAndWire — R2 is present only when the config names it as code', () => {
  const base = `import base from './base.mjs';\n`;
  const tail = `export default [...base];\n`;
  // Each mention sets no rule: the wirer must still wire R2.
  const MENTIONS: Array<[string, string]> = [
    ['a // comment', `// TODO: turn on '${R2_RULE_ID}'\n`],
    ['a /* */ comment', `/* { rules: { '${R2_RULE_ID}': 'error' } } */\n`],
    ['a longer string', `const note = 'turn on ${R2_RULE_ID} later';\n`],
    ['template-literal text', 'const note = `see ${base.length} ' + R2_RULE_ID + '`;\n'],
    ['a regex literal', `const re = /${R2_RULE_ID.replace('/', '\\/')}/;\n`],
  ];

  for (const [label, mention] of MENTIONS) {
    it.skipIf(!TS_MORPH_AVAILABLE)(`wireConfigSource: R2 named only in ${label} is still wired`, async () => {
      const src = base + mention + tail;
      const r = await wireConfigSource(src);
      expect(r.status).toBe('wired');
      expect(r.modified).toContain(`rules: { '${R2_RULE_ID}': 'error' }`);
      expect((await wireConfigSource(r.modified)).status).toBe('already-wired');
    });
  }

  it.skipIf(!TS_MORPH_AVAILABLE)('wireConfigSource: R2 as a real quoted rule key is already wired (paired)', async () => {
    const src = base + `// TODO: tighten '${R2_RULE_ID}'\nexport default [...base, { rules: { "${R2_RULE_ID}": 'warn' } }];\n`;
    const r = await wireConfigSource(src);
    expect(r.status).toBe('already-wired');
    expect(r.modified).toBe(src);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('resolveAndWire: R2 named only in a comment is written into the config', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'r2wire-comment-'));
    const p = join(dir, 'eslint.config.mjs');
    const src = base + `// TODO: turn on '${R2_RULE_ID}'\n` + tail;
    writeFileSync(p, src, 'utf8');
    try {
      const r = await resolveAndWire({ configPath: p, cwd: dir, runProbe: async () => 'ok' });
      expect(r.status).toBe('wired');
      expect(readFileSync(p, 'utf8')).toContain(`rules: { '${R2_RULE_ID}': 'error' }`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('resolveAndWire: R2 as a real quoted rule key is left byte-identical (paired)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'r2wire-comment-'));
    const p = join(dir, 'eslint.config.mjs');
    const src = base + `export default [...base, { rules: { '${R2_RULE_ID}': 'error' } }];\n`;
    writeFileSync(p, src, 'utf8');
    try {
      const r = await resolveAndWire({ configPath: p, cwd: dir, runProbe: async () => 'unavailable' });
      expect(r.status).toBe('already-wired');
      expect(readFileSync(p, 'utf8')).toBe(src);
    } finally {
      rmSync(dir, { recursive: true, force: true });
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

  // check-rule-globs.sh reads no package config's RULE_GLOBS: a package config that sets R2 wires it for
  // the gate by naming it (classify_config_r2), so R2 at 'error' for every file is enforced as it stands.
  it.skipIf(!TS_MORPH_AVAILABLE)('R2 already set to error for every file, no RULE_GLOBS → «already enforced», byte-identical (F11)', async () => {
    await inPkg(HAND, async (cfg, root) => {
      const out = (await wireR2IntoOwnConfig({ configPath: cfg, cwd: root, boundaryGlobs: BOUNDARY, runProbe: probeOk })).join('\n');
      expect(readFileSync(cfg, 'utf8')).toBe(HAND);
      expect(out).toMatch(/R2 already enforced/);
      expect(out).not.toMatch(/not wired/);
    });
  });

  it.skipIf(!TS_MORPH_AVAILABLE)('R2 set to warn, or for some files only → untouched, one not-wired line, no claim about the gate (F11)', async () => {
    const warn = HAND.replace(`zod-parse': 'error'`, `zod-parse': 'warn'`);
    const scoped = HAND.replace(`{ plugins:`, `{ files: ['src/api/**'], plugins:`);
    // Scoped through a spread (#1882): the element's literal shows no files: key, yet it applies to src/api only.
    const spreadScoped = HAND
      .replace(`export default [`, `const onlyApi = { files: ['src/api/**'] };\n\nexport default [`)
      .replace(`{ plugins:`, `{ ...onlyApi, plugins:`);
    for (const src of [warn, scoped, spreadScoped]) {
      await inPkg(src, async (cfg, root) => {
        const out = (await wireR2IntoOwnConfig({ configPath: cfg, cwd: root, boundaryGlobs: BOUNDARY, runProbe: probeOk })).join('\n');
        expect(readFileSync(cfg, 'utf8')).toBe(src);
        expect(out).toMatch(/^ {2}· not wired: R2 \(rules-as-tests\/no-unsafe-zod-parse\) in .* — .*does not change a setting of yours/m);
        expect(out).not.toMatch(/check-rule-globs|R2 already enforced|manually|by hand/i);
      });
    }
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

describe('r2NotWiredLine — the line the install copies into its NOT wired summary', () => {
  it('keeps a multi-line reason on one line, so the summary carries all of it', () => {
    // An own-config rollback reason embeds ESLint's multi-line output; the install reads the wirer's
    // output line by line, so a raw newline would cut the summary entry at the reason's first line.
    const line = r2NotWiredLine(
      '/no/such/root/apps/api/eslint.config.mjs',
      'ESLint could not load it (Oops! Something went wrong! :(\n\n  ESLint: 9.0.0\n), so it was rolled back; the config is as it was',
      '/no/such/root',
    );
    expect(line).not.toContain('\n');
    expect(line).toBe(
      `  · not wired: R2 (${R2_RULE_ID}) in apps/api/eslint.config.mjs — ESLint could not load it (Oops! Something went wrong! :( ESLint: 9.0.0 ), so it was rolled back; the config is as it was`,
    );
  });

  it('names a config that is itself a symlink by its own path in the project, not by its target', () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'r2-line-')));
    try {
      mkdirSync(join(root, 'shared'));
      mkdirSync(join(root, 'apps', 'api'), { recursive: true });
      writeFileSync(join(root, 'shared', 'eslint.config.mjs'), 'export default [];\n');
      symlinkSync(join(root, 'shared', 'eslint.config.mjs'), join(root, 'apps', 'api', 'eslint.config.mjs'));
      expect(r2NotWiredLine(join(root, 'apps', 'api', 'eslint.config.mjs'), 'why', root)).toBe(
        `  · not wired: R2 (${R2_RULE_ID}) in apps/api/eslint.config.mjs — why`,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
