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

# _companion_plugin_entry <plugin id> — «version<TAB>id<TAB>enabled» of the installed plugin from
# `claude plugin list --json`: the exact id first, else the same plugin name from another marketplace
# (P6 cold run F6: superpowers@superpowers-dev read «not read» against superpowers@claude-plugins-official).
# Empty when the claude CLI is absent, the list fails, or no entry matches.
_companion_plugin_entry() {
  local id="$1" out
  command -v claude >/dev/null 2>&1 || return 0
  out=$(claude plugin list --json 2>/dev/null) || return 0
  if command -v jq >/dev/null 2>&1; then
    # shellcheck disable=SC2016  # jq program, not shell expansions
    jq -r --arg id "$id" --arg n "${id%%@*}" '
      ([.[]? | select(.id == $id)] + [.[]? | select((.id // "" | split("@")[0]) == $n)])[0]
      | select(. != null) | "\(.version // "")\t\(.id)\t\(if .enabled == null then "unknown" else (.enabled | tostring) end)"' <<<"$out" 2>/dev/null || true
  elif command -v node >/dev/null 2>&1; then
    # shellcheck disable=SC2016  # JavaScript, not shell expansions
    GETFF_ID="$id" node -e '
      let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
        try {
          const l = JSON.parse(s), id = process.env.GETFF_ID, n = id.split("@")[0];
          const p = l.find((x) => x && x.id === id) || l.find((x) => x && String(x.id || "").split("@")[0] === n);
          if (p) console.log([p.version || "", p.id, p.enabled === undefined ? "unknown" : p.enabled].join("\t"));
        } catch (_) {}
      });' <<<"$out" 2>/dev/null || true
  fi
  return 0
}

# companion_version <install_cmd> <kind> [detect_cmd] — «<version><TAB><read-from>» on stdout; the
# version is «not read: <reason>» when it cannot be read, never a guess. cc-plugin: `claude plugin
# list --json`; cli: `npm ls -g <pkg>`, else `<bin> --version` when detect is `command -v <bin>` (F6:
# a Homebrew ast-grep is invisible to npm). Other kinds print nothing (MCP servers: companion_record_mcp_versions).
companion_version() {
  local cmd="$1" kind="$2" detect="${3:-}" id pkg out bin v e from
  case "$kind" in
    cc-plugin)
      case "$cmd" in *"plugin install "*) ;; *) return 0 ;; esac
      id=${cmd##*plugin install }; id=${id%% *}
      if ! command -v claude >/dev/null 2>&1; then printf 'not read: the claude CLI is not on PATH\tclaude plugin list --json\n'; return 0; fi
      e=$(_companion_plugin_entry "$id")
      v=$(cut -f1 <<<"$e"); from="claude plugin list --json"
      [ -n "$e" ] && [ "$(cut -f2 <<<"$e")" != "$id" ] && from="$from ($(cut -f2 <<<"$e"))"
      printf '%s\t%s\n' "${v:-not read: $id is not in claude plugin list --json}" "$from"
      ;;
    cli)
      case "$cmd" in "npm install -g "*)  # ci-tool-pin: allow a case pattern that reads a manifest command, not an install
        pkg=${cmd#npm install -g }; pkg=${pkg%% *}  # ci-tool-pin: allow parameter expansion over a manifest command, not an install
        if command -v npm >/dev/null 2>&1; then
          out=$(npm ls -g --depth=0 "$pkg" 2>/dev/null || true)
          v=$(awk -v p="$pkg@" '{ i = index($0, p); if (i) { v = substr($0, i + length(p)); sub(/[ ].*/, "", v); print v; exit } }' <<<"$out")
          [ -n "$v" ] && { printf '%s\tnpm ls -g\n' "$v"; return 0; }
        fi ;;
      esac
      case "$detect" in "command -v "*) bin=${detect#command -v }; bin=${bin%% *} ;; *) bin="" ;; esac
      if [ -n "$bin" ] && command -v "$bin" >/dev/null 2>&1; then
        v=$("$bin" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?([-+][0-9A-Za-z.]+)?' | head -1 || true)
        [ -n "$v" ] && { printf '%s\t%s --version\n' "$v" "$bin"; return 0; }
        printf 'not read: %s --version printed no version\t%s --version\n' "$bin" "$bin"; return 0
      fi
      [ -n "${pkg:-}" ] && printf 'not read: %s is not in npm ls -g\tnpm ls -g\n' "$pkg"
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

# companion_note_version <name> <install_cmd> <kind> [detect_cmd] — read + record, for the kinds with a version.
companion_note_version() {
  local r
  case "$3" in cc-plugin|cli) ;; *) return 0 ;; esac
  r=$(companion_version "$2" "$3" "${4:-}")
  [ -n "$r" ] || return 0
  companion_record_version "$1" "$3" "$(cut -f1 <<<"$r")" "$(cut -f2 <<<"$r")"
}

# ── MCP servers getff writes: the version the remote reports ───────────────────────────────────
# context7 and deepwiki are http remotes (lib.sh add_getff_mcp_servers, the deepwiki manifest row):
# nothing local has a version, but the server names its own in the MCP initialize answer
# (serverInfo.version — measured 2026-09-30: Context7 4.1.1, DeepWiki 2.14.3). The same URLs as
# lib.sh GETFF_MCP_*_URL (engine.test.sh holds them equal).
COMPANION_MCP_CONTEXT7_URL="https://mcp.context7.com/mcp"
COMPANION_MCP_DEEPWIKI_URL="https://mcp.deepwiki.com/mcp"

