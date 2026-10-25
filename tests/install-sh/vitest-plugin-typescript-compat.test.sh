#!/usr/bin/env bash
# Keep the installer's TS5 floor compatible with its Vitest ESLint plugin.
set -euo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
cd "$REPO_ROOT"
# Read the actual resolver inputs without executing the dependency-install layer.
node --input-type=commonjs - <<'JS'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const semver = require('semver');
const specs = fs.readFileSync('setup.d/70-deps.sh', 'utf8').match(/^CORE_DEVDEPS=\(([\s\S]*?)^\)/m)[1].trim().split(/\s+/);
const spec = specs.find(s => s.startsWith('@vitest/eslint-plugin@'));
assert.ok(spec, 'plugin must remain in the toolchain');
const range = spec.slice('@vitest/eslint-plugin@'.length);
// 1.6.27: registry-confirmed peer >=5; CI selected 1.6.28 with peer >=6.
assert.ok(semver.satisfies('1.6.27', range), 'must admit the verified TS5-compatible release');
assert.ok(!semver.satisfies('1.6.28', range), 'must reject the observed TS6-only release');
assert.ok(specs.includes('typescript@^5.7.0'), 'do not widen the consumer TypeScript floor');
assert.ok(fs.readFileSync('INSTALL.md', 'utf8').includes(spec), 'document the actual resolver spec');
console.log('PASS: verified plugin admitted; observed incompatible plugin excluded; TS5 floor retained');
JS
