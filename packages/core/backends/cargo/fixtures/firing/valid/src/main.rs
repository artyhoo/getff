#[allow(clippy::disallowed_methods)]
fn env_var(k: &str) -> Result<String, std::env::VarError> {
    std::env::var(k)
}

fn main() {
    let home = env_var("HOME");
    let _ = home;
}
