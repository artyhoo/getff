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
#   --root DIR      declared installer root (default: this source repository)
#   --cell S/M      select a validated cell; repeat for multiple distinct cells
# With no --cell the full15-cell matrix is retained. Sourcing binds source metadata and defines API.
#
# The fingerprint covers the INSTALLED TREE (file paths + sha256 hashes), NOT stdout.
# Per O5: section/SKIPPED order may legitimately differ across platforms; the tree diff is
# the byte-identical falsifier.
#
# Never installs into the worktree root (§4d-6). All installs go into mktemp -d fixtures.

# Bind the import location before a caller changes cwd, using Bash's physical
# cwd rather than mutable PWD. Root validation stays after CLI parsing.
case "${BASH_SOURCE[0]}" in
  /*) _GETFF_SNAPSHOT_SOURCE_FILE="${BASH_SOURCE[0]}" ;;
  *) _GETFF_SNAPSHOT_SOURCE_FILE="$(pwd -P)/${BASH_SOURCE[0]}" ;;
esac

# Execution state lives inside snapshot_main, never at import.
_snapshot_prepare_environment() {
  # The python lane writes .mcp.json, and deepwiki lands there only when this machine lacks it at user
  # scope (lib.sh getff_deepwiki_machine_wide asks `claude mcp get deepwiki`). Pin the probe so a
  # baseline captured on a machine that has deepwiki compares equal on CI, which has no claude CLI.
  export GETFF_DEEPWIKI_MACHINE_WIDE=0
  # The install records how the project checks itself (setup.d/99-finalize.sh), and
  # check-doc-links.sh is armed only where lychee is on PATH. CI has no lychee, and a Mac with
  # Homebrew often does, so hide it: each PATH entry that holds a lychee is replaced by a copy of that
  # entry, made of symlinks, without it. Then a baseline captured on either machine compares equal.
  # The python lane's record (setup.d/45-python.sh _py_record_project_checks) is tool-truthed the same
  # way: its three check lines read «not wired: <tool> is not on PATH» exactly when ast-grep / ruff are
  # absent — and tool-decisions.md IS fingerprinted. Hide the two tools the record's own probes look
  # for (`command -v ast-grep` / `command -v ruff`, the hook's view) so a baseline captured on a
  # tool-equipped host compares equal on a bare CI runner, as lychee's does.
  SNAPSHOT_TOOL_SHADOW=$(mktemp -d "${TMPDIR:-/tmp}/snapshot-path.XXXXXX") || return 1
  trap 'rm -rf "$SNAPSHOT_TOOL_SHADOW"' EXIT
  _hermetic_path="" _n=0
  _old_ifs=$IFS; IFS=:
  for _d in $PATH; do
    _hide=""
    # literal list, NOT a space-separated variable: IFS is ":" inside this loop, so an unquoted
    # variable would not split and the hide-set would silently degrade to one bogus entry.
    for _t in lychee ast-grep ruff; do [ -e "$_d/$_t" ] && _hide=1; done
    if [ -n "$_d" ] && [ -n "$_hide" ]; then
      _n=$((_n + 1)); mkdir -p "$SNAPSHOT_TOOL_SHADOW/$_n" || return 1
      for _f in "$_d"/*; do
        case "${_f##*/}" in lychee|ast-grep|ruff) continue ;; esac
        ln -s "$_f" "$SNAPSHOT_TOOL_SHADOW/$_n/" || return 1
      done
      _d="$SNAPSHOT_TOOL_SHADOW/$_n"
    fi
    _hermetic_path="${_hermetic_path:+$_hermetic_path:}$_d"
  done
  IFS=$_old_ifs
  export PATH="$_hermetic_path"
  unset _hermetic_path _n _old_ifs _d _f

}

