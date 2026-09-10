#!/usr/bin/env bash
# register-root-resolution.test.sh — the registration scripts must resolve THIS checkout
# from their own location, from any working directory.
#
# Both `scripts/register-precompact-hook.sh` and `scripts/register-handoff-gate.sh` write
# `.claude/settings.json`. Until 2026-09-09 they located the repo as
# `git rev-parse --show-toplevel` of the CURRENT DIRECTORY, which fails two ways:
#   • run from outside any git repo → the script refuses to run at all;
#   • run from a DIFFERENT checkout or worktree of this project → every precondition is
#     satisfied by that tree, so the script silently arms the WRONG settings.json.
# The second is the dangerous one, and it is the paired negative below (case 5): a scratch
# git repo is created, the script is invoked from inside it by absolute path, and the
# resolved root must still be the checkout the script itself lives in.
#
# The scripts expose `--print-root` for exactly this: it runs the real resolver and exits
# before any write, so the resolution is testable without performing a settings edit.
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
SCRIPTS=("$DIR/register-precompact-hook.sh" "$DIR/register-handoff-gate.sh")
FAILED=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# A scratch git repo must not leak this repo's git environment into the child process.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE 2>/dev/null || true

check() { # check <label> <expected> <actual>
  if [[ "$2" == "$3" ]]; then
    echo "ok   $1"
  else
    echo "FAIL $1"
    echo "       expected: $2"
    echo "       actual:   $3"
    FAILED=1
  fi
}

for s in "${SCRIPTS[@]}"; do
  name="$(basename "$s")"

  [[ -x "$s" ]] || { echo "FAIL $name: not executable"; FAILED=1; }

  # 1 — from the repo root (the historical happy path must keep working)
  got="$(cd "$ROOT" && bash "$s" --print-root 2>&1)"
  check "$name: from repo root" "$ROOT" "$got"

  # 2 — from a directory outside any checkout of this project, invoked by absolute path.
  #     This is the plain "run it from anywhere" case.
  got="$(cd "$TMP" && bash "$s" --print-root 2>&1)"
  check "$name: from an unrelated cwd" "$ROOT" "$got"

  # 3 — through a symlink placed elsewhere. macOS has no `readlink -f`, so the scripts
  #     unwind the link by hand; this case is what pins that loop.
  ln -sf "$s" "$TMP/link-$name"
  got="$(cd / && bash "$TMP/link-$name" --print-root 2>&1)"
  check "$name: through a symlink" "$ROOT" "$got"

  # 4 — an explicit path argument still wins over self-location.
  got="$(cd "$ROOT" && bash "$s" "$TMP" --print-root 2>&1)"
  check "$name: explicit argument wins" "$TMP" "$got"

  # 5 — PAIRED NEGATIVE: inside a *different* git repo, the git toplevel is that scratch
  #     repo. The old resolver returned it and would have armed it. The new one must not.
  other="$TMP/other-repo"
  mkdir -p "$other"
  git -C "$other" init -q 2>/dev/null
  got="$(cd "$other" && bash "$s" --print-root 2>&1)"
  check "$name: does NOT follow a foreign git toplevel" "$ROOT" "$got"
  if [[ "$got" == "$other" ]]; then
    echo "       ^ this is the exact defect the change fixes — the wrong settings.json"
  fi
done

if [[ $FAILED -eq 0 ]]; then
  echo "PASS — both registration scripts resolve their own checkout from any cwd."
else
  echo "FAILED"
fi
exit $FAILED
