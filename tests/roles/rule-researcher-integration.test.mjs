import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { runSingleTokenDiffGate } from '../../packages/core/validator/gate-single-token-diff.ts';

const repo = resolve(import.meta.dirname, '../..');
const owner = readFileSync(join(repo, '.agents/roles/rule-researcher.md'), 'utf8');
const probe = /<!-- synthesis-preflight:start -->\s*```bash\n([\s\S]*?)\n```\s*<!-- synthesis-preflight:end -->/.exec(owner)?.[1];
// The production change is the canonical role's executable handoff preflight. Removing its
// consumer cd or swallowing the real bundled validator failure must turn these cases RED.
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'rule-researcher runtime '));
  mkdirSync(join(root, '.ai-factory/rules-research'), { recursive: true });
  mkdirSync(join(root, 'nested')); // caller cwd deliberately differs from the consumer root
  writeFileSync(join(root, 'package.json'), '{"name":"research-consumer","dependencies":{"next":"16.0.0"}}');
  const stem = join(root, '.ai-factory/rules-research/react-next');
  writeFileSync(`${stem}.research.json`, readFileSync(join(repo, 'packages/core/synthesizer/fixtures/react-next-complete-example.research.json')));
  // The historical factory fixture also contains a selector-less fallback candidate.
  // The researcher contract permits only its actual executable no-head candidate.
  const selection = JSON.parse(readFileSync(join(repo, 'packages/core/synthesizer/fixtures/react-next-complete-example.selection.json'), 'utf8'));
  const rules = selection.rules.filter(rule => rule.entryId === 'next-no-head-element');
  rules[0].examples = { bad: "import Head from 'next/head'; export { Head }; export default function Page() { return <head />; }", good: "import Head from 'next/head'; export { Head }; export default function Page() { return <Head />; }" };
  writeFileSync(`${stem}.selection.json`, JSON.stringify({ rules }));
  return { root, stem };
}
function run(f, overrides = {}) {
  assert.ok(probe, 'canonical role must provide the runnable consumer-bound synthesis preflight');
  return spawnSync('bash', ['-c', probe], {
    cwd: join(f.root, 'nested'), encoding: 'utf8',
    env: { ...process.env, CONSUMER_ROOT: f.root, GETFF_CHECKOUT: repo, STACK: 'react-next', ...overrides },
  });
}
function withFixture(fn) { const f = fixture(); try { fn(f); } finally { rmSync(f.root, {recursive:true,force:true}); } }

test('handoff validates real inputs from an explicitly bound consumer despite nested caller cwd', () => withFixture(f => {
  const p = run(f); assert.equal(p.status, 0, p.stderr);
  assert.match(p.stdout, /next-no-head-element/);
}));
test('malformed research fails with the bundled helper exit instead of successful handoff', () => withFixture(f => {
  writeFileSync(`${f.stem}.research.json`, '{broken');
  const p = run(f); assert.equal(p.status, 3); assert.match(p.stderr, /invalid|unreadable|rejected/i);
}));
test('off-allowlist provenance is rejected rather than authorized by its claimed key', () => withFixture(f => {
  const plan = JSON.parse(readFileSync(`${f.stem}.research.json`, 'utf8'));
  for (const entry of plan.patterns) entry.provenance[0].url = 'https://example.invalid/poison';
  writeFileSync(`${f.stem}.research.json`, JSON.stringify(plan));
  const p = run(f); assert.equal(p.status, 3, p.stderr);
  const result = JSON.parse(p.stdout);
  assert.equal(result.dropped.length, plan.patterns.length);
  assert.ok(result.dropped.every(entry => /not allowed/.test(entry.reason)));
  assert.equal(result.researchOnly.length, 0);
}));
test('missing consumer never falls back to the framework checkout', () => withFixture(f => {
  const p = run(f, { CONSUMER_ROOT: join(f.root, 'absent') });
  assert.equal(p.status, 2); assert.match(p.stderr, /consumer/i);
}));
test('missing external setup and bundled helper refuse with explicit prerequisite diagnostic', () => withFixture(f => {
  const p = run(f, { GETFF_CHECKOUT: f.root });
  assert.equal(p.status, 2); assert.match(p.stderr, /resource|CLI|prerequisite/i);
}));

test('research-only cross-file entries cannot leak into executable selection candidates', () => withFixture(f => {
  const selection = JSON.parse(readFileSync(`${f.stem}.selection.json`, 'utf8'));
  selection.rules.push({entryId:'next-server-only-boundary',ruleId:'server-boundary',stack:['react-next'],examples:{bad:'bad',good:'good'}});
  writeFileSync(`${f.stem}.selection.json`, JSON.stringify(selection));
  const p = run(f); assert.equal(p.status, 3); assert.match(p.stderr, /non-executable selection/i);
}));

