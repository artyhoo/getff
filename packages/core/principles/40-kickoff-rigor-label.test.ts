/**
 * Principle 40 — every NEW kickoff declares its rigor label (effort-worthiness L0)
 *
 * Source: .claude/rules/effort-worthiness.md §2 L0 (the kickoff author declares
 *         `research-grade` or `build-and-verify`; "Presence = mechanical check")
 *         docs/superpowers/specs/2026-08-10-advisor-pattern-design.md §5.3 L3(d) + §8 item 6b
 *         (the named channel for L0 is the kickoff principle-test family — principle 12's
 *         pattern, which this test mirrors)
 *
 * Invariant: a kickoff added at or after the convention landed carries a line declaring
 * `Rigor label … L0 …` with one of the two legal values. Presence and legality are the
 * mechanical half; whether the label is HONEST (a research-grade contour labelled
 * build-and-verify to dodge rigor) is channel 2 — disputable via a materiality-dispute ask,
 * visible at morning review. The spec says exactly this and this test claims nothing more.
 *
 * SCOPING — why the ~330-kickoff back-catalog does not go red:
 * enforcement starts at the commit that landed the convention, `462f6ac9bb`
 * (2026-08-10T21:22+03:00, PR #1374 — the commit that added both effort-worthiness.md and
 * the advisor spec). A kickoff whose FIRST-ADD commit predates that instant is legacy: the
 * obligation did not exist when it was written. Everything added after is enforced.
 *
 * Why add-date and not an allowlist: the back-catalog is ~330 files and an allowlist that
 * size is stale the day it lands. Why add-date works HERE though principle 12 rejected a
 * date cutoff: principle 12 needed to distinguish files WITHIN the portability-migration
 * commit (identical dates, indistinguishable); this cutoff sits after that migration, so
 * the whole back-catalog falls on the legacy side by construction. Kickoffs are tracked
 * files (.gitignore un-ignores the per-umbrella `kickoff.md` and the stage globs) and the
 * CI job running this suite checks out with `fetch-depth: 0`, so the add date is in both
 * channels; where it is not (no git, no history), the gate SKIPS rather than guessing —
 * the detector's own correctness is covered by the pure-logic cases, which always run.
 *
 * Coverage limit, stated: an UNCOMMITTED kickoff has no add date and is out of population.
 * It enters the gate on the push that first carries it — pre-push runs after the commit,
 * which is the earliest reachable channel for a file that must be committed anyway.
 *
 * T15 self-application: this gate is itself a mechanism for a discipline about not spending
 * rigor where it buys nothing — it is a one-line presence check, not a corpus study.
 *
 * Zero paid LLM (.claude/rules/no-paid-llm-in-ci.md): git metadata + a regex.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  REPO_ROOT,
  getKickoffEntries,
  isCoordinationMirror,
  type KickoffEntry,
} from './kickoff-population.ts';

/**
 * The landing instant of the L0 obligation: commit 462f6ac9bb, which added
 * .claude/rules/effort-worthiness.md and the advisor-pattern spec (PR #1374).
 * Verify with: git log --diff-filter=A --format=%aI -- .claude/rules/effort-worthiness.md
 */
export const CONVENTION_LANDED_AT = Date.parse('2026-08-10T21:22:00+03:00');

/**
 * Legacy exemptions — kickoffs added after the cutoff that predate this GATE (the
 * convention was prose-only between 2026-08-10 and this test landing, which is exactly the
 * window `attention-is-not-a-mechanism.md` predicts things get missed in).
 *
 *  - 'triage-kernel-v2/kickoff-s3.md' — added 2026-08-16, no rigor line. Its six sibling
 *    stage kickoffs in the same umbrella DO carry one, so this is a single miss, not a
 *    contour that opted out; the umbrella closed 2026-08-17 (#1407), so the file will not
 *    be re-dispatched. Amnesty, not a free pass: any new kickoff is enforced, and editing
 *    this one does not re-exempt it — remove the entry instead.
 */
export const EXEMPT_LIST: readonly string[] = [
  'triage-kernel-v2/kickoff-s3.md',
];

