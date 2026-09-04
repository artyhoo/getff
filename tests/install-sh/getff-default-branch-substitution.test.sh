#!/usr/bin/env bash
# tests/install-sh/getff-default-branch-substitution.test.sh — getff-honest-signals S4 paired fixture.
#
# Closes the S4 defect class: shipped CI workflow templates hard-coded `branches: [main]` +
# `refs/heads/main` (cancel-in-progress); a consumer whose default branch is `master` (or
# anything else) installed a workflow that NEVER TRIGGERED. The fix (setup.d/lib.sh
# `deliver_getff_workflow`) substitutes the consumer's actual default branch at install time.
#
# Three cells (binding per .ai-factory/plans/feature-getff-honest-signals-s4-032181.md §3 + Task 4):
#   (1) master-default consumer → delivered python AND cargo AND go workflows carry
#       `branches: [master]` AND `refs/heads/master` (T-HS-A: assert EXIT CODE / delivered-content
#       first; T-S4-A: assert on the DELIVERED file, not the template).
#   (2) main-default consumer → delivered byte-identical to template (symmetry — a substitution
#       that always writes one value is the same bug with a different constant).
#   (3) no-remote consumer (PARK case, kickoff §5) → byte-identical to template AND a LOUD stderr
#       warning was emitted (Option A — recommended; this cell makes the choice visible so the
#       maintainer flipping to B/C in review sees the test fail and the choice forced).
#
# RED-then-GREEN proof (T3, T7, T14, T15): cell (1) goes RED against the unmodified lanes
# (template hard-codes `main`, so a master-default consumer receives `branches: [main]` and the
# assertion on `branches: [master]` fails). Quoted in the PR body via:
#   git stash                       # revert S4 helper + lane wirings to pre-fix state
#   bash tests/install-sh/getff-default-branch-substitution.test.sh   # → RED on cell (1)
#   git stash pop                   # restore S4
#   bash tests/install-sh/getff-default-branch-substitution.test.sh   # → GREEN
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
TPL_PY="$REPO_ROOT/packages/core/templates/python/github-actions-ci.yml"
TPL_CARGO="$REPO_ROOT/packages/core/templates/cargo/github-actions-ci.yml"
# The go lane shipped its workflow through a plain copy_safe until 2026-08-17 — S4 wired python
# + cargo + the preset lanes and left the go lane on the pre-S4 shape, so a non-`main` go consumer
# installed a getff-go.yml that never triggered. The lane is covered from here on, in every cell
# its siblings are covered in: an untested third lane is how the first one drifted.
TPL_GO="$REPO_ROOT/packages/core/templates/go/github-actions-ci.yml"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# Sets up the dispatcher-scope globals + sources lib.sh + both lanes (LIB_ONLY seam).
# Mirrors tests/install-sh/python-delivery.test.sh:38-49 + the cargo lane's CARGO_LAYER_LIB_ONLY
# seam (cargo-entry-lane.test.sh:288-301).
setup_lanes() {
  PKG_ROOT="$REPO_ROOT"
  PROJECT_ROOT=""
  FORCE=""
  DRY_RUN=""
  SKIPPED=()
  export INSTALL_SH_LIB_ONLY=1
  # shellcheck source=/dev/null
  source "$REPO_ROOT/setup.d/lib.sh"
  export PY_LAYER_LIB_ONLY=1
  # shellcheck source=/dev/null
  source "$REPO_ROOT/setup.d/45-python.sh"
  export CARGO_LAYER_LIB_ONLY=1
  # shellcheck source=/dev/null
  source "$REPO_ROOT/setup.d/46-cargo.sh"
  export GO_LAYER_LIB_ONLY=1
  # shellcheck source=/dev/null
  source "$REPO_ROOT/setup.d/47-go.sh"
}
setup_lanes

