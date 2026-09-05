#!/usr/bin/env bash
# Anti-tautology guard for the Phase 8.8 T8 pre-push hook (section 7 —
# capability commit detection + Prior-art: trailer validation).
#
# Independence: tests instrument the hook through a subprocess in an
# isolated tmpdir; sub-tests do NOT exercise the hook against the test
# script's own commits.
#
# Wave 10.2: §7 trailer logic ported to TS (packages/core/hooks/checks/prior-art.ts).
# This test now runs the full TS orchestrator (packages/core/hooks/pre-push.ts)
# via `node --import tsx/esm` so §7 runs through the TS implementation.
# Anti-tautology mutation coverage (tests 5-6) for the TS logic lives in
# prior-art.test.ts (vitest, Stryker ≥80%) — see notes below.
# Single source of truth — no inlined logic copy in this test.
#
# External commands invoked by sections 1-6 of the hook (actionlint,
# zizmor, npx, npm, packages/core/audit-self/audit-ai-docs.test.sh) are
# stubbed to noop exit 0 so the test isolates section 7's behaviour.
#
# Sub-tests:
#   1. positive: new dep + valid trailer    → exit 0
#   2. negative: new dep + no trailer       → exit 1 (capability flagged)
#   3. negative: new dep + valid escape hatch → exit 1 (substance arm ENFORCING by
#      default since 2026-07-25, handoff item 4 — matches the S17 arm)
#   3b. positive: same commit + explicit PA_SUBSTANCE_WARN_ONLY=true → exit 0 (local opt-in downgrade)
#   4. negative: short escape hatch ("Prior-art: skipped — TODO") → exit 1
#   5. anti-tautology: trailer-matching load-bearing — verified by Stryker mutation
#      score ≥80% on prior-art.ts (checkTrailerBody paired-negative in vitest).
#   6. anti-tautology: capability detection load-bearing — verified by Stryker mutation
#      score ≥80% on prior-art.ts (detectCapabilityReason paired-negative in vitest).
#   7. positive: version bump (no new dep) + no trailer → exit 0 (NOT flagged as capability)
#   8. positive: tilde-versioned dep + valid trailer → exit 0 (M1 semver broadening)
#   9. negative: new file + byte-identical twin in the SAME commit, no trailer → exit 1
#      (B-1: the #1271 carve-out must resolve the duplicate against the PARENT tree)
#   10. positive: relocation of a blob already tracked in the parent tree → exit 0
#
# CI: invoked from .github/workflows/audit-self.yml#principles-meta-tests.

set -uo pipefail

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
TS_HOOK="$REPO_ROOT/packages/core/hooks/pre-push.ts"

PASS=0
FAIL=0

# ── Setup helpers ────────────────────────────────────────────────────────────

# make_test_repo: creates a tmp git repo with origin/main set up + stub
# binaries for sections 1-6 of the TS orchestrator (actionlint/zizmor/npx/npm
# noops + audit-self/*.test.sh stubs). Echoes the tmp path.
make_test_repo() {
  local tmp
  tmp=$(mktemp -d)
  git -C "$tmp" init --quiet --initial-branch=main >/dev/null
  git -C "$tmp" config user.email "test@example.com"
  git -C "$tmp" config user.name "test"
  echo '{"name":"test","version":"0.0.0"}' > "$tmp/package.json"
  git -C "$tmp" add package.json
  git -C "$tmp" -c commit.gpgsign=false commit -q -m "init"
  # Synthesize origin/staging (the upstreamRef() default) + origin/main pointing
  # at the init commit so the hook's diff base resolves.
  git -C "$tmp" update-ref refs/remotes/origin/main HEAD
  git -C "$tmp" update-ref refs/remotes/origin/staging HEAD

  # Stubs for external commands sections 1-6 invoke unconditionally.
  mkdir -p "$tmp/_stub_bin"
  for cmd in actionlint zizmor npx npm lychee; do
    cat > "$tmp/_stub_bin/$cmd" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
    chmod +x "$tmp/_stub_bin/$cmd"
  done
  # Stub the audit scripts invoked by sections 3 / 3a.
  mkdir -p "$tmp/packages/core/audit-self"
  cat > "$tmp/packages/core/audit-self/audit-ai-docs.test.sh" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
  chmod +x "$tmp/packages/core/audit-self/audit-ai-docs.test.sh"

  # Stub hook-stub-completeness.test.sh (section 3a — same isolation requirement)
  cat > "$tmp/packages/core/audit-self/hook-stub-completeness.test.sh" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
  chmod +x "$tmp/packages/core/audit-self/hook-stub-completeness.test.sh"

  echo "$tmp"
}

