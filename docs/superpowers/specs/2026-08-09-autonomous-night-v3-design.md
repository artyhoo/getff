<!-- scope: autonomous-night v3 design — /night-mode designed INTO the four-skill seat
     architecture. Continuation of the v2 session-bus contour (NOT a membrane fresh-take):
     inputs = arch-prep-night-v3 §1 operator directives + the r2-repaired v2 spec. Part I
     of v2 is FOLDED into this contour (routing decision §1.1). ADR Parts 1/3/4 and the
     v2 §14/§14b dispositions are NOT re-opened. -->

# Autonomous night v3 — night-mode joins the seat design

> **Status:** DRAFT — Phase-1 ideation complete (operator-in-the-loop, approach A ratified
> live), awaiting the cold two-altitude review ([arch/SKILL.md §2](../../.claude/skills/arch/SKILL.md)).
> **Extends (if ratified):** [2026-08-09-session-bus-v2.md](2026-08-09-session-bus-v2.md)
> Part I — absorbed as ratified base, its Phase-C obligations join §10 here; the v2 spec's
> §14/§14b dispositions stand un-re-litigated. Coordinates with (never forks) ADR D6–D8
> ([2026-08-09-pipeline-chips-session-bus-design.md](2026-08-09-pipeline-chips-session-bus-design.md)).
> **NOT authoritative for:** project goal — [README.md#why-this-exists](../../README.md#why-this-exists);
> chips D1/D2, handoff D6–D8, calibration D9 (merged ADR); bus grammar/addressing (v2 Part II,
> parked behind P1/F4/P4); the SDD loop and the night policy SSOT —
> [night-mode/SKILL.md](../../.claude/skills/night-mode/SKILL.md).
> **Current as of 2026-08-09.** Branch: `claude/pipeline-chips-auto-sessions-e9b6de`.

## §1 Context — operator directives (arch-prep §1, verbatim-faithful)

1. /night-mode is DESIGNED INTO the four-skill architecture (arch, pipeline, dispatcher,
   night-mode), not bolted on.
2. All four use the session bus (v2 Part-II grammar/addressing as base; probes pending).
3. Self-cleaning at a context cap: a seat reaching a defined threshold hands off /
   re-invokes itself; the v2 night-continuation ladder is the base.
4. Chips where needed (ADR Part-1 D1/D2 stand; chips never enter the bus).
5. Maximally autonomous — minimal operator relay. All standing constraints ratified in v2
   §1 remain: pointer-only · untrusted-body · bus never load-bearing · no daemons · no new
   deps · capability-check · artifacts are the durable truth.

### §1.1 Routing decision — Part I folded into v3

The v2 session left an unresolved fork (Part I → Phase C now · vs · r2 delta-check · vs ·
third review round). **Resolved: Part I folds into v3.** Grounds: v3's directive 1 amends
the same three policy surfaces Part I amends (v2 §5 — dispatcher §3 Night cell, night-mode
delta items 1 and 8); two sequential PRs over one surface set is strictly worse than one;
the handoff itself names Part I «the natural vehicle for §1's night-mode scope». The cold
review of THIS spec reads the v2 spec as input, so the r2 repairs get their delta-check for
free, without a third round over the cap. *Falsifier:* wrong if this contour stalls for
days while parks accumulate that Part-I policy would already clear — then Part I extracts
into its own PR at any moment with zero loss (the §10 work list is ordered to keep that
extraction cheap).

## §2 D-v3.1 — night is a MODE, not a fifth seat role (approach A, operator-ratified)

`/night-mode` stays the fourth SKILL but never becomes a registry ROLE. At lights-out the
existing seats (arch, dispatcher) enter night mode themselves: same role, same seat file
(`arch.json`, `dispatcher.json` — v2 §6 unchanged), with the night-mode policy layer
(envelope, fork log, backoff, morning report) applied on top.

Grounds: (a) v2 §4 records night as **availability degradation, not reassignment** of
arch §4 routing (r2 NEW-M5 — not re-litigated without new evidence); (b) night-mode is by
its own charter a thin delta over SDD ([night-mode/SKILL.md:11](../../.claude/skills/night-mode/SKILL.md))
— a night SEAT would have to own park-deciding (arch §4 duplicate) AND the factory loop
(dispatcher §2 duplicate), the exact re-description its first paragraph forbids; (c) the
operator's «several communicating self-respawning sessions» reads as instances of existing
seats surviving the night via the continuation ladder, not a new role. Rejected
alternatives: B (fourth seat role `night.json`) — duplicates two skills and adds a row to
every routing table; C (land Part I only, no lifecycle unification) — leaves directive 1
unmet. *Falsifier:* wrong if a live night shows work that belongs to NO existing seat's
charter (then a role, not a mode, is missing — revisit with the ledger as evidence).

## §3 D-v3.2 — seat lifecycle protocol (SLP), one SSOT, four pointers

The four skills currently carry divergent (or absent) birth/cleanup/retirement prose. v3
adds ONE protocol at a new home — `.claude/rules/seat-lifecycle.md` (Class C, prose
choreography; same class rationale as [arch/SKILL.md:21](../../.claude/skills/arch/SKILL.md))
— and each of the four skills gains a 3–5-line «Seat lifecycle» pointer block, never a
restatement (`#parallel-evolution-creep` counter). Anti-drift executable claim: a grep
check that all four SKILL.md files carry the pointer (channel finalized at landing per
[rule-enforcement-channel-selection.md](../../.claude/rules/rule-enforcement-channel-selection.md)).

Phases (each REUSES a settled mechanism; the protocol only sequences them):

1. **Birth.** Spawn prompt assigns role + seats-dir path (v2 §6). First turn: isolated
   worktree verified (repo-root ineligible as a seat — v2 §6 corollary;
   [parallel-subwave-isolation.md §1](../../.claude/rules/parallel-subwave-isolation.md));
   seat-file write, gated by the OFF tombstone (v2 §9); courtesy `REBIND` on role takeover.
2. **Work.** The seat's own skill. At night, the night-mode policy layer applies (§5).
3. **Self-cleaning.** Trigger and thresholds are OWNED elsewhere and only BOUND here (§4).
4. **Retirement.** Successor overwrites the seat file (last-writer-wins is the v2 §6
   takeover semantics); predecessor simply ends. Night retirement = the morning report
   (night-mode terminal condition, unchanged) + the §7 chip.

## §4 D-v3.3 — self-cleaning: bind to D6/D7/D9, add no numbers, add F4b

**Who measures:** the D7 context-arm in the Stop hook (ADR D7; S2a, gated on F10). v3
neither edits the hook nor forks its layout — D7 owns it.

**Thresholds (D6, per-window — v3 invents no numbers):** 200k window → T_soft ≈ 140k
(70%); 1M window → T_soft = 300k (the operator's floor, ~30% — degradation is observed
well before proportional exhaustion), working range past T_soft to ~500k for mechanical
tails only. All numbers provisional; D9 calibration refines them. Break at stage
boundaries, never mid-harvest; tail classifier (mechanical → finish in place; judgment →
hand off) is D6 prose, reused.

**The ladder on trigger (v2 §4, now uniform across seats):** write residue (D6 residue
discipline; dispatcher needs nothing new per its restart-safety) → successor:

- **Day:** continuation chip when `spawn_task` is invocable, else the paste 1-liner (D6).
- **Night, F4 positive:** CLI spawn of a fresh successor carrying the context package —
  the Part-3 stacked move at night (v2 §4 rung 2): successor's first-turn seat-file write
  overwrites the role, courtesy `REBIND`, predecessor retires.
- **Night, F4 negative:** auto-compact in place (rung 3) — harness-native, works with zero
  project machinery; D8's PreCompact snapshot (gated on F8) preserves state at the
  boundary; post-compaction the T_soft floor applies (defer non-trivial decisions to
  morning; context-age line on every decision record — v2 §4).

**F4 gains a second recipe — F4b (operator addition, this contour):** the Stop hook is
bash; while it cannot originate a turn in ITS OWN session (r2 NEW-M2 stands), nothing
stops it LAUNCHING a new `claude` process with the residue path as the successor's brief.
F4b probe checks, all open: (a) does a CLI-born session appear in `list_sessions` /
receive ccd messages on the desktop app (if not: the successor works but is deaf to
doorbells — acceptable, bus is not load-bearing); (b) spawn-storm guard — one successor
per trigger, debounced via the same flag-file pattern the arm uses; (c) non-daemon: the
spawned process is finite and event-born, the standing constraint holds; (d) billing —
headless `claude -p` is metered on the subscription (recorded memory), the cost shape of a
long night successor is UNVERIFIED. F4a (session itself calls the CLI) remains the other
recipe. Either positive result fills rung 2; both negative → rung 3 IS the night
mechanism and the honest else-branch of v2 §8 stands (night = evening-tail + morning
sweep).

**Degradation honesty:** until S2a lands there is no deterministic trigger — by day the
operator/`/context` serves; by night rung 3 fires regardless (auto-compact is the
harness's own). The ladder is safe at every combination of S2a/F8/F4 states; it only
loses earlier rungs.

## §5 Night topology + entry

No global lights-out state, no new state class: night mode is entered per-session by the
operator leaving a session with a night-mode mandate (today's trigger, unchanged).
Topology: dispatcher seats keep the factory loop under the item-8 standing authorization;
the top-tier seat (arch in night mode) sweeps parks under the envelope; venue-tier
degradation per v2 §4 (only the top seat is awake → it takes both question classes,
in-envelope only). Inter-seat signalling at night = Part-II doorbells WHEN its probes land;
until then pull-twins carry everything (v2 §9 matrix — already the design's property).

## §6 D-v3.4 — autonomy ceiling, stated explicitly

Two lanes, reconciling the apparent v2-floor ↔ night-mode-item-8 contradiction:

- **Pipeline lane** (implementation flow): night-mode item 8 stands as written — push,
  open PRs, squash-merge a GREEN stage PR to staging, REVISE cycles within caps. These are
  conveyor operations over work whose scope a kickoff already authorized.
- **Decision lane** (parked strategic questions): the v2 §4 envelope governs. The floor's
  «merges into shared branches» reads as *merge as the application of a night-decided
  strategic fork* — a decision that changes WHAT is being built cannot reach a shared
  branch before morning — NOT as «any merge» (else item 8 would be a contradiction rather
  than the adjacent lane). The rest of the floor is unchanged: deletions of non-generated
  artifacts, external visibility, spend beyond caps, security/permission changes,
  Artifact-Ownership-Contract crossings.

**Ceiling sentence (normative):** *night may operate the pipeline to its authorized caps
and decide parked questions inside the envelope; it may never move the goal, the floor, or
its own authorization.* The last clause is deliberately self-referential: a night seat may
not widen its own envelope at night — «maximally autonomous» must not erode the ceiling
from inside. *Falsifier:* wrong if the cold review or a live ledger surfaces a park class
where the two lanes are indistinguishable in practice — then re-cut the boundary by
decision OBJECT (what is being changed) rather than by lane.

## §7 Chips — one new edge

D1/D2 edges stand unchanged. v3 adds exactly one: at night retirement the seat emits a
capability-gated chip «Review morning report [<plan>]» pointing at the report path — a
03:00-emitted chip waits harmlessly for the morning click (property recorded at ADR D3).
Fallback without `spawn_task`: the report file itself is the named consumer (v2 §4). F9
(chip visibility/lifetime across restart) remains an honest caveat: the chip is sugar, the
report is truth. No further edges while F7/F9 stay open.

## §8 Bus verbs — none added; the review-return edge named

PARKED / REBIND / NUDGE cover the night (v2 §7); `ANSWERED` stays reserved. The edge the
operator probed — «how does a reviewer tell arch something is wrong» — is pointer-shaped
by construction: the reviewer writes a verdict ARTIFACT (GO/REVISE + file:line findings);
return path is (a) direct subagent return when the consumer itself dispatched the review
(arch §2 — no bus involved), or (b) `NUDGE ref=<report-path>` from an independent reviewer
session. Content never rides the message: messages arrive as user turns (injection-shaped,
untrusted — v2 §7); a lost content-bearing message would make the bus load-bearing; the
artifact survives restarts and enters history. Law-1 check per night use: PARKED →
morning sweep; NUDGE → the artifact's own consumer contract; REBIND → resolve-at-send.
The verb↔pull-twin executable claim is v2 §9's, inherited, not duplicated.

## §9 Corpus-vs-envelope validation (v2 §4 obligation — run 2026-08-09, this session)

Corpus: `## Parked questions` sections of PRs #1317 #1315 #1311 #1302 #1292 #1290 #1289 +
#1284's six forks (fetched via `gh pr view`, this session). 25 entries; 2 informational
(#1290.3 declared-deviations record, #1290.5 W-4 attribution flag), 2 environment-class,
21 night-arch decision-bearing.

| Class | Count | Members |
|---|---|---|
| In-envelope (night decides, records, reversible) | 10 | #1311.1 install-depth, #1311.2 `--refresh`, #1311.4 `aif-version`, #1302.4 inject-coverage, #1292.2 park-visibility, #1290.4 residual-I2 defer, #1284 Park-1/2/4/5 |
| Floor — reserved-by-construction | 8 | #1317+#1315 shared-config+spend (`defaultPlanRuntimeProfileId`), #1311.3 + #1302.3 maintainer-owned files (Ownership Contract), #1290.1 Tier-0 swap (kickoff-reserved), #1289.1+.2 new-PR scope invites (CLAUDE.md PR strategy), #1284.3 taste fork |
| Floor — scope/intent class | 3 | #1292.1 re-opens stage scope, #1290.2 KICKOFF-AMBIGUOUS → kickoff re-design, #1284.6 sibling-set scope widening |
| Environment (dispatcher/aif-doctor class, not a night-arch park) | 2 | #1302.1 lychee chip, #1302.2 container image |

**Verdict (directional):** ~10/21 in-envelope — the night seat autonomously clears about
half the decision-bearing corpus; the floored half splits into reserved-by-construction
items (no envelope re-negotiation can or should move them — they are the project's own
contracts) and genuine intent-class forks (exactly what the pre-built decision package is
for). The night win is real; the envelope stands without re-negotiation. **Population
caveat (NEW-M6, carried):** this is a PR-body proxy for the aif-store population; the
first live night ledger re-runs this classification on live store parks.

## §10 Work list — Phase C v3, one PR

1. Three policy surfaces in ONE change (v2 §5): dispatcher §3 Night cell (bus-free wording
   NEW-M1) + night-mode delta items 1 and 8 — item 8 additionally gains the §6 two-lane
   paragraph.
2. New `.claude/rules/seat-lifecycle.md` (Class C) + the four pointer blocks + the
   all-four-carry-the-pointer grep claim.
3. `<plan>.decisions.md` entry-shape extension + morning-report «bus anomalies» section
   (v2 §4).
4. Morning-report chip paragraph in night-mode's terminal condition (§7).
5. Supersession pointer into ADR Part-2 (same PR) + `/self-reflection` run on the
   discipline change at landing.
6. F4 probe task updated to carry both recipes (F4a + F4b with its four checks, §4).

Explicitly NOT in scope: probes P1/P4/F4 execution (separate tasks — operator directive);
S2a/S2b (own stages behind F10/F8); Part-II recipes (behind probes); any hook edit (zero,
as in v2 post-r2).

## §11 Pre-mortem & falsifiers (beyond the per-decision ones above)

- Wrong if the SLP rule file becomes a fifth description of the loop instead of a
  sequencer of settled mechanisms — the counter is its NOT-authoritative-for header
  listing every owner it points at (D6/D7/D8, v2 §6/§9, night-mode, SDD).
- Wrong if F4b's spawn-storm guard proves insufficient (successor itself crosses T_soft
  and spawns again in a loop) — bounded by debounce-per-trigger + the morning report
  counting births; ≥3 births per night per role is an anomaly line.
- Wrong if per-session night entry (no global state) leaves a seat un-mandated that the
  operator believed was covered — the morning report's coverage line (which seats ran)
  makes the gap visible next morning; if it recurs, revisit a lights-out artifact then.
- 6-item negative-existence check NOT run on «no upstream seat-lifecycle protocol exists»
  — not claimed; the SLP is a sequencing of in-repo mechanisms, no BUILD verdict needed
  (no new capability, no code). Stated per [phase-research-coverage.md](../../.claude/rules/phase-research-coverage.md).

## §12 Self-application note

The design's own failure ordering: design-time (mode-not-seat kills the duplicate-owner
class; Law 1 re-checked per verb use) → landing-time (grep claim on the four pointers;
/self-reflection on the discipline change) → run-time (ladder degrades rung by rung, each
rung harness-native or artifact-backed) → morning report (named consumer of every anomaly
this spec introduces) → operator gate. The spec was itself produced by the contour it
extends: operator-ratified forks recorded with falsifiers in place (H1), corpus validation
run BEFORE the policy text lands, and the cold two-altitude review reads this file plus
the v2 spec — giving the r2 repairs their delta-check inside v3's own gate.
