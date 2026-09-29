#!/usr/bin/env bash
# check-rule-enforced.sh — GH #535. The "+E" deep gate that closes check:globs' blind spot.
#
# check:globs (check-rule-globs.sh, dependency-free) verifies a custom rule's GLOBS MATCH files. But
# on a monorepo whose packages ship their OWN eslint.config.* re-exporting a shared base that does
# NOT wire R2, the rule never actually BINDS — yet `npm run validate` stays green: `lint` runs each
# package's own config (ESLint nearest-config resolution shadows the root AIF rules), and check:globs
# can only WARN on a re-export it cannot follow (it's pure bash; it can't resolve the config chain).
#
# This gate resolves the ACTUALLY-APPLIED config for a representative boundary file in each config
# scope via `eslint --print-config` (which DOES follow the re-export chain) and FAILS when R2
# (rules-as-tests/no-unsafe-zod-parse) is absent from the resolved ruleset. Because it reads the real
# resolved config, it catches the false-green WITHOUT false-failing a package that *correctly*
# re-exports the root config (the case check:globs has to WARN on, per GH #507/#516). It
# operationalises the advice install.sh already prints: `eslint --print-config <file> | grep -c
# rules-as-tests` = 0 means the rule is inert there.
#
# Requires eslint on PATH / in node_modules (it runs as part of `npm run validate`, after deps land);
# degrades to a clear SKIP (exit 0) when eslint is absent so a pre-install standalone run is not a
# hard failure. Reads RULE_GLOBS.boundary from eslint.config.mjs so the boundary definition can never
# drift from the rule's real scope.
#
# GH #730: verification is scoped to R2-relevant packages — those whose nearest package.json declares
# `zod` in dependencies / devDependencies. A zod-less package (e.g. an Expo/RN app) cannot have an
# unsafe-zod-parse boundary → silently skipped as "R2 N/A", not a hard fail. Grep shape reuses
# detect-r2-boundary.sh:88 — `"zod"[[:space:]]*:` — matching `"zod":` exactly and NOT matching
# `"zod-to-json-schema":` / `"@hono/zod-openapi":`. The "R2 ⟺ zod present" principle applies at
# package granularity here; at call-site granularity in no-unsafe-zod-parse.ts (GH #737) — same
# principle, different files, neither duplicated.
#
# Severity, not presence (2026-09-21): "applied" means the resolved severity is 2/"error". 0/"off" is
# NOT applied (print-config still lists a disabled rule by name — the old name-only grep passed it).
# 1/"warn" is NOT applied by default either: a warning fails a build only where every lint run passes
# --max-warnings=0, which this gate cannot verify across the consumer's channels. A consumer who does
# run every channel that way opts in with AIF_ENFORCED_ALLOW_WARN=1 (it never admits an OFF rule).
#
# Exit: 0 = R2 resolves to 'error' for every checked boundary file (or no boundary file yet, or
#           eslint not installed → skip); 1 = R2 is missing from, or switched off / down to warn in,
#           the resolved config of ≥1 boundary file (silent inertness — the false-green this gate
#           exists to catch).
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
RULE="${AIF_ENFORCED_RULE:-rules-as-tests/no-unsafe-zod-parse}"

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

