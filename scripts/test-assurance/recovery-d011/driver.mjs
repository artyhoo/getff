#!/usr/bin/env node
// D011 S1 recovery outer driver — amended-2 supplemental arms + accepted A3/amended-4 controls.
//
// WHAT THIS IS: the ported, hash-pinned replay of the coordinator-frozen recovery controls
// (amended2-supplemental-controls-request.json arms 12->14, none dropped; amended-4 K3;
// A2 repeatability; A3 pinned classifier inputs). Every arm weakens the GATE inside a
// DETACHED SCRATCH WORKTREE at HEAD — the same pattern as the frozen driver.mjs — and
// demands the observation flip exactly as frozen. The original six-arm driver, its
// expectations, expectations.json and driver-expectations.json stay byte-identical; this
// file owns ONLY the recovery oracle (expectations-recovery.json, frozen 2026-10-14).
//
// PATCH PIN CONVENTION (identical to driver.mjs applyPatchOnce): sha256(label + "\n" +
// from + "\n" + to). All 14 registry pins were verified against the ast-parsed
// amended2-regions.py constants before this oracle was frozen. A pin mismatch, a
// non-single occurrence, or a crashed probe is INFRASTRUCTURE (exit 3) — never a verdict.
//
// EXIT GRAMMAR (T-TAK-A):
//   0  every arm's pristine phase healthy AND every mutant observation flipped as frozen
//      (expect present, expect_not absent) AND A2/A3/K3 lanes green
//   1  a mutant observation did not flip, a pristine baseline drifted, or a lane failed
//   3  INFRASTRUCTURE: missing binary/file, hash drift of a pinned input, spawn
//      error/timeout, probe crash — the run cannot conclude
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const EXP_PATH = join(HERE, 'expectations-recovery.json');
const PROBE_DIR_REL = 'scripts/test-assurance/driver-probes';
const POP_DIR_REL = 'scripts/test-assurance/recovery-d011/fixtures/population';
const Q3_DIR_REL = 'scripts/test-assurance/recovery-d011/fixtures/q3';
const ESLINT_BIN = join(REPO_ROOT, 'node_modules/.bin/eslint');
const TSX_BIN = join(REPO_ROOT, 'node_modules/.bin/tsx');
const GIT = 'git';
const SPAWN_TIMEOUT_MS = 300_000;
const K3_TIMEOUT_MS = 1_200_000;
const R4_SHELL_TIMEOUT_MS = 900_000;

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

function infra(msg) {
  console.error(`INFRASTRUCTURE-FAILURE: ${msg}`);
  process.exit(3);
}
function fail(msg) {
  console.error(`RECOVERY-FAIL: ${msg}`);
  process.exit(1);
}
process.on('uncaughtException', (err) => {
  infra(`unexpected exception: ${err && err.stack ? err.stack : String(err)}`);
});
process.on('unhandledRejection', (err) => {
  infra(`unexpected rejection: ${err && err.stack ? err.stack : String(err)}`);
});

