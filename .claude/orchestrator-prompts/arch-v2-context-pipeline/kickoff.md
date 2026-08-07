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

> **Decision-layer spec (2026-08-06, binding for the S-D / S-D′ / S-E / S-F-item-4 / S-G rows
> below):** [`docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md`](../../../docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md)
> — resolves forks D1-D3/N1-N2, closes S-D's additive scope, reopens S-D′ subtractive, adds S-G.

| Stage | Scope (one line) | Depends on | Tier | Marker | Implements |
|---|---|---|---|---|---|
| S-A | `/arch` v2 SKILL.md rewrite + 3 wrapper-drift fixes + upstream-reference smoke | — | 2 | **NO** (§4 O-6) | §2 arc, ADR-4 |
| S-B | dispatch-input contract v2 + calibration ledger + shadow-A/B protocol | S-A | 2 | NO | ADR-5, ADR-6 |
| S-C | L2 population table + 5-option BFR verdict (null option live) | S-A | 2 | NO | ADR-2, ADR-1 |
| S-D | L2 build (ADDITIVE scope) — **CLOSED-NULL 2026-08-06** per SSOT #234; NO stage `done.md` (see charter) | S-C | — | — | ADR-2 |
| S-D′ | per-seat SUBTRACTION maps — reopened scope, operator override 2026-08-06 (#234 trigger (a) fired). **Rev 6 (2026-08-07): ADR-8's A/B arm DESCOPED per the operator's §5 = Option A → S-K; this stage ships maps + review-seat agent definitions + the #234 annotation, and a PR with no evaluation arm is conformant** | S-E + S-H + **S-L** merged (consumes P11 probe + P14 prices — now a three-gate form; S-L added 2026-08-07 because this stage RANKS levers by the P14 price list and a falsified conversion falsifies the ranking, which is the stage's entire product — spec `:363`, row P13) | 2 | **NO** (map authoring = un-spent judgment) | ADR-1 |
| S-K | **STUB, not dispatchable** — ADR-8's A/B experiment re-homed off S-D′ (rev 6, operator verdict 2026-08-07). Entry criteria + the rev-6 task-id finding are stubbed at [`../arch-v2-context-pipeline-s-d-prime/kickoff.md`](../arch-v2-context-pipeline-s-d-prime/kickoff.md) §6; scoping it is its own act | S-D′ **merged** (it evaluates what S-D′ ships) | — | — | ADR-8 |
| S-E | L1 budget gate + config-assertion asserts + `InstructionsLoaded` verification (spec P2/P3 — container-safe set after the rev-4 split; P3d/P11/P14 → S-H) | S-G **merged** (resident baseline) + token-audit S1 **merged** | 2 | YES per /arch §3 D1 exception (spec-produced, plan-complete; re-verify precondition at dispatch) | ADR-3 |
| S-F | small-fixes queue (handoff decision 13), one maintenance PR; item 4 **CONSUMED** by S-E's P2 (see charter) | token-audit S2 timing | 1 | YES (`Z.AI GLM-5.2 SDK`) | — |
| S-G | economy small-fixes 2 (spec P5-P8 + P12: `CLAUDE.md` pointer-collapse trim + traps digest + renderer/probe channel-truth fixes, rule-embed handoffs, inlined-dispatch template default, ADR-template wiring) | decision-layer spec merged (met) — **runs FIRST of the remaining stages** | 1 | YES (`Z.AI GLM-5.2 SDK`) | — |
| S-H | host-side measurements (spec P3d per-turn attribution via new `scripts/measure-turn-attribution.sh` incl. the FORK E injector line + P11 Explore/Plan probe + P14 harness-remainder price list + conditional P3c live confirmation) | re-plan merged; **UNBLOCKED from S-E** (round-4 M-6) — S-E touchpoints degrade gracefully per the stage kickoff | 1 (host-bound) | **NO — not factory-bound**: the container carries a DIFFERENT population, not an absent surface (rev 5 correction — see the FORK C note below the table) | ADR-3 (measurement arm) |
| S-L | **recalculation stage (added 2026-08-07)** — applies fork #4 = Option A in its *per-seat* form (the 4 B/token convention is falsified; a flat 2.62 is explicitly NOT the replacement), designs the fork #5 re-labelling **from scratch** (its inherited hypothesis is measured-false — see the §0 input patch), runs the residual decomposition, and re-adjudicates ADR-3's 29-39% band, which closes fork #6 | **prerequisite MET** — the #5-C measurement is committed at [`…-s-l-5c-first-turn-vs-context.md`](../../../docs/meta-factory/research-patches/2026-08-07-s-l-5c-first-turn-vs-context.md); no stage gate | 2 (host-bound) | **NO** — Tier 2, not `/arch`-produced, so the D1 plan-complete exception does not apply; the #5 naming rule and the #6 denominator are both un-spent judgment | ADR-3 (re-adjudication) |
| S-I | doctor-surfaced context-economy residue (spec §8, operator-invited expansion 2026-08-06): project+user skill-`description:` trims with trigger-inventory acceptance, plugin-`skillOverrides` probe, autosync-hook deferred-report fix; P-I3/P-I4 pre-executed in the /arch session, stage verifies | **S-G merged** (rev 5 — permitted-set collision, see Ordering) | 1 (host-bound) | **NO — not factory-bound** (same FORK C rationale); host CC session on the **MID tier** (Opus today) with `superpowers:writing-skills` + `ai-doc` loaded (operator directive 2026-08-06) | — |

> **FORK C — why S-H and S-I are host-bound (rev 5, corrected against a live container probe).**
> The earlier wording — «container lacks `~/.claude/projects`, `/context`, live CC» — is **false as
> written** and was corrected rather than re-pinned. Measured 2026-08-06:
> `docker exec aif-handoff-agent-1 sh -c 'find /home/node/.claude/projects -name "*.jsonl" | wc -l'`
> → **746**. The container has the surface; what it does not have is the **population**. The
> `claude-auth` volume is a *named* volume, not a bind of the host `~/.claude`
> (`aif-handoff/docker-compose.yml:27,75`), so those 746 transcripts are the container's own
> executor-seat sessions. S-H prices inject cost **per seat class** and S-D′ consumes it to cut the
> **expensive** seats first (decision-layer spec §0.5); the container is exactly the one cheap class.
> P14 compounds it — MCP schemas, plugin SessionStart injects, skills/agents listings and the memory
> index are the operator's configuration, so a container-side price list would be internally correct
> and answer the wrong machine (`#budget-sized-to-the-wrong-machine`,
> [destination-environment-verification.md §4](../../rules/destination-environment-verification.md)).
> S-I is host-bound for the same class of reason (`~/.claude/settings.json`, `skillOverrides`,
> `~/.claude/skills`, `~/.claude/hooks` are the operator's, not the container's).
> **Honest weak point:** P11 (do `Explore`/`Plan` load `.claude/rules`?) is the one item that *could*
> technically run in the container — it is kept host-side because the container runs a different
> runtime profile, so a container answer would describe a different harness. **Falsifier:** if a
> future container image binds the host `~/.claude` read-only AND runs the host's runtime profile,
> this rationale dies and the stages become factory-eligible — re-probe the mount before assuming it.

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

### S-D — L2 build (additive scope) — CLOSED-NULL 2026-08-06

**Closed per SSOT #234** (ADR-2's verdict: DEFER / null option adopted; re-open triggers live
in the SSOT row). Closure is THIS status edit — **explicitly NOT a stage-level `done.md`**: the
earlier «L2-closure PR (retirement note + `done.md`, no build)» instruction is RETRACTED,
because `priority-score.sh` Layer C3 treats `<umbrella>/done.md` existence alone as
WHOLE-umbrella closure (`.claude/skills/pipeline/helpers/priority-score.sh:23-25,122-126`);
the umbrella's `done.md` is written only when the LAST stage merges. ADR-8 is NOT orphaned:
its experiment protocol (baseline before merge, 20-dispatch window, deterministic A/B,
owner-closed verdict PR) is **inherited by S-D′**, now measuring subtractive shaping. Full
rationale: decision-layer spec §1.5 + P4.
**Re-homed 2026-08-07 (operator verdict, S-D′ §5 = Option A) — ADR-8's SECOND recorded
deviation.** The protocol is still not orphaned, but its host is no longer S-D′: neither the A/B's
selection mechanism nor its second falsifier metric had a home inside S-D′'s permitted set, and the
rev-6 finding that aif's task id **postdates** the dispatch prompt
(`packages/runtime-bridge/src/AifHandoffBackend.ts:231-249`) makes a parity-selected arm
unimplementable there without a two-phase dispatch redesign. The arm moves to the **S-K stub**
above; S-D′ keeps the maps. Entry criteria, unchanged from the four Phase -1 findings, are stubbed
at [`../arch-v2-context-pipeline-s-d-prime/kickoff.md`](../arch-v2-context-pipeline-s-d-prime/kickoff.md) §6.

