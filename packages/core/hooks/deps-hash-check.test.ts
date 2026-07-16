/**
 * Functional tests for the UserPromptSubmit hook
 * (.claude/hooks/deps-hash-check.sh) — D7=a (Wave 5.3).
 *
 * Hook contract (.claude/hooks/deps-hash-check.sh):
 *   - UserPromptSubmit: fires on every user prompt in the consumer's working dir.
 *   - Does NOT read stdin for path filtering (unlike PostToolUse hooks).
 *   - Reads .ai-factory/tool-decisions.md for stored "deps-hash:" frontmatter value.
 *   - Recomputes sha256 of merged dependencies+devDependencies from package.json.
 *   - On mismatch → prints warning line to stdout (line 41).
 *   - ALWAYS exits 0 — non-blocking, context injection only (line 44).
 *
 * Paired-negative contract:
 *   ❌ deps-hash present but stale (current ≠ stored) → warning printed to stdout
 *   ✅ deps-hash present and matching (current = stored) → silent, no stdout
 *   ✅ no .ai-factory/tool-decisions.md → silent exit 0
 *   ✅ tool-decisions.md exists but no deps-hash: line → silent exit 0
 *   ✅ no package.json → silent exit 0
 *   ✅ package.json has no dependencies or devDependencies → no warning if hash matches
 *
 * Pattern: check-hook-marker.test.ts (vitest + spawnSync + mkdtempSync on-disk fixtures).
 * Reference: packages/core/hooks/check-hook-marker.test.ts:34-102
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/deps-hash-check.sh');
/** The shipped SOURCE copy (install.sh:261). HOOK above is the dogfood copy. */
const HOOK_SOURCE = resolve(REPO_ROOT, 'packages/core/hooks/deps-hash-check.sh');

/** Compute the same sha256 the hook computes for a given deps JSON string. */
function computeHash(depsJson: string): string {
  const hash = crypto.createHash('sha256').update(depsJson).digest('hex');
  return `sha256-${hash}`;
}

/**
 * The widened JS deps surface (kickoff §1 line 30, design §1-E): 7 fields merged.
 * `overrides`/`resolutions` can be a STRING in real package.json (npm `$REACT` reference
 * syntax); spreading a string produces integer-indexed char keys and corrupts the hash —
 * so the hook (and this helper) guard each non-deps/devDeps field with `typeof === 'object'`
 * (design §3a m1). Mirrors the hook's `node -e` extraction exactly so expected hashes match.
 */
function buildDepsJson(pkg: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  overrides?: Record<string, string> | string;
  resolutions?: Record<string, string> | string;
  pnpm?: { overrides?: Record<string, string> };
}): string {
  // Guard each widened field: only spread if present AND object-shaped (string `overrides`
  // like "$REACT" → dropped, matching the hook's typeof check). deps/devDeps are always
  // objects in valid package.json so no guard needed (but the ?? {} handles absence).
  const obj = (v: unknown): Record<string, string> =>
    v && typeof v === 'object' ? (v as Record<string, string>) : {};
  return JSON.stringify({
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...obj(pkg.peerDependencies),
    ...obj(pkg.optionalDependencies),
    ...obj(pkg.overrides),
    ...obj(pkg.resolutions),
    ...obj(pkg.pnpm?.overrides),
  });
}

/**
 * Compute the deps-hash-python value the hook produces, mirroring its two tiers
 * (design §4 C-resolution). Tier-1 hashes the byte-range of the 6 non-[project] dep
 * tables via awk; Tier-2 hashes [project].dependencies + [project].optional-dependencies
 * via python3 tomllib (deps-only, deterministic sort). The python hash is sha256 over the
 * concatenation of the two tier outputs (or "" for an absent tier). If python3/tomllib are
 * unavailable, Tier-2 contributes "" (only Tier-1 is hashed). This helper assumes python3 ≥3.11
 * is available (the test env has it); the node-free degrade case asserts Tier-1-only behavior.
 */
