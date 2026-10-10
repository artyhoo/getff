/**
 * intent-first-result S1 Task 5 — EFFECT negatives at the real seams (kickoff §4 Task 2,
 * review-focus items 1/2/5, T-INTENT-B).
 *
 * The helper suite (packages/core/skills/intent-result-review.test.ts) pins the validator's
 * record semantics in isolation. THIS suite pins the wire: a failed scope/review validation
 * must produce ZERO effect at each continuation seam —
 *   no POST /tasks, no POST /fire, no unpause PUT, no manual packet, no dedup success,
 *   no plan-changing answer write — while unscoped work keeps today's behaviour exactly.
 *
 * T22 (single flipping production change per arm, named in the `it` title):
 *   CLI arms   → the scope check in cli/dispatch.ts (placed BEFORE checkDedup, NOT bypassed
 *                by --force) and claim()'s scoped autoMode:false branch.
 *   Backend    → the guard at the top of AifHandoffBackend.claim / release, ManualBackend.dispatch
 *                and AifFireBackend.dispatch converting helper failures to spec_invalid.
 *   Release    → release()'s persisted-description re-read (a bare task id does not erase scope;
 *                malformed declared scope never becomes ordinary scope; a stale review holds a
 *                paused claim paused).
 *   Answer     → pushAnswer's scoped-decision guard (plan-changing/restarting answers on a
 *                feature-scoped task require an authorized within-contract PlanReview).
 *   Start      → startReviewed's gated route (plan_ready + autoMode:false + authorized
 *                PlanReview + re-read revalidation, or NO start_implementation event).
 *
 * RED state at authoring: `../src/resultReview.js` and `cli/start-reviewed.js` do not exist
 * and no seam consults them — every guard arm below fails today, every unscoped control passes.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  spawnSync,
  spawn,
  type ChildProcess,
  type SpawnSyncReturns,
} from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { AifHandoffBackend } from '../src/AifHandoffBackend.js';
import { ManualBackend } from '../src/ManualBackend.js';
import { AifFireBackend } from '../src/AifFireBackend.js';
import { BackendError } from '../src/backend.js';
import { pushAnswer } from '../src/cli/answer.js';
import { startReviewed } from '../src/cli/start-reviewed.js';
import type { KickoffSpec } from '../src/types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const CLI = resolve(HERE, '../src/cli/dispatch.ts');
const TSX = resolve(REPO_ROOT, 'node_modules/.bin/tsx');
const HELPER = resolve(
  REPO_ROOT,
  '.agents/procedures/intent/helpers/check-result-review.mjs',
);
const SLOW_SHELL_MS = 30_000;

const sha256 = (bytes: string): string =>
  createHash('sha256').update(bytes).digest('hex');

// The adapter module under test — loaded lazily so the UNSCOPED control arms stay runnable
// at RED: module-not-found on this import IS the RED state for the adapter/direct arms.
const loadResultReview = async (): Promise<{
  extractIntentScope: (content: string) => { kind: string };
  taskPreImageDigest: (
    task: unknown,
    opts?: { helperPath?: string },
  ) => Promise<string>;
}> =>
  import(pathToFileURL(resolve(HERE, '../src/resultReview.ts')).href) as never;

// ---------------------------------------------------------------------------
// Fixture tree — one disposable owner root; contract + brief + review files.
// ---------------------------------------------------------------------------
const ROOT = mkdtempSync(resolve(tmpdir(), 'intent-effects-fixture-'));
for (const dir of ['reviews', 'evidence', 'env'])
  mkdirSync(resolve(ROOT, dir), { recursive: true });

const briefDigest = (() => {
  const bytes = '# Pilot brief\n\nFeature: fx-pilot.\n';
  writeFileSync(resolve(ROOT, 'brief.md'), bytes, 'utf8');
  return sha256(bytes);
})();
const E = (rel: string, bytes: string): { path: string; sha256: string } => {
  writeFileSync(resolve(ROOT, rel), bytes, 'utf8');
  return { path: rel, sha256: sha256(bytes) };
};
const envRef = E('env/toolchain.md', '# Toolchain\nnode 22.\n');
const p1Ref = E(
  'evidence/p1.log',
  'forbidden read named; accessor replacement explained; corrected passes\n',
);

interface FxContract {
  version: number;
  featureId: string;
  resultId: string;
  mode: string;
  brief: { path: string; sha256: string };
  shared: Array<{ path: string; sha256: string }>;
  essentialPromiseIds: string[];
  requiresReview?: { path: string; sha256: string };
  parentContract?: { path: string; sha256: string };
  producesOrRepairs?: string;
}

const produceContract: FxContract = {
  version: 1,
  featureId: 'fx-pilot',
  resultId: 'fx-result',
  mode: 'produce',
  brief: { path: 'brief.md', sha256: briefDigest },
  shared: [],
  essentialPromiseIds: ['P1'],
};

const contractBytes = `${JSON.stringify(produceContract, null, 2)}\n`;
writeFileSync(resolve(ROOT, 'contract.json'), contractBytes, 'utf8');
const contractDigest = sha256(contractBytes);
const contractRef = { path: 'contract.json', sha256: contractDigest };

const matchingReview = {
  version: 1,
  attemptId: 'a1',
  featureId: 'fx-pilot',
  resultId: 'fx-result',
  brief: { path: 'brief.md', sha256: briefDigest },
  producerContract: contractRef,
  observedRevision: 'rev-1',
  sourceInputs: [],
  environment: envRef,
  evidence: [p1Ref],
  promises: [
    {
      id: 'P1',
      comparison: 'supported',
      evidence: [p1Ref],
      explanation: 'observed on the installed check',
    },
  ],
  outcome: 'matches',
  limits: [],
};
const reviewBytes = `${JSON.stringify(matchingReview, null, 2)}\n`;
writeFileSync(resolve(ROOT, 'reviews/a1.json'), reviewBytes, 'utf8');

/** A contract whose requiresReview binds the matching attempt — the release seam validates it. */
const reviewedContract: FxContract = {
  ...produceContract,
  requiresReview: { path: 'reviews/a1.json', sha256: sha256(reviewBytes) },
};
const reviewedBytes = `${JSON.stringify(reviewedContract, null, 2)}\n`;
writeFileSync(resolve(ROOT, 'contract-reviewed.json'), reviewedBytes, 'utf8');