const LEGAL_VALUES = ['research-grade', 'build-and-verify'] as const;

/** A line that DECLARES the label — "Rigor label" and the L0 marker on one line. */
const LABEL_LINE_RE = /Rigor label[^\n]*\bL0\b[^\n]*/;
const VALUE_RE = new RegExp(`\`?(${LEGAL_VALUES.join('|')})\`?`);

export type LabelVerdict =
  | { ok: true; value: string }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'illegal'; line: string };

/**
 * Both live phrasings are accepted — `Rigor label (L0):` and
 * `**Rigor label (effort-worthiness L0):**` are the two forms in use at gate-landing time,
 * and a gate that reds a compliant kickoff over asterisks teaches authors to route around
 * it. What is REQUIRED is a declaration line naming L0 and one of the two legal values on
 * that same line — a value mentioned elsewhere in the prose is discussion, not a label.
 */
export function rigorLabel(content: string): LabelVerdict {
  const line = content.match(LABEL_LINE_RE)?.[0];
  if (!line) return { ok: false, reason: 'missing' };
  const value = line.match(VALUE_RE)?.[1];
  return value
    ? { ok: true, value }
    : { ok: false, reason: 'illegal', line: line.trim() };
}

/** Repo-relative path → earliest add date (ms). Null when git history is unavailable. */
function addDates(): Map<string, number> | null {
  let out: string;
  try {
    out = execFileSync(
      'git',
      [
        'log',
        '--diff-filter=A',
        '--name-only',
        '--format=%x01%aI',
        '--',
        '.claude/orchestrator-prompts',
      ],
      { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    );
  } catch {
    return null; // no git, no history, or not a repo — skip rather than guess
  }
  const dates = new Map<string, number>();
  let current = Number.NaN;
  // %x01 marks a commit-header line; a path can never begin with it.
  const HEADER = '\u0001';
  for (const raw of out.split('\n')) {
    if (raw.startsWith(HEADER)) {
      current = Date.parse(raw.slice(1).trim());
      continue;
    }
    const path = raw.trim();
    if (!path || Number.isNaN(current)) continue;
    // git log walks newest → oldest; keep the EARLIEST add seen for a path.
    const prev = dates.get(path);
    if (prev === undefined || current < prev) dates.set(path, current);
  }
  return dates.size > 0 ? dates : null;
}

const ADD_DATES = addDates();

/** Kickoffs the L0 obligation applies to: post-cutoff, real (non-mirror), non-exempt. */
function enforcedEntries(): KickoffEntry[] {
  if (!ADD_DATES) return [];
  return getKickoffEntries().filter((e) => {
    if (EXEMPT_LIST.includes(e.label)) return false;
    if (isCoordinationMirror(e.path)) return false;
    const added = ADD_DATES.get(e.repoRelative);
    return added !== undefined && added >= CONVENTION_LANDED_AT;
  });
}

const GIT_DATES_AVAILABLE = ADD_DATES !== null;

describe('Principle 40 — new kickoffs declare a rigor label (effort-worthiness L0)', () => {
  it.skipIf(!GIT_DATES_AVAILABLE)(
    'every post-cutoff kickoff carries a legal rigor label',
    () => {
      const violations = enforcedEntries()
        .map((e) => ({ e, verdict: rigorLabel(readFileSync(e.path, 'utf8')) }))
        .filter(({ verdict }) => !verdict.ok)
        .map(({ e, verdict }) =>
          verdict.ok
            ? ''
            : verdict.reason === 'missing'
              ? `${e.label}: no 'Rigor label (L0):' line`
              : `${e.label}: label line carries no legal value — ${verdict.line}`,
        );
      expect(
        violations,
        'Kickoffs added after the effort-worthiness convention landed must declare\n' +
          '  Rigor label (L0): `research-grade` | `build-and-verify`\n' +
          `Violations:\n${violations.join('\n')}`,
      ).toEqual([]);
    },
  );

  it.skipIf(!GIT_DATES_AVAILABLE)(
    'the gate is non-vacuous — at least one real kickoff is actually being checked',
    () => {
      // A cutoff that drifts past the whole population, or a population resolver that
      // silently returns [], would make the check above pass by finding nothing. This is
      // the tripwire for that: it must fail the day the enforced set empties out, so the
      // maintainer re-reads the scoping rule instead of trusting a green.
      expect(
        enforcedEntries().length,
        'no kickoff is in scope — cutoff drift or a broken population resolver',
      ).toBeGreaterThan(0);
    },
  );

  it.skipIf(!GIT_DATES_AVAILABLE)(
    'anti-tautology: a compliant kickoff stripped of its label fails the check',
    () => {
      const entries = enforcedEntries();
      const compliant = entries.find(
        (e) => rigorLabel(readFileSync(e.path, 'utf8')).ok,
      );
      expect(
        compliant,
        'expected a compliant in-scope kickoff to mutate',
      ).toBeDefined();
      const stripped = readFileSync(compliant!.path, 'utf8').replace(
        /Rigor label/g,
        'REDACTED',
      );
      expect(rigorLabel(stripped)).toEqual({ ok: false, reason: 'missing' });
    },
  );

  it.skipIf(!GIT_DATES_AVAILABLE)(
    'exempt entries are not stale — each still exists in the kickoff population',
    () => {
      const all = getKickoffEntries().map((e) => e.label);
      if (all.length === 0) return; // fresh/partial checkout — nothing to reconcile
      for (const exempt of EXEMPT_LIST) {
        expect(
          all,
          `Exempt kickoff '${exempt}' is gone — stale EXEMPT_LIST entry, remove it.`,
        ).toContain(exempt);
      }
    },
  );

  it('detector: both live phrasings are accepted', () => {
    expect(
      rigorLabel('Rigor label (L0): `research-grade` (design §1).'),
    ).toEqual({
      ok: true,
      value: 'research-grade',
    });
    expect(
      rigorLabel(
        '> **Rigor label (effort-worthiness L0):** `research-grade` — shipped',
      ),
    ).toEqual({ ok: true, value: 'research-grade' });
    expect(
      rigorLabel('> Rigor label (L0): build-and-verify — no backticks needed'),
    ).toEqual({
      ok: true,
      value: 'build-and-verify',
    });
  });

  it('detector: absence and illegal values both fail, and are distinguishable', () => {
    expect(rigorLabel('')).toEqual({ ok: false, reason: 'missing' });
    expect(rigorLabel('# Kickoff\n\nA plan with no label at all.')).toEqual({
      ok: false,
      reason: 'missing',
    });
    // An invented tier must not pass — the vocabulary is exactly two values.
    expect(rigorLabel('Rigor label (L0): `medium`')).toEqual({
      ok: false,
      reason: 'illegal',
      line: 'Rigor label (L0): `medium`',
    });
  });

  it('detector: a legal value in prose does NOT satisfy the obligation', () => {
    // The declaration is a labelled line, not any mention of the word. Otherwise a kickoff
    // that merely discusses research-grade contours would pass without declaring anything.
    expect(
      rigorLabel(
        'This stage is not a research-grade contour, it is exploratory.',
      ),
    ).toEqual({ ok: false, reason: 'missing' });
    // …and a label line whose value sits on the NEXT line is a miss, not a pass.
    expect(rigorLabel('Rigor label (L0):\n`research-grade`')).toEqual({
      ok: false,
      reason: 'illegal',
      line: 'Rigor label (L0):',
    });
  });

  it('the cutoff is the convention-landing instant, not an arbitrary date', () => {
    // Pins the constant so a future edit that "just moves the date forward" to silence a
    // red has to argue with this assertion first.
    expect(CONVENTION_LANDED_AT).toBe(Date.parse('2026-08-10T21:22:00+03:00'));
    expect(Date.parse('2026-08-11T13:13:47+03:00')).toBeGreaterThan(
      CONVENTION_LANDED_AT,
    );
    expect(Date.parse('2026-08-10T00:19:13+03:00')).toBeLessThan(
      CONVENTION_LANDED_AT,
    );
  });
});
