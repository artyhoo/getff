/**
 * Principle 12 — ai-laziness-traps kickoff citation enforcement
 *
 * Source: .claude/rules/ai-laziness-traps.md §3 (kickoff-author obligations)
 *         docs/meta-factory/research-patches/2026-05-16-prose-rules-audit-research.md §3.1
 *         (Track 3 evidence-based probe confirming BUILD verdict; principle 10 precedent)
 *
 * Invariant: every REAL (non-symlink) kickoff under .claude/orchestrator-prompts/<dir>/ —
 * the umbrella `kickoff.md` AND the stage-kickoff family (`kickoff-s1.md`,
 * `kickoff-s2b.md`, `kickoff-r1.md`; see STAGE_KICKOFF_RE) — excluding pre-rule exempt
 * dirs AND coordination mirrors (symlinks into $CANON authored in another worktree, see
 * isCoordinationMirror) must satisfy the COMPOUND CITATION CHECK:
 * at least ONE of the following must be present —
 *   (a) string "ai-laziness-traps" anywhere in the file (explicit rule citation)
 *   (b) pattern **T\d+** (bold Markdown T-number reference)
 *   (c) "Active traps" or "Active.*T\d+" section header
 *   (d) domain-specific T-label pattern "T-[A-Z]+-[A-Z]"
 *
 * A file that fails ALL four checks is a §3 violation: it names no traps and
 * cites no rule — equivalent to the #trap-catalogue-blanket-reference anti-pattern
 * (treating the catalogue as decoration rather than discipline).
 *
 * EXEMPT_LIST: kickoffs created before 2026-05-12 (when ai-laziness-traps.md
 * was added). No git dates available (files are gitignored); exemption is
 * maintained as an explicit list rather than a date filter.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import {
  KICKOFFS_DIR,
  STAGE_KICKOFF_RE,
  TEST_SANDBOX_RE,
  getKickoffEntries,
  isCoordinationMirror,
  type KickoffEntry,
} from './kickoff-population.ts';

/**
 * Exempt kickoff dirs (allowlist; must grow only with documented rationale):
 *  - 'aif-ssot-corrections' — pre-rule kickoff (created before 2026-05-12, when
 *    ai-laziness-traps.md was added); has inline T-refs but no explicit rule citation.
 *
 * ('qloop-ux-probe' was exempted 2026-06-01 as a question-loop test fixture, then
 *  removed 2026-06-02 once the fixture dir was gone — a stale exempt entry that the
 *  §positive-guard test correctly flagged.)
 */
const EXEMPT_LIST: readonly string[] = [
  'aif-ssot-corrections',
  // Grandfathered at the cross-session-kickoff-portability migration (SSOT #116):
  // these kickoffs predate the convention and were never citation-checked while
  // gitignored. Amnesty — NOT a free pass: any NEW kickoff (or one of these edited
  // post-migration) is still enforced. A commit-date cutoff cannot distinguish them
  // (the whole back-catalog is committed in one migration commit → identical date),
  // so the grandfathered set is an explicit allowlist (the existing EXEMPT pattern).
  'ai-doc-audit',
  'cross-worktree-symlink-iphase',
  'dispatcher-skill',
  'shipped-skill-sync',
  'worktree-cleanup-migration',
  'worktree-env-skills-test-flakiness',
];

// Compound citation check — returns true if ANY of (a)(b)(c)(d) is present.
const RULE_CITATION_RE = /ai-laziness-traps/;
const BOLD_TNUM_RE = /\*\*T\d+/;
const ACTIVE_TRAPS_RE = /Active[^\n]*T\d+/;
const DOMAIN_TNUM_RE = /T-[A-Z][A-Z0-9]*-[A-Z0-9]/;

function passesCompoundCheck(content: string): boolean {
  return (
    RULE_CITATION_RE.test(content) ||
    BOLD_TNUM_RE.test(content) ||
    ACTIVE_TRAPS_RE.test(content) ||
    DOMAIN_TNUM_RE.test(content)
  );
}

// The population itself (STAGE_KICKOFF_RE, TEST_SANDBOX_RE, getKickoffEntries,
// isCoordinationMirror) now lives in ./kickoff-population.ts — principle 40 resolves the
// same family, and two hand-kept copies of "what a kickoff is" is the copy-paste drift
// this repo names. The assertions pinning that population's behaviour stay HERE (see the
// stage-family and sandbox-exclusion cases below).

