---
name: aif-doctor
description: "Use when the aif-handoff runtime is misbehaving — a task is stuck or crash-looping, new tasks stay backlog at capacity, the claude runtime is broken. Triggers: aif-doctor, aif health, task stuck, задача висит, runtime broken, рантайм сломан, aif не отвечает, capacity skipping, native binary not installed, why won't my task start. Invokable when the dispatcher is NOT running. NOT for running the dispatch loop (/dispatcher) or planning (/pipeline)."
arguments: []
disable-model-invocation: false
model: opus
allowed-tools:
  - Bash(curl *)
  - Bash(docker *)
  - Bash(git *)
  - Bash(bash *)
  - Bash(ls *)
  - Bash(cat *)
  - Bash(grep *)
  - Bash(date *) # GH #1581: age-threshold arithmetic for the -t --tail log windows (§3.7/§3.8)
  - Bash(awk *) # GH #1581: age cut on docker logs -t timestamps (§3.7/§3.8)
  - Read
---

<!-- @harness-posture: cc-only — deliberate: operator-internal diagnostic runbook, slash-command auto-invocation is CC-native, markdown content readable anywhere (matches the adjacent @cc-only-rationale) -->
<!-- @cc-only-rationale: operator-internal diagnostic runbook for the maintainer's local aif-handoff stack; the markdown content is harness-agnostic (any session can read it), only the slash-command auto-invocation is CC-native. No portable counterpart to keep in sync → §6 dual-implementation-discipline.md marker is @cc-only, not @dual-pair. -->

# /aif-doctor — operational health triage

> **Class:** C — runbook over existing helpers and observed endpoint/log evidence.
> **Authoritative for:** passive diagnosis, mapped repairs and the two-tier mutation contract.
> **NOT authoritative for:** project goal, dispatcher execution or pipeline planning.

Input: a runtime symptom outside a normal dispatcher run. Result: classified evidence, mapped fix,
reversibility and verified post-fix delta, or an honest unknown/blocked diagnosis.

## Workflow

1. Before the passive sweep, read [inventory and triage](references/inventory-and-triage.md).
   Use health/status, container state/logs and base currency probes. Read error-level agent logs even
   when heartbeats are green. Resolve the real container/context with the existing target helper;
   multiple/absent targets stop rather than picking one by name.
2. For the observed signature, read the corresponding §3 mode in
   [failure catalogue](references/failure-catalogue.md) **before diagnosis or repair**. Match detectors,
   not task names. No match + healthy bridge → collect a fresh symptom, do not invent a mode.
3. Before any repair, read [mutation tiers](references/mutation-tiers.md), quote exact command,
   evidence and undo, then apply the tier below. Re-run the matching probe and report the delta.
4. For scope questions or catalogue/provenance updates, read [scope and evidence](references/scope-and-evidence.md).
   Catalogue growth requires observed incidence; historical benches are not proof of today's stack.

## Authorization and stop conditions

- The default sweep is passive. `verify-bridge.sh` creates/deletes a real task and may briefly start
  a coordinator; `ensure-parallel.ts` can persist `parallelEnabled` by full project PUT. Both are
  outside the sweep and need exact Tier-2 authorization before execution.
- Tier 1: reversible in-container git-config heal, runtime install/mirror, image rebuild or retry
  auto-applies with `APPLIED (reversible)`, evidence and undo. Respect existing session scope.
- Tier 2: destructive task deletion, standing config changes, paid transport/profile changes or
  active smoke wait for operator GO unless that exact action is already explicitly authorized.
  Print `MUTATION (needs GO)`, evidence and reversibility; no blanket approval loops for Tier 1.
- Never blind DELETE: confirm `implementationLog:false` **and** verified/merged sibling umbrella.
  Leave slow-stale recovery to the upstream watchdog; fresh heartbeat does not prove progress.
- Capacity comes from the coordinator log, not an intended env value. Paused slot accounting is an
  upstream implementation question: do not certify free lanes from the paused flag alone.
- Registry timeout does not prove tunnel death. Run the github/mirror discriminator before declaring
  whole-tunnel failure; a host-selective registry block can use the mapped mirror without VPN changes.
  Host proxy surgery is operator work. Paid paths are DEFER absent explicit authorization.
- No new dependency/probe script, unrelated skill edits, unverified fix or synthetic green.

## Without this skill

The operator re-derives aif operational knowledge every session: which port the API is on, what `claude --version` should print, whether a stuck `planning` task is a crash-loop or a slow-stale one the watchdog will recover, whether `backlog` means a cap hit or a dispatch failure, and which of rebuild / in-container-install / API-transport / cap-bump / DELETE actually applies. Each diagnosis is improvised under pressure, mutations get attempted without checking reversibility (e.g. blind-`DELETE`-ing a slot-holder), and the host-proxy block gets mistaken for an aif bug and «fixed» in the wrong layer.

## With this skill

`/aif-doctor` runs the $0 read-only sweep, classifies the failure against the empirically-grounded §3 catalogue, and prints the one mapped fix with its evidence and reversibility — in seconds, without re-derivation. It distinguishes the watchdog-recoverable cases (leave them) from the three modes the watchdog cannot see (act on them), refuses to speculate beyond observed modes, and gates every destructive, spending, or standing-config fix behind an explicit operator GO while the Tier-1 reversible in-container fixes auto-apply with a log. The host-proxy block is named and handed back to the operator instead of being chased in the wrong layer.

---
