#!/usr/bin/env node
// prove-rules.mjs — getff's lint rules in the project's own linter: placed, proven through the project's own
// lint command, removable in one command. getff's install ships it as scripts/prove-rules.mjs
// (setup.d/40-configs.sh) and runs the placement pass from setup.d/lib.sh place_lint_rules.
//
//   node scripts/prove-rules.mjs [--prove]  the rule table: one row per rule (rule · principle · home · status ·
//                                           reason · proof · reached by), every exempted violation by file, and
//                                           the proof — each placed rule's bad and good example written into a
//                                           sample directory the lint command lints: the bad example fails with
//                                           THIS rule's diagnostic, the good one passes. The samples never reach
//                                           a commit (.git/info/exclude, removed at the start and end of a run).
//                                           Exit 1 when a placed rule fails its proof, 2 when base-core.md has a
//                                           status outside fires | partial | not_wired.
//   node scripts/prove-rules.mjs --remove   take out everything getff placed in the lint config
//   --shrink --out <file>                   scripts/run-armed.sh's probe: the baseline findings fixed since, into
//                                           <file> (a sidecar in the git dir) — only while the lint exits 0
//   --fold-shrink <file>                    the shipped pre-commit's fold: <file> applied to the baseline and the
//                                           record's lint-baseline line, in the working tree and the index
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

