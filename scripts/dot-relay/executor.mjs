// Dot relay executor supervisor — DESIGN.md §Executor + §Worker startup.
//
// Foreground glm child (exact PID/exit), argument arrays only, no shell, no
// fallback model, no --bare. Fresh session UUID persisted (RESERVED) before
// spawn. Supervisor verifies startup evidence itself (git inside the resolved
// native worktree) — worker assertions alone are never sufficient.
//
// Privacy: child stdout/stderr land in 0600 private files; summaries carry
// fixed codes and ids only, never report bodies, prompts or secrets.

import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, openSync, closeSync, writeSync, ftruncateSync, readFileSync, writeFileSync, renameSync, rmSync, lstatSync, fsyncSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseChildResult, EXECUTOR_MODEL } from '../advisor-bridge-beta/process.mjs';

export const GLM_WRAPPER = '/Users/art/.local/bin/glm';
export const EXECUTION_MODEL = EXECUTOR_MODEL; // 'glm-5.3'
export const DISALLOWED_TOOLS = 'Bash(gh pr merge*) Bash(git push *--force*) Bash(git rebase*)';

// KICKOFF.md base allowlist + the two binding branch-switch additions.
export const ALLOW_TOOLS = [
  'Read', 'Glob', 'Grep', 'Edit', 'Write', 'Agent',
  'Bash(node *)', 'Bash(npm ci*)', 'Bash(npm run *)', 'Bash(npm test*)', 'Bash(make self-audit*)',
  'Bash(git status*)', 'Bash(git diff*)', 'Bash(git rev-parse*)', 'Bash(git branch*)',
  'Bash(git log*)', 'Bash(git show*)', 'Bash(git fetch*)', 'Bash(git add*)', 'Bash(git commit*)',
  'Bash(git push*)',
  'Bash(gh pr view*)', 'Bash(gh pr list*)', 'Bash(gh pr checks*)', 'Bash(gh pr create*)',
  'Bash(gh pr edit*)', 'Bash(gh run view*)', 'Bash(gh api repos/artyhoo/getff/commits/*)',
  'Bash(bash .claude/skills/dispatcher/helpers/probe-inflight.sh*)',
  'Bash(launchctl print*)', 'Bash(launchctl bootstrap*)', 'Bash(launchctl bootout*)',
  'Bash(git switch -c codex/dot-scripted-relay*)',
  'Bash(git switch -c codex/dot-job-*)',
].join(' ');

// HOST-RESILIENCE §3: the attempt host-awake budget and its sub-window.
export const ATTEMPT_ACTIVE_BUDGET_MS = 7_200_000;
export const STARTUP_SUB_BUDGET_MS = 60_000;
export const ACTIVE_CLOCK_SCRIPT = fileURLToPath(new URL('./active-clock.py', import.meta.url));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// R11: strict digest shapes — a 64-lowercase-hex string or nothing. The old
// checkpoint contract accepted null/any-string artifact digests; the resume
// contract now binds exact bytes instead.
const HEX64 = /^[0-9a-f]{64}$/;
const sha256Of = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const sha256OfBytes = (b) => createHash('sha256').update(b).digest('hex');

export function buildArgv({ sessionId, prompt, worktreeName }) {
  if (typeof sessionId !== 'string' || sessionId.length < 8) throw new Error('[INVALID] sessionId');
  if (typeof prompt !== 'string' || prompt.length === 0) throw new Error('[INVALID] prompt');
  // DESIGN.md:62 — the child ALWAYS gets its own native worktree; a missing
  // name fails loud rather than silently launching on the shared checkout.
  if (typeof worktreeName !== 'string' || !/^[\w.-]+$/.test(worktreeName)) {
    throw new Error('[INVALID] worktreeName required (own native worktree, never the shared checkout)');
  }
  return [
    '--model', EXECUTION_MODEL,
    '--permission-mode', 'acceptEdits',
    '--permission-prompts', 'none',
    '--output-format', 'json',
    '--session-id', sessionId,
    '--worktree', worktreeName,
    '--allowedTools', ALLOW_TOOLS,
    '--disallowedTools', DISALLOWED_TOOLS,
    '-p', prompt,
  ];
}

// HOST-RESILIENCE §4: SAME-session resume — identical model pin and permission
// settings, --resume EXACT session id, and none of --session-id / --worktree /
// --continue (never a fresh session, never a second worktree).
export function buildResumeArgv({ sessionId, prompt }) {
  if (typeof sessionId !== 'string' || sessionId.length < 8) throw new Error('[INVALID] sessionId');
  if (typeof prompt !== 'string' || prompt.length === 0) throw new Error('[INVALID] prompt');
  return [
    '--model', EXECUTION_MODEL,
    '--permission-mode', 'acceptEdits',
    '--permission-prompts', 'none',
    '--output-format', 'json',
    '--resume', sessionId,
    '--allowedTools', ALLOW_TOOLS,
    '--disallowedTools', DISALLOWED_TOOLS,
    '-p', prompt,
  ];
}

// Production ActiveClock: the python stdlib helper reading mach_absolute_time
// (excludes host sleep — Node hrtime includes it and must never budget an
// attempt). Broken/backwards samples and helper death all surface as ok()=false
// -> CLOCK_UNPROVEN, fail closed. `ready(ms)` resolves once the first sample
// lands (boot identity is proven, not assumed).
//
// R08 independent freshness: the continuous helper alone cannot prove the
// budget — a STALLED helper would freeze active_ns forever. A background
// refresher queries the SAME script in `--sample-once` mode and keeps the
// latest VALIDATED independent sample; `fresh()` checks (same boot,
// monotonic — validated at store time — and bounded active-ms skew against
// the continuous stream) at every budget/identity decision. Query
// timeout/error/boot mismatch/backward sample make the clock unproven
// (sticky); a window violation is a freshness verdict (the next good probe
// restores it). Wall timers here bound only the PROBE and its watchdog —
// never the budget itself.
export const FRESH_WINDOW_MS = 5_000;
export const INDEPENDENT_REFRESH_MS = 2_000;
export const INDEPENDENT_WATCHDOG_MS = 10_000;

// Pure window verdict over real-shaped samples (both are mach_absolute_time
// nanoseconds — decimal-string origins already parsed to BigInt by callers).
export function validateFreshnessWindow({ helperBoot, helperNs, sample }) {
  const windowNs = BigInt(FRESH_WINDOW_MS) * 1_000_000n;
  if (!sample || typeof sample.boot !== 'string' || typeof sample.ns !== 'bigint') {
    return { ok: false, reason: 'shape' };
  }
  if (sample.boot !== helperBoot) return { ok: false, reason: 'boot-mismatch' };
  const gap = sample.ns - helperNs; // >0: independent ran ahead of the stream
  if (gap > windowNs) return { ok: false, reason: 'helper-stalled' };
  if (-gap > windowNs) return { ok: false, reason: 'independent-stale' };
  return { ok: true, reason: null };
}

// One bounded `--sample-once` probe of the SAME configured helper script —
// no new shell permissions, no model call. The wall watchdog (default 10s)
// kills a hung probe; resolution is always a verdict object, never a throw.
export function sampleOnceIndependent({ python = 'python3', script = ACTIVE_CLOCK_SCRIPT, timeoutMs = INDEPENDENT_WATCHDOG_MS } = {}) {
  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(python, [script, '--sample-once'], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      resolve({ ok: false, reason: 'spawn-error' });
      return;
    }
    let out = '';
    let done = false;
    let watchdog = null;
    const finish = (r) => {
      if (done) return;
      done = true;
      if (watchdog) clearTimeout(watchdog);
      try { proc.kill('SIGKILL'); } catch { /* already gone */ }
      resolve(r);
    };
    watchdog = setTimeout(() => finish({ ok: false, reason: 'watchdog-timeout' }), timeoutMs);
    if (typeof watchdog.unref === 'function') watchdog.unref();
    proc.stdout.on('data', (d) => { out += d.toString('utf8'); });
    proc.on('error', () => finish({ ok: false, reason: 'spawn-error' }));
    proc.on('exit', (code) => {
      if (code !== 0) {
        finish({ ok: false, reason: `exit-${code}` });
        return;
      }
      const lines = out.trim().split('\n').filter((l) => l.length > 0);
      try {
        const j = JSON.parse(lines[lines.length - 1] ?? '');
        if (typeof j.boot_id !== 'string' || !/^\d+$/.test(String(j.active_ns ?? ''))) {
          finish({ ok: false, reason: 'shape' });
          return;
        }
        finish({ ok: true, boot: j.boot_id, activeNs: String(j.active_ns) });
      } catch {
        finish({ ok: false, reason: 'shape' });
      }
    });
  });
}

