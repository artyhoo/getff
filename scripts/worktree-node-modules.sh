#!/usr/bin/env bash
# worktree-node-modules.sh — SSOT for worktree node_modules provisioning.
#
# Usage: bash scripts/worktree-node-modules.sh [--check|--apply] <worktree-dir> [<primary-dir>]
#
#   --check   report only; never writes. Exit 0 = provisioned, 1 = fixable, 2 = unfixable.
#   --apply   provision idempotently (default). Exit 0 = provisioned, 2 = unfixable.
#
# Diagnostics go to stderr; stdout stays empty so callers can compose this into a pipeline
# whose stdout contract is the worktree path (.claude/hooks/worktree-setup.sh, scripts/create-worktree.sh).
#
# WHY THIS FILE EXISTS (single source of truth):
# The same provisioning block was copy-pasted into .claude/hooks/worktree-setup.sh and
# scripts/create-worktree.sh, which both declare `@dual-pair: worktree-create-setup`. Two
# byte-identical copies of the same logic under one dual-pair anchor is exactly
# #sync-by-copy-paste (.claude/rules/dual-implementation-discipline.md §8); §7 requires the
# shared logic to live in ONE canonical place with the other channel pointing at it.
#
# THE CACHE-AWARE RULE (incident 2026-07-23):
# vitest materialises `node_modules/.vite` + `packages/core/node_modules/.vite` inside a
# worktree the first time any suite runs there — packages/core/hooks/pre-push.ts's own
# principles section triggers it. Once that happens the path EXISTS as a real directory, so
# both callers' `[[ ! -e … ]]` guards are permanently false and the worktree can never be
# provisioned again. Worse, `ln -sfn TARGET node_modules` against an existing directory
# creates `node_modules/node_modules` — a link nested INSIDE the cache rather than replacing
# the path. A live census found 32 of 125 worktrees in that state.
#
# So a path is "free" (safe to replace) when it is absent, OR a symlink we may re-point, OR a
# real directory holding nothing but regenerable `.vite*` caches. Anything else holds a real
# install and is left strictly alone.
#
# @dual-pair: worktree-create-setup
# spec: docs/meta-factory/research-patches/2026-05-30-worktree-create-dual-channel.md §6

set -uo pipefail

MODE="--apply"
case "${1:-}" in
  --check|--apply) MODE="$1"; shift ;;
esac

WORKTREE_DIR="${1:?Usage: $0 [--check|--apply] <worktree-dir> [<primary-dir>]}"
PRIMARY_DIR="${2:-}"

if [ -z "$PRIMARY_DIR" ]; then
  # A worktree's .git is a FILE pointing at the primary's .git/worktrees/<name>; resolve the
  # primary from git itself rather than guessing at path nesting (a worktree may live anywhere).
  PRIMARY_DIR="$(git -C "$WORKTREE_DIR" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
  PRIMARY_DIR="${PRIMARY_DIR%/.git}"
fi
if [ -z "$PRIMARY_DIR" ] || [ ! -d "$PRIMARY_DIR" ]; then
  printf '⚠ worktree-node-modules: cannot resolve primary checkout for %s\n' "$WORKTREE_DIR" >&2
  exit 2
fi

# Two DISTINCT predicates — conflating them is a real bug (an already-correct symlink is
# simultaneously "free to re-point" and "already provisioned"):
#
#   nm_is_free        — may this path be replaced without destroying a real install?
#   nm_is_provisioned — does this path already deliver a usable node_modules?
#
# `[ -e ]` follows symlinks, so a DANGLING symlink is not-provisioned (its target is gone)
# yet still free (re-pointing it is safe) — which is exactly the behaviour we want.
nm_is_free() {
  local p="$1" e
  [ -L "$p" ] && return 0            # any symlink, dangling or not, may be re-pointed
  [ -e "$p" ] || return 0            # absent
  [ -d "$p" ] || return 1            # a regular file at this path: never touch
  while IFS= read -r e; do
    [ -n "$e" ] || continue
    case "$e" in .vite*) ;; *) return 1 ;; esac
  done <<EOF
$(ls -A "$p" 2>/dev/null)
EOF
  return 0                           # nothing but regenerable .vite* caches
}

nm_is_provisioned() {
  local p="$1" e
  [ -e "$p" ] || return 1            # absent, or a symlink whose target is gone
  [ -L "$p" ] && return 0            # resolving symlink — the delivery form we install
  [ -d "$p" ] || return 1
  while IFS= read -r e; do
    [ -n "$e" ] || continue
    case "$e" in .vite*) ;; *) return 0 ;; esac
  done <<EOF
$(ls -A "$p" 2>/dev/null)
EOF
  return 1                           # cache-only dir: looks present, delivers nothing
}

ROOT_NM="$WORKTREE_DIR/node_modules"
CORE_NM="$WORKTREE_DIR/packages/core/node_modules"
HAS_CORE=0; [ -d "$WORKTREE_DIR/packages/core" ] && HAS_CORE=1

