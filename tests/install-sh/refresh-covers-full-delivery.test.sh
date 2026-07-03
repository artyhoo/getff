#!/usr/bin/env bash
# refresh-covers-full-delivery.test.sh — #869: every framework-owned consumer SCRIPT
# that a --full install delivers to scripts/ MUST also be re-copied by --refresh.
#
# Closes the recurring "refresh omits a --full-delivered artefact" class (#635 hooks/
# package.json, #735 pre-push dep, #869 check-fences-fire.sh + check-shields-up.sh).
# Root mechanism: setup.d/40-configs.sh delivers via copy_safe, which SKIPS-if-exists.
# So a brownfield consumer only ever receives an UPDATED framework script through
# do_refresh() (install.sh), whose refresh_safe OVERWRITES. A script delivered by
# --full but omitted from do_refresh can therefore never reach an already-installed
# consumer non-destructively — the framework's own fixes false-RED forever on it.
#
# This is the mechanical form of the install.sh:228 invariant comment
#   "@sync-with-layers: do_refresh mirrors the layer-by-layer install".
# install-self-verification.test.sh arm (vii) checks the --full (copy_safe) side;
# THIS gate checks the --refresh (do_refresh) side of the same delivery.
#
# Population = the .sh / .ts targets of copy_safe → scripts/ (executable audit gates).
# Directory payloads (e.g. scripts/fences-fire-fixtures) are intentionally OUT of this
# gate's population: refresh_safe's `cp -r` nests-into an existing directory rather than
# replacing it, so directory-refresh is a separate capability (tracked follow-up, #869
# morning report) — not a script this gate governs.
#
# Deterministic, no network: awk over do_refresh() + grep over setup.d. Paired-negative
# arm proves the set-difference is non-vacuous (a real omission flips the gate RED).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

[ -f "$INSTALL" ] || { echo "FATAL: $INSTALL not found"; exit 1; }

# ── EXCLUDED: .sh/.ts targets deliberately NOT refreshed (data-driven escape hatch) ──
# Currently empty. Add "<basename> — <rationale>" here only with a documented reason a
# --full-delivered script must NOT be refreshed. (fences-fire-fixtures is a DIRECTORY,
# already outside the .sh/.ts population below — it needs no entry here.)
EXCLUDED=""

# ── FULL: every .sh/.ts that a --full install copy_safe's into scripts/ ──────────────
# Scan ALL setup.d/*.sh (not just 40-configs.sh) so a future delivery move is still seen.
# shellcheck disable=SC2016  # single-quoted regex matches the literal '$PROJECT_ROOT' in source; no expansion intended
FULL=$(grep -hE 'copy_safe' "$REPO_ROOT"/setup.d/*.sh 2>/dev/null \
  | grep -oE '\$PROJECT_ROOT/scripts/[A-Za-z0-9._-]+\.(sh|ts)"' \
  | sed -E 's#.*/scripts/##; s/"$//' | sort -u)

# ── REFRESH: every scripts/*.{sh,ts} literal inside the do_refresh() function body ──
# awk extracts the function body (from `do_refresh() {` to its closing `}` at col 0),
# so it survives line-number drift and catches BOTH the loop pairs ("...:scripts/X.sh")
# and the var-assigned stack targets (_rn_dst="$PROJECT_ROOT/scripts/audit-ai-docs...").
refresh_body() {
  awk '/^do_refresh\(\) \{/{f=1} f{print} f&&/^\}/{exit}' "$INSTALL"
}
REFRESH=$(refresh_body | grep -oE 'scripts/[A-Za-z0-9._-]+\.(sh|ts)' | sed 's#scripts/##' | sort -u)

# Guard against a broken harness silently passing (empty sets ⇒ vacuous green).
[ -n "$FULL" ]    || { echo "FATAL: FULL set empty — copy_safe→scripts/ extraction broke"; exit 1; }
[ -n "$REFRESH" ] || { echo "FATAL: REFRESH set empty — do_refresh() extraction broke"; exit 1; }

# ── pos: FULL ⊆ (REFRESH ∪ EXCLUDED) ────────────────────────────────────────────────
compute_missing() {  # $1 = refresh set (newline list); prints FULL entries not in it/EXCLUDED
  local refresh="$1" f
  for f in $FULL; do
    printf '%s\n' "$refresh"  | grep -qxF "$f" && continue
    printf '%s\n' "$EXCLUDED" | grep -qxF "$f" && continue
    printf '%s ' "$f"
  done
}

missing=$(compute_missing "$REFRESH")
if [ -z "${missing// }" ]; then
  ok "every --full-delivered scripts/*.{sh,ts} is re-copied by do_refresh() (no refresh drift)"
else
  bad "script(s) delivered by --full but OMITTED from do_refresh() → brownfield consumers can't get fixes:$missing"
fi

# ── neg (LOAD-BEARING): drop one known-present entry from REFRESH → gate MUST flag it ──
# probe MUST be a FULL∩REFRESH entry — dropping it from REFRESH then creates a REAL gap
# (compute_missing only iterates FULL, so a REFRESH-only entry would prove nothing).
probe=""
for f in $FULL; do
  if printf '%s\n' "$REFRESH" | grep -qxF "$f"; then probe="$f"; break; fi
done
[ -n "$probe" ] || { echo "FATAL: no FULL∩REFRESH entry to probe non-vacuity with"; exit 1; }
REFRESH_BROKEN=$(printf '%s\n' "$REFRESH" | grep -vxF "$probe")
neg_missing=$(compute_missing "$REFRESH_BROKEN")
case " $neg_missing " in
  *" $probe "*) ok "neg: removing '$probe' from the refresh set flips the gate to flag it (non-vacuous)" ;;
  *)           bad "neg: gate stayed green with '$probe' dropped from refresh → set-difference is VACUOUS" ;;
esac

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
