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
  [ "$rc" = "0" ] || bad "install rc=$rc (non-zero — tail: $(tail -5 "$dir/.install.log" | tr '\n' '|'))"
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

# M4(a) (dual-review): delta is the OTHER half of the AND-gate — tsconfig present, vitest config
# missing entirely. beta above only exercised "has vitest, missing tsconfig"; the report checked
# this arm manually but never committed it.
mkdir -p "$T/packages/delta"
printf '{ "name": "@f20/delta", "devDependencies": { "typescript": "5.6.0" } }\n' \
  > "$T/packages/delta/package.json"
printf '{ "compilerOptions": { "strict": true } }\n' > "$T/packages/delta/tsconfig.json"
# delta deliberately has NO vitest.config.{ts,mts,js} at all.

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
# M4(b) (dual-review, plan Task 2 requirement)
grep -qE '^set -euo pipefail' "$WRAP" 2>/dev/null \
  && ok "wrapper begins with 'set -euo pipefail' (plan Task 2 requirement)" \
  || bad "wrapper missing 'set -euo pipefail'"

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
echo "▶ §6b M4(a): packages/delta — disqualified (no vitest config at all) → SKIPPED, re-checkable marker"
[ ! -f "$T/stryker/packages-delta.json" ] \
  && ok "packages/delta: no stryker config emitted (missing vitest config — the OTHER AND-gate arm)" \
  || bad "packages/delta: stryker config WAS emitted despite missing any vitest config"
grep -qi 'packages/delta.*no vitest config' "$T/.install.log" 2>/dev/null \
  && ok "packages/delta: re-checkable marker printed naming the missing vitest config" \
  || bad "packages/delta: no marker printed (install.log grep: $(grep -i delta "$T/.install.log" 2>/dev/null | tr '\n' '|'))"

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

# ══════════════════════════════════════════════════════════════════════════
# §10 C1 fix (dual-review): the per-package emit must honour copy_safe's consumer-protection
# contract — a hand-tuned stryker/<slug>.json survives a re-install unless --force is passed.
# ══════════════════════════════════════════════════════════════════════════
echo ""
echo "▶ §10 C1: per-package Stryker config survives re-install (skip-if-exists), overwritten only with --force"
C1=$(mktemp -d)
printf '{ "name": "f20-c1", "private": true, "devDependencies": { "typescript": "5.6.0" } }\n' \
  > "$C1/package.json"
printf 'packages:\n  - "packages/*"\n' > "$C1/pnpm-workspace.yaml"
mkdir -p "$C1/packages/alpha/src"
printf '{ "name": "@c1/alpha", "devDependencies": { "typescript": "5.6.0" } }\n' \
  > "$C1/packages/alpha/package.json"
printf "import { defineConfig } from 'vitest/config';\nexport default defineConfig({});\n" \
  > "$C1/packages/alpha/vitest.config.ts"
printf '{ "compilerOptions": { "strict": true } }\n' > "$C1/packages/alpha/tsconfig.json"

( cd "$C1" && git init -q && bash "$INSTALL_SH" ts-server --force </dev/null ) >"$C1/.install1.log" 2>&1
C1_RC1=$?
C1CFG="$C1/stryker/packages-alpha.json"
[ "$C1_RC1" = "0" ] && [ -f "$C1CFG" ] \
  && ok "C1 fixture: stryker/packages-alpha.json emitted on first install (rc=$C1_RC1)" \
  || bad "C1 fixture: first install broken (rc=$C1_RC1, cfg present=$([ -f "$C1CFG" ] && echo yes || echo no))"

# Hand-edit the emitted config (simulate consumer tuning) — flip concurrency to a sentinel value.
sed -i.bak 's/"concurrency": 4/"concurrency": 999/' "$C1CFG" 2>/dev/null && rm -f "$C1CFG.bak"
grep -q '"concurrency": 999' "$C1CFG" 2>/dev/null \
  || bad "C1 fixture: hand-edit did not apply (test setup broken, not a product bug)"

# Re-install WITHOUT --force → the hand-edit must SURVIVE (skip path).
( cd "$C1" && bash "$INSTALL_SH" ts-server </dev/null ) >"$C1/.install2.log" 2>&1
C1_RC2=$?
[ "$C1_RC2" = "0" ] || bad "C1: re-install (no --force) exited $C1_RC2 (expected 0)"
grep -q '"concurrency": 999' "$C1CFG" 2>/dev/null \
  && ok "C1: hand-edited stryker/packages-alpha.json SURVIVES re-install without --force" \
  || bad "C1 REGRESSION: hand-edit was clobbered by re-install without --force (copy_safe guard missing)"