export function startActiveClock({
  python = 'python3', graceS = 10,
  refreshMs = INDEPENDENT_REFRESH_MS, watchdogMs = INDEPENDENT_WATCHDOG_MS, sampler = null,
} = {}) {
  let proc = null;
  try {
    proc = spawn(python, [ACTIVE_CLOCK_SCRIPT], {
      stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env, DOT_RELAY_CLOCK_GRACE_S: String(graceS) },
    });
  } catch {
    proc = null;
  }
  const state = {
    boot: null, last: null, broken: proc === null, ready: false, waiters: [],
    ind: null, latest: null, stopping: false, // ind: monotonic baseline (max window-valid {boot,ns}); latest: last accepted probe
  };
  const sample = (line) => {
    try {
      const j = JSON.parse(line);
      if (typeof j.boot_id !== 'string' || !j.boot_id || !/^\d+$/.test(String(j.active_ns))) {
        state.broken = true;
        return;
      }
      const ns = BigInt(j.active_ns);
      if (state.last !== null && ns < state.last) {
        state.broken = true; // backwards sample — the budget is unprovable
        return;
      }
      state.last = ns;
      state.boot = j.boot_id;
      if (!state.ready) {
        state.ready = true;
        for (const w of state.waiters.splice(0)) w();
      }
    } catch {
      state.broken = true;
    }
  };
  if (proc) {
    let buf = '';
    proc.stdout.on('data', (d) => {
      buf += d.toString('utf8');
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line) sample(line);
      }
    });
    proc.on('exit', () => { state.broken = true; }); // helper death = clock death
    proc.on('error', () => { state.broken = true; });
    proc.stdin.on('error', () => { /* EPIPE after helper death */ });
  }

  // --- R08 independent freshness refresher (wall timers bound the PROBE only)
  const probeIndependent = sampler ?? (() => sampleOnceIndependent({ python, timeoutMs: watchdogMs }));
  let refreshTimer = null;
  let probeWatchdog = null;
  const scheduleRefresh = () => {
    if (state.stopping || state.broken) return;
    refreshTimer = setTimeout(refreshTick, refreshMs);
    if (typeof refreshTimer.unref === 'function') refreshTimer.unref();
  };
  const refreshTick = () => {
    if (state.stopping || state.broken) return;
    if (probeWatchdog) clearTimeout(probeWatchdog);
    probeWatchdog = setTimeout(() => { state.broken = true; }, watchdogMs); // query timeout -> unproven
    if (typeof probeWatchdog.unref === 'function') probeWatchdog.unref();
    let settled = false;
    Promise.resolve().then(() => probeIndependent()).then(
      (r) => {
        if (settled || state.stopping || state.broken) return;
        settled = true;
        clearTimeout(probeWatchdog);
        probeWatchdog = null;
        if (!r || r.ok !== true || typeof r.boot !== 'string' || !/^\d+$/.test(String(r.activeNs ?? ''))) {
          state.broken = true; // query error / bad shape -> unproven (sticky)
          return;
        }
        const ns = BigInt(r.activeNs);
        if (state.boot !== null && r.boot !== state.boot) {
          state.broken = true; // boot mismatch -> unproven (sticky)
          return;
        }
        const windowNs = BigInt(FRESH_WINDOW_MS) * 1_000_000n;
        if (state.ind !== null && ns < state.ind.ns - windowNs) {
          state.broken = true; // backward beyond any window jitter — mach time cannot go backwards
          return;
        }
        state.latest = { boot: r.boot, ns }; // verdict input: the newest accepted probe
        // Monotonic baseline: only window-valid samples enter it, so an
        // out-of-window probe (stalled helper / stalled refresher) surfaces via
        // fresh() without poisoning the baseline or faking a backward probe on
        // recovery.
        if (state.boot !== null && state.last !== null) {
          const v = validateFreshnessWindow({ helperBoot: state.boot, helperNs: state.last, sample: { boot: r.boot, ns } });
          if (v.ok && (state.ind === null || ns >= state.ind.ns)) state.ind = { boot: r.boot, ns };
        } else {
          state.ind = { boot: r.boot, ns }; // helper line pending; window applies once it lands
        }
        scheduleRefresh();
      },
      () => {
        if (settled || state.stopping) return;
        settled = true;
        state.broken = true; // query rejection -> unproven (sticky)
      },
    );
  };
  refreshTick(); // first probe immediately; later probes every refreshMs
  return {
    ok: () => !state.broken,
    bootId: () => state.boot,
    activeNs: () => (state.broken ? null : state.last),
    fresh() {
      if (state.broken) return false;
      if (state.latest === null) return true; // bootstrap grace — bounded by the probe watchdog
      if (state.boot === null || state.last === null) return true; // helper first line imminent; ready() gates use
      return validateFreshnessWindow({ helperBoot: state.boot, helperNs: state.last, sample: state.latest }).ok;
    },
    ready(timeoutMs = 5_000) {
      if (state.ready) return Promise.resolve(true);
      return new Promise((res) => {
        const t = setTimeout(() => res(state.ready === true), timeoutMs);
        state.waiters.push(() => { clearTimeout(t); res(true); });
      });
    },
    stop() {
      state.stopping = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (probeWatchdog) clearTimeout(probeWatchdog);
      if (!proc) return;
      try { proc.stdin.end(); } catch { /* already gone */ }
      try { proc.kill('SIGTERM'); } catch { /* already gone */ }
    },
    // §5 helper-side last resort: register the supervised child so helper EOF
    // (supervisor death / broken pipe) TERMs exactly that child.
    registerChild(pid, start) {
      if (!proc) return;
      try { proc.stdin.write(`${JSON.stringify({ child_pid: pid, child_start: start })}\n`); } catch { /* EPIPE: helper dead */ }
    },
  };
}

// Exact-identity ownership: pid + process start + session all must match.
// HOST-RESILIENCE §5: a missing start text on EITHER side fails closed — pid
// equality alone is never ownership (PID reuse).
export function isOwnedChild(recorded, current, sessionId) {
  if (!recorded || !current || typeof current !== 'object') return false;
  if (recorded.session_id !== sessionId) return false;
  if (current.pid !== recorded.pid) return false;
  if (recorded.process_start == null || current.start == null) return false;
  return recorded.process_start === current.start;
}

// ------------------------------------------------------------- R09 cessation
//
// DEAD is a VERDICT over evidence, never a side effect of a signal call.
// classifyProbe maps a fresh process-table probe to one of:
//   'exact-live' — pid + process_start + session all match: ours, running
//   'absent'     — the process table authoritively reports no such process
//   'reused'     — a process exists but the identity (pid/start) is NOT ours
//   'unknown'    — the probe is unreadable/unshaped: neither live nor absent
// A signal may only ever be sent across an 'exact-live' verdict.
export function classifyProbe(recorded, probe, sessionId) {
  if (!recorded || !probe || typeof probe !== 'object') return 'unknown';
  if (recorded.session_id !== sessionId) return 'unknown';
  if (probe.found === false) return 'absent'; // ps: no such process
  if (probe.pid !== recorded.pid) return probe.found === true ? 'reused' : 'unknown';
  if (recorded.process_start == null || probe.start == null) return 'unknown';
  if (recorded.process_start !== probe.start) return 'reused';
  return 'exact-live';
}

// R09 shared fresh-ownership/death adapter — the ONE proof both OFF and
// CONFIRM_DEAD route through (production CLI and fakes agree). Pure read: no
// signal is ever sent here. DEAD kinds:
//   'never-started' — the row never recorded a pid (pid == null ONLY; a pid
//                     with a null start text is identity-unprovable -> unknown)
//   'old-boot'      — recorded on a different boot (both boot ids known): a
//                     previous-boot process cannot exist on this one
//   'absent'        — fresh process-table probe: authoritative absence
// Anything else is dead:false carrying the classify verdict
// ('exact-live' / 'reused' / 'unknown') — the caller holds, never frees.
export const DEATH_PROOF_SESSION = 'dot-relay-death-proof';

export function proveProcessDeath({ pid, processStart, recordedBootId, currentBootId, processProbe = defaultProcessProbe }) {
  if (pid == null) return { dead: true, kind: 'never-started', verdict: 'never-started' };
  if (typeof recordedBootId === 'string' && recordedBootId
    && typeof currentBootId === 'string' && currentBootId
    && recordedBootId !== currentBootId) {
    return { dead: true, kind: 'old-boot', verdict: 'old-boot' };
  }
  const recorded = { pid, process_start: processStart ?? null, session_id: DEATH_PROOF_SESSION };
  let probe;
  try { probe = processProbe(pid); } catch { return { dead: false, kind: null, verdict: 'unknown' }; }
  if (!probe || typeof probe !== 'object') return { dead: false, kind: null, verdict: 'unknown' };
  const verdict = classifyProbe(recorded, probe.alive === true
    ? { pid, start: probe.start ?? null, found: true }
    : { found: false }, DEATH_PROOF_SESSION);
  if (verdict === 'absent') return { dead: true, kind: 'absent', verdict };
  return { dead: false, kind: null, verdict };
}

// The finite wall-bounded ladder (HOST-RESILIENCE §5 / R09):
//   classify BEFORE each signal; TERM -> <=termGraceMs WALL wait -> re-probe;
//   still exact-live -> KILL -> <=killGraceMs WALL wait -> final re-probe.
// Wall sleeps only — a dead/frozen active clock can never extend or loop it.
// Returns { dead, evidence, signaled }:
//   dead      — proved by observed exit ('exit') or authoritative absence ('absent')
//   evidence  — 'exit' | 'absent' | 'live' | 'reused' | 'unknown'
//   signaled  — whether ANY signal was delivered (uncertainty bookkeeping)
export function runCessationLadder({ classify, term, kill, waitExit, termGraceMs = 10_000, killGraceMs = 1_000 }) {
  return (async () => {
    const first = classify();
    if (first === 'absent') return { dead: true, evidence: 'absent', signaled: false };
    if (first !== 'exact-live') return { dead: false, evidence: first, signaled: false };
    term();
    const exited1 = await waitExit(termGraceMs);
    if (exited1 === true) return { dead: true, evidence: 'exit', signaled: true };
    const second = classify();
    if (second === 'absent') return { dead: true, evidence: 'absent', signaled: true };
    if (second !== 'exact-live') return { dead: false, evidence: second, signaled: true };
    kill();
    const exited2 = await waitExit(killGraceMs);
    if (exited2 === true) return { dead: true, evidence: 'exit', signaled: true };
    const third = classify();
    if (third === 'absent') return { dead: true, evidence: 'absent', signaled: true };
    return { dead: false, evidence: third === 'exact-live' ? 'live' : third, signaled: true };
  })();
}

function startupPreamble({ jobBranch, baseSha, receiptPath, executionId, sessionId }) {
  return [
    '# Dot relay supervised execution — fixed startup contract',
    `1. FIRST command, before any edit: git switch -c ${jobBranch} ${baseSha} (exact supervisor substitutions; never alter them).`,
    `2. Write the private startup receipt JSON to ${receiptPath} with fields:`,
    `   {"session_id":"${sessionId}","execution_id":"${executionId}","worktree":"<absolute native worktree path>",`,
    '   "head":"<git rev-parse HEAD>","toplevel":"<git rev-parse --show-toplevel>","branch":"<git branch --show-current>","clean":"<git status --porcelain>"}',
    '3. Only after that receipt file exists may you edit files or cause any push/PR side effect.',
    '4. Never merge, never arm auto-merge, never force-push; report the exact pushed head.',
    '5. Final stdout must be the single JSON result object with pr_url and head_sha.',
    '',
  ].join('\n');
}

// R11: verify the TRUSTED packet before any attempt reservation/spawn, in BOTH
// run and resume modes. Authority is the solution's REGISTERED manifest — the
// whole-artifact hash/bytes of the original serialized envelope — plus the
// kickoff digest the payload itself declares. No synthetic fallback: an
// unregistered manifest, a whole-file mismatch, or a kickoff digest mismatch
// is BLOCKED_PACKET_UNTRUSTED, never a guess.
function verifySolutionPacket({ ledger, solution }) {
  const manifest = ledger.getManifest(solution.id);
  if (!manifest
    || typeof manifest.artifact_sha256 !== 'string' || !HEX64.test(manifest.artifact_sha256)
    || !Number.isSafeInteger(manifest.artifact_bytes)) {
    return { ok: false, reason: 'manifest-missing' };
  }
  // Canonical whole-file reconstruction (contract ENVELOPE key order):
  // version, kind, id, producer, parents, payload, sha256.
  const wholeFile = JSON.stringify({
    version: 1,
    kind: solution.kind,
    id: solution.id,
    producer: solution.producer,
    parents: solution.parents ?? [],
    payload: solution.payload,
    sha256: solution.sha256,
  });
  if (sha256Of(wholeFile) !== manifest.artifact_sha256
    || Buffer.byteLength(wholeFile) !== manifest.artifact_bytes) {
    return { ok: false, reason: 'artifact-mismatch' };
  }
  const kickoffText = String(solution.payload.kickoff ?? '');
  const kickoffSha = sha256Of(kickoffText);
  if (typeof solution.payload.kickoff_sha256 !== 'string'
    || !HEX64.test(solution.payload.kickoff_sha256)
    || solution.payload.kickoff_sha256 !== kickoffSha) {
    return { ok: false, reason: 'kickoff-mismatch' };
  }
  return {
    ok: true,
    packet: {
      artifact_sha256: manifest.artifact_sha256,
      artifact_bytes: manifest.artifact_bytes,
      kickoff_sha256: kickoffSha,
      kickoff_text: kickoffText,
    },
  };
}

