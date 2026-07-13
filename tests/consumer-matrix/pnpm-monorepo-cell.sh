#!/usr/bin/env bash
# Consumer-matrix START CELL: pnpm workspace monorepo · Node 22 (launch-preannounce-track S2).
#
# Mechanizes the umbrella §1 acceptance on a foreign-shaped consumer. The fixture is
# S1-CALIBRATED (s1-calibration-report.md §4): the frictionless kickoff skeleton is
# green-by-construction (trap T-LPT-C), so this cell is shaped to the REAL enforcement
# channel of a per-workspace-config monorepo and carries the S1 red-arm probes.
#
# THE MONOREPO ENFORCEMENT CHANNEL (load-bearing, S1 D-class + verified in the S2 dev loop):
# on a pnpm workspace monorepo the install places PER-WORKSPACE eslint configs and NO root
# config; the install itself documents that root `npm run lint` / `eslint .` does NOT enforce
# R2 on per-workspace packages (nearest-config resolution shadows the root rules → silently
# inert), and root `eslint .` errors out with no root flat-config at all. The framework's OWN
# monorepo validation channel is therefore the deterministic per-workspace gates
# (`check:globs` / `check:enforced` / `check:fences-fire` / `check:shields-up` / typecheck /
# format:check / arch:check) — exactly the subset the shipped CI job
# `framework-fresh-install-validate-multistack` (audit-self.yml) asserts, and NOT the full
# root `npm run validate` (whose `lint = eslint .` arm cannot resolve on this topology).
# This cell asserts THAT channel; the root `eslint .` crash is pinned as XFAIL #973 (S1 D2).
#
# Asserts (kickoff S2 (a)-(i)):
#   (a) self-verify VERDICT LINE is the full-pass form, not install rc (S1 D5: rc=0 over dead shield)
#   (b) toolchain in-fixture + placed per-workspace config load probe (D5/#976 regression guard)
#   (c) green-on-clean: the deterministic per-workspace validation gates all pass (the monorepo
#       enforcement channel above), plus format:check after a normalizing `npm run format`
#   (d) planted R2 violation blocked through the REAL edit-time channel — the shipped lint-staged
#       pre-commit shield fires R2 with its own message — AND the shipped check:fences-fire gate
#       proves R2 fires; scoped `eslint` in the boundary workspace flags it directly
#   (e) false-positive arm: the rule's own VALID shape (static-literal ConfigSchema.parse) produces
#       ZERO rules-as-tests errors under the scoped workspace eslint
#   (i) clean-tree real git push with an UN-PINNED (@v6) workflow → allowed — proves F-push is
#       resolved: the consumer composition excludes zizmor (owner:maintainer) so a pre-existing
#       un-pinned action never DoS's the first push
#   XFAIL #973 (S1 D2): root `eslint .` crashes on a per-workspace monorepo (no root flat-config /
#       project-service on out-of-tsconfig files) — asserted as REPRODUCING; flips loud when fixed.
#   XFAIL #975 (S1 D4): a consumer prepare=simple-git-hooks install clobbers the framework hooks —
#       asserted as REPRODUCING; flips loud when fixed.
#
# Deferred sibling asserts (stage report, NOT silently dropped): (f) --refresh N-1 delivery;
# (g) divergent consumer .prettierrc; (h) stryker cell (#931); D3 trustPolicy cell (#974).
#
# Fail-closed polarity: a missing tool in-fixture is RED, never SKIP (kickoff S2 fail-closed tier).
# T-LPT-A: the fixture installs its OWN deps (own pnpm lockfile); framework substrate is never
# symlinked in; rule firing is asserted through the real shipped channels only, never the Linter API.
#
# Runs on ubuntu (CI, merge-blocking) and macOS (`make consumer-matrix`, nightly/local — BSD-awk/
# husky-v9/symlink-tmp classes are NOT PR-covered; kickoff S2 OS-axis degrade).
set -euo pipefail

FRAMEWORK_ROOT="${FRAMEWORK_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/consumer-matrix-pnpm.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
CONSUMER="$WORK/consumer"
BARE="$WORK/origin.git"
LOG="$WORK/install.log"

