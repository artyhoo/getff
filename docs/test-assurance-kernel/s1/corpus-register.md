# S1 corpus register — population denominator + frozen classifications

> **Authoritative for:** the S1 corpus denominator (T10), per-class counts, channel assignment, and the pointer to the frozen expected classifications.
> **NOT authoritative for:** detector semantics (see `scripts/test-assurance/expectations.json` `rules.*.declared_scope`); stage boundaries (`docs/superpowers/specs/2026-10-08-test-assurance-kernel-design.md`); batch provenance (`s1/batches.md`).

## 1. Denominator (T10 — enumerate before sampling)

Raw listing: `s1/logs/phase1/corpus-listing.log` (find + wc, generated 2026-10-08).

| Group | Files |
|---|---|
| **Total corpus files** | **30** |
| Bad-class cases (expected REJECT through their declared channel) | 15 |
| Good-class companions (expected ADMIT) | 12 |
| Fixtures (subject modules, not test cases; expected `fixture`) | 3 |

Per class:

| Class | Files | Bad | Good | Fixture |
|---|---|---|---|---|
| `q1-vacuous` | 10 | 5 | 5 | 0 |
| `q2-noassertion` | 6 | 4 | 2 | 0 |
| `q3-copied-predicate` | 4 | 2 | 1 | 1 (`subject.ts`) |
| `q4-ignored-exit` | 2 | 1 | 1 | 0 |
| `q5-self-source` | 2 | 1 | 1 | 0 |
| `q6-disconnected` | 2 | 1 | 1 | 0 |
| `wrong-import` | 4 | 1 | 1 | 2 (`delivered.ts`, `lookalike.ts`) |
| **Total** | **30** | **15** | **12** | **3** |

Every case is one-to-one with an entry in `scripts/test-assurance/expectations.json` (`cases[].path`); the driver (Batch F) reconciles the two lists and fails closed on a missing/extra path.

## 2. Frozen classifications

`scripts/test-assurance/expectations.json` is the machine-readable oracle. Freeze facts:

- `frozen_at: 2026-10-08`; authored from the SPEC Q-table semantics only, **before any S1 detector output existed** (the two rules it names did not exist at freeze time — Batch B created them later; provenance: `s1/batches.md` Phase 1 ordering + git history).
- Expected channel outcomes: `reject` ×12, `reject-by-counterfactual` ×2, `reject-by-review` ×1, `admit` ×12, `fixture` ×3.
- Post-freeze change policy: any edit requires a `batches.md` note saying why AND an independent-freeze receipt in `s1/cold-review.md` (T19). The freeze is reviewed again in Batch F before acceptance.

Static per-rule expectations (complete matrix — every non-Q1/Q2 case is a deliberate static ADMIT; the admission is the honest-limit record, not a detection claim):

| Rule | Reject | Admit |
|---|---|---|
| `no-vacuous-assertion` (Q1) | 5 (all q1 bads) | 25 |
| `require-effective-assertion` (Q2) | 4 (all q2 bads) | 26 |

## 3. Channel assignment

| Channel | Classes | Establishes |
|---|---|---|
| `static-eslint` | q1, q2 | K1/K2 via the real ESLint rules; K4 via good companions + counterfactual over-reject probes |
| `counterfactual-audit` | q3 | K2/K3 via pinned reached faults over the frozen-oracle companion (Batch D) |
| `executed-conformance` | q4, q5 | K2 via real runner/gate outcomes in scratch (Batch C) |
| `delivery-conformance` | q6 | K5 via the real emitted artifact (Batch E) |
| `review` | wrong-import bad | NO gate claim — named cold-review protocol + blocking dispositions queue (honest limit, spec §1) |
| `fixture-not-a-test` | `subject.ts`, `delivered.ts`, `lookalike.ts` | mutation/import-disambiguation subjects; never linted as test cases |

## 4. Naming note (discovery-safety)

No corpus file carries a `.test.`/`.spec.` infix. The repo-root `vitest.config.ts` has no `include` (default discovery is `**/*.{test,spec}.*`), and the root config is outside this stage's write scope — naming is therefore the mechanism that keeps the corpus out of the default vitest run. Scratch drivers (Batches C/E/F) select corpus files explicitly by path. `packages/core/principles/38` (vitest include CI-coverage) reads only `packages/core/vitest.config.ts`, so the corpus is invisible to it by construction.

## 5. Scope honesty (T14)

This corpus is a *rejection-capability* corpus, not a full defect taxonomy: it pins the six Q-classes named by the spec plus the review-routed wrong-import shape. It does not claim to enumerate every bad-test shape in the repo population; the S0 baseline population workloads remain the denominator for repo-wide coverage claims. The parity test (`q1/good.parity-test`) is admitted by the static channel by design — parity correctness is undecidable statically and is recorded in `s1/honest-limits.md`.
