<!-- scope: kickoff — python-backend-v0 umbrella. R-phase base = MT patch (Python column + P2/P5/P6 probes); dispatch = I-phase stages S1-S3. -->

# python-backend-v0 — kickoff

> **Goal of this umbrella:** ship Python as the first non-TS/non-Rust consumer stack of the
> Convention Compiler — `backends/astgrep/` as the PRIMARY render target (per the MT patch P2
> census verdict: native-ruff drop 90.9% as-written / 100% after the R7 correction → NO-GO for
> ruff-as-default; Python enters via the ast-grep escape hatch) plus a narrow `backends/ruff/`
> fast-path for the two import/qualified-name ban rules (TID251/TID253). NOT a goal change —
> serves [README.md#why-this-exists](../../../README.md#why-this-exists); it widens the
> *toolchains* the existing goal covers, exactly as the MT umbrella did for cargo.
> **Owner decisions (2026-07-10, Cowork design dialogue):** (1) scope = ast-grep + ruff fast-path;
> (2) firing is **CI-gated live-fire** (pinned installs — the channel IS reachable for these
> tools, unlike cargo; see §2 S1). The audit findings A12 (separator) and X1 (§1.7-gate paths)
> were both verified ALREADY FIXED by #905 (`enforcement-line.ts:97,103` joins on ` · `;
> `discipline-self-check.yml:23-24` covers `backends/**` + `synthesizer/**`) — no stage needed;
> S3 goldens pin the ` · ` separator so it cannot regress (T-PY-D).
> **R-phase status:** DONE for the architecture — base is
> [research-patches/2026-07-02-multi-toolchain-generalization.md](../../../docs/meta-factory/research-patches/2026-07-02-multi-toolchain-generalization.md)
> (§2 Python column :66-72, P2 census :363-378, P5 ast-grep live-fire :409-423, P6 status-line
> :425-434). Only volatile-fact delta-research remains (§0).

---

## §0 Research base + re-verify obligation

Before any stage dispatch, the executing session MUST re-verify volatile facts **live, not from
training data or from this doc** (T12):

- **ast-grep**: version (0.44.0 at research time 2026-07-02, pre-1.0 — re-check; CLI =
  `@ast-grep/cli` on npm), the machine-readable output of `scan` (**EXPECTED to be a JSON array
  via `--json`, but P5 fired WITHOUT `--json` — this is unverified; confirm the flag, the shape,
  and the identity field before designing the parser**), YAML rule-file conventions
  (`sgconfig.yml` + rules dir vs single file), and the inline-suppression comment syntax.
- **ruff**: current version at ship time (releases ~weekly; 0.15.x era as of 2026-07 — pin the
  exact one), `[lint.flake8-tidy-imports.banned-api]` TOML syntax + TID251/TID253 semantics from
  docs.astral.sh (NOT from memory), `ruff check --output-format=json` shape (identity field for
  the matrix `extractIdentity` — expect `code`; confirm array vs NDJSON), and confirmation that
  per-rule severity is still absent (binary select/ignore — drives the FF7003 degrade path,
  spec §4).
