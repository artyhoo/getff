# Diagnostics core (D1) — unified diagnostic model + code registry

> **Status:** design approved in dialogue (maintainer, 2026-07-02); implementation scheduled AFTER
> the `rule-research-trust-tiers` umbrella S1+S2 merge (sequencing decision, see §6). Stage B
> (research pipeline as gates) is scheduled immediately after D1 — same chain, not trigger-gated (§9).
> S1+S2 merged 2026-07-02 (#850, #852) — precondition p.1 satisfied; D1 unblocked.
> **Authoritative for:** the D1 design — one `Diagnostic` model + append-only code registry in
> `packages/core/diagnostics/`, adapters for the research and L4 validation pipelines, migration
> waves — plus the scoped commitment for stage B (§9).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> Trust-tier resolver design — see `.claude/orchestrator-prompts/rule-research-trust-tiers/kickoff.md`
> (worktree `rtt-kickoff` until merged).

## §1 Problem

Deep-research + repo audit (2026-07-02, baseline `origin/staging` f406f9758) found the validation
architecture split into **12 coexisting error models**: `ValidationReport`/`GateOutcome`
(`packages/core/validator/types.ts`), thrown `ResearchPlanError` (`research/validate-plan.ts:15`),
thrown `ResearchEntryError` (`research/load.ts:27`), `ProvenanceValidation {ok, reason?: string}`
(`research/allowlist.ts:20`), `InstallReport`, `AifGateResult`, `VerifyResult`, `DriftReport`,
`ProvenanceMismatch`, raw Ajv `ErrorObject[]`, CLI exit codes, plus two independent Ajv instances
with two copies of `errorsText` (`research/internal-validators.ts`, `validator/internal-validators.ts`).

Three of these are named anti-patterns in the external literature (§2):

- **Stringly-typed reason contract.** `validateProvenance` returns `reason: string`; consumers and
  the trust-tiers kickoff AC 3 are forced to discriminate failures by string content
  (`"unknown allowlistKey"` vs the new Tier-1-miss phrase). The string became the contract.
- **Throw-first for expected failure.** `validateResearchPlan` throws on the first provenance
  violation — the caller fixes errors one at a time (Fowler: "whack-a-mole"). The L4 validator in
  the same codebase already does it right (accumulating report, pure aggregator).
- **Duplicate validators drift.** Two Ajv stacks and per-surface ad-hoc error shapes are the
  client/server-validation drift trap: one spec, N hand-maintained enforcement points.

The L4 aggregator (`validator/validate.ts`) is architecturally sound (diagnostics-as-data, pure
core, schema-fail skips downstream, paired negatives). D1 extends its model to the rest of the
codebase instead of inventing a parallel one.

## §2 Research basis (condensed)

Convergent findings across rustc, tsc, ESLint, Biome, clippy, ajv, zod, Fowler, SARIF, SonarQube
(deep-research 2026-07-02, 5 threads, primary sources; durable citation home = the SSOT entries
required by §7):

1. Diagnostic = serializable value `{code, severity, path, params}`; message is derived
   presentation, never the contract (rustc `Diag`, tsc `Diagnostic`, ESLint `LintMessage`,
   Biome `Diagnostic`, ajv `ErrorObject`, zod issue).
2. One model, N entry points/renderers: zod `parse` (throw) and `safeParse` (result) are thin
   adapters over one `issues[]`; rustc human/JSON emitters over one struct.
3. Central message/code registry, append-only, uniqueness enforced at build/test time; codes
   allocated in per-phase numeric ranges (tsc `diagnosticMessages.json` 1xxx/2xxx/…, rustc
   `error_codes!`, Biome `category!`).
4. Accumulate within a phase; gate at phase boundaries only; severity is data, pass/fail is a
   separate policy (tsc `noEmitOnError`, GHC `-fdefer-type-errors`, SonarQube conditions).
5. Exceptions are for programmer bugs, not expected bad input (Fowler Notification; zod/neverthrow
   split; ESLint parse errors are `LintMessage {ruleId: null, fatal: true}` in the same stream).
6. Anti-patterns: shotgun parsing (langsec), boolean blindness, stringly-typed errors, mutable
   error side-channel (ajv `errors` property), full-SARIF adoption for internal pipelines
   (adopt the 3-field skeleton instead).

Primary sources: rustc-dev-guide.rust-lang.org/diagnostics.html (+ /diagnostics/error-codes.html,
/diagnostics/error-guaranteed.html); github.com/microsoft/TypeScript wiki «Using the Compiler API»
+ «Coding guidelines» + CONTRIBUTING.md (diagnosticMessages.json); eslint.org/docs/latest/contribute/architecture
+ blog/2023/10/deprecating-formatting-rules; biomejs.dev/reference/diagnostics + docs.rs/biome_diagnostics;
doc.rust-lang.org/clippy/lints.html + /clippy/development/emitting_lints.html; ajv.js.org/api.html
+ /strict-mode.html; zod.dev/basics + /error-customization; lexi-lambda.github.io «Parse, don't
validate»; martinfowler.com/articles/replaceThrowWithNotification.html; docs.oasis-open.org SARIF
2.1.0; docs.sonarsource.com quality gates intro.

## §3 Design

### §3.1 Model — `packages/core/diagnostics/types.ts`

```ts
export type Severity = 'error' | 'warning' | 'note';

export interface Diagnostic {
  /** Registry code, e.g. 'FF2003'. Stable contract; tests assert on code + params. */
  code: string;
  severity: Severity;
  /** JSON Pointer into the validated artifact (ajv instancePath) or a file path. */
  path?: string;
  /** Structured payload; the discriminated contract per code. */
  params: Record<string, string | number>;
  /** Derived at construction from registry template + params. Presentation only. */
  message: string;
}
```

Construction goes through a factory `diag(code, params, opts?)` that looks up the registry,
interpolates the template, and fails loudly (throw — programmer bug) on unknown code or
missing template placeholder.

### §3.2 Registry — `packages/core/diagnostics/registry.ts`

Append-only const map `{ [code]: { template, defaultSeverity, explanation } }`. Ranges (tsc
pattern):

| Range | Surface |
|---|---|
| FF1xxx | schema/shape (ajv failures, both pipelines) |
| FF2xxx | provenance/trust (Tier-0/1/2 resolver outcomes) |
| FF3xxx | L4 semantic gates |
| FF4xxx | installer/wiring |
| FF5xxx | CLI/config |

Prefix `FF` = fitness functions (getff brand direction; maintainer lead accepted 2026-07-02).

The registry is itself executable (project thesis): `registry.test.ts` asserts (a) code format
`^FF[1-5]\d{3}$`, (b) uniqueness, (c) every `{placeholder}` in a template has a matching params
key in at least one construction-site fixture, (d) append-only versus a committed snapshot of
codes (removals/renumbering fail). Test (b)+(d) observed RED first via a seeded duplicate
(paired-negative discipline).

One generic schema code `FF1001` ("schema violation") carries `params: {keyword, instancePath,
schemaPath}` — ajv's `keyword` is already the discriminator; per-keyword codes would bloat the
registry with no consumer.

### §3.3 Research pipeline — dual API (zod pattern) + accumulation

Post-S1/S2 baseline (see §6): `allowlist-resolver.ts` exists, `validateProvenance(p, resolved)`
is two-arg, `validateResearchPlan(plan, resolveCtx?)` carries the optional ctx per trust-tiers
DECISION-NEEDED #7 Option A. D1 then reshapes:

```ts
// research/validate-plan.ts
export type PlanCheckResult =
  | { ok: true; plan: ResearchPlan; diagnostics: [] }
  | { ok: false; diagnostics: Diagnostic[] };  // ALL failures, accumulated

export function checkResearchPlan(plan: unknown, ctx?: ResolveCtx): PlanCheckResult; // core
export function validateResearchPlan(plan: unknown, ctx?: ResolveCtx): asserts plan is ResearchPlan;
// ^ thin throw adapter; ResearchPlanError gains `.diagnostics: Diagnostic[]`, keeps name/message
```

- `checkResearchPlan` accumulates ajv shape errors (allErrors already on) AND all provenance
  violations across all entries — replacing first-failure throw.
- `validateProvenance` returns `Diagnostic | null` instead of `{ok, reason}`. Resolver reason
  strings (S1/S2 ships them as strings per kickoff) migrate to FF2xxx codes: unknown Tier-0 key,
  not-a-direct-dependency, multi-tenant host, non-https, malformed URL, `xn--` label, IP literal,
  host-not-allowed, redirect-cross-tier, ack-fields-missing/malformed. Exact set is fixed at
  implementation time from the S1/S2 paired-negative list — one code per negative class.
- Existing callers unchanged in behavior: `synthesizer/cli.ts`, `synthesizer/file-clients.ts`
  keep calling the throw adapter; `install/rule-bootstrap-cli.ts` keeps reading `err.message`.
- `load.ts` keeps throw-per-entry semantics (`ResearchEntryError` gains `.diagnostics`);
  store-wide accumulation would be a behavior change — out of D1 scope.

### §3.4 L4 integration — no gate rewrites

- `GateFailure` gains `code: string` (FF3xxx; one code per failure kind per gate, allocated from
  each gate's existing failure branches). `GateOutcome`, `ValidationReport` shape otherwise
  unchanged; gates keep returning `GateOutcome`.
- New adapter `diagnostics/to-diagnostics.ts`: `ValidationReport → Diagnostic[]` for future
  renderers. `ValidationReport` stays the installer's public contract.
- `expected-*-validate.json` fixtures regenerate (added field only — snapshot regen, not a
  capability change). `to-aif-gate-result.ts` untouched (external output format, same class as
  SARIF). CLI `--strict` exit-code mapping untouched (already the correct severity≠gate split).

### §3.5 Shared ajv — `packages/core/diagnostics/ajv.ts`

Factory `makeSchemaValidator(schemaDoc, ref)` (single Ajv config `{allErrors: true,
strict: false}`) + `ajvErrorsToDiagnostics(errors): Diagnostic[]` (FF1001). Both
`internal-validators.ts` files collapse into thin schema-binding wrappers over it; the research
wrapper keeps the `AIF_SYNTH_PKG_ROOT` bundle anchor. `synth-and-wire.bundle.mjs` regenerates.

## §4 Migration waves

| Wave | Models | Action |
|---|---|---|
| D1 (this design) | `ProvenanceValidation`, `ResearchPlanError`, `ResearchEntryError`, raw ajv errors, `GateFailure` | unify/adapt as §3 |
| D2 (at-touch, opportunistic) | `InstallReport`, `VerifyResult`, `DriftReport`, `ProvenanceMismatch` | gain `code` fields when next touched; no dedicated PR |
| Never | `AifGateResult` (external contract), CLI exit codes (renderer-edge policy) | out of scope by design |

## §5 What D1 is NOT (non-goals)

- No full SARIF; no new npm dependencies (the model is ~100 LOC own code; BUILD verdict — no
  production-grade "diagnostics registry for TS" library exists; Biome's is Rust).
- No rewrite of the 8 L4 gates' logic inside D1; the research-pipeline gate re-expression is
  stage B — scheduled immediately after D1, not folded into it (§9).
- No renderer framework (one adapter only, §3.4).
- No behavior change for any current caller; Tier-0 regression suite stays untouched-green.
- No new `.claude/rules/` prose rule "no stringly-typed reasons" — no incident base yet; the
  registry test is the mechanical enforcement. Recorded promotion trigger: the first new
  stringly-typed reason contract introduced after D1 ships promotes this to a rule + principle
  test at the then-lowest free slot.

## §6 Sequencing + preconditions (binding)

**Order: trust-tiers S1 → S2 → D1 → B (immediately, §9).** Maintainer decision
2026-07-02: D1 is implemented AFTER the `rule-research-trust-tiers` kickoff ships S1+S2 —
same-file contention on `research/allowlist.ts` (→ `allowlist-resolver.ts`),
`research/validate-plan.ts`, `research/load.ts`, `research/research-adapter-anthropic.ts`
makes parallel work a semantic-conflict guarantee (two concurrent signature changes to
`validateProvenance`). Accepted cost: D1 migrates the resolver's S1/S2 reason strings to codes
post-hoc instead of the resolver being born with codes.

Preconditions before D1 dispatch:

1. Trust-tiers S1 and S2 PRs merged to `staging`.
2. Re-verify at implementation time (the shapes above are kickoff-derived, not code-derived):
   actual resolver file name + `validateProvenance` signature, DN #7 resolution as shipped
   (ctx param name/type), the final S1/S2 paired-negative list (drives the FF2xxx code set),
   current principle-09 sentinel and free principle slots if any doc obligations fire.
3. Standard pre-dispatch in-flight probe per [CLAUDE.md](../../../CLAUDE.md) Operational conventions.

D1 itself is one PR onto `staging` (branch from staging). If size forces a split, the split is
D1a = `diagnostics/` package + L4 side (no research files) then D1b = research adapters — in that
order, both after S2 regardless.

## §7 Build-vs-reuse obligations (capability commit)

D1 adds a new subdirectory under `packages/core/` ≥50 LOC → capability commit. Required in the
D1 PR (per [CLAUDE.md](../../../CLAUDE.md) build-vs-reuse invariant):

- New SSOT entries in `docs/meta-factory/prior-art-evaluations.md`: rustc diagnostics
  architecture (REFERENCE), tsc `diagnosticMessages.json` registry (ADAPT), SARIF 2.1.0
  (KEEP NARROW — 3-field skeleton only), zod dual-API parse/safeParse (ADOPT VOCABULARY),
  Fowler Notification pattern (ADAPT), ajv (existing dependency, REUSE). Each with Verdict /
  Rationale / Trigger to revisit.
- `Prior-art:` trailer referencing those entries.
- Adjacent existing entries consulted: #154 (ESLint RuleTester, ADOPT), #155 (Semgrep, ADAPT),
  #166 (compiler-bootstrap oracle vocabulary).

## §8 Acceptance criteria (executable)

1. `npx vitest run packages/core/` green; registry test's duplicate-code and snapshot-removal
   negatives observed RED before fix (TDD).
2. Accumulation paired negative: a ResearchPlan fixture with ≥2 independent violations (1 shape +
   1 provenance, different entries) yields ≥2 diagnostics from `checkResearchPlan` AND
   `validateResearchPlan` throws a `ResearchPlanError` carrying the same diagnostics array.
   (Positive control: valid plan → `{ok: true, diagnostics: []}`.)
3. Zero behavior change for current callers: synthesizer CLI, file-clients,
   rule-bootstrap-cli error paths, installer consumption of `ValidationReport.ok`, `--strict`
   exit codes — existing suites untouched-green; L4 fixture diffs contain ONLY added `code` fields.
4. No new entry in `package.json` dependencies.
5. No network at validate time (unchanged — trivially satisfied; guarded by existing AC 2-style
   throwing-fetch test in the trust-tiers suite).
6. Bundle `synth-and-wire.bundle.mjs` regenerated in the same PR.
7. All new/changed docs pass principle 09 (headers) + principle 22 (internal English); §1.7
   Forward/Backward in the PR body; markdown files stay under the 600-line gate.

## §9 Stage B (scheduled) — research pipeline as gates

**Maintainer decision 2026-07-02: B is a scheduled stage, dispatched immediately after D1 merges**
— not trigger-gated. Scope is the research pipeline ONLY (the L4 aggregator is already the
target shape and is not re-architected).

Scope sketch (own implementation plan authored after D1 ships, when post-D1 shapes are real):

- `checkResearchPlan` internals re-expressed as named gates mirroring the L4 pattern:
  `shape` (FF1xxx), `provenance` (FF2xxx, wraps the trust-tier resolver), and — if S2 shipped
  them as separate checks — `scopeLock` and `ackFile`. Each returns `GateOutcome`-shaped results
  with `code`-carrying failures.
- A research-side report `{ok, gates: {…}}` mirroring `ValidationReport` (research-specific gate
  map; NO generic aggregator over both plan types — symmetry by pattern, not by abstraction).
- Public dual API from D1 unchanged: `checkResearchPlan` returns the report's diagnostics;
  `validateResearchPlan` still throws with `.diagnostics`. Callers untouched.
- Paired negatives: one per gate, each observed RED first; schema-fail skips downstream gates
  (same short-circuit discipline as `validator/validate.ts`).

Out of B's scope (recorded so B stays one PR): generic gate framework parameterized over plan
types, renderer framework, D2 at-touch migrations (§4). The third validation pipeline is an
**intended direction, not a hypothesis** (maintainer, 2026-07-02): multi-toolchain support —
`{toolchain: npm|cargo|go|maven, stack}` parametrization one level above the current
single-toolchain `{stack}`, starting with Rust, entered right after this chain ships and
trust-tiers S4 fires. The generic-aggregator/framework question is deliberately designed THERE,
on three data points (L4 + B + the Rust pipeline). **Its R-phase is DONE (2026-07-02, same
session):** see
[research-patches/2026-07-02-multi-toolchain-generalization.md](../../meta-factory/research-patches/2026-07-02-multi-toolchain-generalization.md)
— verdict: the generalization is viable as data in all five surveyed toolchains; hybrid backend
(native-config renderers primary + ast-grep escape hatch); capability matrix fail-closed;
firing-test contract as data. The L2 seam already exists by design: trust-tiers S1
ecosystem-adapter seam (kickoff §5 S1).
