#!/usr/bin/env bash
# check-bash32.test.sh — paired positive/negative fixtures for scripts/check-bash32.sh
# (the bash-3.2 / BSD-userland portability gate over install.sh + setup.d/**).
#
# Arms:
#   P1-P13 the gate FIRES: declare/local/typeset -A, local -n, mapfile, readarray, case-modifying
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
#   L1     the live population (install.sh + setup.d/**) is clean — the gate's real subject
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
# fixture <label> <want: fire|quiet> <body> — one script per arm, scanned by explicit path
fixture() {
  local label="$1" want="$2" body="$3" f out rc
  n=$((n+1)); f="$TMP/f$n.sh"
  printf '#!/usr/bin/env bash\nset -euo pipefail\n%s\n' "$body" > "$f"
  out=$(bash "$CHECK" "$f" 2>&1) && rc=0 || rc=$?
  case "$want:$rc" in
    fire:1|quiet:0) ok "$label" ;;
    *) bad "$label — want $want, rc=$rc: $(tr '\n' '|' <<<"$out")" ;;
  esac
}

echo "── fires"
fixture "P1 declare -A (no associative arrays before bash 4.0)" fire 'declare -A SEEN=()'
fixture "P2 local -Ax / typeset -A in a function" fire 'f() { local -Ax m; typeset -A n; }'
fixture "P3 local -n nameref (bash 4.3)" fire 'f() { local -n ref="$1"; echo "$ref"; }'
fixture "P4 mapfile / readarray (bash 4.0)" fire 'mapfile -t lines < f
readarray -t more < g'
fixture "P5 \${v,,} / \${v^^} case modification (bash 4.0)" fire 'lo="${1,,}"; up="${1^^}"'
fixture "P6 unguarded \"\${A[@]}\" of an empty-initialised array" fire 'SKIPPED=()
for s in "${SKIPPED[@]}"; do echo "$s"; done'
fixture "P7 unguarded \"\${A[*]}\" and bare \${A[@]}" fire 'local_list=()
printf "%s\n" "${local_list[*]}"; echo ${local_list[@]}'
fixture "P8 an array seeded from a command substitution can be empty" fire 'files=($(ls /nonexistent 2>/dev/null))
for f in "${files[@]}"; do :; done'
fixture "P9 an append-only array is unset until the first +=" fire 'if [ -n "${X:-}" ]; then acc+=(x); fi
echo "${acc[@]}"'
fixture "P10 export A=(…) — function-local on 3.2, never exported" fire 'f() { export ARR=(a b); }'
fixture "P11 BRE \\| in sed (BSD sed has no alternation)" fire "v=\$(sed -n 's/^\\(select\\|extend\\)=//p' cfg)"
fixture "P13 a copy of an empty-capable array is empty-capable" fire 'SRC=()
DST=( "${SRC[@]+"${SRC[@]}"}" )
COPY=( "${SRC[@]}" )
for x in "${COPY[@]}"; do :; done'
fixture "P12 awk -v fed a variable assigned a multi-line value" fire 'body="line one
line two"
awk -v b="$body" '"'"'{ print b }'"'"' f'

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
if [ "$rc" -eq 0 ] && grep -q 'scanned [1-9][0-9]* file' <<<"$out"; then
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
