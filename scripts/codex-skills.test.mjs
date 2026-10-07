import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  cpSync,
  realpathSync,
  unlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { emitCodex } from './render-codex-contributor.mjs';
import { comparePackagedRuntime } from './codex-contributor-doctor.mjs';
const root = resolve(import.meta.dirname, '..');
const model = JSON.parse(
  readFileSync(join(root, '.ai-factory/harness-model.json')),
);

test('every entry loads canonical source and binds resource paths to that source', () => {
  const ops = emitCodex(model, root);
  const inventory = ops.find(
    (o) => o.path === '.codex/contributor-inventory.json',
  ).value;
  for (const { name, source } of inventory.skills) {
    const card = ops.find(
      (o) => o.path === `.agents/skills/${name}/SKILL.md`,
    ).value;
    assert.ok(
      card.includes(
        `../../../${source}${source.endsWith('.md') ? '' : '/SKILL.md'}`,
      ),
      name,
    );
    assert.match(card, /in full/, name);
    if (!source.endsWith('.md'))
      assert.ok(card.includes('with `' + source + '`'), name);
  }
  for (const name of ['using-getff', 'installing-enforcement'])
    assert.ok(
      inventory.skills.some((s) => s.name === name),
      name,
    );
});

test('packaged runtime executes canonical hooks in checkouts that have no local adapter', () => {
  const ops = emitCodex(model, root);
  const runtime = ops.filter((o) =>
    o.path.startsWith('codex-contributor-plugin/runtime/'),
  );
  assert.equal(
    runtime.length,
    3,
    'adapter and both runtime dependencies must ship with the plugin',
  );
  const f = realpathSync(
    mkdtempSync(join(tmpdir(), 'codex-packaged-runtime-')),
  );
  try {
    for (const op of runtime) {
      const path = join(f, op.path);
      mkdirSync(resolve(path, '..'), { recursive: true });
      writeFileSync(path, op.value);
    }
    const pluginRoot = join(f, 'codex-contributor-plugin');
    const command = ops
      .find((o) => o.path.endsWith('hooks/hooks.json'))
      .value.hooks.PreToolUse.find((g) =>
        g.hooks[0].command.includes('ask-question-reminder'),
      ).hooks[0].command;
    for (const name of ['first', 'second']) {
      const checkout = join(f, name);
      mkdirSync(checkout);
      assert.equal(spawnSync('git', ['init', '-q', checkout]).status, 0);
      mkdirSync(join(checkout, '.ai-factory'));
      writeFileSync(join(checkout, '.ai-factory/harness-model.json'), '{}');
      cpSync(join(root, '.claude/hooks'), join(checkout, '.claude/hooks'), {
        recursive: true,
      });
      const r = spawnSync('sh', ['-c', command], {
        cwd: checkout,
        env: {
          ...process.env,
          PLUGIN_ROOT: pluginRoot,
          AIF_HOOK_LANG: 'en',
          TMPDIR: f,
        },
        input: JSON.stringify({
          cwd: checkout,
          hook_event_name: 'PreToolUse',
          tool_name: 'request_user_input',
          session_id: name,
          tool_input: { questions: [{ question: 'Choose?', options: [] }] },
        }),
        encoding: 'utf8',
      });
      assert.equal(r.status, 0, r.stderr);
      const output = JSON.parse(r.stdout).hookSpecificOutput;
      assert.equal(output.permissionDecision, 'deny');
      assert.match(output.permissionDecisionReason, /0\./);
    }
  } finally {
    rmSync(f, { recursive: true, force: true });
  }
});

test('damaged plugin is visible, Stop cannot loop, unrelated repositories stay quiet', () => {
  const hooks = emitCodex(model, root).find((o) =>
    o.path.endsWith('hooks/hooks.json'),
  ).value.hooks;
  const f = mkdtempSync(join(tmpdir(), 'codex-damaged-runtime-'));
  try {
    spawnSync('git', ['init', '-q', f]);
    const invoke = (command) =>
      spawnSync('sh', ['-c', command], {
        cwd: f,
        input: '{}',
        env: {
          ...process.env,
          PLUGIN_ROOT: join(f, 'missing-plugin'),
          CLAUDE_PLUGIN_ROOT: '',
        },
        encoding: 'utf8',
      });
    const pre = hooks.PreToolUse[0].hooks[0].command;
    const stop = hooks.Stop[0].hooks[0].command;
    assert.equal(invoke(pre).status, 0);
    mkdirSync(join(f, '.ai-factory'));
    writeFileSync(join(f, '.ai-factory/harness-model.json'), '{}');
    const failure = invoke(pre);
    assert.equal(failure.status, 2);
    assert.match(failure.stderr, /missing.*packaged.*runtime/);
    const stopFailure = invoke(stop);
    assert.equal(stopFailure.status, 0);
    assert.match(stopFailure.stderr, /missing.*packaged.*runtime/);
  } finally {
    rmSync(f, { recursive: true, force: true });
  }
});

