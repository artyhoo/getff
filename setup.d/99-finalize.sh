#!/usr/bin/env bash
# setup.d/99-finalize.sh — synth-wire + R2 AST-wire + V2 otel WARN + ignore_shipped_configs + Done.
#
# Sources: lib.sh (already in dispatcher scope)
# S0 rows: R2-L2 (install.sh:1597-1641), otel (install.sh:1643-1657), cite:historical pre-split install.sh lines, code moved into this file by #719
#          ignore_shipped_configs CALL (install.sh:1659-1661), Done (install.sh:1663-1705) cite:historical pre-split install.sh lines, code moved into this file by #719
# Depends on: 70-deps (ts-morph installed; DEPS_INSTALLED + DEVDEPS set),
#             60-ci (_r2_verdict set), ALL prior layers (SKIPPED fully accumulated)
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone
# O3: HIGHEST-RISK ordering item — must run AFTER 70-deps (ts-morph) and LAST (SKIPPED complete)
# O2: reads _r2_verdict (from 60-ci) + DEPS_INSTALLED + DEVDEPS (from 70-deps)

# ─── synth-wire: deterministic synthesizer → root eslint.config.mjs ─────────────
# Runs synthesize() for the detected stack and AST-merges emitted rules-as-tests rules
# (R12/R14/R20 for react-next) into the consumer's root eslint.config.mjs.  Idempotent:
# the preset template already hand-inlines these rules (principle 26 guarantees sync),
# so this is a fast string-check no-op for a freshly-installed consumer.  Its value is
# architectural: the synthesizer is now the declared source of truth; future recipe
# additions will wire into the config without template edits.
#
# Runs regardless of _r2_verdict (R12/R14/R20 are not boundary-gated like R2) and
# honours --dry-run (writes nothing, prints what would change).
# rc=0 on every branch — install must not abort on wirer failure.
#
# A root config the CONSUMER owns (copy_safe kept an eslint.config.mjs, or it is an eslint.config.js
# — the name ESLint loads first, so getff placed nothing beside it) gets getff's block added by
# insertions only, the original kept at .ai-factory/before-getff/ whenever the write changes it
# (operator decision Q4.7, 2026-09-28): the stack's rules-as-tests rules and a live-research snippet
# (as for getff's own config), an ignores entry for the lintable files getff delivered, and — when
# 60-ci found an HTTP boundary — a RULE_GLOBS block with R2 (_r2_own_globs), so check:globs has the
# globs it reads. The config stays the consumer's: nothing records it in the refresh baseline. Any
# part that does not land is named in the not-wired summary with its reason. Before Q4.7 the install
# printed «add it by hand» here instead, and getff's rules stayed off in every such project.
_synth_live_snippet="$PROJECT_ROOT/.ai-factory/synthesizer-output/eslint-rules-snippet.json"
# _ts_morph_why <it|them> — the not-wired reason when ts-morph is not in node_modules. On a --full
# install its dev-dependency step was to put it there, so re-running with --full is no remedy; the
# step's output above says why it did not.
_ts_morph_why() {
  if [ -n "${FULL:-}" ]; then
    echo "adding $1 needs ts-morph, which this --full install's dev-dependency step did not put in node_modules (its output is above)"
  else
    echo "adding $1 needs ts-morph, which only a --full install puts in node_modules; re-run the install with --full and getff adds $1"
  fi
}
_root_eslint=$(eslint_flat_config "$PROJECT_ROOT")
# _own_eslint_ignores — the lintable files getff delivered that its own configs ignore (the
# templates' machinery ignores), one per line: never a directory the consumer might own too.
_own_eslint_ignores() {
  [ -f "$PROJECT_ROOT/eslint-rules-local/index.mjs" ] && echo 'eslint-rules-local/**'
  local rel
  for rel in packages/core/hooks/pre-push.bundle.mjs scripts/audit-r4.ts .dependency-cruiser.mjs \
             vitest.config.ts playwright.config.ts .storybook/main.ts .storybook/preview.ts; do
    getff_delivered "$PROJECT_ROOT/$rel" && echo "$rel"
  done
  return 0
}
if command -v node >/dev/null 2>&1 && [ -n "$_root_eslint" ] \
   && ! getff_delivered "$PROJECT_ROOT/$_root_eslint"; then
  _synth_wirer="$PKG_ROOT/packages/core/install/synth-and-wire.bundle.mjs"
  if [ "$_root_eslint" != eslint.config.js ] && [ "$_root_eslint" != eslint.config.mjs ]; then
    # copy_unless_foreign already listed it as not wired (no ES-module flat config to add to).
    echo "▶ synth-wire: $_root_eslint is your own config — getff adds its block only to an eslint.config.mjs or an ES-module eslint.config.js, so it is left as it is"
  elif [ ! -f "$_synth_wirer" ]; then
    echo "  · synth-and-wire: bundle not found at $_synth_wirer — skipped"
    note_not_wired "getff's rules in $_root_eslint (your own config) — the synth-and-wire bundle is missing from this getff package ($_synth_wirer)"
  elif [ ! -f "$PROJECT_ROOT/node_modules/ts-morph/package.json" ]; then
    echo "▶ synth-wire: $_root_eslint is your own config — adding getff's block to it needs ts-morph, which this install did not put in node_modules"
    _own_what="getff's rules"
    [ -z "${_r2_own_globs:-}" ] || _own_what="getff's rules, RULE_GLOBS and R2 (60-ci found an HTTP boundary)"
    note_not_wired "$_own_what in $_root_eslint (your own config) — $(_ts_morph_why them)"
  else
    echo "▶ synth-wire: $_root_eslint is your own config — adding getff's block to it (additions only; the original is kept if anything changes)"
    _own_args=( --own-config --stack "${STACK:-ts-server}" --path "$PROJECT_ROOT/$_root_eslint" )
    while IFS= read -r _g; do [ -n "$_g" ] && _own_args+=( --ignore "$_g" ); done < <(_own_eslint_ignores)
    while IFS= read -r _g; do [ -n "$_g" ] && _own_args+=( --r2-boundary "$_g" ); done <<< "${_r2_own_globs:-}"
    [ -f "$_synth_live_snippet" ] && _own_args+=( --snippet "$_synth_live_snippet" )
    _own_snap=""
    if [ "$DRY_RUN" != "--dry-run" ]; then _own_snap=$(keep_original_snapshot "$PROJECT_ROOT/$_root_eslint") || _own_snap=""; fi
    _own_out=$( cd "$PROJECT_ROOT" && AIF_SYNTH_PKG_ROOT="$PKG_ROOT/packages/core" \
        node "$_synth_wirer" "${_own_args[@]}" ${DRY_RUN:+--dry-run} 2>&1 ) && _sw_rc=0 || _sw_rc=$?
    printf '%s\n' "$_own_out"
    # settle rc 1: the original could not be kept aside, so the write was undone (its warning above).
    _own_undone=0
    _own_kept=$(keep_original_settle "$PROJECT_ROOT/$_root_eslint" "$_own_snap") || _own_undone=1
    [ -z "$_own_kept" ] || echo "  · your original $_root_eslint is kept at ${_own_kept#"$PROJECT_ROOT"/}"
    if [ "$_own_undone" = 1 ]; then
      note_not_wired "getff's rules in $_root_eslint (your own config) — its original could not be kept at .ai-factory/before-getff/, so getff's change was undone and the file is as it was"
    # rc 3: parts did not land — each is one «  · not wired: <what> — <why>» line of the output.
    elif [ "$_sw_rc" -eq 3 ]; then
      while IFS= read -r _l; do
        case "$_l" in "  · not wired: "*) note_not_wired "${_l#  · not wired: } ($_root_eslint)" ;; esac
      done <<< "$_own_out"
    elif [ "$_sw_rc" -ne 0 ]; then
      note_not_wired "getff's rules in $_root_eslint (your own config) — synth-and-wire exited $_sw_rc (output above)"
    fi
  fi
  # The self-verify's «fences fire» claim (D1 below) is about this root config: when getff's rules
  # did not land in it, that claim is not this install's to make — the same signal a .cjs/.ts root
  # sets in copy_unless_foreign (cold-review F8).
  grep -q 'rules-as-tests/' "$PROJECT_ROOT/$_root_eslint" 2>/dev/null || ESLINT_ROOT_NOT_WIRED=1
