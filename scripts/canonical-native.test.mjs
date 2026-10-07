import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runHook } from './codex-hook-adapter.mjs';
import { emitCodex } from './render-codex-contributor.mjs';
import { consumerCodexHooks } from '../setup.d/codex-bindings.mjs';
import { spawnSync } from 'node:child_process';

// Fixture git subprocesses must never inherit the invoking git's hook-env: a pre-push
// hook runs this suite with an absolute GIT_DIR pointing at the invoking worktree, and
// an inherited GIT_DIR resolves every fixture `git init`/`rev-parse` into THAT tree —
// "fatal: this operation must be run in a work tree" (reproduced from a linked
// worktree). The var list comes from git itself so it cannot drift (precedent:
// codex-contributor.test.mjs module scrub; link-coordination's env -u list).
for (const key of spawnSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8' }).stdout.trim().split('\n')) delete process.env[key];

const repo = resolve(import.meta.dirname, '..');

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
      const ops = emitCodex({}, root);
      const emitted = ops.find(op => op.path === `.codex/agents/${name}.toml`).value;
      assert.ok(emitted.includes(`description = ${JSON.stringify(expected)}`), emitted);
      // Round-trip must reach BOTH native surfaces: the TOML role AND the discovery card
      // metadata (GH-4201345521 — a generic card sentence cannot distinguish a writing
      // role from a review role before the body is read).
      const card = ops.find(op => op.path === `.agents/skills/${name}/SKILL.md`).value;
      assert.ok(card.includes(`description: ${JSON.stringify(expected)}`), card);
      assert.match(ops.find(op => op.path === `.agents/skills/${name}/agents/openai.yaml`).value, /allow_implicit_invocation: false/);
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

// GH-4201345519: the checked-in native card population (.agents/skills/*, .codex/agents/*)
// is a derived artifact of the ONE generator — its parity with the canonical sources must
// be gated, not assumed. This arm is the real-tree gate on the test:canonical channel.
test('the authoring repo checked-in codex population matches the SSOT render', () => {
  const r = spawnSync(process.execPath, [join(repo, 'scripts/render-harness-config.mjs'), '--check', '--only', 'codex'], { cwd: repo, encoding: 'utf8' });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
});

test('native card parity is gated: description, policy flag and deleted target fail --check; body-only edits stay green', () => {
  const f = mkdtempSync(join(tmpdir(), 'canonical-parity-'));
  try {
    mkdirSync(join(f, '.ai-factory'), { recursive: true });
    writeFileSync(join(f, '.ai-factory/harness-model.json'), '{}');
    mkdirSync(join(f, '.agents/procedures/example/helpers'), { recursive: true });
    mkdirSync(join(f, '.agents/roles'), { recursive: true });
    const procedure = '---\nname: example\ndescription: Example workflow\ndisable-model-invocation: true\n---\n\nUNIQUE-AUTHORED-PROCEDURE\n';
    writeFileSync(join(f, '.agents/procedures/example/SKILL.md'), procedure);
    writeFileSync(join(f, '.agents/procedures/example/helpers/run.sh'), '#!/bin/bash\nexit 0\n');
    const role = '---\nname: reviewer\ndescription: Review code\n---\n\nUNIQUE-ROLE-PROCEDURE\n';
    writeFileSync(join(f, '.agents/roles/reviewer.md'), role);
    const gen = mode => spawnSync(process.execPath, [join(repo, 'scripts/render-harness-config.mjs'), mode, '--only', 'codex', '--root', f], { encoding: 'utf8' });
    assert.equal(gen('--write').status, 0, gen.stderr);
    assert.equal(gen('--check').status, 0);
    const rolePath = join(f, '.agents/roles/reviewer.md');
    const procPath = join(f, '.agents/procedures/example/SKILL.md');
    // (a) description drift between the canonical owner and the checked-in card metadata
    writeFileSync(rolePath, role.replace('Review code', 'Review pull requests'));
    assert.equal(gen('--check').status, 1, 'role description drift must fail the check');
    writeFileSync(rolePath, role);
    // (b) explicit-only policy drift: the disable flag drives openai.yaml + card metadata
    writeFileSync(procPath, procedure.replace('disable-model-invocation: true\n', ''));
    assert.equal(gen('--check').status, 1, 'disable-flag drift must fail the check');
    writeFileSync(procPath, procedure);
    // false-drift guard: a canonical body-only edit regenerates byte-identical cards
    writeFileSync(procPath, procedure + 'Additional authored body paragraph.\n');
    assert.equal(gen('--check').status, 0, 'body-only canonical edit must not false-fail the parity gate');
    writeFileSync(procPath, procedure);
    // (c) deleted target: the card's resource symlink must never dangle silently. A fully
    // deleted resource dir is caught by the retirement detection; a dangling link inside the
    // source is caught by the renderer's reachability validation — both fail BEFORE any write.
    rmSync(join(f, '.agents/procedures/example/helpers'), { recursive: true });
    const deleted = gen('--check');
    assert.equal(deleted.status, 1, 'deleted canonical resource must fail the check');
    assert.match(deleted.stderr, /retired generated file remains|canonical resource missing/);
    mkdirSync(join(f, '.agents/procedures/example/helpers'), { recursive: true });
    writeFileSync(join(f, '.agents/procedures/example/helpers/run.sh'), '#!/bin/bash\nexit 0\n');
    rmSync(join(f, '.agents/procedures/example/helpers/run.sh'));
    symlinkSync('/nonexistent/dangling-target', join(f, '.agents/procedures/example/helpers/run.sh'));
    const dangling = gen('--check');
    assert.equal(dangling.status, 1, 'dangling canonical resource link must fail the check');
    assert.match(dangling.stderr, /canonical resource missing/);
  } finally { rmSync(f, { recursive: true, force: true }); }
});

test('emitted card helper bindings execute from root and nested cwd through the git-anchored path', () => {
  const f = realpathSync(mkdtempSync(join(tmpdir(), 'canonical-helper-cwd-')));
  try {
    mkdirSync(join(f, '.ai-factory'), { recursive: true });
    writeFileSync(join(f, '.ai-factory/harness-model.json'), '{}');
    mkdirSync(join(f, '.agents/procedures/example/helpers'), { recursive: true });
    writeFileSync(join(f, '.agents/procedures/example/SKILL.md'), '---\nname: example\ndescription: Example workflow\n---\n\nProcedure body.\n');
    writeFileSync(join(f, '.agents/procedures/example/helpers/run.sh'), '#!/bin/bash\nprintf HELPER-OK\n');
    assert.equal(spawnSync('git', ['init', '-q'], { cwd: f }).status, 0);
    const gen = spawnSync(process.execPath, [join(repo, 'scripts/render-harness-config.mjs'), '--write', '--only', 'codex', '--root', f], { encoding: 'utf8' });
    assert.equal(gen.status, 0, gen.stderr);
    const nested = join(f, 'packages/app');
    mkdirSync(nested, { recursive: true });
    // GH-4201345530: helper paths are root-anchored via git, never session-cwd-relative —
    // both the canonical owner and the card's symlinked twin must run from root AND nested cwd.
    for (const [label, cwd] of [['root', f], ['nested cwd', nested]]) {
      for (const path of ['.agents/procedures/example/helpers/run.sh', '.agents/skills/example/helpers/run.sh']) {
        const r = spawnSync('bash', ['-c', 'root="$(git rev-parse --show-toplevel)"; bash "$root/' + path + '"'], { cwd, encoding: 'utf8' });
        assert.equal(r.status, 0, r.stderr);
        assert.equal(r.stdout, 'HELPER-OK', `${path} from ${label}`);
      }
    }
  } finally { rmSync(f, { recursive: true, force: true }); }
});