/** A child contract that drops P1 while its parent (contract.json) retains it. */
const weakenedChild: FxContract = {
  ...produceContract,
  essentialPromiseIds: [],
  parentContract: contractRef,
};
const weakenedBytes = `${JSON.stringify(weakenedChild, null, 2)}\n`;
writeFileSync(resolve(ROOT, 'contract-weakened.json'), weakenedBytes, 'utf8');

/** Kickoff/description text carrying exactly one fenced intent-contract block. */
const scopedText = (contract: unknown, nonce: string): string =>
  `# Scoped demo ${nonce}\n\n## §1\nBody.\n\n\`\`\`intent-contract\n${JSON.stringify(contract, null, 2)}\n\`\`\`\n`;
const unscopedText = (nonce: string): string =>
  `# Plain demo ${nonce}\n\n## §1\nBody.\n`;
const malformedScopedText = (nonce: string): string =>
  `# Broken demo ${nonce}\n\n\`\`\`intent-contract\n{ not json\n\`\`\`\n`;

const kickoffSpec = (content: string): KickoffSpec => ({
  filePath: resolve(ROOT, `kickoff-${sha256(content).slice(0, 8)}.md`),
  content,
  // Unique umbrella (≠ dispatch-spec-invalid's 'demo-stage'): ManualBackend hashes it
  // into the /tmp packet name, so a shared umbrella would let this file's manual-fallback
  // controls and the sibling file's collide on the SAME filename inside one second.
  umbrellaName: 'demo-intent-fx',
  contentHash: sha256(content),
});

/** TaskId hash this suite's ManualBackend dispatches stamp onto their /tmp packets —
 *  manualArtifacts() scopes to it so a parallel worker's packets (other test files,
 *  other worktrees) can never land in a before/after window (measured 2026-10-10:
 *  the sibling file's A5-4 arm failed on THIS file's arm10 packet, and vice versa). */
const FIXTURE_TASK_HASH = sha256('demo-intent-fx').slice(0, 8);

