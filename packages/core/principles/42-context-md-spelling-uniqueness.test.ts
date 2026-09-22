/**
 * Principle 42 (sibling) — one CONTEXT.md spelling names one entry.
 *
 * Source: docs/superpowers/specs/2026-09-21-recap-wait-what-reuse-design.md D8 — «a
 *   deterministic test next to principle 42 asserting that one `_Operator says_` spelling
 *   belongs to exactly one entry (a second mapping of the same spelling turns it red)».
 *
 * Why a test: D8 has the agent append the operator's own spellings to an entry without asking,
 * and report the edit in one line of its answer. That line is not a detection layer, because
 * the operator may not read it (.claude/rules/attention-is-not-a-mechanism.md §1). A wrong
 * mapping becomes mechanically visible when two entries claim one spelling, and this test
 * fails on exactly that.
 *
 * Invariant: a spelling, compared case-insensitively, belongs to at most one entry, and an
 * entry has at most one `_Operator says_:` line. An entry's heading counts as one of its
 * spellings, so a spelling that is another entry's term name is a collision too.
 *
 * Parser parity with the only runtime reader of these lines, .claude/hooks/glossary-inject.sh
 * (its awk pass «Parse CONTEXT.md into term/word/definition records»): a `## ` line opens an
 * entry; the says payload loses one trailing period and every « and », is split on commas and
 * trimmed; a says-line above the first heading belongs to no entry; words match with `grep -i`.
 * The hook keeps only an entry's LAST says-line and drops the rest silently, so a second line
 * is a violation here. Stricter than the hook in two places. It still counts the spellings of
 * an entry that has no `**Term**:` definition, which the hook skips. And it counts each heading
 * as a spelling, which the hook never matches: a says-word that names another entry's term
 * would inject the wrong definition whenever the operator uses that term's name.
 *
 * OUT OF SCOPE — whether a mapping is right. D8 records that limit and names the PR diff as
 * its review surface. Absence of CONTEXT.md is a valid state: the real-tree arms skip and the
 * detector arms run on inline fixtures, the mold of principle 42's pointer rule.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const CONTEXT_MD = resolve(REPO_ROOT, 'CONTEXT.md');
const CONTEXT_MD_PRESENT = existsSync(CONTEXT_MD);

/** One spelling as one entry claims it: the entry's term, the spelling as written, its line. */
interface Spelling {
  term: string;
  spelling: string;
  line: number;
}

interface ParsedGlossary {
  spellings: Spelling[];
  repeatedSaysLines: string[];
}

const HEADING_RE = /^## (.*)$/;
const SAYS_RE = /^_Operator says_:[ ]?(.*)$/;

/** The comparison key. The hook matches with `grep -i`, so case never separates spellings. */
const normalizeSpelling = (raw: string): string => raw.trim().toLowerCase();

/** The hook's payload rule: one trailing period and every « and » go, then split and trim. */
const splitSays = (payload: string): string[] =>
  payload
    .replace(/\.$/, '')
    .replace(/[«»]/g, '')
    .split(',')
    .map((w) => w.trim())
    .filter((w) => w !== '');

function parseSpellings(src: string): ParsedGlossary {
  const spellings: Spelling[] = [];
  const repeatedSaysLines: string[] = [];
  const lines = src.split('\n');
  let term = '';
  let saysLines = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = i + 1;
    const heading = HEADING_RE.exec(lines[i]);
    if (heading) {
      term = heading[1].trim();
      saysLines = 0;
      if (term !== '') spellings.push({ term, spelling: term, line });
      continue;
    }
    const says = SAYS_RE.exec(lines[i]);
    if (!says || term === '') continue;
    saysLines += 1;
    if (saysLines > 1) {
      repeatedSaysLines.push(
        `CONTEXT.md:${line} entry '${term}' has a second _Operator says_: line — ` +
          'the glossary hook keeps only the last one; merge both into one line',
      );
    }
    for (const w of splitSays(says[1])) spellings.push({ term, spelling: w, line });
  }
  return { spellings, repeatedSaysLines };
}

