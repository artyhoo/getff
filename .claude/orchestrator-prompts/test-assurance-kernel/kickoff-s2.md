# Test assurance kernel — S2

> **Authoritative for:** S2 atomic stage deliverable and execution boundaries.
> **NOT authoritative for:** project goal, dispatch mechanics, or campaign requirements; see README, dispatcher and specification.

<task>
Reconcile the complete governed population as one reviewable stage package.
</task>
<context>
Data: authoritative specification `docs/superpowers/specs/2026-10-08-test-assurance-kernel-design.md`; predecessor accepted evidence under
`docs/test-assurance-kernel/`. Order is S0 → S1 → S2 → S3 → S4, with S1 metachecks first.
Use accepted S1 metachecks to classify the entire Git/runner population and every scan
candidate. Reconcile renames/deletions/new tests with frozen raw denominator; distinguish
intentional fixture from runnable test. Link each obligation to owning prose, invoked carrier,
actual artifact, suite, scope, channel and cost lane. Use all spec §3 statuses and retain
untouched suites as not behaviorally certified. Replay every A01–A12 on the current base,
including already-fixed/rejected findings, with evidence; all scanner hits are candidates,
not assumed bugs. Repair all demonstrated in-scope gaps in sequential mechanism batches:
first meaningful RED with frozen independent oracle, then carrier/test repair, then prove
former fault detected and legitimate alternatives pass. Observe actual emitted disk ESLint,
installed hook/config, process exit and filesystem boundary; verify shipped twins separately.
Full kernel/family sensitivity is exhaustive; outside it inspect every candidate and use
contract/risk probes. Cold class-only backward sweep enumerates siblings independently of
the diff and reconciles with inventory. An unresolved confirmed gap blocks DONE.
Output `s2/obligations.json`, `s2/population.json`, `s2/dispositions.json`, all seed/fault
records and normal-check receipts. Extend the acceptance adapter to re-run exact changed
public contracts, population reconciliation, required seed disposition and S1 protections.
Pin S2 SHA and measure repair overhead independently before S3; preserve campaign baseline.
</context>
<constraints>
Write only production/test/consumer surfaces under `packages/**`, `templates/**`, `tests/**`,
`setup.d/**`, `scripts/**`, `.agents/roles/**`, `.agents/rules/**`, `.husky/**`,
`.github/workflows/**`, and `docs/test-assurance-kernel/s2/**`.
These are an umbrella ceiling, not a blanket worker grant. First cut sequential mechanism
sub-kickoffs with exact file allowlists, one repair deliverable each, reviewed before dispatch.
No edits to frozen S0 records/S1 expected outcomes to make a fault pass. Add new cases append-only.
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
.claude/orchestrator-prompts/test-assurance-kernel/kickoff-s2.md`.
Every missing prerequisite fails. These commands are contracts to implement/replay, not claims
that the S1–S4 adapter already exists. Raw logs and intended diagnostics must be retained.

```bash host-verify
test "$(uname -s)" = Darwin
node scripts/test-assurance/verify.mjs --stage S1 --require-host darwin
node scripts/test-assurance/verify.mjs --stage S2 --require-host darwin
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
