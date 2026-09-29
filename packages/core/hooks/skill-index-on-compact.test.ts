/**
 * Skill index re-injection after a compaction — behaviour tests.
 *
 * Subject: `.claude/hooks/lib/skill-index.sh`, sourced by
 * `.claude/hooks/inject-session-bootstrap.sh` (registered on SessionStart with the
 * `startup|resume|clear|compact` matcher).
 *
 * Why: the harness does not re-inject the skill listing after a compaction (vendor context
 * model, `noSurviveCompact: true` on the «Skill descriptions» block), so the model no longer
 * knows which skills exist. The block under test restores the NAMES once per compaction.
 *
 * Contract pinned here:
 *   - fires on `source=compact` only — every other source pays zero bytes;
 *   - names come from the session transcript — the LAST full `skill_listing` attachment plus
 *     the deltas after it — i.e. what the harness itself had offered (stamped / disabled
 *     skills stay absent);
 *   - with no usable transcript it falls back to the project's own model-invocable skills;
 *   - it is bounded in bytes and can never break the digest it rides on.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/inject-session-bootstrap.sh');
const LIB = resolve(REPO_ROOT, '.claude/hooks/lib/skill-index.sh');

const OPEN = '[skill index — re-injected after compaction]';
const CLOSE = '[/skill index]';
const DIGEST_CLOSE = '[/session-bootstrap digest]';

const sandboxes: string[] = [];
afterEach(() => {
  while (sandboxes.length)
    rmSync(sandboxes.pop()!, { recursive: true, force: true });
});

/** A project tree holding the hook, optionally its lib, and optional project skills. */
function sandbox(
  opts: { withLib?: boolean; skills?: Record<string, string> } = {},
): string {
  const root = mkdtempSync(join(tmpdir(), 'skill-index-'));
  sandboxes.push(root);
  mkdirSync(join(root, '.claude/hooks/lib'), { recursive: true });
  copyFileSync(HOOK, join(root, '.claude/hooks/inject-session-bootstrap.sh'));
  if (opts.withLib !== false)
    copyFileSync(LIB, join(root, '.claude/hooks/lib/skill-index.sh'));
  for (const [name, frontmatter] of Object.entries(opts.skills ?? {})) {
    mkdirSync(join(root, '.claude/skills', name), { recursive: true });
    writeFileSync(
      join(root, '.claude/skills', name, 'SKILL.md'),
      `---\nname: ${name}\n${frontmatter}\n---\n\n# ${name}\n`,
    );
  }
  return root;
}

/** `full` = the harness's `isInitial`: a full listing, as opposed to a mid-session delta. */
function listing(names: string[], full = true): string {
  return JSON.stringify({
    type: 'attachment',
    attachment: {
      type: 'skill_listing',
      isInitial: full,
      skillCount: names.length,
      names,
      content: names.map((n) => `- ${n}: some description`).join('\n'),
    },
  });
}

function transcript(root: string, lines: string[]): string {
  const p = join(root, 'transcript.jsonl');
  writeFileSync(p, lines.join('\n') + '\n');
  return p;
}

function run(
  root: string,
  payload: unknown,
  env: Record<string, string> = {},
): { stdout: string; status: number } {
  const fullEnv: Record<string, string | undefined> = {
    ...process.env,
    ...env,
    CLAUDE_PROJECT_DIR: root,
  };
  for (const k of [
    'ZCODE_PROJECT_DIR',
    'AIF_AUTONOMOUS',
    'AIF_HOOK_LANG',
    'AIF_SKILL_INDEX',
    'AIF_SKILL_INDEX_MAX_BYTES',
  ])
    if (env[k] === undefined) delete fullEnv[k];
  const r = spawnSync(
    'bash',
    [join(root, '.claude/hooks/inject-session-bootstrap.sh')],
    {
      input: typeof payload === 'string' ? payload : JSON.stringify(payload),
      encoding: 'utf8',
      env: fullEnv as NodeJS.ProcessEnv,
    },
  );
  return { stdout: r.stdout ?? '', status: r.status ?? -1 };
}

function block(stdout: string): string {
  const a = stdout.indexOf(OPEN);
  const b = stdout.indexOf(CLOSE);
  return a >= 0 && b > a ? stdout.slice(a, b + CLOSE.length) : '';
}

