// Triage-rubric per-axis label parity — the sync gate for reviewer-discipline.md §6.1.
//
// §6.1 deploys a three-axis triage rubric whose value is entirely in its PROVENANCE labels
// (`layer` corpus-measured / `whose` judgment-only / class a measured null). Those labels are
// restated at every run-moment seat that grades findings. Recorded as triage-kernel-v2 S5
// watch-list W-2: a future re-bench that DEMOTES an axis in §6.1 would leave the consumer
// seats asserting a revoked label, and nothing mechanical noticed.
//
// This check closes that hole from both sides. CANONICAL_LABELS is the tripwire: it must hold
// in the rule's own §6.1 block AND in every consumer that points at §6.1. Edit §6.1's labels
// without sweeping the consumers (or vice versa) and this goes RED.
//
// Two measured design choices, not stylistic ones:
//  - Consumers are enumerated DYNAMICALLY (git-tracked `.claude/skills/**` + `agents/*.md`
//    referencing §6.1), so a new seat is covered the moment it lands — no static list to
//    forget, mirroring the principle-09 `enumerateFlatRequiredDocs` pattern.
//  - Matching is whitespace-NORMALIZED because it has to be: `.claude/skills/reviewer/SKILL.md`
//    wraps «judgment-only, not / corpus-validated» across a line break, so a naive substring
//    grep false-REDs on a fully-compliant file (measured 2026-08-17, 6/6 files pass normalized).
//
// Class B compensating mechanism, same shape + placement as the seat-lifecycle pointer check in
// this directory; promotion to a principle slot is unwarranted until an axis actually demotes.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');

const RULE = '.claude/rules/reviewer-discipline.md';

/** The per-axis provenance labels §6.1 deploys. Changing §6.1 MUST change this list. */
const CANONICAL_LABELS = [
  'corpus-measured', // layer — the one axis the S4 bench cleared
  'judgment-only, not corpus-validated', // whose — travels with this label whatever it scores
  'measured null', // class — does-not-ship
  'class bar', // ...and the recorded grade stays the bar
] as const;

/** Collapse every whitespace run to one space — consumers wrap labels across lines. */
const norm = (s: string) => s.replace(/\s+/g, ' ');

const read = (rel: string) => norm(readFileSync(join(REPO_ROOT, rel), 'utf8'));

/** Git-tracked markdown at the two run-moment seat roots. */
function trackedSeatDocs(): string[] {
  const out = execFileSync(
    'git',
    ['ls-files', '-z', '--', '.claude/skills/**/*.md', 'agents/*.md'],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  return out.split('\0').filter(Boolean);
}

/** A consumer restates §6.1's labels at its own run moment: it cites the rule AND the section. */
function rubricConsumers(): string[] {
  return trackedSeatDocs().filter((f) => {
    if (f === RULE) return false;
    const body = read(f);
    return body.includes('reviewer-discipline.md') && body.includes('§6.1');
  });
}

/** §6.1 alone — from its heading to the next `## `, so a stray token elsewhere cannot satisfy it. */
function ruleSection61(): string {
  const body = read(RULE);
  const start = body.indexOf('### §6.1');
  expect(start, `${RULE} lost its "### §6.1" heading`).toBeGreaterThan(-1);
  const rest = body.slice(start + 8);
  const end = rest.indexOf('## ');
  return end === -1 ? rest : rest.slice(0, end);
}

describe('triage-rubric label parity (reviewer-discipline.md §6.1, W-2 sync gate)', () => {
  it('§6.1 itself declares every canonical per-axis label', () => {
    const section = ruleSection61();
    for (const label of CANONICAL_LABELS) {
      expect(
        section,
        `§6.1 no longer carries "${label}" — if an axis was re-benched, update CANONICAL_LABELS and sweep every consumer`,
      ).toContain(label);
    }
  });

  it('enumerates the run-moment consumers non-vacuously', () => {
    // 5 as of 2026-08-17: reviewer + pipeline skills, reviewer-discipline + fidelity-auditor +
    // review-sidecar agents. A lower count means the enumerator broke, not that a seat is clean.
    expect(rubricConsumers().length).toBeGreaterThanOrEqual(5);
  });

  for (const file of rubricConsumers()) {
    it(`${file} carries §6.1's labels verbatim`, () => {
      const body = read(file);
      for (const label of CANONICAL_LABELS) {
        expect(
          body,
          `${file} points at §6.1 but omits "${label}" — an un-labelled axis reads as validated`,
        ).toContain(label);
      }
    });
  }

  it('paired negative: a consumer missing one label fails the predicate', () => {
    const missingWhose = norm(
      'Triage rubric (reviewer-discipline.md §6.1): layer is corpus-measured, class a measured null (the recorded grade stays the class bar).',
    );
    expect(missingWhose).not.toContain('judgment-only, not corpus-validated');
    // ...and the wrapped-label shape the normalizer exists for DOES pass.
    expect(norm('`whose` is `judgment-only, not\ncorpus-validated`')).toContain(
      'judgment-only, not corpus-validated',
    );
  });
});
