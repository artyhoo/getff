<!-- scope: ADR for the 2026-08-09 /arch contour «pipeline chips + session signal bus + context handoff» — the reviewed design. Supersedes the design-state prep-doc 2026-08-09-arch-prep-pipeline-chips-session-bus.md (now historical). Implementation lands in later stages; SKILL.md/hook sections own their surfaces after they ship. -->

# ADR: Pipeline chips + session signal bus + context handoff

> **Status:** Proposed — /arch §2 cold-reviewed; operator acceptance pending.
> **Date:** 2026-08-09. **Deciders:** operator (goals + CLOSED forks ratified in-contour, see [prep-doc §4/§5](2026-08-09-arch-prep-pipeline-chips-session-bus.md)).
> **Authoritative for:** the v1 design — decisions D1–D9 (chips, bus, handoff, calibration), the
> friction-inventory evidence base (§2), rejected alternatives (§4), implementation staging (§6),
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
verified 2026-08-09), plus this session's deltas:

- **F5 CLOSED — split verdict.** Host side: `TELEGRAM_BOT_TOKEN`/`TELEGRAM_USER_ID` are UNSET
  in CC-session environments (probed live 2026-08-09; not in `~/.claude/settings.json` env, not
  in `.zshenv` — zsh sources it for every Bash-tool shell), so `tg-notify.sh` silently skips —
  the [dispatcher §2.4c](../../../.claude/skills/dispatcher/SKILL.md) *filtered* channel is
  configured-in-prose but non-live. Container side: `TELEGRAM_BOT_TOKEN` IS set in
  `aif-handoff-agent-1` (probed 2026-08-09), so aif's *raw* per-status-change notifier still
  pings the phone, unfiltered. Net: «noticing» is covered (noisily); the expensive part of the
  R3 chain — context reconstruction, deciding in the right place, relaying the answer back —
  is covered by nothing. That is what the bus edge removes (D3).
- **Live session topology (ccd `list_sessions`, 2026-08-09):** 25 sessions across 4 repos in
  ~2 days; 6+ parallel rules-as-tests sessions in one evening (PRs #1293–#1320); every
  branch-carrying session runs in an app-created worktree (`.claude/worktrees/<name>`, branch
  `claude/<slug>`); a real night gap (00:42→10:32 on 2026-08-08) with only remote/cloud sessions
  in the unattended class. Multi-session day + empty-attended night is the observed reality the
  design must serve.
- **Chip-continuation dogfood:** this ADR's authoring session was itself spawned from the
  prep-doc's continuation chip into a fresh app-managed worktree on the design branch — the
  Part-3 attended continuation channel worked end-to-end before being specified.
- **Plugin hook channel exists and is committable:** `plugin/hooks/hooks.json` registers hook
  twins via `run-hook.cmd` without touching agent-uncommittable `.claude/settings.json`.

Standing constraints (operator-ratified, [prep-doc §4](2026-08-09-arch-prep-pipeline-chips-session-bus.md)):
chips ADDITIVE (aif option always alongside; human click stays the dispatch channel); bus
pointer-only, untrusted-body + re-verify, never load-bearing
([attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md));
night posture unchanged; no daemons; no new npm deps; capability-check not version-check
([dual-implementation-discipline.md §4](../../../.claude/rules/dual-implementation-discipline.md));
300k is a planning trigger, not a wall.

## §2 Friction inventory (the rethink's evidence base — direction 1 executed)

Manual relay actions the operator performs between sessions today, enumerated from skill
surfaces + live probes, not hypothesized:

| # | Relay action | Evidence | Rate × stakes | Closed by |
|---|---|---|---|---|
| R1 | Copy a §10 1-liner into a new CC tab | [pipeline/SKILL.md:467](../../../.claude/skills/pipeline/SKILL.md) «Paste into a new CC tab» | high × low | **D1 chips** |
| R2 | Open a fresh session to continue a long contour from a residue doc | this contour itself (prep-doc §0) | med × med | **D1 chips** (continuation chip; dogfooded) |
| R3 | Parked strategic question: notice it (tg dead per F5) → open the right session → reconstruct context → decide → type the answer back | [dispatcher/SKILL.md §3](../../../.claude/skills/dispatcher/SKILL.md) Type 2 + routing-seats table; F5 probe | low × **high** (a parked task stalls its umbrella until answered) | **D3–D5 bus** |
| R4 | Morning batch sweep of night-parked items | [dispatcher/SKILL.md §3](../../../.claude/skills/dispatcher/SKILL.md) night row (`questions.ts --project`); [arch/SKILL.md §4](../../../.claude/skills/arch/SKILL.md) | daily in night periods × med | NOT the bus — unattended senders cannot send (ccd schema); sweep is already scripted; stays as-is |
| R5 | Relay a reviewer verdict back to the orchestrator session | [arch/SKILL.md §2](../../../.claude/skills/arch/SKILL.md): review seats are in-session subagents by default | low × low | already in-session; no bus edge |
| R6 | Notice «stage done» and invoke the next planning step | tg `done` (dead, F5); glancing at tabs | med × low | chips carry the next action in the §10 report; wake-up edges REJECTED (§4) |

The inventory kills the baseline's broadcast topology: of the five drafted signal kinds, only
the R3 round-trip removes a real, recurring, high-stakes manual relay that nothing else covers.

## §3 Decisions

### D1 — Dispatch chips at two emission points (Part 1, settled shape refined)

/pipeline §10 emits one chip per Stage 1-liner; /arch §3 exit routing emits a chip per routed
next action (kickoff-run, continuation). /dispatcher emits none — it has no paste-moment
(dispatches via REST and self-advances); it is a chip *target* («run `/dispatcher <umbrella>`»),
never an emitter. Chip contract: **title** = the 1-liner; **prompt** = self-contained (kickoff
or residue path + «read and execute», plus the standing first step: the pre-dispatch in-flight
probe per [dispatcher/SKILL.md §2.0](../../../.claude/skills/dispatcher/SKILL.md) / CLAUDE.md);
**cwd** = repo root. Isolation: rely on the app's observed worktree-per-session default (25/25
branch-carrying sessions in `.claude/worktrees/*`); the prompt instructs the spawned session to
*verify* isolation (`git branch --show-current` ≠ staging; worktree path check) and enter a
worktree only if the default did not provide one (EnterWorktree capability present in current
session rosters). F3 status: verified-by-observation; first live chip run confirms the residual
(spawn_task→worktree linkage) — see §7.