# run_python_delivery <project_root> — set globals + invoke the python lane entrypoint directly.
# NOTE: do NOT add `2>&1` here — the caller controls redirection (cells 3/4 use `2>&1 1>/dev/null`
# to capture stderr separately for the PARK-case warning assertion). An internal `2>&1` would
# merge stderr into stdout inside the function, then the outer `1>/dev/null` would discard both.
run_python_delivery() {
  PROJECT_ROOT="$1"; SKIPPED=(); FORCE=""; DRY_RUN=""
  unset GETFF_TOOLCHAIN_REFRESH
  deliver_python_toolchain
}
# run_cargo_delivery <project_root> — same for the cargo lane (see note above).
run_cargo_delivery() {
  PROJECT_ROOT="$1"; SKIPPED=(); FORCE=""; DRY_RUN=""
  unset GETFF_TOOLCHAIN_REFRESH
  deliver_cargo_toolchain
}
# run_go_delivery <project_root> — same for the go lane (see note above).
run_go_delivery() {
  PROJECT_ROOT="$1"; SKIPPED=(); FORCE=""; DRY_RUN=""
  unset GETFF_TOOLCHAIN_REFRESH
  deliver_go_toolchain
}

# init_consumer <project_root> <default_branch> — turn an empty dir into a consumer repo whose
# `git symbolic-ref refs/remotes/origin/HEAD` resolves to refs/heads/<default_branch>.
init_consumer() {
  local root="$1" branch="$2"
  git -C "$root" init -q
  git -C "$root" config user.email "test@getff.local"
  git -C "$root" config user.name "getff S4 test"
  git -C "$root" remote add origin https://github.com/getff-test/consumer.git
  git -C "$root" symbolic-ref refs/remotes/origin/HEAD "refs/heads/$branch"
  # Check out the named branch and put ONE commit on it so HEAD exists (some git
  # versions refuse to operate on an unborn branch in subtle ways).
  git -C "$root" checkout -b "$branch" -q 2>/dev/null || git -C "$root" branch -m "$branch" 2>/dev/null || true
  printf '# %s\n' "$branch" > "$root/README.md"
  git -C "$root" add README.md
  git -C "$root" commit -q -m "initial commit on $branch" 2>/dev/null || true
}

echo "▶ getff S4 — default-branch substitution (paired RED-then-GREEN fixture)"
echo ""

# ── Cell (1): master-default consumer — substitution MUST fire (T-HS-A, T-S4-A) ────────────────
echo "  ── cell (1): master-default consumer → delivered workflows carry [master] ──"
P=$(mktemp -d)
printf '{"name":"c1-master","version":"0.0.0"}\n' > "$P/package.json"
init_consumer "$P" master
run_python_delivery "$P" >/dev/null
run_cargo_delivery  "$P" >/dev/null
run_go_delivery     "$P" >/dev/null
# T-HS-A: assert EXIT CODE / delivered-content FIRST via grep -qE (no wording match).
if [ -f "$P/.github/workflows/getff-python.yml" ] && [ -f "$P/.github/workflows/getff-cargo.yml" ] && [ -f "$P/.github/workflows/getff-go.yml" ]; then
  ok "(1) all three delivered workflow files exist"
else
  bad "(1) one or more delivered workflow files missing (py=$( [ -f "$P/.github/workflows/getff-python.yml" ] && echo yes || echo no ) cargo=$( [ -f "$P/.github/workflows/getff-cargo.yml" ] && echo yes || echo no ) go=$( [ -f "$P/.github/workflows/getff-go.yml" ] && echo yes || echo no ))"
fi
# Cell (1) assertions: count branch-ref occurrences in EACH delivered file.
# Expected per file: 2× `branches: [master]` + 1× `refs/heads/master` = 3 hits.
# Pre-fix (template hard-coded `main`): 0 hits → RED. Post-fix (substitution): 3 hits → GREEN.
# NOTE: grep -c already prints "0" and exits 1 on no-match — appending `|| echo 0` doubles the
# "0" (yielding multi-line "0\n0"), so use `|| true` to consume the non-zero exit cleanly.
n_master_py=$(grep -cE 'branches: \[master\]|refs/heads/master' "$P/.github/workflows/getff-python.yml" 2>/dev/null || true)
n_master_cargo=$(grep -cE 'branches: \[master\]|refs/heads/master' "$P/.github/workflows/getff-cargo.yml" 2>/dev/null || true)
n_master_go=$(grep -cE 'branches: \[master\]|refs/heads/master' "$P/.github/workflows/getff-go.yml" 2>/dev/null || true)
n_master_py=${n_master_py:-0}
n_master_cargo=${n_master_cargo:-0}
n_master_go=${n_master_go:-0}
[ "$n_master_py" -eq 3 ] \
  && ok "(1) python delivered workflow: 3 master refs (2× branches + 1× refs/heads; pre-fix would be 0)" \
  || bad "(1) python delivered workflow: expected 3 master refs, got $n_master_py"
