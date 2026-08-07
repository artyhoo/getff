#!/usr/bin/env bash
# tests/install-sh/snapshot.sh — byte-identical fingerprint harness for install.sh refactor.
#
# SNAPSHOT_MODE=capture  — install into a temp fixture and save the fingerprint as the baseline.
# SNAPSHOT_MODE=compare  — install into a temp fixture and compare against the saved baseline.
#
# Usage (capture, before any refactoring):
#   SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh
#
# Usage (compare, after each code change):
#   SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
#
# Environment:
#   SNAPSHOT_MODE   capture | compare   (required)
#   BASELINE_DIR    path to baselines   (default: tests/install-sh/baselines)
#
# The fingerprint covers the INSTALLED TREE (file paths + sha256 hashes), NOT stdout.
# Per O5: section/SKIPPED order may legitimately differ across platforms; the tree diff is
# the byte-identical falsifier.
#
# Never installs into the worktree root (§4d-6). All installs go into mktemp -d fixtures.

set -euo pipefail

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
BASELINE_DIR="${BASELINE_DIR:-$REPO_ROOT/tests/install-sh/baselines}"
MODE="${SNAPSHOT_MODE:-}"

if [ -z "$MODE" ]; then
  echo "ERROR: SNAPSHOT_MODE must be set to 'capture' or 'compare'" >&2
  exit 1
fi

# compute_fingerprint <dir>
# Produces a sorted list of "hash  relative-path" lines for all files under <dir>,
# excluding .git and node_modules. Uses sha256sum or md5/md5sum for portability.
compute_fingerprint() {
  local dir="$1"
  # .getff-python-install.log carries a `date -u` timestamp header (setup.d/45-python.sh) → its bytes
  # differ every run. It is an audit trail, NOT a delivered config artefact (the layer excludes it
  # from its own (v) idempotency checksum), so it is excluded here too — else the python row would be
  # non-deterministic. No-op for npm stacks (they never write this file).
  # .getff/rules-lock.python.json carries a wall-clock `emittedAt` (setup.d/45-python.sh
  # _py_write_rules_lock) → its bytes differ every run, same as the audit log. It is a
  # machine-reproducibility record, NOT a delivered CONFIG artefact; its deterministic content
  # (ruleIds/ruffBans/sourceFingerprint) is gated by tests/install-sh/python-rules-lock.test.sh, so it
  # is excluded here too — else the python rows would be non-deterministic.
  # The cargo lane's two non-deterministic outputs are excluded for the SAME reason
  # (ecosystem-wiring W4): the timestamped .getff-cargo-install.log audit trail, and
  # rules-lock.cargo.json (its `emittedAt` is a `date -u` timestamp — a per-run reproducibility
  # record, not a delivered config; the byte-stable config artefacts, clippy.toml / deny.toml /
  # Cargo.lints.toml / getff-cargo.yml, still fingerprint; gated by cargo-entry-lane.test.sh).
  # The go lane's two non-deterministic outputs are excluded for the SAME reason (adapter-jig J3):
  # the timestamped .getff-go-install.log audit trail, and rules-lock.go.json.
  find "$dir" -type f \
    -not -path '*/.git/*' \
    -not -path '*/node_modules/*' -not -name '*.tmp' \
    -not -name '.getff-python-install.log' \
    -not -name '.getff-cargo-install.log' \
    -not -name '.getff-go-install.log' \
    -not -name 'rules-lock.cargo.json' \
    -not -name 'rules-lock.python.json' \
    -not -name 'rules-lock.go.json' \
    | sort \
    | while IFS= read -r f; do
        local h
        if command -v sha256sum >/dev/null 2>&1; then
          h=$(sha256sum "$f" | awk '{print $1}')
        elif command -v shasum >/dev/null 2>&1; then
          h=$(shasum -a 256 "$f" | awk '{print $1}')
        elif command -v md5sum >/dev/null 2>&1; then
          h=$(md5sum "$f" | awk '{print $1}')
        else
          h=$(md5 -q "$f" 2>/dev/null || echo "NOHASH")
        fi
        printf '%s  %s\n' "$h" "${f#"$dir/"}"
      done
}

