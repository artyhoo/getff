#!/usr/bin/env bash
# check-rule-globs.sh — the "+V" verify-gate for cih-s3 F3 (glob liveness).
#
# The custom ESLint rules (R2/R7/R8) only fire on files their `files` globs match. If those
# globs match ZERO of the project's source files the rule is SILENTLY INERT — "looks armed,
# checks nothing", the worst failure for a "no check → no rule" framework. F3 broadened the
# globs to be layout-agnostic (flat / layered / monorepo), but no glob set covers every
# layout — so this gate is the ALARM: it FAILS if an ACTIVE custom rule matches no source
# file, telling the consumer to widen RULE_GLOBS in eslint.config.mjs before the silent gap
# ships. (Maintainer DN-1 = "A+V": parameterize globs AND ship the verify-gate regardless.)
#
# Active rules: R2 (boundary) is always checked; R7 (appCode) + R8 (application) are checked
# only when AIF_STRICT_RUNTIME=1 (they are opt-in per F7 — see eslint.config.mjs).
#
# Dependency-free (pure bash + find): runnable pre-PR with no node/eslint install. Reads the
# RULE_GLOBS block from eslint.config.mjs so it can never drift from the actual rule scopes.
#
# Monorepos: a sub-package with its OWN eslint.config.* shadows the root config (ESLint
# nearest-config resolution), so its files are NOT governed by the root R2 this gate reads.
# Such packages are pruned from the root-coverage probe (a planted file there can no longer fake
# a green) and checked separately: a shadowed package with boundary files whose own config does
# not wire R2 → FAIL (self-contained) or WARN (re-exports/extends — can't be verified here). When
# a shadowed package DOES plausibly cover boundary code, a root config that then governs no
# boundary file is informational, not an alarm — but if NO package covers it (e.g. inline routes
# with no boundary folder anywhere), root-zero stays the silent-inertness alarm.
#
# Exit: 0 = every active root rule matches ≥1 root-governed source file (or no source yet, or a
#           per-package config covers the boundary); per-package gaps may still WARN at exit 0;
#       1 = a root rule's globs match zero root-governed files with no per-package config covering
#           the boundary, OR a shadowed package has boundary files but its self-contained config
#           provably does not wire R2 (silent-inertness alarm).
set -uo pipefail

# The config ESLint itself loads from here: the first of its flat-config names that exists, in its
# own lookup order (eslint.config.js wins over .mjs), eslint.config.mjs when there is none. The
# install adds getff's block to a consumer's own eslint.config.js too (Q4.7, 2026-09-28).
CFG="${ESLINT_CONFIG:-}"
if [ -z "$CFG" ]; then
  CFG=eslint.config.mjs
  for _c in eslint.config.js eslint.config.mjs eslint.config.cjs eslint.config.ts eslint.config.mts eslint.config.cts; do
    if [ -f "$_c" ]; then CFG="$_c"; break; fi
  done
fi

# >>> rule-globs reader — byte-identical in check-rule-globs.sh and check-rule-enforced.sh
# (tests/install-sh/gh-535-rule-enforced.test.sh compares them): both gates must find the same
# workspace configs and read the same RULE_GLOBS globs, or one goes red where the other is green.
# CFG_PRUNE is where no config or code of the project's own lives: dependencies, build output, git,
# the repo copies under .claude/worktrees, and the subtrees the install vendors into the root's
# packages/core (hooks/, audit-self/, principles/; eslint-rules/ from older installs). Only those
# subtrees: a consumer workspace NAMED packages/core is the consumer's own code, and pruning every
# */packages/core left it unchecked by both gates (fourth cold review). setup.d/lib.sh
# eslint_flat_configs_under prunes the same list, less the vendored subtrees, which hold no config.
CFG_PRUNE=( -name node_modules -o -name dist -o -name coverage -o -name .stryker-tmp -o -name .next -o -name .git -o -path './packages/core/hooks' -o -path './packages/core/audit-self' -o -path './packages/core/principles' -o -path './packages/core/eslint-rules' -o -path '*/.claude/worktrees' )

# The config ESLint loads in directory $1: the first of its flat-config names there, in its lookup order.
flat_config_in() {
  local n
  for n in eslint.config.js eslint.config.mjs eslint.config.cjs eslint.config.ts eslint.config.mts eslint.config.cts; do
    [ -f "$1/$n" ] && { printf '%s' "$n"; return 0; }
  done
  return 1
}

