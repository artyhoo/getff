// Base-core list — the shipped status of every base-core principle must stay true to what ships.
//
// WHY (one-button chain, part P4; operator log entry 26 points 2, 10, 12): every project receives
// the base-core principles as ONE list with a machine-readable status per row, and the install
// report prints every row that does not fire. A status written by hand drifts the moment a
// carrier file stops shipping, so the list is only as honest as this test.
//
// WHAT MAKES THIS NON-TAUTOLOGICAL:
//   1. TWO REAL SOURCES. A row's `fires` / `partial` / `opt-in` claim is checked against the
//      react-spa install fingerprint (the files an install really delivers), not against the list.
//      Removing a carrier from the install, or naming one that never shipped, is RED.
//   2. THE ID SET IS PINNED. The 100 ids of inventory revision 5 are listed below; a dropped,
//      renamed or invented row is RED, and so is a merged id coming back.
//   3. PLUGIN NAMES RESOLVE. A plugin rule named in the list must be a key of the shipped core
//      plugin (`packages/core/eslint-rules/index.ts`).
//   4. THE COUNTS SENTENCE IS COMPUTED. The file's own totals must equal the parsed rows.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const LIST_PATH = 'skills/getff/references/base-core.md';
const FINGERPRINT_PATH = 'tests/install-sh/baselines/react-spa/greenfield.fingerprint';
const PLUGIN_INDEX_PATH = 'packages/core/eslint-rules/index.ts';

const HEADER = '| id | principle | primary trigger | status | reason | carrier in the project | plugin rule |';

// Inventory revision 5 (docs/superpowers/specs/2026-09-28-one-button-chain-base-core.md, d886e137aad):
// merged ids A14 A19 C1 C16 E4 E6 E7 E9 F3 keep their numbers and are not principles.
const MERGED = new Set(['A14', 'A19', 'C1', 'C16', 'E4', 'E6', 'E7', 'E9', 'F3']);
const GROUP_SIZES: Record<string, number> = { A: 20, B: 8, C: 17, D: 14, E: 13, F: 9, G: 7, H: 12, I: 7, J: 2 };
const EXPECTED_IDS = Object.entries(GROUP_SIZES)
  .flatMap(([g, n]) => Array.from({ length: n }, (_, i) => `${g}${i + 1}`))
  .filter((id) => !MERGED.has(id));

const STATUSES = ['fires', 'partial', 'not_wired'] as const;
const REASONS: Record<(typeof STATUSES)[number], string[]> = {
  fires: ['—', 'conditional'],
  partial: ['gap-named'],
  not_wired: ['opt-in', 'generated-pending', 'trigger-to-build', 'rule-file-not-shipped', 'always-on-set-not-built'],
};

interface Row {
  id: string;
  status: string;
  reason: string;
  carriers: string[];
  pluginRules: string[];
}

const unticked = (cell: string): string => cell.replace(/`/g, '').trim();
const listOf = (cell: string): string[] =>
  unticked(cell) === '—' ? [] : unticked(cell).split(',').map((s) => s.trim()).filter(Boolean);

function parseList(text: string): Row[] {
  const lines = text.split('\n');
  const start = lines.indexOf(HEADER);
  expect(start, `header row not found in ${LIST_PATH}`).toBeGreaterThanOrEqual(0);
  const rows: Row[] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('|')) break;
    const cells = line.slice(1, -1).split(' | ').map((c) => c.trim());
    expect(cells, `malformed row: ${line}`).toHaveLength(7);
    rows.push({
      id: cells[0],
      status: unticked(cells[3]),
      reason: unticked(cells[4]),
      carriers: listOf(cells[5]),
      pluginRules: listOf(cells[6]),
    });
  }
  return rows;
}

const listText = readFileSync(join(REPO_ROOT, LIST_PATH), 'utf8');
const rows = parseList(listText);
const shipped = new Set(
  readFileSync(join(REPO_ROOT, FINGERPRINT_PATH), 'utf8')
    .split('\n')
    .map((l) => l.trim().split(/\s+/)[1])
    .filter(Boolean),
);
const pluginRuleKeys = new Set(
  [...readFileSync(join(REPO_ROOT, PLUGIN_INDEX_PATH), 'utf8').matchAll(/^\s+'([a-z-]+)':/gm)].map((m) => m[1]),
);

describe('base-core list (skills/getff/references/base-core.md)', () => {
  it('holds exactly the 100 principles of inventory revision 5, in order', () => {
    expect(EXPECTED_IDS).toHaveLength(100);
    expect(rows.map((r) => r.id)).toEqual(EXPECTED_IDS);
  });

  it('gives every row a status and a reason from the vocabulary', () => {
    for (const r of rows) {
      expect(STATUSES as readonly string[], `${r.id} status`).toContain(r.status);
      expect(REASONS[r.status as (typeof STATUSES)[number]], `${r.id} reason`).toContain(r.reason);
    }
  });

  it('names a shipped carrier for every row that claims to fire, and none for the rest', () => {
    for (const r of rows) {
      const claimsCarrier = r.status !== 'not_wired' || r.reason === 'opt-in';
      if (claimsCarrier) {
        expect(r.carriers.length, `${r.id} names no carrier`).toBeGreaterThan(0);
        for (const c of r.carriers) expect(shipped.has(c), `${r.id}: ${c} is not in ${FINGERPRINT_PATH}`).toBe(true);
      } else {
        expect(r.carriers, `${r.id} is not wired but names a carrier`).toEqual([]);
      }
    }
  });

  it('names only plugin rules the shipped core plugin exports', () => {
    for (const r of rows)
      for (const p of r.pluginRules) expect(pluginRuleKeys.has(p), `${r.id}: plugin rule ${p}`).toBe(true);
  });

  it('states totals that equal the parsed rows', () => {
    const count = (status: string, reason?: string) =>
      rows.filter((r) => r.status === status && (reason === undefined || r.reason === reason)).length;
    const expected =
      `Totals: fires ${count('fires')}, partial ${count('partial')}, not_wired ${count('not_wired')} ` +
      `(trigger-to-build ${count('not_wired', 'trigger-to-build')}, ` +
      `generated-pending ${count('not_wired', 'generated-pending')}, ` +
      `rule-file-not-shipped ${count('not_wired', 'rule-file-not-shipped')}, ` +
      `always-on-set-not-built ${count('not_wired', 'always-on-set-not-built')}, ` +
      `opt-in ${count('not_wired', 'opt-in')}).`;
    expect(listText).toContain(expected);
  });
});
