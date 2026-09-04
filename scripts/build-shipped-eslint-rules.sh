#!/usr/bin/env bash
# build-shipped-eslint-rules.sh — Variant A / Option A (fixes #752).
#
# Compile the authored TypeScript ESLint rules → shipped `.mjs` + `.d.ts` artifacts,
# committed next to their `.ts` sources. install.sh then COPIES the pre-compiled
# artifacts (setup.d/40-configs.sh) — the consumer needs NO `tsc` at install time.
# This is the fix for #752: #745 compiled at install via a `tsc` the consumer lacks
# (wrong search paths + typescript not in dev-deps) → silently broken barrel ("green
# lies"). Shipping pre-compiled removes the consumer-side tsc dependency entirely.
#
# Usage:
#   scripts/build-shipped-eslint-rules.sh           # (re)generate committed .mjs + .d.ts
#   scripts/build-shipped-eslint-rules.sh --check    # drift gate: fail if committed != recompile
#
# The `--check` mode is the executable artifact (CI-runnable, deterministic, no LLM)
# that keeps the committed .mjs/.d.ts in sync with the .ts authoring source — the
# "documents lie; tests don't" guard for shipped compiled output. It also flags
# ORPHANS: committed artifacts whose .ts source was deleted (or stopped being
# shippable), so removing a rule source cannot leave stale compiled output behind.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
TSC="$ROOT/node_modules/.bin/tsc"
[ -x "$TSC" ] || { echo "ERROR: tsc not found at $TSC — run 'npm install' at repo root first." >&2; exit 2; }

# Same flags the #745 install-time compile used, so output is reproducible.
TSC_FLAGS=(--module ES2022 --target ES2022 --moduleResolution bundler --skipLibCheck --declaration --noEmitOnError false)

RULE_DIRS=(
  "packages/core/eslint-rules"
  "packages/preset-next-15-canonical/eslint-rules"
  "packages/preset-react-spa/eslint-rules"
)

MODE="${1:-build}"

# echo the list of shippable rule .ts files in a dir (excl tests / parity / index / d.ts)
_rule_sources() {
  local dir="$1" f
  for f in "$ROOT/$dir"/*.ts; do
    [ -e "$f" ] || continue
    case "$f" in
      *.test.ts) continue ;;
      *.d.ts) continue ;;
      */index.ts) continue ;;
    esac
    printf '%s\n' "$f"
  done
}

# compile one rule .ts → <outdir>/<stem>.mjs + <stem>.d.ts
_compile_one() {
  local src="$1" outdir="$2" stem
  stem="$(basename "$src" .ts)"
  "$TSC" "$src" "${TSC_FLAGS[@]}" --outDir "$outdir" >/dev/null 2>&1 || true
  [ -f "$outdir/$stem.js" ] && mv -f "$outdir/$stem.js" "$outdir/$stem.mjs"
}

if [ "$MODE" = "--check" ]; then
  tmp="$(mktemp -d)"
  drift=0 checked=0
  for dir in "${RULE_DIRS[@]}"; do
    [ -d "$ROOT/$dir" ] || continue
    while IFS= read -r src; do
      [ -n "$src" ] || continue
      stem="$(basename "$src" .ts)"
      mkdir -p "$tmp/$dir"
      _compile_one "$src" "$tmp/$dir"
      for ext in mjs d.ts; do
        committed="$ROOT/$dir/$stem.$ext"
        fresh="$tmp/$dir/$stem.$ext"
        checked=$((checked + 1))
        if [ ! -f "$committed" ]; then
          echo "DRIFT: missing committed $dir/$stem.$ext (run scripts/build-shipped-eslint-rules.sh)"; drift=1; continue
        fi
        if ! diff -q "$committed" "$fresh" >/dev/null 2>&1; then
          echo "DRIFT: $dir/$stem.$ext differs from a fresh recompile of $stem.ts"; drift=1
        fi
      done
    done < <(_rule_sources "$dir")
  done
  # Orphan walk: a committed .mjs/.d.ts whose authoring .ts source is gone (or no
  # longer shippable) must go RED, not linger silently. Without this, deleting a
  # rule source leaves its compiled artifacts orphaned — install.sh keeps copying
  # a rule nobody authors anymore. Mirrors the python-template drift gate's
  # committed-artifacts-without-source walk.
  for dir in "${RULE_DIRS[@]}"; do
    [ -d "$ROOT/$dir" ] || continue
    for artifact in "$ROOT/$dir"/*.mjs "$ROOT/$dir"/*.d.ts; do
      [ -e "$artifact" ] || continue
      case "$artifact" in
        *.d.ts) stem="$(basename "$artifact" .d.ts)" ;;
        *)      stem="$(basename "$artifact" .mjs)" ;;
      esac
      checked=$((checked + 1))
      if ! _rule_sources "$dir" | grep -qxF "$ROOT/$dir/$stem.ts"; then
        echo "ORPHAN: $dir/$(basename "$artifact") has no matching rule source $dir/$stem.ts (delete the artifact or restore the source)"
        drift=1
      fi
    done
  done
  if [ "$drift" -ne 0 ]; then
    echo "✗ shipped-rule drift detected ($checked checks). Re-run: scripts/build-shipped-eslint-rules.sh" >&2
    exit 1
  fi
  echo "✓ shipped compiled rules in sync with .ts sources ($checked checks)."
  exit 0
fi

# build mode: (re)generate committed artifacts in place
total=0
for dir in "${RULE_DIRS[@]}"; do
  [ -d "$ROOT/$dir" ] || continue
  while IFS= read -r src; do
    [ -n "$src" ] || continue
    _compile_one "$src" "$ROOT/$dir"
    total=$((total + 1))
  done < <(_rule_sources "$dir")
done
echo "✓ compiled $total rule(s) → .mjs + .d.ts (committed next to .ts sources; consumer needs no tsc)."