# Every directory below the root that holds a flat config, one per line.
config_dirs() {
  find . \( "${CFG_PRUNE[@]}" \) -prune -o -type f \
    \( -name 'eslint.config.js' -o -name 'eslint.config.mjs' -o -name 'eslint.config.cjs' \
       -o -name 'eslint.config.ts' -o -name 'eslint.config.mts' -o -name 'eslint.config.cts' \) -print 2>/dev/null \
  | while IFS= read -r f; do
      d=$(dirname "$f")
      [ "$d" = "." ] || printf '%s\n' "$d"
    done | sort -u
}

# RULE_GLOBS is read the way JavaScript reads it, not only the way getff's template lays it out: the
# key bare, quoted or a computed literal (`["boundary"]`), anywhere on its line (a one-line RULE_GLOBS
# object too), globs in single or double quotes (prettier's default is double), and the array read only
# up to its own `]` — on one line, the next key's globs are not this key's (second cold review, after
# #1868). A comment is not code: the file is read with its // and /* */ comments cut out (uncomment;
# quoted text stays, a /* */ comment may span lines), and a key is the whole key — `my-boundary` is not
# `boundary` (third cold review). A regex literal and a template string are not code either, and a `/*`
# or quote inside one opens nothing: a `/` where a value starts is read as a regex up to its closing `/`
# on that line (a division when there is none), and a template string runs across lines to its closing
# backtick, its text left out — no glob is read from it (fourth cold review, #1889). Only a key of the `RULE_GLOBS = { … }`
# object counts — the object wireOwnConfig in packages/core/install/wire-eslint-r2.ts reads, inside
# parentheses, Object.freeze( … ) or a <type> assertion if it is wrapped. Another object's `boundary`,
# or one nested inside RULE_GLOBS, is not RULE_GLOBS.boundary: added to the list, a nested
# `boundary: ['**/*.ts']` made a dead list pass (#1889). The declaration is found line by line (a
# const/let/var line that assigns RULE_GLOBS) and only the text from there is walked: whatever the
# consumer's code above it holds — a stray `)` too — must not hide the block, and the wirer writes the
# block after all of that code (fourth cold review). The quote characters come in through -v; `[[]` is
# a literal `[` that needs no backslash.
RG_AWK_LIB='
function regexctx(out,   w) {
  if (last == "" || index("(,=:[!&|?{};+-*%<>~^}", last) > 0) return 1
  if (last !~ /[A-Za-z]/) return 0
  w = out; sub(/[[:space:]]+$/, "", w)
  if (!match(w, /[A-Za-z_$][A-Za-z0-9_$]*$/)) return 0
  return substr(w, RSTART) ~ /^(return|typeof|case|in|of|delete|void|throw|new|else|do|yield|await|instanceof)$/
}
function uncomment(s,   out, c, q, i, j, n, cls) {
  out = ""; q = ""; n = length(s)
  for (i = 1; i <= n; i++) {
    c = substr(s, i, 1)
    if (incmt) { if (c == "*" && substr(s, i + 1, 1) == "/") { incmt = 0; i++ }; continue }
    if (intpl) { if (c == "\\") i++; else if (c == "`") { intpl = 0; out = out c; last = c }; continue }
    if (q != "") { out = out c; if (c == "\\") { out = out substr(s, i + 1, 1); i++ } else if (c == q) { q = ""; last = c }; continue }
    if (c == "/" && substr(s, i + 1, 1) == "/") break
    if (c == "/" && substr(s, i + 1, 1) == "*") { incmt = 1; i++; continue }
    if (c == "/" && regexctx(out)) {
      cls = 0
      for (j = i + 1; j <= n; j++) {
        c = substr(s, j, 1)
        if (c == "\\") j++
        else if (cls) { if (c == "]") cls = 0 }
        else if (c == "[") cls = 1
        else if (c == "/") break
      }
      if (j <= n) { out = out "0"; last = "0"; i = j; continue }
      c = "/"
    }
    if (c == "`") { intpl = 1; out = out c; last = c; continue }
    if (c == sq || c == dq) q = c
    out = out c
    if (c !~ /[[:space:]]/) last = c
  }
  return out
}
function blank(c) { return c == " " || c == "\t" || c == "\r" || c == "\n" }
# Where line l (comments cut) declares RULE_GLOBS: the position of the name, or 0.
function decl_at(l,   p) {
  if (l !~ /^[ \t]*(export[ \t]+)?(const|let|var)[ \t]/) return 0
  if (!match(l, /(^|[^A-Za-z0-9_$.])RULE_GLOBS[ \t]*(:[^=]*)?=([^=>]|$)/)) return 0
  p = RSTART; if (substr(l, p, 10) != "RULE_GLOBS") p++
  return p
}
# Collect the comment-cut source in src and the offset st of its first RULE_GLOBS declaration. A line
# that starts inside a template literal declares nothing.
function take(line,   t0, l, p) {
  t0 = intpl; l = uncomment(line)
  if (!st && !t0 && (p = decl_at(l))) st = length(src) + p
  src = src l "\n"
}
# The globs of RULE_GLOBS.<key> in s, which starts at the name RULE_GLOBS: printed one per line unless
# quiet; returns 1 when the array is there. Counts ( [ { outside strings: a key counts only at the depth
# of the RULE_GLOBS object, right after its { or a ,. Keys are matched in a short window, so the walk
# stays linear in the object it reads.
function rule_globs(s, key, quiet,   n, i, c, q, d, ph, od, last, name, rest, j, a) {
  if (!match(s, /^RULE_GLOBS[ \t\r\n]*(:[^=]*)?=/)) return 0
  n = length(s); d = 0; ph = 1; q = ""; last = ""
  for (i = RLENGTH + 1; i <= n; i++) {
    c = substr(s, i, 1)
    if (q != "") { if (c == "\\") i++; else if (c == q) q = ""; continue }
    if (blank(c)) continue
    if (ph == 1) {
      if (c == "(") { d++; continue }
      if (substr(s, i, 13) == "Object.freeze") { i += 12; continue }
      if (c == "<") {
        for (a = 1; a > 0 && i < n; ) { i++; c = substr(s, i, 1); if (c == "<") a++; else if (c == ">") a-- }
        continue
      }
      if (c != "{") return 0
      d++; od = d; ph = 2; last = c; continue
    }
    if (d == od && (last == "{" || last == ",")) {
      rest = substr(s, i, 256); name = ""
      if (match(rest, /^[A-Za-z_$][A-Za-z0-9_$]*/)) name = substr(rest, 1, RLENGTH)
      else if (match(rest, "^[[]?[ \t\r\n]*(" sq "[^" sq "]*" sq "|" dq "[^" dq "]*" dq ")[ \t\r\n]*[]]?")) {
        name = substr(rest, 1, RLENGTH)
        if ((substr(name, 1, 1) == "[") != (substr(name, RLENGTH, 1) == "]")) name = ""
        gsub(/^[[]?[ \t\r\n]*/, "", name); gsub(/[ \t\r\n]*[]]?$/, "", name)
        name = substr(name, 2, length(name) - 2)
      }
      if (name == key) {
        j = i + RLENGTH
        while (j <= n && blank(substr(s, j, 1))) j++
        if (substr(s, j, 1) == ":") {
          j++
          while (j <= n && blank(substr(s, j, 1))) j++
          if (substr(s, j, 1) == "[") {
            for (j++; j <= n; j++) {
              c = substr(s, j, 1)
              if (c == "]") return 1
              if (c == sq || c == dq) {
                rest = substr(s, j + 1); a = index(rest, c)
                if (a == 0) return 1
                if (!quiet) print substr(rest, 1, a - 1)
                j += a
              }
            }
            return 1
          }
        }
      }
    }
    if (c == sq || c == dq || c == "`") { q = c; last = c; continue }
    if (c == "{" || c == "(" || c == "[") d++
    else if (c == "}" || c == ")" || c == "]") { d--; if (d < od) return 0 }
    last = c
  }
  return 0
}'

