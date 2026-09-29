#!/usr/bin/env node
// prove-rules.mjs — getff's lint rules in the project's own linter: placed, proven through the project's own
// lint command, removable in one command. getff's install ships it as scripts/prove-rules.mjs
// (setup.d/40-configs.sh) and runs the placement pass from setup.d/lib.sh place_lint_rules.
//
//   node scripts/prove-rules.mjs --prove    write each placed rule's bad and good example into a sample
//                                           directory the lint command lints, run the command, and report per
//                                           rule: the bad example fails with THIS rule's diagnostic, the good
//                                           one passes. The samples never reach a commit (.git/info/exclude,
//                                           removed at the start and at the end of every run).
//   node scripts/prove-rules.mjs --remove   take out everything getff placed in the lint config
//   --place --linter oxlint|eslint --stack <stack> [--result <file>]   the install's placement pass
//   --wanted-top --stack <stack>            the rules getff sets at the top of an oxlint config (JSON), for
//                                           P4's oxlint_register_jsplugin
//
// Operator log entry 28, fork 1 = A: what was green stays green. A rule is switched on only after the
// project's lint exits 0 as it stands; the files that break it today get a per-file exemption (oxlint's own
// `overrides`), so a NEW violation still fails and fixing an old one never turns the lint red. Everything getff
// writes is findable: an overrides entry whose `files` carry a sentinel glob, a carrier entry whose message
// starts `[getff:<id>] `, a `// getff:exempt:begin/end` block in an ESLint config. Node's standard library only.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROOF_DIR = '__getff_proof__';
/** Marks an overrides entry getff owns. It is also where the proof samples go, so every rule getff places
 *  reaches its sample whatever its own globs are (a real directory of that name does not exist). */
export const OWNED_GLOB = `**/${PROOF_DIR}/**`;
/** Marks getff's per-file exemptions for existing violations; matches nothing real. oxlint rejects any key
 *  of its own in an overrides entry, so a glob is the only mark it keeps (measured, oxlint 1.86.0). */
export const EXEMPT_GLOB = '**/__getff_exempt__/**';
export const CARRIER = 'rules-as-tests/restricted-syntax-audit-exempt';
const TAG_RE = /^\[getff:([A-Za-z0-9_.-]+)\] /;
const ESLINT_BEGIN = '// getff:exempt:begin';
const ESLINT_END = '// getff:exempt:end';

// ─── What getff switches on ─────────────────────────────────────────────────────────────────────────
// A mirror of the plugin rules each stack's shipped ESLint config switches on, with its globs: the script
// runs in the consumer project, where getff's templates are not. prove-rules-parity.test.ts reads every
// template and fails when this drifts. `strict` = only with AIF_STRICT_RUNTIME=1, as in the templates.
const APP_CODE = ['**/*.{ts,tsx}'];
const APP_CODE_IGNORE = ['**/infrastructure/**/*.{ts,tsx}'];
const APPLICATION = ['**/application/**/*.{ts,tsx}', '**/use-cases/**/*.{ts,tsx}', '**/usecases/**/*.{ts,tsx}'];
const APPLICATION_IGNORE = ['**/application/**/ports/**'];
const RUNTIME = [
  { rule: 'rules-as-tests/no-direct-time-randomness', files: APP_CODE, excludeFiles: APP_CODE_IGNORE, strict: true },
  { rule: 'rules-as-tests/require-otel-span', files: APPLICATION, excludeFiles: APPLICATION_IGNORE, strict: true },
];
const NEXT_BOUNDARY = [
  '**/app/**/actions/**/*.{ts,tsx}',
  '**/app/api/**/*.{ts,tsx}',
  '**/actions/**/*.{ts,tsx}',
  '**/features/*/api/**/*.{ts,tsx}',
];
export const STACK_RULES = {
  'react-spa': [
    { rule: 'rules-as-tests/no-unsafe-zod-parse', files: ['**/features/*/api/**/*.{ts,tsx}', '**/api/**/*.{ts,tsx}', '**/services/**/*.{ts,tsx}'] },
    {
      rule: 'rules-as-tests/require-error-boundary',
      files: ['src/App.{tsx,jsx}', 'src/app.{tsx,jsx}', 'src/Root.{tsx,jsx}', 'src/main.{tsx,jsx}', 'src/index.{tsx,jsx}', 'app/App.{tsx,jsx}', 'app/Root.{tsx,jsx}'],
    },
    ...RUNTIME,
  ],
  'ts-server': [
    {
      rule: 'rules-as-tests/no-unsafe-zod-parse',
      files: ['**/handlers/**/*.{ts,tsx}', '**/routes/**/*.{ts,tsx}', '**/controllers/**/*.{ts,tsx}', '**/app/api/**/*.{ts,tsx}', '**/actions/**/*.{ts,tsx}'],
    },
    ...RUNTIME,
  ],
  'react-next': [
    { rule: 'rules-as-tests/no-unsafe-zod-parse', files: NEXT_BOUNDARY },
    { rule: 'rules-as-tests/no-server-imports-in-client', files: ['**/*.{ts,tsx}'] },
    {
      rule: CARRIER,
      files: NEXT_BOUNDARY,
      notPlaced: "the react-next config's R14/R20 selectors share one setting with the generated rules; getff places them in ESLint only",
    },
    ...RUNTIME,
  ],
};
/** Rules the linter already has, for the other half of H8 (base-core.md, «The lint plugin»). */
export const BUILTINS = ['no-throw-literal', 'no-empty'];
const BUILTIN_SAMPLES = {
  'no-throw-literal': {
    bad: "export function fail() {\n  throw 'failed';\n}\n",
    good: "export function fail() {\n  throw new Error('failed');\n}\n",
  },
  'no-empty': {
    bad: 'export function check(ok: boolean) {\n  if (ok) {\n  }\n}\n',
    good: 'export function check(ok: boolean) {\n  if (ok) {\n    return 1;\n  }\n  return 0;\n}\n',
  },
};

