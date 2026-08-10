---
name: dispatcher
description: Use when you need to EXECUTE a chosen umbrella's stages through the aif-control loop. Triggers: dispatcher, execute umbrella, run stages, aif loop, harvest PR, stage gate advance. Invoked explicitly via /dispatcher only (disable-model-invocation:true). NOT for planning — priority and launch-table are /pipeline.
arguments: [umbrella]
argument-hint: "[umbrella-name]"
disable-model-invocation: true
model: opus
allowed-tools:
  - Bash(git *)
  - Bash(gh *)
  - Bash(tsx *)
  - Bash(npx *)
  - Bash(ls *)
  - Bash(cat *)
  - Read
  - Agent
---

<!-- @dual-pair: dispatcher-skill -->
<!-- Note: CC-native and portable channels are co-resident in this single SKILL.md; the dual-implementation §5 two-file drift-check finds no counterpart file by design — drift is prevented by co-location, not grep. -->

> **Class:** C — prose-only wiring skill; mechanical enforcement = CC slash-command primitive (exists or does not). Promotion criterion: ≥2 harvest-forgotten incidents within 6 months → consider a PostToolUse hook checking done-task dedup against harvested PRs.
> **Authoritative for:** /dispatcher slash-command behaviour — §0 invocation through §6 advance; dispatch→monitor→Q&A→harvest→Phase-1→stage-gate→advance loop; Q&A park-type taxonomy; dual-channel degradation for CC-absent harnesses.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Planning, priority scoring, launch-table generation — see [.claude/skills/pipeline/SKILL.md](../pipeline/SKILL.md). Global `~/.claude/skills/orchestrator/` (agent-uncommittable, owner=maintainer).

# /dispatcher — aif-control execution loop

**Origin:** BUILD verdict 2026-06-03. R-phase patch: [docs/meta-factory/dispatcher-skill-rphase.md](../../../docs/meta-factory/dispatcher-skill-rphase.md). Complements `/pipeline` (plan) with the execution half. SSOT #111.

**Substrate:** CC slash-command + 4 existing CLI primitives (zero new npm deps, zero new code). All dispatch is session-bound (`no-paid-llm-in-ci.md §1`).

> **⚡ aif environment rule:** `/dispatcher` is the ONLY skill that works with aif. On ANY aif environment symptom — task stuck, push rejected, capacity full, missing tool in container, blocked_external, proxy error — **first action = invoke `/aif-doctor`**. Do NOT manually `docker exec` fix-by-fix. The doctor classifies the mode in one sweep and maps the right fix. Incident 2026-06-04: harvest-push fell on missing `actionlint`→`zizmor` (uninstallable); manual grinding took many turns; `/aif-doctor` would have immediately classified «container is a runtime, not a push env → land from host with full toolchain».

---

## §0 Invocation

**Slash command:** `/dispatcher [<umbrella-name>]`

`disable-model-invocation: true` — fires ONLY on explicit `/dispatcher` invocation.

**What this skill does:** EXECUTES a chosen umbrella's stages through the aif-control loop. It does NOT plan or score priority — that is `/pipeline`'s job. If no umbrella is named, list pending stages from `.claude/orchestrator-prompts/` and prompt the operator to choose one.

---

## §1 Primitives table

All 4 CLI primitives are pre-built. `/dispatcher` wires them — it does NOT build new ones.

| Primitive                            | Path                                           | Role in loop                                                                                                                                    |
| ------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `dispatch.ts`                        | `packages/runtime-bridge/src/cli/dispatch.ts`  | Send kickoff to aif via REST; exit 0 always (injection hook, never a gate); ManualBackend fallback not deduped so retry is always possible      |
| `harvest.ts`                         | `packages/runtime-bridge/src/cli/harvest.ts`   | Push aif branch from container, open PR, optionally enable auto-merge; ZERO LLM; throws on wrong-branch container (operator-ATTN case — see §4) |
| `questions.ts`                       | `packages/runtime-bridge/src/cli/questions.ts` | Read-only GET /tasks, filter to parked tasks, display park reasons; appends brainstorm nudge to output                                          |
| `answer.ts`                          | `packages/runtime-bridge/src/cli/answer.ts`    | Resolve a parked task via REST state-machine events; invalid `--decision` is an error (never silently defaults)                                 |
| `superpowers:brainstorming`          | CC companion skill                             | Autonomous technical-fork resolution on CC-present path                                                                                         |
| `superpowers:requesting-code-review` | CC companion skill                             | Phase-1 cold-review between stages                                                                                                              |

