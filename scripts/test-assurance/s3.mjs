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
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

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
  "UPSTREAM-TRANSFER: the pinned Root-reviewed current-transfer checkpoint reconciles the complete 571-row set as 568 preserved bc8-origin blobs plus exactly three admitted assertion-preserving replacements",
  "UPSTREAM-TRANSFER: a changed, missing, mode-swapped or extra upstream-origin path without an admitted replacement refuses, and a wrong checkpoint head/tree/parent refuses",
  "UPSTREAM-TRANSFER: the finite LIVE leg — a live-only extra path, a live-tree change without an admitted replacement, a live-tree missing row and broken live-HEAD ancestry each refuse, and the cf64-union-bc8 lineage surface stays exactly covered",
  "UPSTREAM-TRANSFER (unit 36): the complete finite current subject — an unknown non-row byte or mode mutation refuses, a missing original path refuses, and a typed pending path reports the honest admission-pending class instead of passing or erroring",
  "LEDGER-CHANNEL (unit 37): the exact existing v1 channel — baseline is valid-unactivated, the exact proposed activated ledger L validates with exactly two new rows, and any other field/member/order/hash change refuses",
  "LEDGER-CHANNEL (unit 37): governed verdicts are paired before/after activation — activated content-bound discharges, activated pin-mismatch refuses, unactivated mismatch defers to the caller pending class, and missing/mode-wrong/legacy-pinless rows refuse",
  "LEDGER-CHANNEL (unit 37): a tampered live ledger refuses end-to-end through reconcileCurrentTransfer — selfIndexed normalization is the only admission, never a blanket exception",
  "LEDGER-CHANNEL (unit 38): the committed live HEAD ledger object is bound — wrong-note, unresolvable, deleted or mode-swapped committed entries refuse, and healthy baseline/activated twins admit",
  "LEDGER-CHANNEL (unit 46): the two optional guard rows are absent-or-exactly-BOTH — absent keeps fb1 activated and guard bytes hard-refusing, both append as the finite governed extension, every malformed supply refuses",
  "LEDGER-CHANNEL (unit 46): guard governed verdicts — activated pins bind real live bytes, swapped hashes refuse, missing/mode-wrong refuse, and pinless pre-activation stays pending-class",
  "LEDGER-CHANNEL (unit 46): end-to-end through reconcileCurrentTransfer — without the rows a changed guard path is a HARD nonrow refusal; with BOTH valid rows binding the actual bytes it discharges",
  "CURRENT-ONLY F1 SUCCESSOR (unit 41): the unchanged reviewed baseline twin — original blob on both legs — admits",
  "CURRENT-ONLY F1 SUCCESSOR (unit 41): the exact Root-admitted generated postimage on the live leg admits",
  "CURRENT-ONLY F1 SUCCESSOR (unit 41): the generated successor appearing in the cd3 checkpoint leg refuses — the historical baseline never updates",
  "CURRENT-ONLY F1 SUCCESSOR (unit 41): counterfeit bytes served under the generated OID refuse",
  "CURRENT-ONLY F1 SUCCESSOR (unit 41): counterfeit bytes served under the reviewed original OID refuse",
  "CURRENT-ONLY F1 SUCCESSOR (unit 41): a mode or kind swap on the successor path refuses",
  "CURRENT-ONLY F1 SUCCESSOR (unit 41): the successor row missing from the live tree refuses",
  "CURRENT-ONLY F1 SUCCESSOR (unit 41): an unreadable successor blob refuses",
  "CURRENT-ONLY F1 SUCCESSOR (unit 41): the successor pattern applied to any other unadmitted path refuses — no wildcard, class or prefix",
  "CURRENT-ONLY F1 SUCCESSOR (unit 41): a tampered checkpoint origin (neither reviewed nor admitted OID) refuses",
  "CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): the exact Root-admitted CI repair postimage on the live leg admits (checkpoint keeps the frozen original)",
  "CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): the unchanged original on both legs admits — live-original compatibility",
  "CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): the successor appearing in the checkpoint leg refuses — the frozen checkpoint identity never updates",
  "CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): an unknown live replacement OID refuses — only the original or the one exact successor admit",
  "CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): a mode or kind swap on the live leg refuses",
  "CURRENT-ONLY WORKFLOW SUCCESSOR (unit 54): unchanged mode with a wrong live kind refuses while the paired restored-kind control admits",
  "CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): the workflow path missing from the live tree refuses — deletion is not an admitted successor",
  "CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): an unreadable successor or original blob refuses",
  "CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): counterfeit bytes served under the successor OID refuse",
  "CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): counterfeit bytes served under the original OID refuse",
  "F3 unit-63 optional smoke rows: absent-or-exactly-BOTH, fixed appended order, never in baseline",
  "LEDGER-CHANNEL (unit 64): the ACTIVE smoke pair is ADDITIVE — both rows binding live bytes govern the changed helper while the typed workflow successor gate stays fully load-bearing end-to-end",
  "CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): the admitted successor OID presented under a different non-row path refuses — no wildcard, class or prefix",
  "CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): a successor entry binding neither a reviewed row nor a checkpoint path refuses — a dead admission entry never normalizes",
  "UPSTREAM-TRANSFER: the actual lineage detector disabled counterfactual - intact refuses a bad isolated fixture, the narrowly disabled detector incorrectly allows it, restored bytes refuse again",
  "PORTABLE-REFERENCE: the admitted bundle artifact is byte-pinned and a truncated, corrupted or foreign artifact refuses before any transport",
  "PORTABLE-REFERENCE: hydration from published objects only builds a uniquely owned isolated store - six objects absent before, exact tuples after, real chain preserved, generation NOT ancestor of published staging",
  "PORTABLE-REFERENCE: a corrupted pack refuses natively and no shared git state is written (store custody stays private and retained)",
  "CURRENT-ONLY B-DELTA (unit 70): the exact Root-admitted finite B-delta legs admit — the 27 changed checkpoint paths, the one frozen-571-row live leg and the workflow merge successor reconcile clean in the candidate-shaped twin",
  "CURRENT-ONLY B-DELTA (unit 70): counterfeit bytes under an admitted B tuple OID refuse, and an unknown live replacement OID on a changed checkpoint path refuses",
  "CURRENT-ONLY B-DELTA (unit 70): an exact admitted new upstream path admits while a 29th unknown new path, a mode swap and counterfeit bytes on a listed path refuse",
  "CURRENT-ONLY B-DELTA (unit 70): the finite delta is ancestry-bound — a live HEAD that did not merge the exact reviewed B refuses even with every content tuple exact",
  "CURRENT-ONLY B-DELTA (unit 70): an admitted new upstream path missing from the live tree is a dead admission entry and refuses",
  "CURRENT-ONLY B-DELTA (unit 71): a listed new upstream path already present in the frozen checkpoint refuses — a current-upstream addition extends an ABSENT surface",
  "CURRENT-ONLY B-DELTA (unit 71): a listed new upstream path whose pinned tuple is not the immutable B tree source leg refuses — wrong-B provenance never admits",

  "CURRENT-ONLY SELECTED-LEG IDENTITY (unit 72): an unchanged original 100644 leg and the exact admitted successor 100755 leg both admit on a mode-changing successor — crossed mode/OID combinations refuse",
  "INVENTORY-B-DELTA (unit 74): a clean typed current transfer admits the exact finite B-delta new upstream paths into the additive inventory",
  "INVENTORY-B-DELTA (unit 74): a failed or absent typed current transfer keeps every B-delta path unregistered — no automatic live-diff approval",
  "INVENTORY-B-DELTA (unit 74): even with a clean typed current transfer an unknown 29th new upstream path refuses",
  "CURRENT-PRODUCER SELECTION (unit 78): the exact qualified inline row \u2014 clean full typed transfer, fixed nine-path closure with every dependency's actual committed live-HEAD tuple selected and byte-exact physical working files \u2014 selects the current variant with the distinct accepted message",
  "CURRENT-PRODUCER SELECTION (unit 78): an unknown live hash on the subject (neither frozen original nor exact successor) refuses the current variant",
  "CURRENT-PRODUCER SELECTION (unit 78): a failed typed current transfer (broken B surface) refuses the current variant",
  "CURRENT-PRODUCER SELECTION (unit 78): a second changed producer outside the single typed subject refuses \u2014 all other frozen producers stay strict",
  "CURRENT-PRODUCER SELECTION (unit 78): a closure dependency missing from the working tree refuses the current variant",
  "CURRENT-PRODUCER SELECTION (unit 78): a drifted working dependency (bytes differ from the selected committed identity) refuses the current variant",
  "CURRENT-PRODUCER SELECTION (unit 78): a leaf-symlinked working dependency refuses physically \u2014 no closure identity through a link",
  "CURRENT-PRODUCER SELECTION (unit 78): a byte-matching parent-directory symlink escape refuses physically even when every file inside is byte-exact",
  "CURRENT-PRODUCER SELECTION (unit 78): a committed ORIGINAL live-HEAD leg with successor-only working bytes refuses \u2014 the selected committed tuple must be the current one",
  "CURRENT-PRODUCER SELECTION (unit 78): the paired crossing \u2014 committed current tuple with original-only working bytes \u2014 refuses on the physical working identity",
  "CURRENT-PRODUCER QUALIFICATION DEFECTS (unit 78): the genuine inline member of the immutable row is defect-free against the independently fixed authority",
  "CURRENT-PRODUCER QUALIFICATION DEFECTS (unit 78): a typed row without the qualified currentProducerBehavior member keeps the frozen refusal",
  "CURRENT-PRODUCER QUALIFICATION DEFECTS (unit 78): a wrong NONZERO Root qualification sha (shape-valid, value-wrong) is refused \u2014 exact known data admits, not any nonzero hex",
  "CURRENT-PRODUCER QUALIFICATION DEFECTS (unit 78): a wrong NONZERO source-acceptance receipt is refused",
  "CURRENT-PRODUCER QUALIFICATION DEFECTS (unit 78): a wrong NONZERO normal-witness hash is refused",
  "CURRENT-PRODUCER QUALIFICATION DEFECTS (unit 78): a wrong population and result on a normal witness (PASS343 FAIL1 EXIT1) is refused",
  "CURRENT-PRODUCER QUALIFICATION DEFECTS (unit 78): a wrong hosted run binding (run id, steps, conclusion) is refused",
  "CURRENT-PRODUCER QUALIFICATION DEFECTS (unit 78): a wrong NONZERO staging-squash acceptance that does not extend the reviewed B binding is refused",
  "CURRENT-PRODUCER QUALIFICATION DEFECTS (unit 78): a counterfeit all-zero witness identity is refused \u2014 zero is never a hash",
  "CURRENT-PRODUCER QUALIFICATION DEFECTS (unit 78): an omitted closure row (subset retaining the subject, dropping lib.sh) is refused and the omitted dependency's drifted working file is still caught by the fixed-nine selector walk",
  "CURRENT-PRODUCER QUALIFICATION DEFECTS (unit 78): an extra closure row beyond the nine refuses \u2014 no tenth dependency rides the qualification",
  "CURRENT-PRODUCER QUALIFICATION DEFECTS (unit 78): a replaced closure tuple with a wrong nonzero gitBlob pin is refused",
  "CURRENT-PRODUCER QUALIFICATION DEFECTS (unit 78): a duplicate closure path is refused",
  "CURRENT-PRODUCER QUALIFICATION DEFECTS (unit 78): a path-escaping closure entry is refused",
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

export function rowPathCount(integration) {
  return integration?.ok ? (integration.data.currentLineageOnlyScope.upstreamAdditions ?? []).length : 0;
}

// Optional pendingBindings ({channel, paths}): with a VALID but UNACTIVATED existing-ledger
// channel, a sha-pin drift on one of the five governed source paths is the honest finite
// PENDING diagnostic instead of a hard mismatch — the discharge requires actual Root final
// admission of the activated ledger. Without the parameter (the S4 fail-closed gate) every
// drift stays HARD: receipts never bless changed code.
export function verifyRegisteredFiles(repoRoot, ledger, problems, pendingBindings) {
  const pend = (path) => !!(pendingBindings && pendingBindings.channel?.ok && !pendingBindings.channel.activated && pendingBindings.paths?.has(path));
  const pendingLabel = (path) => `pending actual Root admission: ${path} live bytes differ from the unactivated ledger pin — the five pending entries discharge only through actual Root final admission of the activated ledger`;
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
    try { if (sha256buf(readFileSync(file)) !== row.sha256) problems.push(pend(row.path) ? pendingLabel(row.path) : `pinned sha mismatch at ${row.path}`); }
    catch { problems.push(`registered path unreadable: ${row.path}`); }
  }
  for (const row of ledger.modifiedPaths ?? []) {
    const file = join(repoRoot, row.path);
    if (!existsSync(file)) problems.push(`modifiedPaths entry absent on disk: ${row.path}`);
    else { try { if (sha256buf(readFileSync(file)) !== row.sha256) problems.push(pend(row.path) ? pendingLabel(row.path) : `modified path drifted from pinned sha: ${row.path}`); } catch { problems.push(`modified path unreadable: ${row.path}`); } }
  }
}

// Root unit-78 (fa163a10 R77-1/R77-2/R77-3): the admission entrypoint takes NO caller table.
// The authority is the frozen ADMITTED_CURRENT_ONLY_SUCCESSORS setup40 row bound field-for-field
// to the INDEPENDENTLY FIXED constants below — the actual 742/957703/b706 facts written as a
// SECOND literal, never derived from the row at runtime and never accepted from a caller. A
// test seam may falsify the validator (currentProducerQualificationDefects over a mutated
// structuredClone of the genuine member); it can never replace its authority: every
// qualification/source/witness/population/hosted value must EQUAL the exact known data, not
// merely be nonzero-hex/positive-integer-shaped. The selector walks the FIXED nine closure
// paths — an omitted/replaced/extra/duplicate row in any behavior object cannot shrink it —
// and binds every dependency's ACTUAL committed live-HEAD tuple (mode/kind/OID/served bytes)
// through the shared git runner before the physical working file is trusted: a committed
// ORIGINAL leg with successor-only working bytes refuses, and the EXISTING symlinkEscape
// helper guards the parent directories on top of the leaf lstat identity. There is still NO
// proof file, loader, schema/store, runtime Root-acceptance flag, timestamp or caller-supplied
// pass object anywhere on this path. The original-versus-successor permitted semantics of
// every OTHER row and branch of the full typed transfer stay unchanged.
export const EXACT_QUALIFIED_CURRENT_PRODUCER = {
  subject: {
    path: 'setup.d/40-configs.sh',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: '84be9fdecebbcb76d42f7adfb7c6d01d3e5cd4cf', sha256: '6fbda6e4610d948c938ea24f3fbd31a1fa5623b148d1db90c44fefbae803e9fe', bytes: 53605 },
    live: { mode: '100644', kind: 'blob', gitBlob: '0e260a97ae37a647e225d639753923febdb3859c', sha256: 'f1c635252c516775983252bce6deb41659e59b46a01da731a0c6a2b757915fa0', bytes: 57474 },
  },
  qualification: {
    rootRuling: { rel: 'ROOT-CURRENT-F1C-EXISTING-SOURCE-BEHAVIOR-PROOF-QUALIFIED.json', sha256: '742a2d88dfabae919f55d184c3d5b8390d768119490517051d2f9d56ea76861e', bytes: 3346 },
    originalEvidencePacket: { rel: 'ONEBUTTON-SOURCE40-F1C-EXACT-PROOFS-AND-TAK-PUBLICATION-BOUNDARY.json', sha256: '957703b017d43239bcb53fdaaadde2ad5537d8da7b75dad44a4b663f82316d58', bytes: 17186 },
  },
  sourceAcceptance: {
    onebuttonHead: '0855d375795d743b0d7fdbbf7d3884e68e68ff1c',
    onebuttonTree: 'd486fb3c29f596831a811a07e5c718dff19fb074',
    pr: 'artyhoo/getff#2142',
    stagingSquash: 'b714f7c1a6e40488e8f016665d7fffc0cd513a3d',
    source: { sha256: 'f5361e09f4a5ae109a135922486c189fc64388f6050020ce570af94d0aec48d2', bytes: 4971 },
    code: { sha256: '473c2fd3a6603a2a2d812d284a0db95c4c857236f1e36f3b8626b5dbcb3a98e3', bytes: 2185 },
    what6: { sha256: '3083efb695ee51dd016dffd324486300244edb83f534e56b60fa84d25f7ecf57', bytes: 3293 },
  },
  normalWitnesses: {
    generic344: { rel: 'r12-1-genericstack-GREEN.log', sha256: 'f88c2f7e547ebb89f183a8950d3f7fdf38bca774cb4280354678d424a39092ed', bytes: 21462, result: 'PASS344 FAIL0 EXIT0' },
    genericBinding: { rel: 'ACTUAL-716-COMMITTED-REPAIR-PEER-HANDOFF.json', sha256: '85078b9e8b4819d537f74946bd105d7efd58fed09b2d4e31f61c8d2b40f24954', bytes: 16039 },
    genericD1Original312: { rel: '03b-final-battery-generic-stack.log', sha256: 'ca7f275e053d3a53f8f1be3cac101d237e07eef42463c012efa937ad283daa15', bytes: 19008 },
    originalSource10Binding: { rel: 'ACTUAL-C535-AFFECTED-SOURCE-ACCEPTANCE-HANDOFF.json', sha256: 'ac80705543139b2cbd2a4b8adb803b45a162f4ca0469552a30131cdc885488ff', bytes: 12611 },
    linter35: { rel: '04-final-linter-slot.log', sha256: '3058227093acb0f4e95084e21cb94d27e8885cd4e10eea4398d1a379cbb60bef', bytes: 5972, result: 'PASS35 FAIL0 EXIT0' },
    finalHosted: { runId: 41587408035, conclusion: 'success', genericWorkflowStep: 948, linterWorkflowStep: 962, whole: { sha256: '5322c0d836a1bfebd75f34d01299516e2535a2270d66608b7b070fe8c8c63807', bytes: 6122 }, savedChecks: { sha256: '63bdc4933cb664054f6c8fcd473c05a7250eca35f59d381f2e5eeaad1f82d1a3', bytes: 9352 } },
  },
  sourceClosure: {
    paths: [
      { path: 'install.sh', mode: '100755', kind: 'blob', gitBlob: '291eaec2f49c38a372a71900a243f76b98c0985a', sha256: '3fecefe2617b531f0e35eef14a6eaf56d2508f946a696632127d0e0c75f11376', bytes: 127737 },
      { path: 'setup.d/lib.sh', mode: '100644', kind: 'blob', gitBlob: '5a6666a7c3a28da7e007504c8b187fee62abbd41', sha256: '2a0de8efa9d0fa876ff87fa316ab5fa2b9f5cd25d1108e995391473b0b42a25b', bytes: 317922 },
      { path: 'setup.d/40-configs.sh', mode: '100644', kind: 'blob', gitBlob: '0e260a97ae37a647e225d639753923febdb3859c', sha256: 'f1c635252c516775983252bce6deb41659e59b46a01da731a0c6a2b757915fa0', bytes: 57474 },
      { path: 'setup.d/50-hooks.sh', mode: '100644', kind: 'blob', gitBlob: '84cd12adaacaa89c34cccf37fc8b41566a1d847d', sha256: '6f7cac83ba442347ee3d94287355632cc5a17d798dd399ebf45478e6a7ec34c1', bytes: 7325 },
      { path: 'setup.d/99-finalize.sh', mode: '100644', kind: 'blob', gitBlob: '08e0ddd64a49701773a034716749032c2c863b87', sha256: '213ea60d3675f6a13b9ce352037547507c47e5dfae5291bac01e8092a60c4b9e', bytes: 52776 },
      { path: 'packages/core/templates/shared/husky-pre-commit-generic.sh', mode: '100755', kind: 'blob', gitBlob: 'a63aedfdcf7a7663ae900c2849ecc1a9ed2055de', sha256: '5a9724e78c96b2958b2048fffd0b00a1ef689a3c31b1e4b716f36f3760d6b517', bytes: 1215 },
      { path: 'packages/core/templates/shared/getff-rules-generic.yml', mode: '100644', kind: 'blob', gitBlob: 'b354823187408b5f7fb0b8daa712e2afa73c5e29', sha256: '3d463e3caad19e19e178e3e935d5f0c24831bc33b0ddcb0cb83a2ad05ac28ba1', bytes: 2918 },
      { path: 'tests/install-sh/generic-stack.test.sh', mode: '100755', kind: 'blob', gitBlob: '7a68778b87515c30b92b1be336a5c8006ccda743', sha256: '3bb9681a20f408e1e1fe832c945bfdb9611a94266dca1d2e0f580a40e2f9b09f', bytes: 77301 },
      { path: 'tests/install-sh/linter-slot.test.sh', mode: '100755', kind: 'blob', gitBlob: 'c655c391165d26a67b02f898106a9ebf53d62151', sha256: 'eb7e35e8cadd613469bc9ca3767d0057366532418fc0990dccfb84f99bc073bf', bytes: 16259 },
    ],
    libShOnlyDifference: { onebutton: '7440f6fc16824279eafc1ee2975c29a04e54b09ceeed8c21344d4e0bc1a67aaf', tak: '2a0de8efa9d0fa876ff87fa316ab5fa2b9f5cd25d1108e995391473b0b42a25b', diff: { sha256: '051bd8e9bf13af4856d01c6a577da7a70f88c7b06a9aca68426520b7af0b08d9', bytes: 720 }, meaning: 'only the f2-hook-activation.test.sh citation 34->36 inside a JavaScript comment; runtime statement bytes unchanged — no general comment normalization' },
  },
};

