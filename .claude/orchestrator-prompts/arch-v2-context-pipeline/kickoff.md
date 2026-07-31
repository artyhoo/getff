<!-- scope: umbrella kickoff — /arch v2 + context-pipeline track. Authored 2026-07-31 by the Opus plan-writing seat (step 6 of the handoff §4 protocol) over the binding design spec. NO bridge-profile marker on THIS file: the umbrella kickoff is a coordination artefact, never itself dispatched — each stage kickoff carries (or deliberately omits) its own marker per §0. Plan-writer objections to the design are recorded in §4, not silently patched. -->
<!-- host-verify: none — umbrella coordination doc, no executable deliverable of its own; every executable acceptance command is declared in the host-verify block of the stage kickoff that owns it (S-A: arch-v2-context-pipeline-s-a/kickoff.md). -->

# arch-v2-context-pipeline — umbrella kickoff

> **Goal:** context is the one convention this project never made executable — budget asserted
> by nobody, every role loaded identically, role-specific content authored ad-hoc. This umbrella
> turns that into artefacts at three layers: L1 always-on load gets measured, attributed and
> budget-gated; L2 ambient per-role context gets an evidence-backed channel verdict (including
> the null verdict); L3 makes the role pipeline (ideation → verification → execution) a `/arch`
> choreography in which each stage's artifact IS the next seat's context by construction, with a
> cold reality-check on every dispatch input. **Design SSOT:**
> [`docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md)
> (§1 layer model, §2 pipeline arc, ADR-1..ADR-8, §4 stage decomposition, §5 failure modes,
> §6 enforcement surfaces). Decision context:
> [`…-handoff.md §2`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-handoff.md).
> This kickoff owns **sequencing, tier routing, acceptance and dispatch protocol** — it does NOT
> restate or amend the design; where the plan-writer disagrees with the design, §4 records it.

## §0 Dispatch protocol (BINDING — applies to every stage)

**Staging placement.** Every stage kickoff MUST be on `origin/staging` before it is dispatched
([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)). Author → merge →
only then dispatch. This umbrella kickoff and the S-A stage kickoff travel in the same PR.

**Pre-dispatch in-flight probe (all four arms, per [CLAUDE.md `Pre-dispatch in-flight probe`](../../../CLAUDE.md)).**
Run immediately before each dispatch, and **re-run after Phase -1 completes** — all three
historical collisions materialised inside the Phase -1 window:

1. `gh pr list --head <branch> --state all` — PR-stage collision.
2. `git log origin/staging..<branch>` on any existing worktree/branch — commit-stage collision
   (the window the PR probe misses).
3. Scan for parallel CC sessions / worktrees named for the same stage.
4. **aif queue** — `source ~/.zshenv; curl -s "$RUNTIME_BRIDGE_AIF_URL/tasks" | jq -r '.[] | "\(.id) \(.status) \(.title)"'`.
   **Known in-flight neighbours at authoring time (2026-07-31, do NOT re-dispatch):**
   `c781e8a9-741d-45b8-a186-89915037abe2` (token-audit S1 — S-E's cross-umbrella dependency),
   `775f635f-eab2-4a7c-86ae-e1052b754773` (review-checks/context-levers research — its patch is
   evidence for S-C), `4e1056d2-9198-419f-b13d-d980ec99e80a` (per-role cold review + first L3
   sweep). On any hit: STOP and surface. One stage = one executor session.

**Phase -1 cold review (BINDING, one REVISE round maximum).** Before each stage dispatch, spawn a
read-only adversarial Agent over the stage kickoff + the design spec — artifact paths only, never
this session's context ([CLAUDE.md `Meta-orchestrator self-review obligation`](../../../CLAUDE.md);
[`/arch §2`](../../skills/arch/SKILL.md) cold-by-construction rationale). Verdict grammar
`GO | REVISE | STOP`, findings `BLOCKER | MAJOR | MINOR` with file:line evidence. Additionally
probe the principle-test allowlists for any new artefact the stage introduces
(`~/.claude/skills/orchestrator/SKILL.md` Phase -1 → «Principle-test allowlist probe»).

**Bridge-profile marker rule.** The marker routes the whole aif pipeline (plan + implement +
review) to the executor tier. Two independent conditions must BOTH hold before a stage kickoff
carries one:

- **Value uniqueness.** «the value MUST be the profile's **full display name, unique** under the
  resolver's match» ([CLAUDE.md `Marker value rule`](../../../CLAUDE.md)). Verify at authoring
  time against the live list: `curl -s "$RUNTIME_BRIDGE_AIF_URL/runtime-profiles" | jq -r '.[].name'`.
  Live at authoring (2026-07-31): `Claude Opus (plan+review)` · `Z.AI GLM-5.2 SDK` ·
  `Qwen3.8-Max-Preview` → the executor-tier value is `Z.AI GLM-5.2 SDK`. An abbreviation matches
  ≥2 rows under the substring fallback and aborts with `dispatch_failed` (3 recurrences: PR #1109,
  `umbrella-donemd-backfill`, `getff-honest-signals`).
- **Fail-closed precondition, re-verified AT DISPATCH TIME.** CLAUDE.md, verbatim: «**Precondition:**
  this exception is active ONLY while `fidelity-verdict-in-pr-body` is a REQUIRED check in staging
  branch protection; if it is not (yet or anymore) registered, dispatch without the marker — a
  routing rule without its fail-closed gate violates the spec D1 precondition.» Command +
  authoring-time output (2026-07-31, verbatim):
  `gh api repos/:owner/:repo/branches/staging/protection/required_status_checks`
  → `{"strict":false,"contexts":["ci-success","fidelity-verdict-in-pr-body"],…}`. The dispatcher
  MUST re-run it. If the check is gone: dispatch WITHOUT the marker and surface — never edit a
  marker silently.

**Bottom seat + shadow-A/B station — ACTIVE FROM S-B MERGE ONWARD.** ADR-6's dispatch-input
contract v2 and ADR-5's shadow-A/B calibration are *built by S-B*. They therefore do **not** cover
S-A: S-A is dispatched through the pipeline whose reality-check does not exist yet. Stated
plainly rather than claimed — an unbuilt station cannot check anything, and pretending otherwise
is `#hope-as-gate` ([attention-is-not-a-mechanism.md §2](../../rules/attention-is-not-a-mechanism.md)).
S-A's compensating coverage is exactly and only: this plan's §4 objections, the Phase -1 cold
review above, and the acceptance commands in its own kickoff. From S-B's merge onward every stage
dispatch runs the bottom-seat check on its input, and — for the first 5 dispatches — the Opus
shadow arm on the SAME input, both logged to the calibration ledger (§2).

**One PR per stage onto `staging`; do not collapse stages.** Scope discipline per
[CLAUDE.md `PR strategy`](../../../CLAUDE.md): a systemic issue noticed mid-stage is surfaced as
an observation, never spun into an autonomous extra PR. Every stage PR carries a §1.7
forward+backward self-check and a `Prior-art:` trailer (or the ≥20-char escape-hatch rationale).

## §1 Stages

| Stage | Scope (one line) | Depends on | Tier | Marker | Implements |
|---|---|---|---|---|---|
| S-A | `/arch` v2 SKILL.md rewrite + 3 wrapper-drift fixes + upstream-reference smoke | — | 2 | **NO** (§4 O-6) | §2 arc, ADR-4 |
| S-B | dispatch-input contract v2 + calibration ledger + shadow-A/B protocol | S-A | 2 | NO | ADR-5, ADR-6 |
| S-C | L2 population table + 5-option BFR verdict (null option live) | S-A | 2 | NO | ADR-2, ADR-1 |
| S-D | L2 build — whatever S-C's verdict selects, or L2 closure | S-C | classify at dispatch | per S-C verdict | ADR-2, ADR-8 |
| S-E | L1 budget gate at pre-push/CI + `InstructionsLoaded` blocking verification | token-audit S1 **merged** | 2 | NO | ADR-3 |
| S-F | small-fixes queue (handoff decision 13), one maintenance PR | token-audit S2 timing | 1 | YES (`Z.AI GLM-5.2 SDK`) | — |

### S-A — `/arch` v2 rewrite

**Scope.** Codify the §2 pipeline arc into [`.claude/skills/arch/SKILL.md`](../../skills/arch/SKILL.md):
research contour (§1.5, research-spec template with a pre-mortem paragraph + an
acceptance-criteria line), the membrane + bounded drill-down rules (ADR-4), the K-pass station on
the distillate, the cold definition, the kill channels; fix **three** wrapper drifts at interface
level (§4 O-1 — the spec names two); ship the upstream-reference smoke; codify the
unique-filenames convention for parallel subagents. Full stage-scoped brief:
[`arch-v2-context-pipeline-s-a/kickoff.md`](../arch-v2-context-pipeline-s-a/kickoff.md).

**Tier 2 — justification.** The «how» cannot be stated in one sentence: the rewrite must decide
what /arch's delta actually IS now that upstream's `brainstorming` is verified to ship a
spec-document reviewer (§4 O-1), and how to state the membrane/K-pass without re-describing
upstream internals (handoff decision 6). Stating the how forces a choice → Tier 2
([CLAUDE.md `Discriminator in one line`](../../../CLAUDE.md)). Marker: **NO** — see §4 O-6.

**Acceptance.** (i) `/arch` SKILL.md carries §1.5 research contour, the membrane rule with the
≤3 drill-down cap and its recording obligation, the K-pass station, the cold definition, kill
channels, and the unique-filenames convention; (ii) all three drift sites carry interface-level
statements with **zero** version pins and **zero** upstream line-number citations; (iii) the smoke
exists, fails on a synthetic broken reference (paired-negative), and declares its environment
honestly; (iv) principle 09 + `render-rule-index --check` green; (v) §1.7 self-check in the PR
body naming the sibling wrapper surfaces swept.

### S-B — contract v2 + shadow calibration

**Scope.** The bottom-seat check as a dispatch-input station: ADR-6's five equal classes
(K1 anchors exist · K2 quoted outputs reproduce · K3 sibling-pattern consistency · K4 format
mechanics incl. silent failure modes · K5 external-state preconditions) with **no**
primary/background split, plus K6 as a split check (executor emits candidates from a closed
verdict lexicon + the extracted non-goal declarations; the Opus framing-bias look adjudicates —
the executor arm is a candidate generator, never the decision layer). Plus the calibration ledger
(§2) and ADR-5's 5-dispatch shadow-A/B protocol with the threshold pre-registered in the ledger
header.

**Depends on** S-A (the contract is a station of the arc S-A codifies). **Tier 2** — the classes
and threshold are pre-decided, but the *shape* is not: whether the station is an `agents/*.md`
cold agent, a skill, or a kickoff section, and where it hooks into aif dispatch, is an open design
decision the spec does not fix. Under the binding tie-breaker («when unsure between Tier 1 and
Tier 2, default to Tier 2»), Tier 2.

**Design input (added 2026-07-31, post-S-A, operator-approved):** the ledger gains a sibling
artifact to design here — the cold-seat **watch-list** (continuity handoff per
[`.claude/rules/cold-seat-economy.md` §3](../../rules/cold-seat-economy.md)): at round 1 the
seat records compactly why each acceptance criterion exists and where defects previously lived;
follow-up rounds hand a FRESH narrow seat the incremental diff + scope sections + this list,
inlined in the dispatch prompt, instead of resuming a transcript-replaying agent. The rule's
§3 table carries the measurements: a fresh seat that still makes 7 file-reading turns lands at
177,105 tokens — within ~7% of the resumed 164,995 — so turn count, not input narrowness,
dominates; the protocol therefore inlines the inputs («answer without reading files»). S-B
decides the watch-list's format and durable home (PR-body section vs task comment vs ledger
row) alongside the calibration ledger it already owns.

