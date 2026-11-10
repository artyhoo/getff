// Parity (T-C3): the rules prove-rules.mjs switches on in an oxlint project are the plugin rules the stack's
// shipped ESLint config switches on by default, with the same globs — or a named not-placed entry.
//
// prove-rules.mjs is copied into the consumer project and cannot read getff's templates there, so it keeps a
// mirror (STACK_RULES). This test reads each template and fails when the mirror drifts: a rule the template
// adds, a glob it changes, or an opt-in block it moves.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');

const TEMPLATES: Record<string, string> = {
  'react-spa': 'packages/preset-react-spa/templates/eslint.config.react.mjs',
  'react-next': 'packages/preset-next-15-canonical/templates/eslint.config.react.mjs',
  'ts-server': 'templates/ts-server/eslint.config.mjs',
};

export interface StackRule {
  rule: string;
  files: string[];
  excludeFiles?: string[];
  strict?: boolean;
  notPlaced?: string;
}

/** Every `rules-as-tests/*` rule a template's config elements switch on, with the element's files/ignores. */
function templateRules(text: string): StackRule[] {
  const src = text
    .split('\n')
    .map((l) => (/^\s*\/\//.test(l) ? '' : l))
    .join('\n');
  const globsText = /const RULE_GLOBS = (\{[\s\S]*?\n\});/.exec(src)?.[1];
  const globs = (globsText ? new Function(`return (${globsText});`)() : {}) as Record<string, string[]>;
  const listOf = (expr: string | undefined): string[] | undefined => {
    if (!expr) return undefined;
    const named = /^RULE_GLOBS\.(\w+)$/.exec(expr.trim());
    if (named) return globs[named[1]];
    return new Function(`return (${expr});`)() as string[];
  };
  const strictStart = src.indexOf('...(STRICT_RUNTIME');
  const strictEnd = strictStart < 0 ? -1 : src.indexOf(': [])', strictStart);
  const out: StackRule[] = [];
  for (const m of src.matchAll(/'(rules-as-tests\/[a-z-]+)':/g)) {
    // Walk out of `rules: {` to the config element that holds it.
    let depth = 0;
    let i = m.index!;
    let opens = 0;
    for (; i >= 0; i--) {
      if (src[i] === '}') depth++;
      if (src[i] === '{') {
        if (depth === 0 && ++opens === 2) break;
        if (depth > 0) depth--;
      }
    }
    let j = i;
    for (let d = 0; j < src.length; j++) {
      if (src[j] === '{') d++;
      if (src[j] === '}' && --d === 0) break;
    }
    const element = src.slice(i, j + 1);
    const files = listOf(/\bfiles:\s*(RULE_GLOBS\.\w+|\[[^\]]*\])/.exec(element)?.[1]);
    const ignores = listOf(/\bignores:\s*(RULE_GLOBS\.\w+|\[[^\]]*\])/.exec(element)?.[1]);
    out.push({
      rule: m[1],
      files: files ?? [],
      ...(ignores ? { excludeFiles: ignores } : {}),
      ...(strictStart >= 0 && m.index! > strictStart && m.index! < strictEnd ? { strict: true } : {}),
    });
  }
  return out;
}

/** Problems between a template's rules and the mirror; empty = in parity. */
function parityProblems(fromTemplate: StackRule[], mirror: StackRule[]): string[] {
  const key = (r: StackRule) => `${r.rule} ${JSON.stringify(r.files)}`;
  const problems: string[] = [];
  for (const t of fromTemplate) {
    const m = mirror.find((x) => key(x) === key(t));
    if (!m) { problems.push(`template rule ${key(t)} is neither placed nor named not-placed`); continue; }
    if (m.notPlaced) { if (m.notPlaced.length < 20) problems.push(`${t.rule}: a not-placed reason must say why`); continue; }
    if (JSON.stringify(m.excludeFiles ?? []) !== JSON.stringify(t.excludeFiles ?? [])) problems.push(`${t.rule}: ignores differ`);
    if (!!m.strict !== !!t.strict) problems.push(`${t.rule}: opt-in (AIF_STRICT_RUNTIME) differs`);
  }
  for (const m of mirror) if (!fromTemplate.some((t) => key(t) === key(m))) problems.push(`mirror rule ${key(m)} is not in the template`);
  return problems;
}

