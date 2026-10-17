# dispatcher — invocation

> **Authoritative for:** the selected dispatcher procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

<!-- @harness-posture: cc-native-with-fallback — CC slash-command + !shell + REST dispatch; dual-channel degradation for CC-absent harnesses documented in references/invocation.md §0 -->

<!-- @dual-pair: dispatcher-skill -->
<!-- Note: CC-native and portable channels share this skill payload (card plus references); the dual-implementation §5 two-file drift-check has no separate harness twin by design. Both channels use the same invocation procedure. -->

> **Class:** C — prose-only wiring skill; mechanical enforcement = CC slash-command primitive (exists or does not). Promotion criterion: ≥2 harvest-forgotten incidents within 6 months → consider a PostToolUse hook checking done-task dedup against harvested PRs.
> **Authoritative for:** /dispatcher slash-command behaviour — §0 invocation through §6 advance; dispatch→monitor→Q&A→harvest→Phase-1→stage-gate→advance loop; Q&A park-type taxonomy; the §3 Type-2 park-chip contract + decision-session protocol (ADR D3/D4); dual-channel degradation for CC-absent harnesses.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../../README.md#why-this-exists). Planning, priority scoring, launch-table generation — see [.claude/skills/pipeline/SKILL.md](../../pipeline/SKILL.md). The `orchestrator` skill at `.claude/skills/orchestrator/`.

# /dispatcher — aif-control execution loop

**Origin:** BUILD verdict 2026-06-03. R-phase patch: [docs/meta-factory/dispatcher-skill-rphase.md](../../../../docs/meta-factory/dispatcher-skill-rphase.md). Complements `/pipeline` (plan) with the execution half. SSOT #111.

**Substrate:** CC slash-command + 4 existing CLI primitives (zero new npm deps, zero new code). All dispatch is session-bound (`no-paid-llm-in-ci.md §1`).

> **⚡ aif environment rule:** `/dispatcher` is the ONLY skill that works with aif. On ANY aif environment symptom — task stuck, push rejected, capacity full, missing tool in container, blocked_external, proxy error — **first action = invoke `/aif-doctor`**. Do NOT manually `docker exec` fix-by-fix. The doctor classifies the mode in one sweep and maps the right fix. Incident 2026-06-04: harvest-push fell on missing `actionlint`→`zizmor` (uninstallable); manual grinding took many turns; `/aif-doctor` would have immediately classified «container is a runtime, not a push env → land from host with full toolchain».

---

## §0 Invocation

**Slash command:** `/dispatcher [<umbrella-name>]`

> **Invocation-channel flag, not a permission.** `disable-model-invocation: true` keeps a skill out of auto-load and out of subagent preload, and stops the Skill tool from invoking it — an explicit `/<name>` from the operator is its only invocation channel, so an agent never self-initiates the procedure. It does **not** seal the file: an agent already asked to do this work may read the SKILL.md and execute its documented steps, and doing so is correct behaviour, not a workaround. On ZCode the flag is not runtime-enforced (absent from the runtime, survey #1699 §5): there the explicit-only channel discipline is prompt-level — this blockquote is the gate, so an agent on ZCode must still treat an explicit /<name> as the only self-initiation channel. <!-- canonical: invocation-channel-flag -->
> Full contract (what the flag does, what it does not, and the two misreads that cost autonomy): [operational-conventions.md §4](../../../../docs/meta-factory/operational-conventions.md#4-disable-model-invocation--an-invocation-channel-flag-not-a-permission).

**What this skill does:** EXECUTES a chosen umbrella's stages through the aif-control loop. It does NOT plan or score priority — that is `/pipeline`'s job. If no umbrella is named, list pending stages from `.claude/orchestrator-prompts/` and prompt the operator to choose one.

---
