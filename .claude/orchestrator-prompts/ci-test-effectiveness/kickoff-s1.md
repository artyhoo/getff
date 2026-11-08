# CI and tests — S1 complete audit and evidence-backed decisions

> **Authoritative for:** stage 1 deliverable, write boundary and acceptance.
> **Not authoritative for:** campaign requirements, project goal or launch mechanics.

<task>
Produce the complete, evidence-backed CI/test effectiveness assessment and decision package.
Do not repair checks in this stage.
</task>
<context>
Read kickoff.md and the agreed specification. Audit every CI check and test, including
metatests and TAK, against all seven criteria. A complete population plus proportional
investigation is required; neither convenience sampling nor one costly experiment per item
is the prescribed method. Existing TAK S0 data is historical input until reconciled.
</context>
<constraints>
Write only docs/ci-test-effectiveness/**. Probes and localized reached faults run in disposable
copies outside the working baseline, with complete restoration evidence. Read production
sources, runner configs, workflows and local invocations as needed; do not edit them.
Do not amend frozen TAK evidence or an approved intent/spec snapshot. No infrastructure work.
If an assessment remains unknown, keep it explicit and report PARTIAL/BLOCKED; do not certify it.
</constraints>
<tools>
Existing Git, native runner discovery, source/invocation analysis, CI history and applicable
TAK evidence. Narrow runtime probes/profiling only when a decision requires them; separate
intended diagnostic failures from environment, compilation, permission, timeout and network failures.
</tools>
<output>
Create baseline.json, inventory.jsonl, decisions.jsonl, stage-1.md and referenced raw evidence
under docs/ci-test-effectiveness/. Native portable formats suffice; no new permanent validator
or service is required to satisfy stage 1. Preserve exact source and evidence identities.
</output>
<verify>
Independently reconcile the full population and seven criteria, cost and protection maps,
TAK dependencies and all decisions. Unknown assessment prevents S1 acceptance. Metadata checks
alone do not establish substantive audit completeness. No product changes are included in S1.
</verify>

## Work and record interfaces

- [ ] Establish live integration base, divergence and relevant open/active work in isolation.
  Record repository/base/audited SHAs, locks/configs, tool versions, host, time and access limits
  in baseline.json. Resolve TAK planned/in-flight/landed/verified state and responsibility map.
- [ ] Enumerate tracked test sources and declared entrypoints; reconcile native discovery,
  generated/shipped/parameterized cases, fixtures, disabled/skipped cases, all CI events/jobs/
  steps and repeated local invocations. Distinguish non-test automation. Record item IDs and
  member identities; groups require explicit shared evidence and per-member applicability.
- [ ] For each item record obligation/risk, oracle source, delivery/invocations, protection
  boundary, seven named criterion conclusions and evidence refs. Include cost fields for setup,
  execution, queue/wall-time, retries, maintenance/diagnosis and repeated work where relevant;
  record unavailable measurements honestly. Runner discovery errors cannot yield an empty pass.
- [ ] For each decision record id, itemIds, action (retain/remove/redesign/repair/combine/relocate),
  requiredProtection, evidenceRefs, alternatives, consequences, retainedWitnesses, dependencies,
  expectedBenefit, verificationContract and unresolved facts. Unknown values are explicit,
  never a fabricated pass or unlimited exception. Measure economical alternatives where needed.
- [ ] Produce root-cause classes and a proposed principle→existing/extended/new detector map,
  with legitimate counterexamples and prospective invocation. This plans E9; S2 must deliver it.
- [ ] Freeze comparable workload definitions and available baseline evidence before changes.
  Separate cold/warm, CI/local and host classes. Only needed new timings use three matched
  trials, at most two extras for noise. Preserve individual values, medians and uncertainty.
- [ ] Challenge omitted categories and assess audit effort against decision value. Write
  stage-1.md with denominator reconciliation, protection/duplication map, decision priorities,
  proposed S2 batches, TAK dependencies, evidence gaps and self-application/cost limits.
- [ ] Obtain independent acceptance of the whole S1 package. Cases of insignificant benefit
  remain useful protection until a same-quality redesign is supported; never silently drop them.

## Acceptance examples

A file census with no runner reconciliation fails. A family-level conclusion with unexplained
members fails. A structural source match cannot establish runtime behavior. A duplication claim
that ignores environment/source/trigger differences fails. A passing suite after a reached fault
is a demonstrated sensitivity gap, not proof of protection. An inaccessible remote is unknown.

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

<!-- host-verify: none — Read-only assessment with portable evidence as deliverable; any host-specific observations require raw commands on that actual host and cannot be certified from this authoring environment. -->