# File $1 with its comments cut out, as the reader sees it. A rule id or RULE_GLOBS that only a comment
# names is not in the config (#1889 observation 7: `// TODO: turn on <R2>` read as R2 wired).
code_of() {
  awk -v sq="'" -v dq='"' "$RG_AWK_LIB"'{ print uncomment($0) }' "$1"
}

# Does file $2 (default $CFG) hold a RULE_GLOBS.<key> array?
has_key() {
  awk -v key="$1" -v sq="'" -v dq='"' "$RG_AWK_LIB"'
    { take($0) }
    END { exit !(st && rule_globs(substr(src, st), key, 1)) }
  ' "${2:-$CFG}"
}

# Extract the quoted globs for a RULE_GLOBS key (boundary|appCode|application) from file $2 (default
# $CFG). Prints one glob per line.
extract_key() {
  awk -v key="$1" -v sq="'" -v dq='"' "$RG_AWK_LIB"'
    { take($0) }
    END { if (st) rule_globs(substr(src, st), key, 0) }
  ' "${2:-$CFG}"
}
# <<< rule-globs reader

# `packages/core` is the framework's VENDORED install target (install.sh ships hooks/,
# audit-self/, principles/ there; eslint-rules/ too from #735 until 2026-09-28, and a consumer
# installed in that window still carries it); CFG_PRUNE prunes those subtrees, never a consumer
# workspace named packages/core. Such a copy of
# packages/core/eslint-rules/index.ts matches the install-injected `**/eslint-rules/**`
# boundary glob — counting vendored framework code toward USER R2 coverage is exactly the
# FALSE-GREEN this gate exists to prevent (see the shadow-package rationale below). Prune them
# so the gate measures the consumer's OWN boundary coverage, not the framework it vendored.
# Mirrors detect-r2-boundary.sh's existing `eslint-rules-local` exclusion. (GH #777 — this gate
# runs consumer-side only; the framework repo does not invoke it.) The source-file probes also
# leave out `reports` — not in CFG_PRUNE, where a find -name would also cut a workspace named reports.
PRUNE=( "${CFG_PRUNE[@]}" -o -name reports )

