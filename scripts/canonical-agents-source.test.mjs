import assert from 'node:assert/strict';
import { readFileSync, realpathSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(join(root, path), 'utf8');
const map = JSON.parse(read('scripts/canonical-agents-map.json'));

test('the full migration population has authored owners and reachable native entries', () => {
  for (const { legacy, owner, entry } of map.entries) {
    assert.equal(lstatSync(join(root, owner)).isSymbolicLink(), false, owner);
    if (entry === 'link') assert.equal(realpathSync(join(root, legacy)), join(root, owner), legacy);
    else if (entry === 'generated') {
      const normalized = text => text.replace(/\]\([^)]*\)/g, '](target)').replace(/\[(?:\.\.\/)+/g, '[');
      assert.equal(normalized(read(legacy)), normalized(read(owner)), legacy);
    } else assert.ok(read(legacy).includes(`Read \`${owner}\` completely before acting`), legacy);
    if (owner.startsWith('.agents/procedures/') && owner.endsWith('.md')) {
      assert.doesNotMatch(read(owner), /^```!|CLAUDE_SKILL_DIR|`!bash/m, owner);
    }
  }
  for (const { origin, target } of map.resolvedLinks) {
    assert.ok(existsSync(resolve(root, origin, '..', target.split('#')[0])), `${origin}: ${target}`);
  }
});

test('story helper and hook are shared owners, including edits through compatibility entries', () => {
  for (const [entry, owner] of [
    ['.claude/skills/story/SKILL.md', '.agents/procedures/story/SKILL.md'],
    ['.claude/skills/story/helpers/emit-story-prompt.sh', '.agents/procedures/story/helpers/emit-story-prompt.sh'],
    ['.claude/hooks/check-doc-authority-header.sh', '.agents/hooks/check-doc-authority-header.sh'],
  ]) {
    assert.equal(realpathSync(join(root, entry)), join(root, owner));
    const original = read(owner);
    try {
      writeFileSync(join(root, owner), original + '\n<!-- canonical-source-change-control -->\n');
      assert.match(read(entry), /canonical-source-change-control/);
    } finally { writeFileSync(join(root, owner), original); }
  }
  const procedure = read('.agents/procedures/story/SKILL.md');
  assert.doesNotMatch(procedure, /CLAUDE_SKILL_DIR|`!bash/);
  const canonical = spawnSync('bash', ['.agents/procedures/story/helpers/emit-story-prompt.sh'], { cwd: root, encoding: 'utf8' });
  const legacy = spawnSync('bash', ['.claude/skills/story/helpers/emit-story-prompt.sh'], { cwd: root, encoding: 'utf8' });
  assert.equal(canonical.status, 0, canonical.stderr);
  assert.equal(legacy.status, 0, legacy.stderr);
  assert.match(canonical.stdout, /## 🎬/);
  assert.equal(canonical.stdout, legacy.stdout);
});

test('authority hook still distinguishes clean and violating edits through both entries', () => {
  const consumer = mkdtempSync(join(tmpdir(), 'canonical-authority-'));
  mkdirSync(join(consumer, '.claude/rules'), { recursive: true });
  try {
    for (const route of ['.claude/rules', '.agents/rules', '.agents/procedures/probe', '.agents/roles']) {
    mkdirSync(join(consumer, route), { recursive: true });
    const file = join(consumer, route, route.includes('procedures') ? 'SKILL.md' : 'probe.md');
    const payload = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: file } });
    for (const hook of ['.agents/hooks/check-doc-authority-header.sh', '.claude/hooks/check-doc-authority-header.sh']) {
      writeFileSync(file, '# Probe\n');
      const bad = spawnSync('bash', [join(root, hook)], { input: payload, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: consumer, ZCODE_PROJECT_DIR: '' } });
      assert.equal(bad.status, 2, bad.stderr);
      assert.match(bad.stderr, /missing.*Authoritative/);
      writeFileSync(file, '# Probe\n\n> **Authoritative for:** disposable probe.\n');
      const good = spawnSync('bash', [join(root, hook)], { input: payload, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: consumer, ZCODE_PROJECT_DIR: '' } });
      assert.equal(good.status, 0, good.stderr);
    }
    }
  } finally { rmSync(consumer, { recursive: true, force: true }); }
});

test('one output-language instruction preserves CC plain output and ZCode JSON adaptation', () => {
  const invoke = extra => spawnSync('bash', ['.agents/hooks/inject-output-language.sh'], { cwd: root, encoding: 'utf8', env: { ...process.env, AIF_HOOK_LANG: 'ru', ZCODE_PROJECT_DIR: '', ...extra } });
  const cc = invoke({});
  const zcode = invoke({ ZCODE_PROJECT_DIR: root });
  assert.equal(cc.status, 0, cc.stderr);
  assert.equal(zcode.status, 0, zcode.stderr);
  assert.equal(JSON.parse(zcode.stdout).additionalContext, cc.stdout.trim());
  assert.match(cc.stdout, /Address the operator in Russian/);
});

test('CC report warning calls the shared grammar with clean, violation and noise controls', () => {
  const invoke = text => spawnSync('bash', ['.agents/hooks/warn-subagent-report.sh'], { cwd: root, input: JSON.stringify({ agent_type: 'worker', last_assistant_message: text }), encoding: 'utf8', env: { ...process.env, ZCODE_PROJECT_DIR: '' } });
  const good = invoke('VERIFY: checked\nConfidence: high\nATTN: none');
  const bad = invoke('VERIFY: checked\nConfidence: high');
  const noise = invoke('The worker reports that normal prose is complete.');
  for (const result of [good, bad, noise]) assert.equal(result.status, 0, result.stderr);
  assert.equal(good.stdout, '');
  assert.equal(noise.stdout, '');
  assert.match(JSON.parse(bad.stdout).hookSpecificOutput.additionalContext, /missing section\(s\): ATTN/);
});
