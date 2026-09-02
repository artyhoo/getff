import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stripHtmlComments } from './markdown-comments.ts';

/** The regex both PR-body gates used before this module existed. */
const legacyStrip = (text: string): string => text.replace(/<!--[\s\S]*?-->/g, '');

describe('stripHtmlComments — the original contract, unchanged', () => {
  it('removes a block comment', () => {
    expect(stripHtmlComments('a\n\n<!-- hidden -->\n\nb\n')).toBe('a\n\n\n\nb\n');
  });
  it('removes an inline comment and keeps the prose around it', () => {
    expect(stripHtmlComments('before <!-- c --> after\n')).toBe('before  after\n');
  });
  it('removes a multi-line comment', () => {
    expect(stripHtmlComments('x\n<!--\nFIDELITY: GO\n-->\ny\n')).toBe('x\n\ny\n');
  });
  it('returns a comment-free body byte-identical', () => {
    const body = '## Summary\n\ntext with `code` and\n\n```\nfenced\n```\n\n## End\n';
    expect(stripHtmlComments(body)).toBe(body);
  });
});

/**
 * Incident 2026-09-02 (PR #1575). `<!--` written inside code is literal text on
 * GitHub; the raw regex treated it as an opener and deleted everything up to the
 * next real `-->` — 6947 characters, including the `## Fidelity verdict` heading.
 */
describe('stripHtmlComments — a comment cannot start inside code', () => {
  const trailing = '\n\n## Fidelity verdict\n\nFIDELITY: GO\n\n<!-- template footer -->\n';

  it('an unbalanced opener in an INLINE code span leaves the rest of the body intact', () => {
    const body = `The shipped line is \`a/** --> <!-- inject: X\` verbatim.${trailing}`;
    const out = stripHtmlComments(body);
    expect(out).toContain('## Fidelity verdict');
    expect(out).toContain('FIDELITY: GO');
    expect(out).toContain('<!-- inject: X'); // literal text, still rendered by GitHub
    expect(out).not.toContain('template footer'); // the real comment still goes
  });

  it('an unbalanced opener in a FENCED block leaves the rest of the body intact', () => {
    const out = stripHtmlComments(`\`\`\`\na/** --> <!-- inject: X\n\`\`\`${trailing}`);
    expect(out).toContain('## Fidelity verdict');
    expect(out).toContain('<!-- inject: X');
  });

  it('an unbalanced opener in an INDENTED code block is literal too', () => {
    const out = stripHtmlComments(`    <!-- inject: X${trailing}`);
    expect(out).toContain('## Fidelity verdict');
  });

  it('the legacy regex really did swallow these — the arms above are not vacuous', () => {
    const body = `The shipped line is \`a/** --> <!-- inject: X\` verbatim.${trailing}`;
    expect(legacyStrip(body)).not.toContain('## Fidelity verdict');
  });
});

/**
 * The counter-direction. Making the stripper code-aware must not let anything that
 * used to be hidden from a gate become visible to it: a comment INSIDE code is still
 * a comment and is still removed — only its BOUNDARIES stop being negotiable.
 */
describe('stripHtmlComments — no hole is widened', () => {
  it('a balanced comment inside a fence is still removed', () => {
    const out = stripHtmlComments('```\n<!--\nFIDELITY: GO\n-->\n```\n');
    expect(out).not.toContain('FIDELITY: GO');
  });
  it('a balanced comment inside an inline code span is still removed', () => {
    expect(stripHtmlComments('see `<!-- x -->` here\n')).toBe('see `` here\n');
  });
  it('an unterminated opener in PROSE hides the rest, as CommonMark renders it', () => {
    // HTML block type 2 ends only at a line containing `-->`; with none, the block
    // runs to end of input. The legacy regex matched nothing and stripped nothing,
    // feeding the gate text GitHub does not display — the fail-OPEN direction.
    const body = '## Summary\n\n<!-- oops\n\n## Fidelity verdict\n\nFIDELITY: GO\n';
    expect(stripHtmlComments(body)).not.toContain('FIDELITY: GO');
    expect(legacyStrip(body)).toContain('FIDELITY: GO');
  });
  it('a bare `<!--` mid-paragraph is literal text and stays (CommonMark shows it)', () => {
    const body = 'before <!-- oops still one paragraph\n\nafter\n';
    expect(stripHtmlComments(body)).toBe(body);
  });
});

describe('stripHtmlComments — shapes the gates actually receive', () => {
  it('handles CRLF bodies (the GitHub API serves them)', () => {
    expect(stripHtmlComments('a\r\n\r\n<!-- hidden -->\r\n\r\nb\r\n')).toBe('a\r\n\r\n\r\n\r\nb\r\n');
  });
  it('strips several comments on one line', () => {
    expect(stripHtmlComments('<!-- a --> <!-- b -->\n')).toBe(' \n');
  });
  it('keeps text that follows a comment on the same line', () => {
    expect(stripHtmlComments('<!-- a --> tail\n')).toBe(' tail\n');
  });
  it('is idempotent', () => {
    const body = 'x `<!-- a` y\n\n<!-- real -->\n\n```\n<!-- z -->\n```\n';
    expect(stripHtmlComments(stripHtmlComments(body))).toBe(stripHtmlComments(body));
  });
});

/**
 * Positive control on live data: the shipped PR template is the body every author
 * starts from, so a regression there would hit every PR.
 */
describe('stripHtmlComments — the shipped PR template', () => {
  const template = readFileSync(
    fileURLToPath(new URL('../../../../.github/pull_request_template.md', import.meta.url)),
    'utf8',
  );

  it('agrees with the regex it replaces, byte for byte', () => {
    expect(stripHtmlComments(template)).toBe(legacyStrip(template));
  });
  it('keeps every `##` heading and removes every comment', () => {
    const out = stripHtmlComments(template);
    expect(out.match(/^## /gm)?.length).toBe(template.match(/^## /gm)?.length);
    expect(out).not.toContain('<!--');
  });
});
