#!/usr/bin/env bash
# skill-routing.test.sh — acceptance for setup.d/skill-routing.sh and its plugin twin.
#
# The script moves the two satellite skills that collide with an owned area out of the model's
# routing (frontmatter `disable-model-invocation: true` — the user can still type /name):
# mattpocock-skills:tdd (TDD loop is owned by superpowers:test-driven-development) and
# mattpocock-skills:resolving-merge-conflicts (its rebase advice dead-ends; merge-forward owns it).
# Harmonization spec §5.1 ladder rung 2; SSOT #253.
#
# Hermetic: every case runs against a throwaway HOME — the real ~/.claude is never read or written.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
SRC="$REPO_ROOT/setup.d/skill-routing.sh"
TWIN="$REPO_ROOT/plugin/hooks/lib/skill-routing.sh"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

# mk_skill <home> <version> <subdir> <name> [extra-frontmatter-line]
mk_skill() {
  local d="$1/.claude/plugins/cache/mattpocock/mattpocock-skills/$2/skills/$3/$4"
  mkdir -p "$d"
  {
    echo '---'
    echo "name: $4"
    echo "description: \"Use when $4 applies: a: colon, and --- dashes in prose.\""
    [ -n "${5:-}" ] && echo "$5"
    echo '---'
    echo ''
    echo "# $4 body"
    echo '---'
    echo 'disable-model-invocation: false   # body text, NOT frontmatter — must survive verbatim'
  } > "$d/SKILL.md"
  printf '%s' "$d/SKILL.md"
}
fm() { awk 'NR==1&&/^---$/{f=1;next} f&&/^---$/{exit} f{print}' "$1"; }
body() { awk 'NR==1&&/^---$/{f=1;next} f==1&&/^---$/{f=2;next} f==2{print}' "$1"; }
run() { env -u XDG_CONFIG_HOME -u CLAUDE_CONFIG_DIR -u GETFF_SKILL_ROUTING HOME="$H" bash "$SRC" "$@"; }

# --- 1. apply stamps both targets, leaves a non-target alone, keeps the body -----------------
H="$TMP/h1"
tdd=$(mk_skill "$H" 1.2.3 engineering tdd)
rmc=$(mk_skill "$H" 1.2.3 engineering resolving-merge-conflicts 'disable-model-invocation: false')
gr=$(mk_skill "$H" 1.2.3 productivity grilling)
gr_before=$(cat "$gr"); tdd_body_before=$(body "$tdd")
run status >/dev/null 2>&1; rc=$?
[ "$rc" -eq 1 ] && ok "status exits 1 while a target is unrouted" || bad "status before apply: rc=$rc (want 1)"
out=$(run apply 2>&1); rc=$?
[ "$rc" -eq 0 ] && ok "apply exits 0" || bad "apply rc=$rc: $out"
[ "$(fm "$tdd" | grep -c '^disable-model-invocation: true$')" = 1 ] && ok "tdd frontmatter carries disable-model-invocation: true" || bad "tdd not stamped: $(fm "$tdd")"
[ "$(fm "$rmc" | grep -c '^disable-model-invocation:')" = 1 ] && fm "$rmc" | grep -qx 'disable-model-invocation: true' \
  && ok "an explicit false is replaced, not duplicated" || bad "rmc frontmatter: $(fm "$rmc")"
[ "$(cat "$gr")" = "$gr_before" ] && ok "non-target skill (grilling) untouched" || bad "grilling was modified"
[ "$(body "$tdd")" = "$tdd_body_before" ] && ok "body after the frontmatter is preserved verbatim" || bad "tdd body changed"
fm "$tdd" | grep -q '^description: "Use when tdd applies: a: colon' && ok "other frontmatter keys preserved" || bad "description lost"
printf '%s' "$out" | grep -q 'mattpocock-skills:tdd' && ok "apply names each skill it routed" || bad "apply output silent: $out"
[ -f "$H/.config/getff/skill-routing" ] && ok "apply records the consent marker" || bad "no consent marker written"
run status >/dev/null 2>&1; rc=$?
[ "$rc" -eq 0 ] && ok "status exits 0 once every target is routed" || bad "status after apply: rc=$rc"