// ---------------------------------------------------------------------------
// CLI harness — stub aif in its OWN process, logging every request to a JSONL file
// (dispatch-spec-invalid.test.ts harness; the log adds request + body recording so a
// zero-effect claim can be asserted across a process boundary).
// ---------------------------------------------------------------------------
const STUB_SRC = `
import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';
const cfg = JSON.parse(process.argv[2]);
const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};
createServer((req, res) => {
  const url = req.url ?? '';
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    let body;
    try { body = raw ? JSON.parse(raw) : undefined; } catch { body = raw; }
    appendFileSync(cfg.log, JSON.stringify({ method: req.method, url, body }) + '\\n');
    if (url.startsWith('/health')) return send(res, 200, { ok: true });
    if (url.startsWith('/projects')) return send(res, 200, [{ id: 'proj-uuid', parallelEnabled: true }]);
    if (url.startsWith('/tasks') && req.method === 'POST') return send(res, 201, { id: 'task-123', status: 'backlog' });
    return send(res, 200, {});
  });
}).listen(0, '127.0.0.1', function () {
  process.stdout.write('READY http://127.0.0.1:' + this.address().port + '\\n');
});
`;

const running: ChildProcess[] = [];
afterEach(() => {
  while (running.length) running.pop()?.kill();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

interface StubLog {
  start(): Promise<string>;
  calls(): Array<{ method: string; url: string; body?: unknown }>;
}

function startStub(): StubLog {
  const logPath = resolve(
    mkdtempSync(resolve(tmpdir(), 'rb-stub-log-')),
    'requests.jsonl',
  );
  const dir = dirname(logPath);
  const stubPath = resolve(dir, 'stub.mjs');
  writeFileSync(stubPath, STUB_SRC, 'utf8');
  let baseUrl = '';
  const child = spawn('node', [stubPath, JSON.stringify({ log: logPath })], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  running.push(child);
  const ready = new Promise<string>((ok, fail) => {
    const t = setTimeout(
      () => fail(new Error('stub never reported READY')),
      10_000,
    );
    child.stdout!.on('data', (buf: Buffer) => {
      const m = /READY (\S+)/.exec(String(buf));
      if (m) {
        clearTimeout(t);
        ok(m[1]);
      }
    });
  });
  return {
    start: async () => {
      baseUrl = await ready;
      return baseUrl;
    },
    calls: () =>
      existsOrEmpty(logPath)
        ? readFileSync(logPath, 'utf8')
            .trim()
            .split('\n')
            .filter(Boolean)
            .map(
              (l) =>
                JSON.parse(l) as {
                  method: string;
                  url: string;
                  body?: unknown;
                },
            )
        : [],
  };
  function existsOrEmpty(p: string): boolean {
    try {
      readFileSync(p, 'utf8');
      return true;
    } catch {
      return false;
    }
  }
}

const manualArtifacts = (): string[] =>
  readdirSync('/tmp').filter(
    (f) =>
      f.startsWith('runtime-bridge-') && f.endsWith(`-${FIXTURE_TASK_HASH}.md`),
  );

function writeKickoffFile(content: string): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'rb-kickoff-'));
  const path = resolve(dir, 'kickoff.md');
  writeFileSync(path, content, 'utf8');
  return path;
}

function runDispatch(
  kickoffPath: string,
  baseUrl: string,
  envOverride: Record<string, string> = {},
): SpawnSyncReturns<string> {
  return spawnSync(TSX, [CLI, kickoffPath, '--force'], {
    encoding: 'utf8',
    timeout: SLOW_SHELL_MS,
    env: {
      ...process.env,
      RUNTIME_BRIDGE_MODE: 'aif-handoff',
      RUNTIME_BRIDGE_AIF_URL: baseUrl,
      RUNTIME_BRIDGE_AIF_PROJECT_ID: 'proj-uuid',
      RUNTIME_BRIDGE_PREFLIGHT: '',
      RUNTIME_BRIDGE_DEDUP_PATH: resolve(ROOT, 'dedup.jsonl'),
      RUNTIME_BRIDGE_INTENT_ROOTS: ROOT,
      RUNTIME_BRIDGE_INTENT_HELPER: HELPER,
      ...envOverride,
    },
  });
}