// ─── Small helpers ──────────────────────────────────────────────────────────────────────────────────
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const posix = (p) => p.split(sep).join('/');
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isOn = (v) => {
  const s = Array.isArray(v) ? v[0] : v;
  return s === 'error' || s === 'warn' || s === 2 || s === 1 || s === 'deny';
};
/** A path as a literal glob: oxlint and minimatch read `[id]` as a character class (measured). */
export const escapeGlob = (p) => p.replace(/[\\*?[\]{}]/g, '\\$&');
const tagOf = (e) => (plain(e) && typeof e.message === 'string' ? TAG_RE.exec(e.message)?.[1] : undefined);
const isGetffEntry = (o) => plain(o) && Array.isArray(o.files) && (o.files.includes(OWNED_GLOB) || o.files.includes(EXEMPT_GLOB));

function indentOf(text) {
  return /\n([ \t]+)\S/.exec(text)?.[1] ?? '  ';
}
function writeLike(file, obj, before) {
  writeFileSync(file, JSON.stringify(obj, null, indentOf(before)) + (before.endsWith('\n') ? '\n' : ''));
}
function sh(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });
  return { rc: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

// ─── The project ────────────────────────────────────────────────────────────────────────────────────
export function oxlintConfig(root) {
  const p = join(root, '.oxlintrc.json');
  return existsSync(p) ? p : null;
}
export function eslintConfig(root) {
  for (const f of ['eslint.config.mjs', 'eslint.config.js', 'eslint.config.cjs', 'eslint.config.ts', 'eslint.config.mts', 'eslint.config.cts']) {
    if (existsSync(join(root, f))) return join(root, f);
  }
  return null;
}
function recordField(root, key) {
  const p = join(root, '.ai-factory/tool-decisions.md');
  if (!existsSync(p)) return undefined;
  return new RegExp(`^${key}: (\\S+)`, 'm').exec(readFileSync(p, 'utf8'))?.[1];
}

/** How `npm run lint` can be asked for a JSON report (measured: `npm run lint -- <args>` appends to the LAST
 *  command of a chain, and a second `-f` is an error). */
export function lintShape(root) {
  let script;
  try {
    script = readJson(join(root, 'package.json')).scripts?.lint;
  } catch {
    script = undefined;
  }
  if (typeof script !== 'string' || !script.trim()) return { kind: 'none' };
  const linter = /\boxlint\b/.test(script) ? 'oxlint' : /\beslint\b/.test(script) ? 'eslint' : undefined;
  const config = /(?:^|\s)(?:-c|--config)[ =](\S+)/.exec(script)?.[1];
  const single = /^\s*(?:npx\s+(?:--no-install\s+)?)?(oxlint|eslint)(\s|$)/.test(script) && !/&&|\|\||;|\||`|\$\(/.test(script);
  if (!single) return { kind: 'chain', script, linter, config };
  if (/(?:^|\s)(?:-f|--format)(?:\s|=)/.test(script)) return { kind: 'single-format', script, linter, config };
  return { kind: 'single', script, linter, config };
}

function relFile(root, file) {
  if (!isAbsolute(file)) return posix(file);
  let real = root;
  try {
    real = realpathSync(root);
  } catch {
    /* keep root */
  }
  return posix(file.startsWith(real + sep) ? relative(real, file) : relative(root, file));
}

/** oxlint `rules-as-tests(x)` / `eslint(x)` → the id a config uses; a tagged carrier → `getff:<tag>`. */
function idOf(code, message) {
  let id = code ?? '';
  const m = /^([a-z0-9@/_-]+)\(([^)]+)\)$/i.exec(id);
  if (m) id = m[1] === 'eslint' ? m[2] : m[1] === 'typescript-eslint' ? `@typescript-eslint/${m[2]}` : `${m[1]}/${m[2]}`;
  if (id === CARRIER) {
    const t = TAG_RE.exec(message ?? '')?.[1];
    if (t) return `getff:${t}`;
  }
  return id;
}

/** Both linters' JSON reports → [{id, file, message, error}]; null when stdout holds no report. */
export function parseReport(stdout, root) {
  const start = stdout.search(/^[[{]/m);
  if (start < 0) return null;
  let j;
  try {
    j = JSON.parse(stdout.slice(start));
  } catch {
    return null;
  }
  if (plain(j) && Array.isArray(j.diagnostics)) {
    return j.diagnostics.map((d) => ({ id: idOf(d.code, d.message), file: relFile(root, d.filename ?? ''), message: d.message ?? '', error: d.severity === 'error' }));
  }
  if (Array.isArray(j)) {
    return j.flatMap((f) => (f.messages ?? []).map((m) => ({
      id: idOf(m.ruleId ?? (m.fatal ? 'parse-error' : ''), m.message),
      file: relFile(root, f.filePath ?? ''),
      message: m.message ?? '',
      error: m.severity === 2,
    })));
  }
  return null;
}

/** One run of the project's lint with a JSON report: `npm run lint -- -f json` when the script is one linter
 *  call, otherwise the linter binary with the config the script names (said in `how`). */
export function realLint(root, opts = {}) {
  const shape = lintShape(root);
  const paths = opts.paths ?? [];
  let cmd, args, how;
  if (shape.kind === 'single') {
    cmd = 'npm';
    args = ['run', '--silent', 'lint', '--', '-f', 'json', ...paths];
    how = `npm run lint -- -f json${paths.length ? ' ' + paths.join(' ') : ''}`;
  } else {
    const linter = shape.linter ?? (oxlintConfig(root) ? 'oxlint' : 'eslint');
    cmd = join(root, 'node_modules/.bin', linter);
    args = ['-f', 'json', ...(shape.config ? ['-c', shape.config] : []), ...(paths.length ? paths : linter === 'eslint' ? ['.'] : [])];
    how = `node_modules/.bin/${linter} ${args.join(' ')}`;
  }
  const r = sh(cmd, args, root);
  const report = parseReport(r.stdout, root);
  return { rc: r.rc, raw: r.stdout + r.stderr, diags: report ?? [], parsed: report !== null, how };
}
const firstLine = (raw) => raw.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('>')) ?? '';

// ─── Generated carriers ─────────────────────────────────────────────────────────────────────────────
/** The generated declarative rules (80-rule-bootstrap.sh) as carrier entries tagged with their id. */
export function generatedCarriers(root) {
  const p = join(root, '.ai-factory/synthesizer-output/rules-manifest-additions.json');
  if (!existsSync(p)) return [];
  let m;
  try {
    m = readJson(p);
  } catch {
    return [];
  }
  return Object.entries(m)
    .filter(([, r]) => r?.check?.type === 'declarative' && (r.check.engine ?? 'eslint-restricted') === 'eslint-restricted' && r.check.selector)
    .map(([id, r]) => ({
      id,
      entry: { selector: r.check.selector, message: `[getff:${id}] ${r.check.message ?? 'forbidden construct'}` },
      examples: r.examples,
    }));
}

export function wantedTop(root) {
  const carriers = generatedCarriers(root);
  return carriers.length ? { [CARRIER]: ['error', ...carriers.map((c) => c.entry)] } : {};
}

// ─── Placement: oxlint ──────────────────────────────────────────────────────────────────────────────
/** Remove getff's rule `id` from every getff-owned place of `cfg` (owned entries, exemptions, carriers). */
function dropRule(cfg, id) {
  const tag = id.startsWith('getff:') ? id.slice(6) : undefined;
  const dropCarrier = (v) => (Array.isArray(v) ? [v[0], ...v.slice(1).filter((e) => tagOf(e) !== tag)] : v);
  if (tag) {
    if (Array.isArray(cfg.rules?.[CARRIER])) {
      cfg.rules[CARRIER] = dropCarrier(cfg.rules[CARRIER]);
      if (cfg.rules[CARRIER].length === 1) delete cfg.rules[CARRIER];
    }
    for (const o of (cfg.overrides ?? []).filter(isGetffEntry)) {
      if (Array.isArray(o.rules?.[CARRIER])) {
        o.rules[CARRIER] = dropCarrier(o.rules[CARRIER]);
        if (o.rules[CARRIER].length === 1) o.rules[CARRIER] = 'off';
      }
    }
  } else {
    for (const o of (cfg.overrides ?? []).filter(isGetffEntry)) if (o.rules) delete o.rules[id];
    if (id.startsWith('rules-as-tests/') && cfg.rules) delete cfg.rules[id];
  }
  // An exemption left holding only `off` for rules no longer placed has nothing to do.
  cfg.overrides = (cfg.overrides ?? []).filter((o) => !isGetffEntry(o) || Object.keys(o.rules ?? {}).length > 0);
}

export function placeOxlint(root, { stack, strict = process.env.AIF_STRICT_RUNTIME === '1', lint = realLint } = {}) {
  const file = oxlintConfig(root);
  const before = readFileSync(file, 'utf8');
  const cfg = JSON.parse(before);
  const placed = [];
  const notPlaced = [];
  const kept = [];
  cfg.rules = plain(cfg.rules) ? cfg.rules : {};
  // A re-run recomputes getff's entries: they are getff's own, never the project's.
  cfg.overrides = (Array.isArray(cfg.overrides) ? cfg.overrides : []).filter((o) => !isGetffEntry(o));
  const projectOverrides = cfg.overrides.slice();
  const projectSets = (rule) => rule in cfg.rules || projectOverrides.some((o) => plain(o?.rules) && rule in o.rules);

  // 1. Generated carriers — P4's helper wrote the setting on the first pass; this merges the entries a later
  //    research pass adds, by tag, and never touches a carrier setting of the project's own.
  const carriers = generatedCarriers(root);
  if (carriers.length) {
    const cur = cfg.rules[CARRIER];
    const ours = Array.isArray(cur) && cur.slice(1).some((e) => tagOf(e));
    if (cur === undefined || ours) {
      const list = Array.isArray(cur) ? cur.slice() : ['error'];
      for (const c of carriers) if (!list.slice(1).some((e) => tagOf(e) === c.id)) list.push(c.entry);
      cfg.rules[CARRIER] = list;
      placed.push(...carriers.map((c) => `getff:${c.id}`));
    } else {
      for (const c of carriers) notPlaced.push({ rule: `getff:${c.id}`, reason: `your config sets ${CARRIER} itself, and getff does not change a setting of yours` });
    }
  }

  // 2. The stack's plugin rules, each group of globs in one getff-owned entry.
  const groups = new Map();
  for (const r of STACK_RULES[stack] ?? []) {
    if (r.strict && !strict) continue;
    if (r.notPlaced) {
      notPlaced.push({ rule: r.rule, reason: r.notPlaced });
      continue;
    }
    if (projectSets(r.rule)) {
      kept.push(r.rule);
      continue;
    }
    const key = JSON.stringify([r.files, r.excludeFiles ?? []]);
    if (!groups.has(key)) groups.set(key, { files: [...r.files, OWNED_GLOB], ...(r.excludeFiles ? { excludeFiles: r.excludeFiles } : {}), rules: {} });
    groups.get(key).rules[r.rule] = 'error';
    placed.push(r.rule);
  }
  // 3. The built-in half of H8, in one `**/*` entry; a built-in the project sets anywhere stays the project's.
  const builtins = {};
  for (const b of BUILTINS) {
    if (projectSets(b)) kept.push(b);
    else {
      builtins[b] = 'error';
      placed.push(b);
    }
  }
  const ownedEntries = [...groups.values()];
  if (Object.keys(builtins).length) ownedEntries.push({ files: ['**/*', OWNED_GLOB], rules: builtins });
  cfg.overrides.push(...ownedEntries);
  writeLike(file, cfg, before);

  // 4. The baseline: what getff's rules report on the tree as it is becomes a per-file exemption.
  const base = lint(root, {});
  if (base.rc !== 0 && !base.diags.length) {
    writeFileSync(file, before);
    dropAllGetff(file);
    return {
      placed: [],
      notPlaced: [{ rule: '*', reason: `your lint exits ${base.rc} once getff's rules are on, with no report getff can read: ${firstLine(base.raw)}` }],
      kept,
      exemptFiles: 0,
      exemptViolations: 0,
      lintRc: null,
    };
  }
  const ours = new Set(placed);
  const hits = base.diags.filter((d) => d.error && ours.has(d.id));
  const perFile = new Map();
  for (const h of hits) {
    if (!perFile.has(h.file)) perFile.set(h.file, new Set());
    perFile.get(h.file).add(h.id);
  }
  const byRules = new Map();
  for (const [f, ids] of perFile) {
    const rules = {};
    const offCarriers = [...ids].filter((i) => i.startsWith('getff:')).map((i) => i.slice(6));
    for (const i of ids) if (!i.startsWith('getff:')) rules[i] = 'off';
    if (offCarriers.length) {
      const rest = (cfg.rules[CARRIER] ?? ['error']).slice(1).filter((e) => !offCarriers.includes(tagOf(e)));
      rules[CARRIER] = rest.length ? [cfg.rules[CARRIER][0], ...rest] : 'off';
    }
    const k = JSON.stringify(rules);
    if (!byRules.has(k)) byRules.set(k, { files: [], rules });
    byRules.get(k).files.push(escapeGlob(f));
  }
  const exemptions = [...byRules.values()].map((e) => ({ files: [...e.files.sort(), EXEMPT_GLOB], rules: e.rules }));
  cfg.overrides.push(...exemptions); // last, so they win over getff's own entries
  writeLike(file, cfg, before);

  // 5. One verify run. A rule still reporting is removed alone, with its reason — no second pass.
  const ver = lint(root, {});
  let lintRc = ver.rc === 0 ? 0 : null;
  if (ver.rc !== 0) {
    const still = new Map();
    for (const d of ver.diags) if (d.error && ours.has(d.id) && !still.has(d.id)) still.set(d.id, d);
    if (!still.size) {
      writeFileSync(file, before);
      dropAllGetff(file);
      return {
        placed: [],
        notPlaced: [{ rule: '*', reason: `your lint exits ${ver.rc} after getff's rules and exemptions are in place, with no getff diagnostic: ${firstLine(ver.raw)}` }],
        kept,
        exemptFiles: 0,
        exemptViolations: 0,
        lintRc: null,
      };
    }
    for (const [id, d] of still) {
      dropRule(cfg, id);
      placed.splice(placed.indexOf(id), 1);
      notPlaced.push({ rule: id, reason: `still red after the baseline: ${d.file}: ${d.message}` });
    }
    writeLike(file, cfg, before);
  }
  const left = (cfg.overrides ?? []).filter((o) => o.files?.includes(EXEMPT_GLOB));
  return {
    placed,
    notPlaced,
    kept,
    exemptFiles: left.reduce((n, o) => n + o.files.length - 1, 0),
    exemptViolations: hits.filter((h) => placed.includes(h.id)).length,
    lintRc,
  };
}

// ─── Placement: ESLint, the project's own config ────────────────────────────────────────────────────
function eslintBlockLines(entries) {
  const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  return [
    `  ${ESLINT_BEGIN} — existing violations of getff's rules, recorded at install; \`node scripts/prove-rules.mjs --remove\` takes this block out`,
    ...entries.map((e) =>
      e.files
        ? `  { files: [${e.files.map(q).join(', ')}], rules: { ${Object.keys(e.rules).map((r) => `${q(r)}: 'off'`).join(', ')} } },`
        : `  { rules: { ${Object.keys(e.rules).map((r) => `${q(r)}: 'off'`).join(', ')} } },`,
    ),
    `  ${ESLINT_END}`,
  ];
}
function withoutEslintBlock(text) {
  const lines = text.split('\n');
  const b = lines.findIndex((l) => l.trim().startsWith(ESLINT_BEGIN));
  const e = lines.findIndex((l, i) => i > b && l.trim() === ESLINT_END);
  if (b < 0 || e < 0) return text;
  lines.splice(b, e - b + 1);
  return lines.join('\n');
}
function withEslintBlock(text, block) {
  const lines = withoutEslintBlock(text).split('\n');
  let i = lines.length - 1;
  while (i >= 0 && !/^\s*[\])]+\s*\)?\s*;?\s*$/.test(lines[i])) i--;
  if (i < 0) return null;
  let p = i - 1;
  while (p >= 0 && !lines[p].trim()) p--;
  if (p >= 0 && !/[,[(]\s*$/.test(lines[p]) && !lines[p].trim().startsWith('//')) lines[p] = lines[p].replace(/\s*$/, ',');
  lines.splice(i, 0, ...block);
  return lines.join('\n');
}
const isGetffRule = (id) => id.startsWith('rules-as-tests/');

export function placeEslintOwn(root, { lint = realLint } = {}) {
  const file = eslintConfig(root);
  const before = readFileSync(file, 'utf8');
  const base = lint(root, {});
  if (base.rc === 0) return { placed: [], notPlaced: [], kept: [], exemptFiles: 0, exemptViolations: 0, lintRc: 0 };
  const errors = base.diags.filter((d) => d.error);
  if (!errors.length) {
    return { placed: [], notPlaced: [{ rule: '*', reason: `existing violations not exempted: your lint exits ${base.rc} with no report getff can read: ${firstLine(base.raw)}` }], kept: [], exemptFiles: 0, exemptViolations: 0, lintRc: null };
  }
  const own = [...new Set(errors.filter((d) => !isGetffRule(d.id)).map((d) => d.id))];
  if (own.length) {
    return { placed: [], notPlaced: [{ rule: '*', reason: `existing violations not exempted: your lint exits ${base.rc} on its own rules (${own.sort().join(', ')})` }], kept: [], exemptFiles: 0, exemptViolations: 0, lintRc: null };
  }
  const perFile = new Map();
  for (const d of errors) {
    if (!perFile.has(d.file)) perFile.set(d.file, new Set());
    perFile.get(d.file).add(d.id);
  }
  const byRules = new Map();
  for (const [f, ids] of perFile) {
    const k = JSON.stringify([...ids].sort());
    if (!byRules.has(k)) byRules.set(k, { files: [], rules: Object.fromEntries([...ids].sort().map((i) => [i, 'off'])) });
    byRules.get(k).files.push(escapeGlob(f));
  }
  const entries = [...byRules.values()].map((e) => ({ files: e.files.sort(), rules: e.rules }));
  const next = withEslintBlock(before, eslintBlockLines(entries));
  if (next === null) {
    return { placed: [], notPlaced: [{ rule: '*', reason: `existing violations not exempted: getff found no closing \`];\` / \`);\` line in ${relative(root, file)} to put its block before` }], kept: [], exemptFiles: 0, exemptViolations: 0, lintRc: null };
  }
  writeFileSync(file, next);
  const ver = lint(root, {});
  if (ver.rc === 0) return { placed: [], notPlaced: [], kept: [], exemptFiles: perFile.size, exemptViolations: errors.length, lintRc: 0 };
  const still = new Map();
  for (const d of ver.diags) if (d.error && isGetffRule(d.id) && !still.has(d.id)) still.set(d.id, d);
  if (!still.size) {
    writeFileSync(file, before);
    return { placed: [], notPlaced: [{ rule: '*', reason: `existing violations not exempted: your lint exits ${ver.rc} with getff's block in place and no getff diagnostic: ${firstLine(ver.raw)}` }], kept: [], exemptFiles: 0, exemptViolations: 0, lintRc: null };
  }
  entries.push({ rules: Object.fromEntries([...still.keys()].map((i) => [i, 'off'])) });
  writeFileSync(file, withEslintBlock(before, eslintBlockLines(entries)));
  return {
    placed: [],
    notPlaced: [...still].map(([id, d]) => ({ rule: id, reason: `switched off by getff's block: still red after the baseline: ${d.file}: ${d.message}` })),
    kept: [],
    exemptFiles: perFile.size,
    exemptViolations: errors.length,
    lintRc: null,
  };
}

// ─── Removal ────────────────────────────────────────────────────────────────────────────────────────
/** Everything getff placed in an oxlint config, gone; returns what was removed. */
function dropAllGetff(file) {
  const before = readFileSync(file, 'utf8');
  let cfg;
  try {
    cfg = JSON.parse(before);
  } catch {
    return [];
  }
  if (!plain(cfg)) return [];
  const removed = [];
  if (Array.isArray(cfg.overrides)) {
    const n = cfg.overrides.length;
    cfg.overrides = cfg.overrides.filter((o) => !isGetffEntry(o));
    if (cfg.overrides.length < n) removed.push(`${n - cfg.overrides.length} overrides entries marked ${OWNED_GLOB} / ${EXEMPT_GLOB}`);
    if (!cfg.overrides.length) delete cfg.overrides;
  }
  if (plain(cfg.rules)) {
    for (const k of Object.keys(cfg.rules)) {
      if (k === CARRIER && Array.isArray(cfg.rules[k])) {
        const rest = cfg.rules[k].slice(1).filter((e) => !tagOf(e));
        const tagged = cfg.rules[k].length - 1 - rest.length;
        if (!tagged) continue;
        removed.push(`${tagged} generated carrier entries [getff:<id>]`);
        if (rest.length) cfg.rules[k] = [cfg.rules[k][0], ...rest];
        else delete cfg.rules[k];
      } else if (k.startsWith('rules-as-tests/') && k !== CARRIER) {
        removed.push(`rule ${k}`);
        delete cfg.rules[k];
      }
    }
    if (!Object.keys(cfg.rules).length) delete cfg.rules;
  }
  if (removed.length) writeLike(file, cfg, before);
  return removed;
}

export function removeGetff(root) {
  const lines = [];
  const ox = oxlintConfig(root);
  if (ox) {
    const removed = dropAllGetff(ox);
    lines.push(removed.length ? `removed from .oxlintrc.json: ${removed.join('; ')}` : 'nothing of getff in .oxlintrc.json — left as it was');
  }
  const es = eslintConfig(root);
  if (es) {
    const text = readFileSync(es, 'utf8');
    const next = withoutEslintBlock(text);
    const rel = posix(relative(root, es));
    if (next !== text) {
      writeFileSync(es, next);
      lines.push(`removed from ${rel}: getff's exemption block (${ESLINT_BEGIN} … ${ESLINT_END})`);
    } else lines.push(`nothing of getff's exemptions in ${rel} — left as it was`);
  }
  if (!lines.length) lines.push('nothing of getff to remove: no .oxlintrc.json and no eslint.config.* here');
  return lines;
}

// ─── The proof ──────────────────────────────────────────────────────────────────────────────────────
function pluginSamples(root, name) {
  const dir = join(root, 'scripts/fences-fire-fixtures');
  if (!existsSync(dir)) return undefined;
  const pick = (kind) => {
    const f = readdirSync(dir).find((x) => x.startsWith(`${name}.${kind}.`));
    return f ? { text: readFileSync(join(dir, f), 'utf8'), ext: f.endsWith('.tsx.txt') || f.endsWith('.tsx') ? 'tsx' : 'ts' } : undefined;
  };
  const bad = pick('bad');
  const good = pick('good');
  return bad && good ? { bad, good } : undefined;
}
function samplesFor(root, id, carriers) {
  if (id.startsWith('getff:')) {
    const ex = carriers.find((c) => c.id === id.slice(6))?.examples;
    return ex?.bad && ex?.good ? { bad: { text: ex.bad + '\n', ext: 'ts' }, good: { text: ex.good + '\n', ext: 'ts' } } : undefined;
  }
  if (id.startsWith('rules-as-tests/')) return pluginSamples(root, id.slice('rules-as-tests/'.length));
  const b = BUILTIN_SAMPLES[id];
  return b ? { bad: { text: b.bad, ext: 'ts' }, good: { text: b.good, ext: 'ts' } } : undefined;
}

/** The rules getff placed and the project's command runs, with where each one lives. */
const severity = (v) => (Array.isArray(v) ? v[0] : v);
const warnOnly = (v) => severity(v) === 'warn' || severity(v) === 1;
function placedOxlint(root) {
  const cfg = readJson(oxlintConfig(root));
  const out = new Map();
  const home = (k, own) => (k.startsWith('rules-as-tests/') ? `oxlint jsPlugin ${k}` : `oxlint built-in ${k}${own ? ' (your setting)' : ''}`);
  for (const o of (cfg.overrides ?? []).filter((x) => x?.files?.includes(OWNED_GLOB))) {
    for (const [k, v] of Object.entries(o.rules ?? {})) {
      out.set(k, isOn(v) ? { id: k, home: home(k), warnOnly: warnOnly(v) } : { id: k, home: home(k), off: true });
    }
  }
  for (const [k, v] of Object.entries(cfg.rules ?? {})) {
    if (k === CARRIER && Array.isArray(v)) {
      for (const e of v.slice(1)) {
        const t = tagOf(e);
        if (t) out.set(`getff:${t}`, { id: `getff:${t}`, home: `oxlint jsPlugin ${CARRIER} [getff:${t}]`, warnOnly: warnOnly(v) });
      }
    } else if ((k.startsWith('rules-as-tests/') || BUILTINS.includes(k)) && isOn(v) && !out.has(k)) {
      out.set(k, { id: k, home: home(k, true), warnOnly: warnOnly(v) });
    }
  }
  return [...out.values()];
}
function placedEslint(root, sampleDir, carriers) {
  const stack = recordField(root, 'stack');
  const bin = join(root, 'node_modules/.bin/eslint');
  const cands = [...(STACK_RULES[stack] ?? []).filter((r) => !r.notPlaced).map((r) => ({ id: r.rule, files: r.files })), ...BUILTINS.map((b) => ({ id: b, files: ['**/*'] }))];
  const out = [];
  for (const c of cands) {
    const rel = sampleRelFor(c.files, c.id, samplesFor(root, c.id, carriers)?.bad.ext ?? 'ts', sampleDir);
    if (!rel) {
      out.push({ id: c.id, home: `eslint ${c.id}`, unreachable: `its files globs (${c.files.join(', ')}) name no path the proof writes into` });
      continue;
    }
    const r = sh(bin, ['--print-config', rel], root);
    let setting;
    try {
      setting = JSON.parse(r.stdout).rules?.[c.id];
    } catch {
      setting = undefined;
    }
    if (isOn(setting)) out.push({ id: c.id, home: `eslint ${c.id}`, rel, warnOnly: warnOnly(setting) });
  }
  return out;
}
/** A sample path under the sample dir that `files` globs match: `**\/api/**\/*.{ts,tsx}` → `api/x/<id>.bad.ts`. */
function sampleRelFor(globs, id, ext, sampleDir) {
  for (const g of globs) {
    if (!g.startsWith('**/')) continue;
    const parts = g.slice(3).split('/');
    const last = parts.pop();
    const alts = /\{([^}]*)\}/.exec(last)?.[1]?.split(',') ?? [last.replace(/^\*\./, '')];
    const e = alts.includes(ext) ? ext : alts[0].replace(/^\*\./, '');
    const dirs = parts.map((p) => (p === '**' || p === '*' ? 'x' : p));
    return posix(join(sampleDir, ...dirs, `${safeName(id)}.bad.${e}`));
  }
  return undefined;
}
const safeName = (id) => id.replace(/^rules-as-tests\//, '').replace(/[^A-Za-z0-9_.-]/g, '_');

function sampleBase(root) {
  return existsSync(join(root, 'src')) ? 'src' : '.';
}
function excludeOnce(root) {
  const r = sh('git', ['rev-parse', '--git-path', 'info/exclude'], root);
  if (r.rc !== 0) return;
  const p = resolve(root, r.stdout.trim());
  mkdirSync(dirname(p), { recursive: true });
  const text = existsSync(p) ? readFileSync(p, 'utf8') : '';
  if (!text.split('\n').includes(`${PROOF_DIR}/`)) appendFileSync(p, `${text && !text.endsWith('\n') ? '\n' : ''}${PROOF_DIR}/\n`);
}

export function prove(root, { lint = realLint } = {}) {
  const lines = [];
  const linter = oxlintConfig(root) ? 'oxlint' : eslintConfig(root) ? 'eslint' : undefined;
  if (!linter) return { rc: 1, lines: ['not_wired · no .oxlintrc.json and no eslint.config.* in this project: nothing to prove'] };
  const shape = lintShape(root);
  if (shape.kind === 'none') return { rc: 1, lines: ['not_wired · package.json has no lint script: getff proves rules through the project\'s own lint command'] };
  const base = sampleBase(root);
  const dirRel = posix(join(base, PROOF_DIR));
  const dirAbs = join(root, dirRel);
  excludeOnce(root);
  rmSync(dirAbs, { recursive: true, force: true }); // a killed run's samples (SIGKILL beats every trap)
  const clean = () => rmSync(dirAbs, { recursive: true, force: true });
  process.once('exit', clean);
  const onSignal = (s) => {
    clean();
    process.exit(s === 'SIGINT' ? 130 : 143);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    const carriers = generatedCarriers(root);
    const rules = linter === 'oxlint' ? placedOxlint(root) : placedEslint(root, dirRel, carriers);
    if (!rules.length) return { rc: 0, lines: [`nothing placed by getff in the ${linter} config — nothing to prove`] };
    const rows = new Map();
    const todo = [];
    for (const r of rules) {
      if (r.off) rows.set(r.id, `${r.id} — not_wired · switched off in the config`);
      else if (r.unreachable) rows.set(r.id, `${r.id} — partial · not proved: ${r.unreachable}`);
      else {
        const s = samplesFor(root, r.id, carriers);
        if (!s) rows.set(r.id, `${r.id} — not_wired · getff has no bad/good example for it`);
        else {
          const bad = r.rel ?? posix(join(dirRel, `${safeName(r.id)}.bad.${s.bad.ext}`));
          todo.push({ ...r, s, bad, good: bad.replace(/\.bad\.([a-z]+)$/, `.good.${s.good.ext}`) });
        }
      }
    }
    const put = (rel, text) => {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), text);
    };
    let badRc = null;
    let goodRc = null;
    let how = '';
    if (todo.length && shape.kind === 'single-format') {
      // One linter call that sets its own output format: no JSON, so one run per rule, by exit code.
      const script = (paths) => sh('npm', ['run', '--silent', 'lint', '--', ...paths], root).rc;
      const perRule = new Map();
      for (const t of todo) {
        clean();
        put(t.bad, t.s.bad.text);
        perRule.set(t.id, script([t.bad]));
      }
      clean();
      for (const t of todo) put(t.good, t.s.good.text);
      goodRc = script(todo.map((t) => t.good));
      how = `npm run lint -- <sample> in ${dirRel}, once per rule: the lint script sets its own output format`;
      for (const t of todo) {
        const b = perRule.get(t.id);
        rows.set(t.id, b !== 0 && goodRc === 0
          ? `${t.id} — proved by exit code: bad → exit ${b} · good → exit 0 (one run per rule; the lint script sets its own output format)`
          : `${t.id} — not_wired · bad → exit ${b} · good → exit ${goodRc}`);
      }
    } else if (todo.length) {
      // Sample FILES, never the directory: oxlint skips an excluded directory given as a path, and lints an
      // excluded file given as a path (measured, oxlint 1.86.0).
      for (const t of todo) put(t.bad, t.s.bad.text);
      const b = lint(root, { paths: todo.map((t) => t.bad) });
      badRc = b.rc;
      clean();
      for (const t of todo) put(t.good, t.s.good.text);
      const g = lint(root, { paths: todo.map((t) => t.good) });
      goodRc = g.rc;
      how = (b.how ?? '').replace(/ \S*__getff_proof__\S*(?: \S*__getff_proof__\S*)*$/, ` <${todo.length} samples in ${dirRel}>`);
      const chain = shape.kind === 'chain';
      for (const t of todo) {
        const fired = b.diags.some((d) => d.id === t.id && d.file === t.bad);
        const onGood = [...new Set(g.diags.filter((d) => d.file === t.good && d.error).map((d) => d.id))];
        let row;
        if (!fired) {
          const said = b.diags.filter((d) => d.file === t.bad).map((d) => d.message)[0];
          row = `${t.id} — not_wired · no diagnostic on the bad example${said ? ` (the linter said: ${said})` : ''}`;
        } else if (onGood.length) row = `${t.id} — partial · good example rejected by ${onGood.join(', ')}`;
        else if (chain) row = `${t.id} — partial · proved through the linter binary, the lint script is a chain: ${shape.script}`;
        else if (t.warnOnly) row = `${t.id} — partial · warns only: the lint exits 0 on a warning`;
        else row = `${t.id} — proved: bad → its own diagnostic · good → no diagnostic`;
        rows.set(t.id, `${row}   [${t.home}]`);
      }
    }
    for (const r of rules) lines.push(rows.get(r.id));
    if (todo.length) lines.push(`bad batch → exit ${badRc ?? 'per rule'} · good batch → exit ${goodRc} (${how})`);
    const bad = lines.some((l) => / — not_wired · | — partial · good example rejected /.test(l));
    return { rc: bad ? 1 : 0, lines };
  } finally {
    clean();
    process.removeListener('exit', clean);
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────────────────────────────────
function arg(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
function main(argv) {
  const root = process.cwd();
  if (argv.includes('--wanted-top')) {
    process.stdout.write(JSON.stringify(wantedTop(root)) + '\n');
    return 0;
  }
  if (argv.includes('--place')) {
    const linter = arg(argv, '--linter');
    const res = linter === 'oxlint' ? placeOxlint(root, { stack: arg(argv, '--stack') }) : placeEslintOwn(root);
    for (const p of res.placed) console.log(`  ✓ placed: ${p}`);
    for (const k of res.kept) console.log(`  ⊝ ${k}: your config sets it — getff keeps your setting`);
    if (res.exemptViolations) console.log(`  ✓ ${res.exemptViolations} existing violations in ${res.exemptFiles} files exempted per file — new ones still fail`);
    for (const n of res.notPlaced) console.log(`  · not placed: ${n.rule} — ${n.reason}`);
    const out = arg(argv, '--result');
    if (out) writeFileSync(out, JSON.stringify(res) + '\n');
    return 0;
  }
  if (argv.includes('--remove')) {
    for (const l of removeGetff(root)) console.log(l);
    return 0;
  }
  if (argv.includes('--prove')) {
    const { rc, lines } = prove(root);
    for (const l of lines) console.log(l);
    return rc;
  }
  console.error('usage: node scripts/prove-rules.mjs --prove | --remove');
  return 2;
}

const real = (p) => {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
};
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) process.exitCode = main(process.argv.slice(2));
