# getff experience recall — Stage 0 result

> **Status:** NOT PASSED; skill implementation and automatic-selection trials were not started.
> **Authoritative for:** this bounded retrieval observation and its evidence limits.
> **NOT authoritative for:** general memory quality, organic adoption, productivity, runtime configuration changes or rollout approval.
> **Inputs:** [design](../superpowers/specs/2026-10-28-getff-experience-recall-design.md) and [local kickoff](../superpowers/plans/2026-10-28-getff-experience-recall-kickoff.md).

## Observed result

One real native `MemHub_context` call returned `state=partial`, zero items and `used_characters=0`. Its raw path reported `degraded/timeout_budget`; its governed-memory path reported `unavailable/timeout_budget`. The request specified `limit=2`, `character_budget=2000`, `timeout_ms=8000`, with `kinds` and `raw_source_ids` omitted. Total reported service time was approximately 756 ms; the path times were approximately 301 ms and 750 ms.

This proves that the admitted lookup did not supply usable experience. It does not prove absence of the earlier solution in memory. The response does not establish why the internal budgets ended below the requested timeout, whether that is an intentional fast-reader policy, or how another native reader would behave. No retry or fallback was performed.

The call ran in Claude Code with native model identity `glm-5.3`, permission mode `auto`, and the installed MemHub integration. An initial startup exposed a Claude model alias through the GLM launcher; that process was stopped before a memory call, then the same session resumed with an explicit GLM model. Keep those launch receipts separate rather than attributing the initial alias's usage to a verified backend model.

## Historical case and sample limits

The frozen interval was 2026-10-21 12:21:29 UTC through 2026-10-28 12:21:29 UTC. Terra in Codex selected ten Codex sessions. The remaining Claude Code slice selected seven sessions; no wider historical replay occurred. Public tasks/actions/results were analyzed locally, with private evidence retained outside Git.

The Claude Code slice identified a later documentation-gate failure, `ERR_MODULE_NOT_FOUND` for `docs-engine/resolver.js`, and an earlier successful invocation using the required TypeScript loader. The earlier positive result predates the later error. The 141-character query used the later task/error, excluding the earlier fix's specific invocation terms. The lookup returned no corresponding step.

The pair comes from different admitted cycles in one retained conversation, separated by compaction boundaries, under the same feature umbrella. It is not a clean cross-session adoption experiment. The frozen-query artifact contains a placeholder wall-clock string; retain the native tool-call order as ordering evidence and do not cite that string as a real timestamp. Codex action/outcome comparison remained partial. None of this supports a universal absence or usefulness claim.

## Context accounting

Counts below were checked against native tool records. Canonical JSON sizes are explicit serializations of recorded objects, not claims about exact wire tokenization.

| Component | Unicode characters | Interpretation |
| --- | ---: | --- |
| Installed provider skill file | 8,923 | Source body; first use only |
| Actual provider-file read response text | 9,215 | Includes the host's displayed reading representation |
| Provider read as canonical full tool-result record | 9,517 | Alternative framed accounting, not additive to the preceding row |
| Query text | 141 | Part of the arguments below |
| Request arguments as canonical compact JSON | 205 | Saved worker file is 213 characters with different serialization |
| Actual memory response text | 515 | All returned control metadata; no useful items |
| Memory response as canonical full tool-result record | 660 | Includes host framing; not additive to the preceding row |

Incremental tool-schema/discovery overhead is unknown. The worker saved a 2,154-character schema representation, but its addition to model context was not independently verified. Actual incremental tokens are unknown; the worker's four-characters-per-token heuristic is not a named-tokenizer measurement and is not adopted here. Research/session-analysis cost is separate from working-agent recall overhead. No shared-account or gateway totals were used.

The empty response fits the pilot's 8,000-character ceiling. That does not establish the size or usefulness of a successful retrieval response, nor the complete first-use token cost.

## Admission decision and evidence

Stage 0 does not pass: no source-linked useful step was returned. Stage 1 and Stage 2 remain unstarted. Do not compensate with another query, a legacy-reader fallback, broader history, memory regeneration, hook changes, permissions or backend changes under this admission. A different supported-reader trial requires a revised explicit admission.

Private evidence is retained in experiment run `20261028T122129Z`, including native request/result envelopes, query ordering, source references and separate launch receipts. Worker `glm-stage0/stage0.json` SHA256: `f39a6f0d7f9a2b08b85205afcd34b6091bb2d5a0b093f9a5741dc8e27e2072cc`. The owner's `owner-review.json` corrects serialization/token claims and retains method limitations. Loop-turn and unique-assistant-response counters differ across the resume; both are preserved, and loop-counter cap conformance is not claimed. No further inference is admitted for this run.

The pilot issued no engine/SDK/database write commands, capture-setting changes, maintenance commands or monitor changes. The finding concerns one retrieval attempt, not the health or completion of background processes; their ordinary independent activity was not audited here. No source code or skill was installed or published.
