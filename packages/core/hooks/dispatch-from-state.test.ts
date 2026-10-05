/**
 * Functional meta-tests for the meta-orchestrator dispatch-context emitter
 * (.claude/skills/pipeline/helpers/dispatch-from-state.sh) — paired-negative
 * contract for F.3 helper-collapse (meta-orch-f3-iphase umbrella, 2026-05-28).
 *
 * Channel: in-session helper invoked via Bash tool from SKILL.md §3 (Launch-table).
 * Class C → Class A-via-companion-test (this file is the companion test).
 *
 * Paired-negative contract:
 *
 *   ✅ NO-ARG: empty umbrella arg → emits state section + "no umbrella arg" line, exit 0
 *   ✅ FRESH-STATE: state file missing → emits "(no dispatch state — fresh session)", exit 0
 *   ✅ STATE-PRESENT: valid state JSON → emits winner_id + sub_wave_state from file
 *   ✅ KICKOFF-FOUND: umbrella with existing kickoff → emits "kickoff: <path> (N lines)" + head body
 *   ❌ MISSING-KICKOFF: umbrella with no kickoff dir → emits "MISSING kickoff: <path>" line, exit 0
 *   ❌ CORRUPT-STATE: state file is invalid JSON → stderr warning, exit 0 (kickoff is SSOT)
 *
 * Spawns the real helper with on-disk fixture files in mkdtempSync sandboxes.
 * Uses MO_STATE_FILE / MO_KICKOFF_DIR / REPO_ROOT seams to keep tests hermetic —
 * no dependence on live repo state.
 *
 * Reference pattern: packages/core/hooks/update-delta.test.ts
 * (vitest + spawnSync + mkdtempSync; helper-only, jq required for JSON operations).
 *
 * T3 compliance: each assertion cites the helper source line/region it targets.
 * T-M4-B compliance: asserts both exit code AND stdout/stderr content marker.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(
  REPO_ROOT,
  '.agents/procedures/pipeline/helpers/dispatch-from-state.sh',
);

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeSandbox(): { sandbox: string; stateFile: string; kickoffDir: string } {
  const sandbox = mkdtempSync(join(tmpdir(), 'dispatch-from-state-test-'));
  sandboxes.push(sandbox);
  const stateFile = join(sandbox, '_meta-orch-state.json');
  const kickoffDir = join(sandbox, 'orchestrator-prompts');
  mkdirSync(kickoffDir, { recursive: true });
  return { sandbox, stateFile, kickoffDir };
}

function runHelper(
  umbrella: string,
  envOverrides: Record<string, string>,
): { status: number; stdout: string; stderr: string } {
  const args = umbrella === '' ? [HELPER] : [HELPER, umbrella];
  const r = spawnSync('bash', args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      ...envOverrides,
    },
  });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

function writeKickoff(kickoffDir: string, umbrella: string, body: string): string {
  const dir = join(kickoffDir, umbrella);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'kickoff.md');
  writeFileSync(path, body, 'utf8');
  return path;
}

describe('dispatch-from-state.sh — §3 dispatch-context emitter (paired-negative contract)', () => {
  it('NO-ARG: empty umbrella → emits state header + "no umbrella arg" line, exit 0', () => {
    // Targets emit_kickoff_section no-arg branch (dispatch-from-state.sh §emit_kickoff_section:
    // `if [[ -z "${UMBRELLA}" ]]; then echo "(no umbrella arg ...)"`).
    const { stateFile, kickoffDir } = makeSandbox();

    const r = runHelper('', {
      MO_STATE_FILE: stateFile,
      MO_KICKOFF_DIR: kickoffDir,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('=== dispatch state ===');
    expect(r.stdout).toContain('=== kickoff body ===');
    expect(r.stdout).toContain('no umbrella arg');
  });

  it('FRESH-STATE: state file missing → emits "(no dispatch state — fresh session)", exit 0', () => {
    // Targets emit_state_section fresh-state branch (dispatch-from-state.sh §emit_state_section:
    // `if [[ ! -f "${STATE_FILE}" ]]; then echo "(no dispatch state — fresh session ...)"`).
    const { stateFile, kickoffDir } = makeSandbox();

    const r = runHelper('some-umbrella', {
      MO_STATE_FILE: stateFile,
      MO_KICKOFF_DIR: kickoffDir,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/no dispatch state.*fresh session/);
  });

  it('STATE-PRESENT: valid state JSON → emits winner_id + sub_wave_state from file', () => {
    // Targets emit_state_section jq-extraction branch (dispatch-from-state.sh §emit_state_section:
    // `winner=$(jq -r '.winner_id // "(unset)"' "${STATE_FILE}")`).
    const { stateFile, kickoffDir } = makeSandbox();
    writeFileSync(
      stateFile,
      JSON.stringify({ winner_id: 'wave-9.1', sub_wave_state: 'A:GO,B:REVISE' }),
      'utf8',
    );

    const r = runHelper('any-umbrella', {
      MO_STATE_FILE: stateFile,
      MO_KICKOFF_DIR: kickoffDir,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/winner_id:\s*wave-9\.1/);
    expect(r.stdout).toMatch(/sub_wave_state:\s*A:GO,B:REVISE/);
  });

  it('KICKOFF-FOUND: umbrella with existing kickoff → emits header with line count + body content', () => {
    // Targets emit_kickoff_section kickoff-present branch (dispatch-from-state.sh §emit_kickoff_section:
    // `echo "kickoff: ${kickoff} ($(wc -l < ...) lines)"` + `head -120 "${kickoff}"`).
    const { stateFile, kickoffDir } = makeSandbox();
    const body = ['# Umbrella foo', 'Body line A', 'Body line B'].join('\n');
    writeKickoff(kickoffDir, 'foo', body);

    const r = runHelper('foo', {
      MO_STATE_FILE: stateFile,
      MO_KICKOFF_DIR: kickoffDir,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/kickoff:.*\/foo\/kickoff\.md.*lines/);
    expect(r.stdout).toContain('# Umbrella foo');
    expect(r.stdout).toContain('Body line A');
    expect(r.stdout).toContain('Body line B');
  });

  it('MISSING-KICKOFF: umbrella with no kickoff dir → emits "MISSING kickoff: <path>"', () => {
    // Targets emit_kickoff_section missing-kickoff branch (dispatch-from-state.sh §emit_kickoff_section:
    // `if [[ ! -f "${kickoff}" ]]; then echo "MISSING kickoff: ..."`).
    const { stateFile, kickoffDir } = makeSandbox();

    const r = runHelper('nonexistent-umbrella', {
      MO_STATE_FILE: stateFile,
      MO_KICKOFF_DIR: kickoffDir,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/MISSING kickoff:.*nonexistent-umbrella/);
  });

  it('CORRUPT-STATE: state file is invalid JSON → stderr warning, exit 0, kickoff section continues', () => {
    // Targets emit_state_section corrupt-state branch (dispatch-from-state.sh §emit_state_section:
    // `if ! jq empty "${STATE_FILE}" 2>/dev/null; then echo "(state file corrupt ...)" >&2`).
    const { stateFile, kickoffDir } = makeSandbox();
    writeFileSync(stateFile, '{ this is not json }', 'utf8');
    writeKickoff(kickoffDir, 'bar', '# Bar umbrella body');

    const r = runHelper('bar', {
      MO_STATE_FILE: stateFile,
      MO_KICKOFF_DIR: kickoffDir,
    });
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/state file corrupt/);
    // Kickoff section still runs as SSOT fallback.
    expect(r.stdout).toContain('# Bar umbrella body');
  });
});
