# Diagnostics core (D1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Authoritative for:** implementation sequencing of D1 (diagnostics-core): the `packages/core/diagnostics/` build order, the FF-code registry set, the resolver reason-string → FF2xxx migration, the L4 `code`-field addition, RED-first paired-negative order, commit discipline.
> **NOT authoritative for:** the D1 design / architecture / acceptance criteria / stage-B scope — owned by the [spec](../specs/2026-07-02-diagnostics-core-design.md); the multi-toolchain frame — see the [R-phase patch](../../meta-factory/research-patches/2026-07-02-multi-toolchain-generalization.md); project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

**Goal:** Unify the codebase's 12 coexisting error models ([spec §1](../specs/2026-07-02-diagnostics-core-design.md)) behind one serializable `Diagnostic {code, severity, path?, params, message}` plus an append-only, test-enforced FF code registry in `packages/core/diagnostics/`, adapting the research and L4 pipelines to it with **zero behavior change** for every current caller.

**Architecture:** one model, N renderers (spec §3.1–§3.5): a `diag(code, params, opts?)` factory over an append-only registry (`FF1xxx`–`FF5xxx` ranges); the research pipeline gains a zod-style dual API (`checkResearchPlan` accumulates, `validateResearchPlan` stays the throw-adapter); `validateProvenance` returns `Diagnostic | null`; L4 `GateFailure` gains a `code` field; the two Ajv stacks collapse to one shared factory. This plan does **not** restate the design — read the spec §3 for it; this file sequences the build.

**Tech Stack:** TypeScript (Node 20+, ESM, `.ts` imports), vitest, Ajv (already a dep — `internal-validators.ts`), zero new npm dependencies ([spec §5 / AC 4](../specs/2026-07-02-diagnostics-core-design.md)).

## Post-S3 re-verified baseline (spec §6 p.2 checklist — CLOSED against live `origin/staging`, 2026-07-02)

The spec's shapes were kickoff-derived; these are the **code-derived** truths D1 must build on (each with `file:line`). Where they diverge from the spec, **the code wins** — the spec §3.2/§3.3 wording is superseded by this baseline:

1. **Resolver signature:** `resolveAllowedSources(ctx?: ResolveCtx): ResolvedSources` — [`allowlist-resolver.ts:159`](../../../packages/core/research/allowlist-resolver.ts). `ResolveCtx = { root: string; adapter?: EcosystemAdapter; ackFilePath?: string }` (`:141-148`); `ResolvedSources = { tier0; tier2; tier1For(packageName): Tier1Result }` (`:152-156`). No-ctx call ⇒ Tier-0 only, zero fs access.
2. **`validateProvenance` is 3-arg (spec §3.3 said 2-arg — CORRECTED):** `validateProvenance(p: Provenance, resolved: ResolvedSources, opts?: { entryPackage?: string }): ProvenanceValidation` — [`allowlist-resolver.ts:319-323`](../../../packages/core/research/allowlist-resolver.ts). `opts.entryPackage` is **load-bearing** — it drives the Tier-1 scope-lock (T-RTT-A, `:261-266`) and the Tier-2 scoped-ack check (`:283-286`). Any D1 caller doing Tier-1/2 validation MUST thread `entryPackage` or the scope-lock silently no-ops.
3. **Two `validateProvenance` exports exist:** the 3-arg tiered one above, plus a distinct **1-arg Tier-0-only** back-compat wrapper (`validateProvenance(p)`, re-exported through `allowlist.ts`) consumed by [`validate-plan.ts:14`](../../../packages/core/research/validate-plan.ts). D1 must pick the 3-arg resolver form for tiered checks and decide the 1-arg wrapper's return shape (see DN-D1-2).
4. **DN #7 lands as spec §3.3 expected:** `validateResearchPlan(plan: unknown, resolveCtx?: ResolveCtx): asserts plan is ResearchPlan` — [`validate-plan.ts:33-36`](../../../packages/core/research/validate-plan.ts). ctx present ⇒ Tier 1/2 active + 3-arg provenance check (`:41-45`); ctx absent ⇒ Tier-0-only, zero behavior change (`:46`). **No divergence.**
5. **DN #3 = exact-host, NO eTLD+1/PSL:** `hostMatches = host === a || host.endsWith('.' + a)` ([`allowlist-resolver.ts:34-36`](../../../packages/core/research/allowlist-resolver.ts), header comment `:5`). Consequence for D1: the FF2xxx set has **no** PSL/registrable-domain host-class negatives — it is derived from the concrete reason strings the resolver actually emits, one code per class (§FF-registry below).
6. **Principle 09 sentinel = bounded range, not a fixed count:** `REQUIRED_HEADER_DOCS.length` asserted `>= 20 && <= 85` ([`09-doc-authority-hierarchy.test.ts:91-93`](../../../packages/core/principles/09-doc-authority-hierarchy.test.ts)); actual length is **exactly 85** post-S3 (`09-doc-authority-hierarchy.ts:28-134`). **D1 adds NO `REQUIRED_HEADER_DOCS` entry** — `packages/core/diagnostics/*` are code, not header-docs — so the sentinel is untouched (count stays 85, ceiling stays 85). S3's principle slot = **30** (`packages/core/principles/30-research-source-trust.test.ts`); D1 adds no principle slot.

