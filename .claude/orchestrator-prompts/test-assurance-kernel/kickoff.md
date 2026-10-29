# Test assurance kernel — execution umbrella

> **Authoritative for:** campaign sequencing, placement and GLM execution transfer.
> **NOT authoritative for:** project goal (README), requirements (specification), or execution loop (dispatcher).

Rigor label (L0): `research-grade`. Executor: **GLM-5.3 in Claude Code**.
Implementation has not started; specification review GO is not kickoff or runtime acceptance.

<task>
Execute the reviewed test-assurance-kernel campaign through independent acceptance.
</task>
<context>
Authoritative specification: `docs/superpowers/specs/2026-10-08-test-assurance-kernel-design.md`.
SHA-256: `55fa921e75a31a0d4bb8a34a2196a384ad6be227467cd8e2ff92837071dad2a9`. Read in full.
First implementation deliverable = S1 working test-quality/anti-tautology metachecks;
S2 uses them for full candidate investigation and repairs. S3 performance is mandatory.
The umbrella is a routing instruction, not one multi-goal GLM worker assignment.
Delegate only atomic six-block stage/mechanism tasks; do not forward conversation transcripts.
</context>
<constraints>
Own all subsequent integration/staging placement, runtime diagnosis, AIF discovery/dispatch,
implementation, PR/check handling and independent acceptance. The operator authorized the
campaign; do not ask for repeated authorization. Preserve stop conditions for genuine blockers.
No silent switch of executor to Claude/Codex. Reviewer models may differ, with explicit receipts.
Use prepared isolated checkout `/tmp/test-assurance-kernel-work` on `codex/test-assurance-kernel`,
base `9f22c9e6a760f5d9212355fd6324e20fd8edb7ca`; check state/live staging before integration.
Do not alter original checkout `/Users/art/.codex/worktrees/243f/rules-as-tests-aif` or other WIP.
Commit/push reviewed spec/kickoffs via normal hooks and PR to staging; required checks and cold
review precede squash merge. Confirm origin/staging contains actual regular-file inputs before
AIF launch. Preparation/integration in this local GLM session may precede that merge.
If AIF is unavailable, GLM may execute locally in Claude Code after independent duplicate-work
checks; AIF preference never authorizes bypassing its PROBE-INCOMPLETE gate or model substitution.
Max 2 PARTIAL redispatches, 2 clarification cycles; max 5 implementation/verification iterations
per exact-file atomic mechanism batch. Split new in-scope batches rather than silently broadening.
No infrastructure/provider/settings mutation to force launch. Follow doctor mutation tiers;
standing/destructive/spending changes require separate exact authorization. Record failure honestly.
</constraints>
<tools>
Claude Code Read, Glob, Grep, Edit, Write, Bash; git, gh, node, npm; installed Vitest/ESLint,
existing shell tests/mutation/guard-liveness and runtime-bridge CLI through current dispatcher.
Agent for independent review only when actually available with model receipts. Read current
CLI help before use. No assumptions that host-only audit paths are mounted in containers.
</tools>
<output>
Use REPORT per `.agents/roles/orchestrator-worker-discipline.md`; Status DONE|BLOCKED|PARTIAL.
Maintain tracked portable evidence under `docs/test-assurance-kernel/`, exact code/evidence SHAs,
PR/check links, runtime receipts and unresolved disposition queue. At start emit the session
identity/requested model and first real read/command receipt; then continue autonomous execution.
</output>
<verify>
Each accepted stage discharges its contract plus the complete specification; final acceptance
is conjunctive spec §10, independently replayed. No worker report alone establishes acceptance.
</verify>

## Sequential frontier

| Stage | Input | Exit |
|---|---|---|
| S0 | `kickoff-s0.md` | Cheap raw discovery, frozen baseline, focused kernel characterization |
| S1 | `kickoff-s1.md` | Q1–Q6 bad/good controls, K1–K7, detector/invocation disable controls |
| S2 | `kickoff-s2.md` | Complete population/candidate dispositions, every seed replay, all confirmed gaps repaired |
| S3 | `kickoff-s3.md` | Campaign and S2→S3 timings; preservation and numeric performance targets |
| S4 | `kickoff-s4.md` | Independent spec and quality acceptance, actual delivery and Mac verification |

S0/S1/S2 are not interchangeable. Raw S0 census is not deep investigation; S1 cannot be a
policy/report-only deliverable. Full Q1–Q6 good companions and anti-detector tests gate S2.
K1 valid, K2 violation, K3 checker regression, K4 over-rejection, K5 delivery, K6 discovery,
K7 honest evidence apply at spec granularity. For a principle that IS the carrier, the frozen
outer driver and reviewed independent expectations are the trusted boundary, not an infinite ladder.
Deep kernel verification is exhaustive across delivery families. Outside it investigate every
candidate; untouched tests remain explicitly uncertified. Never turn counts into certification.
No population narrowing, assertion fabrication, arbitrary universal semantic claim, or report-only
substitute for repairs. Complete A01–A12 register in spec §7 is mandatory but not the stopping rule.

## Placement and launch gates