// The finite-fact validator (Root fa163a10 R77-1). The shape prechecks keep the counterfeit
// zero and malformed-identity refusals; then EVERY finite fact must equal the independently
// fixed qualified value. Wrong NONZERO data is exactly as dead as zero data — exact known
// data admits, never valid-shaped replacement data.
export function currentProducerQualificationDefects(behavior) {
  if (!behavior || typeof behavior !== 'object') return ['typed current-producer row setup.d/40-configs.sh carries no qualified currentProducerBehavior member — the finite qualification lives only on the immutable reviewed row, never in caller data'];
  const problems = [];
  const hex40 = (v) => typeof v === 'string' && /^[0-9a-f]{40}$/.test(v) && !/^0+$/.test(v);
  const hex64nz = (v) => typeof v === 'string' && HEX64.test(v ?? '') && !/^0+$/.test(v);
  const sized = (v) => v && typeof v === 'object' && Number.isInteger(v.bytes) && v.bytes > 0;
  const q = behavior.qualification ?? {};
  for (const [k, row] of [['rootRuling', q.rootRuling], ['originalEvidencePacket', q.originalEvidencePacket]]) if (!sized(row) || !hex64nz(row.sha256)) problems.push(`qualification ${k} must carry a nonzero sha256 and positive byte size — a counterfeit zero identity is never a receipt`);
  const acc = behavior.sourceAcceptance ?? {};
  if (!hex40(acc.onebuttonHead) || !hex40(acc.onebuttonTree)) problems.push('source acceptance onebutton head/tree identities missing or zero');
  if (!hex40(acc.stagingSquash)) problems.push('source acceptance staging squash missing or zero');
  else if (acc.stagingSquash !== ADMITTED_CURRENT_B_BINDING.bHead) problems.push(`row staging squash ${acc.stagingSquash} does not extend the reviewed upstream B binding ${ADMITTED_CURRENT_B_BINDING.bHead} — a wrong acceptance never selects the current variant`);
  for (const [k, row] of [['source', acc.source], ['code', acc.code], ['what6', acc.what6]]) if (!sized(row) || !hex64nz(row.sha256)) problems.push(`source acceptance ${k} receipt must carry a nonzero sha256 and positive byte size`);
  const w = behavior.normalWitnesses ?? {};
  for (const k of ['generic344', 'genericBinding', 'genericD1Original312', 'originalSource10Binding', 'linter35']) if (!sized(w[k]) || !hex64nz(w[k]?.sha256)) problems.push(`normal witness ${k} receipt missing, zero-byte or counterfeit-zero — genuine empty stderr has its real sha256, all-zero hex is never its hash`);
  const fh = w.finalHosted ?? {};
  if (!Number.isInteger(fh.runId) || fh.runId <= 0 || fh.conclusion !== 'success' || !Number.isInteger(fh.genericWorkflowStep) || !Number.isInteger(fh.linterWorkflowStep) || !sized(fh.whole) || !hex64nz(fh.whole?.sha256) || !sized(fh.savedChecks) || !hex64nz(fh.savedChecks?.sha256)) problems.push('final hosted normal witness (run/workflow steps/whole-run receipts) incomplete');
  // ---- exact known data (fa163a10 R77-1): equal values, not valid shapes --------------------
  const exact = EXACT_QUALIFIED_CURRENT_PRODUCER;
  const show = (v) => (typeof v === 'string' ? `"${v.length > 44 ? v.slice(0, 44) + '…' : v}"` : String(v));
  const eqScalar = (label, got, want) => { if ((got ?? null) !== (want ?? null)) problems.push(`${label} is not the independently fixed qualified value (got ${show(got ?? null)}, want ${show(want ?? null)}) — exact known data admits, never valid-shaped replacement data`); };
  const eqReceipt = (label, got, want, keys) => { for (const k of keys) eqScalar(`${label}.${k}`, got?.[k], want?.[k]); };
  eqReceipt('qualification.rootRuling', q.rootRuling, exact.qualification.rootRuling, ['rel', 'sha256', 'bytes']);
  eqReceipt('qualification.originalEvidencePacket', q.originalEvidencePacket, exact.qualification.originalEvidencePacket, ['rel', 'sha256', 'bytes']);
  eqScalar('sourceAcceptance.onebuttonHead', acc.onebuttonHead, exact.sourceAcceptance.onebuttonHead);
  eqScalar('sourceAcceptance.onebuttonTree', acc.onebuttonTree, exact.sourceAcceptance.onebuttonTree);
  eqScalar('sourceAcceptance.pr', acc.pr, exact.sourceAcceptance.pr);
  eqScalar('sourceAcceptance.stagingSquash', acc.stagingSquash, exact.sourceAcceptance.stagingSquash);
  eqReceipt('sourceAcceptance.source', acc.source, exact.sourceAcceptance.source, ['sha256', 'bytes']);
  eqReceipt('sourceAcceptance.code', acc.code, exact.sourceAcceptance.code, ['sha256', 'bytes']);
  eqReceipt('sourceAcceptance.what6', acc.what6, exact.sourceAcceptance.what6, ['sha256', 'bytes']);
  for (const k of ['generic344', 'genericBinding', 'genericD1Original312', 'originalSource10Binding', 'linter35']) eqReceipt(`normalWitnesses.${k}`, w[k], exact.normalWitnesses[k], ['rel', 'sha256', 'bytes', 'result']);
  eqScalar('normalWitnesses.finalHosted.runId', fh.runId, exact.normalWitnesses.finalHosted.runId);
  eqScalar('normalWitnesses.finalHosted.conclusion', fh.conclusion, exact.normalWitnesses.finalHosted.conclusion);
  eqScalar('normalWitnesses.finalHosted.genericWorkflowStep', fh.genericWorkflowStep, exact.normalWitnesses.finalHosted.genericWorkflowStep);
  eqScalar('normalWitnesses.finalHosted.linterWorkflowStep', fh.linterWorkflowStep, exact.normalWitnesses.finalHosted.linterWorkflowStep);
  eqReceipt('normalWitnesses.finalHosted.whole', fh.whole, exact.normalWitnesses.finalHosted.whole, ['sha256', 'bytes']);
  eqReceipt('normalWitnesses.finalHosted.savedChecks', fh.savedChecks, exact.normalWitnesses.finalHosted.savedChecks, ['sha256', 'bytes']);
  // ---- EXACT nine-path closure (fa163a10 R77-2): set equality in BOTH directions -------------
  const gotPaths = Array.isArray(behavior.sourceClosure?.paths) ? behavior.sourceClosure.paths : [];
  for (const row of gotPaths) if (!row || typeof row.path !== 'string' || row.path === '' || isAbsolute(row.path) || row.path.split('/').includes('..')) problems.push(`closure path escapes the repository-relative surface: ${JSON.stringify(row && row.path)}`);
  const seen = new Set();
  for (const row of gotPaths) { if (seen.has(row?.path)) problems.push(`duplicate closure path in the typed row: ${row?.path}`); seen.add(row?.path); }
  const exactPaths = exact.sourceClosure.paths;
  for (const want of exactPaths) if (!seen.has(want.path)) problems.push(`the qualified source closure must pin exactly the nine qualified dependencies — ${want.path} is omitted (a subset retaining the subject never shrinks the closure)`);
  for (const p of seen) if (!exactPaths.some((r) => r.path === p)) problems.push(`closure path ${p} is not one of the nine qualified dependencies — an extra or replaced row never rides the qualification`);
  const exactByPath = new Map(exactPaths.map((r) => [r.path, r]));
  for (const row of gotPaths) {
    const want = exactByPath.get(row?.path);
    if (!want) continue;
    for (const k of ['mode', 'kind', 'gitBlob', 'sha256', 'bytes']) eqScalar(`closure tuple ${row.path}.${k}`, row[k], want[k]);
  }
  const lsd = behavior.sourceClosure?.libShOnlyDifference;
  const lsdExact = exact.sourceClosure.libShOnlyDifference;
  eqScalar('sourceClosure.libShOnlyDifference.onebutton', lsd?.onebutton, lsdExact.onebutton);
  eqScalar('sourceClosure.libShOnlyDifference.tak', lsd?.tak, lsdExact.tak);
  eqScalar('sourceClosure.libShOnlyDifference.diff.sha256', lsd?.diff?.sha256, lsdExact.diff.sha256);
  eqScalar('sourceClosure.libShOnlyDifference.diff.bytes', lsd?.diff?.bytes, lsdExact.diff.bytes);
  eqScalar('sourceClosure.libShOnlyDifference.meaning', lsd?.meaning, lsdExact.meaning);
  return problems;
}

// Root fa163a10 R77-1/R77-2/R77-3 — the ONE admission entrypoint. No successors-table
// parameter exists: the row is found ONLY in the frozen reviewed table and must equal the
// independently fixed qualified subject leg-for-leg. The walk below runs over the FIXED nine
// paths and never reads caller data for admission.
export function selectCurrentProducerSubject({ repoRoot, git, carrier, subjects, changedSubjects }) {
  if (!Array.isArray(changedSubjects) || changedSubjects.length === 0) return { status: 'refused', problems: ['current-producer selection requires the changed subject list'], message: '' };
  const typed = ADMITTED_CURRENT_ONLY_SUCCESSORS.filter((s) => changedSubjects.includes(s.path));
  if (changedSubjects.length !== 1 || typed.length !== 1 || typed[0].path !== EXACT_QUALIFIED_CURRENT_PRODUCER.subject.path) return { status: 'refused', problems: [`changed producers outside the single typed current-producer subject refuse (all other frozen producers stay strict): ${changedSubjects.join(', ')}`], message: '' };
  const successor = typed[0];
  const frozen = (subjects ?? []).find((b) => b.path === successor.path);
  if (!frozen || frozen.sha256 !== successor.checkpoint.sha256) return { status: 'refused', problems: [`typed current-producer subject ${successor.path} does not extend the frozen S2 pin (frozen ${frozen && frozen.sha256 ? frozen.sha256.slice(0, 12) : 'absent'} vs checkpoint leg ${successor.checkpoint.sha256.slice(0, 12)})`], message: '' };
  const exactSub = EXACT_QUALIFIED_CURRENT_PRODUCER.subject;
  for (const leg of ['checkpoint', 'live']) {
    const a = successor[leg];
    const b = exactSub[leg];
    if (a.mode !== b.mode || a.kind !== b.kind || a.gitBlob !== b.gitBlob || a.sha256 !== b.sha256 || a.bytes !== b.bytes) return { status: 'refused', problems: [`typed current-producer row ${successor.path} ${leg} leg (${a.gitBlob.slice(0, 12)}/${a.sha256.slice(0, 12)}/${a.bytes}B/${a.mode}) is not the independently fixed qualified subject ${leg} leg (${b.gitBlob.slice(0, 12)}/${b.sha256.slice(0, 12)}/${b.bytes}B/${b.mode}) — row drift never selects the current variant`], message: '' };
  }
  let liveBytes = null;
  try { liveBytes = readFileSync(join(repoRoot, successor.path)); } catch { return { status: 'refused', problems: [`current-producer subject unreadable: ${successor.path}`], message: '' }; }
  if (sha256buf(liveBytes) !== successor.live.sha256 || liveBytes.length !== successor.live.bytes) return { status: 'refused', problems: [`current-producer subject ${successor.path} serves sha256 ${sha256buf(liveBytes).slice(0, 12)}/${liveBytes.length}B — only the exact Root-admitted successor ${successor.live.sha256.slice(0, 12)}/${successor.live.bytes}B selects the current variant`], message: '' };
  if (!carrier?.ok) return { status: 'refused', problems: ['current-producer selection requires the valid reviewed integration carrier'], message: '' };
  const transferProblems = reconcileCurrentTransfer({ repoRoot, git, carrier });
  if (transferProblems.length) return { status: 'refused', problems: ['clean typed current transfer required (real checkpoint/B ancestry and tuples): ', ...transferProblems.slice(0, 3)], message: '' };
  const defects = currentProducerQualificationDefects(successor.currentProducerBehavior);
  if (defects.length) return { status: 'refused', problems: ['the inline currentProducerBehavior member must equal the independently fixed 742/b706 qualification exactly: ', ...defects.slice(0, 5)], message: '' };
  // R77-3: the ACTUAL committed live-HEAD tuple of every fixed closure dependency, selected
  // through the existing shared git runner — never assumed from the owning table's .live leg
  // (the full typed transfer deliberately permits the ORIGINAL leg on the other rows/branches).
  const liveHeadRev = git(['rev-parse', 'HEAD']);
  if (liveHeadRev.rc !== 0) return { status: 'refused', problems: ['git cannot resolve the live HEAD for the committed selected-tuple binding (producer-off is a refusal, never a pass)'], message: '' };
  const liveHead = liveHeadRev.stdout.toString().trim();
  const liveTreeRows = git(['ls-tree', '-r', '-z', `${liveHead}^{tree}`]);
  if (liveTreeRows.rc !== 0) return { status: 'refused', problems: ['git cannot list the actual live HEAD tree for the committed selected-tuple binding'], message: '' };
  const liveMap = new Map();
  for (const entry of liveTreeRows.stdout.toString('utf8').split('\0').filter(Boolean)) {
    const meta = /^(\d+) (blob|tree|commit) ([0-9a-f]{40})\t(.*)$/s.exec(entry);
    if (meta) liveMap.set(meta[4], { mode: meta[1], kind: meta[2], oid: meta[3] });
  }
  const problems = [];
  for (const row of EXACT_QUALIFIED_CURRENT_PRODUCER.sourceClosure.paths) {
    const owner = ADMITTED_CURRENT_ONLY_SUCCESSORS.find((s) => s.path === row.path)?.live ?? ADMITTED_CURRENT_B_NEW_UPSTREAM_PATHS.find((r) => r.path === row.path);
    if (!owner || owner.gitBlob !== row.gitBlob || owner.sha256 !== row.sha256 || owner.bytes !== row.bytes || owner.mode !== row.mode) { problems.push(`closure pin for ${row.path} disagrees with the owning typed table — the fixed nine and the typed tables must agree`); continue; }
    const entry = liveMap.get(row.path);
    if (!entry) { problems.push(`closure dependency ${row.path} missing from the actual committed live HEAD tree`); continue; }
    if (entry.oid !== row.gitBlob || entry.mode !== row.mode || entry.kind !== row.kind) { problems.push(`committed live HEAD tuple for ${row.path} selected ${entry.oid.slice(0, 12)}/${entry.mode}/${entry.kind}, not the exact current tuple ${row.gitBlob.slice(0, 12)}/${row.mode}/${row.kind} — an original-leg commit never proves the current producer variant`); continue; }
    const blob = git(['cat-file', 'blob', entry.oid]);
    if (blob.rc !== 0) { problems.push(`selected committed object ${row.gitBlob.slice(0, 12)} for ${row.path} unreadable through the shared git runner (rc ${blob.rc})`); continue; }
    const served = Buffer.isBuffer(blob.stdout) ? blob.stdout : Buffer.from(String(blob.stdout ?? ''), 'utf8');
    if (sha256buf(served) !== row.sha256 || served.length !== row.bytes) { problems.push(`selected committed object for ${row.path} serves sha256 ${sha256buf(served).slice(0, 12)}/${served.length}B — the reviewed row pins ${row.sha256.slice(0, 12)}/${row.bytes}B (a forged selected object refuses)`); continue; }
    if (symlinkEscape(repoRoot, row.path)) { problems.push(`parent-directory symlink escape refused at ${row.path}`); continue; }
    let diskBytes = null;
    const file = join(repoRoot, row.path);
    try {
      const st = lstatSync(file);
      if (st.isSymbolicLink()) { problems.push(`closure dependency ${row.path} is a symlink — no qualified identity through a link`); continue; }
      const diskMode = st.mode & 0o111 ? '100755' : '100644';
      if (diskMode !== row.mode) { problems.push(`closure dependency ${row.path} mode ${diskMode} disagrees with the pinned ${row.mode}`); continue; }
      diskBytes = readFileSync(file);
    } catch { problems.push(`closure dependency missing from the working tree: ${row.path}`); continue; }
    if (sha256buf(diskBytes) !== row.sha256 || diskBytes.length !== row.bytes) problems.push(`closure dependency ${row.path} serves sha256 ${sha256buf(diskBytes).slice(0, 12)}/${diskBytes.length}B on the working tree, the reviewed row pins ${row.sha256.slice(0, 12)}/${row.bytes}B — the committed qualified identity and the working file must be the same bytes`);
  }
  if (problems.length) return { status: 'refused', problems, message: '' };
  return { status: 'admitted', problems: [], message: `current accepted-variant producer selected: ${successor.path} = exact current ${successor.live.sha256.slice(0, 12)} (typed successor of the frozen ${successor.checkpoint.sha256.slice(0, 12)}) through the clean typed current transfer with the Root-qualified inline currentProducerBehavior row — the exact fixed nine-path source closure agreed with the typed tables, every dependency's actual committed live-HEAD tuple selected and its physical working bytes byte-exact; the other frozen producers stay strict and no historical report is called fresh` };
}

