/**
 * Functional tests for the PostToolUse hook runtime-bridge-dispatch.sh — the edit-time
 * dispatcher for meta-launch kickoffs (auto-dispatch opt-IN via <!-- bridge: auto -->).
 *
 * Honest scope: this hook is a THIN shell-glue that delegates to
 * packages/runtime-bridge/src/cli/dispatch.ts (which has its own comprehensive test-suite at
 * packages/runtime-bridge/test/*.test.ts covering the JSON output, AIF dispatch, backends,
 * fallbacks). We test the hook's OWN logic — the guard chain BEFORE dispatch.ts is invoked:
 *   - dependency guard (jq + node absent -> exit 0)
 *   - tool filter (Write|Edit|MultiEdit only -> others exit 0)
 *   - empty file_path -> exit 0
 *   - path filter (*-meta-launch/kickoff.md SKIP; star-slash-kickoff.md active; other -> exit 0)
 *   - file-exists guard (Write may fire pre-flush -> exit 0)
 *   - opt-IN gate (first line must be exactly <!-- bridge: auto --> -> else exit 0)
 *   - dispatch.ts absent (consumer opted out) -> exit 0
 *
 * The forward-output path (dispatch.ts emits JSON hookSpecificOutput.additionalContext, hook
 * forwards byte-for-byte) is tested in the STUB-DISPATCH describe below: a stub dispatch.ts
 * emits a known schema-valid payload, the hook forwards it, and we assert the forwarded JSON
 * is unchanged + schema-valid. This pins the hook's own forward contract (the JSON is
 * constructed in a SEPARATE source location — dispatch.ts — so drift there is invisible to the
 * hook's guard-chain tests). The dispatch.ts test-suite covers AIF dispatch LOGIC, not the
 * hook-glue forward; the stub arm closes that gap. This mirrors the principle-test/hook-test
 * split in check-worker-dispatch-channel.test.ts (hook glue) vs 29-worker-dispatch-channel.test.ts
 * (matcher logic).
 *
 * CAVEAT (review-sidecar CONCERN): every it() asserts exit 0, but the hook has 12 distinct
 * exit-0 bail points. Some arms (off-tool, empty-path) would fail observably if their guard
 * were removed (dispatch.ts would crash, surfacing in stderr); others (path-filter, opt-IN)
 * collapse to the same green assertion because a bail and a skip both exit 0. This is a
 * structural limit of testing non-blocking hooks — mitigated where it matters by the
 * stub-dispatch arm, which exercises the END of the hook's path (forwarded output), not its
 * bails. A future RBD_TRACE=$LINENO debug emit on each bail would let tests pin the exit site.
 * Paired-negative contract (the gates the hook adds beyond dispatch.ts):
 *   - off-tool (Read) -> exit 0 even on a bridge:auto kickoff
 *   - empty file_path -> exit 0
 *   - non-kickoff path -> exit 0
 *   - *-meta-launch/kickoff.md -> exit 0 (pipeline-ux P4 skip, hook:67)
 *   - kickoff without <!-- bridge: auto --> first line -> exit 0 (opt-IN default off, hook:80)
 *   - nonexistent kickoff.md path -> exit 0 (file-exists guard, hook:73)
 *
 * Sandbox: kickoff files are written under a temp dir mirroring the .claude/orchestrator-prompts/
 * <umbrella>/ layout so the hook's path filter (hook:66-70) fires against a REAL on-disk file.
 * The hook computes REPO_ROOT from its own location and resolves DISPATCH_TS at
 * $REPO_ROOT/packages/runtime-bridge/src/cli/dispatch.ts (hook:85). To exercise the
 * dispatch.ts-absent branch deterministically we run a COPY of the hook from an isolated temp
 * dir where that path cannot resolve -> hook:87-89 exit 0. Independent of the real repo layout.
 *
 * Skips gracefully when jq or node are unavailable (the hook itself no-ops without them).
 * Precedent: validate-prompt.test.ts (sandbox + tsx-absent via hook-copy pattern).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/runtime-bridge-dispatch.sh');

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
function hasNode(): boolean {
  try {
    execSync('command -v node', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
/** Check that tsx resolves from REPO_ROOT (the hook calls `tsx` from PATH). */
function hasTsx(): boolean {
  try {
    execSync('command -v tsx', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const JQ = hasJq();
const NODE = hasNode();
const TSX = hasTsx();

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/**
 * Write `firstLine + body` to a kickoff.md at <tmp>/.claude/orchestrator-prompts/<umbrella>/
 * kickoff.md so the hook's path filter (hook:66-70) fires against a REAL on-disk file.
 * Pass `metaLaunch=true` to place it at <umbrella>-meta-launch/ instead (the skip branch).
 */
function writeKickoff(
  firstLine: string,
  body = '',
  opts: { metaLaunch?: boolean; umbrella?: string } = {},
): string {
  const umbrella = opts.umbrella ?? 'test-wave';
  const dir = opts.metaLaunch ? `${umbrella}-meta-launch` : umbrella;
  const repo = mkdtempSync(join(tmpdir(), 'rbd-test-'));
  tmpDirs.push(repo);
  const abs = join(repo, '.claude', 'orchestrator-prompts', dir, 'kickoff.md');
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${firstLine}\n${body}`, 'utf8');
  return abs;
}

/** Run the hook with a PostToolUse payload. */
function runHook(
  tool: string,
  absPath: string,
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bash', [HOOK], {
    input: JSON.stringify({
      tool_name: tool,
      tool_input: { file_path: absPath },
    }),
    encoding: 'utf8',
    timeout: 30_000,
  });
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

/**
 * Run a COPY of the hook from an isolated temp dir where DISPATCH_TS cannot resolve
 * (hook:87-89) -> forces the dispatch.ts-absent exit 0. Used to deterministically exercise
 * the opt-IN gate WITHOUT invoking dispatch.ts (which would need a live AIF backend).
 */
function runHookCopy(
  tool: string,
  absPath: string,
): { status: number; stdout: string; stderr: string } {
  const dir = mkdtempSync(join(tmpdir(), 'rbd-copy-'));
  tmpDirs.push(dir);
  const hookCopy = join(dir, 'runtime-bridge-dispatch.sh');
  copyFileSync(HOOK, hookCopy);
  const r = spawnSync('bash', [hookCopy], {
    input: JSON.stringify({
      tool_name: tool,
      tool_input: { file_path: absPath },
    }),
    encoding: 'utf8',
    timeout: 30_000,
  });
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

const BRIDGE_AUTO = '<!-- bridge: auto -->';

describe.skipIf(!JQ || !NODE)(
  'runtime-bridge-dispatch.sh — PostToolUse guard chain (hook glue)',
  () => {
    it('off-tool (Read) -> exit 0 even on a bridge:auto kickoff (tool filter hook:50-53)', () => {
      const abs = writeKickoff(BRIDGE_AUTO, '# body\n');
      const r = runHook('Read', abs);
      expect(r.status).toBe(0);
    });

    it('empty file_path -> exit 0 (hook:55)', () => {
      const r = runHook('Write', '');
      expect(r.status).toBe(0);
    });

    it('non-kickoff path -> exit 0 (path filter hook:69)', () => {
      const repo = mkdtempSync(join(tmpdir(), 'rbd-nonkickoff-'));
      tmpDirs.push(repo);
      const abs = join(repo, 'random.md');
      writeFileSync(abs, `${BRIDGE_AUTO}\n`, 'utf8');
      const r = runHook('Write', abs);
      expect(r.status).toBe(0);
    });

    it('*-meta-launch/kickoff.md -> exit 0 (pipeline-ux P4 skip, hook:67)', () => {
      const abs = writeKickoff(BRIDGE_AUTO, '# body\n', {
        metaLaunch: true,
        umbrella: 'my-wave',
      });
      const r = runHook('Write', abs);
      expect(r.status).toBe(0);
    });

    it('nonexistent kickoff.md path -> exit 0 (file-exists guard hook:73)', () => {
      // Path matches the */kickoff.md glob but no file exists at it (Write pre-flush scenario).
      const r = runHook(
        'Write',
        '/tmp/rbd-nope-' + Date.now() + '/.claude/orchestrator-prompts/x/kickoff.md',
      );
      expect(r.status).toBe(0);
    });

    it('opt-IN gate: kickoff WITHOUT <!-- bridge: auto --> first line -> exit 0 (hook:80, default off)', () => {
      // First line is NOT the bridge marker -> opt-IN gate fails -> exit 0. Manual dispatch
      // path (tsx dispatch.ts <path>) stays available; the hook is the auto-dispatch path only.
      // Use the isolated hook-copy so we never reach dispatch.ts even if a marker slips through.
      const abs = writeKickoff('# Just a regular kickoff', '# body\n');
      const r = runHookCopy('Write', abs);
      expect(r.status).toBe(0);
    });

    it('opt-IN gate: first line NOT matching the marker -> exit 0 (gate rejection, hook:80)', () => {
      // The hook trims the first line then requires EXACT equality with `<!-- bridge: auto -->`
      // (hook:79-80). A first line that does NOT match — even after trim — must bail at the
      // opt-IN gate. We use a marker-shaped but distinct string so the discriminator is the
      // gate, not the dispatch.ts-absent bail (runHookCopy would exit 0 either way — structural
      // limit of testing non-blocking hooks, see file-header CAVEAT). At minimum this arm pins
      // that the hook does not crash on a non-matching first line and stays non-blocking.
      const abs = writeKickoff('<!-- bridge: manual -->', '# body\n');
      const r = runHookCopy('Write', abs);
      expect(r.status).toBe(0);
    });

    it('opt-IN gate: leading/trailing whitespace IS tolerated by sed trim -> NOT a gate rejection', () => {
      // The hook's sed trim (hook:79) strips leading/trailing whitespace BEFORE the exact match,
      // so `  <!-- bridge: auto -->  ` TRIMS to the marker and MATCHES. This arm documents that
      // tolerance: the gate does NOT reject on surrounding whitespace. The hook then proceeds
      // past the gate and reaches the dispatch.ts lookup; in the isolated copy dispatch.ts is
      // absent -> exit 0 via hook:88 (NOT via the gate). This is the OPPOSITE discriminator
      // from the arm above — here the gate passes, there it fails. (review-sidecar finding:
      // the prior version of this test claimed gate rejection for an indented marker, which
      // was factually wrong — the trim makes indented markers match.)
      const abs = writeKickoff('  <!-- bridge: auto -->  ', '# body\n');
      const r = runHookCopy('Write', abs);
      expect(r.status).toBe(0);
    });

    it('bridge:auto kickoff resolves past ALL guards (copy isolates dispatch.ts-absent branch) -> exit 0 via hook:88', () => {
      // Positive control: with a valid bridge:auto first line + matching path + Write tool,
      // the hook passes every guard and reaches the dispatch.ts lookup. In the isolated copy
      // dispatch.ts cannot resolve ($REPO_ROOT/packages/runtime-bridge/... absent) -> hook:88
      // exit 0. This proves the guard chain did NOT bail early (a bail would also exit 0, but
      // combined with the negative arms above it pins the opt-IN gate as the discriminator).
      const abs = writeKickoff(BRIDGE_AUTO, '# body\n');
      const r = runHookCopy('Write', abs);
      expect(r.status).toBe(0);
    });
  },
);

// ── Forwarded-output schema arm (cold backward-sweep GAP-2) ─────────────────────
//
// The hook forwards dispatch.ts stdout VERBATIM (hook:106-108). dispatch.ts constructs the
// JSON in a SEPARATE source location (packages/runtime-bridge/src/cli/dispatch.ts:218-226),
// so a drift there (e.g. adding hookEventName at top level) would NOT be caught by the
// guard-chain tests above — and dispatch.ts's own tests cover AIF dispatch logic, not the
// hook-glue forward contract. To exercise the forward path WITHOUT a live AIF backend, we
// build a temp-repo with: (1) a copy of the hook at <tmp>/.claude/hooks/, (2) a STUB
// dispatch.ts at <tmp>/packages/runtime-bridge/src/cli/dispatch.ts that emits a known
// schema-valid JSON payload. The hook computes REPO_ROOT=<tmp> (hook:84) and finds the stub;
// we then assert the hook forwards the stub's JSON unchanged AND that the JSON is schema-valid.
// This pins the forward contract + guards against the regression shape {hookEventName, ...}.

describe.skipIf(!JQ || !NODE || !TSX)(
  'runtime-bridge-dispatch.sh — forwarded-output schema (stub dispatch.ts)',
  () => {
    /**
     * Build a temp repo with a hook copy + stub dispatch.ts that emits a schema-VALID payload.
     * The hook will find the stub at $REPO_ROOT/packages/runtime-bridge/src/cli/dispatch.ts
     * (hook:85) and forward its stdout. Returns { hookAbs, kickoffAbs, repoRoot }.
     */
    function makeStubRepo(): {
      hookAbs: string;
      kickoffAbs: string;
      repoRoot: string;
    } {
      const repoRoot = mkdtempSync(join(tmpdir(), 'rbd-stub-'));
      tmpDirs.push(repoRoot);
      // Hook at depth-2 (.claude/hooks/) so REPO_ROOT = dirname($0)/../.. = repoRoot.
      mkdirSync(join(repoRoot, '.claude', 'hooks'), { recursive: true });
      mkdirSync(join(repoRoot, '.claude', 'orchestrator-prompts', 'stub-wave'), {
        recursive: true,
      });
      mkdirSync(join(repoRoot, 'packages', 'runtime-bridge', 'src', 'cli'), {
        recursive: true,
      });
      const hookAbs = join(
        repoRoot,
        '.claude',
        'hooks',
        'runtime-bridge-dispatch.sh',
      );
      copyFileSync(HOOK, hookAbs);
      const kickoffAbs = join(
        repoRoot,
        '.claude',
        'orchestrator-prompts',
        'stub-wave',
        'kickoff.md',
      );
      writeFileSync(kickoffAbs, `${BRIDGE_AUTO}\n# body\n`, 'utf8');
      // STUB dispatch.ts — emits the schema-VALID shape dispatch.ts really uses
      // (hookSpecificOutput with hookEventName INSIDE). tsx executes it via shebang.
      writeFileSync(
        join(repoRoot, 'packages', 'runtime-bridge', 'src', 'cli', 'dispatch.ts'),
        `#!/usr/bin/env tsx
// STUB — stands in for the real dispatch.ts to test the hook's forward contract.
// Emits the schema-valid {hookSpecificOutput:{hookEventName:"PostToolUse", additionalContext}}
// shape that the real dispatch.ts produces (packages/runtime-bridge/src/cli/dispatch.ts:218-226).
console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: '[runtime-bridge] stub dispatch ack: ' + process.argv[2],
  },
}));
`,
        'utf8',
      );
      return { hookAbs, kickoffAbs, repoRoot };
    }

    it('hook forwards dispatch.ts stdout UNCHANGED (byte-for-byte, hook:106-108)', () => {
      const { hookAbs, kickoffAbs } = makeStubRepo();
      const r = spawnSync('bash', [hookAbs], {
        input: JSON.stringify({
          tool_name: 'Write',
          tool_input: { file_path: kickoffAbs },
        }),
        encoding: 'utf8',
        timeout: 30_000,
      });
      expect(r.status ?? -1, `stderr: ${r.stderr}`).toBe(0);
      expect(r.stdout.trim(), 'forwarded output must be non-empty').not.toBe('');
      // The stub's argv[2] is the kickoff path — proves the hook invoked dispatch.ts WITH the
      // file path and forwarded its stdout (not a canned/hardcoded output).
      expect(r.stdout).toContain('[runtime-bridge] stub dispatch ack:');
      expect(r.stdout).toContain('kickoff.md');
    });

    it('ZCode schema-compliance: forwarded JSON top-level keys match CCt.strict() (no stray hookEventName)', () => {
      // ZCode parses hook stdout against the HookJSONOutput schema (CCt at zcode.cjs:~577900),
      // which is `.strict()` — unknown top-level keys are REJECTED (→ hook.run.failed, output
      // discarded). The hook forwards dispatch.ts's JSON verbatim; the JSON is constructed in
      // a SEPARATE source location, so drift there is invisible to the hook's own tests. This
      // arm pins the forward contract: the forwarded JSON must keep hookEventName INSIDE
      // hookSpecificOutput (NOT at top level). Regression guard (cold backward-sweep GAP-2).
      // Precedent: inject-matching-rule.test.ts:72 (hookSpecificOutput-wrapper schema arm).
      const { hookAbs, kickoffAbs } = makeStubRepo();
      const r = spawnSync('bash', [hookAbs], {
        input: JSON.stringify({
          tool_name: 'Write',
          tool_input: { file_path: kickoffAbs },
        }),
        encoding: 'utf8',
        timeout: 30_000,
      });
      expect(r.stdout.trim(), 'must forward JSON to exercise the schema').not.toBe(
        '',
      );
      const json = JSON.parse(r.stdout);
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
      const unknownKeys = Object.keys(json).filter(
        (k) => !allowedTopLevel.has(k),
      );
      expect(
        unknownKeys,
        `ZCode CCt.strict() rejects unknown top-level keys: ${unknownKeys.join(', ')}`,
      ).toEqual([]);
      expect(
        json.hookEventName,
        'hookEventName must NOT be at top level — only inside hookSpecificOutput',
      ).toBeUndefined();
      expect(json.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    });
  },
);
