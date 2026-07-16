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

/** Build the deps JSON in the same way node -e does in the hook (line 26-29). */
function buildDepsJson(pkg: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}): string {
  return JSON.stringify({
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  });
}

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Create a temp dir with optional fixtures. Returns the temp dir path. */
function makeFixtureDir(opts: {
  packageJson?: object;
  toolDecisions?: string; // full file content; null = don't create
} = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'deps-hash-test-'));
  tmpDirs.push(dir);

  if (opts.packageJson !== undefined) {
    writeFileSync(join(dir, 'package.json'), JSON.stringify(opts.packageJson), 'utf8');
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
  const r = spawnSync('bash', [HOOK], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
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