**Acceptance.** Contract artefact exists with five equal classes and the K6 split stated including
its known false-negative class (priority labels without verdict words defeat the lexicon);
ledger file exists with the pre-registered threshold and the `shadow=absent` convention; the
protocol names who runs the shadow arm and what happens when Opus is unavailable (the run does
NOT count toward the 5); the watch-list decision from the Design-input paragraph is made and
recorded — format + durable home chosen (PR-body section vs task comment vs ledger row), with
`cold-seat-economy.md §3` updated to point at the chosen home; §1.7 self-check.

### S-C — L2 verdict stage

**Scope.** ADR-2: the population table (CC main session · CC subagent · aif-container seat ·
ZCode seat) with channel + documented degradation per row, THEN a BFR-disciplined verdict over
the full 5-option space — (i) digest-resolver hook on `subagent_type`, (ii) `skills:` frontmatter
preload via dedicated role-context skills, (iii) **no L2** (the null option is live), (iv)
custom-subagent system-prompt replacement, (v) `paths:`-scoped rules (SSOT #101). Options that
cannot reach the metered seats must say so. The R6 container re-check of the A5 sweep lines rides
here (`docker exec` into the aif container; if unreachable, record INCONCLUSIVE — never
extrapolate host semantics). **NO build until the verdict merges.**

**Depends on** S-A (not on S-B). **Tier 2** — a BFR verdict over a 5-option space is judgment by
construction. **Acceptance.** Population table complete with a channel and a degradation note per
row; verdict cites the SSOT by ID and runs the 6-item search check for any negative-existence
claim; the null option is adjudicated on the merits, not dismissed; the verdict PR states the
S-D tier with justification (§4 O-5).

### S-D — L2 build (contingent)

**Scope.** Whatever S-C selects — resolver, preload, system-prompt route — or, on the null
verdict, an L2-closure PR (retirement note + `done.md`, no build). Includes the ADR-8 baseline
capture **before** merge, the deterministic role-vs-uniform A/B branch, and the ZCode twin per the
population table. **Depends on** S-C merged. **Tier:** undetermined at authoring — S-C's verdict
PR assigns it. **Acceptance.** Baseline rows exist in the ledger BEFORE the shaping merge; the
A/B branch is a real branch in the resolver, not fail-open-by-accident; ZCode twin byte-identity
gated by the existing `plugin/hooks` pre-commit pattern; ADR-8's window (20 role-shaped
dispatches) and its owner are named in the PR body.

