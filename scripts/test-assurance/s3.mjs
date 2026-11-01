#!/usr/bin/env node
// S3/S4 acceptance-layer module — test-assurance kernel stage S3 (spec §8–§10, kickoff-s3/s4).
// v2 ROOT rework (ROOT-S3-R1/R2/R5, ROOT-S4-R3/R4/R6/R7, root review b879, 2026-10-31).
// Node-builtin-only module over existing adapter primitives; verify.mjs keeps the CLI/exit
// grammar and imports this for S3/S4 routing plus additive post-S2 inventory consumption.
//
// ROOT repairs owned here:
//  R1 performance acceptance consumes ONLY a fully bound real record: exact frozen role
//     literals, measured optimized Git head with evidence-only equivalence, both stdout+stderr
//     raw logs sha-verified from the committed evidence tree, per-workload native population
//     counts re-parsed from the raw bytes and matched to the workload contract, raw-index 1:1
//     cross-check with argv/host/tool bindings and unique interleaving sequence. 24 invented
//     numbers + one fake log + a random stderr pin can never pass.
//  R2 final acceptance keeps FIXED required historical obligation identities (an empty or
//     user-emptied registry can never close them), closure needs on-disk closure evidence,
//     and the CI branch requires an ACTUAL typed ci-record receipt with success conclusions —
//     a declared path of the wrong kind or an absent file never satisfies it.
//  R3 sourceSignature hashes the ACTUAL live file bytes (repoRoot is used), and the S4 gate
//     validates every live pin BEFORE any receipt is considered, so changed/missing live code
//     invalidates old receipts instead of re-blessing unchanged ledger declarations.
//  R4 receipts need positive verdicts, an independent reviewer session distinct from the
//     author session, provenance artifact on disk, real CI success conclusions, and a
//     manifest-row-bound install record. REVISE/failed-CI/self-session/arbitrary-file refuse.
//  R5 the companion step binds the exact required test-identity population and reconciles
//     plan/entries/summary/normal completion; a passing subset, duplicates, truncation,
//     skips or inconsistent counts refuse.
//  R6 measured-code binding: receipts bind the MEASURED code head; the gate accepts an
//     evidence-only Git descendant whose scoped source blobs are byte-identical
//     (codeScopeEquivalent), instead of demanding the moving current HEAD.
//  R7 the s4EvidenceIndex is a typed bounded enumeration admitted into the additive
//     inventory: every allowed future S4 file is an exact pinned object entry; unknown,
//     missing, renamed, deleted, duplicate or symlink-escaping paths refuse everywhere.
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

export const S3_LEDGER_REL = 'docs/test-assurance-kernel/s3/scope-extension.json';
export const S3_POLICY_REL = 'docs/test-assurance-kernel/s3/frozen-policy.json';
export const S3_PERF_REL = 'docs/test-assurance-kernel/s3/performance.json';
export const S3_RAWINDEX_REL = 'docs/test-assurance-kernel/s3/raw-index.json';
export const S3_COVERAGE_REL = 'docs/test-assurance-kernel/s3/coverage.json';
export const ANCHORED_HEAD = '932ef452c5e9639293eb8c0d17e443b4d2acf6f1';
export const ANCHORED_TREE = '4ca080adc480be6972d9adce9b1faadbb619e4e4';
export const S2_RULING_PATH = 'docs/test-assurance-kernel/s2/final-scope-ruling.json';
export const S4_NAMESPACE = 'docs/test-assurance-kernel/s4/';
export const S4_REQUIRED_KINDS = ['spec-review', 'quality-review', 'code-signature', 'ci-record', 'install-record', 'performance-record'];
export const OWNER_POLICY_SHA256 = 'ac0889cd7dc3f399866dbbf11200171f6c90cb3cd4887ab71a3dd605a952d1e6';
export const FROZEN_ROLE = { head: '6bd07187e57635d02f8aed5e3560a346ad2748db', tree: '3e602b409f92b21d2683e32a933326fead97afda' };
const S3_SOURCE_NAMES = ['scripts/test-assurance/s3.mjs', 'scripts/test-assurance/s3.test.mjs'];
const S3_EVIDENCE_ROOT = 'docs/test-assurance-kernel/s3/';
const S3_EVIDENCE_EXT = /\.(json|md|log)$/;
const HEX64 = /^[0-9a-f]{64}$/;
const HEX40 = /^[0-9a-f]{40}$/;
const S3_WORKLOADS = ['docs', 'rule', 'kernel', 'fallback'];
const S3_ROLES = ['frozen', 'optimized'];
const DOMINANT_WORKLOAD = 'rule';
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const POSITIVE_VERDICTS = ['ACCEPT', 'ACCEPTED', 'GO', 'PASS'];
export const WORKLOAD_ARGV = {
  docs: ['node', 'scripts/render-reference.mjs', '--check'],
  rule: ['npx', 'vitest', 'run', 'packages/core/principles/44-kickoff-authoring-traps.test.ts'],
  kernel: ['npm', '--workspace', 'packages/core', 'run', 'test:canonical'],
  fallback: ['npx', 'vitest', 'run', 'packages/core/principles'],
};
export const EXPECTED_POPULATION = {
  rule: { kind: 'vitest', files: 1, tests: 7, skippedMax: 0 },
  kernel: { kind: 'node-test', tests: 52, pass: 52, fail: 0, skipped: 0, todo: 0, cancelled: 0 },
  'fallback|frozen': { kind: 'vitest', files: 57, tests: 668, skippedMax: 1 },
  'fallback|optimized': { kind: 'vitest', files: 60, tests: 757, skippedMax: 1 },
  docs: { kind: 'nonempty-exit0' },
};
export const REQUIRED_COVERAGE_IDS = ['s0-12-raw-logs', 'cf37-broad-fixture', 'rule-538-to-430.4', 'ci'];
// R1: the ORIGINAL four-fixture campaign contract, byte-pinned from the frozen workload
// contract (WORKLOAD-AND-SOURCE-DATA.json historicalFixture rows). The dated-6673 broad patch
// is a QUALIFIED later comparison, never the original cf37 campaign patch: a matrix that did
// not apply these exact four fixtures is honestly nonPASS, whatever its medians say.
export const ORIGINAL_FIXTURE_SHA256 = {
  docs: 'b924221a5b305ef2a3f1a04111a986681c7ace864161192fe5081e07cef09581',
  rule: '37620188cb4975c06c72bcc4d1e53be56c9394cbe69629fc6aefe2a16cfd98ad',
  kernel: '57081cf2007d4a8c4c5844aa8e66b8ed92bb17cb7d5c28f167ca1cd739c9c546',
  fallback: 'cf37c3629bcfafd54a38cebaaa4588ad426dcfde6a501a886b33019bd729a139',
};
// R5: the frozen companion identity contract. The s3-native-companion step reconciles the
// parsed TAP population against EXACTLY this set — generated from the real suite and updated
// only together with the suite (missing/duplicate/extra identities refuse).
export const REQUIRED_COMPANION_CONTROLS = [
  "F4 one-pair dominant record is INVALID, not PASS",
  "F4 unknown kind is INVALID, never treated as other",
  "F4 exact boundary predicates (owner frozen table)",
  "F3 shape: a well-formed ledger validates clean",
  "F3 unhashed arbitrary runtime path with selfIndexed=true is refused",
  "F3 null/missing hash on any non-ledger path is refused",
  "F3 s3-source outside the exact two names is refused",
  "F3 evidence outside docs/test-assurance-kernel/s3/ and wrong types refused",
  "F3 canonicalized alias duplicate and hygiene faults are refused",
  "F3 pending may declare bounded future EVIDENCE only, never executable source",
  "F3 symlink-parent escape is detected physically",
  "F3 reconcile refuses unregistered live paths and sha drift",
  "ROOT-S4-R7: an exactly enumerated typed s4 file is admitted into the additive inventory (clean positive)",
  "ROOT-S4-R7: unknown s4 live file, deleted declaration, rename and untyped index entries refuse",
  "ROOT-S4-R7: a symlinked s4 file escape is refused physically",
  "F2 a status-label-only record is refused (no cells, no raws, no medians)",
  "F2 23-cell or nonzero-exit records are refused",
  "F2 a genuine well-formed 24-cell record reaches a computed policy verdict (accept path exists)",
  "F2 accept path: matched raw pins + policy-passing numbers validate green end-to-end",
  "ROOT-S3-R1: the fabricated 24-cell construction (one fake stdout, invented pins) refuses at every binding",
  "F1 six minimal fabricated objects never pass the receipt schema",
  "ROOT-S4-R4: REVISE verdicts, failed CI, author-session reuse and arbitrary install files refuse",
  "F1 s4-fail-closed-gate refuses the six-forged-objects evidence set (production consumer)",
  "F1 wrong-signature headSHA (64-hex sha256 form) is refused",
  "F1 full-schema receipts with live binding have a reachable accept path",
  "ROOT-S4-R3: changed live source bytes change the signature and break ledger pins",
  "ROOT-S4-R6: evidence-only descendant with identical scoped source passes; a source change stays RED (real git)",
  "ROOT-S3-R2: an emptied coverage registry and absent/failed CI can never close obligations",
  "poison: a modified expected-verdict table cannot satisfy the consumer (drift caught)",
  "F5 a marker-only text is not a TAP result set",
  "F5 truncated TAP without summary is not accepted",
  "F5 real TAP counts ok/notOk/skip/todo/cancel",
  "F5 an empty selector is not a green companion",
  "ROOT-S3-R5: one-ok subset with plan25/summary25 refuses (identity population is bound)",
  "ROOT-S3-R5: duplicate identities, skipped entries and summary drift refuse",
  "ROOT-S3-R5: a complete consistent TAP with the exact required population passes",
  "UPSTREAM-LINEAGE: the pinned Root-reviewed carrier validates clean and loads byte-identical",
  "UPSTREAM-LINEAGE: legacy no-integration behavior is unchanged when the carrier is absent",
  "UPSTREAM-LINEAGE: an unknown extra or missing reviewed upstream path refuses",
  "UPSTREAM-LINEAGE: forged/foreign upstream commit, tree, blob metadata and byte length refuse",
  "UPSTREAM-LINEAGE: swapped/duplicate admission against the historical scope refuses",
  "UPSTREAM-LINEAGE: malformed or unpinned carrier admission refuses (sha/schema/tuple drift)",
  "UPSTREAM-LINEAGE: wrong ancestry refuses (bc8 not an ancestor of the candidate head)",
  "UPSTREAM-LINEAGE: producer-off inventory/lineage git failure is a refusal, never permissive green",
  "UPSTREAM-LINEAGE: healthy real-repo lineage reconciles the complete reviewed 571-row set",
];

const sha256buf = (buf) => createHash('sha256').update(buf).digest('hex');

// ---- path hygiene (unchanged from e788) --------------------------------------------
export function pathProblems(rel) {
  const bad = [];
  if (typeof rel !== 'string' || rel.length === 0) return ['path not a non-empty string'];
  if (isAbsolute(rel)) bad.push('absolute path');
  if (rel.includes('\0')) bad.push('NUL byte in path');
  if (rel.includes('*')) bad.push('wildcard path');
  const parts = rel.split('/');
  if (parts.some((p) => p === '' || p === '.')) bad.push('empty/./double-separator segment');
  if (parts.includes('..')) bad.push('.. segment');
  if (rel.endsWith('/')) bad.push('trailing separator');
  return bad;
}

export function symlinkEscape(repoRoot, rel) {
  const parts = rel.split('/');
  parts.pop();
  let cur = resolve(repoRoot);
  for (const seg of parts) {
    cur = join(cur, seg);
    let st;
    try { st = lstatSync(cur); } catch { return false; }
    if (st.isSymbolicLink()) return true;
    if (!st.isDirectory()) return true;
  }
  return false;
}

// ---- ledger (R7: typed bounded s4 index) -------------------------------------------
export function validateLedgerShape(ledger) {
  const problems = [];
  if (!ledger || typeof ledger !== 'object') return ['ledger is not an object'];
  if (ledger.schema !== 'tak.s3.scope-extension/v1') problems.push(`unexpected schema ${JSON.stringify(ledger.schema)}`);
  if (typeof ledger.evidenceComplete !== 'boolean') problems.push('evidenceComplete must be boolean');
  const ab = ledger.anchoredBase ?? {};
  if (ab.head !== ANCHORED_HEAD || ab.tree !== ANCHORED_TREE) problems.push('anchoredBase must be the accepted 932ef452/tree4ca080 predecessor');
  if (!Array.isArray(ledger.addedPaths) || ledger.addedPaths.length === 0) problems.push('addedPaths must be a non-empty array');
  const seen = new Map();
  const register = (row, list) => {
    const pp = pathProblems(row?.path);
    if (pp.length) { problems.push(`invalid path entry ${JSON.stringify(row?.path)}: ${pp.join(',')}`); return; }
    const canon = row.path.split('/').filter(Boolean).join('/');
    if (seen.has(canon)) problems.push(`duplicate/canonicalized-alias registration ${row.path} (also ${seen.get(canon)})`);
    seen.set(canon, row.path);
    const self = row.path === S3_LEDGER_REL;
    if (self && row.selfIndexed !== true) problems.push('the ledger path may only appear as the documented selfIndexed entry');
    if (!self && row.selfIndexed === true) problems.push(`selfIndexed is reserved for the exact ledger path, not ${row.path}`);
    if (!['s3-source', 's3-evidence'].includes(row.class)) problems.push(`class ${JSON.stringify(row.class)} not admitted at ${row.path}`);
    if (row.class === 's3-source' && row.path !== S3_LEDGER_REL && !S3_SOURCE_NAMES.includes(row.path)) problems.push(`s3-source class admits only the exact module/test names, not ${row.path}`);
    if (row.class === 's3-evidence' && !row.path.startsWith(S3_EVIDENCE_ROOT)) problems.push(`s3-evidence must live under ${S3_EVIDENCE_ROOT}: ${row.path}`);
    if (row.class === 's3-evidence' && !S3_EVIDENCE_EXT.test(row.path)) problems.push(`s3-evidence type not admitted (json/md/log only): ${row.path}`);
    if (!self && list !== 'pending' && list !== 's4' && !HEX64.test(row.sha256 ?? '')) problems.push(`required HEX64 sha pin missing at ${row.path}`);
    if (!self && (list === 'pending' || list === 's4') && row.sha256 !== undefined && !HEX64.test(row.sha256)) problems.push(`malformed sha pin at ${row.path}`);
    if (list === 'pending' && row.class !== 's3-evidence') problems.push(`pending declaration admits bounded future evidence only, not ${row.class} at ${row.path}`);
    if (list === 'pending' && row.path === S3_LEDGER_REL) problems.push('pending may not include the ledger itself');
  };
  for (const row of ledger.addedPaths ?? []) register(row, 'added');
  for (const row of ledger.declaredPendingEvidence ?? []) register(row, 'pending');
  if (!Array.isArray(ledger.declaredPendingEvidence)) problems.push('declaredPendingEvidence must be an array');
  const idx = ledger.s4EvidenceIndex;
  if (!idx || idx.namespace !== S4_NAMESPACE || !Array.isArray(idx.declaredPaths) || !Array.isArray(idx.allowedKinds)) problems.push('s4EvidenceIndex namespace/declaration shape invalid');
  else {
    // R7: the index ENUMERATES every allowed future S4 file as a typed pinned object.
    for (const entry of idx.declaredPaths) {
      if (!entry || typeof entry.path !== 'string' || pathProblems(entry.path).length || !entry.path.startsWith(S4_NAMESPACE) || !entry.path.endsWith('.json')) {
        problems.push(`s4 index entry must be an exact .json path object under the s4 namespace (no wildcards): ${JSON.stringify(entry?.path ?? entry)}`);
        continue;
      }
      if (!S4_REQUIRED_KINDS.includes(entry.kind)) problems.push(`s4 index entry ${entry.path} has unknown kind ${JSON.stringify(entry.kind)}`);
      if (seen.has(entry.path)) problems.push(`s4 index path also registered elsewhere ${entry.path}`);
      seen.set(entry.path, entry.path);
    }
    for (const k of idx.allowedKinds) if (!S4_REQUIRED_KINDS.includes(k)) problems.push(`unknown s4 evidence kind ${JSON.stringify(k)}`);
  }
  if (!Array.isArray(ledger.modifiedPaths)) problems.push('modifiedPaths must be an array');
  for (const row of ledger.modifiedPaths ?? []) {
    const pp = pathProblems(row?.path);
    if (pp.length || !HEX64.test(row.sha256 ?? '')) { problems.push(`invalid modifiedPaths entry ${JSON.stringify(row?.path)}`); continue; }
    if (seen.has(row.path.split('/').filter(Boolean).join('/'))) problems.push(`path both added and modified ${row.path}`);
  }
  return problems;
}

