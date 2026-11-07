# Test assurance kernel and PR feedback cost

> Authoritative for: this campaign's requirements, design decisions, acceptance and execution boundaries.
> Not authoritative for: project goal (README.md), dispatch mechanics (dispatcher), or claims about unexamined tests.
> Status: designed; implementation and runtime acceptance remain unverified.
> Owner: senior design seat. Kickoff author: GPT-6.1-sol. Implementation: GLM worker through Claude Code, preferably AIF dispatcher; coordinator and independent reviewers retain acceptance authority.

## 1. Outcome and problem

The framework exists to make codified conventions executable at the earliest reachable channel. Its testing kernel must establish that a real violation changes the delivered check's result, and that a regression in that check makes its unchanged regression suite fail. Passing tests, assertion counts, coverage percentages, and a mutation score alone do not establish that property.

**Priority (operator clarification, 2026-10-08): the first implementation result is metachecks that reject tautologies and other demonstrably defective tests. Broad production repairs come after this kernel works.**

Two outcomes are conjunctive: stronger evidence of enforcement AND lower ordinary PR feedback cost. Adding an unconditional repository-wide mutation run to every push is not an acceptable solution. Neither is deleting expensive checks without preserving the obligations they discharge.

The unit of assurance is an **enforcement obligation plus its actual delivery path and supporting suite**. It is not an individual `it`, a source file name, or a requirement that every assertion kill a distinct mutant. A structural test can be valuable when the structure itself is the contract; it must not be presented as evidence of runtime behavior.

A suite is insensitive to a specified fault when the actual fault is present, reachable, and the unchanged relevant suite still passes. This is a demonstrated gap, not a judgment inferred from short tests. General semantic usefulness is undecidable by a syntax-only detector; do not advertise such a detector.

## 2. Provenance and baseline discipline

Initial independent audit: `41cc5642f3a625be89dc3dd3abf1f7e4ec91ae96`.
Design inspection baseline: `9f22c9e6a760f5d9212355fd6324e20fd8edb7ca` (local origin/staging ref on 2026-10-07).
The baseline contains the `.agents` canonical-source migration. Historical `.claude` paths in the audit require explicit current-path reconciliation; symlink/compatibility presence is not proof that a carrier executes.

Local discovery report: `/Users/art/.codex/visualizations/2026/10/07/01a1180e-4dd6-7643-9598-2dc1e2ec3196/testing-review/INDEPENDENT-REVIEW.md`. This is provenance for the author, NOT an assumed container mount. The portable seed register in section 7 is the execution input. Reproduce each seed on the actual execution base before fixing it; retain already-fixed/rejected classifications with evidence.

The prior audit reran 115 distinct files (1,135 passing tests, one skip) and found specific blind spots. Those numbers are neither a whole-repository census nor proof that most tests are useless. The 326 unasserted installer-call scanner hits were candidates under a ratchet, not 326 proven bugs.

Pin source SHA, lockfile hash, command, tool versions, host/environment, exit status and raw evidence in every baseline or counterfactual record. Separate environment failure from intended assertion failure. A nonzero process caused by compilation, missing dependencies, permissions, timeout or network does not count as detecting the seeded violation.

## 3. Boundaries and completion denominator

The campaign covers the repository's testing-assurance system and the tests it claims to govern, across framework sources and shipped presets/templates. Inventory all tracked test files and all declared test entrypoints; do not stop at the known seeds or choose a convenient sample.

Build two linked inventories using existing manifests, Git enumeration and native runner discovery where possible:

1. Obligation inventory: every principle, test-quality requirement, guard-liveness check, install/exit-status obligation, generated-rule validator/mutation gate, and routing/CI coverage claim. Include its owning prose, executable carrier or judgment protocol, actual invocation, consumer/framework scope, suite and cost lane.
2. Test population: every tracked test file and declared suite, including shell, Vitest, generated tests, template examples and harness twins. Classify execution lane, exercised production surface, source of expected values, assertion/exit handling, and assurance status. Fixture inputs which look like tests must be distinguished from runnable tests.

