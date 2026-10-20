// Installed-payload tests for the D0 living-docs audit command (kickoff-d0 §5:
// "real emitted-command payload closure"; anti-tautology row "Actual delivered command
// missing a dependency/resource — Installed test fails without contributor
// node_modules/import fallback", trap T-DC0-C).
//
// What makes this INSTALLED rather than runtime: the artifact under test is the
// DELIVERED copy — scripts/living-docs-audit.mjs carrying the ready bundle's bytes,
// materialized the way setup.d/40-configs.sh copy_safe delivers it — invoked from an
// isolated consumer layout with no source checkout and no node_modules in its
// resolution chain. The runtime tests spawn the source bundle inside the author
// checkout, where the repo's own node_modules could silently satisfy an accidental
// bare import; this file is the control that cannot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { repoRoot, COMMAND_ARTIFACT, buildCleanFixture, disposeFixture, runRoleInvocation, assertRoleAuditResult } from './fixtures.mjs';

const bundleBytes = readFileSync(COMMAND_ARTIFACT);

/** Materialize the delivered command into a fixture the installer's way (copy_safe semantics). */
function deliverCommand(root) {
  writeFileSync(join(root, 'scripts', 'living-docs-audit.mjs'), bundleBytes);
}

/** Invoke the DELIVERED copy exactly as the role documents it — relative path, project-root cwd. */
function runDelivered(root, args) {
  return spawnSync(process.execPath, ['scripts/living-docs-audit.mjs', ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120_000,
  });
}

// ─── Byte-level self-containment (T-DC0-C first half) ────────────────────────

test('delivered command imports only node: builtins — no author-checkout import can survive', () => {
  const text = bundleBytes.toString('utf8');
  const specs = [
    ...text.matchAll(/^import[^;\n]*?from\s*['"]([^'"]+)['"]/gm),
    ...text.matchAll(/^import\s*['"]([^'"]+)['"]/gm),
    ...text.matchAll(/^} from\s*['"]([^'"]+)['"]/gm),
  ].map(m => m[1]);
  assert.ok(specs.length > 0, 'the scan found the bundle\'s import statements');
  const bare = specs.filter(s => !s.startsWith('node:'));
  assert.deepEqual(bare, [], `bare import specifiers would resolve against consumer/node_modules: ${bare.join(', ')}`);
  // JSDoc examples inside bundled docstrings (e.g. `*   import {unified} from 'unified'`) are
  // comment text, not statements — the line-anchored scan above must have skipped them, which
  // this sanity check demonstrates rather than assumes.
  assert.ok(text.includes("from 'unified'"), 'the known JSDoc example is still there (comment-text control)');
});

// ─── Installed clean layouts through the delivered copy (§5 row 1) ───────────

for (const profile of ['base', 'react-next']) {
  test(`clean installed ${profile} layout via the delivered copy: completed, exit 0, no contributor fallback`, { timeout: 120_000 }, () => {
    const root = buildCleanFixture(profile);
    try {
      deliverCommand(root);
      assert.ok(!existsSync(join(root, 'node_modules')), 'the installed layout has no node_modules');
      const res = runDelivered(root, ['--project-root', root, '--profile', profile]);
      assert.equal(res.status, 0, `stdout=${res.stdout}\nstderr=${res.stderr}`);
      assert.doesNotMatch(res.stderr, /ERR_MODULE_NOT_FOUND|Cannot find module/);
      const result = JSON.parse(res.stdout);
      assert.equal(result.complete, true);
      assert.equal(result.resolvedTarget, root);
      assert.ok(result.runner?.admitted, 'real runner identity admitted (not a stub)');
      const completion = result.checks.find(c => c.check === `${profile}/completion`);
      assert.equal(completion.status, 'passed');
      for (const check of result.checks) {
        assert.notEqual(check.status, 'incomplete', `${check.check} incomplete: ${check.reasons}`);
        assert.notEqual(check.status, 'error', `${check.check} errored: ${check.reasons}`);
      }
      if (profile !== 'base') {
        assert.ok(result.checks.some(c => c.check.startsWith('base/')), 'chained base scope present');
        assert.ok(result.chainedBase?.admitted, 'chained base identity admitted');
      }
      // The command never rewrote its own delivered bytes (reads-only target contract).
      assert.deepEqual(readFileSync(join(root, 'scripts', 'living-docs-audit.mjs')), bundleBytes);
    } finally { disposeFixture(root); }
  });
}

// ─── Missing-dependency counterfactual (§5 row "missing a dependency/resource") ──

test('a bare import in the installed layout fails loudly — no contributor node_modules can satisfy it', () => {
  const root = buildCleanFixture('base');
  try {
    // A package name that exists nowhere: if the layout's resolution chain could reach ANY
    // node_modules (contributor checkout, tmpdir pollution), this control would resolve or
    // fail differently — making a silently-broken bundle's green run impossible to mask.
    writeFileSync(
      join(root, 'scripts', '__ctrl-missing-dep.mjs'),
      `import 'living-docs-audit-installed-control-missing';\n`,
    );
    const res = spawnSync(process.execPath, ['scripts/__ctrl-missing-dep.mjs'], { cwd: root, encoding: 'utf8' });
    assert.notEqual(res.status, 0, 'the missing-dependency control must fail, never exit clean');
    assert.match(res.stderr, /ERR_MODULE_NOT_FOUND|Cannot find module/);
  } finally { disposeFixture(root); }
});