# §807 multi-stack: a #793/#796 monorepo ships per-workspace eslint.config.mjs files and NO root
# config — the per-workspace configs ARE the rule layer. Without this, the exit-2 guard below fires
# before any shadow logic and validate goes RED 6/10. So when there is no root config (and we are
# not already a per-workspace sub-invocation — ESLINT_CONFIG unset is the recursion guard), find the
# per-workspace configs and run THIS SAME script once per workspace, from that workspace's dir with
# ESLINT_CONFIG=<the config ESLint loads there>. Each child then sees a valid $CFG and its existing
# find/shadow logic scopes to that subtree. Aggregate exit codes (any non-zero → non-zero). A
# workspace's config is found under any flat-config name, in ESLint's lookup order: the install writes
# R2 and RULE_GLOBS into a consumer's own eslint.config.js, and an .mjs-only search stopped such a
# project at «eslint.config.mjs not found» (second cold review, after #1868).
# Capture an ABSOLUTE self-path BEFORE any cd so the `bash "$SELF"` re-exec survives `cd "$_wd"`
# (and the child's r2-na-marker source resolves via its own absolute $0). (kickoff ⚑M1 / T-807-A)
SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
# The same holds under a root config that is the consumer's own (not in the baseline manifest) and
# carries no RULE_GLOBS block and no getff custom rule — the config the own-config skip below passes
# over. ESLint lints each workspace with that workspace's config, so the workspace configs are the rule
# layer there too; stopping at «skipped» left them unchecked (cold-review F3 — the lookup order made a
# consumer's root .cjs «the root config», where before this gate found no root config and recursed).
_own_root_without_globs() {
  local k="${CFG#./}" code
  [ -f "$CFG" ] || return 1
  code=$(code_of "$CFG")   # a comment that names RULE_GLOBS or a rule is not the config holding it
  ! grep -q 'RULE_GLOBS' <<<"$code" \
    && ! grep -qE 'no-unsafe-zod-parse|no-direct-time-randomness|require-otel-span' <<<"$code" \
    && ! grep -qF "\"$k\":" .ai-factory/refresh-baseline.json 2>/dev/null
}
if [ -z "${ESLINT_CONFIG:-}" ] && { [ ! -f "$CFG" ] || _own_root_without_globs; }; then
  # CFG_PRUNE leaves out the subtrees the framework vendors into packages/core; config_dirs leaves out
  # the root directory, whose config is the consumer's own.
  _ws_dirs="$(config_dirs)"
  if [ -n "$_ws_dirs" ]; then
    [ -f "$CFG" ] && echo "check-rule-globs: $CFG is your own config with no RULE_GLOBS block — checking the workspace configs under it, which ESLint uses for their own files."
    _agg=0
    while IFS= read -r _wd; do
      [ -n "$_wd" ] || continue
      _wn="$(flat_config_in "$_wd")"
      # Only RN/Expo/bare-RN ship NO RULE_GLOBS.boundary → R2 N/A there; skip (do NOT fail — an empty
      # boundary would make check_rule FAIL on «no globs found»). react-spa AND react-next DO ship a
      # populated boundary block → they fall through and recurse normally. (kickoff ⚑B2 / T-807-B)
      has_key boundary "$_wd/$_wn" \
        || { echo "  · ${_wd#./}: no RULE_GLOBS.boundary — R2 N/A (skipped)"; continue; }
      # Which config the lines below are about: the child names it only by its own file name.
      echo "check-rule-globs: checking ${_wd#./}/$_wn"
      ( cd "$_wd" && ESLINT_CONFIG="$_wn" bash "$SELF" ) || _agg=1
    done <<EOF
