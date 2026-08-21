/**
 * Principle 43 — every tracked kickoff declares a host-verify contract or an explicit opt-out
 *
 * Source: .claude/rules/destination-environment-verification.md §1 (the contract and its
 *         grammar), retrofitted over the whole corpus on 2026-08-21 (B1-B3): blanket
 *         legacy-closed opt-outs for closed umbrellas, individually adjudicated closed
 *         kickoffs, real contracts / honest per-class opt-outs for the open lane.
 *
 * Invariant: a tracked kickoff under .claude/orchestrator-prompts/** (kickoff.md AND the
 * stage-kickoff family — the same population principle 12/40 resolve via kickoff-population.ts)
 * is recognized by the SSOT runner: `bash scripts/host-verify.sh --list <path>` exits 0 (a
 * ```bash host-verify fence, or a valid ≥20-char `host-verify: none` opt-out). Exit 2 =
 * silent contract-absence — the exact state the rule exists to end. This test promotes the
 * edit-time gate (check-kickoff-traps.sh arm 1, fires only on touch) to a whole-population
 * CI channel: after the retrofit, NOTHING is exempt — a new kickoff without a contract is a
 * red from the moment it is pushed.
 *
 * Detection is NOT re-implemented here. Both contract extraction and opt-out recognition
 * live in scripts/host-verify.sh ("grammar lives in one place", rule §1); this test shells
 * out to the runner exactly like the edit-time gate does (#sync-by-copy-paste avoided,
 * dual-implementation-discipline.md §8).
 *
 * SCOPING — tracked files only (principle 40's posture): a gitignored stage kickoff (the
 * per-umbrella un-ignore globs in .gitignore deliberately exclude some) cannot ship a
 * contract to CI, so gating it would fail on local-only state. An UNCOMMITTED kickoff is
 * likewise out of population; it enters on the push that first carries it — pre-push runs
 * after the commit, the earliest reachable channel for a file that must be committed anyway.
 * Where git is unavailable, the gate SKIPS rather than guessing (pure-logic cases still run).
 *
 * T15 self-application: the retrofit this gate seals was measured by
 * scripts/kickoff-hv-inventory.sh (bulk-wave-filtered lanes), not by eyeballing a sample.
 * Zero paid LLM (.claude/rules/no-paid-llm-in-ci.md): git ls-files + one runner call per file.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  REPO_ROOT,
  getKickoffEntries,
  isCoordinationMirror,
  type KickoffEntry,
} from './kickoff-population.ts';

const RUNNER = join(REPO_ROOT, 'scripts/host-verify.sh');

/** The SSOT verdict for one kickoff file: exit 0 = contract/opt-out recognized. */
function runnerRecognizes(repoRelative: string): boolean {
  try {
    execFileSync('bash', [RUNNER, '--list', repoRelative], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

function trackedKickoffPaths(): Set<string> | null {
  let out: string;
  try {
    out = execFileSync(
      'git',
      ['ls-files', '--', '.claude/orchestrator-prompts'],
      { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    );
  } catch {
    return null; // no git — skip rather than guess (principle 40 posture)
  }
  return new Set(
    out
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  );
}

const TRACKED = trackedKickoffPaths();

/** In-scope entries: real (non-mirror), tracked kickoff-family files. */
function enforcedEntries(): KickoffEntry[] {
  if (!TRACKED) return [];
  return getKickoffEntries().filter(
    (e) => !isCoordinationMirror(e.path) && TRACKED.has(e.repoRelative),
  );
}

const GIT_AVAILABLE = TRACKED !== null;

describe('Principle 43 — every tracked kickoff declares a host-verify contract or opt-out', () => {
  it.skipIf(!GIT_AVAILABLE)('every tracked kickoff is recognized by the runner', { timeout: 120_000 }, () => {
    const violations = enforcedEntries()
      .filter((e) => !runnerRecognizes(e.repoRelative))
      .map((e) => e.label);
    expect(
      violations,
      'A kickoff under .claude/orchestrator-prompts must declare a ```bash host-verify\n' +
        '  fence or an explicit host-verify: none opt-out (≥20-char rationale).\n' +
        '  Silence is never a pass (destination-environment-verification.md §1).\n' +
        `Violations:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it.skipIf(!GIT_AVAILABLE)(
    'the gate is non-vacuous — the tracked kickoff population is non-empty',
    { timeout: 120_000 },
    () => {
      // A .gitignore drift or a broken population resolver would silently empty the
      // enforced set and make the check above pass by finding nothing.
      expect(
        enforcedEntries().length,
        'no tracked kickoff is in scope — population resolver or git state is broken',
      ).toBeGreaterThan(200); // 342 tracked family files at retrofit; a worktree misses none
    },
  );

  it('detector via SSOT runner: absence fails closed, fence and opt-out both pass', () => {
    const dir = join(tmpdir(), `p43-${process.pid}`);
    mkdirSync(dir, { recursive: true });
    const probe = join(dir, 'kickoff.md');
    try {
      writeFileSync(probe, '# KICKOFF\n\nNo contract at all.\n');
      expect(runnerRecognizesRaw(probe)).toBe(false);

      writeFileSync(
        probe,
        '# KICKOFF\n\n```bash host-verify\nmake self-audit\n```\n',
      );
      expect(runnerRecognizesRaw(probe)).toBe(true);

      writeFileSync(
        probe,
        '# KICKOFF\n\n<!-- host-verify: none — prose-only kickoff, no executable deliverable -->\n',
      );
      expect(runnerRecognizesRaw(probe)).toBe(true);

      // A too-short rationale is an INVALID opt-out, not a pass (rule §1: ≥20 chars).
      writeFileSync(probe, '# KICKOFF\n\n<!-- host-verify: none — short -->\n');
      expect(runnerRecognizesRaw(probe)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(!GIT_AVAILABLE)(
    'anti-tautology: stripping a compliant kickoff flips the verdict',
    { timeout: 120_000 },
    () => {
      const entry = enforcedEntries().find((e) =>
        runnerRecognizes(e.repoRelative),
      );
      expect(entry, 'expected a compliant in-scope kickoff to mutate').toBeDefined();
      // mutate OUTSIDE the population dir — a stranded copy must never litter
      // the real corpus even if an assertion fails mid-test
      const dir = join(tmpdir(), `p43-strip-${process.pid}`);
      mkdirSync(dir, { recursive: true });
      const stripped = join(dir, 'kickoff.md');
      try {
        const raw = readFileSync(entry!.path, 'utf8');
        // remove both declaration shapes — the two the runner recognizes
        writeFileSync(
          stripped,
          raw
            .replace(/```bash host-verify[\s\S]*?```/g, '```bash\n```')
            .replace(/<!-- host-verify: none[^>]*-->/g, ''),
        );
        expect(runnerRecognizesRaw(stripped)).toBe(false);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});

/** Raw-path variant of the SSOT verdict (temp fixtures outside the population globs). */
function runnerRecognizesRaw(absolutePath: string): boolean {
  try {
    execFileSync('bash', [RUNNER, '--list', absolutePath], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}
