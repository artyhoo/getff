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
 * Compute the deps-hash-python value by RUNNING the exact commands the hook runs (Tier-1
 * awk + Tier-2 python3 tomllib), against a temp file holding pyprojectContent. This is a
 * TRUE ORACLE, not a parallel reimplementation — it eliminates any helper/hook drift by
 * construction (design §4). The two tiers are assembled exactly as the hook will assemble
 * them: tier1 = sha256(awk 6-table byte-range), tier2 = sha256(python3 json.dumps compact
 * of sorted [project] deps arrays), combined = sha256(tier1hex + tier2hex).
 *
 * Round-2 review caught that a JS reimplementation drifted from the hook on TWO axes:
 * (B-Tier2) python repr() vs JS JSON.stringify single/double-quote + dict/array shape;
 * (M1) JS header regex /^\\[([^\\]]+)\\]$/ does not treat [[array-table]] as a boundary,
 * leaking Poetry [[tool.poetry.source]] blocks that awk correctly excludes. Delegating to
 * the real awk + python3 closes both. hasPython3:false simulates the node-free-no-python3
 * lane (Tier-2 contributes "" exactly as the hook's missing-python3 branch does).
 */
function computePythonHash(opts: {
  pyprojectContent: string;
  hasPython3?: boolean; // default true; false simulates node-free-no-python3 (Tier-2 → "")
}): string {
  const hasPython3 = opts.hasPython3 ?? true;
  // Write the content to a temp file so awk/python3 read the same bytes the hook will.
  const tmpFile = join(tmpdir(), `deps-hash-py-${process.pid}-${Math.random().toString(36).slice(2)}.toml`);
  writeFileSync(tmpFile, opts.pyprojectContent, 'utf8');
  tmpFiles.push(tmpFile);
  try {
    // Tier-1: the 6-table awk matcher (design §4). Identical to the hook's awk — tables:
    // project.optional-dependencies, dependency-groups, tool.poetry.dependencies,
    // tool.poetry.dev-dependencies, tool.poetry.group.<name>.dependencies (glob),
    // tool.hatch.envs.<name> (glob). [project] deliberately excluded (D1 C-resolution).
    // The leading {gsub(/\r/,"")} strips Windows CRLF — mirrors the hook (round-3.5 review B1:
    // without it, substr on `[hdr]\r` leaks `]` and silently drops 5/6 tables on Windows).
    const awkProg =
      '{gsub(/\\r/,"")}' +
      'function want(h){' +
      'if(h=="project.optional-dependencies")return 1;' +
      'if(h=="dependency-groups")return 1;' +
      'if(h=="tool.poetry.dependencies")return 1;' +
      'if(h=="tool.poetry.dev-dependencies")return 1;' +
      'if(h~/^tool\\.poetry\\.group\\.[^.]+\\.dependencies$/)return 1;' +
      'if(h~/^tool\\.hatch\\.envs\\.[^.]+$/)return 1;' +
      'return 0}' +
      '/^\\[/{in_t=want(substr($0,2,length($0)-2))}in_t';
    const tier1Raw = spawnSync('awk', [awkProg, tmpFile], { encoding: 'utf8' });
    const tier1Hex = tier1Raw.status === 0
      ? crypto.createHash('sha256').update(tier1Raw.stdout).digest('hex')
      : '';
    // Tier-2 sentinel: sha256("[][]") — the EXACT Tier-2 value tomllib produces for a pyproject
    // with no [project] deps. Used when tomllib is unavailable (hasPython3:false) so a python
    // 3.10→3.11 upgrade does NOT shift the baseline for a pyproject without [project] deps
    // (round-3.5 review B2). Mirrors the hook's _PY_TIER2_SENTINEL.
    const TIER2_SENTINEL = crypto.createHash('sha256').update('[][]').digest('hex');
    // Tier-2: real tomllib hash if hasPython3; else the sentinel (NOT "") per B2.
    let tier2Hex = TIER2_SENTINEL;
    if (hasPython3) {
      // ONE try around import+load+print so any error (malformed TOML, no tomllib) → empty
      // stdout (design §3a R4). json.dumps compact mirrors the JS-friendly deterministic shape.
      // IMPORTANT: join with "\n" (NOT ";") — Python try:/except blocks are newline-delimited,
      // a ";" join would be a SyntaxError and silently yield empty tier2 (a prior helper bug
      // that mismatched the hook). This must byte-match the hook's _PY_TIER2_SCRIPT.
      const py = [
        'import sys',
        'try:',
        '  import tomllib,json,hashlib',
        '  d=tomllib.load(open(sys.argv[1],"rb"))',
        '  p=d.get("project",{})',
        '  deps=p.get("dependencies",[]);opt=p.get("optional-dependencies",{})',
        '  payload=json.dumps(sorted(deps),separators=(",",":"))+json.dumps([[k,sorted(v)] for k,v in sorted(opt.items())],separators=(",",":"))',
        '  print(hashlib.sha256(payload.encode()).hexdigest())',
        'except Exception:',
        '  pass',
      ].join('\n');
      const tier2Raw = spawnSync('python3', ['-c', py, tmpFile], { encoding: 'utf8' });
      const raw = (tier2Raw.stdout ?? '').trim();
      // Mirrors the hook: tomllib parse failure / no tomllib → use the sentinel (NOT ""), so
      // a pyproject without [project] deps hashes identically whether tomllib ran or not (B2).
      tier2Hex = raw.length > 0 ? raw : TIER2_SENTINEL;
    }
    // Combined python hash = sha256(tier1hex + tier2hex). Mirrors the hook's assembly.
    return `sha256-${crypto.createHash('sha256').update(tier1Hex + tier2Hex).digest('hex')}`;
  } finally {
    // tmpFiles cleaned in afterEach; the try/finally keeps the oracle robust if crypto throws.
  }
}

// Tier-1 table-boundary awk program. Mirrors the hook's _CARGO_TIER1_AWK exactly — tables:
// dependencies / dev-dependencies / build-dependencies (+ dotted sub-tables of each),
// target.*.{dependencies,dev-dependencies,build-dependencies}, workspace.{dependencies,
// dev-dependencies,build-dependencies}. The leading {gsub(/\r/,"")} mirrors the python lane's
// CRLF-safety fix (round-3.5 review B1). Kept as a single module-level constant (not
// re-declared per-helper) so computeCargoHash and cargoTier1Extract cannot drift from each
// other — update this ONE constant (in lockstep with the hook's _CARGO_TIER1_AWK) when fixing
// extraction bugs, never patch computeCargoHash/cargoTier1Extract separately.
const CARGO_TIER1_AWK_PROG =
  '{gsub(/\\r/,"")}' +
  'function want(h){' +
  'if(h=="dependencies")return 1;' +
  'if(h=="dev-dependencies")return 1;' +
  'if(h=="build-dependencies")return 1;' +
  'if(h~/^dependencies\\./)return 1;' +
  'if(h~/^dev-dependencies\\./)return 1;' +
  'if(h~/^build-dependencies\\./)return 1;' +
  'if(h~/^target\\..+\\.dependencies$/)return 1;' +
  'if(h~/^target\\..+\\.dev-dependencies$/)return 1;' +
  'if(h~/^target\\..+\\.build-dependencies$/)return 1;' +
  'if(h~/^target\\..+\\.dependencies\\./)return 1;' +
  'if(h~/^target\\..+\\.dev-dependencies\\./)return 1;' +
  'if(h~/^target\\..+\\.build-dependencies\\./)return 1;' +
  'if(h=="workspace.dependencies")return 1;' +
  'if(h=="workspace.dev-dependencies")return 1;' +
  'if(h=="workspace.build-dependencies")return 1;' +
  'if(h~/^workspace\\.dependencies\\./)return 1;' +
  'if(h~/^workspace\\.dev-dependencies\\./)return 1;' +
  'if(h~/^workspace\\.build-dependencies\\./)return 1;' +
  'return 0}' +
  '/^\\[/{in_t=want(substr($0,2,length($0)-2))}in_t';

/**
 * Run ONLY the Tier-1 awk step against cargoTomlContent and return its raw stdout (the
 * extracted byte range, unhashed). Used to directly prove which table headers the extractor
 * captures — the precise regression-test tool for the DH-S2 code-review bug (missing dotted
 * sub-table branches for the target.* and workspace.* prefixes — the fix lives in
 * CARGO_TIER1_AWK_PROG above).
 */
function cargoTier1Extract(cargoTomlContent: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'deps-hash-cargo-tier1-'));
  tmpDirs.push(dir);
  const manifestPath = join(dir, 'Cargo.toml');
  writeFileSync(manifestPath, cargoTomlContent, 'utf8');
  const raw = spawnSync('awk', [CARGO_TIER1_AWK_PROG, manifestPath], { encoding: 'utf8' });
  return raw.status === 0 ? raw.stdout : '';
}

