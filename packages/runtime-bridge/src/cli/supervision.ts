/** Bounded, mechanical observation of existing umbrella owners and their named AIF tasks.
 * This command never sends a message or changes a worker. Both a native notification and
 * the scheduled observer must claim the same event here before intervening.
 * Usage:
 *   tsx src/cli/supervision.ts snapshot --inventory <state.json> --state <observation-state.json>
 *   tsx src/cli/supervision.ts claim --state <path> --event-json '<snapshot event JSON>'
 *   tsx src/cli/supervision.ts record --state <path> --key <key> --token <claimToken>
 *       --status sent|uncertain|acknowledged|resolved --receipt <message/evidence locator>
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  rmdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { isMain, parseCliArgs, CliArgError } from './cliEntry.js';
import { getJson, type AifTaskFull } from './aifHttp.js';
import { isParked } from './questions.js';

type Json = Record<string, unknown>;
type Disposition =
  'pending' | 'sent' | 'uncertain' | 'acknowledged' | 'resolved';
type Action =
  | 'resolve_park'
  | 'inspect_pause'
  | 'accept_result'
  | 'reconcile_delivery_owner'
  | 'diagnose_source'
  | 'diagnose_checkpoint';
export interface Event {
  key: string;
  ownerKey: string;
  ownerThreadId: string;
  sourceId: string;
  revision: string;
  action: Action;
  reason: string;
  disposition?: Disposition;
}
export interface OwnerObservation {
  key: string;
  threadId: string;
  phase: 'waiting' | 'parked' | 'result_ready' | 'dependency_wait' | 'unknown';
  expectedEvent?: string;
  checkpointDueAt?: string;
  receiptPath: string;
  receiptFreshness: 'current' | 'stale' | 'missing';
  receiptModifiedAt?: string;
  lastProgressAt?: string;
  taskIds: string[];
  sessionIds: string[];
  processIdentity?: { pid?: number; bootId?: string; startedAt?: string };
  sourceFailures: string[];
  changed: boolean;
}
export interface Snapshot {
  observedAt: string;
  inventoryPath: string;
  owners: OwnerObservation[];
  events: Event[];
  interventions: EventRecord[];
  coverage: {
    owners: number;
    withReceipt: number;
    withTaskBinding: number;
    unknown: number;
    truncatedTasks: number;
  };
}
export function compactSnapshot(snapshot: Snapshot) {
  const changedOwners = snapshot.owners.filter((owner) => owner.changed);
  const changedKeys = new Set(changedOwners.map((owner) => owner.key));
  return {
    observedAt: snapshot.observedAt,
    coverage: snapshot.coverage,
    changedOwners: changedOwners.map((owner) => ({
      key: owner.key,
      phase: owner.phase,
      sourceFailures: owner.sourceFailures,
    })),
    unknownOwners: snapshot.owners
      .filter((owner) => owner.phase === 'unknown')
      .map((owner) => owner.key),
    events: snapshot.events.filter(
      (item) =>
        item.action !== 'diagnose_source' || changedKeys.has(item.ownerKey),
    ),
    interventions: snapshot.interventions,
  };
}
interface EventRecord {
  event: Event;
  status: Disposition;
  claimToken: string;
  claimedAt: string;
  updatedAt: string;
  receipt?: string;
}
interface State {
  version: 1;
  cursor: Record<string, string>;
  events: Record<string, EventRecord>;
}
const emptyState = (): State => ({ version: 1, cursor: {}, events: {} });
const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;
const obj = (v: unknown): Json =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {};
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter((x): x is string => !!x) : [];
const hash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const first = (...values: unknown[]): string | undefined =>
  values.map(str).find((x) => x !== undefined);

async function loadState(path: string): Promise<State> {
  try {
    const data = JSON.parse(await readFile(path, 'utf8')) as Partial<State>;
    if (data.version !== 1 || !data.cursor || !data.events)
      throw new Error('invalid observation state');
    return data as State;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return emptyState();
    throw err;
  }
}

/** Exclusive directory lock: a crashed writer fails closed and needs explicit reconciliation. */
async function updateState<T>(
  path: string,
  fn: (state: State) => T,
): Promise<T> {
  const lock = `${path}.lock`;
  let acquired = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await mkdir(lock);
      acquired = true;
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      await delay(50);
    }
  }
  if (!acquired)
    throw new Error(`observation state busy; inspect stale lock: ${lock}`);
  try {
    const state = await loadState(path);
    const result = fn(state);
    const tmp = `${path}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(state) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    await rename(tmp, path);
    return result;
  } finally {
    await rmdir(lock);
  }
}

function taskIds(receipt: Json): string[] {
  const ids = [
    ...strings(receipt.executionTaskIds),
    ...strings(receipt.taskIds),
    ...strings(receipt.factory_task_ids),
    first(
      receipt.aif_task_id,
      receipt.executionTaskId,
      obj(receipt.task).id,
      obj(receipt.actualExecutionIdentities).aifTaskId,
    ),
  ].filter((x): x is string => !!x);
  return [...new Set(ids)];
}

function sessionIds(receipt: Json): string[] {
  const ids = [
    ...strings(receipt.executionSessionIds),
    first(
      receipt.execution_session_id,
      receipt.executionSessionId,
      obj(receipt.executionOwner).sessionId,
      obj(receipt.actualExecutionIdentities).glmSessionId,
    ),
  ].filter((x): x is string => !!x);
  return [...new Set(ids)];
}

function event(
  ownerKey: string,
  ownerThreadId: string,
  sourceId: string,
  revision: string,
  action: Action,
  reason: string,
): Event {
  return {
    key: hash([ownerKey, sourceId, revision, action]),
    ownerKey,
    ownerThreadId,
    sourceId,
    revision,
    action,
    reason,
  };
}

export async function snapshotSupervision(options: {
  inventoryPath: string;
  statePath: string;
  aifUrl?: string;
  now?: Date;
  timeoutMs?: number;
}): Promise<Snapshot> {
  const {
    inventoryPath,
    statePath,
    aifUrl = 'http://localhost:3009',
    now = new Date(),
    timeoutMs = 4000,
  } = options;
  const inventory = obj(JSON.parse(await readFile(inventoryPath, 'utf8')));
  if (!Array.isArray(inventory.owners))
    throw new Error('inventory.owners must be an array');
  const owners: OwnerObservation[] = [];
  const events: Event[] = [];
  let tasksRead = 0;
  let truncatedTasks = 0;

  for (const raw of inventory.owners) {
    const row = obj(raw);
    const key = str(row.key);
    const threadId = str(row.threadId);
    if (!key || !threadId) throw new Error('owner row missing key/threadId');
    const receiptPath = join(
      dirname(inventoryPath),
      'owners',
      `${threadId}.json`,
    );
    let receipt: Json = {};
    let freshness: OwnerObservation['receiptFreshness'] = 'missing';
    let receiptModifiedAt: string | undefined;
    const failures: string[] = [];
    try {
      receipt = obj(JSON.parse(await readFile(receiptPath, 'utf8')));
      const fileStat = await stat(receiptPath);
      receiptModifiedAt = fileStat.mtime.toISOString();
      freshness =
        now.getTime() - fileStat.mtimeMs > 90 * 60_000 ? 'stale' : 'current';
    } catch (err) {
      failures.push(
        `receipt:${(err as NodeJS.ErrnoException).code ?? 'invalid'}`,
      );
    }
    const boundTasks = taskIds(receipt);
    const boundSessions = sessionIds(receipt);
    const pidValue = receipt.worker_pid ?? receipt.executionPid;
    const pid =
      typeof pidValue === 'number' &&
      Number.isSafeInteger(pidValue) &&
      pidValue > 0
        ? pidValue
        : undefined;
    const bootId = first(receipt.boot_id, receipt.bootId);
    const startedAt = first(
      receipt.worker_started_at,
      receipt.executionStartedAt,
    );
    const processIdentity =
      pid || bootId || startedAt ? { pid, bootId, startedAt } : undefined;
    const expectedEvent = first(
      receipt.nextReadyCondition,
      receipt.next_ready_condition,
      receipt.nextAction,
      receipt.next_action,
    )?.slice(0, 180);
    const checkpointDueAt = first(
      receipt.expectedCheckpointAt,
      receipt.expected_checkpoint_at,
      receipt.nextCheckAt,
      receipt.next_check_at,
    );
    const observation: OwnerObservation = {
      key,
      threadId,
      phase: 'unknown',
      expectedEvent,
      checkpointDueAt,
      receiptPath,
      receiptFreshness: freshness,
      receiptModifiedAt,
      lastProgressAt: first(
        receipt.lastProgressTime,
        receipt.last_progress_time,
        receipt.lastProgressAt,
        receipt.lastProgressAtUtc,
      ),
      taskIds: boundTasks,
      sessionIds: boundSessions,
      processIdentity,
      sourceFailures: failures,
      changed: false,
    };
    owners.push(observation);

    const declaredState =
      first(
        receipt.executionState,
        obj(receipt.executionOwner).actualState,
      )?.toLowerCase() ?? '';
    const waitingOnDependency =
      /quota|advisor|review|prerequisite|checkpoint|await/i.test(
        `${declaredState} ${expectedEvent ?? ''} ${first(receipt.blocker, receipt.concrete_blocker) ?? ''}`,
      );
    const acceptedTaskIds = new Set(strings(receipt.acceptedTaskIds));
    if (freshness === 'missing') {
      events.push(
        event(
          key,
          threadId,
          threadId,
          'missing-receipt',
          'diagnose_source',
          'owner receipt missing',
        ),
      );
      continue;
    }
    const taskStates: Array<{ id: string; task?: AifTaskFull & Json }> = [];
    for (const id of boundTasks) {
      if (tasksRead >= 24) {
        truncatedTasks++;
        failures.push('task_limit');
        continue;
      }
      tasksRead++;
      try {
        const task = obj(
          await getJson(aifUrl, `/tasks/${encodeURIComponent(id)}`, {
            timeoutMs,
          }),
        );
        if (
          task.id !== id ||
          typeof task.status !== 'string' ||
          typeof task.title !== 'string'
        ) {
          failures.push(`task:${id}:invalid_response`);
        } else if (
          ![
            'backlog',
            'planning',
            'plan_ready',
            'implementing',
            'review',
            'done',
            'verified',
            'blocked_external',
          ].includes(task.status)
        ) {
          failures.push(
            `task:${id}:unknown_status:${task.status.slice(0, 40)}`,
          );
        } else taskStates.push({ id, task: task as AifTaskFull & Json });
      } catch (err) {
        failures.push(`task:${id}:${str(obj(err).code) ?? 'unavailable'}`);
      }
    }
    if (freshness === 'stale') failures.push('receipt:stale');
    if (failures.length) {
      events.push(
        event(
          key,
          threadId,
          boundTasks[0] ?? threadId,
          hash(failures),
          'diagnose_source',
          failures.join(',').slice(0, 180),
        ),
      );
      observation.phase = 'unknown';
    } else if (taskStates.some(({ task }) => task && isParked(task as Parameters<typeof isParked>[0]))) {
      observation.phase = 'parked';
    } else if (taskStates.some(({ task }) => task?.paused === true)) {
      observation.phase = 'parked';
    } else if (
      taskStates.some(
        ({ id, task }) =>
          (task?.status === 'done' || task?.status === 'verified') &&
          !acceptedTaskIds.has(id),
      )
    ) {
      observation.phase = 'result_ready';
    } else if (waitingOnDependency && taskStates.length === 0) {
      observation.phase = 'dependency_wait';
    } else if (taskStates.length > 0) {
      observation.phase = 'waiting';
    }

    for (const { id, task } of taskStates) {
      if (!task || failures.length) continue;
      const revision =
        first(task.updatedAt, task.updated_at) ??
        hash([
          task.status,
          task.paused,
          task.manualReviewRequired,
          task.blockedReason,
          task.plan,
        ]);
      if (isParked(task as Parameters<typeof isParked>[0])) {
        events.push(
          event(
            key,
            threadId,
            id,
            revision,
            'resolve_park',
            'AIF task parked or paused',
          ),
        );
      } else if (task.paused === true) {
        events.push(
          event(
            key,
            threadId,
            id,
            revision,
            'inspect_pause',
            'AIF task paused without an open question; inspect pause owner',
          ),
        );
      } else if (
        (task.status === 'done' || task.status === 'verified') &&
        !acceptedTaskIds.has(id)
      ) {
        events.push(
          event(
            key,
            threadId,
            id,
            revision,
            'accept_result',
            'AIF result needs owner acceptance',
          ),
        );
      }
    }
    if (
      declaredState.includes('ceased') &&
      boundSessions.length &&
      taskStates.some(
        ({ task }) => task && !['done', 'verified'].includes(task.status),
      )
    ) {
      events.push(
        event(
          key,
          threadId,
          boundSessions[0],
          hash([declaredState, boundTasks]),
          'reconcile_delivery_owner',
          'receipt reports ceased GLM while named AIF task remains active; verify exact identity',
        ),
      );
    }
    const dueMs = checkpointDueAt ? Date.parse(checkpointDueAt) : NaN;
    const latestTaskUpdateMs = Math.max(
      0,
      ...taskStates.map(({ task }) => {
        const time = first(task?.updatedAt, task?.updated_at);
        return time ? Date.parse(time) || 0 : 0;
      }),
    );
    if (
      observation.phase === 'waiting' &&
      Number.isFinite(dueMs) &&
      now.getTime() > dueMs &&
      latestTaskUpdateMs <= dueMs
    ) {
      events.push(
        event(
          key,
          threadId,
          boundSessions[0] ?? boundTasks[0],
          checkpointDueAt!,
          'diagnose_checkpoint',
          'explicit checkpoint overdue; request bounded diagnosis',
        ),
      );
    }
    if (
      observation.phase === 'unknown' &&
      !failures.length &&
      !waitingOnDependency
    ) {
      events.push(
        event(
          key,
          threadId,
          threadId,
          hash([freshness, expectedEvent]),
          'diagnose_checkpoint',
          'no verifiable downstream binding or expected wait',
        ),
      );
    }
  }

  await updateState(statePath, (next) => {
    for (const owner of owners) {
      const fingerprint = hash([
        owner.phase,
        owner.receiptFreshness,
        owner.taskIds,
        owner.sessionIds,
        owner.sourceFailures,
        events.filter((e) => e.ownerKey === owner.key).map((e) => e.key),
        Object.values(next.events)
          .filter(
            (record) =>
              record.status !== 'resolved' &&
              record.event.ownerKey === owner.key,
          )
          .map((record) => [record.event.key, record.status, record.updatedAt]),
      ]);
      owner.changed = next.cursor[owner.key] !== fingerprint;
      next.cursor[owner.key] = fingerprint;
    }
  });
  const currentState = await loadState(statePath);
  for (const item of events)
    item.disposition = currentState.events[item.key]?.status;
  const interventions = Object.values(currentState.events).filter(
    (record) => record.status !== 'resolved',
  );
  return {
    observedAt: now.toISOString(),
    inventoryPath,
    owners,
    events,
    interventions,
    coverage: {
      owners: owners.length,
      withReceipt: owners.filter((o) => o.receiptFreshness !== 'missing')
        .length,
      withTaskBinding: owners.filter((o) => o.taskIds.length > 0).length,
      unknown: owners.filter((o) => o.phase === 'unknown').length,
      truncatedTasks,
    },
  };
}

export async function claimEvent(
  statePath: string,
  item: Event,
): Promise<{
  claimed: boolean;
  claimToken?: string;
  disposition: Disposition;
}> {
  if (
    item.key !==
    hash([item.ownerKey, item.sourceId, item.revision, item.action])
  ) {
    throw new Error('event key does not match owner/source/revision/action');
  }
  return updateState(statePath, (state) => {
    const prior = state.events[item.key];
    if (prior) return { claimed: false, disposition: prior.status };
    const unresolved = Object.values(state.events).find(
      (record) =>
        record.status !== 'resolved' &&
        record.event.ownerKey === item.ownerKey &&
        record.event.sourceId === item.sourceId,
    );
    if (unresolved) return { claimed: false, disposition: unresolved.status };
    const claimToken = randomUUID();
    const stamp = new Date().toISOString();
    state.events[item.key] = {
      event: { ...item, disposition: undefined },
      status: 'pending',
      claimToken,
      claimedAt: stamp,
      updatedAt: stamp,
    };
    return { claimed: true, claimToken, disposition: 'pending' };
  });
}

export async function recordEvent(
  statePath: string,
  key: string,
  claimToken: string,
  status: Disposition,
  receipt: string,
): Promise<void> {
  await updateState(statePath, (state) => {
    const prior = state.events[key];
    if (!prior || prior.claimToken !== claimToken)
      throw new Error('unknown event or wrong claim token');
    const allowed: Record<Disposition, Disposition[]> = {
      pending: ['sent', 'uncertain'],
      sent: ['acknowledged', 'uncertain'],
      uncertain: ['sent', 'acknowledged'],
      acknowledged: ['resolved'],
      resolved: [],
    };
    if (!allowed[prior.status].includes(status))
      throw new Error('invalid event disposition transition');
    if (status !== 'uncertain' && !receipt.trim())
      throw new Error('concrete receipt required');
    prior.status = status;
    prior.receipt = receipt.slice(0, 500);
    prior.updatedAt = new Date().toISOString();
  });
}

async function main(): Promise<void> {
  const [mode = 'snapshot', ...rest] = process.argv.slice(2);
  const { values } = parseCliArgs(rest, {
    options: {
      inventory: { type: 'string' },
      state: { type: 'string' },
      'aif-url': { type: 'string' },
      'event-json': { type: 'string' },
      key: { type: 'string' },
      token: { type: 'string' },
      status: { type: 'string' },
      receipt: { type: 'string' },
      compact: { type: 'boolean' },
    },
  });
  const statePath = str(values.state);
  if (!statePath) throw new CliArgError('--state is required');
  if (mode === 'snapshot') {
    const inventoryPath = str(values.inventory);
    if (!inventoryPath) throw new CliArgError('--inventory is required');
    const snapshot = await snapshotSupervision({
      inventoryPath,
      statePath,
      aifUrl: str(values['aif-url']),
    });
    process.stdout.write(
      JSON.stringify(
        values.compact === true ? compactSnapshot(snapshot) : snapshot,
      ) + '\n',
    );
  } else if (mode === 'claim') {
    const item = JSON.parse(
      str(values['event-json']) ?? 'null',
    ) as Event | null;
    if (!item?.key || !item.ownerThreadId || !item.sourceId)
      throw new CliArgError('--event-json needs a snapshot event');
    process.stdout.write(
      JSON.stringify(await claimEvent(statePath, item)) + '\n',
    );
  } else if (mode === 'record') {
    const key = str(values.key);
    const token = str(values.token);
    const status = str(values.status) as Disposition | undefined;
    if (!key || !token || !status)
      throw new CliArgError('record requires --key, --token, --status');
    await recordEvent(statePath, key, token, status, str(values.receipt) ?? '');
    process.stdout.write(JSON.stringify({ key, status }) + '\n');
  } else throw new CliArgError(`unknown mode ${mode}`);
}

if (isMain(import.meta.url))
  main().catch((err) => {
    process.stderr.write(
      `${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exitCode = 1;
  });
