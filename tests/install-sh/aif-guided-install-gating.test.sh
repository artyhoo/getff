#!/usr/bin/env bash
# aif-guided-install-gating.test.sh — ledger A1-3 / A1-4 / A1-7 (PR #1597 local review).
#
# setup.d/aif-handoff-guided-install.sh is spawned as a separate `bash` process from
# install.sh, so DRY_RUN / FULL are invisible to it. Three defects followed:
#   A1-3  the helper prompts [y/N] and, on y, `git clone` + `docker compose up -d` —
#         real side effects AFTER 99-finalize printed "Nothing was written", and a
#         blocking prompt on the -y/--all path that setup:27 documents as never-prompting.
#   A1-4  under `set -euo pipefail` the clone/compose pipelines carried no `|| …`, so a
#         failure aborted the helper before the degrade notice, the audit-log line and
#         the health wait — while install.sh's `|| true` reported the install as fine.
#   A1-7  the `absent` arm re-ran bridge_diagnose's own docker test, so its
#         "daemon down → Start docker" branch was unreachable and a consumer with Docker
#         Desktop stopped was told to "Install docker".
#   Q4.7  (operator directive 2026-09-28) the helper never hands back a manual step: every
#         degrade path says what is not wired and why, in a «NOT wired» summary of its own
#         (the helper runs after 99-finalize printed the install's), and no «start docker»,
#         «install docker», «Set VAR=1 to …» or «re-run with …» line is printed.
#
# Method: run the REAL helper as a subprocess against a curated PATH of stubs
# (curl/docker/git/sleep), the shape install.sh uses. Every side effect the helper can
# have — the clone, `docker compose`, the audit log — lands in $STUB_STATE and is
# asserted on directly, so "no side effects" is measured, not inferred from output.
#
# CEILING: install.sh's own spawn site is asserted structurally (last section) — the
# guard and the two exports. Running install.sh end-to-end would need either the real
# network (a real `git clone`) or a PATH stub shadowing the git install.sh itself uses.
# The helper's BEHAVIOUR under each gating input is covered functionally above it.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
HELPER="$REPO_ROOT/setup.d/aif-handoff-guided-install.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

SB=$(mktemp -d)
trap 'rm -rf "$SB"' EXIT
mkdir -p "$SB/bin" "$SB/bin-nodocker" "$SB/home"
# Real tools the helper + bridge-guided.sh reach for. `env -i` below means PATH is
# exactly one of these dirs, so anything not linked here is genuinely absent — that is
# what makes the "no docker binary at all" arm honest.
for b in bash sh sed date dirname cat rm mkdir grep touch; do
  p=$(command -v "$b" 2>/dev/null) && ln -sf "$p" "$SB/bin/$b" && ln -sf "$p" "$SB/bin-nodocker/$b"
done

cat > "$SB/bin/curl" <<'EOF'
#!/bin/sh
[ -f "$STUB_STATE/health-up" ] && exit 0
exit 1
EOF
cat > "$SB/bin/git" <<'EOF'
#!/bin/sh
echo "git $*" >> "$STUB_STATE/git.calls"
if [ "${STUB_GIT_RC:-0}" != "0" ]; then echo "stub: fatal: clone failed" >&2; exit "${STUB_GIT_RC}"; fi
case "$1" in clone) mkdir -p "$3" ;; esac
exit 0
EOF
cat > "$SB/bin/docker" <<'EOF'
#!/bin/sh
echo "docker $*" >> "$STUB_STATE/docker.calls"
case "$1" in
  info) exit "${STUB_DOCKER_INFO_RC:-0}" ;;
  compose)
    if [ "${STUB_COMPOSE_RC:-0}" = "0" ]; then : > "$STUB_STATE/health-up"; exit 0; fi
    echo "stub: compose failed" >&2; exit "${STUB_COMPOSE_RC}" ;;
esac
exit 0
EOF
cat > "$SB/bin/sleep" <<'EOF'
#!/bin/sh
exit 0
EOF
chmod +x "$SB/bin/curl" "$SB/bin/git" "$SB/bin/docker" "$SB/bin/sleep"
for s in curl git sleep; do cp "$SB/bin/$s" "$SB/bin-nodocker/$s"; done

# run <case-label> <bin-dir> <stdin-source> [VAR=VAL …] → $OUT (combined), $RC, $ST
run() {
  local label="$1" bindir="$2" stdin="$3"; shift 3
  ST="$SB/state-$label"; rm -rf "$ST"; mkdir -p "$ST"
  OUT=$(env -i \
    PATH="$bindir" HOME="$SB/home" \
    STUB_STATE="$ST" \
    RUNTIME_BRIDGE_AIF_URL="http://127.0.0.1:59099" \
    AIF_HANDOFF_REPO_URL="https://example.invalid/aif-handoff.git" \
    AIF_HANDOFF_CHECKOUT="$ST/checkout" \
    AIF_INSTALL_LOG="$ST/install.log" \
    "$@" \
    bash "$HELPER" < "$stdin" 2>&1); RC=$?
}
cloned()   { grep -q '^git clone' "$ST/git.calls" 2>/dev/null; }
composed() { grep -q '^docker compose' "$ST/docker.calls" 2>/dev/null; }
printf 'y\n' > "$SB/stdin-yes"

