# dispatcher — scope and provenance

> **Authoritative for:** the selected dispatcher procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

## §5 Anti-scope

- **Does NOT plan** — priority scoring, launch-table generation, plan-currency check = `/pipeline`'s job. `/dispatcher` only executes a named umbrella.
- **Does NOT build new CLI primitives** — wires the 4 existing ones in `packages/runtime-bridge/src/cli/`. A genuinely-needed new primitive = surface as a finding to maintainer, do not add it here.
- **Does NOT edit `.claude/skills/orchestrator/`** — another skill's artefact; wrap, never fork.
- **Does NOT add npm deps** — zero new dependencies; `tsx` runs existing TypeScript.

---

## §6 §1.7 self-reflexive note

**Stage 1 (dispatcher-ux):** `monitor-classify.sh` REUSES `priority-score.sh` Layer-C3 completion-detection pattern (BFR verdict REUSE, `build-first-reuse-default.md:44`; same problem class confirmed — task-status classification vs umbrella-completion classification). Tests at `packages/core/skills/dispatcher/monitor.test.ts:1`. Original BUILD-verdict forward/backward checks at `docs/meta-factory/dispatcher-skill-rphase.md`.

**Stage 2 (dispatcher-ux-s2):** P2 (`§2.8` closure-marker schema + CANON sync, `CLAUDE.md:umbrella-closure`), P3 (base-normalization note in `§2.0`, `parallel-subwave-isolation.md:6`), P4 (self-application — ALREADY-DONE writes done.md without surfacing question, `recommendation-laziness-discipline.md:6`), P6 (watch-link `§2.1`, `packages/core/skills/dispatcher/dispatch.test.ts:1`). No new CLI primitives, no npm deps.

**Stage (frontier-residue-sweep S1):** `advance-frontier.sh` REUSES the `/pipeline`-owned `frontier.sh` emitter as a pure consumer — bindings, not a fork; the §2.6 `is:merged` check stays the merge authority and `basis=marker-unverified` never advances a consumer (T-FRS1-B). Tests at `packages/core/skills/dispatcher/advance-frontier.test.ts`.
