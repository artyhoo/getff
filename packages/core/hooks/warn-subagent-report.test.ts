/**
 * Functional meta-tests for the SubagentStop REPORT-schema WARN hook
 * (.claude/hooks/warn-subagent-report.sh) — SSOT #108 candidate-3 (WARN variant,
 * non-blocking; maintainer chose WARN over block per 2026-06-01 decision).
 *
 * Asserts the verified SubagentStop contract (dual-channel 2026-06-01,
 * WebFetch code.claude.com/docs/en/hooks + DeepWiki anthropics/claude-code):
 *   - SubagentStop payload includes last_assistant_message (CC ≥2.1.47) and
 *     agent_transcript_path (JSONL file path). Both fields verified by name.
 *   - exit 0 = non-blocking (always; WARN never stalls the subagent).
 *   - Warning is emitted to STDERR when REPORT sections are missing.
 *   - Noise guard: Explore agent_type → silent (read-only type, no REPORT schema).
 *
 * Required REPORT sections checked: VERIFY, Confidence, ATTN (load-bearing three;
 * documented in the hook header and here for co-location of the specification).
 *
 * T-108-A coverage: both positive paths (warn) AND both negative paths (silent)
 * are tested — prevents "warns on everything" or "scans nothing" theatre.
 * M2: positive-A exercises last_assistant_message path.
 * M3: positive-B exercises agent_transcript_path JSONL path with a REAL temp file.
 *
 * Skips gracefully when `jq` is unavailable (the hook itself no-ops without jq).
 */
import { describe, it, expect } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/warn-subagent-report.sh');

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const JQ = hasJq();

/**
 * Run the hook with a SubagentStop stdin payload.
 * Returns { exitCode, stdout, stderr }.
 */
function runHook(payload: Record<string, unknown>): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync('bash', [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
  return {
    exitCode: result.status ?? 0,
    stdout: (result.stdout as string).trim(),
    stderr: (result.stderr as string).trim(),
  };
}

/**
 * Build a SubagentStop payload using last_assistant_message (Path 1).
 */
function payloadWithMessage(agentType: string, message: string): Record<string, unknown> {
  return {
    session_id: 'test-session',
    hook_event_name: 'SubagentStop',
    agent_id: 'subagent-test',
    agent_type: agentType,
    last_assistant_message: message,
  };
}

/**
 * Build a SubagentStop payload using agent_transcript_path (Path 2).
 * Writes a real temp JSONL file (compact JSON, no spaces — matching CC transcript format).
 * Returns payload + cleanup function.
 *
 * M3: This creates a REAL temp file on disk so the hook actually reads it.
 * Without a real file, the transcript path silently no-ops (file not found → exit 0).
 */
function payloadWithTranscript(
  agentType: string,
  assistantText: string
): { payload: Record<string, unknown>; cleanup: () => void } {
  // Compact JSON (separators=(',',':') in Python terms) to match CC's real transcript format.
  // CC transcripts use "type":"assistant" (no spaces), so grep '"type":"assistant"' must match.
  const transcriptLine = JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: assistantText }],
    },
  });
  const tmpPath = resolve(tmpdir(), `warn-subagent-report-test-${randomBytes(6).toString('hex')}.jsonl`);
  writeFileSync(tmpPath, transcriptLine + '\n', 'utf8');

  return {
    payload: {
      session_id: 'test-session',
      hook_event_name: 'SubagentStop',
      agent_id: 'subagent-test',
      agent_type: agentType,
      last_assistant_message: '', // empty → hook falls through to Path 2
      agent_transcript_path: tmpPath,
    },
    cleanup: () => {
      try {
        unlinkSync(tmpPath);
      } catch {
        // best-effort
      }
    },
  };
}

// ── REPORT text fixtures ──────────────────────────────────────────────────

