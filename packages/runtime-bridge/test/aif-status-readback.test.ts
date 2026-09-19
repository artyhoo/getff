/**
 * Paired-negative tests for SW-C: aif-handoff WebSocket status read-back.
 *
 * Contract under test:
 *   1. Events for OUR taskId → status transitions correctly + state-file appended ✓
 *   2. Events for OTHER taskIds → ignored (no state change, no state-file write) ✓
 *   3. WS disconnect mid-task → awaitDone rejects with BackendError code 'unavailable'
 *      AND state.md notes the disconnection (event=ws_disconnected) — not a silent drop ✓
 *   4. State-file unset → status processing clean no-op (no crash) ✓
 *   5. Bridge-discipline: AifHandoffBackend.awaitDone surfaces WS drop as BackendError('unavailable') ✓
 *   6. getStatus returns mapped TaskStatus from REST snapshot ✓
 *   7. getStatus throws BackendError('unavailable') on 404 ✓
 *   8. blocked_external → awaitDone resolves { success: false } (not throw) ✓
 *
 * T3 compliance: each assertion names the source file:line it targets.
 * Mocking strategy: inject fake WebSocket constructor (DI) — vi.stubGlobal
 *   cannot intercept named imports from node:http (T-SWC-2 countermeasure).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  awaitTaskDone,
  getTaskStatus,
  mapAifStatusToTaskStatus,
  isTerminal,
  type WebSocketConstructor,
} from '../src/aifWsStatus.js';
import { BackendError } from '../src/backend.js';

// ── Test infrastructure ──────────────────────────────────────────────────────

const sandboxes: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeSandbox(): string {
  const d = mkdtempSync(join(tmpdir(), 'sw-c-test-'));
  sandboxes.push(d);
  return d;
}

/**
 * Fake WebSocket that allows tests to control events.
 * Mirrors the undici-types WebSocket interface used in awaitTaskDone.
 */
interface FakeWsControl {
  triggerOpen(): void;
  triggerMessage(data: unknown): void;
  triggerClose(): void;
  triggerError(): void;
  closedCount: number;
}

function makeFakeWebSocket(): { Ctor: WebSocketConstructor; ctrl: FakeWsControl } {
  let onopen: (() => void) | null = null;
  let onmessage: ((ev: { data: unknown }) => void) | null = null;
  let onclose: (() => void) | null = null;
  let onerror: ((ev: unknown) => void) | null = null;
  let closedCount = 0;

  const ctrl: FakeWsControl = {
    triggerOpen: () => onopen?.(),
    triggerMessage: (data) => onmessage?.({ data: JSON.stringify(data) }),
    triggerClose: () => onclose?.(),
    triggerError: () => onerror?.(new Event('error')),
    get closedCount() { return closedCount; },
  };

  class FakeWs {
    get onopen() { return onopen; }
    set onopen(fn: (() => void) | null) { onopen = fn; }
    get onmessage() { return onmessage; }
    set onmessage(fn: ((ev: { data: unknown }) => void) | null) { onmessage = fn; }
    get onclose() { return onclose; }
    set onclose(fn: (() => void) | null) { onclose = fn; }
    get onerror() { return onerror; }
    set onerror(fn: ((ev: unknown) => void) | null) { onerror = fn; }
    close() { closedCount++; }
  }

  return { Ctor: FakeWs as unknown as WebSocketConstructor, ctrl };
}

// ── Unit tests for helper functions ─────────────────────────────────────────

describe('mapAifStatusToTaskStatus — status enum mapping', () => {
  // Source: aifWsStatus.ts mapAifStatusToTaskStatus function
  it('backlog/planning map to pending', () => {
    expect(mapAifStatusToTaskStatus('backlog')).toBe('pending');
    expect(mapAifStatusToTaskStatus('planning')).toBe('pending');
  });

  it('plan_ready/implementing/review map to running', () => {
    expect(mapAifStatusToTaskStatus('plan_ready')).toBe('running');
    expect(mapAifStatusToTaskStatus('implementing')).toBe('running');
    expect(mapAifStatusToTaskStatus('review')).toBe('running');
  });

  it('done/verified map to done', () => {
    expect(mapAifStatusToTaskStatus('done')).toBe('done');
    expect(mapAifStatusToTaskStatus('verified')).toBe('done');
  });

  it('blocked_external maps to error', () => {
    expect(mapAifStatusToTaskStatus('blocked_external')).toBe('error');
  });

  it('unknown future status defaults to running (non-terminal assumption)', () => {
    // NEGATIVE: ensure unknown is NOT 'pending' or 'done'
    const result = mapAifStatusToTaskStatus('future_unknown_status');
    expect(result).toBe('running');
    expect(result).not.toBe('pending');
    expect(result).not.toBe('done');
  });
});

