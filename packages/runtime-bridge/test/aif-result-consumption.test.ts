import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AifHandoffBackend } from '../src/AifHandoffBackend.js';
import { harvestTask, type HarvestDeps } from '../src/harvest.js';
import { pushAnswer } from '../src/cli/answer.js';
import type { WebSocketConstructor } from '../src/aifWsStatus.js';

// Exercise the actual producer, subprocess reader, delivery guard and repair consumer.
// Transport is local and publication effects are recording boundaries, never live work.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const tsx = join(root, 'node_modules/.bin/tsx');
const owner = 'codex:s3-result-consumer';
const baseTask = {
  id: 's3-task', title: 'Bounded result', status: 'done', branchName: 'candidate',
  paused: false, manualReviewRequired: false, blockedReason: null,
  executionOwner: 'ai' as const, ownershipRevision: 1,
  description: 'An ordinary unscoped assignment', plan: 'Known source and generated closure',
  implementationLog: 'Completed the assigned change', reviewComments: 'No blocking findings',
  sessionId: 'existing-session', reviewIterationCount: 1, commitSha: 'a'.repeat(40),
  updatedAt: '2026-10-24T21:00:00Z',
};
let task: Record<string, unknown> = { ...baseTask };
let detailCode = 200;
let baseUrl: string;
let scratch: string;
let env: NodeJS.ProcessEnv;
let effectLog: string;
const requests: { method: string; path: string; body: unknown }[] = [];
const server = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  requests.push({ method: req.method!, path: req.url!, body: body ? JSON.parse(body) : null });
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/health') return res.end('{}');
  if (req.method === 'GET' && req.url === '/tasks/s3-task') {
    res.statusCode = detailCode;
    return res.end(JSON.stringify(task));
  }
  if (req.method === 'POST' && /^\/tasks\/s3-task\/(comments|events)$/.test(req.url!)) {
    return res.end('{}');
  }
  res.statusCode = 404;
  res.end('{}');
});

function cleanEnv(): NodeJS.ProcessEnv {
  const result = { ...process.env };
  for (const key of Object.keys(result)) {
    if (/^(GIT_|AIF_|RUNTIME_BRIDGE_|CLAUDE_|CODEX_|GETFF_|NODE_OPTIONS$)/.test(key)) delete result[key];
  }
  return {
    ...result, HOME: join(scratch, 'home'), XDG_CONFIG_HOME: join(scratch, 'home/.config'),
    AIF_INTENT_REPO_ROOT: scratch, AIF_CTX_WINDOW: '1000000', AIF_HOOK_LANG: 'en',
    RUNTIME_BRIDGE_MODE: 'aif-handoff', RUNTIME_BRIDGE_AIF_URL: baseUrl,
    RUNTIME_BRIDGE_RESULT_OWNER: owner, CLAUDE_CODE_ENTRYPOINT: '', GETFF_GLOBAL: '',
  };
}

async function run(exe: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((done, reject) => {
    const child = spawn(exe, args, { cwd: options.cwd ?? root, env: options.env ?? env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', (x) => { stdout += x; });
    child.stderr.on('data', (x) => { stderr += x; });
    const timer = setTimeout(() => { if (child.pid) process.kill(-child.pid, 'SIGKILL'); }, options.timeoutMs ?? 30_000);
    child.on('error', reject);
    child.on('close', (code) => { clearTimeout(timer); done({ code, stdout, stderr }); });
  });
}

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 's3-result-'));
  mkdirSync(join(scratch, 'home'));
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  env = cleanEnv();
  effectLog = join(scratch, 'external-effects');
  const bin = join(scratch, 'bin');
  mkdirSync(bin);
  for (const name of ['docker', 'gh']) {
    writeFileSync(join(bin, name), `#!/bin/sh\nprintf '%s\\n' '${name}' >> '${effectLog}'\nexit 73\n`, { mode: 0o755 });
  }
  env.PATH = `${bin}:${env.PATH}`;
  execFileSync('git', ['init', '-q', scratch], { env });
  writeFileSync(join(scratch, 'source.txt'), 'preserved consumer source\n');
  execFileSync('git', ['-C', scratch, 'add', 'source.txt'], { env });
  execFileSync('git', ['-C', scratch, '-c', 'user.name=S3 fixture', '-c', 'user.email=s3@example.test', 'commit', '-qm', 'fixture'], { env });
});
afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()));
  rmSync(scratch, { recursive: true, force: true });
});

