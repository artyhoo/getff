#!/usr/bin/env bash
# setup.d/47-go.sh — Go toolchain delivery layer (adapter-jig J3).
#
# Ships the pre-rendered golangci-lint bundle (.golangci.yml authored at
# packages/core/templates/go/.golangci.yml) into a consumer Go module with an AUGMENT-FIRST
# collision policy: never silently clobber a config the consumer already authored. This is the
# go analog of the cargo lane (setup.d/46-cargo.sh); it delivers the golangci-lint ban surface
# + the go rules-lock variant (kickoff §1 W4 → J3). No new delivery channel — it rides the same
# install.sh env-var contract the Python/cargo lanes established.
#
# COLLISION MATRIX (mirrors the 46-cargo cells, adapted to go's single-file layout):
#   (i)   fresh dir (no .golangci.yml)      → copy whole template file.
#   (ii)  pre-existing .golangci.yml         → REFUSE-LOUDLY. A sibling .golangci.yml of ours
#         (consumer-authored, no getff hdr)  would REPLACE theirs entirely (golangci-lint reads
#                                           exactly one .golangci.yml at the repo root). Ship our
#                                           rules as getff-golangci.yml (golangci-lint does NOT
#                                           auto-discover it — inert until they opt in) + print
#                                           merge instructions.
#   (rules-lock) reproducibility record      → ALWAYS write .ai-factory/synthesizer-output/rules-lock.go.json
#                                           (emittedAt + sourceFingerprint of the DELIVERED
#                                           golangci config — getff-golangci.yml in the REFUSE
#                                           cell, never the consumer's own file).
#   (ci)  consumer CI workflow               → ship the pinned golangci-lint gate as a
#                                           getff-NAMESPACED .github/workflows/getff-go.yml
#                                           (never the consumer's ci.yml).
#                                           Fresh | idempotent-if-ours | REFUSE-LOUDLY if a
#                                           non-getff file occupies our path.
#   (v)   re-run                             → zero diff on the delivered CONFIG artefacts (idempotent).
#
# INERT-ON-NPM CONTRACT (critical): install.sh sources ALL setup.d/[0-9]*.sh unconditionally, so
# this layer MUST no-op on the default npm flow. It runs ONLY when the go lane is explicitly
# activated via the env-var contract GETFF_TOOLCHAIN=go (install.sh do_go_lane sets it); until
# then nothing sets it, so every npm `./setup`/`install.sh` sources this file to a pure no-op
# (byte-identical.test.sh stays green — the npm baselines never see a go artefact).
#
# @cc-only-rationale: sourced by the install.sh dispatcher into its shell scope (not exec'd), so
#   it reuses lib.sh helpers (copy_safe/refresh_safe) already in scope — no standalone entrypoint.
#   The augment/refuse transforms below are go-lane-specific, so they live here; no lib.sh helper
#   body is copy-pasted (layer-units.test.sh §4 SSOT guard).
#
# Delivery-log: every action + degrade path is printed to stdout AND appended to
#   <consumer>/.getff-go-install.log (a running audit trail; NOT a delivered config artefact, so
#   it is excluded from the (v) idempotency checksum + the snapshot fingerprint — the configs are
#   byte-stable).

# ── go-lane delivery helpers (defined always; executed only under the activation guard) ──
# S-2: the byte-near bodies this file used to share with 45-python.sh / 46-cargo.sh (log sink,
# copy-or-refresh wrapper, delivered-config resolver, CI cell, rules-lock writer) moved to lib.sh
# (_lane_log / _lane_copy_or_refresh / _lane_delivered_config_path / _lane_deliver_ci /
# _lane_write_toolchain_lock). The per-lane names below stay as thin wrappers — they are
# load-bearing seams (refresh-covers-full-delivery.test.sh Check 4 greps the
# _go_copy_or_refresh call token; go-entry-lane.test.sh arms 6-10 call deliver_go_toolchain and
# _go_write_rules_lock via the GO_LAYER_LIB_ONLY seam). Only genuinely lane-specific bodies (the
# .golangci.yml collision cell with go's own message set, the firing self-check with its
# dual-tool gate) remain inline.

