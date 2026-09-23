#!/usr/bin/env bash
# install-self-verify-skip-and-exit.test.sh — critical-review wave 2: the --full install
# self-verify capstone (setup.d/99-finalize.sh) must count what it proved, and say so in its rc.
#
#   S4-7  a check that RAN but checked nothing (manifest absent, non-git dir, no fence probed)
#         exited 0 and was counted as PASS. The capstone now asks each check for the
#         automake/TAP SKIP code (GETFF_SKIP_RC=77) and counts rc 77 as SKIP. Default rc for
#         every other caller stays 0 (paired arm on each real leaf script).
#   S4-8  a self-verify FAIL printed a warning and still ended in «Installation complete», rc 0.
#         It now ends non-zero with a banner that says so (paired: all-pass stays rc 0).
#   NW    a surface this install deliberately left unwired (consumer-owned hooks, a hooksPath
#         it did not activate, the consumer's own ESLint config) is SKIP, not a FAIL that
#         contradicts the NOT wired summary and not a PASS the install never earned.
#   NW-h  a consumer-owned .husky hook the install kept is named in the NOT wired summary.
#
# Capstone arms source 99-finalize.sh with stubbed dispatcher scope (same harness as
# install-self-verify-banner-honesty.test.sh); leaf arms run the real shipped scripts.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FINALIZE="$REPO_ROOT/setup.d/99-finalize.sh"

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "✗ $1"; }

if ! command -v node >/dev/null 2>&1; then
  echo "· node not available — SKIP (99-finalize's early blocks probe node)"
  echo ""; echo "PASS=$PASS FAIL=$FAIL"; exit 0
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

DRIVER="$WORK/driver.sh"
cat > "$DRIVER" << 'EOF'
set -o pipefail
FULL=1; DRY_RUN=""; STACK="ts-server"
SKIPPED=(); NOT_WIRED=(); DEVDEPS=(placeholder-dev); RUNTIME_DEPS=(placeholder-rt)
_detect_stacks_per_workspace() { :; }
ignore_shipped_configs() { :; }
detect_pm() { echo npm; }
warn_preset_staleness() { :; }
reassert_husky_shields() { :; }
source "$FINALIZE"
EOF

# run_capstone <proj> <pkg> [VAR=val …] → capstone+done output; rc of the dispatcher in $CAP_RC
run_capstone() {
  local proj="$1" pkg="$2"; shift 2
  CAP_OUT=$(env -u CI "$@" PROJECT_ROOT="$proj" PKG_ROOT="$pkg" FINALIZE="$FINALIZE" \
    DEPS_INSTALLED=1 bash "$DRIVER" 2>&1)
  CAP_RC=$?
}

# make_tree <name> <ff-body> <su-body> <mut-body> — stub gate scripts; each records it ran and
# the GETFF_SKIP_RC it was handed into $WORK/<name>.<gate>.ran
make_tree() {
  local name="$1" ff="$2" su="$3" mut="$4" proj pkg
  proj="$WORK/$name-proj"; pkg="$WORK/$name-pkg"
  mkdir -p "$proj/scripts" "$pkg/packages/core/audit-self"
  printf '#!/usr/bin/env bash\necho "rc=${GETFF_SKIP_RC:-unset}" > %s\n%s\n' "$WORK/$name.ff.ran" "$ff" > "$proj/scripts/check-fences-fire.sh"
  printf '#!/usr/bin/env bash\necho "rc=${GETFF_SKIP_RC:-unset} consumer=${AIF_SHIELDS_CONSUMER_HOOKS:-}" > %s\n%s\n' "$WORK/$name.su.ran" "$su" > "$proj/scripts/check-shields-up.sh"
  printf '#!/usr/bin/env bash\necho "rc=${GETFF_SKIP_RC:-unset}" > %s\n%s\n' "$WORK/$name.mut.ran" "$mut" > "$pkg/packages/core/audit-self/check-generated-rule-mutation.sh"
  chmod +x "$proj/scripts/"*.sh "$pkg/packages/core/audit-self/"*.sh
  : > "$proj/eslint.config.mjs"
}