# compute_fingerprint <dir>
# Produces sorted "hash  relative-path" file lines and "link  path -> target"
# identities under <dir>. Links are never followed, including external/broken links.
# excluding .git and node_modules. Uses sha256sum or md5/md5sum for portability.
compute_fingerprint() (
  set -o pipefail
  local dir="$1"
  # .getff-python-install.log carries a `date -u` timestamp header (setup.d/45-python.sh) → its bytes
  # differ every run. It is an audit trail, NOT a delivered config artefact (the layer excludes it
  # from its own (v) idempotency checksum), so it is excluded here too — else the python row would be
  # non-deterministic. No-op for npm stacks (they never write this file).
  # .getff/rules-lock.python.json carries a wall-clock `emittedAt` (setup.d/45-python.sh
  # _py_write_rules_lock) → its bytes differ every run, same as the audit log. It is a
  # machine-reproducibility record, NOT a delivered CONFIG artefact; its deterministic content
  # (rules/ruffBans/sourceFingerprint) is gated by tests/install-sh/python-rules-lock.test.sh, so it
  # is excluded here too — else the python rows would be non-deterministic.
  # The cargo lane's two non-deterministic outputs are excluded for the SAME reason
  # (ecosystem-wiring W4): the timestamped .getff-cargo-install.log audit trail, and
  # rules-lock.cargo.json (its `emittedAt` is a `date -u` timestamp — a per-run reproducibility
  # record, not a delivered config; the byte-stable config artefacts, clippy.toml / deny.toml /
  # Cargo.lints.toml / getff-cargo.yml, still fingerprint; gated by cargo-entry-lane.test.sh).
  # The go lane's two non-deterministic outputs are excluded for the SAME reason (adapter-jig J3):
  # the timestamped .getff-go-install.log audit trail, and rules-lock.go.json.
  find "$dir" \( -type f -o -type l \) \
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
        local h target
        if [ -L "$f" ]; then
          # Record native entry identity without following a broken/external
          # target. Hashing resolved bytes would swallow an equal-byte swap.
          target=$(readlink "$f") || return 1
          printf 'link  %s -> %s\n' "${f#"$dir/"}" "$target" || return 1
          continue
        fi
        if command -v sha256sum >/dev/null 2>&1; then
          h=$(sha256sum "$f" | awk '{print $1}') || return 1
        elif command -v shasum >/dev/null 2>&1; then
          h=$(shasum -a 256 "$f" | awk '{print $1}') || return 1
        elif command -v md5sum >/dev/null 2>&1; then
          h=$(md5sum "$f" | awk '{print $1}') || return 1
        else
          h=$(md5 -q "$f") || return 1
        fi
        printf '%s  %s\n' "$h" "${f#"$dir/"}" || return 1
      done
)

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
    _seed_python_fixture "$fixture" "$mode_label" || return 1
    # Initialize as a git repo (parity with the npm path; the python lane does not require it, and
    # .git/ is excluded from the fingerprint — harmless).
    ( cd "$fixture" && git init -q && git config user.email "test@test.com" && git config user.name "Test" ) >/dev/null 2>&1 || return 1
    # Explicit `python` positional → the python toolchain lane (no package.json precondition, no prompt).
    ( cd "$fixture" && bash "$REPO_ROOT/install.sh" python --force < /dev/null )
    return $?
  fi

  if [ "$stack" = "cargo" ]; then
    _seed_cargo_fixture "$fixture" "$mode_label" || return 1
    ( cd "$fixture" && git init -q && git config user.email "test@test.com" && git config user.name "Test" ) >/dev/null 2>&1 || return 1
    # Explicit `cargo` positional → the Rust toolchain lane (no package.json precondition, no prompt).
    ( cd "$fixture" && bash "$REPO_ROOT/install.sh" cargo --force < /dev/null )
    return $?
  fi

  if [ "$stack" = "go" ]; then
    _seed_go_fixture "$fixture" "$mode_label" || return 1
    ( cd "$fixture" && git init -q && git config user.email "test@test.com" && git config user.name "Test" ) >/dev/null 2>&1 || return 1
    # Explicit `go` positional → the Go toolchain lane (adapter-jig J3; no package.json precondition, no prompt).
    ( cd "$fixture" && bash "$REPO_ROOT/install.sh" go --force < /dev/null )
    return $?
  fi

  # ── npm stacks (unchanged seeding — byte-identical baselines) ──
  if [ "$mode_label" = "brownfield" ]; then
    # Pre-seed with realistic brownfield state: existing package.json + some files
    cat > "$fixture/package.json" <<'EOF' || return 1
{
  "name": "brownfield-consumer",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  }
}
EOF
    mkdir -p "$fixture/.claude" || return 1
    echo "# Existing settings" > "$fixture/.claude/settings.json" || return 1
    echo "*.log" > "$fixture/.prettierignore" || return 1
    echo "console.log('existing')" > "$fixture/index.ts" || return 1
  else
    printf '{"name":"snapshot-test","version":"0.0.0"}\n' > "$fixture/package.json" || return 1
  fi

  # Initialize as a git repo (required by install.sh for core.hooksPath)
  ( cd "$fixture" && git init -q && git config user.email "test@test.com" && git config user.name "Test" ) >/dev/null 2>&1 || return 1

  # Run install into the fixture (NEVER into REPO_ROOT)
  ( cd "$fixture" && bash "$REPO_ROOT/install.sh" "$stack" --force < /dev/null )
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

  cat > "$fixture/pyproject.toml" <<'EOF' || return 1
