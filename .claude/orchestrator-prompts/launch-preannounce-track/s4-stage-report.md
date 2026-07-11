# S4 — Cargo honest demo (F2a) — stage report

- **Stage:** S4 (launch-preannounce-track)
- **Branch:** `worktree-lpt-s4`
- **Base:** `origin/staging` @ `3d2fbdf2a` (fast-forwarded from `e69a0cc2f` at session start; +6 commits)
- **Toolchain:** `clippy 0.1.96 (31fca3adb2 2026-06-26)`, `cargo 1.96.1` — verified present EARLY, live-fire ran.
- **Status:** DONE — branch pushed after cold-QA.

## §0 Premise re-verification (S.0 rule)

Re-verified every S4 premise against fresh `origin/staging` (`3d2fbdf2a`) before coding. All still-broken — nothing pre-fixed:

| Premise | Verify | Result |
|---|---|---|
| No `demo:cargo` target | `grep -rn "demo:" package.json Makefile packages/core/package.json` | CONFIRMED absent (only `demo:` = README-GIF Makefile target). |
| FF7003 degrade → exit-0-over-violation | live `cargo clippy` on `fixtures/firing/invalid` | CONFIRMED: warning, `EXIT_CODE=0` over a live `std::env::var` violation. |
| No severity projection surface | `grep -rn "lints.clippy" packages/core` | CONFIRMED absent before S4. |
| cargo-deny backend 0 LOC (FF7001) | `render-clippy.ts:81-92` (`dep-graph` → FF7001 "cargo-deny [bans] (post-v0)") | CONFIRMED. |
| README pairs clippy/cargo-deny present-tense | `README.md:8` | CONFIRMED present-tense claim. |

## §1 What landed

Deliverable 1 — **clippy.toml writer + committed example crate + `demo:cargo` target**:
- `packages/core/backends/cargo/write-clippy.ts` — `writeCargoClippyToml(nodes, dir)` (the writer) + `renderClippyLints(nodes)` (severity projection).
- `packages/core/backends/cargo/demo/crate/` — committed example crate: `Cargo.toml` (carries the committed `[lints.clippy] disallowed_methods = "deny"`), `clippy.toml`, `src/main.rs` (conforming negative control), `rust-toolchain.toml` (pinned 1.96.1), `Cargo.lock`, `.gitignore`.
- `packages/core/backends/cargo/demo/run-demo.sh` — plants a real `std::env::var` call into a temp copy, fires real `cargo clippy`, asserts planted→blocked + clean→passes.
- Targets: `demo:cargo` npm script (`packages/core/package.json`) + `make demo-cargo` (root `Makefile`) — matches the repo's existing Makefile `demo` target placement.

Deliverable 2 — **severity projection** (`[lints.clippy] <lint> = "deny"`):
- `renderClippyLints` maps requested `Severity` → clippy lint level: `error`→`deny` (build-failing), `warning`→`warn`, `note`→omitted (informational, no build-level). Strongest level wins per lint name.
- Honesty boundary: the FF7003 degrade STAYS on the clippy.toml plane (clippy.toml genuinely has no severity field). The build-failing severity is projected on a SEPARATE plane — Cargo.toml `[lints.clippy]`. `render-clippy.ts` outcome semantics + the composition FF7003 truth-table are UNCHANGED (zero blast radius on `compose.test.ts`, which builds its own `DEGRADED` constant). `render-clippy.ts:130` note + `capability-matrix.json` cap updated to point at the new surface (honesty, not aspiration).

