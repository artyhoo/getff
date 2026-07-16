# LG-S4 — `ecosystem-python.ts`: a third EcosystemAdapter (unwired) + unwired-debt tripwire

> **Scope:** design spec for the `ecosystem-python.ts` sub-deliverable of LG-S4 (live-generation umbrella, kickoff `.claude/orchestrator-prompts/live-generation/kickoff.md:50-53`). This spec covers the adapter design + a tripwire that mechanically prevents the unwired adapter from silently accumulating as dead code. NOT authoritative for project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Status:** design (brainstormed + reviewer-audited + §1.7 self-evaluated). Implementation gated on user spec-review, then `writing-plans`.
> **Base:** `origin/staging` @ `de7fc9d4c` (LG-S3 merged). Worktree `claude/lg-s4-python-ecosystem`.

---

## §1 Goal

Ship a third `EcosystemAdapter` (`ecosystem-python.ts`) so that a python consumer's Tier-1 documentation-source trust can be derived from an installed package's own metadata — paralleling `ecosystem-npm.ts` (js) and `ecosystem-cargo.ts` (rust). The adapter is **unwired** in this stage (no production caller threads it into a `ResolveCtx`), mirroring the cargo adapter's current state; a **tripwire test** makes the resulting unwired-debt mechanically visible so a future wiring-umbrella cannot silently forget it.

This realises the LG-S4 sub-deliverable that the kickoff gated behind «ONLY if a consumer needs a non-Tier-0 python source». The owner decision (2026-07-17) lifts that gate: build the adapter now, wire later (python + cargo together, in a separate umbrella).

## §2 Background — the binding invariants (from research-source-trust.md §5)

An `EcosystemAdapter` (`packages/core/research/allowlist-resolver.ts:133-136`) MUST satisfy three invariants, re-confirmed from the shipped npm + cargo adapters:

1. **Offline-determinism.** All local fs, ZERO network, ZERO binary invocation. The cargo adapter refuses `cargo metadata` shell-out (`ecosystem-cargo.ts:5-7`) on this ground. ⇒ the python adapter MAY NOT shell out to `pip`/`python`/`poetry`/`uv`.
2. **Containment.** Any fs path derived from a dependency name OR a manifest-declared value MUST lie within the consumer `root`'s own realpath, canonicalized on both sides (`resolvedWithinRoot`, declared `ecosystem-cargo.ts:289`). This is the 2nd-BLOCKER fix (lexical-only was bypassed by an in-tree symlink). ⇒ the python adapter's reads stay inside `root`.
3. **Fail-closed.** Any ambiguity, unrecognized shape, or parse error drops the field/entry (returns undefined/empty), NEVER guesses a host or a dependency's location (cargo parser contract, `ecosystem-cargo.ts:18-48`). ⇒ no heuristics for «where is the venv» / «which python version».

The full design research + brainstorm of four approaches + live probe evidence is in [`docs/meta-factory/research-patches/2026-07-16-lg-s4-python-ecosystem-adapter.md`](../../meta-factory/research-patches/2026-07-16-lg-s4-python-ecosystem-adapter.md). Approach D (root-locked venv, deterministic discovery) is the chosen design.

## §3 The fundamental asymmetry (why this is NOT a mechanical copy of cargo)

| Property | npm | cargo | **python** |
|---|---|---|---|
| Direct-dep manifest | `package.json` | `Cargo.toml` | **`pyproject.toml`** — PEP 621 `[project.dependencies]` (PEP 508 strings) AND/OR `[tool.poetry.dependencies]` |
| Installed-package location | `node_modules/<name>/` (in root) | `vendor/` / path-dep / workspace-member (in root) | **`.venv/lib/python3.XX/site-packages/<name>-<ver>.dist-info/`** — venv name varies, python version embeds in path, may be system (outside root) |
| Installed metadata format | `package.json` (JSON) | `[package] homepage/repository` (TOML) | **`.dist-info/METADATA`** (RFC 822) — `Project-URL: Homepage, …` + deprecated `Home-page:` |

There is no `node_modules/`-equivalent that is (a) always inside `root`, (b) at a deterministic path, (c) nameable without version-guessing. cargo hit the same wall for registry-deps and **scoped them out** (`ecosystem-cargo.ts:51-60`). Approach D does the same: only a **root-local venv** is read; a system-installed python yields no Tier-1 (Tier-0 fallback — no regression).

