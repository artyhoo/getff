// packages/runtime-bridge/test/harvest-cli.test.ts
/**
 * #1597 review ledger, harvest CLI entrypoint:
 *   - A6-4 / D-4: parseArgs took the FIRST non-`--` token as the taskId, so a
 *     value-taking flag placed before the id swallowed its value as the id
 *     (`--base staging f1010da4` → taskId 'staging' → GET /tasks/staging → 404).
 *   - A6-7 / R-6: the `--flag <value>` lookup returned the NEXT TOKEN even when
 *     that token was itself a flag, and harvest's copy had additionally dropped
 *     the truthiness guard (`--base ""` → base '').
 *   - A5-7 / A6-5: getTask() and the --body-file read ran BEFORE the try that owns
 *     the `[harvest] FAILED:` line and the Channel-A fallback, so an unreachable
 *     aif, an unknown taskId or a mistyped --body-file surfaced as a raw
 *     unhandled-rejection stack instead of the documented graceful degradation.
 *   - A6-3: the container checkout defaulted to the FRAMEWORK's own mount and the
 *     three HOLD re-run hints named the framework's own file path — both wrong in
 *     the vendored copy every `--profile factory` consumer receives.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, resolveRepoPath, selfPath } from '../src/cli/harvest.js';
import type { AifProjectFull } from '../src/cli/aifHttp.js';
import { CliArgError } from '../src/cli/cliEntry.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const CLI = resolve(HERE, '../src/cli/harvest.ts');
const TSX = resolve(REPO_ROOT, 'node_modules/.bin/tsx');
const SLOW_SHELL_MS = 30_000;

describe('harvest.ts entrypoint guard (A6-1 / R-6)', () => {
  it(
    'importing the module for its exports does NOT run main()',
    () => {
      // Must run in a FRESH process: this test file statically imports parseArgs, so an
      // in-process `await import()` would only ever observe the cached module.
      // harvest.ts was the one CLI with a bare top-level `void main()` — importing it
      // fired a real getTask and exited the importing process.
      const probe = `import('${pathToFileURL(resolve(HERE, '../src/cli/harvest.ts')).href}').then(m => {
        process.stdout.write('IMPORTED:' + typeof m.parseArgs);
      });`;
      const r = spawnSync(TSX, ['--eval', probe], {
        encoding: 'utf8',
        timeout: SLOW_SHELL_MS,
        env: { ...process.env, RUNTIME_BRIDGE_AIF_URL: 'http://127.0.0.1:1' },
      });

      expect(r.stdout).toContain('IMPORTED:function');
      expect(r.stderr).not.toContain('[harvest]');
      expect(r.status).toBe(0);
    },
    SLOW_SHELL_MS + 5_000,
  );
});

describe('harvest parseArgs — argv shapes that used to hijack the taskId', () => {
  it('A6-4: a flag value placed BEFORE the task id does not become the task id', () => {
    expect(parseArgs(['--base', 'staging', 'f1010da4'])).toMatchObject({
      taskId: 'f1010da4',
      base: 'staging',
    });
  });

  it('A6-4: --host-repo <path> before the id likewise leaves the id intact', () => {
    expect(parseArgs(['--host-repo', '/x', 'f1010da4'])).toMatchObject({
      taskId: 'f1010da4',
      hostRepo: '/x',
    });
  });

  it('A6-7: a flag whose value is the NEXT FLAG is an error, not a value', () => {
    // Old: ['f1010da4','--base','--no-auto-merge'] → base '--no-auto-merge'.
    expect(() => parseArgs(['f1010da4', '--base', '--no-auto-merge'])).toThrow(CliArgError);
  });

  it('R-6: an EMPTY --base is an error, not a silent empty base branch', () => {
    expect(() => parseArgs(['f1010da4', '--base='])).toThrow(/empty value/);
  });

  it('rejects an unknown flag rather than ignoring it', () => {
    expect(() => parseArgs(['f1010da4', '--no-automerge'])).toThrow(/unknown option/i);
  });

  it('rejects a second positional (a mistyped flag value is not a task id)', () => {
    expect(() => parseArgs(['f1010da4', 'staging'])).toThrow(/unexpected argument/i);
  });

  it('CONTROL: the documented invocation still parses, defaults intact', () => {
    const got = parseArgs(['f1010da4', '--no-auto-merge']);
    expect(got.taskId).toBe('f1010da4');
    expect(got.base).toBe('staging');
    expect(got.autoMerge).toBe(false);
  });
});

/** Minimal aif REST stub serving GET /tasks/:id, sourced into its own node process. */
const STUB_SRC = `
import { createServer } from 'node:http';
const task = JSON.parse(process.argv[2]);
createServer((req, res) => {
  req.resume();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(task));
}).listen(0, '127.0.0.1', function () {
  process.stdout.write('READY http://127.0.0.1:' + this.address().port + '\\n');
});
`;

