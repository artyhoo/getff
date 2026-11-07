// Plugin dual-engine test — every rule of getff's core lint plugin fires on its bad example and stays
// silent on its good one under BOTH ESLint and oxlint.
//
// WHY (one-button chain, part P4; operator log entry 26 point 12): the plugin is ONE package in ESLint
// format that a project loads either from `eslint.config.mjs` or through oxlint's `jsPlugins`. A rule
// proven under ESLint only can still fail to load or fire in oxlint (its JS plugin support is alpha).
//
// WHAT MAKES THIS NON-TAUTOLOGICAL:
//   1. IT TESTS WHAT SHIPS. Rules are imported from the compiled `.mjs` files the installer copies, not
//      from the `.ts` sources, and wrapped in the same plugin shape (`meta` + `rules`) the generated
//      `eslint-rules-local/index.mjs` barrel exports. The barrel itself is written at install time.
//   2. THE FIXTURES ARE THE CONSUMER'S. The bad/good pairs are the `fences-fire` triples that
//      `scripts/check-fences-fire.sh` runs in a consumer project, options included.
//   3. EVERY RULE NEEDS A PAIR. A core rule with no triple is RED, so a new rule cannot ship unproven.
//   4. THE ENGINES MUST AGREE. oxlint must report exactly as many problems on the bad file as ESLint does.
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(HERE, '..', 'audit-self', 'fixtures', 'fences-fire');
const PLUGIN_NAME = 'rules-as-tests';

// The shipped rule set: every `'<rule>': <export>` key of the core plugin index.
const coreRules = [...readFileSync(join(HERE, 'index.ts'), 'utf8').matchAll(/^\s+'([a-z-]+)':/gm)].map((m) => m[1]);

interface Triple {
  name: string;
  rule: string;
  options: unknown[];
  bad: { code: string; filename: string };
  good: { code: string; filename: string };
}

function readTriple(manifestFile: string): Triple {
  const name = manifestFile.replace(/\.manifest\.json$/, '');
  const manifest = JSON.parse(readFileSync(join(FIXTURE_DIR, manifestFile), 'utf8')) as {
    'rule-id': string;
    'rule-options'?: unknown[];
  };
  const pick = (kind: 'bad' | 'good') => {
    const file = readdirSync(FIXTURE_DIR).find((f) => f.startsWith(`${name}.${kind}.`));
    if (!file) throw new Error(`${name}: no ${kind} fixture`);
    // `.txt` fixtures are TypeScript; `.tsx` ones carry JSX. The engines read the extension.
    const ext = file.endsWith('.tsx.txt') || file.endsWith('.tsx') ? 'tsx' : 'ts';
    return { code: readFileSync(join(FIXTURE_DIR, file), 'utf8'), filename: `${kind}.${ext}` };
  };
  return {
    name,
    rule: manifest['rule-id'].split('/')[1],
    options: manifest['rule-options'] ?? [],
    bad: pick('bad'),
    good: pick('good'),
  };
}

const triples = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith('.manifest.json'))
  .map(readTriple)
  .filter((t) => coreRules.includes(t.rule));

async function loadShippedRule(rule: string) {
  const mod = (await import(join(HERE, `${rule}.mjs`))) as Record<string, unknown>;
  const ruleModule = Object.values(mod)[0];
  if (!ruleModule) throw new Error(`${rule}.mjs exports no rule`);
  return ruleModule;
}

function eslintProblems(ruleModule: unknown, t: Triple, sample: Triple['bad']): number {
  const ruleValue = t.options.length > 0 ? ['error', ...t.options] : 'error';
  const messages = new Linter().verify(
    sample.code,
    [
      {
        files: ['**/*.{ts,tsx}'],
        plugins: { [PLUGIN_NAME]: { meta: { name: PLUGIN_NAME }, rules: { [t.rule]: ruleModule } } },
        rules: { [`${PLUGIN_NAME}/${t.rule}`]: ruleValue },
        languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
      },
    ] as Linter.Config[],
    { filename: sample.filename },
  );
  const fatal = messages.filter((m) => m.fatal);
  if (fatal.length > 0) throw new Error(`${t.name} ${sample.filename}: parse error ${fatal[0].message}`);
  return messages.filter((m) => m.ruleId === `${PLUGIN_NAME}/${t.rule}`).length;
}

