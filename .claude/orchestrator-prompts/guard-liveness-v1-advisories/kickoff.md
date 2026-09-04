# KICKOFF — guard-liveness **v1 advisories follow-up** (sub-wave of guard-liveness umbrella)

> **Type:** I-phase (small, batched debt closure). Hours-scale.
> **Origin:** PR #460 (v1 ESLint gate) cold-review + aif-review advisories, 2026-06-11. Deliberately NOT fixed in #460 (scope discipline — single-concern PR).
> **Design SSOT:** [docs/meta-factory/research-patches/2026-05-23-guard-liveness-gate.md](../../../docs/meta-factory/research-patches/2026-05-23-guard-liveness-gate.md) §3 (v1 row) + guard-liveness-gate/kickoff.md §4.
> May run in parallel with v1.5 / v3 sub-waves.
> **Admission:** candidate.

| Stage | Scope (one line) | Depends on |
|---|---|---|
| v1-advisories | batched debt closure: the four documented v1 gaps (§0) | PR 460 merged (v1) |

## §0 Why this sub-wave

PR #460 shipped v1 with four known, documented gaps. Each is small; none justified blocking the gate's landing; together they are exactly the «armed-but-not-fired» shape the project hunts. This kickoff batches them.

## §1 Items (each = one atomic commit, same PR)

1. **Multi-variant bad corpus** — all 11 ESLint manifest rules carry exactly 1 `negative-test.input` variant; the umbrella kickoff §4 asked for bypass *variants* (≥2 for load-bearing rules). Use v0 audit's per-rule criticality table ([2026-06-10-guard-liveness-v0-audit.md](../../../docs/meta-factory/research-patches/2026-06-10-guard-liveness-v0-audit.md), PR #458) to pick the load-bearing subset; add ≥2 distinct variants there. Principle 02 already enforces distinctness (duplicate-entry check, shipped in #460).
2. **R5/R15/R16 enablement decision** — these skip (plugins `@typescript-eslint`, `jsx-a11y`, `@next/next` not in `KNOWN_PLUGINS`, [guard-liveness.ts:44](../../../packages/core/hooks/checks/guard-liveness.ts)). The `getPluginKey` 2-part-scoped-name bug that would have made `@typescript-eslint` registration a silent no-op was fixed in #460 (commit 8dd8baa), so registration now works. Decide per rule: register plugin (parser/plugin already in core devDeps for @typescript-eslint; jsx-a11y/@next-next live in preset peer space) vs. keep SKIP with rationale. NOTE: R5 (`no-floating-promises`) is a *type-aware* rule — needs parserOptions.project; may be a justified permanent SKIP → document it.
3. **Schema asymmetry latent trap** — [recipe.schema.json](../../../packages/core/synthesizer/recipe.schema.json) accepts `input: string|array`, but [synthesis-plan.schema.json](../../../packages/core/synthesizer/synthesis-plan.schema.json) accepts array ONLY, and the synthesizer does NOT normalize string→array. A string-input recipe today produces a plan that fails ajv validation downstream. Either (a) normalize in synthesizer at recipe-load, or (b) tighten recipe.schema to array-only (all 4 shipped recipes already migrated in #460) + regen snapshots. Prefer (b) — fewer code paths, schema = SSOT.
4. **guard-liveness.test.ts has zero CI channel** — audit-self.yml runs only `audit-ai-docs.test.ts` + `test:principles`; pre-push runs the same. The gate's 11 unit tests run only on manual `vitest`. Decide channel: add to the `probe-tests` job (cheap — same core-only install works, the test imports the ESLint stack so verify resolution under `npm install --prefix packages/core` first — preset plugin resolves via package name only with workspace links; may need the root-install job instead, e.g. `typecheck`-style `npm install`) OR record an explicit «local-only, pre-push is the primary channel» rationale in the test header. Silent zero-channel is not an option.

## §2 OUT of scope

- v1.5 command/script fixture gate (own kickoff).
- v3 manual-rules Superpowers channel (own kickoff).
- v2 full-sweep regression (gated on v1+v1.5+v3).
- Any new npm dependency without Prior-art trailer + SSOT consult (jsx-a11y / @next plugins would be capability commits — SSOT #114 trigger-to-revisit applies).

## §3 AI traps (per [.claude/rules/ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md))

Active traps for this sub-wave: **T3** (every «rule X now passes» claim needs the actual gate output quoted), **T5** (items are I-phase; don't drift into redesigning the gate), **T11/T13** (item 2: before registering jsx-a11y/@next plugins, T16-check that the plugin's problem class matches the manifest rule's — and that type-aware rules are even runnable in a stringly `linter.verify` roundtrip), **T15** (item 1's new variants must themselves pass the principle-02 distinctness check — run it, don't assume), **T20** (no verdict on item 4's channel without quoting the actual workflow yaml + install topology evidence).

Domain-specific trap: **T-GLV-A** — «migrating `input` variants by copy-pasting the same snippet with cosmetic whitespace changes» — principle 02's distinctness check trims, but a `var x` → `let x` cosmetic edit passes distinctness while adding zero bypass coverage. Variants must differ in the *bypass mechanism* (different import form, different call shape), not the spelling. Reviewer checks each added variant against the rule's AST logic.

## §4 Done criteria

- One PR, base `staging`, all four items as atomic commits (or explicit per-item «decided: keep as-is + rationale» note in the PR body).
- `npm --prefix packages/core run test:principles` green; `PREPUSH_ONLY=guard-liveness` seam run output quoted in PR body.
- CI topology check: `npm install --prefix packages/core` + `bash tests/hooks/prior-art-trailer-hook.test.sh` stays 8/8 (regression guard for the #460 lazy-load fix).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