function childEnv() {
  const env = { ...process.env };
  delete env.CLAUDE_CODE_ENTRYPOINT;
  delete env.CLAUDECODE;
  delete env.CI;
  env.FORCE_COLOR = '0';
  return env;
}
function gitEnv() {
  const env = childEnv();
  delete env.GIT_DIR;
  delete env.GIT_COMMON_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  return env;
}
function run(bin, args, cwd, timeout = SPAWN_TIMEOUT_MS) {
  if (bin.includes('/') && !existsSync(bin)) infra(`required binary missing: ${bin}`);
  const res = spawnSync(bin, args, { cwd, env: childEnv(), encoding: 'utf8', timeout, killSignal: 'SIGTERM' });
  if (res.error) {
    if (res.error.code === 'ETIMEDOUT') infra(`spawn timed out after ${timeout}ms: ${bin} ${args.join(' ')}`);
    infra(`spawn failed (${res.error.code ?? res.error.message}): ${bin} ${args.join(' ')}`);
  }
  if (res.signal) infra(`spawn killed by ${res.signal}: ${bin} ${args.join(' ')}`);
  return { rc: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}
function git(args, cwd = REPO_ROOT) {
  const res = run(GIT, args, cwd);
  if (res.rc !== 0) infra(`git ${args.join(' ')} failed (rc=${res.rc}): ${res.stderr.trim().slice(0, 300)}`);
  return res.stdout;
}

// ── frozen input loading (fail-closed before anything runs) ──────────────────

if (!existsSync(EXP_PATH)) infra(`frozen recovery expectations missing: ${EXP_PATH}`);
const EXP = JSON.parse(readFileSync(EXP_PATH, 'utf8'));
if (!Array.isArray(EXP.arms) || EXP.arms.length !== 14) {
  infra(`recovery expectations must carry exactly 14 arms (got ${EXP.arms?.length}) — the amended-2 registry is 12->14, none dropped`);
}

/** Verify every pinned portable input in the MAIN checkout, byte-identical, before any run. */
function verifyPinnedInputs() {
  const problems = [];
  for (const [rel, want] of Object.entries(EXP.probes ?? {})) {
    const p = join(REPO_ROOT, rel);
    if (!existsSync(p) || sha256(readFileSync(p)) !== want) problems.push(`probe hash drift: ${rel}`);
  }
  const popDir = join(REPO_ROOT, POP_DIR_REL);
  const walk = (dir, prefix = '') => {
    const out = [];
    for (const n of readdirSync(dir).sort()) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) out.push(...walk(p, `${prefix}${n}/`));
      else out.push(`${prefix}${n}`);
    }
    return out;
  };
  if (existsSync(popDir)) {
    const onDisk = walk(popDir);
    const pinned = Object.keys(EXP.population_manifest ?? {});
    const set = new Set(onDisk);
    for (const rel of pinned) if (!set.has(rel)) problems.push(`population fixture missing: ${rel}`);
    for (const rel of onDisk) if (!(EXP.population_manifest ?? {})[rel]) problems.push(`unpinned population fixture present: ${rel}`);
    for (const rel of onDisk.filter((r) => (EXP.population_manifest ?? {})[r])) {
      if (sha256(readFileSync(join(popDir, rel))) !== EXP.population_manifest[rel]) problems.push(`population fixture hash drift: ${rel}`);
    }
  } else {
    problems.push(`population fixture dir missing: ${POP_DIR_REL}`);
  }
  for (const [rel, want] of Object.entries(EXP.q3_companions ?? {})) {
    const p = join(REPO_ROOT, rel);
    if (!existsSync(p) || sha256(readFileSync(p)) !== want) problems.push(`q3 companion hash drift: ${rel}`);
  }
  for (const [name, want] of Object.entries({
    'k3/k3-arm.sh': EXP.k3?.k3_arm_sh,
    'k3/k3-outer-control.sh': EXP.k3?.k3_outer_control_sh,
    'k3/run-k3-control.sh': null,
    'sb1-classifier-control.mts': null,
  })) {
    if (want === undefined) problems.push(`k3 pin missing in expectations: ${name}`);
    const p = join(HERE, name);
    if (!existsSync(p)) problems.push(`recovery control file missing: ${name}`);
    else if (want !== null && sha256(readFileSync(p)) !== want) problems.push(`k3 runner hash drift: ${name}`);
  }
  if (problems.length > 0) infra(`pinned-input verification failed (never a verdict):\n  ${problems.join('\n  ')}`);
  console.log(`RECOVERY pinned inputs verified: ${Object.keys(EXP.probes).length} probes, ${Object.keys(EXP.population_manifest).length} population fixtures, ${Object.keys(EXP.q3_companions).length} q3 companions, k3 runners`);
}

// ── scratch worktree (the frozen driver.mjs pattern) ─────────────────────────

