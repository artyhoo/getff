#!/usr/bin/env bash
# setup-runtime-bridge.sh — interactive runtime-bridge setup for the getff repository itself.
#
# Phase 1 scope: aif-handoff-or-skip (2-way). amux is Phase 2 (SW-H), not here.
#
# Who runs it: ./setup's runtime-bridge step (setup.d/bridge-guided.sh), only when the project
# being set up IS this repository — its settings.json is tracked, so the env lives in the shell
# rc. A project getff installs into is wired by bridge_wire_project (its settings.local.json env)
# instead, and never runs this script.
#
# What it does (never installs or starts aif-handoff):
#   1. Probes whether an aif-handoff coordinator is reachable on RUNTIME_BRIDGE_AIF_URL.
#   2. Asks whether to enable the aif-handoff bridge.
#      - yes → writes the env the bridge needs (mode + project id + url) to the
#              shell rc, copies the PostToolUse hook into .claude/hooks/,
#              and auto-writes the PostToolUse entry to .claude/settings.json unless
#              declined (idempotent, backs up to settings.json.bak, JSON-validates,
#              preserves all existing hooks). When the entry is not written — declined,
#              --no-write-settings, python3 absent, or the write failed — it says so
#              and why (Q4.7: a fact, never a snippet to paste).
#      - no  → states the per-task `<!-- bridge: auto -->` opt-in; sets nothing.
#              ManualBackend (copy-paste) is always the default — no install needed.
#   Every line it prints is a fact; its sweep is arm R of
#   tests/install-sh/install-no-manual-step.test.sh (operator directive Q4.7, 2026-09-28).
#
# Auto-dispatch is opt-IN (kickoff §7, 2026-05-31): even with the hook installed,
# ONLY kickoffs whose first line is exactly `<!-- bridge: auto -->` auto-dispatch.
# A hook copied BEFORE the opt-in flip dispatched every kickoff; each run of this
# script replaces a copy (in the getff repository the hook is the tracked source itself).
#
# The bridge never degrades the manual-paste experience; it only adds automation
# when aif-handoff is present AND the consumer opts in.
#
# Cost note: after 2026-06-15, aif-handoff CLI transport (`claude -p`) draws from a
# separate monthly Agent SDK credit. See docs/runtime-bridge-setup.md.
set -euo pipefail

# ── Flag parse ────────────────────────────────────────────────────────────────
WRITE_SETTINGS=1
for arg in "$@"; do
  if [[ "$arg" == "--no-write-settings" ]]; then
    WRITE_SETTINGS=0
  fi
done

# ── Locate repo root + the shipped hook (this script lives in
#    packages/runtime-bridge/scripts/, so root is three levels up) ─────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
HOOK_SRC="$REPO_ROOT/.claude/hooks/runtime-bridge-dispatch.sh"

# Consumer-config defaults (override via env before running).
AIF_URL="${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}"
SHELL_RC="${SHELL_RC:-$HOME/.zshrc}"
# Anchor to REPO_ROOT (the dir containing packages/runtime-bridge/), NOT the
# shell's cwd — so the hook lands in the right .claude/hooks/ regardless of where
# the script is invoked from. Override only if your .claude/ lives elsewhere.
CLAUDE_HOOKS_DIR="${CLAUDE_HOOKS_DIR:-$REPO_ROOT/.claude/hooks}"
SETTINGS_JSON="${SETTINGS_JSON:-$REPO_ROOT/.claude/settings.json}"

say()  { printf '%s\n' "$*"; }
warn() { printf '[runtime-bridge] %s\n' "$*" >&2; }

# ── Step 1: probe aif-handoff reachability (mirror AifHandoffBackend.available) ─
say "Probing aif-handoff coordinator at ${AIF_URL} ..."
if curl --silent --show-error --connect-timeout 1 "${AIF_URL}/health" >/dev/null 2>&1; then
  say "  reachable ✓"
else
  say "  not reachable — this script does not start aif-handoff; the bridge falls back to ManualBackend while it is down"
fi

