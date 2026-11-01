#!/usr/bin/env node
// S1 stage acceptance adapter — test-assurance kernel, Batch G (spec §5 "First implementation
// acceptance" + §6 lanes; frozen design: docs/test-assurance-kernel/s1/batches.md Batch G).
//
// WHAT THIS IS: a narrow acceptance REPLAY over existing public entrypoints — not a new test
// platform. Every registered step spawns a real entrypoint (the ESLint CLI over the frozen
// corpus, the frozen outer conformance driver, the counterfactual and delivery replay scripts,
// the vitest suites, the twin drift check, packages/core tsc) and checks FRESH outcomes against
// the frozen oracle (scripts/test-assurance/expectations.json) and the pinned counterfactual
// records. Merely reading a stored report is never sufficient: an accepted verdict requires the
// replays to have actually run in this invocation.
//
// EXIT GRAMMAR (mirrors driver.mjs; T-TAK-A — infrastructure never counts as acceptance):
//   0  every registered step PASSed — the stage is accepted for this invocation
//   1  RED: missing/invalid evidence, failed replay, unresolved blocking obligation, an
//      expected rejection that did not happen, non-vacuity failure — a REAL acceptance failure
//   3  INFRASTRUCTURE: missing prerequisite/binary, host or repo-identity refusal, spawn
//      error/timeout, runner fatal status — the run CANNOT CONCLUDE (never green, never red)
// INFRA takes precedence over RED in the final exit: a run that could not execute a step can
// claim neither acceptance nor a detection verdict over it.
//
// Usage:
//   node scripts/test-assurance/verify.mjs --stage S1 [--require-host darwin|linux] [--step <id>]
//   node scripts/test-assurance/verify.mjs --stage S1 --tamper-arm T0|T1|T2
//   node scripts/test-assurance/verify.mjs --stage S1 --promote-gate
//
// Promotion gates (rework round 1, 2026-10-08; re-pointed final rework, 2026-10-10):
// artifact-level enforcement of the promotion-blocking dispositions queue entries
// (classification stale-bundle). A queue note that merely says "MUST be rebuilt" is
// #hope-as-gate (attention-is-not-a-mechanism), so each gate pins the mechanical check that
// must go GREEN at/before S1 promote; stepDispositions refuses a stale-bundle entry that does
// not name its --promote-gate run. The gate is pinned to the REAL delivery carrier —
// packages/core/hooks/checks/guard-liveness.ts, the tracked source the Q1/Q2 changed-file arm
// ships as — because the bundler keeps first-party modules external by design
// (scripts/build-runtime-bundles.mjs), so a symbol-in-bundle probe can never resolve; bundle
// freshness is enforced by the runtime-bundles-drift script-selftests lane, referenced as each
// gate's freshness evidence.
//
// Tamper arms (evidence for the adapter's own fail-closed property, spec §6 anti-detector
// discipline applied to the adapter itself): each performs ONE exactly-once in-place tamper,
// re-runs the affected step through a child invocation of THIS adapter, requires the tampered
// run to come out non-green as designed, then restores the original bytes hash-proven.
//   T0  blocking dispositions queue missing            → dispositions step RED   (exit 1)
//   T1  a pinned counterfactual record dropped         → k7-records RED naming it (exit 1)
//   T2  a driver baseline selector emptied             → driver refuses (exit 3) → this
//       adapter refuses to conclude (T-TAK-A: an empty selector is never green)
// Arm exits: 0 = every requested tamper was DETECTED · 1 = a tamper went undetected (the
// adapter can be silenced — REAL failure) · 3 = infrastructure.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import {
  existsSync, mkdtempSync,
  readFileSync,
  renameSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { platform, type, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
// S3/S4 acceptance layer (stage module): routing + the additive post-S2 inventory consumption.
// An absent scope-extension ledger keeps this import behaviorally inert for S1/S2 (see
// stepS2Inventory).
import { buildStageSteps as s3BuildStageSteps, loadScopeExtension, loadReviewedIntegration, reconcileUpstreamLineage, S2_REVIEWED_INTEGRATION_REL } from './s3.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../..');
const ORACLE_REL = 'scripts/test-assurance/expectations.json';
const DRIVER_EXP_REL = 'scripts/test-assurance/driver-expectations.json';
const DRIVER_REL = 'scripts/test-assurance/driver.mjs';
const RECOVERY_DRIVER_REL = 'scripts/test-assurance/recovery-d011/driver.mjs';
const DISPOSITIONS_REL = 'docs/test-assurance-kernel/s1/dispositions.md';
const ESLINT_BIN = join(REPO_ROOT, 'node_modules/.bin/eslint');
const VITEST_BIN = join(REPO_ROOT, 'node_modules/.bin/vitest');
const TSX_BIN = join(REPO_ROOT, 'node_modules/.bin/tsx');
const TSC_BIN = join(REPO_ROOT, 'node_modules/.bin/tsc');
const CF_DIR_REL = 'docs/test-assurance-kernel/s1/counterfactuals';
const PROBES_REL = [
  'scripts/test-assurance/driver-probes/glv-parse-error-probe.mts',
  'scripts/test-assurance/driver-probes/glv-healthy-rule-probe.mts',
];
// The enumerated denominator of pinned counterfactual records (T1 names the dropped one —
// a count alone cannot distinguish "all present" from "the registry shrank with the corpus").
const CF_RECORD_IDS = [
  'cf1-a03-circular-oracle',
  'cf2a-age-boundary-shift',
  'cf2b-min-age-weaken',
  'cf3-guard-liveness-permissive',
  'cf4-guard-liveness-status-inversion',
];
const CF_SUITES_STEP_TIMEOUT_MS = 600_000;
// The recovery driver re-runs 14 arms × (pristine+mutant) in scratch worktrees — several
// arms are full vitest lanes (p52/p53/r4 probes) — plus the K3 control with three
// vitest runs per phase (pristine/mutant/restored × 2 faults). Budget accordingly.
const RECOVERY_STEP_TIMEOUT_MS = 1_800_000;
const STEP_TIMEOUT_MS = 300_000;
const QUICK_TIMEOUT_MS = 120_000;

// M15 actual-lineage successor (chief decision tak-m15-real-lineage-successor-decision-
// 20261014.json, option B; supersedes the review-round-5 [89d0cdb7197e] carrier mechanism).
// The historical host commit 46c8d1d5f78 is NOT recoverable (local object probe exit 128;
// GitHub commit lookup HTTP 422; configured container transport timed out — remote UNKNOWN;
// never synthesized — see dispositions.md #disp-m15-successor-merge-carrier). The citation
// slot it occupied is filled by the VERIFIED actual lineage: every link below must be a
// REAL git object in THIS checkout, checked live by the dispositions step's actual-lineage
// arm (commit type, exact tree, ancestry, generation parent linkage, exact generation diff,
// manifest bytes). A missing or mutated link REDs; there is NO owner-stage carrier fallback
// anymore — the one carrier entry existed only for the unrecoverable historical commit, and
// queue prose alone never discharges missing actual evidence (a citation nobody can resolve
// is a #hope-as-gate).
const ACTUAL_LINEAGE = {
  recovered: {
    sha: '4fa71b5d0429720244da763de1c62cc885d99c39',
    tree: '4229a3a350c844813388c6844f995ea6b1434a7d',
    role: 'byte-exact source recovery snapshot (reconstructed bytes committed as a NEW commit — not the lost historical be84/46 objects)',
  },
  source: {
    sha: '1cb4a51d3e71534403a4769ee3a80577ce2505ff',
    tree: '63a480cad56fb2c254b93a78748effd817ccaec6',
    role: 'independently accepted repaired source (ACTUAL-SOURCE-HEAD-GO 56f33fd1…)',
  },
  generation: {
    sha: 'ac17594f1f1edaad7d98b0acb2ddcd08e748518f',
    tree: 'a5da6f4068f948381bdae3e9aeafd680db6bb799',
    role: 'reciprocal host generation from the accepted source (independent S1 acceptance e011679d…)',
    parent: 'source',
    diffAllowlist: ['packages/getff/MANIFEST.sha256'],
    manifestPath: 'packages/getff/MANIFEST.sha256',
    manifestSha256: '235967764aca27d33b1ec73c9f30c62b74f933585f4ac2d82cc16d429d4e20bc',
  },
};
// The decision is bound to the queue, not just to this constant: the lineage arm requires
// the LAST dispositions entry naming each of these sources to be the successor record —
// dropping or reverting one re-opens the M15 condition and REDs here.
const M15_SUCCESSOR_ENTRIES = [
  { source: 'merge-carrier/46c8d1d5f78', id: 'disp-m15-successor-merge-carrier' },
  { source: 'merge-forward/reopen-manifest-regen', id: 'disp-m15-successor-s2-entry-regen' },
  { source: 'd011/shared-derived-artifact-hold', id: 'disp-m15-successor-d011-hold' },
];
// M15 correction-1 (independent review 09826c35, finding M15-F1): the receipts are not prose —
// they are embedded BYTE-EXACTLY in dispositions.md as zlib+base64 blocks and pinned here.
// The dispositions step refuses missing/empty/malformed/altered/duplicate blocks BEFORE any
// reliance and cross-validates their recorded lineage identities against the live git objects.
// sha256+byte pins are of the ORIGINAL receipt files (raw originals retained in the
// coordination store; the absolute paths inside them are historical labels, never operational
// dependencies — no host path is needed to conclude).
const M15_RECEIPTS = [
  { id: 'SOURCE_GO', sha256: '56f33fd15124806dce58c8ac3e60f9651187e19ef983a8b4c7b41023862cbbb5', bytes: 12485 },
  { id: 'S1_GO', sha256: 'e011679d161ea7c03940f0cf9033960e7f6bd114bfc153d38ea3476a93f7e548', bytes: 6905 },
  { id: 'OWNERSHIP_RENEWAL', sha256: '23575146581203ba7a54ddda5a6237ff5d4cfd1d0cd627a0bcd7b6eeec42ea9d', bytes: 3536 },
  { id: 'FRESHNESS_RESULTS', sha256: '114ced7360848fae5c324163f5cdb257544acd5178bfe872c91963c48ecab3fe', bytes: 1131 },
  { id: 'GENERATION_INPUT', sha256: 'bf29732001ebd9ddd4477ed7e5a9f199ed04667090eeb8a52053acf77be570ee', bytes: 587 },
  { id: 'GENERATION_AFTER', sha256: 'd00ccc4c168ab84eb2726792d4f948c19a06b804e68eb6ce3adb9e045cb26784', bytes: 2067 },
];
// M15 correction-2 (independent review 6b469b3f, finding M15-F4 — existing T-TAK-A empty
// governed selection / disconnected registry): the required-role identities below are FROZEN
// INDEPENDENTLY of the mutable M15_RECEIPTS / M15_SUCCESSOR_ENTRIES descriptor arrays above.
// Emptying, reducing, duplicating or substituting a registry is itself a finding — mandatory
// evidence stays mandatory even when its registry is disconnected. The dispositions step
// checks presence/membership UNCONDITIONALLY against these frozen identities before any
// linkage reliance; this is not a count shortcut (each required identity is named and checked
// individually, and a count alone could not distinguish missing from substituted).
const M15_REQUIRED_RECEIPT_ROLES = 'SOURCE_GO,S1_GO,OWNERSHIP_RENEWAL,FRESHNESS_RESULTS,GENERATION_INPUT,GENERATION_AFTER';
const M15_REQUIRED_SUCCESSOR_TUPLES = 'merge-carrier/46c8d1d5f78=>disp-m15-successor-merge-carrier|merge-forward/reopen-manifest-regen=>disp-m15-successor-s2-entry-regen|d011/shared-derived-artifact-hold=>disp-m15-successor-d011-hold';

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

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