describe('isTerminal — terminal status detection', () => {
  // Source: aifWsStatus.ts isTerminal function
  it('done and verified are terminal', () => {
    expect(isTerminal('done')).toBe(true);
    expect(isTerminal('verified')).toBe(true);
  });

  it('blocked_external is terminal', () => {
    expect(isTerminal('blocked_external')).toBe(true);
  });

  it('non-terminal statuses return false', () => {
    // NEGATIVE: ensure running statuses do NOT trigger terminal
    expect(isTerminal('backlog')).toBe(false);
    expect(isTerminal('planning')).toBe(false);
    expect(isTerminal('plan_ready')).toBe(false);
    expect(isTerminal('implementing')).toBe(false);
    expect(isTerminal('review')).toBe(false);
  });
});

// ============================================================================
// Test 1: Events for OUR taskId → status transitions correctly + state-file appended
// ============================================================================
describe('Test 1 — events for our taskId resolve with correct status + state-file appended', () => {
  it('task:updated with our taskId reaching done → resolves success:true', async () => {
    // Source: aifWsStatus.ts awaitTaskDone — payload.id === taskId filter
    // + TERMINAL_SUCCESS_STATUSES.has('done') → success=true
    const taskId = 'task-abc-123';
    const sandbox = makeSandbox();
    const stateFile = join(sandbox, 'state.md');
    const { Ctor, ctrl } = makeFakeWebSocket();

    const p = awaitTaskDone({
      taskId,
      wsUrl: 'ws://localhost:3009/ws',
      stateFilePath: stateFile,
      WebSocketImpl: Ctor,
    });

    ctrl.triggerOpen();
    // Non-terminal event first — should not resolve
    ctrl.triggerMessage({ type: 'task:updated', payload: { id: taskId, title: 'T', status: 'implementing' } });
    // Terminal success event
    ctrl.triggerMessage({ type: 'task:updated', payload: { id: taskId, title: 'T', status: 'done' } });

    const result = await p;

    expect(result.success).toBe(true);
    expect(result.finalStatus).toBe('done');
    expect(result.completedAt).toBeTruthy();

    // State file must have been appended with both status lines
    const contents = readFileSync(stateFile, 'utf8');
    expect(contents).toContain('status=implementing');
    expect(contents).toContain('status=done');
    expect(contents).toContain(`taskId=${taskId}`);
  });

  it('task:updated with our taskId reaching verified → resolves success:true', async () => {
    const taskId = 'task-xyz-999';
    const { Ctor, ctrl } = makeFakeWebSocket();

    const p = awaitTaskDone({
      taskId,
      wsUrl: 'ws://localhost:3009/ws',
      WebSocketImpl: Ctor,
    });

    ctrl.triggerOpen();
    ctrl.triggerMessage({ type: 'task:updated', payload: { id: taskId, title: 'T', status: 'verified' } });

    const result = await p;
    expect(result.success).toBe(true);
    expect(result.finalStatus).toBe('verified');
  });
});