**Falsifier:** a chip-spawned session that lands unisolated on `staging` and writes → the
isolation-verify first step failed its job; revisit with an explicit enter-worktree step.

### D2 — Chips are additive, capability-gated, ephemeral-honest

Emit chips only when `spawn_task` is present in the session's tool roster (capability-check,
never version-sniff). Fallback = today's paste-tabs, verbatim. The aif autonomous option is
always presented alongside (`#tabs-by-default-when-bridge-up`,
[pipeline/SKILL.md §10](../../../.claude/skills/pipeline/SKILL.md)). Chips do not survive app
restarts → the durable dispatch record remains the §10 report + kickoff files; a superseded
chip gets a best-effort `dismiss_task`. Control model unchanged: the operator's click IS the
«maintainer opens a fresh session» channel — `#worker-dispatch-via-subagent` untouched.

### D3 — The bus is ONE edge-pair: the parked-question round-trip (Part 2 rethink verdict)

The v1 signal bus carries exactly two message kinds, day-attended only:

- `parked <task-id> strategic — <one-line title>` — from an attended executing session
  (/dispatcher loop, or any attended Worker that parks) to the operator's live strategy
  session (the «arch seat»).
- `answer-ready <task-id> <answer-artifact-path>` — from the strategy session back to the
  executing session.

This is rethink direction 3 (office-hours push) fused with a bounded slice of direction 2
(receiver does real work): on `parked`, the arch seat pre-stages a **decision package**
(question, evidence, reasoned recommendation + falsifier per the H1 discipline, options with
consequences) so the operator decides in the session where the deciding context lives, at the
moment the question is hot — instead of the R3 chain. Economy: parked strategic questions are
rare (0–3 per umbrella) and each stalls a running factory task; one mid/top-tier
decision-package turn per question buys unblock latency + saves the operator's
context-reconstruction — the strongest cost/value ratio of any drafted edge, and the only one
whose manual counterpart is both recurring and expensive (§2 R3).

**Falsifier:** if live usage shows parked-question rate ≈ 0 while chip+artifact flow covers
everything else, the bus edge idles harmlessly (capability-gated, zero standing cost) and can
be retired by deleting the two skill paragraphs — no state, no daemon, no migration.

### D4 — Bus mechanics: discovery, grammar, trust, application