[project]
name = "brownfield-python-consumer"
version = "1.0.0"
EOF

  case "$mode_label" in
    brownfield-ruff)
      # Consumer-authored ruff.toml (no getff header) → cell (iii) REFUSE.
      cat > "$fixture/ruff.toml" <<'EOF' || return 1
line-length = 100

[lint]
select = ["E", "F"]
EOF
      ;;
    brownfield-sgconfig)
      # Consumer-authored block-list sgconfig.yml (no getff header) → cell (ii) structural merge.
      cat > "$fixture/sgconfig.yml" <<'EOF' || return 1
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

  cat > "$fixture/Cargo.toml" <<'EOF' || return 1
[package]
name = "brownfield-cargo-consumer"
version = "0.1.0"
edition = "2021"

[dependencies]
EOF

  case "$mode_label" in
    brownfield-clippy)
      # Consumer-authored clippy.toml (no getff header) → cell (ii) REFUSE.
      cat > "$fixture/clippy.toml" <<'EOF' || return 1
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

  cat > "$fixture/go.mod" <<'EOF' || return 1
module example.com/brownfield-go-consumer

go 1.22
EOF

  case "$mode_label" in
    brownfield-golangci)
      # Consumer-authored .golangci.yml (no getff header) → cell (ii) REFUSE.
      cat > "$fixture/.golangci.yml" <<'EOF' || return 1
linters:
  disable-all: true
  enable:
    - errcheck
EOF
      ;;
  esac
}

# Each cell owns its fixture, diagnostic log and partial fingerprint. All failure checks
# are explicit: callers intentionally use these functions in conditionals (errexit is off).
_snapshot_install_checked() {
  local fixture="$1" stack="$2" mode_label="$3" log="$4" rc
  if install_into_fixture "$fixture" "$stack" "$mode_label" > "$log" 2>&1; then
    return 0
  else
    rc=$?
    echo "  ✗ INSTALL FAILED: $stack/$mode_label (exit $rc)" >&2
    cat "$log" >&2
    return "$rc"
  fi
}

# run_one_capture <stack> <mode_label>
run_one_capture() (
  local stack="$1" mode_label="$2" work fixture baseline pending=""
  baseline="$BASELINE_DIR/$stack/${mode_label}.fingerprint"
  if [ -L "$baseline" ] || { [ -e "$baseline" ] && [ ! -f "$baseline" ]; }; then
    echo "  ✗ INVALID BASELINE DESTINATION: $baseline (expected a regular file or absent path)" >&2
    return 1
  fi
  work=$(mktemp -d) || return 1
  trap 'rm -rf "$work"; [ -z "$pending" ] || rm -f "$pending"' EXIT
  fixture="$work/fixture"
  mkdir "$fixture" || return 1
  echo "  Capturing $stack/$mode_label ..."
  _snapshot_install_checked "$fixture" "$stack" "$mode_label" "$work/install.log" || return $?
  compute_fingerprint "$fixture" > "$work/current" || { echo "  ✗ FINGERPRINT FAILED: $stack/$mode_label" >&2; return 1; }
  mkdir -p "$(dirname "$baseline")" || return 1
  pending=$(mktemp "$baseline.tmp.XXXXXX") || return 1
  cat "$work/current" > "$pending" || return 1
  mv -f "$pending" "$baseline" || return 1
  pending=""
  echo "  ✓ $stack/$mode_label → $baseline ($(wc -l < "$baseline") files)"
)

# run_one_compare <stack> <mode_label>
run_one_compare() (
  local stack="$1" mode_label="$2" baseline work fixture rc
  baseline="$BASELINE_DIR/$stack/${mode_label}.fingerprint"
  [ -f "$baseline" ] || { echo "  ✗ MISSING BASELINE: $baseline (run SNAPSHOT_MODE=capture first)" >&2; return 1; }
  work=$(mktemp -d) || return 1
  trap 'rm -rf "$work"' EXIT
  fixture="$work/fixture"
  mkdir "$fixture" || return 1
  _snapshot_install_checked "$fixture" "$stack" "$mode_label" "$work/install.log" || return $?
  compute_fingerprint "$fixture" > "$work/current" || { echo "  ✗ FINGERPRINT FAILED: $stack/$mode_label" >&2; return 1; }
  if diff "$baseline" "$work/current" > "$work/diff"; then
    echo "  ✓ PASS: $stack/$mode_label — byte-identical"
    return 0
  else
    rc=$?
    echo "  ✗ FAIL: $stack/$mode_label — diff exit $rc:" >&2
    cat "$work/diff" >&2
    return 1
  fi
)

