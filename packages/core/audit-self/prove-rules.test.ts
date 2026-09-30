// prove-rules — getff's lint rules are placed in the project's own linter config and proven through the
// project's own lint command (one-button chain, part P5, scope C; operator log entry 26 points 5-6, entry
// 28 fork 1 = A «what was green stays green», fork 2 = B «no pins»).
//
// WHAT MAKES THIS NON-TAUTOLOGICAL:
//   1. REAL LINTERS. Every fixture runs the oxlint that packages/core pins for P4 (1.86.0) and the ESLint of
//      the repo root, through `npm run lint` — the project's command, not a Linter API call.
//   2. THE PLUGIN IS WHAT SHIPS. The rules are the compiled `.mjs` files 40-configs.sh copies into
//      `eslint-rules-local/`, loaded through a barrel of the same shape generate_eslint_barrel writes.
//   3. PAIRED NEGATIVES. Each placement claim has its opposite: a new violation still fails the lint, a
//      rule switched off is never reported as proven, a red project gets no rule written.
//   4. THE BASH SEAM IS EXERCISED. Placement runs through `place_lint_rules` (setup.d/lib.sh), the function
//      99-finalize.sh calls, so P4's helper and the GETFF_ENABLE_PLUGIN_RULES flip are the real ones.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Every test here runs the real linters, git and lib.sh: one placement pass is ~1.1 s on its own, and the
// heaviest tests take 3-4 s alone. The core config leaves vitest's 5 s default (the repo-root config sets
// 60 s), and in the full core suite neighbouring files nearly double these times: measured 2026-09-30 on the
// PC, 2.8 s alone → 5.2 s in the suite, a timeout. The limit is the file's, like LIVE_TIMEOUT_MS in the
// linter-firing tests (backends/*/firing.test.ts); a hung linter still fails well inside it.
const LINT_PROCESS_TIMEOUT_MS = 30_000;
vi.setConfig({ testTimeout: LINT_PROCESS_TIMEOUT_MS });

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const SCRIPT = join(HERE, 'prove-rules.mjs');
// packages/core pins oxlint (P4); npm hoists it to the repo root in a workspace install and keeps it under
// packages/core in CI's `npm ci --prefix packages/core`, so it is resolved, not assumed.
const OXLINT = (() => {
  try {
    return join(dirname(createRequire(join(REPO, 'packages/core/package.json')).resolve('oxlint/package.json')), 'bin/oxlint');
  } catch {
    return join(REPO, 'packages/core/node_modules/oxlint/bin/oxlint');
  }
})();
const RULES_DIR = join(REPO, 'packages/core/eslint-rules');
const OWNED = '**/__getff_proof__/**';
const EXEMPT = '**/__getff_exempt__/**';
const CARRIER = 'rules-as-tests/restricted-syntax-audit-exempt';

type Json = Record<string, unknown>;
type Override = { files: string[]; excludeFiles?: string[]; rules: Record<string, unknown> };
type Diag = { id: string; file: string; message: string; error: boolean };
type LintResult = { rc: number; diags: Diag[]; raw: string };
type LintFn = (root: string, opts: { paths?: string[] }) => LintResult;
interface ProveRules {
  placeOxlint(root: string, opts: { stack: string; lint?: LintFn }): {
    placed: string[];
    notPlaced: Array<{ rule: string; reason: string }>;
    lintRc: number | null;
  };
  prove(root: string, opts?: { lint?: LintFn }): { rc: number; lines: string[] };
  realLint: LintFn;
}

// ── fixtures ────────────────────────────────────────────────────────────────────────────────────────
const MANIFEST = {
  G1: {
    title: 'Use createRoot instead of the removed ReactDOM.render',
    stack: ['react-spa'],
    check: {
      type: 'declarative',
      presence: 'forbid',
      selector: "CallExpression[callee.object.name='ReactDOM'][callee.property.name='render']",
      message: 'ReactDOM.render was removed in React 19 — use createRoot from react-dom/client.',
      engine: 'eslint-restricted',
    },
    examples: { bad: 'ReactDOM.render(app, el);', good: 'ReactDOM.createPortal(app, el);' },
    research: { entryId: 'react19-no-reactdom-render' },
  },
  G2: {
    title: 'Use default parameters instead of the removed defaultProps',
    stack: ['react-spa'],
    check: {
      type: 'declarative',
      presence: 'forbid',
      selector: "AssignmentExpression > MemberExpression.left[property.name='defaultProps']",
      message: 'defaultProps on function components was removed in React 19 — use ES6 default parameters.',
      engine: 'eslint-restricted',
    },
    examples: { bad: 'Button.defaultProps = {};', good: 'Button.displayName = {};' },
    research: { entryId: 'react19-no-function-defaultprops' },
  },
};

const GOOD_APP = `import { ErrorBoundary } from 'react-error-boundary';
export function App() {
  return (
    <ErrorBoundary fallback={<div>Error</div>}>
      <main>Content</main>
    </ErrorBoundary>
  );
}
`;
const BAD_APP = `export function App() {
  return <main>Content</main>;
}
`;

function barrel(): string {
  const keys = [...readFileSync(join(RULES_DIR, 'index.ts'), 'utf8').matchAll(/^\s+'([a-z-]+)':/gm)].map((m) => m[1]);
  const camel = (k: string) => k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return [
    ...keys.map((k) => `import { ${camel(k)} } from './${k}.mjs';`),
    `export default { meta: { name: 'rules-as-tests' }, rules: { ${keys.map((k) => `'${k}': ${camel(k)}`).join(', ')} } };`,
    '',
  ].join('\n');
}

function git(dir: string, ...args: string[]) {
  return spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' });
}

function write(dir: string, rel: string, text: string) {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), text);
}

/** What 40-configs.sh ships into scripts/: the proof runner and the plugin rules' bad/good pairs. */
function shipScripts(dir: string) {
  write(dir, 'scripts/prove-rules.mjs', readFileSync(SCRIPT, 'utf8'));
  const fx = join(HERE, 'fixtures/fences-fire');
  for (const f of readdirSync(fx)) write(dir, `scripts/fences-fire-fixtures/${f}`, readFileSync(join(fx, f), 'utf8'));
}

const OX_CFG: Json = {
  $schema: './node_modules/oxlint/configuration_schema.json',
  plugins: ['react', 'typescript', 'oxc'],
  jsPlugins: [{ name: 'rules-as-tests', specifier: './eslint-rules-local/index.mjs' }],
  rules: { 'react/rules-of-hooks': 'error' },
};

function oxProject(files: Record<string, string>, opts: { lint?: string; cfg?: Json; cfgText?: string } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'prove-ox-'));
  write(dir, 'package.json', JSON.stringify({ name: 'fx', private: true, scripts: { lint: opts.lint ?? 'oxlint' } }, null, 2) + '\n');
  mkdirSync(join(dir, 'node_modules/.bin'), { recursive: true });
  symlinkSync(OXLINT, join(dir, 'node_modules/.bin/oxlint'));
  for (const f of readdirSync(RULES_DIR).filter((f) => f.endsWith('.mjs'))) {
    mkdirSync(join(dir, 'eslint-rules-local'), { recursive: true });
    copyFileSync(join(RULES_DIR, f), join(dir, 'eslint-rules-local', f));
  }
  write(dir, 'eslint-rules-local/index.mjs', barrel());
  write(dir, '.oxlintrc.json', opts.cfgText ?? JSON.stringify(opts.cfg ?? OX_CFG, null, 2) + '\n');
  write(dir, '.gitignore', 'node_modules\n');
  shipScripts(dir);
  write(dir, '.ai-factory/synthesizer-output/rules-manifest-additions.json', JSON.stringify(MANIFEST, null, 2) + '\n');
  for (const [rel, text] of Object.entries(files)) write(dir, rel, text);
  git(dir, 'init', '-q');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');
  return dir;
}

function npmLint(dir: string) {
  return spawnSync('npm', ['run', '--silent', 'lint'], { cwd: dir, encoding: 'utf8' });
}

/** Runs the placement pass the way 99-finalize.sh does: lib.sh's place_lint_rules. */
function place(dir: string, linter: 'oxlint' | 'eslint', stack = 'react-spa') {
  const script = [
    `. "${REPO}/setup.d/lib.sh"`,
    `PROJECT_ROOT="${dir}"; PKG_ROOT="${REPO}"; STACK=${stack}; LINTER_SLOT=${linter}`,
    'place_lint_rules',
    'printf "NW:%s\\n" "${NOT_WIRED[@]-}"',
    'printf "EX:%s\\n" "${PLACE_EXTRA[@]-}"',
    'echo "LINT_OK=${PLACE_LINT_OK:-}"',
  ].join('\n');
  const r = spawnSync('bash', ['-c', script], { cwd: dir, encoding: 'utf8', env: { ...process.env, AIF_STRICT_RUNTIME: '' } });
  return { out: r.stdout + r.stderr, rc: r.status };
}