# ── Step 2: ask ───────────────────────────────────────────────────────────────
printf 'Install aif-handoff bridge? [y/N — default N = manual paste mode] '
read -r ANSWER || ANSWER=""

case "${ANSWER}" in
  y|Y|yes|YES)
    say ""
    say "Enabling aif-handoff bridge. This script neither installs nor starts aif-handoff;"
    say "the bridge dispatches to the coordinator that answers on ${AIF_URL}/health."
    say ""
    say "aif-handoff-side config this bridge is built for (not changed by this script):"
    say "  • transport \"cli\" bills the Claude subscription; aif-handoff's default"
    say "    transport is the SDK, which is metered"
    say "  • AGENT_AUTO_REVIEW_STRATEGY=closure_first is the layered-review design"
    say ""

    # Required bridge env — without these dispatch() throws and silently degrades.
    printf 'aif-handoff project UUID (RUNTIME_BRIDGE_AIF_PROJECT_ID): '
    read -r PROJECT_ID || PROJECT_ID=""
    if [[ -z "${PROJECT_ID}" ]]; then
      warn "no project id given — RUNTIME_BRIDGE_AIF_PROJECT_ID is not written, so every dispatch ends in dispatch_failed and falls back to ManualBackend."
    fi
    printf 'aif-handoff base URL [%s]: ' "${AIF_URL}"
    read -r URL_IN || URL_IN=""
    URL_OUT="${URL_IN:-${AIF_URL}}"

    # Idempotency guard: don't append a second RUNTIME_BRIDGE_* block on re-run.
    if grep -q 'runtime-bridge (added by setup-runtime-bridge.sh)' "${SHELL_RC}" 2>/dev/null; then
      warn "RUNTIME_BRIDGE_* env already present in ${SHELL_RC} — left unchanged (this script appends its block once)."
    else
      {
        printf '\n# runtime-bridge (added by setup-runtime-bridge.sh)\n'
        printf 'export RUNTIME_BRIDGE_MODE=auto\n'
        [[ -n "${PROJECT_ID}" ]] && printf 'export RUNTIME_BRIDGE_AIF_PROJECT_ID=%s\n' "${PROJECT_ID}"
        printf 'export RUNTIME_BRIDGE_AIF_URL=%s\n' "${URL_OUT}"
        # MCP (HTTP) URL — RESERVED for the MCP-target phase; unused by REST dispatch today.
        printf 'export RUNTIME_BRIDGE_AIF_MCP_URL=%s\n' "${RUNTIME_BRIDGE_AIF_MCP_URL:-http://localhost:3100}"
      } >> "${SHELL_RC}"
      say "Wrote RUNTIME_BRIDGE_* env to ${SHELL_RC} — shells started from now on read them; the shell that ran this install does not."
    fi

    # Hook delivery — install.sh does NOT ship this hook, so copy it in.
    if [[ -f "${HOOK_SRC}" ]] && [[ "${HOOK_SRC}" -ef "${CLAUDE_HOOKS_DIR}/runtime-bridge-dispatch.sh" ]]; then
      # The getff repository's default: the source IS the destination (.claude/hooks/ holds the
      # tracked hook). `cp` onto itself exits 1, and under `set -e` that ended the run before
      # settings.json was written.
      say "runtime-bridge-dispatch.sh already in place at ${CLAUDE_HOOKS_DIR}/ (it is the tracked source)"
    elif [[ -f "${HOOK_SRC}" ]]; then
      mkdir -p "${CLAUDE_HOOKS_DIR}"
      cp "${HOOK_SRC}" "${CLAUDE_HOOKS_DIR}/runtime-bridge-dispatch.sh"
      chmod +x "${CLAUDE_HOOKS_DIR}/runtime-bridge-dispatch.sh"
      say "Copied runtime-bridge-dispatch.sh → ${CLAUDE_HOOKS_DIR}/ (a copy from before the opt-in flip, 2026-05-31, auto-dispatched every kickoff; this one replaced it)"
    else
      warn "hook not copied: its source ${HOOK_SRC} is absent, so ${CLAUDE_HOOKS_DIR}/ has no runtime-bridge-dispatch.sh from this run."
    fi

    say ""

    # ── Auto-write settings.json (with consent) ───────────────────────────────
    # The agent's Write/Edit tool permissions are deny-listed from settings.json
    # (see .claude/settings.json "Edit(.claude/settings.json)" / "Write(...)").
    # That deny-list binds the AI agent's tool calls — NOT a human-run shell
    # script. This script may therefore write settings.json safely, with backup
    # + JSON-validation + consent. (NC-3 scoped 2026-05-31.)
    _DO_WRITE=0
    if [[ "${WRITE_SETTINGS}" -eq 1 ]]; then
      printf 'Auto-write the PostToolUse entry to .claude/settings.json? [Y/n] '
      read -r WRITE_ANS || WRITE_ANS=""
      case "${WRITE_ANS}" in
        n|N|no|NO) _DO_WRITE=0 ;;
        *)          _DO_WRITE=1 ;;
      esac
    fi

    if [[ "${_DO_WRITE}" -eq 1 ]] && command -v python3 >/dev/null 2>&1; then
      if python3 - "$SETTINGS_JSON" <<'PY'
