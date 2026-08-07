#!/usr/bin/env bash
# Standing drift-guard: fail if the always-on context baseline exceeds the ceiling
# set by arch-v2-context-pipeline S-E (P3a). Keeps the resident set from re-bloating
# after the umbrella closes.
#
# Ceiling source: $AIF_ALWAYSON_CEILING (env), default below (per-environment labels
# live next to the default). Two environments share this knob; only one ceiling is
# committed because only the container baseline is measurable from where this stage
# ran (host-cc baseline is S-H's job per spec §1.6 FORK C).
#
# Declared coverage (N2 label required per arch-v2 S-E P3a kickoff §1 item 3): this
# gate sees the repo-authored always-on set only — 29,589 tok (aif-container) /
# 39,021 tok (host-cc) against a ~100k session-start total → 29-39%
# (2026-07-26-session-start-token-attribution.md:214-218). The remaining 60-71% is
# harness-resident and unreachable by any file-trim; P14 (S-H) addresses it as
# operator recommendations, never by this gate.
#
# Escape hatch (§3, per ci-tool-pinning.md §3 precedent): $AIF_ALWAYSON_BUDGET_ALLOW
# env with rationale ≥20 chars downgrades RED to WARN. Rationale length gates the
# escape so a bare "TODO" cannot skip the gate. Example:
#   AIF_ALWAYSON_BUDGET_ALLOW='temporary overage during X on date Y' git push
#
# Deterministic; no paid LLM (no-paid-llm-in-ci.md).
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

# Per-environment ceilings — ONE committed default, TWO labelled derivations:
#   - aif-container: the only environment measurable from where arch-v2 S-E ran
#                   (this commit). Derived 2026-08-06 from the post-P3b baseline at
#                   HEAD (bash scripts/measure-always-on.sh total_bytes = 48,671 B
#                   after the membership-predicate fix), × 1.10 = 53,538 B, rounded
#                   UP to the next 1,000 B → 54,000 B.
#                   Calibration neighbourhood (≤ 50.2 KB) per spec §1.6 FORK D —
#                   landed at 48.7 KB baseline, well inside the neighbourhood.
#   - host-cc:       UNMEASURED — baseline not reachable from the container; S-H's
#                   host session supplies it. Operator running on host-cc should
#                   override AIF_ALWAYSON_CEILING with a host-derived value.
CEILING="${AIF_ALWAYSON_CEILING:-54000}"

total="$("$DIR/measure-always-on.sh" | jq -r '.total_bytes')"
allow="${AIF_ALWAYSON_BUDGET_ALLOW:-}"

if (( total > CEILING )); then
  if [[ "${#allow}" -ge 20 ]]; then
    echo "WARN: always-on ${total}B exceeds ceiling ${CEILING}B — escaped: ${allow}" >&2
    exit 0
  fi
  echo "DRIFT: always-on context ${total}B exceeds ceiling ${CEILING}B" >&2
  echo "Fix: trim the .claude/rules/*.md resident set (rules with paths: frontmatter" >&2
  echo "are already non-resident; reduce CLAUDE.md, the digest, or bare-path rules)," >&2
  echo "OR escape with AIF_ALWAYSON_BUDGET_ALLOW='<rationale ≥20 chars>'" >&2
  exit 1
fi
echo "OK: always-on ${total}B within ceiling ${CEILING}B"
