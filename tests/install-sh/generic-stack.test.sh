#!/usr/bin/env bash
# generic-stack.test.sh — P2 G1 (one-button, operator log entry 26 points 2-4): the installer must
# not exit on a project whose stack it does not know. Before this, `install.sh --full` (what
# `./setup -y` runs) exited 1 in three places: no package.json and no toolchain-lane file, a
# package.json with no stack signal, and (interactive) a menu with no way out. Now such a project
# lands on the stack `generic`: the SAME setup.d layer loop, with every npm-bound layer gated off
# and named in the NOT wired summary.
#
# ARMS (hermetic: no network, no package manager is run — generic skips 70-deps):
#   (1) pom.xml + README, `install.sh --full`, no positional → exit 0, stack generic, the
#       stack-free part lands (skills, agents, AGENTS.md, .ai-factory/, audit-ai-docs.sh); nothing
#       npm-bound is created (package.json, .husky/, eslint config, tsconfig, node_modules, CI);
#       every skipped layer is one NOT wired line; the banner names the NOT wired count.
#   (2) a package.json with no stack signal, `--full` → exit 0, stack generic, package.json
#       byte-identical.
#   (3) positional `generic` is a valid stack (exit 0); a misspelt stack still exits 1.
#   (4) `--dry-run` on the pom.xml repo → exit 0, prints the generic line, writes nothing.
#   (5) K5: `--full` on a pyproject.toml repo, no positional → the python lane is claimed and
#       named alpha (before: the offer was declined and the install exited 1).
#   (6) point 3, no prompt under --full: run under a real pty (script(1)) with empty stdin; no
#       prompt text is printed and the run exits 0.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
TMPS=()
cleanup() { [ "${#TMPS[@]}" -gt 0 ] && rm -rf "${TMPS[@]}"; }
trap cleanup EXIT

repo() {  # $1 = kind: java | plainjs | python
  local d; d=$(mktemp -d); TMPS+=("$d")
  ( cd "$d" && git init -q && git config user.email t@t && git config user.name t
    printf '# demo\n' > README.md
    case "$1" in
      java)    printf '<project><modelVersion>4.0.0</modelVersion></project>\n' > pom.xml ;;
      plainjs) printf '{"name":"plain","version":"1.0.0","scripts":{"start":"node index.js"}}\n' > package.json
               printf 'console.log(1)\n' > index.js ;;
      python)  printf '[project]\nname = "demo"\nversion = "0"\n' > pyproject.toml ;;
    esac
    git add -A && git commit -q -m base )
  echo "$d"
}

