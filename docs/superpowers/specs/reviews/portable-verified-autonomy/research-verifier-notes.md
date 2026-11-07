# Research verifier notes

> **Date:** 2026-10-26.
> **Authoritative for:** the parent verifier's source spot-checks and corrections requested during research.
> **NOT authoritative for:** full runtime acceptance, final product decisions or solution agreement.

## Source spot-checks

These reads are verifier checks, not an ideation seat's silent expansion beyond a distillate. No solution design has consumed the unfinished reports.

| Check | Actual source/output | Consequence |
| --- | --- | --- |
| Dot cycle boundary | Read `scripts/dot-review-gate/runner.mjs:1–30`: runCycle joins discovery, revision-keyed queue, authorization, persisted budget, dispatch/ACK, intake, finding routing and recovery. Its comment explicitly identifies dispatch as coordination to Claude Code, not model launch or merge. | Preserve existing connected mechanisms; do not infer that the runner independently wakes a terminated owner. |
| Dot scheduling | Read `docs/meta-factory/dot-review-gate-pilot-runbook.md:25–37`: one explicit bounded pass, no cron/daemon; enrollment and real destination required. | A live Dot bot reported by the operator remains an existing asset; this source does not independently establish its current enrollment or complete unattended cycle. |
| Advisor return | Read `.agents/procedures/intent/helpers/ask-advice.mjs:1–55`: current authority, exact ask/journal/return binding; incumbent mailbox remains transport; bridge beta remains pilot. | Advice validity is distinct from automatic delivery and execution ownership. |
| Advisor pilot lifecycle | Read `scripts/advisor-bridge-beta/cli.mjs:1–28`: explicit pilot CLI, no watcher/daemon/polling; request/own/run/consult/import/decide exposed. | Do not label a command list a fully enrolled autonomous loop. |
| Owner recovery | `rg -n 'terminate|owner|recovery|paused|resume' packages/runtime-bridge/README.md`: lines 161–165 require active/explicitly resumed owner and state automatic terminated-owner recovery outside this interface. | Supports a concrete unresolved continuation boundary; not a repository-wide claim that no native owner service exists. |
| Consumer closure | Read `setup.d/ships.manifest:38–67`: arch/pipeline/reviewer env; intent and runtime-bridge-dispatch factory. | Verify what a no-AIF consumer receives before calling the workflow portable. A manifest row does not prove installed behavior. |

## Memory interface correction request

The initial draft memory report described current exposed `mcp__one_memory` tools. The parent independently enumerated `ALL_TOOLS` with `/one_memory|memhub/i` over tool names; output was exactly `[]`. This proves absence from that parent inventory at this observation, not absence of the application or endpoint. The researcher was asked to retain its own names-only inventory if different, qualify surface/time and distinguish installed bundle, discoverable tool and exercised operation. It must not launder a historical skill/dossier contract into current live tool availability. No memory query or private data access was requested.

## Review state

Executor reports were still in progress when these notes were first saved. Parent distillation and fresh K1/K2 acceptance are separate, subsequent artifacts. No research-complete verdict follows from these checks alone.
