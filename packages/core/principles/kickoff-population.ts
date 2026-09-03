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
 * Dotted sidecars — records ABOUT a kickoff, carrying no worker instructions:
 * `kickoff.decisions.md` (umbrella-level owner-fork log), `kickoff-s4.decisions.md`
 * (per-stage). The dot is the marker; `STAGE_KICKOFF_RE`'s trailing `[a-z0-9]*` rejects
 * them by construction, and `.gitignore` un-ignores them by their own globs.
 */
export const SIDECAR_DOTTED_RE = /^kickoff(-[a-z0-9]+)?\.[a-z0-9-]+\.md$/;

/**
 * Word-form sidecars, un-ignored one-off by exact name in `.gitignore`. Exact rather than
 * a `kickoff-[a-z]+\.md` glob: a sidecar is a deliberate one-off, and a glob would silently
 * absorb a future near-miss stage name that happens to carry no digit.
 */
export const SIDECAR_EXACT: readonly string[] = ['kickoff-amendments.md'];

/**
 * Legacy free-form stage kickoffs, grandfathered at the 2026-09-02 naming gate.
 *
 * `defer-reflex-detection/kickoff-stage-2-and-3.md` (authored 2026-05-25) is a genuine
 * dispatch input under a name no channel ever recognised — the live proof that
 * `#kickoff-name-near-miss` predates its detector. It is UNTRACKED (no `.gitignore`
 * exception matches it), so it never reached `staging` and never dispatched; its umbrella
 * is closed (`done.md` present). Amnesty, not a free pass: any NEW unrecognised name is a
 * violation. Same explicit-allowlist shape as principle 12's `EXEMPT_LIST` — a date cutoff
 * cannot separate these (the files are gitignored, so git carries no authoring date).
 */
export const GRANDFATHERED_KICKOFF_NAMES: readonly string[] = ['kickoff-stage-2-and-3.md'];

/**
 * How a `kickoff*.md` basename resolves. The SSOT for "is this name recognised" — the gate
 * exists because a near-miss (`kickoff-bs0.md`: `[a-z]` eats `b`, then `\d` meets `s`) was
 * previously INDISTINGUISHABLE from a deliberate sidecar, so principle 12 skipped the file
 * and reported green having examined nothing (measured 2026-09-02, beta-docs-showcase BS0).
 *
 * `unrecognised` is the whole point: it is the class that used to be silently absorbed.
 */
export type KickoffNameClass =
  | 'umbrella'
  | 'stage'
  | 'sidecar'
  | 'grandfathered'
  | 'unrecognised'
  | 'other';

export function classifyKickoffName(name: string): KickoffNameClass {
  if (name === 'kickoff.md') return 'umbrella';
  if (STAGE_KICKOFF_RE.test(name)) return 'stage';
  if (SIDECAR_DOTTED_RE.test(name) || SIDECAR_EXACT.includes(name)) return 'sidecar';
  if (GRANDFATHERED_KICKOFF_NAMES.includes(name)) return 'grandfathered';
  // Only `kickoff-….md` names are judged. `done.md`, `report.md`, `l1-dispatch.md`,
  // `state.md` are not kickoff-shaped and carry no naming obligation.
  if (/^kickoff-.*\.md$/.test(name)) return 'unrecognised';
  return 'other';
}

/** The two alternatives an `unrecognised` author must pick between — used in gate text. */
export const KICKOFF_NAME_REMEDY =
  'rename to the stage form `kickoff-<letter><digit>[alnum].md` (e.g. `kickoff-b0.md`, `kickoff-s2b.md`) ' +
  'so the dispatch gates resolve it, OR — if it carries no worker instructions — to a sidecar form ' +
  '(`kickoff[-<stage>].<kind>.md`, e.g. `kickoff-s4.decisions.md`) and add its `.gitignore` exception.';

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

/**
 * Every `kickoff-*.md` on disk whose name `classifyKickoffName` cannot resolve.
 *
 * Walks the FULL directory rather than `getKickoffEntries()`: that helper filters the
 * population DOWN to recognised names, which is exactly how an unrecognised one becomes
 * invisible. Test-sandbox dirs are skipped for the same reason principle 12 skips them —
 * the sibling hook suite mkdtemps deliberately-malformed fixtures under the real dir.
 */
export function getUnrecognisedKickoffNames(): { dir: string; file: string; label: string }[] {
  if (!existsSync(KICKOFFS_DIR)) return [];
  const out: { dir: string; file: string; label: string }[] = [];
  for (const d of readdirSync(KICKOFFS_DIR, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    if (TEST_SANDBOX_RE.test(d.name)) continue;
    let files: string[];
    try {
      files = readdirSync(resolve(KICKOFFS_DIR, d.name));
    } catch {
      continue; // unreadable dir (broken coordination symlink) — not a violation
    }
    for (const file of files.sort()) {
      if (classifyKickoffName(file) !== 'unrecognised') continue;
      out.push({ dir: d.name, file, label: `${d.name}/${file}` });
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}
