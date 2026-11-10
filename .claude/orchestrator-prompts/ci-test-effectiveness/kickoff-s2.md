# CI and tests — S2 improvements and recursive prevention

> **Authoritative for:** stage 2 decomposition, implementation and final acceptance.
> **Not authoritative for:** project goal, launch mechanics or requirements owned by the specification.

<task>
Implement the accepted audit decisions and deliver generalized principles with effective
executable prevention, recursively assessed for quality and efficiency, then independently
verify the complete outcome without loss of required protection.
</task>
<context>
Consume accepted S1 baseline.json, inventory.jsonl, decisions.jsonl and stage-1.md plus raw
evidence. Read kickoff.md and the complete specification. E9 is mandatory: report-only
recommendations, isolated example repairs, prose-only principles and self-certified metatests
cannot complete the campaign. Reconcile live branch/TAK changes before each batch and final review.
</context>
<constraints>
Coordinator write ceiling: audited production, test, CI, configuration and delivery surfaces
needed by accepted decisions, including packages/**, tests/**, scripts/**, templates/**,
setup.d/**, canonical .agents/**, .husky/**, .github/** and root manifests, lockfiles,
Makefile, runner/linter configs and install/setup entrypoints. Coordination artifacts may be
written under .claude/orchestrator-prompts/ci-test-effectiveness/**, with their necessary
.gitignore exceptions; evidence lives under docs/ci-test-effectiveness/**. This ceiling grants
no worker blanket write scope: each atomic subtask names exact audited files, the decision
justifying every edit and one independently reviewable deliverable. Unrelated root files
and protected goal/approved historical artifacts remain outside that grant.
Preserve immutable baseline evidence; append changed-input/final observations separately.
No goal/support-contract change, quality loss, hook bypass, paid LLM in CI, competing TAK
platform, infinite meta-layer growth or edits to historical/approved artifacts.
</constraints>
<tools>
Use the discovered actual runners and existing conformance seams. Reuse/extend applicable TAK
components when delivered; unresolved dependencies are explicit. Native dispatcher/review and
host verification follow current repository contracts. Do not invent installed tools or scripts.
</tools>
<output>
Commit supported removals, simplifications and repairs in coherent mechanism batches.
Maintain docs/ci-test-effectiveness/batches/<id>.json with decisionIds, exact files, input/final
SHAs, tests/commands, raw evidence refs, protection/cost result and rollback. Extend inventory
with all new principle/metacheck/driver items and add criterion/evidence records. Produce
report.md and a principle-to-detector matrix using existing records, not a duplicate registry.
</output>
<verify>
Every supported in-scope decision is implemented or explicitly blocks full completion.
All E1–E9 and specification §8 pass, including joint-removal safety and required detection
timing, legitimate passes, real defect detection, generalized prevention and recurring cost.
Normal checks and independent final acceptance inspect actual delivery and raw evidence.
Unfixed confirmed gaps, unresolved quality loss or unimplemented supported removals prevent DONE.
</verify>

## Atomic batch protocol

- [ ] Refresh changed-input and TAK responsibility map; revalidate only affected S1 claims.
  Select one coherent mechanism and record exact file allowlist, decision IDs, unchanged
  protection cases, intended improvement, runnable verification commands and rollback.
- [ ] Author an atomic stage kickoff using recognised kickoff-<letter><digit>[alnum].md naming
  and the current six-block contract. Keep it durable under normal placement rules; independently
  review consequential batches. Do not dispatch a vague “fix everything” assignment.
- [ ] For a real defect, demonstrate meaningful RED at the actual public/delivered boundary
  with fixed independent expectations; implement the smallest repair and prove GREEN plus
  valid alternatives. For removal, demonstrate the surviving protection and joint-removal
  witness instead of adding a ceremonial test asserting the deleted file stays absent.
- [ ] Prefer removing proven duplicate invocation/setup/compilation and simpler equivalents.
  If selection/caching is justified, verify shared config/lock/helper changes, renames/deletions,
  unknown paths/discovery errors and input invalidation, with conservative fallback.
- [ ] Generalize each demonstrated root-cause class into an authoritative principle. Map to
  existing covered enforcement, extension or a narrow new mechanism. Reuse the canonical
  principle/TAK/review-sidecar homes and their real bindings; avoid one new rule per incident.
- [ ] Demonstrate prevention through the real future edit/commit/PR channel: defective cases
  fail for the intended reason, valid companions pass, an additional relevant variant prevents
  fixture-specific recognition, and a reached detector/invocation weakening is caught with
  corpus and expectations frozen. Record restoration. Semantic judgment retains the named
  structured review/disposition path; a schema/receipt alone never proves its substance.
- [ ] Apply all seven criteria to the new principles, metachecks and conformance driver.
  Use TAK's independent conformance contract when applicable; a pending driver is a dependency,
  not an assumed existing tool. Fixed independently reviewed expectations are the explicit
  trusted boundary. Reopen contrary evidence; do not generate infinite driver-of-driver tests.
- [ ] Measure the actual before/after effect on affected matched workloads using S1 definitions.
  Separate repair overhead from optimization gain and report campaign baseline→final result.
  Include newly added prevention cost and any shifted queueing/host work; no cherry-picking.
- [ ] Check the combined final system, generated/shipped artifacts and required aggregation.
  Independently replay consequential/disputed claims and root-cause→principle→detector coverage.
  Run existing required checks appropriate to the actual patch; distinguish baseline/infra
  failures. Do not repeat unaffected historical experiments without decision value.
- [ ] Write report.md: complete denominator/dispositions, implemented changes, retained
  protection, principles/enforcement including self-application, measured costs, exact final
  source/CI/host receipts, remaining limits and DONE|PARTIAL|BLOCKED. Zero safe optimization
  findings may justify retention; it cannot waive demonstrated prevention or unresolved gaps.

## Rework and stopping

Continue routine fixes within the exact batch. Additional experiments require a concrete
unresolved decision or counterexample. After two unsuccessful attempts at the same method,
change the method or record the dependency instead of repeating it. Five unsuccessful
implementation/verification iterations in one atomic mechanism batch trigger a scoped
BLOCKED/PARTIAL report and a concrete continuation proposal; do not lower the acceptance bar.
Unrelated findings remain outside this campaign. Any requirement conflict or proposed loss
returns to the appropriate owner under existing escalation contracts, not an implicit waiver.

## Native execution route selected by the operator

On 2026-11-08 the operator selected “го без аиф” (proceed without AIF).
Execute through native subagents in an isolated checkout, with the same S1→S2 and independent
acceptance gates. Factory-only staging placement, AIF project/claim and container probes do
not block this selected native route. Reconcile actual remote/GitHub work and TAK before
starting; retain the agreed intent/spec authority and never claim an AIF task exists.
The staging-before-launch paragraph below remains the factory-route contract. Normal Git/PR
integration still applies to delivered native results. This is a transport ruling, not a
change to scope, protection quality, evidence, metatests or stage acceptance.

## Shared authority and execution contract

Feature: `ci-test-effectiveness`. Read `docs/superpowers/specs/2026-11-08-ci-test-effectiveness-design.md` in full, SHA-256 `77e669ad6113b9674c6b32f92554af1a490e5828127f4c9ebea800f271a83e4a`.
Approved PRD: `docs/superpowers/specs/snapshots/ci-test-effectiveness/prd-94604da4fd7b685645f6ddb396518a6d97a48a92ca66313d1dcaef19b33357c4.md`.
Agreement: `docs/superpowers/specs/snapshots/ci-test-effectiveness/spec-agreement-2026-11-08.json`.
The operator approved specification and kickoff preparation in this design chat. Execution
is a separate routed effect; document presence is not a task claim or launch receipt.

Read AGENTS.md, README goal, `.agents/session-bootstrap.md`, CLAUDE.md and applicable
canonical rules/procedures from the actual execution checkout. Use current task-tier,
worktree/isolation, dispatcher, review and normal Git integration contracts. Tier 2 umbrella:
complete scope and judgment are required; do not send this entire umbrella as one worker task.
No executor model/profile is presumed. Preserve TAK's own executor and acceptance contracts
when coordinating TAK-owned work. No bridge-profile/auto-dispatch marker is granted here.

Before launch, ensure spec, approval/decision artifacts and these regular-file kickoffs are
actually present on the current integration branch (`staging` under current conventions).
Resolve current remote state; perform the existing dispatcher in-flight probe and normal
intent-continuity admission with feature ID `ci-test-effectiveness`. An unavailable probe
means unknown, never proof that no competing task exists. Recheck at the actual launch effect.
Do not bypass hooks, protection, permissions or normal checks, edit `.claude/settings.json`,
change standing runtime/provider configuration, or silently supersede TAK. Preserve unrelated WIP.

Rigor label (L0): `research-grade` for complete audit, protection changes and acceptance;
keep each actual experiment proportional to its decision. No automatic full mutation on
unrelated PRs. No paid LLM in CI. Use existing tooling and prior-art consult before any new
capability; no separate audit service, generic semantic analyzer or dashboard.

## AI traps and adversarial self-application

Apply `.agents/rules/ai-laziness-traps.md` §2–§3. Active traps: **T3** (actual evidence,
not plausible prose), **T7** (run the category-level adversarial challenge), **T10**
(enumerate before conclusions), **T14** (unknown/unexamined is not certified), **T15**
(self-apply to new metachecks), **T18** (preserve unique protection before deleting),
**T19** (independent acceptance), **T20** (evidence before verdict) and **T22**
(reached fault with a frozen independent oracle).
Domain trap **T-CTE-A**: individually redundant checks may depend on each other; assess
joint removals against surviving witnesses. **T-CTE-B**: a small benefit is not zero;
redesign expensive useful protection without losing required timing or supported environments.
**T-CTE-C**: a registry row or a green metatest is not substantive prevention; test the
real future invocation and detector-disable behavior. **T-CTE-D**: no infinite chain of
new metatests; name the finite independent TAK conformance boundary and assess its cost.

Run this category challenge before each stage report: “Which test or invocation family,
criterion, enforcement boundary, supported environment, or new metacheck have we omitted?
Which combined change can pass our evidence yet weaken protection?” Record the answer,
the resulting bounded probe when needed, and residual uncertainty. Zero findings is legitimate.
A report cannot claim the audit applied to itself without including its new mechanisms and cost.

## Destination verification ownership

<!-- host-verify: none — Coordinator decomposition package; every implementation sub-kickoff must declare runnable change-specific host verification before dispatch, and pending host evidence prevents acceptance. -->

Before accepting an atomic implementation kickoff, run `bash scripts/host-verify.sh --list <exact-kickoff-path>` and inspect its actual command coverage. An implementation task must contain real changed-boundary commands, not inherit this coordinator opt-out. Execute those commands on the relevant destination host during acceptance, retaining output and exit status.
