/**
 * Principle 48 — skill descriptions stay inside a byte budget
 *
 * > **Authoritative for:** the byte budget of the `description` + `when_to_use` frontmatter
 * > of every SKILL.md this repo authors or ships — per skill, and per population for the
 * > skills the model can see.
 * > **NOT authoritative for:** project goal — see README.md#why-this-exists. Whether a
 * > description routes well — `.claude/rules/skill-description-quality.md` (Class C) and the
 * > trim acceptance instrument `docs/superpowers/specs/2026-08-06-skill-trigger-inventory.md`.
 * > Skills installed from other plugins — outside the repo, see
 * > `docs/meta-factory/research-patches/2026-09-29-skill-listing-budget.md`.
 *
 * ## Why this gate exists
 *
 * The harness keeps one listing of every skill's description resident in context and caps it
 * at 1% of the context window; over the cap it drops descriptions, least-invoked first, and
 * a skill without its description can no longer be matched to a request
 * (code.claude.com/docs/en/skills, fetched 2026-09-29). Measured the same day on the
 * operator's host: 123 skills, listing at the cap, 50 entries reduced to a bare name.
 *
 * Stage S-I (PR 1229, 2026-08-06) trimmed the project descriptions under a 6,800 B ceiling
 * and verified it with a one-time host run. Nothing held the number afterwards: three skills
 * joined the population, and by 2026-09-29 the model-visible descriptions measured 6,943 B
 * (8,710 B counting the four skills the model cannot see). A budget that is checked once is
 * a measurement, not a gate — this file is the standing form.
 *
 * ## Why bytes, and why a gate is not theatre here
 *
 * `skill-description-quality.md` §2 rejects a LENGTH FLOOR as `#discipline-theatre`: a long
 * description is not thereby a good one. This gate is the opposite bound — a ceiling on a
 * resource the harness itself rations — and makes no claim about quality. Bytes rather than
 * characters because the cost is tokens and a Cyrillic trigger phrase costs about twice its
 * character count; the harness's own per-entry cut (1,536 characters) is checked separately.
 *
 * ## What a red result asks for
 *
 * Trim workflow prose, ownership prose and body restatements. Never remove a trigger phrase,
 * a symptom string or a negative trigger — the inventory above is the instrument for that,
 * and no byte count can stand in for it. If the population legitimately grew, raise the
 * number HERE, in a reviewed diff, with the measurement that justifies it.
 *
 * ## Channel (.claude/rules/rule-enforcement-channel-selection.md)
 *
 * A byte count is mechanically decidable, so it is a gate, not an injection. The principle
 * suite is the earliest channel that fires for every author: pre-push and CI.
 *
 * ## Prior art — SSOT #294
 */
import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluate,
  listingCost,
  measurePopulation,
  type BudgetRules,
  type SkillListingCost,
} from './48-skill-description-budget';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const RULES: BudgetRules = {
  // S-I's per-description ceiling (inventory §2), now counting when_to_use as well.
  perSkillMaxBytes: 800,
  vendorEntryMaxChars: 1536,
  populations: [
    // S-I's number, applied to what the listing actually carries: the skills the model can
    // see. (S-I summed all files, description only.) Measured 2026-09-29 after the trim:
    // 6,775 B over 13 visible skills; 8,542 B over all 17.
    { population: '.claude/skills', totalMaxBytes: 6800 },
    // What a consumer's listing receives from the plugin. Measured: 3,803 B over 8 skills.
    { population: 'plugin/skills', totalMaxBytes: 4000 },
    // The installer-delivered sources of the same skills. Measured: 1,412 B over 2 skills.
    { population: 'skills', totalMaxBytes: 1500 },
  ],
  exceptions: [
    {
      file: '.claude/skills/orchestrator/SKILL.md',
      maxBytes: 1200,
      reason:
        'Bilingual trigger list: every phrase is match-data (language-discipline.md §1 category 3) and Cyrillic costs two bytes per letter; 1,188 B after removing the 9 triggers that were listed twice with the same scope.',
    },
  ],
};

