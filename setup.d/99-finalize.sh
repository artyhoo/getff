#!/usr/bin/env bash
# setup.d/99-finalize.sh — synth-wire + R2 AST-wire + V2 otel WARN + ignore_shipped_configs + Done.
#
# Sources: lib.sh (already in dispatcher scope)
# S0 rows: R2-L2 (install.sh:1597-1641), otel (install.sh:1643-1657), cite:historical pre-split install.sh lines, code moved into this file by #719
#          ignore_shipped_configs CALL (install.sh:1659-1661), Done (install.sh:1663-1705) cite:historical pre-split install.sh lines, code moved into this file by #719
# Depends on: 70-deps (ts-morph installed; DEPS_INSTALLED + DEVDEPS set),
#             60-ci (_r2_verdict + _r2_own_globs set), ALL prior layers (SKIPPED fully accumulated)
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone
# O3: HIGHEST-RISK ordering item — must run AFTER 70-deps (ts-morph) and LAST (SKIPPED complete)
# O2: reads _r2_verdict + _r2_own_globs (from 60-ci) + DEPS_INSTALLED + DEVDEPS (from 70-deps)

# GETFF_ADDED_TO is declared by install.sh; a caller that sources this file alone (the layer-units
# test) may not have it, and the summary reads its length under set -u.
[ -n "${GETFF_ADDED_TO+x}" ] || GETFF_ADDED_TO=()

# ─── synth-wire + #827 B3 per-workspace live-research synth-wire ─────────────────
# Lives in setup.d/eslint-wire.sh (eslint_wire_synth): do_refresh runs the same pass (refresh sweep G4).
# shellcheck source=setup.d/eslint-wire.sh
source "${BASH_SOURCE[0]%/*}/eslint-wire.sh"   # the sibling file — also under a test's stand-in PKG_ROOT
eslint_wire_synth

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
  echo "   preset rules are your only stack fence this install. Live-researched rules come from the"
  echo "   rule-research protocol (agents/rule-researcher.md, the rule-research skill), which an install"
  echo "   does not run; a --full install delivers its output into eslint.config.mjs when it is there."
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

# ─── 6b-bis-L2 + §13.5 I-2 L2: R2 into per-package and per-workspace configs ──────
# Lives in setup.d/eslint-wire.sh (eslint_wire_r2_configs): do_refresh runs the same pass (sweep G4).
eslint_wire_r2_configs

