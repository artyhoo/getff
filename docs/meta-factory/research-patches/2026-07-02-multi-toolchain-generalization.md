<!-- scope:multi-toolchain-generalization -->

# 2026-07-02 — Multi-toolchain generalization: {toolchain, stack} rule-artifact research

> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists).
> This patch is R-phase research + a design sketch subordinate to README; §9 (v0.2) supersedes
> the stronger claims of §8 after a 4-angle adversarial review.

> Session context: Cowork maintainer session (Art + Fable), 2026-07-02. R-phase research done
> EARLY and in parallel with the code chain trust-tiers S1→S2 → diagnostics D1→B (see
> [specs/2026-07-02-diagnostics-core-design.md §6/§9](../superpowers/specs/2026-07-02-diagnostics-core-design.md))
> — it touches zero code files, informs B's gate split, and de-risks the generic frame before
> any abstraction is coded. Method: 3 parallel deep-research threads (Rust; Go/Python/Java
> breadth; cross-language engines), every claim fetched from primary sources; same-session
> validator-architecture research (rustc/tsc/ESLint/Biome/clippy/ajv/zod) recorded in the spec.

## §0 Verdict (one screen)

- **The `{toolchain, stack}` generalization is viable as data.** Every surveyed toolchain has a
  declarative forbid mechanism + machine-readable diagnostics + a firing-test path. The L4
  grammar (single-file forbid + reason + optional replacement + mandatory firing test)
  generalizes WITHOUT generating compiled code — with explicit capability caps per toolchain.
