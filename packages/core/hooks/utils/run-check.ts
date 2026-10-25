/**
 * run-check.ts — testable external-command runner for the pre-push hook.
 *
 * ADAPT of Aider's `Linter.run_cmd` (`Aider-AI/aider`, aider/linter.py): run an
 * external command via the OS, capture exit code + stdout + stderr, route on the
 * result. The matched slice is the part Aider itself unit-tests by mocking the
 * subprocess boundary (`@patch("subprocess.Popen")`); the LLM-fix-loop layer
 * (Aider's `Coder`) does NOT transfer to a pre-push gate, so it is dropped.
 * Prior-art / T16 problem-class analysis:
 *   docs/meta-factory/research-patches/2026-05-16-§13.33-hook-architecture-research.md §4.8.X.1
 *
 * Difference from upstream: we add a **timeout** case Aider omits — a hung
 * actionlint / lychee must not hang the hook — so coverage strictly exceeds it.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { win32 as pathWin32 } from 'node:path';

export interface CheckResult {
  /** Process exit code; synthesised for timeout (124) and spawn-failure (127). */
  exitCode: number;
  stdout: string;
  stderr: string;
  /** True when the command was killed for exceeding `timeoutMs`. */
  timedOut: boolean;
  /** True when the command binary could not be located (ENOENT). */
  notFound: boolean;
}

