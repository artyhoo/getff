#!/usr/bin/env bash
# tests/install-sh/ships-manifest.test.sh — Arm B of the ships manifest (one-button point 13):
# every row of setup.d/ships.manifest is TRUE of a real install.
#
# Arm A (scripts/check-ships-manifest.mjs) proves every item is marked; this arm proves the
# marks. Three real installs, exactly as tests/install-sh/snapshot.sh runs them
# (`install.sh react-spa --profile <p> --force </dev/null`, no --full), then per row:
#   skill / agent / hook with installer core|env|factory → present at that depth and above,
#       absent below (a hook is «present» when .claude/settings.json registers it);
#   installer=no → absent at every depth (rule files, settings keys and MCP servers included);
#   setting `hooks` → the key exists at core;
#   installer=ask → absent from the three plain installs, present in a FOURTH install run with the
#       pre-launch «yes» (env + GETFF_SESSION_SETTINGS=1), where installer=no settings stay absent;
#   mcp installer=full → the one project MCP writer (lib.sh add_getff_mcp_servers, what --full
#       runs) writes exactly those servers.
# Self-check (N1): a manifest copy with ONE row made false must turn this test red, or the
# assertions above prove nothing (SHIPS_MANIFEST points the test at that copy).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
MANIFEST="${SHIPS_MANIFEST:-$REPO_ROOT/setup.d/ships.manifest}"

WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT

# ── N1 self-check first (skipped inside the self-check run) ──────────────────────────────────
if [ -z "${SHIPS_MANIFEST:-}" ]; then
  echo "── N1: a false row turns this test red"
  _false="$WORK/false.manifest"
  # agent aif-init ships at core; claiming `no` must fail against the real install.
  awk -F'\t' 'BEGIN{OFS="\t"} $1=="agent" && $2=="aif-init" {$4="no"; $6="internal, because this row is deliberately false"; $3="internal"} {print}' \
    "$MANIFEST" > "$_false"
  if SHIPS_MANIFEST="$_false" bash "$0" > "$WORK/n1.out" 2>&1; then
    bad "N1 a false row (agent aif-init installer=no) still passed — the assertions prove nothing"
  elif grep -q 'agent aif-init' "$WORK/n1.out"; then
    ok "N1 a false row (agent aif-init installer=no) fails, naming the row"
  else
    bad "N1 failed for another reason: $(grep '✗' "$WORK/n1.out" | head -3 | tr '\n' '|')"
  fi
fi

# ── three real installs, plus env with the pre-launch «yes» to the session settings ──────────
PROFILES="core env factory"
depth() { case "$1" in core) echo 1 ;; env) echo 2 ;; factory) echo 3 ;; *) echo 9 ;; esac; }
for p in $PROFILES ask; do
  d="$WORK/$p"; mkdir -p "$d"; git -C "$d" init -q
  printf '{"name":"fixture","dependencies":{"react":"^19.0.0"}}\n' > "$d/package.json"
  prof="$p"; consent=""; [ "$p" = ask ] && { prof="env"; consent=1; }
  ( cd "$d" && GETFF_SESSION_SETTINGS="$consent" bash "$REPO_ROOT/install.sh" react-spa --profile "$prof" --force </dev/null ) >"$WORK/$p.log" 2>&1 \
    || bad "install --profile $prof${consent:+ (session settings yes)} exited non-zero: $(tail -3 "$WORK/$p.log" | tr '\n' '|')"
done

# present KIND NAME DIR — 0 when the item is on disk / registered in that install
present() {
  local kind="$1" name="$2" d="$3"
  case "$kind" in
    skill) [ -f "$d/.claude/skills/$name/SKILL.md" ] ;;
    agent) [ -f "$d/.claude/agents/$name.md" ] ;;
    hook)  [ -f "$d/.claude/settings.json" ] && grep -qF "/hooks/$name.sh" "$d/.claude/settings.json" ;;
    rule)  [ -f "$d/.claude/rules/$name.md" ] ;;
    setting)
      local f
      for f in "$d/.claude/settings.json" "$d/.claude/settings.local.json"; do
        [ -f "$f" ] && jq -e --arg p "$name" 'getpath($p | split(".")) != null' "$f" >/dev/null 2>&1 && return 0
      done
      return 1 ;;
    mcp)   [ -f "$d/.mcp.json" ] && jq -e --arg n "$name" '.mcpServers[$n] != null' "$d/.mcp.json" >/dev/null 2>&1 ;;
  esac
}

echo "── rows vs the core / env / factory installs"
_rows=0; _full_mcp=""
while IFS=$'\t' read -r kind name verdict installer plugin reason; do
  case "$kind" in ''|\#*) continue ;; esac
  : "$verdict" "$plugin" "$reason"
  _rows=$((_rows + 1))
  if [ "$installer" = "full" ]; then
    [ "$kind" = "mcp" ] && _full_mcp="$_full_mcp $name" || bad "$kind $name: installer=full is only checked for mcp rows"
    continue
  fi
  want=$(depth "$installer"); _wrong=""
  for p in $PROFILES; do
    if [ "$(depth "$p")" -ge "$want" ]; then
      present "$kind" "$name" "$WORK/$p" || _wrong="$_wrong missing-at-$p"
    else
      present "$kind" "$name" "$WORK/$p" && _wrong="$_wrong present-at-$p"
    fi
  done
  if [ "$kind" = setting ]; then
    case "$installer" in
      ask) present "$kind" "$name" "$WORK/ask" || _wrong="$_wrong missing-after-yes" ;;
      no)  present "$kind" "$name" "$WORK/ask" && _wrong="$_wrong present-after-yes" ;;
    esac
  fi
  if [ -n "$_wrong" ]; then bad "$kind $name (installer=$installer):$_wrong"; fi
done < "$MANIFEST"
[ "$_rows" -gt 50 ] && ok "$_rows manifest rows checked against the installs" || bad "only $_rows rows read — manifest parse broke?"
[ "$FAIL" -eq 0 ] && ok "every core/env/factory/ask/no row holds on a real install"

echo "── installer=full: the project MCP writer"
m="$WORK/mcp/.mcp.json"; mkdir -p "${m%/*}"
( INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
  NOT_WIRED=(); PROJECT_ROOT="$WORK/mcp"; FORCE=""; DRY_RUN=""
  GETFF_GLOBAL="" GETFF_DEEPWIKI_MACHINE_WIDE=0 add_getff_mcp_servers "$m" ) >"$WORK/mcp.log" 2>&1
got=$(jq -r '.mcpServers | keys[]' "$m" 2>/dev/null | sort | tr '\n' ' ')
want=$(printf '%s\n' $_full_mcp | sort | tr '\n' ' ')
[ -n "$want" ] && [ "$got" = "$want" ] && ok "installer=full mcp rows = what add_getff_mcp_servers writes ($got)" \
  || bad "installer=full mcp rows «$want» ≠ written «$got»: $(tr '\n' '|' < "$WORK/mcp.log")"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
