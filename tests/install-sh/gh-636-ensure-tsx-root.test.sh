#!/usr/bin/env bash
# gh-636-ensure-tsx-root.test.sh — install.sh must GUARANTEE that `tsx` (the pre-push TS hook
# runtime) resolves from the workspace ROOT.
#
# BUG (#636, fix "a"): the dispatcher runs `node --import tsx/esm <root>/packages/core/hooks/
# pre-push.ts` from the repo ROOT, so tsx must resolve THERE. tsx is in CORE_DEVDEPS, but on a pnpm
# monorepo a tsx that lives in a sub-package is NOT hoisted to the root, so the TS hook silently
# degrades to the bash fallback (critical-only checks; #638 made that graceful instead of a crash).
# Fix "a" closes the gap at INSTALL time: probe tsx-at-root; if missing, install it at the root
# (--full → silent; interactive tty → [y/N]; refused / non-interactive → WARN with the exact command).
#
# OWNER SPEC (the target this test pins):
#   tsx already resolvable from root   → nothing
#   tsx missing, --full                → install at the workspace root, silently
#   tsx missing, interactive (tty)     → offer [y/N]; on yes install — EVEN without --full
#   tsx missing, refused / non-tty     → WARN: pre-push runs REDUCED; print the exact enabling command
#
# NO REAL INSTALL / NO NETWORK. A FAKE package manager on PATH records its argv and faithfully models
# the #636 monorepo reality: a TARGETED root add (tsx is the SOLE package) lands tsx at the root (it
# drops a minimal real tsx module so `node --import tsx/esm -e ''` resolves afterward); a BULK add
# does NOT hoist tsx to the root (exactly the #636 not-hoisted bug, which forces fix "a" to act even
# after a --full bulk install). node / npx / git are NOT shadowed, so the real probe runs.
#
# PAIRED-NEGATIVES (LOAD-BEARING, ai-laziness-traps T1/T14 non-vacuity):
#   - Arm C: tsx ALREADY resolves → §8b no-ops (no warn, no install). Same inputs as Arm B except tsx
#     present → proves the warn/install are CONDITIONAL on tsx-missing, not unconditional.
#   - Arm E1: a FLAT pnpm consumer's warn prints 'pnpm add -D tsx' WITHOUT -w (Arm B's workspace warn
#     proves -w IS added) → the -w branch is non-vacuous.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# The probe is real node behaviour — node is a hard requirement (the framework's own suite needs it).
command -v node >/dev/null 2>&1 || { echo "FATAL: node not on PATH — the tsx probe cannot run"; exit 1; }

# ── fake PMs on PATH ──────────────────────────────────────────────────────────────────────────────
FAKEBIN=$(mktemp -d)
make_fake_pm() {  # $1 = pm name
  cat > "$FAKEBIN/$1" <<'PM'
#!/bin/sh
printf '%s\n' "$*" >> "$AIF_PM_LOG"
# Faithful #636 model: drop a minimal real tsx at the ROOT only for a TARGETED add (tsx = the sole
# non-flag package). A BULK add (the full toolchain) does NOT hoist tsx to the root.
_sub="$1"; shift 2>/dev/null || true
_pkgs=""
for _a in "$@"; do case "$_a" in -*) ;; *) _pkgs="$_pkgs $_a" ;; esac; done
# shellcheck disable=SC2086
set -- $_pkgs
if [ "$#" -eq 1 ]; then
  case "$1" in
    tsx|tsx@*)
      mkdir -p "$PWD/node_modules/tsx"
      printf '{"name":"tsx","version":"0.0.0","exports":{"./esm":"./esm.mjs"}}\n' > "$PWD/node_modules/tsx/package.json"
      : > "$PWD/node_modules/tsx/esm.mjs" ;;
  esac
fi
exit 0
PM
  chmod +x "$FAKEBIN/$1"
}
make_fake_pm npm; make_fake_pm pnpm; make_fake_pm yarn
export PATH="$FAKEBIN:$PATH"

# ── python pty driver — feeds ordered answers to a REAL tty (the interactive arm). stdlib only. ──
PTY=$(mktemp)
cat > "$PTY" <<'PY'
import os, sys, pty, select
sep = sys.argv.index("--"); answers = sys.argv[1:sep]; cmd = sys.argv[sep+1:]
feed = ("".join(a + "\n" for a in answers)).encode()
pid, fd = pty.fork()
if pid == 0:
    os.execvp(cmd[0], cmd); os._exit(127)
os.write(fd, feed); out = b""
while True:
    try: r, _, _ = select.select([fd], [], [], 15)
    except OSError: break
    if not r: break
    try: data = os.read(fd, 4096)
    except OSError: break
    if not data: break
    out += data
