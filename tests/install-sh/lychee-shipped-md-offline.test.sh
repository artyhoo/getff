#!/usr/bin/env bash
# Consumer-side link integrity for shipped markdown (2026-07-10 flat-install smoke incident):
# on a consumer's FIRST `git push`, pre-push §8 runs `lychee --offline` over every changed
# *.md — i.e. every shipped file. Shipped .claude/skills/*/SKILL.md + .claude/agents/*.md
# carried ~87 relative links to .claude/rules/*.md which are NOT shipped, so the first push
# went red on any machine with lychee installed. Root fix: transform_internal_refs rewrites
# rules/ refs to GitHub blob URLs (setup.d/lib.sh), applied on BOTH skills and agents paths.
#
#   (pos) real install (mirror f8) → `lychee --offline` over installed .claude/**/*.md
#         reports ZERO broken file links (offline mode skips remote/blob URLs by design).
#   (neg) planting a dangling relative link in an installed skill file makes lychee FAIL —
#         proving the probe bites and is not vacuous.
#
# Skips (exit 0, loud note) when lychee is not on PATH — mirrors pre-push §8's own gating.
#
# POPULATION — factory depth, not core (widened 2026-08-17, same class as GH #1377/PR #1413):
# the fixture used to install `ts-server --full --force`. `--full` is the dev-deps flag, NOT a
# depth flag (install.sh:114 sets FULL; PROFILE is a separate `--profile` arg at :128), so with
# no `--profile` the fixture resolved to `core` — 35 *.md, 4 skills. Everything gated behind
# env/factory depth was therefore OUTSIDE the gate's population entirely and stayed green while
# shipping dangling links: the 6 env+factory skills (GETFF_SKILLS_ENV/_FACTORY, setup.d/lib.sh:59)
# and the factory-only runtime-bridge vendor drop (setup.d/55-runtime-bridge-vendor.sh:65 returns
# early at core/env). Measured 2026-08-17: core = 35 *.md / 4 skills, factory = 64 *.md / 14
# skills, and `comm -23` proves core ⊂ factory strictly — so installing at factory depth is a
# pure widening, losing no coverage. At factory depth the gate found 17 broken links across 6
# inputs (10 × `](../../../CLAUDE.md)`, 2 × the vendor README, 2 × run-local-ci-sweep.sh, and one
# each for reviewer/SKILL.md, check-worker-dispatch-channel.sh, pull_request_template.md).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

if ! command -v lychee >/dev/null 2>&1; then
  echo "  ⊝ SKIP: lychee not on PATH (probe mirrors pre-push §8 which is also lychee-gated)"
  exit 0
fi

T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
printf '{"name":"lychee-fixture","version":"0.0.0"}\n' > "$T/package.json"
( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --full --force --profile factory ) >/dev/null 2>&1 \
  || { bad "install.sh exited non-zero — fixture install failed"; echo "PASS=$PASS FAIL=$FAIL"; exit 1; }

# Non-vacuity guard on the widening (mirrors tests/install-sh/gh-531-shipped-prettier.test.sh:256):
# every factory-depth assertion below is silently VACUOUS if the profile gate regresses and the
# deep surface never lands. Assert the two markers of factory depth — the vendor drop (the
# factory-only layer) and an env-tier skill — before trusting a green lychee run.
[ -d "$T/.claude/vendor/runtime-bridge" ] && [ -d "$T/.claude/skills/pipeline" ] \
  && ok "fixture installed at factory depth (.claude/vendor/runtime-bridge + env-tier skills present)" \
  || { bad "fixture lacks .claude/vendor/runtime-bridge or .claude/skills/pipeline — profile gate regressed, ALL assertions below VACUOUS"; echo "PASS=$PASS FAIL=$FAIL"; exit 1; }

# Whole installed tree (minus node_modules) — the first consumer push runs lychee over
# EVERY shipped .md (AGENTS.md, .ai-factory/*.md, .claude/**), not just .claude/**.
MD_FILES=$(find "$T" -name '*.md' -type f -not -path "$T/node_modules/*" 2>/dev/null)
if [ -z "$MD_FILES" ] || ! grep -q '/.claude/' <<<"$MD_FILES"; then
  bad "install shipped no .claude/**/*.md — fixture broken"
  echo "PASS=$PASS FAIL=$FAIL"; exit 1
fi
N_MD=$(wc -l <<<"$MD_FILES" | tr -d ' ')

run_lychee() {
  # --offline: only filesystem links checked; remote (blob) URLs excluded — matches pre-push §8.
  ( cd "$T" && find . -name '*.md' -type f -not -path './node_modules/*' -print0 \
      | xargs -0 lychee --offline --no-progress ) 2>&1
}

# ── pos ──────────────────────────────────────────────────────────────────────
OUT=$(run_lychee); RC=$?
if [ "$RC" -eq 0 ]; then
  ok "pos: lychee --offline clean over $N_MD installed *.md files (whole tree minus node_modules)"
else
  bad "pos: lychee found broken links (rc=$RC) over $N_MD files — first consumer push would be RED"
  grep -E 'ERROR|✗' <<<"$OUT" | head -15 | sed 's/^/      /'
fi

# ── refresh arm: --refresh must not reintroduce dangling links ────────────────
# do_refresh (install.sh) re-copies agents + plain-copy skills on a separate code path
# (@sync-with-layers hand-sync); cold-review of 081447838 caught it bypassing the transform —
# a consumer's first push AFTER an upgrade went red again (35 broken links reproduced).
( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server --refresh ) >/dev/null 2>&1 \
  || { bad "refresh: install.sh --refresh exited non-zero"; echo "PASS=$PASS FAIL=$FAIL"; exit 1; }
OUT_R=$(run_lychee); RC_R=$?
if [ "$RC_R" -eq 0 ]; then
  ok "refresh: lychee still clean after --refresh (refresh path transforms too)"
else
  bad "refresh: --refresh reintroduced broken links (rc=$RC_R) — next consumer push after upgrade RED"
  grep -E 'ERROR|✗' <<<"$OUT_R" | head -10 | sed 's/^/      /'
fi

# ── neg (probe bites) ────────────────────────────────────────────────────────
VICTIM=$(head -1 <<<"$MD_FILES")
printf '\n[planted dangling link](../../rules/__no-such-rule__.md)\n' >> "$VICTIM"
if OUT2=$(run_lychee); then
  bad "neg: planted dangling link NOT caught — probe is vacuous"
else
  ok "neg: planted dangling link caught by lychee (probe bites)"
fi

echo ""
echo "Result: ${PASS} pass / ${FAIL} fail"
[ "$FAIL" -eq 0 ]
