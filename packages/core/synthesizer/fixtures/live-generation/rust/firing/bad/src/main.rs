// RED fixture for the live-generation rust flagship (LG-S3 Inc 2).
//
// The researched convention (mem-forget.practice.json) bans `std::mem::forget` on a Drop value:
// forgetting a Drop value skips its destructor and leaks the resource it manages. This crate is the
// VIOLATION — it opens a real Drop value (`std::fs::File`) and calls the banned `std::mem::forget`
// on it. Against the GENERATED clippy.toml (disallowed-methods → std::mem::forget) `cargo clippy`
// reports `clippy::disallowed_methods` here (the AC2 RED). The clippy.toml is rendered session-side
// by render-researched-clippy.ts, never hand-authored.

fn main() {
    let f = std::fs::File::open("/tmp/lg-firing-bad").unwrap();
    std::mem::forget(f);
}
