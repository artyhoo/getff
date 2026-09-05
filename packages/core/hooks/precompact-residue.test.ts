/**
 * Functional tests for the PreCompact hook .claude/hooks/precompact-residue.sh — S2b of the
 * pipeline-chips contour (spec: docs/superpowers/specs/2026-08-09-pipeline-chips-session-bus-design.md
 * §D8). Sibling pattern: end-of-turn-reminder.test.ts (S2a) — spawnSync(bash, [HOOK], {input: JSON})
 * against an on-disk JSONL transcript, no bats dep, graceful skip without jq.
 *
 * WHAT THE CONTRACT IS (and why the assertions are shaped this way):
 *   • The hook WRITES a file. The Stop-hook sibling asserts a JSON payload on stdout; here the
 *     deliverable is on DISK, and stdout must stay EMPTY — a PreCompact hook that emits a
 *     decision could block compaction (docs: exit 2 blocks it), which D8 forbids. So every case
 *     asserts BOTH the file content and `status === 0` with empty stdout.
 *   • Paired-negative shape: the "skip" direction of this hook is not "stay silent" but "write
 *     anyway" — a session that compacted with no transcript still leaves the fact behind. The
 *     negative cases here are therefore the ones where a naive implementation writes the WRONG
 *     thing (a sidechain recap, an escaped path) or writes nothing (no transcript, unwritable dir).
 *
 * AIF_HOOK_LANG IS PINNED IN EVERY CASE. The recap marker is lang-pack-sourced (category-3
 * match-data, .claude/rules/language-discipline.md §1), so an unpinned test inherits the
 * operator's env and silently changes which marker it is looking for — measured live during the
 * S2b bench: the same fixture scored `body source: recap` under `en` and `excerpt` under `ru`.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  chmodSync,
  existsSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/precompact-residue.sh');

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const JQ = hasJq();

/** The en pack's recap heading — the value the hook sources from lang/en.sh. */
const RECAP_EN = '## 🟢 In plain words';
/** The ru pack's heading, for the language-sensitivity case. */
const RECAP_RU = '## 🟢 Простыми словами';

/**
 * chmod u+rwx every directory in the tree so the removal below can descend into it. The
 * read-only-residue-dir case locks one directory at 0555, which is why cleanup used to be
 * skipped altogether; restoring the bit first is all that case needs.
 */
function makeTreeRemovable(dir: string): void {
  chmodSync(dir, 0o700);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // isDirectory() is false for symlinks, so this never follows one out of the sandbox.
    if (entry.isDirectory()) makeTreeRemovable(join(dir, entry.name));
  }
}

const dirs: string[] = [];
afterEach(() => {
  // Every case in this file mkdtemp's its own sandbox (~18 per run). Emptying the list without
  // removing the directories leaked all of them into $TMPDIR on every local run, pre-push and CI
  // job — 288 s2b-precompact-* dirs had accumulated on the dev box that caught this, one of them
  // read-only and so resistant to a naive `rm -rf` sweep. tmpdir is not reliably reaped on macOS
  // or on persistent runners, so the suite cleans up after itself.
  for (const dir of dirs.splice(0)) {
    try {
      makeTreeRemovable(dir);
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Best-effort teardown: a tmpdir that resists removal must never turn a green run red.
    }
  }
});

function sandbox(): { dir: string; residueDir: string } {
  const dir = mkdtempSync(join(tmpdir(), 's2b-precompact-'));
  dirs.push(dir);
  const residueDir = join(dir, 'residue');
  mkdirSync(residueDir, { recursive: true });
  return { dir, residueDir };
}

function writeTranscript(dir: string, lines: Record<string, unknown>[]): string {
  const p = join(dir, 'transcript.jsonl');
  writeFileSync(p, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
  return p;
}

/** CC transcript shape: outer `type` field per entry. */
const ccAssistant = (text: string, extra: Record<string, unknown> = {}) => ({
  type: 'assistant',
  ...extra,
  message: { content: [{ type: 'text', text }] },
});
/** ZCode synthetic-transcript shape: no outer `type`, only `message.role`. */
const zcodeAssistant = (text: string) => ({
  message: { role: 'assistant', content: [{ type: 'text', text }] },
});
const userTurn = (text: string) => ({
  type: 'user',
  message: { content: [{ type: 'text', text }] },
});

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
  residue: string | null;
  files: string[];
}

function run(
  residueDir: string,
  payload: Record<string, unknown>,
  lang = 'en',
): RunResult {
  const r = spawnSync('bash', [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: {
      ...process.env,
      AIF_HOOK_LANG: lang,
      AIF_RESIDUE_DIR: residueDir,
      CLAUDE_PROJECT_DIR: REPO_ROOT,
    },
  });
  const files = existsSync(residueDir) ? readdirSync(residueDir) : [];
  const expected = files.find((f) => f.startsWith('_residue-'));
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    residue: expected ? readFileSync(join(residueDir, expected), 'utf8') : null,
    files,
  };
}

