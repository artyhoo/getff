#!/usr/bin/env node
// r4-shell-control.mjs — the R4 shell-consistency control (chief admission
// 2026-10-14, tak-r4-shell-correction-admission-20261014.json; independent review
// counterexamples D011-R4-SHELL-UNHANDLED / D011-R4-SHELL-INCOMPLETE; integrity
// delta admitted 2026-10-14 by tak-r4-control-integrity-delta-admission-20261014.json
// after independent finding R4-CONTROL-EMPTY-REQUIRED-MUTANTS).
//
// Proves, through the GENUINE counterfactual-lib.sh helpers (sourced via bash,
// never reimplemented), the two repaired shell predicates:
//   P1 strict runner exit/report/unhandled consistency — run_scratch_vitest
//      refuses a real unhandled runner error (Vitest exit 1 + reporter "Errors 1"
//      with all assertions passed, frozen unhandled.test.ts) as INFRASTRUCTURE
//      (exit 3), never an accepted pass;
//   P2 required execution even in failed files — expect_file_status AND
//      expect_intended refuse a same-file failed+pending required case (frozen
//      cx3.json report bytes, input sha 11a36b2e…) with COUNTERFACTUAL-FAIL
//      (exit 1), never an intended kill.
// …plus the legitimate companions (fully-executed healthy run accepted; fully
// executed intended-fail accepted with genuine failure evidence — Vitest exit 1
// is legitimate ONLY with intended-failure evidence; and the whole-suite crash
// lane of delivery/replay-fences-fire-deletion.sh — a failed file with zero
// assertionResults whose evidence lives in the file message, accepted ONLY
// through asserted status+intended-text) and localized mutants (permissive ×3,
// over-strict ×1) applied to a scratch lib copy, each flipping exactly its
// target arm, restores byte-proven.
//
// INTEGRITY CONTRACT (this delta): the oracle is bound to its FULL approved
// sha256 BEFORE any reliance — a missing/empty/duplicate/altered/new oracle
// (any byte drift, including mutants:[] or an extra arm) refuses as explicit
// INFRA (exit 3) with no receipts. The required 6 pristine + 4 mutant IDs are
// enforced as an exact population (defense-in-depth behind the hash pin). The
// completion receipt is built from the ACTUAL completed IDs/counts — it is
// printed only after every required execution and restore finished, and the
// oracle's own receipt line is printed only after its claimed counts are
// checked against the actuals. No unconditional N/N claim exists.
//
// Expectations: r4-shell-expectations.json — frozen INDEPENDENTLY of this
// control's runs (semantics from the admission/INTAKE frozen_expectations, the
// production classifyVitestReport predicates, and replay-fences-fire-deletion.sh:61-63;
// never derived from observed detector output). expectations-recovery.json is
// not read or altered here.
//
// Modes:
//   (default)          post-repair check: pinned inputs, pristine arms green,
//                      mutants detected, exit 0 only on full green.
//   --baseline-probe   prospective RED evidence: run against the PRE-repair lib
//                      (preimage pin) and expect the three defect arms to show
//                      the OLD acceptance (rc 0) while companions stay green;
//                      exit 0 = baseline defects confirmed present.
// Exit contract: 0 green / 1 RED (repaired predicate missing or mutant
// undetected) / 3 infrastructure (missing or mismatched input — including any
// oracle integrity violation — or spawn failure).

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync, lstatSync, mkdirSync, mkdtempSync,
  readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// HERE = <repo>/scripts/test-assurance/recovery-d011 — three levels deep.
const REPO_ROOT = resolve(HERE, '../../..');
const EXP_PATH = join(HERE, 'r4-shell-expectations.json');
const LIB_REL = 'scripts/test-assurance/counterfactuals/counterfactual-lib.sh';
const FIXT_DIR_REL = 'scripts/test-assurance/recovery-d011/fixtures/r4-runner';
const CX3_REL = 'scripts/test-assurance/recovery-d011/classifiers/cx3.json';

