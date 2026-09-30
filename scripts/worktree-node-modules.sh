#!/usr/bin/env bash
# worktree-node-modules.sh — SSOT for worktree node_modules provisioning.
#
# Usage: bash scripts/worktree-node-modules.sh [--check|--apply] <worktree-dir> [<primary-dir>]
#
#   --check   report only; never writes. Exit 0 = provisioned, 1 = fixable by linking,
#             2 = unfixable, 3 = lock-diverged (a link would serve the wrong tree; --apply
#             performs a real install).
#   --apply   provision idempotently (default). Exit 0 = provisioned, 2 = unfixable.
#
# WNM_NPM overrides the npm executable (tests substitute a recording stub).
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

# --check and --apply share ONE definition of the end state, so they can never disagree.
needs_root=0; nm_is_provisioned "$ROOT_NM" || needs_root=1
needs_core=0; if [ "$HAS_CORE" -eq 1 ]; then nm_is_provisioned "$CORE_NM" || needs_core=1; fi

# ── LOCK-AWARE ───────────────────────────────────────────────────────────────
# A link is a valid delivery only when the primary's INSTALLED tree is the tree this
# worktree's lock plans. Incident 2026-09-30 (worktree brave-lumiere-dd3388): the branch's
# locks added oxlint, the primary's node_modules lacked it, and the linked worktree failed
# `tsc --noEmit` with TS2307 on `oxlint/plugins-dev` plus several vitest files — dependency
# reds masquerading as code reds.
#
# The comparator is the primary's npm hidden lockfile (node_modules/.package-lock.json — what
# is actually installed, even when the primary's own package-lock.json has moved on without a
# reinstall), checked against every DIRECT dependency of every workspace in the worktree's
# package-lock.json at the exact planned version, resolved the way node resolves it
# (<workspace>/node_modules/<name>, then node_modules/<name>). Direct deps are what code
# imports; a transitive patch drift is not a reason to install 1.8 GB per worktree. A byte
# compare of the lockfiles was measured and rejected as the primary comparator: on 2026-09-30
# it diverged for 117 of 128 worktrees (the direct-dep compare: 84, driven by real version
# gaps such as markdownlint-cli2). The byte compare stays as the fallback when no hidden
# lockfile or no node is available (pnpm / yarn / bun consumers, a pre-npm-7 primary).
#
# CC-launched hooks run with a stripped PATH (CLAUDE.md «Homebrew PATH in hooks»); append the
# usual locations so node/npm resolve without shadowing a version manager's.
PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
NPM="${WNM_NPM:-npm}"
LOCK_REASONS=""

# Returns 0 when the worktree's lock diverges from the primary's installed tree (reasons in
# LOCK_REASONS), 1 when a link is a faithful delivery.
lock_diverges() {
  local hidden="$PRIMARY_DIR/node_modules/.package-lock.json" rc f
  if [ -f "$WORKTREE_DIR/package-lock.json" ] && [ -f "$hidden" ] && command -v node >/dev/null 2>&1; then
    LOCK_REASONS="$(node - "$WORKTREE_DIR/package-lock.json" "$hidden" <<'JS'
const fs = require('fs');
const [want, have] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')).packages || {});
const miss = [];
for (const [ws, entry] of Object.entries(want)) {
  if (ws.includes('node_modules/')) continue; // workspace roots only: "" and e.g. "packages/core"
  for (const name of Object.keys({ ...entry.dependencies, ...entry.devDependencies })) {
    const paths = [...(ws ? [`${ws}/node_modules/${name}`] : []), `node_modules/${name}`];
    const planned = paths.map((p) => want[p]).find(Boolean);
    if (!planned || planned.link) continue; // a workspace link carries no version
    const got = paths.map((p) => have[p]).find(Boolean);
    if (!got || got.version !== planned.version)
      miss.push(`${name}: planned ${planned.version}, installed ${got ? got.version : 'none'}`);
  }
}
if (miss.length === 0) process.exit(0);
console.log(miss.slice(0, 8).join('; ') + (miss.length > 8 ? `; … ${miss.length - 8} more` : ''));
process.exit(3);
JS
)"
    rc=$?
    [ "$rc" -eq 0 ] && return 1
    [ "$rc" -eq 3 ] && return 0
    # Any other exit is an unreadable lock — fall through to the byte compare.
  fi
  for f in package-lock.json npm-shrinkwrap.json pnpm-lock.yaml yarn.lock bun.lock bun.lockb; do
    [ -e "$WORKTREE_DIR/$f" ] || [ -e "$PRIMARY_DIR/$f" ] || continue
    if ! cmp -s "$WORKTREE_DIR/$f" "$PRIMARY_DIR/$f"; then
      LOCK_REASONS="$f differs from the primary's"
      return 0
    fi
  done
  return 1
}

# The exact manual remedy, printed whenever the helper cannot (or may not) install itself.
remedy() {
  printf '   cd %s\n' "$WORKTREE_DIR"
  printf '   [ -L node_modules ] && rm node_modules\n'
  [ "$HAS_CORE" -eq 1 ] && printf '   [ -L packages/core/node_modules ] && rm packages/core/node_modules\n'
  if [ -f "$WORKTREE_DIR/package-lock.json" ]; then
    printf '   npm install --no-save\n'
    [ -f "$WORKTREE_DIR/packages/core/package-lock.json" ] && printf '   npm ci --prefix packages/core\n'
    printf '   git diff --summary   # restore any "mode change" npm made to tracked bin targets\n'
  elif [ -f "$WORKTREE_DIR/pnpm-lock.yaml" ]; then printf '   pnpm install --frozen-lockfile\n'
  elif [ -f "$WORKTREE_DIR/yarn.lock" ]; then printf '   yarn install --frozen-lockfile\n'
  else printf '   bun install --frozen-lockfile\n'
  fi
}

