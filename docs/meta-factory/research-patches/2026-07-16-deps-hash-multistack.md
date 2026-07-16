<!-- scope:deps-hash-multistack -->
# deps-hash multistack — R-phase research-patch

> **Scope:** the gap «the `deps-hash-check` staleness hook covers only the JS lane; extend it to detect dependency drift in python (`pyproject.toml`) and rust (`Cargo.toml`) consumers too, so the staleness nudge covers all three live-generation stacks». Folder-authority: [research-patches/](.) (scope-bound by gap). NOT authoritative for project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Status:** LANDED on `feat/deps-hash-multistack-research` as the R-phase feeding a `deps-hash-multistack` umbrella kickoff. Decides nothing strategic — the one OWNER-FORK (one-hook-vs-three, §Architecture) is recorded with a recommendation but is the kickoff's first decision gate, not closed here.
> **Method:** two parallel subagent research sweeps (deps-surface map + node-free TOML-parsing path), each citing authoritative specs (PEP 621/680/735, Cargo Book, npm docs) with WebSearch; plus a live re-read of the existing hook (`packages/core/hooks/deps-hash-check.sh`) and the python delivery lane (`install.sh`, `setup.d/45-python.sh`) to confirm the node-free constraint is real, not hypothetical. Every `file:line` re-confirmed against `origin/staging`. `ai-laziness-traps` T3/T11/T12 honored (no prose-only load-bearing claim).
> **Date:** 2026-07-16.

---

## §0 Ground truth — what the hook is and why it is JS-only today

