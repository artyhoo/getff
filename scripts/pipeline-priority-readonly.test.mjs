import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const helper = resolve('.agents/procedures/pipeline/helpers/priority-score.sh');
test('Bash 3 classifies real kickoff types with all filesystem writes denied', { skip:process.platform !== 'darwin' }, t => {
  const root = mkdtempSync(join(tmpdir(), 'priority readonly space '));
  t.after(() => rmSync(root, { recursive:true, force:true }));
  const home = join(root, 'prompts'); mkdirSync(home);
  for (const [name,type] of [['research','R-phase'],['build','I-phase'],['config','wiring']]) {
    mkdirSync(join(home,name));
    writeFileSync(join(home,name,'kickoff.md'), `# ${name}\n**Type:** ${type}\n`);
  }
  const gh = join(root,'gh');
  writeFileSync(gh, '#!/bin/bash\nprintf "[]\\n"\n', { mode:0o755 });
  const empty = join(root,'empty'); mkdirSync(empty);
  const r = spawnSync('/usr/bin/sandbox-exec', ['-p','(version 1)(allow default)(deny file-write*)(allow file-write* (literal "/dev/null"))','/bin/bash',helper], {
    cwd:root, encoding:'utf8', timeout:30000,
    env:{ ...process.env, REPO_ROOT:root, MO_ORCH_HOME:home, MO_GH_BIN:gh, MO_DUP_DETECT_BIN:'/usr/bin/true', MO_MEM_DIR:empty, MO_PACKAGES_DIR:empty, MO_PATCHES_DIR:empty, MO_WAVE_PLAN:join(root,'absent-plan'), MO_OPEN_QUESTIONS:join(root,'absent-questions') },
  });
  assert.equal(r.status,0,r.stderr);
  assert.doesNotMatch(r.stderr,/cannot create temp file|Operation not permitted/);
  for (const [name,type] of [['research','R-phase'],['build','I-phase'],['config','wiring']]) assert.match(r.stdout,new RegExp(`${name} type=${type}`));
});

test('empty orchestration home does not invent a literal-glob candidate', t => {
  const root = mkdtempSync(join(tmpdir(), 'priority empty space '));
  t.after(() => rmSync(root, { recursive:true, force:true }));
  const home = join(root, 'prompts'); mkdirSync(home);
  const empty = join(root,'empty'); mkdirSync(empty);
  const gh = join(root,'gh'); writeFileSync(gh, '#!/bin/bash\nprintf "[]\\n"\n', { mode:0o755 });
  const plan = join(root,'plan.md'); writeFileSync(plan,'unrelated plan row\n');
  const r = spawnSync('/bin/bash',[helper],{ cwd:root,encoding:'utf8',timeout:30000,
    env:{ ...process.env, REPO_ROOT:root, MO_ORCH_HOME:home, MO_GH_BIN:gh, MO_DUP_DETECT_BIN:'/usr/bin/true', MO_MEM_DIR:empty, MO_PACKAGES_DIR:empty, MO_PATCHES_DIR:empty, MO_WAVE_PLAN:plan, MO_OPEN_QUESTIONS:join(root,'absent') } });
  assert.equal(r.status,0,r.stderr);
  assert.doesNotMatch(r.stdout,/\* kickoff=missing|RECONSTRUCT-STUB: \*/);
});
