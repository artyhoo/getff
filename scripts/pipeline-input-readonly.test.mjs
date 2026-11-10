import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const helpers = resolve(process.env.PIPELINE_TEST_HELPERS || '.agents/procedures/pipeline/helpers');
const root = mkdtempSync(join(tmpdir(), 'pipeline input with spaces '));
const nested = join(root, 'nested directory'); mkdirSync(nested);
const orch = join(root, '.ai-factory/orchestrator-prompts');
for (const name of ['primary', 'fallback']) mkdirSync(join(orch, name), { recursive: true });
writeFileSync(join(orch, 'primary/kickoff.md'), '# Plan\n## §2 Sub-wave decomposition\n| Stage | Work |\n|---|---|\n| A | R-phase |\n| B | execution |\n');
writeFileSync(join(orch, 'fallback/kickoff.md'), '# Plan\n## Work\n| Stage | Work |\n|---|---|\n| A | R-phase |\n| B | execution |\n');
const bin = join(root, 'partial parser'); mkdirSync(bin);
writeFileSync(join(bin, 'awk'), '#!/bin/bash\nif [ "$#" -eq 2 ]; then printf "A\\n"; else printf "| A | R-phase |\\n"; fi\nexit 7\n', { mode: 0o755 });
let serial = 0;
function run(name, args = [], input, extra = {}) {
  const argv = ['/bin/bash', join(helpers, name), ...args];
  const readonly = process.platform === 'darwin';
  return spawnSync(readonly ? '/usr/bin/sandbox-exec' : argv.shift(), readonly ? ['-p', '(version 1)(allow default)(deny file-write*)(allow file-write* (literal "/dev/null"))', ...argv] : argv, { cwd: nested, env: { ...process.env, REPO_ROOT: root, MO_ORCH_HOME: orch, ...extra }, input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
}
function delta(body, current = ['new']) {
  const file = join(root, `delta ${++serial}.json`); writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body));
  return run('delta-diff.sh', [file, ...current]);
}
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
test('malformed nonempty captures, enum typos and duplicate kickoff fields reject', () => {
  for (const input of ['garbage', 'candidate kickoff=existz', 'candidate kickoff=exists-extra', 'candidate kickoff=missing kickoff=synthetic', '* kickoff=missing', 'candidate not-a-field kickoff=missing']) {
    const r = run('classify-each-candidate.sh', ['--stdin'], input);
    assert.equal(r.status, 1, r.stderr); assert.match(r.stderr, /UNKNOWN:.*malformed/); assert.doesNotMatch(r.stdout, /EMPTY:|TYPE:|SKIP:/);
  }
});
test('empty captures and known headers are EMPTY; supported missing is SKIP, diagnostics never candidates', () => {
  for (const input of ['', ' \n\t', '=== priority-score: candidate umbrellas ===\n']) {
    const r = run('classify-each-candidate.sh', ['--stdin'], input);
    assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /EMPTY:/);
  }
  const r = run('classify-each-candidate.sh', ['--stdin'], 'RECONSTRUCT-STUB: absent has plan row but kickoff=missing — author it\nabsent kickoff=missing\nwave-plan-N2 type=plan-followup kickoff=synthetic source=wave-plan\n');
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /SKIP: absent/); assert.match(r.stdout, /candidate: wave-plan-N2/); assert.match(r.stdout, /TYPE:/); assert.doesNotMatch(r.stdout, /candidate: RECONSTRUCT-STUB/);
});
test('complete primary/fallback tables succeed but nonzero partial parser output never emits normal table', () => {
  for (const name of ['primary', 'fallback']) {
    let r = run('launch-table-generator.sh', [name]);
    assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /\| A \| \?/); assert.match(r.stdout, /\| B \| \?/);
    r = run('launch-table-generator.sh', [name], undefined, { PATH: `${bin}:${process.env.PATH}` });
    assert.equal(r.status, 1, r.stderr); assert.match(r.stdout, /UNKNOWN:.*partial.*rc=7/); assert.doesNotMatch(r.stdout, /table skeleton|\| A \| \?/);
  }
});
test('wrong present delta container and invalid records reject with no set-diff output', () => {
  for (const body of [{ untracked_seen: 'broken' }, { untracked_seen: {} }, { untracked_seen: null }, { untracked_seen: 2 }, { untracked_seen: [null] }, { untracked_seen: ['id'] }, { untracked_seen: [{}] }, { untracked_seen: [{ id: 3 }] }, [], '{}\n{}']) {
    const r = delta(body); assert.equal(r.status, 1, r.stderr); assert.match(r.stderr, /delta corrupt/); assert.equal(r.stdout, '');
  }
});
test('missing file, absent key and valid empty array retain empty history; valid records retain history', () => {
  let r = run('delta-diff.sh', [join(root, 'absent.json'), 'new']);
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout, 'NEW-SINCE-LAST: new\n');
  for (const body of [{}, { last_check_ts: 'supplied metadata' }, { untracked_seen: [] }]) {
    r = delta(body); assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout, 'NEW-SINCE-LAST: new\n');
  }
  r = delta({ untracked_seen: [{ id: 'old' }, { id: 'kept', first_seen: 'metadata' }] }, ['kept', 'new']);
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout, 'NEW-SINCE-LAST: new\nRESOLVED-SINCE-LAST: old\n');
});
test('measured large prior delta travels through resource input, with every resolved id retained', () => {
  const ids = Array.from({ length: 6000 }, (_, i) => `entry-${String(i).padStart(5, '0')}-${'x'.repeat(80)}`);
  const body = { untracked_seen: ids.map((id) => ({ id })) };
  const bytes = Buffer.byteLength(JSON.stringify(body));
  const r = delta(body, []);
  assert.equal(r.status, 0, `${bytes} bytes: ${r.stderr}`);
  const lines = r.stdout.trim().split('\n'); assert.equal(lines.length, ids.length);
  assert.equal(lines[0], `RESOLVED-SINCE-LAST: ${ids[0]}`); assert.equal(lines.at(-1), `RESOLVED-SINCE-LAST: ${ids.at(-1)}`);
});