---

## §2 The execution loop

Steps run in order for each stage kickoff. After §2.7, loop back to §2.1 with the next stage kickoff, or emit "umbrella complete".

**§2.0 — Pre-dispatch guard (run before §2.1)**

```bash
SLUG="<umbrella>" bash .claude/skills/dispatcher/helpers/probe-inflight.sh
```

One command, five signals, one `VERDICT:` line. Branch on the verdict — do NOT re-run the
signals by hand, and do NOT substitute a subset. Proven by
[`packages/core/skills/dispatcher/probe-inflight.test.ts`](../../../packages/core/skills/dispatcher/probe-inflight.test.ts).

| Signal                    | Scope             | What it can see                                                             |
| ------------------------- | ----------------- | --------------------------------------------------------------------------- |
| 1 `origin-branch`         | host              | branches git already knows about                                            |
| 2 `pr`                    | origin            | PRs in any state (broad search, T-DUX-A: a lone slug-substring hit is weak) |
| 3 `done-md`               | repo              | the Layer-C3 closure marker                                                 |
| 4 `container-branch`      | **aif container** | branches that exist ONLY inside the container                               |
| 5 `task-done-unharvested` | **aif API × PRs** | finished tasks whose branch carries no PR                                   |

Signals 1-3 are the original guard, and **all three are origin/host-scoped** — which is why
they missed `feature/beta-delivery-ux-995e9c` (2026-08-08T21:22Z): run 3 had finished inside
the container an hour earlier, invisible to every one of them, and the umbrella was dispatched
twice. Signals 4-5 are that blind spot.

Verdicts, highest precedence first:

- **PROBE-INCOMPLETE** — a probe could not be _asked_ (docker down, aif API unreachable, no
  `SLUG`). **STOP and surface. Never treat as FRESH** — the whole defect class is a guard that
  renders an unasked question as a clean answer, so this outranks every other verdict.
- **DONE-UNHARVESTED** — a finished task's work is sitting un-harvested. **Harvest it (§2.4)
  or explicitly supersede it before dispatching.** Outranks ALREADY-DONE: a loose end is loose
  even under a closed umbrella. This is the `#autonomous-done-no-harvest` shape.
- **ALREADY-DONE** — `done.md` plus ≥1 other origin signal: skip dispatch → auto-write
  `done.md` + CANON sync + report (CLEAR action — **never surface as question**, T15 / P4);
  see §2.8 for schema.
- **IN-FLIGHT** — open PR, live branch, or a container-only branch: surface + let the operator
  decide.
- **FRESH** — every probe ran and found nothing: proceed to §2.1.

**Re-probe immediately before the actual dispatch**, after any Phase -1 review completes — all
historical collisions materialised inside that window ([CLAUDE.md `Pre-dispatch in-flight
probe`](../../../CLAUDE.md)).

**Base normalization (P3):** before §2.1, run `git remote set-head origin --auto` to refresh trunk ref. If kickoff's stated base diverges from live trunk, warn and use live trunk for harvest `--base` in §2.4.

**§2.1 — Dispatch**

```bash
tsx packages/runtime-bridge/src/cli/dispatch.ts \
  .claude/orchestrator-prompts/<umbrella>/kickoff.md
```

`AifHandoffBackend.dispatch()` → `POST /tasks (paused:true)` → `PUT /tasks/:id (unpause)` → aif coordinator picks up: `backlog → planning` (per-task worktree created) → `implementing`. The `exit 0` contract holds at every call-site — a ManualBackend fallback (written to `/tmp/runtime-bridge-<taskId>.md`) means aif was unreachable; retry once the blocker clears.