grep -qi 'stryker/packages-alpha.json (exists — skipping' "$C1/.install2.log" 2>/dev/null \
  && ok "C1: skip message printed on re-install (mirrors copy_safe's ⊝ … exists — skipping wording)" \
  || bad "C1: no skip message printed on re-install ($(grep -i 'packages-alpha' "$C1/.install2.log" 2>/dev/null | tr '\n' '|'))"

# Re-install WITH --force → the hand-edit must be OVERWRITTEN.
( cd "$C1" && bash "$INSTALL_SH" ts-server --force </dev/null ) >"$C1/.install3.log" 2>&1
C1_RC3=$?
[ "$C1_RC3" = "0" ] || bad "C1: re-install (--force) exited $C1_RC3 (expected 0)"
! grep -q '"concurrency": 999' "$C1CFG" 2>/dev/null \
  && ok "C1: --force overwrites the hand-edited stryker/packages-alpha.json (sentinel gone)" \
  || bad "C1 REGRESSION: --force did NOT overwrite the hand-edited config"
rm -rf "$C1"

# ══════════════════════════════════════════════════════════════════════════
# §11 C2 fix (dual-review, plan Amendment A1): test:mutation wiring (setup.d/70-deps.sh) must
# route on ARTIFACT PRESENCE (scripts/run-mutation.sh), not the AIF_MONOREPO_SIG manifest-key
# signal — the two diverge both ways. Two arms below reproduce each direction.
# ══════════════════════════════════════════════════════════════════════════
echo ""
echo "▶ §11a C2 divergence (A): packages/* with NO workspace manifest key still gets the wrapper wiring"
C2A=$(mktemp -d)
# Deliberately NO pnpm-workspace.yaml and NO "workspaces" key — only conventional packages/* dirs.
printf '{ "name": "f20-c2a", "version": "0.0.0", "devDependencies": { "typescript": "5.6.0" } }\n' \
  > "$C2A/package.json"
mkdir -p "$C2A/packages/alpha/src"
printf '{ "name": "@c2a/alpha", "devDependencies": { "typescript": "5.6.0" } }\n' \
  > "$C2A/packages/alpha/package.json"
printf "import { defineConfig } from 'vitest/config';\nexport default defineConfig({});\n" \
  > "$C2A/packages/alpha/vitest.config.ts"
printf '{ "compilerOptions": { "strict": true } }\n' > "$C2A/packages/alpha/tsconfig.json"
! [ -f "$C2A/pnpm-workspace.yaml" ] && ! grep -q '"workspaces"' "$C2A/package.json" 2>/dev/null \
  && ok "C2a fixture: genuinely no workspace-manifest signal (pnpm-workspace.yaml/\"workspaces\" absent)" \
  || bad "C2a fixture: unexpectedly carries a workspace-manifest signal — test wouldn't isolate A1"
install_into "$C2A" ts-server
[ -f "$C2A/scripts/run-mutation.sh" ] \
  && ok "C2a: scripts/run-mutation.sh WAS emitted (conventional packages/* dir triggers the multi-stack branch)" \
  || bad "C2a fixture: wrapper not emitted — test setup broken"
grep -qF '"test:mutation": "bash scripts/run-mutation.sh"' "$C2A/package.json" 2>/dev/null \
  && ok "C2a FIX: test:mutation routes to the wrapper via artifact presence (manifest-key-free monorepo)" \
  || bad "C2a REGRESSION: test:mutation NOT wired to the wrapper despite it being emitted (SF-1 unfixed) — $(grep -A1 '\"test:mutation\"' "$C2A/package.json" 2>/dev/null | tr '\n' '|')"
rm -rf "$C2A"

echo ""
echo "▶ §11b C2 divergence (B): \"workspaces\" manifest key + non-conventional dirs → flat, no wrapper leak"
C2B=$(mktemp -d)
# "workspaces" key present (AIF_MONOREPO_SIG would be 1) but dirs are non-conventional (client/,
# server/ — NOT apps|packages|services|libs|modules), so _workspace_pkg_dirs enumerates nothing
# and 40-configs.sh takes the FLAT branch (never copies scripts/run-mutation.sh).
printf '{ "name": "f20-c2b", "version": "0.0.0", "workspaces": ["client", "server"], "devDependencies": { "typescript": "5.6.0" } }\n' \
  > "$C2B/package.json"
mkdir -p "$C2B/client" "$C2B/server"
printf '{ "name": "@c2b/client" }\n' > "$C2B/client/package.json"
printf '{ "name": "@c2b/server" }\n' > "$C2B/server/package.json"
install_into "$C2B" ts-server
[ -f "$C2B/stryker.config.json" ] \
  && ok "C2b: flat branch still ran — root stryker.config.json emitted" \
  || bad "C2b fixture: root stryker.config.json missing — flat branch didn't run as expected"