Deliverable 3 — **wording sweep**:
- `README.md:8` — "clippy/cargo-deny for cargo" → "clippy for cargo — cargo-deny dependency bans are on the roadmap". This was the ONLY present-tense our-delivery cargo-deny claim. All other `cargo-deny` mentions are roadmap/historical (prior-art-evaluations #199 "separate BFR decision", research-patch ecosystem survey, spec examples, python-backend kickoff) — left as-is; they are not present-tense delivery claims. AGENTS.md uses `cargo-clippy-toml` (the real backend), never cargo-deny.

## §2 RED → GREEN evidence (paired-negative, T15)

### Behavioural (live `cargo clippy`)

**RED — exit-0-over-violation (pre-S4 FF7003 state).** Planted `std::env::var("HOME")` in the demo crate with the `[lints.clippy]` block STRIPPED:
```text
warning: use of a disallowed method `std::env::var`
  = note: `#[warn(clippy::disallowed_methods)]` on by default
NO_PROJECTION_EXIT=0
```

**GREEN — deny projection blocks it.** Same violation, `[lints.clippy] disallowed_methods = "deny"` present:
```text
error: use of a disallowed method `std::env::var`
  = note: requested on the command line with `-D clippy::disallowed-methods`
error: could not compile `getff-cargo-demo` (bin "getff-cargo-demo") due to 1 previous error
[arm B] cargo clippy exit code = 101 (want != 0)
```

**Negative control (GREEN arm).** Committed conforming crate: `cargo clippy` → `CLEAN_EXIT=0`, zero diagnostics.

**Full demo (`make demo-cargo`):** `[arm A] exit 0` + `[arm B] exit 101` → `DEMO OK — negative control passed (0); planted violation BLOCKED (101).`

### Unit-test discrimination (observed RED)

Temporarily regressed `SEVERITY_TO_LEVEL.error: 'deny' → 'warn'` and re-ran:
```text
× W1: error severity -> deny (the case that FAILS the build; DEMO_NODE)
× W4: kind routes to the matching lint name
× W6: strongest level wins when several nodes share a lint (warn + error -> deny)
× W9: committed demo/crate/Cargo.toml carries the deny projection
Tests  4 failed | 9 passed
```
Restored → all pass. The projection tests genuinely discriminate.

## §3 Gates run

- `backends/ + composition/` vitest: **213 passed (21 files)** — incl. the new `write-clippy.test.ts` (9) + `demo/demo.test.ts` (4), live-fire arms active (cargo present, not CI).
- `tsc --noEmit`: **rc=0** (after fixing a `Severity` import path `../` → `../../`).
- `principles/`: **303 passed (33 files)**.
- `make demo-cargo`: **DEMO OK** end-to-end.

## §4 Live-fire gating (firing.test.ts pattern)

`demo/demo.test.ts` mirrors `firing.test.ts`: live arms are `describe.skipIf(!runLiveFire)` where `runLiveFire = cargoPresent && !isCI` (ubuntu CI runners ship a Rust toolchain that does not match the pinned 1.96.1 fixtures → false RED). A module-level loud `console.warn` prints on skip (never a silent green). The always-on `D4` block byte-gates the committed crate's `[lints.clippy]` deny in CI where cargo is absent — drift protection survives without cargo.

## §5 §4b self-evaluation (s17_required)

The wording sweep + wiring touched **`CLAUDE.md`? NO. `packages/core/templates/**`? NO. `.claude/skills/**`? NO.** Touched: `README.md`, `Makefile`, `packages/core/{package.json, backends/cargo/**}`. → **s17_required = false.** No §1.7-mandate paths in the diff; the PR body does not need path-grounded §1.7 sections on the S4 change alone. (Finalizer: confirm against the full squashed diff.)

## §6 Forks

- **technical-decided:** severity projection lives on a SEPARATE Cargo.toml plane (`write-clippy.ts`), NOT by mutating `render-clippy.ts`'s error→FF7003 outcome. Rationale: clippy.toml truly has no severity field — erasing FF7003 there would be dishonest, and it would blast-radius `compose.test.ts` / `capability-matrix` / R5/R5b. The projection is additive (a new surface), lowest-blast, most honest.
- **technical-decided:** `note`-severity omitted from the projection (no build-failing Cargo lint level; informational). Consistent with its clippy.toml FF7003 degrade.
- **technical-decided:** demo target shipped as BOTH `demo:cargo` npm script (natural home under `packages/core`) and `make demo-cargo` (parity with the existing Makefile `demo` target). Kickoff allows "Makefile or npm script"; shipped both for discoverability, cheap.

## §7 Observations (out of scope — not acted on)

- The demo crate's `Cargo.lock` is committed for offline/reproducible fires (mirrors `fixtures/firing/*`). `run-demo.sh` copies the crate (incl. any `target/`) to a temp dir; `target/` is git-ignored so never committed. No action needed.
- No systemic finds outside S4 scope.

## §8 Prior-art

`write-clippy.ts` extends the clippy render target with the `[lints.clippy]` severity surface — same ADOPT lineage as prior-art-evaluations.md **#199** (clippy `disallowed-*` + `clippy.toml` as the Rust render target; the row's revisit-trigger already names the `[lints]`/cargo-deny surface as in-scope-for-clippy). No new SSOT entry — same capability area (clippy as native render target). Commit carries `Prior-art: ...#199`.
