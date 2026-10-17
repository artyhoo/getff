#!/usr/bin/env bash
# priority-score-synthetic.sh — synthetic-candidate discovery surfaces (a)-(h) for the
# /pipeline priority-score sequencer. Split out of priority-score.sh 2026-06-03
# (Stage 4 slim) to keep the main sequencer focused on kickoff-candidate enumeration +
# completion layers C1/C2/C3.
#
# Standalone + subprocess-safe: re-derives the same env seams as priority-score.sh
# (REPO_ROOT / PROMPTS_DIR / MO_* defaults identical). priority-score.sh exports its
# resolved values before invoking this file, so stdout is byte-identical to the previous
# inline section whether run directly or as a child. Black-box contract preserved:
# packages/core/hooks/priority-score-synthetic.test.ts (paired-negative per surface).
#
# @cc-only-rationale: meta-orchestrator skill helper — runs in-session via !shell injection;
#   no portable equivalent fires at the same moment (PostToolUse timing is CC-specific).
set -euo pipefail

# Env seams — identical defaults to priority-score.sh. When invoked as a subprocess these
# are inherited (exported by the parent); standalone they derive from git + REPO_ROOT.
# REPO_ROOT (+ shared resolve_target / tokeniser primitives) sourced from lib/common.sh
# (Stage 4 dedup, BASH_SOURCE-relative so it survives the REPO_ROOT test-seam).
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
PROMPTS_DIR="${PROMPTS_DIR:-$(resolve_orch_home)}"
MO_GH_BIN="${MO_GH_BIN:-gh}"
_repo_slug="${REPO_ROOT//\//-}"
MO_MEM_DIR="${MO_MEM_DIR:-${HOME}/.claude/projects/${_repo_slug}/memory}"
MO_WAVE_PLAN="$(resolve_plan_path)"
MO_OPEN_QUESTIONS="${MO_OPEN_QUESTIONS:-${REPO_ROOT}/docs/meta-factory/open-questions.md}"
MO_PACKAGES_DIR="${MO_PACKAGES_DIR:-${REPO_ROOT}/packages}"
MO_PATCHES_DIR="${MO_PATCHES_DIR:-${REPO_ROOT}/docs/meta-factory/research-patches}"

# ── Closure suppression for the DIRECTORY-SCOPED surfaces (a) + (b) ─────────────────────────
# Surfaces (a) and (b) key on an umbrella directory under ${PROMPTS_DIR}, so the same
# completion signal priority-score.sh trusts as load-bearing for real kickoff entries —
# Layer C3, a committed done.md (operational-conventions.md §1) — applies to them too.
# Without this, a closed umbrella keeps generating follow-up candidates forever: measured
# 2026-08-17 over 352 umbrella dirs, 45 of the 54 emitted (a)+(b) candidates (83%) named a
# directory that already carried a done.md.
#
# Deliberately NOT applied to (c)-(h): none of those key on an umbrella directory —
# (c) memory, (d) live open PRs, (e) wave plan, (f) open-questions, (g) packages/**/*.ts,
# (h) research-patches — so "a done.md in the same directory" is undefined for them. A stale
# open PR in particular is about a live PR, not about umbrella state, and must survive closure.
#
# Parent inheritance is ONE-DIRECTIONAL. `<x>-meta-launch` is the meta-orchestrator's launch
# staging FOR `<x>`, so closing `<x>` closes its staging. The reverse does NOT hold: 6 dirs
# in the live tree carry a meta-launch done.md while the parent umbrella is still open (the
# launch finished; the umbrella work continued), so a closed meta-launch must never suppress
# its parent — and this function is never asked to, since it only ever inspects upward.
_umbrella_closed() {
  local dir="${1%/}" u
  [[ -f "${dir}/done.md" ]] && return 0
  u="${dir##*/}"
  if [[ "${u}" == *-meta-launch ]]; then
    [[ -f "${PROMPTS_DIR}/${u%-meta-launch}/done.md" ]] && return 0
  fi
  return 1
}

# ── SYNTHETIC ENTRIES (synthetic-candidate extension — non-kickoff discovery surfaces) ──────
# NOTE: "synthetic-candidate extension" label replaces the earlier "L1 extension" comment to
# avoid confusion with completion-detection layers C1/C2/C3 introduced above. The underlying
# logic is unchanged — this is the same 8-surface synthetic discovery from Stage 2 of the
# meta-orchestrator-planner-completeness umbrella.

echo "=== priority-score: synthetic candidates (synthetic-candidate extension) ==="

# (a) cold-review-fixes.md — parked handoff docs that need a fresh session to apply
# Suppressed once the umbrella is closed (see _umbrella_closed above): a parked handoff doc
# is spent when the umbrella it hands off has merged its last stage.
find "${PROMPTS_DIR}" -mindepth 2 -maxdepth 2 -name 'cold-review-fixes.md' 2>/dev/null \
  | while read -r f; do
    dir="$(dirname "${f}")"
    _umbrella_closed "${dir}" && continue
    umbrella="$(basename "${dir}")"
    loc="$(wc -l < "${f}" 2>/dev/null || echo 0)"
    echo "${umbrella}-cold-review-fixes type=cleanup kickoff=synthetic source=cold-review-fixes loc=${loc}"
  done

