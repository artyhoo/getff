#!/usr/bin/env bash
# install-coordination-wiring.sh — one-click wiring of the cross-worktree
# coordination linker into all three trigger channels (G + B + C).
#
# Run from the CENTRAL repo checkout:  bash scripts/install-coordination-wiring.sh
#
# Channels (all call the same idempotent scripts/link-coordination.sh):
#   G  git post-checkout  → $(core.hooksPath)/post-checkout      (agnostic floor)
#   B  CC SessionStart     → .claude/settings.json hooks         (CC-native)
#   C  Superset setup      → ~/.superset/projects/*/config.json  (replaces the rsync root-cause)
#
# Modes:
#   (default)     apply to real paths + verify each channel landed
#   --dry-run     print what WOULD change; touch nothing
#   --self-test   run the three apply fns against throwaway temp copies, assert, report (no real writes)
#
# Idempotent: re-running is a no-op once a channel is wired. Safe to run repeatedly.
# @dual-pair: cross-worktree-coordination-doc-sync   (SSOT #110)

set -euo pipefail

MODE="apply"
case "${1:-}" in
  --dry-run)   MODE="dry-run" ;;
  --self-test) MODE="self-test" ;;
  "")          MODE="apply" ;;
  *) echo "usage: $0 [--dry-run|--self-test]" >&2; exit 2 ;;
esac

command -v jq >/dev/null 2>&1 || { echo "FATAL: jq required" >&2; exit 1; }

# The linker call each channel runs (no args → default --on-conflict=skip; never clobbers).
LINKER_REL="scripts/link-coordination.sh"

say()  { printf '%s\n' "$*" >&2; }
ok()   { printf '  \033[32mOK\033[0m   %s\n' "$*" >&2; }
skip() { printf '  \033[33mSKIP\033[0m %s\n' "$*" >&2; }
plan() { printf '  \033[36mPLAN\033[0m %s\n' "$*" >&2; }

# ── Channel G: git post-checkout ────────────────────────────────────────────
# Args: $1 = repo root, $2 = hooks dir (absolute)
wire_g() {
  local repo="$1" hooks_dir="$2" hook="$2/post-checkout"
  local body
  body="$(cat <<'HOOK'
#!/usr/bin/env sh
# coordination-persistence: link gitignored coordination state on worktree checkout (channel G).
# $3 == 1 → branch checkout (incl. `git worktree add`); skip file-only checkouts.
[ "$3" = "1" ] || exit 0
bash "$(git rev-parse --show-toplevel)/scripts/link-coordination.sh" >/dev/null 2>&1 || true
exit 0
HOOK
)"
  if [ -f "$hook" ] && grep -q 'coordination-persistence' "$hook" 2>/dev/null; then
    skip "G: $hook already wired"; return 0
  fi
  if [ "$MODE" = "dry-run" ]; then plan "G: write $hook (+chmod +x)"; return 0; fi
  mkdir -p "$hooks_dir"
  printf '%s\n' "$body" > "$hook"
  chmod +x "$hook"
  ok "G: wrote $hook"
}

