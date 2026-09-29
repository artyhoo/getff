#!/usr/bin/env bash
# setup.d/60-ci.sh — §6b .nvmrc↔CI drift WARN + §6b-bis R2 auto-wire L1 + §6c CI-orphan WARN.
#
# Sources: lib.sh (already in dispatcher scope)
# S0 rows: §6b nvmrc-ci drift (install.sh:1125-1148),
#          §6b-bis R2 L1 (install.sh:1150-1209), sets _r2_verdict global,
#          §6c CI-orphan WARN + yq auto-wire (install.sh:1211-1356)
# Depends on: 40-configs (eslint.config.mjs + .nvmrc + .github/workflows/ already written)
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone
# O8: sources detect-r2-boundary from $PKG_ROOT (not PROJECT_ROOT)
# O2: sets _r2_verdict global (read by 99-finalize for L2)

# ─── 6b. #509: .nvmrc ↔ pre-existing CI Node-version drift WARN ──────────
# Install ships .nvmrc but copy_safe does NOT overwrite an existing CI workflow. A consumer
# whose own CI hardcodes a different `node-version: NN` then gets local `nvm use` (.nvmrc) ≠ CI.
# It is the consumer's own CI — nothing is broken — so this is a non-destructive WARN only, never
# a failure. (A workflow using `node-version-file: '.nvmrc'` reads .nvmrc directly → can't drift.)
if [ "$DRY_RUN" != "--dry-run" ] && [ -f "$PROJECT_ROOT/.nvmrc" ] && [ -d "$PROJECT_ROOT/.github/workflows" ]; then
  # `|| true`: parity with the _ci_ver line below — under set -euo pipefail a SIGPIPE from
  # head closing a multi-line read (rc=141) would otherwise abort the whole install.
  _nvmrc_major=$(tr -dc '0-9.\n' < "$PROJECT_ROOT/.nvmrc" 2>/dev/null | head -1 | cut -d. -f1 || true)
  if [ -n "$_nvmrc_major" ]; then
    for _wf in "$PROJECT_ROOT/.github/workflows/"*.yml "$PROJECT_ROOT/.github/workflows/"*.yaml; do
      [ -f "$_wf" ] || continue
      # hardcoded `node-version: NN` only — `node-version-file:` has "-file" before its colon so it
      # never matches; a `${{ matrix.* }}` value yields no digit → skipped (can't compare).
      # `|| true`: under the script's `set -euo pipefail`, a no-match grep returns 1 and pipefail
      # would abort the whole install — the common case (shipped CI uses node-version-file).
      _ci_ver=$(grep -oE "node-version:[[:space:]]*['\"]?[0-9]+" "$_wf" 2>/dev/null | grep -oE "[0-9]+" | head -1 || true)
      [ -n "$_ci_ver" ] || continue
      if [ "$_ci_ver" != "$_nvmrc_major" ]; then
        echo "⚠ .nvmrc pins Node ${_nvmrc_major}.x but ${_wf#"$PROJECT_ROOT"/} hardcodes node-version: ${_ci_ver} — local 'nvm use' will differ from this CI. Align them, or switch the workflow to: node-version-file: '.nvmrc'."
      fi
    done
  fi
fi

