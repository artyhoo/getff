# pipeline — launch

> **Authoritative for:** the selected pipeline procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

## §3 Launch-table

> Produces the per-sub-wave Mode decision table for the selected umbrella.

**Step 1 — inject umbrella kickoff + dispatch state:**

```!
bash "${CLAUDE_SKILL_DIR}/helpers/launch-table-generator.sh" "${umbrella:-}"
```

```!
bash "${CLAUDE_SKILL_DIR}/helpers/dispatch-from-state.sh" "${umbrella:-}"
```

**Step 2 — classify each sub-wave (judgment on injected data):**

Read the kickoff's sub-wave decomposition (§2 or §3 table). For each sub-wave, fill columns:

| Column           | Decision rule                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sub-wave id      | from kickoff — id grammar `[A-Za-z][A-Za-z0-9-]*` or `[0-9]+` (e.g. A, B, C, D, 1, 2, 3, K0, KD, today-hero)                                                                                                                                                                                                                                                                           |
| Type             | R-phase / execution-build / wiring / manual-liveness — from kickoff §0 `Type:` header                                                                                                                                                                                                                                                                                                  |
| Mode             | **Mode A** (inline Opus) if execution-build single OR wiring OR R-phase single; **Mode B × N worktrees** if execution-parallel ≥2 sub-waves in the same stage (per parallel-subwave-isolation.md §1); **Queue mode (sequential)** if R-phase-only or maintainer-specified sequential                                                                                                   |
| SDD?             | Yes if execution-build with ≥3 independent tasks (SSOT #64 mechanism); No for wiring / single-task R-phase / borderline (overhead > value). Threshold rationale: 1-2 tasks → SDD review overhead roughly equals catch-rate; 3+ → net positive                                                                                                                                          |
| Stage            | 1 / 2 / 3 — from kickoff dependency declaration (what must land before this sub-wave starts)                                                                                                                                                                                                                                                                                           |
| Parallel sibling | which other sub-wave runs concurrently — **V2 binding (research-patch §3, ADAPT SSOT #68 OhMyOpencode `Wave N`):** populated from each sub-wave's kickoff §2 `Parallel-with` column. Column omitted OR sub-waves disagree (A claims B; B does not claim A) → sequential default + ATTN. Rendered in [output-format.md §1A](output-format.md) Wave-style grouping (V3 no-arg overview). |
| Volume           | small / medium / large — NOT calendar time; based on estimated LOC + files changed. S=<100 LOC, M=100-500 LOC, L=>500 LOC                                                                                                                                                                                                                                                              |

**Step 3 — emit table:**

```text
Launch table — <umbrella> (as of <git-HEAD-short>):

| Sub-wave | Type | Mode | SDD? | Stage | Parallel sibling | Volume |
|---|---|---|---|---|---|---|
| A | <type> | <mode> | <Y/N> | 1 | B or — | <S/M/L> |
| B | <type> | <mode> | <Y/N> | 1 | A or — | <S/M/L> |
...
```

**Step 3b — TTY-only preset proposal (additive, never the only path):** when a TTY is present (`[ -t 0 ] && [ -t 1 ]`), render the preset row after the table; non-TTY contexts (CI, agents, pipes) skip it and rely on the flag/env path, which stays primary. Exact block + rationale: [`references/output-format.md §8`](output-format.md).

**Blocking rule:** if either helper (`launch-table-generator.sh` or `dispatch-from-state.sh`) emits «MISSING kickoff» OR a `DEGRADE:` line → halt and report (a `DEGRADE:` from the launch-table generator means zero sub-wave rows parsed — fill the table manually from the kickoff; #1518). Do NOT produce a launch-table without reading the actual kickoff. The two helpers are complementary: `launch-table-generator.sh` emits the auto-detected sub-wave skeleton; `dispatch-from-state.sh` emits state-file context (`winner_id`, `sub_wave_state`) plus the head-120 kickoff body for the AI to read in Step 2 when filling judgment columns. The §3 inline `cat .../kickoff.md` block that previously injected the kickoff body was removed 2026-05-28 (DN-3 A verdict, PR #261); its function is now owned by `dispatch-from-state.sh` (F.3 helper-collapse — single source for §3 dispatch context). <!-- @dual-pair: meta-orchestrator-dispatch-from-state -->

---

## §4 Meta-kickoff write

> Writes `<orch-home>/<umbrella>-meta-launch/kickoff.md` using the template (`<orch-home>` per the Path convention above — resolve it, do not assume `.claude/`).

**Step 1 — read template:**

```!
cat "${CLAUDE_SKILL_DIR}/templates/meta-kickoff.template.md"
```

**Step 2 — instantiate template (Write tool):**

Substitute every `{{<PLACEHOLDER_NAME>}}` token in both templates. The canonical 39-token list — grouped by source (plan-currency / launch-table / AI-traps / state-companion) with one-line resolution rules per token — lives in [`references/placeholders.md`](placeholders.md). Read it once, then substitute from §1+§3 output. The mechanical check that 1:1 enumeration matches the live templates is the maintainer's responsibility (re-run a `comm -23` between the templates' placeholders and the references file when either changes).

**Step 3 — write file:**

Target path: `<orch-home>/<umbrella>-meta-launch/kickoff.md`

**Mandatory sections in generated kickoff (principle 12 will validate):**

1. `## §5 AI-traps active` with explicit T-number list (NOT «see ai-laziness-traps.md» alone — that is a T7 anti-pattern per ai-laziness-traps.md §3).
2. Stage-gate rules as ACTUAL `gh pr list --search 'is:merged head:<branch> base:<base>'` commands (not prose).
3. Recursive-self-application clause.
4. Stop conditions per stage.

**Write the state.md companion:**

Target path: `<orch-home>/<umbrella>-meta-launch/state.md`

Use `${CLAUDE_SKILL_DIR}/templates/state.md.template` as the skeleton; fill §1 Inputs from plan-currency check output.

---