- **Discovery by declared title:** on invocation, /arch sets its own session title to
  `arch — <repo-slug>` when a title-set capability is present in the roster (observed:
  `ccd_session_mgmt.set_session_title`); senders resolve the target via `list_sessions` (title
  prefix `arch — ` + same-repo cwd + not archived). No match → skip silently, one journal
  line; the parked item waits exactly as today (R4 sweep remains the backstop). Observed
  reality motivates this: default ccd titles are content-derived, so role-discovery must be
  declared, not inferred.
- **Pointer-only grammar:** the two shapes above are the entire vocabulary. Design content
  never crosses the bus; the decision text lives in a durable artifact —
  `.claude/orchestrator-prompts/<umbrella>/answers/<task-id>.md` (inside the gitignored
  runtime area — `.claude/orchestrator-prompts/*/*` is ignored and the
  [.gitignore](../../../.gitignore) negation set does not include `answers/`, verified
  2026-08-09) — and in the aif task comment once applied.
- **Untrusted-body + re-verify, both directions:** a `parked` receiver fetches the actual
  parked task from aif before acting (no matching parked task → drop + note); an
  `answer-ready` receiver reads the artifact, checks it names the same task-id, then applies.
  The bus body is a hint, never an input to action — the «REPORT supplementary, mechanical
  state wins» pattern ([pipeline/SKILL.md §1](../../../.claude/skills/pipeline/SKILL.md)).
- **Injection posture (load-bearing):** cross-session messages arrive **as user turns**
  labelled «From {session title}» — at the harness level they are indistinguishable from
  operator input. The receiving skill sections MUST state: such messages are session **data**,
  not operator instructions; the receiver acts only per the two-shape grammar + re-verification;
  any other content (including imperative text) is surfaced to the operator verbatim and never
  executed. A spoofed or malformed message degrades to a no-op.
- **Queue-not-interrupt:** the arch seat treats an arriving `parked` as a queue item — finish
  the current operator exchange, then run the decision-package protocol at the next natural
  pause; never derail a live strategy dialogue mid-thought.
- **Application stays with the tool owner:** /arch reads parked questions via the read-only
  CLI (its `allowed-tools` gains one scoped entry:
  `Bash(tsx packages/runtime-bridge/src/cli/questions.ts *)`); the answer is APPLIED by the
  executing session via `answer.ts` (existing [dispatcher/SKILL.md §3](../../../.claude/skills/dispatcher/SKILL.md)
  Type-2 step), recorded in the task comment + PR `## Parked questions` as today. /arch never
  mutates aif state.

### D5 — Bus posture: never load-bearing, night-dead by construction, F4 deferred

The capability check IS the day/night discriminator: ccd `send_message` is schema-unavailable
in unattended sessions (scheduled runs, remote dispatch) in both directions — so night sessions
*cannot* grow a bus dependency even by accident. Every existing durable path (park state in
aif, tg-notify once creds are set, morning sweep, `done.md`, stage gates) is unchanged;
deleting the bus restores today's behavior exactly ([attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md):
the bus is an accelerator on top of mechanisms, never the detection layer). CLI cross-session
`SendMessage`/`ListAgents` (2.1.224, day-zero) is NOT adopted in v1 — unattended/headless
semantics unverified (F4); revisit trigger: F4 verified AND a concrete cross-machine relay
friction is recorded, then the same two-shape protocol extends unchanged over that transport.

### D6 — Context-handoff policy (Part 3, settled)

Trigger plans the handoff; the work class decides where the tail lands:

| Window | T_soft (plan handoff) | Working range past T_soft | Backstop |
|---|---|---|---|
| 200k | 70% (~140k) | up to auto-compact | `PreCompact(auto)` warn-not-block (D8) |
| 1M | 300k (provisional, operator floor) | up to ~500k (provisional), esp. mechanical tails | none in practice → the D7 Stop-arm carries it alone |

**Remaining-work classifier (prose, judgment):** past T_soft at a stage boundary the session
classifies its tail — «mechanical» (commit/merge/regen; errors caught by CI + rules;
degradation non-fatal) → finish in place up to the working-range ceiling; «judgment» (design,
review, novel debugging) → write residue → handoff (continuation chip when spawn_task is
present, else a paste 1-liner) → fresh session. Break at stage boundaries, never mid-harvest.
Residue artifacts: /dispatcher sessions need NOTHING new (restart-safety D10 already mandates
durable-store state + re-probe, [dispatcher/SKILL.md §2.4](../../../.claude/skills/dispatcher/SKILL.md));
design/arch sessions bring the spec/prep-doc to «readable from zero» + a 5-line handoff block
(the prep-doc → this ADR chain is the live example). Numbers are parameters — D9 calibrates.

