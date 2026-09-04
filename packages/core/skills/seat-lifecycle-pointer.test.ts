// Seat-lifecycle pointer check — the Class-B compensating mechanism for
// .claude/rules/seat-lifecycle.md (autonomous-night v3 §3, D-v3.2).
//
// The SLP is one SSOT with four pointer blocks: every skill of the four-skill seat
// architecture (arch, pipeline, dispatcher, night-mode) must LINK to the rule, never
// restate it (#parallel-evolution-creep counter). This check asserts (a) all four
// SKILL.md files carry the pointer, and (b) the rule's `paths:` frontmatter names
// exactly those four files — so the read-time channel and the pointer set cannot
// drift apart. Promotion criterion (≥2 phase-skipped incidents in 6 months → principle
// test) lives in the rule's §3; until then this stays a plain suite test by design.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');

const SEAT_SKILLS = ['arch', 'pipeline', 'dispatcher', 'night-mode'] as const;
const POINTER = /rules\/seat-lifecycle\.md/;

describe('seat-lifecycle pointer (SLP compensating check, autonomous-night v3 §3)', () => {
  for (const name of SEAT_SKILLS) {
    it(`${name}/SKILL.md carries the seat-lifecycle pointer`, () => {
      const body = readFileSync(join(REPO_ROOT, `.claude/skills/${name}/SKILL.md`), 'utf8');
      expect(body).toMatch(POINTER);
    });
  }

  it('rule paths: frontmatter names exactly the four seat-architecture SKILL.md files', () => {
    const rule = readFileSync(join(REPO_ROOT, '.claude/rules/seat-lifecycle.md'), 'utf8');
    const fm = rule.match(/^---\n([\s\S]*?)\n---/);
    expect(fm).not.toBeNull();
    const declared = [...fm![1].matchAll(/-\s*"?(\.claude\/skills\/[^"\n]+\/SKILL\.md)"?/g)].map(
      (m) => m[1],
    );
    expect(declared.sort()).toEqual(
      SEAT_SKILLS.map((n) => `.claude/skills/${n}/SKILL.md`).sort(),
    );
  });

  it('paired negative: a body without the link fails the pointer predicate', () => {
    expect(POINTER.test('## Seat lifecycle\nsome prose with no link at all')).toBe(false);
  });
});
