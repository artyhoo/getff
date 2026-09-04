/**
 * Principle 15 — Skill paired-negative (Commit B)
 *
 * Source: packages/core/principles/15-skill-paired-negative.design.md (Commit A, #105).
 * Origin: N2 #5 — ADAPT (idea, no dependency) of Superpowers' «NO SKILL WITHOUT A FAILING
 *   TEST FIRST» / RED-GREEN-REFACTOR for skill authoring, under maintainer DECISION=C.
 *   We re-express the paired-negative idea (principle 02, for code-rule artifacts) against
 *   the SKILL.md artifact. Substrate-pure: zero Superpowers dependency. SSOT #55.
 *
 * What it checks (structural-presence, like principle 09): each in-scope SKILL.md that is not
 *   grandfathered must carry a body-section paired-negative block (design §3) — both
 *   `## Without this skill` and `## With this skill`, each non-trivial, and the two halves
 *   differing (anti-tautology — mirrors principle 02's bad !== good at
 *   02-paired-negative-test.test.ts:80).
 *
 * Grandfather (design §5): an explicit EXEMPT_SKILLS allowlist — mirrors principle 09's
 *   EXEMPT_PATTERNS mechanism (an allowlist, NOT a date-cutoff). The 5 skills predating this
 *   principle (2026-05-21) are exempt until their next substantive touch; that "until next
 *   touch" property is manual, not git-enforced — the same honest limit principle 09 accepts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../');

/**
 * Grandfather allowlist — repo-root-relative POSIX paths of skills predating principle 15.
 * Exempt until next substantive touch. To de-grandfather: remove the path here and add the
 * paired-negative block to that SKILL.md.
 */
const EXEMPT_SKILLS: readonly string[] = [
  '.claude/skills/self-reflection/SKILL.md',
  '.claude/skills/template-audit/SKILL.md',
  '.claude/skills/tool-bootstrapping/SKILL.md',
  'skills/getff/SKILL.md',
  'skills/tool-bootstrapping/SKILL.md',
];

/**
 * Minimum meaningful content length for each half of the block. 40 chars = enough for a
 * minimal non-trivial sentence; rejects placeholder/empty content. (Principle 02 uses 5 for
 * inline rule examples; a skill's narrative section should carry more.)
 */
const MIN_SECTION_CHARS = 40;

const WITHOUT_HEADING = '## Without this skill';
const WITH_HEADING = '## With this skill';

/**
 * Extract the body text under an exact `## ` heading, up to the next `## ` heading or EOF.
 * Returns null if the heading is absent.
 */
function sectionBody(markdown: string, heading: string): string | null {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) return null;
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break; // next `## ` section terminates this one
    body.push(lines[i]);
  }
  return body.join('\n');
}

interface CheckResult {
  ok: boolean;
  reason?: string;
}

/**
 * A valid skill paired-negative block (body-section form, design §3): the SKILL.md body
 * contains BOTH `## Without this skill` and `## With this skill`, each with non-trivial
 * content, and the two halves differ (anti-tautology).
 */
export function checkPairedNegative(markdown: string): CheckResult {
  const without = sectionBody(markdown, WITHOUT_HEADING);
  const withh = sectionBody(markdown, WITH_HEADING);

  if (without === null) {
    return { ok: false, reason: `missing "${WITHOUT_HEADING}" section` };
  }
  if (withh === null) {
    return { ok: false, reason: `missing "${WITH_HEADING}" section` };
  }
  if (without.trim().length < MIN_SECTION_CHARS) {
    return { ok: false, reason: 'trivial: "Without" section content too short' };
  }
  if (withh.trim().length < MIN_SECTION_CHARS) {
    return { ok: false, reason: 'trivial: "With" section content too short' };
  }
  if (without.trim() === withh.trim()) {
    return { ok: false, reason: 'tautology: "Without" and "With" sections are identical' };
  }
  return { ok: true };
}

/** Per-skill scope decision: grandfathered → ok; else → checkPairedNegative on its content. */
export function evaluateSkill(
  relPath: string,
  content: string,
  exempt: readonly string[],
): CheckResult {
  if (exempt.includes(relPath)) return { ok: true };
  return checkPairedNegative(content);
}

/**
 * Tracked SKILL.md paths under the in-scope roots, or null if git is unavailable.
 * Git-aware so the audit matches the *tracked* surface: an installer-populated clone
 * carries gitignored `aif-*` skills (and may carry untracked rename orphans) that have
 * no paired-negative block by design — enumerating them filesystem-blind made principle 15
 * false-RED locally while green in CI (FQA S1-D F1). `git ls-files` returns only tracked
 * paths, so both gitignored and untracked SKILL.md are excluded. Falls back to null (→
 * filesystem enumeration) when git is absent, keeping the test runnable off-repo.
 */
