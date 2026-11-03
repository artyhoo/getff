---
description: Test-quality contracts — scoped mechanical assurance, canonical test authoring and consumed semantic review
paths:
  - "packages/**"
  - "tests/**"
  - "scripts/**"
  - "templates/**"
  - "docs/test-assurance-kernel/**"
  - "eslint.config.mjs"
  - "vitest.config.ts"

---

# Test-quality contracts — discipline rule

> **Class:** A — mechanical claims enforced by [principle 51](../../packages/core/principles/51-test-quality-corpus-conformance.test.ts), [principle 52](../../packages/core/principles/52-subprocess-status-conformance.test.ts), [principle 53](../../packages/core/principles/53-delivery-discovery-conformance.test.ts) and the existing S2 acceptance registry. Semantic judgments retain the named review and blocking queue; this is not universal behavioral certification.
> **Fires:** editing test suites, metachecks, configurations, or assurance evidence.
> **Authoritative for:** the test-quality policy contract — §1 the channel map, §2 what
> static detectors may claim, §3 the blocking dispositions queue, §4 legitimate-structure
> carve-outs, §5 promotion / retirement. S1 evidence: `docs/test-assurance-kernel/s1/`.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists).
> Per-claim evidence lives in the S1 evidence package, not here.

> **Origin:** 2026-10-08, S1 stage of the test-assurance kernel (spec:
> [docs/superpowers/specs/2026-10-08-test-assurance-kernel-design.md](../../docs/superpowers/specs/2026-10-08-test-assurance-kernel-design.md) §5).
> This rule EXTENDS the existing contract in its authoritative home — principle 04
> (no-tautology), principle 02 (paired-negative) and the review-sidecar protocol — it does
> not restate or supersede them.

## §1 The channel map (what rejects what)

A test claiming behavioral coverage that exhibits a defect class is rejected ONLY through its
declared channel — no channel, no rejection claim:

| Class | Defect | Channel (executable) |
|---|---|---|
| Q1 | vacuous literal-only assertion | `no-vacuous-assertion` (shipped ESLint rule, root config scope) |
| Q2 | no effective assertion | `require-effective-assertion` (shipped ESLint rule) |
| Q3 | copied/recomputed predicate surviving a reached fault | frozen-oracle counterfactual replays (`scripts/test-assurance/counterfactuals/`) |
| Q4/Q5 | ignored exit status / self-sourced phrase | executed conformance (principle 52, real vitest in scratch worktrees) |
| Q6 | disconnected emitted/delivered config | delivery conformance (principle 53 + `scripts/test-assurance/delivery/`) |
| wrong-import | registered known implementation pair does not bind the governed subject | principle 52 actual M14 pair/producer/classifier controls; arbitrary imports/aliases remain review-routed |

Every rejection claim must carry K1–K7 evidence per the S1 matrix
(`docs/test-assurance-kernel/s1/matrix.md`): admitted good companions (K1), rejection with
the intended diagnostic (K2), gate-regression detection with corpus+driver fixed (K3),
over-rejection detection (K4), live delivery (K5), fail-closed discovery (K6), honest
evidence (K7). Weakening the GATE while corpus and driver stay fixed proves K3; changing
the input proves only K2.

## §2 What static detectors may claim

A static detector claims only its decidable syntax (literal-only arguments; assertion
presence) within the configured scope. It MUST NOT be cited as evidence of behavioral
coverage, mock fidelity, dataflow correctness, or oracle independence. Q3 sensitivity comes
from reached non-equivalent faults with observed reachability, never from AST/dataflow
reasoning. Per-claim boundaries: `docs/test-assurance-kernel/s1/honest-limits.md`.

## §3 Blocking dispositions queue

Semantic findings use the existing `.agents/roles/review-sidecar.md` protocol and
`docs/test-assurance-kernel/s1/dispositions.md` fenced-JSON queue. S1 retains its
historical consumer; `verify.mjs --stage S2` also consumes latest current resolutions
and all external-contract candidate links. A new actual unresolved semantic finding
blocks S2 regardless of a claimed later owner stage. Only the exact independently
approved M15 public-regeneration handoff remains deferred to S4. Missing queue,
entry, evidence or required coverage is RED; a warning or external-contract label
alone cannot discharge a finding. Historical S1 wrong-import/hash observations are
preserved; current S2 scope is stated separately, without rewriting the frozen oracle.

## §4 Legitimate structure (never rejected by this kernel)

Constant expected values against computed output, snapshots, structural/schema contracts,
parity tests (which cannot establish both sides correct), determinism tests, helper and
asynchronous assertions remain useful within their stated claims; the corpus pins measured
companions (`docs/test-assurance-kernel/s1/corpus-register.md`). Ambiguous usefulness
belongs in the review protocol, not a brittle hard-blocking grep.

## §5 Promotion / retirement

- **Promotion:** the existing S2 trigger is fulfilled by P51 population and P52 registered-pair paired negatives, P53 actual installed-artifact admission and the S2 adapter with real consumer tamper controls. Authoring relevance now covers the supported live path scopes below; static rule language/semantics are unchanged.
- **Retirement:** not before S2 closure. If the kernel is superseded, retire by replacing
  §1's channel map with a pointer to the successor and recording the transition in the
  dispositions queue.

## §6 Self-reflexive note

- **Forward-check:** complies with [doc-authority-hierarchy.md §2-§3](doc-authority-hierarchy.md)
  (Class + Authoritative-for header, registered by the rendered index); complies with
  [attention-is-not-a-mechanism.md](attention-is-not-a-mechanism.md) (every load-bearing
  claim names its deterministic gate or the named cold-review protocol + blocking queue —
  never bare reviewer attention).
- **Backward-check:** extends, does not duplicate, principle 04 / 02 and the review-sidecar
  protocol; the S1 kernel (principles 51/52/53, driver, adapter) is the enforcement layer
  this rule declares. See also
  [build-first-reuse-default.md](build-first-reuse-default.md) (S1 reused the installed
  ESLint/Vitest rule mechanisms; SSOT consult: `docs/test-assurance-kernel/s1/prior-art.md`).

<!-- globs: packages/**, tests/**, scripts/**, templates/**, docs/test-assurance-kernel/**, eslint.config.mjs, vitest.config.ts -->
<!-- inject: Test quality: use the declared static, executed, delivery or review channel; preserve useful structural tests and route semantic findings to the blocking queue. -->