// R11: publish a private IMMUTABLE worker artifact — 0600, fsynced, atomically
// renamed. A symlink (or any non-regular file) at the path is refused via
// lstat, never followed or written through. Byte-identical pre-existing
// content is an idempotent no-op (the ONLY replay accepted); drifted bytes are
// refused and never overwritten.
function writePrivateArtifact(filePath, bytes) {
  try {
    const st = lstatSync(filePath);
    if (!st.isFile()) return { ok: false, reason: 'not-regular-file' }; // symlink/fifo/dir
    const existing = readFileSync(filePath);
    if (existing.equals(bytes)) return { ok: true, digest: sha256OfBytes(existing), existed: true };
    return { ok: false, reason: 'drift' };
  } catch (err) {
    if (err.code !== 'ENOENT') return { ok: false, reason: 'unverifiable' };
  }
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const fd = openSync(tmp, 'w', 0o600);
  try {
    writeSync(fd, bytes, 0);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, filePath);
  const dirFd = openSync(dirname(filePath), 'r');
  try { fsyncSync(dirFd); } finally { closeSync(dirFd); }
  return { ok: true, digest: sha256OfBytes(bytes), existed: false };
}

// R11: verify the durable packet BYTES at resume/adopt time — before census,
// worktree checks, admission or spawn, the checkpoint's kickoff/framing
// digests must match the exact regular files on disk. Missing, non-regular
// (symlink), unreadable, or drifted bytes all fail closed.
function verifyPacketBytes({ kickoffPath, framingPath, kickoffSha256, framingSha256 }) {
  for (const [path, sha] of [[kickoffPath, kickoffSha256], [framingPath, framingSha256]]) {
    if (typeof sha !== 'string' || !HEX64.test(sha)) return { ok: false, reason: 'digest-shape' };
    let st;
    try { st = lstatSync(path); } catch { return { ok: false, reason: 'missing' }; }
    if (!st.isFile()) return { ok: false, reason: 'not-regular-file' };
    let existing;
    try { existing = readFileSync(path); } catch { return { ok: false, reason: 'unreadable' }; }
    if (sha256OfBytes(existing) !== sha) return { ok: false, reason: 'digest-mismatch' };
  }
  return { ok: true };
}

// R11: the -p carries ONLY the constant instruction plus the two private file
// PATHS and their digests — kickoff/framing bytes never ride the argv. The
// worker reads the packet from the files, never from the command line.
function workerPrompt({ kickoffPath, framingPath, kickoffSha256, framingSha256 }) {
  return [
    '# Dot relay supervised execution — fixed startup contract',
    `1. Read the framing contract file (private; its exact bytes are mandatory): ${framingPath} (sha256 ${framingSha256}).`,
    `2. Read the kickoff artifact file (private; its exact bytes are mandatory): ${kickoffPath} (sha256 ${kickoffSha256}).`,
    '3. Execute exactly what those two files specify; never modify, move, copy, or re-emit them.',
    '4. Never merge, never arm auto-merge, never force-push; report the exact pushed head.',
    '5. Final stdout must be the single JSON result object with pr_url and head_sha.',
    '',
  ].join('\n');
}

// Supervisor-side startup verification: receipt identity + independent git proofs.
function verifyStartupReceipt({ receiptPath, sessionId, executionId, gitImpl, expect }) {
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  } catch {
    return null;
  }
  if (receipt.session_id !== sessionId || receipt.execution_id !== executionId) return null;
  if (typeof receipt.worktree !== 'string' || !receipt.worktree.startsWith('/')) return null;
  const head = gitImpl(['rev-parse', 'HEAD'], { cwd: receipt.worktree });
  const branch = gitImpl(['branch', '--show-current'], { cwd: receipt.worktree });
  const status = gitImpl(['status', '--porcelain'], { cwd: receipt.worktree });
  if (head.code !== 0 || head.stdout.trim() !== expect.head) return null;
  if (branch.code !== 0 || branch.stdout.trim() !== expect.branch) return null;
  if (status.code !== 0 || status.stdout.trim() !== '') return null;
  return { worktree: receipt.worktree };
}

// ------------------------------------------------------------- production impls