/** Spawn with timeout. A spawn error/signal/timeout throws InfraError (never a verdict). */
function run(bin, args, { cwd = REPO_ROOT, timeout = QUICK_TIMEOUT_MS, env = childEnv() } = {}) {
  if (bin.includes('/') && !existsSync(bin)) throw new InfraError(`required binary missing: ${bin}`);
  const res = spawnSync(bin, args, { cwd, env, encoding: 'utf8', timeout, killSignal: 'SIGTERM' });
  if (res.error) {
    const code = res.error.code ?? res.error.message;
    if (res.error.code === 'ETIMEDOUT') throw new InfraError(`timed out after ${timeout}ms: ${bin} ${args.join(' ')}`);
    throw new InfraError(`spawn failed (${code}): ${bin} ${args.join(' ')}`);
  }
  if (res.signal) throw new InfraError(`killed by ${res.signal}: ${bin} ${args.join(' ')}`);
  return { rc: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

class InfraError extends Error {}
const red = (msg) => ({ status: 'RED', msg });
const pass = (msg) => ({ status: 'PASS', msg });
const infraStep = (msg) => ({ status: 'INFRA', msg });

function repoPath(rel) {
  if (typeof rel !== 'string' || rel.length === 0 || isAbsolute(rel) || rel.includes('..')) return null;
  return join(REPO_ROOT, rel);
}

/** The physical git common dir of a checkout, env-scrubbed (host-verify.sh guard predicate). */
function gitCommonDir(dir) {
  const res = spawnSync('git', ['-C', dir, 'rev-parse', '--git-common-dir'], { env: gitEnv(), encoding: 'utf8' });
  if (res.status !== 0 || !res.stdout) return null;
  const out = res.stdout.trim();
  if (!out) return null;
  try {
    return realpathSync(isAbsolute(out) ? out : resolve(dir, out));
  } catch {
    return null;
  }
}

// ── frozen inputs (fail-closed before any verdict is printed) ─────────────────

let ORACLE = null;
let DRIVER_EXP = null;
let ORACLE_SHA = '';

function loadFrozenInputs() {
  const oraclePath = join(REPO_ROOT, ORACLE_REL);
  const driverExpPath = join(REPO_ROOT, DRIVER_EXP_REL);
  if (!existsSync(oraclePath)) throw new InfraError(`frozen oracle missing: ${ORACLE_REL}`);
  if (!existsSync(driverExpPath)) throw new InfraError(`driver expectations missing: ${DRIVER_EXP_REL}`);
  try {
    ORACLE = JSON.parse(readFileSync(oraclePath, 'utf8'));
    DRIVER_EXP = JSON.parse(readFileSync(driverExpPath, 'utf8'));
  } catch (e) {
    throw new InfraError(`frozen input does not parse: ${e.message}`);
  }
  if (!Array.isArray(ORACLE.cases) || ORACLE.cases.length === 0) {
    throw new InfraError('frozen oracle carries zero cases (empty selection — T-TAK-A)');
  }
  ORACLE_SHA = sha256(readFileSync(oraclePath, 'utf8'));
  if (DRIVER_EXP.frozen_oracle?.sha256 !== ORACLE_SHA) {
    throw new InfraError(
      `frozen-oracle drift: live expectations.json sha256 ${ORACLE_SHA.slice(0, 12)}… != driver-expectations pin ${String(DRIVER_EXP.frozen_oracle?.sha256).slice(0, 12)}… — the oracle changed without a new freeze`,
    );
  }
  if (!Array.isArray(DRIVER_EXP.baseline) || DRIVER_EXP.baseline.length === 0) {
    throw new InfraError('driver expectations carry no baseline rows (empty selection)');
  }
  if (!Array.isArray(DRIVER_EXP.arms) || DRIVER_EXP.arms.length === 0) {
    throw new InfraError('driver expectations carry no arms (empty selection)');
  }
}

// ── registry steps ────────────────────────────────────────────────────────────

function stepPrereqs() {
  for (const bin of [
    [ESLINT_BIN, 'eslint'],
    [VITEST_BIN, 'vitest'],
    [TSX_BIN, 'tsx'],
    [TSC_BIN, 'tsc'],
  ]) {
    if (!existsSync(bin[0])) return infraStep(`prerequisite binary missing: ${bin[1]} (${bin[0]}) — provisioning error, not a verdict`);
  }
  for (const rel of PROBES_REL) {
    if (!existsSync(join(REPO_ROOT, rel))) return infraStep(`frozen kernel probe missing: ${rel}`);
  }
  for (const c of ORACLE.cases) {
    if (!c.id || !c.path) return infraStep('oracle case without id/path');
    if (!existsSync(repoPath(c.path) ?? '')) return infraStep(`oracle case file missing: ${c.id} → ${c.path}`);
  }
  return pass(`binaries ok; probes ok; oracle ${ORACLE.cases.length} cases all present; live oracle sha256=${ORACLE_SHA.slice(0, 12)}… matches the driver-expectations pin; driver arms=${DRIVER_EXP.arms.length}`);
}

const RECORD_REQUIRED_STRINGS = [
  'recordId',
  'schema',
  'obligationId',
  'sourceSha',
  'carrier',
  'deliveryEdge',
  'baselineResult',
  'restoredResult',
  'classification',
  'replayCommand',
];
const HONEST_CLASSIFICATIONS = new Set([
  'killed',
  'survived',
  'equivalent',
  'unreachable',
  'out-of-contract',
  'infrastructure-failure',
]);

function recordProblems(id, rec) {
  const problems = [];
  for (const key of RECORD_REQUIRED_STRINGS) {
    if (typeof rec[key] !== 'string' || rec[key].length === 0) problems.push(`missing/empty ${key}`);
  }
  if (rec.recordId !== id) problems.push(`recordId ${JSON.stringify(rec.recordId)} != pinned ${id}`);
  if (typeof rec.testIds !== 'object' || rec.testIds === null || rec.testIds.length === 0) problems.push('missing/empty testIds');
  if (typeof rec.fixtureHash !== 'object' || rec.fixtureHash === null) problems.push('missing fixtureHash');
  if (typeof rec.faultPatch !== 'object' || rec.faultPatch === null) problems.push('missing faultPatch');
  if (rec.faultPatch && !Object.keys(rec.faultPatch).some((k) => k.toLowerCase().includes('sha256'))) {
    problems.push('faultPatch carries no sha256 field (patch hash unproven)');
  }
  if (typeof rec.reachabilityObservation !== 'object' || rec.reachabilityObservation === null) {
    problems.push('missing reachabilityObservation (spec §6: the fault must be independently proven reached)');
  }
  if (typeof rec.mutantResult !== 'object' && typeof rec.mutantResult !== 'string') problems.push('missing mutantResult');
  if (typeof rec.runtimeSeconds !== 'number' || !(rec.runtimeSeconds >= 0)) problems.push('missing/invalid runtimeSeconds');
  if (!HONEST_CLASSIFICATIONS.has(rec.classification)) {
    problems.push(`classification ${JSON.stringify(rec.classification)} is not an honest spec §6 value`);
  }
  if (!Array.isArray(rec.evidenceLogs) || rec.evidenceLogs.length === 0) {
    problems.push('missing/empty evidenceLogs (K7: raw logs must be retained)');
  } else {
    for (const logRel of rec.evidenceLogs) {
      if (!existsSync(repoPath(logRel) ?? '')) problems.push(`evidence log missing on disk: ${logRel}`);
    }
  }
  // replayCommand must name at least one entrypoint that actually exists on disk.
  const candidates = String(rec.replayCommand).match(/[\w@./-]+\.(?:sh|mjs|cjs|ts|mts)/g) ?? [];
  if (candidates.length === 0 || !candidates.some((cand) => existsSync(repoPath(cand) ?? ''))) {
    problems.push(`replayCommand names no existing entrypoint: ${rec.replayCommand}`);
  }
  return problems;
}

function stepK7Records() {
  const problems = [];
  for (const id of CF_RECORD_IDS) {
    const recRel = `${CF_DIR_REL}/${id}.json`;
    const recPath = repoPath(recRel);
    if (!recPath || !existsSync(recPath)) {
      problems.push(`pinned counterfactual record missing: ${recRel}`);
      continue;
    }
    let rec;
    try {
      rec = JSON.parse(readFileSync(recPath, 'utf8'));
    } catch (e) {
      problems.push(`${recRel} does not parse: ${e.message}`);
      continue;
    }
    problems.push(...recordProblems(id, rec).map((p) => `${id}: ${p}`));
  }
  if (problems.length > 0) return red(`${problems.length} K7 record finding(s): ${problems.join(' · ')}`);
  return pass(`${CF_RECORD_IDS.length}/${CF_RECORD_IDS.length} pinned spec §6 records valid (schema, patch hash, reachability, evidence logs on disk, replayable entrypoints)`);
}

/** K1/K2 static-matrix replay: the real CLI over every frozen oracle case, fresh. */
function stepStaticMatrix() {
  let rejects = 0;
  let admits = 0;
  const problems = [];
  for (const c of ORACLE.cases) {
    const res = run(ESLINT_BIN, [c.path], { timeout: QUICK_TIMEOUT_MS });
    // Freeze-review finding F1 grammar: eslint outside 0/1 is fatal → infrastructure.
    if (res.rc !== 0 && res.rc !== 1) {
      return infraStep(`eslint exited ${res.rc} (outside the documented 0/1 grammar) on ${c.path}: ${(res.stderr || res.stdout).trim().slice(0, 300)}`);
    }
    const rejectingRules = Object.entries(c.static ?? {})
      .filter(([, want]) => want === 'reject')
      .map(([rule]) => rule);
    if (rejectingRules.length > 0) {
      const output = res.stdout + res.stderr;
      const missingDiag = rejectingRules.filter((rule) => !output.includes(`rules-as-tests/${rule}`));
      if (res.rc !== 1 || missingDiag.length > 0) {
        problems.push(`${c.id}: expected reject (rc 1 + ${rejectingRules.join(',')}) but got rc=${res.rc}${missingDiag.length ? ` missing diagnostic ${missingDiag.join(',')}` : ''}`);
      } else {
        rejects += 1;
      }
    } else if (res.rc !== 0) {
      problems.push(`${c.id}: expected admit (rc 0) but got rc=${res.rc}: ${(res.stderr || res.stdout).trim().split('\n').slice(-2).join(' | ').slice(0, 240)}`);
    } else {
      admits += 1;
    }
  }
  if (rejects < 1 || admits < 1) {
    problems.push(`non-vacuity failed: rejects=${rejects} admits=${admits} — a matrix that rejects nothing or admits nothing proves nothing (T-TAK-A)`);
  }
  if (problems.length > 0) return red(`${problems.length} static-matrix finding(s): ${problems.join(' · ')}`);
  return pass(`${ORACLE.cases.length}/${ORACLE.cases.length} fresh CLI replays match the frozen oracle (rejects=${rejects} with intended rule ids, admits/fixtures=${admits} silent; wrong-import stays an honest rc-0 admission)`);
}

function stepDriver() {
  const res = run(process.execPath, [join(REPO_ROOT, DRIVER_REL)], { timeout: STEP_TIMEOUT_MS });
  const tail = (res.stderr.trim() || res.stdout.trim()).split('\n').slice(-2).join(' | ').slice(0, 300);
  if (res.rc === 0) return pass(`node ${DRIVER_REL} → 0 (baseline conforms; every anti-detector arm reached its frozen flip)`);
  if (res.rc === 1) return red(`driver exited 1 — a gate fault left corpus verification green (undetected K3/K4): ${tail}`);
  return infraStep(`driver exited ${res.rc} (refusal/infrastructure — cannot conclude): ${tail}`);
}

// D011 recovery controls (amended-2 supplemental arms 12->14 + accepted A3/amended-4
// K3 + A2 repeatability) — a MANDATORY unfiltered step: a missing/skipped/disconnected
// control must never leave this adapter green (intake obligation, 2026-10-14).
function stepRecovery() {
  const res = run(process.execPath, [join(REPO_ROOT, RECOVERY_DRIVER_REL)], { timeout: RECOVERY_STEP_TIMEOUT_MS });
  const tail = (res.stderr.trim() || res.stdout.trim()).split('\n').slice(-2).join(' | ').slice(0, 300);
  if (res.rc === 0) {
    const arms = (res.stdout.match(/RECOVERY-ARM [\w-]+ DETECTED/g) ?? []).length;
    if (arms !== 14) {
      return infraStep(`recovery driver exited 0 but emitted ${arms}/14 RECOVERY-ARM receipts — a disconnected control is never a pass: ${tail}`);
    }
    if (!/R4-SHELL-OK /.test(res.stdout)) {
      return infraStep(`recovery driver exited 0 with 14/14 arms but NO R4-SHELL-OK receipt — the R4 shell-consistency lane is disconnected (a missing control is never a pass): ${tail}`);
    }
    return pass(`node ${RECOVERY_DRIVER_REL} → 0 (${arms}/14 arms DETECTED; A2/A3/K3/R4-SHELL lanes green — recovery controls ran unfiltered)`);
  }
  if (res.rc === 1) return red(`recovery driver exited 1 — a frozen recovery control caught nothing or a repaired baseline drifted: ${tail}`);
  return infraStep(`recovery driver exited ${res.rc} (refusal/infrastructure — cannot conclude): ${tail}`);
}

function runReplayScripts(stepId, rels) {
  const problems = [];
  let infraMsg = null;
  for (const rel of rels) {
    const res = run('bash', [join(REPO_ROOT, rel)], { timeout: STEP_TIMEOUT_MS });
    if (res.rc === 0) continue;
    const tail = (res.stderr.trim() || res.stdout.trim()).split('\n').slice(-2).join(' | ').slice(0, 240);
    if (res.rc === 1) problems.push(`${rel} → 1 (demonstration failed): ${tail}`);
    else if (infraMsg === null) infraMsg = `${rel} → ${res.rc} (infrastructure — cannot conclude): ${tail}`;
  }
  if (infraMsg !== null) return infraStep(infraMsg);
  if (problems.length > 0) return red(`${problems.length} ${stepId} replay(s) failed: ${problems.join(' · ')}`);
  return pass(`${rels.length}/${rels.length} replays exit 0 (demonstrations reproduced; honest-survival characterizations pinned)`);
}

const CF_REPLAYS = CF_RECORD_IDS.map((id) => `scripts/test-assurance/counterfactuals/replay-${id}.sh`);
const DELIVERY_REPLAYS = [
  'scripts/test-assurance/delivery/replay-fences-fire-deletion.sh',
  'scripts/test-assurance/delivery/replay-principle-rename-break.sh',
  'scripts/test-assurance/delivery/replay-template-dangling-ref.sh',
  'scripts/test-assurance/delivery/replay-a12-emitted-corruption.sh',
];

function stepCounterfactuals() {
  return runReplayScripts('counterfactual', CF_REPLAYS);
}
function stepDelivery() {
  return runReplayScripts('delivery', DELIVERY_REPLAYS);
}

function stepSuites() {
  const res = run(
    VITEST_BIN,
    [
      'run',
      'packages/core/eslint-rules',
      'packages/core/hooks/checks',
      'packages/core/principles/51-test-quality-corpus-conformance.test.ts',
      'packages/core/principles/52-subprocess-status-conformance.test.ts',
      'packages/core/principles/53-delivery-discovery-conformance.test.ts',
    ],
    { timeout: CF_SUITES_STEP_TIMEOUT_MS },
  );
  const summary = (res.stdout.split('\n').find((l) => l.includes('Test Files')) ?? '').trim();
  if (res.rc === 0) return pass(`vitest suites → 0 (${summary || 'all green'}) — covers delivery-live/silent, K6 discovery ratchets, corpus ratchet`);
  if (res.rc === 1) return red(`vitest suites → 1 (${summary || 'failures'})`);
  return infraStep(`vitest exited ${res.rc} (infrastructure): ${(res.stderr || res.stdout).trim().slice(0, 240)}`);
}

function stepTwins() {
  const res = run('bash', [join(REPO_ROOT, 'scripts/build-shipped-eslint-rules.sh'), '--check'], { timeout: STEP_TIMEOUT_MS });
  if (res.rc === 0) return pass('build-shipped-eslint-rules.sh --check → 0 (committed twins in sync with .ts sources)');
  // Documented grammar of the twins script: 0 = sync, 1 = drift, 2 = missing toolchain.
  // Only the documented drift status is a RED; any other exit is infrastructure (F-H1).
  if (res.rc === 1) return red(`twins drift (rc=1): ${(res.stderr || res.stdout).trim().slice(0, 240)} — a shipped artifact no longer matches its source`);
  return infraStep(`twins check exited ${res.rc} (outside the documented 0/1 drift grammar — infrastructure): ${(res.stderr || res.stdout).trim().slice(0, 240)}`);
}

function stepTsc() {
  const res = run('npm', ['--prefix', join(REPO_ROOT, 'packages/core'), 'run', 'typecheck'], { timeout: STEP_TIMEOUT_MS });
  if (res.rc === 0) return pass('npm --prefix packages/core run typecheck → 0');
  return infraStep(`typecheck exited ${res.rc} (infrastructure — compilation failure is never detection): ${(res.stderr || res.stdout).trim().slice(0, 240)}`);
}

function parseDispositionsEntries(text) {
  const entries = [];
  const lines = text.split('\n');
  let inBlock = false;
  let start = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!inBlock && /^```json\s*$/.test(line)) {
      inBlock = true;
      start = i + 1;
    } else if (inBlock && /^```\s*$/.test(line)) {
      entries.push({ json: lines.slice(start, i).join('\n'), block: entries.length + 1 });
      inBlock = false;
    }
  }
  // F-H4: an unterminated final fence must surface, never vanish — a dropped entry is
  // indistinguishable from an absent one and can silently vacate a required coverage slot.
  if (inBlock) entries.push({ json: null, block: entries.length + 1, unterminated: true });
  return entries;
}

