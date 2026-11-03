import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const role = readFileSync(resolve(root, '.agents/roles/review-sidecar.md'), 'utf8');
const statute = readFileSync(resolve(root, '.agents/rules/reviewer-discipline.md'), 'utf8');

test('shipped review-sidecar carries the exact triage yardstick without an unshipped rule dependency', () => {
  const yardstick = statute.match(/```text\n(Binding yardstick:[\s\S]*?)\n```/)[1];
  assert.ok(role.includes('```text\n' + yardstick + '\n```'),
    'consumer role must embed the measured rubric verbatim; .claude/rules is not delivered');
});

test('finding template carries the required failure scenario and per-axis provenance', () => {
  const template = role.split('## Output format')[1].split('Severity rules:')[0];
  assert.match(template, /Failure-scenario:/);
  assert.match(template, /layer.*corpus-measured/);
  assert.match(template, /whose.*judgment-only, not corpus-validated/);
  assert.match(template, /class.*measured null/);
});

// --- Trusted native OCR connection card: executable entry-selection + loader proof (getff-ocr-reuse C2) ---
// The card must select a real producer deployment location and load it through the
// project's OWN consented tsx bin — never an npx-mediated loader. `npx --no-install tsx`
// was measured (npm 11.4.2, 2026-11-03) executing a floating copy from the npm executable
// cache, and an ancestor node_modules bin, when the project's own tsx was absent. Every
// test below runs the card's REAL extracted prefix (scripts/lib/review-sidecar-card.mjs)
// under a recording fake-npx PATH: any npx-mediated loader line in any shipped card
// executes the fake (exit 3) and fails the gate — deterministically, offline.

const { cardBlockOf, cardPreludeOf, cardBadFlagPrefixOf, npxPoison } = await import('./lib/review-sidecar-card.mjs');
const ocrDirs = () => (existsSync(join(root, '.ai-factory/ocr'))
  ? readdirSync(join(root, '.ai-factory/ocr')).sort() : []);

test('card selects the authoring source entry here and reaches the producer parser through its own project-local loader', () => {
  const poison = npxPoison();
  const before = ocrDirs();
  // 1. Execute the card's actual selection prelude verbatim (cwd = this checkout; its
  //    root node_modules holds the project-local tsx bin the loader guard demands).
  const sel = spawnSync('bash', ['-c', cardPreludeOf(role) + '\nprintf "SELECTED=%s\\n" "$ENTRY"'],
    { cwd: root, encoding: 'utf8', timeout: 30_000, env: poison.env });
  assert.equal(sel.status, 0, `selection prelude must succeed\nstderr: ${sel.stderr}`);
  assert.match(sel.stdout, /^SELECTED=packages\/runtime-bridge\/src\/cli\/ocrTrustedReview\.ts$/m,
    'authoring checkout has no .agents/tools — the qualified authoring entry must be selected');
  assert.match(sel.stderr, /producer entry: packages\/runtime-bridge\/src\/cli\/ocrTrustedReview\.ts; loader: project-local tsx \([^)]*node_modules\/\.bin\/tsx\)/,
    'the card must record the selected path + explicit project-local loader in its receipt line');
  // 2. Through the card's own loader + entry (review args replaced by the bad flag), the
  //    producer's arg parser must be reached — exit 1 + its [runtime-bridge] diagnostic —
  //    and the poisoned npx must never run (no npx-mediated loader anywhere in the card).
  const bad = spawnSync('bash', ['-c', cardBadFlagPrefixOf(role)],
    { cwd: root, encoding: 'utf8', timeout: 60_000, env: poison.env });
  assert.equal(bad.status, 1,
    `bad invocation through the card's own prefix must exit 1 (got ${bad.status})\nstderr: ${bad.stderr}\nstdout: ${bad.stdout}`);
  assert.match(bad.stderr, /\[runtime-bridge\] ocrTrustedReview: Unknown option '--definitely-not-an-option'/);
  assert.ok(!poison.ran(), 'the card must not hand its loader to npx (poisoned PATH npx stayed untouched)');
  assert.deepEqual(ocrDirs(), before, 'an arg-parser rejection must not mint a native run dir');
});

