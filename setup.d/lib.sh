#!/usr/bin/env bash
# setup.d/lib.sh — Helper SSOT for the install.sh dispatcher.
#
# Extracted byte-faithfully from install.sh (S0 lib rows L38-512).
# Sourced by install.sh BEFORE the INSTALL_SH_LIB_ONLY guard so that
# `INSTALL_SH_LIB_ONLY=1 source install.sh` exposes ALL helpers.
#
# O1 fix: the INSTALL_SH_LIB_ONLY guard is at the END of this file (after all
# helpers are defined), so `INSTALL_SH_LIB_ONLY=1 source setup.d/lib.sh`
# also exposes all helpers (used by tests/install-sh/lib-helpers.test.sh).
#
# Public API (all helpers are in dispatcher scope after sourcing):
#   transform_internal_refs <file>
#   copy_safe <src> <dst>
#   refresh_safe <src> <dst>
#   merge_prettierignore <src> <dst>
#   _prettierignore_in_skipped <needle>
#   ignore_shipped_configs
#   mkdir_safe <dir>
#   chmod_safe <mode> <file...>
#   detect_pm
#   _detect_stack_from_pkg
#   _workspace_pkg_dirs
#   _detect_stacks_per_workspace
#   patch_stryker_package_manager
#   copy_skill_with_transform <slug>
#   refresh_skill_with_transform <slug>
#   generate_eslint_barrel
#
# Globals required from dispatcher scope (set before sourcing layers):
#   PKG_ROOT, PROJECT_ROOT, FORCE, DRY_RUN, SKIPPED, UPSTREAM_BLOB_URL
#
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone
# S0 rows: L38-512, O1, O2
# @dual-pair: install-lib-helpers

# ── Constants (used by helpers below) ────────────────────────────────────────

# Repo-internal cross-refs (paths to docs/, packages/, README.md) get rewritten to
# GitHub blob URLs at install time. One source of truth: .claude/skills/<skill>/SKILL.md
# Override via env var if forking to a different repo.
UPSTREAM_BLOB_URL="${UPSTREAM_BLOB_URL:-https://github.com/Yhooi2/rules-as-tests-aif/blob/main}"

PRETTIERIGNORE_BEGIN='# >>> rules-as-tests-aif (managed) >>>'
PRETTIERIGNORE_END='# <<< rules-as-tests-aif (managed) <<<'
PRETTIERIGNORE_CFG_BEGIN='# >>> rules-as-tests-aif shipped-configs (managed) >>>'
PRETTIERIGNORE_CFG_END='# <<< rules-as-tests-aif shipped-configs (managed) <<<'

# ── Helpers ───────────────────────────────────────────────────────────────────

# transform_internal_refs <markdown-file>
# Rewrites markdown links `](../../../{docs,packages}/...)` and `](../../../README.md...)`
# in-place to `](${UPSTREAM_BLOB_URL}/...)`. Leaves consumer-resolvable refs intact
# (e.g. `](../../rules/...)` resolves to consumer's .claude/rules/ post-install).
# Uses `-i.bak` for BSD-sed/GNU-sed portability, then removes the backup.
transform_internal_refs() {
  local f="$1"
  [ -f "$f" ] || return 0
  sed -E -i.bak \
    -e "s#\]\((\.\./)+docs/#](${UPSTREAM_BLOB_URL}/docs/#g" \
    -e "s#\]\((\.\./)+packages/#](${UPSTREAM_BLOB_URL}/packages/#g" \
    -e "s#\]\((\.\./)+README\.md#](${UPSTREAM_BLOB_URL}/README.md#g" \
    "$f"
  rm -f "${f}.bak"
}

copy_safe() {
  local src="$1"
  local dst="$2"

  if [ -e "$dst" ] && [ "$FORCE" != "--force" ]; then
    SKIPPED+=("$dst")
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would skip: $dst (exists)"
    else
      echo "  ⊝ $dst (exists — skipping; use --force to overwrite)"
    fi
    return 0
  fi

  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would copy: $src → $dst"
    return 0
  fi

  mkdir -p "$(dirname "$dst")"
  cp -r "$src" "$dst"
  echo "  ✓ $dst"
}