# snapshot_main [--root DIR] [--cell STACK/MODE]...
# One subshell owns options, PATH shadowing and cleanup; an import changes none of them.
snapshot_main() (
  set -euo pipefail
  local IFS=$' \t\n'
  local REPO_ROOT="" MODE="${SNAPSHOT_MODE:-}" cell seen=" " rc=0
  local -a selected=() cells=(
    ts-server/greenfield ts-server/brownfield react-next/greenfield react-next/brownfield
    react-spa/greenfield react-spa/brownfield react-native/greenfield react-native/brownfield
    python/greenfield python/brownfield-ruff python/brownfield-sgconfig
    cargo/greenfield cargo/brownfield-clippy go/greenfield go/brownfield-golangci
  )
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --root) [ "$#" -ge 2 ] && [ -n "$2" ] || { echo 'ERROR: --root requires a directory' >&2; return 2; }; REPO_ROOT="$2"; shift 2 ;;
      --cell) [ "$#" -ge 2 ] && [ -n "$2" ] || { echo 'ERROR: --cell requires STACK/MODE' >&2; return 2; }; selected+=("$2"); shift 2 ;;
      *) echo "ERROR: unknown snapshot argument: $1" >&2; return 2 ;;
    esac
  done
  if [ -z "$REPO_ROOT" ]; then
    REPO_ROOT=$(CDPATH='' cd -- "$(dirname "$_GETFF_SNAPSHOT_SOURCE_FILE")/../.." && pwd -P) || return 1
  fi
  case "$MODE" in capture|compare) ;; *) echo "ERROR: SNAPSHOT_MODE must be capture or compare" >&2; return 2 ;; esac
  [ -f "$REPO_ROOT/install.sh" ] || { echo "ERROR: missing installer: $REPO_ROOT/install.sh" >&2; return 2; }
  REPO_ROOT=$(CDPATH='' cd -- "$REPO_ROOT" && pwd -P) || return 2
  local BASELINE_DIR="${BASELINE_DIR:-$REPO_ROOT/tests/install-sh/baselines}" tool allowed
  case "$BASELINE_DIR" in /*) ;; *) BASELINE_DIR="$REPO_ROOT/$BASELINE_DIR" ;; esac
  if [ "${#selected[@]}" -eq 0 ]; then selected=("${cells[@]}"); fi
  for cell in "${selected[@]}"; do
    allowed=0
    for tool in "${cells[@]}"; do [ "$cell" != "$tool" ] || allowed=1; done
    [ "$allowed" -eq 1 ] || { echo "ERROR: unknown snapshot cell: $cell" >&2; return 2; }
    case "$seen" in *" $cell "*) echo "ERROR: repeated snapshot cell: $cell" >&2; return 2 ;; esac
    seen="$seen$cell "
  done
  for tool in bash git mktemp find sort awk dirname mkdir rm ln sed wc cat mv readlink; do
    command -v "$tool" >/dev/null 2>&1 || { echo "ERROR: missing snapshot prerequisite: $tool" >&2; return 2; }
  done
  # cwd does not override GIT_DIR/GIT_INDEX_FILE in a parent hook. Use Git's own
  # repository-local classification; keep intentional global/OS Git inputs intact.
  local git_env
  git_env=$(git rev-parse --local-env-vars) || return 2
  for tool in $git_env; do unset "$tool"; done
  if [ "$MODE" = compare ]; then
    command -v diff >/dev/null 2>&1 || { echo 'ERROR: missing snapshot prerequisite: diff' >&2; return 2; }
  fi
  command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1 || command -v md5sum >/dev/null 2>&1 || command -v md5 >/dev/null 2>&1 || { echo 'ERROR: missing fingerprint hash tool' >&2; return 2; }
  _snapshot_prepare_environment || return 1
  local OVERALL_PASS=0 OVERALL_FAIL=0
  echo "▶ Snapshot harness: SNAPSHOT_MODE=$MODE"
  for cell in "${selected[@]}"; do
    if [ "$MODE" = capture ]; then
      if run_one_capture "${cell%/*}" "${cell#*/}"; then rc=0; else rc=$?; fi
    else
      if run_one_compare "${cell%/*}" "${cell#*/}"; then rc=0; else rc=$?; fi
    fi
    if [ "$rc" -eq 0 ]; then OVERALL_PASS=$((OVERALL_PASS + 1)); else OVERALL_FAIL=$((OVERALL_FAIL + 1)); fi
  done
  echo "Result: $OVERALL_PASS pass / $OVERALL_FAIL fail"
  [ "$OVERALL_FAIL" -eq 0 ]
)

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  snapshot_main "$@"
fi
