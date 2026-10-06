import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runHook } from './codex-hook-adapter.mjs';
import { emitCodex } from './render-codex-contributor.mjs';
import { consumerCodexHooks } from '../setup.d/codex-bindings.mjs';
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
    for(const path of ['.codex/hooks.json','.codex/config.toml','.codex/contributor-inventory.json','.codex/agents/reviewer.toml','.zcode/config.json','.zcode/skills','.agents/procedures/example/SKILL.md','.agents/skills/example/SKILL.md']) {
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

test('consumer native bindings run the delivered authority check without contributor assets', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'consumer-codex-hooks-')));
  try {
    mkdirSync(join(root, '.claude'), { recursive: true });
    mkdirSync(join(root, '.agents/hooks/lib'), { recursive: true });
    mkdirSync(join(root, '.agents/procedures/example'), { recursive: true });
    mkdirSync(join(root, 'scripts/lib'), { recursive: true });
    for (const name of ['codex-hook-adapter.mjs', 'lib/is-main-entry.mjs'])
      cpSync(new URL(name, import.meta.url), join(root, 'scripts', name));
    cpSync(new URL('../plugin/hooks/lib/hook-language.sh', import.meta.url), join(root, '.agents/hooks/lib/hook-language.sh'));
    cpSync(new URL('../.agents/hooks/check-doc-authority-header.sh', import.meta.url), join(root, '.agents/hooks/check-doc-authority-header.sh'));
    const registration = command => ({ matcher: 'Edit|Write|MultiEdit', hooks: [{ type: 'command', command }] });
    writeFileSync(join(root, '.claude/settings.json'), JSON.stringify({ hooks: {
      PostToolUse: [registration('bash "$CLAUDE_PROJECT_DIR/.claude/hooks/check-doc-authority-header.sh"'), registration('echo user-command'), registration('bash .claude/hooks/not-delivered.sh'), registration('bash .claude/hooks/check-doc-authority-header.sh; echo user-command')],
      PostToolUseFailure: [registration('bash .claude/hooks/check-doc-authority-header.sh')],
    } }));
    const { hooks, degradations } = consumerCodexHooks(root);
    assert.equal(hooks.PostToolUse.length, 1, 'only registered delivered framework shell commands are adapted');
    assert.equal(hooks.PostToolUse[0].matcher, 'Edit|Write');
    assert.equal(hooks.PostToolUseFailure, undefined);
    assert.equal(degradations.length, 1);
    mkdirSync(join(root, '.codex'), { recursive: true });
    writeFileSync(join(root, '.codex/hooks.json'), JSON.stringify({ hooks }));
    const command = hooks.PostToolUse[0].hooks[0].command;
    assert.ok(!command.includes('.ai-factory'));
    const file = join(root, '.agents/procedures/example/SKILL.md');
    const input = JSON.stringify({ cwd: root, session_id: 'consumer-fixture', hook_event_name: 'PostToolUse', tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Add File: .agents/procedures/example/SKILL.md\n+missing header\n*** End Patch' } });
    writeFileSync(file, '# Missing header\n');
    const outer = join(root, 'outer');
    const nested = join(outer, 'packages/app');
    mkdirSync(nested, { recursive: true });
    assert.equal(spawnSync('git', ['init', '-q'], { cwd: outer }).status, 0);
    for (const name of ['.codex', '.agents', 'scripts']) cpSync(join(root, name), join(nested, name), { recursive: true });
    const run = () => spawnSync('bash', ['-c', command], { cwd: root, input, encoding: 'utf8' });
    const adverse = run();
    assert.equal(adverse.status, 2, adverse.stderr);
    assert.match(adverse.stderr, /doc-authority.*missing/);
    const nestedInput = JSON.stringify({ ...JSON.parse(input), cwd: nested });
    const nestedResult = spawnSync('bash', ['-c', command], { cwd: nested, input: nestedInput, encoding: 'utf8' });
    assert.equal(nestedResult.status, 2, nestedResult.stderr);
    assert.match(nestedResult.stderr, /doc-authority.*missing/);
    mkdirSync(join(nested, 'src'));
    const subdirInput = JSON.stringify({ ...JSON.parse(input), cwd: join(nested, 'src'), tool_input: { command: '*** Begin Patch\n*** Update File: ../.agents/procedures/example/SKILL.md\n@@\n-missing header\n+still missing\n*** End Patch' } });
    const subdirResult = spawnSync('bash', ['-c', command], { cwd: join(nested, 'src'), input: subdirInput, encoding: 'utf8' });
    assert.equal(subdirResult.status, 2, subdirResult.stderr);
    assert.match(subdirResult.stderr, /doc-authority.*missing/);
    writeFileSync(file, '> **Authoritative for:** example procedure.\n');
    const clean = run();
    assert.equal(clean.status, 0, clean.stderr);
    assert.equal(clean.stdout, '');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