describe('skill index after compaction', () => {
  it('re-injects the names of the last harness listing, grouped by namespace', () => {
    const root = sandbox();
    const t = transcript(root, [
      listing(['old-skill', 'superpowers:old']),
      JSON.stringify({ type: 'user', message: { content: 'hello' } }),
      listing([
        'orchestrator',
        'reviewer',
        'superpowers:brainstorming',
        'superpowers:writing-plans',
        'mbp:handoff',
      ]),
    ]);
    const r = run(root, {
      hook_event_name: 'SessionStart',
      source: 'compact',
      session_id: 's1',
      transcript_path: t,
    });
    expect(r.status).toBe(0);
    const b = block(r.stdout);
    expect(b).not.toBe('');
    expect(b).toContain('orchestrator, reviewer');
    expect(b).toContain('superpowers: brainstorming, writing-plans');
    expect(b).toContain('mbp: handoff');
    // the LAST listing wins — an earlier one is history, not the current offer
    expect(b).not.toContain('old-skill');
    // the digest it rides on is intact and comes first
    expect(r.stdout.indexOf(DIGEST_CLOSE)).toBeGreaterThan(0);
    expect(r.stdout.indexOf(DIGEST_CLOSE)).toBeLessThan(r.stdout.indexOf(OPEN));
  });

  it.each(['startup', 'resume', 'clear'])(
    'emits nothing on source=%s (the harness sends its own listing there)',
    (source) => {
      const root = sandbox();
      const t = transcript(root, [listing(['orchestrator'])]);
      const r = run(root, { source, session_id: 's1', transcript_path: t });
      expect(r.status).toBe(0);
      expect(r.stdout).toContain(DIGEST_CLOSE);
      expect(r.stdout).not.toContain(OPEN);
    },
  );

  it('adds a mid-session delta to the full listing instead of replacing it', () => {
    // Measured live 2026-09-29: editing one SKILL.md made the harness record a delta naming
    // that one skill; last-record-wins then shrank a 123-name index to a single name.
    const root = sandbox();
    const t = transcript(root, [
      listing(['stale-skill']),
      listing(['orchestrator', 'reviewer', 'superpowers:brainstorming']),
      listing(['orchestrator'], false),
      listing(['mbp:handoff'], false),
    ]);

    const r = run(root, { source: 'compact', transcript_path: t });

    const b = block(r.stdout);
    expect(b).toContain('orchestrator, reviewer');
    expect(b).toContain('superpowers: brainstorming');
    expect(b).toContain('mbp: handoff');
    expect(b).not.toContain('stale-skill');
    expect(b.match(/orchestrator/g)).toHaveLength(1);
  });

  it('is not fooled by a transcript line that merely quotes a listing', () => {
    const root = sandbox();
    const quoted = JSON.stringify({
      type: 'assistant',
      message: {
        content:
          'jq select(.attachment.type=="skill_listing") {"type":"skill_listing","names":["forged"]}',
      },
    });
    const t = transcript(root, [listing(['real-skill']), quoted]);
    const r = run(root, { source: 'compact', transcript_path: t });
    const b = block(r.stdout);
    expect(b).toContain('real-skill');
    expect(b).not.toContain('forged');
  });

  it('falls back to the project model-invocable skills when the transcript is unusable', () => {
    const root = sandbox({
      skills: {
        alpha: 'description: Use when alpha.',
        beta: 'description: Use when beta.\ndisable-model-invocation: true',
        gamma: 'description: Use when gamma.',
      },
    });
    const r = run(root, {
      source: 'compact',
      transcript_path: join(root, 'absent.jsonl'),
    });
    expect(r.status).toBe(0);
    const b = block(r.stdout);
    expect(b).toContain('alpha');
    expect(b).toContain('gamma');
    // a user-only skill was never in the listing, so it must not appear now
    expect(b).not.toMatch(/\bbeta\b/);
  });

  it('emits no block when there is neither a listing nor a project skill', () => {
    const root = sandbox();
    const r = run(root, { source: 'compact' });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(DIGEST_CLOSE);
    expect(r.stdout).not.toContain(OPEN);
  });

  it('caps the block in bytes and says how many names were cut', () => {
    const root = sandbox();
    const names = Array.from(
      { length: 400 },
      (_, i) => `plugin${i % 7}:skill-with-a-long-name-${i}`,
    );
    const t = transcript(root, [listing(names)]);
    const r = run(
      root,
      { source: 'compact', transcript_path: t },
      { AIF_SKILL_INDEX_MAX_BYTES: '1500' },
    );
    const b = block(r.stdout);
    expect(Buffer.byteLength(b)).toBeLessThanOrEqual(1500);
    expect(b).toMatch(/\+\d+ more/);
    expect(b.endsWith(CLOSE)).toBe(true);
  });

  it('stays under the harness cap on hook output even with the largest digest', () => {
    const root = sandbox();
    const names = Array.from(
      { length: 600 },
      (_, i) => `plugin${i % 9}:skill-with-a-long-name-${i}`,
    );
    const t = transcript(root, [listing(names)]);
    const r = run(
      root,
      { source: 'compact', transcript_path: t },
      {
        AIF_AUTONOMOUS: '1',
        AIF_HOOK_LANG: 'ru',
        AIF_SKILL_INDEX_MAX_BYTES: '50000',
      },
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(DIGEST_CLOSE);
    expect(r.stdout).toContain(OPEN);
    expect(Buffer.byteLength(r.stdout)).toBeLessThanOrEqual(10000);
  });

  it('can be switched off', () => {
    const root = sandbox();
    const t = transcript(root, [listing(['orchestrator'])]);
    const r = run(
      root,
      { source: 'compact', transcript_path: t },
      { AIF_SKILL_INDEX: 'off' },
    );
    expect(r.stdout).toContain(DIGEST_CLOSE);
    expect(r.stdout).not.toContain(OPEN);
  });

  it('never breaks the digest: malformed stdin, empty stdin, or a missing lib', () => {
    for (const payload of ['{not json', '']) {
      const r = run(sandbox(), payload);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain(DIGEST_CLOSE);
      expect(r.stdout).not.toContain(OPEN);
    }
    const root = sandbox({ withLib: false });
    const t = transcript(root, [listing(['orchestrator'])]);
    const r = run(root, { source: 'compact', transcript_path: t });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(DIGEST_CLOSE);
    expect(r.stdout).not.toContain(OPEN);
  });

  it('never blocks on a stdin that is closed or that nobody writes to', () => {
    const root = sandbox();
    const hook = join(root, '.claude/hooks/inject-session-bootstrap.sh');
    const env = { ...process.env, CLAUDE_PROJECT_DIR: root };
    delete (env as Record<string, string | undefined>).ZCODE_PROJECT_DIR;
    // The hook is timed by the shell that runs it (`SECONDS`), not by the wall clock of the
    // spawn: the writer-less pipe below is held open by a `sleep` the spawn also waits for.
    // `timeout` is the backstop for a hook that never returns at all.
    for (const stdin of ['<&-', '< <(sleep 4)']) {
      const r = spawnSync(
        'bash',
        [
          '-c',
          `SECONDS=0; out=$(bash "${hook}" ${stdin}); echo "took=$SECONDS"; printf '%s' "$out"`,
        ],
        { encoding: 'utf8', env, timeout: 15000 },
      );
      expect(r.status, stdin).toBe(0);
      expect(r.stdout, stdin).toContain(DIGEST_CLOSE);
      const took = Number(/took=(\d+)/.exec(r.stdout)?.[1] ?? '99');
      expect(took, stdin).toBeLessThanOrEqual(2);
    }
  });

  it('skips a malformed transcript line instead of stopping at it', () => {
    const root = sandbox();
    const t = transcript(root, [
      listing(['old-a', 'ns:old-b']),
      '{"type":"user","message":"skill_listing truncated',
      listing(['new-a', 'ns:new-b']),
    ]);
    const b = block(
      run(root, { source: 'compact', transcript_path: t }).stdout,
    );
    expect(b).toContain('new-a');
    expect(b).toContain('ns: new-b');
    expect(b).not.toContain('old-a');
  });

  it('emits nothing rather than empty fences when no name is usable', () => {
    const root = sandbox();
    const t = transcript(root, [
      listing(['ns:', ':lead', 'bad name', 'a:b:c']),
    ]);
    const r = run(root, { source: 'compact', transcript_path: t });
    expect(r.stdout).toContain(DIGEST_CLOSE);
    expect(r.stdout).not.toContain(OPEN);
  });

  it('lists a repeated name once', () => {
    const root = sandbox();
    const t = transcript(root, [
      listing(['alpha', 'ns:beta', 'alpha', 'ns:beta']),
    ]);
    const b = block(
      run(root, { source: 'compact', transcript_path: t }).stdout,
    );
    expect(b.match(/\balpha\b/g)).toHaveLength(1);
    expect(b.match(/\bbeta\b/g)).toHaveLength(1);
  });

  it('reads a byte cap written with a leading zero as decimal', () => {
    const root = sandbox();
    const t = transcript(root, [listing(['orchestrator'])]);
    const r = run(
      root,
      { source: 'compact', transcript_path: t },
      { AIF_SKILL_INDEX_MAX_BYTES: '0800' },
    );
    expect(block(r.stdout)).toContain('orchestrator');
  });

  it('wraps the block into the JSON envelope on the second harness', () => {
    const root = sandbox();
    const t = transcript(root, [listing(['orchestrator'])]);
    const r = run(
      root,
      { source: 'compact', transcript_path: t },
      { ZCODE_PROJECT_DIR: root },
    );
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as { additionalContext: string };
    expect(parsed.additionalContext).toContain(OPEN);
    expect(parsed.additionalContext).toContain('orchestrator');
  });
});
