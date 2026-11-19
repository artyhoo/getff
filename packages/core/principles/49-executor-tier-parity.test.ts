/**
 * Principle 49 — night-mode and tier-home name the same executor tier
 *
 * > **Authoritative for:** the parity between the tier vocabulary of
 * > `packages/core/templates/shared/tier-home.md` §2 (the tier-criteria SSOT) and the
 * > «Overnight model posture» of `.agents/procedures/night-mode/SKILL.md` (the tier→model
 * > instantiation home): the implementer and fix roles sit on the tier tier-home calls the
 * > **executor tier**, and the per-task review seat sits on a separate tier above it.
 * > **NOT authoritative for:** project goal — see README.md#why-this-exists. Which concrete
 * > model fills a tier — night-mode's posture paragraph and the aif runtime profile config.
 * > Whether the executor tier may also review from below — it may (tier-home §2); this gate
 * > only requires that the per-task review is not left to the executor alone.
 *
 * ## Why this gate exists
 *
 * tier-home says the executor tier implements. Until 2026-10-01 night-mode put the implementer
 * on its «next tier» together with the per-task review seat and called it «the quality-first
 * floor», so a coordinator reading night-mode raised implementer and fix subagents to the review
 * tier. Incident 2026-07-21 (#931 SDD run): the coordinator flagged a Sonnet implementer as a
 * floor miss and offered an Opus re-dispatch; the operator's answer was that implementer and fix
 * run on the executor tier and the review layer above them is the safety net. The contradiction
 * then lived only in agent memory for ten weeks.
 *
 * ## Channel (.claude/rules/rule-enforcement-channel-selection.md §3)
 *
 * Whether two docs assign the same role to the same named tier is mechanically decidable from
 * their bold `**<tier> → <roles>**` assignments, so it is a gate. The principles suite runs at
 * pre-push and in CI; both files are repo-wide authority, not change-scoped.
 *
 * ## Declared limits
 *
 * Only bold `**<tier> → <roles>**` pairs inside the posture paragraph (the blank-line-delimited
 * block that contains «Overnight model posture») are read; an assignment written without bold
 * is not seen. Model names in parentheses are not checked — they are instantiation, which is
 * allowed to slide.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const TIER_HOME = 'packages/core/templates/shared/tier-home.md';
const NIGHT_MODE = '.agents/procedures/night-mode/references/substrate-and-models.md';
const NIGHT_CARD = '.agents/procedures/night-mode/SKILL.md';
const EXECUTOR = 'executor tier';

const EXECUTOR_WORK = /executor|implement|\bfix/i;

function checkParity(tierHome: string, nightMode: string): string[] {
  const out: string[] = [];
  const def = /\*\*executor tier\*\* = ([^;.]*)/.exec(tierHome);
  if (!def) out.push(`${TIER_HOME}: no «**executor tier** = …» definition`);
  else if (!/\bimplements\b/.test(def[1]))
    out.push(
      `${TIER_HOME}: executor tier definition does not say it implements`,
    );

  const posture = nightMode
    .split(/\n\s*\n/)
    .find((b) => b.includes('Overnight model posture'));
  if (!posture)
    return [...out, `${NIGHT_MODE}: no «Overnight model posture» paragraph`];
  const pairs = [...posture.matchAll(/\*\*([a-z-]+ tier) → ([^*]+)\*\*/g)].map(
    (m) => ({
      tier: m[1],
      roles: m[2].replace(/\s+/g, ' '),
    }),
  );
  const exec = pairs.filter((p) => p.tier === EXECUTOR);
  if (exec.length !== 1)
    out.push(
      `${NIGHT_MODE}: posture must assign exactly one «**${EXECUTOR} → …**», found ${exec.length}`,
    );
  for (const p of exec) {
    if (!/implement/i.test(p.roles) || !/\bfix/i.test(p.roles))
      out.push(
        `${NIGHT_MODE}: «${p.tier} → ${p.roles}» must name implementer and fix`,
      );
  }
  for (const p of pairs) {
    if (p.tier !== EXECUTOR && EXECUTOR_WORK.test(p.roles))
      out.push(
        `${NIGHT_MODE}: «${p.tier} → ${p.roles}» puts executor work off the ${EXECUTOR}`,
      );
  }
  if (
    !pairs.some((p) => p.tier !== EXECUTOR && /per-task review/i.test(p.roles))
  )
    out.push(
      `${NIGHT_MODE}: no tier above the ${EXECUTOR} holds the per-task review seat`,
    );
  if (/quality-first floor/.test(posture))
    out.push(
      `${NIGHT_MODE}: posture still calls a tier «the quality-first floor»`,
    );
  return out;
}

