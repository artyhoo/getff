#!/usr/bin/env node
/**
 * census — the F.3 wiring-surface line classifier (input class 7, ref-gen §7 row 7).
 *
 * The ONLY place the nine invocation shapes and the shell quote rules live. A script is WIRED
 * iff some wiring surface references it in an execution shape on a non-comment line:
 *   S1 command position (line start, after `;`/`&&`/`||`/`|`/`(`/`$( `, or an env-assignment run)
 *   S2 after an invocation verb (bash, sh, node, npx tsx, tsx, source, exec)
 *   S3 a `for … in` list segment
 *   S4 inside `$( … )` command substitution
 *   S5 a spawn argument inside run( / execFileSync( / spawn( … )            (TS surfaces)
 *   S6 an ES import / dynamic import specifier
 *   S7 a package.json `scripts` value or a JSON `command` value
 *   S8 a workflow `run:` line (treated as a shell line)
 *   S9 a fully-quoted path token (`"$ROOT/scripts/x.sh"`) — the quote opens AT the token
 * plus the transitive closure through wired non-test scripts (closure does not pass through
 * test material), and shipped-by-path scripts (fingerprint) are members regardless.
 *
 * Quote rules (structural, not lexical — TD2-2/BU2-1; a token blocklist is NOT the mechanism):
 *   Q1 a line that starts inside an open string is a continuation and can wire nothing
 *      (check-hook-marker.sh:174-178 — the string opens at :174, the path lands on :178);
 *   Q2 a path inside a quoted region counts only when the quote opens at the path token and
 *      closes right after the basename (S9); `echo "run scripts/x.sh"` wires nothing.
 *
 * Comment rule: `#` outside quotes starts a comment (line start or after whitespace).
 * Cost, stated (§7 row 7): this is the one input class that reads shell text; a new quoting
 * construct (heredoc, $'…', backtick) can mis-classify — the falsifier is the census diff in
 * the same PR, and arm G's fixture set is the gate.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

/** The ten wiring surfaces (the LIST is the §7 row 6 pin; the classifier is row 7). */
export const WIRING_SURFACES = [
  { glob: 'packages/core/hooks/pre-push.ts', kind: 'ts' },
  { glob: '.github/workflows/', kind: 'yaml' },
  { glob: '.husky/', kind: 'shell' },
  { glob: 'package.json', kind: 'json-scripts' },
  { glob: '.claude/settings.json', kind: 'json-commands' },
  { glob: 'setup.d/', kind: 'shell' },
  { glob: 'Makefile', kind: 'shell' },
  { glob: 'install.sh', kind: 'shell' },
  { glob: '.claude/hooks/', kind: 'shell' },
  { glob: 'plugin/hooks/', kind: 'shell' },
];

const INVOCATION_VERBS = new Set(['bash', 'sh', 'node', 'tsx', 'source', 'exec']);
const SPAWN_FNS = ['run(', 'execFileSync(', 'spawn(', 'execSync('];

/** Scripts population: basenames of scripts/*.{sh,mjs} (test material flagged, not excluded).
 *  No self-exclusion: census.mjs and render-reference.mjs are population members like any
 *  other script — a pin that hides a file from its own census is not a §7-admitted input
 *  class, and both carry the conforming JSDoc line-3 header arm F demands. */
export function listScripts(root) {
  return readdirSync(join(root, 'scripts'))
    .filter((f) => f.endsWith('.sh') || f.endsWith('.mjs'))
    .sort()
    .map((f) => ({ name: f, testMaterial: /\.(test|spec)\./.test(f) }));
}

function isTestMaterial(relPath) {
  return /(^|\/)(tests?|__tests__|[^/]*fixtures)\//.test(relPath) || /\.(test|spec)\./.test(relPath);
}

/** Expand the surface list to concrete tracked files. */
export function listSurfaceFiles(root) {
  const out = [];
  for (const s of WIRING_SURFACES) {
    const abs = join(root, s.glob);
    if (s.glob.endsWith('/')) {
      if (!existsSync(abs)) continue;
      walk(abs, (p) => {
        const rel = relative(root, p);
        if (!isTestMaterial(rel)) out.push({ rel, kind: s.kind });
      });
    } else if (existsSync(abs)) {
      out.push({ rel: s.glob, kind: s.kind });
    }
  }
  return out;
}

function walk(dir, cb) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, cb);
    else cb(p);
  }
}

