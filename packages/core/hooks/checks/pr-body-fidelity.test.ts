import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkPrBodyFidelity } from './pr-body-fidelity.ts';

const HEAD = 'a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0';

/** A complete, valid GO block — mutated per-test so each assertion kills one branch. */
const goSection = (o: { verdict?: string; sha?: string; basis?: string; round?: string; evidence?: string } = {}) =>
  [
    `FIDELITY: ${o.verdict ?? 'GO'}`,
    `Basis: ${o.basis ?? '.claude/orchestrator-prompts/u/kickoff.md'}`,
    `Round: ${o.round ?? '1'}`,
    `Audited-SHA: ${o.sha ?? HEAD}`,
    ...(o.evidence === undefined ? ['Evidence: packages/core/hooks/pre-push.ts:42'] : o.evidence ? [o.evidence] : []),
  ].join('\n');

const wrap = (section: string) => `## Summary\nx\n\n## Fidelity verdict\n\n${section}\n\n## Parked questions\nnone\n`;

describe('checkPrBodyFidelity — accept path', () => {
  it('passes a complete GO block whose SHA matches head', () => {
    expect(checkPrBodyFidelity({ body: wrap(goSection()), headSha: HEAD }).ok).toBe(true);
  });
  it('passes a 12+-char SHA prefix', () => {
    expect(checkPrBodyFidelity({ body: wrap(goSection({ sha: HEAD.slice(0, 12) })), headSha: HEAD }).ok).toBe(true);
  });
  it('passes with CRLF line endings (GitHub API bodies are CRLF)', () => {
    const body = wrap(goSection()).replace(/\n/g, '\r\n');
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(true);
  });
  it('passes skipped with rationale >=20 chars', () => {
    expect(checkPrBodyFidelity({ body: wrap('FIDELITY: skipped — docs-only change, no kickoff applies'), headSha: HEAD }).ok).toBe(true);
  });
  it('accepts an ASCII hyphen as the skipped separator', () => {
    expect(checkPrBodyFidelity({ body: wrap('FIDELITY: skipped - docs-only change, no kickoff applies'), headSha: HEAD }).ok).toBe(true);
  });
});

describe('checkPrBodyFidelity — section structure', () => {
  it('fails when the section is missing', () => {
    const r = checkPrBodyFidelity({ body: '## Summary\nx\n', headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/missing `## Fidelity verdict` section/);
  });
  it('fails when a second Fidelity section exists (first-wins would hide a later STOP)', () => {
    const body = `${wrap('FIDELITY: skipped — docs-only change, no kickoff applies')}\n## Fidelity verdict\nFIDELITY: STOP\n`;
    const r = checkPrBodyFidelity({ body, headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/exactly one is allowed/);
  });
  it('ignores HTML-commented content (a section that renders empty must not pass)', () => {
    const body = wrap('<!--\nFIDELITY: skipped — commented-out template default text\n-->');
    const r = checkPrBodyFidelity({ body, headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/no `FIDELITY: GO`/);
  });
  it('does not read past an H1 heading into unrelated body text', () => {
    const body = `## Fidelity verdict\n\n# Appendix\nFIDELITY: skipped — text that belongs to another section entirely\n`;
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(false);
  });
});

describe('checkPrBodyFidelity — verdict semantics', () => {
  it('fails a recorded REVISE even when the rest of the block is complete', () => {
    const r = checkPrBodyFidelity({ body: wrap(goSection({ verdict: 'REVISE' })), headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/non-GO FIDELITY verdict recorded/);
  });
  it('fails a recorded STOP even when the rest of the block is complete', () => {
    const r = checkPrBodyFidelity({ body: wrap(goSection({ verdict: 'STOP' })), headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/non-GO FIDELITY verdict recorded/);
  });
  it('fails when a skipped line is appended below a recorded REVISE (no neutralising by append)', () => {
    const body = wrap('FIDELITY: REVISE\nFIDELITY: skipped — auditor asked rework, deferring to a follow-up PR');
    const r = checkPrBodyFidelity({ body, headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/exactly one is allowed/);
  });
  it('fails when a round-2 GO is appended below the round-1 REVISE (replace, do not append)', () => {
    const body = wrap(`FIDELITY: REVISE\n\n${goSection({ round: '2' })}`);
    const r = checkPrBodyFidelity({ body, headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/exactly one is allowed/);
  });
  it('fails a lowercase verdict token (case-sensitive by design)', () => {
    const r = checkPrBodyFidelity({ body: wrap(goSection({ verdict: 'go' })), headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/malformed FIDELITY line/);
  });
  it('fails skipped with short rationale (template default stays red)', () => {
    const r = checkPrBodyFidelity({ body: wrap('FIDELITY: skipped — <fill>'), headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/>=20 chars/);
  });
});

describe('checkPrBodyFidelity — GO completeness', () => {
  it('fails GO whose Audited-SHA mismatches head (staleness guard)', () => {
    const r = checkPrBodyFidelity({ body: wrap(goSection({ sha: 'deadbeefdead' })), headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/does not match PR head/);
  });
  it('fails GO with no Audited-SHA line', () => {
    const body = wrap('FIDELITY: GO\nBasis: k.md\nRound: 1\nEvidence: src/a.ts:1');
    const r = checkPrBodyFidelity({ body, headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/Audited-SHA/);
  });
  it('fails GO without file:line evidence', () => {
    const r = checkPrBodyFidelity({ body: wrap(goSection({ evidence: '' })), headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/file:line evidence/);
  });
  it('does not accept the Basis path as evidence (vacuous-evidence guard)', () => {
    const r = checkPrBodyFidelity({ body: wrap(goSection({ basis: 'docs/spec.md:12', evidence: '' })), headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/other than `Basis:`/);
  });
  it('fails GO missing Basis and Round, reporting both', () => {
    const body = wrap(`FIDELITY: GO\nAudited-SHA: ${HEAD}\nEvidence: src/a.ts:1`);
    const r = checkPrBodyFidelity({ body, headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/Basis:/);
    expect(r.errors.join()).toMatch(/Round:/);
  });
  it('fails when headSha is empty (bin guards this, but the check must not pass a GO blind)', () => {
    const r = checkPrBodyFidelity({ body: wrap(goSection()), headSha: '' });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/does not match PR head \(empty\)/);
  });
});

describe('two-file contract: the shipped PR template matches the checker', () => {
  it('template ships exactly one `## Fidelity verdict` heading with the red-by-default line', () => {
    const tpl = readFileSync(
      fileURLToPath(new URL('../../../../.github/pull_request_template.md', import.meta.url)),
      'utf8',
    );
    const headings = tpl.split(/\r?\n/).filter((l) => /^##[ \t]+Fidelity verdict[ \t]*$/.test(l));
    expect(headings).toHaveLength(1);
    // The shipped default must FAIL the gate — an author has to write a real verdict.
    expect(checkPrBodyFidelity({ body: tpl, headSha: HEAD }).ok).toBe(false);
  });
});
