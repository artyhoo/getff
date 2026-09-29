// Every lintable script getff delivers into the consumer's scripts/ is getff's machinery, never the
// consumer's code — so getff's ESLint configs ignore it, and so does the ignores entry getff adds to a
// config the consumer owns (99-finalize.sh `_own_eslint_ignores`). A script missing from those lists is
// linted as the consumer's code: at install its findings go into the consumer's lint baseline (ESLint's
// bulk suppressions) as if the consumer had written them. Measured by the P5 red-lint cell (R2): 32 of
// the 34 recorded findings were getff's own scripts/prove-rules.mjs.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
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

describe("getff's delivered scripts are ignored by every ESLint config getff writes", () => {
  it('derives the delivered scripts from the installer, and each is ignored everywhere', () => {
    const scripts = deliveredScripts();
    expect(scripts).toEqual(expect.arrayContaining(['scripts/audit-r4.ts', 'scripts/prove-rules.mjs'])); // never vacuous
    expect(missing(scripts)).toEqual([]);
  });

  it('a script getff starts delivering without an ignores entry is RED (paired negative)', () => {
    expect(missing(['scripts/getff-new-tool.mjs'])).toHaveLength(TEMPLATES.length + 1);
  });
});