Emit watch-link immediately after dispatch (P6): `http://${AIF_WEB_HOST:-localhost}:${AIF_WEB_PORT:-5180}/tasks/<taskId>`. Web port (`AIF_WEB_PORT`, default `5180`) is separate from API port (`AIF_PORT`, default `3009`). If the web container is absent, emit the REST task URL instead.

**Model routing — do NOT override the runtime profile per task (operator verdict, 2026-08-09).** A
dispatch runs on the aif project's configured profiles; leave `runtimeProfileId` / `modelOverride`
(per-task fields in both the create and update schemas) unset. The top-tier profile is an **external
seat only** — an extra cold reviewer the host session spawns on top of the pipeline (`§2.5`
Phase-1 cold-review, the fidelity/compliance agents), never the in-container dispatch runtime. Tier
2 therefore selects the _criteria_ and the review depth, not a costlier executor: raising the
dispatch tier per task is a cost decision the operator has already answered «no» to. Bring the
question back only with a **new** incident of the review-blindness class (counter: 1 — a review gate
reported `total=0` on a diff a cold audit then STOPped, getff-freshness-widening S1 r2), not as a
per-stage judgement call. Tier criteria live in [`tier-home.md`](../../../packages/core/templates/shared/tier-home.md); which model fills a tier is the
aif runtime profile config's, and this line records the standing answer so each dispatch does not
re-litigate it.

**§2.2 — Monitor (single-poll-per-turn)**
Classify one poll using `monitor-classify.sh` (proven by `packages/core/skills/dispatcher/monitor.test.ts`):

```bash
TASK_JSON=$(curl -s "http://${AIF_HOST:-localhost}:${AIF_PORT:-3009}/tasks/<taskId>")
classification=$(TASK_JSON="$TASK_JSON" bash .claude/skills/dispatcher/helpers/monitor-classify.sh)
```

Branch on output prefix: `RUNNING:*` → re-invoke `/dispatcher <umbrella>` next turn. `DONE:*` → §2.4. `PARKED:*` → §2.3. `ERROR:*` → ATTN operator.
**DO NOT** use foreground `sleep <N>` — harness-blocked. **DO NOT** chain commands with `;` compound sequences — harness-blocked.
Timeout: track invocation count; after operator-configured ceiling → surface **ATTN: task stalled**. A stall is an _environment_ symptom, not a loop bug — **run [`/aif-doctor`](../aif-doctor/SKILL.md)** to triage it (distinguishes a runtime crash-loop / capacity saturation / proxy block from a slow-stale task the upstream watchdog will recover on its own). Do not re-dispatch blindly.

**§2.3 — Q&A (three types — see §3)**

**§2.4 — Harvest (after done/verified)**

**Pre-push sweep gate.** Before pushing, run the local CI-equivalent sweep on the harvested branch — the **same script** [`/harvest §3`](../harvest/SKILL.md) uses (one logic, two channels — [dual-implementation-discipline.md §7](../../rules/dual-implementation-discipline.md)):

```bash
bash scripts/run-local-ci-sweep.sh        # diff-aware; escalates to --full on unmapped paths
```

