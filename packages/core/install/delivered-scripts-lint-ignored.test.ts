// Every lintable script getff delivers into the consumer's scripts/ is getff's machinery, never the
// consumer's code — so getff's ESLint configs ignore it, and so does the ignores entry getff adds to a
// config the consumer owns (99-finalize.sh `_own_eslint_ignores`). A script missing from those lists is
// linted as the consumer's code: at install its findings go into the consumer's lint baseline (ESLint's
// bulk suppressions) as if the consumer had written them. Measured by the P5 red-lint cell (R2): 32 of
// the 34 recorded findings were getff's own scripts/prove-rules.mjs.
//
// An oxlint project's config is the project's own and carries no ignores of getff's, so its `npm run lint`
// reads getff's scripts too: each one is clean under the config a fresh `create-vite` react-ts project ships
// (measured by P5 R1: an unused variable in scripts/prove-rules.mjs printed a warning in the consumer's lint).
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
// packages/core pins oxlint (P4); resolved the way prove-rules.test.ts resolves it.
const OXLINT = (() => {
  try {
    return join(dirname(createRequire(join(REPO, 'packages/core/package.json')).resolve('oxlint/package.json')), 'bin/oxlint');
  } catch {
    return join(REPO, 'packages/core/node_modules/oxlint/bin/oxlint');
  }
})();
// The .oxlintrc.json create-vite 9.2.1 writes for `--template react-ts` (its own rules are react-only).
const VITE_OXLINTRC = { plugins: ['react', 'typescript', 'oxc'], rules: { 'react/rules-of-hooks': 'error' } };
const TEMPLATES = [
  'packages/preset-react-spa/templates/eslint.config.react.mjs',
  'packages/preset-next-15-canonical/templates/eslint.config.react.mjs',
  'packages/preset-react-native/templates/eslint.config.rn-common.mjs',
  'templates/ts-server/eslint.config.mjs',
];

/** The lintable files the installer's code copies into the consumer's scripts/. */
function deliveredScripts(): string[] {
  const files = readdirSync(join(REPO, 'setup.d')).filter((f) => f.endsWith('.sh')).map((f) => `setup.d/${f}`);
  const re = /"\$PROJECT_ROOT\/(scripts\/[^"$/]+\.[cm]?[jt]sx?)"/g;
  return [...new Set(files.flatMap((f) => [...read(f).matchAll(re)].map((m) => m[1])))].sort();
}
/** The paths `_own_eslint_ignores` prints for a config the consumer owns. */
function ownConfigIgnores(): string {
  const text = read('setup.d/99-finalize.sh');
  const start = text.indexOf('_own_eslint_ignores() {');
  return text.slice(start, text.indexOf('\n}\n', start));
}
function missing(scripts: string[]): string[] {
  const own = ownConfigIgnores();
  return scripts.flatMap((s) => [
    ...TEMPLATES.filter((t) => !read(t).includes(`'${s}'`)).map((t) => `${s} not ignored in ${t}`),
    ...(own.includes(s) ? [] : [`${s} not in 99-finalize.sh _own_eslint_ignores`]),
  ]);
}

/** The delivered scripts' source files (setup.d copies them from packages/core), each linted under `cfg`. */
function oxlintFindings(files: string[]): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'delivered-ox-'));
  const cfg = join(dir, '.oxlintrc.json');
  writeFileSync(cfg, JSON.stringify(VITE_OXLINTRC));
  const r = spawnSync(OXLINT, ['-c', cfg, '-f', 'json', ...files], { cwd: REPO, encoding: 'utf8' });
  const diags: { filename?: string; code?: string; message?: string }[] = JSON.parse(r.stdout).diagnostics ?? [];
  return diags.map((d) => `${d.filename}: ${d.code} ${d.message}`);
}
/** The source of each delivered script, read from the installer line that copies it (`"$PKG_ROOT/<src>" "$PROJECT_ROOT/scripts/…"`). */
function deliveredSources(): string[] {
  const files = readdirSync(join(REPO, 'setup.d')).filter((f) => f.endsWith('.sh')).map((f) => `setup.d/${f}`);
  const re = /"\$PKG_ROOT\/([^"$]+)"\s+"\$PROJECT_ROOT\/scripts\/[^"$/]+\.[cm]?[jt]sx?"/g;
  return [...new Set(files.flatMap((f) => [...read(f).matchAll(re)].map((m) => m[1])))].sort();
}

describe("getff's delivered scripts never become the consumer's lint findings", () => {
  it('derives the delivered scripts from the installer, and each is ignored everywhere', () => {
    const scripts = deliveredScripts();
    expect(scripts).toEqual(expect.arrayContaining(['scripts/audit-r4.ts', 'scripts/prove-rules.mjs'])); // never vacuous
    expect(missing(scripts)).toEqual([]);
  });

  it('a script getff starts delivering without an ignores entry is RED (paired negative)', () => {
    expect(missing(['scripts/getff-new-tool.mjs'])).toHaveLength(TEMPLATES.length + 1);
  });

  it("each is clean under a fresh create-vite project's oxlint config, which reads them", () => {
    const sources = deliveredSources();
    expect(sources).toEqual(expect.arrayContaining(['packages/core/audit-self/prove-rules.mjs', 'packages/core/probes/audit-r4.ts'])); // never vacuous
    expect(oxlintFindings(sources)).toEqual([]);
  });

  it('a script with an unused variable is a finding there (paired negative)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'delivered-ox-neg-'));
    writeFileSync(join(dir, 'x.mjs'), 'export function f() {\n  const unused = 1;\n  return 2;\n}\n');
    expect(oxlintFindings([join(dir, 'x.mjs')]).join('\n')).toContain('no-unused-vars');
  });
});
