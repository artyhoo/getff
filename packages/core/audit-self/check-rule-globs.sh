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

CFG="${ESLINT_CONFIG:-eslint.config.mjs}"

# §807 multi-stack: a #793/#796 monorepo ships per-workspace eslint.config.mjs files and NO root
# config — the per-workspace configs ARE the rule layer. Without this, the exit-2 guard below fires
# before any shadow logic and validate goes RED 6/10. So when there is no root config (and we are
# not already a per-workspace sub-invocation — ESLINT_CONFIG unset is the recursion guard), find the
# per-workspace configs and run THIS SAME script once per workspace, from that workspace's dir with
# ESLINT_CONFIG=eslint.config.mjs. Each child then sees a valid $CFG and its existing find/shadow
# logic scopes to that subtree. Aggregate exit codes (any non-zero → non-zero).
# Capture an ABSOLUTE self-path BEFORE any cd so the `bash "$SELF"` re-exec survives `cd "$_wd"`
# (and the child's r2-na-marker source resolves via its own absolute $0). (kickoff ⚑M1 / T-807-A)
SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
if [ ! -f "$CFG" ] && [ -z "${ESLINT_CONFIG:-}" ]; then
  # Prune node_modules and the framework's vendored packages/core (mirrors the PRUNE below) so a
  # vendored config there can't fake a workspace. Exclude the root config (it doesn't exist on this
  # path, but the `! -path` keeps the find symmetric with check-rule-enforced.sh).
  _ws_cfgs="$(find . \( -name node_modules -o -path '*/packages/core' \) -prune -o \
              -type f -name 'eslint.config.mjs' ! -path './eslint.config.mjs' -print 2>/dev/null)"
  if [ -n "$_ws_cfgs" ]; then
    _agg=0
    while IFS= read -r _wc; do
      [ -n "$_wc" ] || continue
      _wd="$(dirname "$_wc")"
      # Only RN/Expo/bare-RN ship NO RULE_GLOBS.boundary → R2 N/A there; skip (do NOT fail — an empty
      # boundary would make check_rule FAIL, globs.sh:208-210). react-spa AND react-next DO ship a
      # populated boundary block → they fall through and recurse normally. (kickoff ⚑B2 / T-807-B)
      grep -qE '^[[:space:]]*boundary:[[:space:]]*\[' "$_wc" \
        || { echo "  · ${_wd#./}: no RULE_GLOBS.boundary — R2 N/A (skipped)"; continue; }
      ( cd "$_wd" && ESLINT_CONFIG=eslint.config.mjs bash "$SELF" ) || _agg=1
    done <<EOF
$_ws_cfgs
EOF
    exit "$_agg"
  fi
  # No per-workspace configs either → fall through to the exit-2 guard (genuine "run from root" error).
fi
[ -f "$CFG" ] || { echo "check-rule-globs: $CFG not found (run from the project root)" >&2; exit 2; }

# C4 (GH #547 Point 2): honor a recorded R2 N/A decision via the shared marker helper (sibling file),
# re-verifying its precondition mechanically — so a recorded N/A is conditional, not a permanent off.
# shellcheck source=/dev/null
. "$(dirname "$0")/r2-na-marker.sh"

# `packages/core` is the framework's VENDORED install target (install.sh ships hooks/,
# eslint-rules/, audit-self/, principles/ there). Post-#735 the shipped
# packages/core/eslint-rules/index.ts matches the install-injected `**/eslint-rules/**`
# boundary glob — counting vendored framework code toward USER R2 coverage is exactly the
# FALSE-GREEN this gate exists to prevent (see the shadow-package rationale below). Prune it
# so the gate measures the consumer's OWN boundary coverage, not the framework it vendored.
# Mirrors detect-r2-boundary.sh's existing `eslint-rules-local` exclusion. (GH #777 — this gate
# runs consumer-side only; the framework repo does not invoke it.)
PRUNE=( -name node_modules -o -name dist -o -name coverage -o -name .stryker-tmp -o -name reports -o -name .next -o -name .git -o -path '*/packages/core' )

# ── #507 (reopen #2): per-package ESLint flat configs SHADOW the root ──────────
# ESLint flat-config resolution is NEAREST-config: a sub-package shipping its own
# eslint.config.* is linted by THAT config, not the root one this gate reads. So a file under
# such a package is NOT governed by the root R2 — counting it toward root coverage is a
# FALSE-GREEN (planting apps/api/src/routes/x.ts flipped the gate to PASS while R2 stayed dead
# there). Discover those package dirs so we can (a) PRUNE them from the root-coverage probe and
# (b) check each package's own config separately (check_shadowed_boundary below). Only FLAT
# configs shadow a root flat config in ESLint 9 — legacy .eslintrc* is ignored under flat, so
# it is intentionally NOT treated as a shadow here.
shadow_dirs() {
  find . \( "${PRUNE[@]}" \) -prune -o -type f \
    \( -name 'eslint.config.js' -o -name 'eslint.config.mjs' \
       -o -name 'eslint.config.cjs' -o -name 'eslint.config.ts' \) -print 2>/dev/null \
  | while IFS= read -r f; do
      d=$(dirname "$f")
      [ "$d" = "." ] && continue   # the root config is what this gate reads — not a shadow
      printf '%s\n' "$d"
    done | sort -u
}
SHADOWS="$(shadow_dirs)"

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

# Extract the quoted globs for a RULE_GLOBS key (boundary|appCode|application).
# Prints one glob per line. Reads the multi-line array from `<key>: [ ... ]`.
extract_key() {
  awk -v key="$1" '
    $0 ~ ("^[[:space:]]*" key ":[[:space:]]*\\[") { grab=1 }
    grab {
      while (match($0, /'"'"'[^'"'"']*'"'"'/)) {
        g=substr($0, RSTART+1, RLENGTH-2); print g
        $0=substr($0, RSTART+RLENGTH)
      }
      if ($0 ~ /\]/) grab=0
    }
  ' "$CFG"
}

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
  local cfg="$1"
  [ -n "$cfg" ] && [ -f "$cfg" ] || { echo uncertain; return; }
  if grep -qE 'rules-as-tests|no-unsafe-zod-parse' "$cfg"; then echo wired; return; fi
  # A package re-exports / extends a shared base when it: `extends`; imports an `eslint-config`
  # pkg/path; OR imports a config FILE whose specifier contains `eslint` and ends in a JS/TS module
  # extension (timeliner's `import base from '@scope/config/eslint/base.mjs'`). Any of these MAY
  # inherit R2 — bash can't follow the chain → uncertain (WARN), never a false-FAIL. The trailing
  # extension anchors the file-import branch so a bare plugin like `@typescript-eslint/eslint-plugin`
  # (no module extension in its specifier) is NOT swallowed and stays classifiable as dead. (GH #516.)
  if grep -qE "(from|require\()[[:space:]]*[(]?['\"][^'\"]*eslint[.-]?config[^'\"]*['\"]|extends" "$cfg" \
     || grep -qE "(from|require\()[[:space:]]*[(]?['\"][^'\"]*eslint[^'\"]*\.(mjs|cjs|js|ts)['\"]" "$cfg"; then
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
    cfg=$(find "$d" -maxdepth 1 -type f \( -name 'eslint.config.js' -o -name 'eslint.config.mjs' -o -name 'eslint.config.cjs' -o -name 'eslint.config.ts' \) 2>/dev/null | head -1)
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