const running: ChildProcess[] = [];
afterEach(() => {
  while (running.length) running.pop()?.kill();
});

function startStub(task: unknown): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'rb-harvest-stub-'));
  const stubPath = join(dir, 'stub.mjs');
  writeFileSync(stubPath, STUB_SRC, 'utf8');
  const child = spawn('node', [stubPath, JSON.stringify(task)], { stdio: ['ignore', 'pipe', 'pipe'] });
  running.push(child);
  return new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error('stub never reported READY')), 10_000);
    child.stdout!.on('data', (buf: Buffer) => {
      const m = /READY (\S+)/.exec(String(buf));
      if (m) {
        clearTimeout(t);
        ok(m[1]);
      }
    });
  });
}

describe('harvest CLI — every failure mode goes through the classified exit path (A5-7)', () => {
  it(
    'an unreachable aif reports [harvest] FAILED, not a raw unhandled-rejection stack',
    () => {
      const r = spawnSync(TSX, [CLI, 'no-such-task'], {
        encoding: 'utf8',
        timeout: SLOW_SHELL_MS,
        // Port 1 is reserved/closed → connection refused on the very first getTask.
        env: { ...process.env, RUNTIME_BRIDGE_AIF_URL: 'http://127.0.0.1:1' },
      });

      expect(r.stderr).toContain('[harvest] FAILED:');
      expect(r.stderr).not.toMatch(/^\s*at .*\(.*:\d+:\d+\)/m);
      expect(r.status).toBe(1);
    },
    SLOW_SHELL_MS + 5_000,
  );

  it(
    'a mistyped --body-file reports [harvest] FAILED plus the Channel-A fallback',
    async () => {
      const base = await startStub({
        id: 't-1',
        title: 'feat: thing',
        status: 'done',
        branchName: 'feature/thing-abc',
      });
      const r = spawnSync(TSX, [CLI, 't-1', '--body-file', join(tmpdir(), 'no-such-body.md')], {
        encoding: 'utf8',
        timeout: SLOW_SHELL_MS,
        env: { ...process.env, RUNTIME_BRIDGE_AIF_URL: base },
      });

      expect(r.stderr).toContain('[harvest] FAILED:');
      expect(r.stderr).toContain('manual fallback — Channel A');
      expect(r.status).toBe(1);
    },
    SLOW_SHELL_MS + 15_000,
  );
});

