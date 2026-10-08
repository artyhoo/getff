# Test assurance kernel — S1

> **Authoritative for:** S1 atomic stage deliverable and execution boundaries.
> **NOT authoritative for:** project goal, dispatch mechanics, or campaign requirements; see README, dispatcher and specification.

<task>
Deliver the executable test-quality assurance kernel as one reviewable stage package.
</task>
<context>
Data: authoritative specification `docs/superpowers/specs/2026-10-08-test-assurance-kernel-design.md`; predecessor accepted evidence under
`docs/test-assurance-kernel/`. Order is S0 → S1 → S2 → S3 → S4, with S1 metachecks first.
Extend the existing authoritative test-quality contract; reuse installed ESLint/Vitest
and guard-liveness/principle tooling (spec §6), consulting prior-art SSOT before a new capability.
Deliver Q1–Q6 bad-test rejections and corrected good companions through real supported channels.
Include constants, self-source, copied/recomputed predicate, ignored exit, wrong import,
disconnected emitted output plus legitimate structural/parity/helper/async cases.
Pin independent expected classifications; warnings with no blocking disposition consumer fail.
Static detectors claim only their decidable syntax. Q3 uses pinned reached non-equivalent
production faults and a frozen oracle, not guessed AST dataflow. Semantic remainder routes
to the existing named cold-review protocol and a blocking dispositions queue.
Establish K1–K7 per independent predicate and delivery family. A principle that IS the gate
needs a separate frozen outer conformance driver over compliant/violating scratch repos.
Weaken the actual gate while driver and governed corpus stay fixed; merely changing the
input establishes K2, not K3. Break each claimed detector AND its actual invocation and prove
corpus verification fails. Prove permissive, over-rejecting, boundary and delivery faults
were reached. Missing/empty selection, deleted/new paths, manifests, extensions and runner
failure must fail closed. Keep mutation in scratch checkout, patch/hash, intended assertion,
reachability, restoration and final passing baseline; infrastructure errors never count.
Provide a narrow reusable acceptance adapter `scripts/test-assurance/verify.mjs` over existing
tools, not a new test platform. Interface: `node scripts/test-assurance/verify.mjs --stage S1`
(and later S2/S3/S4), `--require-host darwin`. It must replay actual relevant public entrypoints,
positive/negative/counterfactual/delivery/discovery cases and exit nonzero on any missing evidence,
prerequisite, skipped required case, or unresolved obligation. Merely reading report JSON is
insufficient. Independently review/freeze driver expectations before acceptance.
Output s1 matrix, corpus register, counterfactual records, replay commands and cold review.
S1 exit requires working detections for all Q1–Q6 through their declared channels and positive
companions, anti-detector controls and honest limits; broad repair starts only after acceptance.
</context>
<constraints>
Write only `packages/core/principles/**`, `packages/core/hooks/checks/guard-liveness*`,
`packages/core/audit-self/**`, `packages/core/eslint-rules/**` (test-quality only),
`templates/**/eslint*`, `templates/**/vitest*`, `packages/preset-*/templates/eslint*`,
`packages/preset-*/templates/vitest*`, `eslint.config.*`, `.agents/roles/review-sidecar.md`,
`.agents/rules/**` (test-quality authority only), `scripts/test-assurance/**`,
`docs/test-assurance-kernel/s1/**`. No dependency or unrelated population repairs.
Before edits record exact file list per predicate sub-batch; read applicable nested instructions.
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
.claude/orchestrator-prompts/test-assurance-kernel/kickoff-s1.md`.
Every missing prerequisite fails. These commands are contracts to implement/replay, not claims
that the S1–S4 adapter already exists. Raw logs and intended diagnostics must be retained.

```bash host-verify
test "$(uname -s)" = Darwin
node scripts/test-assurance/verify.mjs --stage S1 --require-host darwin
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