/** A complete REPORT with all required sections (VERIFY + Confidence + ATTN). */
const FULL_REPORT = [
  '## VERIFY',
  'Ran npm test — all 43 tests passed.',
  '',
  'Confidence: 9/10 (full coverage, only manual e2e untested)',
  '',
  'ATTN: The settings.json snippet must be landed by maintainer — not committed.',
  '',
  'Commit: abc123def',
].join('\n');

/** A REPORT missing the ATTN section. */
const REPORT_MISSING_ATTN = [
  '## VERIFY',
  'Ran npm test — all 43 tests passed.',
  '',
  'Confidence: 9/10 (full coverage, only manual e2e untested)',
  '',
  'Commit: abc123def',
].join('\n');

/** A REPORT missing the Confidence section. */
const REPORT_MISSING_CONFIDENCE = [
  '## VERIFY',
  'All checks passed.',
  '',
  'ATTN: Check this thing.',
  '',
  'Commit: def456',
].join('\n');

/** Arbitrary prose that contains the word "confidence" but NOT as a standalone label. */
const NON_REPORT_PROSE = [
  'I found some interesting files in the codebase.',
  'The confidence in my analysis is based on the file structure.',
  'Let me know if you need more details.',
].join('\n');

// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(!JQ)('warn-subagent-report.sh — SubagentStop REPORT-schema WARN (SSOT #108 candidate-3)', () => {
  // ── M2: positive-A — last_assistant_message path ──────────────────────────
  it('positive-A (M2): warns to stderr when REPORT sections are missing via last_assistant_message', () => {
    const result = runHook(payloadWithMessage('general-purpose', REPORT_MISSING_ATTN));

    // T-108-A: MUST warn (not silent)
    expect(result.exitCode).toBe(0); // ALWAYS non-blocking
    expect(result.stderr).toContain('ATTN'); // missing section named
    expect(result.stderr).toMatch(/⚠ SubagentStop: subagent REPORT missing section/);

    // The warning's consumer is the ORCHESTRATOR — stderr on exit 0 reaches only the
    // operator, so the same warning MUST go out as model-visible JSON additionalContext
    // (channel live-verified 2026-07-24 — see
    // research-patches/2026-07-24-posttooluse-channel-verification.md).
    const parsed = JSON.parse(result.stdout.trim()) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(parsed.hookSpecificOutput.hookEventName).toBe('SubagentStop');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('ATTN');

    // VERIFY and Confidence are present in the fixture — must NOT appear in missing list
    expect(result.stderr).not.toContain('VERIFY');
    expect(result.stderr).not.toContain('Confidence');
  });

  // ── M3: positive-B — agent_transcript_path JSONL path ────────────────────
  it('positive-B (M3): warns via agent_transcript_path JSONL when last_assistant_message is empty', () => {
    const { payload, cleanup } = payloadWithTranscript('general-purpose', REPORT_MISSING_CONFIDENCE);
    try {
      const result = runHook(payload);

      // T-108-A: MUST warn (path 2 actually read the file)
      expect(result.exitCode).toBe(0); // ALWAYS non-blocking
      expect(result.stderr).toContain('Confidence'); // missing section named
      expect(result.stderr).toMatch(/⚠ SubagentStop: subagent REPORT missing section/);
      // Model-visible channel carries the same warning (see positive-A rationale).
      expect(JSON.parse(result.stdout.trim()).hookSpecificOutput.additionalContext).toContain(
        'Confidence',
      );

      // VERIFY and ATTN are present in the fixture — must NOT appear in missing list
      expect(result.stderr).not.toContain('VERIFY');
      expect(result.stderr).not.toContain('ATTN');
    } finally {
      cleanup();
    }
  });

  // ── Negative: complete REPORT → silent ───────────────────────────────────
  it('negative: silent when REPORT has all required sections (VERIFY + Confidence + ATTN)', () => {
    const result = runHook(payloadWithMessage('general-purpose', FULL_REPORT));

    // T-108-A: MUST be silent (not warn on everything)
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe(''); // no warning emitted
    expect(result.stdout).toBe(''); // no output
  });

  // ── Negative-2: Explore agent_type → silent (noise guard) ────────────────
  it('negative-2 (noise guard): silent for Explore agent_type even if output looks like a REPORT', () => {
    // Explore is a read-only agent — no REPORT schema expected; hook must skip entirely.
    const result = runHook(payloadWithMessage('Explore', REPORT_MISSING_ATTN));

    // T-108-A: MUST be silent (noise guard holds for Explore)
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe('');
  });

  // ── Additional: non-REPORT prose → silent (noise guard part 2) ───────────
  it('silent for arbitrary prose containing the word "confidence" (noise guard part 2)', () => {
    // The word "confidence" in prose must NOT trigger a warning.
    // Only "Confidence:" at line start (standalone label) should match.
    const result = runHook(payloadWithMessage('general-purpose', NON_REPORT_PROSE));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
  });

  // ── Exit code invariant ───────────────────────────────────────────────────
  it('always exits 0 regardless of missing sections (WARN, never blocking)', () => {
    // Even with all sections missing, exit MUST be 0 (non-blocking per maintainer decision).
    const result = runHook(
      payloadWithMessage('general-purpose', 'VERIFY:\nSomething checked.\n\nCommit: xyz')
    );
    expect(result.exitCode).toBe(0);
  });
});
// ═══════════════════════════════════════════════════════════════════════════════
// Dependency-missing SKIP must reach the orchestrator model (aif-parity F1
// criterion (a)). SubagentStop fires once per finished subagent — a loud notice
// is low-noise, and a silent one makes a skipped completeness check read as a
// pass. Channel verified 2026-07-24 —
// research-patches/2026-07-24-posttooluse-channel-verification.md.
// ═══════════════════════════════════════════════════════════════════════════════
import { mkdtempSync as _mkdtempSync, symlinkSync as _symlinkSync, rmSync as _rmSync } from 'node:fs';
import { join as _join } from 'node:path';
import { tmpdir as _tmpdir } from 'node:os';
import { spawnSync as _spawnSync } from 'node:child_process';

