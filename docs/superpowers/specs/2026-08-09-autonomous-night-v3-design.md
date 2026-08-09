<!-- scope: autonomous-night v3 design — /night-mode designed INTO the four-skill seat
     architecture. Continuation of the v2 session-bus contour (NOT a membrane fresh-take):
     inputs = arch-prep-night-v3 §1 operator directives + the r2-repaired v2 spec. Part I
     of v2 is FOLDED into this contour (routing decision §1.1). ADR Parts 1/3/4 and the
     v2 §14/§14b dispositions are NOT re-opened. Lineage: draft fe0e018bc2 → this r1
     revision absorbing two cold REVISE verdicts (top-down: 2 BLOCKER / 7 MAJOR / 6 MINOR;
     bottom-up: 1 BLOCKER / 3 MAJOR / 6 MINOR). Review reports are session-ephemeral
     scratchpad files; every finding's disposition is inlined in §13 (r1) and §13b (r2). -->

# Autonomous night v3 — night-mode joins the seat design

> **Status:** PHASE-B ROUND-2 REPAIRED — the r2 cold verification returned REVISE at the
> 2-round cap ([arch/SKILL.md §2](../../../.claude/skills/arch/SKILL.md)) with the design
> spine verified sound (21/23 r1 dispositions DISCHARGED, both BLOCKERs closed, object cut
> independently re-tested on three corpus members); the residue (2 landing-scope MAJORs +
> 7 text MINORs) is repaired in this text (§13b).
> **Extends (if ratified):** [2026-08-09-session-bus-v2.md](2026-08-09-session-bus-v2.md)
> Part I — absorbed as ratified base, its Phase-C obligations join §10 here; the v2 spec's
> §14/§14b dispositions stand un-re-litigated, EXCEPT one explicit supersession: the v2 §4
> floor clause «merges into shared branches» is re-cut by object in §6 (pointer added to v2
> at landing — never a silent contradiction). Coordinates with (never forks) ADR D6–D8
> ([2026-08-09-pipeline-chips-session-bus-design.md](2026-08-09-pipeline-chips-session-bus-design.md)).
> **NOT authoritative for:** project goal — [README.md#why-this-exists](../../../README.md#why-this-exists);
> chips D1/D2, handoff D6–D8, calibration D9 (merged ADR); bus grammar/addressing (v2 Part II,
> parked behind P1/F4/P4); the SDD loop and the night policy SSOT —
> [night-mode/SKILL.md](../../../.claude/skills/night-mode/SKILL.md); seat-retirement
> cost economy — the dispatcher/harvest «re-write-trigger economy» blocks
> ([dispatcher/SKILL.md](../../../.claude/skills/dispatcher/SKILL.md) §«Seat retirement»).
> **Current as of 2026-08-09.** Branch: `claude/pipeline-chips-auto-sessions-e9b6de`.

**Terminology (r1, TD-m6):** in this spec «seat» means a REGISTRY ROLE (a long-lived
role-bearing session with a v2 §6 role file). The review-altitude «seats» of
[arch/SKILL.md §2](../../../.claude/skills/arch/SKILL.md) and the audit «seats» of
[cold-seat-economy.md](../../../.claude/rules/cold-seat-economy.md) are different usages;
the SLP (§3) binds only registry roles.

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
review of THIS spec read the v2 spec as input — a COHERENCE check of the r2 repairs (both
round-1 seats ran it and spot-checked repairs present), not a per-finding discharge audit
(r1 honesty, TD-m2). *Falsifier:* wrong if this contour stalls for days while parks
accumulate that Part-I policy would already clear — then Part I extracts into its own PR
at any moment with zero loss (the §10 work list is ordered to keep that extraction cheap).

## §2 D-v3.1 — night is a MODE, not a fifth seat role (approach A, operator-ratified)

`/night-mode` stays the fourth SKILL but never becomes a registry ROLE. At lights-out the
existing seats enter night mode themselves: same role, same registry identity, with the
night-mode policy items applied on top (the item-mapping is §5's — not all eight items
bind every seat class; r1, TD-M3).

**Roles enumerated (r1, TD-M4): exactly three** — arch, pipeline, dispatcher; their seat
files `arch.json` / `pipeline.json` / `dispatcher.json` are the Part-II-gated registry
mechanism per §3 (v2 §6; v2 §14 «three seat files total»; r2 N4 — the file vocabulary is
gated everywhere, including here). Night does not add a fourth role.

Grounds: (a) v2 §4 records night as **availability degradation, not reassignment** of
arch §4 routing (r2 NEW-M5 — not re-litigated without new evidence); (b) night-mode is by
its own charter a thin delta over SDD ([night-mode/SKILL.md:11](../../../.claude/skills/night-mode/SKILL.md))
— a night SEAT would have to own park-deciding (arch §4 duplicate) AND the factory loop
(dispatcher §2 duplicate), the exact re-description its first paragraph forbids; (c) the
operator's «several communicating self-respawning sessions» reads as instances of existing
seats surviving the night via the continuation ladder, not a new role. Rejected
alternatives: B (fourth seat role `night.json`) — duplicates two skills and adds a row to
every routing table; C (land Part I only, no lifecycle unification) — leaves directive 1
unmet. *Falsifier:* wrong if a live night shows work that belongs to NO existing seat's
charter (then a role, not a mode, is missing — revisit with the ledger as evidence).

## §3 D-v3.2 — seat lifecycle protocol (SLP), one SSOT, four pointers, STAGED

The four skills currently carry divergent (or absent) birth/cleanup/retirement prose. v3
adds ONE protocol at a new home — `.claude/rules/seat-lifecycle.md` — and each of the
four skills gains a 3–5-line «Seat lifecycle» pointer block, never a restatement
(`#parallel-evolution-creep` counter).

**Rule-file obligations (r1, TD-M2 + BU-MINOR-1; r2 N2/N3):** Class **B** (the
compensating mechanism — the all-four-carry-the-pointer grep check — ships in the same
PR; Class C «prose-only» would be false). Channel per [principle 31](../../../packages/core/principles/31-rule-channel-declaration.ts):
`paths:` frontmatter (branch (a), read-time load on matching work) over the four SKILL.md
files of the architecture — three seat roles + the night-mode layer. Promotion criterion:
≥2 incidents in 6 months of a lifecycle phase silently skipped by a live seat → promote
the grep check to a principle test. Landing obligations in §10: `render-rule-index.mjs
--write` regen + the r2-verified ceiling fact: the 4KB index is already at 4088/4096
bytes, so landing REQUIRES freeing a row's worth of bytes first — trim verbose `Fires:`
lines (the renderer's own stated remedy) or raise the constant with recorded reasoning;
an operator-visible choice at landing, not a silent bump (r2 MAJOR-1).

**Phases — each REUSES a settled mechanism, and bus-touching steps are explicitly
PART-II-GATED (r1, TD-M1: the SLP ships nothing parked as normative-now):**

1. **Birth.** NOW: spawn prompt assigns the role; first turn verifies an isolated
   worktree — repo-root sessions are ineligible as seats (owner: v2 §6 corollary;
   background: [parallel-subwave-isolation.md §1](../../../.claude/rules/parallel-subwave-isolation.md)
   for the parallel-session class — the seat-specific invariant is v2's, r1 BU-MINOR-5).
   PART-II-GATED (activates when P1/F4/P4 land Part II): seat-file write gated by the OFF
   tombstone (v2 §9) + courtesy `REBIND` on role takeover.
2. **Work.** The seat's own skill; at night, the §5 night-mode item mapping applies.
3. **Self-cleaning.** Trigger and thresholds are OWNED elsewhere and only BOUND here (§4).
4. **Retirement.** NOW: artifact handoff (D6 residue discipline); at NIGHT-END (terminal,
   not mid-night — r1 TD-M7) the closing seat writes the morning report and emits the §7
   chip. PART-II-GATED: successor's seat-file overwrite (last-writer-wins, v2 §6).

**Cost owner (r1, BU-MAJOR-3):** the handoff-vs-compact preference is ALREADY owned by
the «re-write-trigger economy» blocks in [dispatcher/SKILL.md](../../../.claude/skills/dispatcher/SKILL.md)
and [harvest/SKILL.md](../../../.claude/skills/harvest/SKILL.md) (prefer artifact handoff
to a fresh seat over `/compact`; do not stretch across the cache TTL). The §4 ladder's
rung ordering (2 preferred over 3) AGREES with it; the SLP file cites those blocks as an
owner in its NOT-authoritative-for header. *Pre-existing defect, flagged not fixed here
(out of scope):* those blocks carry `spec-of: cold-seat-economy.md §3`, but that section
does not contain the cited content — routed as an observation in the landing PR's
`## Parked questions`, owner decides.

## §4 D-v3.3 — self-cleaning: bind to D6/D7/D9, add no numbers; F4 probes re-scoped

**Who measures:** the D7 context-arm in the Stop hook (ADR D7; stage S2a). v3 neither
edits the hook nor forks its layout — D7 owns it. **Gating corrected (r1, TD-M5):** F10
gates only the shipped WORDING of the arm (ADR §6 S2a row); the operator-only alternative
is one capability check (ADR D7 audience bullet) — S2a is NOT hostage to the audience
fork, and the S2a stage should note that.

**Thresholds (D6 verbatim — v3 invents no numbers and adds no glosses, r1 TD-m1 +
BU-MINOR-2):** 200k window → T_soft 70% (~140k), working range up to auto-compact; 1M
window → T_soft 300k (provisional, operator floor), working range up to ~500k
(provisional), esp. mechanical tails. All numbers provisional; D9 calibration refines
them. Break at stage boundaries, never mid-harvest; the tail classifier (mechanical →
finish in place; judgment → hand off) is D6 prose, reused.

**The ladder on trigger (v2 §4, now uniform across seats):** write residue (D6 residue
discipline; dispatcher needs nothing new per its restart-safety) → successor:

- **Day:** continuation chip when `spawn_task` is invocable, else the paste 1-liner (D6).
- **Night, F4 positive:** CLI spawn of a fresh successor carrying the context package —
  the Part-3 stacked move at night (v2 §4 rung 2); the successor's registry effects are
  Part-II-gated per §3.
- **Night, F4 negative:** auto-compact in place (rung 3) — harness-native, works with
  zero project machinery; D8's PreCompact snapshot (gated on F8) preserves state at the
  boundary when it lands; post-compaction the T_soft floor applies (defer non-trivial
  decisions to morning; context-age line on every decision record — v2 §4).

**Ladder honesty (r1, TD-M5 — replaces the overstated «safe at every combination»):** the
ladder never makes things WORSE than today, but its weakest cell is real: F4-negative +
F8-open, post-auto-compact — no snapshot exists, the D7 debounce flag is spent (ADR D7:
no second reminder), and the T_soft defer-discipline has no live predicate (post-compact
usage is below T_soft by construction). In that cell the guards are only the context-age
line on decision records and the morning review. Named here so the operator prices it;
S2b (F8) and the F4 probes are what close it. What v3 SHIPS for directive 3 is the
trigger-CONSUMING policy (the SLP binding + this section); the trigger itself is S2a's
stage — stated plainly (r1, TD-M5).

**F4 — two recipes, BOTH PROBES, zero landings in this contour (r1, TD-B1 + BU-MAJOR-2):**

- **F4a:** the seat session itself calls the CLI to spawn a successor.
- **F4b (operator addition):** a Stop-hook-launched successor. The hook is bash
  (`end-of-turn-reminder.sh:1`) and launching a process is not originating a turn — r2
  NEW-M2 stands untouched. BUT the shipped Stop hook is **D7-owned and consumer-shipped**
  (`install.sh` registers it for consumers), so F4b is probed OUTSIDE shipped surfaces
  (a throwaway local hook in a scratch project). A positive F4b still does NOT land in
  this PR — hook edits are a separate D7-owner stage — but the AUDIENCE half of that
  fork is DECIDED by operator directive (2026-08-09, this session, post-cap): shipping
  self-cleaning autonomy to consumers is the framework's product intent («для этого и
  делаем»), so the landing default is CONSUMER-SHIPPED, with the standing engineering
  guards non-negotiable (capability-check for the CLI, OFF-tombstone kill switch,
  per-trigger debounce, graceful no-op when the CLI or the capability is absent);
  installing the framework is the opt-in surface ([dual-implementation-discipline.md §3](../../../.claude/rules/dual-implementation-discipline.md)
  consumer-facing default). The narrower F10 wording fork on the D7 arm formally closes
  at S2a, with this directive recorded as evidence toward its consumer-generic branch.
  **v3's shipped scope contains ZERO hook edits; v2 §8's «no hook edits remain anywhere
  in this design» stands for everything this PR lands.**
- **Probe checks (both recipes):** (a) is a CLI-born session visible in `list_sessions` /
  reachable by ccd messages (if not: the successor works but is deaf to doorbells —
  acceptable, the bus is not load-bearing); (b) spawn-storm guard — one successor per
  trigger, debounced via the flag-file PRECEDENT at `end-of-turn-reminder.sh:282` (the
  story flag; the D7 arm itself is not shipped yet — r1 BU-MAJOR-2); the chain-spawn
  daemon-shape question is NAMED as probe output, not assumed away: successive successors
  each spawning at their own T_soft form a bounded chain (each birth requires real
  context consumption), but whether that satisfies the «no daemons» constraint is the
  operator's classification call on the probe's evidence; ≥3 births per night per role is
  a morning-report anomaly line; (c) **billing — LIVE-VERIFIED 2026-08-09 (operator
  challenge → web verification; supersedes both the draft's claim and r1's memory-based
  «correction»):** the announced 2026-06-15 separate Agent-SDK credit pool was PAUSED on
  its own effective date and never took effect — per the official support article «Use
  the Claude Agent SDK with your Claude plan», `claude -p` / Agent-SDK / third-party
  usage still draws from the SUBSCRIPTION's usage limits, the same pool as interactive
  seats. Consequence: no collision with the «run it on the subscription» posture
  ([night-mode/SKILL.md](../../../.claude/skills/night-mode/SKILL.md) delta item 7); the
  r1 cost-GO gate is RETIRED. What remains is cost-awareness, not a gate: night
  successors consume the shared subscription quota (item 3's quota backoff already
  governs), and Anthropic promised advance notice before any future billing change — a
  future change RE-OPENS this check (falsifier recorded here, not hoped away).
  (d) an F4-positive also re-opens the v2 §7 «recipes-ONLY» conditionality and the §9
  claim-1 scope, per v2 NEW-N2 — carried, not silently dropped (r1, TD-m3).

**Degradation honesty:** until S2a lands there is no deterministic trigger — by day the
operator/`/context` serves; by night rung 3 fires regardless (auto-compact is the
harness's own). The ladder loses rungs gracefully at every combination of S2a/F8/F4
states; the weakest cell is priced above.

## §5 Night topology, entry, and the night-mode item mapping

No global lights-out state, no new state class: night mode is entered per-session by the
operator leaving a session with a night-mode mandate (today's trigger, unchanged).

**Topology:** dispatcher seats keep the factory loop under the item-8 authorization; the
top-tier seat (arch in night mode) sweeps parks under the envelope; venue-tier
degradation per v2 §4. **/pipeline is a DAY seat by policy (r1, TD-M4):** authoring NEW
scope (kickoffs, umbrellas) is intent-class — floored at night by the same envelope that
floors intent parks; the pipeline seat carries the SLP pointer and (Part-II-gated) bus
participation, and its night delta is exactly one line: «no new-scope planning at night»
— a FOURTH policy surface, billed in §10.1 (r2 MAJOR-2: previously normative here but
landing nowhere). Inter-seat signalling at night = Part-II doorbells WHEN its probes
land; until then pull-twins carry everything (v2 §9 matrix).

**Night-mode item mapping for non-SDD seats (r1, TD-M3 — the «policy layer» named
precisely, T16 counter; r2 N1 — all eight items now enumerated):** upstream problem class
of night-mode items 2/4/6/7 is the unattended IMPLEMENTATION run (SDD loop: increments,
commits, advisor); the night ARCH seat runs an unattended DECISION sweep — a different
class, so those items do not transfer. What binds EVERY night seat: item 1 (fork policy),
item 3 (quota backoff), item 5 (verification discipline — empirical over inferred binds
any unattended claim-maker), item 8 (standing authorization + escalation list), and the
morning report. Items 2/4/6/7 bind only seats actually running the implementation loop
(dispatcher-driven factory work). This mapping lands as one clarifying sentence in
night-mode/SKILL.md (§10 item 1), so the skill itself says which items bind which seat
class.

## §6 D-v3.4 — autonomy ceiling: the floor fires on the decision's OBJECT

r1 REPLACEMENT (TD-B2: the draft's lane-cut failed on the spec's own corpus — #1311.4 is
an in-envelope decision whose application rides a stage PR; a night squash-merge of that
green PR was simultaneously authorized by the pipeline lane and floored by the decision
lane). The cut is now by OBJECT — the surface the decision's application touches and
whose scope authority covers it — never by lane or git operation:

- **Object INSIDE a kickoff-authorized stage scope** (the night decision only picks among
  options the stage already owns — e.g. #1311.4's remove-vs-keep of a field in shipped
  payload files): conveyor. The change rides the stage PR; the item-8 merge
  authorization applies. Precondition: the decision is recorded (decisions.md entry + PR
  `## Parked questions`) BEFORE the merge; reversibility = a pointed-at revert on
  staging, visible to morning review.
- **Object OUTSIDE any authorized stage scope** — shared standing config (#1317's
  `defaultPlanRuntimeProfileId`), maintainer-owned artifacts (Ownership Contract), new
  PRs / scope widening (#1289), spend, security/permissions, the goal: floor. Parked with
  the pre-built decision package, regardless of which PR could carry the change.
- **Independent floor axes unchanged:** genuine owner-forks (taste — #1284.3) stay
  floored by night-mode item 1 regardless of object; deletions of non-generated
  artifacts and externally-visible actions stay floored as in v2 §4.
- **Precedence (r2 N5):** floor categories DOMINATE stage-scope membership — an object
  that is simultaneously inside a stage's scope AND in a floor category (live case:
  #1311.3, a maintainer-owned file whose fix the stage could technically carry) is
  FLOORED. Stage-scope authorizes only what no floor category claims.

**Supersession, explicit (r1, TD coherence-2 — no silent contradiction):** this re-cuts
the v2 §4 floor clause «merges into shared branches» (a git-operation criterion) into the
object criterion above. The landing PR adds a one-line pointer at that v2 clause →
this §6 ([doc-authority-hierarchy.md §4](../../../.claude/rules/doc-authority-hierarchy.md)
`#contradicting-authority-claims` counter). All other v2 floor items are unchanged.

**night-mode item 8 quoting corrected (r1, BU-MINOR-3):** item 8's clause (c) («push,
open PRs, and squash-merge to `staging`») stands as written; the GREEN/stage-PR bounds
live in the skill's Terminal-condition paragraph and are unchanged; item 8's escalation
list («any parked owner-fork») is AMENDED by §10 item 1 to cross-reference the object
cut — so «stands as written» applies to (c) only, and the amendment is named, not
smuggled.

**Ceiling sentence (normative):** *night may operate the pipeline to its authorized caps
and decide parked questions inside the envelope; it may never move the goal, the floor,
or its own authorization.* The last clause is self-referential by design: a night seat
may not widen its own envelope at night. *Falsifier:* wrong if a live ledger surfaces a
decision whose object-scope classification is itself ambiguous at 3am — then the tie
rule is «ambiguous object → floor» (conservative default, added to the night-mode text
at landing).

## §7 Chips — one new edge, night-end only

D1/D2 edges stand unchanged. v3 adds exactly one: at NIGHT-END terminal retirement (the
seat that writes the morning report — never at mid-night handoff retirements, r1 TD-M7)
the closing seat emits ONE capability-gated chip per plan: «Review morning report
[<plan>]», pointing at the report path — a 03:00-emitted chip waits harmlessly for the
morning click (ADR D3). Mid-night successors inherit the mandate and emit nothing.
Fallback without `spawn_task` — likely for a CLI-born terminal seat (§4 probe check (a);
r1 TD-m5): the report file itself; naming it the fallback consumer is THIS spec's own
extension (r1, BU-MINOR-6 — v2 §4's named consumer covers bus anomalies, not this chip).
F9 (chip visibility/lifetime across restart) remains an honest caveat: the chip is sugar,
the report is truth. **Park-chip interaction (r1, TD-m4):** a night-decided park may
strand an unclicked park-chip; the deciding seat best-effort `dismiss_task`s it, D4's
report-and-stop bounds the stale-click, and the morning report lists night-decided parks
so a stale chip is recognizable.

## §8 Bus verbs — none added; the review-return edge named

PARKED / REBIND / NUDGE cover the night (v2 §7); `ANSWERED` stays reserved. The
review-return edge («how does a reviewer tell arch something is wrong»): the reviewer
writes a verdict ARTIFACT (GO/REVISE + file:line findings); return path is (a) direct
subagent return when the consumer itself dispatched the review (arch §2 — no bus
involved; session-ephemeral scratchpad reports live ONLY on this path), or (b) from an
independent reviewer session, `AIF-BUS v1 NUDGE role=<sender-role> ref=<relative-path>`
(verb quoted in full — r1, TD-M6) where the report artifact MUST live at an allowlisted
relative layout (v2 §7 receive checks: `ref` relative, no `..`) — the coordination dir's
`session-bus/` tree or an in-repo path; an absolute scratchpad path is not NUDGE-able by
construction. Content never rides the message (v2 §7 injection posture). Law-1 check per
night use: PARKED → morning sweep; NUDGE → the artifact's own consumer contract; REBIND
→ resolve-at-send. The verb↔pull-twin executable claim is v2 §9's, inherited.

## §9 Corpus-vs-envelope validation (v2 §4 obligation — run 2026-08-09, this session)

Corpus: `## Parked questions` sections of PRs #1317 #1315 #1311 #1302 #1292 #1290 #1289 +
#1284's six forks (fetched via `gh pr view`, this session; independently re-fetched and
verified by the round-1 bottom-up seat — arithmetic and membership confirmed). 25
entries; 2 informational (#1290.3 declared-deviations record, #1290.5 W-4 attribution
flag), 2 environment-class, 21 night-arch decision-bearing.

| Class | Count | Members |
|---|---|---|
| In-envelope (night decides, records, reversible) | 10 | #1311.1 install-depth, #1311.2 `--refresh`, #1311.4 `aif-version`, #1302.4 inject-coverage, #1292.2 park-visibility, #1290.4 residual-I2 defer, #1284 Park-1/2/4/5 |
| Floor — reserved-by-construction | 8 | #1317+#1315 shared-config+spend (`defaultPlanRuntimeProfileId`), #1311.3 + #1302.3 maintainer-owned files (Ownership Contract), #1290.1 Tier-0 swap (kickoff-reserved), #1289.1+.2 new-PR scope invites (CLAUDE.md PR strategy), #1284.3 taste fork |
| Floor — scope/intent class | 3 | #1292.1 re-opens stage scope, #1290.2 KICKOFF-AMBIGUOUS → kickoff re-design, #1284.6 sibling-set scope widening |
| Environment (dispatcher/aif-doctor class, not a night-arch park) | 2 | #1302.1 lychee chip, #1302.2 container image |

Soft edge, recorded (r1, BU): #1302.3 is floored as «maintainer-owned» though only its
`.claude/rules/` half is contract-listed; its hook half is floored as shipped-surface
caution — same cell, softer ground.

**Verdict (directional):** ~10/21 in-envelope — the night seat autonomously clears about
half the decision-bearing corpus; the floored half splits into reserved-by-construction
items (no envelope re-negotiation can or should move them — they are the project's own
contracts) and genuine intent-class forks (exactly what the pre-built decision package is
for). The night win is real; the envelope stands without re-negotiation. The §6 object
cut was re-checked against all 10 in-envelope members: each one's application object sits
inside its stage's authorized scope. **Population caveat (NEW-M6, carried):** this is a
PR-body proxy for the aif-store population; the first live night ledger re-runs this
classification on live store parks.

## §10 Work list — Phase C v3, one PR (ordered: [Part-I] items first, so extracting
Part I alone stays cheap — §1.1; r2 N7)

1. **[Part-I]** FOUR policy surfaces in ONE change (r2 MAJOR-2 — the v2 §5 three plus
   v3's fourth): dispatcher §3 Night cell (bus-free wording NEW-M1) + night-mode delta
   items 1 and 8 — item 8 gains the §6 object-cut paragraph + the ambiguity tie rule —
   + pipeline/SKILL.md one-line night delta («no new-scope planning at night», §5);
   night-mode also gains the §5 one-sentence item mapping.
2. **[Part-I]** `<plan>.decisions.md` entry-shape extension + morning-report «bus
   anomalies» section (v2 §4).
3. **[Part-I]** Supersession pointer (r1, BU-MINOR-4): one-line pointer AT the v2 §4
   floor clause → this §6 (the only supersession this PR performs); the ADR Part-2/D5
   pointer belongs to Part-II ratification and is NOT this PR's (the arch-prep handoff's
   listing of it under Phase-C is resolved explicitly here, not silently dropped).
   Plus `/self-reflection` on the discipline change at landing.
4. **[v3]** New `.claude/rules/seat-lifecycle.md` — Class B, `paths:` channel (principle
   31 branch (a)) over the four SKILL.md files, promotion criterion as §3 — + the four
   pointer blocks + the all-four-carry-the-pointer grep claim + `render-rule-index.mjs
   --write` regen, PRECEDED by freeing index bytes (r2 MAJOR-1: 4088/4096 spent — trim
   verbose `Fires:` lines per the renderer's remedy, or raise the constant with recorded
   reasoning; operator-visible either way).
5. **[v3]** Morning-report additions in night-mode's terminal condition: the §7 chip
   paragraph (night-end only, one per plan) + the night-decided-parks listing line + the
   best-effort `dismiss_task` note (r2 N6 — previously §7 commitments unbilled).
6. **[v3]** F4 probe task updated: F4a + F4b as PROBES with the §4 checks (incl. the
   live-verified billing fact — subscription pool, the 2026-06-15 credit-pool policy
   paused on its effective date; cost-GO gate retired); any landing = a new operator
   fork routed to the D7 owner. Zero hook edits in this PR.
7. **[v3]** Observation routed to owner (not fixed here): the dispatcher/harvest
   re-write-trigger blocks cite `cold-seat-economy.md §3` for content that section does
   not carry (r1, BU-MAJOR-3 adjacent).

Explicitly NOT in scope: probes P1/P4/F4 execution (separate tasks — operator directive);
S2a/S2b (own stages; F10 gates only S2a's shipped wording); Part-II recipes and registry
effects (behind probes; SLP marks them PART-II-GATED); any hook edit (zero, as in v2
post-r2 — F4b notwithstanding, per §4).

## §11 Pre-mortem & falsifiers (beyond the per-decision ones above)

- Wrong if the SLP rule file becomes a fifth description of the loop instead of a
  sequencer of settled mechanisms — the counter is its NOT-authoritative-for header
  listing every owner it points at: D6/D7/D8, v2 §6/§9, night-mode, SDD, and the
  dispatcher/harvest re-write-trigger economy blocks (r1, BU-MAJOR-3 closed the gap this
  falsifier itself had).
- Wrong if F4b's spawn-storm guard proves insufficient — bounded by debounce-per-trigger
  + the morning report counting births; ≥3 births per night per role is an anomaly line;
  the daemon-shape classification stays the operator's call on probe evidence (§4).
- Wrong if per-session night entry (no global state) leaves a seat un-mandated that the
  operator believed was covered — the morning report's coverage line (which seats ran)
  makes the gap visible next morning; if it recurs, revisit a lights-out artifact then.
- Wrong if the object cut (§6) is ambiguous at 3am on a live park — tie rule «ambiguous
  object → floor» is the conservative default, and the ledger records the ambiguity for
  a morning re-cut.
- 6-item negative-existence check NOT run on «no upstream seat-lifecycle protocol exists»
  — not claimed; the SLP is a sequencing of in-repo mechanisms, no BUILD verdict needed
  (no new capability, no code). Stated per [phase-research-coverage.md](../../../.claude/rules/phase-research-coverage.md).

## §12 Self-application note

The design's own failure ordering: design-time (mode-not-seat kills the duplicate-owner
class; Law 1 re-checked per verb use; the object cut replaced the lane cut when its own
falsifier fired on the spec's own corpus — TD-B2) → landing-time (grep claim on the four
pointers; principle 31 + index regen; /self-reflection) → run-time (ladder degrades rung
by rung, weakest cell priced in §4) → morning report (named consumer of every anomaly
this spec introduces) → operator gate.

**Empirical base of the SLP — this contour's own lineage:** v3 is the THIRD top-tier
session on this design line (ADR contour → v2 membrane session → this one). Each
predecessor retired by writing a handoff artifact; each successor was born cold from it
and continued without loss — 2/2 manual artifact-first handoffs. The SLP formalizes
exactly that observed cycle; the automation (chips by day, F4 at night) replaces the
operator's manual spawn step, nothing else. The spec was itself produced by the contour
it extends: operator-ratified forks recorded with falsifiers (H1), corpus validation run
BEFORE the policy text, and the cold two-altitude review read this file plus the v2 spec.

## §13 Round-1 disposition changelog (both reports, every finding)

| Finding | Disposition |
|---|---|
| TD-B1 / BU-MAJOR-2 F4b contradicts zero-hook-edits; consumer-shipped surface; re-opens v2 disposition; daemon shape | ACCEPTED — F4b re-scoped to PROBE outside shipped surfaces; landing = new operator fork routed to D7 owner; zero hook edits reaffirmed for shipped scope; daemon-shape named as probe output; debounce cites the story-flag precedent, not the unshipped arm (§4) |
| TD-B2 lane cut fails on #1311.4 | ACCEPTED — ceiling re-cut by decision OBJECT; corpus re-checked (all 10 in-envelope members pass); v2 §4 floor clause explicitly superseded with a landing-PR pointer; ambiguity tie rule added (§6, §11) |
| TD-M1 / TD-coherence-3 SLP built from parked Part-II machinery | ACCEPTED — Birth/Retirement split into NOW vs PART-II-GATED steps (§3) |
| TD-M2 / BU-MINOR-1 rule-file gates: principle 31, index regen, Class, promotion criterion | ACCEPTED — Class B, `paths:` channel, promotion criterion, regen + ceiling in work list (§3, §10.2) |
| TD-M3 night-mode «policy layer» unfactored | ACCEPTED — explicit item mapping for non-SDD seats; T16 upstream/our class named; lands as one skill sentence (§5, §10.1) |
| TD-M4 /pipeline absent | ACCEPTED — three roles enumerated; pipeline = day seat by policy, night delta one line (§2, §5) |
| TD-M5 self-cleaning ships nothing; F10 gating overstated; «safe at every combination» | ACCEPTED — F10 gates wording only; v3 ships the trigger-consuming policy, S2a ships the trigger; weakest cell priced (§4) |
| TD-M6 NUDGE ref unimplementable for scratchpad reports; `role=` dropped | ACCEPTED — verb quoted in full; allowlisted-relative-layout requirement; scratchpad reports are subagent-return-only (§8) |
| TD-M7 chip on every mid-night retirement | ACCEPTED — night-end terminal only, one per plan; successors emit nothing (§3, §7) |
| TD-m1 / BU-MINOR-2 threshold glosses («~30%», «only» vs «esp.») | ACCEPTED — D6 quoted verbatim, glosses removed (§4) |
| TD-m2 delta-check «for free» overstated | ACCEPTED — relabelled coherence check, not per-finding discharge (§1.1) |
| TD-m3 F4-positive re-opens v2 claim-1 scope (NEW-N2) | ACCEPTED — consequence carried in probe check (d) (§4) |
| TD-m4 night-decided parks strand park-chips | ACCEPTED — best-effort dismiss + morning-report line (§7) |
| TD-m5 terminal seat may lack `spawn_task` | ACCEPTED — named; file fallback (§7) |
| TD-m6 «seat» overload | ACCEPTED — terminology note added (header block) |
| BU-B1 all six relative links broken (`../../` depth) | ACCEPTED — all links now `../../../`; lychee gate acknowledged |
| BU-MAJOR-1 billing fact inverted | ACCEPTED at r1 (corrected to the recorded meter) — then SUPERSEDED post-r2 by live verification: the 2026-06-15 meter change was paused on its effective date; subscription pool is current; cost-GO retired (§4, §13b) |
| BU-MAJOR-3 cold-seat-economy blocks uncited; ladder vs economy unreconciled; spec-of defect | ACCEPTED — blocks cited as cost owner, rung ordering reconciled (agreement), header owner list extended; the spec-of defect routed as an observation to its owner (§3, §10.7, §11) |
| BU-MINOR-3 item 8 «stands as written» over-broad | ACCEPTED — scoped to clause (c); amendment named (§6) |
| BU-MINOR-4 supersession pointer content undefined | ACCEPTED — re-scoped: v2 §4 pointer is this PR's; ADR Part-2/D5 pointer deferred to Part-II ratification; handoff disagreement resolved explicitly (§10.5) |
| BU-MINOR-5 parallel-subwave-isolation citation stretch | ACCEPTED — owner corrected to v2 §6 corollary; PSI cited as background (§3) |
| BU-MINOR-6 chip fallback consumer misattributed | ACCEPTED — claimed as this spec's own extension (§7) |
| BU soft-edge #1302.3 half-maintainer-owned | ACCEPTED — recorded in §9 |

## §13b Round-2 disposition changelog (verification seat, REVISE — cap reached)

r2 verified: 21/23 r1 dispositions DISCHARGED, 2 PARTIAL (both repaired below), 0
NOT-DONE; both r1 BLOCKERs genuinely closed (links 10/10 resolve; F4b fence consistent;
object cut independently re-tested cold on #1311.4/#1317/#1284.6 — no judgment collapse);
zero misquotations in r1's base-artifact citations.

| r2 finding | Disposition |
|---|---|
| MAJOR-1 4KB rule-index ceiling spent (4088/4096; min row 100 B) — «headroom check» had no passing branch | ACCEPTED — landing now REQUIRES freeing bytes first (trim `Fires:` lines per the renderer's remedy) or raising the constant with recorded reasoning; billed as §10.4's precondition (§3, §10.4) |
| MAJOR-2 /pipeline night delta normative but landing nowhere | ACCEPTED — billed as the FOURTH policy surface in §10.1; §5 points at the bill (§5, §10.1) |
| N1 item 5 missing from the night-mode item mapping | ACCEPTED — item 5 (verification discipline) added to the binds-every-seat list (§5) |
| N2 `paths:` mislabelled «edit-time inject» | ACCEPTED — corrected to branch (a) read-time load (§3) |
| N3 «four seat SKILL.md files» survived the three-roles repair | ACCEPTED — «four SKILL.md files: three seat roles + the night-mode layer» (§3) |
| N4 §2 seat-file vocabulary un-gated | ACCEPTED — Part-II-gated qualifier added at the §2 enumeration (§2) |
| N5 no precedence when stage-scope and a floor category both apply (#1311.3) | ACCEPTED — floor dominates; stage-scope authorizes only what no floor category claims (§6) |
| N6 §7 `dismiss_task` + park-listing commitments unbilled | ACCEPTED — billed in §10.5 (§10) |
| N7 §1.1 «ordered for cheap extraction» untrue of §10 as written | ACCEPTED — §10 reordered [Part-I] first, items labelled (§10) |

Review cap (2 rounds) reached; per [arch/SKILL.md §2](../../../.claude/skills/arch/SKILL.md)
the routing disposition is the operator's: the r2 seat's own note — «the residue is
paragraph-level text and work-list completeness — the design spine (§2, §4, §6, §7)
verified sound» — and every residue item is repaired in this text.

**Post-cap absorptions (2026-08-09, operator inputs — not a review round):**

1. **Billing fact refresh (operator challenge):** the §4 probe-check (c) fact was
   re-verified against live official sources after the operator disputed r1's
   memory-based correction. Verified: the 2026-06-15 separate credit-pool policy was
   paused on its own effective date; `claude -p` / Agent-SDK usage draws from the
   subscription pool. The r1 text and the underlying operator-memory record were both
   stale; §4(c) now carries the verified state + a re-open falsifier; the cost-GO gate
   is retired. Fact freshening only.
2. **F4b audience directive:** the operator decided the audience half of the F4b landing
   fork — consumer-shipped self-cleaning autonomy is the framework's product intent; the
   engineering guards stay non-negotiable (§4). Recorded as a decided fork with the
   directive quoted; the F10 wording fork closes formally at S2a.
