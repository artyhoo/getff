#!/usr/bin/env bash
# build-synth-bundle.sh — Bundle synth-and-wire.ts into a zero-runtime-dep .mjs (#755).
#
# Precompiles packages/core/install/synth-and-wire.ts + its transitive deps
# (ajv, semver) into a single self-contained .mjs that 99-finalize.sh runs via
# plain `node` — no tsx, no consumer dev-deps required.
#
# Usage:
#   scripts/build-synth-bundle.sh           # (re)generate committed bundle
#   scripts/build-synth-bundle.sh --check   # drift gate: fail if committed != fresh build
#
# The --check mode is the CI-runnable drift guard ("documents lie; tests don't")
# that keeps the committed .mjs in sync with its .ts source.
set -euo pipefail

# Runnable from ANY working directory. Two independent things had to be pinned for that:
#
#   1. WHICH repo. `git rev-parse --show-toplevel` answers about the CALLER's cwd, so invoking
#      this script by absolute path from inside a different checkout silently built THAT repo's
#      tree — or died outright outside a repo. The script's own location is the only honest
#      answer to "which repo do I belong to", so the root is derived from it.
#   2. WHERE it runs. esbuild embeds each bundled file's path RELATIVE TO CWD as a `// path`
#      comment, and only the node_modules ones are normalised below. Built from any other
#      directory, every first-party comment became a machine-specific traversal
#      (`// ../../../../../../Users/<name>/code/…/synth-and-wire.ts`) — so `--check` reported a
#      phantom DRIFT, and a plain `build` would have committed the operator's home path into a
#      shipped artefact. `cd "$ROOT"` makes those comments repo-relative and cwd-independent.
#
# Regression-tested by scripts/build-synth-bundle.test.sh (same invocation from two different
# working directories must produce identical output and exit code).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$ROOT" || { echo "ERROR: cannot enter repo root $ROOT" >&2; exit 2; }

ESBUILD="$ROOT/node_modules/.bin/esbuild"
ENTRY="$ROOT/packages/core/install/synth-and-wire.ts"
OUTFILE="$ROOT/packages/core/install/synth-and-wire.bundle.mjs"

# Require esbuild — pinned at root devDependencies per ci-tool-pinning.md
if [ ! -x "$ESBUILD" ]; then
  echo "ERROR: esbuild not found at $ESBUILD — run 'NODE_ENV=development npm install --include=dev' at repo root first." >&2
  exit 2
fi

# Preflight: refuse to build or drift-check while the bundle's inlined dependencies are
# ambiguous. esbuild resolves them by walking up from packages/core/install, so a nested
# `npm ci --prefix packages/core` (the standard opening line of a kickoff `host-verify`
# contract) can put a different version in front of the one CI resolves — and this gate then
# reports `DRIFT` on a branch that never touched a synth file. That phantom has fired four
# times (2026-07-02 ×2, 2026-07-21, 2026-08-06); the guard names the real disagreement instead.
# Its ✓ line goes to stdout (suppressed — this script's stdout is the build's), its diagnosis
# to stderr (passed through verbatim).
PARITY="$ROOT/scripts/check-bundle-dep-parity.sh"
if [ -f "$PARITY" ]; then
  bash "$PARITY" "$ROOT" >/dev/null || exit 1
fi

# Load-bearing banner: defines a real `require` so ajv (CJS) bundled into ESM
# output does not crash with "Dynamic require of X is not supported" (esbuild#1921).
BANNER="import{createRequire as ___cr}from'node:module';const require=___cr(import.meta.url);"

_build() {
  local outfile="$1"
  "$ESBUILD" "$ENTRY" \
    --bundle \
    --platform=node \
    --format=esm \
    --target=node20 \
    --packages=bundle \
    --external:ts-morph \
    --banner:js="$BANNER" \
    --outfile="$outfile" 2>&1
  # Normalize env-specific node_modules resolve paths that esbuild embeds as
  # module-map keys + comments (e.g. `packages/core/node_modules/semver` under a
  # workspace install vs `node_modules/semver` under root-hoist). Without this the
  # committed bundle is NOT byte-reproducible across npm layouts and the --check
  # drift-gate fails environment-dependently (CI hoists differently than a local
  # workspace install). These embedded paths are inert in the inlined output
  # (everything is bundled; the keys are not used for runtime resolution), so
  # collapsing the prefix is safe. Portable (.bak + rm) for BSD (macOS) + GNU (CI).
  sed -i.bak -E 's#(["(/[:space:]]|^)([A-Za-z0-9_.-]+/)*node_modules/#\1node_modules/#g' "$outfile" && rm -f "$outfile.bak"
}

MODE="${1:-build}"

if [ "$MODE" = "--check" ]; then
  if [ ! -f "$OUTFILE" ]; then
    echo "DRIFT: committed bundle missing — run: scripts/build-synth-bundle.sh" >&2
    exit 1
  fi
  tmp="$(mktemp)"
  trap 'rm -f "$tmp"' EXIT
  _build "$tmp" >/dev/null
  if ! diff -q "$OUTFILE" "$tmp" >/dev/null 2>&1; then
    echo "DRIFT: synth-and-wire.bundle.mjs differs from a fresh build of synth-and-wire.ts" >&2
    echo "       Re-run: scripts/build-synth-bundle.sh" >&2
    exit 1
  fi
  echo "✓ synth-and-wire.bundle.mjs in sync with synth-and-wire.ts"
  exit 0
fi

# build mode: (re)generate committed bundle in place
_build "$OUTFILE" >/dev/null
echo "✓ built packages/core/install/synth-and-wire.bundle.mjs (zero-runtime-dep; consumer needs only plain node)"
