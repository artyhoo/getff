<!-- scope: stage-scoped dispatch input — S-C of the arch-v2-context-pipeline umbrella (handoff decision 11: stage-scoped inputs are binding for multi-stage umbrellas). Self-contained: an executor holding ONLY this file plus the design spec can run it. NO bridge-profile marker — deliberate, see §0. Authored 2026-07-31. -->

# arch-v2-context-pipeline S-C — L2 population table + channel verdict

> **Stage goal:** produce the **L2 channel verdict** — a BFR-disciplined adjudication over the full
> five-option space, on top of a **population table** of the seats that must be reached. This stage
> ships a research verdict, **not a build**: no L2 channel is implemented here under any outcome.
> **Design SSOT (read first, in full):**
> [`docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md)
> — **ADR-2** (the 5 options, the population-table precondition, the falsifier), **ADR-1** (the
> L1/L2 boundary this verdict presupposes), **ADR-8** (why the metered seats matter). **Also read
> first:** [`2026-07-31-arch-v2-research-distillate.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-research-distillate.md)
> — A5 (`:31-32`) + R6 (`:129`) carry the container re-check anchors W1 consumes. **Umbrella
> context (sequencing only):** [`../arch-v2-context-pipeline/kickoff.md`](../arch-v2-context-pipeline/kickoff.md) §1 S-C.
>
> **This stage is S-C only.** S-B (contract + ledger) runs in parallel on a disjoint surface — do
> not touch its files. S-D (the build, or the closure), S-E (budget gate), S-F (small fixes) are
> OUT OF SCOPE. **NO build until the verdict merges** (umbrella §1 S-C, verbatim). A systemic issue
> found outside this scope is surfaced in the PR body as an observation, never spun into an extra PR
> ([CLAUDE.md `PR strategy`](../../../CLAUDE.md)).

## §0 Dispatch facts (binding)

- **No `bridge-profile` marker on this file — deliberate, not an omission.** Tier 2: a BFR verdict
  over a five-option space is judgment by construction, and the umbrella's §4 O-6 recommends (a
  MINOR objection with a stated operator-override falsifier) not leaning on the `/arch` D1
  exception for this track; §1 applies that recommendation to this stage. Project defaults apply:
  the top tier plans in aif, the executor tier implements and reviews. Do not add a marker without
  the operator's explicit ruling quoted here.
- **Staging placement.** This kickoff must be on `origin/staging` before dispatch
  ([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)).
- **Ownership.** This stage writes a research-patch under `docs/meta-factory/research-patches/`
  (owned by the session that discovered the gap) and appends to
  `docs/meta-factory/prior-art-evaluations.md` (append-only register, capability-commit authors may
  append). It writes **no** rule, **no** hook, **no** skill. `.claude/rules/**`, `CLAUDE.md`,
  `.husky/**`, `.claude/settings.json` are maintainer-owned and out of bounds
  ([CLAUDE.md `Artifact Ownership Contract`](../../../CLAUDE.md)).
- **Ceilings.** A pre-commit hook blocks any markdown file past **600 lines** — run `wc -l` before
  adding, including on `prior-art-evaluations.md`.
- **Parallel sibling.** S-B runs concurrently (contract + ledger artefacts). Work in your own
  worktree.

## §1 Work items

### W1 — the population table (precondition, comes FIRST)

ADR-2 makes this a **precondition** of the verdict, not an appendix: a verdict written before the
table is a verdict about seats you have not enumerated.

Rows (exactly these four, per ADR-2): **CC main session** · **CC subagent** · **aif-container seat**
· **ZCode seat**. Columns:

| Column | What it holds |
|---|---|
| Seat | one of the four above |
| Channel(s) available | which context-delivery channels physically reach this seat |
| Documented degradation | what happens when the channel is absent — quoted from a source, not inferred |
| Metered? | whether ADR-8's metrics are collected from this seat |
| Evidence | command + output, or `file:line` whose content you quote |

