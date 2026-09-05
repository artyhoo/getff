/**
 * Structural meta-tests for the Wave 10.1 / 10.2 dispatcher + orchestrator.
 *
 * These assert the dispatch contract that dual-implementation-discipline.md §4
 * mandates (capability-check, not brand-name) and the migration invariants that
 * keep enforcement intact (delegation through runCheck; self-tests still
 * referenced by literal path; §7 Prior-art trailer and §1.7 discipline trailer
 * both handled directly in TS; legacy-trailer-checks.sh deleted in Wave 10.3).
 * The runner's own behaviour is covered by utils/run-check.test.ts.
 * The §7 logic is covered by checks/prior-art.test.ts.
 * The §1.7 logic is covered by checks/s17.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SECTIONS,
  SHIPPED_MD_DESTINATIONS,
  SHIPPED_MD_PREFIXES,
  SHIPPED_SKILL_SLUGS,
  isFrameworkShippedMarkdown,
} from './pre-push.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const DISPATCHER = readFileSync(resolve(REPO_ROOT, '.husky/pre-push'), 'utf8');
const ORCHESTRATOR = readFileSync(resolve(HERE, 'pre-push.ts'), 'utf8');

describe('.husky/pre-push dispatcher — capability-check, not brand-name', () => {
  it('routes on Node capability presence (command -v node)', () => {
    expect(DISPATCHER).toMatch(/command -v node/);
  });

  it('gates on a Node major-version check before using --import', () => {
    expect(DISPATCHER).toMatch(/-ge 20/);
  });

  it('execs the TS-core hook via node --import tsx/esm', () => {
    expect(DISPATCHER).toMatch(/--import tsx\/esm/);
    expect(DISPATCHER).toMatch(/packages\/core\/hooks\/pre-push\.ts/);
  });

  it('does NOT branch on a harness brand string (#brand-name-detection)', () => {
    // Falsification per dual-implementation-discipline.md §8: no conditional
    // keyed on a Claude-Code / Anthropic brand identifier.
    expect(DISPATCHER).not.toMatch(
      /AI_HARNESS|CLAUDE_CODE|ANTHROPIC|["']claude["']/,
    );
  });

  it('degrades (never hard-blocks the push) when Node is unavailable', () => {
    expect(DISPATCHER).toMatch(/pre-push\.fallback\.sh/);
    expect(DISPATCHER).toMatch(/exit 0/);
  });
});

describe('pre-push.ts orchestrator — delegation folded through runCheck', () => {
  it('routes external checks through the tested runCheck helper', () => {
    expect(ORCHESTRATOR).toMatch(/from '\.\/utils\/run-check\.ts'/);
  });

  it('invokes the remaining audit-self self-tests by literal path', () => {
    // Wave 10.4: audit-ai-docs.test.sh → audit-ai-docs.test.ts (run via vitest/npx).
    // hook-stub-completeness.test.sh was migrated to principles/16-hook-stub-completeness.test.ts.
    // pre-push.test.sh was deleted in Wave 10.3 (its §1.7 scenarios moved to s17.test.ts).
    // The literal-path self-tests pre-push.ts still hard-invokes:
    for (const s of ['audit-ai-docs.test.ts', 'check-kickoff-portability.sh']) {
      expect(ORCHESTRATOR).toContain(`packages/core/audit-self/${s}`);
    }
  });

  it('drives both trailer checks from TS modules (legacy shim deleted in Wave 10.3)', () => {
    // §7 → checks/prior-art.ts (Wave 10.2); §1.7 → checks/s17.ts (Wave 10.3).
    expect(ORCHESTRATOR).toMatch(/from '\.\/checks\/prior-art\.ts'/);
    expect(ORCHESTRATOR).toMatch(/from '\.\/checks\/s17\.ts'/);
    expect(ORCHESTRATOR).not.toMatch(/legacy-trailer-checks\.sh'\]/); // no longer invoked
  });

  it('PREPUSH_ONLY seam is registry-driven, and both "prior-art" and "s17" are ids (ledger S-6)', () => {
    // The seam used to be one hand-written `if (env === '<id>')` arm per isolatable
    // section — eight of them, four with no caller, and an unknown value fell through
    // to the FULL hook while still exiting 0. It now resolves the id against SECTIONS,
    // so every registered section is isolatable and a typo cannot pass silently.
    expect(ORCHESTRATOR).toMatch(/SECTIONS\.find\(\(s\) => s\.id === only\)/);
    expect(ORCHESTRATOR).toMatch(/matches no pre-push section id/);
    // Behavioural half: the two ids the shell hook-tests set must exist in the registry
    // (a grep for the literal string would pass on a comment; this cannot).
    const ids = SECTIONS.map((s) => s.id);
    expect(ids).toContain('prior-art');
    expect(ids).toContain('s17');
    // ...and no stale per-section arm survives the refactor.
    expect(ORCHESTRATOR).not.toMatch(/PREPUSH_ONLY'\] === '/);
  });

  it('imports §7 prior-art check from the TS module (Wave 10.2)', () => {
    // §7 is now driven by runPriorArtCheck from checks/prior-art.ts.
    expect(ORCHESTRATOR).toMatch(/from '\.\/checks\/prior-art\.ts'/);
  });

  it('imports git helpers from utils/git.ts (Wave 10.2)', () => {
    expect(ORCHESTRATOR).toMatch(/from '\.\/utils\/git\.ts'/);
  });

  it('threads the trunk exclusion into the commit range (merge-forward range fix, 2026-08-07)', () => {
    // commitsToCheck must pass ResolvedBase.exclude to getCommits — dropping it
    // reverts to the bare remote_sha..local_sha range that flagged staging's own
    // squash commits on a merge-forward push (PR #1269/#1270 incident). The
    // behavioural paired-negative lives in tests/hooks/prepush-merge-forward-range.test.sh.
    expect(ORCHESTRATOR).toMatch(
      /getCommits\(rb\.base, rb\.head, rb\.exclude \?\? undefined\)/,
    );
  });
});

/**
 * Ledger A4-8 — the §8 lychee narrowing must exclude framework-SHIPPED markdown only.
 *
 * The classifier used to hold the bare prefixes `.claude/skills/` and `.claude/agents/`,
 * so on a consumer layout every skill and agent THEY authored was excluded from the link
 * walk. These arms pin the narrowed contract; the end-to-end proof (a consumer-authored
 * skill with a broken link actually reaching lychee and blocking the push) lives in
 * pre-push.consumer-layout.test.ts.
 */