# install_into_fixture <fixture_dir> <stack> <mode_label>
# Installs from the current install.sh into <fixture_dir>, seeded per <mode_label>.
# The npm stacks (ts-server/react-next/react-spa/react-native) seed npm-shaped (package.json) exactly
# as before — greenfield | brownfield — so their baselines stay byte-identical. The `python` toolchain
# lane seeds ITS OWN shape (pyproject.toml + per-collision-cell variants), NOT a package.json, because
# the python lane bypasses the package.json precondition (install.sh do_python_lane) and exercises the
# setup.d/45-python.sh augment-first collision cells that npm seeding cannot reach.
install_into_fixture() {
  local fixture="$1"
  local stack="$2"
  local mode_label="$3"

  if [ "$stack" = "python" ]; then
    _seed_python_fixture "$fixture" "$mode_label"
    # Initialize as a git repo (parity with the npm path; the python lane does not require it, and
    # .git/ is excluded from the fingerprint — harmless).
    ( cd "$fixture" && git init -q && git config user.email "test@test.com" && git config user.name "Test" ) >/dev/null 2>&1
    # Explicit `python` positional → the python toolchain lane (no package.json precondition, no prompt).
    ( cd "$fixture" && bash "$REPO_ROOT/install.sh" python --force < /dev/null ) >/dev/null 2>&1 || true
    return 0
  fi

  if [ "$stack" = "cargo" ]; then
    _seed_cargo_fixture "$fixture" "$mode_label"
    ( cd "$fixture" && git init -q && git config user.email "test@test.com" && git config user.name "Test" ) >/dev/null 2>&1
    # Explicit `cargo` positional → the Rust toolchain lane (no package.json precondition, no prompt).
    ( cd "$fixture" && bash "$REPO_ROOT/install.sh" cargo --force < /dev/null ) >/dev/null 2>&1 || true
    return 0
  fi

  if [ "$stack" = "go" ]; then
    _seed_go_fixture "$fixture" "$mode_label"
    ( cd "$fixture" && git init -q && git config user.email "test@test.com" && git config user.name "Test" ) >/dev/null 2>&1
    # Explicit `go` positional → the Go toolchain lane (adapter-jig J3; no package.json precondition, no prompt).
    ( cd "$fixture" && bash "$REPO_ROOT/install.sh" go --force < /dev/null ) >/dev/null 2>&1 || true
    return 0
  fi

  # ── npm stacks (unchanged seeding — byte-identical baselines) ──
  if [ "$mode_label" = "brownfield" ]; then
    # Pre-seed with realistic brownfield state: existing package.json + some files
    cat > "$fixture/package.json" <<'EOF'
{
  "name": "brownfield-consumer",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  }
}
EOF
    mkdir -p "$fixture/.claude"
    echo "# Existing settings" > "$fixture/.claude/settings.json"
    echo "*.log" > "$fixture/.prettierignore"
    echo "console.log('existing')" > "$fixture/index.ts"
  else
    printf '{"name":"snapshot-test","version":"0.0.0"}\n' > "$fixture/package.json"
  fi

  # Initialize as a git repo (required by install.sh for core.hooksPath)
  ( cd "$fixture" && git init -q && git config user.email "test@test.com" && git config user.name "Test" ) >/dev/null 2>&1

  # Run install into the fixture (NEVER into REPO_ROOT)
  ( cd "$fixture" && bash "$REPO_ROOT/install.sh" "$stack" --force < /dev/null ) >/dev/null 2>&1 || true
}

# _seed_python_fixture <fixture_dir> <mode_label>
# Python-lane seeding. Every variant carries a pyproject.toml (the lane's detect signal + a repo a
# real python consumer would have) and NO package.json. The brownfield variants pre-plant a consumer
# config to exercise a specific setup.d/45-python.sh collision cell deterministically:
#   greenfield          — bare pyproject.toml → fresh whole-file copies of every getff artefact (cell i).
#   brownfield-ruff     — + a consumer ruff.toml (no getff header) → ruff lane REFUSES, ships
#                         getff-ruff.toml, leaves the consumer ruff.toml untouched (cell iii).
#   brownfield-sgconfig — + a consumer block-list sgconfig.yml → ast-grep lane structurally MERGES our
#                         .getff/astgrep-rules entry into the existing ruleDirs list (cell ii).
_seed_python_fixture() {
  local fixture="$1"
  local mode_label="$2"

  cat > "$fixture/pyproject.toml" <<'EOF'
[project]
name = "brownfield-python-consumer"
version = "1.0.0"
EOF

  case "$mode_label" in
    brownfield-ruff)
      # Consumer-authored ruff.toml (no getff header) → cell (iii) REFUSE.
      cat > "$fixture/ruff.toml" <<'EOF'
