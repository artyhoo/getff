#!/usr/bin/env bash
# monorepo-stack-fallback.test.sh — P0.3 (ultrareview): multi-stack monorepo config placement must
# honor an explicit positional stack arg + fall back to the ROOT package.json signal (hoisting-aware)
# so a pnpm monorepo that hoists `typescript` to the root does NOT land ZERO eslint configs.
#
# Observed live (pnpm monorepo): _detect_stack_from_pkg greps each WORKSPACE package.json, but pnpm
# hoists shared deps (typescript) to the ROOT, so every workspace classifies `unknown`. The multi-
# stack branch (setup.d/40-configs.sh) then places NOTHING and the explicit `./setup ts-server` arg
# was never consulted in that branch → `lint` crashes rc=2 (no eslint config anywhere) → pre-commit
# blocks EVERY commit (DoS) while the installer still exits 0.
#
# Precedence per workspace (verbatim from the P0.3 brief):
#   own package.json signal  >  explicit positional STACK arg  >  root package.json signal  >  unknown
# A STILL-unknown workspace (own + explicit + root all signal-free) stays a re-checkable marker,
# never a per-workspace exit 1 (setup.d/lib.sh _detect_stacks_per_workspace §13.5 fork-2 default).
# But if the WHOLE multi-stack path placed ZERO configs, install FAILS LOUD (aggregate), naming the
# workspaces — the silent zero-config install is the observed commit-DoS.
#
# Arms (each able to fail — T15 paired-negative; every arm has ≥1 assertion that is RED pre-fix):
#   (a) HOISTED    — root `typescript`, workspaces signal-free, NO arg → every workspace gets
#                    eslint.config.mjs via ROOT fallback; rc=0.
#   (b) EXPLICIT   — no signal anywhere, `ts-server` positional arg → configs placed per the arg; rc=0.
#   (c) ALL-UNKNOWN (loud-fail arm) — no signal, menu-chosen stack (NOT positional, so STACK_EXPLICIT
#                    stays unset) → ZERO configs would be placed → install exits NON-zero + names the
#                    workspaces. Pre-fix: rc=0 + zero configs (the DoS) → this arm FAILS against
#                    current code.
#   (d) PRECEDENCE — workspace with its own `next` + explicit `ts-server` arg → that workspace keeps
#                    react-next (own signal WINS over the explicit arg); a signal-free sibling takes
#                    the explicit arg.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL_SH="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# Borrow the framework node_modules so node-touching install steps (detect_pm field probe,
# patch_stryker) resolve. Config PLACEMENT itself is node-free (grep-based), so absence is tolerated.
_borrow_nm() {  # $1 = fixture root
  local nm
  for nm in "$REPO_ROOT/node_modules" "$REPO_ROOT/packages/core/node_modules"; do
    if [ -d "$nm" ] && [ ! -e "$1/node_modules" ]; then ln -s "$nm" "$1/node_modules"; return 0; fi
  done
  return 0
}

echo "▶ P0.3 — monorepo root-fallback + explicit arg + loud all-unknown"
echo ""

# ── (a) HOISTED: root typescript, workspaces signal-free, no arg → root fallback places configs ──
echo "▶ (a) hoisted monorepo (root typescript, no arg) → root fallback"
A=$(mktemp -d)
mkdir -p "$A/apps/api" "$A/apps/worker"
printf '{ "name": "hoisted-mono", "private": true, "devDependencies": { "typescript": "^5.4.0" } }\n' > "$A/package.json"
printf 'packages:\n  - "apps/*"\n' > "$A/pnpm-workspace.yaml"
printf '{ "name": "api" }\n'    > "$A/apps/api/package.json"
printf '{ "name": "worker" }\n' > "$A/apps/worker/package.json"
_borrow_nm "$A"
( cd "$A" && git init -q && bash "$INSTALL_SH" --force </dev/null ) >"$A/.log" 2>&1; a_rc=$?
[ "$a_rc" -eq 0 ] && ok "(a) hoisted install rc=0" \
  || bad "(a) hoisted install rc=$a_rc (tail: $(tail -3 "$A/.log" | tr '\n' '|'))"
if [ -f "$A/apps/api/eslint.config.mjs" ] && [ -f "$A/apps/worker/eslint.config.mjs" ]; then
  ok "(a) both workspaces got eslint.config.mjs via ROOT fallback (hoisted typescript)"
else
  bad "(a) missing per-workspace eslint config (api:$([ -f "$A/apps/api/eslint.config.mjs" ] && echo y || echo n) worker:$([ -f "$A/apps/worker/eslint.config.mjs" ] && echo y || echo n)) — root fallback not applied"
fi
grep -q 'root package.json fallback' "$A/.log" \
  && ok "(a) install output shows WHY (root package.json fallback provenance)" \
  || bad "(a) no root-fallback provenance in install output (tail: $(tail -4 "$A/.log" | tr '\n' '|'))"
