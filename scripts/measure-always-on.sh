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
# OVERLAY SEMANTICS + EXCLUDE-PATTERN FORM: both now live in the shared SSOT
#   `scripts/lib/claude-md-excludes.sh`, sourced below. They used to be duplicated in prose
#   here and implemented a fourth, DEAD way in scripts/measure-session-start-tokens.sh
#   (`grep -Fxq` against glob entries — 0 of 8 matched, overstating the resident set 2.37x,
#   measured 2026-09-14). The lib is the `#sync-by-copy-paste` counter from
#   `.claude/rules/dual-implementation-discipline.md` §8: one SSOT, the consumers point at it.
#   This meter's exclusion behaviour is unchanged by the extraction — `scripts/measure-always-on.test.sh`
#   is the floor that says the manifest is still being measured at all.
#
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

# Effective claudeMdExcludes + the membership test: shared SSOT (see header).
# shellcheck source=lib/claude-md-excludes.sh
. "$REPO_ROOT/scripts/lib/claude-md-excludes.sh"
claude_md_excludes_load "$SETTINGS" ".claude/settings.local.json" || {
  # T3 — fail loudly. The lib already named the offending entries on stderr; a meter
  # that shrugged and carried on would silently mis-price the context budget, which is
  # the exact defect class this whole extraction closes.
  exit 3
}
overlay_source="$CLAUDE_MD_EXCLUDES_SOURCE"

excluded_count=0
is_excluded() { claude_md_excludes_match "$1"; }

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
echo "[measure-always-on] overlay_source=$overlay_source resident_count=${#files[@]} excluded_count=$excluded_count excludes_applied=$(claude_md_excludes_count)" >&2