/** The rule table's rows, by column name (the header line itself is left out). */
type Row = { rule: string; principle: string; home: string; status: string; reason: string; proof: string; reached: string };
function rows(out: string): Row[] {
  return out
    .split('\n')
    .filter((l) => l.startsWith('| ') && !l.startsWith('| rule |'))
    .map((l) => {
      const [rule, principle, home, status, reason, proof, reached] = l.slice(2, -2).split(' | ');
      return { rule, principle, home, status, reason, proof, reached };
    });
}
const rowOf = (out: string, rule: string) => rows(out).find((r) => r.rule === rule);
const table = (dir: string) => spawnSync('node', ['scripts/prove-rules.mjs'], { cwd: dir, encoding: 'utf8' });
const PROVED = /^bad→exit [1-9]\d*, its own diagnostic · good→exit 0, clean$/;

/** The project-checks record 99-finalize.sh writes, with the lines the placement and research passes add. */
function record(dir: string, o: { stack?: string; linter?: string; extra?: string[]; armed?: string[]; notArmed?: string[] } = {}) {
  write(dir, '.ai-factory/tool-decisions.md', [
    '# Tool decisions',
    '',
    '<!-- aif:project-checks:begin -->',
    '### How this project checks itself (recorded by install.sh)',
    `stack: ${o.stack ?? 'react-spa'}`,
    `linter: ${o.linter ?? 'oxlint'}`,
    'formatter: none',
    ...(o.extra ?? []),
    'armed:',
    ...(o.armed ?? ['npm run lint']).map((c) => `- ${c}`),
    'not-armed:',
    ...(o.notArmed ?? []).map((c) => `- ${c}`),
    '<!-- aif:project-checks:end -->',
    '',
  ].join('\n'));
}
/** The channel the shipped templates give the lint: husky's pre-commit runs lint-staged, which runs it. */
function preCommit(dir: string) {
  write(dir, '.husky/pre-commit', 'npx lint-staged\n');
  write(dir, '.lintstagedrc.json', JSON.stringify({ '*.{ts,tsx}': ["bash scripts/run-armed.sh --if-armed 'npm run lint' oxlint"] }) + '\n');
}
const entry = (id: string, principle?: string) => ({
  id,
  summary: 'a practice',
  bestPractices: [],
  antiPatterns: [],
  provenance: [],
  extras: principle ? { principle } : {},
});
function baseCore(dir: string, edit: (text: string) => string = (t) => t) {
  write(dir, '.claude/skills/getff/references/base-core.md', edit(readFileSync(join(REPO, 'skills/getff/references/base-core.md'), 'utf8')));
}

const cfgOf = (dir: string) => JSON.parse(readFileSync(join(dir, '.oxlintrc.json'), 'utf8')) as Json & { overrides?: Override[] };
const owned = (c: { overrides?: Override[] }) => (c.overrides ?? []).filter((o) => o.files.includes(OWNED));
const exempt = (c: { overrides?: Override[] }) => (c.overrides ?? []).filter((o) => o.files.includes(EXEMPT));

let mod: ProveRules;
beforeAll(async () => {
  // Never a silent skip: without P4's oxlint the proof cannot run, and that is a red test.
  expect(existsSync(OXLINT), `oxlint missing at ${OXLINT} — run npm ci --prefix packages/core`).toBe(true);
  mod = (await import(pathToFileURL(SCRIPT).href)) as ProveRules;
});

