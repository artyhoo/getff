#!/usr/bin/env node
// Frozen outer conformance driver — S1 test-assurance kernel, Batch F (spec §6).
//
// WHAT THIS IS: the "separate unchanged conformance driver" of spec §6. It runs the
// REAL public entrypoints (the delivered ESLint CLI lane, the guard-liveness kernel
// engine via frozen probes) over the FIXED governed corpus, and then — arm by arm —
// weakens the GATE itself (rule twin / delivered config / kernel engine) inside a
// DETACHED SCRATCH WORKTREE at HEAD, proving the corpus verification FAILS under each
// representative fault. Merely changing governed input would establish K2, not K3 —
// no arm touches the corpus; the corpus, this driver, and the frozen expectations
// (scripts/test-assurance/driver-expectations.json) stay fixed while gates weaken.
//
// EXIT GRAMMAR (T-TAK-A — infrastructure never counts as detection):
//   0  baseline conforms AND every arm's fault was REACHED (corpus verification failed
//      under the fault exactly as frozen)
//   1  a fault left the gate green, or a pristine baseline drifted (undetected K3/K4
//      violation — a REAL failure, reported as such)
//   3  INFRASTRUCTURE-FAILURE: missing binary/file, empty selection, missing
//      expectation key, oracle-hash drift, spawn error, eslint fatal (rc 2), and
//      ANY unexpected exception (a bare Node crash exits 1 — that is NEVER this
//      grammar; the catch-all handlers below own it)
//
// The driver NEVER edits its expectations. It writes nothing outside /tmp scratch
// worktrees; the main checkout's carrier files must be porcelain-clean when it exits.
// Usage: node scripts/test-assurance/driver.mjs [--arm <D-id>]  (default: all arms)
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../..');
const EXPECTATIONS_PATH = join(REPO_ROOT, 'scripts/test-assurance/driver-expectations.json');
const ORACLE_PATH = join(REPO_ROOT, 'scripts/test-assurance/expectations.json');
const PROBE_DIR_REL = 'scripts/test-assurance/driver-probes';
const ESLINT_BIN = join(REPO_ROOT, 'node_modules/.bin/eslint');
const TSX_BIN = join(REPO_ROOT, 'node_modules/.bin/tsx');
const GIT = 'git';
const SPAWN_TIMEOUT_MS = 120_000;

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

function infra(msg) {
  console.error(`INFRASTRUCTURE-FAILURE: ${msg}`);
  process.exit(3);
}
function fail(msg) {
  console.error(`DRIVER-FAIL: ${msg}`);
  process.exit(1);
}

// Catch-all (T-TAK-A, rework round 2): an unexpected exception or rejection anywhere
// above — including a teardown throw inside a `finally` — must surface as
// INFRASTRUCTURE-FAILURE (exit 3), never as a bare Node crash (exit 1), which
// verify.mjs stepDriver would read as "a gate fault left corpus verification green".
// Measured trigger (darwin, Node v24.3.0): non-recursive rmSync({force}) refuses a
// symlink-to-directory with ERR_FS_EISDIR; the scratch node_modules IS such a symlink.
process.on('uncaughtException', (err) => {
  infra(`unexpected exception: ${err && err.stack ? err.stack : String(err)}`);
});
process.on('unhandledRejection', (err) => {
  infra(`unexpected rejection: ${err && err.stack ? err.stack : String(err)}`);
});

/** Hygiene identical to principle 52's childEnv: stable runs regardless of harness. */
function childEnv() {
  const env = { ...process.env };
  delete env.CLAUDE_CODE_ENTRYPOINT;
  delete env.CLAUDECODE;
  delete env.CI;
  env.FORCE_COLOR = '0';
  return env;
}

/**
 * Git spawns additionally scrub the GIT_DIR/GIT_COMMON_DIR/GIT_WORK_TREE/GIT_INDEX_FILE
 * family (load-bearing, identical to verify.mjs gitEnv): under an ambient GIT_DIR — e.g.
 * invoked from inside a git hook — `git worktree add` and `git show HEAD:<carrier>` would
 * operate on a different repository than REPO_ROOT. Measured pre-fix (2026-10-08 rework
 * round 1): GIT_DIR=/tmp/no-such-repo redirected `git show` → rc=128 `not a git repository`.
 */
function gitEnv() {
  const env = childEnv();
  delete env.GIT_DIR;
  delete env.GIT_COMMON_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  return env;
}