# _companion_mcp_version <url> — the remote's serverInfo.version, or «not read: <reason>».
_companion_mcp_version() {
  local url="$1" out v=""
  command -v curl >/dev/null 2>&1 || { echo "not read: curl is not on PATH"; return 0; }
  out=$(curl -sS -m 10 -X POST -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"getff-install","version":"0"}}}' \
    "$url" 2>/dev/null) || out=""
  [ -n "$out" ] || { echo "not read: $url did not answer the MCP initialize request"; return 0; }
  # A streamable-HTTP answer is SSE («data: {…}») or plain JSON; take the JSON either way.
  out=$(sed -n 's/^data: //p' <<<"$out" | head -1 | grep . || printf '%s' "$out")
  if command -v jq >/dev/null 2>&1; then
    v=$(jq -r '.result.serverInfo.version // empty' <<<"$out" 2>/dev/null || true)
  elif command -v node >/dev/null 2>&1; then
    v=$(node -e 'let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => { try { const v = JSON.parse(s).result.serverInfo.version; if (v) console.log(v); } catch (_) {} });' <<<"$out" 2>/dev/null || true)
  fi
  echo "${v:-not read: $url answered without serverInfo.version}"
}

# _companion_mcp_is_getffs <root> <name> <url> — rc 0 when getff's http entry for <name> is in
# ROOT/.mcp.json, or `claude mcp get <name>` names that URL (the deepwiki row at user scope). The
# project's own entry is not getff's: it is kept and reported by add_getff_mcp_servers.
_companion_mcp_is_getffs() {
  local f="$1/.mcp.json" name="$2" url="$3"
  if [ -f "$f" ]; then
    if command -v jq >/dev/null 2>&1; then
      # shellcheck disable=SC2016  # jq program, not shell expansions
      jq -e --arg k "$name" --arg u "$url" '(.mcpServers // {})[$k] == {type: "http", url: $u}' "$f" >/dev/null 2>&1 && return 0
    elif command -v node >/dev/null 2>&1; then
      # shellcheck disable=SC2016  # JavaScript, not shell expansions
      GETFF_F="$f" GETFF_K="$name" GETFF_U="$url" node -e '
        const e = ((JSON.parse(require("fs").readFileSync(process.env.GETFF_F, "utf8")) || {}).mcpServers || {})[process.env.GETFF_K];
        process.exit(e && JSON.stringify(e) === JSON.stringify({ type: "http", url: process.env.GETFF_U }) ? 0 : 1);' 2>/dev/null && return 0
    fi
  fi
  command -v claude >/dev/null 2>&1 && grep -qF "URL: $url" <<<"$(claude mcp get "$name" 2>/dev/null)" && return 0
  return 1
}

# companion_record_mcp_versions — one versions row per getff MCP server that is in place. Called by
# ./setup after the companions, when .ai-factory/tool-decisions.md exists (install.sh seeds it in
# 30-templates, after 05-mcp wrote the servers).
companion_record_mcp_versions() {
  local root="${PROJECT_ROOT:-$PWD}" name url
  for name in context7 deepwiki; do
    case "$name" in context7) url="$COMPANION_MCP_CONTEXT7_URL" ;; *) url="$COMPANION_MCP_DEEPWIKI_URL" ;; esac
    _companion_mcp_is_getffs "$root" "$name" "$url" || continue
    companion_record_version "$name" mcp "$(_companion_mcp_version "$url")" "MCP initialize ($url)"
  done
  return 0
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
    companion_not_wired "$name — not added: the claude CLI is not on PATH, and an MCP server is added through it"
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
    # A plugin installed but turned off is not «present» (P6 F6): a gap with its reason. getff does
    # not turn it back on — someone turned it off, and the project's own setup wins (fork 1 = A).
    local _pid _pen
    if [ "$kind" = "cc-plugin" ]; then
      case "$install_cmd" in *"plugin install "*) _pid=${install_cmd##*plugin install }; _pid=${_pid%% *} ;; *) _pid="" ;; esac
      _pen=$([ -n "$_pid" ] && _companion_plugin_entry "$_pid" | cut -f3)
      if [ "$_pen" = "false" ]; then
        printf '  ⊝ %s is installed but disabled in Claude Code — left as it is\n' "$name"
        [ "$mode" = "dry-run" ] && return 0
        companion_not_wired "$name — installed but disabled in Claude Code; getff does not turn on a plugin that was turned off"
        companion_note_version "$name" "$install_cmd" "$kind" "$detect_cmd"
        return 0
      fi
    fi
    printf '  ⊝ %s already present — skipping\n' "$name"
    [ "$mode" = "dry-run" ] || companion_note_version "$name" "$install_cmd" "$kind" "$detect_cmd"
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
      companion_note_version "$name" "$install_cmd" "$kind" "$detect_cmd"
    else
      printf '  ⚠ %s install failed — %s exited non-zero (its output is above)\n' "$name" "$install_cmd"
      companion_not_wired "$name — not installed: $install_cmd failed (its output is above)"
      if [ "$kind" = "mcp" ]; then printf '  [mcp:%s] install: failed\n' "$name"; fi
    fi
  else
    printf '  ⊝ %s skipped\n' "$name"
    companion_not_wired "$name — not installed: declined by the person"
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
