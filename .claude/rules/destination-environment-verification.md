---
description: Destination-environment verification — a dispatched worker's environment is not where the work is accepted
paths:
  - ".claude/orchestrator-prompts/**"
---

# Destination-environment verification — discipline rule

<!-- globs: .claude/orchestrator-prompts/** -->
<!-- inject: A dispatched worker runs in the aif container; the work is accepted on the HOST. Declare the host commands in a fenced block whose info-string carries `host-verify`, or opt out with an explicit `host-verify: none` HTML comment carrying a rationale of at least 20 characters. Run them with `bash scripts/host-verify.sh <umbrella>` before accepting. A green suite in the container is not evidence about the host. And in the other direction (§1b): any claim that the destination CANNOT do something — «X is NOT available in the container», «that path does not exist there» — must quote the probe that established it (`docker exec`/`docker inspect`, run against the live destination) plus the date. A citation of a doc that describes the environment is not a probe of the environment. -->

> **Class:** B — the mechanism is (a) the edit-time gate `check-kickoff-traps.sh` arm 1 (asserts the contract EXISTS, paired-negative at [`packages/core/hooks/check-kickoff-traps.test.ts`](../../packages/core/hooks/check-kickoff-traps.test.ts)) plus (b) the runner [`scripts/host-verify.sh`](../../scripts/host-verify.sh), which turns "re-run it on the host" into a command with an exit code, plus — since the 2026-08-21 retrofit — (c) the population principle test [`packages/core/principles/43-kickoff-host-verify-presence.test.ts`](../../packages/core/principles/43-kickoff-host-verify-presence.test.ts) (CI: contract-or-opt-out over the whole *tracked* kickoff family, detected by shelling to the runner — no second grammar). Class A is **not yet reached**: nothing forces the runner to be *invoked* before acceptance — the orchestrator still chooses to run it; principle 43 checks PRESENCE, not execution. §5 names the promotion path and is honest that this half is unclosed. The **negative direction (§1b) is weaker still** — prose + the edit-time injection above, deliberately **not** a gate; §5 records the measurement that decided it.
> **Fires:** kickoff authoring; accepting container work; a cannot-reach claim.
> **Authoritative for:** the destination-environment verification discipline — §1 the positive contract and its grammar, §1b the negative direction (claims that the destination *cannot*), §2 the incident base, §3 why a green container run is not evidence, §4 anti-patterns, §5 promotion / retirement.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Gate-vs-injection channel choice — see [rule-enforcement-channel-selection.md](rule-enforcement-channel-selection.md). Why attention cannot be the detection layer — see [attention-is-not-a-mechanism.md](attention-is-not-a-mechanism.md). Where a kickoff must live before dispatch — see [kickoff-staging-placement.md](kickoff-staging-placement.md).

> **Origin:** 2026-07-24. Four incidents in one day, all one class, each caught by the operator or by an orchestrator's manual host re-run rather than by any gate. Recorded in [`research-patches/2026-07-24-autonomous-loop-diagnostics.md`](../../docs/meta-factory/research-patches/2026-07-24-autonomous-loop-diagnostics.md) as finding **F3 — container ≠ host, no channel forces the host re-run**.

## §1 The contract

A kickoff under `.claude/orchestrator-prompts/<umbrella>/kickoff.md` MUST declare the commands
whose result decides acceptance, **as they will be run on the host**, inside a fenced block whose
info-string carries the `host-verify` marker:

````text
```bash host-verify
npx vitest run packages/core/principles/11-build-first-reuse-default.test.ts
```
````

**The stage-kickoff family is a kickoff in this sense** — `kickoff-s1.md`, `kickoff-r2.md`, …
(the shared population in [`packages/core/principles/kickoff-population.ts`](../../packages/core/principles/kickoff-population.ts)
`STAGE_KICKOFF_RE`): the edit-time gate already matches them, and since the 2026-08-21
retrofit **principle 43** holds the whole *tracked* family to this contract at CI — every
tracked kickoff declares a contract or a valid opt-out, with the back-catalog retro-marked
(blanket legacy-closed opt-outs; individually adjudicated closures; real contracts or honest
per-class opt-outs for the open lane). Gitignored stage kickoffs (per-umbrella un-ignore
globs) are outside every git-carried channel and stay out of that population.

Every non-blank, non-comment line is one command; they run from the repo root in declaration
order. A kickoff with no executable deliverable opts out **explicitly**, never by silence:

```text
<!-- host-verify: none — prose-only kickoff, no executable deliverable -->
```

The rationale must be ≥20 characters and say *why* no host command applies (precedent:
[`ci-tool-pinning.md §3`](ci-tool-pinning.md) error-with-escape-token; same posture as the
`Prior-art: skipped — …` hatch in [CLAUDE.md](../../CLAUDE.md)).

**Running it:** `bash scripts/host-verify.sh <umbrella>` (or a kickoff path). Exit 0 = every
declared command passed on this host, OR a valid opt-out was found; 1 = one failed;
**2 = no contract found, a no-op-only contract, or a too-short opt-out**. A missing
contract is a FAIL, not a pass — fail-closed, because "nobody declared anything" is precisely
the state this rule exists to end.

**Grammar lives in one place.** Both contract extraction AND opt-out recognition live in
`host-verify.sh`. The edit-time gate does not re-implement either — it shells out to
`host-verify.sh --list` and surfaces the runner's stderr verbatim in its violation text, so the
gate and the runner cannot disagree about what counts as a contract or an opt-out
(`#sync-by-copy-paste`, [dual-implementation-discipline.md §8](dual-implementation-discipline.md)).
The runner's fence-aware, code-span-aware, locale-independent parser is the single implementation
for both recognition paths; the gate is a thin caller.

## §1b The negative direction — claims that the destination *cannot*

§1 gates one direction: *does this kickoff declare what must pass on the host*. The opposite
direction is un-gated and, measured over the same surface, is where the falsified claims actually
live: statements that the destination **cannot** do something — «X is **NOT available** in the
container», «that path **does not exist** in the aif container», «`audit-plan.md` is **NOT
reachable**». Each is a **negative-existence claim about live state**, and so already carries
project invariant #3 ([`phase-research-coverage.md §1`](phase-research-coverage.md), the 6-item
search check). §1b states what discharging it looks like *for an environment*.

**The obligation.** In a dispatch input, a claim that the destination lacks a capability, a path,
a tool, or a network route MUST carry, on the claim or in its block:

1. **the probe** — a command executed against the **live destination** (`docker exec <container> …`,
   `docker inspect <container> …`, a request from inside it), with enough of its output to be
   re-run and compared; and
2. **the date** it was run.

A claim that cannot be probed says so — `INCONCLUSIVE — could not probe <destination> (<why>)` —
which is a legitimate outcome. Silence is not.

**A primary-doc citation is not a probe.** This is the load-bearing half, and it is the one an
author will get wrong, because a doc citation *looks* like evidence and satisfies every
citation-shaped gate in this repo. Measured: the `meta-orchestrator-refactor` §4c row cited
`runtime-bridge-setup.md:40` for «Superpowers plugins NOT available» and was **false** — the doc
described how the runtime was assembled, and the mount set had moved since. Cite the doc for *why
it should be so*; cite the probe for *that it is so*. An existing kickoff already states the
counter in narrower form and has the emphasis exactly here — [`arch-v2-context-pipeline-s-e/kickoff.md:257`](../orchestrator-prompts/arch-v2-context-pipeline-s-e/kickoff.md)
T-SE-B, «container-unreachable claims carry a primary-doc citation or park» — §1b **corrects** it:
a primary-doc citation is the insufficient case, not the sufficient one.

**Not-in-the-repo ≠ not-reachable.** The commonest inference error in the incident base. A file
absent from the git clone can still be reachable through a bind mount, a named volume, or a
sibling checkout. `git check-ignore` answers a question about the *repository*; only a probe
answers the question about the *environment*.

**Every such claim carries a re-verification trigger.** The destination's mount set, installed
CLI, and network policy are operator-machine state that changes with no commit — so a claim
stamped «Verified <date>» and left alone keeps its authority indefinitely while the ground moves.
State the probe to re-run, so the next reader can spend one command instead of inheriting a
belief. Every falsified claim in §2b lacked exactly this.

**Channel (declared, per [rule-enforcement-channel-selection.md §1](rule-enforcement-channel-selection.md)).** Prose + the edit-time
injection this file already carries — **not** a gate. Whether a line is a claim, a conditional
fallback, a design statement, or an error-code enum is judgment; §5 records the measurement that
falsified the gate option, so the choice is evidence-backed rather than asserted.

## §2 The incident base (2026-07-24, four in one day)

| # | what the container reported | what the host reported | root cause |
|---|---|---|---|
| 1 | Job C — 5/5 PASS | 0/5 | no `docker` in the container, so the fixture's stub was the only one on `PATH` |
| 2 | Job F1 — 9/9 PASS | 7/9 | `make_nojq_path()` built its shadow `PATH` from jq's own directory — true where `/bin` symlinks to `usr/bin`, false on macOS where `cat` is in `/bin` |
| 3 | three PostToolUse gates "fire" | all three inert (one silently) | the TypeScript runner was resolved from one repo-local path; a linked worktree carries no `node_modules` |
| 4 | F6 — principle-11 F1 ≈ 5.0 s against a freshly lowered 15 s budget | 18061 / 17615 / 17662 ms → **fails 3/3** | the container is ~3× faster at git subprocess spawn + history walk; the budget was sized to it |

Incident 4 is the one that motivated the contract: the worker's own acceptance criterion
("suite green") was **satisfied where it ran** and false where the gate actually executes. No
amount of worker diligence closes that — the worker cannot observe the host.

## §2b The negative-direction incident base (six, across four umbrellas)

Every row is a claim that the destination *cannot*, asserted in a dispatch input and later
falsified by a probe. Rows 1-2 were caught independently, months apart, by the umbrellas that
owned them; rows 3-6 by the cold backward sweep of 2026-08-09 (PR #1345).

| # | claim, as written | what a probe returned | what the claim rested on |
|---|---|---|---|
| 1 | «container lacks ast-grep (no network)» | `npm view @ast-grep/cli` → `0.44.0`; `curl registry.npmjs.org` → `200` — [`generator-require-composite-tier-meta-launch/state.md:72`](../orchestrator-prompts/generator-require-composite-tier-meta-launch/state.md) records it as **FALSE** and the excuse as confabulated | a worker's unprobed assertion |
| 2 | «container lacks `~/.claude/projects`, `/context`, live CC» | `find /home/node/.claude/projects -name '*.jsonl' \| wc -l` → **746** — [`arch-v2-context-pipeline/kickoff.md:108`](../orchestrator-prompts/arch-v2-context-pipeline/kickoff.md) FORK C, «false as written», corrected rather than re-pinned | conflating an absent **population** with an absent **surface** |
| 3 | «Superpowers plugins NOT available — only the repo clone is bind-mounted» | `docker inspect` → 8 mounts, **two** for plugins (one mirroring the host-absolute path so `installPath` resolves verbatim); superpowers 6.2.0, 14 `SKILL.md` inside | a **primary-doc citation** (`runtime-bridge-setup.md:40`) standing in for a probe |
| 4 | «`audit-plan.md` NOT reachable — gitignored, not in the clone» | `docker exec … ls /home/node/.claude-coordination/…` lists it (33372 B); CANON is a bind mount | not-in-the-repo inferred to mean not-reachable |
| 5 | «that path does not exist in the aif container» | `ls -d /home/node/.claude/projects/*rules-as-tests-aif*` → **102** dirs, 934 `.jsonl` | same surface-vs-population conflation as row 2, in a second umbrella |
| 6 | «`claude-code-guide` NOT available (operator-verified precedent)» | the agent definition is compiled into the container's own CLI (`source:"built-in"`, `model:"haiku"`, v2.1.218) | an **appeal to precedent** — evidence of the form «someone verified this once» |

Rows 3 and 4 sat in a table stamped «Verified 2026-06-03» and were **load-bearing**: they steered
the umbrella away from the aif runtime and prescribed a workaround — temporarily committing a
gitignored dispatch input — that the measured mount made unnecessary. Nothing in the frozen stamp
told a reader the ground could move; §1b's re-verification trigger exists for exactly that.

Note what the six have in common and what they do not. They are not carelessness about *whether*
to cite: rows 3 and 6 both cite something. They are carelessness about *what a citation can
establish* — a doc, a precedent, or a repository fact standing in for a probe of live state.

## §3 Why a green container run is not evidence

The claim a container run supports is «this passed in the container». The claim acceptance needs
is «this passes where it will run». Those differ whenever the destination differs in a way the
work touches — a binary's presence, a path layout, an OS's process-spawn cost, a linked worktree's
missing `node_modules`.

«The orchestrator will remember to re-run it on the host» is bare attention, which
[`attention-is-not-a-mechanism.md §1`](attention-is-not-a-mechanism.md) rejects as a detection
layer: it failed three times on 2026-07-24 and was caught by the operator every time. This rule
does not ask for more diligence; it moves the check into an artefact (the declared contract) and
a command (the runner).

**Honest scope of what is closed.** The contract's *existence* is gated (edit-time, paired-negative
tested). Its *execution* is a command the orchestrator runs, not yet a gate — see §5.

## §4 Anti-patterns

- **`#container-green-as-acceptance`** — accepting work because the suite passed where the worker
  ran it. Counter: §1 contract + `host-verify.sh`; quote the host output, not the worker's.
- **`#budget-sized-to-the-wrong-machine`** — tightening a timeout, a size limit, or any resource
  budget using a measurement from the execution environment rather than the destination. Incident 4.
  Counter: every timing claim names the machine it was measured on; budgets are sized to the
  destination and the comment says so.
- **`#silent-contract-skip`** — a missing contract treated as "nothing to verify". Counter: the
  runner exits **2** on a missing block and the gate rejects the kickoff; silence is never a pass.
- **`#optout-as-reflex`** — reaching for `host-verify: none` because it is the shortest path past
  the gate. The ≥20-char rationale is a floor, not a proof; a kickoff with an executable deliverable
  and an opt-out is a review-time reject. Counter: review-time judgment — the gate cannot decide
  whether a deliverable is executable, and pretending it can would be `#gate-where-judgment-needed`.
- **`#contract-that-cannot-fail`** — a contract that runs, reports PASS, and asserts nothing about
  the stage's deliverable. Unlike `#silent-contract-skip` nothing is missing and nothing is skipped:
  the block is present, the commands execute, the exit code is 0 — the contract simply does not gate
  the defect class it exists for. Incident: `getff-freshness-widening-s1` (merged PR #1333) permitted
  `packages/core/synthesizer/**` and made a synthesis-time stamp its criterion 3, while all four
  declared commands returned **4/4 PASS** on a branch where `packages/core/synthesizer/generate.ts`
  never stamped `tier` — a MAJOR found by cold audit, not by the contract.
  Counter: the K6 contract-coverage emission ([`scripts/host-verify-coverage.sh`](../../scripts/host-verify-coverage.sh),
  wired at [`agents/dispatch-input-checker.md`](../../agents/dispatch-input-checker.md) K6) plus the
  adjudicating seat — **never a gate**: three deterministic variants were built and replayed against
  this incident, and each failed on recall or on noise
  ([research-patch §3](../../docs/meta-factory/research-patches/2026-08-09-contract-deliverable-coverage.md)).
  The root falsifier is that the defect is an *omission* at file granularity — `generate.ts` was
  unchanged when the criterion required changing it — and no reachability- or diff-scoped check can
  see a file that should have been edited and was not.

- **`#destination-limit-by-inference`** (§1b, added 2026-08-09) — asserting that the destination
  *cannot* do something from how the environment is **assembled** (a compose file, a setup doc, a
  remembered precedent, a `.gitignore` entry) rather than from a probe of it **running**. The
  mirror of `#container-green-as-acceptance`: that one over-trusts a container *result*, this one
  over-trusts a container *assumption*, and this one is worse-behaved because the assumption
  survives review — it is stated in the confident register, often carries a citation, and no
  reader has a cheap way to notice it went stale. Falsifier, and the one to check first: does the
  cited evidence describe the environment (design doc, compose file, precedent, gitignore) or
  *interrogate* it (`docker exec`, `docker inspect`, a request from inside)? Six instances in
  §2b. Counter: §1b — probe + date, or an explicit `INCONCLUSIVE — could not probe`.

## §5 Promotion / retirement

- **Promotion to Class A** requires closing the execution half: a deterministic gate that refuses
  to accept container-produced work whose declared contract has not passed **on this host**. The
  reachable channel is host-side `pre-push` — the harvest push is the moment the container→host
  boundary is crossed, and [`packages/core/hooks/pre-push.ts`](../../packages/core/hooks/pre-push.ts)
  already hosts sibling sections (e.g. `check-kickoff-portability.sh`, wired at section 3e).
  **Deliberately not built in the origin PR:** mapping a branch to its umbrella is guesswork
  (aif names branches `feature/<umbrella>-<taskid>`, but harvested branches are renamed), and a
  gate that mis-identifies the umbrella would either run the wrong contract or block a correct
  push. Shipping the honest half now beats shipping a mis-firing gate. Trigger: the first incident
  where a declared contract existed and was simply not run. **Verified STALE-absent at
  origin/staging `fab189d09e`:** `git show origin/staging:packages/core/hooks/pre-push.ts |
  grep -niE 'umbrella|destination-contract'` returns only two hits (`:664`, `:749`), both
  comments about the S3 push-channel umbrella DoS concern — **no branch→umbrella gate function
  exists**. The trigger («first incident where a declared contract existed and was simply not
  run») has not fired.
- **Strengthening trigger:** a fifth incident of the §2 class *after* this rule ships means the
  contract is being declared but not exercised → promote, do not re-word.
- **`#contract-that-cannot-fail` re-gate trigger (§4, added 2026-08-09).** The «emission, not gate»
  verdict is evidence-backed, not permanent. Re-open the deterministic branch on a second incident
  of the class in which the uncovered area is named by **no** declared command *and* the deliverable
  is a file the stage does change — at that point the omission falsifier no longer covers the
  population, and the syntactic variant becomes worth re-measuring. The acceptance leg is the
  **incident replay**, never the flag count (the bar the sibling patch set and this one reused).
  Incident counter: **1** (`getff-freshness-widening-s1`, PR #1333).
- **Known population gap — the rule is narrower than the defect class it names.** The gate reaches
  **kickoffs only** (`.claude/orchestrator-prompts/*/kickoff.md`). A cold backward sweep of the
  `#budget-sized-to-the-wrong-machine` shape (§4) enumerated 62 hard-coded budgets repo-wide and
  found **16** stating a measurement with no environment named — none of them reachable by this
  gate or its runner: e.g. `.github/workflows/guard-liveness-fullsweep.yml:31` («measured
  **locally**», enforced on a GitHub runner), `packages/core/hooks/done-md-completion-filter.test.ts:64`
  («observed 14-51s» justifying a 30s budget — the evidence exceeds the budget it supports),
  `.husky/pre-push:25` and its shipped consumer twin `packages/core/templates/shared/husky-pre-push.sh:34`
  («~130ms/push», no machine). Closing that population is a **separate** change, deliberately not
  bundled here (one concern per PR); the shape to enforce is already demonstrated by the reference
  instance at `packages/core/principles/11-build-first-reuse-default.test.ts:413-421`, which names
  both environments, both numbers, the destination, the margin, and the falsifier.