# --- 2. idempotent -------------------------------------------------------------------------
snap=$(cat "$tdd" "$rmc")
out=$(run apply 2>&1)
[ "$(cat "$tdd" "$rmc")" = "$snap" ] && ok "second apply is byte-idempotent" || bad "second apply changed files"
printf '%s' "$out" | grep -q 'routed mattpocock' && bad "second apply claims a fresh stamp: $out" || ok "second apply reports no fresh stamp"

# --- 3. reapply after a plugin update (new version dir, unstamped) — marker present ---------
new=$(mk_skill "$H" 1.2.4 engineering tdd)
out=$(run reapply 2>&1); rc=$?
[ "$rc" -eq 0 ] && fm "$new" | grep -qx 'disable-model-invocation: true' \
  && ok "reapply re-stamps the copy a plugin update wrote" || bad "reapply missed the updated copy (rc=$rc): $out"

# --- 4. reapply is a no-op without consent, and under the opt-out --------------------------
H="$TMP/h2"; t2=$(mk_skill "$H" 1.2.3 engineering tdd); b2=$(cat "$t2")
out=$(run reapply 2>&1); rc=$?
[ "$rc" -eq 0 ] && [ "$(cat "$t2")" = "$b2" ] && [ -z "$out" ] \
  && ok "reapply without the consent marker touches nothing and prints nothing" || bad "reapply without consent acted (rc=$rc): $out"
mkdir -p "$H/.config/getff" && echo on > "$H/.config/getff/skill-routing"
out=$(env -u XDG_CONFIG_HOME HOME="$H" GETFF_SKILL_ROUTING=off bash "$SRC" reapply 2>&1)
[ "$(cat "$t2")" = "$b2" ] && ok "GETFF_SKILL_ROUTING=off suppresses reapply" || bad "opt-out ignored"

# --- 5. dry-run changes nothing ------------------------------------------------------------
out=$(run apply --dry-run 2>&1)
[ "$(cat "$t2")" = "$b2" ] && printf '%s' "$out" | grep -q 'would route mattpocock-skills:tdd' \
  && ok "apply --dry-run reports and writes nothing" || bad "dry-run: $out"

# --- 6. nothing installed → clean exit ------------------------------------------------------
H="$TMP/h3"; mkdir -p "$H"
out=$(run apply 2>&1); rc=$?
[ "$rc" -eq 0 ] && printf '%s' "$out" | grep -qi 'nothing to route' && [ ! -f "$H/.config/getff/skill-routing" ] \
  && ok "no satellite installed → rc 0, says so, records no consent" || bad "empty machine: rc=$rc $out"
run status >/dev/null 2>&1; rc=$?
[ "$rc" -eq 0 ] && ok "status on an empty machine exits 0 (nothing to route)" || bad "status empty rc=$rc"

# --- 7. match is by frontmatter name, not by directory -------------------------------------
H="$TMP/h4"; d="$H/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.3/skills/engineering/tdd"
mkdir -p "$d"; printf -- '---\nname: something-else\ndescription: x\n---\nbody\n' > "$d/SKILL.md"; b4=$(cat "$d/SKILL.md")
run apply >/dev/null 2>&1
[ "$(cat "$d/SKILL.md")" = "$b4" ] && ok "a SKILL.md whose name: differs is not touched" || bad "stamped by directory name"

# --- 8. plugin twin is byte-identical to the setup.d source --------------------------------
cmp -s "$SRC" "$TWIN" && ok "plugin/hooks/lib/skill-routing.sh is byte-identical to setup.d/skill-routing.sh" \
  || bad "plugin twin drifted from setup.d/skill-routing.sh (cp setup.d/skill-routing.sh plugin/hooks/lib/)"

