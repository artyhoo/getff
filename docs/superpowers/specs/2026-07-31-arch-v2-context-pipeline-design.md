<!-- scope: system-design spec for the /arch v2 + context-pipeline track (step 5 of the 2026-07-31 handoff §4 protocol). Authored by the Fable synthesis seat on the Opus distillate + Opus cold critique (GO-WITH-PATCHES, all three blockers absorbed by re-derivation, M1-M7 absorbed as design constraints). Consumer: the Opus plan-writing seat (step 6) and every stage kickoff derived from it. -->

# /arch v2 + context pipeline — system design (2026-07-31)

> **Authoritative for:** the layer model (§1), the pipeline architecture (§2), and ADR-1..ADR-8
> (§3) of the /arch v2 + context-pipeline track. **NOT authoritative for:** project goal
> ([README.md#why-this-exists](../../../README.md#why-this-exists)); the current /arch
> choreography ([.claude/skills/arch/SKILL.md](../../../.claude/skills/arch/SKILL.md) — SSOT
> until the stage that rewrites it merges); token-audit umbrella scope
> ([.claude/orchestrator-prompts/session-start-token-audit/kickoff.md](../../../.claude/orchestrator-prompts/session-start-token-audit/kickoff.md));
> any cited rule — each rule owns itself.
> **Current as of 2026-07-31.** Evidence chain: research distillate (Opus, spot-checked) →
> corrected idea (Fable) → cold critique (Opus, GO-WITH-PATCHES). Citations A1-A8/B1-B5 = the
> distillate; CR-B1..B3/CR-M1..M7 = the critique (both preserved in the track's session
> artifacts; load-bearing claims restated here with their primary sources).

## §0 Requirements and constraints

**Functional.** (F1) Session context becomes an enforced convention: measured, attributed,
budget-gated per environment. (F2) Ambient per-role context becomes an authored artifact, not
an accident of uniform injection. (F3) The role pipeline (ideation → verification → execution)
runs as /arch choreography where each stage's artifact is the next seat's context by
construction. (F4) Dispatch inputs get a cold reality-check before an executor burns tokens on
them.

**Non-functional.** (N1) Net always-on bytes go down or stay flat — binding, per Anthropic's
2026-07-24 subtractive result (A4); any stage increasing net always-on load must justify it in
its kickoff. (N2) Every budget assertion names its environment — host-cc and aif-container
numbers diverge (A7: 90,699 B vs 131,408 B for the same channel). (N3) ZCode parity per
[zcode-parity-doctrine.md §1](../../../.claude/rules/zcode-parity-doctrine.md): degraded is
acceptable, undocumented degradation is not. (N4) No paid LLM in CI; all semantic checks ride
in session-read agents ([no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md)).

**Constraints.** (C1) No native per-role subtraction of CLAUDE.md exists — «no frontmatter
field or per-agent setting» (A1, primary doc fetched 2026-07-31). (C2) A custom subagent's
system prompt replaces CC's entirely (A3). (C3) `skills:` frontmatter preload injects full
skill content per agent definition, but cannot preload `disable-model-invocation: true` skills
(A2). (C4) `SubagentStart` is inexpressible on ZCode
([zcode-parity-doctrine.md §2](../../../.claude/rules/zcode-parity-doctrine.md) row 16); the
`PreToolUse:Agent` twin is the parity fallback (row 15). (C5) The aif runtime already shapes
dispatch-time role at three granularities (A5, sweep-asserted; container re-check is a stage
task — R6). (C6) The aif-review skill-context override is framework-maintainer-owned
([CLAUDE.md Artifact Ownership Contract](../../../CLAUDE.md)) — changes there are a handoff
step, never a session edit (CR-m3).

## §1 The layer model (REVISED per CR-M6)

The L1/L2 boundary is **«what loads by default» vs «what we author and inject per role»** —
not «project vs role».

- **L1 — always-on load** (everything a seat receives without anyone authoring it for the
  role). Two sub-axes: (a) **per-project subtraction** — `claudeMdExcludes`,
  `disable-model-invocation`, MCP server disabling, the 1,536-char description cap as the
  attribution unit (A8); (b) **per-agent-definition replacement** — the custom-subagent system
  prompt (C2), which makes the largest single L1 channel per-role-variable natively; token
  attribution MUST therefore split main-session vs custom-subagent system prompts. Umbrella:
  `session-start-token-audit` (live, S1 in flight) + ADR-3's gate.
- **L2 — authored role-shaped ambient context.** Scope line (evidence-backed, A5): the one
  surface the existing runtime does NOT shape is the ambient digest, uniform across stages.
  L2 authors it per role. Channel verdict deliberately open — ADR-2.
- **L3 — dispatch-time authored context.** The artifact chain of §2: each pipeline stage's
  output artifact IS the next seat's context. The delta claim is narrow: the runtime already
  selects model/mode/prompt per stage (C5); L3's novelty is the chain + membrane, nothing else.

## §2 Pipeline architecture and data flow

One arc, seven stations; the artifact produced at each station is the context consumed at the
next. Seats are relative tiers (record roles, not model names — handoff decision 2).

```text
 idea (operator / Fable)
   │  research-spec           ← Opus authors; template REQUIRES pre-mortem paragraph
   ▼                            + acceptance-criteria line (what test proves the idea wrong)
 GLM research (aif)          → raw research, dated sources (freshness bar, decision 8)
   │  distillate              ← Opus verifies (spot-checks, not curation), distills;
   ▼                            carries «current as of <date>»
 [K-pass over distillate]    ← bottom-seat-style K1/K2 check ON the distillate (ADR-4)
   │
 Fable correction            → corrected idea (may use bounded drill-down, ADR-4)
   │
 Opus cold critique          → BLOCKER/MAJOR/MINOR + survived-list + verdict
   │                            (cold = did not author AND did not receive authoring context)
 Fable system design         → this document's successors (spec + ADRs with falsifiers)
   │
 Opus execution plan         → stage-scoped kickoffs (decision 11); plan-writer cannot
   │                            rubber-stamp design — its objections are recorded in the plan
 GLM implementation (aif)    ← bottom seat checks each dispatch input (contract v2, ADR-6)
   │                            + shadow-A/B during calibration (ADR-5)
 Opus acceptance at harvest  → merge authority stays with the operator/maintainer gates
```

**Membrane (data-flow rule, REVISED per CR-M2):** by default Fable consumes only distillates,
GLM consumes only specs/kickoffs, Opus sees both directions. The membrane is a default with
bounded recourse, not epistemic isolation — see ADR-4.

**Kill channels (self-application of the project invariant):** an idea can die at the
research-spec (pre-mortem), at the distillate (Opus idea verdict GO/rework/kill — killed ideas
land in the SSOT with reasons, handoff decision 4), at the critique (REWORK), or at acceptance.
Each is cheaper than the next; the pipeline's job is to make the cheap deaths reachable.

## §3 Architecture decision records

Each ADR carries a falsifier. Format: decision → grounds → falsifier.

### ADR-1 — L1/L2 boundary at «default-loaded vs authored-injected» (absorbs CR-M6)

**Decision:** as §1. The earlier «L1 = project, L2 = role» line is retired: it broke on C2
(the system prompt is default-loaded AND per-role) and on C1 (per-role subtraction of
CLAUDE.md is impossible, so «role-differentiated L1» was never deliverable).
**Falsifier:** a channel appears that is neither default-loaded nor authored-injected (e.g. a
future harness adds dynamic per-role subtraction) → boundary re-derived, not patched.

### ADR-2 — L2 channel verdict is a stage deliverable over a 5-option space (absorbs CR-M1, CR-M7)

**Decision:** the L2 umbrella's FIRST stage produces a BFR-disciplined verdict over the full
option space — (i) digest-resolver hook on `subagent_type`, fail-open to today's uniform
digest; (ii) `skills:` frontmatter preload via small dedicated role-context skills (C3 —
never preloading operational skills, which avoids the `disable-model-invocation` collision);
(iii) **no L2** (C10's refutation removed a reason for uniformity; it did not establish need —
the null option is live); (iv) custom-subagent system-prompt replacement (C2 — native,
per-role, zero new artifacts); (v) `paths:`-scoped rules (existing mechanism, SSOT #101).
No expected outcome is pre-announced. **Precondition:** a population table — CC main session ·
CC subagent · aif-container seat · ZCode seat — with channel + documented degradation per row
(C4, C5); options that cannot reach the metered seats (aif-container, ZCode) must say so in
the verdict, since those seats are where the bet's metrics are collected (ADR-8).
**Grounds:** own-stack-first ([build-first-reuse-default.md §1.1](../../../.claude/rules/build-first-reuse-default.md));
CR-M7 showed the previous 2-option framing was a verdict under a disclaimer.
**Falsifier:** the verdict stage finds a sixth native channel this table missed → the
population-table method failed, re-run the sweep with the miss recorded as a research-patch.

### ADR-3 — budget gate lives at pre-push/CI over measured output; `InstructionsLoaded` is the measurement source, not the gate (absorbs CR-M4)

**Decision:** the L1 budget gate compares token-audit S1's measured per-channel attribution
against per-environment ceilings (N2) in a channel PROVEN to block: a pre-push section + CI
mirror, error-with-escape-token (rationale ≥20 chars; precedent
[ci-tool-pinning.md §3](../../../.claude/rules/ci-tool-pinning.md)). `InstructionsLoaded`
(CC 2.1.207+) feeds measurement; whether a hook on it can *block* is UNVERIFIED — a stage task
verifies against primary docs, and only a verified-blocking result may promote the gate
earlier. **Grounds:** the distillate's own lever table calls `InstructionsLoaded`
«observability, not removal»; designing the gate on an unverified blocking capability is a
K5 defect (CR-M4) — the same class the pipeline checks for.
**Falsifier:** measurement shows session-start load is dominated by channels the S1 script
cannot see → the gate is asserting a minority share; re-scope measurement before enforcing.

### ADR-4 — membrane: default + K-pass on the distillate + bounded drill-down (absorbs CR-M2, CR-m4)

**Decision:** three parts. (1) A K1/K2 pass runs ON each distillate before Fable consumes it —
the distiller's defects die at the distiller's channel (earliest reachable), not at the
consumer's. Evidence this is needed: R5 — the verifier seat itself shipped two
non-reproducing quotes inside a confirmed-findings cold review. (2) Drill-down is bounded
recourse, symmetric for Fable and GLM: first choice is «ask the producer seat to re-verify
claim X» (one round-trip, membrane intact); direct opening of a cited source is capped at
≤3 per artifact; each drill-down is recorded IN the resulting artifact naming the claim and
what changed — the record's consumer is the next Opus look (critique or acceptance), which
treats an unrecorded drill-down as a finding. (3) Scope stays cited-sources-only — browsing
stays blocked.
**Falsifier:** two artifacts in a row exhaust the drill-down cap with recorded, justified
reads → the distillation format is under-serving forks; fix the distillate template, not the cap.

### ADR-5 — top-down seat: abolition on stated grounds; shadow-A/B calibration doubles as the #231 cohort (absorbs CR-B1, CR-B3)

**Decision:** the dedicated top-down design-review seat is not created. **Stated grounds
(operator decision 5, re-grounded):** role economy — Opus already takes three standing looks
(idea verdict at the distillate; plan-writing, which cannot rubber-stamp; acceptance at
harvest), each at a different artifact; a fourth dedicated seat buys redundant coverage at
dispatch latency. **Explicitly NOT grounds:** SSOT #231 — its verdict is REFERENCE with
«Match: partial — different object, different downstream cost», and its collapse trigger is
prospective (≥5 contours observed). The earlier reading of #231 as supporting evidence was a
T16 over-read of our own fresh row and is retracted. **Mechanism instead of hope:** the
calibration cohort (below) is a **shadow A/B** — for the first 5 pipeline dispatches, an Opus
cold pass runs on the SAME dispatch input as the bottom seat; both report; diffs land in a
named ledger (`.claude/orchestrator-prompts/<umbrella>/calibration.md`). Pre-declared
threshold: **≥2 of 5 runs in which Opus finds a K1/K2-class defect the bottom seat missed →
the seat re-tiers to Opus** (checks stay, tier moves). The same ledger IS the ≥5-contour
observation base #231 asks for: if the shadow arm surfaces top-down-class findings
(goal/feasibility holes) that no standing look caught, the dedicated seat is reinstated —
that is decision 5's own falsifier, now with an oracle.
**Why executor-now + shadow (the ordering CR-M7 asked to be stated as a choice):** during the
calibration window Opus reviews every input anyway (the shadow arm), so starting the bottom
seat on the executor tier costs zero coverage while the window runs; the risk-symmetric
alternative («Opus seat until proven») buys the same evidence at strictly higher steady-state
cost if the executor seat passes.

### ADR-6 — dispatch-input contract v2: five equal classes + K6 candidate/adjudicate split (absorbs CR-B2, CR-M3, CR-m2; REVISED from contract v1, handoff decision 5)

**Decision:** contract v2 = K1 anchors exist · K2 quoted outputs reproduce · K3
sibling-pattern consistency · K4 format mechanics incl. silent failure modes · K5
external-state preconditions — **five equal classes, no primary/background split.** The
earlier «K1/K2 primary, 5/5 incidents» derivation is retracted: the incident base assigns
2/5 to K1, and the three remaining incidents are exactly the classes the split demoted
(CR-B2); R1a found no low-yield class to drop. Incident mix is recorded in the calibration
ledger and MAY re-derive a split after ≥10 runs of data. **K6 — self-consistency with
declared non-goals — enters as a split check:** the bottom seat emits *candidates*
(closed verdict-lexicon grep — `Recommendation|Verdict|should adopt|High —|Preferred` — plus
the extracted non-goal declarations, structured output); the Opus framing-bias look
adjudicates. Known false-negative class stated honestly: priority-labels without verdict
words («High — natural host») defeat the lexicon — the executor arm is a candidate
generator, never the decision layer
([attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md)).
**Falsifier:** ledger shows a K-class with 0 catches across 10+ runs while costing measurable
seat time → demote that class with the data attached (the split B2 blocked returns, earned).

### ADR-7 — review dimensions: drop SOLID everywhere; three added dimensions with named owners (absorbs distillate B1/§D, CR-m3)

**Decision:** SOLID/patterns/LLD checks are dropped from every reviewer prompt — not
relocated (vacuous-by-construction: always-pass or always-find; a relocated vacuous check is
a permanent noise floor). Naming/readability: author self-review only. Added, each with an
owner: **test quality** (fails-for-the-right-reason) → Opus acceptance at harvest;
**error-path reachability** → aif per-task reviewer; **differential/unintended behaviour
change** → Opus acceptance, scoped against SSOT #228's acceptance-side arm. Correctness,
convention conformance, security (session-read), test presence: unchanged homes. The aif
per-task-reviewer additions route through the framework-maintainer handoff for
`packages/core/templates/shared/skill-context/aif-review/SKILL.md` (C6) — surfaced as a
proposed diff in the stage PR body, never a direct edit.
**Falsifier:** a defect escapes to production whose earliest catchable channel was a
SOLID-style structural review → reopen with the incident attached (drop is evidence-priced,
not dogma).

### ADR-8 — the per-role bet, operationalized (absorbs CR-M5)

**Decision:** per-role shaping has no external cover in either direction (A4) — it is this
project's own bet, and it gets a real experiment: (1) **baseline before the resolver/preload
merges** — token cost per dispatched task + review-defect count over the trailing 10 uniform
dispatches, recorded in the calibration ledger; (2) **window** — 20 role-shaped dispatches;
(3) **control arm** — deterministic role-vs-uniform split (hook branches on task-id parity),
one branch in the resolver, a real A/B rather than fail-open-by-accident; (4) **owner** — the
L2 umbrella orchestrator closes the window with a verdict PR.
**Falsifier (the bet's own):** no improvement on either metric at window close → the shaping
channel retires; L1 attribution + budget gate remain as the umbrella's standing value.

## §4 Stage decomposition (input to the Opus plan — step 6)

Sized for stage-scoped kickoffs (decision 11); ordering respects evidence dependencies.

1. **S-A `/arch` v2 rewrite** — codify the §2 arc into
   [arch/SKILL.md](../../../.claude/skills/arch/SKILL.md): research contour §1.5 (research-spec
   template with pre-mortem + acceptance-criteria line), membrane + drill-down rules (ADR-4),
   K-pass station, cold definition, kill channels; fix the two known wrapper drifts at
   interface level (arch/SKILL.md:79 false negative-existence — live today; night-mode
   roster), ship the skill-exists-by-name smoke (decision 6); codify the unique-filenames
   convention for parallel subagents (decision 13).
2. **S-B contract v2 + shadow calibration** — bottom-seat check as an aif-dispatch-input
   station (ADR-6 classes, K6 candidate emitter), calibration ledger schema + the 5-dispatch
   shadow-A/B protocol (ADR-5), threshold pre-registered in the ledger header.
3. **S-C L2 verdict stage** — population table + 5-option BFR verdict (ADR-2); container
   re-check of the A5 sweep lines (R6) rides here; NO build until the verdict merges.
4. **S-D L2 build** — whatever ADR-2's verdict selects (resolver, preload, system-prompt
   route, or the null outcome closing L2); includes the ADR-8 baseline capture BEFORE merge,
   A/B branch, ZCode twin per population table.
5. **S-E budget gate** — ADR-3: pre-push/CI gate over S1 output, per-environment ceilings,
   escape token; the `InstructionsLoaded`-can-block verification task; lands only after
   token-audit S1 merges (cross-umbrella dependency, not a blocker for S-A..S-C).
6. **S-F small-fixes queue** — handoff decision 13 items, one maintenance PR, scheduled at
   token-audit S2 time (unchanged).

Tier routing per [CLAUDE.md Task-tier routing](../../../CLAUDE.md): S-A and S-C are Tier-2
(design judgment; this document + stage kickoffs encode the decisions — dispatch WITH the
bridge-profile marker only if plan-complete AND the fidelity-verdict required-check
precondition holds at dispatch time); S-B, S-D, S-E, S-F are Tier-1/Tier-2 per their kickoff
completeness at dispatch time.

## §5 Failure modes

- Resolver/preload failure → fail-open to today's uniform digest (never a blocked dispatch).
- Budget gate false-fire in the other environment → impossible by design only if N2 is
  honored; the gate refuses to load a ceiling without an environment label.
- Shadow-arm unavailability (Opus quota) during calibration → the dispatch proceeds; the run
  is marked `shadow=absent` in the ledger and does NOT count toward the 5-run cohort
  (silence never reads as health —
  [autonomous-loop-continuity.md §2](../../../.claude/rules/autonomous-loop-continuity.md)).
- Distillate K-pass finds fabricated quotes → distillate returns to the distiller seat
  (rework), Fable never consumes it; 2+ consecutive rework rounds → surface to operator.

## §6 Enforcement surfaces (rules-as-tests, per the project thesis)

- ADR-4 drill-down record: checked by the Opus critique/acceptance protocols (named cold-agent
  channel, not bare attention).
- ADR-5/ADR-6 ledger: schema'd markdown; a principle test asserts ledger-row completeness
  once ≥5 rows exist (no empty-verdict rows).
- ADR-2 population table + ADR-8 baseline: kickoff-blocking checklist items in S-C/S-D
  kickoffs (Phase -1 reviewable).
- Byte-identity of any dual-channel L2 artifact: pre-commit gate (existing
  `plugin/hooks` twin pattern).
- Wrapper smoke: skill-exists-by-name check (decision 6) rides S-A.

## §7 §1.7 self-reflexive note

**Forward-check.** Complies with [build-first-reuse-default.md §1.1](../../../.claude/rules/build-first-reuse-default.md)
(ADR-2 runs the full own-stack-first option space including the null option; no capability is
committed by this doc). Complies with [attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md)
(every load-bearing check here is a gate or a NAMED cold-agent protocol: K-pass, shadow-A/B
ledger, framing-bias look; the two judgment halves — K6 adjudication, framing bias — are
assigned to named Opus looks, not dressed as gates). Complies with
[no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) (all semantic checks are
session-read; CI gates are deterministic). Complies with
[doc-authority-hierarchy.md §2-§3](../../../.claude/rules/doc-authority-hierarchy.md)
(Authoritative-for header present; /arch SKILL.md remains SSOT until S-A merges).
[ai-laziness-traps.md](../../../.claude/rules/ai-laziness-traps.md): T15 — the pipeline
designed here was used to design itself (distillate → correction → cold critique → this spec);
T20 — every load-bearing verdict above carries a distillate/critique citation whose sources
were spot-checked this same day; T16 — the #231 over-read is retracted in ADR-5, not papered
over.
**Backward-check.** Class of this change = «role/context pipeline design docs». Surfaces
swept: [2026-07-31 handoff](2026-07-31-arch-v2-context-pipeline-handoff.md) — superseded as
the working idea statement by this spec's §1-§3 (its §2 decisions stand except decisions 5/7/9
marked REVISED here: ADR-5/ADR-6, ADR-1/ADR-2, ADR-7); [2026-07-23 acceptance-contour
design](2026-07-23-acceptance-contour-design.md) — NOT superseded (fidelity gate + D1 routing
untouched; its stale container line-refs are S-C's re-check task); per-role bundle/addendum
specs (2026-07-2{6,7}) — remain evidence record; their «uniform digest» premise was already
corrected by #1182, consistent with §1-L2 here; [zcode-parity-doctrine.md](../../../.claude/rules/zcode-parity-doctrine.md)
— consistent (C4 adopts row 15/16 verbatim); token-audit kickoff — untouched, S-E declares
the cross-umbrella dependency instead of editing it.
