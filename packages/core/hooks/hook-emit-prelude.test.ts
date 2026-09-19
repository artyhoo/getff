/**
 * The shared PostToolUse emit prelude — .claude/hooks/lib/hook-emit.sh.
 * #1597 review ledger R-2 (five private 13-line copies, already diverging) and K-1 (the
 * Homebrew PATH prepend CLAUDE.md §Harness gates requires of hooks that shell out).
 *
 * What is asserted, and why each arm is not vacuous:
 *   - single definition: no gate that CAN source the prelude still carries its own copy, and
 *     the two that cannot (installer-delivered one-by-one) are named explicitly, so a future
 *     re-inlining is a test failure rather than a silent regression;
 *   - the escaper is correct on the input that used to break it — a message with a TAB or a
 *     CR produced a raw control byte inside a JSON string, i.e. invalid JSON the harness
 *     discards (measured: jq exits 5 on the old form);
 *   - the PATH prepend adds only directories that EXIST and never duplicates an entry, so a
 *     sandbox that hides a tool by rebuilding PATH stays hidden;
 *   - the plugin twin is byte-identical, since ZCode consumers reach hooks only through the
 *     plugin channel.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const PRELUDE = resolve(REPO_ROOT, '.claude/hooks/lib/hook-emit.sh');
const PLUGIN_PRELUDE = resolve(REPO_ROOT, 'plugin/hooks/lib/hook-emit.sh');
const HOOKS_DIR = resolve(REPO_ROOT, '.claude/hooks');

/**
 * Gates that CANNOT source the prelude, with the reason. Both are copied to a consumer
 * one file at a time by the installer, so a sibling that was never delivered cannot be
 * sourced. Their inline copies are deliberate; every other gate must not have one.
 */
const INLINE_BY_NECESSITY = new Set([
  'check-doc-authority-header.sh', // setup.d/10-skills.sh copies this single file
  'runtime-bridge-dispatch.sh', // setup.d/55-runtime-bridge-vendor.sh copies this single file
]);

