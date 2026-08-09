// First-Steps parity — the AI Usage Guide's §2 must not fork from the First-Steps SSOT.
//
// WHY (beta-ai-docs-agnosticism S1 §3; spec §6 C1 «one source of truth, two renders»): the three
// First-Steps sequences exist once, as data, and are RENDERED twice — here into the shipped AI
// Usage Guide, and later by umbrella B into the human-voiced site page (B-D5, vendored). Two
// hand-maintained copies of the same instructions drift silently; a consumer then follows steps
// that no longer match the ones the other audience is given.
//
// WHAT MAKES THIS NON-TAUTOLOGICAL (S1 §6 trap T-BADC-S1-C):
//   1. TWO REAL FILES. The source is JSON and the render is markdown, so the render can never
//      quietly BE the source — the comparison always has two independently-editable sides.
//   2. ORDERED STEP LIST, not shape. Asserting «both have three sections» or «the headings match»
//      passes happily while the steps underneath have forked. This compares the ordered
//      (id, title) pairs, so a reordered step, a renamed step, a dropped step and an added step
//      are each RED.
//   3. ALL THREE SEQUENCES (core / env / factory), and the profile SET itself is compared — a
//      sequence silently dropped from either side fails rather than being skipped.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SOURCE_PATH = 'packages/core/templates/shared/first-steps.source.json';
const RENDER_PATH = 'packages/core/templates/shared/AI-USAGE-GUIDE.md';

interface SourceStep {
  id: string;
  title: string;
  action: string;
  evidence: string;
}
interface SourceSequence {
  goal: string;
  profileFlag: string;
  steps: SourceStep[];
}
interface FirstStepsSource {
  schema: string;
  renders: string[];
  sequences: Record<string, SourceSequence>;
}

const source: FirstStepsSource = JSON.parse(readFileSync(join(REPO_ROOT, SOURCE_PATH), 'utf8'));
const render = readFileSync(join(REPO_ROOT, RENDER_PATH), 'utf8');

/** `### §2.N \`<profile>\` — …` opens a per-profile block; the next `###`/`---` closes it. */
function renderSections(md: string): Map<string, string> {
  const out = new Map<string, string>();
  const headingRe = /^###\s+§2\.\d+\s+`([a-z]+)`/gm;
  const heads: Array<{ profile: string; start: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(md)) !== null) {
    heads.push({ profile: m[1] as string, start: m.index + m[0].length });
  }
  for (let i = 0; i < heads.length; i += 1) {
    const head = heads[i] as { profile: string; start: number };
    const next = heads[i + 1];
    const end = next === undefined ? md.length : next.start;
    out.set(head.profile, md.slice(head.start, end));
  }
  return out;
}

/**
 * A rendered step is a `<!-- step: <id> -->` marker whose next non-blank line carries the title as
 * its first bold span. Both halves are required: the marker alone would let the prose drift, and
 * the bold text alone would have no stable identity to order against.
 */
function renderedSteps(section: string): Array<{ id: string; title: string }> {
  const re = /<!--\s*step:\s*([A-Za-z0-9-]+)\s*-->\s*\n\s*\d+\.\s+\*\*(.+?)\*\*/g;
  const steps: Array<{ id: string; title: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(section)) !== null) {
    steps.push({ id: m[1] as string, title: m[2] as string });
  }
  return steps;
}

const key = (s: { id: string; title: string }): string => `${s.id} :: ${s.title}`;

describe('First-Steps SSOT ↔ AI Usage Guide parity', () => {
  const sections = renderSections(render);

  it('renders every profile the source declares, and no extra ones', () => {
    expect([...sections.keys()].sort()).toEqual(Object.keys(source.sequences).sort());
  });

  it('declares both renders in the source (the source knows who consumes it)', () => {
    expect(source.renders.length).toBeGreaterThanOrEqual(2);
    expect(source.renders.join('\n')).toContain(RENDER_PATH);
  });

  for (const profile of Object.keys(source.sequences)) {
    it(`\`${profile}\`: rendered step list matches the source, in order`, () => {
      const sequence = source.sequences[profile] as SourceSequence;
      const section = sections.get(profile);
      expect(section, `no §2.x section renders the \`${profile}\` sequence`).toBeDefined();
      expect(renderedSteps(section as string).map(key)).toEqual(sequence.steps.map(key));
    });

    it(`\`${profile}\`: every source step carries runnable evidence`, () => {
      const sequence = source.sequences[profile] as SourceSequence;
      expect(sequence.steps.length).toBeGreaterThan(0);
      for (const step of sequence.steps) {
        // An unevidenced step is exactly the aspirational instruction this guide must not ship.
        expect(step.evidence.trim().length, `step \`${step.id}\` has no evidence`).toBeGreaterThan(
          0,
        );
        expect(step.action.trim().length).toBeGreaterThan(0);
      }
    });
  }

  it('every rendered step marker belongs to a declared source step (no orphan markers)', () => {
    const declared = new Set<string>();
    for (const sequence of Object.values(source.sequences)) {
      for (const step of sequence.steps) declared.add(step.id);
    }
    const rendered = [...render.matchAll(/<!--\s*step:\s*([A-Za-z0-9-]+)\s*-->/g)].map(
      (m) => m[1] as string,
    );
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.filter((id) => !declared.has(id))).toEqual([]);
  });
});