## §4 Design — Approach D (root-locked venv, deterministic discovery)

### §4.1 `listDirectDeps(root): Set<string>`

Read `root/pyproject.toml`. Extract direct-dependency **names** from BOTH PEP 621 and Poetry tables. **CRITICAL — distinguish two TOML shapes** (cargo's parser handles only one of them; the python parser must add the array-field shape):

- **PEP 621 `dependencies` is a FIELD (array value) UNDER the `[project]` table, NOT its own table.** Canonical form:
  ```toml
  [project]
  name = "myproj"
  dependencies = ["requests>=2.0", "click"]
  ```
  cargo's mirrored parser regex (`/^[A-Za-z0-9_.-]+\s*=\s*"([^"]*)"$/` for strings, `/…=\s*\{…\}$/` for inline-tables, `ecosystem-cargo.ts:186,191`) does NOT match `key = [array]` — it would silently drop the dominant PEP 621 dependency form. **The python parser MUST add a third regex: `key = [ "PEP508", "PEP508", … ]`** (single-line array of quoted strings), capturing the KEY `dependencies` when the current section is `[project]`, and parsing each quoted element as a PEP 508 string. Multi-line arrays are NOT supported in v1 (fail-closed drop — see §4.1 limitations below).
- **PEP 621 `[project.optional-dependencies]`** IS a table — e.g. `[project.optional-dependencies]` then `test = ["pytest>=8.0"]`. Each KEY is an extra-group name; each VALUE is a single-line array of PEP 508 strings (multi-line unsupported, fail-closed).
- **Poetry** `[tool.poetry.dependencies]` — a table whose KEYS are names (value is a version string or inline table); EXCLUDE the key `python`.
- **Poetry** `[tool.poetry.group.<group>.dependencies]` — same shape as the main poetry table (Poetry 1.2+, standard since 2022). Each `group.*.dependencies` table's KEYS are direct dep names. Match by section-header prefix `tool.poetry.` + suffix `.dependencies`.

**PEP 508 name extraction (required — do NOT skip):** parse each PEP 508 string to extract the bare name: strip extras (`name[extra1,extra2]` → `name`), strip version specifier (`>=`, `~=`, `==`, `!=`, `<`, `>`, `===` and what follows), strip environment markers (everything after `;`). The result is the canonical name. **Normalize PEP 503** (lowercase; collapse runs of `-_.` to a single `-`). This normalization also unifies hyphen/underscore dist-info names (`my-pkg` ↔ `my_pkg`).

Hand-rolled TOML subset parser (mirror cargo's `parseCargoToml` philosophy — fail-closed, no general parser dependency): table headers `[project]`, `[project.optional-dependencies]`, `[tool.poetry.dependencies]`, `[tool.poetry.group.<group>.dependencies]`; `#` line comments (quote-aware); THREE value shapes — `key = "string"` (cargo `:186` regex), `key = { inline-table }` (cargo `:191` regex), and `key = [ "elem", "elem" ]` (NEW python-only — single-line quoted-string array, for PEP 621 dependencies/optional-dependencies). Any unrecognized shape → the entry is dropped (fail-closed), never guessed.

**§4.1 known limitations (fail-closed drops, NOT invariant violations — documented gaps):**
- **Multi-line arrays** (`dependencies = [\n "a",\n "b",\n]`) are NOT supported — the array regex is single-line. Dropped. This affects modern pyproject generated by `uv`/`hatch` defaults; coverage gap recorded in done.md.
- **Multi-line inline tables** (Poetry `complex = {\n version=…\n }`) are NOT supported — cargo's `:191` regex requires `}` on the same line. Dropped. Coverage gap for Poetry deps with multi-line options.
- **Quoted-key Poetry deps** (`"odd-pkg" = "^1.0"` under `[tool.poetry.dependencies]`) — the cargo regex `^[A-Za-z0-9_.-]+\s*=` does not match a quoted key. Dropped. (TOML allows quoted keys for names needing escaping; rare in practice.) Recorded as a limitation.
- **Legacy setuptools/parenthesized PEP 508** (`package (>=1.0)`) and **URL requirements** (`name @ https://…`) are NOT parsed by the PEP 508 extractor — dropped.

If `pyproject.toml` is absent or unparseable → return `new Set()` (empty — Tier-1 cannot derive anything; Tier-0/Tier-2 still apply).

### §4.2 `readInstalledMeta(root, pkg): InstalledMeta | null`

1. **Resolve venv site-packages INSIDE root only.** Candidate roots: `<root>/.venv/` and `<root>/venv/` (the two conventional spellings). For each, enumerate the `lib/python*/site-packages` directory by LISTING actual dirs (do NOT guess a version): `readdirSync(<venv>/lib).filter(e => e.startsWith('python'))`. A real venv has exactly one; if multiple exist (probe edge case — manual injection, post-upgrade detritus), search ALL of them for a dist-info match. If no `python*/` dir → continue to the next venv candidate.
2. **Find the dist-info by the `Name:` field INSIDE its METADATA, not by the directory name.** The directory name (`<name>-<version>.dist-info`) is lexically ambiguous for any package whose name contains a hyphen or a digit-leading segment: probe evidence (research-patch §5 Edge 4 — `django-stubs-5.0.2`, `foo-1-1.0`, `2to3-1.1.10`, ground-truth via `importlib.metadata`) shows the best lexical heuristic resolves 6/7 but FAILS `foo-1` (name `foo-1`, version `1.0`); the ground-truth method (read `Name:` from METADATA) resolves 7/7. So: enumerate EVERY `*.dist-info` directory under each site-packages, read its `METADATA` `Name:` field, PEP-503-normalize both that name and the requested `pkg`, and match on equality. The directory name is used ONLY for enumeration (which dirs exist), never for name extraction. A dist-info whose METADATA has no `Name:` header → no match → null (fail-closed, verified).
3. **Containment.** The whole read path stays under `root`'s realpath via a **local re-implementation** of the `resolvedWithinRoot` containment helper (realpath-canonicalize BOTH the candidate path and `root`, then lexical within-root check). `resolvedWithinRoot` in `ecosystem-cargo.ts:289` is **NOT exported** (only `cargoAdapter` + `extractHttpsHost` are); this mirrors the established per-adapter pattern where each adapter carries its OWN private containment/traversal guards (npm has its own private `isUnsafeDepName` at `ecosystem-npm.ts:21`, distinct from cargo's). The python adapter therefore defines its own `resolvedWithinRoot` + `isUnsafeDepName` locally — NO edit to `ecosystem-cargo.ts` (it stays "unwired, pre-existing, untouched"). This is reuse-by-pattern, not reuse-by-import.
4. **Read + parse METADATA (RFC 822).** Extract homepage from:
   - `Project-URL: Homepage, <url>` (preferred — live probe confirms this is the non-deprecated form), AND
   - `Home-page: <url>` (deprecated fallback).
   RFC 822 line folding (continuation lines starting with whitespace) is UNSUPPORTED — a folded field is fail-closed (dropped, not guessed).
5. **Traversal guard on the NAME.** `isUnsafeDepName(pkg)` (rejects `..`, `/`, `\`, platform-sep) BEFORE any path join — the §5 item-2 harden-criterion, enforced mechanically by `ecosystem-adapter-precondition.test.ts`.

If no venv under root, OR no matching dist-info, OR unreadable METADATA → return `null` (Tier-0 fallback, same as today — no regression).

### §4.3 Ecosystem identity

`ecosystem: 'pip'`. The `'pip'` prefix is added to `KNOWN_ECOSYSTEM_PREFIXES` (`ecosystem-name.ts:22`). The resolver's `tier1For` dispatch (`allowlist-resolver.ts:189`) routes `pip:<name>` to this adapter; `parseEcosystemName` already fails closed on unknown prefixes, so back-compat is preserved.

### §4.4 Wiring — NONE in this stage (recorded debt)

The adapter is NOT threaded into any production `ResolveCtx` caller in LG-S4. This mirrors `ecosystem-cargo.ts` (also unwired — 0 production callers). Two gaps are documented in `done.md`:

- **The LG-S1/S3 bridges are Tier-0-only.** `research-to-node.ts:183` (`firstProvenanceRejection`, which calls the one-arg `validateProvenance` at `:188` with no `ResolveCtx`); `research-to-clippy-node.ts:196` has a duplicated `firstProvenanceRejection`. Neither reaches Tier-1. Wiring the bridges to use `resolveAllowedSources({ root, adapter })` is a separate umbrella.
- **`detectStack` is JS-only.** `Stack = 'react-next' | 'ts-server' | 'unknown'` (`detector/types.ts:5`); `readManifest` reads only `package.json`. Multi-ecosystem detection is a separate umbrella.

The owner decision (2026-07-17): wire python + cargo together in a future umbrella, not piecemeal. The tripwire (§6) makes this debt mechanically visible.

## §5 Test plan (TDD — RED before GREEN)

Mirror `ecosystem-cargo.test.ts`'s structure (a direct sibling):

1. **`listDirectDeps`** — PEP 621 array, PEP 508 name extraction (`"django[bcrypt]>=5.0; python_version>='3.10'"` → `django`), Poetry table (exclude `python`), empty/absent pyproject → empty set, malformed → empty set (fail-closed).
2. **`readInstalledMeta` happy path** — real `.venv/lib/python*/site-packages/<pkg>-<ver>.dist-info/METADATA` with `Project-URL: Homepage, …` → `{ homepage }`. Use `mkdtempSync` + a synthesized venv layout (the live-probe pattern from the research).
3. **`readInstalledMeta` gaps** — no venv → null; venv present but package absent → null; dist-info present but METADATA unreadable → null; dist-info present, METADATA readable but NO `Name:` header → null (fail-closed, research-patch §5 Edge 4); `Home-page:` fallback → extracted; folded field → dropped.
4. **PEP 503 normalization** — `Django` ↔ `django`, `my-pkg` ↔ `my_pkg-1.0.dist-info`.
5. **Traversal guards** (§5 item-2 harden-criterion) — `pkg = '../evil'` → null (NAME guard); a venv dir symlinked out-of-tree → null (VALUE containment via `resolvedWithinRoot`).
6. **Multi `python*/` dir** — two `python3.XX` dirs → searches both (probe edge case).

## §6 Tripwire — unwired-debt visibility (the anti-forget mechanism)

A new test `ecosystem-unwired-debt.test.ts` (sibling to `ecosystem-adapter-precondition.test.ts`):

- **Detector — cover ALL FIVE production wiring paths, not just `validateResearchPlan`.** An adapter is "wired" if it is passed to ANY of the five production APIs that accept a `ResolveCtx` (which carries `adapter`):
  1. `validateResearchPlan(plan, { adapter })` — the path npm uses today (`synthesizer/file-clients.ts:46`, `synthesizer/cli.ts:69`).
  2. `resolveAllowedSources({ adapter })` — exported resolver constructor (`allowlist-resolver.ts:182`); a future programmatic-integration wiring would use this.
  3. `checkResearchPlan(plan, { adapter })` — exported non-throwing validator (`validate-plan.ts:45`).
  4. `runProvenanceGate(plan, ctx, …)` — `research/gates/provenance.ts:58`.
  5. `runResearchValidation(plan, ctx, …)` — `research/gates/report.ts:57` (the high-level aggregator that calls `runProvenanceGate`; the MOST likely entry point for a future programmatic wiring).
  A grep covering ONLY `validateResearchPlan` (the original §6 design) gives a FALSE NEGATIVE: a future wiring-umbrella using any of paths 2-5 would leave the adapter counted unwired (GREEN) while it is actually wired — defeating the anti-forget purpose. The detector greps for ANY `adapter: <adapterSymbol>` reference (object-literal `{ … adapter: X }`, assignment `ctx.adapter = X`, or destructured shorthand) in non-test source, where `<adapterSymbol>` is the imported name (`pipAdapter`, `cargoAdapter`, `npmAdapter`). This catches all five paths uniformly (they all thread the adapter through a `ResolveCtx`).
  **Residual gap (documented):** an adapter wired via dynamic registration with no textual reference to the adapter symbol (e.g. `const a = adapters[i]; ctx = {adapter: a}`) would evade the textual grep. This is the same residual the precondition-test documents (`ecosystem-adapter-precondition.test.ts` "a dynamically-registered adapter shape"). Accepted; if a registry ever lands, add a registry-level assertion.
- **Assertion: `unwired_count === BASELINE` (strict equality, not `<=`).** The `<=` form (original design) does NOT catch silent partial-wiring: a PR that wires cargo (count 1) but leaves BASELINE=2 passes `1 <= 2` GREEN, silently leaving the obligation un-reconciled. Strict `===` makes BOTH failure modes RED: silent growth (count 3, BASELINE 2) AND silent partial-wiring (count 1, BASELINE 2). BASELINE is a literal edited in-lockstep with any count change.
  - **Pre-LG-S4:** BASELINE = 1 (cargo only unwired; npm wired).
  - **LG-S4 (this spec):** BASELINE becomes 2 (cargo + python). LG-S4 does NOT trip the tripwire — it lands at exactly the new baseline.
  - **Future wiring-umbrella:** each adapter wired DECREMENTS BASELINE in the same PR (2→1→0). A PR that wires one but forgets to decrement BASELINE → RED (`count !== BASELINE`).
- **Honest residual (kept):** even with strict equality, the tripwire makes the debt *visible* (the count/BASELINE must be reconciled every PR), it does not make the code *live*. The python adapter remains unwired until the wiring-umbrella. This is the owner's explicit choice (wire both later); the tripwire is the strongest available anti-forget mechanism short of wiring now.

## §7 Scope boundaries (explicit — out of LG-S4)

- **Wiring the adapters into production paths** (LG bridges Tier-0-only; detectStack JS-only) — separate umbrella, python + cargo together.
- **Per-manifest deps-hash staleness** — **SCOPE DEVIATION FROM KICKOFF §2 (recorded owner decision, 2026-07-17).** The kickoff places staleness IN LG-S4; this spec moves it OUT to a separate task. Rationale: the existing `deps-hash-check.sh` (hardcoded to `package.json`, JS-only) runs as a UserPromptSubmit hook requiring Node; a python/rust consumer has no Node at install-time (Model A), so staleness for those stacks needs a bash-only, `.toml`-parsing hook — a distinct piece of work that would inflate LG-S4 by ~0.5 stage. Owner confirmed the move. Recorded in `done.md` gap log + as a follow-on trigger.
- **IR unfreeze (OWNER-FORK-1)**, **js convergence (OWNER-FORK-2)**, **CI live-fire for rust** — kickoff STOP-lines, untouched.
- **`ecosystem-python.ts` making framework rules self-generating** — explicit non-goal (`#recursive-self-application-gap`).

## §8 Integration points (exact)

### §8.1 Documentation deliverables (specification for §9 D6/D7)

- **`INSTALL-FOR-AI.md`** — add a "Python venv convention" note: Tier-1 source trust requires a root-local venv (`<root>/.venv/` or `<root>/venv/`); a system-installed python yields Tier-0 only (no regression, but no Tier-1 derivation). State the supported pyproject forms (PEP 621 single-line `dependencies`, `[project.optional-dependencies]`, Poetry `[tool.poetry.dependencies]` + `[tool.poetry.group.*.dependencies]`) and the known limitations (multi-line arrays/tables unsupported — §4.1).
- **README draft-diff** — maintainer-owned, so PREPARE a draft in the PR body (not a direct edit). Content: a one-line addition under the python-stack section noting that researched rules can derive Tier-1 trust from an installed package's metadata when a root-local venv is present.
- **`done.md`** gap-log entries (D7): (a) wiring gap — both cargo and python adapters are unwired; the LG bridges are Tier-0-only (`research-to-node.ts:183` `firstProvenanceRejection`, `research-to-clippy-node.ts:196` duplicate); `detectStack` is JS-only; wiring both adapters is a future umbrella. (b) staleness gap — see §7 deviation. (c) the multi-line-array/inline-table coverage gaps from §4.1.

- `KNOWN_ECOSYSTEM_PREFIXES` (`packages/core/research/ecosystem-name.ts:22`): add `'pip'`.
- `ecosystem-adapter-precondition.test.ts` (`:90` `hasTraversalGuardSignal` regex): re-arms automatically — the new adapter file MUST carry the traversal-guard textual signal (`isUnsafeDepName` or equivalent `..`+separator reject) or Part A fails.
- `multi-tenant-hosts.json`: `readthedocs.io` already listed (multi-tenant) → many RTD-hosted python docs are Tier-1-ineligible (correct, not a gap to fix).

## §9 Deliverables (LG-S4 scope, final)

1. `packages/core/research/ecosystem-python.ts` — the adapter (Approach D + PEP 508 parser).
2. `packages/core/research/ecosystem-python.test.ts` — full test suite (§5).
3. `packages/core/research/ecosystem-name.ts` — `'pip'` added to `KNOWN_ECOSYSTEM_PREFIXES`.
4. `packages/core/research/ecosystem-unwired-debt.test.ts` — the tripwire (§6).
5. `docs/meta-factory/research-patches/2026-07-16-lg-s4-python-ecosystem-adapter.md` — already landed (the research base).
6. `INSTALL-FOR-AI.md` + README draft-diff (README maintainer-owned → draft in PR body).
7. `.claude/orchestrator-prompts/live-generation/done.md` — umbrella closure + explicit gap records (wiring, staleness) + the owner decision log.
8. `Prior-art:` trailer on the capability commit (SSOT #197 cargo-analog precedent, #219 stack-agnostic core).

## §10 §1.7 self-review (applied to this design spec)

### §1.7 Forward-check applied
Complies with [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) — the adapter REUSES the `EcosystemAdapter` seam (`packages/core/research/allowlist-resolver.ts:133`), `extractHttpsHost`, `parseEcosystemName`; the containment helper `resolvedWithinRoot` and the `isUnsafeDepName` guard are REUSED-BY-PATTERN (re-implemented locally — `ecosystem-cargo.ts:289`'s copy is NOT exported, mirroring how npm/cargo each carry their own private `isUnsafeDepName`); only python-specific parsing (PEP 508, RFC822 METADATA, pyproject TOML subset) is genuinely new. [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) — all probes local (`python3 -m venv`), adapter is pure fs. [research-source-trust.md §5](../../../.claude/rules/research-source-trust.md) — Approach D is designed TO the three invariants; the tripwire (§6) is the class-A compensating mechanism for the documented unwired-debt gap. [doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md) — this spec + the research-patch carry scope annotations.

### §1.7 Backward-check applied
Class of change = third EcosystemAdapter (unwired) + unwired-debt tripwire. **Complete enumeration of sibling surfaces** — split into grep-matched (machinery that textually references adapter/resolver symbols) and manually-added (LG bridges, which import only `validateProvenance`):

**Grep-matched** (`grep -rln "EcosystemAdapter|resolveAllowedSources|npmAdapter|cargoAdapter" packages/core --include=*.ts`, non-test) — 11 files:
- `research/ecosystem-npm.ts` (wired npm) — SWEPT-CLEAN, untouched.
- `research/ecosystem-cargo.ts` (unwired cargo) — GAP-FOUND (pre-existing), caught by tripwire BASELINE 2. NOT modified (N1 finding: `resolvedWithinRoot` stays private; python re-implements locally).
- `research/allowlist-resolver.ts` (`resolveAllowedSources`, `tier1For` at `:189`) — NOT modified; the five wiring paths all thread `ResolveCtx` here.
- `research/allowlist.ts` (re-exports `resolveAllowedSources`, one-arg `validateProvenance` Tier-0 wrapper at `:58`) — unaffected.
- `research/validate-plan.ts` (`checkResearchPlan` at `:45`) — wiring path; tripwire covers.
- `research/gates/provenance.ts` (`runProvenanceGate` at `:58`) — wiring path; tripwire covers.
- `research/gates/report.ts` (`runResearchValidation` at `:57`) — wiring path; tripwire covers. **NOT grep-matched itself** (it imports `runProvenanceGate` but not adapter/resolver symbols directly) — listed separately because it is the high-level aggregator a future programmatic wiring would most likely call.
- `research/load.ts` (Tier-0 path) — unaffected.
- `research/ecosystem-name.ts` (`:22` adds `pip`) — SWEPT-CLEAN.
- `synthesizer/cli.ts` (`:69` wires npmAdapter) + `synthesizer/file-clients.ts` (`:46` wires npmAdapter) — the production npm wiring sites; tripwire counts npm as wired.
- `diagnostics/registry.ts` (imports machinery) — reviewed, no adapter dependency, unaffected.

**Manually-added** (LG bridges — import `validateProvenance` only, not resolver symbols, so not grep-matched): `research-to-node.ts:183` (`firstProvenanceRejection`) and `research-to-clippy-node.ts:196` (duplicate) — GAP-FOUND (Tier-0-only), documented in done.md, NOT fixed in LG-S4.

The tripwire makes the debt visible; one honest residual remains (code unwired until wiring-umbrella — owner's explicit choice).
