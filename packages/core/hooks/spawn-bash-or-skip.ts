// spawn-bash-or-skip.ts — Windows-portable shared test helper for tests that spawn bash
// (#1799: 125 `spawnSync('bash'|'/bin/bash'|'sh', …)` sites across 49 hooks-suite test
// files get status -1 on win32 — `bash` is not on PATH (runners expose only Git\cmd) and
// /bin/bash does not exist, so the windows-hooks cell failed 209 cases at first live
// firing). On POSIX this is a byte-identical pass-through to child_process.spawnSync with
// the caller's EXACT command, args and options (same argv shape, same status semantics —
// the §0.11 CC-compatibility invariant). On win32: a bash-like command ('bash',
// '/bin/bash', 'sh', …) resolves Git Bash's bash.exe — PATH first, then GitHub's own
// documented `shell: bash` roots (docs.github.com workflow syntax: C:\Program Files\Git\bin,
// C:\Program Files (x86)\Git\bin, %LOCALAPPDATA%\Programs\Git\bin; runners put only
// Git\cmd on PATH, so the roots arm is load-bearing on CI) — and spawns THAT. A command no
// Git Bash can satisfy (absolute /bin/… // /usr/… binaries, MSYS-only tooling) SKIPS the
// enclosing test with a named reason — a visible named skip, never a silent pass.
// Resolution-vs-skip decisions log to stderr behind DEBUG_WIN_SPAWN=1 (test-side debug
// output never touches stdout). BFR consult: .ai-factory/wave-report-w3h2.md §2b (BUILD;
// no SSOT row owns bash resolution — closest #40 negative, #54 runner-shape ADAPT).
import { spawnSync } from 'node:child_process';
import type {
  SpawnSyncOptions,
  SpawnSyncOptionsWithStringEncoding,
  SpawnSyncReturns,
} from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';

/** Minimal structural slice of the vitest test/hook context this helper needs. */
export interface Skippable {
  skip(note?: string): void;
}

/** Context for module-scope call sites (no vitest ctx exists at import time). Module-scope
 *  spawns either never run on win32 (suites imported lazily) or the suite is win32-hostile
 *  by construction; if a skip is ever reached there, fail LOUD — never a silent pass. */
export function failLoudSkipContext(what: string): Skippable {
  return {
    skip: (note?: string) => {
      throw new Error(
        `spawnBashOrSkip: ${what} cannot skip (no vitest ctx at module scope): ${note}`,
      );
    },
  };
}

/** Is this command one a Git Bash install satisfies? Matches the bare name and the
 *  common absolute spellings tests use today ('bash', '/bin/bash', '/usr/bin/bash',
 *  'sh', '/bin/sh', '/usr/bin/sh', with or without .exe). */
export function isBashLikeCommand(command: string): boolean {
  const base = (command.split(/[\\/]/).pop() ?? command).toLowerCase();
  return base === 'bash' || base === 'sh' || base === 'bash.exe' || base === 'sh.exe';
}

/** Candidate directories holding bash.exe: PATH entries first, then GitHub's documented
 *  `shell: bash` fallback roots (docs.github.com). `env` is injectable for tests. */
