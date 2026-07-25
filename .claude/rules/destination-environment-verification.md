---
description: Destination-environment verification — a dispatched worker's environment is not where the work is accepted
paths:
  - ".claude/orchestrator-prompts/**"
---

# Destination-environment verification — discipline rule

<!-- globs: .claude/orchestrator-prompts/** -->
<!-- inject: A dispatched worker runs in the aif container; the work is accepted on the HOST. Declare the host commands in a fenced block whose info-string carries `host-verify`, or opt out with an explicit `host-verify: none` HTML comment carrying a rationale of at least 20 characters. Run them with `bash scripts/host-verify.sh <umbrella>` before accepting. A green suite in the container is not evidence about the host. -->

> **Class:** B — the mechanism is (a) the edit-time gate `check-kickoff-traps.sh` arm 1 (asserts the contract EXISTS, paired-negative at [`packages/core/hooks/check-kickoff-traps.test.ts`](../../packages/core/hooks/check-kickoff-traps.test.ts)) plus (b) the runner [`scripts/host-verify.sh`](../../scripts/host-verify.sh), which turns "re-run it on the host" into a command with an exit code. Class A is **not yet reached**: nothing forces the runner to be *invoked* before acceptance — the orchestrator still chooses to run it. §5 names the promotion path and is honest that this half is unclosed.
> **Fires:** kickoff authoring; accepting container work.
> **Authoritative for:** the destination-environment verification discipline — §1 the contract and its grammar, §2 the incident base, §3 why a green container run is not evidence, §4 anti-patterns, §5 promotion / retirement.
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