# §807 multi-stack: a #793/#796 monorepo ships per-workspace eslint.config.mjs files and NO root
# config — the per-workspace configs ARE the rule layer. Without this, the exit-2 guard below fires
# before any shadow logic and validate goes RED. So when there is no root config (and we are not
# already a per-workspace sub-invocation — ESLINT_CONFIG unset is the recursion guard), find the
# per-workspace configs and run THIS SAME script once per workspace, from that workspace's dir with
# ESLINT_CONFIG=<the config ESLint loads there> (config_dirs + flat_config_in above — a workspace's
# own eslint.config.js too, which the install writes R2 into). Each child then sees a valid $CFG;
# eslint absent → each child SKIPs (exit 0), the correct deps-free degrade. Aggregate exit codes
# (any non-zero → non-zero).
# Capture an ABSOLUTE self-path BEFORE any cd so the `bash "$SELF"` re-exec survives `cd "$_wd"`
# (and the child's r2-na-marker source resolves via its own absolute $0). (kickoff ⚑M1 / T-807-A)
SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
# The same holds under a root config that is the consumer's own (not in the baseline manifest) and
# carries no RULE_GLOBS block and no getff custom rule — the same case check-rule-globs.sh recurses
# on. ESLint lints each workspace with that workspace's config, so the workspace configs are the rule
# layer there too; «no boundary tokens — skipped» on the root left them unchecked (cold-review F3 —
# the lookup order made a consumer's root .cjs «the root config», where before this gate found no
# root config and recursed).
_own_root_without_globs() {
  local k="${CFG#./}" code
  [ -f "$CFG" ] || return 1
  code=$(code_of "$CFG")   # a comment that names RULE_GLOBS or a rule is not the config holding it
  ! grep -q 'RULE_GLOBS' <<<"$code" \
    && ! grep -qE 'no-unsafe-zod-parse|no-direct-time-randomness|require-otel-span' <<<"$code" \
    && ! grep -qF "\"$k\":" .ai-factory/refresh-baseline.json 2>/dev/null
}
if [ -z "${ESLINT_CONFIG:-}" ] && { [ ! -f "$CFG" ] || _own_root_without_globs; }; then
  _ws_dirs="$(config_dirs)"
  if [ -n "$_ws_dirs" ]; then
    [ -f "$CFG" ] && echo "check-rule-enforced: $CFG is your own config with no RULE_GLOBS block — checking the workspace configs under it, which ESLint uses for their own files."
    _agg=0
    while IFS= read -r _wd; do
      [ -n "$_wd" ] || continue
      _wn="$(flat_config_in "$_wd")"
      # Only RN/Expo/bare-RN ship NO RULE_GLOBS.boundary → R2 N/A there; skip. The empty-btokens path
      # below already self-skips, but keep the guard for parity with check-rule-globs.sh.
      # react-spa/react-next ship a boundary → they recurse normally. (⚑B2)
      has_key boundary "$_wd/$_wn" \
        || { echo "  · ${_wd#./}: no RULE_GLOBS.boundary — R2 N/A (skipped)"; continue; }
      ( cd "$_wd" && ESLINT_CONFIG="$_wn" bash "$SELF" ) || _agg=1
    done <<EOF
$_ws_dirs
EOF
    exit "$_agg"
  fi
  # No per-workspace configs either → fall through: to the exit-2 guard when there is no root config
  # (genuine "run from root" error), to the no-boundary-tokens skip below when it is the consumer's own.
fi
[ -f "$CFG" ] || { echo "check-rule-enforced: $CFG not found (run from the project root)" >&2; exit 2; }

# The source-file probes prune what check-rule-globs.sh's do: CFG_PRUNE (the subtrees vendored into
# packages/core included — the eslint-rules/ copy matches the `**/eslint-rules/**` boundary glob and is
# getff's code, not the consumer's boundary) plus `reports`, which CFG_PRUNE leaves out so a workspace
# named reports is kept.
PRUNE=( "${CFG_PRUNE[@]}" -o -name reports )

# C4 (GH #547 Point 2): honor a recorded R2 N/A decision through the SAME shared helper as
# check-rule-globs.sh (two gates, one marker). The recheck is pure-bash (no eslint), so it short-
# circuits before eslint resolution. No marker → fall through to today's --print-config behaviour.
# shellcheck source=/dev/null
. "$(dirname "$0")/r2-na-marker.sh"
# P2 K2: a no-boundary-yet N/A whose precondition broke waives nothing — fall through to the
# --print-config check below, as if no block were there.
if r2_na_marker_present && { [ "$(r2_na_recheck)" = holds ] || ! r2_na_until_boundary; }; then
  case "$(r2_na_recheck)" in
    holds) echo "▶ check-rule-enforced: R2 N/A recorded for this layout — precondition holds (no manual-parse HTTP boundary)."; echo "check-rule-enforced: OK"; exit 0 ;;
    doubt) echo "  ✗ check-rule-enforced: R2 marked N/A in $R2_DECISIONS_FILE but zod is now declared with no declarative framework — wire R2 or update the decision." >&2; echo "check-rule-enforced: FAILED — stale R2 N/A marker." >&2; exit 1 ;;
    broke) echo "  ✗ check-rule-enforced: R2 marked N/A in $R2_DECISIONS_FILE but a parse boundary now exists — wire R2 or update the decision." >&2; echo "check-rule-enforced: FAILED — stale R2 N/A marker." >&2; exit 1 ;;
  esac