// ============================================================================
// Test 2: Events for OTHER taskIds → ignored (no state change)
// ============================================================================
describe('Test 2 — events for OTHER taskIds are ignored', () => {
  it('task:updated for a different taskId does not resolve our promise', async () => {
    // Source: aifWsStatus.ts — `if (payload.id !== taskId) return;`
    const ourTaskId = 'our-task-111';
    const otherTaskId = 'other-task-999';
    const sandbox = makeSandbox();
    const stateFile = join(sandbox, 'state.md');
    const { Ctor, ctrl } = makeFakeWebSocket();

    let resolved = false;
    const p = awaitTaskDone({
      taskId: ourTaskId,
      wsUrl: 'ws://localhost:3009/ws',
      stateFilePath: stateFile,
      timeoutMs: 200, // short timeout to make the test not hang
      WebSocketImpl: Ctor,
    });
    p.then(() => { resolved = true; }).catch(() => {});

    ctrl.triggerOpen();
    // Event for OTHER task — must be ignored
    ctrl.triggerMessage({ type: 'task:updated', payload: { id: otherTaskId, title: 'T', status: 'done' } });

    // After 50ms, the promise must NOT have resolved (other task ignored)
    await new Promise(r => setTimeout(r, 50));
    expect(resolved).toBe(false);

    // NEGATIVE: state file must NOT contain otherTaskId's status
    if (existsSync(stateFile)) {
      const contents = readFileSync(stateFile, 'utf8');
      expect(contents).not.toContain(`taskId=${otherTaskId}`);
    }

    // Let the timeout fire to clean up
    await p.catch(() => {});
  });

  it('non-task event types (e.g. chat:done) are ignored entirely', async () => {
    const taskId = 'our-task-222';
    const { Ctor, ctrl } = makeFakeWebSocket();

    let resolved = false;
    const p = awaitTaskDone({
      taskId,
      wsUrl: 'ws://localhost:3009/ws',
      timeoutMs: 150,
      WebSocketImpl: Ctor,
    });
    p.then(() => { resolved = true; }).catch(() => {});

    ctrl.triggerOpen();
    ctrl.triggerMessage({ type: 'chat:done', payload: { id: taskId, status: 'done' } });

    await new Promise(r => setTimeout(r, 50));
    expect(resolved).toBe(false);

    await p.catch(() => {}); // let timeout fire
  });
});

