#!/usr/bin/env bash
# tests/install-sh/rules-lock-malformed-values.test.sh — S1 criterion 7: malformed-value vectors closed.
#
# r1 blocker 4: version = { workspace = true } (cargo workspace inheritance),
# TOML literal strings (version = '1.2.3'), and backslash-bearing values must
# never reach the lock as invalid JSON. Under the manifest mechanism (S1 §3
# criterion 2), the lock is constructed by printf/heredoc with hardcoded fields —
# consumer manifest values NEVER reach the lock. This test proves the negative
# by running install.sh against consumers with exactly those three vectors.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

[ -f "$INSTALL" ] || { echo "FATAL: $INSTALL not found"; exit 1; }

lock_version_raw() { grep -oE '"version"[[:space:]]*:[[:space:]]*(null|"[^"]*")' "$1" | head -1 | sed -E 's/.*:[[:space:]]*//'; }

echo "▶ Rules-lock malformed-value vectors (S1 criterion 7) — consumer manifest toxins never reach the lock"
echo ""

# ── (1) cargo workspace inheritance: version = { workspace = true } ───────────────────────────────
# The r1 sed extractor would pass '{ workspace = true }' through as invalid JSON.
# Under the manifest mechanism, the lock writer hardcodes version=null.
echo "  ── (1) cargo workspace inheritance ({ workspace = true }) ──"
C1=$(mktemp -d)
cat > "$C1/Cargo.toml" <<'EOF'
[package]
name = "demo"
version = { workspace = true }
edition = "2021"

[dependencies]
EOF
( cd "$C1" && bash "$INSTALL" cargo < /dev/null ) >/dev/null 2>&1
LOCK1="$C1/.ai-factory/synthesizer-output/rules-lock.cargo.json"
if [ -f "$LOCK1" ]; then
  v1=$(lock_version_raw "$LOCK1")
  [ "$v1" = "null" ] \
    && ok "(1) cargo lock version=null despite workspace inheritance in Cargo.toml" \
    || bad "(1) cargo lock version=$v1 — workspace inheritance leaked"
  grep -q 'workspace' "$LOCK1" \
    && bad "(1) raw TOML 'workspace' found in lock — malformed value leaked" \
    || ok "(1) no raw TOML 'workspace' in the lock JSON"
else
  bad "(1) cargo lock not emitted"
fi
rm -rf "$C1"

# ── (2) TOML literal string: version = '1.2.3' (single quotes) ────────────────────────────────────
echo ""; echo "  ── (2) TOML literal string (version = '1.2.3') ──"
C2=$(mktemp -d)
cat > "$C2/Cargo.toml" <<'EOF'
[package]
name = "demo"
version = '1.2.3'
edition = "2021"

[dependencies]
EOF
( cd "$C2" && bash "$INSTALL" cargo < /dev/null ) >/dev/null 2>&1
LOCK2="$C2/.ai-factory/synthesizer-output/rules-lock.cargo.json"
if [ -f "$LOCK2" ]; then
  v2=$(lock_version_raw "$LOCK2")
  [ "$v2" = "null" ] \
    && ok "(2) cargo lock version=null despite TOML literal string in Cargo.toml" \
    || bad "(2) cargo lock version=$v2 — TOML literal leaked"
else
  bad "(2) cargo lock not emitted"
fi
rm -rf "$C2"

# ── (3) backslash-bearing value in consumer manifest ─────────────────────────────────────────────
echo ""; echo "  ── (3) backslash-bearing consumer version ──"
C3=$(mktemp -d)
printf '[project]\nname = "demo"\nversion = "1.0\\\\0"\n' > "$C3/pyproject.toml"
( cd "$C3" && bash "$INSTALL" python --force < /dev/null ) >/dev/null 2>&1
LOCK3="$C3/.getff/rules-lock.python.json"
if [ -f "$LOCK3" ]; then
  v3=$(lock_version_raw "$LOCK3")
  [ "$v3" = "null" ] \
    && ok "(3) python lock version=null despite backslash-bearing version in pyproject.toml" \
    || bad "(3) python lock version=$v3 — backslash value leaked"
else
  bad "(3) python lock not emitted"
fi
rm -rf "$C3"

# ── (4) JSON validity: all emitted locks parse cleanly ───────────────────────────────────────────
echo ""; echo "  ── (4) JSON validity (python3 json.load) across all lanes ──"
if command -v python3 >/dev/null 2>&1; then
  for lane in python cargo go; do
    D=$(mktemp -d)
    case "$lane" in
      python) printf '[project]\nname = "demo"\nversion = "0.0.1"\n' > "$D/pyproject.toml" ;;
      cargo)  printf '[package]\nname = "demo"\nversion = "0.0.1"\nedition = "2021"\n\n[dependencies]\n' > "$D/Cargo.toml" ;;
      go)     printf 'module example.com/demo\n\ngo 1.22\n' > "$D/go.mod" ;;
    esac
    ( cd "$D" && bash "$INSTALL" "$lane" --force < /dev/null ) >/dev/null 2>&1
    LOCK=$(find "$D" -name 'rules-lock.*.json' 2>/dev/null | head -1)
    if [ -n "$LOCK" ]; then
      python3 -c "import json; json.load(open('$LOCK'))" 2>/dev/null \
        && ok "(4) $lane lock is valid JSON" \
        || bad "(4) $lane lock FAILED JSON parse"
    else
      bad "(4) $lane lock not emitted"
    fi
    rm -rf "$D"
  done
else
  echo "  · SKIP: python3 not available for JSON validation"
fi

echo ""
echo "── rules-lock-malformed-values: $PASS passed, $FAIL failed ──"
[ "$FAIL" -eq 0 ]