// ---------------------------------------------------------------------------
// The fence contract — extraction itself (adapter unit face).
// ---------------------------------------------------------------------------
describe('extractIntentScope — fail-closed fence parsing', () => {
  it('zero blocks → unscoped (ordinary behaviour applies)', async () => {
    const { extractIntentScope } = await loadResultReview();
    expect(extractIntentScope(unscopedText('x'))).toMatchObject({
      kind: 'unscoped',
    });
  });
  it('one well-formed block → scoped with a parsed contract', async () => {
    const { extractIntentScope } = await loadResultReview();
    expect(extractIntentScope(scopedText(produceContract, 'y'))).toMatchObject({
      kind: 'scoped',
    });
  });
  it('malformed block → invalid (NEVER falls through to unscoped)', async () => {
    const { extractIntentScope } = await loadResultReview();
    expect(extractIntentScope(malformedScopedText('z')).kind).toBe('invalid');
  });
  it('two blocks → invalid (ambiguous declared scope fails closed)', async () => {
    const { extractIntentScope } = await loadResultReview();
    const two = `${scopedText(produceContract, 'a')}\n${scopedText(produceContract, 'b')}`;
    expect(extractIntentScope(two).kind).toBe('invalid');
  });
});

// ---------------------------------------------------------------------------
// CLI seam — validation before dedup success, before any POST, --force-proof.
// ---------------------------------------------------------------------------
describe('cli/dispatch.ts — a scoped kickoff with a broken contract never dispatches', () => {
  it(
    'malformed intent-contract block → exit 2, NO POST /tasks, no manual packet, no dedup record',
    async () => {
      const stub = startStub();
      const url = await stub.start();
      const before = new Set(manualArtifacts());
      const r = runDispatch(writeKickoffFile(malformedScopedText('arm1')), url);

      expect(r.status).toBe(2);
      expect(
        stub
          .calls()
          .filter((c) => c.method === 'POST' && c.url.endsWith('/tasks')),
      ).toEqual([]);
      expect(manualArtifacts().filter((f) => !before.has(f))).toEqual([]);
      expect(r.stdout).not.toContain('paste into a new Claude Code session');
      expect(r.stdout).not.toContain('Dispatched to');
    },
    SLOW_SHELL_MS + 15_000,
  );

  it(
    'valid declared scope whose brief bytes are missing → exit 2, NO POST (ref resolution at the dispatch seam)',
    async () => {
      const stub = startStub();
      const url = await stub.start();
      const broken: FxContract = {
        ...produceContract,
        brief: { path: 'brief-gone.md', sha256: briefDigest },
      };
      const r = runDispatch(writeKickoffFile(scopedText(broken, 'arm2')), url);

      expect(r.status).toBe(2);
      expect(
        stub
          .calls()
          .filter((c) => c.method === 'POST' && c.url.endsWith('/tasks')),
      ).toEqual([]);
    },
    SLOW_SHELL_MS + 15_000,
  );

  it(
    '--force does NOT bypass the scope gate → exit 2, NO POST, no dedup success line',
    async () => {
      const stub = startStub();
      const url = await stub.start();
      const r = runDispatch(writeKickoffFile(malformedScopedText('arm3')), url);

      expect(r.status).toBe(2);
      expect(r.stdout).not.toContain('already dispatched');
      expect(
        stub
          .calls()
          .filter((c) => c.method === 'POST' && c.url.endsWith('/tasks')),
      ).toEqual([]);
    },
    SLOW_SHELL_MS + 15_000,
  );

  it(
    'a seeded dedup entry does NOT report success ahead of the scope check → exit 2',
    async () => {
      const stub = startStub();
      const url = await stub.start();
      const content = malformedScopedText('arm4');
      const dedupPath = resolve(ROOT, 'dedup-preseeded.jsonl');
      writeFileSync(
        dedupPath,
        `${JSON.stringify({
          hash: sha256(content),
          taskHandle: {
            backend: 'aif-handoff',
            taskId: 'prior-task',
            dispatchedAt: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        })}\n`,
        'utf8',
      );
      const r = runDispatch(writeKickoffFile(content), url, {
        RUNTIME_BRIDGE_DEDUP_PATH: dedupPath,
      });

      expect(r.status).toBe(2);
      expect(r.stdout).not.toContain('already dispatched');
      expect(
        stub
          .calls()
          .filter((c) => c.method === 'POST' && c.url.endsWith('/tasks')),
      ).toEqual([]);
    },
    SLOW_SHELL_MS + 15_000,
  );

  it(
    'SCOPED CONTROL: a valid produce contract dispatches with autoMode:false (planning may run, implementation may not)',
    async () => {
      const stub = startStub();
      const url = await stub.start();
      const r = runDispatch(
        writeKickoffFile(scopedText(produceContract, 'arm5')),
        url,
      );

      expect(r.status).toBe(0);
      const post = stub
        .calls()
        .find((c) => c.method === 'POST' && c.url.endsWith('/tasks'));
      expect(post?.body).toMatchObject({ paused: true, autoMode: false });
    },
    SLOW_SHELL_MS + 15_000,
  );

  it(
    'UNSCOPED CONTROL: ordinary dispatch is unchanged (exit 0, autoMode:true)',
    async () => {
      const stub = startStub();
      const url = await stub.start();
      const r = runDispatch(writeKickoffFile(unscopedText('arm6')), url);

      expect(r.status).toBe(0);
      const post = stub
        .calls()
        .find((c) => c.method === 'POST' && c.url.endsWith('/tasks'));
      expect(post?.body).toMatchObject({ paused: true, autoMode: true });
    },
    SLOW_SHELL_MS + 15_000,
  );
});