rm -rf "$A"
echo ""

# ── (b) EXPLICIT: no signal anywhere, `ts-server` positional arg → configs placed per the arg ──
echo "▶ (b) explicit positional arg (no signal anywhere) → arg honored in multi-stack branch"
B=$(mktemp -d)
mkdir -p "$B/apps/api" "$B/apps/worker"
printf '{ "name": "nosignal-mono", "private": true }\n' > "$B/package.json"
printf 'packages:\n  - "apps/*"\n' > "$B/pnpm-workspace.yaml"
printf '{ "name": "api" }\n'    > "$B/apps/api/package.json"
printf '{ "name": "worker" }\n' > "$B/apps/worker/package.json"
_borrow_nm "$B"
( cd "$B" && git init -q && bash "$INSTALL_SH" ts-server --force </dev/null ) >"$B/.log" 2>&1; b_rc=$?
[ "$b_rc" -eq 0 ] && ok "(b) explicit-arg install rc=0" \
  || bad "(b) explicit-arg install rc=$b_rc (tail: $(tail -3 "$B/.log" | tr '\n' '|'))"
if [ -f "$B/apps/api/eslint.config.mjs" ] && [ -f "$B/apps/worker/eslint.config.mjs" ]; then
  ok "(b) both workspaces got eslint.config.mjs from the explicit ts-server arg"
else
  bad "(b) explicit arg NOT honored in multi-stack branch (api:$([ -f "$B/apps/api/eslint.config.mjs" ] && echo y || echo n) worker:$([ -f "$B/apps/worker/eslint.config.mjs" ] && echo y || echo n))"
fi
grep -q 'explicit stack arg' "$B/.log" \
  && ok "(b) install output shows WHY (explicit stack arg provenance)" \
  || bad "(b) no explicit-arg provenance in install output (tail: $(tail -4 "$B/.log" | tr '\n' '|'))"
rm -rf "$B"
echo ""

# ── (c) ALL-UNKNOWN: no signal, menu-chosen (NOT positional) → aggregate loud-fail ──
echo "▶ (c) all-unknown monorepo (menu choice, not positional) → aggregate loud-fail"
C=$(mktemp -d)
mkdir -p "$C/apps/api" "$C/apps/worker"
printf '{ "name": "unknown-mono", "private": true }\n' > "$C/package.json"
printf 'packages:\n  - "apps/*"\n' > "$C/pnpm-workspace.yaml"
printf '{ "name": "api" }\n'    > "$C/apps/api/package.json"
printf '{ "name": "worker" }\n' > "$C/apps/worker/package.json"
_borrow_nm "$C"
# No positional arg → auto-detect fails (root signal-free) → interactive menu. Feed "1" (ts-server).
# The menu choice is NOT a positional arg, so STACK_EXPLICIT stays unset → the workspaces remain
# unknown after all three fallbacks → the aggregate loud-fail MUST fire (pre-fix: silent rc=0).
( cd "$C" && git init -q && printf '1\n' | bash "$INSTALL_SH" --force ) >"$C/.log" 2>&1; c_rc=$?
[ "$c_rc" -ne 0 ] \
  && ok "(c) all-unknown monorepo → install exits NON-zero (loud-fail, not silent DoS)" \
  || bad "(c) all-unknown monorepo → install exited 0 (SILENT zero-config DoS — P0.3 unfixed)"
grep -q 'ZERO per-workspace ESLint configs' "$C/.log" \
  && ok "(c) loud-fail emits the instructive zero-config aggregate message" \
  || bad "(c) no aggregate zero-config loud-fail message (tail: $(tail -6 "$C/.log" | tr '\n' '|'))"
if grep -q 'apps/api' "$C/.log" && grep -q 'apps/worker' "$C/.log"; then
  ok "(c) loud-fail names the unknown workspaces (apps/api, apps/worker)"
else
  bad "(c) loud-fail did not name the workspaces (tail: $(tail -6 "$C/.log" | tr '\n' '|'))"
fi
# paired-negative: the DoS premise — zero eslint configs actually on disk
if [ ! -f "$C/apps/api/eslint.config.mjs" ] && [ ! -f "$C/apps/worker/eslint.config.mjs" ]; then
  ok "(c) neg: zero eslint configs on disk (the DoS the loud-fail prevents)"
else
  bad "(c) neg: an eslint config WAS placed — arm-c premise (zero configs) invalid"
fi
rm -rf "$C"
echo ""

