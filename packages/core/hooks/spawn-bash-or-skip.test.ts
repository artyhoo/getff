// Tests for spawn-bash-or-skip.ts — the win32 bash-resolution seam for hooks-suite tests
// (#1799). The POSIX invariant is the load-bearing one here: the helper must be a
// byte-identical spawnSync pass-through off-Windows (same command, same argv shape, same
// status semantics — the §0.11 CC-compatibility invariant), so the identity is pinned by
// running BOTH the helper and raw spawnSync against a real child process and comparing.
// The win32 decision core is pure + injected (findBash/env params) so every branch —
// bash resolve, sh-sibling resolve, no-Git-Bash skip, absolute-POSIX-binary skip,
// bare-non-bash pass-through — is asserted HERE on linux, not inferred from the CI log.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import {
  failLoudSkipContext,
  findGitBashExe,
  gitBashCandidateDirs,
  isBashLikeCommand,
  planWin32BashSpawn,
  resolveShSibling,
  spawnBashOrSkip,
  type Skippable,
} from './spawn-bash-or-skip.ts';

/** A Skippable that fails the test if skip is ever reached — POSIX must never skip. */
const noSkipCtx: Skippable = {
  skip: (note?: string) => {
    throw new Error(`unexpected skip: ${note ?? '(no note)'}`);
  },
};

// WIN_POSIX_BASH_PIN: this describe pins the POSIX arm by running a REAL bash through raw
// spawnSync and comparing the helper against it. On win32 there is no `bash`/`/bin/bash` for
// raw spawnSync (the helper exists precisely to resolve or named-skip it), so the raw-comparison
// class cannot hold there; the abs-/bin/bash case is the helper's named-skip branch on win32 and
// the noSkipCtx sentinel would (correctly) throw. The win32 decision core is asserted below via
// pure/injected params, not via a real Windows bash.
const WIN_POSIX_BASH_PIN = process.platform === 'win32';

describe.skipIf(WIN_POSIX_BASH_PIN)('POSIX byte-identical pass-through (the §0.11 invariant)', () => {
  it('returns the same status/stdout/stderr as raw spawnSync for the same argv', () => {
    const args = ['-c', 'printf out; printf err >&2; exit 3'];
    const raw = spawnSync('bash', args, { encoding: 'utf8' });
    const viaHelper = spawnBashOrSkip(noSkipCtx, 'bash', args, { encoding: 'utf8' });
    expect(viaHelper.status).toBe(raw.status);
    expect(viaHelper.status).toBe(3);
    expect(viaHelper.stdout).toBe(raw.stdout);
    expect(viaHelper.stderr).toBe(raw.stderr);
  });

  it('passes the absolute /bin/bash spelling through verbatim on POSIX', () => {
    const viaHelper = spawnBashOrSkip(noSkipCtx, '/bin/bash', ['-c', 'echo posix'], {
      encoding: 'utf8',
    });
    expect(viaHelper.status).toBe(0);
    expect(viaHelper.stdout).toBe('posix\n');
  });

  it('forwards input/env options untouched (stdin round-trip)', () => {
    const viaHelper = spawnBashOrSkip(noSkipCtx, 'bash', ['-c', 'cat'], {
      input: 'stdin-payload',
      encoding: 'utf8',
    });
    expect(viaHelper.status).toBe(0);
    expect(viaHelper.stdout).toBe('stdin-payload');
  });

  it('Buffer default: no encoding option → stdout is a Buffer like raw spawnSync', () => {
    const raw = spawnSync('bash', ['-c', 'echo buf']);
    const viaHelper = spawnBashOrSkip(noSkipCtx, 'bash', ['-c', 'echo buf']);
    expect(Buffer.isBuffer(viaHelper.stdout)).toBe(true);
    expect((viaHelper.stdout as Buffer).toString()).toBe((raw.stdout as Buffer).toString());
  });
});

describe('isBashLikeCommand', () => {
  it('classifies the spellings tests use today', () => {
    for (const cmd of ['bash', '/bin/bash', '/usr/bin/bash', 'sh', '/bin/sh', '/usr/bin/sh', 'bash.exe', 'sh.exe'])
      expect(isBashLikeCommand(cmd), cmd).toBe(true);
  });

  it('rejects non-bash commands — including the bash-endsWith-sh regression', () => {
    // 'bash'.endsWith('sh') is true; the naive suffix check would route bash to sh.exe.
    for (const cmd of ['git', '/usr/bin/which', 'node', '/bin/echo', 'bashx', 'shify'])
      expect(isBashLikeCommand(cmd), cmd).toBe(false);
  });
});

