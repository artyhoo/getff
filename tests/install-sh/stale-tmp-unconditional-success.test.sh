#!/usr/bin/env bash
# stale-tmp-unconditional-success.test.sh — ledger A1-9 (PR #1597 local review).
#
# The A1-8 class (fixed for merge_fenced in PR #1632) had live siblings across the
# installer: `jq/awk … "$f" > "$f.tmp" && mv "$f.tmp" "$f"` followed by an
# UNCONDITIONAL success line. When jq/awk or the redirect fails, `&&` skips the mv,
# the consumer's file keeps its OLD content, a half-written `<f>.tmp` is left in the
# consumer tree — and the installer still prints `✓ … registered/added/replaced`.
# `set -e` does not fire: a failure of the left-hand side of an `&&` list is exempt.
#
# Arm A/B: behavioural paired-negative on the one site callable as a function
# (`register_cc_hook`, setup.d/lib.sh). Arm C: structural anti-drift over every
# installer script, because the other sites live in top-level layer bodies that
# cannot be invoked without a full install; the shape itself is the defect.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

PKG_ROOT="$REPO_ROOT"; PROJECT_ROOT="$REPO_ROOT"; FORCE=""; DRY_RUN=""; UPSTREAM_BLOB_URL=""
SKIPPED=()
INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"

mk_settings() { printf '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"consumer-own.sh"}]}]}}\n' > "$1/settings.json"; }

# ── (A) jq failure on the append path — the A1-9 core case ───────────────────
T=$(mktemp -d); mk_settings "$T"
jq() { return 2; }
register_cc_hook "$T/settings.json" "Stop" "bash new-hook.sh" "new-hook" > "$T/out" 2>&1; rc=$?
unset -f jq
out=$(cat "$T/out")
case "$out" in *"registered as a Stop hook"*) bad "A: '✓ … registered' printed despite a failed jq: $out" ;; *) ok "A: no success line when the jq rewrite fails" ;; esac
case "$out" in *"⚠"*) ok "A: a ⚠ warning is emitted instead" ;; *) bad "A: no ⚠ warning: $out" ;; esac
[ -e "$T/settings.json.tmp" ] && bad "A: stale settings.json.tmp left in the consumer tree" || ok "A: no stale .tmp left behind"
grep -qF 'consumer-own.sh' "$T/settings.json" && ok "A: consumer settings.json left intact" || bad "A: consumer settings.json clobbered"
[ "$rc" -eq 0 ] && ok "A: register_cc_hook returns 0 (fail-open, never aborts the install)" || bad "A: rc=$rc"
rm -rf "$T"

# ── (B) paired-positive: a healthy jq still registers + reports success ──────
if command -v jq >/dev/null 2>&1; then
  T=$(mktemp -d); mk_settings "$T"
  register_cc_hook "$T/settings.json" "Stop" "bash new-hook.sh" "new-hook" > "$T/out" 2>&1
  out=$(cat "$T/out")
  case "$out" in *"registered as a Stop hook"*) ok "B: healthy jq still prints the ✓ line" ;; *) bad "B: success line lost on the happy path: $out" ;; esac
  grep -qF 'new-hook.sh' "$T/settings.json" && ok "B: hook appended" || bad "B: hook not appended"
  grep -qF 'consumer-own.sh' "$T/settings.json" && ok "B: consumer hook preserved" || bad "B: consumer hook lost"
  [ -e "$T/settings.json.tmp" ] && bad "B: tmp left behind on the happy path" || ok "B: tmp cleaned up on the happy path"
  rm -rf "$T"
else
  bad "B: jq absent — the paired-positive arm could not be exercised"
fi

# ── (C) structural anti-drift: the raw shape is gone from every installer script ──
# A logical line (continuations joined) that redirects into a *.tmp and then `&& mv` is only
# honest when the whole && list is an if/while CONDITION — otherwise the next statement runs
# regardless. `set -e` will not save it: a failing left-hand side of an && list is exempt.
hits=$(cd "$REPO_ROOT" && for f in install.sh setup.d/*.sh; do
  awk -v F="$f" '
    { line = line $0
      if (sub(/\\$/, "", line)) next
      # `; then` can only terminate an if/elif condition in bash, so it is a sound
      # (and quoting-proof) marker that the whole && list is the tested command.
      if (line ~ /> *"[^"]*\.tmp" *&& *mv/ && line !~ /;[[:space:]]*then[[:space:]]*$/)
        print F ":" NR ": " line
      line = "" }' "$f"
done)
if [ -n "$hits" ]; then
  bad "C: '> \"…tmp\" && mv' outside an if/while condition still present:"; printf '%s\n' "$hits" | sed 's/^/      /'
else
  ok "C: every '> \"…tmp\" && mv' in install.sh + setup.d/*.sh guards its success path"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