test("the role's replacement example passes the real single-token-diff gate", () => {
  const section = owner.slice(owner.indexOf('### `GenerateSelection` shape'));
  const fence = /```jsonc\n([\s\S]*?)\n```/.exec(section);
  const selection = JSON.parse(fence[1].replace(/\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1'));
  const result = runSingleTokenDiffGate({rules:selection.rules.map(rule => ({
    id:rule.ruleId,check:{type:'declarative',engine:'eslint-restricted'},examples:rule.examples,
  }))});
  assert.equal(result.status, 'pass'); assert.deepEqual(result.failures, []);
});

test('a missing bundled helper is distinct from missing framework setup', () => withFixture(f => {
  writeFileSync(join(f.root, 'setup'), '#!/bin/bash\n');
  const p = run(f, {GETFF_CHECKOUT:f.root});
  assert.equal(p.status, 2); assert.match(p.stderr, /resource|CLI prerequisite/);
}));

test('provenance tier defect is rejected even when real CLI exits zero', () => withFixture(f => {
  const plan = JSON.parse(readFileSync(`${f.stem}.research.json`, 'utf8'));
  for (const entry of plan.patterns) entry.provenance[0].tier = 'builtin';
  writeFileSync(`${f.stem}.research.json`, JSON.stringify(plan));
  const raw = spawnSync('node', [join(repo, 'packages/core/install/rule-bootstrap-cli.bundle.mjs'),
    '--consumer-root', f.root, '--check-plan', `${f.stem}.research.json`, '--from-selection', `${f.stem}.selection.json`], {encoding:'utf8'});
  assert.equal(raw.status, 0, raw.stderr);
  assert.ok(JSON.parse(raw.stdout).dropped.every(entry => /FF1001/.test(entry.reason)));
  const result = run(f); assert.equal(result.status, 3, result.stderr);
  assert.match(result.stderr, /exit 0 alone is not PASS/);
}));

test('missing selection entry ID refuses before a ready-input claim', () => withFixture(f => {
  const selection = JSON.parse(readFileSync(`${f.stem}.selection.json`, 'utf8'));
  selection.rules[0].entryId = 'absent';
  writeFileSync(`${f.stem}.selection.json`, JSON.stringify(selection));
  const result = run(f); assert.equal(result.status, 3); assert.match(result.stderr, /Non-executable selection/);
}));

test('observed good-only import remains FF3011 despite successful provenance validation', () => withFixture(f => {
  const selection = JSON.parse(readFileSync(`${f.stem}.selection.json`, 'utf8'));
  selection.rules[0].examples = {
    bad: 'export default function Page() {\n return (\n <head>\n <title>Orders</title>\n </head>\n );\n}\n',
    good: "import Head from 'next/head';\n export default function Page() {\n return (\n <Head>\n <title>Orders</title>\n </Head>\n );\n}\n",
  };
  writeFileSync(`${f.stem}.selection.json`, JSON.stringify(selection));
  const result = run(f); assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /FF3011/);
}));

test('missing Gate 7 is a distinct prerequisite failure', () => withFixture(f => {
  mkdirSync(join(f.root, 'packages/core/install'), {recursive:true});
  writeFileSync(join(f.root, 'packages/core/install/rule-bootstrap-cli.bundle.mjs'), '');
  mkdirSync(join(f.root,'.agents/roles/resources/rule-researcher'),{recursive:true});
  copyFileSync(join(repo,'.agents/roles/resources/rule-researcher/preflight.mjs'),join(f.root,'.agents/roles/resources/rule-researcher/preflight.mjs'));
  const result = run(f, {GETFF_CHECKOUT:f.root});
  assert.equal(result.status, 2); assert.match(result.stderr, /Gate 7 prerequisite/);
}));

test('malformed supplied manifest refuses instead of falling back to framework package', () => withFixture(f => {
  writeFileSync(join(f.root, 'package.json'), '{broken');
  const result = run(f); assert.equal(result.status, 3); assert.match(result.stderr, /Research input rejected/);
}));

test('the valid read-only preflight leaves both inputs and manifest unchanged', () => withFixture(f => {
  const paths = [join(f.root, 'package.json'), `${f.stem}.research.json`, `${f.stem}.selection.json`];
  const before = paths.map(path => readFileSync(path, 'utf8'));
  assert.equal(run(f).status, 0);
  assert.deepEqual(paths.map(path => readFileSync(path, 'utf8')), before);
}));

function deliverReadOnlyTools(f) {
  mkdirSync(join(f.root, '.agents/roles/resources/rule-researcher'), {recursive:true});
  copyFileSync(join(repo, '.agents/roles/resources/rule-researcher/preflight.mjs'), join(f.root, '.agents/roles/resources/rule-researcher/preflight.mjs'));

  const files = [
    'install/rule-bootstrap-cli.bundle.mjs',
    'research/research-plan.schema.json',
    'research/research-allowlist.schema.json',
    'research/multi-tenant-hosts.json',
    'ir/convention-node.schema.json',
    'synthesizer/synthesis-plan.schema.json',
    'validator/gate-single-token-diff.ts',
  ];
  for (const file of files) {
    const target = join(f.root, '.agents/tools', file);
    mkdirSync(resolve(target, '..'), {recursive:true});
    copyFileSync(join(repo, 'packages/core', file), target);
  }
}

test('installed read-only helper closure runs without a framework checkout', () => withFixture(f => {
  deliverReadOnlyTools(f);
  const result = run(f, {GETFF_CHECKOUT:''});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /next-no-head-element/);
  assert.match(result.stdout, /"status":"pass"/);
}));