- **§1b was measured against a gate, and the gate lost — this is why it is prose.** A candidate
  detector was built and replayed rather than reasoned about (the bar the `#contract-that-cannot-fail`
  entry above set, reused here). Spec: a line naming the destination, carrying an indicative
  negation of availability, not conditional, not already adjudicated, and not probe-backed.
  Corpus: the six §2b claims in their pre-correction wording as positives; 15 curated
  conditional/defensive/probed lines as negatives; and the full live stratum —
  every line under `.claude/orchestrator-prompts/**` naming the destination **and** negating
  availability (115 lines, from a 3031-line destination-naming population). Result:
  **recall 4/6** (the two misses are structural, not tunable — one claim names the destination
  only in a table column header two rows up, and no line-local matcher can see it), **0/15**
  on the curated negatives, and **54/115 fired in the wild** against ~6 known defects — a
  precision near **11%**. The noise is not a tuning artefact but a category mix: error-code enum
  values (`'unavailable'|'quota_exceeded'`), *counter-measures* against this very trap, already-corrected
  records, deliberate graceful-degradation design («handles unreachable → falls back»), and claims
  about a **repo** rather than the container. Flagging half a surface to catch two-thirds of six
  defects is `#gate-where-judgment-needed`
  ([rule-enforcement-channel-selection.md §5](rule-enforcement-channel-selection.md)); prose plus the
  edit-time injection is the honest channel.
