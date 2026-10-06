# Dot gate — bounded pilot runbook (offline preparation, operator-gated)

> **Status:** preparation only, 2026-10-06. NOTHING here activates production, schedules a cron, or enables a merge — every command is an operator-invoked bounded pass; merge stays OFF (packet constraint).
> **Authoritative for:** the enrollment checklist, the one-cycle run commands, and the PROPOSED pilot caps returned for operator approval (packet item: «Enrollment + one-cycle runbook with proposed pilot caps»).
> **NOT authoritative for:** the mechanism itself ([repair record](dot-review-gate-repair-record.md), [negative matrix](dot-review-negative-matrix.md)); live acceptance (S0/S4) and staging enforcement (S5) — the known operator floors, unchanged. The caps below are PROPOSALS: they bind nothing until the operator approves them as the trusted policy's `limits`.

## 1. Proposed pilot caps (numbers for operator approval)

The packet's floors are the first two rows; the rest are the finite aggregate caps + expiry shape the packet asks to be specified. All values land in the trusted policy's `limits` block (and `maxRecoveryAttempts` is the runner/adapter constructor argument) — no defaults are invented by code.

| Cap | Proposed value | Meaning |
| --- | --- | --- |
| `max_fix_rounds_per_occurrence` | **2** | packet floor — at most 2 auto correction rounds per finding occurrence |
| `maxRecoveryAttempts` (delivery retries) | **2** | packet floor — at most 2 re-delivery attempts per stranded coordination action, then a NAMED hold (E_BUDGET) |
| `max_launches_per_window` | 4 | at most 4 dispatches per rolling window, across ALL PRs |
| `window_minutes` | 60 | the window above rolls hourly |
| `max_work_per_pr` | 4 | at most 4 dispatched items per PR per window (churn bound) |
| `coalesce_minutes` | 10 | bursts inside 10 minutes coalesce into one launch slot |
| `max_active_claims` | 1 | single corrective owner per scope (already the DR-R2 fence invariant) |
| `max_attempts_per_tuple` | 8 | review attempts per generation tuple |
| `claim_lease_minutes` | 120 | corrective-claim lease; expiry is NOT cessation (holds until revoked) |
| runner `maxHandout` | 3 | at most 3 items handed out per single `runCycle` pass |
| runner `workLeaseMinutes` | 30 | a dispatched item's work reservation lease |

**Expiry / boundedness of the pilot itself (not a policy field — a posture):**

