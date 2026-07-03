#!/usr/bin/env bash
# gh-534-arch-boundaries.test.sh — monorepo boundary rules in the shipped dependency-cruiser config
# + the R3 inertness detector (check-arch-boundaries.sh), the alarm R3 lacked (unlike R2 check:globs).
#
# SCOPE: config-shape + REGEX arms prove the rule's TEXT ships and its PATTERN matches the #534 repro
# strings; detector Arms A/B/C exercise the R3 inertness alarm (check-arch-boundaries.sh) on
# with/without-boundary configs. Arm D runs REAL depcruise on a planted packages/*→apps/* import —
# the ground truth that the shipped rule actually FIRES, not merely that its text is present. The
# config-shape grep + the regex arm alone are exactly the "text present ≠ rule enforced" gap (#535
# class). (Mirrors gh-535's real-eslint Arm 2; installed on demand, skipped if the install fails.)
#
# PAIRED-NEGATIVES: Arm B flips Arm A's verdict (detector FAILS a monorepo config lacking the rule);
# behavioral-neg proves the monorepo pattern stays inert on a flat path (no false-positive); Arm D-neg
# proves the legal apps/*→packages/* direction passes real depcruise (no false-fail).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
GATE="$REPO_ROOT/packages/core/audit-self/check-arch-boundaries.sh"
CFG_SRC="$REPO_ROOT/templates/ts-server/dependency-cruiser.cjs"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# ── shipped config carries the monorepo boundary rules and is valid JS ──
grep -q 'no-package-to-app' "$CFG_SRC" && ok "config: no-package-to-app (packages↛apps) rule shipped" || bad "config: no-package-to-app missing"
grep -q 'no-cross-app' "$CFG_SRC"      && ok "config: no-cross-app (apps↔apps) rule shipped"          || bad "config: no-cross-app missing"
node -e "require('$CFG_SRC')" 2>/dev/null && ok "config: .dependency-cruiser.cjs is valid JS (require succeeds)" || bad "config: .cjs failed to require"

# ── behavioral REGEX: the new rule reaches the #534 repro paths, inert on flat ──
node -e 'process.exit((new RegExp("(?:^|/)packages/").test("packages/db/src/index.ts") && new RegExp("(?:^|/)apps/").test("apps/api/src/app.ts"))?0:1)' \
  && ok "behavioral: packages/→apps/ patterns match the #534 repro paths (enforcement reaches monorepo)" \
  || bad "behavioral: patterns do not match the repro paths"
node -e 'process.exit(new RegExp("(?:^|/)packages/").test("src/domain/x.ts")?1:0)' \
  && ok "behavioral-neg: packages/ pattern does NOT match a flat src path (rule inert on flat — no false-positive)" \
  || bad "behavioral-neg: packages/ pattern matched a flat path (would false-positive on single-project)"

# ── detector Arm A: monorepo + config WITH the boundary rule → PASS ──
A=$(mktemp -d); mkdir -p "$A/apps/api/src" "$A/packages/db/src"; cp "$CFG_SRC" "$A/.dependency-cruiser.cjs"
if ( cd "$A" && bash "$GATE" ) >/tmp/g534a.$$ 2>&1; then
  ok "A: monorepo + boundary rule present → detector PASSES"
else
  bad "A: detector FAILED on a config WITH the boundary ($(tr '\n' ';' </tmp/g534a.$$))"
fi