// ============================================================================
// Test 3: WS disconnect mid-task → rejects with BackendError code 'unavailable'
// ============================================================================
describe('Test 3 — WS disconnect mid-task → BackendError unavailable (bridge discipline)', () => {
  it('disconnect after 0 remaining retries → rejects with BackendError unavailable', async () => {
    // Source: aifWsStatus.ts onclose handler — after maxReconnectAttempts exhausted
    // This is the bridge-discipline test per kickoff §3 SW-C item 7.
    const taskId = 'task-drop-333';
    const { Ctor, ctrl } = makeFakeWebSocket();

    const p = awaitTaskDone({
      taskId,
      wsUrl: 'ws://localhost:3009/ws',
      maxReconnectAttempts: 0, // exhaust immediately on first close
      WebSocketImpl: Ctor,
    });

    ctrl.triggerOpen();
    // Simulate WS drop mid-task (no terminal status received)
    ctrl.triggerClose();

    await expect(p).rejects.toSatisfy((err: unknown) => {
      return err instanceof BackendError &&
        err.code === 'unavailable' &&
        err.backend === 'aif-handoff';
    });
  });

  it('disconnect with stateFilePath set → state.md NOTES the disconnection (not a silent drop)', async () => {
    // Source: aifWsStatus.ts onclose handler — appendStateLine('event=ws_disconnected …')
    // Kickoff §3 SW-C item 5: "aif-handoff disconnect → state.md notes the disconnection
    // AND awaitDone returns a graceful error (NOT silent drop)". Asserts BOTH halves.
    const taskId = 'task-drop-state-333b';
    const sandbox = makeSandbox();
    const stateFile = join(sandbox, 'state.md');
    const { Ctor, ctrl } = makeFakeWebSocket();

    const p = awaitTaskDone({
      taskId,
      wsUrl: 'ws://localhost:3009/ws',
      stateFilePath: stateFile,
      maxReconnectAttempts: 0, // exhaust immediately → terminal disconnect note
      WebSocketImpl: Ctor,
    });

    ctrl.triggerOpen();
    ctrl.triggerClose();

    // Half 1: graceful error (not silent resolve)
    await expect(p).rejects.toSatisfy((err: unknown) =>
      err instanceof BackendError && err.code === 'unavailable',
    );

    // Half 2: state.md records the disconnection event
    const contents = readFileSync(stateFile, 'utf8');
    expect(contents).toContain('event=ws_disconnected');
    expect(contents).toContain(`taskId=${taskId}`);
    expect(contents).toContain('terminal=true');
  });

  it('NEGATIVE: a clean done does NOT write a ws_disconnected event to state.md', async () => {
    // Guards against the disconnect note firing on the happy path.
    const taskId = 'task-clean-state-333c';
    const sandbox = makeSandbox();
    const stateFile = join(sandbox, 'state.md');
    const { Ctor, ctrl } = makeFakeWebSocket();

    const p = awaitTaskDone({
      taskId,
      wsUrl: 'ws://localhost:3009/ws',
      stateFilePath: stateFile,
      WebSocketImpl: Ctor,
    });

    ctrl.triggerOpen();
    ctrl.triggerMessage({ type: 'task:updated', payload: { id: taskId, title: 'T', status: 'done' } });
    await p;

    const contents = readFileSync(stateFile, 'utf8');
    expect(contents).toContain('status=done');
    expect(contents).not.toContain('ws_disconnected'); // Must NOT spuriously note a disconnect
  });

  it('AifHandoffBackend.awaitDone surfaces WS drop as BackendError unavailable (integration)', async () => {
    // Source: AifHandoffBackend.ts awaitDone -> awaitTaskDone -> onclose -> fail(BackendError)
    // Bridge-discipline test: the BackendError must propagate through AifHandoffBackend.awaitDone.
    const { AifHandoffBackend } = await import('../src/AifHandoffBackend.js');
    const { Ctor, ctrl } = makeFakeWebSocket();

    const backend = new AifHandoffBackend({
      baseUrl: 'http://localhost:3009',
      projectId: 'proj-123',
      WebSocketImpl: Ctor,
    });

    const handle = { backend: 'aif-handoff' as const, taskId: 'task-drop-444', dispatchedAt: new Date().toISOString() };

    const p = backend.awaitDone(handle);

    ctrl.triggerOpen();
    ctrl.triggerClose(); // exhaust 3 retries (each reconnect triggers close immediately)
    // maxReconnectAttempts defaults to 3; need to trigger close 4 times total
    // (1 initial + 3 reconnects, each one closes immediately)
    ctrl.triggerClose();
    ctrl.triggerClose();
    ctrl.triggerClose();

    await expect(p).rejects.toSatisfy((err: unknown) => {
      return err instanceof BackendError &&
        err.code === 'unavailable' &&
        err.backend === 'aif-handoff';
    });
  });

  it('NEGATIVE: WS drop does NOT result in a silent resolution (not success:true)', async () => {
    // Verify the drop path throws, not silently resolves success
    const taskId = 'task-drop-neg-555';
    const { Ctor, ctrl } = makeFakeWebSocket();

    const p = awaitTaskDone({
      taskId,
      wsUrl: 'ws://localhost:3009/ws',
      maxReconnectAttempts: 0,
      WebSocketImpl: Ctor,
    });

    ctrl.triggerOpen();
    ctrl.triggerClose();

    let didResolve = false;
    await p.then(() => { didResolve = true; }).catch(() => {});
    expect(didResolve).toBe(false); // Must NOT have resolved
  });
});

// ============================================================================
// Test 4: State-file unset → clean no-op (no crash)
// ============================================================================
describe('Test 4 — stateFilePath unset → clean no-op', () => {
  it('awaitTaskDone without stateFilePath does not crash on status events', async () => {
    // Source: aifWsStatus.ts appendStateFile — `if (!stateFilePath) return;`
    const taskId = 'task-nofile-666';
    const { Ctor, ctrl } = makeFakeWebSocket();

    const p = awaitTaskDone({
      taskId,
      wsUrl: 'ws://localhost:3009/ws',
      // stateFilePath intentionally omitted
      WebSocketImpl: Ctor,
    });

    ctrl.triggerOpen();
    ctrl.triggerMessage({ type: 'task:updated', payload: { id: taskId, title: 'T', status: 'done' } });

    // Must resolve cleanly with no errors
    await expect(p).resolves.toMatchObject({ success: true, finalStatus: 'done' });
  });
});