function stepDispositions() {
  const dispPath = repoPath(DISPOSITIONS_REL);
  if (!dispPath || !existsSync(dispPath)) {
    return red(`blocking dispositions queue missing: ${DISPOSITIONS_REL} — unresolved obligations have no consumer (spec §4: a warning nobody consumes is insufficient)`);
  }
  const raw = readFileSync(dispPath, 'utf8');
  const blocks = parseDispositionsEntries(raw);
  if (blocks.length === 0) return red(`${DISPOSITIONS_REL} carries zero fenced-JSON entries (empty selection — T-TAK-A)`);
  const problems = [];
  const entries = [];
  for (const { json, block, unterminated } of blocks) {
    if (unterminated) {
      problems.push(`entry #${block} opens a \`\`\`json fence that is never closed — it is not an entry; close the fence or delete the block`);
      continue;
    }
    let e;
    try {
      e = JSON.parse(json);
    } catch (err) {
      problems.push(`entry #${block} does not parse: ${err.message}`);
      continue;
    }
    if (typeof e.id !== 'string' || !e.id) problems.push(`entry #${block}: missing id`);
    if (typeof e.source !== 'string' || !e.source) problems.push(`entry #${block}: missing source`);
    if (e.disposition !== 'resolved' && e.disposition !== 'owner-stage') {
      problems.push(`entry #${block} (${e.id ?? '?'}): disposition ${JSON.stringify(e.disposition ?? null)} is neither resolved nor owner-stage (dangling/open blocking)`);
      continue;
    }
    if (e.disposition === 'resolved') {
      const ev = Array.isArray(e.resolution_evidence) ? e.resolution_evidence : [];
      const existing = ev.filter((p) => existsSync(repoPath(p) ?? ''));
      if (existing.length === 0) {
        problems.push(`entry ${e.id}: resolved but none of its resolution_evidence exists on disk [${ev.join(', ')}]`);
      }
    } else if (!['S2', 'S3', 'S4'].includes(e.owner_stage)) {
      problems.push(`entry ${e.id}: owner-stage without a valid owner_stage (S2|S3|S4), got ${JSON.stringify(e.owner_stage ?? null)}`);
    }
    // Promotion-blocking entries must name their mechanical gate: a note that says MUST is
    // #hope-as-gate (attention-is-not-a-mechanism) — the enforcement is verify.mjs --promote-gate.
    if (e.disposition === 'owner-stage' && e.classification === 'stale-bundle') {
      if (typeof e.promotion_gate !== 'string' || !e.promotion_gate.includes('--promote-gate')) {
        problems.push(`entry ${e.id}: promotion-blocking (stale-bundle) but promotion_gate does not name this adapter's --promote-gate run — a MUST note is not a mechanism (attention-is-not-a-mechanism)`);
      }
    }
    entries.push(e);
  }
  // Coverage denominators (enumerated, never counted): every counterfactual record whose
  // classification is neither killed nor equivalent, plus every oracle case whose expectation
  // routes to the review channel, MUST have a queue entry naming it as source.
  const requiredSources = [];
  for (const id of CF_RECORD_IDS) {
    const recPath = repoPath(`${CF_DIR_REL}/${id}.json`);
    if (!recPath || !existsSync(recPath)) continue; // k7-records already named the gap
    try {
      const rec = JSON.parse(readFileSync(recPath, 'utf8'));
      if (rec.classification !== 'killed' && rec.classification !== 'equivalent') requiredSources.push(id);
    } catch {
      /* k7-records already named the gap */
    }
  }
  for (const c of ORACLE.cases) {
    if (c.expectation === 'reject-by-review') requiredSources.push(c.id);
  }
  for (const src of requiredSources) {
    // F-H3: supersede semantics — the LAST entry naming a source is the binding one, so a
    // correction is appended as a new entry per the queue's own append-only discipline.
    const entry = entries.findLast((e) => e.source === src);
    if (!entry) {
      problems.push(`no dispositions entry covers ${src} (source must name it) — unresolved blocking obligation`);
      continue;
    }
    const recPath = repoPath(`${CF_DIR_REL}/${src}.json`);
    if (recPath && existsSync(recPath)) {
      try {
        const rec = JSON.parse(readFileSync(recPath, 'utf8'));
        if (entry.classification !== rec.classification) {
          problems.push(`entry ${entry.id}: classification ${JSON.stringify(entry.classification)} drifts from record ${src} (${JSON.stringify(rec.classification)})`);
        }
      } catch {
        /* k7-records already named the gap */
      }
    }
  }
  // M15 actual-lineage successor: the recovered→source→generation→HEAD chain is verified as
  // REAL objects — commit type, exact tree, ancestry, generation parent linkage, exact
  // generation diff and manifest bytes. A link that cannot resolve or no longer matches the
  // recorded identity REDs; the historical owner-stage carrier fallback died with the
  // unrecoverable 46c8d1d5f78 commit (chief decision condition 3: no blanket owner-stage
  // fallback discharges missing actual evidence).
  const lineageStates = [];
  for (const [key, link] of Object.entries(ACTUAL_LINEAGE)) {
    const t = spawnSync('git', ['-C', REPO_ROOT, 'cat-file', '-t', link.sha], { env: gitEnv(), encoding: 'utf8' });
    if (t.status !== 0 || t.stdout.trim() !== 'commit') {
      problems.push(`actual-lineage link ${key} ${link.sha} is not a resolvable commit in this checkout (${(t.stderr || '').trim() || 'unexpected object'}) — the successor citation would dangle for any reader (M15 option B: real objects, no carrier fallback)`);
      continue;
    }
    const tree = spawnSync('git', ['-C', REPO_ROOT, 'rev-parse', `${link.sha}^{tree}`], { env: gitEnv(), encoding: 'utf8' });
    if (tree.status !== 0 || tree.stdout.trim() !== link.tree) {
      problems.push(`actual-lineage link ${key} ${link.sha} tree mismatch: expected ${link.tree}, got ${(tree.stdout || '').trim() || 'unresolvable'} — the object is not the recorded lineage`);
    }
  }
  const isAncestor = (a, b) => spawnSync('git', ['-C', REPO_ROOT, 'merge-base', '--is-ancestor', a, b], { env: gitEnv(), encoding: 'utf8' }).status === 0;
  if (isAncestor(ACTUAL_LINEAGE.recovered.sha, ACTUAL_LINEAGE.source.sha)) lineageStates.push('recovered ⊑ source');
  else problems.push(`actual-lineage ancestry broken: recovered ${ACTUAL_LINEAGE.recovered.sha} is NOT an ancestor of source ${ACTUAL_LINEAGE.source.sha}`);
  if (isAncestor(ACTUAL_LINEAGE.source.sha, ACTUAL_LINEAGE.generation.sha)) lineageStates.push('source ⊑ generation');
  else problems.push(`actual-lineage ancestry broken: source ${ACTUAL_LINEAGE.source.sha} is NOT an ancestor of generation ${ACTUAL_LINEAGE.generation.sha}`);
  const headRev = spawnSync('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], { env: gitEnv(), encoding: 'utf8' });
  if (headRev.status === 0 && isAncestor(ACTUAL_LINEAGE.generation.sha, headRev.stdout.trim())) lineageStates.push('generation ⊑ HEAD');
  else problems.push('actual-lineage ancestry broken: generation is NOT an ancestor of HEAD — the verified lineage does not reach this checkout');
  const genParent = spawnSync('git', ['-C', REPO_ROOT, 'rev-parse', `${ACTUAL_LINEAGE.generation.sha}^`], { env: gitEnv(), encoding: 'utf8' });
  if (genParent.status !== 0 || genParent.stdout.trim() !== ACTUAL_LINEAGE.source.sha) {
    problems.push(`actual-lineage generation parent is ${(genParent.stdout || '').trim() || 'unresolvable'}, expected the accepted source ${ACTUAL_LINEAGE.source.sha} — the generation is not the reciprocal of that source`);
  }
  const diffRes = spawnSync('git', ['-C', REPO_ROOT, 'diff', '--name-only', ACTUAL_LINEAGE.source.sha, ACTUAL_LINEAGE.generation.sha], { env: gitEnv(), encoding: 'utf8' });
  if (diffRes.status !== 0) {
    problems.push(`actual-lineage generation diff unresolvable: ${(diffRes.stderr || '').trim()}`);
  } else {
    const changed = diffRes.stdout.split('\n').filter(Boolean).sort();
    const allow = [...ACTUAL_LINEAGE.generation.diffAllowlist].sort();
    if (changed.length !== allow.length || changed.some((p, i) => p !== allow[i])) {
      problems.push(`actual-lineage generation diff is not exactly [${allow.join(', ')}] — got [${changed.join(', ') || '∅'}] (the generation may touch ONLY the renewed manifest)`);
    } else {
      lineageStates.push(`generation diff = ${changed.join(', ')} only`);
    }
  }
  const manifest = spawnSync('git', ['-C', REPO_ROOT, 'cat-file', '-p', `${ACTUAL_LINEAGE.generation.sha}:${ACTUAL_LINEAGE.generation.manifestPath}`], { env: gitEnv(), encoding: 'buffer' });
  if (manifest.status !== 0 || sha256(manifest.stdout) !== ACTUAL_LINEAGE.generation.manifestSha256) {
    problems.push(`actual-lineage manifest ${ACTUAL_LINEAGE.generation.manifestPath} at generation ${ACTUAL_LINEAGE.generation.sha} does not hash to the recorded ${ACTUAL_LINEAGE.generation.manifestSha256} — the renewal receipt is not these bytes`);
  } else {
    lineageStates.push(`manifest@generation sha256 ${ACTUAL_LINEAGE.generation.manifestSha256.slice(0, 12)}… verified`);
  }
  // The chief decision binds only while its queue records stand: the LAST entry naming each
  // M15 source must be the successor record (a drop/revert re-opens the condition).
  for (const { source, id } of M15_SUCCESSOR_ENTRIES) {
    const last = entries.findLast((e) => e.source === source);
    if (!last || last.id !== id) {
      problems.push(`M15 successor record missing: the last dispositions entry naming ${source} must be ${id} (got ${last ? last.id : 'none'}) — the chief decision cannot bind without its queue record`);
    }
  }
  // M15 correction-2 (independent review 6b469b3f, finding M15-F4 — empty governed selection):
  // registry fidelity is validated UNCONDITIONALLY against the frozen required identities —
  // BEFORE any loop relies on the mutable descriptor arrays. Emptying, reducing, duplicating
  // or substituting a registry is itself a finding: each required identity is named and checked
  // individually, and the identity set is never derived from the arrays it polices (a scalar
  // count cannot distinguish a missing role from a substituted one; exact membership can).
  const registryRoleIds = M15_RECEIPTS.map((r) => r.id);
  const requiredRoles = M15_REQUIRED_RECEIPT_ROLES.split(',');
  for (const role of requiredRoles) {
    const occurrences = registryRoleIds.filter((rid) => rid === role).length;
    if (occurrences === 0) {
      problems.push(`M15 receipt registry missing mandatory role ${role} — the descriptor set is empty/partial and cannot be silently vacated (required exactly: ${M15_REQUIRED_RECEIPT_ROLES})`);
    } else if (occurrences > 1) {
      problems.push(`M15 receipt registry carries ${occurrences} descriptors for mandatory role ${role} — duplicate descriptors are altered-claim shape`);
    }
  }
  for (const rid of new Set(registryRoleIds)) {
    if (!requiredRoles.includes(rid)) {
      problems.push(`M15 receipt registry descriptor ${rid} is not a required role (required exactly: ${M15_REQUIRED_RECEIPT_ROLES}) — substituted or extra descriptors are refused`);
    }
  }
  const registryTupleIds = M15_SUCCESSOR_ENTRIES.map((e) => `${e.source}=>${e.id}`);
  const requiredTuples = M15_REQUIRED_SUCCESSOR_TUPLES.split('|');
  for (const tuple of requiredTuples) {
    const occurrences = registryTupleIds.filter((t) => t === tuple).length;
    if (occurrences === 0) {
      problems.push(`M15 successor registry missing mandatory tuple ${tuple} — the successor set is empty/partial and supersession cannot be silently vacated (required exactly: ${M15_REQUIRED_SUCCESSOR_TUPLES})`);
    } else if (occurrences > 1) {
      problems.push(`M15 successor registry carries ${occurrences} descriptors for mandatory tuple ${tuple} — duplicate descriptors are altered-claim shape`);
    }
  }
  for (const t of new Set(registryTupleIds)) {
    if (!requiredTuples.includes(t)) {
      problems.push(`M15 successor registry descriptor ${t} is not a required tuple (required exactly: ${M15_REQUIRED_SUCCESSOR_TUPLES}) — substituted or extra descriptors are refused`);
    }
  }
  // M15 correction-1 (review 09826c35 M15-F1): the embedded receipts are the mandatory actual
  // evidence — byte-exact, pinned, single-occurrence, linkage-checked — BEFORE any reliance.
  // A ```text fence whose first content line is "M15-RECEIPT <id>" carries header lines
  // (label/content-encoding/original-bytes/sha256) then the base64 payload.
  const receiptBlocks = new Map();
  const dispLines = raw.split('\n');
  for (let i = 0; i < dispLines.length; i += 1) {
    const t = dispLines[i].trim();
    if (t !== '```text') continue;
    const header = (dispLines[i + 1] ?? '').trim();
    if (!header.startsWith('M15-RECEIPT ')) continue;
    const id = header.slice('M15-RECEIPT '.length).trim();
    let end = -1;
    for (let j = i + 2; j < dispLines.length; j += 1) {
      if (dispLines[j].trim() === '```') { end = j; break; }
    }
    if (end === -1) {
      problems.push(`M15 receipt ${id}: the block fence is never closed — it is not evidence`);
      continue;
    }
    if (!receiptBlocks.has(id)) receiptBlocks.set(id, []);
    receiptBlocks.get(id).push(dispLines.slice(i + 2, end));
  }
  const receipts = {};
  for (const pin of M15_RECEIPTS) {
    const blocks = receiptBlocks.get(pin.id) ?? [];
    if (blocks.length === 0) {
      problems.push(`M15 receipt ${pin.id} MISSING from dispositions.md — the mandatory actual-evidence block is absent (expected sha256 ${pin.sha256})`);
      continue;
    }
    if (blocks.length > 1) {
      problems.push(`M15 receipt ${pin.id} DUPLICATE: ${blocks.length} blocks claim the same receipt id — exactly one is valid, duplicates are altered-claim shape`);
      continue;
    }
    const body = blocks[0];
    const declaredSha = (body.find((l) => l.startsWith('sha256: ')) ?? '').slice(8).trim();
    if (declaredSha !== pin.sha256) {
      problems.push(`M15 receipt ${pin.id} header claims sha256 ${declaredSha || '(absent)'} but the verifier pin is ${pin.sha256} — the claim is altered`);
      continue;
    }
    const payload = body.filter((l) => /^[A-Za-z0-9+/=]+$/.test(l)).join('');
    if (payload.length === 0) {
      problems.push(`M15 receipt ${pin.id} carries an EMPTY base64 payload — empty is not evidence`);
      continue;
    }
    let bytes = null;
    try {
      bytes = inflateSync(Buffer.from(payload, 'base64'));
    } catch (e) {
      problems.push(`M15 receipt ${pin.id} payload does not decode (zlib+base64): ${e.message} — malformed block`);
      continue;
    }
    if (bytes.length !== pin.bytes) {
      problems.push(`M15 receipt ${pin.id} inflates to ${bytes.length} bytes, pinned ${pin.bytes} — truncated or padded block`);
      continue;
    }
    const got = sha256(bytes);
    if (got !== pin.sha256) {
      problems.push(`M15 receipt ${pin.id} inflated sha256 ${got} != pinned ${pin.sha256} — the embedded bytes are ALTERED`);
      continue;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(bytes.toString('utf8'));
    } catch (e) {
      problems.push(`M15 receipt ${pin.id} does not parse as JSON after byte-exact decode: ${e.message}`);
      continue;
    }
    receipts[pin.id] = parsed;
  }
  // M15 correction-2 (M15-F4): decoded presence of every mandatory role is UNCONDITIONAL and
  // never an artifact of descriptor-registry iteration. An emptied or disconnected registry
  // makes the loop above iterate zero times and every `if (receipts.ID)` linkage guard below
  // silently skip — that is exactly the vacuous-PASS shape; each frozen role must still be
  // present as a DECODED BYTE-EXACT receipt before success may be claimed.
  for (const role of requiredRoles) {
    if (!receipts[role]) {
      problems.push(`M15 mandatory receipt role ${role} has no decoded byte-exact receipt — required-role presence is unconditional (frozen set: ${M15_REQUIRED_RECEIPT_ROLES}), independent of registry iteration`);
    }
  }
  const PIN = Object.fromEntries(M15_RECEIPTS.map((r) => [r.id, r.sha256]));
  if (receipts.SOURCE_GO) {
    const s = receipts.SOURCE_GO;
    if (s.head !== ACTUAL_LINEAGE.source.sha || s.tree !== ACTUAL_LINEAGE.source.tree) {
      problems.push(`M15 receipt SOURCE_GO linkage drift: head/tree ${s.head}/${s.tree} != live lineage source ${ACTUAL_LINEAGE.source.sha}/${ACTUAL_LINEAGE.source.tree}`);
    }
    if (s.recovered_source_snapshot !== ACTUAL_LINEAGE.recovered.sha) {
      problems.push(`M15 receipt SOURCE_GO recovered_source_snapshot ${s.recovered_source_snapshot} != live lineage recovered ${ACTUAL_LINEAGE.recovered.sha}`);
    }
    if (s.historical_be84_object_recovered !== false) {
      problems.push('M15 receipt SOURCE_GO must record historical_be84_object_recovered === false — a synthesized-object claim is forbidden');
    }
  }
  if (receipts.S1_GO) {
    const g = receipts.S1_GO;
    if (g.head !== ACTUAL_LINEAGE.generation.sha || g.tree !== ACTUAL_LINEAGE.generation.tree) {
      problems.push(`M15 receipt S1_GO linkage drift: head/tree ${g.head}/${g.tree} != live lineage generation ${ACTUAL_LINEAGE.generation.sha}/${ACTUAL_LINEAGE.generation.tree}`);
    }
    const ga = g.generated_acceptance ?? {};
    if (g.source_acceptance?.sha256 !== PIN.SOURCE_GO) {
      problems.push(`M15 receipt S1_GO names source acceptance sha256 ${g.source_acceptance?.sha256} != pinned SOURCE_GO ${PIN.SOURCE_GO} — the receipts do not bind to each other`);
    }
    if (ga.source_HEAD !== ACTUAL_LINEAGE.source.sha || ga.effect_HEAD !== ACTUAL_LINEAGE.generation.sha) {
      problems.push(`M15 receipt S1_GO generated_acceptance ${ga.source_HEAD}→${ga.effect_HEAD} != live lineage ${ACTUAL_LINEAGE.source.sha}→${ACTUAL_LINEAGE.generation.sha}`);
    }
    if (JSON.stringify(ga.changed_paths) !== JSON.stringify(ACTUAL_LINEAGE.generation.diffAllowlist)) {
      problems.push(`M15 receipt S1_GO changed_paths ${JSON.stringify(ga.changed_paths)} != the generation diff allowlist ${JSON.stringify(ACTUAL_LINEAGE.generation.diffAllowlist)}`);
    }
    if (ga.manifest_sha256 !== ACTUAL_LINEAGE.generation.manifestSha256) {
      problems.push(`M15 receipt S1_GO manifest_sha256 ${ga.manifest_sha256} != the live-verified manifest hash ${ACTUAL_LINEAGE.generation.manifestSha256}`);
    }
    if (ga.exact_source_ownership_renewal !== PIN.OWNERSHIP_RENEWAL) {
      problems.push(`M15 receipt S1_GO names ownership renewal ${ga.exact_source_ownership_renewal} != pinned OWNERSHIP_RENEWAL ${PIN.OWNERSHIP_RENEWAL}`);
    }
    const fresh = (g.evidence_hashes ?? []).find((e) => String(e.path).endsWith('freshness-results.json'));
    if (!fresh || fresh.sha256 !== PIN.FRESHNESS_RESULTS) {
      problems.push(`M15 receipt S1_GO does not pin the FRESHNESS_RESULTS sha256 ${PIN.FRESHNESS_RESULTS} in its evidence_hashes — the freshness receipt is unbound`);
    }
  }
  if (receipts.OWNERSHIP_RENEWAL) {
    const o = receipts.OWNERSHIP_RENEWAL;
    if (o.acceptedInput?.sha256 !== PIN.SOURCE_GO || o.acceptedInput?.head !== ACTUAL_LINEAGE.source.sha || o.acceptedInput?.tree !== ACTUAL_LINEAGE.source.tree) {
      problems.push(`M15 receipt OWNERSHIP_RENEWAL acceptedInput ${o.acceptedInput?.sha256}/${o.acceptedInput?.head}/${o.acceptedInput?.tree} != pinned SOURCE_GO + live lineage source`);
    }
  }
  if (receipts.FRESHNESS_RESULTS) {
    const chunks = receipts.FRESHNESS_RESULTS;
    if (!Array.isArray(chunks) || chunks.length !== 3 || !chunks.every((c) => c?.status === 'fulfilled' && c?.value?.exit_code === 0)) {
      problems.push('M15 receipt FRESHNESS_RESULTS must be 3 fulfilled chunks all exit_code 0 — a non-green freshness receipt is not evidence of freshness');
    } else {
      const allOutput = chunks.map((c) => c.value.output ?? '').join('\n');
      for (const surface of ['pre-push.bundle.mjs', 'rule-bootstrap-cli.bundle.mjs', 'MANIFEST.sha256']) {
        if (!allOutput.includes(surface)) problems.push(`M15 receipt FRESHNESS_RESULTS output does not cover ${surface}`);
      }
    }
  }
  if (receipts.GENERATION_INPUT) {
    const gi = receipts.GENERATION_INPUT;
    if (gi.source_HEAD !== ACTUAL_LINEAGE.source.sha || gi.source_tree !== ACTUAL_LINEAGE.source.tree) {
      problems.push(`M15 receipt GENERATION_INPUT source ${gi.source_HEAD}/${gi.source_tree} != live lineage source`);
    }
  }
  if (receipts.GENERATION_AFTER) {
    const ga2 = receipts.GENERATION_AFTER;
    if (ga2.accepted_source_head !== ACTUAL_LINEAGE.source.sha || ga2.accepted_source_tree !== ACTUAL_LINEAGE.source.tree
      || ga2.generation_head !== ACTUAL_LINEAGE.generation.sha || ga2.generation_tree !== ACTUAL_LINEAGE.generation.tree) {
      problems.push(`M15 receipt GENERATION_AFTER lineage ${ga2.accepted_source_head}→${ga2.generation_head} != live lineage source→generation`);
    }
    if (ga2.three_paths_after?.['packages/getff/MANIFEST.sha256'] !== ACTUAL_LINEAGE.generation.manifestSha256) {
      problems.push(`M15 receipt GENERATION_AFTER post-generation manifest hash != the live-verified ${ACTUAL_LINEAGE.generation.manifestSha256}`);
    }
    if (ga2.three_paths_after?.['packages/core/hooks/pre-push.bundle.mjs'] !== '893ad89e16b099330ab5a046f5752414bb327eff9599279ad3ab1168797e7c9a'
      || ga2.three_paths_after?.['packages/core/install/rule-bootstrap-cli.bundle.mjs'] !== '780c9de18821317bdfd4bf07593449c551ff1f7943d1069f30ba27cbffc9f1e3') {
      problems.push('M15 receipt GENERATION_AFTER post-generation bundle identities drift from the recorded renewal');
    }
    if (ga2.gates_at_final_head?.['runtime --check'] !== 0 || ga2.gates_at_final_head?.['dist --check'] !== 0) {
      problems.push('M15 receipt GENERATION_AFTER must record both stock gates 0 at the final head');
    }
  }
  // M15 correction-1 (review 09826c35 M15-F2): freshness is enforced LIVE, through the stock
  // entrypoints themselves — never through a historical hash alone, a symbol probe, or a scalar
  // substitute. --check only: neither tool writes outputs. Exit grammars (documented in the
  // scripts): dist 0 sync / 1 DRIFT / other INFRA; runtime-bundles 0 sync / 1 drift / 2 missing
  // toolchain (INFRA — a prerequisite, never a verdict).
  const freshnessStates = [];
  const distCheck = run('bash', [join(REPO_ROOT, 'scripts/build-getff-dist.sh'), '--check'], { timeout: STEP_TIMEOUT_MS });
  if (distCheck.rc === 0) freshnessStates.push('dist --check 0');
  else if (distCheck.rc === 1) {
    const firstDrift = `${distCheck.stdout}\n${distCheck.stderr}`.split('\n').find((l) => l.includes('DRIFT') || l.includes('ERROR')) ?? '(no diagnosis line)';
    problems.push(`live freshness RED: bash scripts/build-getff-dist.sh --check exited 1 — the LIVE shipped manifest/bundle set is stale: ${firstDrift.trim().slice(0, 200)}`);
  } else {
    return infraStep(`live freshness tool build-getff-dist.sh --check exited ${distCheck.rc} (outside the documented 0/1 drift grammar — cannot conclude): ${(distCheck.stderr || distCheck.stdout).trim().slice(0, 200)}`);
  }
  const runtimeCheck = run(process.execPath, [join(REPO_ROOT, 'scripts/build-runtime-bundles.mjs'), '--check'], { timeout: STEP_TIMEOUT_MS, env: { ...childEnv(), NODE_ENV: 'development' } });
  if (runtimeCheck.rc === 0) freshnessStates.push('runtime-bundles --check 0');
  else if (runtimeCheck.rc === 1) {
    const firstDrift = `${runtimeCheck.stdout}\n${runtimeCheck.stderr}`.split('\n').find((l) => l.includes('DRIFT') || l.includes('ERROR')) ?? '(no diagnosis line)';
    problems.push(`live freshness RED: node scripts/build-runtime-bundles.mjs --check exited 1 — the LIVE runtime bundles are stale: ${firstDrift.trim().slice(0, 200)}`);
  } else if (runtimeCheck.rc === 2) {
    return infraStep(`live freshness prerequisite missing: build-runtime-bundles.mjs --check exited 2 (${(runtimeCheck.stderr || '').trim().slice(0, 160)}) — provisioning error, not a verdict`);
  } else {
    return infraStep(`live freshness tool build-runtime-bundles.mjs --check exited ${runtimeCheck.rc} (outside the documented 0/1/2 grammar — cannot conclude): ${(runtimeCheck.stderr || runtimeCheck.stdout).trim().slice(0, 200)}`);
  }
  if (problems.length > 0) return red(`${problems.length} dispositions finding(s): ${problems.join(' · ')}`);
  return pass(`${entries.length} disposition entries valid; coverage complete for ${requiredSources.length} non-killed/non-equivalent + review-routed obligation(s) [${requiredSources.join(', ')}]; actual lineage verified: recovered ${ACTUAL_LINEAGE.recovered.sha.slice(0, 10)} → source ${ACTUAL_LINEAGE.source.sha.slice(0, 10)} → generation ${ACTUAL_LINEAGE.generation.sha.slice(0, 10)} (parent=source; diff=manifest only; manifest sha256 ${ACTUAL_LINEAGE.generation.manifestSha256.slice(0, 12)}…) → HEAD [${lineageStates.join('; ')}]; M15 receipts byte-exact + linkage-consistent (${M15_RECEIPTS.map((r) => `${r.id}:${r.sha256.slice(0, 8)}…`).join(', ')}); live freshness through stock entrypoints (${freshnessStates.join('; ')}); M15 successor records present (historical 46c8d1d5f78 stays disclosed missing — never synthesized)`);
}

const STEPS = [
  ['prereqs', stepPrereqs],
  ['k7-records', stepK7Records],
  ['static-matrix', stepStaticMatrix],
  ['driver', stepDriver],
  ['recovery-d011', stepRecovery],
  ['counterfactuals', stepCounterfactuals],
  ['delivery', stepDelivery],
  ['suites', stepSuites],
  ['twins', stepTwins],
  ['tsc', stepTsc],
  ['dispositions', stepDispositions],
];

// ── tamper arms (the adapter's own anti-detector evidence) ────────────────────

/** Spawn this adapter on one step and return {rc, output}. */
function runSelfOnStep(step) {
  const res = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--stage', STAGE, '--step', step], {
    cwd: REPO_ROOT,
    env: childEnv(),
    encoding: 'utf8',
    timeout: CF_SUITES_STEP_TIMEOUT_MS,
    killSignal: 'SIGTERM',
  });
  if (res.error) throw new InfraError(`tamper self-spawn failed: ${res.error.message}`);
  if (res.signal) throw new InfraError(`tamper self-spawn killed by ${res.signal}`);
  return { rc: res.status, output: (res.stdout ?? '') + (res.stderr ?? '') };
}