! [ -f "$C2B/scripts/run-mutation.sh" ] \
  && ok "C2b: no scripts/run-mutation.sh (flat branch never copies the wrapper — non-conventional dirs)" \
  || bad "C2b fixture: wrapper unexpectedly present — test setup broken"
grep -qF '"test:mutation": "stryker run"' "$C2B/package.json" 2>/dev/null \
  && ok "C2b FIX: test:mutation stays 'stryker run' despite the \"workspaces\" manifest key (no orphaned-wrapper wiring)" \
  || bad "C2b REGRESSION: test:mutation wired to the (non-existent) wrapper — working→broken regression ($(grep -A1 '\"test:mutation\"' "$C2B/package.json" 2>/dev/null | tr '\n' '|'))"
rm -rf "$C2B"

# ══════════════════════════════════════════════════════════════════════════
# §12 I1 fix (dual-review): FUNCTIONAL wrapper aggregation test — a stub `stryker` binary on
# $PATH, not just a static grep for `rc=1` + `exit "$rc"` (a regression adding `break` would
# still pass the static check).
# ══════════════════════════════════════════════════════════════════════════
echo ""
echo "▶ §12a I1: empty stryker/ → wrapper degrades gracefully (exit 0, no invocation)"
WEMPTY=$(mktemp -d)
mkdir -p "$WEMPTY/scripts"
cp "$REPO_ROOT/templates/ts-server/run-mutation.sh.tmpl" "$WEMPTY/scripts/run-mutation.sh"
chmod +x "$WEMPTY/scripts/run-mutation.sh"
EMPTY_OUT=$( cd "$WEMPTY" && bash scripts/run-mutation.sh 2>&1 ); EMPTY_RC=$?
[ "$EMPTY_RC" -eq 0 ] \
  && ok "I1: no stryker/*.json configs → wrapper exits 0" \
  || bad "I1: empty-configs wrapper exit $EMPTY_RC (expected 0) — out: $(printf '%s' "$EMPTY_OUT" | tr '\n' '|')"
printf '%s' "$EMPTY_OUT" | grep -qi 'no stryker.*configs found' \
  && ok "I1: empty-configs wrapper prints the graceful no-configs message" \
  || bad "I1: empty-configs wrapper missing the graceful message (out: $(printf '%s' "$EMPTY_OUT" | tr '\n' '|'))"
rm -rf "$WEMPTY"

echo ""
echo "▶ §12b I1: 2 configs, stub exits 1 for the FIRST → BOTH invoked (no short-circuit), wrapper rc=1"
W=$(mktemp -d)
mkdir -p "$W/scripts" "$W/stryker"
cp "$REPO_ROOT/templates/ts-server/run-mutation.sh.tmpl" "$W/scripts/run-mutation.sh"
chmod +x "$W/scripts/run-mutation.sh"
printf '{}' > "$W/stryker/alpha.json"
printf '{}' > "$W/stryker/beta.json"
STUBDIR=$(mktemp -d)
STUBLOG=$(mktemp)
# Stub logs every invocation's full arg list ("run <cfg> [extra]") then fails ONLY for the config
# whose path contains "alpha" — proves both configs are invoked regardless of the first's outcome.
cat > "$STUBDIR/stryker" <<EOF
#!/usr/bin/env bash
echo "\$*" >> "$STUBLOG"
case "\$2" in
  *alpha*) exit 1 ;;
  *) exit 0 ;;
esac
EOF
chmod +x "$STUBDIR/stryker"
( cd "$W" && PATH="$STUBDIR:$PATH" bash scripts/run-mutation.sh --incremental )
WRAP_RC=$?
[ "$WRAP_RC" -eq 1 ] \
  && ok "I1: wrapper's own exit code is 1 when one package's stryker run fails (aggregate failure)" \
  || bad "I1: wrapper exit code = $WRAP_RC (expected 1 — alpha's stub failed)"
grep -qF 'run stryker/alpha.json --incremental' "$STUBLOG" 2>/dev/null \
  && ok "I1: stub invoked positionally for stryker/alpha.json with --incremental forwarded" \
  || bad "I1: alpha invocation missing/malformed (log: $(tr '\n' '|' < "$STUBLOG" 2>/dev/null))"
grep -qF 'run stryker/beta.json --incremental' "$STUBLOG" 2>/dev/null \
  && ok "I1: stub ALSO invoked for stryker/beta.json — no short-circuit after alpha's failure" \
  || bad "I1 REGRESSION: stryker/beta.json never invoked — wrapper short-circuited on the first failure (log: $(tr '\n' '|' < "$STUBLOG" 2>/dev/null))"