$_ws_dirs
EOF
    exit "$_agg"
  fi
  # No per-workspace configs either → fall through: to the exit-2 guard when there is no root config
  # (genuine "run from root" error), to the own-config skip below when it is the consumer's own.
fi
[ -f "$CFG" ] || { echo "check-rule-globs: $CFG not found (run from the project root)" >&2; exit 2; }

# A config with no RULE_GLOBS block. Whose config it is comes from the baseline manifest
# (.ai-factory/refresh-baseline.json records every file getff delivered, with its sha256), not from
# its content.
#
# The CONSUMER's own config (not in the manifest): the install adds getff's block to it (Q4.7,
# 2026-09-28), and RULE_GLOBS with R2 only once 60-ci finds an HTTP boundary — so without a boundary
# it carries getff's other rules and no RULE_GLOBS block, and a .cjs/.ts config (getff adds nothing
# to those) carries neither. Either way there is no getff glob to verify, and «no globs found» would
# fail validate and every push of the project. Skip and say what is not wired — the same verdict
# check-rule-enforced.sh gives a config with no boundary tokens. One that wires a custom rule
# (R2/R7/R8) without RULE_GLOBS keeps the full alarm below: its globs are not getff's to verify.
#
# getff's OWN config (in the manifest) that wires no rules-as-tests rule either: getff's
# react-native config also has no RULE_GLOBS block — that preset ships no custom rules. The
# manifest's sha256 tells a config still as delivered from one edited since. As delivered: skipped.
# Edited, and getff also placed the react-native sibling eslint.config.rn-common.mjs: skipped and
# named as edited — that config never had a RULE_GLOBS block to lose, and failing it would turn
# check:globs RED on one appended comment line (measured 2026-09-28). Edited otherwise: the stack's
# template HAD a RULE_GLOBS block and getff rules, and an edit cut both out of getff's own file —
# the bypass this gate exists to catch — so it takes the full alarm below, as it did before this
# skip existed (a recorded R2 N/A decision still applies there).
_bl=.ai-factory/refresh-baseline.json
_bl_key="${CFG#"$PWD"/}"
_bl_key="${_bl_key#./}"
_cfg_code=$(code_of "$CFG")   # what the config says in code: a comment naming a rule does not wire it
if grep -q 'RULE_GLOBS' <<<"$_cfg_code"; then
  : # getff's RULE_GLOBS block is there — the checks below verify it
elif ! grep -qF "\"$_bl_key\":" "$_bl" 2>/dev/null; then
  if ! grep -qE 'no-unsafe-zod-parse|no-direct-time-randomness|require-otel-span' <<<"$_cfg_code"; then
    echo "check-rule-globs: getff's custom rules (R2/R7/R8) are not wired into $CFG — it is your own config and has no RULE_GLOBS block, so there is no rule glob to verify (skipped)."
    case "$CFG" in
      *.js | *.mjs) echo "  The install adds RULE_GLOBS and R2 to it once it finds an HTTP boundary in the project (with --full, which puts ts-morph in node_modules)." ;;
      *) echo "  getff adds its block only to an ES-module flat config (eslint.config.js / eslint.config.mjs); $CFG is left as it is." ;;
    esac
    exit 0
  fi