/** One byte-exact in-place tamper: mutate → observe → restore → hash-prove. */
function withTamperedFile(rel, mutateFn, fn) {
  const abs = repoPath(rel);
  if (!abs || !existsSync(abs)) throw new InfraError(`tamper target missing: ${rel}`);
  const original = readFileSync(abs);
  const beforeSha = sha256(original);
  mutateFn(abs, original);
  try {
    return fn(beforeSha);
  } finally {
    writeFileSync(abs, original);
    if (sha256(readFileSync(abs)) !== beforeSha) {
      throw new InfraError(`restoration NOT byte-identical for ${rel} — aborting, manual recovery required`);
    }
    console.log(`TAMPER restored ${rel} sha256=${beforeSha.slice(0, 12)}… (byte-identical)`);
  }
}

function tamperT0() {
  const dispPath = repoPath(DISPOSITIONS_REL);
  const preState = existsSync(dispPath) ? 'present (hidden for the arm)' : 'absent (pre-state already is the tamper)';
  const observe = () => {
    const { rc, output } = runSelfOnStep('dispositions');
    const detected = rc === 1 && output.includes('VERIFY dispositions RED');
    console.log(`TAMPER T0 observed: child exit=${rc} ${detected ? '→ RED as required' : `→ NOT RED${rc === 0 ? ' (adapter went green on missing evidence — REAL failure)' : ''}`}`);
    return detected;
  };
  if (existsSync(dispPath)) {
    const hidden = `${dispPath}.tamper-t0`;
    renameSync(dispPath, hidden);
    console.log(`TAMPER T0 applied: hid ${DISPOSITIONS_REL} (pre-state=${preState})`);
    try {
      return observe();
    } finally {
      renameSync(hidden, dispPath);
      console.log(`TAMPER T0 restored ${DISPOSITIONS_REL}`);
    }
  }
  console.log(`TAMPER T0 applied: ${preState}`);
  return observe();
}

function tamperT1() {
  const victim = CF_RECORD_IDS[0];
  const rel = `${CF_DIR_REL}/${victim}.json`;
  return withTamperedFile(
    rel,
    (abs) => {
      rmSync(abs); // the buffer held by withTamperedFile restores it; no stray copy left behind
      console.log(`TAMPER T1 applied: dropped pinned record ${rel}`);
    },
    () => {
      const { rc, output } = runSelfOnStep('k7-records');
      const detected = rc === 1 && output.includes(victim);
      console.log(`TAMPER T1 observed: child exit=${rc} ${detected ? `→ RED names the dropped record (${victim}) as required` : `→ did not name ${victim}${rc === 0 ? ' (registry shrank silently — REAL failure)' : ''}`}`);
      return detected;
    },
  );
}

function tamperT2() {
  const rel = DRIVER_EXP_REL;
  return withTamperedFile(
    rel,
    (abs) => {
      const exp = JSON.parse(readFileSync(abs, 'utf8'));
      exp.baseline[0].files = [];
      writeFileSync(abs, `${JSON.stringify(exp, null, 2)}\n`);
      console.log(`TAMPER T2 applied: emptied baseline selector ${exp.baseline[0].id}.files (driver must refuse, T-TAK-A)`);
    },
    () => {
      const { rc, output } = runSelfOnStep('driver');
      // T-TAK-A: the required outcome is a REFUSAL — the driver infra-exits 3 and this
      // adapter refuses to conclude. Green here would mean the adapter runs on empty selections.
      const detected = rc === 3 && /INFRA/.test(output);
      console.log(`TAMPER T2 observed: child exit=${rc} ${detected ? '→ driver refused the empty selector, adapter refused to conclude (INFRA) as required' : rc === 0 ? '→ GREEN on an empty selection — T-TAK-A violation (REAL failure)' : `→ unexpected exit ${rc}`}`);
      return detected;
    },
  );
}

const TAMPER_ARMS = { T0: tamperT0, T1: tamperT1, T2: tamperT2 };

// ── promotion gates (executed at/before S1 promote; rework round 1, 2026-10-08) ──

const PROMOTION_GATES = [
  {
    // Final rework, 2026-10-10: supersedes the round-1 gate body (id
    // disp-gate5-runtime-bundle-rebuild). The round-1 premise — the symbol landing inside
    // packages/core/hooks/pre-push.bundle.mjs — is unsatisfiable by construction: pre-push.ts
    // loads checks/guard-liveness.ts via `await import` and the builder holds first-party
    // modules EXTERNAL on purpose (scripts/build-runtime-bundles.mjs), so a freshly rebuilt
    // bundle is byte-identical and still 0-hit. The gate re-points at the REAL delivery
    // carrier (the tracked .ts source the Q1/Q2 changed-file arm ships as) and names the
    // runtime-bundles --check lane as the bundle-freshness half of the enforced pair.
    id: 'disp-rework4-bundle-carrier-gate',
    artifact: 'packages/core/hooks/checks/guard-liveness.ts',
    symbols: ['runTestQualityLiveness'],
    freshness: `LIVE freshness enforced by the dispositions step on every run through the stock entrypoints (\`bash scripts/build-getff-dist.sh --check\` + \`NODE_ENV=development node scripts/build-runtime-bundles.mjs --check\`, --check only, RED on drift with the stock diagnosis / INFRA on missing toolchain) — never a symbol-in-bundle probe or a historical hash alone; the historical renewal itself is bound by the actual-lineage arm + the six byte-exact embedded receipts (actual host generation ${ACTUAL_LINEAGE.generation.sha}, parent = accepted source ${ACTUAL_LINEAGE.source.sha}, M15 successor record disp-m15-successor-merge-carrier; the superseded 46c8d1d5f78 rebuild story is preserved as history in pr-body-disclosures.md §4–§5)`,
    repair: 'restore runTestQualityLiveness to the delivery carrier packages/core/hooks/checks/guard-liveness.ts (the Q1/Q2 changed-file arm ships as this tracked source; the pre-push bundle loads it via `await import` and keeps it external by design), then keep the runtime-bundles-drift script-selftests lane (`node scripts/build-runtime-bundles.mjs --check`) green — on a lockfile-clean install, since this container carries fast-uri 3.1.7 vs lockfile 3.1.8 and a rebuild here would inline the wrong copy',
  },
];

/** Artifact-level check of one promotion gate: null = resolved, string = blocking detail.
 * Content-level by design: the carrier SOURCE must reference the stage arm — the tracked .ts
 * file IS what the Q1/Q2 changed-file arm ships (the bundles keep first-party modules
 * external, scripts/build-runtime-bundles.mjs, so the round-1 symbol-in-bundle probe was
 * unsatisfiable by construction). Bundle freshness stays enforced by the runtime-bundles-drift
 * lane named in gate.freshness; semantic delivery stays proven by the principle 51/52
 * conformance lanes (honest-limits.md). */
function promotionGateBlockReason(gate) {
  const p = repoPath(gate.artifact);
  if (!p || !existsSync(p)) return `artifact missing: ${gate.artifact}`;
  const content = readFileSync(p, 'utf8');
  const missing = gate.symbols.filter((s) => !content.includes(s));
  if (missing.length > 0) {
    return `delivered artifact predates the stage arm — 0 hits for [${missing.join(', ')}] in ${gate.artifact}`;
  }
  return null;
}

/** --promote-gate: run every gate fail-closed, then prove each check load-bearing BOTH ways
 * (K2+K3 in one invocation): the artifact is moved to the OPPOSITE state in place and the
 * verdict must flip, restored hash-proven (same discipline as the tamper arms). */
