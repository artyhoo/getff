#!/usr/bin/env bash
# @cc-only-rationale: support library of two CC-native hooks (the PreCompact residue
#   writer + the Stop hook's handoff-currency gate) — it defines no hook itself, so it has
#   no portable counterpart of its own; the delivery-channel markers live on the consuming
#   hooks, and the plugin twin of end-of-turn-reminder runs its inline fallback (D23).
# Shared residue-directory primitives — ONE resolution for every hook that reads or
# writes the residue. Spec: docs/superpowers/specs/2026-09-08-handoff-currency-gate-design.md
# (D29 — the cascade extracted from precompact-residue.sh's inline `_residue_dir()`).
#
# Members:
#   _residue_dir            the cascade: AIF_RESIDUE_DIR → print-orch-home.sh → inline default
#   _residue_sha256 <file>  portable file sha256 (sha256sum → shasum -a 256), the
#                           deps-hash-check.sh:97-104 two-branch shape; used by the
#                           handoff-currency gate's baseline (D19) and the PreCompact
#                           pointer line (D15)
#
# LOADING CONTRACT (D29) — never source this file UNCONDITIONALLY. Both consumers load it
# behind the guarded shape (`if ! [ -f … ] || ! . …`, the check-doc-authority.sh:40-48
# guard shape with an inline fallback instead of a SKIP), because end-of-turn-reminder.sh
# runs under `set -euo pipefail`: an unconditional `.` of a missing lib aborts the Stop
# hook on EVERY turn of any project the delivery step has not reached. Each consumer
# keeps its own inline fallback so a missing lib degrades to today's behaviour, never to
# a crash. `plugin/hooks/lib/` ships no twin of this file (no writer reaches consumers):
# the plugin twin of end-of-turn-reminder runs on its inline fallback — the divergence
# D23 records.
#
# Pure definitions — sourcing this file executes nothing, so sourcing it cannot change
# any consumer's output (the D18 unarmed byte-identity depends on that).

# ── Residue directory — ONE resolution, shared with the readers ───────────────
# AIF_RESIDUE_DIR is the test seam + operator escape hatch (precedent: MO_ORCH_HOME).
# Otherwise call the /pipeline helper that §1's injection fence already calls, with
# REPO_ROOT pinned (lib/common.sh honours a pre-set value, common.sh:17) so the helper
# resolves THIS repo rather than whatever git toplevel the hook's cwd happens to be in.
# The inline branch at the end is the no-helper fallback (a consumer install without the
# skill); it mirrors resolve_orch_home() (helpers/lib/common.sh:50-57).
# The repo root is `$root` when the caller set it (the PreCompact writer derives it from
# CLAUDE_PROJECT_DIR → payload cwd → pwd), else CLAUDE_PROJECT_DIR → pwd — so a caller
# that never resolves a root itself still lands in THIS project, not in the cwd a
# harness happened to launch the hook from.
_residue_dir() {
  if [ -n "${AIF_RESIDUE_DIR:-}" ]; then printf '%s\n' "$AIF_RESIDUE_DIR"; return; fi
  local _rd_root="${root:-}"
  [ -n "$_rd_root" ] || _rd_root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
  local _rd_helper="$_rd_root/.claude/skills/pipeline/helpers/print-orch-home.sh" _rd_out=""
  if [ -f "$_rd_helper" ]; then
    _rd_out=$(REPO_ROOT="$_rd_root" bash "$_rd_helper" 2>/dev/null || true)
    if [ -n "$_rd_out" ]; then printf '%s\n' "$_rd_out"; return; fi
  fi
  if [ -d "$_rd_root/.claude/orchestrator-prompts" ]; then
    printf '%s\n' "$_rd_root/.claude/orchestrator-prompts"
  else
    printf '%s\n' "$_rd_root/.ai-factory/orchestrator-prompts"
  fi
}

# ── sha256 of a file — portable, two-branch (deps-hash-check.sh:97-104 shape) ──
# Echoes the hex digest, or EMPTY when no hashing tool exists. An empty digest is the
# caller's signal to skip the compare (the deps-hash precedent: "treats empty-current as
# 'skip compare'") — the gate must never treat a missing tool as "content unchanged".
_residue_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" 2>/dev/null | awk '{printf "%s", $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" 2>/dev/null | awk '{printf "%s", $1}'
  fi
}