# ── Channel B: CC SessionStart in .claude/settings.json ─────────────────────
# Args: $1 = settings.json path
wire_b() {
  local settings="$1"
  local cmd='bash "$CLAUDE_PROJECT_DIR/scripts/link-coordination.sh" >/dev/null 2>&1 || true'
  [ -f "$settings" ] || { say "  (no $settings — skipping B)"; return 0; }
  if jq -e --arg c "$cmd" '
        [.hooks.SessionStart[]?.hooks[]?.command // empty] | any(. == $c)
      ' "$settings" >/dev/null 2>&1; then
    skip "B: SessionStart already wired in $settings"; return 0
  fi
  if [ "$MODE" = "dry-run" ]; then plan "B: add SessionStart hook to $settings"; return 0; fi
  local tmp; tmp="$(mktemp "${settings}.tmpXXXXXX")"
  jq --arg c "$cmd" '
      .hooks //= {} |
      .hooks.SessionStart = ((.hooks.SessionStart // []) + [{hooks: [{type: "command", command: $c}]}])
    ' "$settings" > "$tmp"
  mv "$tmp" "$settings"
  ok "B: added SessionStart hook to $settings"
}

# ── Channel C: Superset setup array ─────────────────────────────────────────
# Args: $1 = superset projects dir (~/.superset/projects)
wire_c() {
  local projects="$1"
  local newcall='bash "$SUPERSET_ROOT_PATH/scripts/link-coordination.sh" "$SUPERSET_WORKSPACE_PATH" "$SUPERSET_ROOT_PATH" >/dev/null 2>&1 || true'
  [ -d "$projects" ] || { say "  (no $projects — skipping C; not on Superset)"; return 0; }
  local hit=0 cfg
  for cfg in "$projects"/*/config.json; do
    [ -f "$cfg" ] || continue
    # Only touch configs whose setup rsyncs orchestrator-prompts (the root-cause line).
    jq -e '(.setup // []) | any(test("orchestrator-prompts") and test("rsync"))' "$cfg" >/dev/null 2>&1 || continue
    hit=1
    if jq -e --arg n "$newcall" '(.setup // []) | any(test("link-coordination"))' "$cfg" >/dev/null 2>&1; then
      skip "C: $cfg already uses link-coordination"; continue
    fi
    if [ "$MODE" = "dry-run" ]; then plan "C: replace rsync line with linker in $cfg"; continue; fi
    local tmp; tmp="$(mktemp "${cfg}.tmpXXXXXX")"
    jq --arg n "$newcall" '
        .setup |= map(if (test("orchestrator-prompts") and test("rsync")) then $n else . end)
      ' "$cfg" > "$tmp"
    mv "$tmp" "$cfg"
    ok "C: rewired $cfg (rsync → linker)"
  done
  [ "$hit" = "0" ] && say "  (no Superset project config with the orchestrator-prompts rsync — C nothing to do)"
  return 0
}

# ── verify (apply mode) ─────────────────────────────────────────────────────
verify() {
  local repo="$1" hooks_dir="$2" settings="$3"
  local fail=0
  # shellcheck disable=SC2015  # B is a print-only helper that cannot fail; this reads as if-then-else by construction
  [ -x "$hooks_dir/post-checkout" ] && grep -q coordination-persistence "$hooks_dir/post-checkout" \
    && ok "verify G: post-checkout present + executable" || { say "  FAIL G"; fail=1; }
  if [ -f "$settings" ]; then
    # shellcheck disable=SC2015  # B is a print-only helper that cannot fail; this reads as if-then-else by construction
    jq -e '[.hooks.SessionStart[]?.hooks[]?.command // empty] | any(test("link-coordination"))' "$settings" >/dev/null 2>&1 \
      && ok "verify B: SessionStart wired" || { say "  FAIL B"; fail=1; }
  fi
  return $fail
}

# ── self-test (sandbox) ─────────────────────────────────────────────────────
self_test() {
  local box; box="$(mktemp -d)"
  local repo="$box/repo"
  local hooks="$box/repo/.husky"
  local settings="$box/repo/.claude/settings.json"
  local sprojects="$box/superset/projects"
  local scfg="$box/superset/projects/uuid-1/config.json"
  mkdir -p "$hooks" "$box/repo/.claude" "$sprojects/uuid-1"
  printf '{"permissions":{},"hooks":{"UserPromptSubmit":[]}}' > "$settings"
  printf '%s' '{"setup":["mkdir -p x; rsync -a --ignore-existing $SUPERSET_ROOT_PATH/.claude/orchestrator-prompts/ x/","ln -s nm"]}' > "$scfg"

  MODE="apply"
  wire_g "$repo" "$hooks"
  wire_b "$settings"
  wire_c "$sprojects"

  local pass=1
  # shellcheck disable=SC2015  # grep IS the test here; the brace group is its else-branch
  [ -x "$hooks/post-checkout" ] && grep -q coordination-persistence "$hooks/post-checkout" || { say "SELFTEST FAIL: G"; pass=0; }
  jq -e '[.hooks.SessionStart[]?.hooks[]?.command // empty] | any(test("link-coordination"))' "$settings" >/dev/null || { say "SELFTEST FAIL: B"; pass=0; }
  jq -e '(.setup) | any(test("link-coordination")) and (any(test("rsync")) | not)' "$scfg" >/dev/null || { say "SELFTEST FAIL: C (rsync not replaced)"; pass=0; }
  # idempotency: second run must not duplicate
  wire_g "$repo" "$hooks"; wire_b "$settings"; wire_c "$sprojects"
  local nsess; nsess="$(jq '(.hooks.SessionStart // []) | length' "$settings")"
  [ "$nsess" = "1" ] || { say "SELFTEST FAIL: B not idempotent (SessionStart count=$nsess)"; pass=0; }
  local nsetup; nsetup="$(jq '[.setup[] | select(test("link-coordination"))] | length' "$scfg")"
  [ "$nsetup" = "1" ] || { say "SELFTEST FAIL: C not idempotent (linker lines=$nsetup)"; pass=0; }

  if [ "$pass" = "1" ]; then say ""; printf 'SELF-TEST: \033[32mALL PASS\033[0m (G+B+C apply + idempotent)\n' >&2; return 0
  else say ""; printf 'SELF-TEST: \033[31mFAILED\033[0m\n' >&2; return 1; fi
}

# ── main ────────────────────────────────────────────────────────────────────
if [ "$MODE" = "self-test" ]; then self_test; exit $?; fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "FATAL: run inside the repo" >&2; exit 1; }
HOOKS_DIR="$(git config --get core.hooksPath 2>/dev/null || true)"
[ -z "$HOOKS_DIR" ] && HOOKS_DIR="$REPO_ROOT/.husky"
SETTINGS="$REPO_ROOT/.claude/settings.json"
SUPERSET_PROJECTS="${HOME}/.superset/projects"

[ -f "$REPO_ROOT/$LINKER_REL" ] || say "WARN: $REPO_ROOT/$LINKER_REL not found — channels will be wired but the linker must exist at run time (merge SW-A)."

say "coordination-wiring [$MODE]  repo=$REPO_ROOT  hooks=$HOOKS_DIR"
wire_g "$REPO_ROOT" "$HOOKS_DIR"
wire_b "$SETTINGS"
wire_c "$SUPERSET_PROJECTS"

if [ "$MODE" = "apply" ]; then
  say ""
  if verify "$REPO_ROOT" "$HOOKS_DIR" "$SETTINGS"; then
    say "DONE: channels G+B+C wired + verified. (C is a no-op off Superset.)"
  else
    say "DONE with WARNINGS — see FAIL lines above."; exit 1
  fi
fi
