#!/usr/bin/env bash
# setup.d/eslint-wire.sh — the ESLint wiring passes of an install, as functions --refresh runs too.
#
# Sources: lib.sh (already in scope). Not a numbered layer: install.sh sources setup.d/[0-9]*.sh only,
# so this file runs nothing when sourced — it defines three functions:
#   eslint_wire_r2_root     §6b-bis: read the repo for HTTP boundary code; add its globs to getff's own
#                           root config (sets _r2_verdict, _r2_own_globs)        — called by 60-ci.sh
#   eslint_wire_synth       synth-wire (root) + #827 B3 per-workspace live-research — called by 99-finalize.sh
#   eslint_wire_r2_configs  R2 Layer 2 (per-package) + per-workspace R2           — called by 99-finalize.sh
# and install.sh do_refresh calls all three in that order.
#
# Why functions (refresh sweep 2026-09-29, G4): this wiring ran on the install path only, so every fix
# to it (R2 reaching react-next / react-spa workspace configs, #1881; the customRules import, #1884)
# reached fresh installs and never a project installed before the fix. --refresh now runs the same
# code — additions only, the consumer's original kept at .ai-factory/before-getff/ whenever a write
# changes a config getff does not own, and every piece that cannot land named in NOT wired (Q4.7).
#
# The bodies keep the top-level indentation they had in 60-ci.sh / 99-finalize.sh, so
# `git diff --color-moved` shows them as moved verbatim; each is plain top-level code (no local, no
# return) whose variables stay global exactly as they were for the layers that read them later
# (_r2_verdict, _r2_own_globs, _root_eslint, ESLINT_ROOT_NOT_WIRED, _f11_check).
#
# _GETFF_RUN names the run in a message that speaks of what THIS run did or found («this install did
# not put ts-morph in node_modules»): unset = an install; do_refresh sets it to «this --refresh».
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone

