#!/usr/bin/env bash
# build-synth-bundle.test.sh — the bundle build must not depend on the caller's cwd.
#
# esbuild embeds each bundled file's path RELATIVE TO CWD as a `// path` comment. Only the
# node_modules ones are normalised by the build script's sed, so before the fix a build started
# from anywhere but the repo root wrote machine-specific traversals for every first-party file
# (`// ../../../../../../Users/<name>/code/…/synth-and-wire.ts`). Two consequences, both silent:
# `--check` reported a PHANTOM drift, and a plain `build` would have committed the operator's
# home directory path into a shipped artefact.
#
# The invariant under test is cwd-independence, so the assertion is equality between two runs of
# the SAME command from two different directories — one of them deliberately outside any git
# repository, which is also where the old `git rev-parse --show-toplevel` root derivation died.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT="$(cd "$DIR/.." && pwd -P)"
SCRIPT="$DIR/build-synth-bundle.sh"
FAILED=0

FOREIGN="$(mktemp -d)"
trap 'rm -rf "$FOREIGN"' EXIT

# Sanity: the foreign directory must really be outside a git repo, or the test proves nothing
# about the root-derivation half.
if git -C "$FOREIGN" rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "FAIL: fixture dir $FOREIGN is inside a git repo — the cwd-independence test needs a non-repo cwd"
  exit 1
fi

out_root="$(cd "$ROOT" && NODE_ENV=development bash "$SCRIPT" --check 2>&1)"; rc_root=$?
out_foreign="$(cd "$FOREIGN" && NODE_ENV=development bash "$SCRIPT" --check 2>&1)"; rc_foreign=$?

# The drift gate itself must be green here, otherwise "identical" would only prove the script is
# consistently broken. This test runs where the deps are installed (audit-self install-sh-a job,
# after its root `npm install`); a red here means the tree is not installed, not that cwd leaked.
if [ "$rc_root" -ne 0 ]; then
  echo "FAIL: baseline --check from the repo root exited $rc_root (expected 0)."
  echo "      Install deps first: NODE_ENV=development npm install"
  echo "$out_root" | sed 's/^/      /'
  FAILED=1
fi

if [ "$rc_foreign" -ne "$rc_root" ]; then
  echo "FAIL: exit code depends on cwd — $rc_root from repo root, $rc_foreign from $FOREIGN"
  echo "$out_foreign" | sed 's/^/      /'
  FAILED=1
elif [ "$out_foreign" != "$out_root" ]; then
  echo "FAIL: output depends on cwd. From repo root vs from $FOREIGN:"
  diff <(printf '%s\n' "$out_root") <(printf '%s\n' "$out_foreign") | sed 's/^/      /'
  FAILED=1
else
  echo "ok: --check is identical from the repo root and from a non-repo cwd (exit $rc_root)"
fi

# The committed bundle must carry repo-relative first-party comments, never an absolute or
# traversal path — the observable tell of a build that ran from the wrong directory.
BUNDLE="$ROOT/packages/core/install/synth-and-wire.bundle.mjs"
if grep -nE '^\s*//\s*(/|\.\./)' "$BUNDLE" >/dev/null 2>&1; then
  echo "FAIL: committed bundle carries non-repo-relative file comments:"
  grep -nE '^\s*//\s*(/|\.\./)' "$BUNDLE" | head -5 | sed 's/^/      /'
  FAILED=1
else
  echo 'ok: committed bundle carries only repo-relative first-party file comments'
fi

[ "$FAILED" -eq 0 ] && echo 'PASS' && exit 0
echo 'FAILED'
exit 1
