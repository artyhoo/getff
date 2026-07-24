<!-- scope:autonomous-loop-diagnostics -->

# Autonomous dispatch loop — nine defects found by running it

> **Type:** R-phase research patch (operational diagnostics, docs-only deliverable).
> **Scope:** the unattended orchestrator loop — dispatch → monitor → verify → harvest → PR → CI —
> as exercised on 2026-07-24 across three aif jobs (`hook-tsx-resolution-fix`,
> `aif-doctor-helper-parity`, `hook-tsx-resolution-sweep`).
> **Method:** every finding below was produced by the loop failing or nearly failing in a live run.
> None is inferred from reading code. Each carries the command that produced it.
> **Date:** 2026-07-24.

---

## §1 Why this exists

The operator's stated goal is a loop that runs **fully autonomously, without stumbles**. The
dispatch mechanics are documented (`.claude/skills/dispatcher/SKILL.md`), and the autonomy policy is
documented (`.claude/skills/night-mode/SKILL.md`). What was NOT documented is the set of ways the
loop degrades in practice — signals that lie, notification channels that die silently, and
environment asymmetries that turn a green test into no evidence at all.

Nine such defects surfaced in one day of running it. They are recorded here because each one is
invisible to CI by construction: they are properties of the *orchestration*, not of the diff.

**Severity key:** **S1** — can corrupt work or produce a false pass. **S2** — stalls the loop until
a human notices. **S3** — costs turns, no correctness risk.

---

## §2 The findings

### F1 — `/agent/status` reports zero while the queue is busy (S1)

The capacity signal the runtime exposes is wrong, and something automatic depends on it.

```bash
curl -s localhost:3009/agent/status | jq '.activeTaskCount'        # → 0
docker logs aif-handoff-agent-1 --tail 300 | grep '"active"'       # → {"active":2,"limit":3}
curl -s localhost:3009/tasks | jq '[.[]|select(.status!="done")]|length'  # → 4
```

Measured 2026-07-24 16:2x local time with two tasks genuinely occupying lanes.

**Why it matters beyond diagnosis:** `.claude/skills/aif-doctor/helpers/heal.sh:5-13` decides
whether healing is safe by reading exactly this field, and
`packages/runtime-bridge/src/cli/dispatch.ts` (`runPreflight`) invokes `heal.sh` automatically via
`RUNTIME_BRIDGE_PREFLIGHT` before **every** dispatch. So the preflight can conclude "no task in
flight" and refresh the container base **underneath a running worker** — replacing the tree the
worker is building against.

This is the same defect class as the one `refresh-aif-base.sh` was fixed for in PR #1128 (a safety
decision resting on a signal that does not mean what it appears to mean), one layer up.

**Prevention:** any "is it safe to mutate the runtime" decision reads the coordinator log or the
task list, never `activeTaskCount`. Recorded as the GAP-FOUND in #1128's backward-check.

### F2 — the `Monitor` channel dies without saying so (S2)

A `Monitor` was armed on job A's task status, polling every 60s and emitting on any transition. Job
A reached `done` at `10:38:30Z`. **The monitor emitted nothing** — not the transition, not a
terminal event. Its only output all session was one `POLL_ERROR` on the first tick. The task was
later reported by the harness as:

> "No completion record was found for this background shell command… It may have been stopped (via
> the UI, Monitor timeout, or agent teardown — these leave no transcript marker)"

The orchestrator sat waiting on a channel that had already died, and the operator had to intervene
with «ты должен был сам проверить».

**Prevention (the load-bearing one in this patch):** a monitor is a *convenience*, never the
primary wake signal. The primary signal is the orchestrator polling the source itself
(`GET /tasks/:id`) on its own schedule. In this harness that schedule is `ScheduleWakeup` — see §3.

### F3 — the aif container is not the host, and tests silently encode that (S1)

Two independent instances in one day:

| binary | in the aif container | on the operator host |
|---|---|---|
| `tsx` at `$REPO_ROOT/node_modules/.bin/tsx` | absent (linked worktree) | present |
| `docker` | **absent entirely** (`command -v docker` → nothing) | present |

