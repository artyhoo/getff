#!/usr/bin/env bash
# tests/install-sh/snapshot-exclusion-guard.test.sh — adapter-jig C3 (snapshot-exclusion-no-drift-mask).
#
# The byte-identical snapshot harness (tests/install-sh/snapshot.sh compute_fingerprint) excludes a
# small set of VOLATILE artefacts (timestamped audit logs + wall-clock rules-locks) so the baselines
# stay deterministic. The C3 invariant (spec §3.3, W3 #1078 origin): exclusions are listed PER-FILE,
# never glob-wide — excluding a volatile artefact must NOT mask drift of a sibling DETERMINISTIC
# artefact. A mutation-swallowing exclusion is itself the defect this suite REDs on.
#
# BEHAVIORAL arms (J2 decisions log #7 — behavioral primary, meta-grep sentinel secondary):
#   (1) pos — mutating ONLY excluded volatile files leaves the fingerprint EQUAL (the exclusions do
#       their one job: volatile drift ignored; the deterministic content of the excluded lock is
#       separately gated by python-rules-lock.test.sh — the targeted guard the exclusion points at).
#   (2) neg — mutating ONE byte of a DELIVERED DETERMINISTIC artefact still MOVES the fingerprint
#       (drift is caught WITH the exclusions in place).
#   (3) neg discriminator — a deliberately-broadened glob-wide exclusion (-not -path '*/.getff/*')
#       over the SAME mutated tree swallows the mutation (fingerprints equal) → proving glob-wide
#       exclusion is exactly the drift-mask C3 forbids; assertion (2) would go RED under it.
#   (4) sentinel — every `-not -name` exclusion in the REAL snapshot.sh is a literal filename
#       (allowlist) except the single benign '*.tmp' glob, and NO delivered artefact matches '*.tmp'
#       (the honest narrow finding from recon group C: pin the glob harmless, don't let it grow).
#
# Uses the REAL compute_fingerprint extracted from tests/install-sh/snapshot.sh (not a re-typed
# copy — a drifted duplicate would judge a pipeline nobody runs).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
SNAPSHOT="$REPO_ROOT/tests/install-sh/snapshot.sh"
INSTALL="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

echo "▶ Snapshot exclusion guard (adapter-jig C3) — volatile-only exclusions never mask deterministic drift"
echo ""

# ── Extract the REAL compute_fingerprint (anchored function block; refuses an empty extraction) ────
FN_SRC=$(sed -n '/^compute_fingerprint()/,/^}/p' "$SNAPSHOT")
if [ -z "$FN_SRC" ] || ! printf '%s' "$FN_SRC" | grep -q 'find "\$dir" -type f'; then
  bad "could not extract compute_fingerprint from snapshot.sh (anchor moved?) — fix the extraction, do not skip"
  echo "PASS=$PASS FAIL=$FAIL"; exit 1
fi
eval "$FN_SRC"
ok "extracted the REAL compute_fingerprint from snapshot.sh (anchored, non-empty)"

# A deliberately-BROADENED variant: same pipeline + a glob-wide .getff/ exclusion. This is the
# violating implementation the C3 negative discriminates against (never shipped — test-local only).
compute_fingerprint_broadened() {
  local dir="$1"
  find "$dir" -type f \
    -not -path '*/.git/*' \
    -not -path '*/node_modules/*' -not -name '*.tmp' \
    -not -name '.getff-python-install.log' \
    -not -name '.getff-cargo-install.log' \
    -not -name 'rules-lock.cargo.json' \
    -not -name 'rules-lock.python.json' \
    -not -path '*/.getff/*' \
    | sort \
    | while IFS= read -r f; do
        local h
        if command -v sha256sum >/dev/null 2>&1; then
          h=$(sha256sum "$f" | awk '{print $1}')
        elif command -v shasum >/dev/null 2>&1; then
          h=$(shasum -a 256 "$f" | awk '{print $1}')
        else
          h=$(md5 -q "$f" 2>/dev/null || echo "NOHASH")
        fi
        printf '%s  %s\n' "$h" "${f#"$dir/"}"
      done
}

# ── Fixture: one real python greenfield install (the lane whose lock/log ARE the exclusions) ──────
P=$(mktemp -d)
cat > "$P/pyproject.toml" <<'EOF'
[project]
name = "exclusion-guard-consumer"
version = "1.0.0"
EOF
( cd "$P" && git init -q && git config user.email t@t.co && git config user.name t ) >/dev/null 2>&1
( cd "$P" && bash "$INSTALL" python --force < /dev/null ) >/dev/null 2>&1 || true
[ -f "$P/.getff/astgrep-rules/getff-no-eval.yml" ] && [ -f "$P/.getff/rules-lock.python.json" ] \
  && ok "fixture: python lane delivered (rules dir + rules-lock present)" \
  || { bad "fixture: python delivery incomplete — cannot judge the exclusions"; echo "PASS=$PASS FAIL=$FAIL"; exit 1; }