# (b) state.md with PENDING/TODO/AWAITING/REVIEW-PENDING — umbrella with unresolved state
# Per-file grep -q via process substitution (same shape as surface (c)) — NOT find|xargs|grep.
# Under `set -euo pipefail` the old pipeline aborted the whole script (exit 123): on GNU/Linux
# an empty find makes xargs run grep on empty stdin, and a no-match `grep -l` exits 1 — either
# makes xargs exit 123, which pipefail propagates and set -e turns fatal. BSD/macOS xargs hid
# this (it skips the command on empty input), so the bug was invisible locally + ungated in CI.
# Suppressed once the umbrella is closed (see _umbrella_closed above): a PENDING marker in a
# closed umbrella's dispatch record is a dead thread, not a follow-up. Live case 2026-08-17 —
# triage-kernel-v2-meta-launch/state.md still named a superseded aif task after PR #1407.
while IFS= read -r s; do
  dir="$(dirname "${s}")"
  if ! _umbrella_closed "${dir}" \
    && grep -qiE 'PENDING|TODO|AWAITING|REVIEW-PENDING' "${s}" 2>/dev/null; then
    umbrella="$(basename "${dir}")"
    echo "${umbrella}-state-pending type=state-followup kickoff=synthetic source=state.md"
  fi
done < <(find "${PROMPTS_DIR}" -mindepth 2 -maxdepth 2 -name 'state.md' 2>/dev/null)

# (c) Memory files with TODO-codify: — durable conventions stranded in memory (memory-codification.md §5)
# Avoid pipefail issues: iterate via process substitution + explicit grep test per file.
if [[ -d "${MO_MEM_DIR}" ]]; then
  while IFS= read -r m; do
    # grep -q exits 1 on no match; skip file silently — not an error
    if grep -qE 'TODO-codify:' "${m}" 2>/dev/null; then
      stem="$(basename "${m}" .md)"
      echo "memory-codify-${stem} type=memory-followup kickoff=synthetic source=memory"
    fi
  done < <(find "${MO_MEM_DIR}" -maxdepth 1 -name '*.md' 2>/dev/null)
fi

# (d) Stale open PRs — no update in >14 days (1209600 seconds)
# Uses MO_GH_BIN seam; gracefully skips if gh unavailable or returns no output.
# `jq` required for timestamp arithmetic; if absent, this section is silently skipped.
if command -v jq &>/dev/null; then
  ${MO_GH_BIN} pr list --state open --json number,title,updatedAt --limit 30 2>/dev/null \
    | jq -r --argjson now "$(date +%s)" \
        '.[] | select($now - (.updatedAt | fromdateiso8601) > 1209600)
         | "stale-pr-\(.number) type=stalled kickoff=synthetic source=open-pr"' \
    2>/dev/null || true
fi

# (e) wave-sequencing-plan.md §0 rows marked 🟡 / 🔲 NOT blocked / DEFERRED
# Matches table rows (pipe-delimited) containing the emoji or keyword markers.
# All grep stages use `|| true` to avoid set -e killing the script when no rows match.
if [[ -f "${MO_WAVE_PLAN}" ]]; then
  { grep -E '^\|' "${MO_WAVE_PLAN}" 2>/dev/null || true; } \
    | { grep -E '🟡|🔲[^|]*NOT blocked|DEFERRED' || true; } \
    | sed -E 's/^\| *([^ |]+) *\|.*/\1/' \
    | { grep -E '^[A-Za-z0-9]' || true; } \
    | while read -r row_id; do
        echo "wave-plan-${row_id} type=plan-followup kickoff=synthetic source=wave-plan"
      done
fi

# (f) open-questions.md §13.x entries — emit one synthetic entry per §13.<id> heading
if [[ -f "${MO_OPEN_QUESTIONS}" ]]; then
  { grep -nE '^### 13\.[0-9]+' "${MO_OPEN_QUESTIONS}" 2>/dev/null || true; } \
    | sed -E 's/^[0-9]+:### 13\.([0-9]+).*/\1/' \
    | while read -r id; do
        echo "openq-§13-${id} type=open-question kickoff=synthetic source=open-questions"
      done
fi

# (g) // TODO:|FIXME:|XXX: in packages/**/*.ts (DN-1 scope: packages/ only, exclude node_modules + test files)
if [[ -d "${MO_PACKAGES_DIR}" ]]; then
  { grep -rnE '//[[:space:]]*(TODO|FIXME|XXX):' "${MO_PACKAGES_DIR}" \
      --include='*.ts' --exclude-dir=node_modules \
      --exclude='*.test.ts' --exclude='*.unit.ts' --exclude='*.spec.ts' 2>/dev/null \
    || true; } \
    | while IFS=: read -r match_file lineno _rest; do
        rel="${match_file#${REPO_ROOT}/}"
        echo "todo-${rel}-${lineno} type=code-todo kickoff=synthetic source=code-todo"
      done
fi

# (h) research-patches with §future / Known residuals / Residuals / MINOR observations sections
if [[ -d "${MO_PATCHES_DIR}" ]]; then
  { grep -rlE '^## (§future|Known residuals|Residuals|MINOR observations)' "${MO_PATCHES_DIR}" 2>/dev/null || true; } \
    | while read -r pf; do pb="$(basename "${pf}" .md)"
        { grep -oE '^## (§future|Known residuals|Residuals|MINOR observations)' "${pf}" 2>/dev/null || true; } \
          | sed -E 's/^## //;s/§//g;s/ /-/g' | tr '[:upper:]' '[:lower:]' \
          | while read -r a; do echo "residual-${pb}-${a} type=residual kickoff=synthetic source=research-patch-residual"; done
      done
fi
