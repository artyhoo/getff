#!/usr/bin/env bash
# Archive-consumer check for the packaged framework-terms navigation projection
# (consumer-delivery PR 2099, root probe at f6381a30).
#
# DEFECT THIS TEST LOCKS OUT: `_portable_framework_terms` rewrote the glossary's sibling-page
# references by enumerating the PACKAGED docs/site population. The real `getff` archive ships
# docs/site/terms.md ALONE, so the population loop iterated nothing: the projected
# .agents/roles/resources/docs-form-auditor/framework-terms.md kept all 19 relative references
# and the consumer's whole-tree lychee sweep REDs on first push. Root's disposable-consumer
# probe measured it exactly: exit 0, input sha == output sha, 19 relative occurrences,
# packaged site population ["terms.md"] — FAIL_PACKAGED_NAVIGATION.
#
# A source-repo install CANNOT catch this (the repo tree carries the full site population, so
# the old loop rewrote everything there) — the check must consume the ASSEMBLED ARCHIVE:
#
#   (1) assemble the dist payload (scripts/build-getff-dist.sh, working-tree bytes of tracked
#       files) and bind identities: packaged helper == setup.d/portable-bindings.sh,
#       packaged input == docs/site/terms.md, packaged docs/site population == terms.md only.
#   (2) npm pack the assembled payload (no scripts — assembly already ran), extract the
#       tarball, re-bind the helper sha and the archive docs/site population from the ACTUAL
#       tarball members.
#   (3) unit arms against the EXTRACTED package's own installer library: projection rewrites
#       every relative sibling ref under the pinned command-scoped UPSTREAM_BLOB_URL with
#       fragments preserved and output != input; population-INDEPENDENCE (packaged-only vs
#       full-site package produce byte-identical projections — the differential the old
#       population-driven loop fails); consumer `.override.md` ownership keeps bytes; --dry-run
#       writes nothing.
#   (4) the gate arm: a real `install.sh ts-server --force` from the EXTRACTED archive into a
#       fresh consumer fixture — installed framework-terms.md carries zero relative refs, the
#       full rewrite count, the installation.md#preview-first fragment, and the criteria card.
#
# Deterministic and offline: the deps lane auto-declines on closed stdin (no --full), so no
# registry access happens during the install arm. CI: audit-self install-sh shard C.
set -uo pipefail

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0
FAIL=0
ok()  { PASS=$((PASS + 1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }
TMPS=()
cleanup() {
  local d
  for d in "${TMPS[@]}"; do rm -rf "$d"; done
}
trap cleanup EXIT
WORK=$(mktemp -d "${TMPDIR:-/tmp}/packaged-terms-nav.XXXXXX")
TMPS+=("$WORK")

if command -v sha256sum >/dev/null 2>&1; then SHA="sha256sum"; else SHA="shasum -a 256"; fi
sha() { $SHA "$1" | awk '{print $1}'; }

# Command-scoped upstream binding, commit-shaped so a leaked default (`…/blob/main`) can never
# satisfy the assertions: lib.sh:49 preserves an explicitly supplied UPSTREAM_BLOB_URL.
BASE="https://github.com/artyhoo/getff/blob/0123456789abcdef0123456789abcdef01234567"

# Occurrence counters (not line counts — several refs share lines).
REL_RE='\]\([A-Za-z0-9_][A-Za-z0-9_./-]*\.md(#[^) ]*)?\)'
FRAG_RE='\]\([A-Za-z0-9_][A-Za-z0-9_./-]*\.md#[^) ]*\)'
rel_refs()  { grep -oE "$REL_RE" "$1" 2>/dev/null | wc -l | tr -d ' '; }
frag_refs() { grep -oE "$FRAG_RE" "$1" 2>/dev/null | wc -l | tr -d ' '; }
# Fragment count on the REWRITTEN form: the base URL's `:` keeps FRAG_RE from matching it.
ESCBASE=${BASE//./\\.}
base_frag_refs() { grep -oE "\]\($ESCBASE/docs/site/[A-Za-z0-9_./-]*\.md#[^) ]*\)" "$1" 2>/dev/null | wc -l | tr -d ' '; }
base_refs() { grep -oF "]($BASE/docs/site/" "$1" 2>/dev/null | wc -l | tr -d ' '; }

echo "── assemble dist payload + bind source identities"
if ( cd "$REPO_ROOT" && bash scripts/build-getff-dist.sh ) >"$WORK/assemble.log" 2>&1; then
  ok "build-getff-dist.sh assembled the payload"
else
  tail -20 "$WORK/assemble.log"
  bad "build-getff-dist.sh failed — see log above"
  echo "PASS=$PASS FAIL=$FAIL"; exit 1
fi
PKG="$REPO_ROOT/packages/getff"
HELPER_SHA=$(sha "$REPO_ROOT/setup.d/portable-bindings.sh")
INPUT_SHA=$(sha "$REPO_ROOT/docs/site/terms.md")
[ "$(sha "$PKG/setup.d/portable-bindings.sh")" = "$HELPER_SHA" ] \
  && ok "packaged helper == setup.d/portable-bindings.sh ($HELPER_SHA)" \
  || bad "packaged helper differs from setup.d/portable-bindings.sh"
[ "$(sha "$PKG/docs/site/terms.md")" = "$INPUT_SHA" ] \
  && ok "packaged input == docs/site/terms.md ($INPUT_SHA)" \
  || bad "packaged input differs from docs/site/terms.md"
POPULATION=$(cd "$PKG/docs/site" && find . -name '*.md' -type f | sed 's#^\./##' | LC_ALL=C sort | tr '\n' ' ')
[ "$POPULATION" = "terms.md " ] \
  && ok "packaged docs/site population is terms.md alone" \
  || bad "packaged docs/site population changed: $POPULATION — update this premise binding"
INPUT_REL=$(rel_refs "$PKG/docs/site/terms.md")
INPUT_FRAG=$(frag_refs "$PKG/docs/site/terms.md")
[ "$INPUT_REL" -ge 1 ] && ok "authored glossary carries $INPUT_REL relative sibling refs ($INPUT_FRAG with fragments)" \
  || bad "authored glossary has no relative sibling refs — test input no longer exercises the rewrite"

echo "── pack + extract the real archive"
if ! ( cd "$PKG" && npm pack --ignore-scripts >"$WORK/pack.out" 2>"$WORK/pack.err" ); then
  cat "$WORK/pack.err"; bad "npm pack failed"; echo "PASS=$PASS FAIL=$FAIL"; exit 1
fi
TARBALL="$PKG/$(tail -1 "$WORK/pack.out")"
mv "$TARBALL" "$WORK/getff.tgz"
mkdir -p "$WORK/x"
tar -xzf "$WORK/getff.tgz" -C "$WORK/x"
EXPKG="$WORK/x/package"
[ -f "$EXPKG/install.sh" ] && ok "tarball extracted (package/install.sh present)" || bad "tarball layout unexpected"
TAR_SITE=$(tar -tzf "$WORK/getff.tgz" | sed -n 's#^package/docs/site/##p' | LC_ALL=C sort | tr '\n' ' ')
[ "$TAR_SITE" = "terms.md " ] \
  && ok "archive docs/site ships terms.md alone (defect premise holds)" \
  || bad "archive docs/site population: $TAR_SITE — update this premise binding"
[ "$(sha "$EXPKG/setup.d/portable-bindings.sh")" = "$HELPER_SHA" ] \
  && ok "archive helper sha == source helper sha" \
  || bad "archive helper differs from setup.d/portable-bindings.sh"
[ "$(sha "$EXPKG/docs/site/terms.md")" = "$INPUT_SHA" ] \
  && ok "archive input sha == source terms.md sha" \
  || bad "archive input differs from docs/site/terms.md"

echo "── unit arms on the extracted package's installer library"
UNIT="$WORK/unit"
mkdir -p "$UNIT"
(
  cd "$UNIT" || exit 1
  INSTALL_SH_LIB_ONLY=1 UPSTREAM_BLOB_URL="$BASE"
  # shellcheck disable=SC1090
  source "$EXPKG/install.sh"
  # install.sh sets -euo pipefail at source time; restore the test's forgiving options.
  set +e +o pipefail
  FORCE=""
  DRY_RUN=""
  SKIPPED=()
  REFRESH_BASELINE_STAGED=()
  GETFF_PORTABLE_PATHS=()
  TERMS_DST=".agents/roles/resources/docs-form-auditor/framework-terms.md"

  # (a) projection under the packaged population (docs/site = terms.md only)
  _portable_framework_terms >"$WORK/unit-a.log" 2>&1
  if [ -f "$TERMS_DST" ]; then
    OUT_REL=$(grep -oE "$REL_RE" "$TERMS_DST" | wc -l | tr -d ' ')
    OUT_FRAG=$(base_frag_refs "$TERMS_DST")
    OUT_BASE=$(grep -oF "]($BASE/docs/site/" "$TERMS_DST" | wc -l | tr -d ' ')
    [ "$OUT_REL" = 0 ] && echo "  ✓ (a) zero relative refs survive the projection" || echo "  ✗ (a) $OUT_REL relative refs survive"
    [ "$OUT_BASE" = "$INPUT_REL" ] && echo "  ✓ (a) all $INPUT_REL refs carry the pinned upstream base" || echo "  ✗ (a) base-prefixed refs $OUT_BASE != $INPUT_REL"
    [ "$OUT_FRAG" = "$INPUT_FRAG" ] && echo "  ✓ (a) all $INPUT_FRAG fragment refs preserved" || echo "  ✗ (a) fragments $OUT_FRAG != $INPUT_FRAG"
    [ "$(sha "$TERMS_DST")" != "$INPUT_SHA" ] && echo "  ✓ (a) output differs from input bytes (root-probe signature absent)" || echo "  ✗ (a) output is byte-identical to input — the packaged-navigation defect"
    echo "  identity: helper=$HELPER_SHA input=$INPUT_SHA output=$(sha "$TERMS_DST")"
  else
    echo "  ✗ (a) projection produced no framework-terms.md"
  fi

  # (b) population independence — the differential the population-driven loop fails:
  #     a package with the FULL site population must project the SAME bytes as the
  #     packaged-only one. Under the old loop the full side rewrote and the packaged
  #     side did not (outputs differ + relative refs survive = the defect).
  FULL="$WORK/fullpkg"
  mkdir -p "$FULL/docs/site"
  cp "$EXPKG/docs/site/terms.md" "$FULL/docs/site/terms.md"
  grep -oE "$REL_RE" "$EXPKG/docs/site/terms.md" \
    | sed -E 's/^\]\(//; s/\)$//; s/#.*$//' | LC_ALL=C sort -u \
    | while IFS= read -r p; do
        mkdir -p "$FULL/docs/site/$(dirname "$p")"
        printf 'x\n' > "$FULL/docs/site/$p"
      done
  UNIT2="$WORK/unit2"
  mkdir -p "$UNIT2"
  PKG_ROOT="$FULL" PROJECT_ROOT="$UNIT2" _portable_framework_terms >"$WORK/unit-b.log" 2>&1
  if cmp -s "$TERMS_DST" "$UNIT2/$TERMS_DST"; then
    echo "  ✓ (b) packaged-only and full-site packages project identical bytes"
  else
    echo "  ✗ (b) projection depends on the packaged site population — the rewritten loop regressed"
  fi

  # (c) ownership guard: a consumer override keeps the installed bytes
  UNIT3="$WORK/unit3"
  DST3="$UNIT3/$TERMS_DST"
  mkdir -p "$(dirname "$DST3")"
  printf 'consumer-owned glossary bytes\n' > "$DST3"
  printf 'consumer override\n' > "${DST3%.md}.override.md"
  PROJECT_ROOT="$UNIT3" _portable_framework_terms >"$WORK/unit-c.log" 2>&1
  if [ "$(cat "$DST3")" = "consumer-owned glossary bytes" ]; then
    echo "  ✓ (c) .override.md keeps consumer-owned bytes"
  else
    echo "  ✗ (c) override guard broken — consumer bytes replaced"
  fi

  # (d) dry-run writes nothing
  UNIT4="$WORK/unit4"
  mkdir -p "$UNIT4"
  DRY_RUN="--dry-run" PROJECT_ROOT="$UNIT4" _portable_framework_terms >"$WORK/unit-d.log" 2>&1
  if [ ! -e "$UNIT4/$TERMS_DST" ]; then
    echo "  ✓ (d) --dry-run leaves the destination absent"
  else
    echo "  ✗ (d) --dry-run wrote the destination"
  fi
) >"$WORK/unit-results.txt" 2>&1
while IFS= read -r line; do
  case "$line" in
    '  ✓'*) ok "${line#  ✓ }" ;;
    '  ✗'*) bad "${line#  ✗ }" ;;
    *) echo "$line" ;;
  esac
