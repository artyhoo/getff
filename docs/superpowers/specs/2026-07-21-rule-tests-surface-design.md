# Rule-tests surface + any-stack generator wiring — design

> **Status:** design authored in the rule-tests design session (2026-07-21) on the research base
> [2026-07-18-universal-skill-stack-driven-prep.md](../../meta-factory/research-patches/2026-07-18-universal-skill-stack-driven-prep.md)
> + [2026-07-21-universal-skill-panel-synthesis.md](../../meta-factory/research-patches/2026-07-21-universal-skill-panel-synthesis.md)
> (the working brief; decisions D1-D3, seam doctrine, prohibitions) + a 4-agent evidence sweep run
> in-session (all file:line facts below re-verified live at `origin/staging` 2026-07-21).
> Operator decisions recorded this session: Part III §9.
> **Authoritative for:** the `rule-tests` surface design (Part I §1-§6), the `ecosystem-wiring`
> umbrella design contour (Part II §7-§8), cross-umbrella sequencing + this session's decision
> records (Part III §9-§13).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> The relational-IR design — see [research-patches/2026-07-21-ir-unfreeze.md](../../meta-factory/research-patches/2026-07-21-ir-unfreeze.md)
> (THIS spec's §9 R3 records the owner resolution; that patch + the [ir-unfreeze kickoff](../../../.claude/orchestrator-prompts/ir-unfreeze/kickoff.md)
> own the IR change itself). Staleness detection — [deps-hash-check.sh](../../../.claude/hooks/deps-hash-check.sh)
> (shipped, #1070). The MT narrow-core doctrine — [2026-07-03-multi-toolchain-convention-compiler-design.md](2026-07-03-multi-toolchain-convention-compiler-design.md) §2-§5.

## §0 Problem

The consumer-facing deliverable chain is detect → research → rules → tests → **skill** (panel D1).
The skill is the missing third deliverable: the consumer AI's interface to what the framework
generated. Two holes (panel §3 Strike 2): consumer-side — author/repair test data for an EXISTING
generated rule without re-running the full research pass; framework-side — regenerate live-fired
evidence when a toolchain pin bump turns the freshness gate RED. Additionally (operator,
2026-07-21): the generator engine itself is lab-proven for all three stacks but not wired into the
consumer install path — the skill's "knows your stack" promise requires that wiring, so this design
covers both the skill surface (Part I) and the wiring umbrella contour (Part II).

Constraints inherited from the panel (violating these re-opens closed findings): D2 — the skill is
static + universal, NEVER generated per-stack (a generated skill is a preset; presets rot);
knowledge classified by the invalidation test (world → data; toolchain interface → adapter code;
spec → skill); two-root split honesty — consumers lack the validator CLI and firing runners;
verify-half = deterministic recipe quoting tool verdicts, zero LLM adjudication; no third
freshness ledger.

---

## Part I — the `rule-tests` surface

### §1 Scope & deliverables

1. **`.claude/skills/rule-tests/SKILL.md`** — thin trigger (~30 lines, mirror pair to
   `rule-research`), shipped via the existing procedure-plane (`install.sh --refresh`). Body holds
   ONLY: the stack-invariant procedure, format POINTERS (never copies), run-moment reading
   obligations **scoped per root** (consumer root: the delivered dossier + the shipped honesty
   surface in item 2; framework root: the per-backend `capability-matrix.json` files — matrices
   are NOT delivered to consumers today, grep setup.d/install.sh = zero hits, so a
   consumer-facing read obligation on them would ship a non-executable instruction), and the
   honesty discipline. SKILL.md stays a thin trigger (~30 lines, matching the rule-research
   precedent) — the D3 consent script and per-lane honesty statements live in item 2, not here.
2. **`agents/rule-test-author.md`** — the ONE protocol document (write-half). LLM allowed only
   here, behind provenance gates. Carries the prose honesty map v0 (§4), the D3 consent script
   (§6), and the per-lane honest-limits statements. New file → doc-authority
   header required (principle 09 walks `agents/*.md` via readdirSync — no static-list edit) + an
   Artifact Ownership Contract row (CLAUDE.md) for the consumer-facing agent.
3. **Framework-side evidence-regeneration runbook** (§5) — a `.claude/rules/` verified-recipe
   (Class B). NOT shipped to consumers (`.claude/rules/` is NOT shipped — the load-bearing
   statement is setup.d/lib.sh:55-57; the contrary comment at setup.d/10-skills.sh:193 is stale —
   no copy step exists, grep-verified — surfaced as a repo-hygiene observation, not fixed here).
4. **Staleness seam** (§6) — one routing clause in the deps-hash WARN + the consent script in
   the shipped protocol doc (item 2), triggered by the skill.
5. Micro-deliverable: one routing line in the flagship `/getff` skill body
   ([skills/getff/SKILL.md](../../../skills/getff/SKILL.md)) pointing to `/rule-research`
   (regeneration) and `/rule-tests` (test repair). Body text only — the `description:` trigger
   surface is NOT touched (no over-fire risk). Rationale: `/getff` is the product front door
   already shipped to every consumer (setup.d/10-skills.sh:12-31); a consumer who remembers only
   the product name reaches the right procedure.

Naming (operator-ratified): skill `rule-tests`, umbrella `rule-tests-surface`, protocol
`agents/rule-test-author.md`. `universal-*` rejected (T16 on naming — universality is an earned
per-cell matrix claim, not a name).

### §2 Consumer write/repair half

The skill's consumer promise: *"write or repair the test material for an EXISTING generated rule,
verify it with your lane's deterministic check, quote the tool verdict."* Per lane (two-root
honesty — the consumer has only what install delivers):