# NESTED WORKSPACE LAYERS (2026-09-30): npm plans nested layers for workspaces other than
# packages/core too — this repo's root lock puts eslint-plugin-jsx-a11y (absent from the root
# layer) and eslint-plugin-react-hooks 6.1.1 (root: 7.1.1) under packages/preset-react-spa/
# node_modules. With only the root and core layers linked, code in that workspace resolved
# react-hooks 7.1.1 and could not resolve jsx-a11y at all; a census found the layer missing in
# all 73 root-linked worktrees carrying that workspace. So every workspace directory of THIS
# worktree gets the same link the core layer gets, when — and only when — the primary holds a
# real, non-cache layer at the same path. A cache-only primary layer (vitest's .vite* in
# packages/runtime-bridge) delivers nothing and is not linked; a workspace absent from the
# worktree is never created. This is link DELIVERY only: whether the primary installed what
# this worktree's lock plans is a separate question, not judged here.
#
# Nested layers are linked ONLY while the root layer is the primary's too (a link to it, or about
# to become one). A worktree with its own root install (npm, pnpm) keeps its own nested layers:
# an install run there passes every root-link guard (getff-work.sh, create-worktree.sh) and would
# reify packages/<ws>/node_modules THROUGH a planted link — into the shared clone (the class of
# the 2026-09-14 `npm ci` through the packages/core link, and of getff#1860 under pnpm).
#
# Workspaces come from this worktree's package.json `workspaces` (npm / yarn / bun; array or
# { packages: [...] }; `!pattern` excludes), each pattern expanded as a shell glob inside the
# worktree (`*` and `?` only — no braces, and `**` acts as `*`). pnpm-workspace.yaml is not read,
# so pnpm workspaces get no nested links. Without node (CC hooks run with a stripped PATH) no
# workspace is guessed: nothing nested is linked, and the next caller with node heals it.
# WNM_NODE overrides the node executable (tests substitute a missing one).
NODE="${WNM_NODE:-node}"

workspace_dirs() {
  local pats d IFS
  command -v "$NODE" >/dev/null 2>&1 || return 0
  # One pattern per line, prefixed + (include) or - (exclude).
  pats="$("$NODE" -e '
    try {
      const w = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).workspaces;
      const list = Array.isArray(w) ? w : (w && Array.isArray(w.packages) ? w.packages : []);
      for (const p of list) {
        if (typeof p !== "string" || p.includes("\n")) continue;
        console.log(p.startsWith("!") ? "-" + p.slice(1) : "+" + p);
      }
    } catch {}
  ' "$WORKTREE_DIR/package.json" 2>/dev/null)"
  expand() {
    local sign="$1" line
    while IFS= read -r line; do
      case "$line" in "$sign"*) ;; *) continue ;; esac
      IFS='
'                                              # split on newlines only: patterns may hold spaces
      for d in "$WORKTREE_DIR"/${line#?}; do
        [ -d "$d" ] || continue
        d="${d#"$WORKTREE_DIR"/}"; d="${d%/}"
        printf '%s\n' "$d"
      done
      unset IFS
    done <<EOF
$pats
EOF
  }
  expand + | sort -u | while IFS= read -r d; do
    [ "$d" = "packages/core" ] && continue      # its own rule below (fallback link)
    expand - | grep -qxF "$d" && continue       # excluded by a `!` pattern
    printf '%s\n' "$d"
  done
}

# Does the root layer come from the primary (a link resolving to its node_modules, or a path this
# run will link)? Compared physically, so /var vs /private/var and relative links agree.
root_is_primary() {
  [ "$needs_root" -eq 1 ] && return 0
  [ -L "$ROOT_NM" ] || return 1
  [ "$(cd "$ROOT_NM" 2>/dev/null && pwd -P)" = "$(cd "$PRIMARY_DIR/node_modules" 2>/dev/null && pwd -P)" ]
}

# --check and --apply share ONE definition of the end state, so they can never disagree.
needs_root=0; nm_is_provisioned "$ROOT_NM" || needs_root=1
needs_core=0; if [ "$HAS_CORE" -eq 1 ]; then nm_is_provisioned "$CORE_NM" || needs_core=1; fi
NESTED_MISSING=""   # newline-separated workspace dirs whose layer must be linked
NESTED_BLOCKED=""   # ...and those whose path holds something we may never replace (a file)
if root_is_primary; then
  while IFS= read -r ws; do
    [ -n "$ws" ] || continue
    src="$PRIMARY_DIR/$ws/node_modules"
    { [ -d "$src" ] && [ ! -L "$src" ] && nm_is_provisioned "$src"; } || continue
    nm="$WORKTREE_DIR/$ws/node_modules"
    nm_is_provisioned "$nm" && continue
    if nm_is_free "$nm"; then NESTED_MISSING="$NESTED_MISSING$ws
