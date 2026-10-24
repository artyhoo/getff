#!/usr/bin/env bash
# tests/install-sh/rules-lock-version-grep-null-tolerant.test.sh — ultra-review #1597 defect: the
# rules-lock version grep must be NULL-TOLERANT under `set -euo pipefail`.
#
# Both lane lock writers guarded the version grep ONLY by file existence:
#   setup.d/lib.sh `_lane_write_toolchain_lock` (cargo/go) and
#   setup.d/45-python.sh `_py_write_rules_lock` (python):
#     _ctx_ver=$(grep -oE '"version"…' "$_ctx" | head -1 | sed -E 's/.*:[[:space:]]*//')
# Once the manifest EXISTS, the pipeline has TWO failure modes:
#   (a) no "version" key → grep exits 1. This is exactly the case the
#       `[ -n "$_ctx_ver" ] || _ctx_ver='null'` fallback below was written for — but pipefail
#       promotes grep's 1 to the pipeline status and `set -e` aborts the lane BEFORE that
#       fallback line is ever reached (dead code for precisely its intended case).
#   (b) a manifest whose grep output exceeds the 64KiB pipe buffer → `head -1` exits after the
#       first line, grep's next write raises EPIPE → SIGPIPE 141 → pipefail → abort.
# Both aborts land AFTER file delivery but BEFORE the lock write: the consumer receives the
# toolchain with no rules-lock and a failed install. The fix is `|| true` on the pipeline, which
# makes the existing fallback reachable; healthy-path lock bytes stay identical.
#
# Arms (a versionless and a many-match manifest on the lane families): the lane must COMPLETE
# (rc=0) and write the lock with version null — the many-match manifest seeds `"version": null`
# values, so the preserved first-match extraction itself yields null. Healthy-path guards: a
# manifest WITH a version must still surface that version in the lock, exactly as before the fix.
# The install exit code is asserted inline at every arm (principle 50): a captured `rc` compared
# with `-eq` right after the capture, so a mid-lane abort can never read green here.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

[ -f "$INSTALL" ] || { echo "FATAL: $INSTALL not found"; exit 1; }

HAVE_PY3=0
if command -v python3 >/dev/null 2>&1; then HAVE_PY3=1; else echo "  · python3 not available — JSON-validity assertions skipped"; fi

lock_version_raw() { grep -oE '"version"[[:space:]]*:[[:space:]]*(null|"[^"]*")' "$1" | head -1 | sed -E 's/.*:[[:space:]]*//'; }
json_valid() { python3 -c "import json; json.load(open('$1'))" 2>/dev/null; }

seed_ctx() { # <consumer-root> <json-content> — a generation-context manifest at the path the Node emitter writes
  mkdir -p "$1/.ai-factory/synthesizer-output"
  printf '%s\n' "$2" > "$1/.ai-factory/synthesizer-output/generation-context.json"
}

many_match_ctx() { # <consumer-root> — 10000 `"version": null` entries: grep emits ~150KiB across the
                   # 64KiB pipe buffer, so `head -1` SIGPIPEs the grep under pipefail (failure mode b)
  mkdir -p "$1/.ai-factory/synthesizer-output"
  awk 'BEGIN {
    printf "{\"rules\": ["
    for (i = 1; i <= 10000; i++)
      printf "%s{\"name\": \"pkg-%04d\", \"version\": null}", (i > 1 ? "," : ""), i
    printf "]}\n"
  }' > "$1/.ai-factory/synthesizer-output/generation-context.json"
}

# assert_lock <label> <lock-path> <expected-version> — lock emitted, version as expected, valid JSON
assert_lock() {
  local label="$1" lock="$2" want="$3" got
  if [ -f "$lock" ]; then
    ok "$label: lock emitted"
    got=$(lock_version_raw "$lock")
    [ "$got" = "$want" ] \
      && ok "$label: lock version=$want" \
      || bad "$label: lock version=$got, expected $want"
    if [ "$HAVE_PY3" -eq 1 ]; then
      json_valid "$lock" \
        && ok "$label: lock is valid JSON" \
        || bad "$label: lock FAILED JSON parse"
    fi
  else
    bad "$label: lock NOT emitted at $lock (lane aborted before the write — the defect)"
  fi
}

echo "▶ Rules-lock version grep null-tolerance (ultra review #1597) — a present-but-unreadable manifest must not abort the lane"
echo ""

