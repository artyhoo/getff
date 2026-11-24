#!/usr/bin/env bash
# Runtime-bridge guided-detect. Sourceable in lib-only mode (BRIDGE_LIB_ONLY=1).
# Detection keys on /health (works for docker OR native aif-handoff) — never assumes docker.

bridge_health_ok() {
  local url="$1"
  curl -sf -m 3 "${url}/health" >/dev/null 2>&1
}

# Returns: up | docker | docker-down | native | absent
#
# `docker-down` (binary installed, daemon not answering) is its own state, not a flavour of
# `absent`: the two have opposite reasons (a stopped daemon vs no docker at all), and a caller
# cannot recover the difference afterwards — re-running `command -v docker && docker info` is
# exactly the test that already failed to produce `docker` (ledger A1-7, PR #1597).
# Ordering note: `native` still wins over `docker-down`, so a machine with the aif-handoff CLI
# and a stopped docker daemon keeps the pre-existing `native` report.
bridge_diagnose() {
  local url="$1"
  if bridge_health_ok "$url"; then echo "up"; return 0; fi
  local has_docker=""
  command -v docker >/dev/null 2>&1 && has_docker=1
  if [ -n "$has_docker" ] && docker info >/dev/null 2>&1; then echo "docker"; return 0; fi
  if command -v aif-handoff >/dev/null 2>&1; then echo "native"; return 0; fi
  if [ -n "$has_docker" ]; then echo "docker-down"; return 0; fi
  echo "absent"
}

# _bridge_not_wired <line> — a runtime-bridge gap with its reason (Q4.7: a gap, never a step).
# Sourced from ./setup, the engine's companion_not_wired is in scope and the line joins ./setup's
# companion summary; sourced alone (a test, a direct call), the fact is printed in place.
_bridge_not_wired() {
  if command -v companion_not_wired >/dev/null 2>&1; then
    companion_not_wired "runtime-bridge — $1"
  elif command -v note_not_wired >/dev/null 2>&1; then
    # Sourced from install.sh (layer 55, the vendor refresh arm): lib.sh's summary list.
    note_not_wired "runtime-bridge — $1"
  else
    printf '  ⚠ NOT wired: runtime-bridge — %s\n' "$1"
  fi
}

# _bridge_match <json> <dir> [<alt>] — print the number of projects in aif-handoff's GET /projects
# answer, then the id of each project whose rootPath is <dir> or <alt> (one per line; <alt> is the
# logical spelling of a symlinked path, since aif-handoff stores rootPath as it was typed). rc 2 = neither jq nor node,
# rc 1 = the answer is not a JSON array.
_bridge_match() {
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$1" | jq -er --arg p "$2" --arg q "${3:-$2}" \
      'if type == "array" then (length | tostring), (.[] | select(((.rootPath // "") | sub("/+$"; "")) as $r | $r == $p or $r == $q) | .id | select(type == "string" and . != "")) else error("not an array") end' 2>/dev/null || return 1
  elif command -v node >/dev/null 2>&1; then
    # shellcheck disable=SC2016  # JavaScript, not shell expansions
    printf '%s' "$1" | node -e '
      let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
        let a; try { a = JSON.parse(s); } catch { process.exit(1); }
        if (!Array.isArray(a)) process.exit(1);
        console.log(a.length);
        const want = process.argv.slice(1);
        for (const p of a) if (p && typeof p.id === "string" && p.id && want.includes(String(p.rootPath || "").replace(/\/+$/, ""))) console.log(p.id);
      });' "$2" "${3:-$2}" 2>/dev/null || return 1
  else
    return 2
  fi
}