function crossEntryDuplicates(spellings: Spelling[]): string[] {
  const byKey = new Map<string, Spelling[]>();
  for (const s of spellings) {
    const key = normalizeSpelling(s.spelling);
    byKey.set(key, [...(byKey.get(key) ?? []), s]);
  }
  const out: string[] = [];
  for (const [key, claims] of byKey) {
    const terms = [...new Set(claims.map((c) => c.term))];
    if (terms.length < 2) continue;
    const where = claims.map((c) => `'${c.term}' (CONTEXT.md:${c.line})`).join(', ');
    out.push(`spelling '${key}' is claimed by ${terms.length} entries: ${where}`);
  }
  return out;
}

function spellingViolations(src: string): string[] {
  const { spellings, repeatedSaysLines } = parseSpellings(src);
  return [...repeatedSaysLines, ...crossEntryDuplicates(spellings)];
}

/** An inline glossary: a title line, then the given lines verbatim. */
const glossary = (...lines: string[]) => ['# CONTEXT — fixture', '', ...lines].join('\n');

describe('Principle 42 (sibling) — one CONTEXT.md spelling names one entry', () => {
  it.skipIf(!CONTEXT_MD_PRESENT)('the real CONTEXT.md maps every spelling to one entry', () => {
    const violations = spellingViolations(readFileSync(CONTEXT_MD, 'utf8'));
    expect(
      violations,
      'a spelling claimed by two entries is a wrong mapping (reuse spec D8): remove it from ' +
        'the entry it does not belong to, or ask the operator which meaning they intend',
    ).toEqual([]);
  });

  it.skipIf(!CONTEXT_MD_PRESENT)('sentinel: the parser reads every entry and its spellings', () => {
    const src = readFileSync(CONTEXT_MD, 'utf8');
    const headings = src.split('\n').filter((l) => HEADING_RE.test(l)).length;
    const { spellings } = parseSpellings(src);
    expect(headings).toBeGreaterThan(0);
    expect(new Set(spellings.map((s) => s.term)).size).toBe(headings);
    expect(spellings.length).toBeGreaterThan(headings);
  });

  it('flags one spelling claimed by two entries, naming both', () => {
    const v = spellingViolations(
      glossary('## Harvest', '_Operator says_: «харвест».', '## Handoff', '_Operator says_: «харвест», «хендофф».'),
    );
    expect(v).toHaveLength(1);
    for (const name of ["'харвест'", "'Harvest'", "'Handoff'"]) expect(v[0]).toContain(name);
  });

  it('compares case-insensitively, as the hook matches', () => {
    const v = spellingViolations(
      glossary('## Harvest', '_Operator says_: «хеверст».', '## Handoff', '_Operator says_: «Хеверст».'),
    );
    expect(v).toHaveLength(1);
  });

  it('strips the guillemets and the trailing period before comparing', () => {
    const v = spellingViolations(
      glossary('## Vendor', '_Operator says_: «вендорить».', '## Egress', '_Operator says_: вендорить'),
    );
    expect(v).toHaveLength(1);
  });

  it("treats an entry's heading as one of its spellings", () => {
    const v = spellingViolations(
      glossary('## Land', '_Operator says_: «приземлить».', '## Harvest', '_Operator says_: land'),
    );
    expect(v).toHaveLength(1);
    expect(v[0]).toContain("'land'");
  });

  it('flags a second _Operator says_ line in one entry', () => {
    const { repeatedSaysLines } = parseSpellings(
      glossary('## Harvest', '_Operator says_: «харвест».', '', '_Operator says_: «хервест».'),
    );
    expect(repeatedSaysLines).toHaveLength(1);
    expect(repeatedSaysLines[0]).toContain("'Harvest'");
  });

  it('passes distinct spellings across entries', () => {
    const src = glossary('## Harvest', '_Operator says_: harvest, «харвест».', '## Handoff', '_Operator says_: handoff.');
    expect(spellingViolations(src)).toEqual([]);
  });

  it('passes a spelling repeated inside its own entry (heading plus says-line)', () => {
    expect(spellingViolations(glossary('## Harvest', '_Operator says_: Harvest, «харвест».'))).toEqual([]);
  });

  it('ignores a says-line above the first heading, as the hook does', () => {
    const v = spellingViolations(glossary('_Operator says_: «харвест».', '## Harvest', '_Operator says_: «харвест».'));
    expect(v).toEqual([]);
  });
});