# ── lib.sh dependency (S-2 follow-up) ── The wrappers below delegate to bodies that live in
# lib.sh. install.sh sources lib.sh before any lane layer (install.sh:61), so on the delivery path
# this guard never fires. It exists for the *_LAYER_LIB_ONLY test seam at the foot of this file,
# which sources the layer ALONE: before S-2 these bodies were inline and resolved under that seam;
# after S-2 they do not, so pull lib.sh in on demand. Guarded on a helper name, never unconditional
# — lib.sh resets accumulator arrays at top level (REFRESH_BASELINE_STAGED, lib.sh:267), so
# re-sourcing it on the delivery path would drop already-staged refresh-baseline state.
if ! declare -F _lane_log >/dev/null 2>&1; then
  # shellcheck source=setup.d/lib.sh
  . "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
fi

# Delivery-log sink: thin alias onto lib.sh _lane_log (deliver_go_toolchain points _LANE_LOG_FILE
# at this lane's audit log). The marker filename (.getff-go-install.log — a getff_lane_installed
# signal) stays per-lane.
_go_log() {
  _lane_log "$1"
}

# _go_copy_or_refresh <src> <dst> — FRAMEWORK-OWNED delivery, the lib.sh shared wrapper (install:
# copy_safe skip-if-exists; --refresh: refresh_safe overwrite, .override.md honoured). Defined
# here — not just called — because refresh-covers-full-delivery.test.sh Check 4 keys this lane's
# copy/refresh parity scan on this exact name.
_go_copy_or_refresh() {
  _lane_copy_or_refresh "$1" "$2" "${3:-}"
}

# _go_delivered_golangci_path — resolve which golangci-lint config THIS lane delivered for the
# active cell: getff-owned .golangci.yml (greenfield / idempotent — getff header present) →
# .golangci.yml; REFUSE cell (consumer-authored .golangci.yml kept, ours shipped inert) →
# getff-golangci.yml. Invariant (adapter-jig E2, the W4 cargo finding-1 class): the firing
# self-check proves the DELIVERED rules fire and the rules-lock fingerprints the DELIVERED
# artefact — never the consumer's own config (it lacks our bans and is not ours to attest).
_go_delivered_golangci_path() {
  _lane_delivered_config_path .golangci.yml getff-golangci.yml
}

# _go_deliver_golangci — .golangci.yml lane: fresh copy | idempotent-if-getff | REFUSE (consumer's own).
_go_deliver_golangci() {
  local tpl="$1"
  local dst="$PROJECT_ROOT/.golangci.yml"
  local getff_ref="$PROJECT_ROOT/getff-golangci.yml"

  # Idempotency: a .golangci.yml WE already delivered (getff header) is not a consumer collision.
  if [ -e "$dst" ] && grep -q 'generated by getff' "$dst" 2>/dev/null; then
    if [ "${GETFF_TOOLCHAIN_REFRESH:-}" = "1" ]; then
      refresh_safe "$tpl/.golangci.yml" "$dst"
      _go_log ".golangci.yml → refreshed (framework-owned getff copy)"
    else
      _go_log "⊝ .golangci.yml already delivered by getff — no-op (idempotent)"
    fi
  elif [ -e "$dst" ]; then
    # (ii) consumer-authored .golangci.yml → a sibling of ours would REPLACE it (golangci-lint
    # reads ONE .golangci.yml). REFUSE: ship getff-golangci.yml (golangci-lint does not
    # auto-discover it) + merge note.
    _go_copy_or_refresh "$tpl/.golangci.yml" "$getff_ref"
    _go_log "⚠ REFUSE .golangci.yml (cell ii): a sibling .golangci.yml would REPLACE your existing one entirely."
    _go_log "  Shipped our rules as getff-golangci.yml (golangci-lint does NOT auto-discover it — inert until you opt in)."
    _go_log "  MANUAL: merge the getff forbidigo entries from getff-golangci.yml into your .golangci.yml, OR run:"
    _go_log "    golangci-lint run --enable forbidigo --config getff-golangci.yml ./..."
  else
    # (i) fresh: no .golangci.yml → copy ours whole.
    copy_safe "$tpl/.golangci.yml" "$dst"
    _go_log ".golangci.yml → copied (fresh dir, cell i)"
  fi
}