/** file → Set of rule ids (a generated rule as `getff:<id>`) → getff's exemption entries, one per rule set. */
function oxlintExemptEntries(cfg, perFile) {
  const byRules = new Map();
  for (const [f, ids] of perFile) {
    const rules = {};
    const offCarriers = [...ids].filter((i) => i.startsWith('getff:')).map((i) => i.slice(6));
    for (const i of ids) if (!i.startsWith('getff:')) rules[i] = 'off';
    if (offCarriers.length) {
      const rest = (cfg.rules?.[CARRIER] ?? ['error']).slice(1).filter((e) => !offCarriers.includes(tagOf(e)));
      rules[CARRIER] = rest.length ? [cfg.rules[CARRIER][0], ...rest] : 'off';
    }
    const k = JSON.stringify(rules);
    if (!byRules.has(k)) byRules.set(k, { files: [], rules });
    byRules.get(k).files.push(escapeGlob(f));
  }
  return [...byRules.values()].map((e) => ({ files: [...e.files.sort(), EXEMPT_GLOB], rules: e.rules }));
}
/** The other way round: getff's exemption entries of an oxlint config → file → Set of rule ids. */
function oxlintExemptPairs(cfg) {
  const out = new Map();
  const tags = Array.isArray(cfg.rules?.[CARRIER]) ? cfg.rules[CARRIER].slice(1).map(tagOf).filter(Boolean) : [];
  for (const o of (cfg.overrides ?? []).filter((x) => x?.files?.includes(EXEMPT_GLOB))) {
    for (const f of o.files.filter((x) => x !== EXEMPT_GLOB).map(unescapeGlob)) {
      if (!out.has(f)) out.set(f, new Set());
      for (const [k, v] of Object.entries(o.rules ?? {})) {
        if (k === CARRIER) {
          const left = Array.isArray(v) ? v.slice(1).map(tagOf) : [];
          for (const t of tags.filter((x) => !left.includes(x))) out.get(f).add(`getff:${t}`);
        } else if (severity(v) === 'off' || severity(v) === 0) out.get(f).add(k);
      }
    }
  }
  return out;
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
  cfg.overrides.push(...oxlintExemptEntries(cfg, perFile)); // last, so they win over getff's own entries
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
  if (i < 0) {
    // A one-line default export — `export default tseslint.config(a, b);`, the shape getff's wirer leaves
    // in such a config: its closer moves to a line of its own (line breaks added, nothing removed).
    let d = lines.length - 1;
    while (d >= 0 && !lines[d].trim()) d--;
    const m = d >= 0 ? /^(export default .*[^\s([])(\s*[\])]+\s*;?\s*)$/.exec(lines[d]) : null;
    if (!m) return null;
    lines.splice(d, 1, m[1], m[2].trimStart());
    i = d + 1;
  }
  let p = i - 1;
  while (p >= 0 && !lines[p].trim()) p--;
  if (p >= 0 && !/[,[(]\s*$/.test(lines[p]) && !lines[p].trim().startsWith('//')) lines[p] = lines[p].replace(/\s*$/, ',');
  lines.splice(i, 0, ...block);
  return lines.join('\n');
}
const isGetffRule = (id) => id.startsWith('rules-as-tests/');
/** file → Set of rule ids → the block's per-file entries, one per rule set. */
function eslintExemptEntries(perFile) {
  const byRules = new Map();
  for (const [f, ids] of perFile) {
    const k = JSON.stringify([...ids].sort());
    if (!byRules.has(k)) byRules.set(k, { files: [], rules: Object.fromEntries([...ids].sort().map((i) => [i, 'off'])) });
    byRules.get(k).files.push(escapeGlob(f));
  }
  return [...byRules.values()].map((e) => ({ files: e.files.sort(), rules: e.rules }));
}
/** getff's block in an ESLint config → its per-file pairs (file → Set of rule ids) and its file-less entries
 *  (a rule still red after the baseline, off everywhere); null when there is no block. */
function eslintExemptBlock(text) {
  const b = text.indexOf(ESLINT_BEGIN);
  const e = text.indexOf(ESLINT_END, b);
  if (b < 0 || e < 0) return null;
  const body = text.slice(b, e);
  const strings = (s) => [...s.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((x) => x[1].replace(/\\(.)/g, '$1'));
  const perFile = new Map();
  for (const m of body.matchAll(/\{ files: \[([^\]]*)\], rules: \{([^}]*)\} \}/g)) {
    const ids = [...m[2].matchAll(/'((?:[^'\\]|\\.)*)': 'off'/g)].map((r) => r[1].replace(/\\(.)/g, '$1'));
    for (const f of strings(m[1]).map(unescapeGlob)) {
      if (!perFile.has(f)) perFile.set(f, new Set());
      for (const id of ids) perFile.get(f).add(id);
    }
  }
  const globals = [...body.matchAll(/^\s*\{ rules: \{([^}]*)\} \},$/gm)].map((m) => ({
    rules: Object.fromEntries([...m[1].matchAll(/'((?:[^'\\]|\\.)*)': 'off'/g)].map((r) => [r[1].replace(/\\(.)/g, '$1'), 'off'])),
  }));
  return { perFile, globals };
}

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
  const entries = eslintExemptEntries(perFile);
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
      const globs = { files: o.files.filter((f) => f !== OWNED_GLOB), excludeFiles: o.excludeFiles ?? [] };
      out.set(k, isOn(v) ? { id: k, home: home(k), warnOnly: warnOnly(v), globs } : { id: k, home: home(k), off: true });
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
/** ESLint reports a generated rule under the carrier with the rule's own message (no tag in getff's config). */
const carrierMessage = (c) => c.entry.message.replace(TAG_RE, '');
function placedEslint(root, sampleDir, carriers) {
  const stack = recordField(root, 'stack');
  const bin = join(root, 'node_modules/.bin/eslint');
  const stackRules = (STACK_RULES[stack] ?? []).filter((r) => !r.notPlaced && r.rule !== CARRIER);
  const cands = [...stackRules.map((r) => ({ id: r.rule, files: r.files, excludeFiles: r.excludeFiles ?? [] })), ...BUILTINS.map((b) => ({ id: b, files: ['**/*'] }))];
  const configs = new Map();
  const configFor = (rel) => {
    if (!configs.has(rel)) {
      try {
        configs.set(rel, JSON.parse(sh(bin, ['--print-config', rel], root).stdout).rules ?? {});
      } catch {
        configs.set(rel, {});
      }
    }
    return configs.get(rel);
  };
  const out = [];
  for (const c of cands) {
    const rel = sampleRelFor(c.files, c.id, samplesFor(root, c.id, carriers)?.bad.ext ?? 'ts', sampleDir);
    if (!rel) {
      out.push({ id: c.id, home: `eslint ${c.id}`, unreachable: `its files globs (${c.files.join(', ')}) name no path the proof writes into` });
      continue;
    }
    const setting = configFor(rel)[c.id];
    if (isOn(setting)) out.push({ id: c.id, home: `eslint ${c.id}`, rel, warnOnly: warnOnly(setting), globs: { files: c.files, excludeFiles: c.excludeFiles ?? [] } });
  }
  // A generated rule is on where the carrier's options hold its message: the plain sample path first, then
  // one path under each stack rule's globs (getff's own config switches the carrier on boundary globs).
  const paths = [posix(join(sampleDir, 'x.bad.ts')), ...stackRules.map((r) => sampleRelFor(r.files, 'x', 'ts', sampleDir)).filter(Boolean)];
  for (const c of carriers) {
    for (const rel of paths) {
      const v = configFor(rel)[CARRIER];
      if (isOn(v) && Array.isArray(v) && v.slice(1).some((e) => plain(e) && (e.message === c.entry.message || e.message === carrierMessage(c)))) {
        out.push({ id: `getff:${c.id}`, home: `eslint ${CARRIER} (message of ${c.id})`, rel: rel.replace(/x\.bad\.ts$/, `${c.id}.bad.ts`), warnOnly: warnOnly(v) });
        break;
      }
    }
  }
  return out;
}
/** A sample path under the sample dir that `files` globs match: `**\/api/**\/*.{ts,tsx}` → `api/x/<id>.bad.ts`. */
function sampleRelFor(globs, id, ext, sampleDir) {
  for (const g of globs) {
    if (!g.startsWith('**/')) continue;
    const parts = g.slice(3).split('/');
    const last = parts.pop();
    // `**/*` names no extension: the sample keeps its own (a `.*` path matches no config entry).
    const alts = last === '*' ? [ext] : (/\{([^}]*)\}/.exec(last)?.[1]?.split(',') ?? [last.replace(/^\*\./, '')]);
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
function excludeOnce(root, name = `${PROOF_DIR}/`) {
  const r = sh('git', ['rev-parse', '--git-path', 'info/exclude'], root);
  if (r.rc !== 0) return;
  const p = resolve(root, r.stdout.trim());
  mkdirSync(dirname(p), { recursive: true });
  const text = existsSync(p) ? readFileSync(p, 'utf8') : '';
  if (!text.split('\n').includes(name)) appendFileSync(p, `${text && !text.endsWith('\n') ? '\n' : ''}${name}\n`);
}

/** Every placed rule's bad and good example through the project's own lint command.
 *  → { early } when nothing can be proven here, else { linter, rules, outcomes: Map id → outcome, summary }.
 *  An outcome: { kind: off | unreachable | no-samples | silent | good-rejected | proved | by-exit | by-exit-failed,
 *  detail, proof }. */
export function runProof(root, { lint = realLint } = {}) {
  const linter = oxlintConfig(root) ? 'oxlint' : eslintConfig(root) ? 'eslint' : undefined;
  if (!linter) return { early: 'no .oxlintrc.json and no eslint.config.* in this project' };
  const shape = lintShape(root);
  if (shape.kind === 'none') return { early: "package.json has no lint script, and getff proves a rule only through the project's own lint command" };
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
    const outcomes = new Map();
    const todo = [];
    for (const r of rules) {
      if (r.off) outcomes.set(r.id, { kind: 'off', detail: 'switched off in the config', proof: '—' });
      else if (r.unreachable) outcomes.set(r.id, { kind: 'unreachable', detail: `not proved: ${r.unreachable}`, proof: '—' });
      else {
        const s = samplesFor(root, r.id, carriers);
        if (!s) outcomes.set(r.id, { kind: 'no-samples', detail: 'getff has no bad/good example for it', proof: '—' });
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
    // An untagged carrier diagnostic (getff's ESLint config) belongs to the generated rule with that message.
    const attribute = (diags) => diags.map((d) => {
      if (d.id !== CARRIER) return d;
      const c = carriers.find((x) => d.message === x.entry.message || d.message === carrierMessage(x));
      return c ? { ...d, id: `getff:${c.id}` } : d;
    });
    let summary = '';
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
      const goodRc = script(todo.map((t) => t.good));
      for (const t of todo) {
        const b = perRule.get(t.id);
        const proof = `bad→exit ${b} · good→exit ${goodRc}, by exit code (the lint script sets its own output format)`;
        outcomes.set(t.id, b !== 0 && goodRc === 0 ? { kind: 'by-exit', detail: '', proof } : { kind: 'by-exit-failed', detail: `bad → exit ${b} · good → exit ${goodRc}`, proof });
      }
      summary = `bad samples → exit per rule · good batch → exit ${goodRc} (npm run lint -- <sample> in ${dirRel}, once per rule: the lint script sets its own output format)`;
    } else if (todo.length) {
      // Sample FILES, never the directory: oxlint skips an excluded directory given as a path, and lints an
      // excluded file given as a path (measured, oxlint 1.86.0).
      for (const t of todo) put(t.bad, t.s.bad.text);
      const b = lint(root, { paths: todo.map((t) => t.bad) });
      clean();
      for (const t of todo) put(t.good, t.s.good.text);
      const g = lint(root, { paths: todo.map((t) => t.good) });
      const bd = attribute(b.diags);
      const gd = attribute(g.diags);
      const how = (b.how ?? '').replace(/ \S*__getff_proof__\S*(?: \S*__getff_proof__\S*)*$/, ` <${todo.length} samples in ${dirRel}>`);
      summary = `bad batch → exit ${b.rc} · good batch → exit ${g.rc} (${how})`;
      for (const t of todo) {
        const fired = bd.some((d) => d.id === t.id && d.file === t.bad);
        const onGood = [...new Set(gd.filter((d) => d.file === t.good && d.error).map((d) => d.id))];
        if (!fired) {
          const said = bd.filter((d) => d.file === t.bad).map((d) => d.message)[0];
          outcomes.set(t.id, { kind: 'silent', detail: `no diagnostic on the bad example${said ? ` (the linter said: ${said})` : ''}`, proof: `bad→exit ${b.rc}, no diagnostic of this rule · good→exit ${g.rc}` });
        } else if (onGood.length) {
          outcomes.set(t.id, { kind: 'good-rejected', detail: `good example rejected by ${onGood.join(', ')}`, proof: `bad→exit ${b.rc}, its own diagnostic · good→exit ${g.rc}, rejected by ${onGood.join(', ')}` });
        } else {
          outcomes.set(t.id, { kind: 'proved', detail: '', proof: `bad→exit ${b.rc}, its own diagnostic · good→exit ${g.rc}, clean` });
        }
      }
    }
    return { linter, shape, rules, outcomes, summary };
  } finally {
    clean();
    process.removeListener('exit', clean);
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  }
}

// ─── The table ──────────────────────────────────────────────────────────────────────────────────────
// One row per rule: rule · principle · home · status · reason · proof · reached by. Printed, never stored.
// `fires` = the proof passed AND `npm run lint` is armed in the committed record AND a pre-commit, pre-push or
// CI step runs it, with no file exempted; `partial` = proven with a named gap; `not_wired` = the rest.
export const STATUSES = ['fires', 'partial', 'not_wired'];
const LINT_CMD = 'npm run lint';
export const BASE_CORE = '.claude/skills/getff/references/base-core.md';
/** The other half of H8 (base-core.md, «The lint plugin»; prove-rules-parity.test.ts holds the two to it). */
export const BUILTIN_PRINCIPLE = { 'no-throw-literal': 'H8', 'no-empty': 'H8' };
const CARRIER_NAME = CARRIER.slice('rules-as-tests/'.length);

/** base-core.md's table → rows; a status outside the closed set is an error, never a row. */
export function readBaseCore(root) {
  const p = join(root, BASE_CORE);
  if (!existsSync(p)) return null;
  const lines = readFileSync(p, 'utf8').split('\n');
  const h = lines.findIndex((l) => /^\| id \| principle \|/.test(l));
  if (h < 0) throw new Error(`base-core.md: no table with an «id | principle» header in ${BASE_CORE}`);
  const cells = (l) => l.slice(1, l.lastIndexOf('|')).split('|').map((s) => s.trim().replace(/^`(.*)`$/, '$1'));
  const head = cells(lines[h]);
  const col = (name) => head.indexOf(name);
  const out = [];
  for (let i = h + 2; i < lines.length && lines[i].startsWith('|'); i++) {
    const c = cells(lines[i]);
    const status = c[col('status')];
    if (!STATUSES.includes(status)) throw new Error(`base-core.md row ${c[0]}: status «${status}» is not one of ${STATUSES.join(' | ')}`);
    out.push({ id: c[0], status, reason: c[col('reason')], plugin: c[col('plugin rule')], notOnStack: c[col('not on stack')].split(',').map((s) => s.trim()) });
  }
  return out;
}

/** The project-checks record: key lines, the extra lines the passes add, the armed and not-armed commands. */
function readRecord(root) {
  const p = join(root, '.ai-factory/tool-decisions.md');
  if (!existsSync(p)) return null;
  const text = readFileSync(p, 'utf8').replace(/\r/g, '');
  const m = /<!-- aif:project-checks:begin -->\n([\s\S]*?)<!-- aif:project-checks:end -->/.exec(text);
  if (!m) return null;
  const rec = { fields: {}, lines: [], armed: [], notArmed: [] };
  let section = null;
  for (const l of m[1].split('\n')) {
    if (l === 'armed:' || l === 'not-armed:') section = l === 'armed:' ? rec.armed : rec.notArmed;
    else if (section && l.startsWith('- ')) section.push(l.slice(2).replace(/ # .*$/, ''));
    else if (!section && /^[a-z-]+: /.test(l)) {
      rec.lines.push(l);
      const [k, ...v] = l.split(': ');
      rec.fields[k] ??= v.join(': ');
    }
  }
  return rec;
}
function sidecar(root) {
  const r = sh('git', ['rev-parse', '--absolute-git-dir'], root);
  const p = r.rc === 0 ? join(r.stdout.trim(), 'getff-armed.local') : join(root, '.ai-factory/project-checks.local');
  let rel = posix(relative(root, p));
  try {
    rel = posix(relative(realpathSync(root), realpathSync(dirname(p)))) + '/' + 'getff-armed.local';
  } catch {
    /* keep rel */
  }
  return { rel: rel.replace(/^\.\//, ''), lines: existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean) : [] };
}

/** The steps that run the project's lint: husky's pre-commit (directly or through lint-staged), pre-push, CI. */
function lintChannels(root) {
  const read = (rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : '');
  const runsLint = (t) => t.includes(LINT_CMD) || /run-armed\.sh validate\b/.test(t);
  const out = [];
  const pre = read('.husky/pre-commit');
  let staged = read('.lintstagedrc.json') + read('.lintstagedrc');
  try {
    staged += JSON.stringify(readJson(join(root, 'package.json'))['lint-staged'] ?? '');
  } catch {
    /* no package.json */
  }
  if (/\blint-staged\b/.test(pre) && (staged.includes(`'${LINT_CMD}'`) || /\b(oxlint|eslint)\b/.test(staged))) out.push('pre-commit (lint-staged)');
  if (runsLint(pre)) out.push('pre-commit');
  if (runsLint(read('.husky/pre-push'))) out.push('pre-push');
  const wf = join(root, '.github/workflows');
  if (existsSync(wf)) {
    for (const f of readdirSync(wf).filter((x) => /\.ya?ml$/.test(x)).sort()) if (runsLint(read(`.github/workflows/${f}`))) out.push(`CI (.github/workflows/${f})`);
  }
  return out;
}

/** A glob as a RegExp over a project-relative posix path (`**`, `*`, `?`, `{a,b}`, `\x` literal). */
const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
function globRe(g) {
  let re = '';
  for (let i = 0; i < g.length; ) {
    const c = g[i];
    if (c === '\\') {
      re += reEscape(g[i + 1] ?? '');
      i += 2;
    } else if (c === '*' && g[i + 1] === '*') {
      if (g[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 3;
      } else {
        re += '.*';
        i += 2;
      }
    } else if (c === '*') {
      re += '[^/]*';
      i++;
    } else if (c === '?') {
      re += '[^/]';
      i++;
    } else if (c === '{' && g.indexOf('}', i) > i) {
      const j = g.indexOf('}', i);
      re += `(?:${g.slice(i + 1, j).split(',').map(reEscape).join('|')})`;
      i = j + 1;
    } else {
      re += reEscape(c);
      i++;
    }
  }
  return new RegExp(`^${re}$`);
}
const unescapeGlob = (p) => p.replace(/\\(.)/g, '$1');
/** The project's source files as git lists them (tracked and untracked, ignores applied). oxlint exposes no
 *  file listing, so «M files the rule's globs match» counts these, not the linter's own list. */
function sourceFiles(root) {
  const r = sh('git', ['ls-files', '--cached', '--others', '--exclude-standard'], root);
  if (r.rc !== 0) return null;
  return r.stdout.split('\n').filter((f) => /\.[cm]?[jt]sx?$/.test(f) && !f.includes(`${PROOF_DIR}/`));
}

/** The existing violations getff exempted, per rule id → sorted file list. */
function exemptions(root, linter) {
  const out = new Map();
  const add = (id, f) => {
    if (!out.has(id)) out.set(id, new Set());
    out.get(id).add(f);
  };
  if (linter === 'oxlint') {
    for (const [f, ids] of oxlintExemptPairs(readJson(oxlintConfig(root)))) for (const id of ids) add(id, f);
  } else if (linter === 'eslint') {
    const block = eslintExemptBlock(readFileSync(eslintConfig(root), 'utf8'));
    for (const [f, ids] of block?.perFile ?? []) for (const id of ids) add(id, f);
    const sup = join(root, 'eslint-suppressions.json');
    if (existsSync(sup)) {
      try {
        for (const [f, rules] of Object.entries(readJson(sup))) for (const id of Object.keys(rules ?? {})) add(id, f);
      } catch {
        /* unreadable suppressions: nothing listed */
      }
    }
  }
  return new Map([...out].map(([k, v]) => [k, [...v].sort()]));
}

/** The research side: dropped, research-only and not-generated entries, from the record and the plan. */
function researchRows(root, stack, rec, manifest) {
  const planRel = `.ai-factory/rules-research/${stack}.research.json`;
  const row = (rule, principle, reason) => ({ rule, principle, home: '—', status: 'not_wired', reason, proof: '—', reached: '—' });
  const lines = rec?.lines ?? [];
  const rejected = lines.find((l) => l.startsWith('research-rejected: '));
  if (!existsSync(join(root, planRel))) return { rows: [row('research', '—', `not done: no ${planRel}`)], principleOf: () => undefined };
  let entries = [];
  try {
    entries = readJson(join(root, planRel)).patterns ?? [];
  } catch (e) {
    return { rows: [row('research', '—', `${planRel} is not valid JSON: ${e.message}`)], principleOf: () => undefined };
  }
  const principleOf = (id) => entries.find((x) => x?.id === id)?.extras?.principle;
  const pr = (id) => principleOf(id) || 'stack docs';
  if (rejected) return { rows: [row('research', '—', `research plan rejected: ${rejected.slice('research-rejected: '.length)}`)], principleOf };
  const kv = (prefix) => new Map(lines.filter((l) => l.startsWith(prefix)).map((l) => {
    const [id, ...why] = l.slice(prefix.length).split(' — ');
    return [id, why.join(' — ')];
  }));
  const dropped = kv('research-dropped: ');
  const only = kv('research-only: ');
  const generated = new Set(Object.values(manifest).map((r) => r?.research?.entryId));
  const ran = dropped.size || only.size || Object.keys(manifest).length;
  const out = [];
  const ids = [...new Set([...entries.map((x) => x?.id).filter(Boolean), ...dropped.keys(), ...only.keys()])];
  for (const id of ids) {
    if (generated.has(id)) continue; // its generated rule has the row
    if (dropped.has(id)) out.push(row(id, pr(id), `research entry dropped: ${dropped.get(id)}`));
    else if (only.has(id)) out.push(row(id, pr(id), `research only: ${only.get(id) || 'no selection rule generates it, or the selection routes it to manual'}`));
    else out.push(row(id, pr(id), ran ? 'selected, but the generator made no rule from it' : "not generated yet: the rule generator runs in the install's --full pass"));
  }
  return { rows: out, principleOf };
}

/** The table's lines and exit code: 2 when base-core.md breaks its closed status set, 1 when a placed rule
 *  failed its proof, else 0. */
export function table(root, { lint = realLint } = {}) {
  let core;
  try {
    core = readBaseCore(root);
  } catch (e) {
    return { rc: 2, lines: [], errors: [e.message] };
  }
  const rec = readRecord(root);
  const stack = rec?.fields.stack ?? 'unknown';
  const recLinter = rec?.fields.linter;
  const carriers = generatedCarriers(root);
  let manifest = {};
  try {
    const p = join(root, '.ai-factory/synthesizer-output/rules-manifest-additions.json');
    if (existsSync(p)) manifest = readJson(p);
  } catch {
    manifest = {};
  }
  const research = researchRows(root, stack, rec, manifest);
  const proof = recLinter === 'biome' ? { early: 'this project lints with Biome, which does not load ESLint-format rules' } : runProof(root, { lint });
  const placed = new Map((proof.rules ?? []).map((r) => [r.id, r]));
  const exempt = proof.early ? new Map() : exemptions(root, proof.linter);
  const files = proof.early ? null : sourceFiles(root);
  const channels = lintChannels(root);
  const side = sidecar(root);
  const armState = !rec
    ? 'no project-checks record in .ai-factory/tool-decisions.md'
    : rec.armed.includes(LINT_CMD)
      ? null
      : rec.notArmed.includes(LINT_CMD) && side.lines.includes(LINT_CMD)
        ? `${LINT_CMD} is armed in this clone only (${side.rel}) until the next commit folds it into the record`
        : `${LINT_CMD} is not armed in the project-checks record`;
  const cloneOnly = rec && !rec.armed.includes(LINT_CMD) && side.lines.includes(LINT_CMD);
  const reached = channels.length ? channels.join(', ') + (cloneOnly ? ' — this clone only until the next commit' : '') : '—';
  const notPlaced = new Map((rec?.lines ?? []).filter((l) => l.startsWith('rule-not-placed: ')).map((l) => {
    const [id, ...why] = l.slice('rule-not-placed: '.length).split(' — ');
    return [id, why.join(' — ')];
  }));

  // The population: base-core's plugin rules, the stack's rule set, the built-ins, the generated rules, and any
  // other getff rule the config switches on.
  const pluginPrinciples = new Map();
  for (const r of core ?? []) {
    if (r.plugin && r.plugin !== '—' && r.plugin !== CARRIER_NAME) {
      const id = `rules-as-tests/${r.plugin}`;
      pluginPrinciples.set(id, [...(pluginPrinciples.get(id) ?? []), r]);
    }
  }
  const stackRules = STACK_RULES[stack] ?? [];
  const ids = [
    ...pluginPrinciples.keys(),
    ...stackRules.map((r) => r.rule).filter((r) => r !== CARRIER),
    ...BUILTINS,
    ...Object.keys(manifest).map((g) => `getff:${g}`),
    ...placed.keys(),
  ];
  const principleOf = (id) => {
    if (id.startsWith('getff:')) return research.principleOf(manifest[id.slice(6)]?.research?.entryId) || 'stack docs';
    if (BUILTIN_PRINCIPLE[id]) return BUILTIN_PRINCIPLE[id];
    return (pluginPrinciples.get(id) ?? []).map((r) => r.id).join(', ') || 'stack docs';
  };
  const whyNotPlaced = (id) => {
    if (proof.early) return proof.early;
    if (notPlaced.has(id)) return notPlaced.get(id);
    if (notPlaced.has('*')) return notPlaced.get('*');
    const sr = stackRules.find((r) => r.rule === id);
    if (id.startsWith('getff:')) {
      const m = manifest[id.slice(6)];
      if (!(m?.check?.type === 'declarative' && (m.check.engine ?? 'eslint-restricted') === 'eslint-restricted')) {
        return "not a selector rule: getff places only eslint-restricted selector rules in the project's linter";
      }
      return `not in the ${proof.linter} config`;
    }
    if (sr?.notPlaced) return sr.notPlaced;
    if (sr?.strict) return `opt-in: switched on only with AIF_STRICT_RUNTIME=1`;
    if ((pluginPrinciples.get(id) ?? []).some((r) => r.notOnStack.includes(stack))) return `not on stack ${stack}`;
    if (id.startsWith('rules-as-tests/') && !sr) return `the ${stack} rule set does not switch it on`;
    if (proof.linter === 'oxlint') {
      const v = readJson(oxlintConfig(root)).rules?.[id];
      if (v !== undefined) return `your config sets it to ${JSON.stringify(v)} — getff keeps your setting`;
    }
    return `not in the ${proof.linter} config`;
  };
  const count = (globs) => {
    if (!files || !globs) return '?';
    const inc = globs.files.map(globRe);
    const exc = (globs.excludeFiles ?? []).map(globRe);
    return files.filter((f) => inc.some((r) => r.test(f)) && !exc.some((r) => r.test(f))).length;
  };
  let failed = false;
  const out = [];
  for (const id of [...new Set(ids)]) {
    const p = placed.get(id);
    const principle = principleOf(id);
    if (!p) {
      out.push({ rule: id, principle, home: '—', status: 'not_wired', reason: whyNotPlaced(id), proof: '—', reached: '—' });
      continue;
    }
    const o = proof.outcomes.get(id);
    const row = { rule: id, principle, home: p.home, status: 'not_wired', reason: o.detail, proof: o.proof, reached };
    if (['off', 'no-samples', 'silent', 'by-exit-failed'].includes(o.kind)) failed = true;
    else if (o.kind === 'good-rejected') {
      failed = true;
      row.status = 'partial';
    } else if (o.kind === 'unreachable') row.status = 'partial';
    else {
      const gaps = [];
      if (proof.shape.kind === 'chain') gaps.push(`proved through the linter binary, the lint script is a chain: ${proof.shape.script}`);
      if (p.warnOnly) gaps.push('warns only: the lint exits 0 on a warning');
      const ex = exempt.get(id) ?? [];
      if (ex.length) gaps.push(`exempt ${ex.length} of ${count(p.globs ?? { files: ['**/*'] })} files the rule's globs match`);
      if (armState) gaps.push(armState);
      if (!channels.length) gaps.push(`no pre-commit, pre-push or CI step runs ${LINT_CMD}`);
      row.status = gaps.length ? 'partial' : 'fires';
      row.reason = gaps.join('; ') || '—';
    }
    out.push(row);
  }
  // A principle base-core leaves to a generated rule, with no generated rule serving it here.
  const served = new Set(out.filter((r) => r.rule.startsWith('getff:')).flatMap((r) => r.principle.split(', ')));
  for (const r of core ?? []) {
    if (r.plugin === CARRIER_NAME && r.status === 'not_wired' && r.reason === 'generated-pending' && !served.has(r.id)) {
      out.push({ rule: '(none yet)', principle: r.id, home: '—', status: 'not_wired', reason: `generated-pending: no generated rule serves ${r.id} in this project`, proof: '—', reached: '—' });
    }
  }
  out.push(...research.rows);

  const cell = (s) => String(s).replace(/\|/g, '\\|');
  const lines = [
    `getff's rules in this project (stack ${stack}) — one row per rule`,
    '| rule | principle | home | status | reason | proof | reached by |',
    '|---|---|---|---|---|---|---|',
    ...out.map((r) => `| ${[r.rule, r.principle, r.home, r.status, r.reason, r.proof, r.reached].map(cell).join(' | ')} |`),
  ];
  if (!core) lines.push(`principles: ${BASE_CORE} is not in this project, so the principle column names none of the base core`);
  for (const r of out) for (const f of exempt.get(r.rule) ?? []) lines.push(`existing violation: ${r.rule} in ${f}`);
  if (proof.summary) lines.push(proof.summary);
  return { rc: failed ? 1 : 0, lines, errors: [] };
}
/** Kept for the callers of scope C: the proof is the table. */
export const prove = table;

// ─── The shrink ─────────────────────────────────────────────────────────────────────────────────────
// A baseline of existing violations only ever shrinks (operator log entry 28, fork 1 = A). scripts/run-armed.sh
// runs `--shrink` after its probe while `npm run lint` is armed: it measures what was fixed since, only when the
// lint exits 0, and writes that to a sidecar in the git dir — the tree is untouched. The shipped pre-commit's
// `run-armed.sh --fold` runs `--fold-shrink`: the tracked baseline and the record's lint-baseline line change in
// the working tree and in the index — the path P2's arm flip takes. Applying only removes: a count drops to what
// the probe measured, never rises, and an entry the probe did not measure is kept as it is.
const SUPPRESSIONS = 'eslint-suppressions.json';
const RECORD = '.ai-factory/tool-decisions.md';
const SHRINK_CONFIGS = ['.oxlintrc.getff-shrink.json', ...['mjs', 'js', 'cjs', 'ts', 'mts', 'cts'].map((e) => `eslint.config.getff-shrink.${e}`)];
const countOf = (sup) => Object.values(sup ?? {}).reduce((n, rules) => n + Object.values(rules ?? {}).reduce((m, r) => m + (r?.count ?? 0), 0), 0);
const exemptKind = (rel) => (rel === '.oxlintrc.json' ? 'oxlint' : /^eslint\.config\.[cm]?[jt]s$/.test(rel) ? 'eslint' : undefined);
function exemptPairsOf(kind, text) {
  if (kind === 'oxlint') return oxlintExemptPairs(JSON.parse(text));
  return eslintExemptBlock(text)?.perFile ?? new Map();
}

function shrinkSuppressions(root, dir) {
  const shape = lintShape(root);
  if (!existsSync(join(root, SUPPRESSIONS))) return { lines: [`· lint baseline ${SUPPRESSIONS} not shrunk: the file is not in this project`] };
  if (shape.linter !== 'eslint' || shape.kind === 'chain') {
    return { lines: [`· lint baseline ${SUPPRESSIONS} not shrunk: the lint script is not one eslint call (${shape.script ?? 'no lint script'})`] };
  }
  const copy = join(dir, 'getff-eslint-suppressions.tmp');
  try {
    const base = readJson(join(root, SUPPRESSIONS));
    writeFileSync(copy, JSON.stringify(base));
    const r = sh('npm', ['run', '--silent', 'lint', '--', '--prune-suppressions', '--suppressions-location', copy], root);
    if (r.rc !== 0) return { lines: [`· lint baseline ${SUPPRESSIONS} not shrunk: npm run lint exits ${r.rc}`] };
    const next = readJson(copy);
    const [n, m] = [countOf(base), countOf(next)];
    if (m >= n) return { lines: [`· lint baseline ${SUPPRESSIONS}: ${n} findings, none fixed yet`] };
    return { lines: [`✓ lint baseline ${SUPPRESSIONS}: ${n} → ${m} findings — the next commit folds it in`], part: { kind: 'suppressions', base, next } };
  } catch (e) {
    return { lines: [`· lint baseline ${SUPPRESSIONS} not shrunk: ${e.message}`] };
  } finally {
    rmSync(copy, { force: true });
  }
}

/** Each exempted rule, per file, linted with getff's exemptions taken out: a pair with no diagnostic is fixed. */
function shrinkExempt(root, rel) {
  const kind = exemptKind(rel);
  if (!kind || !existsSync(join(root, rel))) return { lines: [`· lint baseline ${rel} not shrunk: getff keeps per-file exemptions only in .oxlintrc.json or eslint.config.*`] };
  const text = readFileSync(join(root, rel), 'utf8');
  const perFile = exemptPairsOf(kind, text);
  if (!perFile.size) return { lines: [] };
  const lint = sh('npm', ['run', '--silent', 'lint'], root);
  if (lint.rc !== 0) return { lines: [`· lint baseline ${rel} not shrunk: npm run lint exits ${lint.rc}`] };
  const files = [...perFile.keys()].filter((f) => existsSync(join(root, f)));
  let diags = [];
  if (files.length) {
    const tmp = join(root, kind === 'oxlint' ? SHRINK_CONFIGS[0] : rel.replace(/^eslint\.config\./, 'eslint.config.getff-shrink.'));
    excludeOnce(root, relative(root, tmp));
    try {
      if (kind === 'oxlint') {
        const cfg = JSON.parse(text);
        cfg.overrides = (cfg.overrides ?? []).filter((o) => !o?.files?.includes(EXEMPT_GLOB));
        writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n');
      } else writeFileSync(tmp, withoutEslintBlock(text));
      const r = sh(join(root, 'node_modules/.bin', kind), ['-c', tmp, '-f', 'json', ...files], root);
      const report = parseReport(r.stdout, root);
      if (report === null) return { lines: [`· lint baseline ${rel} not shrunk: ${kind} gave no report getff can read: ${firstLine(r.stdout + r.stderr)}`] };
      diags = report.filter((d) => perFile.get(d.file)?.has(d.id));
    } finally {
      rmSync(tmp, { force: true });
    }
  }
  const dirty = new Set(diags.map((d) => `${d.id}\0${d.file}`));
  const clean = [...perFile].flatMap(([f, ids]) => [...ids].filter((id) => !dirty.has(`${id}\0${f}`)).map((id) => [id, f]));
  const before = perFile.size;
  if (!clean.length) return { lines: [`· lint baseline ${rel}: getff's per-file exemptions for ${before} files, none fixed yet`] };
  const after = [...perFile].filter(([f, ids]) => [...ids].some((id) => dirty.has(`${id}\0${f}`))).length;
  const fixed = clean.map(([id, f]) => `${id} in ${f}`).join(', ');
  return {
    lines: [`✓ lint baseline ${rel}: getff's per-file exemptions ${before} → ${after} files (fixed: ${fixed}) — the next commit folds it in`],
    part: { kind, clean, violations: diags.length },
  };
}

/** `--shrink`: every lint-baseline line of the record, measured; the fixed part goes to `out`, else `out` goes. */
export function shrinkProbe(root, out) {
  for (const f of SHRINK_CONFIGS) rmSync(join(root, f), { force: true }); // a run killed at its bound
  const rec = join(root, RECORD);
  const rels = existsSync(rec)
    ? readFileSync(rec, 'utf8').split('\n').filter((l) => l.startsWith('lint-baseline: ')).map((l) => l.slice('lint-baseline: '.length).split(' — ')[0])
    : [];
  const lines = [];
  const parts = {};
  for (const rel of rels) {
    const r = rel === SUPPRESSIONS ? shrinkSuppressions(root, dirname(out)) : shrinkExempt(root, rel);
    lines.push(...r.lines);
    if (r.part) parts[rel] = r.part;
  }
  if (Object.keys(parts).length) writeFileSync(out, JSON.stringify({ parts }) + '\n');
  else rmSync(out, { force: true });
  return lines;
}

/** One version (working tree or index) of a baseline file with the probe's result applied; null = no change. */
function applyShrink(part, text) {
  if (part.kind === 'suppressions') {
    const cur = JSON.parse(text);
    let changed = false;
    for (const [f, rules] of Object.entries(cur)) {
      for (const [r, v] of Object.entries(rules ?? {})) {
        if (part.base[f]?.[r] === undefined) continue; // not measured by the probe: kept
        const n = part.next[f]?.[r]?.count ?? 0;
        if (n >= (v?.count ?? 0)) continue;
        changed = true;
        if (n > 0) rules[r] = { ...v, count: n };
        else delete rules[r];
      }
      if (!Object.keys(cur[f] ?? {}).length) delete cur[f];
    }
    return changed ? JSON.stringify(cur, null, 2) + (text.endsWith('\n') ? '\n' : '') : null;
  }
  const perFile = exemptPairsOf(part.kind, text);
  let changed = false;
  for (const [id, f] of part.clean) {
    if (perFile.get(f)?.delete(id)) changed = true;
    if (perFile.get(f)?.size === 0) perFile.delete(f);
  }
  if (!changed) return null;
  if (part.kind === 'oxlint') {
    const cfg = JSON.parse(text);
    cfg.overrides = [...(cfg.overrides ?? []).filter((o) => !o?.files?.includes(EXEMPT_GLOB)), ...oxlintExemptEntries(cfg, perFile)];
    if (!cfg.overrides.length) delete cfg.overrides;
    return JSON.stringify(cfg, null, indentOf(text)) + (text.endsWith('\n') ? '\n' : '');
  }
  const entries = [...eslintExemptEntries(perFile), ...eslintExemptBlock(text).globals];
  return entries.length ? withEslintBlock(text, eslintBlockLines(entries)) : withoutEslintBlock(text);
}

/** The record's lint-baseline line for `rel`, with the counts of that version of the baseline file. */
function applyRecordLine(text, rel, part, fileText) {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => l.startsWith(`lint-baseline: ${rel} — `));
  if (i < 0) return text;
  if (part.kind === 'suppressions') {
    lines[i] = lines[i].replace(/— \S+ findings in existing code recorded/, `— ${countOf(JSON.parse(fileText))} findings in existing code recorded`);
  } else {
    const files = exemptPairsOf(part.kind, fileText).size;
    lines[i] = lines[i].replace(/for \d+ existing violations in \d+ files/, `for ${part.violations} existing violations in ${files} files`);
  }
  return lines.join('\n');
}

function gitRun(root, args, input) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', input });
  return { rc: r.status ?? 1, stdout: r.stdout ?? '' };
}
/** `rel` in the index: its mode and path from the top, or null when git does not track it. */
function indexEntry(root, rel) {
  const r = gitRun(root, ['ls-files', '-s', '--full-name', '--', rel]);
  const m = /^(\d+) [0-9a-f]+ \d\t(.+)$/m.exec(r.stdout);
  return r.rc === 0 && m ? { mode: m[1], path: m[2] } : null;
}
function stage(root, entry, text) {
  const h = gitRun(root, ['hash-object', '-w', '--stdin'], text);
  return h.rc === 0 && gitRun(root, ['update-index', '--cacheinfo', `${entry.mode},${h.stdout.trim()},${entry.path}`]).rc === 0;
}

/** `--fold-shrink`: the sidecar applied to the working tree and the index. Returns [lines, ok]. */
export function foldShrink(root, sidecar) {
  const { parts } = readJson(sidecar);
  const lines = [];
  let ok = true;
  const versions = [
    { name: 'wt', read: (rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : null), write: (rel, t) => (writeFileSync(join(root, rel), t), true) },
    {
      name: 'index',
      read: (rel) => (indexEntry(root, rel) ? gitRun(root, ['show', `:./${rel}`]).stdout : null),
      write: (rel, t) => stage(root, indexEntry(root, rel), t),
    },
  ];
  for (const v of versions) {
    let rec = v.read(RECORD);
    const folded = [];
    for (const [rel, part] of Object.entries(parts)) {
      const text = v.read(rel);
      if (text === null) continue;
      const next = applyShrink(part, text);
      if (next === null) continue;
      if (!v.write(rel, next)) {
        ok = false;
        continue;
      }
      folded.push(rel);
      if (rec !== null) rec = applyRecordLine(rec, rel, part, next);
    }
    if (folded.length && rec !== null && rec !== v.read(RECORD) && !v.write(RECORD, rec)) ok = false;
    if (v.name === 'wt') {
      lines.push(folded.length ? `✓ lint baseline shrunk and staged with this commit: ${folded.join(', ')}` : '· lint baseline: nothing left to fold — the files already hold what the probe measured');
    }
  }
  return [lines, ok];
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
  if (argv[0] === '--shrink' && arg(argv, '--out')) {
    for (const l of shrinkProbe(root, resolve(arg(argv, '--out')))) console.log(l);
    return 0;
  }
  if (argv[0] === '--fold-shrink' && argv[1]) {
    const [lines, ok] = foldShrink(root, resolve(argv[1]));
    for (const l of lines) console.log(l);
    return ok ? 0 : 1;
  }
  if (argv.length === 0 || (argv.length === 1 && argv[0] === '--prove')) {
    const { rc, lines, errors } = table(root);
    for (const e of errors) console.error(`✗ ${e}`);
    for (const l of lines) console.log(l);
    return rc;
  }
  console.error('usage: node scripts/prove-rules.mjs [--prove] | --remove | --shrink --out <file> | --fold-shrink <file>');
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