function computePythonHash(opts: {
  pyprojectContent: string;
  hasPython3?: boolean; // default true; false simulates node-free-no-python3 (Tier-2 → "")
}): string {
  const hasPython3 = opts.hasPython3 ?? true;
  // Tier-1: the 6-table awk matcher (design §4). Implemented in node for test determinism
  // (the hook uses the equivalent BSD-awk). Tables: project.optional-dependencies,
  // dependency-groups, tool.poetry.dependencies, tool.poetry.dev-dependencies,
  // tool.poetry.group.<name>.dependencies (glob), tool.hatch.envs.<name> (glob).
  const lines = opts.pyprojectContent.split('\n');
  const wantHeader = (h: string): boolean =>
    h === 'project.optional-dependencies' ||
    h === 'dependency-groups' ||
    h === 'tool.poetry.dependencies' ||
    h === 'tool.poetry.dev-dependencies' ||
    /^tool\.poetry\.group\.[^.]+\.dependencies$/.test(h) ||
    /^tool\.hatch\.envs\.[^.]+$/.test(h);
  const tier1Lines: string[] = [];
  let inTable = false;
  for (const raw of lines) {
    const line = raw.trim();
    const headerMatch = /^\[([^\]]+)\]$/.exec(line);
    if (headerMatch) {
      inTable = wantHeader(headerMatch[1]!.trim());
      if (inTable) tier1Lines.push(raw);
      continue;
    }
    if (inTable) tier1Lines.push(raw);
  }
  const tier1 = crypto.createHash('sha256').update(tier1Lines.join('\n')).digest('hex');
  // Tier-2: [project] deps-only via tomllib. If no python3, contributes "".
  let tier2 = '';
  if (hasPython3) {
    // Parse the TOML with the same tomllib the hook uses, then hash deps arrays deterministically.
    // (Test parses inline rather than shelling to python3, to keep the helper pure-sync; the
    // shape mirrors tomllib's output: project.dependencies array + project.optional-dependencies dict.)
    const projDeps = extractProjectDeps(opts.pyprojectContent);
    if (projDeps) {
      const payload =
        JSON.stringify([...projDeps.dependencies].sort()) +
        JSON.stringify(
          Object.keys(projDeps.optional)
            .sort()
            .map((k) => [k, [...projDeps.optional[k]].sort()]),
        );
      tier2 = crypto.createHash('sha256').update(payload).digest('hex');
    }
  }
  // Combined python hash = sha256(tier1 + tier2). Mirrors the hook's assembly.
  return `sha256-${crypto.createHash('sha256').update(tier1 + tier2).digest('hex')}`;
}

/** Minimal [project] deps extractor for the test helper (PEP 621 subset — dependencies array
 *  + optional-dependencies dict). Returns null if [project] is absent. Not a general parser. */
function extractProjectDeps(toml: string): { dependencies: string[]; optional: Record<string, string[]> } | null {
  // Find the [project] table block (from [project] up to the next ^[ header).
  const lines = toml.split('\n');
  let inProj = false;
  let hasProj = false;
  const block: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (/^\[project\]$/.test(line)) { inProj = true; hasProj = true; continue; }
    if (/^\[/.test(line)) { inProj = false; continue; }
    if (inProj) block.push(line);
  }
  if (!hasProj) return null;
  const dependencies: string[] = [];
  const optional: Record<string, string[]> = {};
  for (const line of block) {
    const m = /^dependencies\s*=\s*(.+)$/.exec(line);
    if (m) {
      // parse a string-array literal like ["a>=1", "b"] (single-line only; test fixtures stay single-line)
      const arr = parseStringArray(m[1]!);
      dependencies.push(...arr);
    }
  }
  // optional-dependencies is a sub-TABLE [project.optional-dependencies], parsed separately below by caller
  // — but for the helper we also scan that block. Re-scan the toml for it.
  let inOpt = false;
  let currentGroup: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^\[project\.optional-dependencies\]$/.test(line)) { inOpt = true; continue; }
    if (/^\[/.test(line)) { inOpt = false; currentGroup = null; continue; }
    if (!inOpt) continue;
    const grp = /^([A-Za-z0-9_.-]+)\s*=/.exec(line);
    if (grp) currentGroup = grp[1]!;
    if (currentGroup) {
      const arr = parseStringArray(line.replace(/^[A-Za-z0-9_.-]+\s*=\s*/, ''));
      if (arr.length && !optional[currentGroup]) optional[currentGroup] = [];
      optional[currentGroup]?.push(...arr);
    }
  }
  return { dependencies, optional };
}

