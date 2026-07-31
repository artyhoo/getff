#!/usr/bin/env bash
# Measure the LIVE session-start injected set (bytes + estimated tokens) and attribute every
# row to its injecting channel (CC-native loader | claudeMdExcludes-entry | paths:-gate | hook).
#
# Relationship to scripts/measure-always-on.sh:
#   measure-always-on.sh   = DECLARED manifest meter (CLAUDE.md + every .claude/rules/*.md),
#                            the ai-doc-audit budget pole. Not live-set aware.
#   THIS script            = LIVE injected-set meter: parses `paths:` frontmatter + claudeMdExcludes
#                            + user CLAUDE.md + MEMORY.md + every registered hook arm, with token
#                            estimation. The attribution-before-cutting instrument.
#   Different problems (declared vs live) — not parallel evolution.
#
# Token-conversion HEURISTIC (not a tokenizer-truth claim — T-TOK-A):
#   bytes / 4     for ASCII-dominant files (non-ASCII ratio <= 30%)
#   bytes / 2.2   for non-ASCII-heavy files (non-ASCII ratio >  30%)
# The Cyrillic (Russian) bytes-to-tokens cost is roughly 2x the ASCII cost; the 2.2 divisor
# approximates that. State the divisor per row; do not report bytes as tokens.
#
# spec: .ai-factory/plans/feature-session-start-token-audit-c781e8.md Task 1 (S1)
#        (.ai-factory/plans/session-start-token-audit.md is the source kickoff).
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT" || { echo "FATAL: cannot cd $REPO_ROOT" >&2; exit 2; }

SETTINGS="$REPO_ROOT/.claude/settings.json"
RULES_DIR="$REPO_ROOT/.claude/rules"
PROJECT_CLAUDE_MD="$REPO_ROOT/CLAUDE.md"
USER_CLAUDE_MD="${HOME:+$HOME/.claude/CLAUDE.md}"

# ---- token heuristic ---------------------------------------------------------
# Heuristic divisors (see header comment). Non-ASCII ratio measured via tr (portable, deterministic).
ASCII_DIVISOR=4
NONASCII_DIVISOR=2.2
NONASCII_RATIO_THRESHOLD=0.30

emit_heuristic_header() {
  printf '# measure-session-start-tokens.sh — LIVE injected-set attribution\n'
  printf '# repo_root: %s\n' "$REPO_ROOT"
  printf '# run_date_utc: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '# token_heuristic: bytes/%s (ASCII-dominant, non-ASCII ratio <= %s) | bytes/%s (non-ASCII ratio > %s)\n' \
    "$ASCII_DIVISOR" "$NONASCII_RATIO_THRESHOLD" "$NONASCII_DIVISOR" "$NONASCII_RATIO_THRESHOLD"
  printf '# token_heuristic_note: stated heuristic, not a tokenizer-truth claim. Non-ASCII measured via `tr -d "\\000-\\177" | wc -c`.\n'
  printf '# columns: path | env | bytes | nonascii_ratio | tokens_est | injecting_channel\n'
  printf '# env: host-cc = the Claude Code session-start set on this host\n'
  printf -- '----------------------------------------------------------------------------------------------------------\n'
}

# compute_tokens <file> -> prints "bytes nonascii_ratio tokens"
compute_tokens() {
  local f="$1"
  local bytes nonascii ratio tokens
  if [[ ! -f "$f" ]]; then
    printf '0 0 0'
    return
  fi
  bytes=$(wc -c < "$f" | tr -d ' ')
  # Count non-ASCII bytes (>= 0x80) by deleting ASCII bytes and counting the residue.
  nonascii=$(LC_ALL=C tr -d '\000-\177' < "$f" 2>/dev/null | wc -c | tr -d ' ')
  if [[ "$bytes" -gt 0 ]]; then
    ratio=$(awk -v n="$nonascii" -v b="$bytes" 'BEGIN{ printf "%.4f", n/b }')
  else
    ratio="0.0000"
  fi
  # Pick the divisor based on the non-ASCII ratio (heavy Cyrillic → ~2x token cost).
  local divisor
  divisor=$(awk -v r="$ratio" -v t="$NONASCII_RATIO_THRESHOLD" -v ad="$ASCII_DIVISOR" -v nd="$NONASCII_DIVISOR" 'BEGIN{ print (r+0 > t+0) ? nd : ad }')
  tokens=$(awk -v b="$bytes" -v d="$divisor" 'BEGIN{ printf "%d", b/d }')
  printf '%s %s %s' "$bytes" "$ratio" "$tokens"
}

