<!-- scope: stage kickoff — aif-admission-latency A1 (research issue + mid-cycle admission fix). Dispatch input for ONE executable task in `artyhoo/aif-handoff` (fork of `lee-to/aif-handoff`) through aif project `ec817095-89ec-4959-a4c9-34327326df11`, container base `/home/www/aif-handoff`. The umbrella plan lives in ../aif-admission-latency/kickoff.md and is NOT this file's scope. Filename `kickoff-a1.md` = umbrella A, stage 1 — the `kickoff-<letter><digit>` shape is what places it in the stage-kickoff family principle 12's citation gate resolves. No runtime-profile marker is attached, on purpose: the project's default profiles (GLM-5.3 planner/reviewer, GLM-5.3-Flash implementer) already resolve; do not pass a preset. -->

# aif-admission-latency A1 — upstream research issue + mid-cycle admission fix

> **Type:** code + tests + issue text, single aif task, autonomous. **Deliverables:**
> TWO new files at the task-branch root — `ISSUE-ADMISSION-LATENCY.md` and
> `A1-REPORT.md` — plus the fix itself as commits on the task branch (code changes
> confined to the admission path: `packages/agent/src/coordinator.ts` and whatever
> minimal siblings it genuinely needs; docs/CHANGELOG entries per repo convention).
> **Umbrella context (read-only):** [`kickoff.md`](kickoff.md) §0 (why upstream), §2
> (floors — no pushes, no factory operations, upstream-first shape).
> **Rigor label (effort-worthiness L0):** `build-and-verify` — the patch is proposed
> to an external project; an unfixed regression or an unproven outcome claim here
> becomes someone else's production bug.

<!-- host-verify: acceptance = §3 gate rows re-run independently by the host in the harvested worktree (npm build/test invocations, file-shape diffs, anchor re-resolution); the artifacts land as commits on the task branch, harvested and re-verified by the host. -->

## §0 Goal

The 2026-09-11 investigation (host session; payload pinned in §1 rows 8-10 — treat as
GIVEN input data, do not re-derive) established: aif admits backlog tasks ONLY at poll
cycle boundaries; a cycle stays open until every project lane drains; so a task
dispatched while ANY lane is mid-pass waits out that lane's full runtime (measured
90.6 min; historical worst 16.3 h) even when its own project's slots are all free.

Two outputs, both upstream-ready:

1. **D1 — `ISSUE-ADMISSION-LATENCY.md`:** a GitHub-issue text (English) a maintainer
   can act on: symptom, mechanism with anchors YOU re-verify at your HEAD, the pinned
   empirical data (rows 8-9), ≥2 candidate designs with trade-offs, a concrete
   proposal. Paste-ready for `lee-to/aif-handoff` (but the operator pastes it, not you).
2. **D2 — the fix, on this branch:** the OUTCOME requirement (not a mechanism
   prescription): **a backlog task on a parallel-enabled project with free slots
   begins actual processing within one poll interval of becoming eligible, even while
   another project's lane is mid-pass** — with sequential-project semantics unchanged,
   concurrency caps still respected, and idle-factory behavior unchanged.

## §1 Do this FIRST — entry re-verification

Rows 1-7: facts measured **2026-09-11 from the host**; re-verify, act on what you
find, quote command + output (T3). Rows 8-10 are **GIVEN research payload** — pinned
data from the investigation; carry them into D1 verbatim-numbers, do not re-derive.

