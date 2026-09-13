/**
 * Functional tests for .claude/hooks/inject-handoff-on-compact.sh — the D20 injection pipe
 * of the handoff-currency gate (spec:
 * docs/superpowers/specs/2026-09-08-handoff-currency-gate-design.md §Testing seams).
 *
 * Sibling pattern: precompact-residue.test.ts — spawnSync(bash, [HOOK], {input: JSON}), no
 * new framework, graceful skip without jq. No SessionStart-`source` fixture existed to copy
 * (parent M1) — this file is the first.
 *
 * The contract is the MIRROR of the Stop hook's: the gate makes the model MAINTAIN a
 * handoff through the band; this hook is what re-delivers it into the fresh window a
 * compaction opens. NON-BLOCKING BY SHAPE: SessionStart additionalContext only; every
 * failure mode (no jq, non-compact source, no session, missing file, malformed stdin) is a
 * silent exit 0 — a session start must never break because the injector had nothing to say.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/inject-handoff-on-compact.sh');

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const JQ = hasJq();

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function sandbox(): { dir: string; residueDir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'hcg-inject-'));
  dirs.push(dir);
  const residueDir = join(dir, 'residue');
  mkdirSync(residueDir, { recursive: true });
  return { dir, residueDir };
}

const HANDOFF = [
  '# handoff',
  '',
  '## Decisions and why',
  '- d',
  '',
  '## Rejected alternatives',
  '- r',
  '',
  '## Unverified assumptions and open forks',
  '- u',
  '',
  '## Skills to invoke by name',
  '- s',
  '',
  '## Next action',
  '- n',
].join('\n');

// per-case TMPDIR (the injector itself does not read it, but keep cases hermetic)
let dir_ = tmpdir();

function run(
  residueDir: string,
  payload: Record<string, unknown>,
  env: Record<string, string> = {},
  rawInput?: string,
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bash', [HOOK], {
    input: rawInput ?? JSON.stringify(payload),
    encoding: 'utf8',
    env: {
      ...process.env,
      AIF_RESIDUE_DIR: residueDir,
      CLAUDE_PROJECT_DIR: REPO_ROOT,
      TMPDIR: dir_,
      ...env,
    },
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe.skipIf(!JQ)('inject-handoff-on-compact.sh (D20)', () => {
  it('source=compact + a handoff file → SessionStart JSON whose additionalContext carries the file', () => {
    const { dir, residueDir } = sandbox();
    dir_ = dir;
    writeFileSync(join(residueDir, '_handoff-inj1.md'), HANDOFF + '\n', 'utf8');
    const r = run(residueDir, { source: 'compact', session_id: 'inj1' });
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(parsed.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('## Next action');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('- n');
  });

  it('the residue pointer rides along when the writer also produced an excerpt', () => {
    const { dir, residueDir } = sandbox();
    dir_ = dir;
    writeFileSync(join(residueDir, '_handoff-inj2.md'), HANDOFF + '\n', 'utf8');
    writeFileSync(join(residueDir, '_residue-inj2.md'), '# machine excerpt\n', 'utf8');
    const r = run(residueDir, { source: 'compact', session_id: 'inj2' });
    const parsed = JSON.parse(r.stdout) as {
      hookSpecificOutput: { additionalContext: string };
    };
    expect(parsed.hookSpecificOutput.additionalContext).toContain('_residue-inj2.md');
  });

  it('PAIRED-NEGATIVE: source=startup/resume/clear/fork → silent exit 0 (D20)', () => {
    const { dir, residueDir } = sandbox();
    dir_ = dir;
    writeFileSync(join(residueDir, '_handoff-inj3.md'), HANDOFF + '\n', 'utf8');
    for (const source of ['startup', 'resume', 'clear', 'fork']) {
      const r = run(residueDir, { source, session_id: 'inj3' });
      expect(r.status).toBe(0);
      expect(r.stdout, `source=${source} must be silent`).toBe('');
    }
  });

  it('missing handoff file → empty, exit 0', () => {
    const { dir, residueDir } = sandbox();
    dir_ = dir;
    const r = run(residueDir, { source: 'compact', session_id: 'inj4' });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('malformed stdin → exit 0, silent', () => {
    const { dir, residueDir } = sandbox();
    dir_ = dir;
    writeFileSync(join(residueDir, '_handoff-inj5.md'), HANDOFF + '\n', 'utf8');
    const r = run(residueDir, {}, {}, '{not json');
    expect(r.status, 'malformed stdin must not error').toBe(0);
    expect(r.stdout).toBe('');
  });

  it('the session key is sanitised the same way as the writer and the gate', () => {
    // A session id carrying a path separator must resolve to the SAME sanitised filename
    // the writer's pointer line names — a second derivation here silently unlinks the pipe.
    const { dir, residueDir } = sandbox();
    dir_ = dir;
    writeFileSync(join(residueDir, '_handoff-in_6s_esh.md'), HANDOFF + '\n', 'utf8');
    const r = run(residueDir, { source: 'compact', session_id: 'in/6s:esh' });
    expect(r.status).toBe(0);
    expect(r.stdout, 'the sanitised key found the file').toContain('## Next action');
  });

  it('D32: a handoff over the cap is injected CAPPED (head -n AIF_HANDOFF_MAX_LINES)', () => {
    const { dir, residueDir } = sandbox();
    dir_ = dir;
    writeFileSync(
      join(residueDir, '_handoff-injcap.md'),
      Array.from({ length: 300 }, (_, i) => `line ${i}`).join('\n') + '\n',
      'utf8',
    );
    const r = run(residueDir, { source: 'compact', session_id: 'injcap' });
    const parsed = JSON.parse(r.stdout) as {
      hookSpecificOutput: { additionalContext: string };
    };
    const lines = parsed.hookSpecificOutput.additionalContext.split('\n');
    // 1 preamble line + 200 capped body lines (no residue file → no pointer line).
    expect(lines.length).toBe(201);
    expect(parsed.hookSpecificOutput.additionalContext).toContain('line 199');
    expect(parsed.hookSpecificOutput.additionalContext).not.toContain('line 200');
  });
});