fail() { echo "" ; echo "✗ FAIL: $*" >&2; exit 1; }
step() { echo ""; echo "── $*"; }

if ! command -v pnpm >/dev/null 2>&1; then
  command -v corepack >/dev/null 2>&1 && corepack enable >/dev/null 2>&1 || true
fi
command -v pnpm >/dev/null 2>&1 || fail "pnpm unavailable (corepack enable failed) — cell cannot run; RED never SKIP"

step "fixture: pnpm workspace monorepo (root private+packageManager, apps/api(zod,src,tsconfig), packages/lib)"
mkdir -p "$CONSUMER" && cd "$CONSUMER"
git init -q -b main
git config user.email ci@example.com
git config user.name CI
cat > package.json <<'JSON'
{
  "name": "consumer-matrix-pnpm",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@9.12.3"
}
JSON
printf 'packages:\n  - "apps/*"\n  - "packages/*"\n' > pnpm-workspace.yaml
# A real consumer gitignores deps + the husky v9 runtime dir — without this, `git add -A`
# would stage node_modules and lint-staged would choke on thousands of dep files.
printf 'node_modules/\n.husky/_/\n' > .gitignore
mkdir -p apps/api/src/routes packages/lib .github/workflows
# apps/api carries the HTTP boundary (routes/) → R2 is non-inert in this workspace. "type":module
# because the shipped tsconfig uses verbatimModuleSyntax; a per-workspace tsconfig makes the
# type-aware eslint project-service resolve the workspace's own sources (else S1 D2/#973 crash).
cat > apps/api/package.json <<'JSON'
{ "name": "@consumer/api", "version": "0.0.0", "type": "module", "dependencies": { "zod": "3.23.8" } }
JSON
cat > apps/api/tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
JSON
printf 'export const health = 1;\n' > apps/api/src/routes/health.ts
# (e) false-positive arm: R2's own VALID shape (no-unsafe-zod-parse.test.ts valid case —
# static-literal ConfigSchema.parse) as a NON-boundary file (src/config.ts, not under routes/).
cat > apps/api/src/config.ts <<'TS'
import { z } from 'zod';
const ConfigSchema = z.object({ port: z.number() });
export const config = ConfigSchema.parse({ port: 3000 } as const);
TS
# packages/lib: a real ≥2nd workspace member with NO scannable src boundary — a pure lib has no
# HTTP parse boundary, so R2 is correctly N/A there (S1: per-workspace R2 inertness must not fail
# check:globs on a legitimately boundary-free lib).
cat > packages/lib/package.json <<'JSON'
{ "name": "@consumer/lib", "version": "0.0.0", "main": "index.js" }
JSON
printf 'module.exports = { version: "0.0.0" };\n' > packages/lib/index.js
# Consumer workflow with an UN-PINNED action (@v6) — deliberately the F-push trigger. Assert (i)
# proves the S3 push-channel contract is actually resolved: the shipped pre-push composes ONLY
# consumer/both-owned sections for a consumer (isFrameworkRepo=false via composeSections in
# pre-push.ts), and zizmor is owner:'maintainer' → EXCLUDED from the consumer composition, so a
# consumer's first push is NOT blocked on a pre-existing un-pinned workflow. Verified empirically
# on current staging (a fresh consumer install + real `git push` with this exact @v6 workflow →
# rc=0, zizmor not run), which is why S1 §4's "SHA-pin or (i) fails on F-push" caveat no longer
# applies: the owner-split closes F-push at the composition layer, not by fixture SHA-pinning.
# (This corrects an earlier note here that claimed the SECTIONS registry was data-only — it is
# consumed by main() via activeSections(); the earlier "still blocked" observation was a stale
# install, disproven by the current-staging repro. See #993.)
cat > .github/workflows/ci.yml <<'YML'
name: consumer-ci
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - run: echo ok
YML
git add -A
git commit -qm "consumer baseline"

step "fixture installs its OWN deps (T-LPT-A guard: own lockfile, no framework substrate)"
pnpm install --silent
test -f pnpm-lock.yaml || fail "fixture lockfile missing — T-LPT-A guard"
test -e node_modules/zod || test -e apps/api/node_modules/zod || fail "fixture's own zod did not land"

