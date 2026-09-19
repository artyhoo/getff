#!/usr/bin/env bash
# setup.d/46-cargo.sh — Rust/cargo toolchain delivery layer (ecosystem-wiring W4).
#
# Ships the pre-rendered cargo lint bundle (clippy.toml bans + the [lints.clippy] deny projection
# reference + a cargo-deny starter, authored at packages/core/templates/cargo/**) into a consumer
# Rust crate with an AUGMENT-FIRST collision policy: never silently clobber a config the consumer
# already authored. This is the cargo analog of the Python lane (setup.d/45-python.sh); it delivers
# clippy.toml/deny surface + the cargo rules-lock variant (kickoff §1 W4). No new delivery channel —
# it rides the same install.sh env-var contract the Python lane established.
#
# COLLISION MATRIX (mirrors the 45-python cells, adapted to cargo's simpler file layout):
#   (i)   fresh dir (no config)          → copy whole template files (clippy.toml, deny.toml).
#   (ii)  pre-existing clippy.toml        → REFUSE-LOUDLY. A sibling clippy.toml of ours would REPLACE
#         (consumer-authored, no getff hdr) theirs entirely (clippy reads exactly one clippy.toml). Ship
#                                           our rules as getff-clippy.toml (clippy does NOT auto-discover
#                                           it — inert until they opt in) + print merge instructions.
#   (iii) pre-existing deny.toml          → REFUSE-LOUDLY, same reasoning (cargo-deny reads one deny.toml).
#                                           Ship getff-deny.toml reference copy.
#   (lints) [lints.clippy] deny surface   → NEVER auto-edit the consumer's Cargo.toml (a bad merge breaks
#                                           their build). ALWAYS deliver Cargo.lints.toml (the reference)
#                                           + print the merge-into-[lints.clippy] instructions. The CI
#                                           gate's `-D clippy::disallowed_*` flags make the bans build-
#                                           failing even without the Cargo.toml merge.
#   (rules-lock) reproducibility record   → ALWAYS write .ai-factory/synthesizer-output/rules-lock.cargo.json
#                                           (emittedAt + sourceFingerprint of the DELIVERED clippy config —
#                                           getff-clippy.toml in the REFUSE cell, never the consumer's own
#                                           file). A FUTURE rule-tests-surface reader / deps-hash suffix may
#                                           consume it (spec §6, unshipped); nothing globs it today.
#   (ci)  consumer CI workflow            → ship the pinned clippy gate as a getff-NAMESPACED
#                                           .github/workflows/getff-cargo.yml (never the consumer's ci.yml).
#                                           Fresh | idempotent-if-ours | REFUSE-LOUDLY if a non-getff file
#                                           occupies our path.
#   (v)   re-run                          → zero diff on the delivered CONFIG artefacts (idempotent).
#
# INERT-ON-NPM CONTRACT (critical): install.sh sources ALL setup.d/[0-9]*.sh unconditionally, so this
# layer MUST no-op on the default npm flow. It runs ONLY when the cargo lane is explicitly activated via
# the env-var contract GETFF_TOOLCHAIN=cargo (install.sh do_cargo_lane sets it); until then nothing sets
# it, so every npm `./setup`/`install.sh` sources this file to a pure no-op (byte-identical.test.sh stays
# green — the npm baselines never see a cargo artefact).
#
# @cc-only-rationale: sourced by the install.sh dispatcher into its shell scope (not exec'd), so it
#   reuses lib.sh helpers (copy_safe/refresh_safe) already in scope — no standalone entrypoint. The
#   augment/refuse transforms below are cargo-lane-specific, so they live here; no lib.sh helper body is
#   copy-pasted (layer-units.test.sh §4 SSOT guard).
#
# Delivery-log: every action + degrade path is printed to stdout AND appended to
#   <consumer>/.getff-cargo-install.log (a running audit trail; NOT a delivered config artefact, so it is
#   excluded from the (v) idempotency checksum + the snapshot fingerprint — the configs are byte-stable).