describe('principle 48 — skill description budget', () => {
  it('holds for every skill this repo authors or ships', () => {
    const problems = evaluate(RULES, (p) => measurePopulation(REPO_ROOT, p));
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('measures a non-empty population (a moved directory must not pass vacuously)', () => {
    for (const { population } of RULES.populations)
      expect(
        measurePopulation(REPO_ROOT, population).length,
        population,
      ).toBeGreaterThan(0);
  });
});

describe('principle 48 — the extractor', () => {
  const skill = (frontmatter: string) =>
    `---\n${frontmatter}\n---\n\n# Body\n\ndescription: not frontmatter\n`;

  it('counts description and when_to_use, and nothing else', () => {
    const bare = listingCost(skill('name: a\ndescription: Use when X.'));
    expect(bare.bytes).toBe(Buffer.byteLength('Use when X.'));

    const withTools = listingCost(
      skill(
        'name: a\ndescription: Use when X.\nallowed-tools: Bash(git:*), Read, Write\nargument-hint: "[path]"\nmodel: opus',
      ),
    );
    // Deleting permissions must never be a way to satisfy the budget.
    expect(withTools.bytes).toBe(bare.bytes);

    const withWhen = listingCost(
      skill('name: a\ndescription: Use when X.\nwhen_to_use: alpha, beta'),
    );
    expect(withWhen.bytes).toBe(
      Buffer.byteLength('Use when X.') + Buffer.byteLength('alpha, beta'),
    );
  });

  it('reads block scalars and counts bytes, not characters', () => {
    const c = listingCost(
      skill('name: a\ndescription: |\n  правило\n  rule\nwhen_to_use: x'),
    );
    expect(c.chars).toBe('правило\nrule'.length + 1);
    expect(c.bytes).toBe(Buffer.byteLength('правило\nrule') + 1);
    expect(c.bytes).toBeGreaterThan(c.chars);
  });

  // Every shape below measured SHORT before the reader learned it (cold review,
  // 2026-09-29) — an under-count is the dangerous direction: the gate stays green.
  it.each([
    [
      'plain scalar wrapped onto indented lines',
      'description: Use when X\n  and also Y\n  and Z',
      'Use when X and also Y and Z',
    ],
    [
      'double-quoted value wrapped onto a second line',
      'description: "Use when\n  X and Y"',
      'Use when X and Y',
    ],
    [
      'escaped quote inside double quotes',
      'description: "say \\"hi\\" now"',
      'say "hi" now',
    ],
    [
      'doubled quote inside single quotes',
      "description: 'it''s fine'",
      "it's fine",
    ],
    [
      'block scalar with an indentation indicator',
      'description: |2\n  first line\n  second line',
      'first line\nsecond line',
    ],
    [
      'block scalar keeping a deeper-indented line',
      'description: |\n  top\n    nested\n  tail',
      'top\n  nested\ntail',
    ],
    [
      'folded scalar',
      'description: >-\n  folded one\n  folded two',
      'folded one\nfolded two',
    ],
    [
      'space before the colon',
      'description : Use when spaced',
      'Use when spaced',
    ],
    [
      'key after a block scalar',
      'description: |\n  block\nwhen_to_use: after',
      'blockafter',
    ],
  ])('measures a %s in full', (_name, frontmatter, listed) => {
    expect(listingCost(skill(`name: a\n${frontmatter}`)).bytes).toBe(
      Buffer.byteLength(listed),
    );
  });

  it('reads through a BOM, CRLF line ends and a padded fence', () => {
    const want = Buffer.byteLength('Use when X.');
    expect(
      listingCost('\uFEFF---\nname: a\ndescription: Use when X.\n---\n').bytes,
    ).toBe(want);
    expect(
      listingCost('---\r\nname: a\r\ndescription: Use when X.\r\n---\r\n')
        .bytes,
    ).toBe(want);
    expect(
      listingCost('\n--- \nname: a\ndescription: Use when X.\n--- \n').bytes,
    ).toBe(want);
  });

  it('ignores a description key nested under another key', () => {
    expect(
      listingCost(
        skill(
          'name: a\nmetadata:\n  description: nested, not the listing text',
        ),
      ).bytes,
    ).toBe(0);
  });

  it('recognises a skill the model cannot see', () => {
    expect(
      listingCost(
        skill('name: a\ndescription: X\ndisable-model-invocation: true'),
      ).hidden,
    ).toBe(true);
    expect(listingCost(skill('name: a\ndescription: X')).hidden).toBe(false);
    expect(listingCost('# no frontmatter at all\n')).toEqual({
      bytes: 0,
      chars: 0,
      hidden: false,
    });
  });
});

describe('principle 48 — paired negatives', () => {
  const cost = (
    skill: string,
    bytes: number,
    extra: Partial<SkillListingCost> = {},
  ): SkillListingCost => ({
    skill,
    file: `pop/${skill}/SKILL.md`,
    bytes,
    chars: bytes,
    hidden: false,
    ...extra,
  });
  const rules = (over: Partial<BudgetRules> = {}): BudgetRules => ({
    perSkillMaxBytes: 800,
    vendorEntryMaxChars: 1536,
    populations: [{ population: 'pop', totalMaxBytes: 2000 }],
    exceptions: [],
    ...over,
  });

  it('passes a population inside both bounds', () => {
    expect(evaluate(rules(), () => [cost('a', 800), cost('b', 700)])).toEqual(
      [],
    );
  });

  it('fails one oversized description', () => {
    const p = evaluate(rules(), () => [cost('a', 801)]);
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('pop/a/SKILL.md');
    expect(p[0]).toContain('801 B');
  });

  it('fails a population that grew past its total while each skill is fine', () => {
    const p = evaluate(rules(), () => [
      cost('a', 700),
      cost('b', 700),
      cost('c', 700),
    ]);
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('total 2100 B');
  });

  it('keeps a hidden skill out of the total but not out of the per-skill cap', () => {
    expect(
      evaluate(rules(), () => [
        cost('a', 700),
        cost('b', 700),
        cost('c', 700, { hidden: true }),
      ]),
    ).toEqual([]);
    expect(
      evaluate(rules(), () => [cost('c', 900, { hidden: true })]),
    ).toHaveLength(1);
  });

  it('honours an exception up to its own ceiling and no further', () => {
    const ex = {
      file: 'pop/a/SKILL.md',
      maxBytes: 1100,
      reason: 'bilingual trigger list, measured and deduplicated',
    };
    expect(
      evaluate(rules({ exceptions: [ex] }), () => [cost('a', 1100)]),
    ).toEqual([]);
    expect(
      evaluate(rules({ exceptions: [ex] }), () => [cost('a', 1101)]),
    ).toHaveLength(1);
  });

  it('rejects an exception that is unexplained, pointless or stale', () => {
    const base = { file: 'pop/a/SKILL.md', maxBytes: 1100 };
    expect(
      evaluate(rules({ exceptions: [{ ...base, reason: 'TODO' }] }), () => [
        cost('a', 10),
      ])[0],
    ).toContain('rationale');
    expect(
      evaluate(
        rules({
          exceptions: [{ ...base, maxBytes: 800, reason: 'x'.repeat(30) }],
        }),
        () => [cost('a', 10)],
      )[0],
    ).toContain('not above the general cap');
    expect(
      evaluate(
        rules({ exceptions: [{ ...base, reason: 'x'.repeat(30) }] }),
        () => [cost('other', 10)],
      )[0],
    ).toContain('stale');
  });

  it('fails a skill whose description it could not read', () => {
    const p = evaluate(rules(), () => [cost('a', 0)]);
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('no readable description');
  });

  it('flags an entry the harness itself would cut', () => {
    const p = evaluate(
      rules({
        perSkillMaxBytes: 5000,
        populations: [{ population: 'pop', totalMaxBytes: 9000 }],
      }),
      () => [cost('a', 1600)],
    );
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('1536');
  });
});
