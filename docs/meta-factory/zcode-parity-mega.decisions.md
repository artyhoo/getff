# Decisions — zcode-full-parity-mega-umbrella

> **Type:** Operator decisions log for the mega-umbrella. Strategic forks parked by aif agents are resolved here, then pushed via `tsx packages/runtime-bridge/src/cli/answer.ts --decision request_changes` in the morning.
> **Origin:** mid-flight operator session 2026-07-18 (during Wave A autonomous research).
> **Status:** 3 of 3 meta-forks decided; all recorded for morning `answer.ts` push to running tasks.

---

## Meta-fork A — Degradation philosophy (governs Stage 4, 7, 9) — ✅ DECIDED

**Operator decision (2026-07-18):** Refined A3 — **build-workaround-default**.

> «ресерчить и искать решение и альтернативу если нет и решение сложное в реализации только тогда документировать - но это после обсуждение со мной в таком случае»

**Binding interpretation for parked tasks:**

1. Default stance: research with bias toward FINDING a workaround / alternative implementation.
2. If research shows a working alternative exists → propose it in the research-patch with implementation cost. Still parks for operator decision (because effort/complexity tradeoff is strategic).
3. If research shows NO alternative OR alternative is complex to implement → park as «needs operator discussion before declaring degradation». Do NOT auto-document as CC-only.
4. Documentation as CC-only is the LAST resort, only after operator confirms in brainstorm.

**Effect on running tasks (morning `answer.ts` push):**
- Stage 4 (`ec6ef33b`): when parked, push «Build workaround preferred per Meta-fork A. Re-evaluate Fork 4A/4B/4D effort. Fork 4C (declare CC-only) requires operator discussion FIRST — do not auto-adopt.»
- Stage 7 (`183f46de`): same — bias toward Fork 7B (extend backup to deliver SubagentStart-equivalent payload).
- Stage 9 (`8c8d6da4`): same — bias toward Fork 9A/9C (rollout-based or hybrid), Fork 9B requires operator discussion.

---

## Meta-fork C — Agnosticism scope (governs Stage 8) — ✅ DECIDED

**Operator decision (2026-07-18):** C3-direction with current CC-first priority.

> «вообще мы должны быть ии агностиками - это цель к которой мы должны придти и к которой мы идем - просто многие фишки еще не реализованны - но цель пока что CC first + аналогичное для остальных(пусть слабее работает пофиг)»

**Binding interpretation:**

1. **Long-term goal:** full AI agnosticism (C3). Framework is openly moving toward this.
2. **Current pragmatic stance:** CC-first (full features) + analogous for others (ZCode + future Cursor/Codex/Aider/Windsurf — even degraded is acceptable).
3. **No OUT-OF-SCOPE verdicts** in Stage 8 — every harness gets either SUPPORTED (works today) or FEASIBLE-WITH-WORK (roadmap item, not rejected).
4. **README/doctrine framing:** «CC + ZCode today; Cursor/Codex/Aider/Windsurf on roadmap toward agnosticism. Framework is AI-agnostic-by-design; per-harness feature coverage varies.»

**Effect on running task (morning `answer.ts` push):**
- Stage 8 (`11774f50`): when parked, push «Per Meta-fork C: NO OUT-OF-SCOPE verdicts. Each harness gets SUPPORTED or FEASIBLE-WITH-WORK. Doctrine framing = "AI-agnostic-by-design, moving toward full coverage; CC-first today." Public claim = roadmap, not rejection.»

---

## Meta-fork B — Maintenance philosophy (governs Stage 2) — ✅ DECIDED

**Operator decision (2026-07-18):** Fork 2B-revised — **single template + generator**.

> «так кажется что не должно быть дублирования должен быть 1 шаблон и из него генерироватся 2 версии или даже 1 оснавная версия и из нее версия для консьюмера»

**Empirical basis (measured before deciding — T3 compliance):** diff of all 13 existing twin pairs:

