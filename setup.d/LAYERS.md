# `setup.d/` Layer Registry

> **Authoritative for:** S1 layer list (number · file · purpose · depends-on), `lib.sh` public API surface, stub layers awaiting S2/S3.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../README.md#why-this-exists). Layer *content* for `05-mcp` / `15-companions-stack` — those are defined in S2/S3. Profile *semantics* (which depth ships which artefacts) — see [`docs/meta-factory/research-patches/2026-07-25-beta-a-s1-inventory.md`](../docs/meta-factory/research-patches/2026-07-25-beta-a-s1-inventory.md) §2 (the binding per-profile payload inventory).
>
> **Origin:** modular-install-fullpack Stage S1 (`feature/modular-install-fullpack-73b048`). This file is the concrete predecessor-output that S2/S3/S4 consume, parallel to how S1 consumed `kickoff-s0.md`. See `.claude/orchestrator-prompts/modular-install-fullpack/kickoff-s1.md §3 deliverable 5`.
>
> **Byte-identical invariant:** all layers collectively produce a filesystem tree byte-identical to the monolithic `install.sh` for all 4 stacks (`ts-server`, `react-next`, `react-spa`, `react-native`), greenfield **and** brownfield. Proven by `tests/install-sh/byte-identical.test.sh` (golden baselines under `tests/install-sh/baselines/<stack>/`). The `core` profile (default) preserves this invariant — verified by the snapshot suite (13/13 baselines pass after the `--profile` flag landed).
>
> **Profile model (beta-delivery-ux S1, A1):** layers may gate content on `${PROFILE:-core}`. Three monotonic depths: `core` (today's default, no AIF runtime) → `env` (core + multi-model contour surface as placeholders, no AIF runtime) → `factory` (env + the AIF operator suite + runtime-bridge wiring + GLM one-button placeholder). The `factory` gate in 10-skills + 20-agents replaces the pre-profile `WITH_AIF_SUITE` flag (the legacy flag still works — install.sh resolution routes it to `PROFILE=factory`). The `env` depth is `core`-equivalent on today's payload; the contour surface it adds ships via OTHER stages (S2/S3/S4/S5), not via this stage's setup.d edits.

---

## Layer List

Layers execute in lexicographic order — `install.sh` sources them via `for f in "$PKG_ROOT"/setup.d/[0-9]*.sh; do source "$f"; done`.

All layers are **sourced** (not exec'd) into the dispatcher shell so mutations to shared globals (`SKIPPED`, `_r2_verdict`, `DEPS_INSTALLED`, `DEVDEPS`) persist across layers.

| # | File | Purpose | Depends on | Status |
|---|------|---------|-----------|--------|
| 05 | `05-mcp.sh` | MCP companion install: (a) context7 → `.mcp.json` (regression L1 restore from `setup.sh:289-303`); (b) detect-first `claude mcp add` for each `kind=mcp` manifest row | lib.sh (in scope), engine.sh (sourced here) | **Done** (S2) — gated on `FULL`; non-full / snapshot path no-ops (D2) |
| 10 | `10-skills.sh` | §1 Skills (`skills/` → `.claude/skills/`) + §1b deps-hash-check CC hook | (none — first content layer) | Done — F7 split now gated on `PROFILE=factory` OR legacy `WITH_AIF_SUITE` (kickoff §2 re-triage) |
| 15 | `15-companions-stack.sh` | Stack-specific companion installs | lib.sh (in scope) | **Stub** — content deferred to S3 |
| 20 | `20-agents.sh` | §2 Sub-agents (`agents/` → `.claude/agents/`) + §3c skill-context overrides | `SHIPPED_DOCS` global (set in dispatcher) | Done — orchestrator-worker + reviewer-discipline + aif-orchestrator-discipline skill-context gated on `PROFILE=factory` OR legacy `WITH_AIF_SUITE` |
| 30 | `30-templates.sh` | §3a AI Factory templates + §3b `tool-decisions.md` seed + §3d stack-specific templates + §5b `AGENTS.md` | `SHIPPED_DOCS` global | Done |
| 40 | `40-configs.sh` | §4 enforcement scripts + §5a shared templates + §5b' ESLint rules + barrel-gen + §6a stack configs | 30-templates (`.ai-factory/` exists) | Done |
| 45 | `45-python.sh` | Python toolchain delivery (ast-grep rules + `sgconfig.yml` + ruff config) with augment-first collision policy; **INERT on the npm flow** — runs only when `GETFF_TOOLCHAIN=python` (env-var contract; S2 wires the `./setup python` entry) | lib.sh (`copy_safe`/`mkdir_safe` in scope), `packages/core/templates/python/**` (S1 Task 4) | **Done (S1 Task 5)** — inert until S2 sets `GETFF_TOOLCHAIN`; npm byte-identical unaffected (guarded no-op) |
| 46 | `46-cargo.sh` | Rust/cargo toolchain delivery (`clippy.toml` bans + `[lints.clippy]` deny reference + `deny.toml` cargo-deny surface + `getff-cargo.yml` CI gate + cargo rules-lock) with augment-first collision policy; **INERT on the npm flow** — runs only when `GETFF_TOOLCHAIN=cargo` (`install.sh cargo` sets it) | lib.sh (`copy_safe`/`refresh_safe` in scope), `packages/core/templates/cargo/**` | **Done (ecosystem-wiring W4)** — inert until `GETFF_TOOLCHAIN=cargo`; npm/python byte-identical unaffected (guarded no-op) |
| 50 | `50-hooks.sh` | §5c `.husky/` hooks cluster + `core.hooksPath` activation | 40-configs (`tsconfig.json` etc. written) | Done |
| 60 | `60-ci.sh` | §6b `.nvmrc`↔CI drift WARN + §6b-bis R2 auto-wire L1 (sets `_r2_verdict`) + §6c CI-orphan WARN + yq auto-wire | 40-configs (`eslint.config.mjs` + `.github/workflows/` written) | Done |
| 70 | `70-deps.sh` | §7 `package.json` scripts merge + §8 dev-dep install (sets `DEPS_INSTALLED`, `DEVDEPS`) + §8b tsx-at-root | 60-ci (`eslint.config.mjs`, `detect-r2-boundary` etc. written) | Done |
| 99 | `99-finalize.sh` | **synth-wire** (synthesizer → root `eslint.config.mjs`; idempotent) + §6b-bis-L2 R2 AST-wire (ts-morph, per-package) + V2 otel-arming WARN + `ignore_shipped_configs` CALL + Done banner | 70-deps (ts-morph installed; `DEPS_INSTALLED`/`DEVDEPS` set), 60-ci (`_r2_verdict` set), **ALL prior** (`SKIPPED` fully accumulated) | Done |

### `kind=mcp` manifest contract (S2)

`kind=mcp` rows in `setup.d/companions.manifest` are consumed by the `05-mcp` layer **inside `install.sh`, before `70-deps`** (I1 channel constraint, D5). The post-install wrapper loop in `setup` explicitly skips them (`[ "$kind" = "mcp" ] && continue`).

**contract:**

- `detect_cmd`: a shell expression that exits 0 when the MCP is already configured (e.g. `claude mcp list --scope user 2>/dev/null | grep -q <name>`).
- `install_cmd`: the official `claude mcp add` command with no version pin. For user-scope MCPs, include `--scope user`; the engine emits a machine-scope notice automatically.
- Rows are processed only when `FULL` is set (i.e., `install.sh --full`). Non-full / `--dry-run` paths are no-ops or print a preview respectively.
- Requires `claude` CLI present; graceful skip (`⊝ claude CLI absent — skipping MCP <name>`) when absent.
- **Byte-identical (D2):** `snapshot.sh` runs `install.sh <stack> --force` WITHOUT `--full`, so the `05-mcp` layer returns early → fingerprints unchanged. If `byte-identical.test.sh` goes red after editing this layer, the `FULL` gate is leaking — fix the gate, do NOT regenerate baselines.

---

### Shared globals (set by dispatcher before sourcing layers)

All layers share the dispatcher shell scope. These globals are initialised in `install.sh` entry and mutated by layers:

| Global | Set by | Read by |
|--------|--------|---------|
| `PKG_ROOT` | dispatcher | all layers, lib.sh |
| `PROJECT_ROOT` | dispatcher | all layers |
| `FORCE` | dispatcher (flag parse) | lib helpers |
| `DRY_RUN` | dispatcher (flag parse) | lib helpers |
| `SKIPPED` | dispatcher (`SKIPPED=()`) | 10, 20, 30, 40, 50, 60, 70, 99-finalize (`SKIPPED` fully accumulated at finalize time) |
| `STACK` | dispatcher (stack pick) | 30, 40, 60, 70, 99 |
| `PROFILE` | dispatcher (flag resolution; `core` default for non-TTY) | 10 (F7 split), 20 (agents F7) — beta-delivery-ux S1 |
| `SHIPPED_DOCS` | dispatcher (SHIPPED_DOCS array set before loop) | 20, 30, 40 |
| `_r2_verdict` | 60-ci | 99-finalize (R2 L2 AST-wire) |
| `DEPS_INSTALLED` | 70-deps | 99-finalize (Next-steps) |
| `DEVDEPS` | 70-deps | 99-finalize (Next-steps) |
| `UPSTREAM_BLOB_URL` | lib.sh | lib helpers (`transform_internal_refs`) |

---

## `lib.sh` Public API

`setup.d/lib.sh` is the helper SSOT (`dual-implementation-discipline.md §7` — one logic, no copy-paste into layers). All helpers are available in dispatcher scope after `source "$PKG_ROOT/setup.d/lib.sh"`.

### Functions

| Helper | Signature | Purpose |
|--------|-----------|---------|
| `transform_internal_refs` | `<file>` | Rewrites `](../../../{docs,packages}/…)`, `](../../../README.md…)`, `](../../install.sh…)`, and `.claude/rules/` refs (`](../../rules/…)` skill shape + `](../.claude/rules/…)` agent shape — rules/ is not shipped) in-place to `$UPSTREAM_BLOB_URL/…` GitHub blob URLs. Leaves genuinely consumer-resolvable refs (e.g. `hooks/`) intact. |
| `copy_safe` | `<src> <dst>` | Copies `<src>` to `<dst>` unless `<dst>` already exists (skip if exists, unless `--force`). Appends to `SKIPPED` on skip. Respects `--dry-run`. |
| `refresh_safe` | `<src> <dst>` | Overwrites `<dst>` unless a sibling `<dst%.md>.override.md` exists (Layer-3 consumer ownership signal). Used by `--refresh` path. |
| `merge_prettierignore` | `<src> <dst>` | Non-destructive `.prettierignore` merge (GH #531): greenfield → copy; existing file → append marker-delimited block of missing AIF entries; idempotent. |
| `_prettierignore_in_skipped` | `<needle>` | Returns 0 if `<needle>` is already in the consumer's `.prettierignore` (used by `merge_prettierignore`). |
| `ignore_shipped_configs` | (none) | Appends AIF-generated file patterns (`RULES.md`, `RULES.*.md`, `.claude/settings.json`, barrel paths) to `.prettierignore` that aren't already excluded. Called **once** by `99-finalize.sh` after `SKIPPED` is fully accumulated. |
| `mkdir_safe` | `<dir>` | `mkdir -p <dir>` respecting `--dry-run`. |
| `chmod_safe` | `<mode> <file…>` | `chmod <mode> <file…>` respecting `--dry-run`. |
| `detect_pm` | (none) | Prints `npm`, `pnpm`, or `yarn` based on lockfile detection in `$PROJECT_ROOT`. |
| `patch_stryker_package_manager` | (none) | Patches `stryker.config.mjs` `packageManager` field to match detected PM (idempotent). |
| `copy_skill_with_transform` | `<slug>` | `copy_safe` of `.claude/skills/<slug>/` then `transform_internal_refs` on each copied file. |
| `refresh_skill_with_transform` | `<slug>` | `refresh_safe` of `.claude/skills/<slug>/` then `transform_internal_refs` on each refreshed file. |

### Constants (set by lib.sh, used by helpers)

| Constant | Value / Source | Purpose |
|----------|---------------|---------|
| `UPSTREAM_BLOB_URL` | `${UPSTREAM_BLOB_URL:-https://github.com/artyhoo/getff/blob/main}` | Base URL for `transform_internal_refs` rewrites |
| `PRETTIERIGNORE_BEGIN_MARKER` | `# --- BEGIN aif-managed ---` | Idempotency fence for `.prettierignore` merge |
| `PRETTIERIGNORE_END_MARKER` | `# --- END aif-managed ---` | Idempotency fence for `.prettierignore` merge |

---

## Stub layers (content deferred)

| Layer | Stub file | Populated in | Description |
|-------|-----------|-------------|-------------|
| `15-companions-stack.sh` | `setup.d/15-companions-stack.sh` | S3 | Stack-specific companion installs |

`05-mcp.sh` was promoted from stub to content in **S2** (see Layer List row above). The stub is safely `source`-able by the dispatcher when `FULL` is unset (early `return 0`).

---

## Known deferred items

- **`PARK[S2+]`** — `test:integration` quoting: the `node -e` package.json-scripts merge in `70-deps.sh` keeps the monolith's bare single-quotes (`--include 'src/**/*.integration.{ts,tsx}'`) verbatim. Escaping would change rendered output → byte-identical violation. Fix deferred to S2+.
- **`do_refresh` sync-risk** — `do_refresh()` lives in `install.sh` entry (O4-b decision: keep separate, byte-faithful). A `# @sync-with-layers` marker in `install.sh` notes the hand-sync risk for a later stage.

---

## See also

- [`.claude/orchestrator-prompts/modular-install-fullpack/kickoff-s0.md`](../.claude/orchestrator-prompts/modular-install-fullpack/kickoff-s0.md) — authoritative step→layer cut mapping (S0 boundary table).
- [`.claude/orchestrator-prompts/modular-install-fullpack/kickoff-s1.md`](../.claude/orchestrator-prompts/modular-install-fullpack/kickoff-s1.md) — S1 stage kickoff.
- [`tests/install-sh/byte-identical.test.sh`](../tests/install-sh/byte-identical.test.sh) — 4-stack × {greenfield,brownfield} byte-identical proof.
- [`tests/install-sh/lib-helpers.test.sh`](../tests/install-sh/lib-helpers.test.sh) — `lib.sh` unit test (O1 regression guard).
- [`install.sh`](../install.sh) — thin dispatcher that sources this layer set.
