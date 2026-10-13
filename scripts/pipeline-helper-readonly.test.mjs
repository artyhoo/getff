import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const helpers = resolve(process.env.PIPELINE_TEST_HELPERS || '.agents/procedures/pipeline/helpers');
const root = mkdtempSync(join(tmpdir(), 'pipeline readonly with spaces '));
const nested = join(root, 'nested directory');
mkdirSync(nested);
const orch = join(root, '.ai-factory/orchestrator-prompts');
mkdirSync(join(orch, 'valid-export'), { recursive: true });
writeFileSync(join(orch, 'valid-export/kickoff.md'), '# Export\n## §2 Sub-wave decomposition\n| Sub-wave | Work | Depends on |\n|---|---|---|\n| A | prior-art survey | none |\n| B | src/export.ts tests/export.test.ts | A |\n');
mkdirSync(join(orch, 'empty-table'));
writeFileSync(join(orch, 'empty-table/kickoff.md'), '# Empty\n## §2 Sub-wave decomposition\nNo rows available.\n');
const plan = join(orch, 'plan.md');
writeFileSync(plan, '# Plan\nvalid-export is open\n');
const priority = join(root, 'priority input.txt');
writeFileSync(priority, 'valid-export type=R-phase kickoff=exists\n');
const delta = join(root, 'delta input.json');
writeFileSync(delta, JSON.stringify({ untracked_seen: [{ id: 'old' }, { id: 'kept' }] }));
const empty = join(root, 'empty.md');
writeFileSync(empty, ' \n\t');
const large = join(root, 'large research.md');
writeFileSync(large, 'R-phase survey\n' + 'work detail '.repeat(20000));
const ghEmpty = join(root, 'gh-empty');
writeFileSync(ghEmpty, '#!/bin/bash\nprintf "[]\\n"\n', { mode: 0o755 });
const ghMalformed = join(root, 'gh-invalid');
writeFileSync(ghMalformed, '#!/bin/bash\nprintf "not-json\\n"\n', { mode: 0o755 });
const git = (...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
assert.equal(git('init', '-q').status, 0);
assert.equal(git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', '-c', 'core.hooksPath=/dev/null', 'commit', '--allow-empty', '-qm', 'fixture').status, 0);
const env = { ...process.env, REPO_ROOT: root, MO_ORCH_HOME: orch, MO_WAVE_PLAN: plan, MO_MEM_DIR: root, MO_PATCHES_DIR: root, MO_PACKAGES_DIR: root, MO_OPEN_QUESTIONS: empty, MO_GH_BIN: ghEmpty, MO_BASE_REF: 'HEAD' };
const readonly = process.platform === 'darwin';
function run(name, args = [], extra = {}, input) {
  const argv = ['/bin/bash', join(helpers, name), ...args];
  return spawnSync(readonly ? '/usr/bin/sandbox-exec' : argv.shift(), readonly ? ['-p', '(version 1)(allow default)(deny file-write*)(allow file-write* (literal "/dev/null"))', ...argv] : argv, { cwd: nested, env: { ...env, ...extra }, input, encoding: 'utf8' });
}
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
test('actual Git clear requires successful PR, branch and worktree checks under deny-writes', () => {
  const r = run('inflight-check.sh', ['unrelated-candidate']);
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /CLEAR:/); assert.doesNotMatch(r.stderr, /temporary|denied/);
});
test('live worktree signal preserves actual path containing spaces', () => {
  const r = run('inflight-check.sh', ['readonly']);
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /INFLIGHT: readonly/); assert.match(r.stdout, /live worktree .*pipeline readonly with spaces /); assert.doesNotMatch(r.stdout, /CLEAR:/);
});
test('unavailable GitHub or Git and malformed JSON never become CLEAR', () => {
  for (const extra of [{ MO_GH_BIN: '/usr/bin/false' }, { MO_GIT_BIN: '/usr/bin/false' }, { MO_GH_BIN: ghMalformed }]) {
    const r = run('inflight-check.sh', ['valid-export'], extra);
    assert.notEqual(r.status, 0); assert.match(r.stdout, /UNKNOWN:/); assert.doesNotMatch(r.stdout, /CLEAR:/);
  }
});
test('research/file and multi-surface/string classifications survive read-only Bash3', () => {
  let r = run('classify-work.sh', [join(orch, 'valid-export/kickoff.md')]);
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /TYPE: R-phase/);
  r = run('classify-work.sh', ['implement src/export.ts and tests/export.test.ts with assertions']);
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /TYPE: I-phase-large/);
  r = run('classify-work.sh', [large]); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /TYPE: R-phase/);
});
test('empty file/string and missing path cannot classify as fix', () => {
  for (const arg of [empty, '', join(root, 'absent.md')]) {
    const r = run('classify-work.sh', [arg]); assert.notEqual(r.status, 0); assert.doesNotMatch(r.stdout, /TYPE:/);
  }
});
test('explicit input path with spaces, stream and partial failure retain meaningful statuses', () => {
  let r = run('classify-each-candidate.sh', [], { MO_PRIORITY_INPUT: priority });
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /TYPE: R-phase/);
  r = run('classify-each-candidate.sh', ['--stdin'], {}, 'absent kickoff=exists\nvalid-export kickoff=exists\n');
  assert.equal(r.status, 1); assert.match(r.stderr, /MISSING-FILE:|UNKNOWN:/); assert.match(r.stdout, /TYPE: R-phase/);
  r = run('classify-each-candidate.sh', ['--stdin'], {}, '');
  assert.equal(r.status, 0); assert.match(r.stdout, /EMPTY:/);
  r = run('classify-each-candidate.sh', [], { MO_PRIORITY_INPUT: join(root, 'absent priority.txt') });
  assert.equal(r.status, 1); assert.match(r.stderr, /UNKNOWN:/);
});
test('closed default stdin acquires actual project candidates', () => {
  const r = run('classify-each-candidate.sh');
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /candidate: valid-export/); assert.match(r.stdout, /TYPE: R-phase/);
});
test('launch table reads real stages without temporary input; missing/zero rows reject', () => {
  let r = run('launch-table-generator.sh', ['valid-export']);
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /\| A \| \?/); assert.match(r.stdout, /\| B \| \?/);
  r = run('launch-table-generator.sh', ['absent']); assert.equal(r.status, 1);
  r = run('launch-table-generator.sh', ['empty-table']); assert.equal(r.status, 1); assert.match(r.stdout, /DEGRADE:/); assert.doesNotMatch(r.stdout, /table skeleton/);
});
test('delta set difference is read-only and corruption rejects without output', () => {
  let r = run('delta-diff.sh', [delta, 'kept', 'new']);
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout, 'NEW-SINCE-LAST: new\nRESOLVED-SINCE-LAST: old\n');
  r = run('delta-diff.sh', [join(root, 'absent.json'), '-special', 'space id']);
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /NEW-SINCE-LAST: -special/); assert.match(r.stdout, /NEW-SINCE-LAST: space id/);
  r = run('delta-diff.sh', [empty, 'new']); assert.equal(r.status, 1); assert.equal(r.stdout, '');
});