Mandatory statuses: verified-behavioral, verified-structural, candidate-needs-review, demonstrated-gap, not-executed, intentional-fixture, external-contract, or retired. Every exclusion needs a specific reason and evidence; no blanket legacy exemption or silently ignored discovery error. Denominator changes (including renamed/deleted tests) must be reconciled with Git, not achieved by narrowing globs.

Deep sensitivity verification is exhaustive for the assurance kernel and its delivery families. Outside the kernel, inspect every candidate generated by the complete inventory and structural scan, and use changed production contracts plus risk-focused adversarial probes. Record untouched suites as not behaviorally certified; never turn an inventory into a universal correctness certificate. All confirmed gaps within this scope must be repaired or explicitly block completion. New unrelated product features are out of scope.

Do not redefine README's goal, alter historical/frozen artifacts, edit `.claude/settings.json`, bypass hooks, or change standing runtime/provider configuration. Treat runtime infrastructure outages separately from product defects.

## 4. Required assurance contract

For each mechanically enforced kernel obligation, record the following evidence at the appropriate layer:

| ID | Requirement | Observable acceptance |
|---|---|---|
| K1 | Valid use is admitted | A compliant fixture passes the real carrier; include boundary and legitimate alternative syntax where relevant |
| K2 | Real violation is rejected | A violating fixture fails with the intended rule/diagnostic/status, not an unrelated error |
| K3 | Checker regression is detected | Unchanged relevant suite fails when the actual detector is disabled or narrowly weakened; an independent probe confirms the fault was reached |
| K4 | Over-rejection is detected | An always-reject or relevant false-positive fault is caught by the compliant corpus |
| K5 | Delivery is live | Break a representative wiring edge and show the delivery test fails: source → emitted/copied/installed artifact → invoked runner/config → required gate |
| K6 | Discovery is complete | Missing/empty selection, excluded canonical extensions, missing manifests, deleted/new paths and runner failures cannot silently yield green |
| K7 | Evidence is honest | Logs identify fault, exercised carrier, test assertion and restoration; status alone is never proof |

K1–K4 apply per independently meaningful enforcement predicate, grouped where one fixture/probe truly covers the same mechanism. K5 applies per distinct delivery family, plus each configuration-specific edge that can drift independently. Avoid a Cartesian product of every rule and every runner.

For prose/judgment requirements, declare exactly what a structural gate checks and what remains semantic. Use the existing named cold review protocol with structured findings and disposition for the semantic part. Do not make an LLM a paid CI dependency. Review findings enter a blocking disposition queue; a log warning with no consumer is insufficient.

The regression oracle must not reuse the implementation's decision procedure to calculate the expected decision. Reuse setup/building blocks where harmless; preserve independent expected outcomes. Observe the public boundary named in the obligation: actual subprocess status, files on disk, real ESLint config, installed hook, or real workflow selection, as applicable.

## 5. Tautology and weak-oracle policy

Extend the existing test-quality/principles contract in its authoritative home; do not create competing policy copies. Explicitly prohibit presenting these as behavioral evidence:

- An assertion independent of the subject's output (constant versus constant; fabricated success or status).
- Reimplementing the production predicate in the test and asserting the copy instead of invoking the delivered implementation.
- Computing expected output with the same decision logic as actual output.
- Finding a required token in the assertion's own source, a comment, a fixture label or a dead code branch when executable behavior is claimed.
- Ignoring subprocess return codes or asserting only an unrelated side effect.
- Testing an in-memory plan while claiming the emitted/installed configuration enforces it.
- Treating empty discovery, a skipped mutation run, or a surviving non-equivalent reachable mutant as success.

Distinguish these from legitimate constant expected values, snapshots, structural/schema contracts, parity tests, determinism tests, helper assertions and asynchronous assertions. Such tests remain useful within their stated claims. Parity cannot establish that both sides are correct; a semantic contract requires an independent behavioral anchor.

