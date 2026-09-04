# heal-honest-capacity — kickoff

<!-- bridge-profile: Z.AI GLM-5.2 SDK -->

> **Type:** I-phase — one mechanically-scoped bug fix with paired-negative tests.
> **Origin:** finding F1 of `docs/meta-factory/research-patches/2026-07-24-autonomous-loop-diagnostics.md` (merged, #1129). Measured live on 2026-07-24; the evidence is quoted in §1.
> **Deliverable:** one PR against `staging` — the fix, its paired tests, any twin the generator produces.
> **Base branch:** staging.

## §0 Cold-start context — self-contained, read only this

**What this repo's autonomous loop does.** An orchestrator session dispatches work to the
aif-handoff runtime, which runs each task in its own **linked git worktree** inside a container.
Before every dispatch, `packages/runtime-bridge/src/cli/dispatch.ts` runs an optional preflight
(`runPreflight`, gated on the `RUNTIME_BRIDGE_PREFLIGHT` env var) whose documented purpose is
"the dispatcher calls the doctor; the doctor heals". The doctor's heal entrypoint is
`.claude/skills/aif-doctor/helpers/heal.sh`.

**What healing means today.** `heal.sh` performs the Tier-1 reversible base refresh: it brings the
container's `staging` checkout up to the live tip, so a newly-created task worktree branches off
current code instead of stale code. A stale base is the documented #1 cause of false-`done` worker
output.

**The safety interlock.** Refreshing the base mutates the container's shared checkout, so
`heal.sh` applies it **only when no task is in flight**. That interlock is the subject of this task.

## §1 The defect and its measured cause

**`heal.sh` asks a source that lies.** It reads `activeTaskCount` from the runtime's
`/agent/status` endpoint:

```bash
# .claude/skills/aif-doctor/helpers/heal.sh:5-13 (shipped copy)
STATUS_JSON="$(curl -s -m5 "$AIF_URL/agent/status" 2>/dev/null || echo '')"
ACTIVE="$(printf '%s' "$STATUS_JSON" | jq -r '.activeTaskCount // 0' 2>/dev/null || echo 0)"
# (a jq-absent fallback parses the same field with grep -oE)
ACTIVE="${ACTIVE:-0}"
if [ "$ACTIVE" != "0" ]; then   # ← the interlock
```

Measured on the operator's live runtime, 2026-07-24, with work genuinely in progress:

| source | says |
|---|---|
| `curl -s localhost:3009/agent/status \| jq '.activeTaskCount'` | **0** |
| `docker logs aif-handoff-agent-1 --tail 300 \| grep '"active"'` | `{"active":2,"limit":3}` |
| `curl -s localhost:3009/tasks \| jq '[.[]\|select(.status!="done")]\|length'` | **4** |

So the interlock reads `0`, concludes "nothing in flight", and proceeds to refresh the base —
**potentially replacing the tree a worker is building against, mid-task**. The failure is silent and
its damage (a worker's work built on a tree that moved under it) surfaces later as unexplained
garbage, exactly the class of failure the base refresh exists to prevent.

**Why this is not hypothetical:** the preflight is automatic. Any dispatch, from any session, runs
it. The operator-side session on 2026-07-24 declined to refresh the base by hand precisely because a
task was mid-flight; the automatic path would not have hesitated.

## §2 Scope — the fix

**The «how» in one sentence:** replace the `activeTaskCount` read with an in-flight scan of the task
list, and treat an unreadable source as "busy" rather than "idle".

**Binding: the honest source is `GET $AIF_URL/tasks`.** Do not shell out to `docker logs` — the
coordinator log is honest but unavailable to a consumer who has no docker access, and `heal.sh` is a
**shipped** artefact (`.claude/skills/aif-doctor/helpers/`) that must degrade gracefully anywhere.
The `/tasks` endpoint is already the channel `packages/runtime-bridge/src/cli/questions.ts` and
`answer.ts` use, so this is reuse of an established path, not a new dependency.

**In-flight statuses (binding):** a task counts as in flight when its `status` is any of
`planning`, `implementing`, `review`. Rationale, stated so you do not have to guess:

- `backlog` — not yet assigned a worktree; nothing to disturb.
- `plan_ready` **with `paused: true`** — parked; the documented zombie shape. Not in flight.
- `plan_ready` **without** `paused` — advances on its own, so a refresh could still land underneath
  it. **Count it as in flight** (fail safe).
- `done`, `verified`, `cancelled` — terminal.

**Fail-closed requirement (binding).** If `/tasks` is unreachable, returns non-JSON, or cannot be
parsed, `heal.sh` MUST treat the runtime as **busy** and skip the refresh with a clear message. The
current code's `|| echo 0` idiom does the opposite — an unreachable endpoint reads as "idle", which
is the most dangerous possible default for a mutation interlock. Preserve the existing behaviour
that a preflight failure never blocks the dispatch itself (`runPreflight` warns and proceeds);
skipping the *heal* is not the same as failing the *dispatch*.

**Keep:** the `jq`-absent fallback path (this file deliberately works without `jq` — see the
existing `grep -oE` branch), the `SCRIPT_DIR`-relative resolution of the refresh helper, and the
graceful "no container" skip.

| file | what changes |
|---|---|
| `.claude/skills/aif-doctor/helpers/heal.sh` | the interlock (~10-20 lines) |
| `.claude/skills/aif-doctor/SKILL.md` | any prose describing the interlock as an `activeTaskCount` check — correct it, or state explicitly that no such prose exists |
| a test under `tests/aif-doctor/` | paired negatives (§3) |

**Out of scope** (report, do not fix): `/agent/status` itself (it belongs to the upstream
`lee-to/aif-handoff` repo — do NOT touch it), the refresh helper it calls, the dispatcher preflight
wiring, and the two parked zombie tasks.

## §3 Acceptance criteria

Each must be demonstrated by a **test that fails without your fix** — run the suite with the fix
(GREEN), revert only `heal.sh`, run again (RED), and paste both outputs. A criterion whose test
stays green after the revert has not been tested.

There is an existing fixture-test pattern to follow: `tests/aif-doctor/refresh-aif-base.test.sh`
drives its subject against a throwaway local git repo using stubs in `tests/aif-doctor/stubs/`.
Reuse that shape — a `curl` stub serving canned JSON is the natural analogue.

1. **In-flight blocks the heal.** `/tasks` contains a task with `status: "implementing"` → `heal.sh`
   does NOT invoke the refresh helper, and says why.
2. **Lying `activeTaskCount` does not fool it.** `/agent/status` reports `activeTaskCount: 0` **and**
   `/tasks` contains an `implementing` task → still blocked. This is the regression that motivated
   the task; it must fail against the pre-fix code.
3. **Idle allows the heal.** `/tasks` holds only `done` / `verified` / paused-`plan_ready` tasks →
   the refresh helper IS invoked.
4. **Un-paused `plan_ready` counts as in flight** → blocked.
5. **Unreachable `/tasks` fails closed** → blocked, with a message naming the reason. Not "idle".
6. **Malformed response fails closed** → non-JSON body → blocked.
7. **No-`jq` path preserved** → with `jq` absent from `PATH`, criteria 1 and 3 still behave
   correctly.
8. **Suite green**, and the existing `tests/aif-doctor/refresh-aif-base.test.sh` still passes.

## §4 Constraints (binding)

- **Base `staging`.** One PR, one concern.
- **No `--no-verify`, no gate bypass.** If a pre-commit or pre-push gate rejects you, fix what it
  names and retry. A gate that stops you is the product working.
- **Do not touch the upstream runtime.** `/agent/status` is not ours to fix; work around it.
- **PR body needs `### §1.7 Forward-check applied` and `### §1.7 Backward-check applied`** (H3
  verbatim), each ≥40 non-whitespace characters and each citing at least one real `file.ext:line`
  whose content actually says what you claim it says. The backward-check must enumerate the sibling
  surfaces of this change-class — **other places that decide whether it is safe to mutate shared
  state, and other readers of `activeTaskCount`** — with a verdict per surface. A backward-check
  that only restates this PR is non-conformant (T21, §5).
- **Commit trailer:** `Prior-art: skipped — bug fix to an existing safety interlock, no new capability`.
- **Park, don't guess.** If an acceptance criterion proves unreachable, stop and say so with the
  command output that blocked you. Do not invent a weaker criterion and declare it met.

## §5 AI-traps active (per `.claude/rules/ai-laziness-traps.md` §2 and §3)

**Active canonical traps: T2, T3, T14, T15, T19, T21.**

- **T2 — designing ≠ running.** "Reading /tasks would fix this" is not a deliverable. Run the suite, paste the output, including the RED-before-GREEN revert run.
- **T3 — no prose-only findings.** Every claim carries a command + its output, or a `file:line` with the line's actual content.
- **T14 — clean ≠ covered.** A check that passes because it never executed is "coverage insufficient", not "pass".
- **T15 — self-application.** This fix guards an automatic mutation of shared state. State explicitly whether your own test fixtures mutate shared state, and what protects them.
- **T19 — own cold-QA before handoff.** CI green is not a design review.
- **T21 — the backward-check sweeps siblings, it does not restate the PR.** See §4.

**Domain-specific trap — T-HEAL-A «the environment where the bug lives is not the one you can reach».**
The defect only manifests when the runtime is genuinely busy, which you cannot arrange from inside a
task worktree. The tempting move is to test against the live runtime and report whatever it happens
to say — that samples one accidental state, and a green result may mean only that nothing was
running. Drive the decision logic through **stubbed** responses so every state is exercised
deterministically, and never treat a live observation as a substitute for criterion 2.
This trap has a precedent: a sibling task in this umbrella shipped a suite that reported 5/5 PASS
in the container and 0/5 on the operator host, because the container lacked a binary the stubs were
shadowing. **Verify your suite behaves identically on a host that HAS `curl`, `jq`, and `docker`
available** — do not let an absent binary silently make your stub the only implementation.

**Domain-specific trap — T-HEAL-B «fail-open feels harmless».**
The existing code uses `|| echo 0` and `${ACTIVE:-0}` — idioms that turn every error into "idle".
When you rewrite the interlock, the same idioms will feel natural and will silently re-introduce the
defect in a new place: an unreachable endpoint would again read as "safe to mutate". Every default
in the new logic must resolve toward **busy**. Grep your own diff for `:-0`, `|| echo 0`, and
`|| true` before handing off, and justify each survivor.

## §6 Report — what to hand back

1. The PR number and branch.
2. The acceptance table: criterion → command → verbatim output → PASS/FAIL, all 8 rows, with the RED-before-GREEN evidence.
3. The T-HEAL-B audit: every fail-open idiom in your diff, and why each is safe.
4. The backward-check enumeration: every other reader of `activeTaskCount` and every other
   safe-to-mutate decision you found, with `file:line` and a verdict.
5. **Field note (report only, not part of the PR):** you are running inside a container task
   worktree. Record verbatim any hook output you saw while working — skip notices, violation
   messages, silence. If you saw nothing, write `NOTHING APPEARED` rather than inferring.
6. Anything you could not verify, named as such.

```bash host-verify
# Retro-marked 2026-08-21: the fixture suite §3 demands plus criterion 8 (both files shipped with the fix)
bash tests/aif-doctor/heal.test.sh
bash tests/aif-doctor/refresh-aif-base.test.sh
```