export function reconcileInventory({ repoRoot, basePaths, rulingPath, livePaths, ledger, integration, pendingBindings, currentTransferProblems }) {
  const problems = [...validateLedgerShape(ledger)];
  const base = new Set([...basePaths, rulingPath]);
  const admitted = new Set(admittedPaths(ledger));
  for (const p of admitted) if (base.has(p)) problems.push(`registered path collides with historical scope: ${p}`);
  // Root unit-37 §2: in INTEGRATION MODE ONLY (a valid reviewed carrier on disk) the finite
  // current surface is admitted into the expected set — the exact 571 reviewed upstream-origin
  // row paths plus the two data carriers. Outside integration mode the original expected set
  // is untouched (legacy no-integration behavior preserved byte-for-byte).
  const rowPaths = integration?.ok ? (integration.data.currentLineageOnlyScope.upstreamAdditions ?? []).map((r) => r.path) : [];
  const carriers = integration?.ok ? [S2_REVIEWED_INTEGRATION_REL, PORTABLE_REFERENCE_REL] : [];
  // Root unit-74: the finite current-B delta's new upstream paths join the expected set ONLY
  // through the EXISTING typed current-transfer validation: the caller passes that validation's
  // problems array, and an EMPTY array means the exact 28 identities (real B ancestry,
  // mode/kind/OID, served bytes) already reconciled clean. A failed, absent or non-array
  // validation keeps every B-delta path unregistered — no wildcard, no live-diff automatic
  // approval, and the frozen 4172 base / 571 upstream lineage surfaces stay untouched.
  const bNewPaths = integration?.ok && Array.isArray(currentTransferProblems) && currentTransferProblems.length === 0
    ? ADMITTED_CURRENT_B_NEW_UPSTREAM_PATHS.map((r) => r.path)
    : [];
  const expected = new Set([...base, ...admitted, ...rowPaths, ...carriers, ...bNewPaths]);
  for (const p of livePaths) if (!expected.has(p)) problems.push(`unregistered live path refused: ${p}`);
  for (const p of expected) if (!livePaths.includes(p)) {
    const boundedFuture = (ledger.declaredPendingEvidence ?? []).some((r) => r.path === p)
      || (ledger.s4EvidenceIndex?.declaredPaths ?? []).some((e) => e.path === p);
    if (boundedFuture && !ledger.evidenceComplete) continue;
    problems.push(`registered path missing from live scope: ${p}`);
  }
  verifyRegisteredFiles(repoRoot, ledger, problems, pendingBindings);
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

// ---- portable historical reference + reviewed current transfer (Root admission 2026-11-01) --
// The admitted portable reference-data carrier: exact bundle bytes pinned below (proposal
// 01decee5, Root consult 50967da7, direct native DATA proof retained in the packet). It is
// REFERENCE DATA for historical object portability — never s3-source/s3-evidence class, never
// behavioral evidence, never a waiver. Hydration writes ONLY into a uniquely owned isolated
// object store built from published objects plus this exact bundle; no shared git config,
// ref, index, object store or alternates is ever touched. Note: PRESERVED_INTEGRATION_INDEX_TREE
// above stays historical provenance inside the b055 carrier only — it is never required as a
// runtime object (a clean clone needs none of it).
export const PORTABLE_REFERENCE_REL = 'docs/test-assurance-kernel/s2/reference-objects.cf64.bundle';
export const PORTABLE_REFERENCE_SHA256 = 'a053210a8044ae2b670789d3768712c2c55717593992b9ccd0e6df1a8afa5dd0';
export const PORTABLE_REFERENCE_BYTES = 1034715;
export const PORTABLE_REFERENCE_PREREQUISITE = '35738554faf029e9fe3b8b4c25bfdde242f65c66';
export const PORTABLE_REFERENCE_REF = 'refs/heads/cf64-reference-evidence';
// The exact reviewed six commit/tree tuples: recovered 4fa -> source 1cb -> generation
// ac175 -> preserved cf64, plus the original S2 base 23d67e8e and the S2 measured head
// 932ef452 — every one an ancestor of preserved cf64, none an ancestor of published staging.
export const PORTABLE_REFERENCE_TUPLES = [
  { commit: '4fa71b5d0429720244da763de1c62cc885d99c39', tree: '4229a3a350c844813388c6844f995ea6b1434a7d' },
  { commit: '1cb4a51d3e71534403a4769ee3a80577ce2505ff', tree: '63a480cad56fb2c254b93a78748effd817ccaec6' },
  { commit: 'ac17594f1f1edaad7d98b0acb2ddcd08e748518f', tree: 'a5da6f4068f948381bdae3e9aeafd680db6bb799' },
  { commit: '23d67e8e646d5a3416bee697a3461b2439cec477', tree: '8008fd9a34a96ec0231c753f3cd2eb9bb0ee5f87' },
  { commit: '932ef452c5e9639293eb8c0d17e443b4d2acf6f1', tree: '4ca080adc480be6972d9adce9b1faadbb619e4e4' },
  { commit: 'cf64dd7fb2d52d3eaea5966f9abd0e61717ba981', tree: '36791c84d4e6a5aceb1800f8a4e10bff2136a918' },
];
// The reviewed current-transfer checkpoint: the first normal integration commit on the
// delivery branch — exact head/tree/single parent, real bc8 ancestry. The historical
// original cd3fc6041337ecea3596143867d1dc517a927911 stays preserved verbatim on the retired
// delivery graph (honestly NOT an ancestor of this branch after the S17 own-body repair);
// the current head below is the native-gated identical-tree checkpoint C0 — the same
// reviewed tree, the same sole bc8 parent, the same byte-identical baseline ledger blob,
// recreated through cherry-pick --no-commit of the original single-parent cd3 delta
// followed by a normal hooked commit under the Root content-bound GO — a recorded method
// deviation (not merge --squash), accepted by the Root review as an equivalent ordinary
// non-destructive construction.
// Exactly three of the 571 upstream-origin current blobs differ from their bc8 origin (the
// Root-reviewed assertion-preserving renames); every other row must still carry its
// bc8-origin blob at the checkpoint. This relation is STRUCTURAL routing only: it never
// certifies behavior, performance or CI, and evidence-only descent (codeScopeEquivalent)
// keeps its identical scoped-blob requirement unchanged.
export const CURRENT_TRANSFER_CHECKPOINT = {
  head: '8fdb2ee87aff0dbca11a1dbb650b18f9400e65db',
  tree: 'a5593c8d8f69c6954b4b68b4da323a300f8e5939',
  parent: 'bc8e758d2863aabbaa1062492a142662bdaa11d8',
};
export const ADMITTED_CURRENT_REPLACEMENTS = [
  { path: 'scripts/dot-relay/executor.test.mjs', sha256: 'd9023a3d780cd6fe0ca044d3a8365e5680ea66c1dfb801f76bea9992b5248e6e', gitBlob: 'c1c38edfc3f3915bac1e62a92f7f16d9892daa86' },
  { path: 'scripts/plugin-native-binding.test.mjs', sha256: 'df3c889e15fd984fa24ddd10bc4ae066b991766d226154d0e8ea27ef199cb8b6', gitBlob: '8061e5bd5ba01e55fe02b27490db55cb77f894b7' },
  { path: 'tests/aif-init/runtime-output.test.mjs', sha256: '2a70692e66173568596e1d5957053136f19b1053099ca2447f6abeb9713a2963', gitBlob: '1e7501bc256091c77fcce9e6db7037f426a1dde5' },
];
// Root unit-36 item C: the finite pending-admission set — PATHS ONLY, never hashes. These
// are the current-subject paths changed by the delivery commits (2f978/f15cf/0899) after the
// admitted cd3 checkpoint, matching Root's ACTUAL-FIVE-POSTIMAGE-PINS receipts. Until actual
// Root boundary-2 admission they are PROPOSALS: the reconciliation reports each as an
// explicit admission-pending problem (public diagnostics stay honest) instead of silently
// passing or hard-refusing as unknown. No expected-map exception and no circular own-hash —
// the exact postimage identities live in Root's immutable pin receipts, never typed here.
export const PENDING_CURRENT_SOURCE_PROPOSALS = [
  'packages/core/principles/38-vitest-include-ci-coverage.test.ts',
  'packages/getff/MANIFEST.sha256',
  'scripts/test-assurance/s3.mjs',
  'scripts/test-assurance/s3.test.mjs',
  'scripts/test-assurance/verify.mjs',
];
// Root unit-41 admission (2026-11-01): the first exact current-only generated successor. The
// cd3 integration squash added .agents/rules/test-quality-contracts.md without regenerating
// the docs/site/reference/F1.md F1-table fence, so the reviewed upstream-origin row and the
// normal live generator output now legitimately differ on exactly this path. The checkpoint
// identities stay frozen historical data (the reviewed row — the successor appearing in the
// cd3 checkpoint tree is a refusal, never an updated historical baseline); the live leg may
// carry the reviewed original OR the exact admitted generated successor. Every expected
// identity below is Root's immutable reviewed tuple, never derived from this detector or
// from a fresh generator run. Deliberately NOT an ADMITTED_CURRENT_REPLACEMENTS entry: those
// apply one expectation to BOTH trees and would demand future generated bytes in old cd3.
// Structural admission of the original baseline here is not a freshness waiver — the
// s2-body-carriers step still demands the live generator output for final delivery.
//
// Root unit-52/53 admission + unit-54 line-preserving renewal (2026-11-03): the second exact
// current-only successor — the CI workflow repair. The principles-meta-tests job installed
// packages/core only, while principle 52's scratch scenarios hard-require a provisioned
// REPO-ROOT node_modules (52-subprocess-status-conformance.ts realNodeModules()). The unit-53
// admission (e9a3b2d6, a separate 12-line root-install step) is superseded per the Root
// coordinator causal-freshness decision: the existing core-install run scalar now gains the
// ordered root install (`npm ci --silent && npm ci --prefix packages/core --silent`) — the
// SAME step, name, cwd, env, lockfiles and first-failure propagation — preserving the frozen
// 8a55 physical line count (3109) and every unrelated line, so the 24 generated F3 workflow
// citations and the s2-body-carriers freshness contract stay in place. e9a3/d722 remains in
// history as the genuine unit-53 admission; the live leg now carries exactly this postimage.
// The workflow path is a governed CHECKPOINT path that is NOT one of the 571 reviewed carrier
// rows, so this entry is consumed by the checkpoint-mutation leg of reconcileCurrentTransfer
// (not the row loop): identical typed semantics — the checkpoint keeps the frozen original
// identity, the live leg may carry the original OR exactly this Root-admitted postimage,
// content-bound through the shared git runner. Any further workflow edit produces a live
// blob outside the two admitted OIDs and refuses until Root admits a new successor tuple.
export const ADMITTED_CURRENT_ONLY_SUCCESSORS = [
  {
    path: 'docs/site/reference/F1.md',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: 'ef0d8840c302cc8bb101b272fd7bde2d9efc063e', sha256: 'cbba1e3774a3a8d7a4a0b5a06d6168a190ad38957eb6357a04e0f935cc1edc57', bytes: 16459 },
    live: { mode: '100644', kind: 'blob', gitBlob: 'c290363a90fbd2b32e185786a03a320f5379f6ff', sha256: 'f9620981c2224074825899429e900acbeff664fb7b97a958a7d3bf78895efa69', bytes: 16596 },
  },
  {
    path: '.github/workflows/audit-self.yml',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: '8a55d97eb2b92cd4bcdc3e755b1d496e8889437a', sha256: '78946c570a616ced22fe12bd04ec33db58fa59e8389f559e8a36ba78fe584953', bytes: 201512 },
    live: { mode: '100644', kind: 'blob', gitBlob: '06bc118a5fb05c1db61e907b9aa65eca3365333d', sha256: 'cb535a67513ee331bfa4b796a49e4a3073bee53153bff31f31442756a33ba1de', bytes: 201640 },
  },
  {
    path: 'docs/site/face-facts.json',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: '12f9ad10c95ef59fb1d1d022ed6cb486f0f3bf46', sha256: 'fcd1b6114adaa8be43cbcb64ac95e5569cd5525e1abadd34cf0ac2c16e5b4973', bytes: 25113 },
    live: { mode: '100644', kind: 'blob', gitBlob: 'f9cb02b94cd25b547e63b99296075c9aa9a0328b', sha256: 'a56285ebe1de9eed7d57307e10ba890f34b38c6a011f9ca71adb5f22ff0f0b66', bytes: 25113 },
  },
  {
    path: 'docs/site/reference/B/rule-tests.md',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: '2a1d90a6ccc2eef5f4f4bfb895cd494bf539ea28', sha256: 'b960027984cac52d0e115d1fe7d9bfc8f9a544e8c56bece5f122346312713ba5', bytes: 5950 },
    live: { mode: '100644', kind: 'blob', gitBlob: 'b1e2beb42c79d2b06ab0ec7c8f30b60fac99f125', sha256: '0fcf69db73de6da35de4a41ad86dcc27ec18b0050abf2f86d241a8c11c311d97', bytes: 5950 },
  },
  {
    path: 'docs/site/reference/E.json',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: '741e0c17e2329dc06e5e636124fea096549551c1', sha256: '415c98b91225fa6831c1d1b8f390251dd1e41a2e530cbe267131ccfd7ba92ce7', bytes: 43895 },
    live: { mode: '100644', kind: 'blob', gitBlob: '65ae1c68f9cdbc58e859e9de5a2823428715822c', sha256: '11a4a0fddd71c0080736063ba41b266a98fc2ba6b238c138ebe0ab873c4bc56d', bytes: 45090 },
  },
  {
    path: 'docs/site/reference/F1/egress-no-api-bypass.md',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: 'd92fed4f62a9160939ed579619865a9da1cb43da', sha256: 'e45e43cd8934b5bcbb5c6ccc1d7e3ffde212027dfc313c511f524ccd57f71523', bytes: 7701 },
    live: { mode: '100644', kind: 'blob', gitBlob: '53b2c51bf8c90e35728e76bfe7e1ed3ee1e72037', sha256: 'f217bd0361720e9c80ef4cdfafd54b4badab056da4bc77b692e45002ede91b2e', bytes: 7701 },
  },
  {
    path: 'docs/site/reference/F3.json',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: '6ee86453332b3007b0e9ed3f6ad3db7c6dc8b0ce', sha256: 'cc419aa967a64bc8ace77ef42de9bacf4f7a397761342b487c666ea053c4671d', bytes: 26250 },
    live: { mode: '100644', kind: 'blob', gitBlob: '2d6857cccad7436c8028b435e0ac5d036ec45ba0', sha256: '7803f6a339cd01adf3830b9955b2af87ca106b7b95e143d38d09895eb76d0d37', bytes: 26250 },
  },
  {
    path: 'install.sh',
    checkpoint: { mode: '100755', kind: 'blob', gitBlob: '03b2d9b2ab6207cc343059b158f6adef87bfb960', sha256: '75900e3cfa0908e21492481a68c3407dfaf4be9729de37a36fbec5282eed33a0', bytes: 114414 },
    live: { mode: '100755', kind: 'blob', gitBlob: '291eaec2f49c38a372a71900a243f76b98c0985a', sha256: '3fecefe2617b531f0e35eef14a6eaf56d2508f946a696632127d0e0c75f11376', bytes: 127737 },
  },
  {
    path: 'packages/core/audit-self/audit-ai-docs.test.ts',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: 'c5a2562a14e3d8b4d1cbd99f5de8190da92f06da', sha256: '3deba582283406268b15ba3992907de148da89bdb0c1733e17c7f415c358e581', bytes: 150120 },
    live: { mode: '100644', kind: 'blob', gitBlob: '923f8ec2c691c5aa5d7a99cb001c34903109e329', sha256: '296cb2035258b98e4f0f0a0758659ebd467ef966a40a1ff85d2c393b33a7c2d1', bytes: 150120 },
  },
  {
    path: 'packages/core/audit-self/base-core-list.test.ts',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: '3b797680c3b1a5748e278ccceeaa1f3145e07a0e', sha256: 'acb770e01def3cff69a4435e20f81d535198ff3dddac6f7a646ee9251d309057', bytes: 10147 },
    live: { mode: '100644', kind: 'blob', gitBlob: '932091ea641ced3bb789e5e6413bec973b12064c', sha256: '84438039da9fb463fce81479639feab859506796eb726882c931c43e5e5463eb', bytes: 10147 },
  },
  {
    path: 'packages/core/principles/39-skill-fence-orch-home.test.ts',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: 'fd42c148fb882bbf3dc6f5185bc8a64da399b242', sha256: '46883d301f33ea89dffd19d2ad34139a3ee79baa99669c79f1d09338375905d3', bytes: 14290 },
    live: { mode: '100644', kind: 'blob', gitBlob: 'f2a0ce323097ee5d7d5f25fb124ded4c030ba2c3', sha256: '2da93bb3d34e9e60a15919b17b8a37fd64464f201c61cf70ddf6cc9a8939d81f', bytes: 14290 },
  },
  {
    path: 'packages/core/templates/templates.manifest.json',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: 'b583b0f3f8965585fb230c3632ccd98251e735ca', sha256: '0aa5a12f3a0546329b0b204823850d93127db0d0cc967868acb111aea34de14a', bytes: 7586 },
    live: { mode: '100644', kind: 'blob', gitBlob: '38dc80c004c2277f0a0a3e12ce951c283210f392', sha256: 'ec8b3cbf88c79fcf31835cef5bfc71b2ba00ce4d89d34f5315751c1cf800219b', bytes: 8080 },
  },
  {
    path: 'scripts/build-getff-dist.sh',
    checkpoint: { mode: '100755', kind: 'blob', gitBlob: 'e2d97acb55e869cc337f6c10104d01f3e1d1b1b4', sha256: '4a52b4f8b45c294ecb587276592a2cd4e595e2d99b7bc6e35860c160a5746279', bytes: 18867 },
    live: { mode: '100755', kind: 'blob', gitBlob: '50582d330b478f45c936281f1762cf139f49616f', sha256: '9ce417ad682eecf1e3ffc2b431a954f44f390e9ceaac6d605967047fd9851285', bytes: 18867 },
  },
  {
    path: 'scripts/run-local-ci-sweep.sh',
    checkpoint: { mode: '100755', kind: 'blob', gitBlob: '28380a1018accbc77eed57b10c11f389e0f77b27', sha256: 'ebc7cdd9f40f81037c16ed20cf0c23ae92de2ad2c508a706ccb482f8f07e5a83', bytes: 91103 },
    live: { mode: '100755', kind: 'blob', gitBlob: 'cc84995fe26a5417b1fcbc398e6d2aa6804abc5e', sha256: '68ba4d42330ea3ccd084ed1d43570ded2e6a4de32f82e3a38379f19e9f22d747', bytes: 91103 },
  },
  {
    path: 'setup.d/40-configs.sh',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: '84be9fdecebbcb76d42f7adfb7c6d01d3e5cd4cf', sha256: '6fbda6e4610d948c938ea24f3fbd31a1fa5623b148d1db90c44fefbae803e9fe', bytes: 53605 },
    live: { mode: '100644', kind: 'blob', gitBlob: '0e260a97ae37a647e225d639753923febdb3859c', sha256: 'f1c635252c516775983252bce6deb41659e59b46a01da731a0c6a2b757915fa0', bytes: 57474 },
    // Root unit-77 (bc107/b706): the ONLY producer-behavior qualification home. Inline literal
    // data on THIS immutable reviewed row — never a runtime proof file, loader, store, Root
    // flag, acceptance timestamp or caller-supplied pass object. Admission is exactly: this
    // row + the real current graph through the full typed transfer + the nine working files
    // being byte-identical to the pinned committed identities.
    currentProducerBehavior: {
      qualification: {
        rootRuling: { rel: 'ROOT-CURRENT-F1C-EXISTING-SOURCE-BEHAVIOR-PROOF-QUALIFIED.json', sha256: '742a2d88dfabae919f55d184c3d5b8390d768119490517051d2f9d56ea76861e', bytes: 3346 },
        originalEvidencePacket: { rel: 'ONEBUTTON-SOURCE40-F1C-EXACT-PROOFS-AND-TAK-PUBLICATION-BOUNDARY.json', sha256: '957703b017d43239bcb53fdaaadde2ad5537d8da7b75dad44a4b663f82316d58', bytes: 17186 },
      },
      sourceAcceptance: {
        onebuttonHead: '0855d375795d743b0d7fdbbf7d3884e68e68ff1c',
        onebuttonTree: 'd486fb3c29f596831a811a07e5c718dff19fb074',
        pr: 'artyhoo/getff#2142',
        stagingSquash: 'b714f7c1a6e40488e8f016665d7fffc0cd513a3d',
        source: { sha256: 'f5361e09f4a5ae109a135922486c189fc64388f6050020ce570af94d0aec48d2', bytes: 4971 },
        code: { sha256: '473c2fd3a6603a2a2d812d284a0db95c4c857236f1e36f3b8626b5dbcb3a98e3', bytes: 2185 },
        what6: { sha256: '3083efb695ee51dd016dffd324486300244edb83f534e56b60fa84d25f7ecf57', bytes: 3293 },
      },
      normalWitnesses: {
        generic344: { rel: 'r12-1-genericstack-GREEN.log', sha256: 'f88c2f7e547ebb89f183a8950d3f7fdf38bca774cb4280354678d424a39092ed', bytes: 21462, result: 'PASS344 FAIL0 EXIT0' },
        genericBinding: { rel: 'ACTUAL-716-COMMITTED-REPAIR-PEER-HANDOFF.json', sha256: '85078b9e8b4819d537f74946bd105d7efd58fed09b2d4e31f61c8d2b40f24954', bytes: 16039 },
        genericD1Original312: { rel: '03b-final-battery-generic-stack.log', sha256: 'ca7f275e053d3a53f8f1be3cac101d237e07eef42463c012efa937ad283daa15', bytes: 19008 },
        originalSource10Binding: { rel: 'ACTUAL-C535-AFFECTED-SOURCE-ACCEPTANCE-HANDOFF.json', sha256: 'ac80705543139b2cbd2a4b8adb803b45a162f4ca0469552a30131cdc885488ff', bytes: 12611 },
        linter35: { rel: '04-final-linter-slot.log', sha256: '3058227093acb0f4e95084e21cb94d27e8885cd4e10eea4398d1a379cbb60bef', bytes: 5972, result: 'PASS35 FAIL0 EXIT0' },
        finalHosted: { runId: 41587408035, conclusion: 'success', genericWorkflowStep: 948, linterWorkflowStep: 962, whole: { sha256: '5322c0d836a1bfebd75f34d01299516e2535a2270d66608b7b070fe8c8c63807', bytes: 6122 }, savedChecks: { sha256: '63bdc4933cb664054f6c8fcd473c05a7250eca35f59d381f2e5eeaad1f82d1a3', bytes: 9352 } },
      },
      sourceClosure: {
        paths: [
          { path: 'install.sh', mode: '100755', kind: 'blob', gitBlob: '291eaec2f49c38a372a71900a243f76b98c0985a', sha256: '3fecefe2617b531f0e35eef14a6eaf56d2508f946a696632127d0e0c75f11376', bytes: 127737 },
          { path: 'setup.d/lib.sh', mode: '100644', kind: 'blob', gitBlob: '5a6666a7c3a28da7e007504c8b187fee62abbd41', sha256: '2a0de8efa9d0fa876ff87fa316ab5fa2b9f5cd25d1108e995391473b0b42a25b', bytes: 317922 },
          { path: 'setup.d/40-configs.sh', mode: '100644', kind: 'blob', gitBlob: '0e260a97ae37a647e225d639753923febdb3859c', sha256: 'f1c635252c516775983252bce6deb41659e59b46a01da731a0c6a2b757915fa0', bytes: 57474 },
          { path: 'setup.d/50-hooks.sh', mode: '100644', kind: 'blob', gitBlob: '84cd12adaacaa89c34cccf37fc8b41566a1d847d', sha256: '6f7cac83ba442347ee3d94287355632cc5a17d798dd399ebf45478e6a7ec34c1', bytes: 7325 },
          { path: 'setup.d/99-finalize.sh', mode: '100644', kind: 'blob', gitBlob: '08e0ddd64a49701773a034716749032c2c863b87', sha256: '213ea60d3675f6a13b9ce352037547507c47e5dfae5291bac01e8092a60c4b9e', bytes: 52776 },
          { path: 'packages/core/templates/shared/husky-pre-commit-generic.sh', mode: '100755', kind: 'blob', gitBlob: 'a63aedfdcf7a7663ae900c2849ecc1a9ed2055de', sha256: '5a9724e78c96b2958b2048fffd0b00a1ef689a3c31b1e4b716f36f3760d6b517', bytes: 1215 },
          { path: 'packages/core/templates/shared/getff-rules-generic.yml', mode: '100644', kind: 'blob', gitBlob: 'b354823187408b5f7fb0b8daa712e2afa73c5e29', sha256: '3d463e3caad19e19e178e3e935d5f0c24831bc33b0ddcb0cb83a2ad05ac28ba1', bytes: 2918 },
          { path: 'tests/install-sh/generic-stack.test.sh', mode: '100755', kind: 'blob', gitBlob: '7a68778b87515c30b92b1be336a5c8006ccda743', sha256: '3bb9681a20f408e1e1fe832c945bfdb9611a94266dca1d2e0f580a40e2f9b09f', bytes: 77301 },
          { path: 'tests/install-sh/linter-slot.test.sh', mode: '100755', kind: 'blob', gitBlob: 'c655c391165d26a67b02f898106a9ebf53d62151', sha256: 'eb7e35e8cadd613469bc9ca3767d0057366532418fc0990dccfb84f99bc073bf', bytes: 16259 },
        ],
        libShOnlyDifference: { onebutton: '7440f6fc16824279eafc1ee2975c29a04e54b09ceeed8c21344d4e0bc1a67aaf', tak: '2a0de8efa9d0fa876ff87fa316ab5fa2b9f5cd25d1108e995391473b0b42a25b', diff: { sha256: '051bd8e9bf13af4856d01c6a577da7a70f88c7b06a9aca68426520b7af0b08d9', bytes: 720 }, meaning: 'only the f2-hook-activation.test.sh citation 34->36 inside a JavaScript comment; runtime statement bytes unchanged — no general comment normalization' },
      },
    },
  },
  {
    path: 'setup.d/45-python.sh',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: 'a7a67bc5528297ed51aab31f2272916b672cd2a2', sha256: '9e4c6f1dbd149d35a5ab56096b971d98440dd9f1e542037626db5aaea29a3ac1', bytes: 118865 },
    live: { mode: '100644', kind: 'blob', gitBlob: 'b17966ae19813146a86ca87a149832f1572554ce', sha256: '31bbd1b4302f3bb6cede21a36723d7edf1dc78ea1bc0367bd25eb6ae1ac31a4a', bytes: 118866 },
  },
  {
    path: 'setup.d/50-hooks.sh',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: '5373341bf46afafcf377aece604ae1168490e05f', sha256: '5aeee0793181d62bbd8e20e093ee8370cc20a0da1b14f0fd6c1161735006aded', bytes: 4763 },
    live: { mode: '100644', kind: 'blob', gitBlob: '84cd12adaacaa89c34cccf37fc8b41566a1d847d', sha256: '6f7cac83ba442347ee3d94287355632cc5a17d798dd399ebf45478e6a7ec34c1', bytes: 7325 },
  },
  {
    path: 'setup.d/99-finalize.sh',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: '546a29b2a43f03a40e71eab4209b2d136ba553e3', sha256: 'bbfe8390b0ee343076d18e1769691177712168c23802cc945d635d56d36355dc', bytes: 51855 },
    live: { mode: '100644', kind: 'blob', gitBlob: '08e0ddd64a49701773a034716749032c2c863b87', sha256: '213ea60d3675f6a13b9ce352037547507c47e5dfae5291bac01e8092a60c4b9e', bytes: 52776 },
  },
  {
    path: 'setup.d/lib.sh',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: 'c6a75bc6b647c413b69fe214e640946f62003d2d', sha256: '2396dc3857ee9550da2f215fe697c5ba4b80a1ec3d499a2de4af80b99343da6c', bytes: 316604 },
    live: { mode: '100644', kind: 'blob', gitBlob: '5a6666a7c3a28da7e007504c8b187fee62abbd41', sha256: '2a0de8efa9d0fa876ff87fa316ab5fa2b9f5cd25d1108e995391473b0b42a25b', bytes: 317922 },
  },
  {
    path: 'tests/install-sh/copy-safe-force-dir-payload.test.sh',
    checkpoint: { mode: '100755', kind: 'blob', gitBlob: '76d9821087374bc05a7518e8bb934a805fd16de0', sha256: '4106233b144b8b76595d31682a0fc1337b4f5ea9e58035fa990c4713efc3aef1', bytes: 10876 },
    live: { mode: '100755', kind: 'blob', gitBlob: 'b50c2dd29c93391794c31eb2181eee722ada9d37', sha256: 'a0dfa22ae799a4e9bb614bad900930abb51aebc8ddaa4f20f8b2671aa3333b24', bytes: 10879 },
  },
  {
    path: 'tests/install-sh/eslint-barrel-preserve-consumer.test.sh',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: '9405f0c1cd49881c009c0d69281673e529ee18c2', sha256: '79013879718cf15e026d07be7ecce40f997ac4d25b91e48e4afcba287f48b87c', bytes: 16918 },
    live: { mode: '100644', kind: 'blob', gitBlob: '82913b5bf1249a934982383725e75a00333966a1', sha256: '8d7494ede819934dc9c5be01f452750d05c4067d897625f0eda72326209d23fd', bytes: 16918 },
  },
  {
    path: 'tests/install-sh/f15-prettierignore.test.sh',
    checkpoint: { mode: '100755', kind: 'blob', gitBlob: '3913d852be68f330b84956a7fabf6a6fb0303a0a', sha256: 'f067fbde136cfb49ea7704f4c2f4e9e3a40b82d189939527d36a4c92d119433c', bytes: 28152 },
    live: { mode: '100755', kind: 'blob', gitBlob: 'f8cf63e4339b8cc326031bd2ef2a58df1c566bf2', sha256: '662d4445d25c73d3e06dcad8d2db4206bf46c9e1111d1d6bd7f8fb83b208bd0f', bytes: 32425 },
  },
  {
    path: 'tests/install-sh/generic-stack.test.sh',
    checkpoint: { mode: '100755', kind: 'blob', gitBlob: 'e79ede48ac3c364273e210e1863f2c1b99f77a8a', sha256: '01ebaf3e131af3d2b4c11301aaa0baa366ae1bc7c70a17eff886bf0e681c6ec5', bytes: 12322 },
    live: { mode: '100755', kind: 'blob', gitBlob: '7a68778b87515c30b92b1be336a5c8006ccda743', sha256: '3bb9681a20f408e1e1fe832c945bfdb9611a94266dca1d2e0f580a40e2f9b09f', bytes: 77301 },
  },
  {
    path: 'tests/install-sh/gh-531-shipped-prettier.test.sh',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: '079672bc35eec60f35c362c393158887eabf1a34', sha256: 'cf19bc323bd4445edb7ad5b9c9a57670a2af6906726c258fdb15b46d55a29aec', bytes: 40516 },
    live: { mode: '100644', kind: 'blob', gitBlob: 'c39ee7951bf118cc036d7d821920c3508106c991', sha256: '916d1c55c73903b4a226f7900002c5728f4d1d513188f6342858e11bbc477ea8', bytes: 40516 },
  },
  {
    path: 'tests/install-sh/linter-slot.test.sh',
    checkpoint: { mode: '100644', kind: 'blob', gitBlob: 'cfe122967541a862cb7dca109cff01d7cedb4ddf', sha256: '1da7f9c2f74a827ee53ca146c3fe69a03930d2b024dfc078cd61159d386e8afa', bytes: 13583 },
    live: { mode: '100755', kind: 'blob', gitBlob: 'c655c391165d26a67b02f898106a9ebf53d62151', sha256: 'eb7e35e8cadd613469bc9ca3767d0057366532418fc0990dccfb84f99bc073bf', bytes: 16259 },
  },
  {
    path: 'tests/install-sh/python-agent-surface-refresh.test.sh',
    checkpoint: { mode: '100755', kind: 'blob', gitBlob: '118f437e28b98b0458411b84f0f504eedd97d032', sha256: 'c4da48ef25c8daa4043ad4b31a104aced47f706ae16576f23d2b28f06b1e2fc3', bytes: 17515 },
    live: { mode: '100755', kind: 'blob', gitBlob: '92bde24fe5251a26a33fb43a2a9c14879fd09306', sha256: '23d3f80c621dafbfe409eeabbc904eb9678414e1c3fe019b95bab99d3d93cac9', bytes: 17515 },
  },
  {
    path: 'tests/install-sh/python-delivery.test.sh',
    checkpoint: { mode: '100755', kind: 'blob', gitBlob: '4d0b6fb11ee0d917f1118c49395be6fe97e0b2b8', sha256: '4f78c3086b32428e23041b26f90e1474edb917d0e9e1f67c480f5a294cbfc77a', bytes: 31488 },
    live: { mode: '100755', kind: 'blob', gitBlob: 'e5688241faa8703f5eab44bfd923d49728286e5c', sha256: 'cb546a1fc1d458503e69f13e2664fe301d33ae54f5307b3b29dc0fe6303fb150', bytes: 31488 },
  },
  {
    path: 'tests/install-sh/refresh-covers-full-delivery.test.sh',
    checkpoint: { mode: '100755', kind: 'blob', gitBlob: '90ef820f1d600c64bc74a08bbc0e4e0e31573aec', sha256: '0e3289ce230dda567714eadfb15772829ca88eb933689e968a2e237cc84a9e44', bytes: 44197 },
    live: { mode: '100755', kind: 'blob', gitBlob: 'bdecca1bf35491ba6b4f2209e210255a94c13534', sha256: 'cb995cf4b8290040f2eb2a2da220e63ba539de8cfbd18bcfef7ba43c02f54a45', bytes: 44197 },
  },
  {
    path: 'tests/install-sh/refresh-reconciles-skill-rename.test.sh',
    checkpoint: { mode: '100755', kind: 'blob', gitBlob: '4389ce9303ee4643f9e788290b6ff7027fb7fc4e', sha256: '3feb6fb767da26d006784162694bc12be5619c82313b099c2b3037a8ad80cc77', bytes: 7526 },
    live: { mode: '100755', kind: 'blob', gitBlob: '85457555ce31cb5bc9ceefdb58cd2b9ecdfb3849', sha256: '95ca2bd29b3f64b2caf0886ba67a98992ecb64adad8e727e7784a2a068f182ef', bytes: 7526 },
  },
  {
    path: 'tests/install-sh/workspace-stack-detect.test.sh',
    checkpoint: { mode: '100755', kind: 'blob', gitBlob: 'd25279351e729eeb1151d6a4e4d11e391beeefbb', sha256: '595f9ea8e7f938928bfc3cae831db4e1e1e163564c1f31aa110ce20af31e00b1', bytes: 8261 },
    live: { mode: '100755', kind: 'blob', gitBlob: '44ad957b5539344d742532055a93859dd309ebee', sha256: '01fb239741c823680c84bb2313cdc623842460adb03e747da82ffb20118eb366', bytes: 8261 },
  },
];
// Root unit-70 (2026-11-04, prospective source under the existing 7c6/f007 authority): the
// ordinary merge-forward of upstream staging B (b714f7c1) into the owned PR branch changes the
// live current subject by a FINITE exact 58-path delta Root enumerated from the owned Git
// objects: 28 brand-NEW upstream-origin paths, 27 changed existing checkpoint paths, ONE
// frozen-571-row live leg (docs/site/reference/F1/egress-no-api-bypass.md) and the workflow
// merge successor above (its live tuple renews the d6b869ac unit-53 admission to history; the
// live leg now binds the reviewed merge postimage). The 27 changed paths and the one row
// extend THIS relation with the same typed semantics — the checkpoint leg keeps the frozen
// reviewed identity and never updates; the live leg may carry the frozen original OR exactly
// the one Root-admitted B tuple; whichever OID a leg presents, the blob it serves must hash
// to that leg's frozen identity. The 28 brand-new paths have NO checkpoint origin a successor
// could extend, so they never ride this table — they carry their own finite exact table
// below. Every identity is Root's immutable reviewed tuple, never derived from this detector
// or a fresh diff; unknown paths, unknown content and any path outside this exact delta
// still refuse.
export const ADMITTED_CURRENT_B_BINDING = {
  bHead: 'b714f7c1a6e40488e8f016665d7fffc0cd513a3d',
  mergeBase: 'bc8e758d2863aabbaa1062492a142662bdaa11d8',
};
// The EXACT 28 new upstream-origin paths the reviewed B merge adds (post-bc8 staging content:
// absent from H, from the frozen checkpoint, from the bc8 baseline and from the cf64 topic
// tree). Finite and closed: a 29th new path is an unknown extra and refuses; a listed path
// with any other mode/kind/OID, or any bytes that do not hash to the pinned identity, refuses.
export const ADMITTED_CURRENT_B_NEW_UPSTREAM_PATHS = [
  { path: '.claude/orchestrator-prompts/dsh-native-q0-qualification/input-manifest.json', mode: '100644', kind: 'blob', gitBlob: '17c8c03c6677f033bca7e2fde08f823e14568b02', sha256: '9f9e8ecc5f75385738da31f8eae6e75b3632a48017e8da2cc21e126c59a26d02', bytes: 8132 },
  { path: '.claude/orchestrator-prompts/dsh-native-q0-qualification/kickoff.md', mode: '100644', kind: 'blob', gitBlob: '76ef33263bd659491d1f3ed052a5b77a580973ad', sha256: 'aba51bdd1bae57c4222a50b0ad9efb1c38fe6b36bc91f24693186ade34ed8eaf', bytes: 13712 },
  { path: 'docs/superpowers/specs/2026-11-01-dsh-native-q0-qualification-design.md', mode: '100644', kind: 'blob', gitBlob: 'c62bef0a4dc742d97a89a340790ec365df665202', sha256: '5b7acf5db05c9d1140e08cb25f09c9c2fa03b67ed7e4e92845dd94c5bec1aad4', bytes: 11348 },
  { path: 'docs/superpowers/specs/2026-11-01-dsh-native-q0-qualification-prd.md', mode: '100644', kind: 'blob', gitBlob: '407ef0b39ff45abde34aba74a354b5a96fd3c1db', sha256: 'ff05b862fe5335e2617f903df58a8bfc8f598adae1356bd2c50218bdb23d41d8', bytes: 8544 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/admission-receipt-r2.json', mode: '100644', kind: 'blob', gitBlob: 'e94e75b41cbd5ec879b911274824c5b4079e9072', sha256: 'c291d8b1ba739e2b7a9ad730fb1e6536f6d1d31cacee55d05a2e4a2e7bdcb3ce', bytes: 1480 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/admission-receipt.json', mode: '100644', kind: 'blob', gitBlob: '001f30396da18f996b506b7a2bcfe71589a8458f', sha256: '14c4cab461b39fd97968547d43e9edc295cffe4cc6a102ed717fe49e3e30081c', bytes: 1997 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/approval-receipt-r2.json', mode: '100644', kind: 'blob', gitBlob: '75bc73fbf4631e63821c5f342a669c5f93e36828', sha256: '506d94928515911ee156ad27c81acac974e8b804eec43bfe7c16277a2bf696ed', bytes: 753 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/approval-receipt.json', mode: '100644', kind: 'blob', gitBlob: 'bba4d788d52edd89bf8ff323668df9f3cd88fd5d', sha256: '334108b1a281d3048e528b8dab6930664b8ef75f17f7fdbd28b28111baedfec7', bytes: 741 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/authorized-q0-contract.txt', mode: '100644', kind: 'blob', gitBlob: 'a61c6463952cdb6b1349d876f3aab723bb9ac84b', sha256: 'a8a2f79e9768463dc1a34d52bf22b537891bcd401cdb34c6dde9e3f38c0e02b1', bytes: 15708 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/brief-approval-r2.md', mode: '100644', kind: 'blob', gitBlob: '6b40fa3841bdb1ba3d47a83d1573473ef481f326', sha256: 'f1297216cba71ecfd8bfd9704af98f3b11a23bfbeb31c5538962b4ee758c7adb', bytes: 2459 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/brief-approval.md', mode: '100644', kind: 'blob', gitBlob: '6c21c2029b446ddcb3b015ecfde132ea5bfd1fb5', sha256: 'ba2ab6e57a988f54650bc18730096683edd168d2b20a408e306e7809418c716e', bytes: 3445 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/intent-spec-r1.json', mode: '100644', kind: 'blob', gitBlob: 'f94bc0b7214f9656e7f604393bec9f748e4c5b1b', sha256: '3b0c76efaaebc60a530fa0666d332c23497a627a01432a06165b1a119cb1320e', bytes: 21258 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/intent-spec-r1.md', mode: '100644', kind: 'blob', gitBlob: 'a0e2fce0f554897d7960b847d86d77c40c031047', sha256: 'ded8a8b0fb5f3e40c55f63acc3342de492efb82e3d986f2fff78bb130078a477', bytes: 15188 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/intent-spec-r2.json', mode: '100644', kind: 'blob', gitBlob: 'b90e2672cfa319989426d9a8442a5854a8beb367', sha256: '8ac407db356de52552387a0affbf5e265b4cf8f733629601347b3d6e6c61c06a', bytes: 14549 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/intent-spec-r2.md', mode: '100644', kind: 'blob', gitBlob: '69b50058d9e3ced9db065084a6d37064c77cec01', sha256: '7e5c0d9530de96990939d4eb6d69ef5a07ba438383c5854e8195c137c1fcd05c', bytes: 16248 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/q0-openmaus-contract-r2.md', mode: '100644', kind: 'blob', gitBlob: '7e0c221183ed61784b1a7967f20808b357bd3ec9', sha256: '9292006b6fe12a58d791673bc97c151f90bbd6b0b943f42b7101c0b2dba1d83d', bytes: 12560 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/qualification-design-r1.md', mode: '100644', kind: 'blob', gitBlob: '2859a385bf8c8870fab32cf7f5023542c167e6f4', sha256: '1adc905b57e1d78dc2ed2c54b2cc3edd7b39fe361e3ad5d4afb8e88f683fb03b', bytes: 9664 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/scope-correction-r2.md', mode: '100644', kind: 'blob', gitBlob: '935f9510c97db6335ddd2eb05b37dd2acbee5d01', sha256: '3efaef8ed6288b324366f4e057131feebc7f5d13aa1c813d804d01790f055b3d', bytes: 2269 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/source-baseline.md', mode: '100644', kind: 'blob', gitBlob: 'a6da0ab6c98e9625a39d3bf6d45759753c5aa670', sha256: 'cbe189f1541b595e5d712a1dedb9aa599f2d50363e12d8b7c9192c0ec3599719', bytes: 5946 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/source-provenance.json', mode: '100644', kind: 'blob', gitBlob: 'ff4dae73f8c83c46c143a235479d423d80a6b40a', sha256: '8fe9673ba41ce3f70d714e6e60913d553ecbf3857ab26fec044ea2451a2bc10b', bytes: 2752 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/spec-agreement-r2.md', mode: '100644', kind: 'blob', gitBlob: 'a6fc1d738e34a7fd0957aab7802cec1b6d39d1dc', sha256: '9f4a7abd378e19587972987ce20d31e406c4f610500798242d1e95e282a172fa', bytes: 2725 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/spec-agreement-receipt-r2.json', mode: '100644', kind: 'blob', gitBlob: '82a703fc1038a70dead25783f38150b40675dee2', sha256: '329ae9fb8c2752993a14b61569bbe72b221ec5f4510ddd1e5b35700c845368a5', bytes: 1207 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/spec-agreement-receipt.json', mode: '100644', kind: 'blob', gitBlob: '120afe1b7c85dd4d5493d91ae6539c5246b2d36d', sha256: '2e3979910110817c4b006e9b097dab9014333a7dda1932602f056d18c3b689a0', bytes: 1276 },
  { path: 'docs/superpowers/specs/reviews/dsh-native-q0-qualification/spec-agreement.md', mode: '100644', kind: 'blob', gitBlob: '40c53e77b49e435e0783ca488b3e882f616fb51c', sha256: 'd24b353e34b555ebeee5ab0e572f747a5c6b19c81cb1a1d33758e0c740bb0e28', bytes: 3386 },
  { path: 'docs/superpowers/specs/snapshots/dsh-native-q0-qualification/prd-bf56e472321469b9da0667ecd43a8a5d04d3f4a086c9e2e7814ef85c83a389da.md', mode: '100644', kind: 'blob', gitBlob: 'c4ab09d5fb826096e3b674045e1b6ddb4de3f557', sha256: 'bf56e472321469b9da0667ecd43a8a5d04d3f4a086c9e2e7814ef85c83a389da', bytes: 7140 },
  { path: 'docs/superpowers/specs/snapshots/dsh-native-q0-qualification/prd-ff05b862fe5335e2617f903df58a8bfc8f598adae1356bd2c50218bdb23d41d8.md', mode: '100644', kind: 'blob', gitBlob: '407ef0b39ff45abde34aba74a354b5a96fd3c1db', sha256: 'ff05b862fe5335e2617f903df58a8bfc8f598adae1356bd2c50218bdb23d41d8', bytes: 8544 },
  { path: 'packages/core/templates/shared/getff-rules-generic.yml', mode: '100644', kind: 'blob', gitBlob: 'b354823187408b5f7fb0b8daa712e2afa73c5e29', sha256: '3d463e3caad19e19e178e3e935d5f0c24831bc33b0ddcb0cb83a2ad05ac28ba1', bytes: 2918 },
  { path: 'packages/core/templates/shared/husky-pre-commit-generic.sh', mode: '100755', kind: 'blob', gitBlob: 'a63aedfdcf7a7663ae900c2849ecc1a9ed2055de', sha256: '5a9724e78c96b2958b2048fffd0b00a1ef689a3c31b1e4b716f36f3760d6b517', bytes: 1215 },
];

// Root unit-37 §3 (Root-admitted EXISTING-LEDGER channel, 7c6b46e3 contract): the five
// governed source rows map onto the EXISTING scope-extension.json v1 ledger — the two
// existing s3-source addedPaths rows (s3.mjs, s3.test.mjs), the existing verify.mjs
// modifiedPaths row, and exactly TWO new modifiedPaths rows (P38, MANIFEST.sha256) that
// exist only in the PROPOSED activated ledger L (never activated before actual Root final
// admission). This is a finite DATA channel, not an accepted namespace or evidence waiver.
export const LEDGER_BINDING_ADDED_PATHS = ['scripts/test-assurance/s3.mjs', 'scripts/test-assurance/s3.test.mjs'];
export const LEDGER_BINDING_MODIFIED_PATHS = ['scripts/test-assurance/verify.mjs'];
export const LEDGER_BINDING_NEW_MODIFIED_PATHS = ['packages/core/principles/38-vitest-include-ci-coverage.test.ts', 'packages/getff/MANIFEST.sha256'];
// Root unit-46 §B: the EXACT TWO optional guard rows — a compatible absent-or-exactly-BOTH
// extension of the EXISTING v1 current-ledger normalization. ABSENT (the canonical fb1
// state): the channel behaves exactly as before — already-activated fb1 stays activated
// (never a soft-pending) and changed guard/test bytes remain HARD nonrow refusals. PRESENT:
// both rows must be unique closed path+sha256 entries with exact 64-hex pins, appended
// after every original modifiedPaths row in the fixed order below, and only then do the two
// paths join the governed-current set under the SAME validation chain as the five original
// rows. No partial, duplicated, unknown, malformed, swapped-hash, out-of-order or baseline
// variant is normalizable — each refuses. The pin VALUES live only in the proposed v1 L data
// after independent Root review (never hardcoded here to self-admit candidate bytes).
export const LEDGER_BINDING_OPTIONAL_GUARD_PATHS = [
  'packages/core/hooks/checks/guard-liveness.ts',
  'packages/core/hooks/checks/guard-liveness.test.ts',
];
// Prospective unit-63/64 extension (authoring session, 2026-11-04; Root31d ruled only the
// prospective binding structure): the EXACT TWO optional smoke rows - the two actual changed
// existing smoke sources. Same absent-or-exactly-BOTH contract as the unit-46 guard pair; pin
// VALUES live only in proposed v1 L data and bind only after a corresponding whole source+data
// GO, never hardcoded here.
export const LEDGER_BINDING_OPTIONAL_SMOKE_PATHS = [
  '.github/workflows/audit-self.yml',
  'tests/consumer-matrix/own-config-cell.sh',
];

// Evaluate the EXISTING-ledger binding channel state from two PARSED ledgers: the live
// ledger and the fixed-checkpoint (cd3) baseline object. Normalization per the admitted
// contract — ONLY (a) the sha256 of the two exact existing module/test addedPaths rows,
// (b) the sha256 of the existing verify modifiedPaths row, (c) removing the exactly-two
// newly allowed P38/MANIFEST modifiedPaths rows. Everything else — fields, array
// members/order, types, hashes, predecessor receipts, evidenceComplete, anchors, S4 index,
// note — must equal the actual baseline byte-for-field. Returns activated / unactivated /
// invalid. Pure: no I/O, so tests drive it with independently fixed fixture ledgers.
export function evaluateLedgerChannel({ liveLedger, baselineLedger }) {
  const problems = [...validateLedgerShape(liveLedger)];
  if (problems.length) return { ok: false, activated: false, problems };
  const isAdded = (row) => LEDGER_BINDING_ADDED_PATHS.includes(row?.path) && row?.class === 's3-source';
  const isModified = (row) => LEDGER_BINDING_MODIFIED_PATHS.includes(row?.path);
  const isNewModified = (row) => LEDGER_BINDING_NEW_MODIFIED_PATHS.includes(row?.path);
  // Root unit-46 §B: the exact-2 optional guard rows normalize away ONLY in the valid
  // absent-or-exactly-BOTH shape; every other supply is an invalid ledger that refuses.
  const isOptionalGuard = (row) => LEDGER_BINDING_OPTIONAL_GUARD_PATHS.includes(row?.path);
  // Prospective unit-63/64: the exact-2 optional smoke rows share the absent-or-exactly-BOTH shape.
  const isOptionalSmoke = (row) => LEDGER_BINDING_OPTIONAL_SMOKE_PATHS.includes(row?.path);
  const addedCount = (ledger) => (ledger.addedPaths ?? []).filter(isAdded).length;
  const modifiedCount = (ledger) => (ledger.modifiedPaths ?? []).filter(isModified).length;
  if (addedCount(liveLedger) !== LEDGER_BINDING_ADDED_PATHS.length || addedCount(baselineLedger) !== LEDGER_BINDING_ADDED_PATHS.length) {
    return { ok: false, activated: false, problems: ['the two existing s3-source addedPaths rows must be present exactly once each in both ledgers'] };
  }
  if (modifiedCount(liveLedger) !== LEDGER_BINDING_MODIFIED_PATHS.length || modifiedCount(baselineLedger) !== LEDGER_BINDING_MODIFIED_PATHS.length) {
    return { ok: false, activated: false, problems: ['the existing verify.mjs modifiedPaths row must be present exactly once in both ledgers'] };
  }
  const newRows = (ledger) => (ledger.modifiedPaths ?? []).filter(isNewModified);
  const liveNew = newRows(liveLedger);
  const baseNew = newRows(baselineLedger);
  if (baseNew.length) return { ok: false, activated: false, problems: ['the fixed-checkpoint baseline must not carry the two new modifiedPaths rows'] };
  for (const row of liveNew) {
    const keys = Object.keys(row).sort();
    if (keys.length !== 2 || keys[0] !== 'path' || keys[1] !== 'sha256') return { ok: false, activated: false, problems: [`new modifiedPaths row ${row.path} must carry only path+sha256 (got ${keys.join(',')})`] };
    if (!HEX64.test(row.sha256 ?? '')) return { ok: false, activated: false, problems: [`new modifiedPaths row ${row.path} sha256 must be exact 64-hex`] };
  }
  if (liveNew.length !== new Set(liveNew.map((r) => r.path)).size) return { ok: false, activated: false, problems: ['duplicate new modifiedPaths rows refuse'] };
  // Root unit-46 §B optional guard rows: absent-or-exactly-BOTH, closed path+sha256 form,
  // exact 64-hex, unique, appended after every non-guard row, fixed order, NEVER in the
  // fixed-checkpoint baseline.
  const guardRowsOf = (ledger) => (ledger.modifiedPaths ?? []).filter(isOptionalGuard);
  const baseGuard = guardRowsOf(baselineLedger);
  if (baseGuard.length) return { ok: false, activated: false, problems: ['the fixed-checkpoint baseline must not carry the optional guard modifiedPaths rows'] };
  const liveGuard = guardRowsOf(liveLedger);
  for (const row of liveGuard) {
    const keys = Object.keys(row).sort();
    if (keys.length !== 2 || keys[0] !== 'path' || keys[1] !== 'sha256') return { ok: false, activated: false, problems: [`optional guard modifiedPaths row ${row.path} must carry only path+sha256 (got ${keys.join(',')})`] };
    if (!HEX64.test(row.sha256 ?? '')) return { ok: false, activated: false, problems: [`optional guard modifiedPaths row ${row.path} sha256 must be exact 64-hex`] };
  }
  if (liveGuard.length !== new Set(liveGuard.map((r) => r.path)).size) return { ok: false, activated: false, problems: ['duplicate optional guard modifiedPaths rows refuse'] };
  if (liveGuard.length !== 0 && liveGuard.length !== LEDGER_BINDING_OPTIONAL_GUARD_PATHS.length) {
    return { ok: false, activated: false, problems: [`optional guard modifiedPaths rows are absent-or-exactly-BOTH (saw ${liveGuard.length} of ${LEDGER_BINDING_OPTIONAL_GUARD_PATHS.length}) — a partial supply never normalizes`] };
  }
  if (liveGuard.length === LEDGER_BINDING_OPTIONAL_GUARD_PATHS.length) {
    const idx = (p) => liveLedger.modifiedPaths.map((r) => r?.path).lastIndexOf(p);
    const [first, second] = LEDGER_BINDING_OPTIONAL_GUARD_PATHS;
    if (idx(first) === -1 || idx(second) === -1 || idx(first) >= idx(second)) {
      return { ok: false, activated: false, problems: ['optional guard modifiedPaths rows must be appended in the fixed order (guard-liveness.ts before guard-liveness.test.ts)'] };
    }
    const lastNonGuard = Math.max(...liveLedger.modifiedPaths.map((r, i) => (isOptionalGuard(r) || isOptionalSmoke(r) ? -1 : i)));
    if (idx(first) < lastNonGuard || idx(second) < lastNonGuard) {
      return { ok: false, activated: false, problems: ['optional guard modifiedPaths rows must be appended after every original modifiedPaths row (fixed appended order)'] };
    }
  }
  // Prospective unit-63/64 optional smoke rows: absent-or-exactly-BOTH, closed path+sha256,
  // exact 64-hex, unique, appended after every non-smoke row (guard rows included) in fixed
  // order, NEVER in the fixed-checkpoint baseline. Mirrors the unit-46 guard contract exactly.
  const smokeRowsOf = (ledger) => (ledger.modifiedPaths ?? []).filter(isOptionalSmoke);
  const baseSmoke = smokeRowsOf(baselineLedger);
  if (baseSmoke.length) return { ok: false, activated: false, problems: ['the fixed-checkpoint baseline must not carry the optional smoke modifiedPaths rows'] };
  const liveSmoke = smokeRowsOf(liveLedger);
  for (const row of liveSmoke) {
    const keys = Object.keys(row).sort();
    if (keys.length !== 2 || keys[0] !== 'path' || keys[1] !== 'sha256') return { ok: false, activated: false, problems: [`optional smoke modifiedPaths row ${row.path} must carry only path+sha256 (got ${keys.join(',')})`] };
    if (!HEX64.test(row.sha256 ?? '')) return { ok: false, activated: false, problems: [`optional smoke modifiedPaths row ${row.path} sha256 must be exact 64-hex`] };
  }
  if (liveSmoke.length !== new Set(liveSmoke.map((r) => r.path)).size) return { ok: false, activated: false, problems: ['duplicate optional smoke modifiedPaths rows refuse'] };
  if (liveSmoke.length !== 0 && liveSmoke.length !== LEDGER_BINDING_OPTIONAL_SMOKE_PATHS.length) {
    return { ok: false, activated: false, problems: [`optional smoke modifiedPaths rows are absent-or-exactly-BOTH (saw ${liveSmoke.length} of ${LEDGER_BINDING_OPTIONAL_SMOKE_PATHS.length}) - a partial supply never normalizes`] };
  }
  if (liveSmoke.length === LEDGER_BINDING_OPTIONAL_SMOKE_PATHS.length) {
    const idx = (p) => liveLedger.modifiedPaths.map((r) => r?.path).lastIndexOf(p);
    const [first, second] = LEDGER_BINDING_OPTIONAL_SMOKE_PATHS;
    if (idx(first) === -1 || idx(second) === -1 || idx(first) >= idx(second)) {
      return { ok: false, activated: false, problems: ['optional smoke modifiedPaths rows must be appended in the fixed order (audit-self.yml before own-config-cell.sh)'] };
    }
    const lastNonSmoke = Math.max(...liveLedger.modifiedPaths.map((r, i) => (isOptionalSmoke(r) ? -1 : i)));
    if (idx(first) < lastNonSmoke || idx(second) < lastNonSmoke) {
      return { ok: false, activated: false, problems: ['optional smoke modifiedPaths rows must be appended after every non-smoke modifiedPaths row (guard rows included)'] };
    }
  }
  const normalize = (ledger) => {
    const clone = structuredClone(ledger);
    for (const row of clone.addedPaths) if (isAdded(row)) row.sha256 = '*';
    clone.modifiedPaths = clone.modifiedPaths.filter((row) => !isNewModified(row) && !isOptionalGuard(row) && !isOptionalSmoke(row)).map((row) => (isModified(row) ? { ...row, sha256: '*' } : row));
    return clone;
  };
  const equal = JSON.stringify(normalize(liveLedger)) === JSON.stringify(normalize(baselineLedger));
  if (!equal) return { ok: false, activated: false, problems: ['scope-extension ledger changed outside the finite existing-ledger binding channel (normalized comparison with the fixed-checkpoint baseline failed)'] };
  return {
    ok: true,
    activated: liveNew.length === LEDGER_BINDING_NEW_MODIFIED_PATHS.length,
    newRows: liveNew,
    guardRows: liveGuard,
    guardGoverned: liveGuard.length === LEDGER_BINDING_OPTIONAL_GUARD_PATHS.length,
    smokeRows: liveSmoke,
    smokeGoverned: liveSmoke.length === LEDGER_BINDING_OPTIONAL_SMOKE_PATHS.length,
    problems: [],
  };
}

// Governed-path verdicts for the five ledger-bound source rows (pure half of the channel):
// each descriptor carries the checkpoint (cd3) mode/kind, the live mode/kind, the live
// content sha256 and the LIVE ledger row pin. Wrong mode/kind/symlink/gitlink, deletion or
// unknown path refuses regardless of any supplied hash; a pin that matches the actual live
// bytes is content-bound; an ACTIVATED ledger whose pin mismatches the bytes refuses
// (a tampered purported binding never passes); an UNACTIVATED (baseline) ledger whose pin
// the live bytes no longer match yields the honest finite PENDING diagnostic.
export function governedPathVerdicts({ channel, governed }) {
  const problems = [];
  for (const g of governed) {
    if (!g.checkpointEntry) { problems.push(`ledger binding path missing from the admitted checkpoint tree: ${g.path} — unknown path refuses regardless of any supplied hash`); continue; }
    if (!g.liveEntry) { problems.push(`ledger binding path missing from the live HEAD tree: ${g.path} — deletion refuses regardless of any supplied hash`); continue; }
    if (g.liveEntry.mode !== g.checkpointEntry.mode || g.liveEntry.kind !== g.checkpointEntry.kind) {
      problems.push(`ledger binding path ${g.path} mode/kind changed (checkpoint ${g.checkpointEntry.mode}/${g.checkpointEntry.kind} -> live ${g.liveEntry.mode}/${g.liveEntry.kind}) — wrong mode, symlink or gitlink refuses`);
      continue;
    }
    const legacyRow = LEDGER_BINDING_ADDED_PATHS.includes(g.path) || LEDGER_BINDING_MODIFIED_PATHS.includes(g.path);
    if (!g.pin || !HEX64.test(g.pin ?? '')) {
      // The three EXISTING rows are structurally guaranteed by every valid v1 ledger (the
      // channel counts them exactly) — a missing/malformed one means the ledger or the pin
      // lookup broke and refuses. The two NEW rows exist only in the activated proposal L —
      // pre-activation their absence is exactly the pending state, reported by the caller.
      if (legacyRow) problems.push(`ledger binding row for ${g.path} lacks an exact 64-hex sha256 pin`);
      continue;
    }
    if (g.liveSha === g.pin && channel.activated) continue; // content-bound discharge requires the ACTIVATED ledger
    if (channel.activated) problems.push(`activated ledger pin for ${g.path} does not match the actual live bytes (${g.liveSha} != ${g.pin}) — a purported binding that does not bind refuses`);
    // unactivated ledger (any pin state) with changed live bytes: reported by the caller as PENDING
  }
  return problems;
}

// IO half of the ledger channel: reads the LIVE scope-extension.json from disk and the
// FIXED-CHECKPOINT (the current native-gated head; same baseline blob the historical cd3
// carried) ledger object through the SAME shared git runner the caller
// uses for its other historical reads (so a fresh checkout serves it from the owned store),
// then evaluates the pure channel. Any unreadable or unparseable side fails CLOSED — never a
// silent pass, never an accidental "activated". Exported for direct fixture tests.
export function currentLedgerChannel({ repoRoot, git }) {
  let liveRaw = null;
  try { liveRaw = readFileSync(join(repoRoot, S3_LEDGER_REL)); } catch { /* reported below */ }
  const base = git(['cat-file', 'blob', `${CURRENT_TRANSFER_CHECKPOINT.head}:${S3_LEDGER_REL}`]);
  const problems = [];
  if (liveRaw === null) problems.push(`live scope-extension ledger unreadable at ${S3_LEDGER_REL}`);
  if (base.rc !== 0) problems.push(`fixed-checkpoint baseline ledger object ${CURRENT_TRANSFER_CHECKPOINT.head}:${S3_LEDGER_REL} unreadable through the shared git runner (rc ${base.rc})`);
  let liveLedger = null;
  let baselineLedger = null;
  if (liveRaw !== null) {
    try { liveLedger = JSON.parse(liveRaw.toString('utf8')); } catch (e) { problems.push(`live scope-extension ledger is not valid JSON: ${e.message}`); }
  }
  if (base.rc === 0) {
    try { baselineLedger = JSON.parse(base.stdout.toString('utf8')); } catch (e) { problems.push(`baseline scope-extension ledger object is not valid JSON: ${e.message}`); }
  }
  if (problems.length) return { ok: false, activated: false, liveLedger, baselineLedger, problems };
  return { ...evaluateLedgerChannel({ liveLedger, baselineLedger }), liveLedger, baselineLedger };
}

export function loadPortableReference(repoRoot) {
  const file = join(repoRoot, PORTABLE_REFERENCE_REL);
  if (!existsSync(file)) return { absent: true, ok: false, problems: [] };
  let raw;
  try { raw = readFileSync(file); } catch (e) { return { absent: false, ok: false, problems: [`portable reference unreadable: ${e.message}`] }; }
  const problems = [];
  if (raw.length !== PORTABLE_REFERENCE_BYTES) problems.push(`portable reference byte length ${raw.length} is not the admitted ${PORTABLE_REFERENCE_BYTES} (truncated or foreign data refuses)`);
  if (sha256buf(raw) !== PORTABLE_REFERENCE_SHA256) problems.push(`portable reference sha drifted from the admitted Root bytes (${PORTABLE_REFERENCE_REL}); changed reference data needs a new corresponding review, never silent tuple movement`);
  return { absent: false, ok: problems.length === 0, problems };
}

// Clean scrubbed Git environment for the isolated store: nothing inherited from the ambient
// repository (no GIT_DIR / GIT_INDEX_FILE / GIT_OBJECT_DIRECTORY / GIT_ALTERNATE_OBJECT_DIRECTORIES
// / GIT_COMMON_DIR), no system or global config reads, file transport only, no prompts.
export function isolatedGitEnv() {
  return {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    HOME: process.env.HOME,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    LC_ALL: 'C',
  };
}

// A git runner bound to the isolated store with the scrubbed environment. The native status
// is returned exactly as produced (never re-derived after another command).
export function makeIsolatedGit(storeDir) {
  const env = isolatedGitEnv();
  return (args) => {
    // maxBuffer parity with every other runner in this module (64 MiB): the store serves the
    // SAME query class as the live runner, and the anchored-base full-diff recompute alone is
    // ~16 MiB — the spawnSync default (1 MiB) kills the child mid-stream (rc null), which a
    // fresh single-branch checkout would misreport as an unresolvable relation.
    const r = spawnSync('git', args, { cwd: storeDir, env, maxBuffer: 64 * 1024 * 1024 });
    return { rc: r.status, stdout: r.stdout ?? Buffer.alloc(0), stderr: r.stderr ?? Buffer.alloc(0) };
  };
}

// Hydrate a uniquely owned isolated object store from ONLY the published objects plus the
// admitted bundle. Verifies artifact bytes first, then: published staging head is the pinned
// bc8; the bundle prerequisite is a real ancestor of it; all six historical objects are
// ABSENT before transport (fresh closure); the bundle transports under its single advertised
// ref; the exact six commit/tree tuples exist afterward; the real chain 4fa->1cb->ac175->
// cf64 holds with source->generation a direct parent; and the historical generation is NOT
// an ancestor of published staging (portability never rewrites ancestry). Any native failure
// is a refusal (fail-closed). The store is retained caller-owned fixture state.
export function hydratePortableReferenceStore({ repoRoot, storeDir, bundlePath, currentHead }) {
  const canonical = loadPortableReference(repoRoot);
  if (canonical.absent) return { ok: false, problems: ['portable reference carrier absent from the repo (nothing to hydrate from)'] };
  if (!canonical.ok) return { ok: false, problems: canonical.problems };
  const bundle = bundlePath ?? join(repoRoot, PORTABLE_REFERENCE_REL);
  let raw;
  try { raw = readFileSync(bundle); } catch (e) { return { ok: false, problems: [`portable reference bundle unreadable: ${e.message}`] }; }
  if (raw.length !== PORTABLE_REFERENCE_BYTES || sha256buf(raw) !== PORTABLE_REFERENCE_SHA256) {
    return { ok: false, problems: [`transport source is not the admitted artifact (length ${raw.length}, sha ${sha256buf(raw)}) — truncated, corrupted or foreign data refuses before any transport`] };
  }
  // Uniquely owned store: the directory exists BEFORE any command runs with it as cwd
  // (spawnSync with a missing cwd is a native ENOENT, not a git refusal).
  mkdirSync(storeDir, { recursive: true });
  const git = makeIsolatedGit(storeDir);
  const init = git(['init', '--bare', '--quiet', storeDir]);
  if (init.rc !== 0) return { ok: false, problems: [`isolated store init failed natively (exit ${init.rc}): ${init.stderr.toString().trim().slice(0, 160)}`] };
  const problems = [];
  // Strict native-status discipline (Root unit-35 qualification): `merge-base
  // --is-ancestor` answers with exactly exit 0 (yes) or exit 1 (no). Exit 128, a null
  // status or a signal is a native I/O or repository ERROR — never proof of ancestry and
  // never proof of non-ancestry — so it refuses instead of silently counting as the
  // convenient side.
  const expectAncestor = (a, b, label, wantYes) => {
    const r = git(['merge-base', '--is-ancestor', a, b]);
    if (r.rc !== 0 && r.rc !== 1) { problems.push(`${label}: native status ${r.rc ?? 'null'} (stderr ${r.stderr.toString().trim().slice(0, 120) || 'empty'}) is an I/O or repository error, not a ${wantYes ? 'proof of ancestry' : 'proof of non-ancestry'} — fail-closed`); return; }
    if (wantYes && r.rc !== 0) problems.push(label);
    if (!wantYes && r.rc === 0) problems.push(label);
  };
  // Stock pinned-SHA pack transport (Root unit-36 item B; the already-admitted DATA
  // collector algorithm in prepare-native-reference-evidence.py): `git pack-objects
  // --stdout --revs` fed the RAW pinned sha needs NO ambient named ref — a fresh
  // single-branch PR checkout carries refs only at the delivery head while the pinned
  // published head stays a reachable commit — and the pack bytes are indexed into the
  // uniquely owned store with `git index-pack --stdin`, then pinned by `update-ref` inside
  // that owned store only. No network, no auto-fetch, no shared refs/config/objects
  // writes, no local clone/hardlinks/alternates/shallow/replace.
  const packOut = spawnSync('git', ['-C', repoRoot, 'pack-objects', '--stdout', '--revs'], { input: `${UPSTREAM_STAGING_HEAD}\n`, env: isolatedGitEnv(), maxBuffer: 64 * 1024 * 1024 });
  if ((packOut.status ?? -1) !== 0 || packOut.stdout.length === 0) return { ok: false, problems: [`pinned published-commit pack transport failed natively (exit ${packOut.status}, signal ${packOut.signal ?? 'none'}): ${String(packOut.stderr ?? '').trim().slice(0, 160)} — the pinned published graph is not available through stock local transport (no auto-fetch, no network)`] };
  const indexed = spawnSync('git', ['--git-dir=' + storeDir, 'index-pack', '--stdin'], { input: packOut.stdout, env: isolatedGitEnv(), maxBuffer: 64 * 1024 * 1024 });
  if ((indexed.status ?? -1) !== 0) return { ok: false, problems: [`owned-store index-pack of the pinned published graph failed natively (exit ${indexed.status}, signal ${indexed.signal ?? 'none'}): ${String(indexed.stderr ?? '').trim().slice(0, 160)}`] };
  const setPublishedRef = git(['update-ref', 'refs/heads/published-staging', UPSTREAM_STAGING_HEAD]);
  if (setPublishedRef.rc !== 0) return { ok: false, problems: [`owned-store update-ref of the pinned published head failed natively (exit ${setPublishedRef.rc}): ${setPublishedRef.stderr.toString().trim().slice(0, 160)}`] };
  if (problems.length) return { ok: false, problems };
  const publishedHead = git(['rev-parse', 'refs/heads/published-staging']);
  if (publishedHead.rc !== 0 || publishedHead.stdout.toString().trim() !== UPSTREAM_STAGING_HEAD) problems.push(`published staging head is not the pinned ${UPSTREAM_STAGING_HEAD} (wrong provenance)`);
  expectAncestor(PORTABLE_REFERENCE_PREREQUISITE, 'refs/heads/published-staging', `bundle prerequisite ${PORTABLE_REFERENCE_PREREQUISITE} is not an ancestor of published staging (wrong provenance)`, true);
  const beforeRefs = git(['for-each-ref', '--format=%(refname)']);
  if (beforeRefs.rc !== 0 || beforeRefs.stdout.toString().trim() !== 'refs/heads/published-staging') problems.push(`fresh store carries unexpected refs before hydration: ${beforeRefs.stdout.toString().trim()}`);
  const absent = PORTABLE_REFERENCE_TUPLES.map((t) => git(['cat-file', '-e', `${t.commit}^{commit}`]));
  const already = PORTABLE_REFERENCE_TUPLES.filter((t, i) => absent[i].rc === 0);
  if (already.length) problems.push(`historical objects already present before hydration (store not fresh): ${already.map((t) => t.commit).join(', ')}`);
  if (problems.length) return { ok: false, problems };
  const unbundle = git(['fetch', '--quiet', '--no-tags', bundle, `+${PORTABLE_REFERENCE_REF}:${PORTABLE_REFERENCE_REF}`]);
  if (unbundle.rc !== 0) problems.push(`bundle transport refused natively (exit ${unbundle.rc}): ${unbundle.stderr.toString().trim().slice(0, 160)}`);
  if (problems.length) return { ok: false, problems };
  for (const t of PORTABLE_REFERENCE_TUPLES) {
    const tree = git(['rev-parse', `${t.commit}^{tree}`]);
    if (tree.rc !== 0 || tree.stdout.toString().trim() !== t.tree) problems.push(`historical tuple ${t.commit}/${t.tree} did not hydrate exactly (got ${tree.rc === 0 ? tree.stdout.toString().trim() : 'unresolvable'})`);
  }
  const refHead = git(['rev-parse', PORTABLE_REFERENCE_REF]);
  if (refHead.rc !== 0 || refHead.stdout.toString().trim() !== ACCEPTED_TOPIC_HEAD) problems.push(`bundle ref ${PORTABLE_REFERENCE_REF} is not the preserved cf64 head`);
  const CHAIN = [[0, 1], [1, 2], [2, 5]];
  for (const [a, b] of CHAIN) {
    expectAncestor(PORTABLE_REFERENCE_TUPLES[a].commit, PORTABLE_REFERENCE_TUPLES[b].commit, `historical chain link ${PORTABLE_REFERENCE_TUPLES[a].commit} -> ${PORTABLE_REFERENCE_TUPLES[b].commit} is not an ancestor relation`, true);
  }
  const directParent = git(['rev-parse', `${PORTABLE_REFERENCE_TUPLES[2].commit}^`]);
  if (directParent.rc !== 0 || directParent.stdout.toString().trim() !== PORTABLE_REFERENCE_TUPLES[1].commit) problems.push('source -> generation direct-parent relation is not preserved');
  for (const t of PORTABLE_REFERENCE_TUPLES.slice(0, 5)) {
    expectAncestor(t.commit, ACCEPTED_TOPIC_HEAD, `historical object ${t.commit} is not an ancestor of preserved cf64`, true);
  }
  for (const t of PORTABLE_REFERENCE_TUPLES) {
    expectAncestor(t.commit, 'refs/heads/published-staging', `historical object ${t.commit} must NOT be an ancestor of published staging (portability never rewrites ancestry)`, false);
  }
  // Root unit-37 §2 (mixed-graph semantics): a SINGLE native relation such as
  // `merge-base <historical> HEAD` needs BOTH graphs in the SAME object database — running
  // original args unchanged against a store that holds only bc8+cf64 cannot compose one
  // query from two databases. Seed the ACTUAL current caller commit graph (the live HEAD
  // resolved by the caller, never the bare store's own HEAD) with the same stock reachable
  // RAW-SHA pack transport, pinned inside the owned store only. The cache is keyed on the
  // exact current commit (see portableReferenceStore), so every new commit rehydrates a
  // fresh owned store. Expected native statuses stay exactly 0/1; 128/null/error refuses.
  if (currentHead && HEX40RE.test(currentHead)) {
    const currentPack = spawnSync('git', ['-C', repoRoot, 'pack-objects', '--stdout', '--revs'], { input: `${currentHead}\n`, env: isolatedGitEnv(), maxBuffer: 64 * 1024 * 1024 });
    if ((currentPack.status ?? -1) !== 0 || currentPack.stdout.length === 0) return { ok: false, problems: [`current caller graph pack transport failed natively (exit ${currentPack.status}, signal ${currentPack.signal ?? 'none'}): ${String(currentPack.stderr ?? '').trim().slice(0, 160)}`] };
    const currentIndexed = spawnSync('git', ['--git-dir=' + storeDir, 'index-pack', '--stdin'], { input: currentPack.stdout, env: isolatedGitEnv(), maxBuffer: 64 * 1024 * 1024 });
    if ((currentIndexed.status ?? -1) !== 0) return { ok: false, problems: [`owned-store index-pack of the current caller graph failed natively (exit ${currentIndexed.status}, signal ${currentIndexed.signal ?? 'none'}): ${String(currentIndexed.stderr ?? '').trim().slice(0, 160)}`] };
    const setCurrentRef = git(['update-ref', 'refs/heads/current-workspace', currentHead]);
    if (setCurrentRef.rc !== 0) return { ok: false, problems: [`owned-store update-ref of the current caller head failed natively (exit ${setCurrentRef.rc}): ${setCurrentRef.stderr.toString().trim().slice(0, 160)}`] };
    expectAncestor(UPSTREAM_STAGING_HEAD, 'refs/heads/current-workspace', `published staging must remain an ancestor of the seeded current workspace head (wrong current graph)`, true);
  }
  return { ok: problems.length === 0, problems, store: storeDir };
}

// Production store custody (Root unit-35 item 2): the shared store is an OWNED mkdtemp
// lifetime bound to the actual repository + the admitted carrier bytes + provenance pins.
// The cache key covers exactly that triple, so a mutated canonical carrier, a different
// repository or changed provenance pins NEVER reuse a hydrated store — and every call
// re-validates the canonical artifact bytes plus the store's live state (each required
// tuple resolvable to its exact tree, the bundle ref intact, no alternates borrowed) so a
// pre-existing known tuple can never bypass current validation. Stores are retained
// caller-owned fixtures (no deletion, no shared or symlinked location).
let PORTABLE_STORE_CACHE = null;
export function portableReferenceStore(repoRoot, opts = {}) {
  const canonical = loadPortableReference(repoRoot);
  if (canonical.absent) return { ok: false, absent: true, problems: ['portable reference carrier absent'] };
  if (!canonical.ok) return { ok: false, absent: false, problems: canonical.problems };
  const currentHead = HEX40RE.test(String(opts.currentHead ?? '')) ? String(opts.currentHead) : null;
  const key = JSON.stringify([
    resolve(repoRoot),
    PORTABLE_REFERENCE_SHA256,
    PORTABLE_REFERENCE_BYTES,
    PORTABLE_REFERENCE_PREREQUISITE,
    UPSTREAM_STAGING_HEAD,
    ACCEPTED_TOPIC_HEAD,
    PORTABLE_REFERENCE_TUPLES,
    currentHead,
  ]);
  if (PORTABLE_STORE_CACHE?.key === key) {
    const git = makeIsolatedGit(PORTABLE_STORE_CACHE.storeDir);
    const state = PORTABLE_REFERENCE_TUPLES.every((t) => {
      const tree = git(['rev-parse', `${t.commit}^{tree}`]);
      return tree.rc === 0 && tree.stdout.toString().trim() === t.tree;
    });
    const refHead = git(['rev-parse', PORTABLE_REFERENCE_REF]);
    // Root unit-36 item B (binding qualification): reuse must revalidate the EXACT admitted
    // published identity — `rev-parse refs/heads/published-staging` EQUALS the pinned
    // UPSTREAM_STAGING_HEAD — never a mere existence `cat-file -e` (a moved or replaced ref
    // would pass that), plus owned custody: no alternates borrowed and no symlinked store.
    const publishedNow = git(['rev-parse', 'refs/heads/published-staging']);
    const currentNow = currentHead ? git(['rev-parse', 'refs/heads/current-workspace']) : { rc: 0, stdout: Buffer.from(currentHead ?? '') };
    if (state && refHead.rc === 0 && refHead.stdout.toString().trim() === ACCEPTED_TOPIC_HEAD
      && publishedNow.rc === 0 && publishedNow.stdout.toString().trim() === UPSTREAM_STAGING_HEAD
      && currentNow.stdout.toString().trim() === (currentHead ?? '')
      && !existsSync(join(PORTABLE_STORE_CACHE.storeDir, 'objects', 'info', 'alternates'))
      && !lstatSync(PORTABLE_STORE_CACHE.storeDir).isSymbolicLink()) {
      return { ok: true, storeDir: PORTABLE_STORE_CACHE.storeDir, reused: true };
    }
    // wrong state — a pre-existing known tuple does NOT bypass current validation: hydrate
    // a fresh owned store instead of trusting the stale one.
  }
  const storeDir = mkdtempSync(join(tmpdir(), 'tak-portable-store-'));
  const h = hydratePortableReferenceStore({ repoRoot, storeDir, currentHead });
  if (!h.ok) return { ok: false, absent: false, problems: h.problems };
  PORTABLE_STORE_CACHE = { key, storeDir };
  return { ok: true, storeDir, reused: false };
}

// The shared isolated historical-reference reader (Root unit-35 item 1): ONE owner serving
// every real consumer — M15 commit/tree, the recovered->source->generation chain, the
// direct generation parent, the manifest-only diff and manifest bytes, the S2 original-23d
// inventory and the S3/S4 anchor/predecessor reads. Each predicate tries the caller's live
// git runner FIRST and falls back to the owned isolated store only when the live checkout
// cannot resolve the object — never a dangling-link boolean alone. Ancestry answers carry
// the strict 0/1 native-status discipline; any other status refuses.
export function sharedHistoricalReader({ repoRoot, git }) {
  const live = (args) => git(args);
  const store = () => portableReferenceStore(repoRoot);
  const liveResolves = (sha) => {
    const t = live(['cat-file', '-t', `${sha}^{commit}`]);
    return t.rc === 0 && t.stdout.toString().trim() === 'commit';
  };
  const viaStore = (sha, args, label) => {
    const s = store();
    if (!s.ok) return { ok: false, problems: [`${label}: the shared isolated store cannot serve it (${s.problems.join(' | ')})`] };
    const g = makeIsolatedGit(s.storeDir);
    const r = g(args);
    return { ok: r.rc === 0, rc: r.rc, stdout: r.stdout, stderr: r.stderr, storeDir: s.storeDir };
  };
  return {
    commitType(sha) {
      if (liveResolves(sha)) return { ok: true, type: 'commit', via: 'live' };
      const s = store();
      if (!s.ok) return { ok: false, problems: s.problems };
      const g = makeIsolatedGit(s.storeDir);
      const t = g(['cat-file', '-t', `${sha}^{commit}`]);
      if (t.rc === 0 && t.stdout.toString().trim() === 'commit') return { ok: true, type: 'commit', via: 'store' };
      return { ok: false, problems: [`commit ${sha} resolves neither in the live checkout nor in the shared isolated store`] };
    },
    treeOf(sha) {
      const lt = live(['rev-parse', `${sha}^{tree}`]);
      if (lt.rc === 0) return { ok: true, tree: lt.stdout.toString().trim(), via: 'live' };
      const st = viaStore(sha, ['rev-parse', `${sha}^{tree}`], `tree of ${sha}`);
      return st.ok ? { ok: true, tree: st.stdout.toString().trim(), via: 'store' } : st;
    },
    parentOf(sha) {
      const lp = live(['rev-parse', `${sha}^`]);
      if (lp.rc === 0) return { ok: true, parent: lp.stdout.toString().trim(), via: 'live' };
      const sp = viaStore(sha, ['rev-parse', `${sha}^`], `parent of ${sha}`);
      return sp.ok ? { ok: true, parent: sp.stdout.toString().trim(), via: 'store' } : sp;
    },
    // status: 'yes' | 'no' | 'error' — 'error' is NEVER proof of either side.
    isAncestor(a, b) {
      const r = live(['merge-base', '--is-ancestor', a, b]);
      if (r.rc === 0 || r.rc === 1) return { ok: true, status: r.rc === 0 ? 'yes' : 'no', via: 'live', rc: r.rc };
      const s = store();
      if (!s.ok) return { ok: false, status: 'error', problems: s.problems };
      const g = makeIsolatedGit(s.storeDir);
      const sr = g(['merge-base', '--is-ancestor', a, b]);
      if (sr.rc === 0 || sr.rc === 1) return { ok: true, status: sr.rc === 0 ? 'yes' : 'no', via: 'store', rc: sr.rc };
      return { ok: false, status: 'error', problems: [`ancestry ${a} -> ${b}: native status ${sr.rc ?? 'null'} is an I/O or repository error, not a proof — fail-closed`] };
    },
    diffNameOnly(a, b) {
      const ld = live(['diff', '--name-only', `${a}..${b}`]);
      if (ld.rc === 0) return { ok: true, paths: ld.stdout.toString().split('\n').filter(Boolean), via: 'live' };
      const sd = viaStore(a, ['diff', '--name-only', `${a}..${b}`], `diff ${a}..${b}`);
      return sd.ok ? { ok: true, paths: sd.stdout.toString().split('\n').filter(Boolean), via: 'store' } : sd;
    },
    catFile(sha, path) {
      const lc = live(['cat-file', '-p', `${sha}:${path}`]);
      if (lc.rc === 0) return { ok: true, bytes: lc.stdout, via: 'live' };
      const sc = viaStore(sha, ['cat-file', '-p', `${sha}:${path}`], `cat-file ${sha}:${path}`);
      return sc.ok ? { ok: true, bytes: sc.stdout, via: 'store' } : sc;
    },
    // Root unit-36 item A: the full recursive path listing of a tree (the s2-inventory
    // accepted-scope read): live checkout git first, the shared owned store when the live
    // object database genuinely cannot resolve the historical tree (fresh single-branch
    // checkout). One shared owned reader serves the real object reads.
    listTreePaths(treeIsh) {
      const lt = live(['ls-tree', '-r', '--name-only', '-z', treeIsh]);
      if (lt.rc === 0) return { ok: true, paths: lt.stdout.toString('utf8').split('\0').filter(Boolean), via: 'live' };
      const st = viaStore(treeIsh, ['ls-tree', '-r', '--name-only', '-z', treeIsh], `tree listing of ${treeIsh}`);
      return st.ok ? { ok: true, paths: st.stdout.toString('utf8').split('\0').filter(Boolean), via: 'store' } : st;
    },
    storeDirOf() { const s = store(); return s.ok ? s.storeDir : null; },
  };
}

// Root unit-36 item A: a git-runner multiplexer for composite consumers that need BOTH the
// live checkout objects and historical/published objects in one relation (the reviewed
// upstream lineage and current-transfer reconciliations). The caller's live git runs first;
// only a native 128 "object (or ref) not resolvable here" falls back to ONE retry through
// the shared owned store (which — after the unit-36 pack transport — holds the pinned
// published bc8 graph AND the admitted portable historical tuples). Every other status
// passes through untouched: 0/1 stay exact, real I/O errors stay errors. When both the
// historical and current graphs are needed, the CURRENT newbranch graph resolves in the
// live checkout itself (cd3..HEAD are ancestors of the checkout HEAD) while the historical
// and published graphs resolve in the owned store — never a shared mutation.
export function storeFallbackGit(repoRoot, git) {
  return (args) => {
    const live = git(args);
    if (live.rc !== 128) return live;
    // Root unit-37 §2: live revision operands resolve to ACTUAL caller OIDs before any
    // store retry — a private bare store has no HEAD, and pretending the two databases
    // compose one native query is exactly what this must not do. The current caller graph
    // is seeded into the SAME owned store (cache-bound to the exact current commit), so a
    // single mixed relation (merge-base <historical> <live-OID>, diff, ls-tree) executes
    // against one object database with native 0/1 statuses.
    const headOid = git(['rev-parse', 'HEAD']);
    if (headOid.rc !== 0 || !HEX40RE.test(headOid.stdout.toString().trim())) return live;
    const oid = headOid.stdout.toString().trim();
    const mapped = args.map((a) => (typeof a === 'string' && (a === 'HEAD' || a.startsWith('HEAD^') || a.startsWith('HEAD~')) ? oid + a.slice(4) : a));
    const s = portableReferenceStore(repoRoot, { currentHead: oid });
    if (!s.ok) return live;
    return makeIsolatedGit(s.storeDir)(mapped);
  };
}

// M15/S3 consumption: resolve one of the reviewed historical commits through the pinned
// portable reference when it is absent from the live checkout. Delegates to the OWNED
// shared store (never a fixed shared path); hydration failure keeps the original
// dangling-object refusal.
export function portableCommitResolves({ repoRoot, sha }) {
  const known = PORTABLE_REFERENCE_TUPLES.find((t) => t.commit === sha);
  if (!known) return { ok: false, reason: 'not one of the reviewed portable tuples' };
  const s = portableReferenceStore(repoRoot);
  if (!s.ok) return { ok: false, reason: s.problems.join(' | ') };
  const git = makeIsolatedGit(s.storeDir);
  const tree = git(['rev-parse', `${sha}^{tree}`]);
  if (tree.rc !== 0 || tree.stdout.toString().trim() !== known.tree) return { ok: false, reason: 'hydrated tuple tree mismatch' };
  return { ok: true, store: s.storeDir };
}

// The reviewed finite LIVE current transfer (Root unit-35 item 3): the checkpoint is the
// FIXED reviewed constant — no caller checkpoint override — and the relation checks the
// ACTUAL current tracked subject, not only the old cd3 tree. Invariants: exact checkpoint
// head/tree/single bc8 parent; real checkpoint AND bc8 ancestry of the live HEAD; the
// complete cf64-union-bc8 path/mode/content lineage over BOTH the checkpoint tree and the
// live HEAD tree — every reviewed row carries its bc8-origin blob or one of exactly three
// admitted content-pinned replacements (content sha verified through cat-file); unknown
// missing/changed/mode-swapped/symlink rows refuse; upstream-origin paths appearing in the
// live tree WITHOUT a reviewed row refuse (extras never ride in). This relation is
// STRUCTURAL routing only: it never renews behavioral, performance or CI evidence, and
// changed current source binds only through actual Root-admitted postimages.
export function reconcileCurrentTransfer({ repoRoot, git, carrier }) {
  if (!carrier?.ok) return ['current transfer requires a valid reviewed carrier'];
  const checkpoint = CURRENT_TRANSFER_CHECKPOINT;
  const problems = [];
  const head = checkpoint.head;
  const treeOf = git(['rev-parse', `${head}^{tree}`]);
  if (treeOf.rc !== 0 || treeOf.stdout.toString().trim() !== checkpoint.tree) return [`current-transfer checkpoint ${head} does not resolve to the reviewed tree ${checkpoint.tree} (unrelated or wrong head refuses)`];
  const parents = git(['log', '-1', '--format=%P', head]);
  if (parents.rc !== 0 || parents.stdout.toString().trim() !== checkpoint.parent) problems.push(`current-transfer checkpoint parent must be exactly ${checkpoint.parent} (got ${parents.rc === 0 ? parents.stdout.toString().trim() || 'none' : 'unresolvable'})`);
  const expectAnc = (a, b, label) => {
    const r = git(['merge-base', '--is-ancestor', a, b]);
    if (r.rc !== 0 && r.rc !== 1) { problems.push(`${label}: native status ${r.rc ?? 'null'} is an I/O or repository error, not an ancestry proof — fail-closed`); return; }
    if (r.rc !== 0) problems.push(label);
  };
  expectAnc(checkpoint.parent, head, `upstream staging ${checkpoint.parent} must be an actual ancestor of the current-transfer checkpoint`);
  const liveHeadRev = git(['rev-parse', 'HEAD']);
  if (liveHeadRev.rc !== 0) return ['git cannot resolve the live HEAD (producer-off is a refusal, never a pass)'];
  const liveHead = liveHeadRev.stdout.toString().trim();
  expectAnc(checkpoint.head, liveHead, `current-transfer checkpoint ${checkpoint.head} must be an actual ancestor of the live HEAD ${liveHead}`);
  expectAnc(checkpoint.parent, liveHead, `upstream staging ${checkpoint.parent} must be an actual ancestor of the live HEAD ${liveHead}`);
  const rows = carrier.data.currentLineageOnlyScope.upstreamAdditions;
  const admitted = new Map(ADMITTED_CURRENT_REPLACEMENTS.map((r) => [r.path, r]));
  const rowPaths = new Set(rows.map((r) => r.path));
  const readTree = (treeIsh, label) => {
    const tree = git(['ls-tree', '-r', '-z', treeIsh]);
    if (tree.rc !== 0) return null;
    const map = new Map();
    for (const entry of tree.stdout.toString('utf8').split('\0').filter(Boolean)) {
      const meta = /^(\d+) (blob|tree|commit) ([0-9a-f]{40})\t(.*)$/s.exec(entry);
      if (meta) map.set(meta[4], { mode: meta[1], kind: meta[2], oid: meta[3] });
    }
    return { map, label };
  };
  const checkpointTree = readTree(checkpoint.tree, 'checkpoint');
  const liveTree = readTree(`${liveHead}^{tree}`, 'live HEAD');
  if (!checkpointTree) return [`git cannot resolve the checkpoint tree ${checkpoint.tree} (producer-off is a refusal, never a pass)`];
  if (!liveTree) return [`git cannot resolve the live HEAD tree (producer-off is a refusal, never a pass)`];
  let admittedSeen = 0;
  const currentOnly = new Map(ADMITTED_CURRENT_ONLY_SUCCESSORS.map((s) => [s.path, s]));
  for (const row of rows) {
    const replacement = admitted.get(row.path);
    if (replacement) admittedSeen += 1;
    const expected = replacement ?? row;
    const successor = currentOnly.get(row.path) ?? null;
    if (successor && successor.checkpoint.gitBlob !== row.gitBlob) problems.push(`current-only successor frozen checkpoint identity ${successor.checkpoint.gitBlob} disagrees with the reviewed row ${row.gitBlob} at ${row.path} — the successor must extend, not rewrite, the reviewed origin`);
    for (const { map, label } of [checkpointTree, liveTree]) {
      const entry = map.get(row.path);
      if (!entry) { problems.push(`current-transfer row missing from the ${label} tree: ${row.path}`); continue; }
      if (entry.mode !== row.mode || entry.kind !== row.kind) problems.push(`current-transfer mode/kind mismatch at ${row.path} in the ${label} tree: reviewed ${row.mode}/${row.kind} vs ${entry.mode}/${entry.kind} (a symlink or permission swap refuses)`);
      if (successor) {
        // Root unit-41 current-only successor relation: the checkpoint leg keeps the original
        // reviewed blob; the live leg may carry the reviewed original OR the one exact admitted
        // generated successor. Whichever OID a leg presents, the blob it actually serves must
        // hash to that leg's frozen Root-reviewed identity — counterfeit bytes under either
        // OID refuse, and a missing/unreadable object refuses.
        const liveLeg = label === 'live HEAD';
        const permitted = liveLeg ? [row.gitBlob, successor.live.gitBlob] : [successor.checkpoint.gitBlob];
        if (!permitted.includes(entry.oid)) {
          problems.push(`current-only successor path ${row.path} carries ${entry.oid} in the ${label} tree — the checkpoint must retain the reviewed ${successor.checkpoint.gitBlob} and the live leg may carry only the reviewed original ${row.gitBlob} or the exact admitted generated successor ${successor.live.gitBlob}`);
          continue;
        }
        const identity = entry.oid === successor.live.gitBlob ? successor.live : successor.checkpoint;
        const blob = git(['cat-file', 'blob', entry.oid]);
        if (blob.rc !== 0) { problems.push(`current-only successor path ${row.path} blob ${entry.oid} unreadable through the shared git runner (rc ${blob.rc}) in the ${label} tree`); continue; }
        const served = Buffer.isBuffer(blob.stdout) ? blob.stdout : Buffer.from(String(blob.stdout ?? ''), 'utf8');
        if (sha256buf(served) !== identity.sha256 || served.length !== identity.bytes) problems.push(`current-only successor path ${row.path} serves counterfeit bytes under ${entry.oid} in the ${label} tree (sha256 ${sha256buf(served).slice(0, 12)}, ${served.length}B; expected the frozen reviewed ${identity.sha256.slice(0, 12)}, ${identity.bytes}B)`);
      } else if (entry.oid !== expected.gitBlob) problems.push(`changed upstream-origin path without an admitted replacement in the ${label} tree: ${row.path} carries ${entry.oid}, expected the reviewed ${expected.gitBlob}`);
    }
    if (replacement) {
      const content = git(['cat-file', 'blob', replacement.gitBlob]);
      if (content.rc !== 0 || sha256buf(content.stdout) !== replacement.sha256) problems.push(`admitted current-replacement content-sha mismatch at ${row.path}`);
    }
  }
  if (admittedSeen !== ADMITTED_CURRENT_REPLACEMENTS.length) problems.push(`exactly ${ADMITTED_CURRENT_REPLACEMENTS.length} admitted current replacements must appear in the reviewed row set (saw ${admittedSeen})`);
  // Unknown EXTRA upstream-origin current paths: a path the live HEAD tree carries that is
  // NOT part of the reviewed cf64-union-bc8 lineage surface — not a reviewed row, not one of
  // the three admitted replacements, not an admitted carrier, not present in the accepted
  // topic tip tree nor in the upstream staging (bc8) tree — refuses. Extras never ride the
  // transfer in; the union surface is exactly what the carrier's exactUnionOfBothTips
  // reconciliation admitted (topic-only additions are topic-tree paths, staging content is
  // bc8-tree paths, and the rows themselves are the 571 upstream-origin paths whose current
  // blobs must stay exact).
  const stagingTree = readTree(checkpoint.parent, 'bc8 staging baseline');
  // Root unit-71 provenance: the reviewed upstream B itself is a selected immutable source
  // leg — its tree is resolved ONCE through the same shared runner so every new-path tuple
  // below is judged against the actual B origin, never against an arbitrary live blob.
  const bTree = readTree(ADMITTED_CURRENT_B_BINDING.bHead, 'reviewed upstream B');
  if (!bTree) return [`git cannot resolve the reviewed upstream B tree ${ADMITTED_CURRENT_B_BINDING.bHead} (producer-off is a refusal, never a pass)`];
  const topicTree = readTree(ACCEPTED_TOPIC_HEAD, 'accepted topic tip');
  if (!stagingTree) return [`git cannot resolve the bc8 staging tree ${checkpoint.parent} (producer-off is a refusal, never a pass)`];
  if (!topicTree) return [`git cannot resolve the accepted topic tip ${ACCEPTED_TOPIC_HEAD} (producer-off is a refusal, never a pass)`];
  const admittedCarriers = new Set([S2_REVIEWED_INTEGRATION_REL, PORTABLE_REFERENCE_REL]);
  // Root unit-70: the finite B-delta new-path table, judged under full typed identity below.
  const bNewPaths = new Map(ADMITTED_CURRENT_B_NEW_UPSTREAM_PATHS.map((r) => [r.path, r]));
  // Root unit-37 §3: the five governed source rows bind through the EXISTING ledger channel
  // (live scope-extension.json vs the fixed-checkpoint cd3 baseline object, read through the
  // SAME shared git runner so a fresh checkout serves it from the owned store). The channel
  // decides pending vs discharged; everything outside it keeps the unit-36 hard refusals.
  const ledgerChannel = currentLedgerChannel({ repoRoot, git });
  if (!ledgerChannel.ok) problems.push(...ledgerChannel.problems.map((x) => `existing-ledger binding channel invalid: ${x}`));
  // Root unit-38 F2 (committed-ledger binding): the selfIndexed ledger's LIVE HEAD entry is
  // itself load-bearing — the disk-only channel can never substitute for the committed
  // object. The live tree must carry the ledger at its original 100644/blob form, the
  // committed blob must be readable, and the ACTUAL working-file bytes must BE that committed
  // blob — so a valid on-disk ledger cannot hide a different tampered committed ledger, an
  // unresolvable committed object, a mode swap or the ledger's deletion.
  const committedLedger = liveTree.map.get(S3_LEDGER_REL) ?? null;
  let diskLedgerRaw = null;
  try { diskLedgerRaw = readFileSync(join(repoRoot, S3_LEDGER_REL)); } catch { /* the channel already reports the unreadable disk side */ }
  if (!committedLedger) {
    problems.push(`scope-extension ledger missing from the live HEAD tree: ${S3_LEDGER_REL} — deleting the committed selfIndexed ledger refuses; a disk-only ledger cannot substitute for the committed object`);
  } else {
    if (committedLedger.mode !== '100644' || committedLedger.kind !== 'blob') problems.push(`scope-extension ledger live HEAD entry is not the original 100644/blob form (${committedLedger.mode}/${committedLedger.kind}) — mode, symlink or gitlink swaps refuse`);
    const committedBlob = git(['cat-file', 'blob', committedLedger.oid]);
    if (committedBlob.rc !== 0) problems.push(`scope-extension ledger committed blob ${committedLedger.oid} unreadable through the shared git runner (rc ${committedBlob.rc}) — an unresolvable committed ledger refuses`);
    else {
      // Encoding-proof byte comparison: some stage runners hand back utf8 strings (the ledger
      // is ASCII JSON, so the round-trip is exact), native runners hand back Buffers.
      const committedBytes = Buffer.isBuffer(committedBlob.stdout) ? committedBlob.stdout : Buffer.from(String(committedBlob.stdout ?? ''), 'utf8');
      if (diskLedgerRaw !== null && !diskLedgerRaw.equals(committedBytes)) problems.push(`scope-extension ledger working file is not the committed live HEAD blob ${committedLedger.oid} — a valid on-disk ledger cannot mask a different committed ledger (disk sha256 ${sha256buf(diskLedgerRaw).slice(0, 12)}, committed sha256 ${sha256buf(committedBytes).slice(0, 12)})`);
    }
  }
  const governedSet = new Set([...LEDGER_BINDING_ADDED_PATHS, ...LEDGER_BINDING_MODIFIED_PATHS, ...LEDGER_BINDING_NEW_MODIFIED_PATHS]);
  // Root unit-46 §B: the two optional guard paths join the governed-current set ONLY when
  // the actual live ledger supplies BOTH valid typed rows (absent-or-exactly-BOTH; every
  // partial/duplicate/malformed/out-of-order supply is already refused by the channel
  // itself). Without the rows the old contract holds untouched: changed guard/test bytes
  // stay HARD nonrow refusals (the checkpoint-mutation loop below), never fake PENDING.
  if (ledgerChannel.ok && ledgerChannel.guardGoverned) {
    for (const p of LEDGER_BINDING_OPTIONAL_GUARD_PATHS) governedSet.add(p);
  }
  // Prospective unit-63/64: the two optional smoke paths join the governed-current set ONLY
  // when the live ledger supplies BOTH valid rows (the channel refuses every partial or
  // malformed supply). Without the rows the old contract holds untouched: changed smoke
  // bytes stay HARD nonrow refusals, never fake PENDING. Membership is ADDITIVE pin
  // governance only - a governed path that carries a current-only successor entry still
  // runs the typed successor leg in the mutation loop below (unit-64 repair).
  if (ledgerChannel.ok && ledgerChannel.smokeGoverned) {
    for (const p of LEDGER_BINDING_OPTIONAL_SMOKE_PATHS) governedSet.add(p);
  }
  const pinOf = (path) => {
    const live = ledgerChannel.liveLedger;
    if (!live) return null;
    const row = (live.addedPaths ?? []).find((r) => r.path === path) ?? (live.modifiedPaths ?? []).find((r) => r.path === path);
    return row?.sha256 ?? null;
  };
  const blobSha = (oid) => {
    const b = git(['cat-file', 'blob', oid]);
    return b.rc === 0 ? sha256buf(b.stdout) : null;
  };
  problems.push(...governedPathVerdicts({
    channel: ledgerChannel,
    governed: [...governedSet].map((path) => ({
      path,
      checkpointEntry: checkpointTree.map.get(path) ?? null,
      liveEntry: liveTree.map.get(path) ?? null,
      pin: pinOf(path),
      liveSha: liveTree.map.get(path) ? blobSha(liveTree.map.get(path).oid) : null,
    })),
  }));
  if (ledgerChannel.ok && !ledgerChannel.activated) {
    for (const path of governedSet) {
      const was = checkpointTree.map.get(path);
      const live = liveTree.map.get(path);
      if (!was || !live || was.oid === live.oid) continue; // unchanged, or already refused by the verdicts
      problems.push(`pending actual Root admission: current source ${path} differs from the admitted checkpoint (${was.mode} ${was.oid} -> ${live.mode} ${live.oid}) — the five pending entries discharge ONLY through actual Root final admission of the activated ledger, never a self-edited unactivated pin`);
    }
  }
  for (const [path, entry] of liveTree.map) {
    // The five governed paths are judged by the ledger channel above — never mislabeled as
    // an unknown upstream extra or an arbitrary mutation while their binding is pending.
    if (governedSet.has(path)) continue;
    if (rowPaths.has(path) || admitted.has(path) || admittedCarriers.has(path) || stagingTree.map.has(path) || topicTree.map.has(path)) continue;
    if (bNewPaths.has(path)) continue; // Root unit-70: the typed loop below re-judges the exact identity, never a blanket skip
    problems.push(`unknown upstream-origin current path without a reviewed row: ${path} (${entry.mode} ${entry.kind}) — extras refuse`);
  }
  // Root unit-70: the finite B-delta new-path admission is ANCESTRY-BOUND and content-bound.
  // The whole delta normalizes only in a live HEAD that actually merged the exact reviewed B
  // (the reviewed merge base a real ancestor of B, and B a real ancestor of the live HEAD), so
  // a foreign or replayed B' refuses, and a pre-merge HEAD honestly reports every missing
  // surface instead of silently normalizing. Each of the 28 exact paths is then judged under
  // full typed identity — a path, a wildcard, a class or an observed diff admits nothing.
  expectAnc(ADMITTED_CURRENT_B_BINDING.mergeBase, ADMITTED_CURRENT_B_BINDING.bHead, `finite B-delta binding: the reviewed merge base ${ADMITTED_CURRENT_B_BINDING.mergeBase} must be an actual ancestor of the reviewed upstream B ${ADMITTED_CURRENT_B_BINDING.bHead}`);
  expectAnc(ADMITTED_CURRENT_B_BINDING.bHead, liveHead, `finite B-delta binding: the reviewed upstream B ${ADMITTED_CURRENT_B_BINDING.bHead} must be an actual ancestor of the live HEAD ${liveHead} — the finite delta admits only a candidate that really merged B`);
  for (const expected of ADMITTED_CURRENT_B_NEW_UPSTREAM_PATHS) {
    if (checkpointTree.map.has(expected.path)) {
      problems.push(`admitted B-delta new upstream path already present in the frozen checkpoint tree: ${expected.path} — a current-upstream addition extends an ABSENT surface, never an existing one`);
      continue;
    }
    const bEntry = bTree.map.get(expected.path);
    if (!bEntry || bEntry.mode !== expected.mode || bEntry.kind !== expected.kind || bEntry.oid !== expected.gitBlob) {
      problems.push(`admitted B-delta new upstream path ${expected.path} does not carry the reviewed upstream B source leg ${expected.mode}/${expected.kind} ${expected.gitBlob} (the B tree says ${bEntry ? `${bEntry.mode}/${bEntry.kind} ${bEntry.oid}` : 'absent'}) — the live tuple must be the exact immutable B origin, never an arbitrary blob`);
      continue;
    }
    const entry = liveTree.map.get(expected.path);
    if (!entry) { problems.push(`admitted B-delta new upstream path missing from the live HEAD tree: ${expected.path} — a dead admission entry never normalizes`); continue; }
    if (entry.mode !== expected.mode || entry.kind !== expected.kind || entry.oid !== expected.gitBlob) {
      problems.push(`admitted B-delta new upstream path ${expected.path} carries ${entry.mode}/${entry.kind} ${entry.oid} in the live HEAD tree — only the exact reviewed ${expected.mode}/${expected.kind} ${expected.gitBlob} admits`);
      continue;
    }
    const blob = git(['cat-file', 'blob', entry.oid]);
    if (blob.rc !== 0) { problems.push(`admitted B-delta new upstream path ${expected.path} blob ${entry.oid} unreadable through the shared git runner (rc ${blob.rc})`); continue; }
    const served = Buffer.isBuffer(blob.stdout) ? blob.stdout : Buffer.from(String(blob.stdout ?? ''), 'utf8');
    if (sha256buf(served) !== expected.sha256 || served.length !== expected.bytes) problems.push(`admitted B-delta new upstream path ${expected.path} serves counterfeit bytes under ${entry.oid} (sha256 ${sha256buf(served).slice(0, 12)}, ${served.length}B; expected the frozen reviewed ${expected.sha256.slice(0, 12)}, ${expected.bytes}B)`);
  }

  // Root unit-36 item C: the COMPLETE finite current subject, not only the 571 rows plus a
  // pathname-membership union. The admitted checkpoint (cd3) tree is compared with the live
  // HEAD tree path by path under exact mode+content identity: keeping a pathname is not
  // keeping the content — an unknown byte/mode mutation of a checkpoint path refuses, and a
  // missing original path refuses. Survivors beyond the identical paths: the reviewed rows
  // and three admitted replacements (exact row checks above), the two admitted carriers, the
  // five ledger-governed paths (channel above) and the selfIndexed ledger itself (finite
  // normalization only — Root unit-37 §3).
  for (const [path, was] of checkpointTree.map) {
    if (rowPaths.has(path) || governedSet.has(path)) continue; // governed exactly by the checks above
    if (path === S3_LEDGER_REL) continue; // selfIndexed: judged by the channel normalization below
    if (!liveTree.map.has(path)) problems.push(`original current path missing from the live HEAD tree: ${path} (${was.mode} ${was.kind} ${was.oid} at the admitted checkpoint) — deletions refuse`);
  }
  for (const [path, live] of liveTree.map) {
    // Unit-64 repair of the unit-63 defect: a ledger-governed path that ALSO carries a
    // current-only successor entry is NOT exempt from the typed successor leg below - the
    // optional-row pin is ADDITIVE, never a substitute, so the frozen checkpoint identity,
    // the permitted live OIDs, the served-bytes identity and the mode/kind of every typed
    // successor stay load-bearing while the optional rows are active. Governed paths WITHOUT
    // a successor entry (the guard pair, the helper of the smoke pair) keep discharging
    // through the bounded pin exactly as before.
    if (rowPaths.has(path) || admittedCarriers.has(path) || (governedSet.has(path) && !currentOnly.has(path))) continue;
    const was = checkpointTree.map.get(path);
    if (path === S3_LEDGER_REL) {
      // The ledger is the ONLY documented selfIndexed path: its changed bytes are admitted
      // ONLY through the exact channel normalization (original mode/kind preserved, valid
      // v1 shape, normalized-equal to the fixed-checkpoint baseline). Anything else refuses.
      if (was && (was.oid !== live.oid) && !ledgerChannel.ok) problems.push(`scope-extension ledger changed outside the finite existing-ledger binding channel (${live.mode} ${live.oid}) — selfIndexed normalization is the only admission, never a blanket exception`);
      else if (was && (was.mode !== live.mode || was.kind !== live.kind)) problems.push(`scope-extension ledger mode/kind changed (${was.mode}/${was.kind} -> ${live.mode}/${live.kind}) — the selfIndexed exception preserves the original mode/kind`);
      continue;
    }
    const nonRowSuccessor = currentOnly.get(path) ?? null;
    if (nonRowSuccessor) {
      // Root unit-52/53: the current-only successor relation extended to its admitted
      // NON-ROW checkpoint surface (a governed checkpoint path outside the 571 carrier
      // rows). Same typed semantics as the row loop above: the checkpoint leg keeps the
      // frozen Root-reviewed original identity and never updates; the live leg may carry
      // the original OR the one exact Root-admitted successor; whichever OID a leg
      // presents, the blob it actually serves must hash to that leg's frozen identity —
      // counterfeit bytes under either OID, an unknown replacement, a mode/kind swap, a
      // deletion or an unreadable object refuses.
      if (!was) { problems.push(`current-only successor path ${path} missing from the checkpoint tree — a successor extends an existing reviewed checkpoint path, never introduces one`); continue; }
      if (was.mode !== nonRowSuccessor.checkpoint.mode || was.kind !== nonRowSuccessor.checkpoint.kind || was.oid !== nonRowSuccessor.checkpoint.gitBlob) {
        problems.push(`current-only successor path ${path} carries ${was.mode}/${was.kind} ${was.oid} in the checkpoint tree — the frozen Root-reviewed checkpoint identity ${nonRowSuccessor.checkpoint.mode}/${nonRowSuccessor.checkpoint.kind} ${nonRowSuccessor.checkpoint.gitBlob} never updates`);
        continue;
      }
      // Root unit-72 R3 (6032): the PERMITTED IDENTITY LEG is selected FIRST by OID — the
      // unchanged original OR the exact admitted successor — and only then is that leg's full
      // mode/kind/OID/SHA/length/served-bytes identity bound. Binding the successor's live
      // mode before the OID choice falsely rejected an unchanged original leg whenever the
      // admitted successor changes mode (linter-slot 100644 -> 100755); a crossed
      // mode/OID combination now refuses on the selected leg, never on the unchosen one.
      const selectedLeg = live.oid === nonRowSuccessor.live.gitBlob
        ? nonRowSuccessor.live
        : (live.oid === nonRowSuccessor.checkpoint.gitBlob ? nonRowSuccessor.checkpoint : null);
      if (!selectedLeg) {
        problems.push(`current-only successor path ${path} carries ${live.oid} in the live HEAD tree — the live leg may carry only the frozen original ${nonRowSuccessor.checkpoint.gitBlob} or the exact Root-admitted successor ${nonRowSuccessor.live.gitBlob}`);
        continue;
      }
      if (live.mode !== selectedLeg.mode || live.kind !== selectedLeg.kind) {
        problems.push(`current-only successor path ${path} live mode/kind mismatch (checkpoint ${nonRowSuccessor.checkpoint.mode}/${nonRowSuccessor.checkpoint.kind} -> live ${live.mode}/${live.kind}; the selected ${selectedLeg === nonRowSuccessor.live ? 'successor' : 'original'} identity leg requires ${selectedLeg.mode}/${selectedLeg.kind}) — a symlink, permission swap or crossed mode/OID combination refuses`);
        continue;
      }
      const legIdentity = (oid, label) => {
        const identity = oid === nonRowSuccessor.live.gitBlob ? nonRowSuccessor.live : nonRowSuccessor.checkpoint;
        const blob = git(['cat-file', 'blob', oid]);
        if (blob.rc !== 0) return `current-only successor path ${path} blob ${oid} unreadable through the shared git runner (rc ${blob.rc}) in the ${label} tree`;
        const served = Buffer.isBuffer(blob.stdout) ? blob.stdout : Buffer.from(String(blob.stdout ?? ''), 'utf8');
        if (sha256buf(served) !== identity.sha256 || served.length !== identity.bytes) return `current-only successor path ${path} serves counterfeit bytes under ${oid} in the ${label} tree (sha256 ${sha256buf(served).slice(0, 12)}, ${served.length}B; expected the frozen Root-reviewed ${identity.sha256.slice(0, 12)}, ${identity.bytes}B)`;
        return null;
      };
      const legProblems = [legIdentity(was.oid, 'checkpoint'), legIdentity(live.oid, 'live HEAD')].filter(Boolean);
      if (legProblems.length) problems.push(...legProblems);
      continue;
    }
    if (!was) {
      if (stagingTree.map.has(path) || topicTree.map.has(path)) problems.push(`restored or added current path inside the reviewed union without a checkpoint record, admitted carrier or governed binding: ${path} (${live.mode} ${live.kind} ${live.oid}) — refuses`);
      continue; // outside the union: already refused by the extras loop above
    }
    if (was.oid === live.oid && was.mode === live.mode) continue;
    problems.push(`changed current source path without an admitted replacement or governed binding: ${path} carries ${live.mode} ${live.oid}, the admitted checkpoint carries ${was.mode} ${was.oid} — arbitrary byte/mode changes refuse`);
  }
  // Root unit-53: every admitted current-only successor entry must be load-bearing — each
  // one binds either a reviewed carrier row (consumed by the row loop) or an actual
  // checkpoint-tree path (consumed by the mutation loop above). An entry binding neither
  // surface would be dead admission data: it normalizes nothing and hides its own inertness,
  // so it refuses instead of silently passing.
  for (const successor of ADMITTED_CURRENT_ONLY_SUCCESSORS) {
    if (!rowPaths.has(successor.path) && !checkpointTree.map.has(successor.path)) {
      problems.push(`current-only successor entry ${successor.path} binds neither a reviewed row nor a checkpoint tree path — a dead admission entry never normalizes`);
    }
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
            if (anc.rc === 0) { /* the plain predicate holds — nothing more needed */ }
            else if (anc.rc === 1) {
              // Root unit-35 item 5: the S2 base is a HISTORICAL portable object provably NOT
              // an ancestor of any current integration HEAD — the plain predicate is
              // impossible in integration mode and MUST NOT be laundered by dropping it. The
              // explicit accepted conditional current-transfer fixture satisfies it through
              // the reviewed composite ONLY: generation->cf64 historical proof + the complete
              // finite LIVE current transfer + actual bc8/checkpoint ancestry of the live
              // HEAD. Defaults (no fixture) keep the original refusal verbatim; a broken
              // composite leg keeps it too.
              const refused = 's2 predecessor base head is not an ancestor of the live HEAD — stale/unrelated accepted evidence';
              const cond = facts?.S4_CONDITIONAL_CURRENT_TRANSFER;
              const isPortableBase = PORTABLE_REFERENCE_TUPLES.some((t) => t.commit === rec.baseHead);
              if (!cond || cond.admission !== 'ACCEPTED_STRUCTURAL' || !isPortableBase || cond.s2BaseHead !== rec.baseHead) {
                p.push(refused);
              } else if (JSON.stringify(cond.checkpoint) !== JSON.stringify(CURRENT_TRANSFER_CHECKPOINT) || JSON.stringify(cond.replacements) !== JSON.stringify(ADMITTED_CURRENT_REPLACEMENTS)) {
                p.push(`${refused} (the conditional current-transfer fixture pins do not equal the reviewed constants — a self-issued map never substitutes)`);
              } else {
                const transportRoot = opts.portableTransportRoot ?? repoRoot;
                const store = portableReferenceStore(transportRoot);
                if (!store.ok) p.push(`${refused} (generation->cf64 historical proof unavailable: ${store.problems.join(' | ')})`);
                else {
                  const carrier = loadReviewedIntegration(repoRoot);
                  const transferProblems = carrier.ok ? reconcileCurrentTransfer({ repoRoot, git, carrier }) : ['reviewed integration carrier invalid or absent'];
                  // Root unit-36 item C: pending-class problems (typed PENDING paths awaiting
                  // actual Root boundary-2 admission) refuse honestly as unadmitted source
                  // proposals — never silently passed, never mislabeled as a broken transfer.
                  const hardProblems = transferProblems.filter((m) => !m.startsWith('pending actual Root admission'));
                  if (hardProblems.length) p.push(`${refused} (the reviewed current transfer does not reconcile: ${hardProblems.slice(0, 3).join(' | ')})`);
                  else if (transferProblems.length) p.push(`s2 predecessor conditional current transfer structurally reconciles but ${transferProblems.length} current-source postimage proposal(s) remain unadmitted (explicit admission-pending refusal, never a silent pass): ${transferProblems.slice(0, 3).join(' | ')}`);
                  else {
                    const a1 = git(['merge-base', '--is-ancestor', CURRENT_TRANSFER_CHECKPOINT.parent, 'HEAD']);
                    const a2 = git(['merge-base', '--is-ancestor', CURRENT_TRANSFER_CHECKPOINT.head, 'HEAD']);
                    if (a1.rc !== 0 || a2.rc !== 0) p.push(`${refused} (bc8/checkpoint ancestry of the live HEAD does not hold under the conditional fixture)`);
                  }
                }
              }
            } else p.push('s2 predecessor ancestry native status is an I/O or repository error, not a proof — fail-closed');
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

function lsTree(git, rev) {
  const res = git(['ls-tree', '-r', '--name-only', '-z', rev]);
  if (res.rc !== 0) return null;
  return res.stdout.toString().split('\0').filter(Boolean);
}

export function buildStageSteps(stage, ctx) {
  const { repoRoot, runFn, gitEnv, expectedInputs } = ctx;
  const gitCli = (args) => runFn('git', args, { cwd: repoRoot, env: gitEnv ? gitEnv() : undefined });
  // Root unit-37 §2: ONE shared owner for every historical stage read — the ambient gitCli
  // stays the live runner, and the multiplexer retries a native 128 (object not resolvable
  // here) through the owned isolated store with live revision operands resolved to actual
  // caller OIDs. A fresh single-branch checkout therefore serves 932/cd3/bc8 reads from the
  // owned store while keeping its actual current HEAD/cwd identity.
  const git = storeFallbackGit(repoRoot, gitCli);
  if (stage === 'S3') {
    return [
      ['s3-scope-extension', () => {
        const loaded = loadScopeExtension(repoRoot);
        if (loaded.absent) return red('S3 scope-extension ledger missing — the additive post-S2 inventory contract is not registered');
        if (!loaded.ok) return red(`invalid scope-extension ledger: ${loaded.problems.join(' | ')}`);
        const tree = git(['rev-parse', `${ANCHORED_HEAD}^{tree}`]);
        if (tree.rc !== 0 || tree.stdout.toString().trim() !== ANCHORED_TREE) return infra('anchored base commit/tree does not resolve — git cannot confirm the 932ef452/tree4ca080 predecessor');
        const basePaths = lsTree(git, ANCHORED_HEAD);
        const livePaths = lsTree(git, 'HEAD');
        if (!basePaths || !livePaths) return infra('git ls-tree failed for anchored base or live HEAD');
        const integration = loadReviewedIntegration(repoRoot);
        const channel = currentLedgerChannel({ repoRoot, git });
        // Root unit-74: the EXISTING typed current transfer is the only admission route for the
        // finite B-delta new upstream paths — its problems red the step outright (mirroring the
        // verify.mjs s2-inventory consumer) and only a CLEAN validation feeds the inventory.
        const transferProblems = integration.ok ? reconcileCurrentTransfer({ repoRoot, git, carrier: integration }) : null;
        if (transferProblems && transferProblems.length) return red(`reviewed current-transfer checkpoint reconciliation failed: ${transferProblems.slice(0, 5).join(' | ')}${transferProblems.length > 5 ? ` (+${transferProblems.length - 5} more)` : ''}`);
        const problems = reconcileInventory({ repoRoot, basePaths, rulingPath: S2_RULING_PATH, livePaths, ledger: loaded.ledger, integration, pendingBindings: { channel, paths: new Set([...LEDGER_BINDING_ADDED_PATHS, ...LEDGER_BINDING_MODIFIED_PATHS, ...LEDGER_BINDING_NEW_MODIFIED_PATHS]) }, currentTransferProblems: transferProblems ?? undefined });
        if (!channel.ok) problems.push(...channel.problems.map((x) => `existing-ledger binding channel invalid: ${x}`));
        if (problems.length) return red(`additive inventory reconciliation refused: ${problems.slice(0, 6).join(' | ')}${problems.length > 6 ? ` (+${problems.length - 6} more)` : ''}`);
        return pass(`live scope = historical committed scope + exactly ${admittedPaths(loaded.ledger).length} declared post-S2 paths (s3 added/pending + typed s4 index)${integration.ok ? ` + the finite admitted current surface (${rowPathCount(integration)} reviewed upstream-origin rows + 2 data carriers + ${ADMITTED_CURRENT_B_NEW_UPSTREAM_PATHS.length} typed B-delta new upstream paths through the clean current transfer, integration mode)` : ''}, every landed one sha-pinned (selfIndexed ledger excepted by contract); structural registration is not behavioral certification`);
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
            const v = validatePerformanceRecord(perf, repoRoot, { git, expectedInputs });
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
              const problems = validateHistoricalClosure(item, repoRoot, { git, expectedInputs });
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
              problems.push(...evaluateReceipt(e.path, receipt, 'ci-record', { repoRoot, ledger: loaded.ledger, git, sourceSignature: sig, expectedInputs }));
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
        const prereq = validatePredecessors(loaded.ledger, repoRoot, git, { expectedInputs });
        if (!prereq.ok) return red(`ordered accepted S2→S3 predecessors not established — S4 stays nonPASS: ${prereq.problems.slice(0, 3).join(' | ')}`);
        const tree = git(['rev-parse', `${ANCHORED_HEAD}^{tree}`]);
        if (tree.rc !== 0 || tree.stdout.toString().trim() !== ANCHORED_TREE) return infra('anchored predecessor tree does not resolve');
        const head = git(['rev-parse', 'HEAD']);
        if (head.rc !== 0) return infra('git cannot resolve live HEAD');
        const ctx = {
          repoRoot, ledger: loaded.ledger, git,
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