| # | Fact at authoring | How to re-verify |
| --- | --- | --- |
| 1 | Task worktree branched from `/home/www/aif-handoff` at `main` = **`d82e466`** ("Merge remote-tracking branch 'upstream/main'", 2026-09-03) — the fork tip, equal to `upstream/main` + the operator's image-merge `7743089` in ancestry | `git -C /home/www/aif-handoff log --oneline -1`; `git log --oneline -1` in your worktree |
| 2 | Working tree clean; the clone came from a bundle — `origin` points at the bundle path, fetch is impossible; record, don't chase | `git status --porcelain` (expect empty); `git remote -v` |
| 3 | The src tree matches the RUNNING factory build: `packages/agent/src/coordinator.ts` contains the `[FIX:149]` revalidation markers (commit `45e66e6` 2026-07-15). Record the count — it is the identity check between your source and the live behavior the investigation measured | `grep -c 'FIX:149' packages/agent/src/coordinator.ts` |
| 4 | Toolchain: node v22 / npm 10; **npm registry reachable, github.com NOT** (expected — egress closed by design; a fetch or PR attempt is a floor violation, not a workaround task) | `node -v`; `npm ping` (expect 2xx); `curl -m 6 -sS -o /dev/null -w '%{http_code}' https://github.com` (expect failure) |
| 5 | Baseline: `npm ci` at repo root (workspaces + turbo), then `npm run build` and the agent-package tests — quote results BEFORE any edit. Pre-existing failures: record and scope your green claim to the targeted suite | `npm ci && npm run build`; `npm test --workspace @aif/agent` (if the workspace name differs, find it: `cat package.json` → `workspaces`) |
| 6 | Repo conventions: `CONTRIBUTING.md`, `CHANGELOG.md`, lint/format scripts exist — read before writing code; match existing test file patterns under `packages/agent` | `ls`; `sed -n '1,40p' CONTRIBUTING.md`; find existing coordinator tests (`ls packages/agent/test* packages/agent/src/**/*.test.* 2>/dev/null` or grep) |
| 7 | The live factory DB is co-mounted at `/data/aif.sqlite` (shared volume). OPTIONAL read-only re-verification of row 9 stats; never write, never lock long | only if you choose to re-verify: `NODE_PATH=/app/node_modules node` + better-sqlite3 `readonly: true`, in the api container's toolchain if reachable from yours — if not reachable, skip silently (the data is GIVEN) |
| 8 | **GIVEN — incident timeline (UTC, 2026-09-11):** 12:22:48.753 task done → 12:22:48.893 advance pass lifted 3 tasks across 3 projects (advanced:3; for the emptied project: `active:0, limit:5, "no more backlog ready"` — it had nothing queued) → 12:27:40-47 four tasks created on the emptied project → every coordinator tick logged `Poll cycle already active; queued one follow-up cycle` (16×, 12:24-12:45) → 13:58:14.033 the last foreign task passed review (`Auto review gate accepted review, moving to done` → `Poll cycle complete` → `Starting poll cycle`) → same second: advance lifted 2 more backlog tasks → 13:58:14.829 the four waiting tasks claimed via the `[FIX:149] Revalidating task candidate after coordinator permit` lane path → worktrees created 13:58:16-19. **Admission latency 90.6-90.7 min = the foreign cycle's remaining runtime.** Manual `start_ai` on the four at 12:45 changed status to planning but started nothing (candidate pickup happens inside a cycle) | given; optionally cross-check log-line strings against the source you read |
| 9 | **GIVEN — empirical history (200 tasks, 2026-07-26 → 2026-09-11, latency = first activity-log timestamp − created_at):** instant (<2 min) ≈ half of all tasks (the lucky idle-window dispatches); multi-hour waits occurred on every code version in that window: Aug 01 median 27.7m; Aug 12 max 136.1m; Aug 17 median 58.9m; Aug 18 p90 **978.2m (16.3 h)**; Aug 19 median 45.8m; Sep 03 median 57.3m max 151.2m; Sep 06 median 66.6m max 174.4m; Sep 08 median 65.4m max **225.6m**; batch signatures visible (five tasks created together all waiting exactly 65.0-65.4m — one admission window lifted them together) | given; optional re-derivation per row 7 |
| 10 | **GIVEN — mechanism anchors (fork src, re-verify each at YOUR HEAD before citing in D1):** `coordinator.ts:907` `processAutoQueueAdvance()`; `:977` `while (active < limit)` fill loop; `:995` `claimBacklogTaskForAdvance` CAS claim; `:1048` `runPollCycle()`; `:1062` the advance call (once per cycle); `:1115` `processProjectLane()`; `~:1297` `pollAndProcess()` guard — `activePollPromise` set → tick queues ONE follow-up and returns; `packages/data/src/index.ts:2305` `claimBacklogTaskForAdvance`, `:2625` `nextBacklogTaskByPosition`. Upstream state: zero commits after 2026-09-03; coordinator last touched `325eb88` 2026-08-08 (GitHub workflow, not admission) | `sed -n` each anchor; quote the line content |

## §2 Deliverables

