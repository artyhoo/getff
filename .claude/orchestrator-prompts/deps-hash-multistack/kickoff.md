<!-- scope: kickoff — deps-hash multistack. The deps-hash-check staleness hook covers only the JS lane today (deps-hash-check.sh:39-40 hard-exits on no-node/no-package.json); extend it to detect drift in python (pyproject.toml) and rust (Cargo.toml) consumers so the staleness nudge covers all three live-generation stacks. Base = the existing single-stack hook + python-delivery-v0's node-free lane + LG-S1/S2/S3's three-stack generation. dispatch = I-phase stages DH-S1..DH-S3. -->

# deps-hash-multistack — kickoff

> **Goal of this umbrella:** make the framework's **staleness detector** cover all three live-generation stacks. Today the `deps-hash-check` UserPromptSubmit hook watches only `package.json` (JS); a python consumer (node-free by design, `install.sh:196-198`) or a rust consumer (committed `Cargo.toml`) gets **zero staleness signal** — generated rules silently go stale. This umbrella widens one detector to JS + python + rust, node-free, so the «generated executable rules don't go stale» promise ([README.md#why-this-exists](../../../README.md#why-this-exists)) holds for all three stacks, not one. Serves the staleness half of the live-generation vision; it does NOT generate rules (that is live-generation) — it watches for when generation should re-run.
> **What already exists (verified 2026-07-16):** the single-stack hook `packages/core/hooks/deps-hash-check.sh` (72 lines, pure bash, harness-portable `_emit_warn` at L21-27, sha256sum/shasum fallback at L48-54, always-exit-0 non-blocking contract). It ships standalone to consumers (no `lib/`, L20) and is dogfooded byte-identically at `.claude/hooks/` — drift guarded by `deps-hash-check.test.ts` (#382 `@dual-pair`). The python delivery lane (`setup.d/45-python.sh`, #996) knows `pyproject.toml` collision surfaces. The cargo backend (`packages/core/backends/cargo/`, #199/#977) renders clippy but **no rust delivery lane exists** — this umbrella detects a committed `Cargo.toml`, it does NOT build the rust lane.
> **Falsifiers (surface, do not assume):** (1) if a stack's manifest cannot be hashed deterministically without a full TOML parser (the table-boundary-hash approach in research-patch §2 fails on a real manifest), that is a finding with the failing fixture, NOT a license to pull a TOML-parser dependency into the no-lib hook; (2) if Option A (one hook) grows past a maintainable size (the OWNER-FORK, research-patch §3), that is a finding to split, not a silent re-architecture; (3) if the node-free python lane is found to actually have node available (contradicting `install.sh:196-198`), the Tier-1 grep path is still the right default (deterministic, no toolchain dependency) — node presence does not retire it.

---

## §0 Research base + re-verify obligation

Authoritative research base: [`2026-07-16-deps-hash-multistack.md`](../../../docs/meta-factory/research-patches/2026-07-16-deps-hash-multistack.md) (§0 ground truth, §1 per-stack deps-surface map, §2 node-free parsing ladder, §3 architecture fork, §4 storage model, §5 scoping). Before any stage dispatch, the executing session MUST re-verify volatile facts live (T3/T12):

- **Node-free constraint:** re-confirm `install.sh:196-198` + `setup.d/lib.sh:497` "NODE-FREE" + `deps-hash-check.sh:39-40` hard-exit — the entire Tier-1 grep approach hinges on python/rust consumers genuinely lacking node.
- **The existing hook's contract:** re-read `packages/core/hooks/deps-hash-check.sh` end-to-end (the `_emit_warn` harness-portable emitter, the sha256sum/shasum fallback, the unbaselined-vs-drift case distinction at L56-69) — every stage must preserve all of these verbatim.
- **Dual-pair byte-identity:** re-confirm `deps-hash-check.test.ts` `@dual-pair` guard (the `packages/core/hooks/` source ↔ `.claude/hooks/` dogfood copy must stay byte-identical; any edit lands in BOTH files in the same commit).
- **Cargo state (T3):** staging moves daily; cite every `file:line` against **`origin/staging`** post-`git fetch`, not the working tree. Re-confirm no rust delivery lane exists (`grep -r TOOLCHAIN=rust setup.d/` empty) — this umbrella detects `Cargo.toml`, it does not add `setup.d/NN-rust.sh`.
- **Prior-art (BFR §6, [build-first-reuse-default.md §3](../../rules/build-first-reuse-default.md)):** the R-phase ran two parallel subagent sweeps (deps-surface map citing PEP 621/680/735 + Cargo Book + npm docs; node-free TOML-parsing path citing Python release notes + Cargo Book). New SSOT row **candidate** (stack-agnostic staleness detection — BUILD-thin-extension over the existing single-stack hook) lands in the same commit as the capability it justifies — re-grep the register tail at commit time (T20).

## §1 Target design (fixed by the research-patch — do not re-derive)

- **ONE hook with stack-detection (Option A — research-patch §3 recommendation, the kickoff's first decision gate §DH-S1).** A single `deps-hash-check.sh` detects which manifest(s) exist (`package.json` / `pyproject.toml` / `Cargo.toml`) and hashes each present stack. One file, one dual-pair byte-identity lock, preserves the no-lib delivery contract (`deps-hash-check.sh:20`). **This is binding unless DH-S1's fork-check produces a measured reason to split** — do not split silently.
- **Two-tier extraction ladder per non-JS stack (research-patch §2):**
  - **Tier 1 (default, zero deps):** table-boundary hash — extract the byte range of the relevant TOML table(s) (`^\[<table>\]` up to the next `^\[`), hash that range. Deterministic, no toolchain dependency, no TOML parser. The hash changes iff the literal deps text changes — exactly the drift signal. Also match dotted sub-tables (`[dependencies.serde]`, `[dependencies.*]`).
  - **Tier 2 (enrichment, only if toolchain present):** python → `python3` + `tomllib` (≥3.11) / `tomli` (3.7-3.10, treat absence as degrade-not-error); rust → `cargo metadata --no-deps --format-version 1 --offline` (never `--frozen`/`--locked`; non-zero exit → degrade to Tier 1).
- **Hash the declared manifest, not the lockfile** (research-patch §1). In-range updates (`npm update`, floating git-deps) are an accepted false-negative for a staleness *nudge*. Documented, not closed.
- **Per-stack baselines (research-patch §4):** `tool-decisions.md` stores one line per detected stack — `deps-hash-npm` / `deps-hash-python` / `deps-hash-cargo`. Legacy bare `deps-hash:` read backward-compatibly as the npm slot (so the JS-widen change does not falsely alarm existing consumers on first run — re-baseline on next `/tool-bootstrapping`).
- **One WARN per drifted stack**, routed through the existing `_emit_warn` (L21-27) — harness-portable JSON (ZCode) / plain (CC). The always-exit-0, non-blocking contract (L72) holds.
- **JS hash surface widened** (research-patch §1): add `peerDependencies` + `optionalDependencies` + `overrides` + `resolutions` + `pnpm.overrides` to the existing `dependencies` + `devDependencies`. Documented blind spot: pnpm v11 relocated overrides to `pnpm-workspace.yaml` (out of band).

## §2 Stages (each = one PR onto staging, branch from staging; do NOT collapse)

**DH-S1 — architecture fork-check + JS widen + python Tier-1 + storage-model SSOT.**
The kickoff's first decision gate: **confirm Option A (one hook)** against the research-patch §3 recommendation with a measured size check — implement JS-widen + python table-boundary-hash in the one hook; if the script grows past a maintainable threshold (~180 lines), that is a recorded finding to split (DH-S2 route), not a silent re-architecture. Deliverables: (1) JS hash surface widened (peer/optional/overrides/resolutions); (2) `pyproject.toml` detection + Tier-1 table-boundary hash (`[project]` + `[project.optional-dependencies]` + `[dependency-groups]` + `[tool.poetry.*]` + `[tool.hatch.envs.*]`, each if present); (3) per-stack baseline storage (`deps-hash-npm` / `deps-hash-python`) with legacy-key backward-compat read; (4) **storage-model SSOT updated** — `.claude/skills/tool-bootstrapping/references/decision-format.md` §2 schema + §3 example land the `deps-hash-npm`/`-python`/`-cargo` key names + the legacy-compat read rule in the SAME commit as the hook change (backward-sweep finding: the schema doc is the storage SSOT, not optional); (5) **response-side doc aligned** — `tool-bootstrapping/SKILL.md` Rule 5 gains a one-line ack of per-stack baselines so its prose matches the multistack WARNs (backward-sweep finding); (6) one WARN per drifted stack via `_emit_warn`; (7) test oracle: fixtures for JS-widen, python pyproject (node-free), tier-2 `tomllib` degrade, `@dual-pair` byte-identity for both stacks; (8) the size-gate verdict recorded for the fork. Bash 3.2-compatible (mirror `setup.d/45-python.sh:85-145` BSD-safe idiom); no new deps; no paid LLM; every manifest-parsing claim = fired command + output (T3); TDD RED-before-GREEN.

**DH-S2 — rust Tier-1 + Tier-2 `cargo metadata` OR the split (fork-dependent).**
Either (A) Option A holds → add rust: `Cargo.toml` detection + Tier-1 table-boundary hash (`[dependencies]` + `[dev-dependencies]` + `[build-dependencies]` + dotted sub-tables + `[target.*.dependencies…]` + `[workspace.dependencies]`) + Tier-2 `cargo metadata --no-deps --format-version 1 --offline` enrichment; detect-only (NO `setup.d/NN-rust.sh` — boundary). OR (B) DH-S1's size-gate fired → this stage executes the split (Option B: per-stack hooks + the lib-delivery decision) per the recorded finding. The fork routes here; do not pre-commit. Either way: `deps-hash-cargo` baseline; fixtures for two-form deps (table + inline), workspace inheritance, tier-2 degrade; `@dual-pair`.

**DH-S3 — hardening + edge cases + closure.**
Tier-2 enrichment for python (`tomllib`/`tomli` shim, ≥3.11 vs 3.7-3.10 degrade) if not landed in DH-S1. Cross-stack integration: a polyglot consumer (package.json + pyproject.toml + Cargo.toml all present) gets three independent hashes + three WARNs. **Install-sh seed→detect coverage for the new stacks** — `tests/install-sh/tool-decisions-seed-integration.test.sh` gains a python-seed variant (backward-sweep finding: the existing JS-only assertion stays green; add the sibling coverage). INSTALL-FOR-AI.md / README draft diff (maintainer-owned → PREPARED in the PR body, Artifact Ownership Contract). The documented blind spots made explicit in the hook header comment (lockfiles, pnpm v11, git-deps-without-rev, path-deps). The merging session writes this umbrella's `done.md` — no earlier stage does.

**Scope boundaries (each behind its recorded trigger):** a rust **delivery lane** (`setup.d/NN-rust.sh`) — separate umbrella, this hook detects `Cargo.toml` only; lockfile hashing — accepted false-negative, documented not closed; pnpm v11 `pnpm-workspace.yaml` overrides — documented blind spot; the «re-run rule-research» action the WARN suggests — owned by tool-bootstrapping skill Rule 5, not this hook.

**STOP lines (binding):**

- Kickoff merged to `staging` BEFORE any dispatch ([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)).
- The no-lib delivery contract (`deps-hash-check.sh:20`) — the hook ships standalone to consumers; NO introducing a sourced `lib/` without a recorded reason + owner call (the Option-B split's cost, research-patch §3).
- The `_emit_warn` harness-portable emitter (L21-27) — every new stack path routes its WARN through this function; do not add a second emission path.
- The always-exit-0, non-blocking contract (L72) — the hook injects context, it NEVER blocks a session.
- The `@dual-pair` byte-identity (packages/ ↔ .claude/) — any edit lands in BOTH files, same commit, guarded by `deps-hash-check.test.ts` (#382).
- NO TOML-parser dependency pulled into the hook — Tier-1 is table-boundary hashing; Tier-2 uses free stdlib/toolchain (`tomllib`/`cargo metadata`), never a vendored parser.
- `done.md` ONLY at the DH-S3 final-PR merge.
- NO `setup.d/NN-rust.sh` — this umbrella detects `Cargo.toml`; the rust delivery lane is a separate umbrella.

## §3 Discipline

- Branch per stage, base `staging`; suites green: `npm --prefix packages/core run test:principles`, the `deps-hash-check.test.ts` suite (extended per stack), `tests/install-sh` where the delivery seam is touched; §1.7 Forward/Backward in each PR body.
- `Prior-art:` trailer on every capability commit; new SSOT row (stack-agnostic staleness detection) in the same commit as the artifact (re-grep register tail at commit time, T20).
- Backward-check per [ai-laziness-traps.md T21](../../rules/ai-laziness-traps.md): enumeration format; cold sub-agent for DH-S1 (sibling surfaces = the two OTHER stacks' detection paths + the tool-bootstrapping response side that reads the baselines — does the change-class hold for all three stacks and compose with the response side?).
- Phase -1 principle-test allowlist probe (CLAUDE.md §Operational conventions) — stages edit under watched paths (`packages/core/hooks/**`).
- Meta-orchestrator/orchestrator each own a Phase -1 cold-review of their own output before dispatch.

## §4 AI-laziness traps (principle-12 compliant)

Per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) and §3:

**Active traps: T3, T11, T12, T20, T21** (one-line why each):

- **T3** — every «this manifest hashes deterministically / Tier-1 catches this drift / Tier-2 degrades cleanly» claim carries a fired command + output against a real fixture (a pyproject.toml, a Cargo.toml), not prose.
- **T11** — the one-hook-vs-three fork + any «no upstream extractor» claim need the BFR run (research-patch §6: the existing hook + `lib.sh` `_detect_stack_from_pkg` + `45-python.sh` table-presence grep evaluated) BEFORE «I propose the extension».
- **T12** — the node-free constraint (`install.sh:196-198`) + the `tomllib` version landscape (3.11 vs 3.7-3.10) re-verified live at ship, never from this doc.
- **T20** — no «works for stack X» verdict without the same-turn evidence run quoted (the fixture hash + drift + clean for each stack).
- **T21** — the backward-check ENUMERATES the sibling stacks' detection paths + the tool-bootstrapping response side, it does not restate the stage's own diff.

**Domain-specific traps:**

- **T-DH-A — «TOML needs a parser» (parser-optimism).** Counter: Tier-1 is table-boundary hashing (`^\[<table>\]` to next `^\[`), not value parsing — the hash changes iff the literal deps text changes. A vendored TOML parser in the no-lib hook is a STOP line; only if Tier-1 demonstrably fails on a real fixture (the falsifier) is a finding raised, not a silent dependency added.
- **T-DH-B — «node is available, use it for python too» (constraint-amnesia).** Counter: the python lane is node-free BY DESIGN (`install.sh:196-198`); Tier-2 `tomllib` runs under `python3`, never `node`. Routing python through `node -e` would silently break the node-free consumer the python lane exists to serve.
- **T-DH-C — «hash the lockfile for accuracy» (over-engineering).** Counter: the hook is a staleness *nudge*, not a correctness gate; lockfile hashing is an accepted false-negative (research-patch §1), documented not closed. Pulling in lockfile resolution adds a dependency + latency to a session-start hook.
- **T-DH-D — «split into three hooks, it's cleaner» (premature Option-B).** Counter: Option A is the binding default (research-patch §3 + §1); the split only fires if DH-S1's measured size-gate trips, and even then it is a recorded finding, not an aesthetic preference. Splitting triples the dual-pair byte-identity surface and breaks the no-lib contract.
- **T-DH-E — «this is where the rust delivery lane goes» (scope-conflation).** Counter: this umbrella DETECTS `Cargo.toml`; the rust DELIVERY lane (`setup.d/NN-rust.sh`) is a separate umbrella. Adding the lane here is a STOP line — the boundary is explicit.

## §5 See also

- [docs/meta-factory/research-patches/2026-07-16-deps-hash-multistack.md](../../../docs/meta-factory/research-patches/2026-07-16-deps-hash-multistack.md) — this umbrella's R-phase (ground truth §0, deps-surface map §1, node-free ladder §2, architecture fork §3, storage §4, scoping §5).
- [../live-generation/kickoff.md](../live-generation/kickoff.md) — the three-stack generation this umbrella keeps fresh (LG-S1/S2/S3 merged; the staleness hook is generation's watchdog). **This umbrella EXTRACTS and SUPERSEDES the deps-hash-staleness scope originally written into live-generation's LG-S4** (the LG-S4 kickoff §2 was updated to point here — PR #1016 + the LG-S4 desync-fix); do not implement staleness inside LG-S4.
- [../python-delivery-v0/done.md](../python-delivery-v0/done.md) (#997, CLOSED) — the node-free python delivery lane whose constraint this hook must honor.
- [packages/core/hooks/deps-hash-check.sh](../../../packages/core/hooks/deps-hash-check.sh) — the substrate (single-stack today); [packages/core/hooks/deps-hash-check.test.ts](../../../packages/core/hooks/deps-hash-check.test.ts) — the dual-pair oracle (#382).
- [setup.d/45-python.sh](../../../setup.d/45-python.sh) `:85-145` `_py_sgconfig_merge` — the repo's BSD-safe bash text-transform idiom to mirror.
- [.claude/rules/build-first-reuse-default.md](../../rules/build-first-reuse-default.md), [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md), [ai-laziness-traps.md](../../rules/ai-laziness-traps.md), [doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md), [kickoff-staging-placement.md](../../rules/kickoff-staging-placement.md).
- [docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) — SSOT; the new stack-agnostic-staleness row lands here.
