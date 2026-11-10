import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const helper = resolve(
  import.meta.dirname,
  '../.agents/procedures/pipeline/helpers/render-status.sh',
);
function probe(ghBody) {
  const root = mkdtempSync(join(tmpdir(), 'pipeline-status-'));
  try {
    writeFileSync(join(root, 'gh'), '#!/bin/sh\n' + ghBody + '\n', {
      mode: 0o755,
    });
    writeFileSync(join(root, 'curl'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    return spawnSync('bash', [helper], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PATH: root + ':' + process.env.PATH },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test('failed PR query is unknown, never no open PRs', () => {
  const result = probe('exit 1');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /PR status unknown/);
  assert.doesNotMatch(result.stdout, /no open PRs/);
});
test('successful empty PR response is reported as empty', () => {
  assert.match(probe("echo '[]'").stdout, /no open PRs/);
});
test('mergeability alone offers check inspection, not a merge command', () => {
  const result = probe(
    `echo '[{"number":77,"title":"Alpha","headRefName":"feat/alpha","baseRefName":"staging","mergeable":"MERGEABLE","state":"OPEN"}]'`,
  );
  assert.match(result.stdout, /gh pr checks 77/);
  assert.doesNotMatch(result.stdout, /gh pr merge/);
});
test('healthy endpoint plus failed tasks endpoint stays unknown, not idle', () => {
  const root = mkdtempSync(join(tmpdir(), 'pipeline-task-failure-'));
  try {
    writeFileSync(
      join(root, 'curl'),
      '#!/bin/sh\ncase "$*" in *health*) echo "{}";; *) exit 1;; esac\n',
      { mode: 0o755 },
    );
    writeFileSync(join(root, 'gh'), '#!/bin/sh\necho "[]"\n', { mode: 0o755 });
    const result = spawnSync('bash', [helper], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PATH: root + ':' + process.env.PATH },
    });
    assert.match(result.stdout, /factory task status unknown/);
    assert.doesNotMatch(result.stdout, /no running aif tasks|in-factory empty/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('rich question probe failure never certifies absence of parked review tasks', () => {
  const root = mkdtempSync(join(tmpdir(), 'pipeline-parked-failure-'));
  try {
    mkdirSync(join(root, 'packages/runtime-bridge/src/cli'), {
      recursive: true,
    });
    writeFileSync(
      join(root, 'packages/runtime-bridge/src/cli/questions.ts'),
      '',
    );
    writeFileSync(join(root, 'npx'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    writeFileSync(
      join(root, 'curl'),
      `#!/bin/sh
case "$*" in *health*) echo '{}';; *) cat <<'JSON'
[{"id":"x","title":"X","status":"review","paused":true,"plan":"## ⏸ OPEN QUESTION (awaiting operator)\n\nPick A or B"}]
JSON
;; esac
`,
      { mode: 0o755 },
    );
    writeFileSync(join(root, 'gh'), '#!/bin/sh\necho "[]"\n', { mode: 0o755 });
    const result = spawnSync('bash', [helper], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PATH: root + ':' + process.env.PATH },
    });
    assert.match(result.stdout, /parked question status unknown/);
    assert.doesNotMatch(result.stdout, /no parked questions|all bricks green/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function tasksProbe(tasks) {
  const root = mkdtempSync(join(tmpdir(), 'pipeline-status-current-'));
  try {
    writeFileSync(join(root, 'tasks.json'), JSON.stringify(tasks));
    writeFileSync(
      join(root, 'curl'),
      '#!/bin/sh\ncase "$*" in *health*) echo "{}";; *) cat "' +
        join(root, 'tasks.json') +
        '";; esac\n',
      { mode: 0o755 },
    );
    writeFileSync(join(root, 'gh'), '#!/bin/sh\necho "[]"\n', { mode: 0o755 });
    return spawnSync('bash', [helper], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PATH: root + ':' + process.env.PATH },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test('status summarizes terminal history and retains current task identity without review dumps', () => {
  const result = tasksProbe([
    { id: 'done-id', title: 'Historical completed task', status: 'done' },
    {
      id: 'verified-id',
      title: 'Historical verified task',
      status: 'verified',
    },
    {
      id: 'current-id',
      projectId: 'project-id',
      title: 'Current work',
      status: 'review',
      manualReviewRequired: true,
      reviewComments: 'UNBOUND_REVIEW_BODY'.repeat(20000),
    },
    { id: 'future-id', title: 'New status retained', status: 'future_unknown' },
  ]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Terminal history: 2/);
  assert.match(result.stdout, /current-id/);
  assert.match(result.stdout, /project-id/);
  assert.match(result.stdout, /future_unknown/);
  assert.doesNotMatch(
    result.stdout,
    /Historical completed task|UNBOUND_REVIEW_BODY|answer parked question/,
  );
  assert.match(result.stdout, /parked question status unknown/);
  assert.ok(Buffer.byteLength(result.stdout) < 5000);
});
test('large current populations are explicitly truncated, never declared empty', () => {
  const result = tasksProbe(
    Array.from({ length: 60 }, (_, i) => ({
      id: 'active-' + i,
      title: 'Active task ' + i,
      status: 'implementing',
    })),
  );
  assert.equal(result.status, 0);
  assert.match(result.stdout, /40 additional current tasks/);
  assert.doesNotMatch(result.stdout, /no running aif tasks|in-factory empty/);
  assert.ok(Buffer.byteLength(result.stdout) < 10000);
});
