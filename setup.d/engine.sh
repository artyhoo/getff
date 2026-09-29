#!/usr/bin/env bash
# Companion manifest engine. Sourceable in lib-only mode (ENGINE_LIB_ONLY=1).
# companion_step <name> <detect_cmd> <install_cmd> <kind> <mode>
#   mode: interactive | yes | dry-run
#   env:  GETFF_GLOBAL=1 allows machine-global installs under mode=yes (./setup --global / --all)
# Principle: detect-first; install only via the companion's own official command; no version pin.
#
# kind values:
#   cc-plugin        — Claude Code plugin (claude plugin install …); post-install wrapper loop
#   external-service — handed off to runtime-bridge guided-detect; install_cmd ignored
#   mcp              — Claude MCP server (claude mcp add …); detect-first; consumed by the
#                      05-mcp layer INSIDE install.sh (before 70-deps), NOT the post-install
#                      wrapper loop (D5/I1 ordering — setup wrapper MUST skip kind=mcp rows).

# companion_is_machine_global <install_cmd> — rc 0 when the install reaches beyond this project:
# a user-scope Claude plugin / MCP server, a plugin marketplace, or a global npm package.
companion_is_machine_global() {
  case "$1" in
    *"--scope user"*|*"marketplace add"*|*"npm install -g "*|*"npm i -g "*|*"npm install --global"*) return 0 ;;  # ci-tool-pin: allow case patterns that classify manifest commands, not an install
  esac
  return 1
}

# companion_not_wired <line> — record a companion that is not wired, with its reason (Q4.7: a gap,
# never a step). Inside install.sh (05-mcp sources this file) lib.sh's note_not_wired puts it in the
# install's own summary. ./setup runs install.sh as its own process — that run has printed its
# summary and exited — and then sources only this file, so here the gap is kept and printed by
# companion_not_wired_summary after the companions.
COMPANION_NOT_WIRED=()
companion_not_wired() {
  if command -v note_not_wired >/dev/null 2>&1; then
    note_not_wired "$1"
  else
    COMPANION_NOT_WIRED+=( "$1" )
  fi
}
companion_not_wired_summary() {
  [ "${#COMPANION_NOT_WIRED[@]}" -gt 0 ] || return 0
  echo ""
  echo "⚠  ${#COMPANION_NOT_WIRED[@]} companion(s) NOT wired — each line says why:"
  printf '      - %s\n' "${COMPANION_NOT_WIRED[@]}"
}

# ── Installed versions: read after install, recorded, never pinned ─────────────────────────────
# One-button fork on pins = B (operator log entry 28): no install_cmd carries a version; each tool's
# own installer serves its latest. What it served is READ after the install (or on a present
# tool) and recorded in .ai-factory/tool-decisions.md, so a project knows which version it runs.

# companion_version <install_cmd> <kind> — the installed version on stdout, empty when it cannot be
# read. cc-plugin: `claude plugin list --json` (the plugin id is the word after «plugin install»);
# cli from npm: `npm ls -g <pkg>`. Other kinds have no local version to read (http remotes, services).
companion_version() {
  local cmd="$1" kind="$2" id pkg out
  case "$kind" in
    cc-plugin)
      case "$cmd" in *"plugin install "*) ;; *) return 0 ;; esac
      id=${cmd##*plugin install }; id=${id%% *}
      command -v claude >/dev/null 2>&1 || return 0
      out=$(claude plugin list --json 2>/dev/null) || return 0
      if command -v jq >/dev/null 2>&1; then
        # shellcheck disable=SC2016  # jq program, not shell expansions
        jq -r --arg id "$id" '[.[]? | select(.id == $id)][0].version // empty' <<<"$out" 2>/dev/null || true
      elif command -v node >/dev/null 2>&1; then
        GETFF_ID="$id" node -e '
          let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
            try { const p = JSON.parse(s).find((x) => x && x.id === process.env.GETFF_ID); if (p && p.version) console.log(p.version); } catch (_) {}
          });' <<<"$out" 2>/dev/null || true
      fi
      ;;
    cli)
      case "$cmd" in "npm install -g "*) ;; *) return 0 ;; esac  # ci-tool-pin: allow a case pattern that reads a manifest command, not an install
      pkg=${cmd#npm install -g }; pkg=${pkg%% *}  # ci-tool-pin: allow parameter expansion over a manifest command, not an install
      command -v npm >/dev/null 2>&1 || return 0
      out=$(npm ls -g --depth=0 "$pkg" 2>/dev/null || true)
      awk -v p="$pkg@" '{ i = index($0, p); if (i) { v = substr($0, i + length(p)); sub(/[ ].*/, "", v); print v; exit } }' <<<"$out"
      ;;
  esac
  return 0
}