### S-E — L1 budget gate

**Scope.** ADR-3: the gate compares token-audit S1's measured per-channel attribution against
**per-environment** ceilings in a channel proven to block — a pre-push section + CI mirror,
error-with-escape-token (rationale ≥20 chars; precedent
[ci-tool-pinning.md §3](../../rules/ci-tool-pinning.md)). Plus the standalone verification task:
can an `InstructionsLoaded` hook return a *blocking* decision? Verify against primary docs; only a
verified-blocking result may promote the gate earlier. **Depends on** token-audit S1 merged —
cross-umbrella, see §3. **Tier 2** (gate design + ceiling derivation are judgment); reclassify to
Tier 1 only if S1's output makes the ceilings mechanical. **Acceptance.** No ceiling loads without
an environment label (the gate refuses); the escape token is tested (a rationale <20 chars fails);
the `InstructionsLoaded` verdict is recorded with its primary-source citation whichever way it
lands.

### S-F — small-fixes queue

**Scope.** Handoff decision 13, one maintenance PR at token-audit S2 time: the
`autonomous-loop-continuity.md:4` channel-marker understatement; the stale
`#autonomous-dispatch-without-park` falsifier in `pipeline/SKILL.md §5`; the aif container's
uncommitted `?? .claude/worktrees/` drift; the E-4 `claudeMdExcludes` absolute-glob hypothesis
checked at S2 acceptance. **Tier 1** — each item's «how» is one determinable sentence and the
work is expansion, not design. Marker: **YES**, value `Z.AI GLM-5.2 SDK` (re-verify uniqueness
and the fidelity precondition at dispatch per §0). **Acceptance.** Each item either fixed with
evidence or explicitly deferred with a trigger; no scope beyond the four items.

