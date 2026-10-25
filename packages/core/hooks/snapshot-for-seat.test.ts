/**
 * Functional tests for scripts/snapshot-for-seat.sh — the immutable-inputs helper of
 * .claude/rules/cold-seat-economy.md §7.
 *
 *   Usage  : bash scripts/snapshot-for-seat.sh [--out <dir>] <commit-ish> <path>...
 *   stdout : line 1 `Inputs-ref: <full-sha>`, then one absolute snapshot path per line
 *   exit   : 0 = every path written ; 1 = unresolvable ref / path absent at the ref ;
 *            2 = usage error
 *
 * The property the helper is paid for: a seat reading the snapshot sees the bytes AT the
 * named commit, whatever happens to the working tree or the branch afterwards (the
 * 2026-09-13 incident: a sibling session landed folds into four of five live worktree
 * paths while the seats were reading them). The first case below proves exactly that —
 * the working tree and the branch both move after the snapshot, the snapshot does not.
 *
 * Every case runs against a throw-away git repo under the OS temp dir; nothing touches
 * the real repository.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { symlinkOrJunctionOrSkip } from './symlink-or-junction-or-skip.ts';
import { spawnBashOrSkip, type Skippable } from './spawn-bash-or-skip.ts';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
/**
 * MSYS-printed path -> node-usable form. On win32 the SUT echoes paths through Git-Bash
 * canonicalization (`/tmp/...` — its usertemp mapping of the Windows TEMP; `/c/...` — a
 * drive), which node cannot open or compare against the join()-built fixtures.
 * POSIX identity.
 */
function fromMsys(p: string): string {
  if (process.platform !== 'win32' || !p.startsWith('/')) return p;
  if (p.startsWith('/tmp/')) return join(tmpdir(), p.slice('/tmp/'.length));
  const m = /^\/([a-z])\/(.*)$/.exec(p);
  return m ? `${m[1].toUpperCase()}:/${m[2]}` : p;
}


const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SCRIPT = resolve(REPO_ROOT, 'scripts/snapshot-for-seat.sh');

// Shell + git spawning; the 5 s default is a mis-set gate under full-suite load
// (same SLOW_SHELL_MS convention as create-worktree.test.ts).
const SLOW_SHELL_MS = 30_000;

interface Result {
  stdout: string;
  stderr: string;
  status: number;
}

/** W-R1 oracle (affected review 2026-10-21): the printed path must be the FULL requested
 *  destination — join(<--out dir>, <snapshot name>) — never a same-basename file in some
 *  other directory. POSIX keeps the byte-exact equality of the original assertion; win32
 *  normalizes only the spelling (MSYS dialect, separators, drive-letter case, 8.3 forms)
 *  of the SAME full path, so a wrong directory still fails on every platform. */
function sameDestination(printed: string, dir: string, name: string): boolean {
  const expected = join(dir, name);
  if (process.platform !== 'win32') return printed === expected;
  const norm = (p: string) => fromMsys(p).replace(/[\\/]/g, '/').toLowerCase();
  return norm(printed) === norm(expected);
}

let repo: string;
let out: string;

function git(...args: string[]): string {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
    },
  }).trim();
}

function commitFile(path: string, content: string, message: string): string {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), content);
  git('add', path);
  git('commit', '-q', '-m', message);
  return git('rev-parse', 'HEAD');
}

function run(ctx: Skippable, args: string[]): Result {
  // POSIX: byte-identical spawnSync pass-through; win32: Git Bash or named skip (#1799).
  // The old execFileSync try/catch mapped throw-on-non-zero to {status: err.status ?? -1};
  // spawnSync's result object carries the same stdout/stderr/status without the throw.
  const r = spawnBashOrSkip(ctx, 'bash', [SCRIPT, ...args], {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status ?? -1 };
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'seat-snap-repo-'));
  out = mkdtempSync(join(tmpdir(), 'seat-snap-out-'));
  git('init', '-q');
});

afterEach(() => {
  // Snapshots are written read-only; rmSync with force removes them regardless.
  rmSync(repo, { recursive: true, force: true });
  rmSync(out, { recursive: true, force: true });
});

