#!/usr/bin/env bash
# universalization-fix-s3 Stage P — opt-in `--wire-ci` yq auto-wirer (GH #521).
#
# Context. The HYBRID verdict (research-patch 2026-06-14-s3-workflow-merge-adopt-vs-build.md, SSOT
# #117) has two halves: (BUILD) the broadened, non-destructive CI-orphan WARN (its paste-block is now NOT-wired lines, Q4.7) — already
# shipped and covered by r2-glob-reach.test.sh #1; and (REFERENCE) this opt-in `--wire-ci` path, which —
# only on explicit consent and only if `yq` is present — idempotently appends the missing
# rule-enforcement gates into the consumer's kept workflow. THIS test covers the REFERENCE half.
#
# Paired-negative discipline (principle 02-paired-negative-test):
#   • POS (yq arm): --wire-ci appends all 4 missing gates, suppresses the WARN, and is idempotent.
#   • NEG (load-bearing, runs everywhere): WITHOUT --wire-ci the consumer's workflow is left
#     BYTE-IDENTICAL — proving the auto-wire is genuinely opt-in and the default stays non-destructive.
#
# Option B — yq-absent install-offer (companion-install-principle.md §1/§3). When yq is ABSENT but the
# consumer consented (--wire-ci), the installer OFFERS yq's official installer (detect-first, unpinned,
# TTY-gated [y/N]) instead of immediately falling back to the paste-block. None of the arms below ever
# install yq for real (CI must not mutate the host or flake), so they exercise the *non-installing*
# Option-B sub-branches only:
#   • OPT-B DECLINE (load-bearing): yq absent + non-interactive (--wire-ci, stdin </dev/null). Whatever
#     installer the host has, the SAFE-DEGRADE invariant must hold: nothing installed, workflow BYTE-
#     IDENTICAL, a 'yq not installed' message naming the installer not run + NOT-wired gate lines, exit 0.
#     Self-SKIPs if the host happens to ship yq (the POS arm covers the present path).
#   • OPT-B OFFER-REACHED (best-effort, fake-snap stub): on a host with no yq and no brew, a stubbed
#     `snap` on PATH proves Option B ROUTES by name to 'sudo snap install yq' (the stub is only NAMED,
#     never executed). Self-SKIPs where brew is present (DECLINE already asserts 'brew install yq').
#
# yq availability: GitHub-hosted runners ship `yq`, so CI exercises the POS arm. A local run without
# yq prints an explicit SKIP (never a silent pass). Comment preservation is OBSERVED, not asserted:
# yq's comment handling is best-effort (verdict §4 Q1 / §6 C-A — the exact reason it is DISQUALIFIED as
# the *silent* default); hard-gating a best-effort property would contradict the verdict and make CI
# flaky, so we report it as evidence toward the verdict's falsifier-(a) instead of failing on it.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# Brownfield consumer: a kept ci.yml wiring NONE of the 4 gates, carrying a planted trailing comment.
BROWNFIELD_CI=$'name: CI\njobs:\n  build:\n    steps:\n      - run: pnpm turbo run lint typecheck test  # AIF-PLANTED-COMMENT'

# Issue #528 fixture: the UNIVERSAL real-world workflow shape — ≥2 `uses:`-only steps (checkout +
# pnpm/action-setup + setup-node) ahead of the `run:` steps. The single-`run:`-step BROWNFIELD_CI
# above can NEVER exercise the #528 collapse (it has zero `uses:` steps), which is exactly why the
# bug slipped CI. Here the old `unique_by(.run)` grouped all three `uses:` steps under `.run==null`
# and kept only checkout, deleting the pnpm + node setup → `pnpm install` then failed with no toolchain.
BROWNFIELD_CI_USES=$'name: CI\njobs:\n  ci:\n    steps:\n      - uses: actions/checkout@v6\n      - uses: pnpm/action-setup@v6\n      - uses: actions/setup-node@v6\n        with:\n          node-version: 22\n          cache: pnpm\n      - run: pnpm install --frozen-lockfile\n      - run: pnpm turbo run lint typecheck test'