// ---------------------------------------------------------------------------
// Direct backend seams — zero fetch, zero packet on a failed scope.
// ---------------------------------------------------------------------------
describe('direct backend invocation — failed scope means zero effects', () => {
  it('AifHandoffBackend.dispatch with a malformed scope → spec_invalid and fetch is NEVER called', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const spy = vi.spyOn(globalThis, 'fetch');
    const backend = new AifHandoffBackend({
      baseUrl: 'http://localhost:3009',
      projectId: 'proj-uuid',
    });

    await expect(
      backend.dispatch(kickoffSpec(malformedScopedText('arm7'))),
    ).rejects.toMatchObject({
      name: 'BackendError',
      code: 'spec_invalid',
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('ManualBackend.dispatch with a malformed scope → spec_invalid and NO /tmp packet', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const before = new Set(manualArtifacts());

    await expect(
      new ManualBackend().dispatch(kickoffSpec(malformedScopedText('arm8'))),
    ).rejects.toBeInstanceOf(BackendError);
    expect(manualArtifacts().filter((f) => !before.has(f))).toEqual([]);
  });

  it('AifFireBackend.dispatch with a malformed scope → spec_invalid and fetch is NEVER called', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const spy = vi.spyOn(globalThis, 'fetch');
    const backend = new AifFireBackend({
      routineId: 'r-1',
      token: 't-1',
      baseUrl: 'http://localhost:9',
    });

    await expect(
      backend.dispatch(kickoffSpec(malformedScopedText('arm9'))),
    ).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('UNSCOPED CONTROL: ManualBackend.dispatch still writes its packet (ordinary behaviour)', () => {
    const before = new Set(manualArtifacts());
    return new ManualBackend()
      .dispatch(kickoffSpec(unscopedText('arm10')))
      .then((handle) => {
        expect(existsTmpPacket(handle.taskId)).toBe(true);
      });
    function existsTmpPacket(taskId: string): boolean {
      try {
        readFileSync(`/tmp/runtime-bridge-${taskId}.md`, 'utf8');
        return true;
      } catch {
        return false;
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Release seam — the persisted description is re-read; stale/weak/malformed hold.
// ---------------------------------------------------------------------------
interface Call {
  url: string;
  method: string;
  body?: Record<string, unknown>;
}

function mockTaskStore(calls: Call[], task: Record<string, unknown>): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : undefined;
      calls.push({ url, method, body });
      if (method === 'GET' && url.endsWith('/projects')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([{ id: 'proj-uuid', parallelEnabled: true }]),
            { status: 200 },
          ),
        );
      }
      if (method === 'POST' && url.endsWith('/tasks')) {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 'task-42', status: 'backlog' }), {
            status: 201,
          }),
        );
      }
      if (method === 'GET' && /\/tasks\/[^/]+$/.test(url)) {
        return Promise.resolve(
          new Response(JSON.stringify(task), { status: 200 }),
        );
      }
      return Promise.resolve(new Response('', { status: 200 }));
    },
  );
}

