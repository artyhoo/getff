import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  cpSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const fixture = mkdtempSync(join(tmpdir(), 'codex-arch-hooks-'));
after(() => rmSync(fixture, { recursive: true, force: true }));
cpSync(join(root, '.claude/hooks'), join(fixture, '.claude/hooks'), {
  recursive: true,
});
mkdirSync(join(fixture, '.ai-factory'), { recursive: true });
writeFileSync(join(fixture, '.ai-factory/harness-model.json'), '{}');
const env = {
  ...process.env,
  TMPDIR: fixture,
  AIF_RESIDUE_DIR: fixture,
  AIF_HOOK_LANG: 'ru',
};
for (const key of spawnSync('git', ['rev-parse', '--local-env-vars'], {
  encoding: 'utf8',
})
  .stdout.trim()
  .split('\n'))
  delete env[key];
assert.equal(spawnSync('git', ['init', '-q', fixture], { env }).status, 0);
function installAdapter() {
  for (const file of [
    'scripts/codex-hook-adapter.mjs',
    'scripts/lib/is-main-entry.mjs',
    'plugin/hooks/lib/hook-language.sh',
  ]) {
    const target = join(fixture, file);
    mkdirSync(resolve(target, '..'), { recursive: true });
    cpSync(join(root, file), target);
  }
}
function invoke(script, input, extraEnv = {}) {
  return spawnSync(
    process.execPath,
    [join(fixture, 'scripts/codex-hook-adapter.mjs'), script],
    {
      cwd: fixture,
      env: { ...env, ...extraEnv },
      input: JSON.stringify({ cwd: fixture, ...input }),
      encoding: 'utf8',
      timeout: 10000,
    },
  );
}

test('plugin command no longer silently skips the Stop hook when the runtime is installed', () => {
  // Same command contract as the installed contributor plugin; native event delivery
  // itself requires a separate live Codex acceptance run.
  const command =
    'root="$(git rev-parse --show-toplevel 2>/dev/null)"; if [ -f "$root/.ai-factory/harness-model.json" ] && [ -f "$root/scripts/codex-hook-adapter.mjs" ]; then node "$root/scripts/codex-hook-adapter.mjs" end-of-turn-reminder; fi';
  const input = JSON.stringify({
    hook_event_name: 'Stop',
    cwd: fixture,
    session_id: 'missing-runtime',
    last_assistant_message: 'Какой вариант выбираешь?',
  });
  const before = spawnSync('sh', ['-c', command], {
    cwd: fixture,
    env,
    input,
    encoding: 'utf8',
  });
  assert.equal(before.status, 0);
  assert.equal(before.stdout + before.stderr, '');
  installAdapter();
  const after = spawnSync('sh', ['-c', command], {
    cwd: fixture,
    env,
    input,
    encoding: 'utf8',
  });
  assert.equal(after.status, 2, after.stderr);
  assert.match(after.stderr, /по одной на\s+вопрос в раунде \/arch/);
  assert.match(after.stderr, /САМАЯ СУЩЕСТВЕННАЯ причина/);
});

test('SessionStart preserves nonblocking coordination conflicts and both file versions', () => {
  cpSync(
    join(root, 'scripts/link-coordination.sh'),
    join(fixture, 'scripts/link-coordination.sh'),
  );
  const model = readFileSync(join(root, '.ai-factory/harness-model.json'));
  writeFileSync(join(fixture, '.ai-factory/harness-model.json'), model);
  const canon = join(fixture, 'coordination');
  const prompts = join(fixture, '.claude/orchestrator-prompts');
  mkdirSync(canon, { recursive: true });
  mkdirSync(prompts, { recursive: true });
  const filename = '_handoff-startup-conflict.md';
  const local = join(prompts, filename);
  const shared = join(canon, filename);
  writeFileSync(local, 'Local handoff with independent changes.\n');
  writeFileSync(shared, 'Shared handoff with other independent changes.\n');
  const extraEnv = {
    CLAUDE_COORDINATION_DIR: canon,
    CLAUDE_PROJECT_DIR: fixture,
  };
  const original = spawnSync(
    'bash',
    [join(fixture, 'scripts/link-coordination.sh')],
    {
      cwd: fixture,
      env: { ...env, ...extraEnv },
      encoding: 'utf8',
    },
  );
  assert.notEqual(original.status, 0);
  assert.match(original.stderr, /CONFLICT:/);
  const registration = JSON.parse(model).hooks.SessionStart.find((entry) =>
    entry.command.includes('/scripts/link-coordination.sh'),
  );
  const registered = spawnSync('bash', ['-c', registration.command], {
    cwd: fixture,
    env: { ...env, ...extraEnv },
    encoding: 'utf8',
  });
  assert.equal(registered.status, 0, registered.stderr);
  const result = invoke(
    'link-coordination',
    {
      hook_event_name: 'SessionStart',
      source: 'startup',
      session_id: 'startup-conflict',
    },
    extraEnv,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    JSON.parse(result.stdout).hookSpecificOutput.additionalContext,
    /CONFLICT:/,
  );
  assert.equal(
    readFileSync(local, 'utf8'),
    'Local handoff with independent changes.\n',
  );
  assert.equal(
    readFileSync(shared, 'utf8'),
    'Shared handoff with other independent changes.\n',
  );
  // Removing the canonical nonblocking registration must restore visible failure.
  writeFileSync(join(fixture, '.ai-factory/harness-model.json'), '{}');
  const strict = invoke(
    'link-coordination',
    {
      hook_event_name: 'SessionStart',
      source: 'startup',
      session_id: 'startup-strict',
    },
    extraEnv,
  );
  assert.equal(strict.status, 2);
  assert.match(strict.stderr, /CONFLICT:/);
});

test('question payload passed to the adapter receives the complete card, then its retry can proceed', () => {
  const input = {
    hook_event_name: 'PreToolUse',
    tool_name: 'request_user_input_async',
    session_id: 'question-retry',
    tool_input: {
      questions: [{ title: 'Какой вариант?', options: ['А', 'Б'] }],
    },
  };
  const first = invoke('ask-question-reminder', input);
  assert.equal(first.status, 0, first.stderr);
  const challenge = JSON.parse(first.stdout).hookSpecificOutput;
  assert.equal(challenge.permissionDecision, 'deny');
  assert.match(challenge.permissionDecisionReason, /0\. Где мы/);
  assert.match(challenge.permissionDecisionReason, /5\. От тебя/);
  const retry = invoke('ask-question-reminder', input);
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(retry.stdout.trim(), '');
});

test('Stop loop guard allows the correction turn to finish', () => {
  const result = invoke('end-of-turn-reminder', {
    hook_event_name: 'Stop',
    session_id: 'loop-guard',
    stop_hook_active: true,
    last_assistant_message: 'Какой вариант?',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '');
});

test('missing language resolver is a visible failure rather than a silent skipped check', () => {
  const helper = join(fixture, 'plugin/hooks/lib/hook-language.sh');
  rmSync(helper);
  const result = invoke('ask-question-reminder', {
    hook_event_name: 'PreToolUse',
    tool_name: 'request_user_input_async',
    session_id: 'missing-helper',
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /hook-language\.sh/);
  cpSync(join(root, 'plugin/hooks/lib/hook-language.sh'), helper);
});
