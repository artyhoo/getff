# Canonical agents completion — implementation specification

> **Status:** Operator selected junior publication/merge and AIF execution; senior preparation only, execution not started.
> **Authoritative for:** the two-stage completion requirements and acceptance boundaries for the existing canonical migration.
> **NOT authoritative for:** project goal, hook trust, model pricing or release permission; README.md and existing platform policies retain those authorities.

## Context and operator premises

| ID | Recorded premise, faithful to the operator's meaning | Consequence |
|---|---|---|
| P1 | Stage 1: make framework contribution in Codex work as in Claude Code/Opus, or better; skills, hooks and scripts share an AI-independent foundation. | Moving directories alone cannot close stage 1. Require actual behavior at the destination. |
| P2 | Shared authored content belongs in .agents; .codex/.claude/.zcode are thin native layers. | One authored procedure/check; adapters translate native contracts. Codex-required .agents/skills remains a thin discovery layer. |
| P3 | Stage 2: the existing one-button installer must deliver this to Codex consumers as reliably as to Claude consumers. | Fresh, upgrade and standalone package destinations must work. |
| P4 | This senior session prepares specifications/kickoffs; AIF performs execution; a cheaper independent model performs review and verification. | Reuse /pipeline, /dispatcher, /aif-doctor and runtime-bridge. No new orchestration system. |
| P5 | Preserve the work already done and economize tokens. | Continue the frozen checkpoint; do not redo the source migration or repeat unchanged broad suites. |
| P6 | The junior model performs task merges; the returned result is checked in Codex by a cheaper model using the senior-prepared instructions. | Junior owns scoped Git delivery; merge is followed by independent host verification and does not certify parity. |

Existing approved scope: [original kickoff](../plans/2026-10-05-agents-canonical-refactor-kickoff.md).
This specification refines completion and delegation. Latest operator authorization supersedes earlier no-publication statements for junior task-scoped Git delivery; protected-file, trust and unrelated release constraints remain.

## Decisions and falsifiers

| Decision | Status | Resolution | Falsifier |
|---|---|---|---|
| Shared owner | answered | .agents/procedures, roles, rules, hooks, checks and bootstrap own shared behavior. Neutral runtime/build/CI owners stay in their existing directories. | Same workflow needs independently authored edits in multiple harness copies. |
| Native entries | answered | Reuse links or full-source loaders; plugins may carry generated expanded payload with whole-body drift checks. | A pointer never loads the full source, helper is missing, or generated prose diverges. |
| Factory route | answered | Existing rules-as-tests-aif project and its configured stage profiles; no task-level override by default. | Wrong project, another model/transport selected silently, or a manual fallback reported as a dispatched task. |
| Independent review | answered | Separate fresh-context cheaper reviewer reads a frozen result and runs meaningful checks on an isolated copy. | Reviewer only trusts implementer's report or tests a different revision. |
| Host validation | answered | Native Codex behavior is checked on the actual supported host, after source/package checks. | Container tests or hooks/list are presented as hook execution. |
| Publishing inputs/results | answered | The operator authorized the junior continuation to commit/push/create PRs/merge task inputs and results through the existing workflow; publish inputs before dispatch. | Dispatch starts with invisible inputs or Git delivery touches unrelated/dirty host state. |
| Review seat | answered | AIF retains configured GLM profiles; final independent review runs in the operator-selected cheaper Codex seat with the prepared review kickoff. No model identifier is invented. | Container-only reviewer signs off unexecuted desktop behavior. |

## Baseline and continuation boundary

Authorized local destination: /Users/art/.codex/worktrees/0479/rules-as-tests-aif.
Original real HEAD: 1b390629d4806e9378989533c7a1501dd4c08b08.
Prepared integrated tree: /private/tmp/agents-canonical-combined; durable packet is primary for factory use.
Real destination does NOT yet contain the integrated refactor.

The 211-file source map, native entries, installer migration, reader/guard updates and many targeted controls already exist. The original 20 workflow groups and M01–M32 remain intact; complete=false.
9/9 source/native join controls and earlier 39/39 adapter controls passed. Installer/link/pack controls passed within their recorded scope.
One project-wide test invocation ran; failed-only reruns resolved many failures. Final self-audit, final standalone pack install, fresh Git closure and real destination verification remain open.
Do not sum partial test runs into an invented full-suite result.

Sealed content hashes:
- .claude/settings.json: e7b01934d811a54d5a6d9ed41faffc97685d197a345dd79f6f81a54743e0681a
- .ai-factory/harness-model.json: 3c17c24761e9ff9e920922986efcb81136129faa8aef23c94d17e085c5bef19b

## Stage 1 contract: contributor architecture and behavior