_, status = os.waitpid(pid, 0)
sys.stdout.buffer.write(out)
sys.exit(0 if os.WIFEXITED(status) and os.WEXITSTATUS(status) == 0 else 1)
PY

mk_consumer() {  # $1 = workspace|flat-pnpm|npm  ; echoes a fresh consumer dir
  local d; d=$(mktemp -d)
  printf '{ "name":"c","version":"0.0.0" }\n' > "$d/package.json"
  case "$1" in
    workspace) printf 'packages:\n  - "apps/*"\n' > "$d/pnpm-workspace.yaml" ;;
    flat-pnpm) : > "$d/pnpm-lock.yaml" ;;
    npm)       : ;;  # no markers → detect_pm = npm
  esac
  ( cd "$d" && git init -q )
  echo "$d"
}
seed_tsx()     { mkdir -p "$1/node_modules/tsx"; printf '{"name":"tsx","version":"0.0.0","exports":{"./esm":"./esm.mjs"}}\n' > "$1/node_modules/tsx/package.json"; : > "$1/node_modules/tsx/esm.mjs"; }
tsx_resolves() { ( cd "$1" && node --import tsx/esm -e '' ) >/dev/null 2>&1; }
run_install()  { local d="$1"; shift; OUT=$( cd "$d" && bash "$REPO_ROOT/install.sh" "$@" </dev/null 2>&1 ); RC=$?; }
# ran_to_end — the install reached its final banner. Under --full the stub package managers install
# nothing, so the post-install self-verify honestly FAILs and install.sh exits 1 (critical-review
# S4-8); that banner is printed at the very end of 99-finalize, so it still proves no mid-install crash.
ran_to_end()   { [ "$RC" -eq 0 ] || { [ "$RC" -eq 1 ] && printf '%s\n' "$OUT" | grep -q 'Installation finished, but self-verify FAILED'; }; }

# ════ Arm A — --full + tsx missing at root → §8b lands tsx at the ROOT (-w on a workspace); resolves; silent ════
A=$(mk_consumer workspace); export AIF_PM_LOG="$A.log"; : > "$AIF_PM_LOG"
run_install "$A" ts-server --force --full
if ran_to_end; then ok "A: install.sh ran to its final banner, rc=$RC (a mid-install crash would false-green the rest)"; else bad "A: install.sh rc=$RC without the final banner"; fi
grep -qx 'add -D -w tsx' "$AIF_PM_LOG" \
  && ok "A: --full + tsx-not-at-root → targeted 'pnpm add -D -w tsx' invoked (root hoist via -w, #636)" \
  || bad "A: targeted root tsx install NOT invoked on --full ($(tr '\n' ';' < "$AIF_PM_LOG"))"
tsx_resolves "$A" \
  && ok "A: tsx resolves from the workspace root after --full (guarantee met)" \
  || bad "A: tsx STILL unresolvable from root after --full (#636 fix 'a' absent)"
printf '%s' "$OUT" | grep -q 'REDUCED' \
  && bad "A: --full printed the REDUCED-mode warn despite landing tsx (should be silent)" \
  || ok "A: no REDUCED-mode warn on --full success (silent)"

# ════ Arm B — non-interactive (no --full) + tsx missing → REDUCED warn + exact -w command + tsx NOT installed ════
B=$(mk_consumer workspace); export AIF_PM_LOG="$B.log"; : > "$AIF_PM_LOG"
run_install "$B" ts-server --force
if [ "$RC" -eq 0 ]; then ok "B: install.sh rc=0 (the warn is non-fatal)"; else bad "B: install.sh rc=$RC"; fi
printf '%s' "$OUT" | grep -q 'REDUCED' \
  && ok "B: tsx missing + non-interactive → REDUCED-mode warn printed (case c)" \
  || bad "B: no REDUCED-mode warn when tsx missing non-interactively"
printf '%s' "$OUT" | grep -q 'pnpm add -D -w tsx' \
  && ok "B: warn prints the exact enabling command 'pnpm add -D -w tsx' (workspace → -w)" \
  || bad "B: warn missing the exact 'pnpm add -D -w tsx' command"
[ ! -s "$AIF_PM_LOG" ] \
  && ok "B: no PM invoked → tsx NOT installed (refused/non-interactive gate holds)" \
  || bad "B: PM invoked without consent ($(tr '\n' ';' < "$AIF_PM_LOG"))"

