---
description: Autonomous-loop continuity — an unattended turn must not end at the reportable boundary, and a silent monitor is not an all-clear
---

# Autonomous-loop continuity — discipline rule

<!-- channel: hook .claude/hooks/end-of-turn-reminder.sh#F10 -->

> **Class:** B — the mechanism is the opt-in `AIF_AUTONOMOUS=1` pair: (a) the **Stop-hook arm** in [`end-of-turn-reminder.sh`](../hooks/end-of-turn-reminder.sh) (`#F10` anchor), which emits `decision:block` when dispatched work is in flight, so the turn does **not** end — a mechanism, not a reminder; paired self-tests at [`packages/core/hooks/end-of-turn-reminder.test.ts`](../../packages/core/hooks/end-of-turn-reminder.test.ts); and (b) the always-on autonomy block in [`inject-session-bootstrap.sh`](../hooks/inject-session-bootstrap.sh), which is honestly **prose delivered reliably**, not a gate. Class A is not reachable for the prose half: what counts as "work remaining" is judgment, and gating a judgment is `#gate-where-judgment-needed` ([rule-enforcement-channel-selection.md §5](rule-enforcement-channel-selection.md)). §4 states the promotion path for the half that *is* mechanisable.
> **Fires:** any unattended / overnight orchestrator run (`AIF_AUTONOMOUS=1`); any moment a turn is about to end while dispatched work is still running; any load-bearing wait on an external runtime.
> **Authoritative for:** the autonomous-loop continuity discipline — §1 the stop rule and its mechanism, §2 the wait rule (silence ≠ health), §3 anti-patterns, §4 promotion / retirement.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). The overnight orchestration loop itself — see [`night-mode/SKILL.md`](../skills/night-mode/SKILL.md). Why a bare reminder cannot be a detection layer — see [attention-is-not-a-mechanism.md](attention-is-not-a-mechanism.md). Verifying container-produced work on the host — see [destination-environment-verification.md](destination-environment-verification.md).

> **Origin:** 2026-07-24, findings **F10** and **F2** of [`research-patches/2026-07-24-autonomous-loop-diagnostics.md`](../../docs/meta-factory/research-patches/2026-07-24-autonomous-loop-diagnostics.md). F10 recurred **twice in one session, in two different forms** — first the loop was switched off, then it was left armed while every turn still ended on a report — and the operator caught both. The load-bearing detail is that a prose mitigation had been written that same morning and did not survive to the evening: the rule is not "try harder", it is "put the check where the failure happens".

## §1 The stop rule

**An unattended turn must not end merely because there is something reportable.** Report *and*
continue in the same turn while work remains: a dispatched task in flight, an accepted branch
not yet harvested, an open item you own. Stop only when genuinely finished, or when blocked on
a decision that is the operator's.

**Mechanism, not exhortation.** Under `AIF_AUTONOMOUS=1` the Stop hook probes `GET /tasks` and,
when any task is un-paused and in `planning` / `implementing` / `review` / `blocked_external`,
returns `decision:block` with the continuation directive as `reason` — the field that reaches
the model. The turn does not end. This is the only channel that fires at the exact moment of
the failure; a rule file cannot, because by then the model has already decided to stop.

**Three properties that make it safe rather than clever:**

1. **At most one block per stop chain.** The hook's pre-existing `stop_hook_active` guard exits
   0 when the stop was itself hook-triggered. So the arm forces exactly one reconsideration and
   can never spin.
2. **Fail CLOSED, and say so.** If the probe cannot be reached or parsed, the arm still blocks —
   with a `reason` that names the degradation and explicitly refuses to read as an all-clear. A
   silent non-block would be the §2 failure wearing the §1 mask.
3. **Off by default.** No `AIF_AUTONOMOUS`, no behaviour change, no tokens. An interactive
   session is untouched.

## §2 The wait rule — silence is not health

**A monitor that has died and a monitor with nothing to report look identical.** Finding F2: the
harness `Monitor` tool goes quiet on failure, and its silence is indistinguishable from a
healthy quiet watch. The same shape recurs anywhere a load-bearing wait has no terminal
guarantee.

