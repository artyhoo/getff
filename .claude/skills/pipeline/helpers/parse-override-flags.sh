#!/usr/bin/env bash
# parse-override-flags.sh — /pipeline CLI override flag parser.
#
# > Class: C — prose-only; companion paired-negative test at
# >          packages/core/hooks/parse-override-flags.test.ts.
# > Authoritative for: parsing $1 (umbrella string) for one of 6 override
# >                    mode flags + reason; emitting OVERRIDE_MODE + OVERRIDE_REASON
# >                    on stdout; exit codes 0/1/2.
# > NOT authoritative for: routing tree itself (SKILL.md §2.5 Step 5);
# >                        alias↔dispatch mapping (SKILL.md §2.5 Step 6).
#
# Usage: parse-override-flags.sh "<umbrella-string>"
#   $1 — the full umbrella string from CC slash-command, possibly containing
#        whitespace-separated flags like "my-task --mode-solo --reason=some text"
#
# Tokenisation strategy: (B) manual position-scan loop.
#   Scan padded $1 for each known --mode-* token using glob matching (bash 3.2
#   compatible; no associative arrays). Extract --reason=<text> via case+regex.
#   Strategy (A) read -ra also considered; loses quoted reason text in $1.
#   Strategy (C) eval rejected — code injection risk.
#
# Bash 3.2 compatibility: no declare -A; flag→alias mapping uses a case statement.
#
# Behaviour:
#   exit 0 — exactly one flag found, reason >= MO_OVERRIDE_REASON_MIN chars
#             stdout: OVERRIDE_MODE=<ALIAS>\nOVERRIDE_REASON=<reason>
#   exit 1 — no flag found (no override; routing tree proceeds); empty stdout
#   exit 2 — error (multi-flag, missing/short reason, wrong arg count); stderr msg
#
# @dual-pair: meta-orchestrator-mode-overrides
# spec: .claude/skills/pipeline/references/mode-overrides.md
# @cc-only-rationale: invoked from SKILL.md §0 preamble as
#   ${CLAUDE_SKILL_DIR}/helpers/parse-override-flags.sh "${umbrella:-}"
#   (CC-session only; no portable hook fires at slash-command-parse moment;
#   pure-bash arg parsing, no paid LLM per no-paid-llm-in-ci.md §1).
#
# Seams for testing (mirrors update-delta.sh convention):
#   MO_OVERRIDE_REASON_MIN — override minimum reason length (default 20)

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "parse-override-flags.sh: usage: $0 \"<umbrella-string>\"" >&2
  exit 2
fi

INPUT="$1"
REASON_MIN="${MO_OVERRIDE_REASON_MIN:-20}"

# --- Flag detection (bash 3.2 compatible — no associative arrays) -----------
# Pad the input so every token can be matched as " --mode-X " regardless of
# position. Leading/trailing spaces simplify boundary detection.
PADDED=" ${INPUT} "

KNOWN_FLAGS="--mode-direct --mode-solo --mode-bundle --mode-pair --mode-decompose --mode-research"

# --- Preset detection (§8a Park-1/2; A4 spec) --------------------------------
# Detect --preset <name> in the umbrella string AND AIF_PIPELINE_PRESET env var.
# Precedence: --preset flag > AIF_PIPELINE_PRESET env > default (no preset).
# When a preset is resolved, it short-circuits the entire --mode-* path — the
# routing tree predicates come from the preset data (seam #2, SKILL.md §2.5).
# Collision: --preset + any --mode-* flag simultaneously → exit 2 (multi-source).
PRESET_NAME=""
if [[ "${PADDED}" == *" --preset "* ]]; then
  # Extract the token after --preset (bash 3.2 regex, no eval).
  if [[ "${INPUT}" =~ --preset[[:space:]]+([a-zA-Z0-9_-]+) ]]; then
    PRESET_NAME="${BASH_REMATCH[1]}"
  else
    echo "parse-override-flags.sh: --preset given but no <name> token followed" >&2
    exit 2
  fi
elif [ -n "${AIF_PIPELINE_PRESET:-}" ]; then
  PRESET_NAME="${AIF_PIPELINE_PRESET}"
fi

if [ -n "$PRESET_NAME" ]; then
  # Collision check: any explicit --mode-* flag alongside --preset = ambiguous.
  for flag in $KNOWN_FLAGS; do
    if [[ "${PADDED}" == *" ${flag} "* ]]; then
      echo "parse-override-flags.sh: multi-source collision: --preset ${PRESET_NAME} and ${flag} — use one or the other" >&2
      exit 2
    fi
  done
  # Delegate to resolver (exits 0/1/2; relay stdout + exit code).
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  exec "${SCRIPT_DIR}/resolve-preset.sh" "$PRESET_NAME"
fi

found_count=0
found_flag=""

for flag in $KNOWN_FLAGS; do
  if [[ "${PADDED}" == *" ${flag} "* ]]; then
    found_count=$(( found_count + 1 ))
    found_flag="${flag}"
  fi
done

# --- Exit 1: no flag found ---------------------------------------------------
if [ "${found_count}" -eq 0 ]; then
  exit 1
fi

# --- Exit 2: multi-flag collision --------------------------------------------
if [ "${found_count}" -gt 1 ]; then
  # Collect all matched flags for the error message.
  collision_list=""
  for flag in $KNOWN_FLAGS; do
    if [[ "${PADDED}" == *" ${flag} "* ]]; then
      collision_list="${collision_list} ${flag}"
    fi
  done
  echo "parse-override-flags.sh: multi-flag collision:${collision_list}" >&2
  exit 2
fi

# --- Map flag to ALIAS (verbatim from SKILL.md §2.5 Step 6 lines 215-221) ----
case "${found_flag}" in
  --mode-direct)    ALIAS="DIRECT"    ;;
  --mode-solo)      ALIAS="SOLO"      ;;
  --mode-bundle)    ALIAS="BUNDLE"    ;;
  --mode-pair)      ALIAS="PAIR"      ;;
  --mode-decompose) ALIAS="DECOMPOSE" ;;
  --mode-research)  ALIAS="RESEARCH"  ;;
  *)
    echo "parse-override-flags.sh: internal error: unmapped flag '${found_flag}'" >&2
    exit 2
    ;;
esac

# --- Extract --reason=<value> from the input string --------------------------
# Supports three forms:
#   --reason="quoted phrase with spaces"
#   --reason='single quoted phrase'
#   --reason=single-token
# Order matters: try quoted forms first (greedy), then unquoted token.
REASON=""

# Form 1: --reason="double quoted"
if [[ "${INPUT}" =~ --reason=\"([^\"]+)\" ]]; then
  REASON="${BASH_REMATCH[1]}"
# Form 2: --reason='single quoted'
elif [[ "${INPUT}" =~ --reason=\'([^\']+)\' ]]; then
  REASON="${BASH_REMATCH[1]}"
# Form 3: --reason=unquoted-token (stops at first whitespace)
elif [[ "${INPUT}" =~ --reason=([^[:space:]\"\']+) ]]; then
  REASON="${BASH_REMATCH[1]}"
fi

# --- Validate reason length --------------------------------------------------
reason_len="${#REASON}"
if [ "${reason_len}" -lt "${REASON_MIN}" ]; then
  echo "parse-override-flags.sh: --reason required (≥${REASON_MIN} chars); got: '${REASON}'" >&2
  exit 2
fi

# --- Emit output (exit 0) ----------------------------------------------------
printf 'OVERRIDE_MODE=%s\n' "${ALIAS}"
printf 'OVERRIDE_REASON=%s\n' "${REASON}"
exit 0
