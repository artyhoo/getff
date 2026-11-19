import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
  cpSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
const helper = resolve('.agents/procedures/pipeline/helpers/overview.mjs');
const isolatedEnv = (inherited) =>
  Object.fromEntries(
    Object.entries(inherited).filter(
      ([key]) => !/^(GIT_|MO_|REPO_ROOT$|GETFF_PROJECT_ROOT$)/.test(key),
    ),
  );
test('overview accepts completed candidates through stdin and honors the bound bridge URL', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'overview stdin space '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  const home = join(root, '.ai-factory/orchestrator-prompts');
  mkdirSync(home, { recursive: true });
  const log = join(root, 'curl-argv.txt');
  writeFileSync(
    join(bin, 'curl'),
    '#!/bin/bash\nprintf "%s\\n" "$@" > "$OVERVIEW_TEST_LOG"\nprintf "[]\\n"\n',
    { mode: 0o755 },
  );
  writeFileSync(join(bin, 'gh'), '#!/bin/bash\nprintf "[]\\n"\n', {
    mode: 0o755,
  });
  spawnSync('git', ['init', '-q'], {
    cwd: root,
    env: isolatedEnv(process.env),
  });
  const r = spawnSync(
    process.execPath,
    [helper, root, '-', '--json', '--bridge-url', 'http://127.0.0.1:9'],
    {
      cwd: root,
      encoding: 'utf8',
      input: '=== priority-score.sh: END rc=0 (lines=0) ===\n',
      env: {
        ...isolatedEnv(process.env),
        PATH: bin + ':' + process.env.PATH,
        REPO_ROOT: root,
        MO_ORCH_HOME: home,
        OVERVIEW_TEST_LOG: log,
      },
      timeout: 20000,
    },
  );
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotThrow(() => JSON.parse(r.stdout));
  const argv = readFileSync(log, 'utf8');
  assert.match(argv, /http:\/\/127\.0\.0\.1:9\/projects/);
  assert.doesNotMatch(argv, /localhost:3009/);
});