eslint_wire_r2_root() {
# ─── 6b-bis. GH #547 Point 2: auto-wire R2 by reading the repo ───────────────
# Classify the consumer's layout (C1) and configure R2 enforcement so the shipped check:globs gate
# is green-because-understood, never red-because-unconfigured. Here we only patch the ROOT
# eslint.config.mjs getff placed and nobody has edited since (whose own comment invites editing
# RULE_GLOBS), additively + idempotently. A root config the consumer owns (an eslint.config.mjs
# copy_safe kept, or an eslint.config.js — the name ESLint loads first), or one getff placed that
# the consumer has edited since, is not patched here: the boundary globs go to 99-finalize in
# _r2_own_globs, whose own-config pass adds what R2 lacks there in the same write as the rest of
# getff's block, keeping the original, or names in the NOT wired summary what it could not add and
# why (operator decision Q4.7, 2026-09-28).
# rc=0 on every branch (a crash here must never abort install — lesson GH #531/#544).
_r2_root_cfg=$(eslint_flat_config "$PROJECT_ROOT")
_r2_own_globs=""
# _r2_glob_fail_why — why a glob did not go into getff's own eslint.config.mjs: the insert below needs
# a `boundary: [` line in the config's code (not in a comment), so with that line there it was the
# write that failed.
_r2_glob_fail_why() {
  if grep -qE '^[[:space:]]*boundary:[[:space:]]*\[' <<<"$(eslint_config_code "$PROJECT_ROOT/eslint.config.mjs")"; then
    echo "the write failed"
  else
    echo "getff's eslint.config.mjs has no \`boundary: [\` array"
  fi
}
if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "▶ R2 auto-wire → [dry-run] would classify the repo and patch RULE_GLOBS / record R2 N/A as warranted"
elif [ "$_r2_root_cfg" = eslint.config.mjs ] || [ "$_r2_root_cfg" = eslint.config.js ]; then
  echo "▶ R2 auto-wire (reading the repo)"
  _r2_out="$( cd "$PROJECT_ROOT" && bash "$PKG_ROOT/packages/core/audit-self/detect-r2-boundary.sh" 2>/dev/null )"
  # The first line by expansion, not `printf | head -1`: head exits after one line, printf's next
  # write gets EPIPE, and under set -e that aborted the install (post-merge CI 2026-09-29).
  _r2_verdict="${_r2_out%%$'\n'*}"
  _dec="$PROJECT_ROOT/.ai-factory/tool-decisions.md"
  # _r2_na_strip — drop the aif:r2-na block (and the blank line before it) from tool-decisions.md,
  # keeping every other line.
  # rc 1 on an awk/write failure, or on a begin line with no end line after it — the skip would run
  # to the end of the file and cut the consumer's own lines (the file is left as it was).
  _r2_na_strip() {
    awk '/<!-- aif:r2-na:begin -->/{open=1} open&&/<!-- aif:r2-na:end -->/{open=0} END{exit open}' "$_dec" || return 1
    # The blank line the append writes before the block goes with it — else each re-record (every
    # --refresh of a declarative layout) leaves one more blank line behind.
    if awk 'skip { if (/<!-- aif:r2-na:end -->/) skip = 0; next }
            /<!-- aif:r2-na:begin -->/ { hb = 0; skip = 1; next }
            { if (hb) print ""; hb = 0 }
            /^$/ { hb = 1; next }
            { print }
            END { if (hb) print "" }' "$_dec" > "$_dec.tmp" && mv "$_dec.tmp" "$_dec"; then
      return 0
    fi
    rm -f "$_dec.tmp" 2>/dev/null || true
    return 1
  }
  # A recorded N/A holds only while the layout stays no-boundary-confident — the gates read any
  # other verdict as a broken precondition (r2-na-marker.sh r2_na_recheck) and fail «marked N/A» on
  # every push. A re-install that finds a boundary (or a layout it cannot call) drops the block it
  # recorded, so the gates judge the wired globs instead of a decision that no longer holds.
  if [ "$_r2_verdict" != "no-boundary-confident" ] && [ -f "$_dec" ] && grep -qF '<!-- aif:r2-na:begin -->' "$_dec"; then
    if _r2_na_strip; then
      echo "  ✓ the layout no longer qualifies for the R2 N/A recorded earlier → removed the R2 N/A block from .ai-factory/tool-decisions.md"
    else
      echo "  ⚠ could not remove the stale R2 N/A block from $_dec (no end line, or a write failure) — left unchanged; scripts/check-rule-globs.sh fails «marked N/A» until it is gone (see NOT wired below)" >&2
      note_not_wired "R2 N/A record in .ai-factory/tool-decisions.md — the layout now has an HTTP boundary (or one the install cannot rule out), but the recorded N/A block could not be removed (it has no end line, or the write failed), so the file is left as it is; scripts/check-rule-globs.sh and scripts/check-rule-enforced.sh fail on it"
    fi
  fi
  case "$_r2_verdict" in
    boundary-present)
      _patched=0
      _r2_glob_failed=0
      # Only getff's own config is patched here. A config the consumer owns gets RULE_GLOBS and R2
      # from 99-finalize (_r2_own_globs), for the stacks whose preset ships R2.
      _r2_own_cfg=0
      _r2_no_slot=0
      # Globs written into a config that still holds getff's bytes are getff's too: staged again
      # below, so the next install does not read getff's own write as the consumer's edit.
      _r2_root_intact=""
      if getff_bytes_intact "$PROJECT_ROOT/eslint.config.mjs"; then _r2_root_intact=1; fi
      # A config getff placed is getff's only while its bytes are still the ones getff left — the
      # test 99-finalize's synth-wire uses. One the consumer has edited since is theirs: its globs go
      # to the own-config pass too, which keeps the edited original before it inserts them.
      _r2_root_edited=""
      if getff_delivered "$PROJECT_ROOT/$_r2_root_cfg" && ! getff_bytes_intact "$PROJECT_ROOT/$_r2_root_cfg"; then
        _r2_root_edited=1
      fi
      if ! getff_delivered "$PROJECT_ROOT/$_r2_root_cfg" || [ -n "$_r2_root_edited" ]; then
        _r2_own_cfg=1
        case "${STACK:-ts-server}" in
          ts-server|react-next|react-spa) _r2_own_globs=$(printf '%s\n' "$_r2_out" | sed -n 's/^glob://p') ;;
        esac
        _r2_out=""   # no glob lines → the patch loop below writes nothing
      elif ! grep -q 'RULE_GLOBS' <<<"$(eslint_config_code "$PROJECT_ROOT/eslint.config.mjs")"; then
        # getff's config for this stack has no RULE_GLOBS block at all (react-native: its preset
        # ships no R2; any other stack: the block was edited away) — there is no boundary array to
        # widen, so no per-glob warning either; the summary line below says which. Read as code:
        # RULE_GLOBS named only in a comment is no block (#1889 observation 7).
        _r2_no_slot=1
        _r2_out=""
      fi
      while IFS= read -r _line; do
        case "$_line" in glob:*) ;; *) continue ;; esac
        _g="${_line#glob:}"
        # The glob goes in as a single-quoted JS string: escape `\` and `'` (a directory name may hold
        # an apostrophe), and hand it to awk through ENVIRON — `-v` would undo the escapes.
        _r2_ins="    '$(printf '%s' "$_g" | sed -e 's/\\/\\\\/g' -e "s/'/\\\\'/g")',"
        # Already covered = an element of RULE_GLOBS.boundary, never a substring anywhere in the file:
        # R8's `application:` key carries '**/application/**/*.{ts,tsx}', the very glob a parse site
        # in src/application/ yields, and that match used to keep it out of the boundary array.
        _r2_bnd=$(rule_globs_boundary "$PROJECT_ROOT/eslint.config.mjs")
        if [ "$(printf '%s\n' "$_r2_bnd" | sed -n '1p')" = array ]; then
          grep -qxF -- "$_g" <<<"$(sed -n '2,$p' <<<"$_r2_bnd")" && continue
        else
          # That read answers `none` / `no-array` (RULE_GLOBS re-wrapped in a cast, say) while the
          # insert below still finds a `boundary: [` line: covered there = the very line it would
          # write, inside that array — or every re-install adds the glob again.
          grep -qxF -- "${_r2_ins#    }" <<<"$(awk -v sq="'" -v dq='"' "$ESLINT_UNCOMMENT_AWK"'!on && uncomment($0) ~ /^[[:space:]]*boundary:[[:space:]]*\[/{on=1; next} on && /^[[:space:]]*\]/{exit} on{sub(/^[[:space:]]+/, ""); print}' \
            "$PROJECT_ROOT/eslint.config.mjs")" && continue
        fi
        # ledger A1-9 (the A1-8 class): the counter used to be incremented unconditionally, so a
        # failed awk/redirect still produced "✓ added N glob(s)" over an untouched config plus a
        # stale eslint.config.mjs.tmp.
        # `! cmp -s`: a config with no `boundary: [` line comes back unchanged — that is a glob
        # NOT added, never a «✓ added».
        # The array is found in the config's code: a `boundary: [` inside a comment is not the one
        # the rule reads, and a glob put there would be «added» again on every install.
        if _r2_ins="$_r2_ins" awk -v sq="'" -v dq='"' "$ESLINT_UNCOMMENT_AWK"'
          done2!=1 && uncomment($0) ~ /^[[:space:]]*boundary:[[:space:]]*\[/ { print; print ENVIRON["_r2_ins"]; done2=1; next }
          { print }
        ' "$PROJECT_ROOT/eslint.config.mjs" > "$PROJECT_ROOT/eslint.config.mjs.tmp" \
          && ! cmp -s "$PROJECT_ROOT/eslint.config.mjs.tmp" "$PROJECT_ROOT/eslint.config.mjs" \
          && mv "$PROJECT_ROOT/eslint.config.mjs.tmp" "$PROJECT_ROOT/eslint.config.mjs"; then
          _patched=$((_patched + 1))
        else
          rm -f "$PROJECT_ROOT/eslint.config.mjs.tmp" 2>/dev/null || true
          _r2_glob_failed=$((_r2_glob_failed + 1))
          echo "  ⚠ could not add glob $_g to RULE_GLOBS.boundary ($(_r2_glob_fail_why)) — eslint.config.mjs left unchanged" >&2
        fi
      done <<EOF
$_r2_out
EOF
      if [ "$_patched" -gt 0 ] && [ -n "$_r2_root_intact" ]; then
        refresh_baseline_stage "$PROJECT_ROOT/eslint.config.mjs"
      fi
      if [ -n "$_r2_root_edited" ] && [ -n "$_r2_own_globs" ]; then
        echo "  · HTTP boundary detected — getff placed $_r2_root_cfg, and it has been edited since, so it is treated as your own config; what R2 lacks there is added with the rest of getff's block at the end of the install, or listed under NOT wired with the reason"
      elif [ "$_r2_own_cfg" = "1" ] && [ -n "$_r2_own_globs" ]; then
        echo "  · HTTP boundary detected — $_r2_root_cfg is your own config; getff adds RULE_GLOBS and R2 to it at the end of the install, or lists them under NOT wired with the reason"
      elif [ "$_r2_own_cfg" = "1" ] || { [ "$_r2_no_slot" = "1" ] && [ "${STACK:-ts-server}" = react-native ]; }; then
        # react-native only: a boundary-present verdict always carries glob lines, which an own config
        # keeps for every other stack (above), so an own config left with none is react-native's.
        if [ "$_r2_own_cfg" = "1" ]; then
          echo "  · HTTP boundary detected, but the ${STACK:-ts-server} preset ships no R2 — nothing to add to your $_r2_root_cfg"
        else
          echo "  · HTTP boundary detected, but this stack's eslint.config.mjs has no RULE_GLOBS block — its preset ships no R2, so there is nothing to widen"
        fi
        # Q4.7: boundary code R2 does not check is a gap (the preset's RULES.md lists R2 for every
        # stack), so the NOT wired summary names it — unless the config already names R2 itself.
        grep -qF -e "'rules-as-tests/no-unsafe-zod-parse'" -e '"rules-as-tests/no-unsafe-zod-parse"' \
             "$PROJECT_ROOT/$_r2_root_cfg" 2>/dev/null \
          || note_not_wired "R2 (rules-as-tests/no-unsafe-zod-parse) in $_r2_root_cfg — getff's ${STACK:-ts-server} preset ships no R2, so the install adds it to no config; R2 does not check the HTTP boundary code it found through $_r2_root_cfg"
      elif [ "$_r2_no_slot" = "1" ]; then
        # getff's config for a stack whose preset ships R2, with its RULE_GLOBS block edited away:
        # there is no boundary array to add the globs to, and the reason is that edit, not the preset.
        echo "  ⚠ HTTP boundary detected, but getff's eslint.config.mjs has no RULE_GLOBS block any more — R2 does not cover that code yet (see NOT wired below)" >&2
        note_not_wired "R2 boundary globs in eslint.config.mjs — the globs for the HTTP boundary code the install found were not added: getff's eslint.config.mjs has no RULE_GLOBS block any more (edited since getff placed it); the file is left as it is"
      elif [ "$_patched" -gt 0 ]; then
        echo "  ✓ HTTP boundary detected → added $_patched glob(s) to RULE_GLOBS.boundary in eslint.config.mjs so R2 covers it"
      elif [ "$_r2_glob_failed" -gt 0 ]; then
        # Q4.7 (2026-09-28): what is not wired goes to the NOT-wired summary with its reason, never
        # as a manual step (cold-review F5b — this used to say «widen RULE_GLOBS.boundary by hand»).
        echo "  ⚠ HTTP boundary detected but $_r2_glob_failed glob(s) could not be written — R2 does not cover that code yet (see NOT wired below)" >&2
        note_not_wired "R2 boundary globs in RULE_GLOBS.boundary of eslint.config.mjs — $_r2_glob_failed glob(s) for the HTTP boundary code the install found were not added: $(_r2_glob_fail_why); the file is left as it is"
      else
        echo "  ✓ HTTP boundary detected → already covered by the default RULE_GLOBS.boundary (no change)"
      fi ;;
    no-boundary-confident)
      if [ -f "$_dec" ]; then
        # ledger A1-9 (the A1-8 class): a failed awk/redirect skipped the mv, so the OLD R2 N/A block
        # survived — and the append below then wrote a SECOND one, leaving the consumer with a
        # duplicated fenced block under a ✓. Refusing the whole record is the only honest outcome.
        _r2_strip_ok=1
        if grep -qF '<!-- aif:r2-na:begin -->' "$_dec"; then   # replace existing block (idempotent re-install)
          _r2_na_strip || _r2_strip_ok=0
        fi
        if [ "$_r2_strip_ok" = "0" ]; then
          echo "  ⚠ could not replace the previous R2 N/A block in $_dec (no end line, or a write failure) — left unchanged, no record appended (appending would duplicate the block)" >&2
        else
        {
          echo ""
          echo "<!-- aif:r2-na:begin -->"
          echo "### R2 (no-unsafe-zod-parse) — N/A for this layout (auto-recorded by install.sh)"
          echo "**Verdict:** N/A — validation is declarative (allowlisted framework); no manual \`.parse()\` HTTP boundary detected."
          echo "**Precondition (re-checked by check:globs / check:enforced via scripts/detect-r2-boundary.sh):**"
          echo "- no file matches RULE_GLOBS.boundary tokens, AND"
          echo "- no \`.safeParse(\` and no non-stdlib \`.parse(\` in non-test source."
          echo "**If this precondition breaks** (you add a hand-rolled parse boundary) the gate goes RED again — wire R2 (widen RULE_GLOBS.boundary) or update this decision."
          echo "<!-- aif:r2-na:end -->"
        } >> "$_dec"
        echo "  ✓ declarative validation, no manual-parse boundary → recorded a re-checkable R2 N/A in .ai-factory/tool-decisions.md"
        fi
      else
        echo "  · declarative validation detected, but .ai-factory/ absent → skipped R2 N/A record (gate behaviour unchanged)"
      fi ;;
    *)
      # NB: say "scripts/check-rule-globs.sh" (hyphen), NOT the colon-form "check:globs" — the colon
      # form is reserved for the CI-orphan WARN's missing-gate list (r2-glob-reach asserts per-gate accuracy).
      # Whose config it is: the test of the boundary-present branch above.
      if getff_delivered "$PROJECT_ROOT/$_r2_root_cfg" && getff_bytes_intact "$PROJECT_ROOT/$_r2_root_cfg"; then
        echo "  · R2 boundary layout ambiguous → RULE_GLOBS.boundary in eslint.config.mjs keeps its default globs; scripts/check-rule-globs.sh fails, naming them, if they match no source file"
      elif getff_delivered "$PROJECT_ROOT/$_r2_root_cfg"; then
        echo "  · R2 boundary layout ambiguous → getff placed $_r2_root_cfg, and it has been edited since, so it is left as it is; once the install finds an HTTP boundary (handlers/, routes/, controllers/, app/api/, actions/, or a zod .parse() call) it adds what R2 lacks there, or lists it under NOT wired"
      else
        echo "  · R2 boundary layout ambiguous → no R2 added to your own $_r2_root_cfg; the install adds it once it finds an HTTP boundary (handlers/, routes/, controllers/, app/api/, actions/, or a zod .parse() call)"
      fi ;;
  esac
