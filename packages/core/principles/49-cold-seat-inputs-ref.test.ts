/**
 * Principle 49 — every cold-seat dispatch template carries a required `Inputs-ref:` field
 *
 * Source: .claude/rules/cold-seat-economy.md §7 — a cold seat gets immutable inputs (a
 *         `git show <sha>:<path>` snapshot via scripts/snapshot-for-seat.sh, or its own
 *         worktree at the SHA), and every `path:NN` in one answer is pinned to one named ref.
 *
 * What is mechanically checkable, and therefore gated here: the dispatch TEMPLATES the
 * dispatching session fills carry an `Inputs-ref: <…>` placeholder, so the ref is a field
 * the dispatcher must fill rather than a habit it must remember. Whether the dispatcher then
 * fills it with a real SHA and hands the seat a snapshot instead of a live path is judgment
 * at dispatch time (the rule text, not this test).
 *
 * Population (sweep by predicate, not by a hand list): every markdown file under
 * .claude/skills/ that contains the cold-seat dispatch marker «you did not write»
 * (case-insensitive — the sentence both orchestrator templates open their seat prompt with),
 * plus DECLARED_EXTRAS: dispatch contracts that instruct a cold seat without quoting a
 * prompt skeleton. A new template that copies the marker enters the population on the
 * commit that adds it. Out of population by design: agents/*.md — those are the seat's own
 * protocol (what it does with inputs), not the prompt the dispatcher fills (what it hands
 * over); agents/fidelity-auditor.md already requires the audited SHA as input 3.
 *
 * Zero paid LLM (.claude/rules/no-paid-llm-in-ci.md): a directory walk and a regex.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REPO_ROOT } from './kickoff-population.ts';

const SKILLS_DIR = join(REPO_ROOT, '.claude/skills');
const MARKER = /you did not write/i;
const FIELD = /^[ \t>*-]*`?Inputs-ref:`?[ \t]*`?</m;

/** Dispatch contracts that carry no prompt skeleton (so no marker) but still send a cold seat. */
const DECLARED_EXTRAS = ['.claude/skills/arch/SKILL.md'];

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
    .map((f) => relative(REPO_ROOT, f));
  return [...new Set([...discovered, ...DECLARED_EXTRAS])].sort();
}

function carriesInputsRef(text: string): boolean {
  return FIELD.test(text);
}

describe('principle 49 — cold-seat dispatch templates carry Inputs-ref', () => {
  it('the population is non-vacuous: the two orchestrator templates are discovered by predicate', () => {
    const pop = coldSeatTemplates();
    expect(pop).toContain('.claude/skills/orchestrator/references/reviewer-template.md');
    expect(pop).toContain('.claude/skills/orchestrator/references/phase-minus-1.md');
  });

  it('every template in the population carries an `Inputs-ref: <…>` field', () => {
    const missing = coldSeatTemplates().filter(
      (p) => !carriesInputsRef(readFileSync(join(REPO_ROOT, p), 'utf8')),
    );
    expect(
      missing,
      `cold-seat dispatch template(s) without an \`Inputs-ref: <sha>\` field — add one ` +
        `(.claude/rules/cold-seat-economy.md §7; fill it from scripts/snapshot-for-seat.sh stdout line 1)`,
    ).toEqual([]);
  });

  it('paired negative: the detector reds on a template without the field and on a bare mention', () => {
    expect(carriesInputsRef('You did NOT write this.\nReview <PATH>.\n')).toBe(false);
    // A prose mention of the field name is not a field to fill.
    expect(carriesInputsRef('see the Inputs-ref convention in the rule\n')).toBe(false);
    expect(carriesInputsRef('Inputs-ref: <sha>\n')).toBe(true);
    expect(carriesInputsRef('   Inputs-ref: <SHA from snapshot-for-seat.sh>\n')).toBe(true);
    expect(carriesInputsRef('- **`Inputs-ref: <sha>`** — required\n')).toBe(true);
  });
});