// ─── Delivery-layer agreement across lanes + packed distribution membership ──

test('both installer lanes deliver the bundle to scripts/living-docs-audit.mjs; node-free install stays possible', () => {
  const configs = readFileSync(join(repoRoot, 'setup.d/40-configs.sh'), 'utf8');
  const lib = readFileSync(join(repoRoot, 'setup.d/lib.sh'), 'utf8');
  assert.match(
    configs,
    /copy_safe "\$PKG_ROOT\/packages\/core\/audit-self\/living-docs-audit\.bundle\.mjs" "\$PROJECT_ROOT\/scripts\/living-docs-audit\.mjs"/,
    '40-configs.sh §4 delivers the command beside the docs gate',
  );
  assert.match(
    lib,
    /_lane_copy_or_refresh "\$PKG_ROOT\/packages\/core\/audit-self\/living-docs-audit\.bundle\.mjs" "\$PROJECT_ROOT\/scripts\/living-docs-audit\.mjs"/,
    'the agent lane delivers the same bytes through the refresh policy',
  );
  // Node-free installation: the delivery rows are plain file copies — nothing installs or
  // requires Node at install time (kickoff §1 "preserve node-free installation behavior").
  for (const [name, text] of [['40-configs.sh', configs], ['lib.sh', lib]]) {
    for (const line of text.split('\n')) {
      if (line.includes('living-docs-audit.bundle.mjs')) {
        assert.doesNotMatch(line, /\bnpm\b|\bnpx\b|node --/, `${name}: delivery line must stay a file copy: ${line.trim()}`);
      }
    }
  }
});

test('ships manifest marks the delivered command, and the packed distribution carries the bundle', () => {
  const manifest = readFileSync(join(repoRoot, 'setup.d/ships.manifest'), 'utf8');
  const row = manifest.split('\n').find(l => l.startsWith('script\tliving-docs-audit\t'));
  assert.ok(row, 'script living-docs-audit row exists');
  assert.match(row, /^script\tliving-docs-audit\tships\tcore\tno\t.{20,}/, 'row: ships, core installer, no plugin, substantive reason');
  const dist = readFileSync(join(repoRoot, 'packages/getff/MANIFEST.sha256'), 'utf8');
  assert.match(
    dist,
    /^[0-9a-f]{64}  packages\/core\/audit-self\/living-docs-audit\.bundle\.mjs$/m,
    'the bundle is in the npm payload population (packed-layout membership)',
  );
});

test('real content layers deliver the role and command, preserve customized copies and honor dry-run', { timeout: 120_000 }, () => {
  const root = buildCleanFixture('base');
  const block = `set -euo pipefail
PKG_ROOT="$GETFF_TEST_PACKAGE_ROOT" PROJECT_ROOT="$GETFF_TEST_TARGET"
PROFILE=core STACK=generic FORCE="" DRY_RUN="$GETFF_TEST_DRY_RUN" WITH_AIF_SUITE=""
UPSTREAM_BLOB_URL="https://github.com/artyhoo/getff/blob/main"
SKIPPED=(); SHIPPED_DOCS=(); REFRESH_BASELINE_STAGED=()
source "$PKG_ROOT/setup.d/lib.sh"
source "$PKG_ROOT/setup.d/20-agents.sh"
source "$PKG_ROOT/setup.d/40-configs.sh"
install_portable_bindings
refresh_baseline_flush
`;
  const deliver = dryRun => {
    const env = { ...process.env, GETFF_TEST_PACKAGE_ROOT: repoRoot, GETFF_TEST_TARGET: root, GETFF_TEST_DRY_RUN: dryRun };
    // A hook's Git index must never become the disposable consumer's Git identity.
    const local = spawnSync('git', ['rev-parse', '--local-env-vars'], { cwd: repoRoot, encoding: 'utf8' });
    for (const key of local.stdout.trim().split('\n')) delete env[key];
    const res = spawnSync('bash', ['-c', block], { cwd: root, env, encoding: 'utf8', timeout: 90_000 });
    assert.equal(res.status, 0, `real delivery failed:\n${res.stdout}\n${res.stderr}`);
  };
  try {
    const destination = join(root, 'scripts/living-docs-audit.mjs');
    deliver('--dry-run'); assert.equal(existsSync(destination), false, 'dry-run cannot materialize a runnable command');
    deliver(''); assert.deepEqual(readFileSync(destination), bundleBytes, 'actual layer must copy current ready bytes');
    const deliveredRole = join(root, '.agents/roles/living-docs-auditor.md');
    assert.ok(existsSync(deliveredRole), 'native consumer role has its real canonical source');
    assertRoleAuditResult(runRoleInvocation(root, 'base', readFileSync(deliveredRole, 'utf8')), root, 'base');
    const customized = Buffer.concat([bundleBytes, Buffer.from('\n// consumer customization\n')]);
    writeFileSync(destination, customized); deliver('');
    assert.deepEqual(readFileSync(destination), customized, 'copy_safe must preserve the consumer copy');
    unlinkSync(destination); deliver('');
    assert.deepEqual(readFileSync(destination), bundleBytes, 'missing command is redelivered by the real population');
  } finally { disposeFixture(root); }
});
