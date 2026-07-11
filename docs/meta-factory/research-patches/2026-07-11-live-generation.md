<!-- scope:live-generation -->
# Live rule-generation across js/ts · rust · python through a common core — R-phase research-patch

> **Scope:** the gap «bring the framework's LIVE rule-generation (research live docs → executable rule + firing test) to ALL THREE render stacks — js/ts, rust, python — as THREE thin per-stack adapters over ONE shared generation core, not three parallel lanes». Folder-authority: [research-patches/](.) (scope-bound by gap). NOT authoritative for project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Status:** LANDED on staging (this R-phase + its kickoff land NOW). LG-S1 DISPATCH is gated on python-delivery-v0 S3 being merged (its `done.md` present — the delivery seam prerequisite, §Qf). This is a research + kickoff-scoping doc; it decides nothing strategic — the two OWNER-FORKs (§Forks) are parked for the maintainer.
> **Method:** code read against the working tree + `origin/staging` (every `file:line` re-confirmed with grep/git-show — lines drift), one live `@ast-grep/cli@0.44.1` firing probe (§Qe), BFR §3 = DeepWiki `ask_question` ×3 + WebSearch ×3 (§BFR). `ai-laziness-traps` T3/T11/T12/T16/T20/T15 honored (every load-bearing claim carries command / file:line / probe output).
> **Date:** 2026-07-11.

---

## §0 Common-core ground truth (re-confirmed 2026-07-11, with file:line)

The owner directive is: **confirm a stack-agnostic generation core, add only thin per-stack adapters — do not design a per-stack parallel pipeline.** Verified: the core is real and already three-quarters built. It has three planes, two of them already neutral.

### Plane 1 — Neutral IR + render backends (STACK-AGNOSTIC, reuse verbatim)