elif command -v node >/dev/null 2>&1 && [ -f "$PROJECT_ROOT/eslint.config.mjs" ]; then
  _synth_wirer="$PKG_ROOT/packages/core/install/synth-and-wire.bundle.mjs"
  if [ ! -f "$_synth_wirer" ]; then
    echo "  · synth-and-wire: bundle not found at $_synth_wirer — skipped"
  else
    echo "▶ synth-wire: confirming synthesized rules-as-tests slice in eslint.config.mjs"
    # Run from PROJECT_ROOT so ts-morph resolves from consumer node_modules.
    # AIF_SYNTH_PKG_ROOT anchors the bundle's fs-based recipe + schema reads to the
    # correct framework payload dir (packages/core/) — import.meta.url collapses to
    # install/ under bundling (zero-dep Path-3, #755); env var is the load-bearing bridge.
    # rc 3 = the wirer ran but the rules did NOT land (unrecognised shape, or its post-write lint
    # probe found ESLint could no longer use the config and restored it); each part is one
    # «  · not wired: <what> — <why>» line, copied into the summary with its reason (Q4.7: no
    # «add it by hand»). Any other failure stays non-fatal as before — the install never aborts here.
    _sw_out=$( cd "$PROJECT_ROOT" && AIF_SYNTH_PKG_ROOT="$PKG_ROOT/packages/core" \
        node "$_synth_wirer" \
          --stack "${STACK:-ts-server}" \
          --path "$PROJECT_ROOT/eslint.config.mjs" \
          ${DRY_RUN:+--dry-run} 2>&1 ) && _sw_rc=0 || _sw_rc=$?
    printf '%s\n' "$_sw_out"
    if [ "$_sw_rc" -eq 3 ]; then
      _sw_listed=0
      while IFS= read -r _l; do
        case "$_l" in "  · not wired: "*) note_not_wired "${_l#  · not wired: }"; _sw_listed=1 ;; esac
      done <<< "$_sw_out"
      [ "$_sw_listed" -eq 1 ] \
        || note_not_wired "stack rules in eslint.config.mjs — the synthesized rules-as-tests slice was not added (reason printed by synth-and-wire above)"
    fi
  fi
fi