# ── cargo-lane delivery helpers (defined always; executed only under the activation guard) ──
# S-2: the four byte-near bodies this file used to share with 45-python.sh / 47-go.sh (log sink,
# copy-or-refresh wrapper, delivered-config resolver, CI cell, rules-lock writer) moved to lib.sh
# (_lane_log / _lane_copy_or_refresh / _lane_delivered_config_path / _lane_deliver_ci /
# _lane_write_toolchain_lock, next to the GETFF_LANES SSOT they serve). The per-lane names below
# stay as thin wrappers: they are load-bearing seams — refresh-covers-full-delivery.test.sh Check 4
# greps the _cargo_copy_or_refresh call token, cargo-entry-lane.test.sh arms 7-10 call
# _cargo_write_rules_lock directly, and 33-adapter-jig-arm-registry.ts cites
# _cargo_delivered_clippy_path by name. Only genuinely lane-specific bodies (the clippy/deny
# collision cells with cargo's own message sets, the firing self-check) remain inline.

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

# Delivery-log sink: thin alias onto lib.sh _lane_log (deliver_cargo_toolchain points
# _LANE_LOG_FILE at this lane's audit log). Kept as a named wrapper so cargo-lane call sites and
# the log-file marker (.getff-cargo-install.log — a getff_lane_installed signal) read unchanged.
_cargo_log() {
  _lane_log "$1"
}

# _cargo_copy_or_refresh <src> <dst> — FRAMEWORK-OWNED delivery, the lib.sh shared wrapper
# (install: copy_safe skip-if-exists; --refresh: refresh_safe overwrite, .override.md honoured).
# Defined here — not just called — because refresh-covers-full-delivery.test.sh Check 4 keys this
# lane's copy/refresh parity scan on this exact name.
_cargo_copy_or_refresh() {
  _lane_copy_or_refresh "$1" "$2" "${3:-}"
}

# _cargo_delivered_clippy_path — resolve which clippy config THIS lane delivered for the active cell:
# getff-owned clippy.toml (greenfield / idempotent — getff header present) → clippy.toml; REFUSE cell
# (consumer-authored clippy.toml kept, ours shipped inert) → getff-clippy.toml. Invariant (W4 rework,
# finding 1): the firing self-check proves the DELIVERED rules fire and the rules-lock fingerprints the
# DELIVERED artefact — never the consumer's own config (it lacks our bans and is not ours to attest).
_cargo_delivered_clippy_path() {
  _lane_delivered_config_path clippy.toml getff-clippy.toml
}

# _cargo_deliver_clippy — clippy.toml lane: fresh copy | idempotent-if-getff | REFUSE (consumer's own).
# ALSO always ships the Cargo.lints.toml deny-projection reference + prints the [lints.clippy] merge note.
_cargo_deliver_clippy() {
  local tpl="$1"
  local dst="$PROJECT_ROOT/clippy.toml"
  local getff_ref="$PROJECT_ROOT/getff-clippy.toml"

  # Idempotency: a clippy.toml WE already delivered (getff header) is not a consumer collision.
  if [ -e "$dst" ] && grep -q 'generated by getff' "$dst" 2>/dev/null; then
    if [ "${GETFF_TOOLCHAIN_REFRESH:-}" = "1" ]; then
      refresh_safe "$tpl/clippy.toml" "$dst"
      _cargo_log "clippy.toml → refreshed (framework-owned getff copy)"
    else
      _cargo_log "⊝ clippy.toml already delivered by getff — no-op (idempotent)"
    fi
  elif [ -e "$dst" ]; then
    # (ii) consumer-authored clippy.toml → a sibling of ours would REPLACE it (clippy reads ONE
    # clippy.toml). REFUSE: ship getff-clippy.toml (clippy does not auto-discover it) + merge note.
    _cargo_copy_or_refresh "$tpl/clippy.toml" "$getff_ref"
    _cargo_log "⚠ REFUSE clippy.toml (cell ii): a sibling clippy.toml would REPLACE your existing one entirely."
    _cargo_log "  Shipped our rules as getff-clippy.toml (clippy does NOT auto-discover it — inert until you opt in)."
    _cargo_log "  MANUAL: merge the getff disallowed-methods entries from getff-clippy.toml into your clippy.toml."
  else
    # (i) fresh: no clippy.toml → copy ours whole.
    copy_safe "$tpl/clippy.toml" "$dst"
    _cargo_log "clippy.toml → copied (fresh dir, cell i)"
  fi

  # (lints) the [lints.clippy] deny projection — ALWAYS delivered as a reference (never auto-merged into
  # the consumer's Cargo.toml). clippy.toml carries no severity, so a ban is warn-by-default (exit 0);
  # this projection makes it build-failing. The delivered getff-cargo.yml gate `-D`-promotes the lints
  # anyway, so the crate gates in CI even without the manual Cargo.toml merge.
  _cargo_copy_or_refresh "$tpl/Cargo.lints.toml" "$PROJECT_ROOT/.getff/Cargo.lints.toml"
  _cargo_log "clippy deny-projection reference → .getff/Cargo.lints.toml (getff-owned)"
  if [ -e "$PROJECT_ROOT/Cargo.toml" ] && ! grep -q '\[lints\.clippy\]' "$PROJECT_ROOT/Cargo.toml" 2>/dev/null; then
    _cargo_log "  NOTE: to make the bans build-FAILING locally, merge .getff/Cargo.lints.toml [lints.clippy] into your Cargo.toml"
    _cargo_log "  (or rely on the delivered getff-cargo.yml CI gate, which -D-promotes the getff lint families)."
  fi
}

