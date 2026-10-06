import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runHook } from './codex-hook-adapter.mjs';
import { emitCodex } from './render-codex-contributor.mjs';
import { spawnSync } from 'node:child_process';

test('Codex bindings load one canonical procedure and helpers without copying its body', () => {
  const root = mkdtempSync(join(tmpdir(), 'canonical-native-'));
  try {
    mkdirSync(join(root, '.agents/procedures/example/helpers'), {recursive:true});
    mkdirSync(join(root, '.agents/roles'), {recursive:true});
    const procedure='---\nname: example\ndescription: Example workflow\ndisable-model-invocation: true\n---\n\nUNIQUE-AUTHORED-PROCEDURE\n';
    writeFileSync(join(root, '.agents/procedures/example/SKILL.md'), procedure);
    writeFileSync(join(root, '.agents/procedures/example/helpers/run.sh'), '#!/bin/bash\nexit 0\n');
    writeFileSync(join(root, '.agents/roles/reviewer.md'), '---\nname: reviewer\ndescription: Review code\ntools: Read\n---\n\nUNIQUE-ROLE-PROCEDURE\n');
    const ops=emitCodex({},root);
    const skill=ops.find(o=>o.path==='.agents/skills/example/SKILL.md');
    assert.ok(skill,'canonical procedures must be discovered');
    assert.match(skill.value,/\.agents\/procedures\/example\/SKILL\.md/);
    assert.match(skill.value,/in full|complete/);
    assert.ok(!skill.value.includes('UNIQUE-AUTHORED-PROCEDURE'));
    assert.equal(ops.find(o=>o.path==='.agents/skills/example/helpers').target,'../../procedures/example/helpers');
    assert.match(ops.find(o=>o.path==='.codex/agents/reviewer.toml').value,/\.agents\/roles\/reviewer\.md/);
    assert.equal(readFileSync(join(root,'.agents/procedures/example/SKILL.md'),'utf8'),procedure);
    writeFileSync(join(root,'.agents/procedures/example/SKILL.md'),procedure+'changed body\n');
    assert.equal(emitCodex({},root).find(o=>o.path===skill.path).value,skill.value,'source edits load immediately without expanded-copy regeneration');
  } finally {rmSync(root,{recursive:true,force:true});}
});

test('native check executes the canonical owner without a Claude compatibility tree', () => {
  const root=mkdtempSync(join(tmpdir(),'canonical-check-'));
  try {
    mkdirSync(join(root,'.agents/hooks'),{recursive:true});
    writeFileSync(join(root,'.agents/hooks/example.sh'),'#!/bin/bash\nprintf CANONICAL-CHECK\n');
    const result=runHook(root,'example',{hook_event_name:'SessionStart'});
    assert.equal(result.status,0,result.stderr);
    assert.equal(result.stdout,'CANONICAL-CHECK');
  } finally {rmSync(root,{recursive:true,force:true});}
});

test('Git carries exact native bindings while private runtime files stay ignored', () => {
  const root=mkdtempSync(join(tmpdir(),'canonical-native-git-'));
  try {
    writeFileSync(join(root,'.gitignore'),readFileSync(new URL('../.gitignore',import.meta.url)));
    assert.equal(spawnSync('git',['init','-q'],{cwd:root}).status,0);
    for(const path of ['.codex/config.toml','.codex/contributor-inventory.json','.codex/agents/reviewer.toml','.zcode/config.json','.zcode/skills','.agents/procedures/example/SKILL.md','.agents/skills/example/SKILL.md']) {
      assert.equal(spawnSync('git',['check-ignore',path],{cwd:root}).status,1,`${path} must travel through Git`);
    }
    for(const path of ['.codex/auth.json','.codex/session-state.json','.zcode/private.json']) {
      assert.equal(spawnSync('git',['check-ignore',path],{cwd:root}).status,0,`${path} must stay private`);
    }
  } finally {rmSync(root,{recursive:true,force:true});}
});

test('native role descriptions preserve folded and literal canonical YAML scalars', () => {
  const root = mkdtempSync(join(tmpdir(), 'canonical-role-metadata-'));
  try {
    mkdirSync(join(root, '.agents/roles'), { recursive: true });
    for (const [name, marker, expected] of [['folded', '>-', 'Review code carefully.'], ['literal', '|-', 'Review code\ncarefully.']]) {
      writeFileSync(join(root, `.agents/roles/${name}.md`), `---\nname: ${name}\ndescription: ${marker}\n  Review code\n  carefully.\ntools: Read\n---\n\n# Role\n`);
      const emitted = emitCodex({}, root).find(op => op.path === `.codex/agents/${name}.toml`).value;
      assert.ok(emitted.includes(`description = ${JSON.stringify(expected)}`), emitted);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
