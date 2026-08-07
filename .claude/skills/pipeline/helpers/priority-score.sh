#!/usr/bin/env bash
# priority-score.sh — §7.3 deterministic data feed for SKILL.md §2 Priority scoring.
#
# Usage: priority-score.sh
#
# Outputs per-candidate data lines for SKILL.md body to score and rank.
# Format: <name> type=<type> kickoff=<exists|missing|synthetic> stage=<1|2|?> volume=<S|M|L|?>
#
# COMPLETION-DETECTION LAYERS (meta-orch-no-arg-overview Stage 2):
# For each real kickoff entry, a tri-layer classifier determines if the umbrella is DONE.
# Layer evaluation order: C1 (branch) → C2 (jaccard) → C3 (done.md). First-match-wins.
#
#   completion Layer C1 (branch-prefix match, ~13% empirical coverage per §1.5c):
#     Strip conventional branch prefix from merged-PR headRefNames; exact-match against
#     umbrella name. Covers single-stage umbrellas with clean `feat/<name>` branches.
#
#   completion Layer C2 (jaccard PR-title overlap, ~4% additional per §4 estimate):
#     REUSE dup-detect.sh jaccard logic (sub-shell call + output parsing). Any
#     POTENTIAL_DUPE: line from dup-detect.sh --all implies completion candidate for
#     the named umbrella. Uses MO_JACCARD_THRESHOLD (default 30%) from dup-detect.sh.
#     SSOT: helpers/dup-detect.sh:62 — zero new LOC for the jaccard algorithm itself.
#
#   completion Layer C3 (done.md file, load-bearing fallback — ADAPT Cline SSOT #77):
#     Check ${PROMPTS_DIR}/<umbrella>/done.md existence. If present, parse
#     "Final PR: #<num>" line and tag status=DONE done_pr=<num> basis=done-md.
#     ADAPT Cline Memory Bank committed-markdown sub-pattern (~85% problem-class match
#     on storage format; diverges on update trigger: Cline = on-demand AI-signalled,
#     ours = explicit convention at last-stage umbrella merge).
#
# NOTE on "L1 extension" terminology below: the "L1 extension" label in the SYNTHETIC
# ENTRIES section refers to Stage 2 of the meta-orchestrator-planner-completeness umbrella
# (8 synthetic surface types). It is UNRELATED to the completion-detection layers C1/C2/C3
# above. Do not conflate.
#
# SYNTHETIC ENTRIES (synthetic-candidate extension — Stage 2 of meta-orchestrator-planner-completeness):
# Beyond real kickoff.md discovery, this helper emits "synthetic" candidate entries for
# 8 additional surface types. Synthetic namespace: <umbrella>-<reason> or <category>-<id>
# — chosen to never collide with a real kickoff.md-derived <name> entry (which is a plain
# directory basename without a dash-reason suffix or category prefix).
#
# Synthetic surface types:
#   (a) cold-review-fixes.md in any <resolved-orch-home>/*/
#   (b) state.md matching PENDING|TODO|AWAITING|REVIEW-PENDING
#   (c) Memory files with TODO-codify: marker
#   (d) Stale open PRs (no update in >14 days)
#   (e) wave-sequencing-plan.md §0 rows marked 🟡 / 🔲 NOT blocked / DEFERRED
#   (f) open-questions.md §13.x entries
#   (g) // TODO:|FIXME:|XXX: in packages/**/*.ts (DN-1 scope)
#   (h) research-patches with §future / Known residuals / Residuals / MINOR observations
#
# Seams for testing:
#   MO_GH_BIN        — override the `gh` binary used for stale-PR detection (default: gh)
#   MO_DUP_DETECT_BIN — override the dup-detect.sh binary used for C2 jaccard (default: auto-resolve from helpers/)
#   MO_MEM_DIR       — override the memory directory (default: ~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory)
#   MO_WAVE_PLAN     — override the wave-sequencing-plan.md path (default: <REPO_ROOT>/docs/meta-factory/wave-sequencing-plan.md)
#   MO_OPEN_QUESTIONS — override the open-questions.md path (default: <REPO_ROOT>/docs/meta-factory/open-questions.md)
#   MO_PACKAGES_DIR  — override the packages directory (default: <REPO_ROOT>/packages)
#   MO_PATCHES_DIR   — override the research-patches directory (default: <REPO_ROOT>/docs/meta-factory/research-patches)
#   REPO_ROOT        — override repo root (default: git rev-parse --show-toplevel)
#
# The SKILL.md body applies the multi-criteria scoring and ranking (judgment).
# This helper supplies deterministic facts only.
#
# @cc-only-rationale: meta-orchestrator skill helper — runs in-session via !shell injection;
#   no portable equivalent fires at the same moment (PostToolUse timing is CC-specific).
set -euo pipefail