# _bridge_settings_env <settings> <key> — the value of env.<key> in <settings>, empty when unset.
_bridge_settings_env() {
  [ -f "$1" ] || return 0
  if command -v jq >/dev/null 2>&1; then
    jq -r --arg k "$2" '.env[$k] // empty' "$1" 2>/dev/null
  else
    # shellcheck disable=SC2016  # JavaScript, not shell expansions
    node -e 'try { const o = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); const v = (o.env || {})[process.argv[2]]; if (v) console.log(v); } catch {}' "$1" "$2" 2>/dev/null
  fi
}

# _bridge_write_env <settings> <url> <id> — merge RUNTIME_BRIDGE_AIF_URL + _PROJECT_ID into the
# `env` block of <settings> (created as {} when absent). Temp file next to the target, validated
# before the rename, so a failed write never leaves a half-written settings.json.
_bridge_write_env() {
  local settings="$1" url="$2" id="$3" tmp="$1.bridge.tmp"
  mkdir -p "$(dirname "$settings")" 2>/dev/null || return 1
  if command -v jq >/dev/null 2>&1; then
    { if [ -f "$settings" ]; then cat "$settings"; else printf '{}'; fi; } \
      | jq --arg u "$url" --arg i "$id" '.env = ((.env // {}) + {RUNTIME_BRIDGE_AIF_URL: $u, RUNTIME_BRIDGE_AIF_PROJECT_ID: $i})' > "$tmp" 2>/dev/null \
      && jq -e . "$tmp" >/dev/null 2>&1 && mv "$tmp" "$settings" && return 0
  else
    # shellcheck disable=SC2016  # JavaScript, not shell expansions
    node -e '
      const fs = require("fs"); const [f, t, u, i] = process.argv.slice(1);
      const o = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
      if (o === null || typeof o !== "object" || Array.isArray(o)) process.exit(1);
      if (o.env !== undefined && (o.env === null || typeof o.env !== "object" || Array.isArray(o.env))) process.exit(1);
      o.env = Object.assign({}, o.env, { RUNTIME_BRIDGE_AIF_URL: u, RUNTIME_BRIDGE_AIF_PROJECT_ID: i });
      fs.writeFileSync(t, JSON.stringify(o, null, 2) + "\n"); JSON.parse(fs.readFileSync(t, "utf8"));
      fs.renameSync(t, f);' "$settings" "$tmp" "$url" "$id" 2>/dev/null && return 0
  fi
  rm -f "$tmp" 2>/dev/null
  return 1
}

