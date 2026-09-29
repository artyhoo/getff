// Base-core list — the shipped status of every base-core principle must stay true to what ships.
//
// WHY (one-button chain, part P4; operator log entry 26 points 2, 10, 12): every project receives
// the base-core principles as ONE list with a machine-readable status per row, and the install
// report prints every row that does not fire. A status written by hand drifts the moment a
// carrier file stops shipping, so the list is only as honest as this test.
//
// WHAT MAKES THIS NON-TAUTOLOGICAL:
//   1. REAL SOURCES, EVERY STACK. A row's `fires` / `partial` / `opt-in` claim is checked against the
//      install fingerprint of every stack that receives this list (the files an install really
//      delivers), not against the list. A stack may be exempted only in the row's `not on stack` cell,
//      and an exemption that no longer matches a real gap is RED too.
//   2. PLUGIN RULES MUST BE SWITCHED ON. For a `fires` row the stack's shipped lint config must switch
//      the rule on by default; for an `opt-in` row, only inside the `STRICT_RUNTIME` block.
//   3. THE ID SET IS PINNED. The 100 ids of inventory revision 5 are listed below; a dropped,
//      renamed or invented row is RED, and so is a merged id coming back.
//   4. PLUGIN NAMES RESOLVE. A plugin rule named in the list must be a key of the shipped core
//      plugin (`packages/core/eslint-rules/index.ts`).
//   5. THE COUNTS SENTENCE IS COMPUTED. The file's own totals must equal the parsed rows.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const LIST_PATH = 'skills/getff/references/base-core.md';
const BASELINES_DIR = 'tests/install-sh/baselines';
const LIST_IN_PROJECT = '.claude/skills/getff/references/base-core.md';
// The lint config each stack's greenfield install places (setup.d/40-configs.sh:571-646). react-native
// splits its config across a baseline file and a shared one, so all of them are read together.
const STACK_LINT_CONFIGS: Record<string, string[]> = {
  'ts-server': ['templates/ts-server/eslint.config.mjs'],
  'react-next': ['packages/preset-next-15-canonical/templates/eslint.config.react.mjs'],
  'react-spa': ['packages/preset-react-spa/templates/eslint.config.react.mjs'],
  'react-native': [
    'packages/preset-react-native/templates/eslint.config.bare-rn.mjs',
    'packages/preset-react-native/templates/eslint.config.expo.mjs',
    'packages/preset-react-native/templates/eslint.config.rn-common.mjs',
  ],
};
const PLUGIN_INDEX_PATH = 'packages/core/eslint-rules/index.ts';

const HEADER =
  '| id | principle | primary trigger | status | reason | carrier in the project | plugin rule | not on stack |';

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
  notOn: string[];
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
    expect(cells, `malformed row: ${line}`).toHaveLength(8);
    rows.push({
      id: cells[0],
      status: unticked(cells[3]),
      reason: unticked(cells[4]),
      carriers: listOf(cells[5]),
      pluginRules: listOf(cells[6]),
      notOn: listOf(cells[7]),
    });
  }
  return rows;
}

const listText = readFileSync(join(REPO_ROOT, LIST_PATH), 'utf8');
const rows = parseList(listText);
const readFingerprint = (stack: string): Set<string> =>
  new Set(
    readFileSync(join(REPO_ROOT, BASELINES_DIR, stack, 'greenfield.fingerprint'), 'utf8')
      .split('\n')
      .map((l) => l.trim().split(/\s+/)[1])
      .filter(Boolean),
  );
// Every stack whose greenfield install delivers this list.
const fingerprints = new Map(
  readdirSync(join(REPO_ROOT, BASELINES_DIR))
    .filter((d) => existsSync(join(REPO_ROOT, BASELINES_DIR, d, 'greenfield.fingerprint')))
    .map((d) => [d, readFingerprint(d)] as const)
    .filter(([, fp]) => fp.has(LIST_IN_PROJECT)),
);

// Source ranges of every `...(STRICT_RUNTIME ...)` spread: rules inside are opt-in.
function strictRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const m of text.matchAll(/\.\.\.\(STRICT_RUNTIME/g)) {
    const open = (m.index ?? 0) + 3;
    let depth = 0;
    for (let i = open; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')' && --depth === 0) {
        ranges.push([open, i]);
        break;
      }
    }
  }
  return ranges;
}
type Switch = 'default' | 'opt-in' | 'off';
function ruleSwitch(stack: string, rule: string): Switch {
  const texts = (STACK_LINT_CONFIGS[stack] ?? []).map((f) => readFileSync(join(REPO_ROOT, f), 'utf8'));
  let seen: Switch = 'off';
  for (const text of texts) {
    const ranges = strictRanges(text);
    for (const m of text.matchAll(new RegExp(`'rules-as-tests/${rule}'\\s*:`, 'g'))) {
      const at = m.index ?? 0;
      if (!ranges.some(([a, b]) => at > a && at < b)) return 'default';
      seen = 'opt-in';
    }
  }
  return seen;
}

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

  it('is delivered to at least the npm stacks it is measured on', () => {
    expect([...fingerprints.keys()]).toEqual(expect.arrayContaining(['react-spa', 'ts-server']));
  });

  it('holds every carrier claim on every stack that receives the list, except the named ones', () => {
    for (const r of rows) {
      const claimsCarrier = r.status !== 'not_wired' || r.reason === 'opt-in';
      if (!claimsCarrier) {
        expect(r.carriers, `${r.id} is not wired but names a carrier`).toEqual([]);
        expect(r.notOn, `${r.id} is not wired anywhere, so it excludes no stack`).toEqual([]);
        continue;
      }
      expect(r.carriers.length, `${r.id} names no carrier`).toBeGreaterThan(0);
      expect(r.notOn, `${r.id} is measured on react-spa and cannot exclude it`).not.toContain('react-spa');
      for (const s of r.notOn) expect(fingerprints.has(s), `${r.id}: unknown stack ${s}`).toBe(true);
      for (const [stack, fp] of fingerprints) {
        const missing = r.carriers.filter((c) => !fp.has(c));
        const wanted: Switch | undefined =
          r.status === 'fires' ? 'default' : r.reason === 'opt-in' ? 'opt-in' : undefined;
        const unswitched = wanted ? r.pluginRules.filter((p) => ruleSwitch(stack, p) !== wanted) : [];
        const holds = missing.length === 0 && unswitched.length === 0;
        if (r.notOn.includes(stack)) {
          // A partial row only claims its carriers; its plugin rule may be switched on nowhere but one stack.
          const partialGap = r.status === 'partial' && r.pluginRules.some((p) => ruleSwitch(stack, p) === 'off');
          expect(!holds || partialGap, `${r.id}: excludes ${stack}, but the claim holds there`).toBe(true);
        } else {
          expect(missing, `${r.id} on ${stack}: carriers not installed`).toEqual([]);
          expect(unswitched, `${r.id} on ${stack}: plugin rule not switched on as ${wanted}`).toEqual([]);
        }
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
