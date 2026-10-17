// `rule-bootstrap-cli --check-plan` — the read-only arm the rule table reads (P5 A2).
//
// It answers «which research entries would the generator keep, which does it drop and why, and
// which kept entries have no generated rule» without writing anything, so dropped entries reach
// the table with no new record file.

import { describe, it, expect } from 'vitest';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkPlanFile } from './rule-bootstrap-cli.ts';

const prov = (key: string, host: string) => [
  { url: `https://${host}/docs/x`, allowlistKey: key, fetchedAt: '2026-09-29T00:00:00.000Z' },
];
const entry = (id: string, key = 'next.official', host = 'nextjs.org') => ({
  id,
  summary: 's',
  bestPractices: ['b'],
  antiPatterns: ['a'],
  provenance: prov(key, host),
});

function fixture(selection?: unknown): { root: string; plan: string; sel?: string } {
  const root = mkdtempSync(join(tmpdir(), 'check-plan-'));
  writeFileSync(join(root, 'package.json'), '{}');
  const plan = join(root, 'react-next.research.json');
  writeFileSync(
    plan,
    JSON.stringify({
      framework: 'react-next',
      version: null,
      patterns: [entry('kept-with-rule'), entry('kept-research-only'), entry('bad-key', 'vite', 'vite.dev')],
      missing: [],
      drift: null,
    }),
  );
  if (selection === undefined) return { root, plan };
  const sel = join(root, 'react-next.selection.json');
  writeFileSync(sel, JSON.stringify(selection));
  return { root, plan, sel };
}

describe('checkPlanFile', () => {
  it('reports kept, dropped (with reason) and research-only entries', () => {
    const f = fixture({
      rules: [
        { entryId: 'kept-with-rule', ruleId: 'r1', presence: 'forbid', selector: 'Identifier' },
        // routes to manual (no selector, no eslintConfig) → research-only, like withManualDrop
        { entryId: 'kept-research-only', ruleId: 'r2' },
      ],
    });
    const r = checkPlanFile({ planPath: f.plan, selectionPath: f.sel, root: f.root });
    expect(r.kept).toEqual(['kept-with-rule', 'kept-research-only']);
    expect(r.dropped.map((d) => d.id)).toEqual(['bad-key']);
    expect(r.dropped[0]!.reason).toMatch(/^FF2005/);
    expect(r.researchOnly).toEqual(['kept-research-only']);
  });

  it('without a selection every kept entry is research-only', () => {
    const f = fixture();
    const r = checkPlanFile({ planPath: f.plan, root: f.root });
    expect(r.researchOnly).toEqual(['kept-with-rule', 'kept-research-only']);
  });

  it('writes nothing', () => {
    const f = fixture({ rules: [] });
    const before = readdirSync(f.root).sort();
    checkPlanFile({ planPath: f.plan, selectionPath: f.sel, root: f.root });
    expect(readdirSync(f.root).sort()).toEqual(before);
  });
});
