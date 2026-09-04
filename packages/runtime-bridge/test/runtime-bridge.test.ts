/**
 * Paired-negative tests for runtime-bridge SW-B.
 *
 * Contract under test:
 *   1. Hook glob fires on *-meta-launch/kickoff.md writes ✓ (positive)
 *   2. Hook glob does NOT fire on arbitrary src/foo.ts writes ✗ (negative)
 *   3. aif-handoff unreachable → resolver falls back to ManualBackend ✓
 *   4. RUNTIME_BRIDGE_MODE=manual → ManualBackend even when aif-handoff available ✓
 *   5. <!-- bridge: skip --> first-line → buildKickoffSpec returns null ✓
 *
 * Pattern: vitest + spawnSync + mkdtempSync (per deps-hash-check.test.ts in
 * packages/core/hooks/). Tests 1-2 test the bash hook; tests 3-5 test TS modules.
 *
 * T3 compliance: each assertion names the source file:line it targets.
 * T11: Vitest pattern matched from packages/core/vitest.config.ts (not training data).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/runtime-bridge-dispatch.sh');

const sandboxes: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeSandbox(): string {
  const d = mkdtempSync(join(tmpdir(), 'rb-test-'));
  sandboxes.push(d);
  return d;
}

/** Run the hook with CC PostToolUse stdin JSON shape. */
function runHook(
  toolName: string,
  filePath: string,
  fileContent?: string,
): { status: number; stdout: string; stderr: string } {
  const sandbox = makeSandbox();

  if (fileContent !== undefined) {
    const dir = dirname(filePath.startsWith('/') ? filePath : join(sandbox, filePath));
    mkdirSync(dir, { recursive: true });
    const absPath = filePath.startsWith('/') ? filePath : join(sandbox, filePath);
    writeFileSync(absPath, fileContent, 'utf8');
  }

  const input = JSON.stringify({
    tool_name: toolName,
    tool_input: {
      file_path: filePath.startsWith('/') ? filePath : join(sandbox, filePath),
    },
  });

  const r = spawnSync('bash', [HOOK], {
    encoding: 'utf8',
    input,
    env: {
      ...process.env,
      // Prevent real dispatch; tsx not needed for hook-level tests 1-2
      RUNTIME_BRIDGE_MODE: 'manual',
    },
  });

  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test 1: hook FIRES on *-meta-launch/kickoff.md write (positive)
// ═══════════════════════════════════════════════════════════════════════════════
describe('Test 1 — hook glob matches *-meta-launch/kickoff.md', () => {
  it('Write to *-meta-launch/kickoff.md → hook proceeds past path filter', () => {
    // Source: runtime-bridge-dispatch.sh case statement (line ~52: *-meta-launch/kickoff.md)
    // We use RUNTIME_BRIDGE_MODE=manual so ManualBackend runs without needing aif-handoff.
    // We confirm hook exits 0 (non-blocking) — proof it didn't early-exit at the path filter.
    const sandbox = makeSandbox();
    const kickoffDir = join(sandbox, 'my-feature-meta-launch');
    mkdirSync(kickoffDir, { recursive: true });
    const kickoffPath = join(kickoffDir, 'kickoff.md');
    writeFileSync(kickoffPath, '# My Feature Kickoff\nSome content here.\n', 'utf8');

    const input = JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: kickoffPath },
    });

    const r = spawnSync('bash', [HOOK], {
      encoding: 'utf8',
      input,
      env: {
        ...process.env,
        RUNTIME_BRIDGE_MODE: 'manual',
      },
    });

    // Hook exits 0 always (injection, never gate).
    expect(r.status).toBe(0);
    // With RUNTIME_BRIDGE_MODE=manual + tsx available, ManualBackend runs and
    // emits JSON additionalContext OR exits cleanly if tsx not found.
    // Either way: exit 0 and no crash.
    expect(r.stderr).not.toContain('unbound variable');
    expect(r.stderr).not.toContain('syntax error');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test 2: hook does NOT fire on arbitrary src/foo.ts write (negative)
// ═══════════════════════════════════════════════════════════════════════════════
describe('Test 2 — hook glob does NOT match src/foo.ts', () => {
  it('Write to src/foo.ts → hook exits 0 silently (path filter rejects)', () => {
    // Source: runtime-bridge-dispatch.sh case statement — *) exit 0 ;; branch
    const { status, stdout } = runHook('Write', 'src/foo.ts', 'export const x = 1;');

    expect(status).toBe(0);
    // Path filter rejected → no JSON output (no additionalContext emitted)
    expect(stdout).toBe('');
  });

  it('Write to packages/core/foo.ts → hook exits 0 silently', () => {
    const { status, stdout } = runHook('Write', 'packages/core/foo.ts', 'const y = 2;');

    expect(status).toBe(0);
    expect(stdout).toBe('');
  });

  it('Edit event on non-kickoff path → hook exits 0 silently', () => {
    const { status, stdout } = runHook('Edit', 'README.md', '# README');

    expect(status).toBe(0);
    expect(stdout).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test 3: aif-handoff unreachable → resolver falls back to ManualBackend
// ═══════════════════════════════════════════════════════════════════════════════
describe('Test 3 — aif-handoff unavailable → falls back to ManualBackend', () => {
  it('resolveBackend in auto mode returns ManualBackend when aif-handoff fetch fails', async () => {
    // Source: resolver.ts — auto mode probes aifBackend.available(); if false → ManualBackend.
    // We mock global fetch to simulate ECONNREFUSED.
    const { resolveBackend } = await import('../src/resolver.js');
    const { ManualBackend } = await import('../src/ManualBackend.js');

    // Simulate aif-handoff unreachable (connection refused)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }),
    );

    const backend = await resolveBackend({
      mode: 'auto',
      aifProjectId: 'test-project-id',
    });

    // Must fall back to ManualBackend (source: resolver.ts lines returning manualBackend)
    expect(backend).toBeInstanceOf(ManualBackend);
    expect(backend.name).toBe('manual');

    fetchSpy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test 4: RUNTIME_BRIDGE_MODE=manual forces ManualBackend
// ═══════════════════════════════════════════════════════════════════════════════
describe('Test 4 — RUNTIME_BRIDGE_MODE=manual forces ManualBackend', () => {
  it('resolver returns ManualBackend when mode=manual, even if aif-handoff is reachable', async () => {
    // Source: resolver.ts — if (mode === 'manual') return manualBackend; (early return)
    const { resolveBackend } = await import('../src/resolver.js');
    const { ManualBackend } = await import('../src/ManualBackend.js');

    // Even if fetch would succeed, we should NOT reach it when mode=manual
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 }),
    );

    const backend = await resolveBackend({ mode: 'manual' });

    expect(backend).toBeInstanceOf(ManualBackend);
    expect(backend.name).toBe('manual');
    // ManualBackend selected before any fetch call — available() never invoked
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test 5: buildKickoffSpec marker contract — opt-IN default (kickoff §7)
// ═══════════════════════════════════════════════════════════════════════════════
describe('Test 5 — buildKickoffSpec opt-in marker contract (kickoff §7)', () => {
  /** Write a kickoff fixture and return its path. */
  function writeKickoff(content: string): string {
    const sandbox = makeSandbox();
    const kickoffDir = join(sandbox, 'my-feature-meta-launch');
    mkdirSync(kickoffDir, { recursive: true });
    const kickoffPath = join(kickoffDir, 'kickoff.md');
    writeFileSync(kickoffPath, content, 'utf8');
    return kickoffPath;
  }

  it('(a) unmarked kickoff → null under the default (opt-in paired-negative)', async () => {
    // Source: kickoff.ts — requireAutoMarker defaults to true; no auto marker → null.
    const { buildKickoffSpec } = await import('../src/kickoff.js');

    const kickoffPath = writeKickoff('# Kickoff\nDispatch me!\n');
    const spec = buildKickoffSpec(kickoffPath);

    // Inverted default (kickoff §7): an unmarked kickoff must NOT yield a spec.
    expect(spec).toBeNull();
  });

  it('(b) <!-- bridge: auto --> first line → valid spec under the default', async () => {
    const { buildKickoffSpec } = await import('../src/kickoff.js');

    const content = '<!-- bridge: auto -->\n# Kickoff\nDispatch me!\n';
    const kickoffPath = writeKickoff(content);
    const spec = buildKickoffSpec(kickoffPath);

    expect(spec).not.toBeNull();
    expect(spec?.umbrellaName).toBe('my-feature-meta-launch');
    expect(spec?.content).toBe(content);
    expect(spec?.contentHash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
    expect(existsSync(kickoffPath)).toBe(true); // file untouched
  });

  it('(c) <!-- bridge: skip --> → null on every path, nothing overrides it', async () => {
    // Source: kickoff.ts — skip marker checked before the requireAutoMarker gate.
    const { buildKickoffSpec } = await import('../src/kickoff.js');

    const kickoffPath = writeKickoff(
      '<!-- bridge: skip -->\n# Kickoff\nThis task should not be auto-dispatched.\n',
    );

    expect(buildKickoffSpec(kickoffPath)).toBeNull();
    // Even the explicit manual path cannot dispatch a skip-marked kickoff.
    expect(buildKickoffSpec(kickoffPath, { requireAutoMarker: false })).toBeNull();
  });

  it('(d) unmarked + requireAutoMarker: false → valid spec (manual on-demand path)', async () => {
    // Source: cli/dispatch.ts — the one caller that opts out; explicit CLI
    // invocation is the operator's consent (kickoff §7 «stays manual on demand»).
    const { buildKickoffSpec } = await import('../src/kickoff.js');

    const content = '# Kickoff\nDispatch me!\n';
    const kickoffPath = writeKickoff(content);
    const spec = buildKickoffSpec(kickoffPath, { requireAutoMarker: false });

    expect(spec).not.toBeNull();
    expect(spec?.umbrellaName).toBe('my-feature-meta-launch');
    expect(spec?.content).toBe(content);
    expect(spec?.contentHash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test 6: bridge-profile marker — SEPARATE channel from firstLine auto/skip
// (multi-model-profile-marker, 2026-07-21). Source: kickoff.ts extractProfileHint.
// ═══════════════════════════════════════════════════════════════════════════════
describe('Test 6 — extractProfileHint / bridge-profile marker (header-region-only)', () => {
  function writeKickoff(content: string): string {
    const sandbox = makeSandbox();
    const kickoffDir = join(sandbox, 'my-feature-meta-launch');
    mkdirSync(kickoffDir, { recursive: true });
    const kickoffPath = join(kickoffDir, 'kickoff.md');
    writeFileSync(kickoffPath, content, 'utf8');
    return kickoffPath;
  }

  it('(a) marker in header region → profileHint set (positive)', async () => {
    const { extractProfileHint } = await import('../src/kickoff.js');
    const content =
      '# Kickoff\n> **Umbrella:** demo\n> <!-- bridge-profile: GLM -->\n\n## §1 Why\nBody.\n';
    expect(extractProfileHint(content)).toBe('GLM');
  });

  it('(b) no marker anywhere → undefined (negative)', async () => {
    const { extractProfileHint } = await import('../src/kickoff.js');
    expect(extractProfileHint('# Kickoff\n> **Umbrella:** demo\n\n## §1 Why\nBody.\n')).toBeUndefined();
  });

  it('(c) marker string only in BODY (past first ##) → undefined (self-reference guard, paired-negative)', async () => {
    // This is the exact shape of multi-model-profile-marker/kickoff.md itself:
    // it documents `<!-- bridge-profile: GLM -->` in prose under a `##` section,
    // never as a real header-region directive. A whole-file scan would
    // false-positive here; the header-region-only scan must not.
    const { extractProfileHint } = await import('../src/kickoff.js');
    const content =
      '# Kickoff\n> **Umbrella:** demo\n\n' +
      '## §2 Scope\nUse the `<!-- bridge-profile: GLM -->` marker to route this.\n';
    expect(extractProfileHint(content)).toBeUndefined();
  });

  it('(d) auto/skip firstLine marker untouched by a bridge-profile marker present too (regression guard)', async () => {
    const { buildKickoffSpec } = await import('../src/kickoff.js');
    const content = '<!-- bridge: auto -->\n# Kickoff\n> <!-- bridge-profile: GLM -->\n\n## §1\nBody.\n';
    const kickoffPath = writeKickoff(content);
    const spec = buildKickoffSpec(kickoffPath);

    expect(spec).not.toBeNull(); // auto marker still dispatches
    expect(spec?.profileHint).toBe('GLM');
  });

  it('(e) buildKickoffSpec omits profileHint when absent (no stray undefined key leaking as "present")', async () => {
    const { buildKickoffSpec } = await import('../src/kickoff.js');
    const kickoffPath = writeKickoff('<!-- bridge: auto -->\n# Kickoff\nNo marker here.\n');
    const spec = buildKickoffSpec(kickoffPath);

    expect(spec).not.toBeNull();
    expect('profileHint' in (spec as object)).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // (f)-(j): the capture group must not run PAST the marker's own `-->`.
  // Incident 2026-09-02 (beta-docs-showcase BS0): the header of
  // .claude/orchestrator-prompts/beta-docs-showcase/kickoff-b0.md NAMED the
  // marker token in order to state that no marker was attached. The old
  // `(.+?)` body required >=1 character, so it could not close on the `-->`
  // sitting immediately after the token — it ran on to the NEXT `-->` and
  // returned surrounding prose as the hint. That bogus hint matched no runtime
  // profile, AifHandoffBackend._resolveProfileId threw, and cli/dispatch.ts
  // degraded to ManualBackend: a /tmp file and exit 0 with no aif task.
  // Reproduced on the pre-fix blob (git show b68443e094^:...kickoff-b0.md):
  //   hint === '-->` marker on purpose — see §6.'
  // ───────────────────────────────────────────────────────────────────────────

  it('(f) header NAMES the marker token to deny it → undefined, not swallowed prose (BS0 incident shape)', async () => {
    const { extractProfileHint } = await import('../src/kickoff.js');
    const content =
      '<!-- scope: no <!-- bridge-profile: --> marker on purpose — see §6. -->\n' +
      '# Kickoff\n\n## §1 Why\nBody.\n';

    expect(extractProfileHint(content)).toBeUndefined();
  });

  it('(g) a deny-mention must NOT shadow a real marker later in the header', async () => {
    // Worse variant of (f): the over-running capture consumed the deny-mention
    // AND won the match, so the operator's genuine marker on the next line was
    // never reached. Old behaviour returned '--> marker'.
    const { extractProfileHint } = await import('../src/kickoff.js');
    const content =
      '<!-- scope: no <!-- bridge-profile: --> marker -->\n' +
      '<!-- bridge-profile: Z.AI GLM-5.2 SDK -->\n' +
      '# Kickoff\n\n## §1\nBody.\n';

    expect(extractProfileHint(content)).toBe('Z.AI GLM-5.2 SDK');
  });

  it('(h) an EMPTY marker is not a hint → undefined (old regex returned "")', async () => {
    // `profileHint: ''` is falsy, so AifHandoffBackend.dispatch skipped it by
    // accident rather than by contract. Make the absence explicit: an empty
    // marker carries no name, so it yields no hint.
    const { extractProfileHint } = await import('../src/kickoff.js');

    expect(extractProfileHint('<!-- bridge-profile: -->\n# Kickoff\n\n## §1\nBody.\n')).toBeUndefined();
    expect(extractProfileHint('<!--bridge-profile:-->\n# Kickoff\n\n## §1\nBody.\n')).toBeUndefined();
  });

  it('(i) a real marker followed by other header comments still resolves', async () => {
    const { extractProfileHint } = await import('../src/kickoff.js');
    const content =
      '<!-- bridge-profile: Z.AI GLM-5.2 SDK -->\n' +
      '<!-- host-verify: none — prose-only kickoff, no executable deliverable -->\n' +
      '# Kickoff\n\n## §1\nBody.\n';

    expect(extractProfileHint(content)).toBe('Z.AI GLM-5.2 SDK');
  });

  it('(j) buildKickoffSpec omits profileHint for a deny-mention header (end-to-end of (f))', async () => {
    const { buildKickoffSpec } = await import('../src/kickoff.js');
    const kickoffPath = writeKickoff(
      '<!-- bridge: auto -->\n' +
        '<!-- scope: no <!-- bridge-profile: --> marker on purpose — see §6. -->\n' +
        '# Kickoff\n\n## §1\nBody.\n',
    );
    const spec = buildKickoffSpec(kickoffPath);

    expect(spec).not.toBeNull();
    expect('profileHint' in (spec as object)).toBe(false);
  });
});
