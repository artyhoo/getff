/**
 * Principle 35 — ai-laziness-digest anti-drift (catalogue ↔ digest).
 *
 * CTX Stage 3 / D1b: the resident hot digest (.claude/rules/ai-laziness-digest.md)
 * carries every §2 T-number from the full catalogue (.claude/rules/ai-laziness-traps.md §2)
 * with a one-line counter. T-SG-B counter: the digest counter must be an EXACT QUOTE of
 * catalogue text, not a paraphrase — otherwise the digest silently drifts from the
 * catalogue and the resident digest becomes a stage-0 trust source (the exact failure
 * mode CTX Stage 0/1 exists to prevent).
 *
 * Mechanism: enumerate T-numbers from the catalogue at runtime (no hardcoded list —
 * adding a T-number to the catalogue MUST surface here, not be missed), parse each
 * T-block, and assert the digest carries a line for each T whose counter text is a
 * contiguous verbatim quote (>= MIN_QUOTE chars) from the catalogue's T-block. The
 * length floor excludes accidental short-phrase overlap; the contiguity requirement
 * rejects paraphrase.
 *
 * Paired-negative N35-1 (anti-tautology, mirrors principle 31's N31-* pattern): deleting
 * one digest line MUST make the check RED, proven on a fixture mutation. A check that
 * cannot fail is not a check (T-trap counter from principle 04 / T15).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const TRAPS_PATH = resolve(REPO_ROOT, '.agents/rules/ai-laziness-traps.md');
const DIGEST_PATH = resolve(REPO_ROOT, '.agents/rules/ai-laziness-digest.md');

/** Minimum length of a contiguous verbatim quote (post-normalisation) for a digest
 *  counter line to count as a non-paraphrase of the catalogue. 60 chars is well above
 *  any coincidental short-phrase overlap and below every T-counter's natural length. */
const MIN_QUOTE = 60;

/** Maximum resident digest size (D1b budget, spec §1.6 FORK B). */
const DIGEST_MAX_BYTES = 8192;

interface TEntry {
  num: string;
  block: string;
}

/** Normalise text for substring comparison: strip markdown emphasis/backticks, collapse
 *  whitespace. Preserves the meaningful characters so a verbatim quote matches even when
 *  the digest drops a `**` pair or shifts line wrapping. */
function norm(s: string): string {
  return s.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
}

/** Parse every T-number from §2 of ai-laziness-traps.md. Returns one TEntry per `### T<n>`
 *  heading with its full T-block (heading to next `### ` or `## ` heading boundary). */
function parseCatalogue(): TEntry[] {
  const src = readFileSync(TRAPS_PATH, 'utf8');
  const out: TEntry[] = [];
  // Match `### T<n>` heading + capture its block up to the next heading of level ≤ 3.
  const re = /(^|\n)(#{3})\s+(T\d+)\b[\s\S]*?(?=\n#{1,3}\s|\n##\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m[2] !== '###') continue;
    const num = m[3];
    // Block text spans from the heading line through to the boundary; include the body
    // minus the heading line itself for substring comparison.
    const block = m[0].replace(/^#{3}\s+T\d+[^\n]*\n/, '');
    out.push({ num, block });
  }
  return out;
}

/** Parse digest lines: returns Map<T-num, counter-text>. Each digest line has shape
 *  `- **T<n>** — <counter>`. Counter text is everything after the em-dash. */
function parseDigest(src?: string): Map<string, string> {
  const text = src ?? readFileSync(DIGEST_PATH, 'utf8');
  const out = new Map<string, string>();
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*-\s+\*\*(T\d+)\*\*\s+[—–-]\s+(.+)$/);
    if (m) out.set(m[1], m[2].trim());
  }
  return out;
}

/** Check one T-entry against the digest map. Returns [] on pass, error strings on fail. */
function checkTEntry(entry: TEntry, digestMap: Map<string, string>): string[] {
  const errs: string[] = [];
  const line = digestMap.get(entry.num);
  if (!line) {
    errs.push(`${entry.num}: missing from digest`);
    return errs;
  }
  const normLine = norm(line);
  const normBlock = norm(entry.block);
  if (normLine.length < MIN_QUOTE) {
    errs.push(`${entry.num}: digest line too short (${normLine.length} < ${MIN_QUOTE} chars) — not a discriminating quote`);
    return errs;
  }
  if (!normBlock.includes(normLine)) {
    errs.push(`${entry.num}: digest counter is not a verbatim contiguous quote from the catalogue T-block — anti-drift (T-SG-B).`);
    errs.push(`  digest (norm): "${normLine.slice(0, 120)}${normLine.length > 120 ? '...' : ''}"`);
  }
  return errs;
}

