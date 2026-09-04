<!-- scope: arch-prep handoff — design state of the 2026-08-09 /arch contour «pipeline chips + session signal bus + context handoff», recorded mid-contour for continuation in a fresh session (this doc IS the Part-3 residue mechanism applied to itself). Not the spec: the spec is authored by the continuation session after the Part-2 rethink. -->

# Arch-prep: pipeline chips + session signal bus + context handoff (2026-08-09)

> **Authoritative for:** the design state at handoff — settled shapes (Part 1, Part 3, Part 4),
> the OPEN Part-2 rethink directive with its baseline + review findings, verified capability
> evidence (§2), open forks (§5), resume protocol (§0).
> **NOT authoritative for:** project goal — [README.md#why-this-exists](../../../README.md#why-this-exists);
> dispatch mechanics — [pipeline/SKILL.md](../../../.claude/skills/pipeline/SKILL.md) +
> [dispatcher/SKILL.md](../../../.claude/skills/dispatcher/SKILL.md); contour choreography —
> [arch/SKILL.md](../../../.claude/skills/arch/SKILL.md).
> **Current as of 2026-08-09.** Branch: `claude/pipeline-chips-auto-sessions-e9b6de`.

## §0 Resume protocol (for the continuation session)

Run `/arch docs/superpowers/specs/2026-08-09-arch-prep-pipeline-chips-session-bus.md` on this
branch. Produce, in order: (1) the Part-2 bus rethink (the ONLY open design area — §3.2);
(2) the finalized design; (3) the spec (`docs/superpowers/specs/2026-08-09-pipeline-chips-session-bus-design.md`,
ADR shape); (4) /arch §2 cold two-altitude review; (5) §3 exit routing. Operator decisions
already taken (§4 + §5 CLOSED rows) are settled — do not re-litigate without new evidence.

## §1 Idea and goals (operator, 2026-08-09)

1. **One-click dispatch:** /pipeline (and /arch exit) currently emit paste-tab 1-liners; replace
   the copy-paste with desktop chips — operator clicks OK, a session spawns with the kickoff;
   the aif autonomous option stays alongside. Pure UX: fewer manual relay actions.
2. **Inter-contour communication:** use the new CC cross-session messaging (2.1.224) to automate
   /arch ↔ /pipeline ↔ /dispatcher signalling. Operator directive at handoff: **do not defer —
   rethink for MORE value** (§3.2); architecture may change.
3. **Long-session discipline:** when a session's context grows past its effective range, write a
   handoff and continue in a fresh session instead of degrading (or compacting).

## §2 Verified capability evidence (all verified 2026-08-09)

- **CC 2.1.224 changelog** (fetched): «Added cross-session `SendMessage`: Claude Code sessions
  can now message each other, on any of your machines, with `ListAgents` to discover them
  (macOS and Linux)». 2.1.221 added named Remote-Control sends. Feature is day-zero.
- **Desktop (ccd) session messaging** — `ccd_session_mgmt.send_message` tool schema: message
  arrives in the target session **as a user turn** labelled «From {session title}»;
  **«Unavailable in unattended sessions (scheduled-task runs and remote-dispatched sessions),
  and cannot deliver to them either»**. Discovery via `list_sessions`.
- **Desktop chips** — `ccd_session.spawn_task` schema: chip with self-contained prompt; one
  click spins off an own session; `cwd` settable. Sibling `dismiss_task` schema: **«Task ids
  are not persisted across app restarts»** → chips are ephemeral, same-day UX.
- **Hooks** (code.claude.com/docs/en/hooks): `PreCompact` exists (matcher `manual|auto`, can
  block); hooks receive `transcript_path` but **no token/context fields**.
- **Statusline JSON** (docs): `context_window.used_percentage`, `context_window_size` (200000
  default, 1000000 extended), `exceeds_200k_tokens` («fixed threshold regardless of actual
  context window size»).
- **This repo:** `.claude/settings.json` already registers a `Stop` hook →
  `.claude/hooks/end-of-turn-reminder.sh` (388 lines). So the Part-3 trigger ships as an
  **extension of an existing wired hook** — no `settings.json` edit (agent-uncommittable).
- **Operator harness mix:** mixed — desktop app AND terminal CLI, including overnight runs.
  Any mechanism choice must be capability-checked per session
  ([dual-implementation-discipline.md §4](../../../.claude/rules/dual-implementation-discipline.md)),
  never version- or brand-sniffed.

## §3 Design state per part

### 3.1 Part 1 — dispatch chips (SETTLED shape, verify F3 before shipping)

- **Emission points:** /pipeline §10 Action queue (one chip per Stage 1-liner) and /arch §3
  exit routing (chip = «open the Worker/kickoff session»). /dispatcher emits none — it has no
  paste-moment: it dispatches to aif via REST ([dispatcher/SKILL.md:85](../../../.claude/skills/dispatcher/SKILL.md))
  and advances itself (§2.7). The dispatcher is a chip **target** («run `/dispatcher <umbrella>`»),
  not an emitter.
- **Chip contract:** title = the 1-liner; prompt = self-contained (kickoff path + «read and
  execute», plus **for Mode B: an explicit enter-worktree first step** — F3 unverified); cwd =
  repo root. Emit only when `spawn_task` is present in the session (capability-check); fallback
  = today's paste-tabs. The aif autonomous option is always presented alongside
  (`#tabs-by-default-when-bridge-up`, [pipeline/SKILL.md §10](../../../.claude/skills/pipeline/SKILL.md)).
- **Control model unchanged:** the operator's click IS the «maintainer opens a fresh session»
  channel — `#worker-dispatch-via-subagent` untouched.
- **Double-dispatch guard:** the spawned session's first step is the existing pre-dispatch
  in-flight probe ([dispatcher/SKILL.md §2.0](../../../.claude/skills/dispatcher/SKILL.md);
  CLAUDE.md «Pre-dispatch in-flight probe»). Stale chips: best-effort `dismiss_task`.
- **Honest limits:** chips do not survive app restarts (§2) — the durable dispatch record
  remains the §10 report; chips accelerate the attended flow only.

### 3.2 Part 2 — signal bus (OPEN — operator directive: rethink for more value)

**Baseline as drawn (keep as material, not as verdict):** pointer-only signals
(`kickoff-ready <path>` · `stage-merged <umbrella> <stage> PR#<n>` · `parked <task-id> <class>`
· `umbrella-complete <umbrella>` · `handoff <residue-path>`); receiver treats the body as
untrusted and re-verifies against git/gh/aif before acting (the «REPORT supplementary,
mechanical state wins» pattern, [pipeline/SKILL.md §1](../../../.claude/skills/pipeline/SKILL.md));
design content never crosses the bus (membrane, [arch/SKILL.md §2](../../../.claude/skills/arch/SKILL.md));
delivery capability-ladder: ccd `send_message` → CLI `SendMessage`/`ListAgents` (sessions named
by role: `arch`, `pipeline`, `dispatcher-<umbrella>`) → none (unattended) = today's durable
artifacts + sweeps. Bus is never load-bearing
([attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md)).

**Adversarial review findings against the baseline (2026-08-09 in-contour self-review, REVISE):**

- The one high-value edge (`dispatcher→arch parked`) **duplicates the existing tg-notify**
  ([dispatcher/SKILL.md §2.4c](../../../.claude/skills/dispatcher/SKILL.md) `helpers/tg-notify.sh
  <done|stalled|question|blocker>`) — marginal value = «lands in the arch session, not the phone».
  Caveat F5: tg-channel liveness on the operator machine was NOT verified; if dead, this edge's
  value rises.
- Wake-up edges (`kickoff-ready`, `umbrella-complete`) auto-run expensive top-tier turns at a
  moment no human is present to act on the output, and /pipeline re-probes plan currency at
  invocation anyway — they spend tokens earlier without removing human work.
- The unattended night contour — where automation matters most — is exactly where the ccd
  channel is dead by schema (§2) and the CLI channel is unverified (F4).

**Rethink directions for the continuation session (candidates, not decisions):**

1. Design from **observed relay friction**: enumerate the manual copy/relay actions the operator
   actually performs between sessions today (parked answers, verdict hand-backs, «go» pings);
   pick edges that remove a real recurring action, not hypothetical ones.
2. **Receiver does real work** model: a signal wakes the target to produce a parked artifact
   (pre-computed launch table, pre-drafted answer) that the operator later reviews — value =
   latency hiding; cost = tokens without a human gate. Needs an economy argument.
3. **Office-hours push** model: bus only pushes parked strategic questions INTO the live /arch
   session during the day (replacing the morning batch sweep), everything else stays artifacts.
4. **Handoff-continuation** model: bus carries ONLY `handoff <residue-path>` — cross-session
   continuation becomes one click/zero clicks; all other coordination stays artifact-based.
5. Combinations of the above, or a genuinely different topology if the friction inventory
   (direction 1) says so. Membrane + pointer-only + never-load-bearing stay as invariants.

### 3.3 Part 3 — context handoff (SETTLED, numbers research-fillable)

Policy — trigger plans the handoff, work class decides where it lands:

| Window | T_soft (plan handoff) | Working range past T_soft | Backstop |
|---|---|---|---|
| 200k | 70% (~140k) | up to auto-compact | `PreCompact(auto)` hook — **warn-not-block**, minimal 5-line residue (blocking at ~95% leaves no room to write a full handoff) |
| 1M | **300k** (provisional, operator floor) | **up to ~500k** (provisional), esp. for mechanical tails | none in practice (auto-compact unreachable) → the Stop-hook trigger carries it alone |

- **Remaining-work classifier (prose, judgment):** past T_soft at a stage boundary the session
  classifies its tail — «mechanical» (commit/merge/regen; errors are caught by CI + rules;
  degradation non-fatal) → finish in place, up to the working-range ceiling; «judgment»
  (design, review, novel debugging) → write residue → handoff → `/clear` → fresh session.
  Break at stage boundaries, never mid-harvest.
- **Trigger mechanism:** extend the already-wired `.claude/hooks/end-of-turn-reminder.sh`
  (Stop hook, §2) — compute tokens from `transcript_path` last-usage (deterministic bash+jq),
  inject the reminder at ≥T_soft. Cheap, threshold-gated, fires in every session class.
- **Residue artifacts:** /dispatcher sessions need NOTHING new — restart-safety D10 already
  mandates durable-store state + re-probe ([dispatcher/SKILL.md:164](../../../.claude/skills/dispatcher/SKILL.md)).
  Design/arch sessions: the spec/prep-doc itself, brought to «readable from zero» + a 5-line
  handoff block (this document is the live example).
- **Numbers are parameters** — Part 4 calibrates 300k/500k/70% and may refine the classifier.

### 3.4 Part 4 — calibration research task (SETTLED as a task, to dispatch)

/arch §1.5 research contour, aif executor tier: context-degradation onset for **Opus 5 and
Fable as of Aug 2026** (public evals + first-party guidance + practitioner reports; freshness
bar: every source dated, freshest first), plus best transition practices (handoff vs compact vs
summary). **Pre-mortem:** fails if degradation onset varies so much by task type that a single
token threshold misleads more than helps. **Acceptance (what would prove the numbers wrong):**
measured quality at 300k indistinguishable from 100k for our task classes (→ thresholds rise),
or already degraded at ~150k (→ thresholds drop). Output: calibrated T_soft / ceiling +
classifier refinement for §3.3.

## §4 Standing constraints (operator-ratified in-contour)

- Chips are ADDITIVE: aif option always alongside; human click remains the dispatch channel.
- Bus (if it survives the rethink): pointer-only, untrusted-body + re-verify, never load-bearing.
- Night posture unchanged; no daemons; no new npm deps; capability-check not version-check.
- BFR: everything here is ADOPT own-stack (chips, SendMessage, PreCompact, statusline fields,
  existing Stop hook) — no capability commit expected; if an eventual helper crosses the
  CLAUDE.md LOC thresholds, it needs its `Prior-art:` trailer then.
- No hard stop at 300k (operator): 300k is a planning trigger, not a wall; ~500k workable.

## §5 Open forks / verification items

| # | Item | Status |
|---|---|---|
| F1 | Bus architecture — rethink for more value (directions §3.2) | **OPEN — the continuation session's main job** |
| F2 | Threshold numbers 300k / ~500k / 70% | research-fillable (Part 4) |
| F3 | Chip-spawned session can enter a worktree first (Mode B isolation) | verify before shipping chips |
| F4 | CLI cross-session SendMessage: unattended/headless behavior | verify (day-zero feature) |
| F5 | tg-notify liveness on the operator machine | verify — changes the value calc of the parked edge |
| — | Scope v1 = all three parts (operator, in-contour) | CLOSED |
| — | Threshold shape = f(tokens, window, tail-class), not one % | CLOSED (operator-corrected) |
| — | Chips additive to aif option; dispatcher = chip target not emitter | CLOSED |

## §6 Handoff block

- **Done here:** idea explored; capabilities verified (§2); Parts 1/3/4 settled; Part 2 reviewed
  adversarially (REVISE) and reopened for a value-rethink by operator directive; this prep-doc
  written and committed on `claude/pipeline-chips-auto-sessions-e9b6de`.
- **Next (fresh session):** §0 resume protocol.
- **Truth lives in:** this doc + the cited SKILL/rule files; nothing load-bearing remains only
  in the origin session's chat.