# ─── #827 B3: per-workspace live-research synth-wire for multi-stack monorepos ──
# The root synth-wire block above wires $PROJECT_ROOT/eslint.config.mjs and is gated on that root
# config existing — correct for flat repos. A multi-stack monorepo has NO root config, so the
# live-research snippet (emitted by 80-rule-bootstrap for the install's $STACK) would wire NOWHERE.
# Mirror the R2 per-workspace loop (§13.5 I-2 L2 below): for each detected workspace whose stack
# matches the install $STACK, wire the (single, stack-keyed) root snippet into that workspace's
# eslint.config.mjs.
#
# Routing (simplest correct; matches the dogfood layout): research is ROOT-level + stack-keyed
# ($PROJECT_ROOT/.ai-factory/rules-research/<stack>.{research,selection}.json — the same convention
# 80-rule-bootstrap reads), and 80-rule-bootstrap emits ONE snippet for the install's $STACK. We
# route that snippet to workspaces whose DETECTED stack == $STACK. A multi-stack monorepo runs
# ./setup <stack> --full once per stack (install.sh takes a single --stack arg); each run delivers
# that stack's live rule into its matching workspaces. Snippet is passed EXPLICITLY (--snippet)
# because the CLI default derives it from the config's own dir, which a workspace config lacks.
# Gated on NO root config (mutually exclusive with the root block above — no double-wire).
# Honours --dry-run; rc=0 on every branch — install must not abort on wirer failure.
if command -v node >/dev/null 2>&1 && [ "$DRY_RUN" != "--dry-run" ] \
   && [ "$_root_eslint" != eslint.config.mjs ] && [ "$_root_eslint" != eslint.config.js ]; then
  _synth_wirer_ws="$PKG_ROOT/packages/core/install/synth-and-wire.bundle.mjs"
  _ws_snippet="$PROJECT_ROOT/.ai-factory/synthesizer-output/eslint-rules-snippet.json"
  if [ ! -f "$_synth_wirer_ws" ]; then
    : # bundle absent — nothing to wire (the root block already echoes this for flat repos)
  elif [ ! -f "$_ws_snippet" ]; then
    : # no live snippet emitted (80-rule-bootstrap degraded / not --full) — presets are the fence
  else
    _ws_map_synth=$(_detect_stacks_per_workspace "$PROJECT_ROOT")
    if [ -n "$_ws_map_synth" ]; then
      echo "▶ synth-wire per-workspace: routing ${STACK:-ts-server} live-research snippet to matching workspace configs"
      while IFS=$'\t' read -r _sw_dir _sw_stack; do
        [ -n "$_sw_dir" ] || continue
        # Only wire the snippet into workspaces matching the install's $STACK — the snippet IS that
        # stack's live rule. Other-stack workspaces are delivered on their own ./setup <stack> run.
        [ "$_sw_stack" = "${STACK:-ts-server}" ] || continue
        while IFS= read -r -d '' _sw_cfg; do
          # A workspace config the consumer owns gets the root block's treatment (Q4.7): getff's
          # block is added by insertions only and the original kept if the write changes it.
          _sw_rel="${_sw_cfg#"$PROJECT_ROOT"/}"
          _sw_own=()
          _sw_snap=""
          if getff_delivered "$_sw_cfg"; then
            echo "  · synth-wire (live): $_sw_cfg"
          else
            echo "  · synth-wire (live): $_sw_rel is your own config — adding getff's block to it (additions only)"
            _sw_own=( --own-config )
            _sw_snap=$(keep_original_snapshot "$_sw_cfg") || _sw_snap=""
          fi
          _sw_out=$( cd "$PROJECT_ROOT" && AIF_SYNTH_PKG_ROOT="$PKG_ROOT/packages/core" \
              node "$_synth_wirer_ws" ${_sw_own[@]+"${_sw_own[@]}"} \
                --stack "${STACK:-ts-server}" \
                --path "$_sw_cfg" \
                --snippet "$_ws_snippet" 2>&1 ) && _sw_rc=0 || _sw_rc=$?
          printf '%s\n' "$_sw_out"
          _sw_undone=0
          _sw_kept=$(keep_original_settle "$_sw_cfg" "$_sw_snap") || _sw_undone=1
          [ -z "$_sw_kept" ] || echo "  · your original $_sw_rel is kept at ${_sw_kept#"$PROJECT_ROOT"/}"
          if [ "$_sw_undone" = 1 ]; then
            note_not_wired "live-research rules in $_sw_rel (your own config) — its original could not be kept at .ai-factory/before-getff/, so getff's change was undone and the file is as it was"
          elif [ "$_sw_rc" -eq 3 ] && [ "${#_sw_own[@]}" -gt 0 ]; then
            while IFS= read -r _l; do
              case "$_l" in "  · not wired: "*) note_not_wired "${_l#  · not wired: } ($_sw_rel)" ;; esac
            done <<< "$_sw_out"
          elif [ "$_sw_rc" -eq 3 ]; then
            note_not_wired "live-research rules in $_sw_rel — not added (reason printed by synth-and-wire above)"
          fi
        done < <(find "$PROJECT_ROOT/$_sw_dir" \
          -name 'eslint.config.mjs' \
          ! -path '*/node_modules/*' \
          -print0 2>/dev/null)
      done <<< "$_ws_map_synth"
    fi
  fi
fi

# ─── D3: presets-are-fallback notice (live-research-default-delivery) ───────────
# Live-research is the DEFAULT stack-rule delivery; presets are the FALLBACK baseline. When the
# consumer has NOT authored rules-research artefacts for this stack, the live path (80-rule-bootstrap
# → synth-wire snippet merge above) produced nothing, so the shipped preset rules are the only
# stack fence. Surface that + point at the live-research protocol. Deps-free echo; exit stays 0.
# Mirrors the R7/R8-arming WARN style below; --dry-run-aware.
_rr_dir="$PROJECT_ROOT/.ai-factory/rules-research"
_rr_plan="$_rr_dir/${STACK:-ts-server}.research.json"
_rr_sel="$_rr_dir/${STACK:-ts-server}.selection.json"
if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "  [dry-run] would check ${STACK:-ts-server} rules-research artefacts for the presets-are-fallback notice"
elif [ ! -f "$_rr_plan" ] || [ ! -f "$_rr_sel" ]; then
  echo ""
  echo "ℹ  Presets are the FALLBACK baseline — prefer live-research for fresh, stack-specific rules."
  echo "   No .ai-factory/rules-research/${STACK:-ts-server}.{research,selection}.json found, so the shipped"
  echo "   preset rules are your only stack fence this install. Run the rule-research protocol"
  echo "   (agents/rule-researcher.md or the rule-research skill), then re-run ./setup --full to"
  echo "   deliver live-researched rules into eslint.config.mjs (they augment + override the presets)."
fi

# ─── D4 (#811): preset staleness guard — frozen-snapshot vs installed-major WARN ───
# The shipped preset is a frozen Next-15 snapshot (packages/preset-next-15-canonical/preset.meta.json
# pins). When the consumer's installed framework/tool major differs, WARN + steer to live-research.
# Deps-free (warn_preset_staleness greps package.json text); scoped to react-next (the preset's stack);
# --dry-run-aware; exit stays 0.
_preset_meta="$PKG_ROOT/packages/preset-next-15-canonical/preset.meta.json"
if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "  [dry-run] would compare installed tool majors vs $_preset_meta for the #811 staleness WARN"
elif [ "${STACK:-}" = "react-next" ]; then
  warn_preset_staleness "$_preset_meta" "$PROJECT_ROOT/package.json"
fi