- **Prior-art (build-vs-reuse gate, CLAUDE.md):** SSOT **#185** ADOPTs ast-grep for the **agent
  SEARCH surface only** — its own row states the emission-tier verdict is a distinct problem
  class, and its **trigger (c) («first non-TS/JS consumer stack enters scope — polyglot emission
  tier») fires with THIS umbrella**. Therefore S1 MUST add a **NEW SSOT row evaluating ast-grep
  as a Python rule-EMISSION target** (expected ADOPT — P5 is the live-fired evidence; cite #185
  as the search-surface precedent, #199 as the render-target lineage) in the same commit as the
  S1 artifact. Also NEW rows: **ruff-TID fast-path (expect ADOPT, narrow)** in the S2 commit;
  **mypy (DEFER**, trigger: first `type-aware` Python node demanded by a consumer**)** and
  **import-linter (DEFER**, trigger: first `dep-graph` Python node**)** in the S1 commit whose
  refusal cells cite them. Run the
  [phase-research-coverage.md §1](../../rules/phase-research-coverage.md) checklist on the NEW
  candidates only.
- The L4 validator `engine: 'ast-grep'` seam (`packages/core/validator/gate-rule-tester.ts:87-88`
  deferred-marker) is **#185 trigger (b)** territory (metavar-back-ref forbids) — it does NOT
  fire here and stays deferred (§2 scope boundaries; T-PY-C).

## §1 Target architecture (fixed — do not re-derive)

The MT design is fixed in the
[spec](../../../docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md);
this umbrella adds renderers in the per-toolchain plane ONLY. Load-bearing shape:

- **IR is untouched.** `ConventionNode` fields are frozen (`ir/types.ts:3` — «do not add fields»).
  If a Python need appears to require a new node field, that is T-MT-B / a STOP line — surface to
  owner, do not add.
- **`backends/astgrep/`** — backend name `astgrep-python-yaml`; artifact = ast-grep YAML rule set.
  selectorClass routing: `syntax` → **rendered** (ast-grep has native per-rule severity — map
  `defaultSeverity` directly; NO FF7003 degrade on this path, unlike ruff); `type-aware` →
  **refused FF7001** (mypy is the deferred upstream — SSOT DEFER row); `dep-graph` → **refused
  FF7001** (import-linter deferred). params contract (finalize against the P5 probe shape):
  `{kind: 'call' | 'attribute' | 'import', pattern: string, replacement?: string}` — mirror the
  cargo table-routing shape (`render-clippy.ts:26-40`). Rule `message` = ALWAYS `node.claim`
  (parity with cargo `reason` = claim, `render-clippy.ts:112`).
- **`backends/ruff/`** — backend name `ruff-tidy-imports-toml`; artifact = `ruff.toml` with
  `[lint.flake8-tidy-imports.banned-api]` (+ TID253 for module-level bans). ONLY import /
  qualified-name bans render. Refusal codes follow the cargo semantics split: a well-formed
  `syntax` node whose `kind` is outside the fast-path set → **refused FF7001** (capability gap —
  the astgrep backend is the catch-all); malformed/missing params → **refused FF7002** (params
  contract violation). `type-aware`/`dep-graph` → refused FF7001. Severity: non-default →
  **degraded FF7003** (ruff has no per-rule severity — the exact case spec §4 names; never
  silent).
- **Capability matrix per backend** (`shared/capability-matrix.ts` contract): any cell with
  status ≠ 'no' carries `evidence.kind === 'live-fired'` + runtime-derived toolchain version
  (lesson #899 — no literals) + capturedDiagnostic whose identity matches the firing contract.
  `extractIdentity`: ast-grep → expected `ruleId`; ruff → expected `code` (both confirmed at §0
  re-verify, not assumed). (T-MT-A / T-PY-A.)
- **Firing** (surface-2): per-backend `firing-contract.json` `{command, jsonPath, expectedCode}` +
  3 fixture dirs each (`invalid` / `valid` / `valid-clean`), cloning the cargo layout
  (`backends/cargo/fixtures/firing/`). Canonical fixture convention: ban `datetime.datetime.now`
  (the P5 probe case — ast-grep fires where ruff structurally cannot); `invalid` calls it,
  `valid` routes through an injected-clock accessor + carries the suppression-comment escape
  hatch, `valid-clean` is conformant with ZERO codes. Parser: IF §0 confirms both tools emit the
  same JSON-array shape, a shared array-parse helper in `backends/shared/` is justified (two
  immediate consumers); if the shapes diverge, each backend keeps a local parser — do NOT force
  the hoist. Cargo's NDJSON parser stays untouched either way.
- **DN-4 interplay (audit A13):** render + fire land in the SAME stage per backend — no PR ships a
  backend in the 🟡 rendered-not-fired state.

## §2 Stages (each = one PR onto staging, branch from staging; do NOT collapse)

**S1 — astgrep-backend-v0 (primary).**
Renderer + params contract + `capability-matrix.json` with live-fired evidence + firing fixtures +
`firing-contract.json` + parser (shared or local per §1) + **CI live-fire wiring**: pinned install
per [ci-tool-pinning.md Rule A](../../rules/ci-tool-pinning.md) (`npm install -g @ast-grep/cli@<pin>`)
in the workflow that runs the firing tests. Local run keeps the presence-check + loud-skip shape
(`cargo/firing.test.ts:31-49`) but WITHOUT the `&& !isCI` guard — CI fires for real here (owner
decision; cargo remains the documented exception because its pinned toolchain is unreachable on
the runner at acceptable cost). Tool comes via workflow install, NOT a `package.json` dependency.
SSOT: NEW ast-grep-as-emission-target row (§0) + mypy/import-linter DEFER rows. `Prior-art:`
trailers on all capability commits (new ≥80 LOC files under `packages/`).

**S2 — ruff fast-path.**
`backends/ruff/` renderer (TID251/253 only, refuse the rest per §1 code split) + matrix +
fixtures + firing (`pip install ruff==<pin>` in CI, same Rule-A pattern) + FF7003
severity-degrade parity with spec §4. SSOT: new ruff-TID row in this same commit.

**S3 — composition surface-3 + closure (final).**
Add the Python segment to the demo enforcement line (P6 pattern — template substitution). The
composition gates own this surface: the region claims **FF8001-FF8004** as in MT S4 (#903);
FF8004's enforcement-line check (`enforcement-line.ts:30`) and FF8002's node-in-section-or-excluded
must stay green with the third backend present. New goldens use the ` · ` separator and pin it
(`.toContain(' · ')`) — A12 is already fixed (#905); the pin prevents regression (T-PY-D).
README widening («Rust/cargo next» → Python shipped) is maintainer-owned (Artifact Ownership
Contract) — this stage produces a PREPARED DRAFT DIFF in the PR body for the owner to apply, it
does NOT edit README. The session that merges the S3 PR writes this umbrella's done.md
(CLAUDE.md umbrella-closure convention) — no earlier stage does.

**Scope boundaries:** mypy backend, import-linter backend, `ecosystem-python.ts` (pyproject
`[project]` metadata trust adapter, analog of `ecosystem-cargo.ts` / SSOT #197), the L4 validator
`engine: 'ast-grep'` seam, and any preset-python package are ALL out of scope — post-release,
each behind its recorded SSOT trigger.

**STOP lines (binding):**

- This kickoff MUST be merged to `staging` BEFORE any dispatch
  ([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)).
- NO new `ConventionNode` fields — field-freeze (`ir/types.ts:3`); a blocked Python need is
  surfaced to owner, not schema'd around.
- NO matrix cell with status ≠ 'no' without live-fired evidence in the same PR (T-PY-A).
- NO wiring of the L4 validator ast-grep seam (T-PY-C).
- If CI pinned-install proves flaky in practice, falling back to cargo-pattern dev-machine DoD is
  an OWNER decision — a worker must not silently re-add `&& !isCI`.
- done.md ONLY at the S3 final-PR merge.

## §3 Discipline

- Branch per stage, base `staging`; principle tests green
  (`npm --prefix packages/core run test:principles`); §1.7 Forward/Backward in each PR body —
  mechanically gated for `backends/**`/`synthesizer/**` since #905
  (`discipline-self-check.yml:23-24`).
- This kickoff needs no doc-authority header (filename-convention authority,
  [doc-authority-hierarchy.md §2](../../rules/doc-authority-hierarchy.md)) but satisfies
  principle 12 via §4 below — same rationale as the MT kickoff.
- `Prior-art:` trailer on every capability commit (CLAUDE.md build-vs-reuse invariant).
- Backward-check per [ai-laziness-traps.md T21](../../rules/ai-laziness-traps.md): enumeration
  format, cold sub-agent (`agents/backward-sweep-auditor.md`) for S1/S3 — the sibling surfaces
  here are the OTHER two backends (does the change-class also hold for cargo/npm?).

## §4 AI-laziness traps (principle-12 compliant)

Per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) (trap catalogue) and
§3 (kickoff-author obligations), the traps active for this umbrella:

**Active traps: T1, T3, T5, T11, T12, T13, T15, T16** (one-line why each):

- **T1** — two new matrices × 3 selectorClasses: sampling one cell clean is an artifact; verdict
  every cell explicitly.
- **T3** — every «ast-grep/ruff can(not) express X» claim carries a fired command + output or is
  marked INCONCLUSIVE; no prose-only capability claims (this kickoff itself hit one: the
  JSON-array assumption was demoted to a §0 verify item by cold-review).
- **T5** — stage design steps do not edit unrelated `packages/` code; findings go to the PR body /
  a research patch.
- **T11** — renderer/harness decisions consult the SSOT before any «I propose» (BUILD needs the
  BFR §3 mechanism; the shared parse helper is sanctioned only under its §1 condition).
- **T12** — ruff ships weekly and ast-grep is pre-1.0: §0 re-verify at ship, never from training
  data.
- **T13** — ast-grep is ADOPTED for the search surface (#185), but the EMISSION surface needs its
  own S1 SSOT row + the P1 firing evidence — adoption is not a free pass across problem classes.
- **T15** — the backend that enforces conventions is itself built under this repo's conventions:
  self-application drift test (committed artifact == `render(FIXTURE_NODE)` byte-for-byte, cargo
  `firing.test.ts:73-91` pattern) is mandatory in S1 and S2.
- **T16** — «ruff is a linter like eslint» is a name-match: eslint projects severity natively,
  ruff does not (FF7003 path differs); the two backends' matrices must NOT be copy-pasted from
  npm/cargo shapes.

**Domain-specific traps for this umbrella:**

- **T-PY-A** — «matrix cell ✅ cloned from the cargo matrix shape without firing the PYTHON tool».
  Counter: every non-'no' cell requires a paired RED/GREEN firing run of ast-grep/ruff themselves
  (P5 is the template); evidence captured in `capability-matrix.json`, version derived at runtime.
- **T-PY-B** — «treating the ruff fast-path as the main path because ruff is the famous tool».
  Counter: the P2 census verdict (NO-GO native-ruff default, :363-378) is binding; ruff renders
  ONLY TID251/253-shaped bans; everything else routes to astgrep or refuses honestly.
- **T-PY-C** — «wiring the L4 validator `engine: 'ast-grep'` seam because the name matches»
  (T16 shape). Counter: validator plane ≠ MT backend plane; the deferred-marker
  (`gate-rule-tester.ts:87-88`) stays; that seam is #185 trigger (b), not (c).
- **T-PY-D** — «new composition goldens regress the enforcement-line separator to `, `». Counter:
  A12 was fixed in #905; S3 goldens use ` · ` + a `.toContain(' · ')` pin-test so the old drift
  cannot re-green.
- **T-PY-E** — «a stage declares completeness before hitting all five of its declared surfaces»
  (canonical T4 shape on this umbrella's I-phase): each of S1/S2 owes renderer + params contract +
  matrix + fixtures/firing + CI wiring; S3 owes segment + gates + goldens + README draft diff.
  Counter: cross-check stage output against its §2 surface list before calling it done.

## §5 See also

- [research-patches/2026-07-02-multi-toolchain-generalization.md](../../../docs/meta-factory/research-patches/2026-07-02-multi-toolchain-generalization.md) — R-phase base (§2 Python column, P2/P5/P6).
- [specs/2026-07-03-multi-toolchain-convention-compiler-design.md](../../../docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md) — the fixed MT design (§3 node, §4 RenderOutcome, §5 surfaces, §9 p.12 cross-pollination).
- [../multi-toolchain-convention-compiler/kickoff.md](../multi-toolchain-convention-compiler/kickoff.md) — the parent umbrella this one extends (its done.md closed the MVP).
- `MT-MVP-AUDIT-REPORT.md` (owner's Projects folder) — A12/X1/DN-4 findings this kickoff absorbs (A12/X1 verified already fixed by #905).
- [.claude/rules/ci-tool-pinning.md](../../rules/ci-tool-pinning.md) — Rule A pinned-install pattern for the CI live-fire wiring.
- [.claude/rules/kickoff-staging-placement.md](../../rules/kickoff-staging-placement.md) — merge-before-dispatch discipline.
- [docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) — #185 (ast-grep, search surface; triggers (b)/(c)), #197 (ecosystem adapter precedent), #198/#199 (narrow-core IR + clippy render-target lineage).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