elif [ -n "$_r2_root_cfg" ] && [ -z "$(_detect_stacks_per_workspace "$PROJECT_ROOT")" ]; then
  # A flat repo whose own root config is an eslint.config.cjs / .ts / .mts / .cts: getff adds its
  # block, R2 with it, only to an eslint.config.mjs or an ES-module eslint.config.js (99-finalize
  # leaves this one as it is). copy_unless_foreign already named «getff's rules» as not wired; HTTP
  # boundary code the install can see gets its own line, naming R2 and the globs it would cover
  # (Q4.7), unless the config already sets R2 as a quoted rule id in its code — a comment naming it is
  # not R2 (eslint_config_code, #1889 observation 7). Flat repos only: a monorepo's R2 goes through
  # 99-finalize's per-workspace pass, which does not report an own .ts/.cjs workspace config yet.
  _r2_out="$( cd "$PROJECT_ROOT" && bash "$PKG_ROOT/packages/core/audit-self/detect-r2-boundary.sh" 2>/dev/null )"
  # Each glob quoted, as in RULE_GLOBS: a glob holds commas of its own (`*.{ts,tsx}`).
  _r2_globs=$(printf '%s\n' "$_r2_out" | sed -n "s/^glob:\(.*\)/'\1'/p" | paste -sd ',' - | sed "s/','/', '/g")
  if [ "$(printf '%s\n' "$_r2_out" | head -1)" = boundary-present ] && [ -n "$_r2_globs" ] \
     && ! grep -qF -e "'rules-as-tests/no-unsafe-zod-parse'" -e '"rules-as-tests/no-unsafe-zod-parse"' \
          <<<"$(eslint_config_code "$PROJECT_ROOT/$_r2_root_cfg")"; then
    case "${STACK:-ts-server}" in
      ts-server|react-next|react-spa) _r2_why="getff adds R2 only to an eslint.config.mjs or an ES-module eslint.config.js, so your $_r2_root_cfg is left as it is" ;;
      *) _r2_why="the ${STACK:-} preset ships no R2, and getff does not change your $_r2_root_cfg" ;;
    esac
    echo "▶ R2 auto-wire: HTTP boundary code found, but R2 is not added to your $_r2_root_cfg (see NOT wired below)"
    note_not_wired "R2 (rules-as-tests/no-unsafe-zod-parse) in $_r2_root_cfg — $_r2_why; the install found HTTP boundary code, and R2 does not check it (R2 would cover it through the boundary globs $_r2_globs)"
  fi