### D1 — `ISSUE-ADMISSION-LATENCY.md` (the upstream issue text)

English, paste-ready. Required sections:

1. **Title + one-paragraph symptom** (queue waits bounded by the longest in-flight
   lane, not by own-project capacity).
2. **Mechanism** — anchors from §1 row 10, each re-verified at your HEAD with the
   line content quoted in D4; explain the serialized cycle (admission once per
   `runPollCycle`, lanes awaited to drain, follow-up coalescing in `pollAndProcess`).
3. **Empirical impact** — the row 8 timeline and the row 9 stats table, clearly
   labeled with collection method (activity-log first-timestamp minus created_at,
   200 tasks, 2026-07-26→2026-09-11) and the honest caveat (instant ≈ half — the
   design is not broken for idle factories; the cost lands on busy ones).
4. **Candidate designs, ≥2, with trade-offs** — e.g. (a) event-driven admission: on
   task-creation / task-exit / `agent:wake` events, if a project has free slots, run
   the CAS-protected advance AND spawn/extend its lane outside the serialized cycle;
   (b) per-project long-lived lanes replacing per-cycle batches; (c) your own minimal
   design. Name the risks you see (double-processing, cap bypass, review-gate
   reentrancy, sequential-project regression).
5. **Concrete proposal** — what YOUR patch (D2) does, and what it deliberately does
   not.

### D2 — the fix (commits on the branch)

The outcome contract (§0.2) is the acceptance bar; the mechanism is YOUR design
decision — record it in D4 §2 with rejected alternatives. Constraints:

- Sequential projects (`parallelEnabled: false` or task-state-forced serial): exact
  current semantics.
- `COORDINATOR_MAX_CONCURRENT_TASKS` (global) and per-project caps: still enforced.
- Idle factory: admission still effectively immediate.
- No staging/UX changes, no DB schema changes, no new required config (an opt-in
  flag defaulting to the new behavior is acceptable if it protects the rollout —
  document it).
- Follow repo conventions (row 6): lint, format, CHANGELOG entry per its format,
  docs update if `docs/configuration.md`/`docs/architecture.md` describe admission
  behavior they'd now misstate.

### D3 — the regression test

One test the maintainer can read in 30 seconds: two projects, A's lane held mid-pass
(fake/slow runtime per existing test patterns), B parallel with a queued backlog task
and free slots → B's task is ADMITTED AND PROCESSING within one poll interval. The
test proves the OUTCOME, not an implementation detail (T-ADM-A/B below).

### D4 — `A1-REPORT.md`

§1 rows with outputs · design decision + rejected alternatives · §3 gate table ·
T7 counter-prompt · findings · parks · the verdict line:
`A1: GREEN — fix <one line>, regression test <name> green, suite <baseline→now>, issue text complete`
or `A1: FAIL — <which row, with output>`.

## §3 The gate — run it, quote command + output (T2/T3)

| # | Check | How |
| --- | --- | --- |
| 1 | Exactly two new root files (D1, D4); code changes confined to the admission path + convention-mandated docs/CHANGELOG | `git status --porcelain`; `git diff --stat main` — justify every path outside `packages/agent` in the report |
| 2 | Baseline quoted before edits: npm ci + build + agent tests (row 5) | paste the three outputs (or the recorded pre-existing-failure list) |
| 3 | D3 regression test exists, is named, and is green — quote invocation + result | `npm test --workspace @aif/agent -- <test>` (or repo equivalent) |
| 4 | The test proves the outcome: quote the test's arrange/act/assert showing B-admission while A's lane is mid-pass | read-back in the report |
| 5 | Sequential semantics: the existing serial/sequential tests (find them; if none exist, write the minimal one) are green | quote |
| 6 | Full agent-package suite: same-or-better than baseline, diff enumerated | quote the summary counts |
| 7 | Every D1 anchor re-verified at YOUR HEAD, line content quoted in the report | read-back sweep |
| 8 | D1 carries: timeline (row 8), stats (row 9), ≥2 candidates with trade-offs, concrete proposal | checklist in the report |
| 9 | No factory operations in your transcript: zero docker/kill/restart/service commands (umbrella §2 floor) | self-audit line + how you verified |
| 10 | T7 counter-prompt ran; T19 cold pass over D1/D4 done | the report's T7/T19 sections |

