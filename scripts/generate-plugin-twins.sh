#!/usr/bin/env bash
# Generate plugin/ twins from their in-repo sources. Two populations, two contracts:
#
#   (1) plugin/hooks/<name>   ← .claude/hooks/<name>.sh   — copy + AUTO-GENERATED header
#   (2) plugin/agents/<name>.md ← agents/<name>.md        — byte-identical copy, no header
#
# Per-source marker `# @plugin-transform: <mode>` (placed near the top of the source),
# population (1) only:
#   - absent  → byte-identical copy (modulo AUTO-GENERATED header on the twin).
#   - sed <expr> → copy source, apply `sed "<expr>"`, prepend AUTO-GENERATED header.
#   - manual → skip; twin stays hand-maintained.
#
# Population (2) deliberately supports NO marker, and that is a consequence rather than an
# omission: principle 24(d) (packages/core/principles/24-plugin-manifest-integrity.test.ts)
# requires EVERY plugin/agents/*.md to be byte-identical to its agents/ source, so `sed` and
# `manual` modes are unreachable by construction — a marker would be dead code whose only
# effect is a red gate. The header is likewise omitted: these are markdown files whose YAML
# frontmatter must open on line 1, so injecting a comment line would corrupt them (and break
# byte-identity anyway). Widening the agents contract means editing principle 24(d) first.
#
# Both populations skip sources with no existing twin — that absence is the deliberate
# "not twinned" signal, so the generator never invents a twin (16 of 19 agents, by design).
#
# Idempotent. Zero deps beyond bash + sed. Spec: .ai-factory/plans/zcode-parity-s6-twin-generator.md.
set -euo pipefail

LOG_LEVEL="${LOG_LEVEL:-INFO}"
log_info() { printf '[INFO] generate-plugin-twins: %s\n' "$*" >&2; }
log_debug() { [ "$LOG_LEVEL" = "DEBUG" ] && printf '[DEBUG] generate-plugin-twins: %s\n' "$*" >&2 || true; }

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
SRC_DIR="$REPO_ROOT/.claude/hooks"
TWIN_DIR="$REPO_ROOT/plugin/hooks"
AGENT_SRC_DIR="$REPO_ROOT/agents"
AGENT_TWIN_DIR="$REPO_ROOT/plugin/agents"

[ -d "$SRC_DIR" ] || { log_info "source dir missing: $SRC_DIR"; exit 1; }
[ -d "$TWIN_DIR" ] || mkdir -p "$TWIN_DIR"

log_info "generating plugin twins from .claude/hooks/*.sh"

# Prepend the AUTO-GENERATED header AFTER the shebang line (so kernel exec still works).
# Input: $1=source file path, $2=output twin path. The first line (shebang) is preserved
# as line 1; the header is inserted as line 2; the rest of the source follows.
write_twin() {
  local src="$1" twin="$2"
  local shebang rest
  shebang=$(head -1 "$src")
  rest=$(tail -n +2 "$src")
  {
    printf '%s\n' "$shebang"
    printf '# AUTO-GENERATED from .claude/hooks/%s.sh — do not edit (header injected by scripts/generate-plugin-twins.sh)\n' "$name"
    printf '%s\n' "$rest"
  } > "$twin"
}

identical=0; sed_transformed=0; manual=0

for src in "$SRC_DIR"/*.sh; do
  [ -f "$src" ] || continue
  name=$(basename "$src" .sh)
  twin="$TWIN_DIR/$name"

  # Skip sources with no existing twin — those are intentionally not twinned
  # (internal-only, or have other delivery arrangements).
  if [ ! -f "$twin" ]; then
    log_debug "skip (no twin): $name"
    continue
  fi

  marker=$(grep -E '^# @plugin-transform:' "$src" | head -1 | sed 's/^# @plugin-transform: //' || true)

  case "$marker" in
    manual*)
      log_info "twin: $name mode: manual (declared, hand-maintained)"
      manual=$((manual+1))
      ;;
    sed\ *)
      sed_expr=${marker#sed }
      # Apply sed to a temp then write_twin so the shebang stays line 1.
      tmp_transformed=$(mktemp)
      sed "$sed_expr" "$src" > "$tmp_transformed"
      shebang=$(head -1 "$tmp_transformed")
      rest=$(tail -n +2 "$tmp_transformed")
      {
        printf '%s\n' "$shebang"
        printf '# AUTO-GENERATED from .claude/hooks/%s.sh — do not edit (header injected by scripts/generate-plugin-twins.sh)\n' "$name"
        printf '%s\n' "$rest"
      } > "$twin"
      rm -f "$tmp_transformed"
      log_info "twin: $name mode: sed"
      log_debug "sed expr: $sed_expr"
      sed_transformed=$((sed_transformed+1))
      ;;
    "")
      write_twin "$src" "$twin"
      log_info "twin: $name mode: identity"
      identical=$((identical+1))
      ;;
    *)
      echo "[ERROR] generate-plugin-twins: $name — unknown marker format: $marker" >&2
      exit 2
      ;;
  esac
done

log_info "generated $((identical + sed_transformed)) twins, skipped $manual manual, $sed_transformed sed-transformed"

# ── Population (2): plugin/agents/*.md ← agents/*.md, byte-identical ──────────
# No header, no marker, no transform — see the header block for why each is absent.
# `cp` (not write_twin) is the whole contract: principle 24(d) compares bytes.
agents_copied=0
if [ -d "$AGENT_SRC_DIR" ] && [ -d "$AGENT_TWIN_DIR" ]; then
  for agent_src in "$AGENT_SRC_DIR"/*.md; do
    [ -f "$agent_src" ] || continue
    agent_name=$(basename "$agent_src")
    agent_twin="$AGENT_TWIN_DIR/$agent_name"

    # No twin → intentionally not twinned; never invent one (mirrors the hooks pass).
    if [ ! -f "$agent_twin" ]; then
      log_debug "skip agent (no twin): $agent_name"
      continue
    fi

    # Skip the write when already identical, so the generator stays a no-op on a clean
    # tree (an unconditional cp would bump mtimes and churn every pre-commit run).
    if cmp -s "$agent_src" "$agent_twin"; then
      log_debug "agent twin: $agent_name already identical"
      continue
    fi

    cp "$agent_src" "$agent_twin"
    log_info "agent twin: $agent_name mode: identity (byte-copy)"
    agents_copied=$((agents_copied+1))
  done
  log_info "agent twins: $agents_copied re-synced"
else
  log_debug "agent twin pass skipped: $AGENT_SRC_DIR or $AGENT_TWIN_DIR missing"
fi
