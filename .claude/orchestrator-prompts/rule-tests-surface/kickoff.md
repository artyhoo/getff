<!-- scope: kickoff — rule-tests-surface umbrella. Design base (BINDING): docs/superpowers/specs/2026-07-21-rule-tests-surface-design.md Part I (§1-§6) + Part III (§9-§12). Cold-reviewed GO×2 + reuse-audit clean, 2026-07-21. Ship order: R5 wiring-first — see §0 dispatch gate. Tier 2 (no bridge-profile marker; top tier plans, executor implements). -->

# rule-tests-surface — kickoff

> **Goal:** ship the third consumer deliverable — the `rule-tests` skill surface: write/repair
> test material for an EXISTING generated rule (consumer half) + the evidence-regeneration
> runbook (framework half) + the D3 staleness consent seam. Full design: the spec above; this
> kickoff is the dispatch input, NOT a design restatement (source-before-shape).
> **What exists (verified at design time, re-verify live per T3):** npm-lane test material
> incumbent + hash-exempt (`canonical-rule-hash.ts:25-31`); enrichment precedent
> (`to-node.ts:184-185`); parameterized firing (`fireContract` + mkdtemp mechanic,
> `live-generation-delivery.test.ts:188-241`); shipped mutation script; deps-hash WARN
> single-emission (`deps-hash-check.sh:284-288`); 8 npm L4 gates (`validate.ts:22-42`); astgrep
> defer-refusals FF3003/3010/3012/3015/3018.

## §0 Dispatch gate + in-flight probe (BINDING)

- **Staging placement:** this kickoff + the spec MUST be on `origin/staging` before any dispatch
  ([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)).
- **Ship order (spec R5):** S1-S5 dispatch AFTER ecosystem-wiring delivery stages (W3) land, so
  the skill launches against a wired generator. Operator-invokable falsifier: if wiring stalls
  and npm-lane consumers ask, dispatch early with the honest lane map (spec §2).
- **Pre-dispatch in-flight probe** (CLAUDE.md operational conventions) MUST explicitly cover:
  `ecosystem-wiring` (shared surfaces: deps-hash hook copies, `.getff/` delivery paths) and
  `ir-unfreeze` (no shared files, but re-probe after any Phase -1 review). Re-probe immediately
  before dispatch.

## §1 Stages (each = one PR onto staging; do NOT collapse)

- **S1 — protocol + skill trigger.** `agents/rule-test-author.md` (write-half protocol; honesty
  map v0 prose per spec §4 with the exact FF facts; single-rule-isolation rule; consent script
  per spec §6) + `.claude/skills/rule-tests/SKILL.md` (~30-line thin trigger, per-root reading
  obligations per spec §1). New agent file: doc-authority header (principle 09 walks agents/) +
  Artifact Ownership Contract row. First capability commit → BFR/SSOT consult + `Prior-art:`
  trailer (spec §1 obligation).
- **S2 — enrichment sidecar.** `.ai-factory/rule-tests/<backend>.json` map format (spec §3):
  seeding from `pairedExamples`, isolation firing via in-memory contracts, own firing test
  (bad[] fires / good[] clean). NEW format = capability commit: BFR consult (check
  `capability-matrix.json` extension FIRST per spec §4) + SSOT row + trailer.
