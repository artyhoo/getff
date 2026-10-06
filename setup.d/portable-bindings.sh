#!/usr/bin/env bash
# Common payload delivery and native discovery bindings. Consumer content follows
# the installer ownership guards; only byte-identical bindings become links.
# @cc-only-rationale: sourced installer library, also serves portable native entries

# Parent directory overrides protect every file they contain, including a common
# file reached through a native compatibility link.
_portable_owned_path() {
  local file="$1"
  case "$file" in "${PROJECT_ROOT:-.}"/*) ;; *) return 1 ;; esac
  while [ "$file" != "$PROJECT_ROOT" ]; do
    [ ! -e "${file%.md}.override.md" ] || return 0
    file="${file%/*}"
  done
  return 1
}

_portable_copy() {
  local src="$1" dst="$2" temp=""
  if _portable_owned_path "$dst"; then
    echo "  ⊝ $dst (.override.md — consumer-owned, keeping)"
    return 0
  fi
  if [ "${src##*.}" = md ]; then
    temp="$(mktemp "${TMPDIR:-/tmp}/getff-portable.XXXXXX")"
    cp -pL "$src" "$temp"
    transform_internal_refs "$temp"
    src="$temp"
  fi
  if [ -n "${REFRESH:-}" ] || [ "${GETFF_TOOLCHAIN_REFRESH:-}" = 1 ]; then
    refresh_safe "$src" "$dst"
  else
    copy_safe "$src" "$dst"
  fi
  [ -z "$temp" ] || rm -f "$temp"
}

_portable_relative() {
  local target="$1" native="$2" rest relative
  relative="${target#"$PROJECT_ROOT"/}"
  rest="${native%/*}"; rest="${rest#"$PROJECT_ROOT"/}"
  # Keep bindings within the shared tree readable (skills/foo → procedures/foo)
  # while producing correct upward links from native harness directories.
  while [ -n "$rest" ] && [ "${relative%%/*}" = "${rest%%/*}" ]; do
    relative="${relative#*/}"
    case "$rest" in */*) rest="${rest#*/}" ;; *) rest="" ;; esac
  done
  while [ -n "$rest" ]; do
    relative="../$relative"
    case "$rest" in */*) rest="${rest#*/}" ;; *) rest="" ;; esac
  done
  printf '%s\n' "$relative"
}

# Replace only equal bytes, never a customized legacy discovery entry. The common
# payload stays usable when a consumer elects to retain their native customization.
_portable_alias() {
  local canonical="$1" native="$2" relative
  if [ "$DRY_RUN" = --dry-run ]; then
    echo "  [dry-run] would bind: $native → $canonical (matching entries only)"
    return 0
  fi
  [ -f "$canonical" ] || return 0
  if ! _canonical_link_target "$canonical" >/dev/null; then
    echo "  · $native kept (canonical target is outside the consumer common tree)"
    return 0
  fi
  if _portable_owned_path "$native"; then return 0; fi
  if [ -L "$native" ] && ! _canonical_link_target "$native" >/dev/null; then
    echo "  · $native kept (consumer-owned external or custom compatibility link)"
    return 0
  fi
  if [ -e "$native" ] || [ -L "$native" ]; then
    if ! cmp -s "$canonical" "$native"; then
      echo "  · $native kept (custom native entry; canonical source available at $canonical)"
      return 0
    fi
  fi
  relative="$(_portable_relative "$canonical" "$native")"
  mkdir -p "$(dirname "$native")"
  # At this point the file is proven byte-identical to the delivered common source.
  # No refresh_baseline_stage here: for a REBIND the native path is a symlink to the
  # canonical file, so the cmp above passes for the trivial reason (same inode through the
  # link) even when the canonical bytes are a consumer edit — staging would relabel the
  # consumer's edit as the framework baseline and the next refresh would destroy it
  # silently (refresh-baseline-survives-early-exit arm 4, measured 2026-10-06). The
  # delivery that wrote the real file already staged the entry; a native path with no
  # entry stays unbaselined, which is the conservative direction (preserves, never
  # overwrites silently).
  rm -f "$native"
  ln -s "$relative" "$native"
}

