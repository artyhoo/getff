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
// output never touches stdout). BFR consult: prior-art-evaluations.md#316 (BUILD;
// introduced #313 at eca6e188b, 313 -> 314 -> 316 per row-#308 convention; closest
// #40 negative, #54 runner-shape ADAPT).
import { spawnSync } from 'node:child_process';
import type {
  SpawnSyncOptions,
  SpawnSyncOptionsWithStringEncoding,
  SpawnSyncReturns,
} from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

/**
 * Spread into a win32 child env so MSYS `ln -s` creates NATIVE symlinks (GitHub
 * runners grant the privilege) instead of the default deep copy. SUTs whose guards and
 * assertions are `[ -L path ]` / `lstat().isSymbolicLink()` see a copy as neither, so
 * whole suites of link-shaped assertions go false-negative on win32 without it. POSIX
 * bash ignores the variable; the object is empty there.
 */
export const WIN_MSYS_SYMLINK_ENV: Record<string, string> =
  process.platform === 'win32' ? { MSYS: 'winsymlinks:nativestrict' } : {};

function debugWinSpawn(msg: string): void {
  if (process.env.DEBUG_WIN_SPAWN === '1') console.error(`[spawn-bash-or-skip] ${msg}`);
}

/**
 * Drive-letter-absolute argv -> MSYS form, for args handed to Git Bash (`D:\a\x` or
 * `D:/a/x` -> `/d/a/x`). Without it bash receives the Windows spelling verbatim: MSYS
 * performs no argv translation for CreateProcess-passed strings, so `BASH_SOURCE[0]`
 * keeps `D:\…`, `${BASH_SOURCE[0]%/*}` finds no `/` and a hook's prelude degrades to its
 * broken-install fallback, and forward-slash suffix globs (the `.claude`-anchored hook
 * path matchers) never match.
 * Non-path args pass through byte-identical; only a drive-letter-absolute prefix converts.
 */
export function toMsysArg(arg: string): string {
  if (!/^[A-Za-z]:[\\/]/.test(arg)) return arg;
  return `/${arg[0].toLowerCase()}${arg.slice(2).replace(/\\/g, '/')}`;
}

/**
 * MSYS path -> Windows form (`/d/a/x` -> `D:/a/x`) — the inverse of toMsysArg,
 * for asserting on paths a Git-Bash child ECHOES back (its `pwd -P`). Off win32
 * the function is the identity, so a POSIX `/d/…` directory is never mangled.
 * `platform` is injectable so the conversion is unit-testable off-Windows.
 */
export function fromMsysPath(
  p: string,
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform !== 'win32') return p;
  if (!/^\/[A-Za-z]\//.test(p)) return p;
  return `${p[1].toUpperCase()}:${p.slice(2)}`;
}

/** Absolute path of the real jq.exe on this machine, or null (PATH scan, mirroring
 *  findGitBashExe). jq-less environments stay jq-less — the SUT guard handles that. */