BASE_FP=$(compute_fingerprint "$P")

# ── (1) positive: mutate ONLY excluded volatile files → fingerprint EQUAL ─────────────────────────
# @arm:C3:pos snapshot-exclusion-no-drift-mask (volatile-only mutation invisible by design)
printf '{"emittedAt-touch": true}\n' >> "$P/.getff/rules-lock.python.json"
printf '# late audit line\n' >> "$P/.getff-python-install.log"
FP_VOLATILE=$(compute_fingerprint "$P")
[ "$BASE_FP" = "$FP_VOLATILE" ] \
  && ok "(1) mutating ONLY the excluded volatile artefacts (rules-lock + audit log) leaves the fingerprint EQUAL" \
  || bad "(1) volatile-only mutation moved the fingerprint — an exclusion is not actually excluding"

# ── (2) negative: mutate ONE byte of a delivered DETERMINISTIC artefact → fingerprint MOVES ───────
# @arm:C3:neg snapshot-exclusion-no-drift-mask (deterministic drift STILL caught with exclusions live)
printf '#' >> "$P/.getff/astgrep-rules/getff-no-eval.yml"
FP_MUTATED=$(compute_fingerprint "$P")
[ "$BASE_FP" != "$FP_MUTATED" ] \
  && ok "(2) one-byte drift in a delivered rule (.getff/astgrep-rules/getff-no-eval.yml) MOVES the fingerprint — exclusions do not mask sibling drift" \
  || bad "(2) deterministic-artefact drift was SWALLOWED — an exclusion is masking delivered-artefact drift (the C3 defect)"

# ── (3) the glob-wide discriminator: broadened exclusion swallows the SAME mutation ───────────────
# Still @arm:C3:neg — proves assertion (2) discriminates: under a glob-wide '*/.getff/*' exclusion
# the identical mutated tree fingerprints EQUAL (drift-mask), so (2) would go RED against it.
BASE_FP_BROAD=$(compute_fingerprint_broadened "$P")   # tree already mutated — recompute both sides
# un-mutate is impossible cheaply; instead compare broadened(mutated) vs broadened(re-mutated again):
printf '#' >> "$P/.getff/astgrep-rules/getff-no-eval.yml"
FP_BROAD_2=$(compute_fingerprint_broadened "$P")
[ "$BASE_FP_BROAD" = "$FP_BROAD_2" ] \
  && ok "(3) glob-wide '*/.getff/*' exclusion swallows delivered-rule drift entirely (fingerprints equal across mutations) — exactly the drift-mask C3 forbids" \
  || bad "(3) broadened exclusion did NOT swallow the mutation — discriminator fixture is broken"

# ── (4) sentinel: real exclusions are literal filenames; the sole glob is '*.tmp' and it is inert ──
# The honest narrow finding (recon C3): '-not -name *.tmp' (snapshot.sh) is the single glob-wide
# exclusion; benign only while NO delivered artefact matches it. Pin both facts.
NAME_EXCLUSIONS=$(printf '%s\n' "$FN_SRC" | grep -oE -- "-not -name '[^']*'" | sed -E "s/-not -name '([^']*)'/\1/")
NON_LITERAL=$(printf '%s\n' "$NAME_EXCLUSIONS" | grep -E '[*?[]' | grep -vxF '*.tmp' || true)
[ -z "$NON_LITERAL" ] \
  && ok "(4) every '-not -name' exclusion is a literal filename except the pinned '*.tmp' (no new glob-wide exclusion crept in)" \
  || bad "(4) NON-LITERAL exclusion(s) beyond '*.tmp' found in snapshot.sh: $(echo "$NON_LITERAL" | tr '\n' ' ') — glob-wide exclusions are the C3 defect"
TMP_MATCHES=$(find "$P" -type f -name '*.tmp' -not -path '*/.git/*' 2>/dev/null | head -5)
[ -z "$TMP_MATCHES" ] \
  && ok "(4) no delivered artefact matches '*.tmp' — the one allowed glob is inert on the delivered tree" \
  || bad "(4) delivered artefact(s) match '*.tmp' and are invisibly excluded: $(echo "$TMP_MATCHES" | tr '\n' ' ')"

rm -rf "$P"
echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