"
    else NESTED_BLOCKED="$NESTED_BLOCKED$nm
"
    fi
  done <<EOF
$(workspace_dirs)
EOF
fi

# Unfixable in BOTH modes, so --check never calls fixable what --apply would refuse.
if [ -n "$NESTED_BLOCKED" ]; then
  printf '%s' "$NESTED_BLOCKED" | while IFS= read -r nm; do
    printf '⚠ worktree-node-modules: %s is neither a directory nor a symlink — remove it, then re-run: bash scripts/worktree-doctor.sh --fix\n' \
      "$nm" >&2
  done
  exit 2
fi

if [ "$needs_root" -eq 0 ] && [ "$needs_core" -eq 0 ] && [ -z "$NESTED_MISSING" ]; then
  [ "$MODE" = "--check" ] && exit 0
  exit 0
fi

if [ ! -e "$PRIMARY_DIR/node_modules" ]; then
  printf '⚠ worktree-node-modules: %s has no node_modules — run `npm install` there first; cannot provision %s\n' \
    "$PRIMARY_DIR" "$WORKTREE_DIR" >&2
  exit 2
fi

if [ "$MODE" = "--check" ]; then
  printf '⚠ worktree-node-modules: %s is not provisioned (root=%s core=%s nested=%s) — run: bash scripts/worktree-doctor.sh --fix\n' \
    "$WORKTREE_DIR" \
    "$([ "$needs_root" -eq 1 ] && echo MISSING || echo ok)" \
    "$([ "$needs_core" -eq 1 ] && echo MISSING || echo ok)" \
    "$([ -n "$NESTED_MISSING" ] && printf '%s' "$NESTED_MISSING" | paste -sd, - || echo ok)" >&2
  exit 1
fi

# ── apply ────────────────────────────────────────────────────────────────────
# Removal is safe by construction: nm_is_free() returned true, so the path is at most a
# symlink or a directory of regenerable .vite* caches. Never a real install.
refuse() {
  printf '⚠ worktree-node-modules: %s needs provisioning but is not safe to replace (not a symlink, not a cache-only dir) — left untouched\n' \
    "$1" >&2
  exit 2
}

if [ "$needs_root" -eq 1 ]; then
  nm_is_free "$ROOT_NM" || refuse "$ROOT_NM"
  rm -rf "$ROOT_NM"
  ln -sfn "$PRIMARY_DIR/node_modules" "$ROOT_NM"
fi

if [ "$needs_core" -eq 1 ]; then
  nm_is_free "$CORE_NM" || refuse "$CORE_NM"
  # packages/core/node_modules must point at the primary's REAL nested dir when one exists.
  # The root lock plans nested dep versions (packages/core/node_modules/<dep>) that diverge
  # from the root layer, and a ../../node_modules link SHADOWS that nested layer — esbuild
  # then bundles the root versions and `scripts/build-synth-bundle.sh --check` false-fails
  # with "synth-bundle drift" in every fresh worktree (incident 2026-07-02). Fall back to
  # ../../node_modules only when the primary has no nested dir (fresh clone before install).
  #
  # The bundle's own layer-sensitivity is no longer load-bearing on this link: every package it
  # inlines is now pinned to one version across all three lockfile-planned layers, and
  # scripts/check-bundle-dep-parity.sh fails loudly if that ever stops being true. Keep the
  # nested link anyway — it is still the layout root `npm ci` produces for every OTHER dep.
  rm -rf "$CORE_NM"
  if [ -d "$PRIMARY_DIR/packages/core/node_modules" ] && [ ! -L "$PRIMARY_DIR/packages/core/node_modules" ]; then
    ln -sfn "$PRIMARY_DIR/packages/core/node_modules" "$CORE_NM"
  else
    ln -sfn ../../node_modules "$CORE_NM"
  fi
fi

# Same shape as the core link above: the primary's real layer, and never a real install replaced.
# Postcondition checked per link: a failed `ln` (unwritable workspace dir) must exit 2, not print
# «provisioned» and leave --check failing forever.
while IFS= read -r ws; do
  [ -n "$ws" ] || continue
  nm="$WORKTREE_DIR/$ws/node_modules"
  nm_is_free "$nm" || refuse "$nm"
  rm -rf "$nm"
  ln -sfn "$PRIMARY_DIR/$ws/node_modules" "$nm" 2>/dev/null
  if ! nm_is_provisioned "$nm"; then
    printf '⚠ worktree-node-modules: could not link %s -> %s — is %s writable?\n' \
      "$nm" "$PRIMARY_DIR/$ws/node_modules" "$WORKTREE_DIR/$ws" >&2
    exit 2
  fi
done <<EOF
$NESTED_MISSING
EOF

printf '✓ worktree-node-modules: provisioned %s\n' "$WORKTREE_DIR" >&2
exit 0
