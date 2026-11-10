import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const source = readFileSync(new URL('../../.agents/roles/living-docs-auditor.md', import.meta.url), 'utf8');
const section = title => source.split(title)[1].split('```bash\n')[1].split('```')[0];
for (const [name, status, output] of [['clean', 0, 'PASS: R1: hygiene'], ['violation', 1, 'FAIL: R1: hygiene'], ['crash', 37, 'helper crashed']]) {
  test(`canonical run preserves ${name} helper status and output`, () => {
    const cwd = mkdtempSync(join(tmpdir(), 'living-docs-test-'));
    try {
      mkdirSync(join(cwd, 'scripts'));
      writeFileSync(join(cwd, 'scripts/audit-ai-docs.sh'), `echo '${output}' >&2\nexit ${status}\n`);
      const code = `SCRIPT=scripts/audit-ai-docs.sh\n${section('### Step 3: Run audit')}\nprintf 'CAPTURED_EXIT=%s\\n' "$EXIT"\n`;
      const result = spawnSync('bash', ['-c', code], { cwd, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, new RegExp(`CAPTURED_EXIT=${status}(?:\\n|$)`));
      assert.ok(result.stdout.includes(output));
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });
}
test('missing helper guard does not terminate auxiliary checks', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'living-docs-test-'));
  try {
    const result = spawnSync('bash', ['-c', `SCRIPT=scripts/audit-ai-docs.sh\n${section('### Step 2: Verify the script exists')}\necho AUXILIARY_REACHED\n`], { cwd, encoding: 'utf8' });
    assert.match(result.stdout, /INFO:/);
    assert.match(result.stdout, /AUXILIARY_REACHED/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
test('rule drift extractor preserves the full declared filename', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'living-docs-test-'));
  try {
    mkdirSync(join(cwd, '.claude/rules'), { recursive: true });
    writeFileSync(join(cwd, '.claude/rules/present.md'), '# Present');
    writeFileSync(join(cwd, 'AGENTS.md'), 'Rule `.claude/rules/present.md` applies.\nRule `.claude/rules/missing.md` applies.\n');
    const result = spawnSync('bash', ['-c', section('### Rules declared vs existing')], { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "DRIFT: rule 'missing.md' declared but missing\n");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
test('unwritable log destination still runs helper and reaches auxiliary checks', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'living-docs-test-'));
  try {
    mkdirSync(join(cwd, 'scripts'));
    writeFileSync(join(cwd, 'scripts/audit-ai-docs.sh'), 'echo helper-crash >&2\nexit 37\n');
    const code = `SCRIPT=scripts/audit-ai-docs.sh\n${section('### Step 3: Run audit')}\nprintf 'CAPTURED_EXIT=%s\\n' "$EXIT"\necho AUXILIARY_REACHED\n`;
    const result = spawnSync('bash', ['-c', code], { cwd, env: { ...process.env, TMPDIR: join(cwd, 'absent-directory') }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /helper-crash/);
    assert.match(result.stdout, /CAPTURED_EXIT=37/);
    assert.match(result.stdout, /AUXILIARY_REACHED/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
