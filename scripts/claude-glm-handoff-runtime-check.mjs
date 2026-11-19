// Check the greeting audit's actual drafted prompt, not the skill source.
/**
 * claude-glm-handoff-runtime-check — asserts the drafted greeting-audit worker prompt keeps unknowns disclosed, REPORT ownership and independent review.
 *
 * Usage: node scripts/claude-glm-handoff-runtime-check.mjs <native-result.txt|json>
 */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

let response = readFileSync(process.argv[2], 'utf8');
if (process.argv[2].endsWith('.json')) response = JSON.parse(response).result;
const block = (name) => {
  const value = response.match(new RegExp(`<${name}>\\s*([\\s\\S]*?)</${name}>`))?.[1];
  assert.ok(value, `Missing actual ${name} block`);
  return value;
};
for (const name of ['task', 'context', 'constraints', 'tools', 'output', 'verify']) block(name);
const context = block('context');
const verify = block('verify');
const output = block('output');
const failures = [];
if (!/unknown|not (?:provided|supplied|observed|inspected)|uninspected|unavailable/i.test(context))
  failures.push('Context must disclose unobserved source/test contents in this input');
if (/exports a greet function|test file asserts the greeting prefix/i.test(context))
  failures.push('Context fabricates function/test observations absent from the input');
if (!/independent[\s\S]{0,180}(?:reviewer|review|verifier|verification)|(?:reviewer|review|verifier)[\s\S]{0,180}independent/i.test(verify))
  failures.push('Worker prompt lacks an independent review acceptance requirement');
if (!/orchestrator-worker-discipline/i.test(output))
  failures.push('Output must refer to its REPORT owner');
if (/Deliverable:\s*<[^>]+>[\s\S]*Evidence:\s*<[^>]+>[\s\S]*BLOCKER:/i.test(output))
  failures.push('Worker prompt reconstructs a second REPORT schema');
assert.deepEqual(failures, [], failures.join('\n'));
console.log('PASS: actual six-block draft preserves unknowns, REPORT ownership and independent review');
