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
# Population (2) consequence — TWIN DEPTH (record it here; nothing else states it): a twin sits
# one directory deeper than its source, so a relative link that resolves from agents/ resolves
# one level short in the twin — `](../.claude/rules/x.md)` means .claude/rules/x.md at the source
# and plugin/.claude/rules/x.md in the twin, which does not exist. Byte-identity forbids rewriting
# the prefix, so no single relative form satisfies both depths and the twin CANNOT carry a fixed
# copy. Since PR #1578 the pre-push lychee arm skips plugin/agents/** (PLUGIN_AGENT_TWIN_PREFIX
# in packages/core/hooks/pre-push.ts), so the twin's dangling copy is no longer gated — the link
# is checked at its agents/ source only. Measured 2026-09-02: agents/compliance-verifier.md
# carries 3 such links, all 3 dangle in plugin/agents/compliance-verifier.md on disk. Note the
# twin population is NOT covered by setup.d/20-agents.sh's transform_internal_refs (that arm
# rewrites agents/ only), so relative links reach plugin consumers verbatim.
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

# Render the identity-mode twin for a source, to stdout. The AUTO-GENERATED header goes AFTER
# the shebang line (so kernel exec still works): shebang stays line 1, header is line 2, the
# rest of the source follows. Single definition on purpose — write_twin and the clobber guard
# below must agree on what a twin looks like, and two copies of this would drift.
render_twin() {
  local src="$1" nm="$2"
  printf '%s\n' "$(head -1 "$src")"
  printf '# AUTO-GENERATED from .claude/hooks/%s.sh — do not edit (header injected by scripts/generate-plugin-twins.sh)\n' "$nm"
  printf '%s\n' "$(tail -n +2 "$src")"
}

# Input: $1=source file path, $2=output twin path.
write_twin() {
  local src="$1" twin="$2"
  render_twin "$src" "$name" > "$twin"
}

# Refuse to overwrite a twin whose content is derivable from NEITHER the working-tree source
# NOR the HEAD source — such a twin carries logic no source can reproduce, so the overwrite is
# a silent deletion, not a regeneration.
#
# This is the failure mode that killed the Stage 9C ZCode rollout arm twice: once when #1044
# wrote the arm into the twin alone (no `manual` marker on the source → identity mode → next
# run erased it, undetected until #1442), and once when a session restored the twin alone and
# the same pre-commit run undid it (e49407d6c0: "restoring plugin/hooks/end-of-turn-reminder
# alone does not stick"). Measured live 2026-08-17: dropping the `manual` marker from
# inject-output-language took its twin 52 → 30 lines with every gate green, because
# twin-generation.test.sh only ever checks byte-identity AFTER the clobber.
#
# Deliberately permissive in two directions, so the guard blocks accidents and not work:
#   - twin already equals the working-tree render → in sync, nothing to lose;
#   - twin equals the HEAD render → the source was edited and the twin is merely stale, which
#     is the normal case this generator exists to fix;
#   - no git, no HEAD, or the source is not in HEAD (brand-new hook) → no baseline to reason
#     from, so allow rather than hard-block a legitimate first commit.
guard_identity_clobber() {
  local src="$1" twin="$2" nm="$3"

  cmp -s <(render_twin "$src" "$nm") "$twin" && return 0

  git -C "$REPO_ROOT" rev-parse --verify -q HEAD >/dev/null 2>&1 || return 0
  local src_rel="${src#"$REPO_ROOT"/}"
  git -C "$REPO_ROOT" cat-file -e "HEAD:$src_rel" 2>/dev/null || return 0

  local head_src rc=0
  head_src=$(mktemp)
  git -C "$REPO_ROOT" show "HEAD:$src_rel" > "$head_src" 2>/dev/null || { rm -f "$head_src"; return 0; }
  cmp -s <(render_twin "$head_src" "$nm") "$twin" || rc=1
  rm -f "$head_src"
  [ "$rc" -eq 0 ] && return 0

  cat >&2 <<EOF
[ERROR] generate-plugin-twins: $nm — refusing to overwrite plugin/hooks/$nm.

  Its current content matches neither the twin rendered from .claude/hooks/$nm.sh nor the one
  rendered from that source at HEAD, so this twin holds logic no source reproduces. Writing it
  now would delete that logic silently — the exact way the Stage 9C ZCode arm was lost twice.

  Pick the branch that matches what you meant:
    (a) The logic belongs in BOTH channels  → move it into .claude/hooks/$nm.sh and re-run.
        This is almost always the right answer; it is what makes the logic regeneration-safe.
    (b) The twin is deliberately hand-maintained → declare it on the SOURCE:
        # @plugin-transform: manual — <≥20-char rationale for the divergence>
    (c) You really do want the twin collapsed onto the source → make the loss explicit and
        reviewable: commit the twin's reduction first, then re-run the generator.
EOF
  return 1
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
      guard_identity_clobber "$src" "$twin" "$name" || exit 3
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

    # Same fail-closed contract as the hooks pass: this `cp` is a silent deletion whenever the
    # twin holds content the source cannot reproduce. Measured 2026-08-17 on
    # plugin/agents/review-sidecar.md — a hand-edit vanished, generator exit 0, principle 24(d)
    # green (it compares bytes only AFTER the copy). Allowed: twin equals the HEAD source (a
    # stale twin, the case this pass exists to fix) or no HEAD baseline exists (new agent).
    if git -C "$REPO_ROOT" rev-parse --verify -q HEAD >/dev/null 2>&1; then
      agent_src_rel="${agent_src#"$REPO_ROOT"/}"
      if git -C "$REPO_ROOT" cat-file -e "HEAD:$agent_src_rel" 2>/dev/null; then
        head_agent=$(mktemp)
        if git -C "$REPO_ROOT" show "HEAD:$agent_src_rel" > "$head_agent" 2>/dev/null \
           && ! cmp -s "$head_agent" "$agent_twin"; then
          rm -f "$head_agent"
          echo "[ERROR] generate-plugin-twins: $agent_name — refusing to overwrite plugin/agents/$agent_name." >&2
          echo "  It matches neither agents/$agent_name nor that file at HEAD, so it holds content no" >&2
          echo "  source reproduces; copying over it would delete that content silently. Move the change" >&2
          echo "  into agents/$agent_name (principle 24(d) requires the two to be byte-identical), or" >&2
          echo "  commit the twin's reduction first so the loss is explicit and reviewable." >&2
          exit 3
        fi
        rm -f "$head_agent"
      fi
    fi

    cp "$agent_src" "$agent_twin"
    log_info "agent twin: $agent_name mode: identity (byte-copy)"
    agents_copied=$((agents_copied+1))
  done
  log_info "agent twins: $agents_copied re-synced"
else
  log_debug "agent twin pass skipped: $AGENT_SRC_DIR or $AGENT_TWIN_DIR missing"
fi