# shellcheck source=tests/install-sh/lib/manual-step.sh
source "$REPO_ROOT/tests/install-sh/lib/manual-step.sh"
# no_manual <arm> — the run's output hands the reader no manual step (Q4.7).
no_manual() {
  printf '%s\n' "$OUT" > "$ST/out.log"
  if asks_by_hand "$ST/out.log"; then bad "$1: output hands back a manual step: $(manual_step_lines "$ST/out.log" | head -2 | tr '\n' '|')"
  else ok "$1: no manual step in the output"; fi
}
# nw_aif <arm> <regex> — the output carries a NOT-wired summary whose aif-handoff line matches.
nw_aif() {
  case "$OUT" in *"NOT wired"*) ;; *) bad "$1: no NOT-wired summary: $OUT"; return ;; esac
  if printf '%s\n' "$OUT" | grep -E '^ +- aif-handoff — ' | grep -qE "$2"; then ok "$1: NOT wired says why ($2)"
  else bad "$1: no aif-handoff NOT-wired line matching /$2/: $OUT"; fi
}

# ── A1-7: docker binary present, daemon down → the daemon is named, not a missing docker ──
run a17-down "$SB/bin" /dev/null STUB_DOCKER_INFO_RC=1
nw_aif "A1-7" "docker daemon is not running"
case "$OUT" in *"no docker"*) bad "A1-7: daemon down reported as docker being absent: $OUT" ;; *) ok "A1-7: daemon down is not reported as docker being absent" ;; esac
case "$OUT" in *"degrades to env-level"*) ok "A1-7: daemon down still degrades to env-level" ;; *) bad "A1-7: no degrade notice: $OUT" ;; esac
no_manual "A1-7"

# ── A1-7 paired-negative: no docker binary at all → docker reported absent ──────────
run a17-absent "$SB/bin-nodocker" /dev/null
nw_aif "A1-7 neg" "no docker"
case "$OUT" in *"daemon"*) bad "A1-7 neg: no docker binary but the daemon is blamed: $OUT" ;; *) ok "A1-7 neg: absent arm does not blame the daemon" ;; esac
no_manual "A1-7 neg"