seed() { # $1 dir → brownfield consumer (git repo, package.json, kept ci.yml)
  printf '{"name":"wirep","version":"0.0.0"}\n' > "$1/package.json"
  mkdir -p "$1/.github/workflows"
  printf '%s\n' "$BROWNFIELD_CI" > "$1/.github/workflows/ci.yml"
  ( cd "$1" && git init -q )
}

seed_uses() { # $1 dir → brownfield consumer whose kept ci.yml has ≥2 `uses:` steps (issue #528 shape)
  printf '{"name":"wirep","version":"0.0.0"}\n' > "$1/package.json"
  mkdir -p "$1/.github/workflows"
  printf '%s\n' "$BROWNFIELD_CI_USES" > "$1/.github/workflows/ci.yml"
  ( cd "$1" && git init -q )
}

# ── NEG (load-bearing, no yq needed): default install must NEVER mutate the kept workflow ──
# </dev/null so the interactive [y/N] auto-wire prompt + the #483 dep-install prompt both read empty
# stdin → default No. This is the proof the wiring is opt-in: the byte-identical check fails the
# moment the default path starts editing the consumer's CI.
N=$(mktemp -d); seed "$N"
( cd "$N" && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) > "$N/log" 2>&1
if diff -q <(printf '%s\n' "$BROWNFIELD_CI") "$N/.github/workflows/ci.yml" >/dev/null 2>&1; then
  ok "NEG: default install (no --wire-ci) leaves the consumer workflow byte-identical (wiring is opt-in)"
else
  bad "NEG: default install mutated the consumer workflow — opt-in violated"
fi
grep -q 'CI-orphan' "$N/log" \
  && ok "NEG: default install still emits the broadened CI-orphan WARN" \
  || bad "NEG: default install dropped the CI-orphan WARN"

# ── POS (yq arm): --wire-ci with yq present → append all 4, suppress WARN, idempotent ──
if command -v yq >/dev/null 2>&1; then
  P=$(mktemp -d); seed "$P"
  ( cd "$P" && bash "$REPO_ROOT/install.sh" ts-server --wire-ci </dev/null ) > "$P/log" 2>&1
  RC=$?
  [ "$RC" = 0 ] && ok "POS: --wire-ci install exited 0 (auto-wire never aborts)" || bad "POS: --wire-ci exited $RC"

  _wired_all=1
  for p in 'check-rule-globs\.sh' 'arch:check' 'audit-ai-docs\.sh' 'check-lintstaged-resolves\.sh'; do
    grep -qE "$p" "$P/.github/workflows/ci.yml" || { _wired_all=0; bad "POS: --wire-ci did not append $p"; }
  done
  [ "$_wired_all" = 1 ] && ok "POS: --wire-ci appended all 4 missing gates into the consumer workflow"

  grep -q 'CI-orphan' "$P/log" \
    && bad "POS: CI-orphan WARN still fired after a successful wire (suppression failed)" \
    || ok "POS: CI-orphan WARN suppressed after wire (merge-then-no-warn)"

  yq -e '.jobs.build.steps' "$P/.github/workflows/ci.yml" >/dev/null 2>&1 \
    && ok "POS: wired steps live under the real job path .jobs.build.steps (valid YAML)" \
    || bad "POS: result is not valid YAML or steps landed at the wrong job path"

  # Idempotence: a 2nd --wire-ci adds nothing — the re-detect sees the gates already wired (install
  # level) and yq's unique_by(.run // .uses // .name // .) dedups (yq level). Step count unchanged.
  _before=$(yq '.jobs.build.steps | length' "$P/.github/workflows/ci.yml" 2>/dev/null || echo "x")
  ( cd "$P" && bash "$REPO_ROOT/install.sh" ts-server --wire-ci </dev/null ) > /dev/null 2>&1
  _after=$(yq '.jobs.build.steps | length' "$P/.github/workflows/ci.yml" 2>/dev/null || echo "y")
  [ "$_before" = "$_after" ] \
    && ok "POS: re-running --wire-ci is idempotent (steps stayed at $_before — no duplicates)" \
    || bad "POS: re-run duplicated steps ($_before → $_after — not idempotent)"

  # OBSERVATION only (not a gate) — yq comment preservation is best-effort (verdict falsifier-(a)).
  if grep -q 'AIF-PLANTED-COMMENT' "$P/.github/workflows/ci.yml"; then
    echo "  ⓘ OBS: planted comment survived the yq round-trip (evidence toward verdict falsifier-(a) — best-effort held here)"
  else
    echo "  ⓘ OBS: planted comment did NOT survive the yq round-trip — confirms yq best-effort preservation (verdict §6 C-A); exactly why --wire-ci is opt-in, not the silent default"
  fi