[ "$n_master_cargo" -eq 3 ] \
  && ok "(1) cargo delivered workflow: 3 master refs (2× branches + 1× refs/heads; pre-fix would be 0)" \
  || bad "(1) cargo delivered workflow: expected 3 master refs, got $n_master_cargo"
[ "$n_master_go" -eq 3 ] \
  && ok "(1) go delivered workflow: 3 master refs (2× branches + 1× refs/heads; pre-fix would be 0)" \
  || bad "(1) go delivered workflow: expected 3 master refs, got $n_master_go"
# Negative assertion: the delivered file must NOT carry any `main` branch refs (the template
# value). If it does, the substitution silently no-op'd — same bug as before.
if grep -qE 'branches: \[main\]|refs/heads/main' "$P/.github/workflows/getff-python.yml" 2>/dev/null; then
  bad "(1) python delivered workflow still carries [main] (substitution no-op'd — defect NOT fixed)"
else
  ok "(1) python delivered workflow: NO [main] refs remain (substitution replaced all three sites)"
fi
if grep -qE 'branches: \[main\]|refs/heads/main' "$P/.github/workflows/getff-cargo.yml" 2>/dev/null; then
  bad "(1) cargo delivered workflow still carries [main] (substitution no-op'd — defect NOT fixed)"
else
  ok "(1) cargo delivered workflow: NO [main] refs remain (substitution replaced all three sites)"
fi
if grep -qE 'branches: \[main\]|refs/heads/main' "$P/.github/workflows/getff-go.yml" 2>/dev/null; then
  bad "(1) go delivered workflow still carries [main] → installs on a master consumer and NEVER RUNS (the pre-fix go-lane shape)"
else
  ok "(1) go delivered workflow: NO [main] refs remain (substitution replaced all three sites)"
fi
rm -rf "$P"

# ── Cell (2): main-default consumer — symmetry (substitution must NOT fire) ────────────────────
echo ""; echo "  ── cell (2): main-default consumer → byte-identical to template ──"
P=$(mktemp -d)
printf '{"name":"c2-main","version":"0.0.0"}\n' > "$P/package.json"
init_consumer "$P" main
run_python_delivery "$P" >/dev/null
run_cargo_delivery  "$P" >/dev/null
run_go_delivery     "$P" >/dev/null
cmp -s "$TPL_PY" "$P/.github/workflows/getff-python.yml" \
  && ok "(2) python delivered workflow byte-identical to template (main-default → no substitution needed)" \
  || bad "(2) python delivered workflow differs from template on a main-default consumer (substitution over-fired)"
cmp -s "$TPL_CARGO" "$P/.github/workflows/getff-cargo.yml" \
  && ok "(2) cargo delivered workflow byte-identical to template (main-default → no substitution needed)" \
  || bad "(2) cargo delivered workflow differs from template on a main-default consumer (substitution over-fired)"
cmp -s "$TPL_GO" "$P/.github/workflows/getff-go.yml" \
  && ok "(2) go delivered workflow byte-identical to template (main-default → no substitution needed)" \
  || bad "(2) go delivered workflow differs from template on a main-default consumer (substitution over-fired)"
rm -rf "$P"