test('regeneration preserves pre-existing operator config byte for byte', () => {
  const f = mkdtempSync(join(tmpdir(), 'codex-owned-config-'));
  try {
    mkdirSync(join(f, '.ai-factory'));
    writeFileSync(
      join(f, '.ai-factory/harness-model.json'),
      JSON.stringify({ hooks: {} }),
    );
    mkdirSync(join(f, '.codex'));
    const config =
      'model = "operator-choice"\napproval_policy = "on-request"\n';
    writeFileSync(join(f, '.codex/config.toml'), config);
    const r = spawnSync(
      process.execPath,
      [
        join(root, 'scripts/render-harness-config.mjs'),
        '--root',
        f,
        '--write',
        '--only',
        'codex',
      ],
      { encoding: 'utf8' },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readFileSync(join(f, '.codex/config.toml'), 'utf8'), config);
  } finally {
    rmSync(f, { recursive: true, force: true });
  }
});

test('all canonical mutation and shell matchers select their native transport before normalization', () => {
  const h = emitCodex(model, root).find((o) =>
    o.path.endsWith('hooks/hooks.json'),
  ).value.hooks;
  for (const [event, entries] of Object.entries(model.hooks)) {
    if (!['PreToolUse', 'PostToolUse'].includes(event)) continue;
    for (const entry of entries) {
      const name = /\/([a-z-]+)\.sh/.exec(entry.command)?.[1];
      if (name === 'inject-subagent-context') continue;
      const group = h[event].find((g) =>
        g.hooks.some((hook) => hook.command.includes(` ${name} "$root";`)),
      );
      assert.ok(group, name);
      const matches = (t) =>
        group.matcher === '*' || new RegExp(`^(?:${group.matcher})$`).test(t);
      if (/Edit|Write|MultiEdit/.test(entry.matcher))
        assert.ok(matches('apply_patch'), name);
      if (/Bash/.test(entry.matcher)) assert.ok(matches('exec_command'), name);
    }
  }
});

