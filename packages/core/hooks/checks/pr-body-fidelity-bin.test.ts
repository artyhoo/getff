import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { load } from 'js-yaml';
import { runCheck } from '../utils/run-check.ts';

const BIN = fileURLToPath(new URL('./pr-body-fidelity-bin.ts', import.meta.url));
const ROOT = resolve(dirname(BIN), '../../../..');
const TSX = createRequire(import.meta.url).resolve('tsx/cli');
const skipped = '## Fidelity verdict\nFIDELITY: skipped — no stage substrate applies to this controlled fixture\n';
let dir: string, base: string, head: string, docsHead: string;
function git(...args: string[]): string {
  const r = runCheck('git', args, { cwd: dir, timeoutMs: 10000 });
  if (r.exitCode !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}
function commit(path: string, contents: string): string {
  mkdirSync(dirname(resolve(dir, path)), { recursive: true });
  writeFileSync(resolve(dir, path), contents);
  git('add', '.'); git('-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture');
  return git('rev-parse', 'HEAD');
}
function record(extra: Record<string, unknown> = {}) {
  return { version: 1, base, head, scope: ['README.md', 'tests/protection.test.ts'], reviewer: 'cold-fixture-seat',
    report: 'fixture-report:1', consumedBy: 'fixture-controller', basis: 'Fixed fixture contract; finite transport validation only.',
    history: { status: 'unavailable', reason: 'offline controlled fixture', ownerDecision: 'controller accepts bounded evidence' },
    findings: [], ...extra };
}
function block(value: unknown): string { return '## Test-Quality Review\n```protection-review\n' + JSON.stringify(value) + '\n```\n'; }
function run(body = skipped, env: Record<string, string | undefined> = {}) {
  return runCheck(process.execPath, [TSX, BIN], { cwd: dir, timeoutMs: 10000,
    env: { ...process.env, BASE_REF: 'staging', BASE_SHA: base, HEAD_SHA: head, PR_BODY: body, ...env } });
}
beforeAll(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'fidelity-range-'));
  git('init', '-q');
  base = commit('README.md', 'base\n');
  docsHead = commit('README.md', 'documentation\n');
  head = commit('tests/protection.test.ts', 'export const witness = true;\n');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// Each case has at most a few bounded local processes; 15s accommodates the 10s
// subprocess failure bound, without a shared sequence under Vitest's implicit 5s.
describe('actual fidelity CLI diff binding and consumed dispositions', () => {
  it('accepts unrelated docs without a review record', () => {
    expect(run(skipped, { HEAD_SHA: docsHead }).exitCode).toBe(0);
  }, 15000);
  it('requires a record even when author claims skipped/applicable=false', () => {
    const r = run(skipped + '\napplicable=false\n');
    expect(r.exitCode).toBe(1); expect(r.stderr).toContain('protection-review');
  }, 15000);
  it('accepts zero findings with scoped basis and consumed original report', () => {
    const result = run(skipped + block(record())); expect(result.exitCode, result.stderr).toBe(0);
  }, 15000);
  for (const [name, env, message] of [
    ['missing base ref', { BASE_REF: undefined }, 'BASE_REF'],
    ['missing head', { HEAD_SHA: undefined }, 'HEAD_SHA'],
    ['missing base sha', { BASE_SHA: undefined }, 'BASE_SHA'],
    ['unavailable Git base', { BASE_SHA: 'f'.repeat(40) }, 'Git'],
  ] as const) it(name, () => {
    const r = run(skipped, env); expect(r.exitCode).toBe(1); expect(r.stderr).toContain(message);
  }, 15000);
  it('preserves main promotion exemption', () => {
    expect(run('', { BASE_REF: 'main', BASE_SHA: undefined, HEAD_SHA: undefined }).exitCode).toBe(0);
  }, 15000);
  for (const [name, change, message] of [
    ['stale base', () => ({ base: docsHead }), 'base'],
    ['stale full head', () => ({ head: head.slice(0, 12) }), 'head'],
    ['wrong scope', () => ({ scope: ['README.md'] }), 'scope'],
    ['unconsumed', () => ({ consumedBy: '' }), 'consumedBy'],
    ['unresolved material', () => ({ findings: [{ id: 'M1', failureScenario: 'silent pass', class: 'oracle', disposition: 'unresolved', evidence: ['report:1'] }] }), 'unresolved'],
    ['unaccepted deferral', () => ({ findings: [{ id: 'M1', failureScenario: 'silent pass', class: 'oracle', disposition: 'owner-accepted-deferral', evidence: ['report:1'] }] }), 'ownerAcceptance'],
  ] as const) it(name, () => {
    const r = run(skipped + block(record(change()))); expect(r.exitCode).toBe(1); expect(r.stderr).toContain(message);
  }, 15000);
  for (const disposition of ['fixed', 'retained-with-evidence', 'owner-accepted-deferral']) it(`transports ${disposition} (schema only)`, () => {
    const finding = { id: 'M1', failureScenario: 'fixture failure', class: 'transport', disposition,
      evidence: ['controlled fixture only; not semantic repair evidence'], ownerAcceptance: 'fixture owner decision:1' };
    expect(run(skipped + block(record({ findings: [finding] }))).exitCode).toBe(0);
  }, 15000);
  it('rejects duplicate stable finding IDs', () => {
    const finding = { id: 'M1', failureScenario: 'fixture failure', class: 'oracle', disposition: 'fixed', evidence: ['fixture:1'] };
    expect(run(skipped + block(record({ findings: [finding, finding] }))).exitCode).toBe(1);
  }, 15000);
  it('rejects duplicate records and malformed JSON', () => {
    expect(run(skipped + block(record()) + block(record())).exitCode).toBe(1);
    expect(run(skipped + '```protection-review\n{\n```').exitCode).toBe(1);
  }, 25000);
  it('does not borrow commented or quoted code examples as an actual record', () => {
    expect(run(skipped + '<!--\n' + block(record()) + '-->').exitCode).toBe(1);
    expect(run(skipped + '````md\n' + block(record()) + '\n````').exitCode).toBe(1);
  }, 25000);
  for (const kind of ['deleted test', 'renamed test', 'runner', 'schedule', 'package scripts', 'unknown file']) it(`actual diff trigger: ${kind}`, () => {
    git('checkout', '-q', '-B', 'variant', head);
    if (kind === 'deleted test') git('rm', '-q', 'tests/protection.test.ts');
    else if (kind === 'renamed test') git('mv', 'tests/protection.test.ts', 'README-test.md');
    else {
      const path = ({ runner: 'scripts/run-ci.sh', schedule: '.github/workflows/ci.yml', 'package scripts': 'package.json', 'unknown file': 'unclassified.config' } as Record<string, string>)[kind];
      mkdirSync(dirname(resolve(dir, path)), { recursive: true }); writeFileSync(resolve(dir, path), kind === 'package scripts' ? '{"scripts":{"test":"node --test"}}' : kind);
      git('add', '.');
    }
    git('-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', kind);
    const result = run(skipped, { BASE_SHA: head, HEAD_SHA: git('rev-parse', 'HEAD') });
    expect(result.exitCode).toBe(1); expect(result.stderr).toContain('protection-review');
  }, 15000);
  it('still rejects a missing fidelity verdict with an otherwise valid record', () => {
    const r = run(block(record())); expect(r.exitCode).toBe(1); expect(r.stderr).toContain('Fidelity verdict');
  }, 15000);
});

