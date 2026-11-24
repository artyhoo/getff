// Read-only researcher input preflight. Shared canonical role owns its workflow.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const [consumer, checkout, stack] = process.argv.slice(2);
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stack)) {
  console.error('Invalid stack slug'); process.exit(3);
}
const installedCli = join(consumer, '.agents/tools/install/rule-bootstrap-cli.bundle.mjs');
const sourceCli = checkout && join(checkout, 'packages/core/install/rule-bootstrap-cli.bundle.mjs');
const cli = existsSync(installedCli) ? installedCli : sourceCli;
if (!cli || !existsSync(cli)) {
  console.error('UNVERIFIED: missing installed or framework bundled CLI prerequisite'); process.exit(2);
}
const installedGate = join(consumer, '.agents/tools/validator/gate-single-token-diff.ts');
const sourceGate = checkout && join(checkout, 'packages/core/validator/gate-single-token-diff.ts');
const gate = existsSync(installedGate) ? installedGate : sourceGate;
if (!gate || !existsSync(gate)) {
  console.error('Example gate UNVERIFIED: missing installed or framework Gate 7 prerequisite'); process.exit(2);
}
const planFile = join(consumer, `.ai-factory/rules-research/${stack}.research.json`);
const selectionFile = join(consumer, `.ai-factory/rules-research/${stack}.selection.json`);
let plan, selection;
try {
  JSON.parse(readFileSync(join(consumer, 'package.json'), 'utf8'));
  plan = JSON.parse(readFileSync(planFile, 'utf8'));
  selection = JSON.parse(readFileSync(selectionFile, 'utf8'));
} catch (error) {
  console.error(`Research input rejected: ${error.message}`); process.exit(3);
}
if (!Array.isArray(plan.patterns) || !Array.isArray(selection.rules) || selection.rules.some(rule =>
  rule.presence !== 'forbid' || typeof rule.selector !== 'string' || !rule.selector.trim() ||
  typeof rule.entryId !== 'string' || typeof rule.ruleId !== 'string' ||
  typeof rule.examples?.bad !== 'string' || typeof rule.examples?.good !== 'string' ||
  !Array.isArray(rule.negativeTest?.input) || !rule.negativeTest.input.length ||
  !plan.patterns.some(entry => entry.id === rule.entryId))) {
  console.error('Non-executable selection: keep research-only entries in research.patterns, not selection.rules');
  process.exit(3);
}
const checked = spawnSync(process.execPath, [cli, '--consumer-root', consumer,
  '--check-plan', planFile, '--from-selection', selectionFile], { encoding: 'utf8', cwd: consumer });
process.stdout.write(checked.stdout ?? '');
process.stderr.write(checked.stderr ?? '');
if (checked.error || checked.status !== 0) {
  if (checked.error) console.error(checked.error.message);
  process.exit(checked.status ?? 2);
}
const result = JSON.parse(checked.stdout);
const selected = new Set(selection.rules.map(rule => rule.entryId));
const expectedResearchOnly = plan.patterns.filter(entry => !selected.has(entry.id)).map(entry => entry.id).sort();
if (!Array.isArray(result.dropped) || result.dropped.length ||
  !Array.isArray(result.kept) || plan.patterns.some(entry => !result.kept.includes(entry.id)) ||
  !Array.isArray(result.researchOnly) ||
  JSON.stringify([...result.researchOnly].sort()) !== JSON.stringify(expectedResearchOnly)) {
  console.error('Research validation rejected: inspect dropped/kept/researchOnly; exit 0 alone is not PASS');
  process.exit(3);
}
const { runSingleTokenDiffGate } = await import(pathToFileURL(gate).href);
const exampleResult = runSingleTokenDiffGate({ rules: selection.rules.map(rule => ({
  id: rule.ruleId, check: { type: 'declarative', engine: 'eslint-restricted' }, examples: rule.examples,
})) });
console.log(JSON.stringify(exampleResult));
process.exit(exampleResult.status === 'fail' ? 1 : 0);
