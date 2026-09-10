#!/usr/bin/env bash
# host-verify-aged.sh — consumer-truth-audit V0, aged-stratum host contract.
#
# WHY THIS EXISTS: the V0 census runs in a Linux container where the aged install
# /Users/art/code/timeliner (installed 2026-08-07) does not exist
# (`ls /Users/art/code/timeliner/.claude` → No such file or directory, measured
# 2026-09-08, logs/entry-verification.md §Check 4). The aged stratum (kickoff §3,
# trap T9) is therefore N/A in the container and MUST be measured on the host by
# this script. Never fake the stratum.
#
# WHAT IT DOES: READ-ONLY enumeration of the aged install, per artefact class,
# emitting aged-inventory.json + a delta table against a fresh-install reference.
# It NEVER runs install.sh, NEVER writes inside the aged project.
#
# USAGE (on the host that owns /Users/art/code/timeliner):
#   bash host-verify-aged.sh /Users/art/code/timeliner [fresh-census.json]
#
#   - <aged-root> defaults to /Users/art/code/timeliner
#   - fresh-census.json is this census's census-v0.json (optional; without it the
#     script emits the inventory only, and the delta join is manual)
#
# OUTPUT: aged-inventory.json (at $AGED_OUT, default ${TMPDIR:-/tmp}) + a §3-bucket delta table on
# stdout. Exit 0 = measured; exit 3 = aged root missing (the container situation);
# exit 4 = aged root exists but has no .claude (not an install).

set -euo pipefail

AGED_ROOT="${1:-/Users/art/code/timeliner}"
FRESH_CENSUS="${2:-}"
# Round-2 review M7: this used to write aged-inventory.json NEXT TO THIS SCRIPT — i.e. inside the
# repository, untracked and not gitignored, so running the "read-only contract" dirtied the tree.
# Default is a temp path now; AGED_OUT overrides it for a deliberate capture.
OUT="${AGED_OUT:-${TMPDIR:-/tmp}/aged-inventory.json}"

[ -d "$AGED_ROOT" ] || { echo "AGED-ABSENT: $AGED_ROOT does not exist on this machine (exit 3)"; exit 3; }
[ -d "$AGED_ROOT/.claude" ] || { echo "NOT-AN-INSTALL: $AGED_ROOT/.claude missing (exit 4)"; exit 4; }

# READ-ONLY GUARD: the only write is the JSON output at $OUT (outside the repo by default).
# Everything below is find/ls/jq reads against $AGED_ROOT.

skills=$(find "$AGED_ROOT/.claude/skills" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null | xargs -0 -n1 basename 2>/dev/null | sort || true)
agents=$(find "$AGED_ROOT/.claude/agents" -maxdepth 1 -name '*.md' -print0 2>/dev/null | xargs -0 -n1 basename 2>/dev/null | sort || true)
hooks=$(find "$AGED_ROOT/.claude/hooks" -type f 2>/dev/null | sed "s|$AGED_ROOT/||" | sort || true)
rules_dir="absent"
[ -d "$AGED_ROOT/.claude/rules" ] && rules_dir="present ($(find "$AGED_ROOT/.claude/rules" -name '*.md' | wc -l | tr -d ' ') files)"
workflows=$(find "$AGED_ROOT/.github/workflows" -maxdepth 1 -type f -print0 2>/dev/null | xargs -0 -n1 basename 2>/dev/null | sort || true)
scripts=$(find "$AGED_ROOT/scripts" -maxdepth 1 -type f -print0 2>/dev/null | xargs -0 -n1 basename 2>/dev/null | sort || true)
aifactory=$(find "$AGED_ROOT/.ai-factory" -type f 2>/dev/null | sed "s|$AGED_ROOT/||" | sort || true)
mcp_json="absent"
[ -f "$AGED_ROOT/.mcp.json" ] && mcp_json="present"
settings_regs=$(jq -r '.hooks | keys[]' "$AGED_ROOT/.claude/settings.json" 2>/dev/null | sort | tr '\n' ',' || echo "none")

# json_list STR — one newline-separated entry string (as produced by the find|sort captures
# above) → a JSON array. An EMPTY class must emit [], never [""], so the never-shipped delta
# bucket cannot join against a phantom one-element list named "".
json_list() {
  if [ -z "$1" ]; then printf '[]'; return 0; fi
  printf '%s' "$1" | jq -R . | jq -s .
}

