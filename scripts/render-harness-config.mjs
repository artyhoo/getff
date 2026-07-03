#!/usr/bin/env node
/**
 * render-harness-config — derive per-harness runtime config from ONE neutral SSOT.
 *
 * WHY (#894): non-CC harnesses that don't read `.claude/` (zcode, a CC fork the
 * framework is developed inside) install to /dev/null — hooks never fire, no MCP,
 * no skills. This renderer makes the framework's edit-time machinery visible to
 * such a harness WITHOUT hand-copying config (which would be #sync-by-copy-paste,
 * dual-implementation-discipline.md §8). SSOT = `.ai-factory/harness-model.json`;
 * every harness config is a THIN derivation of it, drift-gated
 * (packages/core/hooks/harness-config-drift.test.ts, channel test:hooks).
 *
 * ARCHITECTURE (owner decision 2026-07-03): the `HarnessEmitter` interface is
 * extracted from TWO live backends day-one (CC + zcode), mirroring the
 * EcosystemAdapter precedent (npm #852 + cargo #868) — the neutral core is only
 * what both backends share; vendor keys (permissions, enabledPlugins, model, …)
 * are kept OUT of the model by an executable union-IR guard (not prose).
 *
 * Modes: `--write` (emit) | `--check` (drift, exit 1 on mismatch). `--root <dir>`
 * overrides the SSOT search root (default: walk up from cwd). Node, zero deps.
 * Precedent: packages/core/render/render-rules.ts --write/--check.
 *
 * Operator-axis only: zcode.json + .zcode/ are gitignored maintainer-env shims.
 * A per-harness emitter shipped to consumers via install.sh is a PARKED fork (#894 §7).
 */