- **Neutral node:** `packages/core/ir/types.ts:32-41` — `ConventionNode { id, claim, anchors, selectorClass, params, defaultSeverity, provenance, pairedExamples }`. Frozen: `ir/types.ts:3` «Node fields are FIXED by spec §3 — do not add fields». Already authored for two stacks: Rust set (#199) and Python set (`packages/core/python-starter/starter-nodes.ts:45`, #217).
- **Four render targets, pure functions:** `packages/core/backends/{astgrep,ruff,cargo,npm}` — `render-astgrep.ts:98` (Python syntax-class default, #212), `render-ruff.ts:97` (Python TID251/253 fast-path, #215), `backends/cargo/render-clippy.ts` + `backends/cargo/write-clippy.ts` `renderClippyLints` (Rust clippy.toml path-bans + a Cargo.toml `[lints.clippy]` severity plane, #199 + **#977** severity projection), `backends/npm/from-node.ts` (JS/ESLint). All render fns are `ConventionNode[] → string` with «zero fs/network access» (`render-astgrep.ts:5`, `render-ruff.ts:5`); `write-clippy.ts` is the cargo *packaging* writer (`writeFileSync`, `:16`). **This is the shared generation core's output half.**
> **Citation baseline + coordination:** staging moved ~14 PRs today (#964-#981); every `file:line` above was re-confirmed against **`origin/staging`** post-fetch (not the working tree). **PR #977** «cargo severity projection + honest cargo clippy demo» (launch-preannounce-track S4, merged 2026-07-11) reshaped `backends/cargo/` — the cargo state referenced throughout is POST-#977. **Boundary (kept clean):** launch-preannounce-track owns cargo **DELIVERY** honesty (the `demo/crate/` demo, severity projection, README claims, `write-clippy.ts` packaging, `capability-matrix.json`); this umbrella owns cargo **GENERATION** (research → nodes → render *through* that backend). The rust adapter REUSES #977's render/write/firing/capability-matrix plumbing — it does not duplicate the demo/severity/writer.

### Plane 2 — Research + trust core (STACK-AGNOSTIC bar one data file, reuse verbatim)

- `packages/core/research/` is neutral: a JS/ESLint-specificity grep over `research/*.ts` (non-test) hits **only `allowlist.ts`** (the Tier-0 builtin host *data*, `allowlist.ts:21-27`: next/react/react-native/expo/tailwind/mdn/typescript — all JS). Every logic module is stack-neutral.
- **Injectable live-research seam:** `research/research-port.ts:13-16` — `ResearchClient.research(detection) → ResearchPlan`; CI injects `stubFrozenResearch`, install injects `createAnthropicResearchClient` (`research-adapter-anthropic.ts` — a generic «expert ${stack} engineer» prompt built from `detection.framework.name`, `:35`). Neutral: takes `DetectionResult`, returns `ResearchPlan`.
- **Pluggable trust seam:** `research/allowlist-resolver.ts:133-136` — `interface EcosystemAdapter { ecosystem; listDirectDeps; readInstalledMeta }`. Two impls shipped: `ecosystem-npm.ts`, `ecosystem-cargo.ts`. The prefix scheme (`ecosystem-name.ts`, research-source-trust.md §4) already reserves non-JS ecosystems and fails a hypothetical `pip:` closed until an adapter exists. **Python = a third thin adapter here, not a new trust model.**

### Plane 3 — The research→executable-rule GENERATE bridge (NOT yet common — the seam to build)

This is the honest gap. There are today **two disjoint generate halves**, neither of which routes live-research output through the neutral ConventionNode IR:

- **JS/ESLint (shipped):** `synthesizer/file-clients.ts:59` `FileGenerateClient.generate → GenerateSelection` → `synthesizer/generate.ts:59` routes `presence:'forbid' && selector` → `declarative` (ESLint L4 roundtrip); it imports `merge-eslint-config.ts` / `compile-declarative-md.ts` (`generate.ts:14-16`) — **ESLint-bound, bypasses ConventionNode entirely**.
- **Synthesizer-own-input (MT S3b):** `synthesizer/to-node.ts` bridges the synthesizer's *own* input → `ConventionNode` → `backends/npm/from-node.ts` (byte-identity-locked, `to-node.test.ts`). This bridges recipe input, **not** live-research output.

⇒ **No `live-research → ConventionNode` bridge exists.** Planes 1+2 are the shared core (IR + 4 backends + research/trust). Plane 3's neutral bridge — the thin, shared-shaped step «a researched practice → a ConventionNode routed to the stack's backend» — is what py + rust both need and what must be built ONCE. That is the umbrella's load-bearing shared work; it is small (author nodes + call existing renderers), not a pipeline.

---

## §1 STALE-BRIEF CORRECTION (load-bearing — both the task brief and the coordinator update are stale on this)

Both the original R-phase brief («Phase 1 has NOT started») and the goal-update («js/ts: … its Phase 1 becomes a stage») assume the JS live adapter is pre-implementation. **It is shipped on `origin/staging`:**

- `git log origin/staging` → `625d85a14 rule-research live adapter — Phase 1 (live file-clients + manual-drop + portable agent) (#805)` and `7f9182ddc … S2 Tier-1 derivation (npm) + scope-lock + taint banner (#852)`.
- Live on staging: `synthesizer/file-clients.ts` (both `FileResearchClient` + `FileGenerateClient`), `rule-bootstrap-cli.ts:56-57` (`--from-research`/`--from-selection`), `synthesizer/rule-bootstrap-live.test.ts`, `agents/rule-researcher.md`, `.claude/skills/rule-research/SKILL.md`.

**Consequence for the umbrella:** the JS stage is NOT «implement Phase 1». JS live-gen already works end-to-end (research → GenerateSelection → L4 executable rule + firing test → rules-lock.json, $0-in-CI). The JS stage becomes **confirm-and-frame**: adopt the shipped ESLint generate-half as the JS thin adapter over the common core, and decide (owner-fork §Forks-2) whether to leave it ESLint-direct (recommended) or converge it onto the neutral ConventionNode bridge. This materially shrinks the JS stage and reorders the umbrella (§Qf).

---

## §Qa — Where does render run for a stack whose consumer has no Node?

**Answer: render runs SESSION-SIDE (in the AI research session, which runs on Node), never at consumer install-time. Call it Model A′ — a per-consumer analog of python-delivery-v0's commit-time Model A.**

- python-delivery-v0 fixed Model A because «a Python consumer has no Node… the TS renderers CANNOT run at install time» (kickoff.md §1 :69-72) — the render happens at framework build/commit and ships static templates.
- Live-gen cannot pre-render at framework-build (rules are researched *per consumer*). So it pre-renders in the **research session**: the session runs `renderAstgrep`/`renderRuff`/`renderClippy` on the researched `ConventionNode[]`, commits the input record (`.ai-factory/rules-research/<stack>.*.json`) **and** the rendered artifact (astgrep YAML / ruff TOML / clippy.toml), and the pure-bash `setup.d` seam (python-delivery-v0's) delivers the static artifact. The consumer install path stays Node-free — the Model A constraint holds unchanged.
- **Soundness (falsifier):** the render functions are pure of consumer-machine state — `render-astgrep.ts:5` / `render-ruff.ts:5` «zero fs/network access»; output is a pure function of `ConventionNode[]`. So session-side pre-render is byte-identical to any-side render. It would be *unsound* only if a rendered rule depended on consumer runtime state — it does not. **Falsified if** a backend ever reads consumer state at render time (then the pre-render/deliver split breaks and render must move to the consumer — impossible without Node, so that would instead force a research-only degrade).
- **Where the model breaks — named honestly:**
  1. **CI-side generation: OUT.** Live research is session-bound ($0-in-CI, principle 17 / no-paid-llm; MCP absent in CI). No render-from-research in CI. CI only re-renders *already-committed* ConventionNode records for the byte-drift gate (deterministic, no research).
  2. **A research harness with no Node on PATH.** The session invokes the framework's render via its repo tooling (tsx); CC bundles Node but the Bash-tool PATH may not expose `node`/`npx`. Mitigation: invoke the render through the same `packages/core` tsx entry the repo scripts already use. If Node is genuinely unreachable in the harness, generation **degrades with guidance and ships no rule** (never inert) — the consumer uses the starter set (python-delivery-v0). This mirrors the ESLint lane's degrade-on-absence (`setup.d/80-rule-bootstrap.sh`, spec §Decision B).
  3. **Rust CI live-fire (a different constraint, §Qf/Rust):** even the *firing test* is CI-gated for cargo (`backends/cargo/firing.test.ts:37-38` `cargoPresent && !isCI`) — pinned-toolchain false-RED risk. Rust render+drift run in CI; Rust live-fire is local-only.

---

## §Qb — Adapter surface + the frozen-IR expressibility ceiling (IR-unfreeze = OWNER-FORK)

**Surface (in the common-core frame):** each stack's thin adapter authors `ConventionNode[]` in the frozen IR and routes to that stack's already-ADOPTED backend — py→astgrep/ruff (#212/#215), rust→clippy (#199), js→ESLint. The adapter provides only: (i) doc-source resolution (Tier-0 keys + EcosystemAdapter), (ii) research→node authoring (which practices → which node params, honoring the ceiling below), (iii) firing-test generation. **Everything else — IR, the 4 renderers, the tiered trust resolver, the delivery seam — is common-core, reused verbatim.**

**Does the frozen IR suffice for RESEARCHED (not curated) rules? — narrowly, with a measured ceiling.** Evidence:

- The astgrep renderer emits **only** `rule: pattern: <params.pattern>` (`render-astgrep.ts:159-169`) — no `any:`/`all:`/`not:`/`inside:`/`has:`/`constraints:` (ast-grep's real composite/relational surface). `kind` is carried into `metadata` only, «does not yet specialise the emitted rule shape» (`render-astgrep.ts:23-28`).
- Both backends **validate `params.kind ∈ {call, attribute, import}`** (`render-astgrep.ts:44,63`; `render-ruff.ts:57`). A practice outside those three kinds cannot be honestly expressed.
- The **starter set already paid this tax**: `datetime.now` needed **two literal-pattern nodes** because «a single `pattern` cannot match both `datetime.now()` and `datetime.datetime.now()`… `$MOD.now()` over-fires on `foo.now()`» (`starter-nodes.ts:22-28`, live-verified @0.44.1).

So the frozen IR is expressible **iff** a practice reduces to a single literal ast-grep `pattern` that is a call/attribute/import ban. For a **curated** starter set (hand-picked to fit) that is fine. For **live-researched** rules (arbitrary practices from docs) it is materially binding — alternation, relational rules, and non-{call,attribute,import} kinds (bare-except, mutable-default-arg, `== None`, `type() ==`) all fall outside. Probe evidence (§Qe): `yaml.load($$$ARGS)` (call-kind) renders + fires; a mutable-default-arg pattern did **not** match.

**Honest v1 without unfreezing:** mirror the ESLint lane's `§MAJOR-1` L4-expressibility filter (`agents/rule-researcher.md` §3 / spec §5) — emit a ConventionNode **only** for single-pattern call/attribute/import-ban practices; everything else is a **research-only finding** (knowledge surfaced, never shipped inert). Keeps IR frozen + honest, narrows the shippable surface.

> **### OWNER-FORK-1 — unfreeze the neutral IR to widen expressibility? (affects py AND rust — both are ConventionNode-routed; NOT js, which is on the richer ESLint/ESQuery plane).** Do NOT decide here.
> - **Option A — keep IR frozen (narrow, honest).** Ship only single-pattern call/attribute/import bans; the rest → research-only findings. Consequence: zero blast radius on the MT plane; but many valuable researched conventions never become rules (weak «working live gen» — a demo, not a product). The two-node datetime tax multiplies across the corpus.
> - **Option B — unfreeze IR (wider).** Add a composite/alternation param (e.g. `patterns: string[]` → ast-grep `any:`, or a structured rule object + widen the `kind` enum) + extend `render-astgrep.ts`. Consequence: expresses real ast-grep rules for py+rust; but unfreezes a *deliberately*-frozen IR (`ir/types.ts:3` «do not add fields; v0.2 dropped capabilityTier/confidenceTier») and touches **every** ConventionNode consumer — the grammar gate (`ir/gates/grammar.ts`), `to-node.ts`/`from-node.ts` byte-identity locks (`to-node.test.ts`), cargo + ruff backends, canonical-regen snapshots. A cross-cutting MT-plane design change, far beyond any single stack — its own umbrella.
> - **Decider (falsifiable, not a vibe):** run the P2-style expressibility census (already the method for ruff #215, `render-ruff.ts:9-16`) on ~10-15 real researched conventions per ConventionNode-routed stack; count the single-pattern-expressible rate. ≥~50% → Option A ships a real product, defer unfreeze. Low rate (the «50-70% product-death band» the #215 rationale names) → Option B is justified by *measured* need. **This census is LG-S1 work; the fork resolves after it, on data.**

---

## §Qc — Research provenance + staleness for non-JS stacks

**Provenance (the tiered trust core is reused; the per-stack seam is data + one thin adapter):**

- **Tier-0 gap (data, not code):** `allowlist.ts:21-27` builtin hosts are JS-only. Python + Rust canonical doc hosts are absent → their research provenance fails-closed today. Fix = add Tier-0 keys as **data** (e.g. `python.official`→docs.python.org/peps.python.org, `ruff.official`/`pyyaml`; `rust.official`→doc.rust-lang.org/docs.rs, `clippy`→rust-lang.github.io/rust-clippy). This is the exact `#allowlist-as-code-not-data` discipline (research-source-trust.md §3) — a data change to the builtin registry (parallel to how react-native/expo were added), never a resolver-source edit.
- **Tier-1 (a thin ecosystem adapter, deferred with a live trigger):** `ecosystem-python.ts` (pyproject `[project]` metadata) + a Rust reuse of the shipped `ecosystem-cargo.ts` (Cargo.toml `[package]`) would derive trust from an installed dep's own homepage/repository — the `EcosystemAdapter` seam (`allowlist-resolver.ts:133`) already supports it (#197 cargo-analog). python-delivery-v0 already names `ecosystem-python.ts` as OUT-of-scope with a deferred trigger (kickoff.md :141). Build only when a consumer needs a non-Tier-0 Python/Rust source.
- **§4.5 re-tightening trigger does NOT fire** (research-source-trust.md §2): astgrep/ruff/clippy render is deterministic (`render-astgrep.ts:5`), same «wrong-rule-is-the-worst-case» bound as the ESLint factory — so Tier-1 auto-trust stays; it would downgrade to Tier-2-ack only if a Path-B arbitrary-code-gen flow ever ships.

**Staleness (the whole reason for live-gen over frozen templates):** a researched node carries provenance with `fetchedAt` + a quoted excerpt (`agents/rule-researcher.md` §4; the ESLint lane's committed `.ai-factory/rules-research/*.json`). Freshness = re-running the research protocol. There is no automatic staleness *gate* on researched rules (a fetch-time snapshot), but the input record is committed + auditable, and the **tool-bootstrapping incrementality precedent** is the ADAPT seam: Rule 5 (`tool-bootstrapping/SKILL.md` §Rule 5) already hashes `package.json` deps and warns on change. A per-manifest deps-hash warning («python/rust/js deps changed → re-run rule-research») is the staleness-refresh channel (LG-S4, not v1-load-bearing). This is precisely what makes live-gen «not stale» vs the byte-frozen starter templates: templates freeze at framework-build; researched rules carry a re-runnable provenance chain.

---

## §Qd — Delivery integration (reuse tonight's collision evidence verbatim)

Generated (researched) rules land in the consumer's rules dir **next to the starter rules**, in the **same** `sgconfig.yml` `ruleDirs`, delivered by the **same** pure-bash `setup.d/NN-python.sh` augment-first seam python-delivery-v0 S1 builds — reused, not forked. Task-2 probe evidence (python-delivery-v0 S1 Task-2 report) carries over unchanged:

- ruleDirs are **additive** — rules from a second dir fire in one scan (Probe 4); a researched-rules dir alongside the starter dir just works.
- **namespaced ids** — duplicate rule id = `ast-grep scan` exit 8 (Probe 7); researched rules use a distinct sub-namespace (e.g. `getff-researched-*`) so they never collide with the starter `getff-*` or with each other.
- **idempotent structural merge** — text-appending a 2nd `ruleDirs:` key = exit 8 (Probe 8); missing dir = exit 6 (Probe 6 — create the dir atomically). Re-run = zero diff.
- **ruff `extend`-scalar refuse-loudly** (Probe 3) for researched ruff (TID) rules when the consumer already has an `extend`.
- **same firing-proof pattern** — S2's plant-violation → RED self-check covers researched rules identically.

Rust researched rules land as `clippy.toml` allow/warn/deny entries (its own delivery surface); JS researched rules land via the shipped rules-lock.json path (#805). Placement home for the render output = the consumer's committed `.ai-factory/rules-research/` (input JSON + rendered artifact), the delivery layer copies/augments from there.

---

## §Qe — Firing-test generation (the per-stack «works» definition, made testable)

The lane's contract = rule + firing test (RED proof). Its shape is **per-stack** (the firing channel differs), but the *contract* is common:

- **Python — `ast-grep scan` live-fire (CI-capable).** Flagship demo, picked WITH probe evidence (@ast-grep/cli@0.44.1, §probe): **`getff-no-yaml-load`** — ban `yaml.load($$$ARGS)` (use `yaml.safe_load`). Genuinely-researched-not-starter (canonical PyYAML security guidance; NOT in the S1 starter set), `call`-kind (fits the frozen params contract), single ast-grep `pattern` (frozen-IR-expressible), single-token diff (`load`→`safe_load`), **fires RED on `yaml.load(data)` (exit 1) / CLEAN on `yaml.safe_load(data)` (exit 0) — PROVEN below.** `getff-no-pickle-loads` is the equally-proven fallback. Python firing works in framework CI too (ast-grep is a downloadable binary; python-backend-v0 S1 already live-fires in CI, python-delivery-v0 kickoff §0).
- **JS/TS — L4 executable roundtrip (shipped, $0-in-CI).** The firing proof IS the L4 validate (`validator/validate.ts` — fires on `examples.bad`, clean on `examples.good`, anti-vacuity). Already proven for the `no-head-element` demo (#805 / spec §10). No new work — this is the reference implementation of «works».
- **Rust — `cargo clippy` live-fire, LOCAL-ONLY (honest CI limitation; POST-#977).** `backends/cargo/firing.test.ts:38` gates live-fire on `runLiveFire = cargoPresent && !isCI` (`:38`); its loud-skip (`:45`) states verbatim «live-fire is a developer-machine DoD gate, not a CI gate… the cargo backend MUST NOT be claimed green on live-fire from this run alone (T-MT-C)». Post-#977 the backend also ships `capability-matrix.test.ts` — an **always-on (CI) structural-honesty contract**: «any cell claiming more than 'no' MUST carry live-fired evidence (not a claim, an artefact)» (`:5-6`). So **«autogeneration works for rust» means, verifiably, three things:** (i) generation renders research → ConventionNode → `clippy.toml` + Cargo.toml `[lints.clippy]` through the POST-#977 `render-clippy.ts`/`write-clippy.ts` (reused verbatim); (ii) **developer-machine** `cargo clippy` fires RED on the generated rule + clean on the fix (the `skipIf(!runLiveFire)` DoD gate, recorded with command+output); (iii) **CI proves render determinism + byte-drift + the capability-matrix committed-live-fired-evidence** — NOT a fresh CI live-fire. A green rust CI is a render/evidence proof, not a live-fire proof — the AC states this split, never hides it.

> **Firing probe (run 2026-07-11, @ast-grep/cli@0.44.1, scratch dir):**
> ```text
> rule getff-no-yaml-load  { pattern: yaml.load($$$ARGS) }   → scan bad.py  → error[getff-no-yaml-load] at yaml.load(data); exit=1
> rule getff-no-pickle-loads { pattern: pickle.loads($$$ARGS) } → scan bad.py → error[getff-no-pickle-loads] at pickle.loads(data); exit=1
> scan good.py (yaml.safe_load only)                          → exit=0  (CLEAN)
> rule getff-no-mutable-default { multiline def $F($$$A,$P=[],$$$B) } → DID NOT MATCH  (frozen-IR ceiling, §Qb)
> ```
> The mutable-default non-match is kept as the honest counter-example: value = the live-research→executable-rule *pipeline*, not rule novelty (same honesty note as `no-head-element`, spec §10).

---

## §Qf — Stage decomposition (three stacks through the common core, ordered by evidence)

**Reachable TONIGHT — honest:** python-delivery-v0 S1 is in-flight (starter nodes committed `24b56a31b`; the delivery layer `setup.d/NN-python.sh` = S1 Task 5 PENDING + S2). **The delivery seam does not exist yet.** Live-gen's first stage DEPENDS on python-delivery-v0 S1-S3 merging (seam + starter-render pattern + firing-proof pattern). After S3, the seam exists and live-gen reuses it. Tonight, only LG-S1 is plausibly reachable *after* S3 merges; LG-S2/S3/S4 are subsequent.

**Order rationale (evidence, not default):** python **first** (its delivery seam is fresh tonight; astgrep/ruff + starter + firing-proof land now — highest momentum, lowest marginal cost); js/ts **second** but *shrunk to confirm* (Phase 1 already SHIPPED, §1 — not «implement»); rust **last** (most new per-stack pieces + the CI live-fire caveat).

- **LG-S0 (folded into LG-S1) — extract/confirm the shared core + build the neutral `live-research → ConventionNode` bridge.** The one shared build (§0 Plane 3): a thin projection «researched practice → ConventionNode routed to the stack's backend», the interface py+rust both consume. Smallest proof = instantiate it for ONE stack end-to-end (python, seam fresh). Deliverable includes the §Qb expressibility census that feeds OWNER-FORK-1.
- **LG-S1 — Python thin adapter, smallest honest end-to-end slice THROUGH the common core.** live-research → ConventionNode[] (neutral bridge) → `renderAstgrep`/`renderRuff` (verbatim) → session-side render (§Qa) → deliver via python-delivery-v0 seam (§Qd) → **RED on a scratch consumer for `getff-no-yaml-load`** (§Qe). + Tier-0 Python allowlist keys (data, §Qc) + expressibility census (§Qb). STOP: no IR field; degrade-not-inert on non-expressible; $0 (research session-only, stubs in CI).
- **LG-S2 — JS/TS: confirm-and-frame (NOT implement — §1).** Adopt the shipped ESLint generate-half (#805) as the JS thin adapter over the common core; assert the common-core framing (research → rule + firing test → RED) holds for JS via the existing `no-head-element` L4 proof. Resolve OWNER-FORK-2 (leave ESLint-direct — recommended — vs converge onto ConventionNode). Small: mostly confirmation + a framing doc + the reference «works» demo.
- **LG-S3 — Rust thin adapter (honest CI limitation; builds on #977, no duplication).** Reuse `ecosystem-cargo.ts` (trust) + Rust Tier-0 hosts (data) + research→clippy-ConventionNode authoring → the POST-#977 `render-clippy.ts`/`write-clippy.ts` (verbatim) → **developer-machine `cargo clippy` RED proof** (`firing.test.ts:38` `skipIf`) + the generated rule's live-fired evidence recorded in the capability-matrix (`capability-matrix.test.ts` verifies it in CI). CI = render + byte-drift + committed-evidence, NOT fresh live-fire. **Boundary:** consume launch-preannounce-track's cargo DELIVERY plumbing (demo/writer/severity/matrix); this stage adds only cargo GENERATION (the researched node → clippy render + local RED). «Works for rust» AC states the three-part split (§Qe) explicitly.
- **LG-S4 — hardening + staleness + closure.** Per-manifest deps-hash staleness warning (ADAPT tool-bootstrapping Rule 5, §Qc) across all three stacks; `ecosystem-python.ts` if a consumer needs a non-Tier-0 source; docs + `done.md`.
- **(OWNER-FORK-1 IR-unfreeze, if chosen after LG-S1's census, is its OWN MT-plane umbrella — NOT folded here; it touches every ConventionNode consumer.)**

---

## §BFR — Build-vs-reuse §3 mechanism on the NEW capability area (live-doc research → neutral-IR → multi-backend rule + firing test)

**Coverage:** DeepWiki `ask_question` ×3 + WebSearch ×3 (≥3-each floor met). context7 excluded per BFR §3 tooling caveat. SSOT consulted (grep `prior-art-evaluations.md`) — no row covers a doc→lint-rule autogenerator; LintConfig absent (grep `lintconfig|coverage.classif|checkstyle` → 0 hits, unrelated #170 only).

### Search log

| # | Channel | Query (abbrev) | Result |
|---|---|---|---|
| W1 | WebSearch | tool generates lint rules automatically from documentation / coding-convention descriptions | **`idiomaticrefactoring/LintConfig`** — AI skill: NL coding-standard → formalized rules via a structured grammar → maps to linter rules + validated config; **coverage classification: Exact / Over- / Under-Approximation**. **Checkstyle (Java) only**, «extensible architecture». The single genuine partial match. |
| W2 | WebSearch | neutral IR compile one rule spec to eslint/ruff/clippy, stack-agnostic | **No such tool surfaced.** Results describe each linter's own AST/rule system separately; «a unified language-agnostic IR for compiling rules across ESLint/Ruff/Clippy isn't covered … might be emerging/academic». |
| W3 | WebSearch | AI research best-practices → executable lint rule + firing test from live docs | **Semgrep** (custom rules «in minutes»), **Fern Writer** (linter flags → agent parses log → correction commit — self-correcting cycle), «treat rules as a living document». Rule ENGINES + agent loops, not doc→rule generators. |
| D1 | DeepWiki `ast-grep/ast-grep` | neutral IR to multiple linters? auto-generate rules from docs? | **No.** Rules are language-tagged YAML per language (`language` field); «no neutral intermediate representation that can be rendered to multiple external linters»; «no built-in facility to auto-generate rules from documentation». |
| D2 | DeepWiki `astral-sh/ruff` | generate custom rules from spec/IR/docs? | **No.** Closed native Rust rule set (900+ first-party); the only config surface is `flake8-tidy-imports.banned-api` — «does not support generating custom lint rules from external specifications, neutral rule IR, or documentation». |
| D3 | DeepWiki `antfu/eslint-config` | research stack from live docs → auto-generate rules + firing tests, multi-ecosystem? | **No.** «Curated, static, composable ESLint config»; `antfu()` factory + package auto-detect; «no mechanism … to auto-generate executable lint rules or firing tests». (Retires the factory-function generation hope from generation-live-delivery §Q5.) |

### Per-candidate verdicts (T16: Upstream class X / our class Y / match? evidence → verdict)

- **LintConfig** — X: parse a *given* NL coding-standard → Checkstyle config, single linter, one-shot, coverage-classified. Y: research *live* docs → neutral ConventionNode IR → executable rule + *firing test* across astgrep/ruff/clippy/eslint, provenance-tiered, $0-in-CI. **Match? PARTIAL (~35%)** — real overlap on «NL standard → linter rule + coverage classification»; diverges on live-research+provenance, neutral multi-backend IR, firing/non-vacuity proof. Its **Exact/Over/Under-Approximation is a strong vocabulary match** for our RenderOutcome (rendered/degraded/refused) + research-only-finding + the L4/expressibility filter. → **ADOPT-VOCABULARY** (coverage-classification terms) **+ REFERENCE** (closest doc→lint-config generator). NOT ADOPT (Checkstyle-only, no neutral IR, no firing test, no live research).
- **Semgrep / Fern Writer** (W3) — X: a rule *engine* + an agent self-correction loop. Y: generate the rule *from research*. **Match? No** (engine, not generator). → **REFERENCE** (the «living rulebook» framing supports §Qc staleness; Semgrep is a render-target class alongside ast-grep, already covered by #212).
- **ast-grep / ruff / clippy** (D1/D2 + #212/#215/#199) — X: single-language rule engines. Y: neutral multi-backend generation. **Match? No** (each is a render *target*, confirmed no neutral IR / no doc-gen). → **REFERENCE** (already ADOPTED as render targets #212/#215/#199; D1/D2 confirm the neutral-IR + doc-gen residue is genuinely ours).
- **antfu/eslint-config** (D3) — X: static composable config + package detect. Y: research→generate. **Match? No.** → **REJECT** as a generation model (retires the factory-function-generation hope).
- **The stack-agnostic autogeneration core itself** — no upstream provides live-doc-research → neutral-multi-backend-IR → executable-rule + firing-test. Residue = the neutral `live-research→ConventionNode` bridge (§0 Plane 3) + firing generation + provenance tiers, composed over already-shipped pieces (IR + backends #199/#212/#215 + research/trust core + rule-research bridge #183). → **BUILD** (thin, composed), SSOT row 219.

### Draft SSOT rows (paste-ready, exact register format — 216+217 land from python-delivery-v0 S1; 218/219 are this umbrella's next-free, re-grep the register tail at commit time)

```text
| 218 | **AI doc/standard → linter-config generation with coverage classification** — survey of tools that turn a natural-language coding standard / documentation into linter rules: `idiomaticrefactoring/LintConfig` (NL standard → structured-grammar rules → validated Checkstyle config, with Exact/Over-Approximation/Under-Approximation coverage classification; **Checkstyle/Java only**), Semgrep custom rules + Fern Writer self-correction loop (rule engines + agent loops, not generators), antfu/eslint-config (static composable config, no generation). The **absence** of a live-research, provenance-gated, neutral-multi-backend (astgrep/ruff/clippy/eslint), firing-test-proving doc→rule generator. | live-generation umbrella — the research→executable-rule bridge that turns live-doc research into a ConventionNode + firing test per stack; LintConfig's coverage-classification vocabulary maps onto our RenderOutcome (rendered/degraded/refused) + research-only-finding taxonomy. | 2026-07-11 | 2026-07-11 | ADOPT VOCABULARY | **ADOPT VOCABULARY** (Exact/Over-/Under-Approximation → rendered/degraded/refused + the L4/expressibility filter) **+ REFERENCE** (closest doc→lint-config generator). NOT ADOPT: Checkstyle-only, no neutral multi-backend IR, no firing/non-vacuity proof, no live-doc research, no provenance tiers (DeepWiki+WebSearch 2026-07-11). T16: upstream = parse a GIVEN standard → single-linter config, one-shot, coverage-classified; ours = research LIVE docs → neutral ConventionNode IR → executable rule + firing test across 4 backends, provenance-tiered, $0-in-CI — ~35% overlap on «NL standard → rule + coverage class», diverges on live-research+provenance+neutral-IR+firing. Semgrep/ast-grep/ruff/clippy = render-target ENGINES (REFERENCE, #212/#215/#199), not generators; antfu = REJECT as a generation model (static config). | LintConfig (or a peer) ships a neutral multi-linter IR + firing-test generation + live-research/provenance → re-weigh ADOPT for the generation bridge; OR a production tool ships live-doc→multi-backend rule generation with non-vacuity proof → re-evaluate BUILD of row 219. |
| 219 | **Stack-agnostic rule-autogeneration CORE — live-doc research → neutral ConventionNode IR → multi-backend executable rule + firing test, across js/ts · rust · python** — composition over shipped pieces: neutral IR (ir/types.ts), 4 render backends (#199 clippy, #212 astgrep, #215 ruff, npm/from-node), tiered research/trust core (research-port + allowlist-resolver + EcosystemAdapter), the rule-research bridge (#183). The NEW residue = the neutral `live-research→ConventionNode` bridge + firing-test generation per stack + per-stack doc-source resolution. | live-generation umbrella — three thin per-stack adapters over the shared core (js confirm #805, python new, rust local-live-fire) authoring ConventionNode[] routed to the stack backend, with a RED firing proof per stack. | 2026-07-11 | 2026-07-11 | BUILD | **BUILD (thin, composed)** — no upstream provides live-doc-research → neutral-multi-backend-IR → executable-rule + firing-test (DeepWiki: ast-grep «no neutral IR, no doc-gen», ruff «closed native set, no external-spec generation»; antfu «static composable, no generation»; LintConfig #218 = Checkstyle-only, no neutral IR, no firing test). The IR + backends + trust core are already shipped and stack-agnostic (verified: only allowlist.ts is JS-specific *data*); the residue built here is the neutral research→node bridge + firing generation + per-stack doc-source keys — thin adapters, NOT a per-stack pipeline (owner directive). REFERENCE the render-target engines (#212/#215/#199) + #183 (JS rule-research bridge, the shipped reference adapter). | LintConfig or a peer ships the neutral-multi-backend generation-from-research core (→ re-weigh ADOPT); OR the frozen-IR expressibility census (OWNER-FORK-1) shows the neutral IR cannot serve researched rules without unfreeze (→ that unfreeze is a separate MT-plane umbrella, re-scope row). |
```

### Draft `Prior-art:` trailer lines (downstream capability commits)

```text
Prior-art: prior-art-evaluations.md#219 (stack-agnostic autogeneration core — BUILD thin, composed over shipped IR + backends + research/trust core; no upstream neutral-multi-backend generator, ast-grep/ruff/antfu confirmed negative 2026-07-11) and prior-art-evaluations.md#218 (LintConfig ADOPT-VOCABULARY coverage-classification + REFERENCE doc→config precedent).
Prior-art: prior-art-evaluations.md#183 (rule-research bridge, the shipped JS reference adapter this umbrella generalizes to the neutral ConventionNode plane) and #212/#215 (astgrep/ruff render targets, ADOPT — reused verbatim for the python adapter).
```

---

## §Forks — OWNER-FORKs surfaced (parked, do NOT decide in R-phase)

1. **OWNER-FORK-1 — IR-unfreeze (§Qb).** Keep the frozen ConventionNode (narrow: single-pattern call/attribute/import bans; rest → research-only) vs unfreeze to widen astgrep expressibility (any:/relational/wider kinds), which touches every ConventionNode consumer (grammar gate, to-node/from-node byte-locks, cargo/ruff backends, canonical-regen). Affects py+rust (ConventionNode-routed), not js. **Decider = the LG-S1 expressibility census (data), then owner.** If unfreeze is chosen, it is its own MT-plane umbrella.
2. **OWNER-FORK-2 — JS convergence (§1).** The JS live adapter is SHIPPED ESLint-direct (#805, bypasses ConventionNode). Leave it as the JS-specific thin adapter over the common core (**recommended** — it works, converging risks the `to-node.test.ts` byte-identity locks with no user-facing gain) vs converge it onto the neutral ConventionNode bridge for uniformity (refactor of shipped code). **Surface; recommend leave-as-is; owner calls.**

## §self-application (T15)

This umbrella generates CONSUMER rules across three stacks; it does **not** make the framework's own principles/rules self-generating (`packages/core/principles/*.test.ts` stay hand-authored) — the deliberate `#recursive-self-application-gap` the generation-live-delivery R-phase already named (research-patch 2026-06-28 §6). Named here as an explicit non-goal so a later session does not silently assume «live gen ⇒ self-generating framework».

## §See also

- [.claude/orchestrator-prompts/generation-live-delivery/kickoff.md](../../../.claude/orchestrator-prompts/generation-live-delivery/kickoff.md) + [done.md](../../../.claude/orchestrator-prompts/generation-live-delivery/done.md) (#797, CLOSED 2026-06-28) — the R-phase that scoped generation-as-live-delivery and named «any I-phase follow-on is a new umbrella». **Relationship:** this umbrella IS that follow-on, scoped to the ConventionNode→backends *generation* plane (research→executable rule per stack); it SUBORDINATES generation-live-delivery's PARKED Q1 (live-emit vs SSOT-projection of the JS *preset* delivery boundary — a different surface, `eslint.config.mjs` presets, untouched here) and does not resolve it.
- [docs/meta-factory/research-patches/2026-06-28-generation-live-delivery.md](2026-06-28-generation-live-delivery.md) — Q1 PARKED; §6 self-application gap (reused above).
- [.claude/orchestrator-prompts/python-delivery-v0/kickoff.md](../../../.claude/orchestrator-prompts/python-delivery-v0/kickoff.md) — the delivery seam (setup.d) LG-S1 depends on; Model A precedent (§Qa).
- [docs/superpowers/specs/2026-06-29-rule-research-live-adapter-design.md](../../superpowers/specs/2026-06-29-rule-research-live-adapter-design.md) (on `feat/rule-research-live-adapter`) — the JS live-adapter design; §5 L4-expressibility filter (the §Qb research-only-finding pattern), §7 provenance, §10 demo.
- [agents/rule-researcher.md](../../../agents/rule-researcher.md) — the shipped AI-agnostic research protocol (extend with per-stack ConventionNode output contracts; currently GenerateSelection/ESLint only).
- [.claude/rules/research-source-trust.md](../../../.claude/rules/research-source-trust.md) §3-§4 — tier model + `#allowlist-as-code-not-data` (§Qc); [build-first-reuse-default.md §3](../../../.claude/rules/build-first-reuse-default.md) — the BFR mechanism this §BFR ran.
- [docs/meta-factory/prior-art-evaluations.md](../prior-art-evaluations.md) — SSOT; rows 218/219 drafted above (216+217 land from python-delivery-v0 S1; 218/219 this umbrella's next-free — re-grep the register tail at commit time).
