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
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, relative, win32, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ConventionNode } from '../ir/types.ts';
// Canonical cross-suite sandbox prefix (kickoff-population owns it): parallel suites in
// the same vitest pool create repo-scoped mkdtemp sandboxes under
// `.claude/orchestrator-prompts/c2-test-*` that live for their lifetime. The
// snapshot-differential arm below straddles one on a loaded host (measured 2026-10-26
// aggregate: `?? .claude/orchestrator-prompts/c2-test-h9aAgu/` appeared between the two
// `git status` snapshots and flipped the arm). Filtering the recognized sandbox prefix
// keeps that differential immune to sibling noise — but a NAME filter cannot attribute
// a write by WRITER: W-N7-1 (2026-10-26 review, pilot-repo-leak-preimage-comparison)
// proved a runner/capture destination under that same prefix is filtered from BOTH
// snapshots (false GREEN), and the 2026-10-27 review proved the installed ESLint child
// can write an UNREGISTERED such path during a real capture. The no-write oracle
// therefore also carries a writer-attributed destination-registry layer and a
// descendant-write audit layer (dialect-aware containment) — see assertNoRepoWrites
// below, pinned by the W-N7-1 causal-negative/noise/containment arms in the
// deterministic describe.
import { TEST_SANDBOX_RE } from '../principles/kickoff-population.ts';

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
  planSamples: (fixture: unknown) => Array<{ id: string; message: string; kind: string }>;
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
function captureInTemp(message: string, beforeCapture?: (dir: string, sample: { id: string; message: string }) => void) {
  const dir = join(tmp(), pilot.sampleIdFor(message));
  mkdirSync(dir, { recursive: true });
  const sample = { id: pilot.sampleIdFor(message), message };
  pilot.buildSample(dir, fixture, sample);
  beforeCapture?.(dir, sample);
  const capture = pilot.captureSample(dir, sample);
  return { dir, sample, capture };
}

/**
 * Dialect-aware containment (W-N7-1-WINPATH, 2026-10-27 review). The host-default
 * `relative()` binding is single-dialect: on a POSIX host a canonical Windows same-drive
 * EXTERNAL destination yields '..\scratch\consumer' — backslashes, so the '../' test
 * misses and a clean external destination is wrongly flagged INSIDE — and a
 * different-drive destination yields an ABSOLUTE relative() result, also wrongly inside
 * (receipt ACTUAL-WINDOWS-PATH-GUARD-REPRODUCTION ff96cc72…). The predicate picks the
 * dialect from the ROOT's own shape (drive letter / UNC → win32, else posix), keeps the
 * `..`-separator-prefix semantics per dialect, and treats the win32 different-drive
 * ABSOLUTE result as outside. Inputs are canonical absolute paths: the caller realpaths
 * real host paths (preserving the M4 symlink-alias protection); synthetic win32
 * controls pass literals. Deterministic path-dialect logic only — no native Windows
 * filesystem or CI claim.
 */
function isInsideAuditedRoot(root: string, dest: string): boolean {
  const dialect = /^[a-zA-Z]:[\\/]|^\\\\/.test(root) ? win32 : posix;
  const rel = dialect.relative(root, dest);
  if (rel === '') return true; // equal root
  if (dialect.isAbsolute(rel)) return false; // win32 different-drive: outside by construction
  const UP = `..${dialect.sep}`;
  return rel !== '..' && !rel.startsWith(UP);
}

/**
 * The corrected no-repo-writes oracle (W-N7-1, 2026-10-26 + 2026-10-27 reviews). A
 * name-prefix filter alone cannot attribute a write by WRITER: the runner flows through
 * temp dirs, sibling suites drop `c2-test-*` sandboxes into the same
 * `.claude/orchestrator-prompts/` tree, and a runner/capture destination under that
 * same prefix would be filtered from both snapshots (proven false GREEN). Three layers:
 * 1. Destination registry (writer-attributed): every destination this flow handed the
 *    runner must resolve — realpath'd, so symlink aliases into the repo cannot sneak
 *    past (the M4 lexical-relative lesson pinned by the variant-map arms below) —
 *    OUTSIDE the audited root (isInsideAuditedRoot, dialect-aware), whatever its name.
 *    Namespace-blind by construction.
 * 2. Descendant-write audit (writer-attributed, unregistered paths): the fs tap that
 *    runAuditedFlow preloads into every node DESCENDANT of this process records any
 *    write landing under the audited root — registered or not. This closes the
 *    remaining W-N7-1 gap (receipt 0bb8a454…): during a REAL capture the installed
 *    ESLint child evaluates the generated flat config IN that child, and a config-side
 *    side effect writing an unregistered c2-test-* repo path left layers 1+2 green
 *    (destinations stayed external, the name filter dropped the path) while the
 *    pre-repair predecessor oracle was RED.
 * 3. Snapshot differential (evidence): raw `git status --porcelain` of the audited
 *    root, with the recognized sibling-sandbox namespace filtered out, must be
 *    identical across the window — catching runner writes on paths the flow never
 *    handed it. Inside the filtered namespace layers 1+2 carry the runner-attributed
 *    burden; a name alone cannot tell writer classes apart there.
 */