describe('isFrameworkShippedMarkdown — shipped, not "everything under .claude/"', () => {
  const noBaseline = null;
  const baseline = new Set([
    '.claude/agents/living-docs-auditor.md',
    '.claude/skills/pipeline/SKILL.md',
  ]);

  it('a SHIPPED skill slug is excluded (no regression on the S2 Part 1 narrowing)', () => {
    expect(
      isFrameworkShippedMarkdown(
        '.claude/skills/pipeline/SKILL.md',
        noBaseline,
      ),
    ).toBe(true);
    expect(
      isFrameworkShippedMarkdown('.claude/skills/getff/SKILL.md', noBaseline),
    ).toBe(true);
  });

  it('a CONSUMER-authored skill is NOT excluded (the A4-8 defect)', () => {
    expect(
      isFrameworkShippedMarkdown('.claude/skills/deploy/SKILL.md', noBaseline),
    ).toBe(false);
    expect(
      isFrameworkShippedMarkdown('.claude/skills/deploy/notes.md', baseline),
    ).toBe(false);
  });

  it('a `<slug>.override.md` marks CONSUMER ownership → walked, not excluded', () => {
    expect(
      isFrameworkShippedMarkdown(
        '.claude/skills/pipeline.override.md',
        baseline,
      ),
    ).toBe(false);
  });

  it('agents: the delivery record decides — recorded excluded, unrecorded walked', () => {
    expect(
      isFrameworkShippedMarkdown(
        '.claude/agents/living-docs-auditor.md',
        baseline,
      ),
    ).toBe(true);
    expect(
      isFrameworkShippedMarkdown('.claude/agents/my-own-agent.md', baseline),
    ).toBe(false);
  });

  it('agents: NO delivery record → the whole subtree stays excluded (safe fallback)', () => {
    // Fail-open direction: without the manifest we must not start blocking a consumer's
    // push on OUR agents' framework-internal refs (the getff-honest-signals defect).
    expect(
      isFrameworkShippedMarkdown('.claude/agents/my-own-agent.md', noBaseline),
    ).toBe(true);
  });

  it('the static shipped rows still classify (AGENTS.md, .ai-factory/*)', () => {
    expect(isFrameworkShippedMarkdown('AGENTS.md', noBaseline)).toBe(true);
    expect(
      isFrameworkShippedMarkdown('.ai-factory/RULES.react-next.md', noBaseline),
    ).toBe(true);
    expect(isFrameworkShippedMarkdown('docs/adr/0001-x.md', noBaseline)).toBe(
      false,
    );
  });

  it('a stack variant the installer NEVER delivers is consumer content (A4-8 over-reach)', () => {
    // The rows were bare prefixes `.ai-factory/RULES.` / `.ai-factory/ARCHITECTURE.`
    // standing in for the four stack variants, so a consumer's own
    // `.ai-factory/RULES.internal.md` matched and was dropped from the §8 walk — the
    // `.claude/skills/` swallowing defect of #1630, one surface over. There is no
    // RULES.python.md / ARCHITECTURE.go.md destination anywhere in setup.d.
    expect(
      isFrameworkShippedMarkdown('.ai-factory/RULES.internal.md', noBaseline),
    ).toBe(false);
    expect(
      isFrameworkShippedMarkdown('.ai-factory/RULES.python.md', noBaseline),
    ).toBe(false);
    expect(
      isFrameworkShippedMarkdown('.ai-factory/ARCHITECTURE.go.md', noBaseline),
    ).toBe(false);
    // ...and a consumer's own backlog home under .ai-factory/ stays walked.
    expect(
      isFrameworkShippedMarkdown(
        '.ai-factory/orchestrator-prompts/ship-it/kickoff.md',
        noBaseline,
      ),
    ).toBe(false);
  });

  it('SHIPPED_SKILL_SLUGS matches what the installer actually delivers (drift gate)', () => {
    // The list this replaced was pure author attention ("DRIFT RISK IS NOT MECHANISED").
    // Derivation: setup.d/lib.sh tier lists + the two dirs 10-skills.sh copies by name.
    const lib = readFileSync(resolve(REPO_ROOT, 'setup.d/lib.sh'), 'utf8');
    const skills = readFileSync(
      resolve(REPO_ROOT, 'setup.d/10-skills.sh'),
      'utf8',
    );
    const tiers = [
      ...lib.matchAll(/GETFF_SKILLS_(?:CORE|ENV|FACTORY)="([^"]*)"/g),
    ]
      .flatMap((m) => (m[1] ?? '').split(/\s+/))
      .filter(Boolean);
    expect(
      tiers.length,
      'tier lists must parse (setup.d/lib.sh:61-63)',
    ).toBeGreaterThan(0);
    // Match the DESTINATION, not the delivery verb: #1624 replaced the `cp -r` in this
    // file with _copy_tree_with_transform, and a verb-shaped regex went stale the moment
    // it landed (this gate caught it). The `$PROJECT_ROOT/.claude/skills/<slug>` path is
    // what the installer promises regardless of how it copies.
    const byName = [
      ...skills.matchAll(/\$PROJECT_ROOT\/\.claude\/skills\/([a-z0-9-]+)/g),
    ].map((m) => m[1] as string);
    expect(
      byName.length,
      '10-skills.sh must name the skill dirs it delivers',
    ).toBeGreaterThan(0);
    const delivered = [...new Set([...tiers, ...byName])].sort();
    expect([...SHIPPED_SKILL_SLUGS].sort()).toEqual(delivered);
  });
});