# ── detector Arm B (paired-negative): monorepo + layered-only config (NO boundary) → FAIL ──
B=$(mktemp -d); mkdir -p "$B/apps/api/src" "$B/packages/db/src"
cat > "$B/.dependency-cruiser.cjs" <<'CJS'
module.exports = { forbidden: [
  { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  { name: 'domain-no-infra', severity: 'error', from: { path: '(?:^|/)src/domain' }, to: { path: '(?:^|/)src/infrastructure' } },
] };
CJS
if ( cd "$B" && bash "$GATE" ) >/tmp/g534b.$$ 2>&1; then
  bad "B neg: detector PASSED a monorepo config with NO packages↛apps rule (silent inertness not caught)"
else
  ok "B neg: monorepo + NO boundary rule → detector FAILS (the R3 inertness alarm fires)"
fi
grep -q 'unguarded' /tmp/g534b.$$ && ok "B: failure message explains the unguarded boundary" || bad "B: failure message unclear"

# ── detector Arm C: flat repo (no apps/+packages/) → graceful skip (exit 0) ──
C=$(mktemp -d); mkdir -p "$C/src"; cp "$CFG_SRC" "$C/.dependency-cruiser.cjs"
if ( cd "$C" && bash "$GATE" ) >/tmp/g534c.$$ 2>&1 && grep -qi 'not an apps/+packages/ monorepo' /tmp/g534c.$$; then
  ok "C: flat repo → detector skips (exit 0, no false-fail on single-project)"
else
  bad "C: detector did not skip on a flat repo ($(tr '\n' ';' </tmp/g534c.$$))"
fi

# ── Arm D (real depcruise — the GROUND TRUTH; skipped if the install fails): a planted ──────────
#    packages/*→apps/* import must make `depcruise` (the engine the shipped arch:check actually runs)
#    FAIL, and the legal apps/*→packages/* direction must PASS. Arms above prove the rule's text +
#    regex; only running real depcruise on a real module graph proves the rule FIRES (#535-class:
#    text present ≠ rule enforced). Pinned dependency-cruiser@16 + typescript@5 — cruising a bare dir
#    needs the TS compiler, and @17-latest currently pins an unpublished acorn-walk (uninstallable)
#    while TS 6 breaks bare-dir scan; @16 is the stable, installable engine (verified 2026-06-16).
DCV=$(mktemp -d)
if ( cd "$DCV" && printf '{"name":"d","private":true}\n' > package.json \
     && npm i dependency-cruiser@16 typescript@5 --no-save --silent >/dev/null 2>&1 ); then
  cp "$CFG_SRC" "$DCV/.dependency-cruiser.cjs"
  printf '{ "compilerOptions": { "module": "esnext", "moduleResolution": "node" } }\n' > "$DCV/tsconfig.json"
  mkdir -p "$DCV/apps/api/src" "$DCV/packages/db/src"
  DC="$DCV/node_modules/.bin/depcruise"
  # CASE A — packages/* imports apps/* (the forbidden direction) → depcruise FAILS on no-package-to-app.
  printf 'export const app = 1;\n' > "$DCV/apps/api/src/app.ts"
  printf "import { app } from '../../../apps/api/src/app';\nexport const db = app;\n" > "$DCV/packages/db/src/index.ts"
  ( cd "$DCV" && "$DC" --config .dependency-cruiser.cjs --no-progress apps packages ) >/tmp/g534d.$$ 2>&1
  rcA=$?
  if [ "$rcA" -ne 0 ] && grep -q 'no-package-to-app' /tmp/g534d.$$; then
    ok "D (real depcruise): packages/→apps/ import → depcruise FAILS on no-package-to-app (rule actually fires)"
  else
    bad "D (real depcruise): planted packages/→apps/ import did NOT trip the rule ($(tr '\n' ';' </tmp/g534d.$$))"
  fi
  # CASE B (paired-negative) — legal apps/*→packages/* direction → depcruise PASSES; the cruised-deps
  # count proves the graph was genuinely traversed (guards against a vacuous 0-modules pass).
  printf 'export const db = 1;\n' > "$DCV/packages/db/src/index.ts"
  printf "import { db } from '../../../packages/db/src/index';\nexport const app = db;\n" > "$DCV/apps/api/src/app.ts"
  ( cd "$DCV" && "$DC" --config .dependency-cruiser.cjs --no-progress apps packages ) >/tmp/g534e.$$ 2>&1
  rcB=$?
  if [ "$rcB" -eq 0 ] && grep -qE '[1-9][0-9]* dependencies cruised' /tmp/g534e.$$; then
    ok "D neg (real depcruise): legal apps/→packages/ direction → depcruise PASSES (graph cruised, no false-fail)"
  else
    bad "D neg (real depcruise): clean apps/→packages/ graph false-failed or cruised 0 deps ($(tr '\n' ';' </tmp/g534e.$$))"
  fi
else
  echo "  · Arm D skipped — could not install dependency-cruiser@16 (offline/upstream); detector Arms A/B/C still prove the alarm."
fi

# ── #807: the multi-stack monorepo branch must place a ROOT .dependency-cruiser.cjs ────────────
# The #793/#796 multi-stack branch placed per-workspace eslint configs but no root arch config, so
# `arch:check` (depcruise --config .dependency-cruiser.cjs) exited 1 → validate RED. depcruise is a
# repo-wide arch tool (crawls from src/), so a single root config is correct. Real install (deps-free
# — </dev/null answers N), assert by PLACEMENT (can't run depcruise without deps). PAIRED-NEGATIVE:
# the flat path (no per-workspace stacks) places it via its own branch — proven by the existing
# install-sh suite — so this arm proves the multi-stack branch (which previously did NOT) now does.
MS807=$(mktemp -d)
printf '{ "name":"mono","private":true,"devDependencies":{"typescript":"5.6.0"} }\n' > "$MS807/package.json"
printf 'packages:\n  - "apps/*"\n' > "$MS807/pnpm-workspace.yaml"
mkdir -p "$MS807/apps/api"
printf '{ "name":"@m/api","dependencies":{"hono":"4.0.0"},"devDependencies":{"typescript":"5.6.0"} }\n' > "$MS807/apps/api/package.json"
mkdir -p "$MS807/apps/mobile"
printf '{ "name":"@m/mobile","dependencies":{"expo":"~52.0.0","react-native":"0.76.0","react":"18.3.0"} }\n' > "$MS807/apps/mobile/package.json"
( cd "$MS807" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force </dev/null ) >/tmp/g534ms.$$ 2>&1
mrc=$?
[ "$mrc" -eq 0 ] || bad "#807: multi-stack install rc=$mrc ($(tail -2 /tmp/g534ms.$$ | tr '\n' '|'))"
[ -f "$MS807/.dependency-cruiser.cjs" ] \
  && ok "#807: multi-stack branch places ROOT .dependency-cruiser.cjs (arch:check resolves; was MISSING)" \
  || bad "#807: multi-stack branch did NOT place root .dependency-cruiser.cjs (arch:check exits 1)"
# NEG (load-bearing): there must be no per-WORKSPACE .dependency-cruiser.cjs (placed once at root,
# not N times inside the loop, per ⚑M2). A copy under apps/* would be the loop-placement bug.
! [ -f "$MS807/apps/api/.dependency-cruiser.cjs" ] && ! [ -f "$MS807/apps/mobile/.dependency-cruiser.cjs" ] \
  && ok "#807 neg: no per-workspace .dependency-cruiser.cjs (placed ONCE at root, not in the loop)" \
  || bad "#807 neg: a per-workspace .dependency-cruiser.cjs exists — placed inside the loop (⚑M2 violation)"

rm -f /tmp/g534a.$$ /tmp/g534b.$$ /tmp/g534c.$$ /tmp/g534d.$$ /tmp/g534e.$$ /tmp/g534ms.$$ 2>/dev/null
echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