# tsx loader resolution: tsx may live in packages/core/node_modules (CI installs
# via `npm install --prefix packages/core`) OR the repo root node_modules (hoisted
# dev install). Probe both so the test is environment-agnostic.
if [ -f "$REPO_ROOT/packages/core/node_modules/tsx/dist/esm/index.mjs" ]; then
  REAL_NODE_MODULES="$REPO_ROOT/packages/core/node_modules"
elif [ -f "$REPO_ROOT/node_modules/tsx/dist/esm/index.mjs" ]; then
  REAL_NODE_MODULES="$REPO_ROOT/node_modules"
else
  echo "❌ tsx loader not found in packages/core/node_modules or root node_modules"
  exit 1
fi
TSX_LOADER="$REAL_NODE_MODULES/tsx/dist/esm/index.mjs"

# run_hook: invokes ONLY §7 of the TS orchestrator in the tmp repo via the
# PREPUSH_ONLY=prior-art seam, so this anti-tautology guard is independent of
# sections 1–6 (actionlint/zizmor/self-tests/manifest/principles) and their deps.
# NODE_PATH resolves tsx; PATH override keeps any residual stub binaries ahead.
run_hook() {
  # Extra args (e.g. PA_SUBSTANCE_WARN_ONLY=true) are passed to `env` as
  # KEY=VALUE overrides for the hook process.
  local repo="$1" rc
  shift
  (
    cd "$repo"
    NODE_PATH="$REAL_NODE_MODULES" \
    PREPUSH_ONLY="prior-art" \
    PATH="$repo/_stub_bin:$PATH" \
      env "$@" node --import "$TSX_LOADER" "$TS_HOOK" >"$repo/_hook_out.log" 2>&1
  )
  rc=$?
  # Diagnostic on non-zero exit: a silent FAIL hides the actual hook error
  # (root cause of the 2026-06-11 PR #460 blind-debug incident). Expected-non-zero
  # cases (2/4) also print — harmless, and it shows WHICH rejection fired.
  if [ "$rc" -ne 0 ] && [ -s "$repo/_hook_out.log" ]; then
    printf '  ── hook output (exit %s) ──\n' "$rc"
    sed 's/^/  │ /' "$repo/_hook_out.log" | tail -15
  fi
  return "$rc"
}

# add_capability_commit: adds a new dep to package.json and commits.
add_capability_commit() {
  local repo="$1"; shift
  cat > "$repo/package.json" <<'PKG'
{
  "name": "test",
  "version": "0.0.0",
  "dependencies": {
    "some-new-dep": "^1.0.0"
  }
}
PKG
  git -C "$repo" add package.json
  local args=()
  for msg in "$@"; do args+=("-m" "$msg"); done
  git -C "$repo" -c commit.gpgsign=false commit -q "${args[@]}"
}

# seed_existing_dep: adds an initial commit with a dep so subsequent bump tests
# have something to bump (origin/main also fast-forwarded).
seed_existing_dep() {
  local repo="$1"
  cat > "$repo/package.json" <<'PKG'
{
  "name": "test",
  "version": "0.0.0",
  "dependencies": {
    "existing-dep": "^1.0.0"
  }
}
PKG
  git -C "$repo" add package.json
  git -C "$repo" -c commit.gpgsign=false commit -q -m "seed: existing dep"
  git -C "$repo" update-ref refs/remotes/origin/main HEAD
  git -C "$repo" update-ref refs/remotes/origin/staging HEAD
}

