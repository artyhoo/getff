#!/usr/bin/env bash
# cih-s3 F15 — install ships a .prettierignore that keeps prettier off the generated RULES.md.
# THE BUG: the shipped `.lintstagedrc.json` runs `*.md → prettier --write`; the generated
# `<!-- begin/end: rules-table-generated -->` region of .ai-factory/RULES.md is the rendered
# SSOT and is NOT prettier-format-stable → it gets reflowed (cosmetic churn on a static
# consumer; a recurring fight on a consumer that regenerates RULES.md via AIF recipes).
# THE FIX: ship a .prettierignore listing .ai-factory/RULES.md (+ RULES.react-next.md).
#
# PAIRED-NEGATIVE: the neg arm strips the entry from a copy and re-greps → MUST miss.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

T=$(mktemp -d)
printf '{ "name":"t","version":"0.0.0" }\n' > "$T/package.json"
( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1
PI="$T/.prettierignore"

[ -f "$PI" ] \
  && ok "F15 pos: .prettierignore shipped" \
  || bad "F15 pos: .prettierignore not installed"

grep -qx '.ai-factory/RULES.md' "$PI" \
  && ok "F15 pos: .prettierignore lists the generated .ai-factory/RULES.md" \
  || bad "F15 pos: .prettierignore does not ignore .ai-factory/RULES.md (generated table would reflow)"

# neg (LOAD-BEARING): remove the entry from a copy → grep MUST miss
grep -v '^\.ai-factory/RULES\.md$' "$PI" > "$PI.neg"
if grep -qx '.ai-factory/RULES.md' "$PI.neg"; then
  bad "F15 neg: stripped the entry but grep still matched → VACUOUS"
else
  ok "F15 neg: removing the entry flips the grep to miss (non-vacuous)"
fi
rm -f "$PI.neg"

# ── GH #531 (reopen): BROWNFIELD non-destructive .prettierignore merge ──
# THE BUG: install.sh used copy_safe (skip-if-exists) for .prettierignore → a consumer with a
# pre-existing .prettierignore never received the AIF exclusions → generated .ai-factory/RULES.md
# stayed un-ignored → `prettier --check .` re-broke. THE FIX: merge_prettierignore appends a
# marker-delimited block of missing AIF entries (idempotent on re-install).
# CRITICAL (#535-class false-green guard): install WITHOUT --force — --force bypasses the merge
# (overwrites wholesale via copy_safe), which would test the WRONG path.
TB=$(mktemp -d)
printf '{ "name":"brownfield","version":"0.0.0" }\n' > "$TB/package.json"
printf 'dist/\n' > "$TB/.prettierignore"   # pre-existing consumer .prettierignore (real content)
( cd "$TB" && git init -q && bash "$REPO_ROOT/install.sh" ts-server ) >/dev/null 2>&1
PIB="$TB/.prettierignore"

# (i) the consumer's original `dist/` line survives the merge.
grep -qx 'dist/' "$PIB" \
  && ok "F15 brownfield: consumer's original 'dist/' line survives the merge" \
  || bad "F15 brownfield: consumer's original 'dist/' line was destroyed (merge clobbered it)"

# (ii) the AIF block is now merged in (the generated RULES.md is excluded).
grep -qx '.ai-factory/RULES.md' "$PIB" \
  && ok "F15 brownfield: '.ai-factory/RULES.md' merged into the consumer .prettierignore" \
  || bad "F15 brownfield: '.ai-factory/RULES.md' NOT merged (brownfield consumer still re-breaks prettier)"

# (iii) idempotent: a 2nd install adds NO duplicate AIF block (begin-marker count stays 1).
( cd "$TB" && bash "$REPO_ROOT/install.sh" ts-server ) >/dev/null 2>&1
NMARK=$(grep -cF '# >>> rules-as-tests-aif (managed) >>>' "$PIB")
[ "$NMARK" -eq 1 ] \
  && ok "F15 brownfield: 2nd install adds NO duplicate AIF block (begin-marker count == 1)" \
  || bad "F15 brownfield: re-install duplicated the AIF block (begin-marker count = $NMARK, expected 1)"

# neg (LOAD-BEARING): a 3rd install must STILL keep the count at 1 — proving idempotency is real,
# not an artifact of the 2-install window. If the merge were non-idempotent the count would climb.
( cd "$TB" && bash "$REPO_ROOT/install.sh" ts-server ) >/dev/null 2>&1
NMARK3=$(grep -cF '# >>> rules-as-tests-aif (managed) >>>' "$PIB")
if [ "$NMARK3" -ne 1 ]; then
  bad "F15 brownfield neg: 3rd install climbed the marker count to $NMARK3 → merge is NOT idempotent"
else
  ok "F15 brownfield neg: 3rd install still count==1 (idempotency holds across re-installs, non-vacuous)"
fi

# paired-positive: greenfield (NO pre-existing file) still receives the file WITH .ai-factory/RULES.md.
TG=$(mktemp -d)
printf '{ "name":"greenfield","version":"0.0.0" }\n' > "$TG/package.json"
( cd "$TG" && git init -q && bash "$REPO_ROOT/install.sh" ts-server ) >/dev/null 2>&1
PIG="$TG/.prettierignore"
{ [ -f "$PIG" ] && grep -qx '.ai-factory/RULES.md' "$PIG"; } \
  && ok "F15 greenfield: no pre-existing file → .prettierignore copied WITH .ai-factory/RULES.md" \
  || bad "F15 greenfield: greenfield consumer did not receive a complete .prettierignore"

# ── #807 multi-stack: per-workspace configs the multi-stack branch ships must be in .prettierignore ──
# The #793/#796 multi-stack branch writes per-workspace eslint.config.mjs files; ignore_shipped_configs
# only knew root basenames, so prettier --check . reflowed them and format:check went RED. The fix
# discovers per-workspace configs and adds the shipped-fresh ones to the managed block, reusing the
# fresh-vs-SKIPPED guard. Real install, deps-free (</dev/null answers N). Install WITHOUT --force on
# the brownfield arm so copy_safe's skip-if-exists path (→ SKIPPED) is exercised, not bypassed.
MS807=$(mktemp -d)
printf '{ "name":"mono","private":true,"devDependencies":{"typescript":"5.6.0"} }\n' > "$MS807/package.json"
printf 'packages:\n  - "apps/*"\n' > "$MS807/pnpm-workspace.yaml"
mkdir -p "$MS807/apps/api"
printf '{ "name":"@m/api","dependencies":{"hono":"4.0.0"},"devDependencies":{"typescript":"5.6.0"} }\n' > "$MS807/apps/api/package.json"
mkdir -p "$MS807/apps/mobile"
printf '{ "name":"@m/mobile","dependencies":{"expo":"~52.0.0","react-native":"0.76.0","react":"18.3.0"} }\n' > "$MS807/apps/mobile/package.json"
( cd "$MS807" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force </dev/null ) >/dev/null 2>&1
PI807="$MS807/.prettierignore"

# (pos) the FRESH-shipped per-workspace configs are in the managed block.
grep -qx 'apps/api/eslint.config.mjs' "$PI807" \
  && ok "#807 pos: apps/api/eslint.config.mjs (fresh-shipped) added to .prettierignore managed block" \
  || bad "#807 pos: apps/api/eslint.config.mjs NOT in .prettierignore (format:check would reflow it)"
grep -qx 'apps/mobile/eslint.config.mjs' "$PI807" \
  && ok "#807 pos: apps/mobile/eslint.config.mjs (fresh-shipped) added to .prettierignore managed block" \
  || bad "#807 pos: apps/mobile/eslint.config.mjs NOT in .prettierignore"
# RN ships eslint.config.rn-common.mjs too — it must also be covered.
grep -qx 'apps/mobile/eslint.config.rn-common.mjs' "$PI807" \
  && ok "#807 pos: apps/mobile/eslint.config.rn-common.mjs (RN shared base, fresh-shipped) covered" \
  || bad "#807 pos: apps/mobile/eslint.config.rn-common.mjs NOT in .prettierignore"

# (PAIRED-NEGATIVE) a CONSUMER-authored per-workspace config (present before install → copy_safe
# SKIPs it → recorded in SKIPPED) must stay format-checked, i.e. NOT be added to the ignore block.
MSN807=$(mktemp -d)
printf '{ "name":"mono","private":true,"devDependencies":{"typescript":"5.6.0"} }\n' > "$MSN807/package.json"
printf 'packages:\n  - "apps/*"\n' > "$MSN807/pnpm-workspace.yaml"
mkdir -p "$MSN807/apps/api"
printf '{ "name":"@m/api","dependencies":{"hono":"4.0.0"},"devDependencies":{"typescript":"5.6.0"} }\n' > "$MSN807/apps/api/package.json"
# consumer already authored apps/api/eslint.config.mjs → install's copy_safe must SKIP it.
printf '// consumer-authored — do not ignore\nexport default [];\n' > "$MSN807/apps/api/eslint.config.mjs"
# install WITHOUT --force so copy_safe takes the skip-if-exists (→ SKIPPED) branch.
( cd "$MSN807" && git init -q && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) >/dev/null 2>&1
PIN807="$MSN807/.prettierignore"
# the consumer-authored config survived (copy_safe kept it) AND is NOT in the ignore block.
grep -q 'consumer-authored' "$MSN807/apps/api/eslint.config.mjs" \
  && ok "#807 neg: consumer-authored apps/api/eslint.config.mjs survived install (copy_safe kept it)" \
  || bad "#807 neg: consumer-authored config was overwritten (copy_safe clobbered it)"
if grep -qx 'apps/api/eslint.config.mjs' "$PIN807" 2>/dev/null; then
  bad "#807 neg: consumer-authored (SKIPPED) apps/api config was added to .prettierignore — would stop format-checking it"
else
  ok "#807 neg: consumer-authored (SKIPPED) apps/api config NOT ignored — stays format-checked (non-vacuous)"
fi

# ── #890: merge_prettierignore is GENUINELY idempotent, not run-once ──────────────────────────
# THE BUG: once the managed-block marker existed, merge_prettierignore early-returned unconditionally
# → the block's content was frozen at first-merge. A NEW shipped pattern (e.g. #889's
# .ai-factory/ARCHITECTURE.*.md) never reached an already-installed consumer via repeat --full or
# --refresh — only --force (wholesale copy_safe overwrite) delivered it. THE FIX: when the marker is
# present, diff the shipped source against the whole file and INSERT missing patterns INTO the
# existing block (single block, no duplicate marker).
# Unit-level: source lib.sh directly and drive the helper with an OLD then a NEW shipped source.
# NOT exported — a leaked INSTALL_SH_LIB_ONLY would put the integration arms' `bash install.sh`
# into lib-only mode (do_refresh would never run). unset right after sourcing for belt-and-braces.
INSTALL_SH_LIB_ONLY=1
PROJECT_ROOT="$REPO_ROOT"; FORCE=""; DRY_RUN=""
# shellcheck source=../../setup.d/lib.sh disable=SC1091
source "$REPO_ROOT/setup.d/lib.sh"
unset INSTALL_SH_LIB_ONLY

U=$(mktemp -d)
OLDSRC="$U/old"; NEWSRC="$U/new"; DSTU="$U/.prettierignore"
printf '%s\n' '.ai-factory/RULES.md' > "$OLDSRC"
printf '%s\n' '.ai-factory/RULES.md' '.ai-factory/ARCHITECTURE.react-native.md' '.ai-factory/tool-decisions.md' > "$NEWSRC"
printf 'dist/\n' > "$DSTU"   # pre-existing consumer file → merge path (creates the managed block)

merge_prettierignore "$OLDSRC" "$DSTU" >/dev/null 2>&1   # first merge: block gets .ai-factory/RULES.md only

# non-vacuity precondition: the NEW pattern is ABSENT after the old-template merge.
if grep -qxF '.ai-factory/tool-decisions.md' "$DSTU"; then
  bad "#890 unit non-vacuity: new pattern present BEFORE the 2nd merge → arm is vacuous"
else
  ok "#890 unit non-vacuity: new pattern absent after old-template merge (delta is real)"
fi

merge_prettierignore "$NEWSRC" "$DSTU" >/dev/null 2>&1   # 2nd merge, NOT --force: must deliver the new patterns

# (pos) the new patterns are now delivered even though the marker already existed.
{ grep -qxF '.ai-factory/ARCHITECTURE.react-native.md' "$DSTU" && grep -qxF '.ai-factory/tool-decisions.md' "$DSTU"; } \
  && ok "#890 unit: 2nd merge delivered NEW patterns into an existing block (not run-once)" \
  || bad "#890 unit: NEW patterns NOT delivered — merge_prettierignore is still run-once"

# (single block) the delivery inserted into the existing block — begin-marker count stays 1.
NMU=$(grep -cF '# >>> rules-as-tests-aif (managed) >>>' "$DSTU")
[ "$NMU" -eq 1 ] \
  && ok "#890 unit: new patterns inserted INTO the existing block (begin-marker count == 1)" \
  || bad "#890 unit: delivery created a duplicate managed block (begin-marker count = $NMU, expected 1)"

# (consumer line preserved) the consumer's own dist/ line survives the in-block insert.
grep -qxF 'dist/' "$DSTU" \
  && ok "#890 unit: consumer's original 'dist/' line survives the in-block insert" \
  || bad "#890 unit: consumer's 'dist/' line was destroyed by the insert"

# (idempotent) a 3rd merge with the SAME new source is a genuine no-op: no new patterns, count stays 1.
BEFORE_MD5=$(md5 -q "$DSTU" 2>/dev/null || md5sum "$DSTU" | awk '{print $1}')
merge_prettierignore "$NEWSRC" "$DSTU" >/dev/null 2>&1
AFTER_MD5=$(md5 -q "$DSTU" 2>/dev/null || md5sum "$DSTU" | awk '{print $1}')
[ "$BEFORE_MD5" = "$AFTER_MD5" ] \
  && ok "#890 unit: 3rd merge with unchanged source is a byte-identical no-op (genuinely idempotent)" \
  || bad "#890 unit: 3rd merge with unchanged source mutated the file (not idempotent)"

# ── #890 corrupt-block guard: BEGIN present but END missing (interrupted write / hand-edit) ──
# The append path writes BEGIN/patterns/END as three non-atomic printfs; an install interrupted
# mid-write can leave a BEGIN with no END. The insert path must NOT silently drop the missing
# patterns (and must not falsely report ✓) — it must deliver them and restore the END marker.
DSTC="$U/pi-corrupt"
printf '%s\n' 'dist/' "$PRETTIERIGNORE_BEGIN" '.ai-factory/RULES.md' > "$DSTC"   # BEGIN, NO END (corrupt)
CSRC="$U/csrc"
printf '%s\n' '.ai-factory/RULES.md' '.ai-factory/NEWPAT.md' > "$CSRC"
merge_prettierignore "$CSRC" "$DSTC" >/dev/null 2>&1
grep -qxF '.ai-factory/NEWPAT.md' "$DSTC" \
  && ok "#890 corrupt-block: new pattern delivered even with a missing END marker (no silent loss)" \
  || bad "#890 corrupt-block: new pattern silently LOST when the END marker was absent"
grep -qxF "$PRETTIERIGNORE_END" "$DSTC" \
  && ok "#890 corrupt-block: END marker restored — block self-healed" \
  || bad "#890 corrupt-block: END marker still absent after merge (block stays corrupt)"

# ── #890: --refresh delivers managed-block updates to an ALREADY-INSTALLED consumer ───────────
# do_refresh() must ALSO call merge_prettierignore, else a stale block on an installed consumer
# never receives a new template pattern without --force. Simulate a stale block by stripping one
# pattern out of it, then assert --refresh re-delivers it.
TR=$(mktemp -d)
printf '{ "name":"refresh890","version":"0.0.0" }\n' > "$TR/package.json"
printf 'dist/\n' > "$TR/.prettierignore"   # pre-existing → brownfield merge → managed BLOCK (with markers)
( cd "$TR" && git init -q && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) >/dev/null 2>&1
PIR="$TR/.prettierignore"

# strip one managed pattern to simulate a block that predates a newer template.
grep -vxF '.ai-factory/tool-decisions.md' "$PIR" > "$PIR.stale" && mv "$PIR.stale" "$PIR"
if grep -qxF '.ai-factory/tool-decisions.md' "$PIR"; then
  bad "#890 refresh precondition: strip failed (pattern still present) → arm vacuous"
else
  ok "#890 refresh precondition: pattern stripped from the block (stale-block simulated)"
fi

( cd "$TR" && bash "$REPO_ROOT/install.sh" ts-server --refresh </dev/null ) >/dev/null 2>&1
grep -qxF '.ai-factory/tool-decisions.md' "$PIR" \
  && ok "#890 refresh: --refresh re-delivered the missing managed pattern (do_refresh merges .prettierignore)" \
  || bad "#890 refresh: --refresh did NOT deliver it (do_refresh omits merge_prettierignore — the #869 class)"

NMR=$(grep -cF '# >>> rules-as-tests-aif (managed) >>>' "$PIR")
[ "$NMR" -eq 1 ] \
  && ok "#890 refresh: still a single managed block after --refresh (begin-marker count == 1)" \
  || bad "#890 refresh: --refresh duplicated the managed block (begin-marker count = $NMR, expected 1)"

# neg (LOAD-BEARING): a consumer with a .prettierignore.override.md (Layer-3 ownership) is NOT touched.
TRO=$(mktemp -d)
printf '{ "name":"refresh890o","version":"0.0.0" }\n' > "$TRO/package.json"
printf 'dist/\n' > "$TRO/.prettierignore"
( cd "$TRO" && git init -q && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) >/dev/null 2>&1
PIRO="$TRO/.prettierignore"
grep -vxF '.ai-factory/tool-decisions.md' "$PIRO" > "$PIRO.stale" && mv "$PIRO.stale" "$PIRO"
printf 'consumer owns this\n' > "$PIRO.override.md"   # Layer-3 opt-out
( cd "$TRO" && bash "$REPO_ROOT/install.sh" ts-server --refresh </dev/null ) >/dev/null 2>&1
if grep -qxF '.ai-factory/tool-decisions.md' "$PIRO"; then
  bad "#890 refresh neg: .override.md present but --refresh still merged → Layer-3 ownership ignored"
else
  ok "#890 refresh neg: .prettierignore.override.md present → --refresh left the file untouched (non-vacuous)"
fi

# ── GH #915 obs 3: CC harness worktrees are blanket-ignored, not enumerated per-worktree ──
# THE BUG: .claude/worktrees/ (nested duplicate checkouts) was not in the shipped template, and
# ignore_shipped_configs' find recursed into it — format:check went chronically RED on stale
# worktrees (470/488 hits in a real consumer run) and per-worktree eslint.config.mjs paths were
# enumerated one-by-one into .prettierignore. THE FIX: blanket `.claude/worktrees/` template
# entry + a -prune in the ignore_shipped_configs discovery find.
grep -qx '.claude/worktrees/' "$PI" \
  && ok "#915 pos: shipped .prettierignore blanket-ignores .claude/worktrees/" \
  || bad "#915 pos: .claude/worktrees/ missing from shipped .prettierignore (stale worktrees re-flag format:check)"

# neg (LOAD-BEARING): strip the entry from a copy → grep MUST miss
grep -v '^\.claude/worktrees/$' "$PI" > "$PI.neg915"
if grep -qx '.claude/worktrees/' "$PI.neg915"; then
  bad "#915 neg: stripped the entry but grep still matched → VACUOUS"
else
  ok "#915 neg: removing the entry flips the grep to miss (non-vacuous)"
fi
rm -f "$PI.neg915"

# ignore_shipped_configs must NOT enumerate configs found under .claude/worktrees/ (pruned find).
TW=$(mktemp -d)
printf '{ "name":"wtprune","version":"0.0.0" }\n' > "$TW/package.json"
mkdir -p "$TW/.claude/worktrees/stale-wt/apps/api"
printf 'export default [];\n' > "$TW/.claude/worktrees/stale-wt/apps/api/eslint.config.mjs"
( cd "$TW" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1
if grep -q 'worktrees/stale-wt' "$TW/.prettierignore"; then
  bad "#915 prune: ignore_shipped_configs enumerated a .claude/worktrees/ config (find not pruned)"
else
  ok "#915 prune: no per-worktree config path enumerated in .prettierignore (find pruned)"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