fi
}

eslint_wire_synth() {
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
#
# A config getff placed is getff's only while its bytes are still the ones getff left
# (getff_bytes_intact, setup.d/lib.sh). One the consumer has edited since takes the own-config
# branch too: its content is theirs, and the AST writer of getff's branch re-prints the list it
# appends to — a comment on the consumer's last entry swallowed the new blocks, so the rule never
# reached ESLint. A write on getff's branch stages the config again (refresh_baseline_stage), so the
# bytes it leaves are read as getff's on the next install too. 60-ci reads a root config the same
# way: an edited one gets its boundary globs here, in _r2_own_globs, after its original is kept — or,
# on an install where the wirer cannot run, a not-wired line naming what R2 lacks there.
_synth_live_snippet="$PROJECT_ROOT/.ai-factory/synthesizer-output/eslint-rules-snippet.json"
# _ts_morph_why <it|this|them> — the not-wired reason when ts-morph is not in node_modules. On a --full
# install its dev-dependency step was to put it there, so re-running with --full is no remedy; the
# step's output above says why it did not.
_ts_morph_why() {
  if [ -n "${REFRESH:-}" ]; then
    echo "adding $1 needs ts-morph, which is not in node_modules, and --refresh installs no dependencies"
  elif [ -n "${FULL:-}" ]; then
    echo "adding $1 needs ts-morph, which this --full install's dev-dependency step did not put in node_modules (its output is above)"
  else
    echo "adding $1 needs ts-morph, which only a --full install puts in node_modules, and this install was not --full"
  fi
}
# _getff_rules_in <rel-cfg> — exit 0 IFF the stack's rules and the live snippet's are all in <rel-cfg>
# already: getff's wirer on getff's branch, as a dry-run — a string check that needs no ts-morph and
# writes nothing. Any other answer, or a wirer that cannot run, is a «no».
_getff_rules_in() {
  local out
  out=$( cd "$PROJECT_ROOT" && AIF_SYNTH_PKG_ROOT="$PKG_ROOT/packages/core" \
      node "$PKG_ROOT/packages/core/install/synth-and-wire.bundle.mjs" \
        --stack "${STACK:-ts-server}" --path "$PROJECT_ROOT/$1" --dry-run 2>&1 ) || return 1
  case "$out" in *"all synthesized rules already present in"*|*"synthesizer emitted no rules"*) return 0 ;; esac
  return 1
}
# What the own-config wirer does with R2 for the HTTP boundary 60-ci found (_r2_own_globs) — the
# decisions of wireOwnConfig (packages/core/install/wire-eslint-r2.ts), on the config as it reads it
# (rule_globs_boundary, setup.d/lib.sh) — for the not-wired line of an install where that wirer
# cannot run. _getff_rules_in does not look at R2 at all. The refusal is the wirer's own note, word
# for word, so both routes print the same line.
_R2_OWN_REFUSAL="R2 — the config declares its own RULE_GLOBS with no boundary array, and getff does not redefine it; scripts/check-rule-globs.sh fails on this config without RULE_GLOBS.boundary"
# _r2_own_refused <rel-cfg> — exit 0 IFF the wirer refuses R2 in <rel-cfg>: it declares RULE_GLOBS
# with no boundary array. ts-morph or Node would change nothing there.
_r2_own_refused() {
  [ -n "${_r2_own_globs:-}" ] || return 1
  [ "$(rule_globs_boundary "$PROJECT_ROOT/$1" | sed -n 1p)" = no-array ]
}
# _r2_own_gap <rel-cfg> — what the wirer would add to <rel-cfg> for R2, worded for a not-wired line;
# nothing when it would add nothing: every glob is an element of RULE_GLOBS.boundary and R2 is
# registered, or it refuses. R2 registered with no RULE_GLOBS gets RULE_GLOBS alone (the wirer leaves
# R2 as the config sets it: operator decision 2026-09-29).
_r2_own_gap() {
  local cfg="$PROJECT_ROOT/$1" have g missing="" r2="" code
  [ -n "${_r2_own_globs:-}" ] || return 0
  have=$(rule_globs_boundary "$cfg")
  # The rule id as a string or template literal outside a comment is R2 registered — what the wirer reads
  # as set (ruleSetInConfig), so the summary promises what --full would add. The config is read as
  # eslint_config_code reads it, which cuts a template literal's text: the template-literal form is made a
  # quoted string first, so a comment is cut with it in it (second cold review 2026-09-29).
  code=$(sed "s/\`rules-as-tests\/no-unsafe-zod-parse\`/'rules-as-tests\/no-unsafe-zod-parse'/g" "$cfg" 2>/dev/null \
    | awk -v sq="'" -v dq='"' "$ESLINT_UNCOMMENT_AWK"'{ print uncomment($0) }' 2>/dev/null) || code=""
  grep -qF -e "'rules-as-tests/no-unsafe-zod-parse'" -e '"rules-as-tests/no-unsafe-zod-parse"' <<<"$code" && r2=1
  case "$(printf '%s\n' "$have" | sed -n 1p)" in
    none) if [ -n "$r2" ]; then echo "RULE_GLOBS (60-ci found an HTTP boundary)"; else echo "RULE_GLOBS and R2 (60-ci found an HTTP boundary)"; fi ;;
    array)
      while IFS= read -r g; do
        [ -n "$g" ] && ! grep -qxF -- "$g" <<<"$(sed -n '2,$p' <<<"$have")" && missing="${missing:+$missing, }'$g'"
      done <<< "$_r2_own_globs"
      if [ -z "$r2" ] && [ -n "$missing" ]; then
        echo "R2 and its boundary globs $missing (RULE_GLOBS.boundary, for the HTTP boundary code 60-ci found)"
      elif [ -z "$r2" ]; then
        echo "R2 (scoped to RULE_GLOBS.boundary, for the HTTP boundary code 60-ci found)"
      elif [ -n "$missing" ]; then
        echo "R2's boundary globs $missing (RULE_GLOBS.boundary, for the HTTP boundary code 60-ci found)"
      fi ;;
  esac
  return 0
}
_root_eslint=$(eslint_flat_config "$PROJECT_ROOT")
# _root_edited=1: getff placed the root config, and the consumer has edited it since.
_root_edited=""
if [ -n "$_root_eslint" ] && getff_delivered "$PROJECT_ROOT/$_root_eslint" \
   && ! getff_bytes_intact "$PROJECT_ROOT/$_root_eslint"; then
  _root_edited=1
