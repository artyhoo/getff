#!/usr/bin/env bash
# demo:cargo — getff cargo honest demo (launch-preannounce-track S4, F2a).
#
# Shows a REAL `cargo clippy` blocking a planted banned call (RED arm) while a conforming
# negative control passes (GREEN arm). The load-bearing piece is the SEVERITY PROJECTION:
# the committed crate's Cargo.toml carries `[lints.clippy] disallowed_methods = "deny"`
# (rendered by write-clippy.ts). Without it the ban is only a warning and `cargo clippy`
# exits 0 over the violation (the FF7003 degrade documented in render-clippy.ts).
#
# Exit 0  = demo behaved (clean passed AND planted was blocked).
# Exit 1  = demo did NOT behave (a clippy regression, or the projection stopped gating).
# Exit 2  = cargo not on PATH (this is a developer-machine demo, not a CI gate).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRATE="$HERE/crate"

if ! command -v cargo >/dev/null 2>&1; then
  echo "demo:cargo SKIPPED — cargo not on PATH (developer-machine demo, per firing.test.ts §8)."
  exit 2
fi

echo "== getff cargo honest demo =="
echo "   severity projection: [lints.clippy] disallowed_methods = \"deny\" (Cargo.toml)"
echo

# --- Arm A: negative control (clean, conforming crate) -> clippy PASSES (exit 0) ---
echo "[arm A] negative control — conforming crate, no banned call:"
set +e
( cd "$CRATE" && cargo clippy --quiet 2>&1 )
CLEAN_RC=$?
set -e
echo "[arm A] cargo clippy exit code = $CLEAN_RC (want 0)"
echo

# --- Arm B: planted violation -> clippy BLOCKS (exit != 0) ---
echo "[arm B] planted violation — a real std::env::var call inserted into a copy:"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp -R "$CRATE/." "$WORK/"
cat > "$WORK/src/main.rs" <<'RS'
mod app_config {
    pub fn env_var(_key: &str) -> Option<String> {
        None
    }
}

fn main() {
    // PLANTED violation: direct std::env::var call, banned by the deny-projected clippy rule.
    let _leaked = std::env::var("HOME");
    let _ok = app_config::env_var("HOME");
}
RS
set +e
( cd "$WORK" && cargo clippy --quiet 2>&1 )
PLANTED_RC=$?
set -e
echo "[arm B] cargo clippy exit code = $PLANTED_RC (want != 0)"
echo

# --- Verdict ---
if [ "$CLEAN_RC" -eq 0 ] && [ "$PLANTED_RC" -ne 0 ]; then
  echo "DEMO OK — negative control passed (0); planted violation BLOCKED ($PLANTED_RC)."
  exit 0
fi
echo "DEMO FAILED — clean_rc=$CLEAN_RC (want 0), planted_rc=$PLANTED_RC (want != 0)."
exit 1