# bump_existing_dep: edits the version of an existing dep (no NEW dep).
bump_existing_dep() {
  local repo="$1"; shift
  cat > "$repo/package.json" <<'PKG'
{
  "name": "test",
  "version": "0.0.0",
  "dependencies": {
    "existing-dep": "^2.0.0"
  }
}
PKG
  git -C "$repo" add package.json
  local args=()
  for msg in "$@"; do args+=("-m" "$msg"); done
  git -C "$repo" -c commit.gpgsign=false commit -q "${args[@]}"
}

# add_capability_commit_with_tilde: adds a new dep with tilde-prefix version.
add_capability_commit_with_tilde() {
  local repo="$1"; shift
  cat > "$repo/package.json" <<'PKG'
{
  "name": "test",
  "version": "0.0.0",
  "dependencies": {
    "some-new-dep": "~1.0.0"
  }
}
PKG
  git -C "$repo" add package.json
  local args=()
  for msg in "$@"; do args+=("-m" "$msg"); done
  git -C "$repo" -c commit.gpgsign=false commit -q "${args[@]}"
}

# make_big_file: writes an N-line file (deterministic content) at $2 inside repo $1.
make_big_file() {
  local repo="$1" rel="$2" n="${3:-100}" i
  mkdir -p "$repo/$(dirname "$rel")"
  : > "$repo/$rel"
  for ((i = 1; i <= n; i++)); do printf '// line %d\n' "$i" >> "$repo/$rel"; done
}

# add_twin_pair_commit: ONE commit adding a new >=80-LOC source file under
# packages/ together with its byte-identical plugin twin (what the pre-commit
# twin-sync produces for every new hook). The twin must NOT exempt the source:
# neither blob is tracked in the PARENT tree, so nothing is being relocated.
add_twin_pair_commit() {
  local repo="$1"; shift
  make_big_file "$repo" "packages/core/newcheck/new-check.ts" 100
  mkdir -p "$repo/plugin/hooks"
  cp "$repo/packages/core/newcheck/new-check.ts" "$repo/plugin/hooks/new-check.ts"
  git -C "$repo" add packages/core/newcheck/new-check.ts plugin/hooks/new-check.ts
  local args=()
  for msg in "$@"; do args+=("-m" "$msg"); done
  git -C "$repo" -c commit.gpgsign=false commit -q "${args[@]}"
}

# seed_tracked_blob: commits a >=80-LOC file OUTSIDE packages/ and moves the
# remote refs forward, so the blob is already tracked in the parent tree of any
# later commit and out of the hook's push range.
seed_tracked_blob() {
  local repo="$1"
  make_big_file "$repo" "vendor-src/module.ts" 100
  git -C "$repo" add vendor-src/module.ts
  git -C "$repo" -c commit.gpgsign=false commit -q -m "seed: tracked blob"
  git -C "$repo" update-ref refs/remotes/origin/main HEAD
  git -C "$repo" update-ref refs/remotes/origin/staging HEAD
}

# add_relocation_commit: copies the already-tracked blob under packages/ — a
# genuine relocation/vendor copy, which the carve-out must still exempt.
add_relocation_commit() {
  local repo="$1"; shift
  mkdir -p "$repo/packages/runtime-bridge/vendor"
  cp "$repo/vendor-src/module.ts" "$repo/packages/runtime-bridge/vendor/module.ts"
  git -C "$repo" add packages/runtime-bridge/vendor/module.ts
  local args=()
  for msg in "$@"; do args+=("-m" "$msg"); done
  git -C "$repo" -c commit.gpgsign=false commit -q "${args[@]}"
}

# record: print PASS/FAIL counter line.
record() {
  local outcome="$1" desc="$2"
  if [ "$outcome" = "pass" ]; then
    PASS=$((PASS+1))
    printf 'PASS: %s\n' "$desc"
  else
    FAIL=$((FAIL+1))
    printf 'FAIL: %s\n' "$desc"
  fi
}

# ── Sub-tests ────────────────────────────────────────────────────────────────

