/**
 * Principle 9 — Doc authority hierarchy: shared module exposing the canonical
 * doc list and the check function used by both the vitest suite and CLI tooling.
 *
 * Exported API is consumed by:
 *   - 09-doc-authority-hierarchy.test.ts  (full-set vitest run)
 *   - 09-doc-authority-hierarchy.bin.ts   (CLI shim for pre-push / harness-hooks)
 *   - sub-waves 7.2.c and 7.4             (PostToolUse + make validate-prompts)
 *
 * Keep the function signature stable — downstream consumers depend on it.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const AUTHORITY_HEADER_RE = /^> \*\*Authoritative for:\*\*/m;

/**
 * Canonical list of authority-bearing docs per `.claude/rules/doc-authority-
 * hierarchy.md` §2 "Required for" + "Folder-level authority" categories.
 *
 * Filename-convention category (PHASE-*-PROMPT.md, phase-*-research.md) is
 * intentionally NOT enumerated — those derive scope from filename pattern.
 *
 * When updating this list, also update the rule's §2 to match (drift sentinel
 * test below catches list-shape changes; semantic alignment with the rule is
 * the maintainer's responsibility).
 */
export const REQUIRED_HEADER_DOCS: readonly string[] = [
  // Project-root docs
  'README.md',
  'CLAUDE.md',
  'CONTRIBUTING.md',
  'INSTALL.md',
  'INSTALL-FOR-AI.md',

  // Hot operational
  '.claude/session-bootstrap.md',
  '.claude/rules/doc-authority-hierarchy.md',
  '.claude/rules/dual-implementation-discipline.md',
  '.claude/rules/no-paid-llm-in-ci.md',
  '.claude/rules/parallel-subwave-isolation.md',
  '.claude/rules/phase-research-coverage.md',
  '.claude/rules/reviewer-discipline.md',
  '.claude/rules/ai-laziness-traps.md',
  '.claude/rules/build-first-reuse-default.md',
  '.claude/rules/memory-codification.md',
  '.claude/rules/rule-enforcement-channel-selection.md',
  '.claude/rules/companion-install-principle.md',
  '.claude/rules/language-discipline.md',
  '.claude/rules/ci-tool-pinning.md',
  '.claude/rules/egress-no-api-bypass.md',
  '.claude/rules/skill-description-quality.md',
  '.claude/rules/research-source-trust.md',
  '.claude/rules/source-before-shape.md',

  // docs/meta-factory/ reference docs (excluding sub-folders + filename-convention transients)
  'docs/meta-factory/EXECUTION-PLAN.md',
  'docs/meta-factory/PROPOSAL.md',
  'docs/meta-factory/architecture.md',
  'docs/meta-factory/self-application.md',
  'docs/meta-factory/principles-as-tests.md',
  'docs/meta-factory/aif-comparison.md',
  'docs/meta-factory/open-questions.md',
  'docs/meta-factory/closed-questions.md',
  'docs/meta-factory/prior-art-evaluations.md',
  'docs/meta-factory/acceptance-tests.md',
  'docs/meta-factory/core-stability.md',
  'docs/meta-factory/failure-modes.md',
  'docs/meta-factory/migration-from-current.md',
  'docs/meta-factory/niche-stacks.md',
  'docs/meta-factory/risks.md',
  'docs/meta-factory/roadmap.md',
  'docs/meta-factory/versioning-and-locks.md',
  'docs/meta-factory/self-diagnostics-design.md',

  // Folder-level READMEs (sub-folder authority covers individual files)
  'docs/meta-factory/retros/README.md',
  'docs/meta-factory/research-patches/README.md',

  // skills/ — primary doc + cold references
  'skills/rules-as-tests/SKILL.md',
  'skills/rules-as-tests/references/ai-traps.md',
  'skills/rules-as-tests/references/checks-map.md',
  'skills/rules-as-tests/references/doc-organization.md',
  'skills/rules-as-tests/references/overview.md',
  'skills/rules-as-tests/references/self-testing-docs.md',
  'skills/tool-bootstrapping/SKILL.md',
  'skills/tool-bootstrapping/references/decision-format.md',

  // .claude/skills/ — project-internal skill primary + cold references (Wave 5.1 + DN-M1)
  '.claude/skills/ai-doc/SKILL.md',
  '.claude/skills/aif-doctor/SKILL.md',
  '.claude/skills/dispatcher/SKILL.md',
  '.claude/skills/harvest/SKILL.md',
  '.claude/skills/pipeline/SKILL.md',
  '.claude/skills/rule-research/SKILL.md',
  '.claude/skills/self-reflection/SKILL.md',
  '.claude/skills/story/SKILL.md',
  '.claude/skills/template-audit/SKILL.md',
  '.claude/skills/tool-bootstrapping/SKILL.md',
  '.claude/skills/tool-bootstrapping/references/decision-format.md',

  // Framework-shipped templates copied to consumer .ai-factory/ and project root
  'packages/core/templates/shared/AGENTS.md.template',
  'packages/core/templates/shared/CLAUDE.md.template',
  'packages/core/templates/shared/DESCRIPTION.template.md',
  'packages/core/templates/shared/ARCHITECTURE.ts-server.md',
  'packages/core/templates/shared/integration-rules.md',
  'packages/preset-next-15-canonical/RULES.md',
  'packages/preset-next-15-canonical/RULES.react-next.md',
  'packages/preset-next-15-canonical/templates/ARCHITECTURE.react-next.md',
  'packages/preset-react-spa/RULES.md',
  'packages/preset-react-spa/RULES.react-spa.md',
  'packages/preset-react-spa/templates/ARCHITECTURE.react-spa.md',
  'packages/preset-react-native/RULES.md',
  'packages/preset-react-native/RULES.react-native.md',
  'packages/preset-react-native/templates/ARCHITECTURE.react-native.md',

  // skill-context overrides shipped to consumer .ai-factory/skill-context/ (C-1 follow-up,
  // SSOT #50): AIF-native delivery of our review + rules-check content without colliding slots.
  'packages/core/templates/shared/skill-context/aif-review/SKILL.md',
  'packages/core/templates/shared/skill-context/aif-rules-check/SKILL.md',
  'packages/core/templates/shared/skill-context/aif-orchestrator-discipline/SKILL.md',

  // Sub-agents copied to consumer .claude/agents/ via install.sh glob.
  // best-practices-sidecar removed (C-1 KEEP-AIF, 2026-05-20); docs-auditor renamed
  // → living-docs-auditor to de-collide with AIF's same-named agent.
  'agents/review-sidecar.md',
  'agents/living-docs-auditor.md',
  'agents/compliance-verifier.md',
  'agents/memory-codification-auditor.md',
  'agents/orchestrator-worker-discipline.md',
  'agents/aif-init.md',
  'agents/rule-researcher.md',
  'agents/capability-reuse-auditor.md',
];