/**
 * Ledger A4-8, second half — the `.ai-factory/*` rows were the last un-gated part of the
 * classifier. Nothing failed when a new shipped destination arrived without a row, and
 * two rows had already drifted in each direction (measured 2026-09-06; see the
 * SHIPPED_MD_DESTINATIONS doc comment in pre-push.ts).
 *
 * DERIVATION SOURCE — the snapshot fingerprint corpus, tests/install-sh/baselines/**,
 * which is the sha256 manifest of a REAL install into a scratch fixture, one per
 * stack x greenfield/brownfield. It is the destination SSOT that cannot go verb-stale:
 * there are no delivery verbs in it, only the tree the installer produced. That matters
 * because the SHIPPED_SKILL_SLUGS gate above learned the lesson the hard way — #1624
 * replaced 10-skills.sh's `cp -r` with _copy_tree_with_transform and a verb-shaped regex
 * went stale within hours. A path-shape scan of setup.d would also have to distinguish
 * DELIVERIES from mere READS of the same path (install.sh:552-559 probes
 * `.ai-factory/RULES.react-next.md` to detect the stack; 60-ci.sh:72 reads
 * tool-decisions.md), and getting that wrong in the read direction would manufacture a
 * row for a consumer-authored path — the over-reach half of this very finding.
 *
 * The corpus is regenerated by `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`,
 * which is mandatory whenever a delivery changes, and CI compares it. So a new
 * `.ai-factory/CONVENTIONS.md` cannot reach a consumer without passing through here.
 */