describe.skipIf(!JQ)('precompact-residue.sh (S2b / D8)', () => {
  it('writes _residue-<session>.md into the residue dir on a manual trigger', () => {
    const { dir, residueDir } = sandbox();
    const transcript = writeTranscript(dir, [
      { type: 'ai-title', aiTitle: 'S2b bench session' },
      userTurn('build the residue writer'),
      ccAssistant('done for now'),
    ]);
    const r = run(residueDir, {
      session_id: 'sess-1',
      transcript_path: transcript,
      hook_event_name: 'PreCompact',
      trigger: 'manual',
    });
    expect(r.status).toBe(0);
    expect(r.files).toContain('_residue-sess-1.md');
    expect(r.residue).toContain('# Session residue — S2b bench session');
  });

  it('emits NOTHING on stdout — a PreCompact decision could block compaction (D8 forbids it)', () => {
    const { dir, residueDir } = sandbox();
    const transcript = writeTranscript(dir, [ccAssistant('some text')]);
    const r = run(residueDir, {
      session_id: 'sess-quiet',
      transcript_path: transcript,
      trigger: 'auto',
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('header carries session id, trigger, branch and a UTC ISO-8601 timestamp', () => {
    const { dir, residueDir } = sandbox();
    const transcript = writeTranscript(dir, [ccAssistant('x')]);
    const r = run(residueDir, {
      session_id: 'sess-hdr',
      transcript_path: transcript,
      trigger: 'manual',
    });
    expect(r.residue).toContain('- **Session:** `sess-hdr`');
    expect(r.residue).toContain('trigger=`manual`');
    expect(r.residue).toMatch(/- \*\*Written:\*\* \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z /);
    expect(r.residue).toMatch(/- \*\*Branch:\*\* `[^`]+` @ `[^`]+`/);
  });

  it('captures the LAST recap block and labels the body source `recap`', () => {
    const { dir, residueDir } = sandbox();
    const transcript = writeTranscript(dir, [
      ccAssistant(`${RECAP_EN}\nFIRST recap — superseded.`),
      ccAssistant('an intermediate turn'),
      ccAssistant(`${RECAP_EN}\nSECOND recap — the live one.`),
    ]);
    const r = run(residueDir, {
      session_id: 'sess-recap',
      transcript_path: transcript,
      trigger: 'manual',
    });
    expect(r.residue).toContain('- **Body source:** recap');
    expect(r.residue).toContain('SECOND recap — the live one.');
    expect(r.residue).not.toContain('FIRST recap — superseded.');
  });

  it('keeps the turns that FOLLOW the last recap (the work the recap does not yet cover)', () => {
    const { dir, residueDir } = sandbox();
    const transcript = writeTranscript(dir, [
      ccAssistant(`${RECAP_EN}\nrecapped up to here.`),
      ccAssistant('and then I also landed the renderer note'),
    ]);
    const r = run(residueDir, {
      session_id: 'sess-tail',
      transcript_path: transcript,
      trigger: 'manual',
    });
    expect(r.residue).toContain('recapped up to here.');
    expect(r.residue).toContain('and then I also landed the renderer note');
  });

  it('NEVER captures a sidechain (subagent) recap — the isSidechain filter is load-bearing', () => {
    const { dir, residueDir } = sandbox();
    const transcript = writeTranscript(dir, [
      ccAssistant('main thread, no marker here'),
      ccAssistant(`${RECAP_EN}\nSUBAGENT recap — must never be the residue.`, {
        isSidechain: true,
      }),
    ]);
    const r = run(residueDir, {
      session_id: 'sess-side',
      transcript_path: transcript,
      trigger: 'manual',
    });
    expect(r.residue).not.toContain('SUBAGENT recap');
    // The main thread had no marker → the fallback excerpt path, not a sidechain recap.
    expect(r.residue).toContain('- **Body source:** excerpt');
    expect(r.residue).toContain('main thread, no marker here');
  });

  it('falls back to the last assistant excerpt when no recap marker exists', () => {
    const { dir, residueDir } = sandbox();
    const transcript = writeTranscript(dir, [
      ccAssistant('early turn'),
      ccAssistant('the final assistant turn'),
    ]);
    const r = run(residueDir, {
      session_id: 'sess-fallback',
      transcript_path: transcript,
      trigger: 'auto',
    });
    expect(r.residue).toContain('- **Body source:** excerpt');
    expect(r.residue).toContain('the final assistant turn');
  });

  it('writes a residue even with NO transcript — anchor+timestamp+branch are unconditional (D8)', () => {
    const { residueDir } = sandbox();
    const r = run(residueDir, { session_id: 'sess-notrans', trigger: 'auto' });
    expect(r.status).toBe(0);
    expect(r.files).toContain('_residue-sess-notrans.md');
    expect(r.residue).toContain('- **Body source:** none');
    expect(r.residue).toContain('- **Transcript:** `(absent)`');
    expect(r.residue).toMatch(/- \*\*Branch:\*\*/);
  });

  it('anchors on the ai-title when present, else the first user turn', () => {
    const a = sandbox();
    const withTitle = writeTranscript(a.dir, [
      { type: 'ai-title', aiTitle: 'the titled session' },
      userTurn('the first instruction'),
      ccAssistant('x'),
    ]);
    const r1 = run(a.residueDir, {
      session_id: 'sess-title',
      transcript_path: withTitle,
      trigger: 'manual',
    });
    expect(r1.residue).toContain('# Session residue — the titled session');

    const b = sandbox();
    const noTitle = writeTranscript(b.dir, [
      userTurn('the first instruction'),
      ccAssistant('x'),
    ]);
    const r2 = run(b.residueDir, {
      session_id: 'sess-notitle',
      transcript_path: noTitle,
      trigger: 'manual',
    });
    expect(r2.residue).toContain('# Session residue — the first instruction');
  });

  it('sanitises the session id — a `../` id cannot escape the residue dir', () => {
    const { residueDir } = sandbox();
    const r = run(residueDir, { session_id: '../../escaped', trigger: 'auto' });
    expect(r.status).toBe(0);
    expect(r.files).toEqual(['_residue-.._.._escaped.md']);
    expect(existsSync(join(residueDir, '../../escaped'))).toBe(false);
  });

  it('a missing `trigger` field degrades to `unknown` and still writes', () => {
    const { residueDir } = sandbox();
    const r = run(residueDir, { session_id: 'sess-notrigger' });
    expect(r.status).toBe(0);
    expect(r.residue).toContain('trigger=`unknown`');
  });

  it('treats auto and manual identically — the writer is matcher-independent', () => {
    const a = sandbox();
    const b = sandbox();
    const t1 = writeTranscript(a.dir, [ccAssistant(`${RECAP_EN}\nsame body`)]);
    const t2 = writeTranscript(b.dir, [ccAssistant(`${RECAP_EN}\nsame body`)]);
    const manual = run(a.residueDir, {
      session_id: 's',
      transcript_path: t1,
      trigger: 'manual',
    });
    const auto = run(b.residueDir, {
      session_id: 's',
      transcript_path: t2,
      trigger: 'auto',
    });
    const strip = (s: string | null) =>
      (s ?? '').replace(/- \*\*(Written|Transcript):\*\*.*\n/g, '');
    expect(strip(manual.residue).replace('`manual`', 'X')).toBe(
      strip(auto.residue).replace('`auto`', 'X'),
    );
  });

  it('extracts from a ZCode synthetic transcript (message.role, no outer type)', () => {
    const { dir, residueDir } = sandbox();
    const transcript = writeTranscript(dir, [
      zcodeAssistant(`${RECAP_EN}\nzcode-shaped recap`),
    ]);
    const r = run(residueDir, {
      session_id: 'sess-zcode',
      transcript_path: transcript,
      trigger: 'auto',
    });
    expect(r.residue).toContain('- **Body source:** recap');
    expect(r.residue).toContain('zcode-shaped recap');
  });

  it('finds a Russian recap under AIF_HOOK_LANG=ru (the marker is category-3 match-data)', () => {
    const { dir, residueDir } = sandbox();
    const transcript = writeTranscript(dir, [
      ccAssistant(`${RECAP_RU}\nрусский рекап`),
    ]);
    const ru = run(residueDir, {
      session_id: 'sess-ru',
      transcript_path: transcript,
      trigger: 'manual',
    }, 'ru');
    expect(ru.residue).toContain('- **Body source:** recap');

    // …and the SAME fixture read with the en pack finds no marker: the packs are not
    // interchangeable, which is exactly why every other case here pins the language.
    const b = sandbox();
    const t2 = writeTranscript(b.dir, [ccAssistant(`${RECAP_RU}\nрусский рекап`)]);
    const en = run(b.residueDir, {
      session_id: 'sess-ru2',
      transcript_path: t2,
      trigger: 'manual',
    });
    expect(en.residue).toContain('- **Body source:** excerpt');
  });

  it('never fails compaction when the residue dir cannot be written', () => {
    const { residueDir } = sandbox();
    const locked = join(residueDir, 'locked');
    mkdirSync(locked, { recursive: true });
    chmodSync(locked, 0o555);
    const r = spawnSync('bash', [HOOK], {
      input: JSON.stringify({ session_id: 'sess-ro', trigger: 'auto' }),
      encoding: 'utf8',
      env: {
        ...process.env,
        AIF_HOOK_LANG: 'en',
        AIF_RESIDUE_DIR: join(locked, 'nested'),
        CLAUDE_PROJECT_DIR: REPO_ROOT,
      },
    });
    expect(r.status).toBe(0);
    expect(r.stdout ?? '').toBe('');
  });
});