# Named-mode early-exit: priority scoring is §2 only (no-arg / integer-arg mode).
# String arg = named umbrella → skip full backlog scan (pipeline-ux P2).
# Integer arg = top-N request → proceed normally (V4 binding).
_ARG="${1:-}"
if [[ -n "$_ARG" ]] && [[ "$_ARG" =~ [^0-9] ]]; then
  echo "=== priority-score: named-mode skip (umbrella=${_ARG}) ==="
  echo "=== priority-score: END rc=0 ==="
  exit 0
fi

# Seam overrides (used by tests to inject fixtures; set BEFORE git-derived defaults)
# REPO_ROOT may be pre-set by caller (e.g. test harness); if not, derive from git.
# REPO_ROOT (+ shared resolve_target / tokeniser primitives) sourced from lib/common.sh
# (Stage 4 dedup, BASH_SOURCE-relative so it survives the REPO_ROOT test-seam).
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
PROMPTS_DIR="$(resolve_orch_home)"

MO_GH_BIN="${MO_GH_BIN:-gh}"
# C2 jaccard seam: override dup-detect.sh path for testing (completion-detection Layer C2).
_DEFAULT_DUP_DETECT="${REPO_ROOT}/.claude/skills/pipeline/helpers/dup-detect.sh"
MO_DUP_DETECT_BIN="${MO_DUP_DETECT_BIN:-${_DEFAULT_DUP_DETECT}}"
# W4: derive the CC project-memory slug from REPO_ROOT (path with `/`→`-`) instead of a
# hardcoded repo path, so the helper works on any checkout / consumer clone. The synthetic
# section (c) below already guards `[[ -d "${MO_MEM_DIR}" ]]` → missing dir is skipped
# silently (memory is supplementary, not load-bearing).
_repo_slug="${REPO_ROOT//\//-}"
MO_MEM_DIR="${MO_MEM_DIR:-${HOME}/.claude/projects/${_repo_slug}/memory}"
MO_WAVE_PLAN="$(resolve_plan_path)"
MO_OPEN_QUESTIONS="${MO_OPEN_QUESTIONS:-${REPO_ROOT}/docs/meta-factory/open-questions.md}"
MO_PACKAGES_DIR="${MO_PACKAGES_DIR:-${REPO_ROOT}/packages}"
MO_PATCHES_DIR="${MO_PATCHES_DIR:-${REPO_ROOT}/docs/meta-factory/research-patches}"

echo "=== priority-score: candidate umbrellas ==="

if [[ ! -d "${PROMPTS_DIR}" ]]; then
  # Name the home actually probed — a hardcoded `.claude/…` here sends a consumer looking
  # for a directory the resolver never consulted.
  echo "(no $(repo_rel "${PROMPTS_DIR}") directory)"
  exit 0
fi

# ── completion Layer C1: fetch merged-PR headRefNames once (BRANCH-MATCHER) ──────────────────
# completion-detection Layer C1 (branch-prefix match, meta-orch-no-arg-overview Stage 2-extend).
# Counters T-NoArg-A `#open-prs-zero-equals-no-work`: open_prs=0 alone is not a
# completion signal. A merged PR with headRefName `feat/<umbrella>` (or fix/chore/
# docs/research prefix) signals umbrella DONE via exact-match after prefix strip.
# Multi-stage umbrellas use `feat/<umbrella>-s<N>` branches — these stay candidates
# by convention (no false DONE on partial-progress, matching kickoff §3 self-app test).
# Counters T-NoArg-B: does NOT grep '#<num>' from kickoff (kickoff written before PRs).
# Counters T-NoArg-C: does NOT rely on PR-title word overlap (that is Layer C2's job).
merged_prs_json="$(${MO_GH_BIN} pr list --state merged --json number,headRefName --limit 100 2>/dev/null || echo '[]')"