test('installed helper missing its schema fails rather than fallback silently', () => withFixture(f => {
  deliverReadOnlyTools(f);
  rmSync(join(f.root, '.agents/tools/research/research-plan.schema.json'));
  const result = run(f);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /ENOENT.*research-plan.schema.json/s);
}));

test('audit-rule-researcher fixed records retain two practices and one research-only boundary', () => withFixture(f => {
  const stem = join(f.root, '.ai-factory/rules-research/ts-server');
  for (const kind of ['research','selection']) copyFileSync(join(repo,
    `tests/roles/fixtures/rule-researcher/fixed-ts-server.${kind}.json`), `${stem}.${kind}.json`);
  const result = run(f, {STACK:'ts-server'});
  assert.equal(result.status, 0, result.stderr);
  const checked = JSON.parse(result.stdout.slice(0, result.stdout.lastIndexOf('\n{"status"')));
  assert.equal(checked.kept.length, 2);
  assert.deepEqual(checked.dropped, []);
  assert.equal(checked.researchOnly.length, 1);
}));

test('audit-rule-researcher original invalid provenance preserves FF1001 records', () => withFixture(f => {
  const stem = join(f.root, '.ai-factory/rules-research/ts-server');
  for (const kind of ['research','selection']) copyFileSync(join(repo,
    `tests/roles/fixtures/rule-researcher/baseline-ts-server.${kind}.json`), `${stem}.${kind}.json`);
  const result = run(f, {STACK:'ts-server'});
  assert.equal(result.status, 3, result.stderr);
  const checked = JSON.parse(result.stdout);
  assert.equal(checked.kept.length, 0);
  assert.equal(checked.dropped.length, 2);
  assert.ok(checked.dropped.every(entry => /FF1001.*additionalProperties/.test(entry.reason)));
}));

const handoff = /<!-- rule-researcher:consumer-handoff -->\s*```bash\n([\s\S]*?)```/.exec(owner)?.[1];
function handoffFixture(f, {missing = false, status = 0} = {}) {
  const checkout = join(f.root, 'framework with spaces');
  mkdirSync(checkout);
  if (!missing) writeFileSync(join(checkout, 'install.sh'), `#!/bin/bash\nprintf '%s\\n' "$PWD" "$@"\nexit ${status}\n`);
  assert.ok(handoff);
  return spawnSync('bash', ['-c', handoff], {cwd:join(f.root,'nested'),encoding:'utf8',
    env:{...process.env,CONSUMER_ROOT:f.root,GETFF_CHECKOUT:checkout,STACK:'react-next'}});
}
test('installer handoff preserves consumer cwd and space paths', () => withFixture(f => {
  const result = handoffFixture(f);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${f.root}\nreact-next\n--full\n`);
}));
test('installer handoff prerequisite and rejection preserve nonzero exits', () => withFixture(f => {
  const missing = handoffFixture(f,{missing:true});
  assert.equal(missing.status, 2); assert.match(missing.stderr,/Missing getff installer prerequisite/);
  rmSync(join(f.root,'framework with spaces'),{recursive:true});
  assert.equal(handoffFixture(f,{status:23}).status,23);
}));


test('installed preflight resource is mandatory without source checkout fallback', () => withFixture(f => {
  deliverReadOnlyTools(f);
  rmSync(join(f.root, '.agents/roles/resources/rule-researcher/preflight.mjs'));
  const result = run(f, {GETFF_CHECKOUT:''});
  assert.equal(result.status, 2); assert.match(result.stderr, /preflight resource/);
}));

test('bound argv resource runs through zsh with filesystem writes denied and /dev/null allowed', {skip: !existsSync('/usr/bin/sandbox-exec')}, () => withFixture(f => {
  deliverReadOnlyTools(f);
  const p = spawnSync('/usr/bin/sandbox-exec', ['-p', '(version 1)(allow default)(deny file-write*)(allow file-write* (literal "/dev/null"))', '/bin/zsh', '-c', probe], {
    cwd: join(f.root,'nested'),encoding:'utf8',
    env:{...process.env,CONSUMER_ROOT:f.root,GETFF_CHECKOUT:'',STACK:'react-next'},
  });
  assert.equal(p.status, 0, p.stderr);
  assert.match(p.stdout, /"status":"pass"/);
}));