# ─── 6b-bis. GH #547 Point 2: auto-wire R2 by reading the repo ───────────────
# Classify the consumer's layout (C1) and configure R2 enforcement so the shipped check:globs gate
# is green-because-understood, never red-because-unconfigured. Here we only patch the ROOT
# eslint.config.mjs getff placed (whose own comment invites editing RULE_GLOBS), additively +
# idempotently. A root config the consumer owns (an eslint.config.mjs copy_safe kept, or an
# eslint.config.js — the name ESLint loads first) is not patched here: the boundary globs go to
# 99-finalize in _r2_own_globs, which adds RULE_GLOBS and R2 to it with the rest of getff's block
# in one write, keeping the original (operator decision Q4.7, 2026-09-28). rc=0 on every branch (a
# crash here must never abort install — lesson GH #531/#544).
_r2_root_cfg=$(eslint_flat_config "$PROJECT_ROOT")
_r2_own_globs=""
if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "▶ R2 auto-wire → [dry-run] would classify the repo and patch RULE_GLOBS / record R2 N/A as warranted"
elif [ "$_r2_root_cfg" = eslint.config.mjs ] || [ "$_r2_root_cfg" = eslint.config.js ]; then
  echo "▶ R2 auto-wire (reading the repo)"
  _r2_out="$( cd "$PROJECT_ROOT" && bash "$PKG_ROOT/packages/core/audit-self/detect-r2-boundary.sh" 2>/dev/null )"
  _r2_verdict="$(printf '%s\n' "$_r2_out" | head -1)"
  _dec="$PROJECT_ROOT/.ai-factory/tool-decisions.md"
  # _r2_na_strip — drop the aif:r2-na block from tool-decisions.md, keeping every other line.
  # rc 1 on an awk/write failure, or on a begin line with no end line after it — the skip would run
  # to the end of the file and cut the consumer's own lines (the file is left as it was).
  _r2_na_strip() {
    awk '/<!-- aif:r2-na:begin -->/{open=1} open&&/<!-- aif:r2-na:end -->/{open=0} END{exit open}' "$_dec" || return 1
    if awk '/<!-- aif:r2-na:begin -->/{skip=1} skip&&/<!-- aif:r2-na:end -->/{skip=0;next} !skip' "$_dec" > "$_dec.tmp" && mv "$_dec.tmp" "$_dec"; then
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
      if ! getff_delivered "$PROJECT_ROOT/$_r2_root_cfg"; then
        _r2_own_cfg=1
        case "${STACK:-ts-server}" in
          ts-server|react-next|react-spa) _r2_own_globs=$(printf '%s\n' "$_r2_out" | sed -n 's/^glob://p') ;;
        esac
        _r2_out=""   # no glob lines → the patch loop below writes nothing
      elif ! grep -q 'RULE_GLOBS' "$PROJECT_ROOT/eslint.config.mjs"; then
        # getff's config for this stack has no RULE_GLOBS block at all (react-native: its preset
        # ships no R2; any other stack: the block was edited away) — there is no boundary array to
        # widen, so no per-glob warning either; the summary line below says which.
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
          printf '%s\n' "$_r2_bnd" | sed -n '2,$p' | grep -qxF -- "$_g" && continue
        else
          # That read answers `none` / `no-array` (RULE_GLOBS re-wrapped in a cast, say) while the
          # insert below still finds a `boundary: [` line: covered there = the very line it would
          # write, inside that array — or every re-install adds the glob again.
          awk '/^[[:space:]]*boundary:[[:space:]]*\[/{on=1; next} on && /^[[:space:]]*\]/{exit} on{sub(/^[[:space:]]+/, ""); print}' \
            "$PROJECT_ROOT/eslint.config.mjs" | grep -qxF -- "${_r2_ins#    }" && continue
        fi
        # ledger A1-9 (the A1-8 class): the counter used to be incremented unconditionally, so a
        # failed awk/redirect still produced "✓ added N glob(s)" over an untouched config plus a
        # stale eslint.config.mjs.tmp.
        # `! cmp -s`: a config with no `boundary: [` line comes back unchanged — that is a glob
        # NOT added, never a «✓ added».
        if _r2_ins="$_r2_ins" awk '
          done2!=1 && /^[[:space:]]*boundary:[[:space:]]*\[/ { print; print ENVIRON["_r2_ins"]; done2=1; next }
          { print }
        ' "$PROJECT_ROOT/eslint.config.mjs" > "$PROJECT_ROOT/eslint.config.mjs.tmp" \
          && ! cmp -s "$PROJECT_ROOT/eslint.config.mjs.tmp" "$PROJECT_ROOT/eslint.config.mjs" \
          && mv "$PROJECT_ROOT/eslint.config.mjs.tmp" "$PROJECT_ROOT/eslint.config.mjs"; then
          _patched=$((_patched + 1))
        else
          rm -f "$PROJECT_ROOT/eslint.config.mjs.tmp" 2>/dev/null || true
          _r2_glob_failed=$((_r2_glob_failed + 1))
          echo "  ⚠ could not add glob $_g to RULE_GLOBS.boundary (no \`boundary: [\` array, or a write failure) — eslint.config.mjs left unchanged" >&2
        fi
      done <<EOF
$_r2_out
EOF
      if [ "$_r2_own_cfg" = "1" ] && [ -n "$_r2_own_globs" ]; then
        echo "  · HTTP boundary detected — $_r2_root_cfg is your own config; getff adds RULE_GLOBS and R2 to it at the end of the install"
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
        note_not_wired "R2 boundary globs in RULE_GLOBS.boundary of eslint.config.mjs — $_r2_glob_failed glob(s) for the HTTP boundary code the install found were not added: getff's eslint.config.mjs has no RULE_GLOBS.boundary array getff can read any more (edited since getff placed it), or the write failed; the file is left as it is"
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
      if getff_delivered "$PROJECT_ROOT/$_r2_root_cfg"; then
        echo "  · R2 boundary layout ambiguous → RULE_GLOBS.boundary in eslint.config.mjs keeps its default globs; scripts/check-rule-globs.sh fails, naming them, if they match no source file"
      else
        echo "  · R2 boundary layout ambiguous → no R2 added to your own $_r2_root_cfg; the install adds it once it finds an HTTP boundary (handlers/, routes/, controllers/, app/api/, actions/, or a zod .parse() call)"
      fi ;;
  esac
fi

# ─── 6c. #507 (reopen) + #521: CI-orphan WARN — completeness across ALL enforcement gates ───
# A brownfield consumer's pre-existing ci.yml is KEPT (copy_safe skips it), so the shipped CI's
# enforcement gates run in NO CI job — only on a local `npm run validate`, which a dev must
# remember. #507 warned about the glob gate only; #521 broadens it: for EACH gate whose artifact
# is installed, if no kept workflow references it, name it (with what it enforces) and print a
# ready-to-paste step. Non-destructive (consumer owns their CI) — exit stays 0. Greenfield (install
# wrote ci.yml wiring all gates) → nothing missing → no warn. "check:globs" etc. colon forms are
# WARN-exclusive; the grep patterns also match the hyphenated script names used inside workflows.
if [ "$DRY_RUN" != "--dry-run" ] && [ -d "$PROJECT_ROOT/.github/workflows" ]; then
  _aif_missing=()
  _aif_steps=()
  _aif_cmds=()
  _aif_gate_check() { # $1 "gate — what it enforces"  $2 wired-grep  $3 installed-artifact  $4 paste-step
    [ -e "$PROJECT_ROOT/$3" ] || return 0          # gate not installed for this stack → nothing to warn
    local _wf
    for _wf in "$PROJECT_ROOT/.github/workflows/"*.yml "$PROJECT_ROOT/.github/workflows/"*.yaml; do
      [ -f "$_wf" ] || continue
      # grep inside `if` is set-e-safe (non-zero no-match is consumed by the if-test, not seen by set -e)
      if grep -qE "$2" "$_wf" 2>/dev/null; then return 0; fi   # referenced by some workflow → wired
    done
    _aif_missing+=("$1"); _aif_steps+=("$4"); _aif_cmds+=("${4#- run: }")
  }
  _aif_detect_gates() {   # (re)build the missing-set from scratch — idempotent, callable again post-wire
    _aif_missing=(); _aif_steps=(); _aif_cmds=()
    # arch:check's artifact is whichever dependency-cruiser config is on disk: ours, or the
    # consumer's own that 40-configs.sh kept (copy_unless_foreign).
    local _dc; _dc=$(depcruise_config "$PROJECT_ROOT")
    _aif_gate_check "check:globs — R2/R7/R8 ESLint-rule liveness"        'check-rule-globs\.sh|check:globs'               "scripts/check-rule-globs.sh"          "- run: bash scripts/check-rule-globs.sh"
    _aif_gate_check "check:enforced — R2 actually applied (per-pkg cfg)"  'check-rule-enforced\.sh|check:enforced'         "scripts/check-rule-enforced.sh"       "- run: bash scripts/check-rule-enforced.sh"
    _aif_gate_check "arch:check — R3 architecture boundaries"            'arch:check|depcruise'                           "${_dc:-.dependency-cruiser.mjs}"       "- run: npm run arch:check"
    _aif_gate_check "check:arch-boundaries — R3 monorepo-boundary liveness" 'check-arch-boundaries\.sh|check:arch-boundaries' "scripts/check-arch-boundaries.sh"     "- run: bash scripts/check-arch-boundaries.sh"
    _aif_gate_check "audit:docs — AI-documentation drift"               'audit:docs|audit-ai-docs\.sh'                   "scripts/audit-ai-docs.sh"             "- run: bash scripts/audit-ai-docs.sh"
    _aif_gate_check "check:lintstaged — lint-staged binaries resolve"   'check:lintstaged|check-lintstaged-resolves\.sh' "scripts/check-lintstaged-resolves.sh" "- run: bash scripts/check-lintstaged-resolves.sh"
  }
  _aif_detect_gates

  # A monorepo with workspace packages gets NO getff ci.yml: 40-configs.sh delivers it only in the
  # flat / single-root branch (since #796 wrapped the per-stack block), but still creates the directory. With no
  # workflow file there is nothing of the consumer's to keep or to wire into, so the WARN below must
  # not claim a kept workflow and the yq offer must not fire (defect seen 2026-09-28, getff#1889).
  _aif_has_wf=""
  for _wf in "$PROJECT_ROOT/.github/workflows/"*.yml "$PROJECT_ROOT/.github/workflows/"*.yaml; do
    [ -f "$_wf" ] && { _aif_has_wf=1; break; }
  done

  # ─── #521 Stage P: opt-in auto-wire (REFERENCE mikefarah/yq, detect-first) ───
  # The WARN below is the non-destructive default (writes nothing). This OPT-IN path mutates the
  # consumer's kept workflow in place, so it fires ONLY on explicit consent: --wire-ci, or an
  # interactive [y/N] (default No), mirroring the §8 dep-install prompt. yq is USED-IF-PRESENT,
  # never installed/pinned by us (companion-install-principle.md §1; BFR §1.1 shipped-axis —
  # integrate, never hard-depend). yq's comment preservation is best-effort, which is exactly why
  # it is DISQUALIFIED as the *silent* default (research-patch 2026-06-14-s3-workflow-merge §4/§6,
  # SSOT #117) — confining it behind a visible flag makes that risk the consumer's informed choice.
  # yq absent → OFFER its official installer (detect-first, unpinned, [y/N]/TTY-gated per
  # companion-install-principle.md §1/§3); declined / unavailable / install-failed → fall through to
  # the broadened WARN + paste-block unchanged.
  #
  # _aif_yq_wire — the wire-into-job logic, extracted so it is called identically whether yq was
  # present from the start or just installed via the offer below (no duplication). Requires yq on PATH.
  _aif_yq_wire() {
    # Locate the first workflow + job that owns a `steps:` sequence (the lint/test job) to append into.
    _wire_wf=""; _wire_job=""
    for _wf in "$PROJECT_ROOT/.github/workflows/"*.yml "$PROJECT_ROOT/.github/workflows/"*.yaml; do
      [ -f "$_wf" ] || continue
      _job=$(yq -r '.jobs | to_entries | map(select(.value.steps != null)) | (.[0].key // "")' "$_wf" 2>/dev/null || echo "")
      if [ -n "$_job" ] && [ "$_job" != "null" ]; then _wire_wf="$_wf"; _wire_job="$_job"; break; fi
    done
    if [ -n "$_wire_job" ]; then
      _aif_yq_ran=1
      _wired=0
      # `${arr[@]+"${arr[@]}"}` = bash-3.2-safe empty-array expansion under set -u (macOS ships 3.2).
      # _cmd is one of the 4 hard-coded gate commands (no quotes/special chars) — keep it that way:
      # it is interpolated raw into the yq double-quoted YAML string below.
      for _cmd in ${_aif_cmds[@]+"${_aif_cmds[@]}"}; do
        # idempotent append-if-absent: add then de-dup. Key on `.run // .uses // .name // .` — NOT
        # `.run` alone. Every `uses:` action step (checkout, pnpm/action-setup, setup-node …) has no
        # `.run` key, so `unique_by(.run)` groups them ALL under the same `null` key and keeps only the
        # first — silently deleting every other `uses:` step and breaking the workflow it was asked to
        # wire (GH #528). The fallback chain gives each `uses:`/`name:` step a distinct dedup key, while
        # repeated gate `run`s still collapse — so re-running install remains a no-op.
        if yq -i ".jobs.${_wire_job}.steps += [{\"run\": \"${_cmd}\"}] | .jobs.${_wire_job}.steps |= unique_by(.run // .uses // .name // .)" "$_wire_wf" 2>/dev/null; then
          _wired=$((_wired+1))
        fi
      done
      echo "  ✓ auto-wired ${_wired} gate(s) into ${_wire_wf#"$PROJECT_ROOT"/} job '${_wire_job}' via yq (idempotent — re-running install adds nothing)."
      _aif_detect_gates   # re-check: wired gates are now referenced → drop them from the WARN below
    else
      echo "  ⚠ --wire-ci: found no job with a 'steps:' list to wire into — the gates are not wired (NOT wired below)"
    fi
  }
  _aif_wire="no"; _aif_yq_ran=""
  if [ "${#_aif_missing[@]}" -gt 0 ] && [ -n "$_aif_has_wf" ]; then
    if [ -n "$WIRE_CI" ]; then _aif_wire="yes"
    elif [ -z "${FULL:-}" ] && [ -t 0 ]; then
      printf "▶ Auto-wire %s missing CI gate(s) into your workflow via yq (edits the file in place)? [y/N] " "${#_aif_missing[@]}"
      read -r _ans || _ans=""
      case "$_ans" in [yY]|[yY][eE][sS]) _aif_wire="yes" ;; esac
    fi
    if [ "$_aif_wire" = "yes" ]; then
      if command -v yq >/dev/null 2>&1; then
        _aif_yq_wire
      else
        # Option B: yq absent but consumer consented → OFFER its official installer (detect-first,
        # unpinned, official top-level command only — companion-install-principle.md §1/§3). Never
        # install a binary silently: gate on an interactive TTY (or a manual command otherwise).
        _aif_yq_inst=""
        if command -v brew >/dev/null 2>&1; then _aif_yq_inst="brew install yq"
        elif command -v snap >/dev/null 2>&1; then _aif_yq_inst="sudo snap install yq"
        fi
        if [ -n "$_aif_yq_inst" ]; then
          if [ -t 0 ]; then
            printf "▶ 'yq' is not installed. Install it now via '%s'? [y/N] " "$_aif_yq_inst"
            read -r _yqans || _yqans=""
            case "$_yqans" in
              [yY]|[yY][eE][sS])
                echo "▶ Installing yq via: $_aif_yq_inst"
                $_aif_yq_inst || true
                if command -v yq >/dev/null 2>&1; then
                  _aif_yq_wire
                else
                  echo "  ⚠ yq install did not succeed — the gates are not wired (NOT wired below)"
                fi ;;
              *) echo "  ⊝ yq not installed — the offer to install it was declined, so the gates are not wired (NOT wired below)" ;;
            esac
          else
            # --wire-ci with no TTY: do NOT silently install a binary on a non-interactive run.
            echo "  ⚠ --wire-ci: 'yq' is not installed, and a run with no terminal does not install a binary ($_aif_yq_inst) — the gates are not wired (NOT wired below)"
          fi
        else
          echo "  ⚠ 'yq' is not installed and neither brew nor snap is on PATH to install it — the gates are not wired (NOT wired below)"
        fi
      fi
    fi
  fi

  if [ "${#_aif_missing[@]}" -gt 0 ]; then
    echo ""
    if [ -n "$_aif_has_wf" ]; then
      echo "⚠ CI-orphan: some rule-enforcement gates run in 'npm run validate' but are NOT in any kept workflow under .github/workflows/."
      echo "   A pre-existing CI workflow was kept (install never overwrites it), so these gates fire only on a local"
      echo "   'npm run validate' — CI can stay green while a rule is violated. Gates missing from your CI:"
    else
      echo "⚠ CI-orphan: no workflow exists under .github/workflows/, so every rule-enforcement gate fires only on a"
      echo "   local 'npm run validate' — no CI job checks a pushed commit. Gates with no CI job:"
    fi
    for _m in "${_aif_missing[@]}"; do echo "     • $_m"; done
    # check:globs is the ONLY shield for R2/R7/R8 on shadowed packages — a present `lint` step does
    # not cover it (per-package eslint configs win under nearest-config resolution). Surface that.
    for _m in "${_aif_missing[@]}"; do
      case "$_m" in
        check:globs*)
          echo "   Note: a 'npm run lint' step does NOT enforce R2/R7/R8 on packages with their own eslint config —"
          echo "   nearest-config resolution shadows the root AIF rules, so they go silently inert there; check:globs"
          echo "   is the only gate that catches it (e.g. \`eslint --print-config <shadowed-file> | grep -c rules-as-tests\` = 0)."
          break ;;
      esac
    done
    # One NOT-wired line per gate, with the reason — never a paste-block or a flag to re-run with
    # (operator directive 2026-09-28, Q4.7). The workflow is the consumer's: getff edits it only on
    # --wire-ci or a yes at the prompt, because its only editor (yq) does not keep every comment
    # (research-patch 2026-06-14-s3-workflow-merge §4/§6, SSOT #117).
    # _ws_lines is 40-configs.sh's workspace map (setup.d layers are sourced into one shell): it is
    # non-empty exactly when that layer took its workspace (monorepo) branch — one stack or several —
    # which is the branch that places no ci.yml.
    if [ -z "$_aif_has_wf" ] && [ -n "${_ws_lines:-}" ]; then
      _aif_why="no workflow exists under .github/workflows/ — getff places its ci.yml only in a repo with no workspace packages under apps/, packages/, services/, libs/ or modules/ (each shipped ci.yml runs one stack's jobs at the repo root), and this repo has workspace packages there"
    elif [ -z "$_aif_has_wf" ]; then
      _aif_why="no workflow exists under .github/workflows/, and this install placed none"
    elif [ "${_aif_wire:-no}" = "yes" ] && [ -n "${_aif_yq_ran:-}" ]; then
      _aif_why="yq did not add it to the job it wired the other gates into"
    elif [ "${_aif_wire:-no}" = "yes" ]; then
      _aif_why="the wiring through yq did not land (its reason is above)"
    else
      _aif_why="the workflow is your own, and getff edits it only on --wire-ci or a yes at the install prompt, which this run did not have"
    fi
    for _i in "${!_aif_missing[@]}"; do
      if [ -n "$_aif_has_wf" ]; then
        note_not_wired "CI gate ${_aif_missing[$_i]} — not in your .github/workflows/ (step: ${_aif_steps[$_i]#- }): $_aif_why"
      else
        note_not_wired "CI gate ${_aif_missing[$_i]} — runs in no CI job (step: ${_aif_steps[$_i]#- }): $_aif_why"
      fi
    done
  fi
  unset -f _aif_gate_check _aif_detect_gates _aif_yq_wire
fi