export function loadScopeExtension(repoRoot) {
  const file = join(repoRoot, S3_LEDGER_REL);
  if (!existsSync(file)) return { ok: false, absent: true, problems: [] };
  let ledger;
  try { ledger = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { return { ok: false, absent: false, problems: [`ledger unreadable: ${e.message}`] }; }
  const problems = validateLedgerShape(ledger);
  if (problems.length) return { ok: false, absent: false, problems };
  return { ok: true, absent: false, ledger, problems: [] };
}

// R7: declared s4 evidence paths participate in the admitted (additive) scope.
export function admittedPaths(ledger) {
  return [
    ...ledger.addedPaths,
    ...(ledger.declaredPendingEvidence ?? []),
    ...((ledger.s4EvidenceIndex?.declaredPaths ?? []).map((e) => ({ path: e.path, class: 's4-evidence-declaration' }))),
  ].map((r) => r.path);
}

export function verifyRegisteredFiles(repoRoot, ledger, problems) {
  const rows = [
    ...ledger.addedPaths,
    ...(ledger.declaredPendingEvidence ?? []),
    ...((ledger.s4EvidenceIndex?.declaredPaths ?? []).map((e) => ({ ...e, pendingLike: true }))),
  ];
  for (const row of rows) {
    const file = join(repoRoot, row.path);
    if (!existsSync(file)) {
      const pending = (ledger.declaredPendingEvidence ?? []).some((r) => r.path === row.path) || row.pendingLike;
      if (pending && !ledger.evidenceComplete) continue;
      problems.push(`registered path absent: ${row.path}`);
      continue;
    }
    if (symlinkEscape(repoRoot, row.path)) { problems.push(`symlink-parent escape refused at ${row.path}`); continue; }
    let st;
    try { st = lstatSync(file); } catch { problems.push(`registered path unstatable: ${row.path}`); continue; }
    if (st.isSymbolicLink() || !st.isFile()) { problems.push(`registered path is not a regular file: ${row.path}`); continue; }
    if (row.selfIndexed === true) continue;
    if (!HEX64.test(row.sha256 ?? '')) { problems.push(`required sha pin missing at landed path ${row.path}`); continue; }
    try { if (sha256buf(readFileSync(file)) !== row.sha256) problems.push(`pinned sha mismatch at ${row.path}`); }
    catch { problems.push(`registered path unreadable: ${row.path}`); }
  }
  for (const row of ledger.modifiedPaths ?? []) {
    const file = join(repoRoot, row.path);
    if (!existsSync(file)) problems.push(`modifiedPaths entry absent on disk: ${row.path}`);
    else { try { if (sha256buf(readFileSync(file)) !== row.sha256) problems.push(`modified path drifted from pinned sha: ${row.path}`); } catch { problems.push(`modified path unreadable: ${row.path}`); } }
  }
}

export function reconcileInventory({ repoRoot, basePaths, rulingPath, livePaths, ledger }) {
  const problems = [...validateLedgerShape(ledger)];
  const base = new Set([...basePaths, rulingPath]);
  const admitted = new Set(admittedPaths(ledger));
  for (const p of admitted) if (base.has(p)) problems.push(`registered path collides with historical scope: ${p}`);
  const expected = new Set([...base, ...admitted]);
  for (const p of livePaths) if (!expected.has(p)) problems.push(`unregistered live path refused: ${p}`);
  for (const p of expected) if (!livePaths.includes(p)) {
    const boundedFuture = (ledger.declaredPendingEvidence ?? []).some((r) => r.path === p)
      || (ledger.s4EvidenceIndex?.declaredPaths ?? []).some((e) => e.path === p);
    if (boundedFuture && !ledger.evidenceComplete) continue;
    problems.push(`registered path missing from live scope: ${p}`);
  }
  verifyRegisteredFiles(repoRoot, ledger, problems);
  return problems;
}

// ---- reviewed upstream integration lineage (2026-11-01 staging delivery) -------------
// The ONLY new canonical admission carrier for the current upstream integration: review
// provenance/data pinned byte-exactly to the Root-reviewed record — not authentication, not
// an OS isolation claim, and never an executor-self-issued expectation. Any byte drift is a
// NEW review, never silently followed. Absent carrier ⇒ byte-identical legacy S1/S2/S3
// behavior (the historical freezes below are not rewritten by this extension).
export const S2_REVIEWED_INTEGRATION_REL = 'docs/test-assurance-kernel/s2/integration-bc8e758d.reviewed.json';
export const S2_REVIEWED_INTEGRATION_SHA256 = 'b055a1e85718336427fe6405d7e1fcd0af1937407fc20ca3b913db12ffe7f052';
export const UPSTREAM_STAGING_HEAD = 'bc8e758d2863aabbaa1062492a142662bdaa11d8';
export const UPSTREAM_STAGING_TREE = 'ab0812465c1f2310bd67592f2cb6aca294d441f2';
export const ACCEPTED_TOPIC_HEAD = 'cf64dd7fb2d52d3eaea5966f9abd0e61717ba981';
export const ACCEPTED_TOPIC_TREE = '36791c84d4e6a5aceb1800f8a4e10bff2136a918';
export const ORIGINAL_S2_BASE_HEAD = '23d67e8e646d5a3416bee697a3461b2439cec477';
export const ORIGINAL_S2_BASE_TREE = '8008fd9a34a96ec0231c753f3cd2eb9bb0ee5f87';
export const PRESERVED_INTEGRATION_INDEX_TREE = '990142aba3179b68cb7c21df835bb361a6eca713';
const HEX40RE = /^[0-9a-f]{40}$/;

export function validateReviewedIntegration(data) {
  const problems = [];
  if (!data || typeof data !== 'object') return ['reviewed integration carrier is not an object'];
  if (data.schema !== 'tak.independent-upstream-integration-expectation-inputs/v1') problems.push(`unexpected carrier schema ${JSON.stringify(data.schema)}`);
  const refs = data.sourceRefs ?? {};
  if (refs.originalS2Base !== ORIGINAL_S2_BASE_HEAD || refs.originalS2BaseTree !== ORIGINAL_S2_BASE_TREE) problems.push('original S2 base tuple mismatch');
  if (refs.upstreamStaging !== UPSTREAM_STAGING_HEAD || refs.upstreamStagingTree !== UPSTREAM_STAGING_TREE) problems.push('upstream staging tuple mismatch');
  if (refs.acceptedTopic !== ACCEPTED_TOPIC_HEAD || refs.acceptedTopicTree !== ACCEPTED_TOPIC_TREE) problems.push('accepted topic tuple mismatch');
  if (refs.actualPreservedIntegrationIndexTree !== PRESERVED_INTEGRATION_INDEX_TREE) problems.push('preserved integration index tree mismatch');
  const cl = data.currentLineageOnlyScope ?? {};
  if (cl.originalAcceptedTopicPaths !== 4232 || cl.stagingPaths !== 4475 || cl.integrationPathsBeforeNewAdmissionCarrier !== 4803) problems.push('lineage path counts must be the reviewed 4232/4475/4803 exact-union record');
  if (cl.newlyUpstreamOriginPaths !== 571) problems.push('newly upstream-origin path count must be the reviewed 571');
  if (cl.exactUnionOfBothTips !== true) problems.push('carrier must record the exact union of both tips');
  if ((cl.removedOriginalOrStagingPaths ?? []).length || (cl.unexpectedBeyondBothTips ?? []).length) problems.push('carrier records removed or beyond-both-tips paths');
  const rows = cl.upstreamAdditions;
  if (!Array.isArray(rows) || rows.length !== 571) return [...problems, 'upstreamAdditions must be the exact reviewed 571-row set'];
  const seen = new Set();
  for (const row of rows) {
    const pp = pathProblems(row?.path);
    if (pp.length || seen.has(row.path)) { problems.push(`invalid or duplicate upstream path ${JSON.stringify(row?.path)}`); continue; }
    seen.add(row.path);
    if (row.kind !== 'blob' || !['100644', '100755', '120000'].includes(row.mode)) problems.push(`upstream entry ${row.path} must be a blob with a regular/executable/symlink git mode`);
    if (!HEX40RE.test(row.gitBlob ?? '')) problems.push(`upstream entry ${row.path} gitBlob must be HEX40`);
    if (!HEX64.test(row.sha256 ?? '')) problems.push(`upstream entry ${row.path} sha256 must be HEX64`);
    if (!Number.isInteger(row.bytes) || row.bytes < 0) problems.push(`upstream entry ${row.path} bytes must be a non-negative integer`);
  }
  const p38 = data.p38IndependentPopulationRenewal;
  if (!Array.isArray(p38?.originalFrozen30) || p38.originalFrozen30.length !== 30) problems.push('p38 renewal must carry the original frozen 30');
  if (!Array.isArray(p38?.upstreamAdded9) || p38.upstreamAdded9.length !== 9) problems.push('p38 renewal must carry the independently reviewed 9');
  if (!Array.isArray(p38?.expectedCurrent39) || p38.expectedCurrent39.length !== 39) problems.push('p38 renewal must carry the exact expected 39');
  const union39 = [...new Set([...(p38?.originalFrozen30 ?? []), ...(p38?.upstreamAdded9 ?? []).map((r) => r?.path)])].sort();
  if (JSON.stringify(union39) !== JSON.stringify([...(p38?.expectedCurrent39 ?? [])].sort())) problems.push('p38 expectedCurrent39 must be exactly original30 + reviewed9');
  const m04 = data.m04IndependentDefaultsRenewal;
  if (m04?.originalCanonicalContractPath !== 'docs/test-assurance-kernel/s2/m04-installed-contract/frozen-installed-contract.json') problems.push('m04 renewal must bind the canonical historical contract path');
  if (m04?.originalCanonicalContractSha256 !== 'a767888e2abe661f4ad38df11d70c3f95304137ecc59df314f92fb039432c1ad') problems.push('m04 renewal must bind the unchanged historical contract sha');
  if (m04?.originalRecordMustRemainUnchanged !== true) problems.push('m04 renewal must require the original record to stay unchanged');
  if (!Array.isArray(m04?.profiles) || m04.profiles.length !== 3) problems.push('m04 renewal must carry all three stacks');
  for (const p of m04?.profiles ?? []) if (!HEX64.test(p?.independentlyDerivedUnionSha256 ?? '')) problems.push(`m04 renewal union hash malformed for ${p?.stack}`);
  return problems;
}

export function loadReviewedIntegration(repoRoot) {
  const file = join(repoRoot, S2_REVIEWED_INTEGRATION_REL);
  if (!existsSync(file)) return { absent: true, ok: false, problems: [] };
  let raw;
  try { raw = readFileSync(file); } catch (e) { return { absent: false, ok: false, problems: [`reviewed integration carrier unreadable: ${e.message}`] }; }
  if (sha256buf(raw) !== S2_REVIEWED_INTEGRATION_SHA256) return { absent: false, ok: false, problems: [`reviewed integration carrier sha drifted from the pinned Root review (${S2_REVIEWED_INTEGRATION_REL}); a changed upstream input needs a new corresponding review, not silent tuple movement`] };
  let data;
  try { data = JSON.parse(raw.toString('utf8')); } catch (e) { return { absent: false, ok: false, problems: [`reviewed integration carrier unparseable: ${e.message}`] }; }
  const problems = validateReviewedIntegration(data);
  if (problems.length) return { absent: false, ok: false, problems };
  return { absent: false, ok: true, data, problems: [] };
}

// Upstream lineage reconciliation: every reviewed upstream-only path must resolve EXACTLY
// against the pinned immutable bc8 commit — ancestry first, then the COMPLETE row set
// (mode/kind/gitBlob through one full ls-tree, byte length per row through cat-file -s).
// A producer failure (non-zero git) is a hard problem, never permissive silence: nothing
// here trusts a count, a mutable manifest, or the live worktree for upstream provenance.
export function reconcileUpstreamLineage({ repoRoot, git, carrier, head, basePaths = [], additivePaths = [] }) {
  if (!carrier?.ok) return ['upstream lineage reconciliation requires a valid reviewed carrier'];
  const problems = [];
  const refs = carrier.data.sourceRefs;
  const upstream = refs.upstreamStaging;
  const ancestor = git(['merge-base', '--is-ancestor', upstream, head ?? 'HEAD']);
  if (ancestor.rc !== 0) problems.push(`upstream staging ${upstream} must be an ancestor of ${head ?? 'HEAD'} (wrong ancestry refuses)`);
  const tree = git(['ls-tree', '-r', '-z', upstream]);
  if (tree.rc !== 0) return [`git cannot resolve the pinned upstream commit ${upstream} (producer-off is a refusal, never a pass)`, ...problems];
  const blobs = new Map();
  for (const entry of tree.stdout.toString('utf8').split('\0').filter(Boolean)) {
    const meta = /^(\d+) (blob|tree|commit) ([0-9a-f]{40})\t(.*)$/s.exec(entry);
    if (meta) blobs.set(meta[4], { mode: meta[1], kind: meta[2], oid: meta[3] });
  }
  const rows = carrier.data.currentLineageOnlyScope.upstreamAdditions;
  const historical = new Set([...basePaths, ...additivePaths, S2_REVIEWED_INTEGRATION_REL]);
  for (const row of rows) {
    if (historical.has(row.path)) problems.push(`upstream path collides with the historical/additive scope (swapped or duplicate admission): ${row.path}`);
    const live = blobs.get(row.path);
    if (!live) { problems.push(`upstream path missing from the pinned upstream tree: ${row.path}`); continue; }
    if (live.mode !== row.mode || live.kind !== row.kind || live.oid !== row.gitBlob) problems.push(`upstream blob metadata mismatch at ${row.path}: reviewed ${row.mode}/${row.kind}/${row.gitBlob} vs pinned-tree ${live.mode}/${live.kind}/${live.oid}`);
    const size = git(['cat-file', '-s', row.gitBlob]);
    if (size.rc !== 0 || Number(size.stdout.toString().trim()) !== row.bytes) problems.push(`upstream blob byte length mismatch at ${row.path}: reviewed ${row.bytes} vs pinned-object ${size.rc === 0 ? size.stdout.toString().trim() : 'unresolvable'}`);
  }
  return problems;
}

// ---- metric policy (frozen arithmetic unchanged) ------------------------------------
export function evaluateMetricTrial({ base, current, kind, trials = 3 }) {
  const invalid = (reason) => ({ verdict: 'INVALID', reason });
  if (kind !== 'dominant' && kind !== 'other') return invalid(`unknown kind ${JSON.stringify(kind)} — only dominant|other are defined`);
  if (!Array.isArray(base) || !Array.isArray(current)) return invalid('trials must be arrays');
  if (base.length === 0 || current.length === 0) return invalid('empty trial selection is never green');
  if (base.length !== trials || current.length !== trials) return invalid(`exact ${trials} normal trials per side required (got base=${base.length} current=${current.length}); a one-pair record is not a normal trial set`);
  for (const arr of [base, current]) for (const v of arr) if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return invalid('non-positive or non-finite duration');
  const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const b = median(base); const c = median(current);
  if (kind === 'dominant') {
    if ((b - c) * 100 >= 20 * b) return { verdict: 'PASS', reason: `dominant median ${b} -> ${c} (>=20% reduction)` };
    return { verdict: 'RED', reason: `dominant median ${b} -> ${c} is below the 20% reduction floor` };
  }
  const allowed = Math.max(5 * b, 100000);
  if ((c - b) * 100 <= allowed) return { verdict: 'PASS', reason: `regression ${c - b}ms within max(5%,1000ms) at median ${b} -> ${c}` };
  return { verdict: 'RED', reason: `regression ${c - b}ms exceeds max(5%,1000ms) at median ${b} -> ${c}` };
}

export function evaluatePureCases(policy) {
  return (policy.pureMetricCases ?? []).map((c) => {
    const got = evaluateMetricTrial({ base: c.base, current: c.current, kind: c.kind });
    return { id: c.id, expected: c.expected, got: got.verdict, reason: got.reason, ok: got.verdict === c.expected };
  });
}

// ---- native population parsing (R1) -------------------------------------------------
export function parseNativeCounts(workload, stdout) {
  const text = String(stdout ?? '').replace(/\u001b\[[0-9;]*m/g, '');
  if (workload === 'docs') return { kind: 'nonempty-exit0', nonempty: text.trim().length > 0 };
  if (workload === 'rule' || workload === 'fallback') {
    const files = /Test Files\s+(\d+)\s+passed/.exec(text);
    const tests = /Tests\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s*skipped)?/.exec(text);
    const failed = /(?:Tests|Test Files)\s+(\d+)\s+failed/.exec(text);
    if (!files || !tests) return null;
    return { kind: 'vitest', files: Number(files[1]), tests: Number(tests[1]), skipped: Number(tests[2] ?? 0), failed: Number(failed?.[1] ?? 0) };
  }
  if (workload === 'kernel') {
    const out = { kind: 'node-test' };
    for (const m of text.matchAll(/[ℹ#]\s*(tests|suites|pass|fail|cancelled|skipped|todo)\s+(\d+)/g)) out[m[1]] = Number(m[2]);
    if (!('tests' in out) || !('pass' in out)) return null;
    return out;
  }
  return null;
}

function populationProblems(workload, role, parsed) {
  const exp = workload === 'fallback' ? EXPECTED_POPULATION['fallback|' + role] : EXPECTED_POPULATION[workload];
  if (!parsed) return [`workload ${workload} raw output carries no parsable native population`];
  if (exp.kind === 'nonempty-exit0') return parsed.nonempty ? [] : [`workload docs raw output is empty`];
  if (exp.kind === 'vitest') {
    if (parsed.files !== exp.files || parsed.tests !== exp.tests) return [`${workload}/${role}: native population files=${parsed.files} tests=${parsed.tests} does not match the workload contract (${exp.files}/${exp.tests})`];
    if (parsed.failed) return [`${workload}/${role}: ${parsed.failed} native failures in raw output`];
    if (parsed.skipped > exp.skippedMax) return [`${workload}/${role}: skipped ${parsed.skipped} above the role bound ${exp.skippedMax}`];
    return [];
  }
  const p = [];
  if (parsed.tests !== exp.tests || parsed.pass !== exp.pass) p.push(`kernel native population tests=${parsed.tests} pass=${parsed.pass} != contract 52/52`);
  for (const k of ['fail', 'skipped', 'todo', 'cancelled']) if ((parsed[k] ?? 0) !== 0) p.push(`kernel has nonzero ${k}=${parsed[k]}`);
  return p;
}

// ---- performance record + raw index (R1) ---------------------------------------------
export function validatePerformanceRecord(perf, repoRoot, opts = {}) {
  const problems = [];
  if (!perf || typeof perf !== 'object') return { ok: false, problems: ['performance record is not an object'] };
  if (perf.status !== 'COMPLETE-24CELLS') problems.push(`status ${JSON.stringify(perf.status)} is not a complete 24-cell record`);
  // Exact frozen role literals: invented head/tree tokens refuse.
  const fr = perf?.roles?.frozen ?? {};
  if (fr.head !== FROZEN_ROLE.head || fr.tree !== FROZEN_ROLE.tree) problems.push(`roles.frozen must be the exact frozen measurement view ${FROZEN_ROLE.head}/${FROZEN_ROLE.tree}`);
  const op = perf?.roles?.optimized ?? {};
  if (!HEX40.test(op.head ?? '')) problems.push('roles.optimized.head must be the measured Git-40 code commit');
  if (!HEX40.test(op.tree ?? '') && !HEX64.test(op.tree ?? '')) problems.push('roles.optimized.tree missing/malformed');
  if (!Array.isArray(perf.cells) || perf.cells.length !== 24) { problems.push(`cells must number exactly 24 (got ${perf?.cells?.length ?? 0})`); return { ok: false, problems }; }
  let rawIndex = null;
  const rawIndexFile = repoRoot ? join(repoRoot, S3_RAWINDEX_REL) : null;
  if (!rawIndexFile || !existsSync(rawIndexFile)) problems.push(`raw index missing (${S3_RAWINDEX_REL}) — cells without a bound collector record are unverifiable`);
  else { try { rawIndex = JSON.parse(readFileSync(rawIndexFile, 'utf8')); } catch (e) { problems.push(`raw index unreadable: ${e.message}`); } }
  const byKey = new Map((rawIndex?.cells ?? []).map((c) => [`${c.workload}|${c.role}|t${c.trial}`, c]));
  if (rawIndex && (rawIndex.cells ?? []).length !== 24) problems.push(`raw index must carry exactly 24 cells (got ${(rawIndex.cells ?? []).length})`);
  if (rawIndex && (rawIndex.frozen?.head !== FROZEN_ROLE.head || rawIndex.frozen?.tree !== FROZEN_ROLE.tree)) problems.push('raw index frozen role literals do not match the frozen measurement view');
  if (rawIndex && rawIndex.optimized?.head !== op.head) problems.push('raw index optimized head differs from the performance record');
  if (rawIndex && rawIndex.host !== 'darwin') problems.push(`raw index host ${JSON.stringify(rawIndex.host)} is not the measured darwin host`);
  if (rawIndex && (!rawIndex.tools?.node || !rawIndex.tools?.vitest)) problems.push('raw index lacks node/vitest tool bindings');
  // R1: NATIVE tool bindings. Two editable copies repeating invented labels are not tool
  // identity: the validator itself runs on the exact measured node, and the measured vitest
  // is read from the live tree. Fake labels cannot match both at once.
  if (rawIndex && rawIndex.tools?.node !== process.version) problems.push(`raw index node binding ${JSON.stringify(rawIndex.tools?.node)} does not match the live native node ${process.version}`);
  if (rawIndex && repoRoot) {
    let vitestLive = null;
    try { vitestLive = JSON.parse(readFileSync(join(repoRoot, 'node_modules/vitest/package.json'), 'utf8')).version; } catch { /* reported below */ }
    if (!vitestLive) problems.push('installed vitest identity unreadable — the tool binding cannot be established');
    else if (rawIndex.tools?.vitest !== vitestLive) problems.push(`raw index vitest binding ${JSON.stringify(rawIndex.tools?.vitest)} does not match the installed vitest ${vitestLive}`);
  }
  // R1: retained collector-journal binding. Admitted timings must repeat the ACTUAL retained
  // native timing/command record produced by the admitted collector — not a second editable
  // copy of themselves. The journal is sha-pinned evidence on disk, with its argv literals,
  // per-cell wallMs/exit, three clean reversed fixture blocks and no early stop.
  const campaign = rawIndex?.campaign ?? {};
  const journalOk = typeof campaign.journalPath === 'string' && campaign.journalPath.startsWith(S3_EVIDENCE_ROOT) && HEX64.test(campaign.journalSha256 ?? '');
  if (!journalOk) problems.push('raw index lacks the retained collector-journal binding (campaign.journalPath under the evidence root + campaign.journalSha256)');
  else if (repoRoot) {
    try {
      const jbytes = readFileSync(join(repoRoot, campaign.journalPath));
      if (sha256buf(jbytes) !== campaign.journalSha256) problems.push(`collector journal sha mismatch at ${campaign.journalPath}`);
      else {
        const jr = JSON.parse(jbytes.toString('utf8'));
        const jmap = new Map((jr.cells ?? []).map((c) => [`${c.workload}|${c.role}|t${c.trial}`, c]));
        if ((jr.cells ?? []).length !== 24) problems.push(`collector journal carries ${(jr.cells ?? []).length} cells, expected 24`);
        if (jr.stoppedEarly) problems.push('collector journal records an early-stopped campaign — partial campaigns are never accepted');
        const blocks = jr.fixtureBlocks ?? [];
        if (blocks.length !== 3 || blocks.some((b) => !b.reversedUtc || !b.frozenClean || !b.optimizedCleanOutsideEvidence)) problems.push('collector journal lacks 3 fully clean reversed fixture blocks (c9 semantics)');
        for (const cell of perf.cells) {
          const key = `${cell?.workload}|${cell?.role}|t${cell?.trial}`;
          const jCell = jmap.get(key);
          if (!jCell) { problems.push(`cell ${key} has no collector journal record`); continue; }
          if (jCell.wallMs !== cell.wallMs) problems.push(`cell ${key} wallMs does not repeat the retained journal timing`);
          if (jCell.exitCode !== cell.exitCode) problems.push(`cell ${key} exit does not repeat the retained journal record`);
          if (JSON.stringify(jCell.argv) !== JSON.stringify(WORKLOAD_ARGV[cell.workload])) problems.push(`collector journal argv is not the workload contract literal for ${cell.workload}`);
        }
      }
    } catch (e) { problems.push(`collector journal unreadable: ${e.message}`); }
    // R1: the ORIGINAL four-fixture campaign contract. A dated/partial fixture set is a
    // qualified comparison and stays nonPASS — it can never silently stand in for the
    // original fixture-defined campaign.
    const fx = campaign.fixtures ?? {};
    const off = S3_WORKLOADS.filter((w) => fx[w] !== ORIGINAL_FIXTURE_SHA256[w]);
    if (off.length) problems.push(`original four-fixture campaign NOT established — fixture sha for ${off.join(', ')} is not the original contract patch (a dated/partial comparison is a qualified comparison, not the campaign)`);
  }
  // R1: exact Git-object bindings for BOTH role graphs — real commits, real trees, live
  // ancestry. Invented optimized heads/trees (or a frozen literal that left this repository's
  // history) refuse before any median is even considered.
  if (!opts?.git) problems.push('performance record cannot be bound to real Git objects without a git runner — an unanchored record is never accepted');
  else {
    for (const [role, head, tree] of [['frozen', FROZEN_ROLE.head, FROZEN_ROLE.tree], ['optimized', op.head, op.tree]]) {
      const ex = opts.git(['cat-file', '-e', `${head}^{commit}`, '--']);
      if (ex.rc !== 0) { problems.push(`roles.${role}.head ${head} does not exist as a commit in this repository`); continue; }
      const t = opts.git(['rev-parse', `${head}^{tree}`]);
      if (String(t.stdout ?? '').trim() !== tree) problems.push(`roles.${role}.tree does not match the commit's actual tree object`);
      const anc = opts.git(['merge-base', '--is-ancestor', head, 'HEAD']);
      if (anc.rc !== 0) problems.push(`roles.${role}.head is not an ancestor of the live HEAD — not a measured graph of this repository`);
    }
  }
  // Bounded temporal trust repair (Root56810c70): the QUALIFICATION of the measurement
  // campaign is an externally dependent fact. It comes only from an EXPLICIT descriptor
  // independently selected by the caller — never from candidate fields, the ledger, the
  // datafile path/hash, process.env or argv. The descriptor pins the exact admitted artifact
  // bytes (performance record, raw index, retained journal, all 48 raw streams) and states
  // the admission. Three editable copies repeating known fixture labels stay exactly what
  // the descriptor says they are: OBSERVED_UNQUALIFIED_RED refuses even when every retained
  // byte matches; new/edited copies refuse on the byte pins.
  const facts = expectedFacts(opts?.expectedInputs);
  if (!facts) problems.push('no independently selected expected inputs were provided — the external qualification of the measurement campaign fails closed (candidate bytes can never self-qualify)');
  else {
    const exp = facts.S3_PERFORMANCE ?? {};
    const admission = exp.admission ?? 'UNSPECIFIED';
    if (admission !== EXPECTED_ADMISSIONS.performance) problems.push(`independently selected expected inputs classify the performance record as ${admission}${exp.qualifiedOriginalFourFixtureCampaign === false ? ' (qualifiedOriginalFourFixtureCampaign=false)' : ''} — the exact retained 24-cell record stays nonPASS even with byte-identical evidence; no qualified acquisition exists`);
    if (repoRoot) {
      const pins = [
        ['performance record', exp.performance],
        ['raw index', exp.rawIndex],
        ['retained journal', exp.retainedJournal],
        ...Array.isArray(exp.rawStreams) ? exp.rawStreams.map((s, i) => [`raw stream ${s?.relative ?? i + 1}`, s]) : [],
      ];
      for (const [label, pin] of pins) {
        if (!pin || typeof pin.relative !== 'string' || !HEX64.test(pin.sha256 ?? '')) { problems.push(`expected-inputs pin for the ${label} is missing/malformed — the admitted bytes cannot be established`); continue; }
        try {
          const b = readFileSync(join(repoRoot, pin.relative));
          if (sha256buf(b) !== pin.sha256) problems.push(`${label} bytes differ from the independently admitted pin (${pin.relative}) — an edited or new copy is not the admitted record`);
        } catch { problems.push(`independently admitted ${label} is absent from this tree (${pin.relative})`); }
      }
    }
  }
  const seen = new Set();
  const seqs = [];
  const medians = {};
  for (const w of S3_WORKLOADS) medians[w] = {};
  for (const cell of perf.cells) {
    const key = `${cell?.workload}|${cell?.role}|t${cell?.trial}`;
    if (!S3_WORKLOADS.includes(cell?.workload) || !S3_ROLES.includes(cell?.role)) { problems.push(`unknown workload/role in cell ${key}`); continue; }
    if (!Number.isInteger(cell?.trial) || cell.trial < 1 || cell.trial > 3) { problems.push(`trial out of 1..3 in cell ${key}`); continue; }
    if (seen.has(key)) problems.push(`duplicate cell ${key}`);
    seen.add(key);
    if (cell.exitCode !== 0) problems.push(`cell ${key} exit ${cell.exitCode} — a nonzero native cell is never performance evidence`);
    if (!(cell.wallMs > 0) || !Number.isFinite(cell.wallMs)) problems.push(`cell ${key} wallMs not positive-finite`);
    // R1: BOTH streams must be committed evidence files, sha-verified, and the stdout must
    // re-parse to the contract population. A shared fake stdout or an absent stderr refuses.
    for (const stream of ['stdout', 'stderr']) {
      const p = cell[`${stream}Path`];
      if (typeof p !== 'string' || !p.startsWith(S3_EVIDENCE_ROOT)) { problems.push(`cell ${key} ${stream} path must be a committed evidence path`); continue; }
      if (typeof cell[`${stream}Sha256`] !== 'string' || !HEX64.test(cell[`${stream}Sha256`])) { problems.push(`cell ${key} ${stream} sha pin missing/malformed`); continue; }
      try {
        const bytes = readFileSync(join(repoRoot, p));
        if (sha256buf(bytes) !== cell[`${stream}Sha256`]) problems.push(`cell ${key} ${stream} raw sha mismatch`);
      } catch { problems.push(`cell ${key} ${stream} raw log unreadable: ${p}`); }
    }
    try {
      const stdoutBytes = readFileSync(join(repoRoot, cell.stdoutPath));
      const parsed = parseNativeCounts(cell.workload, stdoutBytes.toString('utf8'));
      problems.push(...populationProblems(cell.workload, cell.role, parsed).map((m) => `cell ${key}: ${m}`));
    } catch { /* unreadable stdout already reported above */ }
    const rc = byKey.get(key);
    if (!rc) problems.push(`cell ${key} has no raw-index record`);
    else {
      if (rc.wallMs !== cell.wallMs) problems.push(`cell ${key} wallMs disagrees with the raw-index collector record`);
      if (rc.exitCode !== cell.exitCode) problems.push(`cell ${key} exit disagrees with the raw-index collector record`);
      if (JSON.stringify(rc.argv) !== JSON.stringify(WORKLOAD_ARGV[cell.workload])) problems.push(`cell ${key} argv is not the exact workload contract literal`);
      if (rc.role === undefined || rc.role !== cell.role) problems.push(`cell ${key} raw-index role binding missing`);
      if (Number.isInteger(rc.seq)) seqs.push(rc.seq); else problems.push(`cell ${key} raw-index seq missing`);
    }
    medians[cell.workload][cell.role] = [...(medians[cell.workload][cell.role] ?? []), cell.wallMs];
  }
  if (seqs.length !== 24 || new Set(seqs).size !== 24) problems.push('raw-index seq must be 24 unique interleaving positions');
  for (const w of S3_WORKLOADS) for (const r of S3_ROLES) if (!medians[w][r] || medians[w][r].length !== 3) problems.push(`workload ${w} role ${r} does not have exactly 3 normal trials`);
  const verdicts = {};
  if (!problems.length) {
    for (const w of S3_WORKLOADS) {
      const kind = w === DOMINANT_WORKLOAD ? 'dominant' : 'other';
      const v = evaluateMetricTrial({ base: medians[w].frozen, current: medians[w].optimized, kind });
      verdicts[w] = v;
      if (v.verdict !== 'PASS') problems.push(`policy ${kind} on ${w}: ${v.reason}`);
    }
  }
  return { ok: problems.length === 0, problems, medians, verdicts };
}

// ---- independently selected expected inputs (bounded temporal trust repair) -----------
// What counts as ACCEPTED on the four externally dependent surfaces (performance
// qualification, historical closure, ordered accepted predecessors, native receipts) comes
// from an EXPLICIT descriptor independently selected by the caller (Root native invocation
// with a new immutable pin). Candidate fields, closureEvidence, the ledger, the datafile
// path/hash, process.env and argv can NEVER select, extend or rewrite that map; a missing
// descriptor fails every externally dependent acceptance closed. A byte/identity match
// under the descriptor is a CONDITIONAL data-validation match for its pinned scope only —
// it never mints independent Root/S4 acceptance, which stays its own native step.
const EXPECTED_ADMISSIONS = {
  performance: 'QUALIFIED_NATIVE_GREEN',
  s0_12: 'RETRIEVED_NATIVE',
  cf37: 'OBSERVED_RED_RETAINED',
  rule538: 'MET_NATIVE',
  ci: 'ACQUIRED_NATIVE',
  s2Predecessor: 'ACCEPTED_FOR_ITS_EXACT_COVERED_SUBJECT_ONLY',
  s3Predecessor: 'ACCEPTED_NATIVE',
  specReview: 'ACCEPTED_NATIVE',
  install: 'INSTALLED_NATIVE',
};
function expectedFacts(expectedInputs) {
  return expectedInputs && typeof expectedInputs === 'object' && expectedInputs.facts && typeof expectedInputs.facts === 'object' ? expectedInputs.facts : null;
}

// ---- measured-code binding (R3/R6) ---------------------------------------------------
// R3: the signature hashes ACTUAL live bytes — repoRoot is load-bearing.
export function sourceSignature(repoRoot, ledger) {
  const rows = [...ledger.addedPaths.filter((r) => r.class === 's3-source'), ...ledger.modifiedPaths]
    .map((r) => [r.path, sha256buf(readFileSync(join(repoRoot, r.path)))])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return sha256buf(JSON.stringify(rows));
}

// R6: an evidence-only Git descendant of the measured head whose scoped source blobs are
// byte-identical preserves the measured code; a source change never does.
export function codeScopeEquivalent(git, measuredHead, ledger) {
  const scoped = [...ledger.addedPaths.filter((r) => r.class === 's3-source'), ...ledger.modifiedPaths].map((r) => r.path);
  const run = (args) => git(args);
  const exists = run(['cat-file', '-e', `${measuredHead}^{commit}`, '--']);
  if (exists.rc !== 0) return { ok: false, reason: `measured code head ${measuredHead} does not exist as a commit` };
  const anc = run(['merge-base', '--is-ancestor', measuredHead, 'HEAD']);
  if (anc.rc !== 0) return { ok: false, reason: `measured code head ${measuredHead} is not an ancestor of the current HEAD` };
  const diff = run(['diff', '--name-only', measuredHead, 'HEAD']);
  if (diff.rc !== 0) return { ok: false, reason: 'git diff of the evidence-only range failed' };
  const changed = String(diff.stdout ?? '').split('\n').filter(Boolean);
  const outside = changed.filter((p) => !p.startsWith(S3_EVIDENCE_ROOT) && !p.startsWith(S4_NAMESPACE));
  if (outside.length) return { ok: false, reason: `non-evidence changes after the measured head: ${outside.slice(0, 4).join(', ')}` };
  for (const p of scoped) {
    const a = run(['rev-parse', `${measuredHead}:${p}`]);
    const b = run(['rev-parse', `HEAD:${p}`]);
    if (a.rc !== 0 || b.rc !== 0 || String(a.stdout).trim() !== String(b.stdout).trim()) return { ok: false, reason: `scoped source ${p} differs between the measured head and HEAD` };
  }
  return { ok: true, reason: `evidence-only descendant of ${measuredHead} with ${scoped.length} scoped source blobs identical` };
}

// ---- S4 receipts (R4) ----------------------------------------------------------------
export function evaluateReceipt(rel, receipt, kind, ctx) {
  const p = [];
  if (receipt?.kind !== kind) p.push(`${rel} declares kind ${JSON.stringify(receipt?.kind)}, expected ${kind}`);
  const reviewer = receipt?.reviewer; const author = receipt?.author;
  if (typeof reviewer !== 'string' || reviewer.trim().length < 3) p.push(`${rel} reviewer identity missing`);
  if (typeof author !== 'string' || author.trim().length < 3) p.push(`${rel} author identity missing`);
  if (reviewer && author && reviewer === author) p.push(`${rel} is an author-self receipt — independent fresh review required`);
  const authorSession = receipt?.identityProof?.sessionId;
  const reviewerSession = receipt?.reviewerProof?.sessionId;
  if (!authorSession || typeof authorSession !== 'string' || authorSession.length < 8) p.push(`${rel} lacks an author session identity proof`);
  if (!reviewerSession || typeof reviewerSession !== 'string' || reviewerSession.length < 8) p.push(`${rel} lacks an independent reviewer session proof`);
  if (authorSession && reviewerSession && authorSession === reviewerSession) p.push(`${rel} reuses the author session as the reviewer proof — not independent`);
  // R4: only positive verdicts certify; REVISE/BLOCK/REJECT never do.
  const verdict = String(receipt?.verdict ?? '').toUpperCase();
  if (!POSITIVE_VERDICTS.includes(verdict)) p.push(`${rel} verdict ${JSON.stringify(receipt?.verdict)} is not a positive certification (REVISE/BLOCK/REJECT refuse)`);
  if (receipt?.codeSHA !== ctx.sourceSignature) p.push(`${rel} codeSHA is not bound to the actual live source signature`);
  const head = receipt?.headSHA;
  if (!HEX40.test(head ?? '')) p.push(`${rel} measured code head must be a Git-40 commit id`);
  else if (ctx.git) {
    const eq = codeScopeEquivalent((args) => ctx.git(args), head, ctx.ledger);
    if (!eq.ok) p.push(`${rel} measured code head not preserved: ${eq.reason}`);
  } else if (ctx.headSHA && head !== ctx.headSHA) p.push(`${rel} measured code head does not equal the live HEAD commit`);
  const prov = receipt?.provenance ?? {};
  if (typeof prov.path !== 'string' || !(prov.path.startsWith(S3_EVIDENCE_ROOT) || prov.path.startsWith(S4_NAMESPACE)) || !HEX64.test(prov.sha256 ?? '')) p.push(`${rel} lacks a provenance artifact binding (path under the evidence namespaces + sha256)`);
  else if (ctx.repoRoot) {
    try { if (sha256buf(readFileSync(join(ctx.repoRoot, prov.path))) !== prov.sha256) p.push(`${rel} provenance artifact sha mismatch at ${prov.path}`); }
    catch { p.push(`${rel} provenance artifact unreadable: ${prov.path}`); }
  }
  const anchor = receipt?.artifact ?? {};
  const hex = (v) => typeof v === 'string' && HEX64.test(v);
  if (kind === 'spec-review' || kind === 'quality-review') {
    // Bounded temporal trust repair: an externally dependent review receipt additionally
    // requires the independently selected expected inputs to admit THIS review — actual
    // reviewer identity, session and verdict come from the fixed descriptor, not from the
    // receipt. Schema strings and a recomputed public diff sha are structural fields, not
    // origin; the current Root record is REVISE and the quality review is MISSING.
    const factsR = expectedFacts(ctx?.expectedInputs);
    const er = kind === 'spec-review' ? factsR?.INDEPENDENT_SPEC_REVIEW : factsR?.INDEPENDENT_QUALITY_REVIEW;
    if (!factsR) p.push(`${rel} has no independently selected expected inputs — an externally dependent review receipt fails closed`);
    else if (!er || er.admission !== EXPECTED_ADMISSIONS.specReview) p.push(`${rel}: independently selected expected inputs record the ${kind} as ${(er?.admission ?? 'MISSING')} — a local schema string and a recomputed patch sha are structural fields, not review origin`);
    else if (!er.actualReviewRecord || typeof er.actualReviewRecord.reviewer !== 'string' || typeof er.actualReviewRecord.reviewerSession !== 'string' || String(receipt?.reviewer) !== er.actualReviewRecord.reviewer || String(reviewerSession) !== er.actualReviewRecord.reviewerSession || String(anchor?.verdict ?? '').toUpperCase() !== String(er.actualReviewRecord.verdict ?? '').toUpperCase()) p.push(`${rel} reviewer identity/session/verdict does not match the independently selected actual review record`);
    // R4 (Root 973 R4-review-subject): identity/session/verdict alone never transfer a
    // review, and neither does ONE identity coordinate. The accepted review's EXACT subject —
    // measured head AND the actually reviewed patch/scope — comes from the independently
    // selected actual record. At the same head that record's reviewed patch must itself
    // resolve to the required scope sha256(diff anchoredBase..head) and the receipt must
    // carry exactly that patch — a different/partial actually reviewed patch at the same
    // head never covers the required subject. At a different head the ONLY legitimate reuse
    // is genuine evidence-only code equivalence over the covered scoped sources (the
    // accepted R6 algorithm, unchanged) — never a bare OR on head/patch, never naked
    // ancestry.
    else if (typeof er.actualReviewRecord.headSHA !== 'string' || !HEX40.test(er.actualReviewRecord.headSHA ?? '') || !hex(er.actualReviewRecord.reviewedPatchSha256 ?? '')) p.push(`${rel} independently selected actual review record lacks its measured subject (headSHA/reviewedPatchSha256)`);
    else {
      const expHead = String(er.actualReviewRecord.headSHA);
      const expPatch = String(er.actualReviewRecord.reviewedPatchSha256 ?? '');
      // Root ebd77271 (common review-scope repair): the ACTUAL expected accepted review must
      // have covered the required FULL reviewed scope AT ITS OWN accepted measured head
      // BEFORE any same-head vs evidence-only-descendant reuse decision — the independently
      // selected record's actually reviewed patch must itself resolve to the required scope
      // sha256(diff anchoredBase..accepted head). R6 code equivalence transfers only
      // ALREADY_VALID full coverage; it can never upgrade a partial accepted review into
      // full coverage, so a partial/different actually reviewed scope refuses in BOTH
      // branches (same-head and evidence-only descendant alike), while genuinely full old
      // reviews stay reusable over unchanged covered code — new evidence-only docs never
      // falsely invalidate a valid old full code review.
      let requiredPatch = null;
      if (ctx.git && ctx.ledger?.anchoredBase?.head) {
        const rd = ctx.git(['diff', `${ctx.ledger.anchoredBase.head}..${expHead}`, '--']);
        if (rd.rc === 0) requiredPatch = sha256buf(Buffer.from(String(rd.stdout ?? ''), 'utf8'));
      }
      if (requiredPatch === null) p.push(`${rel} accepted review subject cannot be resolved to the required full reviewed scope without a git runner and the anchored base — review reuse fails closed`);
      else if (expPatch !== requiredPatch) p.push(`${rel} review subject does not match the independently selected actual review record (the accepted record's actually reviewed patch is not the required full reviewed scope sha256(diff anchoredBase..accepted head) — a partial/different actually reviewed patch/scope at its own accepted head never covers the required subject, in the same-head and evidence-descendant branches alike)`);
      else if (String(head ?? '') === expHead) {
        if (String(anchor?.reviewedPatchSha256 ?? '') !== expPatch) p.push(`${rel} review subject does not match the independently selected actual review record (receipt head equals the accepted head but reviewedPatchSha256 is not the actually reviewed patch — matching one identity coordinate does not cover a different actually reviewed patch/scope)`);
      } else {
        const eq = ctx.git
          ? codeScopeEquivalent((args) => ctx.git(args), expHead, ctx.ledger)
          : { ok: false, reason: 'no git runner — covered source equivalence cannot be established' };
        if (!eq.ok) p.push(`${rel} review subject does not match the independently selected actual review record (receipt head ${head} vs accepted ${expHead}; covered-source equivalence refused: ${eq.reason}) — replaying an accepted review identity onto changed code/source refuses`);
      }
    }
    // R4: reviews certify only through the EXISTING native root-review contract, and the
    // reviewed patch is what the validator itself computes from the anchored base to the
    // receipt head — an invented sha or a foreign schema is arbitrary local text, not a review.
    if (receipt?.schema !== 'getff.root.affected-review/v1') p.push(`${rel} does not carry the native root-review schema (getff.root.affected-review/v1) — arbitrary local text is not an independent review receipt`);
    if (!hex(anchor.reviewedPatchSha256)) p.push(`${rel} lacks the reviewed-patch sha anchor`);
    else if (ctx.git && ctx.ledger?.anchoredBase?.head && HEX40.test(head ?? '')) {
      const diff = ctx.git(['diff', `${ctx.ledger.anchoredBase.head}..${head}`, '--']);
      if (diff.rc !== 0) p.push(`${rel} reviewed patch cannot be recomputed from ${ctx.ledger.anchoredBase.head}..${head}`);
      else {
        const actual = sha256buf(Buffer.from(String(diff.stdout ?? ''), 'utf8'));
        if (actual !== anchor.reviewedPatchSha256) p.push(`${rel} reviewedPatchSha256 is not sha256(diff anchoredBase..head) — the receipt reviews some other patch`);
      }
    } else p.push(`${rel} reviewed patch identity cannot be recomputed without a git runner and the anchored base`);
    const av = String(anchor.verdict ?? '').toUpperCase();
    if (!POSITIVE_VERDICTS.includes(av)) p.push(`${rel} artifact review verdict is not positive`);
  }
  if (kind === 'code-signature') { if (anchor.signatureValue !== ctx.sourceSignature) p.push(`${rel} signature value is not the live source signature`); }
  if (kind === 'ci-record') {
    // Bounded temporal trust repair: the COMPLETE required check population/outcomes exist
    // only in the fixed acquisition input — a local capture artifact with schema strings and
    // a checkrun id 1 is a structural copy, not actual CI acquisition. Final CI is
    // NOT_STARTED in the current expected inputs, so the arm fails closed.
    const eci = expectedFacts(ctx?.expectedInputs)?.FINAL_CI;
    const ccGate = anchor.capturedChecks ?? {};
    if (!expectedFacts(ctx?.expectedInputs)) p.push(`${rel} has no independently selected expected inputs — an externally dependent CI receipt fails closed`);
    else if (!eci || eci.admission !== EXPECTED_ADMISSIONS.ci) p.push(`${rel}: independently selected expected inputs record final CI as ${(eci?.admission ?? 'UNSPECIFIED')} — no actual required-check acquisition exists`);
    else if (!eci.actualRequiredCheckAcquisition || typeof eci.actualRequiredCheckAcquisition.path !== 'string' || !HEX64.test(eci.actualRequiredCheckAcquisition.sha256 ?? '') || ccGate.path !== eci.actualRequiredCheckAcquisition.path || ccGate.sha256 !== eci.actualRequiredCheckAcquisition.sha256) p.push(`${rel} captured-checks binding does not match the independently selected actual required-check acquisition pin`);
    // R4 (packet 7, owner probe fb208403 frame 2 / frozen ctx 064fa300): the mandatory
    // acquisition inputs are NOT optional. A positive ACQUIRED_NATIVE certification requires
    // a well-formed nonempty repository, a real measured head, and the COMPLETE unique
    // required population (ids AND names AND their size-matched mapping) pinned in the
    // independently selected acquisition — missing/empty/malformed/duplicate fields REFUSE
    // instead of silently skipping the population guards, and the ENTIRE independently
    // required population is validated, never a candidate-selected subset.
    else if (typeof eci.headSHA !== 'string' || !HEX40.test(eci.headSHA ?? '')) p.push(`${rel} independently selected actual CI acquisition lacks its measured subject head — mandatory acquisition identity refuses`);
    else if (typeof eci.repository !== 'string' || eci.repository.length === 0) p.push(`${rel} independently selected actual CI acquisition lacks its repository — mandatory acquisition identity refuses`);
    else if (!Array.isArray(eci.requiredCheckRunIds) || eci.requiredCheckRunIds.length === 0 || !eci.requiredCheckRunIds.every((n) => Number.isInteger(n) && n > 0) || new Set(eci.requiredCheckRunIds).size !== eci.requiredCheckRunIds.length) p.push(`${rel} independently selected actual CI acquisition lacks a well-formed nonempty unique required check-run id population — missing/empty/malformed/duplicate required inputs refuse`);
    else if (!Array.isArray(eci.requiredCheckNames) || eci.requiredCheckNames.length === 0 || !eci.requiredCheckNames.every((n) => typeof n === 'string' && n.length > 0) || new Set(eci.requiredCheckNames).size !== eci.requiredCheckNames.length) p.push(`${rel} independently selected actual CI acquisition lacks a well-formed nonempty unique required check-name population — missing/empty/malformed/duplicate required inputs refuse`);
    else if (eci.requiredCheckRunIds.length !== eci.requiredCheckNames.length) p.push(`${rel} required check-run id and name populations disagree in size — an incomplete required id/name mapping refuses`);
    else if (anchor.head !== eci.headSHA) p.push(`${rel} CI head does not equal the independently selected required-acquisition subject head — a foreign-head claim never covers the required population`);
    else if (anchor.repository !== eci.repository) p.push(`${rel} CI repository does not match the independently selected required-acquisition repository`);
    if (anchor.conclusion !== 'success') p.push(`${rel} CI conclusion ${JSON.stringify(anchor.conclusion)} is not success`);
    if (!Array.isArray(anchor.checks) || anchor.checks.length === 0) p.push(`${rel} lacks per-check typed conclusions`);
    else for (const c of anchor.checks) if (!c?.name || c.conclusion !== 'success') p.push(`${rel} check ${JSON.stringify(c?.name)} conclusion is not success`);
    if (!Array.isArray(anchor.checkRunIds) || anchor.checkRunIds.length === 0 || !anchor.checkRunIds.every((n) => Number.isInteger(n) && n > 0)) p.push(`${rel} lacks real CI check-run ids`);
    if (anchor.criticalPathFullInvocationIncreased !== false) p.push(`${rel} must record criticalPathFullInvocationIncreased=false (frozen constraint)`);
    // Root ad255e87 (expensive-full-invocation clause): the candidate boolean alone proves
    // nothing. The SAME ORIGINAL frozen counted population and invocation unit are compared
    // baseline→final through durable actual evidence pins: independently admitted baseline
    // and final exact subjects, explicit nonnegative integer counts, and readable pinned
    // acquisition/log/job/workflow bytes. Unknown baseline, missing bytes/count proof, a
    // wrong original baseline/subject/population/unit, or an increased count REFUSE
    // regardless of criticalPathFullInvocationIncreased=false; an explicit zero count is
    // valid only with the complete proof. No DAG/log analysis, no per-job caps, no inferred
    // counts from green names or timings.
    {
      const fip = eci?.fullInvocationProof;
      const side = (s, name) => {
        if (!s || typeof s !== 'object') return `${rel} full-invocation proof lacks its ${name} side`;
        if (typeof s.subject !== 'string' || !HEX40.test(s.subject ?? '')) return `${rel} full-invocation ${name} subject is not a real measured Git-40 head`;
        if (!Number.isInteger(s.count) || s.count < 0) return `${rel} full-invocation ${name} count is not an explicit nonnegative integer`;
        if (typeof s.population !== 'string' || s.population !== fip.population || typeof s.unit !== 'string' || s.unit !== fip.unit) return `${rel} full-invocation ${name} side does not re-declare the SAME original frozen counted population/invocation unit — a wrong original population/unit refuses`;
        if (!Array.isArray(s.evidence) || s.evidence.length === 0 || !s.evidence.every((e) => e && typeof e?.path === 'string' && (e.path.startsWith(S3_EVIDENCE_ROOT) || e.path.startsWith(S4_NAMESPACE)) && HEX64.test(e.sha256 ?? ''))) return `${rel} full-invocation ${name} side lacks its durable pinned evidence population (path under the evidence namespaces + sha256)`;
        return null;
      };
      if (!fip || typeof fip !== 'object') p.push(`${rel} independently selected actual CI acquisition lacks the expensive full-invocation count proof (population/unit/baseline/final) — an unverifiable count refuses regardless of the candidate boolean`);
      else if (typeof fip.population !== 'string' || fip.population.length === 0 || typeof fip.unit !== 'string' || fip.unit.length === 0) p.push(`${rel} full-invocation proof lacks the SAME original frozen counted population/invocation unit — an unidentifiable metric refuses`);
      else {
        for (const [s, name] of [[fip.baseline, 'baseline'], [fip.final, 'final']]) {
          const bad = side(s, name);
          if (bad) p.push(bad);
        }
        if (fip.final?.subject != null && eci.headSHA != null && fip.final.subject !== eci.headSHA) p.push(`${rel} full-invocation final subject is not the admitted actual acquisition head — a wrong final subject refuses`);
        if (Number.isInteger(fip.baseline?.count) && Number.isInteger(fip.final?.count) && fip.final.count > fip.baseline.count) p.push(`${rel} full-invocation count INCREASED (${fip.baseline.count} -> ${fip.final.count}) on the same original population/unit — critical-path full invocations grew, refusing regardless of criticalPathFullInvocationIncreased=false`);
        if (ctx.repoRoot && (!fip.baseline || !fip.final || !Array.isArray(fip.baseline.evidence) || !Array.isArray(fip.final.evidence))) { /* shape already refused above */ }
        else if (ctx.repoRoot) for (const [s, name] of [[fip.baseline, 'baseline'], [fip.final, 'final']]) {
          for (const e of s.evidence ?? []) {
            try {
              const eb = readFileSync(join(ctx.repoRoot, e.path));
              if (sha256buf(eb) !== e.sha256) p.push(`${rel} full-invocation ${name} evidence ${e.path} sha mismatch — pinned count bytes are not the actual retained acquisition`);
              else {
                // Root ad255e87 minimum (packet 8): the consumer must CONSUME the pinned
                // count-table content, not merely hash it. The readable admitted native
                // record's own metric/population, unit, subject and count must agree with
                // the independently selected comparison side; a nonzero count requires real
                // unique run/workflow/job identities (an empty run record never proves a
                // nonzero count); explicit zero is valid only inside this complete
                // acquisition/coverage proof. The ORIGINAL baseline identity is the pinned
                // native baseline record itself — never a silently substituted editable
                // candidate ledger anchor.
                let tab = null;
                try { tab = JSON.parse(eb.toString('utf8')); } catch { tab = null; }
                if (!tab || typeof tab !== 'object') p.push(`${rel} full-invocation ${name} evidence ${e.path} is not a parsable native count table — arbitrary readable bytes do not prove a count`);
                else {
                  if (String(tab.metric ?? tab.population ?? '') !== fip.population || String(tab.unit ?? '') !== fip.unit) p.push(`${rel} full-invocation ${name} native count table does not carry the SAME frozen metric/population and invocation unit — a wrong original population/unit refuses`);
                  if (typeof tab.subject !== 'string' || !HEX40.test(tab.subject ?? '') || tab.subject !== s.subject) p.push(`${rel} full-invocation ${name} native count table names subject ${JSON.stringify(tab.subject)}, not the independently admitted ${name} subject — descriptor and pinned native record disagree`);
                  if (!Number.isInteger(tab.count) || tab.count < 0 || tab.count !== s.count) p.push(`${rel} full-invocation ${name} native count table records count ${JSON.stringify(tab.count)}, contradicting the declared ${name} count ${s.count} — declared and pinned actual counts must agree`);
                  const runs = tab.runs;
                  if (s.count > 0 && (!Array.isArray(runs) || runs.length === 0 || !runs.every((r) => r && Number.isInteger(r?.id) && r?.id > 0 && typeof r?.workflow === 'string' && r.workflow.length > 0 && Array.isArray(r.jobs) && r.jobs.length > 0 && r.jobs.every((j) => typeof j === 'string' && j.length > 0)) || new Set(runs.map((r) => r?.id)).size !== runs.length)) p.push(`${rel} full-invocation ${name} declares a nonzero count with empty or unusable native run identities — absent run/workflow/job acquisition proof is unverified, never green`);
                }
              }
            } catch (e2) { p.push(`${rel} full-invocation ${name} evidence ${e.path} is unreadable — missing bytes never prove a count`); }
          }
        }
      }
    }
    if (!HEX40.test(anchor.head ?? '')) p.push(`${rel} CI head must be a Git-40 commit id`);
    // R4: CI certifies only against a RETAINED native GitHub check-runs capture. Every
    // claimed check-run id must exist in the captured run population for the SAME head the
    // anchor names, and that head must be a real commit of this repository — an invented id
    // (1), a wrong-head capture (f*40) or an unknown check name refuses.
    if (HEX40.test(anchor.head ?? '') && ctx.git) {
      const ex = ctx.git(['cat-file', '-e', `${anchor.head}^{commit}`, '--']);
      if (ex.rc !== 0) p.push(`${rel} CI head ${anchor.head} does not exist as a commit in this repository`);
      else {
        const anc = ctx.git(['merge-base', '--is-ancestor', anchor.head, 'HEAD']);
        if (anc.rc !== 0) p.push(`${rel} CI head is not an ancestor of the live HEAD — a foreign/wrong-head capture never certifies this line`);
      }
      // R4 (packet 7, owner probe fb208403 frame 1 / frozen ctx ffe60548): the pinned
      // ACQUISITION head must cover the CURRENT admitted code/receipt source/dependencies
      // through the EXISTING R6 codeScopeEquivalent algorithm (called unchanged) — expected
      // and captured heads merely agreeing with each other, or naked ancestry, prove nothing
      // about current coverage. A stale pinned capture of older changed code refuses, while
      // a genuine evidence-only same-code acquisition head stays a conditional positive.
      const acq = ctx.git
        ? codeScopeEquivalent((args) => ctx.git(args), anchor.head, ctx.ledger)
        : { ok: false, reason: 'no git runner — acquisition coverage cannot be established' };
      if (!acq.ok) p.push(`${rel} CI acquisition head ${anchor.head} does not cover the current admitted code/receipt source/dependencies (covered-source equivalence refused: ${acq.reason}) — a stale pinned capture of older code never certifies the current required population`);
    }
    const cc = anchor.capturedChecks ?? {};
    if (typeof cc.path !== 'string' || !cc.path.startsWith(S3_EVIDENCE_ROOT) && !cc.path.startsWith(S4_NAMESPACE) || !HEX64.test(cc.sha256 ?? '')) p.push(`${rel} lacks the retained captured-checks evidence binding (path under the evidence namespaces + sha256)`);
    else if (ctx.repoRoot) {
      try {
        const cb = readFileSync(join(ctx.repoRoot, cc.path));
        if (sha256buf(cb) !== cc.sha256) p.push(`${rel} captured-checks sha mismatch at ${cc.path}`);
        else {
          const cap = JSON.parse(cb.toString('utf8'));
          if (cap?.schema !== 'gh.check-runs/v1') p.push(`${rel} captured-checks artifact is not a native gh.check-runs/v1 capture`);
          if (cap?.head_sha !== anchor.head) p.push(`${rel} captured check-runs are for head ${cap?.head_sha}, not the anchor head — wrongCIhead refuses`);
          const runs = new Map((cap?.check_runs ?? []).map((r) => [r.id, r]));
          for (const id of anchor.checkRunIds ?? []) {
            const r = runs.get(id);
            if (!r) p.push(`${rel} check-run id ${id} is absent from the captured run population — invented ids refuse`);
            else if (r.conclusion !== 'success') p.push(`${rel} captured run ${id} (${r.name}) has conclusion ${r.conclusion}, not success`);
          }
          for (const c of anchor.checks ?? []) {
            const r = (cap?.check_runs ?? []).find((x) => x.name === c?.name);
            if (!r) p.push(`${rel} check ${JSON.stringify(c?.name)} is unknown to the captured run population — unknownchecks refuse`);
          }
          // R4 (Root 973 R4-required-CI-population): the COMPLETE independently required
          // population — identities, names, uniqueness, coverage and ALL terminal outcomes —
          // comes from the pinned acquisition bytes, never from the candidate-selected rows.
          // A successful subset of a fixed acquisition that contains a failed required check
          // refuses; omitted/absent/duplicated/foreign runs refuse.
          if (Array.isArray(eci?.requiredCheckRunIds) && eci.requiredCheckRunIds.length > 0) {
            const captured = (cap?.check_runs ?? []).map((r) => r.id);
            if (new Set(captured).size !== captured.length) p.push(`${rel} captured run population has duplicate check-run ids — not a unique required population`);
            const sortedReq = [...eci.requiredCheckRunIds].sort((a, b) => a - b);
            const sortedClaim = [...(anchor.checkRunIds ?? [])].sort((a, b) => a - b);
            if (JSON.stringify(sortedClaim) !== JSON.stringify(sortedReq)) p.push(`${rel} claimed check-run ids ${JSON.stringify(sortedClaim)} are not the complete independently required population ${JSON.stringify(sortedReq)} — an omitted/absent/duplicated required check refuses`);
            if (JSON.stringify([...captured].sort((a, b) => a - b)) !== JSON.stringify(sortedReq)) p.push(`${rel} captured run population ${JSON.stringify([...captured].sort((a, b) => a - b))} is not exactly the independently required population ${JSON.stringify(sortedReq)} — foreign or missing runs refuse`);
            for (const id of sortedReq) {
              const r = runs.get(id);
              if (r && r.conclusion !== 'success') p.push(`${rel} REQUIRED captured run ${id} (${r.name}) has terminal conclusion ${r.conclusion}, not success — a failed required outcome refuses`);
            }
          }
          if (Array.isArray(eci?.requiredCheckNames) && eci.requiredCheckNames.length > 0) {
            const capturedNames = (cap?.check_runs ?? []).map((r) => r.name);
            const claimNames = (anchor.checks ?? []).map((c) => c?.name).filter(Boolean);
            for (const n of eci.requiredCheckNames) if (!claimNames.includes(n)) p.push(`${rel} required check ${JSON.stringify(n)} is omitted from the claimed typed conclusions — an incomplete required population refuses`);
            if (capturedNames.filter((n) => eci.requiredCheckNames.includes(n)).sort().join('\u0000') !== [...eci.requiredCheckNames].sort().join('\u0000')) p.push(`${rel} captured check-name coverage does not match the independently required check names — missing or foreign names refuse`);
          }
        }
      } catch (e) { p.push(`${rel} captured-checks artifact unreadable: ${e.message}`); }
    }
  }
  if (kind === 'install-record') {
    // Bounded temporal trust repair: an actual target installation is an externally
    // dependent fact. Installed bytes, target root, argv and a terminal record must match
    // the independently selected actual target acquisition — a source-side manifest row plus
    // a self-authored completed terminal is not an installation. TARGET_INSTALL is MISSING
    // in the current expected inputs, so the arm fails closed.
    const ein = expectedFacts(ctx?.expectedInputs)?.TARGET_INSTALL;
    const instGate = anchor.installation ?? {};
    if (!expectedFacts(ctx?.expectedInputs)) p.push(`${rel} has no independently selected expected inputs — an externally dependent install receipt fails closed`);
    else if (!ein || ein.admission !== EXPECTED_ADMISSIONS.install) p.push(`${rel}: independently selected expected inputs record the target installation as ${(ein?.admission ?? 'UNSPECIFIED')} — installed bytes/argv/terminal authored by the source side are not an actual installation`);
    else if (!ein.actualTargetAcquisition || typeof ein.actualTargetAcquisition.targetRoot !== 'string' || instGate.targetRoot !== ein.actualTargetAcquisition.targetRoot || JSON.stringify(instGate.installerArgv) !== JSON.stringify(ein.actualTargetAcquisition.installerArgv)) p.push(`${rel} installation does not match the independently selected actual target acquisition (targetRoot/installerArgv)`);
    // R4 (Root 973 R4-install-subject-bytes-terminal): matching targetRoot/argv alone proves
    // nothing. The COMPLETE expected emitted installed-file population, its exact bytes on
    // disk, the physical target boundary and the NATIVE terminal record all come from the
    // independently selected acquisition; a self-authored substituted terminal and an
    // omitted/substituted file population refuse.
    else if (!Array.isArray(ein.actualTargetAcquisition.installedFiles) || ein.actualTargetAcquisition.installedFiles.length === 0 || !ein.actualTargetAcquisition.installedFiles.every((x) => typeof x?.path === 'string' && isAbsolute(x.path) && x.path.startsWith(ein.actualTargetAcquisition.targetRoot + '/') && hex(x.sha256))) p.push(`${rel} independently selected actual acquisition lacks its complete installed-file population under the physical target root`);
    else if (!ein.actualTargetAcquisition.installerTerminal || ein.actualTargetAcquisition.installerTerminal.status !== 'completed' || typeof ein.actualTargetAcquisition.sourceSubject !== 'string') p.push(`${rel} independently selected actual acquisition lacks its native installer terminal/source subject`);
    const row = anchor.manifestRow ?? {};
    if (!row.path || !hex(row.sha256)) p.push(`${rel} lacks a manifest row binding (installed artifact path + sha256)`);
    else if (ctx.repoRoot) {
      const f = join(ctx.repoRoot, row.path);
      let ok = false;
      try { ok = sha256buf(readFileSync(f)) === row.sha256; } catch { ok = false; }
      if (!ok) p.push(`${rel} installed artifact does not exist on disk with the manifest row sha`);
      else {
        try {
          const manifest = readFileSync(join(ctx.repoRoot, 'packages/getff/MANIFEST.sha256'), 'utf8');
          if (!manifest.split('\n').some((l) => l.includes(row.sha256) && l.includes(row.path))) p.push(`${rel} manifest row is not present in packages/getff/MANIFEST.sha256 — an arbitrary local file is not an installation receipt`);
        } catch (e) { p.push(`${rel} packages/getff/MANIFEST.sha256 unreadable: ${e.message}`); }
        // R4: the SOURCE manifest row only proves what ships, never that an installation
        // happened. A genuine install receipt binds the ACTUAL target installation outside this
        // repository, its installer argv, its native terminal record, and installed bytes that
        // are verifiable on disk right now.
        const inst = anchor.installation ?? {};
        const target = inst.targetRoot ?? '';
        if (!isAbsolute(target)) p.push(`${rel} install receipt lacks an absolute targetRoot for the actual installation`);
        else if (ctx.repoRoot && (target === ctx.repoRoot || target.startsWith(ctx.repoRoot + '/'))) p.push(`${rel} targetRoot is inside this source repository — a source MANIFEST row is not a target installation`);
        else if (!Array.isArray(inst.installedFiles) || inst.installedFiles.length === 0 || !inst.installedFiles.every((x) => typeof x?.path === 'string' && x.path.startsWith(target) && hex(x.sha256))) p.push(`${rel} install receipt lacks installed-files bindings under the target root`);
        else {
          for (const x of inst.installedFiles) {
            let ok2 = false;
            try { ok2 = sha256buf(readFileSync(x.path)) === x.sha256; } catch { ok2 = false; }
            if (!ok2) { p.push(`${rel} installed file ${x.path} is not present on disk with the recorded sha — installation not verifiable now`); break; }
          }
          if (!Array.isArray(inst.installerArgv) || inst.installerArgv.length === 0 || !inst.installerArgv.every((a) => typeof a === 'string')) p.push(`${rel} install receipt lacks the actual installer argv`);
          const term = inst.installerTerminal ?? {};
          if (term.status !== 'completed' || !Array.isArray(term.processes) || term.processes.length === 0 || !term.processes.every((pr) => pr.returncode === 0)) p.push(`${rel} installer terminal record is not a native completed run with all-zero returncodes`);
          else if (Number.isFinite(term.elapsed_seconds) !== true) p.push(`${rel} installer terminal record lacks its measured elapsed_seconds`);
          else if (ein?.actualTargetAcquisition && Array.isArray(ein.actualTargetAcquisition.installedFiles) && ein.actualTargetAcquisition.installerTerminal) {
            const expInst = ein.actualTargetAcquisition;
            const claimSorted = [...(inst.installedFiles ?? [])].map((x) => `${x?.path}\u0000${x?.sha256}`).sort();
            const expSorted = [...expInst.installedFiles].map((x) => `${x.path}\u0000${x.sha256}`).sort();
            if (JSON.stringify(claimSorted) !== JSON.stringify(expSorted)) p.push(`${rel} installed-file population is not the complete independently expected emitted set — omitted/substituted/duplicated files refuse`);
            for (const x of expInst.installedFiles) {
              let okE = false;
              try { okE = sha256buf(readFileSync(x.path)) === x.sha256; } catch { okE = false; }
              if (!okE) { p.push(`${rel} expected installed file ${x.path} is not present on disk with its exact expected sha — the emitted artifact set is not verifiable now`); break; }
            }
            if (JSON.stringify(inst.installerTerminal) !== JSON.stringify(expInst.installerTerminal)) p.push(`${rel} installer terminal does not deep-equal the independently selected native terminal (elapsed/sourceSubject) — a self-authored substituted terminal refuses`);
          }
        }
      }
    }
  }
  if (kind === 'performance-record') {
    if (!hex(anchor.matrixRecordSha256)) p.push(`${rel} lacks the performance matrix sha`);
    else if (ctx.repoRoot) {
      try {
        const bytes = readFileSync(join(ctx.repoRoot, S3_PERF_REL));
        if (sha256buf(bytes) !== anchor.matrixRecordSha256) p.push(`${rel} performance matrix sha does not match the live record`);
        const v = validatePerformanceRecord(JSON.parse(bytes.toString('utf8')), ctx.repoRoot, { git: ctx.git, expectedInputs: ctx.expectedInputs });
        if (!v.ok) p.push(`${rel} referenced performance record is not structurally accepted: ${v.problems.slice(0, 3).join(' | ')}`);
      } catch (e) { p.push(`${rel} performance record unreadable: ${e.message}`); }
    }
  }
  return p;
}

// ---- historical closure semantics (R2) -------------------------------------------------
// R2: closure is obligation-specific. A sha proves bytes, never discharge — the same
// SHA-correct body, even one explicitly stating it is not evidence, must close NOTHING. Each
// obligation carries its own required closure record shape, its ORIGINAL denominators and a
// native provenance artifact; a record naming a different obligation is irrelevant/shared
// substitution and refuses.
export function validateHistoricalClosure(item, repoRoot, ctx = null) {
  if (typeof item?.id !== 'string') return ['closure item lacks an id'];
  const ev = item.closureEvidence ?? {};
  if (typeof ev.path !== 'string' || !(ev.path.startsWith(S3_EVIDENCE_ROOT) || ev.path.startsWith(S4_NAMESPACE)) || !HEX64.test(ev.sha256 ?? '')) {
    return [`${item.id}: closure evidence must be a pinned artifact under the evidence namespaces`];
  }
  if (!repoRoot) return [`${item.id}: closure evidence cannot be read without repoRoot`];
  let body = null;
  try {
    const bytes = readFileSync(join(repoRoot, ev.path));
    if (sha256buf(bytes) !== ev.sha256) return [`${item.id}: closure evidence sha mismatch at ${ev.path}`];
    body = JSON.parse(bytes.toString('utf8'));
  } catch (e) { return [`${item.id}: closure evidence unreadable: ${ev.path} (${e.message})`]; }
  if (body?.obligationId !== item.id) return [`${item.id}: closure record names obligation ${JSON.stringify(body?.obligationId)} — an irrelevant or shared body never discharges this obligation`];
  const p = [];
  if (item.id === 's0-12-raw-logs') {
    // The twelve ORIGINAL raw qualification logs, identified against the original acceptance
    // record they came from — twelve fresh invented identifiers are substitution, not closure.
    const acc = body.originalAcceptance ?? {};
    const ids = body.rawLogIds;
    if (body.retrievalKind !== 'native-retrieval') p.push('s0-12-raw-logs closure must declare retrievalKind native-retrieval');
    if (!Array.isArray(ids) || ids.length !== 12 || new Set(ids).size !== 12 || ids.some((x) => typeof x !== 'string' || !x.trim())) p.push('s0-12-raw-logs closure must carry exactly 12 unique nonempty original raw log identities');
    else if (typeof acc.path !== 'string' || !HEX64.test(acc.sha256 ?? '')) p.push('s0-12-raw-logs closure lacks the pinned ORIGINAL acceptance record the twelve ids are identified against');
    else {
      try {
        const ab = readFileSync(join(repoRoot, acc.path));
        if (sha256buf(ab) !== acc.sha256) p.push('s0-12-raw-logs original acceptance sha mismatch');
        else {
          const arec = JSON.parse(ab.toString('utf8'));
          const aIds = arec?.rawLogIds ?? arec?.originalRawLogIds;
          if (!Array.isArray(aIds) || JSON.stringify([...aIds].sort()) !== JSON.stringify([...ids].sort())) p.push('s0-12-raw-logs closure ids do not match the original acceptance record — substituted identifiers refuse');
        }
      } catch (e) { p.push(`s0-12-raw-logs original acceptance unreadable: ${e.message}`); }
    }
    // Bounded temporal trust repair: whether the ORIGINAL twelve raws were genuinely
    // retrieved is an externally dependent fact. The independently selected expected inputs
    // carry the genuine original raw pins; the current map records NOT_RETRIEVED with an
    // empty pin set — author-created originalAcceptance ids discharge nothing.
    const e12 = expectedFacts(ctx?.expectedInputs)?.HISTORICAL_S0_12;
    if (!expectedFacts(ctx?.expectedInputs)) p.push('s0-12-raw-logs closure has no independently selected expected inputs — externally dependent closure fails closed');
    else if (!e12 || e12.admission !== EXPECTED_ADMISSIONS.s0_12 || !Array.isArray(e12.genuineOriginalRetrievedRawPins)) p.push(`independently selected expected inputs record the original s0-12 raws as ${(e12?.admission ?? 'UNSPECIFIED')} (no genuine original pins) — author-listed identifiers discharge nothing`);
    else if (e12.genuineOriginalRetrievedRawPins.length !== 12 || !e12.genuineOriginalRetrievedRawPins.every((x) => typeof x === 'string' && HEX64.test(x)) || JSON.stringify([...e12.genuineOriginalRetrievedRawPins].sort()) !== JSON.stringify([...ids].sort())) p.push('s0-12 closure ids do not match the independently selected genuine original raw pins — fresh or substituted identifiers are not the originals');
    // R2 (Root 973 R2-original-raws-and-source): matching SHA STRINGS prove nothing. The
    // ORIGINAL acceptance/producer/source is the independently pinned record — a substituted
    // author-side originalAcceptance refuses even with all twelve id strings equal — and all
    // twelve ORIGINAL raw artifacts must be READABLE at their admitted locations with their
    // exact bytes; absent/substituted/path-escaping/duplicated raws refuse.
    else if (!e12.originalAcceptance || e12.originalAcceptance.path !== acc.path || e12.originalAcceptance.sha256 !== acc.sha256) p.push('s0-12 closure original-acceptance pin does not match the independently selected ORIGINAL acceptance pin — a substituted author-side original record refuses');
    else if (typeof e12.originalSourceHead !== 'string' || !HEX40.test(e12.originalSourceHead ?? '')) p.push('independently selected expected inputs lack the ORIGINAL source head for the s0-12 raws');
    else {
      try {
        const eb = readFileSync(isAbsolute(e12.originalAcceptance.path) ? e12.originalAcceptance.path : join(repoRoot, e12.originalAcceptance.path));
        if (sha256buf(eb) !== e12.originalAcceptance.sha256) p.push('independently pinned ORIGINAL acceptance bytes are unreadable at their exact pin — strings alone never prove retrieval');
        else {
          const erec = JSON.parse(eb.toString('utf8'));
          if (erec?.sourceHead !== e12.originalSourceHead) p.push('ORIGINAL acceptance record names a different source head than the independently selected original source — substituted provenance refuses');
          const eArts = Array.isArray(e12.rawArtifacts) ? e12.rawArtifacts : null;
          if (!eArts || eArts.length !== 12 || new Set(eArts.map((x) => x?.path)).size !== 12 || new Set(eArts.map((x) => x?.sha256)).size !== 12 || !eArts.every((x) => typeof x?.path === 'string' && x.path.startsWith(S3_EVIDENCE_ROOT) && !x.path.includes('..') && HEX64.test(x.sha256 ?? ''))) p.push('independently selected expected inputs lack the twelve uniquely pinned ORIGINAL raw artifact locations under the evidence root');
          else if (JSON.stringify(eArts.map((x) => `${x.path}\u0000${x.sha256}`).sort()) !== JSON.stringify([...(erec?.rawArtifacts ?? [])].map((x) => `${x?.path}\u0000${x?.sha256}`).sort())) p.push('ORIGINAL acceptance raw-artifact locations do not match the independently pinned twelve — substituted artifact provenance refuses');
          else for (const art of eArts) {
            let rb = null;
            try { rb = readFileSync(join(repoRoot, art.path)); } catch { rb = null; }
            if (rb === null || sha256buf(rb) !== art.sha256) { p.push(`ORIGINAL raw artifact ${art.path} is not readable at its admitted location with its exact pinned bytes — string ids without actual bytes never prove retrieval`); break; }
          }
        }
      } catch (e) { p.push(`independently pinned ORIGINAL acceptance unreadable: ${e.message}`); }
    }
  } else if (item.id === 'cf37-broad-fixture') {
    // The original cf37 fixture was observed RED and never rebaselined; a dated-6673
    // comparison, a fresh baseline or a silent relabel closes nothing. The invented
    // tak.owner.rebaseline-ruling success branch and the REBASED_NATIVE/
    // authorizedRebaselineOrWaiver path are REMOVED (Root 973 sameRoundConformanceNote): no
    // cf37/538 waiver or rebaseline authority exists. The only conditional closure evidence
    // is the ORIGINAL-spec duty record itself — the independently pinned retained RED
    // observation with its exact original fixture sha — never a waiver flag.
    if (body.originalObservation !== 'RED') p.push('cf37 closure must record the original observation as RED (frozen policy forbids silent relabeling)');
    if (body.originalFixtureSha256 !== ORIGINAL_FIXTURE_SHA256.fallback) p.push('cf37 closure must pin the ORIGINAL cf37 fixture sha, not a dated substitute');
    const ec = expectedFacts(ctx?.expectedInputs)?.HISTORICAL_CF37;
    if (!expectedFacts(ctx?.expectedInputs)) p.push('cf37 closure has no independently selected expected inputs — externally dependent closure fails closed');
    else if (!ec || ec.admission !== EXPECTED_ADMISSIONS.cf37) p.push(`no in-original-spec duty evidence is admitted in the independently selected expected inputs (admission ${(ec?.admission ?? 'UNSPECIFIED')}) — cf37 remains observed-RED, no rebaseline or waiver authority exists and the frozen baseline stands`);
    else if (!ec.originalDutyClosure || typeof ec.originalDutyClosure.path !== 'string' || !ec.originalDutyClosure.path.startsWith(S3_EVIDENCE_ROOT) || !HEX64.test(ec.originalDutyClosure.sha256 ?? '')) p.push('independently selected expected inputs lack the pinned ORIGINAL cf37 duty-closure record — a waiver flag is not original-spec evidence');
    else {
      try {
        const db = readFileSync(join(repoRoot, ec.originalDutyClosure.path));
        if (sha256buf(db) !== ec.originalDutyClosure.sha256) p.push('independently pinned cf37 duty-closure bytes are unreadable at their exact pin');
        else {
          const drec = JSON.parse(db.toString('utf8'));
          if (drec?.obligationId !== 'cf37-broad-fixture' || drec?.originalObservation !== 'RED' || drec?.originalFixtureSha256 !== ORIGINAL_FIXTURE_SHA256.fallback) p.push('independently pinned cf37 duty-closure record does not restate the ORIGINAL RED observation with its exact fixture sha — not original-spec duty evidence');
        }
      } catch (e) { p.push(`independently pinned cf37 duty-closure record unreadable: ${e.message}`); }
    }
  } else if (item.id === 'rule-538-to-430.4') {
    // The original 538 -> 430.4 dominant-rule goal with its frozen denominators, discharged
    // ONLY by a measured median at or under the target on a structurally accepted matrix.
    if (body.originalMedianMs !== 538 || body.targetMs !== 430.4) p.push('rule-538 closure must restate the ORIGINAL frozen denominators 538 -> 430.4 (metric policy), not invented ones');
    // Bounded temporal trust repair: whether the 538 -> 430.4 goal is met is bound to the
    // independently admitted native matrix (S3_PERFORMANCE authority), not to any
    // author-stated median. The current expected inputs record it UNMET at the observed
    // 1079ms median — no schema/closed-label substitution discharges it.
    const e538 = expectedFacts(ctx?.expectedInputs)?.HISTORICAL_RULE538;
    if (!expectedFacts(ctx?.expectedInputs)) p.push('rule-538 closure has no independently selected expected inputs — externally dependent closure fails closed');
    else if (!e538 || e538.admission !== EXPECTED_ADMISSIONS.rule538) p.push(`independently selected expected inputs record rule-538 as ${(e538?.admission ?? 'UNSPECIFIED')} (observed optimized median ${e538?.currentObservedOptimizedMedianMs ?? '?'}ms vs target ${e538?.targetMs ?? '?'}ms) — the dominant-rule goal stays unmet regardless of any author-stated median`);
    if (!(body.measuredMedianMs > 0)) p.push('rule-538 closure lacks the measured dominant median');
    else if (body.measuredMedianMs > body.targetMs) p.push(`rule-538 closure measured median ${body.measuredMedianMs}ms does not meet the original 430.4ms target`);
    const rec = body.performanceRecord ?? {};
    if (rec.path !== S3_PERF_REL || !HEX64.test(rec.sha256 ?? '')) p.push('rule-538 closure must bind the exact live performance record');
    else {
      try {
        const pb = readFileSync(join(repoRoot, S3_PERF_REL));
        if (sha256buf(pb) !== rec.sha256) p.push('rule-538 closure performance record sha mismatch');
        else {
          const v = validatePerformanceRecord(JSON.parse(pb.toString('utf8')), repoRoot, ctx);
          if (!v.ok) p.push(`rule-538 closure matrix is not structurally accepted: ${v.problems.slice(0, 3).join(' | ')}`);
          else if ((v.medians?.rule?.optimized ?? []).length !== 3) p.push('rule-538 closure matrix lacks the dominant-rule optimized medians');
          else {
            const measured = [...v.medians.rule.optimized].sort((a, b) => a - b)[1]; // median of 3
            if (measured !== body.measuredMedianMs) p.push('rule-538 closure measured median does not equal the accepted matrix median');
          }
        }
      } catch (e) { p.push(`rule-538 closure performance record unreadable: ${e.message}`); }
    }
  } else if (item.id === 'ci') {
    // CI closes only through the typed s4 ci-record receipt evaluated by its real contract
    // (evaluateReceipt through the s4 gate) — never through a coverage-side label. The
    // actual required-check acquisition exists only in the fixed expected inputs; the
    // current map records final CI as NOT_STARTED with no acquisition.
    try {
      const receipt = JSON.parse(readFileSync(join(repoRoot, ev.path), 'utf8'));
      if (receipt?.kind !== 'ci-record') p.push('ci closure evidence is not a typed ci-record receipt');
    } catch (e) { p.push(`ci closure evidence unreadable: ${e.message}`); }
    const eci = expectedFacts(ctx?.expectedInputs)?.FINAL_CI;
    if (!expectedFacts(ctx?.expectedInputs)) p.push('ci closure has no independently selected expected inputs — externally dependent closure fails closed');
    else if (!eci || eci.admission !== EXPECTED_ADMISSIONS.ci || !eci.actualRequiredCheckAcquisition || !HEX64.test(eci.actualRequiredCheckAcquisition.sha256 ?? '')) p.push(`independently selected expected inputs record final CI as ${(eci?.admission ?? 'UNSPECIFIED')} with no actual required-check acquisition — a typed local receipt alone closes nothing`);
    else if (eci.actualRequiredCheckAcquisition.path !== ev.path || eci.actualRequiredCheckAcquisition.sha256 !== ev.sha256) p.push('ci closure evidence does not match the independently selected actual required-check acquisition pin');
  }
  return p;
}

// ---- ordered accepted predecessors (R3) -------------------------------------------------
// R3: S4 may only consider receipts on top of ACCEPTED, ORDERED S2 then S3 predecessor
// evidence bound to this exact code line: the retained accepted S2 artifact (real Git
// ancestry from this HEAD) and an accepted S3 verdict record. The delivered S3 is RED, so
// S4 stays RED; a missing/RED/stale prerequisite blocks the dependent certificate only.
export function validatePredecessors(ledger, repoRoot, git, opts = {}) {
  const p = [];
  // Bounded temporal trust repair: what counts as an ACCEPTED predecessor is an externally
  // dependent fact carried only by the independently selected expected inputs — the S2
  // acceptance is positive ONLY for its exact unchanged covered subject (head/tree/producer
  // postimages recomputed from real Git objects), and an accepted S3 exists only when the
  // descriptor admits one. Ancestor existence alone, an author-authored ACCEPTED JSON, a
  // head-omitted/stale-source/changed-deps record never suffices.
  const facts = expectedFacts(opts.expectedInputs);
  const prereq = ledger?.predecessors;
  if (!prereq?.s2 || !prereq?.s3) return { ok: false, problems: ['ordered predecessor declarations (s2 then s3) missing from the ledger'] };
  const s2 = prereq.s2;
  const ev = s2.acceptedEvidence ?? {};
  if (typeof ev.path !== 'string' || !ev.path.startsWith(S3_EVIDENCE_ROOT) || !HEX64.test(ev.sha256 ?? '')) p.push('s2 predecessor lacks a pinned accepted-evidence artifact under the S3 evidence root');
  else if (!repoRoot) p.push('s2 predecessor evidence cannot be read without repoRoot');
  else {
    try {
      const bytes = readFileSync(join(repoRoot, ev.path));
      if (sha256buf(bytes) !== ev.sha256) p.push('s2 predecessor accepted-evidence sha mismatch');
      else {
        const rec = JSON.parse(bytes.toString('utf8'));
        if (rec?.stage !== 'S2' || !POSITIVE_VERDICTS.includes(String(rec?.verdict ?? '').toUpperCase())) p.push('s2 predecessor artifact is not an ACCEPTED S2 record');
        if (!HEX40.test(rec?.baseHead ?? '')) p.push('s2 predecessor artifact lacks its Git-40 base head');
        else if (git) {
          const ex = git(['cat-file', '-e', `${rec.baseHead}^{commit}`, '--']);
          if (ex.rc !== 0) p.push(`s2 predecessor base head ${rec.baseHead} does not exist as a commit`);
          else {
            const anc = git(['merge-base', '--is-ancestor', rec.baseHead, 'HEAD']);
            if (anc.rc !== 0) p.push('s2 predecessor base head is not an ancestor of the live HEAD — stale/unrelated accepted evidence');
          }
        } else p.push('s2 predecessor ancestry cannot be established without a git runner');
        // Exact accepted-S2 byte/subject/dependency subpredicate: the canonical acceptance
        // covers ONLY its exact covered inputs — head, tree and every producer postimage
        // are recomputed from real Git objects and compared to the independently pinned
        // bytes. A changed producer or dependencies refuse; the match never implies an
        // accepted S3 (notCurrentS3SourceGo).
        const es2 = facts?.S2_CANONICAL_ACCEPTED;
        if (!facts) p.push('s2 predecessor has no independently selected expected inputs — the accepted-S2 certificate fails closed (a candidate-pinned artifact is not independent acceptance)');
        else if (!es2 || rec?.baseHead !== es2.head) p.push(`s2 predecessor base head does not equal the independently accepted canonical head ${(es2?.head ?? 'UNSET')} — the canonical acceptance is positive only for its exact covered subject`);
        else if (!es2.receipt || typeof es2.receipt.path !== 'string' || !HEX64.test(es2.receipt.sha256 ?? '')) p.push('independently selected expected inputs lack the canonical accepted-S2 receipt pin — the accepted evidence cannot be bound to actual record bytes');
        else if (es2.receipt.path !== ev.path || es2.receipt.sha256 !== ev.sha256) p.push('ledger accepted-evidence is not the independently accepted canonical S2 receipt — an unbound candidate S2 proxy never substitutes for independent acceptance');
        else if (git) {
          const t = git(['rev-parse', `${es2.head}^{tree}`]);
          if (t.rc !== 0 || String(t.stdout ?? '').trim() !== (es2.tree ?? '')) p.push('independently accepted canonical S2 tree does not resolve — the covered subject cannot be established');
          for (const [rel, sha] of Object.entries(es2.producerPostimages ?? {})) {
            const blob = git(['cat-file', 'blob', `${es2.head}:${rel}`]);
            if (blob.rc !== 0 || sha256buf(Buffer.from(String(blob.stdout ?? ''), 'utf8')) !== sha) p.push(`canonical S2 producer postimage ${rel} does not match the independently pinned bytes — changed producer or dependencies refuse`);
          }
          // R3 (Root 973 R3-live-covered-subject-and-deps): reading the old commit's blobs only
          // rechecks history. The canonical acceptance covers the CURRENT live producers: the
          // live file bytes at this checkout must equal the independently accepted postimages
          // (or an explicitly admitted producer-equivalence pin). A changed live producer —
          // e.g. a newer verify.mjs than the accepted footprint — must be covered by a
          // separately admitted fresh S2, never by the canonical receipt.
          for (const [rel, sha] of Object.entries(es2.producerPostimages ?? {})) {
            let live = null;
            try { live = sha256buf(readFileSync(join(repoRoot, rel))); } catch { live = null; }
            const admitted = es2.admittedProducerEquivalence?.[rel];
            if (live !== sha && live !== admitted) p.push(`live producer ${rel} does not equal the independently accepted producer postimage — the canonical S2 acceptance does not cover changed live code (a fresh S2 must be separately admitted)`);
          }
        }
      }
    } catch (e) { p.push(`s2 predecessor evidence unreadable: ${e.message}`); }
  }
  const s3p = prereq.s3;
  const vr = s3p.verdictRecord ?? {};
  if (typeof vr.path !== 'string' || !vr.path.startsWith(S3_EVIDENCE_ROOT) || !HEX64.test(vr.sha256 ?? '')) p.push('s3 predecessor lacks a pinned verdict-record artifact under the S3 evidence root');
  else if (repoRoot) {
    try {
      const bytes = readFileSync(join(repoRoot, vr.path));
      if (sha256buf(bytes) !== vr.sha256) p.push('s3 predecessor verdict-record sha mismatch');
      else {
        const rec = JSON.parse(bytes.toString('utf8'));
        if (rec?.stage !== 'S3') p.push('s3 predecessor artifact is not an S3 verdict record');
        const verdict = String(rec?.verdict ?? '').toUpperCase();
        if (!POSITIVE_VERDICTS.includes(verdict)) p.push(`s3 predecessor verdict is ${verdict || 'absent'} — S4 certificates require the ordered ACCEPTED S2 then S3 chain (the delivered S3 stays RED)`);
        if (HEX40.test(rec?.head ?? '') && git) {
          const ex = git(['cat-file', '-e', `${rec.head}^{commit}`, '--']);
          if (ex.rc !== 0) p.push(`s3 predecessor head ${rec.head} does not exist as a commit`);
          else {
            const anc = git(['merge-base', '--is-ancestor', rec.head, 'HEAD']);
            if (anc.rc !== 0) p.push('s3 predecessor head is not an ancestor of the live HEAD');
          }
        }
        // The accepted-S3 fact is independent: only an explicit admission plus an exact
        // accepted-verdict pin in the expected inputs establishes it. An author-authored
        // ACCEPTED JSON is a self-report; the current map records the predecessor MISSING.
        const es3 = facts?.S3_ACCEPTED_PREDECESSOR;
        if (!facts) p.push('s3 predecessor has no independently selected expected inputs — an author-authored ACCEPTED verdict record never substitutes for independent acceptance');
        else if (!es3 || es3.admission !== EXPECTED_ADMISSIONS.s3Predecessor || !es3.acceptedVerdictRecord || !HEX64.test(es3.acceptedVerdictRecord.sha256 ?? '')) p.push(`independently selected expected inputs record the accepted S3 predecessor as ${(es3?.admission ?? 'UNSPECIFIED')} — no accepted S3 verdict exists and the ordered chain fails closed`);
        else if (es3.acceptedVerdictRecord.path !== vr.path || es3.acceptedVerdictRecord.sha256 !== vr.sha256) p.push('s3 predecessor verdict record does not match the independently selected accepted-verdict pin');
        // R3 (Root 973): the accepted predecessor must cover the CURRENT subject. A stale
        // E89-era S3 verdict against a changed current head refuses; the dependency closure
        // the acceptance covered must be READABLE at its exact pin and be the subject the
        // accepted record names. Missing subject/deps fields refuse.
        else if (typeof es3.head !== 'string' || !HEX40.test(es3.head ?? '') || typeof es3.sourceSubject !== 'string' || typeof es3.dependencySubject !== 'string') p.push('independently selected accepted-S3 descriptor lacks its current covered subject (head/sourceSubject/dependencySubject) — a subject-less acceptance never covers this line');
        else if (String(rec?.head ?? '') !== es3.head) p.push('accepted S3 predecessor head does not match the verdict record head — the pinned record covers some other subject');
        else if (git) {
          const lh = git(['rev-parse', 'HEAD']);
          const liveHead = lh.rc === 0 ? String(lh.stdout ?? '').trim() : null;
          // R3 evidence-only repair: the exact-HEAD fixed point over-rejects — a real valid
          // acceptance stays valid after an evidence-only commit under the S3 evidence root.
          // The accepted R6 codeScopeEquivalent algorithm (unchanged) carries coverage
          // forward across evidence-only descendants; a changed scoped source, a
          // non-evidence change, a non-ancestor or a missing measured head still refuses.
          if (!liveHead) p.push('live HEAD is unresolvable — the current covered subject cannot be established for the accepted S3 predecessor');
          else if (es3.head !== liveHead) {
            const eq = codeScopeEquivalent(git, es3.head, ledger);
            if (!eq.ok) p.push(`accepted S3 predecessor head ${es3.head} is not the current covered subject (live HEAD ${liveHead}; scope equivalence: ${eq.reason}) — a changed-source ancestor never carries coverage forward`);
          }
          if (es3.sourceSubject !== es3.head) p.push('accepted S3 predecessor sourceSubject does not equal its measured head — an unbound source subject refuses');
        }
        if (facts && es3?.admission === EXPECTED_ADMISSIONS.s3Predecessor && typeof es3.dependencySubject === 'string') {
          const deps = facts?.S2_CANONICAL_ACCEPTED?.dependenciesAndProfile;
          if (!deps || typeof deps.path !== 'string' || !HEX64.test(deps.sha256 ?? '')) p.push('independently selected expected inputs lack the dependency-closure/profile pin for the covered subject — dependency evidence is not consumed');
          else {
            try {
              const db = readFileSync(isAbsolute(deps.path) ? deps.path : join(repoRoot, deps.path));
              if (sha256buf(db) !== deps.sha256) p.push('independently pinned dependency closure/profile bytes are unreadable at their exact pin');
              else if (es3.dependencySubject !== sha256buf(db)) p.push('accepted S3 predecessor dependencySubject does not equal the readable dependency closure — stale dependency coverage refuses');
            } catch (e) { p.push(`independently pinned dependency closure unreadable: ${e.message}`); }
          }
        }
      }
    } catch (e) { p.push(`s3 predecessor verdict record unreadable: ${e.message}`); }
  }
  return { ok: p.length === 0, problems: p };
}

// ---- companion TAP population (R5) ----------------------------------------------------
export function parseCompanionTap(stdout) {
  const lines = String(stdout ?? '').split('\n');
  const entries = [];
  let plan = null;
  const summary = {};
  for (const line of lines) {
    let m = /^ok (\d+) - (.*)$/.exec(line) || /^ok (\d+) (.*)$/.exec(line);
    if (m) { entries.push({ index: Number(m[1]), ok: !/#\s*(SKIP|TODO)\b/i.test(line), name: m[2].replace(/#\s*(SKIP|TODO)\b.*$/i, '').trim(), directive: /#\s*(SKIP|TODO)\b/i.test(line) ? 'skip' : null }); continue; }
    m = /^not ok (\d+) - (.*)$/.exec(line) || /^not ok (\d+) (.*)$/.exec(line);
    if (m) { entries.push({ index: Number(m[1]), ok: false, name: m[2].replace(/#\s*(SKIP|CANCEL)\b.*$/i, '').trim(), directive: /#\s*CANCEL\b/i.test(line) ? 'cancel' : (/#\s*SKIP\b/i.test(line) ? 'skip' : null) }); continue; }
    if (line.startsWith('1..')) plan = Number(line.slice(3));
    const s = /^# (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) (\d+)$/.exec(line);
    if (s) summary[s[1]] = Number(s[2]);
  }
  return { entries, plan, summary, hasSummary: Object.keys(summary).length > 0 };
}

export function validateCompanionResult(tap, requiredControls) {
  const p = [];
  if (!tap || !Array.isArray(tap.entries) || tap.entries.length === 0) return ['companion produced no TAP entries'];
  const n = tap.entries.length;
  if (tap.plan == null) p.push(`no plan line (1..N) — truncated TAP refuses`);
  else if (tap.plan !== n) p.push(`plan ${tap.plan} != ${n} parsed entries — truncated or padded TAP refuses`);
  const idx = tap.entries.map((e) => e.index).sort((a, b) => a - b);
  if (new Set(idx).size !== n || idx[0] !== 1 || idx[n - 1] !== n) p.push('entry indexes are not the unique dense sequence 1..N');
  const names = tap.entries.map((e) => e.name);
  if (names.some((x) => !x || !x.trim())) p.push('empty test identity in TAP output');
  const dup = names.filter((x, i) => names.indexOf(x) !== i);
  if (dup.length) p.push(`duplicate test identities: ${[...new Set(dup)].slice(0, 3).join(', ')}`);
  const missing = requiredControls.filter((r) => !names.includes(r));
  const extra = names.filter((x) => !requiredControls.includes(x));
  if (missing.length) p.push(`required control identities missing from the run: ${missing.slice(0, 5).join(' | ')}${missing.length > 5 ? ` (+${missing.length - 5} more)` : ''}`);
  if (extra.length) p.push(`unexpected identities outside the frozen contract: ${extra.slice(0, 5).join(' | ')}${extra.length > 5 ? ` (+${extra.length - 5} more)` : ''}`);
  const bad = tap.entries.filter((e) => !e.ok);
  if (bad.length) p.push(`${bad.length} failing/skipped/cancelled entries (e.g. ${bad[0].name})`);
  const s = tap.summary ?? {};
  if (!('tests' in s) || !('pass' in s)) p.push('summary counts (# tests/# pass) missing — truncated TAP refuses');
  else {
    if (s.tests !== n) p.push(`summary tests ${s.tests} != ${n} parsed entries`);
    const okN = tap.entries.filter((e) => e.ok).length;
    if (s.pass !== okN) p.push(`summary pass ${s.pass} != ${okN} ok entries`);
    for (const k of ['fail', 'cancelled', 'skipped', 'todo']) if ((s[k] ?? 0) !== 0) p.push(`summary ${k}=${s[k]} must be zero`);
  }
  return p;
}

// ---- step registries -------------------------------------------------------------------
const red = (msg) => ({ status: 'RED', msg });
const pass = (msg) => ({ status: 'PASS', msg });
const infra = (msg) => ({ status: 'INFRA', msg });

function lsTree(runFn, gitEnv, rev, repoRoot) {
  const res = runFn('git', ['ls-tree', '-r', '--name-only', '-z', rev], { cwd: repoRoot, env: gitEnv ? gitEnv() : undefined });
  if (res.rc !== 0) return null;
  return res.stdout.toString().split('\0').filter(Boolean);
}

export function buildStageSteps(stage, ctx) {
  const { repoRoot, runFn, gitEnv, expectedInputs } = ctx;
  const gitCli = (args) => runFn('git', args, { cwd: repoRoot, env: gitEnv ? gitEnv() : undefined });
  if (stage === 'S3') {
    return [
      ['s3-scope-extension', () => {
        const loaded = loadScopeExtension(repoRoot);
        if (loaded.absent) return red('S3 scope-extension ledger missing — the additive post-S2 inventory contract is not registered');
        if (!loaded.ok) return red(`invalid scope-extension ledger: ${loaded.problems.join(' | ')}`);
        const tree = gitCli(['rev-parse', `${ANCHORED_HEAD}^{tree}`]);
        if (tree.rc !== 0 || tree.stdout.toString().trim() !== ANCHORED_TREE) return infra('anchored base commit/tree does not resolve — git cannot confirm the 932ef452/tree4ca080 predecessor');
        const basePaths = lsTree(runFn, gitEnv, ANCHORED_HEAD, repoRoot);
        const livePaths = lsTree(runFn, gitEnv, 'HEAD', repoRoot);
        if (!basePaths || !livePaths) return infra('git ls-tree failed for anchored base or live HEAD');
        const problems = reconcileInventory({ repoRoot, basePaths, rulingPath: S2_RULING_PATH, livePaths, ledger: loaded.ledger });
        if (problems.length) return red(`additive inventory reconciliation refused: ${problems.slice(0, 6).join(' | ')}`);
        return pass(`live scope = historical committed scope + exactly ${admittedPaths(loaded.ledger).length} declared post-S2 paths (s3 added/pending + typed s4 index), every landed one sha-pinned (selfIndexed ledger excepted by contract); structural registration is not behavioral certification`);
      }],
      ['s3-policy-units', () => {
        const file = join(repoRoot, S3_POLICY_REL);
        if (!existsSync(file)) return red('frozen metric-policy copy missing from the s3 evidence set');
        const bytes = readFileSync(file);
        if (sha256buf(bytes) !== OWNER_POLICY_SHA256) return red('frozen policy bytes are NOT the owner oracle (ac0889cd…) — expected verdicts may not be edited to satisfy this check');
        let policy;
        try { policy = JSON.parse(bytes.toString('utf8')); } catch (e) { return red(`frozen policy unreadable: ${e.message}`); }
        const rows = evaluatePureCases(policy);
        if (rows.length !== (policy.pureMetricCases ?? []).length || rows.length === 0) return red('pure case table empty or mismatched — the frozen oracle did not replay');
        const failed = rows.filter((r) => !r.ok);
        if (failed.length) return red(`frozen metric-policy oracle caught consumer drift at: ${failed.map((r) => `${r.id}(got ${r.got}, want ${r.expected})`).join(', ')}`);
        return pass(`frozen owner oracle (byte-pinned ${OWNER_POLICY_SHA256.slice(0, 8)}…) green through the ACTUAL consumer on all ${rows.length} boundary cases — test-only liveness, never performance evidence`);
      }],
      ['s3-native-companion', () => {
        const res = runFn('node', ['--test', '--test-reporter=tap', 'scripts/test-assurance/s3.test.mjs'], { cwd: repoRoot, timeout: 240_000 });
        if (res.error) return infra(`native companion could not spawn: ${res.error.message}`);
        const out = res.stdout ? res.stdout.toString() : '';
        const tap = parseCompanionTap(out);
        if (res.rc !== 0) return red(`native companion RED (exit ${res.rc})`);
        // R5: bind the exact required identity population, plan/summary/entry reconciliation.
        const problems = validateCompanionResult(tap, REQUIRED_COMPANION_CONTROLS);
        if (problems.length) return red(`native companion population contract refused: ${problems.join(' | ')}`);
        return pass(`native companion TAP green and complete: ${tap.entries.length} entries == plan == summary, all ${REQUIRED_COMPANION_CONTROLS.length} frozen control identities present exactly once, 0 fail/skip/todo/cancel, normal exit`);
      }],
      ['s3-final-acceptance', () => {
        // R1/R2: computed from genuine bound records; fixed historical obligations can never
        // be closed by an emptied registry, a declared-but-absent CI path or an edited label.
        const open = [];
        if (!existsSync(join(repoRoot, S3_PERF_REL))) open.push('final 24-cell paired performance matrix not recorded (performance.json absent)');
        else {
          try {
            const perf = JSON.parse(readFileSync(join(repoRoot, S3_PERF_REL), 'utf8'));
            const v = validatePerformanceRecord(perf, repoRoot, { git: gitCli, expectedInputs });
            if (!v.ok) open.push(`paired matrix not structurally accepted: ${v.problems.slice(0, 4).join(' | ')}`);
          } catch (e) { open.push(`performance.json unreadable: ${e.message}`); }
        }
        let coverage = null;
        try { coverage = JSON.parse(readFileSync(join(repoRoot, S3_COVERAGE_REL), 'utf8')); } catch { open.push('coverage.json (open-items registry) missing or unreadable'); }
        if (coverage) {
          const present = new Map((coverage.historicalOpen ?? []).map((i) => [i.id, i]));
          for (const id of REQUIRED_COVERAGE_IDS) {
            const item = present.get(id);
            if (!item) { open.push(`required historical obligation ${id} MISSING from the registry — an emptied registry never closes obligations`); continue; }
            if (item.status === 'closed') {
              // R2: obligation-specific semantic closure — a sha proves bytes, never discharge.
              const problems = validateHistoricalClosure(item, repoRoot, { git: gitCli, expectedInputs });
              if (problems.length) open.push(`${id}: closure refused — ${problems.slice(0, 3).join(' | ')}`);
            } else open.push(`${id}: ${item.status} — ${item.detail ?? ''}`);
          }
        }
        const loaded = loadScopeExtension(repoRoot);
        let ciClosed = false;
        if (loaded.ok) {
          const declared = loaded.ledger.s4EvidenceIndex.declaredPaths;
          const ciReceipts = declared.filter((e) => e.kind === 'ci-record');
          if (ciReceipts.length === 0) open.push('CI NOT_STARTED — no typed s4 ci-record declared');
          else {
            const sig = sourceSignatureSafe(repoRoot, loaded.ledger);
            const problems = [];
            for (const e of ciReceipts) {
              const file = join(repoRoot, e.path);
              if (!existsSync(file)) { problems.push(`declared ci-record absent: ${e.path}`); continue; }
              if (HEX64.test(e.sha256 ?? '') && sha256buf(readFileSync(file)) !== e.sha256) { problems.push(`ci-record pin mismatch: ${e.path}`); continue; }
              let receipt;
              try { receipt = JSON.parse(readFileSync(file, 'utf8')); } catch (err) { problems.push(`ci-record unreadable: ${e.path} (${err.message})`); continue; }
              problems.push(...evaluateReceipt(e.path, receipt, 'ci-record', { repoRoot, ledger: loaded.ledger, git: gitCli, sourceSignature: sig, expectedInputs }));
            }
            if (problems.length) open.push(`CI receipt not accepted: ${problems.slice(0, 3).join(' | ')}`);
            else ciClosed = true;
          }
        }
        if (open.length) return red(`stage S3 cannot be accepted yet — computed open items: ${open.join(' | ')}`);
        return pass('all computed acceptance inputs green: complete bound 24-cell matrix within policy, fixed historical obligations genuinely closed with verified evidence, typed CI receipt accepted');
      }],
    ];
  }
  if (stage === 'S4') {
    return [
      ['s4-fail-closed-gate', () => {
        const loaded = loadScopeExtension(repoRoot);
        if (!loaded.ok) return red(`S4 cannot even evaluate without a valid S3 scope-extension ledger: ${loaded.absent ? 'ledger absent' : loaded.problems.join(' | ')}`);
        // R3: validate EVERY live pin before any receipt is considered — changed or missing
        // live code invalidates receipts instead of re-blessing ledger declarations.
        const pinProblems = [];
        verifyRegisteredFiles(repoRoot, loaded.ledger, pinProblems);
        if (pinProblems.length) return red(`live scope/pin validation refused (receipts cannot bless drifted code): ${pinProblems.slice(0, 4).join(' | ')}`);
        // R3: no six-receipt combination can certify S4 without the genuine ORDERED chain of
        // ACCEPTED S2 then ACCEPTED S3 predecessor evidence bound to this exact code line.
        const prereq = validatePredecessors(loaded.ledger, repoRoot, gitCli, { expectedInputs });
        if (!prereq.ok) return red(`ordered accepted S2→S3 predecessors not established — S4 stays nonPASS: ${prereq.problems.slice(0, 3).join(' | ')}`);
        const tree = gitCli(['rev-parse', `${ANCHORED_HEAD}^{tree}`]);
        if (tree.rc !== 0 || tree.stdout.toString().trim() !== ANCHORED_TREE) return infra('anchored predecessor tree does not resolve');
        const head = gitCli(['rev-parse', 'HEAD']);
        if (head.rc !== 0) return infra('git cannot resolve live HEAD');
        const ctx = {
          repoRoot, ledger: loaded.ledger, git: gitCli,
          headSHA: head.stdout.toString().trim(),
          sourceSignature: sourceSignature(repoRoot, loaded.ledger), // live bytes (R3)
          expectedInputs, // conditional data-validation input; never authentication
        };
        const idx = loaded.ledger.s4EvidenceIndex;
        const problems = [];
        for (const kind of S4_REQUIRED_KINDS) {
          const declared = idx.declaredPaths.filter((e) => e.kind === kind);
          if (declared.length === 0) { problems.push(`missing independent ${kind} receipt`); continue; }
          for (const e of declared) {
            const file = join(repoRoot, e.path);
            if (!existsSync(file)) { problems.push(`declared ${kind} receipt absent: ${e.path}`); continue; }
            let receipt;
            try { receipt = JSON.parse(readFileSync(file, 'utf8')); } catch (err) { problems.push(`${kind} receipt unreadable: ${e.path} (${err.message})`); continue; }
            problems.push(...evaluateReceipt(e.path, receipt, kind, ctx));
          }
        }
        if (problems.length) return red(`S4 fail-closed refusal — required proof missing or invalid (never fabricated): ${problems.join(' | ')}`);
        return pass('all six S4 proof kinds present with full schemas, positive verdicts, independent sessions, provenance artifacts, live-bytes source signature and evidence-only measured-code binding');
      }],
    ];
  }
  throw new Error(`buildStageSteps: unknown stage ${stage}`);
}

function sourceSignatureSafe(repoRoot, ledger) {
  try { return sourceSignature(repoRoot, ledger); } catch { return '<live-source-unreadable>'; }
}
