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

# ── npm-lane layers only (the Python lane is covered separately by Check 4 below) ──────────────────
# do_refresh() is the npm-flow refresh. The Python-lane layer (setup.d/45-python.sh) is gated on
# GETFF_TOOLCHAIN=python and INERT on the npm flow (byte-identical.test.sh proves it); its copy_safe
# deliveries are NOT mirrored by the npm do_refresh() — the Python lane has its OWN (S2) refresh path
# (GETFF_TOOLCHAIN_REFRESH → refresh_safe, inside 45-python.sh). The S1-era blanket exclusion ("out of
# this gate's population") is REPLACED (S2) by the real python-lane refresh-parity assertion in Check 4
# below: 45-python.sh is no longer un-covered, it is scanned against its own refresh path. Here we scan
# only the npm-lane layers so Checks 1-3 (npm FULL ⊆ do_refresh) are not polluted by the python lane.
NPM_LANE_LAYERS=()
for _lyr in "$REPO_ROOT"/setup.d/[0-9]*.sh; do
  case "$_lyr" in */45-python.sh) continue ;; esac
  NPM_LANE_LAYERS+=("$_lyr")
done
# Guard the empty-array expansion: under `set -u` on bash 3.2 (macOS), "${NPM_LANE_LAYERS[@]}"
# with an empty array throws "unbound variable" and aborts the test ungracefully. Same shape as
# setup.d/lib.sh:281-283 (_prettierignore_in_skipped's SKIPPED guard) — check length first, fail
# the test cleanly with a message rather than crashing on the array expansion below.
[ "${#NPM_LANE_LAYERS[@]}" -gt 0 ] || { echo "FATAL: NPM_LANE_LAYERS empty — setup.d/[0-9]*.sh glob found no npm-lane layers"; exit 1; }

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
  # Storybook scaffold (react-next): starter configs the consumer customises (addons, decorators)
  # — same class as vitest/playwright configs above; seeded once, never clobbered by refresh.
  .storybook/main.ts
  .storybook/preview.ts
  eslint.config.mjs
  eslint.config.rn-common.mjs
  .github/workflows/ci.yml
  .github/workflows/workflow-integrity.yml
  AGENTS.md
  # Project-anchor digest (GH #934 batch D): shipped EMPTY as a starter; the consumer fills it with
  # their own project digest → consumer-owned, refresh must never clobber their content.
  .claude/session-bootstrap.md
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
# S4 (getff-honest-signals): workflow deliveries moved from copy_safe onto deliver_getff_workflow
# (which is copy_safe-equivalent + branch substitution). beta-ai-docs-agnosticism S1: the consumer
# root AGENTS.md moved from copy_safe onto install_agents_md (merge_fenced — section-scoped
# co-ownership, since another generator also writes that file). The verb alternation MUST include
# EVERY such verb, or those destinations silently drop out of FULL → Check 2 (EXCLUDED ⊆ FULL)
# flags them as stale exclusions (false RED), and Check 1 (FULL ⊆ REFRESH ∪ EXCLUDED) stops seeing
# them at all (silent green — the #blind-gate shape this whole stage exists to kill).
# AGENTS.md stays EXCLUDED from do_refresh: refresh_safe rewrites a WHOLE file, which is precisely
# wrong for a co-owned one. Re-injecting only the fence on refresh is now mechanically possible and
# is a deliberate follow-up, not a silent behaviour change here.
#
# VARIABLE-INDIRECTED DESTINATIONS (a false-GREEN hole this scan carried from its first version). A delivery
# written as `copy_safe "$HOOK_SRC" "$HOOK_DST"` carries NO literal $PROJECT_ROOT token, so the
# line scan collected nothing from it and the artefact escaped FULL entirely — not reported as a
# gap, simply never seen. Live blast radius when measured: the whole of
# setup.d/55-runtime-bridge-vendor.sh (its single copy_safe line is exactly that shape) plus all
# eight .claude/hooks/ deliveries in setup.d/10-skills.sh. That blindness is why #1412's sweep of
# the refresh-drift class could not surface the vendor gap — the gate covering the class did not
# cover the layer. Resolution below substitutes simple `VAR="$PROJECT_ROOT/<literal>"` assignments
# back into that file's lines before extraction, PER FILE (never corpus-wide: layers reuse the same
# variable names — HOOK_DST means a different path in 10-skills.sh and in 55-runtime-bridge-vendor.sh).
resolve_layer() {  # $1 = layer file → its non-comment text with $VAR dsts substituted
  local lyr="$1" body sedexpr
  body=$(grep -vE '^[[:space:]]*#' "$lyr")
  # The substitution consumes the CLOSING QUOTE too (`s#\$VAR"#<literal>"#g`). Matching a bare
  # `\$VAR` would also rewrite the prefix of a longer name ($HOOK_DST inside $HOOK_DST_OLD), and
  # BSD sed (macOS, where this suite also runs) has no \b word boundary to lean on.
  # shellcheck disable=SC2016
  sedexpr=$(printf '%s\n' "$body" \
    | grep -oE '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*="\$PROJECT_ROOT/[A-Za-z0-9._/-]*"' \
    | sed -E 's/^[[:space:]]*//' \
    | while IFS='=' read -r _v _val; do
        _val=${_val#\"}; _val=${_val%\"}
        printf 's#\\$%s"#%s"#g\n' "$_v" "$_val"
      done | tr '\n' ';' | sed 's/;$//')
  if [ -n "$sedexpr" ]; then printf '%s\n' "$body" | sed -E "$sedexpr"; else printf '%s\n' "$body"; fi
}
LAYER_TEXT=$(for _lyr in "${NPM_LANE_LAYERS[@]}"; do resolve_layer "$_lyr"; done)
DELIVER_LINES=$(printf '%s\n' "$LAYER_TEXT" | grep -E 'copy_safe|deliver_getff_workflow|install_agents_md')
[ -n "$DELIVER_LINES" ] || { echo "FATAL: no delivery lines found across the npm-lane layers — resolve_layer broke"; exit 1; }
# shellcheck disable=SC2016  # single-quoted regex matches the literal '$PROJECT_ROOT' in source; no expansion intended
FULL=$(printf '%s\n' "$DELIVER_LINES" | grep -oE '\$PROJECT_ROOT/[A-Za-z0-9._/-]*' | sed -E 's#\$PROJECT_ROOT/##' | sort -u)

# Fail loud if a copy_safe/deliver_getff_workflow dst begins with an immediate variable
# ("$PROJECT_ROOT/$x") — it would normalize to the empty string and silently escape FULL
# (a false-GREEN hole). None exist today.
# shellcheck disable=SC2016
if printf '%s\n' "$DELIVER_LINES" | grep -qE '"\$PROJECT_ROOT/\$'; then
  echo "FATAL: a copy_safe/deliver_getff_workflow dst starts with an immediate \$var after \$PROJECT_ROOT/ — unparseable; extend the gate"; exit 1
fi

# ── Guard: every STILL-variable dst must be a KNOWN out-of-population form ───────────────────────
# Resolution above handles the dominant shape. Anything left is a dst this scan cannot read, and
# an unread dst is invisible rather than flagged — so the residue is enumerated by name with the
# reason it is out of population, and a NEW one is FATAL instead of silently escaping. This is the
# guard that would have caught $HOOK_DST at the moment layer 55 was written.
UNPARSEABLE_DST=$(sed -E 's/#.*//; s/^[[:space:]]+//; s/[[:space:]]+$//' <<'UNP' | sed '/^$/d'
  _dst        # 20-agents.sh: $(basename) glob loop — namespace-covered (.claude/agents/, per GRANULARITY above)
  _ws_abs     # 40-configs.sh: per-workspace eslint config — workspace-relative, never under $PROJECT_ROOT literally
  dst         # 46-cargo.sh / 47-go.sh: toolchain-lane local; those lanes carry their own refresh path (cf. Check 4)
  wf_dst      # 46-cargo.sh / 47-go.sh: toolchain-lane workflow dst — same lane, same reason
  2           # 46-cargo.sh / 47-go.sh: generic `copy_safe "$1" "$2"` wrapper — call sites are what carry the real dst
UNP
)
[ -n "$UNPARSEABLE_DST" ] || { echo "FATAL: UNPARSEABLE_DST empty — heredoc parse broke"; exit 1; }
# Last quoted token of a delivery line is its dst (trailing comment stripped first). A dst that
# reads (or resolved to) "$PROJECT_ROOT/…" is exactly what FULL collected — only the residue counts.
unresolved_dst_vars() {
  printf '%s\n' "$DELIVER_LINES" | sed -E 's/[[:space:]]+#[^"]*$//' \
    | sed -E 's/.*"([^"]*)"[[:space:]]*$/\1/' \
    | grep -v '^\$PROJECT_ROOT/' \
    | grep '^\$' | sed -E 's/^\$\{?([A-Za-z_0-9][A-Za-z0-9_]*).*/\1/' | sort -u
}
new_var_dst=""
for _v in $(unresolved_dst_vars); do
  printf '%s\n' "$UNPARSEABLE_DST" | grep -qxF "$_v" || new_var_dst="$new_var_dst \$$_v"
done
if [ -z "${new_var_dst// }" ]; then
  ok "dst-resolution: every delivery dst is either a resolved \$PROJECT_ROOT path or a declared out-of-population form"
else
  bad "dst-resolution: delivery dst(s) this scan cannot read and that are NOT declared out-of-population → the artefact escapes FULL unflagged (the variable-dst hole):$new_var_dst"
fi
# neg (LOAD-BEARING): a synthetic variable dst must be reported, or the guard reads nothing.
if printf '%s\n' '  copy_safe "$SRC" "$BRAND_NEW_DST"' | sed -E 's/.*"([^"]*)"[[:space:]]*$/\1/' \
   | grep '^\$' | sed -E 's/^\$\{?([A-Za-z_0-9][A-Za-z0-9_]*).*/\1/' | grep -qx 'BRAND_NEW_DST'; then
  ok "neg (dst-resolution): a synthetic \$VAR dst is extracted by the same predicate (guard non-vacuous)"
else
  bad "neg (dst-resolution): synthetic \$VAR dst slipped the extractor → the guard is VACUOUS"
fi

# ── REFRESH: every consumer path do_refresh() actually WRITES to (write-intent lines only) ──────
# Extract from the do_refresh body but EXCLUDE comment / echo / chmod_safe lines: a path that
# survives ONLY in a comment or a chmod_safe line is NOT refreshed. (Without this, removing a
# `refresh_safe … "$PROJECT_ROOT/.husky/pre-push"` line left the path "present" via its sibling
# `chmod_safe +x … .husky/pre-push` line → false-GREEN.) Two write-intent forms remain:
# (a) "$PROJECT_ROOT/<path>" on refresh_safe / cp / var-assignment lines (normalized like FULL);
# (b) the "<src>:scripts/<dst>" _pair data lines consumed via the $_d loop var (literal basenames).
#
# TEST EXPRESSIONS are the same false-GREEN shape on a newer surface. Every depth-gated arm
# #1312/#1334 introduced ends its gate with a PRESENCE PROBE — `|| [ -e "$PROJECT_ROOT/<artefact>" ]`
# — which reads the path, never writes it, yet made it "present" in REFRESH exactly the way the
# chmod_safe sibling used to. Measured live: with the probe counted, deleting the vendor payload's
# real `refresh_safe` line left this gate GREEN. Bracket test groups are STRIPPED rather than their
# lines dropped, because guarded one-liners (`[ -f "$src" ] && refresh_safe "$src" "$dst"`) carry a
# genuine write on the same line and dropping those would false-RED.
refresh_body() {
  awk '/^do_refresh\(\) \{/{f=1} f{print} f&&/^\}/{exit}' "$INSTALL"
}
refresh_writes() {  # do_refresh body minus comment / echo / chmod_safe lines + test groups (non-write noise)
  refresh_body | grep -vE '^[[:space:]]*#|^[[:space:]]*echo |chmod_safe' | sed 's/\[[^]]*\]//g'
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

# ── Check 4 (python-lane refresh parity — replaces the S1 blanket exclusion of 45-python.sh) ─────
# The python delivery layer (setup.d/45-python.sh) has its OWN refresh path (S2), separate from the
# npm-lane do_refresh() — so it is scanned HERE, not folded into the npm FULL/REFRESH sets above.
# Every framework-owned artefact it delivers (identified by its `$tpl/<x>` TEMPLATE SOURCE — everything
# copied FROM the template dir is framework-owned) MUST also be re-delivered on --refresh, or a
# brownfield python consumer never receives updated ast-grep rules (the #869 refresh-drift class, on
# the python surface). Source-token parity (not dst) because the ruff.toml template feeds two dsts
# (ruff.toml + getff-ruff.toml) — the source is the unambiguous key. `_py_copy_or_refresh` call sites
# deliver on BOTH paths, so they count for copy AND refresh; explicit copy_safe / refresh_safe lines
# count for their own side only.
PY_LAYER="$REPO_ROOT/setup.d/45-python.sh"
[ -f "$PY_LAYER" ] || { echo "FATAL: $PY_LAYER not found"; exit 1; }
# shellcheck disable=SC2016
# S4 (getff-honest-signals): python workflow delivery moved from copy_safe onto deliver_getff_workflow.
# The verb alternation MUST include deliver_getff_workflow here, or $tpl/github-actions-ci.yml silently
# drops out of the FRESH set and the subset check below stays green while covering nothing (blind gate).
PY_COPY_SRC=$(grep -hE 'copy_safe|_py_copy_or_refresh|deliver_getff_workflow' "$PY_LAYER" | grep -vE '^[[:space:]]*#' \
  | grep -oE '\$tpl/[A-Za-z0-9._/-]*' | sort -u)
# shellcheck disable=SC2016
# REFRESH side keys on the literal-prefix form `GETFF_TOOLCHAIN_REFRESH=1 deliver_getff_workflow` — NOT
# the bare verb — because matching the bare verb would also catch the FRESH-only call site (no env
# prefix) and manufacture a false green. Lookbehind is unavailable (grep -E is ERE, rejects (?<!...)).
PY_REFRESH_SRC=$(grep -hE 'refresh_safe|_py_copy_or_refresh|GETFF_TOOLCHAIN_REFRESH=1 deliver_getff_workflow' "$PY_LAYER" | grep -vE '^[[:space:]]*#' \
  | grep -oE '\$tpl/[A-Za-z0-9._/-]*' | sort -u)
[ -n "$PY_COPY_SRC" ] || { echo "FATAL: PY_COPY_SRC empty — 45-python.sh copy_safe \$tpl extraction broke"; exit 1; }
py_missing=""
for s in $PY_COPY_SRC; do
  printf '%s\n' "$PY_REFRESH_SRC" | grep -qxF "$s" || py_missing="$py_missing $s"
done
if [ -z "${py_missing// }" ]; then
  ok "python-lane: every framework-owned delivery in 45-python.sh has a --refresh path (no python refresh drift)"
else
  bad "python-lane: framework artefact(s) delivered on install but with NO --refresh path → brownfield python consumers can't get updated rules:$py_missing"
fi

# neg (LOAD-BEARING): drop one delivery source from the REFRESH set → Check 4 MUST flag it.
py_probe=$(printf '%s\n' "$PY_COPY_SRC" | head -1)
PY_REFRESH_BROKEN=$(printf '%s\n' "$PY_REFRESH_SRC" | grep -vxF "$py_probe")
py_neg_missing=""
for s in $PY_COPY_SRC; do
  printf '%s\n' "$PY_REFRESH_BROKEN" | grep -qxF "$s" || py_neg_missing="$py_neg_missing $s"
done
case " $py_neg_missing " in
  *" $py_probe "*) ok "neg (python): removing '$py_probe' from the refresh set flips the gate to flag it (non-vacuous)" ;;
  *) bad "neg (python): gate stayed green with '$py_probe' dropped → python parity check is VACUOUS" ;;