// ── integrity constants (admitted delta): the ONLY oracle this control may
// judge, and the ONLY pristine/mutant populations it may run. Any other bytes
// refuse as INFRA before a single arm executes.
const REQUIRED_ORACLE_SHA256 = 'c1eed1a0dda6869930eea4e295931ae08d4c43a476d864553e17bc77522f018e';
const REQUIRED_PRISTINE_IDS = [
  'R4S-REAL-UNHANDLED-REFUSED',
  'R4S-CX3-STATUS-REFUSED',
  'R4S-CX3-INTENDED-REFUSED',
  'R4S-REAL-HEALTHY-ACCEPTED',
  'R4S-REAL-INTENDEDFAIL-ACCEPTED',
  'R4S-SUITECRASH-FENCES-ACCEPTED',
];
const REQUIRED_MUTANT_IDS = [
  'R4S-MUT-UNHANDLED-PERMISSIVE',
  'R4S-MUT-CX3-STATUS-REMASKED',
  'R4S-MUT-CX3-INTENDED-REMASKED',
  'R4S-MUT-OVERSTRICT-EXIT1',
];

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const sha256File = (p) => sha256(readFileSync(p));

// Control-flow contract: red()/infra() THROW (never process.exit) so the
// top-level finally always tears the scratch worktree down — an exit() inside
// the try would skip it and leak the worktree registration.
class Red extends Error {}
class Infra extends Error {}
function infra(msg) { throw new Infra(`R4-SHELL-INFRA: ${msg}`); }
function red(msg) { throw new Red(`R4-SHELL-RED: ${msg}`); }

const BASELINE_PROBE = process.argv.slice(2).includes('--baseline-probe');

function existsOrNull() {
  try { lstatSync(EXP_PATH); return true; } catch { return false; }
}

// Exact population enforcement (defense-in-depth behind the full-hash pin): set
// equality with explicit missing/extra/duplicate diagnostics.
function enforcePopulation(label, gotIds, requiredIds) {
  const dupes = gotIds.filter((id, i) => gotIds.indexOf(id) !== i);
  if (dupes.length > 0) infra(`oracle integrity refusal: duplicate ${label} IDs ${JSON.stringify([...new Set(dupes)])} — a duplicated control is not a bigger pass`);
  const got = new Set(gotIds);
  const req = new Set(requiredIds);
  const missing = requiredIds.filter((id) => !got.has(id));
  const extra = gotIds.filter((id) => !req.has(id));
  if (missing.length > 0) infra(`oracle integrity refusal: required ${label} IDs missing from the oracle ${JSON.stringify(missing)} — skipping a required control is never a pass`);
  if (extra.length > 0) infra(`oracle integrity refusal: unknown ${label} IDs in the oracle ${JSON.stringify(extra)} — this control judges exactly the approved ${requiredIds.length} ${label}, no new oracle controls`);
  if (got.size !== requiredIds.length) infra(`oracle integrity refusal: ${label} population ${got.size} != required ${requiredIds.length}`);
}