**Ordering.** S-A → {S-B, S-C} may run in parallel (disjoint surfaces: S-B writes the
contract/ledger artefacts, S-C writes a research verdict) → S-D after S-C → S-E gated on the
cross-umbrella dependency → S-F on token-audit S2 timing. Parallel stages take isolated worktrees
([parallel-subwave-isolation.md §1](../../rules/parallel-subwave-isolation.md)).

## §2 Calibration-ledger bootstrap (ADR-5 / ADR-6 / ADR-8)

Path: `.claude/orchestrator-prompts/arch-v2-context-pipeline/calibration.md`. Created by **S-B**,
appended to by every subsequent stage dispatch.

- **Header pre-registers, before any row exists:** the ADR-5 threshold — «≥2 of 5 runs in which
  Opus finds a K1/K2-class defect the bottom seat missed → the seat re-tiers to Opus (checks stay,
  tier moves)»; the ADR-8 window (20 role-shaped dispatches) and its owner; the ADR-6 re-derivation
  gate («a K-class with 0 catches across 10+ runs while costing measurable seat time may be
  demoted, with the data attached»). Pre-registration is the point: a threshold written after the
  data is not a threshold.
- **Row schema (one row per dispatch):** date · stage · task id · bottom-seat findings by K-class ·
  shadow-arm findings by K-class · diff (found-by-Opus-only) · `shadow=present|absent` ·
  verdict-affecting notes. A `shadow=absent` run (Opus quota) proceeds but does **NOT** count
  toward the 5-run cohort — silence never reads as health
  ([autonomous-loop-continuity.md §2](../../rules/autonomous-loop-continuity.md)).
