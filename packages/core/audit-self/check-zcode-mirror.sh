#!/usr/bin/env sh
# check-zcode-mirror.sh — consumer ZCode skill-mirror completeness check (#1502, W2-G).
#
# Verifies that a consumer's `.zcode/skills/` mirror of `.claude/skills/` is complete, by NAME.
# ZCode loads skills from `.zcode/skills/`; a skill present in `.claude/skills/` but missing from
# the mirror silently does not exist for ZCode (the 2026-08-20 timeliner incident: six `.claude/skills`
# entries with no counterpart, plus one dangling `rules-as-tests` link). Mirror CREATION stays
# manual: this check NEVER creates, fixes or deletes a link — each offender line names the command.
#
# Behaviour table (binding, kickoff §1) — verdict is the EXIT CODE, all output on stderr, stdout
# always empty (the ZCode §0.5 stdout contract reserves stdout for strict-JSON hook payloads):
#
#   consumer state                                   output                          exit
#   no .zcode/ at PROJECT_ROOT (CC-only consumer)    one info line                   0
#   .zcode/skills is ONE symlink resolving to
#     .claude/skills (this repo's shape)             one OK line, complete by ctor   0
#   every .claude/skills/<dir> has a .zcode/skills/<dir>
#     counterpart (symlink OR real dir), none dangling one OK line                    0
#   a skill with no counterpart and no exemption     one line PER offender, by name  non-zero
#   a dangling symlink under .zcode/skills/          one line per link, name+target  non-zero
#   exemption whose skill no longer exists (stale)   one line per stale entry        non-zero
#   exemption with no reason or a reason < 20 chars  one line per entry              non-zero
#   .zcode/ exists but .zcode/skills does not        every skill is an offender      non-zero
#
# Coverage is by NAME: a non-dangling entry of the same name (symlink to a directory, or a real
# directory) covers the skill. A dangling link never covers anything and is ONE offender by itself —
# it does not additionally report its own name as missing (timeliner: six missing + one dangling
# = EXACTLY SEVEN offenders; tests/install-sh/check-zcode-mirror.test.sh asserts the exact set).
#
# Exemption file `.ai-factory/zcode-mirror-exemptions.txt`: `<name> <reason>` per line, `#`
# comments and blank lines allowed, reason >= 20 chars (escape-token discipline,
# .claude/rules/ci-tool-pinning.md §3). The installer does NOT create it. An exemption suppresses
# only the missing-counterpart arm — a dangling link is a real defect and is never exempted.
#
# Reads the FILE SYSTEM, not git (`.zcode/` is usually gitignored in consumers). No node, no
# network, pure sh: runs inside the <5 s pre-commit budget (husky-pre-commit.sh:2). POSIX-portable
# (test companion: tests/install-sh/check-zcode-mirror.test.sh; prior art: prior-art-evaluations.md#292).

set -u

# PROJECT_ROOT: the positional arg — both delivered hooks pass "$PWD" (the tree root git runs them
# from) explicitly, and the test passes its fixture, so an AIF_PROJECT_ROOT a hook inherits from the
# environment can never redirect the check to another tree. With no arg (a run by hand):
# AIF_PROJECT_ROOT, then cwd. Root RESOLUTION may consult nothing else — the check reads no git
# state (D3: the mirror is usually gitignored).
ROOT="${1:-${AIF_PROJECT_ROOT:-$(pwd -P)}}"
SRC="$ROOT/.claude/skills"
ZCODE="$ROOT/.zcode"
MIRROR_LINK="$ZCODE/skills"
EXEMPTIONS="$ROOT/.ai-factory/zcode-mirror-exemptions.txt"

say() { printf '%s\n' "$*" >&2; }
fail=0

# ─── No .zcode/ at all: CC-only consumer — nothing to check ──────────────────
if [ ! -e "$ZCODE" ] && [ ! -L "$ZCODE" ]; then
  say "check-zcode-mirror: no .zcode/ directory at $ROOT — Claude-Code-only consumer, nothing to check"
  exit 0
fi

# ─── Resolve the mirror root ──────────────────────────────────────────────────
# cd -P + pwd -P resolves a symlink chain portably (readlink -f is not).
mirror=""
if [ -L "$MIRROR_LINK" ]; then
  mirror=$(cd -P "$MIRROR_LINK" 2>/dev/null && pwd -P) || mirror=""
  if [ -z "$mirror" ]; then
    say "check-zcode-mirror: broken mirror link 'skills' (.zcode/skills -> $(readlink "$MIRROR_LINK" 2>/dev/null || printf '?')): does not resolve to a directory — relink: ln -sfn ../.claude/skills .zcode/skills (or remove .zcode/)"
    exit 1
  fi
  src_resolved=$(cd -P "$SRC" 2>/dev/null && pwd -P) || src_resolved=""
  if [ -n "$src_resolved" ] && [ "$mirror" = "$src_resolved" ]; then
    say "check-zcode-mirror: OK — .zcode/skills resolves to .claude/skills (single-link mirror, complete by construction)"
    exit 0
  fi
elif [ -d "$MIRROR_LINK" ]; then
  mirror=$(cd -P "$MIRROR_LINK" 2>/dev/null && pwd -P) || mirror=""
