/**
 * Principle 47 — an ESM "am I the entry point?" check must realpath BOTH sides.
 *
 * > **Authoritative for:** no git-tracked source file compares `import.meta.url` (or
 * > `import.meta.filename`) against `process.argv[1]` without resolving both through
 * > `realpathSync` — the shared helpers `scripts/lib/is-main-entry.mjs` (scripts) and
 * > `packages/core/hooks/utils/is-direct-run.ts` (packages/core) are the sanctioned forms.
 * > **NOT authoritative for:** project goal — see README.md#why-this-exists. The defect class
 * > and its prior art — SSOT docs/meta-factory/prior-art-evaluations.md #269.
 *
 * ## The defect, measured
 *
 * Node resolves `import.meta.url` through symlinks; `process.argv[1]` is the path as typed. A
 * compare that does not realpath both sides is false whenever the script is reached through a
 * symlinked directory, so main() never runs and the process exits 0 with no output. On the PC
 * mirror (`/home/etot/mirror` -> `/mnt/wsl/spill/mirror`) that turned
 * `scripts/check-line-citations.mjs` into a silent pass of every check (2026-09-29). The same
 * day, `node <tmp>/linked/render-rule-index.mjs --check` (`<tmp>/linked` -> `<repo>/scripts`)
 * on a deliberately drifted `00-rule-index.md` exited 0 with zero bytes of output, against
 * exit 1 by the real path. Population then (`git grep` for the compare, plus the multi-line
 * `packages/core/detector/index.ts` form that grep missed): 19 naive sites in 19 files, now
 * routed through the two helpers or the inline realpath-both-sides form.
 *
 * ## Channel (rule-enforcement-channel-selection.md §3)
 *
 * Mechanically detectable → gate. The principles suite runs at pre-push
 * (`principlesMetaSection`) and in CI, and the invariant is repo-wide, not change-scoped.
 *
 * ## Declared limits
 *
 * Detection is textual over a ±2-line window around a `===`/`!==`: an `argv[1]` aliased into a
 * variable many lines above the compare, or a hand-rolled compare in a language other than
 * JS/TS, is not seen. `*.bundle.mjs` is excluded (generated — its sources are in scope), and so
 * is test material (a symlink test names the naive form on purpose). Comment lines never count
 * toward the realpath tally, so prose cannot vouch for a one-sided compare.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isDirectRun } from '../hooks/utils/is-direct-run.ts';

const REPO_ROOT = resolve(__dirname, '../../..');

const META = /import\.meta\.(url|filename)/;
const ARGV1 = /argv\[1\]/;
const COMMENT_LINE = /^\s*(\*|\/\/|\/\*)/;
const FILE_URL_TEMPLATE = /`file:\/\/\$\{[^}]*argv\[1\][^}]*\}`/;

export interface NaiveSite {
  line: number;
  text: string;
}

/** Naive entry-point compares in `src`: 1-based line of the compare + its text. */
export function findNaiveEntryCompares(src: string): NaiveSite[] {
  const lines = src.split('\n');
  const out: NaiveSite[] = [];
  lines.forEach((text, i) => {
    if (COMMENT_LINE.test(text)) return; // prose naming the defect executes nothing
    if (FILE_URL_TEMPLATE.test(text)) {
      out.push({ line: i + 1, text: text.trim() });
      return;
    }
    if (!/[!=]==/.test(text)) return;
    // Code lines only: a comment saying "realpath both sides" must not vouch for a one-sided compare.
    const window = lines
      .slice(Math.max(0, i - 2), i + 3)
      .filter((l) => !COMMENT_LINE.test(l))
      .join('\n');
    if (!META.test(window) || !ARGV1.test(window)) return;
    if ((window.match(/realpath/g) ?? []).length >= 2) return;
    out.push({ line: i + 1, text: text.trim() });
  });
  return out;
}

function isExempt(path: string): boolean {
  return (
    path.endsWith('.bundle.mjs') ||
    /(^|\/)node_modules\//.test(path) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) ||
    /(^|\/)(tests?|__tests__|[^/]*fixtures)\//.test(path)
  );
}