// ── A6-3: consumer-fit resolution of the container checkout + the re-run hints ────────────
// The vendored copy runs on projects aif mounts at /home/www/<consumer>, where the
// framework's own /home/www/rules-as-tests-aif is not a directory: the worktree-list probe
// swallows its failure and every task aborts at `cannot read git HEAD`.
describe('resolveRepoPath — ask aif which checkout is this project (A6-3)', () => {
  const URL = 'http://localhost:3009';
  const project = (over: Partial<AifProjectFull> = {}): AifProjectFull =>
    ({ id: 'p-consumer', name: 'consumer', rootPath: '/home/www/consumer', ...over }) as AifProjectFull;
  const projects = (list: AifProjectFull[]) => async () => list;
  const unreachable = async () => {
    throw new Error('fetch failed');
  };

  it('POSITIVE: --repo-path wins over everything', async () => {
    const got = await resolveRepoPath(
      URL,
      '/explicit',
      { RUNTIME_BRIDGE_AIF_REPO_PATH: '/from-env', RUNTIME_BRIDGE_AIF_PROJECT_ID: 'p-consumer' },
      projects([project()]),
    );

    expect(got).toEqual({ path: '/explicit', source: 'flag' });
  });

  it('POSITIVE: the env var wins over aif when no flag was passed', async () => {
    const got = await resolveRepoPath(
      URL,
      undefined,
      { RUNTIME_BRIDGE_AIF_REPO_PATH: '/from-env', RUNTIME_BRIDGE_AIF_PROJECT_ID: 'p-consumer' },
      projects([project()]),
    );

    expect(got).toEqual({ path: '/from-env', source: 'env' });
  });

  it("POSITIVE: with neither, aif's own project record answers — the consumer's mount, not the framework's", async () => {
    const got = await resolveRepoPath(
      URL,
      undefined,
      { RUNTIME_BRIDGE_AIF_PROJECT_ID: 'p-consumer' },
      projects([project({ id: 'p-other', rootPath: '/home/www/other' }), project()]),
    );

    expect(got).toEqual({ path: '/home/www/consumer', source: 'aif-project' });
  });

  it('NEGATIVE: no projectId → the framework path, but LABELLED fallback so the caller can warn', async () => {
    const got = await resolveRepoPath(URL, undefined, {}, projects([project()]));

    expect(got.source).toBe('fallback');
    expect(got.path).toBe('/home/www/rules-as-tests-aif');
  });

  it('NEGATIVE: an unreachable aif degrades to the labelled fallback, it does not throw', async () => {
    const got = await resolveRepoPath(URL, undefined, { RUNTIME_BRIDGE_AIF_PROJECT_ID: 'p-consumer' }, unreachable);

    expect(got.source).toBe('fallback');
  });

  it('NEGATIVE: a projectId matching no project is a fallback, never a foreign project rootPath', async () => {
    const got = await resolveRepoPath(
      URL,
      undefined,
      { RUNTIME_BRIDGE_AIF_PROJECT_ID: 'p-missing' },
      projects([project({ id: 'p-other', rootPath: '/home/www/other' })]),
    );

    expect(got.source).toBe('fallback');
    expect(got.path).not.toBe('/home/www/other');
  });
});

describe('selfPath — the HOLD re-run hints name the file that is actually running (A6-3)', () => {
  it('POSITIVE: a consumer running the vendored copy is told the vendored path', () => {
    const consumer = '/Users/dev/my-app';

    expect(selfPath(`${consumer}/.claude/vendor/runtime-bridge/src/cli/harvest.ts`, consumer)).toBe(
      '.claude/vendor/runtime-bridge/src/cli/harvest.ts',
    );
  });

  it('POSITIVE: the framework keeps its own path (no regression for the operator repo)', () => {
    const repo = '/Users/art/code/rules-as-tests-aif';

    expect(selfPath(`${repo}/packages/runtime-bridge/src/cli/harvest.ts`, repo)).toBe(
      'packages/runtime-bridge/src/cli/harvest.ts',
    );
  });

  it('NEGATIVE: an entry outside the cwd stays ABSOLUTE — never a ../.. the operator must decode', () => {
    expect(selfPath('/opt/tools/runtime-bridge/src/cli/harvest.ts', '/Users/dev/my-app')).toBe(
      '/opt/tools/runtime-bridge/src/cli/harvest.ts',
    );
  });

  it('NEGATIVE: no argv[1] at all still yields a runnable-looking name, not undefined', () => {
    expect(selfPath(undefined, '/Users/dev/my-app')).toBe('harvest.ts');
    expect(selfPath('', '/Users/dev/my-app')).toBe('harvest.ts');
  });
});
