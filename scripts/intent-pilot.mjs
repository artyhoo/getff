#!/usr/bin/env node
/**
 * intent-pilot — intent-first-result S1 Task 10: reproducible disposable-consumer capture.
 *
 * Sets up disposable npm consumers (temporary ESLint flat config + paired sample files) and runs
 * the INSTALLED local eslint command from this repo's own node_modules — the real CLI, never a
 * rule-tester projection — capturing full raw diagnostics (source, location, rule, message),
 * exit codes and command identities into an evidence package.
 *
 * Discriminating contrast (spec §1 worked example): TWO consumers are captured whose configs
 * differ ONLY in the rule message string — the canonical fixture claim (replacement guidance)
 * and a degraded opaque code (no guidance). Selector and severity are identical by construction,
 * so any detection difference is message-independent and any message difference is
 * detection-independent. The canonical rule family is never touched.
 *
 * Advisor blindness, honestly bounded:
 *   - WITHIN the package, blindness is structural: sample ids are hash-derived from the
 *     message (not invertible, not positional), and the package contains no variant labels
 *     and no generation material;
 *   - the id→message map is written ONLY to the `--variant-map` path, and a path inside the
 *     evidence directory is refused (realpath-compared — a symlinked evidence dir cannot
 *     alias the map into the package);
 *   - a REPO-AWARE reader can still re-derive which consumer is canonical (the fixture's
 *     repo path + sha256 are in the manifest by design, for replay) — the package is blind
 *     to an advisor who receives only the package, which is the contract the operator runs.
 *   - this script contacts no model and makes no network calls — it manufactures no verdicts.
 *     It verifies DETECTION only (env read fails via the rule, accessor form passes); judging
 *     message quality is the advisor's job, outside this script.
 *
 * The rendered config entry is the canonical npm-backend projection (from-node.ts
 * renderRestrictedEntry); the paired suite pins byte-equality to the real renderer.
 *
 * Usage:
 *   node scripts/intent-pilot.mjs --evidence <dir> [--work <dir>] [--variant-map <file>] [--keep]
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, basename } from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isMainEntry } from './lib/is-main-entry.mjs';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CANONICAL_FIXTURE_REL = 'packages/core/composition/fixtures/no-direct-process-env.node.json';

/** Degraded sample message: an opaque code with no replacement guidance (spec §1 degraded variant). */
export const OPAQUE_MESSAGE = 'restricted-syntax: forbidden pattern matched (ref NRE-042)';

/** Paired sample sources — neutral names; the code forms come from the fixture's pairedExamples. */
const SAMPLE_FILES = ['sample-a.js', 'sample-b.js'];
const SAMPLE_SOURCES = {
  'sample-a.js': '// sample file A\nconst url = process.env.DATABASE_URL;\nconsole.log(url);\n',
  'sample-b.js': "// sample file B\nconst url = config.get('databaseUrl');\nconsole.log(url);\n",
};

const CONSUMER_FILES = ['eslint.config.mjs', ...SAMPLE_FILES];

const sha256File = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const sha256Text = (text) => createHash('sha256').update(text).digest('hex');

export function loadCanonicalFixture() {
  return JSON.parse(readFileSync(join(REPO_ROOT, CANONICAL_FIXTURE_REL), 'utf8'));
}

/** Hash-derived opaque sample id — never positional, never label-bearing. */
export const sampleIdFor = (message) => `sample-${sha256Text(message).slice(0, 8)}`;

/** The two capture subjects: the canonical claim and the degraded opaque code. */
export function planSamples(fixture) {
  return [
    { message: fixture.claim, kind: 'canonical-claim' },
    { message: OPAQUE_MESSAGE, kind: 'degraded-guidance' },
  ].map((s) => ({ ...s, id: sampleIdFor(s.message) }));
}

/**
 * The eslint config entry for a forbid fixture — byte-identical to the npm backend's
 * renderRestrictedEntry projection (pinned by the paired suite against the real renderer).
 */
export function renderConfigEntry(fixture, message) {
  if (fixture.params.presence !== 'forbid') {
    throw new Error(`pilot renders presence=forbid fixtures only, got "${fixture.params.presence}"`);
  }
  return JSON.stringify(['error', { selector: fixture.params.selector, message: message ?? fixture.claim }]);
}

export function renderFlatConfig(fixture, message) {
  const header = '// Disposable consumer config — generated for a local capture run, not part of the repository.\n';
  return `${header}export default [\n  {\n    rules: {\n      'no-restricted-syntax': ${renderConfigEntry(fixture, message)},\n    },\n  },\n];\n`;
}