export function gitBashCandidateDirs(env: NodeJS.ProcessEnv): string[] {
  const dirs: string[] = [];
  for (const entry of (env.PATH ?? '').split(delimiter)) {
    if (entry) dirs.push(entry);
  }
  dirs.push(
    join(env['ProgramFiles'] ?? 'C:\\Program Files', 'Git', 'bin'),
    join(env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Git', 'bin'),
    join(env['LOCALAPPDATA'] ?? join(env['USERPROFILE'] ?? '', 'AppData', 'Local'),
      'Programs', 'Git', 'bin'),
  );
  return dirs;
}

/** Resolve bash.exe, or null. PATH first (a user/tooling install wins), then the
 *  well-known roots — GitHub runners expose only Git\cmd on PATH, so the roots arm is
 *  what makes this work on windows-latest. */
export function findGitBashExe(env: NodeJS.ProcessEnv = process.env): string | null {
  for (const dir of gitBashCandidateDirs(env)) {
    const candidate = join(dir, 'bash.exe');
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** sh.exe sits beside the resolved bash.exe (Git for Windows ships both in Git\bin);
 *  null when the sibling is absent — never a silent bash-for-sh substitution. */
export function resolveShSibling(bashExe: string): string | null {
  const sibling = join(dirname(bashExe), 'sh.exe');
  return existsSync(sibling) ? sibling : null;
}

/** The win32 decision, pure and injected so it is unit-testable off-Windows. */
export type Win32BashPlan =
  | { kind: 'spawn'; file: string }
  | { kind: 'skip'; note: string };

export function planWin32BashSpawn(
  command: string,
  findBash: () => string | null,
): Win32BashPlan {
  if (isBashLikeCommand(command)) {
    const bashExe = findBash();
    if (!bashExe) {
      return {
        kind: 'skip',
        note: `skipped on win32: no Git Bash resolved (PATH + Program Files roots) to spawn ${command} — #1799`,
      };
    }
    const base = (command.split(/[\\/]/).pop() ?? command).toLowerCase();
    const wantsSh = base === 'sh' || base === 'sh.exe';
    if (wantsSh) {
      const shExe = resolveShSibling(bashExe);
      if (!shExe) {
        return {
          kind: 'skip',
          note: `skipped on win32: Git Bash resolved at ${bashExe} but no sh.exe sibling for ${command} — #1799`,
        };
      }
      return { kind: 'spawn', file: shExe };
    }
    return { kind: 'spawn', file: bashExe };
  }
  if (command.startsWith('/')) {
    return {
      kind: 'skip',
      note: `skipped on win32: ${command} is an absolute POSIX binary Git Bash cannot stand in for — #1799`,
    };
  }
  // Bare non-bash command ('git', 'node', …): PATH semantics are the caller's subject —
  // spawn as-is (git.exe resolves via Git\cmd on runners).
  return { kind: 'spawn', file: command };
}

/** Directory holding the resolved bash.exe — for constructing a child-env PATH in which
 *  a SUT that ITSELF spawns bash (e.g. the pre-push hook funnel) resolves it. Null
 *  off-Windows, so POSIX callers append nothing and the PATH string is unchanged (the
 *  §0.11 byte-identical invariant). */
export function gitBashPathDir(env: NodeJS.ProcessEnv = process.env): string | null {
  if (process.platform !== 'win32') return null;
  const exe = findGitBashExe(env);
  return exe ? dirname(exe) : null;
}

function debugWinSpawn(msg: string): void {
  if (process.env.DEBUG_WIN_SPAWN === '1') console.error(`[spawn-bash-or-skip] ${msg}`);
}

/** POSIX: byte-identical spawnSync pass-through. win32: resolve-and-spawn, or skip the
 *  enclosing test with a named reason. */
export function spawnBashOrSkip(
  ctx: Skippable,
  command: string,
  args: readonly string[],
  options: SpawnSyncOptionsWithStringEncoding,
): SpawnSyncReturns<string>;
export function spawnBashOrSkip(
  ctx: Skippable,
  command: string,
  args: readonly string[],
  options?: SpawnSyncOptions,
): SpawnSyncReturns<Buffer>;
export function spawnBashOrSkip(
  ctx: Skippable,
  command: string,
  args: readonly string[],
  options?: SpawnSyncOptions,
): SpawnSyncReturns<string | Buffer> {
  if (process.platform !== 'win32') {
    return spawnSync(command, args as string[], options);
  }
  const plan = planWin32BashSpawn(command, () => findGitBashExe());
  if (plan.kind === 'skip') {
    debugWinSpawn(plan.note);
    ctx.skip(plan.note);
    // Unreachable at runtime — vitest ctx.skip() aborts the running test; the throw is
    // what narrows `plan` to the 'spawn' arm for tsc (ctx.skip is typed `void`).
    throw new Error('unreachable: ctx.skip aborts the test');
  }
  debugWinSpawn(`win32 resolved ${command} -> ${plan.file}`);
  return spawnSync(plan.file, args as string[], options);
}
