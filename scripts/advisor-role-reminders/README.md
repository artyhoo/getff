# Project-local advisor role reminders

> **Authoritative for:** this adapter's enrollment, operation, delivery and deduplication interface.
> **NOT authoritative for:** project goal (see [README](../../README.md#why-this-exists)), bridge transport, permission grants, acceptance or consumer installation.

Four advisory texts live only in `reminders.json`, version 1. The selector reads those
same bytes for native context and explicit preparation/read output. No translator,
payload rewriting, model-brand detection or provider configuration is involved.

The selected source is the operator's 2026-10-06 tracer design §9 and implementation
packet in the parent-owned `c636` worktree. The packet authorized independent reminder
implementation while the transport owner awaits senior acceptance. This adapter does
not import that owner's modules or enroll the pilot.

## Controller-owned enrollment

The accepted bridge controller must supply a protected enrollment file, separate from
worker data. The default local path is `.advisor-role-reminders/enrollment.json`;
state is `.advisor-role-reminders/ledger.json`. These runtime files are ignored by git.
The controller may pass explicit `--binding` and `--state` paths instead.

```json
{
  "bridge_id": "example-bridge",
  "contexts": [
    {
      "session_id": "executor-session",
      "agent_id": "",
      "identity": "executor-identity",
      "role": "executor",
      "peer_identity": "senior-identity",
      "context_epoch": "recipient-context-1"
    },
    {
      "session_id": "senior-session",
      "agent_id": "",
      "identity": "senior-identity",
      "role": "senior",
      "peer_identity": "executor-identity",
      "context_epoch": "recipient-context-1"
    }
  ]
}
```

A unique session/agent binding is required. Consumption also requires an exact enrolled
opposite-role peer. The controller validates actual source provenance before calling;
a sender string in worker payload does not establish identity. This is a binding
adapter, not an authenticator or filesystem confinement. Protect enrollment/state under
existing permissions; do not let quoted payloads choose either path or activation.

## Explicit preparation and read fallback

Run from the project worktree, before composing a message or acting on an artifact:

```bash
python3 scripts/advisor-role-reminders/reminders.py \
  --binding /path/to/controller-enrollment.json \
  --state /path/to/controller-ledger.json \
  --session senior-session --operation consume-report \
  --source executor-identity --payload /path/to/canonical-report
```

The output has separate `additional_context` and `payload_base64` fields. Deliver the
former as trusted bridge context outside the worker quotation; decode the latter to
recover the original bytes, including CRLF, trailing newline and non-UTF-8 bytes.
Preparation can omit `--payload`: it happens before authorship. Duplicates return an
empty context and still return all supplied bytes. Binding/operation/source/read/state
errors return exit 2 with no payload on stdout; preserve and report that error.

| Role | Preparation operations | Consumption operations and source |
|---|---|---|
| Executor | `prepare-consult`, `prepare-report` | `consume-assignment`, `consume-decision`, `consume-rework`; enrolled senior |
| Senior | `prepare-assignment`, `prepare-decision`, `prepare-rework` | `consume-consult`, `consume-report`; enrolled executor |

## Native preparation or bound launch receipt

`hook.sh` reuses `.claude/hooks/lib/hook-emit.sh` for JSON escaping. The existing
matching-rule injector supplies the scoped once/reset pattern, but its card-level cache
and summary/body rewriting cannot implement this role/phase/byte-preservation contract.
Its unrelated callers and shared emitter are unchanged.

The controller arms a context with `native_operation` plus `native_event` equal to
`SessionStart` (explicit bound launch instruction) or `UserPromptSubmit` (preparation or
controlled incoming prompt). For consumption it also sets `native_source` to the
validated peer. Prompt-time delivery additionally requires `native_prompt_sha256`, the
SHA-256 of the exact UTF-8 prompt the controller will submit. Unrelated prompts are
silent and do not spend the allowance. The hook never takes an operation/role from
prompt text. On cancellation or completion the controller removes these activation
fields; an enrollment alone does not arm delivery. Do not arm a launch for unrelated
work, or reuse stale activation when resuming for another operation.

`hooks.json` is the project-local registration input for CC's invocation-scoped
`--settings scripts/advisor-role-reminders/hooks.json`. It does not replace the
project's existing settings. No edit to `.claude/settings.json` is needed or performed.
The controller must enroll CC's explicit session ID before launch. Codex binding needs
an already observed session ID; forks need their own binding/context epoch.

Codex's documented local registration paths were probed independently (see
[verification](VERIFICATION.md)). The current host did not discover this adapter through
sidecar or inline project config despite an active project layer. Native Codex receipt
and its hook trust-review cell are unresolved. Use explicit preparation/read output in
the continuing desktop session; do not grant trust automatically or use bypass flags.

## Context lifetime and receipt limits

The ledger serializes concurrent processes with `fcntl.flock` and atomically replaces
JSON. Keys include bridge, session, agent, controller context epoch, confirmed reset
counter, role, prepare/consume phase and reminder version. Operation variants within a
phase share the allowance. Fresh recipient context means a new controller epoch.
Confirmed native `SessionStart` with source `compact` or `clear` resets that binding even
when native operation delivery is disarmed. Resume and duplicate polling do not reset.
When that native lifecycle path is unavailable, the controller advances `context_epoch`
after confirmed compaction. PreCompact alone is not confirmation.

The ledger records output production, not model receipt. If hook output is discarded by
timeout or interruption after claiming the allowance, diagnose that lost delivery and
advance the controller epoch for explicit retry. Do not infer receipt from JSON or exit
0. Native registration should occur once; duplicated confirmed lifecycle events cannot
be distinguished without host event identity and would reset twice.

No arbitrary shell/file interception is claimed. A send-time PreToolUse event is not
used to revise an already authored pending message. The host must display preparation
context before composition and read context before action. These reminders do not
prove compliance; original schemas, failures, unknowns and senior acceptance remain.

## Reuse provenance and scope

Parent audit: THIN-ADAPT / GO. SSOT `prior-art-evaluations.md` rows #20/#21/#201/#234 were
consulted; three Context7 phrasings confirmed native context, lifecycle reset and timing.
Upstream problem class: event-driven advisory context injection. This module's class:
explicitly enrolled role/phase reminders with canonical data outside trusted context.
Match: delivery primitives match; the residual binding/ledger is project-specific.

The backward sweep found eight existing sibling lanes. Their digest, summary, memory
and capped handoff formats have different contracts. Reuse the emitter and scoped-cache
pattern here; do not feed canonical payloads through card/digest summarization. No
sibling behavior is replaced. Consumer/plugin packaging, installer, AIF/DOT, scheduler,
global configuration, transport changes and pilot activation remain deferred.
