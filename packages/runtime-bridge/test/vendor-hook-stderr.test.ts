/**
 * A5-5 (#1597 ledger) — the consumer-shipped PostToolUse hook redirected the
 * dispatcher's ENTIRE stderr to a fixed, predictable, world-writable path:
 * `/tmp/runtime-bridge-dispatch-stderr.txt`, truncating it on every kickoff Write
 * and never reading it back. Two defects in one line:
 *
 *  - a symlink/clobber target on any shared host (another user pre-creates the
 *    path as a symlink to a file the operator owns and it is truncated for them),
 *    and a clobber race between concurrent CC sessions on a single-user box;
 *  - `#warning-nobody-reads` (.claude/rules/attention-is-not-a-mechanism.md §2):
 *    the ManualBackend-fallback and abort diagnostics are the ONLY signal those
 *    paths emit, and this line was where they went to die.
 *
 * The fix is a per-invocation `mktemp` file that is removed on exit, plus actually
 * forwarding what the CLI wrote so the diagnostics reach a channel with a reader.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = resolve(HERE, '../vendor/hooks/runtime-bridge-dispatch.sh');

/** The exact path the shipped line used to truncate on every invocation. */
const FIXED_PATH = '/tmp/runtime-bridge-dispatch-stderr.txt';

const cleanup: Array<() => void> = [];
afterEach(() => {
  while (cleanup.length) cleanup.pop()?.();
});

/**
 * Build a consumer-shaped tree (`.claude/vendor/runtime-bridge/src/cli/dispatch.ts`,
 * which is the tier the vendored hook resolves) plus a stub `tsx` on PATH that
 * prints `stdoutText` and `stderrText` instead of running the real CLI.
 */
function fixture(stdoutText: string, stderrText: string): { root: string; env: NodeJS.ProcessEnv } {
  const root = mkdtempSync(resolve(tmpdir(), 'rb-hook-'));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));

  const cliDir = resolve(root, '.claude/vendor/runtime-bridge/src/cli');
  mkdirSync(cliDir, { recursive: true });
  writeFileSync(resolve(cliDir, 'dispatch.ts'), '// stub\n', 'utf8');

  const binDir = resolve(root, 'bin');
  mkdirSync(binDir, { recursive: true });
  const tsx = resolve(binDir, 'tsx');
  writeFileSync(
    tsx,
    `#!/usr/bin/env bash\nprintf '%s' ${JSON.stringify(stdoutText)}\nprintf '%s' ${JSON.stringify(stderrText)} >&2\nexit 0\n`,
    'utf8',
  );
  chmodSync(tsx, 0o755);

  return {
    root,
    env: { ...process.env, PATH: `${binDir}:${process.env['PATH'] ?? ''}`, CLAUDE_PROJECT_DIR: root },
  };
}

/** Write an auto-marked kickoff and feed the hook a PostToolUse Write event. */
function runHook(root: string, env: NodeJS.ProcessEnv): ReturnType<typeof spawnSync> {
  const kickoffDir = resolve(root, '.claude/orchestrator-prompts/demo-stage');
  mkdirSync(kickoffDir, { recursive: true });
  const kickoff = resolve(kickoffDir, 'kickoff.md');
  writeFileSync(kickoff, '<!-- bridge: auto -->\n# Demo\n', 'utf8');
  return spawnSync('bash', [HOOK], {
    encoding: 'utf8',
    env,
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: kickoff } }),
  });
}

describe('A5-5 — the vendored dispatch hook does not write a fixed /tmp stderr file', () => {
  it('leaves a pre-existing /tmp/runtime-bridge-dispatch-stderr.txt untouched', () => {
    const existedBefore = existsSync(FIXED_PATH);
    const saved = existedBefore ? readFileSync(FIXED_PATH) : null;
    const sentinel = `do-not-truncate-${Date.now()}\n`;
    writeFileSync(FIXED_PATH, sentinel, 'utf8');
    cleanup.push(() => {
      if (saved !== null) writeFileSync(FIXED_PATH, saved);
      else rmSync(FIXED_PATH, { force: true });
    });

    const { root, env } = fixture('', '[runtime-bridge] something went wrong\n');
    const r = runHook(root, env);

    expect(r.status).toBe(0); // injection, never a gate — unchanged
    // The finding: this content used to be destroyed on every kickoff Write, and
    // on a shared host the path can be someone else's file behind a symlink.
    expect(readFileSync(FIXED_PATH, 'utf8')).toBe(sentinel);
  });

  it('creates no file at the fixed path when none existed', () => {
    if (existsSync(FIXED_PATH)) rmSync(FIXED_PATH, { force: true });
    const { root, env } = fixture('', 'noise\n');
    runHook(root, env);
    expect(existsSync(FIXED_PATH)).toBe(false);
  });

  it('forwards the CLI diagnostics instead of dropping them in an unread file', () => {
    // The ManualBackend-fallback and ABORT lines are the only signal those paths
    // emit; the old redirect was a warning-nobody-reads channel by construction.
    const { root, env } = fixture(
      '',
      '[runtime-bridge] aif-handoff dispatch failed (unavailable): connection refused\n',
    );
    const r = runHook(root, env);
    expect(r.stderr).toContain('aif-handoff dispatch failed (unavailable)');
  });

  it('still forwards the CLI stdout as additionalContext (unchanged contract)', () => {
    const payload = JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 'dispatched' },
    });
    const { root, env } = fixture(`${payload}\n`, '');
    const r = runHook(root, env);
    expect(r.stdout).toContain('additionalContext');
    expect(r.status).toBe(0);
  });

  it('leaves no per-run temp file behind', () => {
    const { root, env } = fixture('', 'noise\n');
    const r = runHook(root, env);
    expect(r.status).toBe(0);
    // Nothing matching the hook's own temp template may survive the run.
    const leftovers = spawnSync(
      'bash',
      ['-c', `ls ${JSON.stringify(tmpdir())}/runtime-bridge-dispatch-stderr.* 2>/dev/null | wc -l`],
      { encoding: 'utf8' },
    );
    expect(leftovers.stdout.trim()).toBe('0');
  });
});