elif ! grep -qE 'rules-as-tests|no-unsafe-zod-parse' <<<"$_cfg_code"; then
  _bl_recorded=$(awk -v k="\"$_bl_key\":" 'index($0, k) { n = split($0, a, "\""); if (n >= 4) print a[4]; exit }' "$_bl" 2>/dev/null)
  _bl_actual=$( { sha256sum "$CFG" 2>/dev/null || shasum -a 256 "$CFG" 2>/dev/null; } | awk '{print $1}')
  if [ -n "$_bl_recorded" ] && [ "$_bl_recorded" = "$_bl_actual" ]; then
    echo "check-rule-globs: getff placed $CFG for this stack and it wires none of getff's custom rules (R2/R7/R8) — no RULE_GLOBS block, no rules-as-tests rule — so there is no rule glob to verify (skipped)."
    exit 0
  fi
  _bl_dir=$(dirname "$_bl_key")
  if [ "$_bl_dir" = . ]; then _bl_rn=eslint.config.rn-common.mjs; else _bl_rn="$_bl_dir/eslint.config.rn-common.mjs"; fi
  if grep -qF "\"$_bl_rn\":" "$_bl" 2>/dev/null; then
    echo "check-rule-globs: getff placed $CFG and it has been edited since; it is getff's react-native config, which wires none of getff's custom rules (R2/R7/R8) and has no RULE_GLOBS block, so there is no rule glob to verify (skipped)."
    exit 0
  fi
  echo "check-rule-globs: getff placed $CFG with a RULE_GLOBS block and rules-as-tests rules, and it has been edited since: the RULE_GLOBS block and its rules-as-tests rules are gone, so getff's custom rules (R2/R7/R8) no longer run."
  echo "  Restore them from the stack's template; the checks below say what is missing."
fi

# C4 (GH #547 Point 2): honor a recorded R2 N/A decision via the shared marker helper (sibling file),
# re-verifying its precondition mechanically — so a recorded N/A is conditional, not a permanent off.
# shellcheck source=/dev/null
. "$(dirname "$0")/r2-na-marker.sh"

# ── #507 (reopen #2): per-package ESLint flat configs SHADOW the root ──────────
# ESLint flat-config resolution is NEAREST-config: a sub-package shipping its own
# eslint.config.* is linted by THAT config, not the root one this gate reads. So a file under
# such a package is NOT governed by the root R2 — counting it toward root coverage is a
# FALSE-GREEN (planting apps/api/src/routes/x.ts flipped the gate to PASS while R2 stayed dead
# there). Discover those package dirs so we can (a) PRUNE them from the root-coverage probe and
# (b) check each package's own config separately (check_shadowed_boundary below). Only FLAT
# configs shadow a root flat config in ESLint 9 — legacy .eslintrc* is ignored under flat, so
# it is intentionally NOT treated as a shadow here.
SHADOWS="$(config_dirs)"

# Drop (on stdin, one path per line) any path that lives under a shadowed package dir.
# No shadows → passthrough, so a flat / single-config repo behaves exactly as before.
filter_unshadowed() {
  if [ -z "$SHADOWS" ]; then cat; return; fi
  # $SHADOWS is one dir per line and is MULTI-LINE whenever ≥2 packages shadow the root. BSD/macOS
  # awk rejects a literal newline in a `-v` assignment ("awk: newline in string") → the filter would
  # crash and emit nothing, blinding the root probe (false-RED). Pass it through the environment
  # (ENVIRON[]) instead of `-v` — newline-safe on every awk (gawk / BSD / mawk). (GH #516.)
  SHADOWS="$SHADOWS" awk '
    BEGIN { n = split(ENVIRON["SHADOWS"], P, "\n") }
    { drop = 0
      for (i = 1; i <= n; i++) if (P[i] != "" && index($0, P[i] "/") == 1) { drop = 1; break }
      if (!drop) print
    }'
}

# `**/<token>/**/*.{ts,tsx}` (or `**/*.{ts,tsx}`) → the dir token (empty for the no-dir glob).
glob_to_token() {
  local glob="$1" token
  token="${glob#'**/'}"
  token="${token%%/'**'/*}"          # drop /**/*.{ts,tsx} tail
  token="${token%%/'*'.*}"            # drop /*.{ts,tsx} tail
  [ "$token" = "$glob" ] && token=""   # glob was just **/*.{ts,tsx} → no dir token
  case "$glob" in '**/*.'*) token="";; esac
  printf '%s' "$token"
}

# Any source files at all (ANYWHERE, incl. shadowed packages)? A fresh skeleton with no code yet
# → nothing to check (not an alarm). Root-vs-shadow partitioning happens further down.
any_src=$(find . \( "${PRUNE[@]}" \) -prune -o -type f \( -name '*.ts' -o -name '*.tsx' \) -print 2>/dev/null | head -1)
if [ -z "$any_src" ]; then
  echo "check-rule-globs: no .ts/.tsx source files yet — nothing to verify (skipped)."
  exit 0
fi