A **branch-introduced** red ⇒ HALT harvest, surface it, do NOT push (interpret against the merge-base — a red on `origin/staging` too is pre-existing, not the harvest's).

**Unattended runs:** the standing authorization for dispatching the cold auditor below, driving
the `REVISE` cycle via `answer.ts`, and pushing/opening/squash-merging to `staging` without a
confirmation round is stated once in [`night-mode/SKILL.md` delta item 8](../night-mode/SKILL.md)
— with its escalation set (`base=main`, second consecutive `REVISE`, `STOP`, parked forks) and its
honest Class-C classification. Not restated here (`#two-prompts-drift`); this section keeps owning
the mechanics.

**Pre-egress fidelity gate (design altitude — spec D2/D6).** `harvest.ts` creates the PR and
queues auto-merge inside one binary, so the fidelity seam is HERE, before invoking it.
Dispatch [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md) cold, **with an
explicit `name`** (keeps the resume exception of [cold-seat-economy.md §3](../../rules/cold-seat-economy.md)
reachable; the follow-up default is a fresh narrow seat): inputs = the
stage kickoff path + the container diff (read-only; in-container `origin/staging` is the
established §2.4/harvest-§1 inspect pattern; 3-dot tolerates a stale base):

```bash
docker exec aif-handoff-agent-1 git -C <worktree> diff origin/staging...HEAD
```

**Default format: inputs-inlined** (spec P7, [cold-seat-economy.md §3](../../rules/cold-seat-economy.md) row 4). The default dispatch payload **inlines** the kickoff scope sections + the diff into the prompt («answer without reading files») — measured at ~85k tokens / 0 tool calls vs ~177k tokens / 7 tool calls for the file-reading form (row 4 vs row 3). The file-reading form is the **fallback** when content size prohibits inlining. **Promotion trigger** (cross-stage boundary): 3 incidents of >100k-token file-reading seats → a mechanical check in **S-B's station** (S-B is the stage that owns the bottom-seat check station; not implemented here).

- `GO` → record the block (Basis/Round/Audited-SHA/Evidence) into the prepared PR body
  (pass via `--body-file` — without the section the `pr-body-fidelity` gate holds the PR
  red) and proceed to `harvest.ts`. **`Audited-SHA` = container HEAD is correct ONLY on
  this stock path**, because `harvest.ts` pushes the container commit as-is, so its SHA
  survives to become PR head. It is WRONG on the §2.4b API path, which mints a new commit
  — see the ordering note there (`pr-body-fidelity` requires `Audited-SHA` to prefix PR
  head, `packages/core/hooks/checks/pr-body-fidelity.ts:165`).
- `REVISE` → **no egress, no PR**: `tsx packages/runtime-bridge/src/cli/answer.ts --task <id> --answer "<auditor findings>" --decision request_changes` → task returns to `implementing`;
  the next harvest attempt audits as `Round: 2`. **Deliver rework ONLY via `answer.ts` — never a
  bare events-API POST.** A raw `POST /tasks/:id/events {"event":"request_changes"}` (curl) flips
  the task to `implementing` but **silently drops your findings**: the rework prompt consumes the
  LATEST human comment, and the bare event posts none, so the worker reworks blind against
  internal-review advisories and returns with zero changes. `answer.ts` posts the comment AND the
  event as one step — that is the whole reason it exists. (Incident: task `dfaf72a5`, 2026-07-25 —
  one full rework round burned; cross-model side: `.claude/skills/claude-glm-executor-handoff/SKILL.md`
  §4 — plain path, not a link: that skill does not ship, a relative link here would dangle on an
  aif-suite consumer tree.) **Cap 2 CONSECUTIVE REVISE rounds on unchanged scope**
  (spec D6 «What the cap counts» — the counter resets on any GO or scope addition; the
  Audited-SHA guard forces a re-audit after every new commit, so audits themselves are not
  what is capped): the second consecutive REVISE → STOP — do not resume; emit an escalation
  block (task id + both rounds' findings) in the report.
- `KICKOFF-AMBIGUOUS` → escalate to `/arch` §4 office hours immediately (a broken kickoff
  wastes both rework rounds). `STOP` → escalate immediately.
- Calibration window (spec D1): while merged staging PRs whose `## Review findings` contains
  `Plan spot-check:` number <5, also run a top-tier read-only spot-check of the task's plan
  (`GET /tasks/:id` → `plan`) and record it in `## Review findings`.
- Restart safety (spec D10): all rework state above lives in durable stores (aif task
  comments, PR body, git) — a fresh dispatcher session resumes by re-probing (§2.0/§2.2);
  never carry contour state only in session memory (`#state-in-session-memory`).
- <!-- seat-economy embed (spec-of: .claude/rules/cold-seat-economy.md) -->
  Seat economy ([cold-seat-economy.md](../../rules/cold-seat-economy.md)): the Audited-SHA
  guard forces a refresh after every new commit, but a commit that moves none of what the seat
  judges (deliverables / permitted files / descopes) earns only a **narrow cold delta check** —
  a fresh cold agent handed the incremental diff + kickoff scope sections + the round-1
  watch-list (resume the same auditor by name only when the watch-list cannot carry it) — not a
  full re-audit, and never a self-issued verdict. Have the round-1 seat leave that watch-list
  in the PR body / task comment. Order seats so this audit runs on the final diff.
- <!-- re-write-trigger embed (spec-of: .claude/rules/cold-seat-economy.md §3) -->
  **Re-write-trigger economy** ([cold-seat-economy.md §3](../../rules/cold-seat-economy.md)): when
  the seat has reached its natural end, the cached-prefix cost discipline applies —
  - prefer **artifact handoff** to a fresh seat over `/compact` — a fresh seat billed at read
    price on a narrow input is cheaper than re-billing the cached prefix at write price;
  - do **not** stretch a seat across the 1-hour TTL idle gap — the cached prefix expires; the
    next turn re-bills the whole prefix at write price;
  - avoid mid-session **model / effort switches** and **MCP toggles** on a fat context — each
    invalidates the cached prefix and re-bills it at write price (pending S-H P3d verification
    of the config-change class — rev 4 moved P3d there; same handoff rule applies until verified
    otherwise).

Then push:

```bash
tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --base staging
```

`harvest.ts` → `GET /tasks/:id` → **Channel A** (`docker exec … git bundle create` → `docker cp` → host `git fetch <bundle>` → host `git push origin <sha>:refs/heads/<branch>`, so `.husky/pre-push` runs — the container has no `github.com` route and is never pushed from, per [egress-no-api-bypass.md §1](../../rules/egress-no-api-bypass.md)) → `gh pr create --base staging --head <branch>` → `gh pr merge <prUrl> --auto --squash`. Emits `{ prUrl, branch, autoMerge, committed }`.

If `/dispatcher` has prepared a §1.7-compliant PR body, pass it via `--body-file <path>`. Otherwise a minimal pointer body is used (harvest warns about missing §1.7 sections in that case).

**§2.4b — Harvest when the HOST transport is dead (break-glass helper).** A container-side `github.com` block is **not** a trigger for this path any more: `harvest.ts` pushes from the host (Channel A above), so the container's missing egress is expected and harmless. Reach for the API helper **only when the host transport is ALSO dead** (host `git ls-remote origin` fails) while `api.github.com` is still reachable (discriminate via `gh api rate_limit`) — the channel of last resort per [egress-no-api-bypass.md §1](../../rules/egress-no-api-bypass.md), because it lands server-side and so **skips `.husky/pre-push` by construction**; when taken, `scripts/run-local-ci-sweep.sh` is the mandatory gate-substitute. It commits the task's declared file via the GitHub Contents API (branch ref + PUT), no `git push` needed:

```bash
bash .claude/skills/dispatcher/helpers/harvest-via-api.sh <taskId> staging [path]
# then (separate command, git-safety blocks compound merge):
gh pr merge <prUrl> --auto --squash
```

It reads the file from the container worktree (uncommitted ok), and **append-merges** onto the current `staging` version (never `git add -A`, never clobber — fixes the stale-overwrite hazard where a worker's stale full-file copy silently reverts newer rounds). Proven 2026-06-05 (PRs #427/#429/#431). Single-file; multi-file needs the Git Data API.

**Fidelity ordering on THIS path (differs from §2.4 — load-bearing).** `harvest-via-api.sh`
mints a NEW commit (blobs→tree→commit), so the container commit the cold auditor judged
never becomes PR head — and, never being pushed, CI cannot resolve it either. Running the
§2.4 audit _before_ this helper therefore yields an `Audited-SHA` the gate MUST reject
([`pr-body-fidelity.ts:165`](../../../packages/core/hooks/checks/pr-body-fidelity.ts) requires it to prefix PR head). Unlike stock `harvest.ts`, this
path **has a seam**: the helper only creates the branch commit, and `gh pr create` is a
separate command. So here the audit runs **between** them, on the pushed commit — whose SHA
IS the PR head:

1. `harvest-via-api.sh …` → note the emitted `commit=<sha>`
2. cold [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md) on kickoff-scope + that commit → `Audited-SHA: <sha>`
3. `GO` → `gh pr create --body-file <body carrying the block>`; `REVISE` → **no PR**
   (`answer.ts --decision request_changes`) — a branch with no PR releases nothing.

The D2 «pre-egress» intent is preserved in substance: the seam exists so the verdict lands
before the PR **and** auto-merge, and it still does. Pre-egress _placement_ on the stock path
is a consequence of `harvest.ts` being atomic (push+PR+merge in one binary — no seam inside),
not a rule that a branch may never exist un-audited. Incident: PR #1111 (2026-07-23) — the
gate fail-closed twice and the operator re-anchored the SHA by hand; a manual re-anchor is a
workaround, not the fix.

**§2.4c — Notification discipline for unattended runs (3-tier).** Routine ticks are SILENT (journal only). A heartbeat fires at most once per ~30min via `helpers/notify-gate.sh` (so the operator sees "alive" without per-tick spam). Only genuine human-decisions/blockers ping immediately. aif's own notifier sends a TG per status-change with no verbosity knob; to filter to **done / stalled / question only**, silence aif's raw channel (unset `TELEGRAM_BOT_TOKEN` in the container on a between-runs restart) and let the dispatcher send the filtered set via `helpers/tg-notify.sh <done|stalled|question|blocker> "<msg>"`. The operator does not go dark — they get the important events, deduped.

**§2.5 — Phase-1 cold-review**

```text
Invoke superpowers:requesting-code-review on the harvested PR diff.
```

Reviewer emits `GO` / `REVISE` / `STOP`. `REVISE` → operator fixes, re-dispatch. `STOP` → escalate. `GO` → proceed to §2.6.

**§2.6 — Stage gate**

```bash
gh pr list --search "is:merged head:<branch> base:staging" --json number,mergedAt
```

Empty → HALT (PR not yet merged; wait for CI). Non-empty → CLEAR, proceed to §2.7.

**§2.7 — Advance**
Dispatch next stage kickoff → back to §2.1. If no remaining stages → §2.8.

**§2.8 — Closure marker (P2)**
Write `done.md` schema (`# <umbrella> — DONE` / `- Final PR: #<num>` / `- Closed: <YYYY-MM-DD>` / `- Summary: <one-line>`) and CANON sync:

```bash
cp .claude/orchestrator-prompts/<umbrella>/done.md \
   ~/.claude-coordination/<repo-slug>/<umbrella>/done.md
```

Also write retroactively when §2.0 detects ALREADY-DONE but `done.md` is absent.

---

## §3 Q&A — three park types

When §2.2 detects a parked signal, identify the park type from the taxonomy table, then apply the resolution path.

### Park-type taxonomy

| Park mechanism                                       | Detected via                     | Resolved via                                             | `answer.ts --decision`         |
| ---------------------------------------------------- | -------------------------------- | -------------------------------------------------------- | ------------------------------ |
| `blockedReason` non-empty                            | `questions.ts` `isParked()`      | see fork-type below                                      | `request_changes` or `retry`   |
| `status=blocked_external`                            | `questions.ts` `isParked()`      | `answer.ts`                                              | `retry`                        |
| `manualReviewRequired:true`                          | `questions.ts` `isParked()`      | `answer.ts`                                              | `approve` or `request_changes` |
| A-park: `paused:true + OPEN_QUESTION_ANCHOR` in plan | `questions.ts` conjunction check | `answer.ts --decision resume` (PUT, bypasses events API) | `resume`                       |

Sources: `questions.ts:85-93` (detection), `answer.ts:207-212` (A-park resume).

### Routing seats (who answers which class — spec D5)

| Question class                                                     | Day                                                                                                                                                                                                | Night (unattended)                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| technical / in-scope (implementation choice within kickoff bounds) | this dispatcher session resolves autonomously (brainstorm → `answer.ts`); decision recorded in the task comment + PR `## Parked questions`                                                         | same — autonomous                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| intent / goal / design (changes WHAT to build)                     | file an ask + `ASK` when the advisor is reachable ([advisor-pattern-design §2/§5.1](../../../docs/superpowers/specs/2026-08-10-advisor-pattern-design.md)); else `/arch` §4 office hours, top seat | file an ask + `ASK` when the advisor is reachable (same ref; non-blocking — defer the item, keep working); else: a live top-tier seat exists and is sweeping → it may decide the park per the night envelope ([session-bus v2 §4](../../../docs/superpowers/specs/2026-08-09-session-bus-v2.md) + [night v3 §6 object cut](../../../docs/superpowers/specs/2026-08-09-autonomous-night-v3-design.md)); else **stay parked — never guess**; morning batch sweep (`questions.ts --project`) |
| environment (container/tooling broken)                             | `/aif-doctor`                                                                                                                                                                                      | `/aif-doctor` non-destructive arm; else stay parked                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### Type 1 — Technical fork (HOW to implement; no taste involved)

**Detected:** parked reason describes an implementation choice where either path is technically valid and does not affect project scope or direction (e.g. "which API variant", "which data structure", "retry or fail-fast on 429").

**Resolution (CC-present path):**

1. Read the parked question via `tsx packages/runtime-bridge/src/cli/questions.ts`
2. Invoke `superpowers:brainstorming` autonomously with the question as input → generates a reasoned recommendation with evidence
3. Apply via `answer.ts --task <id> --answer "<recommendation>" --decision request_changes` (B-park) OR `--decision resume` (A-park)
4. Report what was decided and why — operator sees the outcome, not a question

**Discrimination discipline (baked into this skill prose because `ask-question-reminder.sh` is operator-internal, not in the `install.sh` payload — per `ask-question-reminder.sh:2`):** a fork is TECHNICAL when the parked reason is about mechanics, implementation detail, or tradeoff within a single subsystem. A fork is STRATEGIC when it involves scope, architecture decisions, project direction, or "whether" to do something at all. When in doubt, surface to operator (Type 2 path).

### Type 2 — Strategic fork (WHAT/WHETHER; maintainer decides)

**Detected:** parked reason involves scope, architecture, project-wide policy, or project direction — the operator must decide.

**Resolution:**

1. `tsx packages/runtime-bridge/src/cli/questions.ts` → surface parked task to operator
2. Operator reviews, optionally invokes `superpowers:brainstorming` for deliberation
3. Operator provides answer; `/dispatcher` applies: `tsx packages/runtime-bridge/src/cli/answer.ts --task <id> --answer "<decision>" --decision request_changes` (B-park) OR `--decision resume` (A-park)
4. Loop resumes

### Type 3 — Terminal (no Q&A needed)

**Detected:** `status=done` or `status=verified` without a parked signal. Proceed directly to §2.4 harvest.

### CC-absent degradation (portable fallback)

**Capability-check (not brand-name detection per `dual-implementation-discipline.md §4`):** probe whether the `superpowers:brainstorming` Skill-tool is reachable in the current harness (attempt invocation with a sentinel probe, or check `CLAUDE_SKILL_DIR` environment + skill discovery). Do NOT branch on harness name strings like `"claude"` or `"cc"`.

If the brainstorming companion is unreachable (Cursor / Aider / Codex / no Superpowers installed): **technical forks degrade to Type 2 behaviour** — surface to operator rather than resolving autonomously. The portable markdown of this skill provides the same discrimination discipline; the autonomous resolution step is skipped. This is the CC-absent path by necessity, not a stub.

---

## §4 Harvest details and ATTN conditions

**Rework-commit gap:** a dirty container tree at harvest time is auto-committed ONLY when the branch is **0 commits ahead** of base — the true-rework signature (`request_changes→implementing→done` with nothing committed, branch == base HEAD). Even that leg first HOLDs as ambiguous (`needsConfirm`, false-done guard); re-running with `--confirm-rework` produces the templated `git add -A` commit (ZERO LLM, `committed: true` in the harvest JSON). When the branch is **≥1 commit ahead**, harvest treats the dirty tree as stale base-state residue and never `add -A`s it: modified tracked files HOLD (`needsResidueConfirm`; `--confirm-dirty-residue` to proceed), while untracked-only residue is warned and left behind (`dirtyTreeLeftBehind: true`) — uncommitted work on such a branch is NOT shipped. **Operator rule: before harvesting a branch that already carries commits, commit any in-container work you want shipped.** (Decision logic: `packages/runtime-bridge/src/harvest.ts` `harvestTask` dirty-tree branch; near-loss incident 2026-08-08, getff-freshness-widening S1.)

**ATTN: container on wrong branch.** `harvest.ts` throws (does NOT self-heal) when the aif container's git state is on a different branch than the task's `branchName`. When this occurs, `/dispatcher` surfaces `ATTN: harvest threw — container may be on wrong branch. Manual check required: docker exec aif-handoff-agent-1 git branch` and does NOT silently retry. The operator must resolve the container state before re-running harvest.

**Harvest idempotency:** `gh pr create` fails if the PR already exists; re-run with `--no-auto-merge` to skip the merge step and recover gracefully.

**ATTN: environment-level failure (not a loop bug).** When dispatch/monitor/harvest misbehaves for a reason outside this loop's logic — task crash-loops in `planning` with `tokenTotal:0` (broken claude runtime), new task stuck `backlog` (capacity cap saturated), in-container `npm`/network failures (proxy block) — that is an aif _environment_ fault. **Hand off to [`/aif-doctor`](../aif-doctor/SKILL.md)** for read-only triage + the mapped fix (each mutation gated on operator GO). `/dispatcher` owns the loop; `/aif-doctor` owns the environment the loop runs in.

---

## §5 Anti-scope

- **Does NOT plan** — priority scoring, launch-table generation, plan-currency check = `/pipeline`'s job. `/dispatcher` only executes a named umbrella.
- **Does NOT build new CLI primitives** — wires the 4 existing ones in `packages/runtime-bridge/src/cli/`. A genuinely-needed new primitive = surface as a finding to maintainer, do not add it here.
- **Does NOT edit `~/.claude/skills/orchestrator/`** — global skill, agent-uncommittable; maintainer-owned.
- **Does NOT add npm deps** — zero new dependencies; `tsx` runs existing TypeScript.

---

## Seat lifecycle

Registry-role seat sessions (birth · work · self-cleaning · retirement) follow ONE protocol —
[.claude/rules/seat-lifecycle.md](../../rules/seat-lifecycle.md) (SLP): each phase binds a
settled owner (ADR D6/D7/D8, session-bus v2, night-mode); bus-touching steps are
Part-II-gated. Never restate it here (`#fifth-description-of-the-loop`).

## Without this skill

The operator manually tracked task IDs, polled `GET /tasks/:id` in a shell loop, forgot to run `harvest.ts` after `done` status (the most-skipped step), copy-pasted `gh pr create` commands with wrong `--base` args, ran `superpowers:requesting-code-review` only sometimes, and manually checked whether the PR merged before dispatching the next stage. Each stage required 6–10 manual steps with no enforcement that all happened in the right order.

## With this skill

`/dispatcher <umbrella>` drives the full dispatch→monitor→Q&A→harvest→cold-review→gate→advance loop. Technical forks are resolved autonomously via `superpowers:brainstorming` (on CC) and reported; strategic forks surface a single question to the operator. The harvest step (push + PR + auto-merge) fires automatically on `done` status — the forgotten step is no longer forgettable. The operator's attention is needed only for genuine strategic decisions.

---

## §6 §1.7 self-reflexive note

**Stage 1 (dispatcher-ux):** `monitor-classify.sh` REUSES `priority-score.sh` Layer-C3 completion-detection pattern (BFR verdict REUSE, `build-first-reuse-default.md:3`; same problem class confirmed — task-status classification vs umbrella-completion classification). Tests at `packages/core/skills/dispatcher/monitor.test.ts:1`. Original BUILD-verdict forward/backward checks at `docs/meta-factory/dispatcher-skill-rphase.md`.

**Stage 2 (dispatcher-ux-s2):** P2 (`§2.8` closure-marker schema + CANON sync, `CLAUDE.md:umbrella-closure`), P3 (base-normalization note in `§2.0`, `parallel-subwave-isolation.md:1`), P4 (self-application — ALREADY-DONE writes done.md without surfacing question, `recommendation-laziness-discipline.md:3`), P6 (watch-link `§2.1`, `packages/core/skills/dispatcher/dispatch.test.ts:1`). No new CLI primitives, no npm deps.