# ─── 6b-bis-L2. GH #547 Layer 2: AST-wire R2 into consumer per-package configs ─
# Runs AFTER §8 dep-install so ts-morph is resolvable when --full is set.
# Option A (migration-ast Stage 4): ensure-then-use; degrade when engine absent. rc=0 on every
# branch (lesson GH #531/#544).
# Layer 1 (§6b-bis above) patches OUR eslint.config.mjs; this Layer 2 finds per-package
# eslint.config.mjs files that re-export a base lacking R2, and wires only the ones getff placed.
#
# _r2_wire_cfg <abs-cfg> <wirer> — R2 wiring of one config, shared by Layer 2 and the per-workspace
# block below. A config the consumer owns gets R2 added too (operator decision Q4.7, 2026-09-28),
# but only for HTTP boundary code under that config's own directory — read the way 60-ci reads the
# repo (detect-r2-boundary.sh; its globs are directory-agnostic, so they hold relative to the config)
# — and scoped to it through RULE_GLOBS.boundary: a package with no boundary code gets nothing, since
# R2 has nothing to guard there (cold-review F15). The wirer runs with --own-config, which adds R2 by
# text insertions only in the consumer's prettier style (cold-review F1: the AST writer dropped the
# consumer's comments and trailing commas) and names in a «  · not wired: » line anything it could
# not add; the original is kept at .ai-factory/before-getff/ whenever the write changes it. rc=0 on
# every branch — install must not abort on wirer failure.
#
# A config getff placed is written on every install, --full or not: the --full gate here was the
# consent to edit a file the consumer wrote (install-ast-wiring spec Q5, 2026-06-17), and since
# provenance (#1860) only getff's own files reach that branch — while its bytes are still the ones
# getff left (getff_bytes_intact). One the consumer has edited since takes the own-config branch: its
# content is theirs, and the AST writer re-prints the list it edits, dropping their comments. --install
# makes the wirer report what did not land as a not-wired line, never as a snippet to add by hand (Q4.7).
# getff_bytes_intact <abs-cfg> — exit 0 IFF <abs-cfg> still holds the bytes getff left in it: this run
# staged it (the delivery itself), or its sha256 equals the refresh-baseline entry an earlier install
# recorded (hashed at that install's end, after this post-processing). A getff_delivered file the
# consumer edited since fails it — those bytes are theirs now — and so does an unknown one (no entry,
# no jq, no sha256 tool): the safe side.
getff_bytes_intact() {
  local dst="$1" p cur
  for p in ${REFRESH_BASELINE_STAGED[@]+"${REFRESH_BASELINE_STAGED[@]}"} \
    ${REFRESH_BASELINE_STAGED_WEAK[@]+"${REFRESH_BASELINE_STAGED_WEAK[@]}"}; do
    [ "$p" = "$dst" ] && return 0
  done
  [ -f "$dst" ] || return 1
  _refresh_baseline_lookup "$dst"
  [ -n "$REFRESH_BASELINE_ENTRY" ] || return 1
  cur=$(_hash256 "$dst") || return 1
  [ "$cur" = "$REFRESH_BASELINE_ENTRY" ]
}
# _r2_getff_owned <abs-cfg> — exit 0 IFF getff placed <abs-cfg> and it still holds getff's bytes: the
# config _r2_wire_cfg hands the wirer as getff's own; every other config takes the own-config branch.
_r2_getff_owned() { getff_delivered "$1" && getff_bytes_intact "$1"; }
_r2_wire_cfg() {
  local cfg="$1" wirer="$2" rel dir out snap kept l
  local args=()
  rel="${cfg#"$PROJECT_ROOT"/}"
  if getff_delivered "$cfg"; then
    if getff_bytes_intact "$cfg"; then
      out=$( cd "$PROJECT_ROOT" && npx --no-install tsx "$wirer" --path "$cfg" --yes --install 2>&1 ) || true
      printf '%s\n' "$out"
      _r2_note_outcome "$rel" "$out"
      return 0
    fi
    echo "  · R2: getff placed $rel, and it has been edited since — it is treated as your own config"
  fi
  dir=$(dirname "$cfg")
  out=$(R2_DETECT_ROOT="$dir" bash "$PKG_ROOT/packages/core/audit-self/detect-r2-boundary.sh" 2>/dev/null) || out=""
  while IFS= read -r l; do
    case "$l" in glob:*) args+=( --boundary "${l#glob:}" ) ;; esac
  done <<< "$out"
  if [ "$(printf '%s\n' "$out" | head -1)" != boundary-present ] || [ "${#args[@]}" -eq 0 ]; then
    echo "  · R2: no HTTP boundary code under ${dir#"$PROJECT_ROOT"/} — nothing for R2 to guard, so your $rel is left as it is"
    return 0
  fi
  echo "  · R2: $rel is your own config — adding R2 for the HTTP boundary code under ${dir#"$PROJECT_ROOT"/} (additions only; the original is kept if anything changes)"
  snap=$(keep_original_snapshot "$cfg") || snap=""
  out=$( cd "$PROJECT_ROOT" && npx --no-install tsx "$wirer" --path "$cfg" --yes --own-config "${args[@]}" 2>&1 ) || true
  printf '%s\n' "$out"
  if ! kept=$(keep_original_settle "$cfg" "$snap"); then
    note_not_wired "R2 (rules-as-tests/no-unsafe-zod-parse) in $rel — its original could not be kept at .ai-factory/before-getff/, so getff's change was undone and the file is as it was"
    return 0
  fi
  [ -z "$kept" ] || echo "  · your original $rel is kept at ${kept#"$PROJECT_ROOT"/}"
  _r2_note_outcome "$rel" "$out"
  return 0
}
# _r2_note_outcome <rel> <wirer output> — the NOT wired summary for one run of the R2 wirer: each
# «  · not wired: <what> — <why>» line the wirer printed, as it is, whether or not R2 itself landed;
# and when R2 neither landed nor was there already and the wirer named nothing (a crash), the config,
# pointing at the wirer's output above.
_r2_note_outcome() {
  local rel="$1" out="$2" l noted=""
  while IFS= read -r l; do
    case "$l" in "  · not wired: "*) note_not_wired "${l#  · not wired: }"; noted=1 ;; esac
  done <<< "$out"
  case "$out" in
    *"✓ R2 wired"*|*"R2 already enforced"*) : ;;
    *) [ -n "$noted" ] || note_not_wired "R2 (rules-as-tests/no-unsafe-zod-parse) in $rel — the R2 wirer did not add it (its output is above)" ;;
  esac
  return 0
}
# When an R2 pass cannot run at all (no Node, no ts-morph, no wirer), each config it would have
# changed is named in the «NOT wired» summary with the reason (operator decision Q4.7) — only those:
# a config that already names R2 (getff's ts-server and react templates carry it) is not listed, and neither
# is one the consumer owns — or one getff placed and the consumer has edited since — with no HTTP
# boundary code under it, which _r2_wire_cfg leaves as it is. «Names R2» is read the way the wirer
# reads it on each branch: getff's own config counts any mention (resolveAndWire), the consumer's
# only a quoted rule id — a comment naming the rule is not a rule entry (simpleRulePresent).
# _r2_boundary_under <abs dir> — exit 0 IFF detect-r2-boundary.sh finds HTTP boundary code under it.
_r2_boundary_under() {
  local out
  out=$(R2_DETECT_ROOT="$1" bash "$PKG_ROOT/packages/core/audit-self/detect-r2-boundary.sh" 2>/dev/null) || out=""
  [ "$(printf '%s\n' "$out" | head -1)" = boundary-present ] && printf '%s\n' "$out" | grep -q '^glob:'
}
_r2_would_wire() {
  if _r2_getff_owned "$1"; then
    ! grep -q 'rules-as-tests/no-unsafe-zod-parse' "$1" 2>/dev/null
    return
  fi
  grep -qF -e "'rules-as-tests/no-unsafe-zod-parse'" -e '"rules-as-tests/no-unsafe-zod-parse"' "$1" 2>/dev/null && return 1
  _r2_boundary_under "$(dirname "$1")"
}
# _r2_pass_blocker <wirer> — why the pass cannot run, on stdout; empty when it can.
_r2_pass_blocker() {
  if ! command -v node >/dev/null 2>&1; then
    echo "adding it needs Node, which this install did not find on PATH"
  elif [ ! -f "$PROJECT_ROOT/node_modules/ts-morph/package.json" ]; then
    _ts_morph_why it
  elif [ ! -f "$1" ]; then
    echo "the R2 wirer is missing from this getff package ($1)"
  fi
}
# _r2_note_unwired <reason> <config>... — one summary line per config the pass would have changed.
_r2_note_unwired() {
  local why="$1" cfg rel
  shift
  for cfg in "$@"; do
    _r2_would_wire "$cfg" || continue
    rel="${cfg#"$PROJECT_ROOT"/}"
    echo "  · R2: not added to $rel — $why"
    note_not_wired "R2 (rules-as-tests/no-unsafe-zod-parse) in $rel — $why"
  done
  return 0
}
if [ "${_r2_verdict:-}" = "boundary-present" ] && [ "$DRY_RUN" != "--dry-run" ] \
   && { [ "$_root_eslint" = eslint.config.mjs ] || [ "$_root_eslint" = eslint.config.js ]; }; then
  # Find per-package eslint.config.mjs files (not the root one, not node_modules)
  _l2_configs=()
  while IFS= read -r -d '' _cfg; do
    _l2_configs+=("$_cfg")
  done < <(find "$PROJECT_ROOT" \
    -name node_modules -prune -o \
    -name 'eslint.config.mjs' ! -path "$PROJECT_ROOT/eslint.config.mjs" -print0 2>/dev/null)
  _wirer="$PKG_ROOT/packages/core/install/wire-eslint-r2.ts"
  _r2_why=$(_r2_pass_blocker "$_wirer")
  if [ "${#_l2_configs[@]}" -eq 0 ]; then
    : # no per-package configs — nothing to wire
  elif [ -n "$_r2_why" ]; then
    _r2_note_unwired "$_r2_why" "${_l2_configs[@]}"
  else
    echo "▶ R2 Layer-2: wiring ${#_l2_configs[@]} per-package eslint config(s)"
    for _cfg in "${_l2_configs[@]}"; do
      _r2_wire_cfg "$_cfg" "$_wirer"
    done
  fi