jq -n \
  --arg aged_root "$AGED_ROOT" \
  --arg measured_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg rules_dir "$rules_dir" \
  --arg mcp_json "$mcp_json" \
  --arg settings_regs "$settings_regs" \
  --argjson skills "$(json_list "$skills")" \
  --argjson agents "$(json_list "$agents")" \
  --argjson hooks "$(json_list "$hooks")" \
  --argjson workflows "$(json_list "$workflows")" \
  --argjson scripts "$(json_list "$scripts")" \
  --argjson aifactory "$(json_list "$aifactory")" \
  '{aged_root: $aged_root, measured_at: $measured_at,
    classes: {skills: $skills, agents: $agents, hooks: $hooks,
              rules_dir: $rules_dir, workflows: $workflows,
              scripts: $scripts, ai_factory: $aifactory,
              mcp_json: $mcp_json, settings_registrations: $settings_regs}}' > "$OUT"

echo "aged-inventory.json written: $OUT"
echo "NOTE: read-only measurement — nothing inside $AGED_ROOT was touched."

# ── 3-bucket delta (§3 of the kickoff) — a real join, not a prose reminder ───────
# Round-2 review I5: this block used to accept $FRESH_CENSUS, do NOTHING with it, and print the
# three bucket DEFINITIONS followed by «(Join performed manually or by the triage pass…)» — the
# `#hope-as-gate` shape of .claude/rules/attention-is-not-a-mechanism.md §2. Both sides of the
# join were already in hand, so the join is computed here and printed as rows.
#
# Comparable classes only: skills / agents / hooks — the three the aged inventory enumerates by
# a name that the census artefact key also carries. Classes the aged inventory does not walk
# (principles, discipline-rules, scripts, templates, …) are reported as NOT-COMPARED rather than
# silently dropped, so a reader cannot mistake the covered set for the whole census.
if [ -n "$FRESH_CENSUS" ] && [ -f "$FRESH_CENSUS" ]; then
  echo
  echo "Delta classification (bucket per artefact: shipped-since | never-shipped | consumer-authored):"
  echo "  shipped-since    = absent from aged install, delivered=true in fresh census → the aged install is STALE (pre-dates the artefact)"
  echo "  never-shipped    = absent from aged install AND delivered=false in all fresh profiles → the artefact reaches nobody"
  echo "  consumer-authored= present in aged install, absent from fresh census → theirs, not ours (never delete based on this alone)"
  echo
  jq -r --slurpfile aged "$OUT" '
    ($aged[0].classes) as $a
    | ($a.skills | map("skill\t" + .))                                as $agedSkills
    | ($a.agents | map("agent\t" + .))                                as $agedAgents
    | ($a.hooks  | map("hook\t"  + (. | sub("^\\.claude/hooks/";"")))) as $agedHooks
    | ($agedSkills + $agedAgents + $agedHooks | unique)               as $AGED
    | [ .rows[]
        | select(.class == "skill" or .class == "agent" or .class == "hook")
        | { key: (.class + "\t" + (.artefact
                    | sub("^\\.claude/skills/";"") | sub("^skills/";"")
                    | sub("^\\.claude/agents/";"") | sub("^\\.claude/hooks/";"")
                    | sub("/$";""))),
            artefact: .artefact,
            delivered: (.delivered.core or .delivered.env or .delivered.factory) } ]
      as $FRESH
    | ( [ $FRESH[] | select(.delivered) | select((.key | IN($AGED[])) | not)
          | "shipped-since    \t" + .artefact ] | sort ) as $shipped
    | ( [ $FRESH[] | select(.delivered | not) | select((.key | IN($AGED[])) | not)
          | "never-shipped    \t" + .artefact ] | sort ) as $never
    | ( [ $AGED[] | select((. | IN($FRESH[].key)) | not)
          | "consumer-authored\t" + (. | sub("\t"; " ")) ] | sort ) as $authored
    | ($shipped + $never + $authored)[]
  ' "$FRESH_CENSUS"
  echo
  echo "NOT-COMPARED (the aged inventory does not enumerate these classes; census-only):"
  jq -r '[.rows[] | select(.class != "skill" and .class != "agent" and .class != "hook") | .class]
         | group_by(.) | map("  " + .[0] + " (" + (length|tostring) + " rows)") | .[]' "$FRESH_CENSUS"
fi