function parseStringArray(s: string): string[] {
  const match = /\[[\s\S]*\]/.exec(s);
  if (!match) return [];
  const inner = match[0].slice(1, -1);
  const out: string[] = [];
  const re = /"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) out.push(m[1]!);
  return out;
}

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Create a temp dir with optional fixtures. Returns the temp dir path. */
function makeFixtureDir(opts: {
  packageJson?: object;
  pyprojectToml?: string; // full pyproject.toml content; omitted = don't create
  toolDecisions?: string; // full file content; null = don't create
} = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'deps-hash-test-'));
  tmpDirs.push(dir);

  if (opts.packageJson !== undefined) {
    writeFileSync(join(dir, 'package.json'), JSON.stringify(opts.packageJson), 'utf8');
  }

  if (opts.pyprojectToml !== undefined) {
    writeFileSync(join(dir, 'pyproject.toml'), opts.pyprojectToml, 'utf8');
  }

  if (opts.toolDecisions !== undefined) {
    const aiDir = join(dir, '.ai-factory');
    mkdirSync(aiDir, { recursive: true });
    writeFileSync(join(aiDir, 'tool-decisions.md'), opts.toolDecisions, 'utf8');
  }

  return dir;
}

/** Run the hook with cwd set to the fixture dir. Returns { status, stdout, stderr }.
 *  env is merged onto process.env (used to simulate ZCODE_PROJECT_DIR for the ZCode JSON path). */
