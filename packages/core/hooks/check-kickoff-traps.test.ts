/**
 * Functional meta-tests for the PostToolUse kickoff-traps gate
 * (.claude/hooks/check-kickoff-traps.sh) — Wave N8 C2, the edit-time enforcement
 * of ai-laziness-traps.md §3 obligation #2 (≥3 distinct T-numbers enumerated).
 *
 * Channel: kickoffs are authored + dispatched before any pre-push/CI channel
 * sees their content, so principle 12 (CI-skipped) cannot gate them — edit-time PostToolUse is the earliest
 * (and only) channel. This hook adds the COUNT floor principle 12's compound
 * check (presence-of-any-one-pattern) misses.
 *
 * Paired-negative contract:
 *   ❌ kickoff engages the rule + <3 distinct T-numbers → exit 2 (the gap C2 closes)
 *   ✅ kickoff engages the rule + ≥3 distinct T-numbers  → exit 0
 *   ✅ kickoff that never mentions the rule              → exit 0 (engagement guard)
 *   ✅ non-kickoff path / wrong tool                      → exit 0 (off-path skip)
 *
 * Spawns the real hook with fixture stdin (the inject-matching-rule.test.ts
 * precedent). Skips gracefully when `jq` is unavailable (the hook no-ops too).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/check-kickoff-traps.sh');

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const JQ = hasJq();

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0))
    rmSync(d, { recursive: true, force: true });
});

/**
 * Write `body` to a kickoff.md at a repo-relative path under a unique wave dir,
 * so the hook's `.claude/orchestrator-prompts/<wave>/kickoff.md` matcher fires
 * against a REAL on-disk file (PostToolUse reads post-edit content from disk).
 * Returns the absolute path. The wave dir is removed in afterEach.
 */
function writeKickoff(body: string): string {
  const waveDir = mkdtempSync(
    join(REPO_ROOT, '.claude/orchestrator-prompts/c2-test-'),
  );
  tmpDirs.push(waveDir);
  const abs = join(waveDir, 'kickoff.md');
  writeFileSync(abs, body, 'utf8');
  return abs;
}

/** Run the hook with a PostToolUse payload. Returns status + stdout (stdout used by the ZCode
 *  schema arm below). env merged onto process.env; default-scrubs ZCODE_PROJECT_DIR so CC-arms
 *  below stay in the exit-code branch (mirrors deps-hash-check.test.ts:106). */
function runHook(
  tool: string,
  absPath: string,
  env: Record<string, string> = {},
): { status: number; stdout: string } {
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
  });
  // stderr is returned too: on CC the violation text rides on stderr (exit 2), so a test
  // that only checks the exit code cannot tell WHICH arm fired.
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const CITE = 'See .claude/rules/ai-laziness-traps.md §2.';

/**
 * Arm-1 (destination-environment contract) opt-out, appended to the arm-2 fixtures that
 * assert exit 0. The hook accumulates violations across BOTH arms, so an arm-2 fixture
 * must satisfy arm 1 to isolate what it is actually testing. Arm 1 has its own paired
 * tests in the `host-verification contract` describe block below — this constant does not
 * hide it. Rationale is ≥20 chars, as the gate requires.
 */
const HV_OPTOUT =
  '<!-- host-verify: none — fixture exercises the trap-enumeration arm only -->';

