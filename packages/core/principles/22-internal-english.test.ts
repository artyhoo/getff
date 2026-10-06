/**
 * Principle 22 — Internal machinery is English-only.
 *
 * Source: .claude/rules/language-discipline.md + spec
 *   docs/superpowers/specs/2026-06-16-language-discipline-design.md (2026-06-16).
 *
 * Invariant (3-category model §1 of the rule):
 *  - Category 1 (internal machinery): English ALWAYS. Hard-fail any Cyrillic in
 *    machinery shell scripts (hooks/skills/scripts) outside `lang/` packs, and in
 *    SKILL.md BODIES (after frontmatter) outside the match-data allowlist.
 *  - Category 2 (human-facing) lives in lang/ packs or model prose — not checked here.
 *  - Category 3 (match-data: trigger-words, question/decision phrases) — allowed in
 *    frontmatter descriptions, in lang/ packs, and in the allowlist below.
 *
 * Low-FP by construction: machinery `.sh` after cleanup is RU-free; SKILL.md bodies
 * are RU-free except pipeline (match-data). FP-prone surfaces (rule files with
 * verbatim maintainer quotes; references match-data) are intentionally NOT scanned —
 * covered by the companion rule's prose.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const CYRILLIC = /[Ѐ-ӿ]/;

// SKILL.md bodies that legitimately carry Cyrillic match-data (category 3).
export const SKILL_BODY_RU_ALLOWLIST = [
  '.agents/procedures/pipeline/SKILL.md',
  '.claude/skills/pipeline/SKILL.md', // decision-deferral phrases «выбирай сам / оба норм / я устал»
];

function tracked(...dirs: string[]): string[] {
  const out = execFileSync('git', ['ls-files', '-z', ...dirs], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return out.split('\0').filter(Boolean);
}

function cyrillicLines(relPath: string): { n: number; line: string }[] {
  const text = readFileSync(resolve(REPO_ROOT, relPath), 'utf8');
  const hits: { n: number; line: string }[] = [];
  text.split('\n').forEach((line, i) => {
    if (CYRILLIC.test(line)) hits.push({ n: i + 1, line: line.trim().slice(0, 100) });
  });
  return hits;
}

// Strip YAML frontmatter (leading --- ... ---) so trigger-words in `description:` are exempt.
function bodyOf(relPath: string): string {
  const text = readFileSync(resolve(REPO_ROOT, relPath), 'utf8');
  const m = text.match(/^---\n[\s\S]*?\n---\n/);
  return m ? text.slice(m[0].length) : text;
}

describe('Principle 22 — internal machinery is English-only', () => {
  it('Surface 1: no Cyrillic in machinery shell scripts (outside lang/ packs)', () => {
    const files = tracked('.agents/hooks', '.agents/procedures', '.claude/hooks', '.claude/skills', 'scripts').filter(
      (f) => f.endsWith('.sh') && !/\/lang\/[^/]+\.sh$/.test(f),
    );
    const violations = files
      .map((f) => ({ f, hits: cyrillicLines(f) }))
      .filter((x) => x.hits.length > 0);
    expect(
      violations,
      `Cyrillic in machinery shell:\n${violations
        .map((v) => `${v.f}:\n  ${v.hits.map((h) => `${h.n}: ${h.line}`).join('\n  ')}`)
        .join('\n')}`,
    ).toHaveLength(0);
  });

  it('Surface 2: no Cyrillic in SKILL.md bodies (outside frontmatter + allowlist)', () => {
    const files = tracked('.agents/procedures', '.claude/skills').filter(
      (f) => /\/SKILL\.md$/.test(f) && !SKILL_BODY_RU_ALLOWLIST.includes(f),
    );
    const violations = files.filter((f) => CYRILLIC.test(bodyOf(f)));
    expect(
      violations,
      `Cyrillic in SKILL.md body (translate to English or allowlist if match-data):\n${violations.join('\n')}`,
    ).toHaveLength(0);
  });

  it('mutation: the Cyrillic detector is not vacuous (anti-tautology)', () => {
    expect(CYRILLIC.test('plain english only')).toBe(false);
    expect(CYRILLIC.test('contains затирание russian')).toBe(true);
  });
});