// ── oracle load + integrity binding (BEFORE any reliance: called as the very
// first act of main(), so any refusal exits 3 through the normal throw path
// with no worktree, no run dirs, no partial receipts).
function loadOracle() {
  if (!existsOrNull()) infra('r4-shell-expectations.json is missing — refusing to run an empty control');
  const oracleBytes = readFileSync(EXP_PATH);
  const oracleSha = sha256(oracleBytes);
  if (oracleSha !== REQUIRED_ORACLE_SHA256) {
    infra(`oracle integrity refusal: r4-shell-expectations.json sha256 ${oracleSha} != approved ${REQUIRED_ORACLE_SHA256} — an altered/new/empty oracle is never judged, never silently bypassed (finding R4-CONTROL-EMPTY-REQUIRED-MUTANTS)`);
  }
  const EXP = JSON.parse(oracleBytes.toString('utf8'));
  if (!EXP || !Array.isArray(EXP.pristine_arms) || EXP.pristine_arms.length === 0) {
    infra('oracle carries no pristine arms (empty control refused)');
  }
  if (!Array.isArray(EXP.mutants)) infra('oracle carries no mutants array (empty control refused)');
  enforcePopulation('pristine', EXP.pristine_arms.map((a) => a.id), REQUIRED_PRISTINE_IDS);
  enforcePopulation('mutant', EXP.mutants.map((m) => m.id), REQUIRED_MUTANT_IDS);
  for (const m of EXP.mutants) {
    if (!REQUIRED_PRISTINE_IDS.includes(m.target_arm)) {
      infra(`oracle integrity refusal: mutant ${m.id} targets unknown arm ${m.target_arm}`);
    }
  }
  console.log(`R4-SHELL-ORACLE validated (sha256 ${oracleSha.slice(0, 12)}… == approved pin; pristine ${REQUIRED_PRISTINE_IDS.length} IDs exact; mutants ${REQUIRED_MUTANT_IDS.length} IDs exact)`);
  return { EXP, oracleSha };
}

// ── spawn plumbing ─────────────────────────────────────────────────────────────