done <"$WORK/unit-results.txt"

echo "── real archive install into a fresh consumer (the gate arm)"
FIXTURE="$WORK/consumer"
mkdir -p "$FIXTURE"
printf '{"name":"packaged-terms-nav","version":"0.0.0"}\n' > "$FIXTURE/package.json"
(
  cd "$FIXTURE" \
    && git init -q && git config user.email test@test.com && git config user.name Test \
    && UPSTREAM_BLOB_URL="$BASE" bash "$EXPKG/install.sh" ts-server --force < /dev/null
) >"$WORK/install.log" 2>&1 \
  && ok "archive install.sh ts-server --force completed" \
  || { tail -30 "$WORK/install.log"; bad "archive install failed — see log above"; }
INSTALLED="$FIXTURE/.agents/roles/resources/docs-form-auditor/framework-terms.md"
if [ -f "$INSTALLED" ]; then
  ok "installed framework-terms.md exists at the consumer resources path"
  INST_REL=$(rel_refs "$INSTALLED")
  INST_FRAG=$(base_frag_refs "$INSTALLED")
  INST_BASE=$(base_refs "$INSTALLED")
  [ "$INST_REL" = 0 ] \
    && ok "installed projection carries zero relative refs" \
    || bad "installed projection carries $INST_REL relative refs — packaged navigation broken"
  [ "$INST_BASE" = "$INPUT_REL" ] \
    && ok "installed projection carries all $INPUT_REL upstream-bound refs" \
    || bad "installed upstream-bound refs $INST_BASE != $INPUT_REL"
  [ "$INST_FRAG" = "$INPUT_FRAG" ] \
    && ok "installed projection preserves all $INPUT_FRAG fragment refs" \
    || bad "installed fragments $INST_FRAG != $INPUT_FRAG"
  grep -qF "]($BASE/docs/site/installation.md#preview-first)" "$INSTALLED" \
    && ok "installation.md#preview-first anchor survives the rewrite" \
    || bad "installation.md#preview-first anchor lost"
  grep -qF "$BASE/docs/site/$BASE" "$INSTALLED" \
    && bad "double-prefixed rewrite found (input already absolute was re-rewritten)" \
    || ok "no double-prefixed rewrites"
  [ -f "$FIXTURE/.agents/roles/resources/docs-form-auditor/criteria-card.md" ] \
    && ok "criteria card delivered alongside the projection" \
    || bad "criteria card missing next to the projection"
  echo "  identity: installed=$(sha "$INSTALLED") input=$INPUT_SHA helper=$HELPER_SHA"
else
  bad "install did not deliver framework-terms.md"
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
