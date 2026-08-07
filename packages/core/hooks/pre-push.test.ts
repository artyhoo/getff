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
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
    expect(DISPATCHER).not.toMatch(/AI_HARNESS|CLAUDE_CODE|ANTHROPIC|["']claude["']/);
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

  it('PREPUSH_ONLY seam accepts both "prior-art" and "s17" (Wave 10.3 extension)', () => {
    // Ensures the test seam is exercisable for §1.7 in isolation — the anti-tautology
    // pattern from prior-art-trailer-hook.test.sh applied to the s17 section.
    expect(ORCHESTRATOR).toMatch(/PREPUSH_ONLY.*prior-art/);
    expect(ORCHESTRATOR).toMatch(/PREPUSH_ONLY.*s17/);
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