**Therefore, for any wait the loop depends on:** use a bounded waiter that **always emits a
terminal verdict** — the awaited state, a timeout, or a fetch failure — never nothing. In this
repo that is [`packages/runtime-bridge/src/cli/await.ts`](../../packages/runtime-bridge/src/cli/await.ts),
which carries real exit codes (0 terminal-success, 1 non-success/timeout/error) and a bounded
`--timeout-ms`; or a plain `until`-loop whose every exit path prints one line. Treat any monitor
as a **bonus** signal, never as the primary one.

**Known residual gap, stated rather than implied:** `await.ts` in default mode with no
`--timeout-ms` blocks until a terminal state, and `awaitDone` handles a *disconnect* (bounded
reconnect, then `BackendError('unavailable')`) but has **no idle watchdog** — a socket that stays
open and simply stops delivering events hangs the wait indefinitely. Verified by reading
[`aifWsStatus.ts`](../../packages/runtime-bridge/src/aifWsStatus.ts) (reconnect at `:234-248`,
optional timeout at `:264-265`, no heartbeat). Until that is closed, **always pass
`--timeout-ms`** on a load-bearing wait. §4 carries the fix.

## §3 Anti-patterns

- **`#stop-at-the-reportable-boundary`** — ending an unattended turn because a coherent report
  exists, while dispatched work continues. The report is not the deliverable; the landed work
  is. Counter: §1 mechanism.
- **`#silence-read-as-health`** — treating "the monitor said nothing" or "the probe returned
  nothing" as "nothing is wrong". Counter: §2 — every wait emits a terminal verdict; a broken
  probe blocks loudly instead of passing quietly.
- **`#prose-mitigation-for-a-moment-failure`** — answering a failure that happens at a specific
  moment (the stop, the dispatch, the push) with a paragraph in a document read at session
  start. It rots within one session under context fatigue — F10's own morning-to-evening
  history is the evidence. Counter: put the check at the moment; if the moment has no channel,
  say so and keep the prose *labelled* as prose.
- **`#invented-constraint`** — obeying a limit that no citable line imposes. A predecessor
  session promoted a one-session procedural note («merge is the operator's click») into a
  standing permission limit and obeyed its own invention for seven PRs while the operator
  merged six by hand. Counter: a constraint is a constraint only if it traces to a line in
  [CLAUDE.md](../../CLAUDE.md), a rule file, or a skill.

## §4 Promotion / retirement

- **The mechanisable half → Class A** when the Stop arm proves itself: ship a principle test
  asserting the arm's contract (blocks on in-flight, blocks-and-names on a broken probe, never
  blocks under `stop_hook_active`) over the shipped hook rather than only its self-test. The
  self-tests exist today; the promotion is about making them population-wide, not new logic.
- **F2 residual → close the idle watchdog.** Add a heartbeat to `awaitDone`: if no event
  arrives for N ms, reconcile against a REST `GET /tasks/:id`; resolve on a moved state, fail
  loudly if REST is unreachable too. Trigger: the first wait that hangs with the socket open.
  Deliberately not built here — one concern per PR, and the reachable mitigation
  (`--timeout-ms` always) costs nothing today.
- **Strengthening trigger:** a third F10 recurrence *with the arm live* means the block is
  firing and being talked past → the arm's `reason` is not landing; revise the wording and
  count incidents. A recurrence with the arm *not* live is an enablement problem, not a rule
  problem.
- **Retirement:** 12 consecutive months with zero F10/F2-class incidents AND no unattended
  runs in use → archive to prose in [CLAUDE.md](../../CLAUDE.md). Peer criteria:
  [reviewer-discipline.md §4](reviewer-discipline.md).

## §5 §1.7 self-reflexive note