/**
 * Scan ONE text as a shell-ish line stream; call visit(name, lineNo, shape) for every
 * execution-shaped reference to scripts/<name>. Implements Q1/Q2 + S1-S4/S8/S9.
 * `known` = the population basenames — a sibling reference (`"$DIR/x.sh"`) matches only
 * when its basename is a known member, never on `.sh` shape alone.
 */
export function scanShellText(text, visit, known) {
  const lines = text.split('\n');
  let inString = null; // null | '"' | "'"
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i];
    if (inString !== null) {
      // Q1: continuation of a multi-line string — can wire nothing. Advance quote state only.
      inString = closeQuote(line, inString);
      continue;
    }
    if (isCommentLine(line)) continue;
    scanShellLine(line, lineNo, visit, known);
    const open = openEndedQuote(line);
    if (open !== null) inString = open;
  }
}

function isCommentLine(line) {
  return /^\s*(#|$)/.test(line);
}

/** If the line ends with an unterminated quote, return its char (Q1). */
function openEndedQuote(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q === '"') {
      if (c === '\\') i++;
      else if (c === '"') q = null;
    } else if (q === "'") {
      if (c === "'") q = null;
    } else if (c === '"' || c === "'") q = c;
  }
  return q;
}

function closeQuote(line, q) {
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q === '"') {
      if (c === '\\') i++;
      else if (c === '"') return null;
    } else if (q === "'" && c === "'") return null;
  }
  return q;
}

const SCRIPT_TOKEN_RE = /scripts\/([A-Za-z0-9._-]+\.(?:sh|mjs))/g;

/** Scan one non-comment, non-continuation shell line (S1-S4, S9). */
export function scanShellLine(line, lineNo, visit, known = null) {
  const seen = new Set();
  const once = (name, shape) => {
    const k = name + ':' + shape;
    if (!seen.has(k)) { seen.add(k); visit(name, lineNo, shape); }
  };
  // S9 + Q2: quoted PATH tokens — the quote opens at the token and a same-quote char closes
  // it with no whitespace inside. Matches `"$ROOT/scripts/x.sh"` and the sibling form
  // `"$DIR/x.sh"` (basename ∈ known). A quoted span with whitespace inside is prose and never
  // a path token (`echo "run scripts/x.sh"`); a non-path short span (`"$(`) is skipped and
  // scanning continues INSIDE it, so nested `"$("$DIR/x.sh" | …)"` still finds the inner token.
  for (let i = 0; i < line.length; i++) {
    const q = line[i];
    if (q !== '"' && q !== "'") continue;
    let j = i + 1;
    while (j < line.length && line[j] !== q && !/\s/.test(line[j])) j++;
    if (j < line.length && line[j] === q) {
      const inner = line.slice(i + 1, j);
      const t = inner.match(/^(?:\$\{?[A-Za-z_][A-Za-z0-9_]*\}?\/)*(?:\.\/)?(?:scripts\/)?([A-Za-z0-9._-]+\.(?:sh|mjs))$/);
      const name = t ? scriptName(t[1], known) : null;
      if (name) { once(name, 'quoted-path-token'); i = j; continue; }
    }
  }
  // Strip fully-quoted spans so the shape scan below sees only unquoted text (Q2: a path
  // inside prose or a message string must not wire via S1-S4).
  const bare = stripQuotedSpans(line);
  if (bare === null) return; // whole line is one quoted span
  // S1/S2/S3/S4 shape scan on the unquoted remainder. `$(` is kept as ONE token — a bare
  // paren class would split it into `$` + `(` and S4's substDepth could never increment.
  const tokens = bare.split(/(\s+|[;&|]+|\$\(|\(|\))/);
  let afterVerb = false;
  let inForList = false;
  let cmdPos = true; // line start is command position
  let substDepth = 0;
  for (const tok of tokens) {
    const t = tok.trim();
    if (t === '') continue;
    if (/^[;&|]+$/.test(t)) { cmdPos = true; afterVerb = false; continue; }
    if (t === '(' || t === '$(') { cmdPos = true; if (t === '$(') substDepth++; continue; }
    if (t === ')') { if (substDepth > 0) substDepth--; continue; }
    if (t === 'in' && inForListPending(tokens, tok)) { inForList = true; cmdPos = false; continue; }
    if (t === 'do' || t === 'done' || t === ';') { inForList = false; }
    if (INVOCATION_VERBS.has(t)) { afterVerb = true; cmdPos = false; continue; }
    const m = t.match(/^(?:\$\{?[A-Za-z_][A-Za-z0-9_]*\}?\/)*(?:\.\/)?scripts\/([A-Za-z0-9._-]+\.(?:sh|mjs))$/);
    const bare = known ? t.match(/^(?:\$\{?[A-Za-z_][A-Za-z0-9_]*\}?\/)*(?:\.\/)?([A-Za-z0-9._-]+\.(?:sh|mjs))$/) : null;
    const name = m ? m[1] : bare ? scriptName(bare[1], known) : null;
    if (name) {
      const shape = substDepth > 0 ? 'command-substitution'
        : inForList ? 'for-in-list'
        : afterVerb ? 'invocation-verb'
        : cmdPos ? 'command-position' : null;
      if (shape) once(name, shape);
    }
    // An env-assignment prefix keeps command position (FOO=1 bash scripts/x.sh).
    if (!/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) cmdPos = false;
    afterVerb = false;
  }
}

function inForListPending() {
  return true; // `for x in a b c; do` — `in` seen ⇒ list until do/done/;/newline
}

/** Resolve a token ending in .sh/.mjs to a population basename (null if not a member). */
function scriptName(base, known) {
  if (!known) return base;
  return known.has(base) ? base : null;
}

/**
 * Remove fully-quoted spans and unquoted comment tails from a shell line. A `$( … )` inside a
 * double-quoted span (or unquoted text) is still command position — its interior is EMITTED so
 * the shape scan sees it (§4 F.3: command position includes `$( … )`), e.g.
 * `V="$( node scripts/x.sh )"` wires via S4. Inside SINGLE quotes `$(` is literal and emits
 * nothing; quotes re-toggle normally inside the substitution.
 */
function stripQuotedSpans(line) {
  let out = '';
  let q = null;
  let subst = 0; // $( depth — open inside double quotes or unquoted text
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (subst > 0) {
      if (q === '"') {
        if (c === '\\') { i++; out += ' '; continue; }
        if (c === '"') { q = null; continue; }
      } else if (q === "'") {
        if (c === "'") { q = null; continue; }
      } else if (c === '"' || c === "'") { q = c; continue; }
      if (c === '(') { subst++; continue; }
      if (c === ')') { subst--; out += ' '; continue; }
      out += c;
      continue;
    }
    if (q === '"') {
      if (c === '\\') { i++; continue; }
      if (c === '$' && line[i + 1] === '(') { subst++; i++; out += ' $( '; continue; }
      if (c === '"') { q = null; continue; }
      continue;
    }
    if (q === "'") {
      if (c === "'") q = null;
      continue;
    }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '#') break; // comment till EOL (unquoted)
    if (c === '$' && line[i + 1] === '(') { subst++; i++; out += ' $( '; continue; }
    out += c;
  }
  return out;
}

