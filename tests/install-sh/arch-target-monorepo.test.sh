#!/usr/bin/env bash
# GH #508 — arch:check must not hard-fail on a pnpm monorepo, and the layered/feature-slice
# rules must actually enforce there.
#
# THE BUG: install shipped `arch:check = depcruise --config .dependency-cruiser.cjs src` and
# every layer rule keyed on a bare `^src/<layer>` anchor. A pnpm monorepo has no root `src/`
# (only apps/*/src, packages/*/src) → `depcruise … src` hard-fails ("Can't open 'src'",
# exit 1) and breaks the shipped CI architecture job; and even repointed, `^src/<layer>`
# matches ZERO nested modules → silent zero architectural enforcement.
#
# THE FIX: (a) arch:check auto-targets the source roots that EXIST (apps/packages on a
# workspace, else src); (b) layer prefixes use `(?:^|/)src/<layer>` so they match nested
# package source too.
#
# SCOPE NOTE (T3): a full `depcruise` run needs the consumer toolchain and is out of this
# light dependency-free harness. We assert the shipped script target + the config-prefix
# shape, plus a behavioral REGEX paired-negative that proves the new anchor reaches a nested
# monorepo path where the old one was inert.
#
# PAIRED-NEGATIVE: every arm has a neg that flips the verdict.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

arch_target() { node -e 'console.log((require(process.argv[1]).scripts||{})["arch:check"]||"")' "$1/package.json"; }

# ── monorepo: workspace markers + apps/packages → arch:check targets the real roots ──
T=$(mktemp -d)
printf '{"name":"mono","version":"0.0.0"}\n' > "$T/package.json"
printf 'packages:\n  - "apps/*"\n  - "packages/*"\n' > "$T/pnpm-workspace.yaml"
mkdir -p "$T/apps/api/src" "$T/packages/lib/src"
( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1; MONO_RC=$?
# install MUST exit 0 — a non-zero here means a new block aborted the whole install under
# `set -euo pipefail` (the regression that an output-only assertion would silently hide).
[ "$MONO_RC" = "0" ] \
  && ok "monorepo: install exited 0 (no hard-fail under set -euo pipefail)" \
  || bad "monorepo: install exited $MONO_RC (a block aborted install — regression)"

MONO_TARGET=$(arch_target "$T")
case "$MONO_TARGET" in
  *"apps packages"*) ok "monorepo: arch:check auto-targets existing roots ($MONO_TARGET)";;
  *) bad "monorepo: arch:check did NOT target apps/packages → ($MONO_TARGET)";;
esac
# NEG (load-bearing): the target must NOT be the bare `src` that hard-fails on a monorepo.
case "$MONO_TARGET" in
  *"mjs src") bad "monorepo-neg: arch:check still ends in bare 'src' → would hard-fail";;
  *) ok "monorepo-neg: arch:check does not end in bare 'src' (no 'Can't open src' crash)";;
esac

# ── flat (root src, no workspaces): detection is conditional → stays `src` ──
T2=$(mktemp -d)
printf '{"name":"flat","version":"0.0.0"}\n' > "$T2/package.json"
mkdir -p "$T2/src"
( cd "$T2" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1; FLAT_RC=$?
[ "$FLAT_RC" = "0" ] && ok "flat: install exited 0" || bad "flat: install exited $FLAT_RC (regression)"
FLAT_TARGET=$(arch_target "$T2")
case "$FLAT_TARGET" in
  *"mjs src") ok "flat: arch:check targets src (detection is conditional, not always apps/packages)";;
  *) bad "flat: arch:check unexpectedly = ($FLAT_TARGET) — flat layout regressed";;
esac

# ── M1 (cold-review): a workspace with NON-standard package roots (services/, no apps/packages,
#     no root src) must NOT fall back to a bare `src` that hard-fails. Target resolves to the
#     existing root (services) or, worst case, `.` — never a missing dir. ──
TS=$(mktemp -d)
printf '{"name":"svc","version":"0.0.0"}\n' > "$TS/package.json"
printf 'packages:\n  - "services/*"\n' > "$TS/pnpm-workspace.yaml"
mkdir -p "$TS/services/api/src"
( cd "$TS" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1; SVC_RC=$?
[ "$SVC_RC" = "0" ] && ok "services-workspace: install exited 0 (M1 — no bare-src crash)" || bad "services-workspace: install exited $SVC_RC (M1 regression — re-crashes #508)"
SVC_TARGET=$(arch_target "$TS")
case "$SVC_TARGET" in
  *"mjs src"|*"mjs ") bad "services-workspace-neg: arch:check fell back to bare 'src'/'' → would hard-fail ($SVC_TARGET)";;
  *services*|*"mjs .") ok "services-workspace: arch:check targets an existing root ($SVC_TARGET)";;
  *) bad "services-workspace: unexpected target ($SVC_TARGET)";;
esac

# ── shipped dependency-cruiser.mjs: layout-agnostic layer prefixes ──
CFG="$T/.dependency-cruiser.mjs"
[ -f "$CFG" ] || bad "monorepo: .dependency-cruiser.mjs not installed"
grep -qF '(?:^|/)src/domain' "$CFG" \
  && ok "config: layer prefixes are layout-agnostic ((?:^|/)src/<layer>)" \
  || bad "config: no layout-agnostic (?:^|/)src/ layer prefix found"
# NEG (load-bearing): the inert bare-anchor form must be gone.
grep -qE "'\^src/(domain|application|web|infrastructure|features)" "$CFG" \
  && bad "config-neg: a bare '^src/<layer>' anchor remains (inert on monorepo)" \
  || ok "config-neg: no bare '^src/<layer>' anchor (was inert on nested package src)"

# ── behavioral REGEX paired-negative: the new anchor reaches a nested monorepo path ──
NESTED='apps/api/src/domain/entity.ts'
node -e 'process.exit(new RegExp("(?:^|/)src/domain").test(process.argv[1])?0:1)' "$NESTED" \
  && ok "behavioral: (?:^|/)src/domain matches nested $NESTED (enforcement reaches monorepo)" \
  || bad "behavioral: (?:^|/)src/domain does NOT match nested path — still inert"
node -e 'process.exit(new RegExp("^src/domain").test(process.argv[1])?1:0)' "$NESTED" \
  && ok "behavioral-neg: old ^src/domain does NOT match nested path (proves the fix is non-vacuous)" \
  || bad "behavioral-neg: old ^src/domain matched nested path — fix would be vacuous"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
