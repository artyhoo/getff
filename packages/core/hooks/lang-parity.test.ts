/**
 * CI wiring for the hook language-pack parity check
 * (.claude/hooks/lang/check-parity.sh) — #1597 review ledger A3-7 / E-5.
 *
 * Before this file the script had NO invoker anywhere in the tree: no test, no hook, no
 * workflow ran it, so en.sh/ru.sh key drift shipped to consumers unnoticed through
 * setup.d/10-skills.sh and install.sh, which deliver the pack (and the checker itself) to
 * every consumer project. The script is the deterministic, no-LLM guard against
 * #two-prompts-drift at the leaf-string level (.claude/rules/language-discipline.md §4) —
 * a guard nothing had ever fired.
 *
 * Arms:
 *   1. live packs → exit 0 (the guard passes on the shipped state)
 *   2. seeded drift (a key removed from ONE pack) → exit 1 + a DRIFT diagnostic naming the key
 *   3. A3-7 regression: a key class removed from BOTH packs is parity, not an abort.
 *      Pre-fix, `keys()` ended on a bare `grep -oE '^AIF_EOT_[A-Z_]+='`; with no match that
 *      grep exits 1, pipefail propagates it as the brace group's status, and `set -e` killed
 *      the script at the `en=$(keys …)` assignment — exit 1 with EMPTY stdout AND stderr,
 *      which reads exactly like a drift failure whose diagnostic got lost. Measured against
 *      the pre-fix script: rc=1, no output.
 *   4. The plugin twin stays in sync (ZCode consumers reach hooks only via the plugin channel).
 *
 * Sandbox: every arm copies the three pack files into a tempdir and runs the copy, so no arm
 * can mutate the tracked packs (the .claude/hooks tree-guard class, PR #844).
 */
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const LANG_DIR = resolve(REPO_ROOT, '.claude/hooks/lang');
const TWIN = resolve(REPO_ROOT, 'plugin/hooks/lang/check-parity.sh');

const boxes: string[] = [];
afterAll(() => {
  for (const b of boxes.splice(0)) rmSync(b, { recursive: true, force: true });
});

/** Copy the pack into a sandbox so no arm can touch the tracked files. */
function sandbox(): string {
  const box = mkdtempSync(join(tmpdir(), 'lang-parity-'));
  boxes.push(box);
  for (const f of ['en.sh', 'ru.sh', 'check-parity.sh']) {
    copyFileSync(join(LANG_DIR, f), join(box, f));
  }
  return box;
}

function run(box: string): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('/bin/bash', [join(box, 'check-parity.sh')], {
    encoding: 'utf8',
    timeout: 15_000,
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Drop every line starting with `prefix` from one pack file. */
function dropKey(box: string, pack: 'en.sh' | 'ru.sh', prefix: string): void {
  const p = join(box, pack);
  const kept = readFileSync(p, 'utf8')
    .split('\n')
    .filter((l) => !l.startsWith(prefix))
    .join('\n');
  writeFileSync(p, kept, 'utf8');
}

describe('.claude/hooks/lang/check-parity.sh — en/ru pack parity (A3-7, E-5)', () => {
  it('the shipped packs are in parity (exit 0 + an OK summary)', () => {
    const r = run(sandbox());
    expect(r.status, `check-parity failed on the live packs. stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toMatch(/^OK: en\.sh and ru\.sh expose identical keys/m);
  });

  it('PAIRED-NEGATIVE: a key dropped from ONE pack → exit 1 naming the key', () => {
    const box = sandbox();
    dropKey(box, 'ru.sh', 'AIF_STORY_MARKER=');
    const r = run(box);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/DRIFT: en\.sh and ru\.sh key sets differ/);
    expect(r.stderr).toContain('AIF_STORY_MARKER');
  });

  it('A3-7: a key class absent from BOTH packs is parity, not a silent abort', () => {
    // The pre-fix script exited 1 here with empty stdout AND stderr, because the final bare
    // grep in keys() found nothing and set -e killed the assignment before any report.
    const box = sandbox();
    dropKey(box, 'en.sh', 'AIF_EOT_');
    dropKey(box, 'ru.sh', 'AIF_EOT_');
    const r = run(box);
    expect(
      r.status,
      `exit ${r.status} with stdout="${r.stdout.trim()}" stderr="${r.stderr.trim()}" — ` +
        'an empty non-zero result is the A3-7 silent abort',
    ).toBe(0);
    expect(r.stdout).toMatch(/^OK: en\.sh and ru\.sh expose identical keys/m);
  });

  it('every drift verdict carries a diagnostic — no silent non-zero exit on any arm', () => {
    // The property A3-7 violated, stated directly: a non-zero exit must always say why.
    const cases: Array<() => string> = [
      () => {
        const b = sandbox();
        dropKey(b, 'en.sh', 'AIF_RECAP_MARKER=');
        return b;
      },
      () => {
        const b = sandbox();
        dropKey(b, 'ru.sh', 'aif_msg_');
        return b;
      },
      () => {
        const b = sandbox();
        dropKey(b, 'en.sh', 'AIF_EOT_');
        return b;
      },
    ];
    for (const mk of cases) {
      const r = run(mk());
      if (r.status !== 0) {
        expect(
          `${r.stdout}${r.stderr}`.trim(),
          `non-zero exit ${r.status} with no diagnostic — the A3-7 shape`,
        ).not.toBe('');
      }
    }
  });

  it('E-5: the header no longer claims the checker is unshipped', () => {
    // setup.d/10-skills.sh and install.sh both deliver lang/{en,ru,check-parity}.sh to
    // consumers, so the old "not shipped to consumer projects via install.sh" rationale was
    // false at both delivery sites.
    const src = readFileSync(join(LANG_DIR, 'check-parity.sh'), 'utf8');
    expect(src).not.toMatch(/not shipped to consumer projects via install\.sh/);
    expect(src).toMatch(/^# @(dual-pair|cc-only-rationale):/m);
  });

  it('the plugin twin is byte-identical to the source (ZCode reaches hooks only via plugin)', () => {
    expect(readFileSync(TWIN, 'utf8')).toBe(readFileSync(join(LANG_DIR, 'check-parity.sh'), 'utf8'));
  });
});