describe('core lint plugin: every rule has a bad/good pair', () => {
  it.each(coreRules)('%s has a fences-fire triple', (rule) => {
    expect(triples.some((t) => t.rule === rule)).toBe(true);
  });
});

// An oxlint project has no ESLint toolchain of its own (a fresh create-vite react-ts scaffold lists only
// oxlint, typescript, vite, @vitejs/plugin-react and @types/*), so a shipped rule that loads a package at
// run time breaks the whole barrel there. Type-only imports are erased by the compiler and are fine. The
// check covers every rule directory the installer copies into `eslint-rules-local/` (install.sh `_rule_dirs`),
// preset ones included, because the barrel imports all of them.
const SHIPPED_RULE_DIRS = [HERE, join(HERE, '..', '..', 'preset-next-15-canonical', 'eslint-rules')];
const shippedMjs = SHIPPED_RULE_DIRS.flatMap((dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.mjs') && f !== 'index.mjs')
    .map((f) => join(dir, f)),
);
const PACKAGE_LOADS = [
  /^\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/gm, // import x from 'p'; export * from 'p'
  /^\s*import\s+['"]([^'"]+)['"]/gm, // import 'p'
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g, // require('p')
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g, // import('p')
];
export function packageLoads(source: string): string[] {
  return PACKAGE_LOADS.flatMap((re) => [...source.matchAll(re)].map((m) => m[1])).filter(
    (spec) => !spec.startsWith('.'),
  );
}

describe('core lint plugin: the shipped rules load with no package installed', () => {
  it('sees every way a module can load a package (paired negative)', () => {
    expect(packageLoads("import { a } from 'p1';\nexport * from 'p2';\nimport 'p3';")).toEqual(['p1', 'p2', 'p3']);
    expect(packageLoads("const u = require('p4'); await import('p5');")).toEqual(['p4', 'p5']);
    expect(packageLoads("import { b } from './local.mjs';\nexport { c } from '../x.mjs';")).toEqual([]);
  });

  it('covers the preset rule directory too', () => {
    expect(shippedMjs.some((f) => f.includes('preset-next-15-canonical'))).toBe(true);
  });

  it.each(shippedMjs.map((f) => [f.split('/packages/')[1], f]))('%s loads no package at run time', (_, file) => {
    expect(packageLoads(readFileSync(file, 'utf8'))).toEqual([]);
  });
});

describe.each(triples)('$name under ESLint and oxlint', (t) => {
  it('ESLint: the bad example fails, the good one passes', async () => {
    const ruleModule = await loadShippedRule(t.rule);
    expect(eslintProblems(ruleModule, t, t.bad)).toBeGreaterThan(0);
    expect(eslintProblems(ruleModule, t, t.good)).toBe(0);
  });

  describe('oxlint', async () => {
    const ruleModule = await loadShippedRule(t.rule);
    const expected = eslintProblems(ruleModule, t, t.bad);
    RuleTester.describe = describe;
    RuleTester.it = it;
    // A rule with `schema: []` rejects even an empty options array, so pass options only when given.
    // The cases are cast: each rule's option type is known only at run time, from its manifest.
    const options = t.options.length > 0 ? { options: t.options } : {};
    new RuleTester().run(t.rule, ruleModule as never, {
      valid: [{ code: t.good.code, filename: t.good.filename, ...options } as never],
      invalid: [{ code: t.bad.code, filename: t.bad.filename, ...options, errors: expected } as never],
    });
  });
});