# companion_record_version <name> <kind> <version> <read-from> — one row per tool in the marked
# block of .ai-factory/tool-decisions.md (added at the end when absent; a tool's earlier row is
# replaced, every other line kept). Prints the report line. The file is seeded by install.sh
# (30-templates); when it is absent the version stays in the report only, said so.
GETFF_VERSIONS_BEGIN='<!-- getff:installed-versions:begin -->'
GETFF_VERSIONS_END='<!-- getff:installed-versions:end -->'
companion_record_version() {
  local name="$1" kind="$2" ver="${3:-not read}" from="$4" f row today
  f="${PROJECT_ROOT:-$PWD}/.ai-factory/tool-decisions.md"
  today="${GETFF_TODAY:-$(date +%Y-%m-%d)}"
  row="| $name | $kind | $ver | $today | $from |"
  if [ ! -f "$f" ]; then
    printf '  · %s version %s (not pinned) — not recorded: .ai-factory/tool-decisions.md is not in this project\n' "$name" "$ver"
    return 0
  fi
  if awk -v row="$row" -v key="| $name |" -v b="$GETFF_VERSIONS_BEGIN" -v e="$GETFF_VERSIONS_END" '
      $0 == b { inb = 1; print; next }
      inb && index($0, key) == 1 { next }
      inb && $0 == e { print row; print; inb = 0; done = 1; next }
      { print }
      END { exit done ? 0 : 3 }' "$f" > "$f.tmp" 2>/dev/null; then
    mv "$f.tmp" "$f"
  else
    rm -f "$f.tmp" 2>/dev/null
    grep -qF "$GETFF_VERSIONS_BEGIN" "$f" && { printf '  ⚠ %s version %s — not recorded: the installed-versions block in tool-decisions.md has no end line\n' "$name" "$ver"; return 0; }
    {
      printf '\n%s\n\n## Installed versions (the fixed list)\n\n' "$GETFF_VERSIONS_BEGIN"
      printf 'Not pinned: each tool is installed by its own installer, which serves its latest; getff reads\n'
      printf 'what was installed and records it here on every install run.\n\n'
      printf '| Tool | Kind | Version | Read on | Read from |\n| ---- | ---- | ------- | ------- | --------- |\n%s\n%s\n' "$row" "$GETFF_VERSIONS_END"
    } >> "$f" || { printf '  ⚠ %s version %s — not recorded: tool-decisions.md could not be written\n' "$name" "$ver"; return 0; }
  fi
  printf '  ✓ %s version %s recorded in .ai-factory/tool-decisions.md (not pinned)\n' "$name" "$ver"
}

# companion_note_version <name> <install_cmd> <kind> — read + record, for the kinds with a version.
companion_note_version() {
  local ver from
  case "$3" in
    cc-plugin) case "$2" in *"plugin install "*) from="claude plugin list --json" ;; *) return 0 ;; esac ;;
    cli) case "$2" in "npm install -g "*) from="npm ls -g" ;; *) return 0 ;; esac ;;  # ci-tool-pin: allow a case pattern that reads a manifest command, not an install
    *) return 0 ;;
  esac
  ver=$(companion_version "$2" "$3")
  companion_record_version "$1" "$3" "${ver:-not read}" "$from"
}