fi

# Resolve an eslint runner. AIF_ESLINT_CMD lets tests inject a fake; else prefer the local bin, then
# a PATH eslint, then `npx --no-install` (never triggers a network fetch). Absent → SKIP.
ESLINT="${AIF_ESLINT_CMD:-}"
if [ -z "$ESLINT" ]; then
  # Absolute path so it still resolves after we `cd` into a package dir (GH #535 fix below).
  if [ -x "node_modules/.bin/eslint" ]; then ESLINT="$(pwd)/node_modules/.bin/eslint"
  elif command -v eslint >/dev/null 2>&1; then ESLINT="eslint"
  elif command -v npx >/dev/null 2>&1 && npx --no-install eslint --version >/dev/null 2>&1; then ESLINT="npx --no-install eslint"
  fi
fi
if [ -z "$ESLINT" ]; then
  echo "check-rule-enforced: eslint not available yet — skipped (the deep R2-binding check needs eslint; it runs as part of 'npm run validate' after deps land)."
  exit 0
fi

# RULE_GLOBS.boundary dir-tokens (same extraction shape as check-rule-globs.sh's glob_to_token).
btokens=()
while IFS= read -r glob; do
  t="${glob#'**/'}"; t="${t%%/'**'/*}"; t="${t%%/'*'.*}"
  case "$glob" in '**/*.'*) t="" ;; esac
  [ -n "$t" ] && btokens+=("$t")
done < <(extract_key boundary)

if [ "${#btokens[@]}" -eq 0 ]; then
  echo "check-rule-enforced: no RULE_GLOBS.boundary tokens in $CFG — nothing to verify (skipped)."
  exit 0
fi

# Packages shipping their OWN flat eslint config shadow the root config (nearest-config resolution) —
# found by config_dirs, under all six flat-config names, as check-rule-globs.sh finds them.
shadows=()
while IFS= read -r d; do [ -n "$d" ] && shadows+=("$d"); done < <(config_dirs)

