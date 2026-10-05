/**
 * Principle 49 — every cold-seat dispatch template carries a required `Inputs-ref:` field
 *
 * Source: .claude/rules/cold-seat-economy.md §7 — a cold seat gets immutable inputs (a
 *         `git show <sha>:<path>` snapshot via scripts/snapshot-for-seat.sh, or its own
 *         worktree at the SHA), and every `path:NN` in one answer is pinned to one named ref.
 *
 * What is mechanically checkable, and therefore gated here: the dispatch TEMPLATES the
 * dispatching session fills carry an `Inputs-ref: <…>` placeholder INSIDE a fenced block (the
 * prompt skeleton or the literal line to paste — a prose mention does not count), so the ref is a field
 * the dispatcher must fill rather than a habit it must remember. Whether the dispatcher then
 * fills it with a real SHA and hands the seat a snapshot instead of a live path is judgment
 * at dispatch time (the rule text, not this test).
 *
 * Population (sweep by predicate, not by a hand list): every markdown file under
 * .agents/procedures/ that contains the cold-seat dispatch marker «you did not write»
 * (case-insensitive, markdown emphasis tolerated — `You did **NOT** write` — the sentence the
 * orchestrator templates open their seat prompt with), plus DECLARED_EXTRAS: dispatch
 * contracts that send a cold seat without quoting a marker-bearing skeleton (arch §2's two
 * design seats; the fidelity-seat dispatch in dispatcher §2.4 and harvest §4, whose
 * file-reading fallback hands the seat paths). A seat dispatched through an upstream skill
 * (`superpowers:requesting-code-review`, which already carries BASE_SHA/HEAD_SHA fields) is
 * governed by that skill's own template. A new template that copies the marker enters the population on the
 * commit that adds it. Out of population by design: agents/*.md — those are the seat's own
 * protocol (what it does with inputs), not the prompt the dispatcher fills (what it hands
 * over); agents/fidelity-auditor.md already requires the audited SHA as input 3.
 *
 * Zero paid LLM (.claude/rules/no-paid-llm-in-ci.md): a directory walk and a regex.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REPO_ROOT } from './kickoff-population.ts';

const SKILLS_DIR = join(REPO_ROOT, '.claude/skills');
const MARKER = /you did[\s*_]+not[\s*_]+write/i;
const FIELD = /^[ \t>*-]*`?Inputs-ref:`?[ \t]*`?</m;
const FENCE_OPEN = /^[ \t]*(`{3,}|~{3,})/;

/** Dispatch contracts that carry no prompt skeleton (so no marker) but still send a cold seat. */
const DECLARED_EXTRAS = [
  '.agents/procedures/arch/SKILL.md',
  '.agents/procedures/dispatcher/SKILL.md',
  '.agents/procedures/harvest/SKILL.md',
];

function walkMarkdown(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...walkMarkdown(full));
    else if (name.endsWith('.md')) found.push(full);
  }
  return found;
}

/** Repo-relative paths of the dispatch templates this principle governs. */
function coldSeatTemplates(): string[] {
  const discovered = walkMarkdown(SKILLS_DIR)
    .filter((f) => MARKER.test(readFileSync(f, 'utf8')))
    .map((f) => relative(REPO_ROOT, realpathSync(f)));
  return [...new Set([...discovered, ...DECLARED_EXTRAS])].sort();
}

/**
 * The fenced-block bodies of a markdown text, CommonMark-style: a block closes on a fence of
 * the SAME character at least as long as its opener, and an unclosed block runs to EOF.
 */
function fencedBodies(text: string): string[] {
  const bodies: string[] = [];
  let open: { ch: string; len: number } | null = null;
  let body: string[] = [];
  for (const line of text.split('\n')) {
    if (open === null) {
      const m = FENCE_OPEN.exec(line);
      if (m) open = { ch: m[1][0], len: m[1].length };
      continue;
    }
    const close = new RegExp(`^[ \\t]*\\${open.ch}{${open.len},}[ \\t]*$`);
    if (close.test(line)) {
      bodies.push(body.join('\n'));
      open = null;
      body = [];
    } else body.push(line);
  }
  if (open !== null) bodies.push(body.join('\n'));
  return bodies;
}

/** True when some fenced block (the prompt skeleton / the line to paste) carries the field. */
function carriesInputsRef(text: string): boolean {
  return fencedBodies(text).some((b) => FIELD.test(b));
}

describe('principle 50 — cold-seat dispatch templates carry Inputs-ref', () => {
  it('the population is non-vacuous: the two orchestrator templates are discovered by predicate', () => {
    const pop = coldSeatTemplates();
    expect(pop).toContain('.agents/procedures/orchestrator/references/reviewer-template.md');
    expect(pop).toContain('.agents/procedures/orchestrator/references/phase-minus-1.md');
    for (const extra of DECLARED_EXTRAS) expect(pop).toContain(extra);
  });

  it('every template in the population carries an `Inputs-ref: <…>` field', () => {
    const missing = coldSeatTemplates().filter(
      (p) => !carriesInputsRef(readFileSync(join(REPO_ROOT, p), 'utf8')),
    );
    expect(
      missing,
      `cold-seat dispatch template(s) without an \`Inputs-ref: <sha>\` field — add one ` +
        `(.claude/rules/cold-seat-economy.md §7; fill it with the SHA scripts/snapshot-for-seat.sh prints on line 1)`,
    ).toEqual([]);
  });

  it('paired negative: the detector reds on a template without the field and on a bare mention', () => {
    const fenced = (body: string, fence = '```') => `intro\n${fence}text\n${body}\n${fence}\n`;
    expect(carriesInputsRef(fenced('You did NOT write this.\nReview <PATH>.'))).toBe(false);
    // Outside a fence the field is prose describing the skeleton, not the skeleton itself.
    expect(carriesInputsRef('Inputs-ref: <sha>\n')).toBe(false);
    expect(carriesInputsRef('- **`Inputs-ref: <sha>`** — required\n')).toBe(false);
    expect(carriesInputsRef(fenced('see the Inputs-ref convention'))).toBe(false);
    expect(carriesInputsRef(fenced('Inputs-ref: <sha>'))).toBe(true);
    expect(carriesInputsRef(fenced('   Inputs-ref: <SHA>', '````'))).toBe(true);
    expect(carriesInputsRef(`1. step\n   \`\`\`text\n   Inputs-ref: <sha>\n   \`\`\`\n`)).toBe(true);
    // A longer closing fence closes the block (CommonMark) — prose after it stays prose.
    // (a same-length-only closer would swallow the prose up to the next fence — measured true).
    expect(carriesInputsRef('```\nbody\n`````\nInputs-ref: <sha>\n```\nx\n```\n')).toBe(false);
    // An unclosed fence runs to EOF, as CommonMark renders it.
    expect(carriesInputsRef('```\nnever closed\nInputs-ref: <sha>\n')).toBe(true);
    // A shorter or other-character fence does not close a block.
    expect(carriesInputsRef('````text\n```\nInputs-ref: <sha>\n````\n')).toBe(true);
    expect(carriesInputsRef('~~~\n```\nInputs-ref: <sha>\n~~~\n')).toBe(true);
  });

  it('the marker tolerates markdown emphasis, so a bold spelling cannot slip the population', () => {
    expect(MARKER.test('You did **NOT** write this output')).toBe(true);
    expect(MARKER.test('You did NOT write this prompt')).toBe(true);
    expect(MARKER.test('you did write this')).toBe(false);
  });
});
