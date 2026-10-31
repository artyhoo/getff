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
  findRealJqExe,
  findRealGitExe,
  gitBashCandidateDirs,
  isBashLikeCommand,
  MSYS_ACCESS_VIOLATION_EXIT,
  planWin32BashSpawn,
  resolveShSibling,
  runBashArm,
  spawnBashOrSkip,
  toMsysArg,
  fromMsysPath,
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

describe('toMsysArg (win32 argv adaptation, pure)', () => {
  it('converts drive-letter-absolute backslash paths to MSYS form', () => {
    expect(toMsysArg('D:\\a\\getff\\.agents\\hooks\\x.sh')).toBe(
      '/d/a/getff/.agents/hooks/x.sh',
    );
  });
  it('converts drive-letter-absolute forward-slash paths too', () => {
    expect(toMsysArg('C:/Users/runneradmin/t')).toBe('/c/Users/runneradmin/t');
  });
  it('passes non-path args through byte-identical', () => {
    expect(toMsysArg('--list')).toBe('--list');
    expect(toMsysArg('main')).toBe('main');
    expect(toMsysArg('/already/msys')).toBe('/already/msys');
    // A bare `D:` relative drive reference is NOT converted (no separator follows).
    expect(toMsysArg('D:rel')).toBe('D:rel');
  });
});

describe('fromMsysPath (inverse of toMsysArg, pure + platform-injected)', () => {
  it('converts an MSYS drive path to Windows form on win32', () => {
    expect(fromMsysPath('/d/a/getff/packages/core', 'win32')).toBe(
      'D:/a/getff/packages/core',
    );
  });
  it('is the identity for non-drive-rooted inputs on win32', () => {
    expect(fromMsysPath('/tmp/heavy-runner-x/record', 'win32')).toBe(
      '/tmp/heavy-runner-x/record',
    );
    expect(fromMsysPath('npm', 'win32')).toBe('npm');
  });
  it('is the identity off win32 — POSIX /d/… paths are never mangled', () => {
    expect(fromMsysPath('/d/a/getff', 'darwin')).toBe('/d/a/getff');
    expect(fromMsysPath('/usr/bin', 'linux')).toBe('/usr/bin');
  });
  it('round-trips toMsysArg on win32', () => {
    const win = 'D:\\a\\getff\\packages\\core';
    expect(fromMsysPath(toMsysArg(win), 'win32')).toBe('D:/a/getff/packages/core');
  });
});

describe('findRealGitExe (injected PATH)', () => {
  it('finds a fabricated git.exe on the injected PATH', () => {
    const dir = mkdtempSync(join(tmpdir(), 'git-probe-'));
    writeFileSync(join(dir, 'git.exe'), 'stub');
    try {
      expect(findRealGitExe({ PATH: dir })).toBe(join(dir, 'git.exe'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('returns null when PATH holds no git.exe', () => {
    const dir = mkdtempSync(join(tmpdir(), 'git-probe-empty-'));
    try {
      expect(findRealGitExe({ PATH: dir })).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('findRealJqExe (injected PATH)', () => {
  it('finds a fabricated jq.exe on the injected PATH', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jq-probe-'));
    writeFileSync(join(dir, 'jq.exe'), 'stub');
    try {
      expect(findRealJqExe({ PATH: dir })).toBe(join(dir, 'jq.exe'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('returns null when PATH holds no jq.exe (jq-less stays jq-less)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jq-probe-empty-'));
    try {
      expect(findRealJqExe({ PATH: dir })).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('runBashArm (W-R2: no access-violation replay, first result wins)', () => {
  /** The observed-risk regression shape (affected review 2026-10-21): a Git-Bash child
   *  performs fixture/SUT side effects, then dies 0xC0000005. The pre-rework helper
   *  replayed the whole invocation and returned only the second result — a passing
   *  attempt-2 hid the failure and duplicated non-idempotent effects. The contract now,
   *  pinned causally with an injected spawn: exactly ONE invocation, and the FIRST
   *  result — crash included — is what the caller sees. */
  it('returns the 0xC0000005 result AS-IS after exactly one spawn — failure preserved, no second invocation', () => {
    let calls = 0;
    let argv: string[] = [];
    const crash = {
      status: MSYS_ACCESS_VIOLATION_EXIT,
      stdout: '',
      stderr: 'msys-2.0.dll: 0xC0000005',
    };
    const countingSpawn = ((_file: string, a: string[]) => {
      calls++;
      argv = [...a];
      return crash;
    }) as unknown as typeof spawnSync;
    const r = runBashArm(countingSpawn, 'C:/Git/bin/bash.exe', ['C:\\t\\x.sh'], {});
    expect(calls).toBe(1); // no replay — ever
    expect(argv).toEqual(['/c/t/x.sh']); // argv adaptation still applied on that one spawn
    expect(r.status).toBe(MSYS_ACCESS_VIOLATION_EXIT); // the FIRST failure is the result
    expect(r.stderr).toBe('msys-2.0.dll: 0xC0000005');
  });

  it('a succeeding first invocation is returned unchanged too (no hidden extra spawn)', () => {
    let calls = 0;
    const ok = { status: 0, stdout: 'hi\n', stderr: '' };
    const countingSpawn = (() => {
      calls++;
      return ok;
    }) as unknown as typeof spawnSync;
    const r = runBashArm(countingSpawn, 'bash.exe', ['-lc', 'true'], {});
    expect(calls).toBe(1);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('hi\n');
  });
});
