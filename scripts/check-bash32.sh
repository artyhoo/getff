#!/usr/bin/env bash
# check-bash32.sh — refuse bash-4-only syntax and BSD-userland traps in the shell that install.sh
# runs on a consumer's Mac: /bin/bash 3.2 with BSD sed and awk.
#
# WHY. install.sh and every setup.d/*.sh it sources run under `set -euo pipefail` on macOS's stock
# /bin/bash 3.2. GitHub runners are bash ≥5 with GNU userland, so CI cannot see any of the defects
# below — each one shipped green and aborted, or silently truncated, an install on the host:
#   B32-ASSOC   `declare/local/typeset -A` (no associative arrays before 4.0: the subscript is read
#               as arithmetic — PR #1190), `-n` namerefs (4.3)
#   B32-BASH4   mapfile / readarray / coproc (4.0), `${v,,}` / `${v^^}` case modification (4.0)
#   B32-EMPTY   an element expansion "${A[@]}" / "${A[*]}" of an array that can be empty: bash <4.4
#               aborts with `A[@]: unbound variable` under set -u (GH #531, PR #544)
#   B32-EXPORT  `export A=(…)` — on 3.2 it is silently function-local inside a function, and bash
#               cannot export an array at all (PR #989)
#   B32-SEDALT  BRE `\|` in sed — BSD sed has no alternation, so the pattern silently matches
#               nothing (PR #1623)
#   B32-AWKV    `awk -v x="$v"` where $v is assigned a multi-line value in the same file — BSD awk
#               dies with `newline in string` (PR #1623, left a 0-byte delivered file)
#
# WHAT COUNTS AS "CAN BE EMPTY" (B32-EMPTY). A name, across the whole scanned population (setup.d
# is sourced into install.sh, so globals cross files), that is ever initialised empty — `A=()`,
# `A=($(…))` / `A=($v)` (word-splitting an empty value), `read -a A`, `declare/local -a A` without
# a value — or that is only ever appended to (`A+=(…)`, unset until the first append), or a copy
# `A=("${B[@]}")` of such a B. A literal seed `A=(x y)` is non-empty. Accepted without a finding:
# the guard `${A[@]+"${A[@]}"}`, and a `${#A[@]}` length TEST (`-gt 0`, `-eq 0`, `> 0`, `(( … ))`)
# earlier in the same function (or earlier at top level) — a bare `echo "${#A[@]}"` is not a test.
#
# ESCAPE. A comment `# bash32-safe: <rationale>` on the flagged line or the line directly above,
# rationale ≥20 characters saying why the shape cannot bite here (e.g. why the array is never empty
# at that point). A shorter rationale is itself a finding (B32-ESCAPE).
#
# DECLARED LIMITS (line-level scan, no parser). Heredoc bodies and the continuation lines of a
# multi-line quoted string are skipped — they are text for another program; code written after a
# multi-line string closes, on that same line, is not read. Array names are matched by spelling
# across the population, so two unrelated locals of one name share a verdict (use the escape).
# B32-AWKV sees only multi-line values assigned in the same file by an open `"` across lines, a
# `$'…\n…'` literal, `$(cat <<…)` or `printf -v` with a `\n` format; a value read from a file or a
# command's output is not judged. A `${#A[@]}` check that tests for zero and still falls into the
# loop is accepted (any earlier length test in the function counts: a heuristic, not flow analysis).
# Build-vs-reuse: prior-art-evaluations.md#302 (ShellCheck measured — covers none of
# this set for a bash-3.2 target).
#
# Usage: bash scripts/check-bash32.sh [file…]
#   no files → the population: git-tracked install.sh + setup.d/** shell files (by extension or
#   shebang). Exit 0 clean, 1 findings, 2 usage / unreadable file.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"

files=()
if [ "$#" -gt 0 ]; then
  for f in "$@"; do
    if [ ! -r "$f" ] || [ -d "$f" ]; then
      echo "check-bash32: cannot read '$f'" >&2
      exit 2
    fi
    files+=("$f")
  done
