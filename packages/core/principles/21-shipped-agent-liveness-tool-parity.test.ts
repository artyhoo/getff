/**
 * Principle 21 — shipped-agent liveness tool parity (fixture ↔ frontmatter ↔ prober roster)
 *
 * Source: SSOT docs/meta-factory/prior-art-evaluations.md #121 (the principle-21 `tools:`
 *         form-gate family, verdict BUILD); found by the §2 bottom-up cold review of the
 *         one-button chain design (R3-2).
 *
 * The M2 behavioural liveness probe (`agents/shipped-agent-liveness-prober.md`) tests each
 * shipped agent against a fixture in `tests/fixtures/shipped-agent-liveness/<slug>.md`, and
 * each fixture declares `tools-required:`. The prober's roster table repeats the same lists.
 * The source of truth is the agent's own frontmatter `tools:` line. Before this test nothing
 * outside the fixtures read `tools-required` at all, so an agent that gained or dropped a
 * tool left the probe testing a stale contract with every gate green — the `#hope-as-gate`
 * shape of .claude/rules/attention-is-not-a-mechanism.md §2.
 *
 * Invariant, per fixture (README.md excluded):
 *   set(fixture `tools-required`) == set(agents/<slug>.md `tools:`) == set(roster row <slug>)
 * plus: the fixture's `agent:` field names its own file; every roster row marked shipped
 * (`YES`) has a fixture and every fixture has a `YES` roster row; every roster row (shipped or
 * authoring-only) matches its agent's frontmatter.
 *
 * FORM-CHECK, NOT BEHAVIOUR-CHECK: parity proves the probe tests the CURRENT contract; it does
 * not prove the agent uses its tools — that remains the M2 probe's job.
 *
 * Parsing is local on purpose: importing helpers from a sibling `.test.ts` re-registers its
 * vitest suite (see the RELATION note in 21-agnosticism-conformance.test.ts).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../');
const FIXTURE_DIR = resolve(REPO_ROOT, 'tests/fixtures/shipped-agent-liveness');
const PROBER = resolve(REPO_ROOT, '.agents/roles/shipped-agent-liveness-prober.md');

/** Split an inline comma list into a sorted, de-duplicated tool set; `#` starts a comment. */
export function toolSet(value: string): string[] {
  const noComment = value.replace(/\s+#.*$/, '');
  return [...new Set(noComment.split(',').map((t) => t.trim()).filter((t) => t !== ''))].sort();
}

/** Frontmatter `tools:` of an agent file, or null when there is no frontmatter / no key. */
export function frontmatterTools(content: string): string[] | null {
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return null;
  const line = fm[1].split('\n').find((l) => /^tools:/.test(l));
  return line ? toolSet(line.replace(/^tools:/, '')) : null;
}

export interface Fixture {
  agent: string | null;
  tools: string[] | null;
}

/** Read the `agent:` and `tools-required:` lines of a fixture's yaml header. */
export function parseFixture(content: string): Fixture {
  const agent = content.match(/^agent:\s*(\S+)\s*$/m);
  const tools = content.match(/^tools-required:(.*)$/m);
  return { agent: agent ? agent[1] : null, tools: tools ? toolSet(tools[1]) : null };
}

export interface RosterRow {
  slug: string;
  tools: string[];
  shipped: boolean;
}

/**
 * Parse the prober's roster table: rows shaped
 * `| \`slug\` | \`Tool, Tool\` | YES ... |` (third cell starts with YES or NO).
 */
export function parseRoster(content: string): RosterRow[] {
  const rows: RosterRow[] = [];
  const re = /^\|\s*`([\w-]+)`\s*\|\s*`([^`]*)`\s*\|\s*(YES|NO)\b[^|]*\|\s*$/gm;
  for (const m of content.matchAll(re)) {
    rows.push({ slug: m[1], tools: toolSet(m[2]), shipped: m[3] === 'YES' });
  }
  return rows;
}

export interface ParityInput {
  fixtures: Map<string, Fixture>; // keyed by file slug
  roster: RosterRow[];
  agentTools: Map<string, string[] | null>; // slug → frontmatter tools (null = file/key missing)
}

/** Every parity violation, one human-readable line each. Empty = in step. */
export function parityViolations({ fixtures, roster, agentTools }: ParityInput): string[] {
  const out: string[] = [];
  const fmt = (t: string[] | null | undefined) => (t ? `[${t.join(', ')}]` : '<missing>');
  const same = (a: string[] | null | undefined, b: string[] | null | undefined) =>
    !!a && !!b && a.join('\0') === b.join('\0');
  const rosterBySlug = new Map(roster.map((r) => [r.slug, r]));

  for (const [slug, fx] of fixtures) {
    if (fx.agent !== slug) out.push(`fixture ${slug}.md: agent: field is ${fx.agent ?? '<missing>'}, expected ${slug}`);
    const fm = agentTools.get(slug);
    if (!same(fx.tools, fm)) {
      out.push(`fixture ${slug}.md: tools-required ${fmt(fx.tools)} != agents/${slug}.md tools: ${fmt(fm)}`);
    }
    const row = rosterBySlug.get(slug);
    if (!row) out.push(`fixture ${slug}.md has no roster row in the prober`);
    else if (!row.shipped) out.push(`fixture ${slug}.md exists but its roster row is marked NO (not shipped)`);
  }
  for (const row of roster) {
    const fm = agentTools.get(row.slug);
    if (!same(row.tools, fm)) {
      out.push(`roster row ${row.slug}: ${fmt(row.tools)} != agents/${row.slug}.md tools: ${fmt(fm)}`);
    }
    if (row.shipped && !fixtures.has(row.slug)) out.push(`roster row ${row.slug} is YES but has no fixture`);
  }
  return out;
}

function loadRealTree(): ParityInput {
  const fixtures = new Map<string, Fixture>();
  for (const f of readdirSync(FIXTURE_DIR).filter((n) => n.endsWith('.md') && n !== 'README.md').sort()) {
    fixtures.set(basename(f, '.md'), parseFixture(readFileSync(resolve(FIXTURE_DIR, f), 'utf8')));
  }
  const roster = parseRoster(readFileSync(PROBER, 'utf8'));
  const agentTools = new Map<string, string[] | null>();
  for (const slug of new Set([...fixtures.keys(), ...roster.map((r) => r.slug)])) {
    const p = resolve(REPO_ROOT, '.agents/roles', `${slug}.md`);
    agentTools.set(slug, existsSync(p) ? frontmatterTools(readFileSync(p, 'utf8')) : null);
  }
  return { fixtures, roster, agentTools };
}

describe('Principle 21 — shipped-agent liveness tool parity (fixture ↔ frontmatter ↔ roster)', () => {
  it('real-tree: fixtures, prober roster and agent frontmatter declare the same tools', () => {
    const input = loadRealTree();
    // Non-vacuity (T1/T10): the population is really read, not silently empty.
    expect(input.fixtures.size, 'expected ≥8 liveness fixtures').toBeGreaterThanOrEqual(8);
    expect(input.roster.filter((r) => r.shipped).length, 'expected ≥8 YES roster rows parsed').toBeGreaterThanOrEqual(8);
    for (const [slug, fx] of input.fixtures) {
      expect(fx.tools, `fixture ${slug}.md must carry a tools-required: line`).not.toBeNull();
    }
    const v = parityViolations(input);
    expect(v, `Liveness tool contract drifted (fix the fixture/roster to the agent's frontmatter, or the agent):\n  ${v.join('\n  ')}`).toEqual([]);
  });

  // ── paired negatives (principle 02) ─────────────────────────────────────────
  const base = (): ParityInput => ({
    fixtures: new Map([['a', { agent: 'a', tools: ['Glob', 'Read'] }]]),
    roster: [{ slug: 'a', tools: ['Glob', 'Read'], shipped: true }],
    agentTools: new Map([['a', ['Glob', 'Read']]]),
  });

  it('paired-negative: an in-step triple is clean; order and a trailing comment do not matter', () => {
    expect(parityViolations(base())).toEqual([]);
    expect(toolSet(' Read, Glob   # Bash added later')).toEqual(['Glob', 'Read']);
  });

  it('paired-negative: the agent gains a tool the fixture and roster do not know → RED twice', () => {
    const i = base();
    i.agentTools.set('a', ['Bash', 'Glob', 'Read']);
    const v = parityViolations(i);
    expect(v).toHaveLength(2);
    expect(v[0]).toMatch(/tools-required \[Glob, Read\] != agents\/a\.md tools: \[Bash, Glob, Read\]/);
    expect(v[1]).toMatch(/roster row a/);
  });

  it('paired-negative: a fixture without a roster row, and a YES row without a fixture, are RED', () => {
    const i = base();
    i.fixtures.set('b', { agent: 'b', tools: ['Read'] });
    i.agentTools.set('b', ['Read']);
    i.roster.push({ slug: 'c', tools: ['Read'], shipped: true });
    i.agentTools.set('c', ['Read']);
    expect(parityViolations(i)).toEqual([
      'fixture b.md has no roster row in the prober',
      'roster row c is YES but has no fixture',
    ]);
  });

  it('paired-negative: a NO roster row needs no fixture but must still match its frontmatter', () => {
    const i = base();
    i.roster.push({ slug: 'p', tools: ['Agent', 'Read'], shipped: false });
    i.agentTools.set('p', ['Agent', 'Read']);
    expect(parityViolations(i)).toEqual([]);
    i.agentTools.set('p', ['Read']);
    expect(parityViolations(i)).toEqual(['roster row p: [Agent, Read] != agents/p.md tools: [Read]']);
  });

  it('paired-negative: a fixture whose agent: field names another agent is RED', () => {
    const i = base();
    i.fixtures.set('a', { agent: 'z', tools: ['Glob', 'Read'] });
    expect(parityViolations(i)).toEqual(['fixture a.md: agent: field is z, expected a']);
  });

  it('parsers: roster row shapes and fixture header are read as the real files write them', () => {
    const roster = parseRoster(
      '| `aif-init` | `Read, Glob, Write` | YES |\n' +
        '| `x-prober`   | `Read, Agent`   | NO (authoring-only, #552) |\n' +
        '| agent slug | tools declared | install.sh-shipped? |\n',
    );
    expect(roster).toEqual([
      { slug: 'aif-init', tools: ['Glob', 'Read', 'Write'], shipped: true },
      { slug: 'x-prober', tools: ['Agent', 'Read'], shipped: false },
    ]);
    expect(parseFixture('```yaml\nagent: a\ntools-required: Read, Bash   # note\nshape: x\n```')).toEqual({
      agent: 'a',
      tools: ['Bash', 'Read'],
    });
    expect(frontmatterTools('---\nname: a\ntools: Read, Grep\n---\nbody')).toEqual(['Grep', 'Read']);
    expect(frontmatterTools('no frontmatter')).toBeNull();
  });
});