fi
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
   && { [ -n "$_root_edited" ] || ! getff_delivered "$PROJECT_ROOT/$_root_eslint"; }; then
  _synth_wirer="$PKG_ROOT/packages/core/install/synth-and-wire.bundle.mjs"
  [ -z "$_root_edited" ] \
    || echo "▶ synth-wire: getff placed $_root_eslint, and it has been edited since — it is treated as your own config"
  if [ "$_root_eslint" != eslint.config.js ] && [ "$_root_eslint" != eslint.config.mjs ]; then
    # copy_unless_foreign already listed it as not wired (no ES-module flat config to add to).
    echo "▶ synth-wire: $_root_eslint is your own config — getff adds its block only to an ES-module flat config (eslint.config.js or eslint.config.mjs), so it is left as it is"
  elif [ ! -f "$_synth_wirer" ]; then
    echo "  · synth-and-wire: bundle not found at $_synth_wirer — skipped"
    note_not_wired "getff's rules in $_root_eslint (your own config) — the synth-and-wire bundle is missing from this getff package ($_synth_wirer)"
  elif [ ! -f "$PROJECT_ROOT/node_modules/ts-morph/package.json" ] && [ -n "$_root_edited" ] \
       && _getff_rules_in "$_root_eslint"; then
    # Nothing can be inserted without ts-morph. getff's rules came with its template and are still in
    # the consumer's edit (as are its ignores), so what is left is R2 for an HTTP boundary 60-ci
    # found: what the wirer would add there — or its refusal, which no ts-morph would change.
    _own_gap=$(_r2_own_gap "$_root_eslint")
    if [ -z "$_own_gap" ]; then
      echo "▶ synth-wire: getff's rules are already in $_root_eslint — nothing to add"
    else
      echo "▶ synth-wire: getff's rules are already in $_root_eslint — adding what R2 lacks there needs ts-morph, which ${_GETFF_RUN:-this install} did not put in node_modules"
      note_not_wired "$_own_gap in $_root_eslint (your own config) — $(_ts_morph_why this)"
    fi
    if _r2_own_refused "$_root_eslint"; then note_not_wired "$_R2_OWN_REFUSAL ($_root_eslint)"; fi
  elif [ ! -f "$PROJECT_ROOT/node_modules/ts-morph/package.json" ]; then
    echo "▶ synth-wire: $_root_eslint is your own config — adding getff's block to it needs ts-morph, which ${_GETFF_RUN:-this install} did not put in node_modules"
    _own_what="getff's rules"
    _own_gap=$(_r2_own_gap "$_root_eslint")
    [ -z "$_own_gap" ] || _own_what="getff's rules, $_own_gap"
    note_not_wired "$_own_what in $_root_eslint (your own config) — $(_ts_morph_why them)"
    if _r2_own_refused "$_root_eslint"; then note_not_wired "$_R2_OWN_REFUSAL ($_root_eslint)"; fi
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
    if [ -n "$_own_kept" ]; then
      keep_original_mark "$PROJECT_ROOT/$_root_eslint"
      echo "  · your original $_root_eslint is kept at ${_own_kept#"$PROJECT_ROOT"/}"
      note_getff_added "$_root_eslint"
    fi
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
  # scripts/check-rule-globs.sh is asked about the consumer's own root config once every R2 pass has
  # run (F11, below). Never about an edited getff config: F11 would call it «your own config», and the
  # routing that says so is #1887's own-config pass, not F11 (#1889: the OWN post-pass keys on getff_delivered).
  [ -n "$_root_edited" ] || _f11_check=1
  # D1 below claims «fences fire» for this root config: when getff's rules did not land in it, that is
  # not this install's to claim (cold-review F8; a .cjs/.ts root sets the same in copy_unless_foreign).
  # An edited getff config still holds getff's fences, as on getff's branch before, so D1 checks it.
  # Read as code: a comment naming a rule is not the rule.
  [ -n "$_root_edited" ] || grep -q 'rules-as-tests/' <<<"$(eslint_config_code "$PROJECT_ROOT/$_root_eslint")" || ESLINT_ROOT_NOT_WIRED=1