Read current orchestrator, dispatcher invocation/execution/harvest and GLM handoff procedures.
Before AIF claim/launch run `SLUG=test-assurance-kernel bash
.claude/skills/dispatcher/helpers/probe-inflight.sh`; repeat immediately after cold review
and just before outward action. PROBE-INCOMPLETE stops AIF launch, never means FRESH.
Resolve a live existing session/task before retrying; dispatcher exit zero can be manual fallback.
GLM local continuation requires checking Claude session/process identity and absence of duplicate
campaign work; an unreachable factory is recorded as unresolved evidence, not declared empty.
S0–S4 executors may not independently create competing campaign sessions.

Host observations 2026-10-08 (bounded historical data; GLM re-probes): AIF configured endpoint
`http://localhost:3009`, project `441c1c0c-b633-4612-a34c-2cc0c4d0eaf2`; passive health failed.
Resolver reported current Docker context unreachable, default/pc errors; pc points at ssh://pc,
bounded SSH closed at 100.91.23.29:22; direct health empty reply. No AIF task was created by
the design author. Do not solve these from remembered facts or copy credentials into artifacts.
This author ran the six-signal guard: PROBE-INCOMPLETE (projects-api-unreachable), with one
local authoring branch and no observed PR; factory absence is INCONCLUSIVE, not certified.

## Performance and evidence

Freeze pre-repair baseline; compare final repaired SHA with identical workload/host/toolchain,
three trials each, separate cold/warm and CI queue/execution, at most two extra noise trials.
Four workloads: documentation-only, representative rule, kernel/shared config, broad/unknown.
>=20% dominant ordinary local gate median improvement; others <=max(5%,1 second) regression;
no more expensive CI critical-path full-suite invocations, no unconditional expensive unrelated
PR suite, and complete obligation preservation. Also report S2→S3 separately. Unsafe/unmet = PARTIAL.
Counterfactual records carry obligation/source/carrier/edge/fixture/test/fault hashes, independent
reachability, intended failed assertion, baseline/mutant/restoration exits, runtime, classification.
Equivalent/unreachable/out-of-contract/infrastructure-failure cannot inflate killed scores.

## Host verification

Executed against final code on this Mac; Linux results alone cannot certify Mac hooks/install
or developer latency. Missing adapter or evidence is failure. The S1 adapter is a thin replay
entrypoint over existing tools, with frozen independently reviewed oracles and no fake success.
S3 supplies S4 validation support; independent reviewers run it and inspect actual contracts.

```bash host-verify
test "$(uname -s)" = Darwin
node scripts/test-assurance/verify.mjs --stage S1 --require-host darwin
node scripts/test-assurance/verify.mjs --stage S2 --require-host darwin
node scripts/test-assurance/verify.mjs --stage S3 --require-host darwin
node scripts/test-assurance/verify.mjs --stage S4 --require-host darwin
bash scripts/run-local-ci-sweep.sh
make self-audit
```

## Memory constraints and review provenance

MEMORY-SWEEP: 14 matches for: test-assurance|tautology|GLM in /Users/art/.claude/projects/-Users-art-code-rules-as-tests-aif/memory
Bindings: implementation tier stays GLM; author owns cold QA; probe immediately before outward
acts; use current harvest transport without API bypass; specified rework stays in its session;
read CLI docs before trial-and-error; evidence is verified against actual current source.
Do not rely on inherited memory or the old audit path as execution input. Review receipt will
be recorded separately after independent cold review; no GO is asserted by this draft.

## Shared execution contract

Read the complete specification `docs/superpowers/specs/2026-10-08-test-assurance-kernel-design.md`
and umbrella `kickoff.md` before acting. The specification controls every omission here.
Read AGENTS.md, README goal, `.agents/session-bootstrap.md`, CLAUDE.md and applicable
canonical `.agents/rules/` and `.agents/procedures/` on the execution base. Compatibility
`.claude` paths can be links; inspect the canonical source and actual delivered artifact.
Rigor label (L0): `research-grade`. Executor: GLM-5.3 through Claude Code; no model substitution.

## AI traps

See `.agents/rules/ai-laziness-traps.md` §2–§3. Active traps: **T3** (raw evidence),
**T7** (run an adversarial category counter-prompt), **T10** (denominator first),
**T14** (honest uncertified scope), **T15** (test the metacheck itself), **T19**
(independent review), **T20** (evidence before verdict), **T22** (reached production fault,
frozen outer oracle). **T-TAK-A**: green exit from an empty selector or infrastructure
error is not detection. **T-TAK-B**: a comment/self-source token is not delivered behavior.
No edits outside the stage's write scope; additional scope requires a reviewed atomic
sub-kickoff before editing. Preserve unrelated work and frozen/historical artifacts.
No `.claude/settings.json`, standing provider/profile changes, permission bypass flags,
hook bypass, force push, new platform, universal semantic analyzer, or paid LLM in CI.

### §1.7 Forward-check applied

Specification sections 4–6 preserve independent oracles and delivery evidence;
`packages/core/principles/kickoff-population.ts:34` supplies stage naming, and
`.agents/rules/kickoff-staging-placement.md:40` requires placement before AIF execution.
This prompt declares verification obligations, not completed runtime acceptance.

### §1.7 Backward-check applied

Class = assurance claims over tests and delivery families. Specification section 3
requires a complete Git/runner inventory and per-candidate disposition; the seed population
at `docs/superpowers/specs/2026-10-08-test-assurance-kernel-design.md:124` is a starting
register, never the denominator. S2's independent class sweep must reconcile every surface.