// A synthetic RPC boundary exercises the actual doctor CLI; this is not evidence
// that native Codex executes a skill. Call from a node:test case with its repo root.
export function runDoctorWithDisabledSkill(root) {
  const fixture = mkdtempSync(join(tmpdir(), 'codex-disabled-skill-'));
  try {
    for (const path of [
      'scripts/lib',
      '.codex',
      'bin',
      'codex-contributor-plugin/hooks',
    ])
      mkdirSync(join(fixture, path), { recursive: true });
    for (const path of [
      'scripts/codex-contributor-doctor.mjs',
      'scripts/lib/is-main-entry.mjs',
    ])
      cpSync(join(root, path), join(fixture, path));
    writeFileSync(
      join(fixture, '.codex/contributor-inventory.json'),
      JSON.stringify({
        skills: [{ name: 'arch' }],
        hooks: { Stop: 1 },
        degradations: [],
      }),
    );
    writeFileSync(
      join(fixture, 'codex-contributor-plugin/hooks/hooks.json'),
      JSON.stringify({
        hooks: {
          Stop: [
            {
              hooks: [
                { type: 'command', command: 'node adapter.mjs', timeout: 45 },
              ],
            },
          ],
        },
      }),
    );
    writeFileSync(
      join(fixture, 'bin/codex'),
      `#!${process.execPath}
const readline = require('node:readline');
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const request = JSON.parse(line);
  let result;
  switch (request.method) {
    case 'initialize': result = { userAgent: 'synthetic-disabled-skill-fixture' }; break;
    case 'skills/list': result = { data: [{ skills: [{ name: 'arch', path: process.cwd() + '/.agents/skills/arch/SKILL.md', enabled: false }], errors: [] }] }; break;
    case 'hooks/list': result = { data: [{ hooks: [{ pluginId: 'getff-contributor@getff-contributor-local', eventName: 'stop', matcher: null, handlerType: 'command', command: 'node adapter.mjs', timeoutSec: 45, enabled: true, trustStatus: 'trusted' }], warnings: [], errors: [] }] }; break;
    case 'config/read': result = { config: {}, layers: [] }; break;
    default: process.stdout.write(JSON.stringify({ id: request.id, error: { message: 'Unexpected RPC method: ' + request.method } }) + '\\n'); return;
  }
  process.stdout.write(JSON.stringify({ id: request.id, result }) + '\\n');
});
`,
      { mode: 0o755 },
    );
    const result = spawnSync(
      process.execPath,
      [join(fixture, 'scripts/codex-contributor-doctor.mjs'), '--check'],
      {
        env: {
          ...process.env,
          PATH: join(fixture, 'bin') + ':' + process.env.PATH,
        },
        encoding: 'utf8',
        timeout: 10000,
      },
    );
    return {
      ...result,
      report: result.stdout.trim() ? JSON.parse(result.stdout) : null,
    };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

test('doctor rejects a discovered but disabled project skill', () => {
  const result = runDoctorWithDisabledSkill(root);
  assert.equal(result.report.projectSkills[0].enabled, false);
  assert.equal(result.status, 2, result.stderr);
  assert.deepEqual(result.report.disabledSkills, ['arch']);
  assert.equal(result.report.skillsActivated, false);
  assert.equal(result.report.ready, false);
});

test('doctor detects missing or stale installed runtime bytes', () => {
  const ops = emitCodex(model, root);
  const generated = ops.find(
    (o) => o.path === '.codex/contributor-inventory.json',
  ).value.generated;
  const runtime = ops.filter((o) =>
    o.path.startsWith('codex-contributor-plugin/runtime/'),
  );
  const f = mkdtempSync(join(tmpdir(), 'codex-runtime-doctor-'));
  try {
    const native = [
      { sourcePath: join(f, 'codex-contributor-plugin/hooks/hooks.json') },
    ];
    assert.equal(comparePackagedRuntime(generated, native).length, 3);
    for (const op of runtime) {
      const path = join(f, op.path);
      mkdirSync(resolve(path, '..'), { recursive: true });
      writeFileSync(path, op.value);
    }
    assert.deepEqual(comparePackagedRuntime(generated, native), []);
    writeFileSync(join(f, runtime[0].path), 'stale runtime');
    assert.match(comparePackagedRuntime(generated, native)[0], /differs/);
  } finally {
    rmSync(f, { recursive: true, force: true });
  }
});

test('every missing packaged dependency is visible and cannot trap Stop in a retry loop', () => {
  const ops = emitCodex(model, root);
  const runtime = ops.filter((o) =>
    o.path.startsWith('codex-contributor-plugin/runtime/'),
  );
  const hooks = ops.find((o) => o.path.endsWith('hooks/hooks.json')).value
    .hooks;
  const f = realpathSync(mkdtempSync(join(tmpdir(), 'codex-partial-package-')));
  try {
    spawnSync('git', ['init', '-q', f]);
    mkdirSync(join(f, '.ai-factory'));
    writeFileSync(join(f, '.ai-factory/harness-model.json'), '{}');
    for (const missing of runtime) {
      for (const op of runtime) {
        const p = join(f, op.path);
        mkdirSync(resolve(p, '..'), { recursive: true });
        writeFileSync(p, op.value);
      }
      unlinkSync(join(f, missing.path));
      const invoke = (command, active) =>
        spawnSync('sh', ['-c', command], {
          cwd: f,
          env: {
            ...process.env,
            PLUGIN_ROOT: join(f, 'codex-contributor-plugin'),
          },
          input: JSON.stringify({
            cwd: f,
            hook_event_name: 'Stop',
            stop_hook_active: active,
          }),
          encoding: 'utf8',
        });
      assert.equal(
        invoke(hooks.PreToolUse[0].hooks[0].command, false).status,
        2,
        missing.path,
      );
      for (const active of [false, true]) {
        const r = invoke(hooks.Stop[0].hooks[0].command, active);
        assert.equal(r.status, 0, missing.path);
        assert.match(r.stderr, /missing packaged/);
      }
    }
  } finally {
    rmSync(f, { recursive: true, force: true });
  }
});