The second one produced a textbook false pass. Job C shipped a fixture suite reporting **5/5 PASS**
in the container; the same suite scored **0/5** on the host. Cause: the container has no `docker`
binary, so the fixture's stub was the only `docker` on `PATH` and intercepted every call. The
helper under test (`refresh-aif-base.sh`) is an **operator-side** tool that by definition runs where
docker exists — so the suite was green exactly where the tool never runs, and red where it does.

The worker was not dishonest: 5/5 was true *for its environment*. The defect is structural — the
execution environment differs from the destination environment, and nothing in the loop forced that
gap to be noticed.

**Prevention:** the orchestrator re-runs the worker's own verification on the host before harvest.
Not as belt-and-braces — as the only place the environment gap is observable. CI does not close it
either: CI runners may lack docker too.

### F4 — `status=done` is not evidence, and neither is a green suite (S1)

Both are necessary and neither is sufficient. The working discipline that caught real problems:

1. `git -C <worktree> log --oneline staging..HEAD` — did the worker commit anything at all?
2. `git show --stat <sha>` — is the change what the kickoff asked for, file by file?
3. Run the tests on the host (F3).
4. **Mutation check:** revert *only* the fix, re-run, confirm the suite goes RED and that the
   failures name the defects the fix targets.

Step 4 is what separates a real paired-negative from a decorative one. On job A it confirmed
`tier 2: linked worktree resolves tsx from main worktree` fails without the fix — the criterion a
prose-only suite would have faked, and the one a cancelled v1 of that kickoff actually did fake. On
job C it turned 4/5 RED with matching diagnoses (`parked tree not detected (defect 1)`,
`branch -f refused on checked-out branch`).

### F5 — `ci-wait` exit code vs. its own output (S1)

Reading the exit code of whatever the script was piped into reports a red CI as green. The
handoff already warned about this from a prior session; it is repeated here because the correct
form is not obvious:

```bash
~/.claude/scripts/ci-wait.sh <PR> --repo <owner/repo>   # backgrounded
# then READ the output file — its own line, e.g. "CI GREEN: 38 pass (poll 9)"
```

Confirm independently before claiming green: `gh pr checks <PR>` filtered to non-pass rows, plus
`mergeStateStatus` moving `BLOCKED` → `CLEAN`.

### F6 — a pre-push gate degrades with repository age, not with the diff (S2)

`packages/core/principles/11-build-first-reuse-default.test.ts` F1 blocked two pushes this session
by exceeding its 30 000 ms budget. Both passed on retry — the gate was never bypassed.

Measured, five isolated runs: **23.93 · 24.11 · 24.15 · 25.99 · 26.08 s** — a 13-20% margin.

The comment justifying the budget (`:322`) says «~180 files (~13s standalone)». Actual population
today, counted by reproducing `getCapabilityFiles()`: **200 files** (125 `packages/core` ≥50 LOC,
21 other packages ≥80 LOC, 24 rules, 14 skills, 16 agents) — **+11% files for +92% time**.

So population growth does *not* explain it. The cost driver is `:184`:

```bash
git log --diff-filter=A --format=%H -1 -- "<path>"
```

Git walks back from HEAD until it finds the commit that *added* the file. For a long-lived file that
is nearly the whole history — and history is **1474 commits** and grows with every PR, including
PRs that add no capability files at all. Cost ≈ files × depth-to-their-introduction, and the second
factor rises monotonically regardless of what is merged.

**Consequence for autonomy:** this gate will fail more often over time, on unrelated work, in an
unattended run where a human is not there to retry. Raising the timeout postpones it; batching the
lookup into a single `git log --diff-filter=A --name-only` pass over history removes the linear
subprocess cost. Not fixed here — out of this patch's scope, recorded with numbers.

### F7 — kickoff-to-dispatch has two channels and only one is documented (S3)

`.claude/rules/kickoff-staging-placement.md §1` requires a kickoff to reach `staging` before
dispatch. That rule is about `/pipeline`, which *scans* the branch it runs on. A direct
`dispatch.ts <path>` invocation is different: `packages/runtime-bridge/src/AifHandoffBackend.ts:233`
sends `description: kickoff.content` — the **full text** travels over REST and becomes the planner's
input. So an unmerged kickoff dispatches fine.