## FF-registry code set (spec §3.2 — FF2xxx derived from the re-verified S1/S2 negatives)

Ranges (spec §3.2): `FF1xxx` schema/shape · `FF2xxx` provenance/trust · `FF3xxx` L4 semantic gates · `FF4xxx` installer/wiring · `FF5xxx` CLI/config. `FF` = fitness functions (getff brand). D1 lands `FF1001` (generic ajv-shape, `params:{keyword,instancePath,schemaPath}`), the `FF2xxx` provenance set below, and the `FF3xxx` codes for each L4 gate failure branch (allocated at Task 4 from the gates' existing branches). `FF4xxx`/`FF5xxx` are reserved (D2 at-touch).

**FF2xxx — one code per concrete rejection class the resolver emits (NOT one per PSL edge — DN #3):**

| Code | Reason class | Source `file:line` | Paired-negative |
|---|---|---|---|
| `FF2001` | malformed URL (parse throw) | `allowlist-resolver.ts:342-343` | — |
| `FF2002` | non-https scheme | `:345-346` | S1-N4 |
| `FF2003` | IP-literal host (v4 / bracketed v6) | `:349-350` | (S1 IP-ack) |
| `FF2004` | `xn--` punycode host outside ack | `:355-359` | S1-N5 |
| `FF2005` | unknown allowlistKey (no tier) | `:309` | S1-N1 |
| `FF2006` | Tier-0 host not in key's host list | `:252-254` | — |
| `FF2007` | Tier-1 not a direct dependency | `:178-180` | S2-N1, S2-N2 |
| `FF2008` | Tier-1 no ecosystem adapter (S1 back-compat) | `:169-172` | — |
| `FF2009` | Tier-1 no eligible host (multi-tenant / non-https / IDN / IP metadata) | `:195-198` | S2-N3, S2-N4, S2-N6, S2-N7 |
| `FF2010` | cross-package provenance (T-RTT-A) | `:263-265` | S2-N5 |
| `FF2011` | Tier-1 host not in derived set | `:274` | — |
| `FF2012` | Tier-2 ack scope mismatch (`entryPackage != ack.scope`) | `:283-286` | — |
| `FF2013` | Tier-2 host not in acked hosts | `:302-304` | — |
| `FF2014` | ack-file malformed (bad JSON/shape/date/IP/dup-key, fail-closed) | `AckFileError :53-98` | S1-N2, S1-N3 |
| `FF2015` | finalUrl redirect crosses authorizing tier | `:326-333` | (Task 2.5 redirect) |

> Codes are D1's own labels for the resolver's reason-string classes (verified: `grep FF2 packages/core/research/` is empty today — the strings become codes at Task 3). Confirm each `file:line` against the tree at implementation time (they drift); the **count** (15) and the **mapping to real reason classes** are the load-bearing part.

> **Cross-umbrella note (`trust-tiers-did-review`, in-flight 2026-07-02 — zero file overlap with this PR):** that separate re-adjudication of `.claude/rules/research-source-trust.md §5` may land a `loadAckFile` single-label-host reject (its item B code-fix) — another `AckFileError` in the same fail-closed family as `FF2014` (bad JSON/shape/date/IP/dup-key). At D1 impl time, fold it into `FF2014` (same class) or allocate a sibling code; either way **re-derive FF2xxx from the then-current resolver** (as this table already requires). The two umbrellas touch no shared files — no rebase coupling, only this data-level note.

## Global Constraints

- **Zero new npm dependency** (spec AC 4). Model ≈ 100 LOC own code; BUILD verdict (spec §5 — no production "diagnostics registry for TS" library; Biome's is Rust).
- **No network at validate time** (spec AC 5 — trivially satisfied; guarded by the trust-tiers throwing-`fetch` test).
- **Zero behavior change for current callers** (spec AC 3): `synthesizer/cli.ts`, `synthesizer/file-clients.ts` keep the throw adapter; `install/rule-bootstrap-cli.ts` keeps reading `err.message`; installer keeps `ValidationReport.ok`; `--strict` exit codes unchanged. Existing suites stay **untouched-green**; L4 fixture diffs contain ONLY the added `code` field.
- **TDD, RED-first** (spec AC 1-2): the registry uniqueness (b) + snapshot-removal (d) negatives, and the accumulation negative, are observed **RED before their fix** via a seeded duplicate / seeded removal.
- **English-only** doc bodies (principle 22); **≤600 lines** per markdown file (pre-commit gate). This plan and the spec both comply.
- **One PR onto `staging`** (spec §6). If size forces a split: **D1a** = `diagnostics/` package + L4 side (no research files) → **D1b** = research adapters, in that order, both after S2 (already true).
- **Capability commit** (new `packages/core/diagnostics/` ≥50 LOC): `Prior-art:` trailer + the SSOT entries from spec §7 (rustc REFERENCE, tsc `diagnosticMessages.json` ADAPT, SARIF KEEP-NARROW, zod dual-API ADOPT-VOCAB, Fowler Notification ADAPT, ajv REUSE) — landed in the D1 PR, not this planning PR.

## DECISION-NEEDED / open design points (surface at implementation — do NOT bake in silently)

These are genuine forks the spec left open or the re-verify surfaced; the implementer resolves each with evidence (or escalates), not by guessing:

- **DN-D1-1 — accumulate vs throw for the 1-arg Tier-0-only wrapper.** Spec §3.3 says `validateProvenance` returns `Diagnostic | null`, but the shipped **1-arg** back-compat wrapper (`validate-plan.ts:14`) returns `{ok, reason}`. TODO-decision: migrate the 1-arg wrapper's internals to emit a `Diagnostic` while preserving its `{ok, reason}` public shape for back-compat callers, OR leave it `{ok, reason}` and only code-ify the 3-arg tiered form. Confirm caller tolerance by grepping every consumer of the 1-arg export before choosing.
- **DN-D1-2 — `FF2009` granularity.** The resolver emits one "no Tier-1-eligible host" reason for four physically distinct causes (multi-tenant / non-https / IDN / IP metadata; S2-N3/N4/N6/N7). TODO-decision: keep one `FF2009` (matches the single emitted reason string — simplest, honest to today's code) OR split into four codes (richer diagnostics, but invents distinctions the resolver does not currently make). Default lean recorded, decision at impl.
- **DN-D1-3 — `load.ts` scope.** Spec §3.3 keeps `load.ts` throw-per-entry (`ResearchEntryError` gains `.diagnostics`); store-wide accumulation is a behavior change, out of D1. Confirm no caller depends on accumulation before locking this as "adapter-only".
- **DN-D1-4 — FF3xxx allocation.** One code per failure kind per L4 gate (spec §3.4). TODO: enumerate each gate's existing failure branches at Task 4 and allocate sequentially; do NOT pre-number here (the branch set is code-derived).

## Tasks (TDD, RED-first; checkboxes for `executing-plans`)

### Task 1 — `diagnostics/` package: model + registry (RED first)
- [ ] 1.1 `packages/core/diagnostics/types.ts` — `Severity = 'error'|'warning'|'note'` + `Diagnostic {code, severity, path?, params, message}` (spec §3.1).
- [ ] 1.2 `registry.ts` — append-only `const` map `{ [code]: { template, defaultSeverity, explanation } }`; seed `FF1001` + the 15 `FF2xxx` rows above (templates + params keys). `diag(code, params, opts?)` factory: registry lookup, template interpolation, **throw** on unknown code / missing placeholder (programmer bug).
- [ ] 1.3 **RED**: `registry.test.ts` — assert (a) code format `^FF[1-5]\d{3}$`, (b) uniqueness, (c) every `{placeholder}` has a params key at ≥1 construction site, (d) append-only vs a committed snapshot of codes. Observe (b) **RED** via a seeded duplicate code and (d) **RED** via a seeded removal BEFORE the registry is correct; then GREEN.
- [ ] 1.4 Commit the code snapshot fixture the (d) test diffs against.

### Task 2 — shared Ajv (`diagnostics/ajv.ts`)
- [ ] 2.1 `makeSchemaValidator(schemaDoc, ref)` (single Ajv config `{allErrors:true, strict:false}`) + `ajvErrorsToDiagnostics(errors): Diagnostic[]` (all → `FF1001`, `params:{keyword,instancePath,schemaPath}`).
- [ ] 2.2 Collapse both `internal-validators.ts` files into thin schema-binding wrappers over it; the research wrapper keeps the `AIF_SYNTH_PKG_ROOT` bundle anchor. Existing validator suites stay green.

### Task 3 — research pipeline dual API + accumulation (spec §3.3; DN-D1-1/2/3)
- [ ] 3.1 `checkResearchPlan(plan, ctx?): PlanCheckResult` — accumulate ALL ajv shape errors AND all provenance violations across all entries (replaces first-failure throw).
- [ ] 3.2 `validateProvenance` (3-arg tiered form) → returns `Diagnostic | null`; migrate each reason string to its `FF2xxx` code per the table; thread `opts.entryPackage`.
- [ ] 3.3 `validateResearchPlan` stays the thin throw-adapter; `ResearchPlanError` gains `.diagnostics: Diagnostic[]`, keeps `name`/`message`. Resolve DN-D1-1 for the 1-arg wrapper.
- [ ] 3.4 **RED**: accumulation paired-negative — a `ResearchPlan` fixture with ≥2 independent violations (1 shape + 1 provenance, different entries) yields ≥2 diagnostics from `checkResearchPlan` AND `validateResearchPlan` throws carrying the same array. Positive control: valid plan → `{ok:true, diagnostics:[]}`. Observe RED first.
- [ ] 3.5 `load.ts` — `ResearchEntryError` gains `.diagnostics`; throw-per-entry semantics unchanged (DN-D1-3).

### Task 4 — L4 `code` field (spec §3.4; DN-D1-4)
- [ ] 4.1 `GateFailure` gains `code: string` (FF3xxx). Enumerate each of the 8 gates' failure branches; allocate one FF3xxx per kind. `GateOutcome`/`ValidationReport` shape otherwise unchanged; gates keep returning `GateOutcome`.
- [ ] 4.2 `diagnostics/to-diagnostics.ts` — `ValidationReport → Diagnostic[]` (future renderers). `ValidationReport` stays the installer's public contract; `to-aif-gate-result.ts` untouched.
- [ ] 4.3 Regenerate `expected-*-validate.json` fixtures — **added `code` field only** (snapshot regen, not a capability change). Confirm diffs contain nothing else.

### Task 5 — bundle regen + acceptance (spec §8)
- [ ] 5.1 Regenerate `synth-and-wire.bundle.mjs` in the same PR.
- [ ] 5.2 `npx vitest run packages/core/` green; the registry duplicate/snapshot negatives + the accumulation negative were RED-first (Task 1.3 / 3.4).
- [ ] 5.3 Zero-behavior-change sweep: synthesizer CLI, file-clients, rule-bootstrap-cli error paths, installer `ValidationReport.ok`, `--strict` exit codes — existing suites untouched-green; L4 fixture diffs = only added `code`.
- [ ] 5.4 Principle 09 (headers) + 22 (English) green; `packages/core/diagnostics/*` added NO `REQUIRED_HEADER_DOCS` entry (sentinel stays 85). §1.7 Forward/Backward in the D1 PR body; md files < 600 lines.
- [ ] 5.5 Capability-commit obligations (spec §7): SSOT rows + `Prior-art:` trailer in the D1 PR.

## Acceptance → spec §8 mapping

Every spec §8 AC has a home above: AC1 → 1.3/3.4/5.2 · AC2 → 3.4 · AC3 → 5.3 · AC4 → Global Constraints · AC5 → Global Constraints · AC6 → 5.1 · AC7 → 5.4. Do not close D1 until each is verified with a command + observed output (T3), not "would".

## Commit / PR discipline

- Branch from `staging`; **one PR** onto `staging` (or D1a→D1b split per Global Constraints). Conventional commits; one logical commit per Task where practical so a long run lands durably.
- Do NOT push to `main` (git-safety blocks base=main). Do NOT open multiple PRs beyond the sanctioned D1a/D1b split.
- Stage B (research pipeline as named gates, spec §9) is the **next** plan after D1 merges — authored when post-D1 shapes are real, not folded into D1.