elif ! command -v node >/dev/null 2>&1 \
     && { [ "$_root_eslint" = eslint.config.mjs ] || [ "$_root_eslint" = eslint.config.js ]; } \
     && { [ -n "$_root_edited" ] || ! getff_delivered "$PROJECT_ROOT/$_root_eslint"; }; then
  # Without Node nothing is added to a root config treated as the consumer's: every writer of the
  # own-config pass runs on Node, and so does the check for getff's rules. What R2 lacks there for an
  # HTTP boundary 60-ci found reads without Node, and 60-ci no longer writes those globs into an
  # edited getff config itself — so they are named here, or nowhere.
  [ -z "$_root_edited" ] \
    || echo "▶ synth-wire: getff placed $_root_eslint, and it has been edited since — it is treated as your own config"
  echo "▶ synth-wire: nothing is added to $_root_eslint — that needs Node, which ${_GETFF_RUN:-this install} did not find on PATH"
  _own_gap=$(_r2_own_gap "$_root_eslint")
  [ -z "$_own_gap" ] \
    || note_not_wired "$_own_gap in $_root_eslint (your own config) — adding this needs Node, which ${_GETFF_RUN:-this install} did not find on PATH"
  if _r2_own_refused "$_root_eslint"; then note_not_wired "$_R2_OWN_REFUSAL ($_root_eslint)"; fi
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
    _root_getff=""
    getff_delivered "$PROJECT_ROOT/eslint.config.mjs" && getff_bytes_intact "$PROJECT_ROOT/eslint.config.mjs" \
      && _root_getff=1
    _sw_out=$( cd "$PROJECT_ROOT" && AIF_SYNTH_PKG_ROOT="$PKG_ROOT/packages/core" \
        node "$_synth_wirer" \
          --stack "${STACK:-ts-server}" \
          --path "$PROJECT_ROOT/eslint.config.mjs" \
          ${DRY_RUN:+--dry-run} 2>&1 ) && _sw_rc=0 || _sw_rc=$?
    printf '%s\n' "$_sw_out"
    # What the wirer left in getff's intact config is getff's too (no-op under --dry-run).
    [ -z "$_root_getff" ] || refresh_baseline_stage "$PROJECT_ROOT/eslint.config.mjs"
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
# ESLint config — the one ESLint loads in each directory (eslint_flat_configs_under), so a package's
# own ES-module eslint.config.js is wired the way its own eslint.config.mjs is; an
# eslint.config.cjs/.ts is named in the not-wired summary.
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
          # A workspace config the consumer owns — or getff placed and the consumer has edited since —
          # gets the root block's treatment (Q4.7): getff's block is added by insertions only and the
          # original kept if the write changes it.
          _sw_rel="${_sw_cfg#"$PROJECT_ROOT"/}"
          case "$_sw_cfg" in
            */eslint.config.js | */eslint.config.mjs) : ;;
            *) note_eslint_config_not_esm "$(dirname "$_sw_cfg")" "$(basename "$_sw_cfg")"; continue ;;
          esac
          _sw_own=()
          _sw_snap=""
          _sw_getff=""
          if getff_delivered "$_sw_cfg"; then
            if getff_bytes_intact "$_sw_cfg"; then
              _sw_getff=1
            else
              echo "  · synth-wire (live): getff placed $_sw_rel, and it has been edited since — it is treated as your own config"
            fi
          fi
          if [ -n "$_sw_getff" ]; then
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
          [ -z "$_sw_getff" ] || refresh_baseline_stage "$_sw_cfg"   # what getff's branch left is getff's
          _sw_undone=0
          _sw_kept=$(keep_original_settle "$_sw_cfg" "$_sw_snap") || _sw_undone=1
          if [ -n "$_sw_kept" ]; then
            keep_original_mark "$_sw_cfg"
            echo "  · your original $_sw_rel is kept at ${_sw_kept#"$PROJECT_ROOT"/}"
            note_getff_added "$_sw_rel"
          fi
          if [ "$_sw_undone" = 1 ]; then
            note_not_wired "live-research rules in $_sw_rel (your own config) — its original could not be kept at .ai-factory/before-getff/, so getff's change was undone and the file is as it was"
          elif [ "$_sw_rc" -eq 3 ] && [ "${#_sw_own[@]}" -gt 0 ]; then
            while IFS= read -r _l; do
              case "$_l" in "  · not wired: "*) note_not_wired "${_l#  · not wired: } ($_sw_rel)" ;; esac
            done <<< "$_sw_out"
          elif [ "$_sw_rc" -eq 3 ]; then
            note_not_wired "live-research rules in $_sw_rel — not added (reason printed by synth-and-wire above)"
          fi
        done < <(eslint_flat_configs_under "$PROJECT_ROOT/$_sw_dir")
      done <<< "$_ws_map_synth"
    fi
  fi
