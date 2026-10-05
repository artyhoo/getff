#!/usr/bin/env bash
# install-refresh-tty-guard.test.sh — the TTY depth menu must never fire on a --refresh pass.
#
# HISTORY. Ultra review of #1597 (re-verified live 2026-10-05): the menu guard at the profile
# resolution block (`[ -t 0 ] && [ -z "$DRY_RUN" ] && ...`) had no REFRESH term, so a bare
# `./install.sh --refresh` attached to a terminal showed the depth menu on a prior `core`
# install — and Enter (the menu default) resolved PROFILE=env, deepening core→env. The
# "a refresh never deepens" invariant (INSTALL-FOR-AI.md) was honored only by the non-TTY
# else-branch (consumer-upgrade-path.test.sh TEST 8). Fix: `[ -z "$REFRESH" ]` joins the
# guard — refresh keeps the depth already on disk; `--refresh --profile env` is the explicit
# way up.
#
# ARMS (core install into a tmp consumer, then the refresh pass under test):
#   precondition — the core install ships none of the eight env-depth artefacts.
#   A — interactive, real pty (`install.sh --refresh`, Enter fed): rc 0, no menu text,
#       `[profile] core`, and all eight artefacts STILL absent. This is the regression arm —
#       RED on the pre-fix guard.
#   B — paired-negative (population control, mirrors consumer-upgrade-path TEST 11): the SAME
#       paths appear under `--refresh --profile env`, so A's absence is a gate decision,
#       not a framework that cannot deliver them at all.
#
# INSTALL_ROOT may point at another checkout of the framework to run the arms against it.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL_ROOT="${INSTALL_ROOT:-$REPO_ROOT}"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

command -v node >/dev/null 2>&1 || { echo "FATAL: node not on PATH"; exit 1; }

# ── python pty driver — feeds ordered answers to a REAL tty. stdlib only. ────────────────────────
# (Same driver as install-no-tsx-step.test.sh Arm D.)
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

# The eight env-depth artefacts the menu default would create on a core install:
# every GETFF_SKILLS_ENV slug (setup.d/lib.sh:64), the tier-home doc, and the two named
# entry points of the worktree-script cluster (delivery: setup.d/85-worktree-scripts.sh).
ENV_DEPTH_ARTEFACTS=(
  ".claude/skills/arch"
  ".claude/skills/pipeline"
  ".claude/skills/reviewer"
  ".claude/skills/night-mode"
  ".claude/skills/orchestrator"
  ".ai-factory/tier-home.md"
  "scripts/create-worktree.sh"
  "scripts/getff-work.sh"
)

TC=$(mktemp -d)
printf '{ "name":"consumer","version":"0.0.0" }\n' > "$TC/package.json"
( cd "$TC" && git init -q && bash "$INSTALL_ROOT/install.sh" ts-server --profile core < /dev/null ) >/dev/null 2>&1
RC=$?
if [ "$RC" -eq 0 ]; then ok "precondition: core install rc=0"; else bad "precondition: core install rc=$RC"; fi

_present=""
for _p in "${ENV_DEPTH_ARTEFACTS[@]}"; do
  [ -e "$TC/$_p" ] && _present="$_present $_p"
done
if [ -z "${_present// }" ]; then
  ok "precondition: core install ships NONE of the eight env-depth artefacts (depth boundary held at install time)"
else
  bad "precondition: core install already ships env-depth artefact(s):$_present — the arm cannot detect deepening"
fi

# ════ Arm A — interactive: bare --refresh on a REAL pty, Enter fed → keeps core ════
if command -v python3 >/dev/null 2>&1; then
  OUT=$(python3 "$PTY" "" -- bash -c "cd '$TC' && bash '$INSTALL_ROOT/install.sh' --refresh" 2>&1 | tr -d '\r'); RC=$?
  if [ "$RC" -eq 0 ]; then ok "A: --refresh rc=0 under pty"; else bad "A: --refresh rc=$RC under pty"; fi
  grep -q 'What install depth do you want' <<<"$OUT" \
    && bad "A: the depth menu fired on a refresh pass" \
    || ok "A: no depth menu on a refresh pass"
  grep -q '\[profile\] core' <<<"$OUT" \
    && ok "A: refresh resolved [profile] core" \
    || bad "A: refresh did not resolve [profile] core (menu default ate the Enter?)"
  _leak=""
  for _p in "${ENV_DEPTH_ARTEFACTS[@]}"; do
    [ -e "$TC/$_p" ] && _leak="$_leak $_p"
  done
  if [ -z "${_leak// }" ]; then
    ok "A: pty --refresh delivered NO env-depth artefact (a refresh never deepens)"
  else
    bad "A: pty --refresh deepened core → env, created:$_leak"
  fi
else
  echo "  · A: python3 absent — interactive-pty arm skipped"
fi

# ════ Arm B — paired-negative: the SAME paths appear under an explicit deeper profile ════
( cd "$TC" && bash "$INSTALL_ROOT/install.sh" --refresh --profile env < /dev/null ) >/dev/null 2>&1
_still=""
for _p in "${ENV_DEPTH_ARTEFACTS[@]}"; do
  [ -e "$TC/$_p" ] || _still="$_still $_p"
done
if [ -z "${_still// }" ]; then
  ok "B: --refresh --profile env delivers every env-depth artefact (A's absence was a gate decision, not an inability)"
else
  bad "B: --refresh --profile env still missing artefact(s):$_still — A's absence assertions are vacuous"
fi

rm -rf "$TC"
echo ""
echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
