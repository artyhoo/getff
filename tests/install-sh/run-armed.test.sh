#!/usr/bin/env bash
# run-armed.test.sh — P2 C2/C3/C7 (one-button): scripts/run-armed.sh runs what the project's record arms.
# The record is the <!-- aif:project-checks:begin/end --> block of .ai-factory/tool-decisions.md: under
# `armed:` and `not-armed:` one runnable command per line (`- <command>`), a not-armed one keeping its
# reason after ` # `. `validate`, the delivered CI steps, lint-staged and the pre-push probe read it.
#   (A) validate runs every armed command, does not stop at a failure, exits 1 and names the failed one
#   (B) validate: a not-armed command never blocks; exit 0 → moved to armed (the re-arm, no human step);
#       a red one stays not-armed with its reason
#   (C) a missing record, a missing block, a block without its headers → exit 2, loudly (advisor note b)
#   (D) empty `armed:` / `not-armed:` lists are valid when the record says so → validate exits 0
#   (E) one command: armed → runs (its exit code); not-armed → skipped with the reason, exit 0;
#       not in the record → runs (a check is never skipped by leaving it out)
#   (F) --if-armed '<command>' <cmd…>: runs <cmd…> with its arguments only while <command> is not
#       listed not-armed (the lint-staged wrapper)
#   (G) --probe: the not-armed half of validate only; armed commands are not run
#   (H) another block in the same file (P3's installed-versions block, before or after) is left byte-for-byte
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
RA="$REPO_ROOT/packages/core/audit-self/run-armed.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
TMPS=()
cleanup() { [ "${#TMPS[@]}" -gt 0 ] && rm -rf "${TMPS[@]}"; }
trap cleanup EXIT

# proj <armed lines> <not-armed lines> — a git repo whose record holds those lines (newline-separated).
proj() {
  local d; d=$(mktemp -d); TMPS+=("$d")
  git -C "$d" init -q; mkdir -p "$d/.ai-factory"
  {
    echo "# Tool decisions"; echo
    echo "<!-- aif:project-checks:begin -->"
    echo "### How this project checks itself (recorded by install.sh 2026-09-29)"
    echo "stack: react-spa"
    echo "armed:"; [ -n "$1" ] && printf '%s\n' "$1" | sed 's/^/- /'
    echo "not-armed:"; [ -n "$2" ] && printf '%s\n' "$2" | sed 's/^/- /'
    echo "<!-- aif:project-checks:end -->"
  } > "$d/.ai-factory/tool-decisions.md"
  echo "$d"
}
section() { awk -v h="$2:" '/^[a-z-]+:$/{f=($0==h);next} /^<!--/{f=0} f' "$1/.ai-factory/tool-decisions.md"; }

# ── (A) armed failures do not stop the rest ─────────────────────────────────────────────────────
A=$(proj $'echo one > a1.txt\nexit 3\necho three > a3.txt' "")
out=$( cd "$A" && bash "$RA" validate 2>&1 ); rc=$?
[ "$rc" -eq 1 ] && ok "(A) an armed failure → validate exits 1" || bad "(A) validate rc=$rc"
[ -f "$A/a1.txt" ] && [ -f "$A/a3.txt" ] && ok "(A) every armed command ran, after the failure too" || bad "(A) a3/a1 missing"
grep -q 'exit 3' <<< "$out" && ok "(A) the failed command is named" || bad "(A) failure not named: $out"