- **ADR-8 baseline rows** are captured by S-D *before* the shaping merge: token cost per dispatched
  task + review-defect count over the trailing 10 uniform dispatches. **Instrument (verified live
  2026-07-31, §4 O-3):** the aif task record exposes `tokenInput`, `tokenOutput`, `tokenTotal`,
  `costUsd` — `curl -s "$RUNTIME_BRIDGE_AIF_URL/tasks" | jq -r '.[] | [.id,.status,.tokenTotal,.costUsd] | @tsv'`.
  Baseline rows name the environment (N2).
- **The ledger-row-completeness principle test (spec §6) is DEFERRED with a trigger, not shipped
  by S-B:** a test asserting «no empty-verdict rows» over a ledger with zero rows is vacuous, and a
  vacuous gate is a permanent noise floor by the same argument ADR-7 uses to drop SOLID. Trigger:
  the 5th row lands → ship the test in that stage's PR.

## §3 Cross-umbrella dependency (S-E only)

S-E consumes [`session-start-token-audit`](../session-start-token-audit/kickoff.md) S1's output:
`scripts/measure-session-start-tokens.sh` + the attribution table. **Two gates, not one:**

1. **Merged** — S1's PR is on `staging` (`gh pr list --search "session-start-token-audit" --state merged`).
2. **Content-read** — S1's own falsifier branch (its §1 S1 (iii): «if our injected set is <40% of
   the measured session-start total…») decides what S-E can honestly gate. If the falsifier fired,
   S-E's ceilings cover a minority share and the gate's scope must be re-derived before it ships —
   ADR-3's own falsifier says exactly this. Reading «S1 merged» as sufficient is `#hope-as-gate`.

This umbrella does **not** edit the token-audit kickoff (Artifact Ownership Contract — that
umbrella owns it); the dependency is declared here and re-verified at S-E dispatch.

## §4 Plan-writer objections

Recorded per the plan-writing seat's role discipline — «who must write the plan cannot
rubber-stamp the design». None is BLOCKER-grade; all are carried into the stage kickoffs as
corrections rather than left as narrative.

