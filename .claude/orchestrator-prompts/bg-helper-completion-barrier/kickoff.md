# KICKOFF — bg-helper-completion-barrier

> **Type:** I-phase (build + wiring) — 2 stages, no R-phase (prior-art is trivial; see §1.5 BFR note).
> **Origin:** Incident 2026-06-01, this session. `/meta-orchestrator` no-arg V3: the orchestrator read `priority-score.sh`'s background-task output **before the task finished** (file held only the header line), concluded «zero candidates», and built a wrong overview. Root cause = parsing a background helper's stdout before completion + conflating two tasks' completion notifications.
> **Deliverable:** make background-helper incompleteness/crash **structurally detectable**, so an early or partial read fails loud instead of silently reading as «empty».
> **Base branch:** staging (NOT main — main is prod, manual promote only).
> **Launch:** `/meta-orchestrator bg-helper-completion-barrier` (this kickoff lives in gitignored `.claude/orchestrator-prompts/` — launch from a session/worktree that has it, or re-create via J5 hydration PR #310).

---

## §0 Cold-start context

Read in order:
1. This kickoff (binding scope + stage gates).
2. `.claude/skills/meta-orchestrator/SKILL.md §2 Step 1` (line 106-108, the `!`-fence that runs `priority-score.sh`) + `§2.5 Step 2/3` (dup-detect / classify call-sites) + `§10 item 5` (cache + delta writes).
3. `.claude/skills/meta-orchestrator/helpers/classify-each-candidate.sh:51-52` — the `awk 'NF>=2 && /kickoff=/ && !/^=== /'` filter that already strips `=== … ===` divider lines (this is WHY the sentinel is parse-safe).

**The bug in one line:** a slow helper (`priority-score.sh`: ~120 umbrellas × `gh`/`git`) is run in background; the session reads its output file mid-write and treats partial = final.

---

## §1 Inputs

- **Incident evidence:** this session's transcript — `priority-score.sh` output read at header-only state → «zero candidates» (false); true output = ~170 candidates.
- **Safety pre-verified (do not re-litigate, just preserve):**
  - Parser already excludes `=== ` lines: `classify-each-candidate.sh:52`. A terminal `=== … END … ===` trailer is the SAME shape as the existing dividers at `priority-score.sh:83` and `:207` → cannot become a candidate.
  - Existing tests assert **exit code** (`r.status).toBe(0)`) and **candidate-header count** (`classify-each-candidate.test.ts:63-65 .toBe(4)`), NOT total-line-count or exact full-output. So a trailer is test-safe **iff** it does not change the script's final exit status.
- **Affected call-sites (background helpers consumed by the skill):** `priority-score.sh`, `dup-detect.sh`, `inflight-check.sh` (and any future helper invoked via `!`-fence whose run can be backgrounded).

## §1.5 BFR note (capability-commit — Prior-art trailer required on Stage 1)

`scripts/run-helper.sh` (or `.claude/skills/meta-orchestrator/helpers/run-helper.sh`) is a **new code module** → capability commit. BFR verdict is pre-reasoned **BUILD**: the wrapper is ~10-15 LOC of trivial bash (`"$@"; rc=$?; echo "=== <name>: END rc=$rc (lines=…) ==="; exit $rc`-shape); no upstream «run-child-and-append-exit-trailer» tool is worth a dependency. Stage 1 Worker MUST still: consult `prior-art-evaluations.md` for a matching capability area, run the `phase-research-coverage §1` negative-existence check on «no upstream wrapper», and carry a `Prior-art:` trailer (escape-hatch acceptable: «trivial bash exec-wrapper, no upstream analog worth a dep»).

---

## §2 Design (binding scope — what to build, what NOT to)

**Layer 1 — behavioural read-rule (the primary fix; prose, $0).** In `SKILL.md §2 Step 1` and `§2.5 Step 2/3`, add: *background-helper output is parsed ONLY after that helper's own `task-notification` (matched by task-id) OR the presence of its `END rc=` trailer (Layer 3); a header-only / trailer-absent file = «still running», NOT «zero results»; never conflate one task's completion notification with another's.* This directly fixes the incident's actual mistake.

**Layer 3 — `run-helper.sh` wrapper (mechanical, single-source).** Runs the target helper as a child and **always** appends a terminal trailer regardless of how the child exited:

```bash
=== <helper-name>: END rc=<exit-code> (lines=<stdout-line-count>) ===
```

Reroute the §2 / §2.5 / §10 helper call-sites through it. The skill read-rule becomes uniform: *parse only after the `END rc=` trailer line is present.* Trailer is `=== `-prefixed → already filtered by `classify-each-candidate.sh:52` (parse-safe, verified §1).

**Layer 2 — EXPLICITLY DROPPED (subsumed).** A per-script `echo END` at end-of-script does **not** fire on abnormal exit (`set -e` abort, kill, timeout) — exactly the crash case you most want a signal for. The wrapper closes that hole because it appends the trailer from the parent, not the child. Two `END` markers (script-side + wrapper-side) would also create an «authoritative marker?» ambiguity. Net: Layer 3 strictly dominates Layer 2.

**Hard constraint:** the wrapper's `echo` must NOT alter the child's exit status — capture `rc=$?` first, echo, then `exit $rc`. Tests assert `r.status).toBe(0)`; breaking exit-code propagation breaks them.

**Out of scope:** foregrounding the helpers (they are genuinely slow; background is correct — the fix is the read, not the launch); rewriting `priority-score.sh` internals; touching the completion-filter logic.

---

## §3 Sub-wave decomposition (Stage gates — REAL git checks)

### Stage 1 — Sub-wave A: build `run-helper.sh` + paired-negative test (I-phase-small, Mode A inline, TDD)

- Write the test FIRST (project principle 02 / Class B paired-negative): a positive test (wrapper appends `END rc=0` for a clean helper; passes through stdout verbatim; preserves exit 0) AND a paired-negative (wrapper appends `END rc=<n>` AND propagates a non-zero exit when the child crashes/`exit 1`; trailer present even when child dies mid-output).
- Then implement `run-helper.sh`.
- Capability commit → `Prior-art:` trailer (§1.5).

**Stage 1 → Stage 2 gate (REAL):**

```bash
gh pr list --search "is:merged head:feat/run-helper-wrapper base:staging" \
  --json number,title,mergedAt,headRefName --limit 5
```

Expected: non-empty. Empty → HALT, do not start Stage 2.

### Stage 2 — Sub-wave B: wire call-sites + Layer-1 read-rule + regression-verify (wiring, Mode A inline)

- Reroute `SKILL.md §2 Step 1` (`priority-score.sh`), `§2.5 Step 2` (`dup-detect.sh` + `inflight-check.sh`), and any §10 background helper through `run-helper.sh`.
- Add the Layer-1 read-rule prose (see §2).
- **Regression-verify (mandatory, paste actual output):** run the 5 existing tests green —
  ```bash
  npm --prefix packages/core test -- priority-score-branch-matcher done-md-completion-filter classify-each-candidate planner-discovery delta-diff 2>&1 | tail -15
  ```
  All must pass. Confirm exit-code preserved + `!/^=== /` filter still strips the new trailer.

**Stage 2 → done gate:**

```bash
gh pr list --search "is:merged head:feat/wire-helper-barrier base:staging" \
  --json number,title,mergedAt,headRefName --limit 5
```

**§4b §1.7 PR-body mandate APPLIES to both stages** — target files match `.claude/skills/**` (and Stage 1 touches `helpers/`). Both PRs MUST carry `### §1.7 Forward-check applied` + `### §1.7 Backward-check applied` (H3 headings, word «applied», ≥40 chars each, ≥1 `file:line` per section). Pre-flight grep before `gh pr create`.

**Phase -1 cold-review between Stage 1 and Stage 2 is MANDATORY** (reviewer surfaces strategy forks as DECISION-NEEDED, does not pick).

---

## §5 AI-traps active (per `ai-laziness-traps.md §2`)

See `.claude/rules/ai-laziness-traps.md §2` for the full catalogue. **Active canonical traps for this umbrella:**

- **T3** — plausible finding without verification: every «test passes» / «parse-safe» claim needs command output, not prose. (This umbrella exists *because* of an unverified claim.)
- **T11** — designing custom solution without prior-art check: the §1.5 BFR consult is mandatory before the wrapper lands, even though BUILD is pre-reasoned.
- **T15** — self-application: this fix is *about* the orchestrator reading its own helpers — verify the fix on the orchestrator's own `priority-score.sh` call-path, not a toy helper.
- **T19** — CI ≠ design review: green regression tests do not substitute for the Phase -1 cold-review between stages.

**Domain-specific trap (NOT in canonical catalogue):**

- **T-BGB-A — «trailer present ⇒ output complete» misread.** The `END rc=0` trailer proves the *child finished*, not that *its work was correct* (e.g. `gh` rate-limited mid-run, exited 0, emitted partial candidate set). Counter: the trailer guarantees *completion + exit-status*, not *semantic completeness*; semantic checks (candidate count sanity, `gh` error detection) stay separate. Do not let the barrier create false confidence in content.

> Blanket «see ai-laziness-traps.md» without the enumeration above = T7 violation.

---

## §6 Recursive self-application

This umbrella fixes the meta-orchestrator's own read-discipline. Verify the fix end-to-end on the **real** `/meta-orchestrator` no-arg path (the one that failed this session): after wiring, a no-arg invocation must either wait for the `priority-score.sh` notification/trailer before scoring, or visibly emit «helper still running — re-reading» — never «zero candidates» off a header-only file.

---

## §7 Stop conditions

- `run-helper.sh` changes the child's exit code (breaks `toBe(0)` tests) → STOP, fix exit propagation.
- Any of the 5 regression tests fail after wiring → STOP, do not merge Stage 2.
- Phase -1 reviewer returns STOP → escalate to maintainer.
- Temptation to foreground the helpers «to make it simpler» → STOP (out of scope; background is correct).

---

## §8 Anti-scope

- Do NOT foreground the slow helpers.
- Do NOT rewrite `priority-score.sh` / `dup-detect.sh` internals beyond routing them through the wrapper.
- Do NOT add an npm dep (trivial bash; BFR BUILD).
- Do NOT keep a per-script `echo END` (Layer 2) alongside the wrapper — it is dropped-as-subsumed (§2).

---

## §9 See also

- `.claude/skills/meta-orchestrator/SKILL.md §2 / §2.5 / §10` — call-sites.
- `.claude/skills/meta-orchestrator/helpers/classify-each-candidate.sh:51-52` — the `!/^=== /` filter that makes the trailer parse-safe.
- `.claude/rules/ai-laziness-traps.md §2` (T3/T10/T15) — T10 «report completeness based on what you LOOKED at, not what EXISTS» is the canonical form of this incident.
- `.claude/rules/dual-implementation-discipline.md` — if the wrapper is later shipped to consumers, the dual-channel markers apply.
- `CLAUDE.md` «What is a capability commit?» — Stage 1 Prior-art trailer requirement.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
