#!/usr/bin/env bash
# apply-husky-patch.sh — apply a prepared patch to a .husky/** hook through the sanctioned channel.
#
# WHY THIS EXISTS. .claude/settings.json denies agents Edit/Write(.husky/**), and the user-level
# git-safety tripwire (part 1d) reverts any Bash write to protected paths unless the Bash command
# itself carries GIT_SAFETY_OVERRIDE="<literal, >=20 chars, no $>". Measured 2026-10-06
# (citation-drift repair): three independent layers blocked an agent — settings deny, tripwire
# revert, auto-mode classifier refusing the override invocation. This script is the
# maintainer-sanctioned-script escape the tripwire's block message names, made agent-runnable:
# agents PREPARE (patch + byte-exact expected file, suite-tested together), the operator approves
# the channel ONCE (the gate hook + allow rule committed to project .claude/settings.json), and
# every application is (a) check-applied before any write, (b) byte-compared against the tested
# expected file, (c) refused for targets outside .husky/ and outside this repo family,
# (d) logged to the git-safety tamper.log. Precedent (operator-runs-it-by-hand variant):
# scripts/apply-getff-manifest-staged-precommit.sh.
#
# Canonical invocations — the gate hook (.claude/hooks/apply-husky-patch-gate.sh) and the allow
# rule approve EXACTLY these shapes, nothing else:
#   bash "$CLAUDE_PROJECT_DIR/scripts/apply-husky-patch.sh" --dry-run --patch <p> --expected <e>
#   GIT_SAFETY_OVERRIDE='<CANONICAL_OVERRIDE>' bash "$CLAUDE_PROJECT_DIR/scripts/apply-husky-patch.sh" --apply --patch <p> --expected <e>
# (--target defaults to .husky/pre-commit; --repo overrides cwd discovery.)
#
# The file is intentionally generic: each future protected-hook change ships its own patch +
# expected pair (prepared by the agent PR), and this script stays the only thing that writes.
#
# Bash 3.2-compatible (macOS stock /bin/bash), no tool installs (ci-tool-pinning population 2).
set -euo pipefail

CANONICAL_OVERRIDE='apply-husky-patch sanctioned channel (operator-approved 2026-10-06)'
DEFAULT_TARGET='.husky/pre-commit'
GS_BASE="${GIT_SAFETY_COORD_DIR:-$HOME/.claude-coordination/git-safety}"

fail() { echo "ERROR: $*" >&2; exit 1; }

usage() {
  cat >&2 <<'USAGE'
usage: apply-husky-patch.sh [--dry-run|--apply] --patch <file> --expected <file> [--target <repo-rel-path>] [--repo <dir>]
  --patch     prepared unified diff (required)
  --expected  byte-exact tested result file; the applied hook is cmp'd against it (required)
  --target    repo-relative path under .husky/ (default: .husky/pre-commit)
  --repo      repo/worktree root (default: discovered from cwd via git rev-parse --show-toplevel)
Default mode is --dry-run: proves the hunks apply and the result is byte-identical to --expected,
without writing. --apply performs the write and re-verifies the bytes on disk.
USAGE
  exit 2
}

sha_of() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    fail "no shasum or sha256sum on PATH"
  fi
}

MODE="dry-run"
PATCH=""; EXPECTED=""; TARGET="$DEFAULT_TARGET"; REPO_ARG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) MODE="dry-run" ;;
    --apply)   MODE="apply" ;;
    --patch)    [ $# -ge 2 ] || usage; PATCH="$2";    shift ;;
    --expected) [ $# -ge 2 ] || usage; EXPECTED="$2"; shift ;;
    --target)   [ $# -ge 2 ] || usage; TARGET="$2";   shift ;;
    --repo)     [ $# -ge 2 ] || usage; REPO_ARG="$2"; shift ;;
    -h|--help) usage ;;
    *) fail "unknown argument: $1 (see --help)" ;;
  esac
  shift
done

