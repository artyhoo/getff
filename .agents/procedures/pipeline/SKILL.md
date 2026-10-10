---
name: pipeline
description: 'Use when you have ≥2 in-flight wave umbrellas with cross-stage dependencies, suspect drift between wave-sequencing-plan.md and live git reality, or need to dispatch the next wave with verified Stage N→N+1 gates. Triggers: pipeline, wave orchestrator, wave plan, stage-gate, umbrella priority, waves parallel/sequential, wave-sequencing-plan drift. Invocation channel: explicit /pipeline only — disable-model-invocation:true is a channel flag and not a permission (§0).'
arguments: [umbrella]
argument-hint: '[umbrella-name]'
disable-model-invocation: true
model: opus
allowed-tools:
  - Bash(git *)
  - Bash(gh *)
  - Bash(ls *)
  - Bash(cat *)
  - Bash(bash .agents/procedures/pipeline/helpers/*.sh *)
  - Read
  - Write
  - Edit
  - Agent
---

<!-- @harness-posture: cc-native-with-fallback — CC slash-command/!shell/Write/Agent primitives; helpers are plain bash with resolved <orch-home> paths (references/invocation.md §0) -->

# /pipeline — plan, gate and route waves

> **Authoritative for:** pipeline orchestration, its conditional procedures and output contract.
> **NOT authoritative for:** project goal, strategy ownership or execution of worker stages.

Inputs: an optional umbrella name, integer N, `list`, or `status`. Result: verified plan state,
ranked candidates and a gated launch/handoff; `status` is read-only.

> **Invocation-channel flag, not a permission.** `disable-model-invocation: true` keeps a skill out of auto-load and out of subagent preload, and stops the Skill tool from invoking it — an explicit `/<name>` from the operator is its only invocation channel, so an agent never self-initiates the procedure. It does **not** seal the file: an agent already asked to do this work may read the SKILL.md and execute its documented steps, and doing so is correct behaviour, not a workaround. On ZCode the flag is not runtime-enforced (absent from the runtime, survey #1699 §5): there the explicit-only channel discipline is prompt-level — this blockquote is the gate, so an agent on ZCode must still treat an explicit /<name> as the only self-initiation channel. <!-- canonical: invocation-channel-flag -->

`allowed-tools` is pre-approval, not command exclusion. Host permissions still govern commands;
report a blocked required check and use an authorized alternative or obtain command approval.
This procedure requires no global permission changes.

## Workflow and conditional reads

1. Before argument routing, read [invocation](references/invocation.md): empty → overview,
   integer → top-N (0 → overview), `list` → presets, `status` → status, else → named umbrella.
   Apply the integer-name collision guard before dispatch. For `list`, stop after enumeration.
2. For `status`, read [status](references/status.md) before rendering; perform no writes or dispatch.
3. For overview/top-N or a named umbrella, read [planning](references/planning.md) before checking
   currency, priority, dedup/classification and routing. Wait for each background helper's own
   END trailer or task-notification before interpreting output; header-only means still running.
   Live git/PR evidence overrides REPORT and cache. Reconcile verified factual drift automatically
   and re-check; F1 halts dependent decisions only while drift remains unresolved.
   Missing plan → write a stub, present it and halt until confirmed. A strategy tie goes to an advisor ask or the maintainer; at night stay parked.
4. Before emitting a launch table or writing a meta-kickoff, read [launch](references/launch.md).
   Verify actual destination inputs and publish factory kickoffs to staging before dispatch.
5. Before dispatch/review/transition, read [dispatch](references/dispatch.md) and apply its channel
   rules, claim-before-review, GO/release or RED/cancel, in-flight and real merge gates. Never launch
   Stage N+1 until required Stage N PRs are actually merged. An unreachable bridge is recorded as
   unguarded; it never silently claims a lane. Release/cancel every claim after its verdict.
6. Before completing any planning/dispatch invocation, read [artifacts](references/artifacts.md)
   and the [output grammar](references/output-format.md); update cache and report failures honestly.
   For failure classification read the matching entry in [failures](references/failures.md).
   For a scope/ownership fork, read [scope](references/scope.md) before proposing a change.

## Live cache probe

Run for the plan-currency check; the cache remains supplementary and requires live reconciliation.

```bash
head -200 "$(bash ".agents/procedures/pipeline/helpers/print-orch-home.sh" 2>/dev/null)/_plan-cache.md" 2>/dev/null || echo "(no cache — fresh session; will be created by helpers/update-cache.sh on this invocation's exit)"; for f in $(ls -t "$(bash ".agents/procedures/pipeline/helpers/print-orch-home.sh" 2>/dev/null)"/_residue-*.md 2>/dev/null | head -3); do echo "--- PreCompact residue (S2b/D8): a session compacted here. POINTER only — re-verify before acting on it: $f"; head -40 "$f"; done; for f in $(ls -t "$(bash ".agents/procedures/pipeline/helpers/print-orch-home.sh" 2>/dev/null)"/_handoff-*.md 2>/dev/null | head -3); do echo "--- Model handoff (D15/D28): the model-authored CURRENT-STATE file of a compacted session — the SessionStart injector's payload. POINTER only — re-verify before acting on it: $f"; head -40 "$f"; done
```

## §10 Output artifacts

The report contains `## Dependency graph` with `↓` inter-stage edges, `## Action queue` with
`Paste into a new CC tab` and `Can parallel with` columns, then one `### Stage` block per stage.
Use the complete grammar and mode examples in [output-format](references/output-format.md).

**Dispatch chips:** only when `spawn_task` is invocable. Before emission read output-format §9/§9A.
Every inspectable chip prompt carries `Isolation first` → `In-flight probe` →
`Stage-gate at click time` → cwd + kickoff path. Preserve paste tabs and the bridge-backed autonomous
offer alongside chips, and the launch card letting the operator choose. Apply §9 Channel order:
try aif auto-dispatch first; chip exceptions require `chip-over-bridge:` evidence.

## Boundaries

Do not execute umbrella write workers through Agent from this planning session. The operator opens
a fresh session or selects the authorized aif channel; read-only research/review is the allowed
Agent use. Do not change another skill's artifacts, invent strategy, silently relax gates or
infer completion from provenance PRs. Installed-consumer paths are resolved through existing helpers.

## Seat lifecycle

Registry-role seat sessions (birth · work · self-cleaning · retirement) follow ONE protocol —
[.claude/rules/seat-lifecycle.md](../../rules/seat-lifecycle.md) (SLP): each phase binds a
settled owner (ADR D6/D7/D8, session-bus v2, night-mode); bus-touching steps are
Part-II-gated. Never restate it here (`#fifth-description-of-the-loop`).

## With this skill

`/pipeline` provides a single slash-command entry point that:

1. **Verifies plan currency** — compares `wave-sequencing-plan.md` claims to live `gh pr list` output; surfaces DRIFT items before any dispatch.
2. **Scores cross-umbrella priority** — multi-criteria scoring (blocks-other-waves × 3, give-back-value × 2, size-fit × 1, maintainer-prefs × 2) with a structured ranked list.
3. **Generates a launch-table** — auto-detected sub-waves with Mode A/B/SDD/Queue decisions, Stage, Parallel-sibling, Volume columns; written to a meta-kickoff file.
4. **Enforces stage gates** — real `gh pr list --search "is:merged head:<branch> base:staging"` checks before each stage transition; HALT on unmerged dependencies.

## Without this skill

Without `/pipeline`, multi-wave umbrella orchestration relies on:

- **Manual plan-currency check:** the orchestrator must manually scan `wave-sequencing-plan.md`, compare to `gh pr list` output, and notice drift — error-prone under time pressure (T3 without verification).
- **Flat queue dispatch:** orchestrator dispatches sub-waves sequentially without verifying Stage N dependencies are merged first (`#flat-queue-no-gates` anti-pattern — dispatching Stage 2 before Stage 1 PRs merge leads to branch contamination or rebase work).
- **Ad-hoc launch-table:** Mode / SDD / Stage / Volume decisions are made inline without a structured decision framework — inconsistent across sessions, no audit trail.
- **No structured meta-kickoff:** each umbrella kickoff is hand-authored with variable §5 AI-traps enumeration quality — principle 12 violations go undetected until pre-push.

The cost of absence: orchestrator surgery time when a parallel branch contaminates main (incident 2026-05-12, the origin event), plus AI-trap violations accumulating in kickoffs.

<!-- globs: .claude/orchestrator-prompts/**, .ai-factory/orchestrator-prompts/**, docs/meta-factory/wave-sequencing-plan.md -->
<!-- inject: Meta-orchestrator — ≥2 in-flight wave umbrellas or wave-sequencing-plan.md drift: /pipeline (plan-currency + priority + launch-table + stage-gate dispatch). Forward-going annotation: activates when inject-matching-rule.sh is extended to scan .claude/skills/*/SKILL.md (today scans .claude/rules/ only). -->
