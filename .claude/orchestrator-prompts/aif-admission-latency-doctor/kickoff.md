# aif-admission-latency-doctor — kickoff

<!-- bridge-profile: Z.AI GLM-5.2 SDK -->

> **Type:** I-phase — one bounded doc edit: add catalogue entry **§3.7** to
> [.claude/skills/aif-doctor/SKILL.md](../../skills/aif-doctor/SKILL.md).
> **Origin:** the `aif-live-smoke-run0` acceptance run. Finding D9 was OBSERVED live on 2026-07-25
> (timeline in §1 below), which satisfies the catalogue's own growth rule: `/aif-doctor §3` grows on
> incidence only (`T-AIFDOC-B`) — codify observed modes, never speculative ones.
> **Deliverable:** one PR against `staging` adding §3.7 in the §3.6 house format. Nothing else.
> **Base branch:** staging.

## §0 Cold-start context — self-contained, read only this

`/aif-doctor` is this repo's read-only diagnosis skill for the aif-handoff runtime. Its §3 is a
symptom catalogue: each entry = failure class + read-only detection commands + discriminators +
Tier-1 (reversible) fix or mitigation. §3.6 (the newest entry, at `SKILL.md:141`) is the format
reference — mirror its structure: **failure class → Detect (read-only) → discriminator →
Fix/mitigation (Tier 1)**, with `file:line` anchors for every mechanism claim.

All evidence you need is inlined in §1 — the observation report lives outside the repo, so **do not
try to find it; do not re-derive the mechanism**. Your job is codification, not investigation.

## §1 The observed mode (evidence inline — this is the §3.7 content source)

**Symptom:** a task dispatched while another task of the same project is mid-flight sits in
`backlog` for the *entire remaining lifecycle* of the active task, despite free capacity.
Measured 2026-07-25: 47 minutes in `backlog` at `active=1, limit=5` (four slots idle), with
`grep -c "at capacity"` over the coordinator log = **0**.

**Resolution observed (this is what discriminates latency from starvation):** the blocking task
reached `done` at `09:37:52.345Z` and in the **same second** the coordinator logged, in order:

```text
09:37:52Z  Poll cycle complete            ← the 47-minute cycle finally returned
09:37:52Z  Starting poll cycle            ← do…while follow-up ran another immediately
09:37:52Z  Auto-queue advanced next backlog task
09:37:52Z  Auto-queue advance pass complete
```

…and the waiting task's activity log opened with `[auto-queue] Advanced by project auto-queue mode
(pool 1/5)`. So this is **admission latency bounded by the active lane's exit (task termination),
not starvation and not capacity** — «only DELETE frees it» folklore does NOT apply to this state.

**Mechanism, source-verified in the running image (`/app/packages/agent/dist/coordinator.js`), all
anchors re-checked 2026-07-25 — cite them in the entry:**

- `coordinator.js:825` — `pollAndProcess()` short-circuits every tick while a cycle is open
  (`Poll cycle already active; queued one follow-up cycle`), and its `do…while(followUpPollRequested)`
  drain guarantees a fresh cycle immediately after the long one returns.
- `coordinator.js:647` — `runPollCycle()` runs `processAutoQueueAdvance()` as step 5, *before* the
  project lanes; admission can therefore only happen at cycle start.
- `coordinator.js:702` — `processProjectLane()` iterates the PIPELINE stages **once per lane pass**,
  selects candidates **once per stage**, and `await`s all spawned stage tasks before lane exit
  (`[FIX:149] Draining started stage tasks before lane exit`). A lane therefore carries its active
  task through planning→implementing→review→done without returning, and the cycle — hence the next
  admission window — is open exactly that long.

**Two known non-fixes (both measured — the entry must name them so the next session does not
re-try them):**

- **Raising the caps does nothing.** `env.js:109-110`: global cap `max(100).default(12)` (currently
  set to 5), per-project hard-capped at `max(10)` — and the wait happened with four slots idle, so
  width was never the constraint.
- **`start_ai` is not a mid-flight admission path.** `stateMachine.js:80` (`backlog: ["start_ai"]`)
  + `stateMachine.js:15-19` (patches `status:"planning"` with **no capacity check**) make it look
  like direct admission, but per `coordinator.js:702` the busy lane has already passed its
  planner-stage candidate selection, so the task waits for the next cycle anyway — a cosmetic
  status change that additionally **bypasses the capacity cap** (unsafe as a default path).

**Mitigation that works today (zero code):** batch-dispatch into an **idle** runtime — the advance
pass fills the pool to the limit in a single tick (`while (active < limit)` loop in
`processAutoQueueAdvance()`, `coordinator.js:547`), so N tasks queued while nothing runs are
admitted together on the next cycle.

## §2 What to do — the whole «how», in one sentence

Insert a new `### §3.7` entry after §3.6 in `.claude/skills/aif-doctor/SKILL.md`, in the §3.6 house
format, titled along the lines of «Admission bounded by the active lane's exit — dispatched task
idles in `backlog` with free slots», carrying: the failure class (from §1), read-only detection
commands, the latency-vs-starvation discriminator, the two named non-fixes, and the batch-dispatch
mitigation — every mechanism claim with its `file:line` anchor from §1.

