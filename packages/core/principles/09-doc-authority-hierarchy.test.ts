/**
 * Principle 9 — Doc authority hierarchy (every authority-bearing doc declares Authoritative-for)
 *
 * Source: .claude/rules/doc-authority-hierarchy.md (added 2026-05-09 after
 *         goal-hierarchy restructure incident).
 *
 * Invariant: every doc designated by the rule §2 "Required for" or "Folder-
 * level authority" categories carries an explicit "> **Authoritative for:**"
 * header at the top. Filename-convention category (PHASE-*-PROMPT.md, phase-*-
 * research.md) is exempt — filename itself establishes scope.
 *
 * Why this exists: 2026-05-09 incident where docs/meta-factory/EXECUTION-PLAN.md
 * §1 silently re-defined the project goal as "recursive self-application is
 * north star", overriding README.md#why-this-exists. The drift went uncaught
 * for months because the project had code-level discipline (R1-R20, principles
 * 01-08, build-vs-reuse SSOT, search-coverage rule) but no doc-authority
 * discipline. Per arxiv:2505.02709, AI agents drift via pattern-matching on
 * authoritative-language in context, not via token-distance forgetting — so
 * structural authority declarations matter for AI-driven workflows.
 *
 * Mirrors principle 08 (prior-art-cited) test structure: positive + mutation
 * (anti-tautology) + sentinel for catalog stability.
 *
 * Sub-wave 7.1.c: logic extracted to 09-doc-authority-hierarchy.ts for
 * changed-files mode (pre-push hook + harness-hook PostToolUse).
 * No behavioural change to existing tests.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REQUIRED_HEADER_DOCS,
  EXEMPT_PATTERNS,
  REQUIRED_PATH_PATTERNS,
  isExempt,
  matchesRequiredPattern,
  enumerateSkillPrimaryDocs,
  enumerateFlatRequiredDocs,
  enumerateRequiredDocs,
  hasAuthorityHeader,
  checkDocsHaveAuthorityHeader,
  selectRequiredPaths,
} from './09-doc-authority-hierarchy.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');

describe('Principle 9 — every authority-bearing doc declares Authoritative-for header', () => {
  it('all required-header docs declare Authoritative-for', () => {
    const result = checkDocsHaveAuthorityHeader(
      REQUIRED_HEADER_DOCS as string[],
      REPO_ROOT,
    );
    expect(
      result.violations,
      `Doc-authority violations:\n${result.violations.map((v) => `${v.path}: ${v.reason}`).join('\n')}`,
    ).toHaveLength(0);
  });

  it('mutation: doc without authority header fails check (anti-tautology)', () => {
    const fake = '# Fake doc\n\nSome content without authority header.\n';
    expect(hasAuthorityHeader(fake)).toBe(false);
  });

  it('mutation: example-only header inside fenced code block does NOT count as compliant', () => {
    const fakeWithExampleOnly =
      '# Doc title\n\nProse without real header.\n\n```markdown\n# Example\n\n> **Authoritative for:** illustrative example only\n```\n\nMore prose.\n';
    expect(hasAuthorityHeader(fakeWithExampleOnly)).toBe(false);
  });

  it('positive: doc with valid authority header passes check', () => {
    const valid =
      '# Doc title\n\n> **Authoritative for:** something specific.\n> **NOT authoritative for:** project goal — see README.md.\n\nContent.\n';
    expect(hasAuthorityHeader(valid)).toBe(true);
  });

  it('header check is case-sensitive (matches exact format from rule §3)', () => {
    const lowercase = '# Doc\n\n> **authoritative for:** something\n';
    expect(hasAuthorityHeader(lowercase)).toBe(false);
  });

  it('header check requires bold formatting (Markdown blockquote with **)', () => {
    const noBold = '# Doc\n\n> Authoritative for: something\n';
    expect(hasAuthorityHeader(noBold)).toBe(false);
  });

  it('canonical list shape sentinel — catches accidental empty-out / explosion', () => {
    // Drift sentinel: catches if someone deletes the canonical list (would
    // otherwise pass vacuously) or accidentally explodes it. Semantic alignment
    // with rule §2 is the maintainer's responsibility on each list update.
    expect(REQUIRED_HEADER_DOCS.length).toBeGreaterThanOrEqual(20);
    // Upper bound tracks the list in lockstep (66 → 69 react-spa → 72: +3 react-native docs, 2026-06-24 → 73: +egress-no-api-bypass.md, 2026-06-27 → 81: +8 project-local .claude/skills/*/SKILL.md, DN-M1 → 82: +skill-description-quality.md, 2026-06-27 → 84: +rule-researcher agent + rule-research skill (live-adapter Phase 1), 2026-06-29 → 85: +research-source-trust.md, 2026-07-02 (rule-research-trust-tiers S3) → 87: +source-before-shape.md rule + capability-reuse-auditor.md agent, 2026-07-02 (source-before-shape mechanism)).
    expect(REQUIRED_HEADER_DOCS.length).toBeLessThanOrEqual(87);
    // Canonical roots must always be present
    expect(REQUIRED_HEADER_DOCS).toContain('README.md');
    expect(REQUIRED_HEADER_DOCS).toContain('CLAUDE.md');
    expect(REQUIRED_HEADER_DOCS).toContain('.claude/session-bootstrap.md');
    expect(REQUIRED_HEADER_DOCS).toContain(
      'docs/meta-factory/EXECUTION-PLAN.md',
    );
  });

  // §13.21 Wave 2 — exemption mechanism for fixture files intentionally lacking
  // Authoritative-for header. Anti-tautology pair: positive proves exemption
  // works; mutation proves exemption is the only reason a missing header is
  // not flagged (i.e. the rule's failure detection still functions outside the
  // exempt scope).
  it('positive: file under exempt glob is recognised as exempt', () => {
    expect(isExempt('packages/core/research/fixtures/drift/with-drift/skills/getff/SKILL.md')).toBe(true);
    expect(isExempt('packages/core/detector/fixtures/with-aif/.ai-factory/ARCHITECTURE.md')).toBe(true);
  });

  it('positive: file outside exempt glob is NOT exempt (negative case)', () => {
    expect(isExempt('packages/core/templates/shared/AGENTS.md.template')).toBe(false);
    expect(isExempt('agents/review-sidecar.md')).toBe(false);
    expect(isExempt('docs/meta-factory/EXECUTION-PLAN.md')).toBe(false);
    expect(isExempt('packages/preset-next-15-canonical/RULES.md')).toBe(false);
  });

  it('mutation: removing exemption would flag a real fixture without authority header', () => {
    // Anti-tautology: proves the rule's failure-detection works outside the
    // exempt scope. Pick a fixture path that matches the exempt glob — if its
    // file exists and lacks a header, exemption is the only reason it does
    // not appear in the canonical violations list.
    const fixtureRel = 'packages/core/research/fixtures/drift/with-drift/skills/getff/SKILL.md';
    const fullPath = resolve(REPO_ROOT, fixtureRel);
    if (!existsSync(fullPath)) return; // skip if fixture relocated; sentinel-only assertion
    const content = readFileSync(fullPath, 'utf8');
    expect(hasAuthorityHeader(content)).toBe(false); // confirms fixture truly lacks header
    expect(isExempt(fixtureRel)).toBe(true); // confirms exemption is what hides it from violations
    // With exemption active, checkDocsHaveAuthorityHeader skips it → no violation
    const result = checkDocsHaveAuthorityHeader([fixtureRel], REPO_ROOT);
    expect(result.violations).toHaveLength(0);
  });

  // §13.21 Wave 4 / M1 — drift detection between install.sh SHIPPED_DOCS and
  // the shipped-doc subset of REQUIRED_HEADER_DOCS (paths under packages/core/
  // templates/shared/, packages/preset-next-15-canonical/, agents/, and
  // skills/tool-bootstrapping/ added in Wave 5.1). Both lists must remain
  // identical: install.sh is the release-time check, principle 09 is the
  // PR-time check; drift between them defeats Wave 3's purpose (catching
  // header drift between PR-side and release-time copy).
  it('§13.21 Wave 4 — install.sh SHIPPED_DOCS matches shipped-doc subset of REQUIRED_HEADER_DOCS', () => {
    const installShPath = resolve(REPO_ROOT, 'install.sh');
    expect(existsSync(installShPath)).toBe(true);
    const installSh = readFileSync(installShPath, 'utf8');

    const arrayMatch = installSh.match(/SHIPPED_DOCS=\(\s*([\s\S]*?)\s*\)/);
    expect(arrayMatch, 'install.sh: SHIPPED_DOCS array not found').not.toBeNull();
    const installShipped = arrayMatch![1]
      .split('\n')
      .map((line) => {
        const stripped = line.replace(/^\s*#.*$/, '').trim();
        const m = stripped.match(/^"([^"]+)"$/);
        return m ? m[1] : '';
      })
      .filter(Boolean);

    const SHIPPED_DOC_PREFIXES = [
      'packages/core/templates/shared/',
      'packages/preset-next-15-canonical/',
      'packages/preset-react-spa/',
      'packages/preset-react-native/',
      'agents/',
      'skills/tool-bootstrapping/',
    ];
    const shippedSubset = REQUIRED_HEADER_DOCS.filter((p) =>
      SHIPPED_DOC_PREFIXES.some((pref) => p.startsWith(pref)),
    );

    // 19 baseline + 3 react-spa + 3 react-native shipped docs (each: RULES.md,
    // RULES.<stack>.md, templates/ARCHITECTURE.<stack>.md) wired by install.sh = 25;
    // +1 rule-researcher agent (live-adapter Phase 1, 2026-06-29) = 26;
    // +1 capability-reuse-auditor agent (source-before-shape, 2026-07-02) = 27.
    expect(installShipped).toHaveLength(27);
    expect(new Set(installShipped)).toEqual(new Set(shippedSubset));
  });

  // 7.1.c — changed-files mode API smoke tests (positive + mutation pair)
  it('checkDocsHaveAuthorityHeader: ok:true for valid compliant path', () => {
    const result = checkDocsHaveAuthorityHeader(['README.md'], REPO_ROOT);
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('checkDocsHaveAuthorityHeader: violation for non-existent path', () => {
    const result = checkDocsHaveAuthorityHeader(['does-not-exist.md'], REPO_ROOT);
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.reason).toContain('does not exist');
  });

  // M1 fix (Wave 7 Round 1 review 2026-05-11) — CLI shim filter contract:
  // PostToolUse hook was firing FAIL noise on every Edit/Write of non-doc files
  // (.ts, .json, package.json) because the bin shim passed argv straight to
  // checkDocsHaveAuthorityHeader. Filter now lives in selectRequiredPaths and
  // the bin shim consults it BEFORE the check. Tests describe the bin shim's
  // observable behaviour via the extracted pure function.
  it('bin shim: silently exits 0 when no paths match REQUIRED_HEADER_DOCS', () => {
    // Non-doc paths like package.json / source files should be filtered out
    // entirely — the bin shim's empty-filtered branch returns exit 0 silently.
    const filtered = selectRequiredPaths([
      'package.json',
      'packages/core/principles/09-doc-authority-hierarchy.ts',
      'unrelated/source.ts',
    ]);
    expect(filtered).toEqual([]);
  });

  it('bin shim: exits 1 when required doc missing header', () => {
    // Required doc paths must survive the filter so checkDocsHaveAuthorityHeader
    // can catch missing-header violations. selectRequiredPaths preserves them;
    // checkDocsHaveAuthorityHeader (covered elsewhere) is what produces the
    // FAIL stderr + exit 1 the bin shim emits.
    const filtered = selectRequiredPaths([
      'README.md',
      'CLAUDE.md',
      'docs/meta-factory/EXECUTION-PLAN.md',
    ]);
    expect(filtered).toEqual([
      'README.md',
      'CLAUDE.md',
      'docs/meta-factory/EXECUTION-PLAN.md',
    ]);
    // Mutation arm: a fake required-shaped path stripped of header would FAIL
    // (proves the filter does not muffle real violations).
    const fakeContent = '# Fake required doc\n\nNo header.\n';
    expect(hasAuthorityHeader(fakeContent)).toBe(false);
  });

  it('bin shim: exits 0 when exempt path passed', () => {
    // Exempt fixture paths survive the filter (so callers can pass mixed lists)
    // and then are skipped inside checkDocsHaveAuthorityHeader → no violation.
    const exemptPath = 'packages/core/research/fixtures/drift/with-drift/skills/getff/SKILL.md';
    const filtered = selectRequiredPaths([exemptPath]);
    expect(filtered).toEqual([exemptPath]);
    const result = checkDocsHaveAuthorityHeader(filtered, REPO_ROOT);
    expect(result.violations).toHaveLength(0);
  });

  it('EXEMPT_PATTERNS exported and matches known fixture paths', () => {
    expect(EXEMPT_PATTERNS.length).toBeGreaterThan(0);
    expect(
      EXEMPT_PATTERNS.some((re) =>
        re.test('packages/core/research/fixtures/drift/with-drift/skills/getff/SKILL.md'),
      ),
    ).toBe(true);
  });

  // ── Dynamic skill-doc enumeration (2026-07-02 delta-audit F2) ─────────────
  // Gap-class observed in the wild: /story (#592) + /ai-doc shipped headerless
  // while this suite stayed green — the static list only knew tool-bootstrapping
  // (1 of 8 internal skills). New skills must be covered the moment they land.
  // Source: docs/meta-factory/research-patches/2026-07-02-doc-audit-delta.md §2.
  describe('dynamic skill-doc enumeration — new skills cannot land headerless', () => {
    it('every enumerated skill doc (SKILL.md + references/*.md) declares Authoritative-for', () => {
      const enumerated = enumerateSkillPrimaryDocs(REPO_ROOT);
      const result = checkDocsHaveAuthorityHeader(enumerated, REPO_ROOT);
      expect(
        result.violations,
        `Skill-doc authority violations:\n${result.violations.map((v) => `${v.path}: ${v.reason}`).join('\n')}`,
      ).toHaveLength(0);
    });

    it('enumeration is non-vacuous: sees both roots and both doc kinds', () => {
      const enumerated = enumerateSkillPrimaryDocs(REPO_ROOT);
      // Known tracked anchors — a primary doc that predates the fix, a cold
      // reference, and a post-FQA skill of the exact gap-class.
      expect(enumerated).toContain('.claude/skills/tool-bootstrapping/SKILL.md');
      expect(enumerated).toContain('.claude/skills/pipeline/references/red-flags.md');
      expect(enumerated).toContain('.claude/skills/story/SKILL.md');
      expect(enumerated).toContain('skills/getff/SKILL.md');
      expect(enumerated.length).toBeGreaterThanOrEqual(20);
    });

    it('enumeration covers every static skill-root entry (no list/reality drift)', () => {
      const enumerated = new Set(enumerateSkillPrimaryDocs(REPO_ROOT));
      const staticSkillDocs = REQUIRED_HEADER_DOCS.filter(
        (p) => p.startsWith('skills/') || p.startsWith('.claude/skills/'),
      );
      const missing = staticSkillDocs.filter((p) => !enumerated.has(p));
      expect(
        missing,
        `Static skill-doc entries not found by enumeration (deleted or untracked?):\n${missing.join('\n')}`,
      ).toEqual([]);
    });

    it('positive: patterns match skill primary docs + cold references in both roots', () => {
      expect(matchesRequiredPattern('.claude/skills/story/SKILL.md')).toBe(true);
      expect(matchesRequiredPattern('.claude/skills/pipeline/references/red-flags.md')).toBe(true);
      expect(matchesRequiredPattern('skills/getff/SKILL.md')).toBe(true);
      expect(matchesRequiredPattern('skills/getff/references/ai-traps.md')).toBe(true);
    });

    it('negative: patterns do NOT match helpers, fixtures, non-md, or nested extras', () => {
      // helpers/ and other non-references sub-dirs are out of rule §2 scope
      expect(matchesRequiredPattern('.claude/skills/story/helpers/notes.md')).toBe(false);
      // fixture copies live under packages/** — EXEMPT territory, never required
      expect(
        matchesRequiredPattern(
          'packages/core/research/fixtures/drift/with-drift/skills/getff/SKILL.md',
        ),
      ).toBe(false);
      // non-markdown and root-level files
      expect(matchesRequiredPattern('.claude/skills/story/helpers/emit-story-prompt.sh')).toBe(false);
      expect(matchesRequiredPattern('.claude/skills/README.md')).toBe(false);
      // nested one level deeper than references/*.md
      expect(matchesRequiredPattern('.claude/skills/x/references/sub/deep.md')).toBe(false);
    });

    it('edit-time channel: selectRequiredPaths keeps dynamic skill docs (mutation: was dropped pre-fix)', () => {
      // Pre-fix, a new skill's SKILL.md was filtered OUT (not in the static
      // list) → the PostToolUse shim exited 0 silently and the headerless doc
      // sailed through to CI-green. Post-fix it must survive the filter.
      const filtered = selectRequiredPaths([
        '.claude/skills/story/SKILL.md',
        'package.json',
        'unrelated/source.ts',
      ]);
      expect(filtered).toEqual(['.claude/skills/story/SKILL.md']);
    });

    it('REQUIRED_PATH_PATTERNS exported and anchored (sentinel)', () => {
      // 2 skill patterns + 2 flat patterns (.claude/rules/*.md, agents/*.md) — M7.
      expect(REQUIRED_PATH_PATTERNS.length).toBe(4);
      // Anchoring sentinel: a path merely *containing* a skills segment must not match.
      expect(matchesRequiredPattern('docs/skills/foo/SKILL.md')).toBe(false);
    });
  });

  // ── Dynamic rule/agent enumeration (M7, 2026-07-03) ───────────────────────
  // Gap-class: doc-authority-hierarchy.md §2 lists `.claude/rules/*.md` (all
  // rule files) + shipped `agents/*.md` as Required-for, but only a
  // hand-maintained subset lived in the static REQUIRED_HEADER_DOCS array —
  // new rule/agent files (kickoff-staging-placement.md,
  // recommendation-laziness-discipline.md, agents added after the last static
  // edit) landed unenforced. Now enforced dynamically, mirroring the skill
  // enumeration: a new rule or agent is covered the moment it lands.
  describe('dynamic rule/agent enumeration — new rules/agents cannot land headerless', () => {
    it('every enumerated flat doc (.claude/rules/*.md + agents/*.md) declares Authoritative-for', () => {
      const enumerated = enumerateFlatRequiredDocs(REPO_ROOT);
      const result = checkDocsHaveAuthorityHeader(enumerated, REPO_ROOT);
      expect(
        result.violations,
        `Flat rule/agent authority violations:\n${result.violations.map((v) => `${v.path}: ${v.reason}`).join('\n')}`,
      ).toHaveLength(0);
    });

    it('enumeration is non-vacuous: sees both roots and the previously-unenforced files', () => {
      const enumerated = enumerateFlatRequiredDocs(REPO_ROOT);
      // The two rule files that were NOT in the static list (M7 origin).
      expect(enumerated).toContain('.claude/rules/kickoff-staging-placement.md');
      expect(enumerated).toContain(
        '.claude/rules/recommendation-laziness-discipline.md',
      );
      // An agent that was NOT in the static REQUIRED_HEADER_DOCS array.
      expect(enumerated).toContain('agents/backward-sweep-auditor.md');
      // A rule + an agent that WERE already static — enumeration is a superset.
      expect(enumerated).toContain('.claude/rules/doc-authority-hierarchy.md');
      expect(enumerated).toContain('agents/review-sidecar.md');
      expect(enumerated.length).toBeGreaterThanOrEqual(20);
    });

    it('enumeration covers every static rule/agent entry (no list/reality drift)', () => {
      const enumerated = new Set(enumerateFlatRequiredDocs(REPO_ROOT));
      const staticFlatDocs = REQUIRED_HEADER_DOCS.filter(
        (p) => p.startsWith('.claude/rules/') || p.startsWith('agents/'),
      );
      const missing = staticFlatDocs.filter((p) => !enumerated.has(p));
      expect(
        missing,
        `Static rule/agent entries not found by enumeration (deleted or untracked?):\n${missing.join('\n')}`,
      ).toEqual([]);
    });

    it('positive: patterns match rule + agent docs directly under their root', () => {
      expect(
        matchesRequiredPattern('.claude/rules/kickoff-staging-placement.md'),
      ).toBe(true);
      expect(matchesRequiredPattern('agents/backward-sweep-auditor.md')).toBe(
        true,
      );
    });

    it('negative: patterns do NOT match nested extras, non-md, or lookalike paths', () => {
      // nested one level deeper than the flat root
      expect(matchesRequiredPattern('.claude/rules/sub/nested.md')).toBe(false);
      expect(matchesRequiredPattern('agents/sub/nested.md')).toBe(false);
      // non-markdown
      expect(matchesRequiredPattern('.claude/rules/README.txt')).toBe(false);
      expect(matchesRequiredPattern('agents/helper.sh')).toBe(false);
      // lookalike: a path merely *containing* the segment must not match
      expect(matchesRequiredPattern('docs/agents/foo.md')).toBe(false);
      expect(matchesRequiredPattern('packages/agents/foo.md')).toBe(false);
    });

    it('edit-time channel: selectRequiredPaths keeps dynamic rule/agent docs', () => {
      // A brand-new rule / agent's edit must survive the PostToolUse filter so
      // the edit-time channel catches a missing header — not only CI.
      const filtered = selectRequiredPaths([
        '.claude/rules/kickoff-staging-placement.md',
        'agents/backward-sweep-auditor.md',
        'package.json',
        'unrelated/source.ts',
      ]);
      expect(filtered).toEqual([
        '.claude/rules/kickoff-staging-placement.md',
        'agents/backward-sweep-auditor.md',
      ]);
    });

    it('combined enumerateRequiredDocs is the de-duplicated union of skill + flat docs', () => {
      const combined = enumerateRequiredDocs(REPO_ROOT);
      const skills = enumerateSkillPrimaryDocs(REPO_ROOT);
      const flat = enumerateFlatRequiredDocs(REPO_ROOT);
      const expected = [...new Set([...skills, ...flat])].sort();
      expect(combined).toEqual(expected);
      // No duplicates.
      expect(combined.length).toBe(new Set(combined).size);
      // Every enumerated doc has a header (the load-bearing invariant).
      const result = checkDocsHaveAuthorityHeader(combined, REPO_ROOT);
      expect(
        result.violations,
        `Combined authority violations:\n${result.violations.map((v) => `${v.path}: ${v.reason}`).join('\n')}`,
      ).toHaveLength(0);
    });
  });

  // ── Criterion 3 — exactly-one-goal-authority ──────────────────────────────
  // Goal-drift audit 2026-06-05: assert exactly ONE doc in REQUIRED_HEADER_DOCS
  // claims authority for "project goal". Any second such claim is a
  // `#contradicting-authority-claims` violation per doc-authority-hierarchy §4.
  // Source: docs/meta-factory/research-patches/2026-06-05-goal-drift-audit.md §6
  describe('Criterion 3 — exactly-one-goal-authority-doc', () => {
    // The goal-authority pattern: a doc whose Authoritative-for line *opens*
    // with "project goal" as the first-listed scope (not a doc that *references*
    // the goal in a phrase like "operational restatement of project goal").
    // This distinguishes README.md (owns the goal) from session-bootstrap.md
    // (restates it, delegates upward, has an explicit NOT authoritative for goal line).
    const GOAL_AUTHORITY_RE = /^> \*\*Authoritative for:\*\*\s*project goal/m;

    it('exactly one required-header doc claims goal-authority (README.md)', () => {
      const matches: string[] = [];
      for (const relPath of REQUIRED_HEADER_DOCS) {
        if (isExempt(relPath)) continue;
        const fullPath = resolve(REPO_ROOT, relPath);
        if (!existsSync(fullPath)) continue;
        const content = readFileSync(fullPath, 'utf8');
        if (GOAL_AUTHORITY_RE.test(content)) {
          matches.push(relPath);
        }
      }
      expect(
        matches,
        `Goal-authority docs found (expected exactly [README.md]):\n${matches.join('\n')}`,
      ).toEqual(['README.md']);
    });

    it('mutation: a doc that opens Authoritative-for with "project goal" is detected', () => {
      const driftedDoc =
        '# Some operational doc\n\n> **Authoritative for:** project goal and additional concerns.\n\nContent.\n';
      expect(GOAL_AUTHORITY_RE.test(driftedDoc)).toBe(true);
    });

    it('mutation: "operational restatement of project goal" does NOT trigger the pattern (mention ≠ ownership)', () => {
      // session-bootstrap.md uses this phrasing — it's not claiming goal-authority,
      // it's describing a delegation role. The narrowed regex must NOT match it.
      const restatingDoc =
        '# Session bootstrap\n\n> **Authoritative for:** operational restatement of project goal + invariants for AI session start.\n> **NOT authoritative for:** project goal — see README.md.\n\nContent.\n';
      expect(GOAL_AUTHORITY_RE.test(restatingDoc)).toBe(false);
    });

    it('mutation: README.md without "project goal" in Authoritative-for triggers the assertion', () => {
      // Simulate a README.md that lost its goal-authority claim —
      // the exactly-one assertion would then find 0 matches (not 1) and fail.
      const modifiedReadme =
        '# README\n\n> **Authoritative for:** project conventions and docs.\n\nContent.\n';
      expect(GOAL_AUTHORITY_RE.test(modifiedReadme)).toBe(false);
    });
  });

  // ── Criterion 4 — PROPOSAL.md not edited since freeze ────────────────────
  // Goal-drift audit 2026-06-05: PROPOSAL.md is FROZEN — post-freeze edits
  // violate the `#frozen-doc-still-edited` anti-pattern (doc-authority-
  // hierarchy §4). Originally pinned to freeze commit 397840c ("docs(proposal):
  // add Authoritative-for header — freeze as historical artifact") via
  // `git log <sha>..HEAD`. Re-anchored 2026-07-02 to a CONTENT hash: the repo
  // integrates PRs via squash merge, so the SHA of any post-freeze refresh
  // commit is unreachable in post-merge clones (`git cat-file -e` fails loud
  // in CI) — a SHA pin cannot survive its own landing. The byte hash pins the
  // same invariant history-independently (precedent: install-sh baseline
  // fingerprints). Snapshot refreshed 2026-07-02: status line DRAFT/RFC →
  // FROZEN + MD040 fence-language repair — maintainer-sanctioned header-only
  // edit per doc-authority-hierarchy §4 carve-out, resolving the §8(a)
  // DECISION-NEEDED of research-patches/2026-07-02-doc-audit-delta.md.
  // Source: docs/meta-factory/research-patches/2026-06-05-goal-drift-audit.md §6
  describe('Criterion 4 — frozen PROPOSAL.md not edited since freeze', () => {
    const PROPOSAL_PATH = 'docs/meta-factory/PROPOSAL.md';
    // sha256 of the frozen PROPOSAL.md bytes (status line updated 2026-07-02).
    // On a sanctioned §4 carve-out edit (header/typo/link repair), re-pin this
    // constant in the same commit with maintainer sign-off — any other
    // divergence is a freeze violation.
    const PROPOSAL_FROZEN_SHA256 =
      'cd06bcf3d8622f588ee42681212e1d706b1989d9bdb32b160daccb4eb7db8b61';
    const FROZEN_STATUS_LINE =
      '> Status: **FROZEN — historical design artifact** (original status at freeze: DRAFT / RFC)';
    const PRE_FREEZE_STATUS_LINE = '> Status: **DRAFT / RFC**';

    const sha256 = (text: string): string =>
      createHash('sha256').update(text).digest('hex');

    it('PROPOSAL.md content matches the frozen snapshot byte-for-byte', () => {
      // readFileSync throws (fails loud) if the file is missing or unreadable.
      const content = readFileSync(resolve(REPO_ROOT, PROPOSAL_PATH), 'utf8');
      expect(
        sha256(content),
        'PROPOSAL.md diverged from the frozen snapshot — #frozen-doc-still-edited ' +
          'violation. If this is a sanctioned §4 carve-out (header/typo/link ' +
          'repair), re-pin PROPOSAL_FROZEN_SHA256 in the same commit.',
      ).toBe(PROPOSAL_FROZEN_SHA256);
    });

    it('mutation: reverting the status line to pre-freeze DRAFT/RFC changes the hash', () => {
      // Non-vacuous negative arm: prove the pin is sensitive to exactly the
      // historical edit class (a one-line status change), not only to gross
      // rewrites. Guards assert the replacement target exists and actually
      // mutates, so the arm cannot silently pass vacuously.
      const content = readFileSync(resolve(REPO_ROOT, PROPOSAL_PATH), 'utf8');
      expect(content).toContain(FROZEN_STATUS_LINE);
      const mutated = content.replace(FROZEN_STATUS_LINE, PRE_FREEZE_STATUS_LINE);
      expect(mutated).not.toBe(content);
      expect(sha256(mutated)).not.toBe(PROPOSAL_FROZEN_SHA256);
    });
  });
});
