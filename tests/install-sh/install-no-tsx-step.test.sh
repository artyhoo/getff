#!/usr/bin/env bash
# install-no-tsx-step.test.sh — install.sh no longer installs, probes or warns about tsx for the
# pre-push hook, and the interactive prompt order still reaches §8 first.
#
# HISTORY. setup.d/70-deps.sh §8b (GH #636 fix "a") guaranteed that `node --import tsx/esm` resolved
# from the workspace root, because the dispatcher ran packages/core/hooks/pre-push.ts through tsx:
# a targeted `pnpm add -D -w tsx` on --full, a [y/N] offer on a tty, and a «REDUCED mode» warning
# otherwise. The hook now ships as packages/core/hooks/pre-push.bundle.mjs and plain `node` runs it,
# so every one of those actions is dead weight — and the warning would be false. §8b is retired.
#
# ARMS (fake package managers on PATH record their argv; NO real install, NO network):
#   A — --full on a pnpm workspace: install runs to its final banner; no TARGETED tsx add is issued
#       (the bulk §8 toolchain install still is — that is where tsx arrives with CORE_DEVDEPS);
#       no «REDUCED» warning.
#   B — non-interactive without --full: no package manager runs at all; no «REDUCED» warning and no
#       «tsx» enabling command.
#   D — interactive, positional stack (`install.sh ts-server --force` on a real pty, answer `n`):
#       the first prompt is §8's dev-deps question, not the profile menu — a positional stack skips
#       the menu (install.sh STACK_EXPLICIT). Had the menu fired, `n` would be an invalid choice and
#       install.sh would exit 1. This arm used to live in gh-636-ensure-tsx-root.test.sh Arm D.
#
# INSTALL_ROOT may point at another checkout of the framework to run the arms against it.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL_ROOT="${INSTALL_ROOT:-$REPO_ROOT}"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

command -v node >/dev/null 2>&1 || { echo "FATAL: node not on PATH"; exit 1; }

# ── fake PMs on PATH: record argv, install nothing ────────────────────────────────────────────────
FAKEBIN=$(mktemp -d)
for _pm in npm pnpm yarn; do
  printf '#!/bin/sh\nprintf "%%s\\n" "$*" >> "$AIF_PM_LOG"\nexit 0\n' > "$FAKEBIN/$_pm"
  chmod +x "$FAKEBIN/$_pm"
done
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
# A child still running after 15 s of silence is blocked on a prompt nobody answers (an extra
# question appeared): stop it and report a failure instead of hanging the suite.
done, status = os.waitpid(pid, os.WNOHANG)
if done == 0:
    os.kill(pid, 9); _, status = os.waitpid(pid, 0)
    out += b"\n[pty] child still waiting for input after 15 s of silence - killed\n"
sys.stdout.buffer.write(out)
sys.exit(0 if os.WIFEXITED(status) and os.WEXITSTATUS(status) == 0 else 1)
PY

mk_consumer() {  # echoes a fresh pnpm-workspace consumer dir
  local d; d=$(mktemp -d)
  printf '{ "name":"c","version":"0.0.0" }\n' > "$d/package.json"
  printf 'packages:\n  - "apps/*"\n' > "$d/pnpm-workspace.yaml"
  ( cd "$d" && git init -q )
  echo "$d"
}
run_install()  { local d="$1"; shift; OUT=$( cd "$d" && bash "$INSTALL_ROOT/install.sh" "$@" </dev/null 2>&1 ); RC=$?; }
# ran_to_end — the install reached its final banner. Under --full the stub package managers install
# nothing, so the post-install self-verify honestly FAILs and install.sh exits 1 (critical-review
# S4-8); that banner is printed at the very end of 99-finalize, so it still proves no mid-install crash.
ran_to_end()   { [ "$RC" -eq 0 ] || { [ "$RC" -eq 1 ] && grep -q 'Installation finished, but self-verify FAILED' <<<"$OUT"; }; }
targeted_tsx() { grep -Eqx '(add|i|install) -D( -w)? tsx' "$1"; }

# ════ Arm A — --full: bulk §8 install yes, targeted tsx add no, no REDUCED warn ════
A=$(mk_consumer); export AIF_PM_LOG="$A.log"; : > "$AIF_PM_LOG"
run_install "$A" ts-server --force --full
if ran_to_end; then ok "A: install.sh ran to its final banner, rc=$RC"; else bad "A: install.sh rc=$RC without the final banner"; fi
grep -q 'tsx' "$AIF_PM_LOG" \
  && ok "A: the §8 bulk install still carries tsx (CORE_DEVDEPS) — the arm is not vacuous" \
  || bad "A: no package-manager call mentioned tsx at all ($(tr '\n' ';' < "$AIF_PM_LOG"))"
targeted_tsx "$AIF_PM_LOG" \
  && bad "A: a TARGETED tsx add ran — the retired §8b step is back ($(tr '\n' ';' < "$AIF_PM_LOG"))" \
  || ok "A: no targeted tsx add (§8b retired)"
grep -q 'REDUCED' <<<"$OUT" \
  && bad "A: printed the «REDUCED mode» tsx warning" \
  || ok "A: no «REDUCED mode» tsx warning"

# ════ Arm B — non-interactive, no --full: nothing installed, no tsx warning ════
B=$(mk_consumer); export AIF_PM_LOG="$B.log"; : > "$AIF_PM_LOG"
run_install "$B" ts-server --force
if [ "$RC" -eq 0 ]; then ok "B: install.sh rc=0"; else bad "B: install.sh rc=$RC"; fi
[ ! -s "$AIF_PM_LOG" ] \
  && ok "B: no package manager invoked without consent" \
  || bad "B: package manager invoked without consent ($(tr '\n' ';' < "$AIF_PM_LOG"))"
grep -Eq 'REDUCED|add -D -w tsx|i -D tsx' <<<"$OUT" \
  && bad "B: printed a tsx warning / enabling command for the pre-push hook" \
  || ok "B: no tsx warning or enabling command"

# ════ Arm D — interactive, positional stack: first prompt is §8, answer n → rc 0, nothing installed ════
if command -v python3 >/dev/null 2>&1; then
  D=$(mk_consumer); export AIF_PM_LOG="$D.log"; : > "$AIF_PM_LOG"
  OUT=$(python3 "$PTY" n -- bash -c "cd '$D' && bash '$INSTALL_ROOT/install.sh' ts-server --force" 2>&1 | tr -d '\r'); RC=$?
  if [ "$RC" -eq 0 ]; then ok "D: install.sh rc=0 under pty (the profile menu did not eat the §8 answer)"; else bad "D: install.sh rc=$RC under pty"; fi
  grep -q 'What install depth do you want' <<<"$OUT" \
    && bad "D: the profile menu fired despite a positional stack" \
    || ok "D: no profile menu with a positional stack"
  [ ! -s "$AIF_PM_LOG" ] \
    && ok "D: §8 declined → no package manager invoked" \
    || bad "D: package manager invoked after declining §8 ($(tr '\n' ';' < "$AIF_PM_LOG"))"
else
  echo "  · D: python3 absent — interactive-pty arm skipped"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