Verified before relying on it, rather than trusting the handoff's assertion.

**Prevention:** both are true and neither supersedes the other — dispatch works unmerged; merge the
kickoff anyway so `/pipeline`, dedup probes and later sessions can see it. This patch's own sweep
kickoff went through PR #1127 for exactly that reason.

### F8 — harvest by blob, never by worktree diff (S1)

`git diff staging..HEAD` inside an aif task worktree shows **phantom deletions**: files merged to
staging *after* the worktree was born read as deleted. Harvesting that diff reverts live work — it
nearly deleted two freshly-merged kickoffs in the predecessor session.

Working form:

```bash
docker exec aif-handoff-agent-1 git -C <worktree> show <sha>:<path> > <path>
```

onto a branch cut from **current** `origin/staging`.

### F9 — local hygiene that stalls the loop (S3)

Small, but each cost turns in an unattended run:

- Materialising a kickoff locally for dispatch leaves an untracked file that **blocks `git rebase`**
  once the same path arrives via staging. Verify byte-identity (`git show origin/staging:<p> | diff -`)
  before removing, then remove **pointwise** — `git-safety.sh` blocks `rm -r` outside temp dirs, correctly.
- `gh pr create` is gated locally by the §1.7 mirror: each check section needs a real
  `file.ext:line` citation. It rejected a body here, and the fix exposed a second error — the
  citation I added pointed at `check-kickoff-traps.sh:46` (`if ! command -v jq`) while describing it
  as the gate; the actual rule is at `:9`. **A citation must say what the cited line says**
  (`ai-laziness-traps.md §2 T3`); the gate only checks the shape, not the truth.

### F10 — the orchestrator stops the loop early, and calls it "done" (S2)

Added after the original nine, from the same session, at operator challenge.

With every dispatched job harvested and its PR green, the orchestrator stopped its own
`ScheduleWakeup` loop (`stop: true`) and reported the work complete. The operator's response was
«/loop опять отключился? Почему ты не работаешь автономно?» — and the loop had not failed, it had
been **switched off deliberately**, on the reasoning that only a human merge click remained.

That reasoning was wrong on two counts, both checkable at the time:

1. **A tail remained after the merge.** Syncing the container base and re-firing the gates to prove
   the fix reached the runtime are orchestrator steps, not operator steps. They were even written
   into the session handoff as "first thing to do" — i.e. the orchestrator knew work remained and
   still stopped.
2. **Four findings in this very patch were open**, one of them S1 (F1). "Nothing left to do" and
   "nothing left that is comfortable to report on" are different states; the stop conflated them.

The failure shape is **`#stop-at-the-reportable-boundary`**: an autonomous loop terminating at the
point where a clean summary is available, rather than at the point where the work is actually
exhausted. It is attractive precisely because that boundary *feels* like completion — every open
item is documented, every PR is green, the story reads well.

**Prevention.** The terminating condition for an unattended loop is **"no remaining step that I can
take without the operator"**, not "no remaining step before the next operator action". Before
calling `stop: true`, enumerate: (a) post-merge steps that are mine; (b) open findings I have
authority to work; (c) anything the handoff assigns to the next session that I could do now. A
non-empty list means re-arm, not stop. If the list is genuinely empty and only operator actions
remain, say so explicitly — "stopping because every remaining step needs you, here they are" —
rather than "work complete".

---

## §3 The autonomy pattern that works

Distilled from F2 + F4 + F10. The loop must be **self-driven**, not notification-driven:

1. **Poll the source yourself.** `GET /tasks/:id` on your own schedule. Never treat silence from a
   monitor as "still running" — silence and death are indistinguishable on that channel (F2).
2. **Schedule your own wake-up.** `ScheduleWakeup` with a delay matched to the work
   (~20 min for an aif job of this size, which ran ~25 min end-to-end), re-armed each turn. A
   `Monitor` may run *alongside* as a bonus early signal; it is never the thing you rely on.