let STACK_RULES: Record<string, StackRule[]>;
beforeAll(async () => {
  ({ STACK_RULES } = (await import(pathToFileURL(join(HERE, 'prove-rules.mjs')).href)) as { STACK_RULES: Record<string, StackRule[]> });
});

describe('the oxlint rule set mirrors each stack template (T-C3)', () => {
  it.each(Object.keys(TEMPLATES))('%s', (stack) => {
    const fromTemplate = templateRules(readFileSync(join(REPO, TEMPLATES[stack]), 'utf8'));
    expect(fromTemplate.length).toBeGreaterThan(0);
    expect(parityProblems(fromTemplate, STACK_RULES[stack] ?? [])).toEqual([]);
  });

  it('a template rule dropped from the mirror with no not-placed entry is RED (paired negative)', () => {
    const fromTemplate = templateRules(readFileSync(join(REPO, TEMPLATES['react-spa']), 'utf8'));
    const mirror = STACK_RULES['react-spa'].filter((r) => r.rule !== 'rules-as-tests/require-error-boundary');
    expect(parityProblems(fromTemplate, mirror)).toEqual([
      'template rule rules-as-tests/require-error-boundary ' +
        JSON.stringify(fromTemplate.find((r) => r.rule === 'rules-as-tests/require-error-boundary')!.files) +
        ' is neither placed nor named not-placed',
    ]);
  });

  it('a changed glob in the template is RED (paired negative)', () => {
    const fromTemplate = templateRules(readFileSync(join(REPO, TEMPLATES['react-spa']), 'utf8')).map((r) =>
      r.rule === 'rules-as-tests/no-unsafe-zod-parse' ? { ...r, files: [...r.files, '**/handlers/**/*.ts'] } : r,
    );
    expect(parityProblems(fromTemplate, STACK_RULES['react-spa']).length).toBeGreaterThan(0);
  });
});

// The table's principle for a built-in comes from BUILTIN_PRINCIPLE; base-core.md's «The lint plugin» names
// the same halves in prose («H8 `no-throw-literal` and `no-empty`»). Both must say the same.
function prosePrinciples(text: string): Record<string, string> {
  const at = text.indexOf('The other halves use rules your linter already has:');
  const out: Record<string, string> = {};
  if (at < 0) return out;
  let current = '';
  for (const m of text.slice(at).matchAll(/\b[A-Z]\d+\b|`[^`]+`|\.(?=\s|$)/g)) {
    if (m[0] === '.') break;
    if (m[0].startsWith('`')) {
      if (current) out[m[0].slice(1, -1)] = current;
    } else current = m[0];
  }
  return out;
}
function builtinProblems(text: string, builtins: string[], mirror: Record<string, string>): string[] {
  const prose = prosePrinciples(text);
  return builtins.filter((b) => prose[b] !== mirror[b]).map((b) => `${b}: base-core.md says ${prose[b] ?? 'nothing'}, the table says ${mirror[b] ?? 'nothing'}`);
}

describe("the built-ins' principle matches base-core.md (T-B1)", () => {
  const BASE = readFileSync(join(REPO, '.agents/procedures/getff/references/base-core.md'), 'utf8');
  let mod: { BUILTINS: string[]; BUILTIN_PRINCIPLE: Record<string, string> };
  beforeAll(async () => {
    mod = (await import(pathToFileURL(join(HERE, 'prove-rules.mjs')).href)) as typeof mod;
  });

  it('every built-in getff places has the principle base-core.md names for it', () => {
    expect(mod.BUILTINS.length).toBeGreaterThan(0);
    expect(builtinProblems(BASE, mod.BUILTINS, mod.BUILTIN_PRINCIPLE)).toEqual([]);
  });

  it('base-core.md moving a built-in to another principle is RED (paired negative)', () => {
    const moved = BASE.replace('H8 `no-throw-literal`', 'H9 `no-throw-literal`');
    expect(moved).not.toBe(BASE);
    expect(builtinProblems(moved, mod.BUILTINS, mod.BUILTIN_PRINCIPLE)).toEqual([
      'no-throw-literal: base-core.md says H9, the table says H8',
      'no-empty: base-core.md says H9, the table says H8',
    ]);
  });
});