else
  while IFS= read -r f; do
    [ -f "$REPO_ROOT/$f" ] || continue
    case "$f" in
      *.sh) files+=("$REPO_ROOT/$f") ;;
      *.*) ;;
      *) if grep -Eq '^#!.*(ba)?sh' <<<"$(head -n 1 "$REPO_ROOT/$f")"; then files+=("$REPO_ROOT/$f"); fi ;;
    esac
  done < <(git -C "$REPO_ROOT" ls-files -- install.sh 'setup.d/**')
fi

if [ "${#files[@]}" -eq 0 ]; then
  echo "check-bash32: no files to scan — refusing to report clean" >&2
  exit 2
fi

# Pass 1 (pass=1) builds the array table and each file's multi-line variable names; pass 2 reports.
# POSIX awk only: it runs under BSD awk on the Mac and mawk on ubuntu runners.
out=$(LC_ALL=C awk -v root="$REPO_ROOT/" '
function reset_file() { hd = ""; dq = 0; sq = 0; pend = ""; pendno = 0; fnbody = "" }
function rel(p) { return index(p, root) == 1 ? substr(p, length(root) + 1) : p }
# scan(line): walk one physical line, carrying quote state across lines. Sets cmt (the comment
# text, "" if none), code (the line up to its comment), startq (line began inside a quote), endcont
# (ends with a backslash continuation outside quotes), newhd (a heredoc tag opened on this line).
function scan(s,   i, c, n, rest, t) {
  startq = (dq || sq); cmt = ""; code = s; newhd = ""; endcont = 0
  n = length(s)
  for (i = 1; i <= n; i++) {
    c = substr(s, i, 1)
    if (sq) { if (c == "\047") sq = 0; continue }
    if (c == "\\") { if (i == n && !dq) endcont = 1; i++; continue }
    if (dq) { if (c == "\"") dq = 0; continue }
    if (c == "\047") { sq = 1; continue }
    if (c == "\"") { dq = 1; continue }
    if (c == "#" && (i == 1 || substr(s, i - 1, 1) ~ /[ \t;]/)) {
      cmt = substr(s, i); code = substr(s, 1, i - 1); return
    }
    if (c == "<" && substr(s, i, 2) == "<<" && substr(s, i, 3) != "<<<") {
      rest = substr(s, i + 2)
      sub(/^-/, "", rest); sub(/^[ \t]*/, "", rest); sub(/^[\047"]/, "", rest)
      if (match(rest, /^[A-Za-z_][A-Za-z0-9_]*/)) newhd = substr(rest, 1, RLENGTH)
      i++
    }
  }
}
function note_array(name, kind) {
  if (kind == "empty") empty[name] = 1
  else if (kind == "append") appended[name] = 1
  else seeded[name] = 1
}
# Pass-1 facts from one logical code line.
function learn(L, fname,   s, s2, src, name, body, t) {
  s = L
  while (match(s, /[A-Za-z_][A-Za-z0-9_]*(\+)?=\(/)) {
    t = substr(s, RSTART, RLENGTH); s2 = substr(s, RSTART + RLENGTH)
    name = t; sub(/(\+)?=\($/, "", name)
    if (t ~ /\+=\($/) note_array(name, "append")
    else {
      body = s2; sub(/^[ \t]*/, "", body)
      if (match(body, /^"?\$\{[A-Za-z_][A-Za-z0-9_]*\[[@*]\]\}"?[ \t]*\)/)) {
        # a copy A=("${B[@]}") can be empty exactly when B can (resolved in can_empty)
        src = substr(body, 1, RLENGTH); sub(/^"?\$\{/, "", src); sub(/\[.*/, "", src)
        copyof[name] = (name in copyof) ? copyof[name] " " src : src
      } else if (body ~ /^\)/ || body ~ /^\$/ || body ~ /^"\$\{[A-Za-z_][A-Za-z0-9_]*\[[@*]\]\}"/ || body ~ /^\$\{[A-Za-z_][A-Za-z0-9_]*\[[@*]\]/) note_array(name, "empty")
      else note_array(name, "seed")
    }
    s = s2
  }
  s = L
  while (match(s, /(declare|typeset|local)[ \t]+-[a-zA-Z]*a[a-zA-Z]*[ \t]+[A-Za-z_][A-Za-z0-9_]*/)) {
    t = substr(s, RSTART, RLENGTH); s2 = substr(s, RSTART + RLENGTH)
    name = t; sub(/.*[ \t]/, "", name)
    if (s2 !~ /^=/) note_array(name, "empty")
    s = s2
  }
  s = L
  while (match(s, /read[ \t]+(-[a-zA-Z]+[ \t]+)*-[a-zA-Z]*a[ \t]*[A-Za-z_][A-Za-z0-9_]*/)) {
    t = substr(s, RSTART, RLENGTH); name = t; sub(/.*[ \ta]/, "", name)
    note_array(name, "empty"); s = substr(s, RSTART + RLENGTH)
  }
  if (match(L, /printf[ \t]+-v[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]+[\047"][^\047"]*\\n/)) {
    t = substr(L, RSTART, RLENGTH); sub(/^printf[ \t]+-v[ \t]+/, "", t); sub(/[ \t].*/, "", t)
    multi[fname, t] = 1
  }
  if (match(L, /[A-Za-z_][A-Za-z0-9_]*(\+)?=\$\047[^\047]*\\n/) || match(L, /[A-Za-z_][A-Za-z0-9_]*(\+)?=\$\(cat[ \t]*<</)) {
    t = substr(L, RSTART, RLENGTH); sub(/(\+)?=.*/, "", t); multi[fname, t] = 1
  }
}
function report(no, id, msg) {
  if (esc_ok(no)) return
  printf "%s:%d: %s %s\n", rel(FILENAME), no, id, msg
  nfind++
}
# An escape on line no (trailing) or on the comment line directly above.
function esc_ok(no,   c) {
  c = (no in cmts) ? cmts[no] : ""
  if (c !~ /bash32-safe:/ && ((no - 1) in cmtonly)) c = cmts[no - 1]
  if (c !~ /bash32-safe:/) return 0
  sub(/.*bash32-safe:[ \t]*/, "", c); sub(/[ \t]+$/, "", c)
  if (length(c) >= 20) return 1
  printf "%s:%d: B32-ESCAPE bash32-safe rationale is %d chars — needs >= 20 saying why the shape cannot bite here\n", rel(FILENAME), no, length(c)
  nfind++
  return 1
}
function check(L, no,   s, t, name, near, k, after) {
  if (L ~ /(^|[;&|({ \t])(declare|typeset|local|readonly)[ \t]+(-[a-zA-Z]+[ \t]+)*-[a-zA-Z]*[An][a-zA-Z]*([ \t]|$)/)
    report(no, "B32-ASSOC", "associative array (-A) or nameref (-n): bash 4 only — use a newline-delimited string + grep -Fxq, or a case table")
  if (L ~ /(^|[;&|({ \t])(mapfile|readarray|coproc)([ \t]|$)/)
    report(no, "B32-BASH4", "mapfile/readarray/coproc: bash 4 only — use a while IFS= read -r loop")
  if (L ~ /\$\{([A-Za-z_][A-Za-z0-9_]*|[0-9@*])(\[[^]]*\])?(,|\^)/)
    report(no, "B32-BASH4", "${v,,}/${v^^} case modification: bash 4 only — use tr")
  if (L ~ /(^|[;&|({ \t])export[ \t]+[A-Za-z_][A-Za-z0-9_]*=\(/)
    report(no, "B32-EXPORT", "export A=(…): function-local on bash 3.2 and arrays cannot be exported — assign A=(…) plainly")
  s = L
  if (match(s, /(^|[;&|({ \t])sed([ \t]|$)/)) {
    after = substr(s, RSTART + RLENGTH)
    if (after !~ /^[ \t]*(-[a-zA-Z]*[Er][a-zA-Z]*|--regexp-extended)([ \t]|$)/ && (after ~ /^\\\|/ || after ~ /[^\\]\\\|/))
      report(no, "B32-SEDALT", "BRE \\| in sed: BSD sed has no alternation (silently matches nothing) — use sed -E with (a|b), or awk")
  }
  if (L ~ /(^|[;&|({ \t])awk[ \t]/) {
    s = L
    while (match(s, /-v[ \t]*[A-Za-z_][A-Za-z0-9_]*="?\$\{?[A-Za-z_][A-Za-z0-9_]*/)) {
      t = substr(s, RSTART, RLENGTH); s = substr(s, RSTART + RLENGTH)
      name = t; sub(/.*\$\{?/, "", name)
      if ((FILENAME, name) in multi)
        report(no, "B32-AWKV", "awk -v fed $" name ", which is assigned a multi-line value: BSD awk dies with `newline in string` — pass it through a file or ENVIRON")
    }
  }
  s = L
  gsub(/\$\{[A-Za-z_][A-Za-z0-9_]*\[[@*]\]\+"?\$\{[A-Za-z_][A-Za-z0-9_]*\[[@*]\]\}"?\}/, "", s)
  while (match(s, /\$\{[A-Za-z_][A-Za-z0-9_]*\[[@*]\]\}/)) {
    t = substr(s, RSTART, RLENGTH); s = substr(s, RSTART + RLENGTH)
    name = t; sub(/^\$\{/, "", name); sub(/\[.*/, "", name)
    if (!can_empty(name, 0)) continue
    if (seen_emp[no, name]++) continue
    if (guarded(L "\n" fnbody, name)) continue
    report(no, "B32-EMPTY", "\"${" name "[@]}\" of an array that can be empty aborts bash 3.2 under set -u — use ${" name "[@]+\"${" name "[@]}\"} or a ${#" name "[@]} check")
  }
}
# Can the array be empty where it is expanded? Empty-initialised, append-only, or a copy of one
# that can be (depth-limited: a copy cycle reads as non-empty rather than looping).
function can_empty(name, depth,   srcs, n, i) {
  if (name in empty) return 1
  if ((name in appended) && !(name in seeded) && !(name in copyof)) return 1
  if (!(name in copyof) || depth > 8) return 0
  n = split(copyof[name], srcs, " ")
  for (i = 1; i <= n; i++) if (can_empty(srcs[i], depth + 1)) return 1
  return 0
}
# A length TEST of name — `${#A[@]} -gt 0`, `-eq 0`, `> 0`, `(( ${#A[@]} ))` — in text. A bare
# mention (`echo "${#A[@]} items"`) is not a test and does not count.
function guarded(text, name,   re) {
  re = "\\$\\{#" name "\\[[@*]\\]\\}\"?[ \t]*(-(gt|ge|eq|ne|lt|le)|>|==|!=|\\)\\))"
  return text ~ re
}
# fnbody: the code since the enclosing function header (or the file start at top level).
function note_body(L) {
  if (L ~ /^[ \t]*(function[ \t]+)?[A-Za-z_][A-Za-z0-9_:.-]*[ \t]*\(\)/) fnbody = ""
  fnbody = fnbody "\n" L
}
FNR == 1 { reset_file(); if (pass == 2) nfiles++ }
{
  line = $0
  if (hd != "") { t = line; sub(/^\t*/, "", t); if (t == hd) hd = ""; next }
  scan(line)
  if (cmt != "") { cmts[FNR] = cmt; if (code ~ /^[ \t]*$/) cmtonly[FNR] = 1 }
  if (newhd != "") hd = newhd
  if (startq) next
  if (pend == "") pendno = FNR
  pend = pend code
  if (endcont) { sub(/\\$/, " ", pend); next }
  L = pend; pend = ""
  if (L ~ /^[ \t]*$/) next
  if ((dq) && match(L, /[A-Za-z_][A-Za-z0-9_]*(\+)?="[^"]*$/)) {
    t = substr(L, RSTART, RLENGTH); sub(/(\+)?=.*/, "", t); multi[FILENAME, t] = 1
  }
  if (pass == 1) learn(L, FILENAME)
  else { note_body(L); check(L, pendno) }
}
END {
  if (pass == 2) printf "check-bash32: scanned %d file(s), %d finding(s)\n", nfiles, nfind
}
' pass=1 "${files[@]}" pass=2 "${files[@]}") || { echo "$out" >&2; echo "check-bash32: awk failed" >&2; exit 2; }

echo "$out"
case "$out" in
  *"B32-"*) exit 1 ;;
esac
exit 0