fi

# §13.5 I-2 L2: R2 per-workspace wiring for multi-stack monorepos (SSOT #182).
# The block above gates on root eslint.config.mjs — intentional for flat repos. In a multi-stack
# monorepo there is NO root config; this block wires R2 into the configs of the workspaces whose
# getff preset carries R2 — ts-server, react-next, react-spa, the three 60-ci.sh adds it to in a flat
# repo's own config. The react-native preset ships no R2, so there is nothing to add to one.
# No --scope: workspace-local config placement already scopes ESLint to that workspace — a
# dir-prefixed files: glob inside a workspace-local config is relative to that config's dir,
# making 'ws/**' resolve to 'ws/ws/**' (nothing). Scoping is by config placement, not files:.
# Scope source = _detect_stacks_per_workspace detection map, NOT recipe appliesTo (T-MS-A).
if [ "$DRY_RUN" != "--dry-run" ] \
   && [ "$_root_eslint" != eslint.config.mjs ] && [ "$_root_eslint" != eslint.config.js ]; then
  _ws_map_r2=$(_detect_stacks_per_workspace "$PROJECT_ROOT")
  _ws_r2_configs=()
  while IFS=$'\t' read -r _ws_dir _ws_stack; do
    [ -n "$_ws_dir" ] || continue
    case "$_ws_stack" in
      ts-server|react-next|react-spa)
        # Every eslint.config.mjs within this workspace: the ones getff placed, and one the consumer
        # owns (40-configs.sh kept it) — _r2_wire_cfg adds R2 to that only for HTTP boundary code under it.
        while IFS= read -r -d '' _ws_cfg; do
          _ws_r2_configs+=("$_ws_cfg")
        done < <(find "$PROJECT_ROOT/$_ws_dir" \
          -name node_modules -prune -o -name 'eslint.config.mjs' -print0 2>/dev/null)
        ;;
      unknown)
        echo "  ⚠ $_ws_dir: unknown stack — R2 not wired (re-checkable marker; not exit 1)"
        # Named in the summary only when there is HTTP boundary code under it and no config there
        # names R2 as a quoted rule id (40-configs.sh may have placed the ts-server template through
        # its root fallback; a comment naming the rule is not a rule entry).
        if _r2_boundary_under "$PROJECT_ROOT/$_ws_dir" \
           && ! grep -rlqF --include='eslint.config.*' --exclude-dir=node_modules \
                -e "'rules-as-tests/no-unsafe-zod-parse'" -e '"rules-as-tests/no-unsafe-zod-parse"' \
                "$PROJECT_ROOT/$_ws_dir" 2>/dev/null; then
          note_not_wired "R2 (rules-as-tests/no-unsafe-zod-parse) in $_ws_dir — its package.json names none of the dependencies the install reads a stack from (typescript, react, next, react-native), so the install cannot tell this workspace's stack and adds R2 only to a ts-server, react-next or react-spa one; the HTTP boundary code under $_ws_dir is not checked by R2"
        fi
        ;;
      *)
        : # react-native: its preset ships no R2 — nothing to add (60-ci.sh leaves a flat repo's alike)
        ;;
    esac
  done <<< "$_ws_map_r2"
  if [ "${#_ws_r2_configs[@]}" -gt 0 ]; then
    _wirer_ws="$PKG_ROOT/packages/core/install/wire-eslint-r2.ts"
    _r2_why=$(_r2_pass_blocker "$_wirer_ws")
    if [ -n "$_r2_why" ]; then
      _r2_note_unwired "$_r2_why" "${_ws_r2_configs[@]}"
    else
      echo "▶ R2 per-workspace: scoped wiring (multi-stack monorepo)"
      # No --scope: the config is workspace-local (placed by 40-configs.sh) so ESLint
      # scoping is already provided by config placement — a dir-prefixed files: glob
      # inside a workspace-local config would be relative to that config's own dir,
      # making 'apps/api/**' match 'apps/api/apps/api/**' (nothing). Omit files: here.
      for _ws_cfg in "${_ws_r2_configs[@]}"; do
        if getff_delivered "$_ws_cfg"; then echo "  · R2 wiring: $_ws_cfg"; fi
        _r2_wire_cfg "$_ws_cfg" "$_wirer_ws"
      done
    fi
  fi