# ─── S4-7 capstone: a check that returns the SKIP code is SKIP, never PASS ─────
make_tree skipall 'exit "${GETFF_SKIP_RC:-0}"' 'exit "${GETFF_SKIP_RC:-0}"' 'exit "${GETFF_SKIP_RC:-0}"'
run_capstone "$WORK/skipall-proj" "$WORK/skipall-pkg"
if grep -q 'rc=77' "$WORK/skipall.ff.ran" 2>/dev/null && grep -q 'rc=77' "$WORK/skipall.su.ran" 2>/dev/null \
  && grep -q 'rc=77' "$WORK/skipall.mut.ran" 2>/dev/null; then
  ok "S4-7: the capstone hands every check GETFF_SKIP_RC=77"
else
  bad "S4-7: the capstone did not hand GETFF_SKIP_RC=77 to every check (ff: $(cat "$WORK/skipall.ff.ran" 2>/dev/null) su: $(cat "$WORK/skipall.su.ran" 2>/dev/null) mut: $(cat "$WORK/skipall.mut.ran" 2>/dev/null))"
fi
if printf '%s\n' "$CAP_OUT" | grep -q 'checks passed — fences fire'; then
  bad "S4-7: three checks that checked nothing were reported as the success property line"
else
  ok "S4-7: checks that checked nothing do not produce the success property line"
fi
if printf '%s\n' "$CAP_OUT" | grep -qE 'self-verify: ✓ 0 passed · ⚠ 3 skipped'; then
  ok "S4-7: banner counts 0 passed, 3 skipped"
else
  bad "S4-7: banner does not count 0 passed / 3 skipped (got: $(printf '%s\n' "$CAP_OUT" | grep 'self-verify:' | tail -1))"
fi

# ─── S4-7 leaf scripts: real shipped scripts return 77 only when asked ─────────
EMPTY="$WORK/empty-consumer"; mkdir -p "$EMPTY"
MUT="$REPO_ROOT/packages/core/audit-self/check-generated-rule-mutation.sh"
SU="$REPO_ROOT/packages/core/audit-self/check-shields-up.sh"
FF="$REPO_ROOT/packages/core/audit-self/check-fences-fire.sh"
leaf() {  # leaf <label> <script> <expected rc with 77> — runs the script twice in $EMPTY
  local label="$1" script="$2" rc_on rc_off
  ( cd "$EMPTY" && env -u CI GETFF_SKIP_RC=77 AIF_PROJECT_ROOT="$EMPTY" bash "$script" "$EMPTY" ) >/dev/null 2>&1; rc_on=$?
  ( cd "$EMPTY" && env -u CI -u GETFF_SKIP_RC AIF_PROJECT_ROOT="$EMPTY" bash "$script" "$EMPTY" ) >/dev/null 2>&1; rc_off=$?
  if [ "$rc_on" = "77" ]; then
    ok "S4-7 leaf $label: checked nothing + GETFF_SKIP_RC=77 → rc 77"
  else
    bad "S4-7 leaf $label: checked nothing + GETFF_SKIP_RC=77 → rc $rc_on (expected 77)"
  fi
  if [ "$rc_off" = "0" ]; then
    ok "S4-7 leaf $label: without GETFF_SKIP_RC the rc stays 0 (other callers unchanged)"
  else
    bad "S4-7 leaf $label: without GETFF_SKIP_RC the rc changed to $rc_off"
  fi
}
leaf "generated-rule-mutation (manifest absent)" "$MUT"
leaf "shields-up (not a git repository)" "$SU"
leaf "fences-fire (no fence probed)" "$FF"

# ─── S4-8: a FAIL reaches the exit code; all-pass stays 0 ─────────────────────
make_tree onefail 'exit 0' 'exit 1' 'exit 0'
run_capstone "$WORK/onefail-proj" "$WORK/onefail-pkg"
if [ "$CAP_RC" -ne 0 ]; then
  ok "S4-8: a self-verify FAIL ends the install non-zero (rc $CAP_RC)"
else
  bad "S4-8: a self-verify FAIL still ended the install with rc 0"
fi
if printf '%s\n' "$CAP_OUT" | grep -q '✅ Installation complete'; then
  bad "S4-8: a self-verify FAIL still printed «✅ Installation complete»"
