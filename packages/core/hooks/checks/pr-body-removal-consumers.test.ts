/**
 * pr-body-removal-consumers.test.ts — paired positive/negative tests for the
 * `## Removal consumers` PR-body gate (.claude/rules/build-first-reuse-default.md §3.1).
 *
 * Origin: 2026-09-28 one-button round 2 — a proposal to drop the AIF passport files
 * went to «confirm the table» with no consumer map, while install.sh detected the
 * stack from the PRESENCE of `ARCHITECTURE.react-*.md` and 16 AIF skills read the
 * files. The gate under test demands that map in the PR body whenever a PR deletes
 * a shipped file. All inputs are strings — no git subprocess.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { stripHtmlComments } from '../utils/markdown-comments.ts';
import {
  checkRemovalConsumers,
  shippedRemovals,
} from './pr-body-removal-consumers.ts';

const TPL = 'packages/core/templates/shared/tier-home.md';
const AIF = '.ai-factory/harness-model.json';

const del = (path: string) => ({ status: 'D', path });

const body = (section: string) =>
  `## Summary\n\nDrop a template.\n\n## Removal consumers\n\n${section}\n\n## Test plan\n\n- [x] tests\n`;

const GOOD_ROW =
  `| ${TPL} | \`setup.d/lib.sh:941\` presence check | drop: install skips the tier doc; slim: path kept |`;

const check = (b: string, entries: { status: string; path: string }[]) =>
  checkRemovalConsumers(b, entries, stripHtmlComments);

describe('shippedRemovals — population', () => {
  it('keeps only deletions under the shipped roots', () => {
    expect(
      shippedRemovals([
        del(TPL),
        del(AIF),
        del('docs/meta-factory/foo.md'),
        { status: 'M', path: 'packages/core/templates/shared/x.md' },
        { status: 'A', path: '.ai-factory/new.json' },
      ]),
    ).toEqual([TPL, AIF]);
  });

  it('a rename away from a shipped path is a removal of that name (--no-renames shape: D + A)', () => {
    expect(
      shippedRemovals([del(TPL), { status: 'A', path: 'packages/core/templates/shared/tier.md' }]),
    ).toEqual([TPL]);
  });

  it('a lookalike root outside the shipped trees does not count', () => {
    expect(shippedRemovals([del('packages/core/templates-old/x.md'), del('x/.ai-factory/y.json')])).toEqual([]);
  });
});

describe('checkRemovalConsumers — gate', () => {
  it('PR deleting no shipped file: passes with no section required', () => {
    const res = check('## Summary\n\nno section at all', [del('docs/x.md')]);
    expect(res.ok).toBe(true);
    expect(res.removed).toEqual([]);
  });

  it('NEGATIVE — shipped deletion, body without the section: FAILS', () => {
    const res = check('## Summary\n\nJust drop it, research says it is useless.', [del(TPL)]);
    expect(res.ok).toBe(false);
    expect(res.message).toContain('no `## Removal consumers` section');
  });

  it('POSITIVE — shipped deletion, row naming the path with a consumer file:line: passes', () => {
    const res = check(body(GOOD_ROW), [del(TPL)]);
    expect(res.ok).toBe(true);
  });

  it('POSITIVE — row may name the file by basename only', () => {
    const res = check(body('| tier-home.md | `install.sh:236` reads it | drop: breaks refresh |'), [del(TPL)]);
    expect(res.ok).toBe(true);
  });

  it('NEGATIVE — the template default `n/a` left in place: FAILS naming the path', () => {
    const res = check(body('n/a — no shipped file deleted'), [del(TPL)]);
    expect(res.ok).toBe(false);
    expect(res.missing).toEqual([TPL]);
  });

  it('NEGATIVE — row names the path but cites no consumer: FAILS', () => {
    const res = check(body(`| ${TPL} | nobody reads it, trust me | drop |`), [del(TPL)]);
    expect(res.ok).toBe(false);
    expect(res.missing).toEqual([TPL]);
  });

  it('NEGATIVE — citing the deleted file itself is not a consumer: FAILS', () => {
    const res = check(body(`| ${TPL} | \`${TPL}:1\` | drop |`), [del(TPL)]);
    expect(res.ok).toBe(false);
  });

  it('NEGATIVE — a row hidden inside an HTML comment does not count: FAILS', () => {
    const res = check(body(`<!-- ${GOOD_ROW} -->`), [del(TPL)]);
    expect(res.ok).toBe(false);
  });

  it('NEGATIVE — a row placed under another heading does not count: FAILS', () => {
    const b = `## Removal consumers\n\nn/a\n\n## Changes\n\n${GOOD_ROW}\n`;
    expect(check(b, [del(TPL)]).ok).toBe(false);
  });

  it('POSITIVE — explicit `no consumers — <≥20 chars>` escape on the path row: passes', () => {
    const res = check(
      body(`- ${AIF}: no consumers — git grep -n harness-model.json returns only this file`),
      [del(AIF)],
    );
    expect(res.ok).toBe(true);
  });

  it('NEGATIVE — escape with a short rationale: FAILS', () => {
    const res = check(body(`- ${AIF}: no consumers — none`), [del(AIF)]);
    expect(res.ok).toBe(false);
  });

  it('NEGATIVE — two deletions, only one mapped: FAILS listing the unmapped one', () => {
    const res = check(body(GOOD_ROW), [del(TPL), del(AIF)]);
    expect(res.ok).toBe(false);
    expect(res.missing).toEqual([AIF]);
  });
});

describe('checkRemovalConsumers — row identity (cold review 2026-10-01)', () => {
  const SK_A = 'packages/core/templates/shared/skill-context/aif-review/SKILL.md';
  const SK_B = 'packages/core/templates/shared/skill-context/aif-plan/SKILL.md';

  it('NEGATIVE — two deletions sharing a basename, one full-path row: FAILS for the other', () => {
    const res = check(body(`| ${SK_A} | \`install.sh:10\` | drop |`), [del(SK_A), del(SK_B)]);
    expect(res.ok).toBe(false);
    expect(res.missing).toEqual([SK_B]);
  });

  it('NEGATIVE — a shared basename alone identifies neither deletion: FAILS for both', () => {
    const res = check(body('| SKILL.md | `install.sh:10` | drop |'), [del(SK_A), del(SK_B)]);
    expect(res.missing).toEqual([SK_A, SK_B]);
  });

  it('POSITIVE — shared basename, one full-path row each: passes', () => {
    const rows = [SK_A, SK_B].map((p) => `| ${p} | \`install.sh:10\` | drop |`).join('\n');
    expect(check(body(rows), [del(SK_A), del(SK_B)]).ok).toBe(true);
  });

  it('NEGATIVE — a basename that is only a substring of another name does not match: FAILS', () => {
    const res = check(body('| index.md | `install.sh:10` | drop |'), [del('packages/core/templates/x.md')]);
    expect(res.ok).toBe(false);
  });

  it('NEGATIVE — citing another file deleted by the same PR is not a consumer: FAILS', () => {
    const X = 'packages/core/templates/x.md';
    const Y = 'packages/core/templates/y.md';
    const rows = `| ${X} | \`${Y}:3\` | drop |\n| ${Y} | \`${X}:3\` | drop |`;
    expect(check(body(rows), [del(X), del(Y)]).ok).toBe(false);
  });

  it('POSITIVE — an extensionless consumer path with a directory (.husky/pre-push:40) counts', () => {
    expect(check(body(`| ${TPL} | \`.husky/pre-push:40\` | drop |`), [del(TPL)]).ok).toBe(true);
  });

  it('NEGATIVE — a URL with a port is not a file:line citation: FAILS', () => {
    expect(check(body(`| ${TPL} | see http://example.com:8080 | drop |`), [del(TPL)]).ok).toBe(false);
  });
});

describe('checkRemovalConsumers — the shipped PR template default', () => {
  const template = readFileSync(
    fileURLToPath(new URL('../../../../.github/pull_request_template.md', import.meta.url)),
    'utf8',
  );

  it('carries the section heading the gate anchors on', () => {
    expect(template).toMatch(/^## Removal consumers$/m);
  });

  it('template left untouched on a PR with no shipped deletion: passes', () => {
    expect(check(template, [del('docs/x.md')]).ok).toBe(true);
  });

  it('NEGATIVE — template left untouched on a PR deleting a shipped file: FAILS (the example row lives in a comment)', () => {
    const res = check(template, [del(TPL)]);
    expect(res.ok).toBe(false);
    expect(res.missing).toEqual([TPL]);
  });
});