/**
 * Compute the deps-hash-cargo value by RUNNING the exact commands the hook runs (Tier-1 awk
 * table-boundary hash + Tier-2 `cargo metadata --no-deps --format-version 1 --offline` piped
 * through python3), against a temp Cargo.toml holding cargoTomlContent. TRUE ORACLE — same
 * rationale as computePythonHash (design DH-S2): delegating to the real awk/cargo/python3
 * eliminates any helper/hook reimplementation drift by construction.
 */
function computeCargoHash(opts: {
  cargoTomlContent: string;
  hasCargo?: boolean; // default true; false simulates no-cargo-on-PATH (Tier-2 → "")
  hasPython3?: boolean; // default true; false simulates no-python3-on-PATH (Tier-2 → "")
}): string {
  const hasCargo = opts.hasCargo ?? true;
  const hasPython3 = opts.hasPython3 ?? true;
  // cargo requires the manifest file to be literally named Cargo.toml in its own directory
  // (verified live: `--manifest-path notcargo.toml` → "the manifest-path must be a path to a
  // Cargo.toml file") — unlike the python oracle, a single shared-tmpdir file won't do.
  const dir = mkdtempSync(join(tmpdir(), 'deps-hash-cargo-'));
  tmpDirs.push(dir);
  const manifestPath = join(dir, 'Cargo.toml');
  writeFileSync(manifestPath, opts.cargoTomlContent, 'utf8');

  const tier1Raw = spawnSync('awk', [CARGO_TIER1_AWK_PROG, manifestPath], { encoding: 'utf8' });
  const tier1Hex = tier1Raw.status === 0
    ? crypto.createHash('sha256').update(tier1Raw.stdout).digest('hex')
    : '';

  // Tier-2: cargo metadata --no-deps --format-version 1 --offline | python3 pluck. Empty
  // (not a sentinel — DH-S2 does not need python's sentinel trick, per kickoff §DH-S2) when
  // cargo or python3 is absent, or when either step fails (e.g. the fixture has no src/
  // target — same failure the real hook hits against the same bare-manifest fixture, so
  // oracle and hook degrade identically).
  let tier2Hex = '';
  if (hasCargo && hasPython3) {
    const py = [
      'import sys,json,hashlib',
      'try:',
      '  d=json.load(sys.stdin)',
      '  deps=[]',
      '  for p in d.get("packages",[]):',
      '    for dep in p.get("dependencies",[]):',
      '      deps.append([dep.get("name",""),dep.get("req",""),dep.get("kind") or "normal",bool(dep.get("optional"))])',
      '  payload=json.dumps(sorted(deps),separators=(",",":"))',
      '  print(hashlib.sha256(payload.encode()).hexdigest())',
      'except Exception:',
      '  pass',
    ].join('\n');
    const metaRaw = spawnSync('cargo', ['metadata', '--no-deps', '--format-version', '1', '--offline'], {
      cwd: dir,
      encoding: 'utf8',
    });
    if (metaRaw.status === 0) {
      const tier2Raw = spawnSync('python3', ['-c', py], { input: metaRaw.stdout, encoding: 'utf8' });
      tier2Hex = (tier2Raw.stdout ?? '').trim();
    }
  }
  return `sha256-${crypto.createHash('sha256').update(tier1Hex + tier2Hex).digest('hex')}`;
}

