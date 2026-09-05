// packages/runtime-bridge/test/aif-self-cleaning.test.ts
// Self-cleaning junk producers (2026-06-01): junk must NOT accumulate, and must NOT
// require an AI/manual sweep each session. These cover the two pure cores:
//   - idempotency.pruneStaleEntries: dedup log self-prunes on every write (bounded +
//     stale-manual entries auto-expire → Finding B never recurs after TTL).
//   - ManualBackend.isStaleArtifact: /tmp kickoffs self-prune on the next dispatch.
import { describe, it, expect, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEntries, pruneStaleEntries, resolveDedupPath } from '../src/idempotency.js';
import { isStaleArtifact, manualInstructions } from '../src/ManualBackend.js';
import type { TaskHandle } from '../src/types.js';

const HANDLE: TaskHandle = { backend: 'manual', taskId: 't', dispatchedAt: '2026-06-01T00:00:00.000Z' };
const at = (iso: string) => ({ hash: 'h', taskHandle: HANDLE, timestamp: iso });
const DAY = 24 * 60 * 60 * 1000;

describe('pruneStaleEntries — dedup log self-prunes by TTL', () => {
  const now = Date.parse('2026-06-02T00:00:00.000Z');
  it('keeps entries within the 24h TTL', () => {
    const fresh = at('2026-06-01T12:00:00.000Z'); // 12h old
    expect(pruneStaleEntries([fresh], now, DAY)).toEqual([fresh]);
  });
  it('drops entries older than the TTL (a stale manual fallback expires on its own)', () => {
    const stale = at('2026-05-30T00:00:00.000Z'); // 48h old
    expect(pruneStaleEntries([stale], now, DAY)).toEqual([]);
  });
  it('keeps the exact-boundary entry (age == TTL is not yet stale)', () => {
    const edge = at('2026-06-01T00:00:00.000Z'); // exactly 24h
    expect(pruneStaleEntries([edge], now, DAY)).toEqual([edge]);
  });

  // Negative guard: green now; RED if prune regressed to a no-op (kept the stale entry).
  it('GUARD: a 48h-old entry must NOT survive the prune', () => {
    expect(pruneStaleEntries([at('2026-05-30T00:00:00.000Z')], now, DAY)).not.toContainEqual(
      at('2026-05-30T00:00:00.000Z'),
    );
  });
});

describe('parseEntries — tolerant JSONL parse', () => {
  it('parses valid lines and skips malformed ones', () => {
    const jsonl = `${JSON.stringify(at('2026-06-01T00:00:00.000Z'))}\nNOT JSON\n`;
    expect(parseEntries(jsonl)).toHaveLength(1);
  });
});

describe('isStaleArtifact — /tmp kickoff self-prune predicate', () => {
  const now = Date.parse('2026-06-08T00:00:00.000Z');
  const SEVEN_D = 7 * DAY;
  it('flags an old runtime-bridge kickoff as stale', () => {
    expect(isStaleArtifact('runtime-bridge-2026-05-01.md', now - 30 * DAY, now, SEVEN_D)).toBe(true);
  });
  it('does NOT flag a fresh kickoff', () => {
    expect(isStaleArtifact('runtime-bridge-2026-06-07.md', now - DAY, now, SEVEN_D)).toBe(false);
  });
  it('does NOT touch unrelated files even when old (scope safety)', () => {
    expect(isStaleArtifact('important-notes.md', now - 365 * DAY, now, SEVEN_D)).toBe(false);
    expect(isStaleArtifact('runtime-bridge-dedup.jsonl', now - 365 * DAY, now, SEVEN_D)).toBe(false);
  });

  // Negative guard: green now; RED if the scope check regressed to match any old file.
  it('GUARD: an unrelated old .md must NOT be considered a prunable artefact', () => {
    expect(isStaleArtifact('my-research.md', now - 365 * DAY, now, SEVEN_D)).not.toBe(true);
  });
});

