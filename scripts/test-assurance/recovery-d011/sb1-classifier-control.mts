// SB1/R4 production conformance control — D011 source cycle (amended-2 companion chain +
// amended-3 four-anchor classifier; independently frozen inputs).
//
// WHAT THIS IS: the unit-level control that judges the PINNED report inputs through the
// PRODUCTION export `classifyVitestReport` of packages/core/principles/52-subprocess-status-
// conformance.ts — never a local copy of the predicate. Expected classifications are frozen
// INSIDE the fixture packets (cx*.json `expected_*` fields; reports/roots.json sidecar),
// authored and independently reviewed BEFORE this repair existed — the oracle is not derived
// from the implementation (spec §4: the regression oracle must not reuse the decision
// procedure to compute the expected decision).
//
// RED CONTRACT (TDD, D011 directive: first meaningful production RED with the independently
// frozen oracle): while the production module does not export classifyVitestReport, this
// control exits 1 naming that absence — the strict classifier is missing from the genuine
// production surface. After the SB1 companion-chain repair lands, the same control must
// exit 0 with every pinned input matching its frozen expectation.
//
// EXIT GRAMMAR (T-TAK-A):
//   0  every pinned input classified exactly as frozen through the production export
//   1  RED: production export absent, a verdict mismatch, or fixture-hash drift (tampered
//      evidence is a REAL failure, never infrastructure)
//   3  INFRASTRUCTURE: fixture file missing, JSON unreadable — the control cannot run
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prod from '../../../packages/core/principles/52-subprocess-status-conformance.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const FX = join(HERE, 'fixtures', 'r4-runner');
const CX3 = join(HERE, 'classifiers', 'cx3.json');
const sha256 = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');

const infra = (msg: string): never => {
  console.error(`SB1-CONTROL INFRA: ${msg}`);
  process.exit(3);
};
const red = (msg: string): never => {
  console.error(`SB1-CONTROL RED: ${msg}`);
  process.exit(1);
};

// Frozen fixture integrity pins (amended-2 r4-runner freeze + amended-3 cx3; the copies
// under recovery-d011/fixtures are byte-identical to the frozen packet sources).
const FROZEN_SHA256: Record<string, string> = {
  'counterexamples/cx1.json': '60e49a14f6bf62b15ce4791932675ec1c1eef8d57b4871f0c8302af7fe757340',
  'counterexamples/cx2.json': '8531970df9c02f1c86402ef541fc80bd66b44c0eb455835b18f863218945f501',
  'counterexamples/cx2b.json': 'f659ff94b6865383a96e23eb1cf3a040b4ff73d8d540c9243820d77228aa08c1',
  'reports/empty-results.report.json': '3ce2081708b43f16282ab311a0587419b758fe791c25857009f781ccbd79554c',
  'reports/malformed-assertion-status.report.json': 'a2adf2e297daeb4a6b2e101dad1b5afb389480895490804e5e0d0397a3a1a859',
  'reports/malformed-file-status.report.json': 'f5d770fc4f4e108618f2ff6dfad38b976499fa03906bedebe409bf76aea1614d',
  'reports/malformed-success.report.json': '536b45395b1749af143ba7537fb4a21fe477b91d1ee36a278331a82ef597ef57',
  'reports/malformed-total.report.json': '8e684627f6260f22d739d72ac466e97bb926dadaaeb7f1be5eee323015e43929',
  'reports/mixed.report.json': '06b5bc9351bffe0b9b26baaa2b676ab8308c841ab9320fa103f5bd858d90215d',
  'reports/passskip.report.json': 'b89579030eb9ebe991adf563eb644666b2024cced9a18d510e863f5cc6f7db0d',
  'reports/roots.json': '79a23feac96f27a78caafa2278a2fedce2302fd29dab8fdb4a2707179586e849',
  'reports/unhandled-only.report.json': '15687856480387c6fb01723aea98839dfe6c091dc60ab8e77b13d86155a4e695',
  'reports/unknown-shape.report.json': 'e3801691dd0dc80b9958753f3753eaa3059a6e0eb20e22320bd26e284409a962',
  'reports/wrong-identity.report.json': '90c960c261bad06d598b65552286d90b06a56ed2892aee7d06a0bf54a4c84ad6',
};
const CX3_SHA256 = '11a36b2e3e10b213232ec3f741d434bc576de31ae54bf1ec5013f9d8e222b53a';