**On any FAIL:** report it with the output and **STOP**. No fix-forward past the gate.

## §4 Out of scope — and the floors

- **No pushes, no PRs, no GitHub access attempts** (row 4: egress closed by design;
  the host harvests, the operator submits upstream).
- **No operations on the running factory** — no docker commands, no process
  management, no touching `/data/aif.sqlite` beyond optional readonly reads (row 7).
- **No rewrites beyond the admission path.** A refactor of the lane lifecycle you
  cannot justify in D4 §2 is scope theft.
- **No second-factory / infra work** (umbrella §2 — operator's separate decision).
- Operator forks → **park** (aif park/answer) and continue park-independent work.
  Never improvise around a floor.

## §5 AI traps ([.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md))

Active traps: **T2, T3, T7, T10, T12, T14, T19** + stage-local **T-ADM-A/B**.

- **T2** — designing ≠ auditing. Every §3 row is run, not described.
- **T3** — no prose-only findings. Command + output, or `file:line` with the line's content.
- **T7** — before declaring green, write and run the adversarial counter-prompt:
  «what would make this fix look working when it is not?» Actually check: the test's
  fake lane A exits instantly (so the cycle was never actually busy); the task was
  advanced to `planning` but NO lane ever processes it (advance ≠ admission); caps
  accidentally bypassed under the new path; the fix only works when the cycle happens
  to end anyway (timed luck, assert on intervals not wall-clock luck).
- **T10** — enumerate before claiming: read `processProjectLane`, the drain
  semantics, the `[FIX:149]` revalidation, the CAS claim machinery — THEN design.
  A fix designed from one function is a fail.
- **T12** — every anchor and behavior claim from the worktree at YOUR HEAD, never
  memory — including the GIVEN rows: re-verify anchors (row 10) before citing.
- **T14** — coverage bounds the verdict: ten §3 rows run and passing = green; nine = not green.
- **T19** — run your own cold pass over D1 and D4 before reporting done.
- **T-ADM-A** — the test must prove the OUTCOME (processing started mid-cycle),
  not a mechanism detail (a mock called).
- **T-ADM-B** — advance ≠ admission: a task moved to `planning` that no lane
  processes is still waiting; assert on processing start, not the status flip.

## §6 Dispatch + runtime facts (for the dispatching session, not the worker)

- **Project:** `ec817095-89ec-4959-a4c9-34327326df11` (`aif-handoff`, root
  `/home/www/aif-handoff`). Dispatch explicitly on this project — the framework
  repo's auto-dispatch hook targets the framework project (the BS2 lesson).
- **Branch naming:** aif names the worker's branch `feature/aif-admission-latency-<taskid>`.
- **Harvest:** host bundles the branch out of the container → fetches into
  `/Users/art/code/aif-handoff` (the operator's local fork clone) → pushes to
  `origin` (artyhoo/aif-handoff). The operator then decides: issue text →
  github.com/lee-to/aif-handoff/issues; branch → PR artyhoo→lee-to.
- **Queue expectation at dispatch:** the factory was mid-cycle (encyclopedia E2-E5
  lanes + foreign lanes) at authoring — this task WILL sit in backlog until the
  cycle closes. That is the documented behavior this very task exists to fix;
  do not "rescue" it with manual starts (the investigation showed they are cosmetic).
- **No preset, no profile override** — the project's default profiles resolve.
- **Pre-dispatch in-flight probe:** check the board for DONE-UNHARVESTED tasks on
  project `ec817095` before dispatch (there are none at authoring — the project is
  new); record the adjudication.

## §7 Report format

`A1-REPORT.md` at the branch root, next to D1. It must carry:

1. **§1 entry re-verification** — rows 1-7 with commands + outputs (rows 8-10:
   acknowledged as GIVEN, anchors from row 10 re-verified).
2. **Design decision** — chosen mechanism, rejected alternatives, risk notes, any
   opt-in flag and its default.
3. **§3 gate table** — ten rows, actual command + actual output each, plus the verdict line.
4. **T7 counter-prompt** — what you wrote, what you ran, what it surfaced.
5. **Findings** — anything in the admission path the maintainer should know
   (bugs you almost fixed, fragile invariants, test-infrastructure gaps).
6. **Parked questions** — the operator forks you hit and how you stated them.
