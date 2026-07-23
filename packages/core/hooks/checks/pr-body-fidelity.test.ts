import { describe, expect, it } from 'vitest';
import { checkPrBodyFidelity } from './pr-body-fidelity.ts';

const HEAD = 'a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0';
const goBody = (sha: string) => `## Summary\nx\n\n## Fidelity verdict\n\nFIDELITY: GO\nBasis: .claude/orchestrator-prompts/u/kickoff.md\nRound: 1\nAudited-SHA: ${sha}\nEvidence: packages/core/hooks/pre-push.ts:42\n\n## Parked questions\nnone\n`;

describe('checkPrBodyFidelity', () => {
  it('passes a complete GO block whose SHA matches head', () => {
    expect(checkPrBodyFidelity({ body: goBody(HEAD), headSha: HEAD }).ok).toBe(true);
  });
  it('passes a 12+-char SHA prefix', () => {
    expect(checkPrBodyFidelity({ body: goBody(HEAD.slice(0, 12)), headSha: HEAD }).ok).toBe(true);
  });
  it('passes skipped with rationale >=20 chars', () => {
    const body = '## Fidelity verdict\nFIDELITY: skipped — docs-only change, no kickoff applies\n';
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(true);
  });
  it('fails when the section is missing', () => {
    const r = checkPrBodyFidelity({ body: '## Summary\nx\n', headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/section/i);
  });
  it('fails skipped with short rationale (template default stays red)', () => {
    const body = '## Fidelity verdict\nFIDELITY: skipped — <fill>\n';
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(false);
  });
  it('fails a recorded REVISE verdict', () => {
    const body = '## Fidelity verdict\nFIDELITY: REVISE\nBasis: k.md\nRound: 1\n';
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(false);
  });
  it('fails GO whose Audited-SHA mismatches head (staleness guard)', () => {
    expect(checkPrBodyFidelity({ body: goBody('deadbeefdead'), headSha: HEAD }).ok).toBe(false);
  });
  it('fails GO without file:line evidence', () => {
    const body = `## Fidelity verdict\nFIDELITY: GO\nBasis: k.md\nRound: 1\nAudited-SHA: ${HEAD}\n`;
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(false);
  });
});