**O-1 (MAJOR) — spec §4 item 1 names two wrapper drifts; live verification finds three, and
mis-describes one of them.** Verified in this session against the installed upstream
(`~/.claude/plugins/cache/superpowers-dev/superpowers/{5.1.0,6.1.1,6.2.0}`):
(a) `.claude/skills/arch/SKILL.md:79` — «verified absent from upstream through v6.1.1: no
design-review skill exists there». Upstream ships `skills/brainstorming/spec-document-reviewer-prompt.md`
in **5.1.0, 6.1.1 AND 6.2.0** — a design-review artefact inside the very engine /arch wraps. The
claim is narrowly true as written (it is a prompt template, not a top-level *skill*) and
substantively misleading about /arch's §2 delta. The fix is not deleting a version pin — it is
restating the delta honestly (two *cold* seats at *fixed altitudes* with a verdict grammar +
routed exit, vs upstream's single author-dispatched spec reviewer).
(b) `night-mode/SKILL.md:15` — «two fresh reviewer subagents (spec-reviewer ≈ top-down;
code-quality-reviewer ≈ bottom-up)». SDD 6.2.0 dispatches **one** task reviewer per task
(`task-reviewer-prompt.md`, SKILL.md:238) plus **one** final code reviewer
(`../requesting-code-review/code-reviewer.md`, SKILL.md:74). A roster-*shape* drift, not a name
drift.
(c) **Unenumerated by the spec:** `night-mode/SKILL.md:29` cites «SDD lines 114–120» for the
BLOCKED handler. Stale in both versions — 6.2.0:114-120 is branch/ledger guidance, 6.1.1:114-120
is model-specification guidance; the BLOCKED handler is at 6.2.0:244. A line-number citation into
upstream internals is precisely what handoff decision 6 forbids. **Action:** S-A fixes three
sites; §1 S-A acceptance (ii) is written against three.

**O-2 (MAJOR) — the spec sells a «skill-exists-by-name smoke» as insurance against these drifts;
by construction it catches none of them.** A by-name existence check cannot evaluate a
*negative*-existence claim (a), a roster *shape* (b), or a line-number citation (c). Worse, it has
an environment problem the spec never states: upstream lives in the operator's
`~/.claude/plugins/**`, which does not exist on a GitHub runner or in the aif container — so as a
CI test it would skip silently, and a silently-skipping load-bearing check is
`#warning-nobody-reads`. **Action:** S-A ships it as a *conditional, loud* check — resolve
references when an upstream install is discoverable, emit an explicit `SKIPPED — no upstream
install at <paths>` line otherwise, and declare in the skill itself that the drift class it
actually covers is «a `superpowers:<name>` reference to a skill that no longer exists», nothing
wider. Sold honestly, it is worth shipping; sold as the mechanism for O-1, it is
`#discipline-theatre`.

**O-3 (MINOR, resolved in-plan) — ADR-8 names «token cost per dispatched task» with no
instrument.** Token-audit S1 measures session-*start* load, not per-dispatch cost, so the baseline
had no source. Probed live: the aif task record carries `tokenInput`/`tokenOutput`/`tokenTotal`/
`costUsd` (`GET $RUNTIME_BRIDGE_AIF_URL/tasks`, field list confirmed 2026-07-31). The instrument
exists; the spec simply never named it. Recorded in §2 so S-D does not re-derive it.

**O-4 (MINOR) — spec §6 asks for a ledger-row-completeness principle test «once ≥5 rows exist»,
but §4 gives it no stage.** Assigned in §2: deferred with an explicit trigger (5th row), shipped
in that stage's PR. Shipping it at S-B over an empty ledger would be a vacuous gate.

**O-5 (MINOR) — S-D's tier is unassignable at plan time** because it is a function of ADR-2's
verdict (a resolver hook and a null-outcome closure are not the same tier of work). Delegated: the
S-C verdict PR assigns S-D's tier with justification. Flagged rather than guessed, because a
guessed tier is exactly the «wrong-but-cheap plan» the tie-breaker exists to avoid.

**O-6 (MINOR, routing) — the spec's marker condition drops one of CLAUDE.md's three.** Spec §4
tail conditions the marker on «plan-complete AND the fidelity-verdict required-check precondition».
CLAUDE.md's exception reads «a Tier-2 kickoff **produced by `/arch`** AND plan-complete … dispatches
with the marker», with the precondition on top — three conditions. This track ran the /arch-*equivalent*
seats (Fable design → Opus cold critique → Opus plan) but did not invoke the `/arch` skill, and
S-A's deliverable is the rewrite *of that skill*: leaning on an exception whose authority derives
from /arch to ship /arch's own rewrite is circular. **Recommendation (applied in §1):** S-A, S-B,
S-C, S-E dispatch **without** the marker — top tier plans in aif; S-F carries it (Tier 1 by its own
criteria, marker independent of the D1 exception). Cost of being wrong: one extra planning pass.
Falsifier: if the operator rules that this contour *is* `/arch` for D1 purposes, S-A may carry the
marker with that ruling quoted in the kickoff.

**Checked and found sound (no objection):** the ADR-1 L1/L2 boundary against C1/C2; ADR-4's
K-pass-before-consumption ordering (the distiller's defect dying at the distiller's channel is
the project invariant, correctly applied); ADR-6's retraction of the 5/5→2/5 incident derivation;
ADR-7's drop-don't-relocate for SOLID; ADR-5's shadow-arm oracle (it is a real oracle — the same
input, two seats, a pre-declared threshold); §5's `shadow=absent` handling; the ADR-2 null option
being live. The stage ordering itself re-derives as feasible — see the final verdict in §1.

## §5 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps for
this umbrella: T2, T3, T7, T11, T14, T15, T16, T19, T20, T21.**

