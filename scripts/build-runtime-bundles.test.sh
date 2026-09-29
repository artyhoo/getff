#!/usr/bin/env bash
# build-runtime-bundles.test.sh — the runtime-bundle build is cwd-independent, machine-independent,
# and its drift gate really fires.
#
# scripts/build-runtime-bundles.mjs commits two prebuilt bundles a consumer runs on plain node:
# packages/core/hooks/pre-push.bundle.mjs and packages/core/install/rule-bootstrap-cli.bundle.mjs.
# Three properties keep that honest, one arm each:
#   (1) `--check` answers the same from the repo root and from a directory outside any git repo —
#       esbuild writes `// path` comments relative to its working directory, so a cwd leak shows
#       up as a phantom drift (the build-synth-bundle.test.sh incident class);
#   (2) no committed bundle carries a path of the machine that built it (an absolute or
#       traversal file comment, or a home directory anywhere in the text);
#   (3) paired negative: a hand-edited committed bundle turns `--check` RED with a DRIFT line —
#       arm (1) passing on an always-green gate would prove nothing.
#
# Needs the repo's dev dependencies (esbuild): run after `NODE_ENV=development npm install`.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT="$(cd "$DIR/.." && pwd -P)"
SCRIPT="$DIR/build-runtime-bundles.mjs"
BUNDLES=(
  packages/core/hooks/pre-push.bundle.mjs
  packages/core/install/rule-bootstrap-cli.bundle.mjs
)
FAILED=0

FOREIGN="$(mktemp -d)"
BACKUP="$(mktemp -d)"
# shellcheck disable=SC2329  # invoked via the EXIT trap below
restore() {
  # Arm (3) edits a committed bundle; put the original bytes back on any exit.
  for b in "${BUNDLES[@]}"; do
    [ -f "$BACKUP/$(basename "$b")" ] && cp "$BACKUP/$(basename "$b")" "$ROOT/$b"
  done
  rm -rf "$FOREIGN" "$BACKUP"
}
trap restore EXIT INT TERM

if git -C "$FOREIGN" rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "FAIL: fixture dir $FOREIGN is inside a git repo — the cwd-independence arm needs a non-repo cwd"
  exit 1
fi

# ── (1) cwd-independence ────────────────────────────────────────────────────────────────────
out_root="$(cd "$ROOT" && node "$SCRIPT" --check 2>&1)"; rc_root=$?
out_foreign="$(cd "$FOREIGN" && node "$SCRIPT" --check 2>&1)"; rc_foreign=$?
if [ "$rc_root" -ne 0 ]; then
  echo "FAIL: baseline --check from the repo root exited $rc_root (expected 0)."
  echo "      Rebuild (node scripts/build-runtime-bundles.mjs) or install deps (NODE_ENV=development npm install)."
  # shellcheck disable=SC2001  # sed prefixes EVERY line of a multi-line string
  echo "$out_root" | sed 's/^/      /'
  FAILED=1
fi
if [ "$rc_foreign" -ne "$rc_root" ] || [ "$out_foreign" != "$out_root" ]; then
  echo "FAIL: --check depends on cwd — exit $rc_root from the repo root, $rc_foreign from $FOREIGN:"
  diff <(printf '%s\n' "$out_root") <(printf '%s\n' "$out_foreign") | sed 's/^/      /'
  FAILED=1
else
  echo "ok: --check is identical from the repo root and from a non-repo cwd (exit $rc_root)"
fi

# ── (2) no build-machine paths ──────────────────────────────────────────────────────────────
for b in "${BUNDLES[@]}"; do
  if grep -nE '^\s*//\s*(/|\.\./)' "$ROOT/$b" >/dev/null 2>&1 \
    || grep -nE '/(Users|home)/[A-Za-z0-9._-]+/' "$ROOT/$b" >/dev/null 2>&1; then
    echo "FAIL: $b carries a path of the machine that built it:"
    { grep -nE '^\s*//\s*(/|\.\./)' "$ROOT/$b"; grep -nE '/(Users|home)/[A-Za-z0-9._-]+/' "$ROOT/$b"; } \
      | head -5 | cut -c1-160 | sed 's/^/      /'
    FAILED=1
  else
    echo "ok: $b carries no build-machine path"
  fi
done

# ── (3) paired negative: the drift gate fires on a hand edit ────────────────────────────────
for b in "${BUNDLES[@]}"; do
  cp "$ROOT/$b" "$BACKUP/$(basename "$b")"
  printf '\n// hand edit\n' >>"$ROOT/$b"
  out_neg="$(cd "$ROOT" && node "$SCRIPT" --check 2>&1)"; rc_neg=$?
  cp "$BACKUP/$(basename "$b")" "$ROOT/$b"
  if [ "$rc_neg" -ne 0 ] && grep -q "DRIFT: $b" <<<"$out_neg"; then
    echo "ok: a hand-edited $b turns --check RED (exit $rc_neg)"
  else
    echo "FAIL: a hand-edited $b did not turn --check RED (exit $rc_neg):"
    # shellcheck disable=SC2001  # sed prefixes EVERY line of a multi-line string
    echo "$out_neg" | sed 's/^/      /'
    FAILED=1
  fi
done

[ "$FAILED" -eq 0 ] && echo 'PASS' && exit 0
echo 'FAILED'
exit 1