// These CLI fixtures catch global task-list leakage and loss of branch-only ownership.
for (const mode of [
  'owned',
  'missing',
  'ambiguous',
  'foreign-detail',
  'malformed',
  'saturated',
  'foreign-list',
  'detail-unavailable',
  'empty',
  'invalid-status',
  'invalid-id',
  'oversized',
  'cumulative-bytes',
]) {
  test(`factory collection isolates the bound project: ${mode}`, (t) => {
    const root = mkdtempSync(join(tmpdir(), 'overview bound space '));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const bin = join(root, 'bin');
    mkdirSync(bin);
    const home = join(root, '.ai-factory/orchestrator-prompts');
    mkdirSync(join(home, 'alpha'), { recursive: true });
    writeFileSync(join(home, 'alpha/kickoff.md'), '# Alpha work\n');
    const log = join(root, 'requests.jsonl');
    const owned = '11111111-1111-1111-1111-111111111111',
      foreign = '22222222-2222-2222-2222-222222222222';
    const task = '33333333-3333-3333-3333-333333333333';
    writeFileSync(
      join(bin, 'curl'),
      `#!/usr/bin/env node
const fs=require('fs'), args=process.argv.slice(2), url=args.at(-1);
fs.appendFileSync(process.env.OVERVIEW_TEST_LOG, JSON.stringify(args)+'\\n');
const mode=process.env.OVERVIEW_TEST_MODE, root=process.env.REPO_ROOT;
const owned='${owned}', foreign='${foreign}', id='${task}';
let result;
if(mode==='oversized' && url.endsWith('/projects')) { console.log(JSON.stringify([{id:owned,rootPath:root,description:'x'.repeat(3*1024*1024)}])); process.exit(0); }
if(mode==='detail-unavailable' && url.includes('/tasks/')) process.exit(22);
if(url.endsWith('/projects')) result=mode==='malformed'?{}:mode==='missing'?[{id:foreign,rootPath:'/container/alpha'}]:mode==='ambiguous'?[{id:owned,rootPath:root},{id:foreign,rootPath:root}]:[{id:owned,rootPath:root},{id:foreign,rootPath:'/foreign/alpha'}];
else if(url.endsWith('/tasks?projectId='+owned)) result=Array.from({length:mode==='saturated'?21:mode==='empty'?0:1},()=>({id,projectId:mode==='foreign-list'?foreign:owned,title:'unrelated title',status:'implementing'}));
else if(url.endsWith('/tasks/'+id)) result={id:mode==='invalid-id'?'wrong':id,projectId:mode==='foreign-detail'?foreign:owned,title:'unrelated title',status:mode==='invalid-status'?'not-a-status':'implementing',branchName:'feature/alpha-s1-aabbcc',worktreePath:'/container/alpha'};
else result=[{id,projectId:foreign,title:'alpha',status:'implementing'}];
if(mode==='cumulative-bytes') { if(url.endsWith('/projects')) result[0].description='x'.repeat(1200000); else if(url.includes('/tasks?')) result[0].description='x'.repeat(1200000); }
console.log(JSON.stringify(result));
`,
      { mode: 0o755 },
    );
    writeFileSync(join(bin, 'gh'), '#!/bin/bash\nprintf "[]\\n"\n', {
      mode: 0o755,
    });
    const foreignGit = join(root, 'foreign Git sentinel');
    mkdirSync(foreignGit);
    const sentinel = join(foreignGit, 'sentinel');
    writeFileSync(sentinel, 'preserve foreign checkout\n');
    const env = isolatedEnv({
      ...process.env,
      GIT_DIR: join(foreignGit, '.git'),
      GIT_WORK_TREE: foreignGit,
    });
    const init = spawnSync('git', ['init', '-q'], { cwd: root, env });
    assert.equal(init.status, 0, init.stderr?.toString());
    const r = spawnSync(
      process.execPath,
      [helper, root, '-', '--json', '--bridge-url', 'http://fixture.invalid'],
      {
        cwd: root,
        encoding: 'utf8',
        input:
          'alpha kickoff=exists volume=S\n=== priority-score.sh: END rc=0 (lines=1) ===\n',
        env: {
          ...env,
          PATH: bin + ':' + process.env.PATH,
          REPO_ROOT: root,
          MO_ORCH_HOME: home,
          OVERVIEW_TEST_LOG: log,
          OVERVIEW_TEST_MODE: mode,
        },
        timeout: 20000,
      },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readFileSync(sentinel, 'utf8'), 'preserve foreign checkout\n');
    assert.equal(
      existsSync(join(foreignGit, '.git')),
      false,
      'poisoned inherited Git target must stay untouched',
    );
    assert.equal(existsSync(join(root, '.git')), true);
    const result = JSON.parse(r.stdout),
      requests = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(
      result.work[0].planPath,
      '',
      'missing plan must not become a readable link',
    );
    assert.equal(
      requests.some((a) => a.at(-1) === 'http://fixture.invalid/tasks'),
      false,
      'global tasks must never be requested',
    );
    if (mode === 'owned') {
      assert.equal(
        result.work[0].availability,
        'IN-FLIGHT',
        'branch-only task must be retained',
      );
      assert.ok(
        requests.some(
          (a) => a.at(-1) === 'http://fixture.invalid/tasks?projectId=' + owned,
        ),
      );
    } else if (mode === 'empty') {
      assert.equal(result.work[0].availability, 'UNVERIFIED');
      assert.doesNotMatch(
        result.diagnostics.join(' '),
        /Factory ownership UNKNOWN/,
      );
    } else {
      assert.equal(result.work[0].availability, 'UNVERIFIED');
      assert.match(result.diagnostics.join(' '), /UNKNOWN/);
      if (['missing', 'ambiguous', 'malformed'].includes(mode))
        assert.equal(requests.length, 1);
    }
  });
}

test('installed overview executes through a logical temp path alias', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'overview alias space '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = join(root, '.ai-factory/orchestrator-prompts');
  mkdirSync(home, { recursive: true });
  const helpers = join(root, 'installed helpers');
  cpSync(dirname(helper), helpers, { recursive: true, dereference: true });
  const alias = join(root, 'logical helper alias');
  symlinkSync(helpers, alias, 'dir');
  const bin = join(root, 'bin');
  mkdirSync(bin);
  for (const command of ['curl', 'gh'])
    writeFileSync(join(bin, command), '#!/bin/bash\nprintf "[]\\n"\n', {
      mode: 0o755,
    });
  const r = spawnSync(
    process.execPath,
    [join(alias, 'overview.mjs'), root, '-', '--json'],
    {
      cwd: root,
      encoding: 'utf8',
      input: '=== priority-score.sh: END rc=0 (lines=0) ===\n',
      env: {
        ...isolatedEnv(process.env),
        PATH: bin + ':' + process.env.PATH,
        REPO_ROOT: root,
        MO_ORCH_HOME: home,
      },
      timeout: 20000,
    },
  );
  assert.equal(r.status, 0, r.stderr);
  assert.ok(
    r.stdout.trim(),
    'entry must execute through logical/physical alias',
  );
  assert.equal(JSON.parse(r.stdout).work.length, 0);
});