rm -f "$STUBLOG"
rm -rf "$STUBDIR" "$W"

# ══════════════════════════════════════════════════════════════════════════
# §13 I2 fix (dual-review, plan Amendment A2): the Stryker emit must be STACK-INDEPENDENT — a
# workspace that resolves to the true 'unknown' ESLint-stack arm (own signal, explicit stack
# arg, AND root signal all absent) must still get a stryker/<slug>.json when it has vitest+
# tsconfig. A full `install.sh <stack> --force` run can never reach the per-workspace 'unknown'
# arm: passing a positional stack sets STACK_EXPLICIT=1, which _resolve_workspace_stacks' own
# documented precedence (own > explicit-arg > root > unknown) uses to rescue EVERY own-unknown
# workspace before it ever reaches "unknown"; auto-detecting from root has the same effect
# (root's signal, if present, wins root-fallback). So this test sources the dispatcher layer
# directly (mirrors the proven layer-units.test.sh dispatcher-scope pattern) with
# STACK_EXPLICIT unset and a root package.json that also carries no stack signal — the one
# combination that genuinely reaches "unknown".
# ══════════════════════════════════════════════════════════════════════════
echo ""
echo "▶ §13 I2: Stryker emit fires for a workspace that genuinely resolves to the 'unknown' stack arm"
U=$(mktemp -d)
printf '{ "name": "u-mono", "version": "0.0.0" }\n' > "$U/package.json"   # root: NO stack signal
mkdir -p "$U/packages/gamma/src"
printf '{ "name": "@u/gamma", "version": "0.0.0" }\n' > "$U/packages/gamma/package.json"  # own: NO stack signal
printf "import { defineConfig } from 'vitest/config';\nexport default defineConfig({});\n" \
  > "$U/packages/gamma/vitest.config.ts"
printf '{ "compilerOptions": { "strict": true } }\n' > "$U/packages/gamma/tsconfig.json"
# epsilon: OWN stack signal present (typescript) so at least one workspace resolves via "own" —
# keeps _ws_placed >= 1, avoiding the UNRELATED aggregate "ZERO configs placed" loud-fail
# (40-configs.sh's post-loop guard) from masking the specific 'unknown'-arm behavior under test
# for packages/gamma (rootstack is computed from ROOT package.json only, so adding epsilon does
# not change gamma's own resolution).
mkdir -p "$U/packages/epsilon/src"
printf '{ "name": "@u/epsilon", "devDependencies": { "typescript": "5.6.0" } }\n' \
  > "$U/packages/epsilon/package.json"
(
  set -uo pipefail
  export PKG_ROOT="$REPO_ROOT"
  export PROJECT_ROOT="$U"
  export FORCE="" DRY_RUN="" FULL="" WIRE_CI="" REFRESH=""
  export STACK="ts-server"
  export STACK_EXPLICIT=""   # deliberately NOT "1" — the whole point of this fixture (see §13 header)
  SHIPPED_DOCS=(); SKIPPED=(); DEVDEPS=()
  export DEPS_INSTALLED=""
  # shellcheck source=/dev/null
  source "$REPO_ROOT/setup.d/lib.sh"
  # shellcheck source=/dev/null
  source "$REPO_ROOT/setup.d/40-configs.sh"
) >"$U/.layer.log" 2>&1
U_RC=$?
[ "$U_RC" = "0" ] \
  && ok "I2 fixture: 40-configs.sh sourced cleanly against the isolated fixture (rc=0)" \
  || bad "I2 fixture: 40-configs.sh sourcing failed rc=$U_RC (log: $(tail -8 "$U/.layer.log" 2>/dev/null | tr '\n' '|'))"
grep -qi 'packages/gamma: unknown stack' "$U/.layer.log" 2>/dev/null \
  && ok "I2 fixture: packages/gamma genuinely resolved to the 'unknown' arm (own+root signal-free, no explicit arg) — non-vacuous" \
  || bad "I2 fixture: packages/gamma did NOT hit the 'unknown' marker — fixture doesn't isolate the bug ($(grep -i gamma "$U/.layer.log" 2>/dev/null | tr '\n' '|'))"
[ -f "$U/stryker/packages-gamma.json" ] \
  && ok "I2 FIX: stryker/packages-gamma.json emitted despite the workspace's 'unknown' ESLint stack (emit is stack-independent)" \
  || bad "I2 REGRESSION: stryker/packages-gamma.json NOT emitted for an 'unknown'-stack workspace with vitest+tsconfig"
rm -rf "$U"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