/** A detached worktree at HEAD with a node_modules link and the pinned recovery
 *  payloads copied in hash-proven (they may be newer than HEAD, exactly like the
 *  frozen probes of driver.mjs). */
function makeWorktree(tag) {
  const wt = mkdtempSync(join(tmpdir(), `s1-recovery-${tag}-`));
  git(['worktree', 'add', '--detach', wt, 'HEAD']);
  symlinkSync(join(REPO_ROOT, 'node_modules'), join(wt, 'node_modules'));
  for (const [rel, want] of Object.entries(EXP.probes)) {
    mkdirSync(join(wt, PROBE_DIR_REL), { recursive: true });
    copyFileSync(join(REPO_ROOT, rel), join(wt, rel));
    if (sha256(readFileSync(join(wt, rel))) !== want) infra(`${tag}: probe copy not byte-identical: ${rel}`);
  }
  const copyTree = (relDir) => {
    const src = join(REPO_ROOT, relDir);
    const walk = (dir, prefix = '') => {
      const out = [];
      for (const n of readdirSync(dir).sort()) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) out.push(...walk(p, `${prefix}${n}/`));
        else out.push(`${prefix}${n}`);
      }
      return out;
    };
    for (const rel of walk(src)) {
      // slice(0, lastIndexOf('/') + 1): for a top-level file this yields '' (parent =
      // relDir itself) — a bare slice(0, -1) would chop the last char of the NAME and
      // manufacture a phantom sibling directory (measured: EEXIST on bad.vacuous.test.js).
      mkdirSync(join(wt, relDir, rel.slice(0, rel.lastIndexOf('/') + 1)), { recursive: true });
      copyFileSync(join(src, rel), join(wt, relDir, rel));
    }
  };
  copyTree(POP_DIR_REL);
  copyTree(Q3_DIR_REL);
  // The classifier/replay payloads committed with SB1 ride along via HEAD; hash-check the
  // ones the A3 lane and r4 probe read, so a silently deleted oracle cannot pass.
  for (const rel of [
    'scripts/test-assurance/recovery-d011/sb1-classifier-control.mts',
    'scripts/test-assurance/recovery-d011/fixtures/r4-runner/counterexamples/cx1.json',
    'scripts/test-assurance/recovery-d011/fixtures/r4-runner/reports/roots.json',
    'scripts/test-assurance/counterfactuals/counterfactual-lib.sh',
  ]) {
    if (!existsSync(join(wt, rel))) infra(`${tag}: committed recovery payload missing at HEAD: ${rel}`);
  }
  return wt;
}
function dropWorktree(tag, wt) {
  const nmLink = join(wt, 'node_modules');
  try {
    if (lstatSync(nmLink).isSymbolicLink()) unlinkSync(nmLink);
    else rmSync(nmLink, { force: true, recursive: true });
  } catch (err) {
    console.error(`WARN ${tag}: scratch node_modules cleanup skipped (${err?.code ?? err?.message ?? err})`);
  }
  spawnSync(GIT, ['worktree', 'remove', '--force', wt], { cwd: REPO_ROOT, env: gitEnv() });
}

// ── observations ───────────────────────────────────────────────────────────────

/**
 * Expectation matcher for probe observations. Literal substring in general — with ONE
 * frozen predicate form carried by the amended-2 packet: SUP-R3-P53-DISCOVERY-OVER's
 * mutant expect `P53-DISC reconcile real-corpus mismatches>0` (the packet's own dry-run
 * receipt prints `mismatches=30`, evidence/dryrun-p53-mutants.txt:18 — a literal
 * `includes('>0')` can never match). An expect ENDING in a comparison over an integer
 * (`<key><op><digits>`, op ∈ > >= < <= != =) matches the integer the probe printed after
 * the same key prefix; everything else stays literal. expect_not is always literal.
 */