// ============================================================================
// Test 5: blocked_external → resolves { success: false } (not throw)
// ============================================================================
describe('Test 5 — blocked_external resolves success:false (not throw)', () => {
  it('blocked_external → awaitTaskDone resolves with success:false', async () => {
    // Source: aifWsStatus.ts — TERMINAL_FAILURE_STATUSES.has('blocked_external')
    // Per kickoff §3 SW-C item 4: blocked_external must RESOLVE (not hang, not throw)
    const taskId = 'task-blocked-777';
    const { Ctor, ctrl } = makeFakeWebSocket();

    const p = awaitTaskDone({
      taskId,
      wsUrl: 'ws://localhost:3009/ws',
      WebSocketImpl: Ctor,
    });

    ctrl.triggerOpen();
    ctrl.triggerMessage({ type: 'task:updated', payload: { id: taskId, title: 'T', status: 'blocked_external' } });

    const result = await p;
    expect(result.success).toBe(false);
    expect(result.finalStatus).toBe('blocked_external');
  });

  it('NEGATIVE: blocked_external does NOT result in success:true', async () => {
    const taskId = 'task-blocked-neg-888';
    const { Ctor, ctrl } = makeFakeWebSocket();

    const p = awaitTaskDone({
      taskId,
      wsUrl: 'ws://localhost:3009/ws',
      WebSocketImpl: Ctor,
    });

    ctrl.triggerOpen();
    ctrl.triggerMessage({ type: 'task:updated', payload: { id: taskId, title: 'T', status: 'blocked_external' } });

    const result = await p;
    expect(result.success).not.toBe(true); // Must be false, not true
  });
});

// ============================================================================
// Test 6: getStatus REST snapshot
// ============================================================================
describe('Test 6 — getTaskStatus: REST GET /tasks/:id snapshot', () => {
  it('200 response with status field → returns mapped status', async () => {
    // Source: aifWsStatus.ts getTaskStatus -> fetch GET /tasks/:id
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'task-get-001', status: 'implementing' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await getTaskStatus('task-get-001', 'http://localhost:3009');

    expect(result.rawStatus).toBe('implementing');
    expect(result.checkedAt).toBeTruthy();
    // Verify correct endpoint was called
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3009/tasks/task-get-001',
      expect.objectContaining({ method: 'GET' }),
    );

    fetchSpy.mockRestore();
  });

  it('NEGATIVE: getTaskStatus does NOT return a stale rawStatus on 200', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'task-get-002', status: 'done' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await getTaskStatus('task-get-002', 'http://localhost:3009');
    expect(result.rawStatus).not.toBe('pending'); // Must reflect actual status, not placeholder

    fetchSpy.mockRestore();
  });
});

// ============================================================================
// Test 7: getStatus throws BackendError on 404
// ============================================================================
describe('Test 7 — getTaskStatus: 404 throws BackendError unavailable', () => {
  it('404 response → throws BackendError with code unavailable', async () => {
    // Source: aifWsStatus.ts getTaskStatus — `if (res.status === 404)` branch
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Task not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(getTaskStatus('nonexistent-task', 'http://localhost:3009')).rejects.toSatisfy(
      (err: unknown) => {
        return err instanceof BackendError && err.code === 'unavailable';
      },
    );

    fetchSpy.mockRestore();
  });

  // R-7: getTaskStatus hand-wrote its own mapping and simply had no 429 branch, so an
  // aif under rate-limit surfaced as dispatch_failed — the environmental-vs-quota
  // distinction the CLIs act on. Sharing cli/aifHttp.ts request() closes it.
  it('429 response → quota_exceeded (was dispatch_failed: the missing branch)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('slow down', { status: 429 }));

    await expect(getTaskStatus('rate-limited', 'http://localhost:3009')).rejects.toMatchObject({
      code: 'quota_exceeded',
    });

    fetchSpy.mockRestore();
  });

  it('NEGATIVE: 404 does NOT silently return rawStatus="unknown"', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not found', { status: 404 }),
    );

    let didResolve = false;
    await getTaskStatus('gone-task', 'http://localhost:3009')
      .then(() => { didResolve = true; })
      .catch(() => {});

    expect(didResolve).toBe(false); // Must reject, not silently resolve

    fetchSpy.mockRestore();
  });
});
