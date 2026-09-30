/**
 * Principle 49 — night-mode and tier-home name the same executor tier
 *
 * > **Authoritative for:** the parity between the tier vocabulary of
 * > `packages/core/templates/shared/tier-home.md` §2 (the tier-criteria SSOT) and the
 * > «Overnight model posture» of `.claude/skills/night-mode/SKILL.md` (the tier→model
 * > instantiation home): the implementer and fix roles sit on the tier tier-home calls the
 * > **executor tier**, and that tier is not also a review seat.
 * > **NOT authoritative for:** project goal — see README.md#why-this-exists. Which concrete
 * > model fills a tier — night-mode's posture paragraph and the aif runtime profile config.
 *
 * ## Why this gate exists
 *
 * tier-home says the executor tier implements and the top tier reviews from above. Until
 * 2026-10-01 night-mode put the implementer on its «next tier» together with the per-task review
 * seat and called it «the quality-first floor», so a coordinator reading night-mode raised
 * implementer and fix subagents to the review tier. Incident 2026-07-21 (#931 SDD run): the
 * coordinator flagged a Sonnet implementer as a floor miss and offered an Opus re-dispatch; the
 * operator's answer was that implementer and fix run on the executor tier and the review layer
 * above them is the safety net. The contradiction then lived only in agent memory for ten weeks.
 *
 * ## Channel (.claude/rules/rule-enforcement-channel-selection.md §3)
 *
 * Whether two docs assign the same role to the same named tier is mechanically decidable from
 * their bold `**<tier> → <roles>**` assignments, so it is a gate. The principles suite runs at
 * pre-push and in CI; both files are repo-wide authority, not change-scoped.
 *
 * ## Declared limits
 *
 * Only bold `**<tier> → <roles>**` pairs on the posture line are read. Model names in
 * parentheses are not checked — they are instantiation, which is allowed to slide.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const TIER_HOME = 'packages/core/templates/shared/tier-home.md';
const NIGHT_MODE = '.claude/skills/night-mode/SKILL.md';
const EXECUTOR = 'executor tier';

function checkParity(tierHome: string, nightMode: string): string[] {
  const out: string[] = [];
  const def = /\*\*executor tier\*\* = ([^;.]*)/.exec(tierHome);
  if (!def) out.push(`${TIER_HOME}: no «**executor tier** = …» definition`);
  else if (!/\bimplements\b/.test(def[1]))
    out.push(
      `${TIER_HOME}: executor tier definition does not say it implements`,
    );

  const posture = nightMode
    .split('\n')
    .find((l) => l.includes('Overnight model posture'));
  if (!posture)
    return [...out, `${NIGHT_MODE}: no «Overnight model posture» line`];
  const pairs = [...posture.matchAll(/\*\*([a-z-]+ tier) → ([^*]+)\*\*/g)].map(
    (m) => ({ tier: m[1], roles: m[2] }),
  );
  const exec = pairs.filter((p) => p.tier === EXECUTOR);
  if (exec.length !== 1)
    out.push(
      `${NIGHT_MODE}: posture must assign exactly one «**${EXECUTOR} → …**», found ${exec.length}`,
    );
  for (const p of exec) {
    if (!/implementer/.test(p.roles) || !/\bfix\b/.test(p.roles))
      out.push(
        `${NIGHT_MODE}: «${p.tier} → ${p.roles}» must name implementer and fix`,
      );
    if (/review/.test(p.roles))
      out.push(
        `${NIGHT_MODE}: «${p.tier} → ${p.roles}» also holds a review seat`,
      );
  }
  for (const p of pairs) {
    if (p.tier !== EXECUTOR && /executor|implementer|\bfix\b/.test(p.roles)) {
      out.push(
        `${NIGHT_MODE}: «${p.tier} → ${p.roles}» puts executor work off the ${EXECUTOR}`,
      );
    }
  }
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

  it('paired negative: an executor tier that also reviews is RED', () => {
    const v = checkParity(
      HOME_OK,
      NIGHT_NEW.replace(
        'implementer + fix subagents',
        'implementer + fix + per-task review',
      ),
    );
    expect(v.some((m) => m.includes('also holds a review seat'))).toBe(true);
  });

  it('paired negative: tier-home without an implementing executor tier is RED', () => {
    expect(
      checkParity(
        '**executor tier** = the cheap model (reviews only).',
        NIGHT_NEW,
      ),
    ).toHaveLength(1);
  });

  it('positive fixture passes', () => {
    expect(checkParity(HOME_OK, NIGHT_NEW)).toEqual([]);
  });

  it('live: tier-home and night-mode agree on the executor tier', () => {
    const read = (p: string) => readFileSync(resolve(REPO_ROOT, p), 'utf8');
    expect(checkParity(read(TIER_HOME), read(NIGHT_MODE))).toEqual([]);
  });
});
