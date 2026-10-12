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

# Exact destinations attempted by portable delivery, not a directory-wide ignore.
# Repeated passes are harmless: the consumer below sorts and checks ownership.
GETFF_PORTABLE_PATHS=()
getff_portable_owned_paths() {
  local dst
  for dst in ${GETFF_PORTABLE_PATHS[@]+"${GETFF_PORTABLE_PATHS[@]}"}; do
    [ -f "$dst" ] || continue
    _portable_owned_path "$dst" && continue
    _prettierignore_in_skipped "$dst" && continue
    getff_delivered "$dst" && getff_bytes_intact "$dst" || continue
    printf '%s\n' "${dst#"$PROJECT_ROOT"/}"
  done | LC_ALL=C sort -u
}

_portable_copy() {
  local src="$1" dst="$2" temp="" display_src="$1"
  if _portable_owned_path "$dst"; then
    echo "  ⊝ $dst (.override.md — consumer-owned, keeping)"
    return 0
  fi
  # Dry-run must preview the REAL source path: the .md transform below runs the
  # source through a random mktemp scratch file, and copy_safe's dry-run echo
  # would print that random path — two runs would never diff equal (L1
  # acceptance (a), framework-self-detect CI).
  if [ "$DRY_RUN" = "--dry-run" ]; then
    copy_safe "$src" "$dst"
    return 0
  fi
  if [ "${src##*.}" = md ]; then
    temp="$(mktemp "${TMPDIR:-/tmp}/getff-portable.XXXXXX")"
    cp -pL "$src" "$temp"
    transform_internal_refs "$temp"
    src="$temp"
  fi
  # display_src names the REAL source in dry-run previews (copy_safe 4th arg) — a random
  # mktemp path in the print would make two consecutive --dry-run outputs differ
  # (Detector v1 L1 idempotency). The guards still compare the transformed temp bytes.
  if [ -n "${REFRESH:-}" ] || [ "${GETFF_TOOLCHAIN_REFRESH:-}" = 1 ]; then
    refresh_safe "$src" "$dst" "" "$display_src"
  else
    copy_safe "$src" "$dst" "" "$display_src"
  fi
  GETFF_PORTABLE_PATHS+=("$dst")
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
  local canonical="$1" native="$2"
  if [ "$DRY_RUN" = --dry-run ]; then
    echo "  [dry-run] would bind: $native → $canonical (matching entries only)"
    return 0
  fi
  [ -f "$canonical" ] || return 0
  if ! _canonical_link_target "$canonical" >/dev/null; then
    echo "  · $native kept (canonical target is outside the consumer common tree)"
    return 0
  fi
  # Native materialized twins are part of the same exact delivery population.
  # A consumer-owned common source must not confer framework ownership on them.
  if getff_delivered "$canonical" && getff_bytes_intact "$canonical"; then
    GETFF_PORTABLE_PATHS+=("$native")
  fi
  if _portable_owned_path "$native"; then return 0; fi
  if [ -L "$native" ] && ! _canonical_link_target "$native" >/dev/null; then
    echo "  · $native kept (consumer-owned external or custom compatibility link)"
    return 0
  fi
  if [ -n "${REFRESH:-}" ] || [ "${GETFF_TOOLCHAIN_REFRESH:-}" = 1 ]; then
    # Refresh propagation: the canonical twin just moved to the upstream bytes, so the
    # install-mode byte-equality shortcut cannot decide — the native's OWN baseline
    # does (delivered bytes → refresh; consumer edit → preserved copy), exactly like
    # any other delivered file. Equal bytes = the canonical did not move for this file
    # → the writer's baseline stands, skip silently.
    if [ -e "$native" ] && [ ! -L "$native" ] && cmp -s "$canonical" "$native"; then
      return 0
    fi
    [ -L "$native" ] && rm -f "$native"   # a previous getff version's managed alias link
    refresh_safe "$canonical" "$native"
    return 0
  fi
  if [ -e "$native" ] && [ ! -L "$native" ]; then
    if ! cmp -s "$canonical" "$native"; then
      echo "  · $native kept (custom native entry; canonical source available at $canonical)"
      return 0
    fi
    # A real native file already byte-equal to the canonical twin: the delivery that
    # wrote it earlier this run staged its baseline. Return WITHOUT copy_safe — its
    # exists-guard would record the path in SKIPPED, and ignore_shipped_configs would
    # then treat a framework-fresh delivery as consumer-owned and leave it format-
    # checked (the brownfield #531 class: a stricter consumer .prettierrc flags the
    # framework-formatted bytes).
    return 0
  fi
  # Deliver it as a MATERIALIZED real file, never a symlink: the consumer contract is
  # real bytes (Windows cannot create symlinks without privilege — the PR #2025 sweep;
  # the consumer-matrix prettier arm refuses explicit symlink paths), and only a copy
  # refreshes through the baseline-guarded path a delivery gets. This twin gets its OWN
  # baseline entry, so a consumer edit at the native path later diverges against ITS
  # OWN baseline and is preserved, never silently overwritten.
  [ -L "$native" ] && rm -f "$native"   # a previous getff version's managed alias link
  mkdir -p "$(dirname "$native")"
  copy_safe "$canonical" "$native"
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
    if [ "$kind" != role ]; then
      printf '\nResolve the installed project root before mandatory shell steps. It is the nearest ancestor containing `.agents/procedures`, which may be below the Git root. Run this binding through the host shell tool:\n\n'
      printf '%s\n' '```bash' 'GETFF_PROJECT_ROOT="$PWD"' 'while [ ! -d "$GETFF_PROJECT_ROOT/.agents/procedures" ] && [ "$GETFF_PROJECT_ROOT" != / ]; do' '  GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT%/*}"; GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT:-/}"' 'done' '[ -d "$GETFF_PROJECT_ROOT/.agents/procedures" ] || { printf "%s\n" "getff: installed procedure root missing" >&2; exit 2; }'
      printf 'GETFF_SKILL_DIR="$GETFF_PROJECT_ROOT/.agents/procedures/%s"\n' "$slug"
      printf '%s\n' 'cd "$GETFF_PROJECT_ROOT"' '```'
      printf '\nOn Codex, explicit `$%s` or the direct operator request binds legacy `/%s`; bind arguments from that invocation (absent means empty). Execute mandatory shell blocks, including eager `!` steps, through the shell tool. Replace `${CLAUDE_SKILL_DIR}` with `"$GETFF_SKILL_DIR"`. Read/Bash/Write/Edit mean the host file, shell and edit tools; AskUserQuestion means the available user-input tool. Companion Skill calls require the installed companion procedure; if absent, report the prerequisite. Model/tool frontmatter grants no authority on this host; explicit-only policy and host authorization still govern delegation.\n' "$slug" "$slug"
    else
      printf '\nFor a cold role, load this canonical prompt and pass only its required inputs without inherited history. Native discovery grants no delegation authority; use the host dispatch contract only when authorized. Model/tool frontmatter does not change host permissions.\n'
    fi
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

_portable_docs_card() {
  local src="$PKG_ROOT/.agents/procedures/docs-author/references/criteria-card.md"
  local dst="$PROJECT_ROOT/.agents/roles/resources/docs-form-auditor/criteria-card.md" temp card_hash terms_hash
  if [ "$DRY_RUN" = --dry-run ]; then
    _portable_copy "$src" "$dst"
    return 0
  fi
  card_hash="$(_hash256 "$src")" || card_hash=unknown
  terms_hash="$(_hash256 "$PKG_ROOT/docs/site/terms.md")" || terms_hash=unknown
  temp="$(mktemp "${TMPDIR:-/tmp}/getff-docs-card.XXXXXX")"
  {
    printf '%s\n' '<!-- getff: installed resource binding; canonical criteria follow unchanged -->' ''
    printf '## Installed vocabulary and gate binding\n\n'
    printf 'Canonical card source: `.agents/procedures/docs-author/references/criteria-card.md`; SHA-256: `%s`.\n\n' "$card_hash"
    printf 'The supplied `framework-terms.md` is a **framework-reference**, projected from the framework source `docs/site/terms.md` (SHA-256: `%s`). It is not project truth and does not establish current project vocabulary or a passing C10 gate.\n\n' "$terms_hash"
    printf '%s\n' 'For C10, bind the owner-supplied live project glossary, its scope and source identity. Use the framework reference only when that vocabulary scope is explicitly applicable. If the appropriate live glossary or its naming gate is unavailable, report C10 as unassessed and STOP that acceptance cell. Do not copy this reference into the project glossary or regenerate consumer styles during an audit.' ''
    printf '%s\n' 'When the project owner configures a project naming style outside the audit, protect it through the existing ownership channel: `docs/site-quality/vale/styles/getff/Names.yml.override.md`. Refresh preserves marked consumer files; an unmarked modified framework file may be replaced with a conflict backup. Do not claim that backup alone preserves the active naming gate.' ''
    printf '%s\n' 'The delivered `scripts/render-terms-style.mjs --check` compares the project `docs/site/terms.md` with its installed naming style. Its success establishes that comparison only. C11 separately requires the applicable D28/D31 twin, llms.txt and manifest gate receipts; neither this card nor docs-check supplies those receipts. Keep absent or inapplicable gate evidence explicit.' '' '---' ''
    cat "$src"
  } > "$temp"
  transform_internal_refs "$temp"
  _portable_copy "$temp" "$dst"
  rm -f "$temp"
}

_portable_workflow_resources() {
  local pair src dst file rel role
  # Deliver only the resource closure of an already selected workflow population.
  # Supporting data never registers a contributor-only procedure as a consumer skill.
  for role in "$PROJECT_ROOT/.agents/roles/"*.md; do
    [ -f "$role" ] || continue
    role="${role##*/}"; role="${role%.md}"
    src="$PKG_ROOT/.agents/roles/resources/$role"
    [ -d "$src" ] || continue
    while IFS= read -r -d '' file; do
      rel="${file#"$src"/}"
      _portable_copy "$file" "$PROJECT_ROOT/.agents/roles/resources/$role/$rel"
    done < <(find -L "$src" -type f -print0)
  done
  if [ -f "$PROJECT_ROOT/.agents/roles/docs-form-auditor.md" ]; then
    for pair in \
      'packages/core/docs/markdownlint-cli2.bundle.mjs:.agents/tools/docs/markdownlint-cli2.bundle.mjs' \
      'scripts/docs-check.mjs:scripts/docs-check.mjs' \
      'scripts/render-terms-style.mjs:scripts/render-terms-style.mjs' \
      'scripts/lib/mermaid-allowlist.mjs:scripts/lib/mermaid-allowlist.mjs' \
      'scripts/lib/is-main-entry.mjs:scripts/lib/is-main-entry.mjs' \
      'docs/site/terms.md:.agents/roles/resources/docs-form-auditor/framework-terms.md' \
      '.agents/procedures/docs-author/references/page-kinds.md:.agents/roles/resources/docs-form-auditor/page-kinds.md' \
      'docs/site-quality/calibration.md:docs/site-quality/calibration.md'; do
      _portable_copy "$PKG_ROOT/${pair%%:*}" "$PROJECT_ROOT/${pair#*:}"
    done
    _portable_docs_card
    src="$PKG_ROOT/docs/site-quality/vale"
    while IFS= read -r -d '' file; do
      rel="${file#"$src"/}"
      _portable_copy "$file" "$PROJECT_ROOT/docs/site-quality/vale/$rel"
    done < <(find -L "$src" -type f -print0)
  fi
  if [ -f "$PROJECT_ROOT/.agents/roles/rule-researcher.md" ]; then
    for pair in \
      'install/rule-bootstrap-cli.bundle.mjs' \
      'research/research-plan.schema.json' 'research/research-allowlist.schema.json' \
      'research/multi-tenant-hosts.json' 'ir/convention-node.schema.json' \
      'synthesizer/synthesis-plan.schema.json' 'validator/gate-single-token-diff.ts'; do
      _portable_copy "$PKG_ROOT/packages/core/$pair" "$PROJECT_ROOT/.agents/tools/$pair"
    done
  fi
  if [ -f "$PROJECT_ROOT/.agents/procedures/arch/SKILL.md" ]; then
    _portable_copy "$PKG_ROOT/scripts/snapshot-for-seat.sh" "$PROJECT_ROOT/scripts/snapshot-for-seat.sh"
    _portable_copy "$PKG_ROOT/scripts/check-arch-retell.mjs" "$PROJECT_ROOT/scripts/check-arch-retell.mjs"
  fi
  if [ -f "$PROJECT_ROOT/.agents/procedures/aif-doctor/SKILL.md" ]; then
    src="$PKG_ROOT/packages/runtime-bridge/vendor"
    while IFS= read -r -d '' file; do
      rel="${file#"$src"/}"
      _portable_copy "$file" "$PROJECT_ROOT/.agents/tools/runtime-bridge/$rel"
    done < <(find -L "$src" -type f -print0)
    _portable_copy "$PKG_ROOT/packages/runtime-bridge/scripts/bridge-health.sh" \
      "$PROJECT_ROOT/.agents/tools/runtime-bridge/scripts/bridge-health.sh"
  fi
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
  _portable_workflow_resources
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
    copy_safe "$bootstrap_temp" "$PROJECT_ROOT/.agents/session-bootstrap.md" "" "$src"
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
