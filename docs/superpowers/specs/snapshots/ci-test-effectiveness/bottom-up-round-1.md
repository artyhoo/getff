# Cold bottom-up architecture review and builder check — round 1

Inputs-ref: `62e3407c3ac4252cce9d0bfd1b90b616265354c2`.
Review target: immutable `round-1/docs__superpowers__specs__2026-11-08-ci-test-effectiveness-design@62e3407c3ac4.md` (189 lines).
Role: design implementability and unanswered implementation-planning decisions only. No campaign execution, CI/test audit, suite execution, live task/remote-status inquiry, or repository mutation was performed.

VERDICT: GO

No BLOCKER, MAJOR, MINOR, or ESCALATED findings. No failure scenario requiring specification revision was established.

Provenance: layer=corpus-measured; whose=judgment-only, not corpus-validated; class=measured null (recorded grade remains the class bar).

## Evidence and implementability

The review read the approved PRD snapshot, operator clarifications, TAK design and kickoff, reviewer-discipline and effort-worthiness snapshots in `round-1/`. Dependency reads used `git show <Inputs-ref>:<path>` exclusively. The PRD's original pre-approval wording was not treated as an approval defect; the candidate explicitly identifies the separate approval authority at `docs__superpowers__specs__2026-11-08-ci-test-effectiveness-design@62e3407c3ac4.md:12`.

- **Existing tools and entrypoints are a usable foundation.** The proposal relies on existing runners/manifests/discovery rather than a nonexistent bespoke API (`docs__superpowers__specs__2026-11-08-ci-test-effectiveness-design@62e3407c3ac4.md:36`). At Inputs-ref, root `package.json` declares workspace test dispatch; `packages/core/package.json` declares Vitest, Node test, shell and Python entrypoints and existing ESLint/Stryker dependencies; root `vitest.config.ts` supplies the root invocation configuration. This verifies declared integration surfaces, not their correctness or runtime availability.
- **Named TAK artifacts exist and carry reusable identifiers.** All three exact paths linked at `docs__superpowers__specs__2026-11-08-ci-test-effectiveness-design@62e3407c3ac4.md:73` exist at Inputs-ref: `docs/test-assurance-kernel/s0/population.json`, `workloads.json`, and `manifest.json`. The manifest contains source SHA, lock identifier, tool versions and environment; workloads contain argv, change-class descriptors, trial results and raw-log references. The candidate correctly requires reconciliation before reuse instead of claiming these historical records establish the launch state.
- **Inventory and invocation reconciliation has existing surfaces.** The tracked TAK population names workflow files, guard-liveness homes, `packages/core/principles/37-required-context-completeness.test.ts`, `scripts/ci-path-scope.sh`, and `scripts/ci-path-scope.test.sh`. `scripts/run-local-ci-sweep.sh` declares its local gate aggregation role and the distinction between covered and unreachable CI paths. These support the proposed existing seams at `docs__superpowers__specs__2026-11-08-ci-test-effectiveness-design@62e3407c3ac4.md:145`; no claim about their current effectiveness follows from their presence. Native discovery is explicitly reconciled with tracked sources and invocations, and unsupported/dynamic discovery cannot silently certify an empty population (candidate lines 83–85).
- **The campaign record is implementable without a new platform.** Items, invocations, evidence and decisions have enough logical fields to construct a portable linked record (`docs__superpowers__specs__2026-11-08-ci-test-effectiveness-design@62e3407c3ac4.md:87`). Choosing JSON, TSV or a small combined document is an ordinary implementation choice; no fixed consumer interface requires an architecture-level format decision first.
- **TAK sequencing remains a dependency, not an assumed delivered service.** The TAK kickoff snapshot explicitly orders S0–S4 (`.claude__orchestrator-prompts__test-assurance-kernel__kickoff@62e3407c3ac4.md:55`), while the candidate requires actual-state discovery and forbids duplicate repairs, changed stage order or silent supersession (`docs__superpowers__specs__2026-11-08-ci-test-effectiveness-design@62e3407c3ac4.md:77`). Its separate audit/decision boundary therefore does not authorize rerouting TAK implementation.
- **Evidence and acceptance have defined seams and stopping behavior.** Real entrypoints, independently fixed expected cases, scratch faults, restoration, bounded matched timing and combined-removal checks are specified at candidate lines 100–110 and 118–122. Missing host/CI evidence explicitly limits claims (line 149); lack of a currently accessible host is not silently replaced with a new infrastructure requirement. These are implementable verification obligations, not assertions that the work has passed.

## Builder questions

Nothing important left. No unanswered question was identified whose wrong answer must change this design before an implementation plan can be written.

The actual launch branch, then-current TAK ownership/state, workload selections, concrete patches and worker allocation are deliberately established during execution baseline/kickoff decomposition (candidate lines 71–79 and 164). Pinning them now would either duplicate required future freshness checks or invent current campaign findings. They are not missing design decisions.

## Effort-worthiness trace and unverified cells

This pass checked dependency existence, declared interfaces and whether the builder must guess a consequential contract. Those checks can invalidate the plan before implementation and were bounded to the named seams. Running suites or surveying individual tests would perform the expressly deferred audit and would not be proportionate to this design-only review.

Unverified: actual runner behavior/discovery, inventory completeness, test effectiveness, CI costs/history, live freshness, ongoing TAK task state, and target-host execution. These are execution evidence cells explicitly required by the candidate, not certified by this GO. No new value premise or strategic choice was introduced.