Use existing ESLint/Vitest rules for their supported syntax-level guarantees. Extend their actual file scope to every supported canonical test naming/location convention. For a new custom rule, require a narrow decidable contract, measured positive/negative corpus, and no unsupported dataflow claim. Ambiguous usefulness belongs in the named review protocol, not a brittle hard-blocking grep.

### First implementation acceptance: bad tests must be rejected

S1 must deliver executable test-quality metachecks, not just a policy, inventory or reviewer instruction. Exercise the real checker entrypoints on an explicit adversarial corpus:

| Case | Bad-test example / defect | Required metacheck result |
|---|---|---|
| Q1 | Behavioral test containing only `expect(true).toBe(true)` or equivalent literal-only success | Reject as vacuous under a narrowly specified static contract; intentional fixture/harness cases have explicit, tested exclusions |
| Q2 | Governed test contains no effective assertion (comment-only, empty body, disabled assertions, fabricated status) | Reject via actual supported lint/runner/conformance mechanism; recognize legitimate assertion helpers and async failures |
| Q3 | Test checks a copied predicate or derives expected outcome with the same predicate, and survives a reached non-equivalent fault in the real subject | Behavioral sensitivity audit must reject that test/suite's claimed assurance; do not claim AST syntax proves general oracle independence |
| Q4 | Process fails with an intended nonzero status but test passes because the status is ignored | The test-quality sensitivity check rejects the claim, and the repaired suite fails on that actual process outcome |
| Q5 | The asserted phrase occurs only in the assertion/comment while the claimed source/wiring obligation is broken | Real gate conformance rejects the case; circular source evidence cannot discharge the obligation |
| Q6 | In-memory plan looks valid while delivered configuration is disconnected or disabled | Delivery conformance rejects the test suite's behavioral claim using the real emitted/installed artifact |

Each case has a corrected good companion that passes. Record which channel detects each class: cheap syntax gate where decidable, executed gate conformance, or explicit deep sensitivity audit. Q3 does not require automatically inventing arbitrary faults: use the pinned reached faults and frozen oracle from section 6. For semantic cases outside those demonstrated contracts, use the named review channel and report the limit. Zero supported detections is not S1 completion. A checker that reports the bad test only as a warning nobody consumes does not pass acceptance.

Break each mechanically claimed test-quality detector or its actual invocation and show this corpus verification fails; otherwise the new metachecks could become the same decorative layer they are intended to replace. Freeze expected classifications independently of detector output. These Q1–Q6 checks and their positive companions are the S1 exit gate before broad S2 repairs.

The anti-tautology mechanism itself must satisfy K1–K7 within its declared scope. Required corpus includes bad constant assertions, self-satisfied source reads, copied predicates, recomputed expectations, ignored exits, wrong imported implementation and disconnected emitted output, plus good structural/parity/helper/async cases. Not every bad class must be mechanically detectable: every class must have an explicit detection channel and an acceptance probe for that channel.

## 6. Design: reuse, bounded counterfactuals, cost lanes

Reuse existing guard-liveness probes, principle helpers, Vitest, installed ESLint/Vitest plugin, native test discovery and existing mutation tooling. Relevant homes include `packages/core/hooks/checks/guard-liveness*.ts`, `packages/core/principles/`, `packages/core/audit-self/`, `packages/core/synthesizer/`, and shipped ESLint templates. Consult the repository prior-art register before adding any capability. This design does not authorize a new test platform, universal semantic analyzer or bespoke orchestration engine.