- **The native-vs-universal fork resolves to a HYBRID, because it is not symmetric across
  languages:** native-config renderers are the primary backend (type-aware where native linters
  are, zero new binaries, runs inside each ecosystem's existing pipeline); **ast-grep** is the
  universal escape-hatch backend (MIT, offline, single binary, 26 tree-sitter languages,
  built-in valid/invalid test harness) for grammar elements a native data-config cannot express.
  For TS the native path is cheap (ESLint first-class); for Rust the native path caps out fast
  (clippy.toml cannot define new lints; dylint = compiled dylibs against unstable rustc
  internals) — exactly where ast-grep is cheapest.
- **Semgrep is excluded as a shipped backend:** registry rules re-licensed Dec 2024 (internal
  use only, no competing products → Opengrep fork), CE engine is the single-function tier.
  SSOT #155 (gate-design precedent, `--test` paired annotations) stands unchanged.
- **Worst fit found = Python/ruff** (closed rule vocabulary, no plugin escape hatch, no per-rule
  severity) — it stress-tests the abstraction and forces the capability-matrix + fail-closed
  degradation design (§4).
- **No prior art for the generation layer itself:** trunk.io / MegaLinter / qlty select, pin and
  run existing linters; none authors rule content. Generation stays BUILD; runners are
  complementary downstream.
- **Scope is the FULL layer cake, not lint rules only** (maintainer correction, 2026-07-02): a
  consumer on any language gets every framework layer — generated rules, generated AI-docs,
  docs-as-tests, drift probes. §4.5 covers the executable-docs layer. **Two market niches found
  empty, and both are exactly getff's product:** (a) JS/TS has NO native output-verified doctest
  (Rust/Go/Python all do); (b) AGENTS.md (60k+ repos, Linux Foundation AAIF) is deliberately
  schema-free with ZERO executable claims — nothing asserts an AI-doc stays true. Executable
  AI-docs is an unoccupied position.

## §1 Problem

The maintainer direction (2026-07-02): the framework must work for any language/stack —
parametrization rises one level, from `{stack}` inside the npm toolchain to
`{toolchain: npm|cargo|go|maven|…, stack}`, Rust first, entered immediately after the
S1→S2→D1→B chain ships. The generic frame is deliberately designed on three data points
(L4 + B + Rust pipeline) — but its R-phase had zero recorded research: no evaluation of what a
"generated executable rule" even IS outside npm, and the strategic fork «render to native
configs vs adopt one cross-language engine» was unexamined. Coding B or the Rust pipeline
without this research risks `#own-stack-blind-spot` and a wrong-abstraction generic frame.

**Root cause:** not a failed checklist item — a proactively closed gap: phase-research-coverage
§1 applied BEFORE the umbrella exists (the trigger was the maintainer direction, not an
incident). **Solution:** this patch (research layer) + the north-star invariants in §4 +
draft SSOT rows in §5; the spec §9 records the scheduling.

## §2 Per-toolchain capability matrix

| | TS (ESLint) | Rust (clippy + cargo-deny) | Go (golangci-lint) | Python (ruff) | Java (PMD / Checkstyle) |
|---|---|---|---|---|---|
| Declarative forbid | ✅ `no-restricted-syntax`/`-imports` (full esquery selectors); custom rules = JS code (ours are generated declaratively, R14-R20 migration) | ✅ `clippy.toml` `disallowed-methods/-types/-macros/-names` (`path` + `reason` + `replacement`); `cargo-deny [bans]` for dependency-level | ✅ `forbidigo` `{pattern, msg}` regex (type-aware with `analyze-types: true`); `depguard`/`gomodguard` import bans | ⚠️ closed vocabulary: `banned-api` (TID251) + `banned-module-level-imports` (TID253) only; no plugin escape hatch | ✅ PMD ruleset XML + XPath 3.1 (`pmd-java:matchesSig(...)` — type-aware); Checkstyle `IllegalImport` XML |
| Type-awareness | ✅ typescript-eslint type-checked rules | ✅ full rustc types (but see caps) | ✅ opt-in | syntax-level | ✅ PMD XPath semantic functions |
| Known caps | — | no per-impl trait-method bans; no higher-order calls ([#8849](https://github.com/rust-lang/rust-clippy/issues/8849)); no generic-instantiation match; clippy.toml officially «unstable, may be deprecated» | regex-based (identifier shape) | vocabulary cap; **no per-rule severity at all** (binary select/ignore) | Checkstyle method-calls only via line-regex (type-blind); ArchUnit = code (rejected shape) |
| JSON diagnostics | ✅ ESLint JSON | ✅ `cargo clippy --message-format=json`, stable code `clippy::disallowed_methods` | ✅ `json`/`sarif`/`checkstyle` output formats | ✅ `json`/`sarif`/`rdjson` | ✅ PMD `json`/`sarif`; Checkstyle `xml`/`sarif` |
| Firing-test path | ✅ RuleTester (ours, SSOT #154) | fixture crate + `rust-toolchain.toml` pin + JSON assert on diagnostic code | run on fixture + JSON assert (`analysistest // want` exists at analyzer level) | run on fixture + JSON assert | ✅ **PMD declarative test XML** (`expected-problems`/`-linenumbers`/`-messages`, positive+negative prescribed) |
| Severity model | ✅ off/warn/error | ✅ `[lints.clippy]` in Cargo.toml (stable 1.74) | ✅ `severity.rules` + `//nolint` | ❌ none (exit 0/1/2 only) | ✅ per-module severity / priority 1-5 |
| Detector primitive | package.json (ours) | `cargo metadata --format-version 1` (workspace_members JSON) | go.mod | pyproject.toml | pom.xml / gradle |

Universal backend: **ast-grep** — YAML rule-as-data (`id/rule/constraints/fix/severity/message`),
all five languages among 26, `ast-grep test` with `valid:`/`invalid:` cases classified
Validated/Noisy/Missing (our paired-negative invariant, native), `scan --json`, LSP for the
edit-time channel, MIT, offline, deterministic. Hard limit **stated by its own docs**: syntax
only — no type info, no dataflow → «forbid method X *on type Y*» is faithfully expressible only
in native type-aware linters. Risks: pre-1.0 (v0.44.0), effectively single-maintainer.

## §3 Mechanism steals (what the beast is assembled from)

zod dual-API (throw/report over one issues[] — shipped in D1) · tsc single message registry with
range-allocated append-only codes (D1 FF-registry) · rustc `reason`/`replacement`-carrying
diagnostics + `Applicability` trust-enum on fixes · clippy lint-tier policy (deny-by-default tier
must be FP-free ≙ our trust-tiers) · PMD firing-test-as-declarative-XML (proof the firing test
itself can be data) · ast-grep valid/invalid harness with Noisy/Missing classes · SonarQube
any-condition-fails gate with structured reasons · SARIF 3-field skeleton as import/interchange
shape (GCC 16 now emits it natively) — adopt the skeleton, never the full spec.

## §4 Design invariants (stable across toolchains; the generic frame implements these)

1. **Grammar SSOT:** the rule exists once, in OUR grammar (research→synthesis plane); per-
   toolchain **renderer ports** emit native configs (eslint config / clippy.toml + deny.toml /
   golangci yaml / ruff toml / PMD xml) — thin, data-to-data.
2. **Capability matrix, fail-closed:** each renderer DECLARES which grammar elements it can
   express (yes/partial/no — §2 rows). An inexpressible rule degrades explicitly with an
   FF-coded diagnostic («not expressible in {toolchain}»), optionally routed to the ast-grep
   fallback renderer — never silently dropped, never silently approximated.
3. **Artifact = data, not compiled code.** dylint/ArchUnit/hand-written plugin paths are
   rejected for generated artifacts (toolchain-coupled compiled objects violate the
   deterministic no-LLM factory and add per-rule maintenance surface).
4. **Firing-test contract per toolchain:** run the native linter on a seeded-negative fixture,
   assert the diagnostic code in JSON output; paired positive fixture stays clean. The harness
   spec is itself data: `{command, jsonPath, expectedCode}` per toolchain.
5. **Diagnostics converge into the D1 model:** per-tool JSON → `Diagnostic[]` adapters; FF codes
   are the cross-toolchain contract; severity is a per-toolchain rendering detail (ruff has
   none), the gate policy is ours (severity ≠ gate).
6. **Toolchain pinning is data:** `rust-toolchain.toml`, lockfiles, pinned linter versions —
   extends [ci-tool-pinning.md](../../.claude/rules/ci-tool-pinning.md) discipline; firing tests
   are deterministic only under a pinned toolchain.
7. **Provenance tiers ride the S1 ecosystem-adapter seam** (trust-tiers kickoff §5 S1): registry
   metadata per ecosystem (crates.io, PyPI Trusted Publishing already in kickoff §3 row 2).

## §4.5 Executable-docs layer (docs-as-tests · AI-docs · drift) — 4th research thread

The framework's other consumer-facing layers generalize too, and the ecosystems again hand us
the mechanisms («gems»):

| | Rust | Go | Python | JS/TS | Java |
|---|---|---|---|---|---|
| Docs-as-tests (native?) | ✅ **rustdoc doctests, on by default** (`cargo test --doc`): auto-wraps `fn main`, hidden `# ` lines split reader-view from compiler-view; `compile_fail` = negative doctest; README testable via `#[doc = include_str!]`; `mdbook test` for books | ✅ `Example*` funcs run by `go test`, output asserted vs `// Output:` comment; **trap: missing `Output:` = compiled but silently never run** | ✅ stdlib `doctest` + `pytest --doctest-modules`; exact-string match = brittle (ELLIPSIS/NORMALIZE escapes) | ❌ **gap ecosystem**: twoslash (compile+type-assert only, powers typescriptlang.org), markdown-doctest (no output assert), `@eslint/markdown` (lints md code blocks) | ~ JEP 413 `@snippet` renders file-region slices; validation **deliberately delegated** to build (snippets live in `src/test/java` → JUnit) |
| Docs↔code binding | doctest lives IN the `///` comment of the item | **name convention IS the binding** (`ExampleT_M` → symbol page) | docstring of the object | none standard | `{@snippet file=… region=…}` anchors |
| Drift detection | doc example stops compiling → test fails | output drift → test fails | exact-match (oversensitive) | embedme/embedmd `--verify` in CI | region rename breaks javadoc build |

Transferable design rules for the generated executable-docs layer:

1. **Assertion tier ladder, declared in the doc source:** Rust `compile_fail → no_run → run →
   should_panic(+E-code)`; Go `compile-only → Output → Unordered`. Generated doc-claims declare
   their verification tier; a tier downgrade is a reviewable diff. **Design out Go's trap: a
   silent tier downgrade (unverified example) must be loud** — that trap is literally
   `#discipline-theatre` at the docs layer.
2. **Bind docs↔code by machine-parseable anchor, not prose** (Go name convention, JEP 413
   regions): every generated AI-doc convention paragraph carries a rule-ID/symbol anchor a test
   resolves; dangling anchor = CI failure (principle-08 broken-ref pattern, generalized).
3. **Assert predicates, not transcripts** (Python doctest's brittleness vs Rust's
   compile+assert): transcript match is an opt-in strict tier only.
4. **Preprocess-to-lower-friction is the product** (rustdoc injects main/imports/allow-lints):
   the generator emits complete compilable artifacts from fragmentary pedagogical snippets.
5. **Target existing test harnesses per toolchain** (JEP 413's honest split: doc tool renders,
   build validates) — cargo/pytest/go test/JUnit run the generated doc-tests; we build no runner.
6. **The negative space is testable** (`compile_fail`, twoslash `@errors:`): every «don't do X»
   doc-claim generates a fixture that fails the right way — our paired-negative invariant, found
   living natively at the docs layer.

AI-docs conventions to target as render formats: AGENTS.md (LF-governed, schema-free,
nearest-file-wins), CLAUDE.md (`@`-imports), `.cursor/rules` (globs), llms.txt (~10% adoption,
site-level). None executable today — that is the getff wedge, not competition.

## §5 Draft SSOT rows (finalize + re-verify at umbrella time; volatile facts marked)

- **ast-grep as rule-artifact backend** — NEW row (distinct problem-class from #185
  agent-surface ADOPT): lead **ADAPT** (escape-hatch renderer, not sole backend — syntax-only
  cap). Volatile: version/maturity (pre-1.0 at research time).
- **Semgrep as shipped backend** — lead **REJECT** (Rules License v1.0 internal-only; CE =
  single-function tier; re-license precedent → Opengrep fork). #155 gate-precedent ADAPT stands.
- **dylint / rust-marker** — lead **REJECT for artifacts** (compiled, toolchain-coupled,
  rustc_private instability) / REFERENCE for expressiveness ceiling.
- **clippy `disallowed-*` + cargo-deny `[bans]` + `[lints]` table** — lead **ADOPT** as the Rust
  renderer target. Volatile: clippy.toml stability disclaimer.
- **golangci forbidigo/depguard; ruff banned-api (with caps); PMD XPath + test-schema** — lead
  **ADOPT / ADOPT / ADAPT** respectively; PMD test-XML additionally REFERENCE for
  firing-test-as-data.
- **trunk.io / MegaLinter / qlty** — **REFERENCE** (runners, zero generation overlap → confirms
  BUILD verdict for our generation layer).
- **OpenRewrite** — REFERENCE only (OSS = JVM-only; JS/TS/Python are proprietary Moderne).
  #156 RewriteTest ADAPT stands.
- **rustdoc doctests + `compile_fail`; Go testable Examples; JEP 413 snippet-regions** — lead
  **ADAPT** (mechanism vocabulary for the generated executable-docs layer, §4.5): tier ladder,
  anchor binding, negative doctests. Volatile: `compile_fail,E-code` pinning is nightly-only.
- **twoslash** — lead **ADAPT** for TS doc-samples (compile+type assertions; no runtime tier).
- **embedme/embedmd `--verify`; Doc Detective** — **REFERENCE** (drift-verify CI pattern).
- **AGENTS.md format (LF AAIF)** — lead **ADOPT as render target** (format, nearest-file-wins
  precedence), while the executable layer on top is ours (empty niche, §0). Volatile: standard
  governance is new (Dec 2025).

## §6 Open questions → generic-frame kickoff (NOT decided here)

1. clippy.toml official instability — mitigation: per-toolchain snapshot-oracle (generate-first
   §9 pattern) or renderer version-pin discipline?
2. Python vocabulary gap — ast-grep fallback vs rule-drop-with-diagnostic: product call on how
   much Python coverage matters at entry.
3. Does the grammar need declared **capability tiers** (pure-syntax selectors vs type-aware
   selectors) so a rule states upfront which backends can honor it?
4. `single-token-diff` gate portability per toolchain (autofix semantics differ).
5. Where multi-toolchain enters trust-tiers S4 (ecosystem adapters) vs its own umbrella —
   sequencing call at kickoff time.
6. Which layers ship per toolchain at entry (rules only vs rules + executable AI-docs vs full
   cake) — product call; §4.5 shows the docs layer is cheapest where doctests are native
   (Rust/Go/Python) and hardest exactly where the market gap is (JS/TS).

## §7 Competitive check — AI rule generation + living documentation (5th thread, 2026-07-02)

**Q: does anyone AI-generate rules like us, on other languages? A: neighbors exist, the exact
product does not.**

- **Packmind** (ex-Promyze) — closest competitor: prose practice + ≥1 negative example → AI
  generates *deterministic JS detection programs* → CI-blocking gate, multi-language. Stops
  short on every getff differentiator: hand-curated input (no researched-docs corpus, no
  provenance), proprietary output run by their CLI (not native ecosystem artifacts),
  LLM-in-the-loop at generation (no reproducible factory), single-file only, Enterprise-gated.
  (docs.packmind.com/linter)
- **Semgrep Assistant/Multimodal** — NL → real multi-language Semgrep YAML; security-guardrail
  scoped, platform-locked, prompt-driven not corpus-driven. **ast-grep** officially ships an
  agent rule-writing loop (generate→test→search) — a mechanism, not a product.
  **Autogrep/QLCoder** — CVE-patch domain. **SonarQube AI CodeFix** — fixes, not rules.
  **CodeRabbit** — consumes CLAUDE.md/AGENTS.md as LLM review context (probabilistic,
  review-time); "learnings" are prose, not artifacts.
- **Living documentation realized:** only code→docs freshness (Swimm smart-tokens CI gate;
  OpenAPI/terraform-docs/Storybook) and docs→behavior (Cucumber/Concordion/Reqnroll; Doc
  Detective for UI procedures). SpecFlow+LivingDoc — the segment flagship — hit EOL 2024,
  closed-source, only now rebuilt in Reqnroll v3: the niche is under-served even for behavior.

**Seven confirmed NOBODY-does gaps:** (1) docs-corpus → native linter artifacts; (2) provenance
chain source→rule; (3) deterministic (LLM-free) factory; (4) executable AGENTS.md/CLAUDE.md-class
conventions; (5) prose *convention/structural* claims asserted against code (BDD asserts
behavior, Swimm asserts reference freshness); (6) earliest-channel cascade for doc-derived rules
(all competitors are CI/review-time only); (7) one convention corpus emitting into multiple
toolchains. Packmind's existence is *demand evidence* (enterprises pay for practice
enforcement), not occupation of this position.

## §8 General architecture sketch — the Convention Compiler (v0)

The most general shape, stated once (the future MT-kickoff designs against this; it is a sketch,
not a binding spec):

**getff is a compiler for conventions.** Classic three-stage shape (the LLVM lesson: N×M×K
becomes N+M+K through one IR):

1. **Frontends — knowledge acquisition.** Produce IR from: (a) live research over tier-trusted
   docs (trust-tiers S1-S4, per-ecosystem registry adapters); (b) maintainer-authored
   conventions; (c) future: captured conventions (incidents, review feedback). LLM allowed ONLY
   here, always behind provenance gates (fetch+quote, taint banner).
2. **IR — the Convention grammar (the SSOT).** One node ≈
   `{id, claim (human prose), anchors[], selectorClass (syntax | type-aware | dep-graph |
   doc-level | process), params, defaultSeverity, provenance[], capabilityTier, pairedExamples
   {positive, negative}}`. Today's ResearchEntry/SynthesisPlan grammar is the embryo of this IR;
   presets = frozen IR snapshots (generate-first §9 oracles). Grammar-level gates run HERE, once,
   toolchain-independent: schema, tautology, conflict, coverage.
3. **Backends — per-{toolchain} renderers, each declaring a capability matrix over
   selectorClasses (fail-closed on inexpressible, ast-grep escape hatch), each emitting up to
   FIVE surfaces from the same IR node:**
   - **rule** (eslint config / clippy.toml+deny.toml / golangci / ruff / PMD / ast-grep YAML);
   - **firing test** (contract `{command, jsonPath, expectedCode}` + paired positive — borrowed
     runners: RuleTester / cargo clippy JSON / go test / pytest / JUnit; we build no runner);
   - **AI-doc** (AGENTS.md/CLAUDE.md section carrying the node's machine anchor — rule-ID links
     paragraph ↔ artifact);
   - **doc-test** (rustdoc/Go Example/pytest-doctest/twoslash wrapper where native, §4.5 tier
     ladder);
   - **wiring** (hooks/CI at the toolchain's earliest reachable channel).
4. **Diagnostics** — the D1 model (FF codes) is the IR-level error language; per-tool JSON maps
   into it (adapters). **Lifecycle** — install/lock/drift/regenerate + staleness markers + diff
   budgets vs snapshot oracles.

**The unification theorem of the design:** the AGENTS.md paragraph, the clippy.toml entry, and
the firing test are **three renders of one IR node** — doc↔rule↔test drift becomes impossible
*by construction* (single source), and «living documentation» stops being a separate feature:
it is the doc surface of the compiler. This is what no competitor has (§7 gaps 4-5-7 collapse
into this one property).

**Implementation = generalize, don't rewrite** (maintainer framing): today's L1-L5 pipeline IS
the npm backend + npm frontend already; the chain S1→S2 (frontend seams) → D1 (IR error model)
→ B (IR-level gates) each moves one plane into place; the MT-kickoff then (a) names the IR
explicitly (extract grammar types), (b) ships the cargo backend v0 (clippy.toml renderer +
firing harness), (c) lets the generic frame emerge from three real backends — never designed
speculatively.

## §9 Architecture v0.2 — adversarial-review revision (2026-07-02; supersedes §8's strong claims)

Method: 4 parallel adversarial angles (systems-skeptic, cross-pollinator, solo-pragmatist,
discipline-auditor) + a 5th synthesizer-opponent adjudicating contradictions. Key ground truths
verified in-repo: `synthesizer/types.ts:15` already carries the renderer-engine enum;
`INSTALL-FOR-AI.md:301-316` sanctions consumer edits + `--refresh` is stateless (no hash stamp);
`README.md:8` still pins the product to TS/React.

**v0.2 statement (what survives):**

1. NOT an LLVM. **Narrow-core IR + per-backend capability negotiation** (the WASM/LSP survivor
   pattern; union-shaped universal IRs die — UAST, github/semantic, LSIF). The capability matrix
   IS the architecture.
2. IR v0 node: `{id, claim, anchors[] (FF-rule-ID namespace ONLY), selectorClass:
   syntax|type-aware|dep-graph, params, defaultSeverity (rendering detail), provenance[],
   pairedExamples{positive,negative} (MANDATORY)}`. **`doc-level|process` descoped** from the v0
   enum — non-goal until a named **self-hosting milestone** (the repo's principle-test/hook
   infrastructure already IS that backend on a different substrate; gluing substrates at v0 =
   union-IR death).
3. Backends return per-node `RenderOutcome ∈ {rendered | degraded(FF) | refused(FF)}` +
   end-of-render assert (ErrorGuaranteed reduced to a cheap discipline). Nothing silent —
   including severity loss on ruff.
4. rule + firing test = per-node projections; **AI-doc = composition over node SETS** (not 1:1),
   every rendered paragraph carries anchor + enforcement-status line («Enforced: eslint ✅ ·
   clippy ✅»). doc-test + wiring = negotiated extensions, cut from MVP.
5. **6th surface named: lockfile/detector** — fenced framework-owned blocks inside
   consumer-owned files + per-surface hashes. Honest claim: **«drift is detected within one
   regenerate cycle»** — never «impossible» (consumer edits are sanctioned by our own authority
   model). First post-MVP milestone; the current npm product already has this gap.
6. «Executable AI-docs» = every convention paragraph resolves **transitively** (anchor → rule →
   firing test); no doc-claim runner is built — the flagship niche survives without it.
7. LLM-free CI holds under two now-explicit pins: regeneration is session-side only; renders are
   pure template substitution, all inputs IR-resident at frontend time.
8. Python enters via **ast-grep escape hatch by default** (resolves §6 Q2 — 50-70% loud
   rule-drop is product death); ship-toolchain threshold set empirically by probe P2.
9. Suppression-as-IR-object + shrink-only baseline → brownfield milestone; `--bless` blessing →
   snapshot-oracle milestone.
10. **Four tier vocabularies, four names** (fix before MT-kickoff): provenance-tier (S1/S2
    sources), confidence-tier (clippy-style FP-contract per rule), capability-class (selector
    expressibility), assert-tier (doc-test ladder).
11. README widening (TS/React pin → multi-toolchain) is a **deliberate maintainer edit**,
    prerequisite to treating MT as product scope (Artifact Ownership Contract).

**Probes before trusting v0.2:** P1 reverse-compile own CLAUDE.md into IR nodes (measures the
real 1:N doc ratio; validates/kills the composition design). P2 corpus expressibility census
(R1-R20 + generated × 5 toolchains × selectorClass — sets Python go/no-go). P3 anchor
round-trip (mutate a rendered fenced block; prove today's tooling detects nothing → surface 6 is
load-bearing). P4 Rust firing spike (pinned toolchain, `{command, jsonPath, expectedCode}` as
data). P5 ast-grep fallback on one real ruff-inexpressible case. P6 status-line render = pure
template substitution (pins the LLM-free claim).

**Dissent recorded:** synthesizer sided with the skeptic over the auditor on descoping
doc-level/process (vs building backends for them) — dogfood demand survives as the scheduled
self-hosting milestone, not a v0 blocker.

12. **Cross-pollination invariant (maintainer directive, 2026-07-02):** when toolchain X lacks
    a mechanism, the backend ports the best-of-class mechanism from another ecosystem instead
    of dropping the capability. Instances already fixed: ast-grep fills the Rust/Python
    declarative-rule gaps; Go's Output-tier ladder + rustdoc `compile_fail` generalize into
    `assertTier` for all doc-test backends; PMD's test-XML shape becomes every toolchain's
    firing-test-as-data contract.

**§9.1 Invention gaps — NO ecosystem has these; getff builds them (cross-pollination round; do
not lose):** (a) **LLM-taint as a typed IR property** — which artifacts passed through an LLM,
taint gate at the frontend boundary (nearest partial: in-toto attestations; Packmind = the
anti-example); (b) **convention lifecycle as data** — promotion/demotion/retirement with
evidence triggers, the repo's own Class A/B/C practice exported to consumers (nearest: clippy
nursery→stable, manual); (c) **dead-convention detection** — rule never firing across the
consumer corpus in N months = retirement signal (nearest shape: knip/deptry, ESLint
`--report-unused-disable-directives`); (d) **unified suppression discipline** — one suppression
object rendering to `//nolint` / `# noqa` / `eslint-disable` + one unused-suppression audit;
four ecosystems converged on self-auditing suppressions independently (RUF100, nolintlint,
mypy `warn_unused_ignores`, ESLint) — the strongest external validation any single IR feature
received in this research.

## §10 — Probe results (P1–P3 executed 2026-07-02, adversarially verified)

Probes P1–P3 from §9 executed this session (read-only, on this repo; each result independently
re-verified by an adversarial second pass — 3/4 CONFIRMED, P2 REVISED with a corrected number).
P4–P6 were executed/designed 2026-07-03 during MT-umbrella authoring (**P4 designed-only** — `cargo`
absent in env; **P5 live-run** for real; **P6 demonstrated**) and are recorded below.

### P1 — CLAUDE.md reverse-compile into IR nodes (validates §9 p.4 "composition over node SETS")

40 prose units enumerated in `CLAUDE.md`. Split: **1:1 = 3 (7.5%)** · **N:1 = 13 (32.5%)** ·
**unmappable = 24 (60%)**. The only clean 1:1 nodes are the three numeric/regex capability-commit
thresholds (`≥50 LOC` glob, `≥80 LOC` glob, dependency-diff regex — CLAUDE.md "What is a capability
commit?"). The 60% unmappable are goal pointers, the Artifact Ownership Contract table, incident
narratives, and doc-authority headers — doc-level/process, DESCOPED from the v0.2 selectorClass
enum (§9 p.2). **Verdict: composition-over-sets CONFIRMED.** A naive 1:1 doc→node compiler would
fabricate ~24 phantom nodes or drop 92.5% of the file. Falsifier (≥50% units 1:1 ⇒ 1:1 compiler
viable) is far from met (measured 7.5%); 1:1 vs N:1 ≈ 1:4.

### P2 — corpus expressibility census (sets Python go/no-go, §9 p.8)

Corpus = **11 framework rules** (R2/R7/R8 + `restricted-syntax-audit-exempt` wrapper handwritten;
R12 preset; R-SPA-EB; R13/R14/R18/R20 declarative recipes; `no-head-element` generated) × 5
toolchains × selectorClass. **Python (ruff) native drop = 90.9% (10/11) as-written, 100% after the
R7 correction.** ruff's custom-rule surface is the closed `flake8-tidy-imports` vocabulary — TID251
banned-api (import-only) + TID253 banned-module-level-imports — and it **cannot** express R7's bare
`Date.now`/`Math.random`/`new Date` method+constructor bans (only its fs/http import sub-clause is
native, so R7's ruff cell is ⚠️, not ✅). **Verdict: NO-GO for a native-ruff default** — the drop
sits far above the 50–70% "product death" band (§6 Q2) → **Python must enter via the ast-grep
escape hatch by default** (§9 p.8 confirmed empirically). Under ast-grep, `pythonUndroppable = 0`
(ruff-native retained only as a fast-path for the 2 import/qualified-name bans). *(Correction note:
the first pass reported 81.8%, which silently counted R12's ⚠️ cell as a non-drop against its own
drop definition; the adversarial verify corrected it to 90.9% / 100% — direction unchanged,
reinforced. Sources for the R7 cap: `flake8-tidy-imports` flags imports only; ruff has no
custom-AST-rule surface.)*

### P3 — anchor round-trip on an AGENTS.md fenced block (proves surface 6 load-bearing, §9 p.5)

Flipped the `ci-tool-pinning` row's "Enforces" assertion in the `AGENTS.md` §Rules table to its
**semantic opposite** ("must pin / use `npm ci`" → "may float unpinned / use `npm install`"),
making the doc LIE about `.claude/rules/ci-tool-pinning.md §1` and its executable gate
`packages/core/hooks/pre-push.ts:196` (`unpinnedToolInstallSection`). **All three AGENTS.md-touching
tools passed GREEN**: `audit-ai-docs.sh` (D1–D5), the remark-AST `audit-ai-docs.ts` port, and
principle-09 doc-authority (header-presence only). Decisive independent check: **repo-wide
`grep -rln "Enforces"` across `packages/`, `tests/`, `.claude/hooks/`, `agents/`, `scripts/` = ZERO
hits** — no shipped or CI tool reads the §Rules "Enforces" column. **Verdict: surface 6
(framework-owned fenced-block content-vs-code drift detector + per-surface hashes) is a real current
gap** — an AGENTS.md-class file can silently drift into contradicting its own enforced rules with
zero mechanical detection. Confirms the §9 p.5 "drift detected within one regenerate cycle" claim
fills an unoccupied position, not a solved one.

### P4 — Rust firing spike (toolchain ABSENT — paper design, honest record, 2026-07-03)

Firing-test contract as data (§4 invariant 4):

```json
{ "command": "cargo clippy --message-format=json",
  "jsonPath": "$.message.code.code",
  "expectedCode": "clippy::disallowed_methods" }
```

Grounded in §2 (row "JSON diagnostics": `cargo clippy --message-format=json`, stable code `clippy::disallowed_methods`) + rustc's `rustc_errors::json::DiagnosticCode` (each cargo-metadata `compiler-message` carries `message.code = {code, explanation}`); the path `message.code.code` is real, not invented. Fixture: a tiny crate + `rust-toolchain.toml` (pin stable) + `clippy.toml` `disallowed-methods = ["std::env::var"]`; the invalid fixture calls `std::env::var` directly, the valid one wraps it behind an injected accessor.

**Verdict:** the contract triple + its documentary grounding are established. Live-fire was NOT executed — `cargo`/`rustc`/`clippy` are absent in this env; live-verification of the JSON path against a real `cargo clippy --message-format=json` run is deferred to a Rust-toolchain env. No pass was faked.

### P5 — ast-grep fallback on a ruff-inexpressible case (RUN FOR REAL, 2026-07-03)

Case: forbid `datetime.datetime.now()` calls (R7 time-injection analog) — ruff's `flake8-tidy-imports` (TID251/TID253) is import-only and cannot express a bare method-call ban (§2 / P2).

```yaml
id: no-datetime-now
language: python
rule: { pattern: datetime.datetime.now($$$ARGS) }
message: "Use an injected clock, not datetime.datetime.now() directly"
severity: error
```

Observed (`ast-grep scan --rule no-datetime-now.yml <file>`): `invalid.py` → `error[no-datetime-now]` at line 4, exit 1; `valid.py` (clock indirection) → no output, exit 0. Independently re-verified by the orchestrator.

**Verdict:** ast-grep 0.44.0 expresses a bare-method-call ban that ruff's closed vocabulary structurally cannot — a real paired RED/GREEN. §9 p.8 (Python enters via the ast-grep escape hatch) is empirically reinforced with a live-fired instance (P2 = census-level drop; P5 = one live case).

### P6 — status-line render = pure template substitution (LLM-free claim, 2026-07-03)

```js
const renderStatusLine = (node) => {
  const { eslint, clippy, ruff } = node.enforcement;
  return `Enforced: eslint ${eslint} · clippy ${clippy} · ruff ${ruff}`;
};
```

Run on two IR-node-shaped inputs → deterministic string output; re-invocation on the same input is byte-identical (no IO, no network, no randomness — reads only its argument).

**Verdict:** confirms §9 p.6 / p.7 — status-line rendering from an IR node's already-resident `enforcement` fields is pure deterministic substitution, LLM-free and network-free by construction.

## Prevention

The future generic-frame/Rust umbrella kickoff MUST cite this patch as its R-phase base,
re-verify the volatile facts marked in §5 (versions, licenses, stability disclaimers — this
research dates 2026-07-02), and run the phase-research-coverage §1 checklist only on NEW
candidates surfaced after this date. Traps pre-loaded for that kickoff: T13/T16 (each ADOPT row
above carries an upstream-problem-class statement to re-check), T12 (licenses change — Semgrep
precedent), T15 (the frame's own renderers must pass the capability-matrix discipline they
enforce).

## Tags

`multi-toolchain` · `rule-grammar` · `prior-art` · `generate-first`
