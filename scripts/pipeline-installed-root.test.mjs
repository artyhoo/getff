import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const source = resolve(import.meta.dirname, '../.agents/procedures/pipeline/helpers');
test('installed pipeline inside enclosing Git owns its root, nested cwd and cache', t => {
  const outer = realpathSync(mkdtempSync(join(tmpdir(), 'pipeline outer git ')));
  t.after(() => rmSync(outer, { recursive:true, force:true }));
  const sentinel=join(outer,'operator cache sentinel.md'); writeFileSync(sentinel,'Operator-owned fixture sentinel; must remain unchanged.\n');
  const inherited={...process.env, MO_CACHE_FILE:sentinel, MO_ORCH_HOME:join(outer,'operator orchestration sentinel'), GIT_DIR:join(outer,'unrelated operator git sentinel')};
  const env=Object.fromEntries(Object.entries(inherited).filter(([key])=>!key.startsWith('MO_')&&!key.startsWith('GIT_')&&!['REPO_ROOT','GETFF_PROJECT_ROOT'].includes(key)));
  assert.equal(spawnSync('git', ['init','-q'], {cwd:outer,env}).status, 0);
  const project=join(outer,'installed project with spaces');
  const procedure=join(project,'.agents/procedures/pipeline');
  mkdirSync(procedure,{recursive:true}); cpSync(source,join(procedure,'helpers'),{recursive:true});
  writeFileSync(join(procedure,'SKILL.md'),'Actual installed procedure marker\n');
  const nested=join(project,'nested cwd with spaces'); mkdirSync(nested);
  const run=(name,args=[],cwd=nested,extra={})=>spawnSync('bash',[join(procedure,'helpers',name),...args],{cwd,env:{...env,...extra},encoding:'utf8'});
  for(const cwd of [project,nested]) {
    const r=run('print-orch-home.sh',[],cwd); assert.equal(r.status,0,r.stderr);
    assert.equal(r.stdout.trim(),join(project,'.ai-factory/orchestrator-prompts'));
  }
  const write=run('update-cache.sh',['supplied-umbrella','verified fixture outcome']); assert.equal(write.status,0,write.stderr);
  assert.equal(readFileSync(sentinel,'utf8'),'Operator-owned fixture sentinel; must remain unchanged.\n');
  assert.match(readFileSync(join(project,'.ai-factory/orchestrator-prompts/_plan-cache.md'),'utf8'),/supplied-umbrella/);
  assert.equal(existsSync(join(outer,'.ai-factory')),false);
  assert.equal(existsSync(inherited.MO_ORCH_HOME),false); assert.equal(existsSync(inherited.GIT_DIR),false);
  const bound=run('print-orch-home.sh',[],outer,{GETFF_PROJECT_ROOT:project}); assert.equal(bound.status,0,bound.stderr); assert.equal(bound.stdout.trim(),join(project,'.ai-factory/orchestrator-prompts'));
  const override=run('print-orch-home.sh',[],nested,{REPO_ROOT:outer,GETFF_PROJECT_ROOT:project}); assert.equal(override.stdout.trim(),join(outer,'.ai-factory/orchestrator-prompts'));
  const missing=run('print-orch-home.sh',[],nested,{GETFF_PROJECT_ROOT:outer}); assert.equal(missing.status,2); assert.match(missing.stderr,/bound installed procedure root missing/); assert.equal(missing.stdout,'');
});