esac

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

# ── Check: runtime-bridge vendor — the DIRECTORY payload no verb scan can see ───────────────────
# setup.d/55-runtime-bridge-vendor.sh delivers two things, and only ONE of them is a copy_safe call
# the FULL scan above can reach: the dispatch hook. The vendor payload itself lands via a raw
# `rm -rf "$VENDOR_DST"; cp -r "$VENDOR_SRC" "$VENDOR_DST"` — no gate verb, so Check 1 is structurally
# blind to it, and «the hook is covered» would read as «the layer is covered». Assert both of the
# layer's destinations appear on the refresh side directly, the way the worktree-scripts list below
# is asserted rather than inferred. (The layer's own refresh path is the factory-gated arm in
# do_refresh; on --refresh the setup.d layers never run at all, so re-running the installer is the
# only other route and that is precisely the destructive path --refresh exists to avoid.)
RBV_LAYER="$REPO_ROOT/setup.d/55-runtime-bridge-vendor.sh"
if [ -f "$RBV_LAYER" ]; then
  # Same write-intent filter refresh_writes() applies, plus mkdir_safe: a parent directory the layer
  # ensures exists (.claude/vendor, .claude/hooks) is not an artefact, and counting it would demand
  # a refresh line for a namespace nobody delivers.
  # shellcheck disable=SC2016
  rbv_delivered=$(grep -vE '^[[:space:]]*#|^[[:space:]]*echo |chmod_safe|mkdir_safe' "$RBV_LAYER" \
    | grep -oE '\$PROJECT_ROOT/[A-Za-z0-9._/-]*' | sed -E 's#\$PROJECT_ROOT/##' | sort -u)
  rbv_refreshed=$(refresh_writes | grep -oE '\$PROJECT_ROOT/[A-Za-z0-9._/-]*' | sed -E 's#\$PROJECT_ROOT/##' | sort -u)
  if [ -z "$rbv_delivered" ]; then
    bad "runtime-bridge vendor parity: no \$PROJECT_ROOT destination parsed from 55-runtime-bridge-vendor.sh (delivery site moved, update this gate)"
  else
    rbv_missing=""
    for _d in $rbv_delivered; do
      printf '%s\n' "$rbv_refreshed" | grep -qxF "$_d" || rbv_missing="$rbv_missing $_d"
    done
    if [ -z "${rbv_missing// }" ]; then
      ok "runtime-bridge vendor parity: do_refresh writes every destination 55-runtime-bridge-vendor.sh delivers ($(printf '%s' "$rbv_delivered" | tr '\n' ' '))"
    else
      bad "runtime-bridge vendor parity: factory consumers cannot receive vendor fixes non-destructively — delivered but never refreshed:$rbv_missing"
    fi
    # neg (LOAD-BEARING): drop the vendor DIRECTORY from the refresh side — the half Check 1 cannot
    # see — and prove this check is what flags it.
    rbv_probe=".claude/vendor/runtime-bridge"
    if ! printf '%s\n' "$rbv_delivered" | grep -qxF "$rbv_probe"; then
      bad "neg (runtime-bridge vendor parity): '$rbv_probe' is no longer a delivered destination → probe stale, update this gate"
    else
      rbv_broken=$(printf '%s\n' "$rbv_refreshed" | grep -vxF "$rbv_probe")
      rbv_neg_missing=""
      for _d in $rbv_delivered; do
        printf '%s\n' "$rbv_broken" | grep -qxF "$_d" || rbv_neg_missing="$rbv_neg_missing $_d"
      done
      case " $rbv_neg_missing " in
        *" $rbv_probe "*) ok "neg (runtime-bridge vendor parity): dropping '$rbv_probe' from the refresh set flips the comparison (non-vacuous — and Check 1 alone never sees this half)" ;;
        *) bad "neg (runtime-bridge vendor parity): comparison stayed green with '$rbv_probe' dropped → VACUOUS" ;;
      esac
    fi
  fi