fi
}

eslint_wire_r2_configs() {
# ─── 6b-bis-L2. GH #547 Layer 2: AST-wire R2 into consumer per-package configs ─
# Runs AFTER §8 dep-install so ts-morph is resolvable when --full is set.
# Option A (migration-ast Stage 4): ensure-then-use; degrade when engine absent. rc=0 on every
# branch (lesson GH #531/#544).
# Layer 1 (§6b-bis above) patches OUR eslint.config.mjs; this Layer 2 finds the per-package ESLint
# configs (eslint_flat_configs_under) and adds R2 to each through _r2_wire_cfg.
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
# getff_bytes_intact is defined in setup.d/lib.sh, the content twin of getff_delivered.
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
      refresh_baseline_stage "$cfg"   # what the wirer left in getff's intact config is getff's too
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
  case "$cfg" in
    */eslint.config.js | */eslint.config.mjs) : ;;
    *) note_eslint_config_not_esm "$dir" "$(basename "$cfg")"; return 0 ;;
  esac
  echo "  · R2: $rel is your own config — adding R2 for the HTTP boundary code under ${dir#"$PROJECT_ROOT"/} (additions only; the original is kept if anything changes)"
  snap=$(keep_original_snapshot "$cfg") || snap=""
  out=$( cd "$PROJECT_ROOT" && npx --no-install tsx "$wirer" --path "$cfg" --yes --own-config "${args[@]}" 2>&1 ) || true
  printf '%s\n' "$out"
  if ! kept=$(keep_original_settle "$cfg" "$snap"); then
    note_not_wired "R2 (rules-as-tests/no-unsafe-zod-parse) in $rel — its original could not be kept at .ai-factory/before-getff/, so getff's change was undone and the file is as it was"
    return 0
  fi
  if [ -n "$kept" ]; then
    keep_original_mark "$cfg"
    echo "  · your original $rel is kept at ${kept#"$PROJECT_ROOT"/}"
    note_getff_added "$rel"
  fi
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
# only a string literal that is exactly the rule id (_r2_named_in).
# _r2_named_in <file> — exit 0 IFF some string literal in the file, outside every comment, is exactly
# the R2 id: the wirer's reading of a config the consumer owns (ruleSetInConfig in wire-eslint-r2.ts
# — a rules key or a string literal; the id cannot be an identifier key, and a comment is neither,
# so a commented-out rule line is no rule entry, nor is the id inside a longer string).
# A single-pass lexer in awk, not a parser: it tracks `//` and `/* */` comments and '…' "…" `…`
# strings across lines and prints each literal's value, for grep to keep an exact match only. In a
# value, a `\` before a line break adds nothing; `\b \f \n \r \t \v \x \u` and `\0`-`\9` stand for a
# character the id does not hold, so that literal is not the id; any other escaped character stands
# for itself (`\/` is `/`); a template with a line break is not the id. Not lexed: regex literals,
# the code inside `${…}`, JSX text and a `#!` line — a quote there (`/'/`) puts the lexer out of
# step until the line ends (a backtick: until the next one), which can read a comment or code as a
# literal and hide a config.
# LC_ALL=C reads bytes, so a Latin-1 byte cannot stop either tool; tr first turns a NUL byte, which
# awk and grep builds read differently, into \001. split(…, "") takes a line apart once (a substr
# per character is quadratic in BWK awk). grep reads to the end (no -q): an early exit would SIGPIPE
# awk under pipefail.
_r2_named_in() {
  # shellcheck disable=SC2016  # the $ and backticks belong to the awk program and to JavaScript, not to the shell
  LC_ALL=C tr '\000' '\001' 2>/dev/null < "$1" | LC_ALL=C awk -v sq="'" '
    BEGIN { st = "code" }
    {
      n = split($0, ch, ""); i = 1; cont = 0
      while (i <= n) {
        c = ch[i]; c2 = c ch[i + 1]
        if (st == "block") { if (c2 == "*/") { st = "code"; i += 2 } else i++; continue }
        if (st == "code") {
          if (c2 == "//") break
          if (c2 == "/*") { st = "block"; i += 2; continue }
          if (c == sq || c == "\"" || c == "`") { q = c; buf = ""; skip = 0; st = "str" }
          i++; continue
        }
        if (c == "\\") {
          if (i == n || (i == n - 1 && ch[n] == "\r")) { cont = 1; break }
          d = ch[i + 1]; if (index("bfnrtvxu0123456789", d)) d = "\001"
          buf = buf d; i += 2; continue
        }
        if (c == q) { if (!skip) print buf; st = "code"; i++; continue }
        buf = buf c; i++
      }
      if (st == "str" && !cont) { if (q == "`") skip = 1; else st = "code" }
    }' 2>/dev/null | LC_ALL=C grep -Fx 'rules-as-tests/no-unsafe-zod-parse' >/dev/null
}
# _r2_named_under <dir> — exit 0 IFF some flat config under <dir>, at any depth, names R2 (the names
# ESLint loads: eslint.config.js, .mjs, .cjs, .ts, .mts or .cts — not a backup beside one; a symlink
# is read through; node_modules skipped).
_r2_named_under() {
  local f
  while IFS= read -r -d '' f; do
    _r2_named_in "$f" && return 0
  done < <(find "$1" -name node_modules -prune -o \
    \( -name eslint.config.js -o -name eslint.config.mjs -o -name eslint.config.cjs \
       -o -name eslint.config.ts -o -name eslint.config.mts -o -name eslint.config.cts \) \
    \( -type f -o -type l \) -print0 2>/dev/null)
  return 1
}
# _r2_boundary_under <abs dir> — exit 0 IFF detect-r2-boundary.sh finds HTTP boundary code under it.
_r2_boundary_under() {
  local out
  out=$(R2_DETECT_ROOT="$1" bash "$PKG_ROOT/packages/core/audit-self/detect-r2-boundary.sh" 2>/dev/null) || out=""
  # Parameter expansion and a here-string, not `printf | head -1` / `printf | grep -q`: under
  # install.sh's pipefail an early-exiting reader can leave printf a pending write, printf dies of
  # SIGPIPE (141), and a real boundary reads as none (measured 1/400 under load, 2026-09-29).
  [ "${out%%$'\n'*}" = boundary-present ] && grep -q '^glob:' <<<"$out"
}
_r2_would_wire() {
  local code
  code=$(eslint_config_code "$1")
  if _r2_getff_owned "$1"; then
    ! grep -q 'rules-as-tests/no-unsafe-zod-parse' <<<"$code"
    return
  fi
  _r2_named_in "$1" && return 1
  _r2_boundary_under "$(dirname "$1")"
}
# _r2_pass_blocker <wirer> — why the pass cannot run, on stdout; empty when it can.
_r2_pass_blocker() {
  if ! command -v node >/dev/null 2>&1; then
    echo "adding it needs Node, which ${_GETFF_RUN:-this install} did not find on PATH"
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
    # An eslint.config.cjs/.ts gets no R2 with the pass running either (_r2_wire_cfg): named for that.
    case "$cfg" in
      */eslint.config.js | */eslint.config.mjs) : ;;
      *) note_eslint_config_not_esm "$(dirname "$cfg")" "$(basename "$cfg")"; continue ;;
    esac
    rel="${cfg#"$PROJECT_ROOT"/}"
    echo "  · R2: not added to $rel — $why"
    note_not_wired "R2 (rules-as-tests/no-unsafe-zod-parse) in $rel — $why"
  done
  return 0
}
if [ "${_r2_verdict:-}" = "boundary-present" ] && [ "$DRY_RUN" != "--dry-run" ] \
   && { [ "$_root_eslint" = eslint.config.mjs ] || [ "$_root_eslint" = eslint.config.js ]; }; then
  # The per-package ESLint configs — the one ESLint loads in each directory below the root
  # (eslint_flat_configs_under), not the root one, not node_modules.
  _l2_configs=()
  while IFS= read -r -d '' _cfg; do
    [ "$(dirname "$_cfg")" = "$PROJECT_ROOT" ] || _l2_configs+=("$_cfg")
  done < <(eslint_flat_configs_under "$PROJECT_ROOT")
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
# repo's own config. The react-native preset ships no R2, so there is nothing to add to one; its HTTP
# boundary code is a line in the NOT wired summary instead (Q4.7; its RULES.md lists R2 for every stack).
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
        # Every ESLint config within this workspace (eslint_flat_configs_under): the ones getff placed,
        # and one the consumer owns (40-configs.sh kept it) — _r2_wire_cfg adds R2 to that only for HTTP
        # boundary code under it, by insertions, scoped to that code.
        while IFS= read -r -d '' _ws_cfg; do
          _ws_r2_configs+=("$_ws_cfg")
        done < <(eslint_flat_configs_under "$PROJECT_ROOT/$_ws_dir")
        ;;
      unknown)
        echo "  ⚠ $_ws_dir: unknown stack — R2 not wired (re-checkable marker; not exit 1)"
        # Named in the summary only when there is HTTP boundary code under it and no config there
        # names R2 as a quoted rule id (40-configs.sh may have placed the ts-server template through
        # its root fallback; a comment naming the rule is not a rule entry — _r2_named_in).
        if _r2_boundary_under "$PROJECT_ROOT/$_ws_dir" && ! _r2_named_under "$PROJECT_ROOT/$_ws_dir"; then
          note_not_wired "R2 (rules-as-tests/no-unsafe-zod-parse) in $_ws_dir — its package.json names none of the dependencies the install reads a stack from (typescript, react, next, react-native), so the install cannot tell this workspace's stack and adds R2 only to a ts-server, react-next or react-spa one; the HTTP boundary code under $_ws_dir is not checked by R2"
        fi
        ;;
      react-native)
        # Its preset ships no R2, so nothing is added to any config here (60-ci.sh leaves a flat repo's
        # alike). HTTP boundary code under the workspace that no config there checks with R2 is one line
        # for the workspace — whether or not the pass below could run.
        if _r2_boundary_under "$PROJECT_ROOT/$_ws_dir" && ! _r2_named_under "$PROJECT_ROOT/$_ws_dir"; then
          note_not_wired "R2 (rules-as-tests/no-unsafe-zod-parse) in $_ws_dir — getff's react-native preset ships no R2, so the install adds it to no react-native config; the HTTP boundary code under $_ws_dir is not checked by R2"
        fi
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

