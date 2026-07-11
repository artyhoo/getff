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

# ── ANTI-THEATRE (N-S3-b): rule-channel-readability probe (Surface 9) must FLAG a seeded
# core rule with NO surviving delivery channel on a supported harness. Without this negative,
# the probe could silently rot into an always-PORTABLE no-op (the T2 "harness is theatre" gap)
# the same way channel-coverage's own paired-negative above guards against for Surface 8.
#
# The probe shells out to scripts/render-rule-channels.mjs (real script — not copied, since it
# imports packages/core/principles/rule-channel-glob.ts + the ajv package via node_modules;
# copying it would require replicating that whole dependency chain into the sandbox). Only the
# DATA (.ai-factory/rule-channel-capabilities.json + schema + a minimal .claude/rules/ set) is
# seeded; --root points the real script at the sandbox tree.
RCROOT=$(mktemp -d)
mkdir -p "$RCROOT/.ai-factory" "$RCROOT/.claude/rules" "$RCROOT/tests/agnosticism/probes"
cp "$REPO_ROOT/tests/agnosticism/_cc-absent-lib.sh" "$RCROOT/tests/agnosticism/"
cp "$REPO_ROOT/tests/agnosticism/probes/rule-channel-readability.sh" "$RCROOT/tests/agnosticism/probes/"
cp "$REPO_ROOT/.ai-factory/rule-channel-capabilities.schema.json" "$RCROOT/.ai-factory/"
# Seed ONE Tier-0-shaped rule via its real name (ALWAYS_ON_CORE is name-keyed in the script) and
# ONE paths:-declaring rule — both must resolve to "refused" once the capability matrix below
# strips every fallback primitive from the (only) supported harness.
cp "$REPO_ROOT/.claude/rules/ai-laziness-traps.md" "$RCROOT/.claude/rules/ai-laziness-traps.md"
cp "$REPO_ROOT/.claude/rules/ci-tool-pinning.md" "$RCROOT/.claude/rules/ci-tool-pinning.md"
cat > "$RCROOT/.ai-factory/rule-channel-capabilities.json" <<'EOF'
{
  "harnesses": {
    "seeded-broken": {
      "support": "supported",
      "axis": "shipped",
      "rulesAutoload": false,
      "pathScoping": false,
      "claudeMdExcludes": false,
      "postToolUseInject": false,
      "sessionStartHook": false
    }
  }
}
EOF
printf '{"degradations":[]}\n' > "$RCROOT/.ai-factory/rule-channel-degradations.json"
# The probe uses `git -C "$REPO_ROOT"` inside render-rule-channels.mjs's inScopeRules() via
# execFileSync — mirrors channel-coverage's own git-repo seed requirement above.
( unset GIT_DIR GIT_COMMON_DIR GIT_WORK_TREE; cd "$RCROOT" && git init -q && git add -A ) >/dev/null 2>&1

# tsx is a packages/core devDep (CI installs it there via `npm ci --prefix packages/core`);
# a hoisted local checkout has it at root. Resolve packages/core first, then root.
RC_TSX="$REPO_ROOT/packages/core/node_modules/.bin/tsx"
[ -x "$RC_TSX" ] || RC_TSX="$REPO_ROOT/node_modules/.bin/tsx"
rc_out=$("$RC_TSX" "$REPO_ROOT/scripts/render-rule-channels.mjs" --json --root "$RCROOT" 2>&1)
echo "$rc_out" | grep -q '"rule":"ai-laziness-traps".*"verdict":"refused"' \
  && ok "rule-channel-readability data: Tier-0 rule computes refused when every fallback is stripped" \
  || bad "rule-channel-readability data MISSED the Tier-0 refusal — seeded-break not reaching computeVerdict()"
echo "$rc_out" | grep -q '"rule":"ci-tool-pinning".*"verdict":"refused"' \
  && ok "rule-channel-readability data: paths:-rule computes refused when every fallback is stripped" \
  || bad "rule-channel-readability data MISSED the paths:-rule refusal — seeded-break not reaching computeVerdict()"

# Now run the ACTUAL probe script end-to-end (not just the generator) to prove the bash wrapper
# itself turns those refused rows into a CC-ONLY (RED) record, not a silent PORTABLE. The probe
# resolves REPO_ROOT from its own path (three levels up from tests/agnosticism/probes/), so it
# must find scripts/render-rule-channels.mjs (+ its packages/core/principles/rule-channel-glob.ts
# import + the ajv package) inside RCROOT too — symlink those real dirs in, unmodified, so the
# SHIPPED probe script runs exactly as authored (not a variant).
ln -sfn "$REPO_ROOT/scripts" "$RCROOT/scripts"
ln -sfn "$REPO_ROOT/packages" "$RCROOT/packages"
ln -sfn "$REPO_ROOT/node_modules" "$RCROOT/node_modules"
probe_out=$(cd "$RCROOT/tests/agnosticism/probes" && RECORD_FILE=/dev/stdout bash rule-channel-readability.sh)
echo "$probe_out" | grep -qE 'no-invisible-core-rules.*CC-ONLY' \
  && ok "rule-channel-readability probe (end-to-end) flags the seeded invisible rules — CC-ONLY, not silently PORTABLE" \
  || bad "rule-channel-readability probe MISSED the seeded invisible rules — probe is blind (T2 harness-theatre gap)"
rm -rf "$RCROOT"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
