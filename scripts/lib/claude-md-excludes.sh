#!/usr/bin/env bash
# SSOT for reading and applying `claudeMdExcludes` from bash.
#
# WHY THIS FILE EXISTS
#   `claudeMdExcludes` had FOUR readers, each with its own matching grammar, and one of them
#   was dead: `scripts/measure-session-start-tokens.sh` tested membership with `grep -Fxq`
#   (exact-line) against entries that are globs, so it matched 0 of 8 and reported every
#   excluded rule as resident — a 2.37x overstatement of the always-on token budget
#   (measured 2026-09-14, CC 2.1.270). That is `#sync-by-copy-paste` per
#   `.claude/rules/dual-implementation-discipline.md` §8, whose counter is «extract the
#   shared spec; one channel becomes the SSOT, the other points to it». This file is that
#   SSOT for the bash channel; `scripts/measure-always-on.sh` and
#   `scripts/measure-session-start-tokens.sh` are its two consumers.
#
# spec: docs/superpowers/specs/2026-09-14-context-economy-self-enforcement-design.md §2
# spec: packages/core/principles/34-claudemd-excludes-liveness.test.ts
#       (the TS channel; picomatch `{dot:true}` against ABSOLUTE paths is the client's own
#        grammar — SSOT docs/meta-factory/prior-art-evaluations.md#238)
#
# WHY BASH AND NOT A SHELL-OUT TO PICOMATCH
#   picomatch is pinned in `packages/core`, NOT at the root, and SSOT #238 says why: the root
#   carries a DIFFERENT MAJOR (measured 2026-09-14 — root 2.3.2, packages/core 4.0.5), so a
#   `node -e` from the repo root would silently load the wrong matcher. picomatch also ships
#   no CLI, so a shell-out means authoring a new node entry point. The bash `case` translation
#   below is exact for the `**/<name>.md` form and is kept honest by the cross-grammar parity
#   leg in `scripts/lib/claude-md-excludes.test.sh`, which runs a fixture corpus through BOTH
#   this matcher and packages/core's pinned picomatch and asserts identical verdicts. Without
#   that leg, «bash-native equivalent of picomatch» would be `#hope-as-gate`
#   (`.claude/rules/attention-is-not-a-mechanism.md` §2).
#
# OVERLAY SEMANTICS — MERGE (union + dedupe), established 2026-08-07 by reading the shipped
#   client: `claude.exe` folds settings sources through a lodash-mergeWith-shaped call whose
#   array customizer returns `[...new Set([...objValue, ...srcValue])]` for every key except
#   `fallbackModel`. `claudeMdExcludes` is not that key, so the effective list is
#   `project ∪ local`: `.claude/settings.local.json` can only ADD excludes, never subtract.
#   Falsifier: a client whose customizer special-cases `claudeMdExcludes` too.
#   See docs/meta-factory/research-patches/2026-08-06-claudemd-overlay-semantics-verdict.md.
#
# BASH 3.2 CONSTRAINT (macOS ships 3.2.57): no `declare -A`, no `mapfile`, no `readarray`.
#   State lives in a plain indexed array; membership is a `case` loop. A 3.2-invalid construct
#   here does not degrade gracefully — it aborts the sourcing script mid-enumeration and the
#   meter silently prints empty sections, which is the worst failure mode for an instrument
#   whose whole job is to be believed.
#
# PUBLIC SURFACE (everything else is an implementation detail):
#   claude_md_excludes_load [project_settings] [local_settings]
#       -> populates CLAUDE_MD_EXCLUDES[] and CLAUDE_MD_EXCLUDES_SOURCE
#   claude_md_excludes_match <path>          -> 0 if some entry matches, 1 otherwise
#   claude_md_excludes_matching_files <entry> -> prints repo files the entry matches
#   claude_md_excludes_count                 -> prints the number of loaded entries
#   claude_md_excludes_entry_supported <e>   -> 0 if this lib can match <e> faithfully
# claude_md_excludes_load returns 2 (and names the entries) if any entry is unsupported.