function matchesExpect(stdout, expect) {
  const pred = expect.match(/^(.+?)(>=|<=|!=|>|<|=)(\d+)$/);
  if (!pred) return stdout.includes(expect);
  const [, key, op, rhsStr] = pred;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // The probe prints `key=<int>` (template-literal separator '='); the expect's op is the
  // comparison to APPLY to that integer — never part of the printed text.
  const found = [...stdout.matchAll(new RegExp(`${escaped}=(\\d+)`, 'g'))];
  if (found.length === 0) return false;
  const lhs = Number(found[found.length - 1][1]);
  const rhs = Number(rhsStr);
  if (op === '>') return lhs > rhs;
  if (op === '>=') return lhs >= rhs;
  if (op === '<') return lhs < rhs;
  if (op === '<=') return lhs <= rhs;
  if (op === '!=') return lhs !== rhs;
  return lhs === rhs;
}

function runCliObservation(obs, armLabel, cwd) {
  if (!Array.isArray(obs.paths) || obs.paths.length === 0) infra(`${armLabel}: cli observation selects zero files (T-TAK-A)`);
  const res = run(ESLINT_BIN, obs.paths, cwd);
  if (res.rc !== 0 && res.rc !== 1) {
    infra(`eslint exited ${res.rc} (outside the documented 0/1 grammar) in ${armLabel}: ${res.stderr.trim().slice(0, 300)}`);
  }
  const output = res.stdout + res.stderr;
  const diagOk = !obs.diagnostic || output.includes(obs.diagnostic);
  const ok = res.rc === obs.expectRc && diagOk;
  console.log(`OBS ${ok ? 'OK' : 'MISMATCH'} ${armLabel} cli files=${obs.paths.length} rc=${res.rc} want=${obs.expectRc}${obs.diagnostic ? ` diag=${obs.diagnostic}${diagOk ? '' : ' MISSING'}` : ''} :: ${obs.note ?? ''}`);
  if (!ok && res.rc !== obs.expectRc) {
    console.log(`OBS-TAIL ${armLabel} ${(res.stderr.trim() || res.stdout.trim()).split('\n').slice(-4).join(' | ').slice(0, 400)}`);
  }
  return ok;
}

function runProbeObservation(obs, armLabel, cwd, phase) {
  const probeAbs = join(cwd, obs.probe);
  if (!existsSync(probeAbs)) infra(`${armLabel}: probe missing in scratch: ${obs.probe}`);
  const res = run(TSX_BIN, [probeAbs], cwd);
  const present = matchesExpect(res.stdout, obs.expect);
  const absent = obs.expect_not ? !res.stdout.includes(obs.expect_not) : true;
  const ok = present && absent;
  // Probe exit grammar (tsx: 0 clean, 1 uncaught error — anything else is spawn-level infra).
  // PRISTINE demands rc 0: a probe that crashes against the intact gate is infrastructure.
  // MUTANT accepts rc 1 WITH the frozen flip present: under a broken gate the frozen probe
  // may legitimately die in a later lane after printing the verdict (packet receipt
  // dryrun-carrier-mutant-roottestsdir.txt: WRONGENF line printed, then EXIT=1 at the
  // severity-matrix lane). A crash WITHOUT the flip cannot conclude — infra, never green.
  if (res.rc !== 0 && res.rc !== 1) {
    infra(`${armLabel}: probe exited ${res.rc} (outside the 0/1 probe grammar): ${(res.stderr || res.stdout).trim().slice(0, 300)}`);
  }
  if (res.rc === 1 && phase === 'pristine') {
    infra(`${armLabel}: probe crashed against the intact gate (rc=1): ${res.stderr.trim().slice(0, 300)}`);
  }
  if (res.rc === 1 && !ok) {
    infra(`${armLabel}: probe crashed (rc=1) without the frozen flip in stdout — cannot conclude: ${res.stderr.trim().slice(0, 300)}`);
  }
  console.log(
    `OBS ${ok ? 'OK' : 'MISMATCH'} ${armLabel} probe=${obs.probe.split('/').pop()} rc=${res.rc}${res.rc === 1 ? ' (documented crash-after-verdict shape)' : ''} want=${JSON.stringify(obs.expect)}${obs.expect_not ? ` not-want=${JSON.stringify(obs.expect_not)}` : ''} :: ${obs.note ?? ''}`,
  );
  return ok;
}