S1.1 One authored owner for the complete enumerated own-stack population. Retain public names, arguments, deliberate contributor/consumer variants, trigger intent and helpers. External plugin caches and user-owned skills are outside ownership.
S1.2 All native entry paths load the complete common procedure. Preserve Codex metadata; Claude model/tool frontmatter does not grant Codex permissions or select a Claude model.
S1.3 A source edit propagates to all bindings through direct reuse or validated generation. Keep whole-body drift checks and ownership-aware clobber guards.
S1.4 Required sources and native discovery/config entries survive the intended Git file set. Fresh worktree discovery needs no ad hoc recovery generator.
S1.5 Preserve existing CC/ZCode behavior and sealed hook registration. Adapt events, arguments, paths, output and transcript formats without silently manufacturing successful events.
S1.6 Verify clean and violating paths through the existing event adapter; include add/update/delete/move and canonical/legacy origins where affected.
S1.7 Actual Codex runs establish full procedure loading, argument binding, execution of mandatory helper steps and correct failure handling. A prose instruction to execute is weaker than an automatic native step until receipt is observed.
S1.8 Startup, selective rule injection, once-cache, child isolation, manual/automatic compact, PreToolUse denial and post-write feedback receive separate acceptance dispositions. Preserve valid historical receipts when unchanged.
S1.9 Arbitrary interpreter/compound shell/write_stdin and remote MCP policy must be accounted for. Bounded literal-command parsing does not certify every effect channel.
S1.10 Missing failed-write/cancellation callbacks require a supported fallback with an actual receipt or an explicit unresolved limitation. Never infer failed execution from missing events.
S1.11 Reconcile all 20+32 records against current source/evidence. Rows may be verified, unresolved, native-limited or outside this local completion contract with a named owner/reason. An unresolved requirement remains unresolved, not PASS.
S1.12 Factory orchestration workflows, external companions and memory/coordination contracts retain their recorded gaps. Do not claim universal parity from local checks; do not invent new remote jobs merely to fill a table.

Stage 1 has two separately reported milestones: architecture delivered; contributor behavior accepted.
Only the second may be called completion of the operator's stage 1. Material unsupported behavior is reported for operator disposition, never silently removed.

## Stage 2 contract: consumer installation

S2.1 Existing install entrypoint/profile selection delivers the appropriate common .agents payload and thin native bindings, including Codex. Preserve core/env/factory audience contents.
S2.2 Fresh, legacy upgrade, repeat, force, refresh, dry-run, customization and overrides retain documented semantics.
S2.3 All installed links/helpers resolve inside consumer-delivered content. No checkout, temporary runtime or external cache link dependency.
S2.4 Preserve all 15 existing snapshot cells. Narrowly recapture stale cells, review structural/link deltas, then run aggregate comparison once.
S2.5 Package assembly includes only intended tracked payload-contained links, materialized safely. Rebuild MANIFEST after final source/index changes in the disposable fixture.
S2.6 Local npm pack is installed with the contributor source unavailable; skills/helpers/checks remain functional.
S2.7 Consumer Codex discovery and changed event joins are verified on a real supported host. Native activation/trust and external MCP credentials are explicit platform-managed boundaries; installer files cannot grant them.
S2.8 Document the exact one-button operation and any actual host-required activation. Do not promise silent unattended trust, or call copied files a working installation.

## Constraints and economy

Preserve all existing WIP; no broad overwrite/reset/stash. Do not touch 778f, primary checkout or another chat's state.
Junior task-scoped staging/commit/push/PR/merge of dispatch inputs and factory results is authorized by the latest operator instruction. Use isolated Git delivery checkouts; do not stage the dirty 0479 index or unrelated WIP.
AIF may commit its isolated task result; junior uses the existing sweep/harvest/PR/check/merge flow. No force-push, destructive Git, npm publication, production deployment or global/trust edits.
Independent cheap Codex host verification follows return of the merged/delivered result. Git merge does not establish native acceptance.
Reviewer is read-only on source; mutating tests run on a private copy.
Use configured project profiles, account and budget controls. No Qwen API transport switch or paid API substitute.
Use existing helpers/tools/tests. No new portability framework, no blanket guard exemptions.
Run required final gates once after freeze; repeat only changed or failed checks.
English artifacts, Russian operator communication.
If a payload/native definition change requires trust review, provide exact changed definitions; do not bypass trust.

## Acceptance artifacts and testing seams

Reuse canonical-agents-map.json, existing Node/Vitest tests, shell installer controls, renderers, native doctor and historical trace drivers.
For every new receipt record requirement ID, input/result identity, command or driver, destination, expected clean/violation/error behavior, observed outcome, exit code and log reference.
Freeze review-target.json with base/head or patch identity, all intended paths, content/link/mode hashes, result archive SHA256, test environment and remaining failures.
Provide implementation-report.md plus additive acceptance/ledger updates. Original ledger rows and evidence remain.
The reviewer consumes this frozen identity, not a mutable /tmp location or the AIF status string.
Report architecture, native behavior, installation and package delivery separately.

## Consequences

This reuses most completed implementation and the existing factory. Cheap workers perform repairs and deterministic verification; the senior seat is needed only for unresolved design decisions.
Container and desktop capability boundaries remain visible. Completion can be delayed by a genuine native limitation; successful directory migration cannot conceal it.

## §1.7 Self-review

Forward: requirements retain the README goal, existing common-source owner, sealed configuration, host trust and economical verification.
Backward: source, wrappers, helpers, lifecycle, effect channels, Git, installer upgrades, package closure and real native receipts all have named requirements. The operator's full behavior goal remains separate from architecture acceptance.