# Does at least one glob in the given list match ≥1 existing ROOT-GOVERNED source file?
# Translates `**/<token>/**/*.{ts,tsx}` → a `find -path` probe, then drops files under shadowed
# packages (filter_unshadowed) so the root-config probe never counts a sub-package's files.
any_glob_matches() {
  local glob token found
  for glob in "$@"; do
    token=$(glob_to_token "$glob")
    if [ -z "$token" ]; then
      found=$(find . \( "${PRUNE[@]}" \) -prune -o -type f \( -name '*.ts' -o -name '*.tsx' \) -print 2>/dev/null | filter_unshadowed | head -1)
    else
      found=$(find . \( "${PRUNE[@]}" \) -prune -o -type f \( -name '*.ts' -o -name '*.tsx' \) -path "*/$token/*" -print 2>/dev/null | filter_unshadowed | head -1)
    fi
    [ -n "$found" ] && return 0
  done
  return 1
}

# Classify whether a shadowed package's own ESLint config wires R2: wired | uncertain | dead.
#   wired     — textual reference to the rules-as-tests plugin / the rule → R2 is live there.
#   uncertain — re-exports / extends another config (relative eslint.config.*, a bare eslint-config
#               pkg, or an imported config FILE whose path contains `eslint` and ends in a JS/TS
#               module extension, e.g. `@scope/config/eslint/base.mjs`); the rule MAY be inherited
#               but bash can't follow the chain → WARN, never FAIL (avoids a false-FAIL on a correct
#               re-export-of-root monorepo). (GH #516 broadened this to the base-file import style.)
#   dead      — self-contained config with no R2 and no extends → R2 is genuinely inert there.
classify_config_r2() {
  local cfg="$1" code
  [ -n "$cfg" ] && [ -f "$cfg" ] || { echo uncertain; return; }
  # Read the config without its comments: `// TODO: turn on rules-as-tests/no-unsafe-zod-parse` wires
  # nothing, and a commented-out `extends` extends nothing (#1889 observation 7).
  code=$(code_of "$cfg")
  if grep -qE 'rules-as-tests|no-unsafe-zod-parse' <<<"$code"; then echo wired; return; fi
  # A package re-exports / extends a shared base when it: `extends`; imports an `eslint-config`
  # pkg/path; OR imports a config FILE whose specifier contains `eslint` and ends in a JS/TS module
  # extension (timeliner's `import base from '@scope/config/eslint/base.mjs'`). Any of these MAY
  # inherit R2 — bash can't follow the chain → uncertain (WARN), never a false-FAIL. The trailing
  # extension anchors the file-import branch so a bare plugin like `@typescript-eslint/eslint-plugin`
  # (no module extension in its specifier) is NOT swallowed and stays classifiable as dead. (GH #516.)
  if grep -qE "(from|require\()[[:space:]]*[(]?['\"][^'\"]*eslint[.-]?config[^'\"]*['\"]|extends" <<<"$code" \
     || grep -qE "(from|require\()[[:space:]]*[(]?['\"][^'\"]*eslint[^'\"]*\.(mjs|cjs|js|ts)['\"]" <<<"$code"; then
    echo uncertain; return
  fi
  echo dead
}

# For each shadowed package that contains boundary-layer files, R2 there is governed by the
# package's OWN config, not the root one this gate reads. Surface coverage gaps per package:
# wired → silent; uncertain → WARN; dead → FAIL (the silent-inertness the gate exists to catch,
# now caught at the per-package layer too). Sets PKG_BOUNDARY=1 whenever a shadowed package owns
# boundary files (any verdict) — the per-package check has then already rendered the verdict for
# that layer, so a root config with no root-governed boundary file is informational rather than a
# (misleading "widen root globs") alarm. When NO package owns boundary files (e.g. inline routes,
# no boundary folder anywhere — the timeliner case), PKG_BOUNDARY stays 0 and root-zero stays an
# alarm. (GH #507 reopen #2.)
check_shadowed_boundary() {
  [ -z "$SHADOWS" ] && return 0
  local btokens=() g t d cfg verdict f
  while IFS= read -r g; do t=$(glob_to_token "$g"); [ -n "$t" ] && btokens+=("$t"); done < <(extract_key boundary)
  [ "${#btokens[@]}" -eq 0 ] && return 0
  while IFS= read -r d; do
    [ -z "$d" ] && continue
    f=""
    for t in "${btokens[@]}"; do
      f=$(find "$d" \( "${PRUNE[@]}" \) -prune -o -type f \( -name '*.ts' -o -name '*.tsx' \) -path "*/$t/*" -print 2>/dev/null | head -1)
      [ -n "$f" ] && break
    done
    [ -z "$f" ] && continue   # no boundary files in this package → nothing for R2 to govern here
    PKG_BOUNDARY=1            # boundary layer lives in a package → root-zero is no longer an alarm
    cfg="$d/$(flat_config_in "$d")"
    verdict=$(classify_config_r2 "$cfg")
    case "$verdict" in
      wired) ;;
      uncertain)
        echo "  ⚠ ${d#./}: has its own ESLint config + boundary files; R2 is governed by THAT config (root R2 does not reach it). Verify it wires rules-as-tests/no-unsafe-zod-parse." >&2 ;;
      dead)
        echo "  ✗ ${d#./}: has boundary files but its own ESLint config does NOT wire R2 (no-unsafe-zod-parse) — R2 is SILENTLY INERT in this package." >&2
        echo "     Add the rules-as-tests plugin + 'rules-as-tests/no-unsafe-zod-parse' to ${cfg#./}, or re-export the root config." >&2
        FAIL=1 ;;
    esac
  done < <(printf '%s\n' "$SHADOWS")
  return 0
}