/**
 * Exemption globs for fixtures intentionally lacking Authoritative-for header.
 * Pattern: pure regex, no glob lib (zero new dep).
 */
export const EXEMPT_PATTERNS: readonly RegExp[] = [
  /^packages\/[^/]+\/research\/fixtures\//,
  /^packages\/.+\/fixtures\//,
];

export function isExempt(relPath: string): boolean {
  return EXEMPT_PATTERNS.some((re) => re.test(relPath));
}

/**
 * Path patterns whose files require an Authoritative-for header *dynamically* —
 * without a static REQUIRED_HEADER_DOCS entry. Added 2026-07-02 (delta-audit F2:
 * /story + /ai-doc shipped headerless while principle 09 stayed green, because
 * the static list only knew tool-bootstrapping). Covers rule §2 "Skill primary
 * docs + cold references" for both skill roots. Anchored so fixture copies under
 * packages/** (EXEMPT_PATTERNS territory) never match.
 *
 * 2026-07-03 (M7): extended to `.claude/rules/*.md` and `agents/*.md`. The rule
 * §2 "Required for" lists `.claude/rules/*.md` (all rule files) and shipped
 * sub-agent prompts under `agents/`, but only a hand-maintained subset was in
 * the static REQUIRED_HEADER_DOCS array — new rule/agent files (e.g.
 * kickoff-staging-placement.md, recommendation-laziness-discipline.md, and every
 * agent added after the last static-list edit) landed unenforced. These patterns
 * make the requirement dynamic: a new rule or agent is covered the moment it
 * lands, no static-list edit required — mirroring the skill mechanism.
 */
