/** Execute both shipped workflow range steps against real local Git histories. */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { load } = createRequire(import.meta.url)('js-yaml') as { load: (source: string) => unknown };
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const LOADER = join(ROOT, 'node_modules/tsx/dist/loader.mjs');
const CASES = [
  ['pr-body-prior-art.yml', 'pr-body-prior-art-bin.ts'],
  ['pr-stale-revert.yml', 'pr-body-removal-consumers-bin.ts'],
] as const;
type Step = { id?: string; run?: string; env?: Record<string, string> };
let temp = '', seed = '', checkout = '', old = '', base = '', head = '', behind = '', capability = '', unrelated = '';
function git(cwd: string, ...args: string[]) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function put(path: string, body: string) {
  const dest = join(seed, path); mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, body);
}
function commit(message: string) {
  git(seed, 'add', '-A');
  git(seed, '-c', 'user.name=fixture', '-c', 'user.email=fixture@example.com', 'commit', '-qm', message);
  return git(seed, 'rev-parse', 'HEAD');
}
function steps(file: string): Step[] {
  const doc = load(readFileSync(join(ROOT, '.github/workflows', file), 'utf8')) as { jobs: Record<string, { steps: Step[] }> };
  return Object.values(doc.jobs).flatMap((job) => job.steps);
}
function resolveBase(file: string, bin: string, target = head, ref = 'staging') {
  const population = steps(file);
  const consumer = population.find((step) => step.run?.includes(bin))!;
  const resolver = population.find((step) => step.id === 'pr_range');
  // Replay the old workflow's actual event-base binding before a resolver exists.
  if (!resolver) return { status: 0, base: old, stderr: '' };
  const output = join(temp, 'step-output'); writeFileSync(output, '');
  const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', resolver.run!], {
    cwd: checkout, encoding: 'utf8',
    env: { ...process.env, BASE_REF: ref, HEAD_SHA: target, GITHUB_OUTPUT: output },
  });
  expect(consumer.env?.BASE_SHA).toBe('${{ steps.pr_range.outputs.base_sha }}');
  return { status: result.status, base: /^base_sha=(.+)$/m.exec(readFileSync(output, 'utf8'))?.[1] ?? '', stderr: result.stderr };
}
function runBin(bin: string, baseSha: string, target = head, body = 'A documentation fix.') {
  return spawnSync(process.execPath, ['--import', LOADER, join(ROOT, 'packages/core/hooks/checks', bin)], {
    cwd: checkout, encoding: 'utf8',
    env: { ...process.env, BASE_SHA: baseSha, HEAD_SHA: target, PR_BODY: body },
  });
}

beforeAll(() => {
  temp = mkdtempSync(join(tmpdir(), 'fresh-pr-base-')); seed = join(temp, 'seed'); mkdirSync(seed);
  git(seed, 'init', '-q', '-b', 'staging');
  put('README.md', 'Original documentation.\n');
  put('packages/core/templates/shared/retired.md', 'Old shipped template.\n');
  old = commit('old event base');
  git(seed, 'switch', '-qc', 'docs-pr'); put('README.md', 'Corrected documentation.\n'); behind = commit('docs fix');
  git(seed, 'switch', '-q', 'staging');
  put('packages/core/foreign/capability.ts', Array.from({ length: 90 }, (_, n) => `export const foreign${n} = ${n};`).join('\n'));
  rmSync(join(seed, 'packages/core/templates/shared/retired.md')); base = commit('foreign capability and removal');
  git(seed, 'switch', '-q', 'docs-pr');
  git(seed, '-c', 'user.name=fixture', '-c', 'user.email=fixture@example.com', 'merge', '-qm', 'merge staging forward', 'staging');
  head = git(seed, 'rev-parse', 'HEAD');
  put('packages/core/owned/capability.ts', Array.from({ length: 90 }, (_, n) => `export const owned${n} = ${n};`).join('\n'));
  capability = commit('genuine PR capability');
  git(seed, 'switch', '-q', '--orphan', 'unrelated');
  put('README.md', 'Unrelated history.\n'); unrelated = commit('unrelated history');
  git(seed, 'switch', '-q', 'docs-pr');
  git(temp, 'clone', '-q', '--bare', seed, join(temp, 'origin.git'));
  git(temp, 'clone', '-q', join(temp, 'origin.git'), join(temp, 'checkout')); checkout = join(temp, 'checkout');
  // Pin stale local origin/staging; the workflow must FETCH rather than trust checkout refs.
  git(checkout, 'update-ref', 'refs/remotes/origin/staging', old);
});
afterAll(() => rmSync(temp, { recursive: true, force: true }));

describe.each(CASES)('%s fresh squash-preview base', (workflow, bin) => {
  it('excludes foreign staging capability/removal after merge-forward', () => {
    const stale = runBin(bin, old); expect(stale.status).toBe(1);
    git(checkout, 'update-ref', 'refs/remotes/origin/staging', old);
    const resolved = resolveBase(workflow, bin);
    expect(resolved.status, resolved.stderr).toBe(0);
    expect(resolved.base).toBe(base);
    expect(runBin(bin, resolved.base).status).toBe(0);
  });
  it('uses merge-base, preserving a merely-behind docs PR', () => {
    const resolved = resolveBase(workflow, bin, behind);
    expect(resolved.status, resolved.stderr).toBe(0);
    expect(resolved.base).toBe(old);
    expect(runBin(bin, resolved.base, behind).status).toBe(0);
  });
  it('fails closed when the histories have no merge-base', () => {
    expect(resolveBase(workflow, bin, unrelated).status).not.toBe(0);
  });
  it.each([['missing-base', head], ['staging', 'f'.repeat(40)]])('fails closed for ref/head %s', (ref, target) => {
    expect(resolveBase(workflow, bin, target, ref).status).not.toBe(0);
  });
});
it('a genuine PR capability still requires a valid Prior-art trailer', () => {
  const resolved = resolveBase(CASES[0][0], CASES[0][1], capability);
  expect(resolved.status).toBe(0);
  expect(runBin(CASES[0][1], resolved.base, capability).status).toBe(1);
  expect(runBin(CASES[0][1], resolved.base, capability,
    'Prior-art: see PR #1094 (fixture rationale for retaining the real capability gate).').status).toBe(0);
});
it('stale-revert archaeology deliberately retains event-base identity', () => {
  const archaeology = steps(CASES[1][0]).find((step) => step.run?.includes('pr-stale-revert-bin.ts'))!;
  expect(archaeology.env?.BASE_SHA).toBe('${{ github.event.pull_request.base.sha }}');
});
