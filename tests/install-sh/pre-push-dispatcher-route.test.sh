#!/usr/bin/env bash
# pre-push-dispatcher-route.test.sh — the shipped pre-push dispatcher runs the PREBUILT hook with plain
# `node`, and degrades (never crashes, never blocks) when it cannot.
#
# The consumer's TS-core hook is packages/core/hooks/pre-push.bundle.mjs (scripts/build-runtime-bundles.mjs):
# one dependency-free .mjs, so the dispatcher needs neither tsx nor node_modules. It used to exec
# `node --import tsx/esm pre-push.ts` behind a tsx probe (GH #636/#638) — that runtime, and the .ts files
# it needed in the consumer's tree, are what turned a project's own lint/typecheck RED after install.
#
# This test EXECUTES the dispatcher's routing with a stubbed `node` on PATH (major version controllable):
#   - Node ≥20 + bundle present   → ROUTE=BUNDLE, with NO `--import` flag on the exec (no tsx loader).
#   - Node ≥20 + bundle ABSENT    → ROUTE=FALLBACK (paired-negative: the bundle arm is gated on the file).
#   - Node 18 + bundle present    → ROUTE=FALLBACK (paired-negative: the version gate is live).
#   - no fallback either          → exit 0 with a warning (a push is never blocked by a missing runtime).
# The negatives make the positive non-vacuous (ai-laziness-traps T1/T14): a dispatcher that always took
# one route would fail at least one arm.
#
# Deterministic, no network. DISPATCHER may be overridden to run the arms against another copy.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
DISPATCHER="${DISPATCHER:-$REPO_ROOT/packages/core/templates/shared/husky-pre-push.sh}"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

[ -f "$DISPATCHER" ] || { echo "FATAL: dispatcher not found at $DISPATCHER"; exit 1; }

# A throwaway git repo carrying the consumer hook layout: marker bundle + marker fallback, so the route
# the dispatcher took is visible on stdout without running the real hook.
mk_repo() { # [bundle|no-bundle] [fallback|no-fallback]
  local d; d=$(mktemp -d)
  ( cd "$d" && git init -q )
  mkdir -p "$d/packages/core/hooks"
  [ "$1" = bundle ] && printf '// prebuilt hook\n' > "$d/packages/core/hooks/pre-push.bundle.mjs"
  if [ "$2" = fallback ]; then
    printf '#!/usr/bin/env bash\necho "ROUTE=FALLBACK"\nexit 0\n' > "$d/packages/core/hooks/pre-push.fallback.sh"
    chmod +x "$d/packages/core/hooks/pre-push.fallback.sh"
  fi
  echo "$d"
}

# Stubbed `node`: answers the major-version query, otherwise reports how it was exec'd.
mk_nodebin() { # <major>
  local d; d=$(mktemp -d)
  cat > "$d/node" <<NODE
#!/usr/bin/env bash
case "\$*" in *"process.versions.node"*) echo $1; exit 0 ;; esac
case " \$* " in *" --import "*) echo "ROUTE=LOADER args=[\$*]"; exit 0 ;; esac
case "\$1" in *pre-push.bundle.mjs) echo "ROUTE=BUNDLE args=[\$*]"; exit 0 ;; esac
echo "ROUTE=OTHER args=[\$*]"; exit 0
NODE
  chmod +x "$d/node"
  echo "$d"
}

run_dispatcher() { # <repo> <nodebin-dir>
  ( cd "$1" && PATH="$2:$PATH" bash "$DISPATCHER" 2>&1 )
}

NODE22=$(mk_nodebin 22)
NODE18=$(mk_nodebin 18)

# ── POSITIVE: Node ≥20 + bundle → plain `node <bundle>`, no loader ──
OUT=$(run_dispatcher "$(mk_repo bundle fallback)" "$NODE22"); RC=$?
if [ "$RC" -eq 0 ] && printf '%s' "$OUT" | grep -q "ROUTE=BUNDLE"; then
  ok "pos: Node 22 + bundle present → exec plain node on pre-push.bundle.mjs"
else
  bad "pos: Node 22 + bundle did not run the bundle — rc=$RC out=[$OUT]"
fi
printf '%s' "$OUT" | grep -q "ROUTE=LOADER" \
  && bad "pos: the dispatcher still passes an --import loader (tsx) — out=[$OUT]" \
  || ok "pos: no --import loader on the exec (the bundle needs no tsx)"

# ── NEG: bundle absent → fallback ──
OUT=$(run_dispatcher "$(mk_repo no-bundle fallback)" "$NODE22"); RC=$?
if [ "$RC" -eq 0 ] && printf '%s' "$OUT" | grep -q "ROUTE=FALLBACK"; then
  ok "neg: Node 22 + bundle absent → bash fallback (the bundle arm is gated on the file)"
else
  bad "neg: bundle absent did not degrade to the fallback — rc=$RC out=[$OUT]"
fi

# ── NEG: Node 18 → fallback ──
OUT=$(run_dispatcher "$(mk_repo bundle fallback)" "$NODE18"); RC=$?
if [ "$RC" -eq 0 ] && printf '%s' "$OUT" | grep -q "ROUTE=FALLBACK"; then
  ok "neg: Node 18 + bundle present → bash fallback (the Node ≥20 gate is live)"
else
  bad "neg: Node 18 did not degrade to the fallback — rc=$RC out=[$OUT]"
fi

# ── DEGRADE: nothing runnable → warn + exit 0, never a blocked push ──
OUT=$(run_dispatcher "$(mk_repo no-bundle no-fallback)" "$NODE18"); RC=$?
if [ "$RC" -eq 0 ] && printf '%s' "$OUT" | grep -q "skipping checks"; then
  ok "degrade: no runnable hook → warning + exit 0 (push not blocked)"
else
  bad "degrade: expected a warning and exit 0 — rc=$RC out=[$OUT]"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