### S-D′ — per-seat subtraction maps (reopened scope, operator override 2026-08-06)

**Scope.** NOT the old L2 — no authored per-role ambient content (#234 stands for that scope).
Author **subtraction maps**: which already-loading blocks each CC seat class DROPS — review
subagents via replacement system prompts (C2-native `agents/*.md`); Explore/Plan per S-E's P11
probe result; the senior main seat via rule channel re-scoping (the #1188 pattern). Priority
per spec §0.5: expensive CC seats first; aif executor seats deferred (cheap tokens + the
guidance gradient — a weaker executor needs MORE resident instruction), never starved. Runs
under ADR-8's inherited protocol **with the rev-4 recorded deviation** (dispatch-time parity
split over agent-definition variants, ledger-audited — the resolver branch died with S-D's
CLOSED-NULL; spec §1.5); annotates SSOT #234 (trigger (a) fired: operator-declared
expensive-seat budget exhaustion, 2026-08-06 session). **Depends on** S-E **and** S-H, each
in the two-gate form (merged + content-read — the P11 probe and the P14/P3d numbers are S-H
deliverables). Repo-side drops are ordered by the fixed `measure-always-on.sh` per-file
output; harness-side by S-H's P14 price list; unpriced blocks park (spec P13, rev 4).
**Tier 2, NO marker** — the map authoring is the un-spent
judgment. **Acceptance.** Maps state per-seat-class drops WITH per-population reach incl. the
ZCode row (ADR-2 population-table obligation); ADR-8 baseline rows exist BEFORE any map
merges; the A/B arm column + parity audit per the §1.5 deviation; the SSOT #234 annotation
lands in the same PR; every drop names its restoration
trigger. Stage kickoff: [`../arch-v2-context-pipeline-s-d-prime/kickoff.md`](../arch-v2-context-pipeline-s-d-prime/kickoff.md).

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
lands. **Extended 2026-08-06 by the decision-layer spec (binding):** + P2 config-assertion
asserts (committed-list liveness principle test with pinned `picomatch` — a capability commit
carrying a `Prior-art:` trailer + SSOT entry; local-shadow pre-push check; backstop wiring per
spec §2 item 3); + REUSE routing (wire the existing `scripts/check-alwayson-budget.sh` into
pre-push; fix `scripts/measure-always-on.sh` — BOTH blindnesses: `claudeMdExcludes` AND the
membership predicate that counts `paths:`-scoped rules as resident, spec §1.6 FORK D).
**Re-scoped by the rev-4 split (spec §1.6 FORK C):** N2 per-turn attribution, the P11
Explore/Plan probe and the P14 harness-remainder pricing are **S-H deliverables now** —
container-infeasible behind this stage's marker. **Depends on S-G merged** (the resident
baseline the ceilings derive from) + token-audit S1 (met). Stage kickoff: [`../arch-v2-context-pipeline-s-e/kickoff.md`](../arch-v2-context-pipeline-s-e/kickoff.md).

