#!/usr/bin/env bash
# install-no-manual-step.test.sh — the getff install never hands the person running it a manual step
# (operator directive 2026-09-28, decision Q4.7). What the install cannot do goes to the «NOT wired»
# summary with what is missing and why — never with «do X yourself».
#
# #1868 applied this to the ESLint config path. This file covers the rest of the JS/TS install
# output: the git-hooks activation, the non-ESLint tool configs kept by copy_unless_foreign, a
# legacy eslintrc next to the flat config, the summary header and the kept-files list, the closing
# «Next steps» block (replaced by what the install itself checked), the dependency install, and the
# jq-less JSON writes (a node fallback). The predicate is tests/install-sh/lib/manual-step.sh.
#
# Arms:
#   U  lib.sh: json_edit_node writes JSON without jq (register_cc_hook + context7 in .mcp.json),
#      and with neither jq nor node the hook lands in the NOT-wired list with its reason;
#   N  a fresh ts-server install in a git repo, no --full: no manual step anywhere; the hooks are
#      reported active from `git config`, audit-ai-docs.sh was run by the install, the dependency
#      install is a NOT-wired line with its reason, and there is no «Next steps» list;
#   H  the consumer's own core.hooksPath: kept, reported with the reason and no command;
#   S  a subdirectory install: no hooks command, the reason names the git toplevel;
#   G  not a git repository: no hooks command, the reason says so;
#   P  the consumer's own .prettierrc: prettier reported not wired, no «merge … into it»;
#   L  a legacy .eslintrc.json beside the placed flat config: reported, no «port your rules»;
#   F  --full with a package manager that fails: the dependency line says the install failed,
#      the degraded banner points at the NOT-wired list, not at a manual step.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
# shellcheck source=tests/install-sh/lib/manual-step.sh
. "$REPO_ROOT/tests/install-sh/lib/manual-step.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT INT TERM

# The not-wired summary: its header, then one «- …» line per piece, up to the blank line that ends it.
not_wired() { awk '/NOT wired, or wired only in part/{on=1; next} on && /^[[:space:]]*$/{exit} on' "$1"; }
# no_manual <arm> <log> — the whole install output hands no manual step back.
no_manual() {
  local lines
  lines=$(manual_step_lines "$2")
  [ -z "$lines" ] && ok "$1: nothing in the install output asks for a manual step" \
    || bad "$1: the install still asks for a manual step: $(printf '%s\n' "$lines" | head -3 | tr '\n' '|')"
}
# project <dir> [git] — a minimal package.json project, a git repo unless $2 = nogit.
project() {
  mkdir -p "$1"
  printf '{ "name": "nms", "version": "0.0.0" }\n' > "$1/package.json"
  [ "${2:-git}" = nogit ] || git -C "$1" init -q
}
install_into() { # <dir> <log> <args…>
  local d="$1" log="$2"; shift 2
  ( cd "$d" && bash "$REPO_ROOT/install.sh" "$@" </dev/null ) >"$log" 2>&1
}

