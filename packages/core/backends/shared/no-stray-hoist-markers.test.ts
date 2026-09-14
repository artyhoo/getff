// no-stray-hoist-markers — executable invariant for MT 3c (the frame extraction).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §7.
//
// The `@hoist-at-s3` markers lived on the S2 render-outcome unit to mark the future 3c hoist.
// Once 3c extracts that frame into backends/shared/, NO file under backends/cargo or
// backends/npm may still carry the marker — a stray one means a unit was copied instead of
// moved, or a new unit re-introduced the pre-hoist bridge. This test makes that invariant
// executable (was a PR-time-only eyeball check before 3c).

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKENDS_ROOT = join(__dirname, '..');
const MARKER = '@hoist-at-s3';
const ROOTS = ['cargo', 'npm'];

/**
 * Git-hook-safe environment: process.env with the git dir/work-tree variables removed.
 *
 * Under `.husky/pre-push` git exports GIT_DIR (and friends), and those OVERRIDE `cwd` in
 * execFileSync — so every git call below would silently target the outer repository instead
 * of the directory it names. Three failure modes, in ascending order of damage:
 * `git add` fails and the push dies (observed 2026-09-14); `trackedFilesUnder(fixtureRoot)`
 * enumerates the real repo while reporting it as the fixture's population, which would make
 * arms (c)-(e) assert nothing; and `git init` WRITES to the shared repository config.
 *
 * That third one is measured, not theorised — in an isolated sandbox, `git init` run with
 * GIT_DIR pointed at a linked worktree's admin dir flipped `core.bare` from `false` to `true`
 * in the COMMON `.git/config`, the file every linked worktree of this repo shares (167 of
 * them at the time of writing). A test that corrupts the checkout it is being run to protect
 * is worse than the invariant it enforces. Mirrors
 * `packages/core/principles/11-build-first-reuse-default.test.ts:111-125`, which carries the
 * same scrub for the same reason.
 */
const GIT_ENV_SCRUB = (() => {
  const env = { ...process.env };
  for (const k of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_COMMON_DIR',
    'GIT_NAMESPACE',
  ]) {
    delete env[k];
  }
  return env;
})();

/**
 * Paths (relative to `dir`) of every file git tracks under `roots`.
 *
 * Tracked-only, and NOT a filesystem walk. The walk this replaced had no exclusions at all:
 * it descended into the gitignored cargo `target/` trees under backends/cargo (measured
 * 2026-09-14: 94 files present vs. 37 tracked — 57 build artefacts, 312 KB, 37 of them
 * binary) and read every one as UTF-8. Two consequences, neither cosmetic: the scan raced
 * a concurrent `cargo` writing those trees and died with ENOENT between readdirSync and
 * statSync on a transient incremental artefact (observed once in this repo, 2026-09-14, on
 * a pre-push that had nothing to do with backends); and build output is not repo content,
 * so a marker found there would be a finding about an artefact `git status` cannot show you.
 *
 * Throws rather than degrading, per the ledger A8-5 precedent recorded at
 * `packages/core/principles/33-adapter-jig-arm-registry.ts:760-790`: a git failure must not
 * silently substitute a different population and report the answer as if it were the same
 * check. Returning `[]` would be worse here than in a set-equality gate — the assertion
 * below is "no hits", so an empty population passes VACUOUSLY. Hence the loud throw, plus
 * the non-vacuity floor in arm (b) (precedent:
 * `packages/core/principles/41-shell-test-ci-coverage.test.ts:172-182`).
 */
