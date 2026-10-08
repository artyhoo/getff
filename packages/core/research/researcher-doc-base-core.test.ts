// The rule researcher reads the base core's pending principles (P5 A4).
//
// base-core.md marks a principle `not_wired` with reason `generated-pending` when it fires only
// once the project's own rule for it is placed and proven. Nothing sent the researcher there, so
// those principles never got a per-project rule. agents/rule-researcher.md now names the file, the
// exact filter and the field that carries the link back; this test holds the doc to the table's
// real column names and to a filter that still selects rows.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const doc = readFileSync(join(REPO, '.agents/roles/rule-researcher.md'), 'utf8');
const table = readFileSync(join(REPO, '.agents/procedures/getff/references/base-core.md'), 'utf8');

function rows(): Array<Record<string, string>> {
  const lines = table.split('\n');
  const h = lines.findIndex((l) => l.startsWith('| id | principle |'));
  const cols = lines[h]!.split('|').slice(1, -1).map((c) => c.trim());
  const out: Array<Record<string, string>> = [];
  for (const l of lines.slice(h + 2)) {
    if (!l.startsWith('|')) break;
    const cells = l.split('|').slice(1, -1).map((c) => c.trim());
    out.push(Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ''])));
  }
  return out;
}

describe('agents/rule-researcher.md reads the base core', () => {
  it('names the installed base-core file, the filter and the link-back field', () => {
    expect(doc).toContain('.claude/skills/getff/references/base-core.md');
    expect(doc).toMatch(/`status`\s*=\s*`` `not_wired` ``\s*AND[^\n]*`reason`\s*=\s*`generated-pending`/);
    expect(doc).toContain('"principle": "<id>"');
  });

  it('the filter the doc names selects rows in the shipped table', () => {
    const pending = rows().filter((r) => r['status'] === '`not_wired`' && r['reason'] === 'generated-pending');
    expect(pending.length).toBeGreaterThan(0);
    for (const r of pending) expect(r['id']).toMatch(/^[A-Z]\d+$/);
  });
});