line-length = 100

[lint]
select = ["E", "F"]
EOF
      ;;
    brownfield-sgconfig)
      # Consumer-authored block-list sgconfig.yml (no getff header) → cell (ii) structural merge.
      cat > "$fixture/sgconfig.yml" <<'EOF'
ruleDirs:
  - my-existing-rules
EOF
      ;;
  esac
}

# _seed_cargo_fixture <fixture_dir> <mode_label>
# Cargo-lane seeding (ecosystem-wiring W4). Every variant carries a Cargo.toml (the lane's detect
# signal + a repo a real Rust consumer would have) and NO package.json:
#   greenfield         — bare Cargo.toml → fresh whole-file copies of clippy.toml/deny.toml/getff-cargo.yml
#                        + the .getff/Cargo.lints.toml reference (cell i).
#   brownfield-clippy  — + a consumer clippy.toml (no getff header) → the clippy lane REFUSES, ships
#                        getff-clippy.toml, leaves the consumer clippy.toml untouched (cell ii).
_seed_cargo_fixture() {
  local fixture="$1"
  local mode_label="$2"

  cat > "$fixture/Cargo.toml" <<'EOF'
[package]
name = "brownfield-cargo-consumer"
version = "0.1.0"
edition = "2021"

[dependencies]
EOF

  case "$mode_label" in
    brownfield-clippy)
      # Consumer-authored clippy.toml (no getff header) → cell (ii) REFUSE.
      cat > "$fixture/clippy.toml" <<'EOF'
cognitive-complexity-threshold = 30
EOF
      ;;
  esac
}

# _seed_go_fixture <fixture_dir> <mode_label>
# Go-lane seeding (adapter-jig J3). Every variant carries a go.mod (the lane's detect signal + a
# repo a real Go consumer would have) and NO package.json/pyproject.toml/Cargo.toml:
#   greenfield            — bare go.mod → fresh whole-file copies of .golangci.yml/getff-go.yml (cell i).
#   brownfield-golangci   — + a consumer .golangci.yml (no getff header) → the golangci lane REFUSES,
#                           ships getff-golangci.yml, leaves the consumer .golangci.yml untouched (cell ii).
_seed_go_fixture() {
  local fixture="$1"
  local mode_label="$2"

  cat > "$fixture/go.mod" <<'EOF'
module example.com/brownfield-go-consumer

go 1.22
EOF

  case "$mode_label" in
    brownfield-golangci)
      # Consumer-authored .golangci.yml (no getff header) → cell (ii) REFUSE.
      cat > "$fixture/.golangci.yml" <<'EOF'
linters:
  disable-all: true
  enable:
    - errcheck
EOF
      ;;
  esac
}

# run_one_capture <stack> <mode_label>  (mode_label = greenfield | brownfield)
run_one_capture() {
  local stack="$1"
  local mode_label="$2"
  local fixture
  fixture=$(mktemp -d)
  trap 'rm -rf "$fixture"' RETURN

  echo "  Capturing $stack/$mode_label ..."
  install_into_fixture "$fixture" "$stack" "$mode_label"

  local baseline="$BASELINE_DIR/$stack/${mode_label}.fingerprint"
  mkdir -p "$(dirname "$baseline")"
  compute_fingerprint "$fixture" > "$baseline"
  echo "  ✓ $stack/$mode_label → $baseline ($(wc -l < "$baseline") files)"
}

