/**
 * harness-config-local — the maintainer-machine arm of the harness-config drift gate.
 *
 * Paired cases, all against the REAL renderer in a tmpdir sandbox (never the real tree):
 *   P  rendered shim, intact            → ok  (renderer ran, exit 0)
 *   N1 .zcode/skills link removed       → drift (the harness-config-drift N2 defect, now
 *                                          caught on the machine that has the shim)
 *   N2 .zcode/config.json hand-edited   → drift
 *   S1 no .zcode/ at all (CI, worktree) → skip, renderer NEVER invoked
 *   S2 .zcode/ present, no renderer     → skip (not the framework layout)
 *   N3 skills link, no config.json      → partial (the renderer would skip its whole
 *                                          zcode branch and exit 0 — never report ok)
 *   S3 .zcode/plans only (ZCode data)   → skip with a visible note, renderer not started
 *   E1/E2 timeout / node missing        → error, not drift
 * Plus the wiring: the section is registered in pre-push SECTIONS as maintainer-owned,
 * and the PREPUSH_ONLY seam runs it end to end through the real hook.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { runCheck, type CheckResult } from '../utils/run-check.ts';
import {
  checkLocalHarnessConfig,
  RENDERER_REL,
  type RendererRunner,
} from './harness-config-local.ts';
import { SECTIONS } from '../pre-push.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../..');

const sandboxes: string[] = [];
afterAll(() => {
  for (const d of sandboxes) rmSync(d, { recursive: true, force: true });
});

/** A framework-shaped tmpdir: real model + settings + plugin hooks + the real renderer. */
function sandbox(): string {
  const dir = mkdtempSync(join(tmpdir(), 'harness-local-'));
  sandboxes.push(dir);
  for (const rel of [
    '.ai-factory/harness-model.json',
    '.claude/settings.json',
    'plugin/hooks/hooks.json',
    RENDERER_REL,
    'scripts/render-codex-contributor.mjs',
  ]) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    copyFileSync(join(REPO_ROOT, rel), join(dir, rel));
  }
  mkdirSync(join(dir, '.claude/skills'), { recursive: true });
  return dir;
}

const realRunner: RendererRunner = (root, args) =>
  runCheck(process.execPath, args, { cwd: root });

/** Records every call so a skip can prove the renderer was never started. */
function spyRunner(): { runner: RendererRunner; calls: string[][] } {
  const calls: string[][] = [];
  const runner: RendererRunner = (root, args) => {
    calls.push([root, ...args]);
    return realRunner(root, args);
  };
  return { runner, calls };
}

const out = (r: CheckResult) => `${r.stdout}${r.stderr}`;

function rendered(): string {
  const s = sandbox();
  const w = realRunner(s, [RENDERER_REL, '--write', '--root', s]);
  expect(w.exitCode, out(w)).toBe(0);
  return s;
}