function runPromoteGate() {
  let refused = false;
  for (const gate of PROMOTION_GATES) {
    const blocked = promotionGateBlockReason(gate);
    if (blocked) {
      refused = true;
      console.log(`PROMOTE-GATE ${gate.id}: BLOCKED — ${blocked}`);
      console.log(`PROMOTE-GATE ${gate.id}: repair: ${gate.repair}`);
    } else {
      console.log(`PROMOTE-GATE ${gate.id}: RESOLVED (${gate.artifact} references the stage arm; bundle freshness: ${gate.freshness})`);
    }
  }
  for (const gate of PROMOTION_GATES) {
    const blockedBefore = promotionGateBlockReason(gate);
    let flipped = 'control-did-not-run';
    try {
      withTamperedFile(
        gate.artifact,
        (abs, original) => {
          const text = original.toString('utf8');
          // Opposite-state mutation: BLOCKED → append the symbol; RESOLVED → strip EVERY
          // occurrence (the carrier names the arm at its definition AND its call site — a
          // first-occurrence-only strip would leave the string present and the control could
          // not flip; a symbol left anywhere would still be a lie). The replacement must NOT
          // embed the symbol itself: `PREFIX_${symbol}` still contains the needle as a
          // substring and includes() would keep matching (the strip direction never ran in
          // round 1 — that gate sat BLOCKED until the rebuild — so this stayed latent there).
          // (The append is a content-level control over a content-level check — it proves the
          // check flips, not that the carrier is correct; see honest-limits.md.)
          const mutated = blockedBefore !== null
            ? `${text}\n// promote-gate flip control: ${gate.symbols[0]}\n`
            : text.replaceAll(gate.symbols[0], 'PROMOTE_GATE_CONTROL_REMOVED');
          writeFileSync(abs, mutated);
        },
        () => {
          flipped = promotionGateBlockReason(gate);
        },
      );
    } catch (e) {
      console.error(`VERIFY PROMOTE-GATE INFRA ${e.message}`);
      process.exit(3);
    }
    const detected = (flipped === null) !== (blockedBefore === null);
    if (!detected) {
      refused = true;
      console.log(`PROMOTE-GATE ${gate.id} CONTROL: UNDETECTED (verdict did not flip to the opposite state — the gate is vacuous; REAL failure)`);
    } else {
      console.log(`PROMOTE-GATE ${gate.id} CONTROL: DETECTED (verdict flipped ${blockedBefore === null ? 'RESOLVED→BLOCKED' : 'BLOCKED→RESOLVED'} under the opposite-state mutation, restoration hash-proven)`);
    }
  }
  if (refused) {
    console.log('PROMOTE-GATE VERDICT: REFUSED exit=1 (a promotion-blocking obligation is unresolved or a gate failed its own control — S1 must not promote)');
    process.exit(1);
  }
  console.log('PROMOTE-GATE VERDICT: PASS exit=0 (every promotion gate resolved; every flip control detected)');
  process.exit(0);
}

// ── main ──────────────────────────────────────────────────────────────────────

// S2 extends the existing adapter; S1 registries, functions and frozen records stay intact.
const S2 = {"scopeSha":"016348f0200e718a870746b62962f1978a14347953b9948e965afebdf209379b","base":"23d67e8e646d5a3416bee697a3461b2439cec477","statuses":["verified-behavioral","verified-structural","candidate-needs-review","demonstrated-gap","not-executed","intentional-fixture","external-contract","retired"],"originalPopulation":"9ea84123381677719628cbd4555ba8b87528e57b74ceea5e5e86c5c0362e6c16","populationCounts":{"verified-behavioral":5,"verified-structural":619,"candidate-needs-review":0,"demonstrated-gap":0,"not-executed":0,"intentional-fixture":161,"external-contract":3387,"retired":0},"obligationIdentity":"8d2fc6a0d26808917382c61d42f0f851dc8d18f6c1b291737e9b53b6d6a42e8c","candidateIdentity":"a8f5455b21c1b4f54877c3318edb8f1e736e4c76a49fe3b25d0b6372515900a1","seedIdentity":"2ae8277373a8a0bd99da958b36276056eabfb72c9fec31f51e3ab46aa7686eec","queuePrefixBytes":50793,"queuePrefixSha":"4bcc6aa63206e8111a20bd4333e4f1a29adf9d67fc5a7a2d2db233a3aea197eb","deferredSource":"merge-forward/reopen-manifest-regen","deferredSha":"b69f5af0543f2407cb0b981017b2a0bfa46734afa0e80dc2346739ee4abfdb88","requiredQueueSources":["wrong-import/bad.wrong-import","replay-a12-emitted-corruption","cold-review-batch-i/C4-preset-rules-md-catalogs","cold-review-batch-i/C5-rules-manifest-registration","CAND-086","CAND-088","CAND-089","CAND-090","CAND-094"],"oldObligationSha":"4a3f5b5d7ca9823360c2bc3e30bce92e2d99e9d774d50425aed9842c7f00434a","nativeEntries":["tests/advisor-bridge-beta/protocol.test.mjs","scripts/test-assurance/s2/m05-error-boundary.test.mjs"],"nativeNames":["enroll creates pilot config bound to observed repo identity; second enroll is rejected","S6: enrollment observes physical git identity — foreign/nonexistent/anchorless bindings are rejected","status reports enrolled pilot with zeroed counters, open admission and taskState none","request submit binds digest; identical replay returns same receipt; changed bytes under same ID are rejected","ownership: first acquire wins, same owner is idempotent, foreign workKey rejected, owner survives reads","abandoned operation lock yields HOLD, is never auto-deleted, and is cleared only by explicit reconcile","C3: reconcile-lock refuses a lock whose holder process is still alive","path validation: traversal, symlink escape and absolute foreign paths are rejected","OFF blocks admission but reads and status remain available","S7: identical event replay returns the receipt; changed content under the same event ID is rejected","test-mode run launches exactly the card argv, captures identity, counts one pass","S5: a mismatched client-reported model blocks advancement even with matching session id and exit 0","S4: run without a prepared request is rejected — no unbounded job admission","S4: an identical completed launch replay returns its receipt without a new session or launch","R3: REWORK advances to the next instruction revision; resume executes it on the same session","R4: an instruction admits only its owned attempt; rework duplicates replay or HOLD","R8: revision publication alone never admits a replacement executor","R8: a report awaiting the senior decision blocks every route on a newer revision","R9: complete r2 then request r3 without a fresh REWORK admits no third child","R9: a pending r2 report plus r3 cannot spend the historical REWORK","R9: ACCEPTED is terminal across revisions; no revival, no new launch","R9: OPERATOR_REQUIRED authorizes nothing; an earlier REWORK stays spent","R9: a fresh REWORK r2 authorizes exactly r3 — the legitimate second rework reaches the cap","R10: an identical retry at the pass cap replays its original receipt","R11: a prelaunch BLOCKED report on the authorized successor holds the resume","R11: OPERATOR_REQUIRED on the authorized successor stops the resume an older REWORK cannot bypass","R11: a fresh senior REWORK on the BLOCKED report authorizes its successor without operator approval","R11: a proven completed receipt replays read-only while its report awaits the senior","R5: DONE binds the pass and the decision to the exact current instruction revision","R1: OFF reports uncertain reservations and terminates a live advisor fork","R2: a pid-less reservation is never proof of no spawn; affirmative records resolve it","R6: conflicting partial Answer bytes reject before any receipt; evidence is preserved","R7: import respects a recorded invalid fork capture","S4: an open ask is an explicit consult-pending checkpoint; no unbound new job while it waits","two concurrent claim/run callers cause at most one child launch","lost capture (exit 0, no JSON receipt) leaves UNKNOWN; rerun does not relaunch","pre-existing reserved attempt (spawn crash) HOLDs all new launches until reconcile","OFF before run causes zero new launches","S1: OFF during an owned pass terminates the exact recorded pid, records interruption, keeps late ingestion, blocks acceptance","deadline kill never releases an unproven owner; next run HOLDs","C3: an attempt cannot be marked completed or abandoned on rationale alone","consult: one fork per ask; capture lands in reserved outbox; counter counts one advisor call","S2: a capture with a wrong input digest or foreign role is not trusted; the ask stays OPEN","S2: import refuses an unreserved capture and a stale ask bound to a superseded revision","journal-only crash: import recovers the journaled decision without any advisor child","C2: the journaled answer survives outbox tampering; a completed import replays consistently","consult with missing capture keeps the ask OPEN and HOLDs the import","S3: the report envelope binds owner, request digest and ACKs; a foreign or unbound report cannot advance","S3+C1: a full DONE envelope with owned pass and consult ACK reaches accepted; identical retry replays","zero exit with missing/invalid report does not pass; a valid envelope report then advances the state","C1: identical report, ask and verdict retries return the existing receipt after a delay","stale revision: old report cannot be accepted after the request advanced; stale consultation does not close it either","decide is the senior alone; a foreign actor is rejected","M05/A05 lexical-ancestor boundary — TS surface (actual authored bytes)","M05/A05 lexical-ancestor boundary — shipped MJS surface (stock twin)","actual-ts / unrelated-wrapped-before-app","actual-ts / unrelated-wrapped-after-app","actual-ts / fragment-unwrapped-sibling","actual-ts / both-lexical-roots-wrapped","actual-ts / fragment-wrapped-siblings","actual-ts / member-boundary-both-roots","actual-shipped-mjs / unrelated-wrapped-before-app","actual-shipped-mjs / unrelated-wrapped-after-app","actual-shipped-mjs / fragment-unwrapped-sibling","actual-shipped-mjs / both-lexical-roots-wrapped","actual-shipped-mjs / fragment-wrapped-siblings","actual-shipped-mjs / member-boundary-both-roots"],"kernelNames":["principle 51 — S2 named test population (CAND-101 P51) frozen S2 supplement: byte-pinned, structurally consistent, fixtures on disk hash-exact","principle 51 — S2 named test population (CAND-101 P51) named membership: frozen fixtures and currently-tracked ordinary cases are inside the population","principle 51 — S2 named test population (CAND-101 P51) class-coverage non-vacuity: the declared named classes are actually represented","principle 51 — S2 named test population (CAND-101 P51) carrier coverage: frozen static verdicts reproduce on fixtures; ordinary cases admit when tracked (incl. .mts/.cts)","principle 51 — S1 test-quality corpus conformance the frozen oracle exists, is non-empty, and pins both directions (non-vacuity)","principle 51 — S1 test-quality corpus conformance fresh Linter verdicts match the freeze on every case (corpus conformance)","principle 51 — S1 test-quality corpus conformance K6 fail-closed: a missing case file is a failure, not a silent pass","principle 51 — S1 test-quality corpus conformance K6 fail-closed: an empty selection is a failure, not green [T-TAK-A]","principle 51 — S1 test-quality corpus conformance K6 fail-closed: a linter crash is a failure, never counted as detection","principle 51 — S1 test-quality corpus conformance population ratchet: named-population findings equal the pinned + S2 supplement set exactly","principle 52 — bounded wrong-import executed conformance M14: the governed module/export fault rejects lookalike assurance and admits the correct companion","principle 52 — Q4/Q5 executed-conformance (test-assurance kernel) the frozen oracle pins the executed-conformance channel and every scenario case","principle 52 — Q4/Q5 executed-conformance (test-assurance kernel) Q4: ignored-exit survives the fixture flip (reject) while asserted-exit kills it (admit)","principle 52 — Q4/Q5 executed-conformance (test-assurance kernel) Q5: circular-phrase survives the broken backing behavior (reject) while behavior-backed kills it (admit)","principle 52 — Q4/Q5 executed-conformance (test-assurance kernel) non-vacuity: the executed lane produced BOTH a demonstrated rejection and a demonstrated kill","principle 52 — Q4/Q5 executed-conformance (test-assurance kernel) K6 fail-closed: an empty case selection is refused before any runner spawn [T-TAK-A]","principle 52 — Q4/Q5 executed-conformance (test-assurance kernel) K6 fail-closed: a missing corpus case file is refused, naming the path","principle 52 — Q4/Q5 executed-conformance (test-assurance kernel) K6 fail-closed: runner spawn failure is infrastructure-failure, never detection","principle 52 — Q4/Q5 executed-conformance (test-assurance kernel) K7 honesty: a counterfactual death WITHOUT the intended assertion is not a kill","D011 SB1/R4 — strict runner-result grammar (production export + real caller) pinned counterexamples cx1/cx2/cx2b classify exactly as frozen through the production export","D011 SB1/R4 — strict runner-result grammar (production export + real caller) all ten frozen report fixtures classify per the roots.json sidecar (identity/shape/malformed grammar)","D011 SB1/R4 — strict runner-result grammar (production export + real caller) A3 cx3: same-file failed+pending reads not-executed BEFORE detection credit (am2 read detection)","D011 SB1/R4 — strict runner-result grammar (production export + real caller) REAL CALLER: healthy → pass and skipped → not-executed (be84 read the skipped lane \"pass\")","D011 SB1/R4 — strict runner-result grammar (production export + real caller) REAL CALLER: unhandled → infrastructure-failure and intended-fail → detection (fault classes never conflated)","D011 SB1/R4 — strict runner-result grammar (production export + real caller) REAL CALLER: MIXED unhandled+intended-fail → infrastructure-failure, never detection (the be84 fault)","D011 SB1/R4 — strict runner-result grammar (production export + real caller) the frozen probe packet is present under recovery-d011 (wiring anchor, no runner spawn)","principle 53 — Q6 delivery-conformance + fail-closed discovery (test-assurance kernel) A04: actual installer preserves approved default preset artifacts","principle 53 — Q6 delivery-conformance + fail-closed discovery (test-assurance kernel) the frozen oracle pins the delivery-conformance channel and both Q6 cases","principle 53 — Q6 delivery-conformance + fail-closed discovery (test-assurance kernel) Q6: severity-off on the EMITTED config kills the good companion on the intended assertion and silences the real CLI","principle 53 — Q6 delivery-conformance + fail-closed discovery (test-assurance kernel) both ESLint-family delivery edges remain uniquely applicable to the REAL delivered config","principle 53 — Q6 delivery-conformance + fail-closed discovery (test-assurance kernel) the delivered artifact is emitted VERBATIM into the scratch (config hash + twins + probe)","principle 53 — Q6 delivery-conformance + fail-closed discovery (test-assurance kernel) K7 edge honesty: an edge that does not apply EXACTLY ONCE is refused, not run","principle 53 — Q6 delivery-conformance + fail-closed discovery (test-assurance kernel) delivery-probe honesty: spawn failure and reject-without-intended-rule are infrastructure-failure","principle 53 — Q6 delivery-conformance + fail-closed discovery (test-assurance kernel) K6 corpus<->registry: the REAL population reconciles clean against the frozen oracle","principle 53 — Q6 delivery-conformance + fail-closed discovery (test-assurance kernel) K6 corpus<->registry: a deleted path, a deleted registry key, and an empty corpus all fail closed","principle 53 — Q6 delivery-conformance + fail-closed discovery (test-assurance kernel) K6 discovery: the REAL vitest include grammar is parsed and selects every on-disk principle test","principle 53 — Q6 delivery-conformance + fail-closed discovery (test-assurance kernel) K6 discovery pairing: every numbered principle module keeps a grammar-selected test sibling","principle 53 — Q6 delivery-conformance + fail-closed discovery (test-assurance kernel) K6 discovery: a rename out of the include grammar and a deleted file both fail closed","principle 53 — Q6 delivery-conformance + fail-closed discovery (test-assurance kernel) K6 discovery: a missing/empty include grammar fails closed instead of reading healthy","principle 53 — Q6 delivery-conformance + fail-closed discovery (test-assurance kernel) the include-grammar conversion is a faithful subset (star, globstar, anchoring, escaping)"],"configs":[{"stack":"ts-server","source_template":"templates/ts-server/eslint.config.mjs","approved_config_sha256":"dd40d657ac8405f7c4d0e883840487e93196fe7c69be33da44c82d8181a27463"},{"stack":"react-next","source_template":"packages/preset-next-15-canonical/templates/eslint.config.react.mjs","approved_config_sha256":"1961c07229416f2654a315f9d3a262112c17b81908d04cefd1356a1e0bf8ce2b"},{"stack":"react-spa","source_template":"packages/preset-react-spa/templates/eslint.config.react.mjs","approved_config_sha256":"eb9b43c39d721910fa3de21d8258188fd6b9ecb79a4209960636b3cb916d4653"}],"subjects":[{"path":"docs/test-assurance-kernel/s1/prior-art.md","sha256":"0e0d0350636b36d037232bc0634aa9747bb409ff166f311a99fa83e611090753"},{"path":"docs/test-assurance-kernel/s2/m04-installed-contract/frozen-installed-contract.json","sha256":"a767888e2abe661f4ad38df11d70c3f95304137ecc59df314f92fb039432c1ad"},{"path":"docs/test-assurance-kernel/s2/m05-error-boundary-cases.json","sha256":"688e099f380a2fd15a7eafcad7cfc5eedcebaeb165acb0e4e5715e192c1342fb"},{"path":"docs/test-assurance-kernel/s2/m06-a06/README.md","sha256":"936aad158978fe2ccb431c60e252cb38f39bdb69429ffcb31ce27a9e38bc95b0"},{"path":"docs/test-assurance-kernel/s2/m06-a08/README.md","sha256":"1c4c2302006c0dfbef3818e0d0639d2f54edaa11c91de94ee6aba5121a5d5d4c"},{"path":"docs/test-assurance-kernel/s2/m08-a09/README.md","sha256":"15683248ce4a60b700cec3d2b9aac0e8d49d5d48eeaa6c25c0ba5ae6b1de45c4"},{"path":"docs/test-assurance-kernel/s2/m08-a09/frozen-naming-contract.json","sha256":"34647fb40ab4dd1050656e39635cbd39ff1efa5a661493b8fea18db5bdefa720"},{"path":"docs/test-assurance-kernel/s2/m09-a10/README.md","sha256":"234a04ef65b09b6b67980808a1113399563349b542ca73fdfe7568d39af6572d"},{"path":"docs/test-assurance-kernel/s2/m10-completion-evidence.md","sha256":"e67979751c9d10f5c3c2281822a8d39a9f27940ceada530610d05d69f7a21cc6"},{"path":"docs/test-assurance-kernel/s2/m10-effective325.json","sha256":"d57ff334c67f757dc8bc47c9594d8dd30aa3f49d31960839fc67bd5f44e50f3b"},{"path":"docs/test-assurance-kernel/s2/m10-receipt-index.json","sha256":"3e80064413a57740c086433793e97ab4f707db529972ee9f72441c8247acc428"},{"path":"docs/test-assurance-kernel/s2/m14-wrong-import/README.md","sha256":"cf4e088f2e04cde14cf6eceefb47526c8d2ca7aa5e82976eaa249f6592a56946"},{"path":"eslint.config.mjs","sha256":"af6b5e37e8d0a3a5e4ecbc72fba718d735f68c3278898795f53cdc0fbe17aa13"},{"path":"packages/core/composition/fence.test.ts","sha256":"a987c966d1592fc2ff710f33a505065e40ff5cd679395e294d0e59d9b58684ae"},{"path":"packages/core/composition/fence.ts","sha256":"a682f5f5dc053627c9000ac61a79755f45df573cf4fd2ede2e12940f33fee457"},{"path":"packages/core/eslint-rules/require-error-boundary.mjs","sha256":"3645aef5b8734574066e9ed0d22fe32276c1ca1d9fe00b88d9b3de974c5cbf03"},{"path":"packages/core/eslint-rules/require-error-boundary.ts","sha256":"f956a38a747dfc512a65afdd1c6182a373f3a9ce40e5e7cf1386e61d857d4957"},{"path":"packages/core/hooks/advisor-role-reminders.test.ts","sha256":"12305e5f96ff040e05177887e098f0baa6d5a0ac861b6a3f4a1aefd647406c95"},{"path":"packages/core/hooks/checks/guard-liveness.test.ts","sha256":"f0867aa71b49129fb8c28265d533099803488067518099e6e103aa113c140473"},{"path":"packages/core/hooks/checks/guard-liveness.ts","sha256":"8bff9b80290a7832ac47ec5c798292c60da7d839d2d9b26c1cbfc6c59ae89c25"},{"path":"packages/core/manifest/rules-manifest.json","sha256":"0665e4214e9619420b64cb19f9fbdddef4939e9ec4736c6976d93d28b88665fe"},{"path":"packages/core/principles/04-no-tautology.test.ts","sha256":"81ea668a22761658db9de462818db9a6db4ccaf432a5187c68e1547d42aaba26"},{"path":"packages/core/principles/05-manifest-ssot.test.ts","sha256":"01b17ef7a0671ce703033e8abd1d1dd920e0d724f714408a9450bbe66cf154ea"},{"path":"packages/core/principles/06-must-not-demoted.test.ts","sha256":"0fa461dfd263ec0ee470a9da301585c21a89e75f23e93f0b6d4916ffa61738ba"},{"path":"packages/core/principles/16-hook-stub-completeness.test.ts","sha256":"5e8964f0539bff502486157c8cf48e86f9cd0f56a6b8485e1af38b1a48dc62bd"},{"path":"packages/core/principles/21-agnosticism-conformance.test.ts","sha256":"50805802946a33a03179935963b157df2f6520dbe69526a108b35f789d5f5c14"},{"path":"packages/core/principles/21-shipped-agent-liveness-tool-parity.test.ts","sha256":"cc222bfe9dd8f29c7610d32c5cecc1a9c80a53539feb13d6ec858a2c666a92a3"},{"path":"packages/core/principles/21-shipped-agent-tools-valid.test.ts","sha256":"55231a50e8405b7530de3475ff9a05591cf6fe2e4e7bdcbc714949ec1d038d36"},{"path":"packages/core/principles/38-vitest-include-ci-coverage.test.ts","sha256":"19d8d0d9a547e53d1ab9629872066330945a45f86c1425ed5468750010a14a30"},{"path":"packages/core/principles/50-install-rc-asserted.baseline.json","sha256":"b0d040b07552ae71f7d6145b99093d8f71e5ac2074c298d2e991cb0df8e549af"},{"path":"packages/core/principles/51-test-quality-corpus-conformance.test.ts","sha256":"b81ace3e463cae9af4c849eb19febc53e2667774ea0d4d92a25b097c88e28a89"},{"path":"packages/core/principles/51-test-quality-population-s2.expected.json","sha256":"50f2b0479a8cb16c2de666c6c71ea4ace65c6cb4400986dfc6df1d06eaa572c6"},{"path":"packages/core/principles/52-subprocess-status-conformance.test.ts","sha256":"3931c5342b41489f24b3e72bb7a419524d1a09933c30933aaebcb043526d998a"},{"path":"packages/core/principles/52-subprocess-status-conformance.ts","sha256":"e7e0688bd10ac7d6a2ef9f7785a027b6de54a2b8da901dadc7fcc3f97e0846b4"},{"path":"packages/core/principles/53-delivery-discovery-conformance.test.ts","sha256":"7abb437be3f4562e15d9260d64c160e19ac7f61098cc71929c9d4601b66ed1ed"},{"path":"packages/core/probes/audit-r4.ts","sha256":"64902bcaedea1fb1ed26271359a5c7f2bb0a1b7c5e0d46cee28df55d8a0a3d2d"},{"path":"packages/core/synthesizer/merge-eslint-config.test.ts","sha256":"cc8ed5107f94e67c570e89166dbdd32a4a8c8072bf4dab0e6d62242f4ee297e6"},{"path":"packages/core/synthesizer/merge-eslint-config.ts","sha256":"952d5607e1cd3869ab966e45418fe42aaefaac99b3f7396462d71711b7162ecc"},{"path":"packages/preset-next-15-canonical/RULES.md","sha256":"d38c226655e1f46905d147aee393775bd50e375c9b6b26ca82f4836f8aef793b"},{"path":"packages/preset-next-15-canonical/RULES.react-next.md","sha256":"2e0b9b443b6159c73df29ec499cf7df12953b5139b197f77fb0f141c97b471b0"},{"path":"packages/preset-next-15-canonical/templates/eslint.config.react.mjs","sha256":"1961c07229416f2654a315f9d3a262112c17b81908d04cefd1356a1e0bf8ce2b"},{"path":"packages/preset-react-native/RULES.md","sha256":"539c4e8295e8f7f9d4c3f042f516f688df74126e78adc057320704968c6dcf24"},{"path":"packages/preset-react-native/RULES.react-native.md","sha256":"e43d71c23089705db64a85595800c7f87c79d38f7a39bff48a757b8d5038146e"},{"path":"packages/preset-react-spa/RULES.md","sha256":"4064c63e47991b947ceed0a7c21d39b2177acaa21a6ddf816c0b4f70c54548d9"},{"path":"packages/preset-react-spa/RULES.react-spa.md","sha256":"652ed1ee550c21951637c7f3590fb4c157d634547accb5076962ac00d5060e7f"},{"path":"packages/preset-react-spa/eslint-rules/index.test.ts","sha256":"dcbc6aa454c3837b5d5c0d145890a5a76645dbbcdb746f2ad3c6487b87a44524"},{"path":"packages/preset-react-spa/templates/eslint.config.react.mjs","sha256":"eb9b43c39d721910fa3de21d8258188fd6b9ecb79a4209960636b3cb916d4653"},{"path":"packages/preset-react-spa/vitest.config.ts","sha256":"b6fb45a2fb79954209488740993dd229fe4d992c3d57517e11da5059530e2d7e"},{"path":"scripts/advisor-bridge-beta/cli.mjs","sha256":"eaeb0831100c3d7bf29ce2f02e50da9e65ba8db04f504d35511ad07045d79651"},{"path":"scripts/render-install-roster.mjs","sha256":"b416331fab592b14fcd3562d8d2725288ba59497b14b6cc92babb489bf699539"},{"path":"scripts/render-presets.mjs","sha256":"838539dd51e1563af25e1024bcda331aca65a63d81a6399f29c3be5a020fb0a4"},{"path":"scripts/render-reference.mjs","sha256":"426cfba5b23884297cde615bff1b4591c00024760ff7d6e1cf8a10b5be665805"},{"path":"scripts/render-rule-index.mjs","sha256":"8c63b81d7b2ff1254914f3c2b54be31e9674ed6efd6e8bc34aaf3d08fcd1af66"},{"path":"scripts/test-assurance/delivery/replay-a12-emitted-corruption.sh","sha256":"074ecbaace834c90afe27d8b193b4e05e97244ecc69642afb428062857b34143"},{"path":"scripts/test-assurance/s2/m05-error-boundary.test.mjs","sha256":"7a36f262bc8235fd49fe2994590838155c30da4b6cee74051b26df3465300f29"},{"path":"setup.d/40-configs.sh","sha256":"ecd96962811f8ed69e3aacd9b2023bba8fd6be62a68d0e822de9ed7d28081df1"},{"path":"templates/ts-server/eslint.config.mjs","sha256":"dd40d657ac8405f7c4d0e883840487e93196fe7c69be33da44c82d8181a27463"},{"path":"tests/advisor-bridge-beta/protocol.test.mjs","sha256":"6052c0f887152b55677655e7c1a1749b6df12efa8c7153c6ef40290d3ec584cd"},{"path":"tests/advisor-role-reminders/test_reminders.py","sha256":"14f3600fdc077089a7ce278b0c9574dc1687c6a05bae6f3d6677b603e07043b9"},{"path":"tests/install-sh/audit-r4-shipped.test.sh","sha256":"d8ee5124d96a047cbcccba53ee78f7562ae9a3ff19efbbd92406a6099e7208a7"},{"path":"tests/install-sh/f5-stryker-globs.test.sh","sha256":"52c0ba25938e04cdf7eb8c627261760f0dbf4e31fc8eb30ed75b6ffdf7e4141a"},{"path":"tests/plugin/install-seam.test.sh","sha256":"c38accf72220e3ad408b69b22121b56ce5c035bed1f380a2ddd742405b14a192"}]};
const S2_NODE_ENTRIES = ['tests/advisor-bridge-beta/protocol.test.mjs', 'scripts/test-assurance/s2/m05-error-boundary.test.mjs'];
const S2_ORIGINAL_RUN = run;
let s2Deadline = Infinity;
let s2LogDir = null;
let s2ProcessIndex = 0;

