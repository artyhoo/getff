<!-- scope: session-bus v2 design — PHASE-B ROUND-1 REVISION. Lineage: Phase-A membrane-
     sealed draft (commit 42f8836d72, read prep §0+§1 only) → Phase-B fact reconciliation
     (83c6e78901, opened prep §2–§5) → this revision, absorbing TWO cold REVISE verdicts
     (top-down: 2 BLOCKER / 10 MAJOR / 7 MINOR; bottom-up: 1 BLOCKER / 5 MAJOR / 4 MINOR).
     Review reports are session-ephemeral scratchpad files; every finding's disposition is
     inlined in §14 so nothing load-bearing lives outside this file. -->

# Session bus v2 — night autonomy + attention-only doorbell overlay (Phase-B r1)

> **Status:** PHASE-B ROUND-1 REVISION — awaiting round-2 verification (cap: 2 REVISE
> rounds, [arch/SKILL.md §2](../../../.claude/skills/arch/SKILL.md)).
> **Will supersede (if ratified):** the merged ADR's Part-2 area (D3–D5, §4, F1) — pointer
> added to the old ADR at Phase C, never a silent contradiction. It also SUPERSEDES the
> prep doc's §2 *interpretation* of the self-ID fact (see §6 finding — evidence-backed).
> **NOT authoritative for:** project goal — [README.md#why-this-exists](../../../README.md#why-this-exists);
> chips/handoff/calibration (ADR Parts 1/3/4 stand).
> **Current as of 2026-08-09.** Branch: `claude/pipeline-chips-auto-sessions-e9b6de`.

## §1 Context — inputs (all from arch-prep §1, verbatim-faithful)

**Goal:** automate /arch ↔ /pipeline ↔ /dispatcher signalling over cross-session messaging,
removing the operator's manual relay. Full loop: executing session parks a question → signal
reaches the strategy (arch) session → arch prepares the decision package AND DECIDES →
answer-pointer flies back automatically → the executing session applies it.

**Operator counter-resolutions (ratified inputs):** (1) ID-cascade at spawn — parents hand
children the address book; registry travels down; arch's fresh-context respawn = the Part-3
handoff moment, one move. (2) Night autonomy with morning review — a live top-tier seat MAY
resolve parked strategic questions overnight; decisions recorded + reversible until morning
where feasible; the morning report is the review gate; supersedes «night: stay parked».
(3) Bursts are acceptable spend.

**Standing constraints:** pointer-only messages · untrusted-body + re-verify · bus never
load-bearing (delete it → today's behavior returns) · no daemons · no new npm deps ·
capability-check not version-check · artifacts remain the durable truth.

## §2 Structural resolution — TWO PARTS, separately shippable

Round-1 reviews established (dispositions §14): the control-model change needs no transport
at all, while the transport's night value rests on three unproven mechanics. Resolved by the
author (in-envelope: doc-only, branch-local, reversible; operator may override at review):

- **Part I — night-autonomy control model** (§4–§5). Policy + artifact change, zero bus.
  Delivers counter-resolution 2 end-to-end for every park that exists today: aif worker
  parks → dispatcher observes (`questions.ts`) → arch (when reachable) decides → `answer.ts`
  applies and REST-unpauses the worker. **The return leg of the §1 loop is ALREADY
  automatic** (`answer.ts:207-212` per bottom-up review) — no bus contribution needed.
- **Part II — attention-bus overlay** (§6–§9). PARKED/REBIND/NUDGE doorbells + address
  resolution. Pure latency reduction, gated on probes P1–P3 (§13). Never function.

*Falsifier for the split:* wrong if the operator requires push-latency at night before
Part I lands — then P1/P2 become the critical path, not a gate.

**Build-vs-reuse posture:** the capability area's SSOT consult stands in the merged ADR §8
(IDs #108/#121/#122/#230, per that consult); v2 strictly SHRINKS machinery relative to the
ADR's Part-2 (no new hooks, no new deps, no new artifact classes — §4 reuses night-mode's
artifacts; Part II is one coordination-dir file class + recipe prose).

## §3 D1 — design principle: doorbell over mailbox

The durable state machine already exists and already works — in TWO storage classes, named
precisely (round-1 correction): **parks and answers are service-durable rows** in the
aif-handoff store, read/mutated over REST (`questions.ts`, `answer.ts`); **specs, decision
records, and the seat registry are file artifacts** (repo or coordination dir). The
operator's manual relay is pure *attention transport*. Therefore the bus carries **attention
only, never content and never authority**:

- The **mailbox** (service rows + file artifacts) is the source of truth. Nothing changes
  about how truth is written.
- The **doorbell** (a cross-session message) says only «state at `<ref>` deserves your
  attention». Losing every doorbell loses zero information — only latency. (The ccd schema's
  advisory — messaging is «not to orchestrate background work» — is satisfied by
  construction.)

**Two laws:** **Law 1 — no verb without a pull-twin** (a verb that cannot name the pull path
delivering the same outcome without the bus is rejected at design time). **Law 2 —
receivers are idempotent** (acting on a doorbell starts by re-verifying the pointed-at
state; duplicate/stale/forged doorbells land on no-ops).

## Part I — night-autonomy control model (bus-free)

## §4 Envelope, record, morning gate

- **Reversibility envelope.** On each parked question the night seat classifies the
  decision's application path. **In-envelope** (reversible until morning): branch-local
  commits, design/parameter choices within kickoff caps, ordering/prioritization, REVISE
  dispositions, naming, scope-internal trade-offs. **Hard floor** (never night-autonomous):
  merges into shared branches; deleting non-generated artifacts; anything externally visible
  (publish, egress, messages to humans); spend beyond standing caps; security/permission
  changes; edits crossing the [Artifact Ownership Contract](../../../CLAUDE.md) into
  maintainer-only surfaces. Out-of-envelope questions stay parked with the decision package
  pre-built, so the morning decision is cheap.
- **Corpus validation (REQUIRED before landing, round-1 M7):** classify the measured park
  corpus (prep §2: PRs #1317 #1315 #1311 #1302 #1292 #1290 #1289 + #1284's six forks)
  against the envelope. The dispatcher routes the «intent / goal / design» class to arch —
  which overlaps the floored class. If most of the corpus lands on the floor, the night win
  is small and the envelope must be re-negotiated with the operator BEFORE the policy lands.
- **Decision record — REUSE, not a new class (round-1 M6).** night-mode already owns the
  owner-fork log (`<plan>.decisions.md`, [night-mode/SKILL.md](../../../.claude/skills/night-mode/SKILL.md)
  delta item 1) and the morning report (its «morning report» contents list). Part I EXTENDS
  the decisions.md entry shape with: decision package (evidence file:line, options,
  trade-offs) · decision · rationale · falsifier («wrong if …», H1 per
  [phase-research-coverage.md §1.7](../../../.claude/rules/phase-research-coverage.md)) ·
  reversibility class + concrete undo note · `decided-by:` · status
  (`applied | rework | superseded`). The morning report gains a «bus anomalies» section
  (Part II's named consumer — [attention-is-not-a-mechanism.md §2](../../../.claude/rules/attention-is-not-a-mechanism.md)
  `#warning-nobody-reads` discharged on an EXISTING artifact). *Reuse falsifier:* wrong if
  per-plan scoping cannot host cross-umbrella parks — then one coordination-dir decisions
  file, still not a per-date class.
- **Context degradation at night (round-1 N4):** the night seat cannot hand off (no session
  births at night, §8) — so it degrades with no successor. Mitigations, stated: sweep turns
  are near-no-ops when nothing is parked; every decision records context-age; past the ADR
  Part-3 T_soft threshold the seat defers non-trivial decisions to morning (an envelope
  floor extension).
- **Venue tier per question class:** in-scope architecture → this top seat, night-decidable
  in-envelope; intent/goal/creative → top seat too, but goal-REDEFINING questions sit on the
  hard floor and wait for the operator ([arch/SKILL.md §4](../../../.claude/skills/arch/SKILL.md)
  routing, night edition).
- **Rework path:** operator marks a decision `rework` (or says so); arch re-decides with the
  operator's note as an added constraint and applies via `answer.ts` — the only correct
  application channel. (Phone push for the morning report: optional via the currently-LIVE
  container notifier; host telegram is DEAD today; no notification channel is load-bearing.)

## §5 Policy surfaces — THREE, amended in one change (round-1 M7)

1. [dispatcher/SKILL.md §3](../../../.claude/skills/dispatcher/SKILL.md) routing row (Night
   cell of the intent/goal/design class): «stay parked — never guess» → «live top-tier seat
   registered & reachable → route park to it; else stay parked (unchanged)». The SECOND
   Night cell in the same table (environment class: «/aif-doctor non-destructive arm; else
   stay parked») is **deliberately unchanged** — recorded here so the sweep is explicit.
2. [night-mode/SKILL.md](../../../.claude/skills/night-mode/SKILL.md) **delta item 1** — the
   policy SSOT («genuine owner forks → append, do NOT decide») — gains the same conditional.
   Round-1 caught that amending item 8 alone leaves item 1 contradicting it.
3. night-mode **delta item 8** («any parked owner-fork» escalation) — follows item 1.

Same change, same PR; run /self-reflection on this discipline change at landing time.

## Part II — attention-bus overlay (probe-gated)

## §6 Addressing — re-keyed to the join key the app actually publishes

**Round-1 BLOCKER (top-down B1, live-verified):** the hook-visible `session_id` (CC
transcript UUID) and the ccd `sessionId` (`local_<uuid>`, the only value `send_message`
accepts) are **disjoint namespaces with no published join key**; `get_session` exposes
`cwd/worktreePath/branch` but no CC id. The prep §2 «self-ID via hooks» fact is real but
names a NON-ADDRESS — this spec hereby supersedes that interpretation; the prior take's
self-ID wall stands. What the app DOES publish per session: `cwd`, `branch`, `isRunning`,
`lastActivityAt` (via `list_sessions`).

**Resolution — the registry stores NO session ids at all:**

- **Per-role entry files** (no shared JSON document, no generation counter — round-1 M8
  killed the read-modify-write class):
  `${CLAUDE_COORDINATION_DIR:-$HOME/.claude-coordination/rules-as-tests-aif}/session-bus/seats/<role>.json`
  containing `{ "cwd": "…", "branch": "…", "since": "…" }`. Location = the repo's canonical
  cross-worktree machine-local store (`scripts/link-coordination.sh:74`; survives worktree
  removal; gitignored; bottom-up §D proposal adopted). *Falsifier:* wrong if the registry
  must be readable inside the aif container — not required, workers have no bus edge.
- **Writer = the seat session itself,** first turn: it knows its own `cwd`, `branch`, and
  role (assigned by the spawn prompt). A plain file write — **no publisher hook, no
  settings.json registration, no zcode census row, no self-ID** (round-1 M4/M5 evaporate).
  Atomic write-temp+rename per file; last-writer-wins per role.
- **Resolve at send time, always:** read `<role>.json` → enumerate `list_sessions` → match
  `cwd` (+`branch` as tiebreak) → obtain the ccd `sessionId` → send. Never address from
  memory. Liveness predicate: `isRunning` AND `lastActivityAt` fresh — round-1 M9 observed
  `isRunning: true` on sessions with MERGED PRs (sticky flag suspicion, probe P3), so
  `isRunning` alone is not trusted.
- **Counter-resolution 1 honored, mechanism inverted:** parents CAN see children in
  `list_sessions` once they run; the spawn prompt assigns the ROLE and the registry path;
  the child's own first-turn write registers it. «Parents register children» survives as
  role-assignment bootstrap; the address book travels as the seats directory.
- **Arch self-handoff (the stacked move):** old arch spawns new arch (context package +
  seats-dir path, one spawn prompt); the new seat's first-turn write overwrites
  `arch.json`; courtesy `REBIND` to living seats. Correctness never depends on REBIND
  arriving (resolve-at-send reads files).

## §7 Grammar — three live verbs, one reserved

```text
AIF-BUS v1 PARKED task=<task.id> ref=<relative-path>
AIF-BUS v1 REBIND
AIF-BUS v1 NUDGE  role=<sender-role> ref=<relative-path>
```

- `PARKED` (dispatcher-on-observe → arch; or any local session that parks): a park exists
  for `task=`; please look. There is **no park id** — `task.id` is the only identifier in
  the data model (round-1 MAJOR-2; `questions.ts` task rows). *Pull-twin:* the arch sweep of
  the park store (§8) / morning office-hours.
- `REBIND` (new seat → living seats): seats directory changed; re-read it. Carries nothing
  to trust. *Pull-twin:* resolve-at-send (§6) — REBIND is pure courtesy.
- `NUDGE` (any seat → any seat): «attention at `<ref>`» for non-park signalling
  (kickoff-ready, umbrella-done, morning report ready). Unknown artifact type → ignore +
  morning-report anomaly line. *Pull-twin:* the artifact's own consumer contract.
- `ANSWERED` — **RESERVED, not shipped** (round-1 BLOCKER: its recipient class is the empty
  set — every parker today is an aif-container worker (`park.ts` is container-only) and
  containers can neither send nor receive ccd messages; the answer already reaches workers
  via `answer.ts` REST-unpause). Reactivates only if a local-parker class materializes
  (F4 CLI probe, or a future local park surface) — with its own review. The registry has NO
  `workers.*` section for the same reason.

**Sender algorithm:** bus enabled (seats dir exists; `AIF_BUS` not `off`) → resolve per §6 →
capability-check the transport in THIS session → **one attempt, no retry, no ack; control
flow never branches on delivery**.

**Receiver protocol — honestly labelled (round-1 M10):** messages arrive as USER TURNS
(«From {sender title}») — an injection-shaped channel. The receive-time checks (strict
one-line parse; `ref` relative, no `..`, allowlisted layout; Law 2 re-verification through
`questions.ts`/artifacts; queue-not-interrupt when mid-dialogue with the live operator) are
**prose-class discipline executed by the model**, not a deterministic gate. The trust
boundary is machine-local — senders are the operator's own sessions; the damage bound is
Law 2 (a forged doorbell costs one re-read). This is stated as residual risk, not claimed
hardened; [attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md)
applies, and the morning-report anomaly section is the named consumer.

**Doorbell location (round-1 fork resolved):** recipes ONLY — ccd messaging is an MCP tool,
invocable by a session, unreachable from CLI code. Consequence: **zero bus code inside
`packages/`** — which is exactly executable claim 1 (§9).

## §8 Night delivery — two legs, both currently unproven for 3am (round-1 B2)

**Transport scope (prep §2):** ccd messaging is unavailable to scheduled-task-born and
remote-dispatched sessions (both directions); an operator-launched local session left
running overnight retains it. Whether that enumeration is exhaustive is an inference, not a
verified fact (round-1 MINOR-7). CLI cross-session `SendMessage` = OPEN probe F4.

- **Push:** delivery triggers a turn in a RUNNING target (verified). For an IDLE-but-open
  3am arch seat, immediate-vs-on-focus is UNKNOWN → **probe P1**.
- **Pull:** the assumed night loop does NOT currently cover the parked-only state: the
  `AIF_AUTONOMOUS=1` Stop-arm counts only un-paused tasks
  (`.claude/hooks/end-of-turn-reminder.sh:104` filters `paused`), and a park IS
  `paused:true` (`park.ts:9-13`) — so an arch seat whose only outstanding work is parked
  questions goes idle exactly when it must sweep (round-1 B2). **Proposed deterministic
  driver → probe P2:** extend the existing arm's predicate so that, for the arch seat,
  parked questions count as outstanding work (a bounded edit to an already-registered hook;
  the session stays interactive-born, so messaging is retained). P2 must also price the
  idle loop-turn cost over ~10h on a top-tier seat (round-1 scoring note).
- **Until P1 or P2 is verified: the night latency claim is «morning sweep = today».** Part I
  still delivers the control-model change on whatever turns the seat actually gets.

**Bursts, honestly relabelled (round-1 M2):** the measured burstiness (7/30 merged PRs with
substantive `## Parked questions`; #1284×6) is a **PR-body corpus — an adjacent population**
authored by local sessions at PR time, not the aif park store the sweep reads. The store's
arrival rate is UNMEASURED. Batch-per-turn is chosen for robustness (idempotent, oldest
first, one decisions.md entry each), not from measurement.

## §9 Kill-switch, degradation matrix, executable claims

**Operative switch = absence of the seats directory** (checkable by every sender at send
time; an env var cannot be changed on an already-running app session — round-1 N3).
`AIF_BUS=off` is honored where env is consulted (CLI-launched sessions).

| Broken piece | Behavior | Pull-twin that still delivers |
|---|---|---|
| Messaging capability absent in a session | that session sends nothing | park sweep / REST unpause |
| Seats dir missing | nobody sends; next seat turn rewrites its file | office-hours sweep |
| Doorbell lost (dead/zombie target — P3) | state waits | sweep / morning office-hours |
| Arch idle at night (P1/P2 unproven) | parks accumulate | morning office-hours (= today) |
| Machine asleep | nothing runs | morning office-hours (= today) |
| Parker is container/scheduled-born (messaging blocked) | never sends/receives doorbells | dispatcher observes; unpause returns answers |
| Malformed / hostile message | ignore + morning-report anomaly line | truth stores unaffected |

**Executable claims (rules-as-tests):** (1) **grep-gate: no bus references
(`AIF-BUS`/`AIF_BUS`/`session-bus`) anywhere under `packages/`** — the strongest form of
never-load-bearing is zero code in the load-bearing packages; the bus exists only as recipe
prose + one coordination file class. (Round-1 MAJOR-6: the previous «run the suite with
`AIF_BUS=off`» claim was green-by-construction because the vitest suite never touches the
bus; this reshaped claim gates the invariant that MAKES it green.) Channel per
[rule-enforcement-channel-selection.md](../../../.claude/rules/rule-enforcement-channel-selection.md)
at landing. (2) **verb↔pull-twin anti-drift:** every verb in §7 names a pull-twin; a verb
without one fails the check.

## §10 Consequences — work list (Phase-C)

1. **Part I (bus-free, first):** the three §5 policy-surface amendments + the §4
   decisions.md entry-shape extension + morning-report section; corpus-vs-envelope
   validation BEFORE landing; /self-reflection at landing.
2. **Part II (after P1/P2/P3):** dispatcher recipe (PARKED after observing new parks); arch
   recipe (sweep + decide + `answer.ts`; REBIND on handoff); seats-dir writes in seat
   skills' first-turn steps; the two §9 executable claims; supersession pointer in the old
   ADR (same PR as ratification).
3. **Probes (§13) are work items with recipes**, not open questions.

## §11 Alternatives + prior-take scoring rows

Alternatives (unchanged from Phase A): message-carried Q&A — rejected (violates pointer-only;
load-bearing); polling-only — is the degraded mode, cannot wake anything; broker session —
daemon-in-session-clothing, single point of failure. Chosen: doorbell over mailbox, now
split into Part I (policy) + Part II (overlay).

| Old ADR §4 row | v2 r1 answer |
|---|---|
| discovery | none as a step: role files + `list_sessions` cwd-match at send (§6); no self-ID anywhere |
| night cost | bursts operator-accepted; idle loop-turn cost over ~10h UNPRICED → P2 deliverable |
| bursts | batch-per-turn + idempotent; store arrival rate unmeasured (adjacent-population evidence only) |
| injection surface | user-turn channel; prose-class receive discipline, machine-local trust boundary, damage bound = Law 2 — NOT claimed hardened |
| restart survival | truth = service rows + files; seats files survive; doorbells ephemeral by design; no ids stored → nothing to go stale across reboots |
| latency | push: seconds to a running seat, 3am idle = P1; pull: loop interval IF P2 lands; else morning (= today) |
| machinery count | Part I: 3 policy-surface edits + entry-shape extension. Part II: 1 file class + recipe prose + 2 checks. 0 hooks, 0 deps, 0 daemons, 0 new session kinds |
| venue tier | named per class (§4); substantive only after corpus validation |

## §12 Pre-mortem & falsifiers

- **F1 (D1):** wrong if some flow needs payload delivery — fix that flow's artifact, never
  the bus.
- **F-B1 (addressing):** wrong if a `local_<uuid>` ↔ hook-`session_id` join exists after all
  (e.g. a sidecar in the app's state dir) — would reopen the hook-publisher path as an
  optimization; one probe closes it; the cwd-match design does not depend on the outcome.
- **F-P1/P2 (night):** wrong if both probes fail — night leg stays «morning sweep = today»
  and Part II's value is daytime-only latency; Part I unaffected.
- **F5 (envelope):** wrong if a class we call reversible cannot actually be reverted by
  morning review — corpus validation + tighten.
- **F6 (grammar):** wrong if transports impose line-size limits below the one-liner —
  [A7]-class; not exhaustively searched (6-item checklist NOT run — stated per
  [phase-research-coverage.md](../../../.claude/rules/phase-research-coverage.md)); strict
  parse guards regardless.
- **Concurrency:** per-role files + atomic rename; residual = two same-role writers racing —
  last-writer-wins is correct for a seat takeover by design.
- **Zombie targets (P3):** `isRunning` sticky-true observed on merged-PR sessions —
  doorbells to zombies vanish silently; bounded by fire-and-forget + pull-twins; probe
  before trusting the predicate.

## §13 Probe register (work items with recipes)

- **P1 — idle-wake:** two idle local sessions; send; observe immediate turn vs on-focus.
- **P2 — night-loop driver:** prototype the arm-predicate extension (count parked questions
  as outstanding for the arch seat) on a throwaway branch; verify the seat keeps taking
  turns with only-parked state; price the ~10h idle-turn cost.
- **P3 — `isRunning` stickiness:** sample `list_sessions` against known-closed sessions;
  decide the liveness predicate (`isRunning` ∧ `lastActivityAt` freshness window).
- **F4 — CLI cross-session SendMessage** headless semantics (prep §2 recipe): the only
  candidate for night session-birth and for a future `ANSWERED` recipient class.
- **Corpus-vs-envelope validation** (§4) — required before Part I lands.

## §14 Round-1 disposition changelog (both reports, every finding)

| Finding | Disposition |
|---|---|
| TD-B1 self-ID wrong namespace | ACCEPTED — §6 re-key to cwd/branch role files; prep §2 interpretation superseded; F-B1 probe carried |
| TD-B2 no night loop for parked-only | ACCEPTED — §8 names the gap (hook:104 + park.ts:9-13); P2 = arm-predicate extension; night claim downgraded until proven |
| TD-M1 / BU-BLOCKER-1 `ANSWERED` empty set | ACCEPTED — verb RESERVED, `workers.*` dropped; return leg = existing `answer.ts` unpause (§2, §7) |
| TD-M2 / BU-MAJOR-5 burst population mismatch | ACCEPTED — relabelled adjacent-population; rate unmeasured (§8) |
| TD-M3 doorbell dominated by pull-twin | ACCEPTED — value honestly bounded (§11 latency/machinery rows); Part II demoted to overlay |
| TD-M4/M5 publisher-hook registration + census/marker gates | DISSOLVED — no hook exists in the design anymore (§6) |
| TD-M6 night artifacts duplicate night-mode's | ACCEPTED — reuse `<plan>.decisions.md` + morning report; no new class (§4); SSOT consult cited (§2) |
| TD-M7 three policy surfaces + envelope-vs-corpus | ACCEPTED — §5 lists three (item 1 is the SSOT); corpus validation required (§4) |
| TD-M8 registry RMW lost updates | ACCEPTED — per-role files, no shared doc, no generation (§6) |
| TD-M9 `isRunning` unvalidated | ACCEPTED — dual predicate + P3 (§6, §13) |
| TD-M10 strict parse is prose-class | ACCEPTED — honest relabel (§7) |
| TD-N1 dead `workers` section | ACCEPTED — removed (§7) |
| TD-N2 / BU-MAJOR-3+§D registry home | ACCEPTED — coordination canon path (§6) |
| TD-N3 kill-switch weak for app sessions | ACCEPTED — operative switch = seats-dir absence (§9) |
| TD-N4 night context degradation, no successor | ACCEPTED — §4 mitigation (context-age, T_soft defer-to-morning) |
| TD-N5 GC/reboot | DISSOLVED — no ids stored; three seat files total (§6) |
| TD-N6 machine sleep | ACCEPTED — matrix row (§9) |
| TD-N7 [A7] negative-existence | ACCEPTED — stated as not-exhaustively-searched (§12 F6) |
| BU-MAJOR-2 `park=` has no referent | ACCEPTED — grammar carries `task=` only (§7) |
| BU-MAJOR-4 «parks are artifacts» overstated | ACCEPTED — two storage classes named (§3) |
| BU-MAJOR-6 executable claim unattached | ACCEPTED — doorbells pinned to recipes; claim reshaped to packages/ grep-gate (§7, §9) |
| BU-MINOR-7 availability inference | ACCEPTED — labelled inference (§8) |
| BU-MINOR-8 `taskId` vs `id` | ACCEPTED — wire field is `task=<task.id>` (§7) |
| BU-MINOR-9 ledger has no home | DISSOLVED — no ledger class; morning report reused (§4) |
| BU-MINOR-10 third «stay parked» cell | ACCEPTED — recorded deliberately unchanged (§5) |

## §15 Self-application note

This spec's failure ordering after r1: design-time (Law 1; reserved-verb discipline) →
send-time (capability + seats-dir check) → receive-time (prose-class, honestly labelled,
damage-bounded by Law 2) → morning report (named consumer) → operator gate. The claims that
could not be made executable were downgraded in place rather than left as hope (§8 night
latency, §7 receiver hardening) — the earliest-reachable-channel thesis applied to the
spec's own promises. Round-2 review verifies the §14 dispositions against this text.