# ── (d) PRECEDENCE: own `next` signal WINS over explicit `ts-server`; signal-free sibling takes arg ──
echo "▶ (d) precedence: own signal > explicit arg > root > unknown"
D=$(mktemp -d)
mkdir -p "$D/apps/web" "$D/apps/api"
printf '{ "name": "precedence-mono", "private": true, "devDependencies": { "typescript": "^5.4.0" } }\n' > "$D/package.json"
printf 'packages:\n  - "apps/*"\n' > "$D/pnpm-workspace.yaml"
printf '{ "name": "web", "dependencies": { "next": "15.0.0", "react": "19.0.0" } }\n' > "$D/apps/web/package.json"
printf '{ "name": "api" }\n' > "$D/apps/api/package.json"
_borrow_nm "$D"
( cd "$D" && git init -q && bash "$INSTALL_SH" ts-server --force </dev/null ) >"$D/.log" 2>&1; d_rc=$?
[ "$d_rc" -eq 0 ] && ok "(d) precedence install rc=0" \
  || bad "(d) precedence install rc=$d_rc (tail: $(tail -3 "$D/.log" | tr '\n' '|'))"
if grep -qE 'apps/web → react-next' "$D/.log" && ! grep -qE 'apps/web → ts-server' "$D/.log"; then
  ok "(d) apps/web keeps react-next (own signal WINS over explicit ts-server arg)"
else
  bad "(d) apps/web did NOT keep its own react-next signal (tail: $(grep -E 'apps/web' "$D/.log" | tr '\n' '|'))"
fi
grep -qE 'apps/api → ts-server' "$D/.log" \
  && ok "(d) apps/api (signal-free) → ts-server via the explicit arg" \
  || bad "(d) apps/api did not resolve to the explicit ts-server arg (tail: $(grep -E 'apps/api' "$D/.log" | tr '\n' '|'))"
rm -rf "$D"
echo ""

# ── (e) FORK-2 DEFAULT: a STILL-unknown workspace stays a KEPT re-checkable marker (rc=0, not exit 1)
#        when a sibling IS placed. Reached via the menu path (root signal-free + NO positional arg →
#        auto-detect fails → menu; the menu choice is NOT positional so STACK_EXPLICIT stays unset).
#        apps/web has its own `next` signal (placed); apps/svc is signal-free AND root is signal-free
#        AND there is no explicit arg → apps/svc stays unknown → NOT exit 1, and the aggregate loud-
#        fail does NOT fire because ≥1 config was placed. This is the §13.5 fork-2 default (binding). ──
echo "▶ (e) fork-2 default: still-unknown workspace kept as marker (sibling placed → rc=0, not loud-fail)"
E=$(mktemp -d)
mkdir -p "$E/apps/web" "$E/apps/svc"
printf '{ "name": "mixed-mono", "private": true }\n' > "$E/package.json"
printf 'packages:\n  - "apps/*"\n' > "$E/pnpm-workspace.yaml"
printf '{ "name": "web", "dependencies": { "next": "15.0.0", "react": "19.0.0" } }\n' > "$E/apps/web/package.json"
printf '{ "name": "svc" }\n' > "$E/apps/svc/package.json"
_borrow_nm "$E"
# Menu choice "2" (react-next) — NOT positional → STACK_EXPLICIT stays unset → apps/svc has no
# fallback source (own unknown, no explicit arg, root signal-free) → stays unknown.
( cd "$E" && git init -q && printf '2\n' | bash "$INSTALL_SH" --force ) >"$E/.log" 2>&1; e_rc=$?
[ "$e_rc" -eq 0 ] \
  && ok "(e) mixed repo (1 placed, 1 still-unknown) → rc=0 (NOT loud-fail: a config WAS placed)" \
  || bad "(e) mixed repo exited $e_rc — a still-unknown sibling must NOT abort when another placed (tail: $(tail -5 "$E/.log" | tr '\n' '|'))"
[ -f "$E/apps/web/eslint.config.mjs" ] \
  && ok "(e) apps/web (own next signal) got a config" \
  || bad "(e) apps/web (own next) got NO config"
if [ ! -f "$E/apps/svc/eslint.config.mjs" ] && grep -qi 'apps/svc: unknown stack' "$E/.log"; then
  ok "(e) apps/svc kept as re-checkable 'unknown' marker (no config, no per-workspace exit 1)"
else
  bad "(e) apps/svc not a kept-unknown marker (svc-config:$([ -f "$E/apps/svc/eslint.config.mjs" ] && echo y || echo n); log: $(grep -i 'apps/svc' "$E/.log" | tr '\n' '|'))"
fi
# NEG: the aggregate zero-config loud-fail must NOT fire when ≥1 config was placed.
! grep -q 'ZERO per-workspace ESLint configs' "$E/.log" \
  && ok "(e) neg: aggregate loud-fail did NOT fire (≥1 config placed → not the all-unknown case)" \
  || bad "(e) neg: aggregate loud-fail fired despite a placed config — over-eager abort"
rm -rf "$E"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