**Forward-check.** Complies with [rule-enforcement-channel-selection.md §1/§3](rule-enforcement-channel-selection.md):
the stop-moment failure IS mechanically detectable (is anything in flight?) → **gate**, placed
at the only channel that fires then (Stop hook); the residual «is there work I still owe?» is
judgment → injection, and labelled as such rather than dressed as a gate. Complies with
[attention-is-not-a-mechanism.md §1](attention-is-not-a-mechanism.md) for the gated half, and
§1/§3 name plainly which half is prose. Complies with [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md):
bash + curl + jq, zero API-billed calls. Complies with [doc-authority-hierarchy.md §2-§3](doc-authority-hierarchy.md)
(Class + Authoritative-for header) and principle 31 (channel declared via the `<!-- channel: -->`
marker, whose named artifact carries the `#F10` anchor). Complies with
[language-discipline.md §1](language-discipline.md) (machinery in English). Complies with
[build-first-reuse-default.md](build-first-reuse-default.md) — **REUSE**, no new artefact: both
arms are added to hooks that already ship, and §2 deliberately does **not** build a new waiter
because [`await.ts`](../../packages/runtime-bridge/src/cli/await.ts) already is one; proposing a
`scripts/aif-await.sh` was considered and rejected as `#parallel-evolution-creep`.
[ai-laziness-traps.md](ai-laziness-traps.md): **T2** — the arm was run, not designed: all four
branches were exercised against the live runtime (in-flight → block, unreachable → block-and-name,
`stop_hook_active` → silent, autonomy off → silent), with the in-flight case a true positive on a
real dispatched task; **T15** — this rule governs the session that wrote it, and that session
used the arm's own discipline (it continued past several reportable boundaries rather than
ending on them).

**Backward-check.** Class of this change = *hooks that decide whether an unattended turn
continues, and waits the loop depends on*. Enumerated: (a) [`end-of-turn-reminder.sh`](../hooks/end-of-turn-reminder.sh)
— **EXTENDED** in place; every pre-existing branch is untouched and still tested (41/41), and
the arm shares one `decision:block` with a normal branch rather than emitting a second.
(b) [`inject-session-bootstrap.sh`](../hooks/inject-session-bootstrap.sh) — **EXTENDED**, opt-in;
verified byte-identical output with `AIF_AUTONOMOUS` unset. (c) [`await.ts`](../../packages/runtime-bridge/src/cli/await.ts)
+ [`aifWsStatus.ts`](../../packages/runtime-bridge/src/aifWsStatus.ts) — **SWEPT, GAP FOUND and
recorded** (§2 residual: reconnect handled, idle stall not) rather than silently left; the fix is
scoped in §4, not bundled. (d) [`heal.sh`](../skills/aif-doctor/helpers/heal.sh) — **SWEPT-CLEAN**:
already reads `GET /tasks` and fails closed on a fetch/parse error (finding F1, merged #1129), the
same posture §1 property 2 adopts — consistent, nothing superseded. (e) [`night-mode/SKILL.md`](../skills/night-mode/SKILL.md)
— **SWEPT-CLEAN, complementary**: it owns the overnight loop's shape and already carries an
honestly-labelled prose paragraph about the server-delivered dispatch default; this rule owns the
stop-moment and the wait, does not restate the loop, and its §1 mechanism is what that paragraph
lacked. No rule previously claimed authority over turn-continuity (grep over `.claude/rules/**`
for `reportable boundary|stop.*boundary|silence.*health` returned nothing before this file).

## See also

- [`research-patches/2026-07-24-autonomous-loop-diagnostics.md`](../../docs/meta-factory/research-patches/2026-07-24-autonomous-loop-diagnostics.md) — findings F2 and F10, the incident base.
- [`.claude/hooks/end-of-turn-reminder.sh`](../hooks/end-of-turn-reminder.sh) `#F10` — the Stop-hook arm.
- [`.claude/hooks/inject-session-bootstrap.sh`](../hooks/inject-session-bootstrap.sh) — the opt-in autonomy block.
- [`packages/core/hooks/end-of-turn-reminder.test.ts`](../../packages/core/hooks/end-of-turn-reminder.test.ts) — paired self-tests for the arm.
- [`attention-is-not-a-mechanism.md`](attention-is-not-a-mechanism.md) — why the prose half is labelled prose.
- [`destination-environment-verification.md`](destination-environment-verification.md) — sibling rule from the same diagnostics (finding F3).
