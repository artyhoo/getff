import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const source = resolve('.agents/procedures/story/helpers/emit-story-prompt.sh');
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'story helper test '));
  try {
    const helper = join(root, '.agents/procedures/story/helpers/emit-story-prompt.sh');
    mkdirSync(join(root, '.agents/procedures/story/helpers'), { recursive: true });
    mkdirSync(join(root, '.agents/hooks/lang'), { recursive: true });
    mkdirSync(join(root, 'nested'));
    copyFileSync(source, helper);
    for (const lang of ['en', 'ru']) {
      copyFileSync(resolve(`.agents/hooks/lang/${lang}.sh`), join(root, `.agents/hooks/lang/${lang}.sh`));
    }
    run(root, helper);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
function emit(root, helper, lang) {
  return spawnSync('bash', [helper], { cwd: join(root, 'nested'), env: { ...process.env, AIF_HOOK_LANG: lang }, encoding: 'utf8' });
}
test('real language packs emit localized five-section instructions from a nested cwd', () => fixture((root, helper) => {
  for (const [lang, marker] of [['en', '## 🎬 What changed this session'], ['ru', '## 🎬 Что изменилось за сессию']]) {
    const result = emit(root, helper, lang);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(marker));
    assert.match(result.stdout, /1\..*\n2\..*\n3\..*\n4\..*\n5\./);
  }
}));
test('unknown and empty language values retain the English fallback', () => fixture((root, helper) => {
  for (const lang of ['', 'not-installed']) {
    const result = emit(root, helper, lang);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('## 🎬 What changed this session'));
  }
}));
test('language selection cannot source a file outside the language-pack directory', () => fixture((root, helper) => {
  // A controlled file makes traversal observable without reading or executing real host data.
  writeFileSync(join(root, '.agents/hooks/probe.sh'), "printf 'UNEXPECTED-SOURCE\\n'\naif_msg_eot_branch_story() { printf 'UNEXPECTED-STORY\\n'; }\n");
  const result = emit(root, helper, '../probe');
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('## 🎬 What changed this session'));
  assert.doesNotMatch(result.stdout, /UNEXPECTED/);
}));
test('missing fallback pack fails rather than returning an empty successful instruction', () => fixture((root, helper) => {
  rmSync(join(root, '.agents/hooks/lang/en.sh'));
  const result = emit(root, helper, 'not-installed');
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /en\.sh.*No such file/);
}));
test('an empty or whitespace-only instruction is a helper failure', () => fixture((root, helper) => {
  for (const body of [':', "printf ' \\n\\t'"]) {
    writeFileSync(join(root, '.agents/hooks/lang/en.sh'), `aif_msg_eot_branch_story() { ${body}; }\n`);
    const result = emit(root, helper, 'en');
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /empty story instruction/);
  }
}));
test('a failing language function preserves its status without emitting a partial instruction', () => fixture((root, helper) => {
  writeFileSync(join(root, '.agents/hooks/lang/en.sh'), "aif_msg_eot_branch_story() { printf 'PARTIAL INSTRUCTION\\n'; return 7; }\n");
  const result = emit(root, helper, 'en');
  assert.equal(result.status, 7);
  assert.equal(result.stdout, '');
}));