fi

# ─── cih-s3 V2: runtime-discipline arming WARN (consumer-side, deps-free) ───
# R7/R8 (no-direct-time-randomness / require-otel-span) ship DEFERRED behind AIF_STRICT_RUNTIME=1
# in the eslint config templates. If the consumer already depends on @opentelemetry/* yet has not
# armed the runtime rules, R8 silently never fires — surface that. Greps the package.json TEXT
# (deps may be uninstalled at install time → no module/require check). Non-fatal: WARN only,
# exit stays 0 (a fresh skeleton legitimately defers). --dry-run-aware.
if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "  [dry-run] would check @opentelemetry/* vs AIF_STRICT_RUNTIME for the R7/R8 arming WARN"
elif [ -f "$PROJECT_ROOT/package.json" ] && \
     grep -q '@opentelemetry/' "$PROJECT_ROOT/package.json" && \
     [ "${AIF_STRICT_RUNTIME:-}" != "1" ]; then
  echo ""
  echo "⚠  Detected @opentelemetry/* but AIF_STRICT_RUNTIME is unset — R8 (require-otel-span) will not fire."
  echo "   Set AIF_STRICT_RUNTIME=1 to arm runtime-discipline rules (R7/R8)."
fi

# GH #531 (reopen): ignore the framework configs we shipped FRESH (consumer-owned ones stay checked).
# Runs after ALL copy_safe calls so SKIPPED is complete, and after the static .prettierignore merge.
ignore_shipped_configs

# ─── GH #975: re-assert .husky/* AFTER the dep-install lifecycle ────────────────
# A consumer `prepare`-driven git-hooks manager (simple-git-hooks / husky re-init) fires during
# 70-deps' package-manager install and clobbers the framework's .husky/pre-push (+ pre-commit)
# that 50-hooks copied BEFORE deps. Restore the shields here so the push shield survives before
# self-verify checks it. Gated on DEPS_INSTALLED (a --force/no-deps install never ran the
# lifecycle, so its hooks are intact). Logic lives in lib.sh (SSOT).
if [ "${DEPS_INSTALLED:-}" = "1" ] && [ "${DRY_RUN:-}" != "--dry-run" ]; then
  reassert_husky_shields "$PKG_ROOT" "$PROJECT_ROOT"
fi

# ─── install-self-verification capstone (FULL only) ─────────────────────────
# Runs at the end of --full install to PROVE — not just assert — that:
#   1. Installed ESLint fences FIRE on deliberately-bad input (D1)
#   2. Husky shields are wired and active (D2)
#   3. Generated rule tests are non-vacuous: kill ≥60% of selector mutations (D5)
# MUST NOT run on CI self-install path (FULL unset). Degrades gracefully (rc=0) when
# eslint/deps are absent. Mirrors 80-rule-bootstrap.sh FULL guard (lines 25-27).
if [ -z "${FULL:-}" ]; then
  : # not a --full install — skip self-verification
elif [ "${DRY_RUN:-}" = "--dry-run" ]; then
  echo "· install-self-verify: [dry-run] would run fences-fire + shields-up + mutation gates"
