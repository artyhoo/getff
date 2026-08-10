/**
 * Paired-negative contract for priority-score.sh D6 — the legacy reconstruct
 * fallback (cross-session kickoff portability I-phase, SSOT #116).
 *
 * Helper under test: .claude/skills/pipeline/helpers/priority-score.sh
 *
 * Kickoff D6 acceptance:
 *   - a missing-kickoff umbrella WITH a committed plan row → RECONSTRUCT-STUB notice
 *   - one WITHOUT a plan row → silent
 *   - it does NOT auto-write the plan (Direction A REJECTED — SKILL.md §2.5 Step 8;
 *     the notice is the only output, no kickoff.md is created).
 *
 * Reference harness: packages/core/hooks/priority-score-branch-matcher.test.ts
 * (REPO_ROOT + MO_GH_BIN fake-gh seam) + MO_WAVE_PLAN fixture seam for the plan row.
 * T3 compliance: each assertion cites the helper region it targets.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  chmodSync,
  existsSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(
  REPO_ROOT,
  '.claude/skills/pipeline/helpers/priority-score.sh',
);

// Every test here spawns the real priority-score.sh against a sandbox repo — real
// git + `gh` stub calls per umbrella, so multi-second runtimes are inherent and the
// vitest 5s default is a mis-set gate rather than a signal. Run in isolation the
// cases measure 0.7-1.5s; under full-suite parallel load (`vitest run hooks/
// skills/`, measured 2026-08-10) four of them time out at 5000ms. 30_000 is the
// SLOW_SHELL_MS convention this helper's own sibling suites already use
// (priority-score-synthetic.test.ts, priority-score-skip-closed.test.ts).
const SLOW_SHELL_MS = 30_000;

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeSandbox(): string {
  const d = mkdtempSync(join(tmpdir(), 'priority-score-reconstruct-test-'));
  sandboxes.push(d);
  return d;
}

/** A missing-kickoff umbrella: dir exists with a non-kickoff file, no kickoff.md. */
function makeMissingKickoffUmbrella(root: string, name: string): void {
  const dir = join(root, '.claude', 'orchestrator-prompts', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'state.md'), 'PENDING\n', 'utf8'); // present, but not kickoff.md
}

/** A normal umbrella with kickoff.md (control — must NOT emit RECONSTRUCT-STUB). */
function makeKickoffUmbrella(root: string, name: string): void {
  const dir = join(root, '.claude', 'orchestrator-prompts', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'kickoff.md'),
    `# ${name}\n\n> **Type:** I-phase\n`,
    'utf8',
  );
}

/** Write a wave-sequencing-plan fixture; returns its path for the MO_WAVE_PLAN seam. */
function writeWavePlan(root: string, contents: string): string {
  const p = join(root, 'wave-plan.md');
  writeFileSync(p, contents, 'utf8');
  return p;
}

function makeFakeGh(root: string): string {
  const fakeGh = join(root, 'fake-gh.sh');
  writeFileSync(fakeGh, '#!/usr/bin/env bash\necho "[]"\nexit 0\n', 'utf8');
  chmodSync(fakeGh, 0o755);
  return fakeGh;
}

function runHelper(
  root: string,
  wavePlan: string,
): { status: number; stdout: string } {
  const r = spawnSync('bash', [HELPER], {
    encoding: 'utf8',
    env: {
      ...process.env,
      REPO_ROOT: root,
      MO_GH_BIN: makeFakeGh(root),
      MO_WAVE_PLAN: wavePlan,
    },
  });
  return { status: r.status ?? -1, stdout: r.stdout };
}

describe('priority-score.sh — D6 reconstruct-stub (paired-negative contract)', { timeout: SLOW_SHELL_MS }, () => {
  it('POSITIVE — missing-kickoff umbrella WITH a committed plan row → RECONSTRUCT-STUB notice', () => {
    // Targets the kickoff=missing branch: grep -qF "${name}" "${MO_WAVE_PLAN}" → emit notice.
    const root = makeSandbox();
    makeMissingKickoffUmbrella(root, 'legacy-umbrella');
    const wavePlan = writeWavePlan(
      root,
      '# Wave plan\n\n| legacy-umbrella | shipped | #42 |\n',
    );

    const r = runHelper(root, wavePlan);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('legacy-umbrella kickoff=missing');
    expect(r.stdout).toMatch(/RECONSTRUCT-STUB: legacy-umbrella /);
  });

  it('NEGATIVE — missing-kickoff umbrella WITHOUT a plan row → silent (no RECONSTRUCT-STUB)', () => {
    // Paired negative: same missing-kickoff state, but the name is absent from the plan.
    const root = makeSandbox();
    makeMissingKickoffUmbrella(root, 'orphan-umbrella');
    const wavePlan = writeWavePlan(
      root,
      '# Wave plan\n\n| some-other-umbrella | shipped | #7 |\n',
    );

    const r = runHelper(root, wavePlan);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('orphan-umbrella kickoff=missing');
    expect(r.stdout).not.toContain('RECONSTRUCT-STUB: orphan-umbrella');
  });

  it('NO AUTO-WRITE — the notice does NOT create kickoff.md (Direction A REJECTED)', () => {
    // Falsifier for the rejected "synthesize plan" smell: only a notice is emitted.
    const root = makeSandbox();
    makeMissingKickoffUmbrella(root, 'legacy-umbrella');
    const wavePlan = writeWavePlan(root, '| legacy-umbrella | shipped | #42 |\n');

    runHelper(root, wavePlan);
    expect(
      existsSync(
        join(root, '.claude/orchestrator-prompts/legacy-umbrella/kickoff.md'),
      ),
    ).toBe(false);
  });

  it('CONTROL — umbrella WITH kickoff.md never emits RECONSTRUCT-STUB (only kickoff=missing does)', () => {
    // Guards against the notice firing on present-kickoff umbrellas.
    const root = makeSandbox();
    makeKickoffUmbrella(root, 'present-umbrella');
    const wavePlan = writeWavePlan(root, '| present-umbrella | active | #99 |\n');

    const r = runHelper(root, wavePlan);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('present-umbrella');
    expect(r.stdout).not.toContain('RECONSTRUCT-STUB: present-umbrella');
  });

  it('WORD-BOUNDARY NEGATIVE — short name that is a SUBSTRING of an unrelated plan row → no false RECONSTRUCT-STUB', () => {
    // Targets the word-boundary grep (_rs_re): "ux" must NOT match "ux-improvements".
    const root = makeSandbox();
    makeMissingKickoffUmbrella(root, 'ux');
    const wavePlan = writeWavePlan(root, '# Wave plan\n\n| ux-improvements | active | #5 |\n');

    const r = runHelper(root, wavePlan);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('ux kickoff=missing');
    expect(r.stdout).not.toContain('RECONSTRUCT-STUB: ux ');
  });

  it('WORD-BOUNDARY POSITIVE — same short name AS a whole cell → RECONSTRUCT-STUB still fires', () => {
    // Paired positive: "ux" delimited by table pipes is a real plan-row reference.
    const root = makeSandbox();
    makeMissingKickoffUmbrella(root, 'ux');
    const wavePlan = writeWavePlan(root, '# Wave plan\n\n| ux | active | #6 |\n');

    const r = runHelper(root, wavePlan);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/RECONSTRUCT-STUB: ux /);
  });
});
