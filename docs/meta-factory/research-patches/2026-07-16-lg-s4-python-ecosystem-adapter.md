<!-- scope:live-generation -->
# LG-S4 sub-research — ecosystem-python.ts: design of a third EcosystemAdapter under the offline + containment + fail-closed invariants

> **Scope:** the LG-S4 sub-deliverable «`ecosystem-python.ts` Tier-1 adapter (previously conditional)» (kickoff §2). This patch records the design research + a brainstorm of four approaches + live probe evidence, and recommends ONE. It decides nothing strategic — the one OWNER-FORK below (venv-scope) is the owner's call. NOT authoritative for project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Status:** R-phase research-patch. LANDED on `claude/lg-s4-python-ecosystem` for review. Code (the adapter + tests) is a SEPARATE follow-up commit gated on the owner's FORK decision below.
> **Method:** code read against `origin/staging` (`de7fc9d4c` — every `file:line` re-confirmed), the binding invariants read from [.claude/rules/research-source-trust.md §5](../../../.claude/rules/research-source-trust.md), and THREE live probes against a real `python3 -m venv` on Python 3.14.3 (every claim carries a probe result — no prose-only verdict, T3). WebSearch ×3 (PyPA METADATA spec, venv detection, poetry/uv lock files).
> **Date:** 2026-07-16.

---

## §1 The reference contract — what an EcosystemAdapter MUST satisfy (re-confirmed from §5)

