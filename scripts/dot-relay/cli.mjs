#!/usr/bin/env node
// Dot relay CLI — DESIGN.md §Timers/stop + opaque transport boundary, durable
// closure/multipart/index amendments, COORDINATOR-BRIDGE.md metadata-put.
//
// Metadata-only stdout: successes are bounded JSON with ids/counts/digests;
// failures carry a fixed code and never a payload excerpt. Unknown flags or
// commands exit 2. The root must be absolute, traversal-free, not a symlink,
// and initialized (config.json present) for every command except init.

import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import {
  mkdirSync, writeFileSync, readFileSync, existsSync, lstatSync,
  openSync, closeSync, writeSync, renameSync, unlinkSync, readdirSync,
  fsyncSync, ftruncateSync, statSync,
} from 'node:fs';
import { join, dirname, resolve, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { openLedger } from './ledger.mjs';
import { validateEnvelope, CHAT_IDS } from './contract.mjs';
import {
  runExecution, resumeExecution, monitorAdoptedChild, startActiveClock, parseAgentsCensus,
  proveProcessDeath, runCessationLadder, classifyProbe, DEATH_PROOF_SESSION,
  applyReviewAndVerify,
} from './executor.mjs';
import { parseStrictJson } from '../dot-review-gate/strict-json.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(HERE, '..', '..');
const TIMER_LABEL = 'ai.getff.dot-relay';
const TIMER_INTERVAL = 14400;
// HOST-RESILIENCE §1: the owned timer is a CALENDAR timer — StartInterval
// misses firings during sleep; StartCalendarInterval coalesces missed firings
// into one wake event. Six 4h slots, RunAtLoad=true, KeepAlive=false, and
// NEVER both StartInterval and StartCalendarInterval.
const TIMER_HOURS = [0, 4, 8, 12, 16, 20];
const CHUNK_MAX = 16 * 1024;
const METADATA_MAX = 200_000;
const SAFE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/;
const FORBIDDEN_METADATA_KEYS = new Set(['payload', 'body', 'kickoff', 'analysis']);

// ---------------------------------------------------------------- output/exit

function ok(obj) {
  process.stdout.write(`${JSON.stringify({ ok: true, ...obj })}\n`);
  process.exit(0);
}
function fail(code, extra = {}) {
  process.stdout.write(`${JSON.stringify({ ok: false, code, ...extra })}\n`);
  process.exit(1);
}
function usage(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(2);
}

// ---------------------------------------------------------------- arg parsing

const FLAG_SPECS = {
  init: { '--recovery-pending': 'bool' },
  tick: {},
  supervise: { '--execution-id': 'value', '--resume': 'bool', '--adopt': 'bool' },
  'review-import': { '--execution-id': 'value', '--receipt': 'value' },
  plan: {},
  'spool-begin': { '--id': 'value', '--artifact-sha256': 'value', '--bytes': 'value' },
  'spool-append': { '--upload-id': 'value', '--chunk-json': 'value' },
  'spool-part-begin': { '--upload-id': 'value', '--ordinal': 'value', '--sha256': 'value', '--bytes': 'value' },
  'spool-part-finish': { '--upload-id': 'value', '--ordinal': 'value' },
  'spool-finish': { '--upload-id': 'value', '--producer-role': 'value' },
  'delivery-claim': { '--id': 'value' },
  'delivery-receipt': { '--id': 'value', '--status': 'value', '--receipt-file': 'value' },
  'import-ack': { '--file': 'value', '--producer-role': 'value' },
  'conflict-resolve': { '--event-id': 'value', '--disposition': 'value', '--actor': 'value' },
  'baseline-receipt': { '--file': 'value' },
  'manifest-import': { '--file': 'value', '--producer-role': 'value', '--cursor-token': 'value' },
  'snapshot-import': { '--file': 'value', '--producer-role': 'value', '--cursor-token': 'value' },
  'receipt-import': { '--file': 'value', '--producer-role': 'value' },
  'index-import': { '--file': 'value', '--producer-role': 'value', '--cursor': 'value', '--expected-index-sha256': 'value' },
  'receipt-claim': { '--id': 'value' },
  'receipt-outcome': { '--id': 'value', '--status': 'value', '--receipt-file': 'value' },
  'metadata-put': { '--id': 'value', '--chunk-json': 'value', '--final': 'value' },
  'source-put': { '--id': 'value', '--offset': 'value', '--chunk-json': 'value', '--final': 'value', '--sha256': 'value', '--bytes': 'value' },
  'source-status': { '--id': 'value', '--sha256': 'value', '--bytes': 'value' },
  'locator-resolved': { '--producer-role': 'value', '--generation': 'value', '--locator-sha256': 'value', '--page-id': 'value', '--reference': 'value', '--source-sha256': 'value', '--bytes': 'value' },
  'bridge-activated': { '--automation-id': 'value' },
  'bridge-source': { '--expected-sha256': 'value' },
  status: {},
  'install-timer': { '--write-only': 'bool', '--plist-dir': 'value' },
  off: { '--reason': 'value' },
  resume: { '--actor': 'value' },
  'reconcile-execution': { '--id': 'value', '--decision': 'value', '--control': 'value' },
  'reconcile-external-recovery': { '--receipt-dir': 'value' },
};

function parseArgs(argv) {
  let root = null;
  const command = argv[0];
  if (!command || !FLAG_SPECS[command]) usage(`unknown command: ${command ?? '(none)'}`);
  const spec = FLAG_SPECS[command];
  const flags = {};
  const rest = argv.slice(1);
  for (let i = 0; i < rest.length; i++) {
    const tok = rest[i];
    if (!tok.startsWith('--')) usage(`unexpected positional: ${tok}`);
    if (tok === '--root') {
      root = rest[++i];
      if (!root) usage('--root requires a value');
      continue;
    }
    const kind = spec[tok];
    if (!kind) usage(`unknown flag for ${command}: ${tok}`);
    if (kind === 'bool') {
      flags[tok] = true;
    } else {
      flags[tok] = rest[++i];
      if (flags[tok] === undefined) usage(`${tok} requires a value`);
    }
  }
  return { command, flags, root };
}

// ---------------------------------------------------------------- root safety

function checkRoot(root) {
  if (typeof root !== 'string' || !isAbsolute(root)) fail('ROOT_NOT_ABSOLUTE');
  const parts = root.split('/');
  if (parts.includes('..')) fail('ROOT_TRAVERSAL');
  // The root ITSELF must not be a symlink (identity of the runtime dir).
  // Ancestor segments are the trusted environment's topology — on macOS
  // /tmp and /var are themselves symlinks, so walking the chain would
  // reject every legitimate temp root.
  if (existsSync(root)) {
    const st = lstatSync(root);
    if (st.isSymbolicLink()) fail('ROOT_SYMLINK');
    if (!st.isDirectory()) fail('ROOT_NOT_DIR');
  }
  return root;
}

const ROOT_DIRS = ['objects', 'spool', 'sources', 'inbox', 'plans', 'worker', 'reviews'];

function openRoot(root, { requireInit = true } = {}) {
  checkRoot(root);
  if (requireInit && !existsSync(join(root, 'config.json'))) fail('ROOT_NOT_INITIALIZED');
  return { root, ledger: openLedger(join(root, 'ledger.sqlite')) };
}

function readJsonFile(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    fail('FILE_UNREADABLE');
  }
  try {
    return { obj: parseStrictJson(text), text };
  } catch {
    fail('FILE_NOT_JSON');
  }
}

function atomicWrite(path, text) {
  const base = path.split('/').pop();
  const tmp = join(dirname(path), `.${base}.${process.pid}.tmp`);
  writeFileSync(tmp, text, { encoding: 'utf8', mode: 0o600 });
  renameSync(tmp, path);
}