for (const [rel, want] of Object.entries(FROZEN_SHA256)) {
  const abs = join(FX, rel);
  if (!existsSync(abs)) infra(`frozen fixture missing: ${rel}`);
  const got = sha256(abs);
  if (got !== want) red(`frozen fixture hash drift: ${rel} ${got.slice(0, 12)}… != ${want.slice(0, 12)}… — tampered evidence`);
}
if (!existsSync(CX3)) infra('frozen fixture missing: classifiers/cx3.json');
if (sha256(CX3) !== CX3_SHA256) red(`frozen fixture hash drift: classifiers/cx3.json — tampered evidence`);

// THE PRODUCTION SURFACE UNDER TEST: the export must exist on the genuine module.
const classify = (prod as { classifyVitestReport?: unknown }).classifyVitestReport;
if (typeof classify !== 'function') {
  red(
    'production module packages/core/principles/52-subprocess-status-conformance.ts does not export classifyVitestReport — the strict runner-result grammar is absent from the genuine production surface (D011 S1-R4; amended-2 companion chain not applied)',
  );
}

interface PinnedInput {
  filters: string[];
  report: unknown;
  stdout: string;
  exitCode: number | null;
  rootDir: string;
  expected: string;
  label: string;
}
const inputs: PinnedInput[] = [];

// 1. coordinator counterexamples cx1/cx2/cx2b (expected frozen as expected_amended2)
for (const id of ['cx1', 'cx2', 'cx2b'] as const) {
  const p = join(FX, 'counterexamples', `${id}.json`);
  if (!existsSync(p)) infra(`counterexample missing: ${id}`);
  const cx = JSON.parse(readFileSync(p, 'utf8')) as {
    tag: string; filters: string[]; report: unknown; stdout: string; exitCode: number | null; rootDir: string; expected_amended2: string;
  };
  inputs.push({
    filters: cx.filters, report: cx.report, stdout: cx.stdout ?? '', exitCode: cx.exitCode ?? null,
    rootDir: cx.rootDir, expected: cx.expected_amended2, label: `${id} (${cx.tag})`,
  });
}
// 2. the archived + synthetic report fixtures via the roots.json sidecar
const sidecarPath = join(FX, 'reports', 'roots.json');
if (!existsSync(sidecarPath)) infra('roots.json sidecar missing');
const sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8')) as {
  reports: Record<string, { filters: string[]; stdout: string; exitCode: number; rootDir: string; expected: string }>;
};
for (const [name, r] of Object.entries(sidecar.reports)) {
  const p = join(FX, 'reports', name);
  if (!existsSync(p)) infra(`report fixture missing: ${name}`);
  inputs.push({
    filters: r.filters, report: JSON.parse(readFileSync(p, 'utf8')), stdout: r.stdout,
    exitCode: r.exitCode, rootDir: r.rootDir, expected: r.expected,
    label: name.replace(/\.report\.json$/, ''),
  });
}
// 3. cx3 — the A3 causal input; the ACCEPTED verdict is the amended-3 expectation
//    (same-file failed+pending must read not-executed, before any detection credit).
const cx3 = JSON.parse(readFileSync(CX3, 'utf8')) as {
  tag: string; filters: string[]; report: unknown; stdout: string; exitCode: number | null; rootDir: string; expected_am3: string;
};
inputs.push({
  filters: cx3.filters, report: cx3.report, stdout: cx3.stdout ?? '', exitCode: cx3.exitCode ?? null,
  rootDir: cx3.rootDir, expected: cx3.expected_am3, label: `cx3 (${cx3.tag}) [A3]`,
});

if (inputs.length < 14) infra(`pinned input population shrank: ${inputs.length} < 14 (T-TAK-A)`);

// Judge every pinned input through the PRODUCTION predicate; expected values are frozen
// in the fixtures — this control computes nothing itself.
const fn = classify as (
  filters: string[], report: never, stdout: string, exitCode: number | null, rootDir: string,
) => { classification: string; detail?: string };
let bad = 0;
for (const inp of inputs) {
  const out = fn(inp.filters, inp.report as never, inp.stdout, inp.exitCode, inp.rootDir);
  const ok = out.classification === inp.expected;
  if (!ok) bad += 1;
  console.log(
    `SB1-JUDGE ${ok ? 'OK' : 'MISMATCH'} ${inp.label} got=${out.classification} want=${inp.expected}${ok ? '' : ` detail=${out.detail ?? '(none)'}`}`,
  );
}
if (bad > 0) red(`${bad}/${inputs.length} pinned input(s) misclassified through the production export — the strict grammar does not hold on the genuine surface`);
console.log(`SB1-CONTROL PASS: ${inputs.length}/${inputs.length} pinned inputs match their frozen expectations through the production classifyVitestReport export`);
process.exit(0);