- NO cron, NO daemon: each `runCycle` invocation is ONE bounded pass; the pilot runs it when the operator (or an operator-launched coordinator session) invokes it — the runtime never schedules itself.
- Per-PR participation is EXPLICIT: a PR enters the pilot only through a registration receipt with a recorded operator transition (`merge_enabled: true` needs the operator's own words on record); an unregistered PR holds at the runtime boundary (E_UNREGISTERED) and at arming (E_UNREGISTERED).
- Per-PR exit is EXPLICIT: the operator's release transition (registration → RELEASED) ends the pilot for that PR; a released registration authorizes nothing (E_UNREGISTERED at arming).
- Global stop persists across restarts: `gatectl pause` (durable) or a quota pause stops dispatch everywhere; `unattendedAllowed()` false disables the hand-out entirely (E_UNATTENDED_DISABLED).

## 2. Enrollment checklist (what must exist before a live cycle)

These are the known live floors restated as a checklist — none of them is buildable offline, none is provided by this packet:

1. **Trusted policy resolved:** `scripts/dot-review-gate/policy/trusted-policy.template.json` copied to the operator's trusted location with REAL pins — `schema_sha256`, `schema_v2_sha256` (sha256 of the actual V2 schema bytes), `mandatoryMechanical` contexts (context + expected_app_id + workflow_path, `bound_to`), `dot_check.expected_app_id`, the approved `limits` block from §1, and the `principals` registry: the ENROLLED executor and verifier principal ids + labels (disjoint in both — one principal cannot be its own independent closer; the template carries placeholder ids 111111/222222 that must be replaced). The registry is what the intake binds `claimed_by`/`verified_by` against and what the runner's correction routing names as the assignment owner.
2. **Destination enrollment:** live Dot route, monitor registration, native merge enforcement on staging (handoff §5 floors — unchanged).
3. **Registrations issued:** for each pilot PR, armed-state reconciled BEFORE registration; unknown armed state holds (no row → admission holds by construction).
4. **Coordination dir chosen:** the destination's real coordination directory (the CC adapter writes `_dot-gate-msg-<id>.md` / reads `_dot-gate-ack-<id>.md` there).

## 3. One-cycle runbook (per operator-invoked pass)

```bash
# 0. validate-only: policy fail-closed, pins verified against ACTUAL bytes,
#    ledger migrated, queue built — ZERO transport, ZERO model (spy-counted)
node scripts/dot-review-gate/gatectl.mjs validate \
  --policy <trusted-policy.json> \
  --schema docs/meta-factory/dot-review-result.schema.json \
  --schema-v2 docs/meta-factory/dot-review-result-v2.schema.json \
  --ledger <pilot.sqlite>
```

```bash
# 1. ONE bounded cycle: discovery → queue → registration holds → persisted
#    budget reservation → dispatch/ACK → receipt intake → findings routing →
#    recovery. The round-4 runner REQUIRES the destination adapters — without
#    them the cycle runs read-only and reports the holds:
#      resolveTarget — the ENROLLED destination per dispatch kind (session id,
#        and for corrections the executor's registry label). Without it every
#        consequential item holds E_NO_TARGET — the runner dispatches NOTHING
#        synthetic (the reviewed head launched 'dot-gate:<kind>' placeholders;
#        that class is closed).
#      discover — which PRs qualify: the real surface is the repository's open
#        non-draft staging PRs + unreviewed merged PRs (the connected suite
#        wires `gh pr list --json number,node_id,draft,headRefOid,baseRefOid`
#        shaped rows carrying repository_id/head_sha/base_sha/merge_sha). A
#        PR row WITHOUT revision identity blocks (visible, never dispatches).
#      drain — the service's real outbox consumer (createGateService().drainOutbox
#        with the publisher transport), so worker records reach the SAME journal.
node --input-type=module -e '
const { runCycle } = await import("./scripts/dot-review-gate/runner.mjs");
const { openLedger } = await import("./scripts/dot-review-gate/ledger.mjs");
const { createBudgets } = await import("./scripts/dot-review-gate/budgets.mjs");
const { createCcAdapter } = await import("./scripts/dot-review-gate/cc-adapter.mjs");
const policy = JSON.parse((await import("node:fs")).readFileSync(process.argv[1], "utf8"));
const limits = policy.limits;
const ledger = openLedger(process.argv[2]);
const report = await runCycle({
  ledger, policy,
  budgets: createBudgets({ ledger, limits }),
  adapter: createCcAdapter({ ledger, coordinationDir: process.argv[3], notify: async () => {} }),
  discover: async () => ({ openPrs: [], mergedPrs: [] }),  // pilot pass: read-only listing
  drain: async () => [],                                   // pilot pass: real drainOutbox when the service runs
  resolveTarget: async ({ kind }) => ({                    // the ENROLLED destinations — fixtures of YOUR enrollment
    "review-request": { session: process.argv[4] },
    "fix-assignment": { session: process.argv[5], owner: policy.principals.executors[0].label },
    "verify-request": { session: process.argv[6] },
  }[kind] ?? null),
});
console.log(JSON.stringify(report, null, 2));
ledger.close();
' <trusted-policy.json> <pilot.sqlite> <coordination-dir> <review-session-id> <executor-session-id> <verifier-session-id>
```

```bash
# 2. read state / recover stranded deliveries (both offline, spy-counted)
node scripts/dot-review-gate/gatectl.mjs read --ledger <pilot.sqlite>
node scripts/dot-review-gate/gatectl.mjs recover --ledger <pilot.sqlite> \
  --coordination-dir <coordination-dir>
```

- The `report` printed by step 1 is the only honest ledger of a pass: `queued` (work visible), `dispatched` (with windowId), `held` (NAMED codes: E_UNREGISTERED, E_NO_TARGET, E_REVIEW_ACTIVE, E_BUDGET, E_PAUSED, E_AUTH_EXPIRED, E_UNATTENDED_DISABLED, …), `acked`, `recovered`, `drained`, `historical` (ALREADY_FIXED dispositions — each with a durable outbox event), `routed` (issued assignment ids), `activeReviews`. Empty destination → zeros it observed, nothing invented.
- The operational gate re-checks at every consequential boundary: a pause/expiry/release landing BETWEEN the budget reservation and the delivery is an auditable NON-LAUNCHED outcome (the hold names it, the reservation row stands). Recovery is gated by the same check.
- Arming is NEVER part of a cycle. Even on a green admission, arming composes the durable journal + the ACTIVE registration + the operator enablement at the boundary (SP-4); without the recorded transition it refuses E_MERGE_DISABLED.
- Publication composes the same boundaries: open blocking lineage holds a GO publication (E_OPEN_BLOCKING); a failure publication is never held.

## 4. Explicit non-goals of this packet

- No production activation, no permanent schedule, no branch protections, no billing or merge-permission changes.
- No autonomous merge: merge authority stays with the operator transition record + the coordinator session's managed-PR policy (DotPRReviewV2); the runtime's dispatch is a coordination message, not a merge.
- No claims of production autonomy or zero billing from this offline work: the round's Dot record is ASSISTED/offline.