companion_step() {
  local name="$1" detect_cmd="$2" install_cmd="$3" kind="$4" mode="$5"

  # External services are not plain installs — the caller (setup) routes them to bridge guided-detect.
  if [ "$kind" = "external-service" ]; then
    printf '[%s] external service — handled by runtime-bridge guided-detect\n' "$name"
    return 0
  fi

  # MCP servers require the claude CLI. Fail-soft (graceful skip) when absent.
  if [ "$kind" = "mcp" ] && ! command -v claude >/dev/null 2>&1; then
    printf '  ⊝ claude CLI absent — skipping MCP %s\n' "$name"
    return 0
  fi

  # Scope label for verbose logging (mcp kind only).
  local _scope_label=""
  if [ "$kind" = "mcp" ]; then
    if grep -q -- '--scope user' <<<"$install_cmd"; then
      _scope_label="user-scope (machine-global)"
    else
      _scope_label="project-scope"
    fi
  fi

  if eval "$detect_cmd" >/dev/null 2>&1; then
    if [ "$kind" = "mcp" ]; then printf '  [mcp:%s] detect: present (%s) — skip\n' "$name" "$_scope_label"; fi
    printf '  ⊝ %s already present — skipping\n' "$name"
    [ "$mode" = "dry-run" ] || companion_note_version "$name" "$install_cmd" "$kind"
    return 0
  fi
  if [ "$kind" = "mcp" ]; then printf '  [mcp:%s] detect: absent (%s)\n' "$name" "$_scope_label"; fi

  if [ "$mode" = "dry-run" ]; then
    printf '  [dry-run] would install %s: %s\n' "$name" "$install_cmd"
    return 0
  fi

  # critical-review S1-4 (operator decision 2026-09-23): -y installs into the PROJECT only. -y was
  # the sole consent for machine-global installs, and INSTALL-FOR-AI.md lets an agent run -y
  # without asking — so user-scope plugins/MCP servers and `npm -g` landed on developer machines
  # with no human yes. Under -y they now need --global (GETFF_GLOBAL=1, set by ./setup --global or
  # --all); the interactive prompt names the machine-global reach instead.
  local _global=""
  if companion_is_machine_global "$install_cmd"; then _global=1; fi
  if [ "$mode" = "yes" ] && [ -n "$_global" ] && [ "${GETFF_GLOBAL:-}" != "1" ]; then
    printf '  ⊝ %s skipped — machine-global install (outside this project): %s\n' "$name" "$install_cmd"
    printf '    without --global, a non-interactive install writes into this project only\n'
    companion_not_wired "$name — not installed: its install is machine-global ($install_cmd), and without --global a non-interactive install writes into this project only"
    return 0
  fi

  local do_it="$mode"
  if [ "$mode" = "interactive" ]; then
    if [ -n "$_global" ]; then
      printf '  Install %s machine-wide (all projects on this machine: %s)? [y/N]: ' "$name" "$install_cmd"
    else
      printf '  Install %s? [y/N]: ' "$name"
    fi
    read -r ans || ans=""
    case "$ans" in [yY]|[yY][eE][sS]) do_it="yes" ;; *) do_it="no" ;; esac
  fi

  if [ "$do_it" = "yes" ]; then
    if [ "$kind" = "mcp" ]; then
      printf '  [mcp:%s] installing (%s): %s\n' "$name" "$_scope_label" "$install_cmd"
      if [ "$_scope_label" = "user-scope (machine-global)" ]; then
        printf '  ⚠ machine-scope (one-time): %s added to user MCP scope — persists across all projects on this machine\n' "$name"
      fi
    fi
    if eval "$install_cmd"; then
      printf '  ✓ %s installed\n' "$name"
      if [ "$kind" = "mcp" ]; then printf '  [mcp:%s] install: success\n' "$name"; fi
      companion_note_version "$name" "$install_cmd" "$kind"
    else
      printf '  ⚠ %s install failed — %s exited non-zero (its output is above)\n' "$name" "$install_cmd"
      companion_not_wired "$name — not installed: $install_cmd failed (its output is above)"
      if [ "$kind" = "mcp" ]; then printf '  [mcp:%s] install: failed\n' "$name"; fi
    fi
  else
    printf '  ⊝ %s skipped\n' "$name"
  fi
  # Always 0: a companion is optional by contract (the ⚠ line and its NOT-wired entry say why).
  # The caller (`setup`, `set -e`) must never die on a companion — before this line the
  # trailing `[ "$kind" = "mcp" ] && printf` made every non-mcp companion return 1 on BOTH
  # branches, so a fresh machine (superpowers absent → install attempted) killed `setup -y`
  # right after «✓ superpowers installed» — or, without the claude CLI, after the ⚠ line
  # (caught by tests/consumer-matrix/getff-dist-cell.sh in CI, PR #1613).
  return 0
}

# Lib-only guard: when sourced for tests, expose the function without parsing the manifest.
if [ "${ENGINE_LIB_ONLY:-}" = "1" ]; then
  return 0 2>/dev/null || true
fi
