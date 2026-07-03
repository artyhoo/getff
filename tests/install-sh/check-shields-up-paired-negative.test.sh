#!/usr/bin/env bash
# check-shields-up-paired-negative.test.sh — T15 self-application: the check-shields-up.sh gate
# MUST exit 0 when shields are correctly wired AND exit non-zero when they are not — so the gate
# is falsifiable (cannot always-pass) AND does not false-RED on the husky v9 hooksPath (#831).
#
# NON-VACUITY: check-shields-up SKIPs (exit 0) when its target dir is NOT a git repo. So this test
# `git init`s the scratch dir and sets core.hooksPath per-arm — otherwise every arm SKIPs and the
# test becomes a vacuous always-pass (the #832 trap). The POSITIVE arms (ii)/(iii) are the #832
# lesson: a paired-negative with only must-fail arms can't catch an always-fail gate.
#
# ARMS:
#   (i)   form-check: gate script exists and is executable
#   (ii)  POSITIVE: core.hooksPath=.husky      → gate exits 0 (husky v8 convention)
#   (iii) POSITIVE: core.hooksPath=.husky/_     → gate exits 0 (husky v9 convention; #831 regression guard)
#   (iv)  NEGATIVE: core.hooksPath unset        → gate exits non-zero
#   (v)   NEGATIVE: core.hooksPath=.git/hooks   → gate exits non-zero (wrong value)
#
# SKIP condition: git not available (same graceful-degrade as the gate itself). rc=0 on SKIP, rc=1 on FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GATE_SCRIPT="$REPO_ROOT/packages/core/audit-self/check-shields-up.sh"

PASS=0; FAIL=0; SKIP=0
ok()   { PASS=$((PASS+1)); echo "✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "· $1"; }

# ─── Arm (i): form-check ──────────────────────────────────────────────────────
if [ -x "$GATE_SCRIPT" ]; then
  ok "(i) gate script $GATE_SCRIPT exists and is executable"
else
  bad "(i) gate script $GATE_SCRIPT missing or not executable"
fi

# ─── Skip-condition probe: is git resolvable? ────────────────────────────────
if ! command -v git &>/dev/null; then
  skip "(ii) git not available — arms (ii)–(v) SKIP (same condition as the gate)"
  skip "(iii) git not available — SKIP"
  skip "(iv) git not available — SKIP"
  skip "(v) git not available — SKIP"
  echo ""
  echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
  exit 0
fi

# ─── Scratch: isolated git repo with the two shield hooks ─────────────────────
SCRATCH=$(mktemp -d)
trap 'rm -rf "$SCRATCH"' EXIT

git -C "$SCRATCH" init -q
# Shield hooks the gate's Check 2 + Check 3 require (content + executable).
mkdir -p "$SCRATCH/.husky"
cat > "$SCRATCH/.husky/pre-commit" << 'EOF'
#!/usr/bin/env sh
npx lint-staged
EOF
cat > "$SCRATCH/.husky/pre-push" << 'EOF'
#!/usr/bin/env sh
npx tsx packages/core/hooks/pre-push.ts
EOF
chmod +x "$SCRATCH/.husky/pre-commit" "$SCRATCH/.husky/pre-push"

# Run the gate against the scratch repo with a given hooksPath; echoes "<rc>".
run_gate() {  # $1 = hooksPath value, or empty string to unset
  if [ -z "$1" ]; then
    git -C "$SCRATCH" config --unset core.hooksPath 2>/dev/null || true
  else
    git -C "$SCRATCH" config core.hooksPath "$1"
  fi
  AIF_PROJECT_ROOT="$SCRATCH" bash "$GATE_SCRIPT" >/dev/null 2>&1
  echo $?
}

# ─── Arm (ii): POSITIVE — core.hooksPath=.husky → gate exits 0 ───────────────
RC=$(run_gate ".husky")
if [ "$RC" -eq 0 ]; then
  ok "(ii) POSITIVE: core.hooksPath=.husky → gate exits 0 (rc=$RC) — v8 wiring accepted"
else
  bad "(ii) POSITIVE: core.hooksPath=.husky → gate exited non-zero (rc=$RC) — gate rejects a valid wiring (always-fail?)"
fi

# ─── Arm (iii): POSITIVE (#831 regression guard) — .husky/_ → gate exits 0 ───
RC=$(run_gate ".husky/_")
if [ "$RC" -eq 0 ]; then
  ok "(iii) POSITIVE: core.hooksPath=.husky/_ → gate exits 0 (rc=$RC) — husky v9 wiring accepted (#831)"
else
  bad "(iii) POSITIVE: core.hooksPath=.husky/_ → gate exited non-zero (rc=$RC) — #831 false-RED on husky v9"
fi

# ─── Arm (iv): NEGATIVE — core.hooksPath unset → gate exits non-zero ─────────
RC=$(run_gate "")
if [ "$RC" -ne 0 ]; then
  ok "(iv) NEGATIVE: core.hooksPath unset → gate exits non-zero (rc=$RC) — unwired shields caught"
else
  bad "(iv) NEGATIVE: core.hooksPath unset → gate exited 0 — gate accepts unwired shields (vacuous pass)"
fi

# ─── Arm (v): NEGATIVE — core.hooksPath=.git/hooks (wrong) → gate exits non-zero ─
RC=$(run_gate ".git/hooks")
if [ "$RC" -ne 0 ]; then
  ok "(v) NEGATIVE: core.hooksPath=.git/hooks → gate exits non-zero (rc=$RC) — wrong hooksPath caught"
else
  bad "(v) NEGATIVE: core.hooksPath=.git/hooks → gate exited 0 — gate accepts a wrong hooksPath (vacuous pass)"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
[ "$FAIL" -eq 0 ]
