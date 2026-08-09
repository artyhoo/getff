<!-- scope: session-bus v2 design — PHASE-A DRAFT, created membrane-sealed per
     2026-08-09-arch-prep-session-bus-v2.md §0. Author read ONLY prep §0 (protocol) + §1
     (operator directives). Sealed and untouched at authoring time: prep §2, prep §3, the
     merged ADR's Part-2 sections, this branch's git history. Every environmental claim not
     derivable from prep §1 or the authoring session's own observable harness is tagged
     [A#] and registered in §12 for the Phase-B fact-check. -->

# Session bus v2 — attention-only doorbell bus over artifact truth (Phase-A draft)

> **Status:** PHASE-A DRAFT — from-zero design, pre-fact-check. Not yet authoritative for
> anything. Becomes a spec candidate only after Phase B (fact reconciliation + two cold
> mid-tier reviews per [arch/SKILL.md §2](../../../.claude/skills/arch/SKILL.md)) and Phase C
> routing per the prep doc [§0](2026-08-09-arch-prep-session-bus-v2.md).
> **Will supersede (if ratified):** the merged ADR's Part-2 area (D3–D5, §4, F1) — pointer
> added to the old ADR at Phase C, never a silent contradiction.
> **NOT authoritative for:** project goal — [README.md#why-this-exists](../../../README.md#why-this-exists);
> chips/handoff/calibration (ADR Parts 1/3/4 stand).
> **Current as of 2026-08-09.** Branch: `claude/pipeline-chips-auto-sessions-e9b6de`.

## §1 Context — inputs (all from arch-prep §1, verbatim-faithful)

**Goal:** automate /arch ↔ /pipeline ↔ /dispatcher signalling over cross-session messaging
(CC `SendMessage`; desktop ccd session messaging), removing the operator's manual relay. Full
loop: executing session parks a question → signal reaches the strategy (arch) session → arch
prepares the decision package AND DECIDES → answer-pointer flies back automatically → the
executing session applies it.

**Operator counter-resolutions (ratified inputs, not challenged here):**

1. **ID-cascade at spawn.** Discovery is inverted: nobody discovers peers; the SPAWNER hands
   each child the address book. Parents register children (registering/renaming OTHER
   sessions is schema-allowed); the registry travels down the chain. Arch's own fresh-context
   respawn is the Part-3 handoff moment — address-book handover and context handoff are ONE
   move.
2. **Night autonomy with morning review.** A live top-tier seat MAY resolve parked strategic
   questions overnight: weigh, decide, record. Operator reviews in the morning; wrong
   decisions go back for rework. Supersedes «night: stay parked — never guess»
   ([dispatcher/SKILL.md §3](../../../.claude/skills/dispatcher/SKILL.md) routing seats,
   cited via prep §1 — surface to be updated explicitly) for the case where a live top-tier
   seat is reachable. Safety shape required: decisions recorded + reversible until morning
   where feasible; the morning report is the review gate.
3. **Bursts are acceptable spend.**

**Standing constraints (operator-ratified):** pointer-only messages · untrusted-body +
re-verify · bus never load-bearing (delete it → today's behavior returns) · no daemons · no
new npm deps · capability-check not version-check · artifacts remain the durable truth.

## §2 D1 — design principle: doorbell over mailbox

The durable state machine already exists and already works: park records and answer records
are artifacts (runtime-bridge `park`/`answer`, [arch/SKILL.md §4](../../../.claude/skills/arch/SKILL.md)),
and the operator's manual relay is pure *attention transport* — telling a session «go look».
Therefore the bus carries **attention only, never content and never authority**:

- The **mailbox** (artifacts: park records, answer records, decision records, the registry
  file) is the single source of truth. Nothing changes about how truth is written.
- The **doorbell** (a cross-session message) says only «an artifact at `<ref>` deserves your
  attention». Losing every doorbell loses zero information — only latency.

This makes «delete the bus → today's behavior returns» true *by construction* rather than by
promise: the bus never holds state that anything else needs.

**Two laws** (the whole grammar's safety story reduces to these):

- **Law 1 — no verb without a pull-twin.** Every doorbell verb must name the existing pull
  path that delivers the same outcome without the bus (see the table in §8). A proposed verb
  with no pull-twin is rejected at design time — it would make the bus load-bearing.
- **Law 2 — receivers are idempotent.** Acting on a doorbell always starts by re-verifying
  the pointed-at artifact; a duplicate, stale, or forged doorbell therefore lands on a no-op.

## §3 D2 — addressing: spawn cascade + registry file

**Registry.** A machine-local JSON artifact (session IDs are machine-local), colocated with
runtime-bridge state: `<bridge-state-root>/session-bus/registry.json` [A5]. Draft schema:

```json
{
  "version": 1,
  "generation": 12,
  "updatedAt": "2026-08-09T22:00:00Z",
  "seats": {
    "arch":       { "sessionId": "…", "harness": "ccd|cc", "since": "…", "registeredBy": "launcher" },
    "pipeline":   { "sessionId": "…", "harness": "…", "since": "…", "registeredBy": "arch@gen12" },
    "dispatcher": { "sessionId": "…", "harness": "…", "since": "…", "registeredBy": "pipeline@gen12" }
  },
  "workers": {
    "<taskId>":   { "sessionId": "…", "harness": "…", "since": "…", "registeredBy": "dispatcher@gen12" }
  }
}
```

- **Single-writer per section:** `seats.arch` — written by the launcher or the predecessor
  arch; `seats.pipeline` — by arch; `seats.dispatcher` — by pipeline; `workers.*` — by
  dispatcher. Writes are atomic (write-temp + rename). Any seat change bumps `generation`.
- **Resolve at send time, always.** Senders read the registry at the moment of sending and
  never address from memory; the prompt-embedded book snapshot (below) is bootstrap/fallback
  only, for when the file is unreadable. This structurally kills the stale-address class.
- **Cascade.** Each spawner (a) writes the child's registry entry at spawn (parent knows the
  child id — the one party that naturally has the information [A3]), and (b) embeds in the
  spawn prompt: the registry path + a book snapshot + «your entry is `<role|taskId>`». A
  session never needs to know its own id — all bookkeeping is done by parties that have it.
- **Root seeding.** The arch seat is the cascade root and has no parent. Preferred: the
  launch tooling registers it (the launcher knows the new session's id — «parent registers
  child» with parent = launcher) [A4]; fallback: the operator seeds the root entry once by
  hand. Cold-start manual seeding is acceptable — manual is the baseline the bus degrades to
  anyway.
- **Return addressing for parks.** A park record already carries its `taskId` [A6]; arch
  resolves `park.taskId → workers[taskId].sessionId` via the registry. The parker never
  self-addresses.
- **Known simplification:** one strategy seat per machine (singular `seats.arch`). A second
  arch taking the seat = generation bump + REBIND; the old one keeps outbound ability but
  stops receiving new parks. Matches the operator's single-strategy-seat model.

## §4 D3 — message grammar: four verbs, pointer-only, fire-and-forget

**Body format** — one machine-parseable line, strict-parsed by receivers:

```text
AIF-BUS v1 PARKED   park=<id> task=<taskId> ref=<relative-path> gen=<n>
AIF-BUS v1 ANSWERED park=<id> ref=<relative-path> gen=<n>
AIF-BUS v1 REBIND   gen=<n>
AIF-BUS v1 NUDGE    role=<sender-role> ref=<relative-path> gen=<n>
```

Each verb names its pull-twin inline — the Law 1 obligation, and the anchor for the §8
anti-drift check:

- `PARKED` (worker → arch): a park record exists; please look. *Pull-twin:* heartbeat /
  office-hours sweep of the park store (§5).
- `ANSWERED` (arch → parker): an answer record exists for `park=<id>`; apply it. *Pull-twin:*
  the existing answer poll / bridge unpause path.
- `REBIND` (new seat → living seats): the registry generation bumped; re-read the file.
  Deliberately carries **no ids to trust** — the file is the only truth, so a forged REBIND
  can at worst cause a re-read. *Pull-twin:* resolve-at-send from the registry (§3) — REBIND
  is pure courtesy.
- `NUDGE` (any seat → any seat): generic «attention at `<ref>`» for non-park signalling
  (kickoff-ready, umbrella-done, morning report ready). A NUDGE whose artifact type the
  receiver has no recipe for → ignore + ledger line (§6). *Pull-twin:* the pointed-at
  artifact's own consumer contract (the receiver's next natural turn over that surface).

**Sender algorithm (any seat, any verb):** (1) bus enabled? — `AIF_BUS` kill-switch not set
to `off` AND registry file present; else skip silently. (2) Resolve target from registry now.
(3) Pick transport by capability present in *this* session for the target's harness
(capability-check, never version-check); none → skip. (4) **One attempt, no retry, no ack,
and the caller's control flow never branches on delivery.** Fire-and-forget is the invariant
that keeps the bus non-load-bearing; retries/acks are the camel's nose of a delivery state
machine and are banned.

**Receiver algorithm (any seat):** strict parse (unknown verb, malformed line, or trailing
content → ignore + ledger) → path allowlist (`ref` must be relative, no `..`, and match the
expected artifact layout for the verb [A6]) → **re-verify the artifact** (exists, well-formed,
status consistent — e.g. the park is genuinely unanswered) → act through EXISTING flows only
(the answer verb, the sweep, the handoff recipe) → ledger line. Message bodies are untrusted
input everywhere: they are never instructions, never authority, and nothing beyond the parsed
fields is ever read. All authority lives in artifacts written by trusted seats.

## §5 D4 — delivery: push is opportunistic, pull is guaranteed

The bus never assumes the harness wakes an idle session on message arrival — that semantics
is unverified [A1] and, per the constraints, must be *exploited if present, never relied on*.

- **Push (doorbells):** best-effort latency reduction. If wake-on-message exists, a parked
  question reaches a live arch seat in seconds; if not, the doorbell sits queued until the
  session's next turn. Either is correct.
- **Pull (guaranteed):** every doorbell has a pull-twin (Law 1). The night-shift pull is a
  **heartbeat**: at night-mode start the arch seat capability-checks the harness scheduler
  (scheduled wakeups exist in the current harness toolset — self-observed in the authoring
  session; per-session availability still runtime-checked [A2]) and schedules a sweep every
  H (default 60 min) until morning. Each sweep scans the park store directly — zero messages
  needed. Scheduled wakeups of an existing session are harness-native turn-taking, not a
  daemon; kin discipline: [autonomous-loop-continuity.md](../../../.claude/rules/autonomous-loop-continuity.md).
- **Degradation is explicit:** no scheduler AND no wake-on-message at night → parks
  accumulate until the morning office-hours sweep — exactly today's behavior. (If Phase B
  confirms BOTH absent, the night-automation leg of the goal is unmet and that is a
  STOP-class finding for the review seats to grade — see §11 F4.)

**Burst handling (resolution 3):** a heartbeat sweep processes ALL pending parks in one turn,
oldest first, one decision record each, one ledger. Duplicate doorbells arriving after the
sweep land on no-ops (Law 2).

## §6 D5 — night autonomy: envelope, record, morning gate

The control-model change the operator ordered, given a safety shape:

- **Reversibility envelope.** On each parked question the night seat first classifies the
  decision's application path. **In-envelope** (reversible until morning): branch-local
  commits, design/parameter choices within kickoff caps, ordering/prioritization, REVISE
  dispositions, naming, scope-internal trade-offs. **Hard floor** (never night-autonomous,
  enumerated): merges into shared branches (staging/main/epic); deleting non-generated
  artifacts; anything externally visible (publish, egress, messages to humans); spend
  commitments beyond standing caps; security/permission changes; edits crossing the
  [Artifact Ownership Contract](../../../CLAUDE.md) into maintainer-only surfaces (goal-bearing
  artifacts stay untouchable — the contract is the already-ratified line). Out-of-envelope
  questions stay parked — the old «never guess» policy survives as the floor, with the
  decision package pre-built so the morning decision is cheap.
- **Decision record** (the answer artifact, extended): question · decision package (evidence
  with file:line, options, trade-offs) · decision · rationale · falsifier («wrong if …», H1
  discipline per [phase-research-coverage.md §1.7](../../../.claude/rules/phase-research-coverage.md))
  · reversibility class + concrete undo note ·
  `decided-by: arch-night-autonomous | arch-day | operator` · status
  (`applied | rework | superseded`).
- **Night ledger + morning report.** One artifact per night (`night-ledger-<date>.md`): every
  park handled or deferred, every decision with its class, every anomalous/ignored bus
  message. The ledger is the **named consumer** for all bus warnings — nothing on the bus is
  log-and-hope ([attention-is-not-a-mechanism.md §2](../../../.claude/rules/attention-is-not-a-mechanism.md)
  `#warning-nobody-reads`). Morning: arch compiles the report from the ledger and presents
  it; the operator's review is the authority gate on top of the recorded detection layer.
- **Rework path:** operator marks a decision record `rework` (or says so in the arch
  session); arch re-runs that question as a fresh park cycle with the operator's note as an
  added constraint. The dispatcher routing row gains a branch, not a deletion: «live top-tier
  seat registered & reachable → route park to it; else → stay parked (unchanged)».

## §7 D6 — seat lifecycle and the ONE-move handoff

- **Downward chain:** arch finishes design → spawns /pipeline (registers it, hands the book)
  → pipeline spawns /dispatcher likewise → dispatcher spawns workers, registering each under
  `workers.<taskId>`. Every hop is «parent registers child» — no discovery anywhere.
- **Arch self-handoff (the stacked move):** when arch needs a clean context — exactly the
  Part-3 handoff moment — the old arch spawns the new arch with the context-handoff package
  AND the address book in one spawn prompt, writes the new `seats.arch` entry
  (generation+1), sends `REBIND` to the living seats as a courtesy, and retires. Because
  everyone resolves addresses at send time from the file (§3), correctness never depends on
  the REBIND arriving.
- **Seat death without handoff:** a dead seat's entry goes stale; sends to it fail silently
  (fire-and-forget) and the pull paths still converge. No garbage collection — liveness is
  verified by use, not by a background process (no daemons).

## §8 D7 — kill-switch, degradation matrix, executable claims

`AIF_BUS=off` (env) or absence of the registry file disables all sending; receivers ignore
bus input when disabled. The matrix every row of which must end in «= today»:

| Broken piece | Behavior | Pull-twin that still delivers |
|---|---|---|
| Messaging capability absent in a session | that session sends nothing | park store sweep / answer poll |
| Registry missing or corrupt | nobody sends; next spawn rewrites it | office-hours sweep |
| Doorbell lost (dead target, queue limits) | artifact waits | heartbeat / morning sweep |
| Arch seat down at night | parks accumulate | morning office-hours (= today) |
| Malformed / hostile message | ignore + ledger line | artifacts unaffected |
| Scheduler absent at night | no heartbeat | morning office-hours (= today) |

**Executable claims (rules-as-tests, this repo's ethos):** (1) the degradation claim ships as
a test — run the park/answer suite with `AIF_BUS=off` and with the registry removed; behavior
must be byte-identical to the pre-bus baseline; (2) the verb↔pull-twin table above gets an
anti-drift check (every verb in the grammar names a pull-twin; a verb without one fails the
check) — channel per [rule-enforcement-channel-selection.md](../../../.claude/rules/rule-enforcement-channel-selection.md)
at Phase C.

## §9 Consequences — surfaces this design updates (Phase-C work list)

1. runtime-bridge `park`/`answer` recipes: append best-effort doorbell steps (PARKED after
   park-write; ANSWERED after answer-write with registry lookup by `taskId`).
2. [dispatcher/SKILL.md §3](../../../.claude/skills/dispatcher/SKILL.md) routing row «night:
   stay parked — never guess» → conditional branch per §6 (explicit supersession; run
   /self-reflection on this discipline change at landing time).
3. [arch/SKILL.md §4](../../../.claude/skills/arch/SKILL.md) escalation intake: office-hours
   sweep becomes the fallback + morning-review venue; add ledger review.
4. pipeline/dispatcher spawn recipes: register children + embed the book (§3).
5. night-mode skill: heartbeat setup + morning-report shape (§5–§6).
6. New artifacts: registry schema + path; the verb grammar; `AIF_BUS` kill-switch; the two
   executable claims (§8); supersession pointer in the old ADR (Phase C, same PR).

## §10 Alternatives considered

- **B. Message-carried Q&A** (answer travels in the message body) — rejected: violates
  pointer-only + untrusted-body; a lost message loses an answer → bus becomes load-bearing.
- **C. Artifact mailbox + polling only** (no messaging) — this is exactly the bus's degraded
  mode, not an alternative: without a wake signal the night seat never gets a turn, so C
  alone cannot meet the «automatically at night» clause. A subsumes C as its fallback.
- **D. Central broker session** (a post-office seat routing everything) — rejected: an extra
  moving seat that is a daemon in session clothing, a single point of failure, and it still
  needs the addressing solution to reach the broker — same problem, more hops.
- **A. Doorbell bus over artifact truth** — chosen (§2): the only shape where the automation
  win and the never-load-bearing constraint are the same mechanism rather than in tension.

## §11 Pre-mortem & falsifiers (H1 — «wrong if …»)

- **F1 (D1):** wrong if some flow needs payload delivery to function (an artifact pointer is
  insufficient to reconstruct intent). Expected resolution: fix that flow's ARTIFACT, never
  the bus.
- **F2 (D2):** wrong if the schema forbids the parent learning the child's session id at
  spawn [A3] — then the cascade has no root mechanism and the bus reduces to manual seeding
  everywhere; surface to operator.
- **F3 (D2):** wrong if no launch path can register the root seat [A4] — degrades to
  operator-seeded root (acceptable, stated).
- **F4 (D4):** wrong if BOTH wake-on-message [A1] AND schedulable wakeups [A2] are absent at
  night — the night leg's latency is unchanged vs today and the v2 automation goal is unmet:
  STOP-class finding, back to the operator with the capability gap named.
- **F5 (D5):** wrong if a decision class we call reversible cannot actually be reverted by
  morning review in practice — envelope definition must be audited in Phase B against real
  operations, and tightened if any class fails the undo test.
- **F6 (D3):** wrong if message size/format constraints [A7] cannot carry even the one-line
  grammar — would force an artifact-side inbox with pure NUDGE semantics.
- **Contention:** two spawners writing the registry concurrently — bounded by single-writer
  sections + atomic rename (§3); residual risk accepted.
- **Injection:** hostile doorbells — bounded by strict parse + allowlist + Law 2 re-verify +
  registry-file-only trust (§4); a forged message can waste at most one re-read.
- **Double delivery to aif-managed paused tasks** (bridge unpause may already cover ANSWERED
  [A8]) — bounded by Law 2 idempotency; at worst a redundant no-op turn.

## §12 Phase-B fact checklist (every [A#] must be verified or the design corrected)

- **[A1]** Does message delivery grant an idle receiving session a turn (wake-on-message), in
  CC and in ccd? Queue limits?
- **[A2]** Which scheduling capability is actually reachable from a night arch seat
  (per-session wakeups / scheduled tasks), and on which harness?
- **[A3]** Does spawn return/expose the child session id to the parent in both harnesses
  (Agent tool id/name; ccd spawn path)? Can a parent set a child's title/name (self-observed
  candidates in the authoring harness: `ccd_session_mgmt` `list_sessions` / `send_message` /
  `set_session_title` — present as tools; semantics unverified)?
- **[A4]** Does any launch path expose the new session's id to the launcher (root seeding)?
  Does anything expose a session's OWN id (would simplify root seeding; not required)?
- **[A5]** Exact runtime-bridge state root for the registry file; write-permission reality.
- **[A6]** Park/answer record schema: `taskId` field present; park store path (pull-sweep
  target); answer status field (idempotency anchor); artifact-layout patterns for the path
  allowlist.
- **[A7]** Message length/format constraints per transport (one-line grammar fits?).
- **[A8]** Do aif-managed paused tasks already unpause on answer via the bridge (is ANSWERED
  redundant for them)?
- **[A9]** The exact current text of the dispatcher routing row to be superseded (§6, §9.2).
- **[A10]** Cross-harness reach: can a CC CLI session message a ccd desktop session and vice
  versa? Registry `harness` field routing reality.

## §13 Self-application note

This spec proposes attention-transport for a factory whose thesis is «fail at the earliest
reachable channel». Applied to itself: the bus's failure channel ordering is design-time (Law
1 rejects load-bearing verbs) → send-time (capability-check skips) → receive-time (strict
parse + Law 2) → ledger (named consumer) → morning gate (human authority). No failure mode
waits for CI, and none depends on someone happening to look — the ledger and the morning
report are the structured consumers. The spec itself enters the standard contour: Phase-B
skeptic seats get this file path only (cold per [arch/SKILL.md §2](../../../.claude/skills/arch/SKILL.md)),
and the two §8 executable claims turn the design's central promise into tests the factory can
run without trusting this prose.
