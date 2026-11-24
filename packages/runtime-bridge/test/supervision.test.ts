import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { OPEN_QUESTION_ANCHOR } from '../src/cli/openQuestion.js';
import {
  claimEvent,
  compactSnapshot,
  recordEvent,
  snapshotSupervision,
} from '../src/cli/supervision.js';

const roots: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise<void>((resolve) => {
          s.closeAllConnections();
          s.close(() => resolve());
        }),
    ),
  );
  await Promise.all(
    roots.splice(0).map((p) => rm(p, { recursive: true, force: true })),
  );
});

async function setup(
  receipt: Record<string, unknown> | null,
  task?: Record<string, unknown> | number,
) {
  const root = await mkdtemp(join(tmpdir(), 'supervision-'));
  roots.push(root);
  await mkdir(join(root, 'owners'));
  const threadId = 'owner-1';
  const inventoryPath = join(root, 'state.json');
  const statePath = join(root, 'observation-state.json');
  await writeFile(
    inventoryPath,
    JSON.stringify({ owners: [{ key: 'work', threadId, hostId: 'local' }] }),
  );
  if (receipt)
    await writeFile(
      join(root, 'owners', `${threadId}.json`),
      JSON.stringify(receipt),
    );
  const methods: string[] = [];
  const server = createServer((req, res) => {
    methods.push(`${req.method} ${req.url}`);
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = typeof task === 'number' ? task : 200;
    res.end(
      JSON.stringify(typeof task === 'number' ? { error: 'fixture' } : task),
    );
  });
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('listener missing');
  return {
    inventoryPath,
    statePath,
    aifUrl: `http://127.0.0.1:${address.port}`,
    methods,
  };
}

const running = {
  id: 'task-1',
  title: 'Task',
  status: 'implementing',
  updatedAt: '2026-10-11T15:00:00Z',
};
const receipt = {
  threadId: 'owner-1',
  aif_task_id: 'task-1',
  execution_session_id: 'glm-1',
  stage: 'Implementing',
  next_action: 'Wait for AIF result',
  last_progress_time: '2026-10-11T14:59:00Z',
};
const now = new Date('2026-10-11T15:04:00Z');