# ---- settings.json parse -----------------------------------------------------
if [[ ! -f "$SETTINGS" ]]; then
  echo "FATAL: $SETTINGS not found — cannot enumerate injected set" >&2
  exit 3
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "FATAL: jq is required to parse $SETTINGS" >&2
  exit 4
fi
if ! jq -e '.claudeMdExcludes' "$SETTINGS" >/dev/null 2>&1; then
  echo "FATAL: $SETTINGS unparseable or missing .claudeMdExcludes (T3 — fail loudly)" >&2
  exit 5
fi

# Read claudeMdExcludes into an associative set.
declare -A EXCLUDES_SET=()
while IFS= read -r line; do
  [[ -n "$line" ]] && EXCLUDES_SET["$line"]=1
done < <(jq -r '.claudeMdExcludes[]? // empty' "$SETTINGS")

# ---- totals ------------------------------------------------------------------
GRAND_BYTES=0
GRAND_TOKENS=0
ROW_COUNT=0

add_total() {
  # add_total <bytes> <tokens>
  GRAND_BYTES=$(( GRAND_BYTES + $1 ))
  GRAND_TOKENS=$(( GRAND_TOKENS + $2 ))
  ROW_COUNT=$(( ROW_COUNT + 1 ))
}

print_row() {
  # print_row <path> <env> <bytes> <ratio> <tokens> <channel>
  printf '%-58s | %-8s | %8s | %s | %7s | %s\n' "$1" "$2" "$3" "$4" "$5" "$6"
}

emit_heuristic_header

# ============================================================================
# SECTION A — Always-on CC-native autoloaded files (the live injected set)
# ============================================================================
printf '\n## Section A — Always-on injected set (CC-native autoload, host-cc)\n'
print_row "path" "env" "bytes" "ratio" "tokens" "injecting_channel"

# A.1 Project CLAUDE.md — always loaded by CC-native loader.
if [[ -f "$PROJECT_CLAUDE_MD" ]]; then
  read -r b r t < <(compute_tokens "$PROJECT_CLAUDE_MD")
  print_row "CLAUDE.md" "host-cc" "$b" "$r" "$t" "CC-native loader (project CLAUDE.md autoload)"
  add_total "$b" "$t"
else
  printf '# SKIP: project CLAUDE.md not found at %s\n' "$PROJECT_CLAUDE_MD"
fi

# A.2 User ~/.claude/CLAUDE.md — always loaded if readable; else skip with a printed note.
if [[ -n "${USER_CLAUDE_MD:-}" && -r "$USER_CLAUDE_MD" ]]; then
  read -r b r t < <(compute_tokens "$USER_CLAUDE_MD")
  print_row "~/.claude/CLAUDE.md" "host-cc" "$b" "$r" "$t" "CC-native loader (user CLAUDE.md autoload)"
  add_total "$b" "$t"
else
  printf '# SKIP: user ~/.claude/CLAUDE.md not readable in this env (host-cc-only file; container has none)\n'
fi

# A.3 .claude/rules/*.md whose frontmatter LACKS the `paths:` key, MINUS claudeMdExcludes.
#      Discriminator is the `paths:` KEY (not the presence of `---`): a frontmatter block with
#      only `description:` (no `paths:`) is still always-on (autonomous-loop-continuity.md:1-3).
rule_has_paths_key() {
  # rule_has_paths_key <file> -> echoes "yes" or "no"
  local f="$1"
  local in_fm=0
  local first=1
  while IFS= read -r ln; do
    if [[ $first -eq 1 ]]; then
      first=0
      # Frontmatter block must start at line 1 with `---`.
      if [[ "$ln" != "---" ]]; then
        echo "no"; return 0
      fi
      in_fm=1
      continue
    fi
    if [[ $in_fm -eq 1 ]]; then
      if [[ "$ln" == "---" ]]; then
        # End of frontmatter; `paths:` would have appeared by now.
        echo "no"; return 0
      fi
      # Match the `paths:` key (YAML). Key followed by `:` — content may be inline or on next line.
      if [[ "$ln" =~ ^[[:space:]]*paths: ]]; then
        echo "yes"; return 0
      fi
    fi
  done < "$f"
  echo "no"
}