describe('harness-config-local — decision logic against the real renderer', () => {
  it('P: an intact rendered shim passes and the renderer actually ran', () => {
    const s = rendered();
    const { runner, calls } = spyRunner();

    const v = checkLocalHarnessConfig(s, runner);

    expect(v.kind).toBe('ok');
    expect(calls).toEqual([[s, RENDERER_REL, '--check', '--root', s]]);
  });

  it('N1: a removed .zcode/skills link is reported as drift', () => {
    const s = rendered();
    unlinkSync(join(s, '.zcode/skills'));

    const v = checkLocalHarnessConfig(s, realRunner);

    expect(v.kind).toBe('drift');
    if (v.kind === 'drift') expect(out(v.result)).toContain('symlink');
  });

  it('N2: a hand-edited .zcode/config.json is reported as drift', () => {
    const s = rendered();
    const p = join(s, '.zcode/config.json');
    const j = JSON.parse(readFileSync(p, 'utf8'));
    j.mcp.servers.context7.url = 'https://evil.example/mcp';
    writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`);

    const v = checkLocalHarnessConfig(s, realRunner);

    expect(v.kind).toBe('drift');
    if (v.kind === 'drift')
      expect(out(v.result)).toContain('.zcode/config.json');
  });

  it('S1: no .zcode/ → skip without ever starting the renderer', () => {
    const s = sandbox();
    const { runner, calls } = spyRunner();

    const v = checkLocalHarnessConfig(s, runner);

    expect(v.kind).toBe('skip');
    expect(calls).toEqual([]);
  });

  it('S2: .zcode/ present but no renderer (non-framework layout) → skip', () => {
    const s = rendered();
    rmSync(join(s, RENDERER_REL));
    const { runner, calls } = spyRunner();

    const v = checkLocalHarnessConfig(s, runner);

    expect(v.kind).toBe('skip');
    expect(calls).toEqual([]);
  });
});

describe('harness-config-local — the renderer-would-skip states (cold-review MAJOR)', () => {
  it('N3: .zcode/skills present but .zcode/config.json absent → partial, never ok', () => {
    const s = rendered();
    rmSync(join(s, '.zcode/config.json'));
    const { runner, calls } = spyRunner();

    const v = checkLocalHarnessConfig(s, runner);

    expect(v.kind).toBe('partial');
    expect(calls).toEqual([]);
  });

  it('N3b: a dangling .zcode/skills link without config.json is still partial', () => {
    const s = rendered();
    rmSync(join(s, '.zcode/config.json'));
    unlinkSync(join(s, '.zcode/skills'));
    symlinkSync('../no-such-dir', join(s, '.zcode/skills'));

    expect(checkLocalHarnessConfig(s, realRunner).kind).toBe('partial');
  });

  it('S3: .zcode/ holding only ZCode runtime data (plans/) → skip WITH a visible note', () => {
    const s = sandbox();
    mkdirSync(join(s, '.zcode/plans'), { recursive: true });
    const { runner, calls } = spyRunner();

    const v = checkLocalHarnessConfig(s, runner);

    expect(v.kind).toBe('skip');
    if (v.kind === 'skip') expect(v.note).toMatch(/config\.json absent/);
    expect(calls).toEqual([]);
  });

  it('E1: a renderer timeout is an error verdict, not drift', () => {
    const s = rendered();
    const timedOut: CheckResult = {
      exitCode: 124,
      stdout: '',
      stderr: '',
      timedOut: true,
      notFound: false,
    };

    expect(checkLocalHarnessConfig(s, () => timedOut).kind).toBe('error');
  });

  it('E2: node not found is an error verdict, not drift', () => {
    const s = rendered();
    const missing: CheckResult = {
      exitCode: 127,
      stdout: '',
      stderr: '',
      timedOut: false,
      notFound: true,
    };

    expect(checkLocalHarnessConfig(s, () => missing).kind).toBe('error');
  });
});

describe('harness-config-local — pre-push wiring', () => {
  it('is registered as a maintainer-owned pre-push section', () => {
    const entry = SECTIONS.find((s) => s.id === 'harness-config-local');

    expect(entry?.owner).toBe('maintainer');
  });

  // Deterministic only where this checkout has no .zcode/ (CI, agent worktrees): there the
  // section must be a silent no-op. A checkout holding a real shim skips LOUDLY instead of
  // letting untracked local state decide an unrelated test run.
  it.skipIf(existsSync(join(REPO_ROOT, '.zcode')))(
    'PREPUSH_ONLY seam: the real hook runs the section and no-ops silently without .zcode/',
    () => {
      const r = spawnSync(
        process.execPath,
        ['--import', 'tsx/esm', resolve(HERE, '../pre-push.ts')],
        {
          cwd: resolve(HERE, '../..'),
          input: '',
          encoding: 'utf8',
          env: { ...process.env, PREPUSH_ONLY: 'harness-config-local' },
          timeout: 60_000,
        },
      );

      expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
      expect(r.stderr).not.toMatch(/matches no pre-push section id/);
      expect(r.stdout).toBe('');
    },
    60_000,
  );
});