function assertNoRepoWrites(opts: {
  root?: string;
  destinations: string[];
  before: string;
  after: string;
  descendantWrites?: Array<{ op: string; path: string; pid: number }>;
}): void {
  const root = opts.root ?? REPO_ROOT;
  const realRoot = realpathSync(root);
  for (const dest of opts.destinations) {
    if (isInsideAuditedRoot(realRoot, realpathSync(dest))) {
      throw new Error(`capture destination is INSIDE the audited repo: ${dest}`);
    }
  }
  if (opts.descendantWrites && opts.descendantWrites.length > 0) {
    const offenders = opts.descendantWrites.map((w) => `${w.path} (op ${w.op}, pid ${w.pid})`).join(', ');
    throw new Error(`audited-descendant write inside the audited repo: ${offenders}`);
  }
  const SANDBOX_PREFIX = '.claude/orchestrator-prompts/';
  const dropSiblingSandboxes = (status: string): string =>
    status
      .split('\n')
      .filter((l) => {
        if (l === '') return false;
        const path = l.slice(3); // drop the two-char XY status + space
        if (!path.startsWith(SANDBOX_PREFIX)) return true;
        const name = path.slice(SANDBOX_PREFIX.length).replace(/\/$/, '');
        return !TEST_SANDBOX_RE.test(name);
      })
      .join('\n');
  if (dropSiblingSandboxes(opts.after) !== dropSiblingSandboxes(opts.before)) {
    throw new Error(`audited repo changed across the run window:\n--- before ---\n${opts.before}\n--- after ---\n${opts.after}`);
  }
}

/** Write the fs tap preloaded into every node descendant by runAuditedFlow (layer 2). */
function writeFsAuditTap(harnessDir: string): string {
  const tapPath = join(harnessDir, 'wn7-fs-audit.mjs');
  const tapSource = [
    "import { createRequire } from 'node:module';",
    '// Everything goes through createRequire: a STATIC import of node:fs here would create',
    '// the builtin ESM namespace BEFORE the patch, and the audited child would receive a',
    '// namespace snapshot of the ORIGINAL functions. The CJS exports surface never creates',
    '// one, so the patch lands before any ESM import in the child snapshots it.',
    'const cjsfs = createRequire(import.meta.url)("node:fs");',
    'const rawAppend = cjsfs.appendFileSync;',
    'const realpathSync = cjsfs.realpathSync;',
    'const path = createRequire(import.meta.url)("node:path");',
    'const root = process.env.WN7_AUDIT_ROOT;',
    'const report = process.env.WN7_AUDIT_REPORT;',
    'if (root && report) {',
    '  const realRoot = realpathSync(root);',
    '  // Normalize through the deepest EXISTING ancestor: a not-yet-created target may be',
    '  // spelled through a symlinked prefix (macOS /var -> /private/var), which a lexical',
    '  // resolve() would hide from the containment compare.',
    '  const normalize = (p) => {',
    '    try { return realpathSync(p); } catch {}',
    '    const parts = p.split(path.sep);',
    '    for (let i = parts.length; i > 1; i--) {',
    '      try { return path.join(realpathSync(parts.slice(0, i).join(path.sep)), parts.slice(i).join(path.sep)); } catch {}',
    '    }',
    '    return p;',
    '  };',
    '  const record = (op, target) => {',
    '    try {',
    '      if (typeof target !== "string") return; // fd/Buffer targets are out of scope',
    '      const p = normalize(path.resolve(target));',
    '      if (p === realRoot || p.startsWith(realRoot + path.sep)) {',
    '        rawAppend(report, JSON.stringify({ op, path: p, pid: process.pid, ppid: process.ppid, cwd: process.cwd() }) + "\\n");',
    '      }',
    '    } catch { /* the tap must never break the audited child */ }',
    '  };',
    '  // The mutating set with REAL write-destination argument roles (R3, 2026-10-27',
    '  // review a5798980…): two-path ops create/move their write target at the SECOND',
    '  // argument — copyFile only READS its first, symlink only references its first,',
    '  // rename unlinks BOTH endpoints — and the promise surface carries the async names',
    '  // of the same set (a sync-name loop patched nothing there: mkdir/writeFile escaped).',
    '  const OPS = {',
    '    writeFileSync: [0], appendFileSync: [0], mkdirSync: [0], rmSync: [0],',
    '    renameSync: [0, 1], copyFileSync: [1], symlinkSync: [1],',
    '    writeFile: [0], appendFile: [0], mkdir: [0], rm: [0],',
    '    rename: [0, 1], copyFile: [1], symlink: [1],',
    '  };',
    '  const patch = (surface) => {',
    '    for (const [op, argIdx] of Object.entries(OPS)) {',
    '      const orig = surface[op];',
    '      if (typeof orig !== "function") continue;',
    '      surface[op] = function (...args) {',
    '        for (const i of argIdx) record(op, args[i]);',
    '        return orig.apply(this, args);',
    '      };',
    '    }',
    '  };',
    '  patch(cjsfs); // eslint (CJS) and the config module both resolve to this surface',
    '  const promises = cjsfs.promises; // node:fs/promises resolves to this same object',
    '  if (promises) patch(promises);',
    '}',
  ].join('\n');
  writeFileSync(tapPath, tapSource);
  return tapPath;
}