# _cargo_deliver_deny — cargo-deny lane: fresh copy | idempotent-if-getff | REFUSE (consumer's own).
_cargo_deliver_deny() {
  local tpl="$1"
  local dst="$PROJECT_ROOT/deny.toml"
  local getff_ref="$PROJECT_ROOT/getff-deny.toml"

  if [ -e "$dst" ] && grep -q 'generated by getff' "$dst" 2>/dev/null; then
    if [ "${GETFF_TOOLCHAIN_REFRESH:-}" = "1" ]; then
      refresh_safe "$tpl/deny.toml" "$dst"
      _cargo_log "deny.toml → refreshed (framework-owned getff copy)"
    else
      _cargo_log "⊝ deny.toml already delivered by getff — no-op (idempotent)"
    fi
  elif [ -e "$dst" ]; then
    _cargo_copy_or_refresh "$tpl/deny.toml" "$getff_ref"
    _cargo_log "⚠ REFUSE deny.toml (cell iii): a sibling deny.toml would REPLACE your existing cargo-deny config."
    _cargo_log "  Shipped our starter as getff-deny.toml — merge its [bans] table into your deny.toml."
  else
    copy_safe "$tpl/deny.toml" "$dst"
    _cargo_log "deny.toml → copied (fresh dir, cell i — cargo-deny dependency-ban surface)"
  fi
}

# _cargo_deliver_ci — consumer CI workflow lane: ship the pinned clippy gate as a getff-NAMESPACED
# .github/workflows/getff-cargo.yml. Fresh | idempotent-if-ours | REFUSE-LOUDLY if a non-getff file
# occupies our path. NEVER writes to the consumer's ci.yml. Body = lib.sh _lane_deliver_ci (S-2);
# the pins in the REFUSE hints MIRROR github-actions-ci.yml (the delivered template) — keep the two
# in sync on any pin bump (ci-tool-pinning.md Rule A).
_cargo_deliver_ci() {
  _lane_deliver_ci "$1" ".github/workflows/getff-cargo.yml" \
    "CI workflow → .github/workflows/getff-cargo.yml (pinned clippy bans gate)" \
    "CI workflow → refreshed (.github/workflows/getff-cargo.yml, framework-owned)" \
    "  NOT overwriting your workflow. To wire the getff clippy gate, add a job running:" \
    "      rustup component add clippy && cargo clippy --all-targets -- -D clippy::disallowed_methods"
}