# refresh_safe <src> <dst>
# Inverted copy_safe: OVERWRITES unless the consumer has signalled Layer-3 ownership
# via a sibling <base>.override.md (INSTALL-FOR-AI.md §Three-layer + §override).
# Naming: for foo.md the override is foo.override.md; for foo.sh it is foo.sh.override.md
# (the %.md strip is a no-op on non-.md files, so the pattern is uniform — ${dst%.md}.override.md).
# T-Upgrade-A: default-to-SKIP on any ownership signal — a wrong overwrite is irreversible.
# #873: directory payloads are REPLACED, not nested — mirrors the existing
# refresh_skill_with_transform precedent (rm -rf "$dst"; cp -r). File refresh is unchanged (a
# file source cp -r's over an existing file correctly).
refresh_safe() {
  local src="$1"
  local dst="$2"
  local override="${dst%.md}.override.md"
  [ -e "$src" ] || return 0  # source gone — leave consumer copy alone
  if [ -e "$override" ]; then
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would skip: $dst (.override.md present — consumer-owned Layer 3)"
    else
      echo "  ⊝ $dst (.override.md — consumer-owned, keeping)"
    fi
    return 0
  fi
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would refresh: $src → $dst"
    return 0
  fi
  mkdir -p "$(dirname "$dst")"
  [ -d "$src" ] && rm -rf "$dst"   # #873: replace directory payloads (cp -r nests into an existing dir)
  cp -r "$src" "$dst"
  echo "  ✓ $dst (refreshed)"
}

# GH #531 (reopen): non-destructive .prettierignore merge. copy_safe skips-if-exists, so a
# BROWNFIELD consumer with a pre-existing .prettierignore never received the AIF exclusions →
# generated .ai-factory/RULES.md (+ RULES.react-next.md, .claude/settings.json, the eslint-rules-
# local barrel) stayed un-ignored → `prettier --check .` re-broke on the non-format-stable table.
# Behaviour:
#   - no consumer file        → copy the shipped file byte-identical (greenfield path unchanged).
#   - consumer file exists     → append a marker-delimited block of AIF entries the consumer does
#                                NOT already have (dedup), wrapped in begin/end markers.
#   - block already present     → no-op (idempotent on re-install; begin-marker count stays 1).
#   - --force                   → overwrite wholesale (same as copy_safe under --force).
# Plain bash — NO yq, NO new dependency, NOT the yq-based _aif_yq_wire workflow-merge routine.
merge_prettierignore() {
  local src="$1"
  local dst="$2"

  # --force: behave like copy_safe (overwrite wholesale).
  if [ "$FORCE" = "--force" ]; then
    copy_safe "$src" "$dst"
    return 0
  fi

  # No consumer file → greenfield: copy byte-identical (defer entirely to copy_safe).
  if [ ! -e "$dst" ]; then
    copy_safe "$src" "$dst"
    return 0
  fi

  # Consumer file EXISTS → non-destructive merge.
  # Idempotent: if the managed block is already present, do nothing.
  if grep -qxF "$PRETTIERIGNORE_BEGIN" "$dst"; then
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would skip merge: $dst (AIF block already present)"
    else
      echo "  ⊝ $dst (AIF .prettierignore block already present — skipping merge)"
    fi
    return 0
  fi

  # Collect shipped entries not already present verbatim in the consumer file. Ignore blank lines
  # and comments from the shipped source (only real ignore patterns get merged).
  local missing=()
  local line
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      '' | '#'*) continue ;;
    esac
    grep -qxF "$line" "$dst" || missing+=("$line")
  done < "$src"

  # Nothing to add (consumer already has every AIF pattern) → no-op.
  if [ "${#missing[@]}" -eq 0 ]; then
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would skip merge: $dst (already has every AIF pattern)"
    else
      echo "  ⊝ $dst (already has every AIF .prettierignore pattern — nothing to merge)"
    fi
    return 0
  fi

  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would merge ${#missing[@]} AIF pattern(s) into: $dst"
    return 0
  fi

  # Append the marker-delimited block. Ensure a trailing newline before the block.
  [ -n "$(tail -c1 "$dst")" ] && printf '\n' >> "$dst"
  {
    printf '%s\n' "$PRETTIERIGNORE_BEGIN"
    printf '%s\n' "${missing[@]}"
    printf '%s\n' "$PRETTIERIGNORE_END"
  } >> "$dst"
  echo "  ✓ $dst (merged ${#missing[@]} AIF .prettierignore pattern(s))"
}