function procStart(pid) {
  try {
    return execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function productionGit(args, { cwd } = {}) {
  try {
    const stdout = execFileSync('git', args, { cwd, encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status ?? 1, stdout: typeof err.stdout === 'string' ? err.stdout : '' };
  }
}

const productionGh = {
  view(args) { return JSON.parse(execFileSync('gh', args, { encoding: 'utf8' })); },
  checks(args) { return JSON.parse(execFileSync('gh', args, { encoding: 'utf8' })); },
};

function productionSpawn(executable, argv, { cwd, stdoutPath, stderrPath, env }) {
  const out = openSync(stdoutPath, 'w', 0o600);
  const err = openSync(stderrPath, 'w', 0o600);
  const real = spawn(executable, argv, { cwd, env, stdio: ['ignore', out, err] });
  const started = procStart(real.pid);
  return {
    pid: real.pid,
    start: started,
    onExit(cb) {
      real.on('exit', (code, signal) => {
        closeSync(out);
        closeSync(err);
        cb(code, signal);
      });
    },
    kill(sig) { return real.kill(sig); },
    // §5 pre-signal re-probe: live OS identity read, not the stale capture.
    probe() { return { pid: real.pid, start: procStart(real.pid) }; },
  };
}

// ------------------------------------------------------------- R07 lock / census

// Probe a pid's live identity via /bin/ps lstart — the same OS source the
// ledger's host reconciliation trusts.
export function defaultProcessProbe(pid) {
  const start = procStart(pid);
  return start ? { alive: true, start } : { alive: false, start: null };
}

// R07: exclusive worker-slot ownership with CONSERVATIVE reconciliation. An
// existing lock is never blindly overwritten: the holder's recorded boot /
// process identity decides — a previous-boot or proven-dead holder is taken
// over with the displaced bytes retained as evidence; a live or unprovable
// holder blocks. Identity IS the boot: a previous-boot process cannot exist
// on this one, regardless of pid text.
export function acquireSupervisorLock({ workerDir, executionId = null, bootId, processProbe = defaultProcessProbe }) {
  mkdirSync(workerDir, { recursive: true });
  const lockPath = join(workerDir, 'supervisor.lock');
  const record = (takeover) => JSON.stringify({
    pid: process.pid, start: procStart(process.pid), boot_id: bootId ?? null,
    execution_id: executionId ?? null, takeover,
  });
  let fd;
  try {
    fd = openSync(lockPath, 'wx', 0o600);
  } catch {
    if (bootId == null) return { blocked: 'SUPERVISOR_LOCK_UNPROVEN', lockPath };
    let holder = null;
    try {
      const parsed = JSON.parse(readFileSync(lockPath, 'utf8'));
      if (parsed && typeof parsed === 'object'
        && typeof parsed.boot_id === 'string' && parsed.boot_id
        && Number.isInteger(parsed.pid)
        && (typeof parsed.start === 'string' || parsed.start === null)) holder = parsed;
    } catch { /* not JSON: identity cannot be proven */ }
    if (!holder) return { blocked: 'SUPERVISOR_LOCK_UNPROVEN', lockPath };
    let reason = null;
    if (holder.boot_id !== bootId) {
      reason = 'previous-boot';
    } else {
      const probe = typeof processProbe === 'function' ? processProbe(holder.pid) : null;
      if (!probe || typeof probe !== 'object') return { blocked: 'SUPERVISOR_LOCK_UNPROVEN', lockPath };
      if (probe.alive) {
        if (typeof holder.start !== 'string' || !holder.start || probe.start == null) {
          return { blocked: 'SUPERVISOR_LOCK_UNPROVEN', lockPath };
        }
        if (probe.start === holder.start) {
          return { blocked: 'SUPERVISOR_LOCK', lockPath, held_by: { pid: holder.pid, boot_id: holder.boot_id } };
        }
        reason = 'pid-reused';
      } else {
        reason = 'holder-dead';
      }
    }
    renameSync(lockPath, `${lockPath}.stale-${Date.now()}`); // evidence retained, never deleted
    fd = openSync(lockPath, 'wx', 0o600);
    const takeover = { reason, previous: { pid: holder.pid, start: holder.start ?? null, boot_id: holder.boot_id } };
    writeSync(fd, record(takeover));
    return { fd, lockPath, takeover };
  }
  writeSync(fd, record(null));
  return { fd, lockPath, takeover: null };
}

// R07 review partial: release the worker slot ONLY when the lock file still
// carries THIS supervisor's exact identity — a successor that took over the
// path (previous-boot / pid-reused / dead-owner reconciliation) owns it now,
// and the displaced supervisor's exit must leave their lock untouched.
// Unreadable bytes are never deleted either: what cannot be proven ours is
// not ours to remove.
function releaseSupervisorLock(lockPath, identity) {
  let parsed = null;
  try { parsed = JSON.parse(readFileSync(lockPath, 'utf8')); } catch { return false; }
  if (!parsed || typeof parsed !== 'object') return false;
  if (parsed.pid !== identity.pid) return false;
  if ((parsed.start ?? null) !== (identity.start ?? null)) return false;
  if ((parsed.boot_id ?? null) !== (identity.boot_id ?? null)) return false;
  if ((parsed.execution_id ?? null) !== (identity.execution_id ?? null)) return false;
  rmSync(lockPath, { force: true });
  return true;
}

// R07: project a live `agents` census (CLI --json list) into a uniform live
// session set. Completed metadata (status/state in the completed set) is NOT
// live — it may legitimately lack a pid. Any live-shaped entry whose session
// id cannot be projected poisons the census (identityUnproven): the caller
// must hold, never invent absence. Scoping: sessionId equality, plus cwd
// equality when the entry carries one (an entry without cwd stays in scope —
// conservative for liveness).
const COMPLETED_CENSUS_STATUSES = new Set(['completed', 'finished', 'ended', 'exited', 'stopped', 'dead']);

export function parseAgentsCensus(entries, { sessionId = null, cwd = null } = {}) {
  if (!Array.isArray(entries)) return { identityUnproven: true };
  const live = [];
  for (const a of entries) {
    if (!a || typeof a !== 'object') return { identityUnproven: true };
    const status = a.status ?? a.state ?? null;
    if (typeof status === 'string' && COMPLETED_CENSUS_STATUSES.has(status.toLowerCase())) continue;
    const sid = a.sessionId ?? a.sessionID ?? a.session_id ?? null;
    if (sid == null) return { identityUnproven: true };
    const pidRaw = a.PID ?? a.pid ?? null;
    live.push({
      session_id: sid,
      pid: pidRaw == null ? null : Number(pidRaw),
      cwd: typeof a.cwd === 'string' ? a.cwd : null,
      status: typeof status === 'string' ? status : null,
    });
  }
  let scoped = live;
  if (sessionId != null) scoped = scoped.filter((x) => x.session_id === sessionId);
  if (cwd != null) scoped = scoped.filter((x) => x.cwd == null || x.cwd === cwd);
  return scoped;
}

// ------------------------------------------------------------- runExecution

export async function runExecution(opts) {
  const {
    ledger, solution, worktree, dir,
    superviseExecutionId = null, // supervise mode: tick already reserved this execution
    clock, // REQUIRED ActiveClock (HOST-RESILIENCE §3) — the only budget source
    spawnImpl = productionSpawn, gitImpl = productionGit, ghImpl = productionGh,
    processProbe = defaultProcessProbe, // R07: lock-holder liveness probing
    pollIntervalMs = 1000, startupTimeoutMs = 60_000,
    deadlineMs = ATTEMPT_ACTIVE_BUDGET_MS, termGraceMs = 10_000,
  } = opts;
  if (!clock || typeof clock.ok !== 'function' || typeof clock.bootId !== 'function' || typeof clock.activeNs !== 'function' || typeof clock.fresh !== 'function') {
    throw new Error('[INVALID] clock required: an ActiveClock (ok/bootId/activeNs/fresh) is the only budget source — wall time never budgets an attempt');
  }

  if (ledger.status().off) return { state: 'BLOCKED', blocker: 'OFF' };

  const payload = solution.payload;
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const worktreeName = `dot-relay-${solution.sha256.slice(0, 12)}`; // DESIGN.md:62

  // Base must equal freshly fetched origin/staging before launch — never a stale plan.
  const fetch = gitImpl(['fetch', 'origin', 'staging'], { cwd: worktree });
  if (fetch.code !== 0) return { state: 'BLOCKED', blocker: 'BLOCKED_BASE_FETCH' };
  const originHead = gitImpl(['rev-parse', 'origin/staging'], { cwd: worktree }).stdout.trim();
  if (originHead !== payload.base_sha) return { state: 'BLOCKED', blocker: 'BLOCKED_STALE_BASE' };
  const branchExists = gitImpl(['rev-parse', '--verify', `refs/heads/${jobBranch}`], { cwd: worktree }).code === 0;
  if (branchExists) return { state: 'BLOCKED', blocker: 'BLOCKED_BRANCH_EXISTS' };

  // R11: the trusted packet verifies BEFORE the worker slot and any attempt
  // reservation — an unregistered/unmatched solution never reaches spawn. In
  // supervise mode the tick-reserved row is marked BLOCKED; fresh mode never
  // claims an execution at all.
  const packetVerify = verifySolutionPacket({ ledger, solution });
  if (!packetVerify.ok) {
    if (superviseExecutionId) {
      ledger.updateExecution(superviseExecutionId, { state: 'BLOCKED', reason: 'BLOCKED_PACKET_UNTRUSTED' });
    }
    return { state: 'BLOCKED', blocker: 'BLOCKED_PACKET_UNTRUSTED', execution_id: superviseExecutionId ?? null };
  }

  // R07: exclusive worker-slot ownership acquired BEFORE any attempt
  // reservation — a stale lock must never burn the precharged attempt.
  // Reconciled conservatively (acquireSupervisorLock): live/unprovable holders
  // block; previous-boot / proven-dead holders are taken over with evidence
  // retained.
  const workerDir = join(dir, 'worker');
  const gate = acquireSupervisorLock({ workerDir, bootId: clock.bootId(), processProbe });
  if (gate.blocked) {
    return { state: 'BLOCKED', blocker: gate.blocked };
  }
  const lockFd = gate.fd;
  const lockPath = gate.lockPath;
  const lockTakeover = gate.takeover;
  // R07: the identity of the lock bytes THIS supervisor owns on disk — release
  // re-reads and compares before any unlink, so a successor's replacement lock
  // always survives our exit.
  const ownLockStart = procStart(process.pid);
  let ownedExecutionId = superviseExecutionId ?? null; // what acquire wrote
  const releaseOwnedLock = () => releaseSupervisorLock(lockPath, {
    pid: process.pid, start: ownLockStart, boot_id: clock.bootId(), execution_id: ownedExecutionId,
  });

  let sessionId;
  let executionId;
  let attemptNumber;
  if (superviseExecutionId) {
    // supervise mode: the row was RESERVED by tick in a prior process with its
    // own session id — reuse it, never claim a second execution for the solution.
    const row = ledger.getExecution(superviseExecutionId);
    if (!row || row.state !== 'RESERVED' || row.solution_id !== solution.id) {
      closeSync(lockFd);
      releaseOwnedLock();
      return { state: 'BLOCKED', blocker: 'EXECUTION_STATE', execution_id: superviseExecutionId };
    }
    executionId = superviseExecutionId;
    sessionId = row.session_id;
    attemptNumber = row.attempts_admitted || 1;
  } else {
    sessionId = randomUUID(); // fresh, persisted before spawn
    const claim = ledger.claimExecution({
      solutionId: solution.id,
      sessionId,
      bootId: clock.bootId(),
      supervisor: { pid: process.pid, start: procStart(process.pid) },
    });
    if (!claim.claimed) {
      closeSync(lockFd);
      releaseOwnedLock();
      return { state: 'HELD', held: true, execution_id: claim.execution_id };
    }
    executionId = claim.execution_id;
    attemptNumber = claim.attempt_number ?? 1;
  }

  // HOST-RESILIENCE §2: the lock names THIS supervisor's BOOT (and, on
  // takeover, the displaced holder), so a reused pid text after reboot can
  // never be mistaken for the lock holder. Fresh-claim mode acquires the slot
  // before the execution id exists — complete the record now.
  ftruncateSync(lockFd, 0);
  writeSync(lockFd, JSON.stringify({
    pid: process.pid, start: procStart(process.pid), boot_id: clock.bootId(),
    execution_id: executionId, takeover: lockTakeover,
  }), 0); // explicit offset: ftruncate does not rewind the fd position
  ownedExecutionId = executionId; // the disk identity we release against

  const stdoutPath = join(workerDir, `${executionId}.stdout`);
  const stderrPath = join(workerDir, `${executionId}.stderr`);
  const receiptPath = join(workerDir, `${executionId}.startup.json`);

  // R11: publish the private immutable packet — the constant framing contract
  // (startupPreamble output) and the EXACT original kickoff bytes — 0600,
  // fsynced, atomically, BEFORE the spawn; the argv then references both by
  // path+digest only. A symlink or byte drift at either path is a fixed
  // refusal (BLOCKED_PACKET_UNTRUSTED): the immutable bytes are never
  // overwritten, never written through a symlink, never spawned past.
  const kickoffPath = join(workerDir, `${executionId}.kickoff.md`);
  const framingPath = join(workerDir, `${executionId}.framing.md`);
  const framingWrite = writePrivateArtifact(
    framingPath,
    Buffer.from(startupPreamble({ jobBranch, baseSha: payload.base_sha, receiptPath, executionId, sessionId }), 'utf8'),
  );
  const kickoffWrite = writePrivateArtifact(kickoffPath, Buffer.from(packetVerify.packet.kickoff_text, 'utf8'));
  if (!framingWrite.ok || !kickoffWrite.ok) {
    closeSync(lockFd);
    releaseOwnedLock();
    ledger.updateExecution(executionId, { state: 'BLOCKED', reason: 'BLOCKED_PACKET_UNTRUSTED' });
    return { state: 'BLOCKED', blocker: 'BLOCKED_PACKET_UNTRUSTED', execution_id: executionId };
  }

  let child;
  try {
    const prompt = workerPrompt({
      kickoffPath,
      framingPath,
      kickoffSha256: packetVerify.packet.kickoff_sha256,
      framingSha256: framingWrite.digest,
    });
    child = spawnImpl(GLM_WRAPPER, buildArgv({ sessionId, prompt, worktreeName }), {
      cwd: worktree,
      stdoutPath,
      stderrPath,
      env: {
        PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
        HOME: process.env.HOME,
        DOT_RELAY_EXECUTION_ID: executionId,
        DOT_RELAY_SESSION_ID: sessionId,
        DOT_RELAY_STARTUP_RECEIPT: receiptPath,
        DOT_RELAY_JOB_BRANCH: jobBranch,
        DOT_RELAY_BASE_SHA: payload.base_sha,
        DOT_RELAY_WORKTREE_NAME: worktreeName,
      },
    });
  } catch (err) {
    closeSync(lockFd);
    releaseOwnedLock();
    const blocker = err.code === 'ENOENT' ? 'BLOCKED_LAUNCH'
      : (err.code === 'EACCES' || err.code === 'EPERM') ? 'BLOCKED_PERMISSION' : null;
    if (blocker) {
      ledger.updateExecution(executionId, { state: 'BLOCKED', reason: blocker });
      return { state: 'BLOCKED', blocker, execution_id: executionId };
    }
    ledger.updateExecution(executionId, { state: 'UNCERTAIN', reason: 'unclassified spawn failure' });
    return { state: 'UNCERTAIN', blocker: 'UNCERTAIN_SPAWN', execution_id: executionId };
  }

  const recorded = { pid: child.pid, process_start: child.start, session_id: sessionId };
  // §5 helper-side last resort: EOF/broken-pipe on the clock helper TERMs
  // exactly this child if this supervisor dies.
  if (typeof clock.registerChild === 'function') {
    try { clock.registerChild(child.pid, child.start); } catch { /* helper gone: clock breaks -> CLOCK_UNPROVEN */ }
  }
  ledger.updateExecution(executionId, { state: 'RUNNING', pid: child.pid, process_start: child.start, worktree });
  // Attempt row carries child identity + this supervisor's boot for reconcileHost.
  ledger.updateAttempt(executionId, attemptNumber, {
    state: 'RUNNING',
    boot_id: clock.bootId(),
    supervisor_pid: process.pid,
    supervisor_start: procStart(process.pid),
    child_pid: child.pid,
    child_start: child.start,
    session_id: sessionId,
  });

  let exitInfo = null;
  const exitWaiters = [];
  child.onExit((code, signal) => {
    exitInfo = { code, signal };
    for (const w of exitWaiters.splice(0)) w();
  });
  const exited = () => new Promise((res) => { if (exitInfo) return res(); exitWaiters.push(res); });

  // HOST-RESILIENCE §3/§5 plumbing — shared with the resume/monitor paths.
  const { clockProven, activeUsedMs, persistSample } = makeAttemptClock({ ledger, executionId, attemptNumber, clock });
  const writeCheckpoint = makeCheckpointWriter({
    workerDir, executionId, sessionId, clock, jobBranch, worktree,
    headSha: payload.base_sha, solutionSha256: solution.sha256,
    artifactSha256: packetVerify.packet.artifact_sha256,
    artifactBytes: packetVerify.packet.artifact_bytes,
    kickoffSha256: packetVerify.packet.kickoff_sha256,
    framingSha256: framingWrite.digest,
    activeUsedMs,
  });
  const { probeCurrent, ceaseChild } = makeCessation({ child, recorded, sessionId, hasExited: () => exitInfo !== null, exited, termGraceMs });
  // CLOCK_UNPROVEN fail-closed: run the ladder; a proven death keeps the cause
  // reason, an unproven one stays UNCERTAIN (STOP/IDENTITY) with the slot held.
  const stopUnproven = async () => {
    const verdict = await ceaseChild();
    const reason = verdict.dead ? 'CLOCK_UNPROVEN' : unprovenReason(verdict);
    ledger.updateAttempt(executionId, attemptNumber, { state: 'UNCERTAIN' });
    ledger.updateExecution(executionId, { state: 'UNCERTAIN', reason });
    return { state: 'UNCERTAIN', blocker: reason, execution_id: executionId };
  };

  try {
    // --- startup watch: supervisor-verified evidence, bounded by the ACTIVE
    // startup sub-budget (never wall time).
    const startupBudgetMs = Math.min(startupTimeoutMs, STARTUP_SUB_BUDGET_MS);
    let startup = null;
    while (!exitInfo) {
      startup = verifyStartupReceipt({ receiptPath, sessionId, executionId, gitImpl, expect: { head: payload.base_sha, branch: jobBranch } });
      if (startup) break;
      if (!clockProven()) return await stopUnproven();
      const used = activeUsedMs();
      if (used === null) return await stopUnproven();
      if (used >= startupBudgetMs) break;
      await sleep(pollIntervalMs);
    }
    if (!startup) {
      // startup window exhausted with a PROVEN clock: run the ladder; a proven
      // death keeps BLOCKED_STARTUP, an unproven one stays UNCERTAIN.
      const verdict = await ceaseChild();
      const reason = verdict.dead ? 'BLOCKED_STARTUP' : unprovenReason(verdict);
      ledger.updateAttempt(executionId, attemptNumber, { state: 'UNCERTAIN', measured_active_used_ms: activeUsedMs() ?? 0 });
      ledger.updateExecution(executionId, { state: 'UNCERTAIN', reason });
      return { state: 'UNCERTAIN', blocker: reason, execution_id: executionId };
    }
    ledger.updateExecution(executionId, { worktree: startup.worktree });
    writeCheckpoint('STARTUP_VERIFIED', { worktree: startup.worktree });

    // --- wait for exit, bounded by the attempt's ACTIVE budget
    while (!exitInfo) {
      if (!clockProven()) return await stopUnproven();
      const used = activeUsedMs();
      if (used === null) return await stopUnproven();
      persistSample();
      if (used >= deadlineMs) break;
      await sleep(pollIntervalMs);
    }
    if (!exitInfo) {
      const verdict = await ceaseChild();
      const used = activeUsedMs() ?? 0;
      persistSample();
      if (verdict.dead) {
        ledger.updateAttempt(executionId, attemptNumber, { state: 'TIMED_OUT_ACTIVE', measured_active_used_ms: used });
        ledger.updateExecution(executionId, {
          state: 'TIMED_OUT_ACTIVE',
          reason: `active budget exhausted active_used_ms=${used} boot=${clock.bootId()}`,
        });
        writeCheckpoint('TIMED_OUT_ACTIVE', { active_used_ms: used });
        return { state: 'TIMED_OUT_ACTIVE', execution_id: executionId, active_used_ms: used };
      }
      const reason = unprovenReason(verdict);
      ledger.updateAttempt(executionId, attemptNumber, { state: 'UNCERTAIN', measured_active_used_ms: used });
      ledger.updateExecution(executionId, { state: 'UNCERTAIN', reason });
      return { state: 'UNCERTAIN', blocker: reason, execution_id: executionId };
    }

    // --- capture: prove exact session + reported model + no error
    let stdoutText = '';
    try {
      stdoutText = readFileSync(stdoutPath, 'utf8');
    } catch {
      stdoutText = '';
    }
    const parsed = parseChildResult(stdoutText, sessionId, EXECUTION_MODEL);
    if (!parsed.trusted) {
      ledger.updateExecution(executionId, { state: 'BLOCKED', exit_code: exitInfo.code, reason: 'BLOCKED_CAPTURE' });
      return { state: 'BLOCKED', blocker: 'BLOCKED_CAPTURE', execution_id: executionId };
    }
    if (parsed.isError) {
      const r = parsed.result;
      const permDenied = r && typeof r === 'object'
        && (r.status === 'BLOCKED_PERMISSION' || r.kind === 'permission_denied');
      const blocker = permDenied ? 'BLOCKED_PERMISSION' : 'BLOCKED_CAPTURE';
      ledger.updateExecution(executionId, { state: 'BLOCKED', exit_code: exitInfo.code, reason: blocker });
      return { state: 'BLOCKED', blocker, execution_id: executionId };
    }
    const report = parsed.result;
    if (!report || typeof report !== 'object' || typeof report.pr_url !== 'string' || typeof report.head_sha !== 'string') {
      ledger.updateExecution(executionId, { state: 'BLOCKED', exit_code: exitInfo.code, reason: 'BLOCKED_CAPTURE' });
      return { state: 'BLOCKED', blocker: 'BLOCKED_CAPTURE', execution_id: executionId };
    }

    // --- exact-head PR verification, sharing the SAME active budget
    ledger.updateExecution(executionId, { state: 'VERIFYING', pr_url: report.pr_url, head_sha: report.head_sha });
    writeCheckpoint('CAPTURED', { head_sha: report.head_sha, pr_url: report.pr_url });
    const usedNow = activeUsedMs();
    const remaining = usedNow === null
      ? null
      : Math.max(deadlineMs - usedNow, pollIntervalMs * 2);
    const v = await verifyPr({ url: report.pr_url, headSha: report.head_sha, ghImpl, clock, pollIntervalMs, deadlineMs: remaining });
    if (v.state === 'DONE') {
      ledger.updateAttempt(executionId, attemptNumber, { state: 'DONE', measured_active_used_ms: activeUsedMs() ?? 0 });
      ledger.updateExecution(executionId, { state: 'DONE', exit_code: exitInfo.code });
      writeCheckpoint('DONE', { head_sha: report.head_sha, pr_url: report.pr_url });
      return { state: 'DONE', execution_id: executionId, pr_url: report.pr_url, head_sha: report.head_sha };
    }
    ledger.updateExecution(executionId, { state: 'BLOCKED', reason: v.blocker });
    return { state: 'BLOCKED', blocker: v.blocker, failing: v.failing, execution_id: executionId };
  } finally {
    try { closeSync(lockFd); } catch { /* already closed */ }
    releaseOwnedLock();
  }
}

// ------------------------------------------------------------- shared plumbing

// HOST-RESILIENCE §3 plumbing — the ActiveClock is the ONLY budget source.
// `anchorNs` may carry a PERSISTED anchor (TEXT ns from the attempt row):
// mach time is system-wide per boot, so an adopting monitor keeps charging
// the SAME attempt instead of starting a fresh budget.
function makeAttemptClock({ ledger, executionId, attemptNumber, clock, anchorNs: initialAnchor = null }) {
  const anchorNs = { v: initialAnchor !== null ? BigInt(initialAnchor) : null };
  // R08: a budget/identity decision requires the PROVEN clock AND independent
  // freshness — a stalled main helper can never freeze the budget.
  const clockProven = () => clock.ok() && clock.activeNs() !== null && clock.fresh();
  const activeUsedMs = () => {
    const ns = clock.activeNs();
    if (ns === null) return null;
    if (anchorNs.v === null) {
      anchorNs.v = ns;
      ledger.updateAttempt(executionId, attemptNumber, { active_start_ns: ns.toString(), last_active_ns: ns.toString() });
      return 0;
    }
    const delta = ns - anchorNs.v;
    return delta < 0n ? null : Number(delta / 1_000_000n);
  };
  const persistSample = () => {
    const ns = clock.activeNs();
    if (ns !== null) ledger.updateAttempt(executionId, attemptNumber, { last_active_ns: ns.toString() });
  };
  return { clockProven, activeUsedMs, persistSample };
}

// §5/R09 pre-signal identity + the finite cessation ladder, shared by
// run/resume paths. ceaseChild resolves to the ladder verdict — a signal call
// is NEVER itself proof of death.
function makeCessation({ child, recorded, sessionId, hasExited, exited, termGraceMs }) {
  const probeCurrent = () => (typeof child.probe === 'function' ? child.probe() : { pid: child.pid, start: child.start });
  const classify = () => classifyProbe(recorded, probeCurrent(), sessionId);
  const waitExit = async (ms) => Promise.race([exited().then(() => true), sleep(ms).then(() => false)]);
  const ceaseChild = async () => runCessationLadder({
    classify,
    term: () => { child.kill('SIGTERM'); },
    kill: () => { child.kill('SIGKILL'); },
    waitExit,
    termGraceMs,
  });
  return { probeCurrent, ceaseChild };
}

// Map a ladder verdict to the retention reason: a proven death keeps the
// CAUSE reason (CLOCK_UNPROVEN / TIMED_OUT_ACTIVE handled by callers); any
// unproven death stays UNCERTAIN — signaled-but-unproven is UNCERTAIN_STOP,
// never-signaled identity mismatch is UNCERTAIN_IDENTITY. Either way the slot
// is retained (never released, never re-spawned).
function unprovenReason(verdict) {
  if (verdict.dead) return null;
  return verdict.signaled ? 'UNCERTAIN_STOP' : 'UNCERTAIN_IDENTITY';
}

// Private metadata checkpoint (§4): ids, phase, digests, active spend —
// atomic tmp+rename, 0600, never payload bytes. R11: the packet fields bind
// the manifest whole-artifact hash/bytes plus the SEPARATE kickoff/framing
// digests — never the kickoff digest standing in for the artifact, never
// nullable strings.
function makeCheckpointWriter({
  workerDir, executionId, sessionId, clock, jobBranch, worktree, headSha, solutionSha256,
  artifactSha256, artifactBytes = null, kickoffSha256 = null, framingSha256 = null, activeUsedMs,
}) {
  return (phase, extra = {}) => {
    const data = {
      version: 1,
      execution_id: executionId,
      session_id: sessionId,
      boot_id: clock.bootId(),
      phase,
      branch: jobBranch,
      worktree,
      head_sha: headSha,
      solution_sha256: solutionSha256,
      artifact_sha256: artifactSha256,
      artifact_bytes: artifactBytes,
      kickoff_sha256: kickoffSha256,
      framing_sha256: framingSha256,
      pr_url: null,
      active_used_ms: activeUsedMs() ?? 0,
      ...extra,
    };
    const tmp = join(workerDir, `.${executionId}.checkpoint.tmp`);
    writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
    renameSync(tmp, join(workerDir, `${executionId}.checkpoint.json`));
  };
}

function readCheckpoint(workerDir, executionId) {
  try {
    const cp = JSON.parse(readFileSync(join(workerDir, `${executionId}.checkpoint.json`), 'utf8'));
    return cp && typeof cp === 'object' ? cp : null;
  } catch {
    return null;
  }
}

// §4/R11: the checkpoint IS the resume contract — ids, worktree, digests. The
// packet fields are STRICT: 64-hex digests agreeing with the trusted manifest
// (whole-artifact hash + bytes), plus the separate kickoff/framing digests.
// Null, any-string, and kickoff-digest-standing-for-artifact shapes are all
// rejected (BLOCKED_RESUME_METADATA).
function checkpointValid(cp, { executionId, solution, packet }) {
  return cp.version === 1
    && cp.execution_id === executionId
    && typeof cp.session_id === 'string' && cp.session_id.length >= 8
    && typeof cp.worktree === 'string' && cp.worktree.startsWith('/')
    && typeof cp.branch === 'string' && cp.branch.length > 0
    && cp.solution_sha256 === solution.sha256
    && typeof cp.artifact_sha256 === 'string' && HEX64.test(cp.artifact_sha256)
    && cp.artifact_sha256 === packet.packet.artifact_sha256
    && Number.isSafeInteger(cp.artifact_bytes) && cp.artifact_bytes === packet.packet.artifact_bytes
    && typeof cp.kickoff_sha256 === 'string' && HEX64.test(cp.kickoff_sha256)
    && cp.kickoff_sha256 === packet.packet.kickoff_sha256
    && typeof cp.framing_sha256 === 'string' && HEX64.test(cp.framing_sha256);
}

function readCapture(stdoutPath) {
  try {
    return readFileSync(stdoutPath, 'utf8');
  } catch {
    return '';
  }
}

function captureSessionId(text) {
  try {
    const j = JSON.parse(text);
    if (j && typeof j === 'object' && typeof j.session_id === 'string') return j.session_id;
  } catch {
    /* not JSON */
  }
  return undefined;
}

// §4/R11 fixed reconciliation preamble: constant instruction + private file
// paths and digests only — never payload bytes. The worker re-reads the SAME
// immutable kickoff/framing files the initial attempt published.
function resumePreamble({ checkpointPath, kickoffPath, framingPath, kickoffSha256, framingSha256 }) {
  return [
    '# Dot relay SAME-session recovery — fixed reconciliation contract',
    `1. FIRST inspect the actual current state: git status, git log, gh pr list + gh pr view for this branch. Determine what is already pushed/open BEFORE doing anything.`,
    '2. Never repeat a completed external side effect: no second push of the same content, no second PR create for this branch. Reuse the existing PR when one is already open.',
    '3. Continue the remaining accepted work; never create a new branch or session. Re-read the framing contract and kickoff artifact files below (exact bytes, sha256 verified); never modify or re-emit them.',
    '4. Final stdout must be the single JSON result object with pr_url and head_sha.',
    `Checkpoint (private): ${checkpointPath}`,
    `Framing contract (private, sha256 ${framingSha256}): ${framingPath}`,
    `Kickoff artifact (private, sha256 ${kickoffSha256}): ${kickoffPath}`,
    '',
  ].join('\n');
}

// ------------------------------------------------------------- resume / adopt
//
// HOST-RESILIENCE §4: after reboot (INTERRUPTED_HOST) recovery resumes the
// SAME session in the SAME worktree under the next precharged attempt.

export async function resumeExecution(opts) {
  const {
    ledger, solution, executionId, dir,
    clock,
    spawnImpl = productionSpawn, gitImpl = productionGit, ghImpl = productionGh,
    sessionProbe = null, // REQUIRED (sessionId) -> live-session census (list or bool)
    processProbe = defaultProcessProbe, // R07: lock-holder liveness probing
    pollIntervalMs = 1000, deadlineMs = ATTEMPT_ACTIVE_BUDGET_MS, termGraceMs = 10_000,
  } = opts;
  if (!clock || typeof clock.ok !== 'function' || typeof clock.bootId !== 'function' || typeof clock.activeNs !== 'function' || typeof clock.fresh !== 'function') {
    throw new Error('[INVALID] clock required: an ActiveClock (ok/bootId/activeNs/fresh) is the only budget source — wall time never budgets an attempt');
  }
  if (typeof sessionProbe !== 'function') {
    throw new Error('[INVALID] sessionProbe required: resume admits only a PROVEN absence of a live session with the same id');
  }

  const row = ledger.getExecution(executionId);
  if (!row || row.solution_id !== solution.id) {
    return { state: 'BLOCKED', blocker: 'EXECUTION_STATE', execution_id: executionId };
  }

  const workerDir = join(dir, 'worker');

  // R11: the trusted packet verifies BEFORE any recovery action — an
  // unregistered/unmatched solution is BLOCKED_PACKET_UNTRUSTED with the slot
  // held terminally, never resumed.
  const packetVerify = verifySolutionPacket({ ledger, solution });
  if (!packetVerify.ok) {
    ledger.updateExecution(executionId, { state: 'BLOCKED', reason: 'BLOCKED_PACKET_UNTRUSTED' });
    return { state: 'BLOCKED', blocker: 'BLOCKED_PACKET_UNTRUSTED', execution_id: executionId };
  }

  const cp = readCheckpoint(workerDir, executionId);
  if (!cp || !checkpointValid(cp, { executionId, solution, packet: packetVerify })) {
    ledger.updateExecution(executionId, { state: 'BLOCKED', reason: 'BLOCKED_RESUME_METADATA' });
    return { state: 'BLOCKED', blocker: 'BLOCKED_RESUME_METADATA', execution_id: executionId };
  }
  if (cp.session_id !== row.session_id) {
    ledger.recordResumeFailure(executionId);
    ledger.updateExecution(executionId, { state: 'UNCERTAIN', reason: 'UNCERTAIN_RESUME_IDENTITY' });
    return { state: 'UNCERTAIN', blocker: 'UNCERTAIN_RESUME_IDENTITY', execution_id: executionId };
  }
  const sessionId = cp.session_id;

  // R11: verify the durable packet BYTES before census/admission/lock — the
  // checkpoint's kickoff/framing digests must match the exact regular files on
  // disk. Tampered, missing, or symlinked packet files hold the slot
  // terminally; the immutable bytes are never rewritten.
  const kickoffPath = join(workerDir, `${executionId}.kickoff.md`);
  const framingPath = join(workerDir, `${executionId}.framing.md`);
  if (!verifyPacketBytes({
    kickoffPath,
    framingPath,
    kickoffSha256: cp.kickoff_sha256,
    framingSha256: cp.framing_sha256,
  }).ok) {
    ledger.updateExecution(executionId, { state: 'BLOCKED', reason: 'BLOCKED_PACKET_UNTRUSTED' });
    return { state: 'BLOCKED', blocker: 'BLOCKED_PACKET_UNTRUSTED', execution_id: executionId };
  }

  // Never --resume while a live session holds the same id. A census that
  // cannot prove identity fields (§2: CLI lacks them) is NOT provable absence
  // — hold as UNCERTAIN/IDENTITY_UNPROVEN instead of inventing certainty.
  const census = sessionProbe(sessionId);
  if (census && typeof census === 'object' && !Array.isArray(census) && census.identityUnproven === true) {
    return { state: 'UNCERTAIN', blocker: 'IDENTITY_UNPROVEN', execution_id: executionId };
  }
  const live = Array.isArray(census) ? census.length > 0 : census === true;
  if (live) return { state: 'HELD', held: true, execution_id: executionId };

  // The native worktree + branch must still belong to this execution.
  const top = gitImpl(['rev-parse', '--show-toplevel'], { cwd: cp.worktree });
  const branch = gitImpl(['branch', '--show-current'], { cwd: cp.worktree });
  if (top.code !== 0 || top.stdout.trim() !== cp.worktree
    || branch.code !== 0 || branch.stdout.trim() !== cp.branch) {
    ledger.updateExecution(executionId, { state: 'BLOCKED', reason: 'BLOCKED_RESUME_WORKTREE' });
    return { state: 'BLOCKED', blocker: 'BLOCKED_RESUME_WORKTREE', execution_id: executionId };
  }

  // R07: exclusive worker-slot ownership BEFORE the attempt reservation — a
  // stale lock must never consume a recovery attempt (and never block ordinary
  // boot recovery). Live/unprovable holders block; previous-boot /
  // proven-dead holders are taken over with evidence retained.
  const gate = acquireSupervisorLock({ workerDir, executionId, bootId: clock.bootId(), processProbe });
  if (gate.blocked) {
    return { state: 'BLOCKED', blocker: gate.blocked, execution_id: executionId };
  }
  const lockFd = gate.fd;
  const lockPath = gate.lockPath;
  // R07: release compares the on-disk identity before unlinking — a successor's
  // replacement lock survives this supervisor's exit.
  const ownLockStart = procStart(process.pid);
  const releaseOwnedLock = () => releaseSupervisorLock(lockPath, {
    pid: process.pid, start: ownLockStart, boot_id: clock.bootId(), execution_id: executionId,
  });

  // Reserve-before-spawn: the next precharged attempt commits before any side
  // effect. R07: a same-boot UNCERTAIN_STOP crash is resume-eligible ONLY with
  // the FRESH session-absence proof the census just established.
  const censusAbsent = Array.isArray(census) ? census.length === 0 : census === false;
  const admission = ledger.admitNextAttempt({
    executionId,
    bootId: clock.bootId(),
    supervisor: { pid: process.pid, start: procStart(process.pid) },
    sessionId,
    purpose: 'resume',
    verifiedDead: censusAbsent,
  });
  if (!admission.admitted) {
    closeSync(lockFd);
    releaseOwnedLock();
    if (admission.code === 'UNCERTAIN_RESUME_IDENTITY') {
      ledger.updateExecution(executionId, { state: 'UNCERTAIN', reason: 'UNCERTAIN_RESUME_IDENTITY' });
      return { state: 'UNCERTAIN', blocker: 'UNCERTAIN_RESUME_IDENTITY', execution_id: executionId };
    }
    return { state: 'BLOCKED', blocker: admission.code, execution_id: executionId };
  }
  const attemptNumber = admission.attempt_number;

  // R11: no kickoff re-creation here — verifyPacketBytes already proved the
  // immutable files exist with the checkpoint-bound bytes; the preamble
  // references them by path+digest only.
  const cpPath = join(workerDir, `${executionId}.checkpoint.json`);
  const stdoutPath = join(workerDir, `${executionId}.a${attemptNumber}.stdout`);
  const stderrPath = join(workerDir, `${executionId}.a${attemptNumber}.stderr`);

  let child;
  try {
    child = spawnImpl(GLM_WRAPPER, buildResumeArgv({ sessionId, prompt: resumePreamble({
      checkpointPath: cpPath,
      kickoffPath,
      framingPath,
      kickoffSha256: cp.kickoff_sha256,
      framingSha256: cp.framing_sha256,
    }) }), {
      cwd: cp.worktree,
      stdoutPath,
      stderrPath,
      env: {
        PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
        HOME: process.env.HOME,
        DOT_RELAY_EXECUTION_ID: executionId,
        DOT_RELAY_SESSION_ID: sessionId,
        DOT_RELAY_RESUME: '1',
        DOT_RELAY_CHECKPOINT: cpPath,
        DOT_RELAY_JOB_BRANCH: cp.branch,
      },
    });
  } catch (err) {
    closeSync(lockFd);
    releaseOwnedLock();
    ledger.recordResumeFailure(executionId);
    const blocker = err.code === 'ENOENT' ? 'BLOCKED_LAUNCH'
      : (err.code === 'EACCES' || err.code === 'EPERM') ? 'BLOCKED_PERMISSION' : 'UNCERTAIN_SPAWN';
    const state = blocker === 'UNCERTAIN_SPAWN' ? 'UNCERTAIN' : 'BLOCKED';
    ledger.updateExecution(executionId, { state, reason: blocker });
    return { state, blocker, execution_id: executionId };
  }

  const recorded = { pid: child.pid, process_start: child.start, session_id: sessionId };
  if (typeof clock.registerChild === 'function') {
    try { clock.registerChild(child.pid, child.start); } catch { /* helper gone: clock breaks -> CLOCK_UNPROVEN */ }
  }
  ledger.updateExecution(executionId, { state: 'RUNNING', pid: child.pid, process_start: child.start, worktree: cp.worktree });
  ledger.updateAttempt(executionId, attemptNumber, {
    state: 'RUNNING',
    boot_id: clock.bootId(),
    supervisor_pid: process.pid,
    supervisor_start: procStart(process.pid),
    child_pid: child.pid,
    child_start: child.start,
    session_id: sessionId,
  });

  let exitInfo = null;
  const exitWaiters = [];
  child.onExit((code, signal) => {
    exitInfo = { code, signal };
    for (const w of exitWaiters.splice(0)) w();
  });
  const exited = () => new Promise((res) => { if (exitInfo) return res(); exitWaiters.push(res); });

  const { clockProven, activeUsedMs, persistSample } = makeAttemptClock({ ledger, executionId, attemptNumber, clock });
  const writeCheckpoint = makeCheckpointWriter({
    workerDir, executionId, sessionId, clock, jobBranch: cp.branch, worktree: cp.worktree,
    headSha: cp.head_sha, solutionSha256: solution.sha256,
    artifactSha256: cp.artifact_sha256, artifactBytes: cp.artifact_bytes,
    kickoffSha256: cp.kickoff_sha256, framingSha256: cp.framing_sha256,
    activeUsedMs,
  });
  const { ceaseChild } = makeCessation({ child, recorded, sessionId, hasExited: () => exitInfo !== null, exited, termGraceMs });
  // R09: verdict semantics shared with the run path — a proven death keeps the
  // cause reason (CLOCK_UNPROVEN), an unproven one is STOP/IDENTITY.
  const stopUnproven = async () => {
    const verdict = await ceaseChild();
    const reason = verdict.dead ? 'CLOCK_UNPROVEN' : unprovenReason(verdict);
    ledger.recordResumeFailure(executionId);
    ledger.updateAttempt(executionId, attemptNumber, { state: 'UNCERTAIN' });
    ledger.updateExecution(executionId, { state: 'UNCERTAIN', reason });
    return { state: 'UNCERTAIN', blocker: reason, execution_id: executionId };
  };

  try {
    // No startup window: the prior boot's checkpoint proves startup; the
    // preamble directs reconciliation before any side effect.
    while (!exitInfo) {
      if (!clockProven()) return await stopUnproven();
      const used = activeUsedMs();
      if (used === null) return await stopUnproven();
      persistSample();
      if (used >= deadlineMs) break;
      await sleep(pollIntervalMs);
    }
    if (!exitInfo) {
      const verdict = await ceaseChild();
      const used = activeUsedMs() ?? 0;
      persistSample();
      if (verdict.dead) {
        ledger.updateAttempt(executionId, attemptNumber, { state: 'TIMED_OUT_ACTIVE', measured_active_used_ms: used });
        ledger.updateExecution(executionId, {
          state: 'TIMED_OUT_ACTIVE',
          reason: `active budget exhausted active_used_ms=${used} boot=${clock.bootId()}`,
        });
        writeCheckpoint('TIMED_OUT_ACTIVE', { active_used_ms: used });
        return { state: 'TIMED_OUT_ACTIVE', execution_id: executionId, active_used_ms: used };
      }
      const reason = unprovenReason(verdict);
      ledger.recordResumeFailure(executionId);
      ledger.updateAttempt(executionId, attemptNumber, { state: 'UNCERTAIN', measured_active_used_ms: used });
      ledger.updateExecution(executionId, { state: 'UNCERTAIN', reason });
      return { state: 'UNCERTAIN', blocker: reason, execution_id: executionId };
    }

    // §4: the returned session identity must be the EXACT same id.
    const stdoutText = readCapture(stdoutPath);
    const returnedSession = captureSessionId(stdoutText);
    if (returnedSession !== undefined && returnedSession !== sessionId) {
      ledger.recordResumeFailure(executionId);
      ledger.updateAttempt(executionId, attemptNumber, { state: 'UNCERTAIN' });
      ledger.updateExecution(executionId, { state: 'UNCERTAIN', reason: 'UNCERTAIN_RESUME_IDENTITY' });
      return { state: 'UNCERTAIN', blocker: 'UNCERTAIN_RESUME_IDENTITY', execution_id: executionId };
    }
    const parsed = parseChildResult(stdoutText, sessionId, EXECUTION_MODEL);
    if (!parsed.trusted || parsed.isError
      || !parsed.result || typeof parsed.result !== 'object'
      || typeof parsed.result.pr_url !== 'string' || typeof parsed.result.head_sha !== 'string') {
      ledger.recordResumeFailure(executionId);
      ledger.updateExecution(executionId, { state: 'BLOCKED', exit_code: exitInfo.code, reason: 'BLOCKED_CAPTURE' });
      return { state: 'BLOCKED', blocker: 'BLOCKED_CAPTURE', execution_id: executionId };
    }
    const report = parsed.result;
    // §4: an already-open PR is REUSED, never duplicated.
    if (cp.pr_url && report.pr_url !== cp.pr_url) {
      ledger.recordResumeFailure(executionId);
      ledger.updateExecution(executionId, { state: 'BLOCKED', exit_code: exitInfo.code, reason: 'BLOCKED_DUPLICATE_PR' });
      return { state: 'BLOCKED', blocker: 'BLOCKED_DUPLICATE_PR', execution_id: executionId };
    }
    const prUrl = cp.pr_url ?? report.pr_url;

    ledger.updateExecution(executionId, { state: 'VERIFYING', pr_url: prUrl, head_sha: report.head_sha });
    writeCheckpoint('CAPTURED', { head_sha: report.head_sha, pr_url: prUrl });
    const usedNow = activeUsedMs();
    const remaining = usedNow === null ? null : Math.max(deadlineMs - usedNow, pollIntervalMs * 2);
    const v = await verifyPr({ url: prUrl, headSha: report.head_sha, ghImpl, clock, pollIntervalMs, deadlineMs: remaining });
    if (v.state === 'DONE') {
      ledger.updateAttempt(executionId, attemptNumber, { state: 'DONE', measured_active_used_ms: activeUsedMs() ?? 0 });
      ledger.updateExecution(executionId, { state: 'DONE', exit_code: exitInfo.code });
      ledger.recordResumeSuccess(executionId);
      writeCheckpoint('DONE', { head_sha: report.head_sha, pr_url: prUrl });
      return { state: 'DONE', execution_id: executionId, pr_url: prUrl, head_sha: report.head_sha };
    }
    ledger.updateExecution(executionId, { state: 'BLOCKED', reason: v.blocker });
    return { state: 'BLOCKED', blocker: v.blocker, failing: v.failing, execution_id: executionId };
  } finally {
    try { closeSync(lockFd); } catch { /* already closed */ }
    releaseOwnedLock();
  }
}

// HOST-RESILIENCE §2: same-boot supervisor death with the exact child still
// alive — adopt a monitor for that SAME child. ZERO GLM spawns, no new
// reservation; the persisted anchor keeps charging the SAME attempt.
export async function monitorAdoptedChild(opts) {
  const {
    ledger, executionId, dir,
    clock,
    processProbe = null, // REQUIRED (pid) -> {alive, start}
    ghImpl = productionGh,
    killImpl = (pid, sig) => { process.kill(pid, sig); },
    pollIntervalMs = 1000, deadlineMs = ATTEMPT_ACTIVE_BUDGET_MS, termGraceMs = 10_000,
  } = opts;
  if (!clock || typeof clock.ok !== 'function' || typeof clock.bootId !== 'function' || typeof clock.activeNs !== 'function' || typeof clock.fresh !== 'function') {
    throw new Error('[INVALID] clock required: an ActiveClock (ok/bootId/activeNs/fresh) is the only budget source — wall time never budgets an attempt');
  }
  if (typeof processProbe !== 'function') {
    throw new Error('[INVALID] processProbe required: adoption demands proven exact child identity');
  }

  const row = ledger.getExecution(executionId);
  if (!row || !['RUNNING', 'RECOVERING_HOST'].includes(row.state)) {
    return { state: 'BLOCKED', blocker: 'EXECUTION_STATE', execution_id: executionId };
  }
  const attemptNumber = row.attempts_admitted || 1;
  const attempt = ledger.getAttempt(executionId, attemptNumber);
  if (!attempt || attempt.child_pid == null || !attempt.child_start || !attempt.session_id) {
    return { state: 'UNCERTAIN', blocker: 'UNCERTAIN_IDENTITY', execution_id: executionId }; // hold
  }
  const sessionId = attempt.session_id;
  const childAlive = () => {
    const p = processProbe(attempt.child_pid);
    return !!p && !!p.alive && p.start === attempt.child_start;
  };
  const initial = processProbe(attempt.child_pid);
  if (initial && initial.alive && initial.start !== attempt.child_start) {
    // PID reuse: identity unprovable — hold, never signal.
    return { state: 'UNCERTAIN', blocker: 'UNCERTAIN_IDENTITY', execution_id: executionId };
  }

  const workerDir = join(dir, 'worker');
  const cp = readCheckpoint(workerDir, executionId);
  const { clockProven, activeUsedMs, persistSample } = makeAttemptClock({
    ledger, executionId, attemptNumber, clock,
    anchorNs: attempt.active_start_ns != null ? attempt.active_start_ns : null,
  });

  // §5 cessation against a process we did not spawn: the SAME finite ladder —
  // classify against the recorded identity before each signal, WALL grace
  // waits (an adopted child has no exit event we can observe), KILL only on a
  // fresh exact-live re-probe, DEAD only from authoritative absence. A frozen
  // active clock can never extend or loop it.
  const recordedAdopted = { pid: attempt.child_pid, process_start: attempt.child_start, session_id: sessionId };
  const classifyAdopted = () => {
    let p;
    try { p = processProbe(attempt.child_pid); } catch { p = null; }
    if (!p || typeof p !== 'object') return 'unknown';
    const probe = p.alive === true
      ? { pid: attempt.child_pid, start: p.start ?? null, found: true }
      : { found: false };
    return classifyProbe(recordedAdopted, probe, sessionId);
  };
  const ceaseExact = () => runCessationLadder({
    classify: classifyAdopted,
    term: () => { try { killImpl(attempt.child_pid, 'SIGTERM'); } catch { /* gone */ } },
    kill: () => { try { killImpl(attempt.child_pid, 'SIGKILL'); } catch { /* gone */ } },
    // no observable exit event for an adopted child: the grace is a bounded
    // WALL sleep, then a fresh classify decides — never an active-clock loop
    waitExit: async (ms) => { await sleep(ms); return false; },
    termGraceMs,
  });

  let ownExit = !childAlive();
  while (!ownExit) {
    if (!clockProven()) {
      const verdict = await ceaseExact();
      const reason = verdict.dead ? 'CLOCK_UNPROVEN' : unprovenReason(verdict);
      ledger.updateAttempt(executionId, attemptNumber, { state: 'UNCERTAIN' });
      ledger.updateExecution(executionId, { state: 'UNCERTAIN', reason });
      return { state: 'UNCERTAIN', blocker: reason, execution_id: executionId };
    }
    const used = activeUsedMs();
    if (used === null) {
      ledger.updateAttempt(executionId, attemptNumber, { state: 'UNCERTAIN' });
      ledger.updateExecution(executionId, { state: 'UNCERTAIN', reason: 'CLOCK_UNPROVEN' });
      return { state: 'UNCERTAIN', blocker: 'CLOCK_UNPROVEN', execution_id: executionId };
    }
    persistSample();
    if (used >= deadlineMs) {
      const verdict = await ceaseExact();
      const finalUsed = activeUsedMs() ?? used;
      if (verdict.dead) {
        ledger.updateAttempt(executionId, attemptNumber, { state: 'TIMED_OUT_ACTIVE', measured_active_used_ms: finalUsed });
        ledger.updateExecution(executionId, {
          state: 'TIMED_OUT_ACTIVE',
          reason: `active budget exhausted active_used_ms=${finalUsed} boot=${clock.bootId()}`,
        });
        if (cp) makeCheckpointWriter({
          workerDir, executionId, sessionId, clock, jobBranch: cp.branch, worktree: cp.worktree,
          headSha: cp.head_sha, solutionSha256: cp.solution_sha256,
          artifactSha256: cp.artifact_sha256, artifactBytes: cp.artifact_bytes,
          kickoffSha256: cp.kickoff_sha256, framingSha256: cp.framing_sha256, activeUsedMs,
        })('TIMED_OUT_ACTIVE', { active_used_ms: finalUsed });
        return { state: 'TIMED_OUT_ACTIVE', execution_id: executionId, active_used_ms: finalUsed };
      }
      const reason = unprovenReason(verdict);
      ledger.updateAttempt(executionId, attemptNumber, { state: 'UNCERTAIN', measured_active_used_ms: finalUsed });
      ledger.updateExecution(executionId, { state: 'UNCERTAIN', reason });
      return { state: 'UNCERTAIN', blocker: reason, execution_id: executionId };
    }
    await sleep(pollIntervalMs);
    ownExit = !childAlive();
  }

  // The adopted child exited on its own: reconcile from its private capture.
  const stdoutText = readCapture(join(workerDir, `${executionId}.stdout`));
  const returnedSession = captureSessionId(stdoutText);
  if (returnedSession !== undefined && returnedSession !== sessionId) {
    ledger.updateAttempt(executionId, attemptNumber, { state: 'UNCERTAIN' });
    ledger.updateExecution(executionId, { state: 'UNCERTAIN', reason: 'UNCERTAIN_IDENTITY' });
    return { state: 'UNCERTAIN', blocker: 'UNCERTAIN_IDENTITY', execution_id: executionId };
  }
  const parsed = parseChildResult(stdoutText, sessionId, EXECUTION_MODEL);
  if (!parsed.trusted || parsed.isError
    || !parsed.result || typeof parsed.result !== 'object'
    || typeof parsed.result.pr_url !== 'string' || typeof parsed.result.head_sha !== 'string') {
    // No invented exit status: absent evidence stays UNCERTAIN_STOP.
    ledger.updateAttempt(executionId, attemptNumber, { state: 'UNCERTAIN', measured_active_used_ms: activeUsedMs() ?? 0 });
    ledger.updateExecution(executionId, { state: 'UNCERTAIN', reason: 'UNCERTAIN_STOP' });
    return { state: 'UNCERTAIN', blocker: 'UNCERTAIN_STOP', execution_id: executionId };
  }
  const report = parsed.result;
  ledger.updateExecution(executionId, { state: 'VERIFYING', pr_url: report.pr_url, head_sha: report.head_sha });
  const usedNow = activeUsedMs();
  const remaining = usedNow === null ? null : Math.max(deadlineMs - usedNow, pollIntervalMs * 2);
  const v = await verifyPr({ url: report.pr_url, headSha: report.head_sha, ghImpl, clock, pollIntervalMs, deadlineMs: remaining });
  if (v.state === 'DONE') {
    ledger.updateAttempt(executionId, attemptNumber, { state: 'DONE', measured_active_used_ms: activeUsedMs() ?? 0 });
    ledger.updateExecution(executionId, { state: 'DONE' });
    ledger.recordResumeSuccess(executionId);
    if (cp) makeCheckpointWriter({
      workerDir, executionId, sessionId, clock, jobBranch: cp.branch, worktree: cp.worktree,
      headSha: cp.head_sha, solutionSha256: cp.solution_sha256,
      artifactSha256: cp.artifact_sha256, artifactBytes: cp.artifact_bytes,
      kickoffSha256: cp.kickoff_sha256, framingSha256: cp.framing_sha256, activeUsedMs,
    })('DONE', { head_sha: report.head_sha, pr_url: report.pr_url });
    return { state: 'DONE', execution_id: executionId, pr_url: report.pr_url, head_sha: report.head_sha };
  }
  ledger.updateExecution(executionId, { state: 'BLOCKED', reason: v.blocker });
  return { state: 'BLOCKED', blocker: v.blocker, failing: v.failing, execution_id: executionId };
}

// ------------------------------------------------------------- verifyPr
//
// HOST-RESILIENCE §3: CI polling shares the attempt's ACTIVE budget. The
// clock anchors at entry; a broken/backwards sample is CLOCK_UNPROVEN, never
// a silently-wrong wall-time budget.

export async function verifyPr({ url, headSha, ghImpl = productionGh, clock, pollIntervalMs = 60_000, deadlineMs = null }) {
  if (!clock || typeof clock.ok !== 'function' || typeof clock.activeNs !== 'function' || typeof clock.fresh !== 'function') {
    throw new Error('[INVALID] clock required: CI polling shares the attempt active budget — wall time never bounds it');
  }
  const anchor = clock.activeNs();
  if (anchor === null || !clock.ok() || !clock.fresh()) return { state: 'BLOCKED', blocker: 'CLOCK_UNPROVEN' };
  const budgetNs = deadlineMs != null ? BigInt(deadlineMs) * 1_000_000n : null;
  for (;;) {
    const v1 = ghImpl.view(['pr', 'view', url, '--json', 'headRefOid,baseRefName,state,isDraft,mergeStateStatus,autoMergeRequest']);
    if (v1.headRefOid !== headSha) return { state: 'BLOCKED', blocker: 'BLOCKED_HEAD_MISMATCH' };
    if (v1.state !== 'OPEN' || v1.baseRefName !== 'staging' || v1.isDraft === true
      || (v1.autoMergeRequest ?? null) !== null || v1.mergeStateStatus === 'CONFLICTING') {
      return { state: 'BLOCKED', blocker: 'BLOCKED_PR_STATE' };
    }
    const checks = ghImpl.checks(['pr', 'checks', url, '--required', '--json', 'name,state,bucket,link']);
    if (!Array.isArray(checks) || checks.length === 0) {
      return { state: 'BLOCKED', blocker: 'BLOCKED_CHECK_POLICY' };
    }
    const failing = checks.filter((c) => c.bucket === 'fail').map((c) => c.name);
    if (failing.length > 0) return { state: 'BLOCKED', blocker: 'BLOCKED_CI', failing };
    const pending = checks.filter((c) => c.bucket !== 'pass').map((c) => c.name);
    if (pending.length > 0) {
      const ns = clock.activeNs();
      if (ns === null || !clock.ok() || !clock.fresh() || ns < anchor) {
        return { state: 'BLOCKED', blocker: 'CLOCK_UNPROVEN', failing: pending };
      }
      if (budgetNs !== null && ns - anchor >= budgetNs) return { state: 'BLOCKED', blocker: 'BLOCKED_CI', failing: pending };
      await sleep(pollIntervalMs);
      continue;
    }
    // repeat view: head stability proven, not assumed
    const v2 = ghImpl.view(['pr', 'view', url, '--json', 'headRefOid,baseRefName,state,isDraft,mergeStateStatus,autoMergeRequest']);
    if (v2.headRefOid !== headSha) return { state: 'BLOCKED', blocker: 'BLOCKED_HEAD_MOVED' };
    return { state: 'DONE' };
  }
}