function trackedSkillMds(roots: readonly string[]): Set<string> | null {
  try {
    const out = execFileSync('git', ['-C', REPO_ROOT, 'ls-files', '--', ...roots], {
      encoding: 'utf8',
    });
    return new Set(out.split('\n').filter((l) => l.endsWith('/SKILL.md')));
  } catch {
    return null; // git unavailable → caller falls back to filesystem enumeration
  }
}

/** Enumerate in-scope SKILL.md files (repo-root-relative POSIX paths). Zero glob dep. */
function enumerateSkills(): string[] {
  const roots = ['.claude/skills', 'skills'];
  const tracked = trackedSkillMds(roots);
  const found: string[] = [];
  for (const root of roots) {
    const abs = resolve(REPO_ROOT, root);
    if (!existsSync(abs)) continue;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const rel = `${root}/${entry.name}/SKILL.md`;
      if (!existsSync(resolve(REPO_ROOT, rel))) continue;
      // Git-aware skip: when git is available, only audit the tracked surface
      // (gitignored aif-* installer skills + untracked orphans are out of scope).
      if (tracked && !tracked.has(rel)) continue;
      found.push(rel);
    }
  }
  return found;
}

describe('Principle 15 — Skill paired-negative (body-section block per design §3)', () => {
  it('every in-scope SKILL.md is grandfathered or carries a valid paired-negative block', () => {
    const skills = enumerateSkills();
    expect(skills.length, 'expected to find in-repo SKILL.md files').toBeGreaterThan(0);
    const violations: string[] = [];
    for (const rel of skills) {
      const md = readFileSync(resolve(REPO_ROOT, rel), 'utf8');
      const res = evaluateSkill(rel, md, EXEMPT_SKILLS);
      if (!res.ok) violations.push(`${rel}: ${res.reason}`);
    }
    expect(violations, `Violations:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('grandfather: all listed EXEMPT_SKILLS still exist (surfaces renames/removals)', () => {
    const skills = new Set(enumerateSkills());
    for (const ex of EXEMPT_SKILLS) {
      expect(
        skills.has(ex),
        `exempt skill ${ex} no longer exists — update EXEMPT_SKILLS if renamed/removed`,
      ).toBe(true);
    }
  });

  // ---- self-test (recursive self-application, invariant #2 — design §6) ----
  // The principle demonstrates the paired-negative discipline it demands of skills.

  const POSITIVE = [
    '# Demo skill',
    '',
    WITHOUT_HEADING,
    'The agent guesses the marker format and writes a block that silently drifts over time.',
    '',
    WITH_HEADING,
    'The agent follows the documented body-section convention and the test mechanically enforces it.',
    '',
  ].join('\n');

  it('positive: a fixture skill WITH both sections + differing content passes', () => {
    expect(checkPairedNegative(POSITIVE).ok).toBe(true);
  });

  it('mutation 1a: removing "## Without this skill" fails (missing without)', () => {
    const mutated = POSITIVE.replace(WITHOUT_HEADING, '## Overview');
    const res = checkPairedNegative(mutated);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/missing.*Without/);
  });

  it('mutation 1b: removing "## With this skill" fails (missing with)', () => {
    const mutated = POSITIVE.replace(WITH_HEADING, '## Overview');
    const res = checkPairedNegative(mutated);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/missing.*With/);
  });

  it('mutation 2: identical "Without" and "With" content fails (tautology)', () => {
    const same = [
      '# Demo skill',
      '',
      WITHOUT_HEADING,
      'Exactly the same paragraph of well over forty characters here.',
      '',
      WITH_HEADING,
      'Exactly the same paragraph of well over forty characters here.',
      '',
    ].join('\n');
    const res = checkPairedNegative(same);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/tautology/);
  });

  it('mutation 3: exemption is load-bearing — same headerless skill passes IFF its path is in the allowlist', () => {
    const headerless = '# Bare skill\n\nNo paired-negative block here at all.\n';
    const p = 'skills/__synthetic_probe__/SKILL.md';
    // headerless content must fail the check on its own merits
    expect(checkPairedNegative(headerless).ok).toBe(false);
    // path IN the allowlist → exempt → passes
    expect(evaluateSkill(p, headerless, [p]).ok).toBe(true);
    // path ABSENT from the allowlist → checked → fails (exemption was the ONLY reason it passed)
    expect(evaluateSkill(p, headerless, []).ok).toBe(false);
  });
});