else
  ok "S4-8: a self-verify FAIL does not print «✅ Installation complete»"
fi
make_tree allpass 'exit 0' 'exit 0' 'exit 0'
run_capstone "$WORK/allpass-proj" "$WORK/allpass-pkg"
if [ "$CAP_RC" -eq 0 ] && printf '%s\n' "$CAP_OUT" | grep -q '✅ Installation complete'; then
  ok "S4-8 paired: all checks pass → rc 0 and «✅ Installation complete»"
else
  bad "S4-8 paired: all checks pass but rc=$CAP_RC or no success banner"
fi

# ─── NW: surfaces this install left unwired are SKIP, and their check is not run ─
nw_arm() {  # nw_arm <label> <gate(ff|su)> <VAR=val…> — the gate must not run, banner names SKIP
  local label="$1" gate="$2" name; shift 2
  name="nw-$gate-$(printf '%s' "$label" | tr -c 'a-z0-9' '-')"
  make_tree "$name" 'exit 0' 'exit 1' 'exit 0'
  [ "$gate" = "ff" ] && sed -i.bak 's/^exit 0$/exit 1/' "$WORK/$name-proj/scripts/check-fences-fire.sh"
  [ "$gate" = "su" ] || sed -i.bak 's/^exit 1$/exit 0/' "$WORK/$name-proj/scripts/check-shields-up.sh"
  run_capstone "$WORK/$name-proj" "$WORK/$name-pkg" "$@"
  if [ ! -e "$WORK/$name.$gate.ran" ] && [ "$CAP_RC" -eq 0 ] \
    && printf '%s\n' "$CAP_OUT" | grep -qE 'self-verify: .*1 skipped'; then
    ok "NW $label: check not run, counted as skipped, install rc 0"
  else
    bad "NW $label: ran=$([ -e "$WORK/$name.$gate.ran" ] && echo yes || echo no) rc=$CAP_RC banner=$(printf '%s\n' "$CAP_OUT" | grep 'self-verify:' | tail -1)"
  fi
}
# A kept consumer hook exempts only itself: shields-up still runs (hooksPath + the other hook) and
# is told which hook to skip by name; its FAIL still counts (cold-review F6).
for _su in 'exit 1' 'exit 0'; do
  make_tree nw-consumer-hook 'exit 0' "$_su" 'exit 0'
  run_capstone "$WORK/nw-consumer-hook-proj" "$WORK/nw-consumer-hook-pkg" HUSKY_CONSUMER_HOOKS=" pre-commit"
  if ! grep -q 'consumer=.*pre-commit' "$WORK/nw-consumer-hook.su.ran" 2>/dev/null; then
    bad "NW consumer-owned pre-commit ($_su): shields-up not run with AIF_SHIELDS_CONSUMER_HOOKS=pre-commit ($(cat "$WORK/nw-consumer-hook.su.ran" 2>/dev/null || echo 'did not run'))"
  elif [ "$_su" = 'exit 1' ] && [ "$CAP_RC" -ne 0 ]; then
    ok "NW consumer-owned pre-commit: shields-up still runs, told to skip pre-commit only, and its FAIL counts"
  elif [ "$_su" = 'exit 0' ] && [ "$CAP_RC" -eq 0 ] && printf '%s\n' "$CAP_OUT" | grep -qE 'self-verify: .*1 skipped' \
       && ! printf '%s\n' "$CAP_OUT" | grep -q 'checks passed — fences fire, shields wired'; then
    # A pass that exempted a kept hook never proves «shields wired» (cold-review round 2, N1).
    ok "NW consumer-owned pre-commit paired: a passing shields-up with the exemption → rc 0, counted as skipped, no «shields wired»"
  else
    bad "NW consumer-owned pre-commit ($_su): install rc=$CAP_RC banner=$(printf '%s\n' "$CAP_OUT" | grep 'self-verify:' | tail -1)"
  fi
  rm -f "$WORK/nw-consumer-hook.su.ran"