- **npm lane (works today).** Test material is incumbent in
  `.ai-factory/synthesizer-output/rules-manifest-additions.json` — `negative-test {input[],
  'expect-violation'}` + `examples{bad,good}` per rule (synthesizer/types.ts:22-26,67-68).
  Load-bearing fact: `canonicalRuleHash` covers ONLY `{title, check, examples}`
  (canonical-rule-hash.ts:25-31; verify-provenance.ts:108-110 confirms extra manifest fields are
  ignored) — **a consumer repair of `negative-test` is hash-exempt**; the S5 anti-hand-edit gate
  does not fire. Verification = the shipped `scripts/run-generated-rule-mutation.sh` (11 selector
  perturbations, ≥60% kill floor; delivered by setup.d/40-configs.sh:61-62 + npm script
  `test:mutation:generated` via setup.d/70-deps.sh:70). Deterministic; verdict quoted.
- **astgrep / ruff lanes.** Rule configs are delivered (`.getff/astgrep-rules/*.yml`,
  `.getff/ruff-bans.toml` via setup.d/45-python.sh) but ZERO test material ships today. Home for
  it = the enrichment sidecar (§3). Verification = firing test via the tool verdict (`ast-grep
  scan --json` exit/ruleId; `ruff check --output-format=json` codes) — zero LLM adjudication.