function runS2(bin, args, options = {}) {
  const remaining = s2Deadline - Date.now();
  if (remaining <= 0) throw new InfraError('S2 global 1200-second execution ceiling reached');
  const start = Date.now();
  const result = S2_ORIGINAL_RUN(bin, args, { ...options, timeout: Math.min(options.timeout ?? QUICK_TIMEOUT_MS, remaining) });
  if (s2LogDir === null) s2LogDir = mkdtempSync(join(tmpdir(), 'tak-s2-run-'));
  s2ProcessIndex += 1;
  const streams = {};
  for (const name of ['stdout', 'stderr']) {
    const file = join(s2LogDir, `${s2ProcessIndex}-${name}.log`);
    writeFileSync(file, result[name]);
    streams[name] = { path: file, sha256: sha256(result[name]), bytes: Buffer.byteLength(result[name]) };
  }
  console.log(`S2-PROCESS ${JSON.stringify({ bin, args, cwd: options.cwd ?? REPO_ROOT, duration_ms: Date.now() - start, rc: result.rc, ...streams })}`);
  return result;
}

function s2Json(rel) { return JSON.parse(readFileSync(join(REPO_ROOT, rel), 'utf8')); }
function s2Count(rows) { return Object.fromEntries(S2.statuses.map((s) => [s, rows.filter((r) => r.status === s).length])); }
function s2Ids(rows, prefix, count, width) {
  if (!Array.isArray(rows)) return [`${prefix} rows missing`];
  const ids = rows.map((r) => r?.id);
  const required = Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(width, '0')}`);
  return [
    ...(rows.length === count ? [] : [`${prefix} count ${rows.length} != ${count}`]),
    ...required.filter((id) => !ids.includes(id)).map((id) => `missing ${id}`),
    ...(new Set(ids).size === ids.length ? [] : [`duplicate ${prefix} ID`]),
    ...ids.filter((id) => !required.includes(id)).map((id) => `unknown ${prefix} identity ${String(id)}`),
  ];
}

function stepS2Prereqs() {
  for (const fn of [stepPrereqs, stepK7Records]) {
    const outcome = fn();
    if (outcome.status !== 'PASS') return outcome;
  }
  const scope = join(REPO_ROOT, 'docs/test-assurance-kernel/s2/final-scope-ruling.json');
  if (!existsSync(scope) || sha256(readFileSync(scope)) !== S2.scopeSha) return red('independent S2 scope ruling missing or changed');
  for (const binding of S2.subjects) {
    const file = repoPath(binding.path);
    if (!file || !existsSync(file) || sha256(readFileSync(file)) !== binding.sha256) return red(`accepted subject changed: ${binding.path}; historical scoped evidence cannot follow a changed producer`);
  }
  return pass('unchanged frozen inputs/records, independent scope authority and accepted subject bindings present; no historical report is called fresh');
}

function stepS2Inventory() {
  /* S2_INVENTORY_BEGIN */
  try {
    const population = s2Json('docs/test-assurance-kernel/s2/population.json');
    const obligations = s2Json('docs/test-assurance-kernel/s2/obligations.json');
    const dispositions = s2Json('docs/test-assurance-kernel/s2/dispositions.json');
    const seeds = s2Json('docs/test-assurance-kernel/s2/seed-intake.json');
    const problems = [...s2Ids(population.entries, 'POP', 4172, 4), ...s2Ids(obligations.obligations, 'OBL', 81, 3), ...s2Ids(dispositions.dispositions, 'CAND', 110, 3)];
    const actualPaths = population.entries.map((r) => r.path);
    const live = run('git', ['ls-tree', '-r', '--name-only', '-z', 'HEAD'], { env: gitEnv() });
    const base = run('git', ['ls-tree', '-r', '--name-only', '-z', S2.base], { env: gitEnv() });
    if (live.rc !== 0 || base.rc !== 0) return infraStep('Git cannot resolve current or accepted S2 input tree');
    const paths = live.stdout.split('\0').filter(Boolean);
    const baseList = base.stdout.split('\0').filter(Boolean);
    // Additive post-S2 scope (S3): a validated scope-extension ledger may EXTEND the expected
    // path set with its LANDED addedPaths only — never remove/rename any historical path, and
    // the accepted-scope floor (4171 base + one named self-document) is never lowered. Pending
    // evidence names stay outside this comparison (their absence is tolerated only by the S3
    // reconciliation until evidenceComplete). An absent ledger yields zero additive paths:
    // byte-identical canonical S1/S2 behavior.
    const extension = loadScopeExtension(REPO_ROOT);
    if (!extension.absent && !extension.ok) return red(`post-S2 scope-extension ledger invalid: ${extension.problems.join(' | ')}`);
    // ROOT-S4-R7: LANDED typed s4-index declarations join the additive set exactly like
    // addedPaths (an actually committed future-S4 file must be in the expected scope or the
    // unregistered-live-path refusal fires); unlanded declarations stay outside, like pending.
    const additive = extension.ok ? [
      ...extension.ledger.addedPaths.map((r) => r.path),
      ...(extension.ledger.s4EvidenceIndex?.declaredPaths ?? [])
        .filter((e) => existsSync(join(REPO_ROOT, e.path)))
        .map((e) => e.path),
    ] : [];
    const s2Scope = [...baseList, 'docs/test-assurance-kernel/s2/final-scope-ruling.json'];
    // 2026-11-01 upstream integration lineage: when (and only when) the Root-reviewed carrier
    // is present and byte-pinned, the expected scope additionally admits its COMPLETE
    // upstream-only path set — each row independently reconciled against the immutable bc8
    // commit (ancestry, mode/kind/gitBlob via one full ls-tree, byte length per blob) — plus
    // the single declared carrier path itself. An absent carrier keeps the exact legacy
    // expectation: byte-identical S1/S2/S3 no-integration behavior, no historical rewrite.
    const integration = loadReviewedIntegration(REPO_ROOT);
    if (!integration.absent && !integration.ok) return red(`reviewed upstream integration carrier invalid: ${integration.problems.join(' | ')}`);
    let upstreamPaths = [];
    if (integration.ok) {
      const lineageProblems = reconcileUpstreamLineage({
        repoRoot: REPO_ROOT,
        git: (args) => run('git', args, { env: gitEnv() }),
        carrier: integration,
        basePaths: baseList,
        additivePaths: additive,
      });
      if (lineageProblems.length) return red(`upstream integration lineage reconciliation failed: ${lineageProblems.slice(0, 5).join(' | ')}${lineageProblems.length > 5 ? ` (+${lineageProblems.length - 5} more)` : ''}`);
      upstreamPaths = integration.data.currentLineageOnlyScope.upstreamAdditions.map((r) => r.path);
    }
    const expected = [...s2Scope, ...additive, ...upstreamPaths, ...(integration.ok ? [S2_REVIEWED_INTEGRATION_REL] : [])].sort();
    if (baseList.length !== 4171 || JSON.stringify([...paths].sort()) !== JSON.stringify(expected) || JSON.stringify([...actualPaths].sort()) !== JSON.stringify([...s2Scope].sort())) problems.push(`exact NUL Git/population path reconciliation failed (${s2Scope.length} accepted-scope paths + ${additive.length} ledger-declared post-S2 paths + ${upstreamPaths.length} reviewed upstream-lineage paths)`);
    if (sha256(JSON.stringify(population.entries.slice(0, 4133).map((r) => [r.id, r.path]))) !== S2.originalPopulation) problems.push('original 4133 POP identity/path pairs changed');
    for (const row of [...population.entries, ...obligations.obligations, ...dispositions.dispositions]) if (!S2.statuses.includes(row.status)) problems.push(`unknown status ${String(row.status)} at ${row.id}`);
    if (Object.entries(S2.populationCounts).some(([s, n]) => s2Count(population.entries)[s] !== n)) problems.push('population scoped status counts differ from independent final contract');
    if (sha256(JSON.stringify(obligations.obligations.map((r) => [r.id, r.name, r.carrier, r.status]))) !== S2.obligationIdentity) problems.push('81 obligation identity/name/carrier/status preservation failed');
    if (sha256(JSON.stringify(dispositions.dispositions.map((r) => [r.id, r.source, r.owner_mechanism, r.status]))) !== S2.candidateIdentity) problems.push('110 candidate identity/source/owner/scoped-status contract failed');
    if (dispositions.dispositions.some((r) => r.blocking_for_s2done !== false || ['candidate-needs-review', 'demonstrated-gap'].includes(r.status))) problems.push('unresolved blocking candidate');
    if (!Array.isArray(seeds.seeds) || sha256(JSON.stringify(seeds.seeds.map((r) => [r.seed, r.title, r.owner_mechanism, r.current_status]))) !== S2.seedIdentity) problems.push('12 seed identity/history/current scoped-status contract failed');
    if (problems.length) return red(problems.join(' | '));
    return pass(`exact ${expected.length} Git/POP paths (4172 accepted scope + ${additive.length} ledger-declared post-S2), 110 individually dispositioned candidates, 81 unique obligation IDs, 12 scoped seeds; ordinary structural inventory is not behavioral certification`);
  } catch (error) { return red(`invalid committed S2 inventory: ${error.message}`); }
  /* S2_INVENTORY_END */
}

function evaluateS2Queue(raw) {
  /* S2_QUEUE_BEGIN */
  if (sha256(Buffer.from(raw).subarray(0, S2.queuePrefixBytes)) !== S2.queuePrefixSha) return red('historical S1 queue prefix changed');
  const latest = new Map();
  try {
    for (const block of parseDispositionsEntries(raw)) {
      if (block.unterminated) return red('unterminated semantic queue entry');
      const entry = JSON.parse(block.json);
      latest.set(entry.source, entry);
    }
  } catch (error) { return red(`invalid semantic queue: ${error.message}`); }
  for (const source of S2.requiredQueueSources) {
    const entry = latest.get(source);
    if (!entry || entry.disposition !== 'resolved' || !entry.resolution_evidence?.includes('docs/test-assurance-kernel/s2/final-scope-ruling.json')) return red(`missing resolved consumed semantic/current S2 source: ${source}`);
  }
  for (const entry of latest.values()) {
    if (entry.disposition === 'resolved') continue;
    if (entry.source === S2.deferredSource && sha256(JSON.stringify(entry)) === S2.deferredSha) continue;
    return red(`unresolved consumed finding ${entry.id}: owner-stage ${entry.owner_stage} cannot launder a current semantic obligation`);
  }
  return pass('all current S2 and external-contract sources consumed; only the exact original M15 public-regeneration handoff remains deferred');
  /* S2_QUEUE_END */
}

function stepS2Dispositions() {
  const inherited = stepDispositions();
  if (inherited.status !== 'PASS') return inherited;
  return evaluateS2Queue(readFileSync(join(REPO_ROOT, DISPOSITIONS_REL), 'utf8'));
}

function evaluateS2Native(res, records, counts) {
  /* S2_NATIVE_BEGIN */
  if (/ERR_MODULE_NOT_FOUND|Cannot find module|ERR_UNKNOWN_FILE_EXTENSION|SyntaxError:|parse failure is infra/.test(res.stderr + res.stdout)) return infraStep('native dependency/module/parse infrastructure failure; no detection credited');
  if (res.rc === 1) return red('actual native assertion/test failure (exit 1)');
  if (res.rc !== 0) return infraStep(`native runner exited ${res.rc}`);
  if (records.length === 0 || records.some((r) => r.directive) || !Number.isInteger(counts.tests) || counts.tests < 67 || counts.skipped || counts.todo || counts.cancelled) return infraStep('native required cases not-executed: empty/filtered/skipped/cancelled or unknown report');
  if (records.length !== 67 || new Set(records.map((r) => r.name)).size !== 67 || S2.nativeNames.some((name) => !records.some((r) => r.name === name && r.ok)) || counts.tests !== 67 || counts.pass !== 67 || counts.fail !== 0) return red('native exact 67 required identities/count/status contract failed');
  return pass('native 67/67 actually passed: 53 protocol plus 14 M05 (12 children + two parents); zero skip/todo/cancel');
  /* S2_NATIVE_END */
}

function stepS2Native() {
  if (S2_NODE_ENTRIES.length === 0) return infraStep('empty native selector: not-executed');
  if (JSON.stringify(S2_NODE_ENTRIES) !== JSON.stringify(S2.nativeEntries) || S2_NODE_ENTRIES.some((p) => !existsSync(repoPath(p) ?? ''))) return red('missing or substituted required native entry');
  const res = run(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=tap', ...S2_NODE_ENTRIES], { timeout: 180_000 });
  const records = [];
  const counts = {};
  for (const line of res.stdout.split('\n')) {
    const record = /^\s*(ok|not ok) \d+ - (.*?)(?:\s+#\s+(SKIP|TODO)\b.*)?\s*$/.exec(line);
    if (record) records.push({ ok: record[1] === 'ok', name: record[2].replace(/\\([#\\])/g, '$1'), directive: record[3] ?? null });
    const total = /^# (tests|pass|fail|cancelled|skipped|todo) (\d+)\s*$/.exec(line);
    if (total) counts[total[1]] = Number(total[2]);
  }
  console.log(`S2-NATIVE-REPORT ${JSON.stringify({ native_exit: res.rc, records, counts })}`);
  return evaluateS2Native(res, records, counts);
}

// 2026-11-01 upstream integration renewal: the CURRENT approved default-config hash per
// stack resolves through the single Root-reviewed carrier (byte-pinned). The frozen legacy
// approvals inside the S2 record stay verbatim below as the historical/default context and
// remain the approval whenever the carrier is absent (legacy no-integration behavior); a
// drifted or section-missing carrier is a hard failure, never a silently followed output.
function s2ApprovedConfigHash(i) {
  const carrier = loadReviewedIntegration(REPO_ROOT);
  if (carrier.absent) return S2.configs[i].approved_config_sha256;
  if (!carrier.ok) throw new Error(`reviewed integration carrier invalid: ${carrier.problems.join(' | ')}`);
  const row = carrier.data.m04IndependentDefaultsRenewal.profiles.find((p) => p.stack === S2.configs[i].stack);
  if (!row) throw new Error(`no reviewed renewal entry for stack ${S2.configs[i].stack}`);
  return row.independentlyDerivedUnionSha256;
}

function evaluateS2Kernel(res, report) {
  /* S2_KERNEL_BEGIN */
  if (res.rc !== 0 && res.rc !== 1) return infraStep(`kernel runner exited ${res.rc}`);
  const cases = (report.testResults ?? []).flatMap((file) => file.assertionResults ?? []);
  if (!cases.length || cases.some((a) => ['pending', 'skipped', 'todo'].includes(a.status)) || report.numPendingTests || report.numTodoTests) return infraStep('kernel required cases not-executed: empty/filtered/skipped');
  if (report.unhandledErrors?.length || report.numRuntimeErrorTestSuites) return infraStep('kernel unhandled/runtime infrastructure error');
  if (res.rc === 1 || cases.some((a) => a.status === 'failed')) return red('actual kernel assertion/test failure');
  if (cases.length !== 40 || report.numTotalTests !== 40 || report.numPassedTests !== 40 || report.numFailedTests !== 0 || new Set(cases.map((a) => a.fullName)).size !== 40 || S2.kernelNames.some((name) => !cases.some((a) => a.fullName === name && a.status === 'passed'))) return red('kernel exact forty required case identity/status contract failed');
  const receipts = [...res.stdout.matchAll(/^\[TAK-M04\]\s+(\{[^\n]+\})\s*$/gm)].map((m) => JSON.parse(m[1]));
  if (receipts.length !== 3 || receipts.some((r, i) => r.stack !== S2.configs[i].stack || r.status !== 0 || r.error !== null || r.signal !== null || r.actual_hash !== s2ApprovedConfigHash(i))) return red('actual P53 installed-artifact/native-status receipts incomplete or changed');
  return pass('kernel 40/40 actually passed with zero skips and all three actual P53 installer/status/literal artifact receipts');
  /* S2_KERNEL_END */
}

function stepS2Kernel() {
  const dir = mkdtempSync(join(tmpdir(), 'tak-s2-report-'));
  const file = join(dir, 'vitest.json');
  try {
    // A04 runs the real installer to completion for all three profiles (R1B 2026-10-28:
    // each install alone exceeded the former 30s per-profile bound), so the old 240s
    // trio envelope no longer bounds the run. 600s keeps this adapter step a hard,
    // finite bound on slow hosts.
    const res = run(VITEST_BIN, ['run', '--config', 'vitest.config.ts', 'principles/51-test-quality-corpus-conformance.test.ts', 'principles/52-subprocess-status-conformance.test.ts', 'principles/53-delivery-discovery-conformance.test.ts', '--reporter=default', '--reporter=json', `--outputFile.json=${file}`], { cwd: join(REPO_ROOT, 'packages/core'), timeout: 600_000 });
    if (!existsSync(file)) return infraStep('fresh kernel JSON report missing; no old report can satisfy this run');
    const raw = readFileSync(file, 'utf8');
    console.log(`S2-KERNEL-REPORT ${JSON.stringify({ sha256: sha256(raw), raw })}`);
    let report;
    try { report = JSON.parse(raw); } catch { return infraStep('fresh kernel report has unknown/malformed grammar'); }
    return evaluateS2Kernel(res, report);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

function stepS2A12() {
  const res = run('bash', [join(REPO_ROOT, 'scripts/test-assurance/delivery/replay-a12-emitted-corruption.sh')]);
  if (res.rc === 3) return infraStep('A12 characterization infrastructure refusal');
  const expected = ['healthy-match=true', 'body-drift-caught=true', 'hash-attribute-parsed=true', 'corrupted-hash-still-matches=true'];
  if (res.rc !== 0 || expected.some((value) => !res.stdout.split('\n').includes(`A12-CHARACTERIZATION ${value}`))) return red('A12 actual historical characterization tuple changed');
  return pass('actual A12 healthy/body-drift/unknown-attribute tuple preserved; hash survivor remains prospective WI-1, not a current promised-hash bug');
}

function stepS2BodyCarriers() {
  for (const rel of ['scripts/render-install-roster.mjs', 'scripts/render-presets.mjs', 'scripts/render-reference.mjs', 'scripts/render-rule-index.mjs']) {
    const res = run(TSX_BIN, [join(REPO_ROOT, rel), '--check']);
    if (res.rc === 1) return red(`actual body/freshness drift: ${rel}`);
    if (res.rc !== 0) return infraStep(`body carrier ${rel} exited ${res.rc}`);
  }
  return pass('all four existing actual body/freshness --check carriers passed; no metadata-hash integrity claim');
}

const S2_STEPS = [
  ['s2-prereqs', stepS2Prereqs], ['s2-inventory', stepS2Inventory],
  ['s2-dispositions', stepS2Dispositions], ['s2-static', stepStaticMatrix],
  ['s2-native', stepS2Native], ['s2-kernel', stepS2Kernel],
  ['s2-a12', stepS2A12], ['s2-body-carriers', stepS2BodyCarriers], ['s2-twins', stepTwins],
];

function s2ReplaceOnce(text, from, to) {
  const boundary = text.indexOf('\nfunction runS2Control(');
  const target = text.slice(0, boundary);
  if (boundary < 0 || target.split(from).length !== 2) throw new InfraError(`S2 control edge is not unique: ${from}`);
  return target.replace(from, () => to) + text.slice(boundary);
}

function runS2Control(arm) {
  let target = 'scripts/test-assurance/verify.mjs';
  let step = 's2-native';
  let expected = 3;
  let intended = 'native';
  const dir = mkdtempSync(join(tmpdir(), 'tak-s2-control-'));
  const nativeArgs = "['--test', '--test-concurrency=1', '--test-reporter=tap', ...S2_NODE_ENTRIES]";
  const kernelArgs = "'--reporter=default', '--reporter=json', `--outputFile.json=${file}`";
  const filterNative = (s) => s2ReplaceOnce(s, nativeArgs, "['--test', '--test-concurrency=1', '--test-reporter=tap', '--test-name-pattern=^__S2_NO_MATCH__$', ...S2_NODE_ENTRIES]");
  const bypass = (s, kind, result) => {
    const start = `/* S2_${kind}_BEGIN */`;
    const end = `/* S2_${kind}_END */`;
    if (s.split(start).length !== 2 || s.split(end).length !== 2) throw new InfraError('control validator region is not unique');
    return s.slice(0, s.indexOf(start) + start.length) + `\n  return ${result};\n  ` + s.slice(s.indexOf(end));
  };
  let mutate;
  const changeJson = (fn) => (text) => { const value = JSON.parse(text); fn(value); return JSON.stringify(value, null, 1) + '\n'; };
  if (['old-missing-obligation-ids', 'duplicate-obligation-id', 'actual-inventory-permissive'].includes(arm)) {
    step = 's2-inventory'; expected = 1; intended = 'OBL-079';
    if (arm === 'actual-inventory-permissive') {
      mutate = (s) => bypass(s, 'INVENTORY', "pass('control disabled actual inventory consumer')");
    } else {
      target = 'docs/test-assurance-kernel/s2/obligations.json';
      mutate = arm === 'old-missing-obligation-ids' ? () => {
        const old = run('git', ['show', `${S2.base}:${target}`], { env: gitEnv() });
        if (old.rc !== 0 || sha256(old.stdout) !== S2.oldObligationSha) throw new InfraError('original obligation preimage unavailable');
        return old.stdout;
      } : changeJson((d) => { d.obligations[78].id = 'OBL-078'; });
    }
  } else if (['missing-candidate', 'unknown-status'].includes(arm)) {
    target = 'docs/test-assurance-kernel/s2/dispositions.json'; step = 's2-inventory'; expected = 1; intended = arm === 'missing-candidate' ? 'CAND-110' : 'unknown status';
    mutate = changeJson((d) => { if (arm === 'missing-candidate') d.dispositions.pop(); else d.dispositions[0].status = 'not-a-canonical-status'; });
  } else if (['missing-semantic-boundary', 'unresolved-semantic-finding', 'deferred-semantic-finding', 'actual-queue-permissive'].includes(arm)) {
    step = 's2-dispositions'; expected = 1; intended = arm === 'missing-semantic-boundary' ? 'CAND-086' : 'unresolved consumed finding';
    if (arm === 'actual-queue-permissive') mutate = (s) => bypass(s, 'QUEUE', "pass('control disabled actual semantic consumer')");
    else {
      target = DISPOSITIONS_REL;
      mutate = arm === 'missing-semantic-boundary' ? (s) => {
        let removed = 0;
        const changed = s.replace(/```json\s*\n([^]*?)\n```/g, (block, body) => { if (JSON.parse(body).source === 'CAND-086') { removed += 1; return ''; } return block; });
        if (removed !== 1) throw new InfraError('semantic boundary removal not unique');
        return changed;
      } : (s) => s + '\n```json\n' + JSON.stringify({ id: 's2-control-unresolved', source: 's2-control-actual-semantic-finding', classification: 'semantic-review-finding', disposition: 'owner-stage', owner_stage: arm === 'deferred-semantic-finding' ? 'S4' : 'S2' }) + '\n```\n';
    }
  } else if (arm === 'missing-native-entry') {
    expected = 1; intended = 'missing or substituted required native entry';
    mutate = (s) => s2ReplaceOnce(s, "const S2_NODE_ENTRIES = ['tests/advisor-bridge-beta/protocol.test.mjs', 'scripts/test-assurance/s2/m05-error-boundary.test.mjs'];", "const S2_NODE_ENTRIES = ['tests/advisor-bridge-beta/protocol.test.mjs', 'scripts/test-assurance/s2/m05-error-boundary.test.mjs.missing'];");
  } else if (arm === 'empty-native-selector') {
    intended = 'empty native selector';
    mutate = (s) => s2ReplaceOnce(s, "const S2_NODE_ENTRIES = ['tests/advisor-bridge-beta/protocol.test.mjs', 'scripts/test-assurance/s2/m05-error-boundary.test.mjs'];", 'const S2_NODE_ENTRIES = [];');
  } else if (arm === 'native-filtered-skip') mutate = filterNative;
  else if (arm === 'native-real-nonzero') {
    expected = 1; intended = 'actual native assertion/test failure';
    const fixture = join(dir, 'real-failure.test.mjs');
    writeFileSync(fixture, "import test from 'node:test'; import assert from 'node:assert/strict'; test('S2 native real assertion failure control', () => assert.fail('S2 native real assertion failure control'));\n");
    mutate = (s) => s2ReplaceOnce(s, nativeArgs, nativeArgs.slice(0, -1) + `, ${JSON.stringify(fixture)}]`);
  } else if (arm === 'actual-consumer-permissive') mutate = (s) => bypass(filterNative(s), 'NATIVE', "pass('control disabled actual native observation consumer')");
  else if (arm === 'actual-consumer-overreject') { expected = 0; intended = ''; mutate = (s) => bypass(s, 'NATIVE', "red('control rejects complete healthy native report')"); }
  else if (arm === 'actual-kernel-permissive') { step = 's2-kernel'; mutate = (s) => bypass(s2ReplaceOnce(s, kernelArgs, "'-t', '^__S2_NO_MATCH__$', " + kernelArgs), 'KERNEL', "pass('control disabled actual kernel observation consumer')"); }
  else if (arm === 'actual-kernel-overreject') { step = 's2-kernel'; expected = 0; intended = ''; mutate = (s) => bypass(s, 'KERNEL', "red('control rejects complete healthy kernel report')"); }
  else throw new InfraError(`unknown S2 control ${arm}`);
  let secondary = null;
  if (arm === 'actual-inventory-permissive') secondary = { path: 'docs/test-assurance-kernel/s2/obligations.json', mutate: changeJson((d) => { for (const row of d.obligations.slice(78)) delete row.id; }) };
  if (arm === 'actual-queue-permissive') secondary = { path: DISPOSITIONS_REL, mutate: (s) => s + '\n```json\n' + JSON.stringify({ id: 's2-control-unresolved', source: 's2-control-actual-semantic-finding', classification: 'semantic-review-finding', disposition: 'owner-stage', owner_stage: 'S2' }) + '\n```\n' };
  const perform = () => withTamperedFile(target, (abs, original) => {
    const changed = mutate(original.toString());
    writeFileSync(join(dir, 'fixed-source.txt'), original);
    writeFileSync(join(dir, 'faulted-source.txt'), changed);
    writeFileSync(abs, changed);
    console.log(`S2-CONTROL-PATCH ${JSON.stringify({ arm, target, fixed_sha256: sha256(original), faulted_sha256: sha256(changed), artifact_dir: dir })}`);
  }, () => {
    const observed = runSelfOnStep(step);
    console.log(observed.output);
    const detected = observed.rc === expected && (expected === 0 ? observed.output.includes('PARTIAL-ACCEPTED') : observed.output.includes(intended));
    console.log(`S2-CONTROL ${JSON.stringify({ arm, step, adapter_exit: observed.rc, frozen_expected_exit: expected, detected, artifact_dir: dir })}`);
    return detected;
  });
  if (!secondary) return perform();
  return withTamperedFile(secondary.path, (abs, original) => writeFileSync(abs, secondary.mutate(original.toString())), perform);
}

const S2_CONTROL_IDS = ['old-missing-obligation-ids', 'duplicate-obligation-id', 'missing-candidate', 'unknown-status', 'missing-semantic-boundary', 'unresolved-semantic-finding', 'deferred-semantic-finding', 'missing-native-entry', 'empty-native-selector', 'native-filtered-skip', 'native-real-nonzero', 'actual-consumer-permissive', 'actual-consumer-overreject', 'actual-inventory-permissive', 'actual-queue-permissive', 'actual-kernel-permissive', 'actual-kernel-overreject'];
const S2_TAMPER_ARMS = Object.fromEntries(S2_CONTROL_IDS.map((id) => [id, () => runS2Control(id)]));


let STAGE = null;
let requireHost = null;
let onlyStep = null;
let tamperArm = null;
let promoteGate = false;

function usage(msg) {
  console.error(`VERIFY-REFUSAL: ${msg}