// ── A5-3 / E-1: the dedup path the vendor README documented and no code read ──────────────
// A single hard-coded global log cross-contaminates N vendored consumers on one host: B's
// identical-content kickoff reads as "already dispatched" because A dispatched it inside the
// TTL. resolveDedupPath is the pure core; one arm below proves the write really follows it.
describe('resolveDedupPath — the per-project dedup log (A5-3 / E-1)', () => {
  it('POSITIVE: the env var wins — this is the knob the vendor README documents', () => {
    expect(resolveDedupPath({ RUNTIME_BRIDGE_DEDUP_PATH: '/srv/proj-a/dedup.jsonl' })).toBe(
      '/srv/proj-a/dedup.jsonl',
    );
  });

  it('POSITIVE: two projects resolve to two different logs (the cross-contamination fix)', () => {
    const a = resolveDedupPath({ RUNTIME_BRIDGE_DEDUP_PATH: '/srv/a/dedup.jsonl' });
    const b = resolveDedupPath({ RUNTIME_BRIDGE_DEDUP_PATH: '/srv/b/dedup.jsonl' });

    expect(a).not.toBe(b);
  });

  it('NEGATIVE: unset / empty / whitespace-only all fall back to the default, never to \'\'', () => {
    for (const env of [{}, { RUNTIME_BRIDGE_DEDUP_PATH: '' }, { RUNTIME_BRIDGE_DEDUP_PATH: '   ' }]) {
      expect(resolveDedupPath(env)).toBe('/tmp/runtime-bridge-dedup.jsonl');
    }
  });

  it('the resolved path is where the write actually lands (the const is not bypassed)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rb-dedup-'));
    const path = join(dir, 'dedup.jsonl');
    try {
      vi.resetModules();
      process.env['RUNTIME_BRIDGE_DEDUP_PATH'] = path;
      const { recordDispatch, checkDedup } = await import('../src/idempotency.js');

      recordDispatch('hash-a', HANDLE);

      expect(existsSync(path)).toBe(true);
      expect(checkDedup('hash-a')?.taskId).toBe('t');
    } finally {
      delete process.env['RUNTIME_BRIDGE_DEDUP_PATH'];
      vi.resetModules();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ── K-2: the ManualBackend box called itself bilingual and was Russian-only ───────────────
// language-discipline.md §1 row 2 + §2: human-facing output follows AIF_HOOK_LANG, and an
// UNSET var means English. The vendor drop shipped the Russian-only box to every consumer.
describe('manualInstructions — AIF_HOOK_LANG gate on the operator box (K-2)', () => {
  it('POSITIVE: unset language renders English', () => {
    const out = manualInstructions('t1', '/tmp/k.md', '/tmp/r.md', undefined);

    expect(out).toContain('Kickoff written to: /tmp/k.md');
    expect(out).toContain('Open a new Claude Code window and run the task.');
    expect(out).toContain('Put the report in: /tmp/r.md');
  });

  it('POSITIVE: AIF_HOOK_LANG=ru renders Russian', () => {
    const out = manualInstructions('t1', '/tmp/k.md', '/tmp/r.md', 'ru');

    expect(out).toContain('Kickoff сохранён: /tmp/k.md');
    expect(out).toContain('Откройте новое окно Claude Code');
  });

  it('NEGATIVE: a non-ru language never leaks Cyrillic to the operator', () => {
    for (const lang of [undefined, '', 'en', 'de']) {
      expect(manualInstructions('t1', '/tmp/k.md', '/tmp/r.md', lang)).not.toMatch(/[\u0400-\u04FF]/);
    }
  });

  it('the box borders line up in BOTH languages (the RU title used to be a column short)', () => {
    for (const lang of [undefined, 'ru']) {
      const [, top, title, bottom] = manualInstructions('t1', '/tmp/k.md', '/tmp/r.md', lang).split('\n');

      expect(title?.length).toBe(top?.length);
      expect(title?.length).toBe(bottom?.length);
    }
  });
});
