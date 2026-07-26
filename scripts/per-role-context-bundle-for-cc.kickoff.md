<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: kickoff — per-role-context BUNDLE FOR CC. One-shot task: wait for the 3 parallel verification tasks (runtime-probe, deep-project-research, cold-review) to finish, then assemble ONE bundle document that Opus in Claude Code (CC) will receive for review + preparation toward the fabla. NOT a filter — the bundle preserves all findings, contradictions included. Operator-commissioned 2026-07-26. -->

# per-role-context-bundle-for-cc — kickoff

> **Goal:** assemble a single bundle document for Opus in Claude Code that contains ALL the raw material from this research track, organized for Opus's review (NOT pre-filtered). Opus will then prepare the fabla brief.
>
> **Why this task exists:** the operator defined the session boundary: GLM produces raw material in this worktree session, aif containers verify it in 3 parallel tasks, and Opus in CC accepts the bundle for review + fabla-prep. This task is the assembler — it does NOT decide what's right; it consolidates what each source said.
>
> **Output:** write `per-role-context-bundle-for-opus-in-cc.md` to project root. No filtering, no verdicts, no "Opus should do X."

## §0 What this task is NOT

- NOT a filter. All findings (including contradictions between sources) are preserved.
- NOT a recommendation. No "we should" / "best option" / verdicts.
- NOT a fix for prior deliverables. If cold-review found issues, those issues are reported as-is — Opus decides whether to act.
- NOT a license to modify any prior deliverable, code, rule, or script.

## §1 Source inventory — what to bundle

### Sources already in the repo (read from branch `origin/feat/prune-worktrees`)

These were written by the prior GLM-5.2 orchestrator session:

1. **Raw research patch** — `docs/meta-factory/research-patches/2026-07-26-per-role-context-shaping-raw-research.md` — 10 falsifiable claims (C1-C10), 8-item verify-list, 5 parked forks. The substantive research output.
2. **Candidate-shapes catalogue** — `docs/superpowers/specs/2026-07-26-per-role-context-candidate-shapes.md` — 18 candidate shapes (α-σ), neutrally described, no priority.
3. **Inflight-context dossier** — `docs/superpowers/specs/2026-07-26-per-role-context-inflight-context.md` — what else is moving on this surface (session-start-token-audit umbrella, PR #1175, scratchpad Seat A/B).

### Sources from parallel aif tasks (wait for these to finish, then incorporate)

4. **Runtime-probe report** — task `f164e807-191a-4336-9fe1-52145255c00e`. Output: `per-role-context-runtime-probe-report.md` in that task's project dir (`/Users/art/code/aif-handoff/projects/<project-for-f164e807>/`). Verifies 6 claims (P1-P6) in live CC runtime.
5. **Deep-project-research report** — task `f4dc0bff-37c6-4662-abab-5c67c9a646b6`. Output: `per-role-context-deep-research-report.md`. Exhaustive sweep of 12 surfaces (S1-S12); answers 7 load-bearing questions (Q1-Q7).
6. **Cold-review report** — task `4e73e54e-da1f-44a8-979e-209013a9e6cd`. Output: `per-role-context-cold-review-report.md`. 8-checklist audit (A-H) of the 3 deliverables above.

## §2 How to wait for the parallel tasks

Use `npx tsx packages/runtime-bridge/src/cli/await.ts <taskId>` for each, OR poll `getTask(baseUrl, taskId).status` until each reaches `done` / `verified` / `failed`. Time-box the wait: if a task is stuck >30 min, note it and proceed with what's available.

The 3 task IDs:
- `f164e807-191a-4336-9fe1-52145255c00e` (runtime-probe)
- `f4dc0bff-37c6-4662-abab-5c67c9a646b6` (deep-project-research)
- `4e73e54e-da1f-44a8-979e-209013a9e6cd` (cold-review)

## §3 Bundle structure

Write `per-role-context-bundle-for-opus-in-cc.md` with this structure. **Preserve contradictions** — if runtime-probe REFUTES a claim that deep-project-research CONFIRMS, both verdicts go in the bundle, and a "Contradictions to resolve" section at the end lists them.

```markdown
# Per-role context — bundle for Opus in CC

**Assembled:** <timestamp>
**Assembler:** aif-handoff container (bundle task, NOT a filter)
**For:** Opus review + fabla-prep in CC
**Session boundary:** GLM (worktree) → aif (3 verify tasks + this bundle) → Opus (CC, review + fabla-prep). Opus is the filter; fabla is the decider.

## 0. Reading order for Opus (suggested, not binding)

1. §1 — Original operator question + 3 deliverables (the substrate)
2. §2 — Runtime-probe results (live verification)
3. §3 — Deep-project-research results (exhaustive sweep)
4. §4 — Cold-review findings (audit of the deliverables)
5. §5 — Contradictions to resolve (the load-bearing unknowns)
6. §6 — Parked forks + candidate shapes (the decision space)

## 1. Substrate: the operator's question + 3 GLM deliverables

<operator question verbatim>
<summary of each of the 3 deliverables, with a one-line "what it claims to be" and a path-to-read>

## 2. Runtime-probe results (live CC verification)

<P1-P6 verdicts, copied from the runtime-probe report>
<each verdict: CONFIRMED / REFUTED / PARTIAL, with the live evidence>

## 3. Deep-project-research results (exhaustive sweep)

<S1-S12 surface findings, copied from the deep-research report>
<Q1-Q7 load-bearing question answers>

## 4. Cold-review findings (audit of the 3 deliverables)

<A-H checklist findings, copied from the cold-review report>
<highest-priority issues identified by the reviewer>

## 5. Contradictions to resolve (LOAD-BEARING)

<table: source A claim, source B counter-claim, what Opus needs to verify to break the tie>

This is the most important section. Where sources disagree, the bundle preserves both — Opus decides.

## 6. Parked forks + candidate shapes (decision space)

<5 forks from the raw research patch, copied verbatim>
<18 candidate shapes (α-σ), referenced by path not copied — Opus reads the original>

## 7. What the bundle does NOT do

- Does NOT pick a candidate shape.
- Does NOT resolve forks.
- Does NOT filter out "wrong" findings — contradictions preserved.
- Does NOT recommend next steps for Opus.
- Does NOT pre-load the fabla's framing.
```

## §4 Constraints

- **Read-only.** Do not modify any prior deliverable, code, rule, script, or parallel-task output. Copy/summarize; do not edit.
- **No filtering.** If a finding looks wrong, copy it anyway with a "(unverified)" note. Opus filters.
- **No recommendation.** Opus + fabla decide.
- **Preserve contradictions explicitly.** The §5 "Contradictions" section is the load-bearing output.
- **Cite source paths** for every copied finding so Opus can verify.
- **Self-application.** This task's own output (`per-role-context-bundle-for-opus-in-cc.md`) is part of the surface — note it but don't audit yourself.

## §5 After writing the bundle

The bundle file is the deliverable for Opus in CC. The operator will read it in a CC session (NOT in aif). The task ends when the bundle is written; no further action.

If any of the 3 parallel tasks failed or timed out, note that in §2/§3/§4 with "(task failed: <reason>)" and proceed with partial bundle. The bundle's value is preserved even partial.