usage: node scripts/test-assurance/verify.mjs --stage S1|S2|S3|S4 [--require-host darwin|linux] [--step <id>] [--tamper-arm T0|T1|T2] [--promote-gate] [--expected-inputs PATH --expected-inputs-sha256 SHA256]`);
  process.exit(3);
}

const argv = process.argv.slice(2);
let expectedInputsPath = null;
let expectedInputsPin = null;
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--stage') {
    STAGE = argv[(i += 1)];
  } else if (argv[i] === '--require-host') {
    requireHost = argv[(i += 1)];
  } else if (argv[i] === '--step') {
    onlyStep = argv[(i += 1)];
  } else if (argv[i] === '--tamper-arm') {
    tamperArm = argv[(i += 1)];
  } else if (argv[i] === '--promote-gate') {
    promoteGate = true;
  } else if (argv[i] === '--expected-inputs') {
    expectedInputsPath = argv[(i += 1)];
  } else if (argv[i] === '--expected-inputs-sha256') {
    expectedInputsPin = argv[(i += 1)];
  } else {
    usage(`unknown argument ${argv[i]}`);
  }
}
if (!STAGE) usage('--stage is required');
// Bounded temporal trust repair (Root56810c70): --expected-inputs/--expected-inputs-sha256
// is an OPTIONAL PAIRED DATA INPUT for the S3/S4 externally dependent certificates — a
// conditional validation input selected and pinned by the actual Root native invocation,
// never an authentication flag, trust bit or global state. Both halves are required
// together, the file bytes must match the pin exactly before use, and without the pair the
// S3/S4 externally dependent certificates stay nonPASS (fail closed; no in-repo fallback).
// An arbitrary caller-selected pair that produces a helper PASS mints no independent
// Root/S4 acceptance — the positive verdict states its conditional data-validation scope.
if ((expectedInputsPath === null) !== (expectedInputsPin === null)) {
  usage('--expected-inputs and --expected-inputs-sha256 are a paired data input — provide BOTH or neither');
}
let EXPECTED_INPUTS = null;
if (expectedInputsPath !== null || expectedInputsPin !== null) {
  if (typeof expectedInputsPin !== 'string' || !/^[0-9a-f]{64}$/.test(expectedInputsPin)) usage('--expected-inputs-sha256 must be a HEX64 sha256');
  let bytes;
  try {
    bytes = readFileSync(expectedInputsPath);
  } catch (e) {
    console.error(`VERIFY-REFUSAL: --expected-inputs unreadable (${e.message}); refusing`);
    process.exit(3);
  }
  if (sha256(bytes) !== expectedInputsPin) {
    console.error(`VERIFY-REFUSAL: expected-inputs bytes do not match the provided pin (got ${sha256(bytes)}, want ${expectedInputsPin}); refusing — the descriptor may not be swapped for other bytes`);
    process.exit(3);
  }
  try {
    EXPECTED_INPUTS = JSON.parse(bytes.toString('utf8'));
  } catch (e) {
    console.error(`VERIFY-REFUSAL: expected-inputs JSON unreadable (${e.message}); refusing`);
    process.exit(3);
  }
}

// Host guard BEFORE anything runs (the reviewer's Mac contract; fails closed on mismatch).
// os.type() is Node's sysname ('Linux' | 'Darwin' | 'Windows_NT'); lowercased it IS the
// uname-sysname predicate (os.uname() itself is not a Node API — discovered at first run).
let sysname;
try {
  sysname = type().toLowerCase();
} catch {
  // Fallback only (os.type() does not throw on supported Node). os.platform() already
  // returns 'darwin'|'linux' on those hosts, so this matches the same hosts — it does not
  // add a refusal path (F-H5: the old comment claimed one the code never had).
  sysname = platform();
}
if (requireHost !== null) {
  if (requireHost !== 'darwin' && requireHost !== 'linux') usage(`--require-host must be darwin|linux, got ${JSON.stringify(requireHost)}`);
  if (sysname !== requireHost) {
    console.error(`VERIFY-REFUSAL: host mismatch — this contract requires ${requireHost}, running on ${sysname}; refusing to run (the host check is never weakened)`);
    process.exit(3);
  }
}

// Repo-identity guard: the physical git common dir of the cwd must be THIS script's repo's
// (primary clone + linked worktrees share one common dir; a foreign clone refuses).
{
  const cwdCommon = gitCommonDir(process.cwd());
  const repoCommon = gitCommonDir(REPO_ROOT);
  if (!cwdCommon || !repoCommon || cwdCommon !== repoCommon) {
    console.error(`VERIFY-REFUSAL: repo-identity guard — cwd (${process.cwd()}) is not a checkout of this adapter's repository (git common dir ${cwdCommon ?? 'unresolvable'} != ${repoCommon ?? 'unresolvable'}); refusing to run (host-verify.sh #1971 guard)`);
    process.exit(3);
  }
}