describe('AifHandoffBackend.release — validation against the PERSISTED description', () => {
  const backend = () =>
    new AifHandoffBackend({
      baseUrl: 'http://localhost:3009',
      projectId: 'proj-uuid',
    });

  it('stale delayed release → refused, NO unpause PUT; the paused claim remains paused', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_OBSERVED_REVISION', 'rev-2');
    const content = scopedText(reviewedContract, 'rel1');
    const calls: Call[] = [];
    mockTaskStore(calls, {
      id: 'task-42',
      status: 'backlog',
      paused: true,
      description: content,
    });
    const handle = await backend().claim(kickoffSpec(content));
    calls.length = 0;

    await expect(backend().release(handle)).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/events')),
    ).toEqual([]);
  });

  it('child scope dropping a parent essential in the PERSISTED description → refused, no PUT', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const content = scopedText(weakenedChild, 'rel2');
    const calls: Call[] = [];
    mockTaskStore(calls, {
      id: 'task-42',
      status: 'backlog',
      paused: true,
      description: content,
    });
    const handle = await backend().claim(kickoffSpec(content));
    calls.length = 0;

    await expect(backend().release(handle)).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);
  });

  it('malformed declared scope in the persisted description → refused, NEVER treated as ordinary unscoped', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const content = malformedScopedText('rel3');
    const calls: Call[] = [];
    mockTaskStore(calls, {
      id: 'task-42',
      status: 'backlog',
      paused: true,
      description: content,
    });
    const handle = await backend().claim(kickoffSpec(content));
    calls.length = 0;

    await expect(backend().release(handle)).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);
  });

  it('SCOPED CONTROL: current review + intact scope → unpause PUT and the start_ai planning event', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_OBSERVED_REVISION', 'rev-1');
    const content = scopedText(reviewedContract, 'rel4');
    const calls: Call[] = [];
    mockTaskStore(calls, {
      id: 'task-42',
      status: 'backlog',
      paused: true,
      description: content,
    });
    const handle = await backend().claim(kickoffSpec(content));
    calls.length = 0;

    await backend().release(handle);
    expect(
      calls.some((c) => c.method === 'PUT' && c.body?.['paused'] === false),
    ).toBe(true);
    const events = calls.filter(
      (c) => c.method === 'POST' && c.url.endsWith('/events'),
    );
    expect(events.some((c) => c.body?.['event'] === 'start_ai')).toBe(true);
  });

  it('UNSCOPED CONTROL: release stays a bare unpause PUT — no event, unchanged behaviour', async () => {
    const content = unscopedText('rel5');
    const calls: Call[] = [];
    mockTaskStore(calls, {
      id: 'task-42',
      status: 'backlog',
      paused: true,
      description: content,
    });
    const handle = await backend().claim(kickoffSpec(content));
    calls.length = 0;

    await backend().release(handle);
    expect(
      calls.some((c) => c.method === 'PUT' && c.body?.['paused'] === false),
    ).toBe(true);
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/events')),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Answer seam — plan-changing/restarting answers on a scoped task are guarded.
// ---------------------------------------------------------------------------
describe('cli/answer.ts pushAnswer — scoped tasks require an authorized within-contract PlanReview', () => {
  const PLAN = '## Task\nimplement the thing\n';
  const ANSWER = 'resume with the approved accessor wording';

  const planReview = async (
    overrides: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> => ({
    taskId: 'task-42',
    contractRef,
    effectivePlanSha256: sha256(PLAN),
    taskPreImageSha256: await (
      await loadResultReview()
    ).taskPreImageDigest(
      {
        id: 'task-42',
        title: 'demo-stage',
        status: 'done',
        plan: PLAN,
        paused: true,
        autoMode: false,
      },
      { helperPath: HELPER },
    ),
    payloadSha256: sha256(ANSWER),
    classification: 'within-contract',
    ownerReference: 'operator statement 2026-10-10, content bound by digest',
    ...overrides,
  });

  const scopedTask = (contract: unknown): Record<string, unknown> => ({
    id: 'task-42',
    title: 'demo-stage',
    status: 'done',
    plan: PLAN,
    paused: true,
    autoMode: false,
    description: scopedText(contract, 'ans'),
  });

  it('scoped resume WITHOUT a PlanReview → spec_invalid, NO unpause PUT, no plan rewrite', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const calls: Call[] = [];
    mockTaskStore(calls, scopedTask(produceContract));

    await expect(
      pushAnswer('http://localhost:3009', 'task-42', 'resume', ANSWER),
    ).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);
  });

  it('scoped resume with a contract-revision PlanReview → HELD (S1 default), no PUT', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const reviewPath = resolve(ROOT, 'plan-review-contract-revision.json');
    writeFileSync(
      reviewPath,
      JSON.stringify(
        await planReview({ classification: 'contract-revision' }),
        null,
        2,
      ),
      'utf8',
    );
    const calls: Call[] = [];
    mockTaskStore(calls, scopedTask(produceContract));

    await expect(
      pushAnswer('http://localhost:3009', 'task-42', 'resume', ANSWER, {
        reviewPath,
      }),
    ).rejects.toMatchObject({ code: 'spec_invalid' });
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);
  });

  it('scoped resume with a PlanReview whose payload digest diverges → held, no PUT', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const reviewPath = resolve(ROOT, 'plan-review-bad-payload.json');
    writeFileSync(
      reviewPath,
      JSON.stringify(
        await planReview({ payloadSha256: sha256('a different answer') }),
        null,
        2,
      ),
      'utf8',
    );
    const calls: Call[] = [];
    mockTaskStore(calls, scopedTask(produceContract));

    await expect(
      pushAnswer('http://localhost:3009', 'task-42', 'resume', ANSWER, {
        reviewPath,
      }),
    ).rejects.toMatchObject({ code: 'spec_invalid' });
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);
  });

  it('SCOPED CONTROL: within-contract PlanReview + matching payload → the unpause PUT proceeds', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const reviewPath = resolve(ROOT, 'plan-review-ok.json');
    writeFileSync(
      reviewPath,
      JSON.stringify(await planReview(), null, 2),
      'utf8',
    );
    const calls: Call[] = [];
    mockTaskStore(calls, scopedTask(produceContract));

    await pushAnswer('http://localhost:3009', 'task-42', 'resume', ANSWER, {
      reviewPath,
    });
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.body).toMatchObject({ paused: false, blockedReason: null });
    expect(String(put?.body?.['plan'])).toContain('OPERATOR ANSWER');
  });

  it('scoped request_changes WITHOUT a PlanReview → no comment POST, no event POST', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const calls: Call[] = [];
    mockTaskStore(calls, scopedTask(produceContract));

    await expect(
      pushAnswer('http://localhost:3009', 'task-42', 'request_changes', ANSWER),
    ).rejects.toMatchObject({ code: 'spec_invalid' });
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/comments')),
    ).toEqual([]);
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/events')),
    ).toEqual([]);
  });

  it('UNSCOPED CONTROL: resume without a contract stays ordinary (unpause PUT proceeds)', async () => {
    const calls: Call[] = [];
    mockTaskStore(calls, {
      id: 'task-42',
      title: 'demo-stage',
      status: 'done',
      plan: PLAN,
      paused: true,
    });

    await pushAnswer('http://localhost:3009', 'task-42', 'resume', ANSWER);
    expect(
      calls.some((c) => c.method === 'PUT' && c.body?.['paused'] === false),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Start seam — start_implementation is posted ONLY through the gated reviewed route.
// ---------------------------------------------------------------------------
/** Mock whose GET /tasks/:id serves `first` once and `then` afterwards (re-read divergence). */
function mockChangingTaskStore(
  calls: Call[],
  first: Record<string, unknown>,
  then: Record<string, unknown>,
): void {
  let gets = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({
        url,
        method,
        body: init?.body
          ? (JSON.parse(String(init.body)) as Record<string, unknown>)
          : undefined,
      });
      if (method === 'GET' && /\/tasks\/[^/]+$/.test(url)) {
        gets += 1;
        return Promise.resolve(
          new Response(JSON.stringify(gets === 1 ? first : then), {
            status: 200,
          }),
        );
      }
      return Promise.resolve(new Response('', { status: 200 }));
    },
  );
}

describe('cli/start-reviewed.ts startReviewed — the event POST fires only on an authorized review of a waiting scoped claim', () => {
  const PLAN = '## Task\nimplement the scoped thing\n';

  /** A task parked at plan_ready by the scoped claim (autoMode:false). */
  const waitingScopedTask = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    id: 'task-42',
    title: 'demo-stage',
    status: 'plan_ready',
    plan: PLAN,
    paused: true,
    autoMode: false,
    description: scopedText(produceContract, 'sr'),
    ...overrides,
  });

  /** Authorized PlanReview for the current row — start-reviewed proposes NO answer payload. */
  const startReview = async (
    task: Record<string, unknown>,
    overrides: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> => ({
    taskId: 'task-42',
    contractRef,
    effectivePlanSha256: sha256(String(task.plan ?? '')),
    taskPreImageSha256: await (
      await loadResultReview()
    ).taskPreImageDigest(task, { helperPath: HELPER }),
    classification: 'within-contract',
    ownerReference: 'operator statement 2026-10-10, content bound by digest',
    ...overrides,
  });

  const writeReview = async (
    name: string,
    task: Record<string, unknown>,
    overrides: Record<string, unknown> = {},
  ) => {
    const reviewPath = resolve(ROOT, `start-review-${name}.json`);
    writeFileSync(
      reviewPath,
      JSON.stringify(await startReview(task, overrides), null, 2),
      'utf8',
    );
    return reviewPath;
  };

  it('UNSCOPED task → refused (this is the scoped route only), NO event POST', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const row = { ...waitingScopedTask(), description: unscopedText('sr1') };
    const reviewPath = await writeReview('unscoped', row);
    const calls: Call[] = [];
    mockTaskStore(calls, row);

    await expect(
      startReviewed('http://localhost:3009', 'task-42', reviewPath),
    ).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/events')),
    ).toEqual([]);
  });

  it('scoped task NOT in plan_ready → held (nothing to start), NO event POST', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const row = waitingScopedTask({ status: 'planning' });
    const reviewPath = await writeReview('wrong-state', row);
    const calls: Call[] = [];
    mockTaskStore(calls, row);

    await expect(
      startReviewed('http://localhost:3009', 'task-42', reviewPath),
    ).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/events')),
    ).toEqual([]);
  });

  it('autoMode:true (an ordinary auto task) → refused through the reviewed route, NO event POST', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const row = waitingScopedTask({ autoMode: true });
    const reviewPath = await writeReview('automode', row);
    const calls: Call[] = [];
    mockTaskStore(calls, row);

    await expect(
      startReviewed('http://localhost:3009', 'task-42', reviewPath),
    ).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/events')),
    ).toEqual([]);
  });

  it('review binding an ANSWER payload while start-reviewed proposes none → HELD (payload binding), NO event POST', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const row = waitingScopedTask();
    const reviewPath = await writeReview('payload', row, {
      payloadSha256: sha256('an answer payload'),
    });
    const calls: Call[] = [];
    mockTaskStore(calls, row);

    await expect(
      startReviewed('http://localhost:3009', 'task-42', reviewPath),
    ).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/events')),
    ).toEqual([]);
  });

  it('plan bytes changed between validation and the re-read → HELD at the re-read, NO event POST', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const first = waitingScopedTask();
    const reviewPath = await writeReview('reread', first);
    const changed = waitingScopedTask({
      plan: '## Task\nDIFFERENT plan written concurrently\n',
    });
    const calls: Call[] = [];
    mockChangingTaskStore(calls, first, changed);

    await expect(
      startReviewed('http://localhost:3009', 'task-42', reviewPath),
    ).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    // Exactly the two validation GETs happened; the event never fired — the hold is
    // attributable to the RE-READ (the first pass validated clean), not an earlier guard.
    expect(
      calls.filter((c) => c.method === 'GET' && /\/tasks\//.test(c.url)),
    ).toHaveLength(2);
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/events')),
    ).toEqual([]);
  });

  it('SCOPED CONTROL: current review + waiting scoped claim → exactly one start_implementation event, no other write', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const row = waitingScopedTask();
    const reviewPath = await writeReview('ok', row);
    const calls: Call[] = [];
    mockTaskStore(calls, row);

    const result = await startReviewed(
      'http://localhost:3009',
      'task-42',
      reviewPath,
    );
    expect(result).toMatchObject({
      taskId: 'task-42',
      event: 'start_implementation',
    });
    const events = calls.filter(
      (c) => c.method === 'POST' && c.url.endsWith('/events'),
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.body).toEqual({ event: 'start_implementation' });
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);
  });
});
