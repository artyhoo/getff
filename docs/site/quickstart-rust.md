---
title: Quick start for Rust
description: Install getff into a Cargo project and watch clippy refuse a banned call in your own code.
kind: face-page
sources:
  - docs/site/face-facts.json
  - docs/site/installation.md
  - docs/site/quickstart-go.md
  - docs/site/quickstart-python.md
  - docs/site/quickstart-ts.md
  - docs/site/terms.md
  - packages/core/manifest/maturity.json
  - packages/core/templates/cargo/github-actions-ci.yml
  - packages/core/templates/shared/first-steps.source.json
  - setup.d/46-cargo.sh
executed:
  - { step: install, stack: cargo, date: 2026-09-21, result: exit-0, versions: "clippy 0.1.98" }
  - { step: fire-on-your-code, stack: cargo, date: 2026-09-21, result: "warning exit-0 with plain clippy; RED exit-101 with the gate command" }
next: installation.md
---

# Quick start for Rust

Other stacks: [TypeScript and React](quickstart-ts.md) · [Python](quickstart-python.md) · [Go](quickstart-go.md)

You will install getff into a Cargo project, add one banned call to your own code, and
watch clippy refuse it. Along the way you will see something Rust-specific that is easy
to miss: a ban that only warns does not protect anything. This page shows the command
that makes it fail.

Rust is a [lane](terms.md#lane): getff uses `cargo clippy`, which you already have, and
installs nothing from npm into your project.

<!-- getff:begin section=face-maturity-cargo plan=scripts/render-face-facts.mjs -->
| Stack | Status | What to know |
|---|---|---|
| `cargo` | alpha | cargo-deny ships as a starter config no workflow runs; the clippy bans are the enforced lane (CI-failing when violated). |
<!-- getff:end section=face-maturity-cargo -->

You need a project with a `Cargo.toml` and the clippy component
(`rustup component add clippy`). The installer also looks for `bash`, `git`, `python3`,
and `curl`. It warns about a missing one and carries on, so read its first lines.

## 1. Install

```bash
git clone https://github.com/artyhoo/getff /tmp/rt
cd /your/project
bash /tmp/rt/setup -y cargo
```

The installer writes four things: `clippy.toml` with the bans, `deny.toml` as a starter
for dependency bans, a CI workflow, and a note in `.getff/` that you will use in step 3. It also leaves an
`.ai-factory/` folder and an install log.
Then it tests itself in a temporary folder:

```text
▶ getff firing self-check — proving the delivered clippy config (clippy.toml) FIRES (planted violation in an OS temp dir)
  ✓ cargo clippy fired RED on the planted violation (std::env::var disallowed-methods ban live)
  ✓ cargo clippy clean control GREEN — no disallowed-methods diagnostic on conforming code (config discriminates)

✓ getff self-check: the delivered clippy config fired RED on a planted violation and stayed GREEN on the clean control — enforcement is live.
```

It never edits your `Cargo.toml`. A bad merge there would break your build, so that step
is left to you.

## 2. Fire a rule on your own code

The shipped [rule](terms.md#rule) bans reading environment variables directly. The
[convention](terms.md#convention) behind it: configuration comes in through one place,
so you can test the code and see what it depends on. Add a direct read to `src/main.rs`:

```rust
fn main() {
    let home = std::env::var("HOME").unwrap_or_default();
    println!("hello from {home}");
}
```

Run clippy the way you normally do:

```bash
cargo clippy
```

Our example crate is named `rs-qs`. Clippy first prints a `Checking` line with the full
folder path. That one line is left out. The rest is as printed:

```text
warning: use of a disallowed method `std::env::var`
 --> src/main.rs:2:16
  |
2 |     let home = std::env::var("HOME").unwrap_or_default();
  |                ^^^^^^^^^^^^^
  |
  = note: Read configuration through the injected config accessor, never std::env::var directly
  = help: for further information visit https://rust-lang.github.io/rust-clippy/rust-1.98.0/index.html#disallowed_methods
  = note: `#[warn(clippy::disallowed_methods)]` on by default

warning: `rs-qs` (bin "rs-qs") generated 1 warning
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.14s
```

Clippy saw the call and named your file. But look at the first word: `warning`, and at
the note `#[warn(…)] on by default`. The command exits with code 0. A warning stops nothing. An agent can write this line, run
clippy, and move on.

This is how clippy works, not a getff bug. `clippy.toml` can list banned calls. It
cannot say how severe a ban is.

## 3. Make it fail

Run clippy with the ban promoted to an error. This is the [gate](terms.md#gate), and it
is the exact command the installed CI workflow runs:

```bash
cargo clippy --all-targets -- -D clippy::disallowed_methods -D clippy::disallowed_types -D clippy::disallowed_macros
```

Again the `Checking` line is left out, and the rest is as printed:

```text
error: use of a disallowed method `std::env::var`
 --> src/main.rs:2:16
  |
2 |     let home = std::env::var("HOME").unwrap_or_default();
  |                ^^^^^^^^^^^^^
  |
  = note: Read configuration through the injected config accessor, never std::env::var directly
  = help: for further information visit https://rust-lang.github.io/rust-clippy/rust-1.98.0/index.html#disallowed_methods
  = note: requested on the command line with `-D clippy::disallowed-methods`

error: could not compile `rs-qs` (bin "rs-qs") due to 1 previous error
warning: build failed, waiting for other jobs to finish...
error: could not compile `rs-qs` (bin "rs-qs" test) due to 1 previous error
```

The error shows twice because `--all-targets` also builds the test target.

Now the command exits with code 101, and it is [red](terms.md#red-and-green). A pull
request with this line fails in CI.

To get the same result from a plain `cargo clippy` on your machine, copy the
`[lints.clippy]` table from `.getff/Cargo.lints.toml` into your `Cargo.toml`. After
that, the ban is an error everywhere.

## What this did not prove

- **Locally, the ban only warns until you do step 3.** Out of the box, the hard stop is
  in CI. On your machine it is a warning.
- **The rule pack is one ban today.** It covers direct environment reads. More rules,
  and rules compiled from your own conventions, are not shipped for Rust yet.
- **`deny.toml` is a starter file.** No workflow runs `cargo deny`. It does nothing
  until you wire it yourself.
- **The CI workflow assumes a branch name.** With no git remote, the installer writes
  `main` into the workflow and prints a warning.

Next: [Installation](installation.md) covers every install path and what each one
writes.
