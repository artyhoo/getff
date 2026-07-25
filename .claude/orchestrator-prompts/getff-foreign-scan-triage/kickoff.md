<!-- scope: kickoff — getff-foreign-scan-triage micro-umbrella. Design base (BINDING): docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md §8 item 7 + §1 wall 7(g). Cold-reviewed GO r2 (/arch §2, 2026-07-23). Tier 2 (no bridge-profile marker — unknown root cause, CLAUDE.md tie-breaker): top tier plans, executor implements. Single-stage. -->

# getff-foreign-scan-triage — kickoff

> **Goal:** resolve the ONE investigate-class probe finding: a pre-push run on a real
> pnpm/Turborepo monorepo copy scanned `.claude/worktrees/**` and `.stryker-tmp/**`
> (280 nested-scan output lines — runtime/noise smell, potential correctness smell on any
> repo with active worktrees). The responsible walker is NOT yet located: grep of
> `packages/core/hooks/pre-push.ts` finds no walker (only `:1489`, an unrelated
> canonicalization comment). Outcome is BINARY and must carry evidence either way:
> (a) walker located in shipped code → fix with exclusion + paired fixture; or
> (b) proven probe-environment artifact (e.g. dirs brought over by the probe's rsync copy
> interacting with the consumer's OWN tooling, not getff code) → close with the reproduction
> evidence in a research-patch note. May NOT be closed silently (spec §8.7).

## §0 Dispatch gate + in-flight probe (BINDING)

- **Staging placement** first ([kickoff-staging-placement.md](../../rules/kickoff-staging-placement.md)).
- Pre-dispatch in-flight probe (CLAUDE.md operational conventions): no shared files with the
  sibling umbrellas are EXPECTED — re-check at dispatch anyway (if the walker turns out to
  live in `pre-push.ts`, coordinate with `getff-honest-signals` S1/S2 which edit that file).

## §1 Stage (single PR onto staging)

- **S1 — locate or close-with-evidence.** (1) Reproduce: fixture repo containing
  `.claude/worktrees/<x>/` and `.stryker-tmp/sandbox-1/` with nested file trees + a getff
  install; run the consumer pre-push (and any shipped glob-walking checks:
  rule-glob liveness, R2-boundary walker, mutation runner discovery) and capture which step
  emits nested-scan lines. (2a) If a shipped walker is responsible: add the exclusion
  (`.claude/worktrees/**`, `.stryker-tmp/**`, plus obvious siblings like `node_modules`
  already excluded) + paired fixture (fixture repo → zero scanned entries from foreign dirs;
  normal dirs still scanned). (2b) If not reproducible from shipped code: write the
  research-patch note (`docs/meta-factory/research-patches/`) with the reproduction attempt
  transcript and the actual culprit, and close. Umbrella `done.md` in the same PR.

## §1a Host-verify contract ([destination-environment-verification.md §1](../../rules/destination-environment-verification.md))

The worker runs in the aif container; acceptance happens on the HOST. These commands decide it:

```bash host-verify
npm --prefix packages/core run test:hooks
npm --prefix packages/core run test:principles
bash packages/core/audit-self/fixtures/foreign-scan-triage/repro.sh
```

Both hook/principle suites are branch-invariant: whichever branch fires, they must stay green
on the host. The third line is the paired-fixture command (branch (a)): a sandbox over-walk
sweep + a paired-negative existence-guard assertion. A fixture whose command is not declared
here is not covered by the gate, and a green container run is not evidence about the host.

Run before accepting: `bash scripts/host-verify.sh getff-foreign-scan-triage`.

## §2 «Works» (explicit + testable)

Either branch produces quoted evidence: (a) fixture output before/after the exclusion, or
(b) the reproduction transcript proving shipped code is clean. The PR body states which
branch fired.

## §3 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps
for this umbrella: T2, T3, T7, T14.**

- **T2** — designing the exclusion without RUNNING the reproduction is not an investigation.
- **T3** — the culprit claim needs command+output, not "probably the glob in X".
- **T14** — "could not reproduce quickly" ≠ "probe-environment artifact"; branch (b) requires
  the full reproduction attempt on the fixture repo, quoted.
- **T-FST-A (domain)** — closing as environment-artifact because the walker is hard to find:
  the close-branch (b) is only legal AFTER the fixture-repo reproduction ran the full shipped
  check-set and stayed clean — absence of evidence must be evidenced.

## §4c Autonomous aif-handoff dispatch — park-don't-guess contract (BINDING when dispatched via runtime-bridge)

> **When live:** any dispatch of this kickoff through
> `npx tsx packages/runtime-bridge/src/cli/dispatch.ts` instead of a maintainer-paste tab.
> Inert if a maintainer pastes the kickoff into a CC tab.

**Why (verified `coordinator.ts:398-476` + `reviewGate.ts`):** aif-handoff agents have no
mid-implementation «pause and ask» primitive. They implement — *guessing* on any ambiguity —
then auto-review post-hoc, and auto-close fires when the review finds no blocking findings,
which means «review found no blockers», NOT «a human is sure it is right». A genuine design
fork is not recognised as a question. Without the levers below, aif decides forks wrong,
silently — the exact failure mode this investigate-class umbrella exists to prevent.

**Lever 1 — conservative aif config (host env, set BEFORE dispatch):**

```bash
export AGENT_MAX_REVIEW_ITERATIONS=1        # not converged in 1 pass → hand to human
export AGENT_AUTO_REVIEW_STRATEGY=closure_first
export AGENT_SKIP_REVIEW=false
```

**Lever 2 — fork discipline (addressed to the aif agent, non-negotiable):**

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity — two
> defensible implementations, an undecided design choice, or a missing spec detail that
> changes behaviour — **do NOT pick.** Park it as a question (set the task to
> `manualReviewRequired` / `blocked_external`, stating the fork as «Option A → consequence X /
> Option B → consequence Y») and **stop that task.** Proceed only on the unambiguous parts.
> Guessing a fork to «keep moving» is the failure this loop exists to prevent.
>
> **Forks specific to this umbrella that MUST be parked, never guessed:**
>
> - **Branch selection (a) vs (b).** «The walker is hard to find» is NOT evidence for
>   branch (b). If the fixture-repo reproduction ran the full shipped check-set and you still
>   cannot attribute the 280 nested-scan lines, park it — do not close as environment-artifact
>   (T-FST-A, §3).
> - **Exclusion scope, if branch (a) fires.** Whether the exclusion covers only
>   `.claude/worktrees/**` + `.stryker-tmp/**` or generalises to a foreign-dir class is a
>   design choice with consumer-visible consequences. State both options, park.
> - **Walker located in `packages/core/hooks/pre-push.ts`.** That file is edited by
>   `getff-honest-signals` S1/S2 (§0). Do not edit it unilaterally — park with the collision
>   stated.
> - **Fixture shape.** If the reproduction needs a fixture the spec does not define, park with
>   the proposed shape rather than inventing one that makes the check pass.

**Pre-dispatch gate:** `grep -qi 'park it as a question' <this-kickoff>` (case-insensitive —
the contract text capitalizes «Park») AND `echo "$AGENT_MAX_REVIEW_ITERATIONS"` non-empty.
Either missing → STOP, do not dispatch autonomously.

**Egress gate (mandatory after `status=done`/`verified`):** aif does not push or open PRs by
design — `npx tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --base staging`.
Verify the deliverable before harvest (`git -C <worktreePath> log staging..HEAD`); a task on a
stale container base can false-mark itself done.

## See also

- Spec (BINDING): [2026-07-23-getff-any-stack-closure-design.md](../../../docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md) §8 item 7.
- Probe origin: timeliner refresh probe, 2026-07-23 (`prepush3.log`, 280 nested-scan lines).