describe.skipIf(!JQ)(
  'check-kickoff-traps.sh — PostToolUse kickoff T-enumeration gate',
  () => {
    it('PAIRED-NEGATIVE: engages rule but enumerates <3 distinct T-numbers → exit 2', () => {
      const abs = writeKickoff(
        `# Wave N kickoff\n${CITE}\nActive traps: T1, T3.\n`,
      );
      expect(runHook('Write', abs).status).toBe(2);
    });

    it('blanket reference (cites rule, names ZERO traps) → exit 2', () => {
      const abs = writeKickoff(
        `# Wave N kickoff\n${CITE}\nNo traps enumerated here.\n`,
      );
      expect(runHook('Edit', abs).status).toBe(2);
    });

    it('PAIRED-POSITIVE: engages rule + ≥3 distinct T-numbers → exit 0', () => {
      const abs = writeKickoff(
        `# Wave N kickoff\n${CITE}\nActive traps: T1, T3, T7, T15.\n${HV_OPTOUT}\n`,
      );
      expect(runHook('Write', abs).status).toBe(0);
    });

    it('boundary: exactly 3 distinct T-numbers → exit 0', () => {
      const abs = writeKickoff(
        `# Wave N kickoff\n${CITE}\nActive traps for this R-phase: T1, T4, T10.\n${HV_OPTOUT}\n`,
      );
      expect(runHook('Write', abs).status).toBe(0);
    });

    it('counts DISTINCT, not occurrences: T1 repeated 3× + nothing else → exit 2', () => {
      const abs = writeKickoff(
        `# Wave N kickoff\n${CITE}\nT1 matters. T1 again. T1 once more.\n`,
      );
      expect(runHook('Write', abs).status).toBe(2);
    });

    it('engagement guard: kickoff that never mentions the rule → exit 0 (not C2 territory)', () => {
      const abs = writeKickoff(
        `# Wave N kickoff\n\nA plan with no trap discipline at all.\n${HV_OPTOUT}\n`,
      );
      expect(runHook('Write', abs).status).toBe(0);
    });

    it('domain-label-only (T-Wave9-A) does NOT satisfy the canonical-T floor → exit 2', () => {
      // T-Wave9-A is the §3 #3 domain trap, not a canonical T-number; the \bT[0-9]+\b
      // count must not credit it. Two canonical + one domain label = 2 distinct → fail.
      const abs = writeKickoff(
        `# Wave N kickoff\n${CITE}\nActive traps: T1, T3, plus T-Wave9-A.\n`,
      );
      expect(runHook('Write', abs).status).toBe(2);
    });

    it('off-path: a non-kickoff .md under orchestrator-prompts → exit 0', () => {
      const waveDir = mkdtempSync(
        join(REPO_ROOT, '.claude/orchestrator-prompts/c2-test-'),
      );
      tmpDirs.push(waveDir);
      const abs = join(waveDir, 'notes.md');
      writeFileSync(abs, `${CITE}\nT1 only.\n`, 'utf8');
      expect(runHook('Write', abs).status).toBe(0);
    });

    it('wrong tool (Read) → exit 0 even on a violating kickoff', () => {
      const abs = writeKickoff(`# Wave N kickoff\n${CITE}\nT1 only.\n`);
      expect(runHook('Read', abs).status).toBe(0);
    });

    it('off-path: a file outside orchestrator-prompts → exit 0', () => {
      const dir = mkdtempSync(join(tmpdir(), 'c2-offpath-'));
      tmpDirs.push(dir);
      mkdirSync(join(dir, 'sub'), { recursive: true });
      const abs = join(dir, 'sub', 'kickoff.md');
      writeFileSync(abs, `${CITE}\nT1 only.\n`, 'utf8');
      expect(runHook('Write', abs).status).toBe(0);
    });

    it('ZCODE: violating kickoff under ZCODE_PROJECT_DIR → schema-valid {additionalContext} JSON, exit 0 (advisory, not gate)', () => {
      // ZCode parses hook stdout against the HookJSONOutput schema (CCt at zcode.cjs:~577900),
      // which is `.strict()` — unknown top-level keys are REJECTED (→ hook.run.failed, output
      // discarded). The ZCode branch (_adv_violation at hook line 26) emits schema-valid
      // `{additionalContext}` and exits 0 — PostToolUse cannot block on ZCode (schema Uan rejects
      // permissionDecision for PostToolUse; post-mutation by definition), so the violation surfaces
      // as advisory context. Catches the regression where a prior shape emitted
      // `{hookEventName, additionalContext}` at top level and was silently rejected by ZCode.
      const abs = writeKickoff(
        `# Wave N kickoff\n${CITE}\nActive traps: T1, T3.\n`,
      );
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
      ).toContain('kickoff-traps');
      expect(
        parsed.hookEventName,
        'hookEventName must NOT be at top level (CCt.strict rejects it)',
      ).toBeUndefined();
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Dependency-missing SKIP must reach the model, not just stderr (aif-parity F1,
// criterion (a) — silent `command -v jq || exit 0` guards; sibling of the
// check-doc-authority.sh fix shipped in #1116). Channel semantics live-verified
// 2026-07-24: research-patches/2026-07-24-posttooluse-channel-verification.md.
// ═══════════════════════════════════════════════════════════════════════════════
import { mkdtempSync as _mkdtempSync, symlinkSync as _symlinkSync } from 'node:fs';
import { join as _join } from 'node:path';
import { tmpdir as _tmpdir } from 'node:os';
import { spawnSync as _spawnSync } from 'node:child_process';

describe('dependency-missing skip is announced on the model channel', () => {
  function runNoJq(filePath: string): { status: number; stdout: string; stderr: string } {
    const binDir = _mkdtempSync(_join(_tmpdir(), 'nojq-'));
    // sed/tr/head back the jq-free escaper + crude path parse; masking them too would
    // test the harness, not the hook. dirname backs the REPO_ROOT fallback line.
    for (const tool of ['sed', 'tr', 'cat', 'head', 'dirname', 'grep', 'sort', 'awk', 'stat', 'date', 'touch']) {
      const real = _spawnSync('/usr/bin/which', [tool], { encoding: 'utf8' }).stdout?.trim();
      if (real) _symlinkSync(real, _join(binDir, tool));
    }
    const env: Record<string, string> = { ...process.env, PATH: binDir } as Record<string, string>;
    delete env.ZCODE_PROJECT_DIR;
    const r = _spawnSync('/bin/bash', [HOOK], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: filePath } }),
      encoding: 'utf8',
      env,
    });
    return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  }

  it('jq missing + in-scope path → hookSpecificOutput.additionalContext says DID NOT RUN (exit 0)', () => {
    const { status, stdout } = runNoJq('/x/.claude/orchestrator-prompts/wave-1/kickoff.md');
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout.trim()) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(parsed.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    expect(parsed.hookSpecificOutput.additionalContext).toMatch(/DID NOT RUN/);
    expect(parsed.hookSpecificOutput.additionalContext).toMatch(/not a pass/i);
  });

  it('jq missing + OUT-of-scope path → silent exit 0 (no per-edit spam in a jq-less env)', () => {
    const { status, stdout } = runNoJq('/x/README.md');
    expect(status).toBe(0);
    expect(stdout.trim()).toBe('');
  });
});

