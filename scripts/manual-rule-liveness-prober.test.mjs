import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('the role input roster matches actual manifest manual rules', () => {
  const source = readFileSync(new URL('../.agents/roles/manual-rule-liveness-prober.md', import.meta.url), 'utf8');
  const manifest = JSON.parse(readFileSync(new URL('../packages/core/manifest/rules-manifest.json', import.meta.url), 'utf8'));
  const input = source.split('## Input\n')[1].split('## Step 1')[0];
  const roster = [...input.matchAll(/^\| `([A-Z]+\d+)`/gm)].map((m) => m[1]).sort();
  const actual = Object.entries(manifest).filter(([, rule]) => rule.check.type === 'manual').map(([id]) => id).sort();
  assert.ok(roster.length > 0, 'input roster was not parsed');
  assert.deepEqual(roster, actual, 'role must not probe ESLint rules as manifest manual rules');
});