### D7 — Handoff trigger: a context-arm in the already-wired Stop hook

Extend [.claude/hooks/end-of-turn-reminder.sh](../../../.claude/hooks/end-of-turn-reminder.sh)
(registered under `Stop` in `.claude/settings.json`, verified via jq 2026-08-09) following its
own F10-arm pattern (`end-of-turn-reminder.sh:40-137`): compute the context estimate from the
transcript's last assistant entry (`.message.usage`: input + cache_read + cache_creation
tokens — deterministic bash+jq; hooks receive `transcript_path`, no token fields), and at
threshold crossings inject a handoff-planning reminder via the proven `decision:block` +
`reason` channel (`end-of-turn-reminder.sh:398-403` — `systemMessage` never reaches the model).
Two tiers (~140k, ~300k absolute — window discrimination is not available to hooks, so tier
prose states both interpretations and points at the D6 classifier), each firing **once per
session** via a `${TMPDIR}/aif-ctx-<session_id>-<tier>` debounce flag (the story-flag
precedent, `end-of-turn-reminder.sh:281-286`); when another branch already blocks, the context
line rides the same block (the F10 composition rule, `end-of-turn-reminder.sh:407-409`).
Degradations, stated: ZCode synthetic transcripts may lack usage fields → the arm is silently
inert there (accepted; [zcode-parity-doctrine.md §2](../../../.claude/rules/zcode-parity-doctrine.md)
row 9 parity refers to the existing branches); a session that never Stops long enough to cross
a tier gets the PreCompact backstop (D8) on 200k windows and nothing on 1M — which is exactly
the judgment-shaped reminder posture ([rule-enforcement-channel-selection.md](../../../.claude/rules/rule-enforcement-channel-selection.md):
injection, not gate — blocking a judgment call would be `#gate-where-judgment-needed`).

### D8 — PreCompact backstop: warn-not-block, plugin-channel delivery

A new small hook `precompact-residue.sh` on `PreCompact` (matcher `auto`): non-blocking
reminder to write a **minimal 5-line residue** (goal / done / next / truth-lives-in / resume
command) before compaction proceeds — blocking at ~95% context would leave no room to write a
full handoff, so the full-residue discipline belongs at T_soft (D7), not here. Delivery:
(a) hook script committed under `.claude/hooks/`; (b) a plugin twin + `plugin/hooks/hooks.json`
entry (committable channel, verified live); (c) for the operator's direct-settings sessions, a
one-line jq snippet in the implementation PR body (agent-uncommittable
`.claude/settings.json` — maintainer applies). `@cc-only-rationale`: `PreCompact` is absent
from `ZCODE_EVENTS` ([zcode-parity-doctrine.md §2](../../../.claude/rules/zcode-parity-doctrine.md)) —
and auto-compact is CC semantics anyway; inert elsewhere by construction.

### D9 — Calibration research task (Part 4, dispatched via kickoff)

A factory research task (aif executor tier, /arch §1.5 contour) calibrates the D6 numbers:
context-degradation onset for the top two Claude tiers as of Aug 2026 (public evals +
first-party guidance + practitioner reports; freshness bar: every source dated, freshest
first), plus transition best practices (handoff vs compact vs summary). Pre-mortem: fails if
degradation onset varies so much by task type that a single token threshold misleads more than
helps. Acceptance (what would prove the numbers wrong): measured quality at 300k
indistinguishable from 100k for our task classes (→ thresholds rise), or already degraded at
~150k (→ thresholds drop). Kickoff:
[.claude/orchestrator-prompts/context-degradation-calibration/kickoff.md](../../../.claude/orchestrator-prompts/context-degradation-calibration/kickoff.md)
(rides this PR to staging per [kickoff-staging-placement.md](../../../.claude/rules/kickoff-staging-placement.md)).
Output: a research-patch updating D6/D7 parameters + classifier refinement.

## §4 Options considered and rejected (Part-2 rethink, against the 5 drafted directions)

