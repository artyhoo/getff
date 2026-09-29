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
# O2: sets _r2_verdict global (read by 99-finalize for L2), and _r2_own_globs — the boundary globs of
#     a root config treated as the consumer's, for 99-finalize's own-config pass

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
# Lives in setup.d/eslint-wire.sh (eslint_wire_r2_root): do_refresh runs the same pass (refresh sweep
# G4). It sets _r2_verdict (read by 99-finalize for L2) and _r2_own_globs (its own-config pass).
# shellcheck source=setup.d/eslint-wire.sh
source "${BASH_SOURCE[0]%/*}/eslint-wire.sh"   # the sibling file — also under a test's stand-in PKG_ROOT
eslint_wire_r2_root

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
  # Detection lives in setup.d/lib.sh (ci_gate_detect): do_refresh reports the same gates (sweep G6).
  ci_gate_detect

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
      ci_gate_detect   # re-check: wired gates are now referenced → drop them from the WARN below
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
  unset -f _aif_yq_wire
fi