import {
  readFileSync, writeFileSync, existsSync, mkdirSync,
  lstatSync, readlinkSync, symlinkSync, unlinkSync, rmSync, realpathSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── zcode's supported hook event set (verified from the bundle 2026-07-03:
// `qr={SessionStart,UserPromptSubmit,PreToolUse,PermissionRequest,PostToolUse,
// PostToolUseFailure,Stop}` — NO SubagentStart/SubagentStop). Events outside this
// set cannot be expressed on zcode and MUST be declared LOUDLY, not dropped
// silently (attention-is-not-a-mechanism.md §1). ──
const ZCODE_EVENTS = new Set([
  'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest',
  'PostToolUse', 'PostToolUseFailure', 'Stop',
]);

const MODEL_KEYS = new Set(['hooks', 'mcpServers', 'skillsDir']);
const HOOK_ENTRY_KEYS = new Set(['matcher', 'command']);
const MCP_ENTRY_KEYS = new Set(['type', 'command', 'url', 'args', 'env']);

/** Union-IR guard — executable, not prose. Rejects vendor keys leaking into the
 *  neutral model (N5). Throws with a message that names the offending key. */
export function validateModel(model) {
  const bad = (m) => { throw new Error(`harness-model.json: ${m}`); };
  if (typeof model !== 'object' || model === null || Array.isArray(model)) bad('must be a JSON object');
  for (const k of Object.keys(model)) {
    if (!MODEL_KEYS.has(k)) bad(`unknown top-level key "${k}" — model is NARROW {hooks, mcpServers, skillsDir}; vendor keys (permissions, enabledPlugins, model, …) belong in the harness file, not the SSOT`);
  }
  for (const [event, entries] of Object.entries(model.hooks ?? {})) {
    if (!Array.isArray(entries)) bad(`hooks.${event} must be an array`);
    for (const e of entries) {
      for (const k of Object.keys(e)) if (!HOOK_ENTRY_KEYS.has(k)) bad(`hooks.${event}[].${k} — hook entry is {matcher?, command}`);
      if (typeof e.command !== 'string' || !e.command) bad(`hooks.${event}[] missing string "command"`);
    }
  }
  for (const [name, s] of Object.entries(model.mcpServers ?? {})) {
    for (const k of Object.keys(s)) if (!MCP_ENTRY_KEYS.has(k)) bad(`mcpServers.${name}.${k} — server entry is {type?, command?, url?, args?, env?}`);
    if (!s.url && !s.command) bad(`mcpServers.${name} needs "url" (http/sse) or "command" (stdio)`);
  }
  if (model.skillsDir !== undefined && typeof model.skillsDir !== 'string') bad('skillsDir must be a string');
  return model;
}

/** Neutral hooks {Event:[{matcher?,command}]} -> CC/zcode structure
 *  {Event:[{matcher?,hooks:[{type:'command',command}]}]}. Order-preserving so the
 *  emit round-trips the existing settings.json byte-for-byte.
 *
 *  SUBSET-BY-DESIGN (schema-verified 2026-07-04 against zcode's shipped Zod,
 *  bundle @discriminatedUnion): zcode's inner-hook grammar is a TWO-variant union —
 *  `command` {type:'command',command,async?,shell?,timeoutMs?} AND
 *  `process` {type:'process',command,args[],timeoutMs?,statusMessage?}. This emitter
 *  renders ONLY the `command` variant (a VALID subset — the other fields are optional,
 *  so a `{type:'command',command}` object passes zcode's `.strict()` validation). The
 *  `process` variant + async/shell/timeoutMs optionals (and MCP-server `timeoutMs`, see
 *  emitZcode) are UNEXPRESSED-BY-DESIGN, not missing-by-oversight: the neutral SSOT models
 *  only what a CC framework hook needs (one shell command per event). A future consumer
 *  that needs a process-type or async hook widens BOTH the model (validateModel's
 *  HOOK_ENTRY_KEYS) and this mapping — recorded here so the subset is not mistaken for the
 *  whole grammar (attention-is-not-a-mechanism.md — silent narrowing declared, not hidden). */
function toCCHooks(hooks) {
  const out = {};
  for (const [event, entries] of Object.entries(hooks)) {
    out[event] = entries.map((e) => (e.matcher !== undefined
      ? { matcher: e.matcher, hooks: [{ type: 'command', command: e.command }] }
      : { hooks: [{ type: 'command', command: e.command }] }));
  }
  return out;
}

const envMapToPairs = (env) => Object.entries(env ?? {}).map(([name, value]) => ({ name, value: String(value) }));

// ── HarnessEmitter interface: {name, presenceProbe?, emit(model, repoRoot) -> FileOp[]}.
// FileOp kinds: json | merge-json (owns ONE key) | symlink | note (loud declaration).
// `optional` ops belong to a gitignored artifact — absent-on-check => loud skip, not drift. ──

/** CC backend: owns ONLY `hooks` in settings.json (merge — CC runtime keeps
 *  writing permissions/env; war-over-the-file excluded by construction); MCP -> .mcp.json. */
export function emitClaude(model) {
  return [
    { kind: 'merge-json', path: '.claude/settings.json', key: 'hooks', value: toCCHooks(model.hooks ?? {}) },
    { kind: 'json', path: '.mcp.json', value: { mcpServers: model.mcpServers ?? {} } },
  ];
}

/** zcode backend: zcode.json {hooks(1:1 CC schema, supported events only), mcp.servers}
 *  + idempotent symlink .zcode/skills -> ../<skillsDir>. zcode's MCP schema is
 *  `.strict()`: http/sse = {name,type,url,headers[]}, stdio = {name,command,args[],env[{name,value}]}.
 *  zcode's Zod additionally allows an optional per-server `timeoutMs` (schema-verified
 *  2026-07-04); the neutral model omits it UNEXPRESSED-BY-DESIGN (no consumer needs a
 *  per-server MCP timeout yet — widen validateModel's MCP_ENTRY_KEYS when one does).
 *  Emitting without it is `.strict()`-valid since `timeoutMs` is optional. */
export function emitZcode(model) {
  const kept = {};
  const dropped = [];
  for (const [event, entries] of Object.entries(model.hooks ?? {})) {
    if (ZCODE_EVENTS.has(event)) kept[event] = entries; else dropped.push(event);
  }
  const servers = {};
  for (const [name, s] of Object.entries(model.mcpServers ?? {})) {
    servers[name] = s.url
      ? { name, type: s.type ?? 'http', url: s.url, headers: [] }
      : { name, command: s.command, args: s.args ?? [], env: envMapToPairs(s.env) };
  }
  const skillsDir = model.skillsDir ?? '.claude/skills';
  const ops = [
    { kind: 'json', path: 'zcode.json', optional: true, value: { hooks: toCCHooks(kept), mcp: { servers } } },
    { kind: 'symlink', path: '.zcode/skills', optional: true, target: `../${skillsDir}` },
  ];
  if (dropped.length) {
    ops.push({ kind: 'note', message: `emitZcode: ${dropped.length} event(s) NOT expressed on zcode (unsupported by its event set): ${dropped.join(', ')} — these hooks run on CC only.` });
  }
  return ops;
}

const EMITTERS = [
  { name: 'claude', emit: emitClaude },
  { name: 'zcode', presenceProbe: 'zcode.json', emit: emitZcode },
];

const renderJson = (value) => JSON.stringify(value, null, 2) + '\n';
function mergedJson(root, op) {
  const p = join(root, op.path);
  // merge-json owns ONE key and byte-preserves the rest, so the file must pre-exist.
  // Fail with a readable message rather than a raw ENOENT stack trace (D2, cold-QA #894).
  if (!existsSync(p)) throw new Error(`${op.path}: not found — merge owns only the "${op.key}" key and needs the file to pre-exist (create it first, even as '{}').`);
  const obj = JSON.parse(readFileSync(p, 'utf8'));
  obj[op.key] = op.value;
  return renderJson(obj);
}

function applyOp(root, op) {
  if (op.kind === 'note') { console.error(`  ⚠ ${op.message}`); return; }
  const abs = join(root, op.path);
  if (op.kind === 'json') writeFileSync(abs, renderJson(op.value));
  else if (op.kind === 'merge-json') writeFileSync(abs, mergedJson(root, op));
  else if (op.kind === 'symlink') {
    mkdirSync(dirname(abs), { recursive: true });
    // unlinkSync (not rmSync) to drop an existing link: rmSync FOLLOWS a
    // symlink-to-directory and throws ERR_FS_EISDIR on Node 24 — which would
    // crash every re-write (idempotency). unlink removes the link, never its target.
    if (isLink(abs)) unlinkSync(abs);
    else if (existsSync(abs)) rmSync(abs, { recursive: true, force: true });
    symlinkSync(op.target, abs);
  }
}

const isLink = (p) => { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } };

/** Returns drift lines for one op ([] = clean). Assumes the op's emitter is not skipped. */
function checkOp(root, op) {
  if (op.kind === 'note') { console.error(`  ⚠ ${op.message}`); return []; }
  const abs = join(root, op.path);
  if (op.kind === 'json' || op.kind === 'merge-json') {
    if (!existsSync(abs)) return op.optional ? [] : [`${op.path}: missing (run --write)`];
    const want = op.kind === 'json' ? renderJson(op.value) : mergedJson(root, op);
    return readFileSync(abs, 'utf8') === want ? [] : [`${op.path}: drift vs SSOT`];
  }
  if (op.kind === 'symlink') {
    if (!isLink(abs)) return op.optional && !existsSync(abs) ? [`${op.path}: symlink missing`] : [`${op.path}: not a symlink`];
    return readlinkSync(abs) === op.target ? [] : [`${op.path}: symlink -> ${readlinkSync(abs)} (want ${op.target})`];
  }
  return [];
}

function findRoot(start) {
  let d = resolve(start);
  for (;;) {
    if (existsSync(join(d, '.ai-factory/harness-model.json'))) return d;
    const up = dirname(d);
    if (up === d) throw new Error('.ai-factory/harness-model.json not found (walked to filesystem root). Pass --root <dir>.');
    d = up;
  }
}

export function run(argv) {
  const mode = argv.includes('--check') ? 'check' : argv.includes('--write') ? 'write' : null;
  if (!mode) { console.error('usage: render-harness-config.mjs (--write | --check) [--root <dir>]'); return 2; }
  const rootFlag = argv.indexOf('--root');
  const root = rootFlag !== -1 ? resolve(argv[rootFlag + 1]) : findRoot(process.cwd());

  let model;
  try { model = validateModel(JSON.parse(readFileSync(join(root, '.ai-factory/harness-model.json'), 'utf8'))); }
  catch (e) { console.error(`✗ ${e.message}`); return 1; }

  const drift = [];
  try {
    for (const em of EMITTERS) {
      const ops = em.emit(model, root);
      if (mode === 'check' && em.presenceProbe && !existsSync(join(root, em.presenceProbe))) {
        console.error(`  ⓘ [${em.name}] ${em.presenceProbe} absent — skipping ${em.name} drift branch (gitignored shim; run --write to generate).`);
        continue;
      }
      for (const op of ops) {
        if (mode === 'write') applyOp(root, op);
        else drift.push(...checkOp(root, op));
      }
    }
  } catch (e) {
    // A readable one-line error (e.g. merge target absent, D2) instead of a raw stack trace.
    console.error(`✗ ${e.message}`);
    return 1;
  }

  if (mode === 'write') { console.log('render-harness-config: wrote CC + zcode config from .ai-factory/harness-model.json'); return 0; }
  if (drift.length) {
    console.error('✗ harness-config drift:\n' + drift.map((d) => `    - ${d}`).join('\n'));
    console.error('  Fix: edit .ai-factory/harness-model.json (the SSOT), then run: node scripts/render-harness-config.mjs --write');
    return 1;
  }
  console.log('✓ harness-config up-to-date with .ai-factory/harness-model.json');
  return 0;
}

// Entry-point guard: canonicalize BOTH sides through realpathSync. `import.meta.url`
// is already symlink-resolved by Node, but `process.argv[1]` is NOT — so a bare
// `resolve()` compare silently no-ops when the script is invoked via a symlinked path
// (e.g. a git worktree behind a symlinked ancestor — this repo uses worktrees +
// node_modules symlinks heavily), turning `--check` into a SILENT false-green: exactly
// the "fails loudly, not silently" property this gate exists to hold. Canonicalizing
// both sides makes the guard fire regardless of symlinks; the try/catch keeps
// import-as-module (argv[1] = the test runner, no match) from throwing on realpathSync.
function isMainEntry() {
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1] ?? ''); }
  catch { return false; }
}
if (isMainEntry()) process.exit(run(process.argv.slice(2)));
