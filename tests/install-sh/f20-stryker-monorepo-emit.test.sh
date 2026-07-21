#!/usr/bin/env bash
# f20-stryker-monorepo-emit.test.sh — #931 PR-2: per-package Stryker config emit + monorepo
# test:mutation wrapper wiring, on the REAL install pipeline (mirrors f13-stryker-pm.test.sh /
# multi-stack-monorepo.test.sh wiring).
#
# Naming note: the design plan (docs/superpowers/plans/2026-07-21-issue-931-stryker-pnpm-monorepo-
# plan.md Task 1) named this file f17-stryker-monorepo-emit.test.sh, but f17 was already taken by
# f17-lint-rules-planted-violation.test.sh (added after the plan was drafted). Filed under the
# next unused f-number instead — f17/f18/f19 are all occupied (verified: `ls tests/install-sh/f*`).
#
# THE BUG (SF-1, confirmed pre-fix): setup.d/40-configs.sh's multi-stack `_ws_lines`-non-empty
# branch places per-workspace ESLint configs but ships NO Stryker config at all — yet
# setup.d/70-deps.sh wires "test:mutation": "stryker run" for every consumer regardless of
# layout. A pnpm-monorepo consumer gets the script with nothing to run it against (config not
# found before any plugin-resolution question).
#
# Fixture: pnpm-workspace root + packages/alpha (vitest.config.ts + tsconfig.json + src/ —
# TARGETABLE) + packages/beta (has vitest.config.ts but NO tsconfig.json — must be SKIPPED,
# never exit 1; isolates the AND-gate so the test doesn't just prove "both missing" trivially).
#
# Global Constraints under test (verbatim from the design plan, binding):
#   1. bare-name plugins only (no entry-file / directory paths)
#   2. positional `stryker run <configFile>` in the emitted wrapper (never `-c <configFile>`)
#   3. project-root-relative paths: vitest.dir / vitest.configFile / tsconfigFile / mutate
#   4. target EXISTING structure only — never create vitest config / tsconfig
#   5. test:mutation routes to the wrapper on a monorepo, stays `stryker run` on a flat repo
#   6. mkdir_safe stryker/ once; skip-with-marker (not exit 1) for a disqualified workspace
#
# Active ai-laziness-traps (.claude/rules/ai-laziness-traps.md §2): T3 (every assertion is a
# grep + literal file:line evidence, no prose-only claims), T14 (§9 no-regression proves the
# harness isn't just uniformly broken — a clean run on an unimplemented capability would be
# "coverage insufficient", not "clean"), T15 (self: this IS the RED-before-GREEN artifact TDD
# requires — see task report for the RED transcript), T21 n/a (no backward-check in a test file).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL_SH="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# install_into <dir> <stack>: runs install.sh --force, captures rc.
# </dev/null answers "N" to every interactive prompt (dev-dep install, etc.).
install_into() {
  local dir="$1" stack="$2"
  ( cd "$dir" && git init -q && bash "$INSTALL_SH" "$stack" --force </dev/null ) \
    >"$dir/.install.log" 2>&1
  local rc=$?
  [ "$rc" = "0" ] || bad "install rc=$rc (non-zero — tail: $(tail -5 "$dir/.install.log" | tr '\n' '|')))"
  return 0
}

# ══════════════════════════════════════════════════════════════════════════
# Fixture: pnpm monorepo — packages/alpha (targetable) + packages/beta (skip: no tsconfig)
# ══════════════════════════════════════════════════════════════════════════
T=$(mktemp -d)
printf '{ "name": "f20-mono", "private": true, "devDependencies": { "typescript": "5.6.0" } }\n' \
  > "$T/package.json"
printf 'packages:\n  - "packages/*"\n' > "$T/pnpm-workspace.yaml"

mkdir -p "$T/packages/alpha/src"
printf '{ "name": "@f20/alpha", "devDependencies": { "typescript": "5.6.0" } }\n' \
  > "$T/packages/alpha/package.json"
printf "import { defineConfig } from 'vitest/config';\nexport default defineConfig({ test: { environment: 'node' } });\n" \
  > "$T/packages/alpha/vitest.config.ts"
printf '{ "compilerOptions": { "strict": true } }\n' > "$T/packages/alpha/tsconfig.json"
printf 'export const add = (a: number, b: number) => a + b;\n' > "$T/packages/alpha/src/index.ts"