// Population sentinel bound: catch a runaway-glob explosion (absurd count), NOT
// assert a lower floor — "few or zero kickoffs" is a VALID state (fresh clone, a
// future prune, a consumer adopting /pipeline, or the portability migration's own
// transitional checkout). The old ≥100 floor was tied to this repo's ~140-umbrella
// history and would trip on any small committed set. (cross-session-kickoff-
// portability, SSOT #116.)
export const POPULATION_CAP = 1000;
export function withinPopulationBounds(n: number): boolean {
  return n >= 0 && n <= POPULATION_CAP;
}

// The citation check runs only on REAL (non-symlink) kickoffs = the ones locally authored
// or not yet adopted; a coordination mirror was checked at its authoring worktree (see
// isCoordinationMirror in ./kickoff-population.ts — the principle-12-vs-channel-G conflict,
// maintainer-directed 2026-06-02). The population sentinel below deliberately counts the
// FULL set, mirrors included, as a "mirror present" guard.
function getNonExemptEntries(): KickoffEntry[] {
  return getKickoffEntries()
    .filter((e) => !EXEMPT_LIST.includes(e.dir))
    .filter((e) => !isCoordinationMirror(e.path));
}

// KICKOFFS_DIR is gitignored — only present in local dev, absent in CI.
// Tests that require actual kickoff files skip in CI; pure-logic tests always run.
const KICKOFFS_AVAILABLE = existsSync(KICKOFFS_DIR) && getKickoffEntries().length > 0;

// After the coordination symlink migration (#346 + post-checkout link-coordination.sh),
// every local kickoff.md can be a SYMLINK into $CANON (a coordination mirror), which
// getNonExemptEntries() deliberately excludes (see isCoordinationMirror). When ALL
// kickoffs are mirrors, getNonExemptEntries() is empty — there is no REAL kickoff to
// mutate. The anti-tautology mutation test below requires ≥1 real compliant kickoff;
// the #376 mirror-exclusion fix updated the main check + sentinel but missed this guard.
// Detector correctness is independently covered by the pure-logic anti-tautology tests
// (blank file / each pattern), which need no real files — so skipping here loses nothing.
const HAS_REAL_NONEXEMPT_KICKOFF = KICKOFFS_AVAILABLE && getNonExemptEntries().length > 0;

