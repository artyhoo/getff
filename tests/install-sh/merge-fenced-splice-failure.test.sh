#!/usr/bin/env bash
# merge-fenced-splice-failure.test.sh — ledger A1-8 (PR #1597 local review).
#
# setup.d/lib.sh merge_fenced case (b) wrote the spliced file with
#   awk … "$dst" > "$tmp" && mv "$tmp" "$dst"
# followed by an UNCONDITIONAL `✓ … replaced`. Two silent-corruption paths:
#   (a) awk or the redirect fails → `&&` skips mv, the old fenced body survives, the
#       half-written <dst>.getff.tmp is left in the consumer tree, and the installer
#       still reports success;
#   (b) $src is present but unreadable → awk's `getline line < SRC` returns -1 without
#       failing the program (measured on macOS awk; POSIX-permitted everywhere), so the
#       consumer's fenced section is replaced with an EMPTY body under a `✓`.
#
# Injection: `awk` is shadowed by a shell function returning 2. Deterministic and
# uid-independent (no chmod), and the redirect still creates $tmp — which is exactly the
# stale-tmp state arm A asserts against.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
note() { echo "  ⊝ $1"; }

# Globals merge_fenced reads from dispatcher scope (setup.d/lib.sh header block).
PKG_ROOT="$REPO_ROOT"; PROJECT_ROOT="$REPO_ROOT"; FORCE=""; DRY_RUN=""; UPSTREAM_BLOB_URL=""
SKIPPED=()
INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"

mk_case() {  # $1 = dir — a consumer AGENTS.md already carrying our fence
  printf '# Consumer AGENTS.md\n\n<!-- getff:begin section=core -->\n\nOLD-BODY-LINE\n\n<!-- getff:end section=core -->\n\nconsumer tail\n' > "$1/AGENTS.md"
  printf 'NEW-BODY-LINE\n' > "$1/src.md"
}
has_skipped() { case " ${SKIPPED[*]:-} " in *" $1 "*) return 0 ;; esac; return 1; }

# ── (A) splice failure — the A1-8 core case ──────────────────────────────────
T=$(mktemp -d); mk_case "$T"; SKIPPED=()
awk() { return 2; }
merge_fenced "$T/src.md" "$T/AGENTS.md" core > "$T/out" 2>&1; rc=$?
unset -f awk
out=$(cat "$T/out")
case "$out" in *"section=core replaced"*) bad "A: success line printed despite a failed splice: $out" ;; *) ok "A: no '✓ … replaced' when the splice fails" ;; esac
case "$out" in *"⚠"*"$T/AGENTS.md"*) ok "A: a ⚠ warning names the file the splice failed on" ;; *) bad "A: no ⚠ warning naming the file: $out" ;; esac
[ -e "$T/AGENTS.md.getff.tmp" ] && bad "A: stale AGENTS.md.getff.tmp left in the consumer tree" || ok "A: no stale .getff.tmp left behind"
grep -qF 'OLD-BODY-LINE' "$T/AGENTS.md" && ok "A: consumer file left unchanged (old body intact)" || bad "A: consumer file mutated by a failed splice"
has_skipped "$T/AGENTS.md" && ok "A: dst recorded in SKIPPED (surfaces in the install summary)" || bad "A: dst NOT recorded in SKIPPED"
[ "$rc" -eq 0 ] && ok "A: merge_fenced returns 0 (fail-open, never aborts the install)" || bad "A: rc=$rc"
rm -rf "$T"

# ── (B) paired-positive: a healthy splice still replaces + reports success ────
T=$(mktemp -d); mk_case "$T"; SKIPPED=()
merge_fenced "$T/src.md" "$T/AGENTS.md" core > "$T/out" 2>&1; rc=$?
out=$(cat "$T/out")
case "$out" in *"section=core replaced"*) ok "B: healthy splice still prints '✓ … replaced'" ;; *) bad "B: success line lost on the happy path: $out" ;; esac
grep -qF 'NEW-BODY-LINE' "$T/AGENTS.md" && ok "B: new body spliced in" || bad "B: new body missing"
grep -qF 'OLD-BODY-LINE' "$T/AGENTS.md" && bad "B: old body still present" || ok "B: old body dropped"
grep -qF 'consumer tail' "$T/AGENTS.md" && ok "B: consumer content outside the fence preserved" || bad "B: consumer tail lost"
has_skipped "$T/AGENTS.md" && bad "B: healthy splice wrongly recorded in SKIPPED" || ok "B: SKIPPED untouched on the happy path"
[ -e "$T/AGENTS.md.getff.tmp" ] && bad "B: tmp left behind on the happy path" || ok "B: tmp cleaned up on the happy path"
rm -rf "$T"

# ── (C) unreadable src → refuse, never an empty fenced body ──────────────────
# chmod is only an effective injection for a non-root uid; the arm states plainly when
# it could not be exercised rather than counting a vacuous pass.
T=$(mktemp -d); mk_case "$T"; SKIPPED=()
chmod 000 "$T/src.md"
if head -c 1 "$T/src.md" >/dev/null 2>&1; then
  note "C: not exercised — $T/src.md still readable (uid $(id -u)); chmod is not an injection here"
else
  merge_fenced "$T/src.md" "$T/AGENTS.md" core > "$T/out" 2>&1
  out=$(cat "$T/out")
  case "$out" in *"section=core replaced"*) bad "C: '✓ … replaced' printed for an unreadable src: $out" ;; *) ok "C: unreadable src does not report success" ;; esac
  grep -qF 'OLD-BODY-LINE' "$T/AGENTS.md" && ok "C: fenced body not emptied when src is unreadable" || bad "C: fenced section replaced with an empty body"
  has_skipped "$T/AGENTS.md" && ok "C: dst recorded in SKIPPED" || bad "C: dst NOT recorded in SKIPPED"
fi
chmod 644 "$T/src.md"; rm -rf "$T"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