**The R6 container re-check rides here.** The concrete targets are the A5 sweep anchors from the
research distillate ([`2026-07-31-arch-v2-research-distillate.md:31-32` and `:129`](../../../docs/superpowers/specs/2026-07-31-arch-v2-research-distillate.md)),
verbatim: under the container's `/app/` checkout — `coordinator.ts:270-278`
(`runtimeProfileModeForStage`, stage → `task|plan|review`), the hardcoded `profileMode` literals in
the six subagents (`planner.ts:330`, `reviewer.ts:49`, `verifier.ts:91`, `improver.ts:87`,
`planChecker.ts:122`), and the agent-definition-name branching (`reviewer.ts:172-173`). The
repo-side half is already verified (`2026-07-23-acceptance-contour-design.md:14-15`); it is the
`/app/` half that is sweep-asserted and needs the re-check. **Environment split:** if you are
running **inside** the aif container, you ARE the seat — read the `/app/` files directly and quote
them; `docker exec` applies only to a host-side run. **If neither path is available from where you
run, record `INCONCLUSIVE` and say so — never extrapolate host semantics onto the container**
(umbrella §1 S-C, verbatim). An `INCONCLUSIVE` row is a correct outcome; a fabricated one is the
exact defect this stage's own discipline exists to prevent.

### W2 — the five-option verdict (BFR-disciplined)

Adjudicate **all five** options on the merits. **No expected outcome is pre-announced**, and the
null option is **live** — dismissing it in a sentence is a review-time reject:

1. **digest-resolver hook on `subagent_type`**, fail-open to today's uniform digest;
2. **`skills:` frontmatter preload** via small dedicated role-context skills (never preloading
   operational skills — that collides with `disable-model-invocation`);
3. **no L2** — the null option. C10's refutation removed a *reason for uniformity*; it did **not**
   establish need;
4. **custom-subagent system-prompt replacement** — native, per-role, zero new artefacts;
5. **`paths:`-scoped rules** — an existing mechanism, SSOT #101.

Per option, state: which of the seven [build-first-reuse-default.md §1](../../rules/build-first-reuse-default.md)
verdicts applies and why; **which population rows it can and cannot reach** (ADR-2: «options that
cannot reach the metered seats must say so»); its cost as the mechanical capability-commit test
(cheap = text/skill/rule/config edit; expensive = new dependency, code module ≥50-80 LOC, standing
infra); and its falsifier.

**BFR mechanism is mandatory and must be run, not asserted** ([build-first-reuse-default.md §3](../../rules/build-first-reuse-default.md)):
SSOT consult by ID · **DeepWiki `ask_question` ≥3 phrasings** · **WebSearch ≥3 phrasings** on the
problem-domain term. `context7` is explicitly **excluded** for this decision class (it targets
library API docs, not «does a production framework exist for problem-class Y?»). Any
negative-existence claim («no upstream mechanism does this») runs the 6-item search checklist
([phase-research-coverage.md §1](../../rules/phase-research-coverage.md)) and says so.