printf '\n# Rule autoload enumeration decisions (verbose — T7/T10: enumerate from mechanism, not seed list):\n'
ALWAYSON_RULES=()
CONDITIONAL_RULES=()
while IFS= read -r rf; do
  [[ -n "$rf" ]] || continue
  rel=".claude/rules/$(basename "$rf")"
  has_paths=$(rule_has_paths_key "$rf")
  if [[ "$has_paths" == "yes" ]]; then
    printf '#   conditional (paths: gate): %s\n' "$rel"
    CONDITIONAL_RULES+=( "$rf" )
    continue
  fi
  if [[ -n "${EXCLUDES_SET[$rel]+_}" ]]; then
    printf '#   excluded (claudeMdExcludes): %s\n' "$rel"
    continue
  fi
  printf '#   always-on (no paths: key, not excluded): %s\n' "$rel"
  ALWAYSON_RULES+=( "$rf" )
done < <(find "$RULES_DIR" -maxdepth 1 -name '*.md' 2>/dev/null | sort)

for rf in "${ALWAYSON_RULES[@]:-}"; do
  [[ -n "$rf" ]] || continue
  rel=".claude/rules/$(basename "$rf")"
  read -r b r t < <(compute_tokens "$rf")
  print_row "$rel" "host-cc" "$b" "$r" "$t" "CC-native loader (.claude/rules/*.md autoload, no paths: key)"
  add_total "$b" "$t"
done