# _cargo_write_rules_lock — the cargo rules-lock variant (kickoff §1 W4). Writes
# .ai-factory/synthesizer-output/rules-lock.cargo.json — a REPRODUCIBILITY RECORD (emittedAt +
# sourceFingerprint = sha256 over the delivered clippy config per _cargo_delivered_clippy_path — the
# getff-clippy.toml reference in the REFUSE cell, never the consumer's own file — AND the
# generation-context provenance inputs the lock body reads (A2-9: the ctx manifest → `version`,
# the fragments → `rules`); separator-free concatenation, absent inputs contribute nothing). A
# FUTURE rule-tests-surface reader / deps-hash suffix may consume it (spec §6, unshipped); no
# shipped consumer reads it today. Framework-owned, refresh-overwritten.
# S-2: body = lib.sh _lane_write_toolchain_lock (schema per adapter-jig D3 lock-schema-parity —
# the F11 CORE set + per-lane extras backend/note; S1 §3 schemaVersion=2, rules REPLACES ruleIds).
# Kept as a named wrapper: cargo-entry-lane.test.sh arms (7)-(10) call it directly via the
# CARGO_LAYER_LIB_ONLY seam, and the lock `note` string below is byte-pinned there.
_cargo_write_rules_lock() {
  local clippy
  clippy=$(_cargo_delivered_clippy_path)
  _lane_write_toolchain_lock cargo "clippy config" "$clippy" "cargo-clippy-toml" \
    "getff cargo lane reproducibility record (ecosystem-wiring W4). sourceFingerprint hashes the DELIVERED clippy config (clippy.toml when getff owns it; getff-clippy.toml in the REFUSE cell) AND the generation-context provenance inputs the lock reports (A2-9). A FUTURE rule-tests-surface reader / deps-hash suffix may consume emittedAt/sourceFingerprint (spec §6, unshipped)."
}

# _cargo_firing_self_check — post-install firing PROOF (the «works» in the umbrella goal). Plants a
# violating .rs crate in an OS temp dir ONLY (mktemp -d — NEVER under the consumer's tracked tree, a
# binding STOP line), runs `cargo clippy --message-format=json` with the DELIVERED clippy config
# (per _cargo_delivered_clippy_path — getff-clippy.toml in the REFUSE cell, copied into the temp
# crate as clippy.toml so clippy discovers it; the consumer's own config is never what we attest), and
# asserts the ban FIRES (the expected diagnostic code appears — parity with backends/cargo/firing.test.ts
# parseCodesFromStdout, which reads the code regardless of warn/deny level). Then removes the temp dir.
# Tool-gated: an absent cargo → LOUD degrade printing the exact manual command (never silently green —
# attention-is-not-a-mechanism.md §1). rc=0 on every branch — a self-check must not abort the install.
_cargo_firing_self_check() {
  echo ""
  local _pass=0 _silent=0 _degraded=0 _overbroad=0
  local _clippy
  _clippy=$(_cargo_delivered_clippy_path)
  echo "▶ getff firing self-check — proving the delivered clippy config ($(basename "$_clippy")) FIRES (planted violation in an OS temp dir)"

  if command -v cargo >/dev/null 2>&1 && [ -e "$_clippy" ]; then
    local _t; _t=$(mktemp -d)
    mkdir -p "$_t/src"
    cp "$_clippy" "$_t/clippy.toml"
    printf '[package]\nname = "getff-selfcheck"\nversion = "0.0.0"\nedition = "2021"\n\n[dependencies]\n' > "$_t/Cargo.toml"
    printf 'fn main() {\n    let _ = std::env::var("HOME");\n}\n' > "$_t/src/main.rs"
    # Run FROM the temp dir so cargo writes its target/ there, NOT under the consumer tree (STOP line).
    # A2-3: the capture MUST be guarded — a plain assignment returns cargo's status, and under
    # install.sh's set -euo pipefail (self-check called unguarded) any non-zero cargo exit (clippy
    # component missing on rustup --profile minimal → 101) aborted the whole install mid-self-check:
    # no verdict lines, no refresh_baseline_flush, no completion line. Mirrors the go twin's
    # `|| _rc=$?` form (47-go.sh); rc=0 on every branch, verdict lines always print.
    local _out _rc=0
    _out=$( cd "$_t" && cargo clippy --message-format=json 2>/dev/null ) || _rc=$?
    if printf '%s' "$_out" | grep -q '"clippy::disallowed_methods"'; then
      echo "  ✓ cargo clippy fired RED on the planted violation (std::env::var disallowed-methods ban live)"
      _pass=$((_pass+1))
    else
      echo "  ✗ cargo clippy did NOT fire on a planted violation — the delivered clippy config is SILENT (delivery bug), cargo exit=$_rc"
      _silent=$((_silent+1))
    fi
    # Paired CLEAN CONTROL (adapter-jig E1): conforming code the delivered config must stay quiet on.
    # Without it an always-red config (one that flags every crate) prints the same "enforcement is
    # live" — the RED direction alone cannot discriminate a working config from a broken one.
    printf 'fn main() {\n    let _ = std::env::args();\n}\n' > "$_t/src/main.rs"
    # A2-3: same guard as the planted-violation capture above (rc=0 on every branch).
    local _out_clean _rc_clean=0
    _out_clean=$( cd "$_t" && cargo clippy --message-format=json 2>/dev/null ) || _rc_clean=$?
    if printf '%s' "$_out_clean" | grep -q '"clippy::disallowed_methods"'; then
      echo "  ✗ cargo clippy FIRED on the clean control — the delivered clippy config is OVER-BROAD (an always-red config is not enforcement; clean-control exit=$_rc_clean)"
      _overbroad=$((_overbroad+1))
    else
      echo "  ✓ cargo clippy clean control GREEN — no disallowed-methods diagnostic on conforming code (config discriminates)"
      _pass=$((_pass+1))
    fi
    rm -rf "$_t"
  else
    echo "  ⚠ cargo not on PATH (or the delivered clippy config missing) — firing NOT proven (degrade, NOT green). Verify manually from your crate root:"
    echo "      cargo clippy --message-format=json | grep clippy::disallowed_methods   # must appear on bad Rust"
    _degraded=$((_degraded+1))
  fi

  echo ""
  if [ "$_silent" -gt 0 ] || [ "$_overbroad" -gt 0 ]; then
    echo "⚠  getff self-check: $_pass ok · $_silent SILENT · $_overbroad OVER-BROAD — the delivered clippy config failed a direction (SILENT = no fire on bad input; OVER-BROAD = fired on clean input); review above before relying on it."
  elif [ "$_degraded" -gt 0 ]; then
    echo "⚠  getff self-check: $_pass proven-firing · $_degraded NOT proven (tool absent) — a skipped check is NOT green; run the manual command above to prove it."
  else
    echo "✓ getff self-check: the delivered clippy config fired RED on a planted violation and stayed GREEN on the clean control — enforcement is live."
  fi
  return 0
}