For every ADOPT/ADAPT proposed, write verbatim: **«Upstream problem class: X. Our problem class: Y.
Match? Evidence: …»** (T16 — the umbrella's own O-1 is exactly a name-vs-function mismatch).

### W3 — record the verdict where it is findable

- **Research-patch** under `docs/meta-factory/research-patches/2026-<MM>-<DD>-l2-channel-verdict.md`
  carrying the population table, the per-option adjudication, the search evidence, and the verdict.
  **Principle 10 format (gated, exact):** the FIRST line must be a scope annotation matching
  `^<!-- scope:[a-zA-Z0-9.§-]+ -->$` — **no spaces inside the slug**, e.g.
  `<!-- scope:l2-channel-verdict -->`. The multi-word `<!-- scope: stage-scoped … -->` comment
  style used by kickoffs (including this one) FAILS that regex — do not copy it into the patch.
- **SSOT append** to [`docs/meta-factory/prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md)
  for any candidate surfaced that has no entry yet — with `Verdict`, `Rationale`, `Trigger to
  revisit`, in this same PR (per its §3 append-only contract).
- **Cite the SSOT by ID** in the verdict text; principle 08 validates that citations resolve.

### W4 — assign S-D's tier in this PR body (umbrella §4 O-5)

S-D's tier is **unassignable at plan time** because it is a function of this verdict: a resolver
hook and a null-outcome closure are not the same tier of work. **This stage's PR body assigns it**,
with justification against [CLAUDE.md `Task-tier routing`](../../../CLAUDE.md)'s fixed criteria —
including the marker decision and, if a marker is proposed, the `GET /runtime-profiles` uniqueness
check and the `fidelity-verdict-in-pr-body` required-check re-verification quoted as command output.

On the **null verdict**, say plainly that S-D becomes an L2-closure PR (retirement note + `done.md`,
no build) and tier it accordingly.

## §2 Acceptance (all must hold)

1. The population table is complete: four rows, each with channel(s), a **documented** degradation,
   the metered flag, and evidence — or an explicit `INCONCLUSIVE` with the reason (container
   unreachable) where that is the honest answer.
2. All five options are adjudicated on the merits; the null option is argued, not dismissed.
3. Every option states which population rows it cannot reach.
4. The BFR mechanism was **run**: DeepWiki ≥3 phrasings + WebSearch ≥3 phrasings + SSOT consult, with
   queries and results quoted. Any negative-existence claim carries the 6-item checklist.
5. Every ADOPT/ADAPT carries the explicit problem-class match statement.
6. The research-patch exists; SSOT entries appended for new candidates; citations resolve.
7. S-D's tier is assigned in the PR body with justification.
8. The PR body carries the §3 self-check and a `Prior-art:` trailer (or a ≥20-char escape rationale).
9. **Zero build**: the diff contains no hook, no resolver, no skill, no rule — verified by the
   reviewer against `git diff --name-only`.

```bash host-verify
npx vitest run packages/core/principles/08-prior-art-cited.test.ts
npx vitest run packages/core/principles/10-research-patch-annotation.test.ts
npx vitest run packages/core/principles/12-ai-laziness-traps.test.ts
```

> Run them via `bash scripts/host-verify.sh arch-v2-context-pipeline-s-c` **on the host** — a green
> container run is not evidence about the host
> ([destination-environment-verification.md §3](../../rules/destination-environment-verification.md)).

## §3 §1.7 self-check obligation for this stage's PR

**Forward-check** must name, each with `file:line` evidence: `build-first-reuse-default.md §1/§3`
(the seven-verdict framing and the mechanism actually run), `phase-research-coverage.md §1` (the
6-item checklist on any negative-existence claim), `ai-laziness-traps.md §2 T16` (problem-class
match), `doc-authority-hierarchy.md` (the research-patch's header), `no-paid-llm-in-ci.md` (research
is session-read; nothing added to CI).

**Backward-check** must enumerate **sibling surfaces the diff did NOT touch** and verdict each
`SWEPT-CLEAN(evidence)` / `GAP-FOUND(action)`. The change class is *per-role / per-seat context
delivery channels*; the enumeration must at minimum reach the `paths:`-scoped rule mechanism
(SSOT #101), `.claude/hooks/inject-matching-rule.sh`, the shipped
`packages/core/templates/shared/skill-context/**` overrides, and the `claudeMdExcludes` surface
(`.claude/settings.json:214` — a settings key, not a CLAUDE.md section). A backward-check whose surface list equals the diff's own file list is **non-conformant by
format** — delegate the sweep to [`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md),
handing it the change *class* only, never this kickoff or the diff.

## §4 Descopes (BINDING)

**No build of any kind** — no digest resolver, no role-context skills, no system-prompt
replacement, no `paths:` rule edits. No S-B content (no contract artefact, no calibration ledger, no
watch-list). No S-D/S-E/S-F content. No ADR-8 baseline rows. No edits to `.claude/rules/**`,
`CLAUDE.md`, `.husky/**`, `.claude/settings.json`. No new npm dependency. No CI workflow changes.

## §4a Park-don't-guess contract (non-negotiable)

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible
implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do
NOT pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with
the fork stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.**
Proceed only on the unambiguous parts.

Expected to fire here on: the container re-check when `docker exec` is unavailable where you run
(park or record `INCONCLUSIVE` — do not extrapolate), and on a genuine tie between two options at
the end of the adjudication (surface the fork with consequences; the verdict is allowed to be «two
survive, operator picks», it is not allowed to be a coin flip presented as a finding). Never
manufacture a quoted command output for anything outside your environment.

## §5 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps for
this stage: T2, T3, T7, T10, T11, T12, T13, T14, T15, T16, T20, T21.**

- **T2** — designing ≠ running: «the search would surface X» is not a search. Quote queries and
  results.
- **T3** — no prose-only findings: every claim carries a command + output or a quoted `file:line`.
- **T7** — run the adversarial counter-prompt against your own option set: «which sixth channel did
  this table miss?» — ADR-2's falsifier is exactly that; if it surfaces one, that is a finding, and
  the population-table method failed and must be recorded as a research-patch.
- **T10** — enumerate the population **before** sampling channels; a completeness claim without the
  table is meaningless.
- **T11** — no «I propose mechanism X» before the external search runs.
- **T12** — do not skip the sweep because the area feels familiar; training data has a cutoff and is
  biased toward well-documented tools.
- **T13** — an ADOPTED upstream is not zero-work: confirm the upstream itself had external evidence,
  or escalate to OWN-BUILD-class depth.
- **T14** — a clean sweep at low coverage is «coverage insufficient», not «no channel exists».
- **T15** — self-application: this stage's own verdict is delivered through the very context
  channels it adjudicates. State which channel delivered **this kickoff** to you, and whether the
  option set covers it.
- **T16** — the explicit problem-class match statement per ADOPT/ADAPT.
- **T20** — no verdict without an evidence-bearing tool call in the same turn.
- **T21** — the §3 backward-check enumerates non-diff surfaces.
- **T-SC-A (domain) — «the null option is the safe answer».** Selecting «no L2» because it requires
  no build is not adjudication; it is the same shortcut as selecting a build because it feels like
  progress. Counter: the null verdict must carry the same evidence load as any other — what it
  costs, what it forecloses, and its falsifier.
- **T-SC-B (domain) — «the host behaves like the container».** The R6 re-check exists precisely
  because they diverge ([destination-environment-verification.md §3](../../rules/destination-environment-verification.md)).
  Counter: `INCONCLUSIVE` is an acceptable row value; an extrapolated one is a defect.

## See also

- [`docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md) — ADR-1, ADR-2, ADR-8 (binding).
- [`docs/superpowers/specs/2026-07-31-arch-v2-research-distillate.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-research-distillate.md) — A5/R6, the container re-check anchors (W1).
- [`docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-handoff.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-handoff.md) — decision 11 (stage-scoped inputs are binding), the provenance of this file's format.
- [`../arch-v2-context-pipeline/kickoff.md`](../arch-v2-context-pipeline/kickoff.md) — umbrella §1 S-C, §4 O-5.
- [`.claude/rules/build-first-reuse-default.md`](../../rules/build-first-reuse-default.md) — the seven verdicts + the mandatory §3 mechanism.
- [`.claude/rules/phase-research-coverage.md`](../../rules/phase-research-coverage.md) — the 6-item negative-existence checklist.
- [`docs/meta-factory/prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md) — the SSOT this verdict cites and appends to.
- [`.claude/rules/destination-environment-verification.md`](../../rules/destination-environment-verification.md) — why the container re-check cannot be inferred from the host.