describe('dependency-missing skip is announced on the model channel', () => {
  it('jq missing → SubagentStop JSON additionalContext says DID NOT RUN (exit 0)', () => {
    // T-3 (#1597 ledger): the mkdtemp dir was never removed — `ls -d $TMPDIR/nojq-* | wc -l`
    // reported 226 leaked dirs (5 symlinks each) on the reviewer's machine, one more per
    // vitest run on every developer box and self-hosted runner. `finally` so the cleanup
    // survives a failing assertion, which is exactly when a leak used to be guaranteed.
    const binDir = _mkdtempSync(_join(_tmpdir(), 'nojq-'));
    try {
      for (const tool of ['sed', 'tr', 'cat', 'grep', 'head']) {
        const real = _spawnSync('/usr/bin/which', [tool], { encoding: 'utf8' }).stdout?.trim();
        if (real) _symlinkSync(real, _join(binDir, tool));
      }
      const env: Record<string, string> = { ...process.env, PATH: binDir } as Record<string, string>;
      delete env.ZCODE_PROJECT_DIR;
      const r = _spawnSync('/bin/bash', [HOOK], {
        input: JSON.stringify({ agent_type: 'general-purpose', last_assistant_message: 'VERIFY: x' }),
        encoding: 'utf8',
        env,
      });
      expect(r.status).toBe(0);
      const parsed = JSON.parse((r.stdout ?? '').trim()) as {
        hookSpecificOutput: { hookEventName: string; additionalContext: string };
      };
      expect(parsed.hookSpecificOutput.hookEventName).toBe('SubagentStop');
      expect(parsed.hookSpecificOutput.additionalContext).toMatch(/DID NOT RUN/);
      expect(parsed.hookSpecificOutput.additionalContext).toMatch(/not a pass/i);
    } finally {
      _rmSync(binDir, { recursive: true, force: true });
    }
  });
});
