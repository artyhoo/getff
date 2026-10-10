// intent-first-result S1 Task 10 — pilot runner RED suite (kickoff §4 Task 3, spec §1 worked example).
//
// The runner `scripts/intent-pilot.mjs` sets up a disposable npm consumer with a REAL temporary
// ESLint flat config + paired sample files, executes the INSTALLED local eslint command (the
// repo's own devDependency, never `fireRestricted`'s rule-tester projection), and captures full
// diagnostics. It builds TWO consumers whose configs differ ONLY in the message string:
// the canonical fixture claim (matching guidance) and a degraded opaque code (no guidance) —
// the spec's discriminating contrast, in the disposable fixture only, never in the production
// rule family. The runner manufactures NO advisor outcomes: it never contacts a model, and its
// evidence package carries neutral sample IDs with no variant labels.
//
// T22 (sibling-channel false GREEN): every arm names its single flipping production change in
// the `it` title. The arm→flip map is mirrored in
// .claude/orchestrator-prompts/intent-first-result/s1-report.md.
import { describe, it, expect, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ConventionNode } from '../ir/types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const RUNNER = resolve(REPO_ROOT, 'scripts/intent-pilot.mjs');
const FIXTURE_PATH = resolve(REPO_ROOT, 'packages/core/composition/fixtures/no-direct-process-env.node.json');

const sha256 = (bytes: string | Buffer): string =>
  createHash('sha256').update(bytes).digest('hex');

// The renderer's REAL projection — the reuse binding the runner is held to (spec §1: "the
// supported configuration-access fixture and npm backend"). Imported, never re-derived here.
const { nodeToSynthesizedRule, renderNpmDeclarative } = (await import(
  resolve(HERE, '../backends/npm/from-node.ts')
)) as typeof import('../backends/npm/from-node.ts');

const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as ConventionNode;

// The runner does not exist yet — module-not-found IS the RED state for this suite.
const pilot = (await import(pathToFileURL(RUNNER).href)) as {
  REPO_ROOT: string;
  OPAQUE_MESSAGE: string;
  CANONICAL_FIXTURE_REL: string;
  renderConfigEntry: (fixture: unknown, message?: string) => string;
  renderFlatConfig: (fixture: unknown, message?: string) => string;
  sampleIdFor: (message: string) => string;
  planSamples: (fixture: unknown) => Array<{ id: string; message: string; variant: string }>;
  buildSample: (dir: string, fixture: unknown, sample: { id: string; message: string }) => void;
  findEslintBin: () => string;
  runEslint: (sampleDir: string, fileName: string, eslintBin?: string) => {
    exitCode: number;
    stdout: string;
    stderr: string;
  };
  captureSample: (
    sampleDir: string,
    sample: { id: string; message: string },
    eslintBin?: string,
  ) => {
    ok: boolean;
    violation: { exitCode: number; ruleIds: string[]; first: Record<string, unknown> | null };
    conforming: { exitCode: number; ruleIds: string[] };
    commands: string[];
  };
  writeEvidencePackage: (evidenceDir: string, captures: unknown) => void;
  writeVariantMap: (mapPath: string, opts: { evidenceDir: string; captures: unknown }) => void;
  main: (argv: string[]) => number;
};

const tmp = (): string => mkdtempSync(join(tmpdir(), 'intent-pilot-test-'));

/** Recursive file listing (relative paths), for evidence-package neutrality walks. */
function walk(dir: string, base: string = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p, base));
    else out.push(relative(base, p));
  }
  return out.sort();
}

/** Build + capture one sample consumer in a fresh temp dir. */
function captureInTemp(message: string) {
  const dir = join(tmp(), pilot.sampleIdFor(message));
  mkdirSync(dir, { recursive: true });
  const sample = { id: pilot.sampleIdFor(message), message };
  pilot.buildSample(dir, fixture, sample);
  const capture = pilot.captureSample(dir, sample);
  return { dir, sample, capture };
}