describe('actual fidelity workflow transport', () => {
  const workflow = load(readFileSync(resolve(ROOT, '.github/workflows/pr-body-fidelity.yml'), 'utf8')) as { on: { pull_request: unknown }; jobs: Record<string, { steps: { id?: string; run?: string; with?: Record<string, unknown>; env?: Record<string, string> }[] }> };
  const steps = workflow.jobs['fidelity-verdict-in-pr-body'].steps;
  it('keeps edited/unfiltered events, full history, and actual base/head/body bindings', () => {
    expect(workflow.on.pull_request).toEqual({ types: ['opened', 'edited', 'synchronize', 'reopened'] });
    expect(steps[0].with!['fetch-depth']).toBe(0);
    const check = steps.find((s) => s.env?.PR_BODY);
    expect(check!.env).toEqual({ PR_BODY: '${{ github.event.pull_request.body }}', HEAD_SHA: '${{ github.event.pull_request.head.sha }}', BASE_REF: '${{ github.event.pull_request.base.ref }}', BASE_SHA: '${{ steps.pr_range.outputs.base_sha }}' });
  });
  it('executes the actual run block and propagates edited-body repair and failure', () => {
    const check = steps.find((s) => s.env?.PR_BODY);
    // Actual command remains intact; fixture npx forwards its requested TS file to
    // installed tsx while preserving the temporary Git cwd and literal PR body.
    const bin = resolve(dir, 'bin'); mkdirSync(bin, { recursive: true });
    writeFileSync(resolve(bin, 'npx'), `#!/bin/bash\n[[ "$#" == 4 && "$1" == --prefix && "$2" == packages/core && "$3" == tsx ]] || exit 97\nexec '${process.execPath}' '${TSX}' '${ROOT}/'"$4"\n`, { mode: 0o755 });
    const invoke = (body: string) => runCheck('bash', ['-e', '-o', 'pipefail', '-c', check!.run!], { cwd: dir, timeoutMs: 10000,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, BASE_REF: 'staging', BASE_SHA: base, HEAD_SHA: head, PR_BODY: body } });
    expect(invoke(skipped).exitCode).toBe(1);
    const result = invoke(skipped + block(record())); expect(result.exitCode, result.stderr).toBe(0);
  }, 25000);
  it('resolves a fresh named base through a local origin and fails on fetch errors', () => {
    const step = steps.find((s) => s.id === 'pr_range'); expect(step).toBeDefined();
    git('branch', '-f', 'staging', docsHead); git('remote', 'add', 'origin', dir);
    const output = resolve(dir, 'outputs');
    const invoke = (ref: string) => runCheck('bash', ['-e', '-o', 'pipefail', '-c', step!.run!], { cwd: dir, timeoutMs: 10000,
      env: { ...process.env, BASE_REF: ref, HEAD_SHA: head, GITHUB_OUTPUT: output } });
    expect(invoke('staging').exitCode).toBe(0);
    expect(readFileSync(output, 'utf8')).toBe(`base_sha=${docsHead}\n`);
    expect(invoke('nonexistent').exitCode).not.toBe(0);
  }, 25000);
});