# ════ Arm C (LOAD-BEARING paired-negative) — tsx ALREADY resolves → §8b no-ops: no warn, no install ════
C=$(mk_consumer workspace); export AIF_PM_LOG="$C.log"; : > "$AIF_PM_LOG"
seed_tsx "$C"
run_install "$C" ts-server --force
if [ "$RC" -eq 0 ]; then ok "C: install.sh rc=0"; else bad "C: install.sh rc=$RC"; fi
printf '%s' "$OUT" | grep -q 'REDUCED' \
  && bad "C neg: REDUCED warn fired though tsx resolves → warn is unconditional/vacuous" \
  || ok "C neg: tsx present → NO REDUCED warn (warn is conditional on tsx-missing, non-vacuous)"
[ ! -s "$AIF_PM_LOG" ] \
  && ok "C neg: tsx present → §8b installed nothing (idempotent no-op)" \
  || bad "C neg: PM invoked though tsx already resolves ($(tr '\n' ';' < "$AIF_PM_LOG"))"

# ════ Arm D — interactive: DECLINE full toolchain (§8=n), ACCEPT targeted tsx (§8b=y), NO --full (case b) ════
# Real tty via a python pty so `[ -t 0 ]` is true. Prompt order is deterministic on a fresh --force
# consumer: [§8 dev-deps?] then [§8b tsx?]  → answers n, y.
if command -v python3 >/dev/null 2>&1; then
  D=$(mk_consumer workspace); export AIF_PM_LOG="$D.log"; : > "$AIF_PM_LOG"
  OUT=$(python3 "$PTY" n y -- bash -c "cd '$D' && bash '$REPO_ROOT/install.sh' ts-server --force" 2>&1 | tr -d '\r'); RC=$?
  if [ "$RC" -eq 0 ]; then ok "D: install.sh rc=0 under pty"; else bad "D: install.sh rc=$RC under pty"; fi
  grep -qx 'add -D -w tsx' "$AIF_PM_LOG" \
    && ok "D: interactive-yes (no --full) → §8b installed tsx via consent ('add -D -w tsx')" \
    || bad "D: interactive tsx consent did NOT install tsx ($(tr '\n' ';' < "$AIF_PM_LOG"))"
  grep -Eq 'eslint|--save-dev|vitest' "$AIF_PM_LOG" \
    && bad "D: §8 bulk toolchain installed despite decline — answer misalignment" \
    || ok "D: §8 bulk toolchain NOT installed (declined) → only the targeted tsx add ran (isolates §8b)"
  tsx_resolves "$D" \
    && ok "D: tsx resolves from root after interactive consent" \
    || bad "D: tsx still unresolvable after interactive consent"
else
  echo "  · D: python3 absent — interactive-pty arm skipped (Arm A covers the same install path)"
fi

# ════ Arm E1 (paired-negative for -w) — FLAT pnpm: warn prints 'pnpm add -D tsx' WITHOUT -w ════
E1=$(mk_consumer flat-pnpm); export AIF_PM_LOG="$E1.log"; : > "$AIF_PM_LOG"
run_install "$E1" ts-server --force
printf '%s' "$OUT" | grep -q 'pnpm add -D tsx' \
  && ok "E1: flat pnpm → warn prints 'pnpm add -D tsx'" \
  || bad "E1: flat pnpm warn missing 'pnpm add -D tsx'"
if printf '%s' "$OUT" | grep -q 'pnpm add -D -w tsx'; then
  bad "E1 neg: -w present on a FLAT pnpm consumer → -w branch is vacuous"
else
  ok "E1 neg: flat pnpm → NO -w in the tsx command (-w is workspace-keyed, non-vacuous)"
fi

# ════ Arm E2 — npm consumer: warn prints 'npm i -D tsx' ════
E2=$(mk_consumer npm); export AIF_PM_LOG="$E2.log"; : > "$AIF_PM_LOG"
run_install "$E2" ts-server --force
printf '%s' "$OUT" | grep -q 'npm i -D tsx' \
  && ok "E2: npm consumer → warn prints 'npm i -D tsx'" \
  || bad "E2: npm warn missing 'npm i -D tsx'"

# ════ Consistency — install.sh reuses the SAME tsx probe expression as the #638 dispatcher ════
# S1 migration: tsx probe (_tsx_resolves) moved to setup.d/70-deps.sh; check there first.
_tsx_src="$REPO_ROOT/install.sh"
[ -f "$REPO_ROOT/setup.d/70-deps.sh" ] && _tsx_src="$REPO_ROOT/setup.d/70-deps.sh"
grep -q 'node --import tsx/esm -e' "$_tsx_src" \
  && ok "consistency: install.sh uses the dispatcher's 'node --import tsx/esm -e' probe (#638 parity)" \
  || bad "consistency: install.sh tsx probe expression drifted from the #638 dispatcher"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