# deliver_cargo_toolchain — the cargo-lane entrypoint (called under the activation guard below).
deliver_cargo_toolchain() {
  local tpl="${CARGO_TEMPLATE_DIR:-$PKG_ROOT/packages/core/templates/cargo}"
  # S-2: the shared lib.sh _lane_log sink writes here. The FILENAME is load-bearing beyond the
  # audit trail — getff_lane_installed's marker arm reads it — so it stays per-lane.
  _LANE_LOG_FILE="$PROJECT_ROOT/.getff-cargo-install.log"

  if [ ! -d "$tpl" ]; then
    echo "  ⚠ cargo templates not found at $tpl — skipping cargo delivery" >&2
    return 0
  fi

  echo "▶ Rust/cargo toolchain (getff) — augment-first delivery"
  if [ "${DRY_RUN:-}" != "--dry-run" ]; then
    { printf '# getff cargo delivery — run at %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || echo unknown)"; } >> "$_LANE_LOG_FILE"
  fi

  _cargo_deliver_clippy "$tpl"
  _cargo_deliver_deny "$tpl"
  _cargo_deliver_ci "$tpl"
  _cargo_write_rules_lock

  # adapter-jig C4 (no-orphan-residue): on a refresh pass, loudly report getff-header-marked
  # top-level files the CURRENT template set no longer delivers (lib.sh report_getff_orphans;
  # expected path list = lib.sh getff_lane_expected, the SINGLE source shared with the union
  # this call performs over every OTHER lane installed in the tree).
  # Report-only — J2 decisions log #8; parity with the python lane.
  if [ "${GETFF_TOOLCHAIN_REFRESH:-}" = "1" ]; then
    report_getff_orphans cargo
  fi

  echo "  ✓ Rust/cargo toolchain delivery complete (see .getff-cargo-install.log for the audit trail)."
}

# ── Test seam: define the functions above but skip the auto-delivery (tests drive per-fixture) ──
if [ "${CARGO_LAYER_LIB_ONLY:-}" = "1" ]; then
  return 0 2>/dev/null || true
fi

# ── Activation guard: INERT unless the cargo lane is explicitly selected (do_cargo_lane sets it) ──
if [ "${GETFF_TOOLCHAIN:-}" = "cargo" ]; then
  deliver_cargo_toolchain
fi
