// S3 native companion — meaningful bad/good controls for owner findings S3L-F1..F5 AND the
// root-review defects ROOT-S3-R1/R2/R5 + ROOT-S4-R3/R4/R6/R7 (review b879, 2026-10-31).
// Run by the production consumer: node --test --test-reporter=tap scripts/test-assurance/s3.test.mjs
// (the s3-native-companion step parses THIS file's real TAP output and binds the frozen identity
// population — F5/ROOT-S3-R5). TEST-ONLY: fabricated fixtures live in os.tmpdir(); no actual S4
// evidence is authored here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  evaluateMetricTrial, evaluatePureCases, validateLedgerShape, pathProblems, symlinkEscape,
  reconcileInventory, validatePerformanceRecord, sourceSignature, parseCompanionTap,
  validateCompanionResult, evaluateReceipt, codeScopeEquivalent, buildStageSteps,
  validateHistoricalClosure, validatePredecessors,
  loadReviewedIntegration, validateReviewedIntegration, reconcileUpstreamLineage,
  reconcileCurrentTransfer, loadPortableReference, hydratePortableReferenceStore, makeIsolatedGit,
  portableReferenceStore, sharedHistoricalReader, storeFallbackGit,
  evaluateLedgerChannel, governedPathVerdicts, currentLedgerChannel,
  LEDGER_BINDING_ADDED_PATHS, LEDGER_BINDING_MODIFIED_PATHS, LEDGER_BINDING_NEW_MODIFIED_PATHS,
  LEDGER_BINDING_OPTIONAL_GUARD_PATHS,
  LEDGER_BINDING_OPTIONAL_SMOKE_PATHS,
  CURRENT_TRANSFER_CHECKPOINT, ADMITTED_CURRENT_REPLACEMENTS, PENDING_CURRENT_SOURCE_PROPOSALS,
  PORTABLE_REFERENCE_TUPLES, PORTABLE_REFERENCE_REL, PORTABLE_REFERENCE_BYTES,
  S2_REVIEWED_INTEGRATION_REL, S2_REVIEWED_INTEGRATION_SHA256,
  UPSTREAM_STAGING_HEAD, UPSTREAM_STAGING_TREE, ACCEPTED_TOPIC_HEAD, ACCEPTED_TOPIC_TREE,
  ORIGINAL_S2_BASE_HEAD, ORIGINAL_S2_BASE_TREE, PRESERVED_INTEGRATION_INDEX_TREE,
  S3_LEDGER_REL, S3_PERF_REL, ANCHORED_HEAD, ANCHORED_TREE, S4_REQUIRED_KINDS, FROZEN_ROLE, WORKLOAD_ARGV,
  ORIGINAL_FIXTURE_SHA256,
} from './s3.mjs';

const hex64 = (c) => c.repeat(64);
const hex40 = (c) => c.repeat(40);
const sha = (s) => createHash('sha256').update(s).digest('hex');
// Real Git runner over THIS repository — R1/R3/R4 positive controls bind role graphs and
// patch identities to real commit/tree objects, not mocks.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const realGit = (args) => {
  const r = spawnSync('git', ['-C', REPO_ROOT, ...args], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  return { rc: r.status ?? 1, stdout: r.stdout ?? Buffer.from(''), stderr: r.stderr ?? Buffer.from('') };
};
// Unit-37 §2/§4: HISTORICAL reads in the real-graph tests route through the SAME shared
// owner the production consumer uses (storeFallbackGit over the ambient runner) — a fresh
// single-branch checkout serves 932/cd3/cf64 objects from the owned isolated store while
// every live HEAD read stays live. Live-only sites keep the plain realGit runner.
const realGitHistorical = storeFallbackGit(REPO_ROOT, realGit);

// ---------- bounded temporal trust repair: frozen independent expected fixtures ----------
// The independent expected map and the owner-frozen decision table are fixed OUTSIDE every
// attacker evidence fixture — these module constants are declared BEFORE any payload is
// built and stay FIXED while attacker payloads vary (outer frozen-decision contract). Two
// TEST-ONLY directions: (a) frozenPositive* builders — conditional deterministic matches per
// domain whose pins are recomputed from the owned fixture bytes (never from an attacker
// payload); (b) frozenOwnerShapeExpected — the owner-map-shaped negative descriptor (every
// admission exactly as the owner fixed it: OBSERVED_UNQUALIFIED_RED / NOT_RETRIEVED /
// not-rebased / UNMET / MISSING / REVISE). Neither mints Root acceptance.
const FROZEN_REVIEWER = 'independent-root-reviewer';
const FROZEN_REVIEWER_SESSION = 'reviewer-session-0002';
const filePin = (root, rel) => ({ relative: rel, sha256: sha(readFileSyncCompat(join(root, rel))) });
const frozenPerfPins = (root, journalRel) => ({
  performance: filePin(root, 'docs/test-assurance-kernel/s3/performance.json'),
  rawIndex: filePin(root, 'docs/test-assurance-kernel/s3/raw-index.json'),
  retainedJournal: filePin(root, journalRel),
  rawStreams: Array.from({ length: 24 }, (_, i) => {
    const w = ['docs', 'rule', 'kernel', 'fallback'][Math.floor(i / 6)];
    const role = i % 6 < 3 ? 'frozen' : 'optimized';
    const t = (i % 3) + 1;
    return [
      filePin(root, `docs/test-assurance-kernel/s3/logs/${w}-${role}-t${t}.log`),
      filePin(root, `docs/test-assurance-kernel/s3/logs/${w}-${role}-t${t}.stderr.log`),
    ];
  }).flat(),
});
const frozenPositiveExpected = (facts) => ({ facts: {
  S3_PERFORMANCE: { admission: 'QUALIFIED_NATIVE_GREEN' },
  HISTORICAL_S0_12: { admission: 'RETRIEVED_NATIVE' },
  HISTORICAL_CF37: { admission: 'OBSERVED_RED_RETAINED' },
  HISTORICAL_RULE538: { admission: 'MET_NATIVE', originalMedianMs: 538, targetMs: 430.4 },
  FINAL_CI: { admission: 'ACQUIRED_NATIVE' },
  S3_ACCEPTED_PREDECESSOR: { admission: 'ACCEPTED_NATIVE' },
  INDEPENDENT_SPEC_REVIEW: { admission: 'ACCEPTED_NATIVE', actualReviewRecord: { reviewer: FROZEN_REVIEWER, reviewerSession: FROZEN_REVIEWER_SESSION, verdict: 'ACCEPT' } },
  INDEPENDENT_QUALITY_REVIEW: { admission: 'ACCEPTED_NATIVE', actualReviewRecord: { reviewer: FROZEN_REVIEWER, reviewerSession: FROZEN_REVIEWER_SESSION, verdict: 'ACCEPT' } },
  TARGET_INSTALL: { admission: 'INSTALLED_NATIVE' },
  ...facts,
} });
const frozenOwnerShapeExpected = (facts) => ({ facts: {
  S3_PERFORMANCE: { admission: 'OBSERVED_UNQUALIFIED_RED', qualifiedOriginalFourFixtureCampaign: false },
  HISTORICAL_S0_12: { admission: 'NOT_RETRIEVED', genuineOriginalRetrievedRawPins: [] },
  HISTORICAL_CF37: { admission: 'OBSERVED_RED_NOT_REBASED', authorizedRebaselineOrWaiver: false },
  HISTORICAL_RULE538: { admission: 'UNMET', originalMedianMs: 538, targetMs: 430.4, currentObservedOptimizedMedianMs: 1079 },
  FINAL_CI: { admission: 'NOT_STARTED', actualRequiredCheckAcquisition: null },
  S2_CANONICAL_ACCEPTED: { admission: 'ACCEPTED_FOR_ITS_EXACT_COVERED_SUBJECT_ONLY', head: ANCHORED_HEAD, tree: ANCHORED_TREE, producerPostimages: {} },
  S3_ACCEPTED_PREDECESSOR: { admission: 'MISSING' },
  INDEPENDENT_SPEC_REVIEW: { admission: 'REVISE_NOT_ACCEPTED' },
  INDEPENDENT_QUALITY_REVIEW: { admission: 'MISSING' },
  TARGET_INSTALL: { admission: 'MISSING', actualTargetAcquisition: null },
  ...facts,
} });

// ---------- F4: metric consumer ----------
test('F4 one-pair dominant record is INVALID, not PASS', () => {
  const v = evaluateMetricTrial({ base: [1000], current: [100], kind: 'dominant' });
  assert.equal(v.verdict, 'INVALID', 'a one-pair record must never be green');
});
test('F4 unknown kind is INVALID, never treated as other', () => {
  assert.equal(evaluateMetricTrial({ base: [1000, 1000, 1000], current: [1000, 1000, 1000], kind: 'bogus' }).verdict, 'INVALID');
  assert.equal(evaluateMetricTrial({ base: [1000, 1000, 1000], current: [1000, 1000, 1000], kind: undefined }).verdict, 'INVALID');
});
test('F4 exact boundary predicates (owner frozen table)', () => {
  const policy = {
    pureMetricCases: [
      { id: 'ordinary-exact20', kind: 'dominant', base: [1000, 1000, 1000], current: [800, 800, 800], expected: 'PASS' },
      { id: 'ordinary-insufficient', kind: 'dominant', base: [1000, 1000, 1000], current: [801, 801, 801], expected: 'RED' },
      { id: 'other-exact1s', kind: 'other', base: [1000, 1000, 1000], current: [2000, 2000, 2000], expected: 'PASS' },
      { id: 'other-over1s', kind: 'other', base: [1000, 1000, 1000], current: [2001, 2001, 2001], expected: 'RED' },
      { id: 'other-exact5pct', kind: 'other', base: [30000, 30000, 30000], current: [31500, 31500, 31500], expected: 'PASS' },
      { id: 'other-over5pct', kind: 'other', base: [30000, 30000, 30000], current: [31501, 31501, 31501], expected: 'RED' },
      { id: 'missing-trial', kind: 'other', base: [1000, 1000], current: [1000, 1000, 1000], expected: 'INVALID' },
      { id: 'nonpositive-duration', kind: 'other', base: [1000, 1000, 0], current: [1000, 1000, 1000], expected: 'INVALID' },
    ],
  };
  const rows = evaluatePureCases(policy);
  for (const r of rows) assert.equal(r.got, r.expected, `${r.id}: got ${r.got} want ${r.expected}`);
});

