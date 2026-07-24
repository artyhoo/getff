/**
 * Functional tests for the PostToolUse gate check-worker-dispatch-channel.sh
 * (M6 edit-time channel for #worker-dispatch-via-subagent).
 *
 * Channel: edit-time PostToolUse. Fires on Edit|Write|MultiEdit of a
 * .claude/orchestrator-prompts/<umbrella>/kickoff.md and delegates to the single
 * shared matcher (packages/core/principles/29-worker-dispatch-channel.bin.ts -> .ts).
 * Both this hook and principle 29's CI test call that one matcher — never two
 * divergent copies (anti-pattern #two-prompts-drift).
 *
 * Paired-negative contract:
 *   ❌ kickoff that instructs Agent-tool write-Worker dispatch -> exit 1 (the gap M6 closes)
 *   ✅ kickoff with no such instruction -> exit 0
 *   ✅ non-kickoff path / wrong tool -> exit 0 (off-path skip, hook:51-61)
 *   ✅ per-line escape token <!-- channel-discipline: allow <reason> --> -> exit 0 (exemption)
 *
 * ZCode: PostToolUse cannot block on ZCode (schema Uan rejects permissionDecision; exit 1
 * swallowed). The hook's _emit_ctx (hook:71-75) emits schema-valid {additionalContext} JSON
 * and exits 0 — advisory, the best available mechanism. The dedicated arm below guards the
 * output shape against CCt.strict() (regression: a prior shape emitted
 * {hookEventName, additionalContext} at top level and was silently rejected by ZCode).
 *
 * Sandbox: kickoff files are written under REPO_ROOT/.claude/orchestrator-prompts/<temp>/
 * (mirrors check-kickoff-traps.test.ts) so the hook's REL_PATH computation
 * (ABS_PATH#$REPO_ROOT/, hook:54) resolves to the scoped star-slash-kickoff.md matcher (hook:59).
 *
 * Skips gracefully when jq or tsx are unavailable (the hook itself no-ops without them).
 * Precedent: check-kickoff-traps.test.ts (sandbox pattern), deps-hash-check.test.ts:164
 * (ZCode schema arm).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/check-worker-dispatch-channel.sh');

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether the hook's own tsx resolution will succeed. Post-fix the hook resolves tsx
 * through a 3-tier list (`_resolve_tsx`, mirroring check-doc-authority.sh:48-62): repo-local,
 * main-worktree via `git --git-common-dir`, then `command -v tsx` on PATH. This guard must
 * mirror that tier list or every test under describe.skipIf(!TSX) silently skips when the
 * suite happens to run in a linked worktree (the very defect class this sweep closes — the
 * container itself is one: tsx at /app/node_modules/.bin/tsx, not REPO_ROOT/node_modules/...).
 */