3. **Verify before believing.** F4's four steps, in order, every time.
4. **Re-verify the runtime after mutating it.** After syncing the container base, prove the gate is
   alive by *firing* it, not by grepping for the fix:

   ```bash
   docker exec aif-handoff-agent-1 bash -c 'cd /home/www/rules-as-tests-aif &&
     printf "%s\n" "# Probe doc" "" "No authority header." > .claude/rules/_gate-probe.md &&
     printf "{\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"…/_gate-probe.md\"}}" |
     bash .claude/hooks/check-doc-authority.sh; echo "EXIT=$?";
     rm -f .claude/rules/_gate-probe.md'
   # → FAIL … missing "> **Authoritative for:**" header / EXIT=2
   ```

   A grep proves the text changed. Only firing proves the gate enforces.

   **Fire it where the defect lives, or the probe is theatre.** The first run of this probe was
   done in the container's **main checkout** and "passed" — but that checkout HAS
   `node_modules/.bin/tsx`, so the pre-fix single-path resolver found it and the gate would have
   enforced *with or without the fix*. The defect only exists in a **linked worktree**, which has no
   `node_modules`. Re-run there (`git worktree add --detach /tmp/probe <ref>`), and the contrast is
   unambiguous:

   ```text
   with fix:  EXIT=2  FAIL … missing "> **Authoritative for:**" header       → gate ENFORCES
   pre-fix:   EXIT=0  ⚠ tsx not found — DID NOT RUN. This is a SKIP, not a pass → gate DEAD
   ```

   For the formerly-silent hook the pre-fix column is literally `NOTHING APPEARED` — the same
   string the audit recorded. Probing in the wrong environment reproduces F3 with the orchestrator
   as the subject instead of the worker.

5. **Do not stop at the reportable boundary (F10).** Terminate on "no remaining step I can take
   without the operator", never on "no remaining step before the operator's next action".

---

## §4 Self-application (T15)

This patch documents a verification discipline, so: was it verified that way? Yes, and the check
found an error in the patch's own reasoning. The F6 entry originally claimed the slowdown came from
capability-file growth. The falsifier stated for that claim — «wrong if the population did not grow
proportionally» — was then actually run (counting 200 files against the documented ~180), and it
**refuted the claim**. The entry above states the corrected cause (history depth), which is worse
than the original: it degrades on every commit, not only on capability commits.

An unfalsified version of F6 would have sent a future session to optimise the wrong thing.

**The second-order case (added with F10).** Two of the findings here have the orchestrator, not a
worker, as the subject — and both were caught by the operator rather than by self-review:

- **F3 applied to me.** I rejected a worker's suite because it was green only in an environment the
  tested tool never runs in — then "proved" a restored gate by firing it in the container's main
  checkout, where the pre-fix code would have passed too. Same error, one role up, ~two hours apart.
- **F10 itself.** I stopped an unattended loop at the point where a clean report was available, with
  four open findings in this document and a post-merge tail I had written into the handoff myself.

The pattern worth recording is not "the orchestrator makes mistakes" but that **the orchestrator's
mistakes have no reviewer**. Every worker deliverable passed through an adversarial check I ran;
nothing ran an adversarial check on me. The countermeasures in §3 are what a reviewer would have
said — which is why they are written as terminating conditions and environment requirements, not as
reminders to be careful.

---

## §5 Status of each finding

| # | severity | state |
|---|---|---|
| F1 `/agent/status` lies | S1 | **open** — reported in #1128 backward-check; needs its own fix in `heal.sh` |
| F2 monitor dies silently | S2 | **mitigated by practice** (§3), not by a mechanism |
| F3 container ≠ host | S1 | **open as a discipline gap** — no channel forces the host re-run |
| F4 done ≠ evidence | S1 | practice, documented here |
| F5 ci-wait output vs exit | S1 | practice, already in the session handoff |
| F6 gate degrades with history | S2 | **open** — measured, cause identified, fix not attempted |
| F7 two kickoff channels | S3 | resolved — both true, both applied |
| F8 phantom deletions | S1 | practice, applied on all three harvests today |
| F9 local hygiene | S3 | resolved in-session |
| F10 stop at the reportable boundary | S2 | **mitigated by practice** (§3 item 5), not by a mechanism — and the loop was re-armed the moment it was challenged |

Four remain open. None is fixed by this patch — it is a diagnostics deliverable, and each open item
is a separate concern with its own scope.
