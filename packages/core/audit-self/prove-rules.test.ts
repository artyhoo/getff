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
import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
    expect(c.overrides!.at(-1)!.files).toContain(EXEMPT); // the exemptions come last, so they win
    expect(npmLint(dir).status).toBe(0);
  });

  it('a NEW violation still fails the lint, also of a carrier still on in an exempted file (paired negative)', () => {
    const dir = oxProject(files);
    place(dir, 'oxlint');
    write(dir, 'src/new.ts', "export function h() {\n  throw 'new';\n}\n");
    expect(npmLint(dir).status).not.toBe(0);
    const dir2 = oxProject(files);
    place(dir2, 'oxlint');
    write(dir2, 'src/legacy.ts', files['src/legacy.ts'] + 'declare const Button: any;\nButton.defaultProps = {};\n');
    expect(npmLint(dir2).status).not.toBe(0);
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
    expect(c.overrides![0]).toEqual(projectCfg.overrides[0]);
    const builtins = owned(c).find((o) => o.files[0] === '**/*')!;
    expect(builtins.rules).toEqual({ 'no-throw-literal': 'error' }); // no-empty is the project's: not set
    const r = spawnSync('node', ['scripts/prove-rules.mjs', '--remove'], { cwd: dir, encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(readFileSync(join(dir, '.oxlintrc.json'), 'utf8')).toBe(before);
  });

  it('--remove on a project that never had getff entries leaves the file byte-identical (paired negative)', () => {
    const text = '{\n    "plugins": ["react"],\n    "rules": { "no-empty": "error" }\n}\n';
    const dir = oxProject({}, { cfgText: text });
    const r = spawnSync('node', ['scripts/prove-rules.mjs', '--remove'], { cwd: dir, encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(readFileSync(join(dir, '.oxlintrc.json'), 'utf8')).toBe(text);
    expect(r.stdout).toContain('nothing of getff');
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
function eslintProject(files: Record<string, string>, projectRules: Json = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'prove-es-'));
  write(dir, 'package.json', JSON.stringify({ name: 'fx', private: true, type: 'module', scripts: { lint: 'eslint .' } }, null, 2) + '\n');
  symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'));
  for (const f of readdirSync(RULES_DIR).filter((f) => f.endsWith('.mjs'))) {
    mkdirSync(join(dir, 'eslint-rules-local'), { recursive: true });
    copyFileSync(join(RULES_DIR, f), join(dir, 'eslint-rules-local', f));
  }
  write(dir, 'eslint-rules-local/index.mjs', barrel());
  // The project's own config, with the element getff's Q4.7 insertion adds (R2 on the boundary globs).
  write(dir, 'eslint.config.mjs', [
    "import tsParser from '@typescript-eslint/parser';",
    "import customRules from './eslint-rules-local/index.mjs';",
    '',
    'export default [',
    `  { ignores: ['node_modules/**', 'eslint-rules-local/**', 'scripts/**'] },`,
    `  { files: ['**/*.ts'], languageOptions: { parser: tsParser }, rules: ${JSON.stringify(projectRules)} },`,
    `  { files: ['**/api/**/*.ts'], languageOptions: { parser: tsParser }, plugins: { 'rules-as-tests': customRules }, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } },`,
    '];',
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
