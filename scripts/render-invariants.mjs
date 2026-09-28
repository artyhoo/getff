#!/usr/bin/env node
/**
 * render-invariants — renders the session digest's `INVARIANTS_LINE` from README.md.
 *
 * WHY: the invariant list is loaded into EVERY agent session (UserPromptSubmit digest, and
 * SubagentStart via inject-subagent-digest.sh which re-runs the same hook). It used to be a
 * hand-typed copy of README.md «What must not break (invariants)», and the copy drifted: README
 * gained «No paid LLM in CI» while the digest kept four items (found 2026-09-28). README is the
 * single source; this script renders the hook's generated region from it, and `--check` (wired
 * as the `invariants-render` pre-push section + the hook's vitest drift test in CI) fails on
 * any difference, so the copy cannot drift silently again.
 *
 * WHY RENDER INTO THE HOOK SOURCE instead of parsing README at hook run time:
 *   (a) consumers run this hook through the plugin twin, where the project root is the
 *       CONSUMER's tree — its README.md has no invariants block, so a runtime parse would
 *       read the wrong document (or nothing) and drop the invariant text entirely;
 *   (b) the hook fires on every prompt and must survive a stripped PATH (the R4 test runs it
 *       with only bash/dirname/grep) — no awk/sed/node parse on the hot path.
 * The rendered line keeps the hook's R4 degradation: every `.claude/rules/<name>.md` cited in
 * a README bullet becomes `$(_rule_ref <name>)`, and a `make <target>` code span becomes
 * `$(_make_ref <target>)`, so an absent target degrades to its name at run time.
 *
 * Rendered clause per bullet `- **Title** — body`: `Title — <body up to its first sentence
 * or colon break>` plus the rule references found anywhere in the bullet.
 *
 * The region is delimited by the fence vocabulary of packages/core/composition/fence.ts
 * (`getff:begin section=… plan=…` / `getff:end section=…`) inside `#` comments. fence.ts
 * itself is not used: its injector writes a bare `<!-- … -->` end marker, which is a syntax
 * error in bash.
 *
 * Modes: `--write` (rewrite the hook region) | `--check` (exit 1 on drift). Exit 2 = README or
 * hook could not be parsed. `--root <dir>` overrides the repo root (default: this script's
 * parent directory). Plain node, no imports beyond node: builtins.
 * Precedent for the --write/--check pair: scripts/render-rule-index.mjs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const README_PATH = 'README.md';
export const HOOK_PATH = '.claude/hooks/inject-session-bootstrap.sh';
export const HEADING = '### What must not break (invariants)';
export const BEGIN = '# <!-- getff:begin section=invariants-line plan=scripts/render-invariants.mjs -->';
export const END = '# <!-- getff:end section=invariants-line -->';

const BULLET = /^- \*\*(.+?)\*\* — (.+)$/;

/** Parse the README invariants block into `{ title, body }` entries. Throws on any shape
 *  it cannot read — a silent partial parse would render a short list and pass `--check`. */
export function parseInvariants(readme) {
  const lines = readme.split('\n');
  const start = lines.findIndex((l) => l.trim() === HEADING);
  if (start === -1) throw new Error(`${README_PATH}: heading not found: ${HEADING}`);
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#')) break;
    if (line.trim() === '') {
      if (out.length > 0) break;
      continue;
    }
    const m = line.match(BULLET);
    if (!m) {
      if (out.length > 0 && !line.startsWith('-')) break;
      throw new Error(`${README_PATH}:${i + 1}: invariant bullet is not «- **Title** — body»: ${line}`);
    }
    out.push({ title: m[1], body: m[2] });
  }
  if (out.length === 0) throw new Error(`${README_PATH}: no invariant bullets under ${HEADING}`);
  return out;
}

/** Escape for a bash double-quoted string. */
const esc = (s) => s.replace(/[\\"$`]/g, '\\$&');

/** The body up to its first sentence or colon break, without a trailing period. */
function firstClause(body) {
  const cut = body.search(/[.:] /);
  return (cut === -1 ? body : body.slice(0, cut)).replace(/\.$/, '');
}

/** Render prose with code spans: `make <target>` becomes a run-time `_make_ref` call, any
 *  other span keeps its text without backticks. */
function renderProse(text) {
  return text
    .split(/(`[^`]*`)/)
    .map((part) => {
      if (!part.startsWith('`')) return esc(part);
      const code = part.slice(1, -1);
      const make = code.match(/^make ([A-Za-z0-9_-]+)$/);
      return make ? `$(_make_ref ${make[1]})` : esc(code);
    })
    .join('');
}

/** Distinct `.claude/rules/<name>.md` citations in a bullet, in order of appearance. */
function ruleNames(body) {
  const names = [];
  for (const m of body.matchAll(/\.claude\/rules\/([a-z0-9-]+)\.md/g)) {
    if (!names.includes(m[1])) names.push(m[1]);
  }
  return names;
}

/** The bash assignment the hook region carries. */
export function renderLine(invariants) {
  const items = invariants.map(({ title, body }, i) => {
    const refs = ruleNames(body).map((n) => ` $(_rule_ref ${n})`).join('');
    return `(${i + 1}) ${esc(title)} — ${renderProse(firstClause(body))}${refs}`;
  });
  return `INVARIANTS_LINE="Invariants: ${items.join('; ')}."`;
}

/** Return the hook source with its generated region replaced by the rendering of `readme`. */
export function renderHook(hook, readme) {
  const lines = hook.split('\n');
  const b = lines.indexOf(BEGIN);
  const e = lines.indexOf(END);
  if (b === -1 || e === -1 || e < b) {
    throw new Error(`${HOOK_PATH}: generated region markers missing or out of order (${BEGIN} … ${END})`);
  }
  return [...lines.slice(0, b + 1), renderLine(parseInvariants(readme)), ...lines.slice(e)].join('\n');
}

export function run(argv) {
  const mode = argv.includes('--check') ? 'check' : argv.includes('--write') ? 'write' : null;
  if (!mode) {
    console.error('usage: render-invariants.mjs (--write | --check) [--root <dir>]');
    return 2;
  }
  const rootIdx = argv.indexOf('--root');
  const root = rootIdx !== -1 ? resolve(argv[rootIdx + 1] ?? '.') : resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const hookFile = resolve(root, HOOK_PATH);
  let hook;
  let next;
  try {
    hook = readFileSync(hookFile, 'utf8');
    next = renderHook(hook, readFileSync(resolve(root, README_PATH), 'utf8'));
  } catch (err) {
    console.error(`❌ render-invariants: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
  if (mode === 'write') {
    if (next !== hook) writeFileSync(hookFile, next);
    console.log(next !== hook ? `✓ ${HOOK_PATH}: invariants line re-rendered` : `✓ ${HOOK_PATH}: invariants line already current`);
    return 0;
  }
  if (next !== hook) {
    console.error(`❌ ${HOOK_PATH}: invariants line differs from ${README_PATH} «What must not break (invariants)».`);
    console.error('  Fix: node scripts/render-invariants.mjs --write');
    return 1;
  }
  console.log(`✓ ${HOOK_PATH}: invariants line matches ${README_PATH}`);
  return 0;
}

function isMainEntry() {
  try {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '');
  } catch {
    return false;
  }
}

if (isMainEntry()) process.exit(run(process.argv.slice(2)));