else
  echo ""
  # "probing", not "proving": this line prints BEFORE any check ran — announcing intent, not a
  # verdict. The verdict lines below carry the actual (form-scoped) claims.
  echo "▶ install-self-verify: probing — do fences fire, are shields wired, are generated tests non-vacuous"

  _ISV_PASS=0; _ISV_FAIL=0; _ISV_SKIP=0; _ISV_SKIPPED_NAMES=""
  # A SKIP is a check that proved nothing — its script is absent, it ran and checked nothing
  # (rc 77, below), or it guards a surface this install deliberately left unwired (NOT wired
  # list) — and it is NOT a pass. Counting it separately keeps the success banner from claiming a
  # property the run never proved (attention-is-not-a-mechanism.md §1: a check nobody ran is not
  # a mechanism).
  # Every check is run with GETFF_SKIP_RC=77 (the automake/TAP SKIP code): each exits 77 instead
  # of 0 when it ran but checked nothing, which used to be counted as PASS (critical-review S4-7).
  _ISV_SKIP_RC=77
  _isv_skip() {  # $1 = check name
    _ISV_SKIP=$((_ISV_SKIP+1))
    if [ -z "$_ISV_SKIPPED_NAMES" ]; then
      _ISV_SKIPPED_NAMES="$1"
    else
      _ISV_SKIPPED_NAMES="$_ISV_SKIPPED_NAMES, $1"
    fi
  }

  # D1: fences fire.
  # Deps landed in THIS run (70-deps → DEPS_INSTALLED=1), so a dep-missing SKIP inside the probe
  # now is a real delivery gap, not a benign pre-install degrade: promote it to rc=1 via
  # FENCES_FIRE_STRICT=1 (#932 semantics live inside check-fences-fire.sh) so a silently-degraded
  # probe cannot be counted as a pass here. When deps were NOT installed this run, leave the env
  # untouched — the gate's own default (auto-strict only under CI) applies.
  _FF_SCRIPT="$PROJECT_ROOT/scripts/check-fences-fire.sh"
  if [ -n "${ESLINT_ROOT_NOT_WIRED:-}" ]; then
    # getff's rules are not in the consumer's own root ESLint config (a .cjs/.ts one, or a block that
    # did not land): the fences are not in their lint, so «fences fire» is not this install's to
    # claim — and not a failure either.
    echo "  · fences-fire: skipped — getff's rules are not in your own root ESLint config (see NOT wired below)"
    _isv_skip "fences-fire (not wired)"
  elif [ -x "$_FF_SCRIPT" ]; then
    # GH #976: this is a --full install self-verify (the capstone only runs on FULL), so a
    # PLACED eslint.config.mjs that cannot `import()` is a real delivery gap even when the
    # dep-install was only PARTIAL (#974 trust-downgrade → DEPS_INSTALLED unset) — the install
    # still CLAIMED success. FENCES_FIRE_LOAD_PROBE=1 promotes the load-probe to a hard FAIL
    # here (and ONLY here) so it does not fire in the check-fences-fire-full-barrel test / plain
    # CI runs, which legitimately probe fences without a full plugin install.
    if [ "${DEPS_INSTALLED:-}" = "1" ]; then
      GETFF_SKIP_RC=$_ISV_SKIP_RC AIF_PROJECT_ROOT="$PROJECT_ROOT" FENCES_FIRE_STRICT=1 FENCES_FIRE_LOAD_PROBE=1 bash "$_FF_SCRIPT" && _ff_rc=0 || _ff_rc=$?
    else
      GETFF_SKIP_RC=$_ISV_SKIP_RC AIF_PROJECT_ROOT="$PROJECT_ROOT" FENCES_FIRE_LOAD_PROBE=1 bash "$_FF_SCRIPT" && _ff_rc=0 || _ff_rc=$?
    fi
    if [ "$_ff_rc" -eq 0 ]; then
      _ISV_PASS=$((_ISV_PASS+1))
    elif [ "$_ff_rc" -eq "$_ISV_SKIP_RC" ]; then
      echo "  · fences-fire: ran, but no fence was proved to fire — skipped"
      _isv_skip "fences-fire (proved nothing)"
    else
      _ISV_FAIL=$((_ISV_FAIL+1))
      # Two distinct causes land here and rc alone cannot tell them apart; the specific reason is
      # in check-fences-fire.sh's own line above. Under FENCES_FIRE_STRICT=1 a dep-missing SKIP is
      # promoted to rc=1 (a real delivery gap post-install), which is NOT "rules are silent".
      echo "  ✗ fences-fire FAILED — see check-fences-fire.sh output above (a rule was silent on bad input, or strict mode promoted a dep-missing SKIP to a failure)"
    fi
  else
    echo "  · fences-fire: script not found at $_FF_SCRIPT (40-configs.sh copy skipped?) — skipped"
    _isv_skip "fences-fire"
  fi

  # D2: shields up
  _SU_SCRIPT="$PROJECT_ROOT/scripts/check-shields-up.sh"
  if [ -n "${HUSKY_HOOKS_BLOCKED:-}" ]; then
    # 50-hooks did not activate core.hooksPath: no shield is wired, by consent. A FAIL here
    # contradicted the NOT wired summary; a PASS was never earned.
    echo "  · shields-up: skipped — your git hooks were left as they are (see NOT wired below)"
    _isv_skip "shields-up (not wired)"
  elif [ -x "$_SU_SCRIPT" ]; then
    # A kept consumer hook (HUSKY_CONSUMER_HOOKS) exempts only itself: hooksPath and the other hook
    # are still checked, so one kept pre-commit cannot hide a dead push shield.
    GETFF_SKIP_RC=$_ISV_SKIP_RC AIF_SHIELDS_CONSUMER_HOOKS="${HUSKY_CONSUMER_HOOKS:-}" \
      AIF_PROJECT_ROOT="$PROJECT_ROOT" bash "$_SU_SCRIPT" && _su_rc=0 || _su_rc=$?
    if [ "$_su_rc" -eq 0 ] && [ -n "${HUSKY_CONSUMER_HOOKS:-}" ]; then
      # The rest passed, but a kept hook is not the framework's shield: never «shields wired».
      echo "  · shields-up: the rest passed; your own hook(s)${HUSKY_CONSUMER_HOOKS} kept and not checked (see NOT wired below)"
      _isv_skip "shields-up (your own hooks kept)"
    elif [ "$_su_rc" -eq 0 ]; then
      _ISV_PASS=$((_ISV_PASS+1))
    elif [ "$_su_rc" -eq "$_ISV_SKIP_RC" ]; then
      echo "  · shields-up: ran, but checked nothing (not a git repository?) — skipped"
      _isv_skip "shields-up (checked nothing)"
    else
      _ISV_FAIL=$((_ISV_FAIL+1))
      echo "  ✗ shields-up FAILED — Husky hooks not fully wired (see above)"
    fi
  else
    echo "  · shields-up: script not found at $_SU_SCRIPT — skipped"
    _isv_skip "shields-up"
  fi

  # D5: mutation gate (install-time, framework-side — not shipped to consumer)
  _MUT_SCRIPT="$PKG_ROOT/packages/core/audit-self/check-generated-rule-mutation.sh"
  if [ -x "$_MUT_SCRIPT" ]; then
    GETFF_SKIP_RC=$_ISV_SKIP_RC AIF_PROJECT_ROOT="$PROJECT_ROOT" bash "$_MUT_SCRIPT" "$PROJECT_ROOT" && _mut_rc=0 || _mut_rc=$?
    if [ "$_mut_rc" -eq 0 ]; then
      _ISV_PASS=$((_ISV_PASS+1))
    elif [ "$_mut_rc" -eq "$_ISV_SKIP_RC" ]; then
      echo "  · generated-rule-mutation: ran, but no generated rule was tested — skipped"
      _isv_skip "generated-rule-mutation (no rule tested)"
    else
      _ISV_FAIL=$((_ISV_FAIL+1))
      echo "  ✗ generated-rule-mutation FAILED — some generated tests are selector-blind (theatre)"
    fi
  else
    echo "  · generated-rule-mutation: script not at $_MUT_SCRIPT — skipped"
    _isv_skip "generated-rule-mutation"
  fi

  echo ""
  if [ "$_ISV_FAIL" -gt 0 ]; then
    _isv_fail_tail=""
    [ "$_ISV_SKIP" -gt 0 ] && _isv_fail_tail=", $_ISV_SKIP skipped"
    echo "⚠  self-verify: $_ISV_PASS/3 passed, $_ISV_FAIL FAILED$_isv_fail_tail — review output above before committing"
  elif [ "$_ISV_SKIP" -gt 0 ]; then
    # No failures, but ≥1 check never ran — DO NOT claim the three properties. Skipped checks
    # are unproven, not proven-good.
    echo "⚠  self-verify: ✓ $_ISV_PASS passed · ⚠ $_ISV_SKIP skipped ($_ISV_SKIPPED_NAMES) — skipped checks are NOT proven"
  else
    # "shields WIRED (form)", not "active": the D2 pass comes from check-shields-up.sh, a
    # form-only check (hook present + references its dispatcher) that never RUNS the hook —
    # the capstone must not upgrade a form verdict into a behavioural claim (same P0.4 class
    # the leaf script already fixed; behavioural push probe is the planned P1.2 gate).
    echo "✓ self-verify: $_ISV_PASS/3 checks passed — fences fire, shields wired (form check), generated tests non-vacuous"
  fi