# ─── F11: what scripts/check-rule-globs.sh fails on in this project ───
# The gate, which runs on every push, fails on a root config of the consumer's that mentions RULE_GLOBS
# or names one of getff's custom rules (R2, R7, R8) when it finds no RULE_GLOBS globs there, or globs
# matching no source file; under any other root config of the consumer's it reads the workspace configs
# below it (its _own_root_without_globs). With boundary globs, the wirer adds RULE_GLOBS or names why
# not; this names what is left. The install used to stay silent while every push failed (cold-review
# F11), then read the config with its own copy of the gate's greps, which drifted from the gate (second
# cold review, after #1868) — so it asks the gate itself, once every R2 pass has run, and as a push runs
# it (no ESLINT_CONFIG): asked in between, it named a workspace config Layer 2 went on to wire (third
# cold review).
#
# It asks with AIF_STRICT_RUNTIME=1, whatever this install ran with. That run also reads
# RULE_GLOBS.appCode / .application (R7/R8), which the wirer never adds to a config the consumer owns —
# it adds R2 alone, and getff does not arm the runtime-discipline rules on its own (V2 below) — so a push
# with that variable failed on a config the install had found green. Every other check is the same in
# both runs, so one run names both: a line about appCode or application says it fails with
# AIF_STRICT_RUNTIME=1. Every failure line is named once, up to its advice — a step for a person to
# take, not one for the install to hand on — and a failure an R2 pass already named is not named again
# (F5, fourth cold review: the guard on the root config's text left the workspace configs unasked, the
# first failure line alone was named, and the install ran the gate without AIF_STRICT_RUNTIME).
_f11_gate="$PROJECT_ROOT/scripts/check-rule-globs.sh"
# _f11_note <text> — note_not_wired, once per text.
_f11_note() {
  local n
  for n in ${NOT_WIRED[@]+"${NOT_WIRED[@]}"}; do [ "$n" = "$1" ] && return 0; done
  note_not_wired "$1"
}
# _f11_r2_named <config> — exit 0 when the wirer already said the gate fails on <config>'s R2.
_f11_r2_named() {
  grep -qF 'check-rule-globs.sh fails on this config' <<<"$(printf '%s\n' ${NOT_WIRED[@]+"${NOT_WIRED[@]}"} | grep -F "($1)")"
}
# _f11_describe <workspace config, empty for the root> <gate failure line> — its NOT wired line.
_f11_describe() {
  local ws="$1" s key="" strict="" what why="" dir ids
  s=$(printf '%s\n' "$2" | sed -e 's/^[[:space:]]*//' -e 's/^✗[[:space:]]*//' -e 's/^⚠[[:space:]]*//' \
        -e 's/ — .*//' -e 's/ (check the config)$//')
  case "$s" in *RULE_GLOBS.*) key=$(printf '%s\n' "$s" | sed -n 's/.*RULE_GLOBS\.\([A-Za-z]*\).*/\1/p') ;; esac
  case "$key" in appCode | application) strict=1 ;; esac
  # R2's RULE_GLOBS in the root config the wirer already named as failing the gate: said once, by the
  # wirer (it says so of the root config alone).
  [ -z "$ws" ] && [ "$key" = boundary ] && _f11_r2_named "$_root_eslint" && return 0
  # A package with no R2 over its boundary files, named by its path from the project root, unless an R2
  # pass already named R2 in that package: its config («in <dir>/eslint.config.…») or the workspace
  # itself («in <dir> — …»).
  case "$s" in
    *": has boundary files but its own ESLint config does NOT wire R2"*)
      dir="${s%%: has boundary files*}"
      [ -z "$ws" ] || { dir="$(dirname "$ws")/$dir"; s="$dir: ${s#*: }"; ws=""; }
      grep -qF -e "R2 (rules-as-tests/no-unsafe-zod-parse) in $dir/eslint.config." \
               -e "R2 (rules-as-tests/no-unsafe-zod-parse) in $dir — " \
        <<<"$(printf '%s\n' ${NOT_WIRED[@]+"${NOT_WIRED[@]}"})" && return 0 ;;
  esac
  if [ -z "$ws" ] && [ -n "$key" ] \
     && { [ "$_root_eslint" = eslint.config.js ] || [ "$_root_eslint" = eslint.config.mjs ]; }; then
    local cfg="$PROJECT_ROOT/$_root_eslint" label=RULE_GLOBS code
    [ -z "$strict" ] || label="RULE_GLOBS.$key"
    code=$(eslint_config_code "$cfg")   # the config's code: a comment naming a rule or RULE_GLOBS sets none
    case "$s" in
      *"matches ZERO source files"*) what="its RULE_GLOBS.$key matches none of the project's source files" ;;
      *) if grep -q 'RULE_GLOBS' <<<"$code"; then
           what="its RULE_GLOBS has no $key array of quoted globs"
         elif [ -n "$strict" ]; then
           what="it has no RULE_GLOBS block"
         else
           ids=$(grep -oE 'no-unsafe-zod-parse|no-direct-time-randomness|require-otel-span' <<<"$code" \
             | sort -u | sed 's|^|rules-as-tests/|' | tr '\n' ' ' | sed 's/ $//; s/ /, /g') || ids=""
           # The gate is asked about every root config (#1906), one that sets none of these rules too:
           # an empty list is no «it sets  itself».
           if [ -n "$ids" ]; then what="it sets $ids itself with no RULE_GLOBS block"; else what="it has no RULE_GLOBS block"; fi
         fi ;;
    esac
    # Why the install adds no boundary explains R2's array alone: a RULE_GLOBS.appCode or .application
    # (R7/R8) has nothing to do with it (fourth cold review).
    if [ "$key" = boundary ] && [ -z "${_r2_own_globs:-}" ]; then
      if [ "${_r2_verdict:-}" = boundary-present ]; then
        why=", and the ${STACK:-ts-server} preset ships no R2, so the install has no RULE_GLOBS.boundary to add"
      else
        why=", and the install found no HTTP boundary code to scope R2 to, so it adds no RULE_GLOBS.boundary"
      fi
    fi
    if [ -n "$strict" ]; then
      _f11_note "$label in $_root_eslint (your own config) — $what; scripts/check-rule-globs.sh fails on this config with AIF_STRICT_RUNTIME=1"
    else
      _f11_note "$label in $_root_eslint (your own config) — $what$why; scripts/check-rule-globs.sh fails on this config"
    fi
    return 0
  fi
  # Any other failure line (a workspace config, a recorded R2 N/A that no longer holds, a package whose
  # own config does not wire R2), named where the gate found it: a workspace line says which workspace.
  if [ -n "$ws" ]; then
    case "$s" in
      *" in $(basename "$ws")") s="${s% in *} in $ws" ;;
      *) s="$s ($ws)" ;;
    esac
  fi
  if [ -n "$strict" ]; then
    _f11_note "$s — scripts/check-rule-globs.sh fails on this project with AIF_STRICT_RUNTIME=1"
  else
    _f11_note "$s — scripts/check-rule-globs.sh, which runs on every push, fails on this project"
  fi
}
if [ "${_f11_check:-}" = 1 ] && [ "$DRY_RUN" != "--dry-run" ] && [ -f "$_f11_gate" ]; then
  _f11_out=$( cd "$PROJECT_ROOT" && env -u ESLINT_CONFIG AIF_STRICT_RUNTIME=1 bash "$_f11_gate" 2>&1 ) && _f11_rc=0 || _f11_rc=$?
  if [ "$_f11_rc" -ne 0 ]; then
    # The gate names the workspace config it reads next («check-rule-globs: checking <config>»); a
    # failure line is a ✗ line or a «no globs found under» one. A gate with no such line (a crash, a
    # consumer's own script) is named by its exit, and the install goes on (fourth cold review).
    # A ✗ counts where it opens the line: «· R2 …: no root-governed match — … (see ⚠/✗ above)» is not a failure.
    _f11_ws="" _f11_any=0
    while IFS= read -r _f11_l; do
      case "${_f11_l#"${_f11_l%%[![:space:]]*}"}" in
        "check-rule-globs: checking "*) _f11_ws="${_f11_l#check-rule-globs: checking }"; continue ;;
        ✗* | *"no globs found under"*) _f11_any=1; _f11_describe "$_f11_ws" "$_f11_l" ;;
      esac
    done <<< "$_f11_out"
    [ "$_f11_any" = 1 ] \
      || _f11_note "scripts/check-rule-globs.sh, which runs on every push, exits $_f11_rc on this project, with no failure line the install can name"
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
  note_not_wired "R8 (require-otel-span) and R7 — not armed: @opentelemetry/* is in package.json but AIF_STRICT_RUNTIME is unset, and getff does not arm the runtime-discipline rules on its own"
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
    echo "⚠  self-verify: $_ISV_PASS/3 passed, $_ISV_FAIL FAILED$_isv_fail_tail — the failing check's output is above"
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
# Operator directive 2026-09-28 (Q4.7): the install never hands the person running it a manual
# step. Each NOT-wired line names what was left undone and why (lib.sh print_not_wired).
print_not_wired
# A consumer-owned config that got getff's block (Q4.7) was copy_safe-skipped earlier, so it sits in
# SKIPPED too — but it was not left as it was. List it apart, never under «skipped».
_skipped_left=()
for _sk in ${SKIPPED[@]+"${SKIPPED[@]}"}; do
  _sk_added=""
  for _ga in ${GETFF_ADDED_TO[@]+"${GETFF_ADDED_TO[@]}"}; do
    [ "$_sk" = "$PROJECT_ROOT/$_ga" ] && _sk_added=1
  done
  [ -n "$_sk_added" ] || _skipped_left+=( "$_sk" )