# ── Cell (3): no-remote consumer — PARK case (Option A: byte-identical + stderr warning) ──────
echo ""; echo "  ── cell (3): no-remote consumer → PARK Option A (byte-identical + loud stderr warning) ──"
P=$(mktemp -d)
printf '{"name":"c3-noremote","version":"0.0.0"}\n' > "$P/package.json"
# Intentionally NO `git init` — a fresh dir with no remote. This is the snapshot-fixture shape.
# Captures stderr separately so we can assert the warning text was emitted.
py_out=$(run_python_delivery "$P" 2>&1 1>/dev/null); py_rc=$?
cargo_out=$(run_cargo_delivery "$P" 2>&1 1>/dev/null); cargo_rc=$?
go_out=$(run_go_delivery "$P" 2>&1 1>/dev/null); go_rc=$?
[ "$py_rc" -eq 0 ] \
  && ok "(3) python lane exit 0 on no-remote consumer (PARK Option A: deliver byte-identical, don't refuse)" \
  || bad "(3) python lane non-zero exit on no-remote consumer (rc=$py_rc) — would be Option B (refuse); review-flippable"
[ "$cargo_rc" -eq 0 ] \
  && ok "(3) cargo lane exit 0 on no-remote consumer (PARK Option A: deliver byte-identical, don't refuse)" \
  || bad "(3) cargo lane non-zero exit on no-remote consumer (rc=$cargo_rc) — would be Option B (refuse); review-flippable"
[ "$go_rc" -eq 0 ] \
  && ok "(3) go lane exit 0 on no-remote consumer (PARK Option A: deliver byte-identical, don't refuse)" \
  || bad "(3) go lane non-zero exit on no-remote consumer (rc=$go_rc) — would be Option B (refuse); review-flippable"
cmp -s "$TPL_PY" "$P/.github/workflows/getff-python.yml" \
  && ok "(3) python delivered byte-identical to template (Option A — preserves snapshot fingerprint invariant)" \
  || bad "(3) python delivered differs from template on no-remote consumer (Option A requires byte-identical)"
cmp -s "$TPL_CARGO" "$P/.github/workflows/getff-cargo.yml" \
  && ok "(3) cargo delivered byte-identical to template (Option A — preserves snapshot fingerprint invariant)" \
  || bad "(3) cargo delivered differs from template on no-remote consumer (Option A requires byte-identical)"
# The go arm of this cell is what keeps the snapshot baselines honest: tests/install-sh/snapshot.sh
# seeds a mktemp -d fixture with NO origin remote, so the go row's fingerprint depends on this
# byte-identical guarantee holding after the copy_safe → deliver_getff_workflow swap.
cmp -s "$TPL_GO" "$P/.github/workflows/getff-go.yml" \
  && ok "(3) go delivered byte-identical to template (Option A — preserves snapshot fingerprint invariant)" \
  || bad "(3) go delivered differs from template on no-remote consumer (Option A requires byte-identical)"
# Warning text assertion (wording-secondary per T-HS-A but a useful honest-signal check).
echo "$py_out" | grep -qiE 'could not detect default branch|no origin remote' \
  && ok "(3) python lane emitted a LOUD stderr warning naming the no-remote case (NOT silent fallback)" \
  || bad "(3) python lane did NOT warn on no-remote (silent fallback = the S4 defect itself)"
echo "$cargo_out" | grep -qiE 'could not detect default branch|no origin remote' \
  && ok "(3) cargo lane emitted a LOUD stderr warning naming the no-remote case (NOT silent fallback)" \
  || bad "(3) cargo lane did NOT warn on no-remote (silent fallback = the S4 defect itself)"
echo "$go_out" | grep -qiE 'could not detect default branch|no origin remote' \
  && ok "(3) go lane emitted a LOUD stderr warning naming the no-remote case (NOT silent fallback)" \
  || bad "(3) go lane did NOT warn on no-remote (silent fallback = the S4 defect itself)"
rm -rf "$P"

