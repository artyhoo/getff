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
 * Check whether the hook's own tsx resolution will succeed. The hook computes REPO_ROOT as
 * `cd "$(dirname "$0")/../.."` (hook:41) → .claude/hooks/../.. = repo root. tsx must be at
 * $REPO_ROOT/node_modules/.bin/tsx (hook:43). Mirrors validate-prompt.test.ts:74.
 */
function hasTsxForHook(): boolean {
  const tsxPath = resolve(REPO_ROOT, 'node_modules/.bin/tsx');
  try {
    execSync(`test -x "${tsxPath}"`, { stdio: 'ignore' });
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