function runObservations(kind, list, armLabel, cwd) {
  if (!Array.isArray(list) || list.length === 0) infra(`${armLabel}: ${kind} carries no observations (T-TAK-A)`);
  return list.map((obs) => {
    if (obs.kind === 'cli') return runCliObservation(obs, `${armLabel}/${kind}`, cwd);
    if (obs.kind === 'probe') return runProbeObservation(obs, `${armLabel}/${kind}`, cwd, kind);
    if (obs.kind === 'ast') {
      // Informational reachability note carried by the frozen case (its evidence file is
      // packet-side); the runnable reachability proof is the a1 probe observation.
      console.log(`NOTE ${armLabel}/${kind} ast-note :: ${obs.note ?? ''}`);
      return true;
    }
    return infra(`${armLabel}: unknown observation kind ${JSON.stringify(obs.kind)}`);
  });
}

/** Exactly-once fault injection, driver.mjs convention (patch sha pinned). */
function applyPatchOnce(absPath, patch, armId) {
  const before = readFileSync(absPath, 'utf8');
  const occurrences = before.split(patch.from).length - 1;
  if (occurrences !== 1) infra(`${armId}: patch does not apply exactly once (occurrences=${occurrences})`);
  const computedSha = sha256(`${patch.label}\n${patch.from}\n${patch.to}`);
  if (patch.expectedSha256 && computedSha !== patch.expectedSha256) {
    infra(`${armId}: patch sha ${computedSha} != frozen ${patch.expectedSha256} (pin drift)`);
  }
  writeFileSync(absPath, before.replace(patch.from, patch.to));
  return { computedSha, beforeSha: sha256(before), afterSha: sha256(readFileSync(absPath, 'utf8')) };
}

// ── the 14 arms ────────────────────────────────────────────────────────────────

function runArm(arm) {
  console.log(`== recovery arm ${arm.id} (${arm.class}, K=${arm.k.join('/')}, scope=${arm.anchor_scope}) — carrier ${arm.carrier} ==`);
  const carrierAbs = join(REPO_ROOT, arm.carrier);
  if (!existsSync(carrierAbs)) infra(`${arm.id}: carrier missing: ${arm.carrier}`);
  const preSha = sha256(git(['show', `HEAD:${arm.carrier}`]));
  const wt = makeWorktree(arm.id);
  try {
    const wtCarrier = join(wt, arm.carrier);
    if (sha256(readFileSync(wtCarrier, 'utf8')) !== preSha) infra(`${arm.id}: worktree pre-image differs from the HEAD blob`);

    const pristine = runObservations('pristine', arm.pristine, arm.id, wt);
    if (pristine.some((ok) => !ok)) {
      fail(`${arm.id}: pristine baseline is not healthy in the scratch worktree — the repaired gate drifted before the fault`);
    }

    const applied = applyPatchOnce(wtCarrier, arm.patch, arm.id);
    console.log(`PATCH ${arm.id} sha256=${applied.computedSha} occurrences=1 before=${applied.beforeSha.slice(0, 12)} after=${applied.afterSha.slice(0, 12)}`);

    const mutant = runObservations('mutant', arm.mutant, arm.id, wt);
    if (!mutant.every(Boolean)) {
      fail(`${arm.id}: a mutant observation did not flip as frozen — the fault was NOT reached (undetected K3/K4 violation)`);
    }
    console.log(`RECOVERY-ARM ${arm.id} DETECTED`);

    git(['checkout', '--', arm.carrier], wt);
    if (sha256(readFileSync(wtCarrier, 'utf8')) !== preSha) infra(`${arm.id}: restored carrier differs from the HEAD blob`);
    return true;
  } finally {
    dropWorktree(arm.id, wt);
  }
}