# ── Skip-closed pre-filter: feed the expensive C2 scan only the OPEN survivors ──────
# Perf (pipeline-completion-scan-skip-closed, 2026-06-17): the per-umbrella jaccard in
# dup-detect --all is the dominant cost (measured: ~2.70s/umbrella over the full set vs
# ~3.0s umbrella-invariant gh+precompute → full=446s, open-only=76s, 83% of the cost is
# per-umbrella). Umbrellas already provably closed by a CHEAP signal — C3 done.md (file
# existence) or C1 branch-match (jq over the already-fetched merged_prs_json) — are
# classified DONE by the loop below via C1/C3 regardless, so they never need the expensive
# C2 pass. Feed dup-detect ONLY the open survivors. An umbrella closed ONLY by C2 jaccard
# (no done.md, no branch-match) is NOT cheap-closed → it stays in the subset → C2 still
# tags it DONE (AC-2 paired-negative invariant: DONE-membership is unchanged).
# Fix shape (a): the filter lives here (orchestration-side); dup-detect stays
# closure-agnostic (it scans the names it is handed via MO_UMBRELLA_SUBSET). Zero new gh,
# zero new dependency. Caller B (SKILL §2.5 standalone dedup) never sets the subset.
_merged_branch_names=""
if command -v jq &>/dev/null && [[ -n "${merged_prs_json}" && "${merged_prs_json}" != "[]" ]]; then
  _merged_branch_names="$(echo "${merged_prs_json}" \
    | jq -r '.[] | (.headRefName | sub("^(feat|fix|chore|docs|research)/"; ""))' 2>/dev/null || true)"
fi
_open_survivors=""
for _d in "${PROMPTS_DIR}"/*/; do
  _n="${_d%/}"; _n="${_n##*/}"                        # basename, pure-bash (no subprocess)
  [[ -f "${_d}kickoff.md" ]] || continue             # no kickoff → not a real candidate
  [[ -f "${_d}done.md" ]] && continue                # C3 cheap-closed → skip expensive C2
  if [[ -n "${_merged_branch_names}" ]] \
      && printf '%s\n' "${_merged_branch_names}" | grep -qxF "${_n}" 2>/dev/null; then
    continue                                          # C1 cheap-closed → skip expensive C2
  fi
  _open_survivors+="${_n}"$'\n'
done

# ── completion Layer C2: dup-detect.sh jaccard pre-fetch (REUSE, sub-shell) ─────────────────
# completion-detection Layer C2 (jaccard title overlap, meta-orch-no-arg-overview Stage 2-extend).
# REUSE: calls dup-detect.sh --all (sub-shell approach — option (a); preserves dup-detect.sh
# callers unchanged, avoids modifying a Stage-4-owned file per §6 Option B).
# Parse output: "POTENTIAL_DUPE: <umbrella> may overlap with merged #<num> ..." lines only.
# Populated once; per-umbrella lookup is a grep against this variable.
# Restricted to the open survivors via MO_UMBRELLA_SUBSET (skip-closed). If there are no
# open survivors (all umbrellas cheap-closed) the call is skipped (C2 has nothing to find).
# If dup-detect.sh unavailable or gh fails, falls back to empty string (C2 skipped; C3 still runs).
_dup_detect_all_output=""
if [[ -x "${MO_DUP_DETECT_BIN}" && -n "${_open_survivors}" ]]; then
  _dup_detect_all_output="$(REPO_ROOT="${REPO_ROOT}" MO_GH_BIN="${MO_GH_BIN}" \
    MO_UMBRELLA_SUBSET="${_open_survivors}" \
    "${MO_DUP_DETECT_BIN}" --all 2>/dev/null || true)"
