# Test assurance kernel — S0

> **Authoritative for:** S0 atomic stage deliverable and execution boundaries.
> **NOT authoritative for:** project goal, dispatch mechanics, or campaign requirements; see README, dispatcher and specification.

<task>
Freeze the preparation evidence package as one reviewable stage package.
</task>
<context>
Data: authoritative specification `docs/superpowers/specs/2026-10-08-test-assurance-kernel-design.md`; predecessor accepted evidence under
`docs/test-assurance-kernel/`. Order is S0 → S1 → S2 → S3 → S4, with S1 metachecks first.
Produce complete raw tracked-test and declared-entrypoint discovery with pinned counts,
runner-discovery results and explicit discovery errors. Enumerate shell, generated,
fixture-like files, canonical naming and harness twins. Freeze baseline SHA, lock hash,
versions, environment, commands, exit codes, raw logs and workload definitions before repairs.
Measure pre-push sections/CI execution critical path, child processes and repetitions.
For doc-only, ordinary rule, kernel/shared-config and broad/unknown fallback workloads,
run three comparable local trials, recording values/median, cache/concurrency and cold setup
separately; CI queued time stays separate. Record which is the dominant ordinary-code gate.
Characterize only the Q1–Q6 kernel/corpus mechanisms and existing reuse homes; do not repair.
Output `s0/manifest.json`, `s0/population.json`, `s0/workloads.json`, `s0/kernel-baseline.md`
and referenced raw logs. Manifest schema: sourceSha (full baseline commit), lockfile (path),
lockSha256, toolVersions (nonempty object), environment (nonempty object). Population schema:
trackedFiles (exact sorted `git ls-files` population at sourceSha; evidence-only new files
remain outside that frozen denominator). Workloads schema: workloads array with exactly IDs
`docs`, `rule`, `kernel`, `fallback`; each row has argv (nonempty string array), timeoutMs
(positive <=3600000), trials (exactly three rows, each wallMs >0, exitCode=0, rawLog path,
sha256 of rawLog bytes). Retain input-change fixture/patch, environment/cache/concurrency
and invocation context in each row so these are actual distinct workloads, not four labels
for the same command. Host verification checks integrity and replays one invocation per
frozen workload on unchanged source; replay timing is not substituted into the comparison
trials. Focused Q1–Q6 characterization lives in nonempty kernel-baseline.md with raw receipts.
Missing measurement is BLOCKED, never a fabricated baseline.
</context>
<constraints>
Write only `docs/test-assurance-kernel/s0/**` (new portable evidence).
If workload setup needs a scratch checkout, argv must invoke the already available runner with its recorded scratch/input context; do not time a different workload.
No implementation changes, no broad manual candidate investigation; S0 is bounded preparation.
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
.claude/orchestrator-prompts/test-assurance-kernel/kickoff-s0.md`.
Every missing prerequisite fails. These commands are contracts to implement/replay, not claims
that the S1–S4 adapter already exists. Raw logs and intended diagnostics must be retained.

```bash host-verify
test "$(uname -s)" = Darwin
node -e 'const fs=require("node:fs"),cp=require("node:child_process"),assert=require("node:assert/strict"),crypto=require("node:crypto"),base="docs/test-assurance-kernel/s0/",read=n=>JSON.parse(fs.readFileSync(base+n+".json","utf8")),hash=p=>crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"),m=read("manifest"),pop=read("population"),w=read("workloads").workloads;assert.match(m.sourceSha,/^[a-f0-9]{40}$/);assert.equal(hash(m.lockfile),m.lockSha256);assert.ok(Object.keys(m.toolVersions).length&&Object.keys(m.environment).length);assert.ok(fs.readFileSync(base+"kernel-baseline.md","utf8").trim().length>100);const tracked=cp.execFileSync("git",["ls-tree","-r","--name-only",m.sourceSha],{encoding:"utf8"}).trim().split("\n").sort();assert.deepEqual([...pop.trackedFiles].sort(),tracked);cp.execFileSync("git",["diff","--exit-code",m.sourceSha,"--",".",":(exclude)docs/test-assurance-kernel/**",":(exclude).claude/orchestrator-prompts/test-assurance-kernel/**"]);assert.deepEqual(w.map(x=>x.id).sort(),["docs","fallback","kernel","rule"]);for(const x of w){assert.ok(x.argv.length&&x.argv.every(y=>typeof y==="string"));assert.ok(x.timeoutMs>0&&x.timeoutMs<=3600000);assert.equal(x.trials.length,3);for(const t of x.trials){assert.ok(t.wallMs>0);assert.equal(t.exitCode,0);assert.equal(hash(t.rawLog),t.sha256);}const z=cp.spawnSync(x.argv[0],x.argv.slice(1),{stdio:"inherit",input:"",timeout:x.timeoutMs});assert.ifError(z.error);assert.equal(z.status,0,x.id+" host replay");}console.log("S0 integrity and four actual workload replays passed");'
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