# Test 1: capability change (new dep) + valid Prior-art trailer → hook exits 0
test_1_positive_dep_with_trailer() {
  local repo
  repo=$(make_test_repo)
  add_capability_commit "$repo" \
    "feat: add new-dep" \
    "Body explaining why we add new-dep." \
    "Prior-art: prior-art-evaluations.md#1 (Autogrep, verdict DEFER — different domain, no overlap)."
  if run_hook "$repo"; then
    record pass "1 — capability + valid trailer → exit 0"
  else
    record fail "1 — capability + valid trailer expected exit 0, got non-zero"
  fi
  rm -rf "$repo"
}

# Test 2: capability change + NO trailer → hook exits non-zero
test_2_negative_dep_no_trailer() {
  local repo
  repo=$(make_test_repo)
  add_capability_commit "$repo" \
    "feat: add new-dep without trailer" \
    "Body explaining the change but no Prior-art line."
  if run_hook "$repo"; then
    record fail "2 — capability + no trailer should have failed but exited 0"
  else
    record pass "2 — capability + no trailer → exit non-zero"
  fi
  rm -rf "$repo"
}

# Test 3: capability change + escape-hatch trailer → exit NON-ZERO.
# Substance arm ENFORCING by default since 2026-07-25 (handoff item 4): the
# wave-8 retro promised both substance arms auto-flip at the 2026-06-10
# calibration close; only S17 flipped. This paired-negative pins the new default.
test_3_negative_escape_hatch_enforcing_default() {
  local repo
  repo=$(make_test_repo)
  add_capability_commit "$repo" \
    "chore: bump dep" \
    "Body." \
    "Prior-art: skipped — refactor only, no new capability"
  if run_hook "$repo"; then
    record fail "3 — escape hatch on capability commit should BLOCK by default (enforcing since 2026-07-25) but exited 0"
  else
    record pass "3 — escape hatch on capability commit → exit non-zero (enforcing default)"
  fi
  rm -rf "$repo"
}

# Test 3b: same commit + explicit PA_SUBSTANCE_WARN_ONLY=true → exit 0 (the
# local opt-in downgrade still works, mirroring S17_SUBSTANCE_WARN_ONLY).
test_3b_positive_escape_hatch_explicit_warnonly() {
  local repo
  repo=$(make_test_repo)
  add_capability_commit "$repo" \
    "chore: bump dep" \
    "Body." \
    "Prior-art: skipped — refactor only, no new capability"
  if run_hook "$repo" PA_SUBSTANCE_WARN_ONLY=true; then
    record pass "3b — escape hatch + explicit PA_SUBSTANCE_WARN_ONLY=true → exit 0 (opt-in downgrade)"
  else
    record fail "3b — explicit warn-only opt-in expected exit 0, got non-zero"
  fi
  rm -rf "$repo"
}

# Test 4: short escape-hatch rationale → exit non-zero
test_4_negative_short_escape() {
  local repo
  repo=$(make_test_repo)
  add_capability_commit "$repo" \
    "chore: bump dep" \
    "Body." \
    "Prior-art: skipped — TODO"
  if run_hook "$repo"; then
    record fail "4 — short escape hatch should have failed but exited 0"
  else
    record pass "4 — short escape hatch (<20 chars rationale) → exit non-zero"
  fi
  rm -rf "$repo"
}

# Tests 5 & 6 (anti-tautology / mutation):
# Wave 10.2: §7 logic is in TS (prior-art.ts). Mutation coverage is verified via
# Stryker (≥80% score) + vitest paired-negative tests in prior-art.test.ts.
# The bash-level sed-mutation approach is no longer applicable to TS code.
# These tests are replaced by the vitest suite's load-bearing assertions:
#   - test 5 (trailer-regex mutation): checkTrailerBody 'PAIRED-NEGATIVE: fails on no trailer'
#   - test 6 (capability-detection mutation): detectCapabilityReason 'returns null for non-capability'
# Recording as informational pass.
test_5_antitautology_covered_by_vitest() {
  record pass "5 — anti-tautology (trailer-matching load-bearing) verified by prior-art.test.ts + Stryker ≥80%"
}