# Only a LINK delivery can be stale against the worktree's lock: a layer that is a symlink, or
# one about to become one. A real install is the worktree's own and is left to npm.
link_layers=0
{ [ -L "$ROOT_NM" ] || [ "$needs_root" -eq 1 ]; } && link_layers=1
{ [ "$HAS_CORE" -eq 1 ] && { [ -L "$CORE_NM" ] || [ "$needs_core" -eq 1 ]; }; } && link_layers=1

if [ "$link_layers" -eq 1 ] && lock_diverges; then
  if [ "$MODE" = "--check" ]; then
    printf '⚠ worktree-node-modules: %s — its lock diverges from the primary'"'"'s installed tree (%s); a link would serve the wrong dependencies. Run: bash %s --apply %s (a real install), or by hand:\n' \
      "$WORKTREE_DIR" "$LOCK_REASONS" "${BASH_SOURCE[0]}" "$WORKTREE_DIR" >&2
    remedy >&2
    exit 3
  fi

  install_failed() {
    printf '⚠ worktree-node-modules: %s — lock diverges from the primary (%s) and the real install %s. Run by hand:\n' \
      "$WORKTREE_DIR" "$LOCK_REASONS" "$1" >&2
    remedy >&2
    exit 2
  }
  [ -f "$WORKTREE_DIR/package-lock.json" ] || install_failed "is npm-only here (non-npm lockfile)"
  command -v "$NPM" >/dev/null 2>&1 || install_failed "needs npm, which is not on PATH"

  # Never install THROUGH a link: npm would reify the SHARED clone against this worktree's lock
  # and prune it (PR #1399). Drop the links (rm on a symlink removes only the link) and any
  # cache-only dirs; a real install is the worktree's own and is installed over in place.
  for nm in "$ROOT_NM" "$CORE_NM"; do
    if [ -L "$nm" ]; then rm -f "$nm"
    elif nm_is_free "$nm"; then rm -rf "$nm"
    fi
  done
  { [ -L "$ROOT_NM" ] || [ -L "$CORE_NM" ]; } && install_failed "was refused: a node_modules symlink survived unlinking"

  # npm rewrites what it should not: the lockfile (even under --no-save on some versions) and
  # the file mode of every workspace `bin` target it links (incident: verify-provenance-cli.ts
  # 644 -> 755). Snapshot both, restore after, whatever the install's outcome.
  SNAP="$(mktemp -d)"
  for f in package-lock.json packages/core/package-lock.json; do
    [ -f "$WORKTREE_DIR/$f" ] && mkdir -p "$SNAP/$(dirname "$f")" && cp -p "$WORKTREE_DIR/$f" "$SNAP/$f"
  done
  git -C "$WORKTREE_DIR" diff --summary 2>/dev/null | grep '^ mode change ' >"$SNAP/.modes-before" || true
  restore() {
    local f old path
    for f in package-lock.json packages/core/package-lock.json; do
      [ -f "$SNAP/$f" ] && ! cmp -s "$SNAP/$f" "$WORKTREE_DIR/$f" && cp -p "$SNAP/$f" "$WORKTREE_DIR/$f"
    done
    git -C "$WORKTREE_DIR" diff --summary 2>/dev/null | grep '^ mode change ' | while IFS= read -r line; do
      grep -qxF "$line" "$SNAP/.modes-before" && continue # a mode change that predates us is the user's
      old="$(printf '%s' "$line" | awk '{print $3}')"
      path="$(printf '%s' "$line" | sed -E 's/^ mode change [0-7]+ => [0-7]+ //')"
      chmod "${old#100}" "$WORKTREE_DIR/$path"
    done
    rm -rf "$SNAP"
  }

  printf '▶ worktree-node-modules: %s — lock diverges from the primary (%s); installing for real\n' \
    "$WORKTREE_DIR" "$LOCK_REASONS" >&2
  if ! (cd "$WORKTREE_DIR" && "$NPM" install --no-save >&2); then
    restore; install_failed "failed at \`npm install --no-save\`"
  fi
  if [ -f "$WORKTREE_DIR/packages/core/package-lock.json" ]; then
    [ -L "$CORE_NM" ] && { restore; install_failed "was refused: packages/core/node_modules became a symlink"; }
    if ! (cd "$WORKTREE_DIR" && "$NPM" ci --prefix packages/core >&2); then
      restore; install_failed "failed at \`npm ci --prefix packages/core\`"
    fi
  fi
  restore
  printf '✓ worktree-node-modules: installed %s for real (its lock diverges from the primary)\n' "$WORKTREE_DIR" >&2
  exit 0
fi
# ── END LOCK-AWARE ───────────────────────────────────────────────────────────

if [ "$needs_root" -eq 0 ] && [ "$needs_core" -eq 0 ]; then
  [ "$MODE" = "--check" ] && exit 0
  exit 0
fi

if [ ! -e "$PRIMARY_DIR/node_modules" ]; then
  printf '⚠ worktree-node-modules: %s has no node_modules — run `npm install` there first; cannot provision %s\n' \
    "$PRIMARY_DIR" "$WORKTREE_DIR" >&2
  exit 2
fi

if [ "$MODE" = "--check" ]; then
  printf '⚠ worktree-node-modules: %s is not provisioned (root=%s core=%s) — run: bash scripts/worktree-doctor.sh --fix\n' \
    "$WORKTREE_DIR" \
    "$([ "$needs_root" -eq 1 ] && echo MISSING || echo ok)" \
    "$([ "$needs_core" -eq 1 ] && echo MISSING || echo ok)" >&2
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

printf '✓ worktree-node-modules: provisioned %s\n' "$WORKTREE_DIR" >&2
exit 0