- **T2** — designing ≠ running. S-B's contract is not «shipped» until it has been *run* against a
  real dispatch input and the run is a ledger row; S-A's smoke is not shipped until it has been
  fired at a synthetic broken reference and observed RED.
- **T3** — every claim about upstream, the runtime, or a sibling surface carries a command +
  output or a `file:line` whose content is quoted. No prose-only findings in any stage PR.
- **T7** — the adversarial counter-prompt is written and run, not asserted. In this umbrella that
  is the Phase -1 cold review (§0) plus, from S-B, the bottom seat.
- **T11** — S-C's verdict runs the BFR mechanism (SSOT consult + DeepWiki + WebSearch ≥3 phrasings)
  before proposing any channel; a proposal with no search is a reject at review.
- **T14** — a clean bottom-seat or shadow run with low coverage is logged as «coverage
  insufficient», never as «input clean».
- **T15** — self-application: this pipeline designed itself, so each stage must state what
  *running the pipeline on this stage* produced (which kill channel fired, which drill-down was
  recorded), not that the pipeline exists.
- **T16** — no upstream artefact is credited by name: O-1(a) is exactly a name-vs-function
  mismatch, and S-C must write «Upstream problem class: X. Our problem class: Y. Match? evidence:»
  for every ADOPT/ADAPT it proposes.
- **T19** — own adversarial cold-QA of each stage diff before handoff; CI green ≠ design review.
- **T20** — no verdict in any stage PR body without an evidence-bearing tool call in the same turn.
- **T21** — every stage's §1.7 backward-check enumerates *sibling surfaces the diff did not touch*
  and verdicts each `SWEPT-CLEAN(evidence)` / `GAP-FOUND(action)`. A backward-check whose surface
  list equals the diff's own file list is non-conformant by format; delegate the sweep to
  [`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md), handing it the
  change *class* only.
- **T-ARCH-A (domain) — «the pipeline designed itself, therefore self-application is done».** The
  track's own provenance makes T15 feel pre-satisfied, so a stage is tempted to narrate the
  provenance instead of applying the discipline. Counter: T15 evidence is an *artefact of this
  stage* — a K-pass verdict, a ledger row, a recorded drill-down — never a sentence about how the
  spec was produced.
- **T-ARCH-B (domain) — «fix the stale wrapper claim with a fresher claim».** The cheapest repair
  for O-1 is a new version pin («absent through v6.2.0») or a new upstream line number. Both
  re-arm the same drift on the next upstream release, and decision 6 forbids both. Counter: S-A
  acceptance (ii) is mechanical — zero version pins, zero upstream line numbers at the fixed
  sites; a reviewer greps for `v[0-9]+\.[0-9]+\.[0-9]+` and `SDD lines` in the diff.
- **T-ARCH-C (domain) — «the bottom seat covers this stage».** From S-B onward it is tempting to
  cite the contract as coverage for a stage whose input was authored before the contract existed,
  or whose shadow arm was absent. Counter: §0's activation line and the ledger's
  `shadow=absent` convention — coverage is claimed per-run from a ledger row, never per-umbrella.

## See also

- [`docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md) — binding design SSOT (ADR-1..8).
- [`…-handoff.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-handoff.md) — decisions 1-13 + in-flight aif work.
- [`arch-v2-context-pipeline-s-a/kickoff.md`](../arch-v2-context-pipeline-s-a/kickoff.md) — S-A stage-scoped dispatch input.
- [`session-start-token-audit/kickoff.md`](../session-start-token-audit/kickoff.md) — the L1 umbrella S-E depends on.
- [CLAUDE.md `Task-tier routing`](../../../CLAUDE.md) · [`Pre-dispatch in-flight probe`](../../../CLAUDE.md) · [`Umbrella closure convention`](../../../CLAUDE.md) — routing, probe and `done.md` obligations.
- [kickoff-staging-placement.md](../../rules/kickoff-staging-placement.md) · [attention-is-not-a-mechanism.md](../../rules/attention-is-not-a-mechanism.md) · [build-first-reuse-default.md](../../rules/build-first-reuse-default.md).

**Closure:** the last stage to merge writes `done.md` here per the
[CLAUDE.md umbrella-closure convention](../../../CLAUDE.md) (`# arch-v2-context-pipeline — DONE` ·
`- Final PR: #<num>` · `- Closed: <YYYY-MM-DD>` · `- Summary: <one-line>`).