describe('compact supervision', () => {
  it('keeps actionable unchanged events visible without repeating unchanged owner detail', async () => {
    const fixture = await setup(receipt, { ...running, status: 'done' });
    await snapshotSupervision({ ...fixture, now });
    const compact = compactSnapshot(
      await snapshotSupervision({ ...fixture, now }),
    );
    expect(compact.changedOwners).toEqual([]);
    expect(compact.events).toEqual([
      expect.objectContaining({ action: 'accept_result', sourceId: 'task-1' }),
    ]);
    expect(compact.coverage.owners).toBe(1);
  });

  it('keeps a healthy long AIF wait quiet and reads only the bound task', async () => {
    const fixture = await setup(receipt, running);
    const snap = await snapshotSupervision({ ...fixture, now });
    expect(snap.owners[0]).toMatchObject({
      key: 'work',
      phase: 'waiting',
      taskIds: ['task-1'],
      sessionIds: ['glm-1'],
      lastProgressAt: '2026-10-11T14:59:00Z',
    });
    expect(snap.owners[0].receiptModifiedAt).toEqual(expect.any(String));
    expect(snap.events).toHaveLength(0);
    expect(fixture.methods).toEqual(['GET /tasks/task-1']);
  });

  it('routes paused question anchors before optimistic completion', async () => {
    const fixture = await setup(receipt, {
      ...running,
      status: 'done',
      paused: true,
      plan: `${OPEN_QUESTION_ANCHOR}\nChoose A or B`,
    });
    const snap = await snapshotSupervision({ ...fixture, now });
    expect(snap.events[0]).toMatchObject({
      action: 'resolve_park',
      ownerThreadId: 'owner-1',
      sourceId: 'task-1',
    });
    expect(snap.owners[0].phase).toBe('parked');
  });

  it('asks for pause ownership when there is no parked question', async () => {
    const fixture = await setup(receipt, { ...running, paused: true });
    const snap = await snapshotSupervision({ ...fixture, now });
    expect(snap.events[0].action).toBe('inspect_pause');
  });

  it('routes result readiness to the umbrella owner without accepting it', async () => {
    const fixture = await setup(receipt, { ...running, status: 'verified' });
    const snap = await snapshotSupervision({ ...fixture, now });
    expect(snap.events[0].action).toBe('accept_result');
    expect(snap.owners[0].phase).toBe('result_ready');
  });

  it('requires per-task acceptance evidence even when owner prose mentions CI', async () => {
    const fixture = await setup(
      { ...receipt, next_action: 'Required CI green, then merge review' },
      { ...running, status: 'verified' },
    );
    const snap = await snapshotSupervision({ ...fixture, now });
    expect(snap.events[0].action).toBe('accept_result');
    const accepted = await setup(
      {
        ...receipt,
        next_action: 'Required CI green',
        acceptedTaskIds: ['task-1'],
      },
      { ...running, status: 'verified' },
    );
    expect(
      (await snapshotSupervision({ ...accepted, now })).events,
    ).toHaveLength(0);
  });

  it('shows a dead GLM claim with a surviving AIF task as a reconciliation, not redispatch', async () => {
    const fixture = await setup(
      { ...receipt, executionState: 'ceased' },
      running,
    );
    const snap = await snapshotSupervision({ ...fixture, now });
    expect(snap.events[0].action).toBe('reconcile_delivery_owner');
    expect(snap.events[0].sourceId).toBe('glm-1');
    expect(snap.owners[0].taskIds).toEqual(['task-1']);
  });

  it('reports missing receipt and failed source reads as unknown', async () => {
    const missing = await setup(null);
    expect(
      (await snapshotSupervision({ ...missing, now })).owners[0].phase,
    ).toBe('unknown');
    const down = await setup(receipt, 503);
    const snap = await snapshotSupervision({ ...down, now });
    expect(snap.owners[0].phase).toBe('unknown');
    expect(snap.events[0].action).toBe('diagnose_source');
  });

  it('does not call an unfamiliar AIF status healthy waiting', async () => {
    const fixture = await setup(receipt, {
      ...running,
      status: 'future_status',
    });
    const snap = await snapshotSupervision({ ...fixture, now });
    expect(snap.owners[0].phase).toBe('unknown');
    expect(snap.events[0].action).toBe('diagnose_source');
  });

  it('does not turn an acknowledged quota or advisor wait into a restart', async () => {
    const fixture = await setup({
      ...receipt,
      aif_task_id: undefined,
      executionState: 'quota_wait',
      next_action: 'Await advisor and quota reset',
    });
    const snap = await snapshotSupervision({ ...fixture, now });
    expect(snap.events).toHaveLength(0);
    expect(snap.owners[0].phase).toBe('dependency_wait');
  });

  it('carries process identity evidence without declaring PID liveness', async () => {
    const fixture = await setup(
      {
        ...receipt,
        worker_pid: 1234,
        boot_id: 'boot-1',
        worker_started_at: '2026-10-11T14:00:00Z',
      },
      running,
    );
    const snap = await snapshotSupervision({ ...fixture, now });
    expect(snap.owners[0].processIdentity).toEqual({
      pid: 1234,
      bootId: 'boot-1',
      startedAt: '2026-10-11T14:00:00Z',
    });
    expect(snap.events).toHaveLength(0);
  });

  it('uses an explicit checkpoint deadline, not elapsed silence, to flag an overdue wait', async () => {
    const later = await setup(
      { ...receipt, expectedCheckpointAt: '2026-10-11T16:00:00Z' },
      running,
    );
    expect((await snapshotSupervision({ ...later, now })).events).toHaveLength(
      0,
    );
    const overdue = await setup(
      { ...receipt, expectedCheckpointAt: '2026-10-11T15:00:00Z' },
      running,
    );
    const snap = await snapshotSupervision({ ...overdue, now });
    expect(snap.events[0]).toMatchObject({
      action: 'diagnose_checkpoint',
      sourceId: 'glm-1',
    });
  });
});