# --- 9. the plugin session-start hook re-applies with consent, stays silent without --------
PLUGIN="$REPO_ROOT/plugin"
H="$TMP/h5"; t5=$(mk_skill "$H" 1.2.3 engineering tdd); b5=$(cat "$t5")
out=$(env -u XDG_CONFIG_HOME -u CLAUDE_CONFIG_DIR HOME="$H" CLAUDE_PLUGIN_ROOT="$PLUGIN" bash "$PLUGIN/hooks/run-hook.cmd" session-start 2>/dev/null)
[ "$(cat "$t5")" = "$b5" ] && ! printf '%s' "$out" | grep -q 'skill routing' \
  && ok "session-start without consent leaves the satellite alone" || bad "session-start acted without consent"
mkdir -p "$H/.config/getff" && echo on > "$H/.config/getff/skill-routing"
out=$(env -u XDG_CONFIG_HOME -u CLAUDE_CONFIG_DIR HOME="$H" CLAUDE_PLUGIN_ROOT="$PLUGIN" bash "$PLUGIN/hooks/run-hook.cmd" session-start 2>/dev/null); rc=$?
[ "$rc" -eq 0 ] && fm "$t5" | grep -qx 'disable-model-invocation: true' \
  && ok "session-start with consent re-applies after a plugin update" || bad "session-start did not re-apply (rc=$rc)"
printf '%s' "$out" | grep -q 'mattpocock-skills:tdd' && printf '%s' "$out" | grep -q 'using-getff' \
  && ok "session-start tells the session what it routed, and still prints the bootstrap" || bad "session-start output: $out"

# --- 10. ./setup's consent step (install <mode>) — machine-global, so -y needs --global -------
H="$TMP/h6"; t6=$(mk_skill "$H" 1.2.3 engineering tdd); b6=$(cat "$t6")
out=$(run install yes 2>&1); rc=$?
[ "$rc" -eq 3 ] && [ "$(cat "$t6")" = "$b6" ] && [ ! -f "$H/.config/getff/skill-routing" ] \
  && ok "install yes without --global → rc 3, nothing written" || bad "install yes w/o global: rc=$rc $out"
out=$(run install dry-run 2>&1); rc=$?
[ "$rc" -eq 0 ] && [ "$(cat "$t6")" = "$b6" ] && ok "install dry-run writes nothing" || bad "install dry-run: rc=$rc"
out=$(printf 'n\n' | run install interactive 2>&1); rc=$?
[ "$rc" -eq 0 ] && [ "$(cat "$t6")" = "$b6" ] && [ ! -f "$H/.config/getff/skill-routing" ] \
  && ok "install interactive + 'n' → skipped, no consent recorded" || bad "interactive n: rc=$rc $out"
out=$(printf 'y\n' | run install interactive 2>&1); rc=$?
[ "$rc" -eq 0 ] && fm "$t6" | grep -qx 'disable-model-invocation: true' && [ -f "$H/.config/getff/skill-routing" ] \
  && ok "install interactive + 'y' → stamped, consent recorded" || bad "interactive y: rc=$rc $out"
H="$TMP/h7"; t7=$(mk_skill "$H" 1.2.3 engineering tdd)
out=$(env -u XDG_CONFIG_HOME -u CLAUDE_CONFIG_DIR HOME="$H" GETFF_GLOBAL=1 bash "$SRC" install yes 2>&1); rc=$?
[ "$rc" -eq 0 ] && fm "$t7" | grep -qx 'disable-model-invocation: true' \
  && ok "install yes with --global (GETFF_GLOBAL=1) → stamped" || bad "install yes+global: rc=$rc $out"
out=$(printf '' | run install interactive 2>&1); rc=$?
[ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q 'nothing to do' \
  && ok "install with every target already routed → no prompt" || bad "already-routed install: $out"
grep -q 'setup.d/skill-routing.sh" install "\$MODE"' "$REPO_ROOT/setup" \
  && ok "./setup runs the skill-routing step with its mode" || bad "./setup does not wire setup.d/skill-routing.sh install"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