mkdir -p "$T/packages/beta"
printf '{ "name": "@f20/beta", "devDependencies": { "typescript": "5.6.0" } }\n' \
  > "$T/packages/beta/package.json"
printf "import { defineConfig } from 'vitest/config';\nexport default defineConfig({});\n" \
  > "$T/packages/beta/vitest.config.ts"
# beta deliberately has NO tsconfig.json — the skip case (has vitest config; only tsconfig missing)

install_into "$T" ts-server

echo "▶ §1 packages/alpha: stryker config emitted at project-root-relative slug path"
CFG="$T/stryker/packages-alpha.json"
[ -f "$CFG" ] \
  && ok "stryker/packages-alpha.json emitted" \
  || bad "stryker/packages-alpha.json NOT emitted (ls stryker/: $(ls "$T/stryker" 2>/dev/null | tr '\n' ' '))"

echo ""
echo "▶ §2 Global Constraint 1 — bare-name plugins only"
grep -q '"@stryker-mutator/vitest-runner"' "$CFG" 2>/dev/null \
  && ok "bare-name vitest-runner plugin present" \
  || bad "vitest-runner plugin missing/malformed"
grep -q '"@stryker-mutator/typescript-checker"' "$CFG" 2>/dev/null \
  && ok "bare-name typescript-checker plugin present" \
  || bad "typescript-checker plugin missing/malformed"
! grep -qE 'dist/src/index\.js|node_modules/@stryker-mutator/[a-z-]+"' "$CFG" 2>/dev/null \
  && ok "neg: no entry-file or directory-path plugin form (forbidden per spike TD-0)" \
  || bad "neg: plugin declared as entry-file/directory path — forbidden form present"

echo ""
echo "▶ §3 Global Constraint 3 — project-root-relative paths"
grep -q '"dir": "packages/alpha"' "$CFG" 2>/dev/null \
  && ok "vitest.dir = packages/alpha (project-root-relative)" \
  || bad "vitest.dir wrong/missing ($(grep -A2 '"vitest"' "$CFG" 2>/dev/null | tr '\n' '|'))"
grep -q '"configFile": "packages/alpha/vitest.config.ts"' "$CFG" 2>/dev/null \
  && ok "vitest.configFile = packages/alpha/vitest.config.ts" \
  || bad "vitest.configFile wrong/missing"
grep -q '"tsconfigFile": "packages/alpha/tsconfig.json"' "$CFG" 2>/dev/null \
  && ok "tsconfigFile = packages/alpha/tsconfig.json" \
  || bad "tsconfigFile wrong/missing"
grep -qF '"packages/alpha/src/**/*.{ts,tsx}"' "$CFG" 2>/dev/null \
  && ok "mutate scoped to packages/alpha/src/**" \
  || bad "mutate not scoped to packages/alpha/src/** (mutate block: $(grep -A3 '"mutate"' "$CFG" 2>/dev/null | tr '\n' '|'))"
# NEG: must not be root-relative-only (regression to the flat template's bare src/** form)
! grep -qF '"src/**/*.{ts,tsx}"' "$CFG" 2>/dev/null \
  && ok "neg: mutate is NOT the flat template's bare src/** (would miss the package entirely)" \
  || bad "neg: mutate still carries the flat bare src/** form — wrong root"

echo ""
echo "▶ §4 Global Constraint 2 — positional stryker invocation (never -c)"
WRAP="$T/scripts/run-mutation.sh"
[ -x "$WRAP" ] \
  && ok "scripts/run-mutation.sh emitted + executable" \
  || bad "scripts/run-mutation.sh NOT emitted or not executable"
grep -qE 'stryker run "\$cfg"' "$WRAP" 2>/dev/null \
  && ok 'wrapper invokes stryker positionally: stryker run "$cfg"' \
  || bad "wrapper does not invoke stryker positionally ($(grep -n 'stryker run' "$WRAP" 2>/dev/null | tr '\n' '|'))"
! grep -qE -- '-c[[:space:]]+"\$cfg"|--concurrency[[:space:]]+"\$cfg"' "$WRAP" 2>/dev/null \
  && ok "neg: wrapper does NOT pass the config via -c (that flag is --concurrency in Stryker 9)" \
  || bad "neg: wrapper passes config via -c — Stryker 9 would silently misinterpret it"