# A workspace's own ESLint config that this install added nothing to is named, not passed over in
# silence: 40-configs places no preset beside it, and the passes above add to it only what applies
# there (the live-research rules of this install's stack, R2 for HTTP boundary code under it; with a
# root config, Layer 2 alone). An eslint.config.cjs/.ts is named where it is found
# (note_eslint_config_not_esm), and a config a line already names is not named twice.
if [ "$DRY_RUN" != "--dry-run" ]; then
  while IFS=$'\t' read -r _ow_dir _; do
    [ -n "$_ow_dir" ] || continue
    _ow_cfg=$(eslint_flat_config "$PROJECT_ROOT/$_ow_dir")
    case "$_ow_cfg" in eslint.config.js | eslint.config.mjs) : ;; *) continue ;; esac
    getff_delivered "$PROJECT_ROOT/$_ow_dir/$_ow_cfg" && continue
    eslint_config_has_getff_rules "$PROJECT_ROOT/$_ow_dir/$_ow_cfg" && continue
    _ow_named=0
    for _n in ${NOT_WIRED[@]+"${NOT_WIRED[@]}"}; do
      case "$_n" in *"$_ow_dir/$_ow_cfg"*) _ow_named=1 ;; esac
    done
    [ "$_ow_named" = 1 ] || note_not_wired "eslint: getff's rules are not in the ESLint config of $_ow_dir — your $_ow_cfg configures ESLint there, so getff placed no config of its own beside it, and ${_GETFF_RUN:-this install} added none of its rules to yours"
  done < <(_detect_stacks_per_workspace "$PROJECT_ROOT")
fi
}
