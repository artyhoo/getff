import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const bridge = join(root, 'packages/runtime-bridge');
const emitter = join(bridge, 'scripts/emit-economy.mjs');
const expected = [
  'AifHandoffBackend.js',
  'ManualBackend.js',
  'aifWsStatus.js',
  'backend.js',
  'cli/aifHttp.js',
  'cli/await.js',
  'cli/cliEntry.js',
  'cli/ensure-parallel.js',
  'cli/openQuestion.js',
  'cli/park.js',
  'cli/questions.js',
  'cli/supervision.js',
  'package.json',
  'resolver.js',
  'resultReview.js',
  'types.js',
];
const hash = (x: string | Buffer) =>
  createHash('sha256').update(x).digest('hex');
let scratch: string;
const build = () => join(scratch, 'build');
function emit(out: string, script = emitter) {
  return spawnSync(process.execPath, [script, '--out', out], {
    encoding: 'utf8',
    timeout: 20_000,
  });
}
function members(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((p) =>
      p.isDirectory()
        ? members(join(dir, p.name)).map((x) => p.name + '/' + x)
        : [p.name],
    )
    .sort();
}
function shadow() {
  const dir = mkdtempSync(join(scratch, 'shadow-'));
  cpSync(join(bridge, 'src'), join(dir, 'src'), { recursive: true });
  mkdirSync(join(dir, 'scripts'));
  cpSync(emitter, join(dir, 'scripts/emit-economy.mjs'));
  symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
  return dir;
}
beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), 'economy-build-'));
});
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe.sequential('explicit economy emit at the real Node boundary', () => {
  it('emits the complete fifteen-module closure reproducibly with exact package metadata', () => {
    const first = emit(build());
    expect(first.status, first.stderr).toBe(0);
    const receipt = JSON.parse(first.stdout);
    expect(receipt).toMatchObject({
      node: process.version,
      typescript: '5.9.3',
    });
    expect(receipt.inputs).toHaveLength(15);
    expect(receipt.outputs).toHaveLength(16);
    expect(members(build())).toEqual(expected);
    expect(readFileSync(join(build(), 'package.json'), 'utf8')).toBe(
      '{"type":"module"}\n',
    );
    for (const row of receipt.outputs) {
      expect(lstatSync(join(build(), row.path)).isSymbolicLink()).toBe(false);
      expect(hash(readFileSync(join(build(), row.path)))).toBe(row.sha256);
    }
    const secondDir = join(scratch, 'again');
    const second = emit(secondDir);
    expect(second.status, second.stderr).toBe(0);
    expect(JSON.parse(second.stdout).outputs).toEqual(receipt.outputs);
    expect(emit(build()).stderr).toContain('output already exists');
  });
  it('imports both CLIs without executing main or writing observation state', () => {
    const code = `await import(${JSON.stringify(pathToFileURL(join(build(), 'cli/await.js')).href)}); await import(${JSON.stringify(pathToFileURL(join(build(), 'cli/supervision.js')).href)}); console.log('imported');`;
    const run = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', code],
      { encoding: 'utf8', cwd: scratch },
    );
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toBe('imported\n');
    expect(run.stderr).toBe('');
    expect(readdirSync(scratch).sort()).toEqual(['again', 'build']);
  });
  it('refuses stable output, its ancestors, descendants and symlink aliases before writing', () => {
    const stable = join(userInfo().homedir, '.local/share/getff-economy/build');
    const alias = join(scratch, 'stable-alias');
    symlinkSync(userInfo().homedir, alias, 'dir');
    for (const out of [
      stable,
      dirname(stable),
      join(stable, 'forbidden'),
      join(alias, '.local/share/getff-economy/build/forbidden'),
    ]) {
      expect(emit(out).stderr).toContain('stable target overlap');
    }
  });
  it('refuses a missing source module and leaves no partial output', () => {
    const dir = shadow();
    rmSync(join(dir, 'src/types.ts'));
    const out = join(scratch, 'missing-build');
    expect(emit(out, join(dir, 'scripts/emit-economy.mjs')).stderr).toContain(
      'types.ts',
    );
    expect(existsSync(out)).toBe(false);
  });
  it('cannot redirect stable-target protection by changing HOME', () => {
    // An existing ancestor also prevents writes on a regressed implementation.
    const run = spawnSync(
      process.execPath,
      [emitter, '--out', userInfo().homedir],
      { encoding: 'utf8', env: { ...process.env, HOME: scratch } },
    );
    expect(run.stderr).toContain('stable target overlap');
  });
  it('rejects unadmitted imports and compiler diagnostics before output creation', () => {
    for (const source of [
      "import '../not-admitted.js';\n",
      "import('unadmitted-package');\n",
      'const broken = ;\n',
    ]) {
      const dir = shadow();
      writeFileSync(join(dir, 'src/cli/await.ts'), source);
      const out = join(dir, 'out');
      const run = emit(out, join(dir, 'scripts/emit-economy.mjs'));
      expect(run.status, run.stdout).toBe(1);
      expect(run.stderr).toMatch(
        /outside economy closure|TypeScript diagnostic/,
      );
      expect(existsSync(out)).toBe(false);
    }
  });
  it('writes no unexpected or pre-existing member', () => {
    const out = join(scratch, 'occupied');
    mkdirSync(out);
    writeFileSync(join(out, 'foreign'), 'preserved');
    expect(emit(out).stderr).toContain('output already exists');
    expect(readFileSync(join(out, 'foreign'), 'utf8')).toBe('preserved');
    expect(members(out)).toEqual(['foreign']);
  });
  it('actual emitted CLI preserves held exits, metadata, compact output and direct AIF actionable routing', async () => {
    const methods: string[] = [];
    let current: Record<string, unknown> = {
      id: 'emitted',
      title: 'Already assigned task',
      status: 'done',
      commitSha: null,
    };
    const server = createServer((req, res) => {
      methods.push(req.method! + ' ' + req.url!);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(req.url === '/health' ? {} : current));
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const env = {
      ...process.env,
      RUNTIME_BRIDGE_AIF_URL: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
      RUNTIME_BRIDGE_MODE: 'aif-handoff',
      RUNTIME_BRIDGE_RESULT_OWNER: 'codex:emitted-reader',
    };
    async function cli(args: string[]) {
      return new Promise<{
        code: number | null;
        stdout: string;
        stderr: string;
      }>((done, reject) => {
        const p = spawn(
          process.execPath,
          [join(build(), 'cli/await.js'), 'emitted', ...args],
          { env },
        );
        let stdout = '',
          stderr = '';
        const timer = setTimeout(() => p.kill('SIGKILL'), 8000);
        p.stdout.on('data', (x) => {
          stdout += x;
        });
        p.stderr.on('data', (x) => {
          stderr += x;
        });
        p.on('error', reject);
        p.on('close', (code) => {
          clearTimeout(timer);
          done({ code, stdout, stderr });
        });
      });
    }
    try {
      const successful = await cli([
        '--until-actionable',
        '--timeout-ms',
        '1000',
      ]);
      expect(successful.code, successful.stderr).toBe(0);
      expect(successful.stdout.trim().split('\n')).toHaveLength(1);
      const initial = JSON.parse(successful.stdout);
      expect(initial).toMatchObject({
        kind: 'done',
        meta: {
          candidate: { commitSha: null },
          acceptance: 'unverified',
          nextAction: {
            state: 'pending',
            ownerReference: 'codex:emitted-reader',
          },
        },
      });
      current = { ...current, reviewComments: 'zero code; must be blocked' };
      const adverse = await cli(['--until-actionable', '--timeout-ms', '1000']);
      expect(adverse.code, adverse.stderr).toBe(1);
      expect(JSON.parse(adverse.stdout)).toMatchObject({
        kind: 'unknown',
        meta: { held: 'advisory' },
      });
      expect(JSON.parse(adverse.stdout).meta.resultGeneration).not.toBe(
        initial.meta.resultGeneration,
      );
      const once = await cli(['--once']);
      expect(once.code).toBe(1);
      expect(JSON.parse(once.stdout).meta.resultGeneration).toBe(
        JSON.parse(adverse.stdout).meta.resultGeneration,
      );
      current = {
        ...current,
        paused: true,
        blockedReason: 'Exact current owner decision pending',
      };
      const park = await cli(['--until-actionable', '--timeout-ms', '1000']);
      expect(park.code).toBe(1);
      expect(JSON.parse(park.stdout).kind).toBe('parked');
      current = { ...current, reviewComments: '', blockedReason: null };
      const pause = await cli(['--until-actionable', '--timeout-ms', '1000']);
      expect(pause.code).toBe(1);
      expect(JSON.parse(pause.stdout).kind).toBe('paused');
      const before = methods.length;
      expect(
        (await cli(['--until-actionable', '--once', '--timeout-ms', '1000']))
          .code,
      ).toBe(1);
      expect(methods).toHaveLength(before);
      expect(
        methods.every((x) => x === 'GET /tasks/emitted' || x === 'GET /health'),
      ).toBe(true);
      expect(methods[0]).toBe('GET /tasks/emitted');
    } finally {
      await new Promise<void>((done) => server.close(() => done()));
    }
  }, 20_000);
});