describe('Principle 12 — every kickoff.md cites ai-laziness-traps rule', () => {
  it.skipIf(!KICKOFFS_AVAILABLE)(
    'all non-exempt kickoffs satisfy the compound citation check',
    () => {
      const entries = getNonExemptEntries();
      const violations: string[] = [];
      for (const { label, path } of entries) {
        const content = readFileSync(path, 'utf8');
        if (!passesCompoundCheck(content)) {
          violations.push(label);
        }
      }
      expect(
        violations,
        `Kickoffs missing ai-laziness-traps citation AND T-number references:\n${violations.join('\n')}`,
      ).toHaveLength(0);
    },
  );

  it.skipIf(!KICKOFFS_AVAILABLE)(
    'exempt dirs are not stale — present when the back-catalog is (tolerant of few/partial plans)',
    () => {
      // Catches a stale EXEMPT_LIST entry (a dir that no longer exists → remove it).
      // But few/partial-plan states are VALID (fresh clone, prune, consumer adoption,
      // migration transitional) — there an exempt dir is legitimately absent. Only run
      // the stale-check when the set is at least as large as the exempt list, i.e. when
      // an exempt dir SHOULD be present. (SSOT #116 few-plans-safety.)
      // DISTINCT dirs — a multi-stage umbrella now contributes several entries for one
      // dir, and counting them would inflate the "back-catalog is present" proxy below.
      const allDirs = [...new Set(getKickoffEntries().map((e) => e.dir))];
      if (allDirs.length < EXEMPT_LIST.length) return;
      for (const exemptDir of EXEMPT_LIST) {
        expect(
          allDirs,
          `Exempt dir '${exemptDir}' absent though the back-catalog is present — stale EXEMPT_LIST entry? Remove it.`,
        ).toContain(exemptDir);
      }
    },
  );

  it.skipIf(!HAS_REAL_NONEXEMPT_KICKOFF)(
    'anti-tautology: compliant kickoff stripped of citations fails the check',
    () => {
      // Pick the first compliant kickoff and strip all citation markers.
      // Verifies that the check actually detects absence — not always-true.
      const entries = getNonExemptEntries();
      const compliant = entries.find(({ path }) =>
        passesCompoundCheck(readFileSync(path, 'utf8')),
      );
      expect(compliant, 'expected at least one compliant kickoff to mutate').toBeDefined();

      const original = readFileSync(compliant!.path, 'utf8');
      // Mutate: strip every citation marker the compound check looks for.
      const stripped = original
        .replace(/ai-laziness-traps/g, 'REDACTED')
        .replace(/\*\*T\d+/g, '**REDACTED')
        .replace(/Active[^\n]*T\d+/g, 'Active traps: REDACTED')
        .replace(/T-[A-Z]+-[A-Z]/g, 'REDACTED');

      expect(
        passesCompoundCheck(stripped),
        'stripped content should FAIL the compound check (anti-tautology)',
      ).toBe(false);
    },
  );

  it('anti-tautology: blank file fails compound check', () => {
    expect(passesCompoundCheck('')).toBe(false);
    expect(passesCompoundCheck('# Kickoff\n\nSome plan without citations.')).toBe(false);
  });

  it('positive: each citation pattern individually satisfies compound check', () => {
    // Verify all four arms of the compound check independently.
    expect(passesCompoundCheck('See .claude/rules/ai-laziness-traps.md §2')).toBe(true);
    expect(passesCompoundCheck('Active traps: **T1**, **T3**, **T7**')).toBe(true);
    expect(passesCompoundCheck('Active traps for this R-phase: T1, T3, T7')).toBe(true);
    expect(passesCompoundCheck('Domain trap: T-WAVE9-A captures specific failure')).toBe(true);
  });

  it('stage-kickoff pattern admits the dispatch family and rejects sidecars', () => {
    // Both directions, because "widen the glob" fails as easily by over-reach as by
    // under-reach. The IN list is every live shape in .claude/orchestrator-prompts/;
    // the OUT list is the sidecars + the wave-dir artefacts that share the prefix.
    for (const name of [
      'kickoff-s0.md', 'kickoff-s1.md', 'kickoff-s2b.md', 'kickoff-s10.md', 'kickoff-r1.md',
    ]) {
      expect(STAGE_KICKOFF_RE.test(name), `${name} should be IN scope`).toBe(true);
    }
    for (const name of [
      'kickoff-s4.decisions.md', // owner-fork log — a record ABOUT a stage
      'kickoff-amendments.md', // audit trail extracted to clear the 600-line gate
      'kickoff.md', // the umbrella kickoff — matched separately, not by this pattern
      'done.md',
      'report.md',
      'kickoff-s1.md.bak',
      'notes-kickoff-s1.md', // anchored: the prefix must start the basename
    ]) {
      expect(STAGE_KICKOFF_RE.test(name), `${name} should be OUT of scope`).toBe(false);
    }
  });

  it('the sandbox exclusion is narrow: only the sibling suite prefix, never a real umbrella', () => {
    // Over-broad exclusion is the dangerous direction — it would silently un-gate real
    // umbrellas. Pin both sides.
    expect(TEST_SANDBOX_RE.test('c2-test-Ab12Cd')).toBe(true);
    for (const dir of [
      'triage-kernel-v2', 'beta-delivery-ux', 'modular-install-fullpack',
      'c2-something-real', 'my-c2-test-umbrella',
    ]) {
      expect(TEST_SANDBOX_RE.test(dir), `${dir} must stay gated`).toBe(false);
    }
  });

  it.skipIf(!KICKOFFS_AVAILABLE)(
    'population sentinel — catches a runaway-glob explosion (no lower floor)',
    () => {
      // Few/zero is valid (SSOT #116); only an absurd count signals a broken glob.
      const all = getKickoffEntries();
      expect(
        withinPopulationBounds(all.length),
        `kickoff count ${all.length} exceeds the runaway-glob cap ${POPULATION_CAP}`,
      ).toBe(true);
    },
  );

  it('population bounds: 0/1/few/many are valid; only an absurd glob count fails', () => {
    // Always-run (no real files needed) — proves the sentinel still catches an
    // explosion AND that the old ≥100 floor is gone (few/zero plans now pass).
    expect(withinPopulationBounds(0)).toBe(true); // fresh clone / consumer / post-prune
    expect(withinPopulationBounds(1)).toBe(true); // migration transitional state
    expect(withinPopulationBounds(142)).toBe(true); // current back-catalog
    expect(withinPopulationBounds(POPULATION_CAP)).toBe(true); // at the cap
    expect(withinPopulationBounds(POPULATION_CAP + 1)).toBe(false); // runaway glob → caught
  });
});