/** Scan a TS/YAML/JSON surface for S5/S6/S7/S8 (+ shell shapes on run:/values). */
export function scanStructuredText(text, kind, visit, known = null) {
  if (kind === 'ts') {
    const lines = text.split('\n');
    lines.forEach((line, idx) => {
      const lineNo = idx + 1;
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      // S5/S6: attribute EACH quoted script specifier to its own statement — the keyword
      // closest BEFORE the specifier decides the shape (one line can carry both:
      // `run(["bash", "scripts/x.sh"]); await import("./twin.mjs")` wires x as the spawn
      // argument and twin as the import). A `scripts/`-prefixed specifier counts anywhere;
      // a bare sibling specifier (`./census-like.mjs`, the closure form inside scripts/*.mjs)
      // counts only when its basename is a known population member.
      for (const m of line.matchAll(/['"]([^'"]+)['"]/g)) {
        const inner = m[1];
        const scripted = inner.match(/scripts\/([A-Za-z0-9._-]+\.(?:sh|mjs))$/);
        const base = scripted ? null : inner.match(/^(?:\.\/|\.\.\/)*([A-Za-z0-9._-]+\.(?:sh|mjs))$/);
        const name = scripted ? scripted[1] : base ? scriptName(base[1], known) : null;
        if (!name) continue;
        const before = line.slice(0, m.index);
        const lastImport = before.lastIndexOf('import');
        const lastSpawn = Math.max(...SPAWN_FNS.map((f) => before.lastIndexOf(f)));
        const at = Math.max(lastImport, lastSpawn);
        if (at === -1) continue; // a quoted script with no execution context wires nothing
        visit(name, lineNo, at === lastImport ? 'es-import' : 'spawn-argument');
      }
    });
    return;
  }
  if (kind === 'yaml') {
    const lines = text.split('\n');
    lines.forEach((line, idx) => {
      const m = line.match(/^\s*(?:-\s*)?run:\s*(.*)$/); // S8
      if (m) {
        scanShellLine(stripYamlQuotes(m[1]), idx + 1, (n, l, s) => visit(n, l, 'workflow-run:' + s), known);
      }
      // `run: |` block: subsequent indented lines are the script body
      if (/^\s*(?:-\s*)?run:\s*[|>]/.test(line)) {
        const indent = line.match(/^\s*/)[0].length;
        for (let j = idx + 1; j < lines.length; j++) {
          const l2 = lines[j];
          if (l2.trim() !== '' && l2.match(/^\s*/)[0].length <= indent) break;
          scanShellLine(l2, j + 1, (n, l, s) => visit(n, l, 'workflow-run:' + s), known);
        }
      }
    });
    return;
  }
  if (kind === 'json-scripts' || kind === 'json-commands') {
    const json = JSON.parse(text);
    const values = [];
    collectValues(json, kind === 'json-scripts' ? 'scripts' : 'command', values);
    for (const [v, at] of values) {
      scanShellText(v, (n, l, s) => visit(n, at + l, 'json-value:' + s));
    }
  }
}

