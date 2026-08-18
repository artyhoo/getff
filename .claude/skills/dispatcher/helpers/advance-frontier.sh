#!/usr/bin/env bash
# advance-frontier.sh — the §2.7 Advance step, executed rather than narrated.
#
# Input:  $1 = umbrella slug (e.g. "frontier-residue-sweep")
# Output: the FULL frontier.sh emitter output (tee'd — every decision line is
#         recorded output, not prose), then ONE verdict line, plus FRONTIER-SET /
#         ATTN-UNRESOLVED satellites on ADVANCE.
# Exit:   always 0 — the caller branches on the verdict prefix, never on the
#         exit code (same contract as probe-inflight.sh / monitor-classify.sh;
#         a guard that aborts is a guard that gets skipped).
#
# Why this exists: §2.7 «Advance» picked the next stage by eye — the
# `#hope-as-gate` shape attention-is-not-a-mechanism.md §1 forbids, and the
# weightiest residue of the skill-harmonization close. This helper is a pure
# CONSUMER of the /pipeline-owned emitter
# (.claude/skills/pipeline/helpers/frontier.sh): it never re-implements
# dependency parsing (the delegation arm in advance-frontier.test.ts asserts
# that from this file's source). The merge AUTHORITY stays §2.6
# `gh pr list --search "is:merged … base:staging"` — `basis=marker-unverified`
# is a row-text READ, never a proof, and HALT-VERIFY sends exactly those ids
# there before anything advances (T-FRS1-B).
#
# Verdicts (first match wins):
#   ADVANCE-INCOMPLETE:  the question could not be asked (no umbrella arg, no
#                        kickoff, unrecognized emitter output) — an unasked
#                        question never renders as a clean answer
#   ADVANCE-DEGRADE:     the emitter degraded (no column / no table / zero
#                        rows) — ordering returns to judgment; pick per the
#                        kickoff §1 order AND record the degrade
#   COMPLETE:            done.md exists (umbrella closed), or every stage is
#                        done with no done.md yet — §2.8 territory
#   HALT-VERIFY: <ids>   marker-based done-claims pending the §2.6 gh check;
#                        after it answers, re-run this helper with
#                        MO_FRONTIER_DONE=<merged-ids> MO_FRONTIER_OPEN=<refuted>
#   HALT-BLOCKED:        no frontier while stages remain (cycle / stale done
#                        markers — see the emitter's WARN lines above)
#   ADVANCE: <id>        first frontier id in STAGE-line table order;
#                        FRONTIER-SET: lists ALL frontier ids — parallel
#                        candidates, one §2.0 re-probe each before dispatch
#
# Env passthrough (consumed by the emitter, never interpreted here):
#   MO_KICKOFF_DIR / MO_FRONTIER_DONE / MO_FRONTIER_OPEN / REPO_ROOT
#
# Tested by: packages/core/skills/dispatcher/advance-frontier.test.ts
# Consumed by: .claude/skills/dispatcher/SKILL.md §2.7
#
# @dual-pair: dispatcher-skill
# spec: .claude/skills/pipeline/references/frontier.md (emitter grammar) — this
#       file derives verdicts from that grammar; the emitter resolves the
#       frontier. Never a fork.
# @cc-only-rationale: /dispatcher skill helper — runs in-session at the §2.7
#   advance step; no portable hook fires at that per-invocation moment. Pure
#   bash over the emitter's deterministic output, no paid LLM.

set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

UMBRELLA="${1:-}"
EMITTER="$(dirname "${BASH_SOURCE[0]}")/../../pipeline/helpers/frontier.sh"

if [[ -z "${UMBRELLA}" ]]; then
  echo "(advance-frontier: no umbrella — pass the umbrella slug as \$1, after §2 selects it)"
  echo "ADVANCE-INCOMPLETE: no umbrella argument"
  exit 0
fi