fi
# mirror="" here means: no usable .zcode/skills (absent, or .zcode is a file) → arm (h) below
# reports every skill as an offender.
#
# Every printed fix command must work when run as printed, from the project root (the test runs
# each one — tests/install-sh/check-zcode-mirror.test.sh arms (v.b) (x.b) (xi.c) (xviii.b)). A
# replacing relink is `ln -sfn`: `-f` replaces the dangling link, `-n` keeps ln from descending
# into a link that resolves to a directory (GNU, BSD and busybox ln all take both). When .zcode/
# is a directory with no skills entry at all, the per-skill `ln -s` needs that directory first.
mk_prefix=""
if [ -z "$mirror" ] && [ -d "$ZCODE" ] && [ ! -e "$MIRROR_LINK" ]; then
  mk_prefix="mkdir -p .zcode/skills && "
fi

# ─── Exemption register: validate every line, collect the valid names ─────────
# One pass: comments/blanks skipped; per line — no reason → offender, reason < 20 chars →
# offender, skill gone from .claude/skills/ (stale) → offender; only fully valid lines exempt.
EXEMPT_LIST=""
if [ -f "$EXEMPTIONS" ]; then
  n=0
  cr=$(printf '\r')
  while IFS= read -r line || [ -n "$line" ]; do
    n=$((n + 1))
    line=${line%"$cr"}                                         # tolerate a CRLF exemption file
    case "$line" in *[!\ \	]*) ;; *) continue ;; esac          # blank / whitespace-only
    stripped=${line#"${line%%[!\ \	]*}"}                       # strip leading whitespace
    case "$stripped" in \#*) continue ;; esac                   # comment
    name=${stripped%%[\ \	]*}
    reason=${stripped#"$name"}
    reason=${reason#"${reason%%[!\ \	]*}"}                     # strip leading whitespace
    reason=${reason%"${reason##*[!\ \	]}"}                     # strip trailing whitespace
    if [ -z "$reason" ]; then
      say "check-zcode-mirror: exemption '$name' (line $n): no reason given — format: <name> <reason>"
      fail=1
      continue
    fi
    if [ "${#reason}" -lt 20 ]; then
      say "check-zcode-mirror: exemption '$name' (line $n): reason under 20 characters — a bare token is not a reason; state why this skill is exempt"
      fail=1
      continue
    fi
    if [ ! -d "$SRC/$name" ]; then
      say "check-zcode-mirror: stale exemption '$name' (line $n): no such skill in .claude/skills/ — remove the line from .ai-factory/zcode-mirror-exemptions.txt"
      fail=1
      continue
    fi
    EXEMPT_LIST="$EXEMPT_LIST$name
"
  done < "$EXEMPTIONS"
fi
is_exempt() { # $1 = skill name → 0 iff a VALID exemption line names it (exact line, no substring)
  printf '%s' "$EXEMPT_LIST" | grep -Fxq -e "$1"   # -e: a skill named like an option («-x») stays a pattern
}

# ─── Missing counterparts (+ arm (h): every skill when the mirror is unusable) ─
if [ -d "$SRC" ]; then
  for d in "$SRC"/*; do
    [ -d "$d" ] || continue                    # only directories are skills (not README.md …)
    s=${d##*/}
    if [ -n "$mirror" ] && { [ -d "$mirror/$s" ] || [ -L "$mirror/$s" ]; }; then
      continue                                 # a counterpart of this name exists: covered (real
    fi                                         # dir / symlink — a dangling link stays covered here
                                               # because the dangling scan reports it; never two
                                               # lines for one entry). A plain FILE is neither a
                                               # dir nor a symlink → reported. A symlink resolving
                                               # to a FILE is a symlink — behaviour-table row (c)
                                               # admits it, so it stays covered (documented edge,
                                               # pinned by test arm (xxi); T19 cold-review m2).
    if is_exempt "$s"; then
      continue
    fi
    say "check-zcode-mirror: missing mirror entry for skill '$s' — fix: ${mk_prefix}ln -s ../../.claude/skills/$s .zcode/skills/$s (or add '$s <reason >= 20 chars>' to .ai-factory/zcode-mirror-exemptions.txt)"
    fail=1
  done
fi

# ─── Dangling links under .zcode/skills/ ─────────────────────────────────────
# chkstow's dangling test (bad_links: `-l && !-e`) adopted by reference — prior-art-evaluations.md#292.
if [ -n "$mirror" ] && [ -d "$mirror" ]; then
  for m in "$mirror"/*; do
    { [ -e "$m" ] || [ -L "$m" ]; } || continue
    [ -L "$m" ] || continue
    [ -e "$m" ] && continue
    name=${m##*/}
    target=$(readlink "$m" 2>/dev/null || printf '?')
    if [ -d "$SRC/$name" ]; then
      say "check-zcode-mirror: dangling mirror link '$name' (.zcode/skills/$name -> $target): target does not exist — relink: ln -sfn ../../.claude/skills/$name .zcode/skills/$name"
    else
      say "check-zcode-mirror: dangling mirror link '$name' (.zcode/skills/$name -> $target): target does not exist — stale link to a skill that does not exist; remove it: rm .zcode/skills/$name"
    fi
    fail=1
  done
fi

# ─── Verdict ──────────────────────────────────────────────────────────────────
if [ "$fail" -eq 0 ]; then
  say "check-zcode-mirror: OK — every .claude/skills entry has a .zcode/skills counterpart (mirror complete)"
  exit 0
fi
exit 1