# ── native: the aif-handoff CLI is installed but does not answer ────────────────────
mkdir -p "$SB/bin-native"
for b in "$SB/bin-nodocker"/*; do ln -sf "$(readlink "$b" 2>/dev/null || echo "$b")" "$SB/bin-native/$(basename "$b")"; done
printf '#!/bin/sh\nexit 0\n' > "$SB/bin-native/aif-handoff"; chmod +x "$SB/bin-native/aif-handoff"
run native "$SB/bin-native" /dev/null
nw_aif "native" "CLI is installed but does not answer"
no_manual "native"

# ── A1-3: --dry-run must not clone, compose, prompt or write the audit log ──────────
# stdin is a live "y": on the unfixed helper the prompt consumes it and clones for real.
run a13-dry "$SB/bin" "$SB/stdin-yes" GETFF_DRY_RUN=--dry-run
cloned   && bad "A1-3: --dry-run cloned the repo" || ok "A1-3: --dry-run performed no git clone"
composed && bad "A1-3: --dry-run ran docker compose" || ok "A1-3: --dry-run ran no docker compose"
[ -e "$ST/install.log" ] && bad "A1-3: --dry-run wrote the audit log" || ok "A1-3: --dry-run wrote no audit-log line"
case "$OUT" in *"[dry-run]"*) ok "A1-3: --dry-run says what it would do" ;; *) bad "A1-3: no [dry-run] preview line: $OUT" ;; esac
case "$OUT" in *"[y/N]"*) bad "A1-3: --dry-run prompted the user: $OUT" ;; *) ok "A1-3: --dry-run does not prompt" ;; esac
[ "$RC" -eq 0 ] && ok "A1-3: --dry-run returns 0" || bad "A1-3: --dry-run rc=$RC"

# ── A1-3: the non-interactive (-y/--full/--all) path never prompts ──────────────────
run a13-yes "$SB/bin" "$SB/stdin-yes" GETFF_NONINTERACTIVE=1
case "$OUT" in *"[y/N]"*) bad "A1-3: non-interactive run still prompts [y/N]: $OUT" ;; *) ok "A1-3: non-interactive run never prompts" ;; esac
cloned && bad "A1-3: non-interactive run cloned without an explicit opt-in" || ok "A1-3: non-interactive run auto-declines (no clone)"
case "$OUT" in *"degrades to env-level"*) ok "A1-3: auto-decline carries the explicit degrade notice" ;; *) bad "A1-3: auto-decline printed no degrade notice: $OUT" ;; esac
case "$OUT" in *AIF_GUIDED_INSTALL*) ok "A1-3: the notice names the opt-in that would have installed it" ;; *) bad "A1-3: no opt-in pointer in the notice: $OUT" ;; esac
nw_aif "A1-3" "non-interactive.*AIF_GUIDED_INSTALL=1"
no_manual "A1-3"
[ "$RC" -eq 0 ] && ok "A1-3: non-interactive run returns 0" || bad "A1-3: non-interactive rc=$RC"

# ── A1-3 paired-negative: the interactive prompt is still there ─────────────────────
run a13-int "$SB/bin" /dev/null
case "$OUT" in *"[y/N]"*) ok "A1-3 neg: interactive run still offers the [y/N] prompt" ;; *) bad "A1-3 neg: the interactive offer was suppressed too: $OUT" ;; esac
cloned && bad "A1-3 neg: declined run cloned anyway" || ok "A1-3 neg: decline → no clone"
nw_aif "A1-3 neg" "declined"
no_manual "A1-3 neg"

# ── A1-3 paired-negative: an explicit opt-in still installs, without a prompt ───────
run a13-optin "$SB/bin" /dev/null GETFF_NONINTERACTIVE=1 AIF_GUIDED_INSTALL=1
case "$OUT" in *"[y/N]"*) bad "A1-3 neg: explicit opt-in still prompted: $OUT" ;; *) ok "A1-3 neg: explicit opt-in needs no prompt" ;; esac
cloned   && ok "A1-3 neg: explicit opt-in performs the clone" || bad "A1-3 neg: opt-in did not clone: $OUT"
composed && ok "A1-3 neg: explicit opt-in runs docker compose" || bad "A1-3 neg: opt-in did not compose: $OUT"
[ "$RC" -eq 0 ] && ok "A1-3 neg: explicit opt-in returns 0" || bad "A1-3 neg: opt-in rc=$RC"
case "$OUT" in *"NOT wired"*) bad "A1-3 neg: a successful install printed a NOT-wired summary: $OUT" ;; *) ok "A1-3 neg: a successful install prints no NOT-wired summary" ;; esac

# ── A1-4: a failed clone routes through the degrade path ────────────────────────────
# stdin carries a live "y" so the arm reaches the clone on the unfixed helper too
# (which ignores AIF_GUIDED_INSTALL and would otherwise decline at the prompt).
run a14-clone "$SB/bin" "$SB/stdin-yes" GETFF_NONINTERACTIVE=1 AIF_GUIDED_INSTALL=1 STUB_GIT_RC=1
[ "$RC" -eq 0 ] && ok "A1-4: failed clone returns 0 (never aborts mid-helper)" || bad "A1-4: failed clone rc=$RC"
case "$OUT" in *"degrades to env-level"*) ok "A1-4: failed clone reaches the degrade notice" ;; *) bad "A1-4: failed clone skipped the degrade path: $OUT" ;; esac
composed && bad "A1-4: composed despite a failed clone" || ok "A1-4: failed clone does not proceed to docker compose"
grep -q 'failed git-clone' "$ST/install.log" 2>/dev/null && ok "A1-4: failed clone is written to the audit log" || bad "A1-4: no audit-log line for the failed clone"
nw_aif "A1-4 clone" "git clone .* failed"
no_manual "A1-4 clone"

# ── A1-4: a failed `docker compose up -d` routes through the degrade path ───────────
run a14-compose "$SB/bin" "$SB/stdin-yes" GETFF_NONINTERACTIVE=1 AIF_GUIDED_INSTALL=1 STUB_COMPOSE_RC=1
[ "$RC" -eq 0 ] && ok "A1-4: failed compose returns 0" || bad "A1-4: failed compose rc=$RC"
case "$OUT" in *"degrades to env-level"*) ok "A1-4: failed compose reaches the degrade notice" ;; *) bad "A1-4: failed compose skipped the degrade path: $OUT" ;; esac
grep -q 'failed docker-compose-up' "$ST/install.log" 2>/dev/null && ok "A1-4: failed compose is written to the audit log" || bad "A1-4: no audit-log line for the failed compose"
nw_aif "A1-4 compose" "docker compose up -d failed"
no_manual "A1-4 compose"

# ── A1-3 wiring: install.sh must gate the spawn and export what the child reads ─────
BLOCK=$(sed -n '/aif-handoff guided install (beta-delivery-ux S4/,/^# ─── consumer-refresh-integrity R1/p' "$REPO_ROOT/install.sh")
[ -n "$BLOCK" ] || bad "wiring: could not locate the guided-install block in install.sh"
case "$BLOCK" in *'DRY_RUN'*) ok "wiring: install.sh's guided-install block consults DRY_RUN" ;; *) bad "wiring: the block never mentions DRY_RUN" ;; esac
case "$BLOCK" in *'export GETFF_DRY_RUN'*) ok "wiring: GETFF_DRY_RUN is exported to the child process" ;; *) bad "wiring: GETFF_DRY_RUN not exported — the child cannot self-gate" ;; esac
case "$BLOCK" in *'GETFF_NONINTERACTIVE'*) ok "wiring: GETFF_NONINTERACTIVE is passed to the child process" ;; *) bad "wiring: GETFF_NONINTERACTIVE not passed — -y still prompts" ;; esac

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