describe('one durable intervention disposition for native event and sweep', () => {
  it('permits only one of simultaneous claims and retains an uncertain send after restart', async () => {
    const fixture = await setup(receipt, { ...running, status: 'done' });
    const event = (await snapshotSupervision({ ...fixture, now })).events[0];
    const claims = await Promise.all([
      claimEvent(fixture.statePath, event),
      claimEvent(fixture.statePath, event),
    ]);
    expect(claims.filter((c) => c.claimed)).toHaveLength(1);
    const token = claims.find((c) => c.claimed)!.claimToken!;
    await recordEvent(
      fixture.statePath,
      event.key,
      token,
      'uncertain',
      'queue outcome unknown',
    );
    const restart = await snapshotSupervision({ ...fixture, now });
    expect(restart.events[0].disposition).toBe('uncertain');
    expect(
      (await claimEvent(fixture.statePath, restart.events[0])).claimed,
    ).toBe(false);
  });

  it('requires the original claim token and concrete receipt for sent/acknowledged transitions', async () => {
    const fixture = await setup(receipt, { ...running, status: 'done' });
    const event = (await snapshotSupervision({ ...fixture, now })).events[0];
    const claim = await claimEvent(fixture.statePath, event);
    await expect(
      recordEvent(fixture.statePath, event.key, 'wrong', 'sent', 'message-id'),
    ).rejects.toThrow();
    await expect(
      recordEvent(fixture.statePath, event.key, claim.claimToken!, 'sent', ''),
    ).rejects.toThrow();
    await recordEvent(
      fixture.statePath,
      event.key,
      claim.claimToken!,
      'sent',
      'message-id',
    );
    expect(
      (await snapshotSupervision({ ...fixture, now })).events[0].disposition,
    ).toBe('sent');
  });

  it('rejects a supplied key that does not match the source and action identity', async () => {
    const fixture = await setup(receipt, { ...running, status: 'done' });
    const event = (await snapshotSupervision({ ...fixture, now })).events[0];
    await expect(
      claimEvent(fixture.statePath, { ...event, key: 'forged' }),
    ).rejects.toThrow('event key');
  });

  it('blocks a changed revision while an uncertain intervention for the same action remains', async () => {
    const fixture = await setup(receipt, { ...running, status: 'done' });
    const first = (await snapshotSupervision({ ...fixture, now })).events[0];
    const claimed = await claimEvent(fixture.statePath, first);
    await recordEvent(
      fixture.statePath,
      first.key,
      claimed.claimToken!,
      'uncertain',
      'queue outcome unknown',
    );
    const changed = { ...first, revision: 'new-updatedAt', key: '' };
    changed.key = createHash('sha256')
      .update(
        JSON.stringify([
          changed.ownerKey,
          changed.sourceId,
          changed.revision,
          changed.action,
        ]),
      )
      .digest('hex');
    expect((await claimEvent(fixture.statePath, changed)).claimed).toBe(false);
    const newAction = { ...changed, action: 'inspect_pause' as const };
    newAction.key = createHash('sha256')
      .update(
        JSON.stringify([
          newAction.ownerKey,
          newAction.sourceId,
          newAction.revision,
          newAction.action,
        ]),
      )
      .digest('hex');
    expect((await claimEvent(fixture.statePath, newAction)).claimed).toBe(
      false,
    );
  });

  it('surfaces an unfinished intervention after its source becomes unavailable', async () => {
    const fixture = await setup(receipt, { ...running, status: 'done' });
    const first = (await snapshotSupervision({ ...fixture, now })).events[0];
    const claimed = await claimEvent(fixture.statePath, first);
    await recordEvent(
      fixture.statePath,
      first.key,
      claimed.claimToken!,
      'uncertain',
      'queue outcome unknown',
    );
    const restart = await snapshotSupervision({
      ...fixture,
      aifUrl: 'http://127.0.0.1:1',
      timeoutMs: 50,
      now,
    });
    expect(restart.owners[0].phase).toBe('unknown');
    expect(restart.interventions).toEqual([
      expect.objectContaining({
        event: expect.objectContaining({ key: first.key }),
        status: 'uncertain',
        receipt: 'queue outcome unknown',
        claimToken: claimed.claimToken,
        claimedAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
    ]);
  });

  it('marks an intervention disposition change as an owner delta', async () => {
    const fixture = await setup(receipt, { ...running, status: 'done' });
    const first = await snapshotSupervision({ ...fixture, now });
    expect(
      (await snapshotSupervision({ ...fixture, now })).owners[0].changed,
    ).toBe(false);
    await claimEvent(fixture.statePath, first.events[0]);
    expect(
      (await snapshotSupervision({ ...fixture, now })).owners[0].changed,
    ).toBe(true);
  });
});