# Guard against double-sourcing (both meters may be sourced in one test harness process).
if [[ -n "${CLAUDE_MD_EXCLUDES_LIB_LOADED:-}" ]]; then
  return 0 2>/dev/null || true
fi
CLAUDE_MD_EXCLUDES_LIB_LOADED=1

# Loaded entries, verbatim as committed (globs, not resolved paths).
CLAUDE_MD_EXCLUDES=()
# Which settings files SET the key — "none" | "project" | "local" | "project+local".
# Deliberately reports which files SET it, not which contributed a NEW pattern: a local list
# whose every entry is already in the project list contributes nothing after dedupe, but it
# exists and the operator should see it. Collapsing it to "project" would hide a real overlay
# behind an accident of content.
CLAUDE_MD_EXCLUDES_SOURCE="none"

# claude_md_excludes_load [project_settings] [local_settings]
#   Defaults: .claude/settings.json and .claude/settings.local.json, relative to $PWD.
#   Requires jq; without it the list stays empty and the source stays "none" (a caller that
#   needs jq must say so itself — this lib does not exit on the caller's behalf).
claude_md_excludes_load() {
  local project="${1:-.claude/settings.json}"
  local local_settings="${2:-.claude/settings.local.json}"
  local f e have has_project=0 has_local=0

  CLAUDE_MD_EXCLUDES=()
  CLAUDE_MD_EXCLUDES_SOURCE="none"
  command -v jq >/dev/null 2>&1 || return 0

  for f in "$project" "$local_settings"; do
    [[ -f "$f" ]] || continue
    jq -e 'has("claudeMdExcludes")' "$f" >/dev/null 2>&1 || continue
    if [[ "$f" == "$project" ]]; then has_project=1; else has_local=1; fi
    while IFS= read -r e; do
      [[ -n "$e" ]] || continue
      # Dedupe — the client's array customizer is `[...new Set(...)]`, so a pattern present
      # in both files is applied once.
      for have in ${CLAUDE_MD_EXCLUDES[@]+"${CLAUDE_MD_EXCLUDES[@]}"}; do
        [[ "$have" == "$e" ]] && continue 2
      done
      CLAUDE_MD_EXCLUDES+=( "$e" )
    done < <(jq -r '.claudeMdExcludes[]? // empty' "$f")
  done

  # Refuse to guess on a form this lib cannot match faithfully (see SUPPORTED ENTRY FORMS).
  CLAUDE_MD_EXCLUDES_UNSUPPORTED=""
  for e in ${CLAUDE_MD_EXCLUDES[@]+"${CLAUDE_MD_EXCLUDES[@]}"}; do
    if ! claude_md_excludes_entry_supported "$e"; then
      CLAUDE_MD_EXCLUDES_UNSUPPORTED="${CLAUDE_MD_EXCLUDES_UNSUPPORTED:+$CLAUDE_MD_EXCLUDES_UNSUPPORTED, }$e"
    fi
  done
  if [[ -n "$CLAUDE_MD_EXCLUDES_UNSUPPORTED" ]]; then
    echo "FATAL: claudeMdExcludes entries this matcher cannot evaluate faithfully: $CLAUDE_MD_EXCLUDES_UNSUPPORTED" >&2
    echo "       Supported: '**/<basename>' (no glob metacharacter) or a literal path." >&2
    echo "       Extend scripts/lib/claude-md-excludes.sh and its parity test, do not widen silently." >&2
    return 2
  fi

  if [[ "$has_project" -eq 1 && "$has_local" -eq 1 ]]; then
    CLAUDE_MD_EXCLUDES_SOURCE="project+local"
  elif [[ "$has_local" -eq 1 ]]; then
    CLAUDE_MD_EXCLUDES_SOURCE="local"
  elif [[ "$has_project" -eq 1 ]]; then
    CLAUDE_MD_EXCLUDES_SOURCE="project"
  fi
  return 0
}

claude_md_excludes_count() {
  printf '%s' "${#CLAUDE_MD_EXCLUDES[@]}"
}

