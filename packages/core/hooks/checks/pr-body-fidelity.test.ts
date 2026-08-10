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

describe('checkPrBodyFidelity — section boundary (any heading closes it)', () => {
  it('does not borrow file:line evidence from a neighbouring §1.7 block', () => {
    const body = `## Fidelity verdict\nFIDELITY: GO\nBasis: docs/spec.md\nRound: 1\nAudited-SHA: ${HEAD}\n\n### §1.7 Forward-check applied\ncomplies with foo per packages/core/hooks/pre-push.ts:42\n`;
    const r = checkPrBodyFidelity({ body, headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/file:line evidence/);
  });
  it('is not confused by a FIDELITY line living under a later H3', () => {
    const body = `## Fidelity verdict\n${goSection()}\n\n### Appendix\nFIDELITY: REVISE\n`;
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(true);
  });
});

describe('checkPrBodyFidelity — skipped is unavailable to a stage PR', () => {
  const skipLine = 'FIDELITY: skipped — docs-only change, no kickoff applies';
  it('rejects skipped when Provenance declares a substrate', () => {
    const body = `## Provenance\n\n- Substrate: aif task 7f3a-1 + bridge-profile Z.AI GLM-5.2 SDK\n\n## Fidelity verdict\n${skipLine}\n`;
    const r = checkPrBodyFidelity({ body, headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/not available to a stage PR/);
  });
  it('allows skipped when Provenance is the unfilled template placeholder', () => {
    const body = `## Provenance\n\n<stage PRs: kickoff/spec path · base SHA · substrate>\n\n## Fidelity verdict\n${skipLine}\n`;
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(true);
  });
  it('allows skipped when Provenance is explicitly n/a', () => {
    const body = `## Provenance\n\nn/a — hotfix, no kickoff\n\n## Fidelity verdict\n${skipLine}\n`;
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(true);
  });
  it('allows skipped when there is no Provenance section at all', () => {
    expect(checkPrBodyFidelity({ body: `## Fidelity verdict\n${skipLine}\n`, headSha: HEAD }).ok).toBe(true);
  });
  it('still accepts a real GO on a stage PR', () => {
    const body = `## Provenance\n\n- Substrate: in-session, umbrella stage 3\n\n## Fidelity verdict\n${goSection()}\n`;
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(true);
  });
});

describe('checkPrBodyFidelity — stage detector cannot be decoyed', () => {
  const skipLine = 'FIDELITY: skipped — deliberately bypassing the stage gate';
  it('rejects skipped when a decoy placeholder Provenance precedes the real one', () => {
    const body = `## Provenance\n\n<stage PRs: placeholder>\n\n## Provenance\n\n- Substrate: aif task 42\n\n## Fidelity verdict\n${skipLine}\n`;
    const r = checkPrBodyFidelity({ body, headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/not available to a stage PR/);
  });
  it('rejects skipped when the real Provenance comes after the verdict section', () => {
    const body = `## Fidelity verdict\n${skipLine}\n\n## Provenance\n\n- Substrate: in-session, umbrella stage 2\n`;
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(false);
  });
});

describe('checkPrBodyFidelity — fenced blocks do not truncate the section', () => {
  it('reads Evidence that follows a fenced block containing a # comment', () => {
    const body = `## Fidelity verdict\nFIDELITY: GO\nBasis: docs/spec.md\nRound: 1\nAudited-SHA: ${HEAD}\n\n\`\`\`bash\n# regenerate baselines\nbash tests/install-sh/snapshot.sh\n\`\`\`\n\nEvidence: packages/core/hooks/pre-push.ts:42\n`;
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(true);
  });
  it('still closes the section on a real heading after a fenced block', () => {
    const body = `## Fidelity verdict\nFIDELITY: GO\nBasis: docs/spec.md\nRound: 1\nAudited-SHA: ${HEAD}\n\n\`\`\`bash\n# noise\n\`\`\`\n\n### §1.7 Forward-check applied\nper packages/core/hooks/pre-push.ts:42\n`;
    const r = checkPrBodyFidelity({ body, headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/file:line evidence/);
  });
});

describe('checkPrBodyFidelity — evidence exclusion is case-insensitive', () => {
  it('does not accept a lowercase basis: path as evidence', () => {
    const body = `## Fidelity verdict\nFIDELITY: GO\nbasis: docs/spec.md:12\nRound: 1\nAudited-SHA: ${HEAD}\n`;
    const r = checkPrBodyFidelity({ body, headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/other than `Basis:`/);
  });
});

describe('checkPrBodyFidelity — severity-contract arm (Failure-scenario in Review findings)', () => {
  const withFindings = (findings: string) =>
    `## Review findings\n\n${findings}\n\n## Fidelity verdict\n\n${goSection()}\n\n## Parked questions\nnone\n`;

  it('fails a MAJOR-graded entry without a Failure-scenario line', () => {
    const r = checkPrBodyFidelity({ body: withFindings('- MAJOR: cache key ignores locale (src/x.ts:42)'), headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/Failure-scenario/);
  });
  it('fails a BLOCKER-graded bare-line entry without a scenario', () => {
    const r = checkPrBodyFidelity({ body: withFindings('BLOCKER: gate never fires (pre-push.ts:10)'), headSha: HEAD });
    expect(r.ok).toBe(false);
  });
  it('passes when the scenario sits on the same line', () => {
    const body = withFindings('- MAJOR: cache key ignores locale (src/x.ts:42) — Failure-scenario: ru users get en prices');
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(true);
  });
  it('passes when the scenario is an indented sub-bullet of the entry', () => {
    const body = withFindings('- MAJOR: cache key ignores locale (src/x.ts:42)\n  - Failure-scenario: ru users get en prices');
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(true);
  });
  it('does not let one scenario cover a following scenario-less entry', () => {
    const body = withFindings(
      '- MAJOR: a (src/a.ts:1)\n  - Failure-scenario: concrete break\n- MAJOR: b (src/b.ts:2)',
    );
    const r = checkPrBodyFidelity({ body, headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(1);
  });
  it('ignores digit-led summary count lines', () => {
    const body = withFindings('round 1: 0 BLOCKER / 2 MAJOR / 3 MINOR — all fixed, r2 GO');
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(true);
  });
  it('exempts ESCALATED and MINOR entries', () => {
    const body = withFindings('- ESCALATED: value premise unrecorded → advisor\n- MINOR: typo in comment (src/y.ts:7)');
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(true);
  });
  it('is not satisfied by a Failure-scenario mention inside an HTML comment', () => {
    const body = withFindings('- MAJOR: a (src/a.ts:1)\n<!-- Failure-scenario: hidden -->');
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(false);
  });
  it('reports the arm error alongside the skipped path too', () => {
    const body = `## Review findings\n\n- MAJOR: a (src/a.ts:1)\n\n## Fidelity verdict\nFIDELITY: skipped — docs-only change, no kickoff applies\n`;
    const r = checkPrBodyFidelity({ body, headSha: HEAD });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/Failure-scenario/);
  });
});

describe('checkPrBodyFidelity — sidecar count lines are not findings', () => {
  const withFindings = (findings: string) =>
    `## Review findings\n\n${findings}\n\n## Fidelity verdict\n\n${goSection()}\n`;

  it('exempts the review-sidecar tally shape `- BLOCKER: 1` / `- MAJOR: 3`', () => {
    const body = withFindings('- BLOCKER: 1\n- MAJOR: 3\n- MINOR: 2');
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(true);
  });
  it('still gates a real finding whose text follows the colon', () => {
    const body = withFindings('- MAJOR: 3 retries silently swallowed (src/net.ts:12)');
    expect(checkPrBodyFidelity({ body, headSha: HEAD }).ok).toBe(false);
  });
});
