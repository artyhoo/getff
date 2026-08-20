/**
 * Emitter contract for `.claude/skills/pipeline/helpers/frontier.sh` — the NO-COLUMN
 * degrade path (#1498): a kickoff whose stage table carries no `Depends on` column
 * must emit the SAME marker-lies protection as the columned path — a done/MERGED
 * marker in row text reaches the consumer as `done=yes basis=marker-unverified` plus
 * the `ATTN: marker-unverified done` line, never as a bare unmarked `done=yes`.
 *
 * Consumer-side counterpart: `packages/core/skills/dispatcher/advance-frontier.test.ts`
 * (MARKER-LIES-HALT / NO-COLUMN verdicts). This file pins the EMITTER lines those
 * verdicts parse; before #1498 the degrade path emitted `done=yes` with no basis and
 * no ATTN — the protection could not reach it.
 *
 * Seams: MO_KICKOFF_DIR (fixture kickoff root), MO_FRONTIER_DONE / MO_FRONTIER_OPEN
 * (§6 force flags), done.md presence (basis=done-md ladder).
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../..');
const FRONTIER = resolve(REPO_ROOT, '.claude/skills/pipeline/helpers/frontier.sh');

function runFrontier(
  kickoff: string,
  env: Record<string, string> = {},
  umbrella = 'fx-frontier',
): { status: number; stdout: string } {
  const root = mkdtempSync(join(tmpdir(), 'frontier-fx-'));
  mkdirSync(join(root, umbrella));
  writeFileSync(join(root, umbrella, 'kickoff.md'), kickoff, 'utf8');
  const r = spawnSync('bash', [FRONTIER, umbrella], {
    encoding: 'utf8',
    env: { ...process.env, MO_KICKOFF_DIR: root, ...env },
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '' };
}

/** A stage table with NO `Depends on` column — the degrade path's input shape. */
const NO_COLUMN = (s2cell: string) => `# KICKOFF — fixture

## §2 Stages

| Stage | Deliverable |
| --- | --- |
| S1 | build the thing |
| S2 | ${s2cell} |
`;

describe('frontier.sh — no-column degrade path carries the marker-lies protection (#1498)', () => {
  it('a lying MERGED marker in row text → done=yes basis=marker-unverified + ATTN line, never bare done=yes', () => {
    const r = runFrontier(NO_COLUMN('shipped ✅ MERGED 2026-08-18 to staging'));
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/STAGE S2 done=yes basis=marker-unverified deps=\? unmet=\? unresolved=no/);
    expect(r.stdout, 'the ATTN line is the consumer-side HALT-VERIFY trigger — without it the marker-lies protection cannot reach this path').toMatch(/ATTN: marker-unverified done — S2 read as done from row text, NOT proven merged/);
    expect(r.stdout).toMatch(/STAGE S1 done=no /);
    expect(r.stdout).toMatch(/DEGRADE: kickoff carries no `Depends on` column/);
  });

  it('a clean no-column kickoff: not-done rows carry NO basis and NO ATTN line', () => {
    const r = runFrontier(NO_COLUMN('the follow-up stage'));
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/STAGE S1 done=no /);
    expect(r.stdout).toMatch(/STAGE S2 done=no /);
    expect(r.stdout, 'no marker read as done → no unverified-done claim to flag').not.toMatch(/ATTN: marker-unverified/);
    expect(r.stdout).not.toMatch(/basis=/);
    expect(r.stdout).toMatch(/DONE: \(none\)/);
  });

  it('done.md present → basis=done-md for every stage, no marker-unverified ATTN', () => {
    // done.md presence is the ladder's top rung in BOTH paths; the fixture writes it
    // next to the kickoff via the same MO_KICKOFF_DIR root.
    const root = mkdtempSync(join(tmpdir(), 'frontier-fx-'));
    const u = 'fx-frontier';
    mkdirSync(join(root, u));
    writeFileSync(join(root, u, 'kickoff.md'), NO_COLUMN('shipped ✅ MERGED 2026-08-18 to staging'), 'utf8');
    writeFileSync(join(root, u, 'done.md'), 'closed\n', 'utf8');
    const r = spawnSync('bash', [FRONTIER, u], {
      encoding: 'utf8',
      env: { ...process.env, MO_KICKOFF_DIR: root },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/STAGE S1 done=yes basis=done-md /);
    expect(r.stdout).toMatch(/STAGE S2 done=yes basis=done-md /);
    expect(r.stdout, 'the marker was superseded by the closure file, so no unverified claim').not.toMatch(/ATTN: marker-unverified/);
  });

  it('MO_FRONTIER_OPEN clears a stale marker: done=no, no basis, absent from the ATTN line', () => {
    const r = runFrontier(NO_COLUMN('shipped ✅ MERGED 2026-08-18 to staging'), { MO_FRONTIER_OPEN: 'S2' });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/STAGE S2 done=no /);
    expect(r.stdout).not.toMatch(/ATTN: marker-unverified/);
    expect(r.stdout).toMatch(/FRONTIER:.*S2/);
  });
});