# run_one_compare <stack> <mode_label>
run_one_compare() {
  local stack="$1"
  local mode_label="$2"
  local baseline="$BASELINE_DIR/$stack/${mode_label}.fingerprint"

  if [ ! -f "$baseline" ]; then
    echo "  ✗ MISSING BASELINE: $baseline (run SNAPSHOT_MODE=capture first)" >&2
    return 1
  fi

  local fixture
  fixture=$(mktemp -d)
  trap 'rm -rf "$fixture"' RETURN

  install_into_fixture "$fixture" "$stack" "$mode_label"

  local current
  current=$(mktemp)
  compute_fingerprint "$fixture" > "$current"

  local diff_out
  diff_out=$(diff "$baseline" "$current" || true)

  rm -f "$current"

  if [ -z "$diff_out" ]; then
    echo "  ✓ PASS: $stack/$mode_label — byte-identical"
    return 0
  else
    echo "  ✗ FAIL: $stack/$mode_label — diff:" >&2
    echo "$diff_out" >&2
    return 1
  fi
}

# The npm stacks share one seeding shape (package.json) and the {greenfield,brownfield} mode pair.
# The `python` TOOLCHAIN lane is decoupled: its own seeding (pyproject.toml) and its own mode set
# (greenfield + two collision-cell brownfield variants) — NOT a naive append to STACKS, because the
# npm modes cannot seed a pyproject / exercise the 45-python.sh augment-first cells (kickoff §2 S2).
STACKS=(ts-server react-next react-spa react-native)
MODES=(greenfield brownfield)
PYTHON_MODES=(greenfield brownfield-ruff brownfield-sgconfig)
CARGO_MODES=(greenfield brownfield-clippy)
GO_MODES=(greenfield brownfield-golangci)

OVERALL_PASS=0
OVERALL_FAIL=0

echo "▶ Snapshot harness: SNAPSHOT_MODE=$MODE"
echo ""

# Dispatch is inlined (not wrapped in a helper) on purpose: run_one_capture/run_one_compare set a
# `trap ... RETURN` on their local $fixture, and an extra wrapper function-return layer would re-fire
# that trap with $fixture out of scope (unbound under set -u). The npm stacks and the python row share
# this single dispatch shape; only the stack list + mode set differ.
for stack in "${STACKS[@]}"; do
  for mode_label in "${MODES[@]}"; do
    if [ "$MODE" = "capture" ]; then
      run_one_capture "$stack" "$mode_label"
    else
      if run_one_compare "$stack" "$mode_label"; then
        OVERALL_PASS=$((OVERALL_PASS + 1))
      else
        OVERALL_FAIL=$((OVERALL_FAIL + 1))
      fi
    fi
  done
done

# ── Python toolchain row (own seeding + collision-cell variants) ──
for mode_label in "${PYTHON_MODES[@]}"; do
  if [ "$MODE" = "capture" ]; then
    run_one_capture "python" "$mode_label"
  else
    if run_one_compare "python" "$mode_label"; then
      OVERALL_PASS=$((OVERALL_PASS + 1))
    else
      OVERALL_FAIL=$((OVERALL_FAIL + 1))
    fi
  fi
done

# ── Cargo toolchain row (ecosystem-wiring W4 — own seeding + collision-cell variant) ──
for mode_label in "${CARGO_MODES[@]}"; do
  if [ "$MODE" = "capture" ]; then
    run_one_capture "cargo" "$mode_label"
  else
    if run_one_compare "cargo" "$mode_label"; then
      OVERALL_PASS=$((OVERALL_PASS + 1))
    else
      OVERALL_FAIL=$((OVERALL_FAIL + 1))
    fi
  fi
done

# ── Go toolchain row (adapter-jig J3 — own seeding + collision-cell variant) ──
for mode_label in "${GO_MODES[@]}"; do
  if [ "$MODE" = "capture" ]; then
    run_one_capture "go" "$mode_label"
  else
    if run_one_compare "go" "$mode_label"; then
      OVERALL_PASS=$((OVERALL_PASS + 1))
    else
      OVERALL_FAIL=$((OVERALL_FAIL + 1))
    fi
  fi
done

echo ""
if [ "$MODE" = "capture" ]; then
  echo "✅ Baselines captured: 4 npm stacks × {greenfield,brownfield} + python × {greenfield,brownfield-ruff,brownfield-sgconfig} + cargo × {greenfield,brownfield-clippy} + go × {greenfield,brownfield-golangci}"
  echo "   Location: $BASELINE_DIR/"
else
  echo "Result: $OVERALL_PASS pass / $OVERALL_FAIL fail"
  [ "$OVERALL_FAIL" -eq 0 ]
fi