| Divergence class | Count | Hooks |
|---|---|---|
| Byte-identical (zero diff) | 5 | ask-question-reminder, deps-hash-check, end-of-turn-reminder, inject-memory-codification, inject-session-bootstrap |
| 1-line diff: env-first `REPO_ROOT` form | 6 | check-doc-authority, check-hook-marker, check-kickoff-traps, check-worker-dispatch-channel, runtime-bridge-dispatch, validate-prompt |
| Multi-line diff: var rename + comment updates | 1 | inject-matching-rule (`REPO_ROOT` → `PROJECT_DIR`) |
| Extensionless sibling-call only | 1 | inject-subagent-context (1-character change: `.sh` suffix dropped) |
| Source missing (plugin-only) | 1 | session-start (special case) |

**85% of twins become byte-identical after one source-side change** (standardize on env-first `REPO_ROOT` form universally). The remaining 2 are 1 `sed` transform each.

**Binding interpretation for Stage 2 task + Wave B Stage 6:**

1. **Single source template:** `.claude/hooks/*.sh` is the SSOT. Update 6 source files to use `REPO_ROOT="${CLAUDE_PROJECT_DIR:-<fallback>}"` universally.
2. **Generator:** `scripts/generate-plugin-twins.sh` (~50 lines) reads source, applies per-hook transform if declared, writes twin. Default transform = identity.
3. **Per-hook transform marker:** inline comment in source (`# @plugin-transform: sed s/REPO_ROOT/PROJECT_DIR/g`). Absent marker → byte-identical twin.
4. **Pre-commit hook** auto-regenerates twins + `git add plugin/hooks/` when source changes. Developer never thinks about twins manually.
5. **Test:** for each pair, `diff source twin` must be empty OR match the declared transform output. Catches drift + generator bugs.
6. **Future semantic-divergence case:** if a hook needs real logic divergence (not mechanical), it stays hand-maintained with `# @plugin-transform: manual` marker. Generator skips. Known exception, documented.
7. **inject-matching-rule PROJECT_DIR rename:** standardize on `REPO_ROOT` everywhere (internal var name, consumers don't read plugin hook internals). The var rename was cosmetic; uniform naming > semantic purity.

**Implementation scope:** ~230 lines machinery + tests + 6 source edits. Lives in Wave B Stage 6 (after Stage 2 verdict pushed via `answer.ts`).

**Effect on Stage 2 running task (`a6b345de`):** morning `answer.ts` push:

```text
Per Meta-fork B: FORK 2B-REVISED = ADOPT.
Reframe research-patch through this lens:
- 2B-revised (1 template + generator + per-hook markers) — ADOPT, this is the decision.
- 2A (lint) — OPTIONAL additional test layer on top, not primary.
- 2C (diff-test) — REJECT, no hand-maintained twins to diff.
- 2D (unified scripts) — REJECT, step-1 anti-pattern.
Empirical basis: 85% byte-identical after source standardization.
Implementation moves to Wave B Stage 6.
```

**Lesson learned (recorded for future R-phase):** my initial 2A recommendation argued from theory ("twins are quite divergent → hand-maintained + lint"). Empirical measurement showed 85% byte-identical. **Measure before recommending** — T3 applies to maintainer recommendations too, not just agent verdicts.

---

## How these decisions reach the running tasks

**NOT pushed mid-flight.** Running aif tasks received their kickoffs with neutral park contracts. Decisions are applied in MORNING via:

```bash
# When task <id> parks (status=blocked_external with question):
tsx packages/runtime-bridge/src/cli/questions.ts  # see all parked
tsx packages/runtime-bridge/src/cli/answer.ts \
  --task <id> \
  --decision request_changes \
  --answer "<decision from this file, e.g. Meta-fork A: bias toward build-workaround; Fork 4C requires operator discussion>"
```

`request_changes` returns task to `implementing` with `reworkRequested:true` — agent reworks with the new constraint. Per runtime-bridge README §answer.

---

## Decision traceability

| Meta-fork | Status | Decided | Stage(s) affected | Task IDs |
|---|---|---|---|---|
| A (degradation) | ✅ decided | 2026-07-18 | 4, 7, 9 | `ec6ef33b`, `183f46de`, `8c8d6da4` |
| B (maintenance) | ✅ decided | 2026-07-18 | 2, 6 | `a6b345de` |
| C (agnosticism) | ✅ decided | 2026-07-18 | 8 | `11774f50` |

---

## Wave A brainstorm resolutions (2026-07-18, post-research + env-probe)

After research-patches merged (#1034-1040) and zcode.cjs bundle probe answered all R-questions, operator resolved 5 strategic forks in brainstorm session:

### Fork 1 (Stage 7 SubagentStart) — ADOPT **7B** (extend backup)

**Operator decision:** extend `inject-subagent-context` to deliver the same full digest that CC's SubagentStart arm of `inject-project-digest` delivers (not just accept minimal backup as-is).

> 7A vs 7B: 7A accepts existing minimal backup. 7B invests in upgrade for real parity. Operator chose 7B for full parity.

**Implementation:** extend `inject-subagent-context` ~50-100 LOC; ZCode SubagentStart-via-backup gets equivalent payload to CC native.

### Fork 2 (Stage 4 warn-subagent) — ADOPT **4D** (hybrid)

**Operator decision:** Build hybrid — 4B real-time arm (PostToolUse:Agent + 120KB payload read) + 4A completeness arm (Stop + rollout scan with transcript_path).

**Probe basis:**
- R1 ✅ rollout has multi-line per session
- R3 ✅ Stop hook receives `transcript_path`
- R4 ✅ Agent tool_result in PostToolUse:Agent payload is **120KB** (CC is 4KB — ZCode is better)

**Implementation:** ~150 LOC, two arms.

### Fork 3 (Stage 9 multi-turn + anchor) — ADOPT **9C** (hybrid)

**Operator decision:** Add ZCode arm with synthetic-transcript anchor (unchanged from existing) + rollout-based multi-turn guard. CC arm stays unchanged.

> Operator question: "CC вариант останется как есть?" — YES. Existing `_is_zcode` branch preserves CC path; only ZCode arm extended.

**Implementation:** ~50-80 LOC, ZCode-only branch addition.

### Fork 4 (Stage 2 mech-2 generator) — ADOPT **2B-standardize**

**Operator decision:** Edit source files to use env-first REPO_ROOT form universally → 12/13 twins become byte-identical to source. For 1 remaining divergence (`inject-subagent-context` `.sh` suffix drop), inline `# @plugin-transform: sed` marker. Generator = ~20 lines bash.

**Empirical basis (measured pre-decision):**
- 5/13 twins already byte-identical
- 6/13 differ by 1 line (env-first REPO_ROOT)
- 1/13 differ by var rename (drop, standardize on REPO_ROOT)
- 1/13 differ by 1 char (`.sh` suffix — keep marker)

### Fork 5 (Stage 8 README framing) — ADOPT **F3-with-Cursor**

**Operator decision:** Vision-driven framing AND immediately list Cursor as supported (since research confirmed near-1:1 CC overlap, including SubagentStart/Stop natively).

> Operator: "F3 - так добавь сразу курсор раз работает все"

**Final framing:**
- **AI-agnostic by design** — any harness with CC-compatible hook system works
- **Supported today:** Claude Code, ZCode, **Cursor** (high overlap, has SubagentStart/Stop)
- **Roadmap (FEASIBLE):** Codex CLI (lifecycle hooks, adapter needed), Windsurf (Cascade Hooks, taxonomy adapter)
- **Out-of-scope:** Aider (no hook system)

**Caveat:** Cursor support is research-claim (docs-verified). Wave B Stage 10 doctrine notes live testing as follow-up.

---

## Wave B dispatch plan (post-brainstorm)

| Stage | Type | Estimated LOC | Dispatch |
|---|---|---|---|
| Stage 5 (warn-subagent impl 4D) | exec-build | ~150 | autonomous via aif |
| Stage 6 (9-twin migration + generator) | exec-build | ~200 + 6 source edits | autonomous via aif |
| Stage 7B (inject-subagent-context extension) | exec-build | ~50-100 | autonomous via aif |
| Stage 9C (end-of-turn-reminder ZCode arm) | exec-build | ~50-80 | autonomous via aif |
| Stage 10 (doctrine doc + README F3) | synthesis | ~300 markdown | autonomous via aif |

**Total Wave B: ~600-800 LOC across 5 PRs.**

**Hook verification (post-implementation):** re-run hook-verify test to confirm new hooks (4D arms, 9C arm, 7B extension) fire correctly in AIF container.