# ── resolve repo root ────────────────────────────────────────────────────────
if [ -n "$REPO_ARG" ]; then
  REPO_ROOT="$(cd "$REPO_ARG" 2>/dev/null && pwd -P)" || fail "--repo is not a directory: $REPO_ARG"
else
  REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" \
    || fail "not inside a git repository — run from the repo/worktree root or pass --repo <dir>"
  REPO_ROOT="$(cd "$REPO_ROOT" && pwd -P)"
fi

# ── repo-family pin: the operator approved this channel for THIS project only ─
# D2068-S01: a substring match accepted suffix repositories (artyhoo/getff-experiment),
# foreign hosts and embedded paths (…/unrelated/artyhoo/getff). The pin is an EXACT
# host+repo match on the canonical URL spellings (+ the same-git-common-dir fallback
# for local worktrees of the authoring checkout).
repo_pin_ok=""
repo_url="$(git -C "$REPO_ROOT" config --get remote.origin.url 2>/dev/null || true)"
case "$repo_url" in
  *.git) repo_url="${repo_url%.git}" ;;
esac
case "$repo_url" in
  https://github.com/artyhoo/getff|git@github.com:artyhoo/getff|ssh://git@github.com/artyhoo/getff) repo_pin_ok="remote" ;;
esac
if [ -z "$repo_pin_ok" ]; then
  common_dir_of() {
    local d
    d="$(git -C "$1" rev-parse --git-common-dir 2>/dev/null)" || return 1
    case "$d" in /*) ;; *) d="$1/$d" ;; esac
    ( cd "$d" 2>/dev/null && pwd -P )
  }
  here_common="$(common_dir_of "$REPO_ROOT" || true)"
  main_common="$(common_dir_of "$HOME/code/rules-as-tests-aif" || true)"
  if [ -n "$here_common" ] && [ -n "$main_common" ] && [ "$here_common" = "$main_common" ]; then
    repo_pin_ok="common-dir"
  fi
fi
[ -n "$repo_pin_ok" ] \
  || fail "repo pin failed: $REPO_ROOT is not the rules-as-tests-aif family (origin=$repo_url) — the approved channel does not extend to other repos"

# ── target validation: repo-relative, under .husky/, no symlink escapes ──────
case "$TARGET" in
  .husky/*) ;;
  *) fail "target must be a repo-relative path under .husky/ (got: $TARGET)" ;;
esac
case "$TARGET" in
  .husky/_|".husky/_/"*|*..*) fail "refusing target $TARGET: the generated husky shim (.husky/_) and parent traversals are not patchable here" ;;
esac
TFULL="$REPO_ROOT/$TARGET"
tdir="$(dirname "$TFULL")"
[ -d "$tdir" ] || fail "target directory does not exist: $tdir"
rdir="$(cd "$tdir" && pwd -P)"
case "$rdir" in
  "$REPO_ROOT/.husky"|"$REPO_ROOT/.husky/"*) ;;
  *) fail "target resolves outside .husky/ ($rdir)" ;;
esac
[ ! -L "$TFULL" ] || fail "target is a symlink: $TFULL"
[ -f "$TFULL" ] || fail "target file does not exist: $TARGET (this channel patches existing hooks; creating a new hook file is a maintainer step)"

# ── inputs ───────────────────────────────────────────────────────────────────
for f in "$PATCH" "$EXPECTED"; do
  [ -f "$f" ] || fail "missing: $f"
done
PATCH_ABS="$(cd "$(dirname "$PATCH")" && pwd -P)/$(basename "$PATCH")"
EXPECTED_ABS="$(cd "$(dirname "$EXPECTED")" && pwd -P)/$(basename "$EXPECTED")"

# ── override contract (apply mode): fail EARLY, never let the tripwire revert ─
if [ "$MODE" = "apply" ]; then
  if [ "${GIT_SAFETY_OVERRIDE:-}" != "$CANONICAL_OVERRIDE" ]; then
    cat >&2 <<ERR
ERROR: refusing --apply: the git-safety tripwire (part 1d) reverts any Bash write to .husky/**
unless the Bash command itself carries the sanctioned literal — env vars set inside this script do
NOT count (the tripwire reads the command text). Re-invoke with the exact prefix:
  GIT_SAFETY_OVERRIDE='$CANONICAL_OVERRIDE' bash "\$CLAUDE_PROJECT_DIR/scripts/apply-husky-patch.sh" --apply --patch <p> --expected <e>
ERR
    exit 2
  fi
fi

# ── idempotence ──────────────────────────────────────────────────────────────
if cmp -s "$TFULL" "$EXPECTED_ABS"; then
  echo "already applied: $TARGET is byte-identical to $(basename "$EXPECTED_ABS") — nothing to do"
  exit 0
fi

# ── check-apply before any write (GNU --dry-run, BSD -C) ─────────────────────
check_flag=""
if patch --dry-run "$TFULL" "$PATCH_ABS" >/dev/null 2>&1; then
  check_flag="--dry-run"
elif patch -C "$TFULL" "$PATCH_ABS" >/dev/null 2>&1; then
  check_flag="-C"
else
  fail "patch does not apply cleanly to $TARGET — the hook moved on since the patch was prepared; re-prepare patch+expected together"
fi

# ── byte-verify: apply to a scratch copy, cmp against the tested bytes ───────
tmp="$(mktemp "${TMPDIR:-/tmp}/apply-husky-patch.XXXXXX")"
# bash32-safe: single fixed trap var, always set before any exit path below
trap 'rm -f "$tmp" "$tmp.gsorig"' EXIT
cp -p "$TFULL" "$tmp"
patch --quiet --backup --suffix .gsorig "$tmp" "$PATCH_ABS" >/dev/null 2>&1 \
  || patch -s -b -z .gsorig "$tmp" "$PATCH_ABS" >/dev/null 2>&1 \
  || fail "patch failed on a scratch copy of $TARGET (unexpected after a clean check-apply)"
rm -f "$tmp.gsorig" "$tmp.orig"
cmp -s "$tmp" "$EXPECTED_ABS" \
  || fail "drift: applying the patch to the current $TARGET does NOT reproduce the tested expected bytes ($(basename "$EXPECTED_ABS")) — re-prepare the pair"
bash -n "$tmp" 2>/dev/null || fail "patched $TARGET has a bash syntax error — refusing"
rsha="$(sha_of "$tmp")"

if [ "$MODE" = "dry-run" ]; then
  echo "DRY-RUN OK: hunks apply cleanly to $TARGET (check flag: $check_flag)"
  echo "DRY-RUN OK: result is byte-identical to the tested $(basename "$EXPECTED_ABS")"
  echo "DRY-RUN OK: bash -n clean; result sha256=$rsha"
  exit 0
fi

# ── the write: the verified bytes, and only those bytes, land ────────────────
cat "$tmp" > "$TFULL"
cmp -s "$TFULL" "$EXPECTED_ABS" || fail "post-write verification FAILED: $TARGET on disk differs from the tested bytes — inspect manually, do not re-run blindly"
bash -n "$TFULL" >/dev/null 2>&1 || fail "post-write bash -n FAILED on $TARGET"
echo "APPLIED: $TARGET sha256=$rsha (byte-identical to the tested $(basename "$EXPECTED_ABS"))"

# ── audit: one structured line in the git-safety tamper.log ──────────────────
mkdir -p "$GS_BASE" 2>/dev/null || true
{
  printf '%s APPLY-HUSKY-PATCH | repo=%s | target=%s | patch=%s | expected_sha=%s | applied_sha=%s | override=canonical | mode=apply\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$REPO_ROOT" "$TARGET" "$PATCH_ABS" "$(sha_of "$EXPECTED_ABS")" "$rsha"
} >> "$GS_BASE/tamper.log" 2>/dev/null || echo "warning: could not append to $GS_BASE/tamper.log" >&2