# ── (1) cargo + versionless manifest (failure mode a: grep finds no "version" key → exit 1) ──────
echo "  ── (1) cargo: versionless generation-context manifest ──"
C1=$(mktemp -d)
printf '[package]\nname = "demo"\nversion = "0.0.1"\nedition = "2021"\n\n[dependencies]\n' > "$C1/Cargo.toml"
seed_ctx "$C1" '{"rules": []}'
out=$( cd "$C1" && bash "$INSTALL" cargo --force < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(1) cargo versionless: install completed (rc=0)" \
  || bad "(1) cargo versionless: install exit $rc — lane aborted (RED arm; tail: $(printf '%s' "$out" | tail -2 | tr '\n' '|'))"
assert_lock "(1) cargo versionless" "$C1/.ai-factory/synthesizer-output/rules-lock.cargo.json" "null"
rm -rf "$C1"

# ── (2) go + versionless manifest — the SAME shared writer as (1), both lanes covered ────────────
echo ""; echo "  ── (2) go: versionless generation-context manifest ──"
C2=$(mktemp -d)
printf 'module example.com/demo\n\ngo 1.22\n' > "$C2/go.mod"
seed_ctx "$C2" '{"rules": []}'
out=$( cd "$C2" && bash "$INSTALL" go --force < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(2) go versionless: install completed (rc=0)" \
  || bad "(2) go versionless: install exit $rc — lane aborted (RED arm; tail: $(printf '%s' "$out" | tail -2 | tr '\n' '|'))"
assert_lock "(2) go versionless" "$C2/.ai-factory/synthesizer-output/rules-lock.go.json" "null"
rm -rf "$C2"

# ── (3) python + versionless manifest — the second writer (45-python.sh), same defect shape ──────
echo ""; echo "  ── (3) python: versionless generation-context manifest ──"
P3=$(mktemp -d)
printf '[project]\nname = "demo"\nversion = "0.0.1"\n' > "$P3/pyproject.toml"
seed_ctx "$P3" '{"rules": []}'
out=$( cd "$P3" && bash "$INSTALL" python --force < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(3) python versionless: install completed (rc=0)" \
  || bad "(3) python versionless: install exit $rc — lane aborted (RED arm; tail: $(printf '%s' "$out" | tail -2 | tr '\n' '|'))"
assert_lock "(3) python versionless" "$P3/.getff/rules-lock.python.json" "null"
rm -rf "$P3"

# ── (4) cargo + many-match manifest (failure mode b: SIGPIPE 141 through `head -1`) ──────────────
echo ""; echo "  ── (4) cargo: many-match manifest (~150KiB of grep output > 64KiB pipe buffer) ──"
C4=$(mktemp -d)
printf '[package]\nname = "demo"\nversion = "0.0.1"\nedition = "2021"\n\n[dependencies]\n' > "$C4/Cargo.toml"
many_match_ctx "$C4"
out=$( cd "$C4" && bash "$INSTALL" cargo --force < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(4) cargo many-match: install completed (rc=0)" \
  || bad "(4) cargo many-match: install exit $rc — lane aborted (RED arm; tail: $(printf '%s' "$out" | tail -2 | tr '\n' '|'))"
assert_lock "(4) cargo many-match" "$C4/.ai-factory/synthesizer-output/rules-lock.cargo.json" "null"
rm -rf "$C4"

# ── (5) python + many-match manifest — failure mode b on the second writer ───────────────────────
echo ""; echo "  ── (5) python: many-match manifest (~150KiB of grep output > 64KiB pipe buffer) ──"
P5=$(mktemp -d)
printf '[project]\nname = "demo"\nversion = "0.0.1"\n' > "$P5/pyproject.toml"
many_match_ctx "$P5"
out=$( cd "$P5" && bash "$INSTALL" python --force < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(5) python many-match: install completed (rc=0)" \
  || bad "(5) python many-match: install exit $rc — lane aborted (RED arm; tail: $(printf '%s' "$out" | tail -2 | tr '\n' '|'))"
assert_lock "(5) python many-match" "$P5/.getff/rules-lock.python.json" "null"
rm -rf "$P5"

# ── (6) HEALTHY PATH, cargo: a manifest WITH a version still surfaces it in the lock ─────────────
# Regression guard for the fix: `|| true` must not weaken the extraction — the healthy lock bytes
# are identical to the pre-fix ones (rules-lock-malformed-values arm 4 covers the no-manifest null).
echo ""; echo "  ── (6) healthy path, cargo: manifest with version → lock carries it ──"
C6=$(mktemp -d)
printf '[package]\nname = "demo"\nversion = "0.0.1"\nedition = "2021"\n\n[dependencies]\n' > "$C6/Cargo.toml"
seed_ctx "$C6" '{"framework": "cargo", "version": "15.0.0", "rules": []}'
out=$( cd "$C6" && bash "$INSTALL" cargo --force < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(6) cargo healthy: install completed (rc=0)" \
  || bad "(6) cargo healthy: install exit $rc — lane aborted; tail: $(printf '%s' "$out" | tail -2 | tr '\n' '|')"
assert_lock "(6) cargo healthy" "$C6/.ai-factory/synthesizer-output/rules-lock.cargo.json" '"15.0.0"'
rm -rf "$C6"

# ── (7) HEALTHY PATH, python: same guard on the second writer ───────────────────────────────────
echo ""; echo "  ── (7) healthy path, python: manifest with version → lock carries it ──"
P7=$(mktemp -d)
printf '[project]\nname = "demo"\nversion = "0.0.1"\n' > "$P7/pyproject.toml"
seed_ctx "$P7" '{"framework": "python", "version": "15.0.0", "rules": []}'
out=$( cd "$P7" && bash "$INSTALL" python --force < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(7) python healthy: install completed (rc=0)" \
  || bad "(7) python healthy: install exit $rc — lane aborted; tail: $(printf '%s' "$out" | tail -2 | tr '\n' '|')"
assert_lock "(7) python healthy" "$P7/.getff/rules-lock.python.json" '"15.0.0"'
rm -rf "$P7"

echo ""
echo "── rules-lock-version-grep-null-tolerant: $PASS passed, $FAIL failed ──"
[ "$FAIL" -eq 0 ]