_portable_discovery() {
  local canonical="$1" slug="$2" dst="$PROJECT_ROOT/.agents/skills/$2/SKILL.md" temp kind="${3:-procedure}"
  if ! _canonical_link_target "$canonical" >/dev/null; then
    echo "  · $dst kept (canonical target is outside the consumer common tree)"
    return 0
  fi
  temp="$(mktemp "${TMPDIR:-/tmp}/getff-discovery.XXXXXX")"
  local relative description
  relative="$(_portable_relative "$canonical" "$dst")"
  description="$(awk '
    /^---$/ { header++; if (header == 2) exit; next }
    header == 1 && /^description:/ { on=1; sub(/^description:[[:space:]]*/, ""); print; next }
    on && /^[ \t]/ { print; next }
    on { exit }' "$canonical")"
  [ -n "$description" ] || description="Load the $slug procedure."
  {
    printf '%s\n' '---' "name: $slug" "description: $description" '---' ''
    printf '> **Authoritative for:** native discovery and full canonical source loading for %s.\n' "$slug"
    printf '> **NOT authoritative for:** source behavior; the canonical source below owns it.\n\n'
    printf 'Read [the complete canonical procedure](%s) before acting. Load the full file, follow its instructions and resolve its helpers and references relative to that canonical file. Preserve all supplied arguments and the user request.\n' "$relative"
  } > "$temp"
  _portable_copy "$temp" "$dst"
  rm -f "$temp"
  # Codex metadata carries the source's explicit-only invocation policy. It is
  # generated with the binding, never silently dropped during consumer delivery.
  temp="$(mktemp "${TMPDIR:-/tmp}/getff-discovery-policy.XXXXXX")"
  if [ "$kind" = role ] || awk '/^---$/ {h++; next} h == 1 && /^disable-model-invocation:[[:space:]]*true/ {found=1} END {exit !found}' "$canonical"; then
    printf 'policy:\n  allow_implicit_invocation: false\n' > "$temp"
  else
    printf 'policy:\n  allow_implicit_invocation: true\n' > "$temp"
  fi
  _portable_copy "$temp" "${dst%/SKILL.md}/agents/openai.yaml"
  rm -f "$temp"
}

install_portable_bindings() {
  local slug src native file rel canonical group canonical_group bootstrap_temp
  echo "▶ Shared procedures, roles and checks → .agents/; native discovery bindings"
  for slug in getff tool-bootstrapping $GETFF_SKILLS_CORE $GETFF_SKILLS_ENV $GETFF_SKILLS_FACTORY; do
    native="$PROJECT_ROOT/.claude/skills/$slug"
    # Existing profile/presence decisions have already selected the delivery population.
    # During a fresh dry-run the native directories do not yet exist.
    if [ ! -d "$native" ]; then
      [ "$DRY_RUN" = --dry-run ] || continue
      case " $GETFF_SKILLS_ENV " in *" $slug "*)
        [ "${PROFILE:-core}" != core ] || [ -n "${WITH_AIF_SUITE:-}" ] || continue;; esac
      case " $GETFF_SKILLS_FACTORY " in *" $slug "*)
        [ "${PROFILE:-core}" = factory ] || [ -n "${WITH_AIF_SUITE:-}" ] || continue;; esac
    fi
    if _portable_owned_path "$native"; then
      echo "  ⊝ $native (.override.md — consumer-owned, common source kept)"
      continue
    fi
    src="$(procedure_source "$slug")"
    [ -d "$src" ] || continue
    while IFS= read -r -d '' file; do
      rel="${file#"$src"/}"
      canonical="$PROJECT_ROOT/.agents/procedures/$slug/$rel"
      _portable_copy "$file" "$canonical"
      _portable_alias "$canonical" "$native/$rel"
      _portable_alias "$canonical" "$PROJECT_ROOT/.zcode/skills/$slug/$rel"
    done < <(find -L "$src" -type f -print0)
    if [ "$DRY_RUN" = --dry-run ]; then
      echo "  [dry-run] would write .agents/skills/$slug/SKILL.md (portable discovery)"
    else
      _portable_discovery "$PROJECT_ROOT/.agents/procedures/$slug/SKILL.md" "$slug"
    fi
  done
  for group in agents hooks; do
    canonical_group="$group"; [ "$group" != agents ] || canonical_group=roles
    [ -d "$PROJECT_ROOT/.claude/$group" ] || continue
    # Walk only delivered native content. This never adds maintainer-only rules,
    # checks or role prompts to a consumer merely because the package carries them.
    while IFS= read -r -d '' native; do
      rel="${native#"$PROJECT_ROOT/.claude/$group"/}"
      src="$PKG_ROOT/.agents/$canonical_group/$rel"
      if [ ! -f "$src" ]; then
        if [ "$group" = agents ]; then src="$PKG_ROOT/agents/$rel";
        else src="$PKG_ROOT/.claude/hooks/$rel"; fi
      fi
      [ -f "$src" ] || { [ "$group/$rel" != hooks/deps-hash-check.sh ] || src="$PKG_ROOT/packages/core/hooks/deps-hash-check.sh"; }
      [ -f "$src" ] || continue
      canonical="$PROJECT_ROOT/.agents/$canonical_group/$rel"
      # A native override can refer to the common file through our link; copying
      # the source there would bypass the native lane's preservation decision.
      if _portable_owned_path "$native"; then continue; fi
      _portable_copy "$src" "$canonical"
      _portable_alias "$canonical" "$native"
      if [ "$group" = agents ]; then
        _portable_alias "$canonical" "$PROJECT_ROOT/.zcode/agents/$rel"
        if [ "$DRY_RUN" != --dry-run ]; then _portable_discovery "$canonical" "${rel%.md}" role; fi
      fi
    done < <(find -L "$PROJECT_ROOT/.claude/$group" -type f -print0)
  done
  install_codex_consumer_bindings
  # The consumer's own empty starter template, never the contributor goal digest.
  if [ -f "$PKG_ROOT/.claude/templates/session-bootstrap.md" ]; then
    src="$PKG_ROOT/.claude/templates/session-bootstrap.md"
    native="$PROJECT_ROOT/.claude/session-bootstrap.md"
    if [ -f "$native" ] && { [ ! -L "$native" ] || _canonical_link_target "$native" >/dev/null; }; then
      src="$native"
    fi
    # Materialize starter bytes: a repeated install can read our native alias,
    # and copying that link into its own canonical target would destroy the seed.
    bootstrap_temp="$(mktemp "${TMPDIR:-/tmp}/getff-bootstrap.XXXXXX")"
    cp -pL "$src" "$bootstrap_temp"
    copy_safe "$bootstrap_temp" "$PROJECT_ROOT/.agents/session-bootstrap.md"
    rm -f "$bootstrap_temp"
    _portable_alias "$PROJECT_ROOT/.agents/session-bootstrap.md" "$PROJECT_ROOT/.claude/session-bootstrap.md"
  fi
}

