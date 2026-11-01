import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

// --- Trusted native OCR connection card: executable entry-selection proof (getff-ocr-reuse C2) ---
// The card must select a real producer deployment location and reach the producer's own
// arg parser through the card's exact selection + loader text — not a test-only resolver.

const cardBlockOf = md => {
  const blocks = [...md.matchAll(/```bash\n([\s\S]*?)```/g)].map(m => m[1]);
  const hit = blocks.find(b => b.includes('ocrTrustedReview.ts'));
  assert.ok(hit, 'connection card bash block containing ocrTrustedReview.ts must exist');
  return hit;
};
// Selection fragment = every line before the invocation (comment, ENTRY=, both guards, receipt echo).
const selectionFragmentOf = block => {
  const i = block.split('\n').findIndex(l => l.startsWith('npx'));
  assert.ok(i > 0, 'card must run a selection prelude before the invocation');
  return block.split('\n').slice(0, i).join('\n');
};
const ocrDirs = () => (existsSync(join(root, '.ai-factory/ocr'))
  ? readdirSync(join(root, '.ai-factory/ocr')).sort() : []);

test('card selects the authoring source entry here and reaches the producer parser through its own loader', () => {
  const fragment = selectionFragmentOf(cardBlockOf(role));
  const before = ocrDirs();
  // 1. Execute the card's actual selection fragment verbatim (cwd = this checkout).
  const sel = spawnSync('bash', ['-c', fragment + '\nprintf "SELECTED=%s\\n" "$ENTRY"'],
    { cwd: root, encoding: 'utf8', timeout: 30_000 });
  assert.equal(sel.status, 0, `selection fragment must succeed\nstderr: ${sel.stderr}`);
  assert.match(sel.stdout, /^SELECTED=packages\/runtime-bridge\/src\/cli\/ocrTrustedReview\.ts$/m,
    'authoring checkout has no .agents/tools — the qualified authoring entry must be selected');
  assert.match(sel.stderr, /producer entry: packages\/runtime-bridge\/src\/cli\/ocrTrustedReview\.ts; loader: local tsx \(npx --no-install\)/,
    'the card must record the selected path + local loader in its receipt line');
  // 2. Through the card's own loader form, a benign bad flag must reach the producer's
  //    arg parser (its [runtime-bridge] diagnostic + exit 1) — proving local loader + entry,
  //    with --no-install forbidding any registry fetch.
  const bad = spawnSync('bash', ['-c',
    fragment + '\nnpx --no-install tsx "$ENTRY" --definitely-not-an-option'],
    { cwd: root, encoding: 'utf8', timeout: 60_000 });
  assert.equal(bad.status, 1,
    `bad invocation through the corrected entry must exit 1 (got ${bad.status})\nstderr: ${bad.stderr}\nstdout: ${bad.stdout}`);
  assert.match(bad.stderr, /\[runtime-bridge\] ocrTrustedReview: Unknown option '--definitely-not-an-option'/);
  assert.deepEqual(ocrDirs(), before, 'an arg-parser rejection must not mint a native run dir');
});

test('exact e2 preimage card reproduces missing-entry non-execution, not a producer run', () => {
  const preimage = spawnSync('git', ['-C', root, 'show', 'e2f85267e92:.agents/roles/review-sidecar.md'],
    { encoding: 'utf8' });
  assert.equal(preimage.status, 0, preimage.stderr);
  const oldBlock = cardBlockOf(preimage.stdout);
  assert.match(oldBlock, /^npx tsx \.agents\/tools\/runtime-bridge\/src\/cli\/ocrTrustedReview\.ts \\/m,
    'e2 card must carry the unconditional installed-consumer path this test guards against');
  const before = ocrDirs();
  // Execute the old card's invocation path with a benign bad flag in this checkout.
  const old = spawnSync('bash', ['-c',
    'npx tsx .agents/tools/runtime-bridge/src/cli/ocrTrustedReview.ts --definitely-not-an-option'],
    { cwd: root, encoding: 'utf8', timeout: 60_000 });
  assert.notEqual(old.status, 0, 'the old unconditional path must fail in the authoring checkout');
  assert.doesNotMatch(old.stderr + old.stdout, /\[runtime-bridge\] ocrTrustedReview: Unknown option/,
    'the failure must be a spawn/module error (producer never executed), never a producer diagnostic');
  assert.match(old.stderr + old.stdout, /Cannot find module|ERR_MODULE_NOT_FOUND/,
    'expected the observed module-not-found non-execution class');
  assert.deepEqual(ocrDirs(), before, 'the old card failure must not mint a native run dir');
});

test('card reports producer-never-executed when neither deployment location exists', () => {
  const fragment = selectionFragmentOf(cardBlockOf(role));
  const dir = mkdtempSync(join(tmpdir(), 'rs-card-none-'));
  const before = ocrDirs();
  try {
    const none = spawnSync('bash', ['-c', fragment],
      { cwd: dir, encoding: 'utf8', timeout: 30_000 });
    assert.equal(none.status, 1,
      `missing-entry guard must exit 1 (got ${none.status})\nstderr: ${none.stderr}`);
    assert.match(none.stderr, /^producer never executed: no ocrTrustedReview\.ts at either deployment location$/m,
      'the explicit producer-never-executed line must be the guard output');
    assert.ok(!((none.stderr + none.stdout).includes('producer entry:')),
      'no entry may be reported selected when neither location exists');
    assert.deepEqual(ocrDirs(), before, 'a missing entry must never mint a native run or fetch a loader');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('card prefers the installed consumer entry when present', () => {
  const fragment = selectionFragmentOf(cardBlockOf(role));
  const dir = mkdtempSync(join(tmpdir(), 'rs-card-inst-'));
  try {
    const entry = join(dir, '.agents/tools/runtime-bridge/src/cli/ocrTrustedReview.ts');
    mkdirSync(resolve(entry, '..'), { recursive: true });
    writeFileSync(entry, '// installed-consumer entry marker (not executed by this test)\n');
    const sel = spawnSync('bash', ['-c', fragment + '\nprintf "SELECTED=%s\\n" "$ENTRY"'],
      { cwd: dir, encoding: 'utf8', timeout: 30_000 });
    assert.equal(sel.status, 0, `selection with an installed entry present must succeed\nstderr: ${sel.stderr}`);
    assert.match(sel.stdout, /^SELECTED=\.agents\/tools\/runtime-bridge\/src\/cli\/ocrTrustedReview\.ts$/m,
      'installed consumer entry must be preferred over the authoring source location');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('plugin twin and aif-review skill-context card carry the same entry selection', () => {
  const twin = readFileSync(resolve(root, 'plugin/agents/review-sidecar.md'), 'utf8');
  assert.equal(twin, role, 'plugin twin must stay byte-identical to the canonical role');
  const skillCtx = readFileSync(
    resolve(root, 'packages/core/templates/shared/skill-context/aif-review/SKILL.md'), 'utf8');
  for (const line of [
    'ENTRY=".agents/tools/runtime-bridge/src/cli/ocrTrustedReview.ts"',
    '[ -f "$ENTRY" ] || ENTRY="packages/runtime-bridge/src/cli/ocrTrustedReview.ts"',
    'npx --no-install tsx "$ENTRY" \\',
  ]) assert.ok(skillCtx.includes(line), `aif-review skill-context card must carry the same selection: ${line}`);
});