fi

# ─── Done ───────────────────────────────────────────────
if [ "${#NOT_WIRED[@]}" -gt 0 ]; then
  echo ""
  echo "⚠  ${#NOT_WIRED[@]} framework piece(s) NOT wired, or wired only in part — each line says why and what to do:"
  printf '      - %s\n' "${NOT_WIRED[@]}"
  echo ""
fi
if [ ${#SKIPPED[@]} -gt 0 ]; then
  echo ""
  echo "⚠  ${#SKIPPED[@]} files were skipped because they already exist."
  echo "    Your project may now have a configuration that diverges from the framework's expectations."
  echo "    To overwrite them: re-run with --force"
  echo "    To preview what would change: re-run with --dry-run --force"
  echo "    Skipped paths:"
  printf '      - %s\n' "${SKIPPED[@]}"
  echo ""
fi

# GH #974: a --full install that FAILED to land its dependencies (e.g. pnpm
# `trustPolicy: no-downgrade` aborting the devdep batch — #974's trust-downgrade case, or any
# PM hiccup) must NOT print an unqualified "✅ Installation complete". The install CLAIMED to
# deliver a usable ESLint/test toolchain but did not — a silent rc0 there is the exact
# form-over-behaviour false-green the project exists to prevent. `--full` is the only mode that
# promises deps (FULL set ⇒ deps were attempted); DEPS_INSTALLED=1 iff BOTH dev + runtime deps
# landed (70-deps.sh). So FULL-set + DEPS_INSTALLED≠1 = an honestly-degraded install → downgrade
# the banner AND exit non-zero so automation/CI sees the failure, not a green install.
_deps_incomplete=""
if [ -n "${FULL:-}" ] && [ "${DEPS_INSTALLED:-}" != "1" ] && [ "$DRY_RUN" != "--dry-run" ]; then
  _deps_incomplete=1
fi

echo ""
if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "✅ Dry-run complete. Nothing was written."
elif [ -n "$_deps_incomplete" ]; then
  echo "⚠  Installation finished, but dependencies did NOT fully install — the shipped ESLint/test"
  echo "    toolchain is not usable yet. This is NOT a full success (see step 4 below to complete it,"
  echo "    or re-run \`./install.sh ${STACK:-ts-server} --full\`). Exiting non-zero so this is not"
  echo "    mistaken for a green install."
elif [ "${_ISV_FAIL:-0}" -gt 0 ]; then
  # critical-review S4-8: a failed self-verify used to end here as «complete», rc 0 — so
  # `npx getff init -y` in CI or from an agent read green while a shipped rule stayed silent.
  echo "⚠  Installation finished, but self-verify FAILED ($_ISV_FAIL check(s), output above) — this"
  echo "    is NOT a full success. Exiting non-zero so this is not mistaken for a green install."
else
  echo "✅ Installation complete."
fi
echo ""
echo "Next steps:"
echo "  1. Review/edit the generated .ai-factory/DESCRIPTION.md (project domain, stack, constraints)"
echo "  2. Review/edit the generated .ai-factory/ARCHITECTURE.md (layer structure, dependency direction)"
echo "  3. Edit AGENTS.md placeholders to match your project"
if [ "${DEPS_INSTALLED:-}" = "1" ]; then
  echo "  4. ✓ Dev + runtime dependencies installed into node_modules/ — nothing to do."
else
  # step 4 fallback: the manual dep-install (run only when --full/[y/N] consent was not given, or
  # the install ran but didn't fully succeed). Built from the SAME DEVDEPS/RUNTIME_DEPS arrays the
  # installer uses (setup.d/70-deps.sh) → the list cannot drift from what we install (#two-prompts-drift).
  # The npm arm mirrors §8's $NPM_PEER_FLAG (react-native a11y-peer ERESOLVE workaround, set in
  # 70-deps.sh) for the same reason: a copy-pasted RN command without it aborts on the very
  # ERESOLVE the automated install avoids. `:+` expansion keeps set -u safety + no trailing space.
  case "$(detect_pm)" in
    pnpm) _add="pnpm add -D"; _add_rt="pnpm add" ;;
    yarn) _add="yarn add -D"; _add_rt="yarn add" ;;
    *)    _add="npm install --save-dev${NPM_PEER_FLAG:+ $NPM_PEER_FLAG}"; _add_rt="npm install${NPM_PEER_FLAG:+ $NPM_PEER_FLAG}" ;;
  esac
  echo "  4. Install dependencies (or re-run: ./install.sh ${STACK:-ts-server} --full):"
  echo ""
  # `[*]-` (default-empty) = bash-3.2-safe under set -u when the array is empty/unset (macOS
  # ships 3.2); non-empty output is byte-identical. Real installs always reach here with both
  # arrays populated by 70-deps.sh — the guard covers minimal-scope sourcing (layer-units test).
  echo "     $_add \\"
  printf '       %s\n' "${DEVDEPS[*]-}"
  echo ""
  echo "     $_add_rt \\"
  printf '       %s\n' "${RUNTIME_DEPS[*]-}"
fi
if [ "${HUSKY_HOOKSPATH_OWNED:-1}" = "0" ] && [ "$(git -C "$PROJECT_ROOT" config --get core.hooksPath 2>/dev/null || true)" != ".husky/_" ]; then
  echo "  5. Git hooks: NOT activated — the NOT wired list above says why and gives the command"
else
  echo "  5. Verify git hooks: 'git config core.hooksPath' should print .husky (install activated it; do NOT run 'npx husky init' — it would clobber the shipped .husky/pre-commit + pre-push)"
fi
echo "  6. Run: ./scripts/audit-ai-docs.sh — should PASS"
echo "  7. Run: npm run validate"
echo ""
echo "For full guide: see INSTALL.md"

# GH #974: honest non-zero exit on a --full install whose deps did not fully land (banner above
# already said so). The dispatcher sources this file last, so this is install.sh's final rc.
if [ -n "${_deps_incomplete:-}" ] || [ "${_ISV_FAIL:-0}" -gt 0 ]; then
  exit 1
fi