// Captured stage-index schema: actual getff-ai-site kickoff SHA e442cbae007091129ddbe44aa65c97c23e8cdd0de57e1541d46ac08f7311565f.
// Stage topology is fixture input, not current readiness or launch authority.
const stageIndex = `# Site
## §1 Stages
| Stage | Dispatch channel | Kickoff |
|---|---|---|
| **S0a — source-holes batch** (+ the D29 generator BUILD) | aif on GLM | [kickoff-s0a.md](kickoff-s0a.md) |
| **S0q — quality-layer build** (D50) | aif on GLM | [kickoff-s0q.md](kickoff-s0q.md) |
| **S0b — gold pages + rules** (D40, D41) | **a NEW clean Fable session, never an aif profile** | [kickoff-s0b.md](kickoff-s0b.md) |
| **S1 — conveyor, BUILD then RUN** | aif on GLM, two tasks (R23) | [kickoff-s1.md](kickoff-s1.md) |
| **S2 — landing cutover** | aif on GLM + operator hands | [kickoff-s2.md](kickoff-s2.md) |
## §2 Name inventory
| Name | Kind |
|---|---|
| F1b | repo skill |
`;
function runStageIndex(body) {
  const root = mkdtempSync(join(tmpdir(), 'pipeline stage index with spaces '));
  const orch = join(root, '.ai-factory/orchestrator-prompts');
  mkdirSync(join(orch, 'site'), { recursive: true });
  mkdirSync(join(root, 'nested cwd'));
  writeFileSync(join(orch, 'site/kickoff.md'), body);
  try {
    return spawnSync('/bin/bash', [join(helpers, 'launch-table-generator.sh'), 'site'], {
      cwd: join(root, 'nested cwd'), env: { ...process.env, REPO_ROOT: root, MO_ORCH_HOME: orch }, encoding: 'utf8',
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
}
test('linked descriptive stage-index rows yield exactly the declared topology from nested cwd', () => {
  const result = runStageIndex(stageIndex);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.deepEqual([...result.stdout.matchAll(/^  sub-wave: (.+)$/gm)].map((m) => m[1]), ['S0a', 'S0q', 'S0b', 'S1', 'S2']);
  assert.match(result.stdout, /\| S0a \| \? \| \? \|/);
  assert.doesNotMatch(result.stdout, /sub-wave: (Stage|Name|F1b)|DEGRADE:|launchable|review passed/);
});
test('unlinked or unrelated tables remain explicit DEGRADE without a skeleton', () => {
  for (const body of [stageIndex.replaceAll(/\]\([^)]*\)/g, ']'), stageIndex.replace('## §1 Stages', '## §1 Inventory')]) {
    const result = runStageIndex(body);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /DEGRADE:/);
    assert.doesNotMatch(result.stdout, /table skeleton|sub-wave:/);
  }
});
test('ordinary sub-wave sections retain their existing id and unknown-judgment contract', () => {
  const result = runStageIndex('# Ordinary\n## §2 Sub-wave order\n| Sub-wave | Work |\n|---|---|\n| A | read docs |\n| B | implement tests |\n');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual([...result.stdout.matchAll(/^  sub-wave: (.+)$/gm)].map((m) => m[1]), ['A', 'B']);
});

test('an unrelated linked table in the same Stages section resets the stage binding', () => {
  const body = stageIndex.replace('## §2 Name inventory', '| Artifact | Use | Source |\n|---|---|---|\n| FAKE — unrelated linked reference | background | [guide](guide.md) |\n## §2 Name inventory');
  const result = runStageIndex(body);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual([...result.stdout.matchAll(/^  sub-wave: (.+)$/gm)].map((m) => m[1]), ['S0a', 'S0q', 'S0b', 'S1', 'S2']);
});