- **§1b re-gate trigger.** Re-open the deterministic branch when the *claim form* becomes
  regular enough to be seen: three or more §2b-class incidents in which the claim is stated in a
  **structured** slot a parser can address — a table cell under a named destination column, or a
  declared field — rather than free prose. At that point the matcher's addressable unit changes
  and the recall ceiling above no longer applies. The acceptance leg is the **incident replay**
  against the §2b corpus, never the flag count. Incident counter: **6** claims, **0** of them in a
  structured slot.
- **Retirement:** 12 consecutive months with zero §2-class incidents AND no dispatched-worker
  runtime in use → archive to prose in [CLAUDE.md](../../CLAUDE.md). Peer criteria:
  [reviewer-discipline.md §4](reviewer-discipline.md).

## §6 §1.7 self-reflexive note

**Forward-check.** Complies with [rule-enforcement-channel-selection.md §1/§3](rule-enforcement-channel-selection.md):
"does this kickoff declare a contract" is mechanically detectable → **gate**, placed at the earliest
reachable channel (edit-time PostToolUse; a kickoff is authored and dispatched before any
pre-push or CI channel touches it — the same argument `check-kickoff-traps.sh` already makes in
its header). "Is this the *right* contract" is judgment → left to review, never gated
(`#gate-where-judgment-needed`). Complies with [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md):
runner and gate are deterministic bash + awk, zero API calls. Complies with
[doc-authority-hierarchy.md §2-§3](doc-authority-hierarchy.md) (Class + Authoritative-for header)
and principle 31 (channel declared via `paths:` frontmatter + the identical `<!-- globs: -->`
marker). Complies with [attention-is-not-a-mechanism.md §1](attention-is-not-a-mechanism.md) for
the half it closes, and §3 states plainly which half it does not. Complies with
[build-first-reuse-default.md §1/§3](build-first-reuse-default.md) — verdict **ADAPT**, recorded
as SSOT #229; the 6-item consult ran WebSearch ×3 + DeepWiki, not memory: **Runme**
(`runmedev/runme`) executes fenced blocks from markdown but targets human DevOps runbooks and
ships a Go binary, which the shipped-axis AI-/OS-agnostic default rejects as a hard dependency;
**agent-spec** (`ZhangHanDong/agent-spec`) lints a task contract — DeepWiki-verified (T16,
problem-class not name) that its verification runs *in the same environment as the agent* and it
carries **no notion of environment parity**, so our slice is unserved; **SpecKit CI Guard**
REFERENCE (spec-exists gating); **ByteDance Dockerless** / **Signadot** REFERENCE — they name this
exact problem class ("the first time code runs in a completely independent environment") and solve
it in the opposite direction (avoid the environment rather than assert the destination one).
Complies with [language-discipline.md §1](language-discipline.md) (machinery and rule body in
English). [ai-laziness-traps.md](ai-laziness-traps.md): **T2** — the mechanism was *run*, not
designed: `host-verify.sh` was fired against incident 4's actual commit (EXIT=1, work rejected) and
against the same commit with the defect repaired (EXIT=0), so the gate is shown to discriminate
rather than merely to refuse; **T3** — every §2 row carries a measured number or a named cause;
**T15** — the rule self-applies, see below.