under_shadow() { # $1=path → 0 if it lives under a shadowed package dir
  [ "${#shadows[@]}" -eq 0 ] && return 1
  local p="$1" s
  for s in "${shadows[@]}"; do case "$p" in "$s"/*) return 0 ;; esac; done
  return 1
}

find_boundary_in() { # $1=dir → first boundary file under it (any boundary token)
  local base="$1" t f
  for t in "${btokens[@]}"; do
    f=$(find "$base" \( "${PRUNE[@]}" \) -prune -o -type f \( -name '*.ts' -o -name '*.tsx' \) -path "*/$t/*" -print 2>/dev/null | head -1)
    [ -n "$f" ] && { printf '%s\n' "$f"; return 0; }
  done
  return 1
}

any_src=$(find . \( "${PRUNE[@]}" \) -prune -o -type f \( -name '*.ts' -o -name '*.tsx' \) -print 2>/dev/null | head -1)
if [ -z "$any_src" ]; then
  echo "check-rule-enforced: no .ts/.tsx source yet — nothing to verify (skipped)."
  exit 0
fi

FAIL=0; CHECKED=0
echo "▶ check-rule-enforced: verifying R2 ($RULE) is actually APPLIED to boundary files (via eslint --print-config)"

# The config that GOVERNS a file = the NEAREST eslint.config.* at or above the file's dir. Run
# --print-config FROM that dir. GH #535 (reopen): the previous version ran from the repo root, but
# ESLint v9 resolves flat config by CWD — from root it always loaded the ROOT config (which wires R2
# on **/routes/**), so a shadowed package whose own config does NOT wire R2 still reported "applied"
# (false-green) while `turbo run lint` (which runs `eslint .` from each package dir) genuinely left
# R2 inert. Resolving from the governing dir matches turbo on v9 AND v10 (v10 resolves per-file, so
# cwd=package + file-under-package → same package config).
governing_dir() { # $1=file → nearest ancestor dir (incl the file's own dir) with an eslint.config.*, else "."
  local d
  d=$(dirname "$1")
  while [ -n "$d" ]; do
    flat_config_in "$d" >/dev/null && { printf '%s\n' "$d"; return 0; }   # .mts / .cts too, as ESLint loads them
    [ "$d" = "." ] && break
    d=$(dirname "$d")
  done
  printf '.\n'
}

nearest_pkg_json() { # $1=path → nearest package.json at/above its dir, walking up to ".", else non-zero
  local d
  d=$(dirname "$1")
  while [ -n "$d" ]; do
    [ -f "$d/package.json" ] && { printf '%s\n' "$d/package.json"; return 0; }
    [ "$d" = "." ] && break
    d=$(dirname "$d")
  done
  return 1
}

package_has_zod() { # $1=boundary file → 0 iff nearest package.json declares "zod" (not zod-to-json-schema etc.)
  local pj
  pj=$(nearest_pkg_json "$1") || return 1  # no package.json → not R2-relevant (conservative: skip)
  grep -qE '"zod"[[:space:]]*:' "$pj"
}

# Severity of $RULE in a print-config JSON on stdin → error | warn | off | absent | unparseable.
# The rule NAME being present proves nothing: print-config keeps a disabled rule as `"<rule>": [0]`,
# so a name-only match reported `'<rule>': 'off'` as "applied" (measured 2026-09-21 on a fresh
# ts-server install). check-fences-fire.sh lints in a temp dir with its own config and by design
# cannot see a consumer-side 'off', so this gate is the only one that can. node is always present
# where eslint is; if it somehow is not, the answer is `unparseable` and the caller fails closed.
rule_severity() {
  AIF_RULE="$RULE" node -e '
    let raw = "";
    process.stdin.on("data", (c) => (raw += c)).on("end", () => {
      let v;
      try { v = (JSON.parse(raw).rules || {})[process.env.AIF_RULE]; } catch { return console.log("unparseable"); }
      if (v === undefined) return console.log("absent");
      const s = Array.isArray(v) ? v[0] : v;
      console.log(s === 2 || s === "error" ? "error" : s === 1 || s === "warn" ? "warn" : s === 0 || s === "off" ? "off" : "unparseable");
    });' 2>/dev/null || echo unparseable
}

verify_file() { # $1=file
  local file="$1" gd rel label out rc err errfile sev=""
  gd=$(governing_dir "$file")
  if [ "$gd" = "." ]; then rel="$file"; label="root config"; else rel="${file#"$gd"/}"; label="${gd#./}"; fi
  CHECKED=$((CHECKED + 1))
  # Run from the governing dir — the same cwd `turbo run lint` uses for this package, so the resolved
  # config is what ACTUALLY lints the file (not the root config a root-cwd run would wrongly pick).
  # Keep rc AND stderr instead of discarding them: a CRASHED eslint (module resolution, broken config,
  # OOM) also prints no rule, so it used to emit the very same "SILENTLY INERT" ✗ line as genuine
  # inertness — ambiguous by construction, and the reason the 2026-08 consumer-matrix CI signature
  # could not be classified without an in-situ patch. Crash-shaped failures get their own message
  # below; the inertness branch stays byte-identical (its wording is a recorded reopen-trigger
  # signature) and both branches fail closed.
  errfile=$(mktemp)
  out=$( cd "$gd" && $ESLINT --print-config "$rel" 2>"$errfile" ); rc=$?
  err=$(cat "$errfile"); rm -f "$errfile"
  if [ "$rc" -ne 0 ]; then
    echo "  ✗ $label: eslint --print-config FAILED (rc=$rc) for ${file#./} — R2 enforcement is UNVERIFIED here, not known to be absent. This is a crash, not rule inertness: fix the eslint invocation, then re-run. eslint stderr:" >&2
    printf '%s\n' "${err:-(eslint wrote nothing to stderr)}" | sed 's/^/       /' >&2
    FAIL=1
    return 0
  fi
  sev=$(printf '%s' "$out" | rule_severity)
  if [ "$sev" = "error" ] || { [ "$sev" = "warn" ] && [ "${AIF_ENFORCED_ALLOW_WARN:-}" = "1" ]; }; then
    echo "  ✓ $label: R2 applied to ${file#./} (severity: $sev)"
  elif [ "$sev" = "off" ]; then
    echo "  ✗ $label: R2 ($RULE) is switched OFF in the resolved ESLint config for ${file#./} — present by name, but it reports nothing (SILENTLY INERT here)." >&2
    echo "     Set '$RULE' to 'error' in the eslint config governing $label (look for an 'off' / 0 entry on a block that matches ${file#./})." >&2
    FAIL=1
  elif [ "$sev" = "warn" ]; then
    echo "  ✗ $label: R2 ($RULE) is only 'warn' in the resolved ESLint config for ${file#./} — a warning fails no build unless every lint run passes --max-warnings=0." >&2
    echo "     Set '$RULE' to 'error' in the eslint config governing $label (or, if every lint channel really runs --max-warnings=0, export AIF_ENFORCED_ALLOW_WARN=1 for this gate)." >&2
    FAIL=1
  elif [ "$sev" = "unparseable" ]; then
    echo "  ✗ $label: could not read the rule severity from \`eslint --print-config\` for ${file#./} (output is not JSON, or node is unavailable) — R2 enforcement is UNVERIFIED here, not known to be absent." >&2
    FAIL=1
  else
    echo "  ✗ $label: R2 ($RULE) is NOT in the resolved ESLint config for ${file#./} — SILENTLY INERT here (verified from the package's own cwd, as \`turbo run lint\` resolves it)." >&2
    echo "     Wire '$RULE' into the eslint config governing $label (or re-export the root config that wires it)." >&2
    FAIL=1
  fi
}

# Root scope — the first boundary file NOT under any shadowed package (governed by the root config).
root_bf=""
while IFS= read -r f; do
  if ! under_shadow "$f"; then root_bf="$f"; break; fi
done < <(
  for t in "${btokens[@]}"; do
    find . \( "${PRUNE[@]}" \) -prune -o -type f \( -name '*.ts' -o -name '*.tsx' \) -path "*/$t/*" -print 2>/dev/null
  done
)
if [ -n "$root_bf" ]; then
  if package_has_zod "$root_bf"; then
    verify_file "$root_bf"
  else
    echo "  · root config: no zod boundary — R2 N/A (skipped)"
  fi
fi

# Each shadowed package that OWNS boundary files — governed by its own config, not the root one.
if [ "${#shadows[@]}" -gt 0 ]; then
  for s in "${shadows[@]}"; do
    bf=$(find_boundary_in "$s") || continue
    if package_has_zod "$bf"; then
      verify_file "$bf"
    else
      echo "  · ${s#./}: no zod boundary — R2 N/A (skipped)"
    fi
  done
fi

if [ "$CHECKED" -eq 0 ]; then
  echo "  · no boundary files anywhere — nothing for R2 to govern yet (skipped)."
fi

[ "$FAIL" -eq 0 ] && echo "check-rule-enforced: OK" || echo "check-rule-enforced: FAILED — R2 is not applied to ≥1 boundary file (silent inertness)." >&2
exit "$FAIL"