Two adapters ship today (`ecosystem-npm.ts`, `ecosystem-cargo.ts`). Both obey the same three invariants, and a python adapter MUST obey them too (they are not JS/cargo-specific — they are the resolver's threat-model bounds, [research-source-trust.md §5](../../../.claude/rules/research-source-trust.md)):

1. **Offline-determinism.** All local fs, **ZERO network, ZERO binary invocation.** cargo-adapter is explicit: it refuses `cargo metadata` shell-out because «shelling out to `cargo metadata` would add an external-process dependency the resolver's offline-determinism invariant forbids» (`ecosystem-cargo.ts:5-7`). ⇒ a python adapter may NOT shell out to `pip`/`python`/`poetry`/`uv`.
2. **Containment (realpath in root).** Any filesystem path derived from a dependency name OR a manifest-declared value MUST lie within the consumer `root`'s OWN realpath, canonicalized on BOTH sides (`resolvedWithinRoot`, `ecosystem-cargo.ts:300-326`). This is the 2nd-BLOCKER fix — a lexical-only check was bypassed by an in-tree symlink. ⇒ a python adapter's reads must stay inside `root`.
3. **Fail-closed (never guess).** Any ambiguity, unrecognized shape, or parse error drops the field/entry (returns undefined/empty), it NEVER guesses a host or a dependency's location (cargo parser contract, `ecosystem-cargo.ts:18-48`). ⇒ no heuristics for «where is the venv» / «which python version».

The seam interface (`allowlist-resolver.ts:133-136`): `{ ecosystem, listDirectDeps(root): Set<string>, readInstalledMeta(root, pkg): InstalledMeta | null }`. The resolver wires ONE adapter per `ResolveCtx` and dispatches by ecosystem-prefix (`ecosystem-name.ts`); a THIRD prefix (`pip:`) lands in `KNOWN_ECOSYSTEM_PREFIXES` alongside this adapter.

## §2 The fundamental asymmetry — why python is NOT a mechanical copy of cargo/npm

| Property | npm | cargo | **python** |
|---|---|---|---|
| Direct-dep manifest | `package.json` (JSON) | `Cargo.toml` (TOML) | **`pyproject.toml`** (TOML) — PEP 621 `[project.dependencies]` AND/OR `[tool.poetry.dependencies]` AND/OR `requirements*.txt` (no single SSOT) |
| Installed package location | `node_modules/<name>/` (in root) | `vendor/`, path-dep, workspace-member (in root) | **`.venv/lib/python3.XX/site-packages/`** — venv name varies (`.venv`/`venv`/`env`), python version embeds in path, may be SYSTEM (outside root) |
| Installed metadata format | `package.json` (JSON) | `[package] homepage/repository` (TOML string) | **`.dist-info/METADATA`** (RFC 822) — `Project-URL: Homepage, …` + deprecated `Home-page:` |
| Registry-resolved deps | `node_modules/<name>` (always in root) | `$CARGO_HOME/registry/…` — **OUT of scope** (cargo gap, documented) | **system/`$VIRTUAL_ENV` outside root** — same class of gap |

**The wall:** there is no `node_modules/`-equivalent that is (a) always inside `root`, (b) at a deterministic path, (c) nameable without version-guessing. cargo hit the same wall for registry-deps and **chose to scope them out** (`ecosystem-cargo.ts:51-60`) rather than guess the cache path. A python adapter faces the same choice, sharper, because venv-location guessing is even less deterministic than a cargo cache hash.

## §3 Four approaches (brainstormed, each falsified or provisionally accepted on probe evidence)

### Approach A — venv `.dist-info/METADATA` via location heuristics

Discover the venv by trying `$VIRTUAL_ENV`, then `.venv/`, then `venv/`, then `env/`, then `python -c 'import site'`. Parse `python3.XX` from the discovered site-packages. Read `<name>-*.dist-info/METADATA`.

- **Violates invariant 1 (offline-determinism):** the discovery chain is a guess ladder. `python -c` is a binary invocation (forbidden). `$VIRTUAL_ENV` is environment-state, not committed-state → non-deterministic across machines.
- **Violates invariant 3 (fail-closed):** «which venv dir» and «which python version» are guesses; a wrong guess silently authorizes the wrong tree (or none).
- **Verdict: REJECT.** This is precisely the «guessing» class §5 items 1/2 defend against.

### Approach B — path-dependencies only (cargo path-dep analog)

`listDirectDeps` reads `[tool.poetry.dependencies] foo = { path = "../foo" }` only. `readInstalledMeta` reads `../foo/pyproject.toml` → `[project.urls]` / `[tool.poetry] homepage`.

- **Satisfies all three invariants** (deterministic, contained, fail-closed).
- **But: ~0 real coverage.** Path-deps in python are rare (most deps install from PyPI). This ships an adapter that almost never derives a host → no user-facing gain over the current Tier-0-only state.
- **Verdict: honest but near-useless.** Equivalent to cargo's registry-dep gap, only narrower.

### Approach C — `listDirectDeps` only, `readInstalledMeta` always null

Read `pyproject.toml` deps for the dep list, but return `null` metadata for every package (Tier-1 never derives a host).

- **Satisfies all three invariants** trivially.
- **But: Tier-1 for python = always miss → python stays Tier-0-only (exactly the current state).** The adapter is a no-op masquerading as coverage.
- **Verdict: REJECT.** `#discipline-theatre` — an adapter that cannot adapt.

### Approach D — root-locked venv, deterministic discovery (RECOMMENDED)

A single **explicit, documented convention**: the venv is inside `root` under a conventional name, and the python-version segment is enumerated (not guessed).

1. `listDirectDeps(root)`: read `root/pyproject.toml` — PEP 621 `[project.dependencies]` (array of `"name>=1.0"` strings) + `[project.optional-dependencies]` + the poetry table `[tool.poetry.dependencies]` (keys, excluding `python`). Normalize names PEP-503 (lowercase, `-`/`_` collapsed). This is the SSOT of the consumer's chosen direct deps — the same role `package.json dependencies`/`Cargo.toml [dependencies]` play.
2. `readInstalledMeta(root, pkg)`: resolve the venv site-packages **inside root only** — `<root>/.venv/lib/python*/site-packages` (and the `venv/` spelling). Enumerate the `python*/` segment by listing actual dirs (no version guess). Find `<normalized-pkg>-*.dist-info/METADATA` by name-prefix match (version is a glob, name is exact-after-normalization). Read + parse RFC 822. If `.venv`/`venv` absent, OR the `python*/` glob is empty, OR no matching dist-info → return `null` (Tier-0 fallback, same as today). **Containment:** the whole read stays under `root`'s realpath via `resolvedWithinRoot`.
3. METADATA parse: `Project-URL: Homepage, <url>` (preferred, per probe) + `Home-page: <url>` (deprecated fallback). RFC 822 line folding unsupported (fail-closed).

- **Satisfies invariant 1 (offline-determinism):** no env var, no binary. `.venv/` discovery is a committed-tree fact, not runtime state.
- **Satisfies invariant 2 (containment):** every read is under `root`; `resolvedWithinRoot` canonicalizes both sides (symlink-safe, same helper cargo uses).
- **Satisfies invariant 3 (fail-closed):** the `python*/` segment is ENUMERATED by listing dirs (one probe dir → one match; a real venv has exactly one — probe §4). No version is guessed; if the dir isn't there, it's a miss. PEP-503 normalization removes the `Django`/`my-pkg`/`my_pkg` ambiguity (probe §5).
- **Coverage:** modern python projects with `.venv/` (uv/poetry/pip-venv default) — work. System-installed python → Tier-0 fallback (NOT a regression — same as today). This is the SAME honest scoping cargo applies to its registry-dep gap.

## §4 Live probe evidence (Python 3.14.3, real `python3 -m venv`)

```text
$ python3 -m venv probe-venv                                     → exit 0
$ ls -d probe-venv/lib/python*/site-packages
probe-venv/lib/python3.14/site-packages                         → EXACTLY ONE python*/ dir
$ ls probe-venv/lib/python*/site-packages/*.dist-info/METADATA
probe-venv/lib/python3.14/site-packages/pip-26.0.dist-info/METADATA
$ grep -iE '^(Name|Project-URL):' .../pip-26.0.dist-info/METADATA
Name: pip
Project-URL: Changelog, https://pip.pypa.io/en/stable/news/
Project-URL: Homepage, https://pip.pypa.io/                     → Homepage label EXISTS in Project-URL
Project-URL: Source, https://github.com/pypa/pip
```

**Confirmed:** (a) a real venv has exactly one `python*/site-packages` (deterministic); (b) `Project-URL: Homepage, <url>` is the live, non-deprecated form; (c) `<name>-<version>.dist-info` naming is stable.

## §5 Edge-case probe evidence (adversarial, before coding)

```text
Edge 1 — multiple python*/ dirs (simulated manual injection):
  mkdir v1/lib/python3.99/site-packages
  ls -d v1/lib/python*/                                        → 2 dirs (3.14, 3.99)
  ⇒ ENUMERATE all python*/ site-packages and search each, do NOT take the first.

Edge 2 — name case (pyproject 'Django' vs dist-info 'Django-5.0'):
  PEP-503 normalize('Django') === 'django'. The dist-info's `Name:` field (inside METADATA) also reads 'Django' → normalize → 'django' → equality match. DO NOT match by directory-name prefix (see Edge 4).

Edge 3 — hyphen/underscore (pyproject 'my-pkg' vs dist-info 'my_pkg-1.0'):
  PEP-503 treats - and _ as equivalent (normalize runs of [-_.] to a single -). normalize('my-pkg') === normalize('my_pkg') === 'my-pkg'. Read `Name:` from the dist-info METADATA, normalize, compare on equality.

Edge 4 — directory-name name/version split is LEXICALLY AMBIGUOUS (spec §4.2 method change).
  A dist-info directory is named `<name>-<version>.dist-info`, but for names containing hyphens or
  digit-leading segments the boundary between name and version CANNOT be determined from the dir
  name alone. Probe (Python 3.14, real + synthesized dist-info, ground truth via importlib.metadata):
    django-stubs-5.0.2.dist-info  → 4 hyphens; name='django-stubs', version='5.0.2'
    foo-1-1.0.dist-info           → name='foo-1', version='1.0'  (name has a digit-leading segment)
    2to3-1.1.10.dist-info         → name='2to3', version='1.1.10' (digit-leading name)
    backports.tarfile-3.2.2       → name='backports.tarfile'
  Best lexical heuristic ("split on first digit-leading segment") resolves 6/7 but FAILS foo-1
  (yields 'foo', truth is 'foo-1'). Ground-truth method (read `Name:` field INSIDE each dist-info
  METADATA, importlib.metadata's approach) resolves 7/7.
  ⇒ readInstalledMeta MUST enumerate every `*.dist-info`, read `Name:` from its METADATA, normalize,
    and match on equality. The directory name is used ONLY for enumeration, NEVER for name extraction.
  Edge case: a dist-info METADATA with NO `Name:` header (malformed) → no match for any pkg → null
  (fail-closed; verified importlib.metadata returns metadata.get('Name') is None).
```

## §6 Integration points (exact, for the code follow-up)

- `KNOWN_ECOSYSTEM_PREFIXES` (`ecosystem-name.ts:23`): add `'pip'`. The resolver's `tier1For` (`allowlist-resolver.ts:188`) already dispatches by `parsed.ecosystem === ctx.adapter.ecosystem` — so the adapter's `ecosystem: 'pip'` + the prefix addition is the complete wiring for prefix routing.
- `ResolveCtx.adapter` wiring: TODAY both production callers (`synthesizer/file-clients.ts:46`, `synthesizer/cli.ts:69`) hardcode `npmAdapter`. cargo is NOT wired into either (it ships as an available adapter exercised by tests, not yet threaded into the synth CLI). **The python adapter follows cargo's precedent: ship the adapter + tests; do NOT wire it into the synth CLI in this stage** (wiring multi-ecosystem selection into the CLI is a separate concern — the synth CLI is currently JS-stack-only by detection). This keeps LG-S4's surface narrow (one new file + prefix + tests), matching the kickoff's «thin adapter» directive.
- `ecosystem-adapter-precondition.test.ts`: the D-tripwire re-arms automatically (it counts adapter impl files via `git ls-files` + the `: EcosystemAdapter =` regex). Adding `pipAdapter` flips the count from 2 to 3 — the existing `≥2` assertion passes; the «every adapter file has a traversal-guard signal» assertion (Part A) will REQUIRE `ecosystem-python.ts` to carry `isUnsafeDepName`-equivalent text, or it fails. **This is by design** — the tripwire enforces the §5 item-2 harden-criterion mechanically. The new adapter MUST have the guard.
- `multi-tenant-hosts.json`: `readthedocs.io` is already listed (multi-tenant) → many python docs sites hosted on RTD will be Tier-1-ineligible and fall to Tier-0/Tier-2. This is correct (RTD is a shared apex) and NOT a gap to fix here — documented for awareness.

## §7 OWNER-FORK (the owner's call — do NOT decide in R-phase)

**FORK — venv-scope of Approach D.** Approach D derives Tier-1 ONLY for packages installed in a root-local venv (`.venv/` or `venv/`). A consumer who installs packages into the SYSTEM python (no project-local venv) gets NO Tier-1 — they fall through to Tier-0/Tier-2 (the current state, no regression).

- **Option D-narrow (recommend):** ship Approach D as scoped above. Mirrors cargo's honest registry-dep gap: «local venv → Tier-1; system install → Tier-0 fallback». Modern python (uv/poetry) defaults to `.venv/`, so coverage is real for the target audience. System-python users are unaffected (no regression).
- **Option D-wide:** additionally probe system site-packages (`site.getsitepackages()` equivalents via heuristic). **Violates invariants 1+3** (the discovery is a guess ladder + may read outside root → breaks containment). Not recommended.
- **Option B (path-deps only):** the safe-but-near-useless variant. Ship only if the owner wants zero venv-discovery surface at all.

**Decider:** the owner picks D-narrow, D-wide, or B. D-narrow is the recommended default — it is the only option that is simultaneously invariant-compliant AND gives real Tier-1 coverage.

## §8 §1.7 self-review

- **Forward-check:** complies with [research-source-trust.md §5](../../../.claude/rules/research-source-trust.md) (Approach D is designed TO its three invariants — offline, contained, fail-closed; Approaches A/C are REJECTED for violating them, named not hidden); [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) (the adapter REUSES the `EcosystemAdapter` seam, `resolvedWithinRoot`, `extractHttpsHost`, `parseEcosystemName` verbatim — only the python-specific parsing is new); [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) (all probes are local `python3 -m venv` + `grep`, zero API); [ai-laziness-traps.md](../../../.claude/rules/ai-laziness-traps.md) T3/T15 (every claim carries a probe result or file:line; the self-application gap is named — this adapter does NOT make framework rules self-generating); [doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md) (scope annotation + folder-authority header present).
- **Backward-check:** class of this change = **design research for a third EcosystemAdapter (no code yet)**. Sibling surfaces where the class must hold: the OTHER two adapters (`ecosystem-npm.ts`, `ecosystem-cargo.ts`) — this patch does NOT claim to change them, only to mirror their invariants (verified: D's containment/offline/fail-closed match §5 item 2's guards). The resolver dispatch (`tier1For`) — NOT modified by this patch (wiring is the code follow-up). The precondition tripwire — correctly predicted to re-arm (§6). Supersedes nothing: the LG kickoff §2's «`ecosystem-python.ts` ONLY if a consumer needs a non-Tier-0 source» is REFINED here into a concrete design with a FORK, not silently overridden — the owner's FORK decision (§7) determines whether the conditional fires.

## §9 See also

- [2026-07-11-live-generation.md](2026-07-11-live-generation.md) §Qc — provenance tiers, `#allowlist-as-code-not-data`, the deferred `ecosystem-python.ts`.
- [.claude/rules/research-source-trust.md](../../../.claude/rules/research-source-trust.md) §4-§5 — ecosystem-prefix parsing (shipped) + defence-in-depth invariants (binding).
- [`packages/core/research/ecosystem-cargo.ts`](../../../packages/core/research/ecosystem-cargo.ts) — the closest reference adapter (TOML parse, path-dep resolution, `resolvedWithinRoot`, the documented registry-dep gap that Approach D mirrors).
- [`packages/core/research/ecosystem-adapter-precondition.test.ts`](../../../packages/core/research/ecosystem-adapter-precondition.test.ts) — the tripwire that will mechanically enforce the traversal guard on the new adapter.
- PyPA «Recording installed projects» — the `.dist-info/METADATA` spec (Approach D's read target).