/** Size of the digest in UTF-8 BYTES — the unit `DIGEST_MAX_BYTES` is denominated in.
 *
 *  NOT `String.prototype.length`: that counts UTF-16 code units, so every non-ASCII
 *  character in the digest is under-counted (Cyrillic costs 2 bytes and 1 unit; an emoji
 *  costs 4 bytes and 2 units). The digest carries Cyrillic, so `.length` made the budget
 *  gate looser than it declared — 141 B looser as of 2026-08-07. Same idiom as
 *  `scripts/render-rule-index.mjs:199`. Found by the cold backward sweep behind arch-v2
 *  S-L (PR #1263 §6); the unit-binds-to-the-channel rule that names this class is
 *  `docs/meta-factory/research-patches/2026-08-07-s-l-recalculation.md` §1. */
function digestBytes(src: string): number {
  return Buffer.byteLength(src, 'utf8');
}

/** T19's counter must not state who merges — CLAUDE.md «Agent PR merge policy» owns that.
 *  The counter used to say «Merge» is the maintainer's decision while CLAUDE.md had agents
 *  merge their own staging PRs (operator directive 2026-09-10); both texts reach every
 *  session, so the contradiction was live (found 2026-09-28). The check: the counter (and
 *  its digest quote) points at the CLAUDE.md bullet, that bullet exists, and no sentence —
 *  with the pointer text itself removed, so sharing a sentence with the pointer is no
 *  shelter — pairs a merge verb («merge/merges/merging», or «land» with «PR») with a role
 *  (maintainer, operator, human, owner, agent). «merged» is not a merge verb: «revert a
 *  merged PR» states no authority. Agents count as a role so a restated copy of the policy
 *  itself («an agent merges its own staging PR») is rejected too — one source, CLAUDE.md. */
const MERGE_POLICY_POINTER = 'CLAUDE.md «Agent PR merge policy»';

function checkT19MergeAuthority(counter: string, digestLine: string, claudeMd: string): string[] {
  const errs: string[] = [];
  if (!/^- \*\*Agent PR merge policy\b/m.test(claudeMd)) {
    errs.push('CLAUDE.md has no «Agent PR merge policy» bullet — the T19 pointer is dead');
  }
  for (const [where, text] of [['catalogue T19 counter', counter], ['digest T19 line', digestLine]] as const) {
    if (!text.includes(MERGE_POLICY_POINTER)) {
      errs.push(`${where}: does not point to ${MERGE_POLICY_POINTER}`);
    }
    for (const sentence of text.split(/(?<=[.;])\s+/)) {
      const bare = sentence.split(MERGE_POLICY_POINTER).join('');
      const mergeVerb = /\bmerg(e|es|ing)\b/i.test(bare) || (/\bland(s|ing)?\b/i.test(bare) && /\bPRs?\b/.test(bare));
      if (mergeVerb && /\b(maintainers?|operators?|humans?|owners?|agents?)\b/i.test(bare)) {
        errs.push(`${where}: restates merge authority instead of pointing to CLAUDE.md: "${sentence.trim()}"`);
      }
    }
  }
  return errs;
}

function t19Counter(): string {
  const t19 = parseCatalogue().find((e) => e.num === 'T19');
  return t19?.block.split('\n').find((l) => l.startsWith('Counter:')) ?? '';
}

/** Check the entire digest against the catalogue. Accepts an optional mutated digest
 *  source for the paired-negative. */
function checkDigest(src?: string): string[] {
  const entries = parseCatalogue();
  if (entries.length === 0) return ['no T-numbers parsed from ai-laziness-traps.md §2'];
  const digestMap = parseDigest(src);
  return entries.flatMap((e) => checkTEntry(e, digestMap));
}

