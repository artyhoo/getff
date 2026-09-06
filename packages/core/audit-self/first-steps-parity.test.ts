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

  // ── Profile claims vs setup.d/lib.sh (ledger A8-3) ──────────────────────────────────────
  //
  // The arms above compare the SOURCE to its RENDER. Nothing compared either to the INSTALLER,
  // and the source — the declared SSOT — had drifted from it three times over: `factory`'s
  // verify-payload listed `pipeline` and `night-mode` as factory additions (both ship at env+),
  // `run-pipeline`'s evidence said pipeline is «shipped at factory», and `env`'s verify-payload
  // called tier-home + arch «the two artefacts env adds over core» when env adds five skills.
  // The render disagreed with its own source on the first of those and was RIGHT — proof that
  // an (id, title) comparison cannot see a claim rewritten inside `action`/`evidence`.
  //
  // The fix is not «read it more carefully»: it is to compare the claims against the three
  // lists that actually decide delivery (setup.d/lib.sh GETFF_SKILLS_CORE/_ENV/_FACTORY), so a
  // retiering of any skill reds this test until the SSOT is updated with it.
  const SKILL_TIERS = ((): Record<string, string> => {
    const lib = readFileSync(join(REPO_ROOT, 'setup.d/lib.sh'), 'utf8');
    const listOf = (name: string): string[] => {
      const m = new RegExp(`^${name}="([^"]*)"`, 'm').exec(lib);
      expect(m, `setup.d/lib.sh no longer defines ${name} — the tier lists moved`).not.toBeNull();
      return (m as RegExpExecArray)[1].split(/\s+/).filter(Boolean);
    };
    const tiers: Record<string, string> = {};
    for (const skill of listOf('GETFF_SKILLS_CORE')) tiers[skill] = 'core';
    for (const skill of listOf('GETFF_SKILLS_ENV')) tiers[skill] = 'env+';
    for (const skill of listOf('GETFF_SKILLS_FACTORY')) tiers[skill] = 'factory';
    return tiers;
  })();

  /** `.claude/skills/<name>/…` occurrences in a string, deduplicated in first-seen order. */
  const skillsNamedIn = (text: string): string[] => [
    ...new Set([...text.matchAll(/\.claude\/skills\/([a-z0-9-]+)\//g)].map((m) => m[1] as string)),
  ];

  it('lib.sh still declares all three tier lists, and they are disjoint and non-empty', () => {
    // Non-vacuity floor: an empty or collapsed map would make both arms below pass for free.
    expect(Object.keys(SKILL_TIERS).length).toBeGreaterThanOrEqual(12);
    expect(new Set(Object.values(SKILL_TIERS))).toEqual(new Set(['core', 'env+', 'factory']));
  });

  it('`factory`: verify-payload names EXACTLY the skills factory adds over env', () => {
    const step = (source.sequences['factory'] as SourceSequence).steps.find(
      (s) => s.id === 'verify-payload',
    );
    expect(step, 'factory sequence has no verify-payload step').toBeDefined();
    const claimed = skillsNamedIn((step as SourceStep).action).sort();
    const factoryTier = Object.entries(SKILL_TIERS)
      .filter(([, tier]) => tier === 'factory')
      .map(([name]) => name)
      .sort();
    expect(
      claimed,
      `factory verify-payload claims ${JSON.stringify(claimed)} but setup.d/lib.sh ships ` +
        `${JSON.stringify(factoryTier)} at factory`,
    ).toEqual(factoryTier);
  });

  it('`env`: verify-payload names EXACTLY the skills env adds over core', () => {
    const step = (source.sequences['env'] as SourceSequence).steps.find(
      (s) => s.id === 'verify-payload',
    );
    expect(step, 'env sequence has no verify-payload step').toBeDefined();
    const claimed = skillsNamedIn((step as SourceStep).action).sort();
    const envTier = Object.entries(SKILL_TIERS)
      .filter(([, tier]) => tier === 'env+')
      .map(([name]) => name)
      .sort();
    expect(
      claimed,
      `env verify-payload claims ${JSON.stringify(claimed)} but setup.d/lib.sh ships ` +
        `${JSON.stringify(envTier)} at env+`,
    ).toEqual(envTier);
  });

  it('every «shipped at <tier>» evidence claim matches the tier lib.sh actually ships it at', () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const [profile, sequence] of Object.entries(source.sequences)) {
      for (const step of (sequence as SourceSequence).steps) {
        const claim = /\.claude\/skills\/([a-z0-9-]+)\/SKILL\.md \(shipped at ([a-z+]+)/.exec(
          step.evidence,
        );
        if (!claim) continue;
        checked += 1;
        const [, skill, claimedTier] = claim as unknown as [string, string, string];
        const realTier = SKILL_TIERS[skill];
        if (realTier !== claimedTier) {
          wrong.push(
            `${profile}/${step.id}: evidence says \`${skill}\` is shipped at "${claimedTier}", ` +
              `setup.d/lib.sh ships it at "${realTier ?? '(no tier — unknown skill)'}"`,
          );
        }
      }
    }
    // Non-vacuity: a regex that stopped matching would make this arm pass on any drift.
    expect(checked, 'no «shipped at <tier>» evidence claim was parsed at all').toBeGreaterThan(0);
    expect(wrong, `Evidence claims contradicting setup.d/lib.sh:\n${wrong.join('\n')}`).toEqual([]);
  });

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