test('missing project-local tsx is explicit non-execution — never a cache or ancestor loader', () => {
  const block = cardBlockOf(role);
  const home = mkdtempSync(join(tmpdir(), 'rs-card-loader-')); // parent: LOUD ancestor tsx bin
  const proj = join(home, 'child'); // cwd: has the real entry, no node_modules of its own
  const entry = join(proj, '.agents/tools/runtime-bridge/src/cli/ocrTrustedReview.ts');
  mkdirSync(resolve(entry, '..'), { recursive: true });
  writeFileSync(entry, readFileSync(resolve(root, 'packages/runtime-bridge/src/cli/ocrTrustedReview.ts')));
  mkdirSync(join(home, 'node_modules/.bin'), { recursive: true });
  writeFileSync(join(home, 'node_modules/.bin/tsx'), '#!/bin/sh\necho "ANCESTOR-TSX-RAN $*"\nexit 9\n');
  chmodSync(join(home, 'node_modules/.bin/tsx'), 0o755);
  const poison = npxPoison();
  const before = ocrDirs();
  try {
    const r = spawnSync('bash', ['-c', cardBadFlagPrefixOf(role)],
      { cwd: proj, encoding: 'utf8', timeout: 30_000, env: poison.env });
    assert.equal(r.status, 1,
      `missing project-local loader must exit 1 (got ${r.status})\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
    assert.match(r.stderr, /^producer never executed: no project-local tsx loader at .*node_modules\/\.bin\/tsx /m,
      'the explicit producer-never-executed loader guard must fire before any invocation');
    assert.ok(!((r.stderr + r.stdout).includes('ANCESTOR-TSX-RAN')),
      'an ancestor node_modules loader must not run');
    assert.ok(!((r.stderr + r.stdout).includes('[runtime-bridge]')),
      'the producer must not execute when the project-local loader is missing');
    assert.ok(!poison.ran(), 'npx must not be invoked at all — the npm executable cache route stays closed');
    assert.deepEqual(ocrDirs(), before, 'a missing loader must never mint a native run');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('frozen e2 preimage fixture is byte-pinned; its npx-mediated loader is demonstrated only under the poison boundary', () => {
  const bytes = readFileSync(resolve(root, 'scripts/fixtures/review-sidecar-e2f85267e92.md'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),
    '3032ee1ca4f8f186a304c7109d4242db9e0fad9f982245486172e8e4a73dd974',
    'frozen fixture bytes must match the sha256 recorded in scripts/fixtures/review-sidecar-e2f85267e92.provenance.json');
  const oldBlock = cardBlockOf(bytes.toString('utf8'));
  assert.match(oldBlock, /^npx tsx \.agents\/tools\/runtime-bridge\/src\/cli\/ocrTrustedReview\.ts \\/m,
    'e2 card must carry the unconditional installed-consumer npx invocation this fixture guards against');
  // Execute the OLD command's negative safely: the recording fake npx marks and exits 3 —
  // the registry-acquiring real npx is never reached (offline boundary), yet the hazard
  // class (the card handing its loader to npx) is made visible as data.
  const poison = npxPoison();
  const before = ocrDirs();
  const old = spawnSync('bash', ['-c',
    'npx tsx .agents/tools/runtime-bridge/src/cli/ocrTrustedReview.ts --definitely-not-an-option'],
    { cwd: root, encoding: 'utf8', timeout: 60_000, env: poison.env });
  assert.equal(old.status, 3, 'the old command must exit through the poison boundary, not succeed');
  assert.ok(poison.ran(), 'the old npx-mediated invocation must hand control to npx — the guarded hazard class');
  assert.doesNotMatch(old.stderr + old.stdout, /\[runtime-bridge\] ocrTrustedReview: Unknown option/,
    'the producer must never execute through the old npx-mediated path');
  assert.deepEqual(ocrDirs(), before, 'the old command must not mint a native run dir');
});

test('card reports producer-never-executed when neither deployment location exists', () => {
  const poison = npxPoison();
  const dir = mkdtempSync(join(tmpdir(), 'rs-card-none-'));
  const before = ocrDirs();
  try {
    const none = spawnSync('bash', ['-c', cardPreludeOf(role)],
      { cwd: dir, encoding: 'utf8', timeout: 30_000, env: poison.env });
    assert.equal(none.status, 1,
      `missing-entry guard must exit 1 (got ${none.status})\nstderr: ${none.stderr}`);
    assert.match(none.stderr, /^producer never executed: no ocrTrustedReview\.ts at either deployment location$/m,
      'the explicit producer-never-executed line must be the guard output');
    assert.ok(!((none.stderr + none.stdout).includes('producer entry:')),
      'no entry may be reported selected when neither location exists');
    assert.ok(!poison.ran(), 'no loader may be fetched when no entry exists');
    assert.deepEqual(ocrDirs(), before, 'a missing entry must never mint a native run or fetch a loader');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('card prefers the installed consumer entry when present', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rs-card-inst-'));
  try {
    const entry = join(dir, '.agents/tools/runtime-bridge/src/cli/ocrTrustedReview.ts');
    mkdirSync(resolve(entry, '..'), { recursive: true });
    writeFileSync(entry, '// installed-consumer entry marker (not executed by this test)\n');
    mkdirSync(join(dir, 'node_modules/.bin'), { recursive: true });
    writeFileSync(join(dir, 'node_modules/.bin/tsx'), '#!/bin/sh\nexit 0\n'); // stub: the -x guard only
    chmodSync(join(dir, 'node_modules/.bin/tsx'), 0o755);
    const sel = spawnSync('bash', ['-c', cardPreludeOf(role) + '\nprintf "SELECTED=%s\\n" "$ENTRY"'],
      { cwd: dir, encoding: 'utf8', timeout: 30_000 });
    assert.equal(sel.status, 0, `selection with an installed entry present must succeed\nstderr: ${sel.stderr}`);
    assert.match(sel.stdout, /^SELECTED=\.agents\/tools\/runtime-bridge\/src\/cli\/ocrTrustedReview\.ts$/m,
      'installed consumer entry must be preferred over the authoring source location');
    assert.match(sel.stderr, /loader: project-local tsx \([^)]*node_modules\/\.bin\/tsx\)/,
      'the receipt names the project-local loader that passed the guard');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('every canonical card (role, plugin twin, aif-review skill-context) executes its real loader+entry prefix', () => {
  const twin = readFileSync(resolve(root, 'plugin/agents/review-sidecar.md'), 'utf8');
  assert.equal(twin, role, 'plugin twin must stay byte-identical to the canonical role');
  const skillCtx = readFileSync(
    resolve(root, 'packages/core/templates/shared/skill-context/aif-review/SKILL.md'), 'utf8');
  const cards = [['role', role], ['plugin twin', twin], ['aif-review skill-context', skillCtx]];
  const before = ocrDirs();
  for (const [name, md] of cards) {
    const poison = npxPoison();
    // cardBadFlagPrefixOf asserts the "$LOADER" "$ENTRY" invocation shape on extraction.
    const r = spawnSync('bash', ['-c', cardBadFlagPrefixOf(md)],
      { cwd: root, encoding: 'utf8', timeout: 60_000, env: poison.env });
    assert.equal(r.status, 1,
      `${name}: bad flag through the card's own loader+entry prefix must reach the producer parser (got ${r.status})\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
    assert.match(r.stderr, /\[runtime-bridge\] ocrTrustedReview: Unknown option '--definitely-not-an-option'/,
      `${name}: producer parser diagnostic`);
    assert.ok(!poison.ran(), `${name}: no canonical card may hand its loader to npx`);
  }
  assert.deepEqual(ocrDirs(), before, 'arg-parser rejections must not mint native run dirs');
  for (const line of [
    'ENTRY=".agents/tools/runtime-bridge/src/cli/ocrTrustedReview.ts"',
    '[ -f "$ENTRY" ] || ENTRY="packages/runtime-bridge/src/cli/ocrTrustedReview.ts"',
    'LOADER="$PWD/node_modules/.bin/tsx"',
    '"$LOADER" "$ENTRY" \\',
  ]) assert.ok(skillCtx.includes(line), `aif-review skill-context card must carry the same selection: ${line}`);
});