// ── lanes ──────────────────────────────────────────────────────────────────────

/** A2: the GLV population probe is repeatable — second run resets, recommits with a
 *  DIFFERENT parent, and reproduces byte-identical verdict lines. */
function laneA2() {
  console.log('== recovery lane A2: GLV population repeatability ==');
  const probeRel = EXP.lanes.a2_repeatability.probe;
  const wt = makeWorktree('a2');
  try {
    const run1 = run(TSX_BIN, [join(wt, probeRel)], wt);
    if (run1.rc !== 0) infra(`A2: probe run1 crashed (rc=${run1.rc}): ${run1.stderr.trim().slice(0, 300)}`);
    const run2 = run(TSX_BIN, [join(wt, probeRel)], wt);
    if (run2.rc !== 0) infra(`A2: probe run2 crashed (rc=${run2.rc}): ${run2.stderr.trim().slice(0, 300)}`);
    const commitRe = /GLV-COMMIT ([0-9a-f]+) parent=([0-9a-f]+)/g;
    const c1 = [...run1.stdout.matchAll(commitRe)];
    const c2 = [...run2.stdout.matchAll(commitRe)];
    if (c1.length !== 1 || c2.length !== 1) infra(`A2: expected one GLV-COMMIT per run, got ${c1.length}/${c2.length}`);
    if (!run2.stdout.includes('GLV-RESET-COMMIT')) {
      fail('A2: run2 lacks GLV-RESET-COMMIT — the normalization commit did not happen (idempotency drift)');
    }
    if (c2[0][2] === c1[0][2]) {
      fail(`A2: run2 fixture-commit parent ${c2[0][2]} equals run1's parent — the repeated observation did not carry a distinct changed identity`);
    }
    const verdict = (out) => out.split('\n').filter((l) => l.startsWith('GLV-DETECT ') || l.startsWith('GLV-CLEAN ') || l.startsWith('GLV-FAILCLOSED ') || l.startsWith('GLV-WRONGREASON ')).sort();
    const v1 = verdict(run1.stdout);
    const v2 = verdict(run2.stdout);
    if (v1.length === 0) infra('A2: run1 produced zero verdict lines (probe shape drift)');
    if (JSON.stringify(v1) !== JSON.stringify(v2)) {
      fail(`A2: verdict lines differ across runs (non-idempotent observation):\n  run1: ${v1.join(' | ')}\n  run2: ${v2.join(' | ')}`);
    }
    console.log(`A2-OK run1-parent=${c1[0][2].slice(0, 12)} run2-parent=${c2[0][2].slice(0, 12)} verdict-lines=${v1.length} byte-identical`);
    return true;
  } finally {
    dropWorktree('a2', wt);
  }
}

/** A3: the pinned-input classifier control through the production export (13 inputs). */
function laneA3() {
  console.log('== recovery lane A3: pinned classifier replay ==');
  const res = run(TSX_BIN, [join(REPO_ROOT, EXP.lanes.a3_pinned_replay.control)], REPO_ROOT);
  if (res.rc !== 0) infra(`A3: control crashed (rc=${res.rc}): ${res.stderr.trim().slice(0, 300)}`);
  if (!res.stdout.includes(EXP.lanes.a3_pinned_replay.expect)) {
    fail(`A3: control output lacks '${EXP.lanes.a3_pinned_replay.expect}' — pinned inputs no longer classify as frozen:\n${res.stdout.split('\n').slice(-4).join('\n')}`);
  }
  console.log('A3-OK pinned classifier inputs all match their frozen expectations');
  return true;
}