describe('Principle 35 — ai-laziness-digest anti-drift (catalogue ↔ digest)', () => {
  it('catalogue §2 enumerates a non-empty T-number population', () => {
    const entries = parseCatalogue();
    expect(entries.length).toBeGreaterThan(0);
  });

  it('every §2 T-number has a digest line whose counter is a verbatim quote (>= 60 chars) of the catalogue T-block', () => {
    const errs = checkDigest();
    expect(errs, `Anti-drift violations:\n${errs.join('\n')}`).toHaveLength(0);
  });

  it(`digest is ≤ ${DIGEST_MAX_BYTES} B (resident-set budget, spec §1.6 FORK B)`, () => {
    const bytes = digestBytes(readFileSync(DIGEST_PATH, 'utf8'));
    expect(bytes).toBeLessThanOrEqual(DIGEST_MAX_BYTES);
  });

  it('N35-2 — paired-negative: the budget is measured in BYTES, not UTF-16 units', () => {
    // Anti-regression for the 2026-08-07 defect: `.length` under-counted the digest by
    // 141 B, making the gate looser than its own name. A reversion to `.length` (or to
    // any code-unit measure) fails here — the two disagree on any non-ASCII input.
    const cyrillic = 'привет'; // 6 code units, 12 UTF-8 bytes
    expect(digestBytes(cyrillic)).toBe(12);
    expect(digestBytes(cyrillic)).not.toBe(cyrillic.length);
    // …and the real digest is non-ASCII, so the two measures must differ on it too —
    // otherwise this guard would be vacuous on the artefact it actually protects.
    const src = readFileSync(DIGEST_PATH, 'utf8');
    expect(digestBytes(src)).toBeGreaterThan(src.length);
  });

  describe('N35-3 — T19 defers merge authority to CLAUDE.md «Agent PR merge policy»', () => {
    const claudeMd = (): string => readFileSync(resolve(REPO_ROOT, 'CLAUDE.md'), 'utf8');
    // The pre-2026-09-28 counter ending, verbatim.
    const RETIRED = ' «Merge» is the maintainer\'s decision; «QA» is yours.';

    it('GREEN: the catalogue counter and its digest quote point to CLAUDE.md and restate nothing', () => {
      const digestLine = parseDigest().get('T19') ?? '';
      expect(t19Counter()).not.toBe('');
      expect(checkT19MergeAuthority(t19Counter(), digestLine, claudeMd())).toEqual([]);
    });

    it('RED: the retired «Merge is the maintainer\'s decision» counter is rejected', () => {
      const old = t19Counter().replace(/ «QA» is yours whoever merges;.*?(?= \*\(codifies)/, RETIRED);
      expect(old).toContain(RETIRED); // sanity: the rewrite fired
      const errs = checkT19MergeAuthority(old, old, claudeMd());
      expect(errs.some((e) => e.includes('restates merge authority'))).toBe(true);
      expect(errs.some((e) => e.includes('does not point to'))).toBe(true);
    });

    it('RED: a paraphrased merge claim next to the pointer is still rejected', () => {
      const counter = `${t19Counter()} Merging stays the operator's call.`;
      const errs = checkT19MergeAuthority(counter, counter, claudeMd());
      expect(errs.some((e) => e.includes("Merging stays the operator's call."))).toBe(true);
    });

    it('RED: other phrasings of a human merge role are rejected, even inside the pointer sentence', () => {
      const digestLine = parseDigest().get('T19') ?? '';
      for (const claim of [
        'Merging stays with the maintainers.',
        "Merging is the owner's call.",
        'Only the maintainer may land the PR.',
        `Merging stays with the maintainers per ${MERGE_POLICY_POINTER}.`,
        'An agent merges its own `base=staging` PR once CI is green.',
      ]) {
        const counter = `${t19Counter()} ${claim}`;
        const errs = checkT19MergeAuthority(counter, digestLine, claudeMd());
        expect(errs.some((e) => e.includes(claim)), claim).toBe(true);
      }
    });

    it('GREEN: a sentence that names a role and a merged PR without assigning who merges passes', () => {
      const digestLine = parseDigest().get('T19') ?? '';
      const counter = `${t19Counter()} The operator may still revert a merged PR.`;
      expect(checkT19MergeAuthority(counter, digestLine, claudeMd())).toEqual([]);
    });

    it('RED: a pointer to a CLAUDE.md bullet that no longer exists is rejected', () => {
      const digestLine = parseDigest().get('T19') ?? '';
      const gone = claudeMd().replace(/^- \*\*Agent PR merge policy\b/m, '- **Something else');
      expect(checkT19MergeAuthority(t19Counter(), digestLine, gone)).toContain(
        'CLAUDE.md has no «Agent PR merge policy» bullet — the T19 pointer is dead',
      );
    });
  });

  describe('N35-1 — paired-negative: deleting one digest line makes the check RED', () => {
    it('RED: digest with T1 removed produces a T1-missing error', () => {
      const src = readFileSync(DIGEST_PATH, 'utf8');
      const mutated = src
        .split('\n')
        .filter((l) => !/^\s*-\s+\*\*T1\*\*\s+[—–-]/.test(l))
        .join('\n');
      expect(mutated).not.toEqual(src); // sanity: filter actually removed a line
      const errs = checkDigest(mutated);
      const t1Missing = errs.some((e) => e.includes('T1: missing from digest'));
      expect(t1Missing, `expected T1-missing in:\n${errs.join('\n')}`).toBe(true);
    });

    it('RED: paraphrasing a counter (replace with novel wording) breaks the verbatim-quote invariant', () => {
      const src = readFileSync(DIGEST_PATH, 'utf8');
      const mutated = src.replace(
        /^\s*-\s+\*\*T1\*\*\s+[—–-].*$/m,
        '- **T1** — always sample many examples before declaring a category clean; the rule of thumb is at least a handful.',
      );
      expect(mutated).not.toEqual(src); // sanity: replace actually fired
      const errs = checkDigest(mutated);
      const t1Quote = errs.some((e) => e.includes('T1: digest counter is not a verbatim'));
      expect(t1Quote, `expected T1 verbatim-quote violation in:\n${errs.join('\n')}`).toBe(true);
    });

    it('positive control: the real digest passes (no mutation)', () => {
      expect(checkDigest()).toHaveLength(0);
    });
  });
});