else
  echo "  ⊝ SKIP: 'yq' not on PATH — the --wire-ci POS arm runs on CI (GitHub runners ship yq), not in this local env"
fi

# ── #528 REGRESSION (yq arm): wiring must NOT delete existing `uses:` steps ──
# The original `unique_by(.run)` collapsed every `.run==null` (i.e. every `uses:`) step into one group
# and kept only the first (checkout), silently dropping pnpm/action-setup + setup-node. This arm wires
# into the universal real-world shape (BROWNFIELD_CI_USES, 3 `uses:` steps) and asserts ALL of them
# survive AND the 4 gates are still appended. Fails loudly on the pre-fix code; passes on the fix.
if command -v yq >/dev/null 2>&1; then
  U=$(mktemp -d); seed_uses "$U"
  ( cd "$U" && bash "$REPO_ROOT/install.sh" ts-server --wire-ci </dev/null ) > "$U/log" 2>&1
  URC=$?
  [ "$URC" = 0 ] && ok "#528: --wire-ci on a uses-heavy workflow exited 0" || bad "#528: --wire-ci exited $URC"

  _uses_kept=1
  for u in 'actions/checkout@v6' 'pnpm/action-setup@v6' 'actions/setup-node@v6'; do
    grep -qF "$u" "$U/.github/workflows/ci.yml" \
      || { _uses_kept=0; bad "#528: --wire-ci DELETED existing step 'uses: $u' (unique_by(.run) collapse regressed)"; }
  done
  [ "$_uses_kept" = 1 ] \
    && ok "#528: all 3 existing 'uses:' steps survived the wire (no null-run collapse)" \
    || true

  _gates_added=1
  for p in 'check-rule-globs\.sh' 'arch:check' 'audit-ai-docs\.sh' 'check-lintstaged-resolves\.sh'; do
    grep -qE "$p" "$U/.github/workflows/ci.yml" || { _gates_added=0; bad "#528: gate $p not appended into the uses-heavy workflow"; }
  done
  [ "$_gates_added" = 1 ] && ok "#528: all 4 gates appended alongside the preserved uses: steps" || true

  yq -e '.jobs.ci.steps' "$U/.github/workflows/ci.yml" >/dev/null 2>&1 \
    && ok "#528: result is valid YAML under .jobs.ci.steps" \
    || bad "#528: wired result is not valid YAML / wrong job path"
else
  echo "  ⊝ SKIP #528 regression: 'yq' not on PATH — runs on CI (GitHub runners ship yq)"
fi

# ── OPT-B DECLINE (load-bearing, runs everywhere; requires NO real yq install) ──
# This arm exercises the yq-ABSENT Option-B branch directly: --wire-ci with no yq on PATH and stdin
# fed from /dev/null (non-interactive). It deliberately uses the REAL PATH — manufacturing a minimal
# PATH breaks coreutils install.sh needs (macOS `grep`/`sed` resolve through the system toolchain) and
# would abort install before §6c ever runs, giving a false pass. With the real PATH, exactly one of the
# three yq-absent sub-branches fires depending on the host (installer detected + non-interactive →
# names the installer it did not run; OR no brew/snap → says neither is on PATH). Either way the SAFE-
# DEGRADE invariant must hold identically: nothing installed, workflow byte-identical, a yq message +
# the missing gates as NOT-wired lines with the reason, exit 0 — and, since the operator directive of
# 2026-09-28 (Q4.7), no paste-block and no «install it manually / then re-run». We skip only if the host happens to ship yq (then this is the POS
# arm's territory, already covered above).
if command -v yq >/dev/null 2>&1; then
  echo "  ⊝ SKIP: host ships 'yq' — the yq-ABSENT Option-B branch can't be exercised here (POS arm covers the present path)"
