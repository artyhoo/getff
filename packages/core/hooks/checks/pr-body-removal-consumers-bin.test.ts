/**
 * End-to-end tests for pr-body-removal-consumers-bin.ts against a throwaway git repo.
 * The fail-closed decisions live in the bin, not the pure module: `--no-renames`
 * (a rename must reach the check as a deletion), `core.quotePath=false` (a quoted
 * non-ASCII path must not slip past the root prefix), and the merge-base / env exits.
 * Fixture shape and tsx resolution follow pr-stale-revert-bin.test.ts.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const BIN = fileURLToPath(new URL('./pr-body-removal-consumers-bin.ts', import.meta.url));

function resolveTsx(): string {
  for (const rel of ['../../node_modules/.bin/tsx', '../../../../node_modules/.bin/tsx']) {
    const p = fileURLToPath(new URL(rel, import.meta.url));
    if (existsSync(p)) return p;
  }
  return '';
}
const TSX = resolveTsx();

const ARCH = 'packages/core/templates/shared/ARCHITECTURE.react-next.md';
const UNICODE = 'packages/core/templates/shared/шаблон.md';
let repo = '';
let BASE = '';
let RENAME = '';
let UNI = '';
let CLEAN = '';

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function commit(message: string): string {
  git('add', '-A');
  git('-c', 'user.email=t@example.com', '-c', 'user.name=T', 'commit', '-q', '--no-verify', '-m', message);
  return git('rev-parse', 'HEAD').trim();
}
function write(path: string, content: string): void {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), content);
}

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'removal-consumers-'));
  git('init', '-q', '-b', 'staging');
  write(ARCH, '# Architecture\n\nstack: react-next\n');
  write(UNICODE, 'template\n');
  write('install.sh', '[ -f "$ROOT/.ai-factory/ARCHITECTURE.react-next.md" ] && echo react\n');
  BASE = commit('base');
  git('checkout', '-q', '-b', 'rename', BASE);
  git('mv', ARCH, 'packages/core/templates/shared/ARCHITECTURE.md');
  RENAME = commit('rename the passport template away');
  git('checkout', '-q', '-b', 'unicode', BASE);
  git('rm', '-q', UNICODE);
  UNI = commit('delete a non-ASCII template');
  git('checkout', '-q', '-b', 'clean', BASE);
  write('install.sh', 'echo changed\n');
  CLEAN = commit('ordinary change');
});

afterAll(() => {
  if (repo) rmSync(repo, { recursive: true, force: true });
});

function run(env: Record<string, string | undefined>) {
  try {
    const stdout = execFileSync(TSX, [BIN], {
      cwd: repo,
      env: { ...process.env, BASE_SHA: undefined, HEAD_SHA: undefined, PR_BODY: undefined, ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

describe('pr-body-removal-consumers-bin exit codes (real git)', () => {
  it('resolves a tsx binary to spawn (fails loudly rather than skipping)', () => {
    expect(TSX, 'tsx not found in packages/core/node_modules nor at the repo root').not.toBe('');
  });

  it('NEGATIVE — a rename away from a shipped template, body without the section: exit 1', () => {
    const r = run({ BASE_SHA: BASE, HEAD_SHA: RENAME, PR_BODY: '## Summary\n\nrename' });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain(ARCH);
  });

  it('POSITIVE — the same rename with a consumer row for the old path: exit 0', () => {
    const body = `## Removal consumers\n\n| ${ARCH} | \`install.sh:1\` presence check | drop: stack detection breaks |\n`;
    expect(run({ BASE_SHA: BASE, HEAD_SHA: RENAME, PR_BODY: body }).code).toBe(0);
  });

  it('NEGATIVE — a deleted non-ASCII template is still seen (no quoted path): exit 1', () => {
    const r = run({ BASE_SHA: BASE, HEAD_SHA: UNI, PR_BODY: '## Summary' });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain(UNICODE);
  });

  it('POSITIVE — no shipped deletion: exit 0 with no section', () => {
    expect(run({ BASE_SHA: BASE, HEAD_SHA: CLEAN, PR_BODY: '' }).code).toBe(0);
  });

  it('NEGATIVE — an unresolvable BASE_SHA fails closed: exit 1', () => {
    const r = run({ BASE_SHA: 'f'.repeat(40), HEAD_SHA: CLEAN, PR_BODY: '' });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('merge-base');
  });

  it('NEGATIVE — missing env fails closed: exit 1', () => {
    expect(run({ PR_BODY: '' }).code).toBe(1);
  });
});