done
nw_arm "git hooks not activated" su HUSKY_HOOKS_BLOCKED="core.hooksPath is .githooks"
nw_arm "consumer ESLint config kept" ff ESLINT_ROOT_NOT_WIRED=1
# paired: the same trees with no NOT wired signal run the (failing) check and fail the install
make_tree nw-paired 'exit 0' 'exit 1' 'exit 0'
run_capstone "$WORK/nw-paired-proj" "$WORK/nw-paired-pkg"
if [ -e "$WORK/nw-paired.su.ran" ] && [ "$CAP_RC" -ne 0 ]; then
  ok "NW paired: without a NOT wired signal the shields check runs and its FAIL counts"
else
  bad "NW paired: shields check ran=$([ -e "$WORK/nw-paired.su.ran" ] && echo yes || echo no) rc=$CAP_RC"
fi

# ─── NW-h: a kept consumer hook is named in the NOT wired summary (real install) ─
TC="$WORK/consumer-hooks"; mkdir -p "$TC/.husky"
( cd "$TC" && git init -q . && printf '{ "name":"c","version":"0.0.0" }\n' > package.json )
printf '#!/bin/sh\necho consumer-own-pre-commit\n' > "$TC/.husky/pre-commit"; chmod +x "$TC/.husky/pre-commit"
OUT_H=$( cd "$TC" && env -u CI bash "$REPO_ROOT/install.sh" ts-server < /dev/null 2>&1 )
if printf '%s\n' "$OUT_H" | grep -A20 'NOT wired' | grep -q '\.husky/pre-commit'; then
  ok "NW-h: the kept consumer .husky/pre-commit is named in the NOT wired summary"
else
  bad "NW-h: the kept consumer .husky/pre-commit is missing from the NOT wired summary"
fi
if grep -q 'consumer-own-pre-commit' "$TC/.husky/pre-commit"; then
  ok "NW-h precondition: the consumer's pre-commit bytes were kept"
else
  bad "NW-h precondition: the consumer's pre-commit was overwritten"
fi
if printf '%s\n' "$OUT_H" | grep -A20 'NOT wired' | grep -q '\.husky/pre-push'; then
  bad "NW-h: the framework-delivered .husky/pre-push was wrongly listed as NOT wired"
else
  ok "NW-h paired: the framework-delivered .husky/pre-push is not listed"
fi

# ─── NW-h2: following the printed advice keeps the hook the consumer's (cold-review F4) ─
# The advice is pasted into the consumer's own hook. If it carried the framework's identity marker,
# the next --full run would classify the hook as the framework's and reassert_husky_shields would
# overwrite it — the exact loss the NOT wired line exists to prevent.
TC2="$WORK/consumer-hooks-2"; mkdir -p "$TC2/.husky"
( cd "$TC2" && git init -q . && printf '{ "name":"c2","version":"0.0.0" }\n' > package.json )
for _h in pre-commit pre-push; do
  printf '#!/bin/sh\necho consumer-own-%s\n' "$_h" > "$TC2/.husky/$_h"; chmod +x "$TC2/.husky/$_h"
done
OUT_H2=$( cd "$TC2" && env -u CI bash "$REPO_ROOT/install.sh" ts-server < /dev/null 2>&1 )
for _h in pre-commit pre-push; do
  _advice=$(printf '%s\n' "$OUT_H2" | sed -n "s|.*your own \.husky/$_h is kept.*call from it: ||p" | head -1)
  if [ -z "$_advice" ]; then
    bad "NW-h2 $_h: no «call from it:» advice printed for the kept hook"
    continue
  fi
  printf '%s\n' "$_advice" >> "$TC2/.husky/$_h"
  _classified=$( HUSKY_CONSUMER_HOOKS=""; FORCE=""; source "$REPO_ROOT/setup.d/lib.sh" >/dev/null 2>&1
    husky_note_consumer_hooks "$REPO_ROOT" "$TC2"; printf '%s' "$HUSKY_CONSUMER_HOOKS" )
  case " $_classified " in
    *" $_h "*) ok "NW-h2 $_h: a hook that follows the advice is still the consumer's (never re-asserted over)" ;;
    *)         bad "NW-h2 $_h: pasting the advice ($_advice) made the hook read as the framework's — --full would overwrite it" ;;
  esac
done

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