# ── (B) not-armed never blocks; green moves to armed ───────────────────────────────────────────
B=$(proj "true" $'echo hi > b.txt # was red at install\nexit 1 # 3 type errors at install')
out=$( cd "$B" && bash "$RA" validate 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(B) not-armed commands never fail validate" || bad "(B) rc=$rc: $out"
section "$B" armed | grep -qx -- '- echo hi > b.txt' && ok "(B) a green not-armed command moved to armed" || bad "(B) not moved: $(section "$B" armed)"
section "$B" not-armed | grep -q 'echo hi' && bad "(B) the moved command is still under not-armed" || ok "(B) and left not-armed"
section "$B" not-armed | grep -qx -- '- exit 1 # 3 type errors at install' && ok "(B) a red one stays not-armed, reason kept" || bad "(B) red one changed: $(section "$B" not-armed)"
grep -q '3 type errors at install' <<< "$out" && ok "(B) the not-armed reason is printed" || bad "(B) reason not printed"

# ── (C) no readable record → exit 2, loudly ────────────────────────────────────────────────────
C=$(mktemp -d); TMPS+=("$C"); git -C "$C" init -q
out=$( cd "$C" && bash "$RA" validate 2>&1 ); rc=$?
[ "$rc" -eq 2 ] && grep -q 'record' <<< "$out" && ok "(C) no tool-decisions.md → exit 2, says so" || bad "(C) rc=$rc: $out"
mkdir -p "$C/.ai-factory"; echo "# Tool decisions" > "$C/.ai-factory/tool-decisions.md"
( cd "$C" && bash "$RA" validate >/dev/null 2>&1 ); rc=$?
[ "$rc" -eq 2 ] && ok "(C) a file with no block → exit 2" || bad "(C) no block rc=$rc"
printf '<!-- aif:project-checks:begin -->\nstack: x\n<!-- aif:project-checks:end -->\n' > "$C/.ai-factory/tool-decisions.md"
( cd "$C" && bash "$RA" validate >/dev/null 2>&1 ); rc=$?
[ "$rc" -eq 2 ] && ok "(C) a block without armed:/not-armed: headers → exit 2" || bad "(C) headerless rc=$rc"
( cd "$C" && bash "$RA" npm run lint >/dev/null 2>&1 ); rc=$?
[ "$rc" -eq 2 ] && ok "(C) one-command mode also exits 2 with no record" || bad "(C) one-command rc=$rc"

# ── (D) empty lists are a valid record ─────────────────────────────────────────────────────────
D=$(proj "" "")
( cd "$D" && bash "$RA" validate >/dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(D) empty armed + not-armed → validate exits 0" || bad "(D) rc=$rc"

# ── (E) one command ────────────────────────────────────────────────────────────────────────────
E=$(proj $'exit 4' $'exit 5 # red at install')
( cd "$E" && bash "$RA" exit 4 >/dev/null 2>&1 ); rc=$?
[ "$rc" -eq 4 ] && ok "(E) an armed command runs, its exit code is kept" || bad "(E) armed rc=$rc"
out=$( cd "$E" && bash "$RA" exit 5 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && grep -q 'red at install' <<< "$out" && ok "(E) a not-armed command is skipped with its reason" || bad "(E) not-armed rc=$rc: $out"
( cd "$E" && bash "$RA" exit 6 >/dev/null 2>&1 ); rc=$?
[ "$rc" -eq 6 ] && ok "(E) a command not in the record runs" || bad "(E) unlisted rc=$rc"

# ── (F) --if-armed ─────────────────────────────────────────────────────────────────────────────
F=$(proj "npm run lint" "npm run format:check # 3 files")
( cd "$F" && bash "$RA" --if-armed "npm run lint" touch f-lint.txt f-lint2.txt >/dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && [ -f "$F/f-lint.txt" ] && [ -f "$F/f-lint2.txt" ] && ok "(F) armed → the wrapped command runs with every argument" || bad "(F) armed wrapper rc=$rc"
( cd "$F" && bash "$RA" --if-armed "npm run format:check" touch f-fmt.txt >/dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && [ ! -f "$F/f-fmt.txt" ] && ok "(F) not-armed → the wrapped command does not run, exit 0" || bad "(F) not-armed wrapper rc=$rc"
( cd "$F" && bash "$RA" --if-armed "npm run lint" sh -c 'exit 7' >/dev/null 2>&1 ); rc=$?
[ "$rc" -eq 7 ] && ok "(F) the wrapped command's failure is its exit code (pre-commit still blocks)" || bad "(F) rc=$rc"

# ── (G) --probe runs the not-armed half only ───────────────────────────────────────────────────
G=$(proj "touch g-armed.txt" "touch g-probe.txt # red at install")
( cd "$G" && bash "$RA" --probe >/dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && [ -f "$G/g-probe.txt" ] && [ ! -f "$G/g-armed.txt" ] && ok "(G) --probe runs only not-armed commands" || bad "(G) rc=$rc"
section "$G" armed | grep -qx -- '- touch g-probe.txt' && ok "(G) and arms the green one" || bad "(G) not armed"

# ── (H) a neighbour block is untouched ─────────────────────────────────────────────────────────
H=$(proj "" "true # was red")
f="$H/.ai-factory/tool-decisions.md"
printf '\n<!-- GETFF_VERSIONS_BEGIN -->\n| eslint | 9.39.5 |\n<!-- GETFF_VERSIONS_END -->\n' >> "$f"
{ printf '<!-- GETFF_VERSIONS_BEGIN -->\n| typescript | 5.9.3 |\n<!-- GETFF_VERSIONS_END -->\n\n'; cat "$f"; } > "$f.new" && mv "$f.new" "$f"
before=$(grep -v '^- \|^armed:\|^not-armed:' "$f")
( cd "$H" && bash "$RA" validate >/dev/null 2>&1 )
[ "$(grep -v '^- \|^armed:\|^not-armed:' "$f")" = "$before" ] && ok "(H) blocks before and after the record are left byte-for-byte" || bad "(H) neighbour changed"
section "$H" armed | grep -qx -- '- true' && ok "(H) the record itself was still updated" || bad "(H) record not updated"

# ── (I) a command that reads stdin cannot swallow the rest of the list (cold review M3) ─────────
I=$(proj $'cat > /dev/null\nexit 7' $'cat > /dev/null\necho probed > p.txt')
out=$( cd "$I" && bash "$RA" validate 2>&1 ); rc=$?
[ "$rc" -eq 1 ] && grep -q 'exit 7' <<<"$out" && [ -f "$I/p.txt" ] \
  && ok "(I) after a stdin reader the next armed and not-armed commands still run" \
  || bad "(I) rc=$rc, p.txt $( [ -f "$I/p.txt" ] && echo present || echo absent): $(tr '\n' '|' <<<"$out")"

# ── (J) the record is read beside the script, not at the git toplevel (cold review M5) ──────────
J=$(proj "" ""); mkdir -p "$J/apps/web/scripts" "$J/apps/web/.ai-factory"
mv "$J/.ai-factory/tool-decisions.md" "$J/apps/web/.ai-factory/"; cp "$RA" "$J/apps/web/scripts/run-armed.sh"
( cd "$J/apps/web" && bash scripts/run-armed.sh validate >/dev/null 2>&1 ) \
  && ok "(J) an install below the git toplevel reads its own record" || bad "(J) install below the toplevel: exit $?"

# ── (K) a CRLF record is read (cold review m1) ───────────────────────────────────────────────────
K=$(proj 'true' 'echo k > k.txt'); f="$K/.ai-factory/tool-decisions.md"
sed 's/$/\r/' "$f" > "$f.crlf" && mv "$f.crlf" "$f"
( cd "$K" && bash "$RA" validate >/dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && tr -d '\r' < "$f" | awk '/^armed:$/{f=1;next} /^not-armed:$/{f=0} f' | grep -qx -- '- echo k > k.txt' \
  && ok "(K) a CRLF record validates and its probe arms" || bad "(K) CRLF record: rc=$rc"

# ── (L) a record that cannot be written is not reported as armed (cold review m3) ────────────────
L=$(proj "" 'true'); chmod a-w "$L/.ai-factory/tool-decisions.md"
out=$( cd "$L" && bash "$RA" --probe 2>&1 ); chmod u+w "$L/.ai-factory/tool-decisions.md"
grep -q 'armed now' <<<"$out" && bad "(L) a failed write was reported armed: $out" \
  || ok "(L) a failed write is not reported armed"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