/** Spawn with timeout; a spawn error/signal/timeout is infrastructure (exit 3). */
function run(bin, args, cwd, env = childEnv()) {
  // Only PATH-resolvable commands (no separator) skip the existence precondition —
  // `git` is not a path, but a mistyped binary path must fail loudly before spawn.
  if (bin.includes('/') && !existsSync(bin)) infra(`required binary missing: ${bin}`);
  const res = spawnSync(bin, args, {
    cwd,
    env,
    encoding: 'utf8',
    timeout: SPAWN_TIMEOUT_MS,
    killSignal: 'SIGTERM',
  });
  if (res.error) {
    const code = res.error.code ?? res.error.message;
    if (res.error.code === 'ETIMEDOUT') infra(`spawn timed out after ${SPAWN_TIMEOUT_MS}ms: ${bin} ${args.join(' ')}`);
    infra(`spawn failed (${code}): ${bin} ${args.join(' ')}`);
  }
  if (res.signal) infra(`spawn killed by ${res.signal}: ${bin} ${args.join(' ')}`);
  return { rc: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

function git(args, cwd = REPO_ROOT) {
  const res = run(GIT, args, cwd, gitEnv());
  if (res.rc !== 0) infra(`git ${args.join(' ')} failed (rc=${res.rc}): ${res.stderr.trim().slice(0, 300)}`);
  return res.stdout;
}

// ── frozen input loading (fail-closed, before anything runs) ──────────────────

if (!existsSync(EXPECTATIONS_PATH)) infra(`frozen expectations missing: ${EXPECTATIONS_PATH}`);
const EXP = JSON.parse(readFileSync(EXPECTATIONS_PATH, 'utf8'));
if (!EXP.frozen_oracle?.sha256) infra('frozen expectations carry no frozen_oracle.sha256 pin');
if (!existsSync(ORACLE_PATH)) infra(`frozen oracle missing: ${ORACLE_PATH}`);
const oracleSha = sha256(readFileSync(ORACLE_PATH, 'utf8'));
if (oracleSha !== EXP.frozen_oracle.sha256) {
  infra(
    `frozen-oracle drift: expectations.json sha256 ${oracleSha.slice(0, 12)}… != pinned ${EXP.frozen_oracle.sha256.slice(0, 12)}… — the oracle changed without a new freeze; refusing to run`,
  );
}
if (!Array.isArray(EXP.baseline) || EXP.baseline.length === 0) infra('frozen expectations carry no baseline rows (empty selection)');
if (!Array.isArray(EXP.arms) || EXP.arms.length === 0) infra('frozen expectations carry no arms (empty selection)');

const baselineById = new Map(EXP.baseline.map((row) => [row.id, row]));

/** Resolve an observation's `files` field: array of paths, or a baseline row id. */
function filesOf(obs, armId) {
  let files = obs.files;
  if (typeof files === 'string') {
    const row = baselineById.get(files);
    if (!row) infra(`${armId}: files reference '${files}' has no baseline row`);
    files = row.files;
  }
  if (!Array.isArray(files) || files.length === 0) {
    infra(`${armId}: observation selects zero files (empty selection is never a run — T-TAK-A)`);
  }
  for (const f of files) {
    if (typeof f !== 'string' || f.includes('..')) infra(`${armId}: bad corpus path ${JSON.stringify(f)}`);
  }
  return files;
}

/** One CLI observation: real eslint over an explicit file list. eslint rc 2 = fatal. */
function runCliObservation(obs, armLabel, cwd) {
  const files = filesOf(obs, armLabel);
  const res = run(ESLINT_BIN, files, cwd);
  // Freeze-review finding F1: an eslint exit outside the documented 0/1 grammar
  // (fatal rc 2 and any undocumented status) is infrastructure, never a frozen
  // expectation mismatch — it can neither read green nor count as detection.
  if (res.rc !== 0 && res.rc !== 1) {
    infra(`eslint exited ${res.rc} (outside the documented 0/1 grammar) in ${armLabel}: ${res.stderr.trim().slice(0, 300)}`);
  }
  const output = res.stdout + res.stderr;
  const diagOk = !obs.diagnostic || output.includes(obs.diagnostic);
  const ok = res.rc === obs.expectRc && diagOk;
  console.log(
    `OBS ${ok ? 'OK' : 'MISMATCH'} ${armLabel} cli files=${files.length} rc=${res.rc} want=${obs.expectRc}${obs.diagnostic ? ` diag=${obs.diagnostic}${diagOk ? '' : ' MISSING'}` : ''} :: ${obs.note ?? ''}`,
  );
  if (!ok && res.rc !== obs.expectRc) {
    console.log(`OBS-TAIL ${armLabel} ${(res.stderr.trim() || res.stdout.trim()).split('\n').slice(-4).join(' | ').slice(0, 400)}`);
  }
  return ok;
}

/** One probe observation: the repo tsx runs a frozen probe INSIDE the worktree. */
function runProbeObservation(obs, armLabel, cwd) {
  const probeAbs = join(cwd, obs.probe);
  if (!existsSync(probeAbs)) infra(`${armLabel}: probe missing in checkout: ${obs.probe}`);
  const res = run(TSX_BIN, [probeAbs], cwd);
  if (res.rc !== 0) infra(`${armLabel}: probe crashed (rc=${res.rc}): ${res.stderr.trim().slice(0, 300)} — a crashed probe is infrastructure, not detection`);
  const ok = res.stdout.includes(obs.expect);
  console.log(`OBS ${ok ? 'OK' : 'MISMATCH'} ${armLabel} probe=${obs.probe.split('/').pop()} want=${JSON.stringify(obs.expect)} :: ${obs.note ?? ''}`);
  return ok;
}

function runObservations(kind, list, armLabel, cwd) {
  if (!Array.isArray(list) || list.length === 0) infra(`${armLabel}: ${kind} carries no observations (T-TAK-A)`);
  return list.map((obs) => {
    if (obs.kind === 'cli') return runCliObservation(obs, `${armLabel}/${kind}`, cwd);
    if (obs.kind === 'probe') return runProbeObservation(obs, `${armLabel}/${kind}`, cwd);
    return infra(`${armLabel}: unknown observation kind ${JSON.stringify(obs.kind)}`);
  });
}

// ── baseline (K1/K2 conformance over the real CLI, main checkout) ─────────────

function runBaseline(phase) {
  console.log(`== phase: baseline ${phase} (real CLI over the frozen static matrix) ==`);
  for (const row of EXP.baseline) {
    const ok = runCliObservation(row, row.id, REPO_ROOT);
    if (!ok) fail(`baseline ${phase}: row ${row.id} does not conform (rc/diagnostic mismatch) — the gate itself is not in its frozen shape`);
  }
}

// ── anti-detector arms ─────────────────────────────────────────────────────────

function headBlobSha(carrier) {
  return sha256(git(['show', `HEAD:${carrier}`]));
}

/** Exactly-once textual fault injection with the principle-52 sha256 convention. */
function applyPatchOnce(absPath, patch, armId) {
  const before = readFileSync(absPath, 'utf8');
  const occurrences = before.split(patch.from).length - 1;
  if (occurrences !== 1) infra(`${armId}: patch does not apply exactly once (occurrences=${occurrences})`);
  const computedSha = sha256(`${patch.label}\n${patch.from}\n${patch.to}`);
  if (patch.expectedSha256 && computedSha !== patch.expectedSha256) {
    infra(`${armId}: patch sha ${computedSha} != frozen ${patch.expectedSha256} (pin drift)`);
  }
  const after = before.replace(patch.from, patch.to);
  writeFileSync(absPath, after);
  return { computedSha, beforeSha: sha256(before), afterSha: sha256(after) };
}

function runArm(arm) {
  console.log(`== phase: arm ${arm.id} (${arm.class}, K=${arm.k.join('/')}) — carrier ${arm.carrier} ==`);
  if (!arm.carrier || typeof arm.carrier !== 'string') infra(`${arm.id}: no carrier`);
  if (!arm.patch?.from || !arm.patch?.to || !arm.patch?.label) infra(`${arm.id}: incomplete patch spec`);
  const carrierAbs = join(REPO_ROOT, arm.carrier);
  if (!existsSync(carrierAbs)) infra(`${arm.id}: carrier missing: ${arm.carrier}`);
  const preSha = headBlobSha(arm.carrier);

  const wt = mkdtempSync(join(tmpdir(), 's1-driver-'));
  try {
    git(['worktree', 'add', '--detach', wt, 'HEAD']);
    symlinkSync(join(REPO_ROOT, 'node_modules'), join(wt, 'node_modules'));
    const wtCarrier = join(wt, arm.carrier);
    if (sha256(readFileSync(wtCarrier, 'utf8')) !== preSha) {
      infra(`${arm.id}: worktree pre-image differs from the HEAD blob`);
    }
    // Frozen probes ride along as byte-identical copies (they may be newer than HEAD;
    // the copy is hashed so the observation is tied to the exact probe bytes reviewed).
    if (existsSync(join(REPO_ROOT, PROBE_DIR_REL))) {
      mkdirSync(join(wt, PROBE_DIR_REL), { recursive: true });
      for (const probe of ['glv-parse-error-probe.mts', 'glv-healthy-rule-probe.mts']) {
        const src = join(REPO_ROOT, PROBE_DIR_REL, probe);
        if (!existsSync(src)) continue;
        const dst = join(wt, PROBE_DIR_REL, probe);
        copyFileSync(src, dst);
        if (sha256(readFileSync(dst, 'utf8')) !== sha256(readFileSync(src, 'utf8'))) {
          infra(`${arm.id}: probe copy not byte-identical: ${probe}`);
        }
      }
    }

    const pristine = runObservations('pristine', arm.pristine, arm.id, wt);
    if (pristine.some((ok) => !ok)) {
      fail(`${arm.id}: pristine baseline is not healthy in the scratch worktree — gate drifted before the fault`);
    }

    const applied = applyPatchOnce(wtCarrier, arm.patch, arm.id);
    console.log(`PATCH ${arm.id} label=${JSON.stringify(arm.patch.label)} sha256=${applied.computedSha} occurrences=1 before=${applied.beforeSha.slice(0, 12)} after=${applied.afterSha.slice(0, 12)}`);

    const mutant = runObservations('mutant', arm.mutant, arm.id, wt);
    const detected = mutant.every((ok) => ok);
    if (!detected) {
      fail(`${arm.id}: a mutant observation did not flip as frozen — the fault was NOT reached by corpus verification (undetected K3/K4 violation)`);
    }
    console.log(`ARM ${arm.id} DETECTED (corpus verification fails under the fault; ${arm.k.join('/')})`);

    // Restoration: hash equality with the HEAD blob; the main checkout is never touched.
    git(['checkout', '--', arm.carrier], wt);
    if (sha256(readFileSync(wtCarrier, 'utf8')) !== preSha) {
      infra(`${arm.id}: restored carrier differs from the HEAD blob`);
    }
    console.log(`RESTORED ${arm.id} ${arm.carrier} sha256=${preSha}`);
    return true;
  } finally {
    // Teardown must unlink the scratch node_modules LINK, never follow it (it points
    // at the shared main-checkout tree). A bare rmSync({force}) does that on Linux but
    // throws ERR_FS_EISDIR on darwin/Node v24 (rework round 2: arm D1 died after
    // DETECTED+RESTORED and the unhandled throw leaked exit 1). lstatSync-guarded
    // unlink keeps every platform on the link-only path; a real directory (never the
    // case today) would still be removed recursively. A cleanup failure must not wedge
    // the arm loop — `git worktree remove --force` below is the authoritative teardown.
    const nmLink = join(wt, 'node_modules');
    try {
      if (lstatSync(nmLink).isSymbolicLink()) unlinkSync(nmLink);
      else rmSync(nmLink, { force: true, recursive: true });
    } catch (err) {
      console.error(`WARN ${arm.id}: scratch node_modules cleanup skipped (${err?.code ?? err?.message ?? err}) — git worktree remove --force handles the rest`);
    }
    spawnSync(GIT, ['worktree', 'remove', '--force', wt], { cwd: REPO_ROOT, env: gitEnv() });
  }
}

// ── main ───────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
let only = null;
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--arm') {
    only = argv[i + 1];
    i += 1;
  } else {
    infra(`unknown argument ${argv[i]} (supported: --arm <id>)`);
  }
}
if (only && !EXP.arms.some((a) => a.id === only)) infra(`--arm ${only}: no such arm`);

console.log(`DRIVER repo=${REPO_ROOT}`);
console.log(`DRIVER oracle sha256=${oracleSha}`);
console.log(`DRIVER expectations=${EXP.frozen_at} arms=${EXP.arms.length}${only ? ` (only ${only})` : ''}`);

runBaseline('pre');

for (const arm of EXP.arms) {
  if (only && arm.id !== only) continue;
  runArm(arm);
}

if (!only) {
  runBaseline('post');
  const carriers = EXP.arms.map((a) => a.carrier);
  const dirty = git(['status', '--porcelain', '--', ...carriers]).trim();
  if (dirty) fail(`main checkout carriers dirty after the run — scratch discipline violated:\n${dirty}`);
  console.log('MAIN-CHECKOUT carriers porcelain-clean');
}

console.log('DRIVER VERDICT: pass (baseline conforms; every arm reached its frozen flip; gates restored)');