else
  bad "runtime-bridge vendor parity: setup.d/55-runtime-bridge-vendor.sh absent — delivery site moved, update this gate"
fi

# ── Check: the worktree-scripts list is duplicated, so assert the duplication ────────────────────
# setup.d/85-worktree-scripts.sh owns WORKTREE_SCRIPTS on the install path; do_refresh cannot read
# that array (the module is sourced only during install), so install.sh repeats the names. The
# set-difference check above only sees the truncated "scripts/" token for both sides, so it cannot
# catch a per-script divergence: adding a 5th script to the delivery array while forgetting the
# refresh loop would stay GREEN. This check closes that hole by comparing the two lists directly.
WT_MODULE="$REPO_ROOT/setup.d/85-worktree-scripts.sh"
if [ -f "$WT_MODULE" ]; then
  deliver_list=$(awk '/^WORKTREE_SCRIPTS=\(/{f=1;next} f&&/^\)/{exit} f{print}' "$WT_MODULE" \
    | grep -oE '[A-Za-z0-9._-]+\.sh' | sort -u)
  refresh_list=$(refresh_body \
    | awk '/for _ws in /{sub(/.*for _ws in /,""); sub(/; do.*/,""); print}' \
    | tr ' ' '\n' | grep -oE '[A-Za-z0-9._-]+\.sh' | sort -u)
  if [ -z "$deliver_list" ]; then
    bad "worktree-scripts parity: could not parse WORKTREE_SCRIPTS from 85-worktree-scripts.sh (gate broke)"
  elif [ -z "$refresh_list" ]; then
    bad "worktree-scripts parity: do_refresh has no '_ws' loop — the four scripts are not refreshed"
  elif [ "$deliver_list" = "$refresh_list" ]; then
    ok "worktree-scripts parity: do_refresh refreshes exactly the set 85-worktree-scripts.sh delivers"
  else
    bad "worktree-scripts parity: delivery/refresh lists DIVERGE — delivered=[$(echo "$deliver_list" | tr '\n' ' ')] refreshed=[$(echo "$refresh_list" | tr '\n' ' ')]"
  fi
  # neg — drop one name from the refresh side and prove the comparison flags it (non-vacuous).
  one=$(printf '%s\n' "$refresh_list" | head -1)
  if [ "$(printf '%s\n' "$refresh_list" | grep -vxF "$one")" = "$deliver_list" ]; then
    bad "neg (worktree-scripts parity): dropping '$one' left the lists equal → comparison is VACUOUS"
  else
    ok "neg (worktree-scripts parity): dropping '$one' from the refresh list flips the comparison (non-vacuous)"
  fi