| Option | Verdict | Reason |
|---|---|---|
| Baseline broadcast bus (5 signal kinds: kickoff-ready · stage-merged · parked · umbrella-complete · handoff) | REJECTED (kept as material) | in-contour adversarial review: wake-up edges auto-run expensive top-tier turns with no human present; /pipeline re-probes plan currency at invocation anyway; the one valuable edge survives as D3 |
| Direction 1 — friction-first design | **EXECUTED** | §2 inventory is the decision base |
| Direction 2 — receiver does real work (broad) | PARTIAL ADOPT | adopted only inside D3 (decision package for parked questions — bounded, rare, high-stakes); rejected as a general pattern (tokens without a human gate) |
| Direction 3 — office-hours push | **ADOPTED** (fused into D3) | replaces the R3 chain where both endpoints are attended; ccd schema makes night misuse impossible |
| Direction 4 — bus carries only `handoff` | REJECTED | messaging cannot spawn sessions; chips already make continuation one click (R2); a handoff edge would add a second mechanism for a solved relay |
| Different topology (hub daemon, file-watch bus, aif-mediated relay) | REJECTED | violates no-daemons / no-new-infra constraints; aif already IS the durable store for parked state — the bus only accelerates attention, per D5 |

## §5 Consequences

- **Easier:** stage dispatch and contour continuation become one click (R1/R2); a parked
  strategic question reaches the operator pre-analyzed in the session that holds the deciding
  context, while the factory task it blocks waits hours less (R3); long sessions get a
  deterministic nudge at the planning threshold instead of silent degradation.
- **Harder / new surfaces:** two skill files gain bus paragraphs that must state the injection
  posture correctly (D4) — a security-relevant prose surface; the Stop hook grows a third arm
  (test material extends `end-of-turn-reminder` coverage); chips add a UI dependency that is
  deliberately allowed to vanish (restart-ephemeral) — reports stay the record.
