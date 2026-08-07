#!/usr/bin/env bash
# check-lintstaged-resolves.sh — cih-s3 F14 verify-gate (lint-staged binary resolution).
#
# THE BUG: a SINGLE root .lintstagedrc.json makes lint-staged run every command from the
# git-root (cwd = root). In a pnpm (isolated-node_modules) monorepo the per-package `eslint`
# binary lives in `<pkg>/node_modules/.bin`, NOT the root `.bin` → lint-staged emits
# `✖ eslint ENOENT` and BLOCKS the commit. (`prettier`/`sort-package-json` survive only
# because install adds them to the consumer ROOT package.json → root `.bin`.) S1/F2 made the
# hook live, which unmasked this. The M3 fix drops a per-package .lintstagedrc.json stub so
# lint-staged runs with cwd = that package and resolves the local binary. THIS gate is the
# alarm: it fails BEFORE the consumer's first blocked commit if a config's command would run
# (its glob matches a file the config actually governs) but its binary can't resolve.
#
# lint-staged uses the NEAREST config to each staged file. So a config governs only files in
# its subtree that are NOT inside a deeper directory with its own .lintstagedrc.json. A root
# config in a pure monorepo (code only in packages, each with a stub) governs nothing → no
# alarm. Resolution mirrors lint-staged: walk node_modules/.bin from the config's cwd up, then
# global PATH.
#
# Runs post-install (needs node_modules to judge resolution). No node_modules anywhere → deps
# not installed → skip. No node → skip (a TS consumer always has it; never false-fail).
#
# Exit: 0 = every command that would actually run resolves its binary (or skipped);
#       1 = a governing config's command binary won't resolve (ENOENT-before-commit alarm).
set -uo pipefail

# Existence guard (NOT a walker prune — answers ONLY 'is node_modules installed yet?').
# Must NOT be widened to .stryker-tmp / .claude/worktrees: that would suppress the skip on
# repos that have foreign dirs but no installed deps. The paired-negative assertion in
# fixtures/foreign-scan-triage/repro.sh pins this behaviour.
if ! find . -name node_modules -type d -prune -print 2>/dev/null | head -1 | grep -q .; then
  echo "check-lintstaged-resolves: no node_modules yet — run after install (skipped)."
  exit 0
fi
command -v node >/dev/null 2>&1 || { echo "check-lintstaged-resolves: node not found — skipped."; exit 0; }

# All .lintstagedrc.json config dirs (absolute), for shadow computation.
CFG_DIRS=()
while IFS= read -r c; do CFG_DIRS+=("$(cd "$(dirname "$c")" && pwd)"); done \
  < <(find . \( -name node_modules -o -name .git -o -name .stryker-tmp -o -path '*/.claude/worktrees' \) -prune -o -name '.lintstagedrc.json' -print 2>/dev/null)

resolves() { # $1 = binary, $2 = start dir
  local dir="$2"
  while :; do
    [ -x "$dir/node_modules/.bin/$1" ] && return 0
    [ "$dir" = "/" ] && break
    dir=$(dirname "$dir")
  done
  command -v "$1" >/dev/null 2>&1
}

# First governed file matching a brace/literal glob under a config dir (minus shadowed + deps).
# Uses quoted find-arg ARRAYS so name patterns never glob-expand in cwd and IFS never leaks.
governs_match() { # $1 = config dir, $2 = glob (e.g. *.{ts,tsx} or package.json)
  local d="$1" g="$2" cd2 e exts oldifs
  local pruneargs=() nameargs=()
  for cd2 in "${CFG_DIRS[@]}"; do
    case "$cd2" in
      "$d") ;;                                   # itself
      "$d"/*) pruneargs+=( -o -path "$cd2/*" -prune ) ;;   # strict descendant → shadowed
    esac
  done
  case "$g" in
    *.\{*\}*) exts="${g#*\{}"; exts="${exts%\}*}"          # *.{ts,tsx} → ts,tsx
              oldifs="$IFS"; IFS=','
              for e in $exts; do nameargs+=( -o -name "*.$e" ); done
              IFS="$oldifs"
              nameargs=( "${nameargs[@]:1}" ) ;;           # drop leading -o
    *)        nameargs=( -name "$g" ) ;;                   # *.ext or literal (package.json)
  esac
  find "$d" \( -name node_modules -o -name .git -o -name .stryker-tmp -o -path '*/.claude/worktrees' \) -prune \
    ${pruneargs[@]+"${pruneargs[@]}"} \
    -o -type f '(' "${nameargs[@]}" ')' -print 2>/dev/null | head -1
}

FAIL=0
echo "▶ check-lintstaged-resolves: verifying lint-staged command binaries resolve"
for cfgdir in "${CFG_DIRS[@]}"; do
  cfg="$cfgdir/.lintstagedrc.json"
  rel="${cfg#"$PWD"/}"
  # node emits `<glob>\t<binary>` per command.
  pairs=$(AIF_LSRC="$cfg" node -e '
    const fs=require("fs");
    let j; try { j=JSON.parse(fs.readFileSync(process.env.AIF_LSRC,"utf8")); } catch { process.exit(0); }
    for (const [glob,v] of Object.entries(j)) {
      const cmds=Array.isArray(v)?v:[v];
      for (const c of cmds) { const b=String(c).trim().split(/\s+/)[0]; if (b && !b.startsWith("(")) console.log(glob+"\t"+b); }
    }
  ' 2>/dev/null)
  [ -z "$pairs" ] && continue
  while IFS=$'\t' read -r glob bin; do
    [ -n "$glob" ] || continue
    [ -n "$(governs_match "$cfgdir" "$glob")" ] || continue   # this command would never run here
    if resolves "$bin" "$cfgdir"; then
      echo "  ✓ $rel: '$bin' (for $glob) resolves"
    else
      echo "  ✗ $rel: '$bin' (for $glob) does NOT resolve from cwd '$cfgdir' — lint-staged would ENOENT and block the commit."
      echo "     Fix: add a per-package .lintstagedrc.json beside the package that owns '$bin' (so cwd=that package)."
      FAIL=1
    fi
  done <<EOF
$pairs
EOF
done

[ "$FAIL" -eq 0 ] && echo "check-lintstaged-resolves: OK" || echo "check-lintstaged-resolves: FAILED — a lint-staged binary is unresolvable (commit would be blocked)." >&2
exit "$FAIL"