else
  D=$(mktemp -d); seed "$D"
  ( cd "$D" && bash "$REPO_ROOT/install.sh" ts-server --wire-ci </dev/null ) > "$D/log" 2>&1
  DRC=$?
  [ "$DRC" = 0 ] && ok "OPT-B DECLINE: yq-absent --wire-ci still exited 0 (degrades, never aborts)" \
                 || bad "OPT-B DECLINE: yq-absent --wire-ci exited $DRC"
  if diff -q <(printf '%s\n' "$BROWNFIELD_CI") "$D/.github/workflows/ci.yml" >/dev/null 2>&1; then
    ok "OPT-B DECLINE: yq absent + non-interactive ⇒ nothing installed, workflow byte-identical"
  else
    bad "OPT-B DECLINE: workflow mutated though yq was absent — Option B did not degrade safely"
  fi
  # The yq message is one of the two non-installing sub-branches (installer-found-non-interactive, or
  # no-installer-found). Both name 'yq' and say why nothing was wired — accept either.
  grep -qiE "'yq' (is )?not installed|yq.*not installed" "$D/log" \
    && ok "OPT-B DECLINE: surfaced a 'yq not installed' message (no silent pass)" \
    || bad "OPT-B DECLINE: no yq-not-installed message emitted"
  grep -qE "brew install yq|snap install yq|neither brew nor snap" "$D/log" \
    && ok "OPT-B DECLINE: names the official installer it did not run, or that none is on PATH (companion-install-principle §1/§3)" \
    || bad "OPT-B DECLINE: yq-absent branch named neither an installer nor its absence"
  grep -qiE "then re-run|install it manually|paste-block" "$D/log" \
    && bad "OPT-B DECLINE: the yq-absent branch still hands back a manual step" \
    || ok "OPT-B DECLINE: no manual step (Q4.7)"
  grep -q 'did not land' <<<"$(grep -E '^[[:space:]]*- CI gate ' "$D/log")" \
    && ok "OPT-B DECLINE: the missing gates are NOT-wired lines saying the yq wiring did not land" \
    || bad "OPT-B DECLINE: no NOT-wired CI gate line after the yq-absent branch"
fi

# ── OPT-B OFFER-REACHED (best-effort, fake-installer stub; requires NO real yq install) ──
# Prove Option B ROUTES to a detected official installer by name, without depending on what the host
# ships and without mutating the system. We prepend a fake `snap` to the REAL PATH (keeps coreutils
# working) and, only when the host has NO brew (brew would win the detect-first order), assert the
# non-interactive Option-B message names 'snap install yq'. The stub is never executed (the non-
# interactive branch only NAMES the command, it does not run it), so this can neither install nor flake.
# Where brew is present (e.g. macOS dev hosts) the DECLINE arm above already asserts 'brew install yq'
# is named, so OFFER-REACHED self-SKIPs to avoid a brew-vs-snap ordering dependency.
if command -v yq >/dev/null 2>&1; then
  echo "  ⊝ SKIP OFFER-REACHED: host ships yq (yq-absent routing not reachable)"
elif command -v brew >/dev/null 2>&1; then
  echo "  ⊝ SKIP OFFER-REACHED: host has brew → DECLINE arm already asserts 'brew install yq' is named; skipping the snap-stub to avoid a detect-order dependency"
else
  O=$(mktemp -d); seed "$O"
  OBIN=$(mktemp -d)
  printf '#!/bin/sh\necho "fake-snap (stub, installs nothing)"\nexit 0\n' > "$OBIN/snap"
  chmod +x "$OBIN/snap"
  ( cd "$O" && PATH="$OBIN:$PATH" bash "$REPO_ROOT/install.sh" ts-server --wire-ci </dev/null ) > "$O/log" 2>&1
  grep -q 'snap install yq' "$O/log" \
    && ok "OPT-B OFFER-REACHED: a detected (stub) snap routes Option B to 'sudo snap install yq' (official installer named, unpinned)" \
    || bad "OPT-B OFFER-REACHED: stub snap detected but 'snap install yq' was never named"
  if diff -q <(printf '%s\n' "$BROWNFIELD_CI") "$O/.github/workflows/ci.yml" >/dev/null 2>&1; then
    ok "OPT-B OFFER-REACHED: non-interactive run installs nothing ⇒ workflow byte-identical (no silent binary install)"
  else
    bad "OPT-B OFFER-REACHED: workflow mutated on a non-interactive run — silent install path leaked"
  fi
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