/**
 * Arm 1 — destination-environment verification contract.
 * spec: .claude/rules/destination-environment-verification.md §1
 *
 * The gate delegates contract RECOGNITION to scripts/host-verify.sh --list, so the hook and
 * the runner cannot disagree about what counts as a contract. These tests therefore also
 * pin the shared grammar: the marker is matched on the fence INFO-STRING, so neither a
 * prose mention nor an unmarked block opens one.
 */
describe('check-kickoff-traps.sh — destination-environment contract arm', () => {
  it('PAIRED-NEGATIVE: kickoff with no contract and no opt-out → exit 2', () => {
    const abs = writeKickoff('# Wave N kickoff\n\nA plan with no host contract.\n');
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/declares no host-verification contract/);
  });

  it('PAIRED-POSITIVE: a host-verify fenced block → exit 0', () => {
    const abs = writeKickoff(
      '# Wave N kickoff\n\n```bash host-verify\nnpx vitest run packages/core/principles\n```\n',
    );
    expect(runHook('Write', abs).status).toBe(0);
  });

  it('opt-out with a ≥20-char rationale → exit 0', () => {
    const abs = writeKickoff(`# Wave N kickoff\n${HV_OPTOUT}\n`);
    expect(runHook('Write', abs).status).toBe(0);
  });

  it('opt-out with a too-short rationale → exit 2 (no bare escape token)', () => {
    const abs = writeKickoff('# Wave N kickoff\n<!-- host-verify: none — too short -->\n');
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/floor: 20/);
  });

  it('a PROSE mention of host-verify does not satisfy the contract → exit 2', () => {
    const abs = writeKickoff(
      '# Wave N kickoff\n\nThe orchestrator will host-verify this on the host, honest.\n',
    );
    expect(runHook('Write', abs).status).toBe(2);
  });

  it('an UNMARKED fenced block does not satisfy the contract → exit 2', () => {
    const abs = writeKickoff('# Wave N kickoff\n\n```bash\nnpx vitest run foo\n```\n');
    expect(runHook('Write', abs).status).toBe(2);
  });

  it('a marked block containing only comments/blanks is NOT a contract → exit 2', () => {
    // T-BATCH-A shape: an empty contract would make the gate look satisfied while
    // committing the worker to nothing. The runner strips comments and blanks, so an
    // all-comment block resolves to zero commands and must fail exactly like no block.
    const abs = writeKickoff(
      '# Wave N kickoff\n\n```bash host-verify\n# TODO: fill this in later\n\n```\n',
    );
    expect(runHook('Write', abs).status).toBe(2);
  });

  it('BOTH arms violated → both messages are reported in one pass (no round-trip per rule)', () => {
    const abs = writeKickoff(`# Wave N kickoff\n${CITE}\nOnly T1 here.\n`);
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/declares no host-verification contract/);
    expect(r.stderr).toMatch(/floor: 3/);
  });
});
