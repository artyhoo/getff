#!/usr/bin/env bash
# build-getff-dist.sh — assemble the `getff` distribution package (packages/getff) from the repo root.
#
# WHY A COPY, NOT A MOVE. install.sh reads everything relative to PKG_ROOT — the directory it
# lives in (install.sh:55) — and setup.d/*.sh follow: packages/core (71 refs), templates/,
# .claude/hooks, packages/preset-*, scripts/, skills/, setup.d/, agents/, .prettierrc.json
# (measured in docs/meta-factory/getff-name-architecture-freeze.md §2 §0.5). A tarball that lays
# its contents out exactly like the repository root makes PKG_ROOT land where the script already
# looks, and not one of those reads changes. `files` cannot reach above a package's own directory,
# so the payload is COPIED into packages/getff/ at pack time (npm `prepack`, and this script).
# install.sh itself never moves: tests/install-sh/*.sh reference its root path 215 times.
#
# WHAT IS COMMITTED. Not the payload (gitignored in packages/getff/.gitignore) — MANIFEST.sha256,
# one `<sha256>  <path>` line per assembled file. `--check` re-assembles into a temp dir and diffs
# the manifests: a shipped file edited without re-running this script is DRIFT, exit 1, the paths
# listed. Same shape as scripts/build-synth-bundle.sh --check (the in-repo precedent).
#
# SOURCE OF TRUTH FOR THE FILE LIST: `git ls-files` (tracked files only). A directory walk would
# ship whatever is lying in the working tree — node_modules, a scratch file, a secret
# (kickoff npm-publish-getff-init §5 T-U10-B).
#
# Usage:
#   scripts/build-getff-dist.sh            # assemble packages/getff/ + rewrite MANIFEST.sha256
#   scripts/build-getff-dist.sh --check    # drift gate: exit 1 if committed manifest != fresh assembly,
#                                          # or if package.json `files` misses a payload root
#
# Runs from any cwd (root derived from this file's location). Bash 3.2-compatible (macOS default).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
PKG="$ROOT/packages/getff"
MANIFEST="$PKG/MANIFEST.sha256"

# Every path the installer reads from PKG_ROOT, plus the two entry scripts. Adding a root here
# requires the same root in packages/getff/package.json `files` (checked below) and in
# packages/getff/.gitignore (or the copy would be committed).
PAYLOAD="install.sh setup setup.d agents skills templates .claude/hooks .claude/skills .claude/templates .prettierrc.json packages/core packages/preset-next-15-canonical packages/preset-react-spa packages/preset-react-native packages/runtime-bridge scripts"
# Their top-level roots as `files` must spell them.
PAYLOAD_TOP="install.sh setup setup.d agents skills templates .claude .prettierrc.json packages scripts"

if command -v sha256sum >/dev/null 2>&1; then
  SHA="sha256sum"
else
  SHA="shasum -a 256"
fi

fail() { echo "ERROR: $*" >&2; exit 1; }

# assemble <dest>: wipe the payload roots under <dest>, then copy every tracked payload file.
assemble() {
  local dest="$1" top f
  for top in $PAYLOAD_TOP; do
    rm -rf "${dest:?}/$top"
  done
  # shellcheck disable=SC2086  # PAYLOAD is a deliberate word-split list of pathspecs
  git -C "$ROOT" ls-files -z -- $PAYLOAD | while IFS= read -r -d '' f; do
    [ -f "$ROOT/$f" ] || fail "tracked file missing from the working tree: $f (commit or restore it before assembling)"
    mkdir -p "$dest/$(dirname "$f")"
    cp -p "$ROOT/$f" "$dest/$f"
  done
}

# manifest <dest>: `<sha256>  <path>` for every payload file under <dest>, byte-stable order.
manifest() {
  local dest="$1"
  # shellcheck disable=SC2086  # PAYLOAD_TOP / SHA are deliberate word-split lists
  ( cd "$dest" && find $PAYLOAD_TOP -type f -print0 | LC_ALL=C sort -z | xargs -0 $SHA )
}

# files_check: every PAYLOAD_TOP root must be spelled in package.json `files` — a dropped entry
# would silently shrink the tarball while the manifest stayed green.
files_check() {
  local missing
  missing="$(node -e '
    const files = require(process.argv[1] + "/package.json").files || [];
    const norm = (s) => s.replace(/\/+$/, "");
    const have = new Set(files.map(norm));
    const want = process.argv[2].split(" ");
    const miss = want.filter((w) => !have.has(w));
    if (miss.length) { console.log(miss.join("\n")); process.exit(1); }
  ' "$PKG" "$PAYLOAD_TOP" 2>&1)" || {
    echo "DRIFT: packages/getff/package.json \`files\` does not list these payload roots:" >&2
    # shellcheck disable=SC2086  # one line per missing root
    printf '  %s\n' $missing >&2
    return 1
  }
}

MODE="${1:-build}"
case "$MODE" in
  --check)
    [ -f "$MANIFEST" ] || fail "DRIFT: $MANIFEST missing — run: scripts/build-getff-dist.sh"
    files_check || exit 1
    tmp="$(mktemp -d "${TMPDIR:-/tmp}/getff-dist-check.XXXXXX")"
    trap 'rm -rf "$tmp"' EXIT
    assemble "$tmp"
    manifest "$tmp" > "$tmp.manifest"
    if ! diff -q "$MANIFEST" "$tmp.manifest" >/dev/null 2>&1; then
      echo "DRIFT: packages/getff/MANIFEST.sha256 differs from a fresh assembly of the repo root:" >&2
      diff "$MANIFEST" "$tmp.manifest" | grep -E '^[<>]' | sed -E 's/^< ([0-9a-f]+)  /  committed  /; s/^> ([0-9a-f]+)  /  fresh      /' | head -40 >&2
      echo "       Re-run: scripts/build-getff-dist.sh" >&2
      rm -f "$tmp.manifest"
      exit 1
    fi
    rm -f "$tmp.manifest"
    echo "✓ packages/getff/MANIFEST.sha256 in sync with the repo root ($(wc -l < "$MANIFEST" | tr -d ' ') files); \`files\` covers every payload root"
    ;;
  build)
    files_check || exit 1
    assemble "$PKG"
    manifest "$PKG" > "$MANIFEST"
    echo "✓ assembled packages/getff/ from the repo root — $(wc -l < "$MANIFEST" | tr -d ' ') files in MANIFEST.sha256"
    ;;
  *)
    echo "usage: scripts/build-getff-dist.sh [--check]" >&2
    exit 2
    ;;
esac
