# aif-doctor — mutation tiers

> **Authoritative for:** the selected aif-doctor procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

## §4 Mutation discipline (the Q2 contract)

Mutations are split into two tiers by reversibility:

### Tier 1 — Reversible config (auto-apply, no GO needed)

Fixes that change only in-container state (config, image, or retry state) with zero data loss:

- `git config --global url.https.insteadOf` — reversible (`git config --global --unset`)
- `git config --global credential.helper` — reversible (`git config --global --unset`)
- `npm i -g @anthropic-ai/claude-code [--registry=…]` — in-place; superseded by next rebuild
- `docker compose build agent && docker compose up -d agent` (Fix A) — additive; the OAuth credential volume + `env_file` survive (§ topology); the `up -d` restart does interrupt in-flight tasks — an accepted availability cut, not a data risk (nothing to restore; same interruption the Tier-2 cap bump carries, which needs GO for its standing-config change, not for the restart)
- `answer.ts --decision retry` — retries a blocked task; no records deleted

For Tier 1, the skill **applies the fix automatically** and logs:

```text
APPLIED (reversible): <exact command>
  Evidence: <file:line | log line | probe output>
  Reversibility: <how to undo>
```

Then continues without pausing for GO.

### Tier 2 — Destructive or system-disruptive (GO required)

Fixes where the Tier-1 test (immediate reversibility, zero data risk) does not hold — records destroyed, standing configuration changed, or money spent (an in-flight-task interruption alone is not the gate: Fix A's Tier-1 restart carries the same one):

- `DELETE /tasks/:id` — task record gone, irreversible
- Cap bump (`COORDINATOR_MAX_CONCURRENT_TASKS_PER_PROJECT` + `docker compose up -d agent`) — standing configuration change (the GO reason — D-B floor list); the paired `up -d` restart also interrupts in-flight tasks, as Fix A's Tier-1 restart does
- Active dispatch smoke (`verify-bridge.sh`) — real task creation/deletion and possible coordinator execution
- Parallel flag repair (`ensure-parallel.ts`) — persisted project configuration, even though it is a no-op when already enabled
- Transport switch to API (Fix C) — paid path, requires explicit authorization

For Tier 2, the skill prints and **stops**:

```text
MUTATION (needs GO): <exact command>
  Evidence: <file:line | log line | probe output>
  Reversibility: <how to undo, or "DESTRUCTIVE — task record gone">
  Awaiting operator GO.
```

Read-only fixes (re-running a probe) run freely. This split was introduced 2026-06-04 after the session-2 triage: SSH→HTTPS `insteadOf` + `retry` (both Tier 1) required two GO round-trips that added no safety value — the reversibility is immediate and the data risk is zero. Extended 2026-10-04 (plain-words-recap-v2 D5c): the reversible in-container runtime fixes — image rebuild (Fix A), in-container install (Fix B), mirror install (Fix D) — moved from GO-gated to Tier 1 by the same test (reversibility immediate, zero data risk); GO stays on the destructive (DELETE), spending (Fix C paid transport, §3.9 profile/transport switch), and standing-config (cap bump) mutations.

---