export const REQUIRED_PATH_PATTERNS: readonly RegExp[] = [
  /^(?:\.claude\/)?skills\/[^/]+\/SKILL\.md$/,
  /^(?:\.claude\/)?skills\/[^/]+\/references\/[^/]+\.md$/,
  /^\.claude\/rules\/[^/]+\.md$/,
  /^agents\/[^/]+\.md$/,
];

export function matchesRequiredPattern(relPath: string): boolean {
  return REQUIRED_PATH_PATTERNS.some((re) => re.test(relPath));
}

/** Skill roots swept by the dynamic enumeration (mirrors principle 15). */
const SKILL_DOC_ROOTS: readonly string[] = ['.claude/skills', 'skills'];

/**
 * Flat doc roots swept by the dynamic enumeration (M7, 2026-07-03): every
 * `*.md` directly under these dirs requires an Authoritative-for header per
 * rule §2 "Required for". Flat (no `references/` sub-shape) — one glob per root.
 */
const FLAT_DOC_ROOTS: readonly string[] = ['.claude/rules', 'agents'];

/**
 * Tracked files under `roots`, or null when git is unavailable.
 * Git-aware for the same reason as principle 15 (FQA S1-D F1): an
 * installer-populated clone carries gitignored `aif-*` skills that are
 * headerless by design — filesystem-blind enumeration would false-RED locally
 * while green in CI. Falls back to null → filesystem enumeration off-repo.
 */
function trackedDocsUnder(
  repoRoot: string,
  roots: readonly string[],
): Set<string> | null {
  try {
    const out = execFileSync(
      'git',
      ['-C', repoRoot, 'ls-files', '--', ...roots],
      { encoding: 'utf8' },
    );
    return new Set(out.split('\n').filter(Boolean));
  } catch {
    return null;
  }
}

/**
 * Enumerate skill primary docs + cold references (repo-root-relative POSIX
 * paths): `<root>/<skill>/SKILL.md` and `<root>/<skill>/references/*.md` for
 * each skill root. New skills are covered the moment they land — no static
 * list edit required (the 2026-07-02 gap-class). Zero glob dep.
 */