- **Revisit when:** F4 verifies + a cross-machine friction instance is recorded (extend D4
  transport); calibration lands (D9 → renumber D6/D7); a `parked` message ever arrives in an
  unattended session (schema change upstream → re-audit D5's discriminator); ≥1 incident of a
  chip-spawned session writing unisolated (D1 falsifier).

## §6 Implementation staging (exit routing input)

| Stage | Scope | Surfaces | Route |
|---|---|---|---|
| S1 chips | D1+D2: §10 chip emission + /arch §3 chip emission, capability-gated, fallback intact | `pipeline/SKILL.md` §10, `arch/SKILL.md` §3 | in-session (discipline-bearing skill prose; small) |
| S2 handoff | D6+D7+D8: Stop-hook context-arm + tests, `precompact-residue.sh` + plugin twin + hooks.json, D6 policy paragraph into the owning docs | `.claude/hooks/`, `plugin/hooks/`, hook tests | factory-capable (well-specified bash+jq with test contract) |
| S3 bus | D3+D4+D5: dispatcher §3 sender paragraphs, arch §4 receiver protocol + title-set + allowed-tools entry | `dispatcher/SKILL.md`, `arch/SKILL.md` | in-session (injection-posture prose is security-relevant judgment) |
| S4 calibration | D9 kickoff dispatch after staging merge | aif factory | `/dispatcher context-degradation-calibration` |

S1 ∥ S2 parallel-safe (disjoint surfaces); S3 after S1 (same two SKILL.md files — avoid
same-file parallel edits); S4 independent after this PR merges.

## §7 Open forks / verification items (updated from prep-doc §5)

| # | Item | Status |
|---|---|---|
| F1 | Bus architecture rethink | **CLOSED** — D3–D5 (this ADR) |
| F2 | Threshold numbers 300k / ~500k / 70% | research-fillable — D9 kickoff authored |
| F3 | Chip-spawned session isolation | verified-by-observation (25/25 app-worktree default + this session's own spawn); residual: confirm on first live chip; D1 prompt carries the verify step |
| F4 | CLI `SendMessage` unattended/headless behavior | OPEN — deferred out of v1 (D5); recipe: from a headless `claude -p` run, attempt `ListAgents`+send to a named session; observe delivery + billing |
| F5 | tg-notify liveness | **CLOSED — split** (probed 2026-08-09): host *filtered* channel dead (creds UNSET); container *raw* aif notifier live (unfiltered pings). Operator option: set host creds (~1 min) to enable the filtered night channel; D3 covers the attended-day chain either way |
| F6 | Delivery timing of a ccd message to a non-running local session | unknown-benign (lands as a user turn; worst case the operator sees it on next open — never-load-bearing absorbs this); observe during S3 dogfood |

## §8 §1.7 self-reflexive note

### §1.7 Forward-check applied

- [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md): all bus/chip/hook
  activity is session-bound or deterministic bash; zero API-billed CI calls (D7 arm is jq over
  a transcript, `end-of-turn-reminder.sh:101-106` precedent).
- [attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md):
  the bus is merge-authority-side acceleration, never the detection layer — every mechanical
  gate (stage gates, sweeps, park state, `done.md`) is unchanged (D5).
- [dual-implementation-discipline.md §4/§6](../../../.claude/rules/dual-implementation-discipline.md):
  chips + bus + title-set are capability-checked at the tool-roster level, never
  version/brand-sniffed (D2/D4); the D8 hook carries `@cc-only-rationale` (PreCompact ∉
  `ZCODE_EVENTS`, [zcode-parity-doctrine.md §2](../../../.claude/rules/zcode-parity-doctrine.md)).
- [build-first-reuse-default.md §1.1](../../../.claude/rules/build-first-reuse-default.md):
  own-stack-first ADOPT throughout — ccd `spawn_task`/`send_message`/`list_sessions`/
  `set_session_title`, CC `PreCompact`, the existing Stop hook, existing `questions.ts`/
  `answer.ts` CLIs; zero new deps, zero new modules → no capability commit expected. If an
  implementation helper crosses the [CLAUDE.md](../../../CLAUDE.md) LOC thresholds it carries
  its `Prior-art:` trailer then.
- [rule-enforcement-channel-selection.md](../../../.claude/rules/rule-enforcement-channel-selection.md):
  the handoff discipline is judgment-shaped → injection channels (Stop-arm reminder, PreCompact
  warn), never a gate (D7/D8).
- [reviewer-discipline.md](../../../.claude/rules/reviewer-discipline.md) +
  [arch/SKILL.md §2](../../../.claude/skills/arch/SKILL.md): this ADR went through the cold
  two-altitude review before acceptance routing.
- [language-discipline.md §1](../../../.claude/rules/language-discipline.md): artifact in
  English; operator chat in `AIF_HOOK_LANG`.

### §1.7 Backward-check applied

Class of this change = «operator-relay automation touching dispatch emission, notification
channels, and long-session continuation». Surfaces where the class occurs, swept:

- Dispatch-emission surfaces: [pipeline/SKILL.md:467](../../../.claude/skills/pipeline/SKILL.md)
  (§10 tabs) and [arch/SKILL.md §3](../../../.claude/skills/arch/SKILL.md) — both covered by D1;
  [dispatcher/SKILL.md:85](../../../.claude/skills/dispatcher/SKILL.md) dispatches via REST
  (no paste-moment) — SWEPT-CLEAN, confirmed non-emitter.
- Notification channels: `tg-notify.sh` (host — dead, F5), aif container notifier (separate
  env, untouched), ccd bus (new, D3) — reconciled in §2/D5; no channel is silently replaced.
- Long-session continuation precedents: [dispatcher/SKILL.md §2.4](../../../.claude/skills/dispatcher/SKILL.md)
  restart-safety D10 (already durable — D6 adds nothing there, avoiding a duplicate mechanism);
  [cold-seat-economy.md §3](../../../.claude/rules/cold-seat-economy.md) artifact-handoff-over-
  compact — D6 is its session-level application, one-directional pointer, no supersession.
- Stop-hook arms: `end-of-turn-reminder.sh:40-137` (F10) is the only existing arm; D7 adds the
  second following its composition rule — no other Stop hooks exist in
  `.claude/settings.json` (verified via jq 2026-08-09).
- Prep-doc: [2026-08-09-arch-prep-pipeline-chips-session-bus.md](2026-08-09-arch-prep-pipeline-chips-session-bus.md)
  becomes historical design-state (its §0 resume protocol is spent; CLOSED rows carried into
  §1/§3 here) — pointer updated in its place only if it misleads (it self-describes as
  mid-contour, so no edit needed; frozen-doc discipline respected).

## See also

- [prep-doc (design-state, historical)](2026-08-09-arch-prep-pipeline-chips-session-bus.md) — capability evidence §2, operator directives §1/§4.
- [.claude/orchestrator-prompts/context-degradation-calibration/kickoff.md](../../../.claude/orchestrator-prompts/context-degradation-calibration/kickoff.md) — D9 research kickoff.
- [pipeline/SKILL.md §10](../../../.claude/skills/pipeline/SKILL.md) · [dispatcher/SKILL.md §2–§3](../../../.claude/skills/dispatcher/SKILL.md) · [arch/SKILL.md §2–§4](../../../.claude/skills/arch/SKILL.md) — the surfaces S1–S3 modify.
- [night-mode/SKILL.md](../../../.claude/skills/night-mode/SKILL.md) — unattended posture the bus must never touch (D5).