# SUPPORTED ENTRY FORMS — deliberately narrow, and enforced at load time.
#
#   `**/<basename>`        the live form (every committed entry). Matches anything ending in
#                          `/<basename>`, or `<basename>` itself at the tree root. This is
#                          picomatch's `**/<name>` with {dot:true} for a basename containing
#                          no glob metacharacter — VERIFIED identical, not asserted: the
#                          parity leg in claude-md-excludes.test.sh runs the whole tracked
#                          tree through both grammars.
#   `<literal/path>`       the historical repo-relative form, exact-compared. INERT in the
#                          real client (its normaliser skips patterns not starting with "/"),
#                          which is what principle 34's N34-1a leg asserts. Resolved here for
#                          continuity, not blessed.
#
# ANY OTHER FORM IS REJECTED AT LOAD TIME rather than guessed at. Measured 2026-09-14, the
# bash `case` translation and picomatch DIVERGE outside the two forms above:
#   `*.md`    vs `other/y.md`  -> bash MATCHES (its `*` crosses `/`), picomatch does not
#   `**/*.md` vs `a/x.md`      -> picomatch matches, bash does not (the stripped remainder is
#                                 quoted, hence a literal)
# The old header comment promised «a future exclude in a different form would need an
# extension here» and nothing checked it — `#hope-as-gate`. Now the promise is executable:
# such an entry makes `claude_md_excludes_load` fail loudly instead of silently mis-pricing
# the context budget, which is the same reason principle 31's resolveExcludeEntry errors on
# an ambiguous basename rather than taking a first match.
CLAUDE_MD_EXCLUDES_UNSUPPORTED=""

# claude_md_excludes_entry_supported <entry> -> 0 if this lib can match it faithfully.
claude_md_excludes_entry_supported() {
  local entry="$1" rest
  case "$entry" in
    '**/'*)
      rest="${entry#\*\*/}"
      # A single path segment with no glob metacharacter.
      case "$rest" in
        ''|*/*|*'*'*|*'?'*|*'['*|*'{'*) return 1 ;;
        *) return 0 ;;
      esac
      ;;
    *'*'*|*'?'*|*'['*|*'{'*) return 1 ;;
    '') return 1 ;;
    *) return 0 ;;
  esac
}

# claude_md_excludes_match_one <path> <pattern>
#   The single place the grammar lives. Assumes the pattern passed
#   claude_md_excludes_entry_supported (claude_md_excludes_load enforces that).
claude_md_excludes_match_one() {
  local path="$1" pat="$2" stripped
  case "$pat" in
    '**/'*)
      stripped="${pat#\*\*/}"
      case "$path" in */"$stripped"|"$stripped") return 0 ;; esac
      ;;
    *)
      [[ "$path" == "$pat" ]] && return 0
      ;;
  esac
  return 1
}

# claude_md_excludes_match <path> -> 0 if ANY loaded entry matches.
claude_md_excludes_match() {
  local path="$1" pat
  for pat in ${CLAUDE_MD_EXCLUDES[@]+"${CLAUDE_MD_EXCLUDES[@]}"}; do
    claude_md_excludes_match_one "$path" "$pat" && return 0
  done
  return 1
}

# claude_md_excludes_matching_files <entry> [file...]
#   Prints every given file the entry matches, one per line. With no file arguments, sweeps
#   the tracked tree via `git ls-files`. This is what a reporting consumer needs instead of
#   stat-ing the entry itself: an entry is a GLOB, so `[[ -f "$entry" ]]` is always false and
#   a report built on it prints "file absent" for every live exclude (the Section B half of
#   the 2026-09-14 defect).
claude_md_excludes_matching_files() {
  local entry="$1"; shift
  local f
  if [[ $# -gt 0 ]]; then
    for f in "$@"; do
      claude_md_excludes_match_one "$f" "$entry" && printf '%s\n' "$f"
    done
    return 0
  fi
  while IFS= read -r f; do
    [[ -n "$f" ]] || continue
    claude_md_excludes_match_one "$f" "$entry" && printf '%s\n' "$f"
  done < <(git ls-files 2>/dev/null)
  return 0
}
