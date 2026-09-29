#!/usr/bin/env bash
# check-pipefail-early-exit.test.sh — paired positive/negative fixtures for
# scripts/check-pipefail-early-exit.mjs (the SIGPIPE-under-pipefail gate).
#
# Arms:
#   P1-P10 the gate FIRES: printf/echo/command producers into grep -q, --quiet, -l, -m, a cluster
#          (-Eq), a negated check, a line-continued pipe, a pipe inside $(…) (also within double
#          quotes), a `<<TAG` inside a quoted string that must not hide the lines after it
#   P11-P16 the gate FIRES: printf/echo into head / sed q / awk exit where the pipeline status is
#          read — a bare assignment or a statement under errexit, an if condition
#   N1-N9  the gate stays QUIET: here-strings, `||` (not a pipe), a `|` inside the grep pattern,
#          grep -c / plain grep, `-s` (no-messages, not silent), a script without pipefail, a heredoc
#          body, a comment, an escape with a real rationale
#   N10-N17 the gate stays QUIET on the early-reader shape where the status is not read (local,
#          export, || true, a test or argument), without errexit, with an external producer, or
#          with a reader that drains its input (sed without q, awk without exit)
#   E1     an escape whose rationale is under 20 characters is itself a finding
#   S1     the sourced-under-pipefail population (setup.d/*.sh) is scanned without its own `set`
#   R1-R3  the checker's exit code is 1 on findings and 0 when clean (CLI contract)
#   R4     invoked through a symlinked directory, the checker still runs (no silent exit 0)
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECK="$REPO_ROOT/scripts/check-pipefail-early-exit.mjs"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
n=0
# fixture <label> <want: fire|quiet> <body> [header] — one script per arm, scanned with --any
fixture() {
  local label="$1" want="$2" body="$3" header="${4-#!/usr/bin/env bash
set -euo pipefail}" f out rc
  n=$((n+1)); f="$TMP/f$n.sh"
  printf '%s\n%s\n' "$header" "$body" > "$f"
  out=$(cd "$REPO_ROOT" && node "$CHECK" --any "$f" 2>&1) && rc=0 || rc=$?
  case "$want:$rc" in
    fire:1|quiet:0) ok "$label" ;;
    *) bad "$label — want $want, rc=$rc: $(tr '\n' '|' <<<"$out")" ;;
  esac
}

echo "── fires"
fixture "P1 printf '%s\\n' \"\$v\" | grep -q" fire 'if printf '"'"'%s\n'"'"' "$v" | grep -q x; then :; fi'
fixture "P2 echo \"\$v\" | grep --quiet, negated" fire 'if ! echo "$v" | grep --quiet x; then exit 1; fi'
fixture "P3 command producer | grep -Eq (cluster)" fire 'git ls-files | grep -Eq "^a|b$" && echo hit'
fixture "P4 | grep -l / | grep -m1 in a substitution" fire 'x=$(printf "%s\n" "$v" | grep -m1 y)'
fixture "P5 line-continued pipe" fire 'if printf "%s\n" "$v" \
    | grep -qxF "$w"; then :; fi'
fixture "P6 pipe at line end" fire 'claude plugin list 2>/dev/null |
  grep -q superpowers || echo missing'
fixture "P7 env-prefixed grep" fire 'cat f | LC_ALL=C grep -qi z'
fixture "P8 grep -l on stdin" fire 'find . | grep -l foo'
fixture "P9 a pipe inside \"\$(…)\" within double quotes" fire 'echo "skip: $(echo "$v" | grep -m1 x | head -c 300)"'
fixture "P10 a <<'TAG' inside a quoted string opens no heredoc" fire 'printf "cat <<'"'"'OUT'"'"'\n%s\nOUT" "$1"
echo "$v" | grep -q x'

echo "── fires: a builtin producer into an early reader whose status is read (head / sed q / awk exit)"
fixture "P11 v=\"\$(printf '%s\\n' \"\$x\" | head -1)\" (setup.d/eslint-wire.sh:56, 2026-09-29)" fire '_r2_verdict="$(printf '"'"'%s\n'"'"' "$_r2_out" | head -1)"'
fixture "P12 v=\$(echo | sed q)" fire 'v=$(echo "$x" | sed q)'
fixture "P13 v=\$(printf | awk '{…; exit}')" fire 'v=$(printf '"'"'%s\n'"'"' "$x" | awk '"'"'{ print; exit }'"'"')'
fixture "P14 a statement-level printf | head -5 under set -e" fire 'printf '"'"'%s\n'"'"' "$x" | head -5'
fixture "P15 if v=\$(echo | head -n 1) — the status is the condition" fire 'if v=$(echo "$x" | head -n 1); then :; fi' '#!/usr/bin/env bash
set -uo pipefail'
fixture "P16 the early reader mid-pipeline" fire 'v=$(printf '"'"'%s\n'"'"' "$x" | head -3 | tr "\n" " ")'

echo "── quiet"
fixture "N1 here-string" quiet 'grep -q x <<<"$v"; grep -q y <<<"$(git ls-files)"'
fixture "N2 || is not a pipe" quiet '[ -f a ] || grep -q x b'
fixture "N3 | inside the grep pattern" quiet 'grep -qE "a|b" <<<"$v"; grep -q '"'"'x | grep -q y'"'"' file'
fixture "N4 grep -c / plain grep read all input" quiet 'n=$(printf "%s\n" "$v" | grep -c x); printf "%s\n" "$v" | grep -v y'
fixture "N5 -s is --no-messages, not --silent" quiet 'cat f | grep -s x'
fixture "N6 a script without pipefail" quiet 'printf "%s\n" "$v" | grep -q x' '#!/usr/bin/env bash
set -eu'
fixture "N7 heredoc body is text for another program" quiet 'cat > stub.sh <<EOF
printf "%s\n" "\$v" | grep -q x
EOF
cat > stub2.sh <<-'"'"'EOT'"'"'
	echo x | grep -q x
	EOT'
