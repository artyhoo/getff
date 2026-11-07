#!/usr/bin/env bash
# .husky/pre-push — TS-core dispatcher (shipped by install.sh via husky-pre-push.sh).
#
# Runtime feature detection, NOT install-time (dual-implementation-discipline.md §3):
# checks at every push whether Node ≥20 is available, routes accordingly.
#
# Capability-check, NOT brand-name detection (dual-implementation-discipline.md §4 / §8):
# gates on `command -v node` + major-version, never on a harness brand string.
#
# Routes:
#   Node ≥20 + pre-push.bundle.mjs present → TS-core hook (full checks: §7 substance, §1.7 substance, etc.)
#   Otherwise                               → bash critical-only fallback (§7/§1.7 presence only)
#
# The TS-core hook ships as ONE prebuilt, dependency-free .mjs (scripts/build-runtime-bundles.mjs),
# so plain `node` runs it: no tsx, no TypeScript sources in the project for its own eslint/tsc to
# check, and nothing to resolve from node_modules. Both hooks are installed by install.sh alongside
# this file. See packages/core/hooks/pre-push.fallback.sh for the fallback's check set.
#
# POSIX-sh safe (no `pipefail`): husky v9 invokes the hook via `sh` on
# Debian/Ubuntu (/bin/sh = dash), which ignores the bash shebang above — a
# bashism like `set -o pipefail` aborts the hook with "Illegal option" and
# hard-blocks every consumer push there. The only pipe below (`node_major`)
# carries its own `|| echo 0` fallback, so `set -eu` is sufficient.
set -eu

REPO_ROOT=$(git rev-parse --show-toplevel)
HOOK="$REPO_ROOT/packages/core/hooks/pre-push.bundle.mjs"
FALLBACK="$REPO_ROOT/packages/core/hooks/pre-push.fallback.sh"

node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }

if command -v node >/dev/null 2>&1 && [ "$(node_major)" -ge 20 ] && [ -f "$HOOK" ]; then
  exec node "$HOOK"
elif [ -x "$FALLBACK" ]; then
  exec bash "$FALLBACK"
else
  echo "⚠ pre-push: Node ≥20 unavailable and bash fallback not present — skipping checks."
  echo "  Install Node ≥20 to enable the full TS-core pre-push hook."
  exit 0
fi