step "(1) real installer: install.sh ts-server --full"
set +e
bash "$FRAMEWORK_ROOT/install.sh" ts-server --full > "$LOG" 2>&1
INSTALL_RC=$?
set -e
tail -20 "$LOG"

step "(a) banner honesty: assert the self-verify VERDICT LINE, not rc (S1 §4 item 1)"
[ "$INSTALL_RC" -eq 0 ] || fail "(a) install rc=$INSTALL_RC (log tail above)"
grep -q "✓ self-verify: 3/3 checks passed" "$LOG" \
  || fail "(a) self-verify verdict line is not the full-pass form — rc=0 alone is NOT success (S1 D5)"
if grep -q "⚠  self-verify" "$LOG"; then fail "(a) degraded/failed self-verify banner present"; fi
echo "  ✓ self-verify verdict line = full pass; rc=0"

step "(b) toolchain substrate in-fixture + placed per-workspace config load probe (D5/#976 guard)"
for bin in eslint tsx tsc; do
  test -x "node_modules/.bin/$bin" || fail "(b) $bin not executable in fixture node_modules — RED never SKIP"
done
CFG_COUNT=0
while IFS= read -r cfg; do
  CFG_COUNT=$((CFG_COUNT + 1))
  node --input-type=module -e "await import('$CONSUMER/${cfg#./}')" \
    || fail "(b) placed config $cfg not loadable (S1 D5/#976 class)"
done < <(find . -name eslint.config.mjs -not -path "./node_modules/*" -not -path "./*/node_modules/*")
[ "$CFG_COUNT" -ge 2 ] || fail "(b) expected ≥2 per-workspace eslint configs placed, found $CFG_COUNT"
echo "  ✓ toolchain present; $CFG_COUNT per-workspace config(s) load cleanly"

step "(c) green-on-clean: the deterministic per-workspace validation gates (monorepo channel)"
# Normalize prettier once (a consumer runs `npm run format` on adoption) so format:check is green.
npm run format >"$WORK/format.log" 2>&1 || fail "(c) npm run format failed: $(tail -3 "$WORK/format.log")"
# The shipped monorepo validation channel — the same deterministic gates the CI job
# framework-fresh-install-validate-multistack uses. NOT root `npm run validate` (its `eslint .`
# arm cannot resolve on a per-workspace monorepo — XFAIL #973 below pins that).
for gate in typecheck format:check arch:check check:globs check:enforced check:arch-boundaries check:lintstaged check:fences-fire check:shields-up; do
  if npm run "$gate" >"$WORK/$gate.log" 2>&1; then
    echo "  ✓ $gate"
  else
    tail -8 "$WORK/$gate.log" | sed 's/^/      /'
    fail "(c) clean-tree gate '$gate' not green"
  fi
done

step "(e) false-positive arm: scoped eslint on the boundary workspace flags ZERO legit code"
set +e
( cd apps/api && npx eslint . ) >"$WORK/fp.log" 2>&1
FP_RC=$?
set -e
[ "$FP_RC" -eq 0 ] || fail "(e) scoped apps/api eslint rc=$FP_RC on the clean tree: $(tail -6 "$WORK/fp.log")"
if grep -q "rules-as-tests" "$WORK/fp.log"; then fail "(e) a shipped rule fired on legit code (cries-wolf arm)"; fi
echo "  ✓ scoped eslint clean; 0 framework errors incl. static-literal ConfigSchema.parse"

step "(d) planted R2 violation → blocked through the REAL shipped channels"
cat > apps/api/src/routes/order.ts <<'TS'
import { z } from 'zod';
const OrderSchema = z.object({ id: z.string() });
export const handler = (req: { body: unknown }) => OrderSchema.parse(req.body);
TS
# (d-1) scoped eslint in the boundary workspace fires R2 with its own message.
set +e
( cd apps/api && npx eslint src/routes/order.ts ) >"$WORK/viol.log" 2>&1
V_RC=$?
set -e
[ "$V_RC" -ne 0 ] || fail "(d-1) scoped eslint rc=0 over a planted OrderSchema.parse(req.body) violation"
grep -q "no-unsafe-zod-parse" "$WORK/viol.log" \
  || fail "(d-1) scoped eslint rc=$V_RC but not from R2 (crash, not enforcement?): $(tail -6 "$WORK/viol.log")"