describe('snapshot-for-seat.sh', () => {
  it(
    'snapshots the bytes AT the commit — a later commit and a dirty working tree do not reach it',
    (ctx) => {
      const sha = commitFile('docs/spec.md', 'v1\n', 'one');
      commitFile('docs/spec.md', 'v2\n', 'two');
      writeFileSync(join(repo, 'docs/spec.md'), 'v3 uncommitted\n');

      const r = run(ctx, ['--out', out, sha, 'docs/spec.md']);
      expect(r.status).toBe(0);
      const lines = r.stdout.trim().split('\n');
      expect(lines[0]).toBe(`Inputs-ref: ${sha}`);
      expect(sameDestination(lines[1], out, `docs__spec@${sha.slice(0, 12)}.md`)).toBe(
        true,
      );
      expect(readFileSync(fromMsys(lines[1]), 'utf8')).toBe('v1\n');
    },
    SLOW_SHELL_MS,
  );

  it(
    'W-R1 control: the --out oracle is directory-sensitive — a same-basename snapshot in the wrong directory fails it',
    (ctx) => {
      // The W-R1 regression shape (affected review 2026-10-21): the SUT ignores --out,
      // writes the correct basename and the correct bytes somewhere ELSE, and prints that
      // path. Two real runs into two different --out dirs produce exactly that pairing —
      // identical basenames, identical v1 bytes, different directories — and the oracle
      // must accept each print only for ITS requested directory and reject the swap.
      const sha = commitFile('docs/spec.md', 'v1\n', 'one');
      const other = mkdtempSync(join(tmpdir(), 'seat-snap-out2-'));
      try {
        const name = `docs__spec@${sha.slice(0, 12)}.md`;
        const a = run(ctx, ['--out', out, sha, 'docs/spec.md']);
        const b = run(ctx, ['--out', other, sha, 'docs/spec.md']);
        expect(a.status).toBe(0);
        expect(b.status).toBe(0);
        const printedA = a.stdout.trim().split('\n')[1];
        const printedB = b.stdout.trim().split('\n')[1];
        // same basename, same bytes — the only difference is the directory:
        expect(printedA).not.toBe(printedB);
        expect(readFileSync(fromMsys(printedA), 'utf8')).toBe('v1\n');
        expect(readFileSync(fromMsys(printedB), 'utf8')).toBe('v1\n');
        // the oracle passes for each requested destination…
        expect(sameDestination(printedA, out, name)).toBe(true);
        expect(sameDestination(printedB, other, name)).toBe(true);
        // …and FAILS on the wrong-directory/same-basename twin (the W-R1 hole, closed):
        expect(sameDestination(printedA, other, name)).toBe(false);
        expect(sameDestination(printedB, out, name)).toBe(false);
      } finally {
        rmSync(other, { recursive: true, force: true });
      }
    },
    SLOW_SHELL_MS,
  );

  it(
    'resolves a moving ref to its SHA — the file name and Inputs-ref carry the SHA, never the ref name',
    (ctx) => {
      const sha = commitFile('a.txt', 'x\n', 'one');
      git('branch', '-M', 'staging');

      const r = run(ctx, ['--out', out, 'staging', 'a.txt']);
      expect(r.status).toBe(0);
      expect(r.stdout.split('\n')[0]).toBe(`Inputs-ref: ${sha}`);
      expect(readdirSync(out)).toEqual([`a@${sha.slice(0, 12)}.txt`]);
    },
    SLOW_SHELL_MS,
  );

  it(
    'writes snapshots read-only and keeps two same-named files apart',
    (ctx) => {
      commitFile('x/README.md', 'x\n', 'one');
      const sha = commitFile('y/README.md', 'y\n', 'two');

      const r = run(ctx, ['--out', out, sha, 'x/README.md', 'y/README.md']);
      expect(r.status).toBe(0);
      const paths = r.stdout.trim().split('\n').slice(1).map(fromMsys);
      expect(paths).toHaveLength(2);
      expect(readFileSync(paths[0], 'utf8')).toBe('x\n');
      expect(readFileSync(paths[1], 'utf8')).toBe('y\n');
      for (const p of paths) expect(statSync(p).mode & 0o222).toBe(0);
    },
    SLOW_SHELL_MS,
  );

  it(
    'keeps an extensionless name whole, strips a leading ./, and re-running is idempotent',
    (ctx) => {
      const sha = commitFile('Makefile', 'all:\n', 'one');
      expect(run(ctx, ['--out', out, sha, './Makefile']).status).toBe(0);
      const again = run(ctx, ['--out', out, sha, 'Makefile']);
      expect(again.status).toBe(0);
      expect(readdirSync(out)).toEqual([`Makefile@${sha.slice(0, 12)}`]);
    },
    SLOW_SHELL_MS,
  );

  it(
    'a path absent at the commit fails the whole call and writes nothing',
    (ctx) => {
      const sha = commitFile('a.txt', 'x\n', 'one');
      commitFile('b.txt', 'late\n', 'two');

      const r = run(ctx, ['--out', out, sha, 'a.txt', 'b.txt']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('b.txt');
      expect(readdirSync(out)).toEqual([]);
    },
    SLOW_SHELL_MS,
  );

  it(
    'refuses a directory, a symlink and a submodule entry before writing anything',
    (ctx) => {
      commitFile('docs/a.md', 'a\n', 'one');
      // the committed-file link IS the assertion subject: junctions cannot express a
      // file link → named win32 skip (POSIX unchanged)
      symlinkOrJunctionOrSkip(ctx, 'docs/a.md', join(repo, 'link.md'));
      git('add', 'link.md');
      const sub = git('rev-parse', 'HEAD');
      git('update-index', '--add', '--cacheinfo', `160000,${sub},vendor/sub`);
      git('commit', '-q', '-m', 'two');
      const sha = git('rev-parse', 'HEAD');

      for (const [path, word] of [
        ['docs', 'directory'],
        ['docs/', 'not a file path'],
        ['link.md', 'symlink'],
        ['vendor/sub', 'submodule'],
      ]) {
        const r = run(ctx, ['--out', out, sha, 'docs/a.md', path]);
        expect(r.status, path).toBe(1);
        expect(r.stderr, path).toContain(word);
        expect(r.stdout, path).toBe('');
      }
      expect(readdirSync(out)).toEqual([]);
    },
    SLOW_SHELL_MS,
  );

  it(
    'refuses two different paths that flatten to one snapshot name; one path given twice is fine',
    (ctx) => {
      commitFile('a/b__c.md', '1\n', 'one');
      const sha = commitFile('a__b/c.md', '2\n', 'two');

      const clash = run(ctx, ['--out', out, sha, 'a/b__c.md', 'a__b/c.md']);
      expect(clash.status).toBe(1);
      expect(clash.stderr).toContain('both map to');
      expect(readdirSync(out)).toEqual([]);

      expect(run(ctx, ['--out', out, sha, 'a/b__c.md', './a/b__c.md']).status).toBe(0);
    },
    SLOW_SHELL_MS,
  );

  it(
    'refuses case-variant paths (one file on a case-insensitive FS), an empty path and a trailing slash',
    (ctx) => {
      commitFile('docs/X.md', 'upper\n', 'one');
      let sha = git('rev-parse', 'HEAD');
      // Add the lower-case twin through the index so the test works on APFS too.
      const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], {
        cwd: repo,
        input: 'lower\n',
        encoding: 'utf8',
      }).trim();
      git('update-index', '--add', '--cacheinfo', `100644,${blob},docs/x.md`);
      git('commit', '-q', '-m', 'two');
      sha = git('rev-parse', 'HEAD');

      const clash = run(ctx, ['--out', out, sha, 'docs/X.md', 'docs/x.md']);
      expect(clash.status).toBe(1);
      expect(clash.stderr).toContain('both map to');

      for (const path of ['', 'docs/']) {
        const r = run(ctx, ['--out', out, sha, path]);
        expect(r.status, JSON.stringify(path)).toBe(1);
        expect(r.stderr, JSON.stringify(path)).toContain('not a file path');
      }
      expect(readdirSync(out)).toEqual([]);
    },
    SLOW_SHELL_MS,
  );

  it(
    'handles spaces, non-ASCII and a leading-dot name',
    (ctx) => {
      commitFile('my docs/spec v2.md', 's\n', 'one');
      commitFile('specs/черновик.md', 'r\n', 'two');
      const sha = commitFile('.gitignore', 'node_modules\n', 'three');

      const r = run(ctx, ['--out', out, sha, 'my docs/spec v2.md', 'specs/черновик.md', '.gitignore']);
      expect(r.status, r.stderr).toBe(0);
      const short = sha.slice(0, 12);
      expect(readdirSync(out).sort()).toEqual(
        [`.gitignore@${short}`, `my docs__spec v2@${short}.md`, `specs__черновик@${short}.md`].sort(),
      );
      expect(readFileSync(join(out, `.gitignore@${short}`), 'utf8')).toBe('node_modules\n');
    },
    SLOW_SHELL_MS,
  );

  it(
    'an unresolvable ref fails with exit 1',
    (ctx) => {
      commitFile('a.txt', 'x\n', 'one');
      const r = run(ctx, ['--out', out, 'no-such-ref', 'a.txt']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('no-such-ref');
    },
    SLOW_SHELL_MS,
  );

  it(
    'usage errors exit 2: no args, a ref without paths, --out without a value',
    (ctx) => {
      commitFile('a.txt', 'x\n', 'one');
      expect(run(ctx, []).status).toBe(2);
      expect(run(ctx, ['HEAD']).status).toBe(2);
      expect(run(ctx, ['--out']).status).toBe(2);
    },
    SLOW_SHELL_MS,
  );

  it(
    'without --out it creates a fresh temp directory and still names every file by SHA',
    (ctx) => {
      const sha = commitFile('a.txt', 'x\n', 'one');
      const r = run(ctx, [sha, 'a.txt']);
      expect(r.status).toBe(0);
      const printed = r.stdout.trim().split('\n')[1];
      expect(printed.endsWith(`/a@${sha.slice(0, 12)}.txt`)).toBe(true);
      const p = fromMsys(printed);
      expect(existsSync(p)).toBe(true);
      rmSync(dirname(p), { recursive: true, force: true });
    },
    SLOW_SHELL_MS,
  );
});
