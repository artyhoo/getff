// Negative control for the getff cargo honest demo (launch-preannounce-track S4).
//
// This is the CLEAN state: conforming code that reads configuration through an injected
// accessor and never calls the banned `std::env::var` directly. Against the deny-projected
// clippy lint ([lints.clippy] disallowed_methods = "deny" in Cargo.toml) this crate produces
// ZERO diagnostics, so `cargo clippy` exits 0 (the demo's GREEN arm).
//
// The demo's RED arm (run-demo.sh) copies this crate to a temp dir and PLANTS a real
// `std::env::var` call into main(); that violation is then blocked (exit != 0) by the same
// deny projection. The planting happens on a copy — this committed source stays clean.

mod app_config {
    /// Injected configuration accessor — the conforming way to read config.
    pub fn env_var(_key: &str) -> Option<String> {
        None
    }
}

fn main() {
    let _home = app_config::env_var("HOME");
}