// ── T-C1 ────────────────────────────────────────────────────────────────────────────────────────────
describe('placement on an oxlint project whose lint is green (T-C1)', () => {
  it('switches on the preset rules with their globs, the H8 built-ins and the tagged carriers; lint stays green', () => {
    const dir = oxProject({
      'src/App.tsx': GOOD_APP,
      'src/api/client.ts': 'export function read(s: { safeParse(x: unknown): unknown }, x: unknown) {\n  return s.safeParse(x);\n}\n',
    });
    const { out } = place(dir, 'oxlint');
    const c = cfgOf(dir);
    const byRule = (r: string) => owned(c).find((o) => r in o.rules);
    expect(byRule('rules-as-tests/no-unsafe-zod-parse')?.files).toContain('**/api/**/*.{ts,tsx}');
    expect(byRule('rules-as-tests/require-error-boundary')?.files).toContain('src/App.{tsx,jsx}');
    expect(byRule('no-throw-literal')?.files).toEqual(['**/*', OWNED]);
    expect(byRule('no-empty')?.files).toEqual(['**/*', OWNED]);
    expect(byRule('rules-as-tests/no-direct-time-randomness')).toBeUndefined(); // opt-in (AIF_STRICT_RUNTIME)
    const carrier = (c.rules as Json)[CARRIER] as [string, ...Array<{ message: string }>];
    expect(carrier[0]).toBe('error');
    expect(carrier.slice(1).map((e) => e.message.slice(0, 11))).toEqual(['[getff:G1] ', '[getff:G2] ']);
    expect(exempt(c)).toEqual([]);
    expect(npmLint(dir).status).toBe(0);
    expect(out).toContain('LINT_OK=1');
  });

  it('a placement that takes every rule back never claims the lint runs with them switched on', () => {
    const dir = oxProject({ 'src/App.tsx': GOOD_APP });
    // The project's oxlint gives up (exit 2, no report) on any config holding getff's marked entries.
    rmSync(join(dir, 'node_modules/.bin/oxlint'));
    write(dir, 'node_modules/.bin/oxlint', `#!/bin/sh\nif grep -q __getff_proof__ .oxlintrc.json; then echo boom >&2; exit 2; fi\nexec "${OXLINT}" "$@"\n`);
    spawnSync('chmod', ['+x', join(dir, 'node_modules/.bin/oxlint')]);
    const { out } = place(dir, 'oxlint');
    expect(out).toContain("EX:rule-not-placed: * — your lint exits 2 once getff's rules are on, with no report getff can read: boom");
    expect(readFileSync(join(dir, '.oxlintrc.json'), 'utf8')).not.toContain('__getff_proof__');
    expect(out).toContain('LINT_OK=\n');
  });

  it('a later pass on a red lint says the rules an earlier pass placed stay on, and leaves them as they were', () => {
    const dir = oxProject({ 'src/App.tsx': GOOD_APP });
    place(dir, 'oxlint');
    const placed = readFileSync(join(dir, '.oxlintrc.json'), 'utf8');
    write(dir, 'src/new.ts', "export function h() {\n  throw 'new';\n}\n");
    const { out } = place(dir, 'oxlint');
    expect(readFileSync(join(dir, '.oxlintrc.json'), 'utf8')).toBe(placed);
    expect(out).toContain("EX:rule-not-placed: * — not placed again: your lint exits 1 as it stands; the rules an earlier install placed stay on, as they were");
    expect(out).toContain('LINT_OK=\n');
  });

  it('a lint that is red before anything is switched on gets no rule written (paired negative)', () => {
    const cfg = { ...OX_CFG, rules: { ...(OX_CFG.rules as Json), 'no-debugger': 'error' } };
    const dir = oxProject({ 'src/App.tsx': GOOD_APP, 'src/x.ts': 'export function f() {\n  debugger;\n}\n' }, { cfg });
    const before = readFileSync(join(dir, '.oxlintrc.json'), 'utf8');
    const { out } = place(dir, 'oxlint');
    expect(readFileSync(join(dir, '.oxlintrc.json'), 'utf8')).toBe(before);
    expect(out).toMatch(/NW:getff's lint rules in \.oxlintrc\.json — not switched on: your lint exits 1 before getff switches any rule on/);
    // The record carries it too, so the rule table names the reason on every rule's row.
    expect(out).toContain('EX:rule-not-placed: * — not switched on: your lint exits 1 before getff switches any rule on\n');
    expect(out).toContain('LINT_OK=\n');
  });
});

// ── T-C2 ────────────────────────────────────────────────────────────────────────────────────────────
describe('existing violations become per-file exemptions (T-C2)', () => {
  const files = {
    'src/App.tsx': BAD_APP,
    'src/old.ts': "export function f() {\n  throw 'old';\n}\n",
    'src/[id]/page.ts': "export function g() {\n  throw 'route';\n}\n",
    'src/legacy.ts': 'declare const ReactDOM: any, app: any, el: any;\nReactDOM.render(app, el);\n',
  };

  it('lists exactly the hitting files, keeps the other carriers on them, and the lint exits 0', () => {
    const dir = oxProject(files);
    place(dir, 'oxlint');
    const c = cfgOf(dir);
    const ex = exempt(c);
    const filesOf = (rule: string) => ex.filter((o) => rule in o.rules).flatMap((o) => o.files.filter((f) => f !== EXEMPT)).sort();
    expect(filesOf('rules-as-tests/require-error-boundary')).toEqual(['src/App.tsx']);
    // `[id]` is a glob character class to oxlint; the exemption escapes it (measured: unescaped it matches nothing).
    expect(filesOf('no-throw-literal')).toEqual(['src/\\[id\\]/page.ts', 'src/old.ts']);
    const legacy = ex.find((o) => o.files.includes('src/legacy.ts'))!;
    const carrier = legacy.rules[CARRIER] as [string, ...Array<{ message: string }>];
    expect(carrier.slice(1).map((e) => e.message.slice(0, 11))).toEqual(['[getff:G2] ']); // G1 exempt, G2 still on
    expect(c.overrides!.at(-1)!.files).toContain(EXEMPT); // after getff's own entries, so they win
    expect(npmLint(dir).status).toBe(0);
  });

  it('a NEW violation still fails the lint, also of a carrier still on in an exempted file (paired negative)', () => {
    const dir = oxProject(files);
    const { out } = place(dir, 'oxlint');
    // The record says what an exemption does: a per-file `off` takes new hits of that rule in that file too.
    expect(out).toContain("EX:lint-baseline: .oxlintrc.json — getff's rules are off per file for 4 existing violations in 4 files (entries marked getff); new ones block in every other file");
    expect(out).toContain('existing violations in 4 files exempted per file — new ones fail in every other file');
    write(dir, 'src/old.ts', "export function f() {\n  throw 'old';\n}\nexport function f2() {\n  throw 'again';\n}\n");
    expect(npmLint(dir).status).toBe(0); // the same rule in the same file: exempted, as the record says
    write(dir, 'src/new.ts', "export function h() {\n  throw 'new';\n}\n");
    expect(npmLint(dir).status).not.toBe(0);
    // The same placed project again, the new file gone: the lint is back to 0, so the next red is the carrier's.
    rmSync(join(dir, 'src/new.ts'));
    expect(npmLint(dir).status).toBe(0);
    write(dir, 'src/legacy.ts', files['src/legacy.ts'] + 'declare const Button: any;\nButton.defaultProps = {};\n');
    expect(npmLint(dir).status).not.toBe(0);
  });
});

// ── T-C4 ────────────────────────────────────────────────────────────────────────────────────────────
describe('the batch proof through the project command (T-C4)', () => {
  it('each placed rule fails its bad example with its own diagnostic and passes its good one; no sample is left', () => {
    const dir = oxProject({ 'src/App.tsx': BAD_APP, 'src/old.ts': "export function f() {\n  throw 'old';\n}\n" });
    place(dir, 'oxlint');
    const r = spawnSync('node', ['scripts/prove-rules.mjs', '--prove'], { cwd: dir, encoding: 'utf8' });
    for (const id of ['rules-as-tests/no-unsafe-zod-parse', 'rules-as-tests/require-error-boundary', 'no-throw-literal', 'no-empty', 'getff:G1', 'getff:G2']) {
      expect(rowOf(r.stdout, id)?.proof, `${id}\n${r.stdout}`).toMatch(PROVED);
    }
    expect(r.stdout).toMatch(/bad batch → exit [1-9]\d* · good batch → exit 0 \(npm run lint -- -f json /);
    expect(r.status).toBe(0);
    expect(spawnSync('find', [dir, '-name', '__getff_proof__', '-not', '-path', '*/node_modules/*'], { encoding: 'utf8' }).stdout).toBe('');
  });

  // P6 cell rerun 2026-09-30: a researched JSX rule's samples were written as `.ts`, oxlint failed to parse them
  // («Expected `>` but found `Identifier`»), the row read not_wired and the good batch exited 1.
  it('a generated rule on JSX gets .tsx samples: proven, and the good batch still exits 0', () => {
    const dir = oxProject({ 'src/App.tsx': GOOD_APP });
    const g3 = {
      title: 'Do not use the array index as a list key',
      stack: ['react-spa'],
      check: {
        type: 'declarative',
        presence: 'forbid',
        selector: "JSXAttribute[name.name='key'] > JSXExpressionContainer > Identifier[name='index']",
        message: 'Use a stable id from the data as key, not the array index.',
        engine: 'eslint-restricted',
      },
      examples: { bad: '<li key={index} />', good: '<li key={id} />' },
      research: { entryId: 'react-no-index-as-key' },
    };
    write(dir, '.ai-factory/synthesizer-output/rules-manifest-additions.json', JSON.stringify({ ...MANIFEST, G3: g3 }, null, 2) + '\n');
    place(dir, 'oxlint');
    const r = spawnSync('node', ['scripts/prove-rules.mjs', '--prove'], { cwd: dir, encoding: 'utf8' });
    expect(rowOf(r.stdout, 'getff:G3')?.proof, r.stdout).toMatch(PROVED);
    expect(r.stdout).toMatch(/good batch → exit 0 /);
    expect(r.status).toBe(0);
  });

  it('a rule switched off in the config is never reported as proven (paired negative)', () => {
    const dir = oxProject({ 'src/App.tsx': GOOD_APP });
    place(dir, 'oxlint');
    const c = cfgOf(dir);
    for (const o of owned(c)) if ('no-empty' in o.rules) o.rules['no-empty'] = 'off';
    writeFileSync(join(dir, '.oxlintrc.json'), JSON.stringify(c, null, 2) + '\n');
    const r = spawnSync('node', ['scripts/prove-rules.mjs', '--prove'], { cwd: dir, encoding: 'utf8' });
    expect(rowOf(r.stdout, 'no-empty')).toMatchObject({ status: 'not_wired', reason: 'switched off in the config', proof: '—' });
    expect(r.status).not.toBe(0);
  });

  it('an oxlint config with comments (oxlint allows them) gives a table that says why, never a stack trace', () => {
    const dir = oxProject({ 'src/App.tsx': GOOD_APP }, { cfgText: '{\n  // the project\'s own note\n  "plugins": ["react"]\n}\n' });
    record(dir);
    const r = table(dir);
    expect(r.stderr).not.toContain('SyntaxError');
    expect(rowOf(r.stdout, 'no-throw-literal')?.reason, r.stdout).toBe('.oxlintrc.json is not plain JSON (oxlint allows comments; getff reads and edits only plain JSON), so getff placed no rule in it');
  });

  it('a rule that stays silent on its bad example is not_wired, never proven (paired negative)', () => {
    const dir = oxProject({ 'src/App.tsx': GOOD_APP });
    place(dir, 'oxlint');
    const c = cfgOf(dir);
    const top = c.rules as Json;
    top[CARRIER] = ['error', { selector: 'DebuggerStatement', message: '[getff:G1] never in the sample' }];
    writeFileSync(join(dir, '.oxlintrc.json'), JSON.stringify(c, null, 2) + '\n');
    const r = spawnSync('node', ['scripts/prove-rules.mjs', '--prove'], { cwd: dir, encoding: 'utf8' });
    const g1 = rowOf(r.stdout, 'getff:G1');
    expect(g1?.status).toBe('not_wired');
    expect(g1?.reason).toMatch(/^no diagnostic on the bad example/);
    expect(g1?.proof).toMatch(/^bad→exit [1-9]\d*, no diagnostic of this rule · good→exit 0$/);
    expect(r.status).not.toBe(0);
  });
});

// ── T-C6 ────────────────────────────────────────────────────────────────────────────────────────────
describe('placement is additive and removable in one command (T-C6)', () => {
  const projectCfg = {
    ...OX_CFG,
    rules: { 'react/rules-of-hooks': 'error', 'no-empty': 'off' },
    overrides: [{ files: ['scripts/**'], rules: { 'no-console': 'off' } }],
  };

  it("keeps every key of the project's own, never sets a built-in the project sets, and --remove restores the bytes", () => {
    const dir = oxProject({ 'src/App.tsx': GOOD_APP }, { cfg: projectCfg });
    const before = readFileSync(join(dir, '.oxlintrc.json'), 'utf8');
    place(dir, 'oxlint');
    const c = cfgOf(dir);
    expect(c.$schema).toBe(projectCfg.$schema);
    expect(c.plugins).toEqual(projectCfg.plugins);
    expect(c.jsPlugins).toEqual(projectCfg.jsPlugins);
    const { [CARRIER]: _carrier, ...projectRules } = c.rules as Json;
    expect(projectRules).toEqual(projectCfg.rules);
    expect(c.overrides!.at(-1)).toEqual(projectCfg.overrides[0]); // getff's entries go before it: insertions only
    const builtins = owned(c).find((o) => o.files[0] === '**/*')!;
    expect(builtins.rules).toEqual({ 'no-throw-literal': 'error' }); // no-empty is the project's: not set
    const r = spawnSync('node', ['scripts/prove-rules.mjs', '--remove'], { cwd: dir, encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(readFileSync(join(dir, '.oxlintrc.json'), 'utf8')).toBe(before);
  });

  // create-vite's layout: a one-line array, and a rule of getff's plugin the project set itself.
  const VITE_TEXT = [
    '{',
    '  "$schema": "./node_modules/oxlint/configuration_schema.json",',
    '  "plugins": ["react", "typescript", "oxc"],',
    '  "jsPlugins": [{ "name": "rules-as-tests", "specifier": "./eslint-rules-local/index.mjs" }],',
    '  "rules": {',
    '    "react/rules-of-hooks": "error",',
    '    "rules-as-tests/no-unsafe-zod-parse": "warn"',
    '  }',
    '}',
    '',
  ].join('\n');
  /** Every line of `before` is still in `after`, whole and in order — the own-config cell's «insertions only». */
  const onlyInserted = (before: string, after: string) => {
    const want = before.split('\n');
    let i = 0;
    for (const l of after.split('\n')) if (i < want.length && l === want[i]) i++;
    return i === want.length;
  };

  it("only inserts lines into the project's layout, and --remove gives the bytes back with the project's own getff-plugin setting", () => {
    const dir = oxProject({ 'src/App.tsx': GOOD_APP, 'src/old.ts': "export function f() {\n  throw 'old';\n}\n" }, { cfgText: VITE_TEXT });
    const { out } = place(dir, 'oxlint');
    const placed = readFileSync(join(dir, '.oxlintrc.json'), 'utf8');
    expect(out).toContain('LINT_OK=1');
    expect(exempt(cfgOf(dir)).length, placed).toBeGreaterThan(0);
    expect(onlyInserted(VITE_TEXT, placed), placed).toBe(true);
    expect((cfgOf(dir).rules as Json)['rules-as-tests/no-unsafe-zod-parse']).toBe('warn');
    const r = spawnSync('node', ['scripts/prove-rules.mjs', '--remove'], { cwd: dir, encoding: 'utf8' });
    expect(r.stdout).not.toContain('rule rules-as-tests/no-unsafe-zod-parse');
    expect(readFileSync(join(dir, '.oxlintrc.json'), 'utf8')).toBe(VITE_TEXT);
  });

  it('--remove on a project that never had getff entries leaves the file byte-identical (paired negative)', () => {
    const text = '{\n    "plugins": ["react"],\n    "rules": { "no-empty": "error" }\n}\n';
    const dir = oxProject({}, { cfgText: text });
    const r = spawnSync('node', ['scripts/prove-rules.mjs', '--remove'], { cwd: dir, encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(readFileSync(join(dir, '.oxlintrc.json'), 'utf8')).toBe(text);
    expect(r.stdout).toContain('nothing of getff');
  });

  it('a verify run that takes every rule back leaves the bytes the project had', () => {
    const dir = oxProject({ 'src/App.tsx': GOOD_APP }, { cfgText: VITE_TEXT });
    let n = 0;
    const lint: LintFn = (root) => {
      n++;
      if (n === 1) return { rc: 0, raw: '', diags: [] };
      // The verify run: every rule getff switched on still reports.
      const text = readFileSync(join(root, '.oxlintrc.json'), 'utf8');
      const c = JSON.parse(text) as { overrides?: Override[] };
      const carriers = [...text.matchAll(/\[getff:([^\]]+)\]/g)].map((m) => `getff:${m[1]}`);
      const ids = [...owned(c).flatMap((o) => Object.keys(o.rules ?? {})), ...carriers];
      return { rc: 1, raw: '', diags: ids.map((id) => ({ id, file: 'src/App.tsx', message: 'still', error: true })) };
    };
    const res = mod.placeOxlint(dir, { stack: 'react-spa', lint });
    expect(res.placed).toEqual([]);
    expect(readFileSync(join(dir, '.oxlintrc.json'), 'utf8')).toBe(VITE_TEXT);
  });

  // getff put nothing into this `rules` (no generated rule): it is the project's, empty or not. (One getff filled
  // and emptied again cannot be told from one getff made — that case is removed with getff's entries.)
  it("--remove keeps the project's own empty `rules`", () => {
    const text = '{\n  "plugins": ["react"],\n  "jsPlugins": [{ "name": "rules-as-tests", "specifier": "./eslint-rules-local/index.mjs" }],\n  "rules": {},\n  "overrides": [{ "files": ["scripts/**"], "rules": { "no-console": "off" } }]\n}\n';
    const dir = oxProject({ 'src/App.tsx': GOOD_APP }, { cfgText: text });
    rmSync(join(dir, '.ai-factory/synthesizer-output/rules-manifest-additions.json'));
    place(dir, 'oxlint');
    expect(readFileSync(join(dir, '.oxlintrc.json'), 'utf8')).toContain('__getff_proof__');
    spawnSync('node', ['scripts/prove-rules.mjs', '--remove'], { cwd: dir, encoding: 'utf8' });
    expect(readFileSync(join(dir, '.oxlintrc.json'), 'utf8')).toBe(text);
  });

  it('a CRLF config gets CRLF lines only, and --remove gives its bytes back', () => {
    const crlf = VITE_TEXT.replace(/\n/g, '\r\n');
    const dir = oxProject({ 'src/App.tsx': GOOD_APP }, { cfgText: crlf });
    place(dir, 'oxlint');
    const placed = readFileSync(join(dir, '.oxlintrc.json'), 'utf8');
    expect(placed).toContain('__getff_proof__');
    expect(placed.replace(/\r\n/g, '')).not.toContain('\n');
    spawnSync('node', ['scripts/prove-rules.mjs', '--remove'], { cwd: dir, encoding: 'utf8' });
    expect(readFileSync(join(dir, '.oxlintrc.json'), 'utf8')).toBe(crlf);
  });
});

// ── T-C7 ────────────────────────────────────────────────────────────────────────────────────────────
describe('a rule still red after the baseline is removed alone, in one pass (T-C7)', () => {
  it('removes only the still-red rule and runs the lint once after the baseline', () => {
    const dir = oxProject({ 'src/App.tsx': GOOD_APP, 'src/a.ts': 'export {};\n', 'src/b.ts': 'export {};\n' });
    place(dir, 'oxlint'); // the real pass first: jsPlugins + owned entries in place
    const calls: string[] = [];
    const lint: LintFn = (_root, opts) => {
      calls.push(JSON.stringify(opts));
      // 1st call = the baseline discovery: two rules hit; 2nd call = after the exemptions: no-empty still reports.
      return calls.length === 1
        ? { rc: 1, raw: '', diags: [
            { id: 'no-throw-literal', file: 'src/a.ts', message: 'Expected an error object to be thrown', error: true },
            { id: 'no-empty', file: 'src/b.ts', message: 'Unexpected empty block statements', error: true },
          ] }
        : { rc: 1, raw: '', diags: [{ id: 'no-empty', file: 'src/b.ts', message: 'Unexpected empty block statements', error: true }] };
    };
    const res = mod.placeOxlint(dir, { stack: 'react-spa', lint });
    expect(calls).toHaveLength(2);
    expect(res.notPlaced).toContainEqual({ rule: 'no-empty', reason: 'still red after the baseline: src/b.ts: Unexpected empty block statements' });
    expect(res.placed).toContain('no-throw-literal');
    expect(res.placed).not.toContain('no-empty');
    const c = cfgOf(dir);
    expect(JSON.stringify(c.overrides)).not.toContain('"no-empty"');
    expect(JSON.stringify(exempt(c))).toContain('"no-throw-literal"');
    expect(res.lintRc).toBeNull(); // a rule was removed after the one verify run: green is not claimed
  });
});

// ── T-C8 ────────────────────────────────────────────────────────────────────────────────────────────
describe('proof samples never reach a commit (T-C8)', () => {
  it('removes a stale sample dir first, excludes the dir once, and git status never shows a sample', () => {
    const dir = oxProject({ 'src/App.tsx': GOOD_APP });
    place(dir, 'oxlint');
    write(dir, 'src/__getff_proof__/stale.bad.ts', "throw 'left by a killed run';\n");
    const seen: string[] = [];
    const lint: LintFn = (root, opts) => {
      seen.push(git(root, 'status', '--porcelain', '--untracked-files=all').stdout);
      expect(existsSync(join(root, 'src/__getff_proof__/stale.bad.ts'))).toBe(false);
      return mod.realLint(root, opts);
    };
    mod.prove(dir, { lint });
    mod.prove(dir, { lint });
    expect(seen.length).toBeGreaterThan(0);
    for (const s of seen) expect(s).not.toContain('__getff_proof__');
    const exclude = readFileSync(join(dir, git(dir, 'rev-parse', '--git-path', 'info/exclude').stdout.trim()), 'utf8');
    expect(exclude.split('\n').filter((l) => l === '__getff_proof__/')).toHaveLength(1);
    expect(existsSync(join(dir, 'src/__getff_proof__'))).toBe(false);
  });

  it('a chain lint script is proved through the linter binary and says so — never proven by the script (paired negative)', () => {
    const dir = oxProject({ 'src/App.tsx': GOOD_APP }, { lint: 'oxlint && echo done' });
    place(dir, 'oxlint');
    record(dir);
    preCommit(dir);
    const r = spawnSync('node', ['scripts/prove-rules.mjs', '--prove'], { cwd: dir, encoding: 'utf8' });
    const row = rowOf(r.stdout, 'no-throw-literal');
    expect(row?.status).toBe('partial');
    expect(row?.reason).toContain('proved through the linter binary, the lint script is a chain: oxlint && echo done');
  });
});

// ── T-C5 ────────────────────────────────────────────────────────────────────────────────────────────
// `oneLine`: the elements on the default export's own line, the way getff's wirer writes into a project's
// one-line `export default tseslint.config(a, b);`. `constLine`: the array on a `const` line, exported apart.
function eslintProject(files: Record<string, string>, projectRules: Json = {}, layout: 'lines' | 'oneLine' | 'constLine' = 'lines'): string {
  const dir = mkdtempSync(join(tmpdir(), 'prove-es-'));
  write(dir, 'package.json', JSON.stringify({ name: 'fx', private: true, type: 'module', scripts: { lint: 'eslint .' } }, null, 2) + '\n');
  symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'));
  for (const f of readdirSync(RULES_DIR).filter((f) => f.endsWith('.mjs'))) {
    mkdirSync(join(dir, 'eslint-rules-local'), { recursive: true });
    copyFileSync(join(RULES_DIR, f), join(dir, 'eslint-rules-local', f));
  }
  write(dir, 'eslint-rules-local/index.mjs', barrel());
  // The project's own config, with the element getff's Q4.7 insertion adds (R2 on the boundary globs).
  const elements = [
    `{ ignores: ['node_modules/**', 'eslint-rules-local/**', 'scripts/**'] }`,
    `{ files: ['**/*.ts'], languageOptions: { parser: tsParser }, rules: ${JSON.stringify(projectRules)} }`,
    `{ files: ['**/api/**/*.ts'], languageOptions: { parser: tsParser }, plugins: { 'rules-as-tests': customRules }, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }`,
  ];
  const body = {
    lines: ['export default [', ...elements.map((e) => `  ${e},`), '];'],
    oneLine: [`export default [${elements.join(', ')}];`],
    constLine: [`const config = [${elements.join(', ')}];`, 'export default config;'],
  }[layout];
  write(dir, 'eslint.config.mjs', [
    "import tsParser from '@typescript-eslint/parser';",
    "import customRules from './eslint-rules-local/index.mjs';",
    '',
    ...body,
    '',
  ].join('\n'));
  shipScripts(dir);
  for (const [rel, text] of Object.entries(files)) write(dir, rel, text);
  git(dir, 'init', '-q');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');
  return dir;
}
const UNSAFE = "import { z } from 'zod';\nexport const read = (x: unknown) => z.string().parse(x);\n";
const SAFE = "import { z } from 'zod';\nexport const read = (x: unknown) => z.string().safeParse(x);\n";

describe("ESLint, the project's own config (T-C5)", () => {
  it("red only from getff's rules → a marked per-file getff element; the lint exits 0 and stays 0 after a fix", () => {
    const dir = eslintProject({ 'src/api/old.ts': UNSAFE });
    expect(npmLint(dir).status).not.toBe(0);
    const { out } = place(dir, 'eslint');
    const text = readFileSync(join(dir, 'eslint.config.mjs'), 'utf8');
    expect(text).toMatch(/\/\/ getff:exempt:begin[^\n]*\n\s*\{ files: \['src\/api\/old\.ts'\], rules: \{ 'rules-as-tests\/no-unsafe-zod-parse': 'off' \} \},\n\s*\/\/ getff:exempt:end/);
    expect(npmLint(dir).status).toBe(0);
    write(dir, 'src/api/old.ts', SAFE); // fixing the old hit must not turn the project's lint red (F24)
    expect(npmLint(dir).status).toBe(0);
    expect(out).toContain('LINT_OK=1');
    const r = spawnSync('node', ['scripts/prove-rules.mjs', '--remove'], { cwd: dir, encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(readFileSync(join(dir, 'eslint.config.mjs'), 'utf8')).not.toContain('getff:exempt');
  });

  it("a one-line default export (the shape getff's wirer leaves) takes the per-file element too, and gives it back", () => {
    const dir = eslintProject({ 'src/api/old.ts': UNSAFE }, {}, 'oneLine');
    const before = readFileSync(join(dir, 'eslint.config.mjs'), 'utf8');
    const { out } = place(dir, 'eslint');
    expect(out).toContain('LINT_OK=1');
    expect(out).not.toContain('rule-not-placed');
    expect(readFileSync(join(dir, 'eslint.config.mjs'), 'utf8')).toMatch(/getff:exempt:begin[^\n]*\n\s*\{ files: \['src\/api\/old\.ts'\]/);
    expect(npmLint(dir).status).toBe(0);
    write(dir, 'src/api/new.ts', UNSAFE); // new code still blocks
    expect(npmLint(dir).status).not.toBe(0);
    rmSync(join(dir, 'src/api/new.ts'));
    expect(spawnSync('node', ['scripts/prove-rules.mjs', '--remove'], { cwd: dir, encoding: 'utf8' }).status).toBe(0);
    const removed = readFileSync(join(dir, 'eslint.config.mjs'), 'utf8');
    expect(removed).not.toContain('getff:exempt');
    expect(removed.replace(/\s+/g, '')).toBe(before.replace(/\s+/g, '').replace(/\];$/, ',];')); // only a comma and line breaks stay
    expect(npmLint(dir).status).not.toBe(0); // the old hit is live again
    // Paired negative: the array on a `const` line with the export apart — no line getff can extend, nothing written.
    const apart = eslintProject({ 'src/api/old.ts': UNSAFE }, {}, 'constLine');
    const kept = readFileSync(join(apart, 'eslint.config.mjs'), 'utf8');
    expect(place(apart, 'eslint').out).toContain("EX:rule-not-placed: * — existing violations not exempted: getff found no closing `];` / `);` line in eslint.config.mjs to put its block before");
    expect(readFileSync(join(apart, 'eslint.config.mjs'), 'utf8')).toBe(kept);
  });

  it('a last element with a trailing `//` comment takes its comma before the comment', () => {
    const dir = eslintProject({ 'src/api/old.ts': UNSAFE });
    const cfg = join(dir, 'eslint.config.mjs');
    writeFileSync(cfg, readFileSync(cfg, 'utf8').replace(/('error' \} \}),\n\];/, "$1 // the boundary rule, no trailing comma\n];"));
    expect(readFileSync(cfg, 'utf8')).toContain("} } // the boundary rule, no trailing comma\n];");
    const { out } = place(dir, 'eslint');
    expect(out).toContain('LINT_OK=1');
    expect(readFileSync(cfg, 'utf8')).toContain("} }, // the boundary rule, no trailing comma\n");
    expect(npmLint(dir).status).toBe(0);
  });

  it('a built-in the config switches on for every .ts file is found and proven (R2: a `**/*` glob once gave a `.*` sample)', () => {
    const dir = eslintProject({ 'src/api/ok.ts': SAFE }, { 'no-empty': 'error', 'no-throw-literal': 'error' });
    record(dir, { linter: 'eslint' });
    preCommit(dir);
    const out = table(dir).stdout;
    expect(rowOf(out, 'no-empty')?.proof, out).toMatch(PROVED);
    expect(rowOf(out, 'no-throw-literal')?.proof, out).toMatch(PROVED);
    // Paired negative: a config that does not switch it on still says so.
    const off = eslintProject({ 'src/api/ok.ts': SAFE });
    record(off, { linter: 'eslint' });
    expect(rowOf(table(off).stdout, 'no-empty')).toMatchObject({ status: 'not_wired', reason: 'not in the eslint config' });
  });

  it('an exempted generated rule switches every generated rule off in that file, and the table says so for each', () => {
    // ESLint reports every generated rule under the one carrier setting, so the per-file `off` covers them all.
    const entries = Object.values(MANIFEST).map((m) => ({ selector: m.check.selector, message: m.check.message }));
    const dir = eslintProject({ 'src/api/legacy.ts': 'declare const ReactDOM: any, app: any, el: any;\nReactDOM.render(app, el);\n' }, { [CARRIER]: ['error', ...entries] });
    write(dir, '.ai-factory/synthesizer-output/rules-manifest-additions.json', JSON.stringify(MANIFEST, null, 2) + '\n');
    const { out } = place(dir, 'eslint');
    expect(readFileSync(join(dir, 'eslint.config.mjs'), 'utf8')).toContain(`{ files: ['src/api/legacy.ts'], rules: { '${CARRIER}': 'off' } },`);
    record(dir, { linter: 'eslint', extra: out.split('\n').filter((l) => l.startsWith('EX:') && l.length > 3).map((l) => l.slice(3)) });
    preCommit(dir);
    const t = table(dir).stdout;
    for (const id of ['getff:G1', 'getff:G2']) {
      expect(rowOf(t, id)?.status, t).toBe('partial');
      expect(rowOf(t, id)?.reason, t).toContain('in 1 file an exempted generated rule switches every generated rule off');
    }
    expect(t).toContain(`existing violation: ${CARRIER} in src/api/legacy.ts — every generated rule is off in this file`);
    // Paired negative: a generated rule there still fails in any other file.
    write(dir, 'src/api/new.ts', 'declare const Button: any;\nButton.defaultProps = {};\n');
    expect(npmLint(dir).status).not.toBe(0);
  });

  it("red from a rule of the project's own → nothing is exempted (paired negative)", () => {
    const dir = eslintProject({ 'src/api/old.ts': UNSAFE, 'src/x.ts': 'export function f() {\n  debugger;\n}\n' }, { 'no-debugger': 'error' });
    const before = readFileSync(join(dir, 'eslint.config.mjs'), 'utf8');
    const { out } = place(dir, 'eslint');
    expect(readFileSync(join(dir, 'eslint.config.mjs'), 'utf8')).toBe(before);
    expect(out).toMatch(/NW:getff's lint rules in eslint\.config\.mjs — existing violations not exempted: your lint exits 1 on its own rules \(no-debugger\)/);
    expect(out).toContain('EX:rule-not-placed: * — existing violations not exempted: your lint exits 1 on its own rules (no-debugger)');
  });
});

// ── T-B1 ────────────────────────────────────────────────────────────────────────────────────────────
describe('one rule table: every rule, its principle, home, status, proof and channel (T-B1)', () => {
  const PLAN = {
    framework: 'react',
    version: null,
    patterns: [
      entry('react19-no-reactdom-render', 'H7'),
      entry('react19-no-function-defaultprops'),
      entry('vite-env-via-import-meta', 'I4'),
      entry('react-keys-stable'),
    ],
    missing: [],
    drift: null,
  };
  const RESEARCH_LINES = [
    'research-dropped: vite-env-via-import-meta — FF2005: unknown allowlistKey: vite',
    'research-only: react-keys-stable',
  ];
  function tableProject(o: { extra?: string[]; armed?: string[]; notArmed?: string[]; channels?: boolean } = {}) {
    const dir = oxProject({
      'src/App.tsx': BAD_APP,
      'src/old.ts': "export function f() {\n  throw 'old';\n}\n",
      'src/api/client.ts': 'export function read(s: { safeParse(x: unknown): unknown }, x: unknown) {\n  return s.safeParse(x);\n}\n',
    });
    place(dir, 'oxlint');
    baseCore(dir);
    write(dir, '.ai-factory/rules-research/react-spa.research.json', JSON.stringify(PLAN, null, 2) + '\n');
    record(dir, { extra: o.extra ?? RESEARCH_LINES, armed: o.armed, notArmed: o.notArmed });
    if (o.channels !== false) preCommit(dir);
    return dir;
  }

  it('prints one row per rule with the principle filled, and lists every exempted violation by file', () => {
    const r = table(tableProject());
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(rowOf(r.stdout, 'no-empty')).toEqual({
      rule: 'no-empty',
      principle: 'H8',
      home: 'oxlint built-in no-empty',
      status: 'fires',
      reason: '—',
      proof: expect.stringMatching(PROVED),
      reached: 'pre-commit (lint-staged)',
    });
    expect(rowOf(r.stdout, 'rules-as-tests/no-unsafe-zod-parse')).toMatchObject({ principle: 'I1', status: 'fires' });
    expect(rowOf(r.stdout, 'getff:G1')).toMatchObject({
      principle: 'H7',
      home: 'oxlint jsPlugin rules-as-tests/restricted-syntax-audit-exempt [getff:G1]',
      status: 'fires',
    });
    const eb = rowOf(r.stdout, 'rules-as-tests/require-error-boundary')!;
    expect(eb).toMatchObject({ principle: 'H8', status: 'partial', proof: expect.stringMatching(PROVED) });
    expect(eb.reason).toBe("exempt 1 of 1 files the rule's globs match");
    expect(rowOf(r.stdout, 'no-throw-literal')?.reason).toMatch(/^exempt 1 of [1-9]\d* files the rule's globs match$/);
    const opt = rowOf(r.stdout, 'rules-as-tests/no-direct-time-randomness')!;
    expect(opt).toMatchObject({ principle: 'H5', home: '—', status: 'not_wired', proof: '—', reached: '—' });
    expect(opt.reason).toMatch(/^opt-in: /);
    expect(rowOf(r.stdout, 'rules-as-tests/require-otel-span')).toMatchObject({ principle: 'H9', status: 'not_wired' });
    expect(rowOf(r.stdout, 'vite-env-via-import-meta')).toMatchObject({
      principle: 'I4',
      status: 'not_wired',
      reason: 'research entry dropped: FF2005: unknown allowlistKey: vite',
    });
    expect(rowOf(r.stdout, 'react-keys-stable')).toMatchObject({ principle: 'stack docs', status: 'not_wired' });
    expect(rowOf(r.stdout, 'react-keys-stable')?.reason).toMatch(/^research only: /);
    // H7 is served by G1; I4's only research entry was dropped, so no rule serves it yet.
    const pending = rows(r.stdout).filter((x) => x.rule === '(none yet)');
    expect(pending).toEqual([{ rule: '(none yet)', principle: 'I4', home: '—', status: 'not_wired', reason: 'generated-pending: no generated rule serves I4 in this project', proof: '—', reached: '—' }]);
    expect(r.stdout).toContain('existing violation: rules-as-tests/require-error-boundary in src/App.tsx');
    expect(r.stdout).toContain('existing violation: no-throw-literal in src/old.ts');
    const ids = rows(r.stdout).map((x) => x.rule);
    expect(new Set(ids).size).toBe(ids.length); // one row per rule
  });

  it('a generated rule whose research entry names no principle reads «stack docs», never blank (paired negative)', () => {
    const r = table(tableProject());
    expect(rowOf(r.stdout, 'getff:G2')?.principle).toBe('stack docs');
    for (const x of rows(r.stdout)) expect(x.principle, x.rule).not.toBe('');
  });

  it('a base-core row with a status outside fires | partial | not_wired stops the table (paired negative)', () => {
    const dir = tableProject();
    baseCore(dir, (t) => t.replace(/^(\| H8 \|[^|]*\|[^|]*\| )`partial`/m, '$1`maybe`'));
    const r = table(dir);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('base-core.md row H8: status «maybe» is not one of fires | partial | not_wired');
    expect(rows(r.stdout)).toEqual([]);
  });

  it('a generated rule whose entry loses its principle link leaves that principle pending (paired negative)', () => {
    const dir = tableProject();
    const plan = { ...PLAN, patterns: PLAN.patterns.map((e) => (e.id === 'react19-no-reactdom-render' ? entry(e.id) : e)) };
    write(dir, '.ai-factory/rules-research/react-spa.research.json', JSON.stringify(plan, null, 2) + '\n');
    const r = table(dir);
    expect(rows(r.stdout).filter((x) => x.rule === '(none yet)').map((x) => x.principle)).toEqual(['H7', 'I4']);
    expect(rowOf(r.stdout, 'getff:G1')?.principle).toBe('stack docs');
  });

  it('armed only in this clone: partial, and the channel says so (paired negative)', () => {
    const dir = tableProject({ armed: [], notArmed: ['npm run lint # your own script: the install does not run it'] });
    writeFileSync(join(git(dir, 'rev-parse', '--absolute-git-dir').stdout.trim(), 'getff-armed.local'), 'npm run lint\n');
    const row = rowOf(table(dir).stdout, 'no-empty')!;
    expect(row.status).toBe('partial');
    expect(row.reason).toBe('npm run lint is armed in this clone only (.git/getff-armed.local) until the next commit folds it into the record');
    expect(row.reached).toBe('pre-commit (lint-staged) — this clone only until the next commit');
  });

  it('not armed, or no channel runs the lint: partial, never fires (paired negatives)', () => {
    const notArmed = rowOf(table(tableProject({ armed: [], notArmed: ['npm run lint # exits 1'] })).stdout, 'no-empty')!;
    expect(notArmed).toMatchObject({ status: 'partial', reason: 'npm run lint is not armed in the project-checks record' });
    const noChannel = rowOf(table(tableProject({ channels: false })).stdout, 'no-empty')!;
    expect(noChannel).toMatchObject({ status: 'partial', reason: 'no pre-commit, pre-push or CI step runs npm run lint', reached: '—' });
  });
});

// ── T-A5 ────────────────────────────────────────────────────────────────────────────────────────────
describe('stack generic: its research is listed, never silenced (T-A5)', () => {
  function genericProject(withResearch: boolean) {
    const dir = mkdtempSync(join(tmpdir(), 'prove-gen-'));
    write(dir, 'package.json', JSON.stringify({ name: 'fx', private: true }, null, 2) + '\n');
    shipScripts(dir);
    baseCore(dir);
    const reason = "stack generic: no rule generator lane for this project's toolchain";
    record(dir, { stack: 'generic', linter: 'none', armed: [], extra: withResearch ? [`research-only: go-errors-wrapped — ${reason}`] : [] });
    if (withResearch) write(dir, '.ai-factory/rules-research/generic.research.json', JSON.stringify({ framework: null, version: null, patterns: [entry('go-errors-wrapped', 'H8')], missing: [], drift: null }) + '\n');
    git(dir, 'init', '-q');
    return dir;
  }

  it('each research entry is a not_wired row with the generic reason', () => {
    const r = table(genericProject(true));
    expect(r.status, r.stderr).toBe(0);
    expect(rowOf(r.stdout, 'go-errors-wrapped')).toMatchObject({
      principle: 'H8',
      status: 'not_wired',
      reason: "research only: stack generic: no rule generator lane for this project's toolchain",
    });
  });

  it('no research file → one «not done» row (paired negative)', () => {
    const r = table(genericProject(false));
    const research = rows(r.stdout).filter((x) => x.rule === 'research');
    expect(research).toEqual([{ rule: 'research', principle: '—', home: '—', status: 'not_wired', reason: 'not done: no .ai-factory/rules-research/generic.research.json', proof: '—', reached: '—' }]);
  });
});

// ── T-D2 ────────────────────────────────────────────────────────────────────────────────────────────
// M2: a baseline of existing violations only ever shrinks. The probe (scripts/run-armed.sh, run by pre-push and
// `validate`) finds the findings fixed since, only while the armed `npm run lint` exits 0, and writes the result
// to a sidecar in the git dir — the tree stays clean. The shipped pre-commit's `--fold` applies it to the tracked
// baseline, in the working tree and the index, with the record's count line — the path P2's arm flip rides.
describe('the lint baseline shrinks as old findings are fixed, never grows (T-D2)', () => {
  const armedRun = (dir: string, ...args: string[]) =>
    spawnSync('bash', ['scripts/run-armed.sh', ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, GETFF_PROBE_TIMEOUT_S: '120' } });
  const indexed = (dir: string, rel: string) => git(dir, 'show', `:${rel}`).stdout;
  const committed = (dir: string, rel: string) => git(dir, 'show', `HEAD:${rel}`).stdout;
  const REC = '.ai-factory/tool-decisions.md';
  const baselineLine = (text: string) => text.split('\n').find((l) => l.startsWith('lint-baseline: '));
  const shrinkSidecar = (dir: string) => join(dir, '.git/getff-shrink.local');
  /** The record with the lines the placement pass printed as `EX:` (its lint-baseline line among them). */
  function recordFromPlace(dir: string, out: string, linter: string) {
    const extra = out.split('\n').filter((l) => l.startsWith('EX:') && l.length > 3).map((l) => l.slice(3));
    expect(extra.some((l) => l.startsWith('lint-baseline: ')), out).toBe(true);
    record(dir, { linter, extra });
  }
  function commitAll(dir: string) {
    write(dir, 'scripts/run-armed.sh', readFileSync(join(HERE, 'run-armed.sh'), 'utf8'));
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'baseline');
  }
  const THROW_OLD = "export function f() {\n  throw 'old';\n}\n";
  const THROW_FIXED = "export function f() {\n  throw new Error('old');\n}\n";

  // ESLint's own bulk suppressions (99-finalize.sh _pc_suppress): `--suppress-all`, the lint script gains
  // --pass-on-unpruned-suppressions, the record a `lint-baseline: eslint-suppressions.json` line.
  function suppressedProject() {
    const dir = eslintProject({ 'src/api/a.ts': UNSAFE, 'src/api/b.ts': UNSAFE });
    write(dir, 'package.json', JSON.stringify({ name: 'fx', private: true, type: 'module', scripts: { lint: 'eslint . --pass-on-unpruned-suppressions' } }, null, 2) + '\n');
    expect(spawnSync('npm', ['run', '--silent', 'lint', '--', '--suppress-all'], { cwd: dir, encoding: 'utf8' }).status).toBe(0);
    record(dir, { linter: 'eslint', extra: ['lint-baseline: eslint-suppressions.json — 2 findings in existing code recorded; new ones still block'] });
    commitAll(dir);
    return dir;
  }

  it('ESLint suppressions: one old finding fixed → the probe says 2 → 1, the tree stays clean; the fold shrinks file, index and record', () => {
    const dir = suppressedProject();
    write(dir, 'src/api/a.ts', SAFE);
    git(dir, 'add', 'src/api/a.ts');
    const p = armedRun(dir, '--probe');
    expect(p.stdout, p.stderr).toContain('lint baseline eslint-suppressions.json: 2 → 1 findings');
    expect(readFileSync(join(dir, 'eslint-suppressions.json'), 'utf8')).toBe(committed(dir, 'eslint-suppressions.json'));
    expect(existsSync(shrinkSidecar(dir))).toBe(true);
    const f = armedRun(dir, '--fold');
    expect(f.status, f.stdout + f.stderr).toBe(0);
    const sup = JSON.parse(readFileSync(join(dir, 'eslint-suppressions.json'), 'utf8')) as Json;
    expect(Object.keys(sup)).toEqual(['src/api/b.ts']);
    expect(indexed(dir, 'eslint-suppressions.json')).toBe(readFileSync(join(dir, 'eslint-suppressions.json'), 'utf8'));
    const line = 'lint-baseline: eslint-suppressions.json — 1 findings in existing code recorded; new ones still block';
    expect(baselineLine(readFileSync(join(dir, REC), 'utf8'))).toBe(line);
    expect(baselineLine(indexed(dir, REC))).toBe(line);
    expect(existsSync(shrinkSidecar(dir))).toBe(false);
    expect(npmLint(dir).status).toBe(0);
  });

  it('ESLint suppressions: a new violation beside the fix → no shrink, the probe names the lint exit, validate fails (paired negative)', () => {
    const dir = suppressedProject();
    write(dir, 'src/api/a.ts', SAFE);
    write(dir, 'src/api/c.ts', UNSAFE);
    const p = armedRun(dir, '--probe');
    expect(p.stdout).toContain('lint baseline eslint-suppressions.json not shrunk: npm run lint exits 1');
    expect(existsSync(shrinkSidecar(dir))).toBe(false);
    expect(armedRun(dir, 'validate').status).toBe(1);
    armedRun(dir, '--fold');
    expect(readFileSync(join(dir, 'eslint-suppressions.json'), 'utf8')).toBe(committed(dir, 'eslint-suppressions.json'));
    expect(readFileSync(join(dir, REC), 'utf8')).toBe(committed(dir, REC));
  });

  function exemptedOxProject() {
    const dir = oxProject({ 'src/App.tsx': BAD_APP, 'src/old.ts': THROW_OLD, 'src/older.ts': THROW_OLD });
    const { out } = place(dir, 'oxlint');
    recordFromPlace(dir, out, 'oxlint');
    commitAll(dir);
    return dir;
  }
  const exemptFiles = (c: { overrides?: Override[] }) => exempt(c).flatMap((o) => o.files.filter((f) => f !== EXEMPT)).sort();

  it('oxlint per-file exemptions: a fixed file leaves them; a new violation there fails again', () => {
    const dir = exemptedOxProject();
    expect(exemptFiles(cfgOf(dir))).toEqual(['src/App.tsx', 'src/old.ts', 'src/older.ts']);
    write(dir, 'src/old.ts', THROW_FIXED);
    git(dir, 'add', 'src/old.ts'); // the commit carries the fix
    const p = armedRun(dir, '--probe');
    expect(p.stdout, p.stderr).toContain("lint baseline .oxlintrc.json: getff's per-file exemptions 3 → 2 files (fixed: no-throw-literal in src/old.ts)");
    expect(readFileSync(join(dir, '.oxlintrc.json'), 'utf8')).toBe(committed(dir, '.oxlintrc.json'));
    expect(armedRun(dir, '--fold').status).toBe(0);
    expect(exemptFiles(cfgOf(dir))).toEqual(['src/App.tsx', 'src/older.ts']);
    expect(indexed(dir, '.oxlintrc.json')).toBe(readFileSync(join(dir, '.oxlintrc.json'), 'utf8'));
    const line = "lint-baseline: .oxlintrc.json — getff's rules are off per file for 2 existing violations in 2 files (entries marked getff); new ones block in every other file";
    expect(baselineLine(readFileSync(join(dir, REC), 'utf8'))).toBe(line);
    expect(baselineLine(indexed(dir, REC))).toBe(line);
    expect(npmLint(dir).status).toBe(0);
    write(dir, 'src/old.ts', THROW_OLD); // the exemption is really gone
    expect(npmLint(dir).status).not.toBe(0);
  });

  it('oxlint per-file exemptions: a new violation elsewhere → nothing shrinks (paired negative)', () => {
    const dir = exemptedOxProject();
    write(dir, 'src/old.ts', THROW_FIXED);
    write(dir, 'src/new.ts', THROW_OLD);
    const p = armedRun(dir, '--probe');
    expect(p.stdout).toContain('lint baseline .oxlintrc.json not shrunk: npm run lint exits 1');
    armedRun(dir, '--fold');
    expect(readFileSync(join(dir, '.oxlintrc.json'), 'utf8')).toBe(committed(dir, '.oxlintrc.json'));
  });

  it("ESLint's own config: the getff block shrinks per fixed file, and goes when the last one is fixed", () => {
    const dir = eslintProject({ 'src/api/a.ts': UNSAFE, 'src/api/b.ts': UNSAFE });
    const before = readFileSync(join(dir, 'eslint.config.mjs'), 'utf8');
    const { out } = place(dir, 'eslint');
    recordFromPlace(dir, out, 'eslint');
    commitAll(dir);
    write(dir, 'src/api/a.ts', SAFE);
    git(dir, 'add', 'src/api/a.ts');
    expect(armedRun(dir, '--probe').stdout).toContain("lint baseline eslint.config.mjs: getff's per-file exemptions 2 → 1 files");
    expect(armedRun(dir, '--fold').status).toBe(0);
    const text = readFileSync(join(dir, 'eslint.config.mjs'), 'utf8');
    expect(text).toMatch(/\{ files: \['src\/api\/b\.ts'\], rules: \{ 'rules-as-tests\/no-unsafe-zod-parse': 'off' \} \},/);
    expect(text).not.toContain("'src/api/a.ts'");
    expect(indexed(dir, 'eslint.config.mjs')).toBe(text);
    expect(npmLint(dir).status).toBe(0);
    write(dir, 'src/api/b.ts', SAFE);
    armedRun(dir, '--probe');
    armedRun(dir, '--fold');
    expect(readFileSync(join(dir, 'eslint.config.mjs'), 'utf8')).toBe(before);
    expect(npmLint(dir).status).toBe(0);
  });

  it("ESLint's own config: a route path with `[id]` stays exempted when another file's exemption is folded away", () => {
    const dir = eslintProject({ 'src/api/[id]/save.ts': UNSAFE, 'src/api/b.ts': UNSAFE });
    const { out } = place(dir, 'eslint');
    recordFromPlace(dir, out, 'eslint');
    commitAll(dir);
    expect(readFileSync(join(dir, 'eslint.config.mjs'), 'utf8')).toContain("'src/api/\\\\[id\\\\]/save.ts'");
    const t = table(dir).stdout;
    expect(t).toContain('existing violation: rules-as-tests/no-unsafe-zod-parse in src/api/[id]/save.ts');
    write(dir, 'src/api/b.ts', SAFE);
    git(dir, 'add', 'src/api/b.ts');
    expect(armedRun(dir, '--probe').stdout).toContain("lint baseline eslint.config.mjs: getff's per-file exemptions 2 → 1 files");
    expect(armedRun(dir, '--fold').status).toBe(0);
    const text = readFileSync(join(dir, 'eslint.config.mjs'), 'utf8');
    expect(text).toContain("'src/api/\\\\[id\\\\]/save.ts'");
    expect(text).not.toContain("'src/api/b.ts'");
    expect(indexed(dir, 'eslint.config.mjs')).toBe(text);
    expect(npmLint(dir).status).toBe(0);
  });

  it('a fix the commit does not carry is never folded into the commit: unstaged, the index keeps the exemption', () => {
    const dir = exemptedOxProject();
    write(dir, 'src/old.ts', THROW_FIXED); // fixed on disk, not staged
    expect(armedRun(dir, '--probe').stdout).toContain('fixed: no-throw-literal in src/old.ts');
    expect(armedRun(dir, '--fold').status).toBe(0);
    const staged = JSON.parse(indexed(dir, '.oxlintrc.json')) as { overrides?: Override[] };
    expect(exemptFiles(staged)).toEqual(['src/App.tsx', 'src/old.ts', 'src/older.ts']); // the commit's old.ts is still red
    expect(baselineLine(indexed(dir, REC))).toBe(baselineLine(committed(dir, REC)));
    expect(exemptFiles(cfgOf(dir))).toEqual(['src/App.tsx', 'src/older.ts']); // the working tree's old.ts is fixed
    expect(npmLint(dir).status).toBe(0);
  });

  it('a fix reverted after the probe is folded nowhere (paired negative)', () => {
    const dir = exemptedOxProject();
    write(dir, 'src/old.ts', THROW_FIXED);
    git(dir, 'add', 'src/old.ts');
    expect(armedRun(dir, '--probe').stdout).toContain('fixed: no-throw-literal in src/old.ts');
    write(dir, 'src/old.ts', THROW_OLD);
    git(dir, 'add', 'src/old.ts');
    armedRun(dir, '--fold');
    expect(readFileSync(join(dir, '.oxlintrc.json'), 'utf8')).toBe(committed(dir, '.oxlintrc.json'));
    expect(indexed(dir, '.oxlintrc.json')).toBe(committed(dir, '.oxlintrc.json'));
    expect(npmLint(dir).status).toBe(0);
  });

  it('a staged fix edited again after the probe: the working tree never keeps more baseline than the commit', () => {
    const dir = exemptedOxProject();
    write(dir, 'src/old.ts', THROW_FIXED);
    git(dir, 'add', 'src/old.ts');
    expect(armedRun(dir, '--probe').stdout).toContain('fixed: no-throw-literal in src/old.ts');
    write(dir, 'src/old.ts', THROW_FIXED + 'export const later = 1;\n'); // edited again, not staged
    const f = armedRun(dir, '--fold');
    expect(f.status, f.stdout + f.stderr).toBe(0);
    expect(f.stdout).toContain('✓ lint baseline shrunk and staged with this commit: .oxlintrc.json');
    const staged = JSON.parse(indexed(dir, '.oxlintrc.json')) as { overrides?: Override[] };
    expect(exemptFiles(staged)).toEqual(['src/App.tsx', 'src/older.ts']);
    expect(exemptFiles(cfgOf(dir))).toEqual(['src/App.tsx', 'src/older.ts']); // else `git commit -a` brings it back
    expect(baselineLine(readFileSync(join(dir, REC), 'utf8'))).toBe(baselineLine(indexed(dir, REC)));
    expect(npmLint(dir).status).toBe(0);
  });

  it('the fold says which version it shrank: the working tree only, when the commit does not carry the fix', () => {
    const dir = exemptedOxProject();
    write(dir, 'src/old.ts', THROW_FIXED); // not staged
    armedRun(dir, '--probe');
    const f = armedRun(dir, '--fold');
    expect(f.stdout).toContain('lint baseline shrunk in the working tree only: .oxlintrc.json');
    expect(f.stdout).not.toContain('staged with this commit');
  });

  it('the fold says a fix changed after the probe was not folded, never «nothing left to fold» (paired negative)', () => {
    const dir = exemptedOxProject();
    write(dir, 'src/old.ts', THROW_FIXED);
    git(dir, 'add', 'src/old.ts');
    armedRun(dir, '--probe');
    write(dir, 'src/old.ts', THROW_OLD);
    git(dir, 'add', 'src/old.ts');
    const f = armedRun(dir, '--fold');
    expect(f.stdout).toContain('lint baseline not shrunk: src/old.ts changed after the probe measured it');
    expect(f.stdout).not.toContain('nothing left to fold');
  });

  it('a fixed path with `[A]` beside a tracked `src/A/` is matched literally in the index', () => {
    const dir = oxProject({ 'src/App.tsx': BAD_APP, 'src/[A]/x.ts': THROW_OLD, 'src/A/x.ts': 'export const a = 1;\n' });
    const { out } = place(dir, 'oxlint');
    recordFromPlace(dir, out, 'oxlint');
    commitAll(dir);
    write(dir, 'src/[A]/x.ts', THROW_FIXED);
    git(dir, 'add', '--', ':(literal)src/[A]/x.ts');
    expect(armedRun(dir, '--probe').stdout).toContain('fixed: no-throw-literal in src/[A]/x.ts');
    expect(armedRun(dir, '--fold').status).toBe(0);
    const staged = JSON.parse(indexed(dir, '.oxlintrc.json')) as { overrides?: Override[] };
    expect(exemptFiles(staged)).toEqual(['src/App.tsx']);
  });
});