// ---------------------------------------------------------------------------
// Reuse binding — the runner renders through the canonical npm projection.
// ---------------------------------------------------------------------------
describe('pilot runner reuses the canonical npm renderer', () => {
  it('renderConfigEntry equals the real renderer projection for the canonical fixture (flip: the runner re-derives the config entry instead of the from-node.ts projection)', () => {
    const rule = nodeToSynthesizedRule(fixture, { stack: [] });
    const rendered = renderNpmDeclarative([fixture]);
    const outcome = rendered.outcomes.get(fixture.id);
    if (!outcome || outcome.kind !== 'rendered') {
      throw new Error(`fixture ${fixture.id} did not render through the npm backend`);
    }
    const surface = outcome.surfaces[0]?.content;

    expect(surface).toBeDefined();
    expect(surface).toBe(JSON.stringify(['error', { selector: fixture.params.selector, message: fixture.claim }]));
    if (rule.check.type !== 'declarative') throw new Error('canonical fixture renders a non-declarative check');
    expect(rule.check.message).toBe(fixture.claim);
    expect(pilot.renderConfigEntry(fixture)).toBe(surface);
  });

  it('the claim sample binds the canonical fixture claim verbatim (flip: planSamples stops reading the fixture claim)', () => {
    const samples = pilot.planSamples(fixture);
    expect(samples).toHaveLength(2);
    expect(samples.map((s) => s.message)).toContain(fixture.claim);
  });

  it('the two samples differ ONLY in the message — identical selector and severity (flip: any non-message config drift between samples)', () => {
    const samples = pilot.planSamples(fixture);
    const configs = samples.map((s) => pilot.renderFlatConfig(fixture, s.message));
    expect(configs[0]).not.toBe(configs[1]);
    const parsed = configs.map((c) => {
      const mod = { exports: {} } as { exports: unknown[] };
      const src = c.replace(/export default /, 'mod.exports = '); // first occurrence; header comment must not contain it
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      new Function('mod', src)(mod);
      const flat = mod.exports as Array<{ rules: Record<string, unknown> }>;
      return flat[0].rules['no-restricted-syntax'] as [string, { selector: string; message: string }];
    });
    expect(parsed[0][0]).toBe(parsed[1][0]); // severity identical
    expect(parsed[0][1].selector).toBe(parsed[1][1].selector); // selector identical
    expect(parsed[0][1].message).not.toBe(parsed[1][1].message); // message differs
  });

  it('the opaque sample message carries no replacement guidance (flip: guidance leaks into the degraded sample — T-INTENT-C)', () => {
    const samples = pilot.planSamples(fixture);
    const opaque = samples.find((s) => s.message !== fixture.claim);
    expect(opaque).toBeDefined();
    const guidance = ['accessor', 'config.get', 'config.', 'process.env', 'environment', 'database', 'instead', 'replace'];
    for (const token of guidance) {
      expect(opaque!.message.toLowerCase()).not.toContain(token);
    }
    expect(opaque!.message.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Real installed local eslint — paired detection, per sample.
// ---------------------------------------------------------------------------
describe('pilot runner runs the installed local eslint', () => {
  it('env-read sample file fails via no-restricted-syntax and the accessor sample file passes — for EACH sample (flip: buildSample/runEslint stops producing the paired fail/pass)', () => {
    for (const s of pilot.planSamples(fixture)) {
      const { capture } = captureInTemp(s.message);
      expect(capture.ok, `sample ${s.id} detection`).toBe(true);
      expect(capture.violation.exitCode).toBe(1); // lint errors, not a config crash (exit 2)
      expect(capture.violation.ruleIds).toContain('no-restricted-syntax');
      expect(capture.conforming.exitCode).toBe(0);
      expect(capture.conforming.ruleIds).toHaveLength(0);
    }
  });

  it('detection stays EQUAL across samples while messages differ (flip: a sample drifts selector/severity/sample files)', () => {
    const captures = pilot.planSamples(fixture).map((s) => captureInTemp(s.message).capture);
    const [a, b] = captures;
    expect(a.violation.exitCode).toBe(b.violation.exitCode);
    expect(a.violation.ruleIds).toEqual(b.violation.ruleIds);
    expect(a.violation.first?.line).toBe(b.violation.first?.line);
    expect(a.violation.first?.column).toBe(b.violation.first?.column);
    expect(a.violation.first?.message).not.toBe(b.violation.first?.message);
  });

  it('the violation diagnostic carries source, location, rule and message (flip: the runner drops a diagnostic field the brief requires — S1-P2 evidence shape)', () => {
    const { capture } = captureInTemp(fixture.claim);
    const first = capture.violation.first as { line: number; column: number; ruleId: string; message: string; source?: string };
    expect(first.line).toBeGreaterThanOrEqual(1);
    expect(first.column).toBeGreaterThanOrEqual(1);
    expect(first.ruleId).toBe('no-restricted-syntax');
    expect(first.message).toBe(fixture.claim);
    expect(typeof first.source === 'string' || first.source === null).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Evidence package neutrality — advisor inputs stay blind (T-INTENT-C).
// ---------------------------------------------------------------------------
describe('pilot evidence package stays advisor-neutral', () => {
  const LABELS = ['matching', 'deficient', 'opaque', 'degraded', 'expected', 'violating', 'correcting', 'variant', 'verdict', 'answer key'];

  function buildEvidence(): { evidenceDir: string; captures: unknown[] } {
    const evidenceDir = join(tmp(), 'evidence');
    const captures = pilot.planSamples(fixture).map((s) => {
      const { dir, sample, capture } = captureInTemp(s.message);
      return { dir, sample, capture };
    });
    mkdirSync(evidenceDir, { recursive: true });
    pilot.writeEvidencePackage(evidenceDir, captures);
    return { evidenceDir, captures };
  }

  it('sample ids are opaque hashes, not positional labels (flip: the runner switches to ordered sample-1/sample-2 ids)', () => {
    const { evidenceDir } = buildEvidence();
    const dirs = readdirSync(evidenceDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
    expect(dirs).toHaveLength(2);
    for (const id of dirs) expect(id).toMatch(/^sample-[0-9a-f]{8}$/);
  });

  it('no evidence file carries a variant label or generation material (flip: the runner writes labels, its own source, or the variant map into the package)', () => {
    const { evidenceDir } = buildEvidence();
    const files = walk(evidenceDir);
    expect(files.length).toBeGreaterThan(0);
    for (const rel of files) {
      const content = readFileSync(join(evidenceDir, rel), 'utf8').toLowerCase();
      for (const label of LABELS) {
        expect(content, `${rel} contains "${label}"`).not.toContain(label);
      }
      // The runner's own source and the variant map never enter the package.
      expect(content).not.toContain('intent-pilot.mjs');
    }
    expect(files.some((f) => f.endsWith('variant-map.json'))).toBe(false);
  });

  it('the evidence package retains replayable raw outputs and identities (flip: the runner drops the raw streams or digests)', () => {
    const { evidenceDir, captures } = buildEvidence();
    const manifest = JSON.parse(readFileSync(join(evidenceDir, 'manifest.json'), 'utf8')) as {
      eslintVersion: string;
      fixture: { path: string; sha256: string };
      samples: Array<{ id: string; files: Array<{ name: string; sha256: string }>; runs: Array<{ file: string; exitCode: number }> }>;
    };
    expect(manifest.eslintVersion).toMatch(/^v?\d+\./); // raw `eslint --version` output, e.g. "v9.39.4"
    expect(manifest.fixture.sha256).toBe(sha256(readFileSync(FIXTURE_PATH)));
    expect(manifest.fixture.path).toBe(pilot.CANONICAL_FIXTURE_REL);
    expect(manifest.samples).toHaveLength(2);
    for (const s of manifest.samples) {
      expect(s.files.map((f) => f.name).sort()).toEqual(['eslint.config.mjs', 'sample-a.js', 'sample-b.js']);
      for (const f of s.files) {
        expect(sha256(readFileSync(join(evidenceDir, s.id, f.name)))).toBe(f.sha256);
      }
      expect(s.runs).toHaveLength(2);
    }
    // Raw captured streams exist per run.
    for (const cap of captures as Array<{ sample: { id: string } }>) {
      const files = walk(join(evidenceDir, cap.sample.id));
      expect(files.some((f) => f.includes('.stdout'))).toBe(true);
      expect(files.some((f) => f.endsWith('.json') && f !== 'manifest.json')).toBe(true);
    }
  });

  it('the variant map is written ONLY to the requested path outside the evidence dir; an inside path is refused (flip: the map route starts writing into the evidence package)', () => {
    const { evidenceDir, captures } = buildEvidence();
    const inside = join(evidenceDir, 'variant-map.json');
    expect(() => pilot.writeVariantMap(inside, { evidenceDir, captures })).toThrow();
    expect(existsSync(inside)).toBe(false);

    const outsideDir = tmp();
    const mapPath = join(outsideDir, 'observer-variant-map.json');
    pilot.writeVariantMap(mapPath, { evidenceDir, captures });
    const map = JSON.parse(readFileSync(mapPath, 'utf8')) as { samples: Record<string, unknown> };
    expect(Object.keys(map.samples)).toHaveLength(2);
    // ...and the evidence package still does not contain it.
    expect(walk(evidenceDir).some((f) => f.endsWith('observer-variant-map.json'))).toBe(false);
    rmSync(mapPath);
  });
});

// ---------------------------------------------------------------------------
// No model, no network — the runner manufactures no advisor outcomes.
// ---------------------------------------------------------------------------
describe('pilot runner stays deterministic', () => {
  it('the runner source has no model/network surface (flip: the runner gains a verdict or telemetry path)', () => {
    const src = readFileSync(RUNNER, 'utf8');
    const forbidden = /fetch\(|node:http|node:https|node:net|XMLHttpRequest|WebSocket|openai|anthropic/i;
    expect(forbidden.test(src)).toBe(false);
  });

  it('a full capture makes zero fetch calls (flip: the runner starts contacting a model at runtime)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const s = pilot.planSamples(fixture)[0]!;
      captureInTemp(s.message);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('the runner writes nothing into the repo during a full run (flip: the runner stops being disposable and leaks state into the repo)', async () => {
    const before = spawnSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT }).stdout.toString();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      for (const s of pilot.planSamples(fixture)) captureInTemp(s.message);
    } finally {
      vi.unstubAllGlobals();
    }
    const after = spawnSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT }).stdout.toString();
    expect(after).toBe(before);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CLI end-to-end.
// ---------------------------------------------------------------------------
describe('pilot runner CLI', () => {
  it('--evidence populates the package and exits 0 on paired detection; the work root is cleaned (flip: CLI wiring or cleanup breaks)', () => {
    const parent = tmp();
    const evidence = join(parent, 'evidence');
    const rc = spawnSync(process.execPath, [RUNNER, '--evidence', evidence, '--work', join(parent, 'work')], {
      encoding: 'utf8',
      timeout: 120_000,
    });
    expect(rc.status, rc.stderr).toBe(0);
    expect(existsSync(join(evidence, 'manifest.json'))).toBe(true);
    expect(readdirSync(evidence).filter((d) => d.startsWith('sample-'))).toHaveLength(2);
    expect(existsSync(join(parent, 'work'))).toBe(false); // disposable consumer removed
  });

  it('--variant-map lands outside the evidence dir and the stdout summary carries no labels (flip: the summary or map leaks the answer to the advisor transcript)', () => {
    const parent = tmp();
    const evidence = join(parent, 'evidence');
    const map = join(parent, 'observer-map.json');
    const rc = spawnSync(
      process.execPath,
      [RUNNER, '--evidence', evidence, '--work', join(parent, 'work'), '--variant-map', map],
      { encoding: 'utf8', timeout: 120_000 },
    );
    expect(rc.status).toBe(0);
    expect(existsSync(map)).toBe(true);
    for (const label of ['matching', 'deficient', 'opaque', 'degraded', 'variant']) {
      expect(rc.stdout.toLowerCase(), `stdout contains "${label}"`).not.toContain(label);
    }
    expect(existsSync(join(evidence, 'observer-map.json'))).toBe(false);
  });
});
