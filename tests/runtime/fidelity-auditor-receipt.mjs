// Validate actual fidelity-auditor output; this does not launch or certify a model.
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const output = readFileSync(process.argv[2], 'utf8');
const verdicts = [...output.matchAll(/^FIDELITY: (GO|REVISE|STOP)$/gm)];
assert.equal(verdicts.length, 1, 'exactly one machine-consumed verdict');
for (const field of ['Basis', 'Round', 'Audited-SHA', 'Evidence', 'Addenda']) {
  assert.match(output, new RegExp(`^${field}: .+`, 'm'), `required ${field} field`);
}
assert.match(output, /^Findings:(?:[ \t].*)?$/m, 'findings may continue on later lines');
assert.match(output, /^Evidence: .*\.[a-z]+:[1-9][0-9]*/m, 'file:line evidence');
assert.match(output, /^### Watch-list$/m, 'mandatory Watch-list');
const round = output.match(/^Round: ([1-9][0-9]*)$/m)?.[1];
assert.ok(round, 'positive round number');
const statusLine = output.match(new RegExp(`^Round ${round}: (.+)$`, 'm'))?.[1];
assert.ok(statusLine, 'Watch-list must record the current round, including round 1');
const ids = [...output.matchAll(/^\|\s*(W-[0-9]+)\s*\|/gm)].map((m) => m[1]);
assert.ok(ids.length, 'Watch-list has criteria');
for (const id of ids) {
  assert.match(statusLine, new RegExp(`\\b${id} (CLEAN|REINTRODUCED|N/A)\\b`), `status for ${id}`);
}
if (verdicts[0][1] !== 'GO') {
  assert.match(output, /Failure-scenario: .+/, 'rework has a concrete failure scenario');
  assert.match(output, /corpus-measured/, 'graded finding carries layer provenance');
  assert.match(output, /judgment-only, not corpus-validated/, 'graded finding carries whose provenance');
  assert.match(output, /measured null/, 'graded finding carries class provenance');
  assert.match(output, /layer=(idea|design|architecture|plan|implementation)\b/, 'layer uses the rubric vocabulary');
  assert.match(output, /whose=(reviewer|advisor|operator-floor)\b/, 'whose uses the rubric routing vocabulary');
}
console.log('PASS: verdict fields, evidence, watch-list and current-round statuses');