# _go_deliver_ci — .github/workflows/getff-go.yml lane: fresh copy | idempotent-if-getff |
# REFUSE-LOUDLY (consumer's own). NEVER writes to the consumer's ci.yml — a pre-existing
# consumer CI workflow is not clobbered. Body = lib.sh _lane_deliver_ci (S-2); the pins in the
# REFUSE hints MIRROR github-actions-ci.yml (the delivered template) — keep the two in sync on
# any pin bump (both bump together per ci-tool-pinning.md Rule A + F10 two-surface pin parity).
_go_deliver_ci() {
  _lane_deliver_ci "$1" ".github/workflows/getff-go.yml" \
    "CI workflow → .github/workflows/getff-go.yml (pinned golangci-lint bans gate)" \
    "CI workflow → refreshed (.github/workflows/getff-go.yml, framework-owned pins)" \
    "  NOT overwriting your workflow. To wire the getff Go gates, add a job running:" \
    "      go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.55.2" \
    "      golangci-lint run --enable forbidigo --config .golangci.yml ./...    # your config"
}

# _go_write_rules_lock — the go rules-lock variant (kickoff §1 W4 → J3). Writes
# .ai-factory/synthesizer-output/rules-lock.go.json — a REPRODUCIBILITY RECORD (emittedAt +
# sourceFingerprint = sha256 over the delivered golangci config per _go_delivered_golangci_path —
# the getff-golangci.yml reference in the REFUSE cell, never the consumer's own file — AND the
# generation-context provenance inputs the lock body reads (A2-9: the ctx manifest → `version`,
# the fragments → `rules`); separator-free concatenation, absent inputs contribute nothing). A
# FUTURE rule-tests-surface reader / deps-hash suffix may consume it (spec §6, unshipped); no
# shipped consumer reads it today. Framework-owned, refresh-overwritten.
# S-2: body = lib.sh _lane_write_toolchain_lock (schema per adapter-jig D3 lock-schema-parity —
# the F11 CORE set + per-lane extras backend/note; S1 §3 schemaVersion=2, rules REPLACES ruleIds).
# Kept as a named wrapper: go-entry-lane.test.sh arms (10a-f) fingerprint it via the
# GO_LAYER_LIB_ONLY seam, and the lock `note` string below is byte-pinned there.
_go_write_rules_lock() {
  local cfg
  cfg=$(_go_delivered_golangci_path)
  _lane_write_toolchain_lock go "golangci config" "$cfg" "go-golangci-lint" \
    "getff go lane reproducibility record (adapter-jig J3). sourceFingerprint hashes the DELIVERED golangci config (.golangci.yml when getff owns it; getff-golangci.yml in the REFUSE cell) AND the generation-context provenance inputs the lock reports (A2-9). A FUTURE rule-tests-surface reader / deps-hash suffix may consume emittedAt/sourceFingerprint (spec §6, unshipped)."
}

