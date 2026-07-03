#!/usr/bin/env bash
# refresh-covers-full-delivery.test.sh — #869: every framework-owned artefact that a --full
# install delivers via copy_safe MUST also be re-copied by --refresh (do_refresh).
#
# Closes the recurring "refresh omits a --full-delivered framework artefact" class:
#   #635 packages/core/hooks/package.json, #735 pre-push dep, #869 check-fences-fire.sh +
#   check-shields-up.sh (scripts/), .husky/pre-{commit,push} + eslint-rules-local/ (this PR).
# Root mechanism: copy_safe (setup.d/lib.sh) SKIPS-if-exists. So a brownfield consumer only ever
# receives an UPDATED framework artefact through do_refresh(), whose refresh_safe OVERWRITES. A
# framework file delivered by --full but omitted from do_refresh can therefore never reach an
# already-installed consumer non-destructively — the framework's own fixes false-RED (or, for
# .husky/pre-push, HARD-CRASH per #636) forever on it. This gate is the mechanical form of the
# install.sh do_refresh "@sync-with-layers" invariant + the install.sh:398 prose promise
# ("Consumer-owned files … were not touched") — encoded as an executable assertion.
#
# SCOPE: copy_safe deliveries only (the skip-if-exists mechanism that causes the bug). Other
# delivery mechanisms — refresh_skill_with_transform (skills), merge_prettierignore, the yq
# workflow-merge — have their own refresh semantics and are out of this gate's population.
#
# GRANULARITY: destinations are normalized by keeping the literal path prefix up to the first
# shell-expansion segment ($var / $(...)). A literally-delivered file (scripts/x.sh, .husky/
# pre-push) stays a literal → exact per-file match (catches a single-file omission). A glob-
# delivered namespace (eslint-rules-local/$bn.ts, .claude/agents/$(basename …)) collapses to its
# directory prefix → namespace match, which is SOUND only because delivery and refresh iterate
# the SAME source glob (so no per-file omission is possible within it). Directory payloads
# (scripts/fences-fire-fixtures) are now refreshed like any other framework artefact — #873 fixed
# refresh_safe to REPLACE an existing directory instead of nesting cp -r into it.
#
# Deterministic, no network: awk over do_refresh() + grep over setup.d. Paired-negative arm
# proves the set-difference is non-vacuous (a real omission flips the gate RED).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

[ -f "$INSTALL" ] || { echo "FATAL: $INSTALL not found"; exit 1; }

# ── EXCLUDED: copy_safe destinations deliberately NOT refreshed (data-driven escape hatch) ──
# Each entry is a CONSUMER-OWNED (Layer-3) file that a consumer customises — refreshing it would
# clobber their edits. (The one directory payload, scripts/fences-fire-fixtures, was the last
# deferred entry here — #873 fixed refresh_safe to replace directory payloads instead of nesting,
# so it is now refreshed like any other framework artefact and no longer lives in this list.)
# install.sh:398 + setup.d/lib.sh:194 (framework-namespace vs consumer-ownable split) are the prose
# this list encodes. A NEW copy_safe destination that is framework-owned must be REFRESHED (added
# to do_refresh), not added here.
EXCLUDED=$(sed -E 's/#.*//; s/^[[:space:]]+//; s/[[:space:]]+$//' <<'EXC' | sed '/^$/d'
  # Consumer-owned config files (copy_safe keeps the consumer's own; refresh must not clobber)
  tsconfig.json
  .prettierrc.json
  .lintstagedrc.json
  .nvmrc
  .dependency-cruiser.cjs
  stryker.config.json
  vitest.config.ts
  playwright.config.ts
  eslint.config.mjs
  eslint.config.rn-common.mjs
  .github/workflows/ci.yml
  .github/workflows/workflow-integrity.yml
  AGENTS.md
  # Generated / consumer-customisable .ai-factory docs (per-consumer content; not framework code)
  .ai-factory/RULES.md
  .ai-factory/RULES.react-next.md
  .ai-factory/RULES.react-spa.md
  .ai-factory/RULES.react-native.md
  .ai-factory/ARCHITECTURE.ts-server.md
  .ai-factory/ARCHITECTURE.react-next.md
  .ai-factory/ARCHITECTURE.react-spa.md
  .ai-factory/ARCHITECTURE.react-native.md
  .ai-factory/DESCRIPTION.template.md
  .ai-factory/tool-decisions.md
  .ai-factory/rules/integration-rules.md
EXC
)