function collectValues(node, key, out) {
  if (Array.isArray(node)) {
    node.forEach((v) => collectValues(v, key, out));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === key) {
        // The key's payload is the shell-ish value (S7): a string (settings `command`) or an
        // object of strings (package.json `scripts`) — every string leaf under it scans.
        if (typeof v === 'string') out.push([v, 0]);
        else collectStringLeaves(v, out);
      } else collectValues(v, key, out);
    }
  }
}

function collectStringLeaves(node, out) {
  if (typeof node === 'string') { out.push([node, 0]); return; }
  if (Array.isArray(node)) { node.forEach((v) => collectStringLeaves(v, out)); return; }
  if (node && typeof node === 'object') for (const v of Object.values(node)) collectStringLeaves(v, out);
}

function stripYamlQuotes(s) {
  return s.replace(/^['"]|['"]$/g, '');
}

/**
 * Compute the wired set: direct evidence per surface + closure through wired non-test scripts
 * + shipped-by-path members. Returns Map<basename, Evidence[]> where Evidence is
 * {via: 'surface'|'closure'|'fingerprint', file, line, shape}.
 */
export function computeWiredSet(root, shippedByPath = []) {
  const wired = new Map();
  const known = new Set(listScripts(root).map((s) => s.name));
  const wire = (name, ev) => {
    if (!wired.has(name)) wired.set(name, []);
    wired.get(name).push(ev);
  };
  const surfaces = listSurfaceFiles(root);
  for (const s of surfaces) {
    const text = readFileSync(join(root, s.rel), 'utf8');
    const visit = (name, line, shape) =>
      wire(name, { via: 'surface', file: s.rel, line, shape });
    if (s.kind === 'shell') scanShellText(text, visit, known);
    else scanStructuredText(text, s.kind, visit, known);
  }
  // Closure through wired non-test scripts (build-synth-bundle.sh → check-bundle-dep-parity.sh).
  let grew = true;
  const closureSeen = new Set();
  while (grew) {
    grew = false;
    for (const [name, evs] of [...wired]) {
      if (/\.(test|spec)\./.test(name)) continue; // closure does not pass through test material
      if (closureSeen.has(name)) continue;
      closureSeen.add(name);
      const abs = join(root, 'scripts', name);
      if (!existsSync(abs)) continue;
      const rel = `scripts/${name}`;
      const text = readFileSync(abs, 'utf8');
      // Closure crosses the script's own language: a wired .mjs reaches its deps through S6
      // ES imports (structured scan), a wired .sh through the shell shapes.
      const scan = name.endsWith('.mjs')
        ? (t, visit) => scanStructuredText(t, 'ts', visit, known)
        : (t, visit) => scanShellText(t, visit, known);
      scan(text, (dep, line, shape) => {
        if (!wired.has(dep)) grew = true;
        wire(dep, { via: 'closure', file: rel, line, shape });
      });
      void evs;
    }
  }
  for (const name of shippedByPath) wire(name, { via: 'fingerprint', file: 'tests/install-sh/baselines', line: 0, shape: 'shipped-by-path' });
  return wired;
}
