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

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