# A.4 MEMORY.md — CC-native memory autoload. Resolve via $HOME/.claude/projects/<slug>/memory/MEMORY.md.
#     CC's slug = repo path with `/` -> `-` (leading `/` becomes leading `-`). Allow env override.
MEMORY_PATH="${MEASURE_MEMORY_PATH:-}"
if [[ -z "$MEMORY_PATH" ]]; then
  slug="${REPO_ROOT//\//-}"
  candidate="$HOME/.claude/projects/$slug/memory/MEMORY.md"
  if [[ -f "$candidate" ]]; then
    MEMORY_PATH="$candidate"
  else
    # Worktree-aware fallback: pick the MEMORY.md whose project slug is the longest prefix of this
    # repo's slug (a worktree session may share the main repo's memory store).
    best=""
    while IFS= read -r m; do
      mslug=$(basename "$(dirname "$(dirname "$m")")")
      if [[ "$slug" == "$mslug"* && ${#mslug} -gt ${#best} ]]; then
        best="$mslug"; MEMORY_PATH="$m"
      fi
    done < <(find "$HOME/.claude/projects" -path '*/memory/MEMORY.md' 2>/dev/null)
    if [[ -z "$best" ]]; then
      MEMORY_PATH=""
    fi
  fi
fi
if [[ -n "$MEMORY_PATH" && -r "$MEMORY_PATH" ]]; then
  printf '#   memory autoload resolved: %s\n' "$MEMORY_PATH"
  read -r b r t < <(compute_tokens "$MEMORY_PATH")
  print_row "MEMORY.md" "host-cc" "$b" "$r" "$t" "CC-native memory autoload ($MEMORY_PATH)"
  add_total "$b" "$t"
else
  printf '# SKIP: MEMORY.md not found under $HOME/.claude/projects/*/memory/ (set MEASURE_MEMORY_PATH to override)\n'
fi

# ============================================================================
# SECTION B — Excluded from always-on (claudeMdExcludes) — recorded, NOT injected
# ============================================================================
printf '\n## Section B — Excluded by claudeMdExcludes (NOT injected at session start; recorded for attribution)\n'
excludes_line=$(grep -n '"claudeMdExcludes"' "$SETTINGS" | head -1 | cut -d: -f1)
if [[ -z "$excludes_line" ]]; then excludes_line="?"; fi
for rel in "${!EXCLUDES_SET[@]}"; do
  if [[ -f "$REPO_ROOT/$rel" ]]; then
    read -r b r t < <(compute_tokens "$REPO_ROOT/$rel")
    printf '%-58s | %-8s | %8s | %s | %7s | claudeMdExcludes-entry (%s:%s)\n' \
      "$rel" "host-cc" "$b" "$r" "$t" "$SETTINGS" "$excludes_line"
  else
    printf '#   WARNING: excludes entry %s listed but file absent\n' "$rel"
  fi
done

# ============================================================================
# SECTION C — Conditional load (paths: frontmatter) — edit-time-scoped, not always-on
# ============================================================================
printf '\n## Section C — Conditional load via paths: frontmatter (edit-time-scoped; not always-on)\n'
for rf in "${CONDITIONAL_RULES[@]:-}"; do
  [[ -n "$rf" ]] || continue
  rel=".claude/rules/$(basename "$rf")"
  read -r b r t < <(compute_tokens "$rf")
  printf '%-58s | %-8s | %8s | %s | %7s | paths:-gate (frontmatter; loads on matching-path read)\n' \
    "$rel" "host-cc" "$b" "$r" "$t"
done

# ============================================================================
# SECTION D — Hook channel enumeration (every arm in .claude/settings.json)
# ============================================================================
printf '\n## Section D — Hook channel enumeration (registrations in .claude/settings.json:61-213)\n'
printf '# Each row = one registered arm. Payload size = stdout bytes from a STUB invocation (timeout 3s,\n'
printf '# stdin /dev/null). Hooks whose real payload requires a live CC hook-event JSON context or that\n'
printf '# mutate state are marked `unmeasured` rather than probed. This is the only channel through which\n'
printf '# a non-CC-native injection (e.g. SessionStart payload) can be attributed (kickoff §1 (v)).\n'
print_row "hook_event:matcher" "env" "bytes" "ratio" "tokens" "injecting_channel"

# Hooks that are NOT safely invocable side-effect-free (mutate state / dispatch / network-probe).
# These are marked unmeasured regardless of registration.
declare -A UNSAFE_HOOKS=(
  ["runtime-bridge-dispatch.sh"]="dispatches a runtime-bridge task on Write/Edit of kickoff.md"
  ["link-coordination.sh"]="SessionStart linker with filesystem side effects"
  ["end-of-turn-reminder.sh"]="Stop hook; probes GET /tasks and may block under AIF_AUTONOMOUS=1"
  ["inject-subagent-context.sh"]="PreToolUse:Agent|Task; rewrites subagent input — mutates tool call"
  ["inject-subagent-digest.sh"]="SubagentStart; mutates subagent launch payload"
  ["warn-subagent-report.sh"]="SubagentStop; reads transcript, emits report"
)

enumerate_event() {
  # enumerate_event <event_name> [use_matcher(0|1)] -> prints "matcher<TAB>command" per arm
  local event="$1"
  local use_matcher="${2:-0}"
  if [[ "$use_matcher" == "1" ]]; then
    jq -r --arg e "$event" '
      (.hooks[$e] // []) | .[] | (.matcher // "-") + "\t" + (.hooks[]?.command // "-")
    ' "$SETTINGS" 2>/dev/null
  else
    jq -r --arg e "$event" '
      (.hooks[$e] // []) | .[] | "-\t" + (.hooks[]?.command // "-")
    ' "$SETTINGS" 2>/dev/null
  fi
}

probe_hook_bytes() {
  # probe_hook_bytes <hook_path> -> prints bytes (stdout) or "UNMEASURED:<reason>"
  local hook_path="$1"
  local base
  base=$(basename "$hook_path")
  if [[ -n "${UNSAFE_HOOKS[$base]+_}" ]]; then
    printf 'UNMEASURED:not-safely-invocable (%s)' "${UNSAFE_HOOKS[$base]}"
    return
  fi
  if [[ ! -f "$hook_path" ]]; then
    printf 'UNMEASURED:hook-file-absent'
    return
  fi
  # Stub invocation: empty stdin, 3s timeout, capture stdout bytes. Set CC env vars to plausible
  # values so the hook does not exit early on missing CLAUDE_PROJECT_DIR.
  local out
  out=$(CLAUDE_PROJECT_DIR="$REPO_ROOT" timeout 3 bash "$hook_path" </dev/null 2>/dev/null || true)
  printf '%s' "$out" | wc -c | tr -d ' '
}

emit_hook_row() {
  # emit_hook_row <event> <matcher> <command> <settings_line>
  local event="$1" matcher="$2" cmd="$3" sline="$4"
  local label="${event}"
  [[ "$matcher" != "-" && -n "$matcher" ]] && label="${event}:${matcher}"
  # Resolve hook path: extract the `.sh` basename, look under .claude/hooks/ then scripts/.
  local base hook_path=""
  base=$(printf '%s' "$cmd" | grep -oE '[^/"]+\.sh' | head -1)
  if [[ -n "$base" ]]; then
    if [[ -f "$REPO_ROOT/.claude/hooks/$base" ]]; then
      hook_path="$REPO_ROOT/.claude/hooks/$base"
    elif [[ -f "$REPO_ROOT/scripts/$base" ]]; then
      hook_path="$REPO_ROOT/scripts/$base"
    fi
  fi
  local probe
  probe=$(probe_hook_bytes "$hook_path")
  if [[ "$probe" == UNMEASURED:* ]]; then
    printf '%-58s | %-8s | %8s | %s | %7s | hook (%s:%s, event=%s) — %s\n' \
      "$label" "host-cc" "—" "—" "—" ".claude/settings.json" "$sline" "$event" "${probe#UNMEASURED:}"
  else
    # ratio/tokens on the stub output (ASCII log line, treat as ASCII-dominant).
    local t
    t=$(awk -v b="$probe" 'BEGIN{ printf "%d", (b+0)/4 }')
    printf '%-58s | %-8s | %8s | %s | %7s | hook (.claude/settings.json:%s, event=%s) — stub-invocation stdout\n' \
      "$label" "host-cc" "$probe" "0.0000" "$t" "$sline" "$event"
  fi
}

# Locate the settings.json line for a command basename (within the hooks "command" registrations,
# NOT the permissions.allow entries that also name the same scripts).
line_for_command() {
  local cmd="$1" base
  base=$(printf '%s' "$cmd" | grep -oE '[^/"]+\.sh' | head -1)
  [[ -z "$base" ]] && { printf '?'; return; }
  grep -n '"command"' "$SETTINGS" | grep "$base" | head -1 | cut -d: -f1
}

# Enumerate every event (matcher-bearing events pass use_matcher=1).
for ev in UserPromptSubmit Stop SubagentStart SubagentStop SessionStart; do
  while IFS=$'\t' read -r matcher cmd; do
    [[ -n "$cmd" ]] || continue
    sline=$(line_for_command "$cmd")
    emit_hook_row "$ev" "-" "$cmd" "$sline"
  done < <(enumerate_event "$ev" 0)
done
for ev in PreToolUse PostToolUse; do
  while IFS=$'\t' read -r matcher cmd; do
    [[ -n "$cmd" ]] || continue
    sline=$(line_for_command "$cmd")
    emit_hook_row "$ev" "$matcher" "$cmd" "$sline"
  done < <(enumerate_event "$ev" 1)
done

# ============================================================================
# SECTION E — Harness remainder (qualitative, falsifier branch — T14)
# ============================================================================
printf '\n## Section E — Harness remainder (qualitative — not directly measurable by this script)\n'
printf '# These are injected by the CC harness / MCP servers / SessionStart payloads, NOT by the\n'
printf '# repo files above. Controllability verdict per category (kickoff §1 (iii) falsifier branch):\n'
printf '#   - tool schemas (CC built-in tools: Bash/Read/Edit/Grep/...):     uncontrollable (harness-fixed)\n'
printf '#   - MCP server instructions (context7/deepwiki/web_reader/...):   settings-recommendation (disable unused MCP servers in ~/.claude.json)\n'
printf '#   - skills/agents listings (skill descriptions in autoload):      ours-to-trim (edit skill descriptions)\n'
printf '#   - SessionStart hook payload (e.g. superpowers full-skill inject): settings-recommendation (audit ~/.claude/settings.json SessionStart arms)\n'
printf '#   - agent team definitions:                                       ours-to-trim (agents/*.md bodies)\n'
printf '# If the Section A live injected set is <40%% of the measured session-start total (~100k tokens),\n'
printf '# the S1 patch MUST say so and S2 scope shifts per kickoff §1 (iii).\n'

# ============================================================================
# TOTALS (Section A only — the always-on live injected set)
# ============================================================================
printf '\n----------------------------------------------------------------------------------------------------------\n'
printf '## TOTAL (Section A — always-on live injected set, host-cc): %s bytes | %s tokens_est | %s rows\n' \
  "$GRAND_BYTES" "$GRAND_TOKENS" "$ROW_COUNT"
printf '# Section B (excluded) and Section C (conditional) are NOT in the total — they are attribution context.\n'
printf '# Section D (hooks) payloads are stub-probed and not added to the byte total (see per-row notes).\n'
printf '# Re-run: bash scripts/measure-session-start-tokens.sh   (S3 re-runs against post-S2 state)\n'
exit 0