# _go_firing_self_check — post-install firing PROOF (the «works» in the umbrella goal). Plants a
# violating .go file in an OS temp dir ONLY (mktemp -d — NEVER under the consumer's tracked tree,
# a binding STOP line), runs `golangci-lint run` with the DELIVERED config (per
# _go_delivered_golangci_path — getff-golangci.yml in the REFUSE cell, copied into the temp
# module as .golangci.yml so golangci-lint discovers it; the consumer's own config is never what
# we attest), and asserts the ban FIRES (the forbidigo diagnostic appears). Then removes the temp
# dir. Tool-gated: an absent go/golangci-lint → LOUD degrade printing the exact manual command
# (never silently green — attention-is-not-a-mechanism.md §1). rc=0 on every branch — a self-check
# must not abort the install.
#
# §1.3 LOAD-BEARING REPORTING LABEL (kickoff): when go/golangci-lint is absent on the host running
# `install.sh go`, the self-check prints "insufficient (tool absent)" — that is the honest label
# for a local run; it does NOT let the stage finish. The stage finishes when the runner arm
# (audit-self.yml go lane, F10 pin-parity mirror) is green and linked (T-EW-C posture).
# _go_dump_lint_output — print a captured golangci-lint run verbatim (indented) so a FAILED
# direction carries its own evidence into the log. Without it the self-check emitted a verdict
# («OVER-BROAD») with no trace of what actually fired, leaving «re-run the tool by hand» as the
# only diagnosis channel — a verdict nobody can act on from the log is not a mechanism
# (attention-is-not-a-mechanism.md §1). Incident 2026-08-06: CI run 31093381580 reported
# «1 ok · 0 SILENT · 1 OVER-BROAD» and the log carried zero golangci-lint output to root-cause it.
_go_dump_lint_output() {
  local _label="$1" _rc="$2" _text="$3"
  echo "    ↳ $_label: golangci-lint exit=$_rc, output verbatim:"
  if [ -n "$_text" ]; then
    printf '%s\n' "$_text" | sed 's/^/      | /'
  else
    echo "      | (no output)"
  fi
}

_go_firing_self_check() {
  echo ""
  local _pass=0 _silent=0 _degraded=0 _overbroad=0
  local _cfg
  _cfg=$(_go_delivered_golangci_path)
  echo "▶ getff firing self-check — proving the delivered golangci config ($(basename "$_cfg")) FIRES (planted violation in an OS temp dir)"

  # Both go AND golangci-lint must be on PATH. go alone is insufficient (golangci-lint is a
  # separate binary not bundled with the toolchain — divergence from the cargo lane where clippy
  # is a rustup component of the consumer's own rustc).
  if command -v golangci-lint >/dev/null 2>&1 && command -v go >/dev/null 2>&1 && [ -e "$_cfg" ]; then
    local _t; _t=$(mktemp -d)
    mkdir -p "$_t/selfcheck"
    # Copy the DELIVERED config into the temp module so golangci-lint auto-discovers it
    # (parity with cargo's clippy.toml copy into the temp crate).
    cp "$_cfg" "$_t/.golangci.yml"
    printf 'module getff-selfcheck\n\ngo 1.22\n' > "$_t/go.mod"
    # Planted violation: os.Getenv direct call — the exact pattern forbidigo bans.
    printf 'package selfcheck\n\nimport "os"\n\nfunc ConfigDirect() string {\n\treturn os.Getenv("HOME")\n}\n' > "$_t/selfcheck/violation.go"
    # Paired CLEAN CONTROL (adapter-jig E1): conforming code the delivered config must stay
    # quiet on. Without it an always-red config prints the same "enforcement is live" — the
    # RED direction alone cannot discriminate a working config from a broken one.
    printf 'package selfcheck\n\nimport "os"\n\nfunc Args() []string {\n\treturn os.Args\n}\n' > "$_t/selfcheck/clean.go"
    local _out _rc=0
    _out=$( cd "$_t" && golangci-lint run --enable forbidigo ./... 2>&1 ) || _rc=$?
    if [ "$_rc" -ne 0 ] && printf '%s' "$_out" | grep -qi 'forbidigo\|os\.Getenv'; then
      echo "  ✓ golangci-lint fired RED on the planted violation (forbidigo os.Getenv ban live)"
      _pass=$((_pass+1))
    else
      echo "  ✗ golangci-lint did NOT fire on the planted violation — the delivered config is SILENT (delivery bug)"
      _go_dump_lint_output "planted-violation run" "$_rc" "$_out"
      _silent=$((_silent+1))
    fi
    # Clean control: the delivered config must NOT flag os.Args (only os.Getenv is banned).
    local _out_clean _rc_clean=0
    _out_clean=$( cd "$_t" && rm -f "$_t/selfcheck/violation.go" && golangci-lint run --enable forbidigo ./... 2>&1 ) || _rc_clean=$?
    if [ "$_rc_clean" -eq 0 ]; then
      echo "  ✓ golangci-lint clean control GREEN — no diagnostic on conforming code (config discriminates)"
      _pass=$((_pass+1))
    else
      echo "  ✗ golangci-lint FIRED on the clean control — the delivered config is OVER-BROAD (an always-red config is not enforcement)"
      _go_dump_lint_output "clean-control run" "$_rc_clean" "$_out_clean"
      # The .go files golangci-lint actually saw on this run. Discriminates the two failure
      # classes the exit code alone cannot: a genuinely over-broad pattern (fires on clean.go)
      # vs. a stale/leftover violation.go still in the module (the rm did not take effect).
      echo "    ↳ .go files present in the temp module at clean-control time:"
      ( cd "$_t" && find . -name '*.go' -print ) 2>&1 | sed 's/^/      | /'
      _overbroad=$((_overbroad+1))
    fi
    rm -rf "$_t"
  else
    echo "  ⚠ go or golangci-lint not on PATH (or the delivered config missing) — firing NOT proven (degrade, NOT green)."
    echo "    Per kickoff §1.3, the local label is «insufficient (tool absent)» — the stage is NOT done."
    echo "    Verify manually from your module root:"
    echo "      go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.55.2"
    echo "      golangci-lint run --enable forbidigo --config .golangci.yml ./...    # must exit non-zero on os.Getenv"
    _degraded=$((_degraded+1))
  fi

  echo ""
  if [ "$_silent" -gt 0 ] || [ "$_overbroad" -gt 0 ]; then
    echo "⚠  getff self-check: $_pass ok · $_silent SILENT · $_overbroad OVER-BROAD — the delivered golangci config failed a direction (SILENT = no fire on bad input; OVER-BROAD = fired on clean input); review above before relying on it."
  elif [ "$_degraded" -gt 0 ]; then
    echo "⚠  getff self-check: $_pass proven-firing · $_degraded NOT proven (tool absent) — a skipped check is NOT green; run the manual command(s) above to prove it."
  else
    echo "✓ getff self-check: the delivered golangci config fired RED on a planted violation and stayed GREEN on the clean control — enforcement is live."
  fi
  return 0
}