# ── Cell (4): origin/HEAD unset but origin remote exists — PARK case (same as cell 3) ──────────
# A fresh clone often has `origin` configured but origin/HEAD NOT set until the user runs
# `git remote set-head`. The plan's detection (symbolic-ref origin/HEAD) fails open here too —
# verify the PARK Option A behaviour holds (byte-identical + warning).
echo ""; echo "  ── cell (4): origin exists but origin/HEAD unset → PARK Option A ──"
P=$(mktemp -d)
printf '{"name":"c4-unset-head","version":"0.0.0"}\n' > "$P/package.json"
git -C "$P" init -q
git -C "$P" config user.email "test@getff.local"
git -C "$P" config user.name "getff S4 test"
git -C "$P" remote add origin https://github.com/getff-test/consumer.git
# Intentionally NO symbolic-ref set on origin/HEAD.
git -C "$P" checkout -b trunk -q 2>/dev/null || git -C "$P" branch -m trunk 2>/dev/null || true
printf '# trunk\n' > "$P/README.md"
git -C "$P" add README.md
git -C "$P" commit -q -m "initial" 2>/dev/null || true
py_out=$(run_python_delivery "$P" 2>&1 1>/dev/null)
cmp -s "$TPL_PY" "$P/.github/workflows/getff-python.yml" \
  && ok "(4) python delivered byte-identical when origin/HEAD unset (PARK Option A held)" \
  || bad "(4) python delivered differs when origin/HEAD unset (PARK Option A broke)"
echo "$py_out" | grep -qiE 'could not detect default branch|origin/HEAD unset' \
  && ok "(4) python lane warned about origin/HEAD being unset (honest signal)" \
  || bad "(4) python lane did NOT warn about origin/HEAD unset"
rm -rf "$P"

# ── Cell (5): branch name with sed-special chars ('&') — escape regression coverage ────────────
# '&' is git-permitted in branch names ('git checkout -b release/a&b' succeeds) but
# sed-special in the replacement (means «entire match»). Without escaping, '&' in the
# detected branch corrupts the substituted YAML: 'branches: [release/abranches: [main]b]'.
# '#' is also git-permitted and would collide with the '#' delimiter in a prior draft — the
# helper now uses '~' (git-forbidden per 'git check-ref-format' rule 5) as delimiter AND
# escapes '&' via bash parameter expansion. This cell catches both regression classes.
echo ""; echo "  ── cell (5): branch with sed-special char ('&') → escape works ──"
P=$(mktemp -d)
printf '{"name":"c5-amp","version":"0.0.0"}\n' > "$P/package.json"
init_consumer "$P" "release/a&b"
run_python_delivery "$P" >/dev/null
run_cargo_delivery  "$P" >/dev/null
run_go_delivery     "$P" >/dev/null
# Expected per file: 2× 'branches: [release/a&b]' + 1× 'refs/heads/release/a&b' = 3 hits.
# Pre-fix (no escape): the '&' expands to the entire match → the delivered file contains
# 'branches: [release/abranches: [main]b]' instead, 0 literal 'release/a&b' matches.
n_amp_py=$(grep -cE 'branches: \[release/a&b\]|refs/heads/release/a&b' "$P/.github/workflows/getff-python.yml" 2>/dev/null || true)
n_amp_cargo=$(grep -cE 'branches: \[release/a&b\]|refs/heads/release/a&b' "$P/.github/workflows/getff-cargo.yml" 2>/dev/null || true)
n_amp_go=$(grep -cE 'branches: \[release/a&b\]|refs/heads/release/a&b' "$P/.github/workflows/getff-go.yml" 2>/dev/null || true)
n_amp_py=${n_amp_py:-0}
n_amp_cargo=${n_amp_cargo:-0}
n_amp_go=${n_amp_go:-0}
[ "$n_amp_py" -eq 3 ] \
  && ok "(5) python delivered workflow: 3 literal release/a&b refs (sed &-escape works)" \
  || bad "(5) python delivered workflow: expected 3 release/a&b refs, got $n_amp_py (sed &-corruption)"
[ "$n_amp_cargo" -eq 3 ] \
  && ok "(5) cargo delivered workflow: 3 literal release/a&b refs (sed &-escape works)" \
  || bad "(5) cargo delivered workflow: expected 3 release/a&b refs, got $n_amp_cargo (sed &-corruption)"
[ "$n_amp_go" -eq 3 ] \
  && ok "(5) go delivered workflow: 3 literal release/a&b refs (sed &-escape works)" \
  || bad "(5) go delivered workflow: expected 3 release/a&b refs, got $n_amp_go (sed &-corruption)"