### S-F — small-fixes queue

**Scope.** Handoff decision 13, one maintenance PR at token-audit S2 time: the
`autonomous-loop-continuity.md:4` channel-marker understatement; the stale
`#autonomous-dispatch-without-park` falsifier in `pipeline/SKILL.md §5`; the aif container's
uncommitted `?? .claude/worktrees/` drift; the E-4 `claudeMdExcludes` absolute-glob hypothesis —
**CONSUMED 2026-08-06** by the decision-layer spec (P1 operator fix + S-E's P2 assert; at S2
acceptance verify the S-E assert exists instead of re-deriving the hypothesis). **Tier 1** —
each item's «how» is one determinable sentence and the
work is expansion, not design. Marker: **YES**, value `Z.AI GLM-5.2 SDK` (re-verify uniqueness
and the fidelity precondition at dispatch per §0). **Acceptance.** Each item either fixed with
evidence or explicitly deferred with a trigger; no scope beyond the four items.

### S-G — economy small-fixes 2 (added rev 2; re-planned rev 4)

**Scope.** Spec rows P5-P8 + P12: the `CLAUDE.md` pointer-collapse trim (D1, keep-list
binding), the D1b traps digest (`.claude/rules/ai-laziness-digest.md` + traps `paths:`
re-scope + anti-drift test slot 35 + renderer bookkeeping), the cold-seat-economy skill-embed
additions, the inlined-dispatch template default, the P8 channel-truth fixes (renderer dedupe
+ probe grep anchor), the ADR-template wiring. **Tier 1** — every «how» is one determinable
sentence, decided in the spec (§1.6 FORK A/B/D). Marker: **YES** (`Z.AI GLM-5.2 SDK`,
re-verify at dispatch). **Runs FIRST of the remaining stages** — it changes the resident
population S-E's ceilings derive from. **Acceptance.** Per the stage kickoff §3: resident-set
before/after table, `--check` green, anti-drift mutation shown, probe/index acceptance pair
(spec §1.6 FORK D). Stage kickoff: [`../arch-v2-context-pipeline-s-g/kickoff.md`](../arch-v2-context-pipeline-s-g/kickoff.md).