export function buildSample(dir, fixture, sample) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify({ name: sample.id, version: '0.0.0', private: true }, null, 2)}\n`);
  writeFileSync(join(dir, 'eslint.config.mjs'), renderFlatConfig(fixture, sample.message));
  for (const name of SAMPLE_FILES) writeFileSync(join(dir, name), SAMPLE_SOURCES[name]);
}

export function findEslintBin() {
  const candidates = [
    join(REPO_ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js'),
    join(REPO_ROOT, 'packages', 'core', 'node_modules', 'eslint', 'bin', 'eslint.js'),
  ];
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  throw new Error('eslint not found under repo node_modules — run the workspace install first');
}

/** Run the installed local eslint CLI on one sample file. */
export function runEslint(sampleDir, fileName, eslintBin = findEslintBin()) {
  const args = [eslintBin, '--config', 'eslint.config.mjs', '--format', 'json', fileName];
  const res = spawnSync(process.execPath, args, { cwd: sampleDir, encoding: 'utf8', timeout: 60_000 });
  return {
    exitCode: res.status ?? 2,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? (res.error ? String(res.error) : ''),
    command: `node ${args.join(' ')}`,
  };
}

/** Structured view of `--format json` output: source, location, rule, message per diagnostic. */
export function parseDiagnostics(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const messages = [];
  for (const result of parsed) {
    for (const m of result.messages ?? []) {
      messages.push({
        filePath: result.filePath ?? null,
        ruleId: m.ruleId ?? null,
        severity: m.severity ?? null,
        message: m.message ?? null,
        line: m.line ?? null,
        column: m.column ?? null,
        endLine: m.endLine ?? null,
        endColumn: m.endColumn ?? null,
        source: m.source ?? null,
      });
    }
  }
  return messages;
}

/**
 * Capture one consumer: run both sample files and verify DETECTION mechanically — the env read
 * fails through no-restricted-syntax (exit 1, not a config crash), the accessor form passes.
 * Never judges message content.
 */
export function captureSample(sampleDir, sample, eslintBin = findEslintBin()) {
  const runs = {};
  for (const fileName of SAMPLE_FILES) runs[fileName] = runEslint(sampleDir, fileName, eslintBin);
  const vRun = runs[SAMPLE_FILES[0]];
  const cRun = runs[SAMPLE_FILES[1]];
  const vDiags = parseDiagnostics(vRun.stdout) ?? [];
  const cDiags = parseDiagnostics(cRun.stdout) ?? [];
  const violation = {
    exitCode: vRun.exitCode,
    ruleIds: vDiags.map((d) => d.ruleId).filter(Boolean),
    first: vDiags[0] ?? null,
  };
  const conforming = { exitCode: cRun.exitCode, ruleIds: cDiags.map((d) => d.ruleId).filter(Boolean) };
  const ok =
    violation.exitCode === 1 &&
    violation.ruleIds.includes('no-restricted-syntax') &&
    conforming.exitCode === 0 &&
    conforming.ruleIds.length === 0;
  return { id: sample.id, ok, violation, conforming, runs, commands: SAMPLE_FILES.map((f) => runs[f].command) };
}

/**
 * Write the advisor-facing evidence package: manifest + per-sample consumer files, raw eslint
 * output and digests. No variant labels, no generation material, no map — the package alone
 * cannot reveal which consumer carried which message beyond what the raw configs literally say.
 */
export function writeEvidencePackage(evidenceDir, captures) {
  if (existsSync(evidenceDir) && readdirSync(evidenceDir).length > 0) {
    throw new Error(`evidence directory is not empty, refusing to mix packages: ${evidenceDir}`);
  }
  mkdirSync(evidenceDir, { recursive: true });
  const manifest = {
    stage: 'intent-first-result S1 capture',
    nodeVersion: process.version,
    eslintVersion: eslintVersion(),
    fixture: { path: CANONICAL_FIXTURE_REL, sha256: sha256File(join(REPO_ROOT, CANONICAL_FIXTURE_REL)) },
    samples: [],
  };
  for (const { dir, sample, capture } of captures) {
    const outDir = join(evidenceDir, sample.id);
    mkdirSync(outDir, { recursive: true });
    const files = [];
    for (const name of CONSUMER_FILES) {
      copyFileSync(join(dir, name), join(outDir, name));
      files.push({ name, sha256: sha256File(join(outDir, name)) });
    }
    for (const fileName of SAMPLE_FILES) {
      const run = capture.runs[fileName];
      writeFileSync(join(outDir, `${fileName}.stdout.json`), run.stdout);
      writeFileSync(join(outDir, `${fileName}.stderr.txt`), run.stderr);
    }
    manifest.samples.push({
      id: sample.id,
      files,
      runs: SAMPLE_FILES.map((fileName) => ({
        file: fileName,
        exitCode: capture.runs[fileName].exitCode,
        command: capture.runs[fileName].command,
      })),
    });
  }
  writeFileSync(join(evidenceDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/** The observer-side id→message record. NEVER lands inside the evidence directory. */
export function writeVariantMap(mapPath, { evidenceDir, captures }) {
  // Realpath BOTH sides before the containment check: a purely lexical relative() can be
  // aliased around by a symlinked evidence dir (cold-review M4, 2026-10-10). The map path may
  // not exist yet — realpath its nearest existing ancestor and rejoin the remainder.
  const realpathish = (p) => {
    const abs = resolve(p);
    try {
      return realpathSync(abs);
    } catch {
      const parent = realpathish(dirname(abs));
      return join(parent, basename(abs));
    }
  };
  const rel = relative(realpathish(evidenceDir), realpathish(mapPath));
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
    throw new Error(`refusing to write the observer record inside the evidence package: ${mapPath}`);
  }
  mkdirSync(dirname(resolve(mapPath)), { recursive: true });
  const samples = {};
  for (const { sample } of captures) samples[sample.id] = { message: sample.message, kind: sample.kind };
  writeFileSync(mapPath, `${JSON.stringify({ stage: 'intent-first-result S1 observer record', samples }, null, 2)}\n`);
}

let cachedVersion = null;
function eslintVersion() {
  if (cachedVersion) return cachedVersion;
  const res = spawnSync(process.execPath, [findEslintBin(), '--version'], { encoding: 'utf8', timeout: 30_000 });
  cachedVersion = (res.stdout ?? '').trim() || 'unknown';
  return cachedVersion;
}

function parseArgs(argv) {
  const opts = { evidence: null, work: null, variantMap: null, keep: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--evidence') opts.evidence = argv[++i];
    else if (arg === '--work') opts.work = argv[++i];
    else if (arg === '--variant-map') opts.variantMap = argv[++i];
    else if (arg === '--keep') opts.keep = true;
    else if (arg === '--help') {
      console.log('usage: node scripts/intent-pilot.mjs --evidence <dir> [--work <dir>] [--variant-map <file>] [--keep]');
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!opts.evidence) throw new Error('--evidence <dir> is required');
  return opts;
}

/** Full capture run. Returns 0 when every consumer produced the paired fail/pass detection. */
export function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  const workRoot = opts.work ? resolve(opts.work) : mkdtempSync(join(tmpdir(), 'intent-pilot-'));
  mkdirSync(workRoot, { recursive: true });
  const eslintBin = findEslintBin();
  const fixture = loadCanonicalFixture();
  const captures = [];
  for (const sample of planSamples(fixture)) {
    const dir = join(workRoot, sample.id);
    buildSample(dir, fixture, sample);
    captures.push({ dir, sample, capture: captureSample(dir, sample, eslintBin) });
  }
  const allDetected = captures.every(({ capture }) => capture.ok);
  writeEvidencePackage(resolve(opts.evidence), captures);
  if (opts.variantMap) writeVariantMap(resolve(opts.variantMap), { evidenceDir: resolve(opts.evidence), captures });

  console.log(`consumers captured: ${captures.length}`);
  for (const { sample, capture } of captures) {
    console.log(
      `${sample.id}: ${SAMPLE_FILES[0]} exit ${capture.runs[SAMPLE_FILES[0]].exitCode}, ` +
        `${SAMPLE_FILES[1]} exit ${capture.runs[SAMPLE_FILES[1]].exitCode}`,
    );
  }
  console.log(`evidence: ${resolve(opts.evidence)}`);
  if (opts.variantMap) console.log(`observer record: ${resolve(opts.variantMap)}`);
  if (opts.keep) console.log(`work root kept: ${workRoot}`);
  else rmSync(workRoot, { recursive: true, force: true });

  if (!allDetected) {
    console.error('detection check failed — a consumer did not produce the paired fail/pass; inspect the evidence package');
    return 1;
  }
  return 0;
}

if (isMainEntry(import.meta.url)) process.exit(main());
