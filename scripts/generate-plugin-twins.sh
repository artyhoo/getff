#!/usr/bin/env bash
# Generate plugin/hooks/<name> twins from .claude/hooks/<name>.sh sources.
#
# Per-source marker `# @plugin-transform: <mode>` (placed near the top of the source):
#   - absent  → byte-identical copy (modulo AUTO-GENERATED header on the twin).
#   - sed <expr> → copy source, apply `sed "<expr>"`, prepend AUTO-GENERATED header.
#   - manual → skip; twin stays hand-maintained.
#
# Idempotent. Zero deps beyond bash + sed. Spec: .ai-factory/plans/zcode-parity-s6-twin-generator.md.
set -euo pipefail

LOG_LEVEL="${LOG_LEVEL:-INFO}"
log_info() { printf '[INFO] generate-plugin-twins: %s\n' "$*" >&2; }
log_debug() { [ "$LOG_LEVEL" = "DEBUG" ] && printf '[DEBUG] generate-plugin-twins: %s\n' "$*" >&2 || true; }

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
SRC_DIR="$REPO_ROOT/.claude/hooks"
TWIN_DIR="$REPO_ROOT/plugin/hooks"

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
