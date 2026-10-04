// Byte-identity gate for the three vendored `domain-modeling` texts (reuse spec D9: the whole
// body plus the two format files it links, one sha256 each). Sibling of grilling-vendored-body
// .test.ts, except that `domain-modeling` has headings of its own, so «the body heading is the
// last heading» cannot hold: the body is the prettier-ignore range after the body heading. It
// must NOT claim an upstream comparison — upstream lives in the operator's plugin cache, absent
// on CI, and each file's «Re-census trigger» owns that step.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REFS = resolve(HERE, '../../..', '.claude/skills/arch/references');
const BODY_HEADING = '## Upstream body (verbatim — do not edit)\n';
const START = '<!-- prettier-ignore-start -->\n';
const END = '<!-- prettier-ignore-end -->';

// Recorded 2026-09-22 from marketplace commit 9c9f36ccd3995266cd675468af71639c8dde1ec5:
// SKILL.md minus its 5-line frontmatter (`tail -n +6 | shasum -a 256`); the format files whole.
// `upstream` is the whole cached file, the value each file's «Re-census trigger» compares against.
const VENDORED = [
  { file: 'domain-modeling.md', sha: '6e49118599619a407f89024b4fc6435883f13728c95707a32136eacf8fe887ca', upstream: '9617041db9b0f6606ecf974e2061c83596b05059b5bb20ddb884c60f147c70e9', starts: '# Domain Modeling\n', links: ['CONTEXT-FORMAT.md', 'ADR-FORMAT.md'] },
  { file: 'CONTEXT-FORMAT.md', sha: 'b8cc318f2a4285b530e908b6bc43901c3c5cd11100362636bbc4216639bef597', upstream: 'b8cc318f2a4285b530e908b6bc43901c3c5cd11100362636bbc4216639bef597', starts: '# CONTEXT.md Format\n', links: [] },
  { file: 'ADR-FORMAT.md', sha: 'f1f36cd3f8d3b6474ddd5855da4e233bfc4ae1a1c5024909ccf11871819a41b2', upstream: 'f1f36cd3f8d3b6474ddd5855da4e233bfc4ae1a1c5024909ccf11871819a41b2', starts: '# ADR Format\n', links: [] },
] as const;

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const occurrences = (doc: string, needle: string) => doc.split(needle).length - 1;

/**
 * The extraction contract: the text between START (after the body heading) and the one blank
 * line before END. The blank line is wrapper, not body: without it an end marker that follows
 * a list item is read as part of that item, the ignore range never closes, and prettier rewrites
 * the upstream text (measured on ADR-FORMAT.md with prettier 3.8.3, 2026-09-23).
 */
function extractBody(doc: string): string {
  const s = doc.indexOf(START, doc.indexOf(BODY_HEADING));
  const e = doc.indexOf(END, s);
  if (doc.indexOf(BODY_HEADING) === -1 || s === -1 || e === -1) throw new Error('body heading or markers absent');
  const range = doc.slice(s + START.length, e);
  if (!range.endsWith('\n\n')) throw new Error('no blank line before the end marker');
  return range.slice(0, -1);
}

describe.each(VENDORED)('vendored domain-modeling text $file matches its pin', ({ file, sha, upstream, starts, links }) => {
  const path = join(REFS, file);
  const doc = existsSync(path) ? readFileSync(path, 'utf8') : '';

  it('the body heading and each marker occur once, in that order', () => {
    for (const needle of [BODY_HEADING, START, END]) expect(occurrences(doc, needle), needle).toBe(1);
    expect(doc.indexOf(BODY_HEADING)).toBeLessThan(doc.indexOf(START));
    expect(doc.indexOf(START)).toBeLessThan(doc.indexOf(END));
  });

  it('nothing but one newline follows the body', () => {
    expect(doc.slice(doc.indexOf(END) + END.length)).toBe('\n');
  });

  it('the body is the upstream text and hashes to the pin', () => {
    expect(extractBody(doc).startsWith(starts)).toBe(true);
    expect(sha256(extractBody(doc))).toBe(sha);
  });

  // The gate is only as good as the extraction boundary: an edit inside the body must reach the
  // hash, and an edit to the wrapper must not, or a reflowed provenance table would read as drift.
  it('the extraction boundary: a body edit changes the hash, a wrapper edit does not', () => {
    const at = doc.indexOf(starts) + 2;
    const bodyEdit = `${doc.slice(0, at)}X${doc.slice(at + 1)}`;
    expect(sha256(extractBody(bodyEdit))).not.toBe(sha);
    const wrapperEdit = doc.replace('## Provenance\n', '## Provenance (edited)\n');
    expect(wrapperEdit).not.toBe(doc);
    expect(sha256(extractBody(wrapperEdit))).toBe(sha);
  });

  it("the provenance table's two pins equal this test's constants", () => {
    expect(doc.match(/\|\s*Vendored body sha256\s*\|\s*`([0-9a-f]{64})`/)?.[1]).toBe(sha);
    expect(doc.match(/\|\s*Upstream file sha256\s*\|\s*`([0-9a-f]{64})`/)?.[1]).toBe(upstream);
  });

  // Fenced blocks are skipped: upstream's CONTEXT-FORMAT.md shows a sample CONTEXT-MAP.md whose
  // `./src/<context>/CONTEXT.md` links are example text, not links a renderer follows. The link
  // list is pinned per file, so a body with no links asserts that it has none rather than
  // passing on a loop that never ran.
  it('every relative link in the body resolves to a vendored sibling', () => {
    const prose = extractBody(doc).replace(/^```[^\n]*\n[\s\S]*?^```$/gm, '');
    const targets = [...prose.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]).filter((t) => !/^https?:/.test(t));
    expect(targets).toEqual(links.map((l) => `./${l}`));
    for (const l of links) expect(existsSync(join(REFS, l)), l).toBe(true);
  });
});
