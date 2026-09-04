# Claim machinery — the two-phase dispatch around Phase -1

> **Binds:** [`SKILL.md`](../SKILL.md) §6 Step 3.
> **Spec:** [`2026-08-18-skill-stack-harmonization-design.md`](../../../../docs/superpowers/specs/2026-08-18-skill-stack-harmonization-design.md) §5.3 (D-H5, premise P-5).
> **Authoritative for:** the claim protocol's runtime contract — the three verbs, the two
> negative branches, and how a claim becomes visible to the in-flight probe.
> **NOT authoritative for:** the stage-gate merge check — [`SKILL.md`](../SKILL.md) §6 Steps 1-2;
> the verdict ladder the probe emits — [`dispatcher/SKILL.md`](../../dispatcher/SKILL.md) §2.0;
> project goal — [README.md#why-this-exists](../../../../README.md#why-this-exists).

## §1 Why the claim exists at all

The pre-dispatch in-flight probe was already mandatory, and duplicate dispatches still happened.
The reason is a timing hole, not a diligence one: **all historical collisions materialised inside
the Phase -1 window** ([CLAUDE.md `Pre-dispatch in-flight probe`](../../../../CLAUDE.md)). Session A
probes clean, opens a cold review that takes minutes; session B probes during that review, also
sees clean, and dispatches. Nothing either session did was wrong — there was simply no artefact
representing «A intends to take this stage» until A actually dispatched.

Before this stage, `dispatch()` created and unpaused the aif task in one atomic call
([`AifHandoffBackend.ts`](../../../../packages/runtime-bridge/src/AifHandoffBackend.ts) —
`claim()` then `release()`), so the first observable marker appeared only once the work was
already running. The claim moves that marker to the FRONT of the window.

A claim is deliberately **not a new status vocabulary** (premise P-5): it is an ordinary aif task
created `paused:true`. It occupies no lane, runs no agent, and costs nothing. `state.md` remains
the journal and is never the claim medium — it is gitignored per-machine runtime.

## §2 The three verbs

Framework repo paths below; a consumer install receives the same CLI at
`.claude/vendor/runtime-bridge/src/cli/claim.ts` (the `packages/` tree does not exist there).

| Verb      | When             | Effect                                                                       |
| --------- | ---------------- | ---------------------------------------------------------------------------- |
| `create`  | before Phase -1  | `POST /tasks {paused:true}` — task exists at `backlog`, visible to the probe |
| `release` | Phase -1 **GO**  | `PUT /tasks/:id {paused:false}` — the coordinator picks it up                |
| `cancel`  | Phase -1 **RED** | `DELETE /tasks/:id` — the lane is free again                                 |

```bash
CLAIM=$(npx tsx packages/runtime-bridge/src/cli/claim.ts create "<orch-home>/<slug>/kickoff.md" | jq -r .taskId)
npx tsx packages/runtime-bridge/src/cli/claim.ts release "$CLAIM"   # GO
npx tsx packages/runtime-bridge/src/cli/claim.ts cancel  "$CLAIM"   # RED
```

Resolve `<orch-home>` rather than typing it — `"$(bash "${CLAUDE_SKILL_DIR}/helpers/print-orch-home.sh" 2>/dev/null)"`, per SKILL.md §0's path convention.

`create` prints the handle as one line of JSON on stdout (narration goes to stderr), so the
taskId can be captured as above.

## §3 Failure posture — loud, never silent

`claim.ts` exits **non-zero** on every failure and never falls back to `ManualBackend`. This
deliberately breaks the exit-0 posture that
[`dispatch.ts`](../../../../packages/runtime-bridge/src/cli/dispatch.ts) holds for dispatch
outcomes, and the asymmetry is the point: `dispatch.ts` is a PostToolUse hook (injection, never
gate), whereas a claim that silently failed to be created is strictly WORSE than no claim — the
next session would probe a lane that looks clean and dispatch into it.

Since 2026-09-02 the two have **converged on one case**: `dispatch.ts` also exits non-zero (2)
when the KICKOFF itself is invalid — `spec_invalid`, today a `bridge-profile` marker naming a
runtime profile that does not exist. There the fallback was making the same mistake this section
names, one layer down: a /tmp artefact and exit 0 for a dispatch that never happened. Every
_environmental_ failure still degrades to `ManualBackend` at exit 0, so the injection contract is
untouched — and the hook discards this CLI's status regardless. A backend with no queue cannot hold a claim, so
`supportsClaims()` refuses it by name rather than pretending
([attention-is-not-a-mechanism.md §2](../../../rules/attention-is-not-a-mechanism.md)
`#hope-as-gate`).

Bridge unreachable → nothing is claimed. Run Phase -1 anyway and **record** that the stage ran
without the guard; do not report the stage as claim-protected.

`cancel` is best-effort at the backend but **reported** at the CLI: a DELETE that fails exits
non-zero and says the lane is still taken, rather than printing «lane is free» over a claim that
is still there. Best-effort must never mean unreported — otherwise the next probe blocks on a
claim the operator was told was cancelled.

`release` failure leaves the claim STANDING on purpose — the caller owns the rollback, and a
retryable network blip should not cost the queue position. Only `dispatch()` (the one-shot path)
auto-cancels, preserving its pre-split behaviour.

## §4 Orphan claims — `STALE-CLAIM`, never an eternal block

A session can die between `create` and the Phase -1 verdict. Its claim would then block the stage
forever — the starvation mode named as TD-F5 in the spec. The counter is age, surfaced rather
than enforced: [`probe-inflight.sh`](../../dispatcher/helpers/probe-inflight.sh) computes each
claim's age from the task's `createdAt` and splits the verdict:

- **`CLAIMED`** — a claim younger than the TTL. Someone is in their Phase -1 window right now.
  Do not dispatch; coordinate.
- **`STALE-CLAIM`** — a claim older than the TTL (`PROBE_CLAIM_TTL_MIN`, default 120 minutes).
  Surfaced as a loose end: verify the owning session is really gone, then `claim.ts cancel` it
  and proceed. The probe never cancels a claim itself — expiry is a decision, and an automatic
  sweep would race exactly the sessions it is meant to protect.

An unparseable or missing `createdAt` counts as **live**, not stale: the guard fails toward
blocking. The predicate is strictly-older-than, so a claim exactly at the TTL is still live, and
`PROBE_CLAIM_TTL_MIN=0` means «stale once at least a minute old», not «sweep everything».

## §5 What the probe actually matches

`probe-inflight.sh` signal 6 selects a task that is **`paused`**, **not** `done`/`verified`, and
whose title or description contains the slug. No claim marker is introduced — the task's `title`
is already the umbrella/stage slug, and inventing a marker field would be the second status
vocabulary P-5 forbids. Signals 1-5 structurally cannot see a claim: signal 5's jq filter selects
only finished tasks carrying a branch name, and a fresh claim has neither.

Consequence worth stating plainly: a **paused, unfinished task under this slug blocks the stage**,
whether or not it was created by `claim.ts`. That is the intended direction — a guard should
over-report rather than under-report.

### Recorded limits (measured, not assumed)

- **Version skew is real.** Each session runs the probe from its OWN checkout, so a session on a
  base predating this change reports `FRESH` against a live claim — measured 2026-08-18 by
  probing one worktree's claim from two sibling checkouts. The claim signal itself is
  cwd-independent (it reads the queue over HTTP, verified from three unrelated directories);
  it is the SCRIPT that must be current. Until this lands on `staging`, the guard protects only
  sessions already based on it.
- **The claim covers the aif-queue surface only.** Host branches, container branches and PRs stay
  covered by signals 1/4/2 exactly as before — unchanged by this stage. What the claim adds is
  the interval BEFORE any of those artefacts exist, which is where the collisions were.
- **Host-scoped by default.** The probe reads `http://localhost:3009`; a container-side caller
  must point `AIF_HOST` at the host or it will see an empty queue. Dispatch decisions are made
  host-side today, so this is a boundary to know, not a gap in the guard.

## §6 Proof obligation (spec §6 probe P4)

The claim signal is NOT closed by the code merge. It closes with a live RED/GREEN pair against a
running aif queue — create a paused claim, watch the probe flip off `FRESH`; delete it, watch the
probe return to `FRESH` — plus both negative branches (Phase -1 RED deletes the task; an aged
claim surfaces as `STALE-CLAIM`). Declaring it done from the diff alone is the T-SHM-A trap.
