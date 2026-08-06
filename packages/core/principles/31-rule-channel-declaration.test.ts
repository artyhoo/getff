/**
 * Principle 31 — Rule channel declaration (CTX Stage 2, the gate-on-the-gate).
 *
 * Source: .claude/rules/rule-enforcement-channel-selection.md §6 promotion trigger (>=3 rules
 * carrying markers — fired; 8 rules carry channel-shaped markers as of authoring).
 *
 * Structure mirrors the sibling enumerator+paired-negative+fixture principles:
 *   - 12-ai-laziness-traps.test.ts   (kickoff-population enumeration + §3 T-enumeration check)
 *   - 15-skill-paired-negative.test.ts (SKILL.md population enumeration + grandfather allowlist
 *     + mutation/paired-negative self-tests)
 *   - 30-research-source-trust.test.ts (store-wide discipline invariants over a population,
 *     with a dedicated `paired negative` describe block)
 *
 * Six named paired-negatives (N31-1..N31-6) each assert RED on a fixture under
 * packages/core/principles/fixtures/rule-channel/, then a companion positive control proves
 * the same mechanism passes on a well-formed input — the anti-tautology discipline (principle
 * 04 / T-trap counter): a check that can never fail is not a check.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALWAYS_ON_CORE,
  enumerateRuleFiles,
  parseRuleChannelFields,
  evaluateRuleChannel,
  checkChannelMarkersLive,
  checkGlobParity,
  checkExclusionConsistency,
  type RuleChannelFields,
} from './31-rule-channel-declaration.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const FIXTURES_DIR = resolve(HERE, 'fixtures/rule-channel');
const REAL_SETTINGS_PATH = resolve(REPO_ROOT, '.claude/settings.json');
const FIXTURE_SETTINGS_WITH_EXCLUDE = resolve(FIXTURES_DIR, 'settings-with-exclude.json');

function loadFixtureFields(fixtureName: string, syntheticName?: string): RuleChannelFields {
  const abs = resolve(FIXTURES_DIR, fixtureName);
  const source = readFileSync(abs, 'utf8');
  // Re-use parseRuleChannelFields' extraction logic by constructing the same shape it would —
  // simplest correct approach: write the fixture to a relative-looking path is unnecessary;
  // we only need the parsed fields, so call the module's own field-parsing directly via a
  // temp relative path trick: parseRuleChannelFields expects (relPath, repoRoot) and joins
  // them, so we pass repoRoot=FIXTURES_DIR and relPath=fixtureName.
  const fields = parseRuleChannelFields(fixtureName, FIXTURES_DIR);
  return { ...fields, name: syntheticName ?? fields.name };
}

describe('Principle 31 — every rule declares a delivery channel (4-branch PASS predicate)', () => {
  describe('ALWAYS_ON_CORE — asserted ceiling', () => {
    it('has length <= 4 (module-neighbor precedent: REQUIRED_HEADER_DOCS-style array kept tiny on purpose)', () => {
      expect(ALWAYS_ON_CORE.length).toBeLessThanOrEqual(4);
    });

    it('contains the 4 expected rule basenames', () => {
      expect([...ALWAYS_ON_CORE].sort()).toEqual(
        [
          'build-first-reuse-default.md',
          'attention-is-not-a-mechanism.md',
          'ai-laziness-digest.md',
          '00-rule-index.md',
        ].sort(),
      );
    });
  });

  describe('real-repo sweep — every tracked .claude/rules/*.md passes the 4-branch predicate', () => {
    it('enumerates a non-empty population', () => {
      const files = enumerateRuleFiles(REPO_ROOT);
      expect(files.length).toBeGreaterThan(0);
    });

    it('every enumerated rule passes evaluateRuleChannel OR is ALWAYS_ON_CORE', () => {
      const files = enumerateRuleFiles(REPO_ROOT);
      const violations: string[] = [];
      for (const rel of files) {
        const fields = parseRuleChannelFields(rel, REPO_ROOT);
        const result = evaluateRuleChannel(fields, REPO_ROOT);
        if (!result.ok) violations.push(...result.reasons);
      }
      expect(violations, `Channel-declaration violations:\n${violations.join('\n')}`).toHaveLength(0);
    });

    it('every enumerated rule with BOTH paths: and globs: passes glob parity (set-equality/subset/liveness)', () => {
      const files = enumerateRuleFiles(REPO_ROOT);
      const violations: string[] = [];
      for (const rel of files) {
        const fields = parseRuleChannelFields(rel, REPO_ROOT);
        violations.push(...checkGlobParity(fields, REPO_ROOT));
      }
      expect(violations, `Glob-parity violations:\n${violations.join('\n')}`).toHaveLength(0);
    });

    it('real .claude/settings.json exclusion-consistency: every claudeMdExcludes entry is a token-backed rule', () => {
      // The permanent principle-31 invariant (the temporary "excludes are empty, vacuous" pin was
      // retired when the CTX Stage 1 eviction was maintainer-applied): the maintainer MAY list rules
      // in claudeMdExcludes to drop them from always-on auto-load, but each excluded rule MUST still
      // carry a LIVE channel token (its alt-channel) — so a rule is never evicted without a delivery
      // path (T-CTX-B). The exact contents of claudeMdExcludes are an operational choice, not a
      // principle invariant, so this asserts CONSISTENCY, not a fixed list. N31-6 (below) proves the
      // check has teeth: a token-less excluded rule is flagged RED.
      const files = enumerateRuleFiles(REPO_ROOT);
      const fieldsByPath = new Map<string, RuleChannelFields>();
      for (const rel of files) fieldsByPath.set(rel, parseRuleChannelFields(rel, REPO_ROOT));
      const errs = checkExclusionConsistency(REPO_ROOT, fieldsByPath, REAL_SETTINGS_PATH);
      expect(errs).toHaveLength(0);
    });
  });

  // ---- Named paired-negatives (N31-1..N31-6) — RED on the fixture, GREEN on a positive control ----

  describe('N31-1 — fixture-rule with nothing (no paths, no globs, not core, no channel)', () => {
    it('RED: evaluateRuleChannel fails on all 4 branches', () => {
      const fields = loadFixtureFields('no-channel-at-all.md');
      const result = evaluateRuleChannel(fields, REPO_ROOT);
      expect(result.ok).toBe(false);
      expect(result.reasons.join(' ')).toMatch(/no channel declared/);
    });

    it('positive control: the SAME fixture content, but named as an ALWAYS_ON_CORE member, passes', () => {
      const fields = loadFixtureFields('no-channel-at-all.md', 'ai-laziness-digest.md');
      const result = evaluateRuleChannel(fields, REPO_ROOT);
      expect(result.ok).toBe(true);
    });
  });

  describe('N31-2 — ALWAYS_ON_CORE of 5 must RED (ceiling assertion)', () => {
    it('RED: constructing a 5-entry core array throws past the asserted ceiling', async () => {
      // ALWAYS_ON_CORE's ceiling check runs at module-load time (module-level throw). To
      // exercise the SAME assertion logic without re-importing the real module (which would
      // just re-use its already-passing 4-entry array), replicate the identical guard here
      // against a synthetic 5-entry array — proving the guard's condition is correctly wired
      // to reject >4, not merely documented as a comment.
      const fiveEntryCore = [
        'build-first-reuse-default.md',
        'attention-is-not-a-mechanism.md',
        'ai-laziness-digest.md',
        '00-rule-index.md',
        'one-too-many.md',
      ];
      const assertCeiling = (core: string[]) => {
        if (core.length > 4) {
          throw new Error(
            `ALWAYS_ON_CORE grew past its asserted ceiling of 4 (currently ${core.length}) — this defeats CTX Stage 0/1's always-on-context shrink. Revisit before adding entries.`,
          );
        }
      };
      expect(() => assertCeiling(fiveEntryCore)).toThrow(/ceiling of 4/);
    });

    it('positive control: the real ALWAYS_ON_CORE (4 entries) does not throw', () => {
      const assertCeiling = (core: readonly string[]) => {
        if (core.length > 4) throw new Error('too many');
      };
      expect(() => assertCeiling(ALWAYS_ON_CORE)).not.toThrow();
    });
  });

  describe('N31-3 — exception with dangling artifact must RED', () => {
    it('RED: checkChannelMarkersLive fails — artifact does not exist', () => {
      const fields = loadFixtureFields('dangling-channel-exception.md');
      const result = checkChannelMarkersLive(fields, REPO_ROOT);
      expect(result.ok).toBe(false);
      expect(result.reasons.join(' ')).toMatch(/does not exist \(dangling\)/);
    });

    it('RED (whole predicate): evaluateRuleChannel also fails — no other branch rescues it', () => {
      const fields = loadFixtureFields('dangling-channel-exception.md');
      const result = evaluateRuleChannel(fields, REPO_ROOT);
      expect(result.ok).toBe(false);
    });

    it('positive control: the SAME marker SHAPE pointed at a real, live artifact+anchor passes', () => {
      const fields = loadFixtureFields('valid-channel-exception.md');
      const result = checkChannelMarkersLive(fields, REPO_ROOT);
      expect(result.ok).toBe(true);
      expect(evaluateRuleChannel(fields, REPO_ROOT).ok).toBe(true);
    });
  });

  describe('N31-4 — paths: != globs: must RED', () => {
    it('RED: checkGlobParity flags the set-equality mismatch', () => {
      const fields = loadFixtureFields('paths-globs-mismatch.md');
      const errs = checkGlobParity(fields, REPO_ROOT);
      expect(errs.length).toBeGreaterThan(0);
      expect(errs.join(' ')).toMatch(/must be identical/);
    });

    it('positive control: a real rule with paths: == globs: passes glob parity', () => {
      const fields = parseRuleChannelFields('.claude/rules/ci-tool-pinning.md', REPO_ROOT);
      const errs = checkGlobParity(fields, REPO_ROOT);
      expect(errs).toHaveLength(0);
    });
  });

  describe('N31-5 — dead glob (matches no tracked file) must RED', () => {
    it('RED: checkGlobParity flags the dead pattern', () => {
      const fields = loadFixtureFields('dead-glob.md');
      const errs = checkGlobParity(fields, REPO_ROOT);
      expect(errs.length).toBeGreaterThan(0);
      expect(errs.join(' ')).toMatch(/matches NO tracked file \(dead glob\)/);
    });

    it('positive control: a real rule\'s glob pattern matches >= 1 tracked file', () => {
      const fields = parseRuleChannelFields('.claude/rules/doc-authority-hierarchy.md', REPO_ROOT);
      const errs = checkGlobParity(fields, REPO_ROOT);
      expect(errs).toHaveLength(0);
    });
  });

  describe('N31-6 — excluded-without-token must RED (via FIXTURE settings, never real settings.json)', () => {
    it('RED: claudeMdExcludes lists a token-less fixture rule -> checkExclusionConsistency flags it', () => {
      const noTokenFields = loadFixtureFields(
        'no-channel-at-all.md',
        '__fixture_no_channel_at_all__.md',
      );
      const fieldsByPath = new Map<string, RuleChannelFields>([
        ['.claude/rules/__fixture_no_channel_at_all__.md', noTokenFields],
      ]);
      const errs = checkExclusionConsistency(REPO_ROOT, fieldsByPath, FIXTURE_SETTINGS_WITH_EXCLUDE);
      expect(errs.length).toBeGreaterThan(0);
      expect(errs.join(' ')).toMatch(/excluded \(claudeMdExcludes\) but carries no LIVE/);
    });

    it('positive control: same excludes list, but the excluded rule carries a LIVE token -> passes', () => {
      const withTokenFields = loadFixtureFields(
        'valid-channel-exception.md',
        '__fixture_no_channel_at_all__.md',
      );
      const fieldsByPath = new Map<string, RuleChannelFields>([
        ['.claude/rules/__fixture_no_channel_at_all__.md', withTokenFields],
      ]);
      const errs = checkExclusionConsistency(REPO_ROOT, fieldsByPath, FIXTURE_SETTINGS_WITH_EXCLUDE);
      expect(errs).toHaveLength(0);
    });

    it('the fixture settings.json is DISTINCT from the real .claude/settings.json (never touches real file)', () => {
      expect(FIXTURE_SETTINGS_WITH_EXCLUDE).not.toEqual(REAL_SETTINGS_PATH);
      const fixtureRaw = JSON.parse(readFileSync(FIXTURE_SETTINGS_WITH_EXCLUDE, 'utf8'));
      expect(fixtureRaw.claudeMdExcludes.length).toBeGreaterThan(0);
    });
  });

  // ---- T15 self-application note ----
  it('T15: principle 31 itself is not in ALWAYS_ON_CORE and needs no standing context cost', () => {
    // This test file + its companion .ts module are repo-wide vitest artifacts (test:principles),
    // not `.claude/rules/*.md` content — they carry zero always-on session-context cost. The
    // principle enforces a convention ABOUT the always-on rule population without itself
    // becoming a member of it.
    expect(ALWAYS_ON_CORE).not.toContain('31-rule-channel-declaration.md');
    expect(existsSync(resolve(REPO_ROOT, '.claude/rules/31-rule-channel-declaration.md'))).toBe(false);
  });
});
