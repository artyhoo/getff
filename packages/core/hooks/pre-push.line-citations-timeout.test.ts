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

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = resolve(HERE, 'pre-push.ts');
const CORE = resolve(HERE, '..');

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
      // HEAD~1..HEAD always has at least one changed file, so the checker is reached.
      PREPUSH_UPSTREAM_REF: 'HEAD~1',
      PATH: `${bin}:${process.env['PATH'] ?? ''}`,
      ...env,
    },
    timeout: 60_000,
  });
}

describe('line-citations: checker timeout', () => {
  it('a timed-out checker blocks the push with a timeout message, not «stale»', () => {
    const bin = fakeNodeBin('slow', 'exec sleep 10');
    const r = hook(bin, { PREPUSH_LINE_CITATIONS_TIMEOUT_MS: '500' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/citation checker timed out/);
    expect(r.stderr).toMatch(/PREPUSH_LINE_CITATIONS_TIMEOUT_MS/);
    expect(r.stderr).not.toMatch(/stale `path:line` citation/);
  });

  it('a checker that fails within the cap still reports stale citations', () => {
    const bin = fakeNodeBin('failing', "echo 'docs/x.md:3 → gone' >&2; exit 1");
    const r = hook(bin, { PREPUSH_LINE_CITATIONS_TIMEOUT_MS: '30000' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/stale `path:line` citation/);
    expect(r.stderr).not.toMatch(/timed out/);
  });

  it('a malformed cap falls back to the default instead of disabling the gate', () => {
    const bin = fakeNodeBin('failing-2', 'exit 1');
    const r = hook(bin, { PREPUSH_LINE_CITATIONS_TIMEOUT_MS: 'soon' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/stale `path:line` citation/);
  });
});
