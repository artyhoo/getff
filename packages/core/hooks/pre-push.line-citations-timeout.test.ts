/**
 * line-citations section — a checker that times out must say so, and must still
 * block the push.
 *
 * Incident 2026-09-28: with load average ~108 the checker exceeded the 120 s default
 * twice, and the hook died with «❌ stale `path:line` citation(s):» followed by
 * «spawnSync node ETIMEDOUT». Nothing was stale — the same command alone exited 0.
 * The message sent the operator hunting for citations that did not exist.
 *
 * Driven end to end through the real hook: a fake `node` first on PATH stands in for
 * the checker (the hook itself runs under process.execPath, so only the section's
 * spawn sees it), and PREPUSH_LINE_CITATIONS_TIMEOUT_MS shrinks the cap so the test
 * does not wait minutes. The paired case pins that a checker which really fails still
 * reads as stale citations — the timeout branch must not swallow it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lineCitationsTimeoutMs } from './pre-push.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = resolve(HERE, 'pre-push.ts');
const CORE = resolve(HERE, '..');

// Every case in «line-citations: checker timeout» spawns the pre-push hook (`node --import
// tsx/esm pre-push.ts`, own spawnSync cap 60_000), so multi-second runtimes under load are
// inherent and the vitest 5s default is a mis-set gate rather than a signal. A full Mac run
// of `npm --prefix packages/core run test:hooks` (M2 Max, load 3.8 -> 6.9, 260 s, measured
// 2026-10-01) timed out «a checker that fails within the cap» at 5000ms, while the same
// suite passed 87/87 files on Linux, and a different case fails on each run. The pure
// `lineCitationsTimeoutMs` suite spawns nothing and keeps the default.
// 30_000 is the SLOW_SHELL_MS convention of the sibling shell-spawning suites
// (end-of-turn-reminder, dup-detect-empty-arg, priority-score-branch-matcher).
const SLOW_SHELL_MS = 30_000;

let dir = '';

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'line-citations-timeout-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** A fake `node` that runs `body` instead of the checker. */
function fakeNodeBin(name: string, body: string): string {
  const bin = join(dir, name);
  spawnSync('mkdir', ['-p', bin]);
  writeFileSync(join(bin, 'node'), `#!/bin/sh\n${body}\n`);
  chmodSync(join(bin, 'node'), 0o755);
  return bin;
}

function hook(bin: string, env: Record<string, string> = {}) {
  return spawnSync(process.execPath, ['--import', 'tsx/esm', HOOK], {
    cwd: CORE,
    input: '',
    encoding: 'utf8',
    env: {
      ...process.env,
      PREPUSH_ONLY: 'line-citations',
      // The empty tree as base: every tracked file is «changed», so the checker is
      // always reached — HEAD~1 is not enough when HEAD is an empty or deletion-only commit.
      PREPUSH_UPSTREAM_REF: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
      PATH: `${bin}:${process.env['PATH'] ?? ''}`,
      ...env,
    },
    timeout: 60_000,
  });
}

describe('line-citations: checker timeout', { timeout: SLOW_SHELL_MS }, () => {
  it('a timed-out checker blocks the push with a timeout message, not «stale»', () => {
    const bin = fakeNodeBin('slow', 'exec sleep 10');
    const r = hook(bin, { PREPUSH_LINE_CITATIONS_TIMEOUT_MS: '500' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/citation checker did not finish within 0.5 s \(timed out or was terminated\)/);
    expect(r.stderr).toMatch(/PREPUSH_LINE_CITATIONS_TIMEOUT_MS/);
    expect(r.stderr).not.toMatch(/stale `path:line` citation/);
  });

  it('a checker that fails within the cap still reports stale citations', () => {
    const bin = fakeNodeBin('failing', "echo 'docs/x.md:3 → gone' >&2; exit 1");
    const r = hook(bin, { PREPUSH_LINE_CITATIONS_TIMEOUT_MS: '30000' });
    expect(r.status).toBe(1);
    expect(r.stderr).not.toMatch(/did not finish/);
    expect(r.stderr).toMatch(/stale `path:line` citation/);
  });
});

describe('lineCitationsTimeoutMs', () => {
  it('defaults to 600 s when unset', () => {
    expect(lineCitationsTimeoutMs({})).toBe(600_000);
  });

  it('honours a positive integer, surrounding whitespace allowed', () => {
    expect(lineCitationsTimeoutMs({ PREPUSH_LINE_CITATIONS_TIMEOUT_MS: ' 500 ' })).toBe(500);
  });

  // 0 would mean «no cap» to spawnSync — a typo must never disable the cap.
  for (const bad of ['', 'soon', '0', '-5', '1.5', '1e3', '0500']) {
    it(`falls back to the default for ${JSON.stringify(bad)}`, () => {
      expect(lineCitationsTimeoutMs({ PREPUSH_LINE_CITATIONS_TIMEOUT_MS: bad })).toBe(600_000);
    });
  }
});