type AuditedRun = ReturnType<typeof captureInTemp> & { reportPath: string };

/**
 * Run a real buildSample/captureSample flow with the fs tap preloaded into every node
 * descendant (NODE_OPTIONS --import; runEslint's spawnSync passes no env override, so
 * children inherit). Node builtin module namespaces delegate to the mutable CJS
 * exports surface, so the tap sees BOTH the eslint child's own require('node:fs')
 * writes and an ESM config-module `await import("node:fs")` side effect (verified
 * node v24). `beforeCapture` is the controlled-mutation seam used ONLY by the causal
 * negative arm — a disposable generated-config side effect, never a production change.
 */
function runAuditedFlow(
  auditRoot: string,
  message: string,
  beforeCapture?: (dir: string, sample: { id: string; message: string }) => void,
): AuditedRun {
  const harnessDir = mkdtempSync(join(tmpdir(), 'wn7-audit-'));
  const tapPath = writeFsAuditTap(harnessDir);
  const reportPath = join(harnessDir, 'descendant-writes.jsonl');
  writeFileSync(reportPath, '');
  const saved = {
    NODE_OPTIONS: process.env.NODE_OPTIONS,
    WN7_AUDIT_ROOT: process.env.WN7_AUDIT_ROOT,
    WN7_AUDIT_REPORT: process.env.WN7_AUDIT_REPORT,
  };
  process.env.NODE_OPTIONS = `${saved.NODE_OPTIONS ? saved.NODE_OPTIONS + ' ' : ''}--import ${pathToFileURL(tapPath).href}`;
  process.env.WN7_AUDIT_ROOT = auditRoot;
  process.env.WN7_AUDIT_REPORT = reportPath;
  try {
    return { ...captureInTemp(message, beforeCapture), reportPath };
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/** Parse the tap report written by audited descendants (one JSON object per line). */
function readDescendantWrites(reportPath: string): Array<{ op: string; path: string; pid: number; ppid: number; cwd: string }> {
  return readFileSync(reportPath, 'utf8')
    .split('\n')
    .filter((l) => l !== '')
    .map((l) => JSON.parse(l) as { op: string; path: string; pid: number; ppid: number; cwd: string });
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

  it('a symlinked path INTO the evidence dir is refused too — the containment check realpaths both sides (flip: the check reverts to a lexical relative())', () => {
    // Cold-review M4 (2026-10-10): relative() is purely lexical — an aliased evidence dir
    // let the map land inside the real package through the symlink. Pin the realpath compare.
    const { evidenceDir, captures } = buildEvidence();
    const aliasParent = tmp();
    const alias = join(aliasParent, 'ev-symlink');
    symlinkSync(evidenceDir, alias, 'dir');
    const throughAlias = join(alias, 'variant-map.json');
    expect(() => pilot.writeVariantMap(throughAlias, { evidenceDir: alias, captures })).toThrow();
    // The map must not exist under EITHER spelling of the package.
    expect(existsSync(throughAlias)).toBe(false);
    expect(existsSync(join(evidenceDir, 'variant-map.json'))).toBe(false);
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
    // W-N7-1: name-prefix filtering alone was proven blind to a runner/capture
    // destination under the SAME c2-test-* namespace (review 2026-10-26), and the
    // 2026-10-27 review proved the installed ESLint CHILD can write an unregistered
    // repo path during a real capture (receipt 0bb8a454…). The oracle now attributes
    // by writer — assertNoRepoWrites above carries all three layers, and this arm
    // runs the flow under the descendant fs tap (audit root = the real repo).
    const snap = () => spawnSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT }).stdout.toString();
    const before = snap();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const destinations: string[] = [];
    const descendantWrites: Array<{ op: string; path: string; pid: number }> = [];
    try {
      for (const s of pilot.planSamples(fixture)) {
        const run = runAuditedFlow(realpathSync(REPO_ROOT), s.message);
        destinations.push(run.dir);
        descendantWrites.push(...readDescendantWrites(run.reportPath));
      }
    } finally {
      vi.unstubAllGlobals();
    }
    const after = snap();
    assertNoRepoWrites({ destinations, before, after, descendantWrites });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a REAL runner write under the SAME c2-test-* sandbox namespace fails the corrected oracle (W-N7-1 causal negative; flip: the destination-registry layer reverts to namespace-name filtering)', () => {
    // Reviewer reproduction (pilot-repo-leak-preimage-comparison.result.json, 2026-10-26):
    // only the capture destination moves into
    // `.claude/orchestrator-prompts/c2-test-pilot-review/<sample-id>` of a private
    // fixture Git repo; the runner, the canonical fixture and the installed local
    // eslint stay REAL. The preimage name-filtered oracle passed exactly this leak
    // (false GREEN) — the corrected oracle must flag it.
    const priv = mkdtempSync(join(tmpdir(), 'wn7-leak-'));
    try {
      const git = (...args: string[]) => spawnSync('git', args, { cwd: priv });
      mkdirSync(join(priv, '.claude/orchestrator-prompts', 'seed'), { recursive: true });
      writeFileSync(join(priv, '.claude/orchestrator-prompts', 'seed', 'kickoff.md'), '# seed\n');
      expect(git('init', '-q').status).toBe(0);
      expect(git('add', '.').status).toBe(0); // index knows the tree → untracked children list explicitly
      const before = git('status', '--porcelain').stdout.toString();
      const destinations: string[] = [];
      for (const s of pilot.planSamples(fixture)) {
        const id = pilot.sampleIdFor(s.message);
        const dir = join(priv, '.claude/orchestrator-prompts', 'c2-test-pilot-review', id);
        mkdirSync(dir, { recursive: true });
        const sample = { id, message: s.message };
        pilot.buildSample(dir, fixture, sample); // real runner write into the repo tree
        pilot.captureSample(dir, sample); // real npm consumer mechanism (installed local eslint)
        destinations.push(dir);
      }
      const after = git('status', '--porcelain').stdout.toString();
      // The leak is real, sits in the excluded namespace, and plain git sees it:
      expect(after).not.toBe(before);
      expect(after).toContain('c2-test-pilot-review');
      // The corrected oracle flags it — the lasting regression control: reverting the
      // registry layer to name-only filtering makes this expectation fail.
      expect(() => assertNoRepoWrites({ root: priv, destinations, before, after })).toThrow(/INSIDE the audited repo/);
    } finally {
      rmSync(priv, { recursive: true, force: true });
    }
  });

  it('a REAL ESLint-child write to an UNREGISTERED repo path fails the corrected oracle (W-N7-1 remaining causal negative; flip: the descendant-write audit layer is dropped)', () => {
    // Reviewer reproduction (ACTUAL-UNREGISTERED-CHILD-REMAINING-ORIGINAL-EVIDENCE,
    // 0bb8a454…, 2026-10-27): during a REAL buildSample/captureSample the installed
    // ESLint child evaluates the generated disposable flat config in that child, and a
    // config-side side effect writing `.claude/orchestrator-prompts/c2-test-unregistered-child/`
    // left the two-layer oracle GREEN — registered destinations stayed EXTERNAL and the
    // name filter dropped the path from both snapshots — while the pre-repair
    // predecessor oracle was RED on the same real write. The descendant fs tap
    // (runAuditedFlow) closes exactly this: the write is attributed by DESCENT, not by
    // registered name. The append below mutates ONLY the disposable generated config —
    // a causal mutation, never a production runner or eslint change.
    const priv = mkdtempSync(join(tmpdir(), 'wn7-child-'));
    try {
      const git = (...args: string[]) => spawnSync('git', args, { cwd: priv });
      mkdirSync(join(priv, '.claude/orchestrator-prompts', 'seed'), { recursive: true });
      writeFileSync(join(priv, '.claude/orchestrator-prompts', 'seed', 'kickoff.md'), '# seed\n');
      expect(git('init', '-q').status).toBe(0);
      expect(git('add', '.').status).toBe(0);
      const before = git('status', '--porcelain').stdout.toString();
      const run = runAuditedFlow(priv, fixture.claim, (dir, sample) => {
        const childTarget = join(priv, '.claude/orchestrator-prompts', 'c2-test-unregistered-child', sample.id);
        const childCode =
          '\n{ const fs = await import("node:fs"); const target = ' + JSON.stringify(childTarget) +
          '; fs.mkdirSync(target, { recursive: true }); fs.writeFileSync(target + "/child-write.json", ' +
          'JSON.stringify({ writerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), origin: "actual ESLint child config evaluation" })); }\n';
        const cfg = join(dir, 'eslint.config.mjs');
        writeFileSync(cfg, readFileSync(cfg, 'utf8') + childCode);
      });
      // The real capture stays healthy — the config-side write is not a lint failure.
      expect(run.capture.ok, `sample ${run.sample.id} detection`).toBe(true);
      // The child write really landed in the repo, from a REAL descendant process:
      const markerPath = join(priv, '.claude/orchestrator-prompts', 'c2-test-unregistered-child', run.sample.id, 'child-write.json');
      const marker = JSON.parse(readFileSync(markerPath, 'utf8')) as { writerPid: number; parentPid: number; cwd: string; origin: string };
      expect(marker.origin).toBe('actual ESLint child config evaluation');
      expect(marker.writerPid).not.toBe(process.pid); // written by a child, not this process
      expect(marker.parentPid).toBe(process.pid); // …spawned by this worker (runEslint)
      expect(marker.cwd).toBe(realpathSync(run.dir)); // …running the real sample consumer
      const writes = readDescendantWrites(run.reportPath);
      const realMarker = join(realpathSync(priv), '.claude/orchestrator-prompts', 'c2-test-unregistered-child', run.sample.id, 'child-write.json');
      const recorded = writes.filter((w) => w.path === realMarker || w.path === dirname(realMarker));
      expect(recorded.length).toBeGreaterThan(0); // the tap recorded the descendant write
      const after = git('status', '--porcelain').stdout.toString();
      // Plain git sees the leak, and it sits INSIDE the name-filtered namespace — the
      // exact conditions that made the two-layer oracle pass it:
      expect(after).not.toBe(before);
      expect(after).toContain('c2-test-unregistered-child');
      // The corrected oracle flags it by DESCENT: registered destination stays external
      // (layer 1 quiet), the snapshot diff is namespace-filtered (layer 3 quiet) — only
      // the descendant audit turns this RED. Reverting to the two-layer oracle fails here.
      expect(() =>
        assertNoRepoWrites({ root: priv, destinations: [run.dir], before, after, descendantWrites: writes }),
      ).toThrow(/audited-descendant write inside the audited repo/);
    } finally {
      rmSync(priv, { recursive: true, force: true });
    }
  });

  it('a REAL ESLint-child PROMISE-API write to an UNREGISTERED repo path fails the corrected oracle (W-N7-1 R3 causal negative; flip: the tap patches only synchronous names on the promises surface)', () => {
    // R3 review (ACTUAL-COMMON-API-REMAINING-ORIGINAL-EVIDENCE, a5798980…, 2026-10-27):
    // the healthy ESLint child's config side effect `await fs.mkdir` + `await fs.writeFile`
    // (node:fs/promises) into an unregistered c2 namespace left the oracle GREEN on the
    // d972 preimage — the tap iterated SYNC names on the promises surface, so no promise
    // method was ever wrapped (journals empty, both captures healthy, markers real). The
    // tap now carries the actual promise method names; this arm is the lasting control.
    // The append mutates ONLY the disposable generated config — a causal mutation, never
    // a production runner or eslint change.
    const priv = mkdtempSync(join(tmpdir(), 'wn7-child-prom-'));
    try {
      const git = (...args: string[]) => spawnSync('git', args, { cwd: priv });
      mkdirSync(join(priv, '.claude/orchestrator-prompts', 'seed'), { recursive: true });
      writeFileSync(join(priv, '.claude/orchestrator-prompts', 'seed', 'kickoff.md'), '# seed\n');
      expect(git('init', '-q').status).toBe(0);
      expect(git('add', '.').status).toBe(0);
      const before = git('status', '--porcelain').stdout.toString();
      const destinations: string[] = [];
      const allWrites: Array<{ op: string; path: string; pid: number; ppid: number; cwd: string }> = [];
      for (const s of pilot.planSamples(fixture)) {
        const run = runAuditedFlow(priv, s.message, (dir, sample) => {
          const childTarget = join(priv, '.claude/orchestrator-prompts', 'c2-test-unregistered-child', sample.id);
          const childCode =
            '\n{ const target = ' + JSON.stringify(childTarget) + '; const fs = await import("node:fs/promises"); await fs.mkdir(target, { recursive: true }); await fs.writeFile(target + "/child-write.json", ' +
            'JSON.stringify({ writerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), api: "promises.mkdir+writeFile", origin: "actual ESLint child config evaluation" })); }\n';
          const cfg = join(dir, 'eslint.config.mjs');
          writeFileSync(cfg, readFileSync(cfg, 'utf8') + childCode);
        });
        // The real capture stays healthy for BOTH samples — the write is not a lint failure.
        expect(run.capture.ok, `sample ${run.sample.id} detection`).toBe(true);
        // The promise-API write really landed in the repo, from a REAL child per sample:
        const markerPath = join(priv, '.claude/orchestrator-prompts', 'c2-test-unregistered-child', run.sample.id, 'child-write.json');
        const marker = JSON.parse(readFileSync(markerPath, 'utf8')) as { writerPid: number; parentPid: number; cwd: string; api: string };
        expect(marker.api).toBe('promises.mkdir+writeFile');
        expect(marker.writerPid).not.toBe(process.pid); // written by a child, not this worker
        expect(marker.parentPid).toBe(process.pid); // …spawned by this worker (runEslint)
        expect(marker.cwd).toBe(realpathSync(run.dir)); // …running the real sample consumer
        destinations.push(run.dir); // registered destination stays EXTERNAL to priv
        allWrites.push(...readDescendantWrites(run.reportPath));
      }
      // The tap recorded the promise-method writes (mkdir + writeFile) at their real paths:
      const realRoot = realpathSync(priv);
      const recorded = allWrites.filter((w) => isInsideAuditedRoot(realRoot, w.path));
      expect(recorded.some((w) => w.op === 'mkdir')).toBe(true);
      expect(recorded.some((w) => w.op === 'writeFile')).toBe(true);
      const after = git('status', '--porcelain').stdout.toString();
      expect(after).not.toBe(before);
      expect(after).toContain('c2-test-unregistered-child');
      // The corrected oracle rejects by DESCENT: layer 1 quiet (destinations external),
      // layer 3 quiet (namespace-filtered) — only the promise-aware tap turns this RED.
      expect(() =>
        assertNoRepoWrites({ root: priv, destinations, before, after, descendantWrites: allWrites }),
      ).toThrow(/audited-descendant write inside the audited repo/);
    } finally {
      rmSync(priv, { recursive: true, force: true });
    }
  });

  it('a REAL ESLint-child copyFileSync(EXTERNAL source, REPO destination) write fails the corrected oracle (W-N7-1 R3 causal negative; flip: the tap records the READ source argument of two-path ops)', () => {
    // R3 review (a5798980…): copyFileSync's FIRST argument is the read SOURCE; the d972
    // wrapper recorded it, so a payload written EXTERNALLY by the child and copied into
    // a PRE-EXISTING EMPTY repo directory left journals empty and the oracle GREEN, while
    // the accepted predecessor was RED on the same real write. The destination directory
    // below is created EMPTY BEFORE the before-snapshot — exactly the reviewer's harness —
    // so no child mkdir exists in the window to substitute for destination detection.
    const priv = mkdtempSync(join(tmpdir(), 'wn7-child-copy-'));
    try {
      const git = (...args: string[]) => spawnSync('git', args, { cwd: priv });
      mkdirSync(join(priv, '.claude/orchestrator-prompts', 'seed'), { recursive: true });
      writeFileSync(join(priv, '.claude/orchestrator-prompts', 'seed', 'kickoff.md'), '# seed\n');
      // Pre-existing EMPTY destination directory — invisible to git, so the before-snapshot
      // equals the seed; the copy is the ONLY repo write in the window.
      mkdirSync(join(priv, '.claude/orchestrator-prompts', 'c2-test-unregistered-child'), { recursive: true });
      expect(git('init', '-q').status).toBe(0);
      expect(git('add', '.').status).toBe(0);
      const before = git('status', '--porcelain').stdout.toString();
      const destinations: string[] = [];
      const allWrites: Array<{ op: string; path: string; pid: number; ppid: number; cwd: string }> = [];
      for (const s of pilot.planSamples(fixture)) {
        const run = runAuditedFlow(priv, s.message, (dir) => {
          const childTarget = join(priv, '.claude/orchestrator-prompts', 'c2-test-unregistered-child');
          const childCode =
            '\n{ const target = ' + JSON.stringify(childTarget) + '; const fs = await import("node:fs"); const payload = process.cwd() + "/outside-copy-payload.json"; fs.writeFileSync(payload, ' +
            'JSON.stringify({ writerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), api: "copyFileSync(destination)", origin: "actual ESLint child config evaluation" })); fs.copyFileSync(payload, target + "/child-write.json"); }\n';
          const cfg = join(dir, 'eslint.config.mjs');
          writeFileSync(cfg, readFileSync(cfg, 'utf8') + childCode);
        });
        // The real capture stays healthy for BOTH samples — the copy is not a lint failure.
        expect(run.capture.ok, `sample ${run.sample.id} detection`).toBe(true);
        destinations.push(run.dir); // registered destination stays EXTERNAL to priv
        allWrites.push(...readDescendantWrites(run.reportPath));
      }
      // The copied marker really landed in the directory that pre-existed EMPTY, from a
      // REAL child (last write wins across the sample runs):
      const markerPath = join(priv, '.claude/orchestrator-prompts', 'c2-test-unregistered-child', 'child-write.json');
      const marker = JSON.parse(readFileSync(markerPath, 'utf8')) as { writerPid: number; parentPid: number; cwd: string; api: string };
      expect(marker.api).toBe('copyFileSync(destination)');
      expect(marker.writerPid).not.toBe(process.pid); // written by a child, not this worker
      expect(marker.parentPid).toBe(process.pid); // …spawned by this worker (runEslint)
      expect(marker.cwd).toBe(realpathSync(destinations[destinations.length - 1])); // …running the real sample consumer
      // The tap recorded the copy at its DESTINATION (argument 2) — the external payload
      // write stays unrecorded (outside the audited root), which is exactly why arg-role
      // fidelity, not arg presence, is the load-bearing property:
      const realDest = join(realpathSync(priv), '.claude/orchestrator-prompts', 'c2-test-unregistered-child', 'child-write.json');
      const copies = allWrites.filter((w) => w.op === 'copyFileSync' && w.path === realDest);
      expect(copies.length).toBeGreaterThan(0);
      expect(copies.every((w) => w.pid !== process.pid && w.ppid === process.pid)).toBe(true);
      const after = git('status', '--porcelain').stdout.toString();
      expect(after).not.toBe(before);
      expect(after).toContain('c2-test-unregistered-child');
      // The corrected oracle rejects by DESCENT: layer 1 quiet (destinations external),
      // layer 3 quiet (namespace-filtered) — only the destination-role tap record turns
      // this RED. Reverting to first-argument recording fails this arm (journals empty).
      expect(() =>
        assertNoRepoWrites({ root: priv, destinations, before, after, descendantWrites: allWrites }),
      ).toThrow(/audited-descendant write inside the audited repo/);
    } finally {
      rmSync(priv, { recursive: true, force: true });
    }
  });

  it('independently created concurrent sibling sandbox noise alone does not fail the corrected oracle (W-N7-1 noise control; flip: the oracle starts flagging recognized sibling sandboxes again)', () => {
    // The measured 2026-10-26 false-failure shape: a sibling suite's `c2-test-*`
    // sandbox appears under `.claude/orchestrator-prompts/` BETWEEN the two snapshots
    // while the runner flow's destinations all live outside the repo. The oracle must
    // stay quiet — noise alone is not a runner leak. The flow runs under the
    // descendant fs tap as well: an INDEPENDENT (unhooked, non-descendant) writer
    // never enters the tap report, so layer 2 stays quiet too.
    const priv = mkdtempSync(join(tmpdir(), 'wn7-noise-'));
    try {
      const git = (...args: string[]) => spawnSync('git', args, { cwd: priv });
      mkdirSync(join(priv, '.claude/orchestrator-prompts', 'seed'), { recursive: true });
      writeFileSync(join(priv, '.claude/orchestrator-prompts', 'seed', 'kickoff.md'), '# seed\n');
      expect(git('init', '-q').status).toBe(0);
      expect(git('add', '.').status).toBe(0);
      const before = git('status', '--porcelain').stdout.toString();
      const run = runAuditedFlow(priv, fixture.claim); // real flow, temp destination, tap on
      const noiseDir = join(priv, '.claude/orchestrator-prompts', 'c2-test-wn7-sibling-noise');
      mkdirSync(noiseDir, { recursive: true }); // independent writer, mid-window
      writeFileSync(join(noiseDir, 'kickoff.md'), '# sibling sandbox\n');
      const after = git('status', '--porcelain').stdout.toString();
      // The noise really landed mid-window and survives at after-time:
      expect(after).not.toBe(before);
      expect(after).toContain('c2-test-wn7-sibling-noise');
      // …the tap recorded no repo writes by the flow's descendants…
      const writes = readDescendantWrites(run.reportPath);
      expect(writes.filter((w) => isInsideAuditedRoot(realpathSync(priv), w.path))).toHaveLength(0);
      // …and the oracle stays quiet across all three layers.
      assertNoRepoWrites({ root: priv, destinations: [run.dir], before, after, descendantWrites: writes });
    } finally {
      rmSync(priv, { recursive: true, force: true });
    }
  });

  it('containment is dialect-aware: clean Windows external destinations are NOT flagged inside (W-N7-1-WINPATH; flip: the guard reverts to host-only path.relative)', () => {
    // Receipt ACTUAL-WINDOWS-PATH-GUARD-REPRODUCTION (ff96cc72…): the host-only
    // relative() guard rejected a canonical win32 SAME-DRIVE external temp
    // ('..\scratch\consumer' — backslash separator) and a DIFFERENT-DRIVE external
    // (absolute relative() result) as INSIDE. The corrected seam (isInsideAuditedRoot,
    // the same predicate assertNoRepoWrites layer 1 executes) must allow both, keep
    // inside/equal-root rejects, and keep POSIX outside/inside behavior. Deterministic
    // path-dialect controls only — no native Windows filesystem/CI acceptance.
    expect(isInsideAuditedRoot('C:\\work\\repo', 'C:\\work\\scratch\\consumer')).toBe(false); // win32 same-drive external → allow
    expect(isInsideAuditedRoot('D:\\work\\repo', 'C:\\Temp\\consumer')).toBe(false); // win32 different-drive → allow
    expect(isInsideAuditedRoot('C:\\work\\repo', 'C:\\work\\repo\\consumer')).toBe(true); // win32 inside → reject
    expect(isInsideAuditedRoot('C:\\work\\repo', 'C:\\work\\repo')).toBe(true); // win32 equal root → reject
    expect(isInsideAuditedRoot('/work/repo', '/tmp/consumer')).toBe(false); // POSIX outside → allow
    expect(isInsideAuditedRoot('/work/repo', '/work/repo/consumer')).toBe(true); // POSIX inside → reject
    // Realpath/symlink protection is preserved on the actual corrected seam: a
    // symlinked destination INTO the audited root still resolves inside (M4).
    const priv = mkdtempSync(join(tmpdir(), 'wn7-alias-'));
    try {
      mkdirSync(join(priv, 'inside'), { recursive: true });
      const aliasParent = tmp();
      const alias = join(aliasParent, 'into-repo');
      symlinkSync(join(priv, 'inside'), alias, 'dir');
      expect(() => assertNoRepoWrites({ root: priv, destinations: [alias], before: '', after: '' })).toThrow(/INSIDE the audited repo/);
    } finally {
      rmSync(priv, { recursive: true, force: true });
    }
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
