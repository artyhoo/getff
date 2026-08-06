#!/usr/bin/env bash
# Measure the always-on context baseline (bytes) — the ai-doc-audit exit-criterion meter.
# Always-on sources = files CC loads at session start (no path-scope trigger required).
#   manifest = CLAUDE.md + .claude/rules/*.md files LACKING ^paths: frontmatter
# Files WITH paths: frontmatter are read-time-scoped (load only on matching-file events)
#   and therefore NOT in the always-on resident set. This is the scripts/probe-channels.sh:20
#   predicate (`grep -qE '^paths:' "$rule"`), reused here so two consumers share one idiom.
# Semantic ownership of the channel predicate lives in
#   packages/core/principles/rule-channel-glob.ts (S-G-owned; not edited here).
# spec: docs/superpowers/specs/2026-06-04-ai-doc-audit-design.md §Success-criteria
# spec: docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md §1.6 FORK D (rev 4)
#
# OVERLAY-VERDICT PARK (load-bearing — spec §1.6 FORK D round-4 MAJOR-3, parked per kickoff
# §1 item 4 binding instruction "PARK if the docs contradict the replace model"):
#   The kickoff required a "REPLACE-PER-KEY overlay" semantics where a local
#   .claude/settings.local.json claudeMdExcludes SHADOWS the project list entirely.
#   Primary docs (verified 2026-08-06 via WebFetch on https://code.claude.com/docs/en/settings)
#   state: "scalar values from higher-priority scopes override and arrays concatenate,
#   each with the exceptions described under Settings precedence". `claudeMdExcludes` is an
#   array → it CONCATENATES across scopes under primary docs, NOT replace.
#   The replace model the kickoff assumed is CONTRADICTED by primary docs.
#   Per the binding instruction "PARK if the docs contradict the replace model":
#     - This meter applies ONLY the project `.claude/settings.json` claudeMdExcludes list.
#     - Local-overlay handling (concat, replace, or anything else) is PARKED pending
#       spec/docs reconciliation. See
#       docs/meta-factory/research-patches/2026-08-06-claudemd-overlay-semantics-verdict.md
#       (the verdict research-patch carries the primary-source citations).
#     - On the host this branch runs in, .claude/settings.local.json is ABSENT, so the
#       overlay model is unobservable here regardless (effective excludes = project list).
#   Effective-overlay source is named on stderr below ("project" — the only source this
#   meter consults pending the overlay verdict).
#
# EXCLUDE-PATTERN FORM (bash-native; picomatch-equivalent for the **/<name>.md form):
#   The project list uses picomatch's `**/<name>.md` form. Picomatch is not yet a declared
#   devDep at the root (Task 3 / P2a pins it in packages/core). To stay bash-only and not
#   introduce a runtime dependency on a transitive install, this meter matches excludes via
#   bash `case` over the basename: `*/<name>.md|<name>.md` matches anything ending in
#   `/<name>.md`. This is the exact bash translation of picomatch's `**/<name>.md` for
#   single-segment filenames (all current excludes are in that form per PR #1223). A future
#   exclude in a different form (e.g. `dir/**` or `*.ext`) would need an extension here.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT" || exit 1
SETTINGS=".claude/settings.json"

# Build the resident manifest: CLAUDE.md + .claude/rules/*.md LACKING ^paths: frontmatter.
files=( "CLAUDE.md" )
while IFS= read -r r; do files+=( "$r" ); done < <(
  for rule in .claude/rules/*.md; do
    [[ -f "$rule" ]] || continue
    # probe-channels.sh:20 twin idiom — grep -qE '^paths:' "$rule"
    if grep -qE '^paths:' "$rule"; then
      continue  # path-scoped rule, not resident
    fi
    printf '%s\n' "$rule"
  done | sort
)

# Effective claudeMdExcludes — PROJECT list only (overlay verdict PARKED, see header).
overlay_source="project"
excludes=()
if [[ -f "$SETTINGS" ]] && command -v jq >/dev/null 2>&1; then
  while IFS= read -r e; do
    [[ -n "$e" ]] && excludes+=( "$e" )
  done < <(jq -r '.claudeMdExcludes[]? // empty' "$SETTINGS")
fi

excluded_count=0
is_excluded() {
  # bash-native equivalent of picomatch(**/<name>.md, {dot:true}) for single-segment names.
  local path="$1" pat stripped
  for pat in "${excludes[@]}"; do
    case "$pat" in
      '**/'*) stripped="${pat#\*\*/}"; case "$path" in */"$stripped"|"$stripped") return 0;; esac ;;
      *) case "$path" in "$pat") return 0;; esac ;;
    esac
  done
  return 1
}

total=0
printf '{\n  "sources": [\n'
first=1
for f in "${files[@]}"; do
  [[ -f "$f" ]] || continue
  if is_excluded "$f"; then
    excluded_count=$(( excluded_count + 1 ))
    continue
  fi
  b=$(wc -c < "$f" | tr -d ' ')
  total=$(( total + b ))
  [[ $first -eq 0 ]] && printf ',\n'
  printf '    {"path": "%s", "bytes": %s}' "$f" "$b"
  first=0
done
printf '\n  ],\n  "total_bytes": %s\n}\n' "$total"

# Stderr diagnostic (verbose logging per plan §Settings).
echo "[measure-always-on] overlay_source=$overlay_source resident_count=${#files[@]} excluded_count=$excluded_count excludes_applied=${#excludes[@]}" >&2