describe('planWin32BashSpawn (pure decision core)', () => {
  it('bash + resolved Git Bash → spawn the resolved bash.exe', () => {
    const plan = planWin32BashSpawn('bash', () => 'C:\\Program Files\\Git\\bin\\bash.exe');
    expect(plan).toEqual({ kind: 'spawn', file: 'C:\\Program Files\\Git\\bin\\bash.exe' });
  });

  it('absolute /bin/bash + resolved Git Bash → spawn the resolved bash.exe (not the POSIX path)', () => {
    const plan = planWin32BashSpawn('/bin/bash', () => 'C:\\Git\\bin\\bash.exe');
    expect(plan).toEqual({ kind: 'spawn', file: 'C:\\Git\\bin\\bash.exe' });
  });

  it('no Git Bash resolvable → named skip, never a silent pass', () => {
    const plan = planWin32BashSpawn('/bin/bash', () => null);
    expect(plan.kind).toBe('skip');
    if (plan.kind === 'skip') {
      expect(plan.note).toContain('no Git Bash resolved');
      expect(plan.note).toContain('/bin/bash');
      expect(plan.note).toContain('#1799');
    }
  });

  it('sh consults the sh.exe sibling; a nonexistent sibling → named skip', () => {
    // Deliberately fabricated on BOTH platforms (not the real Git root — that exists on
    // win32 runners and would flip this case to the spawn arm there).
    const plan = planWin32BashSpawn(
      '/bin/sh',
      () => 'C:\\definitely-not-a-real-git-install\\bin\\bash.exe',
    );
    expect(plan.kind).toBe('skip');
    if (plan.kind === 'skip') {
      expect(plan.note).toContain('no sh.exe sibling');
      expect(plan.note).toContain('#1799');
    }
  });

  it('absolute POSIX binary that is not bash → named skip naming the binary', () => {
    const plan = planWin32BashSpawn('/usr/bin/which', () => 'C:\\Git\\bin\\bash.exe');
    expect(plan.kind).toBe('skip');
    if (plan.kind === 'skip') {
      expect(plan.note).toContain('/usr/bin/which');
      expect(plan.note).toContain('cannot stand in');
      expect(plan.note).toContain('#1799');
    }
  });

  it('bare non-bash command (git) → spawn as-is, PATH semantics stay the caller subject', () => {
    const plan = planWin32BashSpawn('git', () => null);
    expect(plan).toEqual({ kind: 'spawn', file: 'git' });
  });
});

describe('findGitBashExe / gitBashCandidateDirs / resolveShSibling (injected-env)', () => {
  let probe: string;
  let cleanup: () => void;

  it('orders PATH entries before the well-known roots, and finds a fabricated root install', () => {
    probe = mkdtempSync(join(tmpdir(), 'winbash-'));
    const binDir = join(probe, 'bin');
    const rootInstall = join(probe, 'Program Files', 'Git', 'bin');
    mkdirSync(binDir, { recursive: true });
    mkdirSync(rootInstall, { recursive: true });
    writeFileSync(join(rootInstall, 'bash.exe'), 'stub');
    writeFileSync(join(binDir, 'bash.exe'), 'stub-on-path');
    cleanup = () => rmSync(probe, { recursive: true, force: true });

    const env: NodeJS.ProcessEnv = {
      PATH: [binDir, join(probe, 'Git', 'cmd')].join(delimiter),
      ProgramFiles: join(probe, 'Program Files'),
      'ProgramFiles(x86)': join(probe, 'pf86'),
      LOCALAPPDATA: join(probe, 'local'),
      USERPROFILE: join(probe, 'home'),
    };
    // PATH wins: the binDir stub precedes the roots in the candidate list.
    expect(gitBashCandidateDirs(env)[0]).toBe(binDir);
    expect(findGitBashExe(env)).toBe(join(binDir, 'bash.exe'));

    // Without any PATH hit, the ProgramFiles root arm resolves the install.
    const noPathEnv: NodeJS.ProcessEnv = { ...env, PATH: '' };
    expect(findGitBashExe(noPathEnv)).toBe(join(rootInstall, 'bash.exe'));
  });

  it('returns null when no candidate exists (the skip arm precondition)', () => {
    const empty: NodeJS.ProcessEnv = {
      PATH: '',
      ProgramFiles: join(tmpdir(), 'winbash-nonexistent-pf'),
      'ProgramFiles(x86)': join(tmpdir(), 'winbash-nonexistent-pf86'),
      LOCALAPPDATA: join(tmpdir(), 'winbash-nonexistent-local'),
      USERPROFILE: join(tmpdir(), 'winbash-nonexistent-home'),
    };
    expect(findGitBashExe(empty)).toBeNull();
  });

  it('resolveShSibling finds sh.exe beside bash.exe and returns null without one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'shsibling-'));
    writeFileSync(join(dir, 'bash.exe'), 'stub');
    expect(resolveShSibling(join(dir, 'bash.exe'))).toBeNull();
    writeFileSync(join(dir, 'sh.exe'), 'stub');
    expect(resolveShSibling(join(dir, 'bash.exe'))).toBe(join(dir, 'sh.exe'));
    rmSync(dir, { recursive: true, force: true });
  });

  it('cleaned up the probe dir', () => {
    if (cleanup) cleanup();
    expect(existsSync(probe)).toBe(false);
  });
});

describe('failLoudSkipContext (module-scope sites)', () => {
  it('throws when skip is reached — never a silent module-scope pass', () => {
    const ctx = failLoudSkipContext('module-scope fixture');
    expect(() => ctx.skip('would-be note')).toThrow(/module-scope fixture.*cannot skip/);
  });
});