Use a small explicit set of representative faults per obligation/family: permissive detector, over-rejecting detector, boundary weakening, and delivery disconnection. Choose a localized mutation in the production carrier; freeze the test set between baseline and mutant. Modify a scratch checkout only. Save the patch/hash and prove it applied exactly once. Verify restoration and a passing final baseline. If the principle test itself is the production gate, use a separate unchanged conformance driver: it runs the real gate over compliant/violating scratch repositories and asserts the expected process outcome and diagnostic. Seed a permissive/over-rejecting fault into that gate while the outer driver and governed corpus remain fixed; the driver must detect it. Merely changing governed input proves K2, not K3. Do not delete an assertion in the outer oracle and count that as sensitivity. Refactor a predicate only where it preserves the actual entrypoint and improves testability; the driver must still verify the shipped entrypoint. The frozen outer driver and its independently reviewed expected outcomes are the explicit trusted boundary; this is not an infinite meta-test ladder. If this separation cannot be established, record unresolved K3 and block DONE for that obligation.

A minimal counterfactual result contains: obligation ID, source SHA, carrier and delivery edge, fixture hash, test IDs, fault patch hash, independent reachability observation, baseline result, mutant result with intended failed assertion, restored result, runtime, and classification. Killed is not the only valid classification: equivalent, unreachable, out-of-contract and infrastructure-failure must remain explicit and cannot inflate sensitivity.

Keep these lanes:

| Lane | Trigger and purpose | Cost control |
|---|---|---|
| Edit/pre-commit | Existing test-quality lint and narrow deterministic checks | Changed applicable files; no repository-wide mutation |
| Pre-push / ordinary PR | Behavioral regression tests and cheap delivery/discovery checks for affected obligations | Reuse one invocation where possible; bounded selection with conservative fallback |
| Deep assurance | Initial campaign, assurance-kernel/carrier changes, or explicit scheduled/manual audit | Full relevant counterfactual corpus and configured mutation; outside unrelated PR critical path |

No check is removed from a required lane before an equivalent obligation-preserving replacement is tested. If introducing affected-test selection, changes to selectors, package/lockfiles, shared configs/helpers, workflow wiring, unknown paths, renames/deletions or discovery errors must expand conservatively. Test the selector by deleting/renaming files and disconnecting imports, not only by checking its own table. Native related-test discovery does not by itself cover shell, file reads, generated assets or child processes.

Do not build cross-run evidence caching unless measurement shows it necessary. If introduced, bind reuse to all relevant source/fixture/config/dependency/toolchain/environment inputs, reject missing/unknown keys, and prove invalidation with a dependency-only and environment-class change. Reusing a passing report by branch name, task status or HEAD alone is forbidden.

## 7. Portable seed register (revalidate on execution base)

| Seed | Audit observation | Required experiment / disposition |
|---|---|---|
| A01 P06 | R4 normative policy softened; principle suite stayed green. Lowercase MUST alternative produced a heuristic false positive | Clarify syntactic versus semantic claim; test actual policy weakening and accepted wording. Do not call an explicitly documented token grammar a runtime bug |
| A02 P38 | Replace workflow test command with `true`, retain old command only in a comment: coverage principle stayed green; removing comment exposed missing files | Resolve actual workflow execution structure and command scope; reject dead/comment-only evidence; include legitimate multiline commands |
| A03 P16/P21 | Assertions could satisfy required phrases in their own source; at least one sibling test still caught a disabled P16 helper | Remove circular oracle where behavior is claimed; preserve useful structural tests; never label whole suite useless from one assertion |
| A04 emitter | Force serialized ESLint severities to `off`: 431 relevant tests still passed, installer returned success, real disk config failed to reject banned import | Test emitted and installed artifact with real ESLint and intended diagnostic; positive and negative fixtures; verify installer validation boundary |
| A05 ErrorBoundary | An unrelated wrapped component in same file suppressed diagnostic on unwrapped App in both TS and shipped MJS rule | Correct ancestor-scoped detection within documented in-file scope; test multiple components, valid wrap and actual shipped twin |
| A06 R4 | Comment-only, empty and constant unit tests passed structural probe; real age-boundary test killed >=18→>=0 while constant did not | Narrow R4 claim and strengthen enforcement/review channel; exercise actual probe and generated consumer test path |
| A07 P02 | Regex accepted comment/fabricated status while rejecting a real destructured-status assertion | Prove genuine subprocess behavior and supported assertion forms; define structural floor without semantic overclaim |
| A08 shell | Dry-run seam observed only `.husky`, so writes elsewhere survived; installer artifact test ignored explicit exit 42 despite expected artifact | Observe the full intended filesystem side-effect boundary and real exit status; inventory/classify all analogous hits |
| A09 lint scope | Unchanged ts-server ESLint config enabled Vitest rules on `.test/.spec` but not colocated `.unit/.audit/.integration` | Run calculateConfigForFile and real bad/good test lint for every supported naming convention in all sibling presets/templates |
| A10 structural limits | Exact six no-op strings missed comment-suffixed form; Stryker config test accepted all-excluding glob | Confirm whole delivery-path behavior before claiming bypass; require nonempty discovered/mutated population or explicit inapplicability |
| A11 ratchet | P50 baseline permitted existing scanner hits | Classify entire candidate population, fix actual ignored-status defects, preserve legitimate exceptions with rationale; never bulk fabricate assertions |
| A12 output integrity | Fence/hash corruption survived composition suite | Compare final emitted content/integrity contract, with valid output control; rank by actual impact |

