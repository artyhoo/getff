/**
 * Shared kickoff population — "what a kickoff IS", in one place.
 *
 * Extracted from principle 12 when principle 40 (rigor-label presence) needed the same
 * population. Two principle tests resolving the kickoff family by two hand-kept copies of
 * the same regex is `#sync-by-copy-paste` (.claude/rules/dual-implementation-discipline.md);
 * the precedent for extracting instead is `rule-channel-glob.ts`, shared by principle 31 and
 * scripts/render-rule-index.mjs.
 *
 * A third copy still exists on purpose: `.claude/hooks/check-kickoff-traps.sh` is the
 * edit-time twin, written in bash for a different channel. It and this module must agree on
 * what a kickoff is — that obligation is prose, unchanged by this extraction.
 */
import { readdirSync, existsSync, lstatSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '../../..');
export const KICKOFFS_DIR = resolve(REPO_ROOT, '.claude/orchestrator-prompts');

/**
 * The stage-kickoff family: `kickoff-s1.md`, `kickoff-s2b.md`, `kickoff-s10.md`,
 * `kickoff-r1.md`. A multi-stage umbrella dispatches these, each a dispatch input in
 * exactly the sense `kickoff.md` is.
 *
 * The `<letter><digit>` core is what keeps sidecars out: `kickoff-amendments.md` (an audit
 * trail extracted from a kickoff's §12 to clear the 600-line gate) and
 * `kickoff-s4.decisions.md` (an owner-fork log) are records ABOUT a stage, carrying no
 * worker instructions. `.gitignore` draws the same line — the stage family is un-ignored by
 * glob (`kickoff-s*.md`, `kickoff-r*.md`), the amendments sidecar one-off by exact name. The
 * trailing `[a-z0-9]*` (not `.*`) is what rejects the dotted sidecar.
 */
export const STAGE_KICKOFF_RE = /^kickoff-[a-z]\d[a-z0-9]*\.md$/;

/**
 * Sandbox dirs written by the sibling hook suite
 * (packages/core/hooks/check-kickoff-traps.test.ts `writeKickoffNamed`, which mkdtemps
 * `c2-test-*` under the REAL orchestrator-prompts dir because the hook matches on the
 * absolute path's suffix). Its fixtures are DELIBERATELY malformed — that is what the
 * paired-negatives assert — so when suites run concurrently a population gate would flag
 * another test's scratch files as violations.
 */
export const TEST_SANDBOX_RE = /^c2-test-/;

export interface KickoffEntry {
  dir: string;
  /** Basename — `kickoff.md` or a stage kickoff. Distinguishes entries sharing a dir. */
  file: string;
  path: string;
  /** `<dir>` for the umbrella kickoff, `<dir>/<file>` for a stage — violation reporting. */
  label: string;
  /** Repo-relative POSIX path — the join key for git-derived data (principle 40). */
  repoRelative: string;
}

export function getKickoffEntries(): KickoffEntry[] {
  if (!existsSync(KICKOFFS_DIR)) return [];
  const entries: KickoffEntry[] = [];
  for (const d of readdirSync(KICKOFFS_DIR, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    if (TEST_SANDBOX_RE.test(d.name)) continue;
    const waveDir = resolve(KICKOFFS_DIR, d.name);
    let files: string[];
    try {
      files = readdirSync(waveDir);
    } catch {
      continue; // unreadable dir (broken coordination symlink) — not a violation
    }
    for (const file of files.sort()) {
      if (file !== 'kickoff.md' && !STAGE_KICKOFF_RE.test(file)) continue;
      const path = resolve(waveDir, file);
      if (!existsSync(path)) continue;
      entries.push({
        dir: d.name,
        file,
        path,
        label: file === 'kickoff.md' ? d.name : `${d.name}/${file}`,
        repoRelative: `.claude/orchestrator-prompts/${d.name}/${file}`,
      });
    }
  }
  return entries.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * A "coordination mirror" is an umbrella whose kickoff.md is a SYMLINK into the shared
 * coordination store ($CANON), materialised locally by channel G (.husky/post-checkout →
 * scripts/link-coordination.sh). Such an umbrella was authored in some other worktree; its
 * obligations were (or should have been) checked AT ITS AUTHORING worktree while the file
 * was real. Re-checking every mirror in every worktree makes a gate fail on historical
 * umbrellas the current worktree never wrote.
 */
export function isCoordinationMirror(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}