# Run the emitter and tee its full output. `|| true` keeps the exit-0 contract
# even on an emitter crash; an empty capture is INCOMPLETE below, never clean.
out="$(bash "${EMITTER}" "${UMBRELLA}" 2>&1)" || true
printf '%s\n' "${out}"

if [[ -z "${out}" ]]; then
  echo "ADVANCE-INCOMPLETE: emitter produced no output for '${UMBRELLA}'"
  exit 0
fi

# ── Field extraction — one line per prefix; every field exists at most once ───
field() { printf '%s\n' "${out}" | grep -m1 "^$1" || true; }

missing="$(field 'MISSING kickoff:')"
degrade="$(field 'DEGRADE:')"
done_md="$(field 'done-md: yes')"
attn_marker="$(field 'ATTN: marker-unverified done ')"
frontier="$(field 'FRONTIER:')"
blocked="$(field 'BLOCKED:')"
doneline="$(field 'DONE:')"
unresolved="$(field 'UNRESOLVED:')"

# ── Verdict, first match wins (rationale per header table) ───────────────────
if [[ -n "${missing}" ]]; then
  echo "ADVANCE-INCOMPLETE: kickoff not found (${missing#MISSING kickoff: })"
  exit 0
fi

if [[ -n "${degrade}" ]]; then
  # The degrade path must never read as permission (frontier.md §1): ordering
  # returns to the reader's judgment, and the judgment must be recorded.
  echo "ADVANCE-DEGRADE: ${degrade#DEGRADE: } — pick per the kickoff §1 stage order and record the degrade"
  exit 0
fi

if [[ -n "${done_md}" ]]; then
  echo "COMPLETE: umbrella closed (done.md)"
  exit 0
fi

if [[ -n "${attn_marker}" ]]; then
  # The ids sit between the em-dash and " read as done" on the ATTN line. A
  # format drift that defeats the sed leaves the whole line in <ids> — noisy,
  # but still a HALT (fails toward the gate, never past it).
  ids="$(printf '%s\n' "${attn_marker}" | sed -E 's/^ATTN: marker-unverified done — (.*) read as done.*$/\1/')"
  echo "HALT-VERIFY: ${ids} — marker done-claims unverified; run the §2.6 gh check, then re-run with MO_FRONTIER_DONE=<merged> MO_FRONTIER_OPEN=<refuted>"
  exit 0
fi

if [[ -z "${frontier}" ]]; then
  echo "ADVANCE-INCOMPLETE: emitter output carried no FRONTIER: line — unrecognized shape, read the output above"
  exit 0
fi

fr_list="$(printf '%s\n' "${frontier}" | sed -E 's/^FRONTIER: //')"
if [[ "${fr_list}" == "(none)" ]]; then
  bl="$(printf '%s\n' "${blocked}" | sed -E 's/^BLOCKED: //')"
  dn="$(printf '%s\n' "${doneline}" | sed -E 's/^DONE: //')"
  if [[ "${bl}" != "(none)" && -n "${bl}" ]]; then
    echo "HALT-BLOCKED: no frontier while stages remain (see the WARN lines above — dependency cycle or stale done markers)"
    exit 0
  fi
  if [[ "${dn}" != "(none)" && -n "${dn}" ]]; then
    echo "COMPLETE: all stages done, no done.md yet — write it (§2.8)"
    exit 0
  fi
  echo "HALT-BLOCKED: no frontier, nothing done, nothing blocked — unexpected shape; read the emitter output above"
  exit 0
fi

first="$(printf '%s' "${fr_list}" | awk '{print $1}')"
echo "ADVANCE: ${first}"
echo "FRONTIER-SET: ${fr_list}"

unr="$(printf '%s\n' "${unresolved}" | sed -E 's/^UNRESOLVED: //')"
if [[ -n "${unr}" && "${unr}" != "(none)" ]]; then
  echo "ATTN-UNRESOLVED: ${unr} — read their raw= cells above before dispatch (ceiling 1: the emitter echoes, never judges)"
fi
