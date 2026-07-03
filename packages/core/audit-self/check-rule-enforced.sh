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
# detect-r2-boundary.sh:84 — `"zod"[[:space:]]*:` — matching `"zod":` exactly and NOT matching
# `"zod-to-json-schema":` / `"@hono/zod-openapi":`. The "R2 ⟺ zod present" principle applies at
# package granularity here; at call-site granularity in no-unsafe-zod-parse.ts (GH #737) — same
# principle, different files, neither duplicated.
#
# Exit: 0 = R2 is in the resolved config of every checked boundary file (or no boundary file yet, or
#           eslint not installed → skip); 1 = R2 is missing from the resolved config of ≥1 boundary
#           file (silent inertness — the false-green this gate exists to catch).
set -uo pipefail

CFG="${ESLINT_CONFIG:-eslint.config.mjs}"
RULE="${AIF_ENFORCED_RULE:-rules-as-tests/no-unsafe-zod-parse}"

# §807 multi-stack: a #793/#796 monorepo ships per-workspace eslint.config.mjs files and NO root
# config — the per-workspace configs ARE the rule layer. Without this, the exit-2 guard below fires
# before any shadow logic and validate goes RED. So when there is no root config (and we are not
# already a per-workspace sub-invocation — ESLINT_CONFIG unset is the recursion guard), find the
# per-workspace configs and run THIS SAME script once per workspace, from that workspace's dir with
# ESLINT_CONFIG=eslint.config.mjs. Each child then sees a valid $CFG; eslint absent → each child
# SKIPs (exit 0), the correct deps-free degrade. Aggregate exit codes (any non-zero → non-zero).
# Capture an ABSOLUTE self-path BEFORE any cd so the `bash "$SELF"` re-exec survives `cd "$_wd"`
# (and the child's r2-na-marker source resolves via its own absolute $0). (kickoff ⚑M1 / T-807-A)
SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
if [ ! -f "$CFG" ] && [ -z "${ESLINT_CONFIG:-}" ]; then
  _ws_cfgs="$(find . \( -name node_modules -o -path '*/packages/core' \) -prune -o \
              -type f -name 'eslint.config.mjs' ! -path './eslint.config.mjs' -print 2>/dev/null)"
  if [ -n "$_ws_cfgs" ]; then
    _agg=0
    while IFS= read -r _wc; do
      [ -n "$_wc" ] || continue
      _wd="$(dirname "$_wc")"
      # Only RN/Expo/bare-RN ship NO RULE_GLOBS.boundary → R2 N/A there; skip. The empty-btokens path
      # below (enforced.sh:82-85) already self-skips, but keep the guard for parity with
      # check-rule-globs.sh. react-spa/react-next ship a boundary → they recurse normally. (⚑B2)
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
[ -f "$CFG" ] || { echo "check-rule-enforced: $CFG not found (run from the project root)" >&2; exit 2; }

PRUNE=( -name node_modules -o -name dist -o -name coverage -o -name .stryker-tmp -o -name reports -o -name .next -o -name .git )

# C4 (GH #547 Point 2): honor a recorded R2 N/A decision through the SAME shared helper as
# check-rule-globs.sh (two gates, one marker). The recheck is pure-bash (no eslint), so it short-
# circuits before eslint resolution. No marker → fall through to today's --print-config behaviour.
# shellcheck source=/dev/null
. "$(dirname "$0")/r2-na-marker.sh"
if r2_na_marker_present; then
  case "$(r2_na_recheck)" in
    holds) echo "▶ check-rule-enforced: R2 N/A recorded for this layout — precondition holds (declarative validation)."; echo "check-rule-enforced: OK"; exit 0 ;;
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
done < <(awk '
  $0 ~ /^[[:space:]]*boundary:[[:space:]]*\[/ { grab=1 }
  grab {
    while (match($0, /'"'"'[^'"'"']*'"'"'/)) { g=substr($0, RSTART+1, RLENGTH-2); print g; $0=substr($0, RSTART+RLENGTH) }
    if ($0 ~ /\]/) grab=0
  }' "$CFG")

if [ "${#btokens[@]}" -eq 0 ]; then
  echo "check-rule-enforced: no RULE_GLOBS.boundary tokens in $CFG — nothing to verify (skipped)."
  exit 0
fi

# Packages shipping their OWN flat eslint config shadow the root config (nearest-config resolution).
shadows=()
while IFS= read -r d; do [ -n "$d" ] && shadows+=("$d"); done < <(
  find . \( "${PRUNE[@]}" \) -prune -o -type f \
    \( -name 'eslint.config.js' -o -name 'eslint.config.mjs' \
       -o -name 'eslint.config.cjs' -o -name 'eslint.config.ts' \) -print 2>/dev/null \
  | while IFS= read -r f; do d=$(dirname "$f"); [ "$d" = "." ] && continue; printf '%s\n' "$d"; done | sort -u
)

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
    for c in eslint.config.js eslint.config.mjs eslint.config.cjs eslint.config.ts; do
      [ -f "$d/$c" ] && { printf '%s\n' "$d"; return 0; }
    done
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

verify_file() { # $1=file
  local file="$1" gd rel label out
  gd=$(governing_dir "$file")
  if [ "$gd" = "." ]; then rel="$file"; label="root config"; else rel="${file#"$gd"/}"; label="${gd#./}"; fi
  CHECKED=$((CHECKED + 1))
  # Run from the governing dir — the same cwd `turbo run lint` uses for this package, so the resolved
  # config is what ACTUALLY lints the file (not the root config a root-cwd run would wrongly pick).
  out=$( cd "$gd" && $ESLINT --print-config "$rel" 2>/dev/null )
  if printf '%s' "$out" | grep -q "$RULE"; then
    echo "  ✓ $label: R2 applied to ${file#./}"
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