describe.sequential('AIF result consumption at actual boundaries', () => {
  it.each([
    ['manual review', { manualReviewRequired: true, executionOwner: 'human' }],
    ['paused', { paused: true }],
    ['blocked reason', { blockedReason: 'The current exact candidate needs independent review' }],
    ['legacy advisory only', { reviewComments: 'zero code was produced; treat task completion as blocked, not done' }],
  ])('%s cannot be successful JSON/exit or an egress effect', async (_name, patch) => {
    task = { ...baseTask, ...patch };
    detailCode = 200;
    const r = await run(tsx, ['packages/runtime-bridge/src/cli/await.ts', 's3-task', '--once']);
    expect(r.code, r.stderr).toBe(1);
    const status = JSON.parse(r.stdout);
    expect(status.status).toBe('error');
    expect(status.rawStatus).toBe('done');
    expect(status.meta).toMatchObject({ taskId: 's3-task', acceptance: 'unverified', nextAction: { ownerReference: owner, state: 'pending' } });

    const h = await run(tsx, ['packages/runtime-bridge/src/cli/harvest.ts', 's3-task', '--base', 'staging', '--container', 'fixture', '--repo-path', scratch, '--host-repo', scratch, '--no-auto-merge', '--confirm-rework', '--confirm-unreported-files', '--confirm-dirty-residue']);
    expect(h.code, h.stderr).toBe(2);
    expect(JSON.parse(h.stdout)).toMatchObject({ pushed: false, pendingAction: { ownerReference: owner, state: 'pending' } });
    expect(() => readFileSync(effectLog)).toThrow();
  });

  it.each([
    ['later rework', { status: 'implementing' }, 'implementing'],
    ['current park', { manualReviewRequired: true }, 'done'],
  ])('terminal signal does not override %s in authoritative detail', async (_label, patch, finalStatus) => {
    task = { ...baseTask, ...patch };
    detailCode = 200;
    class TerminalSocket {
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onclose = null;
      onerror = null;
      constructor() {
        setTimeout(() => {
          this.onopen?.();
          this.onmessage?.({ data: JSON.stringify({ type: 'task:updated', payload: { id: 's3-task', title: baseTask.title, status: 'done' } }) });
        }, 0);
      }
      close() { /* signal fixture; no live socket */ }
    }
    const backend = new AifHandoffBackend({ baseUrl, WebSocketImpl: TerminalSocket as unknown as WebSocketConstructor });
    const pending = backend.awaitDone({ backend: 'aif-handoff', taskId: 's3-task', dispatchedAt: baseTask.updatedAt }, 80);
    if (finalStatus === 'implementing') {
      await expect(pending).rejects.toMatchObject({ code: 'timeout', observed: { taskId: 's3-task', acceptance: 'unverified', nextAction: { state: 'pending' } } });
      return;
    }
    const r = await pending;
    expect(r.success).toBe(false);
    expect(r.finalStatus).toBe(finalStatus);
    expect(r.meta).toMatchObject({ taskId: 's3-task', acceptance: 'unverified', nextAction: { state: 'pending' } });
  });

  it('unchanged observation retains generation; candidate and result changes invalidate it', async () => {
    task = { ...baseTask };
    const backend = new AifHandoffBackend({ baseUrl });
    const handle = { backend: 'aif-handoff' as const, taskId: 's3-task', dispatchedAt: baseTask.updatedAt };
    const first = await backend.getStatus(handle) as unknown as { meta: Record<string, unknown> };
    const again = await backend.getStatus(handle) as unknown as { meta: Record<string, unknown> };
    expect(first.meta.resultGeneration).toMatch(/^[a-f0-9]{64}$/);
    expect(again.meta.resultGeneration).toBe(first.meta.resultGeneration);
    task = { ...baseTask, commitSha: 'b'.repeat(40) };
    const candidate = await backend.getStatus(handle) as unknown as { meta: Record<string, unknown> };
    expect(candidate.meta.resultGeneration).not.toBe(first.meta.resultGeneration);
    task = { ...baseTask, reviewComments: 'Different current review evidence' };
    const changed = await backend.getStatus(handle) as unknown as { meta: Record<string, unknown> };
    expect(changed.meta.resultGeneration).not.toBe(first.meta.resultGeneration);
    expect(changed.meta.acceptance).toBe('unverified');
  });

  it('missing candidate or explicit reader identity stays unknown and unbound', async () => {
    task = { ...baseTask, commitSha: null, sessionId: null };
    const noOwner = { ...env };
    delete noOwner.RUNTIME_BRIDGE_RESULT_OWNER;
    const r = await run(tsx, ['packages/runtime-bridge/src/cli/await.ts', 's3-task', '--once'], { env: noOwner });
    expect(r.code, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout).meta).toMatchObject({ candidate: { commitSha: null }, attempt: null, nextAction: { ownerReference: null, state: 'pending' }, acceptance: 'unverified' });
  });

  it('an admitted repair in progress is not blocked by its previous review advisory', async () => {
    task = { ...baseTask, status: 'implementing', reviewComments: 'BLOCKER-7: apply the specified correction' };
    const r = await run(tsx, ['packages/runtime-bridge/src/cli/await.ts', 's3-task', '--once']);
    expect(r.code, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchObject({ status: 'running', rawStatus: 'implementing', meta: { held: null, nextAction: { kind: 'observe' } } });
  });

  it.each([
    ['wrong task', { ...baseTask, id: 'other-task' }, 200],
    ['malformed flag', { ...baseTask, paused: 'false' }, 200],
    ['malformed candidate', { ...baseTask, commitSha: 'not-a-commit' }, 200],
    ['unavailable detail', {}, 503],
  ])('%s never clears result reconciliation', async (_name, current, code) => {
    task = current;
    detailCode = code;
    const r = await run(tsx, ['packages/runtime-bridge/src/cli/await.ts', 's3-task', '--once']);
    expect(r.code).toBe(1);
    expect(r.stdout).not.toContain('"status":"done"');
    expect(r.stderr).toContain('await');
    expect(JSON.parse(r.stdout)).toMatchObject({ status: 'error', rawStatus: 'unknown', meta: { taskId: 's3-task', resultGeneration: null, candidate: { branch: null, commitSha: null }, nextAction: { kind: 'reconcile', state: 'pending', ownerReference: owner } } });
    detailCode = 200;
  });

  it('harvest rejects a detail response for another task before any external effect', async () => {
    task = { ...baseTask, id: 'different-task' };
    detailCode = 200;
    const h = await run(tsx, ['packages/runtime-bridge/src/cli/harvest.ts', 's3-task', '--base', 'staging', '--container', 'fixture', '--repo-path', scratch, '--host-repo', scratch, '--no-auto-merge']);
    expect(h.code).toBe(1);
    expect(h.stderr).toContain('invalid task detail');
    expect(h.stderr).not.toContain('manual fallback');
    expect(h.stderr).not.toContain('push origin');
    expect(JSON.parse(h.stdout)).toMatchObject({ ok: false, pushed: false, result: { taskId: 's3-task', resultGeneration: null, candidate: { branch: null, commitSha: null } }, pendingAction: { ownerReference: owner, state: 'pending' } });
    expect(() => readFileSync(effectLog)).toThrow();
  });

  it('unavailable detail retains explicitly unbound pending custody', async () => {
    task = {};
    detailCode = 503;
    const noOwner = { ...env };
    delete noOwner.RUNTIME_BRIDGE_RESULT_OWNER;
    try {
      const r = await run(tsx, ['packages/runtime-bridge/src/cli/await.ts', 's3-task', '--once'], { env: noOwner });
      expect(r.code).toBe(1);
      expect(JSON.parse(r.stdout)).toMatchObject({ status: 'error', rawStatus: 'unknown', meta: { taskId: 's3-task', resultGeneration: null, nextAction: { state: 'pending', ownerReference: null } } });
    } finally { detailCode = 200; }
  });

  it('validated detail preserves ordinary fallback with uncertain delivery outcome', async () => {
    task = { ...baseTask };
    detailCode = 200;
    const h = await run(tsx, ['packages/runtime-bridge/src/cli/harvest.ts', 's3-task', '--base', 'staging', '--container', 'fixture', '--repo-path', scratch, '--host-repo', scratch, '--no-auto-merge']);
    expect(h.code).toBe(1);
    expect(h.stderr).toContain('manual fallback');
    expect(h.stderr).toContain('push origin');
    expect(JSON.parse(h.stdout)).toMatchObject({ ok: false, pushed: null, result: { taskId: 's3-task', candidate: { branch: 'candidate', commitSha: baseTask.commitSha } }, pendingAction: { ownerReference: owner, state: 'pending' } });
  }, 35_000);

  it('held validated detail never exposes fallback after an input error', async () => {
    task = { ...baseTask, manualReviewRequired: true };
    detailCode = 200;
    const h = await run(tsx, ['packages/runtime-bridge/src/cli/harvest.ts', 's3-task', '--base', 'staging', '--container', 'fixture', '--repo-path', scratch, '--host-repo', scratch, '--no-auto-merge', '--body-file', join(scratch, 'missing-body.md')]);
    expect(h.code).toBe(1);
    expect(h.stderr).not.toContain('manual fallback');
    expect(h.stderr).not.toContain('push origin');
    expect(JSON.parse(h.stdout)).toMatchObject({ ok: false, pendingAction: { state: 'pending', ownerReference: owner } });
  });

  it('ordinary specified repair reaches the existing comment then event consumer', async () => {
    task = { ...baseTask };
    requests.length = 0;
    const priorRoot = process.env.AIF_INTENT_REPO_ROOT;
    process.env.AIF_INTENT_REPO_ROOT = scratch;
    try {
      const result = await pushAnswer(baseUrl, 's3-task', 'request_changes', 'Repair the admitted parser; retain its generated closure.');
      expect(result).toEqual({ taskId: 's3-task', decision: 'request_changes', event: 'request_changes', commented: true });
      expect(requests.filter((x) => x.method === 'POST')).toEqual([
        { method: 'POST', path: '/tasks/s3-task/comments', body: { message: 'Repair the admitted parser; retain its generated closure.' } },
        { method: 'POST', path: '/tasks/s3-task/events', body: { event: 'request_changes' } },
      ]);
    } finally {
      if (priorRoot === undefined) delete process.env.AIF_INTENT_REPO_ROOT;
      else process.env.AIF_INTENT_REPO_ROOT = priorRoot;
    }
  });

  it('real scratch Git inputs still reach normal publication dependencies when unheld', async () => {
    const effects: string[] = [];
    const git = (args: string[]) => execFileSync('git', ['-C', scratch, ...args], { env, encoding: 'utf8' });
    const deps: HarvestDeps = {
      hasUncommittedChanges: async () => Boolean(git(['status', '--porcelain', '--untracked-files=no']).trim()),
      trackedDirtyFiles: async () => [], commitsAhead: async () => 1,
      commitAll: async () => { effects.push('commit'); },
      pushBranch: async () => { effects.push('push'); },
      createPr: async () => { effects.push('PR'); return 'https://example.test/pr/1'; },
      enableAutoMerge: async () => { effects.push('merge'); },
      changedFilesVsBase: async () => [],
    };
    const r = await harvestTask(baseTask, { baseBranch: 'staging', body: 'Existing task reference', autoMerge: false }, deps);
    expect(r.pushed).toBe(true);
    expect(effects).toEqual(['push', 'PR']);
    expect(r.result).toMatchObject({ taskId: 's3-task', candidate: { commitSha: baseTask.commitSha }, acceptance: 'unverified' });
    expect(r.result?.resultGeneration).toMatch(/^[a-f0-9]{64}$/);
  });

  it('actual factory installer delivers the changed consumer, preserves stub, excludes await', async () => {
    const consumer = join(scratch, 'consumer');
    mkdirSync(consumer);
    execFileSync('git', ['init', '-q', consumer], { env });
    writeFileSync(join(consumer, 'package.json'), '{"name":"s3-consumer","version":"1.0.0"}\n');
    const r = await run('bash', [join(root, 'install.sh'), 'ts-server', '--profile', 'factory'], { cwd: consumer, timeoutMs: 180_000 });
    expect(r.code, r.stdout + r.stderr).toBe(0);
    const delivered = join(consumer, '.claude/vendor/runtime-bridge');
    expect(() => readFileSync(join(delivered, 'src/cli/await.ts'))).toThrow();
    expect(readFileSync(join(delivered, 'src/idempotency.ts'))).toEqual(readFileSync(join(root, 'packages/runtime-bridge/vendor/src/idempotency.ts')));
    const script = `import(${JSON.stringify(pathToFileURL(join(delivered, 'src/harvest.ts')).href)}).then(async m => {
      const deps = new Proxy({}, {get:()=>async()=>{throw Error('HELD TASK REACHED EFFECT')}});
      const result = await m.harvestTask(${JSON.stringify({ ...baseTask, manualReviewRequired: true })}, {baseBranch:'staging',body:'fixture',autoMerge:false}, deps);
      process.stdout.write(JSON.stringify(result));
    })`;
    const h = await run(tsx, ['--eval', script]);
    expect(h.code, h.stderr).toBe(0);
    expect(JSON.parse(h.stdout)).toMatchObject({ pushed: false, pendingAction: { state: 'pending' } });
    task = { ...baseTask, manualReviewRequired: true };
    const backendProbe = `import(${JSON.stringify(pathToFileURL(join(delivered, 'src/AifHandoffBackend.ts')).href)}).then(async m => {
      const backend = new m.AifHandoffBackend({baseUrl:${JSON.stringify(baseUrl)}});
      const status = await backend.getStatus({backend:'aif-handoff',taskId:'s3-task',dispatchedAt:'2026-10-24T21:00:00Z'});
      process.stdout.write(JSON.stringify(status));
    })`;
    const b = await run(tsx, ['--eval', backendProbe]);
    expect(b.code, b.stderr).toBe(0);
    expect(JSON.parse(b.stdout)).toMatchObject({ status: 'error', rawStatus: 'done', meta: { taskId: 's3-task', candidate: { commitSha: baseTask.commitSha }, nextAction: { ownerReference: owner } } });
  }, 190_000);
});