fixture "N8 a comment naming the pattern" quiet '# never: printf | grep -q under pipefail
echo ok # or here: echo "$v" | grep -q x'
fixture "N9 escape with a real rationale" quiet '# sigpipe-safe: the producer writes one short line in a single write
echo "$v" | grep -q x
echo "$v" | grep -q y # sigpipe-safe: single echo of one line, below any pipe buffer'

fixture "N10 parameter expansion instead of a pipe" quiet 'v=${x%%$'"'"'\n'"'"'*}'
fixture "N11 local / export mask the status" quiet 'f() { local v=$(printf '"'"'%s\n'"'"' "$x" | head -1); export w=$(echo "$x" | head -1); }'
fixture "N12 || true / || : mask the status" quiet 'v=$(printf '"'"'%s\n'"'"' "$x" | head -1) || true; w=$(echo "$x" | sed q) || :'
fixture "N13 a substitution inside a test / an argument" quiet '[ "$(printf '"'"'%s\n'"'"' "$x" | head -1)" = y ]; bad "out=$(echo "$o" | head -3 | tr x y)"'
fixture "N14 an external producer (one stdio write for small output) is the declared limit" quiet 'v=$(grep x file | head -1)'
fixture "N15 a bare assignment without errexit ignores the status" quiet 'v=$(printf '"'"'%s\n'"'"' "$x" | head -1)' '#!/usr/bin/env bash
set -uo pipefail'
fixture "N16 sed without q / awk without exit read all input" quiet 'v=$(printf '"'"'%s\n'"'"' "$x" | sed -n 1p); w=$(echo "$x" | awk "{print \$1}")'
fixture "N17 a head reading a file, not a pipe" quiet 'v=$(head -1 "$f")'

echo "── escape rationale"
fixture "E1 a short rationale is a finding" fire 'echo "$v" | grep -q x # sigpipe-safe: fine'

echo "── population"
mkdir -p "$TMP/repo/setup.d"
printf '%s\n' '# sourced by install.sh — no set line here' 'printf "%s\n" "$v" | grep -q x' > "$TMP/repo/setup.d/99-x.sh"
printf '%s\n' '# sourced by install.sh' 'grep -q x <<<"$v"' > "$TMP/repo/setup.d/98-y.sh"
printf 'a\tclaude plugin list 2>/dev/null | grep -q a\tinstall a\tcc-plugin\t*\n' > "$TMP/repo/setup.d/companions.manifest"
printf 'b\tgrep -q b <<<"$(claude plugin list 2>/dev/null)"\tinstall b\tcc-plugin\t*\n' > "$TMP/repo/setup.d/ok.manifest"
git -C "$TMP/repo" init -q
out=$(cd "$TMP/repo" && node "$CHECK" setup.d/99-x.sh setup.d/98-y.sh setup.d/companions.manifest 2>&1) && rc=0 || rc=$?
if grep -q '^setup.d/99-x.sh:2:' <<<"$out"; then ok "S1 setup.d/*.sh is scanned as sourced under pipefail"
else bad "S1 setup.d/99-x.sh not flagged: $(tr '\n' '|' <<<"$out")"; fi
if grep -q '^setup.d/companions.manifest:1:' <<<"$out"; then ok "S2 a manifest detect_cmd pipe is flagged at its row"
else bad "S2 manifest row not flagged: $(tr '\n' '|' <<<"$out")"; fi
if grep -q '98-y' <<<"$out"; then bad "S3 a clean setup.d file was flagged"; else ok "S3 a clean setup.d file is not flagged"; fi
if [ "$rc" -eq 1 ]; then ok "R1 findings → exit 1"; else bad "R1 findings exit $rc, want 1"; fi
out=$(cd "$TMP/repo" && node "$CHECK" setup.d/98-y.sh 2>&1) && rc=0 || rc=$?
if [ "$rc" -eq 0 ]; then ok "R2 clean → exit 0"; else bad "R2 clean exit $rc: $out"; fi
out=$(cd "$TMP/repo" && node "$CHECK" setup.d/ok.manifest 2>&1) && rc=0 || rc=$?
if [ "$rc" -eq 0 ] && grep -q '0 file' <<<"$out"; then ok "R3 a file outside the population is skipped without --any"
else bad "R3 out-of-population file: rc=$rc $out"; fi
# R4: invoked through a symlinked directory the checker must still run (the entry-point
# check once compared import.meta.url, resolved through symlinks, to the unresolved argv[1],
# so every run from a symlinked checkout exited 0 with no output — a silent pass).
ln -s "$REPO_ROOT/scripts" "$TMP/linked-scripts"
out=$(cd "$TMP/repo" && node "$TMP/linked-scripts/check-pipefail-early-exit.mjs" setup.d/99-x.sh 2>&1) && rc=0 || rc=$?
if [ "$rc" -eq 1 ] && grep -q '^setup.d/99-x.sh:2:' <<<"$out"; then ok "R4 run through a symlinked path still scans"
else bad "R4 symlinked invocation: rc=$rc $(tr '\n' '|' <<<"$out")"; fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