### S-H — host-side measurements (added rev 4)

**Scope.** Spec §1.6 FORK C: P3d per-turn attribution — promote the S-A kickoff's inlined
aggregator to `scripts/measure-turn-attribution.sh` (the new SSOT; the S-A kickoff stays a
historical record, read-only) and extend it with the re-write trigger classes + arrival-position
+ edit-time-injection firing rates; P11 — one measured host session each for `Explore` and
`Plan`; P14 — harness-remainder per-block price list + settings-recommendations doc;
conditional live confirmation of S-E's P3c verdict when it lands «observable».
**UNBLOCKED from S-E (round-4 M-6):** dispatchable any time after the re-plan merges,
concurrent with S-G/S-E (disjoint permitted sets); its two S-E touchpoints (P14's
P3c-verified channel; the conditional P3c live confirmation) degrade gracefully with
explicit notes when S-E has not merged. **Tier 1 (host-bound), NO
marker — not factory-bound:** the aif container mounts `claude-auth` as a named volume, not
the host `~/.claude` (`aif-handoff/docker-compose.yml:27`), so `~/.claude/projects`,
`/context` and live CC sessions are unreachable there; a host CC session executes this
kickoff. **Acceptance.** Per the stage kickoff §3; every price row names its measurement
channel or says `UNMEASURED — channel absent`; the P3d output carries the FORK E
bootstrap-injector line. Stage kickoff: [`../arch-v2-context-pipeline-s-h/kickoff.md`](../arch-v2-context-pipeline-s-h/kickoff.md).

### S-I — doctor-surfaced context-economy residue (added 2026-08-06, operator-invited)

**Scope.** Spec §8: the operator's same-day `/doctor` scan surfaced a second economy surface
(skills-listing budget ≈9.1k est. tokens vs ~2k → descriptions truncate, routing degrades) plus
host config debt. The §8 «deferred out of umbrella» disposition was SUPERSEDED by explicit
operator invitation the same day — the umbrella takes it as a stage. P-I1/P-I2 skill-`description:`
trims (trigger-inventory acceptance, P-I7), P-I5 plugin-`skillOverrides` empirical probe,
P-I6 autosync-hook deferred-report fix (hook stdout is a load-bearing channel — plain
backgrounding is `#warning-nobody-reads`), P-I8 disk sweep. P-I3 (settings.local dedupe ×21
worktrees, conditional on the committed `**/` form) and P-I4 (`uniq-rewrite: off`) were
EXECUTED in the /arch session during the 2026-08-06 Actions outage — the stage VERIFIES them.
**Host-bound, NO marker** (FORK C rationale); seat = **MID tier** (Opus today) with
`superpowers:writing-skills` + `ai-doc` loaded before the trims (operator directive).
**Acceptance.** Stage kickoff §3 + §3.5 host-verify contract (description-bytes gate ≤5,000 B +
committed trigger inventory). Stage kickoff: [`../arch-v2-context-pipeline-s-i/kickoff.md`](../arch-v2-context-pipeline-s-i/kickoff.md).

### S-L — recalculation stage (added 2026-08-07)

**Scope.** S-H shipped its measurements with three open forks, and all three move the same
numbers, so they are applied **once**, in one place. Fork **#4** = Option A in its *per-seat*
form: the 4 B/token convention is falsified and a flat **2.62 is explicitly not the
replacement** — the measured spread is at least **1.83-3.32**, driven by content type and
language, so each site either takes a per-content measurement, stops converting because a direct
count exists, or states the band with its direction of error. Fork **#5** must be designed **from
scratch**: the hypothesis that the `/context`-vs-billing gap was dispatch-prompt content is
measured-false (the `/orchestrator` injection is 13,523 tok, 44% of the gap it was invoked to
explain; seats with no dispatch prompt at all still show a 16,196-token gap), which also reopens
the *direction* of §8.5's «the gap indicts the by-difference method» — if the residual is
harness-injected session-start payload, `/context` under-reports instead. Fork **#6** (ADR-3's
29-39% band against four denominators disagreeing in direction) closes once #5 is decided.

