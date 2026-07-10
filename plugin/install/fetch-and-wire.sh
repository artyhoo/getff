#!/usr/bin/env bash
# fetch-and-wire.sh — the rules-as-tests "hybrid seam": reach the HARD enforcement layer
# (git hooks + CI) by fetching the project's OWN official installer and running it against
# the consumer repo. Option C (maintainer decision 2026-06-22) — fetch-the-official-installer
# rather than bundle a ~2MB copy into the plugin. See:
#   docs/superpowers/specs/2026-06-22-cc-plugin-packaging-design.md §6
#   .claude/rules/companion-install-principle.md  (install via the official top-level installer)
#
# The plugin already delivers the SOFT layer (skills/agents/session hooks). This script is the
# opt-in bridge to the HARD layer, invoked by /getff:install-enforcement. It NEVER
# wires anything on its own: dry-run is the default; --apply does the real run; consent is
# orchestrated by the command (plugin/commands/install-enforcement.md), not assumed here.
#
# Usage:  fetch-and-wire.sh [stack] [--apply]
#   stack    install.sh stack arg (default: ts-server)
#   --apply  run the real install (default: --dry-run, writes nothing to the consumer)
#
# Env:
#   CLAUDE_PROJECT_DIR   target consumer repo (default: $PWD)
#   RAT_INSTALL_SOURCE   installer source — a local dir containing install.sh (used in place,
#                        for forks/tests) OR a git URL to clone (default: the official repo)
#   RAT_INSTALL_REF      git ref to clone when SOURCE is a URL (default: the stable `main` branch,
#                        which carries the current hardened install.sh). Override to pin a
#                        reproducible release tag once one is cut for the plugin.
set -euo pipefail

# The plugin's OWN version (principle 24 asserts plugin.json/marketplace.json parity). It is
# deliberately DECOUPLED from RAT_INSTALL_REF below: the framework's own release tags (v0.2.0,
# v0.3.0) lag staging by weeks, so pinning the fetch to `v<plugin-version>` would ship a stale
# install.sh missing the hardening fixes (#531/#551/#635/#636). We track `main` instead; a
# reproducible per-plugin release tag is a future maintainer release action (see done.md).
RAT_PLUGIN_VERSION="0.2.0"

STACK="ts-server"
APPLY=""
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY="1" ;;
    --*)     printf 'fetch-and-wire: unknown flag %s\n' "$arg" >&2; exit 2 ;;
    *)       STACK="$arg" ;;
  esac
done

TARGET="${CLAUDE_PROJECT_DIR:-$PWD}"
SOURCE="${RAT_INSTALL_SOURCE:-https://github.com/artyhoo/getff.git}"
REF="${RAT_INSTALL_REF:-main}"

[ -d "$TARGET" ] || { printf 'fetch-and-wire: target %s is not a directory\n' "$TARGET" >&2; exit 1; }

# ── Resolve the installer package root (PKG) ────────────────────────────────
CLONE_TMP=""
cleanup() { [ -n "$CLONE_TMP" ] && [ -d "$CLONE_TMP" ] && rm -rf "$CLONE_TMP" 2>/dev/null || true; }
trap cleanup EXIT

if [ -d "$SOURCE" ] && [ -f "$SOURCE/install.sh" ]; then
  # Local source (a fork checkout or the test harness) — use in place, no network.
  PKG="$SOURCE"
  printf '▶ Using local installer source: %s\n' "$PKG"
else
  command -v git >/dev/null 2>&1 || { printf 'fetch-and-wire: git not found (needed to fetch the installer)\n' >&2; exit 1; }
  CLONE_TMP="$(mktemp -d "${TMPDIR:-/tmp}/rat-installer.XXXXXX")"
  printf '▶ Fetching the official installer: %s @ %s\n' "$SOURCE" "$REF"
  if ! git clone --quiet --depth 1 --branch "$REF" "$SOURCE" "$CLONE_TMP" 2>/dev/null; then
    printf '  (tag %s not found — falling back to the default branch)\n' "$REF"
    git clone --quiet --depth 1 "$SOURCE" "$CLONE_TMP"
  fi
  PKG="$CLONE_TMP"
fi

[ -f "$PKG/install.sh" ] || { printf 'fetch-and-wire: no install.sh under %s\n' "$PKG" >&2; exit 1; }

# ── Run the official installer against the consumer (dry-run unless --apply) ──
DRY="--dry-run"
[ -n "$APPLY" ] && DRY=""
if [ -n "$APPLY" ]; then
  printf '▶ Wiring the hard enforcement layer into %s (stack=%s)…\n' "$TARGET" "$STACK"
else
  printf '▶ PREVIEW (dry-run) — wiring plan for %s (stack=%s); nothing will be written:\n' "$TARGET" "$STACK"
fi

( cd "$TARGET" && bash "$PKG/install.sh" "$STACK" $DRY )