The seeds are mandatory regression cases, not the investigation's stopping rule. Q03 pass-or-warn and similar preliminary suspicions remain unconfirmed until actual behavior is reproduced. Preserve evidence of negative findings too.

## 8. Performance acceptance

First measure actual local pre-push sections and CI jobs/critical path. Existing isolated file intervals (for example P43 around 19 s and mutation-skip tests around 20 s) are profiling leads, not established PR bottlenecks. Collect test counts, child process count, repeated work, setup/install time, execution time and wall time. Identify avoidable repeated costs before adding new machinery.

Freeze the campaign performance baseline before repairs or optimization. Record both baseline and final SHAs and compare the final repaired code against that baseline with identical host class, toolchain and workload definitions. Measure S2-to-S3 separately to expose repair overhead versus optimization gains; do not substitute this narrower comparison for the campaign result. Include: a documentation-only change, a representative production-rule change, a kernel/shared-config change, and broad/unknown-path fallback. Run three comparable trials per locally exercised workload, report individual values and median; state cache/concurrency conditions. Compare cold setup separately from warm developer feedback. CI queued time is separate from job execution; use actual checks where available, not local timing as a substitute.

Acceptance targets: (1) no new unconditional expensive suite or full mutation on ordinary unrelated PRs; (2) at least 20% median wall-time reduction for the baseline's dominant ordinary-code-change local gate workload; (3) no regression greater than 5% or 1 second, whichever is larger, on the other local workload medians; (4) no increase in the number of expensive full-suite invocations on the CI critical path; (5) preserve all obligation coverage, including conservative fallback. These are campaign targets, not claims that the measured host can already achieve them. If noise exceeds tolerance, add at most two trials and report uncertainty rather than select favorable runs.

If a target cannot be met safely, report PARTIAL with measured lower bound and remaining bottleneck; do not weaken a check, change the workload after seeing results, or silently declare success. Prefer removing redundant process startup/repeated compilation and batching immutable reads over routing changes. Any selected optimization must include a regression case for its correctness risk.

## 9. Execution stages and handoff

GPT-6.1-sol translates this design into an executable umbrella kickoff plus atomic stage prompts, without relaxing requirements. Use the current dispatcher/orchestrator conventions and the six-block GLM input contract. Each GLM assignment has one deliverable, explicit allowed paths, real tools, bounded rework, and checkable acceptance. The coordinator can partition a stage further by mechanism to keep GLM objectives atomic.