function runHook(cwd: string, env: Record<string, string> = {}): { status: number; stdout: string; stderr: string } {
  // Default-scrub ZCODE_PROJECT_DIR: the runner may execute inside zcode (the framework's own dev
  // harness), which would flip _emit_warn to the JSON branch and break the plain-text assertions
  // below. The ZCode-JSON case passes ZCODE_PROJECT_DIR explicitly. Mirrors inject-subagent-context.test.ts.
  const fullEnv = { ...process.env };
  if (env.ZCODE_PROJECT_DIR === undefined) delete fullEnv.ZCODE_PROJECT_DIR;
  else fullEnv.ZCODE_PROJECT_DIR = env.ZCODE_PROJECT_DIR;
  const r = spawnSync('bash', [HOOK], {
    cwd,
    encoding: 'utf8',
    env: fullEnv,
    // Hook is UserPromptSubmit — does not read stdin for dispatch logic.
    // Provide empty object as stdin to match CC harness pattern.
    input: JSON.stringify({}),
  });
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

describe('deps-hash-check.sh — UserPromptSubmit deps-drift context injector', () => {
  // ---------------------------------------------------------------------------
  // PAIRED-NEGATIVE: the one case that should produce output
  // ---------------------------------------------------------------------------

  it('PAIRED-NEGATIVE: stale stored hash → warning printed to stdout, exit 0', () => {
    // Hook line 40-42: if CURRENT_HASH != STORED_HASH → printf warning.
    // Hook line 44: always exit 0.
    const pkg = { dependencies: { react: '^18.0.0' }, devDependencies: { vitest: '^4.0.0' } };
    // Deliberately store a wrong but well-formed `sha256-` baseline so the hook sees a real
    // drift (a stored sha256 that no longer matches) — distinct from the unbaselined
    // `<pending>` placeholder case below (GH #548). A real sha256 of these deps is never
    // all-zeros, so this is guaranteed-different yet keeps the `sha256-` prefix that the
    // fix keys on. (The former `correctHash.replace(/[a-f]/, '0')` accidentally corrupted
    // the `a` in "sha256", producing an unbaselined-looking value, not a drift.)
    const staleHash = `sha256-${'0'.repeat(64)}`;

    const cwd = makeFixtureDir({
      packageJson: pkg,
      toolDecisions: `---\ndeps-hash: ${staleHash}\n---\n# tool decisions\n`,
    });

    const { status, stdout } = runHook(cwd);

    // Hook always exits 0 (line 44) — diagnostic only, never a gate.
    expect(status).toBe(0);
    // Warning MUST be present when hash is stale (line 41).
    expect(stdout).toContain('⚠');
    expect(stdout).toContain('package.json deps changed since last tool-bootstrap');
    expect(stdout).toContain('/tool-bootstrapping');
  });

  it('ZCODE: under ZCODE_PROJECT_DIR the warning is emitted as strict-JSON {additionalContext}, not plain text', () => {
    // ZCode parses hook stdout as JSON (HookJSONOutput schema); plain stdout is discarded.
    // _emit_warn branches on ZCODE_PROJECT_DIR. This guards the JSON branch.
    const pkg = { dependencies: { react: '^18.0.0' }, devDependencies: { vitest: '^4.0.0' } };
    const staleHash = `sha256-${'0'.repeat(64)}`;
    const cwd = makeFixtureDir({
      packageJson: pkg,
      toolDecisions: `---\ndeps-hash: ${staleHash}\n---\n# tool decisions\n`,
    });
    const { status, stdout } = runHook(cwd, { ZCODE_PROJECT_DIR: cwd });
    expect(status).toBe(0);
    // Must be valid JSON with the HookJSONOutput shape.
    const parsed = JSON.parse(stdout);
    expect(parsed.hookEventName).toBe('UserPromptSubmit');
    expect(parsed.additionalContext).toContain('package.json deps changed since last tool-bootstrap');
  });

  it('UNBASELINED: <pending> placeholder (not a sha256- baseline) → honest "not yet baselined" warning, NOT "deps changed" (GH #548)', () => {
    // Fresh-install state: install.sh seeds `deps-hash: <pending …>` (Option B, per
    // install.sh:566). The placeholder is non-empty, so the hook STILL warns every prompt
    // (the deliberate onboarding nudge) — but it must NOT claim deps "changed": nothing
    // changed and there was never a prior baseline.
    const pkg = { dependencies: { react: '^18.0.0' }, devDependencies: { vitest: '^4.0.0' } };

    const cwd = makeFixtureDir({
      packageJson: pkg,
      toolDecisions: `---\ndeps-hash: <pending — populated on first tool-bootstrap run>\n---\n`,
    });

    const { status, stdout } = runHook(cwd);

    expect(status).toBe(0);
    // Still warns (Option B keeps the per-prompt nudge until baselined).
    expect(stdout).toContain('⚠');
    expect(stdout).toContain('/tool-bootstrapping');
    // Honest wording for the unbaselined state.
    expect(stdout).toContain('not yet baselined');
    // The misleading "deps changed" claim must NOT appear when there is no baseline.
    expect(stdout).not.toContain('deps changed');
  });

  // ---------------------------------------------------------------------------
  // PAIRED-POSITIVE: clean states — must be silent
  // ---------------------------------------------------------------------------

  it('PAIRED-POSITIVE: matching stored hash → no stdout, exit 0', () => {
    // Hook lines 40-42: only prints if CURRENT_HASH != STORED_HASH.
    const pkg = { dependencies: { react: '^18.0.0' }, devDependencies: { vitest: '^4.0.0' } };
    const depsJson = buildDepsJson(pkg);
    const correctHash = computeHash(depsJson);

    const cwd = makeFixtureDir({
      packageJson: pkg,
      toolDecisions: `---\ndeps-hash: ${correctHash}\n---\n# tool decisions\n`,
    });

    const { status, stdout } = runHook(cwd);

    expect(status).toBe(0);
    // Silent on match — no warning injected into context.
    expect(stdout).toBe('');
  });

  it('SKIP: no .ai-factory/tool-decisions.md → silent exit 0', () => {
    // Hook line 16: [ -f "$DECISIONS" ] || exit 0
    const cwd = makeFixtureDir({
      packageJson: { dependencies: { react: '^18.0.0' } },
      // No toolDecisions → file not created.
    });

    const { status, stdout } = runHook(cwd);

    expect(status).toBe(0);
    expect(stdout).toBe('');
  });

  it('SKIP: tool-decisions.md exists but has no deps-hash: line → silent exit 0', () => {
    // Hook lines 19-20: STORED_HASH empty → exit 0.
    const cwd = makeFixtureDir({
      packageJson: { dependencies: { react: '^18.0.0' } },
      toolDecisions: `---\ntool-decisions: something\n---\n# no deps-hash here\n`,
    });

    const { status, stdout } = runHook(cwd);

    expect(status).toBe(0);
    expect(stdout).toBe('');
  });

  it('SKIP: no package.json → silent exit 0', () => {
    // Hook line 23: [ -f package.json ] || exit 0
    const cwd = makeFixtureDir({
      // No packageJson → file not created.
      toolDecisions: `---\ndeps-hash: sha256-deadbeef\n---\n`,
    });

    const { status, stdout } = runHook(cwd);

    expect(status).toBe(0);
    expect(stdout).toBe('');
  });

  it('BOUNDARY: empty deps object ({} + {}) → hash computed; matching stored hash → silent', () => {
    // Edge case: package.json with neither dependencies nor devDependencies.
    // buildDepsJson({}) → "{}", sha256 deterministic.
    // Cast to the deps-only type: name/version are valid package.json fields but
    // not part of the deps-extraction contract — the hook spreads only dep keys.
    const pkg = { name: 'test', version: '1.0.0' } as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const depsJson = buildDepsJson(pkg);
    const correctHash = computeHash(depsJson);

    const cwd = makeFixtureDir({
      packageJson: pkg,
      toolDecisions: `---\ndeps-hash: ${correctHash}\n---\n`,
    });

    const { status, stdout } = runHook(cwd);

    expect(status).toBe(0);
    expect(stdout).toBe('');
  });

  it('BOUNDARY: deps-hash: line has extra whitespace → still parsed correctly', () => {
    // Hook line 19: grep -m1 "^deps-hash:" | sed strip leading spaces.
    // Verify the sed pattern handles extra spaces after the colon.
    const pkg = { dependencies: { lodash: '^4.0.0' } };
    const depsJson = buildDepsJson(pkg);
    const correctHash = computeHash(depsJson);

    const cwd = makeFixtureDir({
      packageJson: pkg,
      toolDecisions: `---\ndeps-hash:   ${correctHash}\n---\n`,
    });

    const { status, stdout } = runHook(cwd);

    // Should parse the hash correctly and NOT emit a warning (they match).
    expect(status).toBe(0);
    expect(stdout).toBe('');
  });
});

describe('deps-hash-check.sh — source/dogfood byte-identity (@dual-pair: deps-hash-check-dogfood)', () => {
  // Drift-check from #382 §6: the shipped SOURCE (packages/core/hooks/) and this repo's
  // DOGFOOD copy (.claude/hooks/) must stay byte-identical. This test fails the moment
  // one copy is edited without the other — the mechanical guard that closes the silent-
  // drift hole the D.6 R-phase confirmed (the functional tests above run only the dogfood
  // copy via HOOK, so they would stay green even if the source diverged).
  it('packages/ source copy and .claude/ dogfood copy are byte-identical', () => {
    const source = readFileSync(HOOK_SOURCE, 'utf8');
    const dogfood = readFileSync(HOOK, 'utf8');
    expect(dogfood).toBe(source);
  });
});

// =============================================================================
// DH-S1 multistack (kickoff #1016) — per-stack baselines + JS-widen + python Tier-1/2.
// Design: docs/meta-factory/2026-07-17-deps-hash-multistack-dh-s1-design.md.
// These are RED against the pre-DH-S1 hook (JS-only, single deps-hash: key) and turn
// GREEN once the hook is rewritten (commit B). Each case names its design-spec §ref.
// =============================================================================

describe('deps-hash-check.sh — DH-S1 multistack (per-stack baselines, JS-widen, python tiers)', () => {
  // ---- (a) JS-widen: peerDependencies/overrides change the npm hash ----
  it('JS-WIDEN: a package.json with peerDependencies only → npm hash differs from legacy 2-field surface; matching stored deps-hash-npm → silent (design §1-E, §3a m1)', () => {
    const pkg = { peerDependencies: { react: '^18.0.0' } };
    const depsJson = buildDepsJson(pkg); // widened helper → {"react":"^18.0.0"}
    const correctHash = computeHash(depsJson);
    const cwd = makeFixtureDir({
      packageJson: pkg,
      toolDecisions: `---\ndeps-hash-npm: ${correctHash}\n---\n`,
    });
    const { status, stdout } = runHook(cwd);
    expect(status).toBe(0);
    expect(stdout).toBe(''); // silent when the widened hash matches the stored deps-hash-npm
  });

  it('JS-WIDEN-GUARD: string-typed overrides ("$REACT") is dropped, NOT spread into char keys (design §3a m1)', () => {
    // npm allows overrides as a string reference. A naive {...p.overrides} on a string produces
    // {"0":"$","1":"R",...} — corrupts the hash. The hook guards with typeof === 'object'.
    const pkg = {
      dependencies: { react: '^18.0.0' },
      overrides: '$REACT' as unknown as Record<string, string>, // string, must be dropped
    };
    const depsJson = buildDepsJson(pkg); // → {"react":"^18.0.0"} (overrides string dropped)
    const correctHash = computeHash(depsJson);
    const cwd = makeFixtureDir({
      packageJson: pkg,
      toolDecisions: `---\ndeps-hash-npm: ${correctHash}\n---\n`,
    });
    const { status, stdout } = runHook(cwd);
    expect(status).toBe(0);
    expect(stdout).toBe(''); // matches → silent. Would FAIL if hook spread the string.
  });

  // ---- (b) python Tier-1 6-table: a Poetry deps drift fires deps-hash-python WARN ----
  it('PYTHON-TIER1: [tool.poetry.dependencies] version drift → deps-hash-python WARN (design §4 Tier-1)', () => {
    const pyproject = [
      '[project]',
      'name = "demo"',
      'version = "0.1.0"',
      'dependencies = ["click"]',
      '[tool.poetry.dependencies]',
      'flask = "^2.0"',
      '',
    ].join('\n');
    const correctHash = computePythonHash({ pyprojectContent: pyproject });
    // store a deliberately-wrong (drifted) python hash → WARN expected
    const cwd = makeFixtureDir({
      pyprojectToml: pyproject,
      toolDecisions: `---\ndeps-hash-python: sha256-${'0'.repeat(64)}\n---\n`,
    });
    const { status, stdout } = runHook(cwd);
    expect(status).toBe(0);
    expect(stdout).toContain('⚠');
    expect(stdout).toLowerCase();
    // the WARN should name the python stack (per-stack WARN, design §1-D)
    expect(stdout.toLowerCase()).toMatch(/python/);
  });

  it('PYTHON-TIER1-MATCH: [tool.poetry.dependencies] matching stored deps-hash-python → silent', () => {
    const pyproject = [
      '[project]',
      'name = "demo"',
      'version = "0.1.0"',
      '[tool.poetry.dependencies]',
      'flask = "^2.0"',
      '',
    ].join('\n');
    const correctHash = computePythonHash({ pyprojectContent: pyproject });
    const cwd = makeFixtureDir({
      pyprojectToml: pyproject,
      toolDecisions: `---\ndeps-hash-python: ${correctHash}\n---\n`,
    });
    const { status, stdout } = runHook(cwd);
    expect(status).toBe(0);
    expect(stdout).toBe('');
  });

  // ---- (b') [project] is Tier-2-only (D1 C-resolution): own-version bump does NOT fire; deps bump DOES (via tomllib) ----
  it('PYTHON-PROJECT-NO-FP: bumping project OWN version does NOT fire (no cry-wolf) (design §4/§7 C)', () => {
    const pyproject = [
      '[project]',
      'name = "demo"',
      'version = "0.1.0"',
      'dependencies = ["requests>=2.0"]',
      '',
    ].join('\n');
    const correctHash = computePythonHash({ pyprojectContent: pyproject });
    const cwd = makeFixtureDir({
      pyprojectToml: pyproject,
      toolDecisions: `---\ndeps-hash-python: ${correctHash}\n---\n`,
    });
    const { status, stdout } = runHook(cwd);
    expect(status).toBe(0);
    expect(stdout).toBe(''); // own-version is not a dep → no drift
  });

  it('PYTHON-PROJECT-DRIFT: bumping [project].dependencies version FIRES via Tier-2 tomllib (design §4/§7 C)', () => {
    const pyproject = [
      '[project]',
      'name = "demo"',
      'version = "0.1.0"',
      'dependencies = ["requests>=2.32"]', // bumped from a prior 2.0 baseline
      '',
    ].join('\n');
    // store the PRIOR (2.0) hash → current is 2.32 → drift expected
    const priorPyproject = pyproject.replace('requests>=2.32', 'requests>=2.0');
    const priorHash = computePythonHash({ pyprojectContent: priorPyproject });
    const cwd = makeFixtureDir({
      pyprojectToml: pyproject,
      toolDecisions: `---\ndeps-hash-python: ${priorHash}\n---\n`,
    });
    const { status, stdout } = runHook(cwd);
    expect(status).toBe(0);
    expect(stdout).toContain('⚠');
    expect(stdout.toLowerCase()).toMatch(/python/);
  });

  // ---- (c) node-free python lane: Tier-1 hashes without node/python3; no manifests → silent ----
  it('NODE-FREE-PYTHON-TIER1: pyproject + no node + no python3 → Tier-1 still hashes the 6 tables, warns on drift (design §3a, §5 c1)', () => {
    // Simulate no-python3 by telling the helper Tier-2 contributes "". The hook's python3 gate
    // means Tier-2 is skipped, so only the 6 Tier-1 tables are hashed.
    const pyproject = [
      '[tool.poetry.dependencies]',
      'flask = "^2.0"',
      '',
    ].join('\n');
    const correctHash = computePythonHash({ pyprojectContent: pyproject, hasPython3: false });
    const cwd = makeFixtureDir({
      pyprojectToml: pyproject,
      toolDecisions: `---\ndeps-hash-python: sha256-${'0'.repeat(64)}\n---\n`,
    });
    // Scrub PATH of node+python3 to prove Tier-1 needs neither (best-effort: scrub python3).
    const { status, stdout } = runHook(cwd, { PATH: '/usr/bin:/bin' });
    expect(status).toBe(0);
    // Tier-1 still detects the drift (stored all-zeros != real hash) → WARN
    expect(stdout).toContain('⚠');
  });

  it('NO-MANIFESTS: no package.json + no pyproject.toml → silent exit 0 (design §5 c2)', () => {
    const cwd = makeFixtureDir({
      toolDecisions: `---\ndeps-hash-npm: sha256-deadbeef\ndeps-hash-python: sha256-deadbeef\n---\n`,
    });
    const { status, stdout } = runHook(cwd);
    expect(status).toBe(0);
    expect(stdout).toBe('');
  });

  // ---- (d) Tier-2 degrade: malformed pyproject → tomllib raises → empty Tier-2, Tier-1 stands ----
  it('PYTHON-TIER2-DEGRADE: malformed pyproject (unbalanced bracket) → tomllib raises → empty Tier-2, Tier-1 hash still stands, no crash (design §3a R4, §6)', () => {
    const malformed = [
      '[project]',
      'dependencies = [', // unbalanced — tomllib.load raises
      '  "click"',
      '[tool.poetry.dependencies]',
      'flask = "^2.0"',
      '',
    ].join('\n');
    // The hook must not crash; it computes Tier-1 only (tomllib failed) and compares.
    // Store a deliberately-drifted python hash → WARN from Tier-1 path.
    const cwd = makeFixtureDir({
      pyprojectToml: malformed,
      toolDecisions: `---\ndeps-hash-python: sha256-${'0'.repeat(64)}\n---\n`,
    });
    const { status, stdout, stderr } = runHook(cwd);
    expect(status).toBe(0); // never crashes — always exit 0 (non-blocking contract)
    expect(stderr).toBe(''); // no traceback leaks to stderr
    // Tier-1 over [tool.poetry.dependencies] still differs from all-zeros → WARN
    expect(stdout).toContain('⚠');
  });

  // ---- (e) ZCode combined-WARN: npm + python both drift → ONE valid JSON object (design §3a M2) ----
  it('ZCODE-COMBINED-WARN: npm AND python both drift under ZCODE_PROJECT_DIR → ONE JSON object, parses cleanly (design §3a M2)', () => {
    const pkg = { dependencies: { react: '^18.0.0' } };
    const pyproject = '[tool.poetry.dependencies]\nflask = "^2.0"\n';
    const cwd = makeFixtureDir({
      packageJson: pkg,
      pyprojectToml: pyproject,
      toolDecisions: `---\ndeps-hash-npm: sha256-${'0'.repeat(64)}\ndeps-hash-python: sha256-${'0'.repeat(64)}\n---\n`,
    });
    const { status, stdout } = runHook(cwd, { ZCODE_PROJECT_DIR: cwd });
    expect(status).toBe(0);
    // CRITICAL: must be a SINGLE parseable JSON object (two objects → JSON.parse throws).
    const parsed = JSON.parse(stdout); // throws if two objects concatenated
    expect(parsed.hookEventName).toBe('UserPromptSubmit');
    // both stacks mentioned in the single additionalContext
    expect(parsed.additionalContext).toMatch(/npm|package\.json|js/i);
    expect(parsed.additionalContext).toMatch(/python|pyproject/i);
  });

  // ---- (f) legacy-key precedence: deps-hash-npm wins over deps-hash (design §3a M1) ----
  it('LEGACY-PRECEDENCE: tool-decisions.md with BOTH deps-hash: and deps-hash-npm: → npm slot reads deps-hash-npm (design §3a M1)', () => {
    const pkg = { dependencies: { react: '^18.0.0' } };
    const correctHash = computeHash(buildDepsJson(pkg));
    const cwd = makeFixtureDir({
      packageJson: pkg,
      // legacy deps-hash: is deliberately WRONG (drifted); deps-hash-npm: is CORRECT.
      // If precedence is right, npm reads deps-hash-npm → match → silent.
      // If precedence is wrong (legacy shadows), npm reads drifted deps-hash: → WARN.
      toolDecisions: `---\ndeps-hash: sha256-${'0'.repeat(64)}\ndeps-hash-npm: ${correctHash}\n---\n`,
    });
    const { status, stdout } = runHook(cwd);
    expect(status).toBe(0);
    expect(stdout).toBe(''); // deps-hash-npm wins → match → silent
  });

  // ---- backward-compat: legacy-only deps-hash: still reads as npm slot (no regression) ----
  it('LEGACY-BACKCOMPAT: tool-decisions.md with ONLY legacy deps-hash: → still read as npm slot (design §1-C)', () => {
    const pkg = { dependencies: { react: '^18.0.0' } };
    const correctHash = computeHash(buildDepsJson(pkg));
    const cwd = makeFixtureDir({
      packageJson: pkg,
      toolDecisions: `---\ndeps-hash: ${correctHash}\n---\n`,
    });
    const { status, stdout } = runHook(cwd);
    expect(status).toBe(0);
    expect(stdout).toBe(''); // legacy key read as npm → match → silent
  });
});