export interface RunCheckOptions {
  cwd?: string;
  /** Wall-clock cap; the child is killed with SIGTERM past this. Default 120s. */
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

export const DEFAULT_TIMEOUT_MS = 120_000;
/** Conventional exit code for a command terminated by timeout (matches `timeout(1)`). */
export const TIMEOUT_EXIT_CODE = 124;
/** Conventional exit code for "command not found / not executable". */
export const SPAWN_FAILURE_EXIT_CODE = 127;

/**
 * Windows-only rewrite of `npm` / `npx` into `node <npm-install>/bin/<tool>-cli.js`.
 *
 * On Windows npm and npx exist only as `.cmd` / `.ps1` shims, and since the
 * CVE-2024-27980 mitigation Node refuses to spawn those without `shell: true`
 * (EINVAL, surfaced here as ENOENT). Measured on Windows 11 / Node 24.19.0:
 * `node`, `git`, `bash`, `python3`, `ruff` and `actionlint` all spawn bare and
 * only `npm` + `npx` fail — so this rewrite covers the whole failing set. The
 * user-visible symptom was `pre-push.ts:1100` announcing "npx not found — install
 * Node.js" on a machine running the hook *under* Node.
 *
 * `shell: true` is deliberately NOT the fix: runCheck is the single funnel for
 * every subprocess in the hook core (`utils/git.ts` routes branch names and
 * commit messages through it), and a shell turns those unescaped arguments into
 * an injection surface — plus Node deprecates the array form under a shell
 * (DEP0190). Spawning the CLI's own JS keeps argv a real array.
 *
 * Returns the command unchanged for every other platform, every other command,
 * and any layout where the expected `-cli.js` is not on disk (nvm/volta-style
 * installs) — the caller then sees exactly today's behaviour.
 */
export function resolveNodeToolShim(
  cmd: string,
  args: readonly string[],
  platform: NodeJS.Platform = process.platform,
  execPath: string = process.execPath,
  exists: (p: string) => boolean = existsSync,
): { cmd: string; args: readonly string[] } {
  if (platform !== 'win32') return { cmd, args };
  if (cmd !== 'npm' && cmd !== 'npx') return { cmd, args };
  // win32-flavoured path ops, not the ambient ones: `platform` is an injected
  // parameter, so the win32 branch also executes on a Linux CI runner, where
  // POSIX dirname does not recognise a backslash separator, so it collapses a
  // Windows execPath to "." and the join below loses the drive entirely.
  const cli = pathWin32.join(
    pathWin32.dirname(execPath),
    'node_modules',
    'npm',
    'bin',
    `${cmd}-cli.js`,
  );
  if (!exists(cli)) return { cmd, args };
  return { cmd: execPath, args: [cli, ...args] };
}

/**
 * Locate bash.exe on win32: PATH first (a user/tooling install wins), then
 * GitHub's documented `shell: bash` roots (docs.github.com workflow syntax) —
 * CI images expose only Git\cmd on PATH, so the roots arm is load-bearing there.
 * Production twin of the test seam's resolver (spawn-bash-or-skip.ts); the seam
 * is test material and cannot be imported from shipped code.
 */
export function findGitBashExe(
  env: NodeJS.ProcessEnv = process.env,
  exists: (p: string) => boolean = existsSync,
): string | null {
  const roots = [
    ...(env.PATH ?? '').split(pathWin32.delimiter).filter(Boolean),
    pathWin32.join(env['ProgramFiles'] ?? 'C:\\Program Files', 'Git', 'bin'),
    pathWin32.join(
      env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
      'Git',
      'bin',
    ),
    pathWin32.join(
      env['LOCALAPPDATA'] ??
        pathWin32.join(env['USERPROFILE'] ?? '', 'AppData', 'Local'),
      'Programs',
      'Git',
      'bin',
    ),
  ];
  for (const dir of roots) {
    const candidate = pathWin32.join(dir, 'bash.exe');
    if (exists(candidate)) return candidate;
  }
  return null;
}

/** Drive-letter-absolute path -> MSYS form (`D:\a\x` or `D:/a/x` -> `/d/a/x`).
 *  Cygwin accepts the Windows spelling too, but the MSYS form is unambiguous for
 *  a script argument (no backslash-escape reinterpretation anywhere downstream). */
const toMsysPath = (p: string): string =>
  /^[A-Za-z]:[\\/]/.test(p)
    ? `/${p[0]!.toLowerCase()}${p.slice(2).replace(/\\/g, '/')}`
    : p;

/**
 * Windows-only rewrite of a `.sh` runner command into `bash.exe <runner> …`.
 *
 * CreateProcess runs PE images only, so `spawnSync('C:\\…\\runner.sh', …)` fails
 * before the script exists to bash (EFTYPE/EACCES — the #1799 windows-hooks cell
 * lost all eight executing arms of pre-push.heavy-runner.test.ts this way).
 * PREPUSH_HEAVY_RUNNER names "an executable"; on POSIX a +x `.sh` IS one via its
 * shebang, so the same contract is honoured on win32 by spawning Git Bash on the
 * script. Mirrors resolveNodeToolShim's shape (win32-only rewrite, argv stays a
 * real array, no shell); when no bash resolves the command passes through
 * unchanged and fails exactly as before — loud, never silently skipped.
 */
export function resolveShRunnerOnWindows(
  cmd: string,
  args: readonly string[],
  platform: NodeJS.Platform = process.platform,
  findBash: () => string | null = findGitBashExe,
): { cmd: string; args: readonly string[] } {
  if (platform !== 'win32') return { cmd, args };
  if (!/\.sh$/i.test(cmd)) return { cmd, args };
  const bashExe = findBash();
  if (!bashExe) return { cmd, args };
  return { cmd: bashExe, args: [toMsysPath(cmd), ...args] };
}

/**
 * Run `cmd args` synchronously, capturing exit code + output. Never throws on a
 * non-zero exit or a missing binary — the caller routes on the returned shape.
 */
export function runCheck(
  cmd: string,
  args: readonly string[] = [],
  opts: RunCheckOptions = {},
): CheckResult {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const spawned = resolveNodeToolShim(cmd, args);
  const result = spawnSync(spawned.cmd, spawned.args as string[], {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
  });

  const errCode = (result.error as NodeJS.ErrnoException | undefined)?.code;
  // spawnSync sets `error` (code ETIMEDOUT) AND `signal` (the killSignal,
  // default SIGTERM) on timeout. ETIMEDOUT is the precise signal; SIGTERM is a
  // fallback for runtimes that surface only the signal.
  const timedOut = errCode === 'ETIMEDOUT' || result.signal === 'SIGTERM';
  const notFound = errCode === 'ENOENT';

  let exitCode: number;
  if (timedOut) {
    exitCode = TIMEOUT_EXIT_CODE;
  } else if (result.error) {
    // Could not be spawned (e.g. ENOENT, EACCES) — no status to report.
    exitCode = SPAWN_FAILURE_EXIT_CODE;
  } else {
    // status is null only for unusual signal exits; treat as failure.
    exitCode = result.status ?? 1;
  }

  // On a spawn failure the OS leaves stderr null/empty; surface the error
  // message so the operator sees *why* (e.g. the ENOENT for a missing binary).
  let stderr = result.stderr ?? '';
  if (result.error && stderr.length === 0) {
    stderr = `${result.error.message}\n`;
  }

  return {
    exitCode,
    stdout: result.stdout ?? '',
    stderr,
    timedOut,
    notFound,
  };
}