done
print_getff_added   # setup.d/lib.sh — do_refresh prints it too
if [ "${#_skipped_left[@]}" -gt 0 ]; then
  echo ""
  echo "·  ${#_skipped_left[@]} file(s) already existed and were left as they are — getff does not overwrite a project's files:"
  printf '      - %s\n' "${_skipped_left[@]#"$PROJECT_ROOT"/}"
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
  echo "    toolchain is not usable yet (the NOT wired list above says why). This is NOT a full"
  echo "    success. Exiting non-zero so this is not mistaken for a green install."
elif [ "${_ISV_FAIL:-0}" -gt 0 ]; then
  # critical-review S4-8: a failed self-verify used to end here as «complete», rc 0 — so
  # `npx getff init -y` in CI or from an agent read green while a shipped rule stayed silent.
  echo "⚠  Installation finished, but self-verify FAILED ($_ISV_FAIL check(s), output above) — this"
  echo "    is NOT a full success. Exiting non-zero so this is not mistaken for a green install."
else
  echo "✅ Installation complete."
fi
echo ""
# What the install checked itself — facts, never a to-do list (Q4.7). This block used to be
# «Next steps»: review/edit three files, a copy-paste dependency command, «verify git hooks», «run
# audit-ai-docs.sh — should PASS», «run npm run validate». Each is now either checked here or, when
# the install could not do it, a NOT-wired line above with its reason.
if [ "$DRY_RUN" != "--dry-run" ]; then
  echo "Checked by the install:"
  _hp_now=$(git -C "$PROJECT_ROOT" config --get core.hooksPath 2>/dev/null || true)
  # .husky (set by 50-hooks) and .husky/_ (husky v9, kept by 50-hooks) both run .husky/<hook>; a
  # blocker (the consumer's own hooksPath, a subdirectory install) is the only «not active».
  if [ -z "${HUSKY_HOOKS_BLOCKED:-}" ] && { [ "$_hp_now" = ".husky" ] || [ "$_hp_now" = ".husky/_" ]; }; then
    echo "  ✓ git hooks active — core.hooksPath=$_hp_now"
  else
    echo "  · git hooks — not active (NOT wired above)"
  fi
  # Only the script getff placed: a scripts/audit-ai-docs.sh the project already had is its own
  # code (copy_safe kept it), and the install does not run a project's code.
  if [ -f "$PROJECT_ROOT/scripts/audit-ai-docs.sh" ] && ! getff_delivered "$PROJECT_ROOT/scripts/audit-ai-docs.sh"; then
    echo "  · scripts/audit-ai-docs.sh — not run: the file is the project's own (it existed before the install), and the install does not run a project's code"
  elif [ -f "$PROJECT_ROOT/scripts/audit-ai-docs.sh" ]; then
    _aud_out=$( cd "$PROJECT_ROOT" && bash scripts/audit-ai-docs.sh 2>&1 ) && _aud_rc=0 || _aud_rc=$?
    _aud_sum=$(printf '%s\n' "$_aud_out" | sed -n 's/^Audit complete: //p' | tail -1)
    if [ "$_aud_rc" -eq 0 ] && [ -n "$_aud_sum" ]; then
      echo "  ✓ scripts/audit-ai-docs.sh — $_aud_sum"
    else
      echo "  ✗ scripts/audit-ai-docs.sh — ${_aud_sum:-exited $_aud_rc}:"
      # awk, not grep: a grep that selects nothing exits 1, and under set -euo pipefail that ended
      # a finished install (cold review M1, 2026-09-28).
      printf '%s\n' "$_aud_out" | awk '/FAIL/ && !/^Audit complete/ { print "      " $0 }'
    fi
  fi
  if [ "${DEPS_INSTALLED:-}" = "1" ]; then
    echo "  ✓ dev + runtime dependencies installed into node_modules/"
  elif [ -f "$PROJECT_ROOT/package.json" ]; then
    echo "  · dependencies — not installed (NOT wired above)"
  fi
  # Only the files placed in this run: one the project already had was kept, and it is not a template.
  _placed_docs=""
  for _pd in .ai-factory/DESCRIPTION.md .ai-factory/ARCHITECTURE.md AGENTS.md; do
    [ -f "$PROJECT_ROOT/$_pd" ] || continue
    _pd_kept=""
    for _sk in ${SKIPPED[@]+"${SKIPPED[@]}"}; do [ "$_sk" = "$PROJECT_ROOT/$_pd" ] && _pd_kept=1; done
    [ -n "$_pd_kept" ] || _placed_docs="${_placed_docs:+$_placed_docs, }$_pd"
  done
  if [ -n "$_placed_docs" ]; then
    echo "  · $_placed_docs — placed from getff's templates; their project-specific parts"
    echo "    (domain, layers, conventions) are placeholders an install cannot know"
  fi
  echo "  · npm run validate — not run: it runs this project's own lint, typecheck and tests, whose result"
  echo "    is about the project's code, not about what the install placed"
  echo ""
fi
echo "For full guide: see INSTALL.md"

# GH #974: honest non-zero exit on a --full install whose deps did not fully land (banner above
# already said so). The dispatcher sources this file last, so this is install.sh's final rc.
if [ -n "${_deps_incomplete:-}" ] || [ "${_ISV_FAIL:-0}" -gt 0 ]; then
  exit 1
fi
