// A genuinely-conforming crate: it never calls the banned std::env::var, carries no
// #[allow], and is clippy-clean — proving the rendered clippy.toml is no-false-positive
// on code that simply does not violate the convention.
fn main() {
    let sum = 2 + 2;
    println!("{sum}");
}