# Negative assertion: the corruption signature is 'branches: [release/a' followed by the
# original 'branches: [main]' literal — that exact doubled-output shape is the regression.
if grep -qE 'branches: \[release/abranches' "$P/.github/workflows/getff-python.yml" 2>/dev/null; then
  bad "(5) python: sed &-corruption detected (output contains 'branches: [release/abranches')"
else
  ok "(5) python: NO sed &-corruption (escape consumed the backref)"
fi
rm -rf "$P"

# ── Cell (6): preset lane (react-spa) via real install.sh — class-sweep coverage ──────────────
# Round-1 rework MAJOR 1: the initial sweep covered 2 of 5 templates. Cell (6) proves the preset
# lane fix end-to-end via a REAL install.sh run (not just a template assertion) — the fixture
# must exercise setup.d/40-configs.sh's `deliver_getff_workflow` swap, not bypass it. Mirrors the
# `install_consumer` pattern in check-fences-fire-full-barrel.test.sh:70-76.
# Covers react-spa explicitly; preset-next-15-canonical and preset-react-native ship byte-identical
# templates at the same line numbers (5,7,11) — proven by symmetry. Also implicitly covers the
# ts-server github-actions-ci.yml swap (same shape, same line numbers).
echo ""; echo "  ── cell (6): react-spa install.sh → delivered ci.yml carries [master] ──"
P=$(mktemp -d)
printf '{"name":"c6-react-spa","version":"0.0.0"}\n' > "$P/package.json"
init_consumer "$P" master
# Real install.sh run — exercises the 40-configs.sh swap end-to-end. </dev/null so any prompt
# (e.g. companions) gets a "no" instead of hanging the test.
( cd "$P" && bash "$REPO_ROOT/install.sh" react-spa --force </dev/null ) >"$P/.install.log" 2>&1
if [ -f "$P/.github/workflows/ci.yml" ]; then
  ok "(6) react-spa install delivered .github/workflows/ci.yml"
else
  bad "(6) react-spa install did not deliver ci.yml (install log tail: $(tail -3 "$P/.install.log" | tr '\n' '|'))"
fi
# Same assertions as cell (1) — 3 master refs, 0 main refs.
n_master_spa=$(grep -cE 'branches: \[master\]|refs/heads/master' "$P/.github/workflows/ci.yml" 2>/dev/null || true)
n_master_spa=${n_master_spa:-0}
[ "$n_master_spa" -eq 3 ] \
  && ok "(6) react-spa delivered ci.yml: 3 master refs (2× branches + 1× refs/heads; pre-fix would be 0)" \
  || bad "(6) react-spa delivered ci.yml: expected 3 master refs, got $n_master_spa"
if grep -qE 'branches: \[main\]|refs/heads/main' "$P/.github/workflows/ci.yml" 2>/dev/null; then
  bad "(6) react-spa delivered ci.yml still carries [main] (40-configs.sh swap no-op'd)"
else
  ok "(6) react-spa delivered ci.yml: NO [main] refs remain (substitution replaced all three sites)"
fi
# workflow-integrity.yml also shipped via the same swap — its single `branches: [main]` on the
# push: arm must be substituted too (narrower defect, same class). Optional assertion: proves
# the swap covers both templates a preset lane delivers, not just ci.yml.
if [ -f "$P/.github/workflows/workflow-integrity.yml" ]; then
  if grep -qE 'branches: \[master\]' "$P/.github/workflows/workflow-integrity.yml" 2>/dev/null \
     && ! grep -qE 'branches: \[main\]' "$P/.github/workflows/workflow-integrity.yml" 2>/dev/null; then
    ok "(6) react-spa delivered workflow-integrity.yml: push arm substituted ([master], no [main])"
  else
    bad "(6) react-spa delivered workflow-integrity.yml: push arm NOT substituted (still [main] or no [master])"
  fi
else
  bad "(6) react-spa install did not deliver workflow-integrity.yml"
fi
rm -rf "$P"

echo ""
echo "Result: $PASS pass / $FAIL fail"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