function sha256OfText(text) {
  return createHash('sha256').update(text).digest('hex');
}
function sha256OfBuffer(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

// ---------------------------------------------------------------- crash-safe fs (R12)
// Data bytes are fsynced BEFORE the checkpoint that advances the committed
// offset; checkpoints/publications are written atomically (tmp+rename) and the
// containing directory is fsynced after each rename so a power loss never
// leaves a committed checkpoint pointing at bytes that are not on disk.

function fsyncDir(path) {
  const fd = openSync(path, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

function atomicWriteFsynced(path, text, mode = 0o600) {
  const tmp = `${path}.tmp`;
  const fd = openSync(tmp, 'w', mode);
  try {
    writeSync(fd, text, null, 'utf8');
    fsyncSync(fd);
  } finally { closeSync(fd); }
  renameSync(tmp, path);
  fsyncDir(dirname(path));
}

function fsyncExistingFile(path) {
  const fd = openSync(path, 'r+');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

// ---------------------------------------------------------------- spool state

function spoolPath(root, uploadId, name) {
  return join(root, 'spool', `${uploadId}.${name}`);
}
function loadUpload(root, uploadId) {
  const p = spoolPath(root, uploadId, 'state.json');
  if (!existsSync(p)) fail('UNKNOWN_UPLOAD');
  let state;
  try {
    state = JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    fail('UPLOAD_STATE_CORRUPT');
  }
  if (!state || typeof state !== 'object' || typeof state.upload_id !== 'string') fail('UPLOAD_STATE_CORRUPT');
  return recoverUpload(root, state);
}
// R12: the journal, never the file tail, is the commit authority — saveUpload
// checkpoints are fsynced atomically so a committed offset always names bytes
// that are already on disk.
function saveUpload(root, state) {
  atomicWriteFsynced(spoolPath(root, state.upload_id, 'state.json'), JSON.stringify(state));
}

// R12: restart recovery. UPLOADING-phase states get the whole.tmp uncommitted
// suffix shed back to the committed offset (truncation, never a blind append
// onto a preexisting suffix) and orphan part temps of already-committed
// ordinals dropped (their bytes live at the committed whole prefix).
// Publication phases (PUBLISHING and later) leave the disk untouched —
// cmdSpoolFinish owns those.
function committedWholeBytes(state) {
  // pre-R12 states carry no committed_offset: the committed prefix is the
  // concatenation of the committed parts (ordinals < next_ordinal)
  if (Number.isSafeInteger(state.committed_offset)) return state.committed_offset;
  let sum = 0;
  for (let i = 0; i < state.next_ordinal && i < state.parts.length; i++) sum += state.parts[i].bytes;
  return sum;
}

function recoverUpload(root, state) {
  if ((state.phase ?? 'UPLOADING') !== 'UPLOADING') return state;
  const offset = committedWholeBytes(state);
  const wholePath = state.whole_path;
  if (existsSync(wholePath)) {
    const size = statSync(wholePath).size;
    if (size < offset) fail('SPOOL_STATE_CORRUPT');
    if (size > offset) {
      const fd = openSync(wholePath, 'r+');
      try { ftruncateSync(fd, offset); fsyncSync(fd); } finally { closeSync(fd); }
    }
  } else if (offset > 0) {
    // committed bytes gone with no publication phase recorded: unrecoverable
    fail('SPOOL_STATE_CORRUPT');
  }
  for (let i = 0; i < state.next_ordinal && i < state.parts.length; i++) {
    const tmp = currentPartTemp(root, state.upload_id, state.parts[i].ordinal);
    if (existsSync(tmp)) unlinkSync(tmp);
  }
  if (state.current_part && state.current_part.ordinal < state.next_ordinal) {
    // descriptor survived a commit crash: its bytes are committed — stale
    try { unlinkSync(state.current_part.path); } catch { /* already gone */ }
    state.current_part = null;
    saveUpload(root, state);
    return state;
  }
  if (state.committed_offset === undefined) {
    // adopt the derived offset durably so later truncations have a journal base
    state.committed_offset = offset;
    saveUpload(root, state);
  }
  return state;
}

function manifestParts(manifestRow) {
  const mj = JSON.parse(manifestRow.manifest_json);
  if (mj.artifact && Array.isArray(mj.artifact.parts)) {
    return { explicit: true, parts: mj.artifact.parts.map((p) => ({ ordinal: p.ordinal, sha256: p.sha256, bytes: p.bytes })) };
  }
  // single-ref manifest: one implicit part bound to the whole digest (no
  // separate part commands exist for it — spool-append/finish close it inline)
  return { explicit: false, parts: [{ ordinal: 0, sha256: manifestRow.artifact_sha256, bytes: manifestRow.artifact_bytes }] };
}

function currentPartTemp(root, uploadId, ordinal) {
  return spoolPath(root, uploadId, `part${ordinal}.tmp`);
}

// R12 journal commit for one VERIFIED part: fsync the whole bytes BEFORE the
// fsynced checkpoint that advances committed_offset/next_ordinal/retained_part;
// the part temp is unlinked only AFTER that checkpoint is durable. Replaying
// the same committed ordinal is a no-op (caller checks); the descriptor bytes
// are hash-checked before this runs, so the journal never advances on
// unverified bytes.
function commitPart(root, state, part, buf) {
  const fd = openSync(state.whole_path, 'a', 0o600);
  try { writeSync(fd, buf); fsyncSync(fd); } finally { closeSync(fd); }
  state.committed_offset = (state.committed_offset ?? 0) + buf.length;
  state.retained_part = { ordinal: part.ordinal, sha256: part.sha256, bytes: part.bytes };
  state.current_part = null;
  state.next_ordinal = part.ordinal + 1;
  saveUpload(root, state);
  try { unlinkSync(part.path); } catch { /* already gone */ }
}

// ---------------------------------------------------------------- production probes
//
// HOST-RESILIENCE §2: identity evidence for the owned scheduler. Boot id is
// the OS boot session UUID (never a wall timestamp); process-start evidence
// is fresh /bin/ps output with LC_ALL=C; session census is the supported
// `claude agents --json --all --cwd <dir>` projected via executor
// parseAgentsCensus. Missing identity fields yield IDENTITY_UNPROVEN — never
// invented certainty.

function bootSessionUuid() {
  try {
    const v = execFileSync('/usr/sbin/sysctl', ['-n', 'kern.bootsessionuuid'], { encoding: 'utf8' }).trim();
    return /^[0-9A-Za-z-]{8,}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

function productionProcessProbe(pid) {
  if (!Number.isInteger(pid) && !/^\d+$/.test(String(pid ?? ''))) return { alive: false, start: null };
  try {
    const start = execFileSync('/bin/ps', ['-o', 'lstart=', '-p', String(pid)], {
      encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' },
    }).trim();
    if (!start) return { alive: false, start: null };
    return { alive: true, start };
  } catch {
    return { alive: false, start: null };
  }
}

// Returns a list of live {session_id, pid, cwd, status} entries when the
// census is projectable, or { identityUnproven: true } when the CLI lacks
// identity fields. Consumers map the marker conservatively: resume holds
// (UNCERTAIN/IDENTITY_UNPROVEN), reconcileHost treats it as unproven session
// evidence (never adopt). R07: projection lives in executor.parseAgentsCensus
// (camelCase/snake session spellings, completed statuses excluded, cwd/status
// honored, unprojectable live entries poison the census).
function productionAgentsCensus(sessionId, cwd) {
  try {
    const r = spawnSync('claude', ['agents', '--json', '--all', '--cwd', cwd ?? REPO_ROOT], {
      encoding: 'utf8', timeout: 30_000,
    });
    if (r.status !== 0 || typeof r.stdout !== 'string' || r.stdout.trim() === '') {
      return { identityUnproven: true };
    }
    return parseAgentsCensus(JSON.parse(r.stdout), { sessionId: sessionId ?? null, cwd: cwd ?? REPO_ROOT });
  } catch {
    return { identityUnproven: true };
  }
}

// ---------------------------------------------------------------- commands

function cmdInit({ root, flags }) {
  checkRoot(root);
  for (const d of ROOT_DIRS) mkdirSync(join(root, d), { recursive: true });
  const cfg = {
    version: 1,
    label: TIMER_LABEL,
    interval_seconds: TIMER_INTERVAL,
    deployment_mode: 'HYBRID',
    source_sha: '35738554faf029e9fe3b8b4c25bfdde242f65c66',
  };
  const cfgPath = join(root, 'config.json');
  if (existsSync(cfgPath)) {
    let existing;
    try {
      existing = JSON.parse(readFileSync(cfgPath, 'utf8'));
    } catch {
      fail('CONFIG_MISMATCH');
    }
    if (JSON.stringify(existing) !== JSON.stringify(cfg)) fail('CONFIG_MISMATCH');
  } else {
    atomicWrite(cfgPath, `${JSON.stringify(cfg)}\n`);
  }
  const ledger = openLedger(join(root, 'ledger.sqlite'));
  // RECOVERY-ADOPTION: opt-in flag for a root created to reconcile externally
  // delivered work — automatic admission stays closed until
  // reconcile-external-recovery commits. Ordinary roots are unaffected.
  if (flags['--recovery-pending']) ledger.setRecoveryPending();
  ledger.close();
  ok({ root, label: TIMER_LABEL });
}

// Raw manifest artifact parts (references included) joined by ordinal to the
// spool's projected descriptors — the bridge runner refetches bytes by
// reference, so plan output must carry them.
function rawManifestParts(manifestRow) {
  const mj = JSON.parse(manifestRow.manifest_json);
  if (mj.artifact && Array.isArray(mj.artifact.parts)) {
    return mj.artifact.parts.map((p) => ({
      ordinal: p.ordinal, sha256: p.sha256, bytes: p.bytes,
      reference: p.reference ?? null, page_id: p.page_id ?? null,
    }));
  }
  if (mj.artifact && typeof mj.artifact.reference === 'string') {
    return [{
      ordinal: 0, sha256: manifestRow.artifact_sha256, bytes: manifestRow.artifact_bytes,
      reference: mj.artifact.reference, page_id: mj.artifact.page_id ?? null,
    }];
  }
  return [];
}

function cmdPlan({ root }) {
  const { ledger } = openRoot(root);
  try {
    const plan = ledger.plan({ plansDir: join(root, 'plans') });
    const path = join(root, 'plans', 'bridge-plan.json');
    // Bounded detail for the bridge runner (BRIDGE-RUNNER-ADDENDUM): every
    // entry is metadata only — ids, digests, sizes, opaque references.
    const deliveries = ledger.pendingDeliveries().map((row) => ({
      delivery_id: row.delivery_id, event_id: row.event_id, destination: row.destination,
    }));
    const manifests = plan.manifests_to_fetch.map((id) => {
      const m = ledger.getManifest(id);
      if (!m) return null;
      const mj = JSON.parse(m.manifest_json);
      return {
        event_id: id,
        artifact_sha256: m.artifact_sha256,
        artifact_bytes: m.artifact_bytes,
        explicit_parts: !!(mj.artifact && Array.isArray(mj.artifact.parts)),
        producer_role: m.producer_role,
        parts: rawManifestParts(m),
      };
    }).filter(Boolean);
    const pendingUploads = [];
    try {
      for (const name of readdirSync(join(root, 'spool'))) {
        if (pendingUploads.length >= 10) break;
        if (!name.endsWith('.state.json')) continue;
        let state;
        try { state = JSON.parse(readFileSync(join(root, 'spool', name), 'utf8')); } catch { continue; }
        if (!state || typeof state !== 'object' || typeof state.upload_id !== 'string') continue;
        // R12: a completed-shaped state alone is NOT completion proof — only a
        // durable ingest is (event row with a committed digest AND the
        // registered manifest matching the spooled artifact). Anything else,
        // including a PUBLISHING/PUBLISHED/INGESTED crash window, stays
        // offered so the coordinator re-runs spool-finish recovery.
        const partCount = Array.isArray(state.parts) ? state.parts.length : 0;
        const completedShape = !state.current_part && (state.next_ordinal ?? 0) >= partCount;
        if (completedShape && typeof state.event_id === 'string') {
          const ev = ledger.getEvent(state.event_id);
          const m = ledger.getManifest(state.event_id);
          if (ev && ev.sha256 !== null && m && m.artifact_sha256 === state.artifact_sha256) continue;
        }
        const m = ledger.getManifest(state.event_id);
        const raw = m ? rawManifestParts(m) : [];
        const parts = (Array.isArray(state.parts) ? state.parts : []).map((p, i) => {
          const ref = raw.find((rp) => rp.ordinal === p.ordinal) ?? raw[i] ?? {};
          return {
            ordinal: p.ordinal, sha256: p.sha256, bytes: p.bytes,
            reference: ref.reference ?? null, page_id: ref.page_id ?? null,
          };
        });
        pendingUploads.push({
          upload_id: state.upload_id,
          event_id: state.event_id,
          explicit_parts: state.explicit_parts === true,
          next_ordinal: state.next_ordinal ?? 0,
          current: state.current_part
            ? { ordinal: state.current_part.ordinal, appended: statBytes(state.current_part.path) }
            : null,
          producer_role: m ? m.producer_role : null,
          parts,
        });
      }
    } catch {
      /* spool dir unreadable: no pending uploads can be reported */
    }
    ok({
      plan_path: path,
      plan_sha256: sha256OfText(readFileSync(path, 'utf8')),
      delivery_ids: plan.delivery_ids.length,
      manifests_to_fetch: plan.manifests_to_fetch.length,
      committed_cursors: plan.committed_cursors,
      index_continuations: plan.index_continuations,
      locator_resolutions: plan.locator_resolutions,
      pending_receipts: plan.pending_receipts,
      blockers: plan.blockers,
      execution: plan.execution,
      deliveries,
      manifests,
      pending_uploads: pendingUploads,
    });
  } finally { ledger.close(); }
}

function cmdTick({ root }) {
  const { ledger } = openRoot(root);
  try {
    // Durable OFF suppresses planning/admission/recovery entirely (§1) —
    // reboot/login/manual tick all arrive here and none clears it.
    if (ledger.status().off) return ok({ off: true, supervise_launched: false });
    // §2: host reconciliation runs ONLY from the owned scheduler (never from
    // status/open). Unprovable session census maps to "no session evidence" —
    // reconcileHost then holds conservatively instead of adopting.
    const bootId = bootSessionUuid();
    const rec = ledger.reconcileHost({
      bootId,
      processProbe: productionProcessProbe,
      sessionProbe: () => {
        const census = productionAgentsCensus(null, REPO_ROOT);
        return Array.isArray(census) ? census : [];
      },
      controlActor: 'scheduler-tick',
    });
    // §1: every firing (RunAtLoad/wake/calendar/manual) enters the SAME
    // scheduler transaction; only a DUE tick plans, exactly once per slot.
    // R06: ownership is ACQUIRED exclusively — this firing's pid/start record
    // goes in with the token, and a live/unproven foreign owner refuses us.
    const token = `tick-${randomUUID()}`;
    const tickOwner = { pid: process.pid, start: productionProcessProbe(process.pid)?.start ?? null };
    const began = ledger.beginSchedulerTick({
      bootId,
      token,
      owner: tickOwner,
      processProbe: productionProcessProbe,
    });
    // RECOVERY-ADOPTION: while the root awaits external-recovery
    // reconciliation, the owned tick plans but admits NOTHING — no executor
    // claim, no recovery dispatch. Only a committed reconcile-external-recovery
    // clears the flag (never durable OFF — that stays untouched here). Every
    // non-off outcome reports the gate so a caller can distinguish "held by
    // pending recovery" from ordinary idleness.
    const recoveryPending = ledger.recoveryImportPending();
    if (began.suppressed === 'off') return ok({ off: true, supervise_launched: false });
    if (began.deduped) return ok({ deduped: true, supervise_launched: false });
    if (began.due === false) return ok({ due: false, next_due_wall_ms: began.next_due_wall_ms, supervise_launched: false, recovery_import_pending: recoveryPending });
    // R06: the slot is owned by another live (or unprovable) scheduler — this
    // firing plans nothing, recovers nothing, and never touches the owner's
    // record. Refusal is a normal busy outcome, not an error.
    if (began.refused) return ok({ busy: true, refused: began.refused, supervise_launched: false });
    let payload;
    try {
      const plan = ledger.plan({ plansDir: join(root, 'plans') });
      const planPath = join(root, 'plans', 'bridge-plan.json');
      let superviseLaunched = false;
      let executionId = null;
      // Reserve only when a never-attempted QUEUED solution exists AND no
      // execution holds the global slot; never on an idle tick.
      const solution = recoveryPending ? null : ledger.nextClaimableSolution();
      const active = ledger.status().execution;
      if (solution && !active) {
        const claim = ledger.claimExecution({ solutionId: solution.id, sessionId: randomUUID() });
        if (claim.claimed) {
          executionId = claim.execution_id;
          // Detached supervise child holds the child lifetime; tick exits now.
          const child = spawn(process.execPath, [SELF, 'supervise', '--root', root, '--execution-id', executionId], {
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
          superviseLaunched = true;
        }
      }
      // §4: automatic SAME-session recovery — interrupted rows resume, dead-
      // supervisor/live-child rows adopt a monitor. Both only from a DUE tick,
      // so dedupe/off-slot firings never double-spawn.
      // R07: a same-boot UNCERTAIN_STOP crash additionally dispatches --resume
      // ONLY when the session census PROVES that session gone (fresh evidence
      // in this dispatch turn); a live or unprovable census holds for a later
      // tick. The spawned supervise re-proves absence itself before admitting
      // the next attempt (verifiedDead).
      let recoveryLaunched = 0;
      for (const d of (recoveryPending ? [] : (rec.executions ?? []))) {
        let flag = null;
        if (d.decision === 'interrupted-host') flag = '--resume';
        else if (d.decision === 'adopt-monitor') flag = '--adopt';
        else if (d.decision === 'uncertain-stop') {
          const census = typeof d.session_id === 'string'
            ? productionAgentsCensus(d.session_id, REPO_ROOT)
            : { identityUnproven: true };
          if (Array.isArray(census) && census.length === 0) flag = '--resume';
        }
        if (!flag) continue;
        const child = spawn(process.execPath, [SELF, 'supervise', '--root', root, '--execution-id', d.execution_id, flag], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
        recoveryLaunched += 1;
      }
      payload = {
        plan_path: planPath,
        plan_sha256: sha256OfText(readFileSync(planPath, 'utf8')),
        delivery_ids: plan.delivery_ids.length,
        manifests_to_fetch: plan.manifests_to_fetch.length,
        supervise_launched: superviseLaunched,
        execution_id: executionId,
        recovery_launched: recoveryLaunched,
        recovery_import_pending: recoveryPending,
        overdue_periods: began.overdue_periods ?? 1,
      };
    } catch {
      // failed planning retains catchup_pending for an idempotent retry
      ledger.completeSchedulerTick({ bootId, token, owner: tickOwner, plannedOk: false });
      return fail('TICK_PLANNING_FAILED');
    }
    ledger.completeSchedulerTick({ bootId, token, owner: tickOwner, plannedOk: true });
    ok(payload);
  } finally { ledger.close(); }
}

async function cmdSupervise({ root, flags }) {
  const id = flags['--execution-id'];
  if (!id) usage('--execution-id required');
  // HOST-RESILIENCE §4: --resume (SAME-session recovery) and --adopt (monitor
  // a same-boot live child) are mutually exclusive recovery modes.
  if (flags['--resume'] && flags['--adopt']) usage('--resume and --adopt are mutually exclusive');
  const mode = flags['--resume'] ? 'resume' : flags['--adopt'] ? 'adopt' : 'run';
  checkRoot(root);
  if (!existsSync(join(root, 'config.json'))) fail('ROOT_NOT_INITIALIZED');
  // resumeReserved: this open takes over the row tick reserved — the restart
  // reconcile must not flip our own row to UNCERTAIN.
  const ledger = openLedger(join(root, 'ledger.sqlite'), { resumeReserved: id });
  try {
    const row = ledger.getExecution(id);
    if (!row) fail('UNKNOWN_EXECUTION');
    const ev = ledger.getEvent(row.solution_id);
    if (!ev || ev.kind !== 'solution' || ev.sha256 == null) fail('EXECUTION_STATE');
    const solution = {
      id: ev.id, sha256: ev.sha256, kind: ev.kind, producer: ev.producer,
      parents: JSON.parse(ev.parent_json), payload: JSON.parse(ev.payload_json),
    };
    // HOST-RESILIENCE §3: the supervise process owns the production ActiveClock.
    // Proven-first (ready before launch), stopped before any exit — ok() exits
    // the process, so the result is captured and rendered only after stop().
    const clock = startActiveClock();
    let r;
    try {
      const proven = await clock.ready(5_000);
      if (!proven) {
        r = { state: 'UNCERTAIN', blocker: 'CLOCK_UNPROVEN' };
      } else if (mode === 'resume') {
        r = await resumeExecution({
          ledger, solution, executionId: id, dir: root, clock,
          sessionProbe: (sid) => productionAgentsCensus(sid, row.worktree ?? REPO_ROOT),
        });
      } else if (mode === 'adopt') {
        r = await monitorAdoptedChild({
          ledger, executionId: id, dir: root, clock,
          processProbe: productionProcessProbe,
        });
      } else {
        r = await runExecution({
          ledger, solution, worktree: REPO_ROOT, dir: root, superviseExecutionId: id, clock,
        });
      }
    } finally {
      clock.stop();
    }
    if (r.state === 'DONE') {
      ok({ execution_id: id, state: 'DONE', pr_url: r.pr_url, head_sha: r.head_sha });
    } else if (r.state === 'REQUIRES_REVIEW') {
      // R10: a captured execution awaits independent review — the supervisor's
      // job ended at the checkpoint; review-import owns the next transition.
      ok({ execution_id: id, state: 'REQUIRES_REVIEW', pr_url: r.pr_url, head_sha: r.head_sha });
    } else if (r.state === 'HELD') {
      ok({ execution_id: id, state: 'HELD' });
    } else if (r.state === 'UNCERTAIN') {
      ok({ execution_id: id, state: 'UNCERTAIN', blocker: r.blocker ?? null });
    } else {
      ok({ execution_id: id, state: 'BLOCKED', blocker: r.blocker ?? null });
    }
  } finally { ledger.close(); }
}

// R10: the OS-owner's ONLY production entry past the review gate. The receipt
// must be a regular, non-world-writable, owner-owned file inside the fixed
// <root>/reviews directory — every file-surface refusal fires before any
// ledger or cloud work. The ledger's reviewImport + verifyPr (via
// applyReviewAndVerify) then decide; held outcomes render the fixed blocker
// code and never touch the review slot.
async function cmdReviewImport({ root, flags }) {
  const id = flags['--execution-id'];
  const receiptPath = flags['--receipt'];
  if (!id || !receiptPath) usage('review-import --execution-id <id> --receipt <path under root/reviews> required');
  checkRoot(root);
  if (!existsSync(join(root, 'config.json'))) fail('ROOT_NOT_INITIALIZED');
  const reviewsRoot = resolve(root, 'reviews');
  const abs = resolve(receiptPath);
  if (abs === reviewsRoot || !abs.startsWith(`${reviewsRoot}/`)) fail('REVIEW_PATH_OUTSIDE_ROOT');
  let st;
  try {
    st = lstatSync(abs);
  } catch {
    fail('REVIEW_FILE_MISSING');
  }
  if (!st.isFile()) fail('REVIEW_FILE_NOT_REGULAR');
  if (st.uid !== process.geteuid()) fail('REVIEW_FILE_NOT_OWNER');
  if (st.mode & 0o002) fail('REVIEW_FILE_WORLD_WRITABLE');
  const { obj: receipt } = readJsonFile(abs);
  const ledger = openLedger(join(root, 'ledger.sqlite'));
  // The gate's CI verification shares the attempt active budget — same
  // proven-first clock discipline as supervise, stopped before any exit.
  const clock = startActiveClock();
  let r;
  try {
    const proven = await clock.ready(5_000);
    if (!proven) {
      r = { state: 'HELD', held: true, blocker: 'CLOCK_UNPROVEN' };
    } else {
      r = await applyReviewAndVerify({ ledger, executionId: id, receipt, clock });
    }
  } finally {
    clock.stop();
    ledger.close();
  }
  if (r.state === 'DONE') {
    ok({ execution_id: id, state: 'DONE', pr_url: r.pr_url, head_sha: r.head_sha, replay: r.replay === true });
  }
  fail(typeof r.blocker === 'string' ? r.blocker : 'REVIEW_STATE', { execution_id: id, state: r.state });
}

// RECOVERY-ADOPTION (PAGE-LOCATOR-RECOVERY-ADDENDUM §"Import existing real
// deliveries"): the OS-owner's narrow command for adopting ALREADY-DELIVERED
// work into a fresh runtime root. Everything below validates the 4 fixed
// recovery receipts and every original recovery-spool envelope against its
// recorded digests BEFORE the single ledger transaction runs; any refusal is
// RECOVERY_IMPORT_CONFLICT with the ledger untouched and the
// recovery_import_pending flag preserved. Stdout stays metadata-only.
const RECOVERY_BASENAMES = [
  'recovery-dispatch-0006-0008.json',
  'recovery-analysis-import.json',
  'recovery-analysis-validation.json',
  'recovery-solver-dispatch-0006-0008.json',
];

function cmdReconcileExternalRecovery({ root, flags }) {
  const dirFlag = flags['--receipt-dir'];
  if (!dirFlag) usage('reconcile-external-recovery requires --receipt-dir');
  const { ledger } = openRoot(root);
  const conflict = (reason) => fail('RECOVERY_IMPORT_CONFLICT', { reason });
  try {
    // Receipt-directory surface: absolute, traversal-free, a real directory,
    // never a symlink.
    if (!isAbsolute(dirFlag)) conflict('receipt-dir-not-absolute');
    if (dirFlag.split('/').includes('..')) conflict('receipt-dir-traversal');
    let dirSt;
    try {
      dirSt = lstatSync(dirFlag);
    } catch {
      conflict('receipt-dir-missing');
    }
    if (dirSt.isSymbolicLink()) conflict('receipt-dir-symlink');
    if (!dirSt.isDirectory()) conflict('receipt-dir-not-dir');

    const receipts = {};
    for (const name of RECOVERY_BASENAMES) {
      const p = join(dirFlag, name);
      let st;
      try {
        st = lstatSync(p);
      } catch {
        conflict('receipt-missing');
      }
      if (st.isSymbolicLink()) conflict('receipt-symlink');
      if (!st.isFile()) conflict('receipt-not-regular');
      let text;
      try {
        text = readFileSync(p, 'utf8');
      } catch {
        conflict('receipt-unreadable');
      }
      let obj;
      try {
        obj = parseStrictJson(text);
      } catch {
        conflict('receipt-not-json');
      }
      receipts[name] = { obj, text };
    }

    const dispatch = receipts['recovery-dispatch-0006-0008.json'].obj;
    const analysisImport = receipts['recovery-analysis-import.json'].obj;
    const validation = receipts['recovery-analysis-validation.json'].obj;
    const solverDispatch = receipts['recovery-solver-dispatch-0006-0008.json'].obj;

    const isHash = (v) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
    const isPosInt = (v) => Number.isInteger(v) && v > 0;

    // --- receipt 1: collector dispatch, ACKED by the analyst ---
    if (dispatch.version !== 1 || dispatch.state !== 'ACKED') conflict('dispatch-state');
    if (dispatch.destination !== CHAT_IDS.analyst) conflict('dispatch-destination');
    if (!Array.isArray(dispatch.deliveries) || dispatch.deliveries.length === 0) conflict('dispatch-deliveries');
    if (dispatch.ack_index_generation !== analysisImport.generation) conflict('dispatch-generation-crosslink');
    if (typeof analysisImport.index_sha256 !== 'string' || analysisImport.index_sha256 !== dispatch.index?.sha256) {
      conflict('dispatch-index-crosslink');
    }
    const ackByDelivery = new Map();
    if (!Array.isArray(dispatch.actual_acks) || dispatch.actual_acks.length !== dispatch.deliveries.length) {
      conflict('dispatch-acks-parallel');
    }
    for (const ack of dispatch.actual_acks) {
      if (ack.accepted !== true || ack.destination !== CHAT_IDS.analyst) conflict('ack-shape');
      ackByDelivery.set(ack.delivery_id, ack);
    }

    // --- original envelopes: the spool files are the byte authority ---
    const loadSpoolEnvelope = (eventId, declaredBytes, declaredArtifactSha256, role) => {
      const derived = join(dirFlag, 'recovery-spool', eventId.replace(/:/g, '-'), 'envelope.json');
      let st;
      try {
        st = lstatSync(derived);
      } catch {
        conflict('spool-missing');
      }
      if (st.isSymbolicLink() || !st.isFile()) conflict('spool-not-regular');
      const text = readFileSync(derived, 'utf8');
      if (Buffer.byteLength(text, 'utf8') !== declaredBytes) conflict('spool-bytes-mismatch');
      if (sha256OfText(text) !== declaredArtifactSha256) conflict('spool-digest-mismatch');
      let env;
      try {
        env = validateEnvelope(text, role);
      } catch {
        conflict('spool-envelope-invalid');
      }
      if (env.id !== eventId) conflict('spool-event-id');
      return env;
    };

    // batches: deliveries in dispatch order
    const batches = [];
    for (const d of dispatch.deliveries) {
      if (d.delivery_id !== `DOT-RECOVERY-${d.event_id}`) conflict('delivery-id-shape');
      if (!isHash(d.event_sha256) || !isHash(d.artifact_sha256) || !isPosInt(d.bytes)) conflict('delivery-shape');
      const env = loadSpoolEnvelope(d.event_id, d.bytes, d.artifact_sha256, 'collector');
      if (env.kind !== 'batch' || env.sha256 !== d.event_sha256) conflict('batch-envelope-crosslink');
      if (env.parents.length !== 0) conflict('batch-parents-not-empty');
      const m = d.manifest;
      if (!m || m.event_id !== env.id || m.destination !== CHAT_IDS.analyst
        || m.sha256 !== d.artifact_sha256 || m.bytes !== d.bytes
        || JSON.stringify(m.parents ?? []) !== JSON.stringify(env.parents)) {
        conflict('batch-manifest-crosslink');
      }
      const ack = ackByDelivery.get(d.delivery_id);
      if (!ack || ack.event_id !== d.event_id || ack.event_sha256 !== d.event_sha256
        || ack.artifact_sha256 !== d.artifact_sha256) {
        conflict('ack-delivery-crosslink');
      }
      batches.push({ env, manifest: m, delivery_id: d.delivery_id, ack });
    }

    // --- receipt 2: analyst analysis import (manifests + spool records) ---
    if (JSON.stringify(analysisImport.acks ?? null) !== JSON.stringify(dispatch.actual_acks)) {
      conflict('analysis-acks-crosslink');
    }
    if (!Array.isArray(analysisImport.manifests) || !Array.isArray(analysisImport.records)
      || analysisImport.manifests.length !== analysisImport.records.length
      || analysisImport.manifests.length === 0) {
      conflict('analysis-records-parallel');
    }

    // --- receipt 3: validation verdicts must match every record ---
    const validationByEvent = new Map();
    if (validation.version !== 1 || validation.validated !== true || !Array.isArray(validation.records)) {
      conflict('validation-shape');
    }
    for (const v of validation.records) validationByEvent.set(v.event_id, v);

    // --- receipt 4: solver dispatch, SENT_ACCEPTED (send receipts, no ACKs) ---
    if (solverDispatch.version !== 1 || solverDispatch.state !== 'SENT_ACCEPTED') conflict('solver-dispatch-state');
    if (solverDispatch.destination !== CHAT_IDS.solver) conflict('solver-dispatch-destination');
    const solverByEvent = new Map();
    if (!Array.isArray(solverDispatch.deliveries)) conflict('solver-dispatch-deliveries');
    for (const d of solverDispatch.deliveries) {
      if (d.delivery_id !== `DOT-RECOVERY-${d.event_id}`) conflict('solver-delivery-id-shape');
      solverByEvent.set(d.event_id, d);
    }

    const analyses = [];
    analysisImport.records.forEach((rec, i) => {
      if (!isHash(rec.artifact_sha256) || !isPosInt(rec.bytes)) conflict('analysis-record-shape');
      // records[].path must BE the derived spool location — never a free path.
      const derived = join(dirFlag, 'recovery-spool', rec.event_id.replace(/:/g, '-'), 'envelope.json');
      if (resolve(rec.path) !== resolve(derived)) conflict('analysis-record-path');
      const env = loadSpoolEnvelope(rec.event_id, rec.bytes, rec.artifact_sha256, 'analyst');
      if (env.kind !== 'analysis') conflict('analysis-envelope-crosslink');
      const m = analysisImport.manifests[i];
      if (!m || m.event_id !== rec.event_id || m.destination !== CHAT_IDS.solver
        || m.sha256 !== rec.artifact_sha256 || m.bytes !== rec.bytes
        || JSON.stringify(m.parents ?? []) !== JSON.stringify(env.parents ?? [])) {
        conflict('analysis-manifest-crosslink');
      }
      const v = validationByEvent.get(rec.event_id);
      if (!v || v.event_sha256 !== env.sha256 || v.artifact_sha256 !== rec.artifact_sha256 || v.bytes !== rec.bytes) {
        conflict('validation-crosslink');
      }
      const sd = solverByEvent.get(rec.event_id);
      if (!sd || sd.event_sha256 !== env.sha256 || sd.artifact_sha256 !== rec.artifact_sha256
        || sd.bytes !== rec.bytes || JSON.stringify(sd.manifest ?? null) !== JSON.stringify(m)) {
        conflict('solver-dispatch-crosslink');
      }
      analyses.push({
        env, manifest: m, delivery_id: sd.delivery_id,
        send_receipt: { tool: 'send_message_to_thread', delivery_id: sd.delivery_id, state: 'SENT_ACCEPTED', destination: CHAT_IDS.solver },
      });
    });

    // Import identity: the exact receipt bytes + the exact adopted artifact
    // hashes. Identical replay is a no-op inside the ledger; any change is a
    // different import.
    const importKey = sha256OfText(JSON.stringify([
      RECOVERY_BASENAMES.map((n) => sha256OfText(receipts[n].text)),
      [...batches, ...analyses].map((x) => x.manifest.sha256),
    ]));
    const r = ledger.reconcileExternalRecovery({ batches, analyses, import_key: importKey });
    ok({ replay: r.replay, batches_acked: r.batches_acked, analyses_sent: r.analyses_sent });
  } catch (err) {
    if (err && typeof err.code === 'string') fail(err.code, {});
    fail('RECOVERY_IMPORT_ERROR');
  } finally { ledger.close(); }
}

function cmdSpoolBegin({ root, flags }) {
  const { ledger } = openRoot(root);
  try {
    const id = flags['--id'];
    const sha = flags['--artifact-sha256'];
    const bytes = Number(flags['--bytes']);
    if (!id || !sha || !Number.isInteger(bytes)) usage('spool-begin requires --id --artifact-sha256 --bytes');
    const manifest = ledger.getManifest(id);
    if (!manifest) fail('UNKNOWN_MANIFEST');
    if (manifest.artifact_sha256 !== sha || manifest.artifact_bytes !== bytes) fail('MANIFEST_MISMATCH');
    const { explicit, parts } = manifestParts(manifest);
    const uploadId = `DOT-UPLOAD-${randomUUID()}`;
    const state = {
      upload_id: uploadId,
      event_id: id,
      artifact_sha256: sha,
      bytes,
      explicit_parts: explicit,
      parts,
      next_ordinal: 0,
      committed_offset: 0,
      retained_part: null,
      phase: 'UPLOADING',
      current_part: null,
      whole_path: spoolPath(root, uploadId, 'whole.tmp'),
    };
    writeFileSync(state.whole_path, '', { encoding: 'utf8', mode: 0o600 });
    saveUpload(root, state);
    ok({ upload_id: uploadId, parts: parts.length });
  } finally { ledger.close(); }
}

function appendPartChunk(root, uploadId, part, chunk) {
  // Oversize/mismatch is caught at part-finish by the exact hash+bytes check —
  // the uploader is the trusted coordinator tool, and the finish check is the
  // load-bearing gate.
  const fd = openSync(part.path, 'a', 0o600);
  writeSync(fd, chunk, null, 'utf8');
  closeSync(fd);
}

function statBytes(path) {
  try {
    return readFileSync(path).length;
  } catch {
    return 0;
  }
}

function cmdSpoolAppend({ root, flags }) {
  const uploadId = flags['--upload-id'];
  const chunkJson = flags['--chunk-json'];
  if (!uploadId || chunkJson === undefined) usage('spool-append requires --upload-id --chunk-json');
  const state = loadUpload(root, uploadId);
  let chunk;
  try {
    chunk = JSON.parse(chunkJson);
  } catch {
    fail('CHUNK_NOT_JSON');
  }
  if (typeof chunk !== 'string') fail('CHUNK_NOT_STRING');
  if (Buffer.byteLength(chunk, 'utf8') > CHUNK_MAX) fail('CHUNK_OVERSIZE');
  if ((state.phase ?? 'UPLOADING') !== 'UPLOADING') fail('SPOOL_UPLOAD_STATE');
  // implicit single-part manifest: auto-begin part 0 on first append
  if (!state.current_part) {
    if (state.explicit_parts) fail('PART_NOT_BEGUN');
    const p = state.parts[0];
    state.current_part = { ...p, path: currentPartTemp(root, uploadId, p.ordinal) };
    writeFileSync(state.current_part.path, '', { encoding: 'utf8', mode: 0o600 });
    saveUpload(root, state);
  }
  const part = state.current_part;
  appendPartChunk(root, uploadId, part, chunk);
  ok({ upload_id: uploadId, ordinal: part.ordinal, appended_bytes: Buffer.byteLength(chunk, 'utf8') });
}

function cmdSpoolPartBegin({ root, flags }) {
  const uploadId = flags['--upload-id'];
  const ordinal = Number(flags['--ordinal']);
  const sha = flags['--sha256'];
  const bytes = Number(flags['--bytes']);
  if (!uploadId || !Number.isInteger(ordinal) || !sha || !Number.isInteger(bytes)) usage('spool-part-begin requires --upload-id --ordinal --sha256 --bytes');
  const state = loadUpload(root, uploadId);
  if ((state.phase ?? 'UPLOADING') !== 'UPLOADING') fail('SPOOL_UPLOAD_STATE');
  if (!state.explicit_parts) fail('NOT_MULTIPART');
  const descriptor = state.parts[ordinal];
  if (!descriptor || descriptor.sha256 !== sha || descriptor.bytes !== bytes) fail('PART_DESCRIPTOR_MISMATCH');
  if (ordinal > state.next_ordinal) fail('PART_ORDER');
  if (ordinal < state.next_ordinal) {
    // replay of a completed part: identical descriptor, already concatenated — no-op
    ok({ upload_id: uploadId, ordinal, replay: true });
    return;
  }
  // fresh (or restarted-incomplete) part: replace the private temp, never duplicate concat
  state.current_part = { ...descriptor, path: currentPartTemp(root, uploadId, ordinal) };
  writeFileSync(state.current_part.path, '', { encoding: 'utf8', mode: 0o600 });
  saveUpload(root, state);
  ok({ upload_id: uploadId, ordinal });
}

function cmdSpoolPartFinish({ root, flags }) {
  const uploadId = flags['--upload-id'];
  const ordinal = Number(flags['--ordinal']);
  if (!uploadId || !Number.isInteger(ordinal)) usage('spool-part-finish requires --upload-id --ordinal');
  const state = loadUpload(root, uploadId);
  if ((state.phase ?? 'UPLOADING') !== 'UPLOADING') fail('SPOOL_UPLOAD_STATE');
  const descriptor = state.parts[ordinal];
  if (!descriptor) fail('PART_DESCRIPTOR_MISMATCH');
  if (ordinal < state.next_ordinal) {
    ok({ upload_id: uploadId, ordinal, replay: true }); // identical completed part already concatenated
    return;
  }
  if (!state.current_part || state.current_part.ordinal !== ordinal) fail('PART_NOT_BEGUN');
  const buf = readFileSync(state.current_part.path);
  const actualSha = sha256OfBuffer(buf);
  if (actualSha !== descriptor.sha256 || buf.length !== descriptor.bytes) fail('PART_MISMATCH');
  commitPart(root, state, state.current_part, buf);
  ok({ upload_id: uploadId, ordinal, next_ordinal: state.next_ordinal });
}

// R12: publication phases — PUBLISHING (intent durably recorded BEFORE the
// whole rename), PUBLISHED (rename + directory fsync done), INGESTED (the
// ledger event row is committed). Every crash window between them is closed
// by re-running this command: the phase on disk names the first durable step
// not yet known complete, and recovery proceeds from there, idempotently.
function cmdSpoolFinish({ root, flags }) {
  const uploadId = flags['--upload-id'];
  const producerRole = flags['--producer-role'];
  if (!uploadId || !producerRole) usage('spool-finish requires --upload-id --producer-role');
  const state = loadUpload(root, uploadId);
  const { ledger } = openRoot(root);
  try {
    const manifest = ledger.getManifest(state.event_id);
    if (!manifest || manifest.artifact_sha256 !== state.artifact_sha256) fail('MANIFEST_MISMATCH');
    const target = join(root, 'objects', `${state.artifact_sha256}.json`);

    if (state.phase === 'INGESTED') {
      // crash between the DB commit and the state reap: complete the reap and
      // answer from the durable rows — never re-read the (gone) whole temp
      const ev = ledger.getEvent(state.event_id);
      try { unlinkSync(spoolPath(root, uploadId, 'state.json')); } catch { /* already gone */ }
      ok({ event_id: state.event_id, sha256: ev && ev.sha256, artifact_sha256: state.artifact_sha256, state: ev ? ev.state : 'INGESTED', replay: true });
    }

    if ((state.phase ?? 'UPLOADING') === 'UPLOADING') {
      // implicit single part: no separate part commands exist — journal-commit
      // it here through the same verified-path discipline as part-finish
      if (!state.explicit_parts && state.current_part) {
        const part = state.current_part;
        const pbuf = readFileSync(part.path);
        if (sha256OfBuffer(pbuf) !== part.sha256 || pbuf.length !== part.bytes) fail('SPOOL_HASH_MISMATCH');
        commitPart(root, state, part, pbuf);
      }
      if (state.next_ordinal !== state.parts.length || state.current_part) fail('PARTS_INCOMPLETE');
      const buf = readFileSync(state.whole_path);
      if (sha256OfBuffer(buf) !== state.artifact_sha256 || buf.length !== state.bytes) fail('SPOOL_HASH_MISMATCH');
      const text = buf.toString('utf8');
      let env0;
      try {
        env0 = validateEnvelope(text, producerRole);
      } catch {
        fail('SPOOL_ENVELOPE_INVALID');
      }
      if (env0.id !== state.event_id) fail('MANIFEST_MISMATCH');
      // PUBLISHING intent is durably recorded BEFORE the rename: a crash past
      // this point recovers from whole.tmp (rename not yet run) or from the
      // published object (rename done) — never by re-appending.
      state.phase = 'PUBLISHING';
      saveUpload(root, state);
    }

    // publication completion/verification (fresh, window A, window B alike)
    if (existsSync(target)) {
      const obuf = readFileSync(target);
      if (sha256OfBuffer(obuf) !== state.artifact_sha256 || obuf.length !== state.bytes) fail('SPOOL_OBJECT_CONFLICT');
      if (existsSync(state.whole_path)) {
        try { unlinkSync(state.whole_path); } catch { /* already gone */ }
      }
    } else if (existsSync(state.whole_path)) {
      const wbuf = readFileSync(state.whole_path);
      if (sha256OfBuffer(wbuf) !== state.artifact_sha256 || wbuf.length !== state.bytes) fail('SPOOL_OBJECT_CONFLICT');
      renameSync(state.whole_path, target);
      fsyncDir(dirname(target));
    } else {
      fail('SPOOL_PUBLISH_RECOVERY_LOST');
    }
    state.phase = 'PUBLISHED';
    saveUpload(root, state);

    // ingest from the published object bytes — the envelope source for both a
    // fresh finish and every recovery path is the immutable object itself
    const text = readFileSync(target, 'utf8');
    let env;
    try {
      env = validateEnvelope(text, producerRole);
    } catch {
      fail('SPOOL_ENVELOPE_INVALID');
    }
    if (env.id !== state.event_id) fail('MANIFEST_MISMATCH');
    // R04: the spooled producer role is the trusted caller identity — an
    // ack-kind envelope ingested here goes through the same role check as
    // every other ACK entry point (no role-free spool channel).
    let r;
    try {
      r = ledger.ingest(env, { trustedProducerRole: producerRole });
    } catch (e) {
      fail(e.code ?? 'SPOOL_INGEST_ERROR');
    }
    state.phase = 'INGESTED';
    saveUpload(root, state);
    // the upload is durably complete (object published + event ingested):
    // drop the spool state so later plans never re-offer it. A crash before
    // this unlink leaves an INGESTED state file, re-entered above as a replay.
    try { unlinkSync(spoolPath(root, uploadId, 'state.json')); } catch { /* already gone */ }
    ok({ event_id: env.id, sha256: env.sha256, artifact_sha256: state.artifact_sha256, state: r.state, replay: r.replay === true });
  } finally { ledger.close(); }
}

// ---------------------------------------------------------------- source-put
// R01/R02/R12: inert SOURCE upload under the fixed runtime source spool.
// The coordinator fetches a source page and re-materializes it through this
// offset-checked chunked API; the final call verifies the exact Node UTF-8
// byte count and SHA256 against the EXPECTED descriptor (never trusting the
// transport's reported hash) and publishes atomically to
// sources/<sha256>.json (0600). Pure metadata out: {ok,path,sha256,bytes}.
// Publication is journaled in two phases (PUBLISHING -> published) so a crash
// between the rename and the journal commit is recovered, never duplicated.

const SOURCE_MAX = 200_000;
const HEX64_RE = /^[0-9a-f]{64}$/;

function sourcesDir(root) {
  const dir = join(root, 'sources');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function sourceJournalPath(root, id) {
  return join(sourcesDir(root), `${id}.journal`);
}

function loadSourceJournal(root, id) {
  const p = sourceJournalPath(root, id);
  if (!existsSync(p)) return null;
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'));
    if (!j || j.id !== id || !Number.isSafeInteger(j.committed_offset) || !Array.isArray(j.chunks)) fail('SOURCE_JOURNAL_CORRUPT');
    return j;
  } catch (e) {
    if (e && e.code === 'SOURCE_JOURNAL_CORRUPT') throw e;
    fail('SOURCE_JOURNAL_CORRUPT');
  }
}

function saveSourceJournal(root, journal) {
  atomicWriteFsynced(sourceJournalPath(root, journal.id), JSON.stringify(journal));
}

// A journal left mid-publication (crash between rename and journal commit)
// is completed here: the intended digest in the PUBLISHING intent is the
// authoritative expected value; the object or the retained part must match it
// exactly, else the identity is conflicted, never guessed.
function recoverPublishingSource(root, journal) {
  const partPath = join(sourcesDir(root), `${journal.id}.part`);
  const target = join(sourcesDir(root), `${journal.publishing.sha256}.json`);
  if (existsSync(target)) {
    const buf = readFileSync(target);
    if (buf.length !== journal.publishing.bytes || sha256OfBuffer(buf) !== journal.publishing.sha256) fail('SOURCE_PUBLISH_RECOVERY_CONFLICT');
  } else if (existsSync(partPath)) {
    const buf = readFileSync(partPath);
    if (buf.length !== journal.publishing.bytes || sha256OfBuffer(buf) !== journal.publishing.sha256) fail('SOURCE_PUBLISH_RECOVERY_CONFLICT');
    renameSync(partPath, target);
    fsyncDir(sourcesDir(root));
  } else {
    fail('SOURCE_PUBLISH_RECOVERY_LOST');
  }
  journal.published = { sha256: journal.publishing.sha256, bytes: journal.publishing.bytes };
  journal.publishing = null;
  try { unlinkSync(partPath); } catch { /* already gone */ }
  saveSourceJournal(root, journal);
}

function cmdSourcePut({ root, flags }) {
  const id = flags['--id'];
  const offset = Number(flags['--offset']);
  const chunkJson = flags['--chunk-json'];
  const finalRaw = flags['--final'];
  const sha = flags['--sha256'];
  const bytes = Number(flags['--bytes']);
  if (!id || offset === undefined || chunkJson === undefined || !finalRaw) usage('source-put requires --id --offset --chunk-json --final [--sha256 --bytes]');
  if (!Number.isSafeInteger(offset) || offset < 0) usage('--offset must be a non-negative integer');
  if (finalRaw !== 'true' && finalRaw !== 'false') usage('--final must be true|false');
  const isFinal = finalRaw === 'true';
  if (isFinal && (typeof sha !== 'string' || !HEX64_RE.test(sha) || !Number.isSafeInteger(bytes))) usage('final source-put requires --sha256 <64hex> --bytes <int>');
  if (!SAFE_ID_RE.test(id)) fail('SOURCE_ID_INVALID');
  let chunk;
  try { chunk = JSON.parse(chunkJson); } catch { fail('CHUNK_NOT_JSON'); }
  if (typeof chunk !== 'string') fail('CHUNK_NOT_STRING');
  const chunkBytes = Buffer.byteLength(chunk, 'utf8');
  if (chunkBytes > CHUNK_MAX) fail('CHUNK_OVERSIZE');
  if (isFinal && (bytes > SOURCE_MAX || bytes <= 0)) fail('SOURCE_OVERSIZE');

  const dir = sourcesDir(root);
  const partPath = join(dir, `${id}.part`);
  const journal = loadSourceJournal(root, id) ?? { version: 1, id, committed_offset: 0, chunks: [], publishing: null, published: null };

  // finish an interrupted publication first (idempotent recovery)
  if (journal.publishing) recoverPublishingSource(root, journal);

  if (journal.published) {
    if (!isFinal || sha !== journal.published.sha256 || bytes !== journal.published.bytes) fail('SOURCE_OFFSET_CONFLICT');
    ok({ path: join(dir, `${journal.published.sha256}.json`), sha256: journal.published.sha256, bytes: journal.published.bytes });
  }

  // ensure the part exists and shed any uncommitted crash suffix (R12)
  if (!existsSync(partPath)) writeFileSync(partPath, '', { encoding: 'utf8', mode: 0o600 });
  const size = statSync(partPath).size;
  if (size !== journal.committed_offset) {
    if (size < journal.committed_offset) fail('SOURCE_JOURNAL_CORRUPT');
    const fd = openSync(partPath, 'r+');
    try { ftruncateSync(fd, journal.committed_offset); fsyncSync(fd); } finally { closeSync(fd); }
  }

  if (offset < journal.committed_offset) {
    const rec = journal.chunks.find((c) => c.offset === offset);
    if (!rec || rec.bytes !== chunkBytes || rec.sha256 !== sha256OfText(chunk)) fail('SOURCE_OFFSET_CONFLICT');
    ok({ offset: journal.committed_offset }); // identical replay: no-op
  }
  if (offset > journal.committed_offset) fail('SOURCE_OFFSET_CONFLICT');

  if (offset + chunkBytes > SOURCE_MAX) fail('SOURCE_OVERSIZE');
  const fd = openSync(partPath, 'a', 0o600);
  try { writeSync(fd, chunk, null, 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }

  if (isFinal) {
    const buf = readFileSync(partPath);
    const actualSha = sha256OfBuffer(buf);
    if (buf.length !== bytes || actualSha !== sha) fail('SOURCE_HASH_MISMATCH');
    // PUBLISHING phase is committed BEFORE the rename; recovery completes it
    journal.publishing = { sha256: sha, bytes };
    saveSourceJournal(root, journal);
    const target = join(dir, `${sha}.json`);
    if (!existsSync(target)) {
      renameSync(partPath, target);
      fsyncDir(dir);
    } else {
      try { unlinkSync(partPath); } catch { /* already gone */ }
    }
    journal.publishing = null;
    journal.published = { sha256: sha, bytes };
    saveSourceJournal(root, journal);
    ok({ path: target, sha256: sha, bytes });
  }

  journal.chunks.push({ offset, bytes: chunkBytes, sha256: sha256OfText(chunk) });
  journal.committed_offset = offset + chunkBytes;
  saveSourceJournal(root, journal);
  ok({ offset: journal.committed_offset });
}

// R03-SOURCE-REPLAY: the runner consults the durable journal BEFORE any
// append. An exactly-published identity short-circuits the whole upload; a
// partial id reports the committed offset so the caller can replay its OWN
// original chunk stream from logical offsets; a DIFFERING identity against a
// published object is a HOLD (never a reset — the published bytes are
// immutable truth). Mirrors source-put's direct-file style (no ledger open).
function cmdSourceStatus({ root, flags }) {
  const id = flags['--id'];
  const sha = flags['--sha256'];
  const bytes = Number(flags['--bytes']);
  if (!id || typeof sha !== 'string' || flags['--bytes'] === undefined) usage('source-status requires --id --sha256 <64hex> --bytes <int>');
  if (!HEX64_RE.test(sha) || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes > SOURCE_MAX) usage('source-status requires --sha256 <64hex> --bytes <1..200000>');
  if (!SAFE_ID_RE.test(id)) fail('SOURCE_ID_INVALID');
  const dir = sourcesDir(root);
  const journal = loadSourceJournal(root, id);
  if (journal && journal.publishing) recoverPublishingSource(root, journal);
  if (journal && journal.published) {
    if (journal.published.sha256 !== sha || journal.published.bytes !== bytes) fail('SOURCE_IDENTITY_CONFLICT');
    ok({ published: true, path: join(dir, `${sha}.json`), sha256: sha, bytes });
  }
  ok({ published: false, committed_offset: journal ? journal.committed_offset : 0 });
}

// PAGE-LOCATOR-RECOVERY-ADDENDUM: the runner persists a VERIFIED fallback
// resolution here BEFORE import — the durable cache the next cycle consults
// before re-running the bounded read_page search. A differing value under
// the same identity is a conflict, never a rewrite.
function cmdLocatorResolved({ root, flags }) {
  const role = flags['--producer-role'];
  const generation = flags['--generation'];
  const locatorSha = flags['--locator-sha256'];
  const pageId = flags['--page-id'];
  const reference = flags['--reference'];
  const sourceSha = flags['--source-sha256'];
  const bytes = Number(flags['--bytes']);
  for (const v of [role, generation, locatorSha, pageId, reference, sourceSha]) {
    if (typeof v !== 'string' || v.length === 0) usage('locator-resolved requires --producer-role --generation --locator-sha256 --page-id --reference --source-sha256 --bytes');
  }
  if (!['collector', 'analyst', 'solver'].includes(role)) usage('--producer-role must be collector|analyst|solver');
  if (!/^[A-Z0-9][A-Z0-9-]{0,63}$/.test(generation)) usage('--generation must match the locator generation grammar');
  if (!HEX64_RE.test(locatorSha) || !HEX64_RE.test(sourceSha)) usage('--locator-sha256/--source-sha256 must be 64 lowercase hex');
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > SOURCE_MAX) usage('--bytes must be an integer in 1..200000');
  // only a FULL scheme reference is a resolution; a bare type-label is not
  if (reference.indexOf('library-file:/') !== 0 && reference.indexOf('project-file:/') !== 0) usage('--reference must be a full library-file:/ or project-file:/ reference');
  const { ledger } = openRoot(root);
  try {
    ok(ledger.recordLocatorResolution({
      producerRole: role, generation, locatorSha256: locatorSha,
      pageId, reference, sourceSha256: sourceSha, bytes,
    }));
  } catch (e) {
    fail(e.code ?? 'LOCATOR_RESOLUTION_ERROR');
  } finally { ledger.close(); }
}

function cmdDeliveryClaim({ root, flags }) {
  const { ledger } = openRoot(root);
  try {
    const id = flags['--id'];
    if (!id) usage('--id required');
    const c = ledger.claimDelivery(id);
    const m = ledger.getManifest(c.event_id);
    ok({
      delivery_id: c.delivery_id, event_id: c.event_id, destination: c.destination,
      state: c.state, artifact_sha256: c.artifact_sha256, artifact_path: c.artifact_path,
      source_page_id: c.source_page_id, source_reference: c.source_reference, parts: c.parts,
      // The exact stored manifest bytes — the bridge sends this verbatim as
      // the delivery prompt (BRIDGE-RUNNER-ADDENDUM send contract).
      manifest: m ? m.manifest_json : null,
    });
  } catch (e) {
    fail(e.code ?? 'DELIVERY_ERROR');
  } finally { ledger.close(); }
}

function cmdDeliveryReceipt({ root, flags }) {
  const id = flags['--id'];
  const status = flags['--status'];
  const file = flags['--receipt-file'];
  if (!id || !status || !file) usage('delivery-receipt requires --id --status --receipt-file');
  if (!['sent', 'not-sent', 'uncertain'].includes(status)) fail('RECEIPT_STATUS');
  const { obj: receipt } = readJsonFile(file);
  if (typeof receipt !== 'object' || receipt === null || typeof receipt.tool !== 'string') fail('RECEIPT_SHAPE');
  const { ledger } = openRoot(root);
  try {
    const r = ledger.receipt(id, { status, receipt });
    ok({ delivery_id: id, ...r });
  } catch (e) {
    fail(e.code ?? 'DELIVERY_ERROR');
  } finally { ledger.close(); }
}

function cmdImportAck({ root, flags }) {
  const file = flags['--file'];
  const role = flags['--producer-role'];
  // R04: there is no role-free ACK channel — the trusted producer role of the
  // configured caller is mandatory and must equal the delivery destination.
  if (!file || !role) usage('import-ack requires --file --producer-role');
  const { obj } = readJsonFile(file);
  const { ledger } = openRoot(root);
  try {
    const r = ledger.ack(obj, { trustedProducerRole: role });
    ok({ state: r.state, replay: r.replay === true });
  } catch (e) {
    fail(e.code ?? 'ACK_ERROR');
  } finally { ledger.close(); }
}

// R05: explicit OS-owner conflict resolution — the quarantine never clears by
// age; only this recorded disposition (with an actor identity) lifts it.
function cmdConflictResolve({ root, flags }) {
  const eventId = flags['--event-id'];
  const disposition = flags['--disposition'];
  const actor = flags['--actor'];
  if (!eventId || !disposition || !actor) usage('conflict-resolve requires --event-id --disposition --actor');
  const { ledger } = openRoot(root);
  try {
    const r = ledger.conflictResolve({ eventId, disposition, actor });
    ok({ state: r.state, disposition: r.disposition });
  } catch (e) {
    fail(e.code ?? 'CONFLICT_ERROR');
  } finally { ledger.close(); }
}

function cmdBaselineReceipt({ root, flags }) {
  const { obj } = readJsonFile(flags['--file']);
  const { ledger } = openRoot(root);
  try {
    const r = ledger.recordBaselineReceipt(obj);
    ok({ keys: r.keys });
  } catch (e) {
    fail(e.code ?? 'BASELINE_ERROR');
  } finally { ledger.close(); }
}

function cmdManifestImport({ root, flags }) {
  const { obj } = readJsonFile(flags['--file']);
  const { ledger } = openRoot(root);
  try {
    const r = ledger.manifestImport({ manifest: obj, producerRole: flags['--producer-role'], cursorToken: flags['--cursor-token'] });
    ok({ state: r.state, replay: r.replay === true });
  } catch (e) {
    fail(e.code ?? 'MANIFEST_ERROR');
  } finally { ledger.close(); }
}

function cmdSnapshotImport({ root, flags }) {
  const { obj } = readJsonFile(flags['--file']);
  const { ledger } = openRoot(root);
  try {
    const r = ledger.snapshotImport({ bundle: obj, producerRole: flags['--producer-role'], cursorToken: flags['--cursor-token'] });
    ok({ acks_imported: r.acks_imported, manifests_registered: r.manifests_registered, replay: r.replay === true });
  } catch (e) {
    fail(e.code ?? 'SNAPSHOT_ERROR');
  } finally { ledger.close(); }
}

function cmdReceiptClaim({ root, flags }) {
  const { ledger } = openRoot(root);
  try {
    const id = flags['--id'];
    if (!id) usage('--id required');
    const c = ledger.claimReceipt(id);
    ok({ receipt_id: c.receipt_id, destination: c.destination, prompt: c.prompt, state: c.state });
  } catch (e) {
    fail(e.code ?? 'RECEIPT_ERROR');
  } finally { ledger.close(); }
}

function cmdReceiptOutcome({ root, flags }) {
  const id = flags['--id'];
  const status = flags['--status'];
  const file = flags['--receipt-file'];
  if (!id || !status || !file) usage('receipt-outcome requires --id --status --receipt-file');
  if (!['sent', 'not-sent', 'uncertain'].includes(status)) fail('RECEIPT_STATUS');
  const { obj: receipt } = readJsonFile(file);
  if (typeof receipt !== 'object' || receipt === null || typeof receipt.tool !== 'string') fail('RECEIPT_SHAPE');
  const { ledger } = openRoot(root);
  try {
    const r = ledger.receiptOutcome(id, { status, receipt });
    ok({ receipt_id: id, ...r });
  } catch (e) {
    fail(e.code ?? 'RECEIPT_ERROR');
  } finally { ledger.close(); }
}

function cmdReceiptImport({ root, flags }) {
  const { obj } = readJsonFile(flags['--file']);
  const { ledger } = openRoot(root);
  try {
    const r = ledger.receiptImport({ receipt: obj, producerRole: flags['--producer-role'] });
    ok({ acks_imported: r.acks_imported, replay: r.replay === true });
  } catch (e) {
    fail(e.code ?? 'RECEIPT_ERROR');
  } finally { ledger.close(); }
}

function cmdIndexImport({ root, flags }) {
  const { obj, text } = readJsonFile(flags['--file']);
  const { ledger } = openRoot(root);
  try {
    const r = ledger.indexImport({
      index: obj, producerRole: flags['--producer-role'], cursor: flags['--cursor'] ?? null,
      expectedIndexSha256: flags['--expected-index-sha256'], rawText: text,
    });
    ok({ pages_imported: r.pages_imported, next_page_number: r.next_page_number, complete: r.complete, replay: r.replay === true });
  } catch (e) {
    fail(e.code ?? 'INDEX_ERROR');
  } finally { ledger.close(); }
}

// metadata-put: opaque chunked metadata writes (COORDINATOR-BRIDGE.md §20)

function scanForbiddenKeys(value) {
  if (Array.isArray(value)) return value.some(scanForbiddenKeys);
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_METADATA_KEYS.has(k)) return true;
      if (scanForbiddenKeys(v)) return true;
    }
  }
  return false;
}

function cmdMetadataPut({ root, flags }) {
  checkRoot(root);
  const id = flags['--id'];
  const chunkJson = flags['--chunk-json'];
  const final = flags['--final'];
  if (!id || chunkJson === undefined || final === undefined) usage('metadata-put requires --id --chunk-json --final');
  if (!SAFE_ID_RE.test(id)) fail('BAD_ID');
  let chunk;
  try {
    chunk = JSON.parse(chunkJson);
  } catch {
    fail('CHUNK_NOT_JSON');
  }
  if (typeof chunk !== 'string') fail('CHUNK_NOT_STRING');
  if (Buffer.byteLength(chunk, 'utf8') > CHUNK_MAX) fail('CHUNK_OVERSIZE');
  mkdirSync(join(root, 'inbox'), { recursive: true });
  const finalPath = join(root, 'inbox', `${id}.json`);
  const partPath = `${finalPath}.part`;
  const fd = openSync(partPath, 'a', 0o600);
  writeSync(fd, chunk, null, 'utf8');
  closeSync(fd);
  const total = statBytes(partPath);
  if (total > METADATA_MAX) fail('METADATA_OVERSIZE'); // enforce even mid-stream
  if (final !== 'true') {
    ok({ id, pending: true, path: partPath });
    return;
  }
  let parsed;
  try {
    parsed = parseStrictJson(readFileSync(partPath, 'utf8'));
  } catch {
    fail('METADATA_NOT_JSON');
  }
  if (scanForbiddenKeys(parsed)) fail('METADATA_FORBIDDEN_KEY');
  renameSync(partPath, finalPath);
  ok({ id, path: finalPath });
}

function cmdBridgeActivated({ root, flags }) {
  const automationId = flags['--automation-id'];
  if (!automationId || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(automationId)) fail('BAD_AUTOMATION_ID');
  const { ledger } = openRoot(root);
  try {
    const receiptPath = join(root, 'bridge-activation.json');
    if (existsSync(receiptPath)) {
      let prior;
      try {
        prior = JSON.parse(readFileSync(receiptPath, 'utf8'));
      } catch {
        fail('ACTIVATION_RECEIPT_CORRUPT');
      }
      if (prior.automation_id !== automationId) fail('AUTOMATION_CONFLICT');
      ok({ automation_id: automationId, replay: true, off_cleared: false });
      return;
    }
    const receipt = {
      automation_id: automationId,
      os_user: process.env.USER ?? null,
      at: new Date().toISOString(),
      deployment_mode: 'HYBRID',
    };
    atomicWrite(receiptPath, `${JSON.stringify(receipt)}\n`);
    // never clears OFF: durable OFF persists until explicit operator resume
    ok({ automation_id: automationId, replay: false, off_cleared: false });
  } finally { ledger.close(); }
}

function cmdStatus({ root }) {
  const { ledger } = openRoot(root);
  try {
    const st = ledger.status();
    // Read-only: status never reconciles (§2) — it only reports scheduler state.
    const scheduler = ledger.schedulerControl();
    let timer = null;
    const tp = join(root, 'timer.json');
    if (existsSync(tp)) {
      try { timer = JSON.parse(readFileSync(tp, 'utf8')); } catch { timer = null; }
    }
    ok({ ...st, scheduler, timer });
  } finally { ledger.close(); }
}

// ---------------------------------------------------------------- timer

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildPlist(root) {
  const args = [process.execPath, SELF, 'tick', '--root', root];
  // HOST-RESILIENCE §1: calendar timer — six 4h slots coalesce missed firings
  // into one wake event; RunAtLoad covers login/restart. KeepAlive stays false
  // (no keep-awake loop); StartInterval is NEVER set alongside.
  const cal = TIMER_HOURS
    .map((h) => `    <dict><key>Hour</key><integer>${h}</integer><key>Minute</key><integer>0</integer></dict>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(TIMER_LABEL)}</string>
  <key>ProgramArguments</key>
  <array>
${args.map((a) => `    <string>${xmlEscape(a)}</string>`).join('\n')}
  </array>
  <key>StartCalendarInterval</key>
  <array>
${cal}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
</dict>
</plist>
`;
}

function cmdInstallTimer({ root, flags }) {
  const { ledger } = openRoot(root);
  try {
    const writeOnly = flags['--write-only'] === true;
    const plistDir = flags['--plist-dir'] ?? join(homedir(), 'Library', 'LaunchAgents');
    mkdirSync(plistDir, { recursive: true });
    const plistPath = join(plistDir, `${TIMER_LABEL}.plist`);
    const xml = buildPlist(root);
    if (existsSync(plistPath)) {
      const existing = readFileSync(plistPath, 'utf8');
      if (existing !== xml) fail('BLOCKED_TIMER_CONFLICT'); // never unload/replace a differing label config
    } else {
      atomicWrite(plistPath, xml);
    }
    // Install preflight: the plist must lint as valid property-list XML
    // before anything loads it (plutil is macOS-only; absent elsewhere = null).
    let lintOk = null;
    if (existsSync('/usr/bin/plutil')) {
      const lint = spawnSync('/usr/bin/plutil', ['-lint', plistPath], { encoding: 'utf8' });
      lintOk = lint.status === 0;
      if (!lintOk) fail('PLIST_LINT_FAILED');
    }
    let bootstrapped = false;
    let printOk = null;
    if (!writeOnly) {
      const uid = spawnSync('id', ['-u'], { encoding: 'utf8' }).stdout.trim();
      const r = spawnSync('launchctl', ['bootstrap', `gui/${uid}`, plistPath], { encoding: 'utf8' });
      bootstrapped = r.status === 0;
      if (!bootstrapped) fail('BOOTSTRAP_FAILED');
      // Receipt-grade proof the exact GUI domain label is live (read-only).
      const pr = spawnSync('launchctl', ['print', `gui/${uid}/${TIMER_LABEL}`], { encoding: 'utf8' });
      printOk = pr.status === 0;
    }
    const receipt = {
      label: TIMER_LABEL,
      calendar_hours: TIMER_HOURS,
      minute: 0,
      interval_seconds: null, // calendar timer: StartInterval is never set
      run_at_load: true,
      keep_alive: false,
      login_required: true, // LaunchAgent: runs only after the user logs in
      calendar_wake_coalescing: true, // missed slots coalesce into one wake tick
      plist_path: plistPath,
      lint_ok: lintOk,
      bootstrapped,
      launchctl_print_ok: printOk,
      at: new Date().toISOString(),
    };
    atomicWrite(join(root, 'timer.json'), `${JSON.stringify(receipt)}\n`);
    ok({
      label: TIMER_LABEL,
      plist_path: plistPath,
      bootstrapped,
      lint_ok: lintOk,
      calendar_hours: TIMER_HOURS,
      run_at_load: true,
      keep_alive: false,
      launchctl_print_ok: printOk,
    });
  } finally { ledger.close(); }
}

// Explicit operator resume: the ONLY path that clears a durable OFF
// (HOST-RESILIENCE §1 scenario 9). The OFF.json receipt stays on disk as a
// historical record; nothing gates on its existence.
function cmdResume({ root, flags }) {
  const actor = flags['--actor'];
  if (!actor || actor.length < 3) usage('--actor (>=3 chars) required');
  const { ledger } = openRoot(root);
  try {
    if (!ledger.status().off) return ok({ ok: true, off: false, cleared: false });
    ledger.clearOff({ actor });
    ok({ ok: true, off: false, cleared: true, actor });
  } finally { ledger.close(); }
}

// bridge-source: the trusted-source loader entry for the coordinator
// bootstrap (BRIDGE-RUNNER-ADDENDUM). Returns the EXACT deployed body bytes
// plus trusted metadata config, only when the caller's pinned SHA, the
// on-root reviewed pin file, and the actual file bytes all agree. A symlink,
// an oversize file, or any pin disagreement is BRIDGE_SOURCE_UNTRUSTED —
// refused before a single byte of source is handed out.
function cmdBridgeSource({ root, flags }) {
  const expected = flags['--expected-sha256'];
  if (!expected || !/^[0-9a-f]{64}$/.test(expected)) usage('--expected-sha256 (64 lowercase hex) required');
  const { ledger } = openRoot(root);
  try {
    const bodyPath = join(HERE, 'bridge-runner.body.js');
    let st;
    try { st = lstatSync(bodyPath); } catch { fail('BRIDGE_SOURCE_UNTRUSTED'); }
    if (st.isSymbolicLink()) fail('BRIDGE_SOURCE_UNTRUSTED');
    const resolved = resolve(bodyPath);
    if (dirname(resolved) !== HERE) fail('BRIDGE_SOURCE_UNTRUSTED');
    let bytes;
    try { bytes = readFileSync(bodyPath); } catch { fail('BRIDGE_SOURCE_UNTRUSTED'); }
    if (bytes.length > 64 * 1024) fail('BRIDGE_SOURCE_UNTRUSTED');
    const sha = sha256OfBuffer(bytes);
    let pin = null;
    try { pin = JSON.parse(readFileSync(join(root, 'bridge-runner-pin.json'), 'utf8')); } catch { pin = null; }
    if (!pin || typeof pin !== 'object' || pin.version !== 1
      || typeof pin.sha256 !== 'string' || pin.sha256 !== sha
      || typeof pin.source_commit !== 'string' || !/^[0-9a-f]{40,64}$/.test(pin.source_commit)
      || expected !== sha) {
      fail('BRIDGE_SOURCE_UNTRUSTED');
    }
    const config = {
      root,
      cli: SELF,
      node: process.execPath,
      expected_source_sha256: sha,
      source_commit: pin.source_commit,
      ids: {
        collector: CHAT_IDS.collector,
        analyst: CHAT_IDS.analyst,
        solver: CHAT_IDS.solver,
      },
      coordinator_id: CHAT_IDS.coordinator,
      // PAGE-LOCATOR-RECOVERY-ADDENDUM §registry — solver stays disabled
      // (absent), so its fallback can never fire.
      page_registry: {
        collector: 'page_070fdd367758819192e503c9cee51251',
        analyst: 'page_955c5f291f788719199e9ba5da85bee76',
      },
      cycle_wall_budget_ms: 45_000,
      event_limit: 10,
      index_page_limit: 10,
    };
    ok({ version: 1, sha256: sha, source: bytes.toString('utf8'), config });
  } finally { ledger.close(); }
}

// ---------------------------------------------------------------- off / stop

// R09: OFF routes through the SAME fresh ownership/death adapter as
// CONFIRM_DEAD (proveProcessDeath) — never ps-start/session/control prose.
// A proven-dead child (absent / old-boot / never-started) reports the
// structured kind; an exact-live child gets the finite wall-bounded cessation
// ladder (classify -> TERM -> grace -> re-probe -> KILL -> re-probe); an
// unprovable identity is reported uncertain and NEVER signaled.
async function cmdOff({ root, flags }) {
  const reason = flags['--reason'];
  if (!reason || reason.length < 10) usage('--reason (>=10 chars) required');
  const { ledger } = openRoot(root);
  try {
    ledger.setOff({ reason });
    atomicWrite(join(root, 'OFF.json'), `${JSON.stringify({ reason, at: new Date().toISOString(), os_user: process.env.USER ?? null })}\n`);
    let child = null;
    const active = ledger.status().execution;
    const row = active && active.id ? ledger.getExecution(active.id) : null;
    if (row && Number.isInteger(row.pid)) {
      const attempt = ledger.getAttempt(row.id, row.attempts_admitted || 1);
      const proof = proveProcessDeath({
        pid: row.pid,
        processStart: row.process_start ?? null,
        recordedBootId: attempt?.boot_id ?? null,
        currentBootId: bootSessionUuid(),
        processProbe: productionProcessProbe,
      });
      if (proof.dead) {
        child = { dead: true, kind: proof.kind, verdict: proof.verdict, signaled: false };
      } else if (proof.verdict === 'exact-live') {
        // same ladder semantics as the supervised paths; an adopted-style child
        // has no exit event we can observe, so the grace is a bounded WALL wait
        const sessionId = attempt?.session_id ?? row.session_id ?? DEATH_PROOF_SESSION;
        const recorded = { pid: row.pid, process_start: row.process_start ?? null, session_id: sessionId };
        const classifyLive = () => {
          const p = productionProcessProbe(row.pid);
          return classifyProbe(recorded, p && p.alive === true
            ? { pid: row.pid, start: p.start ?? null, found: true }
            : { found: false }, sessionId);
        };
        const verdict = await runCessationLadder({
          classify: classifyLive,
          term: () => { try { process.kill(row.pid, 'SIGTERM'); } catch { /* gone */ } },
          kill: () => { try { process.kill(row.pid, 'SIGKILL'); } catch { /* gone */ } },
          waitExit: async (ms) => { await new Promise((res) => setTimeout(res, ms)); return false; },
        });
        child = {
          dead: verdict.dead,
          kind: verdict.evidence === 'absent' ? 'absent' : null,
          verdict: verdict.evidence,
          signaled: verdict.signaled,
        };
      } else {
        child = { dead: false, kind: null, verdict: proof.verdict, signaled: false };
      }
    } else if (row) {
      // pid never recorded: the row itself proves the child never started
      child = { dead: true, kind: 'never-started', verdict: 'never-started', signaled: false };
    }
    // unload only this timer label, only when we bootstrapped it
    let timerUnloaded = false;
    const tp = join(root, 'timer.json');
    if (existsSync(tp)) {
      let receipt = null;
      try { receipt = JSON.parse(readFileSync(tp, 'utf8')); } catch { receipt = null; }
      if (receipt && receipt.bootstrapped) {
        const uid = spawnSync('id', ['-u'], { encoding: 'utf8' }).stdout.trim();
        const r = spawnSync('launchctl', ['bootout', `gui/${uid}/${TIMER_LABEL}`], { encoding: 'utf8' });
        timerUnloaded = r.status === 0;
      }
    }
    ok({ off: true, child, timer_unloaded: timerUnloaded });
  } finally { ledger.close(); }
}

// R09: CONFIRM_DEAD runs the SAME fresh ownership/death adapter BEFORE the
// ledger call — the slot frees only on a structured death proof, never on
// ps-start text plus control prose.
async function cmdReconcileExecution({ root, flags }) {
  const id = flags['--id'];
  const decision = flags['--decision'];
  const control = flags['--control'];
  if (!id || !decision) usage('reconcile-execution --id <execution-id> --decision CONFIRM_DEAD --control "<>=20 chars>" required');
  if (decision !== 'CONFIRM_DEAD') fail('RECONCILE_DECISION', { decision });
  if (!control || control.length < 20) usage('--control (>=20 chars, explicit operator/coordinator input) required');
  const { ledger } = openRoot(root);
  try {
    const row = ledger.getExecution(id);
    if (!row) fail('UNKNOWN_EXECUTION', { id });
    const attempt = ledger.getAttempt(id, row.attempts_admitted || 1);
    const proof = proveProcessDeath({
      pid: row.pid ?? null,
      processStart: row.process_start ?? null,
      recordedBootId: attempt?.boot_id ?? null,
      currentBootId: bootSessionUuid(),
      processProbe: productionProcessProbe,
    });
    if (!proof.dead) fail('RECONCILE_NOT_DEAD', { verdict: proof.verdict });
    const r = ledger.reconcileExecution({
      execution_id: id,
      decision,
      evidence: {
        session_id: row.session_id,
        control,
        death_proof: {
          kind: proof.kind,
          execution_id: id,
          pid: row.pid ?? null,
          process_start: row.process_start ?? null,
        },
      },
    });
    ok({ ...r, execution_id: id, death_proof_kind: proof.kind });
  } finally { ledger.close(); }
}

// ---------------------------------------------------------------- main

const HANDLERS = {
  init: cmdInit,
  tick: cmdTick,
  supervise: cmdSupervise,
  'review-import': cmdReviewImport,
  plan: cmdPlan,
  'spool-begin': cmdSpoolBegin,
  'spool-append': cmdSpoolAppend,
  'spool-part-begin': cmdSpoolPartBegin,
  'spool-part-finish': cmdSpoolPartFinish,
  'spool-finish': cmdSpoolFinish,
  'delivery-claim': cmdDeliveryClaim,
  'delivery-receipt': cmdDeliveryReceipt,
  'import-ack': cmdImportAck,
  'conflict-resolve': cmdConflictResolve,
  'baseline-receipt': cmdBaselineReceipt,
  'manifest-import': cmdManifestImport,
  'snapshot-import': cmdSnapshotImport,
  'receipt-import': cmdReceiptImport,
  'index-import': cmdIndexImport,
  'receipt-claim': cmdReceiptClaim,
  'receipt-outcome': cmdReceiptOutcome,
  'metadata-put': cmdMetadataPut,
  'source-put': cmdSourcePut,
  'source-status': cmdSourceStatus,
  'locator-resolved': cmdLocatorResolved,
  'bridge-activated': cmdBridgeActivated,
  'bridge-source': cmdBridgeSource,
  status: cmdStatus,
  'install-timer': cmdInstallTimer,
  off: cmdOff,
  resume: cmdResume,
  'reconcile-execution': cmdReconcileExecution,
  'reconcile-external-recovery': cmdReconcileExternalRecovery,
};

const parsed = parseArgs(process.argv.slice(2));
if (!parsed.root) usage('--root is required');
await HANDLERS[parsed.command]({ root: parsed.root, flags: parsed.flags });