**Backward-check.** Class of this change = *edit-time gates over `.claude/orchestrator-prompts/**`
kickoff content*. Enumerated: (a) [`check-kickoff-traps.sh`](../hooks/check-kickoff-traps.sh) —
**EXTENDED** in place rather than duplicated; its T-enumeration arm is untouched and still tested
(21/21 pass), and violations now accumulate across both arms instead of costing one round-trip per
rule. (b) [`packages/core/audit-self/check-kickoff-portability.sh`](../../packages/core/audit-self/check-kickoff-portability.sh)
(pre-push, wired at `pre-push.ts` section 3e) — **SWEPT-CLEAN**: it gates whether a kickoff is
git-tracked, a disjoint concern; no overlap, nothing superseded. (c)
[`packages/core/principles/12-ai-laziness-traps.test.ts`](../../packages/core/principles/12-ai-laziness-traps.test.ts)
— **SWEPT-CLEAN**: checks §3 citation presence on kickoffs; untouched, and the new arm adds no
citation obligation. (d) [`kickoff-staging-placement.md`](kickoff-staging-placement.md) — **SWEPT-CLEAN**:
same path scope, orthogonal concern (merge timing, not content); its `paths:` glob is reused
verbatim here so the two rules load together on the same surface. (e) `check-worker-dispatch-channel.sh`
— **SWEPT-CLEAN**: gates the dispatch channel, not kickoff content. No sibling gate is weakened,
and no rule previously claimed authority over destination-environment verification (grep for
`host verif|destination environment|container ≠ host` over `.claude/rules/**` returned nothing
before this file).