describe('shipped-markdown classifier — drift gate against the install fingerprints', () => {
  /** Every *.md path any stack's install actually produced. */
  const deliveredMd: readonly string[] = (() => {
    const root = resolve(REPO_ROOT, 'tests/install-sh/baselines');
    const out = new Set<string>();
    for (const stack of readdirSync(root, { withFileTypes: true })) {
      if (!stack.isDirectory()) continue;
      for (const fp of readdirSync(resolve(root, stack.name))) {
        if (!fp.endsWith('.fingerprint')) continue;
        for (const line of readFileSync(
          resolve(root, stack.name, fp),
          'utf8',
        ).split('\n')) {
          // "<sha256>  <consumer-relative path>"
          const path = line.split(/\s{2,}/)[1]?.trim();
          if (path && /\.(md|markdown)$/.test(path)) out.add(path);
        }
      }
    }
    return [...out].sort();
  })();

  it('the fingerprint corpus parses (no vacuous green)', () => {
    // A corpus that failed to parse would make every arm below pass over an empty set —
    // the skip-reported-as-green trap. Measured 2026-09-06: 77 delivered *.md paths.
    expect(deliveredMd.length).toBeGreaterThan(50);
    expect(deliveredMd).toContain('AGENTS.md');
    expect(deliveredMd).toContain('.ai-factory/RULES.md');
  });

  it('UNDER-coverage: every delivered *.md classifies as framework-shipped', () => {
    // Null baseline on purpose: .ai-factory/refresh-baseline.json is absent whenever the
    // consumer has no jq, and THAT is the arm the static lists serve. With a manifest
    // present these same paths are covered by the delivery record instead.
    const walked = deliveredMd.filter(
      (p) => !isFrameworkShippedMarkdown(p, null),
    );
    expect(
      walked,
      'these shipped *.md destinations would be walked by lychee on a consumer tree, ' +
        'so a framework-internal ref in one of them blocks the consumer push — add the ' +
        'destination to SHIPPED_MD_DESTINATIONS (or a namespace to SHIPPED_MD_PREFIXES)',
    ).toEqual([]);
  });

  it('OVER-coverage: every SHIPPED_MD_DESTINATIONS row backs a real delivery', () => {
    // A row the installer no longer delivers keeps swallowing whatever the consumer
    // writes at that path — the #1630 defect class.
    const stale = SHIPPED_MD_DESTINATIONS.filter(
      (row) => !deliveredMd.includes(row),
    );
    expect(
      stale,
      'no install produces these paths — drop the row, or they silently exclude ' +
        'consumer-authored files from the §8 walk',
    ).toEqual([]);
  });

  it('OVER-coverage: every SHIPPED_MD_PREFIXES row backs a real delivery', () => {
    const stale = SHIPPED_MD_PREFIXES.filter(
      (pfx) => !deliveredMd.some((p) => p.startsWith(pfx)),
    );
    expect(stale, 'prefix rows with nothing behind them').toEqual([]);
    // A prefix must stay a NAMESPACE, never a bare subtree that could hold consumer
    // content: `.claude/skills/` is the shape this finding's sibling (#1630) had to
    // delete, and `.ai-factory/` would swallow the consumer's own orchestrator-prompts.
    for (const pfx of SHIPPED_MD_PREFIXES) {
      expect(pfx, 'prefix rows must be scoped below a top-level dir').toMatch(
        /^[^/]+\/.+\/$/,
      );
    }
  });
});