function hasTsxForHook(): boolean {
  // Tier 1: repo-local.
  try {
    execSync(`test -x "${resolve(REPO_ROOT, 'node_modules/.bin/tsx')}"`, { stdio: 'ignore' });
    return true;
  } catch {
    // fall through
  }
  // Tier 2: main worktree via git --git-common-dir.
  try {
    const common = execSync(`git -C "${REPO_ROOT}" rev-parse --git-common-dir`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    if (common) {
      const abs = common.startsWith('/') ? common : resolve(REPO_ROOT, common);
      const mainRoot = abs.split('/').slice(0, -1).join('/');
      execSync(`test -x "${mainRoot}/node_modules/.bin/tsx"`, { stdio: 'ignore' });
      return true;
    }
  } catch {
    // fall through
  }
  // Tier 3: tsx on PATH.
  try {
    execSync('command -v tsx', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const JQ = hasJq();
const TSX = hasTsxForHook();

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/**
 * Write `body` to a kickoff.md at `.claude/orchestrator-prompts/<temp>/kickoff.md` INSIDE
 * REPO_ROOT, so the hook's REL_PATH = ABS_PATH#$REPO_ROOT/ (hook:54) yields the scoped
 * `.claude/orchestrator-prompts/<umbrella>/kickoff.md` matcher (hook:59) against a REAL
 * on-disk file. Returns the absolute path. The temp wave dir is removed in afterEach.
 * (Mirrors check-kickoff-traps.test.ts:53 — writing under REPO_ROOT is load-bearing.)
 */
function writeKickoff(body: string): string {
  const waveDir = mkdtempSync(
    join(REPO_ROOT, '.claude/orchestrator-prompts/wdc-test-'),
  );
  tmpDirs.push(waveDir);
  const abs = join(waveDir, 'kickoff.md');
  writeFileSync(abs, body, 'utf8');
  return abs;
}

/** Run the hook with a PostToolUse payload. Returns status + stdout. env merged onto
 *  process.env; default-scrubs ZCODE_PROJECT_DIR so CC-arms stay in the exit-code branch
 *  (mirrors deps-hash-check.test.ts:106). cwd is forced to REPO_ROOT because the hook delegates
 *  to bin.ts via tsx WITHOUT setting cwd, and bin.ts resolves its argv (a repo-relative path)
 *  against process.cwd() via existsSync(). CC's PostToolUse runs hooks with cwd=project root;
 *  vitest runs from packages/core/, which would break the rel-path lookup. */
function runHook(
  tool: string,
  absPath: string,
  env: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
  const fullEnv = { ...process.env };
  if (env.ZCODE_PROJECT_DIR === undefined) delete fullEnv.ZCODE_PROJECT_DIR;
  else fullEnv.ZCODE_PROJECT_DIR = env.ZCODE_PROJECT_DIR;
  const r = spawnSync('bash', [HOOK], {
    input: JSON.stringify({
      tool_name: tool,
      tool_input: { file_path: absPath },
    }),
    encoding: 'utf8',
    env: fullEnv,
    cwd: REPO_ROOT,
    // Allow up to 15s — bin.ts via tsx cold-start
    timeout: 15_000,
  });
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

// A line that satisfies BOTH clause (a) Agent-tool channel (CHANNEL_RE) AND clause (b)
// write-Worker (WRITE_WORKER_RE), per findViolations @ 29-worker-dispatch-channel.ts:80.
const VIOLATION_LINE =
  'Dispatch the write-task Worker via the Agent tool in isolation: worktree.';

describe.skipIf(!JQ || !TSX)(
  'check-worker-dispatch-channel.sh — PostToolUse worker-dispatch gate',
  () => {
    it('PAIRED-NEGATIVE: kickoff instructs Agent-tool write-Worker dispatch → exit 1', () => {
      const abs = writeKickoff(`# Wave N kickoff\n\n${VIOLATION_LINE}\n`);
      const r = runHook('Write', abs);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('worker-dispatch-channel');
    });

    it('PAIRED-POSITIVE: kickoff with no Agent-tool write-dispatch → exit 0, silent', () => {
      const abs = writeKickoff(
        '# Wave N kickoff\n\nA plan with no worker-dispatch instruction.\n',
      );
      const r = runHook('Write', abs);
      expect(r.status).toBe(0);
    });

    it('exemption: per-line escape token `<!-- channel-discipline: allow -->` → exit 0', () => {
      // ESCAPE_TOKEN_RE @ 29-worker-dispatch-channel.ts:70 — a same-line exemption suppresses
      // the violation. The reason in the token is the documented carve-out for prose that
      // teaches/quotes the anti-pattern.
      const abs = writeKickoff(
        `# Wave N kickoff\n\n${VIOLATION_LINE} <!-- channel-discipline: allow teaches the anti-pattern -->\n`,
      );
      const r = runHook('Write', abs);
      expect(r.status).toBe(0);
    });

    it('read-only Agent context is NOT a violation (READONLY_CONTEXT_RE carve-out)', () => {
      // A read-only reviewer/research Agent dispatch is the LEGITIMATE use (pipeline SKILL §5).
      // findViolations @ :85 short-circuits when READONLY_CONTEXT_RE matches the same line.
      const abs = writeKickoff(
        `# Wave N kickoff\n\nDispatch the read-only reviewer via the Agent tool.\n`,
      );
      const r = runHook('Write', abs);
      expect(r.status).toBe(0);
    });

    it('off-path: a non-kickoff .md under orchestrator-prompts → exit 0', () => {
      // Matcher is `.claude/orchestrator-prompts/*/kickoff.md` (hook:59) — notes.md is out of scope.
      const waveDir = mkdtempSync(
        join(REPO_ROOT, '.claude/orchestrator-prompts/wdc-test-'),
      );
      tmpDirs.push(waveDir);
      const abs = join(waveDir, 'notes.md');
      writeFileSync(abs, `${VIOLATION_LINE}\n`, 'utf8');
      expect(runHook('Write', abs).status).toBe(0);
    });

    it('off-path: kickoff.md outside REPO_ROOT → exit 0 (REL_PATH guard, hook:55)', () => {
      // ABS_PATH#$REPO_ROOT/ leaves the path unchanged when it's not under REPO_ROOT →
      // `[[ "$REL_PATH" = "$ABS_PATH" ]]` → exit 0.
      const dir = mkdtempSync(join(tmpdir(), 'wdc-offpath-'));
      tmpDirs.push(dir);
      mkdirSync(join(dir, '.claude', 'orchestrator-prompts', 'x'), {
        recursive: true,
      });
      const abs = join(dir, '.claude', 'orchestrator-prompts', 'x', 'kickoff.md');
      writeFileSync(abs, `${VIOLATION_LINE}\n`, 'utf8');
      expect(runHook('Write', abs).status).toBe(0);
    });

    it('wrong tool (Read) → exit 0 even on a violating kickoff', () => {
      // case Edit|Write|MultiEdit only (hook:51); a Read tool call must not be gated.
      const abs = writeKickoff(`# Wave N kickoff\n\n${VIOLATION_LINE}\n`);
      expect(runHook('Read', abs).status).toBe(0);
    });

    it('ZCODE: violating kickoff under ZCODE_PROJECT_DIR → schema-valid {additionalContext} JSON, exit 0 (advisory, not gate)', () => {
      // ZCode parses hook stdout against the HookJSONOutput schema (CCt at zcode.cjs:~577900),
      // which is `.strict()` — unknown top-level keys are REJECTED (→ hook.run.failed, output
      // discarded). PostToolUse cannot block on ZCode (schema Uan rejects permissionDecision;
      // exit 1 swallowed as HookRunFailed). The ZCode branch (_emit_ctx at hook:71-75) emits
      // schema-valid `{additionalContext}` and exits 0 — advisory. Regression guard: catches
      // the prior shape that emitted `{hookEventName, additionalContext}` at top level.
      const abs = writeKickoff(`# Wave N kickoff\n\n${VIOLATION_LINE}\n`);
      const r = runHook('Write', abs, { ZCODE_PROJECT_DIR: REPO_ROOT });
      expect(r.status, 'ZCode path exits 0 (advisory, non-blocking)').toBe(0);
      expect(r.stdout.trim(), 'ZCode path emits non-empty JSON').not.toBe('');
      const allowedTopLevel = new Set([
        'additionalContext',
        'additional_context',
        'continue',
        'decision',
        'hookSpecificOutput',
        'reason',
        'stopReason',
        'suppressOutput',
        'systemMessage',
      ]);
      const parsed = JSON.parse(r.stdout);
      const unknownKeys = Object.keys(parsed).filter(
        (k) => !allowedTopLevel.has(k),
      );
      expect(
        unknownKeys,
        `ZCode CCt.strict() rejects unknown top-level keys: ${unknownKeys.join(', ')}`,
      ).toEqual([]);
      expect(
        parsed.additionalContext,
        'violation text rides inside additionalContext',
      ).toContain('worker-dispatch-channel');
      expect(
        parsed.hookEventName,
        'hookEventName must NOT be at top level (CCt.strict rejects it)',
      ).toBeUndefined();
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Tier-based tsx resolution + silence-gone paired-negative (kickoff §3 criteria 1-7;
// plan Phase C Task 4). Two asymmetric defects in one hook:
//   (1) same literal-path tsx resolution defect as validate-prompt.sh (surface 2 of
//       the class) — closed by the tier list.
//   (2) SILENT exit 0 on tsx-miss (the loudness defect unique to this hook) — closed
//       by the new _emit_skip + _json_escape helpers.
// The SILENCE-GONE test (Block 2) is the WHOLE POINT of the PR: this hook is the
// edit-time gate for #worker-dispatch-via-subagent; while inert-and-silent, a kickoff
// author gets neither enforcement nor notice (audit PROBE 3, 2026-07-24).
// ═══════════════════════════════════════════════════════════════════════════════
import {
  copyFileSync as _copyFileSync,
  mkdirSync as _mkdirSync,
  mkdtempSync as _mkdtempSync,
  rmSync as _rmSync,
  symlinkSync as _symlinkSync,
  writeFileSync as _writeFileSync,
} from 'node:fs';
import { execSync as _execSync, spawnSync as _spawnSync } from 'node:child_process';
import { join as _join } from 'node:path';
import { tmpdir as _osTmpdir } from 'node:os';

const tierWorktrees: string[] = [];
afterEach(() => {
  for (const wt of tierWorktrees.splice(0)) {
    try {
      _execSync(`git worktree remove --force "${wt}" 2>&1`, { stdio: 'pipe' });
    } catch {
      _rmSync(wt, { recursive: true, force: true });
    }
  }
});

/** Scrub tsx from PATH so tier 3 deterministically misses (isolates tier-1/tier-2). */
function scrubbedPathBin(): string {
  const binDir = _mkdtempSync(_join(_osTmpdir(), 'wdc-scrubbed-bin-'));
  for (const tool of ['sed', 'tr', 'cat', 'head', 'dirname', 'grep', 'sort', 'awk', 'git', 'jq', 'printf', 'bash', 'sh', 'node']) {
    const real = _spawnSync('/usr/bin/which', [tool], { encoding: 'utf8' }).stdout?.trim();
    if (real) _symlinkSync(real, _join(binDir, tool));
  }
  return binDir;
}

/** Write a violating kickoff.md at <repoRoot>/.claude/orchestrator-prompts/<temp>/kickoff.md. */
function writeKickoffAt(repoRoot: string, body: string): string {
  const parent = _join(repoRoot, '.claude/orchestrator-prompts');
  _mkdirSync(parent, { recursive: true });
  const sub = _mkdtempSync(_join(parent, 'wdc-tier-'));
  _writeFileSync(_join(sub, 'kickoff.md'), body, 'utf8');
  return _join(sub, 'kickoff.md');
}

/** Drop a stub `29-worker-dispatch-channel.bin.ts` so the hook's BIN-existence check passes
 *  in a non-worktree temp dir. The stub writes a BIN_STUB_RAN marker to stderr and exits 1 —
 *  mirroring the real matcher's violation-path behaviour (non-zero exit + diagnostic on stderr).
 *  This lets tier-resolution tests observe which tier was invoked: the hook captures the
 *  subprocess's stderr into BIN_ERR and re-emits it on its own stderr. When no tier resolves,
 *  the hook hits the _emit_skip path BEFORE invoking BIN, so the stub is never run. */
function stubBin(repoRoot: string): void {
  const binDir = _join(repoRoot, 'packages/core/principles');
  _mkdirSync(binDir, { recursive: true });
  _writeFileSync(
    _join(binDir, '29-worker-dispatch-channel.bin.ts'),
    `// stub — exit 1 with diagnostic on stderr (real matcher's violation shape)\nprocess.stderr.write("BIN_STUB_RAN marker\\n");\nprocess.exit(1);\n`,
    'utf8',
  );
}

describe('tier-based tsx resolution (paired-negative for the worktree defect class)', () => {
  it('C1: linked worktree (no local node_modules, main has tsx, PATH scrubbed) → hook runs check', () => {
    const wt = _mkdtempSync(_join(_osTmpdir(), 'wdc-c1-wt-'));
    _rmSync(wt, { recursive: true, force: true });
    _execSync(`git worktree add --detach "${wt}" 2>&1`, { stdio: 'pipe' });
    tierWorktrees.push(wt);
    // Overwrite worktree's checked-out hook with the FIXED working-tree version.
    _copyFileSync(HOOK, _join(wt, '.claude/hooks/check-worker-dispatch-channel.sh'));

    const binDir = scrubbedPathBin();
    const abs = writeKickoffAt(wt, `# C1 kickoff\n\n${VIOLATION_LINE}\n`);
    const env: Record<string, string> = {
      ...process.env,
      CLAUDE_PROJECT_DIR: wt,
      PATH: binDir,
    } as Record<string, string>;
    delete env.ZCODE_PROJECT_DIR;
    const r = _spawnSync('/bin/bash', [_join(wt, '.claude/hooks/check-worker-dispatch-channel.sh')], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: abs } }),
      encoding: 'utf8',
      timeout: 30_000,
      env,
      cwd: wt,
    });
    // POST-FIX: tier 2 resolved tsx → matcher ran. Either status=1 (violation found) OR
    // status=0 + stdout has skip-notice (bin shim absent / other skip). The DEFECT shape
    // (silent exit 0 + empty stdout + status 0) is asserted against.
    const out = (r.stdout ?? '').trim();
    const ranCheck = r.status === 1 || /check-worker-dispatch-channel/i.test(out);
    expect(
      ranCheck,
      `C1 FAIL: expected hook to run, got status=${r.status} stdout="${out.slice(0, 200)}" stderr="${(r.stderr ?? '').slice(0, 200)}"`,
    ).toBe(true);
    expect(out).not.toMatch(/tsx not found/i);
  });

  it('C2: precedence held — repo-local tsx wins (structural)', () => {
    const dir = _mkdtempSync(_join(_osTmpdir(), 'wdc-c2-'));
    const nmBin = _join(dir, 'node_modules', '.bin');
    _mkdirSync(nmBin, { recursive: true });
    const sentinel = _join(nmBin, 'tsx');
    _writeFileSync(sentinel, '#!/bin/sh\necho "TIER1_SENTINEL_INVOKED" >&2\nexit 0\n', 'utf8');
    _execSync(`chmod +x "${sentinel}"`);
    const fakeMain = _mkdtempSync(_join(_osTmpdir(), 'wdc-c2-main-'));
    const fakeMainNm = _join(fakeMain, 'node_modules', '.bin');
    _mkdirSync(fakeMainNm, { recursive: true });
    _writeFileSync(_join(fakeMainNm, 'tsx'), '#!/bin/sh\necho "TIER2_INVOKED_WRONG" >&2\n', 'utf8');
    _execSync(`chmod +x "${fakeMainNm}/tsx"`);
    _writeFileSync(_join(dir, '.git'), `gitdir: ${fakeMain}/.git\n`, 'utf8');
    _mkdirSync(_join(fakeMain, '.git'), { recursive: true });

    const abs = writeKickoffAt(dir, `# C2 kickoff\n\n${VIOLATION_LINE}\n`);
    stubBin(dir);
    const binDir = scrubbedPathBin();
    _writeFileSync(_join(binDir, 'tsx'), '#!/bin/sh\necho "TIER3_INVOKED_WRONG" >&2\n', 'utf8');
    _execSync(`chmod +x "${binDir}/tsx"`);
    _copyFileSync(HOOK, _join(dir, 'check-worker-dispatch-channel.sh'));
    const env: Record<string, string> = {
      ...process.env,
      CLAUDE_PROJECT_DIR: dir,
      PATH: binDir,
    } as Record<string, string>;
    delete env.ZCODE_PROJECT_DIR;
    const r = _spawnSync('/bin/bash', [_join(dir, 'check-worker-dispatch-channel.sh')], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: abs } }),
      encoding: 'utf8',
      timeout: 30_000,
      env,
      cwd: dir,
    });
    expect(
      r.stderr,
      `C2 FAIL: expected TIER1_SENTINEL_INVOKED; got status=${r.status} stderr="${(r.stderr ?? '').slice(0, 300)}"`,
    ).toContain('TIER1_SENTINEL_INVOKED');
    expect(r.stderr).not.toContain('TIER2_INVOKED_WRONG');
    expect(r.stderr).not.toContain('TIER3_INVOKED_WRONG');
  });

  it('C3: non-git REPO_ROOT, tsx on PATH → tier 3 resolves → hook runs check', () => {
    const dir = _mkdtempSync(_join(_osTmpdir(), 'wdc-c3-'));
    const abs = writeKickoffAt(dir, `# C3 kickoff\n\n${VIOLATION_LINE}\n`);
    stubBin(dir);
    const binDir = scrubbedPathBin();
    const realTsx = _spawnSync('/usr/bin/which', ['tsx'], { encoding: 'utf8' }).stdout?.trim();
    if (realTsx) _symlinkSync(realTsx, _join(binDir, 'tsx'));
    _copyFileSync(HOOK, _join(dir, 'check-worker-dispatch-channel.sh'));
    const env: Record<string, string> = {
      ...process.env,
      CLAUDE_PROJECT_DIR: dir,
      PATH: binDir,
    } as Record<string, string>;
    delete env.ZCODE_PROJECT_DIR;
    const r = _spawnSync('/bin/bash', [_join(dir, 'check-worker-dispatch-channel.sh')], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: abs } }),
      encoding: 'utf8',
      timeout: 30_000,
      env,
      cwd: dir,
    });
    const out = (r.stdout ?? '').trim();
    const err = (r.stderr ?? '');
    // Hook ran the check via tier 3: stub emitted BIN_STUB_RAN, hook re-emitted on stderr + exit 1.
    const ranCheck = r.status === 1 && err.includes('BIN_STUB_RAN');
    expect(
      ranCheck,
      `C3 FAIL: expected hook to run via tier 3, got status=${r.status} stdout="${out.slice(0, 200)}" stderr="${err.slice(0, 200)}"`,
    ).toBe(true);
    expect(out).not.toMatch(/tsx not found/i);
  });

  it('C4: non-git REPO_ROOT, no tier resolves → no crash, no git error leaked', () => {
    const dir = _mkdtempSync(_join(_osTmpdir(), 'wdc-c4-'));
    const abs = writeKickoffAt(dir, `# C4 kickoff\n\n${VIOLATION_LINE}\n`);
    const binDir = scrubbedPathBin();
    _copyFileSync(HOOK, _join(dir, 'check-worker-dispatch-channel.sh'));
    const env: Record<string, string> = {
      ...process.env,
      CLAUDE_PROJECT_DIR: dir,
      PATH: binDir,
    } as Record<string, string>;
    delete env.ZCODE_PROJECT_DIR;
    const r = _spawnSync('/bin/bash', [_join(dir, 'check-worker-dispatch-channel.sh')], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: abs } }),
      encoding: 'utf8',
      timeout: 30_000,
      env,
      cwd: dir,
    });
    expect(r.status, `C4: status must be 0 (graceful skip), got ${r.status}`).toBe(0);
    const combined = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    expect(
      combined,
      `C4 FAIL: git error leaked: "${combined.slice(0, 300)}"`,
    ).not.toMatch(/fatal: not a git repository|fatal: this operation must be run in a work tree/i);
  });

  it('C5: no tier resolves → skip notice fires on model channel + exit 0', () => {
    const dir = _mkdtempSync(_join(_osTmpdir(), 'wdc-c5-'));
    const abs = writeKickoffAt(dir, `# C5 kickoff\n\n${VIOLATION_LINE}\n`);
    stubBin(dir);
    const binDir = scrubbedPathBin();
    _copyFileSync(HOOK, _join(dir, 'check-worker-dispatch-channel.sh'));
    const env: Record<string, string> = {
      ...process.env,
      CLAUDE_PROJECT_DIR: dir,
      PATH: binDir,
    } as Record<string, string>;
    delete env.ZCODE_PROJECT_DIR;
    const r = _spawnSync('/bin/bash', [_join(dir, 'check-worker-dispatch-channel.sh')], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: abs } }),
      encoding: 'utf8',
      timeout: 30_000,
      env,
      cwd: dir,
    });
    expect(r.status, `C5: status must be 0, got ${r.status}`).toBe(0);
    expect(r.stdout.trim(), `C5 FAIL: stdout empty (silent skip — the defect). stdout="${r.stdout}"`).not.toBe('');
    const parsed = JSON.parse(r.stdout.trim()) as {
      hookSpecificOutput?: { additionalContext?: string };
    };
    const ctx = parsed.hookSpecificOutput?.additionalContext ?? JSON.stringify(parsed);
    expect(ctx).toMatch(/DID NOT RUN/);
    expect(ctx).toMatch(/not a pass/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAIRED-NEGATIVE: the silence is gone (criterion 6 — the PR's central assertion).
// Pre-fix behaviour: `[[ ! -x "$TSX" ]] && exit 0` → stdout="" stderr="" status=0.
// Container audit PROBE 3 recorded this verbatim on a real kickoff.md edit:
// docs/meta-factory/research-patches/2026-07-24-container-gate-reachability.md:109.
// Post-fix: _emit_skip fires → stdout has hookSpecificOutput JSON; model sees the skip.
// ═══════════════════════════════════════════════════════════════════════════════
describe('PAIRED-NEGATIVE: tsx-missing skip is announced on the model channel (silence is gone)', () => {
  it('pre-fix silent-exit-0 NO LONGER HOLDS — stdout is non-empty + carries the skip notice', () => {
    // Setup mirrors C5: non-git temp dir, no tsx anywhere, scrubbed PATH. Feed a
    // kickoff.md with a VIOLATION_LINE so the path filter passes and the only thing
    // standing between the edit and the matcher is tsx resolution.
    const dir = _mkdtempSync(_join(_osTmpdir(), 'wdc-silent-'));
    const abs = writeKickoffAt(dir, `# silence-test\n\n${VIOLATION_LINE}\n`);
    stubBin(dir);
    const binDir = scrubbedPathBin();
    _copyFileSync(HOOK, _join(dir, 'check-worker-dispatch-channel.sh'));
    const env: Record<string, string> = {
      ...process.env,
      CLAUDE_PROJECT_DIR: dir,
      PATH: binDir,
    } as Record<string, string>;
    delete env.ZCODE_PROJECT_DIR;
    const r = _spawnSync('/bin/bash', [_join(dir, 'check-worker-dispatch-channel.sh')], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: abs } }),
      encoding: 'utf8',
      timeout: 30_000,
      env,
      cwd: dir,
    });
    // THE LOAD-BEARING ASSERTION: the pre-fix behaviour (empty stdout + empty stderr +
    // status 0) NO LONGER HOLDS. This is the whole point of the PR — surface 2 was
    // read as a pass precisely because it produced no output at all.
    expect(r.status, `status must be 0 (still a skip, not a block)`).toBe(0);
    expect(
      r.stdout.trim(),
      `PRE-FIX BEHAVIOUR OBSERVED: empty stdout (silent skip). stdout="${r.stdout}" stderr="${r.stderr}"`,
    ).not.toBe('');
    // Verify the JSON shape reaches the model channel correctly.
    const parsed = JSON.parse(r.stdout.trim()) as {
      hookSpecificOutput?: { hookEventName: string; additionalContext: string };
    };
    expect(parsed.hookSpecificOutput?.hookEventName).toBe('PostToolUse');
    expect(parsed.hookSpecificOutput?.additionalContext).toMatch(/DID NOT RUN/);
    expect(parsed.hookSpecificOutput?.additionalContext).toMatch(/not a pass/i);
    expect(parsed.hookSpecificOutput?.additionalContext).toMatch(/worker-dispatch-channel/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAIRED-POSITIVE: enforcement path byte-identical (criterion 7). The loud-skip
// addition must NOT alter the violation path — when tsx resolves and the matcher
// reports a violation, exit code + stderr are byte-identical to pre-fix behaviour.
// ═══════════════════════════════════════════════════════════════════════════════
describe.skipIf(!JQ || !TSX)(
  'PAIRED-POSITIVE: violation path unchanged by the loud-skip addition',
 () => {
    it('status 1 + stderr contains "worker-dispatch-channel" (same shape as the existing block at :131)', () => {
      const abs = writeKickoff(`# Wave N kickoff\n\n${VIOLATION_LINE}\n`);
      const r = runHook('Write', abs);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('worker-dispatch-channel');
      // The violation path emits NOTHING on stdout (no JSON). The new _emit_skip lives
      // on a separate branch (tsx-miss only). Verify stdout is empty here.
      expect(r.stdout.trim()).toBe('');
    });
  },
);