/** A4/K3: the amended-4 judging control — genuine Q3 judge green, reviewer weakening red. */
function laneK3() {
  console.log('== recovery lane K3: genuine Q3 judging + f71e weakening detection ==');
  const res = run('bash', [join(HERE, 'k3/run-k3-control.sh')], REPO_ROOT, K3_TIMEOUT_MS);
  const output = res.stdout + res.stderr;
  if (res.rc !== 0) {
    if (res.rc === 1) fail(`K3: control RED — ${output.split('\n').slice(-3).join(' | ').slice(0, 400)}`);
    infra(`K3: control exited ${res.rc} (infrastructure): ${output.split('\n').slice(-3).join(' | ').slice(0, 400)}`);
  }
  const missing = (EXP.k3.expected_lines ?? []).filter((l) => !output.includes(l));
  if (missing.length > 0) fail(`K3: receipt lacks expected line(s): ${missing.join(' ; ')}`);
  console.log('K3-OK genuine judge admitted the intended kills; reviewer weakening f71e2cc8… caught; restoration byte-proven');
  return true;
}

/** K3/K4 lane for the chief-admitted R4 shell-consistency correction: the GENUINE
 *  cf-lib helpers (sourced, never reimplemented) must refuse a real unhandled runner
 *  error (infrastructure, exit 3) and a same-file failed+pending required case (cx3,
 *  COUNTERFACTUAL-FAIL, exit 1) while fully-executed healthy / intended-fail
 *  companions stay legitimate — and localized permissive/over-strict mutants applied
 *  to a scratch lib copy must flip exactly their target arm. Frozen inputs live in
 *  r4-shell-expectations.json; expectations-recovery.json is NOT altered by this lane. */
function laneR4Shell() {
  console.log('== recovery lane R4-SHELL: cf-lib strict exit/report/unhandled + required-execution ==');
  const res = run(process.execPath, [join(HERE, 'r4-shell-control.mjs')], REPO_ROOT, R4_SHELL_TIMEOUT_MS);
  const output = res.stdout + res.stderr;
  if (res.rc !== 0) {
    if (res.rc === 1) fail(`R4-SHELL: control RED — ${output.split('\n').slice(-3).join(' | ').slice(0, 400)}`);
    infra(`R4-SHELL: control exited ${res.rc} (infrastructure): ${output.split('\n').slice(-3).join(' | ').slice(0, 400)}`);
  }
  const r4exp = JSON.parse(readFileSync(join(HERE, 'r4-shell-expectations.json'), 'utf8'));
  if (!output.includes(r4exp.receipt_final)) {
    fail(`R4-SHELL: control output lacks the frozen final receipt '${r4exp.receipt_final}'`);
  }
  console.log('R4-SHELL-OK genuine helpers refused real unhandled + cx3 failed+pending; healthy/intended-fail companions legitimate; localized mutants detected with byte-proven restores');
  return true;
}

// ── main ───────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
let only = null;
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--arm') {
    only = argv[(i += 1)];
  } else {
    infra(`unknown argument ${argv[i]} (supported: --arm <id>)`);
  }
}
if (only && !EXP.arms.some((a) => a.id === only)) infra(`--arm ${only}: no such arm`);

console.log(`RECOVERY-DRIVER repo=${REPO_ROOT}`);
console.log(`RECOVERY-DRIVER expectations=${EXP.frozen_at} arms=${EXP.arms.length}${only ? ` (only ${only})` : ''}`);

verifyPinnedInputs();

for (const arm of EXP.arms) {
  if (only && arm.id !== only) continue;
  runArm(arm);
}
if (!only) {
  laneA2();
  laneA3();
  laneK3();
  laneR4Shell();
  const carriers = [...new Set(EXP.arms.map((a) => a.carrier))];
  const dirty = git(['status', '--porcelain', '--', ...carriers]).trim();
  if (dirty) fail(`main checkout carriers dirty after the run — scratch discipline violated:\n${dirty}`);
  console.log('MAIN-CHECKOUT carriers porcelain-clean');
}

console.log(
  only
    ? `RECOVERY-DRIVER VERDICT: pass (filtered run --arm ${only}; the full verdict requires the unfiltered run)`
    : 'RECOVERY-DRIVER VERDICT: pass (all 14 arms reached their frozen flips; A2/A3/K3/R4-SHELL lanes green; gates restored)',
);
