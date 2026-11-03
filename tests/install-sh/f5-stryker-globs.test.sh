#!/usr/bin/env bash
# cih-s3 F5 — stryker mutate globs are layout-agnostic.
# THE BUG: `mutate: ["src/**/*.{ts,tsx}", ...]` + Next-app-router exclusions. On a monorepo
# (no root src/) → ZERO mutants; the Next exclusions reference files a generic server lacks.
# S1/F13's patch only rewrote `packageManager`, never `mutate`.
# THE FIX: broaden mutate to cover flat (src/, lib/) AND monorepo (apps/*/src, packages/*/src),
# with path-agnostic exclusions (`!**/...`) so they apply under every root.
#
# PAIRED-NEGATIVE: the neg arm strips the monorepo root from a copy of the shipped config and
# re-runs the SAME grep — it MUST flip to a miss (proves the positive check is non-vacuous).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

T=$(mktemp -d)
printf '{ "name":"t","version":"0.0.0" }\n' > "$T/package.json"
( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1
RC_P50_092=$?
if [ "$RC_P50_092" -eq 0 ]; then ok "f5-stryker-globs: install rc=0 (p50-092)"; else bad "f5-stryker-globs: install rc=$RC_P50_092, expected 0 (p50-092)"; fi
CFG="$T/stryker.config.json"
[ -f "$CFG" ] || bad "stryker.config.json not installed"

# A positive glob string alone can coexist with !**/* and select no source.
# Resolve the actual installed configuration with the lock-provisioned engine;
# this is a cheap selection check, not an additional mutation execution.
assert_mutate_population() {
  node --input-type=module - "$REPO_ROOT" "$CFG" <<'JS'
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
const [repoRoot, configPath] = process.argv.slice(2);
const require = createRequire(resolve(repoRoot, 'packages/core/package.json'));
const engineRoot = dirname(require.resolve('@stryker-mutator/core/package.json'));
// Test-only API, bound to the installed lockfile. Initialize the public entry
// first so the engine's module graph is ready; unsupported APIs fail visibly.
await import(pathToFileURL(resolve(engineRoot, 'dist/src/index.js')).href);
const { ProjectReader } = await import(pathToFileURL(resolve(engineRoot, 'dist/src/fs/project-reader.js')).href);
const { defaultOptions } = await import(pathToFileURL(resolve(engineRoot, 'dist/src/config/index.js')).href);
const config = JSON.parse(readFileSync(configPath, 'utf8'));
// Node's cwd resolves /var to /private/var on macOS; canonicalize fixture paths
// before passing absolute names to the actual engine matcher.
const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'f5-real-selection-')));
const beforeCwd = process.cwd();
try {
  for (const name of [
    'src/math.ts', 'lib/math.ts', 'apps/web/src/math.ts', 'packages/shared/src/math.ts',
    'src/math.unit.ts', 'apps/web/src/math.spec.ts', 'lib/index.ts', 'packages/shared/src/types.d.ts',
  ]) {
    const p = resolve(scratch, name);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, name.endsWith('.d.ts')
      ? 'export declare function plus(value: number): number;\n'
      : 'export function plus(value: number): number { return value + 1; }\n');
  }
  process.chdir(scratch);
  const files = readdirSync(scratch, { recursive: true })
    .map((n) => resolve(scratch, String(n))).filter((p) => statSync(p).isFile());
  assert.equal(files.length, 8, 'F5 physical fixture discovery must be complete');
  const reader = new ProjectReader(undefined, { warn() {} }, { ...defaultOptions, mutate: config.mutate });
  const descriptions = reader.resolveFileDescriptions(files);
  const selected = Object.entries(descriptions).filter(([, d]) => d.mutate !== false)
    .map(([p]) => relative(scratch, p).split(sep).join('/')).sort();
  console.log('F5 resolved mutate files: ' + JSON.stringify(selected));
  assert.deepEqual(selected, [
    'apps/web/src/math.ts', 'lib/math.ts', 'packages/shared/src/math.ts', 'src/math.ts',
  ], 'F5 resolved mutate population must contain the four real source files');
} finally {
  process.chdir(beforeCwd);
  rmSync(scratch, { recursive: true, force: true });
}
JS
}

if assert_mutate_population; then
  ok "F5 pos: real Stryker selection contains all four source roots and excludes fixture tests/types/index"
else
  bad "F5 resolved mutate population is invalid or could not be observed"
fi

# pos-1: monorepo roots present in mutate
grep -q '"apps/\*/src/\*\*/\*.{ts,tsx}"' "$CFG" && grep -q '"packages/\*/src/\*\*/\*.{ts,tsx}"' "$CFG" \
  && ok "F5 pos: mutate covers monorepo roots (apps/*/src, packages/*/src)" \
  || bad "F5 pos: mutate missing monorepo roots — zero mutants on a monorepo"

# pos-2: exclusions are path-agnostic (apply under any root), not src/-anchored only
grep -q '"!\*\*/\*.unit.{ts,tsx}"' "$CFG" \
  && ok "F5 pos: exclusions are path-agnostic (!**/*.unit.{ts,tsx})" \
  || bad "F5 pos: exclusions still src/-anchored — won't apply under apps/*/packages/*"
grep -q '"!src/\*\*/\*.unit.{ts,tsx}"' "$CFG" \
  && bad "F5 pos: old src/-anchored exclusion still present" \
  || ok "F5 pos: src/-anchored-only exclusions removed"

# neg (LOAD-BEARING): strip the monorepo root from a copy → pos-1 grep MUST miss
cp "$CFG" "$CFG.neg"
grep -v 'apps/\*/src' "$CFG" > "$CFG.neg"
if grep -q '"apps/\*/src/\*\*/\*.{ts,tsx}"' "$CFG.neg"; then
  bad "F5 neg: stripped apps/*/src but grep still matched → VACUOUS"
else
  ok "F5 neg: removing apps/*/src flips pos-1 grep to miss (non-vacuous)"
fi
rm -f "$CFG.neg"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