# ── FULL: every framework artefact a --full install copy_safe's to a consumer path ──────────────
# Scan ALL setup.d/*.sh (not just 40-configs.sh), skip comment lines (a commented-out copy_safe is
# not a live delivery). Normalize each dst to the literal prefix up to the first $-expansion.
# shellcheck disable=SC2016  # single-quoted regex matches the literal '$PROJECT_ROOT' in source; no expansion intended
FULL=$(grep -hE 'copy_safe' "$REPO_ROOT"/setup.d/*.sh 2>/dev/null | grep -vE '^[[:space:]]*#' \
  | grep -oE '\$PROJECT_ROOT/[A-Za-z0-9._/-]*' | sed -E 's#\$PROJECT_ROOT/##' | sort -u)

# Fail loud if a copy_safe dst begins with an immediate variable ("$PROJECT_ROOT/$x") — it would
# normalize to the empty string and silently escape FULL (a false-GREEN hole). None exist today.
# shellcheck disable=SC2016
if grep -hE 'copy_safe' "$REPO_ROOT"/setup.d/*.sh 2>/dev/null | grep -vE '^[[:space:]]*#' \
   | grep -qE '"\$PROJECT_ROOT/\$'; then
  echo "FATAL: a copy_safe dst starts with an immediate \$var after \$PROJECT_ROOT/ — unparseable; extend the gate"; exit 1
fi

# ── REFRESH: every consumer path do_refresh() actually WRITES to (write-intent lines only) ──────
# Extract from the do_refresh body but EXCLUDE comment / echo / chmod_safe lines: a path that
# survives ONLY in a comment or a chmod_safe line is NOT refreshed. (Without this, removing a
# `refresh_safe … "$PROJECT_ROOT/.husky/pre-push"` line left the path "present" via its sibling
# `chmod_safe +x … .husky/pre-push` line → false-GREEN.) Two write-intent forms remain:
# (a) "$PROJECT_ROOT/<path>" on refresh_safe / cp / var-assignment lines (normalized like FULL);
# (b) the "<src>:scripts/<dst>" _pair data lines consumed via the $_d loop var (literal basenames).
refresh_body() {
  awk '/^do_refresh\(\) \{/{f=1} f{print} f&&/^\}/{exit}' "$INSTALL"
}
refresh_writes() {  # do_refresh body minus comment / echo / chmod_safe lines (non-write noise)
  refresh_body | grep -vE '^[[:space:]]*#|^[[:space:]]*echo |chmod_safe'
}
# shellcheck disable=SC2016
REFRESH=$( { refresh_writes | grep -oE '\$PROJECT_ROOT/[A-Za-z0-9._/-]*' | sed -E 's#\$PROJECT_ROOT/##'
             refresh_writes | grep -oE ':scripts/[A-Za-z0-9._-]+\.(sh|ts)' | sed 's#:scripts/#scripts/#'
           } | sed '/^$/d' | sort -u)

# Guard against a broken harness silently passing (empty sets ⇒ vacuous green).
[ -n "$FULL" ]     || { echo "FATAL: FULL set empty — copy_safe→\$PROJECT_ROOT extraction broke"; exit 1; }
[ -n "$REFRESH" ]  || { echo "FATAL: REFRESH set empty — do_refresh() extraction broke"; exit 1; }
[ -n "$EXCLUDED" ] || { echo "FATAL: EXCLUDED set empty — heredoc parse broke"; exit 1; }

# ── Check 1 (pos): FULL ⊆ (REFRESH ∪ EXCLUDED) ──────────────────────────────────────────────────
compute_missing() {  # $1 = refresh set (newline list); prints FULL entries not in it/EXCLUDED
  local refresh="$1" f
  for f in $FULL; do
    printf '%s\n' "$refresh"  | grep -qxF "$f" && continue
    printf '%s\n' "$EXCLUDED" | grep -qxF "$f" && continue
    printf '%s ' "$f"
  done
}
missing=$(compute_missing "$REFRESH")
if [ -z "${missing// }" ]; then
  ok "every --full-delivered copy_safe artefact is refreshed by do_refresh() or explicitly EXCLUDED (no refresh drift)"
else
  bad "framework artefact(s) delivered by --full but OMITTED from do_refresh() → brownfield consumers can't get fixes:$missing"
fi

# ── Check 2 (hygiene): EXCLUDED ⊆ FULL (no stale exclusion for a delivery that no longer exists) ─
stale_excl=""
for e in $EXCLUDED; do
  printf '%s\n' "$FULL" | grep -qxF "$e" || stale_excl="$stale_excl $e"
done
if [ -z "${stale_excl// }" ]; then
  ok "every EXCLUDED entry is still a live copy_safe delivery (no stale exclusions)"
else
  bad "EXCLUDED lists path(s) no longer delivered by copy_safe → remove the stale exclusion:$stale_excl"
fi

# ── Check 3: eslint-rules-local/ source-dir parity (the ONE multi-glob namespace) ────────────────
# eslint-rules-local/ is populated from MULTIPLE source dirs (core + per-stack presets), so the
# namespace-level match in Check 1 is sound ONLY if refresh iterates the SAME source dirs delivery
# does — otherwise a preset rule is delivered but stranded (the live #869-class bug this closed).
# Enforce it directly: every packages/*/eslint-rules dir the delivery feeds into eslint-rules-local
# must also be iterated by do_refresh. (40-configs.sh's only packages/*/eslint-rules refs ARE the
# eslint-rules-local _copy_rule delivery loops, so a whole-file scan is unambiguous here.)
DELIV_RULE_DIRS=$(grep -vE '^[[:space:]]*#' "$REPO_ROOT/setup.d/40-configs.sh" \
  | grep -oE 'packages/[A-Za-z0-9._-]+/eslint-rules' | sort -u)
REFRESH_RULE_DIRS=$(refresh_writes | grep -oE 'packages/[A-Za-z0-9._-]+/eslint-rules' | sort -u)
[ -n "$DELIV_RULE_DIRS" ] || { echo "FATAL: no packages/*/eslint-rules dirs found in 40-configs.sh — extraction broke"; exit 1; }
missing_dirs=""
for d in $DELIV_RULE_DIRS; do
  printf '%s\n' "$REFRESH_RULE_DIRS" | grep -qxF "$d" || missing_dirs="$missing_dirs $d"
done
if [ -z "${missing_dirs// }" ]; then
  ok "eslint-rules-local: do_refresh iterates every packages/*/eslint-rules source dir delivery ships (preset parity)"
else
  bad "eslint-rules-local: delivery ships from source dir(s) do_refresh never refreshes → preset rules stranded:$missing_dirs"
fi

# ── neg (LOAD-BEARING): drop one known-present entry from REFRESH → Check 1 MUST flag it ─────────
# probe MUST be a FULL∩REFRESH entry — dropping it from REFRESH then creates a REAL gap
# (compute_missing only iterates FULL, so a REFRESH-only entry would prove nothing).
probe=""
for f in $FULL; do
  if printf '%s\n' "$REFRESH" | grep -qxF "$f"; then probe="$f"; break; fi
done
[ -n "$probe" ] || { echo "FATAL: no FULL∩REFRESH entry to probe non-vacuity with"; exit 1; }
REFRESH_BROKEN=$(printf '%s\n' "$REFRESH" | grep -vxF "$probe")
neg_missing=$(compute_missing "$REFRESH_BROKEN")
case " $neg_missing " in
  *" $probe "*) ok "neg: removing '$probe' from the refresh set flips the gate to flag it (non-vacuous)" ;;
  *)           bad "neg: gate stayed green with '$probe' dropped from refresh → set-difference is VACUOUS" ;;
esac

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
