# MemHub read-timeout diagnosis

> **Status:** The timeout-parameter mismatch is explained. A stock governed reader returned partial results; useful-fix retrieval and skill rollout remain unaccepted.
> **Authoritative for:** this diagnosis, source binding, bounded native comparison and resulting design correction.
> **NOT authoritative for:** complete store health, all-history coverage, automatic adoption, runtime patches or rollout approval.

## Why 8000 ms still ended around 750 ms

The installed native runtime is official MemHub 1.0.4 build 13. Its manifest names commit `688878171e9d98ade3871fecf7eca603c7c43a76`; the MCP bridge, runtime broker and Core executable hashes match that manifest. The matching [Core route](https://github.com/Tencent-Hunyuan/Hy-Memory/blob/688878171e9d98ade3871fecf7eca603c7c43a76/memhub/apps/core/src/one_memory/context_routes.py#L43-L64) has separate hard limits:

| Budget | Limit |
| --- | ---: |
| Interactive request | 900 ms |
| Original-history lane | 300 ms |
| Governed-memory lane | 750 ms |

The request-level timeout is clamped before those lane deadlines. Raising it to 8000 ms cannot raise their limits. This is the shipped fast-reader contract. The earlier pilot incorrectly treated the outer allowance as a way to avoid the known inner timeout; a different timeout number is not a structural remedy.

DeepWiki corroborated the distinction between fast context and governed recall but could not verify the precise release independently. The manifest-bound primary source governs this finding.

## Native verification

Two new diagnostic reads used the same frozen real-task query, ordinary native MCP tools and existing grants. These reads ran in Codex; the original failed trial ran in Claude Code. Do not call this a same-host Claude Code comparison.

| Read | Result | Complete forwarded output |
| --- | --- | ---: |
| `MemHub_context`, limit 2, text budget 2000, timeout 8000 | Partial; zero items; history and memory ended on their approximately 300/750 ms budgets | 1,159 Unicode characters |
| `MemHub_recall`, limit 2, text budget 2000, timeout 30000 | Two governed hits, labeled `chat` and `coding`; still truncated by `timeout_budget`, with 190 unexamined candidates | 5,609 Unicode characters |

Each output count includes both content and structured representations actually forwarded to the model by code mode. The recall JSON text alone was 2,730 characters; its returned memory content totaled 1,853. These are character measurements, not actual token measurements or a universal size guarantee.

The returned coding record concerns integrating docs-engine checks with CI and preserving broad test-trigger coverage. The related chat record contains historical project constraints. They establish that governed memory can be read on this route. They do not supply the specific earlier TypeScript-loader fix used by the historical comparison. Returned historical instructions were not treated as current authority. System 2 lineage is not established by these kind labels.

## Ownership and response

Upstream Core owns the bounded fast-reader mechanism. Accept and document its contract; this finding requires no engine patch, database repair, replay, permission change or supported-setting override. We own the pilot's reader choice and incorrect budget assumption. Correct that factual assumption and pause the context-only rollout; do not silently convert a successful partial read into acceptance of a new skill.

The existing `MemHub_recall` interface is a supported candidate for a revised governed-experience pilot. It still needs useful-result, complete-cost and per-host behavior acceptance. Its two related hits are not proof that the exact historical solution is present, that every candidate was searched, or that agents adopt returned information. No further diagnostic query is admitted here.

Private evidence is retained under experiment run `20261028T122129Z`, diagnostic increment `read-diagnosis-20261028T153847Z`: matching source/manifest hashes, the original native failure, both new exact native envelopes, model-visible size accounting and unchanged source snapshots. The GLM collection reached its 12-turn CLI ceiling without a written report; its log is retained. The owner verified its collected source findings and ran the already admitted native checks without an extra model prompt or an allowance reset.

This report explains the earlier [Stage 0 result](2026-10-28-getff-experience-recall-pilot.md). It does not retrospectively turn that NOT PASSED result into a pass. No skill, engine update or runtime configuration change was installed.