**Detection commands for the entry (adapt wording, keep substance):**

```bash
# no admission since the last advance, while a task is active and capacity is free:
docker logs aif-handoff-agent-1 --since 30m | grep -cE '"msg":"(Auto-queue advanced|Poll cycle complete)"'   # 0 0 = window closed
docker logs aif-handoff-agent-1 --since 30m | grep -c '"at capacity"'                                        # 0 = not a capacity problem
docker logs aif-handoff-agent-1 --since 30m | grep -c 'Poll cycle already active'                            # >0 = cycle busy → LATENCY, not starvation
```

## §3 «Works» — acceptance checks

- The new entry follows the §3.6 structural pattern (bold lead-ins: failure class / Detect /
  Fix or Mitigation; `file:line` anchors present for coordinator.js:825/:647/:702, env.js:109-110,
  stateMachine.js:80).
- §3.7 sits after §3.6, before `## §4`; the `---` separator pattern around entries is preserved.
- File stays under the 600-line pre-commit gate (276 lines before the edit — verify with `wc -l`).
- No other section of SKILL.md is modified.

```bash host-verify
grep -q '^### §3.7' .claude/skills/aif-doctor/SKILL.md
grep -q 'coordinator.js:702' .claude/skills/aif-doctor/SKILL.md
test "$(wc -l < .claude/skills/aif-doctor/SKILL.md)" -lt 600
```

## §4 Park-don't-guess contract (aif agent — non-negotiable)

On ANY genuine fork — two defensible wordings with different operational consequences, or a claim
§1 does not evidence — **do NOT pick.** Park it as «Option A → consequence X / Option B →
consequence Y», stop that thread, and proceed on the unambiguous parts.

One park trigger named in advance: if you believe the entry should *also* prescribe an upstream
coordinator change (e.g. moving `processAutoQueueAdvance()` onto its own interval), **park that as
a note** — upstream `lee-to/aif-handoff` changes are outside this repo's PR and outside this task.

## §5 Anti-scope

- ONLY `.claude/skills/aif-doctor/SKILL.md` changes. No other file.
- Do NOT edit other §3.x entries, §1, §2, §4, or the skill frontmatter/description.
- Do NOT edit any hook, renderer, rule file, or `docs/meta-factory/**`.
- Do NOT add dependencies. Do NOT write `done.md` (closure belongs to the harvesting session).
- Do NOT attempt to reach the aif runtime, docker, or the coordination directory — every fact the
  entry needs is inlined in §1.

## §6 AI-traps active

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md).
**Active traps for this stage: T2, T3, T7, T14, T15, T20.**

- **T2** — writing «the detector would show…» without carrying the actual commands into the entry is
  designing, not codifying. The §2 commands go in (adapted, not dropped).
- **T3** — every mechanism claim in the entry carries its `file:line` anchor from §1; no prose-only
  mechanism statements.
- **T7** — do not pattern-match §3.6's *content* (it is about hooks, not admission); mirror its
  *format* only.
- **T14** — the entry must keep the latency-vs-starvation discriminator explicit; collapsing the two
  into one vague «task stuck» mode destroys the diagnostic value.
- **T15** — self-application: the entry you write is itself a doc claim about runtime behaviour;
  anchor every claim so a future truth-sweep can re-verify it by command.
- **T20** — no verdict-bearing sentence («X does not help») without its evidence anchor.

**Domain-specific traps (NOT in the canonical catalogue):**

- **T-ADM-A — «paraphrased the anchor away».** Rewording §1 into smooth prose while dropping the
  `file:line` anchors makes the entry unverifiable — the exact defect class the sibling
  `stale-pending-claims` sweep just cleaned up. Counter: §3's host-verify greps for a load-bearing
  anchor literally.
- **T-ADM-B — «upgraded latency into starvation» (or the reverse).** The observed mode is LATENCY
  (the 09:37:52 same-second sequence proves admission fires at lane exit). Writing «tasks starve
  forever» — or the opposite, «admission is instant» — misstates the observation. Counter: quote the
  09:37:52 sequence in the entry's discriminator.