# Native runtime files cannot be replaced with preserved-conflict copies: an operator's
# hooks/config must remain active. Refresh only a proven, unchanged framework delivery.
_codex_consumer_copy() {
  local src="$1" dst="$2"
  if [ -f "$dst" ] && ! cmp -s "$src" "$dst"; then
    if refresh_baseline_diverged "$dst" "$src" || [ -z "${REFRESH_BASELINE_ENTRY:-}" ]; then
      echo "  ⊝ $dst (consumer-owned native binding, keeping)"
      return 0
    fi
  fi
  _portable_copy "$src" "$dst"
}

# Definitions are delivered without changing global config, project trust or model policy.
install_codex_consumer_bindings() {
  local temp
  if [ "$DRY_RUN" = --dry-run ]; then
    echo '  [dry-run] would deliver .codex/hooks.json and its shared adapter (operator trust required)'
    return 0
  fi
  if ! command -v node >/dev/null 2>&1; then
    echo '  · Codex hooks not wired: node is not on PATH'
    return 0
  fi
  temp="$(mktemp "${TMPDIR:-/tmp}/getff-codex-hooks.XXXXXX")"
  if ! node "$PKG_ROOT/setup.d/codex-bindings.mjs" "$PROJECT_ROOT" > "$temp"; then
    rm -f "$temp"
    echo '  · Codex hooks not wired: native definition generation failed; other delivery continues' >&2
    return 0
  fi
  _codex_consumer_copy "$PKG_ROOT/scripts/codex-hook-adapter.mjs" "$PROJECT_ROOT/scripts/codex-hook-adapter.mjs"
  _codex_consumer_copy "$PKG_ROOT/scripts/lib/is-main-entry.mjs" "$PROJECT_ROOT/scripts/lib/is-main-entry.mjs"
  _codex_consumer_copy "$PKG_ROOT/plugin/hooks/lib/hook-language.sh" "$PROJECT_ROOT/.agents/hooks/lib/hook-language.sh"
  _codex_consumer_copy "$temp" "$PROJECT_ROOT/.codex/hooks.json"
  if ! node -e 'const fs = require("node:fs"); const { hooks } = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.exit(Object.keys(hooks).length ? 0 : 1);' "$temp"; then
    echo '  · Codex hooks not wired: no supported registered consumer checks in this profile'
  elif cmp -s "$temp" "$PROJECT_ROOT/.codex/hooks.json" \
    && cmp -s "$PKG_ROOT/scripts/codex-hook-adapter.mjs" "$PROJECT_ROOT/scripts/codex-hook-adapter.mjs" \
    && cmp -s "$PKG_ROOT/scripts/lib/is-main-entry.mjs" "$PROJECT_ROOT/scripts/lib/is-main-entry.mjs" \
    && cmp -s "$PKG_ROOT/plugin/hooks/lib/hook-language.sh" "$PROJECT_ROOT/.agents/hooks/lib/hook-language.sh"; then
    echo '  · Codex hook definitions delivered; review and trust the project hooks in Codex before relying on enforcement'
  else
    echo '  · Codex hooks not wired: consumer-owned definitions or dependencies were kept; reconcile them before activation'
  fi
  rm -f "$temp"
}
