import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..');
test('one core install delivers both interfaces and mandatory read-only role resources', t => {
  const dir = mkdtempSync(join(tmpdir(), 'consumer closure space '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.codex'), { recursive: true });
  const userConfig = '# user-owned\nmodel = "gpt-6.1-sol"\n';
  writeFileSync(join(dir, '.codex/config.toml'), userConfig);
  const install = (...flags) => spawnSync('bash', [join(root, 'setup'), 'generic', '--profile', 'core', ...flags],
    { cwd: dir, encoding: 'utf8', input: '', timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
  let r = install(); assert.equal(r.status, 0, r.stderr + r.stdout);
  for (const file of ['.claude/agents/docs-form-auditor.md', '.agents/skills/docs-form-auditor/SKILL.md',
    '.codex/hooks.json', '.agents/roles/resources/docs-form-auditor/check-report.mjs',
    '.agents/roles/resources/docs-form-auditor/criteria-card.md',
    'scripts/docs-check.mjs', 'scripts/lib/mermaid-allowlist.mjs', 'docs/site-quality/vale/.vale.ini',
    '.agents/tools/docs/markdownlint-cli2.bundle.mjs',
    '.agents/tools/install/rule-bootstrap-cli.bundle.mjs', '.agents/tools/validator/gate-single-token-diff.ts',
    '.agents/tools/research/research-plan.schema.json', '.agents/tools/research/research-allowlist.schema.json',
    '.agents/tools/research/multi-tenant-hosts.json', '.agents/tools/ir/convention-node.schema.json',
    '.agents/tools/synthesizer/synthesis-plan.schema.json']) assert.ok(existsSync(join(dir, file)), file);
  assert.ok(!existsSync(join(dir, '.agents/procedures/docs-author/SKILL.md')), 'support data does not promote contributor workflow');
  assert.ok(!existsSync(join(dir, '.agents/tools/runtime-bridge/src/cli/park.ts')), 'factory capability stays gated');
  assert.equal(readFileSync(join(dir, '.codex/config.toml'), 'utf8'), userConfig);
  const checker = join(dir, 'scripts/docs-check.mjs');
  r = spawnSync('node', [checker, '--help'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.error, undefined);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stderr, /header comment of scripts\/docs-check\.mjs for the full contract/);
  const lint = join(dir, '.agents/tools/docs/markdownlint-cli2.bundle.mjs');
  const page = join(dir, 'lint fixture with spaces.md');
  writeFileSync(page, '# Good\n\nPlain text.\n');
  const runLint = () => spawnSync('node', [lint, page], { cwd: dir, encoding: 'utf8' });
  r = runLint(); assert.equal(r.status, 0, r.stderr + r.stdout);
  writeFileSync(page, '#Bad\nText\n');
  r = runLint(); assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.match(r.stderr + r.stdout, /MD018|MD041/);
  mkdirSync(join(dir, 'docs/site/guides'), { recursive: true });
  writeFileSync(join(dir, 'docs/site/guides/lint.md'), '#Bad\nText\n');
  const nested = join(dir, 'nested cwd with spaces');
  mkdirSync(nested);
  const runStrict = () => spawnSync('node', [checker, '--strict', '--json', join(dir, 'docs/site/guides/lint.md')],
    { cwd: nested, encoding: 'utf8' });
  r = runStrict(); assert.equal(r.status, 1, r.stderr + r.stdout);
  let findings = JSON.parse(r.stdout);
  assert.equal(findings.populations.pages.length, 1, 'an absolute file alias from nested cwd stays in the bound population');
  assert.ok(findings.errors.some(e => e.rule === 'markdownlint'),
    'the real installed docs gate must execute its delivered linter, even if other checks fail');
  const declared = '{"devDependencies":{"markdownlint-cli2":"0.0.0-fixture"}}\n';
  writeFileSync(join(dir, 'package.json'), declared);
  r = runStrict(); assert.equal(r.status, 1, r.stderr + r.stdout);
  findings = JSON.parse(r.stdout);
  assert.ok(findings.errors.some(e => e.file === '(markdownlint)' && e.rule === 'docs-check.tool-absent'),
    'an unavailable declared project version must not silently fall back to the framework version');
  const projectTool = join(dir, 'node_modules/markdownlint-cli2');
  mkdirSync(join(projectTool, 'dist'), { recursive: true });
  mkdirSync(join(projectTool, 'bin'), { recursive: true });
  writeFileSync(join(projectTool, 'package.json'), JSON.stringify({ name: 'markdownlint-cli2',
    version: '0.0.0-fixture', type: 'module', exports: './dist/index.mjs',
    bin: { 'markdownlint-cli2': './bin/project-owned.mjs' } }));
  writeFileSync(join(projectTool, 'dist/index.mjs'), 'export {};\n');
  writeFileSync(join(projectTool, 'bin/project-owned.mjs'),
    'process.stderr.write("PROJECT_SELECTED_CLI_FIXTURE\\n"); process.exit(17);\n');
  r = runStrict(); assert.equal(r.status, 1, r.stderr + r.stdout);
  findings = JSON.parse(r.stdout);
  assert.ok(findings.errors.some(e => e.message.includes('PROJECT_SELECTED_CLI_FIXTURE')),
    'project bin metadata, including a different layout, wins over the framework fallback');
  for (const bin of ['.', '..', '', './dist']) {
    writeFileSync(join(projectTool, 'package.json'), JSON.stringify({ name: 'markdownlint-cli2',
      version: '0.0.0-fixture', type: 'module', exports: './dist/index.mjs', main: './dist/index.mjs',
      bin: { 'markdownlint-cli2': bin } }));
    r = runStrict(); assert.equal(r.status, 1, r.stderr + r.stdout);
    findings = JSON.parse(r.stdout);
    assert.ok(findings.errors.some(e => e.file === '(markdownlint)' && e.rule === 'docs-check.tool-absent'),
      `invalid project CLI ${JSON.stringify(bin)} must not run the API directory as a clean lint`);
  }
  writeFileSync(join(projectTool, 'package.json'), JSON.stringify({ name: 'markdownlint-cli2',
    version: '0.0.0-fixture', type: 'module', exports: './dist/index.mjs',
    bin: { 'markdownlint-cli2': './bin/project-owned.mjs' } }));
  writeFileSync(join(projectTool, 'dist/package.json'), 'null\n');
  r = runStrict(); assert.equal(r.status, 1, r.stderr + r.stdout);
  findings = JSON.parse(r.stdout);
  assert.ok(findings.errors.some(e => e.file === '(markdownlint)' && e.rule === 'docs-check.tool-absent'),
    'a non-object nearer package manifest preserves the structured failure contract');
  rmSync(join(projectTool, 'dist/package.json'));
  writeFileSync(join(dir, 'package.json'), 'null\n');
  r = runStrict(); assert.equal(r.status, 1, r.stderr + r.stdout);
  findings = JSON.parse(r.stdout);
  assert.ok(findings.errors.some(e => e.file === '(markdownlint)' && e.rule === 'docs-check.tool-absent'),
    'a non-object project manifest preserves the machine-readable strict failure contract');
  writeFileSync(join(dir, 'package.json'), declared);
  const lintConfig = '{"default":false,"MD018":false,"MD041":false}\n';
  writeFileSync(join(dir, '.markdownlint.json'), lintConfig);
  r = runLint(); assert.equal(r.status, 0, r.stderr + r.stdout);
  writeFileSync(checker, '// consumer customization\n');
  writeFileSync(`${checker}.override.md`, '# Consumer-owned docs checker\n');
  r = install('--refresh'); assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /Mode: --refresh \(framework-owned artefacts; consumer files preserved\)/,
    'the documented setup entry must reach the refresh lane, not silently repeat install');
  assert.doesNotMatch(r.stdout, /▶ Companions|▶ Runtime-bridge/,
    'project refresh must not invoke machine companion or runtime setup');
  assert.equal(readFileSync(checker, 'utf8'), '// consumer customization\n');
  assert.equal(readFileSync(join(dir, '.codex/config.toml'), 'utf8'), userConfig);
  assert.equal(readFileSync(join(dir, '.markdownlint.json'), 'utf8'), lintConfig);
  assert.equal(readFileSync(join(dir, 'package.json'), 'utf8'), declared);
});

test('factory advertised runtime paths resolve without requiring a running Docker daemon', t => {
  const dir = mkdtempSync(join(tmpdir(), 'factory closure space '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const r = spawnSync('bash', [join(root, 'setup'), 'generic', '--profile', 'factory'],
    { cwd: dir, encoding: 'utf8', input: '', timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  for (const name of ['questions', 'harvest', 'park', 'answer'])
    assert.ok(existsSync(join(dir, `.agents/tools/runtime-bridge/src/cli/${name}.ts`)), name);
  assert.ok(existsSync(join(dir, '.agents/tools/runtime-bridge/scripts/bridge-health.sh')));
  assert.ok(existsSync(join(dir, 'scripts/check-arch-retell.mjs')));
  assert.ok(existsSync(join(dir, 'scripts/snapshot-for-seat.sh')));
  const harvest = readFileSync(join(dir, '.agents/procedures/harvest/references/publication-and-closure.md'), 'utf8');
  assert.match(harvest, /\.agents\/tools\/runtime-bridge\/src\/cli\/harvest\.ts/);
  const doctor = readFileSync(join(dir, '.agents/procedures/aif-doctor/SKILL.md'), 'utf8');
  assert.doesNotMatch(doctor, /(?:^|[ \n`])packages\/runtime-bridge\/src\//);
});


test('docs role carries a scoped vocabulary reference without replacing the project glossary', t => {
  const dir=mkdtempSync(join(tmpdir(),'consumer glossary provenance space '));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  mkdirSync(join(dir,'docs/site'),{recursive:true});
  const owned='# Project glossary\n\n### Product widget\nThe project owner defines this term.\nDo not use (name): gadget — a project-owned synonym.\n';
  const glossary=join(dir,'docs/site/terms.md');writeFileSync(glossary,owned);
  const install=(...flags)=>spawnSync('bash',[join(root,'setup'),'generic','--profile','core',...flags],{cwd:dir,encoding:'utf8',input:'',timeout:60000,maxBuffer:4*1024*1024});
  let result=install();assert.equal(result.status,0,result.stdout+result.stderr);
  const reference=join(dir,'.agents/roles/resources/docs-form-auditor/framework-terms.md');
  assert.ok(existsSync(reference),'the selected card glossary reference must be available as scoped supporting data');
  assert.equal(readFileSync(glossary,'utf8'),owned,'a framework reference must not overwrite project vocabulary');
  assert.ok(!existsSync(join(dir,'.agents/procedures/docs-author/SKILL.md')),'supporting vocabulary must not promote a contributor procedure');
  const card=readFileSync(join(dir,'.agents/roles/resources/docs-form-auditor/criteria-card.md'),'utf8');
  assert.match(card,/framework-reference/);assert.match(card,/not.*project.*truth/i);
  assert.equal((card.match(/^\| C(?:[1-9]|1[0-3])\s*\|/gm)??[]).length,13,'binding envelope keeps every supplied card criterion');
  const checker=join(dir,'scripts/render-terms-style.mjs');assert.ok(existsSync(checker),'live glossary style drift must remain inspectable through the existing renderer');
  const checked=spawnSync('node',[checker,'--check'],{cwd:dir,encoding:'utf8'});
  assert.equal(checked.status,1,checked.stderr+checked.stdout); // Actual project vocabulary differs; never regenerate it during this audit.
  assert.equal(readFileSync(glossary,'utf8'),owned);
  const prepared=spawnSync('node',[checker,'--write'],{cwd:dir,encoding:'utf8'});
  assert.equal(prepared.status,0,prepared.stderr+prepared.stdout);
  const names=join(dir,'docs/site-quality/vale/styles/getff/Names.yml');
  const ownedNames=readFileSync(names,'utf8');
  writeFileSync(join(dir,'docs/site-quality/vale/styles/getff/Names.yml.override.md'),'# Project-owned naming style\n');
  const custom='# Consumer-owned reference note\n';writeFileSync(reference,custom);writeFileSync(reference.replace(/\.md$/,'.override.md'),'# Consumer-owned reference\n');
  result=install('--refresh');assert.equal(result.status,0,result.stdout+result.stderr);
  assert.equal(readFileSync(reference,'utf8'),custom);assert.equal(readFileSync(glossary,'utf8'),owned);
  assert.equal(readFileSync(names,'utf8'),ownedNames,'marked project naming style remains active after refresh');
});

test('consumer ESLint excludes only recorded delivered portable tools and still rejects user code', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'owned tool lint with spaces '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const delivered = [
    '.agents/tools/docs/markdownlint-cli2.bundle.mjs',
    '.agents/tools/install/rule-bootstrap-cli.bundle.mjs',
    '.agents/tools/validator/gate-single-token-diff.ts',
    '.agents/procedures/pipeline/helpers/overview.mjs',
    '.agents/roles/resources/rule-researcher/preflight.mjs',
    '.claude/skills/pipeline/helpers/overview.mjs',
    '.zcode/skills/pipeline/helpers/overview.mjs',
    'scripts/check-arch-retell.mjs',
    'scripts/docs-check.mjs',
    'scripts/render-terms-style.mjs',
  ];
  const userPaths = ['.agents/tools/custom.mjs', '.agents/procedures/pipeline/helpers/custom.mjs', '.agents/roles/resources/rule-researcher/custom.mjs', 'scripts/custom.mjs', 'src/violation.mjs'];
  // Three known collector paths exercise both its explicit list and shared registry.
  const modified = 'scripts/docs-check.mjs';
  const overridden = '.agents/tools/validator/gate-single-token-diff.ts';
  const skipped = '.zcode/skills/pipeline/helpers/overview.mjs';
  const protectedPaths = [modified, overridden, skipped];
  // This positive path is outside the explicit list: disabling the registry must fail.
  const registryOnly = '.agents/roles/resources/ownership-fixture/intact.mjs';
  const attempted = [...delivered, registryOnly];
  const intact = attempted.filter(path => !protectedPaths.includes(path));
  for (const path of [...attempted, ...userPaths]) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), 'console.log("violation");\n');
  }
  const baseline = Object.fromEntries(attempted.map(path => [
    path, createHash('sha256').update(readFileSync(join(dir, path))).digest('hex'),
  ]));
  mkdirSync(join(dir, '.ai-factory'), { recursive: true });
  writeFileSync(join(dir, '.ai-factory/refresh-baseline.json'), JSON.stringify(baseline));
  writeFileSync(join(dir, modified), 'console.log("consumer changed these bytes");\n');
  writeFileSync(join(dir, '.agents/tools/validator.override.md'), '# Consumer-owned validator directory\n');
  const source = readFileSync(join(root, 'setup.d/eslint-wire.sh'), 'utf8');
  const policy = source.match(/^_own_eslint_ignores\(\) \{[\s\S]*?^\}/m)?.[0];
  assert.ok(policy, 'actual installer ownership policy is present');
  // Load real ownership helpers. Persisted baseline hashes are explicit fixture
  // metadata; no helper is replaced by unconditional consent or an empty registry.
  const shell = `set -euo pipefail
INSTALL_SH_LIB_ONLY=1 source "$PKG_ROOT/setup.d/lib.sh"
GETFF_PORTABLE_PATHS=( ${attempted.map(path => '"$PROJECT_ROOT/' + path + '"').join(' ')} )
SKIPPED=( "$PROJECT_ROOT/${skipped}" )
${policy}
_own_eslint_ignores
`;
  const result = spawnSync('/bin/bash', [], {
    input: shell,
    env: { ...process.env, PROJECT_ROOT: dir, PKG_ROOT: root, DRY_RUN: '', FORCE: '' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const ignores = [...new Set(result.stdout.trim().split('\n').filter(Boolean))];
  assert.deepEqual([...ignores].sort(), [...intact].sort(), 'only recorded intact, unprotected delivery is excluded');
  for (const path of protectedPaths) assert.ok(!ignores.includes(path), path);
  assert.ok(!ignores.includes('.agents/tools/**'), 'user-owned tools retain enforcement');
  const config = 'export default [{files:["**/*.mjs","**/*.ts"],rules:{"no-console":"error"}}];\n';
  writeFileSync(join(dir, 'eslint.config.mjs'), config);
  const { ESLint } = createRequire(join(root, 'packages/core/package.json'))('eslint');
  const lint = new ESLint({ cwd: dir, overrideConfig: [{ ignores }], warnIgnored: false });
  for (const path of intact) assert.equal(await lint.isPathIgnored(join(dir, path)), true, path);
  for (const path of protectedPaths) assert.equal(await lint.isPathIgnored(join(dir, path)), false, path);
  const checkedPaths = [...userPaths, ...protectedPaths];
  const results = await lint.lintFiles(checkedPaths);
  assert.equal(results.length, checkedPaths.length);
  assert.ok(results.every(r => r.messages.some(m => m.ruleId === 'no-console')));
  assert.equal(readFileSync(join(dir, 'eslint.config.mjs'), 'utf8'), config, 'user rule bytes unchanged');
});