else
  bad "worktree-scripts parity: setup.d/85-worktree-scripts.sh absent — delivery site moved, update this gate"
fi

# ── Check: skill-slug tier lists are an SSOT both arms READ (#1312) ──────────────────────────────
# The install arm (setup.d/10-skills.sh) and the refresh arm (do_refresh) each iterate a set of
# `.claude/skills/` slugs per depth tier. While both hard-coded their own copy, the two drifted
# three times (#1312: `arch` in no refresh loop at all, `rule-tests` announced-then-skipped,
# `claude-glm-executor-handoff` install-only) — and a name-comparison gate would keep re-deriving
# what one shared list makes impossible. So the lists live in setup.d/lib.sh as GETFF_SKILLS_*
# constants and this check asserts the structure that removes the drift class:
#   (a) both arms REFERENCE every tier constant lib.sh defines (a new tier cannot reach one arm
#       only), and (b) neither arm carries a literal-slug `for _skill in` loop (which would be a
#       fourth, unreconciled copy). Paired-negative arms below prove each half is non-vacuous.
LIB_SH="$REPO_ROOT/setup.d/lib.sh"
SKILLS_LAYER="$REPO_ROOT/setup.d/10-skills.sh"
[ -f "$LIB_SH" ] || { echo "FATAL: $LIB_SH not found"; exit 1; }
[ -f "$SKILLS_LAYER" ] || { echo "FATAL: $SKILLS_LAYER not found"; exit 1; }
TIER_VARS=$(grep -oE '^GETFF_SKILLS_[A-Z]+=' "$LIB_SH" | sed 's/=$//' | sort -u)
if [ -z "$TIER_VARS" ]; then
  bad "skill-tier SSOT: no GETFF_SKILLS_* tier constant defined in setup.d/lib.sh (install/refresh slug lists are still duplicated — #1312)"
