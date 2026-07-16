<!-- scope:deps-hash-multistack -->
# deps-hash-multistack DH-S1 — synthesized design-spec (grounded in kickoff #1016 + R-phase, with dual-review refinements)

> **Scope:** the design for the **DH-S1 stage** of the `deps-hash-multistack` umbrella (kickoff [#1016](https://github.com/.../pull/1016), merged). This spec does NOT re-derive the umbrella's architecture — that is FIXED by the merged kickoff §1 + R-phase [`2026-07-16-deps-hash-multistack.md`](research-patches/2026-07-16-deps-hash-multistack.md). This spec is the **DH-S1 implementor's design**: it restates the binding decisions, folds in empirical refinements from a dual (top-down + bottom-up) design review, and sequences the I-phase. I-phase is BLOCKED on maintainer GO. NOT authoritative for project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Status:** DRAFT (post dual-review synthesis) — awaiting GO.
> **Binding sources (do not re-derive):** kickoff §1 (target design), R-phase §1–§5.
> **Date:** 2026-07-17.

---

## §0 Provenance — why this spec exists

An earlier attempt in this session produced a **phantom design** (`-s1`-suffix research-patch + design-spec) that **contradicted** the merged kickoff/R-phase on every decision (composite-single-hash vs per-stack; tomllib-for-rust vs cargo-metadata; JS-deferred vs JS-widened; features-excluded vs features-in; normalized-strings vs table-boundary-bytes). That design never committed and its files are gone. A dual top-down/bottom-up review caught the contradiction (both reviewers independently STOP'd), and an empirical re-verification confirmed the real kickoff #1016 + R-phase are the binding design. **This spec supersedes the phantom entirely** and adopts the real design verbatim, adding only the refinements the bottom-up reviewer *empirically* surfaced (which apply regardless of which extraction approach is chosen, because they are about deps-surface correctness).

## §1 Binding decisions (from kickoff #1016 §1 + R-phase — adopted verbatim)

| # | Decision | Verdict (binding) | Source |
|---|---|---|---|
| **A** | one hook vs three | **ONE hook, stack-detection (Option A)** | kickoff §1 line 23; R-phase §3 |
| **B** | extraction method | **two-tier ladder**: Tier-1 = table-boundary byte-range hash (default, zero deps) over the **6 non-`[project]` tables** (see §4 — `[project]` is C-resolved to Tier-2 only); Tier-2 = toolchain enrichment: python `tomllib` ≥3.11 — **covers `[project].dependencies` + `[project].optional-dependencies` precisely (deps-only, no metadata)**; 3.7-3.10 → silent Tier-1 degrade (`tomli` shim = DH-S3); rust: `cargo metadata --no-deps --offline` (DH-S2) | kickoff §1 lines 24-26; R-phase §2; §3a M3 + §4 D1-C-resolution |
| **C** | storage schema | **per-stack baselines** `deps-hash-npm` / `deps-hash-python` / `deps-hash-cargo`; legacy bare `deps-hash:` read backward-compat as the npm slot | kickoff §1 line 28; R-phase §4 |
| **D** | WARN emission | **one WARN per drifted stack**, through existing `_emit_warn` (L21-27) | kickoff §1 line 29; R-phase §2 |
| **E** | JS surface | **WIDENED**: add `peerDependencies` + `optionalDependencies` + `overrides` + `resolutions` + `pnpm.overrides` to existing `dependencies`+`devDependencies` | kickoff §1 line 30; R-phase §1 |
| **F** | what NOT to hash | **lockfiles** (accepted false-negative), **pnpm v11 `pnpm-workspace.yaml`** (blind spot) | R-phase §5 |

These are NOT re-opened. DH-S1's fork-check (kickoff §2) only fires if the one-hook grows past ~180 lines — a measured size trip-wire, not an architecture re-vote.

## §2 DH-S1 scope (from kickoff §2 — what this stage delivers)

Per kickoff §2, **DH-S1** = architecture fork-check + JS widen + python Tier-1 + storage-model SSOT. **Rust is DH-S2, not here.** Concretely DH-S1 lands:

1. **JS hash surface widened** (peer/optional/overrides/resolutions/pnpm.overrides) — the hook's `node -e` reads all seven fields, merging absent ones as empty.
2. **`pyproject.toml` detection + Tier-1 table-boundary hash** of: `[project]` + `[project.optional-dependencies]` + `[dependency-groups]` + `[tool.poetry.dependencies]` + `[tool.poetry.dev-dependencies]` + all `[tool.poetry.group.*.dependencies]` + `[tool.hatch.envs.*]` dep fields (each if present).
3. **Per-stack baseline storage** `deps-hash-npm` + `deps-hash-python` in `.ai-factory/tool-decisions.md`, with legacy `deps-hash:` read as the npm slot (backward-compat).
4. **SSOT doc updated in the SAME commit** — `.claude/skills/tool-bootstrapping/references/decision-format.md` §2 schema + §3 example land the `deps-hash-{npm,python,cargo}` key names + legacy-compat rule (backward-sweep finding, kickoff §2 deliverable 4).
5. **Response-side doc aligned** — `tool-bootstrapping/SKILL.md` Rule 5 gains a one-line per-stack ack (backward-sweep finding, kickoff §2 deliverable 5).
6. **One WARN per drifted stack** via `_emit_warn`.
7. **Test oracle** — fixtures for JS-widen, python pyproject (node-free), Tier-2 `tomllib` degrade, `@dual-pair` byte-identity for both stacks. TDD RED-before-GREEN (kickoff §3).
8. **Size-gate verdict recorded** (the fork-check output: did the one-hook stay under ~180 lines?).

Bash 3.2-compatible (mirror `setup.d/45-python.sh:85-145` BSD-safe read-loop idiom — no `sed -i`). No new deps. No paid LLM.

## §3 Refinements folded in from the dual review (the synthesis contribution; round-2 review confirmed the load-bearing ones empirically — see §3a)



These are empirical findings the **bottom-up reviewer** proved, that refine DH-S1's implementation. None reverse the binding decisions — they sharpen deps-surface correctness within the R-phase's table-boundary approach.

- **[R1 — poetry meta-key filter is incomplete, R-phase §1 implicitly assumes it]** The R-phase §1 lists `[tool.poetry.dependencies]` as a hash-to surface. Bottom-up reviewer empirically showed a Poetry deps table can carry **non-package meta-keys**: `python` (required-python constraint) AND `source` (a Poetry source-reference). The Tier-1 table-boundary hash hashes the **literal table bytes** (R-phase §2 line 69), so it does NOT need to filter these — a `python = "^3.11"` line inside the table IS hashed, and a change to the required-python constraint *legitimately* is a deps-relevant change (it gates which dep versions resolve). **Synthesis verdict: do NOT filter; hash the whole table.** This is consistent with R-phase's "hash literal bytes, don't interpret" principle and avoids the fragile meta-key-exclusion list. *(This collapses my phantom design's D3 filter entirely — the table-boundary approach makes it unnecessary.)*

- **[R2 — composite-hash slot-collision is moot]** Bottom-up reviewer proved `sha256("a"+"bc") == sha256("ab"+"c")` — a composite single-hash would be non-deterministic across stack-presence shifts. **Moot under the binding per-stack design (§1-C):** each stack is an independent field + independent comparison, no concatenation. No action; recorded so a future maintainer doesn't re-propose a composite.

- **[R3 — workspace double-count is a documented FP, accept]** Under Tier-1 table-boundary hashing, `[workspace.dependencies] serde = "1.0"` + leaf `[dependencies] serde = { workspace = true }` hash serde-related lines twice (two table blocks). This is the *same class* of accepted false-positive as cosmetic-reformat (R-phase §2 line 69): a non-blocking advisory hook tolerates it; Tier-2 `cargo metadata` resolves workspace inheritance and eliminates it when cargo is present. **Synthesis verdict: accept + document in the hook header comment** (which DH-S3 makes explicit anyway, kickoff §2). DH-S1 (JS+python only) is unaffected — this is a DH-S2 (rust) note, recorded here for continuity.

- **[R4 — `python3 tomllib` strict-parse failure mode is catchable]** Bottom-up reviewer confirmed `tomllib.load` raises on malformed TOML and that the one-liner must wrap both `import` + `parse` in ONE try (partial stdout after a mid-run exception is NOT rolled back). **Synthesis action:** DH-S1's Tier-2 python path wraps the full `import tomllib; tomllib.load(...); print(extract(...))` in one `try/except` that prints nothing on any error → empty enrichment → Tier-1 hash stands. Verified implementable (m1 from the review).

- **[R5 — pyproject one-liner IS feasible as `python3 -c`]** Bottom-up reviewer wrote a working 788-char single-quoted one-liner for the 4-surface union. **But under the binding Tier-1 design, DH-S1's python path is table-boundary grep (bash), NOT a python one-liner** — the python one-liner is only the Tier-2 enrichment, and it is shorter (it reads the already-hashed tables, no normalization). **Synthesis verdict:** keep Tier-1 as bash table-boundary grep (R-phase's core insight, verified §below); Tier-2 is a thin python3 `-c` that only fires when `python3`+`tomllib` are present, emitting a normalized string for *comparison* only. Do not ship a `.py` file (would be a lib/ violation).

### §3a Round-2 review findings (empirically re-confirmed this session) — all folded into the design below

The round-2 dual review (both reviewers REVISE) surfaced six load-bearing issues; I independently re-verified each and they hold. They change the design:

- **[B1 — the python Tier-1 matcher is NOT a substring regex.** The §4 regex `^\[.*dependencies` (verified on Cargo.toml) does NOT match three of the seven DH-S1 python tables: `[project]`, `[dependency-groups]`, `[tool.hatch.envs.*]` — confirmed `NO MATCH` for all three. The matcher MUST be an explicit table-name list, not a substring. **Verified working + BSD/macOS-awk-safe matcher (full fired output):** an awk that toggles `in_t` via a `want(header)` function matching the 7 exact headers + two regex globs (`^tool\.poetry\.group\.[^.]+\.dependencies$` for arbitrary Poetry groups; `^tool\.hatch\.envs\.[^.]+$` for arbitrary Hatch envs). On a real pyproject fixture: baseline `sha256-1dcccfe41380e20fcbe990d8e881714c2dba6d493466d7894f51e52af526e8ec`; bumping `requests>=2.0`→`>=2.32` inside `[project].dependencies` → `sha256-b687cbf9b1f85f21d084aaf2a4c9edad76b1e0208e91209ec75c77aca610692b` (drift detected ✓). The I-phase hook uses this matcher verbatim.
- **[D1 — `[project]` whole-table hashing has an FP class → RESOLVED to Option C.** Same matcher, bumping the project's OWN `version = "0.1.0"`→`"0.2.0"` (NOT a dep change) changes the whole-table hash → false drift. The brainstorm this session weighed A/B/D/C and chose **C: exclude `[project]` from Tier-1, cover it precisely (deps-only) via Tier-2 `tomllib`**. See §7 for the full reasoning + empirical proof that C has zero FP AND zero silent-miss (the alternatives each fail on a mass scenario: A=cry-wolf-on-release, B/D=silent-miss-on-multiline-or-extras).
- **[M1 — legacy-key precedence undefined.** `grep -m1 '^deps-hash:'` is anchored and does NOT match `deps-hash-npm:`; a mid-migration consumer with BOTH keys gets the npm slot read against two baselines (double-WARN or shadow). **Fix (in design):** `deps-hash-npm:` wins if present, else fall back to `deps-hash:` — one read, one compare, migration-safe. Stated in §5.
- **[M2 — ZCode JSON does NOT accept two `_emit_warn` calls.** Two JSON objects on stdout → `JSON.parse` throws `Unexpected non-whitespace character after JSON at position 60` (confirmed). The existing ZCode test does `JSON.parse(stdout)` and would break. **Fix (in design):** accumulate all drifted-stack messages into ONE string, emit ONE `_emit_warn` call. CC-plain gets one multi-line `⚠ …\n…`; ZCode gets one `{additionalContext}` with both stacks. Loses per-stack WARN granularity but is harness-safe. Stated in §5 + §6.
- **[M3 — `tomli` (3.7-3.10) shim contradiction.** §1-B cites "tomllib/tomli" (R-phase §2); §6 defers tomli to DH-S3. **Fix (in design):** DH-S1 python Tier-2 = `tomllib` ONLY (≥3.11). Python 3.7-3.10 (python3 present, no tomllib, no tomli) **degrades silently to Tier-1** — documented in §6 as an accepted gap, not a contradiction. The tomli shim lands in DH-S3 (kickoff §2). §1-B's table cell is corrected to "tomllib (≥3.11); 3.7-3.10 → Tier-1 degrade (tomli shim = DH-S3)".
- **[m1 — JS-widen must guard `overrides`/`resolutions`/`pnpm.overrides` by TYPE.** npm allows `overrides` as a STRING (e.g. `"$REACT"` reference); naive `...p.overrides` spread on a string produces integer-indexed char keys `{"0":"$","1":"R",...}` (confirmed — corrupts the hash silently). **Fix (in design):** each widened field guarded `typeof === 'object'` before spread. Working guarded `node -e` (verified): `(k=>(p[k]&&typeof p[k]==='object')?p[k]:{})`. Stated in §5.

## §4 Empirical verification of the DH-S1 matcher — C-resolution (this session, pyproject)

The R-phase's core claim is "Tier-1 table-boundary hashing is deterministic and catches real version changes." Verified this session on the **DH-S1 stack (pyproject.toml)**. The D1 fork (§7) is resolved to **Option C**: `[project]` is **excluded from Tier-1** (its non-dep metadata `name`/`version`/`requires-python` would otherwise cause a cry-wolf FP on every release — proven), and `[project].dependencies` + `[project].optional-dependencies` are covered **precisely** (deps-only, no metadata) via **Tier-2 `tomllib`**. The brainstorm (this session) ruled out: Option A (whole-table — FP on every release, cry-wolf erosion of the advisory signal), Option B (line-scope — silent MISS on multiline arrays), Option D (state-machine sub-scope — silent MISS on PEP 508 extras `pytest[pytest]>=7.0`, proven: `]` inside a dep string prematurely closes the array). C is the only option with **empirically zero FP AND zero silent-miss** on the mass scenarios.

**Fixture** (PEP 621 + PEP 735 + Poetry incl. legacy `dev-dependencies` + a non-`dev` Poetry group + Hatch — the COMPLETE DH-S1 surface):
```toml
[project]
name = "demo"
version = "0.1.0"
dependencies = ["requests>=2.0", "click"]
[project.optional-dependencies]
dev = ["pytest", "ruff"]
[dependency-groups]
lint = ["ruff"]
[tool.poetry.dependencies]
flask = "^2.0"
python = "^3.11"
[tool.poetry.dev-dependencies]
pytest = "^8"
[tool.poetry.group.ci.dependencies]
coverage = "^7"
[tool.hatch.envs.default]
dependencies = ["black"]
```

**Tier-1 matcher** (awk, BSD/macOS-safe — 6 tables, `[project]` NOT among them):
```awk
function want(h) {
  if (h == "project.optional-dependencies")                 return 1
  if (h == "dependency-groups")                             return 1
  if (h == "tool.poetry.dependencies")                      return 1
  if (h == "tool.poetry.dev-dependencies")                  return 1
  if (h ~ /^tool\.poetry\.group\.[^.]+\.dependencies$/)     return 1
  if (h ~ /^tool\.hatch\.envs\.[^.]+$/)                     return 1
  return 0
}
/^\[/ { in_t = want(substr($0, 2, length($0)-2)) }
in_t
```
(extracted exactly 6 blocks; `[[other-nondeps]]` array-of-tables excluded by the `^\[` single-bracket toggle; `[project]` deliberately absent so its metadata cannot leak.)

**Tier-2 enrichment** (`python3 -c tomllib`, ≥3.11 — covers `[project]` precisely): reads `project.dependencies` (array) + `project.optional-dependencies` (dict-of-arrays), hashes `repr(sorted(deps)) + repr({k:sorted(v) for k,v in sorted(opt)})`. No `name`/`version`/`requires-python` in the payload → no cry-wolf. Fails closed (malformed TOML → `tomllib` raises → one `try` → empty Tier-2 contribution, Tier-1 hash stands for the other 6 tables).

**Hashes (full sha256, live re-run this session):**

Tier-1 (6-table, `awk … | shasum -a 256`):
| mutation | hash | drift? |
|---|---|---|
| baseline | `sha256-c728568418a37cbfaeaabadf218d856522cd4b950f3b7b3db99fa2d10853fc12` | — |
| project own `version` `0.1.0`→`0.2.0` | `sha256-c728568418a37cbfaeaabadf218d856522cd4b950f3b7b3db99fa2d10853fc12` | **unchanged ✓** (C-resolved: no cry-wolf) |
| `requests>=2.0`→`>=2.32` in `[project].dependencies` | `sha256-c728568418a37cbfaeaabadf218d856522cd4b950f3b7b3db99fa2d10853fc12` | unchanged → Tier-1 is blind to `[project]` (EXPECTED — that is Tier-2's job) |

Tier-2 (`[project]` deps-only, tomllib):
| mutation | hash | drift? |
|---|---|---|
| baseline | `sha256-f1ba6fd4a057fd2006f589776bc60bb6a6a2916c837fa96ad2012e8d32f51b90` | — |
| project own `version` `0.1.0`→`0.2.0` | `sha256-f1ba6fd4a057fd2006f589776bc60bb6a6a2916c837fa96ad2012e8d32f51b90` | **unchanged ✓** (deps-only payload, metadata excluded) |
| `requests>=2.0`→`>=2.32` in `[project].dependencies` | `sha256-9d156bdef40043636dce1be109863d84435734ecbaff3941d5412bbebf69c072` | **detected ✓** (real dep bump) |

**Confirms the C-resolution end-to-end:** (a) a project release (own `version` bump) does NOT fire either Tier — no cry-wolf; (b) a real `[project].dependencies` bump fires via Tier-2 — no silent-miss; (c) the 6 other tables are covered by Tier-1 as before; (d) PEP 508 extras (`pytest[pytest]`) are safe — tomllib parses them, no bracket-fragility. The combined `deps-hash-python` = a hash over (Tier-1 bytes) concatenated with (Tier-2 dep-arrays) — deterministic, and if `python3`/`tomllib` are absent, Tier-2 contributes "" so the python hash covers only the 6 Tier-1 tables (documented gap, §6).

(The §5 step 1(b) RED test must include a `[tool.poetry.dev-dependencies]` fixture row + a `[project].dependencies` drift row that fires ONLY via Tier-2 tomllib, to prove both tiers.)

## §5 I-phase plan (BLOCKED on GO)

Sequence (TDD RED-before-GREEN per kickoff §3). **Commit topology (one reviewed increment = one commit, after round-2 M2):** commit A = red tests; commit B = hook-source + `.claude/` mirror + `decision-format.md` §2/§3 + `SKILL.md` Rule 5 (SSOT docs + dogfood mirror MUST land with the hook — kickoff §2 deliverable 4 + `@dual-pair` STOP line bind them together, NOT separate commits):

1. **Red tests first** — extend `deps-hash-check.test.ts` with failing assertions for: (a) **JS-widen** — a `package.json` with only `peerDependencies` (and string-typed `overrides` → guarded to `{}`) changes the npm hash vs the legacy 2-field surface; (b) **python pyproject detection** — a `pyproject.toml` with `[tool.poetry.dependencies]` drift produces a `deps-hash-python` WARN, silent on match (Tier-1 6-table path); (b') **`[project]` is Tier-2-only (D1 C-resolution)** — a `pyproject.toml` where ONLY `[project].dependencies` changes fires a python drift **via tomllib Tier-2** (requires `python3` in the test env); and a project own-`version` bump does NOT fire (no cry-wolf); (c) **node-free python lane (split — round-2 M1)** — (c1) `pyproject.toml` + no `node` + no `python3` → python Tier-1 **still hashes the 6 tables via bash + warns on drift** (Tier-1 needs NO toolchain); (c2) no manifests at all → silent exit 0; (d) **Tier-2 degrade** — malformed pyproject → tomllib raises → empty Tier-2 contribution, Tier-1 6-table hash still stands; (e) **ZCode combined-WARN (round-2 M2)** — npm AND python both drift, under `ZCODE_PROJECT_DIR` → ONE valid JSON object with both stacks in `additionalContext` (NOT two objects); (f) **legacy-key precedence (round-2 M1)** — `tool-decisions.md` with BOTH `deps-hash:` and `deps-hash-npm:` → npm slot reads `deps-hash-npm:` (wins); (g) `@dual-pair` byte-identity still holds after the edit. **Also:** widen `buildDepsJson`/`computeHash` test helpers to merge all 7 JS fields (mirrors the hook) so the new assertions compute correct expected hashes.
2. **Hook rewrite** (`packages/core/hooks/deps-hash-check.sh` source) — add: stack-detection; **JS-widen with `typeof === 'object'` guard on each widened field (round-2 m1)**; **python Tier-1 with the §4 explicit-list awk matcher (round-2 B1)**; python Tier-2 (`python3 -c tomllib` in ONE try, ≥3.11 only — 3.7-3.10 silent degrade, round-2 M3); **per-stack storage read with `deps-hash-npm:` precedence over legacy `deps-hash:` (round-2 M1)**; **accumulate all drift messages, emit ONE `_emit_warn` with combined payload (round-2 M2)**. Bash 3.2-safe (BSD awk `~` regex + read-loop idiom from `setup.d/45-python.sh:85-145`). Keep `_emit_warn` byte-unchanged (it already takes one string arg). **Run the kickoff §2 size-gate** (~180 lines; round-2 estimate ~130 lines + python Tier-1 → likely ~150-170, under the trip-wire); record the verdict.
3. **Mirror byte-identically** to `.claude/hooks/deps-hash-check.sh` (**same commit B** — the `@dual-pair` test enforces it; NOT a separate increment).
4. **SSOT docs in the same commit B** — `tool-bootstrapping/references/decision-format.md` §2+§3 (per-stack keys `deps-hash-{npm,python,cargo}` + `deps-hash-npm:`-wins-over-`deps-hash:` precedence) + `tool-bootstrapping/SKILL.md` Rule 5 one-line per-stack ack.
5. **Green tests** — all of §5.1 now pass; the existing 10 tests stay green (verified by tracing: their fixtures have none of the new JS fields, so the 7-field merge is byte-identical to the 2-field merge — `{...undefined}` is a no-op; per-stack scalar fields preserve the existing `deps-hash:` assertions via the legacy-compat read).
6. **Hard-check sweep** (kickoff criteria + this session's): `npm --prefix packages/core run test:principles`, `test:hooks`, byte-drift red-real-drift + green-identical for both stacks, dual-pair byte-identical diff, `tests/install-sh` (delivery seam touched → run it).
7. **Dual-review per increment** (night-mode over SDD): each meaningful increment (tests-red commit A; hook+docs+mirror commit B) gets a top-down + bottom-up reviewer pass before commit, per the user's iterative-review request.

**Out of DH-S1 (DH-S2/S3):** rust detection (DH-S2); `tomli` shim + polyglot integration + install-sh python-seed variant + done.md (DH-S3).

## §6 Risks / honest gaps

- **DH-S1 size-gate could trip** (kickoff §2): if the one-hook exceeds ~180 lines after JS-widen + python Tier-1/2, the recorded verdict routes DH-S2 to the split (Option B). This is by design, not a failure.
- **Tier-1 reformatted-but-identical FP** (R-phase §2 line 69): accepted for an advisory hook; Tier-2 eliminates it when the toolchain is present. Documented in the hook header (DH-S3 makes blind spots explicit; DH-S1 notes it inline).
- **Poetry `[tool.poetry.group.<name>]` requires globbing arbitrary group names** (R-phase §1): the Tier-1 table-boundary awk uses the `^tool\.poetry\.group\.[^.]+\.dependencies$` regex glob (NOT enumerate `dev`/`ci`). I-phase test covers a non-`dev` group (§4 fixture uses `ci`).
- **`[project]` is Tier-2-only (D1 C-resolution, §7):** `[project]` is excluded from Tier-1 and covered precisely (deps-only) via Tier-2 `tomllib`. **Cost:** a consumer with NO `python3` (or 3.7-3.10 without `tomli`) gets no coverage for `[project].dependencies` / `[project].optional-dependencies` — the 6 other tables still hash via Tier-1. **Why accepted:** (a) the alternative (Tier-1 whole-table, Option A) fires a cry-wolf WARN on every project release (own-`version` bump) — erosion of the advisory; (b) the alternative (sub-scope, Option D) silently MISSES dep-bumps inside PEP 508 extras like `pytest[pytest]` — silent-miss is catastrophic for a staleness detector; (c) C is the only option with empirically zero FP AND zero silent-miss (§4 hashes prove it). A Python consumer almost always has `python3` ≥3.11 (the framework's own python lane targets modern Python). `tomli` shim for 3.7-3.10 lands in DH-S3.
- **Hatch env non-dep fields (round-2 m3):** `[tool.hatch.envs.*]` carries `type`/`command`/`skip-install` alongside `dependencies`/`extra-dependencies`; whole-table Tier-1 hashing includes them → a cosmetic `command` change fires a false drift. Same accepted-FP class as the reformatted-but-identical one (R-phase §2 line 69). Documented in the hook header (DH-S3). Could be eliminated by a Tier-2 field-scope enrichment in a later stage; out of DH-S1.
- **Python 3.7-3.10 silent Tier-1 degrade (round-2 M3):** DH-S1 python Tier-2 = `tomllib` ONLY (≥3.11). A consumer on 3.7-3.10 with `python3` present but no `tomli` (fresh venv) gets NO Tier-2 enrichment — Tier-1 bash hash still works. The `tomli` shim lands in DH-S3 (kickoff §2). Documented, not a silent gap.
- **First-run migration for peerDeps-bearing consumers (round-2 M3):** reading the legacy `deps-hash:` key as the npm slot does NOT reconcile the VALUE — the legacy value is a 2-field hash; DH-S1 recomputes a 7-field hash. A consumer whose `package.json` declares `peerDependencies`/`overrides` (common — React libs, ESLint plugins) emits a spurious "deps changed" WARN on first run after upgrade, until re-baseline via `/tool-bootstrapping`. Consumers with none of the new fields are unaffected. **Mitigation (in design):** the WARN text for the legacy-key-but-new-hash case uses the "not yet baselined — run /tool-bootstrapping" wording (the existing unbaselined branch, hook L62-69), NOT the misleading "deps changed" wording — so the first-run nudge is honest.
- **No rust delivery lane exists** (kickoff STOP line): DH-S1 doesn't touch rust; DH-S2 detects `Cargo.toml` only.
- **ZCode multi-stack WARN loses per-stack granularity (round-2 M2):** the combined `_emit_warn` payload means a CC-plain consumer sees one multi-line `⚠` (not two separate `⚠` lines). Accepted — harness-safety (ZCode `JSON.parse`) beats per-stack line granularity.

## §7 D1 `[project]` Tier-1 scope — RESOLVED to Option C

The round-2 review surfaced this fork; it is now **resolved by a maintainer+author brainstorm this session** (not silently picked). The `[project]` table carries non-dep metadata (`name`/`version`/`requires-python`/`description`) ALONGSIDE its dep sub-keys (`dependencies`/`optional-dependencies`). Four options were weighed empirically:

- **Option A (whole-table)** — FP on every project release (own-`version` bump → WARN). Cry-wolf erosion of the advisory signal. **Rejected.**
- **Option B (line-scope `^dependencies=`)** — silent MISS on multiline arrays (`dependencies = [\n...\n]`); the opener line is hashed, the array body (where versions live) drops. **Rejected.**
- **Option D (state-machine sub-scope, multiline-aware)** — silent MISS on PEP 508 extras (`pytest[pytest]>=7.0`): the `]` inside the dep string prematurely closes the array heuristic, dropping deps below it. Same miss-class as B. Proven: on `["pytest[pytest]>=7.0", "requests>=2.0"]` the matcher closes after the first line. **Rejected.**
- **✅ Option C (`[project]` excluded from Tier-1; covered precisely via Tier-2 `tomllib`)** — `tomllib` returns the exact deps arrays (`['requests>=2.0','click']`), no metadata, no bracket-fragility. Empirically proven (§4): own-`version` bump → both Tiers unchanged (no FP); `[project].dependencies` bump → Tier-2 fires (no miss). Cost: a consumer without `python3` ≥3.11 gets no `[project]` coverage (the 6 other tables still covered by Tier-1). Accepted — the alternatives each fail on a mass scenario (releases / extras-strings); C fails only on the rare python3-less-Python-consumer edge case, and partially (6/7 tables still work). **Chosen.**

The I-phase implements C verbatim (matcher = 6 tables; `[project]` deps via tomllib Tier-2). D1 is closed.

---

## §8 Cross-reference: reviewer findings → where addressed

| reviewer finding | severity | addressed at |
|---|---|---|
| B1 wrong python matcher (substring drops 3 tables) | BLOCKER | §3a, §4 (explicit-list matcher, 6 tables after C) |
| M1 legacy-key precedence | MAJOR | §3a, §5 step 1(f), step 2 |
| M2 ZCode two-JSON-objects throws | MAJOR | §3a, §5 step 1(e), step 2, §6 |
| M3 tomli 3.7-3.10 contradiction | MAJOR | §1-B (cell corrected), §3a, §6 |
| D1 `[project]` whole-table FP | DECISION → RESOLVED | §4, §6, §7 (Option C chosen, empirically proven no-FP no-miss) |
| M3 first-run peerDeps migration | MAJOR | §6 (honest-wording mitigation) |
| m1 JS-widen type guard | MINOR | §3a, §5 step 1(a), step 2 |
| m2 buildDepsJson helper stale | MINOR | §5 step 1 (helper widened) |
| m3 hatch env non-dep FP | MINOR | §6 (documented accepted FP) |
| round-1 bottom-up R3 workspace double-count | (DH-S2) | §3 R3 (recorded for DH-S2 continuity) |