# deliver_go_toolchain — the go-lane entrypoint (called under the activation guard below).
deliver_go_toolchain() {
  local tpl="${GO_TEMPLATE_DIR:-$PKG_ROOT/packages/core/templates/go}"
  # S-2: the shared lib.sh _lane_log sink writes here. The FILENAME is load-bearing beyond the
  # audit trail — getff_lane_installed's marker arm reads it — so it stays per-lane.
  _LANE_LOG_FILE="$PROJECT_ROOT/.getff-go-install.log"

  if [ ! -d "$tpl" ]; then
    echo "  ⚠ go templates not found at $tpl — skipping go delivery" >&2
    return 0
  fi

  echo "▶ Go toolchain (getff) — augment-first delivery"
  if [ "${DRY_RUN:-}" != "--dry-run" ]; then
    { printf '# getff go delivery — run at %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || echo unknown)"; } >> "$_LANE_LOG_FILE"
  fi

  _go_deliver_golangci "$tpl"
  _go_deliver_ci "$tpl"
  _go_write_rules_lock

  # adapter-jig C4 (no-orphan-residue): on a refresh pass, loudly report getff-header-marked
  # top-level files the CURRENT template set no longer delivers (lib.sh report_getff_orphans;
  # expected path list = lib.sh getff_lane_expected, the SINGLE source shared with the union
  # this call performs over every OTHER lane installed in the tree).
  # Report-only — J2 decisions log #8; parity with the cargo lane.
  if [ "${GETFF_TOOLCHAIN_REFRESH:-}" = "1" ]; then
    report_getff_orphans go
  fi

  echo "  ✓ Go toolchain delivery complete (see .getff-go-install.log for the audit trail)."
}

# ── Test seam: define the functions above but skip the auto-delivery (tests drive per-fixture) ──
if [ "${GO_LAYER_LIB_ONLY:-}" = "1" ]; then
  return 0 2>/dev/null || true
fi

# ── Activation guard: INERT unless the go lane is explicitly selected (do_go_lane sets it) ──
if [ "${GETFF_TOOLCHAIN:-}" = "go" ]; then
  deliver_go_toolchain
fi