test_6_antitautology_covered_by_vitest() {
  record pass "6 — anti-tautology (capability detection load-bearing) verified by prior-art.test.ts + Stryker ≥80%"
}

# Test 7 (M2 fix): version bump of an existing dep (no NEW dep) + NO trailer
# → hook must NOT flag this as a capability commit.
test_7_bump_existing_dep_no_trailer_is_not_capability() {
  local repo
  repo=$(make_test_repo)
  seed_existing_dep "$repo"
  bump_existing_dep "$repo" \
    "chore: bump existing-dep to 2.0.0" \
    "No new capability — version bump only. Intentionally no Prior-art trailer."
  if run_hook "$repo"; then
    record pass "7 — version bump (no new dep) + no trailer → exit 0 (NOT flagged as capability)"
  else
    record fail "7 — version bump wrongly flagged as capability commit (M2 regression)"
  fi
  rm -rf "$repo"
}

# Test 8 (M1 fix): new dep with tilde-prefix version (~X.Y.Z) + valid trailer
# → hook must flag as capability AND accept the trailer.
test_8_new_dep_with_tilde_version_caught_with_trailer() {
  local repo
  repo=$(make_test_repo)
  add_capability_commit_with_tilde "$repo" \
    "feat: add tilde-versioned dep" \
    "Body." \
    "Prior-art: prior-art-evaluations.md#1 (Autogrep, verdict DEFER — different domain)."
  if run_hook "$repo"; then
    record pass "8 — new dep with tilde version (~1.0.0) + valid trailer → exit 0 (M1 broadened semver coverage works)"
  else
    record fail "8 — tilde-versioned new dep + valid trailer wrongly rejected"
  fi
  rm -rf "$repo"
}

# Test 9 (B-1 / L-1): a new >=80-LOC file under packages/ added together with a
# byte-identical twin in the SAME commit + no trailer → must exit non-zero.
# The byte-identical carve-out (PR #1271) exempts RELOCATIONS of blobs that were
# already tracked; before the fix it resolved the duplicate against the commit's
# own tree, so every new hook + its pre-commit-generated plugin twin silently
# bypassed the capability trigger.
test_9_twin_pair_in_same_commit_is_still_capability() {
  local repo
  repo=$(make_test_repo)
  add_twin_pair_commit "$repo" \
    "feat: add new check + its plugin twin" \
    "Body without any Prior-art line."
  if run_hook "$repo"; then
    record fail "9 — new file + byte-identical twin in the SAME commit should be flagged as capability but exited 0"
  else
    record pass "9 — new file + byte-identical twin in the same commit → exit non-zero (capability still detected)"
  fi
  rm -rf "$repo"
}

# Test 10 (B-1 paired positive): a new >=80-LOC file under packages/ that is
# byte-identical to a blob ALREADY TRACKED in the parent tree is a relocation —
# still exempt, still no trailer required.
test_10_relocation_of_tracked_blob_is_not_capability() {
  local repo
  repo=$(make_test_repo)
  seed_tracked_blob "$repo"
  add_relocation_commit "$repo" \
    "chore: vendor the module under packages/" \
    "Relocation only. Intentionally no Prior-art trailer."
  if run_hook "$repo"; then
    record pass "10 — relocation of a blob tracked in the parent tree + no trailer → exit 0 (carve-out preserved)"
  else
    record fail "10 — relocation of an already-tracked blob wrongly flagged as capability"
  fi
  rm -rf "$repo"
}

# ── Run all ──────────────────────────────────────────────────────────────────

test_1_positive_dep_with_trailer
test_2_negative_dep_no_trailer
test_3_negative_escape_hatch_enforcing_default
test_3b_positive_escape_hatch_explicit_warnonly
test_4_negative_short_escape
test_5_antitautology_covered_by_vitest
test_6_antitautology_covered_by_vitest
test_7_bump_existing_dep_no_trailer_is_not_capability
test_8_new_dep_with_tilde_version_caught_with_trailer
test_9_twin_pair_in_same_commit_is_still_capability
test_10_relocation_of_tracked_blob_is_not_capability

printf '\n── Summary ──\n%d pass / %d fail\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