const tmpDirs: string[] = [];
const tmpFiles: string[] = []; // single-line temp files for computePythonHash's awk/python invocations
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
  for (const f of tmpFiles.splice(0)) {
    try { rmSync(f, { force: true }); } catch { /* already gone */ }
  }
});

/** Create a temp dir with optional fixtures. Returns the temp dir path. */
function makeFixtureDir(opts: {
  packageJson?: object;
  pyprojectToml?: string; // full pyproject.toml content; omitted = don't create
  cargoToml?: string; // full Cargo.toml content; omitted = don't create
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

  if (opts.cargoToml !== undefined) {
    writeFileSync(join(dir, 'Cargo.toml'), opts.cargoToml, 'utf8');
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

  it('JS-WIDEN-ALL-FIELDS: all 7 object-typed widened fields contribute to the npm hash (design §1-E; round-2 M3)', () => {
    // Coverage for the 4 fields JS-WIDEN/GUARD don't exercise: optionalDependencies, resolutions,
    // pnpm.overrides, AND overrides-as-object. A hook that spread only {deps,devDeps,peerDeps} would
    // compute a different hash → stored (7-field) hash mismatches → WARN. Silent here = all included.
    const pkg = {
      dependencies: { react: '^18.0.0' },
      devDependencies: { vitest: '^1.0.0' },
      peerDependencies: { react: '^18.0.0' },
      optionalDependencies: { fsevents: '^2.0.0' },
      overrides: { react: '^18.2.0' },
      resolutions: { lodash: '^4.17.21' },
      pnpm: { overrides: { some: '1.0.0' } },
    };
    const depsJson = buildDepsJson(pkg);
    const correctHash = computeHash(depsJson);
    const cwd = makeFixtureDir({
      packageJson: pkg,
      toolDecisions: `---\ndeps-hash-npm: ${correctHash}\n---\n`,
    });
    const { status, stdout } = runHook(cwd);
    expect(status).toBe(0);
    expect(stdout).toBe(''); // all 7 fields hashed → match → silent
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
  it('NODE-FREE-PYTHON-TIER1: pyproject (Tier-1-only table, no [project]) → Tier-1 detects drift with NO node on PATH (design §3a, §5 c1)', () => {
    // This fixture has ONLY a Tier-1 table ([tool.poetry.dependencies]) and NO [project], so
    // Tier-2 (tomllib for [project].deps) contributes nothing regardless of python3 availability.
    // The contract under test: Tier-1 bash hashing needs NO node and NO python3 — it detects the
    // drift via awk+sha alone. We scrub node from PATH (the JS lane's toolchain) to prove the
    // python Tier-1 path is independent of it. (Scrubbing python3 itself is machine-fragile — on
    // macOS /usr/bin/python3 is a CLT stub — so the fixture carries no [project], making python3
    // presence irrelevant to the asserted WARN. design §6 documents the [project]-coverage cost.)
    const pyproject = ['[tool.poetry.dependencies]', 'flask = "^2.0"', ''].join('\n');
    const cwd = makeFixtureDir({
      pyprojectToml: pyproject,
      toolDecisions: `---\ndeps-hash-python: sha256-${'0'.repeat(64)}\n---\n`,
    });
    // PATH keeps awk/grep/shasum (Tier-1 needs them) but drops /opt/homebrew/bin (node lives
    // there). node absence is the load-bearing scrub; python3 may or may not resolve but the
    // fixture has no [project] so it cannot change the outcome.
    const { status, stdout } = runHook(cwd, { PATH: '/usr/bin:/bin' });
    expect(status).toBe(0);
    // Tier-1 detects the drift (stored all-zeros != real Tier-1 hash) → WARN
    expect(stdout).toContain('⚠');
  });

  it('PYTHON-CRLF: identical pyproject content under CRLF (Windows) hashes the SAME as LF — no cross-platform spurious drift (round-3.5 review B1)', () => {
    // Round-3.5 review B1: the awk's substr($0,2,length-2) on `[hdr]\r` leaked `]`, silently
    // dropping 5/6 tables and producing a different hash. Fix: {gsub(/\r/,"")} in the awk.
    // This test is non-vacuous: removing the gsub makes it FAIL (CRLF → different hash).
    const lfContent = ['[tool.poetry.dependencies]', 'flask = "^2.0"', ''].join('\n');
    const crlfContent = lfContent.replace(/\n/g, '\r\n'); // identical bytes modulo line endings
    const lfHash = computePythonHash({ pyprojectContent: lfContent });
    const crlfHash = computePythonHash({ pyprojectContent: crlfContent });
    // The oracle hashes the same regardless of line endings (both go through the gsub awk).
    expect(crlfHash).toBe(lfHash);
    // And the hook, given a baselined CRLF pyproject and an LF baseline, stays silent:
    const cwd = makeFixtureDir({
      pyprojectToml: crlfContent,
      toolDecisions: `---\ndeps-hash-python: ${lfHash}\n---\n`,
    });
    const { status, stdout } = runHook(cwd);
    expect(status).toBe(0);
    expect(stdout).toBe(''); // CRLF content matches LF-stored baseline → no spurious drift
  });

  it('PYTHON-UPGRADE-STABLE: a pyproject WITHOUT [project] deps hashes the SAME whether tomllib is present or absent (round-3.5 review B2)', () => {
    // Round-3.5 review B2: python 3.10→3.11 upgrade shifted the baseline for an unchanged
    // pyproject because Tier-2 (tomllib) went from "" to populated. Fix: when tomllib is
    // unavailable, Tier-2 contributes the sentinel sha256("[][]") — the EXACT value tomllib
    // produces for a no-[project] pyproject — so the upgrade does not shift such baselines.
    const pyproject = ['[tool.poetry.dependencies]', 'flask = "^2.0"', ''].join('\n'); // no [project]
    const withTomllib = computePythonHash({ pyprojectContent: pyproject, hasPython3: true });
    const withoutTomllib = computePythonHash({ pyprojectContent: pyproject, hasPython3: false });
    expect(withoutTomllib).toBe(withTomllib); // sentinel makes them equal → no upgrade drift
  });

  it('PYTHON-FRESH-INSTALL: python-only consumer with <pending> deps-hash-python → onboarding WARN (round-3.5 review M1)', () => {
    // Round-3.5 review M1: a fresh-install python-only consumer (pyproject, no package.json)
    // got ZERO nudge because the install template seeded only legacy deps-hash: (read as the
    // npm slot), leaving the python slot empty → _drifted silently skipped. Fix: the template
    // now seeds deps-hash-python: <pending> too; the <pending> value (non-sha256-*) hits the
    // honest "not yet baselined" case branch (NOT "deps changed"). decision-format.md:27 contract.
    const pyproject = ['[tool.poetry.dependencies]', 'flask = "^2.0"', ''].join('\n');
    const cwd = makeFixtureDir({
      pyprojectToml: pyproject,
      // The fresh-install seed: all three keys present (npm/python/legacy), all <pending>.
      toolDecisions: `---\ndeps-hash-npm: <pending — populated on first tool-bootstrap>\ndeps-hash-python: <pending — populated on first tool-bootstrap>\ndeps-hash: <pending — populated on first tool-bootstrap>\n---\n`,
    });
    const { status, stdout } = runHook(cwd);
    expect(status).toBe(0);
    expect(stdout).toContain('⚠');
    expect(stdout.toLowerCase()).toContain('python');
    // Honest wording: "not yet baselined", NOT the misleading "deps changed".
    expect(stdout.toLowerCase()).toContain('baselined');
    expect(stdout.toLowerCase()).not.toContain('deps changed');
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

// =============================================================================
// DH-S2 (kickoff §DH-S2) — rust (Cargo.toml) Tier-1 table-boundary + Tier-2 `cargo metadata`
// enrichment. DETECT-ONLY: no setup.d/NN-rust.sh delivery lane (boundary, kickoff §DH-S2 /
// STOP lines). These are RED against the pre-DH-S2 hook (deps-hash-cargo is a RESERVED key,
// never read) and turn GREEN once the hook gains _cargo_current() + the CARGO_STORED wiring.
// =============================================================================

describe('deps-hash-check.sh — DH-S2 rust (Cargo.toml Tier-1/Tier-2, detect-only)', () => {
  it('CARGO-TIER1: [dependencies] table-form deps → deps-hash-cargo WARN on drift, silent on match (research-patch §1/§2)', () => {
    const cargoToml = [
      '[package]',
      'name = "demo"',
      'version = "0.1.0"',
      '',
      '[dependencies]',
      'serde = "1.0"',
      '',
    ].join('\n');

    // drift case: stored hash deliberately wrong
    const drifted = makeFixtureDir({
      cargoToml,
      toolDecisions: `---\ndeps-hash-cargo: sha256-${'0'.repeat(64)}\n---\n`,
    });
    const driftedResult = runHook(drifted);
    expect(driftedResult.status).toBe(0);
    expect(driftedResult.stdout).toContain('⚠');
    expect(driftedResult.stdout.toLowerCase()).toMatch(/cargo\.toml/);

    // silent case: stored hash matches the real oracle hash
    const correctHash = computeCargoHash({ cargoTomlContent: cargoToml });
    const clean = makeFixtureDir({
      cargoToml,
      toolDecisions: `---\ndeps-hash-cargo: ${correctHash}\n---\n`,
    });
    const cleanResult = runHook(clean);
    expect(cleanResult.status).toBe(0);
    expect(cleanResult.stdout).toBe('');
  });

  it('CARGO-TIER1-INLINE-FORM: [dependencies.serde] dotted sub-table form is ALSO captured by the extractor (research-patch §1 "two equivalent forms")', () => {
    // Table-boundary hashing hashes literal bytes, so table-form ([dependencies]\nserde="1")
    // and dotted-form ([dependencies.serde]\nversion="1") are NOT byte-identical and WILL
    // hash differently — this test proves BOTH forms are captured (non-empty Tier-1 extraction
    // that changes the hash), not that they hash the same (per kickoff explicit instruction).
    const tableForm = ['[dependencies]', 'serde = "1.0"', ''].join('\n');
    const dottedForm = ['[dependencies.serde]', 'version = "1.0"', ''].join('\n');
    const noDepsAtAll = ['[package]', 'name = "demo"', 'version = "0.1.0"', ''].join('\n');

    const tableHash = computeCargoHash({ cargoTomlContent: tableForm });
    const dottedHash = computeCargoHash({ cargoTomlContent: dottedForm });
    const emptyHash = computeCargoHash({ cargoTomlContent: noDepsAtAll });

    // Both forms are captured: each differs from the "no deps tables at all" baseline.
    expect(tableHash).not.toBe(emptyHash);
    expect(dottedHash).not.toBe(emptyHash);
    // The dotted sub-table drifts against a baseline computed from the table-form (proving
    // the dotted form's content is actually reaching the hash, not being silently dropped).
    const cwd = makeFixtureDir({
      cargoToml: dottedForm,
      toolDecisions: `---\ndeps-hash-cargo: ${tableHash}\n---\n`,
    });
    const { status, stdout } = runHook(cwd);
    expect(status).toBe(0);
    expect(stdout).toContain('⚠');
  });

  it('CARGO-WORKSPACE: [workspace.dependencies] table is included in the hash (research-patch §1 "workspace.dependencies (+dev/build variants)")', () => {
    const withoutWorkspaceDeps = [
      '[workspace]',
      'members = ["crates/*"]',
      '',
    ].join('\n');
    const withWorkspaceDeps = [
      '[workspace]',
      'members = ["crates/*"]',
      '',
      '[workspace.dependencies]',
      'anyhow = "1.0"',
      '',
    ].join('\n');

    const baselineHash = computeCargoHash({ cargoTomlContent: withoutWorkspaceDeps });
    const cwd = makeFixtureDir({
      cargoToml: withWorkspaceDeps,
      toolDecisions: `---\ndeps-hash-cargo: ${baselineHash}\n---\n`,
    });
    const { status, stdout } = runHook(cwd);
    expect(status).toBe(0);
    // adding [workspace.dependencies] changes the hash vs the no-deps workspace root → WARN
    expect(stdout).toContain('⚠');
    expect(stdout.toLowerCase()).toMatch(/cargo\.toml/);
  });

  it('CARGO-TIER2-DEGRADE: no cargo on PATH → Tier-1 hash still stands, no crash, exit 0 (research-patch §2 "any non-zero exit → degrade to Tier-1")', () => {
    const cargoToml = [
      '[package]',
      'name = "demo"',
      'version = "0.1.0"',
      '',
      '[dev-dependencies]',
      'mockall = "0.11"',
      '',
    ].join('\n');
    // Oracle with cargo simulated absent (matches what the hook computes when we scrub PATH).
    const tier1OnlyHash = computeCargoHash({ cargoTomlContent: cargoToml, hasCargo: false });

    const cwd = makeFixtureDir({
      cargoToml,
      toolDecisions: `---\ndeps-hash-cargo: ${tier1OnlyHash}\n---\n`,
    });
    // Scrub PATH down to a minimal set that keeps awk/shasum but drops cargo (~/.cargo/bin
    // and /opt/homebrew/bin, where cargo/rustup commonly live).
    const { status, stdout, stderr } = runHook(cwd, { PATH: '/usr/bin:/bin' });
    expect(status).toBe(0); // never crashes — always exit 0
    expect(stderr).toBe(''); // no error leaks to stderr
    expect(stdout).toBe(''); // Tier-1-only hash matches the stored Tier-1-only baseline → silent
  });

  it('CARGO-NO-MANIFEST: no Cargo.toml → rust stack contributes nothing, silent (matches NO-MANIFESTS pattern, design §5 c2)', () => {
    const cwd = makeFixtureDir({
      // No cargoToml → file not created.
      toolDecisions: `---\ndeps-hash-cargo: sha256-${'0'.repeat(64)}\n---\n`,
    });
    const { status, stdout } = runHook(cwd);
    expect(status).toBe(0);
    expect(stdout).toBe('');
  });

  it('CARGO-POLYGLOT-WARN: a drifted Cargo.toml alongside a clean package.json fires ONLY the cargo WARN (per-stack independence, design §1-D)', () => {
    const pkg = { dependencies: { react: '^18.0.0' } };
    const npmHash = computeHash(buildDepsJson(pkg));
    const cargoToml = ['[dependencies]', 'serde = "1.0"', ''].join('\n');
    const cwd = makeFixtureDir({
      packageJson: pkg,
      cargoToml,
      toolDecisions: `---\ndeps-hash-npm: ${npmHash}\ndeps-hash-cargo: sha256-${'0'.repeat(64)}\n---\n`,
    });
    const { status, stdout } = runHook(cwd);
    expect(status).toBe(0);
    expect(stdout).toContain('⚠');
    expect(stdout.toLowerCase()).toMatch(/cargo\.toml/);
    // npm did not drift → its label must not appear in the WARN message.
    expect(stdout).not.toContain('package.json deps changed');
  });

  it('CARGO-TARGET-TABLE: a [target.<triple>.dependencies] table (target-cfg-gated deps) alone → WARN on drift, silent on match (research-patch §1 "target.*.{dependencies,…}")', () => {
    // Dedicated coverage: no prior test exercised [target.*.dependencies] content at all
    // (code-review finding) — only appeared inside the awk-literal string, never a fixture.
    const cargoToml = [
      '[package]',
      'name = "demo"',
      'version = "0.1.0"',
      '',
      '[target.x86_64-unknown-linux-gnu.dependencies]',
      'libc = "0.2"',
      '',
    ].join('\n');

    const drifted = makeFixtureDir({
      cargoToml,
      toolDecisions: `---\ndeps-hash-cargo: sha256-${'0'.repeat(64)}\n---\n`,
    });
    const driftedResult = runHook(drifted);
    expect(driftedResult.status).toBe(0);
    expect(driftedResult.stdout).toContain('⚠');

    const correctHash = computeCargoHash({ cargoTomlContent: cargoToml });
    const clean = makeFixtureDir({
      cargoToml,
      toolDecisions: `---\ndeps-hash-cargo: ${correctHash}\n---\n`,
    });
    const cleanResult = runHook(clean);
    expect(cleanResult.status).toBe(0);
    expect(cleanResult.stdout).toBe('');
  });

  it('CARGO-BUILD-DEPENDENCIES: a [build-dependencies] table alone → WARN on drift, silent on match (research-patch §1 dedicated coverage)', () => {
    // Dedicated discriminating test: prior fixtures only carried [build-dependencies]
    // incidentally alongside other tables (code-review finding).
    const withoutBuildDeps = ['[package]', 'name = "demo"', 'version = "0.1.0"', ''].join('\n');
    const withBuildDeps = withoutBuildDeps + ['[build-dependencies]', 'cc = "1.0"', ''].join('\n');

    const baselineHash = computeCargoHash({ cargoTomlContent: withoutBuildDeps });
    const drifted = makeFixtureDir({
      cargoToml: withBuildDeps,
      toolDecisions: `---\ndeps-hash-cargo: ${baselineHash}\n---\n`,
    });
    const driftedResult = runHook(drifted);
    expect(driftedResult.status).toBe(0);
    expect(driftedResult.stdout).toContain('⚠');

    const correctHash = computeCargoHash({ cargoTomlContent: withBuildDeps });
    const clean = makeFixtureDir({
      cargoToml: withBuildDeps,
      toolDecisions: `---\ndeps-hash-cargo: ${correctHash}\n---\n`,
    });
    const cleanResult = runHook(clean);
    expect(cleanResult.status).toBe(0);
    expect(cleanResult.stdout).toBe('');
  });

  it('CARGO-DOTTED-SUBTABLE-REGRESSION: workspace.dependencies.<crate> and target.<x>.dependencies.<crate> dotted long-form is captured by Tier-1 (code-review bug fix — was silently dropped)', () => {
    // Confirmed via live tomllib cross-check (code review): `[workspace.dependencies.qux]`
    // parses to the identical nested structure as `qux` under `[workspace.dependencies]`
    // directly — same for `[target.<x>.dependencies.<crate>]`. Both are Cargo-accepted
    // alternate syntax, NOT malformed input, so Tier-1 must capture them. Before the fix, the
    // want() function only carried the dotted-sub-table carve-out for the three BARE
    // top-level tables (dependencies/dev-dependencies/build-dependencies) — the target.*/
    // workspace.* branches were exact-match/$-anchored only, silently dropping this content.
    const workspaceWithoutDotted = ['[workspace.dependencies]', 'anyhow = "1.0"', ''].join('\n');
    const workspaceWithDotted =
      workspaceWithoutDotted + ['[workspace.dependencies.qux]', 'version = "1.0"', ''].join('\n');
    const targetWithoutDotted = ['[target.x86_64-unknown-linux-gnu.dependencies]', 'foo = "1.0"', ''].join('\n');
    const targetWithDotted =
      targetWithoutDotted + ["[target.'cfg(unix)'.dependencies.baz]", 'version = "1.0"', ''].join('\n');

    // Direct proof: the dotted-form table headers must reach the extracted byte range.
    expect(cargoTier1Extract(workspaceWithDotted)).toContain('workspace.dependencies.qux');
    expect(cargoTier1Extract(targetWithDotted)).toContain("cfg(unix)'.dependencies.baz");
    // And the extraction must actually DIFFER once the dotted content is added (not merely
    // present-but-inert in a byte range that gets discarded downstream).
    expect(cargoTier1Extract(workspaceWithDotted)).not.toBe(cargoTier1Extract(workspaceWithoutDotted));
    expect(cargoTier1Extract(targetWithDotted)).not.toBe(cargoTier1Extract(targetWithoutDotted));

    // End-to-end: adding the dotted-form content to an otherwise-unchanged manifest must
    // drift the stored baseline (a real hook run, not just the raw awk step).
    const baselineHash = computeCargoHash({ cargoTomlContent: workspaceWithoutDotted });
    const cwd = makeFixtureDir({
      cargoToml: workspaceWithDotted,
      toolDecisions: `---\ndeps-hash-cargo: ${baselineHash}\n---\n`,
    });
    const { status, stdout } = runHook(cwd);
    expect(status).toBe(0);
    expect(stdout).toContain('⚠');
  });
});

// =============================================================================
// DH-S3 closure (kickoff #1016 §2 DH-S3) — tomli shim (py3.7-3.10), polyglot
// cross-stack combined-WARN. Night-prompt STEP 3 deliverables 1-2.
// The PYTHON-TOMLI-SHIM case is RED against the pre-DH-S3 hook (Tier-2 script has
// no `tomli` fallback → degrades to empty when tomllib is absent) and turns GREEN
// once the shim lands (commit B). The POLYGLOT cases lock the design §3a M2
// single-emit contract at THREE stacks (they pass on the current hook — the
// combined-WARN assembly is already N-stack; they guard against a future
// per-stack-emit regression that would break ZCode's JSON.parse).
// =============================================================================

describe('deps-hash-check.sh — DH-S3 closure (tomli shim, polyglot cross-stack)', () => {
  it('PYTHON-TOMLI-SHIM: when tomllib is absent (py3.7-3.10) the Tier-2 script falls back to `tomli` and produces the byte-identical hash to tomllib (DH-S3 deliverable 1 — night-prompt "verify byte-match")', () => {
    // Extract the REAL _PY_TIER2_SCRIPT from the shipped hook (NOT a reimplementation → no
    // drift by construction). The script body uses only double-quotes internally, so a
    // non-greedy match up to the first "'" closes on the bash single-quoted heredoc exactly.
    const hookSrc = readFileSync(HOOK_SOURCE, 'utf8');
    // `'\r?\n` (not `'\n`) so the extraction survives a CRLF checkout of the hook — the closing
    // `'` is then followed by `\r\n`, and a bare `'\n` would return null (cold-review MINOR).
    const m = hookSrc.match(/_PY_TIER2_SCRIPT='([\s\S]*?)'\r?\n/);
    expect(m).not.toBeNull();
    const scriptBody = m![1];

    // A pyproject WITH [project].dependencies — Tier-2 (tomllib/tomli) is the tier that parses
    // these (Tier-1 awk deliberately excludes [project], design §4).
    const pyproj = ['[project]', 'name = "demo"', 'version = "0.1.0"', 'dependencies = ["requests>=2.32"]', ''].join('\n');
    const pyFile = join(tmpdir(), `dhs3-tomli-py-${process.pid}-${Math.random().toString(36).slice(2)}.toml`);
    const scriptFile = join(tmpdir(), `dhs3-tomli-script-${process.pid}-${Math.random().toString(36).slice(2)}.py`);
    writeFileSync(pyFile, pyproj, 'utf8');
    writeFileSync(scriptFile, scriptBody, 'utf8');
    tmpFiles.push(pyFile, scriptFile);

    // H1: the script under the native tomllib path (py3.11+ test env). argv[1] = pyproject.
    const h1 = (spawnSync('python3', ['-c', scriptBody, pyFile], { encoding: 'utf8' }).stdout ?? '').trim();

    // H2: force the real py3.7-3.10-with-tomli environment and exec the SAME extracted script.
    // The driver captures the real stdlib parser, re-exposes it under the name `tomli`, then
    // blocks `tomllib` so the script's first `import tomllib` raises ImportError → its fallback
    // `import tomli as tomllib` must pick up the (real) parser. This proves the fallback BRANCH
    // is wired AND yields the tomllib-identical payload — without adding a `tomli` dependency.
    const driver = [
      'import sys, types',
      'import tomllib as _real',              // capture the real parser BEFORE blocking the name
      "_ft = types.ModuleType('tomli')",
      '_ft.load = _real.load; _ft.loads = _real.loads',
      "sys.modules['tomli'] = _ft",           // fallback target = real parser
      "sys.modules['tomllib'] = None",        // force `import tomllib` → ImportError
      'exec(compile(open(sys.argv[2]).read(), "<shim>", "exec"))',
    ].join('\n');
    const h2 = (spawnSync('python3', ['-c', driver, pyFile, scriptFile], { encoding: 'utf8' }).stdout ?? '').trim();

    // Sanity: the tomllib path must actually produce a hash in this env (else the test is vacuous).
    expect(h1).not.toBe('');
    // Byte-match: the fallback path must produce the IDENTICAL hash. Pre-shim the script has no
    // `tomli` fallback → under H2 `import tomllib` raises → outer except → EMPTY → h2 !== h1 (RED).
    // Post-shim → h2 === h1 (GREEN).
    expect(h2).toBe(h1);
  });

  it('POLYGLOT-THREE-STACK-WARN: package.json + pyproject.toml + Cargo.toml ALL drift → ONE combined ⚠ block naming all three stacks (DH-S3 deliverable 2; design §3a M2 at three stacks)', () => {
    const pkg = { dependencies: { react: '^18.0.0' } };
    const pyproject = '[tool.poetry.dependencies]\nflask = "^2.0"\n';
    const cargo = '[dependencies]\nserde = "1.0"\n';
    const cwd = makeFixtureDir({
      packageJson: pkg,
      pyprojectToml: pyproject,
      cargoToml: cargo,
      // all three baselines deliberately stale (all-zeros sha256) → all three drift at once.
      toolDecisions: `---\ndeps-hash-npm: sha256-${'0'.repeat(64)}\ndeps-hash-python: sha256-${'0'.repeat(64)}\ndeps-hash-cargo: sha256-${'0'.repeat(64)}\n---\n`,
    });
    const { status, stdout } = runHook(cwd);
    expect(status).toBe(0);
    // EXACTLY ONE ⚠ (the M2 single-emit contract holds across three drifted stacks, not three
    // separate emissions — three plain lines would still be one hook run, but the ZCode sibling
    // below is the load-bearing case; here we assert the ⚠ prefix appears once).
    expect((stdout.match(/⚠/g) ?? []).length).toBe(1);
    expect(stdout).toContain('package.json');
    expect(stdout.toLowerCase()).toContain('python');
    expect(stdout).toContain('Cargo.toml');
    expect(stdout).toContain('/tool-bootstrapping');
  });

  it('POLYGLOT-THREE-STACK-ZCODE: all three stacks drift under ZCODE_PROJECT_DIR → ONE JSON object (not three), parses cleanly with all three named (DH-S3 deliverable 2; design §3a M2)', () => {
    const pkg = { dependencies: { react: '^18.0.0' } };
    const pyproject = '[tool.poetry.dependencies]\nflask = "^2.0"\n';
    const cargo = '[dependencies]\nserde = "1.0"\n';
    const cwd = makeFixtureDir({
      packageJson: pkg,
      pyprojectToml: pyproject,
      cargoToml: cargo,
      toolDecisions: `---\ndeps-hash-npm: sha256-${'0'.repeat(64)}\ndeps-hash-python: sha256-${'0'.repeat(64)}\ndeps-hash-cargo: sha256-${'0'.repeat(64)}\n---\n`,
    });
    const { status, stdout } = runHook(cwd, { ZCODE_PROJECT_DIR: cwd });
    expect(status).toBe(0);
    // CRITICAL: must be a SINGLE parseable JSON object — three concatenated objects → throw.
    const parsed = JSON.parse(stdout);
    expect(parsed.hookEventName).toBe('UserPromptSubmit');
    expect(parsed.additionalContext).toMatch(/package\.json|npm/i);
    expect(parsed.additionalContext).toMatch(/python/i);
    expect(parsed.additionalContext).toMatch(/cargo/i);
  });
});