export function findRealJqExe(env: NodeJS.ProcessEnv = process.env): string | null {
  for (const entry of (env.PATH ?? '').split(delimiter)) {
    if (!entry) continue;
    const candidate = join(entry, 'jq.exe');
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Absolute path of the real git.exe (PATH scan — runners expose Git\cmd). */
export function findRealGitExe(env: NodeJS.ProcessEnv = process.env): string | null {
  for (const entry of (env.PATH ?? '').split(delimiter)) {
    if (!entry) continue;
    const candidate = join(entry, 'git.exe');
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Locate a Git-for-Windows coreutils PE (`false.exe`, `yes.exe`, …) usable as a
 *  stand-in where a test needs a REAL executable with a fixed observable behaviour
 *  and the POSIX fixture was an extensionless sh script CreateProcess cannot run
 *  (#1799). PATH first, then beside the resolved bash (Git\usr\bin ships coreutils). */
export function findMsysCoreutil(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const candidates: string[] = [];
  for (const entry of (env.PATH ?? '').split(delimiter)) {
    if (entry) candidates.push(join(entry, `${name}.exe`));
  }
  const bash = findGitBashExe(env);
  if (bash) {
    candidates.push(join(dirname(bash), `${name}.exe`));
    candidates.push(join(dirname(dirname(bash)), 'usr', 'bin', `${name}.exe`));
  }
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

let winShimDir: string | null = null;

/**
 * One-process singleton directory holding the win32 sh-shims prepended to every
 * Git-Bash child's PATH (the win32 bash arm only; POSIX spawns never see it):
 *
 * - `jq` — pipes the real jq.exe's output through `tr -d '\r'`: the runner's jq.exe
 *   emits CRLF line endings, which poison every `$(jq …)` capture in POSIX-shaped
 *   SUTs (`TOOL='Write\r'` misses its case arm, emitted ids grow trailing `\r`).
 *
 * - `git` — aligns `rev-parse`'s path dialect with the MSYS one: git.exe prints
 *   `C:/x/y` while bash's `pwd -P` prints `/c/x/y`, so a SUT that anchors with
 *   `git rev-parse --show-toplevel` and then contains files by `pwd -P` rejects
 *   its own repo (`format-shipped: alias leaves repository`, #1799). The shim
 *   rewrites drive-letter-prefixed OUTPUT lines to MSYS form; every other
 *   subcommand execs the real git.exe untouched.
 *
 * Both call the absolute real binary so recursion cannot come back through the
 * shim; both preserve the child's exit code via command substitution.
 */
function ensureWinShimDir(): string | null {
  if (winShimDir !== null) return winShimDir || null;
  const realJq = findRealJqExe();
  const realGit = findRealGitExe();
  if (!realJq && !realGit) {
    winShimDir = '';
    return null;
  }
  const dir = mkdtempSync(join(tmpdir(), 'win-shims-'));
  if (realJq) {
    writeFileSync(
      join(dir, 'jq'),
      `#!/bin/sh\nout=$("${realJq.replace(/"/g, '')}" "$@")\nrc=$?\nprintf '%s\\n' "$out" | tr -d '\\r'\nexit $rc\n`,
    );
    chmodSync(join(dir, 'jq'), 0o755);
  }
  if (realGit) {
    // GNU sed (Git Bash): \l\1 lowercases the drive letter; the character class
    // accepts both separator spellings git might print. The arg scan (not just
    // "$1") also covers `git -C <dir> rev-parse …` anchor shapes.
    writeFileSync(
      join(dir, 'git'),
      '#!/bin/sh\n' +
        `real="${realGit.replace(/"/g, '')}"\n` +
        'for a in "$@"; do\n' +
        '  if [ "$a" = "rev-parse" ]; then\n' +
        '    out=$("$real" "$@")\n' +
        '    rc=$?\n' +
        `    printf '%s\\n' "$out" | tr -d '\\r' | sed -E 's#^([A-Za-z]):[/\\\\]#/\\l\\1/#'\n` +
        '    exit $rc\n' +
        '  fi\n' +
        'done\n' +
        'exec "$real" "$@"\n',
    );
    chmodSync(join(dir, 'git'), 0o755);
  }
  winShimDir = dir;
  return dir;
}

/** Child PATH with the win32 shims prepended (win32 bash arm only). */
function childPathWithWinShims(env: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
  const shim = ensureWinShimDir();
  if (!shim) return env ?? process.env;
  const base = env ?? process.env;
  return { ...base, PATH: `${shim}${delimiter}${base.PATH ?? ''}` };
}

/** NTSTATUS 0xC0000005 (access violation) as an unsigned exit code — observed on the
 *  Windows CI inventory run 38988360013: 4/7 arms of delta-write-from-state.test.ts died
 *  with it while byte-identical arm shapes passed in update-delta.test.ts (durations
 *  85-441 ms). UNRESOLVED platform risk, deliberately NOT classified as a harmless
 *  pre-script init crash: an exit code and short durations do not establish that no
 *  script line ran, so the helper performs NO automatic replay (W-R2, affected review
 *  2026-10-21) — a caller seeing this status sees the FIRST invocation's real result,
 *  preserving the failure as evidence. Exported for the W-R2 regression control. */
export const MSYS_ACCESS_VIOLATION_EXIT = 3221225477;

/** The win32 bash-arm spawn: MSYS-adapted argv, exactly ONE invocation, first result
 *  wins — no retry, no replay (W-R2: a respawn could duplicate script effects and hide
 *  the first failure). The spawn function is injectable (this file's planWin32BashSpawn/
 *  fromMsysPath injection idiom) so the no-replay contract is causally testable on
 *  every platform. */
export function runBashArm(
  spawn: typeof spawnSync,
  file: string,
  args: readonly string[],
  opts: SpawnSyncOptions,
) {
  return spawn(file, args.map(toMsysArg), opts);
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
  // Only the Git-Bash arm gets argv/PATH adaptation: a bare-command child ('git',
  // 'node', …) receives Windows-native arguments, where a converted `/d/…` would be
  // wrong. POSIX spawns above stay byte-identical.
  if (isBashLikeCommand(command)) {
    const opts: SpawnSyncOptions = { ...options };
    opts.env = childPathWithWinShims(options?.env);
    // W-R2 (affected review 2026-10-21): ONE invocation; the first result — including a
    // 0xC0000005 access violation (see MSYS_ACCESS_VIOLATION_EXIT) — is returned as-is.
    // No replay: a respawn could duplicate non-idempotent script effects and hide the
    // first failure behind a passing second attempt.
    return runBashArm(spawnSync, plan.file, args as string[], opts);
  }
  return spawnSync(plan.file, args as string[], options);
}
