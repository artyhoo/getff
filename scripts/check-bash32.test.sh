#!/usr/bin/env bash
# check-bash32.test.sh — paired positive/negative fixtures for scripts/check-bash32.sh
# (the bash-3.2 / BSD-userland portability gate over install.sh + setup.d/**).
#
# Arms:
#   P1-P16 the gate FIRES, and reports the expected finding id (and line where it matters): declare/local/typeset -A, local -n, mapfile, readarray, case-modifying
#          expansions, an unguarded element expansion of an array that can be empty ("${A[@]}",
#          "${A[*]}", unquoted), an array seeded from a command substitution, an append-only array,
#          `export A=(…)`, BRE `\|` in sed, `awk -v` fed a variable assigned a multi-line value, a copy
#          of an empty-capable array
#   N1-N14 the gate stays QUIET: the `${A[@]+"${A[@]}"}` guard, a `${#A[@]}` length test earlier
#          in the function (not only right above), a copy of a literal seed, a non-empty literal
#          seed, "$@", a comment line, a heredoc body, sed -E, an escaped `\\|` in a replacement,
#          `awk -v` with a single-line value / a literal, an escape with a real rationale, plain
#          `export V=x`
#   E1     an escape whose rationale is under 20 characters is itself a finding
#   R1-R3  CLI contract: 1 on findings, 0 when clean, 2 on a missing file
#   Q1-Q4  quote / heredoc state (ANSI-C quotes, quotes nested in $(…), arithmetic <<, a
#          backslash-quoted heredoc tag) never hides the lines after it
#   L1     the live population (install.sh + setup.d/**) is clean and every file is scanned
#   H1     on a host whose /bin/bash is 3.2, every P-arm's shape really aborts there (the gate's
#          premise is measured, not assumed); skipped with a line when /bin/bash is not 3.2
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECK="$REPO_ROOT/scripts/check-bash32.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
n=0
# fixture <label> <want> <body> — one script per arm, scanned by explicit path. <want> is `quiet`,
# or `fire:<ID>` (a finding with that id must be reported), or `fire:<ID>@<line>` (…on that line of
# the body, 1-based). Asserting the id, not only rc=1, keeps a multi-shape arm from passing on the
# wrong shape.
fixture() {
  local label="$1" want="$2" body="$3" f out rc id line
  n=$((n+1)); f="$TMP/f$n.sh"
  printf '#!/usr/bin/env bash\nset -euo pipefail\n%s\n' "$body" > "$f"
  out=$(bash "$CHECK" "$f" 2>&1) && rc=0 || rc=$?
  case "$want" in
    quiet)
      if [ "$rc" -eq 0 ]; then ok "$label"; else bad "$label — want quiet, rc=$rc: $(tr '\n' '|' <<<"$out")"; fi ;;
    fire:*)
      id=${want#fire:}; line=""
      case "$id" in *@*) line=$((${id#*@} + 2)); id=${id%@*} ;; esac
      if [ "$rc" -eq 1 ] && grep -Eq ":${line:-[0-9]+}: $id " <<<"$out"; then ok "$label"
      else bad "$label — want $want, rc=$rc: $(tr '\n' '|' <<<"$out")"; fi ;;
  esac
}

echo "── fires"
fixture "P1 declare -A (no associative arrays before bash 4.0)" fire:B32-ASSOC 'declare -A SEEN=()'
fixture "P2a local -Ax in a function" fire:B32-ASSOC 'f() { local -Ax m; }'
fixture "P2b typeset -A" fire:B32-ASSOC 'typeset -A n'
fixture "P3 local -n nameref (bash 4.3)" fire:B32-ASSOC 'f() { local -n ref="$1"; echo "$ref"; }'
fixture "P4a mapfile (bash 4.0)" fire:B32-BASH4 'mapfile -t lines < f'
fixture "P4b readarray (bash 4.0)" fire:B32-BASH4 'readarray -t more < g'
fixture "P5a \${1,,} case modification of a positional" fire:B32-BASH4 'lo="${1,,}"'
fixture "P5b \${v^^} case modification" fire:B32-BASH4 'up="${v^^}"'
fixture "P6 unguarded \"\${A[@]}\" of an empty-initialised array" fire:B32-EMPTY@2 'SKIPPED=()
for s in "${SKIPPED[@]}"; do echo "$s"; done'
fixture "P7a unguarded \"\${A[*]}\"" fire:B32-EMPTY@2 'local_list=()
printf "%s\n" "${local_list[*]}"'
fixture "P7b unquoted \${A[@]}" fire:B32-EMPTY@2 'other=()
echo ${other[@]}'
fixture "P8 an array seeded from a command substitution can be empty" fire:B32-EMPTY@2 'files=($(ls /nonexistent 2>/dev/null))
for f in "${files[@]}"; do :; done'
fixture "P9 an append-only array is unset until the first +=" fire:B32-EMPTY@2 'if [ -n "${X:-}" ]; then acc+=(x); fi
echo "${acc[@]}"'
fixture "P10 export A=(…) — function-local on 3.2, never exported" fire:B32-EXPORT 'f() { export ARR=(a b); }'
fixture "P11 BRE \\| in sed (BSD sed has no alternation)" fire:B32-SEDALT "v=\$(sed -n 's/^\\(select\\|extend\\)=//p' cfg)"
fixture "P11b BRE \\\\| inside double quotes reaches sed as \\|" fire:B32-SEDALT 'v=$(sed -n "s/a\\|b/x/p" f)'
fixture "P12 awk -v fed a variable assigned a multi-line value" fire:B32-AWKV 'body="line one
line two"
awk -v b="$body" '"'"'{ print b }'"'"' f'
fixture "P12b awk -v \"x=\$v\" spelling" fire:B32-AWKV 'body="line one
line two"
awk -v "b=$body" '"'"'{ print b }'"'"' f'
fixture "P13 a copy of an empty-capable array is empty-capable (only the copy can fire)" fire:B32-EMPTY@3 'SRC=()
COPY=( "${SRC[@]}" )  # bash32-safe: this arm isolates the use of the copy on the next line
for x in "${COPY[@]}"; do :; done'
fixture "P14 read -ra fills an array that can be empty" fire:B32-EMPTY@2 'read -ra data <<< "$x"
for i in "${data[@]}"; do :; done'
fixture "P15 A=(\"\$@\") is empty when called with no arguments" fire:B32-EMPTY 'g() { local A=("$@"); echo "${A[@]}"; }'
fixture "P16 a length test in ANOTHER function does not guard (function kw form)" fire:B32-EMPTY@3 'L=()
function a { [ ${#L[@]} -gt 0 ] && echo y; }
function b { for i in "${L[@]}"; do :; done; }'

echo "── quote / heredoc state never hides the rest of the file"
for q in "Q1 ANSI-C quote with an escaped quote|x=\$'it\\'s'" \
         "Q2 double quotes nested in a \$(…) inside double quotes|y=\"\$(printf '%s' \"it's\")\"" \
         "Q3 arithmetic << is a shift, not a heredoc|z=\$(( 1 << n ))" \
         "Q4 a backslash-quoted heredoc tag|cat << \\EOF
it's text
EOF"; do
  fixture "${q%%|*}" fire:B32-ASSOC "${q#*|}
f() { local -A m; }"
done

echo "── stays quiet"
fixture "N1 the \${A[@]+\"\${A[@]}\"} guard" quiet 'SKIPPED=()
for s in ${SKIPPED[@]+"${SKIPPED[@]}"}; do echo "$s"; done'
fixture "N2 a \${#A[@]} length check right above" quiet 'SKIPPED=()
if [ "${#SKIPPED[@]}" -gt 0 ]; then
  for s in "${SKIPPED[@]}"; do echo "$s"; done
fi'
fixture "N3 a non-empty literal seed" quiet 'candidates=(a b c)
for c in "${candidates[@]}"; do :; done'
fixture "N4 \"\$@\" is exempt from set -u" quiet 'f() { for a in "$@"; do :; done; }'
fixture "N5 a comment line naming the patterns" quiet '# never: declare -A, mapfile, sed '"'"'s/a\|b//'"'"', "${A[@]}"'
fixture "N6 a heredoc body is text, not code" quiet 'cat <<'"'"'EOF'"'"'
declare -A x; mapfile -t y
EOF
echo done'
fixture "N7 sed -E alternation is portable ERE" quiet "sed -E 's/(a|b)\\|c//' f"
fixture "N8 an escaped \\\\| in a sed replacement" quiet "msg=\$(printf '%s' \"\$m\" | sed 's/|/\\\\|/g')"
fixture "N9 awk -v with a single-line variable and a literal" quiet 'm="marker"
awk -v m="$m" -v sq="'"'"'" '"'"'$0 == m'"'"' f'
fixture "N10 an escape with a real rationale" quiet 'LIST=()
# bash32-safe: LIST is appended in every branch of the case above before this loop runs
for x in "${LIST[@]}"; do :; done'
fixture "N11 plain export V=x" quiet 'f() { export V=x; }'
fixture "N13 a copy of a literal-seeded array is non-empty" quiet 'CORE=(a b)
ALL=( "${CORE[@]}" )
for x in "${ALL[@]}"; do :; done'
fixture "N14 a length test anywhere earlier in the function" quiet 'f() {
  local acc=()
  [ "${#acc[@]}" -eq 0 ] && return 0
  echo one; echo two; echo three; echo four; echo five; echo six
  printf "%s\n" "${acc[@]}"
}'
fixture "N12 \${#A[@]} alone is safe" quiet 'A=()
echo "${#A[@]}"'

echo "── escape discipline"
fixture "E1 an escape with a rationale under 20 chars is a finding" fire 'LIST=()
# bash32-safe: fine
for x in "${LIST[@]}"; do :; done'

echo "── CLI contract"
printf '#!/usr/bin/env bash\ndeclare -A x\n' > "$TMP/r1.sh"
rc=0; bash "$CHECK" "$TMP/r1.sh" >/dev/null 2>&1 || rc=$?
if [ "$rc" -eq 1 ]; then ok "R1 findings → exit 1"; else bad "R1 findings → exit 1 (got $rc)"; fi
printf '#!/usr/bin/env bash\necho ok\n' > "$TMP/r2.sh"
rc=0; bash "$CHECK" "$TMP/r2.sh" >/dev/null 2>&1 || rc=$?
if [ "$rc" -eq 0 ]; then ok "R2 clean → exit 0"; else bad "R2 clean → exit 0 (got $rc)"; fi
rc=0; bash "$CHECK" "$TMP/does-not-exist.sh" >/dev/null 2>&1 || rc=$?
if [ "$rc" -eq 2 ]; then ok "R3 missing file → exit 2 (never a silent pass)"; else bad "R3 missing file → exit 2 (got $rc)"; fi

echo "── live population"
out=$(cd "$REPO_ROOT" && bash "$CHECK" 2>&1) && rc=0 || rc=$?
want_files=$(git -C "$REPO_ROOT" ls-files -- install.sh 'setup.d/*.sh' | wc -l | tr -d ' ')
if [ "$rc" -eq 0 ] && grep -q "scanned $want_files file" <<<"$out"; then
  ok "L1 install.sh + setup.d/** are clean ($(tail -1 <<<"$out"))"
else
  bad "L1 live population — rc=$rc: $out"
fi

echo "── host premise"
if /bin/bash -c '[ "${BASH_VERSINFO[0]}" -eq 3 ]' 2>/dev/null; then
  premise() {
    local label="$1" body="$2" rc=0
    /bin/bash -c "set -euo pipefail; $body" >/dev/null 2>&1 || rc=$?
    if [ "$rc" -ne 0 ]; then ok "H1 $label aborts on /bin/bash 3.2"; else bad "H1 $label ran clean on /bin/bash 3.2"; fi
  }
  premise "declare -A key lookup" 'declare -A S; S[a/b]=1; echo "${S[a/b]}"'
  premise "mapfile" 'mapfile -t x < /dev/null'
  premise "empty \"\${A[@]}\" under set -u" 'A=(); for x in "${A[@]}"; do :; done'
  premise "empty \"\${A[*]}\" under set -u" 'A=(); echo "${A[*]}"'
  premise "export A=() in a function" 'f() { export B=(1); }; f; echo "${#B[@]}"'
  premise "\${v,,}" 'v=A; echo "${v,,}"'
else
  echo "  - H1 skipped: /bin/bash is not 3.2 here (CI runners are bash ≥5; the premise is measured on the Mac)"
fi

echo
echo "check-bash32: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