FAIL=0
PKG_BOUNDARY=0   # set by check_shadowed_boundary when a shadowed package owns the boundary layer
check_rule() { # $1 = human name, $2 = RULE_GLOBS key, $3 = soft (1 → a zero match is informational)
  local globs=(); local line
  while IFS= read -r line; do [ -n "$line" ] && globs+=("$line"); done < <(extract_key "$2")
  if [ "${#globs[@]}" -eq 0 ]; then
    echo "  ⚠  $1: no globs found under RULE_GLOBS.$2 in $CFG (check the config)"; FAIL=1; return
  fi
  if any_glob_matches "${globs[@]}"; then
    echo "  ✓ $1 (RULE_GLOBS.$2): matches ≥1 root-governed source file"
  elif [ "${3:-0}" = "1" ]; then
    echo "  · $1 (RULE_GLOBS.$2): no root-governed match — boundary lives under per-package config(s) (see ⚠/✗ above)"
  else
    echo "  ✗ $1 (RULE_GLOBS.$2): matches ZERO source files — rule is SILENTLY INERT."
    echo "     Widen RULE_GLOBS.$2 in $CFG to cover your layout (globs: ${globs[*]})"
    FAIL=1
  fi
}

echo "▶ check-rule-globs: verifying custom-rule globs match real source files"

# Per-package configs first: they set FAIL on a dead package and PKG_BOUNDARY when one owns boundary.
check_shadowed_boundary

# Root-config probe — uses root-governed files only (shadowed packages are pruned). A zero match
# is an alarm UNLESS a per-package config owns the boundary layer (PKG_BOUNDARY) — the per-package
# monorepo case where the root legitimately governs no boundary file and the verdict for that layer
# was already rendered above.
# C4: if R2 was recorded N/A for this layout (declarative validation), the marker IS the R2 verdict —
# re-verify its precondition instead of running the glob-liveness check. No marker → today's behaviour.
R2_NA_HANDLED=0
if r2_na_marker_present; then
  R2_NA_HANDLED=1
  case "$(r2_na_recheck)" in
    holds) echo "  · R2 no-unsafe-zod-parse: N/A recorded for this layout — precondition holds (declarative validation, no manual-parse boundary). See $R2_DECISIONS_FILE" ;;
    broke) echo "  ✗ R2 no-unsafe-zod-parse: marked N/A in $R2_DECISIONS_FILE but a parse boundary now exists — wire R2 (widen RULE_GLOBS.boundary) or update the decision." >&2; FAIL=1 ;;
  esac
fi
[ "$R2_NA_HANDLED" = "1" ] || check_rule "R2 no-unsafe-zod-parse" boundary "$PKG_BOUNDARY"
if [ "${AIF_STRICT_RUNTIME:-}" = "1" ]; then
  check_rule "R7 no-direct-time-randomness" appCode "$PKG_BOUNDARY"
  check_rule "R8 require-otel-span" application "$PKG_BOUNDARY"
else
  echo "  · R7/R8 skipped (AIF_STRICT_RUNTIME≠1 — runtime-discipline rules are opt-in)"
fi

[ "$FAIL" -eq 0 ] && echo "check-rule-globs: OK" || echo "check-rule-globs: FAILED — a custom rule is inert against this layout." >&2
exit "$FAIL"
