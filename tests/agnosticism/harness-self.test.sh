#!/usr/bin/env bash
set -uo pipefail
# Resolve by path, not `git rev-parse` — GIT_DIR-immune for worktree-push hook env (see run-audit.sh).
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
source "$REPO_ROOT/tests/agnosticism/_cc-absent-lib.sh"

# cc_scrub must remove CLAUDE_* from the child env
out=$(CLAUDE_PROJECT_DIR=/x CLAUDE_SKILL_DIR=/y cc_scrub 'env')
echo "$out" | grep -q '^CLAUDE_' && bad "scrub leaked CLAUDE_* into child" || ok "scrub removes CLAUDE_* env"

# assert_cc_absent must SUCCEED inside cc_scrub and FAIL when CLAUDE_PROJECT_DIR is set
cc_scrub 'bash -c "source '"$REPO_ROOT"'/tests/agnosticism/_cc-absent-lib.sh; assert_cc_absent"' \
  && ok "assert_cc_absent passes under scrub" || bad "assert_cc_absent wrongly failed under scrub"
CLAUDE_PROJECT_DIR=/x bash -c "source $REPO_ROOT/tests/agnosticism/_cc-absent-lib.sh; assert_cc_absent" 2>/dev/null \
  && bad "assert_cc_absent passed WITH CC env (false-green risk)" || ok "assert_cc_absent fails when CC present"

# ── ANTI-THEATRE: a gate that hard-requires CC must be FLAGGED by the harness ──
# Seed a fake "gate" script that only succeeds when CLAUDE_PROJECT_DIR is set.
SEED=$(mktemp -d)
cat > "$SEED/cc-coupled-gate.sh" <<'EOF'
#!/usr/bin/env bash
[ -n "${CLAUDE_PROJECT_DIR:-}" ] || { echo "needs Claude Code" >&2; exit 3; }
echo "ran"; exit 0
EOF
chmod +x "$SEED/cc-coupled-gate.sh"
# Under scrub the seeded gate MUST fail (exit 3). If it passes, the harness is blind.
cc_scrub "bash $SEED/cc-coupled-gate.sh" >/dev/null 2>&1 \
  && bad "anti-theatre: CC-coupled gate PASSED under scrub — harness is blind" \
  || ok "anti-theatre: harness flags a CC-coupled gate (exit non-zero under scrub)"
rm -rf "$SEED"

# ── ANTI-THEATRE: channel-coverage probe (Surface 8) must FLAG a seeded missing/dangling
# marker and PASS a marked hook. Without this, the probe could silently rot into an
# always-PORTABLE no-op and principle 21 would stay green (the T2 "harness is theatre" gap).
CCROOT=$(mktemp -d)
mkdir -p "$CCROOT/tests/agnosticism/probes" "$CCROOT/.claude/hooks"
cp "$REPO_ROOT/tests/agnosticism/_cc-absent-lib.sh" "$CCROOT/tests/agnosticism/"
cp "$REPO_ROOT/tests/agnosticism/probes/channel-coverage.sh" "$CCROOT/tests/agnosticism/probes/"
printf '#!/usr/bin/env bash\n# no delivery-channel marker\necho hi\n'                    > "$CCROOT/.claude/hooks/markerless.sh"
printf '#!/usr/bin/env bash\n# @dual-pair: seeded-nonexistent-anchor\necho hi\n'          > "$CCROOT/.claude/hooks/dangling.sh"
printf '#!/usr/bin/env bash\n# @cc-only-rationale: seeded deliberate CC-only\necho hi\n'  > "$CCROOT/.claude/hooks/marked.sh"
printf '{"hooks":{}}\n' > "$CCROOT/.claude/settings.json"
# Probe population comes from `git ls-files`, so the seed must be a git repo with hooks staged.
( unset GIT_DIR GIT_COMMON_DIR GIT_WORK_TREE; cd "$CCROOT" && git init -q && git add -A ) >/dev/null 2>&1
cc_out=$(RECORD_FILE=/dev/stdout bash "$CCROOT/tests/agnosticism/probes/channel-coverage.sh")
echo "$cc_out" | grep -q 'markerless\.sh.*CC-ONLY-NO-MARKER' \
  && ok "channel-coverage flags a markerless hook" \
  || bad "channel-coverage MISSED a markerless hook — probe is blind"
echo "$cc_out" | grep -q 'dangling\.sh.*DANGLING-PAIR' \
  && ok "channel-coverage flags a dangling @dual-pair anchor" \
  || bad "channel-coverage MISSED a dangling @dual-pair — §5 drift-check blind"
echo "$cc_out" | grep -q 'marked\.sh.*PORTABLE' \
  && ok "channel-coverage passes a cc-only-rationale hook" \
  || bad "channel-coverage wrongly flagged a properly-marked hook"
rm -rf "$CCROOT"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
