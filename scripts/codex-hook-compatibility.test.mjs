import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  cpSync,
  symlinkSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { dispatch, runHook } from './codex-hook-adapter.mjs';
import { emitCodexHooks } from './lib/codex-hooks.mjs';
for (const key of spawnSync('git', ['rev-parse', '--local-env-vars'], {
  encoding: 'utf8',
})
  .stdout.trim()
  .split('\n'))
  delete process.env[key];
function fixture(t) {
  const root = mkdtempSync(
    join(tmpdir(), 'adapter compatible union with spaces '),
  );
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const p of [
    '.agents/hooks/lib',
    '.agents/procedures',
    '.claude/hooks',
    'scripts',
    '.codex',
    '.ai-factory',
  ])
    mkdirSync(join(root, p), { recursive: true });
  writeFileSync(
    join(root, '.agents/hooks/lib/hook-language.sh'),
    'export UNION_LANGUAGE=consumer-language\n',
  );
  writeFileSync(join(root, '.codex/hooks.json'), '{}\n');
  writeFileSync(
    join(root, '.claude/settings.json'),
    JSON.stringify({ permissions: { deny: [] } }),
  );
  writeFileSync(
    join(root, '.agents/hooks/probe.sh'),
    'printf "consumer:%s" "$UNION_LANGUAGE"\n',
  );
  writeFileSync(
    join(root, '.claude/hooks/probe.sh'),
    'printf "WRONG-LEGACY-HOOK"\n',
  );
  return root;
}
test('Stop retry guard precedes transcript/helper adaptation and cannot suppress first Stop', (t) => {
  const root = fixture(t);
  const input = {
    hook_event_name: 'Stop',
    stop_hook_active: true,
    transcript_path: join(root, 'missing.jsonl'),
    cwd: root,
  };
  assert.deepEqual(dispatch(input, 'missing-hook', root), {
    status: 0,
    stdout: '',
    stderr: '',
  });
  assert.notEqual(
    dispatch({ ...input, stop_hook_active: false }, 'missing-hook', root)
      .status,
    0,
  );
});
test('canonical consumer hook and language remain preferred over cached contributor-only paths', (t) => {
  const root = fixture(t),
    r = runHook(root, 'probe', { hook_event_name: 'SessionStart', cwd: root });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, 'consumer:consumer-language');
});
test('coordination failure is advisory only for explicit canonical SessionStart best-effort command', (t) => {
  const root = fixture(t);
  writeFileSync(
    join(root, 'scripts/link-coordination.sh'),
    'printf "setup census"\nprintf "actual coordination conflict" >&2\nexit 7\n',
  );
  const set = (command) =>
    writeFileSync(
      join(root, '.ai-factory/harness-model.json'),
      JSON.stringify({ hooks: { SessionStart: [{ command }] } }),
    );
  set('bash "$CLAUDE_PROJECT_DIR/scripts/link-coordination.sh" || true');
  const input = { hook_event_name: 'SessionStart', cwd: root };
  let r = runHook(root, 'link-coordination', input);
  assert.equal(r.status, 0, r.stderr);
  assert.match(
    JSON.parse(r.stdout).hookSpecificOutput.additionalContext,
    /actual coordination conflict/,
  );
  assert.doesNotMatch(r.stdout, /setup census/);
  assert.equal(r.stderr, '');
  assert.equal(
    runHook(root, 'link-coordination', {
      ...input,
      hook_event_name: 'PostToolUse',
    }).status,
    7,
  );
  for (const command of [
    'bash "$CLAUDE_PROJECT_DIR/scripts/link-coordination.sh"',
    'bash "$CLAUDE_PROJECT_DIR/scripts/other.sh" || true',
  ]) {
    set(command);
    assert.equal(runHook(root, 'link-coordination', input).status, 7);
  }
  writeFileSync(join(root, '.ai-factory/harness-model.json'), 'malformed');
  assert.equal(runHook(root, 'link-coordination', input).status, 7);
});
test('wildcard deny still fires and unsupported bracket syntax stays diagnosed', (t) => {
  const root = fixture(t);
  writeFileSync(
    join(root, '.claude/settings.json'),
    JSON.stringify({
      permissions: { deny: ['Read(secret/*.env)', 'Read(src/[abc].ts)'] },
    }),
  );
  const r = dispatch(
    {
      hook_event_name: 'PreToolUse',
      tool_name: 'Read',
      tool_input: { file_path: join(root, 'secret/probe.env') },
      cwd: root,
    },
    'seal-primary-checkout',
    root,
  );
  assert.equal(r.status, 0, r.stderr);
  assert.equal(
    JSON.parse(r.stdout).hookSpecificOutput.permissionDecision,
    'deny',
  );
  assert.match(r.stderr, /unsupported deny rule.*\[abc\]/);
});
test('native matcher registration reaches normalized actual user-input/patch/exec tools', () => {
  const model = {
    PreToolUse: [
      {
        matcher: 'AskUserQuestion',
        command:
          'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/ask-question-reminder.sh"',
      },
      {
        matcher: 'Edit|Write|MultiEdit|Bash',
        command:
          'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/check-hook-marker.sh"',
      },
    ],
  };
  const { hooks } = emitCodexHooks(model, (n) => 'node adapter ' + n);
  assert.deepEqual(hooks.PreToolUse[0].matcher.split('|'), [
    'AskUserQuestion',
    'request_user_input',
    'request_user_input_async',
  ]);
  assert.deepEqual(hooks.PreToolUse[1].matcher.split('|'), [
    'Edit',
    'apply_patch',
    'Write',
    'Bash',
    'exec_command',
  ]);
});
test('packaged runtime explicit argv root preserves nearest nested consumer and physical aliases', (t) => {
  const root = fixture(t);
  const cache = join(root, 'cache runtime');
  mkdirSync(join(cache, 'scripts/lib'), { recursive: true });
  cpSync(
    resolve('scripts/codex-hook-adapter.mjs'),
    join(cache, 'scripts/codex-hook-adapter.mjs'),
  );
  cpSync(
    resolve('scripts/lib/is-main-entry.mjs'),
    join(cache, 'scripts/lib/is-main-entry.mjs'),
  );
  const nested = join(root, 'nested cwd with spaces');
  mkdirSync(nested);
  const alias = join(root, 'physical alias');
  symlinkSync(nested, alias);
  const entry = join(cache, 'scripts/codex-hook-adapter.mjs');
  const run = (cwd, bound = root, script = 'probe') =>
    spawnSync(process.execPath, [entry, script, bound], {
      cwd: root,
      input: JSON.stringify({ hook_event_name: 'SessionStart', cwd }),
      encoding: 'utf8',
    });
  for (const cwd of [nested, alias]) {
    const r = run(cwd);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /consumer:consumer-language/);
  }
  const missing = run(nested, join(root, 'missing root'));
  assert.equal(missing.status, 2);
  assert.equal(run(nested, root, '../probe').status, 2);
  const child = join(nested, 'independent installed child');
  for (const path of ['.codex', '.agents/procedures', '.agents/hooks/lib'])
    mkdirSync(join(child, path), { recursive: true });
  writeFileSync(join(child, '.codex/hooks.json'), '{}');
  writeFileSync(
    join(child, '.agents/hooks/lib/hook-language.sh'),
    'export UNION_LANGUAGE=child-language\n',
  );
  writeFileSync(
    join(child, '.agents/hooks/probe.sh'),
    'printf "child:%s" "$UNION_LANGUAGE"\n',
  );
  const skipped = run(child);
  assert.equal(skipped.status, 0, skipped.stderr);
  assert.equal(skipped.stdout, '');
  const own = run(child, child);
  assert.equal(own.status, 0, own.stderr);
  assert.match(own.stdout, /child:child-language/);
});
test('explicit contributor root accepts its Git-bound nested cwd and skips unrelated checkout', (t) => {
  const root = fixture(t);
  rmSync(join(root, '.codex/hooks.json'));
  spawnSync('git', ['init', '-q'], { cwd: root });
  const cache = join(root, 'cache');
  mkdirSync(join(cache, 'scripts/lib'), { recursive: true });
  cpSync(
    resolve('scripts/codex-hook-adapter.mjs'),
    join(cache, 'scripts/codex-hook-adapter.mjs'),
  );
  cpSync(
    resolve('scripts/lib/is-main-entry.mjs'),
    join(cache, 'scripts/lib/is-main-entry.mjs'),
  );
  const cwd = join(root, 'nested');
  mkdirSync(cwd);
  const entry = join(cache, 'scripts/codex-hook-adapter.mjs'),
    run = (cwd) =>
      spawnSync(process.execPath, [entry, 'probe', root], {
        input: JSON.stringify({ hook_event_name: 'SessionStart', cwd }),
        encoding: 'utf8',
      });
  assert.match(run(cwd).stdout, /consumer:consumer-language/);
  const foreign = mkdtempSync(join(tmpdir(), 'unrelated checkout '));
  t.after(() => rmSync(foreign, { recursive: true, force: true }));
  spawnSync('git', ['init', '-q'], { cwd: foreign });
  const r = run(foreign);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '');
});