fi

# ── open-PR pre-fetch (W3 — single gh call replaces per-umbrella loop calls) ──────
# Stage 3 worktree-hardening W3: the per-umbrella `gh pr list --search` inside the loop
# below cost one gh round-trip per candidate (~138 calls on a full backlog). Fetch all
# open PRs ONCE here; per-umbrella `open_prs` becomes an in-memory grep over this blob.
_ALL_OPEN_PRS="$(${MO_GH_BIN:-gh} pr list --state open --json number,headRefName --limit 500 2>/dev/null || echo '[]')"

# ── REAL KICKOFF ENTRIES (existing behaviour — T17 preserve) ─────────────────

for dir in "${PROMPTS_DIR}"/*/; do
  name="$(basename "${dir}")"
  kickoff="${dir}kickoff.md"

  # Skip internal-only dirs (state-only, no kickoff)
  if [[ ! -f "${kickoff}" ]]; then
    echo "${name} kickoff=missing"
    # D6 (legacy reconstruct fallback, cross-session kickoff portability SSOT #116):
    # if a committed plan row references this umbrella, surface a non-authoritative
    # reconstruct notice. Does NOT auto-write the plan (Direction A REJECTED — see
    # SKILL.md §2.5 Step 8). Degraded safety net for LEGACY umbrellas whose kickoffs
    # predate the portability convention and were never committed.
    # Word-boundary match (treat hyphen as a name char) so a short umbrella name
    # is not a false-positive substring of an unrelated plan row (e.g. "ux" inside
    # "ux-improvements"). Kebab-case names are regex-safe (alnum + hyphen only).
    _rs_re="(^|[^[:alnum:]-])${name}([^[:alnum:]-]|$)"
    if [[ -f "${MO_WAVE_PLAN}" ]] && grep -qE "${_rs_re}" "${MO_WAVE_PLAN}" 2>/dev/null; then
      echo "RECONSTRUCT-STUB: ${name} has a committed plan row but kickoff=missing — author + commit $(resolve_orch_home_rel)/${name}/kickoff.md to restore portability (no auto-write)"
    fi
    continue
  fi

  # Extract Type from kickoff header (line 2-5 typically)
  type_line="$(grep -m1 '^\*\*Type:\*\*\|^> \*\*Type:\*\*' "${kickoff}" 2>/dev/null || echo '')"
  if echo "${type_line}" | grep -qi 'R-phase\|research'; then
    wave_type="R-phase"
  elif echo "${type_line}" | grep -qi 'I-phase\|execution\|build'; then
    wave_type="I-phase"
  elif echo "${type_line}" | grep -qi 'wiring\|config\|ci'; then
    wave_type="wiring"
  else
    wave_type="unknown"
  fi

  # Estimate volume from kickoff LOC as a proxy
  loc="$(wc -l < "${kickoff}" 2>/dev/null || echo 0)"
  if [[ "${loc}" -lt 100 ]]; then
    volume="S"
  elif [[ "${loc}" -lt 250 ]]; then
    volume="M"
  else
    volume="L"
  fi

  # Check for open PRs matching this umbrella (W3 — in-memory grep over the single
  # pre-fetched _ALL_OPEN_PRS blob; no per-umbrella gh round-trip).
  # `grep -c` always emits a count (0 if no match) but exits 1 on no match;
  # `|| true` keeps `set -e` happy without duplicating the "0" output that `|| echo 0` produced.
  open_prs="$(printf '%s' "${_ALL_OPEN_PRS}" | grep -c "\"${name}\"" || true)"

  # ── Completion-detection tri-layer classifier (C1 → C2 → C3, first-match-wins) ──
  done_pr=""
  done_basis=""

  # completion Layer C1 — branch-prefix match (consumes merged_prs_json from above).
  # Exact-match umbrella name against merged-PR headRefName after stripping conventional
  # branch prefix. Skipped silently if jq absent or merged_prs_json is empty.
  if [[ -z "${done_pr}" ]] && command -v jq &>/dev/null \
      && [[ -n "${merged_prs_json}" && "${merged_prs_json}" != "[]" ]]; then
    done_pr="$(echo "${merged_prs_json}" \
      | jq -r --arg name "${name}" \
          '.[] | select((.headRefName | sub("^(feat|fix|chore|docs|research)/"; "")) == $name) | .number' \
      2>/dev/null | head -n1 || true)"
    [[ -n "${done_pr}" ]] && done_basis="branch"
  fi

  # completion Layer C2 — jaccard PR-title overlap (REUSE dup-detect.sh sub-shell output).
  # Consumes _dup_detect_all_output pre-fetched above. Parses "POTENTIAL_DUPE: <umbrella> ..."
  # lines; extracts PR number from "merged #<num>" pattern. First match wins per umbrella.
  if [[ -z "${done_pr}" && -n "${_dup_detect_all_output}" ]]; then
    _c2_line="$(printf '%s\n' "${_dup_detect_all_output}" \
      | grep "^POTENTIAL_DUPE: ${name} " | head -n1 || true)"
    if [[ -n "${_c2_line}" ]]; then
      done_pr="$(printf '%s' "${_c2_line}" | grep -oE 'merged #[0-9]+' | grep -oE '[0-9]+' | head -n1 || true)"
      # Extract score for output annotation (e.g. "score=42%")
      _c2_score="$(printf '%s' "${_c2_line}" | grep -oE 'score=[0-9]+%' | head -n1 || true)"
      [[ -n "${done_pr}" ]] && done_basis="jaccard${_c2_score:+ ${_c2_score}}"
    fi
  fi

  # completion Layer C3 — committed done.md (ADAPT Cline SSOT #77 committed-markdown sub-pattern).
  # Check <umbrella>/done.md existence; parse "Final PR: #<num>" line.
  # Load-bearing fallback: deterministic (file-presence), zero gh rate-limit cost.
  if [[ -z "${done_pr}" && -f "${dir}done.md" ]]; then
    done_pr="$(grep -m1 '^- Final PR: #' "${dir}done.md" 2>/dev/null \
      | grep -oE '[0-9]+' | head -n1 || true)"
    # done.md existence ALONE proves closure (C3 ADAPT Cline #77). A stale/superseded closure
    # carries "Final PR: n/a" (no numeric PR) — still DONE; tag done_pr=n/a so the filter drops
    # it. Pre-fix bug: n/a closures (e.g. the 2026-06-05 sweep) stayed false-open because this
    # layer only tagged DONE on a numeric PR — fixed 2026-06-16 closure-sweep.
    [[ -z "${done_pr}" ]] && done_pr="n/a"
    done_basis="done-md"
  fi

  # Emit candidate line with optional DONE tag (basis indicates which layer matched).
  if [[ -n "${done_pr}" ]]; then
    echo "${name} type=${wave_type} kickoff=exists volume=${volume} open_prs=${open_prs} loc=${loc} status=DONE done_pr=${done_pr} basis=${done_basis}"
  else
    echo "${name} type=${wave_type} kickoff=exists volume=${volume} open_prs=${open_prs} loc=${loc}"
  fi
done

# ── SYNTHETIC ENTRIES — split to priority-score-synthetic.sh (Stage 4 slim, 2026-06-03) ──────
# Synthetic-candidate discovery surfaces (a)-(h): cold-review-fixes / state-pending /
# memory TODO-codify / stale PRs / wave-plan rows / open-questions / code TODOs / patch
# residuals. Invoked as a subprocess so its stdout flows into this script's output unchanged
# (black-box test contract preserved). Export resolved env seams so the child uses identical
# values rather than re-deriving (zero behavioural drift). The sibling is resolved relative to
# THIS script's location (BASH_SOURCE), not REPO_ROOT - tests seam REPO_ROOT to a sandbox, but
# the helper always ships beside priority-score.sh.
export REPO_ROOT PROMPTS_DIR MO_GH_BIN MO_MEM_DIR MO_WAVE_PLAN MO_OPEN_QUESTIONS MO_PACKAGES_DIR MO_PATCHES_DIR
_PS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${_PS_DIR}/priority-score-synthetic.sh"