**Prerequisite MET — no stage gate.** The #5-C measurement Option C called for was run on the
host 2026-08-07 and is committed at
[`docs/meta-factory/research-patches/2026-08-07-s-l-5c-first-turn-vs-context.md`](../../../docs/meta-factory/research-patches/2026-08-07-s-l-5c-first-turn-vs-context.md);
the stage reads it as §0 input rather than re-deriving it. **Tier 2 (host-bound), NO marker** —
not `/arch`-produced, so the D1 plan-complete exception does not apply, and both the #5 naming
rule and the #6 denominator are un-spent judgment. Host-bound for the FORK C reason: the
acceptance contract runs `scripts/measure-turn-attribution.sh`, which reads
`~/.claude/projects/**/*.jsonl`. **Ordering — binding:** must merge **before S-D′ dispatches**
(recorded as a third gate on the S-D′ row above). Not currently on the critical path, since S-D′
is also blocked on S-E, which is unmerged — **re-verify at dispatch**.

**Scope fence.** The merged S-H research patches are append-only and read-only for later sessions
(Artifact Ownership Contract): every correction lands as a **new** patch plus spec/kickoff
annotations, exactly as #1250/#1251 did, never as an edit to a merged patch.
**Acceptance.** Per the stage kickoff §3, whose first review-time bullet is the numerator-subset-
of-denominator check — the single class that consumed nine REVISE rounds on the S-H addendum.
Stage kickoff: [`../arch-v2-context-pipeline-s-l/kickoff.md`](../arch-v2-context-pipeline-s-l/kickoff.md).

**Ordering (single statement, table and prose agree — rev 4, amended by the round-4
review).** S-A → {S-B, S-C} in parallel
(disjoint surfaces) → S-D closed-null (no dispatch) → **S-G** (resident-population changes
first) → **S-E** (strict: ceilings derive from the post-S-G baseline; also gated on the
cross-umbrella token-audit S1 dependency, met). **S-H is independent** (round-4 M-6):
host-side, dispatchable any time after the re-plan merges, concurrent with S-G/S-E — its
S-E touchpoints degrade gracefully per its kickoff. **S-D′ last** (consumes S-E's fixed
meter + S-H's P11/P14/P3d numbers, two-gate form each).
**S-I runs AFTER S-G merges** (rev 5, 2026-08-06 — the rev-4 «independent, concurrent with
everything» statement is SUPERSEDED; a Phase -1 cold review falsified it). The *budget surface*
is disjoint from the rules resident set, but the *file set* is not: S-G's §2 permitted set
reserves `.claude/skills/{arch,harvest,dispatcher}/SKILL.md` and `tests/install-sh/*`
(`../arch-v2-context-pipeline-s-g/kickoff.md:117-131`), while S-I edits the `description:` field
of every `.claude/skills/*/SKILL.md` and regenerates the same snapshots. Sequencing also repairs
the arithmetic: with S-G's three skills unavailable, S-I's byte target was unreachable. S-I stays
independent of S-E and S-H (neither touches either surface); its baseline is re-measured against
post-S-G `HEAD` at stage start.
S-F rides token-audit S2 timing, independent of this chain. The rev-3 statements («S-G
concurrent with S-E» in the stage kickoffs; «S-G after S-D′» in the earlier Ordering
paragraph) are both SUPERSEDED by this one. Parallel stages take isolated worktrees
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

## §3 Dependency gating — the two-gate form (cross-umbrella for S-E; intra-umbrella for S-D′)

**The two-gate pattern below (merged + content-read) is the binding form for EVERY consumed
deliverable in this umbrella** — rev 4 applies it to S-D′'s intra-umbrella dependencies too
(S-E's fixed meter; S-H's P11 probe + P14 price list): «merged» alone is `#hope-as-gate`
when the consumed content may legitimately land `INCONCLUSIVE`.

### Cross-umbrella (S-E)

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
**Rev-4 disposition (round-4 M-3 — this objection and the §1 table said opposite things
about S-E):** the falsifier FIRED for the post-S-A world. O-6's circularity argument was
about pre-S-A stages leaning on an exception whose authority /arch's own rewrite would
create; S-A merged (#1192) and the 2026-08-06 S-E/S-G kickoffs were produced by an actual
`/arch` contour invocation (the decision-layer spec + this re-plan), so the CLAUDE.md
three-condition exception applies to them in full. O-6 stands as history for S-A/S-B/S-C
(which did dispatch without the marker); the §1 table's S-E/S-G `YES` markers are the
current truth, not a contradiction.

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
