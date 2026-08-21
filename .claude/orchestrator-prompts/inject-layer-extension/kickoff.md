# KICKOFF — inject-layer-extension (G1 ship-boundary, DN-3)

> **Type:** R-phase-first BUILD umbrella. **PLAN NOW, IMPLEMENT LATER** (maintainer 2026-06-02: «это цель — спланировать, написать кикоф, реализуем потом в конце»).
> **Status:** PLANNED — not dispatched. Implementation is deferred to the end of the current roadmap; this kickoff is the standing plan.
> **Origin:** doc-audit-ship-boundary Stage 2 findings §G1-T16 + §DECISION-NEEDED DN-3 (BUILD-SIZED verdict). Maintainer confirmed it is a real goal item, not a defer-forever.
> **Base branch:** `staging` (NOT main — main is prod, manual promote).

---

## §0 Why this exists (the goal connection)

The project goal ([README.md#why-this-exists](../../../README.md#why-this-exists)) promises consumers a **self-installing conscience** — undocumented conventions become executable artifacts that fire at the earliest reachable channel. The G1 ship-boundary doctrine (doc-audit Stage 1, decision G1) commits to shipping the **injection layer** as a *stack-aware, self-populating* mechanism.

**The gap (verified by file:line in the Stage 2 findings §G1-T16):** the stack-detect→populate→update loop exists for **tools** (`skills/tool-bootstrapping`) and **testable rules** (`packages/core/detector/`, `research/store/next/*`, `packages/preset-next-15-canonical`) — but the **injection/judgment layer does not auto-populate**. `.claude/hooks/inject-matching-rule.sh` injects rules on Edit/Write, but it reads `<!-- globs: … -->` / `<!-- inject: … -->` markers that a human places **by hand** in each rule. Nothing generates those markers from stack detection.

**This umbrella builds the missing auto-populate step.**

---

## §1 Scope (what to build) — pending the §2 R-phase

Candidate deliverable (to be confirmed/narrowed by R-phase, NOT pre-committed):

- A populate step that takes detector v1 output (`packages/core/detector/`) and **generates `<!-- globs: … -->` / `<!-- inject: … -->` markers** for the applicable per-artifact-class rules in a consumer project.
- Wire re-detection to the existing `deps-hash-check.sh` pattern (re-populate when `package.json` deps change).
- A per-artifact-class rule template (ADAPT from `tool-bootstrapping` template patterns).

**REUSE inventory (from Stage 2 findings — do not rebuild these):** stack detection = `packages/core/detector/` (v1); rule applicability = detector `patterns.ts`/`index.ts`; marker format = `inject-matching-rule.sh`; update trigger = `deps-hash-check.sh`. The **only** new code is the auto-populate generator + its wire.

---

## §2 Stages (R-phase FIRST — build-first-reuse discipline)

### Stage R — prior-art + reuse-vs-build (MANDATORY before any code)
Per [build-first-reuse-default.md §3](../../rules/build-first-reuse-default.md): before building the auto-populate generator, run the 6-layer check —
1. SSOT consult ([prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md)) for marker/rule-injection populate prior art.
2. DeepWiki `ask_question` ≥3 phrasings (OhMyOpencode `rulesInjector`, Cursor `.cursorrules` auto-gen, Aider conventions) — does an upstream already generate stack-scoped rule markers?
3. WebSearch ≥3 phrasings on «auto-generate AI-rule injection markers from project stack».
Output = a research-patch with the BUILD/ADAPT/REJECT verdict + the confirmed reuse boundary. **If an upstream solves it → ADOPT/ADAPT, do not BUILD.**

### Stage I — implement (only if Stage R verdict = BUILD/ADAPT)
TDD the auto-populate generator + template + wire + tests. Capability commit → `Prior-art:` trailer mandatory.

### Stage V — verify on a real consumer
Run the populate step on a fresh `npx` consumer scaffold; confirm markers generated match the consumer's detected stack; `inject-matching-rule.sh` then fires on the right paths.

---

## §3 Why deferred to the end

- The manual marker approach **already works** for the current 11 rules in `.claude/rules/` (Stage 2 finding) — no live breakage.
- BUILD cost is non-trivial (generator + template + wire + tests = a capability commit).
- Consumer demand is **unmeasured** — no consumer report has surfaced the pain yet.
- Sequencing: this is product-shaped work that rests on the now-reconciled doc state + ship-boundary doctrine (G1). It runs after the current roadmap items, per maintainer.

**Re-prioritise trigger:** 2+ consumer reports of «rules not firing because markers weren't placed», OR the ship-boundary doctrine (G1) lands as a committed `.claude/rules/ship-boundary.md` and names this as a blocking dependency.

---

## §5 AI-traps active (per [.claude/rules/ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md))

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active: T11, T12, T13, T16, T15.**

- **T11 (design without prior-art check):** Stage R is mandatory and BLOCKS Stage I — no «I propose a generator» before the 6-layer search.
- **T12 (skip literature sweep — «I know rule injectors»):** WebSearch/DeepWiki at proposal time, not from training memory.
- **T16 (pattern-matching-on-name):** «we have a detector + an injector → populate is covered» is the exact trap — verify the *auto-populate generator* does not exist (Stage 2 finding confirms), don't assume the named components compose into it.
- **T13 (ADOPTED ≠ zero-work):** if Stage R finds an upstream populate tool, still audit whether its problem-class matches (consumer-side marker generation vs authoring-side).
- **T15 (self-application):** the generator must be able to populate markers for *this* repo's own rules as the dogfood test.

**Domain trap — T-INJ-A — «the markers are obvious, skip the template».** Tempted: hardcode marker generation per current rule. Counter: G1 demands a *per-artifact-class rule* applied uniformly; the generator keys on artifact class + detected stack, not a hardcoded list of today's 11 rules.

---

## §6 Anti-scope

- Do NOT implement before Stage R verdict (build-first-reuse).
- Do NOT add npm deps without SSOT consult + `Prior-art:` trailer.
- Do NOT touch the goal statement (README maintainer-owned).
- Do NOT auto-prioritise — this stays PLANNED until the maintainer dispatches it or a §3 re-prioritise trigger fires.

---

## §7 See also

- [docs/meta-factory/research-patches/2026-05-31-doc-audit-ship-boundary-findings.md §G1-T16 + DN-3](../../../docs/meta-factory/research-patches/2026-05-31-doc-audit-ship-boundary-findings.md) — the finding that scoped this.
- [.claude/rules/build-first-reuse-default.md](../../rules/build-first-reuse-default.md) — Stage R discipline.
- [.claude/rules/dual-implementation-discipline.md §3](../../rules/dual-implementation-discipline.md) — ship-vs-home triage (G1 seed).
- `packages/core/detector/`, `.claude/hooks/inject-matching-rule.sh`, `packages/core/hooks/deps-hash-check.sh` — the REUSE components.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
