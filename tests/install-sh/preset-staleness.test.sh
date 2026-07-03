#!/usr/bin/env bash
# Test: #811 preset staleness guard (live-research-default-delivery, D4).
# Exercises warn_preset_staleness (setup.d/lib.sh) against fabricated consumer package.json files,
# proving the WARN fires on a major drift and is silent when majors match. Paired-negative:
# matching majors ⇒ no WARN (the test is non-vacuous). Also asserts the shipped preset.meta.json
# pins exist. Deps-free, no network.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
META="$REPO_ROOT/packages/preset-next-15-canonical/preset.meta.json"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# Source lib.sh helpers only (guard returns before install-side effects).
PKG_ROOT="$REPO_ROOT" PROJECT_ROOT="$REPO_ROOT" INSTALL_SH_LIB_ONLY=1 \
  source "$REPO_ROOT/setup.d/lib.sh"

[ -f "$META" ] && ok "preset.meta.json shipped" || bad "preset.meta.json missing"
[ "$(_json_meta_major "$META" next)" = "15" ] && ok "meta pins next=15" || bad "meta next pin wrong: $(_json_meta_major "$META" next)"
[ "$(_json_meta_major "$META" eslint)" = "9" ] && ok "meta pins eslint=9" || bad "meta eslint pin wrong"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# (1) Consumer on Next 16 (major drift) → WARN fires, names next.
cat > "$TMP/drift.json" <<'JSON'
{ "dependencies": { "next": "^16.1.0", "react": "19.0.0" },
  "devDependencies": { "eslint": "^9.10.0", "prettier": "3.8.3" } }
JSON
out=$(warn_preset_staleness "$META" "$TMP/drift.json")
echo "$out" | grep -qiE 'frozen Next-15 snapshot' && ok "drift: staleness WARN fires" || bad "drift: WARN did not fire"
echo "$out" | grep -qE 'next: preset pinned to v15, you are on v16' && ok "drift: names next 15→16" || bad "drift: missing next drift line"
# eslint matches (9 vs 9) → must NOT appear in the drift list
echo "$out" | grep -qE 'eslint: preset pinned' && bad "drift: false-positive on matching eslint" || ok "drift: matching eslint not flagged"

# (2) Consumer on Next 15 / eslint 9 (all match) → no WARN (paired-negative; non-vacuity).
cat > "$TMP/match.json" <<'JSON'
{ "dependencies": { "next": "15.4.0" },
  "devDependencies": { "eslint": "9.12.0", "prettier": "^3.8.3", "typescript-eslint": "8.20.0" } }
JSON
out=$(warn_preset_staleness "$META" "$TMP/match.json")
[ -z "$out" ] && ok "match: no WARN when majors align (non-vacuous)" || bad "match: WARN fired unexpectedly: $out"

# (3) eslint-config-prettier must NOT be mis-read as the eslint key (anchor correctness).
cat > "$TMP/anchor.json" <<'JSON'
{ "devDependencies": { "eslint-config-prettier": "^10.0.0", "next": "15.0.0" } }
JSON
out=$(warn_preset_staleness "$META" "$TMP/anchor.json")
echo "$out" | grep -qE 'eslint: preset pinned' && bad "anchor: eslint-config-prettier mis-matched as eslint" || ok "anchor: eslint key not confused with eslint-config-prettier"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