const HOME_OK =
  'Roles below: **top tier** = the strongest; **executor tier** = the cheaper model (implements, reviews from below).';
const NIGHT_OLD =
  "**Overnight model posture** x: **top tier → advisor + final review** (Claude: Fable); **next tier → executor + SDD's per-task review seat** (Claude: Opus) — the quality-first floor for the overnight run; **cheaper tier → mechanical increments** (Claude: Sonnet).";
const NIGHT_NEW =
  '**Overnight model posture** x: **top tier → advisor + final review** (Claude: Fable); **review tier → per-task review seat** (Claude: Opus); **executor tier → implementer + fix subagents** (Claude: Sonnet).';

describe('principle 49 — executor-tier parity (tier-home ↔ night-mode)', () => {
  it('paired negative: the pre-2026-10-01 posture line is RED', () => {
    const v = checkParity(HOME_OK, NIGHT_OLD);

    expect(v.some((m) => m.includes('exactly one'))).toBe(true);
    expect(
      v.some(
        (m) => m.includes('next tier') && m.includes('off the executor tier'),
      ),
    ).toBe(true);
    expect(v.some((m) => m.includes('quality-first floor'))).toBe(true);
  });

  it('paired negative: an executor tier that names implementer but not fix is RED', () => {
    const v = checkParity(
      HOME_OK,
      NIGHT_NEW.replace('implementer + fix subagents', 'implementer subagents'),
    );

    expect(v).toEqual([
      expect.stringContaining('must name implementer and fix'),
    ]);
  });

  it('paired negative: a review tier that takes implementation or fixes is RED', () => {
    const v = checkParity(
      HOME_OK,
      NIGHT_NEW.replace('per-task review seat', 'per-task review seat + fixes'),
    );

    expect(v).toEqual([expect.stringContaining('off the executor tier')]);
  });

  it('paired negative: per-task review left to the executor alone is RED', () => {
    const v = checkParity(
      HOME_OK,
      NIGHT_NEW.replace(
        '**review tier → per-task review seat** (Claude: Opus); ',
        '',
      ),
    );

    expect(v).toEqual([
      expect.stringContaining('holds the per-task review seat'),
    ]);
  });

  it('paired negative: tier-home without an implementing executor tier is RED', () => {
    expect(
      checkParity(
        '**executor tier** = the cheap model (reviews only).',
        NIGHT_NEW,
      ),
    ).toEqual([expect.stringContaining('does not say it implements')]);
    expect(checkParity('no tiers here', NIGHT_NEW)).toEqual([
      expect.stringContaining('definition'),
    ]);
  });

  it('paired negative: night-mode without the posture paragraph is RED', () => {
    expect(checkParity(HOME_OK, 'no posture')).toEqual([
      expect.stringContaining('paragraph'),
    ]);
  });

  it('a reflowed posture paragraph is still read across its lines', () => {
    const v = checkParity(
      HOME_OK,
      NIGHT_NEW.replace('; **executor tier', ';\n**executor tier') +
        '\n**next tier → implementation** x',
    );

    expect(v).toEqual([expect.stringContaining('off the executor tier')]);
  });

  it('positive fixture passes', () => {
    expect(checkParity(HOME_OK, NIGHT_NEW)).toEqual([]);
  });

  it('live: tier-home and night-mode agree on the executor tier', () => {
    const read = (p: string) => readFileSync(resolve(REPO_ROOT, p), 'utf8');

    expect(read(NIGHT_CARD)).toContain('[substrate and models](references/substrate-and-models.md) before choosing');
    expect(checkParity(read(TIER_HOME), read(NIGHT_MODE))).toEqual([]);
  });
});