# ── (1) Java repo, --full, no positional ─────────────────────────────────────────────────────────
J=$(repo java)
out=$( cd "$J" && bash "$INSTALL" --full < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(1) --full on a pom.xml repo exits 0" \
  || bad "(1) exit $rc (tail: $(tail -5 <<<"$out" | tr '\n' '|'))"
grep -q 'stack: generic' <<<"$out" && ok "(1) the stack is named generic" || bad "(1) no 'stack: generic' line"
for p in .claude/skills .claude/agents AGENTS.md .ai-factory/tool-decisions.md .ai-factory/DESCRIPTION.md scripts/audit-ai-docs.sh; do
  [ -e "$J/$p" ] && ok "(1) stack-free part landed: $p" || bad "(1) missing stack-free piece: $p"
done
[ -n "$(ls -A "$J/.claude/skills" 2>/dev/null)" ] && ok "(1) .claude/skills is not empty" || bad "(1) .claude/skills is empty"
for p in package.json .husky node_modules tsconfig.json eslint.config.mjs .lintstagedrc.json .github/workflows vitest.config.ts .ai-factory/RULES.md; do
  [ ! -e "$J/$p" ] && ok "(1) nothing npm-bound created: no $p" || bad "(1) npm-bound piece created on a generic project: $p"
done
for why in 'lint, typecheck and test configs' 'git hooks' 'CI workflow' 'dependencies' 'stack rules'; do
  grep -q "^      - .*$why.*generic" <<<"$out" && ok "(1) NOT wired names the skipped '$why'" \
    || bad "(1) no NOT wired line for '$why' naming generic"
done
grep -Eq '^✅ Installation complete — [0-9]+ item\(s\) NOT wired \(listed above\)\.$' <<<"$out" \
  && ok "(1) the banner names the NOT wired count" || bad "(1) banner: $(grep 'Installation' <<<"$out")"
[ -z "$(git -C "$J" status --porcelain -- pom.xml README.md)" ] && ok "(1) the project's own files are untouched" \
  || bad "(1) the install changed the project's own files"

# ── (2) plain package.json, no stack signal ──────────────────────────────────────────────────────
P=$(repo plainjs)
before=$(shasum "$P/package.json")
out=$( cd "$P" && bash "$INSTALL" --full < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(2) --full on a package.json with no stack signal exits 0" \
  || bad "(2) exit $rc (tail: $(tail -5 <<<"$out" | tr '\n' '|'))"
grep -q 'stack: generic' <<<"$out" && ok "(2) the stack is named generic" || bad "(2) no 'stack: generic' line"
[ "$before" = "$(shasum "$P/package.json")" ] && ok "(2) package.json byte-identical" || bad "(2) package.json was changed"

# ── (3) positional generic / misspelt stack ─────────────────────────────────────────────────────
G=$(repo java)
( cd "$G" && bash "$INSTALL" generic --full < /dev/null >/dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(3) positional 'generic' is accepted" || bad "(3) positional 'generic' exited $rc"
T=$(repo plainjs)
out=$( cd "$T" && bash "$INSTALL" react-sap --full < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 1 ] && grep -q 'Unknown stack: react-sap' <<<"$out" \
  && ok "(3) a misspelt stack still exits 1 (a wrong name is an error, not a stack)" \
  || bad "(3) misspelt stack: exit $rc"

# ── (4) --dry-run ───────────────────────────────────────────────────────────────────────────────
D=$(repo java)
out=$( cd "$D" && bash "$INSTALL" --dry-run < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(4) --dry-run exits 0" || bad "(4) --dry-run exit $rc"
grep -q 'stack: generic — stack-free part only; stack-bound part: not done (the agent researches it)' <<<"$out" \
  && ok "(4) --dry-run names the generic stack and what it leaves undone" || bad "(4) no generic dry-run line"
[ -z "$(git -C "$D" status --porcelain)" ] && ok "(4) --dry-run wrote nothing" || bad "(4) --dry-run wrote: $(git -C "$D" status --porcelain | head -3 | tr '\n' ' ')"

# ── (5) K5: -y claims a detected toolchain lane ──────────────────────────────────────────────────
Y=$(repo python)
out=$( cd "$Y" && bash "$INSTALL" --full < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && [ -f "$Y/sgconfig.yml" ] && ok "(5) --full on pyproject.toml claims the python lane (sgconfig.yml delivered)" \
  || bad "(5) exit $rc, sgconfig.yml $( [ -f "$Y/sgconfig.yml" ] && echo present || echo absent) (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
grep -q 'Python toolchain lane (alpha)' <<<"$out" && ok "(5) the claimed lane is named alpha" || bad "(5) the lane is not named alpha"

# ── (6) no prompt under --full, at a real pty ────────────────────────────────────────────────────
N=$(repo java)
# script(1) differs: util-linux takes the command via -c (and -e to return its exit code), BSD/macOS
# takes it as trailing arguments and returns its exit code by default.
if script -V 2>/dev/null | grep -q util-linux; then
  out=$( cd "$N" && script -qec "bash '$INSTALL' --full" /dev/null < /dev/null 2>&1 ); rc=$?
else
  out=$( cd "$N" && script -q /dev/null bash "$INSTALL" --full < /dev/null 2>&1 ); rc=$?
fi
[ "$rc" -eq 0 ] && ok "(6) --full at a pty with empty stdin exits 0" || bad "(6) exit $rc at a pty"
grep -Eq 'Choose \[|\[y/N\]|\[Y/n\]' <<<"$out" && bad "(6) a prompt was printed under --full: $(grep -E 'Choose \[|\[y/N\]|\[Y/n\]' <<<"$out" | head -2)" \
  || ok "(6) no prompt printed under --full"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
