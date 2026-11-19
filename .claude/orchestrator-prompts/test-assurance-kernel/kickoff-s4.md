# Test assurance kernel — S4

> **Authoritative for:** S4 atomic stage deliverable and execution boundaries.
> **NOT authoritative for:** project goal, dispatch mechanics, or campaign requirements; see README, dispatcher and specification.

<task>
Produce independent final acceptance as one reviewable stage package.
</task>
<context>
Data: authoritative specification `docs/superpowers/specs/2026-10-08-test-assurance-kernel-design.md`; predecessor accepted evidence under
`docs/test-assurance-kernel/`. Order is S0 → S1 → S2 → S3 → S4, with S1 metachecks first.
Use independent fresh spec-compliance and code-quality reviewers, not S0–S3 authors.
Replay actual acceptance on final pinned SHA on Linux where relevant and this Mac for
hook/install and developer latency. Inspect actual emitted/installed artifacts, raw logs,
reached faults/restoration, complete denominators/dispositions, all A01–A12 and Q1–Q6/K1–K7,
performance trials, required CI checks and exact model/session receipts. Worker DONE is
only a verification request. A green suite cannot override a reachable counterexample.
Require reproducible tracked portable inventories/matrices/dispositions and durable raw-log
hashes/retrieval paths, PR/check links, exact certified scope and unexamined semantic limits.
Run the umbrella host contract as well as stage contracts. Freeze evidence against final code
SHA; evidence-only commits may name that code SHA separately. Acceptance adapter S4 must
fail closed when required independent reviews/checks/performance evidence are missing.
DONE only when spec §10 conjunctive acceptance holds; otherwise explicit PARTIAL/BLOCKED,
unresolved IDs, owner and next action. No reviewer self-certification or fake passed receipt.
</context>
<constraints>
Read-only code. Write only `docs/test-assurance-kernel/s4/**` acceptance evidence.
Reviewers do not fix implementation; findings route to owner under bounded rework.
The acceptance adapter's S4 implementation belongs to S3, not this read-only stage.
Use sequential predicate/mechanism batches. Max 5 implement/verify iterations per atomic
batch; max 2 PARTIAL redispatches and 2 clarification cycles, then BLOCKED/PARTIAL.
Unknown tools/paths must be discovered, never invented. Normal Git hooks/checks remain active.
</constraints>
<tools>
Claude Code Read, Glob, Grep, Edit, Write, Bash; native git, gh, node, npm, local Vitest/ESLint,
existing shell test/guard-liveness/mutation tools. Agent only if available with verified model
for independent review; runtime-bridge dispatcher only after placement/in-flight gates.
No implicit tool grants; permissions and current installed interfaces control availability.
</tools>
<output>
REPORT Status: DONE|BLOCKED|PARTIAL, Deliverable, Evidence, BLOCKER, MINOR per
`.agents/roles/orchestrator-worker-discipline.md`. Include pinned SHA, exact paths/commands,
raw exit/diagnostic evidence and unresolved IDs. DONE requests independent verification.
</output>
<verify>
Predecessor accepted; all requirements above and specification sections for this stage hold.
Independent reviewer runs the following host contract and inspects its actual coverage.
</verify>

## Host verification

Run from the final stage checkout on this Mac using `bash scripts/host-verify.sh
.claude/orchestrator-prompts/test-assurance-kernel/kickoff-s4.md`.
Every missing prerequisite fails. These commands are contracts to implement/replay, not claims
that the S1–S4 adapter already exists. Raw logs and intended diagnostics must be retained.

```bash host-verify
test "$(uname -s)" = Darwin
node scripts/test-assurance/verify.mjs --stage S4 --require-host darwin
bash scripts/run-local-ci-sweep.sh
make self-audit
```

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
