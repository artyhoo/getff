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
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

function run(args: string[]): Result {
  try {
    const stdout = execFileSync('bash', [SCRIPT, ...args], {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', status: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', status: err.status ?? -1 };
  }
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
    () => {
      const sha = commitFile('docs/spec.md', 'v1\n', 'one');
      commitFile('docs/spec.md', 'v2\n', 'two');
      writeFileSync(join(repo, 'docs/spec.md'), 'v3 uncommitted\n');

      const r = run(['--out', out, sha, 'docs/spec.md']);
      expect(r.status).toBe(0);
      const lines = r.stdout.trim().split('\n');
      expect(lines[0]).toBe(`Inputs-ref: ${sha}`);
      expect(lines[1]).toBe(join(out, `docs__spec@${sha.slice(0, 12)}.md`));
      expect(readFileSync(lines[1], 'utf8')).toBe('v1\n');
    },
    SLOW_SHELL_MS,
  );

  it(
    'resolves a moving ref to its SHA — the file name and Inputs-ref carry the SHA, never the ref name',
    () => {
      const sha = commitFile('a.txt', 'x\n', 'one');
      git('branch', '-M', 'staging');

      const r = run(['--out', out, 'staging', 'a.txt']);
      expect(r.status).toBe(0);
      expect(r.stdout.split('\n')[0]).toBe(`Inputs-ref: ${sha}`);
      expect(readdirSync(out)).toEqual([`a@${sha.slice(0, 12)}.txt`]);
    },
    SLOW_SHELL_MS,
  );

  it(
    'writes snapshots read-only and keeps two same-named files apart',
    () => {
      commitFile('x/README.md', 'x\n', 'one');
      const sha = commitFile('y/README.md', 'y\n', 'two');

      const r = run(['--out', out, sha, 'x/README.md', 'y/README.md']);
      expect(r.status).toBe(0);
      const paths = r.stdout.trim().split('\n').slice(1);
      expect(paths).toHaveLength(2);
      expect(readFileSync(paths[0], 'utf8')).toBe('x\n');
      expect(readFileSync(paths[1], 'utf8')).toBe('y\n');
      for (const p of paths) expect(statSync(p).mode & 0o222).toBe(0);
    },
    SLOW_SHELL_MS,
  );

  it(
    'keeps an extensionless name whole, strips a leading ./, and re-running is idempotent',
    () => {
      const sha = commitFile('Makefile', 'all:\n', 'one');
      expect(run(['--out', out, sha, './Makefile']).status).toBe(0);
      const again = run(['--out', out, sha, 'Makefile']);
      expect(again.status).toBe(0);
      expect(readdirSync(out)).toEqual([`Makefile@${sha.slice(0, 12)}`]);
    },
    SLOW_SHELL_MS,
  );

  it(
    'a path absent at the commit fails the whole call and writes nothing',
    () => {
      const sha = commitFile('a.txt', 'x\n', 'one');
      commitFile('b.txt', 'late\n', 'two');

      const r = run(['--out', out, sha, 'a.txt', 'b.txt']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('b.txt');
      expect(readdirSync(out)).toEqual([]);
    },
    SLOW_SHELL_MS,
  );

  it(
    'refuses a directory, a symlink and a submodule entry before writing anything',
    () => {
      commitFile('docs/a.md', 'a\n', 'one');
      symlinkSync('docs/a.md', join(repo, 'link.md'));
      git('add', 'link.md');
      const sub = git('rev-parse', 'HEAD');
      git('update-index', '--add', '--cacheinfo', `160000,${sub},vendor/sub`);
      git('commit', '-q', '-m', 'two');
      const sha = git('rev-parse', 'HEAD');

      for (const [path, word] of [
        ['docs', 'directory'],
        ['docs/', 'does not exist'],
        ['link.md', 'symlink'],
        ['vendor/sub', 'submodule'],
      ]) {
        const r = run(['--out', out, sha, 'docs/a.md', path]);
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
    () => {
      commitFile('a/b__c.md', '1\n', 'one');
      const sha = commitFile('a__b/c.md', '2\n', 'two');

      const clash = run(['--out', out, sha, 'a/b__c.md', 'a__b/c.md']);
      expect(clash.status).toBe(1);
      expect(clash.stderr).toContain('both map to');
      expect(readdirSync(out)).toEqual([]);

      expect(run(['--out', out, sha, 'a/b__c.md', './a/b__c.md']).status).toBe(0);
    },
    SLOW_SHELL_MS,
  );

  it(
    'handles spaces, non-ASCII and a leading-dot name',
    () => {
      commitFile('my docs/spec v2.md', 's\n', 'one');
      commitFile('specs/черновик.md', 'r\n', 'two');
      const sha = commitFile('.gitignore', 'node_modules\n', 'three');

      const r = run(['--out', out, sha, 'my docs/spec v2.md', 'specs/черновик.md', '.gitignore']);
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
    () => {
      commitFile('a.txt', 'x\n', 'one');
      const r = run(['--out', out, 'no-such-ref', 'a.txt']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('no-such-ref');
    },
    SLOW_SHELL_MS,
  );

  it(
    'usage errors exit 2: no args, a ref without paths, --out without a value',
    () => {
      commitFile('a.txt', 'x\n', 'one');
      expect(run([]).status).toBe(2);
      expect(run(['HEAD']).status).toBe(2);
      expect(run(['--out']).status).toBe(2);
    },
    SLOW_SHELL_MS,
  );

  it(
    'without --out it creates a fresh temp directory and still names every file by SHA',
    () => {
      const sha = commitFile('a.txt', 'x\n', 'one');
      const r = run([sha, 'a.txt']);
      expect(r.status).toBe(0);
      const p = r.stdout.trim().split('\n')[1];
      expect(p.endsWith(`/a@${sha.slice(0, 12)}.txt`)).toBe(true);
      expect(existsSync(p)).toBe(true);
      rmSync(dirname(p), { recursive: true, force: true });
    },
    SLOW_SHELL_MS,
  );
});
