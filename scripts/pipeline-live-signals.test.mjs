import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const helper = resolve(
  import.meta.dirname,
  '../.agents/procedures/pipeline/helpers/priority-score.sh',
);
function probe(prs, fail = false) {
  const root = mkdtempSync(join(tmpdir(), 'pipeline-signals-'));
  try {
    mkdirSync(join(root, '.claude/orchestrator-prompts/alpha'), {
      recursive: true,
    });
    writeFileSync(
      join(root, '.claude/orchestrator-prompts/alpha/kickoff.md'),
      '# Alpha\n',
    );
    const gh = join(root, 'gh');
    writeFileSync(
      gh,
      fail
        ? '#!/bin/sh\nexit 1\n'
        : `#!/bin/sh\ncase "$*" in *'--state open'*) cat <<'JSON'\n${JSON.stringify(prs)}\nJSON\n;; *) echo '[]';; esac\n`,
      { mode: 0o755 },
    );
    return spawnSync('bash', [helper], {
      encoding: 'utf8',
      env: {
        ...process.env,
        REPO_ROOT: root,
        MO_GH_BIN: gh,
        MO_DUP_DETECT_BIN: '/nonexistent',
        MO_MEM_DIR: '/nonexistent',
        MO_PACKAGES_DIR: '/nonexistent',
        MO_PATCHES_DIR: '/nonexistent',
      },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test('open stage/task branch reports in-flight count; unrelated prefix stays out', () => {
  const result = probe([
    { number: 1, headRefName: 'feature/alpha-s2-aabbcc' },
    { number: 2, headRefName: 'feature/alphabet-aabbcc' },
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /alpha .*open_prs=1/);
});
test('failed GitHub probe is visible as unknown rather than open_prs=0', () => {
  const result = probe([], true);
  assert.match(result.stdout, /PROBE-INCOMPLETE/);
  assert.match(result.stdout, /alpha .*open_prs=unknown/);
});
test('successful empty GitHub response remains a known zero count', () => {
  assert.match(probe([]).stdout, /alpha .*open_prs=0/);
});