export function enumerateSkillPrimaryDocs(
  repoRoot: string = process.cwd(),
): string[] {
  const tracked = trackedDocsUnder(repoRoot, SKILL_DOC_ROOTS);
  const found: string[] = [];
  for (const root of SKILL_DOC_ROOTS) {
    const absRoot = `${repoRoot}/${root}`;
    if (!existsSync(absRoot)) continue;
    for (const entry of readdirSync(absRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidates: string[] = [`${root}/${entry.name}/SKILL.md`];
      const refsAbs = `${absRoot}/${entry.name}/references`;
      if (existsSync(refsAbs)) {
        for (const ref of readdirSync(refsAbs, { withFileTypes: true })) {
          if (ref.isFile() && ref.name.endsWith('.md')) {
            candidates.push(`${root}/${entry.name}/references/${ref.name}`);
          }
        }
      }
      for (const rel of candidates) {
        if (!existsSync(`${repoRoot}/${rel}`)) continue;
        // Git-aware skip: audit only the tracked surface when git is available.
        if (tracked && !tracked.has(rel)) continue;
        found.push(rel);
      }
    }
  }
  return found.sort();
}

/**
 * Enumerate flat required-header docs (repo-root-relative POSIX paths): every
 * `*.md` directly under `.claude/rules/` and `agents/` (M7, 2026-07-03). New
 * rule/agent files are covered the moment they land — no static REQUIRED_HEADER_DOCS
 * edit required. Git-aware + tracked-only (same rationale as
 * `enumerateSkillPrimaryDocs`: an installer-populated clone may carry gitignored
 * `aif-*` agent copies that are headerless by design). Zero glob dep.
 */
export function enumerateFlatRequiredDocs(
  repoRoot: string = process.cwd(),
): string[] {
  const tracked = trackedDocsUnder(repoRoot, FLAT_DOC_ROOTS);
  const found: string[] = [];
  for (const root of FLAT_DOC_ROOTS) {
    const absRoot = `${repoRoot}/${root}`;
    if (!existsSync(absRoot)) continue;
    for (const entry of readdirSync(absRoot, { withFileTypes: true })) {
      // Flat: only `*.md` files directly under the root (no recursion).
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const rel = `${root}/${entry.name}`;
      // Git-aware skip: audit only the tracked surface when git is available.
      if (tracked && !tracked.has(rel)) continue;
      found.push(rel);
    }
  }
  return found.sort();
}

/**
 * Combined dynamic enumeration: skill primary docs + cold references
 * (`enumerateSkillPrimaryDocs`) plus flat rule/agent docs
 * (`enumerateFlatRequiredDocs`). This is the full set of docs whose
 * header requirement is enforced *dynamically* (no static REQUIRED_HEADER_DOCS
 * entry needed). Sorted, de-duplicated.
 */
export function enumerateRequiredDocs(
  repoRoot: string = process.cwd(),
): string[] {
  return [
    ...new Set([
      ...enumerateSkillPrimaryDocs(repoRoot),
      ...enumerateFlatRequiredDocs(repoRoot),
    ]),
  ].sort();
}

/**
 * Filter argv-style path list to entries that the rule cares about:
 * - paths enumerated in REQUIRED_HEADER_DOCS (authority-bearing docs), OR
 * - paths matching an EXEMPT_PATTERNS glob (fixtures intentionally headerless).
 *
 * Used by the CLI shim (sub-wave 7.1.c, M1 fix 2026-05-11) so PostToolUse hooks
 * fired on non-doc edits (.ts/.json/package.json) no longer surface FAIL noise.
 * Empty result → caller should exit 0 silently.
 *
 * 2026-07-02 (delta-audit F2): also keeps paths matching REQUIRED_PATH_PATTERNS,
 * so the edit-time channel (PostToolUse shim) catches a brand-new skill doc
 * missing its header — not only CI.
 */
export function selectRequiredPaths(paths: string[]): string[] {
  const requiredSet = new Set<string>(REQUIRED_HEADER_DOCS);
  return paths.filter(
    (p) => requiredSet.has(p) || matchesRequiredPattern(p) || isExempt(p),
  );
}

function readFile(p: string): string {
  return readFileSync(p, 'utf8');
}

function stripFencedCodeBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```/g, '');
}

export function hasAuthorityHeader(content: string): boolean {
  return AUTHORITY_HEADER_RE.test(stripFencedCodeBlocks(content));
}

export interface AuthorityViolation {
  path: string;
  reason: string;
}

export interface CheckResult {
  ok: boolean;
  violations: AuthorityViolation[];
}

/**
 * Check that each path in `paths` declares an Authoritative-for header.
 * Paths are relative to the repo root; repoRoot defaults to process.cwd().
 *
 * Used by pre-push changed-files mode (sub-wave 7.1.c) and harness-hook
 * PostToolUse matcher (sub-wave 7.2.c).
 */
export function checkDocsHaveAuthorityHeader(
  paths: string[],
  repoRoot: string = process.cwd(),
): CheckResult {
  const violations: AuthorityViolation[] = [];

  for (const relPath of paths) {
    if (isExempt(relPath)) continue;

    const fullPath = `${repoRoot}/${relPath}`;
    if (!existsSync(fullPath)) {
      violations.push({ path: relPath, reason: 'file does not exist' });
      continue;
    }

    const content = readFile(fullPath);
    if (!hasAuthorityHeader(content)) {
      violations.push({
        path: relPath,
        reason:
          'missing "> **Authoritative for:**" header — see .claude/rules/doc-authority-hierarchy.md §3',
      });
    }
  }

  return { ok: violations.length === 0, violations };
}