function trackedSources(): string[] {
  return execFileSync(
    'git',
    ['ls-files', '-z', '--', '*.mjs', '*.cjs', '*.js', '*.ts', '*.mts', '*.cts'],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
    .split('\0')
    .filter(Boolean)
    .filter((p) => !isExempt(p));
}

describe('principle 47 — symlink-safe ESM entry-point checks', () => {
  it('(a) no tracked source carries a naive import.meta.url vs argv[1] compare', () => {
    const files = trackedSources();
    expect(files.length).toBeGreaterThan(100); // non-vacuity: the population is real
    const hits: string[] = [];
    for (const f of files) {
      let src: string;
      try {
        src = readFileSync(join(REPO_ROOT, f), 'utf8');
      } catch {
        continue; // tracked but deleted in the working tree
      }
      if (!META.test(src) || !ARGV1.test(src)) continue;
      for (const s of findNaiveEntryCompares(src)) hits.push(`${f}:${s.line}  ${s.text}`);
    }
    expect(
      hits,
      'naive entry-point compare — use isMainEntry(import.meta.url) from scripts/lib/is-main-entry.mjs ' +
        'or isDirectRun(process.argv[1], import.meta.url) from packages/core/hooks/utils/is-direct-run.ts',
    ).toEqual([]);
  });

  it('(b) seeded naive shapes from the 2026-09-29 population are all detected', () => {
    const shapes = [
      "return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '');",
      'if (import.meta.url === `file://${process.argv[1]}`) {',
      'if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {',
      'const isMain =\n  Boolean(process.argv[1]) &&\n  import.meta.url === pathToFileURL(process.argv[1] as string).href;',
      'const moduleUrl = new URL(import.meta.url).pathname;\nif (process.argv[1] && resolve(process.argv[1]) === resolve(moduleUrl)) {',
      "return new URL(import.meta.url).pathname === resolve(process.argv[1] ?? '');",
      // realpath on ONE side is still the defect
      "return realpathSync(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? '');",
      // ...and a nearby comment naming realpath does not make it two-sided
      '// realpath both sides here\nif (realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();',
    ];
    for (const s of shapes) expect(findNaiveEntryCompares(s), s).toHaveLength(1);
  });

  it('(c) the sanctioned forms are accepted', () => {
    const ok = [
      'if (isMainEntry(import.meta.url)) main();',
      'if (isDirectRun(process.argv[1], import.meta.url)) main();',
      "return (\n  realpathSync(fileURLToPath(import.meta.url)) ===\n  realpathSync(process.argv[1] ?? '')\n);",
    ];
    for (const s of ok) expect(findNaiveEntryCompares(s), s).toEqual([]);
    expect(findNaiveEntryCompares(' * `fileURLToPath(import.meta.url) === process.argv[1]` breaks')).toEqual([]);
  });

  describe('(d) symlinked invocation', () => {
    it('isDirectRun is true for a symlinked argv[1] and false for another module', () => {
      const base = mkdtempSync(join(tmpdir(), 'p47-'));
      try {
        const real = join(base, 'real');
        mkdirSync(real);
        writeFileSync(join(real, 'entry.mjs'), '');
        writeFileSync(join(real, 'other.mjs'), '');
        symlinkSync(real, join(base, 'link'));
        const meta = pathToFileURL(join(real, 'entry.mjs')).href;
        expect(isDirectRun(join(base, 'link', 'entry.mjs'), meta)).toBe(true);
        expect(isDirectRun(join(real, 'other.mjs'), meta)).toBe(false);
        expect(isDirectRun(undefined, meta)).toBe(false);
      } finally {
        rmSync(base, { recursive: true, force: true });
      }
    });

    it('a script run through a symlinked directory reaches main() via isMainEntry', () => {
      // Synthetic entry, not a real --check: the arm must not go red on unrelated drift, and
      // plain `node` must run it on every engines-allowed Node (no .ts import).
      const base = mkdtempSync(join(tmpdir(), 'p47-link-'));
      try {
        const real = join(base, 'real');
        mkdirSync(real);
        const helper = pathToFileURL(join(REPO_ROOT, 'scripts/lib/is-main-entry.mjs')).href;
        writeFileSync(
          join(real, 'entry.mjs'),
          `import { isMainEntry } from ${JSON.stringify(helper)};\n` +
            `console.log(isMainEntry(import.meta.url) ? 'MAIN-RAN' : 'NOT-MAIN');\n`,
        );
        writeFileSync(join(real, 'importer.mjs'), `import './entry.mjs';\n`);
        symlinkSync(real, join(base, 'link'));
        const run = (f: string) =>
          spawnSync(process.execPath, [join(base, 'link', f)], { encoding: 'utf8' });
        const direct = run('entry.mjs');
        expect(direct.status, direct.stderr).toBe(0);
        expect(direct.stdout.trim()).toBe('MAIN-RAN');
        expect(run('importer.mjs').stdout.trim()).toBe('NOT-MAIN');
      } finally {
        rmSync(base, { recursive: true, force: true });
      }
    });
  });
});