/** Run a snippet with the prelude sourced, under a controlled env. */
function withPrelude(
  snippet: string,
  env: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('/bin/bash', ['-c', `set -uo pipefail; . "${PRELUDE}"; ${snippet}`], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 15_000,
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('lib/hook-emit.sh — one definition for the PostToolUse emit helpers (R-2)', () => {
  it('the prelude exists in both channels and is byte-identical', () => {
    expect(existsSync(PRELUDE), '.claude/hooks/lib/hook-emit.sh missing').toBe(true);
    expect(existsSync(PLUGIN_PRELUDE), 'plugin/hooks/lib/hook-emit.sh missing').toBe(true);
    expect(readFileSync(PLUGIN_PRELUDE, 'utf8')).toBe(readFileSync(PRELUDE, 'utf8'));
  });

  it('no sourcing gate keeps a private copy of the helpers', () => {
    const hooks = readdirSync(HOOKS_DIR).filter((f) => f.endsWith('.sh'));
    // Population sentinel (T10): a broken glob returning [] would pass vacuously.
    expect(hooks.length, 'population sentinel: expected ≥10 tracked hooks').toBeGreaterThanOrEqual(10);
    const offenders: string[] = [];
    for (const h of hooks) {
      if (INLINE_BY_NECESSITY.has(h)) continue;
      const src = readFileSync(join(HOOKS_DIR, h), 'utf8');
      const sources = src.includes('lib/hook-emit.sh');
      const inlines = /^_(?:is_zcode|json_escape|emit_skip)\(\)/m.test(src);
      if (sources && inlines) offenders.push(h);
    }
    expect(
      offenders,
      `these gates source the prelude AND redefine its helpers: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('every gate that sources the prelude actually resolves it (no broken-install fallback fires)', () => {
    const hooks = readdirSync(HOOKS_DIR)
      .filter((f) => f.endsWith('.sh'))
      .filter((f) => readFileSync(join(HOOKS_DIR, f), 'utf8').includes('lib/hook-emit.sh'));
    expect(hooks.length, 'expected the five PostToolUse gates to source it').toBeGreaterThanOrEqual(5);
    for (const h of hooks) {
      const r = spawnSync('/bin/bash', [join(HOOKS_DIR, h)], {
        input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: '/nowhere/x.txt' } }),
        encoding: 'utf8',
        env: { ...process.env, CLAUDE_PROJECT_DIR: REPO_ROOT },
        timeout: 15_000,
      });
      expect(
        r.stdout ?? '',
        `${h}: the broken-install fallback fired — the prelude did not resolve`,
      ).not.toMatch(/could not be sourced/);
    }
  });
});

describe('_json_escape — control characters produce VALID JSON (R-2 divergence)', () => {
  it('a message with TAB and CR yields parseable JSON (the old sed copy did not)', () => {
    const r = withPrelude(`_emit_skip "$(printf 'a\\tb\\rc\\nd')" 2>/dev/null`);
    expect(r.status).toBe(0);
    expect(() => JSON.parse(r.stdout.trim())).not.toThrow();
    const ctx = (
      JSON.parse(r.stdout.trim()) as {
        hookSpecificOutput: { additionalContext: string };
      }
    ).hookSpecificOutput.additionalContext;
    // Collapsed to spaces, not dropped: the text stays readable.
    expect(ctx).toContain('a b c d');
  });

  it('RED control: the pre-R-2 escaper emits INVALID JSON for the same input', () => {
    // The old body, verbatim: backslash + quote escaped, newline collapsed, nothing else.
    const old = `_old() { printf '%s' "$1" | sed -e 's/\\\\/\\\\\\\\/g' -e 's/"/\\\\"/g' | tr '\\n' ' '; }; printf '{"a":"%s"}\\n' "$(_old "$(printf 'a\\tb\\rc')")"`;
    const r = spawnSync('/bin/bash', ['-c', old], { encoding: 'utf8', timeout: 15_000 });
    expect(() => JSON.parse((r.stdout ?? '').trim())).toThrow();
  });

  it('quotes and backslashes still round-trip', () => {
    // Exact bytes via a file, so no JS/shell quoting layer can alter the payload before the
    // escaper sees it. `$(cat …)` strips trailing newlines only, which this payload has none of.
    const payload = 'say "hi" \\ ok';
    const box = mkdtempSync(join(tmpdir(), 'prelude-esc-'));
    const f = join(box, 'payload.txt');
    writeFileSync(f, payload, 'utf8');
    try {
      const r = withPrelude(`_emit_skip "$(cat '${f}')" 2>/dev/null`);
      const ctx = (
        JSON.parse(r.stdout.trim()) as { hookSpecificOutput: { additionalContext: string } }
      ).hookSpecificOutput.additionalContext;
      expect(ctx).toBe(payload);
    } finally {
      rmSync(box, { recursive: true, force: true });
    }
  });

  it('ZCode gets the bare {additionalContext} envelope, CC the hookSpecificOutput wrapper', () => {
    const zc = withPrelude(`_emit_skip 'x' 2>/dev/null`, { ZCODE_PROJECT_DIR: REPO_ROOT });
    expect(JSON.parse(zc.stdout.trim())).toEqual({ additionalContext: 'x' });
    const cc = withPrelude(`unset ZCODE_PROJECT_DIR; _emit_skip 'x' 2>/dev/null`);
    expect(JSON.parse(cc.stdout.trim())).toEqual({
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 'x' },
    });
  });
});

describe('Homebrew PATH prepend (K-1)', () => {
  it('adds an existing Homebrew directory that a stripped PATH omitted', () => {
    const target = ['/opt/homebrew/bin', '/usr/local/bin'].find((d) => existsSync(d));
    if (!target) return; // neither exists on this host (e.g. a bare CI container) — nothing to assert
    const r = withPrelude('printf "%s" "$PATH"', { PATH: '/usr/bin:/bin' });
    expect(r.stdout.split(':')).toContain(target);
  });

  it('never adds a directory twice, and never invents one that does not exist', () => {
    const r = withPrelude('printf "%s" "$PATH"', { PATH: '/usr/bin:/bin' });
    const dirs = r.stdout.split(':');
    for (const d of ['/opt/homebrew/bin', '/usr/local/bin']) {
      const n = dirs.filter((x) => x === d).length;
      expect(n, `${d} appears ${n} times`).toBeLessThanOrEqual(1);
      if (n === 1) expect(existsSync(d), `${d} was prepended but does not exist`).toBe(true);
    }
  });

  it('is idempotent — sourcing twice leaves PATH unchanged', () => {
    const once = withPrelude('printf "%s" "$PATH"', { PATH: '/usr/bin:/bin' });
    const twice = spawnSync(
      '/bin/bash',
      ['-c', `set -uo pipefail; . "${PRELUDE}"; . "${PRELUDE}"; printf "%s" "$PATH"`],
      { encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' }, timeout: 15_000 },
    );
    expect(twice.stdout).toBe(once.stdout);
  });
});

describe('_emit_skip_once — bounded announcement (A3-6 shape)', () => {
  it('announces once per session_id, then stays quiet', () => {
    const r = withPrelude(
      `SESSION_ID=s1; TMPDIR="$(mktemp -d)"; _emit_skip_once t 'msg' 2>/dev/null; _emit_skip_once t 'msg' 2>/dev/null; rm -f "$TMPDIR"/aif-* ; rmdir "$TMPDIR"`,
    );
    expect(r.stdout.trim().split('\n').filter(Boolean)).toHaveLength(1);
  });

  it('with NO session_id it repeats — silence is the failure mode being fixed', () => {
    const r = withPrelude(
      `TMPDIR="$(mktemp -d)"; _emit_skip_once t 'msg' 2>/dev/null; _emit_skip_once t 'msg' 2>/dev/null; rmdir "$TMPDIR"`,
    );
    expect(r.stdout.trim().split('\n').filter(Boolean)).toHaveLength(2);
  });
});
