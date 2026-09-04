// CLEAN fixture for the live-generation rust flagship (LG-S3 Inc 2).
//
// Conforming code: it opens the SAME Drop value (`std::fs::File`) but drops it explicitly with
// `drop(f)` instead of forgetting it, so the destructor runs and the resource is released. It never
// calls the banned `std::mem::forget`. Against the SAME GENERATED clippy.toml this crate produces
// ZERO clippy diagnostics — proving the ban is silent on conforming code (the AC2 CLEAN arm, the
// #977 valid-clean rationale).

fn main() {
    let f = std::fs::File::open("/tmp/lg-firing-good").unwrap();
    drop(f);
}