else
  ok "skill-tier SSOT: setup.d/lib.sh defines the tier constants [$(echo "$TIER_VARS" | tr '\n' ' ')]"
  # tier_gaps <install-text> <refresh-text> — prints every tier var missing from either side.
  tier_gaps() {
    local itxt="$1" rtxt="$2" v
    for v in $TIER_VARS; do
      printf '%s\n' "$itxt" | grep -qF "\$$v" || { printf 'install:%s ' "$v"; continue; }
      printf '%s\n' "$rtxt" | grep -qF "\$$v" || printf 'refresh:%s ' "$v"
    done
  }
  INSTALL_TXT=$(grep -vE '^[[:space:]]*#' "$SKILLS_LAYER")
  REFRESH_TXT=$(refresh_writes)
  gaps=$(tier_gaps "$INSTALL_TXT" "$REFRESH_TXT")
  if [ -z "${gaps// }" ]; then
    ok "skill-tier SSOT: every tier constant is read by BOTH the install arm (10-skills.sh) and do_refresh"
  else
    bad "skill-tier SSOT: tier constant(s) reach only ONE arm → install/refresh slug drift (#1312 class): $gaps"
  fi
  # neg (LOAD-BEARING): strip one tier var's reference from the refresh side → MUST be flagged.
  probe_var=$(printf '%s\n' "$TIER_VARS" | head -1)
  REFRESH_TXT_BROKEN=$(printf '%s\n' "$REFRESH_TXT" | grep -vF "\$$probe_var")
  neg_gaps=$(tier_gaps "$INSTALL_TXT" "$REFRESH_TXT_BROKEN")
  case " $neg_gaps " in
    *" refresh:$probe_var "*) ok "neg (skill-tier SSOT): dropping \$$probe_var from the refresh side flips the check (non-vacuous)" ;;
    *) bad "neg (skill-tier SSOT): check stayed green with \$$probe_var dropped from do_refresh → VACUOUS" ;;
  esac
