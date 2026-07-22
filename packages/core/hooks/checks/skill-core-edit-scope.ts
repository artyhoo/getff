/**
 * skill-core-edit-scope.ts — adapter-jig arm G3 `zero-skill-core-edits`
 * (spec §3.7): the per-PR-diff scope guard for adapter-wiring changes.
 *
 * Invariant (spec §3.7 G3; origin rule-tests-surface-design D2 acceptance +
 * T-UTS-A): an adapter-wiring PR touches only detector + adapter + delivery
 * slice + tests. The skill/agent/IR surfaces are name-only-diff clean; if a
 * wiring change NEEDS an edit there, the architecture failed — STOP, never
 * fork the protocol.
 *
 * Realization (J2 decisions log #9 — binding): a PURE prefix-set-membership
 * check over a SUPPLIED changed-file list, absent-path tolerant. Two of the
 * three protected surfaces (`.claude/skills/rule-tests/`,
 * `agents/rule-test-author.md`) are rule-tests-surface S1 FUTURE artifacts
 * that do NOT exist in this source repo (design-by-spec consumer-project
 * paths per the CLAUDE.md Artifact Ownership Contract) — an existence-based
 * guard (`git ls-files <path>` / «file X byte-unchanged») would be VACUOUSLY
 * green for them (T15/T2 vacuity). A prefix guard stays valid for
 * nonexistent paths: CREATING a protected path in a wiring diff is also an
 * intersection and still REDs. The in-repo RED-provable anchor is
 * `packages/core/ir/types.ts` (the one protected surface that exists).
 *
 * Runtime seam: the check is pure (`checkDiffScope` over a string list) so
 * suites exercise it against stub fixtures; `checkDiffScopeForSha` adapts the
 * existing GitProvider.changedFiles infra (hooks/utils/git.ts) for a real
 * per-PR/per-push invocation context. Deterministic, zero LLM calls.
 */
import type { GitProvider } from '../utils/git.ts';

/**
 * The FROZEN protected-surface set (spec §3.7 G3 RED-proof column, verbatim).
 * Entries ending in `/` protect the whole subtree (path-prefix membership);
 * other entries are exact repo-relative file paths. Do not widen or narrow
 * without a spec §2/§3 change — this set is the arm's contract.
 */
export const PROTECTED_SURFACES: readonly string[] = [
  '.claude/skills/rule-tests/',
  'agents/rule-test-author.md',
  'packages/core/ir/types.ts',
];

/** One protected-surface hit in a changed-file list. */
export interface DiffScopeViolation {
  /** The changed repo-relative path that intersected the protected set. */
  readonly changed: string;
  /** The protected-surface entry it intersected (prefix or exact). */
  readonly surface: string;
}

/** Prefix/exact membership: a dir-entry (trailing `/`) matches any path under
 *  it; a file-entry matches exactly. Purely lexical — NO filesystem access, so
 *  absent-by-design surfaces guard identically to existing ones. */
function intersects(changedPath: string, surface: string): boolean {
  if (surface.endsWith('/')) return changedPath.startsWith(surface);
  return changedPath === surface;
}

/**
 * The G3 check: every changed file intersecting the protected set is a
 * violation (RED). Input paths are repo-relative as git emits them
 * (`git diff --name-only` / `diff-tree` form — no leading `./`).
 */
export function checkDiffScope(
  changedFiles: readonly string[],
  protectedSurfaces: readonly string[] = PROTECTED_SURFACES,
): DiffScopeViolation[] {
  const violations: DiffScopeViolation[] = [];
  for (const changed of changedFiles) {
    for (const surface of protectedSurfaces) {
      if (intersects(changed, surface)) violations.push({ changed, surface });
    }
  }
  return violations;
}

/**
 * Real-git adapter for the per-PR-diff invocation context: pull the commit's
 * changed files from the existing GitProvider seam (ALL statuses — a delete
 * or rename of a protected surface is as much an edit as a modification) and
 * run the pure check. Stub-injectable exactly like checks/prior-art.ts.
 */
export function checkDiffScopeForSha(
  git: Pick<GitProvider, 'changedFiles'>,
  sha: string,
  protectedSurfaces: readonly string[] = PROTECTED_SURFACES,
): DiffScopeViolation[] {
  return checkDiffScope(
    git.changedFiles(sha).map((entry) => entry.path),
    protectedSurfaces,
  );
}