| Stage | Deliverable | Exit gate |
|---|---|---|
| S0 | Cheap complete raw discovery, frozen cost baseline, focused test-quality detector/corpus characterization | Raw denominators pinned; kernel Q1–Q6 baseline recorded; no implementation changes; broad investigation deferred to S2 |
| S1 | Executable anti-tautology/test-quality metachecks, authoritative contract and adversarial corpus | Q1–Q6 reject bad tests and admit good companions; K1–K7 mapped; detector-disable checks fail; cold semantic review |
| S2 | Full population classification using strengthened metachecks; seed replay and repairs to all confirmed in-scope gaps, in sequential mechanism batches | Every candidate dispositioned; real faults detected, false-positive corpus passes, shipped parity and delivery verified |
| S3 | Measured PR-path optimization | Coverage-preservation proof and section 8 measurements pass |
| S4 | Independent acceptance package | Final code and actual delivery verified; all cases dispositioned; no claimed result relies only on worker report |

S0/S1 may expose new in-scope defects; add atomic S2 batches rather than stopping at A01–A12. S0 must not expand into a complete manual audit before the first kernel fix; raw enumeration and baseline are prerequisites, while exhaustive candidate investigation belongs to S2. S1/S2 are iterative: first establish a failing meaningful regression, then repair production or the relevant test contract, then verify the former fault is detected. Never mutate tests and production simultaneously to manufacture a green result.

Requirements/spec and kickoff must reach staging before AIF launch, following the repository's placement rule. Run the documented in-flight probe before launch and immediately after cold review. Verify actual runtime model/profile: a GLM-labelled prompt is not proof that a GLM worker ran. Do not silently substitute Codex/Claude implementation for the user's GLM request. Coordinator/reviewer models may differ from GLM by role.

A worker DONE status is a request for verification. Independent reviewers replay relevant acceptance and inspect diff, raw evidence, unresolved cases and runtime receipts. Separate spec compliance from code-quality review. Bound rework per the existing handoff procedure; a cap produces BLOCKED/PARTIAL, never a fake completion.

## 10. Deliverables and final acceptance

Deliver tracked, portable artifacts: obligation/test inventories; requirement-to-evidence matrix; candidate/finding dispositions; baseline/mutant/restoration results and reproducible commands; final runtime measurements; changed contracts/tests/implementation; PR/check links; executor/model receipts; remaining limits. Large raw artifacts may use the existing artifact channel with durable hashes and retrieval instructions, not transient absolute host paths.

Final DONE requires all kernel K1–K7 obligations discharged within declared scope, every candidate dispositioned, all confirmed in-scope defects repaired, positive/negative and delivery controls passing, performance acceptance met, normal required checks green, and independent final review. Report exact certified scope and any unexamined semantic behavior. A green full suite cannot override an unresolved reachable counterexample.

Host verification must execute actual commands on the target environment. Linux AIF validates Linux execution; macOS-specific hook/install behavior and measured developer latency require host verification on this Mac. Kickoff contains a runnable host-verify section naming commands and expected evidence; never `true`, prose-only instructions, or commands that silently skip missing prerequisites. Cannot-reach claims require bounded live probes of the configured target.

### §1.7 Forward-check applied

This design applies its own evidence discipline: section 4 separates structural, behavioral, sensitivity and delivery claims; section 8 makes speed measurable and section 10 rejects a self-reported DONE. Current mechanism homes were inspected at `packages/core/principles/38-vitest-include-ci-coverage.test.ts:1` and `packages/core/hooks/checks/guard-liveness.ts:1` on the pinned baseline. The spec is designed, not represented as already enforced.

### §1.7 Backward-check applied

The initial independent audit supplied counterexamples spanning principles, subprocess tests, shipped lint scope and emitted output. Section 3 now requires a complete population/disposition rather than extrapolation from those examples. `packages/core/principles/50-install-rc-asserted.baseline.json:1` is an explicit candidate backlog, not proof of 326 defects. The implementation stage must run a fresh class-based cold backward sweep and reconcile its complete findings before closure.