fi
# Literal-slug loops: a `for _skill in <names>` that does not read a tier constant is a new
# hand-maintained copy — the exact shape that drifted. Both arms are scanned.
literal_loops=$( { printf '%s\n' "$(grep -hE 'for _skill in ' "$SKILLS_LAYER" | grep -vE '^[[:space:]]*#')"
                   refresh_writes | grep -E 'for _skill in '
                 } | sed '/^$/d' | grep -v 'GETFF_SKILLS_' || true)
if [ -z "$literal_loops" ]; then
  ok "skill-tier SSOT: no literal-slug 'for _skill in' loop in either arm (no fourth copy)"
else
  bad "skill-tier SSOT: literal-slug loop(s) bypass the shared tier lists → drift can reland: $(printf '%s' "$literal_loops" | tr '\n' '|')"
fi
# neg (LOAD-BEARING): a synthetic literal loop MUST be caught by the same filter.
if printf '%s\n' '  for _skill in arch; do' | grep -v 'GETFF_SKILLS_' | grep -qE 'for _skill in '; then
  ok "neg (skill-tier SSOT): a synthetic literal-slug loop is caught by the filter (non-vacuous)"
else
  bad "neg (skill-tier SSOT): synthetic literal-slug loop slipped the filter → literal check is VACUOUS"
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