// ---------- F3: ledger shape ----------
const okLedger = (over = {}) => ({
  schema: 'tak.s3.scope-extension/v1',
  evidenceComplete: false,
  anchoredBase: { head: ANCHORED_HEAD, tree: ANCHORED_TREE },
  addedPaths: [
    { path: S3_LEDGER_REL, class: 's3-evidence', selfIndexed: true },
    { path: 'scripts/test-assurance/s3.mjs', class: 's3-source', sha256: hex64('b') },
    { path: 'scripts/test-assurance/s3.test.mjs', class: 's3-source', sha256: hex64('c') },
    { path: 'docs/test-assurance-kernel/s3/README.md', class: 's3-evidence', sha256: hex64('d') },
  ],
  declaredPendingEvidence: [{ path: 'docs/test-assurance-kernel/s3/performance.json', class: 's3-evidence', sha256: hex64('e') }],
  modifiedPaths: [{ path: 'scripts/test-assurance/verify.mjs', sha256: hex64('f') }],
  s4EvidenceIndex: { namespace: 'docs/test-assurance-kernel/s4/', declaredPaths: [], allowedKinds: [...S4_REQUIRED_KINDS] },
  ...over,
});
test('F3 shape: a well-formed ledger validates clean', () => {
  assert.deepEqual(validateLedgerShape(okLedger()), []);
});
test('F3 unit-63 optional smoke rows: absent-or-exactly-BOTH, fixed appended order, never in baseline', () => {
  const withRows = (rows) => { const L = okLedger(); L.modifiedPaths = [...L.modifiedPaths, ...rows]; return L; };
  // Unit-64 repair (R63-M1): healthy pins must be GENUINELY valid 64-hex (hex64('c')/'d' are;
  // the old hex64('s')/'t') values are not hex at all, so the healthy arm necessarily refused
  // at the per-row HEX64 check and never reached its own positive assertions). The non-hex
  // value is retained as the malformed negative below - the validator stays strict.
  // Unit-66 repair: the malformed arm refuses at the SHAPE validator's per-row HEX64 gate
  // ('invalid modifiedPaths entry', s3.mjs:249) because validateLedgerShape runs FIRST inside
  // evaluateLedgerChannel (s3.mjs:589) - the channel-level smoke message is unreachable for a
  // non-hex pin, exactly like the unit-46 guard-pair negative (which asserts this same
  // shape-level message on its own malformed row).
  const smoke = [
    { path: '.github/workflows/audit-self.yml', sha256: hex64('c') },
    { path: 'tests/consumer-matrix/own-config-cell.sh', sha256: hex64('d') },
  ];
  const both = evaluateLedgerChannel({ liveLedger: withRows(smoke), baselineLedger: okLedger() });
  assert.equal(both.ok, true, both.problems.join('|'));
  assert.equal(both.smokeGoverned, true);
  const malformed = evaluateLedgerChannel({ liveLedger: withRows([{ path: '.github/workflows/audit-self.yml', sha256: hex64('s') }, smoke[1]]), baselineLedger: okLedger() });
  assert.ok(!malformed.ok && malformed.problems.some((x) => x.includes('invalid modifiedPaths entry') && x.includes('.github/workflows/audit-self.yml')), malformed.problems.join('|'));
  const partial = evaluateLedgerChannel({ liveLedger: withRows(smoke.slice(0, 1)), baselineLedger: okLedger() });
  assert.ok(!partial.ok && partial.problems.some((x) => x.includes('absent-or-exactly-BOTH')), partial.problems.join('|'));
  const sw = evaluateLedgerChannel({ liveLedger: withRows([smoke[1], smoke[0]]), baselineLedger: okLedger() });
  assert.ok(!sw.ok && sw.problems.some((x) => x.includes('fixed order')), sw.problems.join('|'));
  const mid = okLedger(); mid.modifiedPaths = [...smoke, ...mid.modifiedPaths];
  const md = evaluateLedgerChannel({ liveLedger: mid, baselineLedger: okLedger() });
  assert.ok(!md.ok && md.problems.some((x) => x.includes('appended after every non-smoke')), md.problems.join('|'));
  const base = okLedger(); base.modifiedPaths = [...base.modifiedPaths, smoke[0]];
  const bs = evaluateLedgerChannel({ liveLedger: withRows(smoke), baselineLedger: base });
  assert.ok(!bs.ok && bs.problems.some((x) => x.includes('baseline must not carry the optional smoke')), bs.problems.join('|'));
});
test('F3 unhashed arbitrary runtime path with selfIndexed=true is refused', () => {
  const bad = okLedger();
  bad.addedPaths.push({ path: 'runtime/injected.mjs', class: 's3-source', selfIndexed: true });
  const p = validateLedgerShape(bad);
  assert.ok(p.some((x) => x.includes('selfIndexed is reserved') || x.includes('exact module/test names')), p.join('|'));
});
test('F3 null/missing hash on any non-ledger path is refused', () => {
  const bad = okLedger();
  bad.addedPaths.push({ path: 'docs/test-assurance-kernel/s3/x.json', class: 's3-evidence', sha256: null });
  assert.ok(validateLedgerShape(bad).some((x) => x.includes('required HEX64 sha pin missing')));
  const bad2 = okLedger();
  bad2.addedPaths[1].sha256 = undefined;
  assert.ok(validateLedgerShape(bad2).some((x) => x.includes('required HEX64 sha pin missing')));
});
test('F3 s3-source outside the exact two names is refused', () => {
  const bad = okLedger();
  bad.addedPaths.push({ path: 'scripts/test-assurance/other.mjs', class: 's3-source', sha256: hex64('g') });
  assert.ok(validateLedgerShape(bad).some((x) => x.includes('exact module/test names')));
});
test('F3 evidence outside docs/test-assurance-kernel/s3/ and wrong types refused', () => {
  const bad = okLedger();
  bad.addedPaths.push({ path: 'docs/other/x.json', class: 's3-evidence', sha256: hex64('h') });
  assert.ok(validateLedgerShape(bad).some((x) => x.includes('must live under')));
  const bad2 = okLedger();
  bad2.addedPaths.push({ path: 'docs/test-assurance-kernel/s3/tool.sh', class: 's3-evidence', sha256: hex64('i') });
  assert.ok(validateLedgerShape(bad2).some((x) => x.includes('type not admitted')));
});
test('F3 canonicalized alias duplicate and hygiene faults are refused', () => {
  const bad = okLedger();
  bad.addedPaths.push({ path: 'docs/test-assurance-kernel/s3/./README.md', class: 's3-evidence', sha256: hex64('d') });
  assert.ok(validateLedgerShape(bad).some((x) => x.includes('segment')));
  const dup = okLedger();
  dup.addedPaths.push({ path: 'scripts/test-assurance/s3.mjs', class: 's3-source', sha256: hex64('b') });
  assert.ok(validateLedgerShape(dup).some((x) => x.includes('duplicate/canonicalized-alias')));
  assert.ok(pathProblems('docs//x.json').some((x) => x.includes('double-separator')));
  assert.ok(pathProblems('docs/*.json').some((x) => x.includes('wildcard')));
  assert.ok(pathProblems('docs/\0x').some((x) => x.includes('NUL')));
});
test('F3 pending may declare bounded future EVIDENCE only, never executable source', () => {
  const bad = okLedger();
  bad.declaredPendingEvidence.push({ path: 'scripts/test-assurance/later.mjs', class: 's3-source', sha256: hex64('j') });
  assert.ok(validateLedgerShape(bad).some((x) => x.includes('bounded future evidence only')));
});
test('F3 symlink-parent escape is detected physically', () => {
  const tmp = mkdtempSync(join(tmpdir(), 's3-f3-'));
  try {
    mkdirSync(join(tmp, 'docs'));
    mkdirSync(join(tmp, 'real'));
    writeFileSync(join(tmp, 'real', 'x.json'), '{}');
    symlinkSync(join(tmp, 'real'), join(tmp, 'docs', 'viaLink'));
    assert.ok(symlinkEscape(tmp, 'docs/viaLink/x.json'), 'a symlinked PARENT directory must be an escape');
    assert.ok(!symlinkEscape(tmp, 'docs/missing/x.json'));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
test('F3 reconcile refuses unregistered live paths and sha drift', () => {
  const tmp = mkdtempSync(join(tmpdir(), 's3-f3r-'));
  try {
    mkdirSync(join(tmp, 'scripts', 'test-assurance'), { recursive: true });
    mkdirSync(join(tmp, 'docs', 'test-assurance-kernel', 's3'), { recursive: true });
    const ledger = okLedger();
    for (const row of [...ledger.addedPaths.filter((r) => !r.selfIndexed), ...ledger.declaredPendingEvidence]) {
      const f = join(tmp, row.path);
      mkdirSync(join(f, '..'), { recursive: true });
      writeFileSync(f, row.path);
    }
    writeFileSync(join(tmp, 'scripts/test-assurance/verify.mjs'), 'verify');
    const good = reconcileInventory({ repoRoot: tmp, basePaths: ['a'], rulingPath: 'r', livePaths: [...ledger.addedPaths.map((r) => r.path), 'a', 'r', 'scripts/test-assurance/verify.mjs'], ledger });
    // shas in the fixture do not match the pins — drift must be reported
    assert.ok(good.some((x) => x.includes('mismatch') || x.includes('drifted')), good.join('|'));
    const rogue = reconcileInventory({ repoRoot: tmp, basePaths: ['a'], rulingPath: 'r', livePaths: ['a', 'r', 'rogue.txt'], ledger });
    assert.ok(rogue.some((x) => x.includes('unregistered live path refused')));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// ---------- ROOT-S4-R7: typed s4 index admission (additive-inventory subpredicate) ----------
const s4Entry = { path: 'docs/test-assurance-kernel/s4/ci-record.json', kind: 'ci-record' };
const r7Ledger = () => {
  const ledger = okLedger();
  ledger.evidenceComplete = true;
  ledger.declaredPendingEvidence = [];
  ledger.s4EvidenceIndex = { namespace: 'docs/test-assurance-kernel/s4/', declaredPaths: [{ ...s4Entry }], allowedKinds: [...S4_REQUIRED_KINDS] };
  return ledger;
};
const r7Fixture = (tmp, ledger) => {
  for (const row of ledger.addedPaths.filter((r) => !r.selfIndexed)) {
    const f = join(tmp, row.path);
    mkdirSync(join(f, '..'), { recursive: true });
    const body = `content ${row.path}\n`;
    writeFileSync(f, body);
    row.sha256 = sha(body);
  }
  const v = 'verify-body';
  writeFileSync(join(tmp, 'scripts/test-assurance/verify.mjs'), v);
  ledger.modifiedPaths[0].sha256 = sha(v);
  const s4Body = '{"kind":"ci-record"}';
  mkdirSync(join(tmp, 'docs/test-assurance-kernel/s4'), { recursive: true });
  writeFileSync(join(tmp, s4Entry.path), s4Body);
  ledger.s4EvidenceIndex.declaredPaths[0].sha256 = sha(s4Body);
  // the selfIndexed ledger file itself must be on disk for a fully clean reconciliation
  mkdirSync(join(tmp, 'docs/test-assurance-kernel/s3'), { recursive: true });
  writeFileSync(join(tmp, S3_LEDGER_REL), JSON.stringify(ledger));
};
test('ROOT-S4-R7: an exactly enumerated typed s4 file is admitted into the additive inventory (clean positive)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 's3-r7a-'));
  try {
    const ledger = r7Ledger();
    r7Fixture(tmp, ledger);
    const livePaths = [...ledger.addedPaths.map((r) => r.path), 'a', 'r', 'scripts/test-assurance/verify.mjs', s4Entry.path];
    const p = reconcileInventory({ repoRoot: tmp, basePaths: ['a', 'scripts/test-assurance/verify.mjs'], rulingPath: 'r', livePaths, ledger });
    assert.deepEqual(p, []);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
test('ROOT-S4-R7: unknown s4 live file, deleted declaration, rename and untyped index entries refuse', () => {
  const tmp = mkdtempSync(join(tmpdir(), 's3-r7b-'));
  try {
    const ledger = r7Ledger();
    r7Fixture(tmp, ledger);
    const base = { repoRoot: tmp, basePaths: ['a', 'scripts/test-assurance/verify.mjs'], rulingPath: 'r', ledger };
    const withS4 = [...ledger.addedPaths.map((r) => r.path), 'a', 'r', 'scripts/test-assurance/verify.mjs', s4Entry.path];
    const unknown = reconcileInventory({ ...base, livePaths: [...withS4, 'docs/test-assurance-kernel/s4/unknown.json'] });
    assert.ok(unknown.some((x) => x.includes('unregistered live path refused: docs/test-assurance-kernel/s4/unknown.json')), unknown.join('|'));
    const deleted = reconcileInventory({ ...base, livePaths: withS4.filter((p) => p !== s4Entry.path) });
    assert.ok(deleted.some((x) => x.includes(`registered path missing from live scope: ${s4Entry.path}`)), deleted.join('|'));
    const renamed = reconcileInventory({ ...base, livePaths: [...withS4.filter((p) => p !== s4Entry.path), 'docs/test-assurance-kernel/s4/renamed.json'] });
    assert.ok(renamed.some((x) => x.includes('unregistered live path refused')));
    assert.ok(renamed.some((x) => x.includes('registered path missing from live scope')), renamed.join('|'));
    const untyped = r7Ledger();
    untyped.s4EvidenceIndex.declaredPaths = ['docs/test-assurance-kernel/s4/ci-record.json'];
    assert.ok(validateLedgerShape(untyped).some((x) => x.includes('must be an exact .json path object')), validateLedgerShape(untyped).join('|'));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
test('ROOT-S4-R7: a symlinked s4 file escape is refused physically', () => {
  const tmp = mkdtempSync(join(tmpdir(), 's3-r7c-'));
  try {
    mkdirSync(join(tmp, 'outside'));
    writeFileSync(join(tmp, 'outside', 'payload.json'), '{"kind":"ci-record"}');
    const ledger = r7Ledger();
    r7Fixture(tmp, ledger);
    rmSync(join(tmp, s4Entry.path));
    symlinkSync(join(tmp, 'outside', 'payload.json'), join(tmp, s4Entry.path));
    const p = reconcileInventory({ repoRoot: tmp, basePaths: ['a'], rulingPath: 'r', ledger, livePaths: [...ledger.addedPaths.map((r) => r.path), 'a', 'r', 'scripts/test-assurance/verify.mjs', s4Entry.path] });
    assert.ok(p.some((x) => x.includes('symlink-parent escape refused') || x.includes('not a regular file')), p.join('|'));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// ---------- F2 / ROOT-S3-R1: performance record consumer ----------
const NATIVE_STDOUT = {
  docs: () => 'render-reference check ok — reference index current\n',
  rule: () => 'Test Files  1 passed (1)\n     Tests  7 passed (7)\n',
  kernel: () => 'ℹ tests 52\nℹ suites 5\nℹ pass 52\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\n',
  'fallback|frozen': () => 'Test Files  57 passed (57)\n     Tests  668 passed | 1 skipped (669)\n',
  'fallback|optimized': () => 'Test Files  60 passed (60)\n     Tests  757 passed | 1 skipped (758)\n',
};
// Builds a FULLY bound record: raw logs that parse to the contract population + 1:1 raw index
// + the R1 retained collector-journal/fixture/tool bindings. TEST-ONLY synthetic timings in
// os.tmpdir(); when { optimizedTree } is supplied the optimized role binds to a REAL tree of
// the same repository the caller's git runner resolves.
const buildBoundPerf = (tmp, optimizedHead, opts = {}) => {
  mkdirSync(join(tmp, 'docs/test-assurance-kernel/s3/logs'), { recursive: true });
  // R1 native tool identity: the validator compares tools.node to ITS OWN process.version and
  // tools.vitest to the vitest installed under repoRoot — provide a genuine local install row.
  mkdirSync(join(tmp, 'node_modules/vitest'), { recursive: true });
  const vitestVersion = '0.0.0-testonly';
  writeFileSync(join(tmp, 'node_modules/vitest/package.json'), JSON.stringify({ name: 'vitest', version: vitestVersion }));
  const cells = [];
  const rawCells = [];
  const frozenM = { docs: 1000, rule: 1000, kernel: 30000, fallback: 1000 };
  let seq = 0;
  for (const w of ['docs', 'rule', 'kernel', 'fallback']) for (const role of ['frozen', 'optimized']) for (let t = 1; t <= 3; t++) {
    seq += 1;
    const stdoutRel = `docs/test-assurance-kernel/s3/logs/${w}-${role}-t${t}.log`;
    const stderrRel = `docs/test-assurance-kernel/s3/logs/${w}-${role}-t${t}.stderr.log`;
    const outBody = (w === 'fallback' ? NATIVE_STDOUT[`fallback|${role}`] : NATIVE_STDOUT[w])();
    const errBody = `${w} ${role} t${t} stderr empty\n`;
    writeFileSync(join(tmp, stdoutRel), outBody);
    writeFileSync(join(tmp, stderrRel), errBody);
    const wall = role === 'optimized' ? (w === 'rule' ? frozenM[w] * 0.7 : frozenM[w]) : frozenM[w];
    cells.push({ workload: w, role, trial: t, wallMs: wall, exitCode: 0, stdoutPath: stdoutRel, stdoutSha256: sha(outBody), stderrPath: stderrRel, stderrSha256: sha(errBody) });
    rawCells.push({ workload: w, role, trial: t, seq, wallMs: wall, exitCode: 0, argv: [...WORKLOAD_ARGV[w]], stdoutPath: stdoutRel, stderrPath: stderrRel });
  }
  // R1: the retained collector journal — the single admitted timing/command record the raw
  // index repeats (24 cells, workload argv literals, 3 clean reversed fixture blocks, no early
  // stop). Admitted timings are copies of THIS artifact, never a second invented source.
  const journalRel = 'docs/test-assurance-kernel/s3/logs/collector-journal.json';
  const journal = {
    schema: 'tak.s3.collector-journal/v1', stoppedEarly: false,
    cells: cells.map((c) => ({ workload: c.workload, role: c.role, trial: c.trial, wallMs: c.wallMs, exitCode: c.exitCode, argv: [...WORKLOAD_ARGV[c.workload]] })),
    fixtureBlocks: [1, 2, 3].map((i) => ({ block: i, reversedUtc: `2026-10-31T12:0${i}:00Z`, frozenClean: true, optimizedCleanOutsideEvidence: true })),
  };
  const journalBytes = JSON.stringify(journal);
  writeFileSync(join(tmp, journalRel), journalBytes);
  const perf = {
    status: 'COMPLETE-24CELLS',
    roles: { frozen: { head: FROZEN_ROLE.head, tree: FROZEN_ROLE.tree }, optimized: { head: optimizedHead, tree: opts.optimizedTree ?? hex40('d') } },
    cells,
  };
  const rawIndex = {
    frozen: { head: FROZEN_ROLE.head, tree: FROZEN_ROLE.tree },
    optimized: { head: optimizedHead, tree: opts.optimizedTree ?? hex40('d') },
    host: 'darwin',
    tools: { node: process.version, vitest: vitestVersion },
    campaign: { journalPath: journalRel, journalSha256: sha(journalBytes), fixtures: { ...ORIGINAL_FIXTURE_SHA256 } },
    cells: rawCells,
  };
  writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/raw-index.json'), JSON.stringify(rawIndex));
  return { perf, rawIndex, journalRel, journal };
};
test('F2 a status-label-only record is refused (no cells, no raws, no medians)', () => {
  const v = validatePerformanceRecord({ status: 'COMPLETE-24CELLS' }, null);
  assert.ok(!v.ok && v.problems.some((x) => x.includes('cells must number exactly 24')));
});
test('F2 23-cell or nonzero-exit records are refused', () => {
  const base = { roles: { frozen: { head: FROZEN_ROLE.head, tree: FROZEN_ROLE.tree }, optimized: { head: hex40('3'), tree: hex64('4') } } };
  const cells = [];
  for (const w of ['docs', 'rule', 'kernel', 'fallback']) for (const role of ['frozen', 'optimized']) for (let t = 1; t <= 3; t++) {
    if (w === 'fallback' && role === 'optimized' && t === 3) continue; // drop one -> 23
    cells.push({ workload: w, role, trial: t, wallMs: 100, exitCode: 0, stdoutPath: 'docs/test-assurance-kernel/s3/logs/x.log', stdoutSha256: hex64('5'), stderrSha256: hex64('6') });
  }
  const v = validatePerformanceRecord({ ...base, status: 'COMPLETE-24CELLS', cells }, null);
  assert.ok(!v.ok && v.problems.some((x) => x.includes('exactly 24') || x.includes('exactly 3 normal trials')));
  const cells2 = cells.map((c) => ({ ...c }));
  cells2.push({ ...cells2[0] }); // restore the dropped cell -> full 24
  cells2[0].exitCode = 1;
  const v2 = validatePerformanceRecord({ ...base, status: 'COMPLETE-24CELLS', cells: cells2 }, null);
  assert.ok(!v2.ok && v2.problems.some((x) => x.includes('nonzero native cell')));
});
test('F2 a genuine well-formed 24-cell record reaches a computed policy verdict (accept path exists)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 's3-f2-'));
  try {
    // real frozen literals + real files, but the raw stdout does NOT parse to the contract
    // population — the binding layer must refuse what pure shape checks once accepted.
    mkdirSync(join(tmp, 'docs/test-assurance-kernel/s3/logs'), { recursive: true });
    const cells = [];
    for (const w of ['docs', 'rule', 'kernel', 'fallback']) for (const role of ['frozen', 'optimized']) for (let t = 1; t <= 3; t++) {
      const log = `docs/test-assurance-kernel/s3/logs/${w}-${role}-t${t}.log`;
      const body = `log ${w} ${role} t${t}\n`;
      writeFileSync(join(tmp, log), body);
      const wall = role === 'optimized' ? (w === 'rule' ? 700 : 1000) : 1000;
      cells.push({ workload: w, role, trial: t, wallMs: wall, exitCode: 0, stdoutPath: log, stdoutSha256: sha(body), stderrPath: log, stderrSha256: sha(body) });
    }
    const perf = {
      status: 'COMPLETE-24CELLS',
      roles: { frozen: { head: FROZEN_ROLE.head, tree: FROZEN_ROLE.tree }, optimized: { head: hex40('c'), tree: hex40('d') } },
      cells,
    };
    const v = validatePerformanceRecord(perf, tmp);
    assert.ok(!v.ok, 'unparsable native population must refuse');
    assert.ok(v.problems.some((x) => x.includes('no parsable native population') || x.includes('raw index missing')), v.problems.join(' | '));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
test('F2 accept path: matched raw pins + policy-passing numbers validate green end-to-end', () => {
  const tmp = mkdtempSync(join(tmpdir(), 's3-f2b-'));
  try {
    // REAL Git graphs of this repository: the frozen literal resolves with its exact tree and
    // the optimized role is the live HEAD with its actual tree — the R1 binding arms pass on
    // real commit/tree/ancestry objects, not on declared strings.
    const head = realGit(['rev-parse', 'HEAD']).stdout.toString().trim();
    const tree = realGit(['rev-parse', 'HEAD^{tree}']).stdout.toString().trim();
    assert.ok(/^[0-9a-f]{40}$/.test(head) && /^[0-9a-f]{40}$/.test(tree), 'live HEAD/tree must resolve in this repository');
    const { perf } = buildBoundPerf(tmp, head, { optimizedTree: tree });
    // R1 (Root56810c70): the qualification is an externally dependent fact — freeze the
    // independent positive expected pins over the OWNED fixture bytes BEFORE any attack, then
    // hold that caller context FIXED while the candidate payloads vary.
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/performance.json'), JSON.stringify(perf));
    const frozenExpected = frozenPositiveExpected({
      S3_PERFORMANCE: { admission: 'QUALIFIED_NATIVE_GREEN', ...frozenPerfPins(tmp, 'docs/test-assurance-kernel/s3/logs/collector-journal.json') },
    });
    const v = validatePerformanceRecord(perf, tmp, { git: realGit, expectedInputs: frozenExpected });
    assert.equal(v.ok, true, v.problems.join(' | '));
    assert.equal(v.verdicts.rule.verdict, 'PASS');
    assert.equal(v.verdicts.kernel.verdict, 'PASS');
    // ...without the independent descriptor the externally dependent certificate fails closed
    const noExp = validatePerformanceRecord(perf, tmp, { git: realGit });
    assert.ok(!noExp.ok && noExp.problems.some((x) => x.includes('no independently selected expected inputs')), noExp.problems.join(' | '));
    // ...the owner-map-shaped descriptor keeps the exact byte-identical retained 24 cells
    // OBSERVED_UNQUALIFIED_RED (decision R1: new matching copies differ or remain
    // observed-unqualified — byte identity never self-qualifies)
    const unqual = validatePerformanceRecord(perf, tmp, { git: realGit, expectedInputs: frozenOwnerShapeExpected({ S3_PERFORMANCE: { admission: 'OBSERVED_UNQUALIFIED_RED', qualifiedOriginalFourFixtureCampaign: false, ...frozenPerfPins(tmp, 'docs/test-assurance-kernel/s3/logs/collector-journal.json') } }) });
    assert.ok(!unqual.ok && unqual.problems.some((x) => x.includes('OBSERVED_UNQUALIFIED_RED') && x.includes('stays nonPASS even with byte-identical evidence')), unqual.problems.join(' | '));
    // ...and a THIRD editable copy (edited raw-index bytes) differs from the independently
    // admitted pin with the caller context held FIXED
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/raw-index.json'), JSON.stringify({ ...JSON.parse(readFileSyncCompat(join(tmp, 'docs/test-assurance-kernel/s3/raw-index.json'), 'utf8')), edited: true }));
    const drifted = validatePerformanceRecord(perf, tmp, { git: realGit, expectedInputs: frozenExpected });
    assert.ok(!drifted.ok && drifted.problems.some((x) => x.includes('raw index bytes differ from the independently admitted pin')), drifted.problems.join(' | '));
    // R1 (Root978 counterexample): the SAME record with an INVENTED optimized head aaaa/tree
    // bbbb refuses at the Git-object binding before any median is considered.
    const bad = validatePerformanceRecord({ ...perf, roles: { ...perf.roles, optimized: { head: hex40('a'), tree: hex40('b') } } }, tmp, { git: realGit });
    assert.ok(!bad.ok && bad.problems.some((x) => x.includes(`roles.optimized.head ${hex40('a')} does not exist as a commit`)), bad.problems.join(' | '));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
test('ROOT-S3-R1: the fabricated 24-cell construction (one fake stdout, invented pins) refuses at every binding', async () => {
  // Root REVIEW-PROBES construction: 24 invented wallMs + exit0, unrelated head/tree tokens,
  // ONE fabricated stdout file reused for all cells, nonexistent stderr with a random 64hex pin.
  const tmp = mkdtempSync(join(tmpdir(), 's3-r1-'));
  try {
    mkdirSync(join(tmp, 'docs/test-assurance-kernel/s3/logs'), { recursive: true });
    const rawBody = 'unrelated output\n';
    const oneFakeLog = 'docs/test-assurance-kernel/s3/logs/fake.log';
    writeFileSync(join(tmp, oneFakeLog), rawBody);
    const cells = [];
    for (const w of ['docs', 'rule', 'kernel', 'fallback']) for (const role of ['frozen', 'optimized']) for (let t = 1; t <= 3; t++) {
      cells.push({
        workload: w, role, trial: t,
        wallMs: role === 'optimized' ? 800 : 1000, exitCode: 0,
        stdoutPath: oneFakeLog, stdoutSha256: sha(rawBody),
        stderrSha256: hex64('0').replace(/.$/, '7'), // pinned but the file does not exist
      });
    }
    const v = validatePerformanceRecord({
      status: 'COMPLETE-24CELLS',
      roles: { frozen: { head: hex40('2'), tree: hex40('3') }, optimized: { head: hex40('4'), tree: hex40('5') } },
      cells,
    }, tmp);
    assert.ok(!v.ok, 'the fabricated record must refuse');
    const joined = v.problems.join(' | ');
    assert.ok(joined.includes('roles.frozen must be the exact frozen measurement view'), joined);
    assert.ok(joined.includes('raw index missing'), joined);
    assert.ok(joined.includes('stderr raw log unreadable') || joined.includes('stderr'), joined);
    assert.ok(joined.includes('no parsable native population') || joined.includes('workload contract'), joined);
    // R1 (Root978 exact counterexample): TWO editable copies repeating INVENTED tool labels,
    // no retained collector journal, optimized head aaaa/tree bbbb — every new binding refuses.
    const forged = buildBoundPerf(tmp, hex40('a'), { optimizedTree: hex40('b') });
    forged.rawIndex.tools = { node: 'v0.0.0-fake', vitest: '9.9.9-fake' };
    forged.rawIndex.campaign = {}; // two editable copies, no retained journal binding
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/raw-index.json'), JSON.stringify(forged.rawIndex));
    const vf = validatePerformanceRecord(forged.perf, tmp, { git: realGit });
    const jf = vf.problems.join(' | ');
    assert.ok(jf.includes('raw index node binding') && jf.includes(process.version), jf);
    assert.ok(jf.includes('vitest binding'), jf);
    assert.ok(jf.includes('lacks the retained collector-journal binding'), jf);
    assert.ok(jf.includes(`roles.optimized.head ${hex40('a')} does not exist as a commit`), jf);
    // a DATED/partial fixture set (the 6673 substitute on fallback) is a qualified comparison
    // and never stands in for the original four-fixture campaign
    const dated = buildBoundPerf(tmp, realGit(['rev-parse', 'HEAD']).stdout.toString().trim(), { optimizedTree: realGit(['rev-parse', 'HEAD^{tree}']).stdout.toString().trim() });
    dated.rawIndex.campaign.fixtures.fallback = '6'.repeat(64);
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/raw-index.json'), JSON.stringify(dated.rawIndex));
    const vd = validatePerformanceRecord(dated.perf, tmp, { git: realGit });
    assert.ok(vd.problems.some((x) => x.includes('original four-fixture campaign NOT established') && x.includes('fallback')), vd.problems.join(' | '));
    // R1 (Owner-E89 counterexample, Root56810c70): a CLEAN fully-bound record whose three
    // editable copies repeat the ORIGINAL fixture labels and exact retained bytes still
    // refuses under the owner-shaped expected map — those exact 24 cells are
    // OBSERVED_UNQUALIFIED_RED and stay unqualified; original fixture labels alone never
    // establish real acquisition.
    const h1 = realGit(['rev-parse', 'HEAD']).stdout.toString().trim();
    const clean = buildBoundPerf(tmp, h1, { optimizedTree: realGit(['rev-parse', 'HEAD^{tree}']).stdout.toString().trim() });
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/performance.json'), JSON.stringify(clean.perf));
    const vq = validatePerformanceRecord(clean.perf, tmp, { git: realGit, expectedInputs: frozenOwnerShapeExpected({ S3_PERFORMANCE: { admission: 'OBSERVED_UNQUALIFIED_RED', qualifiedOriginalFourFixtureCampaign: false, ...frozenPerfPins(tmp, 'docs/test-assurance-kernel/s3/logs/collector-journal.json') } }) });
    assert.ok(!vq.ok && vq.problems.some((x) => x.includes('OBSERVED_UNQUALIFIED_RED') && x.includes('stays nonPASS even with byte-identical evidence')), vq.problems.join(' | '));
    assert.ok(!vq.problems.some((x) => x.includes('bytes differ from the independently admitted pin')), vq.problems.join(' | '));
    // R1 meta-fault (packet-3): the two frozen controls must be LIVE in the actual consumer.
    // An OWNED retained copy of the exact module bytes (never the source tree) is faulted,
    // imported and observed: a consumer-disable fault (admission gate bypassed) makes the
    // frozen COUNTEREXAMPLE fail on the mutant — the byte-identical record would no longer be
    // refused; an always-RED adapter (gate forced) makes the frozen POSITIVE control fail.
    // The original bytes are then restored (restored sha == pre-fault sha) and the baseline
    // controls go green again through a fresh import.
    const moduleBytes = readFileSyncCompat(new URL('./s3.mjs', import.meta.url));
    const NEEDLE = 'admission !== EXPECTED_ADMISSIONS.performance';
    assert.ok(moduleBytes.includes(NEEDLE) && moduleBytes.indexOf(NEEDLE) === moduleBytes.lastIndexOf(NEEDLE), 'the admission gate needle must occur exactly once in the retained source');
    const ownedDir = join(tmp, 'owned-source');
    mkdirSync(ownedDir, { recursive: true });
    const ownedCopy = join(ownedDir, 's3.mjs');
    writeFileSync(ownedCopy, moduleBytes);
    const shaBefore = sha(readFileSyncCompat(ownedCopy));
    const ownerMap = frozenOwnerShapeExpected({ S3_PERFORMANCE: { admission: 'OBSERVED_UNQUALIFIED_RED', qualifiedOriginalFourFixtureCampaign: false, ...frozenPerfPins(tmp, 'docs/test-assurance-kernel/s3/logs/collector-journal.json') } });
    const posMap = frozenPositiveExpected({ S3_PERFORMANCE: { admission: 'QUALIFIED_NATIVE_GREEN', ...frozenPerfPins(tmp, 'docs/test-assurance-kernel/s3/logs/collector-journal.json') } });
    // fault 1: consumer disabled — the frozen counterexample ASSERTION FAILS on the mutant.
    writeFileSync(ownedCopy, String(moduleBytes).replace(NEEDLE, 'false'));
    const mutDisable = await import(`${pathToFileURL(ownedCopy).href}?fault=disable`);
    const md = mutDisable.validatePerformanceRecord(clean.perf, tmp, { git: realGit, expectedInputs: ownerMap });
    assert.ok(md.ok || !md.problems.some((x) => x.includes('stays nonPASS even with byte-identical evidence')), 'consumer-disable fault must break the frozen counterexample (the admission gate is dead)');
    // fault 2: always-RED adapter — the frozen positive control FAILS on the mutant.
    writeFileSync(ownedCopy, String(moduleBytes).replace(NEEDLE, 'true'));
    const mutOver = await import(`${pathToFileURL(ownedCopy).href}?fault=overreject`);
    const mo = mutOver.validatePerformanceRecord(clean.perf, tmp, { git: realGit, expectedInputs: posMap });
    assert.ok(!mo.ok && mo.problems.some((x) => x.includes('stays nonPASS even with byte-identical evidence')), 'always-RED adapter must break the frozen positive control');
    // restore: byte-exact original bytes, restored sha equals the pre-fault sha, and BOTH
    // baseline controls reproduce through a fresh import of the restored copy.
    writeFileSync(ownedCopy, moduleBytes);
    assert.equal(sha(readFileSyncCompat(ownedCopy)), shaBefore);
    const restored = await import(`${pathToFileURL(ownedCopy).href}?fault=restored`);
    const rrOwner = restored.validatePerformanceRecord(clean.perf, tmp, { git: realGit, expectedInputs: ownerMap });
    assert.ok(!rrOwner.ok && rrOwner.problems.some((x) => x.includes('stays nonPASS even with byte-identical evidence')), rrOwner.problems.join(' | '));
    const rrPos = restored.validatePerformanceRecord(clean.perf, tmp, { git: realGit, expectedInputs: posMap });
    assert.ok(rrPos.ok, rrPos.problems.join(' | '));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// ---------- F1 / ROOT-S4-R4: receipts ----------
const receiptCtx = (over = {}) => ({ repoRoot: null, headSHA: hex40('f'), sourceSignature: hex64('9'), ledger: okLedger(), ...over });
test('F1 six minimal fabricated objects never pass the receipt schema', () => {
  // Through the ACTUAL production receipt consumer (ROOT-S4-R4: no property-copy tests).
  const ctx = receiptCtx();
  for (const kind of S4_REQUIRED_KINDS) {
    const p = evaluateReceipt(`docs/test-assurance-kernel/s4/${kind}.json`, { kind, codeSHA: 'a'.repeat(64) }, kind, ctx);
    assert.ok(p.some((x) => x.includes('reviewer identity missing') || x.includes('author identity missing')), `${kind}: ${p.join('|')}`);
    assert.ok(p.some((x) => x.includes('codeSHA is not bound') || x.includes('session')), `${kind}: ${p.join('|')}`);
  }
});
test('ROOT-S4-R4: REVISE verdicts, failed CI, author-session reuse and arbitrary install files refuse', () => {
  const tmp = mkdtempSync(join(tmpdir(), 's3-r4-'));
  try {
    mkdirSync(join(tmp, 'docs/test-assurance-kernel/s3'), { recursive: true });
    mkdirSync(join(tmp, 'docs/test-assurance-kernel/s4'), { recursive: true });
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/provenance.json'), '{"note":"review input"}');
    const prov = { path: 'docs/test-assurance-kernel/s3/provenance.json', sha256: sha('{"note":"review input"}') };
    const base = {
      reviewer: 'independent-root-reviewer', author: 's3-implementer',
      identityProof: { sessionId: 'author-session-0001' }, reviewerProof: { sessionId: 'reviewer-session-0002' },
      verdict: 'ACCEPT', codeSHA: hex64('9'), headSHA: hex40('7'), provenance: prov,
    };
    // valid independent prerequisites: the receipt head matches the live HEAD context, and a
    // REAL manifest exists with a genuine unrelated row — so each negative below breaks exactly
    // the one proof it targets, and no unrelated missing-file noise can masquerade as detection.
    const ctx0 = receiptCtx({ headSHA: hex40('7') });
    const revise = evaluateReceipt('s4/spec-review.json', { ...base, kind: 'spec-review', verdict: 'REVISE', artifact: { reviewedPatchSha256: hex64('1'), verdict: 'ACCEPT' } }, 'spec-review', ctx0);
    assert.ok(revise.some((x) => x.includes('not a positive certification')), revise.join('|'));
    const selfSession = evaluateReceipt('s4/spec-review.json', { ...base, kind: 'spec-review', reviewerProof: { sessionId: 'author-session-0001' }, artifact: { reviewedPatchSha256: hex64('1'), verdict: 'ACCEPT' } }, 'spec-review', ctx0);
    assert.ok(selfSession.some((x) => x.includes('reuses the author session')), selfSession.join('|'));
    const failedCi = evaluateReceipt('s4/ci-record.json', { ...base, kind: 'ci-record', artifact: { checkRunIds: [1], conclusion: 'failure', checks: [{ name: 'build', conclusion: 'failure' }], head: hex40('7'), criticalPathFullInvocationIncreased: false } }, 'ci-record', ctx0);
    assert.ok(failedCi.some((x) => x.includes('CI conclusion') && x.includes('not success')), failedCi.join('|'));
    assert.ok(failedCi.some((x) => x.includes('check "build" conclusion is not success')), failedCi.join('|'));
    // arbitrary local file as "install": a REAL manifest with a genuine OTHER row exists, the
    // artifact exists on disk with a true sha — the broken proof is exactly the missing row.
    const otherBody = '{"real":"shipped artifact"}\n';
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/other-artifact.json'), otherBody);
    mkdirSync(join(tmp, 'packages/getff'), { recursive: true });
    writeFileSync(join(tmp, 'packages/getff/MANIFEST.sha256'), `${sha(otherBody)}  docs/test-assurance-kernel/s3/other-artifact.json\n`);
    const arbitrary = join(tmp, 'docs/test-assurance-kernel/s3/arbitrary.bin');
    writeFileSync(arbitrary, 'local-bytes');
    const install = evaluateReceipt('s4/install-record.json', { ...base, kind: 'install-record', artifact: { manifestRow: { path: 'docs/test-assurance-kernel/s3/arbitrary.bin', sha256: sha('local-bytes') } } }, 'install-record', receiptCtx({ repoRoot: tmp, headSHA: hex40('7') }));
    assert.ok(install.some((x) => x.includes('not present in packages/getff/MANIFEST.sha256')), install.join('|'));
    assert.ok(!install.some((x) => x.includes('unreadable')), install.join('|'));
    // and appending the genuine row for THIS artifact passes that arm
    writeFileSync(join(tmp, 'packages/getff/MANIFEST.sha256'), `${sha(otherBody)}  docs/test-assurance-kernel/s3/other-artifact.json\n${sha('local-bytes')}  docs/test-assurance-kernel/s3/arbitrary.bin\n`);
    const installOk = evaluateReceipt('s4/install-record.json', { ...base, kind: 'install-record', artifact: { manifestRow: { path: 'docs/test-assurance-kernel/s3/arbitrary.bin', sha256: sha('local-bytes') } } }, 'install-record', receiptCtx({ repoRoot: tmp, headSHA: hex40('7') }));
    assert.ok(!installOk.some((x) => x.includes('MANIFEST')), installOk.join('|'));
    // R4 (Root978): arbitrary local TEXT is not an independent review — the native root-review
    // schema and the recomputed patch identity are both required.
    const noSchema = evaluateReceipt('s4/spec-review.json', { ...base, kind: 'spec-review', artifact: { reviewedPatchSha256: hex64('1'), verdict: 'ACCEPT' } }, 'spec-review', receiptCtx({ headSHA: hex40('7') }));
    assert.ok(noSchema.some((x) => x.includes('does not carry the native root-review schema')), noSchema.join('|'));
    // a review whose reviewedPatchSha256 is not sha256(diff anchoredBase..head) reviews some
    // OTHER patch — proven against the REAL repository graph and the REAL diff bytes.
    const realHead = realGit(['rev-parse', 'HEAD']).stdout.toString().trim();
    const realDiff = realGitHistorical(['diff', `${ANCHORED_HEAD}..${realHead}`, '--']).stdout.toString();
    const realLedger = okLedger();
    // the independent descriptor is FIXED here (frozen positive map, reviewer identity =
    // FROZEN_REVIEWER/FROZEN_REVIEWER_SESSION/ACCEPT) so the targeted arms below are the ONLY
    // things that can fail — payloads vary, the caller's expected context never does.
    const realCtx = { repoRoot: tmp, ledger: realLedger, git: realGitHistorical, sourceSignature: hex64('9'), expectedInputs: frozenPositiveExpected({ INDEPENDENT_QUALITY_REVIEW: { admission: 'ACCEPTED_NATIVE', actualReviewRecord: { reviewer: FROZEN_REVIEWER, reviewerSession: FROZEN_REVIEWER_SESSION, verdict: 'ACCEPT', headSHA: realHead, reviewedPatchSha256: sha(realDiff), sourceSubject: realHead } } }) };
    const wrongPatch = evaluateReceipt('s4/quality-review.json', { ...base, kind: 'quality-review', schema: 'getff.root.affected-review/v1', headSHA: realHead, artifact: { reviewedPatchSha256: sha(realDiff + 'x'), verdict: 'ACCEPT' } }, 'quality-review', realCtx);
    assert.ok(wrongPatch.some((x) => x.includes('reviews some other patch')), wrongPatch.join('|'));
    const rightPatch = evaluateReceipt('s4/quality-review.json', { ...base, kind: 'quality-review', schema: 'getff.root.affected-review/v1', headSHA: realHead, artifact: { reviewedPatchSha256: sha(realDiff), verdict: 'ACCEPT' } }, 'quality-review', realCtx);
    assert.ok(!rightPatch.some((x) => x.includes('reviewedPatchSha256') || x.includes('some other patch') || x.includes('native root-review schema') || x.includes('expected inputs')), rightPatch.join('|'));
    // R4 under the owner-shaped map: the SAME structurally perfect review refuses — the
    // current Root record is REVISE_NOT_ACCEPTED and the quality review MISSING; schema
    // strings and the recomputed diff sha are structural fields, not review origin.
    const revOwnerP = evaluateReceipt('s4/quality-review.json', { ...base, kind: 'quality-review', schema: 'getff.root.affected-review/v1', headSHA: realHead, artifact: { reviewedPatchSha256: sha(realDiff), verdict: 'ACCEPT' } }, 'quality-review', { ...realCtx, expectedInputs: frozenOwnerShapeExpected() });
    assert.ok(revOwnerP.some((x) => x.includes('structural fields, not review origin')), revOwnerP.join('|'));
    // R4: an AUTHOR-SELECTED reviewer identity under the frozen positive map refuses — only
    // the independently selected actual review record establishes origin.
    const fakeReviewer = evaluateReceipt('s4/quality-review.json', { ...base, reviewer: 'author-picked-reviewer', kind: 'quality-review', schema: 'getff.root.affected-review/v1', headSHA: realHead, artifact: { reviewedPatchSha256: sha(realDiff), verdict: 'ACCEPT' } }, 'quality-review', realCtx);
    assert.ok(fakeReviewer.some((x) => x.includes('reviewer identity/session/verdict does not match the independently selected actual review record')), fakeReviewer.join('|'));
    // Root 973 R4-review-subject (the owner d547 reproduction): the FIXED accepted review
    // covers the OLD head/patch; the candidate keeps reviewer/session/verdict but replays
    // them onto the CURRENT diff/head — must refuse on the SUBJECT, not the identity. The
    // pinned runner holds HEAD at the old subject for the same-exact-subject positive.
    // Unit-37 §2/§4: the OLD subject is the PRIOR CANDIDATE head (a genuine ancestor of the
    // current HEAD), not the original d547-era topic head — that historical head is
    // unreachable from the current line and outside the reviewed portable reference, so a
    // fresh single-branch checkout (the §4 fixture) cannot resolve it through ANY runner.
    // The replay semantics are unchanged: an older accepted subject with a DIFFERENT
    // anchored diff, replayed onto the current head, must refuse on the SUBJECT.
    const OLD_HEAD = '666346c8846b4b640212ff9d7033da75393e91be';
    // The pinned runner composes with the shared owner (pin FIRST, then the store fallback)
    // — a fresh checkout serves the OLD subject's objects from the owned store while the
    // HEAD→OLD_HEAD pin semantics stay byte-identical.
    const pinnedOld = (args) => realGitHistorical(args.map((a) => a === 'HEAD' ? OLD_HEAD : a.startsWith('HEAD:') ? OLD_HEAD + a.slice(4) : a));
    const oldDiff = pinnedOld(['diff', `${ANCHORED_HEAD}..${OLD_HEAD}`, '--']).stdout.toString();
    const subjectCtx = { ...realCtx, expectedInputs: frozenPositiveExpected({ INDEPENDENT_SPEC_REVIEW: { admission: 'ACCEPTED_NATIVE', actualReviewRecord: { reviewer: FROZEN_REVIEWER, reviewerSession: FROZEN_REVIEWER_SESSION, verdict: 'ACCEPT', headSHA: OLD_HEAD, reviewedPatchSha256: sha(oldDiff), sourceSubject: OLD_HEAD } } }) };
    const replayed = evaluateReceipt('s4/spec-review.json', { ...base, kind: 'spec-review', schema: 'getff.root.affected-review/v1', headSHA: realHead, artifact: { reviewedPatchSha256: sha(realDiff), verdict: 'ACCEPT' } }, 'spec-review', subjectCtx);
    assert.ok(replayed.some((x) => x.includes('review subject does not match the independently selected actual review record')), replayed.join('|'));
    // the SAME-EXACT-SUBJECT positive: the receipt names the accepted subject's own head and
    // the patch the reviewer actually reviewed — a conditional match, no identity transfer.
    const sameSubject = evaluateReceipt('s4/spec-review.json', { ...base, kind: 'spec-review', schema: 'getff.root.affected-review/v1', headSHA: OLD_HEAD, artifact: { reviewedPatchSha256: sha(oldDiff), verdict: 'ACCEPT' } }, 'spec-review', { ...subjectCtx, git: pinnedOld });
    assert.deepEqual(sameSubject, [], sameSubject.join('|'));
    // R4 same-head / different-actually-reviewed-patch (the owner 981 counterexample,
    // e71ff951/44522896): a NATIVE Git fixture replaces the former OR-era equivalence frame
    // (a matching patch alone at an unrelated head) — reuse at a different head now requires
    // genuine evidence-only code equivalence, and at the same head the ACTUAL reviewed patch
    // must be the required scope, not merely one matching identity coordinate.
    const r4Repo = mkdtempSync(join(tmpdir(), 's3-r4-subject-'));
    const r4g = (args) => {
      const r = spawnSync('git', ['-C', r4Repo, ...args], { encoding: 'utf8' });
      return { rc: r.status ?? 1, stdout: Buffer.from(r.stdout ?? ''), stderr: r.stderr };
    };
    // packet-7 conformance correction: NO new rmSync/finally teardown — the diagnostic Git
    // fixture is RETAINED (no-rm rule); only the suite's pre-existing normal tmp teardown
    // (this test's own outer finally) ever cleans up.
    {
      r4g(['init', '-q']);
      mkdirSync(join(r4Repo, 'scripts/test-assurance'), { recursive: true });
      mkdirSync(join(r4Repo, 'docs/test-assurance-kernel/s3'), { recursive: true });
      writeFileSync(join(r4Repo, 'scripts/test-assurance/verify.mjs'), 'r4 verify v1\n');
      writeFileSync(join(r4Repo, 'scripts/test-assurance/s3.mjs'), 'module r4 v1\n');
      writeFileSync(join(r4Repo, 'scripts/test-assurance/s3.test.mjs'), 'test r4 v1\n');
      writeFileSync(join(r4Repo, 'docs/test-assurance-kernel/s3/provenance.json'), '{"note":"review input"}');
      const r4ci = (args) => r4g(['-c', 'user.email=tak@local', '-c', 'user.name=tak', ...args]);
      assert.equal(r4ci(['add', '-A']).rc, 0);
      assert.equal(r4ci(['commit', '-q', '-m', 'anchored base']).rc, 0, 'native anchored base commit failed');
      const R4BASE = String(r4g(['rev-parse', 'HEAD']).stdout).trim();
      writeFileSync(join(r4Repo, 'scripts/test-assurance/verify.mjs'), 'r4 verify v2\n');
      assert.equal(r4ci(['add', '-A']).rc, 0);
      assert.equal(r4ci(['commit', '-q', '-m', 'intermediate older base']).rc, 0);
      const R4OLD = String(r4g(['rev-parse', 'HEAD']).stdout).trim();
      writeFileSync(join(r4Repo, 'scripts/test-assurance/s3.mjs'), 'module r4 v2\n');
      assert.equal(r4ci(['add', '-A']).rc, 0);
      assert.equal(r4ci(['commit', '-q', '-m', 'reviewed source change']).rc, 0);
      const R4HEAD = String(r4g(['rev-parse', 'HEAD']).stdout).trim();
      const r4Full = r4g(['diff', `${R4BASE}..${R4HEAD}`, '--']).stdout.toString();
      const r4Partial = r4g(['diff', `${R4OLD}..${R4HEAD}`, '--']).stdout.toString();
      assert.notEqual(sha(r4Full), sha(r4Partial), 'native Git must prove the two real patch shas differ');
      const r4Ledger = okLedger({ anchoredBase: { head: R4BASE, tree: String(r4g(['rev-parse', `${R4BASE}^{tree}`]).stdout).trim() } });
      const r4ctx = (facts) => ({ repoRoot: r4Repo, ledger: r4Ledger, git: r4g, sourceSignature: hex64('9'), expectedInputs: frozenPositiveExpected({ INDEPENDENT_SPEC_REVIEW: facts }) });
      // the independent expected maps are FIXED before any payload below varies — the same
      // outer frozen-decision contract as every other arm in this suite.
      const r4Record = (revHead, revPatch) => ({ reviewer: FROZEN_REVIEWER, reviewerSession: FROZEN_REVIEWER_SESSION, verdict: 'ACCEPT', headSHA: revHead, reviewedPatchSha256: revPatch, sourceSubject: revHead });
      const r4FullCtx = r4ctx({ admission: 'ACCEPTED_NATIVE', actualReviewRecord: r4Record(R4HEAD, sha(r4Full)) });
      const r4WrongCtx = r4ctx({ admission: 'ACCEPTED_NATIVE', actualReviewRecord: r4Record(R4HEAD, sha(r4Partial)) });
      const r4base = { ...base, kind: 'spec-review', schema: 'getff.root.affected-review/v1' };
      // (1) same measured head, DIFFERENT actually reviewed patch (partial older base): the
      // OR condition accepted this because the head matched — it must refuse on the subject.
      const sameHeadWrongPatch = evaluateReceipt('s4/spec-review.json', { ...r4base, headSHA: R4HEAD, artifact: { reviewedPatchSha256: sha(r4Full), verdict: 'ACCEPT' } }, 'spec-review', r4WrongCtx);
      assert.ok(sameHeadWrongPatch.some((x) => x.includes('review subject does not match the independently selected actual review record') && x.includes('different actually reviewed patch')), sameHeadWrongPatch.join('|'));
      // (2) exact head + the exact actually reviewed full patch/scope: conditional positive.
      assert.deepEqual(evaluateReceipt('s4/spec-review.json', { ...r4base, headSHA: R4HEAD, artifact: { reviewedPatchSha256: sha(r4Full), verdict: 'ACCEPT' } }, 'spec-review', r4FullCtx), [], 'the exact same-head subject must be a conditional positive');
      // (3) older accepted review head + a REAL evidence-only descendant: reuse admitted
      // through codeScopeEquivalent (covered scoped sources identical), the receipt patch
      // bound to the descendant head by the recomputation arm.
      writeFileSync(join(r4Repo, 'docs/test-assurance-kernel/s3/README.md'), 'r4 evidence-only\n');
      assert.equal(r4ci(['add', '-A']).rc, 0);
      assert.equal(r4ci(['commit', '-q', '-m', 'evidence-only descendant']).rc, 0);
      const R4EVID = String(r4g(['rev-parse', 'HEAD']).stdout).trim();
      const r4EvidPatch = r4g(['diff', `${R4BASE}..${R4EVID}`, '--']).stdout.toString();
      const evidenceOnly = evaluateReceipt('s4/spec-review.json', { ...r4base, headSHA: R4EVID, artifact: { reviewedPatchSha256: sha(r4EvidPatch), verdict: 'ACCEPT' } }, 'spec-review', r4FullCtx);
      assert.deepEqual(evidenceOnly, [], `evidence-only descendant reuse must be a conditional positive: ${evidenceOnly.join('|')}`);
      // packet 7 / owner fb208403 frame 3 (evidence-descendant-different-actually-reviewed-
      // scope): the EXACT SAME independently selected PARTIAL reviewed-patch context at the
      // old accepted head, replayed by a GENUINE evidence-only descendant — the accepted
      // record's actually reviewed patch is a partial scope, so the hoisted required-scope
      // resolution refuses BEFORE the descendant branch: R6 equivalence transfers only
      // ALREADY_VALID full coverage and can never upgrade a partial accepted review.
      const r4PartialCtx = r4ctx({ admission: 'ACCEPTED_NATIVE', actualReviewRecord: r4Record(R4HEAD, sha(r4Partial)) });
      const partialDescendant = evaluateReceipt('s4/spec-review.json', { ...r4base, headSHA: R4EVID, artifact: { reviewedPatchSha256: sha(r4EvidPatch), verdict: 'ACCEPT' } }, 'spec-review', r4PartialCtx);
      assert.ok(partialDescendant.some((x) => x.includes('review subject does not match the independently selected actual review record') && x.includes('partial/different actually reviewed patch/scope')), partialDescendant.join('|'));
      // and the same partial record at its OWN head with the partial patch on the receipt
      // also refuses — both branches are closed by the hoisted resolution.
      const partialSameHead = evaluateReceipt('s4/spec-review.json', { ...r4base, headSHA: R4HEAD, artifact: { reviewedPatchSha256: sha(r4Partial), verdict: 'ACCEPT' } }, 'spec-review', r4PartialCtx);
      assert.ok(partialSameHead.some((x) => x.includes('review subject does not match the independently selected actual review record') && x.includes('partial/different actually reviewed patch/scope')), partialSameHead.join('|'));
      // (4a) changed scoped source after the accepted head refuses — naked ancestry and the
      // bare head/patch OR are both gone.
      writeFileSync(join(r4Repo, 'scripts/test-assurance/s3.mjs'), 'module r4 v3 CHANGED\n');
      assert.equal(r4ci(['add', '-A']).rc, 0);
      assert.equal(r4ci(['commit', '-q', '-m', 'changed scoped source']).rc, 0);
      const R4CHANGED = String(r4g(['rev-parse', 'HEAD']).stdout).trim();
      const r4ChangedPatch = r4g(['diff', `${R4BASE}..${R4CHANGED}`, '--']).stdout.toString();
      const changedSource = evaluateReceipt('s4/spec-review.json', { ...r4base, headSHA: R4CHANGED, artifact: { reviewedPatchSha256: sha(r4ChangedPatch), verdict: 'ACCEPT' } }, 'spec-review', r4FullCtx);
      assert.ok(changedSource.some((x) => x.includes('review subject does not match') && x.includes('scripts/test-assurance/s3.mjs')), changedSource.join('|'));
      // (4b) the OR-era shape — a DIFFERENT head replaying the accepted patch — refuses even
      // though the patch itself matches exactly.
      const samePatchOtherHead = evaluateReceipt('s4/spec-review.json', { ...r4base, headSHA: R4CHANGED, artifact: { reviewedPatchSha256: sha(r4Full), verdict: 'ACCEPT' } }, 'spec-review', r4FullCtx);
      assert.ok(samePatchOtherHead.some((x) => x.includes('review subject does not match the independently selected actual review record')), samePatchOtherHead.join('|'));
      // (4c) an unknown (nonexistent) measured head refuses at the envelope.
      const unknownHead = evaluateReceipt('s4/spec-review.json', { ...r4base, headSHA: hex40('b'), artifact: { reviewedPatchSha256: sha(r4Full), verdict: 'ACCEPT' } }, 'spec-review', r4FullCtx);
      assert.ok(unknownHead.some((x) => x.includes('measured code head not preserved')), unknownHead.join('|'));
    }
    // R4: ci-record binds to a retained gh.check-runs/v1 capture — invented ids, wrong-head
    // captures, unknown checks and foreign heads all refuse.
    const capBody = (over = {}) => JSON.stringify({ schema: 'gh.check-runs/v1', head_sha: realHead, check_runs: [{ id: 201, name: 'companion', conclusion: 'success' }, { id: 202, name: 'principles', conclusion: 'success' }], ...over });
    const capRel = 'docs/test-assurance-kernel/s4/ci-capture-test.json';
    writeFileSync(join(tmp, capRel), capBody());
    const ciBase = { ...base, kind: 'ci-record', headSHA: realHead, artifact: { checkRunIds: [201, 202], conclusion: 'success', checks: [{ name: 'companion', conclusion: 'success' }, { name: 'principles', conclusion: 'success' }], head: realHead, repository: 'EXPLICITLY-TESTONLY-OWNER-FIXED-REPOSITORY', criticalPathFullInvocationIncreased: false, capturedChecks: { path: capRel, sha256: sha(capBody()) } } };
    // the CI arm admits the exact captured acquisition pin from the FIXED descriptor — the
    // payload-side capture may never select or extend it — plus the COMPLETE independently
    // required population (ids/names/head/repository) the Root 973 repair binds.
    // packet 7 / Root ad255e87: the expensive full-invocation count proof pins the SAME
    // original counted population/unit with durable readable evidence bytes — baseline at
    // the independently admitted anchored-base head, final at the admitted acquisition head,
    // finalCount<=baselineCount. Written into the OWNED tmp fixture before payloads vary.
    const fiBaseBody = JSON.stringify({ metric: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', subject: ANCHORED_HEAD, count: 12, runs: [{ id: 9001, workflow: 'ci.yml', jobs: ['build', 'test'] }] });
    const fiFinalBody = JSON.stringify({ metric: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', subject: realHead, count: 9, runs: [{ id: 9002, workflow: 'ci.yml', jobs: ['build', 'test'] }] });
    const fiBaseRel = 'docs/test-assurance-kernel/s4/fullinv-baseline.json';
    const fiFinalRel = 'docs/test-assurance-kernel/s4/fullinv-final.json';
    writeFileSync(join(tmp, fiBaseRel), fiBaseBody);
    writeFileSync(join(tmp, fiFinalRel), fiFinalBody);
    const realCiProof = { population: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', baseline: { subject: ANCHORED_HEAD, count: 12, population: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', evidence: [{ path: fiBaseRel, sha256: sha(fiBaseBody) }] }, final: { subject: realHead, count: 9, population: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', evidence: [{ path: fiFinalRel, sha256: sha(fiFinalBody) }] } };
    const realCiFacts = (over = {}) => ({ admission: 'ACQUIRED_NATIVE', actualRequiredCheckAcquisition: { path: capRel, sha256: sha(capBody()) }, requiredCheckRunIds: [201, 202], requiredCheckNames: ['companion', 'principles'], headSHA: realHead, repository: 'EXPLICITLY-TESTONLY-OWNER-FIXED-REPOSITORY', fullInvocationProof: realCiProof, ...over });
    const realCiCtx = { ...realCtx, expectedInputs: frozenPositiveExpected({ FINAL_CI: realCiFacts() }) };
    const ciOk = evaluateReceipt('s4/ci-record.json', ciBase, 'ci-record', realCiCtx);
    assert.ok(!ciOk.some((x) => x.includes('captured') || x.includes('check-run') || x.includes('unknown') || x.includes('expected inputs')), ciOk.join('|'));
    // R4 under the owner-shaped map: final CI is NOT_STARTED — the local capture artifact is
    // a structural copy, not actual required-check acquisition.
    const ciOwnerP = evaluateReceipt('s4/ci-record.json', ciBase, 'ci-record', { ...realCtx, expectedInputs: frozenOwnerShapeExpected() });
    assert.ok(ciOwnerP.some((x) => x.includes('record final CI as NOT_STARTED')), ciOwnerP.join('|'));
    const inventedId = evaluateReceipt('s4/ci-record.json', { ...ciBase, artifact: { ...ciBase.artifact, checkRunIds: [201, 999] } }, 'ci-record', realCiCtx);
    assert.ok(inventedId.some((x) => x.includes('999 is absent from the captured run population')), inventedId.join('|'));
    const unknownCheck = evaluateReceipt('s4/ci-record.json', { ...ciBase, artifact: { ...ciBase.artifact, checks: [{ name: 'phantom-check', conclusion: 'success' }] } }, 'ci-record', realCiCtx);
    assert.ok(unknownCheck.some((x) => x.includes('unknown to the captured run population')), unknownCheck.join('|'));
    const wrongHeadCap = capBody({ head_sha: hex40('f') });
    writeFileSync(join(tmp, capRel), wrongHeadCap);
    const wrongHead = evaluateReceipt('s4/ci-record.json', { ...ciBase, artifact: { ...ciBase.artifact, capturedChecks: { path: capRel, sha256: sha(wrongHeadCap) } } }, 'ci-record', realCiCtx);
    assert.ok(wrongHead.some((x) => x.includes('not the anchor head') || x.includes('wrongCIhead')), wrongHead.join('|'));
    const foreign = evaluateReceipt('s4/ci-record.json', { ...ciBase, headSHA: hex40('f'), artifact: { ...ciBase.artifact, head: hex40('f'), capturedChecks: { path: capRel, sha256: sha(wrongHeadCap) } } }, 'ci-record', realCiCtx);
    assert.ok(foreign.some((x) => x.includes(`${hex40('f')} does not exist as a commit`)), foreign.join('|'));
    // the complete positive under the population-bound descriptor matches exactly
    writeFileSync(join(tmp, capRel), capBody());
    const ciComplete = evaluateReceipt('s4/ci-record.json', { ...ciBase, artifact: { ...ciBase.artifact, repository: 'EXPLICITLY-TESTONLY-OWNER-FIXED-REPOSITORY' } }, 'ci-record', realCiCtx);
    assert.deepEqual(ciComplete, [], ciComplete.join('|'));
    // packet 7 / owner fb208403 frame 2 (frozen ctx 064fa300, missing-required-population):
    // the mandatory population inputs are NOT optional — an acquisition context without the
    // required check-run id/name population REFUSES instead of silently skipping guards.
    const noPop = evaluateReceipt('s4/ci-record.json', ciBase, 'ci-record', { ...realCtx, expectedInputs: frozenPositiveExpected({ FINAL_CI: { admission: 'ACQUIRED_NATIVE', actualRequiredCheckAcquisition: { path: capRel, sha256: sha(capBody()) }, headSHA: realHead, repository: 'EXPLICITLY-TESTONLY-OWNER-FIXED-REPOSITORY', fullInvocationProof: realCiProof } }) });
    assert.ok(noPop.some((x) => x.includes('well-formed nonempty unique required check-run id population')), noPop.join('|'));
    // malformed/duplicate required ids refuse; an id/name mapping size mismatch refuses.
    const dupIds = evaluateReceipt('s4/ci-record.json', ciBase, 'ci-record', { ...realCtx, expectedInputs: frozenPositiveExpected({ FINAL_CI: realCiFacts({ requiredCheckRunIds: [201, 201, 202], requiredCheckNames: ['companion', 'companion', 'principles'] }) }) });
    assert.ok(dupIds.some((x) => x.includes('well-formed nonempty unique required check-run id population') || x.includes('well-formed nonempty unique required check-name population')), dupIds.join('|'));
    const mapMismatch = evaluateReceipt('s4/ci-record.json', ciBase, 'ci-record', { ...realCtx, expectedInputs: frozenPositiveExpected({ FINAL_CI: realCiFacts({ requiredCheckNames: ['companion'] }) }) });
    assert.ok(mapMismatch.some((x) => x.includes('id/name mapping')), mapMismatch.join('|'));
    // packet 7 / owner fb208403 frame 1 (frozen ctx ffe60548, stale-source-acquisition): the
    // receipt head is the CURRENT code (envelope equivalence green) while the PINNED
    // acquisition (expected head = captured head = OLD_HEAD, ancestry intact) names older
    // code whose scoped sources differ — expected==captured agreement and naked ancestry
    // prove nothing; the acquisition head must cover current code through R6.
    const staleCapBody = JSON.stringify({ schema: 'gh.check-runs/v1', head_sha: OLD_HEAD, check_runs: [{ id: 201, name: 'companion', conclusion: 'success' }, { id: 202, name: 'principles', conclusion: 'success' }] });
    const staleCapRel = 'docs/test-assurance-kernel/s4/ci-capture-stale.json';
    writeFileSync(join(tmp, staleCapRel), staleCapBody);
    const staleCtx = { ...realCtx, expectedInputs: frozenPositiveExpected({ FINAL_CI: realCiFacts({ actualRequiredCheckAcquisition: { path: staleCapRel, sha256: sha(staleCapBody) }, headSHA: OLD_HEAD, fullInvocationProof: { ...realCiProof, final: { subject: OLD_HEAD, count: 9, population: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', evidence: [{ path: fiFinalRel, sha256: sha(fiFinalBody) }] } } }) }) };
    const staleAcq = evaluateReceipt('s4/ci-record.json', { ...ciBase, artifact: { ...ciBase.artifact, repository: 'EXPLICITLY-TESTONLY-OWNER-FIXED-REPOSITORY', head: OLD_HEAD, capturedChecks: { path: staleCapRel, sha256: sha(staleCapBody) } } }, 'ci-record', staleCtx);
    assert.ok(staleAcq.some((x) => x.includes('does not cover the current admitted code/receipt source/dependencies')), staleAcq.join('|'));
    // packet 7 / Root ad255e87: the candidate boolean alone proves nothing — an INCREASED
    // count, a missing proof, a wrong baseline subject and a wrong unit each refuse.
    const increased = evaluateReceipt('s4/ci-record.json', ciBase, 'ci-record', { ...realCtx, expectedInputs: frozenPositiveExpected({ FINAL_CI: realCiFacts({ fullInvocationProof: { ...realCiProof, baseline: { subject: ANCHORED_HEAD, count: 8, population: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', evidence: [{ path: fiBaseRel, sha256: sha(fiBaseBody) }] } } }) }) });
    assert.ok(increased.some((x) => x.includes('full-invocation count INCREASED')), increased.join('|'));
    const noProof = evaluateReceipt('s4/ci-record.json', ciBase, 'ci-record', { ...realCtx, expectedInputs: frozenPositiveExpected({ FINAL_CI: { admission: 'ACQUIRED_NATIVE', actualRequiredCheckAcquisition: { path: capRel, sha256: sha(capBody()) }, requiredCheckRunIds: [201, 202], requiredCheckNames: ['companion', 'principles'], headSHA: realHead, repository: 'EXPLICITLY-TESTONLY-OWNER-FIXED-REPOSITORY' } }) });
    assert.ok(noProof.some((x) => x.includes('lacks the expensive full-invocation count proof')), noProof.join('|'));
    // packet 8 / Root ad255e87 minimum: the ORIGINAL baseline identity is the pinned native
    // baseline record admitted by the fixed expected inputs — a descriptor side disagreeing
    // with the pinned native table refuses (never a silently substituted ledger anchor).
    const wrongBaseline = evaluateReceipt('s4/ci-record.json', ciBase, 'ci-record', { ...realCtx, expectedInputs: frozenPositiveExpected({ FINAL_CI: realCiFacts({ fullInvocationProof: { ...realCiProof, baseline: { subject: hex40('e'), count: 12, population: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', evidence: [{ path: fiBaseRel, sha256: sha(fiBaseBody) }] } } }) }) });
    assert.ok(wrongBaseline.some((x) => x.includes('native count table names subject') && x.includes('baseline subject')), wrongBaseline.join('|'));
    // the pinned native FINAL table contradicting the declared descriptor count refuses
    // (owner b43e6e16 'contradictory-native-count': descriptor 9, pinned native 13).
    const fiContradict = JSON.stringify({ metric: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', subject: realHead, count: 13, runs: [{ id: 9002, workflow: 'ci.yml', jobs: ['build', 'test'] }] });
    const fiContradictRel = 'docs/test-assurance-kernel/s4/fullinv-contradictory-count.json';
    writeFileSync(join(tmp, fiContradictRel), fiContradict);
    const contradict = evaluateReceipt('s4/ci-record.json', ciBase, 'ci-record', { ...realCtx, expectedInputs: frozenPositiveExpected({ FINAL_CI: realCiFacts({ fullInvocationProof: { ...realCiProof, final: { subject: realHead, count: 9, population: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', evidence: [{ path: fiContradictRel, sha256: sha(fiContradict) }] } } }) }) });
    assert.ok(contradict.some((x) => x.includes('contradicting the declared final count')), contradict.join('|'));
    // a pinned native FINAL table naming a FOREIGN subject (the anchored base) refuses
    // (owner 'foreign-native-subject').
    const fiForeign = JSON.stringify({ metric: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', subject: ANCHORED_HEAD, count: 9, runs: [{ id: 9002, workflow: 'ci.yml', jobs: ['build', 'test'] }] });
    const fiForeignRel = 'docs/test-assurance-kernel/s4/fullinv-foreign-subject.json';
    writeFileSync(join(tmp, fiForeignRel), fiForeign);
    const foreignSubject = evaluateReceipt('s4/ci-record.json', ciBase, 'ci-record', { ...realCtx, expectedInputs: frozenPositiveExpected({ FINAL_CI: realCiFacts({ fullInvocationProof: { ...realCiProof, final: { subject: realHead, count: 9, population: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', evidence: [{ path: fiForeignRel, sha256: sha(fiForeign) }] } } }) }) });
    assert.ok(foreignSubject.some((x) => x.includes('native count table names subject') && x.includes('final subject')), foreignSubject.join('|'));
    // a NONZERO declared count whose pinned native table carries an EMPTY run population
    // refuses — absent run/workflow/job identities are unverified, never green (owner
    // 'missing-native-run-identity'); the complete zero->zero proof stays the only empty-run
    // positive and is asserted below.
    const fiNoRuns = JSON.stringify({ metric: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', subject: realHead, count: 9, runs: [] });
    const fiNoRunsRel = 'docs/test-assurance-kernel/s4/fullinv-empty-runs.json';
    writeFileSync(join(tmp, fiNoRunsRel), fiNoRuns);
    const noRuns = evaluateReceipt('s4/ci-record.json', ciBase, 'ci-record', { ...realCtx, expectedInputs: frozenPositiveExpected({ FINAL_CI: realCiFacts({ fullInvocationProof: { ...realCiProof, final: { subject: realHead, count: 9, population: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', evidence: [{ path: fiNoRunsRel, sha256: sha(fiNoRuns) }] } } }) }) });
    assert.ok(noRuns.some((x) => x.includes('nonzero count with empty or unusable native run identities')), noRuns.join('|'));
    const wrongUnit = evaluateReceipt('s4/ci-record.json', ciBase, 'ci-record', { ...realCtx, expectedInputs: frozenPositiveExpected({ FINAL_CI: realCiFacts({ fullInvocationProof: { ...realCiProof, unit: 'per-job-cap', final: { ...realCiProof.final, unit: 'per-job-cap' } } }) }) });
    assert.ok(wrongUnit.some((x) => x.includes('SAME original frozen counted population/invocation unit')), wrongUnit.join('|'));
    const badBytes = evaluateReceipt('s4/ci-record.json', ciBase, 'ci-record', { ...realCtx, expectedInputs: frozenPositiveExpected({ FINAL_CI: realCiFacts({ fullInvocationProof: { ...realCiProof, final: { subject: realHead, count: 9, population: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', evidence: [{ path: fiFinalRel, sha256: sha(fiFinalBody + 'x') }] } } }) }) });
    assert.ok(badBytes.some((x) => x.includes('sha mismatch')), badBytes.join('|'));
    // explicit zero is valid ONLY with the complete proof: a full zero->zero proof passes.
    const fiZeroBase = JSON.stringify({ metric: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', subject: ANCHORED_HEAD, count: 0, runs: [] });
    const fiZeroFinal = JSON.stringify({ metric: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', subject: realHead, count: 0, runs: [] });
    const fiZeroBaseRel = 'docs/test-assurance-kernel/s4/fullinv-zero-base.json';
    const fiZeroFinalRel = 'docs/test-assurance-kernel/s4/fullinv-zero-final.json';
    writeFileSync(join(tmp, fiZeroBaseRel), fiZeroBase);
    writeFileSync(join(tmp, fiZeroFinalRel), fiZeroFinal);
    const zeroProof = evaluateReceipt('s4/ci-record.json', ciBase, 'ci-record', { ...realCtx, expectedInputs: frozenPositiveExpected({ FINAL_CI: realCiFacts({ fullInvocationProof: { population: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', baseline: { subject: ANCHORED_HEAD, count: 0, population: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', evidence: [{ path: fiZeroBaseRel, sha256: sha(fiZeroBase) }] }, final: { subject: realHead, count: 0, population: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', evidence: [{ path: fiZeroFinalRel, sha256: sha(fiZeroFinal) }] } } }) }) });
    assert.ok(!zeroProof.some((x) => x.includes('full-invocation')), zeroProof.join('|'));
    // Root 973 R4-required-CI-population attack (the owner d547 reproduction): the FIXED
    // acquisition contains required 201 success AND 202 failure; the candidate claims only
    // 201 with a success-only typed list — a successful subset of a failed required
    // population must REFUSE on the population, outcome and repository arms.
    const failCapBody = JSON.stringify({ schema: 'gh.check-runs/v1', head_sha: realHead, check_runs: [{ id: 201, name: 'companion', conclusion: 'success' }, { id: 202, name: 'principles', conclusion: 'failure' }] });
    const failCapRel = 'docs/test-assurance-kernel/s4/ci-capture-required-failure.json';
    writeFileSync(join(tmp, failCapRel), failCapBody);
    const failCiCtx = { ...realCtx, expectedInputs: frozenPositiveExpected({ FINAL_CI: { admission: 'ACQUIRED_NATIVE', actualRequiredCheckAcquisition: { path: failCapRel, sha256: sha(failCapBody) }, requiredCheckRunIds: [201, 202], requiredCheckNames: ['companion', 'principles'], headSHA: realHead, repository: 'EXPLICITLY-TESTONLY-OWNER-FIXED-REPOSITORY' } }) };
    const omittedFailed = evaluateReceipt('s4/ci-record.json', { ...ciBase, artifact: { ...ciBase.artifact, repository: 'EXPLICITLY-TESTONLY-OWNER-FIXED-REPOSITORY', checkRunIds: [201], checks: [{ name: 'companion', conclusion: 'success' }], capturedChecks: { path: failCapRel, sha256: sha(failCapBody) } } }, 'ci-record', failCiCtx);
    assert.ok(omittedFailed.some((x) => x.includes('are not the complete independently required population')), omittedFailed.join('|'));
    assert.ok(omittedFailed.some((x) => x.includes('REQUIRED captured run 202') && x.includes('failed required outcome refuses')), omittedFailed.join('|'));
    assert.ok(omittedFailed.some((x) => x.includes('required check "principles" is omitted')), omittedFailed.join('|'));
    // a receipt from a different repository than the fixed acquisition refuses
    const wrongRepo = evaluateReceipt('s4/ci-record.json', { ...ciBase, artifact: { ...ciBase.artifact, repository: 'some-other-repository' } }, 'ci-record', realCiCtx);
    assert.ok(wrongRepo.some((x) => x.includes('CI repository does not match the independently selected required-acquisition repository')), wrongRepo.join('|'));
    // R4: a source MANIFEST row is NOT a target installation — without the actual installed
    // bytes the receipt refuses even when the manifest row is genuine.
    const srcTarget = evaluateReceipt('s4/install-record.json', { ...base, kind: 'install-record', artifact: { manifestRow: { path: 'docs/test-assurance-kernel/s3/arbitrary.bin', sha256: sha('local-bytes') } } }, 'install-record', receiptCtx({ repoRoot: tmp, headSHA: hex40('7') }));
    assert.ok(srcTarget.some((x) => x.includes('install receipt lacks an absolute targetRoot')), srcTarget.join('|'));
    const insideRepo = evaluateReceipt('s4/install-record.json', { ...base, kind: 'install-record', artifact: { manifestRow: { path: 'docs/test-assurance-kernel/s3/arbitrary.bin', sha256: sha('local-bytes') }, installation: { targetRoot: tmp, installedFiles: [{ path: join(tmp, 'docs/test-assurance-kernel/s3/arbitrary.bin'), sha256: sha('local-bytes') }], installerArgv: ['bash', 'install.sh'], installerTerminal: { status: 'completed', elapsed_seconds: 1, processes: [{ pid: 1, executable: 'bash', returncode: 0 }] } } } }, 'install-record', receiptCtx({ repoRoot: tmp, headSHA: hex40('7') }));
    assert.ok(insideRepo.some((x) => x.includes('targetRoot is inside this source repository')), insideRepo.join('|'));
    // R4 positive (conditional): a GENUINE target installation outside the source tree — real
    // installed bytes on disk, a genuine manifest row, a native terminal record and an argv
    // matching the FIXED acquisition pin — passes every install arm under the frozen positive
    // map. The sibling repoRoot/targetRoot pair keeps everything inside this test's existing
    // fixture teardown; no new cleanup path is introduced.
    const tmpRepo = join(tmp, 'repo');
    mkdirSync(join(tmpRepo, 'docs/test-assurance-kernel/s3'), { recursive: true });
    mkdirSync(join(tmpRepo, 'packages/getff'), { recursive: true });
    writeFileSync(join(tmpRepo, 'docs/test-assurance-kernel/s3/provenance.json'), '{"note":"review input"}');
    const shipped = 'shipped-install-artifact\n';
    writeFileSync(join(tmpRepo, 'docs/test-assurance-kernel/s3/shipped.json'), shipped);
    writeFileSync(join(tmpRepo, 'packages/getff/MANIFEST.sha256'), `${sha(shipped)}  docs/test-assurance-kernel/s3/shipped.json\n`);
    const targetRoot = join(tmp, 'target-install');
    mkdirSync(join(targetRoot, 'getff'), { recursive: true });
    const installedBytes = 'installed-target-bytes\n';
    writeFileSync(join(targetRoot, 'getff/shipped.json'), installedBytes);
    const instArgv = ['bash', 'scripts/install.sh', '--prefix', targetRoot];
    const instTerminal = { status: 'completed', elapsed_seconds: 2, processes: [{ pid: 7, executable: 'bash', returncode: 0 }], sourceSubject: hex40('7') };
    const instFiles = [{ path: join(targetRoot, 'getff/shipped.json'), sha256: sha(installedBytes) }];
    const fullInstall = { ...base, kind: 'install-record', artifact: { manifestRow: { path: 'docs/test-assurance-kernel/s3/shipped.json', sha256: sha(shipped) }, installation: { targetRoot, installedFiles: instFiles, installerArgv: instArgv, installerTerminal: instTerminal } } };
    const fullAcq = { admission: 'INSTALLED_NATIVE', actualTargetAcquisition: { targetRoot, installerArgv: instArgv, installedFiles: instFiles, installerTerminal: instTerminal, sourceSubject: hex40('7') } };
    const instOk = evaluateReceipt('s4/install-record.json', fullInstall, 'install-record', receiptCtx({ repoRoot: tmpRepo, headSHA: hex40('7'), expectedInputs: frozenPositiveExpected({ TARGET_INSTALL: fullAcq }) }));
    assert.ok(instOk.length === 0, instOk.join('|'));
    // Root 973 R4-install-subject-bytes-terminal attack (the Root probe reproduction): the
    // FIXED acquisition expects TWO files at exact bytes and a 2s/old-subject native terminal;
    // the candidate substitutes ONE locally-created different file and a self-authored 999s
    // newer terminal under the SAME targetRoot/argv — must refuse on the emitted population,
    // the expected bytes and the terminal, never accept.
    const substBytes = 'LOCAL CURRENT CONTENT NOT EXPECTED INSTALLED VERSION';
    writeFileSync(join(targetRoot, 'getff/shipped.json'), substBytes);
    const attackInstall = { ...base, kind: 'install-record', artifact: { manifestRow: { path: 'docs/test-assurance-kernel/s3/shipped.json', sha256: sha(shipped) }, installation: { targetRoot, installedFiles: [{ path: join(targetRoot, 'getff/shipped.json'), sha256: sha(substBytes) }], installerArgv: instArgv, installerTerminal: { status: 'completed', elapsed_seconds: 999, processes: [{ pid: 7, executable: 'bash', returncode: 0 }], sourceSubject: realHead } } } };
    const instAttackP = evaluateReceipt('s4/install-record.json', attackInstall, 'install-record', receiptCtx({ repoRoot: tmpRepo, headSHA: hex40('7'), expectedInputs: frozenPositiveExpected({ TARGET_INSTALL: fullAcq }) }));
    assert.ok(instAttackP.some((x) => x.includes('not the complete independently expected emitted set')), instAttackP.join('|'));
    assert.ok(instAttackP.some((x) => x.includes('is not present on disk with its exact expected sha')), instAttackP.join('|'));
    assert.ok(instAttackP.some((x) => x.includes('self-authored substituted terminal refuses')), instAttackP.join('|'));
    // restore the genuine installed bytes — the complete positive matches again
    writeFileSync(join(targetRoot, 'getff/shipped.json'), installedBytes);
    assert.deepEqual(evaluateReceipt('s4/install-record.json', fullInstall, 'install-record', receiptCtx({ repoRoot: tmpRepo, headSHA: hex40('7'), expectedInputs: frozenPositiveExpected({ TARGET_INSTALL: fullAcq }) })), []);
    // R4 under the owner-shaped map: TARGET_INSTALL is MISSING — installed bytes/argv/terminal
    // authored by the source side are not an actual installation.
    const instOwnerP = evaluateReceipt('s4/install-record.json', fullInstall, 'install-record', receiptCtx({ repoRoot: tmpRepo, headSHA: hex40('7'), expectedInputs: frozenOwnerShapeExpected() }));
    assert.ok(instOwnerP.some((x) => x.includes('record the target installation as MISSING')), instOwnerP.join('|'));
    // and a target/argv the FIXED descriptor does not admit refuses even under the positive map
    const instOtherArgv = evaluateReceipt('s4/install-record.json', { ...base, kind: 'install-record', artifact: { ...fullInstall.artifact, installation: { ...fullInstall.artifact.installation, installerArgv: ['bash', 'scripts/other.sh'] } } }, 'install-record', receiptCtx({ repoRoot: tmpRepo, headSHA: hex40('7'), expectedInputs: frozenPositiveExpected({ TARGET_INSTALL: { admission: 'INSTALLED_NATIVE', actualTargetAcquisition: { targetRoot, installerArgv: instArgv } } }) }));
    assert.ok(instOtherArgv.some((x) => x.includes('does not match the independently selected actual target acquisition')), instOtherArgv.join('|'));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
test('F1 s4-fail-closed-gate refuses the six-forged-objects evidence set (production consumer)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 's3-f1-'));
  try {
    mkdirSync(join(tmp, 'docs/test-assurance-kernel/s3'), { recursive: true });
    mkdirSync(join(tmp, 'docs/test-assurance-kernel/s4'), { recursive: true });
    const ledger = okLedger();
    // pinned live code files present and correct so the gate reaches the RECEIPT layer
    for (const row of ledger.addedPaths.filter((r) => !r.selfIndexed)) {
      const f = join(tmp, row.path);
      mkdirSync(join(f, '..'), { recursive: true });
      const body = `content ${row.path}\n`;
      writeFileSync(f, body);
      row.sha256 = sha(body);
    }
    writeFileSync(join(tmp, 'scripts/test-assurance/verify.mjs'), 'verify-body');
    ledger.modifiedPaths[0].sha256 = sha('verify-body');
    ledger.s4EvidenceIndex.declaredPaths = S4_REQUIRED_KINDS.map((k) => ({ path: `docs/test-assurance-kernel/s4/${k}.json`, kind: k }));
    for (const e of ledger.s4EvidenceIndex.declaredPaths) {
      const body = JSON.stringify({ kind: e.kind, codeSHA: 'a'.repeat(64) });
      writeFileSync(join(tmp, e.path), body);
      e.sha256 = sha(body);
    }
    // R3: ordered ACCEPTED S2→S3 predecessors pinned (TESTONLY records) so the gate proceeds
    // past the prerequisite layer to the receipt layer it is testing.
    const p2Body = JSON.stringify({ stage: 'S2', verdict: 'ACCEPTED', baseHead: ANCHORED_HEAD });
    const p3Body = JSON.stringify({ stage: 'S3', verdict: 'ACCEPTED', head: hex40('e') });
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/predecessor-s2.json'), p2Body);
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/predecessor-s3.json'), p3Body);
    ledger.predecessors = {
      s2: { acceptedEvidence: { path: 'docs/test-assurance-kernel/s3/predecessor-s2.json', sha256: sha(p2Body) } },
      s3: { verdictRecord: { path: 'docs/test-assurance-kernel/s3/predecessor-s3.json', sha256: sha(p3Body) } },
    };
    writeFileSync(join(tmp, S3_LEDGER_REL), JSON.stringify(ledger));
    const gitMock = (cmd, args) => {
      if (cmd !== 'git') return { rc: 1, stdout: Buffer.from('') };
      const j = args.join(' ');
      if (j === `rev-parse ${ANCHORED_HEAD}^{tree}`) return { rc: 0, stdout: Buffer.from(ANCHORED_TREE + '\n') };
      if (j === 'rev-parse HEAD') return { rc: 0, stdout: Buffer.from(hex40('e') + '\n') };
      return { rc: 0, stdout: Buffer.from('') };
    };
    // the FROZEN positive descriptor admits the exact TESTONLY predecessor pins, so the gate
    // proceeds past the prerequisite layer to the RECEIPT layer this test targets — the
    // forged receipts themselves are what must refuse, not a missing data context.
    const depsBody = JSON.stringify({ profile: 'TESTONLY-dependency-closure' });
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/predecessor-deps.json'), depsBody);
    const gateExpected = frozenPositiveExpected({
      S2_CANONICAL_ACCEPTED: { admission: 'ACCEPTED_FOR_ITS_EXACT_COVERED_SUBJECT_ONLY', head: ANCHORED_HEAD, tree: ANCHORED_TREE, producerPostimages: {}, receipt: { path: 'docs/test-assurance-kernel/s3/predecessor-s2.json', sha256: sha(p2Body) }, dependenciesAndProfile: { path: 'docs/test-assurance-kernel/s3/predecessor-deps.json', sha256: sha(depsBody) } },
      S3_ACCEPTED_PREDECESSOR: { admission: 'ACCEPTED_NATIVE', acceptedVerdictRecord: { path: 'docs/test-assurance-kernel/s3/predecessor-s3.json', sha256: sha(p3Body) }, head: hex40('e'), sourceSubject: hex40('e'), dependencySubject: sha(depsBody) },
    });
    const steps = buildStageSteps('S4', { repoRoot: tmp, runFn: gitMock, gitEnv: null, expectedInputs: gateExpected });
    const r = steps[0][1]();
    assert.equal(r.status, 'RED');
    assert.ok(r.msg.includes('reviewer identity missing') || r.msg.includes('never fabricated'), r.msg);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
test('F1 wrong-signature headSHA (64-hex sha256 form) is refused', () => {
  const ctx = receiptCtx();
  const p = evaluateReceipt('s4/code-signature.json', { kind: 'code-signature', reviewer: 'rev', author: 'aut', identityProof: { sessionId: 'author-session-0001' }, reviewerProof: { sessionId: 'reviewer-session-0002' }, verdict: 'ACCEPT', codeSHA: 'a'.repeat(64), headSHA: 'a'.repeat(64), artifact: { signatureValue: hex64('9') } }, 'code-signature', ctx);
  assert.ok(p.some((x) => x.includes('Git-40 commit id')), p.join('|'));
  assert.ok(p.some((x) => x.includes('codeSHA is not bound')), p.join('|'));
});
test('F1 full-schema receipts with live binding have a reachable accept path', () => {
  const tmp = mkdtempSync(join(tmpdir(), 's3-f1b-'));
  try {
    mkdirSync(join(tmp, 'docs/test-assurance-kernel/s4'), { recursive: true });
    const ledger = okLedger();
    // real bytes on disk with real pins
    for (const row of ledger.addedPaths.filter((r) => !r.selfIndexed)) {
      const f = join(tmp, row.path);
      mkdirSync(join(f, '..'), { recursive: true });
      writeFileSync(f, `content ${row.path}\n`);
      row.sha256 = sha(`content ${row.path}\n`);
    }
    writeFileSync(join(tmp, 'scripts/test-assurance/verify.mjs'), 'verify-body');
    ledger.modifiedPaths[0].sha256 = sha('verify-body');
    // genuine fully-bound 24-cell perf record + raw index (R1 fixture incl. journal/campaign)
    const headSHA = hex40('7');
    const rb = buildBoundPerf(tmp, headSHA, { optimizedTree: hex40('d') });
    const { perf } = rb;
    const perfBytes = JSON.stringify(perf);
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/performance.json'), perfBytes);
    // provenance artifact shared by the receipts (real file, real sha)
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/provenance.json'), '{"review":"input"}\n');
    const prov = { path: 'docs/test-assurance-kernel/s3/provenance.json', sha256: sha('{"review":"input"}\n') };
    // install-record manifest target + the R4 ACTUAL target installation OUTSIDE the source
    // repo, with real installed bytes, installer argv and a native terminal record (TESTONLY)
    const installBody = '{"install":"recorded"}\n';
    const installRel = 'docs/test-assurance-kernel/s3/install-artifact.json';
    writeFileSync(join(tmp, installRel), installBody);
    mkdirSync(join(tmp, 'packages/getff'), { recursive: true });
    writeFileSync(join(tmp, 'packages/getff/MANIFEST.sha256'), `${sha(installBody)}  ${installRel}\n`);
    const targetRoot = mkdtempSync(join(tmpdir(), 's3-install-'));
    mkdirSync(join(targetRoot, 'bin'), { recursive: true });
    writeFileSync(join(targetRoot, 'bin/getff'), '#!/bin/sh\ngetff testonly install\n');
    const installation = {
      targetRoot,
      installedFiles: [{ path: join(targetRoot, 'bin/getff'), sha256: sha('#!/bin/sh\ngetff testonly install\n') }],
      installerArgv: ['bash', 'scripts/install.sh', '--target', targetRoot],
      installerTerminal: { status: 'completed', elapsed_seconds: 3.5, processes: [{ pid: 4242, pgid: 4242, executable: 'bash', returncode: 0 }] },
    };
    // R4: retained native GitHub check-runs capture the ci-record binds to (gh.check-runs/v1)
    const captureBody = JSON.stringify({ schema: 'gh.check-runs/v1', head_sha: headSHA, check_runs: [{ id: 101, name: 'build', conclusion: 'success' }, { id: 102, name: 'test', conclusion: 'success' }] });
    const captureRel = 'docs/test-assurance-kernel/s4/ci-capture.json';
    writeFileSync(join(tmp, captureRel), captureBody);
    ledger.s4EvidenceIndex.declaredPaths = S4_REQUIRED_KINDS.map((k) => ({ path: `docs/test-assurance-kernel/s4/${k}.json`, kind: k }));
    ledger.evidenceComplete = true;
    ledger.declaredPendingEvidence = [];
    ledger.addedPaths = [
      ...ledger.addedPaths,
      { path: 'docs/test-assurance-kernel/s3/performance.json', class: 's3-evidence', sha256: sha(perfBytes) },
      { path: 'docs/test-assurance-kernel/s3/install-artifact.json', class: 's3-evidence', sha256: sha(installBody) },
    ];
    // R3: ordered ACCEPTED S2→S3 predecessors (TESTONLY records; the gitMock accepts ancestry)
    const p2Body = JSON.stringify({ stage: 'S2', verdict: 'ACCEPTED', baseHead: ANCHORED_HEAD });
    const p3Body = JSON.stringify({ stage: 'S3', verdict: 'ACCEPTED', head: headSHA });
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/predecessor-s2.json'), p2Body);
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/predecessor-s3.json'), p3Body);
    const depsBody = JSON.stringify({ profile: 'TESTONLY-dependency-closure' });
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/predecessor-deps.json'), depsBody);
    ledger.predecessors = {
      s2: { acceptedEvidence: { path: 'docs/test-assurance-kernel/s3/predecessor-s2.json', sha256: sha(p2Body) } },
      s3: { verdictRecord: { path: 'docs/test-assurance-kernel/s3/predecessor-s3.json', sha256: sha(p3Body) } },
    };
    const fiBody1 = JSON.stringify({ metric: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', subject: ANCHORED_HEAD, count: 5, runs: [{ id: 6001, workflow: 'ci.yml', jobs: ['build', 'test'] }] });
    const fiBody2 = JSON.stringify({ metric: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', subject: headSHA, count: 4, runs: [{ id: 6002, workflow: 'ci.yml', jobs: ['build', 'test'] }] });
    const fiRel1 = 'docs/test-assurance-kernel/s4/fullinv-f1-baseline.json';
    const fiRel2 = 'docs/test-assurance-kernel/s4/fullinv-f1-final.json';
    writeFileSync(join(tmp, fiRel1), fiBody1);
    writeFileSync(join(tmp, fiRel2), fiBody2);
    const sig = sourceSignature(tmp, ledger);
    const base = { reviewer: 'independent-root-reviewer', author: 's3-implementer', identityProof: { sessionId: '3a4be585-ad17-43b2' }, reviewerProof: { sessionId: 'reviewer-session-0002' }, verdict: 'ACCEPT', codeSHA: sig, headSHA, provenance: prov, schema: 'getff.root.affected-review/v1' };
    const receipts = {
      'spec-review.json': { ...base, kind: 'spec-review', artifact: { reviewedPatchSha256: sha(''), verdict: 'ACCEPT' } },
      'quality-review.json': { ...base, kind: 'quality-review', artifact: { reviewedPatchSha256: sha(''), verdict: 'ACCEPT' } },
      'code-signature.json': { ...base, kind: 'code-signature', artifact: { signatureValue: sig } },
      'ci-record.json': { ...base, kind: 'ci-record', artifact: { checkRunIds: [101, 102], conclusion: 'success', checks: [{ name: 'build', conclusion: 'success' }, { name: 'test', conclusion: 'success' }], head: headSHA, repository: 'EXPLICITLY-TESTONLY-OWNER-FIXED-REPOSITORY', criticalPathFullInvocationIncreased: false, capturedChecks: { path: captureRel, sha256: sha(captureBody) } } },
      'install-record.json': { ...base, kind: 'install-record', artifact: { manifestRow: { path: installRel, sha256: sha(installBody) }, installation } },
      'performance-record.json': { ...base, kind: 'performance-record', artifact: { matrixRecordSha256: sha(perfBytes) } },
    };
    for (const [name, r] of Object.entries(receipts)) writeFileSync(join(tmp, 'docs/test-assurance-kernel/s4', name), JSON.stringify(r));
    for (const e of ledger.s4EvidenceIndex.declaredPaths) e.sha256 = sha(readFileSyncCompat(join(tmp, e.path)));
    writeFileSync(join(tmp, S3_LEDGER_REL), JSON.stringify(ledger));
    const gitMock = (cmd, args) => {
      if (cmd !== 'git') return { rc: 1, stdout: Buffer.from('') };
      const j = args.join(' ');
      if (j === `rev-parse ${ANCHORED_HEAD}^{tree}`) return { rc: 0, stdout: Buffer.from(ANCHORED_TREE + '\n') };
      if (j === 'rev-parse HEAD') return { rc: 0, stdout: Buffer.from(headSHA + '\n') };
      if (j === `rev-parse ${FROZEN_ROLE.head}^{tree}`) return { rc: 0, stdout: Buffer.from(FROZEN_ROLE.tree + '\n') };
      if (j === `rev-parse ${headSHA}^{tree}`) return { rc: 0, stdout: Buffer.from(hex40('d') + '\n') };
      if (args[0] === 'rev-parse') return { rc: 0, stdout: Buffer.from(hex40('9') + '\n') }; // identical blob ids
      if (args[0] === 'diff') return { rc: 0, stdout: Buffer.from('') }; // empty patch: sha('') anchors match
      return { rc: 0, stdout: Buffer.from('') }; // cat-file/merge-base succeed clean
    };
    const steps = buildStageSteps('S4', { repoRoot: tmp, runFn: gitMock, gitEnv: null, expectedInputs: frozenPositiveExpected({
      // every externally dependent fact comes from THIS frozen descriptor — byte pins
      // recomputed from the owned fixture bytes above, never from the receipts themselves.
      S3_PERFORMANCE: { admission: 'QUALIFIED_NATIVE_GREEN', ...frozenPerfPins(tmp, rb.journalRel) },
      FINAL_CI: { admission: 'ACQUIRED_NATIVE', actualRequiredCheckAcquisition: { path: captureRel, sha256: sha(captureBody) }, requiredCheckRunIds: [101, 102], requiredCheckNames: ['build', 'test'], headSHA, repository: 'EXPLICITLY-TESTONLY-OWNER-FIXED-REPOSITORY', fullInvocationProof: { population: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', baseline: { subject: ANCHORED_HEAD, count: 5, population: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', evidence: [{ path: fiRel1, sha256: sha(fiBody1) }] }, final: { subject: headSHA, count: 4, population: 'critical-path-full-invocations', unit: 'ci-workflow-invocation', evidence: [{ path: fiRel2, sha256: sha(fiBody2) }] } } },
      TARGET_INSTALL: { admission: 'INSTALLED_NATIVE', actualTargetAcquisition: { targetRoot, installerArgv: installation.installerArgv, installedFiles: installation.installedFiles, installerTerminal: installation.installerTerminal, sourceSubject: headSHA } },
      S2_CANONICAL_ACCEPTED: { admission: 'ACCEPTED_FOR_ITS_EXACT_COVERED_SUBJECT_ONLY', head: ANCHORED_HEAD, tree: ANCHORED_TREE, producerPostimages: {}, receipt: { path: 'docs/test-assurance-kernel/s3/predecessor-s2.json', sha256: sha(p2Body) }, dependenciesAndProfile: { path: 'docs/test-assurance-kernel/s3/predecessor-deps.json', sha256: sha(depsBody) } },
      S3_ACCEPTED_PREDECESSOR: { admission: 'ACCEPTED_NATIVE', acceptedVerdictRecord: { path: 'docs/test-assurance-kernel/s3/predecessor-s3.json', sha256: sha(p3Body) }, head: headSHA, sourceSubject: headSHA, dependencySubject: sha(depsBody) },
      // review subjects measured from THIS fixture: the gitMock resolves HEAD to headSHA and
      // diff to '' — so the accepted review record pins exactly that head/patch (Root 973 R4).
      INDEPENDENT_SPEC_REVIEW: { admission: 'ACCEPTED_NATIVE', actualReviewRecord: { reviewer: FROZEN_REVIEWER, reviewerSession: FROZEN_REVIEWER_SESSION, verdict: 'ACCEPT', headSHA, reviewedPatchSha256: sha(''), sourceSubject: headSHA } },
      INDEPENDENT_QUALITY_REVIEW: { admission: 'ACCEPTED_NATIVE', actualReviewRecord: { reviewer: FROZEN_REVIEWER, reviewerSession: FROZEN_REVIEWER_SESSION, verdict: 'ACCEPT', headSHA, reviewedPatchSha256: sha(''), sourceSubject: headSHA } },
    }) });
    const r = steps[0][1]();
    assert.equal(r.status, 'PASS', r.msg);
    // the SAME fixture under the owner-shaped map stays RED with a NAMED refusal — the
    // conditional positive never mints acceptance the descriptor does not admit (the accepted
    // S3 predecessor is MISSING there, so the ordered chain fails closed).
    const rOwner = buildStageSteps('S4', { repoRoot: tmp, runFn: gitMock, gitEnv: null, expectedInputs: frozenOwnerShapeExpected() })[0][1]();
    assert.equal(rOwner.status, 'RED');
    assert.ok(rOwner.msg.includes('no accepted S3 verdict exists') || rOwner.msg.includes('record the target installation as MISSING') || rOwner.msg.includes('structural fields, not review origin'), rOwner.msg);
    // and without any descriptor the full registry refuses on the missing data context —
    // externally dependent certificates stay nonPASS by default, never green.
    const rNoExp = buildStageSteps('S4', { repoRoot: tmp, runFn: gitMock, gitEnv: null })[0][1]();
    assert.equal(rNoExp.status, 'RED');
    assert.ok(rNoExp.msg.includes('no independently selected expected inputs'), rNoExp.msg);
    rmSync(targetRoot, { recursive: true, force: true });
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// ---------- ROOT-S4-R3: live-bytes signature ----------
test('ROOT-S4-R3: changed live source bytes change the signature and break ledger pins', () => {
  const tmp = mkdtempSync(join(tmpdir(), 's3-r3-'));
  try {
    mkdirSync(join(tmp, 'scripts/test-assurance'), { recursive: true });
    mkdirSync(join(tmp, 'docs/test-assurance-kernel/s3'), { recursive: true });
    const ledger = okLedger();
    ledger.declaredPendingEvidence = [];
    ledger.evidenceComplete = true;
    for (const row of ledger.addedPaths.filter((r) => !r.selfIndexed)) {
      const f = join(tmp, row.path);
      mkdirSync(join(f, '..'), { recursive: true });
      const body = `content ${row.path}\n`;
      writeFileSync(f, body);
      row.sha256 = sha(body);
    }
    writeFileSync(join(tmp, 'scripts/test-assurance/verify.mjs'), 'verify-body');
    ledger.modifiedPaths[0].sha256 = sha('verify-body');
    const sigBefore = sourceSignature(tmp, ledger);
    // mutate the LIVE module bytes (repoRoot is load-bearing) — signature must move
    writeFileSync(join(tmp, 'scripts/test-assurance/s3.mjs'), 'content scripts/test-assurance/s3.mjs\n// EVIL\n');
    const sigAfter = sourceSignature(tmp, ledger);
    assert.notEqual(sigBefore, sigAfter, 'identical declarations with different live bytes must not share a signature');
    // and the production inventory consumer catches the drifted pin against the unchanged ledger
    const inv = reconcileInventory({ repoRoot: tmp, basePaths: ['a'], rulingPath: 'r', livePaths: [...ledger.addedPaths.map((r) => r.path), 'a', 'r'], ledger });
    assert.ok(inv.some((x) => x.includes('pinned sha mismatch at scripts/test-assurance/s3.mjs')), inv.join('|'));
    // R3 (Root978 prerequisite): S4 needs the genuine ORDERED ACCEPTED S2→S3 chain bound to
    // this exact code line. Unit subpredicates over the REAL repository graph:
    // missing declarations refuse…
    const noPrereq = validatePredecessors(okLedger(), tmp, realGitHistorical);
    assert.ok(!noPrereq.ok && noPrereq.problems.some((x) => x.includes('ordered predecessor declarations (s2 then s3) missing')), noPrereq.problems.join('|'));
    // …a delivered-RED S3 verdict record keeps S4 nonPASS (the honest current state)…
    const s3RedBody = JSON.stringify({ stage: 'S3', verdict: 'RED', head: realGit(['rev-parse', 'HEAD']).stdout.toString().trim(), openItems: ['rule-538-to-430.4', 'ci'] });
    const s2AccBody = JSON.stringify({ stage: 'S2', verdict: 'ACCEPTED', baseHead: ANCHORED_HEAD });
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/predecessor-s2.json'), s2AccBody);
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/predecessor-s3.json'), s3RedBody);
    const redLedger = okLedger();
    redLedger.predecessors = {
      s2: { acceptedEvidence: { path: 'docs/test-assurance-kernel/s3/predecessor-s2.json', sha256: sha(s2AccBody) } },
      s3: { verdictRecord: { path: 'docs/test-assurance-kernel/s3/predecessor-s3.json', sha256: sha(s3RedBody) } },
    };
    const redPrereq = validatePredecessors(redLedger, tmp, realGitHistorical);
    assert.ok(!redPrereq.ok && redPrereq.problems.some((x) => x.includes('S4 certificates require the ordered ACCEPTED S2 then S3 chain')), redPrereq.problems.join('|'));
    // …a stale/unrelated S2 base head refuses…
    const s2StaleBody = JSON.stringify({ stage: 'S2', verdict: 'ACCEPTED', baseHead: hex40('f') });
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/predecessor-s2.json'), s2StaleBody);
    const staleLedger = okLedger();
    staleLedger.predecessors = { ...redLedger.predecessors, s2: { acceptedEvidence: { path: 'docs/test-assurance-kernel/s3/predecessor-s2.json', sha256: sha(s2StaleBody) } } };
    const stalePrereq = validatePredecessors(staleLedger, tmp, realGitHistorical);
    assert.ok(!stalePrereq.ok && stalePrereq.problems.some((x) => x.includes(`base head ${hex40('f')} does not exist as a commit`)), stalePrereq.problems.join('|'));
    // …and the positive subpredicate is reachable on the REAL graph: the anchored S2 base and
    // an accepted S3 verdict at the live HEAD (TESTONLY synthetic verdict bodies) — but ONLY
    // through the FROZEN independent expected inputs admitting the exact covered subject
    // (real head/tree/producer postimages recomputed from live Git objects) and the exact
    // accepted-verdict pin.
    const s3AccBody = JSON.stringify({ stage: 'S3', verdict: 'ACCEPTED', head: realGit(['rev-parse', 'HEAD']).stdout.toString().trim() });
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/predecessor-s2.json'), s2AccBody);
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/predecessor-s3.json'), s3AccBody);
    const accLedger = okLedger();
    accLedger.predecessors = {
      s2: { acceptedEvidence: { path: 'docs/test-assurance-kernel/s3/predecessor-s2.json', sha256: sha(s2AccBody) } },
      s3: { verdictRecord: { path: 'docs/test-assurance-kernel/s3/predecessor-s3.json', sha256: sha(s3AccBody) } },
    };
    const anchoredTree = realGitHistorical(['rev-parse', `${ANCHORED_HEAD}^{tree}`]).stdout.toString().trim();
    const verifyBlob = realGitHistorical(['cat-file', 'blob', `${ANCHORED_HEAD}:scripts/test-assurance/verify.mjs`]).stdout.toString();
    // the LIVE producer at the covered checkout equals the accepted postimage (write the exact
    // anchored blob bytes into the fixture checkout) — plus the receipt pin, the readable
    // dependency closure and the CURRENT covered subject fields.
    mkdirSync(join(tmp, 'scripts/test-assurance'), { recursive: true });
    writeFileSync(join(tmp, 'scripts/test-assurance/verify.mjs'), verifyBlob);
    const predDepsBody = JSON.stringify({ profile: 'TESTONLY-dependency-closure', subject: 'covered' });
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/predecessor-deps.json'), predDepsBody);
    const liveHeadNow = realGit(['rev-parse', 'HEAD']).stdout.toString().trim();
    const frozenPredExpected = frozenPositiveExpected({
      S2_CANONICAL_ACCEPTED: { admission: 'ACCEPTED_FOR_ITS_EXACT_COVERED_SUBJECT_ONLY', head: ANCHORED_HEAD, tree: anchoredTree, producerPostimages: { 'scripts/test-assurance/verify.mjs': sha(verifyBlob) }, receipt: { path: 'docs/test-assurance-kernel/s3/predecessor-s2.json', sha256: sha(s2AccBody) }, dependenciesAndProfile: { path: 'docs/test-assurance-kernel/s3/predecessor-deps.json', sha256: sha(predDepsBody) } },
      S3_ACCEPTED_PREDECESSOR: { admission: 'ACCEPTED_NATIVE', acceptedVerdictRecord: { path: 'docs/test-assurance-kernel/s3/predecessor-s3.json', sha256: sha(s3AccBody) }, head: liveHeadNow, sourceSubject: liveHeadNow, dependencySubject: sha(predDepsBody) },
    });
    // Root unit-35 item 5: the anchored S2 base is a HISTORICAL portable object, provably NOT
    // an ancestor of the live integration HEAD — the plain predicate refuses by default with
    // the frozen original message, and only the EXPLICIT accepted conditional current-transfer
    // fixture satisfies it through the reviewed composite (generation->cf64 historical proof
    // via the portable store bound to the real transport root + the complete finite LIVE
    // current transfer + actual bc8/checkpoint ancestry of the live HEAD). A broken fixture
    // leg keeps the original refusal.
    const defaultPred = validatePredecessors(accLedger, tmp, realGitHistorical, { expectedInputs: frozenPredExpected });
    assert.ok(!defaultPred.ok && defaultPred.problems.some((x) => x.includes('s2 predecessor base head is not an ancestor of the live HEAD — stale/unrelated accepted evidence')), defaultPred.problems.join('|'));
    const condPredExpected = frozenPositiveExpected({
      S2_CANONICAL_ACCEPTED: { admission: 'ACCEPTED_FOR_ITS_EXACT_COVERED_SUBJECT_ONLY', head: ANCHORED_HEAD, tree: anchoredTree, producerPostimages: { 'scripts/test-assurance/verify.mjs': sha(verifyBlob) }, receipt: { path: 'docs/test-assurance-kernel/s3/predecessor-s2.json', sha256: sha(s2AccBody) }, dependenciesAndProfile: { path: 'docs/test-assurance-kernel/s3/predecessor-deps.json', sha256: sha(predDepsBody) } },
      S3_ACCEPTED_PREDECESSOR: { admission: 'ACCEPTED_NATIVE', acceptedVerdictRecord: { path: 'docs/test-assurance-kernel/s3/predecessor-s3.json', sha256: sha(s3AccBody) }, head: liveHeadNow, sourceSubject: liveHeadNow, dependencySubject: sha(predDepsBody) },
      S4_CONDITIONAL_CURRENT_TRANSFER: { admission: 'ACCEPTED_STRUCTURAL', s2BaseHead: ANCHORED_HEAD, checkpoint: CURRENT_TRANSFER_CHECKPOINT, replacements: ADMITTED_CURRENT_REPLACEMENTS },
    });
    // Without a real transport root the composite leg fails closed (the fixture checkout
    // carries no canonical carrier/bundle) — the honest stale-binding refusal is preserved.
    const noTransport = validatePredecessors(accLedger, tmp, realGitHistorical, { expectedInputs: condPredExpected });
    assert.ok(!noTransport.ok && noTransport.problems.some((x) => x.includes('stale/unrelated accepted evidence')), noTransport.problems.join('|'));
    // A self-issued fixture whose pins do not equal the reviewed constants never substitutes.
    const brokenPins = structuredClone(condPredExpected);
    brokenPins.facts.S4_CONDITIONAL_CURRENT_TRANSFER.checkpoint = { ...CURRENT_TRANSFER_CHECKPOINT, tree: hex40('b') };
    const brokenPred = validatePredecessors(accLedger, tmp, realGitHistorical, { expectedInputs: brokenPins });
    assert.ok(!brokenPred.ok && brokenPred.problems.some((x) => x.includes('pins do not equal the reviewed constants')), brokenPred.problems.join('|'));
    // Root unit-36 item C: with the REAL transport root the composite reaches its intended
    // logic — historical proof, complete row/mode/content/extra/missing reconciliation and
    // live-HEAD ancestry all hold — and the ONLY remaining refusal is the honest finite
    // pending class: the typed current-source postimage proposals awaiting actual Root
    // admission. Never a silent pass, never a stale/unrelated mislabel, never an oldref
    // object error. (The reviewed carrier itself is a byte-identical copy of the admitted
    // artifact pinned by its sha256 — a mutated carrier would refuse inside
    // loadReviewedIntegration.)
    mkdirSync(join(tmp, 'docs/test-assurance-kernel/s2'), { recursive: true });
    writeFileSync(join(tmp, S2_REVIEWED_INTEGRATION_REL), readFileSync(join(REPO_ROOT, S2_REVIEWED_INTEGRATION_REL)));
    // Root unit-38 F1 + unit-49 repair: the composite reads the LIVE scope-extension ledger
    // from the fixture checkout AND the committed live HEAD row (unit-38 F2). Since G445 the
    // guard bytes genuinely differ from the admitted checkpoint, so a row-LESS cd3 form now
    // hard-refuses (the correct production verdict for a changed governed path without a
    // binding) and the pending oracle dies before its assertion. The fixture is therefore a
    // COHERENT TESTONLY unactivated ledger: the unchanged cd3 baseline PLUS the optional guard
    // rows AND the unit-66 smoke rows, pins derived from the actual COMMITTED live blobs — the
    // same fixture bytes on disk and served as the committed live-HEAD row through the
    // bounded pass-through adapter. The five original rows keep their cd3 pins (genuinely
    // unactivated semantics preserved — no activation rows, no rebind of the five baseline
    // expectations), so the only refusal remains the honest finite pending class, never an
    // activation-dependent channel flip, a disk/committed divergence or a hard nonrow
    // mislabel of the two governed guard changes.
    mkdirSync(join(tmp, 'docs/test-assurance-kernel/s3'), { recursive: true });
    const fixtureLedger = coherentUnactivatedLedgerBytes();
    writeFileSync(join(tmp, S3_LEDGER_REL), fixtureLedger);
    const condPending = validatePredecessors(accLedger, tmp, pinLiveLedgerRowToBytes(realGitHistorical, fixtureLedger, fixtureLedgerGitBlob(fixtureLedger)), { expectedInputs: condPredExpected, portableTransportRoot: REPO_ROOT });
    assert.ok(!condPending.ok, 'the conditional composite refuses while postimage proposals are unadmitted');
    assert.ok(condPending.problems.some((x) => x.includes('remain unadmitted (explicit admission-pending refusal, never a silent pass)')), condPending.problems.join('|'));
    assert.ok(condPending.problems.every((x) => !x.includes('stale/unrelated accepted evidence') && !x.includes('does not reconcile')), condPending.problems.join('|'));
    // R3 evidence-only repair controls on a NATIVE Git fixture (the owner overreject shape,
    // b8f341ad): the accepted subject stays covered across an evidence-only descendant
    // commit — no exact-HEAD fixed point — while a scoped-source change after the accepted
    // head still refuses — no blanket ancestry exemption. Baseline first: acceptance at the
    // exact native HEAD is ok before any descendant commit exists.
    const r3Repo = mkdtempSync(join(tmpdir(), 's3-r3-equiv-'));
    const r3g = (args) => {
      const r = spawnSync('git', ['-C', r3Repo, ...args], { encoding: 'utf8' });
      return { rc: r.status ?? 1, stdout: Buffer.from(r.stdout ?? ''), stderr: r.stderr };
    };
    try {
      r3g(['init', '-q']);
      mkdirSync(join(r3Repo, 'scripts/test-assurance'), { recursive: true });
      mkdirSync(join(r3Repo, 'docs/test-assurance-kernel/s3'), { recursive: true });
      const r3verify = 'verify-native-v1\n';
      writeFileSync(join(r3Repo, 'scripts/test-assurance/verify.mjs'), r3verify);
      writeFileSync(join(r3Repo, 'scripts/test-assurance/s3.mjs'), 'module native v1\n');
      writeFileSync(join(r3Repo, 'scripts/test-assurance/s3.test.mjs'), 'test native v1\n');
      writeFileSync(join(r3Repo, 'docs/test-assurance-kernel/s3/README.md'), 'readme v1\n');
      const r3ci = (args) => r3g(['-c', 'user.email=tak@local', '-c', 'user.name=tak', ...args]);
      assert.equal(r3ci(['add', '-A']).rc, 0);
      assert.equal(r3ci(['commit', '-q', '-m', 'native accepted source']).rc, 0, 'native baseline commit failed');
      const r3Accepted = String(r3g(['rev-parse', 'HEAD']).stdout).trim();
      const r3Tree = String(r3g(['rev-parse', `${r3Accepted}^{tree}`]).stdout).trim();
      const r3s2 = JSON.stringify({ stage: 'S2', verdict: 'ACCEPTED', baseHead: r3Accepted });
      const r3s3 = JSON.stringify({ stage: 'S3', verdict: 'ACCEPTED', head: r3Accepted });
      const r3deps = JSON.stringify({ profile: 'TESTONLY-native-deps', subject: 'native' });
      writeFileSync(join(r3Repo, 'docs/test-assurance-kernel/s3/predecessor-s2.json'), r3s2);
      writeFileSync(join(r3Repo, 'docs/test-assurance-kernel/s3/predecessor-s3.json'), r3s3);
      writeFileSync(join(r3Repo, 'docs/test-assurance-kernel/s3/predecessor-deps.json'), r3deps);
      const r3Ledger = okLedger({ evidenceComplete: true, declaredPendingEvidence: [], predecessors: {
        s2: { acceptedEvidence: { path: 'docs/test-assurance-kernel/s3/predecessor-s2.json', sha256: sha(r3s2) } },
        s3: { verdictRecord: { path: 'docs/test-assurance-kernel/s3/predecessor-s3.json', sha256: sha(r3s3) } },
      } });
      const r3Expected = frozenPositiveExpected({
        S2_CANONICAL_ACCEPTED: { admission: 'ACCEPTED_FOR_ITS_EXACT_COVERED_SUBJECT_ONLY', head: r3Accepted, tree: r3Tree, producerPostimages: { 'scripts/test-assurance/verify.mjs': sha(r3verify) }, receipt: { path: 'docs/test-assurance-kernel/s3/predecessor-s2.json', sha256: sha(r3s2) }, dependenciesAndProfile: { path: 'docs/test-assurance-kernel/s3/predecessor-deps.json', sha256: sha(r3deps) } },
        S3_ACCEPTED_PREDECESSOR: { admission: 'ACCEPTED_NATIVE', acceptedVerdictRecord: { path: 'docs/test-assurance-kernel/s3/predecessor-s3.json', sha256: sha(r3s3) }, head: r3Accepted, sourceSubject: r3Accepted, dependencySubject: sha(r3deps) },
      });
      assert.deepEqual(validatePredecessors(r3Ledger, r3Repo, r3g, { expectedInputs: r3Expected }), { ok: true, problems: [] }, 'native baseline acceptance at the exact HEAD must be ok');
      // evidence-only descendant: one README commit under the evidence root keeps the SAME
      // acceptance ok (source/deps/record bindings unchanged) — the over-rejection is gone
      writeFileSync(join(r3Repo, 'docs/test-assurance-kernel/s3/README.md'), 'readme v2 evidence-only\n');
      assert.equal(r3ci(['add', '-A']).rc, 0);
      assert.equal(r3ci(['commit', '-q', '-m', 'evidence-only README update']).rc, 0, 'evidence-only commit failed');
      assert.notEqual(String(r3g(['rev-parse', 'HEAD']).stdout).trim(), r3Accepted, 'fixture must have moved HEAD past the accepted subject');
      const r3EvidenceOnly = validatePredecessors(r3Ledger, r3Repo, r3g, { expectedInputs: r3Expected });
      assert.deepEqual(r3EvidenceOnly, { ok: true, problems: [] }, `evidence-only descendant must keep coverage: ${r3EvidenceOnly.problems.join('|')}`);
      // changed scoped source after the accepted head refuses — coverage never carries a
      // changed producer forward on the same ancestry
      writeFileSync(join(r3Repo, 'scripts/test-assurance/s3.mjs'), 'module native v2 CHANGED\n');
      assert.equal(r3ci(['add', '-A']).rc, 0);
      assert.equal(r3ci(['commit', '-q', '-m', 'changed scoped source']).rc, 0, 'changed-source commit failed');
      const r3ChangedSrc = validatePredecessors(r3Ledger, r3Repo, r3g, { expectedInputs: r3Expected });
      assert.ok(!r3ChangedSrc.ok && r3ChangedSrc.problems.some((x) => x.includes('is not the current covered subject') && x.includes('scripts/test-assurance/s3.mjs')), r3ChangedSrc.problems.join('|'));
    } finally { rmSync(r3Repo, { recursive: true, force: true }); }
    // Root 973 R3-live-covered-subject-and-deps attacks (fixed caller context, candidate
    // payloads vary): (a) an UNBOUND candidate S2 proxy in the ledger never substitutes for
    // the independently accepted receipt…
    const proxyBody = JSON.stringify({ stage: 'S2', verdict: 'ACCEPTED', baseHead: ANCHORED_HEAD });
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/candidate-s2-proxy.json'), proxyBody);
    const proxyLedger = { ...accLedger, predecessors: { ...accLedger.predecessors, s2: { acceptedEvidence: { path: 'docs/test-assurance-kernel/s3/candidate-s2-proxy.json', sha256: sha(proxyBody) } } } };
    const proxyP = validatePredecessors(proxyLedger, tmp, realGit, { expectedInputs: frozenPredExpected });
    assert.ok(proxyP.problems.some((x) => x.includes('unbound candidate S2 proxy never substitutes')), proxyP.problems.join('|'));
    // (b) a CHANGED live producer (the Root dc236 counterexample: live 973-era verify.mjs vs
    // the accepted canonical footprint) refuses — reading the old commit's blob only rechecks
    // history and never covers changed live code…
    writeFileSync(join(tmp, 'scripts/test-assurance/verify.mjs'), `${verifyBlob}\n// CHANGED LIVE PRODUCER\n`);
    const changedLiveP = validatePredecessors(accLedger, tmp, realGit, { expectedInputs: frozenPredExpected });
    assert.ok(changedLiveP.problems.some((x) => x.includes('does not cover changed live code')), changedLiveP.problems.join('|'));
    writeFileSync(join(tmp, 'scripts/test-assurance/verify.mjs'), verifyBlob);
    // (c) a STALE accepted S3 subject (E89-era head against the current line) refuses, and a
    // dependencySubject that is not the readable dependency closure refuses.
    const OLD_HEAD = 'e89d47adac73cbe0b2565a30c1a9edc5c4ac3d6a';
    const s3OldBody = JSON.stringify({ stage: 'S3', verdict: 'ACCEPTED', head: OLD_HEAD });
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/predecessor-s3-old.json'), s3OldBody);
    const oldLedger = { ...accLedger, predecessors: { ...accLedger.predecessors, s3: { verdictRecord: { path: 'docs/test-assurance-kernel/s3/predecessor-s3-old.json', sha256: sha(s3OldBody) } } } };
    const staleP = validatePredecessors(oldLedger, tmp, realGit, { expectedInputs: frozenPositiveExpected({
      S2_CANONICAL_ACCEPTED: frozenPredExpected.facts.S2_CANONICAL_ACCEPTED,
      S3_ACCEPTED_PREDECESSOR: { ...frozenPredExpected.facts.S3_ACCEPTED_PREDECESSOR, acceptedVerdictRecord: { path: 'docs/test-assurance-kernel/s3/predecessor-s3-old.json', sha256: sha(s3OldBody) }, head: OLD_HEAD, sourceSubject: OLD_HEAD },
    }) });
    assert.ok(staleP.problems.some((x) => x.includes('is not the current covered subject')), staleP.problems.join('|'));
    const staleDepsP = validatePredecessors(accLedger, tmp, realGit, { expectedInputs: frozenPositiveExpected({
      S2_CANONICAL_ACCEPTED: frozenPredExpected.facts.S2_CANONICAL_ACCEPTED,
      S3_ACCEPTED_PREDECESSOR: { ...frozenPredExpected.facts.S3_ACCEPTED_PREDECESSOR, dependencySubject: 'OLD-DEPENDENCY-CLOSURE' },
    }) });
    assert.ok(staleDepsP.problems.some((x) => x.includes('stale dependency coverage refuses') || x.includes('does not equal the readable dependency closure')), staleDepsP.problems.join('|'));
    // the SAME author-ACCEPTED chain under the owner-shaped map (accepted S3 MISSING)
    // refuses: an author-authored ACCEPTED JSON never substitutes for independent acceptance
    const r3OwnerP = validatePredecessors(accLedger, tmp, realGit, { expectedInputs: frozenOwnerShapeExpected() });
    assert.ok(!r3OwnerP.ok && r3OwnerP.problems.some((x) => x.includes('author-authored ACCEPTED verdict record never substitutes') || x.includes('accepted S3 predecessor as MISSING')), r3OwnerP.problems.join('|'));
    // and without the independent descriptor the ordered chain fails closed
    const r3NoExp = validatePredecessors(accLedger, tmp, realGitHistorical);
    assert.ok(!r3NoExp.ok && r3NoExp.problems.some((x) => x.includes('no independently selected expected inputs')), r3NoExp.problems.join('|'));
    // a CHANGED producer postimage (different bytes pinned by the independent descriptor
    // than the anchored commit actually carries) refuses — changed deps/producer never passes
    const r3ChangedP = validatePredecessors(accLedger, tmp, realGit, { expectedInputs: frozenPositiveExpected({
      S2_CANONICAL_ACCEPTED: { admission: 'ACCEPTED_FOR_ITS_EXACT_COVERED_SUBJECT_ONLY', head: ANCHORED_HEAD, tree: anchoredTree, producerPostimages: { 'scripts/test-assurance/verify.mjs': hex64('e') }, receipt: { path: 'docs/test-assurance-kernel/s3/predecessor-s2.json', sha256: sha(s2AccBody) }, dependenciesAndProfile: { path: 'docs/test-assurance-kernel/s3/predecessor-deps.json', sha256: sha(predDepsBody) } },
      S3_ACCEPTED_PREDECESSOR: { admission: 'ACCEPTED_NATIVE', acceptedVerdictRecord: { path: 'docs/test-assurance-kernel/s3/predecessor-s3.json', sha256: sha(s3AccBody) }, head: liveHeadNow, sourceSubject: liveHeadNow, dependencySubject: sha(predDepsBody) },
    }) });
    assert.ok(!r3ChangedP.ok && r3ChangedP.problems.some((x) => x.includes('does not match the independently pinned bytes — changed producer or dependencies refuse')), r3ChangedP.problems.join('|'));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// ---------- ROOT-S4-R6: measured-code / evidence-only binding (REAL git) ----------
test('ROOT-S4-R6: evidence-only descendant with identical scoped source passes; a source change stays RED (real git)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 's3-r6-'));
  const g = (args) => spawnSync('git', ['-C', tmp, ...args], { encoding: 'utf8' });
  const gitFn = (args) => {
    const r = g(['-c', 'user.email=tak@local', '-c', 'user.name=tak', ...args]);
    return { rc: r.status ?? 1, stdout: Buffer.from(r.stdout ?? ''), stderr: r.stderr };
  };
  try {
    g(['init', '-q']);
    mkdirSync(join(tmp, 'scripts/test-assurance'), { recursive: true });
    writeFileSync(join(tmp, 'scripts/test-assurance/s3.mjs'), 'module v1\n');
    writeFileSync(join(tmp, 'scripts/test-assurance/s3.test.mjs'), 'test v1\n');
    assert.equal(gitFn(['add', '-A']).rc, 0);
    assert.equal(gitFn(['commit', '-q', '-m', 'measured code']).rc, 0, 'commit failed');
    const measured = g(['rev-parse', 'HEAD']).stdout.trim();
    // evidence-only descendant: adds ONLY an s3 evidence file
    mkdirSync(join(tmp, 'docs/test-assurance-kernel/s3'), { recursive: true });
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/log.json'), '{"note":"evidence"}\n');
    assert.equal(gitFn(['add', '-A']).rc, 0);
    assert.equal(gitFn(['commit', '-q', '-m', 'evidence only']).rc, 0);
    // scoped source = the exact s3 module/test names (this scratch repo has no verify.mjs)
    const ledger = okLedger({ modifiedPaths: [] });
    const eqOk = codeScopeEquivalent((a) => gitFn(a), measured, ledger);
    assert.equal(eqOk.ok, true, eqOk.reason);
    // source change after measurement -> RED
    writeFileSync(join(tmp, 'scripts/test-assurance/s3.mjs'), 'module v2 TAMPERED\n');
    assert.equal(gitFn(['add', '-A']).rc, 0);
    assert.equal(gitFn(['commit', '-q', '-m', 'source change']).rc, 0);
    const eqBad = codeScopeEquivalent((a) => gitFn(a), measured, ledger);
    assert.equal(eqBad.ok, false);
    // the production consumer reports the STRONGEST correct reason first: a changed source
    // path appears in the range diff as a non-evidence change before the scoped-blob arm.
    assert.ok(/non-evidence changes after the measured head|differs between the measured head and HEAD/.test(eqBad.reason), eqBad.reason);
    // and a fabricated head that never existed refuses too
    const eqGhost = codeScopeEquivalent((a) => gitFn(a), hex40('f'), ledger);
    assert.equal(eqGhost.ok, false);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// ---------- ROOT-S3-R2: fixed historical obligations + typed CI ----------
test('ROOT-S3-R2: an emptied coverage registry and absent/failed CI can never close obligations', () => {
  const tmp = mkdtempSync(join(tmpdir(), 's3-r2-'));
  try {
    mkdirSync(join(tmp, 'docs/test-assurance-kernel/s3'), { recursive: true });
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/coverage.json'), JSON.stringify({ historicalOpen: [] }));
    const steps = buildStageSteps('S3', { repoRoot: tmp, runFn: () => ({ rc: 0, stdout: Buffer.from('') }), gitEnv: null });
    const r = steps.find(([id]) => id === 's3-final-acceptance')[1]();
    assert.equal(r.status, 'RED');
    assert.ok(r.msg.includes('required historical obligation s0-12-raw-logs MISSING'), r.msg);
    assert.ok(r.msg.includes('cf37-broad-fixture'), r.msg);
    // a closed label without structured closure evidence is not closure
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/coverage.json'), JSON.stringify({
      historicalOpen: [
        { id: 's0-12-raw-logs', status: 'closed' },
        { id: 'cf37-broad-fixture', status: 'closed' },
        { id: 'rule-538-target-430.4', status: 'closed' },
        { id: 'ci', status: 'closed' },
      ],
    }));
    const r2 = steps.find(([id]) => id === 's3-final-acceptance')[1]();
    assert.ok(r2.msg.includes('closure refused') && r2.msg.includes('closure evidence must be a pinned artifact'), r2.msg);
    // R2 semantic closure (Root978): a SHA-CORRECT body that names no obligation — even one
    // explicitly stating it is not evidence — closes nothing; obligation-specific content and
    // ORIGINAL denominators are required. TEST-ONLY synthetic records in os.tmpdir().
    const irr = JSON.stringify({ note: 'THIS IS NOT A REVIEW — SHA-correct saturation text that carries no obligation content' });
    const irrRel = 'docs/test-assurance-kernel/s3/closure-irrelevant.json';
    writeFileSync(join(tmp, irrRel), irr);
    const irrItem = { id: 's0-12-raw-logs', status: 'closed', closureEvidence: { path: irrRel, sha256: sha(irr) } };
    const irrProblems = validateHistoricalClosure(irrItem, tmp, null);
    assert.ok(irrProblems.some((x) => x.includes('irrelevant or shared body never discharges')), irrProblems.join('|'));
    // shared substitution: the same closure body under a DIFFERENT obligation id refuses
    const okClosureBody = JSON.stringify({ obligationId: 'cf37-broad-fixture', originalObservation: 'RED' });
    const sharedRel = 'docs/test-assurance-kernel/s3/closure-shared.json';
    writeFileSync(join(tmp, sharedRel), okClosureBody);
    const shared = validateHistoricalClosure({ id: 's0-12-raw-logs', status: 'closed', closureEvidence: { path: sharedRel, sha256: sha(okClosureBody) } }, tmp, null);
    assert.ok(shared.some((x) => x.includes('names obligation') && x.includes('irrelevant or shared body')), shared.join('|'));
    // positive per-obligation subpredicates (explicitly TESTONLY synthetic bodies — they prove
    // the accept predicate is reachable, never that real history is discharged). Root56810c70:
    // the positives are now CONDITIONAL matches against the FROZEN independent expected map
    // (declared above, outside this fixture); the current owner-shaped map refuses everything.
    // (1) s0-12-raw-logs: twelve HEX64 ids 1:1 with the frozen genuine original raw pins.
    const s0RawBodies = Array.from({ length: 12 }, (_, i) => `ORIGINAL-${i} genuine raw capture\n`);
    const s0Pins = s0RawBodies.map((b) => sha(b));
    const s0Arts = s0RawBodies.map((b, i) => ({ path: `docs/test-assurance-kernel/s3/ORIGINAL-${i}.log`, sha256: sha(b) }));
    const accBody = JSON.stringify({ stage: 'S0', rawLogIds: s0Pins, sourceHead: ANCHORED_HEAD, rawArtifacts: s0Arts });
    const accRel = 'docs/test-assurance-kernel/s3/s0-original-acceptance.json';
    writeFileSync(join(tmp, accRel), accBody);
    const s0Expected = frozenPositiveExpected({ HISTORICAL_S0_12: { admission: 'RETRIEVED_NATIVE', genuineOriginalRetrievedRawPins: s0Pins, originalAcceptance: { path: accRel, sha256: sha(accBody) }, originalSourceHead: ANCHORED_HEAD, rawArtifacts: s0Arts } });
    const s0Body = JSON.stringify({ obligationId: 's0-12-raw-logs', retrievalKind: 'native-retrieval', rawLogIds: s0Pins, originalAcceptance: { path: accRel, sha256: sha(accBody) } });
    const s0Rel = 'docs/test-assurance-kernel/s3/s0-closure.json';
    writeFileSync(join(tmp, s0Rel), s0Body);
    // Root 973 R2-original-raws-and-source, ABSENT-raws arm FIRST (the twelve raw files are
    // deliberately NOT yet written): with the CORRECT original pin, claimed retrieval without
    // actual readable bytes discharges nothing.
    const s0NoRawP = validateHistoricalClosure({ id: 's0-12-raw-logs', status: 'closed', closureEvidence: { path: s0Rel, sha256: sha(s0Body) } }, tmp, { expectedInputs: s0Expected });
    assert.ok(s0NoRawP.some((x) => x.includes('never prove retrieval')), s0NoRawP.join('|'));
    // ...and matching 12 SHA STRINGS in a DIFFERENT substituted originalAcceptance refuses —
    // strings alone never prove retrieval (the Root probe's CANDIDATE-REPLACED-ORIGINAL).
    const fakeAccBody = JSON.stringify({ rawLogIds: s0Pins, sourceHead: realGit(['rev-parse', 'HEAD']).stdout.toString().trim(), originalSource: 'DIFFERENT AUTHOR SOURCE' });
    const fakeAccRel = 'docs/test-assurance-kernel/s3/s0-candidate-replaced-original.json';
    writeFileSync(join(tmp, fakeAccRel), fakeAccBody);
    const s0Fake = JSON.stringify({ obligationId: 's0-12-raw-logs', retrievalKind: 'native-retrieval', rawLogIds: s0Pins, originalAcceptance: { path: fakeAccRel, sha256: sha(fakeAccBody) } });
    const s0FakeRel = 'docs/test-assurance-kernel/s3/s0-closure-fake.json';
    writeFileSync(join(tmp, s0FakeRel), s0Fake);
    const s0FakeP = validateHistoricalClosure({ id: 's0-12-raw-logs', status: 'closed', closureEvidence: { path: s0FakeRel, sha256: sha(s0Fake) } }, tmp, { expectedInputs: s0Expected });
    assert.ok(s0FakeP.some((x) => x.includes('substituted author-side original record refuses')), s0FakeP.join('|'));
    // only NOW the twelve genuine original raw bytes exist — the conditional positive matches.
    s0Arts.forEach((a, i) => writeFileSync(join(tmp, a.path), s0RawBodies[i]));
    assert.deepEqual(validateHistoricalClosure({ id: 's0-12-raw-logs', status: 'closed', closureEvidence: { path: s0Rel, sha256: sha(s0Body) } }, tmp, { expectedInputs: s0Expected }), [], 'conditional positive under the frozen expected map must reach the accept predicate');
    // ...twelve SUBSTITUTED fresh ids refuse (against the frozen genuine pins, with the
    // caller expected context held FIXED)
    const s0Sub = JSON.parse(s0Body); s0Sub.rawLogIds = Array.from({ length: 12 }, (_, i) => hex64('b').slice(0, 62) + String(i + 1).padStart(2, '0'));
    writeFileSync(join(tmp, s0Rel), JSON.stringify(s0Sub));
    const s0SubP = validateHistoricalClosure({ id: 's0-12-raw-logs', status: 'closed', closureEvidence: { path: s0Rel, sha256: sha(JSON.stringify(s0Sub)) } }, tmp, { expectedInputs: s0Expected });
    assert.ok(s0SubP.some((x) => x.includes('do not match the original acceptance record') || x.includes('do not match the independently selected genuine original raw pins')), s0SubP.join('|'));
    // ...and the owner-shaped map (NOT_RETRIEVED, empty pins) refuses author-listed ids:
    // arbitrary matching IDs without genuine original byte acquisition discharge nothing.
    const s0OwnerP = validateHistoricalClosure({ id: 's0-12-raw-logs', status: 'closed', closureEvidence: { path: s0Rel, sha256: sha(JSON.stringify(s0Sub)) } }, tmp, { expectedInputs: frozenOwnerShapeExpected() });
    assert.ok(s0OwnerP.some((x) => x.includes('record the original s0-12 raws as NOT_RETRIEVED') && x.includes('discharge nothing')), s0OwnerP.join('|'));
    // (2) cf37-broad-fixture: the invented tak.owner.rebaseline-ruling success branch is
    // REMOVED (Root56810c70) — the only rebaseline authority is an explicit admission in the
    // independent expected inputs. The Owner-E89 counterexample (a fabricated owner ruling
    // artifact previously produced zero problems) now refuses.
    const rulingBody = JSON.stringify({ schema: 'tak.owner.rebaseline-ruling/v1', obligationId: 'cf37-broad-fixture', rebaseline: true });
    const rulingRel = 'docs/test-assurance-kernel/s3/cf37-ruling.json';
    writeFileSync(join(tmp, rulingRel), rulingBody);
    const cf37Body = JSON.stringify({ obligationId: 'cf37-broad-fixture', originalObservation: 'RED', originalFixtureSha256: ORIGINAL_FIXTURE_SHA256.fallback, ruling: { path: rulingRel, sha256: sha(rulingBody) } });
    const cf37Rel = 'docs/test-assurance-kernel/s3/cf37-closure.json';
    writeFileSync(join(tmp, cf37Rel), cf37Body);
    // the invented owner-schema ruling artifact under the owner-shaped map REFUSES — no
    // rebaseline/waiver authority exists (decision R2-invented-cf37-rebaseline-owner-schema)
    const cf37Fabricated = validateHistoricalClosure({ id: 'cf37-broad-fixture', status: 'closed', closureEvidence: { path: cf37Rel, sha256: sha(cf37Body) } }, tmp, { expectedInputs: frozenOwnerShapeExpected() });
    assert.ok(cf37Fabricated.some((x) => x.includes('no in-original-spec duty evidence is admitted')), cf37Fabricated.join('|'));
    // Root 973 sameRoundConformanceNote: the REBASED_NATIVE/authorizedRebaselineOrWaiver path is
    // REMOVED — no cf37/538 waiver exists. The conditional positive closes ONLY through the
    // ORIGINAL-spec duty evidence: the independently pinned retained RED observation record
    // with its exact original fixture sha, never a waiver flag.
    const cf37Authorized = JSON.stringify({ obligationId: 'cf37-broad-fixture', originalObservation: 'RED', originalFixtureSha256: ORIGINAL_FIXTURE_SHA256.fallback });
    writeFileSync(join(tmp, cf37Rel), cf37Authorized);
    const dutyRel = 'docs/test-assurance-kernel/s3/cf37-original-duty.json';
    const dutyBody = JSON.stringify({ obligationId: 'cf37-broad-fixture', originalObservation: 'RED', originalFixtureSha256: ORIGINAL_FIXTURE_SHA256.fallback });
    writeFileSync(join(tmp, dutyRel), dutyBody);
    assert.deepEqual(validateHistoricalClosure({ id: 'cf37-broad-fixture', status: 'closed', closureEvidence: { path: cf37Rel, sha256: sha(cf37Authorized) } }, tmp, { expectedInputs: frozenPositiveExpected({ HISTORICAL_CF37: { admission: 'OBSERVED_RED_RETAINED', originalDutyClosure: { path: dutyRel, sha256: sha(dutyBody) } } }) }), [], 'duty-evidence conditional positive must match (no waiver flag exists)');
    // a waiver flag alone (no duty record) is NOT original-spec evidence and refuses
    assert.ok(validateHistoricalClosure({ id: 'cf37-broad-fixture', status: 'closed', closureEvidence: { path: cf37Rel, sha256: sha(cf37Authorized) } }, tmp, { expectedInputs: frozenPositiveExpected({ HISTORICAL_CF37: { admission: 'OBSERVED_RED_RETAINED', authorizedRebaselineOrWaiver: true } }) }).some((x) => x.includes('lack the pinned ORIGINAL cf37 duty-closure record')), 'waiver flag must not close cf37');
    // a dated substitute fixture sha keeps refusing regardless of the duty map
    const cf37Dated = JSON.stringify({ obligationId: 'cf37-broad-fixture', originalObservation: 'RED', originalFixtureSha256: '6'.repeat(64) });
    writeFileSync(join(tmp, cf37Rel), cf37Dated);
    assert.ok(validateHistoricalClosure({ id: 'cf37-broad-fixture', status: 'closed', closureEvidence: { path: cf37Rel, sha256: sha(cf37Dated) } }, tmp, { expectedInputs: frozenPositiveExpected({ HISTORICAL_CF37: { admission: 'OBSERVED_RED_RETAINED', originalDutyClosure: { path: dutyRel, sha256: sha(dutyBody) } } }) }).some((x) => x.includes('ORIGINAL cf37 fixture sha')));
    // (3) ci: closes only through a typed ci-record receipt AND the independently selected
    // actual required-check acquisition pin — never through a coverage-side label or a local
    // schema copy (final CI is NOT_STARTED in the owner-shaped map).
    const ciBody = JSON.stringify({ obligationId: 'ci', kind: 'ci-record' });
    const ciRel = 'docs/test-assurance-kernel/s3/ci-closure.json';
    writeFileSync(join(tmp, ciRel), ciBody);
    const ciExpected = frozenPositiveExpected({ FINAL_CI: { admission: 'ACQUIRED_NATIVE', actualRequiredCheckAcquisition: { path: ciRel, sha256: sha(ciBody) } } });
    assert.deepEqual(validateHistoricalClosure({ id: 'ci', status: 'closed', closureEvidence: { path: ciRel, sha256: sha(ciBody) } }, tmp, { expectedInputs: ciExpected }), [], 'conditional positive must match the frozen acquisition pin exactly');
    const ciOwnerP = validateHistoricalClosure({ id: 'ci', status: 'closed', closureEvidence: { path: ciRel, sha256: sha(ciBody) } }, tmp, { expectedInputs: frozenOwnerShapeExpected() });
    assert.ok(ciOwnerP.some((x) => x.includes('record final CI as NOT_STARTED') && x.includes('no actual required-check acquisition')), ciOwnerP.join('|'));
    const ciWrong = JSON.stringify({ obligationId: 'ci', kind: 'spec-review' });
    writeFileSync(join(tmp, ciRel), ciWrong);
    assert.ok(validateHistoricalClosure({ id: 'ci', status: 'closed', closureEvidence: { path: ciRel, sha256: sha(ciWrong) } }, tmp, { expectedInputs: ciExpected }).some((x) => x.includes('not a typed ci-record receipt')));
    // (4) rule-538-to-430.4: ORIGINAL denominators + a measured median under target bound to
    // an accepted matrix. TESTONLY: synthetic 400ms medians on a fully bound fixture.
    const rHead = realGit(['rev-parse', 'HEAD']).stdout.toString().trim();
    const rTree = realGit(['rev-parse', 'HEAD^{tree}']).stdout.toString().trim();
    const rb = buildBoundPerf(tmp, rHead, { optimizedTree: rTree });
    for (const c of rb.perf.cells) if (c.workload === 'rule' && c.role === 'optimized') c.wallMs = 400;
    rb.journal.cells.forEach((c) => { if (c.workload === 'rule' && c.role === 'optimized') c.wallMs = 400; });
    rb.rawIndex.cells.forEach((c) => { if (c.workload === 'rule' && c.role === 'optimized') c.wallMs = 400; });
    const rbJournalBytes = JSON.stringify(rb.journal);
    writeFileSync(join(tmp, rb.journalRel), rbJournalBytes);
    rb.rawIndex.campaign.journalSha256 = sha(rbJournalBytes);
    writeFileSync(join(tmp, 'docs/test-assurance-kernel/s3/raw-index.json'), JSON.stringify(rb.rawIndex));
    const perfBytes = JSON.stringify(rb.perf);
    writeFileSync(join(tmp, S3_PERF_REL), perfBytes);
    // Root56810c70: the rule-538 positive is conditional on the INDEPENDENT admission (both
    // the rule fact and the underlying matrix qualification) — frozen here over the owned
    // fixture bytes before the attacks below vary the candidate payloads.
    const rule538Expected = frozenPositiveExpected({
      S3_PERFORMANCE: { admission: 'QUALIFIED_NATIVE_GREEN', ...frozenPerfPins(tmp, rb.journalRel) },
      HISTORICAL_RULE538: { admission: 'MET_NATIVE', originalMedianMs: 538, targetMs: 430.4 },
    });
    const ruleOk = JSON.stringify({ obligationId: 'rule-538-to-430.4', originalMedianMs: 538, targetMs: 430.4, measuredMedianMs: 400, performanceRecord: { path: S3_PERF_REL, sha256: sha(perfBytes) } });
    const ruleRel = 'docs/test-assurance-kernel/s3/rule-closure.json';
    writeFileSync(join(tmp, ruleRel), ruleOk);
    assert.deepEqual(validateHistoricalClosure({ id: 'rule-538-to-430.4', status: 'closed', closureEvidence: { path: ruleRel, sha256: sha(ruleOk) } }, tmp, { git: realGit, expectedInputs: rule538Expected }), [], 'TESTONLY 400ms median under the frozen 430.4 target must reach the conditional accept predicate');
    // the owner-shaped map records rule-538 UNMET at the observed 1079ms — an author-stated
    // 400ms median can NEVER discharge it while the independent fact says unmet
    const ruleOwnerP = validateHistoricalClosure({ id: 'rule-538-to-430.4', status: 'closed', closureEvidence: { path: ruleRel, sha256: sha(ruleOk) } }, tmp, { git: realGit, expectedInputs: frozenOwnerShapeExpected({ S3_PERFORMANCE: { admission: 'OBSERVED_UNQUALIFIED_RED', qualifiedOriginalFourFixtureCampaign: false, ...frozenPerfPins(tmp, rb.journalRel) } }) });
    assert.ok(ruleOwnerP.some((x) => x.includes('record rule-538 as UNMET') && x.includes('regardless of any author-stated median')), ruleOwnerP.join('|'));
    // invented denominators refuse even with the matrix bound and the admission positive
    const ruleBad = JSON.stringify({ obligationId: 'rule-538-to-430.4', originalMedianMs: 600, targetMs: 500, measuredMedianMs: 400, performanceRecord: { path: S3_PERF_REL, sha256: sha(perfBytes) } });
    writeFileSync(join(tmp, ruleRel), ruleBad);
    assert.ok(validateHistoricalClosure({ id: 'rule-538-to-430.4', status: 'closed', closureEvidence: { path: ruleRel, sha256: sha(ruleBad) } }, tmp, { git: realGit, expectedInputs: rule538Expected }).some((x) => x.includes('ORIGINAL frozen denominators')));
    // and the honest current state: the MEASURED 1079ms median does not meet 430.4 — open.
    const ruleHonest = JSON.stringify({ obligationId: 'rule-538-to-430.4', originalMedianMs: 538, targetMs: 430.4, measuredMedianMs: 1079, performanceRecord: { path: S3_PERF_REL, sha256: sha(perfBytes) } });
    writeFileSync(join(tmp, ruleRel), ruleHonest);
    assert.ok(validateHistoricalClosure({ id: 'rule-538-to-430.4', status: 'closed', closureEvidence: { path: ruleRel, sha256: sha(ruleHonest) } }, tmp, { git: realGit }).some((x) => x.includes('does not meet the original 430.4ms target')));
    // declared-but-absent CI receipt does not satisfy the CI branch
    const ledger = okLedger();
    ledger.s4EvidenceIndex.declaredPaths = [{ path: 'docs/test-assurance-kernel/s4/ci-record.json', kind: 'ci-record' }];
    writeFileSync(join(tmp, S3_LEDGER_REL), JSON.stringify(ledger));
    const r3 = steps.find(([id]) => id === 's3-final-acceptance')[1]();
    assert.ok(r3.msg.includes('declared ci-record absent'), r3.msg);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// ---------- poison control: consumer drift is caught at the boundary ----------
test('poison: a modified expected-verdict table cannot satisfy the consumer (drift caught)', () => {
  const poisoned = {
    pureMetricCases: [
      { id: 'ordinary-insufficient', kind: 'dominant', base: [1000, 1000, 1000], current: [801, 801, 801], expected: 'PASS' }, // flipped — must be RED
      { id: 'other-over1s', kind: 'other', base: [1000, 1000, 1000], current: [2001, 2001, 2001], expected: 'PASS' }, // flipped — must be RED
    ],
  };
  const rows = evaluatePureCases(poisoned);
  assert.ok(rows.some((r) => !r.ok), 'editing expected verdicts must be caught, not satisfied');
  // CLI grammar (packet-3): the paired data input is CONDITIONAL — an unpaired flag, a
  // mismatched pin and a correctly-paired EMPTY synthetic descriptor all refuse or stay
  // honestly RED through the REAL public CLI from the repository root; no arbitrary
  // caller-selected pair mints Root/S4 acceptance. The retained descriptor fixture is a
  // diagnostic artifact and is deliberately not cleaned up.
  const cliTmp = mkdtempSync(join(tmpdir(), 's3-cli-'));
  const descPath = join(cliTmp, 'expected-inputs.json');
  writeFileSync(descPath, JSON.stringify({ facts: {} }));
  const descSha = sha(readFileSyncCompat(descPath));
  const runCli = (args) => spawnSync(process.execPath, ['scripts/test-assurance/verify.mjs', ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
  const unpaired = runCli(['--stage', 'S4', '--expected-inputs', descPath]);
  assert.equal(unpaired.status, 3, `unpaired exit: ${unpaired.stderr}`);
  assert.ok(String(unpaired.stderr).includes('paired data input'), String(unpaired.stderr));
  const mismatched = runCli(['--stage', 'S4', '--expected-inputs', descPath, '--expected-inputs-sha256', hex64('e')]);
  assert.equal(mismatched.status, 3, `mismatched exit: ${mismatched.stderr}`);
  assert.ok(String(mismatched.stderr).includes('do not match the provided pin'), String(mismatched.stderr));
  const paired = runCli(['--stage', 'S4', '--expected-inputs', descPath, '--expected-inputs-sha256', descSha]);
  assert.equal(paired.status, 1, `paired S4 exit: ${paired.stdout}\n${paired.stderr}`);
  const pairedOut = `${paired.stdout}\n${paired.stderr}`;
  assert.ok(pairedOut.includes('NOT-ACCEPTED'), pairedOut);
  assert.ok(!pairedOut.includes('CONDITIONAL-DATA-PASS'), pairedOut);
});

// ---------- F5 / ROOT-S3-R5: TAP population ----------
test('F5 a marker-only text is not a TAP result set', () => {
  const t = parseCompanionTap('S3-COMPANION-OK\n');
  assert.equal(t.entries.length, 0);
  assert.equal(t.hasSummary, false);
});
test('F5 truncated TAP without summary is not accepted', () => {
  const t = parseCompanionTap('ok 1 first control\n');
  assert.equal(t.entries.length, 1);
  assert.equal(t.hasSummary, false);
});
test('F5 real TAP counts ok/notOk/skip/todo/cancel', () => {
  const t = parseCompanionTap(['TAP version 13', 'ok 1 good', 'not ok 2 bad', 'ok 3 # SKIP', 'ok 4 # TODO', 'not ok 5 # CANCEL', '# tests 5', '# pass 1', '# fail 1', '1..5'].join('\n'));
  assert.equal(t.entries.filter((e) => e.ok).length, 1);
  assert.equal(t.entries.filter((e) => !e.ok).length, 4); // bad + SKIP + TODO + CANCEL
  assert.equal(t.plan, 5);
  assert.equal(t.summary.tests, 5);
  assert.equal(t.hasSummary, true);
});
test('F5 an empty selector is not a green companion', () => {
  const t = parseCompanionTap('');
  assert.equal(t.entries.length, 0);
  assert.equal(t.hasSummary, false);
});
test('ROOT-S3-R5: one-ok subset with plan25/summary25 refuses (identity population is bound)', () => {
  // Root counterexample: 'ok 1 only-one-control' + '1..25' + '# tests 25' + '# pass 25'.
  const tap = parseCompanionTap('TAP version 13\nok 1 only-one-control\n1..25\n# tests 25\n# pass 25\n# fail 0\n');
  const required = ['only-one-control', 'second-control', 'third-control'];
  const p = validateCompanionResult(tap, required);
  assert.ok(p.some((x) => x.includes('plan 25 != 1 parsed entries')), p.join('|'));
  assert.ok(p.some((x) => x.includes('required control identities missing')), p.join('|'));
  assert.ok(p.some((x) => x.includes('summary tests 25 != 1 parsed entries')), p.join('|'));
});
test('ROOT-S3-R5: duplicate identities, skipped entries and summary drift refuse', () => {
  const dup = parseCompanionTap('TAP version 13\nok 1 same-name\nok 2 same-name\n1..2\n# tests 2\n# pass 2\n# fail 0\n');
  const pd = validateCompanionResult(dup, ['same-name']);
  assert.ok(pd.some((x) => x.includes('duplicate test identities')), pd.join('|'));
  const skipped = parseCompanionTap('TAP version 13\nok 1 a-control\nok 2 b-control # SKIP\n1..2\n# tests 2\n# pass 1\n# skipped 1\n# fail 0\n');
  const ps = validateCompanionResult(skipped, ['a-control', 'b-control']);
  assert.ok(ps.some((x) => x.includes('failing/skipped/cancelled')), ps.join('|'));
  assert.ok(ps.some((x) => x.includes('summary skipped=1 must be zero')), ps.join('|'));
});
test('ROOT-S3-R5: a complete consistent TAP with the exact required population passes', () => {
  const tap = parseCompanionTap('TAP version 13\nok 1 a-control\nok 2 b-control\n1..2\n# tests 2\n# pass 2\n# fail 0\n# skipped 0\n# todo 0\n# cancelled 0\n');
  assert.deepEqual(validateCompanionResult(tap, ['a-control', 'b-control']), []);
});

// readFileSync helper local to this file (kept at the tail deliberately: single use site above)
import { readFileSync as readFileSyncTail } from 'node:fs';
const readFileSyncCompat = (p) => readFileSyncTail(p);

// ---------- 2026-11-01 upstream integration lineage controls (unit32 safe remainder) ----
// Meaningful good/bad controls for the reviewed upstream-lineage admission: every arm uses
// either the REAL committed carrier + realGit (healthy path, complete 571-row reconciliation
// against immutable objects) or fully synthetic carriers over a fake git runner — never a
// mutated live tree. TEST-ONLY fabrication in-memory/tmpdir; no evidence is authored here.
const upstreamRow = (i) => ({
  path: `upstream/fake-${i}.md`,
  mode: '100644',
  kind: 'blob',
  gitBlob: 'a'.repeat(36) + String(i).padStart(4, '0'),
  sha256: hex64('b'),
  bytes: 100 + i,
});
const syntheticCarrier = (mutations = {}) => {
  const rows = Array.from({ length: 571 }, (_, i) => upstreamRow(i));
  const carrier = {
    schema: 'tak.independent-upstream-integration-expectation-inputs/v1',
    sourceRefs: {
      originalS2Base: ORIGINAL_S2_BASE_HEAD,
      originalS2BaseTree: ORIGINAL_S2_BASE_TREE,
      upstreamStaging: UPSTREAM_STAGING_HEAD,
      upstreamStagingTree: UPSTREAM_STAGING_TREE,
      acceptedTopic: ACCEPTED_TOPIC_HEAD,
      acceptedTopicTree: ACCEPTED_TOPIC_TREE,
      actualPreservedIntegrationIndexTree: PRESERVED_INTEGRATION_INDEX_TREE,
    },
    currentLineageOnlyScope: {
      originalAcceptedTopicPaths: 4232,
      stagingPaths: 4475,
      integrationPathsBeforeNewAdmissionCarrier: 4803,
      newlyUpstreamOriginPaths: 571,
      exactUnionOfBothTips: true,
      removedOriginalOrStagingPaths: [],
      unexpectedBeyondBothTips: [],
      upstreamAdditions: rows,
    },
    p38IndependentPopulationRenewal: {
      originalFrozen30: Array.from({ length: 30 }, (_, i) => `skills/frozen-${i}.test.ts`),
      upstreamAdded9: Array.from({ length: 9 }, (_, i) => ({ path: `skills/added-${i}.test.ts` })),
      expectedCurrent39: [
        ...Array.from({ length: 30 }, (_, i) => `skills/frozen-${i}.test.ts`),
        ...Array.from({ length: 9 }, (_, i) => `skills/added-${i}.test.ts`),
      ].sort(),
      sourceSelector: 'synthetic control',
      requiredControls: 'synthetic control',
    },
    m04IndependentDefaultsRenewal: {
      originalCanonicalContractPath: 'docs/test-assurance-kernel/s2/m04-installed-contract/frozen-installed-contract.json',
      originalCanonicalContractSha256: 'a767888e2abe661f4ad38df11d70c3f95304137ecc59df314f92fb039432c1ad',
      originalRecordMustRemainUnchanged: true,
      profiles: ['ts-server', 'react-next', 'react-spa'].map((stack) => ({
        stack,
        source_template: `templates/${stack}/eslint.config.mjs`,
        originalAcceptedTopicSha256: hex64('1'),
        upstreamStagingSourceSha256: hex64('2'),
        independentlyDerivedUnionSha256: hex64('3'),
        exactRenewalDelta: 'synthetic control',
        nativeThreeWayUnionVerified: true,
      })),
      scope: 'synthetic control',
    },
    proposedOnlyNewCanonicalAdmissionCarrier: S2_REVIEWED_INTEGRATION_REL,
    sourceBindingDisposition: 'synthetic control',
    noS0Cf37PerformanceHistoryOrGlobalS3S4Waiver: true,
  };
  return { carrier, rows, ...mutations };
};
const fakeUpstreamGit = (rows, { ancestryOk = true, treeOk = true, sizeOverride } = {}) => (args) => {
  if (args[0] === 'merge-base') return { rc: ancestryOk ? 0 : 1, stdout: Buffer.from(''), stderr: Buffer.from('') };
  if (args[0] === 'ls-tree') {
    if (!treeOk) return { rc: 128, stdout: Buffer.from(''), stderr: Buffer.from('fatal: bad object') };
    return { rc: 0, stdout: Buffer.from(rows.map((r) => `${r.mode} ${r.kind} ${r.gitBlob}\t${r.path}`).join('\0')), stderr: Buffer.from('') };
  }
  if (args[0] === 'cat-file' && args[1] === '-s') {
    const row = rows.find((r) => r.gitBlob === args[2]);
    if (!row) return { rc: 128, stdout: Buffer.from(''), stderr: Buffer.from('fatal: Not a valid object') };
    return { rc: 0, stdout: Buffer.from(String(sizeOverride ?? row.bytes)), stderr: Buffer.from('') };
  }
  return { rc: 1, stdout: Buffer.from(''), stderr: Buffer.from('unexpected git call') };
};
test('UPSTREAM-LINEAGE: the pinned Root-reviewed carrier validates clean and loads byte-identical', () => {
  const loaded = loadReviewedIntegration(REPO_ROOT);
  assert.equal(loaded.absent, false);
  assert.equal(loaded.ok, true, loaded.problems?.join('|'));
  assert.deepEqual(validateReviewedIntegration(loaded.data), []);
  assert.equal(sha(readFileSyncTail(join(REPO_ROOT, S2_REVIEWED_INTEGRATION_REL))), S2_REVIEWED_INTEGRATION_SHA256);
});
test('UPSTREAM-LINEAGE: legacy no-integration behavior is unchanged when the carrier is absent', () => {
  // 2026-11-01 U33-RETENTION-1: this fixture (and the malformed-carrier one below) is a newly
  // added companion fixture — its directory is deliberately RETAINED (no rmSync teardown);
  // only the pre-existing teardowns elsewhere in this file are unchanged and allowed.
  const tmp = mkdtempSync(join(tmpdir(), 'tak-lineage-legacy-'));
  const loaded = loadReviewedIntegration(tmp);
  assert.equal(loaded.absent, true);
  assert.equal(loaded.ok, false);
  assert.deepEqual(loaded.problems, []);
  // The consumer maps absent => the exact legacy expectation formula (verify.mjs keeps
  // the no-carrier branch byte-identical to the pre-integration inventory math).
  const { carrier, rows } = syntheticCarrier();
  assert.deepEqual(reconcileUpstreamLineage({ repoRoot: tmp, git: fakeUpstreamGit(rows), carrier: { ok: true, data: carrier }, basePaths: [], additivePaths: [] }), []);
});
test('UPSTREAM-LINEAGE: an unknown extra or missing reviewed upstream path refuses', () => {
  const { carrier, rows } = syntheticCarrier();
  const missing = fakeUpstreamGit(rows.slice(1));
  const p1 = reconcileUpstreamLineage({ repoRoot: '.', git: missing, carrier: { ok: true, data: carrier } });
  assert.ok(p1.some((x) => x.includes('missing from the pinned upstream tree')), p1.join('|'));
  const dup = structuredClone(carrier);
  dup.currentLineageOnlyScope.upstreamAdditions[570] = { ...dup.currentLineageOnlyScope.upstreamAdditions[0] };
  const p2 = validateReviewedIntegration(dup);
  assert.ok(p2.some((x) => x.includes('invalid or duplicate upstream path')), p2.join('|'));
});
test('UPSTREAM-LINEAGE: forged/foreign upstream commit, tree, blob metadata and byte length refuse', () => {
  const { carrier, rows } = syntheticCarrier();
  const forgedBlob = structuredClone(rows);
  forgedBlob[3] = { ...forgedBlob[3], gitBlob: hex40('f'), mode: '100755' };
  const p1 = reconcileUpstreamLineage({ repoRoot: '.', git: fakeUpstreamGit(forgedBlob), carrier: { ok: true, data: carrier } });
  assert.ok(p1.some((x) => x.includes('blob metadata mismatch')), p1.join('|'));
  const p2 = reconcileUpstreamLineage({ repoRoot: '.', git: fakeUpstreamGit(rows, { sizeOverride: 424242 }), carrier: { ok: true, data: carrier } });
  assert.ok(p2.some((x) => x.includes('byte length mismatch')), p2.join('|'));
  const foreign = reconcileUpstreamLineage({ repoRoot: '.', git: fakeUpstreamGit(rows, { treeOk: false }), carrier: { ok: true, data: carrier } });
  assert.ok(foreign.some((x) => x.includes('cannot resolve the pinned upstream commit')), foreign.join('|'));
});
test('UPSTREAM-LINEAGE: swapped/duplicate admission against the historical scope refuses', () => {
  const { carrier, rows } = syntheticCarrier();
  const p = reconcileUpstreamLineage({ repoRoot: '.', git: fakeUpstreamGit(rows), carrier: { ok: true, data: carrier }, basePaths: [rows[7].path], additivePaths: [] });
  assert.ok(p.some((x) => x.includes('collides with the historical/additive scope')), p.join('|'));
});
test('UPSTREAM-LINEAGE: malformed or unpinned carrier admission refuses (sha/schema/tuple drift)', () => {
  // 2026-11-01 U33-RETENTION-1: newly added companion fixture — directory RETAINED, no rmSync.
  const tmp = mkdtempSync(join(tmpdir(), 'tak-lineage-drift-'));
  mkdirSync(join(tmp, 'docs/test-assurance-kernel/s2'), { recursive: true });
  const pinned = readFileSyncTail(join(REPO_ROOT, S2_REVIEWED_INTEGRATION_REL));
  const drifted = Buffer.from(pinned.toString('utf8').replace('"stagingPaths": 4475', '"stagingPaths": 4474'));
  writeFileSync(join(tmp, S2_REVIEWED_INTEGRATION_REL), drifted);
  const shaDrift = loadReviewedIntegration(tmp);
  assert.equal(shaDrift.ok, false);
  assert.ok(shaDrift.problems.some((x) => x.includes('drifted from the pinned Root review')), shaDrift.problems.join('|'));
  const { carrier } = syntheticCarrier();
  const badSchema = structuredClone(carrier);
  badSchema.schema = 'tak.evil/v9';
  assert.ok(validateReviewedIntegration(badSchema).some((x) => x.includes('unexpected carrier schema')));
  const badTuple = structuredClone(carrier);
  badTuple.sourceRefs.upstreamStaging = hex40('e');
  assert.ok(validateReviewedIntegration(badTuple).some((x) => x.includes('upstream staging tuple mismatch')));
  const badM04 = structuredClone(carrier);
  badM04.m04IndependentDefaultsRenewal.originalRecordMustRemainUnchanged = false;
  assert.ok(validateReviewedIntegration(badM04).some((x) => x.includes('original record to stay unchanged')));
});
test('UPSTREAM-LINEAGE: wrong ancestry refuses (bc8 not an ancestor of the candidate head)', () => {
  const { carrier, rows } = syntheticCarrier();
  const p = reconcileUpstreamLineage({ repoRoot: '.', git: fakeUpstreamGit(rows, { ancestryOk: false }), carrier: { ok: true, data: carrier }, head: 'HEAD' });
  assert.ok(p.some((x) => x.includes('must be an ancestor')), p.join('|'));
});
test('UPSTREAM-LINEAGE: producer-off inventory/lineage git failure is a refusal, never permissive green', () => {
  const { carrier, rows } = syntheticCarrier();
  const off = fakeUpstreamGit(rows, { treeOk: false });
  assert.ok(reconcileUpstreamLineage({ repoRoot: '.', git: off, carrier: { ok: true, data: carrier } }).length > 0);
  const deadSizes = (args) => (args[0] === 'cat-file' ? { rc: 128, stdout: Buffer.from(''), stderr: Buffer.from('fatal') } : fakeUpstreamGit(rows)(args));
  assert.ok(reconcileUpstreamLineage({ repoRoot: '.', git: deadSizes, carrier: { ok: true, data: carrier } }).some((x) => x.includes('byte length mismatch')));
  assert.ok(reconcileUpstreamLineage({ repoRoot: '.', git: fakeUpstreamGit(rows), carrier: { ok: false, data: carrier } }).some((x) => x.includes('requires a valid reviewed carrier')));
});
test('UPSTREAM-LINEAGE: healthy real-repo lineage reconciles the complete reviewed 571-row set', () => {
  const loaded = loadReviewedIntegration(REPO_ROOT);
  assert.equal(loaded.ok, true);
  const p = reconcileUpstreamLineage({ repoRoot: REPO_ROOT, git: realGit, carrier: loaded, head: 'HEAD', basePaths: [], additivePaths: [] });
  assert.deepEqual(p, [], p.join('|'));
});

// ---------- 2026-11-01 reviewed current transfer + portable historical reference ----------
// Fake git over an isolated fixture tree for reconcileCurrentTransfer. treeRows carry an
// optional .content Buffer served by `cat-file blob` (the three admitted replacements use
// the REAL repo file bytes so the content-sha arm exercises real hashing).
// The fixed-checkpoint (cd3) baseline ledger OBJECT and the five governed rows at their exact
// cd3 blob identities — fetched once from the REAL repository graph so fixture trees serve the
// same objects the production channel reads (unit-37 §3 paired-before/after-activation tests).
const CD3_LEDGER_BYTES = realGit(['cat-file', 'blob', `${CURRENT_TRANSFER_CHECKPOINT.head}:${S3_LEDGER_REL}`]).stdout;
const cd3GovernedRows = () => [...LEDGER_BINDING_ADDED_PATHS, ...LEDGER_BINDING_MODIFIED_PATHS, ...LEDGER_BINDING_NEW_MODIFIED_PATHS].map((path) => {
  const gitBlob = realGit(['rev-parse', `${CURRENT_TRANSFER_CHECKPOINT.head}:${path}`]).stdout.toString().trim();
  return { path, mode: '100644', kind: 'blob', gitBlob, content: realGit(['cat-file', 'blob', gitBlob]).stdout };
});
const CD3_LEDGER_GITBLOB = realGit(['rev-parse', `${CURRENT_TRANSFER_CHECKPOINT.head}:${S3_LEDGER_REL}`]).stdout.toString().trim();
const governedPaths = [...LEDGER_BINDING_ADDED_PATHS, ...LEDGER_BINDING_MODIFIED_PATHS, ...LEDGER_BINDING_NEW_MODIFIED_PATHS];
const governedContentMap = (rows) => new Map(governedPaths.map((p) => [p, rows.find((r) => r.path === p)?.content ?? Buffer.alloc(0)]));
// Root unit-38 F1: every fixture arm that exercises the ledger channel reads it from a FIXED
// root on disk (never the ambient live repo checkout), so the arms stay meaningful before
// AND after the canonical activation. Fixture roots are retained (no deletion primitive).
const fixtureLedgerRoot = (bytes) => {
  const root = mkdtempSync(join(tmpdir(), 'tak-ledger-root-'));
  mkdirSync(join(root, 'docs/test-assurance-kernel/s3'), { recursive: true });
  writeFileSync(join(root, S3_LEDGER_REL), bytes);
  return root;
};
let baselineLedgerRootDir = null;
const ensureBaselineLedgerRoot = () => (baselineLedgerRootDir ??= fixtureLedgerRoot(CD3_LEDGER_BYTES));
// An ACTIVATED-form fixture ledger over GIVEN governed contents: every pin binds exactly
// those bytes (hashes computed from the fixture data, never typed), plus exactly the two new
// modifiedPaths rows (path+sha256 only) — the honest finite admission shape.
const activatedLedgerFixture = (governedContents) => {
  const L = JSON.parse(CD3_LEDGER_BYTES.toString('utf8'));
  for (const row of L.addedPaths) if (LEDGER_BINDING_ADDED_PATHS.includes(row.path)) row.sha256 = sha(governedContents.get(row.path));
  L.modifiedPaths = L.modifiedPaths.map((row) => (LEDGER_BINDING_MODIFIED_PATHS.includes(row.path) ? { ...row, sha256: sha(governedContents.get(row.path)) } : row));
  L.modifiedPaths = [...L.modifiedPaths, ...LEDGER_BINDING_NEW_MODIFIED_PATHS.map((p) => ({ path: p, sha256: sha(governedContents.get(p)) }))];
  return Buffer.from(JSON.stringify(L));
};
// A pass-through runner wrapper pinning ONLY the live-HEAD ls-tree ledger row to the fixed
// cd3 baseline object (the Root probe's own bounded-adapter technique, kept as a permanent
// fixture): the R3 predecessor fixture becomes a coherent permanently-UNACTIVATED snapshot —
// disk baseline, committed baseline row, real governed live rows — so its pending oracle
// survives the canonical activation unchanged. Every other call passes through untouched.
const pinLiveLedgerRowToBaseline = (runner) => {
  const liveHead = runner(['rev-parse', 'HEAD']).stdout.toString().trim();
  return (args) => {
    const r = runner(args);
    if (args[0] !== 'ls-tree' || String(args[args.length - 1]) !== `${liveHead}^{tree}` || r.rc !== 0) return r;
    const pinned = r.stdout.toString('utf8').split('\0').filter(Boolean).map((e) => {
      const m = /^(\d+) (blob|tree|commit) ([0-9a-f]{40})\t(.*)$/s.exec(e);
      return m && m[4] === S3_LEDGER_REL ? `${m[1]} ${m[2]} ${CD3_LEDGER_GITBLOB}\t${m[4]}` : e;
    }).join('\0');
    return { ...r, stdout: Buffer.from(`${pinned}\0`) };
  };
};
// Root unit-49 (2026-11-03): the R3 fixture's coherent TESTONLY live ledger — the UNCHANGED
// cd3 baseline bytes plus EXACTLY the two optional guard modifiedPaths rows (fixed order,
// closed path+sha256 form, 64-hex pins derived at fixture-construction time from the ACTUAL
// COMMITTED live guard blobs — fixed fixture inputs with content-derived hashes, never an
// expected output taken from a production verdict). The cd3 baseline OBJECT keeps its exact
// bytes WITHOUT the rows; only this fixture copy carries them, so the two genuinely known
// guard changes bind as governed rows while the five original rows keep their unactivated
// cd3 pins and the honest finite pending class stays the ONLY refusal (Root unit-49 brief:
// repair the fixture, never the production refusal).
// Unit-66 repair: since the unit-64 narrowed mutation-loop skip, the changed helper
// (tests/consumer-matrix/own-config-cell.sh) genuinely enters the typed leg and hard-refuses
// without a governed binding - the SAME coherence gap unit-49 closed for the guard pair. The
// fixture therefore also carries the two optional SMOKE rows (workflow + helper), pins
// derived from the ACTUAL COMMITTED live blobs, so the typed workflow successor admission and
// the smoke-row helper binding both hold and the honest pending class stays the ONLY refusal.
const coherentUnactivatedLedgerBytes = () => {
  const L = JSON.parse(CD3_LEDGER_BYTES.toString('utf8'));
  L.modifiedPaths = [
    ...L.modifiedPaths,
    ...LEDGER_BINDING_OPTIONAL_GUARD_PATHS.map((p) => {
      const blob = realGit(['cat-file', 'blob', `HEAD:${p}`]);
      if (blob.rc !== 0) throw new Error(`fixture construction: committed live guard blob unreadable at HEAD:${p}`);
      return { path: p, sha256: sha(blob.stdout) };
    }),
    ...LEDGER_BINDING_OPTIONAL_SMOKE_PATHS.map((p) => {
      const blob = realGit(['cat-file', 'blob', `HEAD:${p}`]);
      if (blob.rc !== 0) throw new Error(`fixture construction: committed live smoke blob unreadable at HEAD:${p}`);
      return { path: p, sha256: sha(blob.stdout) };
    }),
  ];
  return Buffer.from(JSON.stringify(L));
};
// The synthetic blob id for fixture ledger bytes: the plain git blob hash computed locally
// (`blob <len>\0` + bytes). Deterministic, and NO object is ever written into the shared
// repository — the adapter below only SERVES these bytes for this one id.
const fixtureLedgerGitBlob = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
// A pass-through runner wrapper serving ONE fixture ledger blob consistently: the live-HEAD
// ls-tree ledger row is rewritten to the fixture blob id AND `cat-file blob <that id>`
// returns the exact fixture bytes, so the production disk/committed identity check holds —
// the fixture disk ledger and the committed live-tree row are the SAME bytes/object identity.
// Every unrelated call (including the real cd3 baseline reads by checkpoint head) passes
// through untouched.
const pinLiveLedgerRowToBytes = (runner, bytes, gitBlob) => {
  const liveHead = runner(['rev-parse', 'HEAD']).stdout.toString().trim();
  return (args) => {
    if (args[0] === 'cat-file' && args[1] === 'blob' && args[2] === gitBlob) {
      return { rc: 0, stdout: bytes, stderr: Buffer.from('') };
    }
    const r = runner(args);
    if (args[0] !== 'ls-tree' || String(args[args.length - 1]) !== `${liveHead}^{tree}` || r.rc !== 0) return r;
    const pinned = r.stdout.toString('utf8').split('\0').filter(Boolean).map((e) => {
      const m = /^(\d+) (blob|tree|commit) ([0-9a-f]{40})\t(.*)$/s.exec(e);
      return m && m[4] === S3_LEDGER_REL ? `${m[1]} ${m[2]} ${gitBlob}\t${m[4]}` : e;
    }).join('\0');
    return { ...r, stdout: Buffer.from(`${pinned}\0`) };
  };
};
const fakeTransferGit = (treeRows, { treeOf = CURRENT_TRANSFER_CHECKPOINT.tree, parentLine = CURRENT_TRANSFER_CHECKPOINT.parent, ancOk = true, treeOk = true, liveRows = null, baselineRows = null, topicRows = null, ancHeadOk = null } = {}) => (args) => {
  if (args[0] === 'rev-parse') {
    if (String(args[1]).endsWith('^{tree}')) return { rc: treeOk ? 0 : 128, stdout: Buffer.from(treeOk ? treeOf : ''), stderr: Buffer.from(treeOk ? '' : 'fatal: bad object') };
    return { rc: 0, stdout: Buffer.from(hex40('a')), stderr: Buffer.from('') };
  }
  if (args[0] === 'log') return { rc: 0, stdout: Buffer.from(parentLine), stderr: Buffer.from('') };
  if (args[0] === 'merge-base') {
    const headArm = args[3] === hex40('a'); // the fake live-HEAD hex returned by rev-parse HEAD
    const ok = headArm && ancHeadOk !== null ? ancHeadOk : ancOk;
    return { rc: ok ? 0 : 1, stdout: Buffer.from(''), stderr: Buffer.from('') };
  }
  if (args[0] === 'ls-tree') {
    const target = String(args[args.length - 1]);
    let rows = treeRows;
    if (target === CURRENT_TRANSFER_CHECKPOINT.tree) rows = treeRows;
    else if (target === CURRENT_TRANSFER_CHECKPOINT.parent) rows = baselineRows ?? treeRows;
    else if (target === ACCEPTED_TOPIC_HEAD) rows = topicRows ?? treeRows;
    else rows = liveRows ?? treeRows;
    return { rc: treeOk ? 0 : 128, stdout: Buffer.from(rows.map((r) => `${r.mode} ${r.kind} ${r.gitBlob}\t${r.path}`).join('\0')), stderr: Buffer.from(treeOk ? '' : 'fatal: bad object') };
  }
  if (args[0] === 'cat-file' && args[1] === 'blob') {
    if (args[2] === `${CURRENT_TRANSFER_CHECKPOINT.head}:${S3_LEDGER_REL}`) return { rc: 0, stdout: CD3_LEDGER_BYTES, stderr: Buffer.from('') };
    const row = [...treeRows, ...(liveRows ?? [])].find((r) => r.gitBlob === args[2]);
    if (!row?.content) return { rc: 128, stdout: Buffer.from(''), stderr: Buffer.from('fatal: bad object') };
    return { rc: 0, stdout: row.content, stderr: Buffer.from('') };
  }
  return { rc: 1, stdout: Buffer.from(''), stderr: Buffer.from('unexpected git call') };
};
// A bad-but-otherwise-valid isolated fixture: healthy synthetic carrier whose first three
// rows are the REAL admitted replacements (real checkpoint gitBlobs + real repo bytes), and
// row 10's tree blob is quietly swapped — intact provenance everywhere except one object.
const transferFixture = () => {
  const { carrier, rows } = syntheticCarrier();
  const treeRows = rows.map((r) => ({ ...r }));
  ADMITTED_CURRENT_REPLACEMENTS.forEach((rep, i) => {
    const content = readFileSync(join(REPO_ROOT, rep.path));
    treeRows[i] = { path: rep.path, mode: '100644', kind: 'blob', gitBlob: rep.gitBlob, content };
    carrier.currentLineageOnlyScope.upstreamAdditions[i] = { path: rep.path, mode: '100644', kind: 'blob', gitBlob: rep.gitBlob, sha256: rep.sha256, bytes: content.length };
  });
  // Unit-37 §3: the fixture trees carry the five ledger-governed source rows at their exact
  // cd3 blob identities, so the channel verdicts exercise their real pins and content reads.
  treeRows.push(...cd3GovernedRows());
  // Root unit-38 F1/F2: the fixture trees also carry the LEDGER row at its exact cd3 identity
  // with its real bytes — the committed-ledger binding reads the live tree row and its blob,
  // so every fixture arm serves the same object the production channel reads.
  treeRows.push({ path: S3_LEDGER_REL, mode: '100644', kind: 'blob', gitBlob: CD3_LEDGER_GITBLOB, content: CD3_LEDGER_BYTES });
  // Root unit-53 dead-entry guard: the shared fixture models the COMPLETE successor surface of
  // the real checkpoint — the F1 row (a reviewed carrier row carrying its frozen checkpoint
  // identity on both legs) and the workflow checkpoint path join the base fixture so every
  // arm exercises the same relation coverage the production checkpoint actually binds. The
  // dedicated F1/workflow arms below mutate their surface per leg; plain fixtures stay clean
  // with the original identity on both legs.
  carrier.currentLineageOnlyScope.upstreamAdditions.push({ path: F1_REL, mode: '100644', kind: 'blob', gitBlob: F1_REVIEWED.gitBlob, sha256: F1_REVIEWED.sha256, bytes: F1_REVIEWED.bytes });
  treeRows.push({ path: F1_REL, mode: '100644', kind: 'blob', gitBlob: F1_REVIEWED.gitBlob, content: CD3_F1_BYTES });
  treeRows.push({ path: WF_REL, mode: '100644', kind: 'blob', gitBlob: WF_ORIGINAL.gitBlob, content: CD3_WF_BYTES });
  return { carrier, treeRows };
};
test('UPSTREAM-TRANSFER: the pinned Root-reviewed current-transfer checkpoint reconciles the complete 571-row set as 568 preserved bc8-origin blobs plus exactly three admitted assertion-preserving replacements', () => {
  const loaded = loadReviewedIntegration(REPO_ROOT);
  assert.equal(loaded.ok, true);
  const p = reconcileCurrentTransfer({ repoRoot: REPO_ROOT, git: realGitHistorical, carrier: loaded });
  const liveChannel = currentLedgerChannel({ repoRoot: REPO_ROOT, git: realGitHistorical });
  if (liveChannel.ok && liveChannel.activated) {
    // Root unit-38 F1: after the ACTUAL canonical activation the same real-repo relation is
    // exactly clean — and the acceptance is EXPLICIT and independently verified, never an
    // oracle taken from the detector's own verdict: the activated ledger IS the committed
    // live HEAD blob, and every governed pin binds the actual live bytes it governs.
    assert.deepEqual(p, [], p.join('|'));
    const committed = realGitHistorical(['cat-file', 'blob', `HEAD:${S3_LEDGER_REL}`]);
    assert.equal(committed.rc, 0);
    assert.ok(committed.stdout.equals(readFileSync(join(REPO_ROOT, S3_LEDGER_REL))), 'the activated ledger must be identical to the committed live HEAD blob');
    for (const path of governedPaths) {
      const row = [...(liveChannel.liveLedger.addedPaths ?? []), ...(liveChannel.liveLedger.modifiedPaths ?? [])].find((r) => r?.path === path);
      assert.ok(row && /^[0-9a-f]{64}$/.test(row.sha256 ?? ''), `the activated ledger must pin ${path}`);
      const blob = realGitHistorical(['cat-file', 'blob', `HEAD:${path}`]);
      assert.equal(blob.rc, 0);
      assert.equal(sha(blob.stdout), row.sha256, `the activated pin for ${path} must bind the actual live bytes`);
    }
  } else {
    // Root unit-36 item C (pre-admission state): the warm real-repo relation ends at the
    // honest finite pending state — every row/mode/content/extra/missing check passes and
    // the ONLY remaining problems are the typed PENDING current-source proposals awaiting
    // actual Root admission (exactly the five paths of Root's ACTUAL-FIVE-POSTIMAGE-PINS
    // receipts, paths only), with the channel itself valid and unactivated.
    assert.equal(liveChannel.ok, true, liveChannel.problems.join('|'));
    assert.equal(liveChannel.activated, false);
    assert.equal(p.length, PENDING_CURRENT_SOURCE_PROPOSALS.length, p.join('|'));
    assert.ok(p.every((x) => x.startsWith('pending actual Root admission')), p.join('|'));
    for (const path of PENDING_CURRENT_SOURCE_PROPOSALS) {
      assert.equal(p.filter((x) => x.includes(`${path} `)).length, 1, `${path} must be reported by exactly one pending problem: ${p.join('|')}`);
    }
  }
  // The three admitted paths really are the only rows whose checkpoint blob differs from
  // the bc8 origin — the fixture arm below refuses any fourth difference. The synthetic
  // fixture tree equals its own live tree and reads its ledger from a FIXED baseline root,
  // so no pending problems arise there before OR after the canonical activation.
  const { carrier, treeRows } = transferFixture();
  assert.deepEqual(reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(treeRows), carrier: { ok: true, data: carrier } }), []);
});
test('UPSTREAM-TRANSFER: a changed, missing, mode-swapped or extra upstream-origin path without an admitted replacement refuses, and a wrong checkpoint head/tree/parent refuses', () => {
  const { carrier, treeRows } = transferFixture();
  const badCarrier = structuredClone(carrier);
  const changed = treeRows.map((r) => ({ ...r }));
  changed[10] = { ...changed[10], gitBlob: hex40('c') };
  assert.ok(reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(changed), carrier: { ok: true, data: badCarrier } }).some((x) => x.includes('changed upstream-origin path without an admitted replacement')));
  const missing = treeRows.filter((_, i) => i !== 20);
  assert.ok(reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(missing), carrier: { ok: true, data: badCarrier } }).some((x) => x.includes('missing from the checkpoint tree')));
  const modeSwap = treeRows.map((r, i) => (i === 30 ? { ...r, mode: '120000' } : r));
  assert.ok(reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(modeSwap), carrier: { ok: true, data: badCarrier } }).some((x) => x.includes('mode/kind mismatch')));
  const noReplacement = structuredClone(carrier);
  noReplacement.currentLineageOnlyScope.upstreamAdditions[1] = { ...noReplacement.currentLineageOnlyScope.upstreamAdditions[1], path: 'upstream/fake-999.md' };
  assert.ok(reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(treeRows), carrier: { ok: true, data: noReplacement } }).some((x) => x.includes('admitted current replacements must appear')));
  assert.ok(reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(treeRows, { treeOf: hex40('e') }), carrier: { ok: true, data: badCarrier } }).some((x) => x.includes('does not resolve to the reviewed tree')));
  assert.ok(reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(treeRows, { parentLine: `${hex40('d')} ${hex40('9')}` }), carrier: { ok: true, data: badCarrier } }).some((x) => x.includes('parent must be exactly')));
  assert.ok(reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(treeRows, { ancOk: false }), carrier: { ok: true, data: badCarrier } }).some((x) => x.includes('must be an actual ancestor')));
  assert.ok(reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(treeRows), carrier: { ok: false, data: badCarrier } }).some((x) => x.includes('requires a valid reviewed carrier')));
});
test('UPSTREAM-TRANSFER: the finite LIVE leg — a live-only extra path, a live-tree change without an admitted replacement, a live-tree missing row and broken live-HEAD ancestry each refuse, and the cf64-union-bc8 lineage surface stays exactly covered', () => {
  // Root unit-35 item 3: the checkpoint tree alone proves only the old checkpoint. The LIVE
  // HEAD tree is checked per row (missing/mode/content), and every live path must belong to
  // the reviewed cf64-union-bc8 surface (rows, admitted replacements, admitted carriers,
  // accepted topic tip tree, upstream staging bc8 tree) — anything else is an unknown extra
  // current path and refuses.
  const { carrier, treeRows } = transferFixture();
  const badCarrier = structuredClone(carrier);
  const extraLive = [...treeRows, { path: 'upstream/rogue-live-extra.md', mode: '100644', kind: 'blob', gitBlob: hex40('e') }];
  assert.ok(reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(treeRows, { liveRows: extraLive }), carrier: { ok: true, data: badCarrier } }).some((x) => x.includes('unknown upstream-origin current path without a reviewed row: upstream/rogue-live-extra.md')), 'a live-only extra path outside the union surface refuses');
  const changedLive = treeRows.map((r) => ({ ...r }));
  changedLive[10] = { ...changedLive[10], gitBlob: hex40('f') };
  assert.ok(reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(treeRows, { liveRows: changedLive }) , carrier: { ok: true, data: badCarrier } }).some((x) => x.includes('changed upstream-origin path without an admitted replacement in the live HEAD tree')), 'a live-tree change the checkpoint does not carry refuses');
  const missingLive = treeRows.filter((_, i) => i !== 40);
  assert.ok(reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(treeRows, { liveRows: missingLive }), carrier: { ok: true, data: badCarrier } }).some((x) => x.includes('missing from the live HEAD tree')), 'a row missing from the live HEAD tree refuses');
  assert.ok(reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(treeRows, { ancHeadOk: false }), carrier: { ok: true, data: badCarrier } }).some((x) => x.includes('must be an actual ancestor of the live HEAD')), 'a live HEAD that does not descend from the checkpoint and bc8 refuses');
  // The same live leg reconciles clean when the live tree equals the reviewed surface.
  assert.deepEqual(reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(treeRows, { liveRows: treeRows.map((r) => ({ ...r })) }), carrier: { ok: true, data: badCarrier } }), [], 'the unchanged live leg reconciles clean');
});
test('UPSTREAM-TRANSFER (unit 36): the complete finite current subject — an unknown non-row byte or mode mutation refuses, a missing original path refuses, and a typed pending path reports the honest admission-pending class instead of passing or erroring', () => {
  // Root unit-36 item C: pathname membership alone is not content custody. The checkpoint
  // (cd3) and live HEAD trees are compared path by path over the WHOLE finite surface, not
  // only the 571 rows: an unknown byte/mode mutation of an original path refuses, a deleted
  // original path refuses, and the five typed PENDING paths (delivery-committed postimage
  // proposals) are reported as explicit admission-pending problems — never a silent pass,
  // never an unknown-object error, never a blanket expected-map exception.
  const { carrier, treeRows } = transferFixture();
  const badCarrier = structuredClone(carrier);
  const ordinary = { path: 'docs/test-assurance-kernel/s3/ordinary-current-file.md', mode: '100644', kind: 'blob', gitBlob: hex40('1') };
  const pendingPath = PENDING_CURRENT_SOURCE_PROPOSALS[4];
  const withExtra = [...treeRows.map((r) => ({ ...r })), { ...ordinary }, { path: pendingPath, mode: '100644', kind: 'blob', gitBlob: hex40('2') }];
  const run = (liveRows) => reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(withExtra, { liveRows }), carrier: { ok: true, data: badCarrier } });
  // Clean baseline: the whole finite surface identical in checkpoint and live trees.
  assert.deepEqual(run(withExtra.map((r) => ({ ...r }))), []);
  const mutated = withExtra.map((r) => (r.path === ordinary.path ? { ...r, gitBlob: hex40('3') } : r));
  const pm = run(mutated);
  assert.ok(pm.some((x) => x.includes(`changed current source path without an admitted replacement or governed binding: ${ordinary.path}`)), pm.join('|'));
  const dropped = withExtra.filter((r) => r.path !== ordinary.path);
  const pd = run(dropped);
  assert.ok(pd.some((x) => x.includes(`original current path missing from the live HEAD tree: ${ordinary.path}`)), pd.join('|'));
  const modeSwap = withExtra.map((r) => (r.path === ordinary.path ? { ...r, mode: '100755' } : r));
  const pms = run(modeSwap);
  assert.ok(pms.some((x) => x.includes(`changed current source path without an admitted replacement or governed binding: ${ordinary.path}`)), pms.join('|'));
  const pendChanged = withExtra.map((r) => (r.path === pendingPath ? { ...r, gitBlob: hex40('4') } : r));
  const pp = run(pendChanged);
  assert.equal(pp.length, 1, pp.join('|'));
  assert.ok(pp[0].startsWith('pending actual Root admission'), pp.join('|'));
  const pendAdded = [...withExtra.map((r) => ({ ...r })), { path: PENDING_CURRENT_SOURCE_PROPOSALS[2], mode: '100644', kind: 'blob', gitBlob: hex40('5') }];
  const pa = run(pendAdded);
  assert.ok(pa.some((x) => x.startsWith('pending actual Root admission') && x.includes(PENDING_CURRENT_SOURCE_PROPOSALS[2])), pa.join('|'));
  assert.ok(pa.every((x) => !x.includes('unknown upstream-origin current path')), pa.join('|'));
});
test('LEDGER-CHANNEL (unit 37): the exact existing v1 channel — baseline is valid-unactivated, the exact proposed activated ledger L validates with exactly two new rows, and any other field/member/order/hash change refuses', () => {
  // Paired BEFORE activation: the live ledger equals the fixed-checkpoint (cd3) baseline —
  // the channel is valid and UNACTIVATED (zero new rows), which is the honest current state.
  const baseline = JSON.parse(CD3_LEDGER_BYTES.toString('utf8'));
  const before = evaluateLedgerChannel({ liveLedger: structuredClone(baseline), baselineLedger: baseline });
  assert.equal(before.ok, true, before.problems.join('|'));
  assert.equal(before.activated, false);
  // The exact ACTIVATED proposal L: the two existing s3-source pins, the existing verify pin
  // and EXACTLY TWO new modifiedPaths rows (P38 + MANIFEST, path+sha256 only) — nothing else.
  const PIN_A = 'a'.repeat(64); const PIN_B = 'b'.repeat(64); const PIN_N1 = 'c'.repeat(63) + '1'; const PIN_N2 = 'c'.repeat(63) + '2'; const PIN_N9 = 'c'.repeat(63) + '9';
  const L = structuredClone(baseline);
  for (const row of L.addedPaths) if (LEDGER_BINDING_ADDED_PATHS.includes(row.path)) row.sha256 = PIN_A;
  L.modifiedPaths = L.modifiedPaths.map((row) => (LEDGER_BINDING_MODIFIED_PATHS.includes(row.path) ? { ...row, sha256: PIN_B } : row));
  L.modifiedPaths = [...L.modifiedPaths, { path: LEDGER_BINDING_NEW_MODIFIED_PATHS[0], sha256: PIN_N1 }, { path: LEDGER_BINDING_NEW_MODIFIED_PATHS[1], sha256: PIN_N2 }];
  const after = evaluateLedgerChannel({ liveLedger: L, baselineLedger: baseline });
  assert.equal(after.ok, true, after.problems.join('|'));
  assert.equal(after.activated, true);
  assert.equal(after.newRows.length, 2);
  // One new row alone is still a VALID but UNACTIVATED ledger (partial proposal state).
  const partial = structuredClone(L);
  partial.modifiedPaths = partial.modifiedPaths.slice(0, -1);
  const partialVerdict = evaluateLedgerChannel({ liveLedger: partial, baselineLedger: baseline });
  assert.equal(partialVerdict.ok, true, partialVerdict.problems.join('|'));
  assert.equal(partialVerdict.activated, false);
  // Everything else refuses: any non-normalized field change, member order change, extra
  // field on a new row, malformed sha, duplicate new rows, or a baseline carrying the rows.
  const tamperedNote = structuredClone(L); tamperedNote.note = `${baseline.note ?? ''} plus self-service`;
  assert.equal(evaluateLedgerChannel({ liveLedger: tamperedNote, baselineLedger: baseline }).ok, false);
  const tamperedEvidence = structuredClone(L); tamperedEvidence.evidenceComplete = !(baseline.evidenceComplete);
  assert.equal(evaluateLedgerChannel({ liveLedger: tamperedEvidence, baselineLedger: baseline }).ok, false);
  const reordered = structuredClone(L); reordered.addedPaths = [...reordered.addedPaths.slice(1), reordered.addedPaths[0]];
  assert.equal(evaluateLedgerChannel({ liveLedger: reordered, baselineLedger: baseline }).ok, false);
  const extraField = structuredClone(L); extraField.modifiedPaths = extraField.modifiedPaths.map((r) => (r.path === LEDGER_BINDING_NEW_MODIFIED_PATHS[0] ? { ...r, class: 's3-source' } : r));
  assert.equal(evaluateLedgerChannel({ liveLedger: extraField, baselineLedger: baseline }).ok, false);
  const badSha = structuredClone(L); badSha.modifiedPaths = badSha.modifiedPaths.map((r) => (r.path === LEDGER_BINDING_NEW_MODIFIED_PATHS[1] ? { ...r, sha256: 'zz' } : r));
  assert.equal(evaluateLedgerChannel({ liveLedger: badSha, baselineLedger: baseline }).ok, false);
  const dupRows = structuredClone(L); dupRows.modifiedPaths = [...dupRows.modifiedPaths, { path: LEDGER_BINDING_NEW_MODIFIED_PATHS[0], sha256: PIN_N9 }];
  assert.equal(evaluateLedgerChannel({ liveLedger: dupRows, baselineLedger: baseline }).ok, false);
  const baselineCarrying = structuredClone(baseline); baselineCarrying.modifiedPaths = [...baselineCarrying.modifiedPaths, { path: LEDGER_BINDING_NEW_MODIFIED_PATHS[0], sha256: PIN_N1 }];
  assert.equal(evaluateLedgerChannel({ liveLedger: baselineCarrying, baselineLedger: baselineCarrying }).ok, false);
});
test('LEDGER-CHANNEL (unit 37): governed verdicts are paired before/after activation — activated content-bound discharges, activated pin-mismatch refuses, unactivated mismatch defers to the caller pending class, and missing/mode-wrong/legacy-pinless rows refuse', () => {
  const unactivated = { ok: true, activated: false };
  const activated = { ok: true, activated: true };
  const PIN = 'd'.repeat(64); const OTHER = 'e'.repeat(64);
  const desc = (path, over = {}) => ({ path, checkpointEntry: { mode: '100644', kind: 'blob', oid: hex40('1') }, liveEntry: { mode: '100644', kind: 'blob', oid: hex40('2') }, pin: PIN, liveSha: PIN, ...over });
  const governed = [...LEDGER_BINDING_ADDED_PATHS, ...LEDGER_BINDING_MODIFIED_PATHS, ...LEDGER_BINDING_NEW_MODIFIED_PATHS].map((p) => desc(p));
  // AFTER activation with matching bytes: fully discharged — zero problems.
  assert.deepEqual(governedPathVerdicts({ channel: activated, governed }), []);
  // AFTER activation with a mismatching pin: a purported binding that does not bind refuses.
  const mismatch = governed.map((g) => ({ ...g, liveSha: OTHER }));
  const pm = governedPathVerdicts({ channel: activated, governed: mismatch });
  assert.equal(pm.length, governed.length, pm.join('|'));
  assert.ok(pm.every((x) => x.includes('does not match the actual live bytes')), pm.join('|'));
  // BEFORE activation the SAME mismatch stays silent in the verdicts — the caller reports the
  // finite pending class (proved end-to-end by the healthy real-repo and fixture arms above).
  assert.deepEqual(governedPathVerdicts({ channel: unactivated, governed: mismatch }), []);
  // A legacy row without a structurally guaranteed pin refuses; a NEW row without a pin is
  // pending territory (pre-activation proposal state), never a silent pass and never a crash.
  const pinless = governed.map((g) => ({ ...g, pin: null }));
  const pl = governedPathVerdicts({ channel: unactivated, governed: pinless });
  assert.equal(pl.length, LEDGER_BINDING_ADDED_PATHS.length + LEDGER_BINDING_MODIFIED_PATHS.length, pl.join('|'));
  assert.ok(pl.every((x) => x.includes('lacks an exact 64-hex sha256 pin')), pl.join('|'));
  // Missing checkpoint entry, missing live entry, mode/kind change each refuse regardless of pins.
  assert.ok(governedPathVerdicts({ channel: activated, governed: governed.map((g) => ({ ...g, checkpointEntry: null })) }).every((x) => x.includes('missing from the admitted checkpoint tree')));
  assert.ok(governedPathVerdicts({ channel: activated, governed: governed.map((g) => ({ ...g, liveEntry: null })) }).every((x) => x.includes('missing from the live HEAD tree')));
  assert.ok(governedPathVerdicts({ channel: activated, governed: governed.map((g) => ({ ...g, liveEntry: { ...g.liveEntry, mode: '120000' } })) }).every((x) => x.includes('mode/kind changed')));
});

// ─── LEDGER-CHANNEL (unit 46): the exact TWO optional guard rows ───────────────
// Root unit-46 §B contract: the two guard modifiedPaths rows are a compatible
// absent-or-exactly-BOTH extension of the EXISTING v1 normalization. ABSENT —
// the canonical activated fb1 stays ACTIVATED (never a soft-pending) and changed
// guard/test bytes keep refusing as hard nonrows. PRESENT — both rows valid,
// unique, closed path+sha256, exact 64-hex, appended after every original row in
// the fixed order, never in the baseline; only then do the paths join the
// governed set under the SAME verdict chain. Every partial/duplicate/unknown/
// malformed/swapped/out-of-order/baseline-carrying supply refuses.
test('LEDGER-CHANNEL (unit 46): the two optional guard rows are absent-or-exactly-BOTH — absent keeps fb1 activated and guard bytes hard-refusing, both append as the finite governed extension, every malformed supply refuses', () => {
  const baseline = JSON.parse(CD3_LEDGER_BYTES.toString('utf8'));
  const PIN_A = 'a'.repeat(64); const PIN_B = 'b'.repeat(64); const PIN_N1 = 'c'.repeat(63) + '1'; const PIN_N2 = 'c'.repeat(63) + '2';
  const PIN_G1 = 'f'.repeat(63) + '1'; const PIN_G2 = 'f'.repeat(63) + '2';
  // The canonical ACTIVATED fb1 shape (P38+MF present, NO guard rows).
  const fb1 = structuredClone(baseline);
  for (const row of fb1.addedPaths) if (LEDGER_BINDING_ADDED_PATHS.includes(row.path)) row.sha256 = PIN_A;
  fb1.modifiedPaths = fb1.modifiedPaths.map((row) => (LEDGER_BINDING_MODIFIED_PATHS.includes(row.path) ? { ...row, sha256: PIN_B } : row));
  fb1.modifiedPaths = [...fb1.modifiedPaths, { path: LEDGER_BINDING_NEW_MODIFIED_PATHS[0], sha256: PIN_N1 }, { path: LEDGER_BINDING_NEW_MODIFIED_PATHS[1], sha256: PIN_N2 }];
  const noGuard = evaluateLedgerChannel({ liveLedger: structuredClone(fb1), baselineLedger: baseline });
  assert.equal(noGuard.ok, true, noGuard.problems.join('|'));
  assert.equal(noGuard.activated, true, 'fb1 WITHOUT guard rows stays fully activated — never a soft-pending state');
  assert.equal(noGuard.guardRows.length, 0);
  assert.equal(noGuard.guardGoverned, false);
  // The exact BOTH-present shape: appended after every original row, fixed order.
  const withGuard = structuredClone(fb1);
  withGuard.modifiedPaths = [...withGuard.modifiedPaths, { path: LEDGER_BINDING_OPTIONAL_GUARD_PATHS[0], sha256: PIN_G1 }, { path: LEDGER_BINDING_OPTIONAL_GUARD_PATHS[1], sha256: PIN_G2 }];
  const both = evaluateLedgerChannel({ liveLedger: withGuard, baselineLedger: baseline });
  assert.equal(both.ok, true, both.problems.join('|'));
  assert.equal(both.activated, true);
  assert.equal(both.guardRows.length, 2);
  assert.equal(both.guardGoverned, true);
  // Partial supply (exactly one row) refuses — never normalizes, never pending.
  const partial = structuredClone(fb1);
  partial.modifiedPaths = [...partial.modifiedPaths, { path: LEDGER_BINDING_OPTIONAL_GUARD_PATHS[0], sha256: PIN_G1 }];
  const pv = evaluateLedgerChannel({ liveLedger: partial, baselineLedger: baseline });
  assert.equal(pv.ok, false);
  assert.ok(pv.problems.some((x) => x.includes('absent-or-exactly-BOTH')), pv.problems.join('|'));
  // Duplicate guard rows refuse.
  const dup = structuredClone(withGuard);
  dup.modifiedPaths = [...dup.modifiedPaths, { path: LEDGER_BINDING_OPTIONAL_GUARD_PATHS[0], sha256: PIN_G1 }];
  const dv = evaluateLedgerChannel({ liveLedger: dup, baselineLedger: baseline });
  assert.equal(dv.ok, false);
  assert.ok(dv.problems.some((x) => x.includes('duplicate optional guard')), dv.problems.join('|'));
  // Extra field on a guard row refuses (closed path+sha256 form).
  const extraField = structuredClone(withGuard);
  extraField.modifiedPaths = extraField.modifiedPaths.map((r) => (r.path === LEDGER_BINDING_OPTIONAL_GUARD_PATHS[0] ? { ...r, class: 's3-source' } : r));
  assert.equal(evaluateLedgerChannel({ liveLedger: extraField, baselineLedger: baseline }).ok, false);
  // Malformed sha refuses — the general v1 shape validator catches it first
  // (fail-closed at the earliest arm); the guard-specific 64-hex check guards
  // the path beyond shape (e.g. a structurally valid wrong-length pass).
  const badSha = structuredClone(withGuard);
  badSha.modifiedPaths = badSha.modifiedPaths.map((r) => (r.path === LEDGER_BINDING_OPTIONAL_GUARD_PATHS[1] ? { ...r, sha256: 'zz' } : r));
  const bv = evaluateLedgerChannel({ liveLedger: badSha, baselineLedger: baseline });
  assert.equal(bv.ok, false);
  assert.ok(bv.problems.some((x) => x.includes('invalid modifiedPaths entry') && x.includes(LEDGER_BINDING_OPTIONAL_GUARD_PATHS[1])), bv.problems.join('|'));
  // Swapped-order append (test.ts before .ts) refuses.
  const swappedOrder = structuredClone(fb1);
  swappedOrder.modifiedPaths = [...swappedOrder.modifiedPaths, { path: LEDGER_BINDING_OPTIONAL_GUARD_PATHS[1], sha256: PIN_G2 }, { path: LEDGER_BINDING_OPTIONAL_GUARD_PATHS[0], sha256: PIN_G1 }];
  const sv = evaluateLedgerChannel({ liveLedger: swappedOrder, baselineLedger: baseline });
  assert.equal(sv.ok, false);
  assert.ok(sv.problems.some((x) => x.includes('fixed order')), sv.problems.join('|'));
  // Not appended (inserted before an original row) refuses.
  const inserted = structuredClone(fb1);
  inserted.modifiedPaths = [{ path: LEDGER_BINDING_OPTIONAL_GUARD_PATHS[0], sha256: PIN_G1 }, ...inserted.modifiedPaths, { path: LEDGER_BINDING_OPTIONAL_GUARD_PATHS[1], sha256: PIN_G2 }];
  const iv = evaluateLedgerChannel({ liveLedger: inserted, baselineLedger: baseline });
  assert.equal(iv.ok, false);
  assert.ok(iv.problems.some((x) => x.includes('appended after every original')), iv.problems.join('|'));
  // A baseline carrying either guard row refuses.
  const baselineCarrying = structuredClone(baseline);
  baselineCarrying.modifiedPaths = [...baselineCarrying.modifiedPaths, { path: LEDGER_BINDING_OPTIONAL_GUARD_PATHS[1], sha256: PIN_G2 }];
  assert.equal(evaluateLedgerChannel({ liveLedger: baselineCarrying, baselineLedger: baselineCarrying }).ok, false);
  // An UNKNOWN third path+sha256 row still refuses the normalized comparison (the
  // optional channel admits EXACTLY these two paths, no new namespace).
  const unknownRow = structuredClone(fb1);
  unknownRow.modifiedPaths = [...unknownRow.modifiedPaths, { path: 'packages/core/hooks/checks/unknown-extra.ts', sha256: PIN_G1 }];
  assert.equal(evaluateLedgerChannel({ liveLedger: unknownRow, baselineLedger: baseline }).ok, false);
});

test('LEDGER-CHANNEL (unit 46): guard governed verdicts — activated pins bind real live bytes, swapped hashes refuse, missing/mode-wrong refuse, and pinless pre-activation stays pending-class', () => {
  const activated = { ok: true, activated: true, guardGoverned: true };
  const unactivated = { ok: true, activated: false, guardGoverned: false };
  const PIN_G1 = '1'.repeat(64); const PIN_G2 = '2'.repeat(64); const OTHER = 'e'.repeat(64);
  const desc = (path, over = {}) => ({ path, checkpointEntry: { mode: '100644', kind: 'blob', oid: hex40('1') }, liveEntry: { mode: '100644', kind: 'blob', oid: hex40('2') }, pin: PIN_G1, liveSha: PIN_G1, ...over });
  const guardGoverned = LEDGER_BINDING_OPTIONAL_GUARD_PATHS.map((p, i) => desc(p, { pin: `${i + 1}`.repeat(64), liveSha: `${i + 1}`.repeat(64) }));
  // Activated + binding pins: fully discharged.
  assert.deepEqual(governedPathVerdicts({ channel: activated, governed: guardGoverned }), []);
  // Swapped hashes (each row pinning the OTHER row's bytes): both refuse.
  const swapped = [desc(LEDGER_BINDING_OPTIONAL_GUARD_PATHS[0], { pin: PIN_G2, liveSha: PIN_G1 }), desc(LEDGER_BINDING_OPTIONAL_GUARD_PATHS[1], { pin: PIN_G1, liveSha: PIN_G2 })];
  const sm = governedPathVerdicts({ channel: activated, governed: swapped });
  assert.equal(sm.length, 2, sm.join('|'));
  assert.ok(sm.every((x) => x.includes('does not match the actual live bytes')), sm.join('|'));
  // Mismatched pin vs live bytes refuses under activation.
  const mm = governedPathVerdicts({ channel: activated, governed: guardGoverned.map((g) => ({ ...g, liveSha: OTHER })) });
  assert.equal(mm.length, 2, mm.join('|'));
  // Pre-activation mismatch stays pending-class (silent verdicts, caller reports).
  assert.deepEqual(governedPathVerdicts({ channel: unactivated, governed: guardGoverned.map((g) => ({ ...g, liveSha: OTHER })) }), []);
  // Pinless guard rows never crash and never silently pass.
  const pl = governedPathVerdicts({ channel: unactivated, governed: guardGoverned.map((g) => ({ ...g, pin: null })) });
  assert.equal(pl.length, 0, pl.join('|'));
  // Missing checkpoint / missing live / mode-wrong each refuse regardless of pins.
  assert.ok(governedPathVerdicts({ channel: activated, governed: guardGoverned.map((g) => ({ ...g, checkpointEntry: null })) }).every((x) => x.includes('missing from the admitted checkpoint tree')));
  assert.ok(governedPathVerdicts({ channel: activated, governed: guardGoverned.map((g) => ({ ...g, liveEntry: null })) }).every((x) => x.includes('missing from the live HEAD tree')));
  assert.ok(governedPathVerdicts({ channel: activated, governed: guardGoverned.map((g) => ({ ...g, liveEntry: { ...g.liveEntry, mode: '100755' } })) }).every((x) => x.includes('mode/kind changed')));
});

test('LEDGER-CHANNEL (unit 46): end-to-end through reconcileCurrentTransfer — without the rows a changed guard path is a HARD nonrow refusal; with BOTH valid rows binding the actual bytes it discharges', () => {
  const { carrier, treeRows } = transferFixture();
  const badCarrier = structuredClone(carrier);
  const oid40 = (c, n) => c.repeat(39) + n;
  const GUARD_CKPT = LEDGER_BINDING_OPTIONAL_GUARD_PATHS.map((p, i) => ({ path: p, mode: '100644', kind: 'blob', gitBlob: oid40('c', String(i)), content: Buffer.from(`checkpoint guard subject ${i}: ${p}\n`) }));
  const GUARD_LIVE = LEDGER_BINDING_OPTIONAL_GUARD_PATHS.map((p, i) => ({ path: p, mode: '100644', kind: 'blob', gitBlob: oid40('d', String(i)), content: Buffer.from(`repaired guard subject ${i}: ${p}\n`) }));
  const rowsWithGuardCkpt = [...treeRows, ...GUARD_CKPT];
  // (1) WITHOUT the ledger rows: changed guard bytes are a hard nonrow refusal —
  //     disk ledger stays the valid fixed baseline, so nothing governs the paths.
  const liveChanged = [...rowsWithGuardCkpt.filter((r) => !LEDGER_BINDING_OPTIONAL_GUARD_PATHS.includes(r.path)), ...GUARD_LIVE];
  const p1 = reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(rowsWithGuardCkpt, { liveRows: liveChanged }), carrier: { ok: true, data: badCarrier } });
  assert.ok(p1.some((x) => x.includes('changed current source path without an admitted replacement or governed binding') && LEDGER_BINDING_OPTIONAL_GUARD_PATHS.some((g) => x.includes(g))), p1.join('|'));
  // (2) WITH both valid rows whose pins bind the actual LIVE bytes: discharged —
  //     the same changed live rows now govern cleanly through the same channel.
  const governedContents = governedContentMap(treeRows);
  const activatedBase = JSON.parse(activatedLedgerFixture(governedContents).toString('utf8'));
  const guardLedger = Buffer.from(JSON.stringify({
    ...activatedBase,
    modifiedPaths: [...activatedBase.modifiedPaths, ...LEDGER_BINDING_OPTIONAL_GUARD_PATHS.map((p, i) => ({ path: p, sha256: sha(GUARD_LIVE[i].content) }))],
  }));
  const tmp = mkdtempSync(join(tmpdir(), 'tak-ledger-guard-'));
  mkdirSync(join(tmp, 'docs/test-assurance-kernel/s3'), { recursive: true });
  writeFileSync(join(tmp, S3_LEDGER_REL), guardLedger);
  const liveCommitted = [...liveChanged.map((r) => (r.path === S3_LEDGER_REL ? { ...r, gitBlob: hex40('3'), content: guardLedger } : r))];
  const p2 = reconcileCurrentTransfer({ repoRoot: tmp, git: fakeTransferGit(rowsWithGuardCkpt, { liveRows: liveCommitted }), carrier: { ok: true, data: badCarrier } });
  assert.ok(p2.every((x) => !LEDGER_BINDING_OPTIONAL_GUARD_PATHS.some((g) => x.includes(g))), p2.join('|'));
  // (3) With rows whose pins are swapped relative to the live bytes: both refuse —
  //     a purported binding that does not bind never passes.
  const guardLedgerSwapped = Buffer.from(JSON.stringify({
    ...activatedBase,
    modifiedPaths: [...activatedBase.modifiedPaths, ...LEDGER_BINDING_OPTIONAL_GUARD_PATHS.map((p, i) => ({ path: p, sha256: sha(GUARD_LIVE[1 - i].content) }))],
  }));
  const tmp2 = mkdtempSync(join(tmpdir(), 'tak-ledger-guard-sw-'));
  mkdirSync(join(tmp2, 'docs/test-assurance-kernel/s3'), { recursive: true });
  writeFileSync(join(tmp2, S3_LEDGER_REL), guardLedgerSwapped);
  const liveCommitted2 = [...liveChanged.map((r) => (r.path === S3_LEDGER_REL ? { ...r, gitBlob: hex40('4'), content: guardLedgerSwapped } : r))];
  const p3 = reconcileCurrentTransfer({ repoRoot: tmp2, git: fakeTransferGit(rowsWithGuardCkpt, { liveRows: liveCommitted2 }), carrier: { ok: true, data: badCarrier } });
  assert.ok(p3.some((x) => x.includes('does not match the actual live bytes')), p3.join('|'));
});
test('LEDGER-CHANNEL (unit 64): the ACTIVE smoke pair is ADDITIVE — both rows binding live bytes govern the changed helper while the typed workflow successor gate stays fully load-bearing end-to-end', () => {
  const { carrier, treeRows } = transferFixture();
  const HELP_REL = 'tests/consumer-matrix/own-config-cell.sh';
  // Synthetic helper legs (the smoke pair exists to govern exactly this changed-helper shape);
  // the workflow row rides the shared fixture at its frozen original checkpoint identity.
  const HELP_CKPT = { path: HELP_REL, mode: '100755', kind: 'blob', gitBlob: hex40('8'), content: Buffer.from('# own-config-cell checkpoint original\n') };
  const HELP_LIVE = { path: HELP_REL, mode: '100755', kind: 'blob', gitBlob: hex40('9'), content: Buffer.from('# own-config-cell repaired FOLD greet\n') };
  const ckptRows = [...treeRows, HELP_CKPT];
  const activatedBase = JSON.parse(activatedLedgerFixture(governedContentMap(treeRows)).toString('utf8'));
  const smokeLedger = (wfPin, helpPin = sha(HELP_LIVE.content)) => Buffer.from(JSON.stringify({
    ...activatedBase,
    modifiedPaths: [...activatedBase.modifiedPaths, { path: WF_REL, sha256: wfPin }, { path: HELP_REL, sha256: helpPin }],
  }));
  // Default live leg = the exact Root-admitted workflow successor; each adversarial arm overrides one input.
  const runSmoke = (tag, ledgerBytes, { ckpt = ckptRows, wfOver = { gitBlob: WF_ADMITTED.gitBlob, content: LIVE_WF_BYTES }, helpRow = HELP_LIVE } = {}) => {
    const tmp = mkdtempSync(join(tmpdir(), `tak-ledger-smoke-${tag}-`));
    mkdirSync(join(tmp, 'docs/test-assurance-kernel/s3'), { recursive: true });
    writeFileSync(join(tmp, S3_LEDGER_REL), ledgerBytes);
    const liveRows = [...ckpt.filter((r) => r.path !== WF_REL && r.path !== HELP_REL), { ...ckpt.find((r) => r.path === WF_REL), ...wfOver }, helpRow]
      .map((r) => (r.path === S3_LEDGER_REL ? { ...r, gitBlob: hex40('7'), content: ledgerBytes } : r));
    return reconcileCurrentTransfer({ repoRoot: tmp, git: fakeTransferGit(ckpt, { liveRows }), carrier: { ok: true, data: structuredClone(carrier) } });
  };
  const healthyLedger = smokeLedger(sha(LIVE_WF_BYTES));
  // (1) HEALTHY active pair: both rows bind the actual live bytes - the changed helper
  //     discharges through the bounded pin and the typed workflow leg admits the exact
  //     successor; no problem names either smoke path.
  const p1 = runSmoke('ok', healthyLedger);
  assert.ok(p1.every((x) => !x.includes(WF_REL) && !x.includes(HELP_REL)), p1.join('|'));
  // (2) The successor OID appearing in the CHECKPOINT leg refuses even with the pair active -
  //     the pin (still matching the live bytes) cannot launder the frozen checkpoint identity.
  //     This arm is silent under the unit-63 governedSet skip (the typed leg never ran).
  const forgedCkpt = ckptRows.map((r) => (r.path === WF_REL ? { ...r, gitBlob: WF_ADMITTED.gitBlob, content: LIVE_WF_BYTES } : r));
  const p2 = runSmoke('ckpt', healthyLedger, { ckpt: forgedCkpt });
  assert.ok(p2.some((x) => x.includes(WF_REL) && x.includes('in the checkpoint tree — the frozen Root-reviewed checkpoint identity')), p2.join('|'));
  // (3) An UNKNOWN live replacement OID refuses while the pin still matches the served bytes -
  //     only the typed permitted-OID arm catches it. Silent under the unit-63 skip.
  const p3 = runSmoke('oid', healthyLedger, { wfOver: { gitBlob: hex40('d'), content: LIVE_WF_BYTES } });
  assert.ok(p3.some((x) => x.includes(WF_REL) && x.includes('in the live HEAD tree — the live leg may carry only the frozen original')), p3.join('|'));
  // (4) COUNTERFEIT bytes under the admitted successor OID with the ledger pin REBOUND to the
  //     counterfeit (the attacker authors the proposed pin too): the generic pin check passes
  //     by construction; the typed served-bytes identity is the only refusal. Silent under 63.
  const counterfeit = Buffer.from('name: counterfeit-workflow-bytes\n');
  const p4 = runSmoke('fake', smokeLedger(sha(counterfeit)), { wfOver: { gitBlob: WF_ADMITTED.gitBlob, content: counterfeit } });
  assert.ok(p4.some((x) => x.includes(WF_REL) && x.includes('serves counterfeit bytes under')), p4.join('|'));
  // (5) A mode swap on the live workflow leg refuses (typed arm; the generic verdict fires too).
  const p5 = runSmoke('mode', healthyLedger, { wfOver: { gitBlob: WF_ADMITTED.gitBlob, content: LIVE_WF_BYTES, mode: '120000' } });
  assert.ok(p5.some((x) => x.includes(WF_REL) && x.includes('mode/kind')), p5.join('|'));
  // (6) The helper stays governed by its bounded pin: a mismatching helper pin refuses with
  //     both rows present (guard-pair treatment - the helper has no typed successor entry).
  const p6 = runSmoke('pin', smokeLedger(sha(LIVE_WF_BYTES), '9'.repeat(64)));
  assert.ok(p6.some((x) => x.includes(HELP_REL) && x.includes('does not match the actual live bytes')), p6.join('|'));
  // (7) WITHOUT the rows (disk ledger = valid fixed baseline): the changed helper bytes are a
  //     HARD nonrow refusal and the workflow keeps its pre-pair typed admission - the pair
  //     never softens the old contract.
  const liveNoRows = [...ckptRows.filter((r) => r.path !== WF_REL && r.path !== HELP_REL), { path: WF_REL, mode: '100644', kind: 'blob', gitBlob: WF_ADMITTED.gitBlob, content: LIVE_WF_BYTES }, HELP_LIVE];
  const p7 = reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(ckptRows, { liveRows: liveNoRows }), carrier: { ok: true, data: structuredClone(carrier) } });
  assert.ok(p7.some((x) => x.includes('changed current source path without an admitted replacement or governed binding') && x.includes(HELP_REL)), p7.join('|'));
  assert.ok(p7.every((x) => !x.includes(WF_REL)), p7.join('|'));
});
test('LEDGER-CHANNEL (unit 37): a tampered live ledger refuses end-to-end through reconcileCurrentTransfer — selfIndexed normalization is the only admission, never a blanket exception', () => {
  const { carrier, treeRows } = transferFixture();
  const badCarrier = structuredClone(carrier);
  // The checkpoint tree carries the ledger at its exact cd3 identity (transferFixture) and
  // the live tree's ledger row is swapped to a DIFFERENT committed blob whose content IS the
  // tampered bytes — an honestly committed bad ledger (disk and committed agree, both wrong
  // beyond the finite normalization), so the channel is INVALID and the selfIndexed path
  // refuses instead of riding a blanket exception.
  const wrongNote = Buffer.from(JSON.stringify({ ...JSON.parse(CD3_LEDGER_BYTES.toString('utf8')), note: 'self-service note' }));
  const swapLedger = (rows, gitBlob, content) => rows.map((r) => (r.path === S3_LEDGER_REL ? { path: S3_LEDGER_REL, mode: '100644', kind: 'blob', gitBlob, content } : r));
  const tamperedRows = swapLedger(treeRows, hex40('8'), wrongNote);
  const tmp = mkdtempSync(join(tmpdir(), 'tak-ledger-tamper-'));
  mkdirSync(join(tmp, 'docs/test-assurance-kernel/s3'), { recursive: true });
  writeFileSync(join(tmp, S3_LEDGER_REL), wrongNote);
  const p = reconcileCurrentTransfer({ repoRoot: tmp, git: fakeTransferGit(treeRows, { liveRows: tamperedRows }), carrier: { ok: true, data: badCarrier } });
  assert.ok(p.some((x) => x.includes('scope-extension ledger changed outside the finite existing-ledger binding channel')), p.join('|'));
  assert.ok(p.some((x) => x.includes('existing-ledger binding channel invalid')), p.join('|'));
  // The HONEST normalization positive (unit-38 F2 semantics: committed and working bytes
  // AGREE): an activated-form byte change — exactly the two new rows plus the three governed
  // pin swaps, every pin computed from the fixture's own governed contents — admits through
  // normalization. The changed ledger bytes are judged ONLY by the normalized comparison,
  // never by their difference from the checkpoint blob: no refusal for the selfIndexed path.
  const activatedBytes = activatedLedgerFixture(governedContentMap(treeRows));
  const activatedRows = swapLedger(treeRows, hex40('9'), activatedBytes);
  const tmp2 = mkdtempSync(join(tmpdir(), 'tak-ledger-clean-'));
  mkdirSync(join(tmp2, 'docs/test-assurance-kernel/s3'), { recursive: true });
  writeFileSync(join(tmp2, S3_LEDGER_REL), activatedBytes);
  const p2 = reconcileCurrentTransfer({ repoRoot: tmp2, git: fakeTransferGit(treeRows, { liveRows: activatedRows }), carrier: { ok: true, data: badCarrier } });
  assert.ok(p2.every((x) => !x.includes('scope-extension ledger')), p2.join('|'));
});
test('LEDGER-CHANNEL (unit 38): the committed live HEAD ledger object is bound — wrong-note, unresolvable, deleted or mode-swapped committed entries refuse, and healthy baseline/activated twins admit', () => {
  const { carrier, treeRows } = transferFixture();
  const badCarrier = structuredClone(carrier);
  const swapLedger = (rows, over) => rows.map((r) => (r.path === S3_LEDGER_REL ? { ...r, ...over } : r));
  const run = (liveRows, repoRoot = ensureBaselineLedgerRoot()) => reconcileCurrentTransfer({ repoRoot, git: fakeTransferGit(treeRows, { liveRows }), carrier: { ok: true, data: badCarrier } });
  // Root unit-38 F2 falsifiers, made permanent negatives: the DISK ledger stays the valid
  // fixed baseline in every arm — only the COMMITTED side changes — so a valid on-disk
  // ledger can no longer mask the committed object.
  // (1) wrong-note committed blob: readable but byte-DIFFERENT from the working file — the
  //     exact Root counterfactual (disk stays valid) — refuses.
  const wrongNote = Buffer.from(JSON.stringify({ ...JSON.parse(CD3_LEDGER_BYTES.toString('utf8')), note: 'committed self-service note' }));
  const pw = run(swapLedger(treeRows, { gitBlob: hex40('6'), content: wrongNote }));
  assert.ok(pw.some((x) => x.includes('scope-extension ledger working file is not the committed live HEAD blob')), pw.join('|'));
  // (2) unresolvable committed blob: the tree row exists, its object does not — refuses.
  const pu = run(swapLedger(treeRows, { gitBlob: hex40('7'), content: undefined }));
  assert.ok(pu.some((x) => x.includes('scope-extension ledger committed blob') && x.includes('unreadable through the shared git runner')), pu.join('|'));
  // (3) deletion: the live HEAD tree drops the ledger row entirely — refuses; the disk-only
  //     channel never substitutes for the committed object.
  const pd = run(treeRows.filter((r) => r.path !== S3_LEDGER_REL));
  assert.ok(pd.some((x) => x.includes('scope-extension ledger missing from the live HEAD tree')), pd.join('|'));
  // (4) wrong mode on the committed entry (symlink swap): refuses both the original
  //     100644/blob binding and the selfIndexed mode/kind preservation.
  const pm = run(swapLedger(treeRows, { mode: '120000' }));
  assert.ok(pm.some((x) => x.includes('scope-extension ledger live HEAD entry is not the original 100644/blob form')), pm.join('|'));
  assert.ok(pm.some((x) => x.includes('scope-extension ledger mode/kind changed')), pm.join('|'));
  // (5) healthy baseline twin: committed == disk == the fixed cd3 baseline — exactly clean.
  assert.deepEqual(run(treeRows.map((r) => ({ ...r }))), []);
  // (6) activated twin: committed == disk == an activated-form ledger whose pins bind the
  //     fixture's own NEW governed bytes — the finite admission shape discharges everything.
  const activatedContents = new Map(governedPaths.map((p, i) => [p, Buffer.from(`unit-38 activated fixture subject ${i}: ${p}\n`)]));
  const activatedBytes = activatedLedgerFixture(activatedContents);
  const activatedLive = treeRows.map((r) => {
    if (activatedContents.has(r.path)) return { path: r.path, mode: '100644', kind: 'blob', gitBlob: hex40('abcde'[governedPaths.indexOf(r.path)]), content: activatedContents.get(r.path) };
    return r.path === S3_LEDGER_REL ? { ...r, gitBlob: hex40('5'), content: activatedBytes } : { ...r };
  });
  const pa = run(activatedLive, fixtureLedgerRoot(activatedBytes));
  assert.deepEqual(pa, [], pa.join('|'));
});
// Root unit-41 current-only generated F1 successor controls. The expected tuple below is the
// frozen independent Root admission data, NEVER derived from the detector or from a fresh
// generator run; the two byte anchors (reviewed cd3 original + actual admitted generated
// postimage) are pinned by their full identities so any drift in either anchor refuses.
const F1_REL = 'docs/site/reference/F1.md';
const F1_REVIEWED = { gitBlob: 'ef0d8840c302cc8bb101b272fd7bde2d9efc063e', sha256: 'cbba1e3774a3a8d7a4a0b5a06d6168a190ad38957eb6357a04e0f935cc1edc57', bytes: 16459 };
const F1_GENERATED = { gitBlob: 'c290363a90fbd2b32e185786a03a320f5379f6ff', sha256: 'f9620981c2224074825899429e900acbeff664fb7b97a958a7d3bf78895efa69', bytes: 16596 };
const CD3_F1_BYTES = realGit(['cat-file', 'blob', `${CURRENT_TRANSFER_CHECKPOINT.head}:${F1_REL}`]).stdout;
assert.equal(sha(CD3_F1_BYTES), F1_REVIEWED.sha256);
assert.equal(CD3_F1_BYTES.length, F1_REVIEWED.bytes);
const LIVE_F1_BYTES = readFileSync(join(REPO_ROOT, F1_REL));
assert.equal(sha(LIVE_F1_BYTES), F1_GENERATED.sha256, 'the committed live F1.md must be the exact Root-admitted generated postimage');
assert.equal(LIVE_F1_BYTES.length, F1_GENERATED.bytes);
// Root unit-53: the F1 successor surface (carrier row + tree row at the frozen checkpoint
// identity) is part of the BASE fixture now — the dead-entry guard demands every admitted
// successor entry bind a live surface in every fixture, so the dedicated F1 arms mutate the
// shared surface per leg instead of assembling it here.
const f1Fixture = () => transferFixture();
const f1Run = (treeRows, liveRows, carrier) => reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(treeRows, { liveRows }), carrier: { ok: true, data: carrier } });
const f1Live = (rows, over) => rows.map((r) => (r.path === F1_REL ? { ...r, ...over } : { ...r }));
test('CURRENT-ONLY F1 SUCCESSOR (unit 41): the unchanged reviewed baseline twin — original blob on both legs — admits', () => {
  const { carrier, treeRows } = f1Fixture();
  assert.deepEqual(f1Run(treeRows, treeRows.map((r) => ({ ...r })), carrier), []);
});
test('CURRENT-ONLY F1 SUCCESSOR (unit 41): the exact Root-admitted generated postimage on the live leg admits', () => {
  const { carrier, treeRows } = f1Fixture();
  assert.deepEqual(f1Run(treeRows, f1Live(treeRows, { gitBlob: F1_GENERATED.gitBlob, content: LIVE_F1_BYTES }), carrier), []);
});
test('CURRENT-ONLY F1 SUCCESSOR (unit 41): the generated successor appearing in the cd3 checkpoint leg refuses — the historical baseline never updates', () => {
  const { carrier, treeRows } = f1Fixture();
  const checkpointRows = f1Live(treeRows, { gitBlob: F1_GENERATED.gitBlob, content: LIVE_F1_BYTES });
  const p = f1Run(checkpointRows, checkpointRows.map((r) => ({ ...r })), carrier);
  assert.ok(p.some((x) => x.includes(`current-only successor path ${F1_REL} carries ${F1_GENERATED.gitBlob} in the checkpoint tree`)), p.join('|'));
});
test('CURRENT-ONLY F1 SUCCESSOR (unit 41): counterfeit bytes served under the generated OID refuse', () => {
  const { carrier, treeRows } = f1Fixture();
  const p = f1Run(treeRows, f1Live(treeRows, { gitBlob: F1_GENERATED.gitBlob, content: CD3_F1_BYTES }), carrier);
  assert.ok(p.some((x) => x.includes(`serves counterfeit bytes under ${F1_GENERATED.gitBlob}`)), p.join('|'));
});
test('CURRENT-ONLY F1 SUCCESSOR (unit 41): counterfeit bytes served under the reviewed original OID refuse', () => {
  const { carrier, treeRows } = f1Fixture();
  // The fake runner resolves cat-file by gitBlob (tree rows first), so the old-OID counterfeit
  // is planted in the shared row itself: the reviewed OID is presented while the bytes served
  // are the generated postimage — a pass here would mean OID trust without content binding.
  const forged = f1Live(treeRows, { content: LIVE_F1_BYTES });
  const p = f1Run(forged, forged.map((r) => ({ ...r })), carrier);
  assert.ok(p.some((x) => x.includes(`serves counterfeit bytes under ${F1_REVIEWED.gitBlob}`)), p.join('|'));
});
test('CURRENT-ONLY F1 SUCCESSOR (unit 41): a mode or kind swap on the successor path refuses', () => {
  const { carrier, treeRows } = f1Fixture();
  const p = f1Run(treeRows, f1Live(treeRows, { gitBlob: F1_GENERATED.gitBlob, content: LIVE_F1_BYTES, mode: '120000' }), carrier);
  assert.ok(p.some((x) => x.includes(`current-transfer mode/kind mismatch at ${F1_REL} in the live HEAD tree`)), p.join('|'));
});
test('CURRENT-ONLY F1 SUCCESSOR (unit 41): the successor row missing from the live tree refuses', () => {
  const { carrier, treeRows } = f1Fixture();
  const p = f1Run(treeRows, treeRows.filter((r) => r.path !== F1_REL).map((r) => ({ ...r })), carrier);
  assert.ok(p.some((x) => x.includes(`current-transfer row missing from the live HEAD tree: ${F1_REL}`)), p.join('|'));
});
test('CURRENT-ONLY F1 SUCCESSOR (unit 41): an unreadable successor blob refuses', () => {
  const { carrier, treeRows } = f1Fixture();
  const p = f1Run(treeRows, f1Live(treeRows, { gitBlob: F1_GENERATED.gitBlob, content: undefined }), carrier);
  assert.ok(p.some((x) => x.includes(`current-only successor path ${F1_REL} blob ${F1_GENERATED.gitBlob} unreadable through the shared git runner`)), p.join('|'));
});
test('CURRENT-ONLY F1 SUCCESSOR (unit 41): the successor pattern applied to any other unadmitted path refuses — no wildcard, class or prefix', () => {
  const { carrier, treeRows } = f1Fixture();
  // The generated successor OID presented under a DIFFERENT reviewed row's live entry must
  // hit the generic unadmitted-replacement refusal — the exception is bound to exactly one
  // path, never to an OID, a filename prefix or a "generated file" class.
  const other = treeRows.find((r) => r.path !== F1_REL && r.path !== S3_LEDGER_REL && !ADMITTED_CURRENT_REPLACEMENTS.some((rep) => rep.path === r.path));
  const liveRows = treeRows.map((r) => (r === other ? { ...r, gitBlob: F1_GENERATED.gitBlob, content: LIVE_F1_BYTES } : { ...r }));
  const p = f1Run(treeRows, liveRows, carrier);
  assert.ok(p.some((x) => x.includes('changed upstream-origin path without an admitted replacement in the live HEAD tree')), p.join('|'));
});
test('CURRENT-ONLY F1 SUCCESSOR (unit 41): a tampered checkpoint origin (neither reviewed nor admitted OID) refuses', () => {
  const { carrier, treeRows } = f1Fixture();
  const checkpointRows = f1Live(treeRows, { gitBlob: hex40('f'), content: CD3_F1_BYTES });
  const p = f1Run(checkpointRows, checkpointRows.map((r) => ({ ...r })), carrier);
  assert.ok(p.some((x) => x.includes(`current-only successor path ${F1_REL} carries ${hex40('f')} in the checkpoint tree`)), p.join('|'));
});
// Root unit-52/53 current-only WORKFLOW successor controls. The expected tuple below is the
// frozen independent Root admission data, NEVER derived from the detector or from a fresh
// generator run; both byte anchors (the frozen checkpoint original + the Root-admitted CI
// repair postimage) are pinned by their full identities so any drift in either anchor
// refuses. Unlike the F1 relation this path is NOT one of the 571 reviewed carrier rows —
// it is a governed checkpoint path consumed by the checkpoint-mutation leg, so the fixture
// carries it in the trees only, never as an upstreamAddition row.
const WF_REL = '.github/workflows/audit-self.yml';
const WF_ORIGINAL = { gitBlob: '8a55d97eb2b92cd4bcdc3e755b1d496e8889437a', sha256: '78946c570a616ced22fe12bd04ec33db58fa59e8389f559e8a36ba78fe584953', bytes: 201512 };
const WF_ADMITTED = { gitBlob: 'd6b869ac7dffb3f9620c7072dc73f03596a9b9d5', sha256: '2910de87d5946bfe0e54985736e5f92fbb32ecb7a964c99d357151b579631342', bytes: 201640 };
const CD3_WF_BYTES = realGit(['cat-file', 'blob', `${CURRENT_TRANSFER_CHECKPOINT.head}:${WF_REL}`]).stdout;
assert.equal(sha(CD3_WF_BYTES), WF_ORIGINAL.sha256);
assert.equal(CD3_WF_BYTES.length, WF_ORIGINAL.bytes);
const LIVE_WF_BYTES = readFileSync(join(REPO_ROOT, WF_REL));
assert.equal(sha(LIVE_WF_BYTES), WF_ADMITTED.sha256, 'the live workflow must be the exact Root-admitted CI repair postimage');
assert.equal(LIVE_WF_BYTES.length, WF_ADMITTED.bytes);
// Root unit-53: the workflow successor surface (checkpoint tree row at the frozen original
// identity) is part of the BASE fixture alongside the F1 row — the dead-entry guard demands
// every admitted successor entry bind a live surface in every fixture, so the workflow arms
// below mutate the shared surface per leg instead of assembling it here.
const wfFixture = () => transferFixture();
const wfRun = (treeRows, liveRows, carrier) => reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(treeRows, { liveRows }), carrier: { ok: true, data: carrier } });
const wfLive = (rows, over) => rows.map((r) => (r.path === WF_REL ? { ...r, ...over } : { ...r }));
test('CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): the exact Root-admitted CI repair postimage on the live leg admits (checkpoint keeps the frozen original)', () => {
  const { carrier, treeRows } = wfFixture();
  assert.deepEqual(wfRun(treeRows, wfLive(treeRows, { gitBlob: WF_ADMITTED.gitBlob, content: LIVE_WF_BYTES }), carrier), []);
});
test('CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): the unchanged original on both legs admits — live-original compatibility', () => {
  const { carrier, treeRows } = wfFixture();
  assert.deepEqual(wfRun(treeRows, treeRows.map((r) => ({ ...r })), carrier), []);
});
test('CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): the successor appearing in the checkpoint leg refuses — the frozen checkpoint identity never updates', () => {
  const { carrier, treeRows } = wfFixture();
  const checkpointRows = wfLive(treeRows, { gitBlob: WF_ADMITTED.gitBlob, content: LIVE_WF_BYTES });
  const p = wfRun(checkpointRows, checkpointRows.map((r) => ({ ...r })), carrier);
  assert.ok(p.some((x) => x.includes(`current-only successor path ${WF_REL} carries 100644/blob ${WF_ADMITTED.gitBlob} in the checkpoint tree`)), p.join('|'));
});
test('CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): an unknown live replacement OID refuses — only the original or the one exact successor admit', () => {
  const { carrier, treeRows } = wfFixture();
  // hex40('d') — the ls-tree parser only admits 40-hex OIDs, so the unknown replacement is a
  // well-formed but unadmitted hex OID, exactly the real forgery class this arm refuses.
  const p = wfRun(treeRows, wfLive(treeRows, { gitBlob: hex40('d'), content: LIVE_WF_BYTES }), carrier);
  assert.ok(p.some((x) => x.includes(`current-only successor path ${WF_REL} carries ${hex40('d')} in the live HEAD tree`)), p.join('|'));
});
test('CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): a mode or kind swap on the live leg refuses', () => {
  const { carrier, treeRows } = wfFixture();
  const p = wfRun(treeRows, wfLive(treeRows, { gitBlob: WF_ADMITTED.gitBlob, content: LIVE_WF_BYTES, mode: '120000' }), carrier);
  assert.ok(p.some((x) => x.includes(`current-only successor path ${WF_REL} live mode/kind mismatch`)), p.join('|'));
});
test('CURRENT-ONLY WORKFLOW SUCCESSOR (unit 54): unchanged mode with a wrong live kind refuses while the paired restored-kind control admits', () => {
  const { carrier, treeRows } = wfFixture();
  // kind-only variant: the mode-swap arm above changes mode alone; this exercises the other
  // dimension of the same typed contract — mode stays 100644 while kind becomes 'tree', so
  // the refusal must fire on the kind alone (a gitlink/subtree swap under a regular mode).
  const p = wfRun(treeRows, wfLive(treeRows, { gitBlob: WF_ADMITTED.gitBlob, content: LIVE_WF_BYTES, kind: 'tree' }), carrier);
  assert.ok(p.some((x) => x.includes(`current-only successor path ${WF_REL} live mode/kind mismatch (checkpoint 100644/blob -> live 100644/tree`)), p.join('|'));
  // paired healthy control: the identical fixture shape with the kind restored to blob admits.
  const healthy = wfRun(treeRows, wfLive(treeRows, { gitBlob: WF_ADMITTED.gitBlob, content: LIVE_WF_BYTES }), carrier);
  assert.deepEqual(healthy, []);
});
test('CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): the workflow path missing from the live tree refuses — deletion is not an admitted successor', () => {
  const { carrier, treeRows } = wfFixture();
  const p = wfRun(treeRows, treeRows.filter((r) => r.path !== WF_REL).map((r) => ({ ...r })), carrier);
  assert.ok(p.some((x) => x.includes(`original current path missing from the live HEAD tree: ${WF_REL}`)), p.join('|'));
});
test('CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): an unreadable successor or original blob refuses', () => {
  const { carrier, treeRows } = wfFixture();
  const unreadableLive = wfRun(treeRows, wfLive(treeRows, { gitBlob: WF_ADMITTED.gitBlob, content: undefined }), carrier);
  assert.ok(unreadableLive.some((x) => x.includes(`current-only successor path ${WF_REL} blob ${WF_ADMITTED.gitBlob} unreadable through the shared git runner`)), unreadableLive.join('|'));
  // The original-OID unreadable variant plants the missing object in the shared checkpoint
  // row itself (the fake runner resolves cat-file by gitBlob, tree rows first), so BOTH legs
  // present the original OID while no object is servable for it.
  const originalFixture = wfFixture();
  const originalGone = originalFixture.treeRows.map((r) => (r.path === WF_REL ? { ...r, content: undefined } : { ...r }));
  const p2 = wfRun(originalGone, originalGone.map((r) => ({ ...r })), originalFixture.carrier);
  assert.ok(p2.some((x) => x.includes(`current-only successor path ${WF_REL} blob ${WF_ORIGINAL.gitBlob} unreadable through the shared git runner`)), p2.join('|'));
});
test('CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): counterfeit bytes served under the successor OID refuse', () => {
  const { carrier, treeRows } = wfFixture();
  const p = wfRun(treeRows, wfLive(treeRows, { gitBlob: WF_ADMITTED.gitBlob, content: CD3_WF_BYTES }), carrier);
  assert.ok(p.some((x) => x.includes(`current-only successor path ${WF_REL} serves counterfeit bytes under ${WF_ADMITTED.gitBlob}`)), p.join('|'));
});
test('CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): counterfeit bytes served under the original OID refuse', () => {
  const { carrier, treeRows } = wfFixture();
  // The fake runner resolves cat-file by gitBlob (tree rows first), so the original-OID
  // counterfeit is planted in the shared row itself: the original OID is presented on both
  // legs while the bytes served are the admitted successor — a pass here would mean OID
  // trust without content binding.
  const forged = wfLive(treeRows, { content: LIVE_WF_BYTES });
  const p = wfRun(forged, forged.map((r) => ({ ...r })), carrier);
  assert.ok(p.some((x) => x.includes(`current-only successor path ${WF_REL} serves counterfeit bytes under ${WF_ORIGINAL.gitBlob}`)), p.join('|'));
});
test('CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): the admitted successor OID presented under a different non-row path refuses — no wildcard, class or prefix', () => {
  const { carrier, treeRows } = wfFixture();
  // The successor OID presented under a DIFFERENT non-row checkpoint path's live entry must
  // hit the generic unadmitted-mutation refusal — the exception is bound to exactly one
  // path, never to an OID, a filename class or a prefix.
  treeRows.push({ path: 'upstream/other-checkpoint-path.md', mode: '100644', kind: 'blob', gitBlob: hex40('b'), content: Buffer.from('plain original checkpoint bytes\n') });
  const liveRows = treeRows.map((r) => (r.path === 'upstream/other-checkpoint-path.md' ? { ...r, gitBlob: WF_ADMITTED.gitBlob, content: LIVE_WF_BYTES } : { ...r }));
  const p = wfRun(treeRows, liveRows, carrier);
  assert.ok(p.some((x) => x.includes('changed current source path without an admitted replacement or governed binding: upstream/other-checkpoint-path.md')), p.join('|'));
});
test('CURRENT-ONLY WORKFLOW SUCCESSOR (unit 53): a successor entry binding neither a reviewed row nor a checkpoint path refuses — a dead admission entry never normalizes', async () => {
  // A path in NEITHER the reviewed row set NOR the checkpoint tree would make the relation
  // entry inert: it normalizes nothing and its presence carries no admission weight. The
  // intact production relation stays clean on the healthy fixture, and the counterfactual
  // is proven on an in-memory neutralized copy of the production module (same technique as
  // the detector-disabled test below — no file on disk is modified).
  const { carrier, treeRows } = wfFixture();
  assert.deepEqual(wfRun(treeRows, wfLive(treeRows, { gitBlob: WF_ADMITTED.gitBlob, content: LIVE_WF_BYTES }), carrier), []);
  const sourcePath = join(REPO_ROOT, 'scripts/test-assurance/s3.mjs');
  const healthySource = readFileSync(sourcePath, 'utf8');
  const DEAD_FROM = "    path: '.github/workflows/audit-self.yml',";
  const DEAD_TO = "    path: 'upstream/dead-never-admitted-path.md',";
  const occurrences = healthySource.split(DEAD_FROM).length - 1;
  assert.equal(occurrences, 1, 'the workflow successor entry must appear exactly once in the production relation');
  const deadModule = await import(`data:text/javascript;base64,${Buffer.from(healthySource.replace(DEAD_FROM, DEAD_TO), 'utf8').toString('base64')}`);
  const p = deadModule.reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git: fakeTransferGit(treeRows, { liveRows: wfLive(treeRows, { gitBlob: WF_ADMITTED.gitBlob, content: LIVE_WF_BYTES }) }), carrier: { ok: true, data: carrier } });
  assert.ok(p.some((x) => x.includes('current-only successor entry upstream/dead-never-admitted-path.md binds neither a reviewed row nor a checkpoint tree path')), p.join('|'));
});
test('UPSTREAM-TRANSFER: the actual lineage detector disabled counterfactual - intact refuses a bad isolated fixture, the narrowly disabled detector incorrectly allows it, restored bytes refuse again', async () => {
  // U33-K3-1 / Root unit-35 item 4: a failing git process is NOT a disabled mechanism (that
  // arm lives above as the producer-off refusal), and a production rowDetector seam is NOT a
  // mechanism-disabled consumer (the seam is gone from production). The ACTUAL detector is
  // narrowly disabled in a RETAINED IN-MEMORY SOURCE COPY of the production module — the
  // per-row loop neutralized by one exact unique replacement guarded by an occurrence-count
  // assertion — and the copy is imported and exercised through the same public consumer:
  // intact refuses, the disabled copy incorrectly allows (the frozen negative assertion
  // fails), and the untouched original module still refuses afterward. No file on disk is
  // modified; real workflow bytes stay unchanged.
  const { carrier, treeRows } = transferFixture();
  const badCarrier = structuredClone(carrier);
  const changed = treeRows.map((r) => ({ ...r }));
  changed[10] = { ...changed[10], gitBlob: hex40('c') };
  const git = fakeTransferGit(changed);
  const frozenNegative = (problems) => problems.some((x) => x.includes('changed upstream-origin path without an admitted replacement'));
  const intact = reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git, carrier: { ok: true, data: badCarrier } });
  assert.ok(frozenNegative(intact), intact.join('|'));
  const sourcePath = join(REPO_ROOT, 'scripts/test-assurance/s3.mjs');
  const healthySource = readFileSync(sourcePath, 'utf8');
  const M02T_FROM = 'for (const { map, label } of [checkpointTree, liveTree]) {';
  const M02T_TO = 'for (const { map, label } of []) { // NEUTRALIZED-guard-live-transfer-row-detector';
  const loopCount = healthySource.split(M02T_FROM).length - 1;
  assert.equal(loopCount, 1, 'the production per-row detector loop must appear exactly once');
  const disabledSource = healthySource.replace(M02T_FROM, M02T_TO);
  assert.equal(disabledSource.split(M02T_TO).length - 1, loopCount, 'the neutralized guard replaces the loop exactly');
  const disabledModule = await import(`data:text/javascript;base64,${Buffer.from(disabledSource, 'utf8').toString('base64')}`);
  const disabled = disabledModule.reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git, carrier: { ok: true, data: badCarrier } });
  assert.equal(frozenNegative(disabled), false, 'the narrowly disabled detector copy incorrectly allows the bad fixture — the SAME frozen negative assertion fails, which is exactly why the intact detector is load-bearing');
  const restored = reconcileCurrentTransfer({ repoRoot: ensureBaselineLedgerRoot(), git, carrier: { ok: true, data: badCarrier } });
  assert.ok(frozenNegative(restored), restored.join('|'));
});
test('PORTABLE-REFERENCE: the admitted bundle artifact is byte-pinned and a truncated, corrupted or foreign artifact refuses before any transport', () => {
  const loaded = loadPortableReference(REPO_ROOT);
  assert.equal(loaded.absent, false);
  assert.equal(loaded.ok, true, loaded.problems?.join('|'));
  // Retained fixture tree (no rmSync — new fixtures stay on disk per the retention rule).
  const tmp = mkdtempSync(join(tmpdir(), 'tak-portable-bytes-'));
  mkdirSync(join(tmp, 'docs/test-assurance-kernel/s2'), { recursive: true });
  const good = readFileSync(join(REPO_ROOT, PORTABLE_REFERENCE_REL));
  const truncated = Buffer.from(good.subarray(0, PORTABLE_REFERENCE_BYTES - 1));
  writeFileSync(join(tmp, PORTABLE_REFERENCE_REL), truncated);
  const t1 = loadPortableReference(tmp);
  assert.equal(t1.ok, false);
  assert.ok(t1.problems.some((x) => x.includes('is not the admitted 1034715')), t1.problems.join('|'));
  const corrupted = Buffer.from(good);
  corrupted[200000] ^= 0xff;
  writeFileSync(join(tmp, PORTABLE_REFERENCE_REL), corrupted);
  const t2 = loadPortableReference(tmp);
  assert.equal(t2.ok, false);
  assert.ok(t2.problems.some((x) => x.includes('sha drifted from the admitted Root bytes')), t2.problems.join('|'));
  writeFileSync(join(tmp, PORTABLE_REFERENCE_REL), Buffer.alloc(PORTABLE_REFERENCE_BYTES, 0x41));
  const t3 = loadPortableReference(tmp);
  assert.equal(t3.ok, false);
  assert.ok(t3.problems.some((x) => x.includes('sha drifted from the admitted Root bytes')), t3.problems.join('|'));
});
// One shared, retained, uniquely owned hydrated store for the hydration/custody arms (built
// once; the mkdtemp directory deliberately persists — no deletion primitive is introduced).
let hydratedStore = null;
const ensureHydratedStore = () => {
  if (hydratedStore) return hydratedStore;
  const storeDir = mkdtempSync(join(tmpdir(), 'tak-portable-store-'));
  const result = hydratePortableReferenceStore({ repoRoot: REPO_ROOT, storeDir });
  assert.deepEqual(result.problems, [], result.problems.join('|'));
  assert.equal(result.ok, true);
  hydratedStore = { storeDir, result };
  return hydratedStore;
};
test('PORTABLE-REFERENCE: hydration from published objects only builds a uniquely owned isolated store - six objects absent before, exact tuples after, real chain preserved, generation NOT ancestor of published staging', () => {
  const sharedRefsBefore = realGit(['for-each-ref', '--format=%(refname)']).stdout.toString().trim().split('\n').filter(Boolean);
  const { storeDir } = ensureHydratedStore();
  const g = makeIsolatedGit(storeDir);
  for (const t of PORTABLE_REFERENCE_TUPLES) {
    const tree = g(['rev-parse', `${t.commit}^{tree}`]);
    assert.equal(tree.rc, 0);
    assert.equal(tree.stdout.toString().trim(), t.tree, `${t.commit} must hydrate to its exact reviewed tree`);
  }
  const refs = g(['for-each-ref', '--format=%(refname)']).stdout.toString().trim().split('\n').filter(Boolean).sort();
  assert.deepEqual(refs, ['refs/heads/cf64-reference-evidence', 'refs/heads/published-staging'].sort());
  // Historical generation is NOT an ancestor of published staging (portability never
  // rewrites ancestry); the prerequisite IS (that is what makes the bundle transportable).
  for (const t of PORTABLE_REFERENCE_TUPLES) {
    assert.notEqual(g(['merge-base', '--is-ancestor', t.commit, 'refs/heads/published-staging']).rc, 0, `${t.commit} must not be an ancestor of published staging`);
  }
  const sharedRefsAfter = realGit(['for-each-ref', '--format=%(refname)']).stdout.toString().trim().split('\n').filter(Boolean);
  assert.deepEqual(sharedRefsAfter, sharedRefsBefore, 'hydration must not write any ref into the shared repository');
});
test('PORTABLE-REFERENCE: a corrupted pack refuses natively and no shared git state is written (store custody stays private and retained)', () => {
  const { storeDir } = ensureHydratedStore();
  const g = makeIsolatedGit(storeDir);
  assert.equal(existsSync(join(storeDir, 'objects', 'info', 'alternates')), false, 'the isolated store must not borrow objects through alternates');
  // Corrupted copy: byte-pinned transport refuses at the artifact gate...
  const tmp = mkdtempSync(join(tmpdir(), 'tak-portable-corrupt-'));
  const corruptedPath = join(tmp, 'corrupted-reference.bundle');
  const good = readFileSync(join(REPO_ROOT, PORTABLE_REFERENCE_REL));
  const corrupted = Buffer.from(good);
  corrupted[200000] ^= 0xff;
  writeFileSync(corruptedPath, corrupted);
  const refused = hydratePortableReferenceStore({ repoRoot: REPO_ROOT, storeDir: mkdtempSync(join(tmpdir(), 'tak-portable-refuse-')), bundlePath: corruptedPath });
  assert.equal(refused.ok, false);
  assert.ok(refused.problems.some((x) => x.includes('transport source is not the admitted artifact')), refused.problems.join('|'));
  // ...and stock git itself refuses the corrupted pack natively at transport time. A fetch
  // from this bundle short-circuits in THIS store (the advertised commit is already present,
  // so no pack bytes are read and git reports success); `git bundle unbundle` always hands
  // the pack to index-pack regardless of what the store already holds, so the corrupted
  // stream dies natively — direct native status and stderr preserved.
  const nativeUnbundle = g(['bundle', 'unbundle', corruptedPath]);
  assert.notEqual(nativeUnbundle.rc, 0, 'a real unpack of the corrupted bundle must fail natively in index-pack');
  assert.ok(nativeUnbundle.stderr.toString().includes('index-pack'), nativeUnbundle.stderr.toString());
  assert.equal(g(['rev-parse', '--verify', 'refs/heads/corrupt-probe']).rc !== 0, true, 'the failed transport must leave no probe ref behind');
  // Wrong provenance: a well-formed bundle from an unrelated scratch history is not the
  // admitted artifact and never reaches transport.
  const scratch = mkdtempSync(join(tmpdir(), 'tak-portable-scratch-'));
  const sg = makeIsolatedGit(scratch);
  assert.equal(sg(['init', '--quiet']).rc, 0);
  const commit = sg(['-c', 'user.email=fixture@example.invalid', '-c', 'user.name=fixture', 'commit', '--allow-empty', '-m', 'unrelated']);
  assert.equal(commit.rc, 0, commit.stderr.toString());
  const wrongBundle = join(scratch, 'wrong.bundle');
  assert.equal(sg(['bundle', 'create', wrongBundle, '--all']).rc, 0);
  const wrong = hydratePortableReferenceStore({ repoRoot: REPO_ROOT, storeDir: mkdtempSync(join(tmpdir(), 'tak-portable-wrong-')), bundlePath: wrongBundle });
  assert.equal(wrong.ok, false);
  assert.ok(wrong.problems.some((x) => x.includes('transport source is not the admitted artifact')), wrong.problems.join('|'));
});
