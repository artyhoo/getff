<!-- scope: ADR for the 2026-08-09 /arch contour «pipeline chips + session signal bus + context handoff» — the reviewed design, round 2 (post cold two-altitude review). Supersedes the design-state prep-doc 2026-08-09-arch-prep-pipeline-chips-session-bus.md (now historical). Implementation lands in later stages; SKILL.md/hook sections own their surfaces after they ship. -->

# ADR: Pipeline chips + park-chips + context handoff (session bus deferred)

> **Status:** Proposed — /arch §2 cold-reviewed (round 1: REVISE×2 → round-2 revision; round-2
> delta seats: REVISE×2 with ALL round-1 findings closed and bounded new findings — applied
> below; the 2-round cap is reached, so the remaining judgment items are operator forks in §7:
> F1 transport pivot, F10 D7 audience). The round-1 reviews changed the Part-2 transport — §4.
> **Date:** 2026-08-09. **Deciders:** operator (goals + CLOSED forks ratified in-contour, see
> [prep-doc §4/§5](2026-08-09-arch-prep-pipeline-chips-session-bus.md)); Part-2 transport pivot
> is this contour's recommendation under the operator's «rethink for more value» directive —
> flagged for explicit acceptance in §7.
> **Authoritative for:** the v1 design — decisions D1–D9, the friction-inventory evidence base
> (§2), rejected alternatives + the transport scoring (§4), implementation staging (§6),
> verification items (§7).
> **NOT authoritative for:** project goal — [README.md#why-this-exists](../../../README.md#why-this-exists);
> dispatch/choreography mechanics — [pipeline/SKILL.md](../../../.claude/skills/pipeline/SKILL.md),
> [dispatcher/SKILL.md](../../../.claude/skills/dispatcher/SKILL.md), [arch/SKILL.md](../../../.claude/skills/arch/SKILL.md)
> (each owns its sections once implementation merges); tier→model instantiation —
> [night-mode/SKILL.md](../../../.claude/skills/night-mode/SKILL.md) «Overnight model posture».

## §1 Context

Three operator goals (2026-08-09, [prep-doc §1](2026-08-09-arch-prep-pipeline-chips-session-bus.md)):
(1) replace paste-tab dispatch 1-liners with one-click desktop chips; (2) use cross-session
messaging (CC 2.1.224) for /arch ↔ /pipeline ↔ /dispatcher signalling — with an explicit
directive to **rethink for more value**, not rubber-stamp the first topology; (3) a discipline
for continuing long sessions in a fresh session instead of degrading.

Capability evidence: [prep-doc §2](2026-08-09-arch-prep-pipeline-chips-session-bus.md) (all
verified 2026-08-09), plus this contour's deltas:

- **ccd tool-family constraint (verified from live schemas, 2026-08-09):** `set_session_title`,
  `send_message`, `get_session` all carry «Must not be the current session» — a session cannot
  title ITSELF, so role-discovery-by-declared-title is impossible with the present roster. And
  `send_message`'s unattended exclusion covers ONLY «scheduled-task runs and remote-dispatched
  sessions» — an operator-launched local session left running overnight (the
  [night-mode/SKILL.md](../../../.claude/skills/night-mode/SKILL.md) class) retains the
  capability. Both facts are load-bearing for the §4 transport verdict.
- **F5 CLOSED — split verdict.** Host side: `TELEGRAM_BOT_TOKEN`/`TELEGRAM_USER_ID` UNSET in
  CC-session environments (probed live 2026-08-09; not in `~/.claude/settings.json` env, not in
  `.zshenv`), so `tg-notify.sh` silently skips — the [dispatcher §2.4c](../../../.claude/skills/dispatcher/SKILL.md)
  *filtered* channel is configured-in-prose but non-live. Container side: `TELEGRAM_BOT_TOKEN`
  IS set in `aif-handoff-agent-1` (probed 2026-08-09), so aif's *raw* per-status-change notifier
  still pings the phone, unfiltered. Net: «noticing» is covered (noisily); the expensive part of
  the R3 chain — context reconstruction, deciding in the right place, relaying the answer back —
  is covered by nothing.
- **Live session topology (ccd `list_sessions`, limit-25 probe — first page, not the full
  population; 2026-08-09):** sessions across 4 repos in ~2 days; 6+ parallel rules-as-tests
  sessions in one evening (PRs #1293–#1320); a real night gap (00:42→10:32 on 2026-08-08). Two
  repo-root sessions with merged PRs (#1269, #1267) show the app does NOT always isolate — see
  D1's mandatory isolation step.
- **Chip-continuation dogfood:** this ADR's authoring session was itself spawned from the
  prep-doc's continuation chip into a fresh app-managed worktree on the design branch — the
  Part-3 attended continuation channel worked end-to-end before being specified.
- **Hook delivery is renderer-owned, and PreCompact never reaches the plugin output:**
  `plugin/hooks/hooks.json` is emitted by
  [`scripts/render-harness-config.mjs`](../../../scripts/render-harness-config.mjs) («emitPlugin
  is the single source of truth», with a recorded drift incident for a hand-registration miss)
  — AND its plugin emit path silently skips events outside the ZCode set, PreCompact included
  (`render-harness-config.mjs:421`), so D8's reachable renderer surface is the claude-side emit
  (`emitClaude`, `render-harness-config.mjs:150`), not a plugin twin.

Standing constraints (operator-ratified, [prep-doc §4](2026-08-09-arch-prep-pipeline-chips-session-bus.md)):
chips ADDITIVE (aif option always alongside; human click stays the dispatch channel); any relay
mechanism pointer-only, untrusted-body + re-verify, never load-bearing
([attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md));
night posture unchanged; no daemons; no new npm deps; capability-check not version-check
([dual-implementation-discipline.md §4](../../../.claude/rules/dual-implementation-discipline.md));
300k is a planning trigger, not a wall.

## §2 Friction inventory (the rethink's evidence base — direction 1 executed)

Manual relay actions the operator performs between sessions today, enumerated from skill
surfaces + live probes. **Honesty note (round-1 finding, numbers corrected round 2):** the
`Rate` column is estimated, NOT measured per-umbrella. Measured sample (30 merged PRs,
2026-08-09): 7 carry substantive `## Parked questions` content (#1317 #1315 #1311 #1302 #1292
#1290 #1289) plus the PR #1284 SIX-fork burst at one stage boundary — parks are real, recur,
and arrive burst-shaped; the template heading is a stub (`none`) when nothing parked
([.github/pull_request_template.md:53-55](../../../.github/pull_request_template.md)). The
design below is chosen to be **rate-robust** (works for singles and bursts alike).

| # | Relay action | Evidence | Rate × stakes | Closed by |
|---|---|---|---|---|
| R1 | Copy a §10 1-liner into a new CC tab | [pipeline/SKILL.md:467](../../../.claude/skills/pipeline/SKILL.md) «Paste into a new CC tab» | high × low | **D1 chips** |
| R2 | Open a fresh session to continue a long contour from a residue doc | this contour itself (prep-doc §0) | med × med | **D1 chips** (continuation chip; dogfooded) |
| R3 | Parked strategic question: notice it → open the right session → reconstruct context → decide → type the answer back | [dispatcher/SKILL.md §3](../../../.claude/skills/dispatcher/SKILL.md) Type 2 + routing-seats table; F5 probe | unmeasured (burst-shaped) × **high** (a parked task stalls its umbrella) | **D3–D5 park-chips** |
| R4 | Morning batch sweep of night-parked items | [dispatcher/SKILL.md §3](../../../.claude/skills/dispatcher/SKILL.md) night row (`questions.ts --project`); [arch/SKILL.md §4](../../../.claude/skills/arch/SKILL.md) | daily in night periods × med | park-chips emitted by night-local runs surface the same items clickably by morning (D3); the sweep stays the mechanical backstop |
| R5 | Relay a reviewer verdict back to the orchestrator session | [arch/SKILL.md:76](../../../.claude/skills/arch/SKILL.md): review seats are in-session subagents | low × low | already in-session; nothing to build |
| R6 | Notice «stage done» and invoke the next planning step | tg raw pings (container, unfiltered); glancing at tabs | med × low | chips carry the next action in the §10 report; wake-up edges stay REJECTED (§4) |

## §3 Decisions

### D1 — Dispatch chips at two emission points, with the gates carried INTO the chip

/pipeline §10 emits one chip per Stage 1-liner; /arch §3 exit routing emits a chip per routed
next action **except** the single-task `bridge: auto` route — there the write-time hook
([.claude/hooks/runtime-bridge-dispatch.sh:100](../../../.claude/hooks/runtime-bridge-dispatch.sh))
already dispatches to aif, and a chip would be a second dispatch path for the same kickoff
(round-1 finding; the [dispatcher §2.0](../../../.claude/skills/dispatcher/SKILL.md) probe's
three signals are all empty for a task still in `backlog`, so it cannot catch that collision).
/dispatcher emits no *dispatch* chips (REST + self-advance,
[dispatcher/SKILL.md:85](../../../.claude/skills/dispatcher/SKILL.md)) — but it IS the park-chip
emitter (D3).

Chip contract — **title** = a ≤60-char imperative with the DISTINGUISHING tokens first
(`spawn_task` caps the label; real 1-liners run 85–146 chars with the distinguishing
`§section`/Worker/Mode tokens in the tail — so the title is e.g. `S2 auth: dispatch
[<umbrella>]`, never the raw 1-liner); **tldr** = the dropped Action-queue context (`When` /
`Waiting on`); **prompt** = self-contained, carrying its gates, AND rendered in full in the §10
report next to the chip (the operator can inspect what a click authorizes — the payload is not
shown in the chip UI):

1. **Isolation first (mandatory, STOP-on-fail):** enter/verify an isolated worktree before any
   write — [parallel-subwave-isolation.md §1](../../../.claude/rules/parallel-subwave-isolation.md)
   mandates worktree setup as the first step of every parallel prompt, and the observed
   population contains unisolated repo-root sessions with merged PRs (#1269/#1267 — §1). The
   app's worktree default is NOT assumed (F3 is unverified — the «25/25» statistic conditions
   on the branch field the app writes together with the worktree, so it is tautological); the
   prompt step is the mechanism, the default is a convenience.
2. **In-flight probe, widened:** the [dispatcher §2.0](../../../.claude/skills/dispatcher/SKILL.md)
   three-signal dedup PLUS an aif queue scan (`curl $RUNTIME_BRIDGE_AIF_URL/tasks` filtered by
   kickoff slug) — the queue is where the §2.0 signals are blind (memory-codified discipline:
   probe parallel work *including the aif queue* before dispatch).
3. **Stage-gate precondition, resolved at CLICK time, not frozen at plan time:** for stage-N
   chips, the prompt opens with the gate PREDICATE + the resolution instruction — «verify
   Stage N-1 of `<umbrella>` is merged: derive its head branch from the umbrella's PR list /
   kickoff / state.md NOW, then `gh pr list --search "is:merged head:<derived> base:staging"`;
   empty → HALT and report» ([pipeline/SKILL.md §6](../../../.claude/skills/pipeline/SKILL.md)).
   A plan-time literal branch name would be wrong on the factory path — aif names branches
   per-task at dispatch time and harvest may rename — making the HALT fire forever on a branch
   that never existed (round-2 finding). Without the gate, chips strip `When`/`Waiting on` off
   the Action queue and become premature-dispatch buttons (`#flat-queue-no-gates`).
4. cwd = repo root; kickoff/residue path + «read and execute».

**Assertion mechanism (not hope):** the gates above are asserted, not trusted to emitter
diligence — S1 EXTENDS [principle 18](../../../packages/core/principles/18-meta-orchestrator-output-format.test.ts)'s
`REQUIRED_SUBSTRINGS` so the rendered report's chip-prompt block must literally contain the
isolation, probe, and gate lines (the test already pins the Action-queue grammar; the chip
block joins it). **Falsifier:** a chip prompt that omits any of steps 1–3 → the extended test
is red before the report ships; an incident reaching a click means the assertion itself was
skipped — fix the emitter and the test, not the operator.

### D2 — Chips are additive, capability-gated, ephemeral-honest

Emit chips only when `spawn_task` is invocable in the session (capability-check, never
version-sniff; note the deferred-tool nuance: a tool can be *named* in the roster yet require a
schema fetch before first call — the emitting skill loads it before emitting). Fallback =
today's paste-tabs, verbatim, always rendered (chips are an addition to the §10 report, not a
replacement — the report + kickoff files stay the durable record; chips die on app restart).
The aif autonomous option is always presented alongside (`#tabs-by-default-when-bridge-up`,
[pipeline/SKILL.md §10](../../../.claude/skills/pipeline/SKILL.md)). Superseded chips get a
best-effort `dismiss_task`. Control model unchanged: the operator's click IS the «maintainer
opens a fresh session» channel — `#worker-dispatch-via-subagent` untouched.

**allowed-tools honesty (round-1 finding; round-2 correction):** skill-frontmatter
`allowed-tools` is NOT enforced by CC (upstream issue #18837; recorded at
[SSOT #121](../../../docs/meta-factory/prior-art-evaluations.md) and
[21-shipped-agent-tools-valid.test.ts:30](../../../packages/core/principles/21-shipped-agent-tools-valid.test.ts)).
Capability = runtime roster probe, ONLY — S1 makes **no** `allowed-tools` MCP additions: the
round-1 «declarative forward-compat add» would turn principle 21 RED deterministically
(`MCP_TOOL_RE = /^mcp__[^_]+__/` at
[21-shipped-agent-tools-valid.test.ts:69](../../../packages/core/principles/21-shipped-agent-tools-valid.test.ts)
rejects underscored server segments — every `mcp__ccd_session__*` / `mcp__ccd_session_mgmt__*`
name fails it), and widening that regex is a `packages/core/principles/` edit owned by
meta-tests CI per the [CLAUDE.md](../../../CLAUDE.md) Artifact Ownership Contract — routed as a
separate owner-visible issue (the regex's «server segment has no underscores» premise is false
for live MCP servers generally), never an S1 side effect. The skill prose notes the probe-only
posture in one line.

### D3 — Part-2 relay = a PARK-CHIP, not a message bus (transport pivot, round 1)

When the **/dispatcher session** (the v1 emitter — the only one staged; Worker-emitted
park-chips are a revisit item tied to F7, since factory containers configure no ccd server)
detects a **strategic** park (dispatcher §3 Type 2), it emits — capability-gated like D2 — a
chip:

> title: `Decide: <one-line question> [<umbrella>]`
> prompt: parked task-id + kickoff path + the §3 routing-seats context + instruction: fetch the
> park payload from aif (`questions.ts`), assemble a decision package (question · evidence ·
> reasoned recommendation + falsifier per the H1 discipline · options with consequences),
> present it, wait for the operator's decision, then apply it via `answer.ts` and record it in
> the task comment + PR `## Parked questions` (the existing
> [dispatcher/SKILL.md §3](../../../.claude/skills/dispatcher/SKILL.md) Type-2 path).

One chip may carry a batch («Decide 6 parked questions [beta-delivery]») — bursts are the
observed shape (§2). The operator clicks when ready; the spawned session pre-reads everything
and becomes the decision venue — closing all four R3 steps (notice / reconstruct / decide in
context / relay back) with **zero new transport machinery**: the chip channel D1 already ships.
Coverage honesty: a park raised while no /dispatcher session is alive produces no chip and
falls back to the R4 sweep — the closure claim holds for dispatcher-driven umbrellas, which is
where Type-2 parks arise. **Seat:** `spawn_task` cannot name a model, so the chip's `tldr` +
prompt first line state the recommended seat class per [arch/SKILL.md §4](../../../.claude/skills/arch/SKILL.md)
routing («intent/goal fork — open in a top-tier session»); the operator's model pick at click
is the seat control (whether a spawned session inherits the emitter's model is an F9
observation).

Why this beats the messaging bus it replaces (full scoring in §4): no receiver discovery
(impossible with the current roster — sessions cannot self-title), no auto-run turn in a
top-tier seat (a chip is inert until clicked — an operator-launched night-local run can emit
one at 03:00 and it simply waits until morning, which also serves R4), no
message-as-user-turn injection surface, and burst-robustness by construction. Alignment note:
the project's own context-hygiene doctrine says deciding context lives in artifacts, not in a
live session's chat — so «the session where the deciding context lives» is any fresh session
reading those artifacts, which is exactly what the chip spawns; anything load-bearing that
exists only in a live /arch dialogue is a Part-3 residue-discipline violation, not a reason to
route messages into that dialogue.

**Falsifier:** if live usage shows the operator systematically answering parks faster via some
other path while park-chips rot unclicked, the edge idles harmlessly (zero standing cost) and
is retired by deleting one skill paragraph.

### D4 — Park-chip mechanics: pointer-only, re-verify, tool ownership

- The chip prompt carries **pointers** (task-id, kickoff path), never the park payload body —
  the spawned session re-fetches from aif (`questions.ts`, read-only) and treats any inlined
  hint as untrusted (the «REPORT supplementary, mechanical state wins» pattern,
  [pipeline/SKILL.md §1](../../../.claude/skills/pipeline/SKILL.md)). No matching parked task →
  report-and-stop (the chip may be stale; `dismiss_task` is best-effort, not guaranteed).
- Application stays with the owning CLI: the decision session runs
  `answer.ts --task <id> --answer "<decision>" --decision <request_changes|resume>` itself (a
  fresh session has full tools — no /arch frontmatter change is needed for Part 2 at all).
- The decision is durable in the aif task comment + PR `## Parked questions`; the chip is
  ephemeral by design (restart loses the chip, never the park — the R4 sweep remains the
  mechanical backstop, unchanged).
- Class routing preserved: the [dispatcher §3](../../../.claude/skills/dispatcher/SKILL.md)
  seat table still routes technical forks to autonomous resolution and environment issues to
  `/aif-doctor`; ONLY the strategic class emits a park-chip. The spawned decision session
  applies [arch/SKILL.md §4](../../../.claude/skills/arch/SKILL.md)'s class split internally
  (in-scope architecture → senior-seat answer; intent/goal → operator).

### D5 — Messaging bus: DEFERRED with a recorded revisit trigger

The ccd `send_message`/CLI `SendMessage` bus is NOT built in v1. Grounds (round-1 confirmed):
receiver discovery is impossible with the current tool family (self-title forbidden —
schema-verified §1); the unattended exclusion does not cover operator-launched night-local
sessions, so a bus edge re-admits the auto-run-at-03:00 cost through the night-mode class
([arch/SKILL.md:34](../../../.claude/skills/arch/SKILL.md): the target is by definition a
top-tier seat); messages arrive as user turns (an injection-shaped surface needing
security-sensitive prose in two skills); and the transport's own schema advises against
orchestrating background work over it. The two-shape pointer protocol designed in round 1
(`parked` / `answer-ready`, untrusted-body + re-verify) is on file in this ADR's git history.
**Revisit trigger:** a measured need for live-seat pre-staging (the one property chips lack)
PLUS either a self-title/registration capability appearing in the ccd family OR F4 verifying
that CLI `SendMessage` supports deterministic session naming — then the recorded protocol
extends the same park flow without redesign.

### D6 — Context-handoff policy (Part 3, settled)

Trigger plans the handoff; the work class decides where the tail lands:

| Window | T_soft (plan handoff) | Working range past T_soft | Backstop |
|---|---|---|---|
| 200k | 70% (~140k) | up to auto-compact | PreCompact residue snapshot (D8, pending #108 gate) |
| 1M | 300k (provisional, operator floor) | up to ~500k (provisional), esp. mechanical tails | none in practice → the D7 Stop-arm carries it alone |

**Remaining-work classifier (prose, judgment):** past T_soft at a stage boundary the session
classifies its tail — «mechanical» (commit/merge/regen; errors caught by CI + rules;
degradation non-fatal) → finish in place up to the working-range ceiling; «judgment» (design,
review, novel debugging) → write residue → handoff (continuation chip when `spawn_task` is
invocable, else a paste 1-liner) → fresh session. Break at stage boundaries, never
mid-harvest. Residue artifacts: /dispatcher sessions need NOTHING new (restart-safety D10,
[dispatcher/SKILL.md:164](../../../.claude/skills/dispatcher/SKILL.md)); design/arch sessions
bring the spec/prep-doc to «readable from zero» + a 5-line handoff block (the prep-doc → this
ADR chain is the live example). Prior art: ecosystem handoff/recap skills exist
([SSOT #230](../../../docs/meta-factory/prior-art-evaluations.md) `mattpocock/skills` handoff,
REFERENCE; [SSOT #122](../../../docs/meta-factory/prior-art-evaluations.md) session-recap
family) — ours differs by binding the trigger to measured tokens and the tail-class split;
the transcript-reading channel matches #122's registered note. Numbers are parameters — D9
calibrates.

### D7 — Handoff trigger: a context-arm in the already-wired Stop hook

Extend [.claude/hooks/end-of-turn-reminder.sh](../../../.claude/hooks/end-of-turn-reminder.sh)
(the sole `Stop` entry in `.claude/settings.json`, jq-verified 2026-08-09) with a context-arm.
Implementation constraints (each one round-1-hardened):

- **Estimator:** last MAIN-THREAD assistant entry — `select(.isSidechain != true)` is
  REQUIRED: subagent turns share the transcript (field verified live), and the target sessions
  are exactly the subagent-heavy ones (/arch §2 dispatches two reviewers; /pipeline,
  /dispatcher carry `Agent`). Sum `.message.usage.input_tokens + cache_read_input_tokens +
  cache_creation_input_tokens` (fields verified live; jq-over-transcript precedent at
  `end-of-turn-reminder.sh:148-168`).
- **Window resolution:** `.message.model` on the same entry, via a model→window table with
  explicit `unknown → 200k-conservative` fallback, PLUS the self-evident override «observed
  usage >200k ⇒ 1M window». Honest limit stated in the arm's comment: the 1M window is opt-in
  and the transcript does not record the request, so the table gives an upper bound — «window
  discrimination is not *reliably* available», not «not available» (round-1 correction).
- **Placement (load-bearing):** the arm computes its line at the TOP of the hook and every
  early return routes through the F10 pattern's exit shim — the hook's own 2026-07-24
  postmortem proved a bottom-placed arm silent in its motivating case
  (`end-of-turn-reminder.sh:40-137`, «POSITION IS LOAD-BEARING»); the S2 kickoff must quote
  this constraint, not merely cite the file.
- **Delivery:** `decision:block` + `reason` (the only model-reaching channel,
  `end-of-turn-reminder.sh:398-403`); when another branch already blocks, the context line
  rides the same block (composition rule, `:407-409`).
- **Debounce:** once per session per tier via `${TMPDIR:-/tmp}/aif-ctx-<session_id>-<tier>`
  (guarded expansion — the script runs `set -euo pipefail`; the story-flag precedent uses the
  same guarded form at `:282`/`:386`). Known limitation, accepted: after an auto-compact the
  flag stays spent, so a re-climbing 200k session is covered by D8's snapshot, not a second
  reminder.
- **Audience (consumer-shipped surface):** this hook ships to consumers via `install.sh` +
  `setup.d/10-skills.sh` (its header: «NOW SHIPPED to consumer CC projects (GH #934) …
  Consumer-safe: no framework-internal artefact dependency»). The arm's reminder prose is
  therefore GENERIC — «context ≈ N tokens; if substantial judgment work remains, write a
  handoff note and continue in a fresh session; if the tail is mechanical, finishing here is
  fine» — with zero framework-artifact references; the framework-specific residue discipline
  lives in this ADR + skill docs, not in the shipped string
  ([dual-implementation-discipline.md §3](../../../.claude/rules/dual-implementation-discipline.md)
  audience triage). Mechanism cost, stated: delivery is `decision:block`, so the arm adds a NEW
  blocking path (≤1 per tier per session — the debounce bounds it) in every consumer session
  that crosses a tier, including turns that today exit silently. This audience decision changes
  third-party behaviour → it is an operator fork (F10), recommended not fiat-closed; the
  alternative (framework-presence gate → operator-only) is one capability check.
- **ZCode census consequence (owned, not hand-waved):** on ZCode synthetic transcripts the
  usage fields may be absent → the arm is inert there. Per the census's own row-13 precedent
  (one working arm + one inert arm ⇒ `zcode-gap`), landing D7 flips
  [zcode-parity-doctrine.md §2](../../../.claude/rules/zcode-parity-doctrine.md) row 9
  `parity → zcode-gap` and moves the rollup counts — that census edit is IN S2's surface list
  (§6).

### D8 — PreCompact residue snapshot: the hook WRITES, gated on SSOT #108

Round-1 correction: a non-blocking PreCompact hook gives the model no execution window — a
«reminder to write a residue before compaction» is undeliverable as specified. The workable
shape is the one already registered in the SSOT: the hook **itself writes** the state,
deterministically ([SSOT #108](../../../docs/meta-factory/prior-art-evaluations.md): PreCompact
«save wave-state before compaction»). D8 v2:

- `precompact-residue.sh` on `PreCompact` (matcher `auto`): extracts from the transcript the
  session anchor (ai-title) + the LAST `AIF_RECAP_MARKER` recap block (a model-authored summary
  already in the transcript; the marker is lang-pack-sourced and the recap fires conditionally,
  so the FALLBACK is the last main-thread assistant text excerpt — anchor + timestamp + branch
  are always written) — no model turn required, nothing blocked.
- **Named reader (a residue nobody reads is `#warning-nobody-reads`):** the residue file rides
  the [pipeline/SKILL.md §1](../../../.claude/skills/pipeline/SKILL.md) Step-1 injection block
  (S2b adds one line to the existing cache `cat`), so the next /pipeline invocation surfaces
  it; and the D6 handoff prose instructs a continuing session to check the path. Location:
  per-session file in the coordination dir — a deliberate deviation from #108's
  `.claude/session-state.md` sketch (per-session beats one clobbered file; recorded here, not
  silent).
- **Gate before wiring, rescoped to the item (round-2 correction — #108 is a COMPOSITE row):**
  two of its five hook items already shipped, so «#108 is open» holds only for the PreCompact
  ITEM; the real reasons it is operator-gated are the `.claude/settings.json` touch
  (maintainer-landed, agent-uncommittable) and that #108's registered bench items (exit-2 +
  additionalContext contracts) belong to OTHER rows — D8's hook blocks nothing and injects
  nothing, so its own gate is a minimal liveness bench: PreCompact(auto) fires with
  `transcript_path` on a real auto-compact + the file is written. S2 splits: S2a (D7 Stop-arm)
  proceeds; **S2b (D8) waits for the operator's GO on the PreCompact item + that liveness
  bench** as its first implementation step.
- Delivery surfaces when unblocked: the hook script; the renderer's claude-side emit
  (`render-harness-config.mjs:150` — the plugin output cannot carry PreCompact, `:421` skips
  it, §1); a census row 21 in [zcode-parity-doctrine.md §2](../../../.claude/rules/zcode-parity-doctrine.md)
  classified `cc-only` (`PreCompact` ∉ `ZCODE_EVENTS`; rollup «Total = 20» becomes 21);
  `@cc-only-rationale` marker (edit-time gate `check-hook-marker.sh` enforces); the operator jq
  snippet for direct-settings sessions.

### D9 — Calibration research task (Part 4, dispatched via kickoff)

A factory research task calibrates the D6 numbers; scope, pre-mortem, acceptance, freshness
bar and traps live in the kickoff:
[.claude/orchestrator-prompts/context-degradation-calibration/kickoff.md](../../../.claude/orchestrator-prompts/context-degradation-calibration/kickoff.md)
(rides this PR to staging per [kickoff-staging-placement.md](../../../.claude/rules/kickoff-staging-placement.md)).
Round-1 corrections applied: the kickoff carries
`<!-- bridge-profile: Z.AI GLM-5.2 SDK -->` (the unique executor-profile display name from the
live `/runtime-profiles` list) — required because the `fidelity-verdict-in-pr-body` check is
registered in staging branch protection, making the acceptance-contour marker rule ACTIVE
([tier-home.md](../../../packages/core/templates/shared/tier-home.md) §2 lift; the marker is
dispatch-inert per [runtime-bridge-dispatch.sh:100](../../../.claude/hooks/runtime-bridge-dispatch.sh),
so the no-`bridge: auto` sequencing note is unaffected). And the /arch §1.5 stations apply to
the OUTPUT: the research-patch gets a cold K1/K2 pass + a verifier `GO | rework | kill` before
its numbers enter D6/D7 (recorded in the kickoff §4).

## §4 Options considered (Part-2 transport — the round-1 pivot)

Round 1 drafted a two-shape messaging bus (`parked`/`answer-ready` over ccd `send_message`).
The cold reviews surfaced that the strongest alternative — the chip channel Part 1 already
builds — had never been scored. Scored:

| Property | Messaging bus | Park-chip (D3) |
|---|---|---|
| Receiver discovery | required; impossible today (no self-title — §1) | none needed |
| Operator away / night-local sender | auto-runs a top-tier turn (wake-up cost) | chip waits inert; doubles as the morning surface |
| Burst of N parks (observed shape, §2) | N auto-run turns, serialized | one batch chip, one click |
| Injection surface | messages arrive as user turns in a LIVE seat's stream | smaller, not zero: payload is AI-authored and UI-hidden, but lands in a FRESH session with no accumulated context/trust; §10 report renders it for pre-click inspection |
| Survives app restart | message persists in transcript | chip dies; park state + sweep unaffected either way |
| Latency hiding (pre-staged package before operator arrives) | **yes — the one bus advantage** | no — one turn after click |
| Decision-venue tier | over-determined (always the live top-tier seat — the wake-up cost) | under-determined (`spawn_task` names no model) — mitigated by the D3 seat line + operator's pick at click |
| New machinery | discovery + guards + 2 protocol surfaces | zero (reuses D1/D2) |

Verdict: park-chip wins on every axis but latency hiding, whose value is discounted by the
burst-shaped arrival pattern (a pre-staged package per message is exactly the serialization
cost). Bus → DEFERRED (D5) with the revisit trigger recorded. Also rejected, unchanged from
round 1: broadcast wake-up edges (`kickoff-ready`/`stage-merged`/`umbrella-complete` — auto-run
cost with no human present; /pipeline re-probes at invocation anyway); a bus-only `handoff`
edge (messaging cannot spawn sessions; chips already make continuation one click); hub
daemons / file-watch buses / aif-mediated relay (no-daemons constraint; aif already IS the
durable park store).

## §5 Consequences

- **Easier:** stage dispatch and contour continuation become one click (R1/R2); a parked
  strategic question becomes a click that opens a pre-briefed decision venue (R3), including
  next-morning for night-parked items (R4, pending F9's visibility check); long sessions get a
  deterministic nudge at the planning threshold — with the shipped-v1 caveat that a 200k
  session re-climbing after auto-compact gets no second nudge until S2b's snapshot lands
  (debounce spent; D8 parked on F8).
- **Harder / new surfaces:** chip prompts become load-bearing carriers of three gates
  (isolation, in-flight+aif probe, stage-gate) — emitter prose must keep them verbatim; the
  Stop hook grows a second arm with strict placement constraints (test material extends);
  the pipeline report grammar SSOT ([references/output-format.md](../../../.claude/skills/pipeline/references/output-format.md),
  enforced literally by [principle 18](../../../packages/core/principles/18-meta-orchestrator-output-format.test.ts))
  must be edited in lockstep with §10 — it is IN S1's surface list; and R1/R2/R3 now ride ONE
  capability (`spawn_task`) — where it is absent (non-desktop harness, F7 classes) all three
  degrade at once, to paste-tabs + the R4 sweep (survivable and honest, but a correlated
  single-point property the bus topology did not have).
- **Revisit when:** D5's trigger fires (bus); #108 operator decision lands (D8); calibration
  lands (D9 → D6/D7 parameters); ≥1 incident of a chip-gate omission causing an unisolated
  write / double dispatch / premature stage (D1 falsifier); a ccd self-title or
  session-registration capability ships.

## §6 Implementation staging (exit routing input)

| Stage | Scope | Surfaces | Route |
|---|---|---|---|
| S1 chips | D1+D2: §10 chip emission + /arch §3 chip emission (with route discrimination), gates-in-prompt + the principle-18 substring extension, runtime capability probe (NO `allowed-tools` MCP adds — D2) | `pipeline/SKILL.md` §10, `references/output-format.md` + `18-meta-orchestrator-output-format.test.ts`, `arch/SKILL.md` §3 | in-session (discipline-bearing skill prose + enforced-grammar lockstep) |
| S2a Stop-arm | D7 with all seven constraints + tests | `.claude/hooks/end-of-turn-reminder.sh`, its test file, `zcode-parity-doctrine.md` §2 (row-9 flip + rollup) | in-session or factory (constraints are quotable; the census edit is doc-judgment — prefer in-session); **F10 gates the shipped wording** |
| S2b PreCompact | D8 — **blocked on F8** (operator GO on the #108 PreCompact item); first step = D8's liveness bench | hook script, `scripts/render-harness-config.mjs` (emitClaude path), `zcode-parity-doctrine.md` §2 (row 21), `pipeline/SKILL.md` §1 injection line, operator jq hand-off | parked until F8 |
| S3 park-chips | D3+D4: dispatcher §3 Type-2 park-chip emission paragraph + decision-session protocol | `dispatcher/SKILL.md` §3 | in-session; **after S1 AND F1 ratification** |
| S4 calibration | D9 dispatch after staging merge | aif factory | `/dispatcher context-degradation-calibration` |

S1 ∥ S2a parallel-safe (disjoint surfaces); S3 after S1; S2b parked; S4 after this PR merges.

## §7 Open forks / verification items (updated round 2)

| # | Item | Status |
|---|---|---|
| F1 | Part-2 transport (**operator fork**) | park-chips (D3–D5, this contour's recommendation) vs the round-1 messaging bus (recorded in git history + D5 revisit trigger) vs sweep-only. **OPEN — operator ratifies the pivot**; S3 implementation waits on it (goal 2 named the messaging mechanism; the «rethink for more value» directive covers the change, but the call is the operator's) |
| F2 | Threshold numbers 300k / ~500k / 70% | research-fillable — D9 kickoff authored, marker-complete |
| F3 | Chip-spawned session isolation default | **unverified** (round-1 downgrade: the 25/25 statistic is selection-conditioned; repo-root counterexamples exist) — the D1 mandatory isolation step is the mechanism; first live chip run observes the default as a bonus fact |
| F4 | CLI `SendMessage` unattended/headless behavior | OPEN — deferred with D5; recipe: from a headless `claude -p` run, attempt `ListAgents` + send to a named session; observe delivery + billing |
| F5 | tg-notify liveness | **CLOSED — split** (host filtered dead / container raw live, probed 2026-08-09). Operator option: set host creds (~1 min) to enable the filtered channel |
| F6 | ccd message delivery timing to idle sessions | **CLOSED — moot** (no messages in v1; D5) |
| F7 | `spawn_task` availability in scheduled/remote (unattended) sessions | OPEN — determines whether park-chips also fire from those classes or only from local sessions; probe: one scheduled run calling `spawn_task`; either answer is safe (absent → capability-gate skips → sweep path) |
| F8 | #108 PreCompact-item operator GO + D8's own liveness bench | OPEN — blocks S2b only (routed, not closed, by D8; the SSOT row is composite — see D8) |
| F9 | Chip visibility scope + lifetime + seat inheritance | OPEN — first live chip observes: app-global vs per-session-view rendering (the R4 morning-surface claim rests on this); survival across minimize vs restart; whether the spawned session inherits the emitter's model (D3 seat line). Click-time observations, no build needed |
| F10 | D7 audience (**operator fork**) | consumer-generic as specified (adds a bounded new blocking Stop path in consumer sessions) vs framework-presence-gated (operator-only; consumers lose the reminder). **CLOSED 2026-08-10 — consumer-generic**: the operator's 2026-08-09 F4b-landing directive (consumer-shipped is the product intent, guards non-negotiable) is the ratifying evidence; S2a ships the generic wording (zero framework refs in the reminder string, test-asserted) |

## §8 §1.7 self-reflexive note

### §1.7 Forward-check applied

- [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md): all chip/hook activity
  is session-bound or deterministic bash+jq (`end-of-turn-reminder.sh:148-168` precedent);
  zero API-billed CI calls.
- [attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md):
  chips accelerate operator attention but every mechanical gate stays (stage gates resolved-at-
  click INSIDE chips, park state in aif, sweeps, `done.md`); the chip-prompt gates are asserted
  by the extended principle-18 substring check (D1), not by emitter diligence; D8's residue has
  a named reader (the §1 injection block).
- [dual-implementation-discipline.md §3/§4/§6](../../../.claude/rules/dual-implementation-discipline.md):
  capability-checks at the runtime roster (D2), audience triage done for the consumer-shipped
  hook (D7 generic wording), `@cc-only-rationale` for D8.
- [build-first-reuse-default.md §1.1/§3](../../../.claude/rules/build-first-reuse-default.md) +
  [CLAUDE.md](../../../CLAUDE.md) build-vs-reuse: own-stack ADOPT throughout with SSOT consult
  BY ID — [#108](../../../docs/meta-factory/prior-art-evaluations.md) (PreCompact hook class —
  D8 subordinates to its open decision), #121 (allowed-tools non-enforcement — D2 cites),
  #122 (transcript-reading recap channel — D7 same channel), #230 (ecosystem handoff skill —
  D6 REFERENCE + delta stated). Zero new deps/modules → no capability commit expected; an
  implementation helper crossing the LOC thresholds carries its `Prior-art:` trailer then.
- [rule-enforcement-channel-selection.md](../../../.claude/rules/rule-enforcement-channel-selection.md):
  handoff discipline is judgment-shaped → injection (D7 reminder), never a gate; the
  deterministic parts (D8 snapshot) are hook-written, not model-hoped.
- [reviewer-discipline.md](../../../.claude/rules/reviewer-discipline.md) + [arch/SKILL.md §2](../../../.claude/skills/arch/SKILL.md):
  two cold seats round 1 (REVISE×2, reports preserved in the contour's scratchpad), round-2
  delta review before routing; the Part-2 pivot adopts a reviewer-surfaced FORK resolution as
  a recommendation, flagged to the operator in §7 F1 — strategy stays the operator's.
- [language-discipline.md §1](../../../.claude/rules/language-discipline.md): artifact English.

### §1.7 Backward-check applied

Class of this change = «operator-relay automation touching dispatch emission, notification
channels, long-session continuation, and the hook population». Surfaces swept:

- Dispatch-emission: [pipeline/SKILL.md:467](../../../.claude/skills/pipeline/SKILL.md) §10 +
  its enforced grammar SSOT [references/output-format.md](../../../.claude/skills/pipeline/references/output-format.md)
  (principle 18 pins the literal table header — round-1 gap, now in S1);
  [arch/SKILL.md §3](../../../.claude/skills/arch/SKILL.md) incl. the `bridge: auto` route
  (double-dispatch collision resolved by route discrimination, D1);
  [dispatcher/SKILL.md:85](../../../.claude/skills/dispatcher/SKILL.md) REST — SWEPT-CLEAN as
  non-emitter of dispatch chips, newly the D3 park-chip emitter.
- Notification channels: host `tg-notify.sh` (dead, F5), container aif notifier (live raw,
  untouched), park-chips (new, D3) — reconciled in §2; no channel silently replaced.
- Continuation/restart precedents: [dispatcher/SKILL.md:164](../../../.claude/skills/dispatcher/SKILL.md)
  restart-safety (D6 adds nothing there); [cold-seat-economy.md §3](../../../.claude/rules/cold-seat-economy.md)
  artifact-handoff-over-compact (D6 is its session-level application, one-directional).
- Hook population: `end-of-turn-reminder.sh` F10 arm at `:40-137` is the only existing Stop
  arm (sole `Stop` entry, jq-verified); D7 follows its placement postmortem. The census
  [zcode-parity-doctrine.md §2](../../../.claude/rules/zcode-parity-doctrine.md) pins
  «Total = 20» and per-hook classification — BOTH D7 (row-9 flip) and D8 (row 21) edits are in
  S2 surface lists (round-1 gap, closed). `plugin/hooks/hooks.json` is renderer-owned
  (`scripts/render-harness-config.mjs` emitPlugin) — the renderer is the named surface, not
  the JSON.
- Prep-doc: [2026-08-09-arch-prep-pipeline-chips-session-bus.md](2026-08-09-arch-prep-pipeline-chips-session-bus.md)
  historical (its §0 protocol is spent; CLOSED rows carried into §1/§3; the baseline bus
  material it preserves is now also superseded by §4's scoring — the prep-doc self-describes
  as mid-contour state, so no edit needed).

## See also

- [prep-doc (design-state, historical)](2026-08-09-arch-prep-pipeline-chips-session-bus.md) — capability evidence §2, operator directives §1/§4.
- Round-1 cold reviews (contour scratchpad): `top-down-chips-bus.md`, `bottom-up-chips-bus.md` — the transport pivot's origin; session-ephemeral, findings absorbed here.
- [.claude/orchestrator-prompts/context-degradation-calibration/kickoff.md](../../../.claude/orchestrator-prompts/context-degradation-calibration/kickoff.md) — D9.
- [pipeline/SKILL.md §10](../../../.claude/skills/pipeline/SKILL.md) · [dispatcher/SKILL.md §2–§3](../../../.claude/skills/dispatcher/SKILL.md) · [arch/SKILL.md §2–§4](../../../.claude/skills/arch/SKILL.md) — the S1–S3 surfaces.
- [night-mode/SKILL.md](../../../.claude/skills/night-mode/SKILL.md) — the unattended posture D5 protects.