import json, sys, shutil, os

path = sys.argv[1]

# Handle missing file: start from an empty object
if os.path.exists(path):
    with open(path) as f:
        data = json.load(f)
else:
    data = {}

ptu = data.setdefault("hooks", {}).setdefault("PostToolUse", [])
before_count = len(ptu)

cmd = 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/runtime-bridge-dispatch.sh"'
present = any(
    any(cmd in h.get("command", "") for h in e.get("hooks", []))
    for e in ptu
)
if present:
    print("[settings] runtime-bridge hook already present — skipping")
    sys.exit(0)

# Backup only when the file exists and we are about to write
if os.path.exists(path):
    shutil.copy(path, path + ".bak")
    print("[settings] backup created: %s.bak" % path)

ptu.append({
    "matcher": "Write|Edit|MultiEdit",
    "hooks": [{"type": "command", "command": cmd}],
})
after_count = len(ptu)

tmp = path + ".tmp"
with open(tmp, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
# Validate before swap
with open(tmp) as f:
    json.load(f)
os.replace(tmp, path)
print("[settings] PostToolUse entries: %d → %d" % (before_count, after_count))
print("[settings] added runtime-bridge PostToolUse entry")
PY
      then
        : # python block handled its own output
      else
        warn "PostToolUse entry NOT written: ${SETTINGS_JSON} could not be patched (not valid JSON, or not writable); it is left as it was."
      fi
    else
      # Not written: --no-write-settings, declined, or python3 absent. A fact with its reason.
      if [[ "${WRITE_SETTINGS}" -eq 0 ]]; then _WHY="--no-write-settings was passed"
      elif [[ "${_DO_WRITE}" -eq 0 ]]; then _WHY="the auto-write was declined"
      else _WHY="python3 is not on PATH, and this script edits settings.json only through it"; fi
      say "PostToolUse entry NOT written to ${SETTINGS_JSON}: ${_WHY}. Without it the dispatch hook does not fire."
    fi
    say ""
    say "Done. Auto-dispatch is OPT-IN per kickoff: only a kickoff whose FIRST line is"
    say "  <!-- bridge: auto -->"
    say "auto-dispatches to aif-handoff; any other kickoff is dispatched on demand by"
    say "  packages/runtime-bridge/src/cli/dispatch.ts"
    say "On quota_exceeded / unreachable the bridge falls back to ManualBackend."
    ;;
  *)
    say ""
    say "Bridge not enabled — ManualBackend (copy-paste) stays the default; nothing was written."
    say "Auto-dispatch is opt-in anyway: even with the bridge active, only kickoffs"
    say "with FIRST line"
    say "  <!-- bridge: auto -->"
    say "auto-dispatch; any other kickoff is dispatched on demand by"
    say "  packages/runtime-bridge/src/cli/dispatch.ts"
    say "RUNTIME_BRIDGE_MODE=manual in the environment keeps every session in manual mode."
    ;;
esac
