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

// ── The road: ONE ordered step list from install to report ───────────────────────────────────
//
// WHY: the install prompt is what an agent actually walks, and it used to be hand-written prose
// that ended in «Stop here» and asked up to four questions. The road is that list as DATA (the
// top-level `road` key of the same SSOT), and the prompt in INSTALL-FOR-AI.md is its render. A
// step added to one side only, a reordered step or a renamed step is RED here, so a part that
// plugs a step into the road cannot forget the prompt.
//
// `road` is deliberately NOT inside `sequences`: scripts/render-face-facts.mjs copies `sequences`
// and `renders` verbatim into the site facts, and the road is not a per-profile First-Steps list.
interface RoadStep {
  id: string;
  title: string;
  action: string;
  doneTest: string;
}
interface Road {
  goal: string;
  render: string;
  steps: RoadStep[];
}

const PROMPT_PATH = 'INSTALL-FOR-AI.md';
const README_PATH = 'README.md';

/** The first ```text fence after the «Quick install» heading — the prompt a human pastes. */
function promptBlock(md: string): string {
  const head = md.indexOf('## Quick install');
  if (head === -1) return '';
  const open = md.indexOf('```text\n', head);
  if (open === -1) return '';
  const close = md.indexOf('\n```', open + 8);
  return close === -1 ? '' : md.slice(open + 8, close);
}

/** A rendered road step is a line `N. [<id>] <title>` — the id is the identity, the title the text. */
function promptSteps(block: string): Array<{ id: string; title: string }> {
  return [...block.matchAll(/^\d+\.\s+\[([a-z0-9-]+)\]\s+(.+?)\s*$/gm)].map(
    (m) => ({
      id: m[1] as string,
      title: m[2] as string,
    }),
  );
}

