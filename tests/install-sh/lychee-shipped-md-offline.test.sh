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
( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --full --force ) >/dev/null 2>&1

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
  BROKEN=$(grep -cE 'ERROR|✗' <<<"$OUT" || true)
  bad "pos: lychee found broken links (rc=$RC) over $N_MD files — first consumer push would be RED"
  grep -E 'ERROR|✗' <<<"$OUT" | head -15 | sed 's/^/      /'
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