- **cargo lane.** No consumer delivery seam exists yet (grep clippy/rust/cargo over setup.d +
  install.sh = empty). Until Part II W4 lands, the skill states this honestly ("cargo lane not
  delivered yet — see ecosystem-wiring") instead of pretending. Interim only: the wiring umbrella
  closes it (ship order §10).

**Single-rule isolation rule (binding for the protocol).** Reported codes alias across rules on
ruff (`TID251`/`TID253` for every ban) and cargo (`clippy::disallowed_methods` for every method
ban) — only astgrep reports per-rule ids. Firing the rule-under-repair therefore runs in
single-rule isolation: a temp dir with ONLY that rule rendered plus the sidecar's code samples
(the mkdtemp + plant-src mechanic already proven in
backends/astgrep/live-generation-delivery.test.ts:188-241, which constructs the contract in
memory with `expectedCode = <ruleId>`). Without isolation, cross-rule interference produces false
green/red.

**Write-half protocol flow** (`agents/rule-test-author.md`): read the delivered rule artifact →
write/repair the material (npm: manifest entry; astgrep/ruff: sidecar §3) → run the lane's
deterministic verification in isolation → quote the verdict verbatim. The protocol never edits the
rule artifact itself (drift/hash-gated); it edits test material only.

**Standing consumer-side channel (repair must fail somewhere without an invocation).** Repair is
hash-exempt by design (above) and `test:mutation:generated` is on-demand-only — without a
standing arm, a skipped or theatred protocol run leaves broken material failing at NO channel
(`#hope-as-gate`, against README's earliest-reachable-channel invariant). The umbrella therefore
ships a **guarded pre-push arm** in the consumer channel: run `test:mutation:generated` when the
manifest exists (npm) and fire the sidecar samples in single-rule isolation when a sidecar exists
and the lane's tool is present (astgrep/ruff) — loud-skip otherwise. Cargo is excluded from the
DEFAULT arm — not for toolchain absence (a Cargo-project consumer has cargo/clippy by
definition) but for compile cost: `cargo clippy` implies a real compilation on every push. It
ships as an opt-in guarded arm instead; excluded-by-default is the recorded accepted-degradation,
promotion trigger = first incident of silently-broken repaired cargo material.

### §3 Enrichment sidecar (non-npm test material)

The pattern already exists twice in the codebase — this design formalizes it, adding no IR change:
`to-node.ts:184-185` declares `negative-test`/`fixture`/`liveness-mode`/`pressure-scenario` "pure
enrichment, never in the node" (merged around the frozen IR by `mergeEnrichment`); the committed
practice record (`getff-researched-no-yaml-load.practice.json`) is one record carrying `entryId`
+ `examples{bad,good}` outside the node, and the firing fixtures "mirror" them.

- **Shape:** one map file per backend, `ruleId → { bad: string[], good: string[] }`. Multiple
  `bad[]` entries = bypass variants (mirrors npm's `negative-test.input[]`).
- **Home:** `.ai-factory/rule-tests/<backend>.json` — data-plane, consumer-owned, regenerable.
  NOT under `.getff/` (framework-owned; `_py_copy_or_refresh` clobbers on re-run — evidence risk).
  In the framework repo `.ai-factory/` is gitignored, so the framework's own instances live with
  the live-generation fixtures (committed path precedent, render-researched-astgrep.ts:52-66).
- **Seeding:** from the node's mandatory `pairedExamples` at generation time; the write/repair act
  edits the sidecar only.
- **Firing:** the existing parameterized `fireContract(contract, dir)` with a per-rule contract
  built in memory (astgrep: `expectedCode = ruleId`; ruff/cargo: single-rule isolation per §2 —
  the committed per-backend `firing-contract.json` files are NOT grown; their shape is reused at
  fire time). The three contract shapes stay distinct (npm `expectedRuleId` in-process; cargo/
  astgrep `expectedCode`; ruff `expectedCodes[]` family) — a per-backend expectation adapter in
  the recipe, never a flattened field.
- This is a NEW committed format → the umbrella's first capability commit carries the BFR/SSOT
  consult + `Prior-art:` trailer (as planned; not done in this design session).

### §4 Honesty map (per-backend verify coverage)

Resolves the panel's Strike-3 trilemma: **(a) prose now, with a recorded promotion trigger and a
pinned promotion target** — option (c) omission is shipped `#discipline-theatre`, excluded;
option (b) data-day-one was O1 option C, not ratified.

- **v0 (prose, in `agents/rule-test-author.md`):** npm lane = **8 executed L4 gate modules**
  (validate.ts:22-42: schema, ruleTester, tautology, conflict, singleTokenDiff,
  messageIdCoverage, autofixClean, requireVacuity — cite this, not the stale "6 gates" file
  header nor architecture.md's 9-slot numbering); astgrep-declarative = **5 deliberate
  defer-refusals** FF3003/3010/3012/3015/3018 (diagnostics/registry.ts:180-259) — phrased as
  refusals inside the npm-lane validator, NEVER "astgrep has 5 gates"; ruff = one fixed rule
  *family* (TID251+TID253); cargo = one fixed rule (`clippy::disallowed_methods`) + live-fire is
  a dev-machine gate, loudly skipped in CI.
- **Promotion trigger (recorded):** the second forced edit of this prose map before the umbrella
  closes → promote to data.
- **Promotion target (pinned by evidence, so the promotion PR does not re-research):** a
  **top-level sibling section of `cells`** in each `capability-matrix.json`. Additive-safe: all 7
  readers use JSON.parse + `as CapabilityMatrix` + keyed access; the only iteration anywhere is
  over `m.cells` (validateMatrix:49 + the checkToolchainFreshness copies); no ajv schema for the
  matrix exists. Hard constraints: never a pseudo-cell under `cells` (validateMatrix forces the
  status/evidence contract and the 4 always-on tests go RED); the TS field is OPTIONAL (~23
  object-literal constructions across the four backend test files fail compile otherwise); and —
  because matrices are NOT delivered to consumers today (§1 item 1) while the v0 prose home
  ships — **the promotion PR must also deliver the promoted map (the verify section, or the
  matrices) into the consumer dossier as data-plane**, so promotion never moves consumer-facing
  honesty content off the shipped surface.

### §5 Framework-side evidence-regeneration runbook

**Form:** a `.claude/rules/` verified-recipe, Class B (precedent:
[git-conflict-merge-forward.md §2](../../../.claude/rules/git-conflict-merge-forward.md)) — with a
Fires trigger, numbered steps, a safety interlock, and verify commands. NOT `agents/*.md`
(agents ship to consumers by default via setup.d/20-agents.sh; this procedure runs only in the
framework checkout; and there is nothing to adjudicate — per attention-is-not-a-mechanism §1 the
named-cold-agent branch is for semantic judgment, which a command recipe does not need). NOT a
script yet (BFR expensive branch; promotion trigger = a second regen-friction incident).

**Entry conditions (two, named precisely):** (i) a toolchain-freshness gate goes RED
(checkToolchainFreshness — evidence toolchain string ≠ the version resolving at test time; exists
for ruff/astgrep/eslint, fires in CI via the pinned installs and at pre-push for eslint); (ii) a
🟡 rendered-not-fired cell needs first-fire evidence. Terminology correction over the panel
synthesis: stale evidence is a hard RED today, not a 🟡 — 🟡 means "rendered, no firing evidence
at all" (defined at enforcement-line.ts:34-49; the FF8004 gate's deliberate non-firing on 🟡
lives at composition/gates/composition-gate.ts:143-158, tested in composition-gate.test.ts).

**The loop (per backend):**
1. Install locally the version **CI will resolve** — CI is the authoritative resolver (incident
   #1033→#1041: a regen against a stale host-local eslint had to be reverted).
2. Re-fire the committed invalid fixture with the firing-contract command (astgrep/ruff/cargo
   spawn; npm in-process `npx vitest run backends/npm/firing`).
3. Rewrite ONLY the evidence block in `backends/<b>/capability-matrix.json`: `date` = today,
   `toolchain` = the string the live `--version` reports, `capturedDiagnostic` = one exemplar
   **pasted from the fresh step-2 stdout** (anti-theatre: #1033 changed date+toolchain while the
   diagnostic stayed byte-identical — the gates cannot catch that; the runbook requires the paste
   AND quoting the fresh stdout in the PR body).
4. Deterministic verify, quoting verdicts: `npm --prefix packages/core run test:backends` (+
   `test:composition` for the FF8004 coherence gate).
5. ONE commit: pin-site edit + matrix (+ fixtures/parser if the diagnostic shape moved) — a split
   commit leaves CI RED in the window.

**Cargo arm (interim):** today no freshness gate exists for rustc and live-fire is skipIf(CI) —
the cargo regen is dev-machine-only and the runbook requires quoting the dev-machine run in the
PR body (T-MT-C discipline). This is an INTERIM state: ecosystem-wiring W4's CI arm (§7) installs
the pinned toolchain in CI, un-skips cargo live-fire, and adds the rustc freshness gate — after
which the cargo arm of this runbook is CI-verified exactly like ruff/astgrep. Pin sites
enumerated in the runbook: audit-self.yml:232/:242 (astgrep/ruff), packages/core/package.json
(eslint), `rust-toolchain.toml` in the cargo fixtures (rustc).

This loop is the umbrella's recursive self-application anchor (O1=B): the framework is the
skill's first consumer — the runbook's first execution regenerates the framework's own matrices.

### §6 Staleness seam (D3 consent flow)

Split exactly along ownership (no third ledger — both freshness facts already exist as committed
state; the gap is a missing router and a missing reader):

- **deps-hash side (one explicitly-scoped stage; the deps-hash-multistack umbrella is CLOSED
  (#1070) so this is a scoped follow-up on the shipped artifact, not a drive-by):** ONE
  conditional suffix clause appended inside the existing single WARN emission
  (deps-hash-check.sh:284-288) — when a cheap bash glob finds
  `.ai-factory/synthesizer-output/rules-lock*.json`, append "generated rules may be stale — run
  /rule-tests to review". Constraints from evidence: ZCode parses exactly ONE JSON object per
  hook run (a second `_emit_warn` breaks it — §3a M2); the hook exists as THREE byte-identical
  copies (packages/core SSOT + .claude dogfood + plugin twin) — source↔dogfood byte-identity is
  guarded by deps-hash-check.test.ts:508-518, and the plugin twin is regenerated by
  scripts/generate-plugin-twins.sh at pre-commit (.husky/pre-commit:160), a separate mechanism;
  the WARN text is quoted verbatim in 2 SKILL.md prose sites (tool-bootstrapping, both copies) —
  the stage sweeps all of them.
- **skill side:** the D3 script — detect → explain → offer → run-on-consent (script text lives
  in `agents/rule-test-author.md`, the shipped surface; SKILL.md stays the thin trigger per §1).
  The skill is a pure READER of the two existing ledgers: `tool-decisions.md` frontmatter baselines (ledger 1) and
  `rules-lock.<framework>.json` `emittedAt`/`sourceFingerprint` + research-plan `fetchedAt`
  (ledger 2 — all three values are write-only today; this skill is their first reader). On
  consent it routes to the regeneration procedure (rule-research → `./setup --full` → verify).
  That route COMPOSES with tool-bootstrapping exactly as the existing stack does
  (agents/rule-researcher.md: "stage 1 acquires the research tools, stage 2 uses them"):
  tool-bootstrapping provisions the research channels (context7/deepwiki MCP) that rule-research
  rides, with rule-research's own WebSearch/WebFetch fallback when they are absent. rule-tests
  itself needs no research channels (write-half works on already-generated material; verify-half
  is tool verdicts) — pulling them in would duplicate stage 1, against Q2.
  The D3 falsifier flip (consent offers systematically ignored → opt-out auto) is implemented, if
  ever, as a skill-config default — never in the hook.
- **Honest limits (stated in the shipped protocol doc, quoted at offer time):** the signal covers the deps-drift staleness class
  only (doc-age staleness has NO detector today); `sourceFingerprint` hashes the SynthesisPlan,
  not the fetched docs — the consent text presents `emittedAt`/`fetchedAt` as the age facts and
  never presents the fingerprint as doc freshness; the hook is silent when
  `.ai-factory/tool-decisions.md` is absent.

---

## Part II — the `ecosystem-wiring` umbrella (design contour)

### §7 Scope (the operator's 5-link chain, minus what exists)

Generation (link 3) is DONE for all three stacks (live-generation umbrella closed: LG-S1 python
#1005, LG-S2 js/ts #1006, LG-S3 rust #1010 — `research-to-clippy-node.ts` +
`render-researched-clippy.ts` merged, local live-fire RED). Staleness detection is DONE (#1070).
The umbrella wires the rest:

- **W1 — detect (link 1).** Widen stack detection beyond `package.json`: read `pyproject.toml`
  (PEP 621/508 + Poetry) and `Cargo.toml`; detect python frameworks (fastapi, sqlalchemy, …) from
  dependencies. Today `Stack = 'react-next' | 'ts-server' | 'unknown'` (detector/types.ts:5) and
  every read-manifest/passport path reads only package.json. The exact widened type shape (enum
  literals vs a `{toolchain, framework}` pair per the MT `{toolchain, stack}` direction) is the
  umbrella's S1 decision, made against a live census of `Stack`-type consumers — this spec fixes
  the requirement, not the type shape. **Delegation criterion** (why this shape is
  stage-delegable while the IR shape was owner-escalated): `Stack` is not a frozen artifact — no
  freeze line, no STOP-lines, no byte-locks; its consumers are compile-time TS surfaces the
  compiler enumerates and the choice is reversible pre-ship. `ConventionNode` is an explicitly
  FROZEN cross-umbrella contract (ir/types.ts:3) with 24 consumers + byte-exact locks — hence the
  owner precondition there. (Operator may still pull this decision up at spec review.)
- **W2 — wire the adapters (link 4a).** Thread `ecosystem-python.ts` + `ecosystem-cargo.ts` into
  the production `ResolveCtx` — BOTH together (owner decision 2026-07-17: "wire both later, not
  piecemeal"); decrement the `ecosystem-unwired-debt.test.ts` BASELINE 2→0 in the same PRs
  (tripwire semantics: strict `===`, both growth and partial-wiring go RED).
- **W3 — python live delivery (link 4b).** Live-generated python rules ride the EXISTING consumer
  seam shipped by python-delivery-v0 (`.getff/astgrep-rules/` + sgconfig merge + ruff-bans) — the
  umbrella connects live output to that seam + the python rules-lock variant. No new delivery
  channel. Dedup verified: python-delivery-v0 is CLOSED and its scope boundaries explicitly
  deferred exactly these items behind recorded triggers; the live-adapter trigger ("first
  consumer asks for researched-not-starter Python rules") was pulled by the operator 2026-07-21.
- **W4 — cargo delivery lane + CI arm (link 4c).** No setup.d rust slice exists (verified: grep
  rust/cargo/clippy over setup.d + install.sh = empty). A 45-python-style slice delivering
  clippy.toml/deny surface + the cargo rules-lock variant. **CI arm (operator challenge
  2026-07-21, superseding the LG-S3-era "dev-machine-only" caveat):** rust in CI is feasible and
  matches the repo's own posture — the audit-self.yml comment "No Rust toolchain is installed on
  this runner" records an MT-S2-era state, not a physical limit; the runner is plain
  ubuntu-latest and the ast-grep/ruff precedent (hard exact-pinned installs,
  audit-self.yml:232/:242, ci-tool-pinning Rule A) extends directly. W4 therefore: installs the
  pinned toolchain in CI (`rustup toolchain install 1.96.1` + clippy component + cache), un-skips
  the cargo live-fire there (retiring the skipIf(!cargoPresent) reliance in CI), and adds the
  missing rustc toolchain-freshness gate (deriveToolVersion analog — closing the "no freshness
  gate for rustc" hole named in §5). Until W4 lands, the LG-S3 dev-machine + PR-quote discipline
  (T-MT-C) is the interim, not the end state.
- **W5 — live-adapter Phase 1 (link 2).** Coordinate with the EXISTING Phase-0 spec + kickoff on
  branch `feat/rule-research-live-adapter` (worktree `rat-rule-research`; Phase 0 recorded DONE
  in operator memory). The umbrella REFERENCES and sequences that work — it does not re-design
  it. Re-verify the branch content at kickoff-authoring time (T3).

### §8 What wiring must NOT touch

- The `rule-tests` skill artifact — zero edits when a lane wires. This is the D2 acceptance test
  (and the T-UTS-A tripwire): if wiring a stack requires editing the skill, the skill has leaked
  stack knowledge.
- The frozen/unfrozen IR — relational expressibility is ir-unfreeze's scope (Option B recorded);
  wiring does not add node fields (`ir/types.ts:3` discipline persists until ir-unfreeze S1).
- No new runners, no third freshness ledger, no per-stack skill generation.

---

## Part III — sequencing, decisions, self-application

### §9 Decision records (operator, 2026-07-21, this session)

| # | Decision | Falsifier ("wrong if …") |
|---|---|---|
| R1 | O1 = **B**: consumer write/repair skill + framework-side evidence-regeneration procedure | a documented recurring consumer-side verify invoker existed (panel found none); or the prose honesty map forces a second edit pre-closure (then C was right — promote per §4) |
| R2 | Naming: `rule-tests` / `rule-tests-surface` / `agents/rule-test-author.md`; flagship `/getff` untouched except one routing line (delegated decision, operator-overridable) | consumer evidence that the body routing line mis-routes (e.g. sessions invoke /rule-tests for rule CREATION); or operator restructures the flagship (separate product decision) |
| R3 | **OWNER-FORK-1 resolved: UNFREEZE + Option B** (structured relational rule-object). Choosing a shape = choosing to unfreeze; recorded here + in the ir-unfreeze kickoff header. Stages still may not re-decide (kickoff STOP lines stand) | relational stays astgrep-only in practice for 6+ months (tree = speculative generality; A would have sufficed); or the 24-consumer exhaustiveness audit costs more than a later A→B migration would have |
| R4 | Scope widened: this design also contours the `ecosystem-wiring` umbrella (Part II) | — (operator overturn of Q2's narrow reading; recorded, not inferred) |
| R5 | **Ship order: wiring-first.** `ir-unfreeze` ∥ `ecosystem-wiring` dispatch first (independent, parallel); `rule-tests-surface` ships after the wiring delivery stages land, so the skill launches against a wired any-stack generator | wiring stalls while npm-lane consumers ask for the skill — then ship the skill early with the honest lane map (npm works today) |

### §10 Sequencing

Three streams; the full FastAPI-class story needs all three:

1. **`ir-unfreeze`** — UNBLOCKED by R3. Kickoff exists; dispatch per its own §0 re-verify
   obligations. Raises expressibility ~40%→93.3% (LG-S1 census; N+1 / session-without-close
   class).
2. **`ecosystem-wiring`** — NEW (kickoff to be authored at exit). Independent of ir-unfreeze;
   without it, wired stacks generate the flat ~40% subset — still real rules.
3. **`rule-tests-surface`** — design decoupled from both (the three prohibitions: no
   rendered-byte asserts; `params` opaque pass-through; relational out of scope). Ship order per
   R5.

**Cross-umbrella collision rule (R5 refinement).** ir-unfreeze S2/S3 and ecosystem-wiring W3
move the SAME generated artefacts — `render-astgrep.ts` emission,
`python-templates-drift.test.ts`, snapshot/byte-locks, the astgrep delivery seam — the PR #1058
CONFLICTING recurrence class (git-conflict-merge-forward.md §Origin/§4). Binding: the
astgrep-emission-touching STAGES serialize — whichever umbrella reaches that stage second first
merges the other's landed state and re-fires its DoD against the CURRENT emission behaviour
(W3's "plant violation → RED" is defined against whatever emission is live at its landing time);
both kickoffs name each other in their pre-dispatch in-flight probes; recovery on a CONFLICTING
PR is merge-forward, never rebase. Umbrella-level parallelism stands — only the named stages
serialize.

**Staging placement.** No stream dispatches until this design PR (spec + the ir-unfreeze kickoff
record + the two new kickoffs) merges to staging (kickoff-staging-placement.md §1); the
ir-unfreeze header's own "DISPATCHABLE once this record is on staging" condition is exactly this
gate.

### §11 Testing & self-application

- **Skill/protocol:** the write-half protocol is exercised first BY the framework on its own
  live-generation fixtures (repair the `getff-no-yaml-load` sidecar, fire in isolation, quote the
  verdict) — recursive self-application before any consumer sees it.
- **Runbook:** first execution = regenerating the framework's own matrices at the next real pin
  bump (or a rehearsal on the current pins — expected no-op diff, which is itself the test).
- **Seam stage:** deps-hash-check.test.ts extended for the new clause (three-copy byte-identity +
  gated-glob behavior); the 2 prose quote sites swept in the same PR.
- **Sidecar:** capability commit ships with its own firing test (bad[] fires, good[] clean, in
  isolation) per the paired-negative discipline.
- **Standing pre-push arm (§2):** ships with a guarded-skip test (tool absent → loud skip, not
  silent green; tool present + broken material → RED).
- **Wiring umbrella:** each W-stage carries its own DoD (W2: BASELINE 2→0 same-PR; W3/W4:
  scratch-consumer install → plant violation → tool fires RED; W4 additionally lands the CI arm —
  pinned rust toolchain + un-skipped cargo live-fire + rustc freshness gate green in CI — after
  which no lane's evidence is dev-machine-only).

### §12 Non-goals

**CI-host portability (named gap, not silent).** The delivered CI layer is GitHub-Actions-only
today (`.github/workflows/getff-python.yml`, setup.d/45-python.sh:294-307; no `.gitlab-ci.yml`
template ships). A GitLab consumer gets every EARLIER channel unchanged — edit-time, pre-commit,
pre-push, session hooks are git-native and host-agnostic — and loses only the last-resort CI
backstop, which they must author themselves. Consistent with invariant 4 (CI = last resort), but
recorded: trigger to ship a `.gitlab-ci.yml` twin = first GitLab consumer. Out of both umbrellas'
scope.

No per-stack generated skill (D2 / T-UTS-A). No union-IR / new IR fields outside ir-unfreeze. No
new runners ("we build no runner" — MT §5). No third freshness ledger. No doc-age staleness
detector (named absent, §6 — a future trigger, not silent scope). No mutation-operator
generalization (stays bash until a second rule-language exists). No CI LLM calls anywhere
(no-paid-llm-in-ci).

### §13 §1.7 self-reflexive note

**Forward-check:** this spec introduces no capability commit itself (design doc; the sidecar
format + wiring commits land in the umbrellas WITH BFR/SSOT consults + `Prior-art:` trailers —
recorded obligation, §3/§7). Complies with: no-paid-llm-in-ci (all verification is deterministic
gates or session-side agents); doc-authority-hierarchy (this header; the new agent file will carry
its own); attention-is-not-a-mechanism (honesty map promotion is error-class data or agent-read
prose, never a warning nobody reads; the WARN clause routes to a named procedure);
rule-enforcement-channel-selection (runbook = recipe + existing RED gates at pre-push/CI;
edit-time injection not applicable); build-first-reuse-default (every §-level choice reuses an
existing mechanism: enrichment precedent, fireContract, verified-recipe form, existing WARN,
existing delivery seams; the one new format is deferred to a gated capability commit);
kickoff-staging-placement (kickoffs authored at exit merge to staging BEFORE any dispatch).

**Backward-check.** Class of this change = "a design spec that scopes future umbrellas over
existing shipped surfaces without modifying them". Surfaces where the class occurs (peer specs +
the artifacts this spec cites as unchanged): `2026-07-03-multi-toolchain-convention-compiler-design.md`
— SWEPT-CLEAN: narrow-core + capability-matrix doctrine is load-bearing input here (§3 sidecar
respects params-opaque; §4 extends the matrix additively), no contradiction;
`research-patches/2026-07-21-ir-unfreeze.md` + `ir-unfreeze/kickoff.md` — EXTENDED, not
contradicted: R3 records the owner resolution those artifacts explicitly wait for (their STOP
lines remain for stages); `live-generation/done.md` Gap log — CONSUMED: Part II is exactly its
"future umbrella" (a); `python-delivery-v0/kickoff.md` scope boundaries — CONSUMED: W3/W5 are its
deferred-behind-trigger items, trigger pulled by the operator; `deps-hash-multistack/done.md` —
EXTENDED via one scoped WARN clause (§6), no ledger added; `skills/getff/SKILL.md` — one body
line (§1 item 5), triggers untouched. GAP-FOUND: none — no surface in the class is silently
superseded.

**Self-application (T15):** the spec's own subject is separating slow procedure from fast data —
it practices this: every fast-aging fact above carries a file:line re-verified 2026-07-21 and the
design binds to invariants (hash-exemption scope, single-emission constraint, cells-iteration
strictness) rather than to line numbers.
