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
# OVERLAY SEMANTICS — MERGE (union + dedupe). Established 2026-08-07 by reading the shipped
# client, which supersedes the earlier REPLACE-PER-KEY reading (spec §1.6 FORK D round-4
# MAJOR-3) that this comment used to assert:
#   `claude.exe` v2.1.207 folds every settings source through a lodash-mergeWith-shaped call
#   whose customizer is `ipe(objValue, srcValue, key)`. For arrays it returns
#   `Mo([...objValue, ...srcValue])` = `[...new Set(...)]` — union with dedupe — EXCEPT for
#   `key === "fallbackModel"`, the one hard-coded replace. `claudeMdExcludes` is not that key.
#   Therefore the effective list is `project ∪ local`: a local `.claude/settings.local.json`
#   can only ADD excludes, never subtract. This is also what the docs say — `settings.md:278`
#   names `fallbackModel` as the array key that does NOT merge, implying the rest do.
#   Falsifier: a client ≥2.1.211 whose `ipe` special-cases `claudeMdExcludes` too.
#   This meter applies the UNION of both lists; the source composition is named on stderr.
#   See docs/meta-factory/research-patches/2026-08-06-claudemd-overlay-semantics-verdict.md
#   for the corrected verdict narrative and the full evidence chain.
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

# Effective claudeMdExcludes — UNION of project and local, deduped (see the header note on
# overlay semantics). The local file can only ADD excludes; it never subtracts from project.
SETTINGS_LOCAL=".claude/settings.local.json"
overlay_source="none"
excludes=()
if command -v jq >/dev/null 2>&1; then
  # `overlay_source` reports which files SET the key — deliberately not "which files
  # contributed a new pattern". A local list whose every entry is already in the project
  # list contributes nothing after dedupe, but it exists and the operator should see it;
  # collapsing it into "project" would hide a real overlay behind an accident of content.
  has_project=0
  has_local=0
  for f in "$SETTINGS" "$SETTINGS_LOCAL"; do
    [[ -f "$f" ]] || continue
    jq -e 'has("claudeMdExcludes")' "$f" >/dev/null 2>&1 || continue
    [[ "$f" == "$SETTINGS" ]] && has_project=1 || has_local=1
    while IFS= read -r e; do
      [[ -n "$e" ]] || continue
      # dedupe — the client's Mo() is [...new Set(...)], so a pattern present in both
      # files is applied once.
      for have in ${excludes[@]+"${excludes[@]}"}; do
        [[ "$have" == "$e" ]] && continue 2
      done
      excludes+=( "$e" )
    done < <(jq -r '.claudeMdExcludes[]? // empty' "$f")
  done
  if [[ "$has_project" -eq 1 && "$has_local" -eq 1 ]]; then
    overlay_source="project+local"
  elif [[ "$has_local" -eq 1 ]]; then
    overlay_source="local"
  elif [[ "$has_project" -eq 1 ]]; then
    overlay_source="project"
  fi
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