function trackedFilesUnder(dir: string, roots: readonly string[]): string[] {
  let out: string;
  try {
    out = execFileSync('git', ['ls-files', '-z', '--', ...roots], {
      cwd: dir,
      encoding: 'utf8',
      env: GIT_ENV_SCRUB,
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (err) {
    throw new Error(
      `no-stray-hoist-markers: \`git ls-files\` failed in ${dir}, so the population under ` +
        `[${roots.join(', ')}] is unknown. Refusing to substitute a filesystem walk — it would ` +
        `scan a DIFFERENT set (untracked + gitignored build output) and call the answer the ` +
        `same invariant. Cause: ${(err as Error).message}`,
    );
  }
  return out.split('\0').filter(Boolean).sort();
}

/** Tracked files under `roots` that still contain the stray hoist marker, relative-labelled. */
function filesWithStrayMarker(dir = BACKENDS_ROOT, roots = ROOTS): string[] {
  return trackedFilesUnder(dir, roots).filter((rel) =>
    readFileSync(join(dir, rel), 'utf8').includes(MARKER),
  );
}

/** A temp git repo with `cargo/` + `npm/` under it, so `git ls-files` has something to report. */
function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'no-stray-hoist-'));
  execFileSync('git', ['init', '-q'], {
    cwd: root,
    env: GIT_ENV_SCRUB,
    stdio: 'ignore',
  });
  for (const r of ROOTS) mkdirSync(join(root, r), { recursive: true });
  // One tracked, marker-free file per root, so the population is never empty.
  for (const r of ROOTS) {
    writeFileSync(
      join(root, r, 'clean.ts'),
      '// an ordinary unit, no marker\n',
    );
  }
  execFileSync('git', ['add', '--', ...ROOTS], {
    cwd: root,
    env: GIT_ENV_SCRUB,
    stdio: 'ignore',
  });
  return root;
}

describe('no-stray-hoist-markers — the 3c frame-extraction invariant', () => {
  it('(a) no tracked file under backends/cargo or backends/npm carries the @hoist-at-s3 marker', () => {
    expect(filesWithStrayMarker()).toEqual([]);
  });

  it('(b) non-vacuity: the tracked population is real, not collapsed to empty', () => {
    const pop = trackedFilesUnder(BACKENDS_ROOT, ROOTS);
    // 45 tracked at the time of writing (37 cargo + 8 npm). A floor well under that catches a
    // broken enumerator — which would make arm (a) pass by scanning nothing — without breaking
    // on every added or removed unit.
    expect(
      pop.length,
      'population collapsed — the git ls-files filter is broken',
    ).toBeGreaterThan(20);
    expect(pop.every((rel) => ROOTS.some((r) => rel.startsWith(`${r}/`)))).toBe(
      true,
    );
  });

  it('(c) paired negative: a TRACKED file carrying the marker IS reported', () => {
    const root = fixtureRepo();
    writeFileSync(join(root, 'cargo', 'stray.ts'), `// ${MARKER}: planted\n`);
    execFileSync('git', ['add', '--', 'cargo/stray.ts'], {
      cwd: root,
      env: GIT_ENV_SCRUB,
      stdio: 'ignore',
    });
    expect(filesWithStrayMarker(root)).toEqual(['cargo/stray.ts']);
  });

  it('(d) paired positive: the SAME marked file is NOT reported while untracked — the predicate is trackedness, not a path pattern', () => {
    const root = fixtureRepo();
    // Byte-identical content at the identical path as (c); the ONLY difference is `git add`.
    // This is what proves the fix is trackedness rather than an exclusion list that happens to
    // name `target/`: nothing here is named, and the file still drops out of the population.
    writeFileSync(join(root, 'cargo', 'stray.ts'), `// ${MARKER}: planted\n`);
    expect(filesWithStrayMarker(root)).toEqual([]);
  });

  it('(e) the gitignored build-output shape the old walk scanned is excluded by construction', () => {
    const root = fixtureRepo();
    writeFileSync(join(root, '.gitignore'), 'target/\n');
    mkdirSync(join(root, 'cargo', 'demo', 'target'), { recursive: true });
    writeFileSync(
      join(root, 'cargo', 'demo', 'target', 'artefact.rs'),
      `// ${MARKER}\n`,
    );
    expect(filesWithStrayMarker(root)).toEqual([]);
  });
});