if (!['S1', 'S2', 'S3', 'S4'].includes(STAGE)) usage(`unknown stage ${JSON.stringify(STAGE)}`);
// S3/S4 registries live in the stage module (scripts/test-assurance/s3.mjs) and replay
// through the same runner/verdict grammar. No tamper arms are registered for S3/S4 in this
// delivery — their controls are the stage steps themselves plus the frozen S2 oracle.
let activeSteps;
let activeArms;
if (STAGE === 'S3' || STAGE === 'S4') {
  activeSteps = s3BuildStageSteps(STAGE, { repoRoot: REPO_ROOT, runFn: run, gitEnv, expectedInputs: EXPECTED_INPUTS });
  activeArms = {};
} else {
  activeSteps = STAGE === 'S2' ? S2_STEPS : STEPS;
  activeArms = STAGE === 'S2' ? S2_TAMPER_ARMS : TAMPER_ARMS;
}
if (STAGE === 'S2') { s2Deadline = Date.now() + 1_200_000; run = runS2; }
if (onlyStep && !activeSteps.some(([id]) => id === onlyStep)) {
  usage(`--step ${JSON.stringify(onlyStep)}: no such step (registered: ${activeSteps.map(([id]) => id).join(', ')})`);
}
if (tamperArm && !Object.prototype.hasOwnProperty.call(activeArms, tamperArm)) {
  usage(`--tamper-arm ${JSON.stringify(tamperArm)}: no such arm (registered: ${Object.keys(activeArms).join(', ')})`);
}
if (promoteGate && (onlyStep || tamperArm)) {
  usage('--promote-gate is a standalone mode — it does not combine with --step or --tamper-arm');
}

try {
  loadFrozenInputs();
} catch (e) {
  console.error(`VERIFY prereqs INFRA ${e.message}`);
  console.log('VERIFY-SUMMARY stage=… pass=0 red=0 infra=1');
  console.log('VERIFY VERDICT: INCONCLUSIVE exit=3 (frozen inputs unreadable — nothing can be replayed)');
  process.exit(3);
}

console.log(`VERIFY repo=${REPO_ROOT}`);
console.log(`VERIFY stage=${STAGE} require-host=${requireHost ?? 'unset'} sysname=${sysname}`);
console.log(`VERIFY oracle sha256=${ORACLE_SHA} (live-recomputed)`);

if (tamperArm) {
  let detected = false;
  try {
    detected = activeArms[tamperArm]();
  } catch (e) {
    console.error(`VERIFY TAMPER INFRA ${e.message}`);
    process.exit(3);
  }
  if (detected) {
    console.log(`VERIFY TAMPER ${tamperArm} VERDICT: DETECTED exit=0 (the adapter's fail-closed behavior is proven, restoration hash-proven)`);
    process.exit(0);
  }
  console.log(`VERIFY TAMPER ${tamperArm} VERDICT: UNDETECTED exit=1 (the tamper did not produce the required non-green outcome — the adapter can be silenced; REAL failure)`);
  process.exit(1);
}

if (promoteGate) runPromoteGate();

const results = [];
let skipRest = false;
for (const [id, fn] of activeSteps) {
  if (onlyStep && id !== onlyStep) continue;
  if (skipRest) {
    console.log(`VERIFY ${id} NOT-RUN (a prior step could not conclude — INFRA precedence, no verdict is claimed over unexecuted steps)`);
    continue;
  }
  let outcome;
  try {
    outcome = fn();
  } catch (e) {
    outcome = e instanceof InfraError ? infraStep(e.message) : infraStep(`unexpected step error: ${e.message}`);
  }
  console.log(`VERIFY ${id} ${outcome.status} ${outcome.msg}`);
  results.push([id, outcome.status]);
  if (outcome.status === 'INFRA') skipRest = true;
}

const passN = results.filter(([, s]) => s === 'PASS').length;
const redN = results.filter(([, s]) => s === 'RED').length;
const infraN = results.filter(([, s]) => s === 'INFRA').length;
console.log(`VERIFY-SUMMARY stage=${STAGE} steps=${results.length} pass=${passN} red=${redN} infra=${infraN}`);

if (infraN > 0) {
  console.log('VERIFY VERDICT: INCONCLUSIVE exit=3 (infrastructure/refusal — never green, never red)');
  process.exit(3);
}
if (redN > 0) {
  console.log(`VERIFY VERDICT: NOT-ACCEPTED exit=1 (RED steps: ${results.filter(([, s]) => s === 'RED').map(([id]) => id).join(', ')})`);
  process.exit(1);
}
// F-H2: a filtered --step run only proves the steps that ran — never claim the stage.
// Bounded temporal trust repair: when the run carried the paired expected-inputs data
// context, a fully green S3/S4 result is a CONDITIONAL data-validation PASS for the pinned
// scope only — it never mints independent Root/S4 acceptance, which remains its own Root
// native invocation. Without the pair, the S3/S4 externally dependent certificates had
// already failed closed above, so an ACCEPTED verdict can only be reached here WITH it.
if (results.length === activeSteps.length) {
  if (EXPECTED_INPUTS !== null && (STAGE === 'S3' || STAGE === 'S4')) {
    console.log(`VERIFY VERDICT: CONDITIONAL-DATA-PASS exit=0 (stage ${STAGE}: every registered replay matched under the caller-pinned expected inputs; conditional data-validation scope ONLY — not independent Root acceptance, which stays a separate Root native act)`);
  } else {
    console.log(`VERIFY VERDICT: ACCEPTED exit=0 (stage ${STAGE}: every registered replay matched its frozen expectation in this invocation)`);
  }
} else {
  console.log(`VERIFY VERDICT: PARTIAL-ACCEPTED exit=0 (stage ${STAGE}: ${results.length}/${activeSteps.length} steps ran via --step filter and all matched; the stage-level verdict requires an unfiltered run)`);
}
process.exit(0);
