#!/usr/bin/env bash
# consumer-upgrade-path — acceptance tests for install.sh --refresh.
#
# T3 acceptance gate (research-patch §5, plan Phase 2):
#   customise-survives: .override.md signals consumer-ownership → base file is NOT
#     clobbered, non-override sibling IS refreshed, override file is preserved.
#   stale-refreshed (paired-negative): a stale framework-owned file IS refreshed;
#     a test that passes even when refresh is a no-op is #discipline-theatre.
#
# Harness shape mirrors f15-prettierignore.test.sh: mktemp → git init → install →
# mutation → re-run refresh → assertion. Paired-negative arms prove non-vacuity.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# ── shared: create a minimal consumer with a full install ──────────────────
make_consumer() {
  local T
  T=$(mktemp -d)
  printf '{ "name":"consumer","version":"0.0.0" }\n' > "$T/package.json"
  ( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server ) >/dev/null 2>&1
  echo "$T"
}

# A react-next consumer — ships the preset eslint-rules-local rules (no-server-imports-in-client)
# that the ts-server consumer above does NOT, needed to exercise the preset refresh sub-population.
make_consumer_next() {
  local T
  T=$(mktemp -d)
  printf '{ "name":"consumer","version":"0.0.0" }\n' > "$T/package.json"
  ( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" react-next ) >/dev/null 2>&1
  echo "$T"
}

# ══════════════════════════════════════════════════════════════════════════════
# TEST 1 — stale-refreshed (paired-negative)
# Plant stale content in a framework-owned agent, run --refresh, assert the
# current content is now present. The paired-negative arm shows the assertion
# FAILS when refresh is not run (i.e. the test cannot pass vacuously).
# ══════════════════════════════════════════════════════════════════════════════
TC=$(make_consumer)
AGENT_DST="$TC/.claude/agents/compliance-verifier.md"
CURRENT_CONTENT=$(cat "$AGENT_DST")
STALE_MARKER="STALE_CONTENT_INJECTED_BY_TEST"

# Plant stale content
printf '%s\n' "$STALE_MARKER" > "$AGENT_DST"

# Run --refresh (non-dry-run so it actually writes)
( cd "$TC" && bash "$REPO_ROOT/install.sh" --refresh ) >/dev/null 2>&1

# Assert: stale content replaced by current framework content
if grep -qF "$STALE_MARKER" "$AGENT_DST"; then
  bad "stale-refreshed pos: stale marker still present after --refresh (file was NOT refreshed)"
else
  ok "stale-refreshed pos: stale marker gone after --refresh (file was refreshed)"
fi

# Assert: file now matches the current framework source
CURRENT_SOURCE=$(cat "$REPO_ROOT/agents/compliance-verifier.md")
if [ "$(cat "$AGENT_DST")" = "$CURRENT_SOURCE" ]; then
  ok "stale-refreshed pos: refreshed content matches framework source (not a truncated stub)"
else
  bad "stale-refreshed pos: refreshed content does NOT match framework source"
fi

# neg (LOAD-BEARING): WITHOUT refresh, stale content persists — proves assertion is non-vacuous.
TC_NEG=$(make_consumer)
AGENT_DST_NEG="$TC_NEG/.claude/agents/compliance-verifier.md"
printf '%s\n' "$STALE_MARKER" > "$AGENT_DST_NEG"
# Do NOT run --refresh
if grep -qF "$STALE_MARKER" "$AGENT_DST_NEG"; then
  ok "stale-refreshed neg: without --refresh, stale marker persists (assertion is non-vacuous)"
else
  bad "stale-refreshed neg: stale marker gone even without --refresh → test was vacuous"
fi

rm -rf "$TC" "$TC_NEG"

# ══════════════════════════════════════════════════════════════════════════════
# TEST 2 — customise-survives
# Consumer uses .override.md to signal Layer-3 ownership of an agent file.
# After --refresh:
#   (a) the .override.md is preserved (consumer customization survives)
#   (b) the overridden agent's base file is NOT clobbered (skip because override present)
#   (c) a DIFFERENT agent (no override) IS refreshed (proves refresh ran, not a no-op)
# ══════════════════════════════════════════════════════════════════════════════
TC2=$(make_consumer)
AGENT_OWNED="$TC2/.claude/agents/living-docs-auditor.md"      # will get override.md
AGENT_OTHER="$TC2/.claude/agents/compliance-verifier.md"      # no override → must be refreshed

# Plant stale content in BOTH agents (so we can distinguish skip vs. refresh)
STALE2="STALE_CONSUMER_EDIT_DO_NOT_CLOBBER"
printf '%s\n' "$STALE2" > "$AGENT_OWNED"
printf '%s\n' "$STALE2" > "$AGENT_OTHER"

# Create the override file (consumer signals Layer-3 ownership of living-docs-auditor)
OVERRIDE_FILE="${AGENT_OWNED%.md}.override.md"
printf '# Consumer override for living-docs-auditor\n' > "$OVERRIDE_FILE"
OVERRIDE_CONTENT=$(cat "$OVERRIDE_FILE")

# Run --refresh
( cd "$TC2" && bash "$REPO_ROOT/install.sh" --refresh ) >/dev/null 2>&1

# (a) override file preserved untouched
if [ "$(cat "$OVERRIDE_FILE")" = "$OVERRIDE_CONTENT" ]; then
  ok "customise-survives: .override.md is preserved after --refresh"
else
  bad "customise-survives: .override.md was modified by --refresh (consumer customization lost)"
fi

# (b) the overridden agent base file is NOT clobbered (skip because override.md present)
if grep -qF "$STALE2" "$AGENT_OWNED"; then
  ok "customise-survives: overridden agent base file NOT clobbered (.override.md respected)"
else
  bad "customise-survives: overridden agent base file WAS clobbered despite .override.md"
fi

# (c) the non-overridden agent IS refreshed (proves refresh actually ran)
if grep -qF "$STALE2" "$AGENT_OTHER"; then
  bad "customise-survives: non-overridden agent still has stale content (refresh was a no-op?)"
else
  ok "customise-survives: non-overridden agent was refreshed (refresh is not a no-op)"
fi

# neg (LOAD-BEARING): without override.md, stale agent IS refreshed (no protection)
TC2_NEG=$(make_consumer)
AGENT_UNPROTECTED="$TC2_NEG/.claude/agents/living-docs-auditor.md"
printf '%s\n' "$STALE2" > "$AGENT_UNPROTECTED"
# No override file created
( cd "$TC2_NEG" && bash "$REPO_ROOT/install.sh" --refresh ) >/dev/null 2>&1
if grep -qF "$STALE2" "$AGENT_UNPROTECTED"; then
  bad "customise-survives neg: without .override.md, stale content persisted (refresh skipped it — wrong)"
else
  ok "customise-survives neg: without .override.md, agent was refreshed (override.md is the protection signal)"
fi

rm -rf "$TC2" "$TC2_NEG"

# ══════════════════════════════════════════════════════════════════════════════
# TEST 3 — dry-run preview is faithful (shows what would happen, writes nothing)
# ══════════════════════════════════════════════════════════════════════════════
TC3=$(make_consumer)
AGENT_STALE="$TC3/.claude/agents/memory-codification-auditor.md"
printf '%s\n' "STALE_DRYRUN_MARKER" > "$AGENT_STALE"

DRY_OUT=$( cd "$TC3" && bash "$REPO_ROOT/install.sh" --refresh --dry-run 2>&1 )

# Dry-run must mention the agent
if printf '%s\n' "$DRY_OUT" | grep -q "memory-codification-auditor.md"; then
  ok "dry-run: output mentions the stale agent file"
else
  bad "dry-run: output does not mention memory-codification-auditor.md"
fi

# Dry-run must NOT have written the file (stale marker must persist)
if grep -q "STALE_DRYRUN_MARKER" "$AGENT_STALE"; then
  ok "dry-run: stale marker still present after --dry-run (nothing was written)"
else
  bad "dry-run: stale marker gone after --dry-run (dry-run wrote the file — wrong)"
fi

# neg: confirm real refresh DOES write (proves dry-run guard is real, not vacuous)
( cd "$TC3" && bash "$REPO_ROOT/install.sh" --refresh ) >/dev/null 2>&1
if grep -q "STALE_DRYRUN_MARKER" "$AGENT_STALE"; then
  bad "dry-run neg: real --refresh left the stale marker (refresh was a no-op — proves nothing)"
else
  ok "dry-run neg: real --refresh removed stale marker (dry-run guard was real, non-vacuous)"
fi

rm -rf "$TC3"

# ══════════════════════════════════════════════════════════════════════════════
# TEST 4 — #635: --refresh ships the hooks {"type":"module"} marker
# A consumer that predates the marker (or whose marker was lost) must regain
# packages/core/hooks/package.json on --refresh — else the refreshed multi-file
# pre-push.ts loads as CJS and dies with ERR_REQUIRE_CYCLE_MODULE on Node ≥22.
# Paired-negative: WITHOUT --refresh the deleted marker stays absent (non-vacuous).
# ══════════════════════════════════════════════════════════════════════════════
TC4=$(make_consumer)
MARKER_DST="$TC4/packages/core/hooks/package.json"
MARKER_SRC="$REPO_ROOT/packages/core/templates/shared/hooks-package.json"

# Simulate the pre-fix state: a consumer that has no type:module marker.
rm -f "$MARKER_DST"

# Run --refresh (non-dry-run so it actually writes)
( cd "$TC4" && bash "$REPO_ROOT/install.sh" --refresh ) >/dev/null 2>&1

# (pos) marker now exists and equals the shipped source (not a stub)
if [ -f "$MARKER_DST" ]; then
  ok "gh-635 pos: hooks/package.json exists after --refresh (marker re-shipped)"
else
  bad "gh-635 pos: hooks/package.json still ABSENT after --refresh (#635 not fixed)"
fi
if [ -f "$MARKER_DST" ] && [ "$(cat "$MARKER_DST")" = "$(cat "$MARKER_SRC")" ]; then
  ok "gh-635 pos: refreshed marker content equals shipped hooks-package.json (type:module, not a stub)"
else
  bad "gh-635 pos: refreshed marker does NOT match shipped source"
fi

# neg (LOAD-BEARING): delete the marker, do NOT refresh → it stays absent (non-vacuous).
TC4_NEG=$(make_consumer)
MARKER_NEG="$TC4_NEG/packages/core/hooks/package.json"
rm -f "$MARKER_NEG"
# Do NOT run --refresh
if [ ! -f "$MARKER_NEG" ]; then
  ok "gh-635 neg: without --refresh, deleted marker stays absent (assertion is non-vacuous)"
else
  bad "gh-635 neg: marker reappeared without --refresh → test was vacuous"
fi

rm -rf "$TC4" "$TC4_NEG"

# ══════════════════════════════════════════════════════════════════════════════
# TEST 5 — #869: --refresh ships the framework audit-gate SCRIPTS that --full delivers
# A consumer that installed BEFORE #831 (shields-up accepts husky-v9 .husky/_) or
# #837 (fences-fire files: key + TS parser) can regain those fixes only via a
# non-destructive path if do_refresh() re-copies the scripts. copy_safe skips-if-
# exists, so a plain --full never updates them on a brownfield consumer →
# check:fences-fire / check:shields-up false-RED forever. Same class as TEST 4
# (#635) and #735. Includes run-generated-rule-mutation.sh (the issue's "Consider":
# the consumer-shipped mutation surface, also --full-delivered but refresh-omitted).
# Paired-negative: WITHOUT --refresh each planted stale marker persists (non-vacuous).
# ══════════════════════════════════════════════════════════════════════════════
TC5=$(make_consumer)
STALE5="STALE_GATE_SCRIPT_INJECTED_PRE_869"
# <consumer scripts/ basename> | <framework source relative to REPO_ROOT>
# — mirrors the copy_safe delivery in setup.d/40-configs.sh (check-fences-fire :51,
#   check-shields-up :57, run-generated-rule-mutation :61).
GATE_SCRIPTS=(
  "check-fences-fire.sh|packages/core/audit-self/check-fences-fire.sh"
  "check-shields-up.sh|packages/core/audit-self/check-shields-up.sh"
  "run-generated-rule-mutation.sh|packages/core/synthesizer/run-generated-rule-mutation.sh"
)

# Plant stale content in each shipped gate script (simulate a pre-fix brownfield copy)
for _entry in "${GATE_SCRIPTS[@]}"; do
  _name="${_entry%%|*}"
  printf '%s\n' "$STALE5" > "$TC5/scripts/$_name"
done

# Run --refresh (non-dry-run so it actually writes)
( cd "$TC5" && bash "$REPO_ROOT/install.sh" --refresh ) >/dev/null 2>&1

# pos: each gate script is refreshed to the framework source (not the stale stub)
for _entry in "${GATE_SCRIPTS[@]}"; do
  _name="${_entry%%|*}"; _src="${_entry##*|}"
  _dst="$TC5/scripts/$_name"
  if grep -qF "$STALE5" "$_dst"; then
    bad "gh-869 pos: $_name still stale after --refresh (omitted from do_refresh copy-list)"
  elif [ "$(cat "$_dst")" = "$(cat "$REPO_ROOT/$_src")" ]; then
    ok "gh-869 pos: $_name refreshed to framework source (matches, not a truncated stub)"
  else
    bad "gh-869 pos: $_name changed but does NOT match framework source $_src"
  fi
done

# neg (LOAD-BEARING): plant stale, do NOT refresh → stale persists (proves non-vacuity)
TC5_NEG=$(make_consumer)
for _entry in "${GATE_SCRIPTS[@]}"; do
  _name="${_entry%%|*}"
  printf '%s\n' "$STALE5" > "$TC5_NEG/scripts/$_name"
done
# Do NOT run --refresh
_neg_all_stale=1
for _entry in "${GATE_SCRIPTS[@]}"; do
  _name="${_entry%%|*}"
  grep -qF "$STALE5" "$TC5_NEG/scripts/$_name" || _neg_all_stale=0
done
if [ "$_neg_all_stale" -eq 1 ]; then
  ok "gh-869 neg: without --refresh, all planted gate scripts stay stale (assertion non-vacuous)"
else
  bad "gh-869 neg: a gate script lost its stale marker without --refresh → test was vacuous"
fi

rm -rf "$TC5" "$TC5_NEG"

# ══════════════════════════════════════════════════════════════════════════════
# TEST 6 — #869-class on the .husky/ + eslint-rules-local/ surfaces
# The refresh-covers-full-delivery gate proved these framework surfaces are now in
# do_refresh statically; this arm proves the refresh ACTUALLY writes them on a real
# consumer. .husky/pre-push staleness is the worst case (a pre-#636 dispatcher HARD-
# CRASHES instead of degrading to the bash fallback on a pnpm monorepo). eslint-rules-
# local/ ships framework-authored core rules (lib.sh:194 "consumer never owns") as
# pre-compiled .mjs + .ts. Paired-negative: WITHOUT --refresh each stays stale.
# ══════════════════════════════════════════════════════════════════════════════
TC6=$(make_consumer)
STALE6="STALE_FRAMEWORK_ARTEFACT_INJECTED_PRE_869B"
# <consumer path> | <framework source relative to REPO_ROOT>
FRAMEWORK_ARTEFACTS=(
  ".husky/pre-commit|packages/core/templates/shared/husky-pre-commit.sh"
  ".husky/pre-push|packages/core/templates/shared/husky-pre-push.sh"
  "eslint-rules-local/no-unsafe-zod-parse.ts|packages/core/eslint-rules/no-unsafe-zod-parse.ts"
  "eslint-rules-local/no-unsafe-zod-parse.mjs|packages/core/eslint-rules/no-unsafe-zod-parse.mjs"
)

# Plant stale content in each shipped framework artefact
for _entry in "${FRAMEWORK_ARTEFACTS[@]}"; do
  _name="${_entry%%|*}"
  printf '%s\n' "$STALE6" > "$TC6/$_name"
done

# Run --refresh
( cd "$TC6" && bash "$REPO_ROOT/install.sh" --refresh ) >/dev/null 2>&1

# pos: each artefact is refreshed to the framework source
for _entry in "${FRAMEWORK_ARTEFACTS[@]}"; do
  _name="${_entry%%|*}"; _src="${_entry##*|}"
  _dst="$TC6/$_name"
  if grep -qF "$STALE6" "$_dst"; then
    bad "gh-869b pos: $_name still stale after --refresh (omitted from do_refresh)"
  elif [ "$(cat "$_dst")" = "$(cat "$REPO_ROOT/$_src")" ]; then
    ok "gh-869b pos: $_name refreshed to framework source (matches, not a truncated stub)"
  else
    bad "gh-869b pos: $_name changed but does NOT match framework source $_src"
  fi
done

# neg (LOAD-BEARING): plant stale, do NOT refresh → stale persists (proves non-vacuity)
TC6_NEG=$(make_consumer)
for _entry in "${FRAMEWORK_ARTEFACTS[@]}"; do
  _name="${_entry%%|*}"
  printf '%s\n' "$STALE6" > "$TC6_NEG/$_name"
done
# Do NOT run --refresh
_neg6_all_stale=1
for _entry in "${FRAMEWORK_ARTEFACTS[@]}"; do
  _name="${_entry%%|*}"
  grep -qF "$STALE6" "$TC6_NEG/$_name" || _neg6_all_stale=0
done
if [ "$_neg6_all_stale" -eq 1 ]; then
  ok "gh-869b neg: without --refresh, all planted framework artefacts stay stale (assertion non-vacuous)"
else
  bad "gh-869b neg: a framework artefact lost its stale marker without --refresh → test was vacuous"
fi

rm -rf "$TC6" "$TC6_NEG"

# ══════════════════════════════════════════════════════════════════════════════
# TEST 7 — #869-class on the eslint-rules-local/ PRESET sub-population (react-next)
# The core rules ship to eslint-rules-local/ on every stack; the PRESET rules ship
# only per-stack (react-next → no-server-imports-in-client, react-spa → require-
# error-boundary). do_refresh's eslint-rules-local loop originally iterated the CORE
# glob only, stranding preset rules on react-next/react-spa consumers (a live #869
# gap the ts-server-based TEST 6 could not see). This arm proves a PRESET rule
# refreshes on a react-next consumer. Paired-negative: WITHOUT --refresh it stays stale.
# ══════════════════════════════════════════════════════════════════════════════
TC7=$(make_consumer_next)
STALE7="STALE_PRESET_RULE_INJECTED_PRE_869C"
# both a CORE rule (control — was already refreshed) and the PRESET rule (the gap)
PRESET_ARTEFACTS=(
  "eslint-rules-local/no-unsafe-zod-parse.mjs|packages/core/eslint-rules/no-unsafe-zod-parse.mjs"
  "eslint-rules-local/no-server-imports-in-client.ts|packages/preset-next-15-canonical/eslint-rules/no-server-imports-in-client.ts"
  "eslint-rules-local/no-server-imports-in-client.mjs|packages/preset-next-15-canonical/eslint-rules/no-server-imports-in-client.mjs"
)

# Precondition: the preset rule must actually have been delivered (else the test is vacuous)
if [ ! -f "$TC7/eslint-rules-local/no-server-imports-in-client.mjs" ]; then
  bad "gh-869c precondition: react-next install did NOT ship the preset rule → cannot test its refresh"
else
  ok "gh-869c precondition: react-next install shipped the preset rule no-server-imports-in-client.mjs"

  for _entry in "${PRESET_ARTEFACTS[@]}"; do
    _name="${_entry%%|*}"
    printf '%s\n' "$STALE7" > "$TC7/$_name"
  done
  ( cd "$TC7" && bash "$REPO_ROOT/install.sh" --refresh ) >/dev/null 2>&1
  for _entry in "${PRESET_ARTEFACTS[@]}"; do
    _name="${_entry%%|*}"; _src="${_entry##*|}"
    _dst="$TC7/$_name"
    if grep -qF "$STALE7" "$_dst"; then
      bad "gh-869c pos: $_name still stale after --refresh (preset omitted from do_refresh)"
    elif [ "$(cat "$_dst")" = "$(cat "$REPO_ROOT/$_src")" ]; then
      ok "gh-869c pos: $_name refreshed to framework source (matches, not a truncated stub)"
    else
      bad "gh-869c pos: $_name changed but does NOT match framework source $_src"
    fi
  done

  # neg (LOAD-BEARING): plant stale in the preset rule, do NOT refresh → stays stale
  TC7_NEG=$(make_consumer_next)
  printf '%s\n' "$STALE7" > "$TC7_NEG/eslint-rules-local/no-server-imports-in-client.mjs"
  if grep -qF "$STALE7" "$TC7_NEG/eslint-rules-local/no-server-imports-in-client.mjs"; then
    ok "gh-869c neg: without --refresh, planted preset rule stays stale (assertion non-vacuous)"
  else
    bad "gh-869c neg: preset rule lost its stale marker without --refresh → test was vacuous"
  fi
  rm -rf "$TC7_NEG"
fi
rm -rf "$TC7"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