function childEnv() {
  const env = { ...process.env };
  for (const k of ['CI', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete env[k];
  env.FORCE_COLOR = '0';
  return env;
}

function bash(script, timeoutMs = 180_000) {
  const r = spawnSync('bash', ['-c', script], { encoding: 'utf8', timeout: timeoutMs, env: childEnv() });
  if (r.error) infra(`bash spawn failed: ${r.error.message}`);
  return { rc: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

function git(args, cwd) {
  const r = spawnSync('git', args, { encoding: 'utf8', cwd, env: childEnv() });
  if (r.status !== 0) infra(`git ${args.join(' ')} failed: ${(r.stderr || r.stdout).trim().slice(0, 300)}`);
  return (r.stdout || '').trim();
}

const q = (s) => JSON.stringify(s);

// ── scratch worktree (detached at HEAD) + node_modules link ────────────────────

const WT = mkdtempSync(join(tmpdir(), 'r4s-wt-XXXXXX'));
const runDirs = [];
let worktreeAdded = false;
let tornDown = false;
function teardown() {
  if (tornDown) return;
  tornDown = true;
  const nm = join(WT, 'node_modules');
  try {
    if (lstatSync(nm).isSymbolicLink()) unlinkSync(nm);
  } catch { /* absent — nothing to unlink */ }
  if (worktreeAdded) {
    spawnSync('git', ['worktree', 'remove', '--force', WT], { encoding: 'utf8', env: childEnv() });
  } else {
    rmSync(WT, { recursive: true, force: true });
  }
  for (const d of runDirs) rmSync(d, { recursive: true, force: true });
}

function main() {
  const { EXP, oracleSha } = loadOracle();
  git(['worktree', 'add', '--detach', WT, 'HEAD'], REPO_ROOT);
  worktreeAdded = true;
  symlinkSync(join(REPO_ROOT, 'node_modules'), join(WT, 'node_modules'));
  const LIB = join(WT, LIB_REL);

  // ── fail-closed input pinning ────────────────────────────────────────────────
  const pins = EXP.input_hashes;
  const wantLib = BASELINE_PROBE ? pins['counterfactual-lib.sh'].pre_sha256 : pins['counterfactual-lib.sh'].post_sha256;
  if (sha256File(LIB) !== wantLib) {
    infra(`counterfactual-lib.sh is not the ${BASELINE_PROBE ? 'preimage' : 'pinned post-repair'} bytes (got ${sha256File(LIB).slice(0, 12)}…, want ${wantLib.slice(0, 12)}…) — refusing to judge drifted input`);
  }
  for (const rel of ['unhandled.test.ts', 'healthy.test.ts', 'intended-fail.test.ts']) {
    if (sha256File(join(WT, FIXT_DIR_REL, rel)) !== pins[`fixtures/r4-runner/${rel}`]) {
      infra(`frozen fixture ${rel} hash mismatch — refusing to judge drifted input`);
    }
  }
  const cx3 = JSON.parse(readFileSync(join(WT, CX3_REL), 'utf8'));
  if (sha256File(join(WT, CX3_REL)) !== pins['classifiers/cx3.json']) {
    infra('frozen cx3.json hash mismatch — refusing to judge drifted input');
  }
  if (!BASELINE_PROBE) {
    for (const a of EXP.anchors_must_remain_exactly_once ?? []) {
      const n = readFileSync(LIB, 'utf8').split(a).length - 1;
      if (n !== 1) infra(`frozen anchor occurs ${n}× (must be exactly 1): ${a.slice(0, 60)}…`);
    }
  }
  const pristineLibBytes = readFileSync(LIB);

  // ── arm execution (all through the GENUINE sourced helpers) ──────────────────

  function scratchRunDir(tag) {
    const dir = mkdtempSync(join(tmpdir(), `r4s-${tag}-XXXXXX`));
    runDirs.push(dir);
    mkdirSync(join(dir, 'tests'));
    return dir;
  }

  function realRun(arm, phaseTag) {
    const dir = scratchRunDir(phaseTag);
    copyFileSync(join(WT, FIXT_DIR_REL, arm.fixture), join(dir, 'tests', arm.fixture));
    const res = bash(`source ${q(LIB)}; run_scratch_vitest ${q(dir)} ${q(phaseTag)} tests/${arm.fixture}`);
    return { res, dir };
  }

  function cx3ReportFile() {
    const p = join(scratchRunDir('cx3'), 'cx3.report.json');
    writeFileSync(p, `${JSON.stringify(cx3.report, null, 2)}\n`);
    return p;
  }

  function runArm(arm, phaseTag) {
    switch (arm.kind) {
      case 'real-run-refused': {
        const { res } = realRun(arm, phaseTag);
        return { rc: res.rc, out: res.out };
      }
      case 'cx3-status-refused': {
        const res = bash(`source ${q(LIB)}; expect_file_status ${q(cx3ReportFile())} one.test.ts fail`);
        return { rc: res.rc, out: res.out };
      }
      case 'cx3-intended-refused': {
        const res = bash(`source ${q(LIB)}; expect_intended ${q(cx3ReportFile())} one.test.ts ${q(arm.pattern)}`);
        return { rc: res.rc, out: res.out };
      }
      case 'suite-crash-accepted': {
        // The fences-fire delivery lane: a whole-suite crash (file failed, zero
        // assertionResults, evidence in the file message) accepted ONLY through
        // asserted evidence — status fail + the intended text via the fallback.
        const p = join(scratchRunDir('suiterash'), 'suite-crash.report.json');
        writeFileSync(p, `${JSON.stringify(arm.report, null, 2)}\n`);
        const f = bash(`source ${q(LIB)}; expect_file_status ${q(p)} plugin-dual-engine.test.ts fail`);
        const i = bash(`source ${q(LIB)}; expect_intended ${q(p)} plugin-dual-engine.test.ts ${q(arm.pattern)}`);
        return { rc: f.rc !== 0 ? f.rc : i.rc, out: `${f.out}${i.out}` };
      }
      case 'real-run-accepted': {
        const { res, dir } = realRun(arm, phaseTag);
        const report = join(dir, `report-${phaseTag}.json`);
        const f = bash(`source ${q(LIB)}; expect_file_status ${q(report)} ${q(arm.fixture)} pass`);
        return { rc: res.rc !== 0 ? res.rc : f.rc, out: `${res.out}${f.out}` };
      }
      case 'real-run-accepted-intended-fail': {
        const { res, dir } = realRun(arm, phaseTag);
        const report = join(dir, `report-${phaseTag}.json`);
        const f = bash(`source ${q(LIB)}; expect_file_status ${q(report)} ${q(arm.fixture)} fail`);
        const i = bash(`source ${q(LIB)}; expect_intended ${q(report)} ${q(arm.fixture)} ${q(arm.pattern)}`);
        return { rc: res.rc !== 0 ? res.rc : f.rc !== 0 ? f.rc : i.rc, out: `${res.out}${f.out}${i.out}` };
      }
      default:
        infra(`unknown arm kind '${arm.kind}' (frozen expectations carry an arm the control cannot execute)`);
    }
    return undefined;
  }

  function checkArm(arm, expect, obs, label) {
    if (obs.rc !== expect.rc) {
      return `${label}: ${arm.id} rc=${obs.rc} want rc=${expect.rc} — ${obs.out.split('\n').filter((l) => l.trim()).slice(-2).join(' | ').slice(0, 300)}`;
    }
    for (const inc of expect.out_includes ?? []) {
      if (!obs.out.includes(inc)) return `${label}: ${arm.id} output lacks '${inc}' — ${obs.out.split('\n').slice(-3).join(' | ').slice(0, 300)}`;
    }
    return null;
  }

  // ── baseline probe: the pre-repair defects must be OBSERVED, not assumed ─────
  if (BASELINE_PROBE) {
    const bp = EXP.baseline_probe;
    let defects = 0;
    const observed = [];
    for (const arm of EXP.pristine_arms) {
      const expect = bp[arm.id];
      if (!expect) infra(`baseline_probe lacks expectations for arm ${arm.id}`);
      const obs = runArm(arm, `bp-${arm.id}`);
      const err = checkArm(arm, expect, obs, 'BASELINE');
      if (err) red(err);
      if (expect.defect) defects += 1;
      observed.push(arm.id);
      console.log(`R4-SHELL-BASELINE ${arm.id} ${expect.defect ? 'DEFECT-PRESENT' : 'COMPANION-GREEN'} (rc=${obs.rc})`);
    }
    if (defects !== (bp.__expected_defects ?? 3)) red(`baseline probe observed ${defects} defects, expected ${bp.__expected_defects}`);
    console.log(`R4-SHELL-BASELINE-PROBE defects-present (${defects} defect arms accepted by the pre-repair shell; ${observed.length}/${EXP.pristine_arms.length} arms observed green-or-defect as frozen; companions green) — the prospective RED is real`);
    return;
  }

  // ── pristine phase: completed IDs recorded ONLY on a verified-green run ──────
  const completedArms = [];
  for (const arm of EXP.pristine_arms) {
    const obs = runArm(arm, `p-${arm.id}`);
    const err = checkArm(arm, arm.expect, obs, 'PRISTINE');
    if (err) red(err);
    completedArms.push(arm.id);
    console.log(`R4-SHELL-ARM ${arm.id} GREEN (rc=${obs.rc})`);
  }

  // ── mutant phase: each fault flips exactly its target arm ────────────────────
  const completedMutants = [];
  let restoresProven = 0;
  for (const m of EXP.mutants) {
    const before = readFileSync(LIB, 'utf8');
    const occurrences = before.split(m.from).length - 1;
    if (occurrences !== 1) infra(`mutant ${m.id} FROM occurs ${occurrences}× (want 1) — pin drift`);
    const after = before.replace(m.from, m.to);
    const pin = sha256(`${m.id}\n${m.from}\n${m.to}`);
    if (pin !== m.expected_sha256) infra(`mutant ${m.id} pin mismatch — expectations frozen against different bytes`);
    writeFileSync(LIB, after);
    console.log(`R4-SHELL-PATCH ${m.id} sha256=${pin} occurrences=1 before=${sha256(before).slice(0, 12)}… after=${sha256(after).slice(0, 12)}…`);

    let flipped = null;
    const others = [];
    for (const arm of EXP.pristine_arms) {
      const obs = runArm(arm, `m-${m.id}-${arm.id}`);
      const stillGreen = checkArm(arm, arm.expect, obs, 'MUTANT') === null;
      const targetGone = checkArm(arm, m.expect_target, obs, 'MUTANT') === null;
      if (targetGone && stillGreen) infra(`mutant ${m.id}: arm ${arm.id} satisfies BOTH the pristine and the mutated expectation — the pin is not discriminating`);
      if (arm.id === m.target_arm) {
        flipped = targetGone ? obs : null;
      } else if (!stillGreen) {
        others.push(arm.id);
      }
    }
    if (!flipped) red(`mutant ${m.id} did NOT flip its target arm ${m.target_arm} — the repaired predicate is not reached by this fault`);
    if (others.length > 0) red(`mutant ${m.id} also flipped non-target arm(s): ${others.join(', ')} — fault coupling, the pin is not localized`);

    writeFileSync(LIB, before);
    if (sha256File(LIB) !== sha256(pristineLibBytes)) infra(`restore mismatch after mutant ${m.id}`);
    restoresProven += 1;
    console.log(`R4-SHELL-RESTORED ${LIB_REL} sha256=${sha256(pristineLibBytes).slice(0, 12)}… byte-proven`);
    completedMutants.push(m.id);
    console.log(`R4-SHELL-MUTANT ${m.id} FLIP-DETECTED (target ${m.target_arm} reverted to the defective behavior; every other arm stayed green)`);
  }

  // ── completion receipt: built from ACTUALS, printed only now ─────────────────
  if (completedArms.length !== REQUIRED_PRISTINE_IDS.length) {
    red(`completion refusal: only ${completedArms.length}/${REQUIRED_PRISTINE_IDS.length} pristine arms actually completed (${completedArms.join(', ') || 'none'}) — no receipt may claim more than ran`);
  }
  if (completedMutants.length !== REQUIRED_MUTANT_IDS.length) {
    red(`completion refusal: only ${completedMutants.length}/${REQUIRED_MUTANT_IDS.length} mutants actually completed (${completedMutants.join(', ') || 'none'}) — no receipt may claim more than ran`);
  }
  console.log(`R4-SHELL-COMPLETED actuals: pristine ${completedArms.length}/${REQUIRED_PRISTINE_IDS.length} [${completedArms.join(', ')}]; mutants ${completedMutants.length}/${REQUIRED_MUTANT_IDS.length} [${completedMutants.join(', ')}]; restores ${restoresProven}/${EXP.mutants.length} byte-proven; oracle ${oracleSha.slice(0, 12)}…`);

  // The oracle's frozen receipt line is printed ONLY after its claimed counts
  // are checked against the actuals (an oracle claiming more than ran refuses).
  const claimedPristine = /pristine (\d+)\//.exec(EXP.receipt_final)?.[1];
  const claimedMutants = /mutants (\d+)\//.exec(EXP.receipt_final)?.[1];
  if (String(completedArms.length) !== claimedPristine || String(completedMutants.length) !== claimedMutants) {
    infra(`oracle receipt integrity refusal: receipt_final claims pristine ${claimedPristine}/mutants ${claimedMutants} but the actual completed counts are ${completedArms.length}/${completedMutants.length} — a receipt that overstates execution is never printed`);
  }
  console.log(EXP.receipt_final);
}

try {
  main();
} catch (e) {
  if (e instanceof Red) {
    console.error(e.message);
    process.exitCode = 1;
  } else {
    // infra() already prefixes its message; only uncaught errors get one here.
    console.error(e instanceof Infra ? e.message : `R4-SHELL-INFRA: uncaught: ${e && e.stack ? e.stack : String(e)}`);
    process.exitCode = 3;
  }
} finally {
  teardown();
}
