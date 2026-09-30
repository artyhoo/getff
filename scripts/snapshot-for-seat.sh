#!/usr/bin/env bash
# snapshot-for-seat.sh — give a cold seat immutable inputs: files as they are AT one commit.
#
# Usage: bash scripts/snapshot-for-seat.sh [--out <dir>] <commit-ish> <path>...
#
#   <commit-ish>  any ref git resolves to a commit (SHA, branch, origin/staging, tag);
#                 it is resolved ONCE, and only the resolved SHA is used from then on
#   <path>        repo-root-relative path as `git show <sha>:<path>` takes it (leading ./ ok)
#   --out <dir>   where to write (created if missing); default: a fresh mktemp -d dir
#
# Contract:
#   stdout : line 1 `Inputs-ref: <full-sha>` (paste into the dispatch template's field),
#            then one absolute snapshot path per line, in argument order
#   files  : <path with / → __, extension kept>@<sha12>[.ext], mode 0444
#            e.g. docs/spec/d28.md @ 454a… → docs__spec__d28@454a1b2c3d4e.md
#   exit   : 0 = every path written ; 1 = unresolvable ref or a path absent at the SHA
#            (checked for ALL paths before anything is written) ; 2 = usage error
#
# Why: a live worktree path is not pinned by any SHA named in a prompt — a sibling session's
# commit or checkout changes the bytes while the seat reads them, silently (incident
# 2026-09-13). The SHA in the file name makes the provenance of every `path:NN` the seat
# quotes visible. Rule: .claude/rules/cold-seat-economy.md §7.
#
# bash 3.2 compatible (macOS system bash): no mapfile, no associative arrays.

set -euo pipefail

usage() {
  echo "usage: snapshot-for-seat.sh [--out <dir>] <commit-ish> <path>..." >&2
  exit 2
}

out_dir=""
if [ "${1:-}" = "--out" ]; then
  [ "$#" -ge 2 ] || usage
  out_dir="$2"
  shift 2
fi
[ "$#" -ge 2 ] || usage

ref="$1"
shift

if ! sha="$(git rev-parse --verify --quiet "${ref}^{commit}")"; then
  echo "snapshot-for-seat: cannot resolve '${ref}' to a commit" >&2
  exit 1
fi
short="${sha:0:12}"

# Validate every path before writing any file: a partial snapshot set is a seat reading
# some inputs pinned and others missing, which is worse than a loud refusal.
missing=0
for p in "$@"; do
  p="${p#./}"
  if ! git cat-file -e "${sha}:${p}" 2>/dev/null; then
    echo "snapshot-for-seat: '${p}' does not exist at ${short}" >&2
    missing=1
  fi
done
[ "$missing" -eq 0 ] || exit 1

if [ -z "$out_dir" ]; then
  out_dir="$(mktemp -d "${TMPDIR:-/tmp}/seat-snapshot.XXXXXX")"
else
  mkdir -p "$out_dir"
fi
out_dir="$(cd "$out_dir" && pwd)"

echo "Inputs-ref: ${sha}"
for p in "$@"; do
  p="${p#./}"
  base="${p##*/}"
  dir=""
  case "$p" in */*) dir="${p%/*}/" ;; esac
  # Extension = the part after the last dot of the basename, unless the dot leads it
  # (.gitignore) or there is none (Makefile).
  case "$base" in
    ?*.*) stem="${base%.*}"; ext=".${base##*.}" ;;
    *) stem="$base"; ext="" ;;
  esac
  flat="$(printf '%s' "${dir}${stem}" | sed 's#/#__#g')"
  target="${out_dir}/${flat}@${short}${ext}"
  # Same path + same SHA = same bytes by construction; replacing is idempotent.
  rm -f "$target"
  git cat-file blob "${sha}:${p}" > "$target"
  chmod 0444 "$target"
  echo "$target"
done
