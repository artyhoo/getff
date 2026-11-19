// Offline acceptance of the retained live template-audit executions. This does
// not call an LLM and does not infer behavior from discovery or final prose alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const receipts = resolve(root, 'docs/superpowers/plans/2026-10-09-skill-template-audit-runtime-audit.receipts');
const read = name => readFileSync(resolve(receipts, name), 'utf8');
const json = name => JSON.parse(read(name));
const rows = name => read(name).trim().split('\n').map(JSON.parse);
const command = 'npm --prefix packages/core run test:template-render';
const completed = name => rows(name).filter(o => o.type === 'item.completed').map(o => o.item);

// Mutation: deleting the failed event or changing its status to success must
// reject the receipt. Failed executions complete with status "failed", so a
// parser must select item.completed events rather than only status "completed".
test('a real failed runner is evidenced by its rollout, not invented from final text', () => {
  for (const name of ['framework-missing-deps', 'framework-helper-failure']) {
    const events = json(`${name}.codex.rollout-runner.json`).events;
    const runner = events.map(o => o.payload.item).find(i => i.command?.at(-1) === command);
    assert.ok(runner, `missing executed runner for ${name}`);
    assert.equal(runner.exit_code, 127);
    assert.equal(runner.status, 'failed');
    assert.match(runner.stdout, /vitest: command not found/);
    assert.match(runner.cwd, /audit-template-audit\/rules-as-tests-aif$/);
    const cliRunner = completed(`${name}.codex.jsonl`).find(i => i.type === 'command_execution' && i.command.includes(command));
    assert.ok(cliRunner);
    assert.equal(cliRunner.status, 'failed');
    assert.equal(cliRunner.exit_code, runner.exit_code);
    assert.equal(cliRunner.aggregated_output, runner.aggregated_output);
  }
});

// Mutation: removing the runner event, substituting a source-read command, or
// replacing its exit code with a failure must reject the successful workflow.
test('the positive native workflow executed the actual framework runner', () => {
  const runner = completed('framework-positive.codex.jsonl').find(i => i.type === 'command_execution' && i.command.includes(command));
  assert.ok(runner);
  assert.equal(runner.exit_code, 0);
  assert.match(runner.aggregated_output, /Tests\s+9 passed/);
  const output = completed('framework-positive.codex.jsonl').filter(i => i.type === 'command_execution').map(i => i.aggregated_output).join('\n');
  assert.match(output, /consumer\/AGENTS\.md/);
  assert.match(output, /earliest reachable channel/);
});

// Mutation: an installer failure, missing canonical payload, or a customized
// Claude twin makes the claimed consumer delivery proof fail.
test('one-command delivery and refresh retain full canonical bytes for Claude', () => {
  assert.equal(read('install-fixed.exit').trim(), '0');
  assert.equal(read('refresh-final.exit').trim(), '0');
  const canonical = read('consumer-fixed/.agents/procedures/template-audit/SKILL.md');
  assert.equal(read('consumer-fixed/.claude/skills/template-audit/SKILL.md'), canonical);
  assert.match(read('consumer-fixed/.agents/skills/template-audit/SKILL.md'), /\.\.\/\.\.\/procedures\/template-audit\/SKILL\.md/);
});

// Mutation: reading another cwd's fixture, skipping a supplied file, or omitting
// the root helper execution invalidates the binding receipt. Advisory semantics
// still require the documented manual review of the complete live output.
test('the final nested Codex invocation reads bound targets and reaches root checks', () => {
  const items = completed('consumer-adverse-postfix.codex.jsonl');
  const commands = items.filter(i => i.type === 'command_execution');
  const evidence = commands.map(i => i.command + '\n' + i.aggregated_output).join('\n');
  for (const name of ['faithful.md', 'guidelines.md', 'late-cue.md', 'forged-receipt.md', 'missing.md']) assert.ok(evidence.includes(name), `no observed input ${name}`);
  const check = commands.find(i => i.command.includes('audit-ai-docs.sh') && i.aggregated_output.includes('6 PASS'));
  assert.ok(check);
  assert.equal(check.exit_code, 0);
  assert.match(check.aggregated_output, /0 FAIL/);
});