grep -qF 'stryker/*.json' "$WRAP" 2>/dev/null \
  && ok "wrapper globs stryker/*.json" \
  || bad "wrapper does not glob stryker/*.json"
grep -qE '\$@|\$\*' "$WRAP" 2>/dev/null \
  && ok "wrapper forwards extra args (e.g. --incremental) via \$@/\$*" \
  || bad "wrapper does not forward extra args"

echo ""
echo "▶ §5 Aggregate-failure exit code — wrapper propagates a non-zero rc if ANY package fails"
grep -qE 'rc=1' "$WRAP" 2>/dev/null && grep -qE 'exit "?\$rc"?' "$WRAP" 2>/dev/null \
  && ok "wrapper tracks + exits non-zero rc on a per-package failure (aggregate exit)" \
  || bad "wrapper does not aggregate a non-zero exit on failure"

echo ""
echo "▶ §6 packages/beta — disqualified (no tsconfig.json) → SKIPPED, re-checkable marker, rc=0 (not exit 1)"
[ ! -f "$T/stryker/packages-beta.json" ] \
  && ok "packages/beta: no stryker config emitted (missing tsconfig.json)" \
  || bad "packages/beta: stryker config WAS emitted despite missing tsconfig.json"
grep -qi 'packages/beta.*tsconfig' "$T/.install.log" 2>/dev/null \
  && ok "packages/beta: re-checkable marker printed naming the missing structure" \
  || bad "packages/beta: no marker printed (install.log grep: $(grep -i beta "$T/.install.log" 2>/dev/null | tr '\n' '|'))"
echo "  · (install rc=0 already asserted above via install_into — confirms the skip never exit-1's the whole install)"

echo ""
echo "▶ §7 package.json: test:mutation routes to the wrapper on this monorepo"
grep -qF '"test:mutation": "bash scripts/run-mutation.sh"' "$T/package.json" 2>/dev/null \
  && ok "test:mutation → bash scripts/run-mutation.sh (monorepo form)" \
  || bad "test:mutation NOT wired to the wrapper ($(grep -A1 '"test:mutation"' "$T/package.json" 2>/dev/null | tr '\n' '|'))"
grep -qF '"test:mutation:incremental": "bash scripts/run-mutation.sh --incremental"' "$T/package.json" 2>/dev/null \
  && ok "test:mutation:incremental → bash scripts/run-mutation.sh --incremental" \
  || bad "test:mutation:incremental NOT wired to the wrapper"

echo ""
echo "▶ §8 mkdir_safe stryker/ — directory exists"
[ -d "$T/stryker" ] \
  && ok "stryker/ directory created" \
  || bad "stryker/ directory NOT created"

rm -rf "$T"

# ══════════════════════════════════════════════════════════════════════════
# §9 No-regression: flat ts-server repo keeps `stryker run` (not the wrapper) + the ORIGINAL
# single stryker.config.json — the flat branch (285-342) + patch_stryker_package_manager stay
# untouched (Global Constraint 5 / no-flat-regression check).
# ══════════════════════════════════════════════════════════════════════════
echo ""
echo "▶ §9 No-regression: flat (single-stack) repo — test:mutation stays 'stryker run', no wrapper"
F=$(mktemp -d)
printf '{ "name": "flat-f20", "version": "0.0.0" }\n' > "$F/package.json"
install_into "$F" ts-server

[ -f "$F/stryker.config.json" ] \
  && ok "flat: root stryker.config.json still placed (unchanged flat behavior)" \
  || bad "flat: root stryker.config.json missing — flat branch regression"
grep -qF '"test:mutation": "stryker run"' "$F/package.json" 2>/dev/null \
  && ok "flat: test:mutation stays 'stryker run' (no monorepo signal)" \
  || bad "flat: test:mutation wrongly changed ($(grep -A1 '"test:mutation"' "$F/package.json" 2>/dev/null | tr '\n' '|'))"
! [ -f "$F/scripts/run-mutation.sh" ] \
  && ok "neg: flat repo has NO scripts/run-mutation.sh (wrapper is monorepo-only)" \
  || bad "neg: flat repo got scripts/run-mutation.sh — wrapper leaked into the flat path"
! [ -d "$F/stryker" ] \
  && ok "neg: flat repo has NO stryker/ dir (per-package emit is multi-stack-only)" \
  || bad "neg: flat repo got a stryker/ dir — per-package emit leaked into the flat path"
rm -rf "$F"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