# ── U: JSON writes without jq ──────────────────────────────────────────────────────────────────
NOJQ="$WORK/nojq-bin"; NONODE="$WORK/nonode-bin"; mkdir -p "$NOJQ" "$NONODE"
for t in bash sh cat mv rm cp grep sed awk mkdir dirname basename tr head tail printf env mktemp chmod; do
  p=$(command -v "$t" 2>/dev/null) || continue
  case "$p" in /*) ln -s "$p" "$NOJQ/$t"; ln -s "$p" "$NONODE/$t" ;; esac
done
ln -s "$(command -v node)" "$NOJQ/node"
(
  # shellcheck disable=SC1090
  INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
  NOT_WIRED=()
  s="$WORK/u/.claude/settings.json"; mkdir -p "${s%/*}"
  printf '{ "hooks": { "Stop": [ { "hooks": [ { "type": "command", "command": "mine.sh" } ] } ] } }\n' > "$s"
  out=$(PATH="$NOJQ" register_cc_hook "$s" Stop "bash .claude/hooks/eot.sh" eot.sh 2>&1)
  node -e 'const s = require(process.argv[1]); const c = s.hooks.Stop.flatMap(g => g.hooks.map(h => h.command));
    process.exit(c.includes("mine.sh") && c.includes("bash .claude/hooks/eot.sh") ? 0 : 1)' "$s" \
    && echo "OK register_cc_hook without jq appends the hook through node and keeps the existing one" \
    || echo "BAD register_cc_hook without jq: $(printf '%s' "$out" | tr '\n' '|') — settings: $(tr '\n' ' ' < "$s")"
  before=$(cat "$s")
  PATH="$NOJQ" register_cc_hook "$s" Stop "bash .claude/hooks/eot.sh" eot.sh >/dev/null 2>&1
  [ "$before" = "$(cat "$s")" ] && echo "OK a second jq-less register_cc_hook changes nothing" \
    || echo "BAD a second jq-less register_cc_hook changed settings.json"
  PATH="$NOJQ" register_cc_hook "$s" SubagentStart "bash .claude/hooks/eot.sh" eot.sh >/dev/null 2>&1
  node -e 'const s = require(process.argv[1]); process.exit((s.hooks.SubagentStart || []).length === 1 ? 0 : 1)' "$s" \
    && echo "OK jq-less idempotence is per event, as with jq" || echo "BAD jq-less register_cc_hook skipped a second event"
  m="$WORK/u/.mcp.json"; printf '{ "mcpServers": { "mine": { "command": "x" } } }\n' > "$m"
  PATH="$NOJQ" add_context7_mcp "$m" >/dev/null 2>&1
  node -e 'const m = require(process.argv[1]); process.exit(m.mcpServers.mine && m.mcpServers.context7 ? 0 : 1)' "$m" \
    && echo "OK add_context7_mcp without jq adds context7 and keeps the other servers" \
    || echo "BAD add_context7_mcp without jq: $(tr '\n' ' ' < "$m")"
  n="$WORK/u/none/.claude/settings.json"; mkdir -p "${n%/*}"; printf '{}\n' > "$n"
  # Not in $( ): a command substitution is a subshell, and its NOT_WIRED entry would be lost.
  PATH="$NONODE" register_cc_hook "$n" Stop "bash .claude/hooks/eot.sh" eot.sh > "$WORK/u-none.out" 2>&1
  out=$(cat "$WORK/u-none.out")
  printf '%s\n' "${NOT_WIRED[@]-}" | grep -q 'eot.sh' \
    && echo "OK with neither jq nor node the hook is a NOT-wired line" || echo "BAD no NOT-wired line without jq and node"
  printf '%s\n%s\n' "$out" "${NOT_WIRED[@]-}" > "$WORK/u.log"
  asks_by_hand "$WORK/u.log" && echo "BAD the jq-less path asks for a manual edit: $(manual_step_lines "$WORK/u.log" | head -1)" \
    || echo "OK the jq-less path asks for no manual edit"
) > "$WORK/u.out" 2>&1
while IFS= read -r l; do
  case "$l" in "OK "*) ok "U: ${l#OK }" ;; "BAD "*) bad "U: ${l#BAD }" ;; esac
done < "$WORK/u.out"
grep -qE '^(OK|BAD) ' "$WORK/u.out" || bad "U: the lib.sh arm printed nothing: $(tail -3 "$WORK/u.out" | tr '\n' '|')"

# ── N: fresh ts-server install, git repo, no --full ───────────────────────────────────────────
N="$WORK/fresh"; project "$N"
install_into "$N" "$WORK/n.log" ts-server; rc=$?
[ "$rc" -eq 0 ] && ok "N: the install exits 0" || bad "N: the install exited $rc: $(tail -3 "$WORK/n.log" | tr '\n' '|')"
no_manual N "$WORK/n.log"
grep -q '^Next steps:' "$WORK/n.log" && bad "N: the install still prints a «Next steps» list" || ok "N: no «Next steps» list"
grep -qE '✓ git hooks active — core\.hooksPath=\.husky' "$WORK/n.log" \
  && ok "N: the install reports the hooks active from git config" || bad "N: no «git hooks active» line read from git config"
grep -qE '✓ scripts/audit-ai-docs\.sh — [0-9]+ PASS, 0 FAIL' "$WORK/n.log" \
  && ok "N: the install ran audit-ai-docs.sh itself and reports its result" || bad "N: no audit-ai-docs.sh result in the install output"
not_wired "$WORK/n.log" | grep -E '^[[:space:]]*- dependencies' | grep -q 'not installed' \
  && ok "N: the dependency install is a NOT-wired line with its reason" \
  || bad "N: no NOT-wired line for the dependencies: $(not_wired "$WORK/n.log" | head -3 | tr '\n' '|')"
grep -q 'npm install --save-dev' "$WORK/n.log" && bad "N: the install still prints an npm install command to copy" \
  || ok "N: no dependency command to copy"
grep -q 'each line says why and what to do' "$WORK/n.log" && bad "N: the summary header still promises «what to do»" \
  || ok "N: the summary header does not promise «what to do»"

# ── H: the consumer's own core.hooksPath ────────────────────────────────────────────────────
H="$WORK/own-hooks"; project "$H"; git -C "$H" config core.hooksPath .githooks
install_into "$H" "$WORK/h.log" ts-server
[ "$(git -C "$H" config core.hooksPath)" = .githooks ] && ok "H: core.hooksPath=.githooks kept" \
  || bad "H: core.hooksPath repointed to $(git -C "$H" config core.hooksPath)"
not_wired "$WORK/h.log" | grep 'git hooks' | grep -q "\.githooks" \
  && ok "H: the NOT-wired line names the consumer's hooksPath" || bad "H: no NOT-wired line naming .githooks"
grep -q 'git config core.hooksPath' "$WORK/h.log" && bad "H: the install still prints a git config command" \
  || ok "H: no git config command printed"
no_manual H "$WORK/h.log"

# ── S: subdirectory install ──────────────────────────────────────────────────────────────────
S="$WORK/sub"; mkdir -p "$S"; git -C "$S" init -q; project "$S/web" nogit
install_into "$S/web" "$WORK/s.log" ts-server
not_wired "$WORK/s.log" | grep 'git hooks' | grep -q 'toplevel' \
  && ok "S: the NOT-wired line says the install root is not the git toplevel" || bad "S: no NOT-wired hooks line naming the toplevel"
grep -q 'git config core.hooksPath' "$WORK/s.log" && bad "S: the install still prints a git config command" \
  || ok "S: no git config command printed"
no_manual S "$WORK/s.log"

# ── G: not a git repository ──────────────────────────────────────────────────────────────────
G="$WORK/nogit"; project "$G" nogit
install_into "$G" "$WORK/g.log" ts-server
not_wired "$WORK/g.log" | grep 'git hooks' | grep -q 'not a git repository' \
  && ok "G: the NOT-wired line says the project is not a git repository" || bad "G: no NOT-wired hooks line for a non-git project"
no_manual G "$WORK/g.log"

# ── P: the consumer's own .prettierrc ────────────────────────────────────────────────────────
P="$WORK/own-prettier"; project "$P"; printf '{ "semi": false }\n' > "$P/.prettierrc"
install_into "$P" "$WORK/p.log" ts-server
[ "$(cat "$P/.prettierrc")" = '{ "semi": false }' ] && ok "P: the consumer's .prettierrc is byte-identical" \
  || bad "P: the consumer's .prettierrc changed"
not_wired "$WORK/p.log" | grep -q '^[[:space:]]*- prettier' \
  && ok "P: prettier is a NOT-wired line" || bad "P: no NOT-wired line for prettier"
no_manual P "$WORK/p.log"

# ── L: a legacy .eslintrc.json beside the placed flat config ─────────────────────────────────
L="$WORK/legacy"; project "$L"; printf '{ "rules": { "no-console": "error" } }\n' > "$L/.eslintrc.json"
install_into "$L" "$WORK/l.log" ts-server
not_wired "$WORK/l.log" | grep -q '\.eslintrc\.json' \
  && ok "L: the legacy eslintrc is a NOT-wired line" || bad "L: no NOT-wired line for .eslintrc.json"
no_manual L "$WORK/l.log"

# ── F: --full, the package manager fails ────────────────────────────────────────────────────
STUB="$WORK/stub-fail"; mkdir -p "$STUB"
printf '#!/bin/sh\nexit 1\n' > "$STUB/npm"; cp "$STUB/npm" "$STUB/pnpm"; cp "$STUB/npm" "$STUB/yarn"
chmod +x "$STUB/npm" "$STUB/pnpm" "$STUB/yarn"
F="$WORK/full-fail"; project "$F"
( cd "$F" && PATH="$STUB:$PATH" bash "$REPO_ROOT/install.sh" ts-server --full </dev/null ) >"$WORK/f.log" 2>&1; rc=$?
[ "$rc" -ne 0 ] && ok "F: a --full install whose dependencies failed still exits non-zero" || bad "F: rc 0 on failed dependencies"
not_wired "$WORK/f.log" | grep -E '^[[:space:]]*- dependencies' | grep -q 'failed' \
  && ok "F: the dependency NOT-wired line says the install failed" \
  || bad "F: no NOT-wired dependency line saying it failed: $(not_wired "$WORK/f.log" | grep dependencies | head -1)"
grep -q 'step 4' "$WORK/f.log" && bad "F: the degraded banner still points at «step 4»" || ok "F: the banner points at no numbered step"
no_manual F "$WORK/f.log"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
