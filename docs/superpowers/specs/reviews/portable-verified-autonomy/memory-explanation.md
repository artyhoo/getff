# Memory explanation: host capability versus proposed integration

> **Date:** 2026-10-26.
> **Authoritative for:** bounded sources and distinctions used to answer the operator's memory question.
> **NOT authoritative for:** an agreed memory backend, live operation, permissions, migration or final architecture.

## Confirmed source behavior

OpenMausBot pin: `3ac9fb1122a34b2755580d3d5d7cbd1a1a77bd4b`, as retained in the accepted research.

- `server/memory-store.ts:17–19,49–60,77–101` defines per-bot Markdown memory locations: `MEMORY.md`, topic files and dated logs. `:134–154` describes bounded loaded capacity. `:225–254` writes through a redaction helper and atomic file writer, with optional expected-hash conflict checking. This is source behavior, not a claim that secret removal or every live write was tested.
- `server/memory-capture.ts:63–128` builds a model prompt for candidate preferences, facts, decisions and verified outcomes, grouped into core/topic material. Its instructions exclude unsupported claims and transient requests. These are prompt requirements, not proof that automatic extraction always obeys them. The module alone does not prove the live caller schedule or processing provider.
- `server/memory-entries.ts:1–6,39–74,97–103` represents dated/source-marked entries, expiry and superseded entries. Representation/filtering is not a verified semantic correction result.
- The existing [binding probe](openmaus-binding-probe.md) records prompt assembly: personal memory, team memory, recent work and shared notes can enter native tasks. Personal-memory disable plus a fresh thread does not establish cold-review isolation.

All upstream line references above resolve to the accepted captures in `docs/superpowers/research/portable-verified-autonomy/2026-10-26/evidence/openmausbot--server__*.ts`, not a currently running installation.

## Proposed getff integration explained to the operator

Keep authoritative requirements/rules in the repository; actual task/result/next-action state in the existing task/runtime and coordination records; sourced experience in existing repository knowledge and the evaluated Hy-Memory-related installation. These distinctions do not prescribe three new stores.

Use OpenMaus local memory as convenient host context and pointers rather than a second independently authoritative copy of getff's specifications. Avoid assuming automatic bidirectional synchronization with Hy-Memory or native Claude/Codex memory. A replacement agent reads current task/authority, then permitted relevant experience. Corrections must reference their source and supersede old guidance explicitly; current approved repository decisions win.

Reuse the existing memory installation before replacement, conditional on identity, scoped retrieval, supersession, reviewer isolation and no-additional-payment processing. Those conditions remain unproved, as documented in the accepted [memory report](../../../research/portable-verified-autonomy/2026-10-26/memory-reality.md). No dedicated memory bot, new database or complete conversation import is proposed.

Independent reviewers receive the permitted requirements/candidate/observation packet; they do not inherit the author's private reasoning through team memory. The working design's external-review proposal still requires actual input and retrieval verification.

## Bounded drill-down record

Consumed the accepted memory report and prior host/binding findings. Direct cited-source opening was limited to three previously captured artifacts: `memory-capture.ts`, `memory-store.ts`, `memory-entries.ts`. Used structural text search plus bounded reads of capture:1–128, entries:1–104, store:134–154 and :225–255. This clarifies that the host's notebook/capture functions are real, while live synchronization, extraction quality and provider costs remain unknown. No new source survey, installation, memory query/write, private chat read or configuration change occurred. These are supporting explanatory notes; no product choice was inferred from the question.
