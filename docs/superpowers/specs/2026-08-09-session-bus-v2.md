<!-- scope: session-bus v2 design — PHASE-B ROUND-2 REPAIRED. Lineage: Phase-A membrane-
     sealed draft (commit 42f8836d72, read prep §0+§1 only) → Phase-B fact reconciliation
     (83c6e78901, opened prep §2–§5) → r1 revision (3a150e7d9e) absorbing TWO cold REVISE
     verdicts (top-down: 2 BLOCKER / 10 MAJOR / 7 MINOR; bottom-up: 1 BLOCKER / 5 MAJOR /
     4 MINOR) → this text, absorbing the round-2 verification (REVISE: 1 BLOCKER + 9 MAJOR
     + 4 MINOR against the revision) + the operator's mid-r2 split directive. Review
     reports are session-ephemeral scratchpad files; every finding's disposition is inlined
     in §14 (r1) and §14b (r2) so nothing load-bearing lives outside this file. -->

# Session bus v2 — night autonomy + attention-only doorbell overlay (Phase-B r1)

> **Status:** PHASE-B ROUND-2 REPAIRED — the round-2 cold verification returned REVISE
> (r1 dispositions: 16/25 DISCHARGED, 9 PARTIAL, 0 dropped; plus 1 new BLOCKER + 9 MAJOR
> against the revision itself). Every r2 finding is repaired or parked in this text (§14b).
> The 2-round review cap ([arch/SKILL.md §2](../../../.claude/skills/arch/SKILL.md)) is
> reached — routing disposition sits with the operator (r2 seat's partition: Part I
> text-repaired; Part II parked behind P1 + P4).
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