# _bridge_ignore_local <dir> — keep <dir>/.claude/settings.local.json out of git. Claude Code
# git-ignores that file when it creates it; the install creates it here, so it does the same —
# through .git/info/exclude, which is this clone's own and leaves the project's .gitignore alone.
# Outside a git work tree there is nothing to commit it to, and nothing is done.
_bridge_ignore_local() {
  local ex
  command -v git >/dev/null 2>&1 || return 0
  git -C "$1" rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 0
  git -C "$1" check-ignore -q .claude/settings.local.json 2>/dev/null && return 0
  ex="$(git -C "$1" rev-parse --git-path info/exclude 2>/dev/null)" || return 0
  case "$ex" in /*) ;; *) ex="$1/$ex" ;; esac
  mkdir -p "$(dirname "$ex")" 2>/dev/null && printf '/.claude/settings.local.json\n' >> "$ex" 2>/dev/null \
    && printf '  ✓ .claude/settings.local.json git-ignored through .git/info/exclude (the project .gitignore is unchanged)\n'
  return 0
}

# bridge_wire_project <dir> [url] — wire <dir>'s runtime-bridge dispatch hook to its aif-handoff
# project (Q4.7: the install does it, never the reader). The hook reads RUNTIME_BRIDGE_AIF_URL and
# RUNTIME_BRIDGE_AIF_PROJECT_ID; both go into <dir>/.claude/settings.local.json `env` — a URL and a
# project id name THIS machine's aif-handoff, so they stay out of the shared, usually committed
# settings.json, and out of any shell rc. The project id is read from aif-handoff's GET /projects: the ONE project
# whose rootPath is <dir>. No match is not guessed by name — a docker aif-handoff lists container
# paths (/home/www/<name>), and a wrong id sends a kickoff to another project's queue — so it stays
# a NOT-wired line with its reason, as does every other case the install cannot decide.
bridge_wire_project() {
  local dir alt url settings shared json match rc total ids n cur cur_url
  dir="$(cd "$1" 2>/dev/null && pwd -P)" || dir="$1"
  alt="${1%/}"
  url="${2:-${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}}"
  settings="$dir/.claude/settings.local.json"
  shared="$dir/.claude/settings.json"
  if [ ! -f "$dir/.claude/hooks/runtime-bridge-dispatch.sh" ]; then
    _bridge_not_wired "not wired: the runtime-bridge dispatch hook ships only with --profile factory (or --with-aif-suite / --all), and this project has no .claude/hooks/runtime-bridge-dispatch.sh"
    return 0
  fi
  if ! bridge_health_ok "$url"; then
    _bridge_not_wired "dispatch hook not pointed at a project: aif-handoff does not answer at $url, so the install cannot read which aif-handoff project this is (RUNTIME_BRIDGE_AIF_PROJECT_ID)"
    return 0
  fi
  if ! json="$(curl -sf -m 3 "$url/projects" 2>/dev/null)"; then
    _bridge_not_wired "dispatch hook not pointed at a project: aif-handoff at $url did not answer GET /projects, so RUNTIME_BRIDGE_AIF_PROJECT_ID is unknown"
    return 0
  fi
  rc=0; match="$(_bridge_match "$json" "$dir" "$alt")" || rc=$?
  case "$rc" in
    0) ;;
    2) _bridge_not_wired "dispatch hook not pointed at a project: neither jq nor node is on PATH, and getff reads aif-handoff's project list only through one of them"; return 0 ;;
    *) _bridge_not_wired "dispatch hook not pointed at a project: aif-handoff at $url answered GET /projects with something other than a project list"; return 0 ;;
  esac
  total="$(printf '%s\n' "$match" | sed -n 1p)"
  ids="$(printf '%s\n' "$match" | sed 1d)"
  n="$(printf '%s' "$ids" | grep -c . || true)"
  if [ "$n" -eq 0 ]; then
    _bridge_not_wired "dispatch hook not pointed at a project: none of the $total projects aif-handoff lists at $url has $dir as its root (a docker aif-handoff lists container paths), and getff does not pick a project by name"
    return 0
  fi
  if [ "$n" -gt 1 ]; then
    _bridge_not_wired "dispatch hook not pointed at a project: $n aif-handoff projects at $url have $dir as their root, and getff does not choose between them"
    return 0
  fi
  # An id the project set in its shared settings.json is the team's choice: kept, nothing written.
  cur="$(_bridge_settings_env "$shared" RUNTIME_BRIDGE_AIF_PROJECT_ID || true)"
  if [ -n "$cur" ]; then
    printf '  ⊝ runtime-bridge keeps the project this repository set: RUNTIME_BRIDGE_AIF_PROJECT_ID=%s in .claude/settings.json (aif-handoff lists %s for this path)\n' "$cur" "$ids"
    return 0
  fi
  cur="$(_bridge_settings_env "$settings" RUNTIME_BRIDGE_AIF_PROJECT_ID || true)"
  cur_url="$(_bridge_settings_env "$settings" RUNTIME_BRIDGE_AIF_URL || true)"
  if [ -n "$cur" ] && [ "$cur" != "$ids" ]; then
    printf '  ⊝ runtime-bridge keeps the project set on this machine: RUNTIME_BRIDGE_AIF_PROJECT_ID=%s in .claude/settings.local.json (aif-handoff lists %s for this path)\n' "$cur" "$ids"
    return 0
  fi
  if [ "$cur" = "$ids" ] && [ "$cur_url" = "$url" ]; then
    printf '  ⊝ runtime-bridge already points at aif-handoff project %s at %s (.claude/settings.local.json env)\n' "$cur" "$url"
    return 0
  fi
  # A new wiring, or the same project at a moved aif-handoff URL. This file belongs to the
  # person: getff's env keys land only over a kept original (Q4.7, the session-settings
  # pattern) — snapshot before the write, settle after, and a keep that cannot happen
  # (snapshot failed, or the original could not be kept aside) leaves the file as it was and
  # is a NOT-wired line. A file this run already kept (session settings wrote it first) is not
  # snapshotted twice — keep_original_snapshot echoes nothing for it (KEPT_ORIGINALS).
  local PROJECT_ROOT="$dir" snap="" kept="" lib existed=""
  [ -f "$settings" ] && existed=1
  if ! declare -F keep_original_snapshot >/dev/null 2>&1; then
    lib="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"
    if [ -f "$lib" ]; then
      # In this shell, not a subshell: settle's verdict and the mark must reach the caller.
      # ./setup's scope knows companion_not_wired but no note_not_wired; lib.sh defines the
      # latter, and engine's companion_not_wired prefers it — the NOT-wired lines would land
      # in a list nothing prints here. Drop it again: the engine's array is that scope's
      # print channel (companion_not_wired_summary).
      local had_companion=""
      command -v companion_not_wired >/dev/null 2>&1 && had_companion=1
      # shellcheck source=setup.d/lib.sh
      INSTALL_SH_LIB_ONLY=1 . "$lib"
      unset INSTALL_SH_LIB_ONLY
      [ -n "$had_companion" ] && unset -f note_not_wired
    else
      _bridge_not_wired "dispatch hook not pointed at a project: aif-handoff project $ids matches this path, but keeping your original of .claude/settings.local.json needs setup.d/lib.sh next to bridge-guided.sh (keep_original_*), and this getff does not ship it, so nothing was written"
      return 0
    fi
  fi
  if [ -f "$settings" ]; then
    if ! snap="$(keep_original_snapshot "$settings")"; then
      _bridge_not_wired "dispatch hook not pointed at a project: aif-handoff project $ids matches this path, but your original of .claude/settings.local.json could not be copied aside, so nothing was written"
      return 0
    fi
  fi
  if _bridge_write_env "$settings" "$url" "$ids"; then
    if [ -n "$snap" ]; then
      if kept="$(keep_original_settle "$settings" "$snap")"; then
        if [ -n "$kept" ]; then
          printf '  ✓ runtime-bridge wired: .claude/settings.local.json env → aif-handoff project %s at %s (your original kept at %s)\n' "$ids" "$url" "${kept#"$PROJECT_ROOT"/}"
          if declare -F keep_original_mark >/dev/null 2>&1; then keep_original_mark "$settings"; fi
        else
          printf '  ✓ runtime-bridge wired: .claude/settings.local.json env → aif-handoff project %s at %s\n' "$ids" "$url"
        fi
      else
        _bridge_not_wired "dispatch hook not pointed at a project: aif-handoff project $ids matches this path, but your original of .claude/settings.local.json could not be kept, so getff's change was undone"
        return 0
      fi
    elif [ -n "$existed" ]; then
      # This run already kept the file (session settings wrote it first): no second original.
      printf '  ✓ runtime-bridge wired: .claude/settings.local.json env → aif-handoff project %s at %s (your original is kept once for this run)\n' "$ids" "$url"
    else
      # getff created the file: the .absent record tells the undo command to remove it.
      mkdir -p "$PROJECT_ROOT/.ai-factory/before-getff/.claude" 2>/dev/null \
        && : > "$PROJECT_ROOT/.ai-factory/before-getff/.claude/settings.local.json.absent" 2>/dev/null
      printf '  ✓ runtime-bridge wired: .claude/settings.local.json created with env → aif-handoff project %s at %s\n' "$ids" "$url"
      if declare -F keep_original_mark >/dev/null 2>&1; then keep_original_mark "$settings"; fi
    fi
    _bridge_ignore_local "$dir"
  else
    [ -n "$snap" ] && rm -f "$snap"
    _bridge_not_wired "dispatch hook not pointed at a project: aif-handoff project $ids matches this path, but $settings could not be written (not a JSON object, or not writable)"
  fi
}

# bridge_register_dispatch_hook <project_root> — layer 55, its --refresh arm (install.sh), and
# ./setup's bridge step for an installed getff. Registers the delivered dispatch hook in the project's .claude/settings.json on
# both events it reads (PostToolUse fires the dispatch, PostToolUseFailure reports a lost one —
# the same pair the getff repository registers), then points it at the aif-handoff project.
# Registering is safe unconditionally: the hook dispatches only a kickoff whose first line is
# `<!-- bridge: auto -->`, and exits 0 on every other write. Needs lib.sh's register_cc_hook; where
# it is not in scope (./setup), lib.sh is loaded in a subshell for the two registrations, and a
# failed registration is printed in place — the subshell's note_not_wired list would be lost.
bridge_register_dispatch_hook() {
  local root="$1"
  # shellcheck disable=SC2016  # $CLAUDE_PROJECT_DIR is expanded by Claude Code, not here
  local cmd='bash "$CLAUDE_PROJECT_DIR/.claude/hooks/runtime-bridge-dispatch.sh"'
  local url="${2:-}" lib
  [ -f "$root/.claude/hooks/runtime-bridge-dispatch.sh" ] || { bridge_wire_project "$root" ${url:+"$url"}; return 0; }
  if command -v register_cc_hook >/dev/null 2>&1; then
    register_cc_hook "$root/.claude/settings.json" "PostToolUse" "$cmd" "runtime-bridge-dispatch" "Write|Edit|MultiEdit"
    register_cc_hook "$root/.claude/settings.json" "PostToolUseFailure" "$cmd" "runtime-bridge-dispatch" "Write|Edit|MultiEdit"
  else
    lib="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"
    if [ -f "$lib" ]; then
      (
        # shellcheck source=setup.d/lib.sh
        INSTALL_SH_LIB_ONLY=1 . "$lib"
        note_not_wired() { printf '  ⚠ NOT wired: %s\n' "$1"; }
        register_cc_hook "$root/.claude/settings.json" "PostToolUse" "$cmd" "runtime-bridge-dispatch" "Write|Edit|MultiEdit"
        register_cc_hook "$root/.claude/settings.json" "PostToolUseFailure" "$cmd" "runtime-bridge-dispatch" "Write|Edit|MultiEdit"
      )
    else
      _bridge_not_wired "dispatch hook not registered in .claude/settings.json: this getff has no setup.d/lib.sh next to setup.d/bridge-guided.sh, and lib.sh holds the settings.json merge"
    fi
  fi
  # shellcheck disable=SC2031  # lib.sh's own `root` is set inside the subshell above, not this one
  bridge_wire_project "$root" ${url:+"$url"}
}

# Flow: diagnose → wire when aif-handoff answers → otherwise report what is not wired and why.
# For the getff repository setting itself up, the wiring is setup-runtime-bridge.sh, an interactive
# wizard that keeps the env in the shell rc (so a non-interactive run needs --global). An installed
# getff (the npm package, or a getff clone used as the installer) never runs that wizard: it
# registers the project's delivered dispatch hook and points it at the project's aif-handoff
# project (bridge_register_dispatch_hook), reporting what it cannot decide as NOT-wired lines.
bridge_guided_run() {
  local url="${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}"
  local state; state=$(bridge_diagnose "$url")
  case "$state" in
    up)      printf '  ✓ aif-handoff reachable at %s\n' "$url" ;;
    docker)  printf '  aif-handoff not responding at %s; docker is available.\n' "$url"
             _bridge_not_wired "not wired: aif-handoff does not answer at $url; docker is available, but getff does not start aif-handoff" ;;
    native)  printf '  aif-handoff CLI present but not responding at %s.\n' "$url"
             _bridge_not_wired "not wired: the aif-handoff CLI is installed but does not answer at $url, and getff does not start a service it did not install" ;;
    docker-down) printf '  aif-handoff not responding at %s; the docker daemon is not running.\n' "$url"
             _bridge_not_wired "not wired: aif-handoff does not answer at $url, and the docker daemon is not running — getff does not start the docker daemon" ;;
    absent)  printf '  aif-handoff not detected (no docker, no CLI).\n'
             _bridge_not_wired "not wired: this machine has no docker and no aif-handoff CLI, so there is no aif-handoff to wire to" ;;
  esac
  # Cross-layer warning (owner GO 2026-07-11): the AIF operator suite (--profile factory, or
  # the legacy --with-aif-suite/--all escape) presupposes this runtime — files landed but no
  # runtime means the suite skills dead-end. Both depth signals must be read: --profile factory
  # is the one that installs the suite today, and checking only the legacy escape meant the
  # modern flag installed the suite and got no warning. PROFILE_DEPTH is in scope when sourced
  # from ./setup, PROFILE when exported by install.sh; harmless empty otherwise.
  if [ "$state" != "up" ] \
    && { [ -n "${WITH_AIF_SUITE:-}" ] || [ "${PROFILE_DEPTH:-${PROFILE:-}}" = "factory" ]; }; then
    printf '  ⚠ AIF operator suite installed (--profile factory / --with-aif-suite / --all) but the aif-handoff runtime is not reachable — suite skills (pipeline/dispatcher/harvest/…) will dead-end until it is up.\n'
  fi
  # our-side writes are delegated to the existing, tested script:
  if [ "$state" = "up" ]; then
    # Lib is sourced (from ./setup and from tests) → $0 is the caller, not this
    # file. Resolve the root via BASH_SOURCE: this lib lives in setup.d/, so its
    # parent dir is the root. The project being set up is the working directory
    # (install.sh's PROJECT_ROOT is $(pwd)); -P on both so a symlinked path matches.
    local root proj
    root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
    proj="$(pwd -P)"
    # $PWD keeps the logical spelling: aif-handoff stores rootPath as typed, so a project entered
    # through a symlink must match on that spelling too (bridge_wire_project resolves -P itself).
    if [ "$root" = "$proj" ] && [ -f "$root/packages/runtime-bridge/scripts/setup-runtime-bridge.sh" ]; then
      # The getff repository itself: its settings.json is tracked, so the wizard keeps the
      # RUNTIME_BRIDGE_* env in the shell rc — a machine-global write, which a non-interactive
      # ./setup (-y / --all, MODE in scope) makes only with --global.
      if { [ "${MODE:-}" = "yes" ] || [ "${MODE:-}" = "all" ]; } && [ "${GETFF_GLOBAL:-}" != "1" ]; then
        _bridge_not_wired "not wired: getff's own bridge setup (setup-runtime-bridge.sh) keeps RUNTIME_BRIDGE_* in your shell rc, and a non-interactive install writes a machine-global file only with --global"
        return 0
      fi
      bash "$root/packages/runtime-bridge/scripts/setup-runtime-bridge.sh"
    else
      # An installed getff (the npm package, or a getff clone used as the installer): register the
      # project's dispatch hook and wire it (dual-impl §3, Q4.7) — the hook may come from an earlier
      # install that never registered it, and a ✓ must not stand on a hook Claude Code never runs.
      bridge_register_dispatch_hook "$PWD" "$url"
      return 0
    fi
  fi
}

if [ "${BRIDGE_LIB_ONLY:-}" = "1" ]; then
  return 0 2>/dev/null || true
fi