echo "  ✓ (d-1) scoped eslint rc=$V_RC with the R2 message"
# (d-2) the shipped lint-staged pre-commit shield blocks the staged violation via R2.
git add apps/api/src/routes/order.ts
set +e
bash .husky/pre-commit >"$WORK/precommit.log" 2>&1
PC_RC=$?
set -e
[ "$PC_RC" -ne 0 ] || fail "(d-2) pre-commit (lint-staged) did NOT block the planted violation"
grep -q "no-unsafe-zod-parse" "$WORK/precommit.log" \
  || fail "(d-2) pre-commit blocked but not via R2 (D2 crash?): $(tail -6 "$WORK/precommit.log")"
echo "  ✓ (d-2) lint-staged pre-commit shield blocked the commit via R2"
git restore --staged apps/api/src/routes/order.ts
rm apps/api/src/routes/order.ts
# (d-3) the shipped check:fences-fire gate independently proves R2 fires on bad input.
npm run check:fences-fire >"$WORK/fences.log" 2>&1 || fail "(d-3) check:fences-fire not green"
grep -q "no-unsafe-zod-parse.*ACTIVE\|fence fires.*no-unsafe-zod-parse" "$WORK/fences.log" \
  || fail "(d-3) check:fences-fire did not confirm R2 fires: $(tail -4 "$WORK/fences.log")"
echo "  ✓ (d-3) check:fences-fire confirms R2 fires on bad input / passes good input"

step "(i) push channel: clean-tree real push with an UN-PINNED workflow → allowed (F-push resolved)"
# Restore tracked files to the committed baseline (discard the (c) format-normalization edits —
# they are not committed and are irrelevant to what a push transmits) so the push exercises a
# genuinely clean tree. node_modules is gitignored, so it stays untracked and out of the way.
git checkout -- . 2>/dev/null || true
[ -z "$(git diff --name-only)" ] || fail "(i) tracked tree not clean after checkout — unexpected"
git init -q --bare "$BARE"
git remote add origin "$BARE"
set +e
PUSH_OUT=$(git push origin main 2>&1)
PUSH_RC=$?
set -e
if [ "$PUSH_RC" -ne 0 ]; then
  echo "$PUSH_OUT" | tail -20 | sed 's/^/      /'
  fail "(i) push blocked (rc=$PUSH_RC) on a consumer with an un-pinned workflow — F-push NOT resolved: the consumer composition must exclude zizmor (owner:maintainer) so a pre-existing @v6 never DoS's the first push"
fi
echo "  ✓ clean-tree push allowed with an un-pinned @v6 workflow present — F-push resolved (zizmor owner:maintainer, excluded from the consumer composition)"

step "XFAIL #973 (S1 D2): root 'eslint .' crashes on a per-workspace monorepo — assert it REPRODUCES"
set +e
npx eslint . >"$WORK/rooteslint.log" 2>&1
D2_RC=$?
set -e
if [ "$D2_RC" -eq 0 ]; then
  fail "XFAIL-#973 FLIPPED: root 'eslint .' now succeeds on a per-workspace monorepo — D2 appears FIXED. Graduate this into a hard 'root lint enforces R2 per-workspace' assert and drop the xfail."
fi
echo "  reproduced (#973 open): root 'eslint .' rc=$D2_RC — the monorepo enforcement channel is per-workspace, not root (expected until fixed)"

# NOTE — S1 D4/#975 (consumer prepare=simple-git-hooks clobbers the framework hooks) is NOT
# mechanized here: reproducing it requires `pnpm install` to actually execute the injected
# `prepare` lifecycle, which is non-deterministic across pnpm versions / lockfile states — a
# flaky assert would be worse than none. #975 stays tracked (filed by S1); this start cell
# defers it alongside (f) --refresh N-1, (g) divergent .prettierrc, (h) stryker (#931), and the
# D3 trustPolicy cell (#974). Each is enumerated in the S2 stage report as a follow-up cell.

echo ""
echo "✅ consumer-matrix start cell: all hard asserts green; xfail #973 reproduces as expected"