describe('The road ↔ install prompt parity', () => {
  const road = (source as unknown as { road?: Road }).road;
  const prompt = promptBlock(
    readFileSync(join(REPO_ROOT, PROMPT_PATH), 'utf8'),
  );
  const readme = readFileSync(join(REPO_ROOT, README_PATH), 'utf8');

  it('the source declares the road, and every step carries an action and a done-test', () => {
    expect(road, '`road` key missing from the first-steps SSOT').toBeDefined();
    const steps = (road as Road).steps;
    expect(steps.length).toBeGreaterThan(0);
    expect((road as Road).render).toBe(PROMPT_PATH);
    for (const step of steps) {
      expect(
        step.action.trim().length,
        `road step \`${step.id}\` has no action`,
      ).toBeGreaterThan(0);
      expect(
        step.doneTest.trim().length,
        `road step \`${step.id}\` has no done-test`,
      ).toBeGreaterThan(0);
    }
    expect(new Set(steps.map((s) => s.id)).size, 'duplicate road step id').toBe(
      steps.length,
    );
  });

  it('the prompt renders the road step list, in order', () => {
    expect(
      prompt.length,
      'no ```text prompt under «Quick install»',
    ).toBeGreaterThan(0);
    const declared = ((road as Road | undefined)?.steps ?? []).map(key);
    expect(
      declared.length,
      'the road is empty — nothing to compare',
    ).toBeGreaterThan(0);
    expect(promptSteps(prompt).map(key)).toEqual(declared);
  });

  it('a reordered prompt is detected (the comparison is not vacuous)', () => {
    const steps = promptSteps(prompt);
    expect(steps.length).toBeGreaterThanOrEqual(2);
    const swapped = [steps[1], steps[0], ...steps.slice(2)] as Array<{
      id: string;
      title: string;
    }>;
    expect(swapped.map(key)).not.toEqual(
      ((road as Road | undefined)?.steps ?? []).map(key),
    );
  });

  it('the road ends with the report and asks its one question before the installer runs', () => {
    const ids = ((road as Road | undefined)?.steps ?? []).map((s) => s.id);
    expect(ids[ids.length - 1]).toBe('report');
    expect(ids.indexOf('ask-once')).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf('ask-once')).toBeLessThan(ids.indexOf('install'));
  });

  it('no prompt tells the agent to stop before the report', () => {
    expect(prompt).not.toMatch(/Stop here/);
    expect(readme).not.toMatch(/Stop here/);
  });

  it('the prompt maps the one answer to the three installer flags', () => {
    expect(prompt).toMatch(/setup -y <detected-stack>/);
    expect(prompt).toMatch(/setup -y --global <detected-stack>/);
    expect(prompt).toMatch(/setup --all <detected-stack>/);
  });

  it('the report format gives a step exactly two statuses and keeps findings out of the asks', () => {
    // Found by the first agent run (2026-09-29): a third status «done, with findings», a passport
    // summary in place of its text, and getff's own defects listed as questions to the human.
    const doc = readFileSync(join(REPO_ROOT, PROMPT_PATH), 'utf8');
    const head = doc.indexOf('## What the AI will produce');
    expect(head).toBeGreaterThan(-1);
    const section = doc.slice(head, doc.indexOf('\n---', head));
    const statuses = [...section.matchAll(/^<n>\. \[<id>\] <title> — (.+)$/gm)].map((m) => m[1]);
    expect(statuses).toEqual(['done', 'not done: <reason>']);
    // Prose wraps, so the three rules are matched on whitespace-normalised text.
    const prose = section.replace(/\s+/g, ' ');
    expect(prose).toMatch(/no third status/);
    expect(prose).toMatch(/never a summary/);
    expect(prose).toMatch(/A defect of getff itself is a finding/);
  });

  it('the road places the rules with the installer and asks for their proof exactly once', () => {
    const steps = (road as Road | undefined)?.steps ?? [];
    const place = steps.find((s) => s.id === 'place-rules');
    const prove = steps.find((s) => s.id === 'prove-rules');
    expect(place?.action).toMatch(/setup --full <stack>/);
    expect(place?.doneTest).toMatch(/one row per rule/);
    expect(prove?.doneTest).toMatch(/bad→exit ≠0, good→exit 0/);
    // One run of the proof serves both steps: two rows that each run it would ask for the same proof.
    const runs = steps.filter((s) =>
      /run `node scripts\/prove-rules\.mjs --prove`/.test(s.action),
    );
    expect(runs.map((s) => s.id)).toEqual(['place-rules']);
    expect(prompt).toMatch(/setup --full <detected-stack>/);
    expect(prompt.match(/node scripts\/prove-rules\.mjs --prove/g)).toHaveLength(1);
  });

  it('no road step is a placeholder: each one names what it reads', () => {
    // Found by the cold run (2026-09-30): steps 7 and 8 still read «not built yet» after the things
    // they read had shipped, so the report stated a false reason and the agent improvised the list.
    const steps = (road as Road | undefined)?.steps ?? [];
    expect(JSON.stringify(steps)).not.toMatch(/not built yet/i);
    expect(prompt).not.toMatch(/not built yet/i);
    const reads: Record<string, RegExp> = {
      'tools-parity': /getff:installed-versions/,
      'base-core-status': /\.claude\/skills\/getff\/references\/base-core\.md/,
      'project-checks': /aif:project-checks/,
    };
    for (const [id, what] of Object.entries(reads)) {
      const step = steps.find((s) => s.id === id);
      expect(step?.action, `road step \`${id}\` does not name what it reads`).toMatch(what);
      expect(step?.action, `road step \`${id}\` has no fallback`).toMatch(/«not done/);
      expect(prompt, `the prompt does not name what \`${id}\` reads`).toMatch(what);
    }
  });

  it('the one question carries every pre-launch choice the installer waits for', () => {
    // The installer writes two groups only on a pre-launch «yes» that reaches it as a variable;
    // a choice the question never offers cannot be made through the road.
    const ask = ((road as Road | undefined)?.steps ?? []).find((s) => s.id === 'ask-once');
    for (const name of ['GETFF_SESSION_SETTINGS=1', 'GETFF_STACK_TOOLS=1']) {
      expect(ask?.action, `the question does not offer ${name}`).toContain(name);
      expect(prompt, `the prompt does not pass ${name}`).toContain(name);
    }
    expect(prompt.match(/\bask once\b/gi), 'the prompt must ask exactly once').toHaveLength(1);
  });

  it('a part the answer leaves out has one stated default, the same in the data and the prompt', () => {
    // Both opt-in groups default to yes (operator decisions 2026-09-30). The road carries the
    // defaults, not the installer: a bare `setup -y` run by hand behaves as before.
    const ask = ((road as Road | undefined)?.steps ?? []).find((s) => s.id === 'ask-once');
    const defaults = /\(a\) 1, \(b\) yes, \(c\) yes, \(d\) yes/;
    expect(ask?.action.replace(/\s+/g, ' ')).toMatch(defaults);
    expect(prompt.replace(/\s+/g, ' ')).toMatch(defaults);
    expect(prompt).toMatch(/unless I say no/);
  });

  it('a choice that defaults to yes says in plain words what the person gets', () => {
    const ask = ((road as Road | undefined)?.steps ?? []).find((s) => s.id === 'ask-once');
    for (const text of [ask?.action ?? '', prompt]) {
      const flat = text.replace(/\s+/g, ' ');
      expect(flat).toMatch(/handoff gate holds a turn/);
      expect(flat).toMatch(/deny list makes the agent refuse/);
      expect(flat).toMatch(/one undo command/);
    }
  });

  it('the tools step checks two sources and probes nothing itself', () => {
    const tools = ((road as Road | undefined)?.steps ?? []).find((s) => s.id === 'tools-parity');
    for (const text of [tools?.action ?? '', prompt]) {
      expect(text).toMatch(/getff:installed-versions/);
      expect(text).toMatch(/NOT[- ]wired/);
      expect(text).not.toMatch(/claude mcp get/);
    }
  });

  it('the research step takes the one answer as its confirmation', () => {
    const research = ((road as Road | undefined)?.steps ?? []).find((s) => s.id === 'research');
    expect(research?.action).toMatch(/without asking/);
    expect(prompt).toMatch(/without asking/);
  });

  it('the preview shows the stack word as the installer prints it', () => {
    const preview = ((road as Road | undefined)?.steps ?? []).find((s) => s.id === 'preview');
    expect(preview?.action).toMatch(/`generic`/);
    expect(prompt).toMatch(/`generic`/);
    expect(prompt).not.toMatch(/else unknown/);
  });

  it('the shipped road names no internal program part', () => {
    // The SSOT is part of the shipped package payload; «P1»…«P6» are this repo's planning names.
    expect(road, '`road` key missing from the first-steps SSOT').toBeDefined();
    expect(JSON.stringify(road)).not.toMatch(/\bP[0-6]\b/);
  });
});
