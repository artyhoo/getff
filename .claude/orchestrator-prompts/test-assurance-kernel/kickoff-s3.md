# Test assurance kernel — S3

> **Authoritative for:** S3 atomic stage deliverable and execution boundaries.
> **NOT authoritative for:** project goal, dispatch mechanics, or campaign requirements; see README, dispatcher and specification.

<task>
Reduce the measured PR feedback cost as one reviewable stage package.
</task>
<context>
Data: authoritative specification `docs/superpowers/specs/2026-10-08-test-assurance-kernel-design.md`; predecessor accepted evidence under
`docs/test-assurance-kernel/`. Order is S0 → S1 → S2 → S3 → S4, with S1 metachecks first.
Prefer batching immutable reads and removing repeated startup/compilation. No unconditional
full mutation/new expensive suite on unrelated ordinary PRs. Preserve edit/precommit,
affected pre-push/PR and deep assurance lanes. If selection changes, test actual renamed/deleted
files and disconnected imports; shared helpers/config/package/lock/workflow/selector changes,
unknown paths and discovery failures expand conservatively. Related-test discovery alone cannot
cover shell, disk reads, generated assets or child processes. No cross-run cache without measured
necessity; if justified, bind all source/fixture/config/dependency/tool/environment inputs and
prove dependency-only/environment invalidation, missing keys fail closed.
Compare final repaired SHA to frozen campaign baseline with identical workload/host/toolchain.
Also compare S2→S3 separately. Three trials per four workloads, values/median, identical cache
and concurrency; at most two extra noise trials, no cherry-picking/redefined workload.
Require >=20% reduction of dominant ordinary-code gate median; other workloads no regression
above max(5%,1s); expensive full-suite invocations on CI critical path cannot increase.
Actual CI execution evidence required where available; local latency is not CI duration.
Add regression for correctness risk of each optimization. Preserve all K/Q/seed obligations.
Output s3 raw performance records, coverage mapping and replayable acceptance adapter extension.
Unsafe/unmet targets yield PARTIAL with bottleneck/lower bound; never weaken checks.
</context>
<constraints>
Write only `packages/core/hooks/**`, `packages/core/principles/**` (routing/cost contracts),
`.husky/**`, `.github/workflows/**`, `scripts/**`, `vitest.config.*`,
`packages/*/vitest.config.*`, `templates/**/vitest*`, and `docs/test-assurance-kernel/s3/**`.
Choose measured bottleneck first, then exact-file sequential sub-kickoffs. No dependencies,
cache platform or removal of required obligation without a tested equivalent replacement.
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
.claude/orchestrator-prompts/test-assurance-kernel/kickoff-s3.md`.
Every missing prerequisite fails. These commands are contracts to implement/replay, not claims
that the S1–S4 adapter already exists. Raw logs and intended diagnostics must be retained.

```bash host-verify
test "$(uname -s)" = Darwin
node scripts/test-assurance/verify.mjs --stage S2 --require-host darwin
node scripts/test-assurance/verify.mjs --stage S3 --require-host darwin
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