# GH #531 (reopen, config-mismatch): conditionally ignore the framework CONFIG files install
# actually SHIPPED. Unlike the SOURCE patterns in the static .prettierignore template (framework-
# namespace files a consumer never owns: eslint-rules-local/, packages/core/hooks/, scripts/audit-
# r4.ts), these configs ship at a consumer-ownable path and MIGHT be consumer-authored — copy_safe
# keeps the consumer's version when one already exists (and records it in SKIPPED). So we ignore a
# config ONLY when it is NOT in SKIPPED (we shipped it fresh, formatted to OUR Prettier config —
# printWidth 80 / singleQuote / no plugins — which a consumer's own .prettierrc would reject). A
# consumer-authored config (copy_safe-skipped) stays format-checked: never silently hidden.

_prettierignore_in_skipped() {
  local needle="$1" s
  # Guard the empty-array expansion: under `set -u` on bash 3.2 (macOS), "${SKIPPED[@]}" with an
  # empty SKIPPED throws "unbound variable" and aborts install. ${#SKIPPED[@]} (length) is safe.
  [ "${#SKIPPED[@]}" -gt 0 ] || return 1
  for s in "${SKIPPED[@]}"; do [ "$s" = "$needle" ] && return 0; done
  return 1
}

ignore_shipped_configs() {
  local ign="$PROJECT_ROOT/.prettierignore"
  [ -e "$ign" ] || return 0   # no consumer .prettierignore at all → nothing to extend
  # Framework configs that ship at a consumer-ownable path. Each is ignored ONLY if shipped fresh.
  local candidates=(
    "eslint.config.mjs" "eslint.config.rn-common.mjs" "vitest.config.ts" "tsconfig.json" "playwright.config.ts"
    ".dependency-cruiser.cjs" "stryker.config.json" ".lintstagedrc.json"
    ".github/workflows/ci.yml" ".github/workflows/workflow-integrity.yml"
  )
  # GH #807: a #793/#796 multi-stack monorepo ships per-workspace configs (apps/*/eslint.config.mjs,
  # deeper */*/eslint.config.mjs, and the RN */eslint.config.rn-common.mjs) — root basenames above do
  # NOT cover them, so prettier --check . reflowed them and format:check went RED. Discover the
  # per-workspace configs the multi-stack branch (40-configs.sh) wrote and fold them into candidates
  # at their RELATIVE paths. The same fresh-vs-SKIPPED guard below applies — a consumer-authored
  # per-workspace config (copy_safe-SKIPPED) stays format-checked; only shipped-fresh ones are ignored.
  # (Single `while`, no nested pipe + no single-line `case */*` — bash 3.2 on macOS mis-parses that
  # combination; the slash test below is the bash-3.2-safe equivalent.)
  while IFS= read -r _abs; do
    [ -n "$_abs" ] || continue
    _wsrel="${_abs#"$PROJECT_ROOT"/}"
    # workspace-nested only: if stripping a leading `*/` leaves the path unchanged it has no slash
    # → it is a root-level basename, already covered by the static candidates list above → skip.
    [ "$_wsrel" = "${_wsrel#*/}" ] && continue
    candidates+=("$_wsrel")
  done < <(
    find "$PROJECT_ROOT" -name node_modules -prune -o -name .git -prune -o \
         \( -name 'eslint.config.mjs' -o -name 'eslint.config.rn-common.mjs' \) -print 2>/dev/null
  )
  local fresh=() rel
  for rel in "${candidates[@]}"; do
    [ -e "$PROJECT_ROOT/$rel" ] || continue                       # not shipped for this stack/preset
    _prettierignore_in_skipped "$PROJECT_ROOT/$rel" && continue   # consumer owned it → keep checking
    grep -qxF "$rel" "$ign" && continue                           # already ignored (idempotent re-install)
    fresh+=("$rel")
  done
  [ "${#fresh[@]}" -eq 0 ] && return 0
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would ignore ${#fresh[@]} freshly-shipped framework config(s) in $ign"
    return 0
  fi
  [ -n "$(tail -c1 "$ign")" ] && printf '\n' >> "$ign"
  {
    printf '%s\n' "$PRETTIERIGNORE_CFG_BEGIN"
    printf '%s\n' "${fresh[@]}"
    printf '%s\n' "$PRETTIERIGNORE_CFG_END"
  } >> "$ign"
  echo "  ✓ $ign (ignored ${#fresh[@]} freshly-shipped framework config(s); consumer-authored configs kept format-checked)"
}

# Idempotent mkdir -p that respects --dry-run.
mkdir_safe() {
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would mkdir: $1"
    return 0
  fi
  mkdir -p "$1"
}

# chmod that respects --dry-run.
chmod_safe() {
  if [ "$DRY_RUN" = "--dry-run" ]; then
    return 0
  fi
  chmod "$@"
}

# Detect the consumer's package manager from corepack / workspace / lockfile signals present
# AT INSTALL TIME. The explicit package.json "packageManager" field (corepack source of truth)
# wins; else workspace/lock markers (pnpm-workspace.yaml exists pre-install in a monorepo even
# before the lockfile lands — R-S4-3 note below); else npm. Echoes one of: npm | pnpm | yarn.
# node-optional: the field check is skipped when node is absent (markers still resolve). SSOT —
# shared by patch_stryker_package_manager() and the §8 dev-dep install so the two never drift.
detect_pm() {
  local _pm _field
  if [ -f "$PROJECT_ROOT/pnpm-lock.yaml" ] || [ -f "$PROJECT_ROOT/pnpm-workspace.yaml" ]; then
    _pm="pnpm"
  elif [ -f "$PROJECT_ROOT/yarn.lock" ] || [ -f "$PROJECT_ROOT/.yarnrc.yml" ]; then
    _pm="yarn"
  else
    _pm="npm"
  fi
  if command -v node >/dev/null 2>&1 && [ -f "$PROJECT_ROOT/package.json" ]; then
    _field=$(AIF_PJ="$PROJECT_ROOT/package.json" node -e 'try{const m=(JSON.parse(require("fs").readFileSync(process.env.AIF_PJ,"utf8")).packageManager||"").split("@")[0];if(["npm","pnpm","yarn"].includes(m))process.stdout.write(m)}catch{}' 2>/dev/null || true)
    [ -n "$_field" ] && _pm="$_field"
  fi
  printf '%s' "$_pm"
}

# _detect_stack_from_pkg — classify the consumer's stack from package.json dependency signals.
# Pure bash + grep, NODE-FREE: install.sh runs BEFORE the consumer installs deps, so this must not
# depend on `node` being present (node-optional install-time repo-read model — same posture as
# detect_pm above, packages/core/audit-self/detect-r2-boundary.sh, and the expo-detect in
# setup.d/40-configs.sh, all of which read package.json with grep, not node).
# SSOT — this is the single stack detector; both the install.sh stack-pick (fresh `--yes`/`--full`
# auto-detect, GH #780) and 15-companions-stack.sh consume it, so the signal logic never drifts.
# Signal order is most-specific-first: react-native → next → react → typescript → unknown.
# The grep anchor '"<dep>"[[:space:]]*:' matches a package.json dependency KEY exactly (the closing
# quote excludes prefixes — '"react"' does NOT match '"react-native":' / '"react-dom":', and a
# string VALUE like "next build" is not matched — there is no '"next":' key there).
# Trade-off vs a node deps-only parse: grep scans the WHOLE file, so a signal key in
# peer/optional/overrides (or, rarely, a same-named "scripts" key) also counts. For a realistic
# consumer package.json this is equal-or-more-inclusive and never the #780 "silent wrong install"
# failure (an app peer-depending on next is next-related); the install path fail-louds only on
# `unknown`, never on a mis-detect.
# Reads <target>/package.json (target defaults to $PROJECT_ROOT). Echoes exactly one of:
#   react-native | react-next | react-spa | ts-server | unknown
# I-2 (§13.5): the optional <target> arg lets the per-workspace walk (_detect_stacks_per_workspace)
# classify each workspace dir; the no-arg form is unchanged (back-compat — the I-1 install stack-pick
# and 15-companions-stack.sh both call it no-arg → $PROJECT_ROOT).
_detect_stack_from_pkg() {
  local target="${1:-$PROJECT_ROOT}"
  local pkg="$target/package.json"
  [ -f "$pkg" ] || { echo "unknown"; return; }
  if   grep -qE '"react-native"[[:space:]]*:' "$pkg"; then echo "react-native"
  elif grep -qE '"next"[[:space:]]*:'         "$pkg"; then echo "react-next"
  elif grep -qE '"react"[[:space:]]*:'        "$pkg"; then echo "react-spa"
  elif grep -qE '"typescript"[[:space:]]*:'   "$pkg"; then echo "ts-server"
  else echo "unknown"; fi
}

# _workspace_pkg_dirs [root] — enumerate workspace package directories (those that contain a
# package.json) for the multi-stack monorepo case (§13.5, I-2 Layer 1). NODE-FREE, no yq/pnpm/turbo
# dependency: install runs BEFORE the consumer's `pnpm install`, so this must not depend on a package
# manager being present (same node-optional posture as _detect_stack_from_pkg / detect_pm above).
# Convention: expand the immediate children of the 5 conventional workspace container roots —
# apps packages services libs modules — the SAME set as the arch:check target resolver in
# setup.d/70-deps.sh:37, so the two never drift. Keeps only children that carry a package.json (a
# workspace package is a dir WITH a package.json; a sibling dir without one is not enumerated).
# Exotic/custom workspace roots outside the convention are not enumerated — they fall back to
# single-root detection, the same coverage boundary 70-deps.sh accepts. Reads $root (default
# $PROJECT_ROOT). Echoes each workspace dir RELATIVE to $root, one per line (so Layer 2 can scope
# `applies-to <dir>/**`); echoes nothing for a flat / single-root repo (no conventional workspace).
_workspace_pkg_dirs() {
  local root="${1:-$PROJECT_ROOT}" container path name
  for container in apps packages services libs modules; do
    [ -d "$root/$container" ] || continue
    for path in "$root/$container"/*/; do
      [ -d "$path" ] || continue                 # no glob match → literal '*/', skip
      [ -f "${path}package.json" ] || continue   # workspace package := dir WITH a package.json
      name=$(basename "$path")
      printf '%s/%s\n' "$container" "$name"
    done
  done
  return 0
}

# _detect_stacks_per_workspace [root] — the §13.5 Layer-1 deliverable: walk each workspace package
# dir (_workspace_pkg_dirs) × per-dir _detect_stack_from_pkg → echo `dir<TAB>stack` per workspace,
# one line each (mirrors the single-root DETECTED_STACK echo in 15-companions-stack.sh). A
# per-workspace `unknown` (a workspace whose package.json matches no stack signal) is KEPT in the map
# as a re-checkable marker — never dropped, never `exit 1` (the §13.5 fork-2 default; persisting that
# marker on disk is Layer 2, out of scope here). Echoes nothing for a flat / single-root repo (no
# workspace dirs) — the caller falls back to the single-root _detect_stack_from_pkg (the I-1 path).
_detect_stacks_per_workspace() {
  local root="${1:-$PROJECT_ROOT}" reldir stack
  while IFS= read -r reldir; do
    [ -n "$reldir" ] || continue
    stack=$(_detect_stack_from_pkg "$root/$reldir")
    printf '%s\t%s\n' "$reldir" "$stack"
  done < <(_workspace_pkg_dirs "$root")
  return 0
}

# The shipped stryker.config.json hardcodes "packageManager": "npm" (the template can't
# self-detect). Patch the COPIED config in place to match the consumer's lockfile so a
# pnpm/yarn consumer doesn't get an npm-locked mutation run. Non-destructive: rewrites only
# the packageManager key. Guarded on --dry-run and on node availability (no node → leave npm).
patch_stryker_package_manager() {
  _cfg="$PROJECT_ROOT/stryker.config.json"
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would set stryker packageManager from consumer lockfile"
    return 0
  fi
  command -v node >/dev/null 2>&1 || return 0
  [ -f "$_cfg" ] || return 0
  # R-S4-3: install.sh runs BEFORE the consumer's `npm/pnpm install` in the canonical flow,
  # so a lockfile may not exist yet (a pnpm monorepo would silently stay "npm"). Detect from
  # signals present AT INSTALL TIME: the explicit package.json "packageManager" field (corepack
  # source of truth) wins; else workspace/lock markers (pnpm-workspace.yaml exists pre-install
  # in a monorepo); else npm. A flat pnpm consumer with neither marker nor field still defaults
  # npm — re-run install after the lockfile lands, or set package.json "packageManager".
  _pm=$(detect_pm)   # SSOT detector (lockfile/workspace/corepack signals; see detect_pm above)
  # GH #531: rewrite ONLY the packageManager VALUE in place (string-substitution), NOT a full
  # JSON.stringify re-serialize. The template ships prettier-clean (short arrays collapsed to one
  # line); JSON.stringify(,,2) would re-expand those arrays and break `prettier --check` on the
  # consumer. A targeted value swap preserves the template's prettier formatting byte-for-byte.
  AIF_STRYKER_CFG="$_cfg" AIF_STRYKER_PM="$_pm" node -e '
    const fs = require("fs");
    const p = process.env.AIF_STRYKER_CFG;
    const pm = process.env.AIF_STRYKER_PM;
    const src = fs.readFileSync(p, "utf8");
    const out = src.replace(/("packageManager"\s*:\s*")[^"]*(")/, `$1${pm}$2`);
    if (out !== src) fs.writeFileSync(p, out);
  '
  echo "  ✓ stryker packageManager → $_pm"
}

# copy_skill_with_transform <skill-slug>
# Copies .claude/skills/<slug>/ to the consumer and rewrites repo-internal markdown
# cross-refs to GitHub blob URLs (transform_internal_refs). Used for pipeline + its
# orchestration companion skills (dispatcher / aif-doctor / template-audit) — every one
# carries ](../../../{docs,packages,README}) refs that would dangle on a consumer tree.
# Honors --force (skip-if-exists default) and --dry-run, matching copy_safe semantics.
copy_skill_with_transform() {
  local slug="$1"
  local src="$PKG_ROOT/.claude/skills/$slug"
  local dst="$PROJECT_ROOT/.claude/skills/$slug"
  if [ -e "$dst" ] && [ "$FORCE" != "--force" ]; then
    SKIPPED+=("$dst")
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would skip: .claude/skills/$slug (exists)"
    else
      echo "  ⊝ .claude/skills/$slug (exists — skipping)"
    fi
    return 0
  fi
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would copy: $src → $dst (+ transform internal refs)"
    return 0
  fi
  rm -rf "$dst"
  cp -r "$src" "$dst"
  # Rewrite repo-internal cross-refs in all .md files to GitHub blob URLs.
  while IFS= read -r -d '' mdfile; do
    transform_internal_refs "$mdfile"
  done < <(find "$dst" -name '*.md' -print0)
  echo "  ✓ .claude/skills/$slug/ (cross-refs rewritten to ${UPSTREAM_BLOB_URL})"
}

# refresh_skill_with_transform <slug>
# Like copy_skill_with_transform but with refresh_safe semantics for directories.
# The override signal for a skill directory is <dst_dir>.override.md (e.g.
# .claude/skills/pipeline.override.md signals consumer-owned pipeline skill).
refresh_skill_with_transform() {
  local slug="$1"
  local src="$PKG_ROOT/.claude/skills/$slug"
  local dst="$PROJECT_ROOT/.claude/skills/$slug"
  local override="${dst}.override.md"
  [ -d "$src" ] || return 0
  if [ -e "$override" ]; then
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would skip: .claude/skills/$slug (.override.md — consumer-owned)"
    else
      echo "  ⊝ .claude/skills/$slug (.override.md — consumer-owned, keeping)"
    fi
    return 0
  fi
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would refresh: $src → $dst (+ transform internal refs)"
    return 0
  fi
  rm -rf "$dst"
  cp -r "$src" "$dst"
  while IFS= read -r -d '' mdfile; do
    transform_internal_refs "$mdfile"
  done < <(find "$dst" -name '*.md' -print0)
  echo "  ✓ .claude/skills/$slug/ (refreshed, cross-refs rewritten to ${UPSTREAM_BLOB_URL})"
}

# generate_eslint_barrel
# #876 groundwork: single source of truth for the eslint-rules-local/index.mjs barrel generator
# + the #838 stack-scoped fences-fire fixture prune. Extracted VERBATIM (byte-identical output)
# from setup.d/40-configs.sh's former inline block — see the "why" comments that precede its call
# site there for the barrel-generation rationale (Variant A / fix #752, FQA S1-A W1).
# Precondition: call AFTER the eslint-rules-local/ rule files AND the scripts/fences-fire-fixtures/
# directory are in place — it reads the on-disk rule set and prunes fixtures whose rule is not in
# this stack's barrel.
# Self-no-ops on --dry-run (the `if [ -z "$DRY_RUN" ]; then … fi` guard is INSIDE the helper, so
# callers don't need to guard). Called by BOTH setup.d/40-configs.sh (copy path) and do_refresh in
# install.sh (refresh path, #876) — do not duplicate this logic at either call site.
# Reads globals: PROJECT_ROOT, PKG_ROOT, DRY_RUN.
generate_eslint_barrel() {
  if [ -z "$DRY_RUN" ]; then
    _barrel="$PROJECT_ROOT/eslint-rules-local/index.mjs"
    {
      echo "// AUTO-GENERATED by install.sh — re-exports the compiled sibling rule files as one ESLint"
      echo "// plugin. Regenerated each install to match the shipped rule set; do not hand-edit."
      echo "// Variant A: compiled .mjs barrel (ESM by extension) — no TS loader, no package.json type field needed."
      for _rf in "$PROJECT_ROOT"/eslint-rules-local/*.ts; do
        case "$_rf" in *.d.ts) continue ;; esac  # skip type declarations emitted by tsc
        _b=$(basename "$_rf" .ts); [ "$_b" = "index" ] && continue
        _camel=$(echo "$_b" | awk -F- '{o=$1; for(i=2;i<=NF;i++) o=o toupper(substr($i,1,1)) substr($i,2); print o}')
        echo "import { $_camel } from './$_b.mjs';"
      done
      echo "const plugin = {"
      echo "  meta: { name: '@rules-as-tests/local-eslint-rules', version: '0.1.0' },"
      echo "  rules: {"
      for _rf in "$PROJECT_ROOT"/eslint-rules-local/*.ts; do
        case "$_rf" in *.d.ts) continue ;; esac  # skip type declarations emitted by tsc
        _b=$(basename "$_rf" .ts); [ "$_b" = "index" ] && continue
        _camel=$(echo "$_b" | awk -F- '{o=$1; for(i=2;i<=NF;i++) o=o toupper(substr($i,1,1)) substr($i,2); print o}')
        echo "    '$_b': $_camel,"
      done
      echo "  },"
      echo "};"
      echo "export default plugin;"
      echo "export const rules = plugin.rules;"
    } > "$_barrel"
    echo "  ✓ generated eslint-rules-local/index.mjs ($(grep -c '^import ' "$_barrel") rules)"

    # #838: a consumer must only carry fences-fire fixtures its OWN barrel can enforce.
    # Fixtures ship unconditionally above (step 5a), but stack-specific rules (e.g. R12
    # no-server-imports-in-client, react-next only) land per-stack — probing a fixture whose
    # rule is absent from the barrel makes linter.verify THROW ("Could not find <rule> in
    # plugin") → check:fences-fire false-REDs on every non-next stack. Filter is scoped to
    # the manifests WE ship (iterates the framework source dir), so consumer-authored
    # fixtures are never touched. Keeps the gate strict where it must be: on react-next the
    # R12 fixture still ships, so R12 vanishing from the barrel still turns the gate RED.
    for _m in "$PKG_ROOT"/packages/core/audit-self/fixtures/fences-fire/*.manifest.json; do
      [ -f "$_m" ] || continue
      _mstem="$(basename "$_m" .manifest.json)"
      _rid=$(sed -n 's/.*"rule-id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$_m" | head -1)
      _rkey="${_rid##*/}"
      [ -n "$_rkey" ] || continue
      if ! grep -q "'$_rkey':" "$_barrel"; then
        rm -f "$PROJECT_ROOT/scripts/fences-fire-fixtures/$_mstem".*
        echo "  · fences fixture [$_mstem] not shipped — rule '$_rkey' not in this stack's barrel"
      fi
    done
  fi
}

# ── #811 preset staleness guard (live-research-default-delivery, D4) ───────────
# Deps-free, no-network major-version drift WARN: a shipped preset is a frozen snapshot
# (preset.meta.json pins) that goes stale as the ecosystem moves. When the consumer's
# installed tool major differs from the preset's recorded major, surface a WARN steering
# them to live-research delivery. Reads package.json TEXT (deps may be uninstalled at
# install time — no module/require check). exit stays 0; --dry-run handled by the caller.

# _json_meta_major <preset.meta.json> <key>  — read a numeric pin from the meta "pins" block.
_json_meta_major() {
  grep -oE "\"$2\"[[:space:]]*:[[:space:]]*[0-9]+" "$1" 2>/dev/null | grep -oE '[0-9]+' | tail -1
}

# _pkg_major <package.json> <dep>  — leading integer of the dep's version range (^15.4.0 → 15).
# The `"dep":` anchor (closing quote before the colon) avoids matching `eslint-config-*` for
# the `eslint` key. Scans both dependencies + devDependencies (flat text grep).
_pkg_major() {
  local pj="$1" dep="$2" entry ver
  entry=$(grep -oE "\"${dep}\"[[:space:]]*:[[:space:]]*\"[^\"]+\"" "$pj" 2>/dev/null | head -1)
  [ -n "$entry" ] || return 1
  ver=$(printf '%s' "$entry" | grep -oE '"[^"]+"[[:space:]]*$' | tr -d '"')
  printf '%s' "$ver" | grep -oE '[0-9]+' | head -1
}

# warn_preset_staleness <preset.meta.json> <consumer package.json>
# Emits a WARN block (and returns 0) when ≥1 pinned tool major differs from the consumer's.
warn_preset_staleness() {
  local meta="$1" pj="$2" drift=0 out="" key pin cur snap
  [ -f "$meta" ] || return 0
  [ -f "$pj" ] || return 0
  for key in next eslint prettier typescript-eslint; do
    pin=$(_json_meta_major "$meta" "$key")
    [ -n "$pin" ] || continue
    cur=$(_pkg_major "$pj" "$key") || continue
    [ -n "$cur" ] || continue
    if [ "$cur" != "$pin" ]; then
      out="${out}     - ${key}: preset pinned to v${pin}, you are on v${cur}\n"
      drift=1
    fi
  done
  if [ "$drift" = "1" ]; then
    snap=$(grep -oE '"snapshotDate"[[:space:]]*:[[:space:]]*"[^"]+"' "$meta" 2>/dev/null | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
    echo ""
    echo "⚠  This preset is a frozen Next-15 snapshot (${snap:-unknown}) — your installed tool majors differ:"
    printf '%b' "$out"
    echo "   Prefer live-research delivery for rules matching your current versions: run the rule-research"
    echo "   protocol (agents/rule-researcher.md / the rule-research skill), then ./setup --full. Presets"
    echo "   are the fallback baseline, not the source of truth."
  fi
}

# ── #827 B4: ensure the rule-factory's workspace deps (@rules-as-tests/*) resolve ──
# The factory CLI (packages/core/install/rule-bootstrap-cli.ts) imports @rules-as-tests/preset-*
# via packages/core/validator/gate-rule-tester.ts. When the framework checkout is a git worktree
# whose node_modules is BORROWED (symlinked) from a primary checkout on a DIVERGENT branch, those
# package links can dangle → the factory crashes (ERR_MODULE_NOT_FOUND) even though the worktree's
# OWN packages/ has them. This helper self-heals by linking each of the worktree's own workspace
# packages into a worktree-local node_modules/@rules-as-tests/. Idempotent; never writes THROUGH a
# borrowed (symlinked) node_modules (that would point a foreign checkout's deps at this worktree).
_workspace_pkg_resolves() {
  local _root="${1:-${PKG_ROOT:-.}}"
  ( cd "$_root" && node -e 'require.resolve("@rules-as-tests/preset-react-spa/eslint-rules")' ) >/dev/null 2>&1
}
ensure_workspace_pkg_links() {
  local _root="${1:-${PKG_ROOT:-.}}"
  command -v node >/dev/null 2>&1 || return 0
  _workspace_pkg_resolves "$_root" && return 0
  if [ -L "$_root/node_modules" ]; then
    echo "  · workspace-link self-heal: $_root/node_modules is a borrowed symlink and @rules-as-tests/* do not resolve;"
    echo "    run 'npm ci --prefix packages/core && npm install' in $_root to self-contain it."
    return 0
  fi
  local _nm="$_root/node_modules/@rules-as-tests"
  mkdir -p "$_nm" 2>/dev/null || return 0
  local _pkgdir _name
  for _pkgdir in "$_root"/packages/*/; do
    [ -f "${_pkgdir}package.json" ] || continue
    _name=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).name||"")' "${_pkgdir}package.json" 2>/dev/null)
    case "$_name" in
      @rules-as-tests/*) ln -sfn "${_pkgdir%/}" "$_nm/${_name#@rules-as-tests/}" 2>/dev/null || true ;;
    esac
  done
  _workspace_pkg_resolves "$_root" && echo "  · workspace-link self-heal: linked @rules-as-tests/* in $_nm (#827 B4)"
}

# ── O1 fix: INSTALL_SH_LIB_ONLY guard is LAST (after all helpers are defined) ──
# When sourced directly with INSTALL_SH_LIB_ONLY=1, expose all helpers and stop here.
# When sourced by install.sh, this guard fires and returns from the `source setup.d/lib.sh`
# call in install.sh — install.sh then checks its own guard (which also returns 0).
if [ "${INSTALL_SH_LIB_ONLY:-}" = "1" ]; then
  return 0 2>/dev/null || true
fi