- **S3 — evidence-regeneration runbook.** `.claude/rules/` verified-recipe (spec §5, Class B,
  git-conflict-merge-forward §2 form): 5-step loop, CI-resolving-version rule, paste-from-fresh-
  stdout anti-theatre rule (#1033 lessons), cargo-arm interim note. First execution/rehearsal on
  the framework's own matrices = the umbrella's recursive self-application (expected no-op diff
  on current pins IS the test).
- **S4 — staleness seam.** ONE WARN suffix clause gated on a bash glob (spec §6) — landed in ALL
  THREE hook copies (packages/core SSOT + .claude dogfood + plugin twin via
  generate-plugin-twins) + deps-hash-check.test.ts extension + sweep of the 2 tool-bootstrapping
  SKILL.md prose quotes. Coordination note: deps-hash-multistack umbrella is CLOSED — this stage
  is the explicitly-scoped follow-up on the shipped artifact.
- **S5 — standing arm + routing + closure.** Guarded consumer pre-push arm (spec §2: npm
  mutation + astgrep/ruff sidecar firing, loud-skip; cargo opt-in — compile cost, not absence) +
  the one `/getff` body routing line (triggers untouched) + umbrella `done.md` (CLAUDE.md
  closure convention).

## §2 «Works» per stage (explicit + testable)

S1: protocol executed by the framework on its own live-generation fixture (repair
`getff-no-yaml-load` material → fire in isolation → tool verdict quoted). S2: sidecar firing
test green both directions. S3: rehearsal run quoted in PR body. S4: three-copy byte-identity
green + gated-glob behavior tested + ZCode single-JSON preserved. S5: guarded-skip test (tool
absent → loud skip, NOT silent green; tool present + broken material → RED).

## §3 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps
for this umbrella: T3, T7, T11, T14, T15, T19, T20, T21.**

- **T3/T20** — every file:line above re-verified live at stage time; no «works» claim without
  the quoted tool verdict.
- **T11** — S2's format is a capability commit: BFR consult + SSOT row BEFORE the format lands;
  check the existing `capability-matrix.json` extension path first.
- **T14** — a clean-looking lane with low verify coverage is reported as «coverage insufficient»
  per the honesty map, never as «clean».
- **T15** — the framework is the skill's FIRST consumer (S1/S3 self-application is mandatory,
  not optional).
- **T21** — stage backward-checks enumerate sibling surfaces (hook copies, prose quote sites,
  both SKILL.md twins), never restate the stage diff; delegate to the cold backward-sweep
  auditor.

**Domain-specific traps:**

- **T-RTS-A — «the skill quietly acquires stack knowledge»** (D2 inversion; T-UTS-A lineage,
  spec §0). If implementing a stage requires writing a toolchain name or stack fact into
  SKILL.md, STOP and surface — that content belongs in data or the protocol's honesty map.
- **T-RTS-B — «repair edits the rule artifact»**. The protocol edits TEST MATERIAL only; the
  rule artifact is drift/hash-gated. A stage that touches the emitted rule to «make the test
  pass» has inverted the discipline — STOP.
- **T-RTS-C — «verify theatre»**: claiming a repair verified without the isolation run + quoted
  verdict (aliasing codes on ruff/cargo make a non-isolated green MEANINGLESS — spec §2).

## §4 STOP lines (binding)

- NO per-stack skill generation; NO new IR fields (`ir/types.ts:3`); NO third freshness ledger;
  NO second WARN emission (ZCode single-JSON, spec §6); NO paid LLM in CI.
- The consent default is D3 (offer → run-on-consent); the opt-out-auto flip, if ever, is a
  skill-config change with operator sign-off — never a hook change.
- Honesty-map promotion (prose → data) fires ONLY on the recorded trigger (second forced edit)
  and MUST ship the promoted map to the consumer dossier (spec §4).

## §5 See also

- [docs/superpowers/specs/2026-07-21-rule-tests-surface-design.md](../../../docs/superpowers/specs/2026-07-21-rule-tests-surface-design.md) — the BINDING design.
- [.claude/orchestrator-prompts/ecosystem-wiring/kickoff.md](../ecosystem-wiring/kickoff.md) — the co-dispatched wiring umbrella (mutual probe obligation).
- [docs/meta-factory/research-patches/2026-07-21-universal-skill-panel-synthesis.md](../../../docs/meta-factory/research-patches/2026-07-21-universal-skill-panel-synthesis.md) — decisions D1-D3 + seam doctrine.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