The consumer-facing UserPromptSubmit hook `packages/core/hooks/deps-hash-check.sh` (**60 lines** on `origin/staging`, pure bash, `set -uo pipefail`) is the project's **staleness detector**: at each session start it sha256-hashes the consumer's declared dependencies and compares against a stored baseline in `.ai-factory/tool-decisions.md`; on mismatch it prints a one-line WARN into session context (the harness auto-injects stdout) telling the agent to re-run rule-research. This is the mechanism that realizes [README.md#why-this-exists](../../../README.md#why-this-exists) — «generated executable rules don't go stale» — at the earliest reachable channel (session start, not CI). NOTE: on `staging` the WARN is emitted via **bare `printf '⚠ …\n'` (L52, L55)** — there is no `_emit_warn` function and no ZCode-JSON branch on staging; the harness-portable `_emit_warn` shim is **new work** in the kickoff's DH-S1 (a local unmerged `zcode-parity` branch carries such a shim but is NOT a dependency this R-phase may assume).

It is **deliberately JS-only today**, and that limitation is structural, not cosmetic:

- **L27-28:** `[ -f package.json ] || exit 0; if ! command -v node >/dev/null 2>&1; then exit 0; fi` — the hook **hard-exits** when `package.json` is absent or `node` is not on PATH. On a python or rust consumer this means the staleness nudge is **silently never injected**.
- **L29-31:** the deps surface is `node -e` reading `package.json`'s `dependencies` + `devDependencies`.
- The python delivery lane shipped by python-delivery-v0 is **explicitly node-free**: `install.sh:196-198` («it never enters the npm package.json precondition») and `lib.sh:497` labels the stack-detector "NODE-FREE". So a python consumer running `install.sh python` can have **no node and no package.json at all**, yet the shipped hook still requires both. The node-free constraint is real, not hypothetical.
- There is **no rust delivery lane yet** (no `setup.d/NN-rust.sh` / `do_rust_lane`; `grep` for `TOOLCHAIN=rust` returns nothing). The cargo *backend* (`packages/core/backends/cargo/`) exists but the consumer install path for rust is unbuilt. This matters for scoping (§Scoping below).

The three live-generation stages (LG-S1/S2/S3, all merged) generate rules for three stacks, but the single detector that should keep them fresh watches only one. That is the gap this umbrella closes.

## §1 What to hash per stack (deps-surface map)

The hook's job is **drift detection** (does the current deps-hash match the stored one?), not consuming the dep values — so the extractor only needs to be **deterministic**, not spec-compliant. This relaxes the problem: we hash the **declared manifest**, not the lockfile (the lock is a derivative artifact; in-range updates like `npm update` are an accepted false-negative for a staleness *nudge*, not a correctness gate).

### JS — `package.json` (current, widen)

The existing hook hashes `dependencies` + `devDependencies`. The research surfaced **higher-signal fields it misses**:

- `peerDependencies` — defines what the consumer/host provides (e.g. `react`, `eslint`); whether a rule applies frequently depends on the resolved peer version.
- `overrides` (npm 8.3+) / `resolutions` (Yarn) / `pnpm.overrides` (pnpm <11) — force a transitive version; these change the *resolved* version a lint rule actually runs against. **The single highest-signal field the current hook misses.**
- `optionalDependencies` — low signal but cheap to include.

**Widen-to set (JS):** `dependencies` + `devDependencies` + `peerDependencies` + `optionalDependencies` + `overrides` + `resolutions` + `pnpm.overrides` (each if present). Skip `bundleDependencies`, `workspaces`. Documented blind spot: pnpm v11 relocated overrides to `pnpm-workspace.yaml` (out of band for a package.json-only hash).

### Python — `pyproject.toml` (the messiest: two generations + one legacy vendor)

Deps live in **overlapping homes** across competing standards:

- **PEP 621 (canonical):** `[project] dependencies` (array of PEP 508 strings), `[project.optional-dependencies]` (extra → array).
- **PEP 735 (2024-25, where modern dev/lint deps are moving):** `[dependency-groups]` — non-distributed deps (dev/test/lint).
- **Poetry (legacy):** `[tool.poetry.dependencies]`, `[tool.poetry.dev-dependencies]` (deprecated), `[tool.poetry.group.<name>.dependencies]`.
- **Hatch:** `[tool.hatch.envs.<name>]` dependencies/`extra-dependencies`. PDM/flit/setuptools converge on PEP 621 `[project]`.

**Hash-to set (python):** the raw TOML text of `[project]` + `[project.optional-dependencies]` + `[dependency-groups]` + `[tool.poetry.dependencies]` + `[tool.poetry.dev-dependencies]` + all `[tool.poetry.group.*.dependencies]` + `[tool.hatch.envs.*]` dep fields (each if present). Cheapest robust implementation: **substring-hash the relevant table blocks** rather than parse PEP 508 strings (which carry environment markers `; python_version < '4'` that are best hashed literally, not normalized). Note `[tool.poetry.group.<name>]` requires globbing arbitrary names.

### Rust — `Cargo.toml`

- Tables: `[dependencies]`, `[dev-dependencies]`, `[build-dependencies]`, all `[target.*.{dependencies,dev-dependencies,build-dependencies}]` (triple + cfg-gated), `[workspace.dependencies]` + dev/build/target variants.
- Per-dep sub-fields that flip lint behavior: `version`, `features` (gate `#[cfg(feature=...)]` → gate clippy lints), `default-features`, `git`/`branch`/`tag`/`rev`, `path`, `optional`, `workspace`.
- **Two equivalent forms** both must be hashed: `[dependencies.serde]` table-form AND inline `serde = { ... }`.
- Workspace inheritance: `foo = { workspace = true }` defers to `[workspace.dependencies]` — hashing the member manifest alone misses the real version; the extractor must include the workspace root block.

**Hash-to set (rust):** every `[…dependencies]` table block + every `[dependencies.*]` / `[dev-dependencies.*]` / `[build-dependencies.*]` dotted sub-table + all `[target.*.dependencies…]` blocks. Documented blind spots: git-deps-without-`rev` and path-deps need `Cargo.lock`/content hashing for full coverage (out of scope for a manifest-only nudge).

## §2 How to extract without node (the node-free parsing path)

This is the load-bearing technical constraint. The python lane is node-free; a rust lane will be too. The hook **cannot** rely on `node -e`. The recommended path per stack is a **two-tier ladder** — a zero-dep default (works with no toolchain) and a toolchain-enrichment tier (used only if present):

| Stack | Tier 1 (zero deps, default) | Tier 2 (if toolchain present) |
|---|---|---|
| **Python** | grep/sed **table-boundary** hash of `[project]` (+ Poetry tables if present) | `python3` + `tomllib` (≥3.11) → `tomli` (3.7-3.10) |
| **Rust** | grep/sed **table-boundary** hash of `[dependencies]` + dotted sub-tables + `[target.*]` | `cargo metadata --no-deps --format-version 1 --offline` (JSON) |

### The table-boundary-hash insight (Tier 1, the right default)

**Do not try to parse TOML values.** Instead, extract the **byte range** of the relevant table(s) and hash that range — from the `^\[<table>\]` line up to the next `^\[` header. This sidesteps inline-table and multiline-array parsing entirely. The extractor only needs to find table boundaries, which `^\[` anchoring does reliably. **The hash changes iff the literal deps text changes — exactly the drift signal wanted.** (Documented false-positive: a reformatted-but-semantically-identical manifest shows drift — acceptable for a non-blocking advisory hook, and Tier 2 eliminates it when available.)

Known failure modes of naive grep/sed (TOML 1.0.0 spec) and why table-boundary hashing dodges them: multiline arrays, inline tables, comments containing `#`, dotted sub-tables — all collapse to «hash the literal block bytes, don't interpret». The only real requirement is **also matching dotted sub-tables** (`[dependencies.serde]`, `[dependencies.*]`) so per-crate detailed forms are not dropped.

### Python `tomllib` — version landscape (Tier 2)

- `tomllib` added in **Python 3.11** (PEP 680, read-only, requires binary-mode `open("pyproject.toml","rb")`).
- Fallback for 3.7-3.10: `tomli` (third-party, same API) — **unsafe to assume** in a fresh venv. Treat its absence as «fall to Tier 1», not an error.
- The shim: `try: import tomllib except ModuleNotFoundError: try: import tomli as tomllib except ModuleNotFoundError: <exit 13 → degrade>`.

### Rust `cargo metadata` (Tier 2)

- `cargo metadata --no-deps --format-version 1 --offline` emits stable JSON with `packages[].dependencies[]`; resolves workspace inheritance + target/cfg deps correctly.
- **Traps:** fails if `Cargo.lock` missing and network needed; **never** pass `--frozen`/`--locked`; use `--offline` to avoid stalls; requires rust toolchain on PATH. Any non-zero exit → degrade to Tier 1.
- No rust stdlib TOML parser callable from bash; `toml`/`toml_edit` are third-party crates needing a compiled helper. So rust is strictly two-tier.

### Both tiers route the verdict through a harness-portable `_emit_warn` shim (NEW in DH-S1)

The staging hook's WARN is bare `printf '⚠ …\n'` (L52, L55) — **no `_emit_warn` function exists on staging**. The kickoff's DH-S1 deliverable 0 **introduces** a `_emit_warn` shim: under `ZCODE_PROJECT_DIR` + `jq` it emits strict-JSON `{hookEventName:"UserPromptSubmit", additionalContext:$c}`, else plain `⚠ %s`. The two existing `printf` call-sites (L52, L55) are refactored to call it FIRST; every new stack path then routes its mismatch verdict through the same function so CC-plain vs ZCode-JSON output stays unified. (A local unmerged `zcode-parity` branch carries a similar shim — it is NOT assumed as a dependency; DH-S1 rebuilds the shim against staging.) The always-exit-0, non-blocking contract (`exit 0` at L60) holds.

## §3 Architecture — one hook vs three (the OWNER-FORK, recorded; recommendation given)

This is the one strategic decision this R-phase surfaces but does **not** close — it is the kickoff's first decision gate.

**Option A — one hook with stack-detection.** A single `deps-hash-check.sh` detects which manifest(s) exist and hashes each present stack. Pros: one file, one dual-pair byte-identity lock, mirrors the existing dispatch-by-presence idiom (`lib.sh` `_detect_stack_from_pkg`). Cons: the script grows to carry TOML table-boundary extraction + tier-2 dispatch for two ecosystems; the byte-identical dual-pair (`packages/core/hooks/` ↔ `.claude/hooks/`, guarded by `deps-hash-check.test.ts` #382) now covers all three stacks in one artifact.

**Option B — three hooks (one per stack) + a shared lib.** Cleaner per-stack isolation. Cons: **`install.sh` deliberately ships the hook standalone with NO `lib/`** (`install.sh:421-422` installs the hook verbatim to the consumer's `.claude/hooks/`; there is no sourced library on the consumer side). Introducing a shared lib breaks this principle and adds a delivery-surface abstraction; three hooks triple the dual-pair byte-identity surface. Option B additionally requires an explicit **owner-call sign-off** before introducing the `lib/` (the no-lib contract is binding).

**Recommendation (for the kickoff to confirm):** **Option A — one hook with stack-detection.** Rationale: it preserves the no-lib delivery principle (a binding constraint), keeps one byte-identity surface, and the per-stack logic is bounded (table-boundary grep is ~15 lines/stack). The complexity cost of Option B (a lib the delivery layer explicitly disclaims) outweighs the isolation benefit. The one hook computes **one hash per detected stack** and stores one baseline per stack in `.ai-factory/tool-decisions.md` (`deps-hash-npm`, `deps-hash-python`, `deps-hash-cargo`), emitting one WARN per drifted stack.

## §4 Storage model — per-stack baselines

The current single `deps-hash:` frontmatter line generalizes to **one line per detected stack**:

```yaml
deps-hash-npm:    sha256-<hash>
deps-hash-python: sha256-<hash>
deps-hash-cargo:  sha256-<hash>
```

Each present stack is hashed + compared independently; a drift in any one emits its own WARN. Backward-compatible: the legacy bare `deps-hash:` key is read as `deps-hash-npm` for existing JS-only consumers (so the widen-to-JS-fields change does not falsely alarm on first run — re-baseline on next `/tool-bootstrapping`).

## §5 Scoping — what is and is NOT this umbrella

**IN scope:**
- Widen the JS hash surface (add peer/optional/overrides/resolutions).
- Add python (`pyproject.toml`) detection + Tier-1 table-boundary hash + Tier-2 `tomllib` enrichment.
- Add rust (`Cargo.toml`) detection + Tier-1 table-boundary hash + Tier-2 `cargo metadata` enrichment — **detection only; no rust *delivery lane* is built here.** The hook detects a committed `Cargo.toml`; this umbrella does NOT add `setup.d/NN-rust.sh`. (A consumer may commit a `Cargo.toml` before a rust delivery lane exists; the detector should still work.)
- Per-stack baselines in `tool-decisions.md` (backward-compat read of legacy key).
- Test oracle: `deps-hash-check.test.ts` fixtures for each stack, node-free case, tier-2 degrade case; `@dual-pair` byte-identity for all three.
- `_emit_warn` routing preserved.

**OUT of scope (recorded triggers):**
- A rust **delivery lane** (`setup.d/NN-rust.sh`) — separate umbrella; this hook only *detects* a `Cargo.toml`.
- Lockfile hashing (`Cargo.lock`, `package-lock.json`, `pnpm-lock.yaml`, `uv.lock`) — accepted false-negative documented, not closed here.
- pnpm v11 `pnpm-workspace.yaml` overrides relocation — documented blind spot.
- The «re-run rule-research» action the WARN suggests — that is the *response* to staleness, owned by tool-bootstrapping skill Rule 5, not this hook.

## §6 Prior-art / build-first (BFR)

- **REUSE:** the existing `deps-hash-check.sh` (the substrate, 60 lines on staging), the `sha256sum`/`shasum` BSD/Linux fallback (L36-39), the `install.sh:421-422` standalone-ship contract, and the `deps-hash-check.test.ts` dual-pair oracle pattern (guard at L257-268). NOTE: the harness-portable `_emit_warn` is NOT yet on staging (bare `printf` at L52/L55) — DH-S1 builds the shim; it is not a reuse.
- **REUSE (idiom):** `setup.d/45-python.sh:85-145` `_py_sgconfig_merge` is this repo's template for cautious BSD-safe bash text-transforms (read-loop rewrite via temp file, no `sed -i`) — the table-boundary extractor should follow it.
- **NOT building:** a TOML parser (table-boundary hashing avoids it), a new delivery abstraction (Option A preserves no-lib), a new hook framework.
- **New SSOT row candidate** (for the kickoff to land in the capability commit): stack-agnostic staleness detection — BUILD-thin-extension over the existing single-stack hook.

## §7 §1.7 self-review

- **Forward-check:** complies with [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) (the hook is a bash UserPromptSubmit context-injector; Tier-2 `tomllib`/`cargo metadata` are free stdlib/toolchain reads, zero paid-LLM/API); [doc-authority-hierarchy.md §2-3](../../../.claude/rules/doc-authority-hierarchy.md) (carries scope annotation + folder-authority header, claims authority for nothing beyond the gap); [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) (REUSE — extends the existing hook, introduces no parallel surface); [ai-laziness-traps.md](../../../.claude/rules/ai-laziness-traps.md) T3/T11 (every deps-field claim cites a spec; every node-free claim cites `install.sh:196-198` + `deps-hash-check.sh:27-28`; the architecture fork is surfaced not silently resolved).
- **Backward-check:** class of this change = **additive extension of an existing single-stack detector to multistack + a new harness-portable WARN shim**. Sibling surfaces where the same change-class would apply: (a) the *response* side — tool-bootstrapping skill's «re-run rule-research» reads the same `tool-decisions.md`, so it composes (but its `SKILL.md` Rule 5 + `decision-format.md` schema docs need the per-stack key names documented — kickoff DH-S1 deliverables 4/5, AOC-gated); (b) the *rust delivery lane* (does not exist yet — this hook detects-only, no collision); (c) the *install hook-ship path* (`install.sh:421-422` installs the hook verbatim — any new `_emit_warn` shim ships through it unchanged, byte-identical); (d) the *test-oracle seam* (`deps-hash-check.test.ts` `@dual-pair` L257-268 — the shim refactor must keep `packages/` ↔ `.claude/` byte-identical); (e) the *storage schema SSOT* (`decision-format.md` §2/§3 — must document the new keys). It supersedes nothing: the legacy bare `deps-hash:` key is read backward-compatibly as the npm slot.
- **Self-application (T15):** this patch applied its own «measure the real constraint, do not assume» discipline — the node-free claim is verified against the shipped `install.sh`/`lib.sh`, not assumed from the kickoff prose. (Correction 2026-07-17 after a cold dual-reviewer cycle: the original §0/§2/§6 claimed a `_emit_warn` function existed on staging — that was read from an unmerged local branch, not staging; this patch now states the staging truth: bare `printf`, shim is new DH-S1 work.)