**Build-vs-reuse posture:** the merged ADR §8 consult (IDs #108/#121/#122/#230) is NOMINAL
for this area — r2 verified those IDs cover PreCompact/allowed-tools/recap/handoff, not
cross-session messaging or registries. The gate is not tripped today: v2 adds zero code,
zero deps, zero hook edits (post-r2 — the P2 arm-edit is retired, §8), so no capability
commit is expected. An area-specific consult (context7 ≥3 phrasings + the 6-item
negative-existence check) is OWED before any future Part-II capability commit.

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
  merges into shared branches *(SUPERSEDED at Phase-C landing: this git-operation criterion is
  re-cut by the decision's OBJECT — [autonomous-night v3 §6](2026-08-09-autonomous-night-v3-design.md);
  all other floor items below stand unchanged)*; deleting non-generated artifacts; anything externally visible
  (publish, egress, messages to humans); spend beyond standing caps; security/permission
  changes; edits crossing the [Artifact Ownership Contract](../../../CLAUDE.md) into
  maintainer-only surfaces. Out-of-envelope questions stay parked with the decision package
  pre-built, so the morning decision is cheap.
- **Corpus validation (REQUIRED before landing, round-1 M7):** classify the measured park
  corpus (prep §2: PRs #1317 #1315 #1311 #1302 #1292 #1290 #1289 + #1284's six forks)
  against the envelope. The dispatcher routes the «intent / goal / design» class to arch —
  which overlaps the floored class. If most of the corpus lands on the floor, the night win
  is small and the envelope must be re-negotiated with the operator BEFORE the policy lands.
  **Population caveat (r2 NEW-M6):** this corpus is PR-body parks — a class-mix PROXY for
  the aif-store population the night seat actually sweeps (no established ratio); the
  verdict is directional, and the first real night ledger re-runs the classification on
  live store parks.
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
- **Context degradation at night (round-1 N4) + operator directive (2026-08-09, mid-r2):**
  the operator prefers the night to run as SEVERAL communicating autonomous sessions that
  re-invoke themselves under context pressure, over one long-lived seat. That is the ADR
  Part-3 handoff pattern applied at night — and it collides with the verified wall: no
  session birth at night via ccd (prep §2: chips need a click; scheduled/cron-born sessions
  lose messaging both ways). The ONLY door is **F4 — CLI headless spawning + cross-session
  SendMessage** — hereby elevated to a co-critical probe with P1 (§13). If F4 lands
  positive: night handoff = the Part-3 stacked move at night (successor spawned via CLI,
  seat file overwritten, predecessor retires) and this floor extension retires. Until then,
  the single-seat mitigations stand: sweep turns are near-no-ops when nothing is parked;
  every decision records context-age; past the ADR Part-3 T_soft threshold the seat defers
  non-trivial decisions to morning (an envelope floor extension).
- **Night continuation ladder (operator follow-up, 2026-08-09): handoff vs auto-compact —
  «one closes the other», formalized.** The two mechanisms fill the same slot, and F4's
  outcome decides which fills it at night:
  1. **Artifact-first recording makes either mechanism safe.** Nothing load-bearing lives
     only in the seat's working memory: role = the seat file (§6, re-derivable), pending
     work = `questions.ts`, decisions already made = `<plan>.decisions.md`, mandate = the
     kickoff/spec. A seat can lose its entire context — compaction or death — and re-derive
     its state from artifacts; the property that makes the bus non-load-bearing (§3) is the
     same property that makes continuation safe. Decisions are recorded in artifacts BEFORE
     any compaction can lose them, never only in chat.
  2. **Preferred continuation = the Part-3 handoff** (ADR D6–D8, NOT re-opened — reused):
     fresh successor seat, context package + seat-file overwrite, predecessor retires.
     Available by day always; at night ONLY if F4 lands positive (operator's split
     directive above).
  3. **Fallback continuation = auto-compact in place:** the harness summarizes and the same
     session continues. ADR D8 (PreCompact) owns the state-preservation hook at that
     boundary — reused, not redesigned here. Post-compaction decision quality is the
     residual risk, guarded by the T_soft floor (defer non-trivial decisions to morning)
     and the context-age line each decision record carries.

  F4 positive → rung 2 covers the night and rung 3 demotes to emergency-only; F4 negative →
  rung 3 IS the night continuation mechanism and the floor extension stands.
- **Venue tier per question class:** [arch/SKILL.md §4](../../../.claude/skills/arch/SKILL.md)
  day-time routing is NOT amended (in-scope architecture → senior-executor seat;
  intent/goal/creative → top seat). At night the routing DEGRADES by seat availability —
  only the top seat is awake, so it takes both classes, in-envelope only; goal-REDEFINING
  questions sit on the hard floor and wait for the operator. Recorded explicitly (r2
  NEW-M5): availability degradation, not a reassignment of arch §4.
- **Rework path:** operator marks a decision `rework` (or says so); arch re-decides with the
  operator's note as an added constraint and applies via `answer.ts` — the only correct
  application channel. (Phone push for the morning report: optional via the currently-LIVE
  container notifier; host telegram is DEAD today; no notification channel is load-bearing.)

## §5 Policy surfaces — THREE, amended in one change (round-1 M7)

1. [dispatcher/SKILL.md §3](../../../.claude/skills/dispatcher/SKILL.md) routing row (Night
   cell of the intent/goal/design class): «stay parked — never guess» → **bus-free wording
   (r2 NEW-M1):** «a live top-tier seat exists and is sweeping → it may decide the park per
   the night envelope; else stay parked (unchanged)». No «registered», no routing verb —
   Part I must be executable with zero Part-II machinery; if Part II is later ratified, the
   doorbell becomes the *reaching* mechanism and the wording gains «or reachable via the
   session bus». The SECOND Night cell in the same table (environment class: «/aif-doctor
   non-destructive arm; else stay parked») is **deliberately unchanged** — recorded here so
   the sweep is explicit.
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
- **Writer = the seat session itself,** first turn: it knows its own `cwd` and role
  (assigned by the spawn prompt). A plain file write — **no publisher hook, no
  settings.json registration, no self-ID** (round-1 M4/M5 evaporate). Atomic
  write-temp+rename per file; last-writer-wins per role. The write is GATED by the same §9
  enable check as sending (r2 NEW-M4 — otherwise the kill-switch self-heals).
- **Resolve at send time, always:** read `<role>.json` → enumerate `list_sessions`
  (paginate to exhaustion, bounded — r2 NEW-N3) → match `cwd` → **exactly one match → send;
  zero or multiple matches → skip** (the pull-twin covers; ambiguity never guesses — the
  multi-match rule prep §3(d) asked for). `branch` is DROPPED as a tiebreak: r2 live-sampled
  it stale in 3 of 4 rows (creation-time value) and ABSENT on repo-root sessions — the
  documented collision case. Corollary invariant: **a seat lives in a dedicated worktree**
  (already mandatory for spawned sessions,
  [parallel-subwave-isolation.md §1](../../../.claude/rules/parallel-subwave-isolation.md));
  repo-root sessions are ineligible as seats. **No liveness predicate** (r2 NEW-M3: live
  sample shows `isRunning`/`lastActivityAt` co-refresh in bulk — no validated signal
  exists): a doorbell to a dead single-match target costs one lost message, already priced
  in by fire-and-forget; P3 demotes to an optional optimization probe.
- **P4 (r2 — Part II entry condition):** two-session probe verifying the join key itself —
  does the `cwd` the app publishes for seat A equal what A self-reports (`get_session`
  distinguishes `cwd`/`worktreePath`/`originCwd`; the field choice is the probe's output)?
  Round-1's B1 failed on an assumed join; this design does not assume one twice.
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
`packages/`** — executable claim 1 (§9). Conditional on F4 staying negative (r2 NEW-N2): a
positive F4 adds a CLI transport and re-opens both this conclusion and claim 1's scope.

## §8 Night delivery — two legs, both currently unproven for 3am (round-1 B2)

**Transport scope (prep §2):** ccd messaging is unavailable to scheduled-task-born and
remote-dispatched sessions (both directions); an operator-launched local session left
running overnight retains it. Whether that enumeration is exhaustive is an inference, not a
verified fact (round-1 MINOR-7). CLI cross-session `SendMessage` = OPEN probe F4.

- **Push:** delivery triggers a turn in a RUNNING target (verified). For an IDLE-but-open
  3am arch seat, immediate-vs-on-focus is UNKNOWN → **probe P1**.
- **Pull:** the assumed night loop does NOT cover the parked-only state: the
  `AIF_AUTONOMOUS=1` Stop-arm counts only un-paused tasks
  (`.claude/hooks/end-of-turn-reminder.sh:104` filters `paused`), and a park IS
  `paused:true` (`park.ts:9-13`) — an arch seat whose only outstanding work is parked
  questions goes idle exactly when it must sweep (round-1 B2).
- **The arm-predicate extension (r1's P2) is RETIRED — refuted by r2 NEW-M2/M8/M9:** a Stop
  hook only *prevents a turn from ending* (`decision:block`, hook `:136-140`) — it cannot
  ORIGINATE a turn for a seat that already stopped; the stop-chain guard (`:35-38`) and the
  8-consecutive-blocks override (`:64-69`) kill a parked-only wait anyway; the predicate
  would be a GLOBAL change to the shared autonomy layer (load-bearing by definition); and
  the hook's arm layout is owned by ADR D7, not re-opened here. **No hook edits remain
  anywhere in this design.**
- **What remains for 3am: P1 (message wakes an idle seat), and — per the operator's split
  directive (§4) — F4 (CLI spawn of a fresh successor seat).** Sender timing works without
  any loop: the dispatcher's LAST loop turn — the one that observes the final task parking —
  emits `PARKED` before the seat is allowed to stop; after answering, arch may
  courtesy-NUDGE the dispatcher (prep §3(c)). **If both P1 and F4 fail, the night leg is
  honestly dead: night = evening-tail + morning sweep (= today)** — Part I still applies on
  whatever turns the seat gets. No daemon-shaped substitute will be sought (standing
  constraint).

**Bursts, honestly relabelled (round-1 M2):** the measured burstiness (7/30 merged PRs with
substantive `## Parked questions`; #1284×6) is a **PR-body corpus — an adjacent population**
authored by local sessions at PR time, not the aif park store the sweep reads. The store's
arrival rate is UNMEASURED. Batch-per-turn is chosen for robustness (idempotent, oldest
first, one decisions.md entry each), not from measurement.

## §9 Kill-switch, degradation matrix, executable claims

**Operative switch = an `OFF` tombstone file** at `session-bus/OFF` (r2 NEW-M4: bare
directory absence self-heals — seats rewrite their files next turn; the tombstone is
honored by BOTH writers and senders, §6, and survives until the operator removes it). An
env var cannot be changed on an already-running app session, so `AIF_BUS=off` is the
secondary switch for CLI-launched sessions.

| Broken piece | Behavior | Pull-twin that still delivers |
|---|---|---|
| Messaging capability absent in a session | that session sends nothing | park sweep / REST unpause |
| Seats dir missing / `OFF` tombstone present | nobody writes or sends | office-hours sweep |
| Doorbell lost (dead/zombie target) | state waits | sweep / morning office-hours |
| Arch idle at night (P1/F4 unproven) | parks accumulate | morning office-hours (= today) |
| Machine asleep | nothing runs | morning office-hours (= today) |
| Parker is container/scheduled-born (messaging blocked) | never sends/receives doorbells | dispatcher observes; unpause returns answers |
| Malformed / hostile message | ignore + morning-report anomaly line | truth stores unaffected |

**Executable claims (rules-as-tests):** (1) **grep-gate: no bus references
(`AIF-BUS`/`AIF_BUS`/`session-bus`) anywhere under `packages/`** — the strongest form of
never-load-bearing is zero code in the load-bearing packages; the bus exists only as recipe
prose + one coordination file class. (Round-1 MAJOR-6: the previous «run the suite with
`AIF_BUS=off`» claim was green-by-construction because the vitest suite never touches the
bus; this reshaped claim gates the invariant that MAKES it green.) **Channel constraint (r2
NEW-M7): the gate must live OUTSIDE `packages/`** (e.g. a pre-push section or `tests/`) or
carry an explicit self-exclusion — a principle test under `packages/core/principles/` would
contain the banned literals and fail itself. Channel finalized per
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
| latency | push: seconds to a running seat; 3am = P1 or F4 or nothing (pull retired for parked-only, §8); else morning (= today) |
| machinery count | Part I: 3 policy-surface edits + entry-shape extension + morning-report section (r2 N4: full bill). Part II: 1 file class + tombstone + recipe prose + 2 checks. 0 hook edits (r2: P2-arm retired), 0 deps, 0 daemons, 0 new session kinds |
| venue tier | named per class (§4); substantive only after corpus validation |

## §12 Pre-mortem & falsifiers

- **F1 (D1):** wrong if some flow needs payload delivery — fix that flow's artifact, never
  the bus.
- **F-B1 (addressing):** wrong if a `local_<uuid>` ↔ hook-`session_id` join exists after all
  (e.g. a sidecar in the app's state dir) — would reopen the hook-publisher path as an
  optimization; one probe closes it; the cwd-match design does not depend on the outcome.
- **F-P1/F4 (night):** wrong if both fail — night leg stays «morning sweep = today» and
  Part II's value is daytime-only latency; Part I unaffected. (P2 retired, §8.)
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

- **P1 — idle-wake (co-critical):** two idle local sessions; send; observe immediate turn
  vs on-focus. Carries the single-seat night leg.
- **P2 — RETIRED (r2):** the arm-predicate extension is refuted (§8) — a Stop hook cannot
  originate turns. No replacement pull driver is sought.
- **P3 — liveness signal (OPTIONAL, demoted r2):** establish whether ANY discriminating
  liveness signal exists; the design no longer depends on one (§6).
- **P4 — cwd join verification (Part II entry condition):** §6 recipe; output = the correct
  field or a NO-JOIN verdict (kills Part II addressing).
- **P5 — multi-match frequency:** the rule is codified in §6 (0 or >1 → skip); the probe
  only documents observed collision frequency.
- **F4 — CLI headless spawn + cross-session SendMessage (co-critical, elevated by the
  operator's split directive §4; recipe extended at Phase-C landing per
  [autonomous-night v3 §4](2026-08-09-autonomous-night-v3-design.md)):** prep §2 recipe; the
  only candidate for night session-birth (multi-session night, self-respawn on context
  pressure) and for a future `ANSWERED` recipient class. TWO recipes, BOTH probes, zero
  landings: **F4a** — the seat session itself calls the CLI to spawn a successor; **F4b** —
  a Stop-hook-launched successor, probed OUTSIDE shipped surfaces (throwaway local hook in a
  scratch project; the shipped Stop hook is D7-owned — zero hook edits land with the probe).
  Probe checks (v3 §4): (a) CLI-born session visibility in `list_sessions` / ccd
  reachability; (b) spawn-storm guard — one successor per trigger, debounced per the
  story-flag precedent; the chain-spawn daemon-shape question is probe OUTPUT for the
  operator's classification; (c) billing — LIVE-VERIFIED 2026-08-09: `claude -p` /
  Agent-SDK usage draws from the SUBSCRIPTION pool (the 2026-06-15 separate credit-pool
  policy was paused on its own effective date); the r1 cost-GO gate is RETIRED — what
  remains is cost-awareness under item 3's quota backoff, and any future billing change
  RE-OPENS this check; (d) an F4-positive re-opens the §7 «recipes-ONLY» conclusion and §9
  claim-1 scope. Any F4b LANDING = a new operator fork routed to the D7 owner.
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

## §14b Round-2 disposition changelog (verification seat, REVISE — cap reached)

| r2 finding | Disposition |
|---|---|
| NEW-B1 cwd/branch join unverified; branch stale 3/4; repo-root collision | ACCEPTED — branch dropped; cwd-only + exactly-one-match rule; seat-worktree invariant; P4 entry condition (§6) |
| NEW-M1 Part-I amendment in Part-II vocabulary | ACCEPTED — bus-free wording (§5.1) |
| NEW-M2 Stop hook cannot originate turns | ACCEPTED — P2-arm RETIRED; P1 + F4 carry the night; honest else-branch (§8) |
| NEW-M3 liveness predicates co-refresh | ACCEPTED — liveness predicate removed; P3 optional (§6) |
| NEW-M4 kill-switch self-heals | ACCEPTED — `OFF` tombstone honored by writers AND senders (§6, §9) |
| NEW-M5 fourth surface silently re-routed | ACCEPTED — recorded as availability degradation; arch §4 NOT amended (§4) |
| NEW-M6 corpus gate population mismatch | ACCEPTED — proxy caveat + live-store re-run in first night ledger (§4) |
| NEW-M7 grep-gate self-hits | ACCEPTED — channel constrained outside `packages/` or self-excluded (§9) |
| NEW-M8 hook-edit contradiction + wrong fence | DISSOLVED via NEW-M2 — zero hook edits remain; fence statement now true (§8, §11) |
| NEW-M9 D7 owns the arm layout | MOOT — no arm edit remains (§8) |
| NEW-N1 SSOT citation covers a different area | ACCEPTED — consult marked nominal; area consult owed pre-capability-commit (§2) |
| NEW-N2 recipes-ONLY unconditional while F4 open | ACCEPTED — conditionality stated (§7) |
| NEW-N3 pagination unhandled | ACCEPTED — paginate-to-exhaustion bounded (§6) |
| NEW-N4 edit-count drift | ACCEPTED — §11 machinery row carries the full bill |

Also absorbed mid-r2: the **operator's split directive** (night = several communicating
self-respawning sessions) — §4 + §13 F4 elevation. Review cap (2 rounds) reached; per
[arch/SKILL.md §2](../../../.claude/skills/arch/SKILL.md) the routing disposition is the
operator's fork: r2 seat's partition = Part I text-repaired here, Part II parked behind
P1/F4 (night value) + P4 (addressing join).

## §15 Self-application note

This spec's failure ordering after r1: design-time (Law 1; reserved-verb discipline) →
send-time (capability + seats-dir check) → receive-time (prose-class, honestly labelled,
damage-bounded by Law 2) → morning report (named consumer) → operator gate. The claims that
could not be made executable were downgraded in place rather than left as hope (§8 night
latency, §7 receiver hardening) — the earliest-reachable-channel thesis applied to the
spec's own promises. Round-2 review verifies the §14 dispositions against this text.