**Self-application (T15).** The rule's own deliverable is executable, and it was accepted only
after `npx vitest run packages/core/hooks/check-kickoff-traps.test.ts` ran **on the host**
(27/27) — not in a container, and not inferred from a green CI. The contract mechanism itself
was dogfooded against §2 incident 4 before being believed: `host-verify.sh` was fired at that
incident's actual defective commit (EXIT=1, work rejected) and at the same commit repaired
(EXIT=0, work accepted), so the gate is shown to **discriminate**, not merely to refuse.

**§1b addendum (2026-08-09).** *Forward:* channel chosen on the detectability axis with a
measurement, not an assertion — §5 records recall 4/6 and 54/115 wild firings, so «judgment →
injection» ([rule-enforcement-channel-selection.md §1](rule-enforcement-channel-selection.md)) is
evidence-backed here; deterministic bash/grep only, zero API calls
([no-paid-llm-in-ci.md](no-paid-llm-in-ci.md)); `paths:` and `<!-- globs: -->` unchanged and still
identical (principle 31); no new `.md` file, so no new doc-authority surface
([doc-authority-hierarchy.md §2](doc-authority-hierarchy.md)). BFR: **no new capability** — the
delivery reuses this file's existing injection marker and adds no module, no dependency, and no
gate; SSOT [#229](../../docs/meta-factory/prior-art-evaluations.md) is this contract's own entry
and its scope widens rather than forks. Own-stack-first ran and **found an own-stack analog** —
T-SE-B at [`arch-v2-context-pipeline-s-e/kickoff.md:257`](../orchestrator-prompts/arch-v2-context-pipeline-s-e/kickoff.md) — which §1b
promotes and corrects rather than reinvents (`#own-stack-blind-spot` avoided by looking, not by
claiming to have looked).

*Backward:* class = *negative-existence claims about live destination state stated in a dispatch
input*. Enumerated: (a) `.claude/orchestrator-prompts/**` — **GAP-FOUND ×6**, all in §2b, four
corrected in PR #1345 and two already corrected in-place by their own umbrellas; (b) the three
ad-hoc domain T-traps of this shape — T-SE-B (`…-s-e/kickoff.md:257`), `T-AIP-B` registered-in-repo
≠ wired-in-container ([`multi-model-pipeline-pilot/kickoff.md:123`](../orchestrator-prompts/multi-model-pipeline-pilot/kickoff.md)),
`T-SH-A` pricing-by-assumption ([`arch-v2-context-pipeline-s-h/kickoff.md:178`](../orchestrator-prompts/arch-v2-context-pipeline-s-h/kickoff.md))
— **GAP-FOUND, deliberately not closed here:** they meet [`ai-laziness-traps.md §5`](ai-laziness-traps.md)'s
«2+ wave-specific T-additions of one failure mode → abstract into §2», but that catalogue is a
different rule with a coupled anti-drift gate (principle 35 quotes the digest verbatim), so
promoting them is a separate change with a separate owner; (c)
[`phase-research-coverage.md §1`](phase-research-coverage.md) — **SWEPT-CLEAN**: it already owns
negative-existence claims generally; §1b is the environment-specific instantiation and points
upward rather than restating the 6-item check; (d)
[`attention-is-not-a-mechanism.md §1`](attention-is-not-a-mechanism.md) — **SWEPT-CLEAN**, and it
is the reason §5's measurement had to be taken: a frozen «Verified» stamp is `#hope-as-gate`, and
§1b answers it with a stated re-verification probe rather than with more diligence; (e)
[`kickoff-staging-placement.md`](kickoff-staging-placement.md) — **SWEPT-CLEAN**: same path scope,
orthogonal concern (merge timing), nothing superseded.

*Honest limit, stated rather than papered over:* the origin umbrella's own kickoff predates
this rule and carries no contract, so the rule did not gate the PR that introduced it. Arm 1 is
forward-going — it fires on the next edit of any kickoff. An earlier draft of this section
claimed the origin kickoff carried a contract; a cold review ran the runner against it, got
exit 2, and the claim was false. That is exactly the `#discipline-theatre` this section warns
about, caught by a reviewer who had not written the rule.

## See also

- [`scripts/host-verify.sh`](../../scripts/host-verify.sh) — the runner (contract grammar SSOT).
- [`.claude/hooks/check-kickoff-traps.sh`](../hooks/check-kickoff-traps.sh) — the edit-time gate (arm 1).
- [`packages/core/hooks/check-kickoff-traps.test.ts`](../../packages/core/hooks/check-kickoff-traps.test.ts) — paired-negative contract for both arms.
- [`research-patches/2026-07-24-autonomous-loop-diagnostics.md`](../../docs/meta-factory/research-patches/2026-07-24-autonomous-loop-diagnostics.md) — finding F3, the incident base.
- [`attention-is-not-a-mechanism.md`](attention-is-not-a-mechanism.md) — why "the orchestrator will remember" is not a detection layer.
- [`docs/meta-factory/prior-art-evaluations.md`](../../docs/meta-factory/prior-art-evaluations.md) #229 — the ADAPT verdict and its evidence.
